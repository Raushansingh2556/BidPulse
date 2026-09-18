import { db, DbClient } from "../db/database";
import { randomUUID as uuidv4 } from "crypto";

export interface PlaceBidInput {
  auctionId: string;
  bidderId: string;
  bidderName: string;
  amount: number;
  idempotencyKey: string;
}

export interface PlaceBidResult {
  success: boolean;
  code?: string;
  message?: string;
  bid?: {
    id: string;
    auctionId: string;
    bidderId: string;
    bidderName: string;
    amount: number;
    serverTimestamp: string;
    serverTimestampMs: number;
    sequenceNumber: number;
    minNextBid: number;
  };
}

export async function placeBid(input: PlaceBidInput): Promise<PlaceBidResult> {
  const { auctionId, bidderId, bidderName, amount, idempotencyKey } = input;

  if (!auctionId || !bidderId || !amount || !idempotencyKey) {
    return {
      success: false,
      code: "INVALID_INPUT",
      message: "Missing required fields: auctionId, bidderId, amount, idempotencyKey",
    };
  }

  if (amount <= 0 || !Number.isFinite(amount)) {
    return {
      success: false,
      code: "INVALID_AMOUNT",
      message: "Bid amount must be a positive number",
    };
  }

  // Pre-check idempotency to short-circuit fast duplicate network retries
  const existingBid = await db.query(
    `SELECT b.*, u.name as bidder_name, a.min_increment
     FROM bids b
     JOIN users u ON b.bidder_id = u.id
     JOIN auctions a ON b.auction_id = a.id
     WHERE b.idempotency_key = $1`,
    [idempotencyKey]
  );

  if (existingBid.rowCount > 0) {
    const row = existingBid.rows[0];
    return {
      success: true,
      message: "Bid was already processed and accepted (idempotent response)",
      bid: {
        id: row.id,
        auctionId: row.auction_id,
        bidderId: row.bidder_id,
        bidderName: row.bidder_name,
        amount: parseFloat(row.amount),
        serverTimestamp: new Date(Number(row.server_timestamp_ms)).toISOString(),
        serverTimestampMs: Number(row.server_timestamp_ms),
        sequenceNumber: Number(row.sequence_number),
        minNextBid: parseFloat(row.amount) + parseFloat(row.min_increment),
      },
    };
  }

  // Execute critical serializable transaction with row-level locks
  try {
    return await db.withTransaction<PlaceBidResult>(
      async (tx: DbClient) => {
        // 1. SELECT auction FOR UPDATE (Authoritative row-level lock)
        const auctionRes = await tx.query(
          `SELECT * FROM auctions WHERE id = $1 FOR UPDATE`,
          [auctionId]
        );

        if (auctionRes.rowCount === 0) {
          return {
            success: false,
            code: "AUCTION_NOT_FOUND",
            message: `Auction with ID ${auctionId} not found`,
          };
        }

        const auction = auctionRes.rows[0];
        const serverNow = Date.now();
        const startTime = new Date(auction.start_time).getTime();
        const endTime = new Date(auction.end_time).getTime();

        // 2. Validate Auction Status & Authoritative Server Timing
        if (auction.status !== "LIVE") {
          return {
            success: false,
            code: auction.status === "ENDED" ? "AUCTION_ENDED" : "AUCTION_NOT_LIVE",
            message: `Auction is currently ${auction.status}. Bids can only be accepted when LIVE.`,
          };
        }

        if (serverNow < startTime) {
          return {
            success: false,
            code: "AUCTION_NOT_STARTED",
            message: "Auction has not started yet according to server time",
          };
        }

        if (serverNow >= endTime) {
          return {
            success: false,
            code: "AUCTION_ENDED",
            message: "Authoritative server end time has been reached. No more bids accepted.",
          };
        }

        // 3. Validate Bid Amount against authoritative current highest bid
        const currentHighest = parseFloat(auction.current_highest_bid);
        const minIncrement = parseFloat(auction.min_increment);
        const startingPrice = parseFloat(auction.starting_price);
        
        let requiredMinBid = startingPrice;
        if (auction.total_bids_count > 0 || currentHighest > 0) {
          requiredMinBid = currentHighest + minIncrement;
        }

        if (amount < requiredMinBid) {
          return {
            success: false,
            code: "BID_TOO_LOW",
            message: `Bid of ₹${amount.toLocaleString("en-IN")} rejected. Minimum valid bid is ₹${requiredMinBid.toLocaleString("en-IN")}.`,
          };
        }

        // 4. Validate Host cannot bid on their own auction
        if (auction.host_id === bidderId) {
          return {
            success: false,
            code: "FORBIDDEN",
            message: "Hosts are strictly forbidden from bidding on their own auctions",
          };
        }

        // 5. Check and Lock Bidder's Wallet
        const walletRes = await tx.query(
          `SELECT * FROM wallets WHERE user_id = $1 FOR UPDATE`,
          [bidderId]
        );

        if (walletRes.rowCount === 0) {
          return {
            success: false,
            code: "WALLET_NOT_FOUND",
            message: "Bidder wallet not found",
          };
        }

        const wallet = walletRes.rows[0];
        const availableBalance = parseFloat(wallet.available_balance);

        if (availableBalance < amount) {
          return {
            success: false,
            code: "INSUFFICIENT_BALANCE",
            message: `Insufficient wallet balance. Available: ₹${availableBalance.toLocaleString("en-IN")}, Required: ₹${amount.toLocaleString("en-IN")}`,
          };
        }

        // 6. Check unique participant tracking
        const participantRes = await tx.query(
          `SELECT * FROM auction_participants WHERE auction_id = $1 AND user_id = $2`,
          [auctionId, bidderId]
        );
        const isFirstTimeBidder = participantRes.rowCount === 0;

        // 7. Update Wallet: Reserve/Lock Bidder Funds
        const newAvailable = availableBalance - amount;
        const newLocked = parseFloat(wallet.locked_balance) + amount;

        await tx.query(
          `UPDATE wallets
           SET available_balance = $1, locked_balance = $2, updated_at = NOW()
           WHERE user_id = $3`,
          [newAvailable, newLocked, bidderId]
        );

        // 8. Insert Immutable Ledger Entry
        const bidId = `bid_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
        const ledgerId = `led_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

        await tx.query(
          `INSERT INTO wallet_ledger (
             id, user_id, type, amount, available_delta, locked_delta, balance_after,
             reference_id, description, idempotency_key, created_at
           ) VALUES ($1, $2, 'BID_RESERVE', $3, $4, $5, $6, $7, $8, $9, NOW())`,
          [
            ledgerId,
            bidderId,
            amount,
            -amount,
            amount,
            newAvailable,
            bidId,
            `Reserved ₹${amount} for bid on auction "${auction.title}"`,
            `${idempotencyKey}_ledger`,
          ]
        );

        // 9. Increment sequence version & update auction state
        const nextSequence = Number(auction.sequence_version) + 1;
        const totalBidsCount = Number(auction.total_bids_count) + 1;
        const uniqueBiddersCount = Number(auction.unique_bidders_count) + (isFirstTimeBidder ? 1 : 0);

        await tx.query(
          `UPDATE auctions
           SET current_highest_bid = $1,
               highest_bidder_id = $2,
               total_bids_count = $3,
               unique_bidders_count = $4,
               sequence_version = $5,
               updated_at = NOW()
           WHERE id = $6`,
          [amount, bidderId, totalBidsCount, uniqueBiddersCount, nextSequence, auctionId]
        );

        // 10. Record Participant
        if (isFirstTimeBidder) {
          await tx.query(
            `INSERT INTO auction_participants (auction_id, user_id, first_joined_at, last_bid_at)
             VALUES ($1, $2, NOW(), NOW())
             ON CONFLICT (auction_id, user_id) DO UPDATE SET last_bid_at = NOW()`,
            [auctionId, bidderId]
          );
        } else {
          await tx.query(
            `UPDATE auction_participants SET last_bid_at = NOW() WHERE auction_id = $1 AND user_id = $2`,
            [auctionId, bidderId]
          );
        }

        // 11. Insert Authoritative Bid Record with Millisecond Precision
        const serverTimestampMs = Date.now();
        const serverTimestampIso = new Date(serverTimestampMs).toISOString();

        await tx.query(
          `INSERT INTO bids (
             id, auction_id, bidder_id, amount, idempotency_key,
             server_timestamp, server_timestamp_ms, sequence_number, status, created_at
           ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'ACCEPTED', NOW())`,
          [
            bidId,
            auctionId,
            bidderId,
            amount,
            idempotencyKey,
            serverTimestampIso,
            serverTimestampMs,
            nextSequence,
          ]
        );

        // 12. Transactional Outbox Event
        // Will be broadcast to Redis Pub/Sub -> WebSockets ONLY AFTER successful commit!
        const outboxId = `out_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
        const payload = {
          auctionId,
          bidId,
          bidderId,
          bidderName,
          amount,
          minNextBid: amount + minIncrement,
          serverTimestamp: serverTimestampIso,
          serverTimestampMs,
          sequenceNumber: nextSequence,
          totalBidsCount,
          uniqueBiddersCount,
        };

        await tx.query(
          `INSERT INTO outbox_events (
             id, aggregate_type, aggregate_id, event_type, payload, sequence_number, published, created_at
           ) VALUES ($1, 'AUCTION', $2, 'BID_ACCEPTED', $3, $4, FALSE, NOW())`,
          [outboxId, auctionId, JSON.stringify(payload), nextSequence]
        );

        return {
          success: true,
          message: "Bid accepted and serialized successfully",
          bid: {
            id: bidId,
            auctionId,
            bidderId,
            bidderName,
            amount,
            serverTimestamp: serverTimestampIso,
            serverTimestampMs,
            sequenceNumber: nextSequence,
            minNextBid: amount + minIncrement,
          },
        };
      },
      { isolationLevel: "SERIALIZABLE", maxRetries: 5, initialBackoffMs: 20 }
    );
  } catch (err: any) {
    if (err.code === "23505" && err.constraint?.includes("idempotency")) {
      return {
        success: false,
        code: "DUPLICATE_IDEMPOTENCY_KEY",
        message: "A bid with this idempotency key was already submitted",
      };
    }

    console.error("[BID] Transaction error:", err);
    return {
      success: false,
      code: "SERIALIZATION_FAILURE",
      message: err.message || "Failed to commit serialized bid transaction under concurrent load",
    };
  }
}

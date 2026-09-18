import { db, DbClient } from "../db/database";

export function calculateSubscriptionFee(startingPrice: number): number {
  if (startingPrice < 10000) {
    return 99;
  } else if (startingPrice <= 100000) {
    return 199;
  } else {
    return 499;
  }
}

export async function checkAndTransitionAuctions(): Promise<void> {
  const now = new Date().toISOString();

  // 1. Transition UPCOMING -> LIVE
  const upcomingToLive = await db.query(
    `SELECT id, title, sequence_version FROM auctions
     WHERE status = 'UPCOMING' AND is_subscription_paid = TRUE AND start_time <= $1`,
    [now]
  );

  for (const auc of upcomingToLive.rows) {
    const nextSeq = Number(auc.sequence_version) + 1;
    await db.query(
      `UPDATE auctions SET status = 'LIVE', sequence_version = $1, updated_at = NOW() WHERE id = $2`,
      [nextSeq, auc.id]
    );

    await db.query(
      `INSERT INTO outbox_events (id, aggregate_type, aggregate_id, event_type, payload, sequence_number, published, created_at)
       VALUES ($1, 'AUCTION', $2, 'AUCTION_STATE', $3, $4, FALSE, NOW())`,
      [
        `out_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        auc.id,
        JSON.stringify({ auctionId: auc.id, status: "LIVE", message: "Auction is now LIVE!" }),
        nextSeq,
      ]
    );
  }

  // 2. Transition LIVE -> ENDED & Settle
  const liveToEnded = await db.query(
    `SELECT id FROM auctions
     WHERE status = 'LIVE' AND end_time <= $1`,
    [now]
  );

  for (const auc of liveToEnded.rows) {
    try {
      await finalizeAuction(auc.id);
    } catch (err) {
      console.error(`[AUCTION] Failed to finalize auction ${auc.id}:`, err);
    }
  }
}

export async function finalizeAuction(auctionId: string): Promise<boolean> {
  return await db.withTransaction<boolean>(
    async (tx: DbClient) => {
      // 1. Lock auction row
      const auctionRes = await tx.query(
        `SELECT * FROM auctions WHERE id = $1 FOR UPDATE`,
        [auctionId]
      );

      if (auctionRes.rowCount === 0) return false;
      const auction = auctionRes.rows[0];

      if (auction.status === "ENDED") {
        return true; // Already settled
      }

      // 2. Retrieve highest bid
      const highestBidRes = await tx.query(
        `SELECT b.*, u.name as winner_name, u.email as winner_email
         FROM bids b
         JOIN users u ON b.bidder_id = u.id
         WHERE b.auction_id = $1 AND b.status = 'ACCEPTED'
         ORDER BY b.amount DESC, b.server_timestamp_ms ASC
         LIMIT 1`,
        [auctionId]
      );

      const hasWinner = highestBidRes.rowCount > 0;
      const winner = hasWinner ? highestBidRes.rows[0] : null;
      const winningAmount = winner ? parseFloat(winner.amount) : 0;
      const winnerId = winner ? winner.bidder_id : null;

      // 3. Mark auction as ENDED
      const nextSeq = Number(auction.sequence_version) + 1;
      await tx.query(
        `UPDATE auctions
         SET status = 'ENDED',
             winner_id = $1,
             winning_bid_amount = $2,
             settled_at = NOW(),
             sequence_version = $3,
             updated_at = NOW()
         WHERE id = $4`,
        [winnerId, hasWinner ? winningAmount : null, nextSeq, auctionId]
      );

      // 4. Settle wallets for all bidders (Transactional Wallet Ledger)
      // Retrieve all locked bids for this auction
      const allBidsRes = await tx.query(
        `SELECT bidder_id, SUM(amount) as total_locked
         FROM bids
         WHERE auction_id = $1 AND status = 'ACCEPTED'
         GROUP BY bidder_id`,
        [auctionId]
      );

      for (const row of allBidsRes.rows) {
        const bidderId = row.bidder_id;
        const totalLockedOnAuction = parseFloat(row.total_locked);

        if (bidderId === winnerId) {
          // Winner settlement in simulated demo model:
          // Release winner's locked amount back to available
          const wWalletRes = await tx.query(
            `SELECT available_balance, locked_balance FROM wallets WHERE user_id = $1 FOR UPDATE`,
            [winnerId]
          );
          if (wWalletRes.rowCount > 0) {
            const avail = parseFloat(wWalletRes.rows[0].available_balance);
            const locked = parseFloat(wWalletRes.rows[0].locked_balance);
            const toUnlock = Math.min(locked, totalLockedOnAuction);

            const newAvail = avail + toUnlock;
            const newLocked = locked - toUnlock;

            await tx.query(
              `UPDATE wallets SET available_balance = $1, locked_balance = $2, updated_at = NOW() WHERE user_id = $3`,
              [newAvail, newLocked, winnerId]
            );

            await tx.query(
              `INSERT INTO wallet_ledger (id, user_id, type, amount, available_delta, locked_delta, balance_after, reference_id, description, idempotency_key)
               VALUES ($1, $2, 'WINNER_RELEASE', $3, $4, $5, $6, $7, $8, $9)`,
              [
                `led_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
                winnerId,
                toUnlock,
                toUnlock,
                -toUnlock,
                newAvail,
                auctionId,
                `Winner fund release for auction "${auction.title}"`,
                `win_rel_${auctionId}_${winnerId}`,
              ]
            );
          }

          // Credit host with winning amount
          const hostWalletRes = await tx.query(
            `SELECT available_balance, locked_balance FROM wallets WHERE user_id = $1 FOR UPDATE`,
            [auction.host_id]
          );
          if (hostWalletRes.rowCount > 0) {
            const hostAvail = parseFloat(hostWalletRes.rows[0].available_balance);
            const newHostAvail = hostAvail + winningAmount;

            await tx.query(
              `UPDATE wallets SET available_balance = $1, updated_at = NOW() WHERE user_id = $2`,
              [newHostAvail, auction.host_id]
            );

            await tx.query(
              `INSERT INTO wallet_ledger (id, user_id, type, amount, available_delta, locked_delta, balance_after, reference_id, description, idempotency_key)
               VALUES ($1, $2, 'HOST_CREDIT', $3, $4, 0, $5, $6, $7, $8)`,
              [
                `led_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
                auction.host_id,
                winningAmount,
                winningAmount,
                newHostAvail,
                auctionId,
                `Host winning credit for auction "${auction.title}"`,
                `host_credit_${auctionId}`,
              ]
            );
          }
        } else {
          // Losing bidder: release all their locked amount on this auction back to available balance
          const lWalletRes = await tx.query(
            `SELECT available_balance, locked_balance FROM wallets WHERE user_id = $1 FOR UPDATE`,
            [bidderId]
          );
          if (lWalletRes.rowCount > 0) {
            const avail = parseFloat(lWalletRes.rows[0].available_balance);
            const locked = parseFloat(lWalletRes.rows[0].locked_balance);
            const toUnlock = Math.min(locked, totalLockedOnAuction);

            const newAvail = avail + toUnlock;
            const newLocked = locked - toUnlock;

            await tx.query(
              `UPDATE wallets SET available_balance = $1, locked_balance = $2, updated_at = NOW() WHERE user_id = $3`,
              [newAvail, newLocked, bidderId]
            );

            await tx.query(
              `INSERT INTO wallet_ledger (id, user_id, type, amount, available_delta, locked_delta, balance_after, reference_id, description, idempotency_key)
               VALUES ($1, $2, 'BID_RELEASE', $3, $4, $5, $6, $7, $8, $9)`,
              [
                `led_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
                bidderId,
                toUnlock,
                toUnlock,
                -toUnlock,
                newAvail,
                auctionId,
                `Outbid refund for auction "${auction.title}"`,
                `bid_rel_${auctionId}_${bidderId}`,
              ]
            );

            // Notify losing bidder
            await tx.query(
              `INSERT INTO notifications (id, user_id, title, message, type, link)
               VALUES ($1, $2, 'Auction Ended', $3, 'AUCTION_ENDED', $4)`,
              [
                `notif_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
                bidderId,
                `The auction "${auction.title}" has concluded. Your reserved funds of ₹${toUnlock.toLocaleString("en-IN")} have been unlocked.`,
                `/auctions/${auctionId}`,
              ]
            );
          }
        }
      }

      // Notify winner
      if (winnerId && winner) {
        await tx.query(
          `INSERT INTO notifications (id, user_id, title, message, type, link)
           VALUES ($1, $2, '🎉 Congratulations! You Won the Auction!', $3, 'AUCTION_WON', $4)`,
          [
            `notif_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
            winnerId,
            `You placed the winning bid of ₹${winningAmount.toLocaleString("en-IN")} on "${auction.title}"!`,
            `/auctions/${auctionId}`,
          ]
        );
      }

      // 5. Insert Transactional Outbox Event for AUCTION_ENDED
      await tx.query(
        `INSERT INTO outbox_events (id, aggregate_type, aggregate_id, event_type, payload, sequence_number, published, created_at)
         VALUES ($1, 'AUCTION', $2, 'AUCTION_ENDED', $3, $4, FALSE, NOW())`,
        [
          `out_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          auctionId,
          JSON.stringify({
            auctionId,
            status: "ENDED",
            winnerId,
            winnerName: winner ? winner.winner_name : null,
            winningAmount,
            settledAt: new Date().toISOString(),
            sequenceNumber: nextSeq,
          }),
          nextSeq,
        ]
      );

      return true;
    },
    { isolationLevel: "SERIALIZABLE", maxRetries: 5 }
  );
}

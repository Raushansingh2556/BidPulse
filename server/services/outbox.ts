import { db } from "../db/database";
import { realtime } from "./realtime";

class OutboxProcessor {
  private isRunning = false;
  private timer: NodeJS.Timeout | null = null;

  start(intervalMs: number = 100): void {
    if (this.isRunning) return;
    this.isRunning = true;
    console.log("[OUTBOX] Starting Transactional Outbox processor...");

    const poll = async () => {
      if (!this.isRunning) return;
      try {
        await this.processEvents();
      } catch (err) {
        // silent loop error
      } finally {
        if (this.isRunning) {
          this.timer = setTimeout(poll, intervalMs);
        }
      }
    };

    poll();
  }

  stop(): void {
    this.isRunning = false;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  async processEvents(): Promise<number> {
    // Select unpublished events ordered by sequence
    const result = await db.query(
      `SELECT * FROM outbox_events
       WHERE published = FALSE
       ORDER BY created_at ASC, sequence_number ASC
       LIMIT 50`
    );

    if (result.rowCount === 0) return 0;

    for (const event of result.rows) {
      try {
        const payload = typeof event.payload === "string" ? JSON.parse(event.payload) : event.payload;
        
        // Broadcast through Realtime WebSocket/Redis PubSub
        realtime.publishEvent(
          event.event_type,
          event.aggregate_id,
          payload,
          Number(event.sequence_number)
        );

        // Process transactional email notifications asynchronously
        if (event.event_type === "BID_ACCEPTED" && payload.auctionId) {
          try {
            const { emailService } = await import("./email");
            const prevBiddersRes = await db.query(
              `SELECT DISTINCT u.email, u.name, a.title
               FROM bids b
               JOIN users u ON b.bidder_id = u.id
               JOIN auctions a ON b.auction_id = a.id
               WHERE b.auction_id = $1 AND b.bidder_id != $2 AND b.status = 'ACCEPTED'`,
              [payload.auctionId, payload.bidderId]
            );

            for (const row of prevBiddersRes.rows) {
              await emailService.sendEmail({
                recipientEmail: row.email,
                recipientName: row.name,
                subject: `Outbid Alert: ₹${Number(payload.amount).toLocaleString("en-IN")} on "${row.title}"`,
                type: "OUTBID",
                metadata: { auctionId: payload.auctionId, newAmount: payload.amount },
                html: `
                  <div style="font-family: sans-serif; color: #1e293b; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
                    <h2 style="color: #0284c7; margin-top: 0;">You've Been Outbid!</h2>
                    <p>Dear ${row.name},</p>
                    <p>Another collector has placed a higher bid of <strong>₹${Number(payload.amount).toLocaleString("en-IN")}</strong> on <em>${row.title}</em>.</p>
                    <p>To reclaim the leading position, please place your next incremental bid promptly before the authoritative countdown timer expires.</p>
                    <div style="margin: 24px 0;">
                      <a href="/#auction-${payload.auctionId}" style="background-color: #0284c7; color: #fff; padding: 10px 20px; text-decoration: none; border-radius: 6px; font-weight: 600;">Return to Live Bidding</a>
                    </div>
                    <p style="font-size: 12px; color: #64748b;">This automated transactional alert is serialized through the BidPulse PostgreSQL Transactional Outbox engine.</p>
                  </div>
                `,
                text: `Outbid Alert: Someone placed a higher bid of ₹${payload.amount} on "${row.title}". Return to auction to counter-bid.`,
              });
            }
          } catch (mailErr) {
            console.warn("[OUTBOX EMAIL] Error sending outbid notifications:", mailErr);
          }
        }

        // Mark as published safely
        await db.query(
          `UPDATE outbox_events SET published = TRUE, published_at = NOW() WHERE id = $1`,
          [event.id]
        );
      } catch (err) {
        console.error(`[OUTBOX] Failed to publish event ${event.id}:`, err);
      }
    }

    return result.rowCount;
  }
}

export const outbox = new OutboxProcessor();

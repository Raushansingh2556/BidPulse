import { db } from "../db/database";

export interface TransactionalEmail {
  id: string;
  recipientEmail: string;
  recipientName: string;
  subject: string;
  html: string;
  text: string;
  type: "OUTBID" | "AUCTION_WON" | "AUCTION_ENDING_SOON" | "SUBSCRIPTION_RECEIPT" | "WALLET_TOPUP" | "CHANGE_REQUEST_STATUS";
  metadata?: Record<string, any>;
  sentAt: string;
}

class EmailService {
  private inMemoryQueue: TransactionalEmail[] = [];

  async sendEmail(params: {
    recipientEmail: string;
    recipientName?: string;
    subject: string;
    html: string;
    text?: string;
    type: TransactionalEmail["type"];
    metadata?: Record<string, any>;
  }): Promise<TransactionalEmail> {
    const emailRecord: TransactionalEmail = {
      id: `eml_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      recipientEmail: params.recipientEmail.toLowerCase(),
      recipientName: params.recipientName || "Collector",
      subject: params.subject,
      html: params.html,
      text: params.text || params.subject,
      type: params.type,
      metadata: params.metadata || {},
      sentAt: new Date().toISOString(),
    };

    this.inMemoryQueue.unshift(emailRecord);
    if (this.inMemoryQueue.length > 200) {
      this.inMemoryQueue.pop();
    }

    // Try to record in database notifications table as well for synchronized state
    try {
      const userRes = await db.query(
        "SELECT id FROM users WHERE LOWER(email) = LOWER($1)",
        [params.recipientEmail]
      );
      if (userRes.rowCount > 0) {
        const userId = userRes.rows[0].id;
        await db.query(
          `INSERT INTO notifications (id, user_id, title, message, type, link, is_read, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, FALSE, NOW())`,
          [
            `notif_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            userId,
            params.subject,
            params.text || params.subject,
            params.type,
            params.metadata?.link || null,
          ]
        );
      }
    } catch (err) {
      console.warn("[EMAIL] Could not link notification to user:", err);
    }

    console.log(`[EMAIL DISPATCH] [${emailRecord.type}] To: ${emailRecord.recipientEmail} | Subject: "${emailRecord.subject}"`);
    return emailRecord;
  }

  getEmailsForUser(email: string): TransactionalEmail[] {
    const lower = email.toLowerCase();
    return this.inMemoryQueue.filter(
      (e) => e.recipientEmail === lower || lower === "admin@auctionhub.in"
    );
  }

  getAllEmails(): TransactionalEmail[] {
    return [...this.inMemoryQueue];
  }
}

export const emailService = new EmailService();

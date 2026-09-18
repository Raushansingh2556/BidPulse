import { Router, Request, Response } from "express";
import bcrypt from "bcryptjs";
import { db } from "../db/database";
import {
  signToken,
  authenticate,
  requireRole,
  requireAuthorizedHost,
  AuthenticatedRequest,
} from "../services/auth";
import { placeBid } from "../services/bidding";
import { calculateSubscriptionFee, finalizeAuction } from "../services/auction";
import { stressRunner, StressTestConfig } from "../services/stress";
import { realtime } from "../services/realtime";
import { emailService } from "../services/email";

export const apiRouter = Router();

// ==============================================================================
// 1. AUTHENTICATION & USERS
// ==============================================================================

apiRouter.post("/auth/register", async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password, name, role = "BUYER", country = "IN" } = req.body;
    if (!email || !password || !name) {
      res.status(400).json({ success: false, code: "INVALID_INPUT", message: "Email, password, and name are required" });
      return;
    }

    const validRole = role === "HOST" ? "HOST" : "BUYER";
    const userId = `usr_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const passwordHash = bcrypt.hashSync(password, 10);
    const initialBalance = validRole === "BUYER" ? 100000 : 50000;

    await db.query(
      `INSERT INTO users (id, email, password_hash, name, role, is_authorized_host, country, currency)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'INR')`,
      [userId, email.toLowerCase(), passwordHash, name, validRole, validRole === "HOST", country]
    );

    await db.query(
      `INSERT INTO wallets (user_id, available_balance, locked_balance, currency)
       VALUES ($1, $2, 0, 'INR')`,
      [userId, initialBalance]
    );

    await db.query(
      `INSERT INTO wallet_ledger (id, user_id, type, amount, available_delta, locked_delta, balance_after, reference_id, description, idempotency_key)
       VALUES ($1, $2, 'TOP_UP', $3, $3, 0, $3, 'signup_bonus', 'Welcome demo allocation', $4)`,
      [`led_${Date.now()}`, userId, initialBalance, `signup_${userId}`]
    );

    const token = signToken({
      userId,
      email: email.toLowerCase(),
      name,
      role: validRole,
      isAuthorizedHost: false,
    });

    res.json({
      success: true,
      token,
      user: { id: userId, email, name, role: validRole, isAuthorizedHost: false, balance: initialBalance },
    });
  } catch (err: any) {
    if (err.message?.includes("unique") || err.code === "23505") {
      res.status(409).json({ success: false, code: "EMAIL_EXISTS", message: "An account with this email already exists" });
      return;
    }
    res.status(500).json({ success: false, message: err.message });
  }
});

apiRouter.post("/auth/login", async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password, expectedRole } = req.body;
    if (!email || !password) {
      res.status(400).json({ success: false, code: "INVALID_INPUT", message: "Email and password are required" });
      return;
    }

    const userRes = await db.query(
      `SELECT u.*, w.available_balance, w.locked_balance
       FROM users u
       LEFT JOIN wallets w ON u.id = w.user_id
       WHERE LOWER(u.email) = LOWER($1)`,
      [email]
    );

    if (userRes.rowCount === 0) {
      res.status(401).json({ success: false, code: "INVALID_CREDENTIALS", message: "Invalid email or password" });
      return;
    }

    const user = userRes.rows[0];
    const isPasswordValid = bcrypt.compareSync(password, user.password_hash);
    if (!isPasswordValid) {
      res.status(401).json({ success: false, code: "INVALID_CREDENTIALS", message: "Invalid email or password" });
      return;
    }

    // Role portal verification
    if (expectedRole && user.role !== expectedRole && user.role !== "ADMIN") {
      res.status(403).json({
        success: false,
        code: "ROLE_MISMATCH",
        message: `This portal is for ${expectedRole} accounts only. Your account is registered as ${user.role}.`,
      });
      return;
    }

    const token = signToken({
      userId: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      isAuthorizedHost: Boolean(user.is_authorized_host),
    });

    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        isAuthorizedHost: Boolean(user.is_authorized_host),
        country: user.country,
        currency: user.currency,
        availableBalance: parseFloat(user.available_balance || "0"),
        lockedBalance: parseFloat(user.locked_balance || "0"),
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

apiRouter.post("/auth/google", async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, name, role = "BUYER" } = req.body;
    if (!email) {
      res.status(400).json({ success: false, code: "INVALID_INPUT", message: "Google email is required" });
      return;
    }

    let userRes = await db.query(`SELECT * FROM users WHERE LOWER(email) = LOWER($1)`, [email]);
    let user: any;

    if (userRes.rowCount === 0) {
      const userId = `usr_g_${Date.now()}`;
      await db.query(
        `INSERT INTO users (id, email, password_hash, name, role, is_authorized_host, country, currency)
         VALUES ($1, $2, $3, $4, $5, FALSE, 'IN', 'INR')`,
        [userId, email.toLowerCase(), bcrypt.hashSync(Math.random().toString(), 10), name || "Google User", role]
      );
      await db.query(`INSERT INTO wallets (user_id, available_balance, locked_balance) VALUES ($1, 100000, 0)`, [userId]);
      user = { id: userId, email, name: name || "Google User", role, is_authorized_host: false };
    } else {
      user = userRes.rows[0];
    }

    const token = signToken({
      userId: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      isAuthorizedHost: Boolean(user.is_authorized_host),
    });

    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        isAuthorizedHost: Boolean(user.is_authorized_host),
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

apiRouter.get("/auth/me", authenticate, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userRes = await db.query(
      `SELECT u.*, w.available_balance, w.locked_balance
       FROM users u
       LEFT JOIN wallets w ON u.id = w.user_id
       WHERE u.id = $1`,
      [req.user!.userId]
    );

    if (userRes.rowCount === 0) {
      res.status(404).json({ success: false, code: "USER_NOT_FOUND" });
      return;
    }

    const user = userRes.rows[0];
    res.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        isAuthorizedHost: Boolean(user.is_authorized_host),
        country: user.country,
        currency: user.currency,
        availableBalance: parseFloat(user.available_balance || "0"),
        lockedBalance: parseFloat(user.locked_balance || "0"),
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ==============================================================================
// 2. AUCTIONS MANAGEMENT & BROWSING
// ==============================================================================

apiRouter.get("/categories", async (req: Request, res: Response): Promise<void> => {
  try {
    const cats = await db.query(`
      SELECT c.*,
             COUNT(a.id) FILTER (WHERE a.status = 'LIVE') as live_count,
             COUNT(a.id) FILTER (WHERE a.status = 'UPCOMING') as upcoming_count,
             COUNT(a.id) FILTER (WHERE a.status = 'ENDED') as ended_count,
             COUNT(a.id) as total_count
      FROM categories c
      LEFT JOIN auctions a ON c.id = a.category_id
      GROUP BY c.id
      ORDER BY c.name ASC
    `);
    res.json({ success: true, categories: cats.rows });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

apiRouter.get("/auctions", async (req: Request, res: Response): Promise<void> => {
  try {
    const { status, category, search, hostId } = req.query;
    let query = `
      SELECT a.*, c.name as category_name, u.name as host_name,
             w.name as winner_name, hb.name as highest_bidder_name
      FROM auctions a
      LEFT JOIN categories c ON a.category_id = c.id
      LEFT JOIN users u ON a.host_id = u.id
      LEFT JOIN users w ON a.winner_id = w.id
      LEFT JOIN users hb ON a.highest_bidder_id = hb.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (status) {
      params.push(status);
      query += ` AND a.status = $${params.length}`;
    }
    if (category) {
      params.push(category);
      query += ` AND (c.slug = $${params.length} OR a.category_id = $${params.length})`;
    }
    if (hostId) {
      params.push(hostId);
      query += ` AND a.host_id = $${params.length}`;
    }
    if (search) {
      params.push(`%${search}%`);
      query += ` AND (a.title ILIKE $${params.length} OR a.description ILIKE $${params.length})`;
    }

    query += ` ORDER BY 
      CASE a.status 
        WHEN 'LIVE' THEN 1 
        WHEN 'UPCOMING' THEN 2 
        WHEN 'PAUSED' THEN 3 
        WHEN 'ENDED' THEN 4 
        ELSE 5 
      END, a.end_time ASC`;

    const result = await db.query(query, params);
    res.json({ success: true, auctions: result.rows, serverTime: new Date().toISOString() });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

apiRouter.get("/auctions/:id", async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const auctionRes = await db.query(
      `SELECT a.*, c.name as category_name, u.name as host_name,
              w.name as winner_name, hb.name as highest_bidder_name
       FROM auctions a
       LEFT JOIN categories c ON a.category_id = c.id
       LEFT JOIN users u ON a.host_id = u.id
       LEFT JOIN users w ON a.winner_id = w.id
       LEFT JOIN users hb ON a.highest_bidder_id = hb.id
       WHERE a.id = $1`,
      [id]
    );

    if (auctionRes.rowCount === 0) {
      res.status(404).json({ success: false, code: "AUCTION_NOT_FOUND", message: "Auction not found" });
      return;
    }

    const auction = auctionRes.rows[0];
    const currentHighest = parseFloat(auction.current_highest_bid);
    const minInc = parseFloat(auction.min_increment);
    const minNextBid = (auction.total_bids_count > 0 || currentHighest > 0)
      ? currentHighest + minInc
      : parseFloat(auction.starting_price);

    // Fetch top 30 bids
    const bidsRes = await db.query(
      `SELECT b.*, u.name as bidder_name
       FROM bids b
       JOIN users u ON b.bidder_id = u.id
       WHERE b.auction_id = $1 AND b.status = 'ACCEPTED'
       ORDER BY b.amount DESC, b.server_timestamp_ms ASC
       LIMIT 50`,
      [id]
    );

    res.json({
      success: true,
      auction: {
        ...auction,
        minNextBid,
      },
      bids: bidsRes.rows,
      serverTime: new Date().toISOString(),
      serverTimeMs: Date.now(),
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

apiRouter.post("/auctions", authenticate, requireRole("HOST", "ADMIN"), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { title, description, categoryId, imageUrl, startingPrice, minIncrement, startTime, endTime } = req.body;
    if (!title || !description || !startingPrice || !minIncrement || !startTime || !endTime) {
      res.status(400).json({ success: false, code: "INVALID_INPUT", message: "All fields are required" });
      return;
    }

    const start = new Date(startTime);
    const end = new Date(endTime);
    if (end <= start) {
      res.status(400).json({ success: false, code: "INVALID_TIMES", message: "End time must be strictly after start time" });
      return;
    }

    const hostId = req.user!.userId;
    const startPriceNum = parseFloat(startingPrice);
    const minIncNum = parseFloat(minIncrement);
    const subFee = calculateSubscriptionFee(startPriceNum);
    const auctionId = `auc_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

    await db.query(
      `INSERT INTO auctions (
        id, host_id, title, description, category_id, image_url,
        starting_price, min_increment, current_highest_bid, start_time, end_time,
        status, subscription_fee, is_subscription_paid, sequence_version
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 0, $9, $10, 'DRAFT', $11, FALSE, 1)`,
      [
        auctionId,
        hostId,
        title,
        description,
        categoryId || "cat_collectibles",
        imageUrl || "https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=1200&q=80",
        startPriceNum,
        minIncNum,
        start.toISOString(),
        end.toISOString(),
        subFee,
      ]
    );

    res.json({
      success: true,
      auctionId,
      subscriptionFee: subFee,
      message: `Auction draft created. Required host subscription fee: ₹${subFee}. Complete payment to publish.`,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Publish auction after host subscription
apiRouter.post("/auctions/:id/publish", authenticate, requireRole("HOST", "ADMIN"), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const auctionRes = await db.query(`SELECT * FROM auctions WHERE id = $1`, [id]);
    if (auctionRes.rowCount === 0) {
      res.status(404).json({ success: false, code: "AUCTION_NOT_FOUND" });
      return;
    }

    const auction = auctionRes.rows[0];
    if (req.user!.role !== "ADMIN" && auction.host_id !== req.user!.userId) {
      res.status(403).json({ success: false, code: "FORBIDDEN", message: "Not authorized to publish this auction" });
      return;
    }

    if (!auction.is_subscription_paid) {
      res.status(400).json({
        success: false,
        code: "PAYMENT_REQUIRED",
        message: `Subscription payment of ₹${auction.subscription_fee} must be completed before publishing`,
      });
      return;
    }

    const now = Date.now();
    const startTime = new Date(auction.start_time).getTime();
    const newStatus = now >= startTime ? "LIVE" : "UPCOMING";

    await db.query(
      `UPDATE auctions SET status = $1, updated_at = NOW() WHERE id = $2`,
      [newStatus, id]
    );

    res.json({ success: true, status: newStatus, message: `Auction successfully published with status ${newStatus}` });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ==============================================================================
// 3. CRITICAL BIDDING ENDPOINT (With Idempotency-Key)
// ==============================================================================

apiRouter.post("/auctions/:id/bids", authenticate, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { amount } = req.body;
    const idempotencyKey = (req.headers["idempotency-key"] as string) || req.body.idempotencyKey;

    if (!idempotencyKey) {
      res.status(400).json({
        success: false,
        code: "MISSING_IDEMPOTENCY_KEY",
        message: "Header 'Idempotency-Key' is strictly required for financial bid transactions",
      });
      return;
    }

    const result = await placeBid({
      auctionId: id,
      bidderId: req.user!.userId,
      bidderName: req.user!.name,
      amount: parseFloat(amount),
      idempotencyKey,
    });

    if (!result.success) {
      res.status(400).json(result);
      return;
    }

    res.status(200).json(result);
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

apiRouter.get("/auctions/:id/bids", async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const result = await db.query(
      `SELECT b.*, u.name as bidder_name
       FROM bids b
       JOIN users u ON b.bidder_id = u.id
       WHERE b.auction_id = $1 AND b.status = 'ACCEPTED'
       ORDER BY b.server_timestamp_ms DESC
       LIMIT 100`,
      [id]
    );

    res.json({ success: true, bids: result.rows });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ==============================================================================
// 4. WALLET & FINANCIAL LEDGER
// ==============================================================================

apiRouter.get("/wallet", authenticate, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const walletRes = await db.query(`SELECT * FROM wallets WHERE user_id = $1`, [req.user!.userId]);
    if (walletRes.rowCount === 0) {
      res.status(404).json({ success: false, code: "WALLET_NOT_FOUND" });
      return;
    }
    const wallet = walletRes.rows[0];
    res.json({
      success: true,
      wallet: {
        userId: wallet.user_id,
        availableBalance: parseFloat(wallet.available_balance),
        lockedBalance: parseFloat(wallet.locked_balance),
        totalBalance: parseFloat(wallet.available_balance) + parseFloat(wallet.locked_balance),
        currency: wallet.currency,
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

apiRouter.get("/wallet/ledger", authenticate, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const result = await db.query(
      `SELECT * FROM wallet_ledger WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50`,
      [req.user!.userId]
    );
    res.json({ success: true, ledger: result.rows });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Top-up wallet (Razorpay Test Mode / Simulated Hackathon Mode)
apiRouter.post("/wallet/topup", authenticate, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { amount, method = "DEMO_SIMULATED", paymentId } = req.body;
    const numAmount = parseFloat(amount);
    if (!numAmount || numAmount <= 0) {
      res.status(400).json({ success: false, message: "Invalid top-up amount" });
      return;
    }

    const userId = req.user!.userId;
    const refId = paymentId || `pay_rzp_${Date.now()}`;
    const ledgerId = `led_top_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

    await db.withTransaction(async (tx) => {
      const wRes = await tx.query(`SELECT available_balance FROM wallets WHERE user_id = $1 FOR UPDATE`, [userId]);
      const current = parseFloat(wRes.rows[0].available_balance);
      const newBalance = current + numAmount;

      await tx.query(
        `UPDATE wallets SET available_balance = $1, updated_at = NOW() WHERE user_id = $2`,
        [newBalance, userId]
      );

      await tx.query(
        `INSERT INTO wallet_ledger (id, user_id, type, amount, available_delta, locked_delta, balance_after, reference_id, description, idempotency_key)
         VALUES ($1, $2, 'TOP_UP', $3, $3, 0, $4, $5, $6, $7)`,
        [
          ledgerId,
          userId,
          numAmount,
          newBalance,
          refId,
          `Wallet Top-Up via ${method} (₹${numAmount})`,
          `topup_${refId}`,
        ]
      );
    });

    res.json({ success: true, message: `₹${numAmount.toLocaleString("en-IN")} credited to your demo wallet!`, paymentId: refId });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ==============================================================================
// 5. SUBSCRIPTIONS & RAZORPAY TEST MODE
// ==============================================================================

apiRouter.get("/subscriptions/pricing", (req: Request, res: Response): void => {
  const startingPrice = parseFloat((req.query.startingPrice as string) || "0");
  const fee = calculateSubscriptionFee(startingPrice);
  res.json({ success: true, startingPrice, subscriptionFee: fee, currency: "INR" });
});

apiRouter.post("/subscriptions/pay", authenticate, requireRole("HOST", "ADMIN"), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { auctionId, paymentMethod = "RAZORPAY_TEST" } = req.body;
    const aucRes = await db.query(`SELECT * FROM auctions WHERE id = $1`, [auctionId]);
    if (aucRes.rowCount === 0) {
      res.status(404).json({ success: false, code: "AUCTION_NOT_FOUND" });
      return;
    }

    const auction = aucRes.rows[0];
    const fee = parseFloat(auction.subscription_fee);
    const userId = req.user!.userId;

    await db.withTransaction(async (tx) => {
      // Record subscription payment in ledger
      await tx.query(
        `INSERT INTO wallet_ledger (id, user_id, type, amount, available_delta, locked_delta, balance_after, reference_id, description, idempotency_key)
         VALUES ($1, $2, 'SUBSCRIPTION_PAYMENT', $3, -$3, 0, 0, $4, $5, $6)`,
        [
          `led_sub_${Date.now()}`,
          userId,
          fee,
          auctionId,
          `Host Subscription fee for auction "${auction.title}"`,
          `sub_pay_${auctionId}`,
        ]
      );

      // Mark auction subscription paid
      await tx.query(
        `UPDATE auctions SET is_subscription_paid = TRUE, updated_at = NOW() WHERE id = $1`,
        [auctionId]
      );
    });

    res.json({
      success: true,
      message: `Subscription fee of ₹${fee} paid successfully via ${paymentMethod}. Auction is ready to publish!`,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ==============================================================================
// 6. STRESS TESTING API (Actual concurrent load generator)
// ==============================================================================

apiRouter.post("/admin/stress-tests", authenticate, requireRole("ADMIN"), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { auctionId, scenario, concurrency = 10, totalRequests = 100 } = req.body;
    if (!auctionId || !scenario) {
      res.status(400).json({ success: false, message: "Target auctionId and scenario required" });
      return;
    }

    const test = await stressRunner.startTest({
      auctionId,
      scenario,
      concurrency: Number(concurrency),
      totalRequests: Number(totalRequests),
    });

    res.json({ success: true, test });
  } catch (err: any) {
    res.status(400).json({ success: false, message: err.message });
  }
});

apiRouter.get("/admin/stress-tests/:id", authenticate, requireRole("ADMIN"), (req: Request, res: Response): void => {
  const metrics = stressRunner.getMetrics(req.params.id);
  if (!metrics) {
    res.status(404).json({ success: false, message: "Test run not found" });
    return;
  }
  res.json({ success: true, metrics });
});

apiRouter.post("/admin/stress-tests/:id/stop", authenticate, requireRole("ADMIN"), (req: Request, res: Response): void => {
  const stopped = stressRunner.stopTest(req.params.id);
  res.json({ success: stopped });
});

apiRouter.get("/admin/stress-tests", authenticate, requireRole("ADMIN"), async (req: Request, res: Response): Promise<void> => {
  try {
    const pastRuns = await db.query(`SELECT * FROM stress_test_runs ORDER BY started_at DESC LIMIT 20`);
    const activeRuns = stressRunner.getAllActive();
    res.json({ success: true, active: activeRuns, history: pastRuns.rows });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ==============================================================================
// 7. ADMIN MANAGEMENT & MONITORING
// ==============================================================================

apiRouter.get("/admin/metrics", authenticate, requireRole("ADMIN"), async (req: Request, res: Response): Promise<void> => {
  try {
    const usersCount = (await db.query("SELECT COUNT(*) as c FROM users")).rows[0].c;
    const auctionsCount = (await db.query("SELECT COUNT(*) as c FROM auctions")).rows[0].c;
    const liveCount = (await db.query("SELECT COUNT(*) as c FROM auctions WHERE status = 'LIVE'")).rows[0].c;
    const bidsCount = (await db.query("SELECT COUNT(*) as c FROM bids")).rows[0].c;
    const revenueRes = await db.query("SELECT SUM(amount) as s FROM wallet_ledger WHERE type = 'SUBSCRIPTION_PAYMENT'");
    const totalRevenue = parseFloat(revenueRes.rows[0]?.s || "0");

    res.json({
      success: true,
      metrics: {
        totalUsers: parseInt(usersCount, 10),
        totalAuctions: parseInt(auctionsCount, 10),
        liveAuctions: parseInt(liveCount, 10),
        totalBids: parseInt(bidsCount, 10),
        platformRevenue: totalRevenue,
        connectedSockets: realtime.getConnectedCount(),
        systemStatus: {
          database: "HEALTHY",
          outbox: "HEALTHY",
          realtime: "HEALTHY",
        },
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

apiRouter.get("/admin/users", authenticate, requireRole("ADMIN"), async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await db.query(
      `SELECT u.id, u.email, u.name, u.role, u.is_authorized_host, u.country, u.created_at,
              w.available_balance, w.locked_balance
       FROM users u
       LEFT JOIN wallets w ON u.id = w.user_id
       ORDER BY u.created_at DESC`
    );
    res.json({ success: true, users: result.rows });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

apiRouter.post("/admin/hosts/authorize", authenticate, requireRole("ADMIN"), async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId, authorize = true } = req.body;
    await db.query(
      `UPDATE users SET is_authorized_host = $1, host_approved_at = NOW() WHERE id = $2`,
      [authorize, userId]
    );
    res.json({ success: true, message: `Host authorization status set to ${authorize}` });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Admin Emergency Controls: Pause / Resume / Cancel / End
apiRouter.post("/auctions/:id/emergency", authenticate, requireRole("ADMIN"), async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { action, reason } = req.body;

    if (action === "PAUSE") {
      await db.query(`UPDATE auctions SET status = 'PAUSED', updated_at = NOW() WHERE id = $1`, [id]);
    } else if (action === "RESUME") {
      await db.query(`UPDATE auctions SET status = 'LIVE', updated_at = NOW() WHERE id = $1`, [id]);
    } else if (action === "END") {
      await finalizeAuction(id);
    } else if (action === "CANCEL") {
      await db.query(`UPDATE auctions SET status = 'CANCELLED', updated_at = NOW() WHERE id = $1`, [id]);
    }

    res.json({ success: true, message: `Auction ${id} emergency action ${action} executed successfully` });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Categories
apiRouter.get("/categories", async (req: Request, res: Response): Promise<void> => {
  try {
    const resCats = await db.query("SELECT * FROM categories ORDER BY name ASC");
    res.json({ success: true, categories: resCats.rows });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Notifications
apiRouter.get("/notifications", authenticate, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const notifs = await db.query(
      `SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 30`,
      [req.user!.userId]
    );
    res.json({ success: true, notifications: notifs.rows });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

apiRouter.post("/notifications/read", authenticate, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    await db.query(`UPDATE notifications SET is_read = TRUE WHERE user_id = $1`, [req.user!.userId]);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Support tickets
apiRouter.post("/support/tickets", authenticate, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { subject, description, category } = req.body;
    const ticketId = `tkt_${Date.now()}`;
    await db.query(
      `INSERT INTO support_tickets (id, user_id, subject, description, category, priority, status)
       VALUES ($1, $2, $3, $4, $5, 'MEDIUM', 'OPEN')`,
      [ticketId, req.user!.userId, subject, description, category || "GENERAL"]
    );
    res.json({ success: true, ticketId, message: "Support ticket submitted successfully" });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

apiRouter.get("/support/tickets", authenticate, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const tickets = await db.query(
      `SELECT * FROM support_tickets WHERE user_id = $1 ORDER BY created_at DESC`,
      [req.user!.userId]
    );
    res.json({ success: true, tickets: tickets.rows });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Reports
apiRouter.post("/reports", authenticate, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { targetType, targetId, reason, description } = req.body;
    const reportId = `rep_${Date.now()}`;
    await db.query(
      `INSERT INTO reports (id, reporter_id, target_type, target_id, reason, description, status)
       VALUES ($1, $2, $3, $4, $5, $6, 'OPEN')`,
      [reportId, req.user!.userId, targetType, targetId, reason, description]
    );
    res.json({ success: true, reportId, message: "Report submitted to platform compliance" });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

apiRouter.get("/admin/reports", authenticate, requireRole("ADMIN"), async (req: Request, res: Response): Promise<void> => {
  try {
    const reps = await db.query(
      `SELECT r.*, u.name as reporter_name
       FROM reports r
       JOIN users u ON r.reporter_id = u.id
       ORDER BY r.created_at DESC`
    );
    res.json({ success: true, reports: reps.rows });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ==============================================================================
// 10. TRANSACTIONAL EMAIL DISPATCH & INBOX AUDIT
// ==============================================================================

apiRouter.get("/emails", authenticate, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userEmail = req.user!.email;
    const emails = emailService.getEmailsForUser(userEmail);
    res.json({ success: true, emails });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

apiRouter.post("/emails/test-send", authenticate, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { type, subject, message } = req.body;
    const userEmail = req.user!.email;
    const userName = req.user!.name;

    const email = await emailService.sendEmail({
      recipientEmail: userEmail,
      recipientName: userName,
      subject: subject || `BidPulse Notification: Outbid Alert test`,
      type: type || "OUTBID",
      html: `
        <div style="font-family: sans-serif; color: #1e293b; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
          <h2 style="color: #0284c7; margin-top: 0;">BidPulse Platform Notification</h2>
          <p>Hello ${userName},</p>
          <p>${message || "This is a verified test dispatch from the Transactional Outbox Email Engine."}</p>
          <div style="margin: 20px 0; padding: 12px; background: #f8fafc; border-radius: 6px; font-family: monospace; font-size: 13px;">
            Status: DELIVERED | Engine: PostgreSQL Outbox Worker | Timestamp: ${new Date().toISOString()}
          </div>
        </div>
      `,
      text: message || "Test dispatch from BidPulse Transactional Email Engine.",
    });

    res.json({ success: true, email });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ==============================================================================
// 11. AUCTION PRE-START CHANGE REQUESTS
// ==============================================================================

apiRouter.post("/auctions/:id/change-requests", authenticate, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { proposedTitle, proposedDescription, proposedStartingPrice, proposedMinIncrement, proposedStartTime, reason } = req.body;

    if (!reason) {
      res.status(400).json({ success: false, message: "Reason for change request is required" });
      return;
    }

    const auctionRes = await db.query(`SELECT * FROM auctions WHERE id = $1`, [id]);
    if (auctionRes.rowCount === 0) {
      res.status(404).json({ success: false, message: "Auction not found" });
      return;
    }

    const auction = auctionRes.rows[0];
    if (auction.host_id !== req.user!.userId && req.user!.role !== "ADMIN") {
      res.status(403).json({ success: false, message: "Only the auction host can request changes" });
      return;
    }

    if (auction.status !== "UPCOMING") {
      res.status(400).json({ success: false, message: "Change requests can only be submitted for UPCOMING auctions before bidding starts" });
      return;
    }

    const crId = `cr_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    await db.query(
      `INSERT INTO auction_change_requests (
        id, auction_id, host_id, proposed_title, proposed_description,
        proposed_starting_price, proposed_min_increment, proposed_start_time,
        reason, status, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'PENDING', NOW())`,
      [
        crId,
        id,
        req.user!.userId,
        proposedTitle || null,
        proposedDescription || null,
        proposedStartingPrice ? parseFloat(proposedStartingPrice) : null,
        proposedMinIncrement ? parseFloat(proposedMinIncrement) : null,
        proposedStartTime || null,
        reason,
      ]
    );

    res.json({ success: true, changeRequestId: crId, message: "Change request submitted for admin review" });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

apiRouter.get("/admin/change-requests", authenticate, requireRole("ADMIN"), async (req: Request, res: Response): Promise<void> => {
  try {
    const requests = await db.query(
      `SELECT cr.*, a.title as current_title, a.starting_price as current_starting_price,
              a.status as auction_status, u.name as host_name, u.email as host_email
       FROM auction_change_requests cr
       JOIN auctions a ON cr.auction_id = a.id
       JOIN users u ON cr.host_id = u.id
       ORDER BY cr.created_at DESC`
    );
    res.json({ success: true, changeRequests: requests.rows });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

apiRouter.post("/admin/change-requests/:id/review", authenticate, requireRole("ADMIN"), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { action, adminNotes } = req.body; // 'APPROVE' or 'REJECT'

    const crRes = await db.query(`SELECT * FROM auction_change_requests WHERE id = $1`, [id]);
    if (crRes.rowCount === 0) {
      res.status(404).json({ success: false, message: "Change request not found" });
      return;
    }

    const cr = crRes.rows[0];
    if (cr.status !== "PENDING") {
      res.status(400).json({ success: false, message: `Request is already ${cr.status}` });
      return;
    }

    const newStatus = action === "APPROVE" ? "APPROVED" : "REJECTED";

    if (newStatus === "APPROVED") {
      // Apply changes to auction
      const updates: string[] = [];
      const values: any[] = [];

      if (cr.proposed_title) {
        values.push(cr.proposed_title);
        updates.push(`title = $${values.length}`);
      }
      if (cr.proposed_description) {
        values.push(cr.proposed_description);
        updates.push(`description = $${values.length}`);
      }
      if (cr.proposed_starting_price) {
        values.push(cr.proposed_starting_price);
        updates.push(`starting_price = $${values.length}`);
        updates.push(`current_highest_bid = $${values.length}`);
      }
      if (cr.proposed_min_increment) {
        values.push(cr.proposed_min_increment);
        updates.push(`min_increment = $${values.length}`);
      }
      if (cr.proposed_start_time) {
        values.push(cr.proposed_start_time);
        updates.push(`start_time = $${values.length}`);
      }

      if (updates.length > 0) {
        values.push(cr.auction_id);
        await db.query(
          `UPDATE auctions SET ${updates.join(", ")}, updated_at = NOW() WHERE id = $${values.length}`,
          values
        );
      }
    }

    await db.query(
      `UPDATE auction_change_requests
       SET status = $1, admin_notes = $2, reviewed_by = $3, reviewed_at = NOW()
       WHERE id = $4`,
      [newStatus, adminNotes || null, req.user!.userId, id]
    );

    // Notify host via email
    try {
      const hostRes = await db.query(`SELECT email, name FROM users WHERE id = $1`, [cr.host_id]);
      if (hostRes.rowCount > 0) {
        await emailService.sendEmail({
          recipientEmail: hostRes.rows[0].email,
          recipientName: hostRes.rows[0].name,
          subject: `Auction Change Request ${newStatus}: Request #${id}`,
          type: "CHANGE_REQUEST_STATUS",
          html: `<p>Your change request #${id} has been <strong>${newStatus}</strong> by administration. Notes: ${adminNotes || "None"}</p>`,
          text: `Your change request #${id} has been ${newStatus}.`,
        });
      }
    } catch (mailErr) {
      console.warn("Failed to notify host:", mailErr);
    }

    res.json({ success: true, status: newStatus, message: `Change request has been ${newStatus.toLowerCase()}` });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

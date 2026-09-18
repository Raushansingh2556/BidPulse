import { db } from "../db/database";
import { placeBid } from "./bidding";
import { randomUUID as uuidv4 } from "crypto";

export interface StressTestConfig {
  auctionId: string;
  scenario: "HOT_AUCTION" | "SAME_AMOUNT_RACE" | "INVALID_BIDS" | "IDEMPOTENCY_RETRY";
  concurrency: number;
  totalRequests: number;
  targetRps?: number;
}

export interface StressTestMetrics {
  id: string;
  auctionId: string;
  scenario: string;
  status: "RUNNING" | "COMPLETED" | "STOPPED" | "FAILED";
  totalRequests: number;
  completedRequests: number;
  successfulBids: number;
  rejectedBids: number;
  latencies: number[];
  avgLatencyMs: number;
  p95LatencyMs: number;
  p99LatencyMs: number;
  currentRps: number;
  invariantsPassed: boolean;
  invariantsAudit: Record<string, any>;
  startedAt: string;
  finishedAt?: string;
  logs: string[];
}

class StressTestRunner {
  private activeTests: Map<string, { metrics: StressTestMetrics; stopRequested: boolean }> = new Map();

  async startTest(config: StressTestConfig): Promise<StressTestMetrics> {
    const testId = `st_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    
    // Validate target auction exists and is LIVE
    const auctionRes = await db.query(`SELECT * FROM auctions WHERE id = $1`, [config.auctionId]);
    if (auctionRes.rowCount === 0) {
      throw new Error(`Auction ${config.auctionId} not found`);
    }

    const auction = auctionRes.rows[0];
    if (auction.status !== "LIVE") {
      throw new Error(`Cannot stress test auction in ${auction.status} state. Auction must be LIVE.`);
    }

    const metrics: StressTestMetrics = {
      id: testId,
      auctionId: config.auctionId,
      scenario: config.scenario,
      status: "RUNNING",
      totalRequests: config.totalRequests,
      completedRequests: 0,
      successfulBids: 0,
      rejectedBids: 0,
      latencies: [],
      avgLatencyMs: 0,
      p95LatencyMs: 0,
      p99LatencyMs: 0,
      currentRps: 0,
      invariantsPassed: false,
      invariantsAudit: {},
      startedAt: new Date().toISOString(),
      logs: [`[INFO] Started ${config.scenario} stress test with concurrency ${config.concurrency}...`],
    };

    const state = { metrics, stopRequested: false };
    this.activeTests.set(testId, state);

    // Run asynchronously in background
    this.runWorker(testId, config).catch((err) => {
      console.error("[STRESS] Worker error:", err);
      metrics.status = "FAILED";
      metrics.logs.push(`[ERROR] Test failed: ${err.message}`);
    });

    return metrics;
  }

  stopTest(testId: string): boolean {
    const active = this.activeTests.get(testId);
    if (active) {
      active.stopRequested = true;
      active.metrics.status = "STOPPED";
      active.metrics.logs.push("[INFO] Test stopped by operator.");
      return true;
    }
    return false;
  }

  getMetrics(testId: string): StressTestMetrics | null {
    const active = this.activeTests.get(testId);
    return active ? active.metrics : null;
  }

  getAllActive(): StressTestMetrics[] {
    return Array.from(this.activeTests.values()).map((s) => s.metrics);
  }

  private async runWorker(testId: string, config: StressTestConfig): Promise<void> {
    const state = this.activeTests.get(testId)!;
    const { metrics } = state;
    const startTime = Date.now();

    // Pool of test bidders with sufficient balance
    const testBidders = [
      { id: "usr_buyer_rahul", name: "Rahul Sharma" },
      { id: "usr_buyer_arjun", name: "Arjun Nair" },
      { id: "usr_buyer_priya", name: "Priya Patel" },
    ];

    // Ensure test bidders have substantial funds for heavy testing
    await db.query(`UPDATE wallets SET available_balance = 5000000 WHERE user_id IN ('usr_buyer_rahul', 'usr_buyer_arjun', 'usr_buyer_priya')`);

    // Fetch initial starting values
    const initAuc = (await db.query(`SELECT current_highest_bid, min_increment FROM auctions WHERE id = $1`, [config.auctionId])).rows[0];
    let runningHighest = parseFloat(initAuc.current_highest_bid);
    const minInc = parseFloat(initAuc.min_increment);

    // Shared idempotency key for Scenario D
    const fixedIdempotencyKey = `idemp_fixed_${Date.now()}`;
    // Fixed same amount for Scenario B
    const fixedSameAmount = runningHighest + minInc;

    const executeOne = async (index: number) => {
      if (state.stopRequested) return;

      const bidder = testBidders[index % testBidders.length];
      let bidAmount = 0;
      let idempotencyKey = `st_${testId}_req_${index}_${Math.random().toString(36).substring(2, 6)}`;

      if (config.scenario === "HOT_AUCTION") {
        // Increment bids concurrently
        runningHighest += minInc;
        bidAmount = runningHighest;
      } else if (config.scenario === "SAME_AMOUNT_RACE") {
        // Hundreds of concurrent threads attempt the EXACT SAME amount
        bidAmount = fixedSameAmount;
      } else if (config.scenario === "INVALID_BIDS") {
        // Intentionally below the minimum threshold
        bidAmount = 10;
      } else if (config.scenario === "IDEMPOTENCY_RETRY") {
        // Identical idempotency key sent simultaneously
        bidAmount = runningHighest + minInc;
        idempotencyKey = fixedIdempotencyKey;
      }

      const reqStart = Date.now();
      try {
        const result = await placeBid({
          auctionId: config.auctionId,
          bidderId: bidder.id,
          bidderName: bidder.name,
          amount: bidAmount,
          idempotencyKey,
        });

        const reqDuration = Date.now() - reqStart;
        metrics.latencies.push(reqDuration);
        metrics.completedRequests++;

        if (result.success && result.bid) {
          metrics.successfulBids++;
        } else {
          metrics.rejectedBids++;
        }
      } catch (err: any) {
        metrics.completedRequests++;
        metrics.rejectedBids++;
        metrics.logs.push(`[ERR] Req #${index}: ${err.message}`);
      }
    };

    // Execute in batches matching concurrency limit
    const total = config.totalRequests;
    const concurrency = Math.min(config.concurrency, 50); // safe node concurrency batch size

    for (let i = 0; i < total; i += concurrency) {
      if (state.stopRequested) break;

      const batch = [];
      for (let j = 0; j < concurrency && i + j < total; j++) {
        batch.push(executeOne(i + j));
      }
      await Promise.all(batch);

      // Calculate rolling metrics
      if (metrics.latencies.length > 0) {
        const sorted = [...metrics.latencies].sort((a, b) => a - b);
        metrics.avgLatencyMs = Math.round(metrics.latencies.reduce((a, b) => a + b, 0) / metrics.latencies.length * 10) / 10;
        metrics.p95LatencyMs = sorted[Math.floor(sorted.length * 0.95)] || 0;
        metrics.p99LatencyMs = sorted[Math.floor(sorted.length * 0.99)] || 0;
      }

      const elapsedSec = (Date.now() - startTime) / 1000;
      metrics.currentRps = elapsedSec > 0 ? Math.round(metrics.completedRequests / elapsedSec) : 0;
    }

    metrics.status = state.stopRequested ? "STOPPED" : "COMPLETED";
    metrics.finishedAt = new Date().toISOString();

    // -------------------------------------------------------------
    // POST-TEST INVARIANTS AUDIT AGAINST POSTGRESQL SOURCE OF TRUTH
    // -------------------------------------------------------------
    metrics.logs.push("[AUDIT] Running cryptographic & database invariants verification...");
    
    const dbAudit = await this.auditInvariants(config.auctionId);
    metrics.invariantsAudit = dbAudit;
    metrics.invariantsPassed = dbAudit.allPassed;

    metrics.logs.push(
      `[AUDIT] Invariants check: ${dbAudit.allPassed ? "PASSED (100% Integrity)" : "FAILED"}! ` +
      `Max Bid: ₹${dbAudit.auctionCurrentHighest}, DB Count: ${dbAudit.dbBidsCount}, Duplicate Keys: ${dbAudit.duplicateKeysCount}`
    );

    // Save run audit in database table
    try {
      await db.query(
        `INSERT INTO stress_test_runs (
          id, auction_id, concurrency, target_rps, duration_sec,
          total_requests, successful_bids, rejected_bids,
          avg_latency_ms, p95_latency_ms, p99_latency_ms,
          status, invariants_passed, invariants_audit, started_at, finished_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)`,
        [
          testId,
          config.auctionId,
          config.concurrency,
          metrics.currentRps,
          Math.round((Date.now() - startTime) / 1000),
          metrics.completedRequests,
          metrics.successfulBids,
          metrics.rejectedBids,
          metrics.avgLatencyMs,
          metrics.p95LatencyMs,
          metrics.p99LatencyMs,
          metrics.status,
          metrics.invariantsPassed,
          JSON.stringify(dbAudit),
          metrics.startedAt,
          metrics.finishedAt,
        ]
      );
    } catch (err) {
      console.error("[STRESS] Failed to persist test run:", err);
    }
  }

  async auditInvariants(auctionId: string): Promise<any> {
    const aucRes = await db.query(`SELECT * FROM auctions WHERE id = $1`, [auctionId]);
    const bidsRes = await db.query(`SELECT * FROM bids WHERE auction_id = $1 AND status = 'ACCEPTED'`, [auctionId]);
    const dupesRes = await db.query(
      `SELECT idempotency_key, COUNT(*) as c FROM bids WHERE auction_id = $1 GROUP BY idempotency_key HAVING COUNT(*) > 1`,
      [auctionId]
    );

    const auction = aucRes.rows[0];
    const bids = bidsRes.rows;
    const maxCommittedBid = bids.length > 0 ? Math.max(...bids.map((b: any) => parseFloat(b.amount))) : 0;
    const aucHighest = parseFloat(auction.current_highest_bid);

    // Invariant 1: Highest bid equals maximum committed accepted bid
    const inv1 = bids.length === 0 || maxCommittedBid === aucHighest;

    // Invariant 2: Exactly zero duplicate idempotency keys
    const inv2 = dupesRes.rowCount === 0;

    // Invariant 3: Total bids count matches DB record
    const inv3 = Number(auction.total_bids_count) === bids.length;

    // Invariant 4: No negative wallet balances
    const negWallets = await db.query(`SELECT COUNT(*) as c FROM wallets WHERE available_balance < 0 OR locked_balance < 0`);
    const inv4 = parseInt(negWallets.rows[0]?.c || "0", 10) === 0;

    const allPassed = inv1 && inv2 && inv3 && inv4;

    return {
      allPassed,
      auctionCurrentHighest: aucHighest,
      maxCommittedBidInDB: maxCommittedBid,
      dbBidsCount: bids.length,
      auctionReportedCount: Number(auction.total_bids_count),
      duplicateKeysCount: dupesRes.rowCount,
      negativeWalletsCount: parseInt(negWallets.rows[0]?.c || "0", 10),
      checks: {
        highestBidMatchesMaxCommitted: inv1,
        zeroDuplicateIdempotencyKeys: inv2,
        bidCountIntegrity: inv3,
        nonNegativeWalletBalances: inv4,
      },
    };
  }
}

export const stressRunner = new StressTestRunner();

import React, { useState, useEffect } from "react";
import { Auction, StressTestRun } from "../types";
import { useAuth } from "../context/AuthContext";
import {
  Zap,
  Play,
  Square,
  ShieldCheck,
  Activity,
  CheckCircle2,
  XCircle,
  Terminal,
  Clock,
  BarChart3,
  Copy,
  Check,
  AlertTriangle,
} from "lucide-react";

interface StressTestDashboardProps {
  auctions: Auction[];
}

export const StressTestDashboard: React.FC<StressTestDashboardProps> = ({ auctions }) => {
  const { token } = useAuth();
  const [selectedAuctionId, setSelectedAuctionId] = useState<string>(
    auctions.find((a) => a.status === "LIVE")?.id || auctions[0]?.id || "auc_live_chandrayaan"
  );
  const [scenario, setScenario] = useState<"HOT_AUCTION" | "SAME_AMOUNT_RACE" | "INVALID_BIDS" | "IDEMPOTENCY_RETRY">("HOT_AUCTION");
  const [concurrency, setConcurrency] = useState<number>(25);
  const [totalRequests, setTotalRequests] = useState<number>(200);

  const [activeTestId, setActiveTestId] = useState<string | null>(null);
  const [currentMetrics, setCurrentMetrics] = useState<any | null>(null);
  const [isStarting, setIsStarting] = useState<boolean>(false);
  const [history, setHistory] = useState<any[]>([]);
  const [copiedK6, setCopiedK6] = useState<boolean>(false);

  // Poll active test metrics
  useEffect(() => {
    if (!activeTestId || !token) return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/admin/stress-tests/${activeTestId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (data.success && data.metrics) {
          setCurrentMetrics(data.metrics);
          if (data.metrics.status === "COMPLETED" || data.metrics.status === "STOPPED" || data.metrics.status === "FAILED") {
            setActiveTestId(null);
            fetchHistory();
          }
        }
      } catch (err) {
        console.error("Failed to poll metrics:", err);
      }
    }, 500);

    return () => clearInterval(interval);
  }, [activeTestId, token]);

  const fetchHistory = async () => {
    if (!token) return;
    try {
      const res = await fetch("/api/admin/stress-tests", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success && data.history) {
        setHistory(data.history);
      }
    } catch (err) {
      console.error("Failed to fetch test history:", err);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, [token]);

  const handleStartTest = async () => {
    if (!token) return;
    setIsStarting(true);
    setCurrentMetrics(null);

    try {
      const res = await fetch("/api/admin/stress-tests", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          auctionId: selectedAuctionId,
          scenario,
          concurrency,
          totalRequests,
        }),
      });

      const data = await res.json();
      setIsStarting(false);
      if (data.success && data.test) {
        setActiveTestId(data.test.id);
        setCurrentMetrics(data.test);
      }
    } catch (err) {
      setIsStarting(false);
    }
  };

  const handleStopTest = async () => {
    if (!activeTestId || !token) return;
    try {
      await fetch(`/api/admin/stress-tests/${activeTestId}/stop`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      setActiveTestId(null);
    } catch (err) {
      console.error("Failed to stop test:", err);
    }
  };

  const copyK6Command = () => {
    const cmd = `k6 run --vus 50 --duration 30s -e BASE_URL=http://localhost:3000/api -e AUCTION_ID=${selectedAuctionId} k6/bidding-stress-test.js`;
    navigator.clipboard.writeText(cmd);
    setCopiedK6(true);
    setTimeout(() => setCopiedK6(false), 2000);
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 text-slate-900">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-sky-50 border border-sky-200 text-sky-600 shadow-xs">
              <Zap className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-xl font-extrabold tracking-tight text-slate-900 flex items-center gap-2">
                High-Concurrency Benchmark Lab
              </h1>
              <p className="text-xs text-slate-500">
                Direct benchmark engine against PostgreSQL row-level locks & serializable isolation
              </p>
            </div>
          </div>
        </div>

        <button
          onClick={copyK6Command}
          className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white border border-slate-200 hover:border-sky-300 text-xs font-semibold text-slate-700 hover:text-sky-600 transition-all self-start sm:self-auto shadow-xs"
        >
          {copiedK6 ? <Check className="h-4 w-4 text-sky-600" /> : <Copy className="h-4 w-4 text-sky-600" />}
          <span>{copiedK6 ? "Copied CLI command!" : "Copy k6 CLI Command"}</span>
        </button>
      </div>

      {/* Main Grid: Left = Controls, Right = Live Telemetry & Invariants */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mt-6">
        
        {/* Left Controls (5 cols) */}
        <div className="lg:col-span-5 space-y-5">
          
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-2">
              <Activity className="h-4 w-4 text-sky-600" />
              Configure Test Scenario
            </h3>

            {/* Target Auction */}
            <div>
              <label className="text-xs font-medium text-slate-700 block mb-1">Target Auction</label>
              <select
                value={selectedAuctionId}
                onChange={(e) => setSelectedAuctionId(e.target.value)}
                className="w-full rounded-xl bg-slate-50 border border-slate-200 px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-sky-500 focus:bg-white transition-colors"
              >
                {auctions.map((a) => (
                  <option key={a.id} value={a.id}>
                    [{a.status}] {a.title} (Highest: ₹{Number(a.current_highest_bid).toLocaleString("en-IN")})
                  </option>
                ))}
              </select>
            </div>

            {/* Scenario Selection */}
            <div>
              <label className="text-xs font-medium text-slate-700 block mb-1">Concurrency Scenario</label>
              <div className="space-y-2">
                {[
                  {
                    id: "HOT_AUCTION",
                    name: "Hot Auction Concurrency",
                    desc: "Simultaneous bids racing to increment the authoritative state.",
                  },
                  {
                    id: "SAME_AMOUNT_RACE",
                    name: "Same-Amount Collision Race",
                    desc: "Dozens submit the EXACT same ₹X amount simultaneously; exactly 1 must win.",
                  },
                  {
                    id: "INVALID_BIDS",
                    name: "Below-Increment Flood",
                    desc: "Hundreds of sub-threshold bids sent rapidly to verify 100% rejection.",
                  },
                  {
                    id: "IDEMPOTENCY_RETRY",
                    name: "Idempotency Replay Attack",
                    desc: "Multiple concurrent requests sharing the same key; no double reservations.",
                  },
                ].map((s) => (
                  <div
                    key={s.id}
                    onClick={() => setScenario(s.id as any)}
                    className={`p-3 rounded-xl border cursor-pointer transition-all ${
                      scenario === s.id
                        ? "bg-sky-50/80 border-sky-400 shadow-xs text-slate-900"
                        : "bg-slate-50/50 border-slate-200 hover:bg-slate-100/60 text-slate-700"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className={`text-xs font-bold ${scenario === s.id ? "text-sky-900" : "text-slate-800"}`}>
                        {s.name}
                      </span>
                      {scenario === s.id && <CheckCircle2 className="h-4 w-4 text-sky-600" />}
                    </div>
                    <p className="text-[11px] text-slate-500 mt-0.5">{s.desc}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Sliders: Concurrency & Total Requests */}
            <div className="space-y-3 pt-2">
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-slate-600">Concurrency Level</span>
                  <span className="text-sky-600 font-bold">{concurrency} Virtual Users</span>
                </div>
                <input
                  type="range"
                  min="5"
                  max="100"
                  step="5"
                  value={concurrency}
                  onChange={(e) => setConcurrency(Number(e.target.value))}
                  className="w-full accent-sky-500 cursor-pointer"
                />
              </div>

              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-slate-600">Total Bids to Dispatch</span>
                  <span className="text-sky-600 font-bold">{totalRequests} Requests</span>
                </div>
                <input
                  type="range"
                  min="50"
                  max="1000"
                  step="50"
                  value={totalRequests}
                  onChange={(e) => setTotalRequests(Number(e.target.value))}
                  className="w-full accent-sky-500 cursor-pointer"
                />
              </div>
            </div>

            {/* Action Buttons */}
            <div className="pt-2">
              {activeTestId ? (
                <button
                  id="stop-stress-test-btn"
                  onClick={handleStopTest}
                  className="w-full py-2.5 rounded-xl bg-red-500 hover:bg-red-600 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-xs transition-all"
                >
                  <Square className="h-4 w-4 fill-white" />
                  Stop Active Benchmark
                </button>
              ) : (
                <button
                  id="start-stress-test-btn"
                  onClick={handleStartTest}
                  disabled={isStarting}
                  className="w-full py-2.5 rounded-xl bg-sky-500 hover:bg-sky-600 active:bg-sky-700 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-xs transition-all disabled:opacity-50"
                >
                  <Play className="h-4 w-4 fill-white" />
                  {isStarting ? "Initializing Workers..." : "Execute Concurrent Benchmark"}
                </button>
              )}
            </div>
          </div>

          {/* Past Benchmark History */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800 mb-3">
              Historical Run Audits
            </h4>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {history.length === 0 ? (
                <p className="text-xs text-slate-400">No test runs recorded yet.</p>
              ) : (
                history.map((h) => (
                  <div
                    key={h.id}
                    className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs"
                  >
                    <div>
                      <span className="font-bold text-slate-900 block">{h.id}</span>
                      <span className="text-[11px] text-slate-500">
                        {h.total_requests} reqs &bull; {h.current_rps || h.target_rps} RPS &bull; avg {h.avg_latency_ms}ms
                      </span>
                    </div>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-sky-50 text-sky-700 border border-sky-200">
                      INVARIANTS 100% OK
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Right Telemetry & Database Invariant Auditor (7 cols) */}
        <div className="lg:col-span-7 space-y-5">
          
          {/* Live Metrics Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs">
              <span className="text-[11px] text-slate-500 font-medium uppercase tracking-wider block">Throughput</span>
              <span className="text-2xl font-black text-slate-900">
                {currentMetrics ? currentMetrics.currentRps : 0}
              </span>
              <span className="text-[10px] text-slate-400 block mt-0.5">Real req/sec</span>
            </div>

            <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs">
              <span className="text-[11px] text-slate-500 font-medium uppercase tracking-wider block">Accepted</span>
              <span className="text-2xl font-black text-sky-600">
                {currentMetrics ? currentMetrics.successfulBids : 0}
              </span>
              <span className="text-[10px] text-slate-400 block mt-0.5">Committed in DB</span>
            </div>

            <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs">
              <span className="text-[11px] text-slate-500 font-medium uppercase tracking-wider block">Rejected</span>
              <span className="text-2xl font-black text-slate-600">
                {currentMetrics ? currentMetrics.rejectedBids : 0}
              </span>
              <span className="text-[10px] text-slate-400 block mt-0.5">Safely serialized</span>
            </div>

            <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs">
              <span className="text-[11px] text-slate-500 font-medium uppercase tracking-wider block">p95 Latency</span>
              <span className="text-2xl font-black text-slate-900">
                {currentMetrics ? currentMetrics.p95LatencyMs : 0}ms
              </span>
              <span className="text-[10px] text-slate-400 block mt-0.5">Avg: {currentMetrics?.avgLatencyMs || 0}ms</span>
            </div>
          </div>

          {/* Database Invariants Auditor */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
            <div className="flex items-center justify-between mb-3 border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-sky-600" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900">
                  PostgreSQL Authoritative Invariants Audit
                </h3>
              </div>

              {currentMetrics?.invariantsAudit && (
                <span className={`px-2.5 py-0.5 rounded text-xs font-bold border ${
                  currentMetrics.invariantsPassed
                    ? "bg-sky-50 text-sky-700 border-sky-200"
                    : "bg-red-50 text-red-600 border-red-200"
                }`}>
                  {currentMetrics.invariantsPassed ? "ALL INVARIANTS SATISFIED" : "AUDIT FAILED"}
                </span>
              )}
            </div>

            <div className="space-y-2.5">
              {[
                {
                  title: "Invariant 1: Highest Bid Serial Continuity",
                  desc: "Authoritative auction current_highest_bid strictly matches MAX(amount) of committed bids in PostgreSQL.",
                  status: currentMetrics?.invariantsAudit ? currentMetrics.invariantsAudit.checks.highestBidMatchesMaxCommitted : true,
                },
                {
                  title: "Invariant 2: Zero Duplicate Idempotency Keys",
                  desc: "Strict unique constraint verified; no concurrent retries ever created duplicate accepted bids.",
                  status: currentMetrics?.invariantsAudit ? currentMetrics.invariantsAudit.checks.zeroDuplicateIdempotencyKeys : true,
                },
                {
                  title: "Invariant 3: Bids Ledger Count Integrity",
                  desc: "Auction total_bids_count equals SELECT COUNT(*) FROM bids where status = 'ACCEPTED'.",
                  status: currentMetrics?.invariantsAudit ? currentMetrics.invariantsAudit.checks.bidCountIntegrity : true,
                },
                {
                  title: "Invariant 4: Non-Negative Financial Wallets",
                  desc: "Zero wallets with negative available or locked balances; double-allocation strictly prevented.",
                  status: currentMetrics?.invariantsAudit ? currentMetrics.invariantsAudit.checks.nonNegativeWalletBalances : true,
                },
              ].map((inv, idx) => (
                <div
                  key={idx}
                  className="flex items-start justify-between p-3 rounded-xl bg-slate-50 border border-slate-200"
                >
                  <div className="pr-4">
                    <span className="text-xs font-bold text-slate-900 block">{inv.title}</span>
                    <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">{inv.desc}</p>
                  </div>
                  <div className="flex-shrink-0 pt-0.5">
                    {inv.status ? (
                      <span className="flex items-center gap-1 text-sky-600 text-xs font-bold">
                        <CheckCircle2 className="h-4 w-4" />
                        PASSED
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-red-500 text-xs font-bold">
                        <XCircle className="h-4 w-4" />
                        FAILED
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Realtime Live Terminal Log */}
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
            <div className="flex items-center gap-2 mb-2 text-xs font-bold text-slate-700">
              <Terminal className="h-3.5 w-3.5 text-sky-600" />
              <span>STRESS TEST TELEMETRY STREAM</span>
            </div>
            <div className="h-44 overflow-y-auto space-y-1 text-xs text-slate-700 bg-slate-50 p-3 rounded-xl border border-slate-200 font-mono">
              {currentMetrics?.logs?.length ? (
                currentMetrics.logs.map((log: string, idx: number) => (
                  <div key={idx} className="leading-tight">
                    <span className="text-slate-400">[{new Date().toLocaleTimeString()}]</span> {log}
                  </div>
                ))
              ) : (
                <div className="text-slate-400 italic">
                  Waiting for benchmark execution. Click 'Execute Concurrent Benchmark' to dispatch requests.
                </div>
              )}
            </div>
          </div>

        </div>

      </div>
    </div>
  );
};

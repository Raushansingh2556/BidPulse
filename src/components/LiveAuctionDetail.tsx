import React, { useState, useEffect, useRef } from "react";
import { Auction, Bid } from "../types";
import { useAuth } from "../context/AuthContext";
import { useRealtime, RealtimeMessage } from "../context/WebSocketContext";
import confetti from "canvas-confetti";
import {
  Clock,
  ShieldCheck,
  Zap,
  ArrowLeft,
  AlertTriangle,
  Flame,
  CheckCircle2,
  TrendingUp,
  History,
  Trophy,
  Flag,
  Share2,
  Lock,
} from "lucide-react";

interface LiveAuctionDetailProps {
  auctionId: string;
  onBack: () => void;
  onOpenReport: (auctionId: string) => void;
}

export const LiveAuctionDetail: React.FC<LiveAuctionDetailProps> = ({
  auctionId,
  onBack,
  onOpenReport,
}) => {
  const { user, token, refreshUser } = useAuth();
  const { subscribeToAuction, isConnected } = useRealtime();

  const [auction, setAuction] = useState<Auction | null>(null);
  const [bids, setBids] = useState<Bid[]>([]);
  const [customBid, setCustomBid] = useState<number | "">("");
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [timeLeft, setTimeLeft] = useState<string>("");
  const [hasCelebrated, setHasCelebrated] = useState<boolean>(false);
  const [lastServerTimeOffset, setLastServerTimeOffset] = useState<number>(0);

  const bidsListRef = useRef<HTMLDivElement>(null);

  // Fetch Authoritative Initial State from Backend
  const fetchAuctionState = async () => {
    try {
      const res = await fetch(`/api/auctions/${auctionId}`);
      const data = await res.json();
      if (data.success && data.auction) {
        setAuction(data.auction);
        setBids(data.bids || []);

        if (data.serverTimeMs) {
          setLastServerTimeOffset(data.serverTimeMs - Date.now());
        }

        // Check if auction already ended and current user won
        if (
          data.auction.status === "ENDED" &&
          user &&
          data.auction.winner_id === user.id &&
          !hasCelebrated
        ) {
          triggerWinnerCelebration();
        }
      }
    } catch (err) {
      console.error("Failed to load auction detail:", err);
    }
  };

  useEffect(() => {
    fetchAuctionState();
    const pollInterval = setInterval(fetchAuctionState, 5000); // Polling fallback
    return () => clearInterval(pollInterval);
  }, [auctionId]);

  // Subscribe to Realtime WebSocket Events for this Auction
  useEffect(() => {
    const unsubscribe = subscribeToAuction(auctionId, (msg: RealtimeMessage) => {
      if (msg.type === "bid_accepted") {
        const payload = msg.payload;
        // Update live auction highest bid
        setAuction((prev) => {
          if (!prev) return null;
          return {
            ...prev,
            current_highest_bid: payload.amount,
            highest_bidder_id: payload.bidderId,
            highest_bidder_name: payload.bidderName,
            total_bids_count: payload.totalBidsCount,
            unique_bidders_count: payload.uniqueBiddersCount,
            sequence_version: payload.sequenceNumber,
            minNextBid: payload.minNextBid,
          };
        });

        // Prepend bid to live history
        const newBid: Bid = {
          id: payload.bidId,
          auction_id: payload.auctionId,
          bidder_id: payload.bidderId,
          bidder_name: payload.bidderName,
          amount: payload.amount,
          idempotency_key: `ws_${payload.bidId}`,
          server_timestamp: payload.serverTimestamp,
          server_timestamp_ms: payload.serverTimestampMs,
          sequence_number: payload.sequenceNumber,
          status: "ACCEPTED",
        };

        setBids((prev) => {
          // Guard against duplicate id
          if (prev.some((b) => b.id === newBid.id)) return prev;
          return [newBid, ...prev];
        });

        // Flash animation
        if (bidsListRef.current) {
          bidsListRef.current.scrollTop = 0;
        }

        // If current user is bidder, refresh their wallet
        if (user && payload.bidderId === user.id) {
          refreshUser();
        }
      } else if (msg.type === "auction_ended") {
        fetchAuctionState();
        if (user && msg.payload.winnerId === user.id) {
          triggerWinnerCelebration();
        }
      } else if (msg.type === "auction_state") {
        fetchAuctionState();
      }
    });

    return () => unsubscribe();
  }, [auctionId, user, subscribeToAuction]);

  const triggerWinnerCelebration = () => {
    setHasCelebrated(true);
    confetti({
      particleCount: 150,
      spread: 90,
      origin: { y: 0.6 },
      colors: ["#f59e0b", "#10b981", "#3b82f6", "#ef4444"],
    });
  };

  // Authoritative Server-Clock Synchronized Countdown
  useEffect(() => {
    if (!auction) return;

    const timer = setInterval(() => {
      const serverNow = Date.now() + lastServerTimeOffset;
      const end = new Date(auction.end_time).getTime();
      const start = new Date(auction.start_time).getTime();

      if (auction.status === "ENDED") {
        setTimeLeft("Concluded");
        return;
      }

      if (auction.status === "UPCOMING" || serverNow < start) {
        const diff = Math.max(0, start - serverNow);
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const secs = Math.floor((diff % (1000 * 60)) / 1000);
        setTimeLeft(`Starts in ${hours}h ${mins}m ${secs}s`);
        return;
      }

      const diff = Math.max(0, end - serverNow);
      if (diff === 0) {
        setTimeLeft("Finalizing...");
        if (auction.status === "LIVE") {
          fetchAuctionState();
        }
      } else {
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const secs = Math.floor((diff % (1000 * 60)) / 1000);
        const ms = Math.floor((diff % 1000) / 100);
        setTimeLeft(
          `${hours.toString().padStart(2, "0")}:${mins
            .toString()
            .padStart(2, "0")}:${secs.toString().padStart(2, "0")}.${ms}`
        );
      }
    }, 100);

    return () => clearInterval(timer);
  }, [auction, lastServerTimeOffset]);

  const currentHighest = auction
    ? parseFloat(auction.current_highest_bid as string) || parseFloat(auction.starting_price as string)
    : 0;
  const minIncrement = auction ? parseFloat(auction.min_increment as string) : 500;
  const minValidNextBid = auction?.minNextBid || (currentHighest + minIncrement);

  const handlePlaceBid = async (amountToBid: number) => {
    if (!token || !user) {
      setFeedback({ type: "error", message: "Please sign in to place a bid" });
      return;
    }

    if (amountToBid < minValidNextBid) {
      setFeedback({
        type: "error",
        message: `Bid rejected. Minimum valid bid is ₹${minValidNextBid.toLocaleString("en-IN")}.`,
      });
      return;
    }

    setIsSubmitting(true);
    setFeedback(null);

    // Generate strict client-side idempotency key for network resilience
    const idempotencyKey = `user_bid_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    try {
      const res = await fetch(`/api/auctions/${auctionId}/bids`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          "Idempotency-Key": idempotencyKey,
        },
        body: JSON.stringify({
          amount: amountToBid,
          idempotencyKey,
        }),
      });

      const data = await res.json();
      setIsSubmitting(false);

      if (data.success) {
        setFeedback({
          type: "success",
          message: `Bid of ₹${amountToBid.toLocaleString("en-IN")} accepted and serialized in PostgreSQL!`,
        });
        setCustomBid("");
        await refreshUser();
      } else {
        setFeedback({
          type: "error",
          message: data.message || "Failed to commit bid",
        });
      }
    } catch (err: any) {
      setIsSubmitting(false);
      setFeedback({
        type: "error",
        message: err.message || "Network error during bid submission",
      });
    }
  };

  if (!auction) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] text-slate-500">
        <div className="flex items-center gap-2 font-medium">
          <Zap className="h-5 w-5 text-sky-500 animate-spin" />
          Synchronizing with BidPulse live node...
        </div>
      </div>
    );
  }

  const isLive = auction.status === "LIVE";
  const isWinner = user && auction.status === "ENDED" && auction.winner_id === user.id;

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 text-slate-900">
      
      {/* Top Breadcrumb & Controls */}
      <div className="flex items-center justify-between mb-6">
        <button
          onClick={onBack}
          className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-xs font-semibold text-slate-700 hover:text-sky-600 hover:border-sky-300 transition-all shadow-xs"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Live Floor
        </button>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-xs text-slate-600 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200">
            <ShieldCheck className="h-4 w-4 text-sky-600" />
            <span className="hidden sm:inline">Engine:</span>
            <span className="text-slate-900 font-bold">PostgreSQL SERIALIZABLE + Row Lock</span>
          </div>

          <button
            onClick={() => onOpenReport(auction.id)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-xs text-slate-500 hover:text-red-600 hover:border-red-200 transition-all shadow-xs"
            title="Report suspicious behavior"
          >
            <Flag className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Report</span>
          </button>
        </div>
      </div>

      {/* WINNER CELEBRATION HERO BANNER */}
      {isWinner && (
        <div className="mb-6 p-6 rounded-2xl bg-sky-50 border-2 border-sky-400 shadow-md text-center">
          <div className="inline-flex items-center justify-center p-3 rounded-full bg-sky-500 text-white mb-3 shadow-xs">
            <Trophy className="h-8 w-8" />
          </div>
          <h2 className="text-2xl font-extrabold tracking-tight text-sky-900 mb-1">
            YOU WON THIS AUCTION!
          </h2>
          <p className="text-sm text-slate-700">
            Winning Bid: <span className="font-extrabold text-slate-900">₹{Number(auction.winning_bid_amount).toLocaleString("en-IN")}</span>
          </p>
          <p className="text-xs text-slate-500 mt-2">
            Settlement complete. Your escrow funds have settled, and verified ownership is recorded.
          </p>
        </div>
      )}

      {/* Main Grid: Left = Item & Live Console, Right = Stream of Bids */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          
          {/* Main Visual & Details Card */}
          <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-xs">
            <div className="relative h-72 w-full bg-slate-100">
              <img
                src={auction.image_url}
                alt={auction.title}
                referrerPolicy="no-referrer"
                className="h-full w-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-black/15" />

              {/* Status & Category */}
              <div className="absolute top-4 left-4 flex gap-2">
                <span className={`px-3 py-1 rounded-full text-xs font-bold border backdrop-blur-sm shadow-xs ${
                  isLive
                    ? "bg-white/95 text-sky-700 border-sky-200"
                    : "bg-white/95 text-slate-700 border-slate-200"
                }`}>
                  {isLive && <span className="inline-block h-2 w-2 rounded-full bg-sky-500 mr-1.5 animate-pulse" />}
                  {auction.status}
                </span>
                <span className="px-3 py-1 rounded-full text-xs font-semibold text-slate-700 bg-white/95 border border-slate-200 backdrop-blur-sm shadow-xs">
                  {auction.category_name}
                </span>
              </div>

              {/* Server-Synchronized Timer Pill */}
              <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between p-3 rounded-xl bg-white/95 border border-slate-200/90 backdrop-blur-md shadow-xs">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-sky-600" />
                  <span className="text-xs text-slate-500">Authoritative Countdown:</span>
                  <span className="text-sm font-bold text-slate-900 tracking-wider font-mono">
                    {timeLeft}
                  </span>
                </div>

                <div className="text-[11px] text-slate-500 font-medium">
                  Sequence #{auction.sequence_version}
                </div>
              </div>
            </div>

            <div className="p-6">
              <h1 className="text-2xl font-extrabold text-slate-900 mb-2">
                {auction.title}
              </h1>
              <p className="text-xs text-slate-600 leading-relaxed mb-5">
                {auction.description}
              </p>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4 border-t border-slate-100 text-xs">
                <div>
                  <span className="text-[11px] text-slate-500 font-medium block">Starting Price</span>
                  <span className="font-bold text-slate-900">
                    ₹{Number(auction.starting_price).toLocaleString("en-IN")}
                  </span>
                </div>
                <div>
                  <span className="text-[11px] text-slate-500 font-medium block">Min Increment</span>
                  <span className="font-bold text-sky-600">
                    +₹{Number(auction.min_increment).toLocaleString("en-IN")}
                  </span>
                </div>
                <div>
                  <span className="text-[11px] text-slate-500 font-medium block">Total Bids</span>
                  <span className="font-bold text-slate-900">{auction.total_bids_count} bids</span>
                </div>
                <div>
                  <span className="text-[11px] text-slate-500 font-medium block">Unique Bidders</span>
                  <span className="font-bold text-slate-900">{auction.unique_bidders_count} bidders</span>
                </div>
              </div>
            </div>
          </div>

          {/* Interactive Live Bidding Box */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs relative">
            <div className="flex items-center justify-between mb-4">
              <div>
                <span className="text-xs uppercase text-slate-500 font-bold tracking-wider">
                  Current Highest Bid
                </span>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="text-3xl sm:text-4xl font-black text-slate-900">
                    ₹{Number(currentHighest).toLocaleString("en-IN")}
                  </span>
                  {auction.highest_bidder_name && (
                    <span className="text-xs text-slate-500">
                      held by <span className="text-slate-800 font-bold">{auction.highest_bidder_name}</span>
                    </span>
                  )}
                </div>
              </div>

              <div className="text-right">
                <span className="text-[11px] uppercase text-slate-500 font-bold block">Next Minimum Bid</span>
                <span className="text-lg font-bold text-sky-600">
                  ₹{Number(minValidNextBid).toLocaleString("en-IN")}
                </span>
              </div>
            </div>

            {/* Quick Bid Preset Increments */}
            {isLive ? (
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-2">
                  <button
                    id="quick-bid-min"
                    onClick={() => handlePlaceBid(minValidNextBid)}
                    disabled={isSubmitting}
                    className="py-2.5 px-3 rounded-xl bg-slate-50 hover:bg-sky-50 border border-slate-200 hover:border-sky-300 text-xs font-semibold text-slate-800 transition-all flex flex-col items-center justify-center disabled:opacity-50 shadow-xs"
                  >
                    <span className="text-slate-500 text-[11px]">Minimum Valid</span>
                    <span className="text-sky-600 font-bold">₹{minValidNextBid.toLocaleString("en-IN")}</span>
                  </button>

                  <button
                    id="quick-bid-plus1k"
                    onClick={() => handlePlaceBid(minValidNextBid + minIncrement)}
                    disabled={isSubmitting}
                    className="py-2.5 px-3 rounded-xl bg-slate-50 hover:bg-sky-50 border border-slate-200 hover:border-sky-300 text-xs font-semibold text-slate-800 transition-all flex flex-col items-center justify-center disabled:opacity-50 shadow-xs"
                  >
                    <span className="text-slate-500 text-[11px]">+1 Extra Increment</span>
                    <span className="text-sky-600 font-bold">₹{(minValidNextBid + minIncrement).toLocaleString("en-IN")}</span>
                  </button>

                  <button
                    id="quick-bid-plus5k"
                    onClick={() => handlePlaceBid(minValidNextBid + minIncrement * 3)}
                    disabled={isSubmitting}
                    className="py-2.5 px-3 rounded-xl bg-slate-50 hover:bg-sky-50 border border-slate-200 hover:border-sky-300 text-xs font-semibold text-slate-800 transition-all flex flex-col items-center justify-center disabled:opacity-50 shadow-xs"
                  >
                    <span className="text-slate-500 text-[11px]">Power Bid (+3x)</span>
                    <span className="text-sky-600 font-bold">₹{(minValidNextBid + minIncrement * 3).toLocaleString("en-IN")}</span>
                  </button>
                </div>

                {/* Custom Bid Input */}
                <div className="flex gap-2">
                  <input
                    id="custom-bid-input"
                    type="number"
                    value={customBid}
                    onChange={(e) => setCustomBid(e.target.value === "" ? "" : Number(e.target.value))}
                    placeholder={`Enter amount (min ₹${minValidNextBid})`}
                    className="flex-1 rounded-xl bg-slate-50 border border-slate-200 px-4 py-2.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-sky-500 focus:bg-white transition-colors"
                  />
                  <button
                    id="place-custom-bid-btn"
                    onClick={() => {
                      if (customBid !== "") handlePlaceBid(Number(customBid));
                    }}
                    disabled={isSubmitting || customBid === "" || Number(customBid) < minValidNextBid}
                    className="px-6 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-600 active:bg-sky-700 text-white font-bold text-xs shadow-xs transition-all disabled:opacity-50 flex items-center gap-2"
                  >
                    {isSubmitting ? "Committing..." : "Place Bid"}
                    <Zap className="h-4 w-4" />
                  </button>
                </div>

                {/* Feedback Notification */}
                {feedback && (
                  <div
                    id="bid-feedback"
                    className={`p-3 rounded-xl text-xs flex items-center gap-2 border ${
                      feedback.type === "success"
                        ? "bg-sky-50 border-sky-200 text-sky-800 font-medium"
                        : "bg-red-50 border-red-200 text-red-600 font-medium"
                    }`}
                  >
                    {feedback.type === "success" ? (
                      <CheckCircle2 className="h-4 w-4 text-sky-600 flex-shrink-0" />
                    ) : (
                      <AlertTriangle className="h-4 w-4 text-red-600 flex-shrink-0" />
                    )}
                    <span>{feedback.message}</span>
                  </div>
                )}
              </div>
            ) : (
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-center text-xs text-slate-600">
                {auction.status === "UPCOMING" ? (
                  <p>Bidding opens automatically when start time is reached on the server.</p>
                ) : auction.status === "ENDED" ? (
                  <p className="text-slate-800 font-semibold">
                    Auction has concluded. Winner: {auction.winner_name || "No bids placed"} (₹{Number(auction.winning_bid_amount || 0).toLocaleString("en-IN")})
                  </p>
                ) : (
                  <p>Bidding currently {auction.status}.</p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right Column (5 cols): Live Bid Stream with Milliseconds */}
        <div className="lg:col-span-5 flex flex-col h-[650px] rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-xs">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-sky-600" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                Live Bid Stream (Millisecond Precision)
              </h3>
            </div>
            <span className="text-[10px] px-2 py-0.5 rounded bg-sky-50 text-sky-700 border border-sky-200 font-semibold">
              PostgreSQL Outbox
            </span>
          </div>

          <div
            ref={bidsListRef}
            id="live-bids-stream"
            className="flex-1 overflow-y-auto p-3 space-y-2"
          >
            {bids.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-400 text-xs text-center p-6">
                <History className="h-8 w-8 mb-2 opacity-40 text-slate-400" />
                <p className="font-semibold text-slate-600">No bids placed yet.</p>
                <p className="text-[11px] text-slate-400 mt-1">Be the first to submit a valid bid above starting price.</p>
              </div>
            ) : (
              bids.map((b, idx) => {
                const isLeading = idx === 0;
                const formattedTime = new Date(Number(b.server_timestamp_ms) || b.server_timestamp).toLocaleTimeString("en-IN", {
                  hour12: false,
                  hour: "2-digit",
                  minute: "2-digit",
                  second: "2-digit",
                });
                const ms = String(new Date(Number(b.server_timestamp_ms) || b.server_timestamp).getMilliseconds()).padStart(3, "0");

                return (
                  <div
                    key={b.id || idx}
                    className={`flex items-center justify-between p-3 rounded-xl border transition-all ${
                      isLeading
                        ? "bg-sky-50/80 border-sky-300 shadow-xs"
                        : "bg-white border-slate-100 text-slate-700 hover:bg-slate-50/50"
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <div className={`flex h-7 w-7 items-center justify-center rounded-lg text-xs font-bold ${
                        isLeading ? "bg-sky-500 text-white" : "bg-slate-100 text-slate-600"
                      }`}>
                        #{b.sequence_number || bids.length - idx}
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-bold text-slate-900">
                            {b.bidder_name || "Bidder"}
                          </span>
                          {isLeading && (
                            <span className="text-[9px] px-1.5 py-0.5 rounded bg-sky-100 text-sky-800 border border-sky-200 font-bold">
                              LEADING
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] text-slate-400 font-mono">
                          {formattedTime}.{ms}
                        </span>
                      </div>
                    </div>

                    <div className="text-right">
                      <span className={`text-sm font-black block ${
                        isLeading ? "text-slate-900" : "text-slate-700"
                      }`}>
                        ₹{Number(b.amount).toLocaleString("en-IN")}
                      </span>
                      <span className="text-[10px] text-sky-600 font-semibold font-mono">
                        CONFIRMED
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div className="p-3 bg-slate-50 border-t border-slate-100 text-[11px] text-slate-500 text-center">
            Zero ghost broadcasts &bull; All entries serialized by PostgreSQL row locks before publishing
          </div>
        </div>

      </div>
    </div>
  );
};

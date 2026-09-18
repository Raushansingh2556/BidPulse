import React, { useState, useEffect } from "react";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { WebSocketProvider, useRealtime, RealtimeMessage } from "./context/WebSocketContext";
import { Navbar } from "./components/Navbar";
import { BidPulseLogo } from "./components/BidPulseLogo";
import { LiveAuctionCard } from "./components/LiveAuctionCard";
import { LiveAuctionDetail } from "./components/LiveAuctionDetail";
import { StressTestDashboard } from "./components/StressTestDashboard";
import { HostDashboard } from "./components/HostDashboard";
import { AdminDashboard } from "./components/AdminDashboard";
import { UserDashboard } from "./components/UserDashboard";
import { LoginModal } from "./components/LoginModal";
import { WalletModal } from "./components/WalletModal";
import { SupportModal } from "./components/SupportModal";
import { ReportModal } from "./components/ReportModal";
import { HistoricalArchive } from "./components/HistoricalArchive";
import { EmailInboxModal } from "./components/EmailInboxModal";
import { Auction } from "./types";
import {
  Search,
  Zap,
  ShieldCheck,
  CheckCircle2,
  Clock,
  TrendingUp,
} from "lucide-react";

const MainFloor: React.FC = () => {
  const { user } = useAuth();
  const { lastMessage } = useRealtime();

  const [currentTab, setCurrentTab] = useState<"auctions" | "archive" | "stress" | "host" | "admin" | "user">("auctions");
  const [selectedAuctionId, setSelectedAuctionId] = useState<string | null>(null);
  const [auctions, setAuctions] = useState<Auction[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Filters
  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");
  const [selectedStatus, setSelectedStatus] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Modals
  const [loginModalOpen, setLoginModalOpen] = useState<boolean>(false);
  const [walletModalOpen, setWalletModalOpen] = useState<boolean>(false);
  const [supportModalOpen, setSupportModalOpen] = useState<boolean>(false);
  const [reportAuctionId, setReportAuctionId] = useState<string | null>(null);
  const [emailModalOpen, setEmailModalOpen] = useState<boolean>(false);

  const fetchAuctions = async () => {
    try {
      const res = await fetch("/api/auctions");
      const data = await res.json();
      if (data.success && data.auctions) {
        setAuctions(data.auctions);
      }
    } catch (err) {
      console.error("Failed to load auctions:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAuctions();
    const interval = setInterval(fetchAuctions, 10000);
    return () => clearInterval(interval);
  }, []);

  // Update auction state on incoming global realtime events
  useEffect(() => {
    if (!lastMessage) return;

    if (lastMessage.type === "bid_accepted") {
      const payload = lastMessage.payload;
      setAuctions((prev) =>
        prev.map((auc) => {
          if (auc.id === payload.auctionId) {
            return {
              ...auc,
              current_highest_bid: payload.amount,
              highest_bidder_id: payload.bidderId,
              highest_bidder_name: payload.bidderName,
              total_bids_count: payload.totalBidsCount,
              unique_bidders_count: payload.uniqueBiddersCount,
              sequence_version: payload.sequenceNumber,
            };
          }
          return auc;
        })
      );
    } else if (lastMessage.type === "auction_state" || lastMessage.type === "auction_ended") {
      fetchAuctions();
    }
  }, [lastMessage]);

  const categories = React.useMemo(() => {
    const set = new Set<string>();
    auctions.forEach((a) => {
      if (a.category_name) set.add(a.category_name);
    });
    return ["ALL", ...Array.from(set).sort()];
  }, [auctions]);

  const filteredAuctions = auctions.filter((auc) => {
    if (selectedCategory !== "ALL" && auc.category_name !== selectedCategory) {
      return false;
    }
    if (selectedStatus !== "ALL" && auc.status !== selectedStatus) {
      return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        auc.title.toLowerCase().includes(q) ||
        auc.description.toLowerCase().includes(q) ||
        (auc.category_name && auc.category_name.toLowerCase().includes(q))
      );
    }
    return true;
  });

  const liveAuctionsCount = auctions.filter((a) => a.status === "LIVE").length;
  const totalBidsCount = auctions.reduce((acc, a) => acc + (a.total_bids_count || 0), 0);
  const totalVolume = auctions.reduce((acc, a) => acc + (parseFloat(a.current_highest_bid as string) || 0), 0);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col selection:bg-sky-500 selection:text-white">
      
      {/* Universal Top Navbar */}
      <Navbar
        currentTab={currentTab}
        onTabChange={(tab) => {
          setSelectedAuctionId(null);
          setCurrentTab(tab);
        }}
        onOpenWallet={() => setWalletModalOpen(true)}
        onOpenLogin={() => setLoginModalOpen(true)}
        onOpenNotifications={() => {
          setSelectedAuctionId(null);
          setCurrentTab("user");
        }}
        onOpenEmails={() => setEmailModalOpen(true)}
      />

      {/* Main Content Area */}
      <main className="flex-1">
        {selectedAuctionId ? (
          <LiveAuctionDetail
            auctionId={selectedAuctionId}
            onBack={() => setSelectedAuctionId(null)}
            onOpenReport={(id) => setReportAuctionId(id)}
          />
        ) : currentTab === "archive" ? (
          <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
            <HistoricalArchive
              auctions={auctions}
              onSelectAuction={(id) => setSelectedAuctionId(id)}
            />
          </div>
        ) : currentTab === "stress" ? (
          <StressTestDashboard auctions={auctions} />
        ) : currentTab === "host" ? (
          <HostDashboard onViewAuction={(id) => setSelectedAuctionId(id)} />
        ) : currentTab === "admin" ? (
          <AdminDashboard
            auctions={auctions}
            onRefreshAuctions={fetchAuctions}
            onNavigateToStress={() => setCurrentTab("stress")}
          />
        ) : currentTab === "user" ? (
          <UserDashboard
            auctions={auctions}
            onViewAuction={(id) => setSelectedAuctionId(id)}
            onOpenSupport={() => setSupportModalOpen(true)}
          />
        ) : (
          /* Live Auctions Floor View */
          <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-8">
            
            {/* Live Hero Banner */}
            <div className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-8 shadow-xs relative overflow-hidden">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-8">
                <div className="max-w-2xl">
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-sky-50 border border-sky-200 text-sky-700 text-xs font-bold mb-3 shadow-xs">
                    <span className="h-2 w-2 rounded-full bg-sky-500 animate-pulse" />
                    High-Concurrency PostgreSQL Engine
                  </div>
                  
                  <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900 leading-tight">
                    Real-Time Bidding. Instant Results.
                  </h1>
                  
                  <p className="mt-2 text-sm text-slate-600 leading-relaxed">
                    Zero race conditions, zero duplicate bids, and strict serializable transactions.
                    Sub-millisecond WebSockets synchronized with authoritative PostgreSQL row-level locks.
                  </p>

                  {/* Core Platform Strengths */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-5 pt-5 border-t border-slate-100">
                    <div className="flex items-center gap-2 text-xs font-medium text-slate-700">
                      <CheckCircle2 className="h-4 w-4 text-sky-600 flex-shrink-0" />
                      <span>Ultra-Low Latency</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs font-medium text-slate-700">
                      <CheckCircle2 className="h-4 w-4 text-sky-600 flex-shrink-0" />
                      <span>Zero Out-of-Order Bids</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs font-medium text-slate-700">
                      <CheckCircle2 className="h-4 w-4 text-sky-600 flex-shrink-0" />
                      <span>Concurrency-Safe Escrow</span>
                    </div>
                  </div>
                </div>

                {/* Telemetry metrics bar */}
                <div className="flex flex-wrap sm:flex-nowrap lg:flex-col gap-3 min-w-[200px]">
                  <div className="flex-1 px-4 py-3 rounded-2xl bg-slate-50 border border-slate-200">
                    <span className="text-[11px] text-slate-500 uppercase tracking-wider block font-medium">Live Auctions</span>
                    <span className="text-2xl font-black text-sky-600">{liveAuctionsCount} active</span>
                  </div>

                  <div className="flex-1 px-4 py-3 rounded-2xl bg-slate-50 border border-slate-200">
                    <span className="text-[11px] text-slate-500 uppercase tracking-wider block font-medium">Floor Volume</span>
                    <span className="text-2xl font-black text-slate-900">₹{totalVolume.toLocaleString("en-IN")}</span>
                  </div>

                  <div className="flex-1 px-4 py-3 rounded-2xl bg-slate-50 border border-slate-200">
                    <span className="text-[11px] text-slate-500 uppercase tracking-wider block font-medium">Committed Bids</span>
                    <span className="text-2xl font-black text-slate-900">{totalBidsCount} bids</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Filter & Search Bar */}
            <div className="space-y-4">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                
                {/* Category Pills */}
                <div className="flex flex-wrap gap-2">
                  {categories.map((cat) => (
                    <button
                      key={cat}
                      onClick={() => setSelectedCategory(cat)}
                      className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all border ${
                        selectedCategory === cat
                          ? "bg-sky-500 text-white border-sky-500 shadow-xs"
                          : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50 hover:border-slate-300"
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>

                {/* Search Input */}
                <div className="relative w-full md:w-80">
                  <Search className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search provenance, title, category..."
                    className="w-full rounded-xl bg-white border border-slate-200 pl-10 pr-4 py-2.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-sky-500 shadow-xs transition-colors"
                  />
                </div>
              </div>

              {/* Status Tabs */}
              <div className="flex items-center gap-2 border-b border-slate-200 pb-2 text-xs">
                <span className="text-slate-500 mr-2 text-xs font-bold uppercase tracking-wider">Status:</span>
                {["ALL", "LIVE", "UPCOMING", "ENDED"].map((st) => (
                  <button
                    key={st}
                    onClick={() => setSelectedStatus(st)}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${
                      selectedStatus === st
                        ? "bg-sky-50 text-sky-700 border border-sky-200"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    {st === "ALL" ? "All Auctions" : st}
                  </button>
                ))}
              </div>
            </div>

            {/* Auction Cards Grid */}
            {loading ? (
              <div className="py-20 text-center text-xs text-slate-500 flex items-center justify-center gap-2 font-medium">
                <Zap className="h-5 w-5 text-sky-500 animate-spin" />
                Loading live floor auctions...
              </div>
            ) : filteredAuctions.length === 0 ? (
              <div className="py-20 text-center rounded-2xl border border-slate-200 bg-white text-xs text-slate-500 shadow-xs">
                No auctions match the selected filter criteria.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredAuctions.map((auction) => (
                  <LiveAuctionCard
                    key={auction.id}
                    auction={auction}
                    onSelect={(id) => setSelectedAuctionId(id)}
                  />
                ))}
              </div>
            )}

          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white py-8 text-xs text-slate-600 mt-12 shadow-xs">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex flex-col sm:flex-row items-center gap-3">
            <BidPulseLogo size="sm" />
            <span className="hidden sm:inline text-slate-300">|</span>
            <span className="text-xs text-slate-500">Real-Time Bidding. Instant Results.</span>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-5 text-xs text-slate-600 font-medium">
            <button onClick={() => setSupportModalOpen(true)} className="hover:text-sky-600 transition-colors">
              Disputes & Support
            </button>
            <button onClick={() => setCurrentTab("stress")} className="hover:text-sky-600 transition-colors">
              k6 Stress Testing Lab
            </button>
            <button onClick={() => setWalletModalOpen(true)} className="hover:text-sky-600 transition-colors">
              Escrow Wallet Ledger
            </button>
            <button onClick={() => setEmailModalOpen(true)} className="hover:text-sky-600 transition-colors">
              Notifications & Outbox
            </button>
          </div>

          <div className="text-xs text-slate-400">
            © {new Date().getFullYear()} BidPulse. All rights reserved.
          </div>
        </div>
      </footer>

      {/* Modals */}
      <LoginModal
        isOpen={loginModalOpen}
        onClose={() => setLoginModalOpen(false)}
      />

      <WalletModal
        isOpen={walletModalOpen}
        onClose={() => setWalletModalOpen(false)}
      />

      <SupportModal
        isOpen={supportModalOpen}
        onClose={() => setSupportModalOpen(false)}
      />

      <ReportModal
        isOpen={Boolean(reportAuctionId)}
        auctionId={reportAuctionId}
        onClose={() => setReportAuctionId(null)}
      />

      <EmailInboxModal
        isOpen={emailModalOpen}
        onClose={() => setEmailModalOpen(false)}
      />

    </div>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <WebSocketProvider>
        <MainFloor />
      </WebSocketProvider>
    </AuthProvider>
  );
}

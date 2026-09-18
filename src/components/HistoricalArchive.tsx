import React, { useState, useMemo } from "react";
import { Landmark, Search, Filter, Trophy, Calendar, CheckCircle, ShieldCheck, Tag, ArrowUpRight, X } from "lucide-react";
import { Auction } from "../types";

interface HistoricalArchiveProps {
  auctions: Auction[];
  onSelectAuction: (id: string) => void;
}

export const HistoricalArchive: React.FC<HistoricalArchiveProps> = ({ auctions, onSelectAuction }) => {
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("ALL");
  const [sortBy, setSortBy] = useState<"price-desc" | "price-asc" | "bids" | "date">("price-desc");
  const [inspectItem, setInspectItem] = useState<Auction | null>(null);

  // Filter for ENDED auctions only
  const endedAuctions = useMemo(() => {
    return auctions.filter((a) => a.status === "ENDED");
  }, [auctions]);

  // Extract available categories
  const categories = useMemo(() => {
    const map = new Map<string, string>();
    endedAuctions.forEach((a) => {
      if (a.category_id && a.category_name) {
        map.set(a.category_id, a.category_name);
      }
    });
    return Array.from(map.entries());
  }, [endedAuctions]);

  // Filter and sort
  const filtered = useMemo(() => {
    return endedAuctions
      .filter((a) => {
        const matchesCategory = selectedCategory === "ALL" || a.category_id === selectedCategory;
        const q = search.toLowerCase();
        const matchesSearch =
          !q ||
          a.title.toLowerCase().includes(q) ||
          a.description.toLowerCase().includes(q) ||
          (a.winner_name && a.winner_name.toLowerCase().includes(q));
        return matchesCategory && matchesSearch;
      })
      .sort((a, b) => {
        const priceA = parseFloat(String(a.winning_bid_amount || a.current_highest_bid || 0));
        const priceB = parseFloat(String(b.winning_bid_amount || b.current_highest_bid || 0));
        if (sortBy === "price-desc") return priceB - priceA;
        if (sortBy === "price-asc") return priceA - priceB;
        if (sortBy === "bids") return b.total_bids_count - a.total_bids_count;
        return new Date(b.settled_at || b.end_time).getTime() - new Date(a.settled_at || a.end_time).getTime();
      });
  }, [endedAuctions, selectedCategory, search, sortBy]);

  // Summary statistics
  const stats = useMemo(() => {
    const totalVolume = endedAuctions.reduce((acc, a) => acc + parseFloat(String(a.winning_bid_amount || a.current_highest_bid || 0)), 0);
    const totalBids = endedAuctions.reduce((acc, a) => acc + (a.total_bids_count || 0), 0);
    return {
      count: endedAuctions.length,
      volume: totalVolume,
      totalBids,
    };
  }, [endedAuctions]);

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-white border border-slate-200 p-6 sm:p-8 shadow-xs">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-sky-50 border border-sky-200 text-sky-700 text-xs font-bold uppercase tracking-wider mb-3">
              <Landmark className="w-3.5 h-3.5" />
              Historical Auction Archives & Numismatics
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              Museum Heritage & Concluded Masterpieces
            </h1>
            <p className="text-slate-500 text-sm max-w-2xl mt-1.5 leading-relaxed">
              Explore 30+ completed high-value sales including ancient coins, vintage horology, rare manuscripts, and automotive icons. Every concluded lot features cryptographically verifiable ledger settlement.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-3 sm:gap-4 bg-slate-50 border border-slate-200 p-4 rounded-xl self-start md:self-auto">
            <div>
              <div className="text-xs text-slate-500 font-medium">Archived Lots</div>
              <div className="text-lg sm:text-xl font-extrabold text-sky-600 font-mono">{stats.count}</div>
            </div>
            <div>
              <div className="text-xs text-slate-500 font-medium">Total Cleared</div>
              <div className="text-lg sm:text-xl font-extrabold text-slate-900 font-mono">
                ₹{(stats.volume / 100000).toFixed(1)}L
              </div>
            </div>
            <div>
              <div className="text-xs text-slate-500 font-medium">Verified Bids</div>
              <div className="text-lg sm:text-xl font-extrabold text-sky-600 font-mono">{stats.totalBids}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Filter and Search Controls */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-white border border-slate-200 p-3.5 rounded-xl shadow-xs">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search archival artifacts, winning collectors, manuscripts, coins..."
            className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-4 py-2 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-sky-500 focus:bg-white transition-colors"
          />
        </div>

        {/* Category & Sort */}
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-700 font-medium focus:outline-none focus:border-sky-500 cursor-pointer"
          >
            <option value="ALL">All Categories ({endedAuctions.length})</option>
            {categories.map(([id, name]) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </select>

          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-700 font-medium focus:outline-none focus:border-sky-500 cursor-pointer"
          >
            <option value="price-desc">Highest Winning Bid</option>
            <option value="price-asc">Lowest Winning Bid</option>
            <option value="bids">Most Competition (Bids)</option>
            <option value="date">Most Recent Concluded</option>
          </select>
        </div>
      </div>

      {/* Grid of Historical Auctions */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-slate-200 shadow-xs">
          <Landmark className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-base font-extrabold text-slate-900">No archival lots found</h3>
          <p className="text-xs text-slate-500 mt-1">Try adjusting your search terms or category filter.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {filtered.map((item) => {
            const winningAmount = parseFloat(String(item.winning_bid_amount || item.current_highest_bid || 0));
            return (
              <div
                key={item.id}
                className="group bg-white border border-slate-200 rounded-2xl overflow-hidden hover:border-sky-300 transition-all duration-200 flex flex-col hover:shadow-lg shadow-xs"
              >
                {/* Image & Badge */}
                <div className="relative aspect-[16/10] overflow-hidden bg-slate-100">
                  <img
                    src={item.image_url}
                    alt={item.title}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                  <div className="absolute top-2.5 left-2.5">
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-white/90 border border-slate-200 text-[11px] font-bold text-slate-800 backdrop-blur-xs shadow-xs">
                      <CheckCircle className="w-3 h-3 text-sky-600" />
                      SETTLED
                    </span>
                  </div>
                  <div className="absolute top-2.5 right-2.5">
                    <span className="px-2.5 py-0.5 rounded-md bg-sky-50 text-sky-700 border border-sky-200 text-[10px] font-mono font-bold backdrop-blur-xs shadow-xs">
                      {item.category_name || "Artifact"}
                    </span>
                  </div>
                </div>

                {/* Content */}
                <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                  <div>
                    <h3 className="text-sm font-extrabold text-slate-900 line-clamp-2 group-hover:text-sky-600 transition-colors">
                      {item.title}
                    </h3>
                    <p className="text-xs text-slate-500 line-clamp-2 mt-1.5 leading-relaxed">
                      {item.description}
                    </p>
                  </div>

                  {/* Pricing and Settlement Details */}
                  <div className="pt-3 border-t border-slate-100 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] text-slate-500 font-medium flex items-center gap-1">
                        <Trophy className="w-3.5 h-3.5 text-sky-600" />
                        Final Hammer
                      </span>
                      <span className="text-base font-extrabold text-slate-900 font-mono">
                        ₹{winningAmount.toLocaleString("en-IN")}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-slate-500 font-medium">
                      <span>Winner:</span>
                      <span className="text-slate-900 font-bold truncate max-w-[120px]">
                        {item.winner_name || "Collector"}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-slate-400">
                      <span>Total Bids:</span>
                      <span className="font-mono text-slate-600 font-semibold">{item.total_bids_count} bids</span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="pt-2 flex gap-2">
                    <button
                      onClick={() => setInspectItem(item)}
                      className="flex-1 py-2 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors flex items-center justify-center gap-1"
                    >
                      Provenance
                    </button>
                    <button
                      onClick={() => onSelectAuction(item.id)}
                      className="py-2 px-3 rounded-xl bg-sky-50 hover:bg-sky-100 text-sky-700 border border-sky-200 text-xs font-bold transition-colors flex items-center justify-center gap-1 shadow-xs"
                      title="View Auction Room"
                    >
                      Audit
                      <ArrowUpRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Inspect Item Modal */}
      {inspectItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-150">
            <div className="relative aspect-[16/9] bg-slate-100">
              <img
                src={inspectItem.image_url}
                alt={inspectItem.title}
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover"
              />
              <button
                onClick={() => setInspectItem(null)}
                className="absolute top-3 right-3 p-1.5 rounded-full bg-white/90 hover:bg-white text-slate-700 shadow-md transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono text-sky-700 bg-sky-50 px-2.5 py-1 rounded-full border border-sky-200 font-bold">
                  {inspectItem.category_name}
                </span>
                <span className="text-xs text-sky-700 flex items-center gap-1 font-mono font-bold">
                  <ShieldCheck className="w-3.5 h-3.5 text-sky-600" />
                  Ledger Finalized & Verified
                </span>
              </div>

              <h2 className="text-xl font-extrabold text-slate-900">{inspectItem.title}</h2>
              <p className="text-sm text-slate-600 leading-relaxed">{inspectItem.description}</p>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs">
                <div>
                  <div className="text-slate-500 font-medium">Starting Price</div>
                  <div className="font-mono text-slate-700 font-bold mt-0.5">
                    ₹{parseFloat(String(inspectItem.starting_price)).toLocaleString("en-IN")}
                  </div>
                </div>
                <div>
                  <div className="text-slate-500 font-medium">Final Hammer Price</div>
                  <div className="font-mono text-slate-900 font-extrabold mt-0.5">
                    ₹{parseFloat(String(inspectItem.winning_bid_amount || inspectItem.current_highest_bid)).toLocaleString("en-IN")}
                  </div>
                </div>
                <div>
                  <div className="text-slate-500 font-medium">Winning Collector</div>
                  <div className="text-slate-900 font-bold mt-0.5 truncate">
                    {inspectItem.winner_name || "Verified Bidder"}
                  </div>
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-3">
                <button
                  onClick={() => setInspectItem(null)}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors"
                >
                  Close
                </button>
                <button
                  onClick={() => {
                    const id = inspectItem.id;
                    setInspectItem(null);
                    onSelectAuction(id);
                  }}
                  className="px-5 py-2 rounded-xl bg-sky-500 hover:bg-sky-600 text-white text-xs font-bold transition-colors flex items-center gap-1.5 shadow-xs"
                >
                  View Full Bid History
                  <ArrowUpRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

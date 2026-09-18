import React, { useState, useEffect } from "react";
import { Auction } from "../types";
import { Clock, Users, ArrowUpRight, Heart } from "lucide-react";

interface LiveAuctionCardProps {
  auction: Auction;
  onSelect: (auctionId: string) => void;
  isFavorite?: boolean;
  onToggleFavorite?: (auctionId: string, e: React.MouseEvent) => void;
}

export const LiveAuctionCard: React.FC<LiveAuctionCardProps> = ({
  auction,
  onSelect,
  isFavorite = false,
  onToggleFavorite,
}) => {
  const [timeLeft, setTimeLeft] = useState<string>("");
  const [fav, setFav] = useState<boolean>(isFavorite);

  useEffect(() => {
    const updateCountdown = () => {
      const now = Date.now();
      const end = new Date(auction.end_time).getTime();
      const start = new Date(auction.start_time).getTime();

      if (auction.status === "ENDED") {
        setTimeLeft("Concluded");
        return;
      }

      if (auction.status === "UPCOMING" || now < start) {
        const diff = Math.max(0, start - now);
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const secs = Math.floor((diff % (1000 * 60)) / 1000);
        setTimeLeft(`Starts: ${hours}h ${mins}m ${secs}s`);
        return;
      }

      const diff = Math.max(0, end - now);
      if (diff === 0) {
        setTimeLeft("Finalizing...");
      } else {
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const secs = Math.floor((diff % (1000 * 60)) / 1000);
        setTimeLeft(
          `${hours.toString().padStart(2, "0")}:${mins
            .toString()
            .padStart(2, "0")}:${secs.toString().padStart(2, "0")}`
        );
      }
    };

    updateCountdown();
    const timer = setInterval(updateCountdown, 1000);
    return () => clearInterval(timer);
  }, [auction.end_time, auction.start_time, auction.status]);

  const isLive = auction.status === "LIVE";
  const currentHighest = parseFloat(auction.current_highest_bid as string) || parseFloat(auction.starting_price as string);
  const minNextBid = currentHighest + (parseFloat(auction.min_increment as string) || 500);

  const handleHeartClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setFav(!fav);
    if (onToggleFavorite) {
      onToggleFavorite(auction.id, e);
    }
  };

  return (
    <div
      id={`auction-card-${auction.id}`}
      onClick={() => onSelect(auction.id)}
      className="group relative flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white hover:border-sky-300 hover:shadow-md transition-all duration-200 cursor-pointer text-slate-800"
    >
      {/* Product Image Header */}
      <div className="relative h-52 w-full overflow-hidden bg-slate-100">
        <img
          src={auction.image_url}
          alt={auction.title}
          referrerPolicy="no-referrer"
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-black/10" />

        {/* Live Status Badge - Subtle Light Blue */}
        <div className="absolute top-3 left-3 flex items-center gap-1.5">
          {isLive ? (
            <span className="flex items-center gap-1.5 rounded-full bg-white/95 px-2.5 py-1 text-[11px] font-bold text-sky-700 border border-sky-200 shadow-xs backdrop-blur-sm">
              <span className="h-2 w-2 rounded-full bg-sky-500 animate-pulse" />
              LIVE
            </span>
          ) : auction.status === "UPCOMING" ? (
            <span className="rounded-full bg-white/95 px-2.5 py-1 text-[11px] font-bold text-slate-700 border border-slate-200 shadow-xs backdrop-blur-sm">
              UPCOMING
            </span>
          ) : auction.status === "ENDED" ? (
            <span className="rounded-full bg-slate-900/80 px-2.5 py-1 text-[11px] font-bold text-white shadow-xs backdrop-blur-sm">
              CONCLUDED
            </span>
          ) : (
            <span className="rounded-full bg-white/95 px-2.5 py-1 text-[11px] font-bold text-slate-700 border border-slate-200 shadow-xs backdrop-blur-sm">
              {auction.status}
            </span>
          )}
        </div>

        {/* Favorite Button on Top Right */}
        <div className="absolute top-3 right-3 flex items-center gap-1.5">
          <button
            onClick={handleHeartClick}
            aria-label="Save to favorites"
            className="flex h-8 w-8 items-center justify-center rounded-full bg-white/90 border border-slate-200 text-slate-600 hover:text-sky-600 hover:bg-white shadow-xs transition-colors backdrop-blur-sm"
          >
            <Heart className={`h-4 w-4 ${fav ? "fill-sky-500 text-sky-500" : ""}`} />
          </button>
        </div>

        {/* Timer Bar Overlay */}
        <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between text-xs font-semibold text-slate-900 bg-white/95 backdrop-blur-md px-3 py-1.5 rounded-xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center gap-1.5 text-slate-800">
            <Clock className="h-3.5 w-3.5 text-sky-600" />
            <span className="font-mono text-xs">{timeLeft}</span>
          </div>
          <div className="flex items-center gap-1.5 text-slate-500 text-[11px]">
            <Users className="h-3 w-3 text-slate-400" />
            <span>{auction.total_bids_count} bids</span>
          </div>
        </div>
      </div>

      {/* Card Body */}
      <div className="flex flex-1 flex-col justify-between p-4 space-y-3.5">
        <div>
          <div className="flex items-center justify-between gap-2 mb-1">
            <span className="inline-block rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600 uppercase tracking-wide">
              {auction.category_name || "Collectibles"}
            </span>
          </div>
          <h3 className="text-sm font-bold text-slate-900 group-hover:text-sky-600 transition-colors line-clamp-1">
            {auction.title}
          </h3>
          <p className="mt-1 text-xs text-slate-500 line-clamp-2 leading-relaxed">
            {auction.description}
          </p>
        </div>

        {/* Financial Details Box */}
        <div className="rounded-xl bg-slate-50 border border-slate-200/80 p-3">
          <div className="flex items-baseline justify-between text-[11px]">
            <span className="font-medium text-slate-500">
              {auction.total_bids_count > 0 ? "Current Highest Bid" : "Starting Price"}
            </span>
            <span className="text-sky-600 font-medium">
              Min next: ₹{Number(minNextBid).toLocaleString("en-IN")}
            </span>
          </div>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-lg sm:text-xl font-extrabold text-slate-900">
              ₹{Number(currentHighest).toLocaleString("en-IN")}
            </span>
            {auction.highest_bidder_name && (
              <span className="text-[11px] text-slate-500">
                by <span className="font-semibold text-slate-700">{auction.highest_bidder_name.split(" ")[0]}</span>
              </span>
            )}
          </div>
        </div>

        {/* Action Button - Light Blue CTA */}
        <button
          id={`enter-auction-btn-${auction.id}`}
          className="w-full flex items-center justify-center gap-1.5 py-2.5 px-4 rounded-xl bg-sky-500 hover:bg-sky-600 active:bg-sky-700 text-white text-xs font-bold transition-all shadow-xs"
        >
          <span>{isLive ? "View Live Auction" : "View Auction Details"}</span>
          <ArrowUpRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
};

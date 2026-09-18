import React, { useState, useEffect } from "react";
import { Auction, Notification } from "../types";
import { useAuth } from "../context/AuthContext";
import {
  User as UserIcon,
  Trophy,
  TrendingUp,
  Bell,
  CheckCircle2,
  LifeBuoy,
  Eye,
  Send,
  Volume2,
  VolumeX,
} from "lucide-react";

interface UserDashboardProps {
  auctions: Auction[];
  onViewAuction: (auctionId: string) => void;
  onOpenSupport: () => void;
}

export const UserDashboard: React.FC<UserDashboardProps> = ({
  auctions,
  onViewAuction,
  onOpenSupport,
}) => {
  const { user, token } = useAuth();
  const [activeTab, setActiveTab] = useState<"bids" | "won" | "notifications">("bids");
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);

  const fetchNotifications = async () => {
    if (!token) return;
    try {
      const res = await fetch("/api/notifications", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success && data.notifications) {
        setNotifications(data.notifications);
      }
    } catch (err) {
      console.error("Failed to load notifications:", err);
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, [token]);

  const markAllRead = async () => {
    if (!token) return;
    try {
      await fetch("/api/notifications/read-all", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      fetchNotifications();
    } catch (err) {
      console.error("Failed to mark all read:", err);
    }
  };

  const wonAuctions = auctions.filter((a) => a.winner_id === user?.id);
  const leadingAuctions = auctions.filter((a) => a.highest_bidder_id === user?.id && a.status === "LIVE");

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 text-slate-900">
      
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-200">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-sky-50 border border-sky-200 text-sky-600 shadow-xs">
            <UserIcon className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl font-extrabold tracking-tight text-slate-900">
              Buyer Command Center
            </h1>
            <p className="text-xs text-slate-500">
              Real-time portfolio tracking &bull; Active bids &bull; Won auctions &bull; Outbid alerts
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 self-start sm:self-auto">
          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs text-slate-700 hover:border-sky-300 transition-colors shadow-xs"
            title="Toggle audio alerts"
          >
            {soundEnabled ? <Volume2 className="h-4 w-4 text-sky-600" /> : <VolumeX className="h-4 w-4 text-slate-400" />}
            <span>Sound {soundEnabled ? "ON" : "OFF"}</span>
          </button>

          <button
            onClick={onOpenSupport}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white hover:bg-slate-50 text-slate-700 hover:text-sky-600 border border-slate-200 text-xs font-semibold shadow-xs transition-all"
          >
            <LifeBuoy className="h-4 w-4 text-sky-600" />
            <span>Support Desk</span>
          </button>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-6">
        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs">
          <span className="text-[11px] text-slate-500 font-medium uppercase tracking-wider block">Currently Leading</span>
          <span className="text-2xl font-black text-sky-600">{leadingAuctions.length}</span>
          <span className="text-[10px] text-slate-400 block mt-0.5">Live auctions with top bid</span>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs">
          <span className="text-[11px] text-slate-500 font-medium uppercase tracking-wider block">Auctions Won</span>
          <span className="text-2xl font-black text-slate-900">{wonAuctions.length}</span>
          <span className="text-[10px] text-slate-400 block mt-0.5">Settled acquisitions</span>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs">
          <span className="text-[11px] text-slate-500 font-medium uppercase tracking-wider block">Unread Alerts</span>
          <span className="text-2xl font-black text-slate-800">
            {notifications.filter((n) => !n.is_read).length}
          </span>
          <span className="text-[10px] text-slate-400 block mt-0.5">Realtime events received</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-slate-200 mt-6 pb-2">
        <button
          onClick={() => setActiveTab("bids")}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors ${
            activeTab === "bids"
              ? "bg-sky-50 text-sky-700 border border-sky-300"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          Leading Auctions ({leadingAuctions.length})
        </button>

        <button
          onClick={() => setActiveTab("won")}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors ${
            activeTab === "won"
              ? "bg-sky-50 text-sky-700 border border-sky-300"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          Won Auctions ({wonAuctions.length})
        </button>

        <button
          onClick={() => setActiveTab("notifications")}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors ${
            activeTab === "notifications"
              ? "bg-sky-50 text-sky-700 border border-sky-300"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          Notifications ({notifications.length})
        </button>
      </div>

      {/* Leading Auctions */}
      {activeTab === "bids" && (
        <div className="mt-4">
          {leadingAuctions.length === 0 ? (
            <div className="p-10 rounded-2xl border border-slate-200 bg-white text-center text-xs text-slate-400 shadow-xs">
              You are not currently the leading bidder on any live auctions. Enter the Live Floor to place a bid!
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {leadingAuctions.map((auc) => (
                <div
                  key={auc.id}
                  className="p-5 rounded-2xl border border-sky-200 bg-white shadow-xs flex justify-between items-center"
                >
                  <div>
                    <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-sky-50 text-sky-700 border border-sky-200 font-bold">
                      YOU ARE LEADING
                    </span>
                    <h4 className="text-sm font-extrabold text-slate-900 mt-2">{auc.title}</h4>
                    <p className="text-xs text-sky-600 font-bold mt-1">
                      Your Highest Bid: ₹{Number(auc.current_highest_bid).toLocaleString("en-IN")}
                    </p>
                  </div>
                  <button
                    onClick={() => onViewAuction(auc.id)}
                    className="py-2 px-3.5 rounded-xl bg-sky-500 hover:bg-sky-600 text-white text-xs font-bold flex items-center gap-1.5 shadow-xs transition-colors"
                  >
                    <Eye className="h-4 w-4" />
                    Open Floor
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Won Auctions */}
      {activeTab === "won" && (
        <div className="mt-4">
          {wonAuctions.length === 0 ? (
            <div className="p-10 rounded-2xl border border-slate-200 bg-white text-center text-xs text-slate-400 shadow-xs">
              No won auctions yet. When you win an active auction, your celebratory certificate and item provenance will display here.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {wonAuctions.map((auc) => (
                <div
                  key={auc.id}
                  className="p-5 rounded-2xl border border-sky-200 bg-white shadow-xs flex justify-between items-center"
                >
                  <div>
                    <span className="flex items-center gap-1.5 text-xs font-bold text-sky-700">
                      <Trophy className="h-4 w-4 text-sky-600" />
                      ACQUISITION CONFIRMED
                    </span>
                    <h4 className="text-sm font-extrabold text-slate-900 mt-2">{auc.title}</h4>
                    <p className="text-xs text-slate-600 mt-1">
                      Final Hammer Price: <span className="font-bold text-slate-900">₹{Number(auc.winning_bid_amount).toLocaleString("en-IN")}</span>
                    </p>
                  </div>
                  <button
                    onClick={() => onViewAuction(auc.id)}
                    className="py-2 px-3.5 rounded-xl bg-sky-500 hover:bg-sky-600 text-white text-xs font-bold flex items-center gap-1.5 shadow-xs transition-colors"
                  >
                    <Eye className="h-4 w-4" />
                    View Certificate
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Notifications Tab */}
      {activeTab === "notifications" && (
        <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
              Activity & Outbid Notifications
            </span>
            <button
              onClick={markAllRead}
              className="text-xs text-sky-600 hover:text-sky-700 font-semibold"
            >
              Mark all as read
            </button>
          </div>

          <div className="space-y-2">
            {notifications.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-6">No notifications received.</p>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.id}
                  className={`p-3 rounded-xl border text-xs flex items-center justify-between transition-colors ${
                    n.is_read
                      ? "bg-slate-50 border-slate-200 text-slate-600"
                      : "bg-sky-50/70 border-sky-200 text-slate-900"
                  }`}
                >
                  <div>
                    <span className="font-bold block">{n.title}</span>
                    <p className="text-[11px] text-slate-500 mt-0.5">{n.message}</p>
                  </div>
                  <span className="text-[10px] text-slate-400 font-mono">
                    {new Date(n.created_at).toLocaleTimeString()}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      )}

    </div>
  );
};

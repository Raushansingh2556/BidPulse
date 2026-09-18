import React, { useState, useEffect } from "react";
import { useAuth, DEMO_USERS } from "../context/AuthContext";
import { useRealtime } from "../context/WebSocketContext";
import { BidPulseLogo } from "./BidPulseLogo";
import {
  Activity,
  Shield,
  Wallet,
  Bell,
  User as UserIcon,
  ChevronDown,
  Layers,
  Sparkles,
  Archive,
  Zap,
  Mail,
  Sun,
  Moon,
} from "lucide-react";

interface NavbarProps {
  currentTab: "auctions" | "archive" | "stress" | "host" | "admin" | "user";
  onTabChange: (tab: "auctions" | "archive" | "stress" | "host" | "admin" | "user") => void;
  onOpenWallet: () => void;
  onOpenLogin: (role?: "ADMIN" | "HOST" | "BUYER") => void;
  onOpenNotifications: () => void;
  onOpenEmails?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentTab,
  onTabChange,
  onOpenWallet,
  onOpenLogin,
  onOpenNotifications,
  onOpenEmails,
}) => {
  const { user, logout, switchDemoUser } = useAuth();
  const { isConnected } = useRealtime();
  const [showRoleMenu, setShowRoleMenu] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  // Theme Management (Light Mode / Dark Mode)
  const [theme, setTheme] = useState<"light" | "dark">(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("bidpulse_theme") || localStorage.getItem("theme");
      if (saved === "dark" || saved === "light") return saved;
      return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    }
    return "light";
  });

  useEffect(() => {
    const root = document.documentElement;
    if (theme === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
    localStorage.setItem("bidpulse_theme", theme);
    localStorage.setItem("theme", theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === "dark" ? "light" : "dark"));
  };

  // Poll notifications count
  useEffect(() => {
    if (!user) return;
    const fetchNotifs = async () => {
      try {
        const token = localStorage.getItem("auction_token");
        if (!token) return;
        const res = await fetch("/api/notifications", {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (data.success && data.notifications) {
          const unread = data.notifications.filter((n: any) => !n.is_read).length;
          setUnreadCount(unread);
        }
      } catch (err) {
        // silent
      }
    };

    fetchNotifs();
    const interval = setInterval(fetchNotifs, 10000);
    return () => clearInterval(interval);
  }, [user]);

  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-200/90 bg-white/95 backdrop-blur-md shadow-xs">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        
        {/* BidPulse Official Logo & Brand */}
        <div className="flex items-center gap-6">
          <div
            id="brand-logo"
            onClick={() => onTabChange("auctions")}
            className="flex cursor-pointer items-center gap-2 group transition-opacity hover:opacity-90"
          >
            <BidPulseLogo size="md" />
          </div>

          {/* Navigation Links */}
          <nav className="hidden md:flex items-center gap-1.5 ml-2">
            <button
              id="nav-auctions"
              onClick={() => onTabChange("auctions")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                currentTab === "auctions"
                  ? "bg-sky-50 text-sky-700 border border-sky-200 shadow-xs"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-100/80"
              }`}
            >
              <Activity className="h-3.5 w-3.5 text-sky-600" />
              Auctions
            </button>

            <button
              id="nav-archive"
              onClick={() => onTabChange("archive")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                currentTab === "archive"
                  ? "bg-sky-50 text-sky-700 border border-sky-200 shadow-xs"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-100/80"
              }`}
            >
              <Archive className="h-3.5 w-3.5 text-sky-600" />
              Archive
            </button>

            <button
              id="nav-stress"
              onClick={() => onTabChange("stress")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                currentTab === "stress"
                  ? "bg-sky-50 text-sky-700 border border-sky-200 shadow-xs"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-100/80"
              }`}
            >
              <Zap className="h-3.5 w-3.5 text-sky-600" />
              Stress Lab (k6)
            </button>

            <button
              id="nav-host"
              onClick={() => onTabChange("host")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                currentTab === "host"
                  ? "bg-sky-50 text-sky-700 border border-sky-200 shadow-xs"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-100/80"
              }`}
            >
              <Layers className="h-3.5 w-3.5 text-slate-500" />
              Host Studio
            </button>

            <button
              id="nav-admin"
              onClick={() => onTabChange("admin")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                currentTab === "admin"
                  ? "bg-sky-50 text-sky-700 border border-sky-200 shadow-xs"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-100/80"
              }`}
            >
              <Shield className="h-3.5 w-3.5 text-slate-500" />
              Admin
            </button>

            <button
              id="nav-user"
              onClick={() => onTabChange("user")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                currentTab === "user"
                  ? "bg-sky-50 text-sky-700 border border-sky-200 shadow-xs"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-100/80"
              }`}
            >
              <UserIcon className="h-3.5 w-3.5 text-slate-500" />
              Dashboard
            </button>
          </nav>
        </div>

        {/* Right side controls: Health status, Wallet, Switcher, Profile */}
        <div className="flex items-center gap-2.5">
          {/* WebSocket Status Indicator */}
          <div
            id="ws-status"
            className={`hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium border ${
              isConnected
                ? "bg-sky-50 text-sky-800 border-sky-200"
                : "bg-slate-100 text-slate-600 border-slate-200"
            }`}
          >
            <span
              className={`h-2 w-2 rounded-full ${
                isConnected ? "bg-sky-500 animate-pulse" : "bg-slate-400"
              }`}
            />
            {isConnected ? "LIVE WS CONNECTED" : "CONNECTING..."}
          </div>

          {/* Wallet Balance Pill */}
          {user && (
            <button
              id="wallet-btn"
              onClick={onOpenWallet}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white border border-slate-200 hover:border-sky-300 hover:bg-sky-50/40 transition-all text-xs text-slate-800 shadow-xs group"
            >
              <Wallet className="h-4 w-4 text-sky-600 group-hover:scale-105 transition-transform" />
              <div className="flex flex-col text-left">
                <span className="text-[10px] text-slate-500 leading-none">Wallet</span>
                <span className="font-bold text-slate-900 leading-tight">
                  ₹{Number(user.availableBalance || 0).toLocaleString("en-IN")}
                </span>
              </div>
            </button>
          )}

          {/* Quick Demo Switcher Dropdown */}
          <div className="relative">
            <button
              id="demo-switcher-btn"
              onClick={() => setShowRoleMenu(!showRoleMenu)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white border border-slate-200 hover:border-sky-300 text-xs font-semibold text-slate-800 hover:bg-slate-50 transition-all shadow-xs"
              title="Switch persona or sign in"
            >
              <Sparkles className="h-3.5 w-3.5 text-sky-600" />
              <span className="hidden sm:inline">
                {user ? user.name.split(" ")[0] : "Sign In"}
              </span>
              <span className="px-1.5 py-0.5 rounded bg-sky-100 text-[10px] text-sky-800 font-bold">
                {user?.role || "GUEST"}
              </span>
              <ChevronDown className="h-3 w-3 text-slate-400" />
            </button>

            {showRoleMenu && (
              <div
                id="demo-switcher-dropdown"
                className="absolute right-0 mt-2 w-64 rounded-xl border border-slate-200 bg-white p-2 shadow-xl z-50 text-xs text-slate-800"
              >
                <div className="px-2 py-1.5 text-[11px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-100 mb-1">
                  1-Click Role Switcher
                </div>
                {Object.entries(DEMO_USERS).map(([key, val]) => (
                  <button
                    key={key}
                    onClick={() => {
                      switchDemoUser(key as any);
                      setShowRoleMenu(false);
                    }}
                    className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-left transition-colors ${
                      user?.email === val.email
                        ? "bg-sky-50 text-sky-800 font-semibold border border-sky-200"
                        : "text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    <span>{val.label}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-medium">
                      {val.role}
                    </span>
                  </button>
                ))}
                <div className="border-t border-slate-100 mt-1.5 pt-1.5 flex justify-between px-1">
                  <button
                    onClick={() => {
                      onOpenLogin();
                      setShowRoleMenu(false);
                    }}
                    className="text-sky-600 font-semibold hover:underline text-[11px]"
                  >
                    Sign In Modal...
                  </button>
                  {user && (
                    <button
                      onClick={() => {
                        logout();
                        setShowRoleMenu(false);
                      }}
                      className="text-slate-500 hover:text-slate-800 text-[11px] font-medium"
                    >
                      Logout
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Outbox Email button */}
          {onOpenEmails && (
            <button
              id="emails-btn"
              onClick={onOpenEmails}
              className="relative p-2 rounded-lg bg-white border border-slate-200 text-slate-600 hover:text-sky-600 hover:border-sky-300 hover:bg-sky-50/40 transition-all shadow-xs"
              title="Transactional Email Logs (PostgreSQL Outbox Engine)"
            >
              <Mail className="h-4 w-4" />
            </button>
          )}

          {/* Notifications button */}
          <button
            id="notifications-btn"
            onClick={onOpenNotifications}
            className="relative p-2 rounded-lg bg-white border border-slate-200 text-slate-600 hover:text-sky-600 hover:border-sky-300 hover:bg-sky-50/40 transition-all shadow-xs"
            title="Notifications"
          >
            <Bell className="h-4 w-4" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-sky-500 text-[10px] font-bold text-white shadow-xs">
                {unreadCount}
              </span>
            )}
          </button>

          {/* Theme Mode Toggle (Light Mode / Dark Mode) */}
          <button
            id="theme-toggle-btn"
            onClick={toggleTheme}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 hover:border-sky-300 text-slate-700 hover:text-sky-600 hover:bg-slate-50 transition-all shadow-xs text-xs font-semibold cursor-pointer"
            title={theme === "dark" ? "Switch to Light Mode" : "Switch to Dark Mode"}
            aria-label={theme === "dark" ? "Switch to Light Mode" : "Switch to Dark Mode"}
          >
            {theme === "dark" ? (
              <>
                <Sun className="h-4 w-4 text-amber-400" />
                <span className="hidden sm:inline">Light Mode</span>
              </>
            ) : (
              <>
                <Moon className="h-4 w-4 text-slate-600" />
                <span className="hidden sm:inline">Dark Mode</span>
              </>
            )}
          </button>
        </div>
      </div>
    </header>
  );
};

import React, { useState } from "react";
import { useAuth, DEMO_USERS } from "../context/AuthContext";
import { BidPulseLogo } from "./BidPulseLogo";
import { X, Shield, Layers, User as UserIcon, Lock, Mail, ArrowRight } from "lucide-react";

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultRole?: "ADMIN" | "HOST" | "BUYER";
}

export const LoginModal: React.FC<LoginModalProps> = ({ isOpen, onClose, defaultRole = "BUYER" }) => {
  const { login, register, switchDemoUser } = useAuth();
  const [selectedRole, setSelectedRole] = useState<"ADMIN" | "HOST" | "BUYER">(defaultRole);
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [country, setCountry] = useState("IN");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    if (isRegister) {
      const res = await register({ email, password, name, role: selectedRole, country });
      setIsLoading(false);
      if (res.success) {
        onClose();
      } else {
        setError(res.message || "Registration failed");
      }
    } else {
      const res = await login(email, password, selectedRole);
      setIsLoading(false);
      if (res.success) {
        onClose();
      } else {
        setError(res.message || "Login failed");
      }
    }
  };

  const handleQuickDemo = async (key: keyof typeof DEMO_USERS) => {
    setIsLoading(true);
    await switchDemoUser(key);
    setIsLoading(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
      <div className="relative w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 sm:p-7 shadow-2xl text-slate-900">
        
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute right-4 top-4 p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Logo & Header */}
        <div className="text-center mb-6">
          <div className="flex justify-center mb-2">
            <BidPulseLogo size="lg" />
          </div>
          <p className="text-xs text-slate-500 font-medium">
            Real-Time Bidding. Instant Results.
          </p>
        </div>

        {/* 3 Portal Entry Selectors */}
        <div className="mb-5">
          <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-2">
            Select Portal Gateway
          </label>

          <div className="grid grid-cols-3 gap-2">
            <button
              id="portal-buyer"
              type="button"
              onClick={() => { setSelectedRole("BUYER"); setError(null); }}
              className={`flex flex-col items-center justify-center p-3 rounded-xl border text-center transition-all ${
                selectedRole === "BUYER"
                  ? "bg-sky-50 border-sky-500 text-sky-800 font-semibold shadow-xs ring-1 ring-sky-400"
                  : "bg-slate-50/70 border-slate-200 text-slate-600 hover:bg-slate-100/80"
              }`}
            >
              <UserIcon className="h-4 w-4 mb-1 text-sky-600" />
              <span className="text-xs font-bold">BUYER</span>
              <span className="text-[10px] text-slate-400">Live Bids</span>
            </button>

            <button
              id="portal-host"
              type="button"
              onClick={() => { setSelectedRole("HOST"); setError(null); }}
              className={`flex flex-col items-center justify-center p-3 rounded-xl border text-center transition-all ${
                selectedRole === "HOST"
                  ? "bg-sky-50 border-sky-500 text-sky-800 font-semibold shadow-xs ring-1 ring-sky-400"
                  : "bg-slate-50/70 border-slate-200 text-slate-600 hover:bg-slate-100/80"
              }`}
            >
              <Layers className="h-4 w-4 mb-1 text-sky-600" />
              <span className="text-xs font-bold">HOST</span>
              <span className="text-[10px] text-slate-400">Listings</span>
            </button>

            <button
              id="portal-admin"
              type="button"
              onClick={() => { setSelectedRole("ADMIN"); setError(null); }}
              className={`flex flex-col items-center justify-center p-3 rounded-xl border text-center transition-all ${
                selectedRole === "ADMIN"
                  ? "bg-sky-50 border-sky-500 text-sky-800 font-semibold shadow-xs ring-1 ring-sky-400"
                  : "bg-slate-50/70 border-slate-200 text-slate-600 hover:bg-slate-100/80"
              }`}
            >
              <Shield className="h-4 w-4 mb-1 text-sky-600" />
              <span className="text-xs font-bold">ADMIN</span>
              <span className="text-[10px] text-slate-400">Governance</span>
            </button>
          </div>
        </div>

        {/* 1-Click Instant Demo Login for Judges */}
        <div className="mb-5 p-3 rounded-xl bg-slate-50 border border-slate-200">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] text-sky-700 font-bold tracking-wider uppercase">
              1-Click Demo Access (Hackathon Mode)
            </span>
          </div>
          {selectedRole === "BUYER" && (
            <div className="flex gap-2">
              <button
                id="demo-login-rahul"
                type="button"
                onClick={() => handleQuickDemo("buyer1")}
                className="flex-1 py-1.5 px-2 rounded-lg bg-white hover:bg-sky-50 border border-slate-200 hover:border-sky-300 text-xs text-slate-800 text-center transition-colors shadow-xs font-medium"
              >
                Rahul (₹1.5L)
              </button>
              <button
                id="demo-login-arjun"
                type="button"
                onClick={() => handleQuickDemo("buyer2")}
                className="flex-1 py-1.5 px-2 rounded-lg bg-white hover:bg-sky-50 border border-slate-200 hover:border-sky-300 text-xs text-slate-800 text-center transition-colors shadow-xs font-medium"
              >
                Arjun (₹1.0L)
              </button>
            </div>
          )}
          {selectedRole === "HOST" && (
            <button
              id="demo-login-host"
              type="button"
              onClick={() => handleQuickDemo("host1")}
              className="w-full py-1.5 px-2 rounded-lg bg-white hover:bg-sky-50 border border-slate-200 hover:border-sky-300 text-xs text-slate-800 text-center transition-colors shadow-xs font-medium"
            >
              Vikram Singhania (Verified Host)
            </button>
          )}
          {selectedRole === "ADMIN" && (
            <button
              id="demo-login-admin"
              type="button"
              onClick={() => handleQuickDemo("admin")}
              className="w-full py-1.5 px-2 rounded-lg bg-white hover:bg-sky-50 border border-slate-200 hover:border-sky-300 text-xs text-sky-700 text-center transition-colors shadow-xs font-bold"
            >
              Siddharth Verma (Super Admin)
            </button>
          )}
        </div>

        {/* Standard Credentials Form */}
        <form onSubmit={handleSubmit} className="space-y-3">
          {isRegister && (
            <div>
              <label className="text-xs font-medium text-slate-700 block mb-1">Full Name</label>
              <input
                id="auth-name-input"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                placeholder="e.g. Aryan Malhotra"
                className="w-full rounded-xl bg-slate-50 border border-slate-200 px-3 py-2 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-sky-500 focus:bg-white transition-colors"
              />
            </div>
          )}

          <div>
            <label className="text-xs font-medium text-slate-700 block mb-1">Email Address</label>
            <div className="relative">
              <Mail className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                id="auth-email-input"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="user@example.com"
                className="w-full rounded-xl bg-slate-50 border border-slate-200 pl-9 pr-3 py-2 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-sky-500 focus:bg-white transition-colors"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-slate-700 block mb-1">Password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                id="auth-password-input"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="••••••••"
                className="w-full rounded-xl bg-slate-50 border border-slate-200 pl-9 pr-3 py-2 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-sky-500 focus:bg-white transition-colors"
              />
            </div>
          </div>

          {isRegister && (
            <div>
              <label className="text-xs font-medium text-slate-700 block mb-1">Country (Bidding Currency INR ₹)</label>
              <select
                id="auth-country-select"
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                className="w-full rounded-xl bg-slate-50 border border-slate-200 px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-sky-500 focus:bg-white transition-colors"
              >
                <option value="IN">India (INR ₹)</option>
                <option value="US">United States (USD equivalent)</option>
                <option value="GB">United Kingdom (GBP equivalent)</option>
                <option value="SG">Singapore (SGD equivalent)</option>
                <option value="AE">UAE (AED equivalent)</option>
              </select>
            </div>
          )}

          {error && (
            <div className="p-2.5 rounded-xl bg-red-50 border border-red-200 text-red-600 text-xs">
              {error}
            </div>
          )}

          <button
            id="auth-submit-btn"
            type="submit"
            disabled={isLoading}
            className="w-full mt-2 py-2.5 px-4 rounded-xl bg-sky-500 hover:bg-sky-600 active:bg-sky-700 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-xs transition-all disabled:opacity-50"
          >
            {isLoading ? "Authenticating..." : isRegister ? "Create Account" : `Enter as ${selectedRole}`}
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </form>

        <div className="mt-4 text-center">
          <button
            id="auth-toggle-mode"
            onClick={() => { setIsRegister(!isRegister); setError(null); }}
            className="text-xs text-slate-500 hover:text-sky-600 transition-colors underline"
          >
            {isRegister ? "Already have an account? Sign In" : "Need a new account? Register here"}
          </button>
        </div>
      </div>
    </div>
  );
};

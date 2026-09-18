import React, { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { WalletLedgerItem } from "../types";
import { X, Wallet, ArrowDownRight, ArrowUpRight, ShieldCheck, CreditCard, RefreshCw, CheckCircle2 } from "lucide-react";

interface WalletModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const WalletModal: React.FC<WalletModalProps> = ({ isOpen, onClose }) => {
  const { user, token, refreshUser } = useAuth();
  const [ledger, setLedger] = useState<WalletLedgerItem[]>([]);
  const [amount, setAmount] = useState<number>(50000);
  const [method, setMethod] = useState<string>("UPI");
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isLoadingLedger, setIsLoadingLedger] = useState<boolean>(false);

  const fetchLedger = async () => {
    if (!token) return;
    setIsLoadingLedger(true);
    try {
      const res = await fetch("/api/wallet/ledger", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success && data.ledger) {
        setLedger(data.ledger);
      }
    } catch (err) {
      console.error("Failed to load ledger:", err);
    } finally {
      setIsLoadingLedger(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchLedger();
      refreshUser();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleTopup = async () => {
    if (!amount || amount <= 0) return;
    setIsProcessing(true);
    setSuccessMsg(null);

    try {
      const res = await fetch("/api/wallet/topup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          amount,
          method: `Razorpay Test Mode (${method})`,
        }),
      });

      const data = await res.json();
      setIsProcessing(false);
      if (data.success) {
        setSuccessMsg(data.message);
        await refreshUser();
        await fetchLedger();
      }
    } catch (err) {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
      <div className="relative w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-6 sm:p-7 shadow-2xl text-slate-900 max-h-[90vh] flex flex-col">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-sky-50 border border-sky-200 text-sky-600 shadow-xs">
              <Wallet className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-slate-900 tracking-tight">
                Transactional Wallet & Escrow Ledger
              </h2>
              <p className="text-xs text-slate-500">
                Immutable double-entry balance with serializable fund reservation
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Balance Overview Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
            <span className="text-[11px] text-slate-500 font-medium uppercase tracking-wider block mb-1">
              Available Balance
            </span>
            <span className="text-2xl font-black text-sky-600">
              ₹{Number(user?.availableBalance || 0).toLocaleString("en-IN")}
            </span>
            <span className="text-[10px] text-slate-400 block mt-0.5">Liquid for bidding</span>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
            <span className="text-[11px] text-slate-500 font-medium uppercase tracking-wider block mb-1">
              Locked / Reserved
            </span>
            <span className="text-2xl font-black text-slate-700">
              ₹{Number(user?.lockedBalance || 0).toLocaleString("en-IN")}
            </span>
            <span className="text-[10px] text-slate-400 block mt-0.5">Committed on active bids</span>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
            <span className="text-[11px] text-slate-500 font-medium uppercase tracking-wider block mb-1">
              Total Net Worth
            </span>
            <span className="text-2xl font-black text-slate-900">
              ₹{(Number(user?.availableBalance || 0) + Number(user?.lockedBalance || 0)).toLocaleString("en-IN")}
            </span>
            <span className="text-[10px] text-slate-400 block mt-0.5">Verified in INR (₹)</span>
          </div>
        </div>

        {/* Instant Top-Up Section */}
        <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 mb-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              <CreditCard className="h-4 w-4 text-sky-600" />
              Instant Escrow Top-Up (Simulation Gateway)
            </span>
            <span className="text-[10px] px-2 py-0.5 rounded bg-sky-50 text-sky-700 border border-sky-200 font-medium">
              Zero Transaction Fees
            </span>
          </div>

          <div className="flex flex-wrap gap-2 mb-3">
            {[10000, 25000, 50000, 100000].map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => setAmount(preset)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                  amount === preset
                    ? "bg-sky-50 text-sky-800 border-sky-400 ring-1 ring-sky-300 shadow-xs"
                    : "bg-white text-slate-700 border-slate-200 hover:bg-slate-100"
                }`}
              >
                +₹{preset.toLocaleString("en-IN")}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-3 gap-2 mb-3">
            {["UPI", "CARDS", "NET BANKING"].map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMethod(m)}
                className={`py-1.5 rounded-lg text-xs font-semibold border text-center transition-all ${
                  method === m
                    ? "bg-white text-sky-700 border-sky-500 shadow-xs"
                    : "bg-white/60 text-slate-600 border-slate-200 hover:bg-white"
                }`}
              >
                {m}
              </button>
            ))}
          </div>

          {successMsg && (
            <div className="p-2.5 mb-3 rounded-lg bg-sky-50 border border-sky-200 text-sky-800 text-xs flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-sky-600 flex-shrink-0" />
              {successMsg}
            </div>
          )}

          <div className="flex gap-2">
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value))}
              placeholder="Amount in INR"
              className="flex-1 rounded-xl bg-white border border-slate-200 px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-sky-500 font-mono"
            />
            <button
              id="confirm-topup-btn"
              onClick={handleTopup}
              disabled={isProcessing || amount <= 0}
              className="px-5 py-2 rounded-xl bg-sky-500 hover:bg-sky-600 active:bg-sky-700 text-white font-bold text-xs shadow-xs transition-all disabled:opacity-50 flex items-center gap-1.5"
            >
              {isProcessing ? "Processing..." : "Authorize Top-Up"}
            </button>
          </div>
        </div>

        {/* Financial Ledger Audit Trail */}
        <div className="flex-1 overflow-hidden flex flex-col">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
              <ShieldCheck className="h-4 w-4 text-sky-600" />
              Cryptographic Wallet Ledger (Last 50 Entries)
            </span>
            <button
              onClick={fetchLedger}
              className="text-xs text-slate-500 hover:text-sky-600 flex items-center gap-1 font-medium transition-colors"
            >
              <RefreshCw className={`h-3 w-3 ${isLoadingLedger ? "animate-spin" : ""}`} />
              Refresh
            </button>
          </div>

          <div className="flex-1 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50/50 p-2 space-y-1.5">
            {ledger.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400">
                No ledger transactions recorded yet.
              </div>
            ) : (
              ledger.map((item) => {
                const isPositive = Number(item.available_delta) > 0;
                return (
                  <div
                    key={item.id}
                    className="flex items-center justify-between p-2.5 rounded-xl bg-white border border-slate-200 text-xs shadow-xs"
                  >
                    <div className="flex items-center gap-2.5">
                      <div
                        className={`p-1.5 rounded-lg ${
                          isPositive
                            ? "bg-sky-50 text-sky-700 border border-sky-200"
                            : "bg-slate-100 text-slate-600 border border-slate-200"
                        }`}
                      >
                        {isPositive ? <ArrowDownRight className="h-3.5 w-3.5" /> : <ArrowUpRight className="h-3.5 w-3.5" />}
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-slate-900">{item.type}</span>
                          <span className="text-[10px] text-slate-400">ref: {item.reference_id?.substring(0, 14)}...</span>
                        </div>
                        <p className="text-[11px] text-slate-500 line-clamp-1">{item.description}</p>
                      </div>
                    </div>

                    <div className="text-right">
                      <span
                        className={`font-bold block ${
                          isPositive ? "text-sky-600" : "text-slate-800"
                        }`}
                      >
                        {isPositive ? "+" : ""}
                        ₹{Number(item.amount).toLocaleString("en-IN")}
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono">
                        {new Date(item.created_at).toLocaleTimeString()}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

      </div>
    </div>
  );
};

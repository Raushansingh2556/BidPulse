import React, { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { X, Flag, CheckCircle2 } from "lucide-react";

interface ReportModalProps {
  isOpen: boolean;
  auctionId: string | null;
  onClose: () => void;
}

export const ReportModal: React.FC<ReportModalProps> = ({ isOpen, auctionId, onClose }) => {
  const { token } = useAuth();
  const [reason, setReason] = useState("Suspected Shill Bidding");
  const [description, setDescription] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  if (!isOpen || !auctionId) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setIsSending(true);

    try {
      const res = await fetch("/api/reports", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          targetType: "AUCTION",
          targetId: auctionId,
          reason,
          description,
        }),
      });
      const data = await res.json();
      setIsSending(false);
      if (data.success) {
        setSubmitted(true);
        setTimeout(() => {
          setSubmitted(false);
          setDescription("");
          onClose();
        }, 1500);
      }
    } catch (err) {
      setIsSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl text-slate-900">
        <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2 text-slate-900">
            <Flag className="h-5 w-5 text-sky-600" />
            <h3 className="text-base font-extrabold text-slate-900">Report Integrity Violation</h3>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-slate-600 transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        {submitted ? (
          <div className="py-8 text-center space-y-2">
            <CheckCircle2 className="h-10 w-10 text-sky-600 mx-auto" />
            <h4 className="text-sm font-extrabold text-slate-900">Report Filed</h4>
            <p className="text-xs text-slate-500">Admin compliance team will audit the cryptographic audit log.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3 text-xs">
            <div>
              <label className="text-slate-600 font-medium block mb-1">Violation Category</label>
              <select
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="w-full rounded-xl bg-slate-50 border border-slate-200 px-3 py-2 text-slate-900 focus:outline-none focus:border-sky-500 focus:bg-white transition-colors"
              >
                <option value="Suspected Shill Bidding">Suspected Shill Bidding</option>
                <option value="Misleading Description">Misleading Description / False Provenance</option>
                <option value="Host Collusion">Host Collusion</option>
                <option value="Suspicious Rapid Bidding">Suspicious Bot / Rapid Bidding</option>
                <option value="Other Policy Violation">Other Policy Violation</option>
              </select>
            </div>

            <div>
              <label className="text-slate-600 font-medium block mb-1">Specific Incident Details</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                required
                rows={4}
                placeholder="Explain the anomaly or provide evidence..."
                className="w-full rounded-xl bg-slate-50 border border-slate-200 px-3 py-2 text-slate-900 focus:outline-none focus:border-sky-500 focus:bg-white transition-colors"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 font-medium hover:bg-slate-200 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSending}
                className="px-5 py-2 rounded-xl bg-sky-500 hover:bg-sky-600 text-white font-bold disabled:opacity-50 shadow-xs transition-colors"
              >
                {isSending ? "Submitting..." : "Submit Incident Report"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

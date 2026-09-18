import React, { useState } from "react";
import { Clock, AlertCircle, CheckCircle2, FileEdit, X, ShieldAlert } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { Auction } from "../types";

interface ChangeRequestModalProps {
  auction: Auction | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export const ChangeRequestModal: React.FC<ChangeRequestModalProps> = ({
  auction,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const { token } = useAuth();
  const [proposedTitle, setProposedTitle] = useState("");
  const [proposedDescription, setProposedDescription] = useState("");
  const [proposedStartingPrice, setProposedStartingPrice] = useState("");
  const [proposedMinIncrement, setProposedMinIncrement] = useState("");
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  if (!isOpen || !auction) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) {
      setError("Please provide a legitimate reason for this change request.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/auctions/${auction.id}/change-requests`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          proposedTitle: proposedTitle.trim() || undefined,
          proposedDescription: proposedDescription.trim() || undefined,
          proposedStartingPrice: proposedStartingPrice ? parseFloat(proposedStartingPrice) : undefined,
          proposedMinIncrement: proposedMinIncrement ? parseFloat(proposedMinIncrement) : undefined,
          reason: reason.trim(),
        }),
      });

      const data = await res.json();
      if (!data.success) {
        throw new Error(data.message || "Failed to submit change request");
      }

      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        onClose();
        if (onSuccess) onSuccess();
      }, 2000);
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
      <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-white">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-sky-50 border border-sky-200 flex items-center justify-center text-sky-600">
              <FileEdit className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-slate-900">Request Pre-Start Auction Edit</h2>
              <p className="text-xs text-slate-500">Lot: {auction.title}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Informational banner */}
        <div className="px-5 py-3 bg-slate-50 border-b border-slate-200 text-xs text-slate-700 flex items-start gap-2">
          <ShieldAlert className="w-4 h-4 text-sky-600 shrink-0 mt-0.5" />
          <span>
            Due to strict ledger integrity, live or ended auctions cannot be modified. Upcoming lots may only be modified after admin review and audit logging.
          </span>
        </div>

        {/* Content form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && (
            <div className="p-3 rounded-xl bg-slate-100 border border-slate-200 text-xs text-slate-900 flex items-center gap-2 font-medium">
              <AlertCircle className="w-4 h-4 shrink-0 text-sky-600" />
              <span>{error}</span>
            </div>
          )}

          {success ? (
            <div className="py-8 text-center space-y-2">
              <CheckCircle2 className="w-12 h-12 text-sky-600 mx-auto animate-bounce" />
              <h3 className="text-sm font-extrabold text-slate-900">Change Request Submitted</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                Your proposed adjustments have been forwarded to the compliance desk for review. You will receive an email upon resolution.
              </p>
            </div>
          ) : (
            <>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Proposed New Title <span className="text-slate-400 font-normal">(Optional)</span>
                </label>
                <input
                  type="text"
                  placeholder={auction.title}
                  value={proposedTitle}
                  onChange={(e) => setProposedTitle(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-sky-500 focus:bg-white transition-colors"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    New Starting Price (₹)
                  </label>
                  <input
                    type="number"
                    placeholder={String(auction.starting_price)}
                    value={proposedStartingPrice}
                    onChange={(e) => setProposedStartingPrice(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-sky-500 focus:bg-white transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    New Min Increment (₹)
                  </label>
                  <input
                    type="number"
                    placeholder={String(auction.min_increment)}
                    value={proposedMinIncrement}
                    onChange={(e) => setProposedMinIncrement(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-sky-500 focus:bg-white transition-colors"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Updated Description / Provenance Notes <span className="text-slate-400 font-normal">(Optional)</span>
                </label>
                <textarea
                  rows={2}
                  placeholder="Additional certification details or condition notes..."
                  value={proposedDescription}
                  onChange={(e) => setProposedDescription(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-sky-500 focus:bg-white transition-colors resize-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Reason for Adjustment <span className="text-sky-600">*</span>
                </label>
                <textarea
                  required
                  rows={2}
                  placeholder="Explain why the starting price, increment, or provenance text needs modification..."
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-sky-500 focus:bg-white transition-colors resize-none"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-5 py-2 rounded-xl bg-sky-500 hover:bg-sky-600 text-white text-xs font-bold transition-colors disabled:opacity-50 shadow-xs"
                >
                  {loading ? "Submitting..." : "Submit to Admin Desk"}
                </button>
              </div>
            </>
          )}
        </form>
      </div>
    </div>
  );
};

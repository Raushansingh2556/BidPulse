import React, { useState, useEffect } from "react";
import { Auction } from "../types";
import { useAuth } from "../context/AuthContext";
import {
  Layers,
  Plus,
  CreditCard,
  CheckCircle2,
  Lock,
  ArrowRight,
  Clock,
  Users,
  Eye,
  Send,
  AlertCircle,
  FileEdit,
} from "lucide-react";
import { ChangeRequestModal } from "./ChangeRequestModal";

interface HostDashboardProps {
  onViewAuction: (auctionId: string) => void;
}

export const HostDashboard: React.FC<HostDashboardProps> = ({ onViewAuction }) => {
  const { user, token } = useAuth();
  const [myAuctions, setMyAuctions] = useState<Auction[]>([]);
  const [isCreating, setIsCreating] = useState<boolean>(false);
  const [payingAuction, setPayingAuction] = useState<Auction | null>(null);
  const [changeRequestAuction, setChangeRequestAuction] = useState<Auction | null>(null);
  const [isProcessingPayment, setIsProcessingPayment] = useState<boolean>(false);
  const [paymentSuccess, setPaymentSuccess] = useState<string | null>(null);

  // Form fields
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [imageUrl, setImageUrl] = useState("https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?auto=format&fit=crop&w=1200&q=80");
  const [startingPrice, setStartingPrice] = useState(25000);
  const [minIncrement, setMinIncrement] = useState(1000);
  const [durationHours, setDurationHours] = useState(2);
  const [formError, setFormError] = useState<string | null>(null);

  const fetchMyAuctions = async () => {
    if (!token || !user) return;
    try {
      const res = await fetch(`/api/auctions?hostId=${user.id}`);
      const data = await res.json();
      if (data.success && data.auctions) {
        setMyAuctions(data.auctions);
      }
    } catch (err) {
      console.error("Failed to load host auctions:", err);
    }
  };

  useEffect(() => {
    fetchMyAuctions();
  }, [user, token]);

  const calculateFee = (price: number) => {
    if (price < 10000) return 99;
    if (price <= 100000) return 199;
    return 499;
  };

  const calculatedFee = calculateFee(startingPrice);

  const handleCreateAuction = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const now = new Date();
    const startTime = new Date(now.getTime() + 60 * 1000); // 1 minute from now
    const endTime = new Date(startTime.getTime() + durationHours * 60 * 60 * 1000);

    try {
      const res = await fetch("/api/auctions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          title,
          description,
          imageUrl,
          startingPrice,
          minIncrement,
          startTime: startTime.toISOString(),
          endTime: endTime.toISOString(),
        }),
      });

      const data = await res.json();
      if (data.success) {
        setIsCreating(false);
        setTitle("");
        setDescription("");
        await fetchMyAuctions();
      } else {
        setFormError(data.message || "Failed to create auction");
      }
    } catch (err: any) {
      setFormError(err.message || "Network error");
    }
  };

  const handlePaySubscription = async (auc: Auction) => {
    setIsProcessingPayment(true);
    setPaymentSuccess(null);

    try {
      const res = await fetch("/api/subscriptions/pay", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          auctionId: auc.id,
          paymentMethod: "Razorpay Test Mode",
        }),
      });

      const data = await res.json();
      setIsProcessingPayment(false);

      if (data.success) {
        setPaymentSuccess(data.message);
        // Automatically publish
        await fetch(`/api/auctions/${auc.id}/publish`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        });

        setTimeout(() => {
          setPayingAuction(null);
          setPaymentSuccess(null);
          fetchMyAuctions();
        }, 1500);
      }
    } catch (err) {
      setIsProcessingPayment(false);
    }
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 text-slate-900">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-200">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-sky-50 border border-sky-200 text-sky-600 shadow-xs">
            <Layers className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl font-extrabold tracking-tight text-slate-900">
              Auction Host Studio
            </h1>
            <p className="text-xs text-slate-500">
              Authorized Host Portal &bull; Subscription-backed lifecycle &bull; Post-publish lock
            </p>
          </div>
        </div>

        <button
          id="create-auction-btn"
          onClick={() => setIsCreating(!isCreating)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-600 active:bg-sky-700 text-white font-bold text-xs shadow-xs transition-all self-start sm:self-auto"
        >
          <Plus className="h-4 w-4" />
          <span>{isCreating ? "Cancel Creation" : "Create New Auction"}</span>
        </button>
      </div>

      {/* Creation Form Modal / Card */}
      {isCreating && (
        <form onSubmit={handleCreateAuction} className="mt-6 p-6 rounded-2xl border border-slate-200 bg-white shadow-xs space-y-4">
          <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
            Create Item Draft & Server-Calculated Subscription
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="text-slate-600 block mb-1 font-medium">Item Title</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                placeholder="e.g. Rare 1969 Moon Landing Navigational Chart"
                className="w-full rounded-xl bg-slate-50 border border-slate-200 px-3 py-2 text-slate-900 focus:outline-none focus:border-sky-500 focus:bg-white transition-colors"
              />
            </div>

            <div>
              <label className="text-slate-600 block mb-1 font-medium">Image URL</label>
              <input
                type="url"
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                required
                className="w-full rounded-xl bg-slate-50 border border-slate-200 px-3 py-2 text-slate-900 focus:outline-none focus:border-sky-500 focus:bg-white transition-colors"
              />
            </div>

            <div className="md:col-span-2">
              <label className="text-slate-600 block mb-1 font-medium">Full Provenance & Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                required
                rows={3}
                placeholder="Detail technical specifications, museum documentation, and condition report..."
                className="w-full rounded-xl bg-slate-50 border border-slate-200 px-3 py-2 text-slate-900 focus:outline-none focus:border-sky-500 focus:bg-white transition-colors"
              />
            </div>

            <div>
              <label className="text-slate-600 block mb-1 font-medium">Starting Price (INR ₹)</label>
              <input
                type="number"
                value={startingPrice}
                onChange={(e) => setStartingPrice(Number(e.target.value))}
                required
                min={100}
                className="w-full rounded-xl bg-slate-50 border border-slate-200 px-3 py-2 text-slate-900 focus:outline-none focus:border-sky-500 focus:bg-white font-mono transition-colors"
              />
            </div>

            <div>
              <label className="text-slate-600 block mb-1 font-medium">Minimum Increment (INR ₹)</label>
              <input
                type="number"
                value={minIncrement}
                onChange={(e) => setMinIncrement(Number(e.target.value))}
                required
                min={50}
                className="w-full rounded-xl bg-slate-50 border border-slate-200 px-3 py-2 text-slate-900 focus:outline-none focus:border-sky-500 focus:bg-white font-mono transition-colors"
              />
            </div>
          </div>

          {/* Dynamic Subscription Fee Breakdown */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
            <div>
              <span className="text-xs font-bold text-slate-900 block">
                Required Host Subscription Fee (Server Enforced)
              </span>
              <span className="text-[11px] text-slate-500">
                {startingPrice < 10000
                  ? "Tier 1: Starting price < ₹10,000 → Fee: ₹99"
                  : startingPrice <= 100000
                  ? "Tier 2: ₹10,000 to ₹1,00,000 → Fee: ₹199"
                  : "Tier 3: Starting price > ₹1,00,000 → Fee: ₹499"}
              </span>
            </div>
            <div className="text-right">
              <span className="text-lg font-black text-sky-600">₹{calculatedFee}</span>
              <span className="text-[10px] text-slate-400 block">Razorpay Test Mode</span>
            </div>
          </div>

          {formError && (
            <div className="p-2.5 rounded-lg bg-red-50 border border-red-200 text-red-600 text-xs">
              {formError}
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setIsCreating(false)}
              className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 text-xs hover:bg-slate-200 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl bg-sky-500 hover:bg-sky-600 text-white font-bold text-xs shadow-xs transition-colors"
            >
              Save Draft & Proceed to Payment
            </button>
          </div>
        </form>
      )}

      {/* Subscription Payment Modal */}
      {payingAuction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl text-slate-900">
            <h3 className="text-base font-extrabold text-slate-900 mb-1 flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-sky-600" />
              Host Subscription Payment
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Razorpay Test Mode simulation for "{payingAuction.title}"
            </p>

            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 mb-4">
              <div className="flex justify-between text-xs mb-1">
                <span className="text-slate-500">Starting Price</span>
                <span className="text-slate-900 font-bold">₹{Number(payingAuction.starting_price).toLocaleString("en-IN")}</span>
              </div>
              <div className="flex justify-between text-xs mb-2">
                <span className="text-slate-500">Subscription Tier</span>
                <span className="text-slate-700">Standard Host Listing</span>
              </div>
              <div className="border-t border-slate-200 pt-2 flex justify-between font-bold text-sm">
                <span className="text-slate-900">Payable Amount</span>
                <span className="text-sky-600 font-black">₹{payingAuction.subscription_fee}</span>
              </div>
            </div>

            {paymentSuccess && (
              <div className="p-3 mb-4 rounded-xl bg-sky-50 border border-sky-200 text-sky-800 text-xs flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-sky-600 flex-shrink-0" />
                <span>{paymentSuccess}</span>
              </div>
            )}

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setPayingAuction(null)}
                className="flex-1 py-2.5 rounded-xl bg-slate-100 text-xs text-slate-700 hover:bg-slate-200 font-medium transition-colors"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => handlePaySubscription(payingAuction)}
                disabled={isProcessingPayment}
                className="flex-1 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-600 text-white font-bold text-xs disabled:opacity-50 shadow-xs transition-colors"
              >
                {isProcessingPayment ? "Verifying..." : `Authorize ₹${payingAuction.subscription_fee}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Host Auctions List */}
      <div className="mt-6 space-y-4">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
          My Managed Listings ({myAuctions.length})
        </h3>

        {myAuctions.length === 0 ? (
          <div className="p-12 rounded-2xl border border-slate-200 bg-white text-center text-xs text-slate-400 shadow-xs">
            No auctions created yet. Click 'Create New Auction' above to list your first item.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {myAuctions.map((auc) => (
              <div
                key={auc.id}
                className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                      auc.status === "LIVE"
                        ? "bg-sky-50 text-sky-700 border-sky-200"
                        : auc.status === "DRAFT"
                        ? "bg-slate-100 text-slate-600 border-slate-200"
                        : "bg-sky-50 text-sky-800 border-sky-300"
                    }`}>
                      {auc.status}
                    </span>

                    <span className="text-[11px] text-slate-500 font-medium">
                      Sub: {auc.is_subscription_paid ? "PAID" : `₹${auc.subscription_fee} DUE`}
                    </span>
                  </div>

                  <h4 className="text-sm font-extrabold text-slate-900 line-clamp-1 mb-1">
                    {auc.title}
                  </h4>
                  <p className="text-[11px] text-slate-500 line-clamp-2 mb-3">
                    {auc.description}
                  </p>

                  <div className="grid grid-cols-2 gap-2 text-[11px] p-2.5 rounded-xl bg-slate-50 border border-slate-200 mb-3">
                    <div>
                      <span className="text-slate-400 block text-[9px] uppercase tracking-wider">Starting</span>
                      <span className="font-bold text-slate-800">₹{Number(auc.starting_price).toLocaleString("en-IN")}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[9px] uppercase tracking-wider">Highest Bid</span>
                      <span className="font-bold text-sky-600">₹{Number(auc.current_highest_bid).toLocaleString("en-IN")}</span>
                    </div>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-100 flex items-center gap-2">
                  {!auc.is_subscription_paid && (
                    <button
                      onClick={() => setPayingAuction(auc)}
                      className="flex-1 py-1.5 px-3 rounded-xl bg-sky-500 hover:bg-sky-600 text-white font-bold text-xs text-center shadow-xs transition-colors"
                    >
                      Pay Sub (₹{auc.subscription_fee})
                    </button>
                  )}

                  {auc.status === "UPCOMING" && (
                    <button
                      onClick={() => setChangeRequestAuction(auc)}
                      className="py-1.5 px-3 rounded-xl bg-white hover:bg-slate-50 text-slate-700 hover:text-sky-600 border border-slate-200 text-xs font-semibold flex items-center justify-center gap-1 transition-colors"
                      title="Propose adjustments before bidding starts"
                    >
                      <FileEdit className="h-3.5 w-3.5 text-sky-600" />
                      Edit
                    </button>
                  )}

                  <button
                    onClick={() => onViewAuction(auc.id)}
                    className="flex-1 py-1.5 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold flex items-center justify-center gap-1 transition-colors"
                  >
                    <Eye className="h-3.5 w-3.5" />
                    View Floor
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Change Request Modal */}
      <ChangeRequestModal
        auction={changeRequestAuction}
        isOpen={Boolean(changeRequestAuction)}
        onClose={() => setChangeRequestAuction(null)}
        onSuccess={fetchMyAuctions}
      />

    </div>
  );
};

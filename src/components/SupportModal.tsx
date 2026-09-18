import React, { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { X, LifeBuoy, Send, CheckCircle2 } from "lucide-react";

interface SupportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SupportModal: React.FC<SupportModalProps> = ({ isOpen, onClose }) => {
  const { token } = useAuth();
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [priority, setPriority] = useState("NORMAL");
  const [isSending, setIsSending] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setIsSending(true);

    try {
      const res = await fetch("/api/support/tickets", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ subject, message, priority }),
      });
      const data = await res.json();
      setIsSending(false);
      if (data.success) {
        setSubmitted(true);
        setTimeout(() => {
          setSubmitted(false);
          setSubject("");
          setMessage("");
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
          <div className="flex items-center gap-2">
            <LifeBuoy className="h-5 w-5 text-sky-600" />
            <h3 className="text-base font-extrabold text-slate-900">Customer Support Desk</h3>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-slate-600 transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        {submitted ? (
          <div className="py-8 text-center space-y-2">
            <CheckCircle2 className="h-10 w-10 text-sky-600 mx-auto" />
            <h4 className="text-sm font-extrabold text-slate-900">Ticket Dispatched!</h4>
            <p className="text-xs text-slate-500">Our engineering and dispute team will respond shortly.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3 text-xs">
            <div>
              <label className="text-slate-600 font-medium block mb-1">Issue Topic</label>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                required
                placeholder="e.g. Wallet top-up query, Outbid latency inquiry"
                className="w-full rounded-xl bg-slate-50 border border-slate-200 px-3 py-2 text-slate-900 focus:outline-none focus:border-sky-500 focus:bg-white transition-colors"
              />
            </div>

            <div>
              <label className="text-slate-600 font-medium block mb-1">Priority</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                className="w-full rounded-xl bg-slate-50 border border-slate-200 px-3 py-2 text-slate-900 focus:outline-none focus:border-sky-500 focus:bg-white transition-colors"
              >
                <option value="LOW">Low - General Question</option>
                <option value="NORMAL">Normal - Standard Query</option>
                <option value="HIGH">High - Transactional or Bid Conflict</option>
              </select>
            </div>

            <div>
              <label className="text-slate-600 font-medium block mb-1">Description</label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                required
                rows={4}
                placeholder="Provide transaction IDs or specific timestamps..."
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
                className="px-5 py-2 rounded-xl bg-sky-500 hover:bg-sky-600 text-white font-bold flex items-center gap-1.5 disabled:opacity-50 shadow-xs transition-colors"
              >
                <Send className="h-3.5 w-3.5" />
                {isSending ? "Submitting..." : "Submit Ticket"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

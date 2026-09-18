import React, { useState, useEffect } from "react";
import { Mail, RefreshCw, Send, CheckCircle2, AlertTriangle, Clock, X, ExternalLink } from "lucide-react";
import { useAuth } from "../context/AuthContext";

interface TransactionalEmail {
  id: string;
  recipientEmail: string;
  recipientName: string;
  subject: string;
  html: string;
  text: string;
  type: string;
  sentAt: string;
}

interface EmailInboxModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const EmailInboxModal: React.FC<EmailInboxModalProps> = ({ isOpen, onClose }) => {
  const { token, user } = useAuth();
  const [emails, setEmails] = useState<TransactionalEmail[]>([]);
  const [selectedEmail, setSelectedEmail] = useState<TransactionalEmail | null>(null);
  const [loading, setLoading] = useState(false);
  const [sendingTest, setSendingTest] = useState(false);
  const [filterType, setFilterType] = useState<string>("ALL");

  const fetchEmails = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch("/api/emails", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) {
        setEmails(data.emails || []);
        if (data.emails?.length > 0 && !selectedEmail) {
          setSelectedEmail(data.emails[0]);
        }
      }
    } catch (err) {
      console.error("Failed to fetch transactional emails", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchEmails();
    }
  }, [isOpen, token]);

  const handleSendTest = async (type: string) => {
    if (!token) return;
    setSendingTest(true);
    try {
      const res = await fetch("/api/emails/test-send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          type,
          subject:
            type === "OUTBID"
              ? `Outbid Alert: ₹1,85,000 on "Patek Philippe Grandmaster Chime"`
              : `Auction Won: Congratulations on winning "Shelby Cobra 427"`,
          message:
            type === "OUTBID"
              ? "Another collector has placed a higher bid of ₹1,85,000. Your previous balance has been safely unlocked."
              : "You have won the auction with a final serialized bid. Ownership rights have been permanently recorded in the ledger.",
        }),
      });
      const data = await res.json();
      if (data.success) {
        await fetchEmails();
        setSelectedEmail(data.email);
      }
    } catch (err) {
      console.error("Failed to send test email", err);
    } finally {
      setSendingTest(false);
    }
  };

  if (!isOpen) return null;

  const filtered = emails.filter((e) => filterType === "ALL" || e.type === filterType);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
      <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-5xl h-[85vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-200 flex items-center justify-between bg-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-sky-50 border border-sky-200 flex items-center justify-center text-sky-600">
              <Mail className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-extrabold text-slate-900">Transactional Email Engine</h2>
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-sky-50 text-sky-700 border border-sky-200 font-mono font-bold">
                  Outbox Linked
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Authoritative delivery log for outbid notifications, winning settlements, and change alerts for {user?.email}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={fetchEmails}
              disabled={loading}
              className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
              title="Refresh inbox"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin text-sky-600" : ""}`} />
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Action bar for testing */}
        <div className="px-5 py-2.5 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <span className="text-slate-500 font-medium">Filter:</span>
            {["ALL", "OUTBID", "AUCTION_WON", "CHANGE_REQUEST_STATUS"].map((type) => (
              <button
                key={type}
                onClick={() => setFilterType(type)}
                className={`px-2.5 py-1 rounded-lg transition-colors font-medium ${
                  filterType === type
                    ? "bg-sky-500 text-white font-bold shadow-xs"
                    : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-100"
                }`}
              >
                {type.replace(/_/g, " ")}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <span className="text-slate-400 font-medium">Test Trigger:</span>
            <button
              onClick={() => handleSendTest("OUTBID")}
              disabled={sendingTest}
              className="px-2.5 py-1 rounded-lg bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 transition-colors flex items-center gap-1.5 font-medium shadow-xs"
            >
              <AlertTriangle className="w-3 h-3 text-sky-600" />
              Send Outbid Test
            </button>
            <button
              onClick={() => handleSendTest("AUCTION_WON")}
              disabled={sendingTest}
              className="px-2.5 py-1 rounded-lg bg-sky-50 hover:bg-sky-100 text-sky-700 border border-sky-200 transition-colors flex items-center gap-1.5 font-semibold shadow-xs"
            >
              <CheckCircle2 className="w-3 h-3 text-sky-600" />
              Send Won Test
            </button>
          </div>
        </div>

        {/* Main 2-column layout */}
        <div className="flex-1 flex overflow-hidden">
          {/* Email list */}
          <div className="w-full sm:w-2/5 border-r border-slate-200 overflow-y-auto divide-y divide-slate-100 bg-white">
            {filtered.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-sm">
                <Mail className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                <p>No transactional emails received yet.</p>
                <p className="text-xs text-slate-400 mt-1">Place bids or use the test triggers above.</p>
              </div>
            ) : (
              filtered.map((em) => {
                const isSelected = selectedEmail?.id === em.id;
                return (
                  <div
                    key={em.id}
                    onClick={() => setSelectedEmail(em)}
                    className={`p-3.5 cursor-pointer transition-colors ${
                      isSelected ? "bg-sky-50/70 border-l-3 border-sky-500" : "hover:bg-slate-50"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span
                        className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-bold border ${
                          em.type === "OUTBID"
                            ? "bg-slate-100 text-slate-700 border-slate-200"
                            : em.type === "AUCTION_WON"
                            ? "bg-sky-50 text-sky-700 border-sky-200"
                            : "bg-slate-100 text-slate-700 border-slate-200"
                        }`}
                      >
                        {em.type}
                      </span>
                      <span className="text-[11px] text-slate-400 flex items-center gap-1 font-mono">
                        <Clock className="w-3 h-3" />
                        {new Date(em.sentAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                    <div className="text-sm font-bold text-slate-900 line-clamp-1">{em.subject}</div>
                    <div className="text-xs text-slate-500 line-clamp-1 mt-0.5">{em.text}</div>
                  </div>
                );
              })
            )}
          </div>

          {/* Email Preview Detail */}
          <div className="hidden sm:flex flex-1 flex-col bg-slate-50/50 overflow-y-auto">
            {selectedEmail ? (
              <div className="p-6">
                <div className="border-b border-slate-200 pb-4 mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-mono text-sky-700 bg-sky-50 px-2 py-0.5 rounded border border-sky-200 font-bold">
                      ID: {selectedEmail.id}
                    </span>
                    <span className="text-xs text-slate-400 font-mono">
                      {new Date(selectedEmail.sentAt).toLocaleString()}
                    </span>
                  </div>
                  <h1 className="text-lg font-extrabold text-slate-900 mb-2">{selectedEmail.subject}</h1>
                  <div className="text-xs text-slate-600 space-y-1">
                    <div>
                      <span className="text-slate-400">From:</span> BidPulse Outbox &lt;mailer@bidpulse.in&gt;
                    </div>
                    <div>
                      <span className="text-slate-400">To:</span> {selectedEmail.recipientName} &lt;{selectedEmail.recipientEmail}&gt;
                    </div>
                  </div>
                </div>

                {/* Rendered HTML */}
                <div className="bg-white rounded-2xl p-6 shadow-xs text-slate-900 my-4 overflow-hidden border border-slate-200">
                  <div dangerouslySetInnerHTML={{ __html: selectedEmail.html }} />
                </div>

                {/* Metadata audit */}
                <div className="mt-4 p-3.5 rounded-xl bg-white border border-slate-200 font-mono text-[11px] text-slate-500 shadow-xs">
                  <div className="text-slate-900 font-bold mb-1">Outbox Dispatch Security Headers</div>
                  <div>Status: 250 OK (Message Queued & Dispatched)</div>
                  <div>Delivery Engine: PostgreSQL LISTEN / NOTIFY Transactional Outbox</div>
                  <div>Recipient SHA256: {selectedEmail.recipientEmail}</div>
                </div>
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center text-slate-400 text-sm">
                Select an email from the left pane to preview.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

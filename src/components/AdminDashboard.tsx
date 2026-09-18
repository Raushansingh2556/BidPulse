import React, { useState, useEffect } from "react";
import { Auction } from "../types";
import { useAuth } from "../context/AuthContext";
import {
  Shield,
  Activity,
  Users,
  AlertTriangle,
  Play,
  Pause,
  StopCircle,
  CheckCircle,
  FileText,
  DollarSign,
  Layers,
  Search,
} from "lucide-react";

interface AdminDashboardProps {
  auctions: Auction[];
  onRefreshAuctions: () => void;
  onNavigateToStress: () => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  auctions,
  onRefreshAuctions,
  onNavigateToStress,
}) => {
  const { token } = useAuth();
  const [metrics, setMetrics] = useState<any>(null);
  const [usersList, setUsersList] = useState<any[]>([]);
  const [reports, setReports] = useState<any[]>([]);
  const [changeRequests, setChangeRequests] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<"auctions" | "users" | "reports" | "change-requests">("auctions");
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);

  const fetchAdminData = async () => {
    if (!token) return;
    try {
      const [metRes, usrRes, repRes, crRes] = await Promise.all([
        fetch("/api/admin/metrics", { headers: { Authorization: `Bearer ${token}` } }),
        fetch("/api/admin/users", { headers: { Authorization: `Bearer ${token}` } }),
        fetch("/api/admin/reports", { headers: { Authorization: `Bearer ${token}` } }),
        fetch("/api/admin/change-requests", { headers: { Authorization: `Bearer ${token}` } }),
      ]);

      const [metData, usrData, repData, crData] = await Promise.all([
        metRes.json(),
        usrRes.json(),
        repRes.json(),
        crRes.json(),
      ]);

      if (metData.success) setMetrics(metData.metrics);
      if (usrData.success) setUsersList(usrData.users);
      if (repData.success) setReports(repData.reports);
      if (crData.success) setChangeRequests(crData.changeRequests);
    } catch (err) {
      console.error("Failed to load admin data:", err);
    }
  };

  useEffect(() => {
    fetchAdminData();
    const interval = setInterval(fetchAdminData, 8000);
    return () => clearInterval(interval);
  }, [token]);

  const handleEmergencyAction = async (auctionId: string, action: "PAUSE" | "RESUME" | "END" | "CANCEL") => {
    if (!token) return;
    try {
      const res = await fetch(`/api/auctions/${auctionId}/emergency`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ action, reason: "Admin console emergency intervention" }),
      });
      const data = await res.json();
      if (data.success) {
        setActionFeedback(`Auction ${auctionId}: ${action} executed successfully`);
        setTimeout(() => setActionFeedback(null), 3000);
        onRefreshAuctions();
        fetchAdminData();
      }
    } catch (err) {
      console.error("Emergency action failed:", err);
    }
  };

  const handleToggleHostAuth = async (userId: string, currentStatus: boolean) => {
    if (!token) return;
    try {
      const res = await fetch("/api/admin/hosts/authorize", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ userId, authorize: !currentStatus }),
      });
      const data = await res.json();
      if (data.success) {
        fetchAdminData();
      }
    } catch (err) {
      console.error("Host authorization failed:", err);
    }
  };

  const handleReviewChangeRequest = async (id: string, action: "APPROVE" | "REJECT") => {
    if (!token) return;
    try {
      const res = await fetch(`/api/admin/change-requests/${id}/review`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ action, adminNotes: `Reviewed and ${action.toLowerCase()}d via Admin Console` }),
      });
      const data = await res.json();
      if (data.success) {
        setActionFeedback(`Change request #${id} ${action.toLowerCase()}d successfully`);
        fetchAdminData();
        onRefreshAuctions();
      }
    } catch (err) {
      console.error("Failed to review change request:", err);
    }
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 text-slate-900">
      
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-200">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-sky-50 border border-sky-200 text-sky-600 shadow-xs">
            <Shield className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl font-extrabold tracking-tight text-slate-900 flex items-center gap-2">
              Governance & Emergency Command
            </h1>
            <p className="text-xs text-slate-500">
              High-privilege platform administrative terminal &bull; Host licensing &bull; System health
            </p>
          </div>
        </div>

        <button
          onClick={onNavigateToStress}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-sky-500 hover:bg-sky-600 active:bg-sky-700 text-white text-xs font-bold transition-all self-start sm:self-auto shadow-xs"
        >
          <Activity className="h-4 w-4" />
          <span>Launch Stress Testing Console</span>
        </button>
      </div>

      {/* Platform Telemetry Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mt-6">
        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs">
          <span className="text-[11px] text-slate-500 font-medium uppercase tracking-wider block">Registered Users</span>
          <span className="text-xl font-black text-slate-900">{metrics?.totalUsers || 0}</span>
          <span className="text-[10px] text-slate-400 block mt-0.5">Accounts in DB</span>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs">
          <span className="text-[11px] text-slate-500 font-medium uppercase tracking-wider block">Live Floor Listings</span>
          <span className="text-xl font-black text-sky-600">{metrics?.liveAuctions || 0}</span>
          <span className="text-[10px] text-slate-400 block mt-0.5">Active bidding</span>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs">
          <span className="text-[11px] text-slate-500 font-medium uppercase tracking-wider block">Total Bids Processed</span>
          <span className="text-xl font-black text-slate-900">{metrics?.totalBids || 0}</span>
          <span className="text-[10px] text-slate-400 block mt-0.5">Committed rows</span>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs">
          <span className="text-[11px] text-slate-500 font-medium uppercase tracking-wider block">Host Sub Revenue</span>
          <span className="text-xl font-black text-sky-600">
            ₹{Number(metrics?.platformRevenue || 0).toLocaleString("en-IN")}
          </span>
          <span className="text-[10px] text-slate-400 block mt-0.5">Platform earnings</span>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs">
          <span className="text-[11px] text-slate-500 font-medium uppercase tracking-wider block">Realtime Sockets</span>
          <span className="text-xl font-black text-slate-800">{metrics?.connectedSockets || 0}</span>
          <span className="text-[10px] text-slate-400 block mt-0.5">Active subscribers</span>
        </div>
      </div>

      {actionFeedback && (
        <div className="mt-4 p-3 rounded-xl bg-sky-50 border border-sky-200 text-sky-800 text-xs flex items-center gap-2">
          <CheckCircle className="h-4 w-4 text-sky-600" />
          <span>{actionFeedback}</span>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 border-b border-slate-200 mt-6 pb-2">
        <button
          onClick={() => setActiveTab("auctions")}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors ${
            activeTab === "auctions"
              ? "bg-sky-50 text-sky-700 border border-sky-300"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          Emergency Auction Controls ({auctions.length})
        </button>

        <button
          onClick={() => setActiveTab("users")}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors ${
            activeTab === "users"
              ? "bg-sky-50 text-sky-700 border border-sky-300"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          User & Host Authorization ({usersList.length})
        </button>

        <button
          onClick={() => setActiveTab("reports")}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors ${
            activeTab === "reports"
              ? "bg-sky-50 text-sky-700 border border-sky-300"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          Compliance Reports ({reports.length})
        </button>

        <button
          onClick={() => setActiveTab("change-requests")}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors ${
            activeTab === "change-requests"
              ? "bg-sky-50 text-sky-700 border border-sky-300"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          Pre-Start Change Requests ({changeRequests.filter((c) => c.status === "PENDING").length})
        </button>
      </div>

      {/* Tab Content: Auctions */}
      {activeTab === "auctions" && (
        <div className="mt-4 rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase text-[10px] font-semibold">
                <tr>
                  <th className="p-3.5">Auction Item</th>
                  <th className="p-3.5">Status</th>
                  <th className="p-3.5">Starting</th>
                  <th className="p-3.5">Current Highest</th>
                  <th className="p-3.5">Bids</th>
                  <th className="p-3.5 text-right">Emergency Controls</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {auctions.map((auc) => (
                  <tr key={auc.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="p-3.5 font-bold text-slate-900 max-w-xs truncate">
                      {auc.title}
                    </td>
                    <td className="p-3.5">
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                        auc.status === "LIVE"
                          ? "bg-sky-50 text-sky-700 border-sky-200"
                          : auc.status === "PAUSED"
                          ? "bg-slate-100 text-slate-700 border-slate-300 font-bold"
                          : "bg-slate-100 text-slate-600 border-slate-200"
                      }`}>
                        {auc.status}
                      </span>
                    </td>
                    <td className="p-3.5 text-slate-600">₹{Number(auc.starting_price).toLocaleString("en-IN")}</td>
                    <td className="p-3.5 font-bold text-sky-600">₹{Number(auc.current_highest_bid).toLocaleString("en-IN")}</td>
                    <td className="p-3.5 text-slate-500">{auc.total_bids_count}</td>
                    <td className="p-3.5 text-right space-x-1.5">
                      {auc.status === "LIVE" && (
                        <button
                          onClick={() => handleEmergencyAction(auc.id, "PAUSE")}
                          className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-semibold transition-colors"
                          title="Pause bidding floor"
                        >
                          Pause
                        </button>
                      )}
                      {auc.status === "PAUSED" && (
                        <button
                          onClick={() => handleEmergencyAction(auc.id, "RESUME")}
                          className="px-2.5 py-1 rounded-lg bg-sky-50 hover:bg-sky-100 text-sky-700 border border-sky-200 text-[11px] font-semibold transition-colors"
                          title="Resume bidding floor"
                        >
                          Resume
                        </button>
                      )}
                      {auc.status !== "ENDED" && (
                        <button
                          onClick={() => handleEmergencyAction(auc.id, "END")}
                          className="px-2.5 py-1 rounded-lg bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 text-[11px] font-semibold transition-colors"
                          title="Force finalize & settle"
                        >
                          Force End & Settle
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab Content: Users */}
      {activeTab === "users" && (
        <div className="mt-4 rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase text-[10px] font-semibold">
                <tr>
                  <th className="p-3.5">User</th>
                  <th className="p-3.5">Email</th>
                  <th className="p-3.5">System Role</th>
                  <th className="p-3.5">Available Balance</th>
                  <th className="p-3.5">Host Privileges</th>
                  <th className="p-3.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {usersList.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="p-3.5 font-bold text-slate-900">{u.name}</td>
                    <td className="p-3.5 text-slate-500">{u.email}</td>
                    <td className="p-3.5">
                      <span className="px-2.5 py-0.5 rounded-full bg-slate-100 text-[10px] text-slate-700 font-bold border border-slate-200">
                        {u.role}
                      </span>
                    </td>
                    <td className="p-3.5 font-bold text-slate-900">
                      ₹{Number(u.available_balance || 0).toLocaleString("en-IN")}
                    </td>
                    <td className="p-3.5">
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                        u.is_authorized_host
                          ? "bg-sky-50 text-sky-700 border-sky-200"
                          : "bg-slate-100 text-slate-500 border-slate-200"
                      }`}>
                        {u.is_authorized_host ? "AUTHORIZED" : "REVOKED"}
                      </span>
                    </td>
                    <td className="p-3.5 text-right">
                      <button
                        onClick={() => handleToggleHostAuth(u.id, Boolean(u.is_authorized_host))}
                        className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-semibold transition-colors"
                      >
                        {u.is_authorized_host ? "Revoke Authorization" : "Grant Authorization"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab Content: Reports */}
      {activeTab === "reports" && (
        <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
          {reports.length === 0 ? (
            <p className="text-xs text-slate-400 text-center py-8">
              No compliance or suspicious behavior reports filed.
            </p>
          ) : (
            <div className="space-y-2">
              {reports.map((r) => (
                <div
                  key={r.id}
                  className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs flex justify-between items-center"
                >
                  <div>
                    <span className="font-bold text-slate-900">
                      [{r.target_type}] {r.reason}
                    </span>
                    <p className="text-[11px] text-slate-500 mt-0.5">{r.description}</p>
                    <span className="text-[10px] text-slate-400">Reported by {r.reporter_name}</span>
                  </div>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-sky-50 text-sky-700 border border-sky-200">
                    {r.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab Content: Change Requests */}
      {activeTab === "change-requests" && (
        <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
          {changeRequests.length === 0 ? (
            <p className="text-xs text-slate-400 text-center py-8">
              No pre-start auction modification requests pending.
            </p>
          ) : (
            <div className="space-y-3">
              {changeRequests.map((cr) => (
                <div
                  key={cr.id}
                  className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-3"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 pb-2">
                    <div>
                      <span className="font-mono text-[10px] text-sky-700 font-bold bg-sky-50 px-2 py-0.5 rounded border border-sky-200 mr-2">
                        {cr.id}
                      </span>
                      <span className="font-extrabold text-slate-900 text-sm">
                        {cr.current_title}
                      </span>
                      <span className="text-slate-500 text-[11px] ml-2">
                        (Host: {cr.host_name} &bull; {cr.host_email})
                      </span>
                    </div>

                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold self-start sm:self-auto border ${
                        cr.status === "APPROVED"
                          ? "bg-sky-50 text-sky-700 border-sky-200"
                          : cr.status === "REJECTED"
                          ? "bg-red-50 text-red-600 border-red-200"
                          : "bg-sky-100 text-sky-800 border-sky-300 animate-pulse"
                      }`}
                    >
                      {cr.status}
                    </span>
                  </div>

                  {/* Proposed Modifications Comparison */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 p-3 rounded-lg bg-white border border-slate-200 text-[11px]">
                    <div>
                      <span className="text-slate-400 block text-[9px] uppercase tracking-wider">Starting Price</span>
                      <span className="text-slate-400 line-through mr-1">
                        ₹{parseFloat(cr.current_starting_price).toLocaleString("en-IN")}
                      </span>
                      {cr.proposed_starting_price ? (
                        <span className="text-sky-600 font-bold">
                          &rarr; ₹{parseFloat(cr.proposed_starting_price).toLocaleString("en-IN")}
                        </span>
                      ) : (
                        <span className="text-slate-400 italic">No change</span>
                      )}
                    </div>

                    <div>
                      <span className="text-slate-400 block text-[9px] uppercase tracking-wider">Min Increment</span>
                      {cr.proposed_min_increment ? (
                        <span className="text-sky-600 font-bold">
                          ₹{parseFloat(cr.proposed_min_increment).toLocaleString("en-IN")}
                        </span>
                      ) : (
                        <span className="text-slate-400 italic">No change</span>
                      )}
                    </div>

                    <div>
                      <span className="text-slate-400 block text-[9px] uppercase tracking-wider">Proposed Title</span>
                      <span className="text-slate-800 font-medium">
                        {cr.proposed_title || <em className="text-slate-400">Unchanged</em>}
                      </span>
                    </div>
                  </div>

                  <div>
                    <span className="text-slate-500 text-[10px] block font-medium">Host's Stated Reason:</span>
                    <p className="text-slate-700 italic mt-0.5">{cr.reason}</p>
                  </div>

                  {/* Review Actions if Pending */}
                  {cr.status === "PENDING" && (
                    <div className="pt-2 border-t border-slate-200 flex items-center justify-end gap-2">
                      <button
                        onClick={() => handleReviewChangeRequest(cr.id, "REJECT")}
                        className="px-3 py-1.5 rounded-xl bg-white hover:bg-slate-100 text-red-600 border border-slate-200 text-xs font-semibold transition-colors"
                      >
                        Reject Change
                      </button>
                      <button
                        onClick={() => handleReviewChangeRequest(cr.id, "APPROVE")}
                        className="px-4 py-1.5 rounded-xl bg-sky-500 hover:bg-sky-600 text-white text-xs font-bold transition-colors shadow-xs"
                      >
                        Approve & Apply to Auction
                      </button>
                    </div>
                  )}

                  {cr.admin_notes && (
                    <div className="text-[11px] text-slate-500 bg-white p-2.5 rounded border border-slate-200">
                      <span className="text-slate-400">Admin Review Notes:</span> {cr.admin_notes}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

    </div>
  );
};

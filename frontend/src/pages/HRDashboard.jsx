import ProfileMenu from "../components/ProfileMenu.jsx";
import { useEffect, useMemo, useState } from "react";
import { fetchRequests, updateStatus } from "../api.js";
import StatusBadge, { PriorityBadge } from "../components/StatusBadge.jsx";

const FILTERS = ["All", "Pending", "Approved", "Rejected"];

export default function HRDashboard() {
  const [requests, setRequests] = useState([]);
  const [filter, setFilter] = useState("All");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    const load = () => {
      fetchRequests()
        .then((data) => {
          if (!cancelled) {
            setRequests(data);
            setLoading(false);
          }
        })
        .catch((err) => !cancelled && setError(err.message));
    };
    load();
    const interval = setInterval(load, 5000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  const filtered = useMemo(
    () => (filter === "All" ? requests : requests.filter((r) => r.status === filter)),
    [requests, filter]
  );

  const counts = useMemo(() => {
    const c = { All: requests.length, Pending: 0, Approved: 0, Rejected: 0 };
    requests.forEach((r) => (c[r.status] = (c[r.status] || 0) + 1));
    return c;
  }, [requests]);

  async function handleStatusChange(id, status) {
    setBusyId(id);
    try {
      const updated = await updateStatus(id, status);
      setRequests((prev) => prev.map((r) => (r.id === id ? updated : r)));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  }

  return (
  <div>
    <div className="portal-header">
      <div>
        <h1>HR Dashboard</h1>
        <p>Manage and review employee HR requests</p>
      </div>

      <ProfileMenu />
    </div>
      <div className="dashboard-header">
        <div>
          <h2 className="card-title">HR Dashboard</h2>
          <p className="card-subtitle">All submitted requests, generated automatically by the AI intake agent.</p>
        </div>
        <div className="filter-tabs">
          {FILTERS.map((f) => (
            <button key={f} className={f === filter ? "tab active" : "tab"} onClick={() => setFilter(f)}>
              {f} <span className="tab-count">{counts[f] || 0}</span>
            </button>
          ))}
        </div>
      </div>

      {error && <p className="error-text">{error}</p>}
      {loading && <p className="empty-text">Loading requests…</p>}
      {!loading && filtered.length === 0 && <p className="empty-text">No requests in this view.</p>}

      <div className="dashboard-grid">
        {filtered.map((r) => (
          <div className="request-card" key={r.id}>
            <div className="request-card-top">
              <div>
                <div className="request-id">{r.id}</div>
                <div className="request-summary">{r.summary}</div>
              </div>
              <StatusBadge status={r.status} />
            </div>

            <div className="request-card-body">
              <div className="kv">
                <span className="k">Employee</span>
                <span className="v">
                  {r.employeeName} <span className="muted">({r.employeeEmail})</span>
                </span>
              </div>
              <div className="kv">
                <span className="k">Type</span>
                <span className="v">{r.requestType}</span>
              </div>
              <div className="kv">
                <span className="k">Department</span>
                <span className="v">{r.department}</span>
              </div>
              <div className="kv">
                <span className="k">Priority</span>
                <span className="v">
                  <PriorityBadge priority={r.priority} />
                </span>
              </div>
              {(r.startDate || r.endDate) && (
                <div className="kv">
                  <span className="k">Dates</span>
                  <span className="v">
                    {r.startDate || "—"} → {r.endDate || "—"}
                  </span>
                </div>
              )}
              <div className="kv">
                <span className="k">Reason</span>
                <span className="v">{r.reason}</span>
              </div>
              <div className="kv">
                <span className="k">Submitted</span>
                <span className="v muted">{new Date(r.createdAt).toLocaleString()}</span>
              </div>
            </div>

            {r.status === "Pending" && (
              <div className="request-card-actions">
                <button
                  className="btn btn-success btn-sm"
                  disabled={busyId === r.id}
                  onClick={() => handleStatusChange(r.id, "Approved")}
                >
                  Approve
                </button>
                <button
                  className="btn btn-danger btn-sm"
                  disabled={busyId === r.id}
                  onClick={() => handleStatusChange(r.id, "Rejected")}
                >
                  Reject
                </button>
              </div>
            )}
            {r.status !== "Pending" && (
              <div className="request-card-actions">
                <button className="btn btn-ghost btn-sm" disabled={busyId === r.id} onClick={() => handleStatusChange(r.id, "Pending")}>
                  Reset to Pending
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

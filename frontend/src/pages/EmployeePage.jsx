import ProfileMenu from "../components/ProfileMenu.jsx";
import { useEffect, useState } from "react";
import { analyzeRequest, createRequest, fetchRequests } from "../api.js";
import StatusBadge, { PriorityBadge } from "../components/StatusBadge.jsx";

const REQUEST_TYPES = [
  "Leave Request",
  "Work From Home",
  "Payslip Request",
  "Document Request",
  "Expense Reimbursement",
  "Other",
];
const PRIORITIES = ["Low", "Medium", "High"];

const EXAMPLES = [
  "I need sick leave from 2026-09-22 to 2026-09-24, I have a fever and need to see a doctor.",
  "Can I work from home this Friday, my internet installer is coming and I'll be online all day?",
  "Please send me my payslip for August, I need it urgently for a loan application.",
  "I need an experience letter for a visa application, not urgent.",
];

const emptyForm = {
  requestType: "",
  department: "",
  priority: "",
  startDate: "",
  endDate: "",
  reason: "",
  summary: "",
};

export default function EmployeePage() {
  const [employeeName, setEmployeeName] = useState("");
  const [employeeEmail, setEmployeeEmail] = useState("");
  const [message, setMessage] = useState("");
  const [form, setForm] = useState(emptyForm);
  const [analyzed, setAnalyzed] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [usedFallback, setUsedFallback] = useState(false);
  const [error, setError] = useState("");
  const [lastTicket, setLastTicket] = useState(null);
  const [myRequests, setMyRequests] = useState([]);

  useEffect(() => {
    if (!employeeEmail) {
      setMyRequests([]);
      return;
    }
    let cancelled = false;
    const load = () => {
      fetchRequests(employeeEmail)
        .then((data) => !cancelled && setMyRequests(data))
        .catch(() => {});
    };
    load();
    const interval = setInterval(load, 5000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [employeeEmail, lastTicket]);

  const canAnalyze = employeeName.trim() && employeeEmail.trim() && message.trim();

  async function handleAnalyze() {
    setError("");
    setAnalyzing(true);
    setAnalyzed(false);
    try {
      const { extracted, usedFallback } = await analyzeRequest(message);
      setForm({
        requestType: extracted.requestType,
        department: extracted.department,
        priority: extracted.priority,
        startDate: extracted.startDate || "",
        endDate: extracted.endDate || "",
        reason: extracted.reason,
        summary: extracted.summary,
      });
      setUsedFallback(usedFallback);
      setAnalyzed(true);
    } catch (err) {
      setError(err.message || "AI analysis failed");
    } finally {
      setAnalyzing(false);
    }
  }

  async function handleSubmit() {
    setError("");
    setSubmitting(true);
    try {
      const ticket = await createRequest({
        employeeName,
        employeeEmail,
        message,
        ...form,
      });
      setLastTicket(ticket);
      setMessage("");
      setForm(emptyForm);
      setAnalyzed(false);
    } catch (err) {
      setError(err.message || "Could not submit request");
    } finally {
      setSubmitting(false);
    }
  }

  function updateField(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  return (
  <>
    <div className="portal-header">
      <div>
        <h1>Employee Portal</h1>
        <p>Submit and track your HR requests</p>
      </div>

      <ProfileMenu />
    </div>

    <div className="grid-2">
      <section className="card">
        <h2 className="card-title">New HR Request</h2>
        <p className="card-subtitle">
          Describe what you need in plain language. The AI agent will read it, work out the request type,
          department and priority, and pre-fill the form for you to review.
        </p>

        <div className="field-row">
          <div className="field">
            <label>Your name</label>
            <input value={employeeName} onChange={(e) => setEmployeeName(e.target.value)} placeholder="Jane Doe" />
          </div>
          <div className="field">
            <label>Your email</label>
            <input
              type="email"
              value={employeeEmail}
              onChange={(e) => setEmployeeEmail(e.target.value)}
              placeholder="jane.doe@company.com"
            />
          </div>
        </div>

        <div className="field">
          <label>Describe your request</label>
          <textarea
            rows={4}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="e.g. I need to take sick leave from Monday to Wednesday next week..."
          />
          <div className="example-chips">
            {EXAMPLES.map((ex) => (
              <button key={ex} type="button" className="chip" onClick={() => setMessage(ex)}>
                {ex.length > 46 ? ex.slice(0, 46) + "…" : ex}
              </button>
            ))}
          </div>
        </div>

        <button className="btn btn-primary" disabled={!canAnalyze || analyzing} onClick={handleAnalyze}>
          {analyzing ? "Analyzing…" : "✨ Analyze with AI"}
        </button>

        {error && <p className="error-text">{error}</p>}

        {analyzed && (
          <div className="extracted-panel">
            <div className="extracted-header">
              <h3>AI-extracted details</h3>
              {usedFallback && <span className="badge badge-info">rule-based fallback (no API key set)</span>}
              {!usedFallback && <span className="badge badge-info">Powered by Claude</span>}
            </div>
            <p className="hint-text">Review and edit any field before submitting.</p>

            <div className="field-row">
              <div className="field">
                <label>Request type</label>
                <select value={form.requestType} onChange={(e) => updateField("requestType", e.target.value)}>
                  {REQUEST_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label>Department</label>
                <input value={form.department} onChange={(e) => updateField("department", e.target.value)} />
              </div>
            </div>

            <div className="field-row">
              <div className="field">
                <label>Priority</label>
                <select value={form.priority} onChange={(e) => updateField("priority", e.target.value)}>
                  {PRIORITIES.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label>Start date</label>
                <input type="date" value={form.startDate} onChange={(e) => updateField("startDate", e.target.value)} />
              </div>
              <div className="field">
                <label>End date</label>
                <input type="date" value={form.endDate} onChange={(e) => updateField("endDate", e.target.value)} />
              </div>
            </div>

            <div className="field">
              <label>Summary</label>
              <input value={form.summary} onChange={(e) => updateField("summary", e.target.value)} />
            </div>

            <div className="field">
              <label>Reason</label>
              <textarea rows={2} value={form.reason} onChange={(e) => updateField("reason", e.target.value)} />
            </div>

            <button className="btn btn-success" disabled={submitting} onClick={handleSubmit}>
              {submitting ? "Submitting…" : "Submit Request"}
            </button>
          </div>
        )}

        {lastTicket && (
          <div className="success-panel">
            <strong>Request submitted!</strong>
            <div className="ticket-id">{lastTicket.id}</div>
            <div>
              Status: <StatusBadge status={lastTicket.status} />
            </div>
          </div>
        )}
      </section>

      <section className="card">
        <h2 className="card-title">My Requests</h2>
        <p className="card-subtitle">
          {employeeEmail ? "Live status of requests submitted with this email." : "Enter your email to see your requests."}
        </p>
        {myRequests.length === 0 && employeeEmail && <p className="empty-text">No requests yet.</p>}
        <div className="request-list">
          {myRequests.map((r) => (
            <div className="request-item" key={r.id}>
              <div className="request-item-top">
                <span className="request-id">{r.id}</span>
                <StatusBadge status={r.status} />
              </div>
              <div className="request-item-meta">
                <span>{r.requestType}</span>
                <span>·</span>
                <span>{r.department}</span>
                <span>·</span>
                <PriorityBadge priority={r.priority} />
              </div>
              <p className="request-reason">{r.reason}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
    </>
  );
}

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

function extractDatesFromText(text) {
  if (!text) return { startDate: "", endDate: "" };
  text = text.toLowerCase();
  function pad(n) { return String(n).padStart(2, "0"); }
  function formatYMD(y, m, d) { return `${y}-${pad(m)}-${pad(d)}`; }

  const monthMap = {
    january: "01", jan: "01", february: "02", feb: "02", march: "03", mar: "03",
    april: "04", apr: "04", may: "05", june: "06", jun: "06", july: "07", jul: "07",
    august: "08", aug: "08", september: "09", sep: "09", sept: "09", october: "10", oct: "10",
    november: "11", nov: "11", december: "12", dec: "12",
  };
  const monthPattern = Object.keys(monthMap).join("|");
  const currentYear = new Date().getFullYear();

  const isoRange = text.match(/(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})\s*(?:to|until|till|se|-)\s*(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})/i);
  if (isoRange) {
    return { startDate: formatYMD(isoRange[1], isoRange[2], isoRange[3]), endDate: formatYMD(isoRange[4], isoRange[5], isoRange[6]) };
  }

  const dmyRange = text.match(/(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})\s*(?:to|until|till|se|-)\s*(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})/i);
  if (dmyRange) {
    return { startDate: formatYMD(dmyRange[3], dmyRange[2], dmyRange[1]), endDate: formatYMD(dmyRange[6], dmyRange[5], dmyRange[4]) };
  }

  const dayToDayMonth = new RegExp(`(\\d{1,2})(?:st|nd|rd|th)?\\s*(?:to|until|till|se|-)\\s*(\\d{1,2})(?:st|nd|rd|th)?\\s*(${monthPattern})(?:\\s*(\\d{4}))?`, "i");
  const d2dMatch = text.match(dayToDayMonth);
  if (d2dMatch) {
    const m = monthMap[d2dMatch[3].toLowerCase()];
    const y = d2dMatch[4] || currentYear;
    return { startDate: formatYMD(y, m, d2dMatch[1]), endDate: formatYMD(y, m, d2dMatch[2]) };
  }

  const singleIso = text.match(/(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})/);
  if (singleIso) {
    const s = formatYMD(singleIso[1], singleIso[2], singleIso[3]);
    return { startDate: s, endDate: s };
  }

  const singleDmy = text.match(/(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})/);
  if (singleDmy) {
    const s = formatYMD(singleDmy[3], singleDmy[2], singleDmy[1]);
    return { startDate: s, endDate: s };
  }

  const singleNamed = new RegExp(`(\\d{1,2})(?:st|nd|rd|th)?\\s*(${monthPattern})(?:\\s*(\\d{4}))?`, "i");
  const snMatch = text.match(singleNamed);
  if (snMatch) {
    const m = monthMap[snMatch[2].toLowerCase()];
    const y = snMatch[3] || currentYear;
    const s = formatYMD(y, m, snMatch[1]);
    return { startDate: s, endDate: s };
  }

  const today = new Date();
  if (text.includes("tomorrow") || text.includes("kal") || text.includes("next day")) {
    const d = new Date(today);
    d.setDate(d.getDate() + 1);
    const s = formatYMD(d.getFullYear(), d.getMonth() + 1, d.getDate());
    return { startDate: s, endDate: s };
  }

  return { startDate: "", endDate: "" };
}

  async function handleAnalyze() {
    setError("");
    setAnalyzing(true);
    setAnalyzed(false);
    try {
      const { extracted, usedFallback } = await analyzeRequest(message);
      const fallbackDates = extractDatesFromText(message);
      const resolvedStartDate = extracted.startDate || fallbackDates.startDate || "";
      const resolvedEndDate = extracted.endDate || fallbackDates.endDate || resolvedStartDate || "";
      setForm({
        requestType: extracted.requestType,
        department: extracted.department,
        priority: extracted.priority,
        startDate: resolvedStartDate,
        endDate: resolvedEndDate,
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

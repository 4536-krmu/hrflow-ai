import express from "express";
import cors from "cors";
import crypto from "crypto";

const app = express();

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || "";
const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-5-20250929";

app.use(cors());
app.use(express.json());

// In-memory ticket storage (persists across warm serverless container invocations)
globalThis._hrRequests = globalThis._hrRequests || [];
const requests = globalThis._hrRequests;

const REQUEST_TYPES = [
  "Leave Request",
  "Work From Home",
  "Payslip Request",
  "Document Request",
  "Expense Reimbursement",
  "Other",
];

const DEPARTMENTS_BY_TYPE = {
  "Leave Request": "HR Operations",
  "Work From Home": "HR Operations",
  "Payslip Request": "Payroll & Finance",
  "Document Request": "HR Administration",
  "Expense Reimbursement": "Payroll & Finance",
  Other: "General HR",
};

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

// ---------------------------------------------------------------------------
// Claude AI Agent
// ---------------------------------------------------------------------------

async function extractWithLLM(message) {
  const system = `
You are an intelligent HR request-intake agent for an internal HR management system.

Your job is to understand an employee's natural-language request and convert it into a structured and professional HR request.

The employee may write in:
- English
- Hindi
- Hinglish
- Informal/casual language
- Short messages
- Messages containing spelling mistakes

Today's date is ${todayISO()}.

Return ONLY one valid JSON object.
Do NOT return markdown.
Do NOT return code fences.
Do NOT explain anything outside the JSON.

The JSON MUST contain exactly these fields:

{
  "requestType": "Leave Request | Work From Home | Payslip Request | Document Request | Expense Reimbursement | Other",
  "department": "HR Operations | Payroll & Finance | HR Administration | General HR | IT",
  "priority": "Low | Medium | High",
  "startDate": "YYYY-MM-DD or null",
  "endDate": "YYYY-MM-DD or null",
  "reason": "professional first-person explanation",
  "summary": "short professional request title"
}

IMPORTANT RULES:
1. Understand English, Hindi and Hinglish.
2. Identify the actual purpose of the employee's request.
3. Convert informal messages into professional HR language.
4. NEVER simply copy the employee's original message into "reason".
5. The "reason" must be written in FIRST PERSON as if the employee is submitting the request.
6. Keep the reason professional and natural.
7. Extract dates accurately. Convert dates into YYYY-MM-DD format.
8. If a single date is mentioned for a one-day request, use the SAME date for startDate and endDate.
9. If a date range is mentioned: first date = startDate, last date = endDate.
10. If no date is mentioned, use null for startDate and endDate.
11. Urgent, emergency, ASAP, critical, hospital or serious medical requests should normally have High priority.
12. Return ONLY valid JSON.
`;

  if (!ANTHROPIC_API_KEY) {
    return null;
  }

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        ...(process.env.ANTHROPIC_WORKSPACE_ID
          ? { "anthropic-workspace-id": process.env.ANTHROPIC_WORKSPACE_ID }
          : {}),
      },
      body: JSON.stringify({
        model: ANTHROPIC_MODEL,
        max_tokens: 700,
        temperature: 0,
        system,
        messages: [{ role: "user", content: message }],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Anthropic API error:", response.status, errorText);
      return null;
    }

    const data = await response.json();
    const textBlock = (data.content || []).find((block) => block.type === "text");

    if (!textBlock) return null;

    let cleaned = textBlock.text
      .trim()
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();

    const parsed = JSON.parse(cleaned);
    return normalizeExtraction(parsed);
  } catch (error) {
    console.error("Claude AI extraction failed:", error.message);
    return null;
  }
}

function normalizeExtraction(raw) {
  const requestType = REQUEST_TYPES.includes(raw.requestType)
    ? raw.requestType
    : "Other";

  const priority = ["Low", "Medium", "High"].includes(raw.priority)
    ? raw.priority
    : "Medium";

  const department = raw.department || DEPARTMENTS_BY_TYPE[requestType] || "General HR";

  return {
    requestType,
    department,
    priority,
    startDate: raw.startDate || null,
    endDate: raw.endDate || null,
    reason: raw.reason || "",
    summary: raw.summary || requestType,
  };
}

// ---------------------------------------------------------------------------
// Fallback Extractor (rule-based if API key is not configured)
// ---------------------------------------------------------------------------

function fallbackExtract(message) {
  const text = message.toLowerCase().trim();

  let requestType = "Other";
  let department = "HR Operations";
  let priority = "Medium";
  let startDate = null;
  let endDate = null;
  let reason = message.trim();
  let summary = "HR Request";

  if (
    text.includes("leave") ||
    text.includes("chutti") ||
    text.includes("holiday")
  ) {
    requestType = "Leave Request";
  } else if (
    text.includes("salary") ||
    text.includes("payroll") ||
    text.includes("payslip")
  ) {
    requestType = "Payslip Request";
    department = "Payroll & Finance";
  } else if (
    text.includes("work from home") ||
    text.includes("wfh") ||
    text.includes("remote")
  ) {
    requestType = "Work From Home";
  } else if (
    text.includes("certificate") ||
    text.includes("experience letter") ||
    text.includes("noc") ||
    text.includes("document")
  ) {
    requestType = "Document Request";
    department = "HR Administration";
  } else if (
    text.includes("reimburse") ||
    text.includes("expense") ||
    text.includes("bill")
  ) {
    requestType = "Expense Reimbursement";
    department = "Payroll & Finance";
  }

  if (
    text.includes("urgent") ||
    text.includes("urgently") ||
    text.includes("asap") ||
    text.includes("immediately") ||
    text.includes("emergency")
  ) {
    priority = "High";
  } else if (text.includes("low priority") || text.includes("not urgent")) {
    priority = "Low";
  }

  // DD/MM/YYYY or DD-MM-YYYY
  const fullDateMatch = text.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
  if (fullDateMatch) {
    const day = fullDateMatch[1].padStart(2, "0");
    const month = fullDateMatch[2].padStart(2, "0");
    const year = fullDateMatch[3];
    startDate = `${year}-${month}-${day}`;
  }

  const monthMap = {
    january: "01", jan: "01",
    february: "02", feb: "02",
    march: "03", mar: "03",
    april: "04", apr: "04",
    may: "05",
    june: "06", jun: "06",
    july: "07", jul: "07",
    august: "08", aug: "08",
    september: "09", sep: "09", sept: "09",
    october: "10", oct: "10",
    november: "11", nov: "11",
    december: "12", dec: "12",
  };

  const monthPattern = Object.keys(monthMap).join("|");
  const monthDateRegex = new RegExp(`(\\d{1,2})\\s*(${monthPattern})(?:\\s*(\\d{4}))?`, "i");
  const monthDateMatch = text.match(monthDateRegex);

  if (!startDate && monthDateMatch) {
    const day = monthDateMatch[1].padStart(2, "0");
    const month = monthMap[monthDateMatch[2].toLowerCase()];
    const year = monthDateMatch[3] || new Date().getFullYear();
    startDate = `${year}-${month}-${day}`;
  }

  const rangeRegex = new RegExp(
    `(\\d{1,2})\\s*(${monthPattern})(?:\\s*(\\d{4}))?\\s*(?:to|until|till|-)\\s*(\\d{1,2})\\s*(${monthPattern})(?:\\s*(\\d{4}))?`,
    "i"
  );
  const rangeMatch = text.match(rangeRegex);
  if (rangeMatch) {
    const startDay = rangeMatch[1].padStart(2, "0");
    const startMonth = monthMap[rangeMatch[2].toLowerCase()];
    const startYear = rangeMatch[3] || new Date().getFullYear();

    const endDay = rangeMatch[4].padStart(2, "0");
    const endMonth = monthMap[rangeMatch[5].toLowerCase()];
    const endYear = rangeMatch[6] || startYear;

    startDate = `${startYear}-${startMonth}-${startDay}`;
    endDate = `${endYear}-${endMonth}-${endDay}`;
  }

  if (requestType === "Leave Request") {
    summary = startDate
      ? `Leave request for ${startDate}${endDate ? ` to ${endDate}` : ""}`
      : "Leave Request";
  } else {
    summary = `${requestType} submitted by employee`;
  }

  return {
    requestType,
    department,
    priority,
    startDate,
    endDate,
    reason: message.trim(),
    summary,
  };
}

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

const router = express.Router();

router.get("/health", (req, res) => {
  res.json({
    ok: true,
    aiConfigured: Boolean(ANTHROPIC_API_KEY),
    model: ANTHROPIC_MODEL,
    mode: "single-deployment",
  });
});

router.post("/analyze", async (req, res) => {
  const { message } = req.body || {};

  if (!message || !message.trim()) {
    return res.status(400).json({ error: "message is required" });
  }

  let extracted = await extractWithLLM(message);
  let usedFallback = false;

  if (!extracted) {
    extracted = fallbackExtract(message);
    usedFallback = true;
  }

  res.json({ extracted, usedFallback });
});

router.post("/requests", (req, res) => {
  const {
    employeeName,
    employeeEmail,
    message,
    requestType,
    department,
    priority,
    startDate,
    endDate,
    reason,
    summary,
  } = req.body || {};

  if (!employeeName || !employeeEmail || !requestType || !department) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  const ticket = {
    id: "REQ-" + crypto.randomUUID().slice(0, 8).toUpperCase(),
    employeeName,
    employeeEmail,
    originalMessage: message || "",
    requestType,
    department,
    priority: priority || "Medium",
    startDate: startDate || null,
    endDate: endDate || null,
    reason: reason || "",
    summary: summary || requestType,
    status: "Pending",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  requests.unshift(ticket);
  res.status(201).json(ticket);
});

router.get("/requests", (req, res) => {
  const { email } = req.query;
  if (email) {
    return res.json(
      requests.filter(
        (request) =>
          request.employeeEmail.toLowerCase() === email.toLowerCase()
      )
    );
  }
  res.json(requests);
});

router.get("/requests/:id", (req, res) => {
  const ticket = requests.find((request) => request.id === req.params.id);
  if (!ticket) {
    return res.status(404).json({ error: "Not found" });
  }
  res.json(ticket);
});

router.patch("/requests/:id/status", (req, res) => {
  const { status } = req.body || {};
  if (!["Approved", "Rejected", "Pending"].includes(status)) {
    return res.status(400).json({ error: "Invalid status" });
  }

  const ticket = requests.find((request) => request.id === req.params.id);
  if (!ticket) {
    return res.status(404).json({ error: "Not found" });
  }

  ticket.status = status;
  ticket.updatedAt = new Date().toISOString();
  res.json(ticket);
});

// Support both `/api/...` and direct subpaths regardless of rewrite strategy
app.use("/api", router);
app.use("/", router);

export default app;

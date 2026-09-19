import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import crypto from "crypto";

dotenv.config();

const app = express();

const PORT = process.env.PORT || 5000;
const CORS_ORIGIN = process.env.CORS_ORIGIN || "http://localhost:5173";
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || "";
const ANTHROPIC_MODEL =
  process.env.ANTHROPIC_MODEL || "claude-sonnet-4-5-20250929";

app.use(cors());

app.use(express.json());

// ---------------------------------------------------------------------------
// In-memory database
// ---------------------------------------------------------------------------

const requests = [];

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

7. Extract dates accurately.

8. Convert dates into YYYY-MM-DD format.

9. Examples of dates that must be understood:
   - 25 September 2026
   - September 25, 2026
   - 25/09/2026
   - 25-09-2026
   - 25th September
   - tomorrow
   - kal
   - next Monday
   - 25 se 27 September
   - from September 25 to September 27

10. If a single date is mentioned for a one-day request, use the SAME date for startDate and endDate.

11. If a date range is mentioned:
   - first date = startDate
   - last date = endDate

12. If the user says "kal" or "tomorrow", calculate tomorrow using today's date.

13. If the user says "25 se 27 September", interpret it as September 25 to September 27 of the current year unless another year is explicitly provided.

14. If no date is mentioned, use null for startDate and endDate.

15. Leave Request normally belongs to HR Operations.

16. Work From Home normally belongs to HR Operations.

17. Payslip or salary-related requests belong to Payroll & Finance.

18. Documents, certificates, letters and NOC requests belong to HR Administration.

19. Expense reimbursement requests belong to Payroll & Finance.

20. Urgent, emergency, ASAP, critical, hospital or serious medical requests should normally have High priority.

21. Normal leave and WFH requests should normally have Medium priority.

22. "summary" should be short, clear and professional.

23. Do not use emojis.

24. Return ONLY valid JSON.
  
EXAMPLE 1:

Employee message:
"mujhe 25 september ko chutti chahiye meri sister ki shaadi hai"

Expected JSON:
{
  "requestType": "Leave Request",
  "department": "HR Operations",
  "priority": "Medium",
  "startDate": "2026-09-25",
  "endDate": "2026-09-25",
  "reason": "I would like to request leave on September 25, 2026, as I need to attend my sister's wedding.",
  "summary": "Leave Request for Sister's Wedding"
}

EXAMPLE 2:

Employee message:
"kal ghar pe plumber aa raha hai isliye wfh chahiye"

Expected JSON:
{
  "requestType": "Work From Home",
  "department": "HR Operations",
  "priority": "Medium",
  "startDate": "TOMORROW_DATE",
  "endDate": "TOMORROW_DATE",
  "reason": "I would like to request permission to work from home as a plumber is scheduled to visit my residence. I will remain available online and ensure that my work responsibilities are completed without disruption.",
  "summary": "Work From Home Request"
}

EXAMPLE 3:

Employee message:
"I need urgent leave from September 25 to September 27 because I have to undergo a medical procedure."

Expected JSON:
{
  "requestType": "Leave Request",
  "department": "HR Operations",
  "priority": "High",
  "startDate": "2026-09-25",
  "endDate": "2026-09-27",
  "reason": "I would like to request leave from September 25 to September 27, 2026, as I need to undergo a medical procedure.",
  "summary": "Medical Leave Request"
}
`;

  if (!ANTHROPIC_API_KEY) {
    return null;
  }

  try {
    const response = await fetch(
      "https://api.anthropic.com/v1/messages",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01",
          "anthropic-workspace-id": process.env.ANTHROPIC_WORKSPACE_ID,
        },
        body: JSON.stringify({
          model: ANTHROPIC_MODEL,
          max_tokens: 700,
          temperature: 0,
          system,
          messages: [
            {
              role: "user",
              content: message,
            },
          ],
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();

      console.error(
        "Anthropic API error:",
        response.status,
        errorText
      );

      throw new Error(
  `Anthropic API ${response.status}: ${errorText}`
);
    }

    const data = await response.json();

    const textBlock = (data.content || []).find(
      (block) => block.type === "text"
    );

    if (!textBlock) {
      console.error("Claude returned no text response.");
      return null;
    }

    let cleaned = textBlock.text.trim();

    // Remove markdown code fences if Claude adds them
    cleaned = cleaned
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();

    const parsed = JSON.parse(cleaned);

    return normalizeExtraction(parsed);
  } catch (error) {
    console.error(
      "Claude AI extraction failed:",
      error.message
    );

    return null;
  }
}

// ---------------------------------------------------------------------------
// Normalize AI output
// ---------------------------------------------------------------------------

function normalizeExtraction(raw) {
  const requestType = REQUEST_TYPES.includes(raw.requestType)
    ? raw.requestType
    : "Other";

  const priority = ["Low", "Medium", "High"].includes(
    raw.priority
  )
    ? raw.priority
    : "Medium";

  const department =
    raw.department ||
    DEPARTMENTS_BY_TYPE[requestType];

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
// Fallback extractor
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

  // Request type
  if (
    text.includes("leave") ||
    text.includes("chutti") ||
    text.includes(" छुट्टी") ||
    text.includes("holiday")
  ) {
    requestType = "Leave Request";
  } else if (
    text.includes("salary") ||
    text.includes("payroll") ||
    text.includes("payslip")
  ) {
    requestType = "Payroll Request";
    department = "Finance & Payroll";
  } else if (
    text.includes("work from home") ||
    text.includes("wfh") ||
    text.includes("remote")
  ) {
    requestType = "Work From Home";
  } else if (
    text.includes("attendance") ||
    text.includes("absent")
  ) {
    requestType = "Attendance Request";
  } else if (
    text.includes("certificate") ||
    text.includes("experience letter")
  ) {
    requestType = "Document Request";
  } else if (
    text.includes("complaint") ||
    text.includes("issue") ||
    text.includes("problem")
  ) {
    requestType = "HR Issue";
  }

  // Priority
  if (
    text.includes("urgent") ||
    text.includes("urgently") ||
    text.includes("asap") ||
    text.includes("immediately")
  ) {
    priority = "High";
  } else if (
    text.includes("low priority") ||
    text.includes("not urgent")
  ) {
    priority = "Low";
  }

  function pad(n) { return String(n).padStart(2, "0"); }
  function formatYMD(y, m, d) { return `${y}-${pad(m)}-${pad(d)}`; }

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
  const currentYear = new Date().getFullYear();

  // 1. ISO range: 2026-09-22 to 2026-09-24 or 2026-09-22 - 2026-09-24
  const isoRange = text.match(/(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})\s*(?:to|until|till|se|-)\s*(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})/i);
  if (isoRange) {
    startDate = formatYMD(isoRange[1], isoRange[2], isoRange[3]);
    endDate = formatYMD(isoRange[4], isoRange[5], isoRange[6]);
  }

  // 2. DMY range: 22/09/2026 to 24/09/2026 or 22-09-2026 to 24-09-2026
  if (!startDate) {
    const dmyRange = text.match(/(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})\s*(?:to|until|till|se|-)\s*(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})/i);
    if (dmyRange) {
      startDate = formatYMD(dmyRange[3], dmyRange[2], dmyRange[1]);
      endDate = formatYMD(dmyRange[6], dmyRange[5], dmyRange[4]);
    }
  }

  // 3. Named month day-to-day range: 22 to 24 september 2026 or 22-24 september
  if (!startDate) {
    const dayToDayMonth = new RegExp(`(\\d{1,2})(?:st|nd|rd|th)?\\s*(?:to|until|till|se|-)\\s*(\\d{1,2})(?:st|nd|rd|th)?\\s*(${monthPattern})(?:\\s*(\\d{4}))?`, "i");
    const d2dMatch = text.match(dayToDayMonth);
    if (d2dMatch) {
      const m = monthMap[d2dMatch[3].toLowerCase()];
      const y = d2dMatch[4] || currentYear;
      startDate = formatYMD(y, m, d2dMatch[1]);
      endDate = formatYMD(y, m, d2dMatch[2]);
    }
  }

  // 4. Full named month range: 22 september to 24 september 2026
  if (!startDate) {
    const fullMonthRange = new RegExp(`(\\d{1,2})(?:st|nd|rd|th)?\\s*(${monthPattern})(?:\\s*(\\d{4}))?\\s*(?:to|until|till|se|-)\\s*(\\d{1,2})(?:st|nd|rd|th)?\\s*(${monthPattern})(?:\\s*(\\d{4}))?`, "i");
    const fmrMatch = text.match(fullMonthRange);
    if (fmrMatch) {
      const sy = fmrMatch[3] || fmrMatch[6] || currentYear;
      const sm = monthMap[fmrMatch[2].toLowerCase()];
      const ey = fmrMatch[6] || sy;
      const em = monthMap[fmrMatch[5].toLowerCase()];
      startDate = formatYMD(sy, sm, fmrMatch[1]);
      endDate = formatYMD(ey, em, fmrMatch[4]);
    }
  }

  // 5. Month-first range: september 22 to 24 or september 22 to september 24
  if (!startDate) {
    const monthFirstRange = new RegExp(`(${monthPattern})\\s*(\\d{1,2})(?:st|nd|rd|th)?(?:\\s*,?\\s*(\\d{4}))?\\s*(?:to|until|till|se|-)\\s*(?:(${monthPattern})\\s*)?(\\d{1,2})(?:st|nd|rd|th)?(?:\\s*,?\\s*(\\d{4}))?`, "i");
    const mfrMatch = text.match(monthFirstRange);
    if (mfrMatch) {
      const sm = monthMap[mfrMatch[1].toLowerCase()];
      const em = mfrMatch[4] ? monthMap[mfrMatch[4].toLowerCase()] : sm;
      const y = mfrMatch[6] || mfrMatch[3] || currentYear;
      startDate = formatYMD(y, sm, mfrMatch[2]);
      endDate = formatYMD(y, em, mfrMatch[5]);
    }
  }

  // 6. Single ISO: 2026-09-22
  if (!startDate) {
    const singleIso = text.match(/(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})/);
    if (singleIso) {
      startDate = formatYMD(singleIso[1], singleIso[2], singleIso[3]);
      endDate = startDate;
    }
  }

  // 7. Single DMY: 22/09/2026 or 22-09-2026
  if (!startDate) {
    const singleDmy = text.match(/(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})/);
    if (singleDmy) {
      startDate = formatYMD(singleDmy[3], singleDmy[2], singleDmy[1]);
      endDate = startDate;
    }
  }

  // 8. Single named: 25 september or september 25
  if (!startDate) {
    const singleNamed1 = new RegExp(`(\\d{1,2})(?:st|nd|rd|th)?\\s*(${monthPattern})(?:\\s*(\\d{4}))?`, "i");
    const sn1Match = text.match(singleNamed1);
    if (sn1Match) {
      const m = monthMap[sn1Match[2].toLowerCase()];
      const y = sn1Match[3] || currentYear;
      startDate = formatYMD(y, m, sn1Match[1]);
      endDate = startDate;
    }
  }

  if (!startDate) {
    const singleNamed2 = new RegExp(`(${monthPattern})\\s*(\\d{1,2})(?:st|nd|rd|th)?(?:\\s*,?\\s*(\\d{4}))?`, "i");
    const sn2Match = text.match(singleNamed2);
    if (sn2Match) {
      const m = monthMap[sn2Match[1].toLowerCase()];
      const y = sn2Match[3] || currentYear;
      startDate = formatYMD(y, m, sn2Match[2]);
      endDate = startDate;
    }
  }

  // 9. Relative days: tomorrow, kal, today
  if (!startDate) {
    const today = new Date();
    if (text.includes("tomorrow") || text.includes("kal") || text.includes("next day")) {
      const d = new Date(today);
      d.setDate(d.getDate() + 1);
      startDate = formatYMD(d.getFullYear(), d.getMonth() + 1, d.getDate());
      endDate = startDate;
    } else if (text.includes("today") || text.includes("aaj")) {
      startDate = formatYMD(today.getFullYear(), today.getMonth() + 1, today.getDate());
      endDate = startDate;
    }
  }

  // 10. Days of week: 'this friday', 'next monday', etc.
  if (!startDate) {
    const today = new Date();
    const daysOfWeek = { sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6 };
    for (const [dayName, targetDay] of Object.entries(daysOfWeek)) {
      if (text.includes(dayName)) {
        const d = new Date(today);
        const currentDay = d.getDay();
        let diff = targetDay - currentDay;
        if (diff <= 0) diff += 7;
        if (text.includes("next " + dayName)) diff += 7;
        d.setDate(d.getDate() + diff);
        startDate = formatYMD(d.getFullYear(), d.getMonth() + 1, d.getDate());
        endDate = startDate;
        break;
      }
    }
  }


  // Common reasons
  if (
    text.includes("sister") &&
    (text.includes("wedding") || text.includes("shaadi"))
  ) {
    reason = "Leave required for sister's wedding.";
  } else if (
    text.includes("brother") &&
    (text.includes("wedding") || text.includes("shaadi"))
  ) {
    reason = "Leave required for brother's wedding.";
  } else if (
    text.includes("family function") ||
    text.includes("family event")
  ) {
    reason = "Leave required due to a family function.";
  }

  // Professional summary
  if (requestType === "Leave Request") {
    summary = startDate
      ? `Leave request for ${startDate}${endDate ? ` to ${endDate}` : ""}.`
      : "Employee has submitted a leave request.";
  } else {
    summary = `${requestType} submitted by employee.`;
  }

  return {
    requestType,
    department,
    priority,
    startDate,
    endDate,
    reason,
    summary,
  };
}

// ---------------------------------------------------------------------------
// Health check
// ---------------------------------------------------------------------------

app.get("/api/health", (req, res) => {
  res.json({
    ok: true,
    aiConfigured: Boolean(
      ANTHROPIC_API_KEY
    ),
    model: ANTHROPIC_MODEL,
  });
});

// ---------------------------------------------------------------------------
// AI Analyze
// ---------------------------------------------------------------------------

app.post("/api/analyze", async (req, res) => {
  const { message } = req.body;

  if (!message || !message.trim()) {
    return res.status(400).json({
      error: "message is required",
    });
  }

  let extracted =
    await extractWithLLM(message);

  let usedFallback = false;

  if (!extracted) {
    extracted =
      fallbackExtract(message);

    usedFallback = true;
  }

  res.json({
    extracted,
    usedFallback,
  });
});

// ---------------------------------------------------------------------------
// Create HR Request
// ---------------------------------------------------------------------------

app.post("/api/requests", (req, res) => {
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
  } = req.body;

  if (
    !employeeName ||
    !employeeEmail ||
    !requestType ||
    !department
  ) {
    return res.status(400).json({
      error: "Missing required fields",
    });
  }

  const ticket = {
    id:
      "REQ-" +
      crypto
        .randomUUID()
        .slice(0, 8)
        .toUpperCase(),

    employeeName,
    employeeEmail,

    originalMessage:
      message || "",

    requestType,
    department,

    priority:
      priority || "Medium",

    startDate:
      startDate || null,

    endDate:
      endDate || null,

    reason:
      reason || "",

    summary:
      summary || requestType,

    status: "Pending",

    createdAt:
      new Date().toISOString(),

    updatedAt:
      new Date().toISOString(),
  };

  requests.unshift(ticket);

  res.status(201).json(ticket);
});

// ---------------------------------------------------------------------------
// Get Requests
// ---------------------------------------------------------------------------

app.get("/api/requests", (req, res) => {
  const { email } = req.query;

  if (email) {
    return res.json(
      requests.filter(
        (request) =>
          request.employeeEmail.toLowerCase() ===
          email.toLowerCase()
      )
    );
  }

  res.json(requests);
});

// ---------------------------------------------------------------------------
// Get Single Request
// ---------------------------------------------------------------------------

app.get("/api/requests/:id", (req, res) => {
  const ticket = requests.find(
    (request) =>
      request.id === req.params.id
  );

  if (!ticket) {
    return res.status(404).json({
      error: "Not found",
    });
  }

  res.json(ticket);
});

// ---------------------------------------------------------------------------
// Approve / Reject
// ---------------------------------------------------------------------------

app.patch(
  "/api/requests/:id/status",
  (req, res) => {
    const { status } = req.body;

    if (
      ![
        "Approved",
        "Rejected",
        "Pending",
      ].includes(status)
    ) {
      return res.status(400).json({
        error: "Invalid status",
      });
    }

    const ticket = requests.find(
      (request) =>
        request.id === req.params.id
    );

    if (!ticket) {
      return res.status(404).json({
        error: "Not found",
      });
    }

    ticket.status = status;

    ticket.updatedAt =
      new Date().toISOString();

    res.json(ticket);
  }
);

// ---------------------------------------------------------------------------
// Start Server
// ---------------------------------------------------------------------------

console.log("ABOUT TO START SERVER");
app.listen(PORT, () => {
  console.log(
    `HRFlow AI backend running on http://localhost:${PORT}`
  );

  console.log(
    `AI extraction mode: ${
      ANTHROPIC_API_KEY
        ? "Anthropic API"
        : "rule-based fallback (no API key set)"
    }`
  );

  console.log(
    `AI model: ${ANTHROPIC_MODEL}`
  );
});

console.log("SERVER FILE REACHED END");
# HRFlow AI – Agentic HR Request Agent

An employee types a plain-English HR request ("I need sick leave next Monday and Tuesday"), an AI agent reads it,
extracts the structured details (request type, dates, reason, department, priority), and pre-fills a request form.
The employee reviews/edits and submits — a unique ticket is created and appears live on the HR Dashboard, where HR
can approve or reject it.

## Project structure

```
hrflow-ai/
├── backend/          Express API + AI extraction agent + in-memory ticket store
│   ├── server.js
│   ├── package.json
│   └── .env.example
└── frontend/         React + Vite single-page app
    ├── src/
    │   ├── pages/EmployeePage.jsx    Employee request form + AI analysis
    │   ├── pages/HRDashboard.jsx     HR ticket list + approve/reject
    │   ├── components/StatusBadge.jsx
    │   ├── api.js                   fetch helpers for the backend
    │   └── App.jsx / main.jsx
    ├── index.html
    └── package.json
```

## How the agent works

1. **Employee page** – the employee enters their name, email, and describes the request in free text, then clicks
   **"✨ Analyze with AI"**.
2. **Backend `/api/analyze`** – sends the message to the Anthropic API with a system prompt that instructs it to
   return a strict JSON object: `requestType`, `department`, `priority`, `startDate`, `endDate`, `reason`, `summary`.
   The agent decides the request category (Leave / Work From Home / Payslip / Document / Expense / Other) and the
   department that should own it, entirely from the free text.
3. **No API key? No problem.** If `ANTHROPIC_API_KEY` is not set, or the API call fails for any reason, the backend
   automatically falls back to a built-in keyword-based extractor so the whole flow still works end-to-end without
   any external dependency. The UI tells you which mode produced the result.
4. **Editable form** – the extracted fields populate an editable form. The employee can correct anything before
   submitting.
5. **`/api/requests` (POST)** – creates the ticket, generates a unique `REQ-XXXXXXXX` ID, and sets `status: "Pending"`.
6. **HR Dashboard** – polls `/api/requests` and shows every ticket as a card with Approve/Reject actions. Approving
   or rejecting calls `/api/requests/:id/status`, and the employee's "My Requests" panel (polling on their email)
   reflects the new status within a few seconds.

Data is stored **in memory** in the Node process (a single JS array) — intentionally simple, per the project scope.
Restarting the backend clears all tickets.

## Prerequisites

- Node.js 18+ and npm

## 1. Backend setup

```bash
cd backend
npm install
cp .env.example .env
```

Edit `.env`:

```
ANTHROPIC_API_KEY=sk-ant-...   # optional — leave blank to use the rule-based fallback
ANTHROPIC_MODEL=claude-sonnet-4-5-20250929
PORT=5000
CORS_ORIGIN=http://localhost:5173
```

Run it:

```bash
npm run dev      # auto-restarts on file changes
# or
npm start
```

The API starts on `http://localhost:5000`. Visit `http://localhost:5000/api/health` to confirm it's up and see
whether AI mode is configured.

## 2. Frontend setup

In a second terminal:

```bash
cd frontend
npm install
cp .env.example .env
```

`.env`:

```
VITE_API_URL=http://localhost:5000
```

Run it:

```bash
npm run dev
```

Open `http://localhost:5173`.

- **Employee Portal** (`/`) – submit a request.
- **HR Dashboard** (`/dashboard`) – review, approve, or reject requests.

## Try it

Example inputs to paste into the request box (also available as quick-fill chips in the UI):

- "I need sick leave from 2026-09-22 to 2026-09-24, I have a fever and need to see a doctor."
- "Can I work from home this Friday, my internet installer is coming?"
- "Please send me my payslip for August, I need it urgently for a loan application."
- "I need an experience letter for a visa application, not urgent."

Each produces a different `requestType`, `department`, and `priority`, demonstrating the agentic decision-making.

## Environment variables summary

| Location | Variable | Required | Purpose |
|---|---|---|---|
| backend/.env | `ANTHROPIC_API_KEY` | No | Enables real LLM extraction. Falls back to rule-based extraction if absent/invalid. |
| backend/.env | `ANTHROPIC_MODEL` | No | Defaults to `claude-sonnet-4-5-20250929`. |
| backend/.env | `PORT` | No | Defaults to `5000`. |
| backend/.env | `CORS_ORIGIN` | No | Defaults to `http://localhost:5173`. Comma-separate multiple origins. |
| frontend/.env | `VITE_API_URL` | No | Defaults to `http://localhost:5000`. Point this at your deployed backend URL in production. |

## Deployment

### Backend → Render (or Railway/Fly/any Node host)

1. Push this repo to GitHub.
2. Create a new **Web Service** on Render, pointing at the `backend/` directory.
3. Build command: `npm install` — Start command: `npm start`.
4. Add environment variables `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL`, `CORS_ORIGIN` (set this to your deployed
   frontend's URL, e.g. `https://hrflow-ai.vercel.app`).
5. Note the resulting backend URL (e.g. `https://hrflow-ai-backend.onrender.com`).

### Frontend → Vercel

1. Import the repo into Vercel, set the project root to `frontend/`.
2. Framework preset: Vite. Build command `npm run build`, output directory `dist`.
3. Add environment variable `VITE_API_URL` = your Render backend URL.
4. Deploy.

Because storage is in-memory, tickets reset whenever the backend process restarts/redeploys — this is expected for
this demo-scoped project. Swap in a real database (Postgres, MongoDB, etc.) if you need persistence.

## Notes & limitations (by design, per project scope)

- No authentication — anyone with the link can act as any employee or HR user.
- No persistent database — an in-memory array holds tickets for the life of the process.
- Single HR "queue" — no per-department routing/permissions beyond the `department` label shown on each ticket.

These were intentionally left out to keep the project simple to run and deploy quickly.

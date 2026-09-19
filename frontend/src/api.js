const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

async function handle(res) {
  if (!res.ok) {
    let msg = "Request failed";
    try {
      const body = await res.json();
      msg = body.error || msg;
    } catch {
      /* ignore */
    }
    throw new Error(msg);
  }
  return res.json();
}

export async function analyzeRequest(message) {
  const res = await fetch(`${API_URL}/api/analyze`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message }),
  });
  return handle(res);
}

export async function createRequest(payload) {
  const res = await fetch(`${API_URL}/api/requests`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return handle(res);
}

export async function fetchRequests(email) {
  const url = email
    ? `${API_URL}/api/requests?email=${encodeURIComponent(email)}`
    : `${API_URL}/api/requests`;
  const res = await fetch(url);
  return handle(res);
}

export async function updateStatus(id, status) {
  const res = await fetch(`${API_URL}/api/requests/${id}/status`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status }),
  });
  return handle(res);
}

export async function checkHealth() {
  const res = await fetch(`${API_URL}/api/health`);
  return handle(res);
}

import { useState } from "react";
import { useNavigate } from "react-router-dom";

export default function LoginPage() {
  const [role, setRole] = useState("employee");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const navigate = useNavigate();

  function handleLogin(e) {
    e.preventDefault();

    if (!email.trim() || !password.trim()) {
      alert("Please enter email and password.");
      return;
    }

    if (role === "employee") {
  localStorage.setItem("hrflowRole", "employee");
  localStorage.setItem("employeeEmail", email);

  const employeeName =
    email.split("@")[0]
      .replace(/[._-]/g, " ")
      .replace(/\b\w/g, (char) => char.toUpperCase());

  localStorage.setItem("hrflowName", employeeName);

  navigate("/employee");
} else {
  localStorage.setItem("hrflowRole", "hr");
  localStorage.setItem("hrEmail", email);
  localStorage.setItem("hrflowName", "HR Admin");

  navigate("/hr");
}
  }

  return (
    <div className="login-page">
      <div className="login-container">

        <div className="login-brand">
          <div className="login-logo">HF</div>

          <div>
            <h1>HRFlow AI</h1>
            <p>Intelligent HR Request Management</p>
          </div>
        </div>

        <div className="login-card">

          <div className="login-heading">
            <h2>Welcome back</h2>
            <p>Sign in to continue to HRFlow AI</p>
          </div>

          <div className="role-selector">

            <button
              type="button"
              className={role === "employee" ? "role-btn active" : "role-btn"}
              onClick={() => setRole("employee")}
            >
              <span>👤</span>
              <div>
                <strong>Employee</strong>
                <small>Submit & track requests</small>
              </div>
            </button>

            <button
              type="button"
              className={role === "hr" ? "role-btn active" : "role-btn"}
              onClick={() => setRole("hr")}
            >
              <span>🏢</span>
              <div>
                <strong>HR Admin</strong>
                <small>Manage employee requests</small>
              </div>
            </button>

          </div>

          <form onSubmit={handleLogin}>

            <div className="login-field">
              <label>Email address</label>

              <input
                type="email"
                placeholder={
                  role === "employee"
                    ? "employee@company.com"
                    : "hr@company.com"
                }
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div className="login-field">
              <label>Password</label>

              <input
                type="password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            <button className="login-submit" type="submit">
              Sign in as {role === "employee" ? "Employee" : "HR Admin"}
            </button>

          </form>

          <p className="login-note">
            Demo authentication for the HRFlow AI project
          </p>

        </div>
      </div>
    </div>
  );
}
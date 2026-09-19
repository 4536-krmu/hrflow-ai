import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

export default function ProfileMenu() {
  const [open, setOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(
    localStorage.getItem("hrflowDarkMode") === "true"
  );

  const menuRef = useRef(null);
  const navigate = useNavigate();

  const role = localStorage.getItem("hrflowRole");
  const email =
    role === "employee"
      ? localStorage.getItem("employeeEmail")
      : localStorage.getItem("hrEmail");

  const name =
    localStorage.getItem("hrflowName") ||
    (role === "hr" ? "HR Admin" : "Employee");

  useEffect(() => {
    function handleClickOutside(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  function toggleDarkMode() {
    const newValue = !darkMode;

    setDarkMode(newValue);
    localStorage.setItem("hrflowDarkMode", newValue);

    document.body.classList.toggle("dark-mode", newValue);
  }

  function handleLogout() {
    localStorage.removeItem("hrflowRole");

    navigate("/login");
  }

  function editProfile() {
    alert("Edit Profile option coming next.");
  }

  function openSettings() {
    alert("Settings option coming next.");
  }

  function openNotifications() {
    alert("Notifications panel coming next.");
  }

  return (
    <div className="profile-wrapper" ref={menuRef}>
      <button
        className="profile-button"
        onClick={() => setOpen(!open)}
      >
        <div className="profile-avatar">
          {name.charAt(0).toUpperCase()}
        </div>

        <div className="profile-info">
          <strong>{name}</strong>
          <span>{role === "hr" ? "HR Admin" : "Employee"}</span>
        </div>

        <span className="profile-arrow">
          {open ? "⌃" : "⌄"}
        </span>
      </button>

      {open && (
        <div className="profile-dropdown">

          <div className="profile-dropdown-header">
            <div className="profile-avatar large">
              {name.charAt(0).toUpperCase()}
            </div>

            <div>
              <strong>{name}</strong>
              <span>{email}</span>
            </div>
          </div>

          <div className="profile-divider" />

          <button
            className="profile-menu-item"
            onClick={editProfile}
          >
            <span>👤</span>
            <div>
              <strong>Edit Profile</strong>
              <small>Update your personal details</small>
            </div>
          </button>

          <button
            className="profile-menu-item"
            onClick={openNotifications}
          >
            <span>🔔</span>
            <div>
              <strong>Notifications</strong>
              <small>View your notifications</small>
            </div>
          </button>

          <button
            className="profile-menu-item"
            onClick={openSettings}
          >
            <span>⚙️</span>
            <div>
              <strong>Settings</strong>
              <small>Manage account settings</small>
            </div>
          </button>

          <button
            className="profile-menu-item"
            onClick={toggleDarkMode}
          >
            <span>{darkMode ? "☀️" : "🌙"}</span>
            <div>
              <strong>{darkMode ? "Light Mode" : "Dark Mode"}</strong>
              <small>Change appearance</small>
            </div>

            <span className="menu-toggle">
              {darkMode ? "ON" : "OFF"}
            </span>
          </button>

          <div className="profile-divider" />

          <button
            className="profile-menu-item logout-item"
            onClick={handleLogout}
          >
            <span>🚪</span>
            <div>
              <strong>Logout</strong>
              <small>Sign out of HRFlow AI</small>
            </div>
          </button>

        </div>
      )}
    </div>
  );
}
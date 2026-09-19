export default function StatusBadge({ status }) {
  const cls =
    status === "Approved" ? "badge badge-approved" : status === "Rejected" ? "badge badge-rejected" : "badge badge-pending";
  return <span className={cls}>{status}</span>;
}

export function PriorityBadge({ priority }) {
  const cls =
    priority === "High" ? "badge badge-high" : priority === "Low" ? "badge badge-low" : "badge badge-medium";
  return <span className={cls}>{priority}</span>;
}

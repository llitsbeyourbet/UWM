import { useNavigate } from "react-router-dom";

function AdminSidebar({ active }) {
  const navigate = useNavigate();

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    navigate("/login");
  };

  const items = [
    { key: "dashboard", label: "Dashboard", icon: "📊", path: "/admin" },
    { key: "reports", label: "รายงาน", icon: "🚩", path: "/admin/reports" },
    { key: "users", label: "ผู้ใช้", icon: "👥", path: "/admin/users" },
    { key: "activities", label: "กิจกรรม", icon: "🎯", path: "/admin/activities" },
  ];

  return (
    <div className="admin-sidebar">
      <div className="sidebar-brand">
        <p className="sidebar-brand-sub">Until We Meet</p>
        <p className="sidebar-brand-title">Admin Panel</p>
      </div>
      <nav className="sidebar-nav">
        {items.map((item) => (
          <div
            key={item.key}
            className={`sidebar-nav-item ${active === item.key ? "active" : ""}`}
            onClick={() => navigate(item.path)}
          >
            <span>{item.icon}</span>
            <span>{item.label}</span>
          </div>
        ))}
      </nav>
      <div className="sidebar-logout" onClick={handleLogout}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#e53935" strokeWidth="2" strokeLinecap="round">
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
          <polyline points="16 17 21 12 16 7"/>
          <line x1="21" y1="12" x2="9" y2="12"/>
        </svg>
        <span>ออกจากระบบ</span>
      </div>
    </div>
  );
}

export default AdminSidebar;
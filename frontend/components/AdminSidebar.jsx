import { useNavigate, useLocation } from "react-router-dom";
import {
  FiCalendar,
  FiFlag,
  FiGrid,
  FiLogOut,
  FiUsers,
  FiShield,
  FiAlertTriangle,
  FiMessageSquare,
} from "react-icons/fi";
import { MdGroups } from "react-icons/md";
import { useAdminReport } from "../src/context/AdminReportContext";
import { logoutUser } from "../utils/logout";

export default function AdminSidebar() {
  const navigate = useNavigate();
  const location = useLocation();

  const {
    pendingReportCount,
    pendingActivityModerations,
    pendingReviewModerations,
  } = useAdminReport();

  const navItems = [
    ["ภาพรวม", <FiGrid />, "/admin", 0],
    ["กิจกรรม", <FiCalendar />, "/admin/activities", 0],
    ["ผู้ใช้งาน", <FiUsers />, "/admin/users", 0],
    ["รายงานกิจกรรม", <FiFlag />, "/admin/reports", pendingReportCount],
    [
      "กิจกรรมที่ต้องตรวจสอบ",
      <FiAlertTriangle />,
      "/admin/moderation/activities",
      pendingActivityModerations,
    ],
    [
      "รีวิวที่ต้องตรวจสอบ",
      <FiMessageSquare />,
      "/admin/moderation/reviews",
      pendingReviewModerations,
    ],
    ["เพิ่มคำไม่เหมาะสม", <FiShield />, "/admin/inappropriate-words", 0],
  ];

  const logout = async () => {
    await logoutUser();
    navigate("/login", { replace: true });
  };

  const isActive = (path) => {
    if (path === "/admin") {
      return location.pathname === "/admin";
    }

    return location.pathname.startsWith(path);
  };

  return (
    <aside className="admin-sidebar">
      <button
        type="button"
        className="admin-brand"
        onClick={() => navigate("/admin")}
      >
        <span className="admin-brand-logo">
          <MdGroups />
        </span>

        <span>
          <strong>Until We Meet</strong>
          <small>ADMIN PANEL</small>
        </span>
      </button>

      <nav className="admin-nav">
        {navItems.map(([label, icon, path, count]) => (
          <button
            type="button"
            key={label}
            className={`admin-nav-item ${isActive(path) ? "active" : ""}`}
            onClick={() => navigate(path)}
          >
            <span className="admin-nav-icon">{icon}</span>

            <b>{label}</b>

            {Number(count) > 0 && (
              <em className="admin-nav-badge">{count}</em>
            )}
          </button>
        ))}
      </nav>

      <button
        type="button"
        className="admin-logout"
        onClick={logout}
      >
        <FiLogOut />
        ออกจากระบบ
      </button>
    </aside>
  );
}
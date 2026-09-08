import { useNavigate, useLocation } from "react-router-dom";
import { FiCalendar, FiFlag, FiGrid, FiLogOut, FiStar, FiUsers, } from "react-icons/fi";
import { MdGroups } from "react-icons/md";
import { useAdminReport } from "../src/context/AdminReportContext";
import { logoutUser } from "../utils/logout";

export default function AdminSidebar() {
  const navigate = useNavigate();
  const location = useLocation();

  const { pendingReportCount } = useAdminReport();

  const navItems = [
    ["ภาพรวม", <FiGrid />, "/admin"],
    ["กิจกรรม", <FiCalendar />, "/admin/activities"],
    ["ผู้ใช้งาน", <FiUsers />, "/admin/users"],
    ["รายงานกิจกรรม", <FiFlag />, "/admin/reports"],
    ["รีวิว", <FiStar />, "/admin/reviews"],
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
        {navItems.map(([label, icon, path]) => (
          <button
            type="button"
            key={label}
            className={`admin-nav-item ${isActive(path) ? "active" : ""
              }`}
            onClick={() => navigate(path)}
          >
            <span>{icon}</span>

            <b>{label}</b>

            {label === "รายงานกิจกรรม" &&
              pendingReportCount > 0 && (
                <em className="admin-nav-badge">
                  {pendingReportCount}
                </em>
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
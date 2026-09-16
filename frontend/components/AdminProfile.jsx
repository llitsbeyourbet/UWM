import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FiChevronDown, FiLogOut } from "react-icons/fi";
import { logoutUser } from "../utils/logout";

export default function AdminProfile() {
  const navigate = useNavigate();
  const [showProfileMenu, setShowProfileMenu] = useState(false);

  const admin = useMemo(() => {
    try {
      return JSON.parse(sessionStorage.getItem("user")) || {};
    } catch {
      return {};
    }
  }, []);

  const adminName = admin.name || admin.username || "Admin";

  const logout = async () => {
    await logoutUser();
    navigate("/login", { replace: true });
  };

  return (
    <div className="admin-header-actions">
      <div className="admin-profile-menu">
        <button
          className="admin-profile-trigger"
          onClick={() => setShowProfileMenu((current) => !current)}
        >
          <span className="admin-profile-avatar">
            {adminName[0]?.toUpperCase()}
          </span>

          <span>
            <strong>{adminName}</strong>
            <small>ผู้ดูแลระบบ</small>
          </span>

          <FiChevronDown />
        </button>

        {showProfileMenu && (
          <div className="admin-profile-dropdown">
            <strong>{adminName}</strong>
            <small>{admin.email || "ผู้ดูแลระบบ"}</small>

            <button onClick={logout}>
              <FiLogOut /> ออกจากระบบ
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import AdminSidebar from "./AdminSidebar";
import "./AdminDashboard.css";
import API_URL from "../config";

function AdminUsers() {
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUsers = async () => {
      const token = localStorage.getItem("token");
      try {
        const res = await fetch(`${API_URL}/api/admin/users`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        setUsers(data);
      } catch (err) {
        console.log(err);
      } finally {
        setLoading(false);
      }
    };
    fetchUsers();
  }, []);

  if (loading) return <div className="admin-loading">กำลังโหลด...</div>;

  return (
    <div className="admin-layout">
      <AdminSidebar active="users" />
      <div className="admin-main">
        <div className="admin-topbar">
          <div>
            <p className="admin-sub">Admin</p>
            <h1 className="admin-title">ผู้ใช้</h1>
          </div>
          <div className="admin-user-badge">
            <div className="admin-avatar">A</div>
            <span>Admin</span>
          </div>
        </div>

        <div className="admin-table-card">
          <p className="admin-table-title">ผู้ใช้ทั้งหมด ({users.length})</p>
          <div className="admin-table-header users-cols">
            <span>ชื่อ / Username</span>
            <span>อีเมล</span>
            <span>บทบาท</span>
            <span>วันที่สมัคร</span>
          </div>

          {users.length === 0 ? (
            <p className="admin-empty">ไม่มีผู้ใช้</p>
          ) : (
            users.map((u) => (
              <div key={u.id} className="admin-table-row users-cols">
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div className="user-avatar-circle">
                    {u.name?.charAt(0).toUpperCase() || "U"}
                  </div>
                  <div>
                    <p className="row-creator">{u.name || "-"}</p>
                    <p className="row-creator-username">@{u.username || "-"}</p>
                  </div>
                </div>
                <span className="row-email">{u.email || "-"}</span>
                <span className={`role-badge ${u.role === "admin" ? "role-admin" : "role-user"}`}>
                  {u.role || "user"}
                </span>
                <span className="row-date">
                  {u.createdAt ? new Date(u.createdAt).toLocaleDateString("th-TH") : "-"}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

export default AdminUsers;
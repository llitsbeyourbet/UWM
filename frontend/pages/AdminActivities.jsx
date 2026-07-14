import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import AdminSidebar from "./AdminSidebar";
import "./AdminDashboard.css";
import API_URL from "../config";

function AdminActivities() {
  const navigate = useNavigate();
  const [activities, setActivities] = useState([]);
  const [users, setUsers] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    const token = localStorage.getItem("token");
    try {
      const [actRes, usersRes] = await Promise.all([
        fetch(`${API_URL}/api/activities`),
        fetch(`${API_URL}/api/admin/users`, { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      const actData = await actRes.json();
      const usersData = await usersRes.json();
      setActivities(actData);
      const userMap = {};
      usersData.forEach((u) => { userMap[u.id] = u; });
      setUsers(userMap);
    } catch (err) {
      console.log(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSuspend = async (activityId) => {
    if (!window.confirm("ต้องการระงับกิจกรรมนี้ไหม?")) return;
    const token = localStorage.getItem("token");
    const res = await fetch(`${API_URL}/api/admin/suspend/${activityId}`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) { alert("ระงับสำเร็จ"); fetchData(); }
  };

  const handleUnsuspend = async (activityId) => {
    const token = localStorage.getItem("token");
    const res = await fetch(`${API_URL}/api/admin/unsuspend/${activityId}`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) { alert("คืนสถานะสำเร็จ"); fetchData(); }
  };

  if (loading) return <div className="admin-loading">กำลังโหลด...</div>;

  return (
    <div className="admin-layout">
      <AdminSidebar active="activities" />
      <div className="admin-main">
        <div className="admin-topbar">
          <div>
            <p className="admin-sub">Admin</p>
            <h1 className="admin-title">กิจกรรม</h1>
          </div>
          <div className="admin-user-badge">
            <div className="admin-avatar">A</div>
            <span>Admin</span>
          </div>
        </div>

        <div className="admin-table-card">
          <p className="admin-table-title">กิจกรรมทั้งหมด ({activities.length})</p>
          <div className="admin-table-header activities-cols">
            <span>ชื่อกิจกรรม</span>
            <span>ผู้สร้าง</span>
            <span>หมวดหมู่</span>
            <span>วันที่</span>
            <span>สถานะ</span>
            <span>การจัดการ</span>
          </div>

          {activities.length === 0 ? (
            <p className="admin-empty">ไม่มีกิจกรรม</p>
          ) : (
            activities.map((act) => {
              const creator = users[act.createdBy];
              return (
                <div key={act.id} className="admin-table-row activities-cols">
                  <p className="row-activity-name">{act.activityName}</p>
                  <div>
                    <p className="row-creator">{creator?.name || "-"}</p>
                    <p className="row-creator-username">@{creator?.username || "-"}</p>
                  </div>
                  <span className="category-badge">{act.category || "-"}</span>
                  <span className="row-date">{act.date || "-"}</span>
                  <span className={`status-badge ${act.status === "suspended" ? "status-suspended" : "status-active"}`}>
                    {act.status === "suspended" ? "ระงับ" : "active"}
                  </span>
                  <div className="row-actions">
                    {act.status === "suspended" ? (
                      <button className="unsuspend-btn" onClick={() => handleUnsuspend(act.id)}>คืนสถานะ</button>
                    ) : (
                      <button className="suspend-btn" onClick={() => handleSuspend(act.id)}>ระงับ</button>
                    )}
                    <button className="inspect-btn" onClick={() => navigate(`/activity-detail?id=${act.id}&from=admin`)}>🔍</button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

export default AdminActivities;
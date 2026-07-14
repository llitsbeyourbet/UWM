import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import AdminSidebar from "./AdminSidebar";
import "./AdminDashboard.css";
import API_URL from "../config";

function AdminReports() {
  const navigate = useNavigate();
  const [reports, setReports] = useState([]);
  const [activities, setActivities] = useState({});
  const [users, setUsers] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    const token = localStorage.getItem("token");
    try {
      const [reportsRes, actRes, usersRes] = await Promise.all([
        fetch(`${API_URL}/api/admin/reports`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API_URL}/api/activities`),
        fetch(`${API_URL}/api/admin/users`, { headers: { Authorization: `Bearer ${token}` } }),
      ]);

      const reportsData = await reportsRes.json();
      const actData = await actRes.json();
      const usersData = await usersRes.json();

      setReports(reportsData);

      const actMap = {};
      actData.forEach((a) => { actMap[a.id] = a; });
      setActivities(actMap);

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

  const handleDismiss = async (activityId) => {
    const token = localStorage.getItem("token");
    const res = await fetch(`${API_URL}/api/admin/unsuspend/${activityId}`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) { alert("ยกเลิกรายงานสำเร็จ"); fetchData(); }
  };

  const groupedReports = reports.reduce((acc, r) => {
    if (!acc[r.activityId]) acc[r.activityId] = [];
    acc[r.activityId].push(r);
    return acc;
  }, {});

  if (loading) return <div className="admin-loading">กำลังโหลด...</div>;

  return (
    <div className="admin-layout">
      <AdminSidebar active="reports" />
      <div className="admin-main">
        <div className="admin-topbar">
          <div>
            <p className="admin-sub">Admin</p>
            <h1 className="admin-title">รายงาน</h1>
          </div>
          <div className="admin-user-badge">
            <div className="admin-avatar">A</div>
            <span>Admin</span>
          </div>
        </div>

        <div className="admin-table-card">
          <p className="admin-table-title">รายงานทั้งหมด</p>
          <div className="admin-table-header reports-cols">
            <span>กิจกรรม</span>
            <span>ผู้สร้าง</span>
            <span>จำนวนรายงาน</span>
            <span>เหตุผล</span>
            <span>การจัดการ</span>
          </div>

          {Object.keys(groupedReports).length === 0 ? (
            <p className="admin-empty">ไม่มีรายงาน</p>
          ) : (
            Object.entries(groupedReports).map(([activityId, reportList]) => {
              const act = activities[activityId];
              const creator = act ? users[act.createdBy] : null;
              return (
                <div key={activityId} className="admin-table-row reports-cols">
                  <p className="row-activity-name">{act?.activityName || "-"}</p>
                  <div>
                    <p className="row-creator">{creator?.name || "-"}</p>
                    <p className="row-creator-username">@{creator?.username || "-"}</p>
                  </div>
                  <span className="row-count">{reportList.length} ครั้ง</span>
                  <div className="row-reasons">
                    {reportList.map((r, i) => (
                      <span key={i} className="report-reason-tag">{r.reason}</span>
                    ))}
                  </div>
                  <div className="row-actions">
                    <button className="suspend-btn" onClick={() => handleSuspend(activityId)}>ระงับ</button>
                    <button className="dismiss-btn" onClick={() => handleDismiss(activityId)}>ยกเลิก</button>
                    <button className="inspect-btn" onClick={() => navigate(`/activity-detail?id=${activityId}&from=admin`)}>🔍</button>
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

export default AdminReports;
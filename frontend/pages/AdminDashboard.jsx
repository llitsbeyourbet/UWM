import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./AdminDashboard.css";
import API_URL from "../config";

function AdminDashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [reports, setReports] = useState([]);
  const [activities, setActivities] = useState({});
  const [users, setUsers] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const user = JSON.parse(localStorage.getItem("user"));
    if (!user || user.role !== "admin") {
      navigate("/");
      return;
    }
    fetchData();
  }, []);

  const fetchData = async () => {
    const token = localStorage.getItem("token");
    try {
      const [statsRes, reportsRes, actRes, usersRes] = await Promise.all([
        fetch(`${API_URL}/api/admin/dashboard`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API_URL}/api/admin/reports`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API_URL}/api/activities`),
        fetch(`${API_URL}/api/admin/users`, { headers: { Authorization: `Bearer ${token}` } }),
      ]);

      const statsData = await statsRes.json();
      const reportsData = await reportsRes.json();
      const actData = await actRes.json();
      const usersData = await usersRes.json();

      setStats(statsData);
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
    try {
      const res = await fetch(`${API_URL}/api/admin/suspend/${activityId}`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      alert("ระงับกิจกรรมสำเร็จ");
      fetchData();
    } catch { alert("ไม่สามารถเชื่อมต่อ server ได้"); }
  };

  const handleDismiss = async (activityId) => {
    const token = localStorage.getItem("token");
    try {
      const res = await fetch(`${API_URL}/api/admin/unsuspend/${activityId}`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      alert("ยกเลิกรายงานสำเร็จ");
      fetchData();
    } catch { alert("ไม่สามารถเชื่อมต่อ server ได้"); }
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    navigate("/login");
  };

  const groupedReports = reports.reduce((acc, r) => {
    if (!acc[r.activityId]) acc[r.activityId] = [];
    acc[r.activityId].push(r);
    return acc;
  }, {});

  if (loading) return <div className="admin-loading">กำลังโหลด...</div>;

  return (
    <div className="admin-layout">

      {/* Sidebar */}
      <div className="admin-sidebar">
        <div className="sidebar-brand">
          <p className="sidebar-brand-sub">Until We Meet</p>
          <p className="sidebar-brand-title">Admin Panel</p>
        </div>

        <nav className="sidebar-nav">
          <div className="sidebar-nav-item active">
            <span>📊</span>
            <span>Dashboard</span>
          </div>
          <div className="sidebar-nav-item">
            <span>🚩</span>
            <span>รายงาน</span>
          </div>
          <div className="sidebar-nav-item">
            <span>👥</span>
            <span>ผู้ใช้</span>
          </div>
          <div className="sidebar-nav-item">
            <span>🎯</span>
            <span>กิจกรรม</span>
          </div>
        </nav>

        {/* Logout */}
        <div className="sidebar-logout" onClick={handleLogout}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#e53935" strokeWidth="2" strokeLinecap="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
            <polyline points="16 17 21 12 16 7"/>
            <line x1="21" y1="12" x2="9" y2="12"/>
          </svg>
          <span>ออกจากระบบ</span>
        </div>
      </div>

      {/* Main */}
      <div className="admin-main">

        {/* Header */}
        <div className="admin-topbar">
          <div>
            <p className="admin-sub">Overview</p>
            <h1 className="admin-title">Dashboard</h1>
          </div>
          <div className="admin-user-badge">
            <div className="admin-avatar">A</div>
            <span>Admin</span>
          </div>
        </div>

        {/* Stats */}
        <div className="admin-stats-grid">
          <div className="stat-card" style={{ background: "#FFF176" }}>
            <div className="stat-circle" />
            <p className="stat-num">{stats?.totalUsers || 0}</p>
            <p className="stat-lbl">ผู้ใช้ทั้งหมด</p>
          </div>
          <div className="stat-card" style={{ background: "#B8E0FF" }}>
            <div className="stat-circle" />
            <p className="stat-num">{stats?.totalActivities || 0}</p>
            <p className="stat-lbl">กิจกรรมทั้งหมด</p>
          </div>
          <div className="stat-card" style={{ background: "#FFB3C6" }}>
            <div className="stat-circle" />
            <p className="stat-num">{stats?.pendingReports || 0}</p>
            <p className="stat-lbl">รายงานรอตรวจ</p>
          </div>
          <div className="stat-card" style={{ background: "#C8F5C8" }}>
            <div className="stat-circle" />
            <p className="stat-num">{stats?.totalCheckins || 0}</p>
            <p className="stat-lbl">Check-in ทั้งหมด</p>
          </div>
          <div className="stat-card" style={{ background: "#E8D5F5" }}>
            <div className="stat-circle" />
            <p className="stat-num">{stats?.suspendedActivities || 0}</p>
            <p className="stat-lbl">ถูกระงับ</p>
          </div>
          <div className="stat-card" style={{ background: "#FFD4B8" }}>
            <div className="stat-circle" />
            <p className="stat-num">{stats?.totalReports || 0}</p>
            <p className="stat-lbl">รายงานทั้งหมด</p>
          </div>
        </div>

        {/* Reports Table */}
        <div className="admin-table-card">
          <p className="admin-table-title">รายงานที่รอตรวจสอบ</p>

          <div className="admin-table-header">
            <span>ชื่อกิจกรรม</span>
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
                <div key={activityId} className="admin-table-row">
                  <div>
                    <p className="row-activity-name">{act?.activityName || "-"}</p>
                  </div>
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

export default AdminDashboard;
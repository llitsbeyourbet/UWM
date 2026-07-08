import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./AdminDashboard.css";
import API_URL from "../config";

function AdminDashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [reports, setReports] = useState([]);
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
      const statsRes = await fetch(`${API_URL}/api/admin/dashboard`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const statsData = await statsRes.json();
      setStats(statsData);

      const reportsRes = await fetch(`${API_URL}/api/admin/reports`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const reportsData = await reportsRes.json();
      setReports(reportsData);
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
      const data = await res.json();
      if (!res.ok) { alert(data.message); return; }
      alert("ระงับกิจกรรมสำเร็จ");
      fetchData();
    } catch {
      alert("ไม่สามารถเชื่อมต่อ server ได้");
    }
  };

  const handleDismiss = async (activityId) => {
    const token = localStorage.getItem("token");
    try {
      const res = await fetch(`${API_URL}/api/admin/unsuspend/${activityId}`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) { alert(data.message); return; }
      alert("ยกเลิกรายงานสำเร็จ");
      fetchData();
    } catch {
      alert("ไม่สามารถเชื่อมต่อ server ได้");
    }
  };

  const groupedReports = reports.reduce((acc, r) => {
    if (!acc[r.activityId]) acc[r.activityId] = [];
    acc[r.activityId].push(r);
    return acc;
  }, {});

  if (loading) return <div className="admin-loading">กำลังโหลด...</div>;

  return (
    <div className="admin-page">

      {/* Header */}
      <div className="admin-header">
        <div>
          <p className="admin-sub">Admin</p>
          <h1 className="admin-title">Dashboard</h1>
        </div>
        <div className="admin-back-btn" onClick={() => navigate("/")}>↩</div>
      </div>

      {/* Stats Grid */}
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

      {/* Reports */}
      <div className="admin-section">
        <p className="admin-section-title">รายงานที่รอตรวจสอบ</p>

        {Object.keys(groupedReports).length === 0 ? (
          <p className="admin-empty">ไม่มีรายงาน</p>
        ) : (
          Object.entries(groupedReports).map(([activityId, reportList]) => (
            <div key={activityId} className="report-card">
              <div className="report-info">
                <p className="report-activity">กิจกรรม #{activityId}</p>
                <p className="report-count">ถูกรายงาน {reportList.length} ครั้ง</p>
                <div className="report-reasons">
                  {reportList.map((r, i) => (
                    <span key={i} className="report-reason-tag">
                      {r.reason}
                    </span>
                  ))}
                </div>
                <button className="inspect-btn" onClick={() => navigate(`/activity-detail?id=${activityId}`)}>
                  🔍 ตรวจสอบ
                </button>
              </div>
              <div className="report-actions">
                <button className="suspend-btn" onClick={() => handleSuspend(activityId)}>
                  ระงับ
                </button>
                <button className="dismiss-btn" onClick={() => handleDismiss(activityId)}>
                  ยกเลิก
                </button>
              </div>
            </div>
          ))
        )}
      </div>

    </div>
  );
}

export default AdminDashboard;
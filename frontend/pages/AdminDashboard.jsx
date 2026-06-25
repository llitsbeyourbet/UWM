import API_URL from "../config";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./AdminDashboard.css";

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
      // ดึงสถิติ
      const statsRes = await fetch(`${API_URL}/api/admin/dashboard`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const statsData = await statsRes.json();
      setStats(statsData);

      // ดึงรายงาน
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
    } catch (err) {
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
    } catch (err) {
      alert("ไม่สามารถเชื่อมต่อ server ได้");
    }
  };

  // grouping reports by activityId
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
          <p className="admin-title">Admin Dashboard</p>
          <p className="admin-subtitle">Until We Meet</p>
        </div>
        <button className="admin-back-btn" onClick={() => navigate("/")}>
          ออก
        </button>
      </div>

      {/* สถิติ */}
      <div className="stats-grid">
        <div className="stat-card blue">
          <p className="stat-number">{stats?.totalUsers || 0}</p>
          <p className="stat-label">ผู้ใช้ทั้งหมด</p>
        </div>
        <div className="stat-card green">
          <p className="stat-number">{stats?.totalActivities || 0}</p>
          <p className="stat-label">กิจกรรมทั้งหมด</p>
        </div>
        <div className="stat-card red">
          <p className="stat-number">{stats?.pendingReports || 0}</p>
          <p className="stat-label">รายงานรอตรวจ</p>
        </div>
        <div className="stat-card amber">
          <p className="stat-number">{stats?.suspendedActivities || 0}</p>
          <p className="stat-label">กิจกรรมถูกระงับ</p>
        </div>
        <div className="stat-card purple">
          <p className="stat-number">{stats?.totalCheckins || 0}</p>
          <p className="stat-label">Check-in ทั้งหมด</p>
        </div>
        <div className="stat-card gray">
          <p className="stat-number">{stats?.totalReports || 0}</p>
          <p className="stat-label">รายงานทั้งหมด</p>
        </div>
      </div>

      {/* รายงานที่รอตรวจ */}
      <div className="admin-section">
        <p className="section-title">รายงานที่รอตรวจสอบ</p>

        {Object.keys(groupedReports).length === 0 ? (
          <p className="empty-text">ไม่มีรายงาน</p>
        ) : (
          Object.entries(groupedReports).map(([activityId, reportList]) => (
            <div key={activityId} className="report-card">
              <div className="report-info">
                <p className="report-activity">{reportList[0].activityId} — กิจกรรม #{activityId}</p>
                <p className="report-count">ถูกรายงาน {reportList.length} ครั้ง</p>
                <div className="report-reasons">
                  {reportList.map((r, i) => (
                    <p key={i} className="report-reason">
                      • {r.reason}
                      <span className="report-status">{r.status === "pending" ? " (รอตรวจ)" : " (ตรวจแล้ว)"}</span>
                    </p>
                  ))}
                </div>
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
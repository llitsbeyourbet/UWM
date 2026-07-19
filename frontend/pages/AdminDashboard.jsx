import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FiBell, FiCalendar, FiUsers, FiFlag, } from "react-icons/fi";
import { MdEvent, MdGroups } from "react-icons/md";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, } from "recharts";
import "./AdminDashboard.css";
import API_URL from "../config";

export default function AdminDashboard() {
  const navigate = useNavigate();
  const token = localStorage.getItem("token");
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({});
  const [users, setUsers] = useState([]);
  const [activities, setActivities] = useState([]);
  const [reports, setReports] = useState([]);
  const [chartData, setChartData] = useState([]);
  const [latestActivities, setLatestActivities] = useState([]);
  const [latestReports, setLatestReports] = useState([]);
  const [days, setDays] = useState(7);

  useEffect(() => {
    const user = JSON.parse(localStorage.getItem("user"));

    if (!user || user.role !== "admin") {
      navigate("/");
      return;
    }

    loadDashboard();
  }, [days]);

  const authHeader = {
    Authorization: `Bearer ${token}`,
  };

  async function loadDashboard() {
    try {
      setLoading(true);

      const [
        dashboardRes,
        usersRes,
        reportsRes,
        activitiesRes,
        chartRes,
        latestActivitiesRes,
        latestReportsRes,
      ] = await Promise.all([
        fetch(`${API_URL}/api/admin/dashboard`, {
          headers: authHeader,
        }),

        fetch(`${API_URL}/api/admin/users`, {
          headers: authHeader,
        }),

        fetch(`${API_URL}/api/admin/reports`, {
          headers: authHeader,
        }),

        fetch(`${API_URL}/api/activities`),

        fetch(`${API_URL}/api/admin/chart?days=${days}`, {
          headers: authHeader,
        }),

        fetch(`${API_URL}/api/admin/latest-activities`, {
          headers: authHeader,
        }),

        fetch(`${API_URL}/api/admin/latest-reports`, {
          headers: authHeader,
        }),
      ]);

      const dashboard = await dashboardRes.json();

      const userData = await usersRes.json();

      const reportData = await reportsRes.json();

      const activityData = await activitiesRes.json();

      const chart = await chartRes.json();

      const latestActivity = await latestActivitiesRes.json();

      const latestReport = await latestReportsRes.json();

      setStats(dashboard);

      setUsers(userData);

      setReports(reportData);

      setActivities(activityData);

      setChartData(chart);

      setLatestActivities(latestActivity);

      setLatestReports(latestReport);
    } catch (err) {
      console.log(err);

      alert("ไม่สามารถโหลดข้อมูล Dashboard ได้");
    } finally {
      setLoading(false);
    }
  }

  async function suspendActivity(id) {
    if (!window.confirm("ต้องการระงับกิจกรรมนี้หรือไม่")) return;

    try {
      await fetch(`${API_URL}/api/admin/suspend/${id}`, {
        method: "PUT",
        headers: authHeader,
      });

      loadDashboard();
    } catch (err) {
      console.log(err);
    }
  }

  async function unsuspendActivity(id) {
    try {
      await fetch(`${API_URL}/api/admin/unsuspend/${id}`, {
        method: "PUT",
        headers: authHeader,
      });

      loadDashboard();
    } catch (err) {
      console.log(err);
    }
  }

  const userMap = useMemo(() => {
    const map = {};

    users.forEach((user) => {
      map[user.id] = user;
    });

    return map;
  }, [users]);

  const activeActivities = useMemo(() => {
    return activities.filter(
      (activity) => activity.status === "active"
    ).length;
  }, [activities]);

  if (loading) {
    return (
      <div className="admin-loading">
        กำลังโหลด Dashboard...
      </div>
    );
  }

  return (
    <div className="dashboard">

      {/* ================= Header ================= */}

      <header className="dashboard-header">

        <div>

          <h1>สวัสดี, Admin 👋</h1>

          <p>Until We Meet Dashboard</p>

        </div>

        <div className="header-right">

          <button className="btn notification-btn">

            <FiBell />

            {stats.pendingReports > 0 && (

              <span>{stats.pendingReports}</span>

            )}

          </button>

          <div className="profile-card">

            <div className="profile-avatar">A</div>

            <div>

              <h4>Administrator</h4>

              <small>Until We Meet</small>

            </div>

          </div>

        </div>

      </header>

      {/* ================= Date ================= */}

      <div className="date-card">

        <FiCalendar />

        <span>

          {new Date().toLocaleDateString("th-TH", {

            day: "numeric",

            month: "long",

            year: "numeric",

          })}

        </span>

      </div>

      {/* ================= Cards ================= */}

      <section className="dashboard-cards">

        <div className="dashboard-card">

          <div className="card-icon blue">

            <FiUsers />

          </div>

          <div>

            <p>ผู้ใช้งานทั้งหมด</p>

            <h2>{stats.totalUsers}</h2>

          </div>

        </div>

        <div className="dashboard-card">

          <div className="card-icon green">

            <MdEvent />

          </div>

          <div>

            <p>กิจกรรมทั้งหมด</p>

            <h2>{stats.totalActivities}</h2>

          </div>

        </div>

        <div className="dashboard-card">

          <div className="card-icon orange">

            <MdGroups />

          </div>

          <div>

            <p>กำลังดำเนินอยู่</p>

            <h2>{activeActivities}</h2>

          </div>

        </div>

        <div className="dashboard-card">

          <div className="card-icon pink">

            <FiFlag />

          </div>

          <div>

            <p>Pending Reports</p>

            <h2>{stats.pendingReports}</h2>

          </div>

        </div>

      </section>

      {/* ================= Row ================= */}

      <div className="dashboard-row">

        {/* =============== Chart =============== */}

        <div className="chart-card">

          <div className="card-header">

            <div>

              <h3>Activity Overview</h3>

              <p>จำนวนกิจกรรมที่ถูกสร้าง</p>

            </div>
            <select value={days} onChange={(e) => setDays(Number(e.target.value))} className="chart-filter">
              <option value={7}>7 วันล่าสุด</option>
              <option value={30}>30 วันล่าสุด</option>
              <option value={90}>90 วันล่าสุด</option>
              <option value={365}>365 วันล่าสุด</option>
            </select>

          </div>

          <div className="chart-wrapper">

            <ResponsiveContainer width="100%" height={320}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="day" />
                <YAxis />
                <Tooltip />
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke="#4F46E5"
                  strokeWidth={3}
                />
              </LineChart>
            </ResponsiveContainer>

          </div>

        </div>

        {/* =============== Latest Activities =============== */}

        <div className="latest-card">

          <div className="card-header">

            <div>

              <h3>Latest Activities</h3>

              <p>กิจกรรมล่าสุด</p>

            </div>

          </div>

          <div className="latest-list">

            {latestActivities.map((activity) => (

              <div
                key={activity.id}
                className="latest-item"
                onClick={() =>
                  navigate(
                    `/activity-detail?id=${activity.id}&from=admin`
                  )
                }
              >
                {activity.cover ? (
                  <img
                    src={activity.cover}
                    alt={activity.activityName}
                    onError={(e) => {
                      e.target.style.display = "none";
                      e.target.nextSibling.style.display = "flex";
                    }}
                  />
                ) : null}

                <div className="default-cover" style={{ display: activity.cover ? "none" : "flex" }}></div>


                <div className="latest-info">
                  <h4>{activity.activityName}</h4>
                  <span>{activity.creator}</span>
                  <small>{activity.category}</small>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      {/* ================= Summary + Latest Reports ================= */}

      <div className="dashboard-row">
        <div className="summary-card">
          <div className="card-header">
            <div>
              <h3>System Summary</h3>
              <p>ภาพรวมของระบบ</p>
            </div>
          </div>
          <div className="summary-grid">
            <div>
              <span>Users</span>
              <h2>{stats.totalUsers}</h2>
            </div>
            <div>
              <span>Activities</span>
              <h2>{stats.totalActivities}</h2>
            </div>
            <div>
              <span>Reports</span>
              <h2>{stats.totalReports}</h2>
            </div>
            <div>
              <span>Suspended</span>
              <h2>{stats.suspendedActivities}</h2>
            </div>
          </div>
        </div>
        <div className="report-card">
          <div className="card-header">
            <div>
              <h3>Latest Reports</h3>
              <p>รายงานล่าสุด</p>
            </div>
          </div>
          <div className="report-list">
            {latestReports.map((report) => (
              <div key={report.id} className="report-item" onClick={() => navigate(`/activity-detail?id=${report.activityId}&from=admin`)}>
                <div className="report-icon">🚩</div>
                <div>
                  <h4>{report.activityName}</h4>
                  <p>{report.reason}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ================= Users Table ================= */}

      <section className="table-card">
        <div className="card-header">
          <div>
            <h3>Users</h3>
            <p>ผู้ใช้งานทั้งหมด</p>
          </div>
        </div>

        <div className="table-wrapper">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Name</th>

                <th>Username</th>

                <th>Email</th>

                <th>Role</th>
                <th>Create At</th>

              </tr>

            </thead>

            <tbody>

              {users.map((user) => (

                <tr key={user.id}>

                  <td>{user.name}</td>

                  <td>@{user.username}</td>

                  <td>{user.email}</td>

                  <td>

                    <span className={user.role === "admin" ? "role-badge role-admin" : "role-badge role-user"}>{user.role}</span>

                  </td>
                  <td>{new Date(user.createdAt).toLocaleDateString("en-GB")}</td>

                </tr>

              ))}

            </tbody>

          </table>

        </div>

      </section>

      {/* ================= Activities Table ================= */}

      <section className="table-card">
        <div className="card-header">
          <div>
            <h3>Activities</h3>
            <p>กิจกรรมทั้งหมด</p>
          </div>
        </div>
        <div className="table-wrapper">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Activity</th>
                <th>Creator</th>
                <th>Category</th>
                <th>Participant</th>
                <th>Type</th>
                <th>Create At</th>
              </tr>
            </thead>
            <tbody>
              {activities.map((activity) => (
                <tr key={activity.id}>
                  <td>{activity.activityName}</td>
                  <td>{userMap[activity.createdBy]?.name || "-"}</td>
                  <td>{activity.category}</td>
                  <td>{activity.participantCount}</td>
                  <td>{activity.activityType}</td>
                  <td>{new Date(activity.createdAt).toLocaleDateString("en-GB")}</td>


                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* ================= Reports Table ================= */}

      <section className="table-card">
        <div className="card-header">
          <div>
            <h3>Reports</h3>
            <p>รายงานทั้งหมด</p>
          </div>
        </div>
        <div className="table-wrapper">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Activity</th>
                <th>Reason</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {reports.map((report) => {
                const activity = activities.find((a) => a.id === report.activityId
                );
                return (
                  <tr key={report.id}>
                    <td>{activity?.activityName || "-"}</td>
                    <td>{report.reason}</td>
                    <td>{report.status}</td>
                    <td>
                      <button className="btn btn-detail" onClick={() => navigate(`/activity-detail?id=${report.activityId}&from=admin`)}>View</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
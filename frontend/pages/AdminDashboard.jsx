import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./AdminDashboard.css";
import API_URL from "../config";

export default function AdminDashboard() {
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);

  const [stats, setStats] = useState({
    totalUsers: 0,
    totalActivities: 0,
    pendingReports: 0,
    suspendedActivities: 0,
    totalReports: 0,
    totalCheckins: 0,
  });

  const [users, setUsers] = useState([]);
  const [activities, setActivities] = useState([]);
  const [reports, setReports] = useState([]);

  useEffect(() => {
    const user = JSON.parse(localStorage.getItem("user"));

    if (!user || user.role !== "admin") {
      navigate("/");
      return;
    }

    fetchDashboard();
  }, []);

  const fetchDashboard = async () => {
    const token = localStorage.getItem("token");

    try {
      setLoading(true);

      const [
        statsRes,
        usersRes,
        reportsRes,
        activitiesRes,
      ] = await Promise.all([
        fetch(`${API_URL}/api/admin/dashboard`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }),

        fetch(`${API_URL}/api/admin/users`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }),

        fetch(`${API_URL}/api/admin/reports`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }),

        fetch(`${API_URL}/api/activities`),
      ]);

      const statsData = await statsRes.json();
      const usersData = await usersRes.json();
      const reportsData = await reportsRes.json();
      const activitiesData = await activitiesRes.json();

      setStats(statsData);
      setUsers(usersData);
      setReports(reportsData);
      setActivities(activitiesData);
    } catch (err) {
      console.log(err);
      alert("โหลดข้อมูลไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  };

  const userMap = useMemo(() => {
    const map = {};

    users.forEach((u) => {
      map[u.id] = u;
    });

    return map;
  }, [users]);

  const groupedReports = useMemo(() => {
    const map = {};

    reports.forEach((r) => {
      if (!map[r.activityId]) {
        map[r.activityId] = [];
      }

      map[r.activityId].push(r);
    });

    return map;
  }, [reports]);

  const suspendActivity = async (activityId) => {
    if (!window.confirm("ต้องการระงับกิจกรรมนี้ใช่หรือไม่"))
      return;

    const token = localStorage.getItem("token");

    try {
      const res = await fetch(
        `${API_URL}/api/admin/suspend/${activityId}`,
        {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!res.ok) {
        throw new Error();
      }

      fetchDashboard();
    } catch {
      alert("เกิดข้อผิดพลาด");
    }
  };

  const unsuspendActivity = async (activityId) => {
    const token = localStorage.getItem("token");

    try {
      const res = await fetch(
        `${API_URL}/api/admin/unsuspend/${activityId}`,
        {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!res.ok) {
        throw new Error();
      }

      fetchDashboard();
    } catch {
      alert("เกิดข้อผิดพลาด");
    }
  };

  if (loading) {
    return (
      <div className="admin-loading">
        กำลังโหลดข้อมูล...
      </div>
    );
  }
  return (
  <div className="admin-page">

    <div className="admin-header">

      <div>
        <h1>Admin Dashboard</h1>
        <p>Until We Meet Management System</p>
      </div>

      <button
        className="logout-btn"
        onClick={() => {
          localStorage.removeItem("token");
          localStorage.removeItem("user");
          navigate("/login");
        }}
      >
        Logout
      </button>

    </div>

    {/* ================= Stats ================= */}

    <div className="stats-grid">

      <div className="stat-card users-card">
        <h2>{stats.totalUsers}</h2>
        <span>Users</span>
      </div>

      <div className="stat-card activities-card">
        <h2>{stats.totalActivities}</h2>
        <span>Activities</span>
      </div>

      <div className="stat-card reports-card">
        <h2>{stats.pendingReports}</h2>
        <span>Pending Reports</span>
      </div>

      <div className="stat-card suspended-card">
        <h2>{stats.suspendedActivities}</h2>
        <span>Suspended</span>
      </div>

    </div>

    {/* ================= Users ================= */}

    <section className="admin-card">

      <h2>Users</h2>

      <table>

        <thead>

          <tr>

            <th>Name</th>
            <th>Username</th>
            <th>Email</th>
            <th>Role</th>

          </tr>

        </thead>

        <tbody>

          {users.length === 0 ? (

            <tr>
              <td colSpan="4">
                ไม่มีข้อมูล
              </td>
            </tr>

          ) : (

            users.map((user) => (

              <tr key={user.id}>

                <td>{user.name}</td>

                <td>@{user.username}</td>

                <td>{user.email}</td>

                <td>

                  <span
                    className={
                      user.role === "admin"
                        ? "role admin"
                        : "role user"
                    }
                  >
                    {user.role}
                  </span>

                </td>

              </tr>

            ))

          )}

        </tbody>

      </table>

    </section>

    {/* ================= Activities ================= */}

    <section className="admin-card">

      <h2>Activities</h2>

      <table>

        <thead>

          <tr>

            <th>Activity</th>
            <th>Creator</th>
            <th>Category</th>
            <th>Status</th>
            <th>Action</th>

          </tr>

        </thead>

        <tbody>

          {activities.map((activity) => {

            const creator = userMap[activity.createdBy];

            return (

              <tr key={activity.id}>

                <td>{activity.activityName}</td>

                <td>{creator?.name || "-"}</td>

                <td>{activity.category}</td>

                <td>

                  <span
                    className={
                      activity.isSuspended
                        ? "status suspended"
                        : "status active"
                    }
                  >
                    {activity.isSuspended
                      ? "Suspended"
                      : "Active"}
                  </span>

                </td>

                <td>

                  {activity.isSuspended ? (

                    <button
                      className="unsuspend-btn"
                      onClick={() =>
                        unsuspendActivity(activity.id)
                      }
                    >
                      Unsuspend
                    </button>

                  ) : (

                    <button
                      className="suspend-btn"
                      onClick={() =>
                        suspendActivity(activity.id)
                      }
                    >
                      Suspend
                    </button>

                  )}

                  <button
                    className="detail-btn"
                    onClick={() =>
                      navigate(
                        `/activity-detail?id=${activity.id}&from=admin`
                      )
                    }
                  >
                    Detail
                  </button>

                </td>

              </tr>

            );

          })}

        </tbody>

      </table>

    </section>
        {/* ================= Reports ================= */}

    <section className="admin-card">

      <h2>Reports</h2>

      <table>

        <thead>

          <tr>
            <th>Activity</th>
            <th>Creator</th>
            <th>Reports</th>
            <th>Reasons</th>
            <th>Action</th>
          </tr>

        </thead>

        <tbody>

          {Object.keys(groupedReports).length === 0 ? (

            <tr>

              <td colSpan="5">
                ไม่มีรายงาน
              </td>

            </tr>

          ) : (

            Object.entries(groupedReports).map(
              ([activityId, reportList]) => {

                const activity = activities.find(
                  (item) => item.id === Number(activityId)
                );

                const creator = activity
                  ? userMap[activity.createdBy]
                  : null;

                return (

                  <tr key={activityId}>

                    <td>
                      {activity?.activityName || "-"}
                    </td>

                    <td>
                      {creator?.name || "-"}
                    </td>

                    <td>

                      <span className="report-count">

                        {reportList.length}

                      </span>

                    </td>

                    <td>

                      <div className="reason-list">

                        {reportList.map((report) => (

                          <span
                            key={report.id}
                            className="reason-tag"
                          >
                            {report.reason}
                          </span>

                        ))}

                      </div>

                    </td>

                    <td>

                      {activity?.isSuspended ? (

                        <button
                          className="unsuspend-btn"
                          onClick={() =>
                            unsuspendActivity(activity.id)
                          }
                        >
                          Unsuspend
                        </button>

                      ) : (

                        <button
                          className="suspend-btn"
                          onClick={() =>
                            suspendActivity(activity.id)
                          }
                        >
                          Suspend
                        </button>

                      )}

                      <button
                        className="detail-btn"
                        onClick={() =>
                          navigate(
                            `/activity-detail?id=${activityId}&from=admin`
                          )
                        }
                      >
                        Detail
                      </button>

                    </td>

                  </tr>

                );

              }
            )

          )}

        </tbody>

      </table>

    </section>

  </div>

);

}
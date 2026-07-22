import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  FiActivity,
  FiBell,
  FiCalendar,
  FiChevronDown,
  FiFlag,
  FiGrid,
  FiLogOut,
  FiMoreVertical,
  FiSettings,
  FiStar,
  FiUsers,
} from "react-icons/fi";
import { MdGroups } from "react-icons/md";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import "./AdminDashboard.css";
import API_URL from "../config";

const fallback =
  "https://placehold.co/120x90/ede9fe/6d28d9?text=Activity";

const dateText = (value) =>
  value
    ? new Date(value).toLocaleDateString("th-TH", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : "-";

const ago = (value) => {
  if (!value) return "เมื่อสักครู่";

  const minutes = Math.max(
    1,
    Math.floor((Date.now() - new Date(value).getTime()) / 60000)
  );

  if (minutes < 60) return `${minutes} นาทีที่แล้ว`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} ชั่วโมงที่แล้ว`;

  return `${Math.floor(hours / 24)} วันที่แล้ว`;
};

export default function AdminDashboard() {
  const navigate = useNavigate();
  const token = localStorage.getItem("token");

  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({});
  const [users, setUsers] = useState([]);
  const [activities, setActivities] = useState([]);
  const [chartData, setChartData] = useState([]);
  const [latestActivities, setLatestActivities] = useState([]);
  const [latestReports, setLatestReports] = useState([]);
  const [latestReviews, setLatestReviews] = useState([]);
  const [days, setDays] = useState(7);
  const [showProfileMenu, setShowProfileMenu] = useState(false);

  const admin = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem("user")) || {};
    } catch {
      return {};
    }
  }, []);

  const authHeader = useMemo(
    () => ({
      Authorization: `Bearer ${token}`,
    }),
    [token]
  );

  useEffect(() => {
    if (admin.role !== "admin") {
      navigate("/");
      return;
    }

    loadDashboard();
  }, [days]);

  async function loadDashboard() {
    try {
      setLoading(true);

      const responses = await Promise.all([
        fetch(`${API_URL}/api/admin/dashboard`, { headers: authHeader }),
        fetch(`${API_URL}/api/admin/users`, { headers: authHeader }),
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
        fetch(`${API_URL}/api/admin/latest-reviews`, {
          headers: authHeader,
        }),
      ]);

      const failedResponse = responses.find((response) => !response.ok);

      if (failedResponse) {
        const errorData = await failedResponse.json().catch(() => ({}));
        throw new Error(errorData.message || "โหลดข้อมูลไม่สำเร็จ");
      }

      const [
        dashboardData,
        userData,
        activityData,
        chart,
        latestActivityData,
        latestReportData,
        latestReviewData,
      ] = await Promise.all(responses.map((response) => response.json()));

      setStats(dashboardData || {});
      setUsers(Array.isArray(userData) ? userData : []);
      setActivities(Array.isArray(activityData) ? activityData : []);
      setChartData(Array.isArray(chart) ? chart : []);
      setLatestActivities(
        Array.isArray(latestActivityData) ? latestActivityData : []
      );
      setLatestReports(
        Array.isArray(latestReportData) ? latestReportData : []
      );
      setLatestReviews(
        Array.isArray(latestReviewData) ? latestReviewData : []
      );
    } catch (error) {
      console.error(error);
      alert(error.message || "ไม่สามารถโหลดข้อมูล Dashboard ได้");
    } finally {
      setLoading(false);
    }
  }

  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    navigate("/login");
  };

  const totalParticipants = Number(stats.totalParticipants) || 0;
  const totalReviews = Number(stats.totalReviews) || 0;
  const pending = Number(stats.pendingReports) || 0;
  const adminName = admin.name || admin.username || "Admin";

  const newestUsers = users
    .filter((user) => user.role !== "admin")
    .sort(
      (first, second) =>
        new Date(second.createdAt || 0) - new Date(first.createdAt || 0)
    )
    .slice(0, 4);

  const chart = chartData.map((item) => ({
    ...item,
    activities: Number(item.activities || 0),
    participants: Number(item.participants || 0),
  }));

  const navItems = [
    ["ภาพรวม", <FiGrid />, "/admin", true],
    ["กิจกรรม", <FiCalendar />, "/admin/activities"],
    ["ผู้ใช้งาน", <FiUsers />, "/admin/users"],
    ["รายงานกิจกรรม", <FiFlag />, "/admin/reports", false, pending],
    ["การแจ้งเตือน", <FiBell />, "/admin/notifications", false, pending],
    ["รีวิว", <FiStar />, "/admin/reviews"],
    ["การตั้งค่า", <FiSettings />, "/admin/settings"],
  ];

  if (loading) {
    return <div className="admin-loading">กำลังโหลด Dashboard...</div>;
  }

  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <button className="admin-brand" onClick={() => navigate("/admin")}>
          <span className="admin-brand-logo">
            <MdGroups />
          </span>

          <span>
            <strong>Until We Meet</strong>
            <small>ADMIN PANEL</small>
          </span>
        </button>

        <nav className="admin-nav">
          {navItems.map(([label, icon, path, active, badge]) => (
            <button
              key={label}
              className={`admin-nav-item ${active ? "active" : ""}`}
              onClick={() => navigate(path)}
            >
              <span>{icon}</span>
              <b>{label}</b>
              {badge > 0 && <i>{badge > 99 ? "99+" : badge}</i>}
            </button>
          ))}
        </nav>

        <button className="admin-logout" onClick={logout}>
          <FiLogOut /> ออกจากระบบ
        </button>
      </aside>

      <main className="admin-main">
        <header className="admin-header">
          <div className="admin-greeting">
            <span>สวัสดีตอนบ่าย 👋</span>
            <h1>ยินดีต้อนรับกลับมา, {adminName}</h1>
            <p>นี่คือภาพรวมของระบบ Until We Meet</p>
          </div>

          <div className="admin-header-actions">
            <label className="admin-period">
              <FiCalendar />

              <select
                value={days}
                onChange={(event) => setDays(Number(event.target.value))}
              >
                <option value={7}>7 วันที่ผ่านมา</option>
                <option value={30}>30 วันที่ผ่านมา</option>
                <option value={90}>90 วันที่ผ่านมา</option>
                <option value={365}>1 ปีที่ผ่านมา</option>
              </select>

              <FiChevronDown />
            </label>

            <button
              className="admin-bell"
              onClick={() => navigate("/admin/notifications")}
            >
              <FiBell />
              {pending > 0 && <span>{pending}</span>}
            </button>

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
        </header>

        <section className="admin-stat-grid">
          <Stat
            color="purple"
            icon={<FiCalendar />}
            title="กิจกรรมทั้งหมด"
            value={stats.totalActivities || activities.length}
          />

          <Stat
            color="green"
            icon={<FiUsers />}
            title="ผู้ใช้งานทั้งหมด"
            value={stats.totalUsers || users.length}
          />

          <Stat
            color="blue"
            icon={<MdGroups />}
            title="ผู้เข้าร่วมกิจกรรม"
            value={totalParticipants}
          />

          <Stat
            color="orange"
            icon={<FiStar />}
            title="รีวิวทั้งหมด"
            value={totalReviews}
          />

          <Stat
            color="red"
            icon={<FiFlag />}
            title="รายงานรอตรวจสอบ"
            value={pending}
            danger
          />
        </section>

        <section className="admin-primary-grid">
          <article className="admin-panel">
            <div className="admin-panel-header">
              <div>
                <h2>ภาพรวมกิจกรรม</h2>

                <div className="admin-legend">
                  <span className="p">กิจกรรมที่สร้าง</span>
                  <span className="b">ผู้เข้าร่วม</span>
                </div>
              </div>

              <select
                value={days}
                onChange={(event) => setDays(Number(event.target.value))}
              >
                <option value={7}>7 วันที่ผ่านมา</option>
                <option value={30}>30 วันที่ผ่านมา</option>
                <option value={90}>90 วันที่ผ่านมา</option>
                <option value={365}>1 ปีที่ผ่านมา</option>
              </select>
            </div>

            <div className="admin-chart">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={chart}
                  margin={{ top: 12, right: 10, left: -18, bottom: 0 }}
                >
                  <CartesianGrid
                    stroke="#edf0f7"
                    strokeDasharray="4 4"
                    vertical={false}
                  />

                  <XAxis
                    dataKey="day"
                    axisLine={false}
                    tickLine={false}
                  />

                  <YAxis axisLine={false} tickLine={false} />

                  <Tooltip
                    contentStyle={{
                      borderRadius: 14,
                      border: "1px solid #ececf5",
                    }}
                  />

                  <Line
                    type="monotone"
                    dataKey="activities"
                    name="กิจกรรมที่สร้าง"
                    stroke="#6846f5"
                    strokeWidth={3}
                    dot={false}
                  />

                  <Line
                    type="monotone"
                    dataKey="participants"
                    name="ผู้เข้าร่วม"
                    stroke="#8bb3ff"
                    strokeWidth={3}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </article>

          <article className="admin-panel">
            <div className="admin-panel-header">
              <h2>กิจกรรมล่าสุด</h2>
              <button onClick={() => navigate("/admin/activities")}>
                ดูทั้งหมด
              </button>
            </div>

            <div className="admin-list">
              {latestActivities.slice(0, 4).map((activity) => (
                <button
                  className="admin-activity-row"
                  key={activity.id}
                  onClick={() =>
                    navigate(`/activity-detail?id=${activity.id}&from=admin`)
                  }
                >
                  <img
                    src={activity.cover || fallback}
                    onError={(event) => {
                      event.currentTarget.src = fallback;
                    }}
                    alt=""
                  />

                  <span>
                    <strong>{activity.activityName}</strong>
                    <small>สร้างโดย @{activity.creator}</small>
                  </span>

                  <span className="status">
                    <small>{dateText(activity.createdAt)}</small>
                    <em>
                      {activity.status === "suspended"
                        ? "ระงับแล้ว"
                        : "เผยแพร่แล้ว"}
                    </em>
                  </span>

                  <FiMoreVertical />
                </button>
              ))}

              {latestActivities.length === 0 && (
                <div className="admin-empty">ยังไม่มีกิจกรรม</div>
              )}
            </div>
          </article>
        </section>

        <section className="admin-secondary-grid">
          <article className="admin-panel">
            <div className="admin-panel-header">
              <h2>
                รายงานที่รอตรวจสอบ <i className="count">{pending}</i>
              </h2>

              <button onClick={() => navigate("/admin/reports")}>
                ดูทั้งหมด
              </button>
            </div>

            <div className="admin-list">
              {latestReports.slice(0, 3).map((report) => (
                <button
                  className="admin-report-row"
                  key={report.id}
                  onClick={() =>
                    navigate(
                      `/activity-detail?id=${report.activityId}&from=admin`
                    )
                  }
                >
                  <span className="flag">
                    <FiFlag />
                  </span>

                  <span>
                    <strong>กิจกรรม: {report.activityName}</strong>
                    <small>เหตุผล: {report.reason}</small>
                    <small>โดย @{report.reporterUsername}</small>
                  </span>

                  <span className="report-time">
                    {ago(report.createdAt)} <i />
                  </span>
                </button>
              ))}

              {latestReports.length === 0 && (
                <div className="admin-empty">ไม่มีรายงานที่รอตรวจสอบ</div>
              )}
            </div>
          </article>

          <article className="admin-panel">
            <div className="admin-panel-header">
              <h2>รีวิวล่าสุด</h2>

              <button onClick={() => navigate("/admin/reviews")}>
                ดูทั้งหมด
              </button>
            </div>

            <div className="admin-list">
              {latestReviews.slice(0, 3).map((review) => (
                <button
                  className="admin-report-row"
                  key={review.id}
                  onClick={() =>
                    navigate(
                      `/activity-detail?id=${review.activityId}&from=admin`
                    )
                  }
                >
                  <span className="flag">
                    <FiStar />
                  </span>

                  <span>
                    <strong>{review.activityName}</strong>

                    <small>
                      {"★".repeat(Math.max(0, Math.min(5, review.rating)))}
                      {"☆".repeat(Math.max(0, 5 - review.rating))}
                    </small>

                    <small>
                      {review.comment || `รีวิวโดย @${review.reviewerUsername}`}
                    </small>
                  </span>

                  <span className="report-time">
                    {ago(review.createdAt)}
                  </span>
                </button>
              ))}

              {latestReviews.length === 0 && (
                <div className="admin-empty">ยังไม่มีรีวิว</div>
              )}
            </div>
          </article>

          <article className="admin-panel">
            <div className="admin-panel-header">
              <h2>ผู้ใช้งานใหม่ล่าสุด</h2>

              <button onClick={() => navigate("/admin/users")}>
                ดูทั้งหมด
              </button>
            </div>

            <div className="admin-list">
              {newestUsers.map((user) => {
                const name = user.username || user.name || "ผู้ใช้";

                return (
                  <div className="admin-user-row" key={user.id}>
                    <span className="avatar">
                      {name[0]?.toUpperCase()}
                    </span>

                    <span>
                      <strong>{name}</strong>
                      <small>เข้าร่วมเมื่อ {dateText(user.createdAt)}</small>
                    </span>

                    <button
                      onClick={() => navigate(`/admin/users?id=${user.id}`)}
                    >
                      View
                    </button>
                  </div>
                );
              })}

              {newestUsers.length === 0 && (
                <div className="admin-empty">ยังไม่มีผู้ใช้งานใหม่</div>
              )}
            </div>
          </article>
        </section>
      </main>
    </div>
  );
}

function Stat({ color, icon, title, value, danger }) {
  return (
    <article className="admin-stat-card">
      <FiMoreVertical className="more" />

      <span className={`admin-stat-icon ${color}`}>{icon}</span>

      <span>
        <small>{title}</small>
        <strong>{Number(value || 0).toLocaleString("th-TH")}</strong>
      </span>

      <p className={danger ? "danger" : ""}>
        <FiActivity /> ข้อมูลปัจจุบันของระบบ
      </p>
    </article>
  );
}

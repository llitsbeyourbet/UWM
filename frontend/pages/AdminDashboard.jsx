import { useEffect, useMemo, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  FiActivity, FiBell,
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
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import "./AdminDashboard.css";
import API_URL from "../config";
import { getCategoryIcon } from "../utils/categoryIcons";

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

const chartDateText = (value) => {
  if (!value) return "";

  return new Date(`${value}T00:00:00`).toLocaleDateString("th-TH", {
    day: "numeric",
    month: "short",
  });
};

const ChartTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;

  return (
    <div className="admin-chart-tooltip">
      <strong>{chartDateText(label)}</strong>

      {payload.map((item) => (
        <div key={item.dataKey}>
          <span
            className={`tooltip-dot ${item.dataKey === "activities" ? "purple" : "blue"
              }`}
          />

          <span>{item.name}</span>
          <b>{Number(item.value || 0).toLocaleString("th-TH")}</b>
        </div>
      ))}
    </div>
  );
};

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

function CategoryTick({ x, y, payload }) {
  const value = String(payload.value || "");

  const firstSpace = value.indexOf(" ");

  const icon =
    firstSpace !== -1 ? value.slice(0, firstSpace) : "";

  const label =
    firstSpace !== -1 ? value.slice(firstSpace + 1) : value;

  return (
    <g transform={`translate(${x},${y})`}>
      <text
        x={-92}
        y={4}
        textAnchor="middle"
        fontSize={13}
      >
        {icon}
      </text>

      <text
        x={-75}
        y={4}
        textAnchor="start"
        fill="#626a82"
        fontSize={12}
        fontWeight={500}
      >
        {label}
      </text>
    </g>
  );
}

export default function AdminDashboard() {
  const navigate = useNavigate();
  const token = localStorage.getItem("token");

  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({});
  const [users, setUsers] = useState([]);
  const [activities, setActivities] = useState([]);
  const [categoryChartData, setCategoryChartData] = useState([]);
  const [statusChartData, setStatusChartData] = useState([]);
  const [latestActivities, setLatestActivities] = useState([]);
  const [latestReports, setLatestReports] = useState([]);
  const [days, setDays] = useState(7);
  const [openPeriod, setOpenPeriod] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const periodRef = useRef(null);


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
        fetch(`${API_URL}/api/admin/chart-categories?days=${days}`, {
          headers: authHeader,
        }),
        fetch(`${API_URL}/api/admin/chart-status?days=${days}`, {
          headers: authHeader,
        }),
        fetch(`${API_URL}/api/admin/latest-activities`, {
          headers: authHeader,
        }),
        fetch(`${API_URL}/api/admin/latest-reports`, {
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
        categoryChart,
        statusChart,
        latestActivityData,
        latestReportData,
      ] = await Promise.all(responses.map((response) => response.json()));

      setStats(dashboardData || {});
      setUsers(Array.isArray(userData) ? userData : []);
      setActivities(Array.isArray(activityData) ? activityData : []);
      setCategoryChartData(
        Array.isArray(categoryChart) ? categoryChart : []
      );
      setStatusChartData(
        Array.isArray(statusChart) ? statusChart : []
      );
      setLatestActivities(
        Array.isArray(latestActivityData) ? latestActivityData : []
      );
      setLatestReports(
        Array.isArray(latestReportData) ? latestReportData : []
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

  const totalReviews = Number(stats.totalReviews) || 0;
  const pending = Number(stats.pendingReports) || 0;

  const publishedActivities =
    Number(stats.publishedActivities) || 0;

  const suspendedActivities =
    Number(stats.suspendedActivities) || 0;

  const adminName = admin.name || admin.username || "Admin";

  const newestUsers = users
    .filter((user) => user.role !== "admin")
    .sort(
      (first, second) =>
        new Date(second.createdAt || 0) - new Date(first.createdAt || 0)
    )
    .slice(0, 4);

  const categoryChart = categoryChartData.map((item) => ({
    ...item,
    count: Number(item.count || 0),
    categoryLabel: `${getCategoryIcon(item.category)} ${item.category}`,
  }));

  const statusChart = statusChartData.map((item) => ({
    ...item,
    value: Number(item.value || 0),
  }));

  const statusTotal = statusChart.reduce(
    (sum, item) => sum + item.value,
    0
  );

  const STATUS_COLORS = [
    "#7c5cff",
    "#36b9cc",
    "#a0a6b8",
    "#ef476f",
  ];

  const navItems = [
    ["ภาพรวม", <FiGrid />, "/admin", true],
    ["กิจกรรม", <FiCalendar />, "/admin/activities"],
    ["ผู้ใช้งาน", <FiUsers />, "/admin/users"],
    ["รายงานกิจกรรม", <FiFlag />, "/admin/reports"],
    ["รีวิว", <FiStar />, "/admin/reviews"],
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
            <h1>ยินดีต้อนรับกลับมา, {adminName}</h1>
            <p>นี่คือภาพรวมของระบบ Until We Meet</p>
          </div>

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
            icon={<FiActivity />}
            title="กิจกรรมที่เผยแพร่"
            value={publishedActivities}
          />
          <Stat
            color="red"
            icon={<FiFlag />}
            title="กิจกรรมที่ถูกระงับ"
            value={suspendedActivities}
          />

          <Stat
            color="blue"
            icon={<FiUsers />}
            title="ผู้ใช้งานทั้งหมด"
            value={stats.totalUsers || users.length}
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
                <h2>กิจกรรมตามหมวดหมู่</h2>
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
                <BarChart
                  data={categoryChart}
                  layout="vertical"
                  margin={{ top: 5, right: 45, left: 0, bottom: 20 }}
                >
                  <CartesianGrid
                    stroke="#eef0f6"
                    strokeDasharray="3 6"
                    horizontal={false}
                  />

                  <XAxis
                    type="number"
                    allowDecimals={false}
                    axisLine={false}
                    tickLine={false}
                    tick={{
                      fill: "#8189a2",
                      fontSize: 11,
                    }}
                    label={{
                      value: "จำนวนกิจกรรม",
                      position: "insideBottom",
                      offset: -18,
                      fill: "#69728c",
                      fontSize: 12,
                    }}
                  />

                  <YAxis
                    type="category"
                    dataKey="categoryLabel"
                    axisLine={false}
                    tickLine={false}
                    width={115}
                    interval={0}
                    tick={<CategoryTick />}
                  />

                  <Tooltip
                    formatter={(value) => [
                      `${Number(value).toLocaleString("th-TH")} กิจกรรม`,
                      "จำนวนกิจกรรม",
                    ]}
                    cursor={{
                      fill: "rgba(104, 70, 245, 0.05)",
                    }}
                  />

                  <Bar
                    dataKey="count"
                    name="จำนวนกิจกรรม"
                    fill="#6846f5"
                    maxBarSize={24}
                  >
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </article>
          <article className="admin-panel">
            <div className="admin-panel-header">
              <div>
                <h2>สถานะกิจกรรม</h2>
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

            <div className="admin-status-chart">
              <div className="admin-donut">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={statusChart}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={72}
                      outerRadius={100}
                      paddingAngle={3}
                      stroke="none"
                    >
                      {statusChart.map((item, index) => (
                        <Cell
                          key={item.status}
                          fill={STATUS_COLORS[index % STATUS_COLORS.length]}
                        />
                      ))}
                    </Pie>

                    <Tooltip
                      formatter={(value, name) => [
                        `${Number(value).toLocaleString("th-TH")} กิจกรรม`,
                        name,
                      ]}
                    />
                  </PieChart>
                </ResponsiveContainer>

                <div className="admin-donut-center">
                  <strong>{statusTotal.toLocaleString("th-TH")}</strong>
                  <span>กิจกรรม</span>
                </div>
              </div>

              <div className="admin-status-legend">
                {statusChart.map((item, index) => (
                  <div key={item.status}>
                    <span
                      className="admin-status-dot"
                      style={{
                        background:
                          STATUS_COLORS[index % STATUS_COLORS.length],
                      }}
                    />

                    <span>{item.name}</span>

                    <strong>
                      {item.value.toLocaleString("th-TH")}
                    </strong>
                  </div>
                ))}
              </div>
            </div>
          </article>

        </section>

        <section className="admin-secondary-grid">

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

                    <em
                      className={
                        activity.status === "suspended"
                          ? "status-suspended"
                          : "status-active"
                      }
                    >
                      {activity.status === "suspended"
                        ? "ระงับแล้ว"
                        : "เผยแพร่แล้ว"}
                    </em>
                  </span>

                  <FiMoreVertical />
                </button>
              ))}

              {latestActivities.length === 0 && (
                <div className="admin-empty">
                  ยังไม่มีกิจกรรม
                </div>
              )}
            </div>
          </article>
          <article className="admin-panel">
            <div className="admin-panel-header">
              <h2>
                รายงานล่าสุด
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
                    {ago(report.createdAt)}
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

      <span className={`admin-stat-icon ${color}`}>{icon}</span>

      <span>
        <small>{title}</small>
        <strong>{Number(value || 0).toLocaleString("th-TH")}</strong>
      </span>

    </article>
  );
}

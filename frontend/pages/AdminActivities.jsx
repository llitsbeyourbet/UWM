import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  FiBell,
  FiCalendar,
  FiChevronLeft,
  FiChevronRight,
  FiEye,
  FiFlag,
  FiGrid,
  FiLogOut,
  FiMapPin,
  FiSearch,
  FiSettings,
  FiStar,
  FiUsers,
} from "react-icons/fi";
import { MdGroups } from "react-icons/md";

import API_URL from "../config";
import "./AdminDashboard.css";
import "./AdminActivities.css";

const ITEMS_PER_PAGE = 6;

const FALLBACK_IMAGE =
  "https://placehold.co/320x220/f0edff/6846f5?text=Activity";

const formatDate = (value) => {
  if (!value) return "-";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "-";

  return date.toLocaleDateString("th-TH", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
};

const normalizeStatus = (activity) => {
  const status = String(activity.status || "").toLowerCase();

  if (
    activity.isSuspended ||
    ["suspended", "blocked", "disabled"].includes(status)
  ) {
    return "suspended";
  }

  if (
    activity.isDraft ||
    ["draft", "pending"].includes(status)
  ) {
    return "draft";
  }

  return "published";
};

export default function AdminActivities() {
  const navigate = useNavigate();
  const token = localStorage.getItem("token");

  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [activeStatus, setActiveStatus] = useState("all");
  const [search, setSearch] = useState("");
  const [sortOrder, setSortOrder] = useState("latest");
  const [page, setPage] = useState(1);

  const admin = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem("user")) || {};
    } catch {
      return {};
    }
  }, []);

  const navItems = [
    ["ภาพรวม", <FiGrid />, "/admin"],
    ["กิจกรรม", <FiCalendar />, "/admin/activities", true],
    ["ผู้ใช้งาน", <FiUsers />, "/admin/users"],
    ["รายงานกิจกรรม", <FiFlag />, "/admin/reports"],
    ["การแจ้งเตือน", <FiBell />, "/admin/notifications"],
    ["รีวิว", <FiStar />, "/admin/reviews"],
    ["การตั้งค่า", <FiSettings />, "/admin/settings"],
  ];

  useEffect(() => {
    if (admin.role !== "admin") {
      navigate("/");
      return;
    }

    loadActivities();
  }, []);

  const loadActivities = async () => {
    try {
      setLoading(true);
      setError("");

      const response = await fetch(`${API_URL}/api/activities`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json().catch(() => []);

      if (!response.ok) {
        throw new Error(data?.message || "โหลดข้อมูลกิจกรรมไม่สำเร็จ");
      }

      const list = Array.isArray(data)
        ? data
        : Array.isArray(data?.activities)
          ? data.activities
          : [];

      setActivities(list);
    } catch (err) {
      console.error(err);
      setError(err.message || "ไม่สามารถโหลดข้อมูลกิจกรรมได้");
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    navigate("/login");
  };

  const counts = useMemo(() => {
    return activities.reduce(
      (result, activity) => {
        const status = normalizeStatus(activity);

        result.all += 1;
        result[status] += 1;

        return result;
      },
      {
        all: 0,
        published: 0,
        suspended: 0,
        draft: 0,
      }
    );
  }, [activities]);

  const filteredActivities = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    const result = activities.filter((activity) => {
      const status = normalizeStatus(activity);

      const matchesStatus =
        activeStatus === "all" || status === activeStatus;

      const searchableText = [
        activity.activityName,
        activity.title,
        activity.creator,
        activity.creatorUsername,
        activity.location,
        activity.category,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      const matchesSearch =
        !keyword || searchableText.includes(keyword);

      return matchesStatus && matchesSearch;
    });

    return [...result].sort((a, b) => {
      const dateA = new Date(
        a.createdAt || a.activityDate || a.date || 0
      ).getTime();

      const dateB = new Date(
        b.createdAt || b.activityDate || b.date || 0
      ).getTime();

      return sortOrder === "oldest" ? dateA - dateB : dateB - dateA;
    });
  }, [activities, activeStatus, search, sortOrder]);

  const totalPages = Math.max(
    1,
    Math.ceil(filteredActivities.length / ITEMS_PER_PAGE)
  );

  const visibleActivities = filteredActivities.slice(
    (page - 1) * ITEMS_PER_PAGE,
    page * ITEMS_PER_PAGE
  );

  useEffect(() => {
    setPage(1);
  }, [activeStatus, search, sortOrder]);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  const openActivity = (activity) => {
    const activityId = activity.id || activity._id;

    if (!activityId) return;

    navigate(`/activity-detail?id=${activityId}&from=admin`);
  };

  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <button
          type="button"
          className="admin-brand"
          onClick={() => navigate("/admin")}
        >
          <span className="admin-brand-logo">
            <MdGroups />
          </span>

          <span>
            <strong>Until We Meet</strong>
            <small>ADMIN PANEL</small>
          </span>
        </button>

        <nav className="admin-nav">
          {navItems.map(([label, icon, path, active]) => (
            <button
              type="button"
              key={label}
              className={`admin-nav-item ${active ? "active" : ""}`}
              onClick={() => navigate(path)}
            >
              <span>{icon}</span>
              <b>{label}</b>
            </button>
          ))}
        </nav>

        <button
          type="button"
          className="admin-logout"
          onClick={logout}
        >
          <FiLogOut />
          ออกจากระบบ
        </button>
      </aside>

      <main className="admin-main">
        <div className="admin-activities-page">
          <header className="activities-topbar">
            <div className="activities-breadcrumb">
              <button
                type="button"
                onClick={() => navigate("/admin")}
              >
                หน้าหลัก
              </button>

              <span>/</span>
              <strong>กิจกรรม</strong>
            </div>

            <button
              type="button"
              className="activities-notification-button"
              onClick={() => navigate("/admin/notifications")}
              aria-label="เปิดการแจ้งเตือน"
            >
              <FiBell />
            </button>
          </header>

          <section className="activities-panel">
            <div className="activities-heading">
              <div className="activities-heading-left">
                <span className="activities-heading-icon">
                  <FiCalendar />
                </span>

                <div>
                  <h1>จัดการกิจกรรม</h1>
                  <p>ตรวจสอบและจัดการกิจกรรมทั้งหมดในระบบ</p>
                </div>
              </div>

              <div className="activities-total-summary">
                <strong>
                  {counts.all.toLocaleString("th-TH")}
                </strong>
                <span>กิจกรรมทั้งหมด</span>
              </div>
            </div>

            <nav
              className="activities-tabs"
              aria-label="สถานะกิจกรรม"
            >
              {[
                ["all", "ทั้งหมด"],
                ["published", "เผยแพร่แล้ว"],
                ["suspended", "ระงับแล้ว"],
                ["draft", "ฉบับร่าง"],
              ].map(([key, label]) => (
                <button
                  type="button"
                  key={key}
                  className={activeStatus === key ? "active" : ""}
                  onClick={() => setActiveStatus(key)}
                >
                  {label}
                  <span>{counts[key].toLocaleString("th-TH")}</span>
                </button>
              ))}
            </nav>

            <div className="activities-toolbar">
              <div className="activities-toolbar-left">
                <label className="activities-select">
                  <select
                    value={activeStatus}
                    onChange={(event) =>
                      setActiveStatus(event.target.value)
                    }
                    aria-label="กรองสถานะกิจกรรม"
                  >
                    <option value="all">ทุกสถานะ</option>
                    <option value="published">เผยแพร่แล้ว</option>
                    <option value="suspended">ระงับแล้ว</option>
                    <option value="draft">ฉบับร่าง</option>
                  </select>
                </label>

                <label className="activities-select">
                  <select
                    value={sortOrder}
                    onChange={(event) =>
                      setSortOrder(event.target.value)
                    }
                    aria-label="เรียงลำดับกิจกรรม"
                  >
                    <option value="latest">วันที่ล่าสุด</option>
                    <option value="oldest">วันที่เก่าสุด</option>
                  </select>
                </label>
              </div>

              <label className="activities-search">
                <FiSearch />

                <input
                  type="search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="ค้นหากิจกรรมหรือผู้สร้าง..."
                />
              </label>
            </div>

            {loading ? (
              <div className="activities-state">
                <span className="activities-loader" />
                <strong>กำลังโหลดกิจกรรม</strong>
              </div>
            ) : error ? (
              <div className="activities-state activities-error">
                <FiCalendar />
                <strong>โหลดข้อมูลไม่สำเร็จ</strong>
                <p>{error}</p>

                <button type="button" onClick={loadActivities}>
                  ลองอีกครั้ง
                </button>
              </div>
            ) : visibleActivities.length === 0 ? (
              <div className="activities-state">
                <FiCalendar />
                <strong>ไม่พบกิจกรรม</strong>
                <p>ยังไม่มีกิจกรรมที่ตรงกับตัวกรองหรือคำค้นหา</p>
              </div>
            ) : (
              <div className="activities-grid">
                {visibleActivities.map((activity) => {
                  const activityId = activity.id || activity._id;
                  const status = normalizeStatus(activity);

                  const activityName =
                    activity.activityName ||
                    activity.title ||
                    "ไม่ระบุชื่อกิจกรรม";

                  const cover =
                    activity.cover ||
                    activity.coverImage ||
                    activity.image ||
                    FALLBACK_IMAGE;

                  const creator =
                    activity.creator ||
                    activity.creatorUsername ||
                    activity.user?.username ||
                    "ผู้ใช้งาน";

                  const participantCount = Number(
                    activity.participantCount ||
                    activity.participantsCount ||
                    activity.participants?.length ||
                    0
                  );

                  return (
                    <article
                      className="activity-admin-card"
                      key={activityId}
                    >
                      <div className="activity-admin-cover">
                        <img
                          src={cover}
                          alt={activityName}
                          onError={(event) => {
                            event.currentTarget.src = FALLBACK_IMAGE;
                          }}
                        />

                        <span
                          className={`activity-admin-status status-${status}`}
                        >
                          {status === "published" && "เผยแพร่แล้ว"}
                          {status === "suspended" && "ระงับแล้ว"}
                          {status === "draft" && "ฉบับร่าง"}
                        </span>
                      </div>

                      <div className="activity-admin-content">
                        <span className="activity-admin-category">
                          {activity.category || "กิจกรรมทั่วไป"}
                        </span>

                        <h2>{activityName}</h2>

                        <p className="activity-admin-creator">
                          สร้างโดย @{creator}
                        </p>

                        <div className="activity-admin-meta">
                          <span>
                            <FiMapPin />
                            {activity.location || "ไม่ระบุสถานที่"}
                          </span>

                          <span>
                            <FiCalendar />
                            {formatDate(
                              activity.activityDate ||
                              activity.date ||
                              activity.createdAt
                            )}
                          </span>

                          <span>
                            <FiUsers />
                            {participantCount.toLocaleString("th-TH")} คน
                          </span>
                        </div>
                      </div>

                      <div className="activity-admin-actions">
                        <button
                          type="button"
                          className="activity-view-button"
                          onClick={() => openActivity(activity)}
                        >
                          <FiEye />
                          ดูรายละเอียด
                        </button>

                        <button
                          type="button"
                          className="activity-manage-button"
                          onClick={() =>
                            navigate(`/admin/activities/${activityId}`)
                          }
                        >
                          จัดการ
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}

            {!loading && !error && filteredActivities.length > 0 && (
              <footer className="activities-pagination">
                <button
                  type="button"
                  disabled={page === 1}
                  onClick={() => setPage((value) => value - 1)}
                  aria-label="หน้าก่อนหน้า"
                >
                  <FiChevronLeft />
                </button>

                {Array.from(
                  { length: totalPages },
                  (_, index) => index + 1
                ).map((pageNumber) => (
                  <button
                    type="button"
                    key={pageNumber}
                    className={page === pageNumber ? "active" : ""}
                    onClick={() => setPage(pageNumber)}
                  >
                    {pageNumber}
                  </button>
                ))}

                <button
                  type="button"
                  disabled={page === totalPages}
                  onClick={() => setPage((value) => value + 1)}
                  aria-label="หน้าถัดไป"
                >
                  <FiChevronRight />
                </button>
              </footer>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}
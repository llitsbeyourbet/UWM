import { useEffect, useMemo, useState } from "react";
import {
  FiAlertTriangle,
  FiCalendar,
  FiCheck,
  FiChevronLeft,
  FiChevronRight,
  FiEye,
  FiMapPin,
  FiSearch,
  FiUser,
  FiX,
  FiXCircle,
} from "react-icons/fi";

import API_URL from "../config";
import "../styles/AdminDashboard.css";
import "../styles/AdminModeration.css";
import AdminSidebar from "../components/AdminSidebar";
import AdminProfile from "../components/AdminProfile";

const ITEMS_PER_PAGE = 8;

const formatDate = (value) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleDateString("th-TH", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
};

const formatConfidence = (value) => {
  const number = Number(value);
  if (Number.isNaN(number)) return "0%";
  return `${(number * 100).toFixed(1)}%`;
};

const getItemStatus = (flags = []) => {
  if (flags.some((flag) => flag.status === "pending")) return "pending";
  if (flags.some((flag) => flag.status === "actioned")) return "actioned";
  return "reviewed";
};

const STATUS_LABELS = {
  pending: "รอตรวจสอบ",
  reviewed: "ตรวจสอบแล้ว",
  actioned: "ดำเนินการแล้ว",
};

const FILTERS = [
  ["all", "ทั้งหมด"],
  ["pending", "รอตรวจสอบ"],
  ["reviewed", "ตรวจสอบแล้ว"],
  ["actioned", "ดำเนินการแล้ว"],
];

export default function AdminModerationActivities() {
  const [activities, setActivities] = useState([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedActivity, setSelectedActivity] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const getToken = () => sessionStorage.getItem("token");

  const loadActivities = async () => {
    try {
      setLoading(true);
      setError("");

      const response = await fetch(
        `${API_URL}/api/admin/moderation/activities`,
        {
          headers: {
            Authorization: `Bearer ${getToken()}`,
          },
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message || "โหลดรายการกิจกรรมที่ต้องตรวจสอบไม่สำเร็จ"
        );
      }

      setActivities(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
      setError(
        err.message || "ไม่สามารถโหลดรายการกิจกรรมที่ต้องตรวจสอบได้"
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadActivities();
  }, []);

  useEffect(() => {
    setPage(1);
  }, [search, statusFilter]);

  useEffect(() => {
    if (!selectedActivity) return undefined;

    const handleKeyDown = (event) => {
      if (event.key === "Escape" && !actionLoading) {
        setSelectedActivity(null);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    document.body.classList.add("admin-moderation-panel-open");

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.classList.remove("admin-moderation-panel-open");
    };
  }, [selectedActivity, actionLoading]);

  const pendingCount = useMemo(
    () =>
      activities.filter(
        (activity) =>
          getItemStatus(activity.moderationFlags) === "pending"
      ).length,
    [activities]
  );

  const filteredActivities = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    return activities.filter((activity) => {
      const itemStatus = getItemStatus(activity.moderationFlags);

      if (statusFilter !== "all" && itemStatus !== statusFilter) {
        return false;
      }

      if (!keyword) return true;

      const flagText = (activity.moderationFlags || [])
        .map(
          (flag) =>
            `${flag.field || ""} ${flag.fieldLabel || ""} ${
              flag.label || ""
            } ${flag.labelText || flag.categoryLabel || ""}`
        )
        .join(" ");

      return [
        activity.activityName,
        activity.creatorName,
        activity.creatorUsername,
        activity.location,
        flagText,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(keyword);
    });
  }, [activities, search, statusFilter]);

  const totalPages = Math.max(
    1,
    Math.ceil(filteredActivities.length / ITEMS_PER_PAGE)
  );

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const visibleActivities = filteredActivities.slice(
    (page - 1) * ITEMS_PER_PAGE,
    page * ITEMS_PER_PAGE
  );

  const getPaginationNumbers = () => {
    if (totalPages <= 5) {
      return Array.from(
        { length: totalPages },
        (_, index) => index + 1
      );
    }

    if (page <= 3) return [1, 2, 3, "...", totalPages];

    if (page >= totalPages - 2) {
      return [
        1,
        "...",
        totalPages - 2,
        totalPages - 1,
        totalPages,
      ];
    }

    return [1, "...", page, "...", totalPages];
  };

  const openActivity = async (activityId) => {
    try {
      setDetailLoading(true);

      const response = await fetch(
        `${API_URL}/api/admin/moderation/activities/${activityId}`,
        {
          headers: {
            Authorization: `Bearer ${getToken()}`,
          },
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message || "โหลดรายละเอียดกิจกรรมไม่สำเร็จ"
        );
      }

      setSelectedActivity(data);
    } catch (err) {
      console.error(err);
      window.alert(
        err.message || "ไม่สามารถโหลดรายละเอียดกิจกรรมได้"
      );
    } finally {
      setDetailLoading(false);
    }
  };

  const handleReviewed = async () => {
    if (!selectedActivity || actionLoading) return;

    const confirmed = window.confirm(
      "ยืนยันว่าตรวจสอบกิจกรรมนี้แล้วและไม่ต้องดำเนินการเพิ่มเติม?"
    );

    if (!confirmed) return;

    try {
      setActionLoading(true);

      const response = await fetch(
        `${API_URL}/api/admin/moderation/activities/${selectedActivity.id}/reviewed`,
        {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${getToken()}`,
            "Content-Type": "application/json",
          },
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message || "บันทึกผลการตรวจสอบไม่สำเร็จ"
        );
      }

      setSelectedActivity(null);
      await loadActivities();
    } catch (err) {
      console.error(err);
      window.alert(
        err.message || "ไม่สามารถบันทึกผลการตรวจสอบได้"
      );
    } finally {
      setActionLoading(false);
    }
  };

  const handleSuspend = async () => {
    if (!selectedActivity || actionLoading) return;

    const confirmed = window.confirm(
      `ยืนยันการระงับกิจกรรม "${selectedActivity.activityName}" ?`
    );

    if (!confirmed) return;

    try {
      setActionLoading(true);

      const response = await fetch(
        `${API_URL}/api/admin/moderation/activities/${selectedActivity.id}/suspend`,
        {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${getToken()}`,
            "Content-Type": "application/json",
          },
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message || "ระงับกิจกรรมไม่สำเร็จ"
        );
      }

      setSelectedActivity(null);
      await loadActivities();
    } catch (err) {
      console.error(err);
      window.alert(
        err.message || "ไม่สามารถระงับกิจกรรมได้"
      );
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="admin-shell">
      <AdminSidebar />

      <main className="admin-main">
        <div className="admin-moderation-page">
          <div className="admin-moderation-topbar">
            <div className="admin-moderation-breadcrumb">
              <span>หน้าหลัก</span>
              <b>/</b>
              <strong>กิจกรรมที่ต้องตรวจสอบ</strong>
            </div>

            <AdminProfile />
          </div>

          <section className="admin-moderation-heading">
            <div className="admin-moderation-title">
              <span className="admin-moderation-title-icon">
                <FiAlertTriangle />
              </span>

              <div>
                <h1>กิจกรรมที่ต้องตรวจสอบ</h1>
                <p>
                  ตรวจสอบกิจกรรมที่ระบบ AI
                  ตรวจพบข้อความที่อาจไม่เหมาะสม
                </p>
              </div>
            </div>

            <div className="admin-moderation-total">
              <span>
                <FiAlertTriangle />
              </span>

              <div>
                <small>รอตรวจสอบ</small>
                <strong>{pendingCount}</strong>
              </div>
            </div>
          </section>

          <section className="admin-moderation-content">
            <div className="admin-moderation-section-head">
              <div>
                <h2>รายการกิจกรรม</h2>
                <p>
                  แสดงกิจกรรมทั้งหมดที่ AI เคยตรวจพบข้อความที่อาจไม่เหมาะสม
                </p>
              </div>

              <div className="admin-moderation-toolbar">
                <div className="admin-moderation-filters">
                  {FILTERS.map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      className={
                        statusFilter === value ? "active" : ""
                      }
                      onClick={() => setStatusFilter(value)}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                <label className="admin-moderation-search">
                  <FiSearch />
                  <input
                    type="search"
                    value={search}
                    onChange={(event) =>
                      setSearch(event.target.value)
                    }
                    placeholder="ค้นหากิจกรรมหรือผู้สร้าง..."
                  />
                </label>
              </div>
            </div>

            {loading ? (
              <div className="admin-moderation-state">
                <span className="admin-moderation-loader" />
                <strong>กำลังโหลดข้อมูล</strong>
              </div>
            ) : error ? (
              <div className="admin-moderation-state">
                <FiAlertTriangle />
                <strong>โหลดข้อมูลไม่สำเร็จ</strong>
                <p>{error}</p>
                <button type="button" onClick={loadActivities}>
                  ลองอีกครั้ง
                </button>
              </div>
            ) : visibleActivities.length === 0 ? (
              <div className="admin-moderation-state">
                <FiCheck />
                <strong>ไม่พบรายการกิจกรรม</strong>
                <p>
                  ไม่มีข้อมูลที่ตรงกับสถานะหรือคำค้นหาที่เลือก
                </p>
              </div>
            ) : (
              <div className="admin-moderation-table-wrapper">
                <table className="admin-moderation-table">
                  <thead>
                    <tr>
                      <th>กิจกรรม</th>
                      <th>ผู้สร้าง</th>
                      <th>AI ตรวจพบ</th>
                      <th>สถานะ</th>
                      <th>จำนวนจุด</th>
                      <th>ตรวจสอบ</th>
                    </tr>
                  </thead>

                  <tbody>
                    {visibleActivities.map((activity) => {
                      const status = getItemStatus(
                        activity.moderationFlags
                      );

                      return (
                        <tr key={activity.id}>
                          <td>
                            <div className="admin-moderation-activity">
                              <div className="admin-moderation-cover">
                                {activity.cover ? (
                                  <img
                                    src={activity.cover}
                                    alt={activity.activityName}
                                  />
                                ) : (
                                  <FiCalendar />
                                )}
                              </div>

                              <div>
                                <strong>
                                  {activity.activityName}
                                </strong>

                                <span>
                                  <FiMapPin />
                                  {activity.location ||
                                    "ไม่ระบุสถานที่"}
                                </span>
                              </div>
                            </div>
                          </td>

                          <td>
                            <div className="admin-moderation-user">
                              <FiUser />

                              <div>
                                <strong>
                                  {activity.creatorName ||
                                    "ไม่ระบุชื่อ"}
                                </strong>

                                {activity.creatorUsername && (
                                  <span>
                                    @{activity.creatorUsername}
                                  </span>
                                )}
                              </div>
                            </div>
                          </td>

                          <td>
                            <div className="admin-moderation-labels">
                              {(activity.moderationFlags || [])
                                .slice(0, 2)
                                .map((flag) => (
                                  <span key={flag.id}>
                                    {flag.labelText ||
                                      flag.categoryLabel ||
                                      flag.label}
                                  </span>
                                ))}
                            </div>
                          </td>

                          <td>
                            <span
                              className={`admin-moderation-status ${status}`}
                            >
                              {STATUS_LABELS[status]}
                            </span>
                          </td>

                          <td>
                            <span className="admin-moderation-count">
                              {activity.flagCount ||
                                activity.moderationFlags?.length ||
                                0}{" "}
                              จุด
                            </span>
                          </td>

                          <td>
                            <button
                              type="button"
                              className="admin-moderation-eye"
                              onClick={() =>
                                openActivity(activity.id)
                              }
                              disabled={detailLoading}
                              title="ดูรายละเอียด"
                            >
                              <FiEye />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {!loading &&
              !error &&
              filteredActivities.length > 0 && (
                <footer className="admin-moderation-pagination">
                  <span>
                    แสดง{" "}
                    {(page - 1) * ITEMS_PER_PAGE + 1}–
                    {Math.min(
                      page * ITEMS_PER_PAGE,
                      filteredActivities.length
                    )}{" "}
                    จาก {filteredActivities.length} กิจกรรม
                  </span>

                  <div>
                    <button
                      type="button"
                      disabled={page === 1}
                      onClick={() =>
                        setPage((current) =>
                          Math.max(1, current - 1)
                        )
                      }
                    >
                      <FiChevronLeft />
                    </button>

                    {getPaginationNumbers().map(
                      (pageNumber, index) =>
                        typeof pageNumber === "number" ? (
                          <button
                            type="button"
                            key={pageNumber}
                            className={
                              page === pageNumber
                                ? "active"
                                : ""
                            }
                            onClick={() =>
                              setPage(pageNumber)
                            }
                          >
                            {pageNumber}
                          </button>
                        ) : (
                          <span
                            key={`${pageNumber}-${index}`}
                            className="admin-moderation-dots"
                          >
                            ...
                          </span>
                        )
                    )}

                    <button
                      type="button"
                      disabled={page === totalPages}
                      onClick={() =>
                        setPage((current) =>
                          Math.min(
                            totalPages,
                            current + 1
                          )
                        )
                      }
                    >
                      <FiChevronRight />
                    </button>
                  </div>
                </footer>
              )}
          </section>
        </div>
      </main>

      {selectedActivity && (
        <>
          <button
            type="button"
            className="admin-moderation-backdrop"
            onClick={() => {
              if (!actionLoading) {
                setSelectedActivity(null);
              }
            }}
            aria-label="ปิดรายละเอียด"
          />

          <aside className="admin-moderation-panel">
            <div className="admin-moderation-panel-header">
              <div>
                <span>
                  AI ตรวจพบข้อความที่อาจไม่เหมาะสม
                </span>
                <h2>{selectedActivity.activityName}</h2>
              </div>

              <button
                type="button"
                onClick={() =>
                  setSelectedActivity(null)
                }
                disabled={actionLoading}
                aria-label="ปิด"
              >
                <FiX />
              </button>
            </div>

            <div className="admin-moderation-panel-body">
              <section className="admin-moderation-detail-card">
                {selectedActivity.cover && (
                  <img
                    className="admin-moderation-detail-cover"
                    src={selectedActivity.cover}
                    alt={selectedActivity.activityName}
                  />
                )}

                <h3>{selectedActivity.activityName}</h3>

                <p className="admin-moderation-detail-text">
                  {selectedActivity.detail ||
                    "ไม่มีรายละเอียด"}
                </p>

                <div className="admin-moderation-detail-meta">
                  <span>
                    <FiUser />
                    {selectedActivity.creatorName ||
                      "ไม่ระบุชื่อผู้สร้าง"}
                  </span>

                  <span>
                    <FiMapPin />
                    {selectedActivity.location ||
                      "ไม่ระบุสถานที่"}
                  </span>

                  <span>
                    <FiCalendar />
                    {formatDate(selectedActivity.date)}
                  </span>
                </div>
              </section>

              <section className="admin-moderation-flags">
                <div className="admin-moderation-flags-head">
                  <div>
                    <h3>ผลการตรวจสอบจาก AI</h3>
                    <p>
                      พบข้อความที่ AI เคยตรวจพบ{" "}
                      {selectedActivity.moderationFlags
                        ?.length || 0}{" "}
                      จุด
                    </p>
                  </div>

                  <span className="admin-moderation-ai-badge">
                    AI ตรวจพบ
                  </span>
                </div>

                <div className="admin-moderation-flag-list">
                  {(selectedActivity.moderationFlags || []).map(
                    (flag) => (
                      <article
                        key={flag.id}
                        className="admin-moderation-flag-card"
                      >
                        <div className="admin-moderation-flag-top">
                          <strong>
                            {flag.fieldLabel || flag.field}
                          </strong>

                          <span>
                            {formatConfidence(
                              flag.confidence
                            )}
                          </span>
                        </div>

                        <div className="admin-moderation-flag-category">
                          {flag.labelText ||
                            flag.categoryLabel ||
                            flag.label}
                        </div>

                        <div className="admin-moderation-flag-status-row">
                          <span
                            className={`admin-moderation-status ${flag.status}`}
                          >
                            {STATUS_LABELS[flag.status] ||
                              flag.status}
                          </span>
                        </div>
                      </article>
                    )
                  )}
                </div>
              </section>
            </div>

            <div className="admin-moderation-panel-actions">
              {getItemStatus(
                selectedActivity.moderationFlags
              ) === "pending" ? (
                <>
                  <button
                    type="button"
                    className="admin-moderation-action reviewed"
                    onClick={handleReviewed}
                    disabled={actionLoading}
                  >
                    <FiCheck />
                    ตรวจสอบแล้ว
                  </button>

                  <button
                    type="button"
                    className="admin-moderation-action danger"
                    onClick={handleSuspend}
                    disabled={actionLoading}
                  >
                    <FiXCircle />
                    ระงับกิจกรรม
                  </button>
                </>
              ) : (
                <div
                  className={`admin-moderation-completed ${getItemStatus(
                    selectedActivity.moderationFlags
                  )}`}
                >
                  <FiCheck />
                  {getItemStatus(
                    selectedActivity.moderationFlags
                  ) === "actioned"
                    ? "ดำเนินการกับกิจกรรมนี้แล้ว"
                    : "ตรวจสอบกิจกรรมนี้แล้ว"}
                </div>
              )}
            </div>
          </aside>
        </>
      )}
    </div>
  );
}
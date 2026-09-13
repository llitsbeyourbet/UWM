import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  FiAlertCircle,
  FiAlertTriangle,
  FiArrowLeft,
  FiCalendar,
  FiCheck,
  FiClock,
  FiMapPin,
  FiMessageSquare,
  FiShield,
  FiSlash,
  FiTag,
  FiUser,
  FiUsers,
} from "react-icons/fi";

import API_URL from "../config";
import { useAlert } from "../hooks/useAlert";
import "../styles/AdminDashboard.css";
import "../styles/AdminReportDetail.css";
import {
  formatDateTimeDate,
  formatDateTimeTime,
} from "../utils/formatDate";

const FALLBACK_IMAGE =
  "https://placehold.co/900x560/F1EDFF/6846F5?text=Activity";

const normalizeStatus = (value) => {
  const status = String(value || "pending").toLowerCase();

  if (["reviewing", "in_review", "investigating"].includes(status)) {
    return "reviewing";
  }

  if (["resolved", "completed", "approved", "reviewed"].includes(status)) {
    return "resolved";
  }

  if (["rejected", "dismissed", "cancelled"].includes(status)) {
    return "rejected";
  }

  return "pending";
};

const formatActivityDate = (value) => {
  if (!value) return "-";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";

  return date.toLocaleDateString("th-TH", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
};

const normalizeCategories = (value) => {
  if (Array.isArray(value)) {
    return value.filter(Boolean);
  }

  if (!value) return [];

  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed.filter(Boolean) : [String(parsed)];
    } catch {
      return value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
    }
  }

  return [String(value)];
};

export default function AdminReportDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { showAlert, showConfirm } = useAlert();
  const token = sessionStorage.getItem("token");

  const admin = useMemo(() => {
    try {
      return JSON.parse(sessionStorage.getItem("user")) || {};
    } catch {
      return {};
    }
  }, []);

  const [report, setReport] = useState(null);
  const [decision, setDecision] = useState("");
  const [adminNote, setAdminNote] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!token || admin.role !== "admin") {
      navigate("/login");
      return;
    }

    loadReport();
  }, [id]);

  const loadReport = async () => {
    try {
      setLoading(true);
      setError("");

      const response = await fetch(`${API_URL}/api/admin/reports/${id}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data?.message || "โหลดรายละเอียดรายงานไม่สำเร็จ");
      }

      setReport(data);
      setDecision(data.decision || "");
      setAdminNote(data.adminNote || "");
    } catch (err) {
      console.error(err);
      setError(err.message || "ไม่สามารถโหลดรายละเอียดรายงานได้");
    } finally {
      setLoading(false);
    }
  };

  const updateReportStatus = async (payload) => {
    const response = await fetch(`${API_URL}/api/admin/reports/${id}/status`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(data?.message || "บันทึกผลการตรวจสอบไม่สำเร็จ");
    }
  };

  const saveDecision = async () => {
    if (!decision) {
      await showAlert({
        type: "warning",
        title: "ข้อมูลไม่ครบถ้วน",
        message: "กรุณาเลือกผลการตรวจสอบ",
      });
      return;
    }

    const confirmed = await showConfirm({
      title: "ยืนยันการบันทึก",
      message: "ยืนยันการบันทึกผลการตรวจสอบหรือไม่?",
      confirmText: "บันทึก",
      cancelText: "ยกเลิก",
    });

    if (!confirmed) return;

    try {
      setSaving(true);

      await updateReportStatus({
        status: decision === "reject_report" ? "rejected" : "resolved",
        decision,
        adminNote: adminNote.trim(),
      });

      await showAlert({
        type: "success",
        title: "สำเร็จ",
        message: "บันทึกผลการตรวจสอบสำเร็จ",
      });

      await loadReport();
    } catch (err) {
      await showAlert({
        type: "error",
        title: "เกิดข้อผิดพลาด",
        message: err.message || "เกิดข้อผิดพลาดในการบันทึก",
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading || error || !report) {
    return (
      <div className="admin-shell">
        <main className="admin-main">
          <div className="report-detail-state">
            {loading ? (
              <span className="report-detail-loader" />
            ) : (
              <FiAlertTriangle />
            )}

            <strong>
              {loading ? "กำลังโหลดรายละเอียดรายงาน" : "โหลดข้อมูลไม่สำเร็จ"}
            </strong>

            {!loading && (
              <>
                <p>{error}</p>
                <button onClick={() => navigate("/admin/reports")}>
                  กลับหน้ารายงาน
                </button>
              </>
            )}
          </div>
        </main>
      </div>
    );
  }

  const reporters = report.reports || [];
  const latestReport = reporters[0] || report;
  const reportNumber = `RPT-${String(report.id || id).padStart(5, "0")}`;
  const activityImage = report.activityCover || FALLBACK_IMAGE;
  const categories = normalizeCategories(report.activityCategory);
  const currentStatus = normalizeStatus(report.status);
  const isCompleted = currentStatus === "resolved" || currentStatus === "rejected";

  return (
    <div className="admin-shell">
      <main className="admin-main">
        <div className="admin-report-detail-page">
          <header className="report-detail-topbar">
            <button
              type="button"
              className="report-detail-back"
              onClick={() => navigate("/admin/reports")}
            >
              <FiArrowLeft />
              กลับหน้ารายงาน
            </button>
          </header>

          <section className="report-detail-heading">
            <div>
              <span className="report-detail-label">รายละเอียดรายงาน</span>
              <h1>รายงาน #{reportNumber}</h1>

              <div className="report-latest-meta">
                <span>ได้รับรายงานล่าสุด</span>
                <span className="report-latest-meta-item">
                  <FiCalendar />
                  {formatDateTimeDate(latestReport.createdAt)}
                </span>
                <span className="report-meta-separator" />
                <span className="report-latest-meta-item">
                  <FiClock />
                  {formatDateTimeTime(latestReport.createdAt)} น.
                </span>
              </div>
            </div>

            <div className="report-detail-heading-result">
              {!isCompleted ? (
                <span className="heading-result-badge pending">
                  <FiAlertCircle />
                  รอดำเนินการ
                </span>
              ) : report.decision === "suspend_activity" ? (
                <span className="heading-result-badge suspended">
                  <FiSlash />
                  ระงับกิจกรรมแล้ว
                </span>
              ) : report.decision === "warning" ? (
                <span className="heading-result-badge warning">
                  <FiAlertTriangle />
                  แจ้งเตือนผู้สร้างกิจกรรมแล้ว
                </span>
              ) : report.decision === "no_violation" ? (
                <span className="heading-result-badge resolved">
                  <FiCheck />
                  ไม่พบการกระทำผิด
                </span>
              ) : (
                <span className="heading-result-badge rejected">
                  <FiAlertTriangle />
                  ปฏิเสธการระงับกิจกรรม
                </span>
              )}
            </div>
          </section>

          <section className="report-detail-main-grid">
            <div className="report-detail-left-column">
              <article className="report-detail-card activity-information-card">
                <div className="report-detail-card-title">
                  <span>
                    <FiCalendar />
                  </span>
                  <div>
                    <h2>ข้อมูลกิจกรรม</h2>
                    <p>ข้อมูลของกิจกรรมที่ถูกรายงาน</p>
                  </div>
                </div>

                <img
                  className="report-detail-activity-image"
                  src={activityImage}
                  alt={report.activityName || "กิจกรรม"}
                  onError={(event) => {
                    event.currentTarget.src = FALLBACK_IMAGE;
                  }}
                />

                <div className="report-activity-heading-row">
                  <h3>{report.activityName || "ไม่ระบุชื่อกิจกรรม"}</h3>

                  <div className="report-activity-badges">
                    {categories.map((category) => (
                      <span className="activity-category-badge" key={category}>
                        <FiTag />
                        {category}
                      </span>
                    ))}

                    <span className="activity-type-badge">
                      {report.activityType === "private" ? "ส่วนตัว" : "สาธารณะ"}
                    </span>

                    <span
                      className={`activity-status-badge ${
                        report.activityStatus === "suspended" ? "suspended" : "active"
                      }`}
                    >
                      {report.activityStatus === "suspended"
                        ? "ระงับแล้ว"
                        : "เปิดใช้งาน"}
                    </span>
                  </div>
                </div>

                <div className="report-activity-detail-box">
                  <div className="report-activity-detail-title">
                    <FiCalendar />
                    <strong>รายละเอียดกิจกรรม</strong>
                  </div>
                  <p>{report.activityDetail || "ไม่มีรายละเอียดกิจกรรม"}</p>
                </div>

                <div className="report-detail-info-list">
                  <div>
                    <FiCalendar />
                    <span>
                      <small>วันที่จัดกิจกรรม</small>
                      <strong>{formatActivityDate(report.activityDate)}</strong>
                    </span>
                  </div>

                  <div>
                    <FiClock />
                    <span>
                      <small>เวลา</small>
                      <strong>
                        {report.activityTime
                          ? report.activityTime
                              .split(" - ")
                              .map((time) => time.slice(0, 5))
                              .join(" - ") + " น."
                          : "-"}
                      </strong>
                    </span>
                  </div>

                  <div>
                    <FiUsers />
                    <span>
                      <small>จำนวนที่รับสมัคร</small>
                      <strong>{report.activityParticipantCount || 0} คน</strong>
                    </span>
                  </div>

                  <div>
                    <FiMapPin />
                    <span>
                      <small>สถานที่จัดกิจกรรม</small>
                      <strong>{report.activityLocation || "ไม่ระบุสถานที่"}</strong>
                    </span>
                  </div>

                  <div>
                    <FiUser />
                    <span>
                      <small>ผู้สร้างกิจกรรม</small>
                      <strong>@{report.creatorUsername || "ไม่ระบุ"}</strong>
                    </span>
                  </div>

                  <div>
                    <FiCalendar />
                    <span>
                      <small>วันที่สร้างกิจกรรม</small>
                      <strong>{formatDateTimeDate(report.activityCreatedAt)}</strong>
                    </span>
                  </div>

                  <div>
                    <FiClock />
                    <span>
                      <small>เวลาที่สร้างกิจกรรม</small>
                      <strong>{formatDateTimeTime(report.activityCreatedAt)} น.</strong>
                    </span>
                  </div>
                </div>
              </article>

              <article className="report-detail-card report-decision-card">
                <div className="report-detail-card-title">
                  <span>
                    <FiMessageSquare />
                  </span>
                  <div>
                    <h2>ผลการตรวจสอบ</h2>
                    <p>
                      {isCompleted
                        ? "รายละเอียดผลการพิจารณารายงาน"
                        : "บันทึกผลการพิจารณารายงาน"}
                    </p>
                  </div>
                </div>

                <label className="report-decision-field">
                  <span>ผลการตรวจสอบ</span>
                  <select
                    value={decision}
                    onChange={(event) => setDecision(event.target.value)}
                    disabled={isCompleted}
                  >
                    <option value="">เลือกผลการตรวจสอบ</option>
                    <option value="no_violation">ไม่พบการกระทำผิด</option>
                    <option value="warning">แจ้งเตือนผู้สร้างกิจกรรม</option>
                    <option value="suspend_activity">ระงับกิจกรรม</option>
                    <option value="reject_report">ปฏิเสธการระงับกิจกรรม</option>
                  </select>
                </label>

                <label className="report-decision-field">
                  <span>หมายเหตุจากผู้ดูแลระบบ</span>
                  <textarea
                    rows="5"
                    value={adminNote}
                    onChange={(event) => setAdminNote(event.target.value)}
                    placeholder="ระบุรายละเอียดผลการตรวจสอบ..."
                    disabled={isCompleted}
                  />
                </label>

                {isCompleted && (
                  <div className="report-review-result-info">
                    <div>
                      <small>สถานะรายงาน</small>
                      <strong>
                        {currentStatus === "rejected"
                          ? "ปฏิเสธการระงับกิจกรรม"
                          : "ดำเนินการเรียบร้อยแล้ว"}
                      </strong>
                    </div>

                    <div>
                      <small>ตรวจสอบโดย</small>
                      <strong>
                        {report.reviewerName ||
                          report.reviewerUsername ||
                          "ผู้ดูแลระบบ"}
                      </strong>
                    </div>

                    <div>
                      <small>วันที่ตรวจสอบ</small>
                      <strong>{formatDateTimeDate(report.reviewedAt)}</strong>
                    </div>

                    <div>
                      <small>เวลาที่ตรวจสอบ</small>
                      <strong>{formatDateTimeTime(report.reviewedAt)} น.</strong>
                    </div>
                  </div>
                )}

                {!isCompleted && (
                  <button
                    type="button"
                    className="report-save-decision"
                    onClick={saveDecision}
                    disabled={saving}
                  >
                    <FiCheck />
                    {saving ? "กำลังบันทึก..." : "บันทึกผลการตรวจสอบ"}
                  </button>
                )}
              </article>
            </div>

            <div className="report-detail-side-column">
              <article className="report-detail-card review-status-card">
                <div className="report-detail-card-title">
                  <span>
                    <FiShield />
                  </span>
                  <div>
                    <h2>สถานะการตรวจสอบ</h2>
                    <p>ขั้นตอนการดำเนินการของรายงานนี้</p>
                  </div>
                </div>

                <div className="report-status-timeline">
                  <div className="report-timeline-item complete">
                    <span className="timeline-marker">
                      <FiCheck />
                    </span>
                    <div>
                      <strong>รับรายงานแล้ว</strong>
                      <small className="timeline-date-time">
                        <span>{formatDateTimeDate(latestReport.createdAt)}</span>
                        <span>{formatDateTimeTime(latestReport.createdAt)} น.</span>
                      </small>
                    </div>
                  </div>

                  <div
                    className={`report-timeline-item ${
                      ["reviewing", "resolved", "rejected"].includes(currentStatus)
                        ? "complete"
                        : "current"
                    }`}
                  >
                    <span className="timeline-marker">
                      {["reviewing", "resolved", "rejected"].includes(currentStatus) ? (
                        <FiCheck />
                      ) : (
                        "2"
                      )}
                    </span>
                    <div>
                      <strong>กำลังตรวจสอบ</strong>
                      <small>
                        {currentStatus === "pending"
                          ? "รอผู้ดูแลระบบตรวจสอบข้อมูล"
                          : "ผู้ดูแลระบบกำลังดำเนินการ"}
                      </small>
                    </div>
                  </div>

                  <div className={`report-timeline-item ${isCompleted ? "complete" : ""}`}>
                    <span className="timeline-marker">
                      {isCompleted ? <FiCheck /> : "3"}
                    </span>
                    <div>
                      <strong>ดำเนินการเสร็จสิ้น</strong>
                      <small>
                        {currentStatus === "resolved"
                          ? "รายงานได้รับการดำเนินการแล้ว"
                          : currentStatus === "rejected"
                            ? "รายงานถูกปฏิเสธแล้ว"
                            : "ยังไม่ดำเนินการเสร็จสิ้น"}
                      </small>
                    </div>
                  </div>
                </div>
              </article>

              <article className="report-detail-card report-information-card">
                <div className="report-detail-card-title reporter-card-title">
                  <span>
                    <FiUsers />
                  </span>
                  <div>
                    <h2>ผู้รายงานทั้งหมด {report.reportCount || reporters.length} คน</h2>
                  </div>
                </div>

                <div className={`reporter-list ${reporters.length > 3 ? "scrollable" : ""}`}>
                  {reporters.map((item) => (
                    <div className="reporter-report-item" key={item.id}>
                      <div className="reporter-profile">
                        <img
                          src={
                            item.reporterProfileImage ||
                            "https://placehold.co/80x80/EEEAFD/6846F5?text=U"
                          }
                          alt={item.reporterName || "ผู้รายงาน"}
                        />

                        <div className="reporter-main-info">
                          <strong>
                            {item.reporterName || item.reporterUsername || "ผู้ใช้งาน"}
                          </strong>
                          <span>@{item.reporterUsername || "unknown"}</span>
                        </div>

                        <div className="reporter-date-time">
                          <span>
                            <FiCalendar />
                            {formatDateTimeDate(item.createdAt)}
                          </span>
                          <span>
                            <FiClock />
                            {formatDateTimeTime(item.createdAt)} น.
                          </span>
                        </div>
                      </div>

                      <div className="reporter-reason-row">
                        <FiAlertCircle />
                        <span>{item.reason || "ไม่ระบุเหตุผล"}</span>
                      </div>

                      {item.detail && (
                        <p className="reporter-detail-text">{item.detail}</p>
                      )}
                    </div>
                  ))}
                </div>
              </article>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}

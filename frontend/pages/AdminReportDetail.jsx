import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  FiAlertTriangle, FiArrowLeft, FiBell, FiCalendar, FiCheck,
  FiClock, FiEye, FiFlag, FiGrid, FiLogOut, FiMapPin,
  FiMessageSquare, FiShield, FiSlash, FiStar, FiUser, FiUsers,
} from "react-icons/fi";
import { MdGroups } from "react-icons/md";

import API_URL from "../config";
import "../styles/AdminDashboard.css";
import "../styles/AdminReportDetail.css";
import "../components/AdminSidebar"
import { formatDateTime, formatDateTimeDate, formatDateTimeTime, formatTime } from "../utils/formatDate";
import { getCategoryIcon } from "../utils/categoryIcons";
const FALLBACK_IMAGE = "https://placehold.co/900x560/F1EDFF/6846F5?text=Activity";

const normalizeStatus = (value) => {
  const status = String(value || "pending").toLowerCase();
  if (["reviewing", "in_review", "investigating"].includes(status)) return "reviewing";
  if (["resolved", "completed", "approved", "reviewed"].includes(status)) return "resolved";
  if (["rejected", "dismissed", "cancelled"].includes(status)) return "rejected";
  return "pending";
};

const formatDate = (value, includeTime = false) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("th-TH", {
    day: "numeric", month: "short", year: "numeric",
    ...(includeTime ? { hour: "2-digit", minute: "2-digit" } : {}),
  });
};

export default function AdminReportDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const token = localStorage.getItem("token");

  const admin = useMemo(() => {
    try { return JSON.parse(localStorage.getItem("user")) || {}; }
    catch { return {}; }
  }, []);

  const [report, setReport] = useState(null);
  const [decision, setDecision] = useState("");
  const [adminNote, setAdminNote] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!token || admin.role !== "admin") { navigate("/login"); return; }
    loadReport();
  }, [id]);

  const loadReport = async () => {
    try {
      setLoading(true);
      setError("");

      const response = await fetch(
        `${API_URL}/api/admin/reports/${id}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          data?.message ||
          "โหลดรายละเอียดรายงานไม่สำเร็จ"
        );
      }

      setReport(data);
      setDecision(data.decision || "");
      setAdminNote(data.adminNote || "");
    } catch (err) {
      console.error(err);

      setError(
        err.message ||
        "ไม่สามารถโหลดรายละเอียดรายงานได้"
      );
    } finally {
      setLoading(false);
    }
  };

  const activityId = report?.activityId || report?.activity?.id || report?.activity?._id;
  const currentStatus = normalizeStatus(report?.status);
  const isCompleted = currentStatus === "resolved" || currentStatus === "rejected";

  const updateReportStatus = async (payload) => {
    const response = await fetch(`${API_URL}/api/admin/reports/${id}/status`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(payload),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data?.message || "บันทึกผลการตรวจสอบไม่สำเร็จ");
  };

  const saveDecision = async () => {
    if (!decision) { alert("กรุณาเลือกผลการตรวจสอบ"); return; }
    if (!window.confirm("ยืนยันการบันทึกผลการตรวจสอบหรือไม่?")) return;
    try {
      setSaving(true);
      await updateReportStatus({
        status: decision === "reject_report" ? "rejected" : "resolved",
        decision,
        adminNote: adminNote.trim(),
      });
      alert("บันทึกผลการตรวจสอบสำเร็จ");
      await loadReport();
    } catch (err) { alert(err.message || "เกิดข้อผิดพลาด"); }
    finally { setSaving(false); }
  };

  const rejectReport = async () => {
    if (!window.confirm("ยืนยันการปฏิเสธรายงานนี้หรือไม่?")) return;
    try {
      setSaving(true);
      await updateReportStatus({ status: "rejected", decision: "reject_report", adminNote: adminNote.trim() });
      alert("ปฏิเสธรายงานเรียบร้อยแล้ว");
      await loadReport();
    } catch (err) { alert(err.message || "เกิดข้อผิดพลาด"); }
    finally { setSaving(false); }
  };

  const suspendActivity = async () => {
    if (!activityId) { alert("ไม่พบรหัสกิจกรรม"); return; }
    if (!window.confirm("ยืนยันการระงับกิจกรรมนี้หรือไม่?")) return;
    try {
      setSaving(true);
      const response = await fetch(`${API_URL}/api/admin/suspend/${activityId}`, {
        method: "PUT", headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.message || "ระงับกิจกรรมไม่สำเร็จ");
      alert("ระงับกิจกรรมเรียบร้อยแล้ว");
      await loadReport();
    } catch (err) { alert(err.message || "เกิดข้อผิดพลาด"); }
    finally { setSaving(false); }
  };

  if (loading || error || !report) {
    return (
      <div className="admin-shell">
        <main className="admin-main">
          <div className="report-detail-state">
            {loading ? <span className="report-detail-loader" /> : <FiAlertTriangle />}
            <strong>{loading ? "กำลังโหลดรายละเอียดรายงาน" : "โหลดข้อมูลไม่สำเร็จ"}</strong>
            {!loading && <><p>{error}</p><button onClick={() => navigate("/admin/reports")}>กลับหน้ารายงาน</button></>}
          </div>
        </main>
      </div>
    );
  }

  const reportNumber = `RPT-${String(report.id || id).padStart(5, "0")}`;
  const activityImage = report.activityCover || report.activityImage || report.activity?.cover || report.activity?.image || FALLBACK_IMAGE;
  const activitySuspended = String(report.activityStatus || report.activity?.status || "").toLowerCase() === "suspended";

  return (
    <div className="admin-shell">
      <main className="admin-main">
        <div className="admin-report-detail-page">
          <header className="report-detail-topbar">
            <button type="button" className="report-detail-back" onClick={() => navigate("/admin/reports")}><FiArrowLeft />กลับหน้ารายงาน</button>
          </header>

          <section className="report-detail-heading">
            <div>
              <span className="report-detail-label">รายละเอียดรายงาน</span>
              <h1>รายงาน #{reportNumber}</h1>
              <p>ส่งรายงานเมื่อ {formatDate(report.createdAt || report.reportedAt, true)}</p>
            </div>
            {isCompleted ? (
              <div className="report-detail-heading-result">
                {report.decision === "suspend_activity" ? (
                  <span className="heading-result-badge suspended">
                    <FiSlash />
                    ระงับกิจกรรมแล้ว
                  </span>
                ) : (
                  <span className="heading-result-badge rejected">
                    <FiAlertTriangle />
                    ปฏิเสธรายงาน
                  </span>
                )}
              </div>
            ) : (
              <div className="report-detail-heading-actions">
                <button
                  type="button"
                  className="report-reject-action"
                  onClick={rejectReport}
                  disabled={saving}
                >
                  <FiAlertTriangle />
                  ปฏิเสธรายงาน
                </button>

                <button
                  type="button"
                  className="report-suspend-action"
                  onClick={suspendActivity}
                  disabled={saving || activitySuspended}
                >
                  <FiSlash />
                  {activitySuspended
                    ? "กิจกรรมถูกระงับแล้ว"
                    : "ระงับกิจกรรม"}
                </button>
              </div>
            )}
          </section>

          <section className="report-detail-main-grid">
            <article className="report-detail-card activity-information-card">
              <div className="report-detail-card-title"><span><FiCalendar /></span><div><h2>ข้อมูลกิจกรรม</h2><p>ข้อมูลของกิจกรรมที่ถูกรายงาน</p></div></div>
              <img className="report-detail-activity-image" src={activityImage} alt={report.activityName || "กิจกรรม"} onError={(e) => { e.currentTarget.src = FALLBACK_IMAGE; }} />
              <h3>{report.activityName || "ไม่ระบุชื่อกิจกรรม"}</h3>
              <div className="report-detail-info-list">
                <div><FiCalendar /><span><small>วันที่จัดกิจกรรม</small><strong>{formatDate(report.activityDate || report.activity?.date)}</strong></span></div>
                <div><FiClock /><span>
                  <small>เวลา</small>
                  <strong>
                    {report.activityTime
                      ? report.activityTime
                        .split(" - ")
                        .map((time) => time.slice(0, 5))
                        .join(" - ")
                      : "-"}
                  </strong>
                </span></div>
                <div><FiMapPin /><span><small>สถานที่</small><strong>{report.activityLocation || report.activity?.location || "ไม่ระบุสถานที่"}</strong></span></div>
                <div><FiUser /><span><small>ผู้สร้างกิจกรรม</small><strong>@{report.creatorUsername || report.creatorName || report.activity?.creatorUsername || "ไม่ระบุ"}</strong></span></div>
              </div>
              <button type="button" className="report-view-activity" onClick={() => navigate(`/activity-detail?id=${activityId}&from=admin`)} disabled={!activityId}><FiEye />ดูรายละเอียดกิจกรรม</button>
            </article>

            <article className="report-detail-card review-status-card">
              <div className="report-detail-card-title"><span><FiShield /></span><div><h2>สถานะการตรวจสอบ</h2><p>ขั้นตอนการดำเนินการของรายงานนี้</p></div></div>
              <div className="report-status-timeline">
                <div className="report-timeline-item complete"><span className="timeline-marker"><FiCheck /></span><div><strong>รับรายงานแล้ว</strong><small>{formatDate(report.createdAt || report.reportedAt, true)}</small></div></div>
                <div className={`report-timeline-item ${["reviewing", "resolved", "rejected"].includes(currentStatus) ? "complete" : "current"}`}><span className="timeline-marker">{["reviewing", "resolved", "rejected"].includes(currentStatus) ? <FiCheck /> : "2"}</span><div><strong>กำลังตรวจสอบ</strong><small>{currentStatus === "pending" ? "รอผู้ดูแลระบบตรวจสอบข้อมูล" : "ผู้ดูแลระบบกำลังดำเนินการ"}</small></div></div>
                <div className={`report-timeline-item ${isCompleted ? "complete" : ""}`}><span className="timeline-marker">{isCompleted ? <FiCheck /> : "3"}</span><div><strong>ดำเนินการเสร็จสิ้น</strong><small>{currentStatus === "resolved" ? "รายงานได้รับการดำเนินการแล้ว" : currentStatus === "rejected" ? "รายงานถูกปฏิเสธแล้ว" : "ยังไม่ดำเนินการเสร็จสิ้น"}</small></div></div>
              </div>
            </article>
          </section>

          <section className="report-detail-bottom-grid">
            <article className="report-detail-card report-information-card">
              <div className="reporter-list-heading">
                <strong>
                  ผู้รายงานทั้งหมด {report.reportCount || report.reports?.length || 0} คน
                </strong>
              </div>

              <div className="reporter-list">
                {(report.reports || []).map((item) => (
                  <div
                    className="reporter-report-item"
                    key={item.id}
                  >
                    <div className="reporter-profile">
                      <img
                        src={
                          item.reporterProfileImage ||
                          "https://placehold.co/80x80/EEEAFD/6846F5?text=U"
                        }
                        alt={item.reporterName || "ผู้รายงาน"}
                      />

                      <div>
                        <small>รายงานโดย</small>

                        <strong>
                          {item.reporterName ||
                            item.reporterUsername ||
                            "ผู้ใช้งาน"}
                        </strong>

                        <span>
                          @{item.reporterUsername || "unknown"}
                        </span>
                      </div>
                    </div>

                    <div className="report-reason-box">
                      <small>เหตุผลที่รายงาน</small>

                      <strong>
                        {getCategoryIcon(item.reasonCategory || item.category)} {item.reasonCategory ||
                          item.category ||
                          item.reason ||
                          "ไม่ระบุเหตุผล"}
                      </strong>
                    </div>

                    <div className="report-description-box">
                      <small>รายละเอียดเพิ่มเติม</small>

                      <p>
                        {item.description ||
                          item.details ||
                          item.reason ||
                          "ผู้รายงานไม่ได้ระบุรายละเอียดเพิ่มเติม"}
                      </p>
                    </div>

                    <div className="report-created-meta">
                      <div>
                        <small>วันที่รายงาน</small>
                        <strong>
                          {formatDateTimeDate(report.createdAt)}
                        </strong>
                      </div>

                      <div>
                        <small>เวลารายงาน</small>
                        <strong>
                          {formatDateTimeTime(report.createdAt)} น.
                        </strong>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </article>

            <article className="report-detail-card report-decision-card">
              <div className="report-detail-card-title">
                <span>
                  <FiMessageSquare />
                </span>

                <div>
                  <h2>ผลการตรวจสอบ</h2>
                  <p>{isCompleted ? "รายละเอียดผลการพิจารณารายงาน" : "บันทึกผลการพิจารณารายงาน"}</p>
                </div>
              </div>

              <label className="report-decision-field">
                <span>ผลการตรวจสอบ</span>

                <select
                  value={decision}
                  onChange={(e) => setDecision(e.target.value)}
                  disabled={isCompleted}
                >
                  <option value="">
                    เลือกผลการตรวจสอบ
                  </option>

                  <option value="no_violation">
                    ไม่พบการกระทำผิด
                  </option>

                  <option value="warning">
                    แจ้งเตือนผู้สร้างกิจกรรม
                  </option>

                  <option value="suspend_activity">
                    ระงับกิจกรรม
                  </option>

                  <option value="reject_report">
                    ปฏิเสธรายงาน
                  </option>
                </select>
              </label>

              <label className="report-decision-field">
                <span>หมายเหตุจากผู้ดูแลระบบ</span>

                <textarea rows="6" value={adminNote} onChange={(e) => setAdminNote(e.target.value)} placeholder="ระบุรายละเอียดผลการตรวจสอบ..." disabled={isCompleted} />
              </label>
              {isCompleted && (
                <div className="report-review-result-info">
                  <div>
                    <small>สถานะรายงาน</small>
                    <strong>{currentStatus === "rejected" ? "ปฏิเสธรายงาน" : "ดำเนินการเรียบร้อยแล้ว"}</strong>
                  </div>

                  <div>
                    <small>ตรวจสอบโดย</small>
                    <strong>{report.reviewerName || report.reviewerUsername || "ผู้ดูแลระบบ"}</strong>
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

                  {saving
                    ? "กำลังบันทึก..."
                    : "บันทึกผลการตรวจสอบ"}
                </button>
              )}
            </article>
          </section>
        </div>
      </main>
    </div>
  );
}
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
    FiBell,
    FiCalendar,
    FiFlag,
    FiGrid,
    FiLogOut,
    FiMapPin,
    FiRefreshCw,
    FiSettings,
    FiStar,
    FiUsers,
} from "react-icons/fi";
import { MdGroups } from "react-icons/md";

import API_URL from "../config";
import "./AdminDashboard.css";
import "./AdminNotifications.css";

const fallback =
    "https://placehold.co/160x120/f0edff/6846f5?text=Activity";

const formatDateTime = (value) => {
    if (!value) return "-";

    return new Date(value).toLocaleString("th-TH", {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    });
};

function AdminNotifications() {
    const navigate = useNavigate();

    const [reports, setReports] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    const token = localStorage.getItem("token");

    const admin = useMemo(() => {
        try {
            return JSON.parse(localStorage.getItem("user")) || {};
        } catch {
            return {};
        }
    }, []);

    const pendingReports = reports.filter(
        (report) => report.status === "pending"
    );

    useEffect(() => {
        if (!admin || admin.role !== "admin") {
            navigate("/");
            return;
        }

        loadReports();
    }, []);

    const loadReports = async () => {
        try {
            setLoading(true);
            setError("");

            const response = await fetch(`${API_URL}/api/admin/reports`, {
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            });

            const data = await response.json().catch(() => []);

            if (!response.ok) {
                throw new Error(data.message || "โหลดการแจ้งเตือนไม่สำเร็จ");
            }

            setReports(Array.isArray(data) ? data : []);
        } catch (err) {
            console.error(err);
            setError(err.message || "ไม่สามารถโหลดการแจ้งเตือนได้");
        } finally {
            setLoading(false);
        }
    };

    const logout = () => {
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        navigate("/login");
    };

    const navItems = [
        ["ภาพรวม", <FiGrid />, "/admin"],
        ["กิจกรรม", <FiCalendar />, "/admin/activities"],
        ["ผู้ใช้งาน", <FiUsers />, "/admin/users"],
        ["รายงานกิจกรรม", <FiFlag />, "/admin/reports"],
        ["การแจ้งเตือน", <FiBell />, "/admin/notifications", true],
        ["รีวิว", <FiStar />, "/admin/reviews"],
        ["การตั้งค่า", <FiSettings />, "/admin/settings"],
    ];

    return (
        <div className="admin-shell">
            <aside className="admin-sidebar">
                <button
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
                            key={label}
                            className={`admin-nav-item ${active ? "active" : ""}`}
                            onClick={() => navigate(path)}
                        >
                            <span>{icon}</span>
                            <b>{label}</b>
                        </button>
                    ))}
                </nav>

                <button className="admin-logout" onClick={logout}>
                    <FiLogOut />
                    ออกจากระบบ
                </button>
            </aside>

            <main className="admin-main admin-notification-main">
                <header className="notification-topbar">
                    <div className="notification-breadcrumb">
                        <button type="button" onClick={() => navigate("/admin")}>
                            หน้าหลัก
                        </button>

                        <span>/</span>

                        <strong>การแจ้งเตือน</strong>
                    </div>

                    <button
                        className="notification-refresh"
                        onClick={loadReports}
                        disabled={loading}
                    >
                        <FiRefreshCw className={loading ? "spinning" : ""} />
                        รีเฟรช
                    </button>
                </header>

                <section className="notification-summary">
                    <span className="notification-summary-icon">
                        <FiFlag />
                    </span>

                    <span>
                        <small>รายการที่รอตรวจสอบ</small>
                        <strong>
                            {pendingReports.length.toLocaleString("th-TH")} รายการ
                        </strong>
                    </span>
                </section>

                <section className="notification-content">
                    <div className="notification-content-header">
                        <div>
                            <h2>กิจกรรมที่ถูกรายงาน</h2>
                            <p>เรียงจากรายการล่าสุด</p>
                        </div>

                        {pendingReports.length > 0 && (
                            <span className="notification-count">
                                {pendingReports.length}
                            </span>
                        )}
                    </div>

                    {loading ? (
                        <div className="notification-state">
                            <span className="notification-loader" />
                            <strong>กำลังโหลดการแจ้งเตือน</strong>
                            <p>กรุณารอสักครู่</p>
                        </div>
                    ) : error ? (
                        <div className="notification-state error">
                            <FiBell />
                            <strong>โหลดข้อมูลไม่สำเร็จ</strong>
                            <p>{error}</p>
                            <button onClick={loadReports}>ลองอีกครั้ง</button>
                        </div>
                    ) : pendingReports.length === 0 ? (
                        <div className="notification-state">
                            <span className="notification-empty-icon">
                                <FiBell />
                            </span>
                            <strong>ไม่มีการแจ้งเตือนใหม่</strong>
                            <p>ยังไม่มีกิจกรรมที่ถูกรายงานและรอตรวจสอบ</p>
                        </div>
                    ) : (
                        <div className="notification-list">
                            {pendingReports.map((report) => (
                                <article
                                    className="notification-card"
                                    key={report.id || report._id}
                                >
                                    <div className="notification-image-wrap">
                                        <img
                                            src={report.activityCover || fallback}
                                            alt={report.activityName || "กิจกรรมที่ถูกรายงาน"}
                                            onError={(event) => {
                                                event.currentTarget.src = fallback;
                                            }}
                                        />

                                        <span className="notification-flag">
                                            <FiFlag />
                                        </span>
                                    </div>

                                    <div className="notification-info">
                                        <div className="notification-title-row">
                                            <div>
                                                <span className="notification-type">
                                                    มีกิจกรรมถูกรายงาน
                                                </span>

                                                <h3>
                                                    {report.activityName || "ไม่ระบุชื่อกิจกรรม"}
                                                </h3>
                                            </div>

                                            <span className="notification-status">
                                                รอตรวจสอบ
                                            </span>
                                        </div>

                                        <div className="notification-reason">
                                            <small>เหตุผลในการรายงาน</small>
                                            <p>{report.reason || "ไม่ได้ระบุเหตุผล"}</p>
                                        </div>

                                        <div className="notification-meta">
                                            <span>
                                                <FiUsers />
                                                รายงานโดย @
                                                {report.reporterUsername ||
                                                    report.reporterName ||
                                                    "ผู้ใช้"}
                                            </span>

                                            <span>
                                                <FiCalendar />
                                                {formatDateTime(report.createdAt)}
                                            </span>
                                        </div>
                                    </div>

                                    <button
                                        className="notification-view-button"
                                        onClick={() =>
                                            navigate(
                                                `/activity-detail?id=${report.activityId}&from=admin`
                                            )
                                        }
                                    >
                                        ดูรายละเอียด
                                    </button>
                                </article>
                            ))}
                        </div>
                    )}
                </section>
            </main>
        </div>
    );
}

export default AdminNotifications;
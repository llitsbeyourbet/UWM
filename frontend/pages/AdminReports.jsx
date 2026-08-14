import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
    FiAlertTriangle,
    FiBell,
    FiCalendar,
    FiClock,
    FiChevronLeft,
    FiChevronRight,
    FiEye,
    FiFlag,
    FiGrid,
    FiLogOut,
    FiMapPin,
    FiSearch,
    FiSettings,
    FiShield,
    FiStar,
    FiUsers,
} from "react-icons/fi";
import { MdGroups } from "react-icons/md";
import API_URL from "../config";
import "./AdminDashboard.css";
import "./AdminReports.css";
import { formatDate, formatTime, formatDateTime, formatDateTimeDate, formatDateTimeTime } from "../utils/formatDate";
import { getCategoryIcon } from "../utils/categoryIcons";

const ITEMS_PER_PAGE = 5;

const FALLBACK_IMAGE =
    "https://placehold.co/320x220/f2efff/6846f5?text=Activity";

const statusLabel = {
    pending: "รอการตรวจสอบ",
    reviewing: "กำลังตรวจสอบ",
    resolved: "ดำเนินการแล้ว",
    rejected: "ปฏิเสธการรายงาน",
};

const normalizeStatus = (value) => {
    const status = String(value || "pending").toLowerCase();

    if (["reviewing", "in_review", "investigating"].includes(status)) {
        return "reviewing";
    }

    if (["resolved", "completed", "approved"].includes(status)) {
        return "resolved";
    }

    if (["rejected", "dismissed", "cancelled"].includes(status)) {
        return "rejected";
    }

    return "pending";
};

const timeAgo = (value) => {
    if (!value) return "";

    const date = new Date(value);
    const diff = Date.now() - date.getTime();

    if (Number.isNaN(diff) || diff < 0) return formatDate(value);

    const minute = 60 * 1000;
    const hour = 60 * minute;
    const day = 24 * hour;

    if (diff < minute) return "เมื่อสักครู่";
    if (diff < hour) return `${Math.floor(diff / minute)} นาทีที่แล้ว`;
    if (diff < day) return `${Math.floor(diff / hour)} ชั่วโมงที่แล้ว`;

    return `${Math.floor(diff / day)} วันที่แล้ว`;
};

function AdminReports() {
    const navigate = useNavigate();

    const [reports, setReports] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    const [activeStatus, setActiveStatus] = useState("all");
    const [search, setSearch] = useState("");
    const [sortOrder, setSortOrder] = useState("latest");
    const [page, setPage] = useState(1);

    const token = localStorage.getItem("token");

    const admin = useMemo(() => {
        try {
            return JSON.parse(localStorage.getItem("user")) || {};
        } catch {
            return {};
        }
    }, []);

    useEffect(() => {
        if (admin.role !== "admin") {
            navigate("/");
            return;
        }

        loadReports();
    }, []);

    const logout = () => {
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        navigate("/login");
    };

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
                throw new Error(data?.message || "โหลดรายงานกิจกรรมไม่สำเร็จ");
            }

            const list = Array.isArray(data)
                ? data
                : Array.isArray(data?.reports)
                    ? data.reports
                    : [];

            setReports(list);
        } catch (err) {
            console.error(err);
            setError(err.message || "ไม่สามารถโหลดรายงานกิจกรรมได้");
        } finally {
            setLoading(false);
        }
    };

    const counts = useMemo(() => {
        return reports.reduce(
            (result, report) => {
                const status = normalizeStatus(report.status);
                result.all += 1;
                result[status] += 1;
                if (["pending", "reviewing"].includes(status)) {
                    result.latest += 1;
                }
                return result;
            },
            {
                all: 0,
                latest: 0,
                pending: 0,
                reviewing: 0,
                resolved: 0,
                rejected: 0,
            }
        );
    }, [reports]);

    const navItems = [
        ["ภาพรวม", <FiGrid />, "/admin", false],
        ["กิจกรรม", <FiCalendar />, "/admin/activities", false],
        ["ผู้ใช้งาน", <FiUsers />, "/admin/users", false],
        ["รายงานกิจกรรม", <FiFlag />, "/admin/reports", true, counts.latest,],
        ["รีวิว", <FiStar />, "/admin/reviews", false],
    ];

    const filteredReports = useMemo(() => {
        const keyword = search.trim().toLowerCase();

        const result = reports.filter((report) => {
            const currentStatus = normalizeStatus(report.status);

            const matchesStatus =
                activeStatus === "latest"
                    ? ["pending", "reviewing"].includes(currentStatus)
                    : activeStatus === "all" || currentStatus === activeStatus;

            const searchableText = [
                report.activityName,
                report.reason,
                report.description,
                report.reporterUsername,
                report.reporterName,
                report.activityLocation,
            ]
                .filter(Boolean)
                .join(" ")
                .toLowerCase();

            const matchesSearch =
                keyword.length === 0 || searchableText.includes(keyword);

            return matchesStatus && matchesSearch;
        });

        return [...result].sort((a, b) => {
            const dateA = new Date(
                a.createdAt || a.reportedAt || 0
            ).getTime();

            const dateB = new Date(
                b.createdAt || b.reportedAt || 0
            ).getTime();

            // รายงานล่าสุด = เรียงตามคิว เก่าสุดก่อน
            if (activeStatus === "latest") {
                return dateA - dateB;
            }

            return sortOrder === "oldest"
                ? dateA - dateB
                : dateB - dateA;
        });
    }, [reports, activeStatus, search, sortOrder]);

    const totalPages = Math.max(
        1,
        Math.ceil(filteredReports.length / ITEMS_PER_PAGE)
    );

    const visibleReports = filteredReports.slice(
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

    const openActivity = async (report) => {
        const activityId =
            report.activityId ||
            report.activity?.id ||
            report.activity?._id;

        if (!activityId) return;

        await fetch(
            `${API_URL}/api/admin/reports/${report.id}/view`,
            {
                method: "PUT",
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            }
        );

        navigate(`/activity-detail?id=${activityId}&from=admin`);
    };

    const startReview = (report) => {
        const reportId = report.id || report._id;

        if (!reportId) return;

        navigate(`/admin/reports/${reportId}`);
    };

    const tabs = [
        { key: "all", label: "ทั้งหมด" },
        { key: "latest", label: "รายงานล่าสุด" },
        { key: "pending", label: "รอการตรวจสอบ" },
        { key: "reviewing", label: "กำลังตรวจสอบ" },
        { key: "resolved", label: "ดำเนินการแล้ว" },
        { key: "rejected", label: "ปฏิเสธการระงับ" },
    ];



    return (
        <div className="admin-shell">
            <aside className="admin-sidebar">
                <button type="button" className="admin-brand" onClick={() => navigate("/admin")}>
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
                            type="button"
                            key={label}
                            className={`admin-nav-item ${active ? "active" : ""}`}
                            onClick={() => navigate(path)}
                        >
                            <span>{icon}</span>
                            <b>{label}</b>

                            {badge > 0 && (
                                <i className="admin-nav-badge">
                                    {badge > 99 ? "99+" : badge}
                                </i>
                            )}
                        </button>
                    ))}
                </nav>

                <button type="button" className="admin-logout" onClick={logout}>
                    <FiLogOut /> ออกจากระบบ
                </button>
            </aside>

            <main className="admin-main">
                <div className="admin-reports-page">
                    <header className="reports-topbar">
                        <div className="reports-breadcrumb">
                            <button type="button" onClick={() => navigate("/admin")}>
                                หน้าหลัก
                            </button>

                            <span>/</span>
                            <strong>รายงานกิจกรรม</strong>
                        </div>
                    </header>

                    <main className="reports-panel">
                        <section className="reports-heading">
                            <div className="reports-heading-left">
                                <span className="reports-heading-icon">
                                    <FiFlag />
                                </span>

                                <div>
                                    <h1>รายงานกิจกรรม</h1>
                                    <p>ตรวจสอบกิจกรรมที่ถูกรายงานจากผู้ใช้งาน</p>
                                </div>
                            </div>

                            <div className="reports-pending-summary">
                                <strong>{counts.pending.toLocaleString("th-TH")}</strong>
                                <span>รายการที่รอการตรวจสอบ</span>
                            </div>
                        </section>

                        <nav className="reports-tabs" aria-label="สถานะรายงาน">
                            {tabs.map((tab) => (
                                <button
                                    type="button"
                                    key={tab.key}
                                    className={activeStatus === tab.key ? "active" : ""}
                                    onClick={() => setActiveStatus(tab.key)}
                                >
                                    {tab.label}

                                    <span
                                        className={`tab-count ${tab.key === "latest" && counts.latest > 0 ? "alert" : ""
                                            }`}
                                    >
                                        {counts[tab.key] || 0}
                                    </span>
                                </button>
                            ))}
                        </nav>

                        <section className="reports-toolbar">
                            <div className="reports-toolbar-left">
                                <label className="reports-select">
                                    <select
                                        value={activeStatus}
                                        onChange={(event) => setActiveStatus(event.target.value)}
                                        aria-label="กรองตามสถานะ"
                                    >
                                        <option value="all">ทั้งหมด</option>
                                        <option value="latest">รายงานล่าสุด</option>
                                        <option value="pending">รอการตรวจสอบ</option>
                                        <option value="reviewing">กำลังตรวจสอบ</option>
                                        <option value="resolved">ดำเนินการแล้ว</option>
                                        <option value="rejected">ปฏิเสธการระงับ</option>
                                    </select>
                                </label>

                                <label className="reports-select">
                                    <select
                                        value={sortOrder}
                                        onChange={(event) => setSortOrder(event.target.value)}
                                        aria-label="เรียงลำดับรายงาน"
                                    >
                                        <option value="latest">วันที่ล่าสุด</option>
                                        <option value="oldest">วันที่เก่าสุด</option>
                                    </select>
                                </label>
                            </div>

                            <label className="reports-search">
                                <FiSearch />

                                <input
                                    type="search"
                                    value={search}
                                    onChange={(event) => setSearch(event.target.value)}
                                    placeholder="ค้นหารายการ..."
                                />
                            </label>
                        </section>

                        {loading ? (
                            <section className="reports-state">
                                <span className="reports-loader" />
                                <strong>กำลังโหลดรายงานกิจกรรม</strong>
                            </section>
                        ) : error ? (
                            <section className="reports-state reports-error">
                                <FiAlertTriangle />
                                <strong>โหลดข้อมูลไม่สำเร็จ</strong>
                                <p>{error}</p>

                                <button type="button" onClick={loadReports}>
                                    ลองอีกครั้ง
                                </button>
                            </section>
                        ) : visibleReports.length === 0 ? (
                            <section className="reports-state">
                                <FiFlag />
                                <strong>ไม่พบรายงานกิจกรรม</strong>
                                <p>ยังไม่มีรายการที่ตรงกับตัวกรองหรือคำค้นหา</p>
                            </section>
                        ) : (
                            <section className="reports-list">
                                {visibleReports.map((report) => {
                                    const reportId = report.id || report._id;
                                    const currentStatus = normalizeStatus(report.status);

                                    const activityImage =
                                        report.activityCover ||
                                        report.activityImage ||
                                        report.activity?.coverImage ||
                                        report.activity?.image ||
                                        FALLBACK_IMAGE;
                                    return (
                                        <article className="report-card" key={reportId}>
                                            <div classname = "report-image-wrap">
                                            <img
                                                className="report-activity-image"
                                                src={activityImage}
                                                alt={report.activityName || "กิจกรรมที่ถูกรายงาน"}
                                                onError={(event) => {
                                                    event.currentTarget.src = FALLBACK_IMAGE;
                                                }}
                                            />
                                            </div>
                                            <div className="report-card-content">
                                                <div className="report-card-heading">
                                                    <div>
                                                        <div className="report-inline-info">
                                                            <h2>
                                                                {report.activityName || "ไม่ระบุชื่อกิจกรรม"}
                                                            </h2>
                                                            <span className="report-reason-tag">
                                                                {getCategoryIcon(report.reasonCategory || report.category)} {report.reasonCategory || report.category || "ถูกรายงาน"}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>

                                                <p className="report-description">
                                                    มีผู้ใช้งาน {report.reportCount || 1} คน รายงานกิจกรรมนี้
                                                    กด "เริ่มตรวจสอบ" เพื่อดูรายละเอียดผู้รายงานทั้งหมด
                                                </p>

                                                <div className="report-meta">

                                                    <span>
                                                        <FiCalendar />
                                                        {formatDateTimeDate(
                                                            report.createdAt
                                                        )}
                                                    </span>
                                                    <span>
                                                        <FiClock />
                                                        {formatDateTimeTime(
                                                            report.createdAt
                                                        )}
                                                    </span>

                                                    <span>
                                                        <FiUsers />
                                                        {Number(
                                                            report.participantCount ||
                                                            report.activity?.participantCount ||
                                                            0
                                                        ).toLocaleString("th-TH")}{" "}
                                                        คน
                                                    </span>
                                                </div>
                                            </div>
                                            <div className="report-card-right">
                                                <div className="report-time-status">
                                                    <div className="report-status-top">
                                                        <span>
                                                            {timeAgo(report.createdAt || report.reportedAt)}
                                                        </span>

                                                        <b className={`status-${currentStatus}`}>
                                                            {statusLabel[currentStatus]}
                                                        </b>
                                                    </div>

                                                    {report.reviewedAt &&
                                                        (currentStatus === "resolved" ||
                                                            currentStatus === "rejected") && (
                                                            <div
                                                                className={`report-reviewed-meta ${report.decision === "suspend_activity"
                                                                        ? "resolved"
                                                                        : "rejected"
                                                                    }`}
                                                            >
                                                                <FiShield />

                                                                <span>
                                                                    {report.decision === "suspend_activity"
                                                                        ? "ระงับกิจกรรมเมื่อ"
                                                                        : "ปฏิเสธการระงับเมื่อ"}
                                                                </span>

                                                                <strong>
                                                                    {formatDateTimeDate(report.reviewedAt)}
                                                                </strong>
                                                            </div>
                                                        )}
                                                </div>

                                                <div className="report-card-actions">
                                                    <button
                                                        type="button"
                                                        className="report-outline-button"
                                                        onClick={() => openActivity(report)}
                                                    >
                                                        <FiEye />
                                                        ดูรายละเอียด
                                                    </button>

                                                    {currentStatus === "resolved" ||
                                                        currentStatus === "rejected" ? (
                                                        <button
                                                            type="button"
                                                            className="report-completed-button"
                                                            onClick={() => startReview(report)}
                                                        >
                                                            <FiShield />
                                                            ดูผลตรวจสอบ
                                                        </button>
                                                    ) : (
                                                        <button
                                                            type="button"
                                                            className="report-primary-button"
                                                            onClick={() => startReview(report)}
                                                        >
                                                            <FiShield />

                                                            {currentStatus === "reviewing"
                                                                ? "ตรวจสอบต่อ"
                                                                : "เริ่มตรวจสอบ"}
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        </article>
                                    );
                                })}
                            </section>
                        )}

                        {!loading && !error && filteredReports.length > 0 && (
                            <footer className="reports-pagination">
                                <button
                                    type="button"
                                    disabled={page === 1}
                                    onClick={() => setPage((value) => value - 1)}
                                    aria-label="หน้าก่อนหน้า"
                                >
                                    <FiChevronLeft />
                                </button>

                                {Array.from({ length: totalPages }, (_, index) => index + 1)
                                    .filter(
                                        (pageNumber) =>
                                            pageNumber === 1 ||
                                            pageNumber === totalPages ||
                                            Math.abs(pageNumber - page) <= 1
                                    )
                                    .map((pageNumber) => (
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
                    </main>
                </div>
            </main >
        </div >
    );
}

export default AdminReports;
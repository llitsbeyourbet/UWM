import { useEffect, useMemo, useState } from "react";
import {
    FiAlertTriangle,
    FiCalendar,
    FiCheck,
    FiClock,
    FiEye,
    FiMapPin,
    FiSearch,
    FiUser,
    FiX,
    FiXCircle,
    FiTag,
    FiEdit3,
    FiMessageSquare,
    FiSlash,
    FiHeart,
    FiHash,
    FiFrown,
    FiVolume2,
} from "react-icons/fi";

import API_URL from "../config";
import "../styles/AdminDashboard.css";
import "../styles/AdminModeration.css";
import { useAdminReport } from "../src/context/AdminReportContext";
import AdminSidebar from "../components/AdminSidebar";
import AdminProfile from "../components/AdminProfile";
import AlertModal from "../components/AlertModal";

const PAGE_SIZE_OPTIONS = [5, 10, 25, 50, 75, 100];

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

const getModerationTypeMeta = (label = "") => {
    const value = String(label).toLowerCase();

    if (value.includes("safe")) return { label: "ปลอดภัย", className: "safe", Icon: FiCheck };
    if (value.includes("spam")) return { label: "สแปมหรือเนื้อหาเสี่ยง", className: "spam", Icon: FiAlertTriangle };
    if (value.includes("insult")) return { label: "คำดูหมิ่นหรือด่าทอ", className: "insult", Icon: FiMessageSquare };
    if (value.includes("profanity")) return { label: "คำหยาบ", className: "profanity", Icon: FiSlash };
    if (value.includes("sexual")) return { label: "เนื้อหาทางเพศที่ไม่เหมาะสม", className: "sexual", Icon: FiHeart };

    return { label: label || "ไม่ระบุ", className: "default", Icon: FiAlertTriangle };
};

const getConfidenceLevel = (value) => {
    const percent = Number(value) * 100;
    if (percent <= 30) return "low";
    if (percent <= 60) return "medium";
    if (percent <= 80) return "high";
    return "very-high";
};

const getItemStatus = (flags = []) => {
    if (flags.some((flag) => flag.status === "pending")) return "pending";
    if (flags.some((flag) => flag.status === "actioned")) return "actioned";
    if (flags.some((flag) => flag.status === "reviewed")) return "reviewed";
    if (flags.some((flag) => flag.status === "resolved")) return "resolved";
    return "reviewed";
};

const STATUS_LABELS = {
    pending: "รอตรวจสอบ",
    reviewed: "ตรวจสอบแล้ว",
    actioned: "ดำเนินการแล้ว",
    resolved: "ผู้สร้างแก้ไขแล้ว",
};

const FILTERS = [
    ["all", "ทั้งหมด"],
    ["pending", "รอตรวจสอบ"],
    ["resolved", "ผู้สร้างแก้ไขแล้ว"],
    ["reviewed", "ตรวจสอบแล้ว"],
    ["actioned", "ดำเนินการแล้ว"],
];

const getFlaggedText = (activity, flag) => {
    if (flag.flaggedText) return flag.flaggedText;

    // รองรับข้อมูลเก่าที่สร้างก่อนมี flaggedText
    if (flag.field === "activityName") return activity.activityName || "-";
    if (flag.field === "detail") return activity.detail || "-";

    return "-";
};

export default function AdminModerationActivities() {
    const [activities, setActivities] = useState([]);
    const [search, setSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState("all");
    const [page, setPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(5);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [selectedActivity, setSelectedActivity] = useState(null);
    const [detailLoading, setDetailLoading] = useState(false);
    const [actionLoading, setActionLoading] = useState(false);
    const [alertConfig, setAlertConfig] = useState(null);
    const { refreshModerationCounts } = useAdminReport();

    const showAlert = (type, title, message) => {
        setAlertConfig({
            type,
            title,
            message,
            confirmText: "ตกลง",
            onConfirm: () => setAlertConfig(null),
        });
    };

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
    }, [search, statusFilter, itemsPerPage]);

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
                        `${flag.field || ""} ${flag.fieldLabel || ""} ${flag.label || ""
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
        Math.ceil(filteredActivities.length / itemsPerPage)
    );

    useEffect(() => {
        if (page > totalPages) setPage(totalPages);
    }, [page, totalPages]);

    const visibleActivities = filteredActivities.slice(
        (page - 1) * itemsPerPage,
        page * itemsPerPage
    );

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
            showAlert(
                "error",
                "โหลดข้อมูลไม่สำเร็จ",
                err.message || "ไม่สามารถโหลดรายละเอียดกิจกรรมได้"
            );
        } finally {
            setDetailLoading(false);
        }
    };

    const confirmReviewed = () => {
        if (!selectedActivity || actionLoading) return;

        setAlertConfig({
            type: "confirm",
            title: "ยืนยันการตรวจสอบ",
            message: "ยืนยันว่าตรวจสอบกิจกรรมนี้แล้วและไม่ต้องดำเนินการเพิ่มเติม?",
            confirmText: "ยืนยัน",
            cancelText: "ยกเลิก",
            onCancel: () => setAlertConfig(null),
            onConfirm: () => {
                setAlertConfig(null);
                handleReviewed();
            },
        });
    };

    const handleReviewed = async () => {
        if (!selectedActivity || actionLoading) return;

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
            await refreshModerationCounts();

            showAlert(
                "success",
                "ตรวจสอบเรียบร้อยแล้ว",
                "บันทึกผลการตรวจสอบกิจกรรมเรียบร้อยแล้ว"
            );
        } catch (err) {
            console.error(err);
            showAlert(
                "error",
                "ดำเนินการไม่สำเร็จ",
                err.message || "ไม่สามารถบันทึกผลการตรวจสอบได้"
            );
        } finally {
            setActionLoading(false);
        }
    };

    const confirmSuspend = () => {
        if (!selectedActivity || actionLoading) return;

        setAlertConfig({
            type: "confirm",
            title: "ยืนยันการระงับกิจกรรม",
            message: `ต้องการระงับกิจกรรม "${selectedActivity.activityName}" หรือไม่?`,
            confirmText: "ระงับกิจกรรม",
            cancelText: "ยกเลิก",
            onCancel: () => setAlertConfig(null),
            onConfirm: () => {
                setAlertConfig(null);
                handleSuspend();
            },
        });
    };

    const handleSuspend = async () => {
        if (!selectedActivity || actionLoading) return;

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
            await refreshModerationCounts();

            showAlert(
                "success",
                "ระงับกิจกรรมเรียบร้อยแล้ว",
                "กิจกรรมถูกระงับเรียบร้อยแล้ว"
            );
        } catch (err) {
            console.error(err);
            showAlert(
                "error",
                "ระงับกิจกรรมไม่สำเร็จ",
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
                                <div className="admin-moderation-status-filter">
                                    <span>สถานะ</span>
                                    <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
                                        {FILTERS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                                    </select>
                                </div>
                                <label className="admin-moderation-search">
                                    <FiSearch />
                                    <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="ค้นหากิจกรรมหรือผู้สร้าง..." />
                                </label>
                                <div className="admin-moderation-page-size">
                                    <span>แสดง</span>
                                    <select value={itemsPerPage} onChange={(event) => setItemsPerPage(Number(event.target.value))}>
                                        {PAGE_SIZE_OPTIONS.map((size) => <option key={size} value={size}>{size}</option>)}
                                    </select>
                                    <span>รายการ</span>
                                </div>
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
                                            <th>ประเภทข้อความที่ตรวจพบ</th>
                                            <th>ค่าความไม่เหมาะสม</th>
                                            <th>สถานะ</th>
                                            <th>เวลาประมวลผลของ AI</th>
                                            <th>ตรวจสอบ</th>
                                        </tr>
                                    </thead>

                                    <tbody>
                                        {visibleActivities.map((activity) => {
                                            const status = getItemStatus(activity.moderationFlags);
                                            const latestFlag = [...(activity.moderationFlags || [])].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0];
                                            const typeMeta = getModerationTypeMeta(latestFlag?.label);
                                            const TypeIcon = typeMeta.Icon;

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
                                                        {latestFlag ? (
                                                            <span className={`admin-moderation-type-badge ${typeMeta.className}`}>
                                                                <span className="admin-moderation-type-icon"><TypeIcon /></span>
                                                                <span className="admin-moderation-type-divider" />
                                                                <span>{typeMeta.label}</span>
                                                            </span>
                                                        ) : "-"}
                                                    </td>
                                                    <td>
                                                        {latestFlag ? (
                                                            <div className={`admin-moderation-confidence-bar ${getConfidenceLevel(latestFlag.confidence)}`}>
                                                                <strong>{formatConfidence(latestFlag.confidence)}</strong>
                                                                <div className="admin-moderation-confidence-track"><span style={{ width: `${Math.min(Number(latestFlag.confidence) * 100, 100)}%` }} /></div>
                                                            </div>
                                                        ) : "-"}
                                                    </td>

                                                    <td>
                                                        <span
                                                            className={`admin-moderation-status ${status}`}
                                                        >
                                                            {STATUS_LABELS[status]}
                                                        </span>
                                                    </td>

                                                    <td>
                                                        {(() => {
                                                            const latestFlag = [...(activity.moderationFlags || [])]
                                                                .filter((flag) => flag.processingTimeMs != null)
                                                                .sort(
                                                                    (a, b) =>
                                                                        new Date(b.createdAt) - new Date(a.createdAt)
                                                                )[0];

                                                            return latestFlag ? (
                                                                <span className="admin-moderation-table-time">
                                                                    <FiClock />
                                                                    {(Number(latestFlag.processingTimeMs) / 1000).toFixed(2)} วินาที
                                                                </span>
                                                            ) : (
                                                                <span className="admin-moderation-time-empty">-</span>
                                                            );
                                                        })()}
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

                        {!loading && !error && filteredActivities.length > 0 && (
                            <footer className="admin-moderation-pagination">
                                <span>แสดง {(page - 1) * itemsPerPage + 1}–{Math.min(page * itemsPerPage, filteredActivities.length)} จาก {filteredActivities.length} กิจกรรม</span>
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
                                            AI ตรวจพบเนื้อหาที่อาจไม่เหมาะสม{" "}
                                            {selectedActivity.moderationFlags
                                                ?.length || 0}{" "}
                                            รายการ
                                        </p>
                                    </div>

                                    <span className="admin-moderation-ai-badge">
                                        AI ตรวจพบ
                                    </span>
                                </div>

                                <div className="admin-moderation-flag-list">
                                    {[...(selectedActivity.moderationFlags || [])]
                                        .sort(
                                            (a, b) =>
                                                new Date(a.createdAt) - new Date(b.createdAt)
                                        )
                                        .map((flag, index) => {
                                            const typeMeta = getModerationTypeMeta(flag.label);
                                            const TypeIcon = typeMeta.Icon;
                                            const fieldName =
                                                flag.field === "activityName"
                                                    ? "ชื่อกิจกรรม"
                                                    : flag.field === "detail"
                                                        ? "รายละเอียดกิจกรรม"
                                                        : flag.fieldLabel || flag.field;

                                            const originalValue = getFlaggedText(
                                                selectedActivity,
                                                flag
                                            );

                                            const resolvedValue = flag.resolvedText || null;

                                            const hasChanged =
                                                flag.status === "resolved" &&
                                                resolvedValue &&
                                                originalValue !== resolvedValue;

                                            return (
                                                <article
                                                    key={flag.id}
                                                    className="admin-moderation-flag-card admin-moderation-flag-card-new"
                                                >
                                                    <div className="admin-moderation-flag-card-header">
                                                        <div className="admin-moderation-flag-number">
                                                            {index + 1}
                                                        </div>

                                                        <div className="admin-moderation-flag-heading">
                                                            <strong>
                                                                การตรวจพบครั้งที่ {index + 1}
                                                            </strong>

                                                            <span className="admin-moderation-detected-field">
                                                                <FiEdit3 />
                                                                ตรวจพบใน: {fieldName}
                                                            </span>
                                                        </div>

                                                        <div className="admin-moderation-ai-metrics">
                                                            <span className="admin-moderation-confidence">
                                                                {formatConfidence(flag.confidence)}
                                                            </span>

                                                            {flag.processingTimeMs != null && (
                                                                <span className="admin-moderation-processing-time">
                                                                    <FiClock />
                                                                    {(Number(flag.processingTimeMs) / 1000).toFixed(2)} วินาที
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>

                                                    <div className="admin-moderation-flag-info">
                                                        <div className="admin-moderation-detected-text">
                                                            <span>ข้อความที่ตรวจพบ</span>
                                                            <p>“{originalValue}”</p>
                                                        </div>

                                                        <div className="admin-moderation-category-box">
                                                            <span><FiTag />ประเภท</span>
                                                            <span className={`admin-moderation-type-badge ${typeMeta.className}`}>
                                                                <span className="admin-moderation-type-icon"><TypeIcon /></span>
                                                                <span className="admin-moderation-type-divider" />
                                                                <span>{typeMeta.label}</span>
                                                            </span>
                                                        </div>
                                                    </div>

                                                    {flag.status === "resolved" && (
                                                        <>
                                                            {hasChanged ? (
                                                                <div className="admin-moderation-change-row">
                                                                    <div className="admin-moderation-before">
                                                                        <span>{fieldName}ก่อนแก้ไข</span>
                                                                        <p>“{originalValue}”</p>
                                                                    </div>

                                                                    <div className="admin-moderation-change-arrow">
                                                                        →
                                                                    </div>

                                                                    <div className="admin-moderation-after">
                                                                        <span>{fieldName}หลังแก้ไข</span>
                                                                        <p>“{resolvedValue}”</p>
                                                                    </div>
                                                                </div>
                                                            ) : (
                                                                <div className="admin-moderation-current-value">
                                                                    <FiCheck />

                                                                    <div>
                                                                        <span>
                                                                            {fieldName}หลังแก้ไข
                                                                        </span>
                                                                        <p>
                                                                            “{resolvedValue || "ไม่มีข้อมูลการแก้ไข"}”
                                                                        </p>
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </>
                                                    )}

                                                    <div className="admin-moderation-flag-status-row">
                                                        <span
                                                            className={`admin-moderation-status ${flag.status}`}
                                                        >
                                                            {STATUS_LABELS[flag.status] ||
                                                                flag.status}
                                                        </span>
                                                    </div>
                                                </article>
                                            );
                                        }
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
                                        onClick={confirmReviewed}
                                        disabled={actionLoading}
                                    >
                                        <FiCheck />
                                        ตรวจสอบแล้ว
                                    </button>

                                    <button
                                        type="button"
                                        className="admin-moderation-action danger"
                                        onClick={confirmSuspend}
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
                                    {getItemStatus(selectedActivity.moderationFlags) === "actioned"
                                        ? "ดำเนินการกับกิจกรรมนี้แล้ว"
                                        : getItemStatus(selectedActivity.moderationFlags) === "resolved"
                                            ? "ผู้สร้างแก้ไขเนื้อหาที่ตรวจพบแล้ว"
                                            : "ตรวจสอบกิจกรรมนี้แล้ว"}
                                </div>
                            )}
                        </div>
                    </aside>
                </>
            )}
            {alertConfig && (
                <AlertModal
                    config={alertConfig}
                    onClose={() => setAlertConfig(null)}
                />
            )}
        </div>
    );
}
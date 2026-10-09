import { useEffect, useMemo, useState } from "react";
import {
    FiAlertTriangle,
    FiCheck,
    FiClock,
    FiChevronDown,
    FiEdit3,
    FiEye,
    FiMessageSquare,
    FiSearch,
    FiStar,
    FiTag,
    FiUser,
    FiX,
    FiEyeOff,
    FiSlash,
    FiHeart,
} from "react-icons/fi";

import API_URL from "../config";
import "../styles/AdminDashboard.css";
import "../styles/AdminModeration.css";
import { useAdminReport } from "../src/context/AdminReportContext";
import AdminSidebar from "../components/AdminSidebar";
import AdminProfile from "../components/AdminProfile";
import AlertModal from "../components/AlertModal";

const PAGE_SIZE_OPTIONS = [5, 10, 25, 50, 75, 100];

const formatConfidence = (value) => {
    const number = Number(value);
    if (Number.isNaN(number)) return "0%";
    return `${(number * 100).toFixed(1)}%`;
};
const getModerationTypeMeta = (label = "") => {
    const value = String(label).toLowerCase();

    if (value.includes("safe")) return { label: "เหมาะสม", className: "safe", Icon: FiCheck };
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

const getSafeConfidenceLevel = (value) => {
    const percent = Number(value) * 100;

    if (percent >= 80) return "safe-very-high";
    if (percent >= 50) return "safe-high";
    if (percent >= 30) return "safe-medium";
    if (percent >= 15) return "safe-low";
    return "safe-very-low";
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
const TYPE_FILTERS = [
    ["all", "ทั้งหมด"],
    ["safe", "เหมาะสม"],
    ["profanity", "คำหยาบ"],
    ["insult", "คำดูหมิ่นหรือด่าทอ"],
    ["sexual", "เนื้อหาทางเพศที่ไม่เหมาะสม"],
    ["spam", "สแปมหรือเนื้อหาเสี่ยง"],
];

const Rating = ({ value }) => {
    const rating = Number(value) || 0;

    return (
        <div className="admin-moderation-rating">
            <div>
                {[1, 2, 3, 4, 5].map((star) => (
                    <FiStar key={star} className={star <= rating ? "filled" : ""} />
                ))}
            </div>
            <strong>{rating ? rating.toFixed(1) : "-"}</strong>
        </div>
    );
};

export default function AdminModerationReviews() {
    const [reviews, setReviews] = useState([]);
    const [search, setSearch] = useState("");
    const [typeFilter, setTypeFilter] = useState("all");
    const [typeDropdownOpen, setTypeDropdownOpen] = useState(false);
    const [page, setPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(5);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [selectedReview, setSelectedReview] = useState(null);
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

    const loadReviews = async () => {
        try {
            setLoading(true);
            setError("");

            const response = await fetch(`${API_URL}/api/admin/moderation/reviews`, {
                headers: { Authorization: `Bearer ${getToken()}` },
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(
                    data.message || "โหลดรายการรีวิวที่ต้องตรวจสอบไม่สำเร็จ"
                );
            }

            setReviews(Array.isArray(data) ? data : []);
        } catch (err) {
            console.error(err);
            setError(err.message || "ไม่สามารถโหลดรายการรีวิวที่ต้องตรวจสอบได้");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadReviews();
    }, []);

    useEffect(() => {
        setPage(1);
    }, [search, typeFilter, itemsPerPage]);

    useEffect(() => {
        if (!selectedReview) return undefined;

        const handleKeyDown = (event) => {
            if (event.key === "Escape" && !actionLoading) {
                setSelectedReview(null);
            }
        };

        document.addEventListener("keydown", handleKeyDown);
        document.body.classList.add("admin-moderation-panel-open");

        return () => {
            document.removeEventListener("keydown", handleKeyDown);
            document.body.classList.remove("admin-moderation-panel-open");
        };
    }, [selectedReview, actionLoading]);

    const pendingCount = useMemo(
        () =>
            reviews.filter(
                (review) => getItemStatus(review.moderationFlags) === "pending"
            ).length,
        [reviews]
    );

    const filteredReviews = useMemo(() => {
        const keyword = search.trim().toLowerCase();

        return reviews.filter((review) => {
            if (
                typeFilter !== "all" &&
                !(review.moderationFlags || []).some(
                    (flag) => flag.label === typeFilter
                )
            ) {
                return false;
            }

            if (!keyword) return true;

            const flagText = (review.moderationFlags || [])
                .map(
                    (flag) =>
                        `${flag.field || ""} ${flag.fieldLabel || ""} ${flag.label || ""
                        } ${flag.labelText || flag.categoryLabel || ""}`
                )
                .join(" ");

            return [
                review.activityName,
                review.reviewerName,
                review.reviewerUsername,
                flagText,
            ]
                .filter(Boolean)
                .join(" ")
                .toLowerCase()
                .includes(keyword);
        });
    }, [reviews, search, typeFilter]);

    const totalPages = Math.max(
        1,
        Math.ceil(filteredReviews.length / itemsPerPage)
    );

    useEffect(() => {
        if (page > totalPages) setPage(totalPages);
    }, [page, totalPages]);

    const visibleReviews = filteredReviews.slice(
        (page - 1) * itemsPerPage,
        page * itemsPerPage
    );

    const getPaginationNumbers = () => {
        if (totalPages <= 5) {
            return Array.from({ length: totalPages }, (_, index) => index + 1);
        }

        if (page <= 3) return [1, 2, 3, "...", totalPages];

        if (page >= totalPages - 2) {
            return [1, "...", totalPages - 2, totalPages - 1, totalPages];
        }

        return [1, "...", page, "...", totalPages];
    };

    const openReview = async (activityId, userId) => {
        try {
            setDetailLoading(true);

            const response = await fetch(
                `${API_URL}/api/admin/moderation/reviews/${activityId}/${userId}`,
                {
                    headers: {
                        Authorization: `Bearer ${getToken()}`,
                    },
                }
            );

            const data = await response.json();

            if (!response.ok) {
                throw new Error(
                    data.message || "โหลดรายละเอียดรีวิวไม่สำเร็จ"
                );
            }

            setSelectedReview(data);
        } catch (err) {
            console.error(err);
            showAlert(
                "error",
                "โหลดข้อมูลไม่สำเร็จ",
                err.message || "ไม่สามารถโหลดรายละเอียดรีวิวได้"
            );
        } finally {
            setDetailLoading(false);
        }
    };

    const confirmReviewed = () => {
        if (!selectedReview || actionLoading) return;

        setAlertConfig({
            type: "confirm",
            title: "ยืนยันการตรวจสอบ",
            message: "ยืนยันว่าตรวจสอบรีวิวนี้แล้วและไม่ต้องดำเนินการเพิ่มเติม?",
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
        if (!selectedReview || actionLoading) return;

        try {
            setActionLoading(true);

            const response = await fetch(
                `${API_URL}/api/admin/moderation/reviews/${selectedReview.activityId}/${selectedReview.userId}/reviewed`,
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

            setSelectedReview(null);
            await loadReviews();
            await refreshModerationCounts();

            showAlert(
                "success",
                "ตรวจสอบเรียบร้อยแล้ว",
                "บันทึกผลการตรวจสอบรีวิวเรียบร้อยแล้ว"
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

    const confirmHide = () => {
        if (!selectedReview || actionLoading) return;

        setAlertConfig({
            type: "confirm",
            title: "ยืนยันการซ่อนข้อความ",
            message: "ต้องการซ่อนเฉพาะข้อความรีวิวที่ AI ตรวจพบหรือไม่? คะแนนรีวิวจะยังคงอยู่",
            confirmText: "ซ่อนข้อความ",
            cancelText: "ยกเลิก",
            onCancel: () => setAlertConfig(null),
            onConfirm: () => {
                setAlertConfig(null);
                handleHide();
            },
        });
    };

    const handleHide = async () => {
        if (!selectedReview || actionLoading) return;

        try {
            setActionLoading(true);

            const response = await fetch(
                `${API_URL}/api/admin/moderation/reviews/${selectedReview.activityId}/${selectedReview.userId}/hide`,
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
                    data.message || "ซ่อนข้อความรีวิวไม่สำเร็จ"
                );
            }

            setSelectedReview(null);
            await loadReviews();

            showAlert(
                "success",
                "ซ่อนข้อความเรียบร้อยแล้ว",
                "ข้อความรีวิวที่ AI ตรวจพบถูกซ่อนเรียบร้อยแล้ว โดยคะแนนรีวิวยังคงอยู่"
            );
        } catch (err) {
            console.error(err);
            showAlert(
                "error",
                "ซ่อนข้อความไม่สำเร็จ",
                err.message || "ไม่สามารถซ่อนข้อความรีวิวได้"
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
                            <strong>รีวิวที่ต้องตรวจสอบ</strong>
                        </div>

                        <AdminProfile />
                    </div>

                    <section className="admin-moderation-heading">
                        <div className="admin-moderation-title">
                            <span className="admin-moderation-title-icon">
                                <FiMessageSquare />
                            </span>

                            <div>
                                <h1>รีวิวที่ต้องตรวจสอบ</h1>
                                <p>ตรวจสอบผลการจำแนกข้อความรีวิวด้วยระบบ AI</p>
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
                                <h2>รายการรีวิว</h2>
                                <p>แสดงรีวิวทั้งหมดที่ผ่านการตรวจสอบข้อความด้วย AI</p>
                            </div>

                            <div className="admin-moderation-toolbar">
                                <div className="admin-moderation-status-filter">
                                    <span>ประเภท</span>

                                    <div className="admin-moderation-type-dropdown">
                                        <button
                                            type="button"
                                            className="admin-moderation-type-trigger"
                                            onClick={() => setTypeDropdownOpen(!typeDropdownOpen)}
                                            aria-expanded={typeDropdownOpen}
                                        >
                                            <span className="admin-moderation-type-option">
                                                <i className={`type-dot ${typeFilter}`} />
                                                {TYPE_FILTERS.find(([value]) => value === typeFilter)?.[1]}
                                            </span>
                                            <FiChevronDown />
                                        </button>

                                        {typeDropdownOpen && (
                                            <div className="admin-moderation-type-menu">
                                                {TYPE_FILTERS.map(([value, label]) => (
                                                    <button
                                                        key={value}
                                                        type="button"
                                                        className={`admin-moderation-type-item ${typeFilter === value ? "active" : ""
                                                            }`}
                                                        onClick={() => {
                                                            setTypeFilter(value);
                                                            setTypeDropdownOpen(false);
                                                        }}
                                                    >
                                                        <i className={`type-dot ${value}`} />
                                                        {label}
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <label className="admin-moderation-search">
                                    <FiSearch />
                                    <input
                                        type="search"
                                        value={search}
                                        onChange={(event) => setSearch(event.target.value)}
                                        placeholder="ค้นหากิจกรรมหรือผู้รีวิว..."
                                    />
                                </label>

                                <div className="admin-moderation-page-size">
                                    <span>แสดง</span>

                                    <select
                                        value={itemsPerPage}
                                        onChange={(event) =>
                                            setItemsPerPage(Number(event.target.value))
                                        }
                                    >
                                        {PAGE_SIZE_OPTIONS.map((size) => (
                                            <option key={size} value={size}>
                                                {size}
                                            </option>
                                        ))}
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
                                <button type="button" onClick={loadReviews}>
                                    ลองอีกครั้ง
                                </button>
                            </div>
                        ) : visibleReviews.length === 0 ? (
                            <div className="admin-moderation-state">
                                <FiCheck />
                                <strong>ไม่พบรายการรีวิว</strong>
                                <p>ไม่มีข้อมูลที่ตรงกับสถานะหรือคำค้นหาที่เลือก</p>
                            </div>
                        ) : (
                            <div className="admin-moderation-table-wrapper">
                                <table className="admin-moderation-table">
                                    <thead>
                                        <tr>
                                            <th>กิจกรรม</th>
                                            <th>ผู้รีวิว</th>
                                            <th>ผลการจำแนกข้อความ</th>
                                            <th>ค่าความมั่นใจของ AI</th>
                                            <th>สถานะ</th>
                                            <th>เวลาประมวลผลของ AI</th>
                                            <th>ตรวจสอบ</th>
                                        </tr>
                                    </thead>

                                    <tbody>
                                        {visibleReviews.map((review) => {
                                            const status = getItemStatus(review.moderationFlags);

                                            const latestFlag = [...(review.moderationFlags || [])].sort(
                                                (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
                                            )[0];
                                            const typeMeta = getModerationTypeMeta(latestFlag?.label);
                                            const TypeIcon = typeMeta.Icon;

                                            return (
                                                <tr key={`${review.activityId}-${review.userId}`}>
                                                    <td>
                                                        <div className="admin-moderation-activity">
                                                            <div className="admin-moderation-cover">
                                                                {review.activityCover ? (
                                                                    <img
                                                                        src={review.activityCover}
                                                                        alt={review.activityName}
                                                                    />
                                                                ) : (
                                                                    <FiMessageSquare />
                                                                )}
                                                            </div>

                                                            <div>
                                                                <strong>{review.activityName}</strong>
                                                            </div>
                                                        </div>
                                                    </td>

                                                    <td>
                                                        <div className="admin-moderation-user">
                                                            <FiUser />

                                                            <div>
                                                                <strong>
                                                                    {review.reviewerName || "ไม่ระบุชื่อ"}
                                                                </strong>

                                                                {review.reviewerUsername && (
                                                                    <span>@{review.reviewerUsername}</span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </td>

                                                    <td>
                                                        {latestFlag ? (
                                                            <span
                                                                className={`admin-moderation-type-badge ${typeMeta.className}`}
                                                            >
                                                                <span className="admin-moderation-type-icon"><TypeIcon /></span>
                                                                <span className="admin-moderation-type-divider" />
                                                                <span>{typeMeta.label}</span>
                                                            </span>
                                                        ) : (
                                                            "-"
                                                        )}
                                                    </td>
                                                    <td>
                                                        {latestFlag ? (
                                                            <div className={`admin-moderation-confidence-bar ${latestFlag.label === "safe"
                                                                ? getSafeConfidenceLevel(latestFlag.confidence)
                                                                : getConfidenceLevel(latestFlag.confidence)
                                                                }`}>
                                                                <strong>
                                                                    {formatConfidence(latestFlag.confidence)}
                                                                </strong>

                                                                <div className="admin-moderation-confidence-track">
                                                                    <span
                                                                        style={{
                                                                            width: `${Math.min(
                                                                                Number(latestFlag.confidence) * 100,
                                                                                100
                                                                            )}%`,
                                                                        }}
                                                                    />
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            "-"
                                                        )}
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
                                                            const latestFlag = [...(review.moderationFlags || [])]
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
                                                                openReview(
                                                                    review.activityId,
                                                                    review.userId
                                                                )
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

                        {!loading && !error && filteredReviews.length > 0 && (
                            <footer className="admin-moderation-pagination">
                                <span>
                                    แสดง {(page - 1) * itemsPerPage + 1}–
                                    {Math.min(page * itemsPerPage, filteredReviews.length)} จาก{" "}
                                    {filteredReviews.length} รีวิว
                                </span>
                            </footer>
                        )}
                    </section>
                </div>
            </main>

            {selectedReview && (
                <>
                    <button
                        type="button"
                        className="admin-moderation-backdrop"
                        onClick={() => {
                            if (!actionLoading) setSelectedReview(null);
                        }}
                        aria-label="ปิดรายละเอียด"
                    />

                    <aside className="admin-moderation-panel">
                        <div className="admin-moderation-panel-header">
                            <div>
                                <span>ผลการตรวจสอบข้อความรีวิวด้วย AI</span>
                                <h2>{selectedReview.activityName}</h2>
                            </div>

                            <button
                                type="button"
                                onClick={() => setSelectedReview(null)}
                                disabled={actionLoading}
                                aria-label="ปิด"
                            >
                                <FiX />
                            </button>
                        </div>

                        <div className="admin-moderation-panel-body">
                            <section className="admin-moderation-detail-card">
                                <div className="admin-moderation-reviewer">
                                    <span>
                                        <FiUser />
                                    </span>

                                    <div>
                                        <small>ผู้รีวิว</small>
                                        <strong>
                                            {selectedReview.reviewerName || "ไม่ระบุชื่อ"}
                                        </strong>

                                        {selectedReview.reviewerUsername && (
                                            <p>@{selectedReview.reviewerUsername}</p>
                                        )}
                                    </div>
                                </div>

                                <h3>{selectedReview.activityName}</h3>

                                <div className="admin-moderation-ratings">
                                    <div>
                                        <span>คะแนนกิจกรรม</span>
                                        <Rating value={selectedReview.activityRating} />
                                    </div>

                                    <div>
                                        <span>คะแนนผู้สร้าง</span>
                                        <Rating value={selectedReview.hostRating} />
                                    </div>
                                </div>
                            </section>

                            <section className="admin-moderation-flags">
                                <div className="admin-moderation-flags-head">
                                    <div>
                                        <h3>ข้อความที่ AI ตรวจพบ</h3>
                                        <p>
                                            ผลการตรวจสอบข้อความด้วย AI {" "}
                                            {selectedReview.moderationFlags?.length || 0} รายการ
                                        </p>
                                    </div>

                                    <span className="admin-moderation-ai-badge">
                                        AI ตรวจพบ
                                    </span>
                                </div>

                                <div className="admin-moderation-flag-list">
                                    {(selectedReview.moderationFlags || []).map((flag, index) => {
                                        const typeMeta = getModerationTypeMeta(flag.label);
                                        const TypeIcon = typeMeta.Icon;

                                        return (
                                            <article key={flag.id} className="admin-moderation-flag-card admin-moderation-flag-card-new">
                                                <div className="admin-moderation-flag-card-header">
                                                    <div className="admin-moderation-flag-number">{index + 1}</div>

                                                    <div className="admin-moderation-flag-heading">
                                                        <strong>การตรวจพบครั้งที่ {index + 1}</strong>
                                                        <span className="admin-moderation-detected-field">
                                                            <FiEdit3 />
                                                            ตรวจพบใน: {flag.fieldLabel || flag.field}
                                                        </span>
                                                    </div>

                                                    <div className="admin-moderation-ai-metrics">
                                                        <span className={`admin-moderation-confidence ${typeMeta.className}`}>
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

                                                <div className="admin-moderation-flag-info admin-moderation-review-flag-info">
                                                    <div className="admin-moderation-detected-text">
                                                        <span>ข้อความที่ตรวจพบ</span>
                                                        <p>“{flag.comment || flag.commentText || "-"}”</p>
                                                    </div>

                                                    <div className="admin-moderation-category-box">
                                                        <span>
                                                            <FiTag />
                                                            ประเภท
                                                        </span>

                                                        <span className={`admin-moderation-type-badge ${typeMeta.className}`}>
                                                            <span className="admin-moderation-type-icon"><TypeIcon /></span>
                                                            <span className="admin-moderation-type-divider" />
                                                            <span>{typeMeta.label}</span>
                                                        </span>
                                                    </div>
                                                </div>

                                                <div className="admin-moderation-flag-status-row">
                                                    <span className={`admin-moderation-status ${flag.status}`}>
                                                        {STATUS_LABELS[flag.status] || flag.status}
                                                    </span>
                                                </div>
                                            </article>
                                        );
                                    })}
                                </div>
                            </section>

                            <div className="admin-moderation-review-note">
                                <FiEyeOff />

                                <div>
                                    <strong>การซ่อนข้อความรีวิว</strong>
                                    <p>
                                        ระบบจะซ่อนเฉพาะข้อความที่ AI ตรวจพบ
                                        โดยคะแนนรีวิวยังคงถูกเก็บและนำไปคำนวณตามปกติ
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="admin-moderation-panel-actions">
                            {getItemStatus(selectedReview.moderationFlags) ===
                                "pending" ? (
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
                                        onClick={confirmHide}
                                        disabled={actionLoading}
                                    >
                                        <FiEyeOff />
                                        ซ่อนข้อความที่ตรวจพบ
                                    </button>
                                </>
                            ) : (
                                <div
                                    className={`admin-moderation-completed ${getItemStatus(
                                        selectedReview.moderationFlags
                                    )}`}
                                >
                                    <FiCheck />
                                    {getItemStatus(selectedReview.moderationFlags) ===
                                        "actioned"
                                        ? "ดำเนินการกับรีวิวนี้แล้ว"
                                        : "ตรวจสอบรีวิวนี้แล้ว"}
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
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
    FiCalendar,
    FiChevronLeft,
    FiChevronRight,
    FiEye,
    FiSearch,
    FiStar,
    FiUser,
    FiX,
} from "react-icons/fi";

import API_URL from "../config";
import "../styles/AdminDashboard.css";
import "../styles/AdminReviews.css";
import AdminSidebar from "../components/AdminSidebar";
import AdminProfile from "../components/AdminProfile";

const ITEMS_PER_PAGE = 8;

const getReviewType = (review) => {
    return review.type === "host" ? "host" : "activity";
};

const getReviewerName = (review) => {
    return review.reviewerName || "ไม่ระบุชื่อ";
};

const getReviewerUsername = (review) => {
    return review.reviewerUsername || "";
};

const getReviewerAvatar = (review) => {
    return review.reviewerProfileImage || "";
};

const getReviewMessage = (review) => {
    if (review.comment) return review.comment;
    return "ไม่มีข้อความรีวิว";
};

const getRating = (review) => {
    const rating = Number(review.rating || 0);

    return Number.isNaN(rating)
        ? 0
        : Math.min(5, Math.max(0, rating));
};

const getReviewDateValue = (review) => {
    return (
        review.createdAt ||
        review.reviewedAt ||
        review.date ||
        null
    );
};

const formatDate = (dateValue) => {
    if (!dateValue) {
        return {
            date: "-",
            time: "",
        };
    }

    const date = new Date(dateValue);

    if (Number.isNaN(date.getTime())) {
        return {
            date: "-",
            time: "",
        };
    }

    return {
        date: date.toLocaleDateString("th-TH", {
            day: "numeric",
            month: "short",
            year: "numeric",
        }),
        time: date.toLocaleTimeString("th-TH", {
            hour: "2-digit",
            minute: "2-digit",
        }),
    };
};

function RatingStars({ rating }) {
    return (
        <div className="admin-review-rating">
            <div className="admin-review-stars">
                {Array.from({ length: 5 }, (_, index) => (
                    <FiStar
                        key={index}
                        className={
                            index < Math.round(rating)
                                ? "filled"
                                : ""
                        }
                    />
                ))}
            </div>

            <strong>{rating.toFixed(1)}</strong>
        </div>
    );
}

function ReviewCard({ review }) {
    const reviewerName = getReviewerName(review);
    const reviewerUsername = getReviewerUsername(review);
    const reviewerAvatar = getReviewerAvatar(review);
    const rating = getRating(review);
    const reviewDate = formatDate(
        getReviewDateValue(review)
    );

    return (
        <article className="admin-review-panel-card">
            <div className="admin-review-panel-card-top">
                <div className="admin-review-panel-user">
                    <div className="admin-review-panel-avatar">
                        {reviewerAvatar ? (
                            <img
                                src={reviewerAvatar}
                                alt={reviewerName}
                                onError={(event) => {
                                    event.currentTarget.style.display =
                                        "none";
                                }}
                            />
                        ) : (
                            <span>
                                {reviewerName
                                    .charAt(0)
                                    .toUpperCase()}
                            </span>
                        )}
                    </div>

                    <div>
                        <strong>{reviewerName}</strong>

                        <span>
                            {reviewerUsername
                                ? `@${reviewerUsername}`
                                : "ผู้ใช้งาน"}
                        </span>
                    </div>
                </div>

                <div className="admin-review-panel-date">
                    <strong>{reviewDate.date}</strong>
                    <span>{reviewDate.time}</span>
                </div>
            </div>

            <RatingStars rating={rating} />

            <p className="admin-review-panel-comment">
                {getReviewMessage(review)}
            </p>
        </article>
    );
}

export default function AdminReviews() {
    const navigate = useNavigate();

    const [reviews, setReviews] = useState([]);
    const [search, setSearch] = useState("");
    const [page, setPage] = useState(1);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [selectedActivity, setSelectedActivity] =
        useState(null);

    useEffect(() => {
        loadReviews();
    }, []);

    useEffect(() => {
        setPage(1);
    }, [search]);

    useEffect(() => {
        if (!selectedActivity) return undefined;

        const handleKeyDown = (event) => {
            if (event.key === "Escape") {
                setSelectedActivity(null);
            }
        };

        document.addEventListener(
            "keydown",
            handleKeyDown
        );

        document.body.classList.add(
            "admin-review-panel-open"
        );

        return () => {
            document.removeEventListener(
                "keydown",
                handleKeyDown
            );

            document.body.classList.remove(
                "admin-review-panel-open"
            );
        };
    }, [selectedActivity]);

    const loadReviews = async () => {
        try {
            setLoading(true);
            setError("");

            const token =
                sessionStorage.getItem("token");

            const response = await fetch(
                `${API_URL}/api/admin/reviews`,
                {
                    headers: {
                        Authorization: `Bearer ${token}`,
                    },
                }
            );

            const data = await response.json();

            if (!response.ok) {
                throw new Error(
                    data.message ||
                        "โหลดข้อมูลรีวิวไม่สำเร็จ"
                );
            }

            setReviews(
                Array.isArray(data.reviews)
                    ? data.reviews
                    : []
            );
        } catch (err) {
            console.error(err);

            setError(
                err.message ||
                    "ไม่สามารถโหลดข้อมูลรีวิวได้"
            );
        } finally {
            setLoading(false);
        }
    };

    /*
     * จัดกลุ่ม ActivityReview และ HostReview
     * ด้วย activityId เดียวกัน
     */
    const activities = useMemo(() => {
        const activityMap = new Map();

        reviews.forEach((review) => {
            const activityId = Number(
                review.activityId
            );

            if (!activityId) return;

            const type = getReviewType(review);

            let activity = activityMap.get(
                activityId
            );

            if (!activity) {
                activity = {
                    key: `activity-${activityId}`,
                    activityId,

                    name:
                        type === "activity"
                            ? review.targetName
                            : review.activityName,

                    image:
                        type === "activity"
                            ? review.targetImage
                            : null,

                    hostName:
                        review.creatorName ||
                        (type === "host"
                            ? review.targetName
                            : null) ||
                        "ไม่ระบุผู้จัดกิจกรรม",

                    hostUsername:
                        review.creatorUsername ||
                        (type === "host"
                            ? review.targetUsername
                            : "") ||
                        "",

                    hostImage:
                        review.creatorProfileImage ||
                        (type === "host"
                            ? review.targetImage
                            : null),

                    activityReviews: [],
                    hostReviews: [],
                    latestDate: 0,
                };

                activityMap.set(
                    activityId,
                    activity
                );
            }

            /*
             * เติมข้อมูลที่อาจยังไม่มี
             */
            if (
                type === "activity" &&
                review.targetName
            ) {
                activity.name = review.targetName;
            }

            if (
                type === "activity" &&
                review.targetImage
            ) {
                activity.image =
                    review.targetImage;
            }

            if (
                review.creatorName &&
                review.creatorName !==
                    "ไม่ระบุผู้จัดกิจกรรม"
            ) {
                activity.hostName =
                    review.creatorName;
            }

            if (review.creatorUsername) {
                activity.hostUsername =
                    review.creatorUsername;
            }

            if (review.creatorProfileImage) {
                activity.hostImage =
                    review.creatorProfileImage;
            }

            /*
             * fallback จาก HostReview
             */
            if (
                type === "host" &&
                activity.hostName ===
                    "ไม่ระบุผู้จัดกิจกรรม" &&
                review.targetName
            ) {
                activity.hostName =
                    review.targetName;
            }

            if (
                type === "host" &&
                !activity.hostImage &&
                review.targetImage
            ) {
                activity.hostImage =
                    review.targetImage;
            }

            if (type === "activity") {
                activity.activityReviews.push(
                    review
                );
            } else {
                activity.hostReviews.push(review);
            }

            const timestamp = new Date(
                getReviewDateValue(review) || 0
            ).getTime();

            if (!Number.isNaN(timestamp)) {
                activity.latestDate = Math.max(
                    activity.latestDate,
                    timestamp
                );
            }
        });

        return Array.from(activityMap.values())
            .filter(
                (activity) =>
                    activity.activityReviews.length >
                        0 ||
                    activity.hostReviews.length > 0
            )
            .map((activity) => {
                const activityReviewCount =
                    activity.activityReviews.length;

                const hostReviewCount =
                    activity.hostReviews.length;

                const totalReviewerCount =
                    Math.max(
                        activityReviewCount,
                        hostReviewCount
                    );

                const averageRating =
                    activityReviewCount > 0
                        ? activity.activityReviews.reduce(
                              (sum, review) =>
                                  sum +
                                  getRating(review),
                              0
                          ) /
                          activityReviewCount
                        : 0;

                return {
                    ...activity,

                    activityReviews: [
                        ...activity.activityReviews,
                    ].sort(
                        (a, b) =>
                            new Date(
                                getReviewDateValue(b) ||
                                    0
                            ).getTime() -
                            new Date(
                                getReviewDateValue(a) ||
                                    0
                            ).getTime()
                    ),

                    hostReviews: [
                        ...activity.hostReviews,
                    ].sort(
                        (a, b) =>
                            new Date(
                                getReviewDateValue(b) ||
                                    0
                            ).getTime() -
                            new Date(
                                getReviewDateValue(a) ||
                                    0
                            ).getTime()
                    ),

                    reviewCount:
                        totalReviewerCount,

                    averageRating,
                };
            })
            .sort(
                (a, b) =>
                    b.latestDate -
                    a.latestDate
            );
    }, [reviews]);

    const filteredActivities = useMemo(() => {
        const keyword = search
            .trim()
            .toLowerCase();

        if (!keyword) {
            return activities;
        }

        return activities.filter((activity) => {
            const reviewText = [
                ...activity.activityReviews,
                ...activity.hostReviews,
            ]
                .map((review) =>
                    [
                        getReviewMessage(review),
                        getReviewerName(review),
                        getReviewerUsername(review),
                    ]
                        .filter(Boolean)
                        .join(" ")
                )
                .join(" ");

            const searchableText = [
                activity.name,
                activity.hostName,
                activity.hostUsername,
                reviewText,
            ]
                .filter(Boolean)
                .join(" ")
                .toLowerCase();

            return searchableText.includes(keyword);
        });
    }, [activities, search]);

    const totalPages = Math.max(
        1,
        Math.ceil(
            filteredActivities.length /
                ITEMS_PER_PAGE
        )
    );

    useEffect(() => {
        if (page > totalPages) {
            setPage(totalPages);
        }
    }, [page, totalPages]);

    const visibleActivities =
        filteredActivities.slice(
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

        if (page <= 3) {
            return [
                1,
                2,
                3,
                "...",
                totalPages,
            ];
        }

        if (page >= totalPages - 2) {
            return [
                1,
                "...",
                totalPages - 2,
                totalPages - 1,
                totalPages,
            ];
        }

        return [
            1,
            "...",
            page,
            "...",
            totalPages,
        ];
    };

    const closePanel = () => {
        setSelectedActivity(null);
    };

    return (
        <div className="admin-shell">
            <AdminSidebar />

            <main className="admin-main">
                <div className="admin-reviews-page">
                    <div className="admin-reviews-topbar">
                        <div className="admin-reviews-breadcrumb">
                            <button
                                type="button"
                                onClick={() =>
                                    navigate("/admin")
                                }
                            >
                                หน้าหลัก
                            </button>

                            <span>/</span>

                            <strong>
                                ตรวจสอบรีวิว
                            </strong>
                        </div>

                        <AdminProfile />
                    </div>

                    <section className="admin-reviews-heading">
                        <div className="admin-reviews-title">
                            <span className="admin-reviews-title-icon">
                                <FiStar />
                            </span>

                            <div>
                                <h1>
                                    ตรวจสอบรีวิวกิจกรรม
                                </h1>

                                <p>
                                    ตรวจสอบรีวิวกิจกรรมและรีวิวผู้จัดกิจกรรมจากผู้ใช้งาน
                                </p>
                            </div>
                        </div>

                        <div className="admin-reviews-total">
                            <span>
                                <FiCalendar />
                            </span>

                            <div>
                                <small>
                                    กิจกรรมที่มีรีวิว
                                </small>

                                <strong>
                                    {activities.length.toLocaleString(
                                        "th-TH"
                                    )}
                                </strong>
                            </div>
                        </div>
                    </section>

                    <section className="admin-reviews-content">
                        <div className="admin-reviews-section-head">
                            <div>
                                <h2>
                                    รายการกิจกรรม
                                </h2>

                                <p>
                                    เลือกกิจกรรมเพื่อตรวจสอบรายละเอียดรีวิว
                                </p>
                            </div>

                            <label className="admin-reviews-search">
                                <FiSearch />

                                <input
                                    type="search"
                                    value={search}
                                    onChange={(event) =>
                                        setSearch(
                                            event.target.value
                                        )
                                    }
                                    placeholder="ค้นหาชื่อกิจกรรมหรือผู้จัดกิจกรรม..."
                                />
                            </label>
                        </div>

                        {loading ? (
                            <div className="admin-reviews-state">
                                <span className="admin-reviews-loader" />

                                <strong>
                                    กำลังโหลดข้อมูลรีวิว
                                </strong>
                            </div>
                        ) : error ? (
                            <div className="admin-reviews-state">
                                <FiStar />

                                <strong>
                                    โหลดข้อมูลไม่สำเร็จ
                                </strong>

                                <p>{error}</p>

                                <button
                                    type="button"
                                    onClick={
                                        loadReviews
                                    }
                                >
                                    ลองอีกครั้ง
                                </button>
                            </div>
                        ) : visibleActivities.length ===
                          0 ? (
                            <div className="admin-reviews-state">
                                <FiStar />

                                <strong>
                                    ไม่พบกิจกรรม
                                </strong>

                                <p>
                                    ไม่มีกิจกรรมที่มีรีวิวตรงกับคำค้นหา
                                </p>
                            </div>
                        ) : (
                            <div className="admin-reviews-table-wrapper">
                                <table className="admin-reviews-table">
                                    <thead>
                                        <tr>
                                            <th>
                                                กิจกรรม
                                            </th>

                                            <th>
                                                ผู้สร้างกิจกรรม
                                            </th>

                                            <th>
                                                จำนวนรีวิว
                                            </th>

                                            <th>
                                                ตรวจสอบรีวิว
                                            </th>
                                        </tr>
                                    </thead>

                                    <tbody>
                                        {visibleActivities.map(
                                            (activity) => (
                                                <tr
                                                    key={
                                                        activity.key
                                                    }
                                                >
                                                    <td>
                                                        <div className="admin-review-activity-cell">
                                                            <div className="admin-review-activity-image">
                                                                {activity.image ? (
                                                                    <img
                                                                        src={
                                                                            activity.image
                                                                        }
                                                                        alt={
                                                                            activity.name
                                                                        }
                                                                        onError={(
                                                                            event
                                                                        ) => {
                                                                            event.currentTarget.style.display =
                                                                                "none";
                                                                        }}
                                                                    />
                                                                ) : (
                                                                    <FiCalendar />
                                                                )}
                                                            </div>

                                                            <div>
                                                                <strong>
                                                                    {
                                                                        activity.name
                                                                    }
                                                                </strong>

                                                                <span className="admin-review-average">
                                                                    {activity.averageRating.toFixed(
                                                                        1
                                                                    )}{" "}
                                                                    <span>
                                                                        ⭐
                                                                    </span>
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </td>

                                                    <td>
                                                        <div className="admin-review-host">
                                                            <div className="admin-review-host-avatar">
                                                                {activity.hostImage ? (
                                                                    <img
                                                                        src={
                                                                            activity.hostImage
                                                                        }
                                                                        alt={
                                                                            activity.hostName
                                                                        }
                                                                        onError={(
                                                                            event
                                                                        ) => {
                                                                            event.currentTarget.style.display =
                                                                                "none";
                                                                        }}
                                                                    />
                                                                ) : (
                                                                    <FiUser />
                                                                )}
                                                            </div>

                                                            <div className="admin-review-host-info">
                                                                <strong>
                                                                    {
                                                                        activity.hostName
                                                                    }
                                                                </strong>

                                                                {activity.hostUsername && (
                                                                    <span>
                                                                        @
                                                                        {
                                                                            activity.hostUsername
                                                                        }
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </td>

                                                    <td>
                                                        <span className="admin-review-count">
                                                            {
                                                                activity.reviewCount
                                                            }{" "}
                                                            รีวิว
                                                        </span>
                                                    </td>

                                                    <td>
                                                        <button
                                                            type="button"
                                                            className="admin-review-eye-button"
                                                            onClick={() =>
                                                                setSelectedActivity(
                                                                    activity
                                                                )
                                                            }
                                                            aria-label={`ตรวจสอบรีวิว ${activity.name}`}
                                                            title="ตรวจสอบรีวิว"
                                                        >
                                                            <FiEye />
                                                        </button>
                                                    </td>
                                                </tr>
                                            )
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        )}

                        {!loading &&
                            !error &&
                            filteredActivities.length >
                                0 && (
                                <footer className="admin-reviews-pagination">
                                    <span>
                                        แสดง{" "}
                                        {(page - 1) *
                                            ITEMS_PER_PAGE +
                                            1}
                                        –
                                        {Math.min(
                                            page *
                                                ITEMS_PER_PAGE,
                                            filteredActivities.length
                                        )}{" "}
                                        จาก{" "}
                                        {filteredActivities.length.toLocaleString(
                                            "th-TH"
                                        )}{" "}
                                        กิจกรรม
                                    </span>

                                    <div>
                                        <button
                                            type="button"
                                            disabled={
                                                page === 1
                                            }
                                            onClick={() =>
                                                setPage(
                                                    (
                                                        current
                                                    ) =>
                                                        Math.max(
                                                            1,
                                                            current -
                                                                1
                                                        )
                                                )
                                            }
                                        >
                                            <FiChevronLeft />
                                        </button>

                                        {getPaginationNumbers().map(
                                            (
                                                pageNumber,
                                                index
                                            ) => {
                                                if (
                                                    typeof pageNumber !==
                                                    "number"
                                                ) {
                                                    return (
                                                        <span
                                                            key={`${pageNumber}-${index}`}
                                                            className="admin-pagination-dots"
                                                        >
                                                            ...
                                                        </span>
                                                    );
                                                }

                                                return (
                                                    <button
                                                        type="button"
                                                        key={
                                                            pageNumber
                                                        }
                                                        className={
                                                            page ===
                                                            pageNumber
                                                                ? "active"
                                                                : ""
                                                        }
                                                        onClick={() =>
                                                            setPage(
                                                                pageNumber
                                                            )
                                                        }
                                                    >
                                                        {
                                                            pageNumber
                                                        }
                                                    </button>
                                                );
                                            }
                                        )}

                                        <button
                                            type="button"
                                            disabled={
                                                page ===
                                                totalPages
                                            }
                                            onClick={() =>
                                                setPage(
                                                    (
                                                        current
                                                    ) =>
                                                        Math.min(
                                                            totalPages,
                                                            current +
                                                                1
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
                        className="admin-review-panel-backdrop"
                        aria-label="ปิดรายละเอียดรีวิว"
                        onClick={closePanel}
                    />

                    <aside className="admin-review-panel">
                        <div className="admin-review-panel-header">
                            <div>
                                <span>
                                    ตรวจสอบรีวิว
                                </span>

                                <h2>
                                    {
                                        selectedActivity.name
                                    }
                                </h2>
                            </div>

                            <button
                                type="button"
                                className="admin-review-panel-close"
                                onClick={closePanel}
                                aria-label="ปิด"
                            >
                                <FiX />
                            </button>
                        </div>

                        <div className="admin-review-panel-body">
                            <section className="admin-review-panel-activity">
                                <div className="admin-review-panel-cover">
                                    {selectedActivity.image ? (
                                        <img
                                            src={
                                                selectedActivity.image
                                            }
                                            alt={
                                                selectedActivity.name
                                            }
                                        />
                                    ) : (
                                        <FiCalendar />
                                    )}
                                </div>

                                <div className="admin-review-panel-activity-info">
                                    <h3>
                                        {
                                            selectedActivity.name
                                        }
                                    </h3>

                                    <div>
                                        <FiUser />

                                        <span>
                                            ผู้สร้างกิจกรรม{" "}
                                            <strong>
                                                {
                                                    selectedActivity.hostName
                                                }
                                            </strong>
                                        </span>
                                    </div>

                                    <div>
                                        <FiStar />

                                        <span>
                                            คะแนนกิจกรรม{" "}
                                            <strong>
                                                {selectedActivity.averageRating.toFixed(
                                                    1
                                                )}{" "}
                                                ⭐
                                            </strong>
                                        </span>
                                    </div>
                                </div>
                            </section>

                            <div className="admin-review-panel-divider" />

                            <section className="admin-review-panel-reviews">
                                <div className="admin-review-panel-reviews-head">
                                    <div>
                                        <h3>
                                            รีวิวกิจกรรม
                                        </h3>

                                        <p>
                                            ความคิดเห็นและคะแนนที่ผู้เข้าร่วมมอบให้กิจกรรม
                                        </p>
                                    </div>

                                    <span>
                                        {
                                            selectedActivity
                                                .activityReviews
                                                .length
                                        }{" "}
                                        รีวิว
                                    </span>
                                </div>

                                {selectedActivity
                                    .activityReviews
                                    .length > 0 ? (
                                    <div className="admin-review-panel-list">
                                        {selectedActivity.activityReviews.map(
                                            (
                                                review,
                                                index
                                            ) => (
                                                <ReviewCard
                                                    key={
                                                        review.id ||
                                                        `activity-review-${index}`
                                                    }
                                                    review={
                                                        review
                                                    }
                                                />
                                            )
                                        )}
                                    </div>
                                ) : (
                                    <div className="admin-review-panel-empty">
                                        ยังไม่มีรีวิวกิจกรรม
                                    </div>
                                )}
                            </section>

                            <div className="admin-review-panel-divider" />

                            <section className="admin-review-panel-reviews">
                                <div className="admin-review-panel-reviews-head">
                                    <div>
                                        <h3>
                                            รีวิวผู้สร้างกิจกรรม
                                        </h3>

                                        <p>
                                            คะแนนและความคิดเห็นที่ผู้เข้าร่วมมอบให้ผู้สร้างกิจกรรม
                                        </p>
                                    </div>

                                    <span>
                                        {
                                            selectedActivity
                                                .hostReviews
                                                .length
                                        }{" "}
                                        รีวิว
                                    </span>
                                </div>

                                {selectedActivity
                                    .hostReviews.length >
                                0 ? (
                                    <div className="admin-review-panel-list">
                                        {selectedActivity.hostReviews.map(
                                            (
                                                review,
                                                index
                                            ) => (
                                                <ReviewCard
                                                    key={
                                                        review.id ||
                                                        `host-review-${index}`
                                                    }
                                                    review={
                                                        review
                                                    }
                                                />
                                            )
                                        )}
                                    </div>
                                ) : (
                                    <div className="admin-review-panel-empty">
                                        ยังไม่มีรีวิวผู้จัดกิจกรรม
                                    </div>
                                )}
                            </section>
                        </div>
                    </aside>
                </>
            )}
        </div>
    );
}
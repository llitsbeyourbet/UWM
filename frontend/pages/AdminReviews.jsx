import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
    FiBell,
    FiCalendar,
    FiChevronLeft,
    FiChevronRight,
    FiDownload,
    FiFlag,
    FiGrid,
    FiLogOut,
    FiSearch,
    FiSettings,
    FiStar,
    FiUsers,
} from "react-icons/fi";
import { MdGroups } from "react-icons/md";

import API_URL from "../config";
import "./AdminDashboard.css";
import "./AdminReviews.css";

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

const getTargetTitle = (review) => {
    return review.targetName || "ไม่ระบุชื่อ";
};

const getTargetImage = (review) => {
    return review.targetImage || "";
};

const getReviewMessage = (review) => {
    if (review.comment) return review.comment;

    return review.type === "host"
        ? `ให้คะแนนผู้จัดกิจกรรมจาก ${review.activityName || "กิจกรรม"}`
        : "ไม่มีข้อความรีวิว";
};

const getRating = (review) => {
    const rating = Number(review.rating || 0);

    return Number.isNaN(rating)
        ? 0
        : Math.min(5, Math.max(0, rating));
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

export default function AdminReviews() {
    const navigate = useNavigate();

    const [reviews, setReviews] = useState([]);
    const [activeTab, setActiveTab] = useState("all");
    const [search, setSearch] = useState("");
    const [typeFilter, setTypeFilter] = useState("all");
    const [ratingFilter, setRatingFilter] = useState("all");
    const [sortOrder, setSortOrder] = useState("latest");
    const [page, setPage] = useState(1);

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    const navItems = [
        {
            label: "ภาพรวม",
            icon: <FiGrid />,
            path: "/admin",
        },
        {
            label: "กิจกรรม",
            icon: <FiCalendar />,
            path: "/admin/activities",
        },
        {
            label: "ผู้ใช้งาน",
            icon: <FiUsers />,
            path: "/admin/users",
        },
        {
            label: "รายงานกิจกรรม",
            icon: <FiFlag />,
            path: "/admin/reports",
        },
        {
            label: "การแจ้งเตือน",
            icon: <FiBell />,
            path: "/admin/notifications",
        },
        {
            label: "รีวิว",
            icon: <FiStar />,
            path: "/admin/reviews",
            active: true,
        },
        {
            label: "การตั้งค่า",
            icon: <FiSettings />,
            path: "/admin/settings",
        },
    ];

    useEffect(() => {
        loadReviews();
    }, []);

    useEffect(() => {
        setPage(1);
    }, [
        activeTab,
        search,
        typeFilter,
        ratingFilter,
        sortOrder,
    ]);

    const loadReviews = async () => {
        try {
            setLoading(true);
            setError("");

            const token = localStorage.getItem("token");

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
                    data.message || "โหลดข้อมูลรีวิวไม่สำเร็จ"
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
                err.message || "ไม่สามารถโหลดข้อมูลรีวิวได้"
            );
        } finally {
            setLoading(false);
        }
    };

    const logout = () => {
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        navigate("/login");
    };

    const reviewCounts = useMemo(() => {
        return reviews.reduce(
            (result, review) => {
                const type = getReviewType(review);

                result.all += 1;
                result[type] += 1;

                return result;
            },
            {
                all: 0,
                activity: 0,
                host: 0,
            }
        );
    }, [reviews]);

    const filteredReviews = useMemo(() => {
        const keyword = search.trim().toLowerCase();

        const result = reviews.filter((review) => {
            const type = getReviewType(review);
            const rating = getRating(review);

            const matchesTab =
                activeTab === "all" || type === activeTab;

            const matchesType =
                typeFilter === "all" || type === typeFilter;

            const matchesRating =
                ratingFilter === "all" ||
                Math.floor(rating) === Number(ratingFilter);

            const searchableText = [
                getTargetTitle(review),
                getReviewMessage(review),
                getReviewerName(review),
                getReviewerUsername(review),
            ]
                .filter(Boolean)
                .join(" ")
                .toLowerCase();

            const matchesSearch =
                !keyword || searchableText.includes(keyword);

            return (
                matchesTab &&
                matchesType &&
                matchesRating &&
                matchesSearch
            );
        });

        return [...result].sort((a, b) => {
            const dateA = new Date(
                a.createdAt ||
                a.reviewedAt ||
                a.date ||
                0
            ).getTime();

            const dateB = new Date(
                b.createdAt ||
                b.reviewedAt ||
                b.date ||
                0
            ).getTime();

            if (sortOrder === "oldest") {
                return dateA - dateB;
            }

            if (sortOrder === "rating-high") {
                return getRating(b) - getRating(a);
            }

            if (sortOrder === "rating-low") {
                return getRating(a) - getRating(b);
            }

            return dateB - dateA;
        });
    }, [
        reviews,
        activeTab,
        search,
        typeFilter,
        ratingFilter,
        sortOrder,
    ]);

    const totalPages = Math.max(
        1,
        Math.ceil(filteredReviews.length / ITEMS_PER_PAGE)
    );

    const visibleReviews = filteredReviews.slice(
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
            return [1, 2, 3, "...", totalPages];
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
            "... ",
            totalPages,
        ];
    };

    const handleExport = () => {
        if (filteredReviews.length === 0) {
            alert("ไม่มีข้อมูลรีวิวสำหรับส่งออก");
            return;
        }

        const headers = [
            "ชื่อ",
            "ข้อความรีวิว",
            "ประเภท",
            "คะแนน",
            "ผู้รีวิว",
            "ชื่อผู้ใช้",
            "วันที่",
        ];

        const rows = filteredReviews.map((review) => {
            const reviewDate = formatDate(
                review.createdAt ||
                review.reviewedAt ||
                review.date
            );

            return [
                getTargetTitle(review),
                getReviewMessage(review),
                getReviewType(review) === "activity"
                    ? "รีวิวกิจกรรม"
                    : "รีวิวผู้จัดกิจกรรม",
                getRating(review),
                getReviewerName(review),
                getReviewerUsername(review),
                `${reviewDate.date} ${reviewDate.time}`,
            ];
        });

        const escapeCsv = (value) => {
            const text = String(value ?? "");

            return `"${text.replace(/"/g, '""')}"`;
        };

        const csvContent = [
            headers.map(escapeCsv).join(","),
            ...rows.map((row) =>
                row.map(escapeCsv).join(",")
            ),
        ].join("\n");

        const blob = new Blob(
            ["\uFEFF", csvContent],
            {
                type: "text/csv;charset=utf-8;",
            }
        );

        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");

        link.href = url;
        link.download = `reviews-${new Date()
            .toISOString()
            .slice(0, 10)}.csv`;

        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        URL.revokeObjectURL(url);
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
                    {navItems.map((item) => (
                        <button
                            type="button"
                            key={item.label}
                            className={`admin-nav-item ${item.active ? "active" : ""
                                }`}
                            onClick={() => navigate(item.path)}
                        >
                            <span>{item.icon}</span>
                            <b>{item.label}</b>
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
                <div className="admin-reviews-page">
                    <div className="admin-reviews-breadcrumb">
                        <button
                            type="button"
                            onClick={() => navigate("/admin")}
                        >
                            หน้าหลัก
                        </button>

                        <span>/</span>
                        <strong>รีวิว</strong>
                    </div>

                    <section className="admin-reviews-heading">
                        <div className="admin-reviews-title">
                            <span className="admin-reviews-title-icon">
                                <FiStar />
                            </span>

                            <div>
                                <h1>จัดการรีวิว</h1>
                                <p>
                                    ตรวจสอบรีวิวกิจกรรมและผู้จัดกิจกรรมทั้งหมดในระบบ
                                </p>
                            </div>
                        </div>

                        <div className="admin-reviews-total">
                            <span>
                                <FiStar />
                            </span>

                            <div>
                                <small>รีวิวทั้งหมด</small>

                                <strong>
                                    {reviewCounts.all.toLocaleString("th-TH")}
                                </strong>
                            </div>
                        </div>
                    </section>

                    <section className="admin-reviews-content">
                        <div className="admin-reviews-tabs">
                            <button
                                type="button"
                                className={
                                    activeTab === "all" ? "active" : ""
                                }
                                onClick={() => setActiveTab("all")}
                            >
                                ทั้งหมด
                                <span>{reviewCounts.all}</span>
                            </button>

                            <button
                                type="button"
                                className={
                                    activeTab === "activity"
                                        ? "active"
                                        : ""
                                }
                                onClick={() =>
                                    setActiveTab("activity")
                                }
                            >
                                รีวิวกิจกรรม
                                <span>{reviewCounts.activity}</span>
                            </button>

                            <button
                                type="button"
                                className={
                                    activeTab === "host" ? "active" : ""
                                }
                                onClick={() => setActiveTab("host")}
                            >
                                รีวิวผู้จัดกิจกรรม
                                <span>{reviewCounts.host}</span>
                            </button>
                        </div>

                        <div className="admin-reviews-toolbar">
                            <label className="admin-reviews-search">
                                <FiSearch />

                                <input
                                    type="search"
                                    value={search}
                                    onChange={(event) =>
                                        setSearch(event.target.value)
                                    }
                                    placeholder="ค้นหากิจกรรม ผู้ใช้ หรือข้อความรีวิว..."
                                />
                            </label>

                            <label className="admin-review-filter">
                                <span>ประเภทรีวิว</span>

                                <select
                                    value={typeFilter}
                                    onChange={(event) =>
                                        setTypeFilter(event.target.value)
                                    }
                                >
                                    <option value="all">ทั้งหมด</option>
                                    <option value="activity">
                                        รีวิวกิจกรรม
                                    </option>
                                    <option value="host">
                                        รีวิวผู้จัดกิจกรรม
                                    </option>
                                </select>
                            </label>

                            <label className="admin-review-filter">
                                <span>คะแนน</span>

                                <select
                                    value={ratingFilter}
                                    onChange={(event) =>
                                        setRatingFilter(event.target.value)
                                    }
                                >
                                    <option value="all">ทั้งหมด</option>
                                    <option value="5">5 ดาว</option>
                                    <option value="4">4 ดาว</option>
                                    <option value="3">3 ดาว</option>
                                    <option value="2">2 ดาว</option>
                                    <option value="1">1 ดาว</option>
                                </select>
                            </label>

                            <label className="admin-review-filter">
                                <span>เรียงลำดับ</span>

                                <select
                                    value={sortOrder}
                                    onChange={(event) =>
                                        setSortOrder(event.target.value)
                                    }
                                >
                                    <option value="latest">
                                        ล่าสุดก่อน
                                    </option>
                                    <option value="oldest">
                                        เก่าสุดก่อน
                                    </option>
                                    <option value="rating-high">
                                        คะแนนมากไปน้อย
                                    </option>
                                    <option value="rating-low">
                                        คะแนนน้อยไปมาก
                                    </option>
                                </select>
                            </label>

                            <button
                                type="button"
                                className="admin-reviews-export"
                                onClick={handleExport}
                            >
                                <FiDownload />
                                ส่งออกข้อมูล
                            </button>
                        </div>

                        {loading ? (
                            <div className="admin-reviews-state">
                                <span className="admin-reviews-loader" />
                                <strong>กำลังโหลดข้อมูลรีวิว</strong>
                            </div>
                        ) : error ? (
                            <div className="admin-reviews-state">
                                <FiStar />
                                <strong>โหลดข้อมูลไม่สำเร็จ</strong>
                                <p>{error}</p>

                                <button
                                    type="button"
                                    onClick={loadReviews}
                                >
                                    ลองอีกครั้ง
                                </button>
                            </div>
                        ) : visibleReviews.length === 0 ? (
                            <div className="admin-reviews-state">
                                <FiStar />
                                <strong>ไม่พบข้อมูลรีวิว</strong>
                                <p>
                                    ไม่มีรีวิวที่ตรงกับตัวกรองหรือคำค้นหา
                                </p>
                            </div>
                        ) : (
                            <div className="admin-reviews-table-wrapper">
                                <table className="admin-reviews-table">
                                    <thead>
                                        <tr>
                                            <th>รีวิว</th>
                                            <th>ประเภท</th>
                                            <th>คะแนน</th>
                                            <th>รีวิวโดย</th>
                                            <th>วันที่</th>
                                        </tr>
                                    </thead>

                                    <tbody>
                                        {visibleReviews.map(
                                            (review, index) => {
                                                const reviewId =
                                                    review.id ||
                                                    review._id ||
                                                    `${page}-${index}`;

                                                const type =
                                                    getReviewType(review);

                                                const rating =
                                                    getRating(review);

                                                const reviewerName =
                                                    getReviewerName(review);

                                                const reviewerUsername =
                                                    getReviewerUsername(review);

                                                const reviewerAvatar =
                                                    getReviewerAvatar(review);

                                                const targetTitle =
                                                    getTargetTitle(review);

                                                const targetImage =
                                                    getTargetImage(review);

                                                const message =
                                                    getReviewMessage(review);

                                                const reviewDate = formatDate(
                                                    review.createdAt ||
                                                    review.reviewedAt ||
                                                    review.date
                                                );

                                                return (
                                                    <tr key={reviewId}>
                                                        <td>
                                                            <div className="admin-review-main-cell">
                                                                <div
                                                                    className={`admin-review-target-image ${type === "host"
                                                                            ? "person"
                                                                            : ""
                                                                        }`}
                                                                >
                                                                    {targetImage ? (
                                                                        <img
                                                                            src={targetImage}
                                                                            alt={targetTitle}
                                                                            onError={(event) => {
                                                                                event.currentTarget.style.display =
                                                                                    "none";
                                                                            }}
                                                                        />
                                                                    ) : (
                                                                        <span>
                                                                            {type ===
                                                                                "activity" ? (
                                                                                <FiCalendar />
                                                                            ) : (
                                                                                <FiUsers />
                                                                            )}
                                                                        </span>
                                                                    )}
                                                                </div>

                                                                <div className="admin-review-text">
                                                                    <strong>
                                                                        {targetTitle}
                                                                    </strong>

                                                                    <p>{message}</p>
                                                                </div>
                                                            </div>
                                                        </td>

                                                        <td>
                                                            <span
                                                                className={`admin-review-type admin-review-type-${type}`}
                                                            >
                                                                {type === "activity"
                                                                    ? "กิจกรรม"
                                                                    : "ผู้จัดกิจกรรม"}
                                                            </span>
                                                        </td>

                                                        <td>
                                                            <RatingStars
                                                                rating={rating}
                                                            />
                                                        </td>

                                                        <td>
                                                            <div className="admin-review-user">
                                                                <div className="admin-review-user-avatar">
                                                                    {reviewerAvatar ? (
                                                                        <img
                                                                            src={reviewerAvatar}
                                                                            alt={reviewerName}
                                                                            onError={(
                                                                                event
                                                                            ) => {
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
                                                                    <strong>
                                                                        {reviewerName}
                                                                    </strong>

                                                                    <small>
                                                                        {reviewerUsername
                                                                            ? `@${reviewerUsername}`
                                                                            : "ไม่ระบุชื่อผู้ใช้"}
                                                                    </small>
                                                                </div>
                                                            </div>
                                                        </td>

                                                        <td>
                                                            <div className="admin-review-date">
                                                                <strong>
                                                                    {reviewDate.date}
                                                                </strong>
                                                                <span>
                                                                    {reviewDate.time}
                                                                </span>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                );
                                            }
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        )}

                        {!loading &&
                            !error &&
                            filteredReviews.length > 0 && (
                                <footer className="admin-reviews-pagination">
                                    <span>
                                        แสดง{" "}
                                        {(page - 1) * ITEMS_PER_PAGE + 1}–
                                        {Math.min(
                                            page * ITEMS_PER_PAGE,
                                            filteredReviews.length
                                        )}{" "}
                                        จาก{" "}
                                        {filteredReviews.length.toLocaleString(
                                            "th-TH"
                                        )}{" "}
                                        รายการ
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
                                            (pageNumber, index) => {
                                                if (
                                                    typeof pageNumber !== "number"
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
                                                );
                                            }
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
        </div>
    );
}
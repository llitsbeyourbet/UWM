import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import API_URL from "../config";
import "../styles/CheckinHistory.css";
import Loading from "../components/Loading";

function CheckinHistory() {
    const navigate = useNavigate();

    const [history, setHistory] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");

    useEffect(() => {
        const loadHistory = async () => {
            try {
                const token = sessionStorage.getItem("token");

                if (!token) {
                    navigate("/login");
                    return;
                }

                const res = await fetch(
                    `${API_URL}/api/join/checkin-history`,
                    {
                        headers: {
                            Authorization: `Bearer ${token}`,
                        },
                    }
                );

                const data = await res.json();

                if (!res.ok) {
                    console.log(data);
                    return;
                }

                setHistory(Array.isArray(data) ? data : []);
            } catch (err) {
                console.log("load check-in history error:", err);
            } finally {
                setLoading(false);
            }
        };

        loadHistory();
    }, [navigate]);

    const formatDate = (date) => {
        if (!date) return "-";

        return new Date(date).toLocaleDateString("th-TH", {
            day: "numeric",
            month: "short",
            year: "numeric",
        });
    };

    const formatTime = (date) => {
        if (!date) return "";

        return new Date(date).toLocaleTimeString("th-TH", {
            hour: "2-digit",
            minute: "2-digit",
        });
    };

    const filteredHistory = history.filter((item) =>
        (item.activityName || "")
            .toLowerCase()
            .includes(searchTerm.trim().toLowerCase())
    );

    return (
        <div className="checkin-history-page">

            <header className="checkin-history-header">
                <button
                    type="button"
                    className="checkin-history-back"
                    onClick={() => navigate(-1)}
                    aria-label="กลับ"
                >
                    <span className="material-icons">
                        arrow_back_ios_new
                    </span>
                </button>

                <h1>ประวัติการเช็คอิน</h1>

                <div className="checkin-history-header-space" />
            </header>

            <div className="checkin-history-search">
                <span className="material-icons">search</span>

                <input
                    type="text"
                    placeholder="ค้นหากิจกรรม"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>

            {loading ? (
                <Loading />
            ) : filteredHistory.length === 0 ? (
                <div className="checkin-history-empty">
                    <span className="material-icons">history</span>
                    <p>
                        {searchTerm
                            ? "ไม่พบกิจกรรมที่ค้นหา"
                            : "ยังไม่มีประวัติการเช็คอิน"}
                    </p>
                </div>
            ) : (
                <div className="checkin-history-list">
                    {filteredHistory.map((item) => (
                        <div
                            className="checkin-history-card"
                            key={item.id}
                        >
                            <div className="checkin-history-image">
                                {item.cover ? (
                                    <img
                                        src={item.cover}
                                        alt={item.activityName}
                                    />
                                ) : (
                                    <div className="checkin-history-placeholder">
                                        <span className="material-icons">
                                            event
                                        </span>
                                    </div>
                                )}
                            </div>

                            <div className="checkin-history-info">
                                <h3>{item.activityName}</h3>

                                <div className="checkin-history-datetime">
                                    <span className="checkin-history-date">
                                        📅 {formatDate(item.checkedAt)}
                                    </span>

                                    {item.checkedAt && (
                                        <span className="checkin-history-time">
                                            🕐 เวลาเช็คอิน {formatTime(item.checkedAt)} น.
                                        </span>
                                    )}
                                </div>

                                <div className="checkin-history-status">
                                    <span className="material-icons">
                                        check
                                    </span>
                                    เช็คอินแล้ว
                                </div>
                            </div>

                            <button
                                type="button"
                                className="checkin-history-detail-btn"
                                onClick={() =>
                                    navigate(
                                        `/activity-detail?id=${item.activityId}`
                                    )
                                }
                            >
                                ดูรายละเอียด
                            </button>
                        </div>
                    ))}
                </div>
            )}

        </div>
    );
}

export default CheckinHistory;
import API_URL from "../config";
import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAlert } from "../hooks/useAlert";
import { formatDate } from "../utils/formatDate";
import "../styles/JoinRequests.css";
import Loading from "../components/Loading";

function JoinRequests() {
    const { activityId } = useParams();
    const navigate = useNavigate();
    const { showAlert } = useAlert();
    const [activity, setActivity] = useState(null);
    const [requests, setRequests] = useState([]);
    const [loading, setLoading] = useState(true);
    const [processingId, setProcessingId] = useState(null);

    const fetchData = useCallback(async () => {
        try {
            const token = sessionStorage.getItem("token");
            const [activityRes, requestsRes] = await Promise.all([
                fetch(`${API_URL}/api/activities/${activityId}`),
                fetch(`${API_URL}/api/join/${activityId}/requests`, { headers: { Authorization: `Bearer ${token}` } }),
            ]);
            const activityData = await activityRes.json();
            const requestsData = await requestsRes.json();
            if (!activityRes.ok) throw new Error(activityData.message || "ไม่พบข้อมูลกิจกรรม");
            if (!requestsRes.ok) throw new Error(requestsData.message || "ไม่สามารถโหลดคำขอเข้าร่วมได้");
            setActivity(activityData);
            setRequests(Array.isArray(requestsData) ? requestsData : []);
        } catch (err) {
            await showAlert({ type: "error", title: "ไม่สามารถโหลดข้อมูลได้", message: err.message || "เกิดข้อผิดพลาด" });
            navigate(-1);
        } finally { setLoading(false); }
    }, [activityId, navigate, showAlert]);

    useEffect(() => { fetchData(); }, [fetchData]);

    const handleRespond = async (request, status) => {
        if (processingId) return;
        setProcessingId(request.id);
        try {
            const token = sessionStorage.getItem("token");
            const res = await fetch(`${API_URL}/api/join/${activityId}/respond/${request.userId}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                body: JSON.stringify({ status }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || "ไม่สามารถจัดการคำขอได้");
            await showAlert({
                type: "success",
                title: status === "approved" ? "อนุมัติคำขอสำเร็จ" : "ปฏิเสธคำขอสำเร็จ",
                message: status === "approved" ? "ผู้ใช้ถูกเพิ่มในรายชื่อผู้เข้าร่วมกิจกรรมแล้ว" : "ปฏิเสธคำขอเข้าร่วมเรียบร้อยแล้ว",
            });
            await fetchData();
        } catch (err) {
            await showAlert({ type: "error", title: "ดำเนินการไม่สำเร็จ", message: err.message || "เกิดข้อผิดพลาด" });
        } finally { setProcessingId(null); }
    };

    const imageUrl = (image) => image ? (image.startsWith("http") ? image : `${API_URL}/uploads/${image}`) : null;
    const name = (r) => r.user?.name || r.user?.username || "ผู้ใช้งาน";
    const initial = (r) => (r.user?.name || r.user?.username || "U").trim().charAt(0).toUpperCase();
    const requestTime = (date) => {
        if (!date) return "-";
        const d = new Date(date);
        if (Number.isNaN(d.getTime())) return "-";
        return `${d.toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" })} ${d.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" })} น.`;
    };

    const pending = requests.filter(r => r.status === "pending");
    const approved = requests.filter(r => ["approved", "checked_in"].includes(r.status));
    const rejected = requests.filter(r => r.status === "rejected");

    const Row = ({ request, type }) => {
        const img = imageUrl(request.user?.profileImage);
        return (
            <div className="jr-row">
                <div className="jr-person">
                    <button className="jr-avatar" type="button" onClick={() => navigate(`/user/${request.userId}`)}>
                        {img ? <img src={img} alt={name(request)} /> : <span>{initial(request)}</span>}
                    </button>
                    <div className="jr-user">
                        <strong>{name(request)}</strong>
                        {request.user?.username && <span>@{request.user.username}</span>}
                        <small>◷ ขอเข้าร่วมเมื่อ {requestTime(request.createdAt)}</small>
                    </div>
                </div>
                {type === "pending" ? (
                    <div className="jr-actions">
                        <button className="jr-reject" disabled={processingId === request.id} onClick={() => handleRespond(request, "rejected")}>ปฏิเสธ</button>
                        <button className="jr-approve" disabled={processingId === request.id} onClick={() => handleRespond(request, "approved")}>อนุมัติ</button>
                    </div>
                ) : (
                    <span className={`jr-status ${type}`}>{type === "approved" ? "✓ อนุมัติแล้ว" : "✕ ปฏิเสธแล้ว"}</span>
                )}
            </div>
        );
    };

    const Section = ({ title, items, type, empty }) => {
        const [showAll, setShowAll] = useState(false);

        const visibleItems = showAll
            ? items
            : items.slice(0, 5);

        return (
            <section className="jr-section">
                <div className="jr-section-header">
                    <h3>
                        {title} ({items.length})
                    </h3>

                    {items.length > 5 && (
                        <button
                            type="button"
                            className="jr-show-more"
                            onClick={() => setShowAll(!showAll)}
                        >
                            {showAll
                                ? "แสดงน้อยลง"
                                : `ดูเพิ่มเติม (${items.length - 5} คน)`}
                        </button>
                    )}
                </div>

                {items.length ? (
                    <div>
                        {visibleItems.map((r) => (
                            <Row
                                key={r.id}
                                request={r}
                                type={type}
                            />
                        ))}
                    </div>
                ) : (
                    <p className="jr-empty">{empty}</p>
                )}
            </section>
        );
    };

    if (loading) return <Loading />;
    if (!activity) return null;
    const cover = imageUrl(activity.cover);

    return (
        <div className="join-requests-page">
            <header className="jr-header">
                <button type="button" onClick={() => navigate(-1)} aria-label="ย้อนกลับ"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="15 18 9 12 15 6" /></svg></button>
                <h1>คำขอเข้าร่วมกิจกรรม</h1><span />
            </header>
            <section className="jr-activity">
                <div className="jr-cover">{cover ? <img src={cover} alt={activity.activityName} /> : <div />}</div>
                <div className="jr-activity-info">
                    <h2>{activity.activityName}</h2>
                    <span>📅 {formatDate(activity.date)}</span>
                    <span>📍 {activity.location || "-"}</span>
                    <b>{activity.activityType === "public" ? "กิจกรรมสาธารณะ" : "กิจกรรมส่วนตัว"}</b>
                </div>
            </section>
            <Section title="คำขอรออนุมัติ" items={pending} type="pending" empty="ไม่มีคำขอที่รออนุมัติ" />
            <Section title="อนุมัติแล้ว" items={approved} type="approved" empty="ยังไม่มีคำขอที่อนุมัติ" />
            <Section title="ปฏิเสธแล้ว" items={rejected} type="rejected" empty="ยังไม่มีคำขอที่ปฏิเสธ" />
        </div>
    );
}
export default JoinRequests;

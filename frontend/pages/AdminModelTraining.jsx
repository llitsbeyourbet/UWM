
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  FiCpu,
  FiPlus,
  FiDatabase,
  FiClock,
  FiCheckCircle,
  FiAlertCircle,
  FiRefreshCw,
} from "react-icons/fi";
import AdminSidebar from "../components/AdminSidebar";
import AdminProfile from "../components/AdminProfile";
import "../styles/AdminDashboard.css";
import "../styles/AdminModelTraining.css";

const API_URL = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");
const BATCH_SIZE = 30;

const CATEGORIES = [
  { value: "profanity", label: "คำหยาบ" },
  { value: "insult", label: "คำดูหมิ่นหรือด่าทอ" },
  { value: "sexual", label: "เนื้อหาทางเพศที่ไม่เหมาะสม" },
  { value: "spam", label: "สแปมหรือเนื้อหาเสี่ยง" },
];

const STATUS_LABELS = {
  pending: "รอฝึก",
  preparing: "เตรียมข้อมูล",
  training: "กำลังฝึก",
  evaluating: "ประเมินผล",
  completed: "สำเร็จ",
  failed: "ล้มเหลว",
};

const getCategoryLabel = (value) =>
  CATEGORIES.find((item) => item.value === value)?.label ||
  value ||
  "-";

const formatDate = (value) =>
  value
    ? new Date(value).toLocaleString("th-TH", {
        dateStyle: "short",
        timeStyle: "short",
      })
    : "-";

async function apiRequest(path, options = {}) {
  const token = sessionStorage.getItem("token");

  if (!token) {
    throw new Error("ไม่พบข้อมูลการเข้าสู่ระบบ กรุณาเข้าสู่ระบบใหม่");
  }

  const response = await fetch(`${API_URL}/api/admin${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...options.headers,
    },
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      data.message || `ไม่สามารถเชื่อมต่อระบบได้ (${response.status})`
    );
  }

  return data;
}

export default function AdminModelTraining() {
  const [examples, setExamples] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [waitingCount, setWaitingCount] = useState(0);
  const [sentence, setSentence] = useState("");
  const [category, setCategory] = useState("profanity");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const loadData = useCallback(async (showLoading = false) => {
    if (showLoading) setLoading(true);

    try {
      const [exampleData, statusData] = await Promise.all([
        apiRequest("/training/examples"),
        apiRequest("/moderation-training/status"),
      ]);

      setExamples(Array.isArray(exampleData) ? exampleData : []);
      setJobs(Array.isArray(statusData.jobs) ? statusData.jobs : []);
      setWaitingCount(
        Number(
          statusData.waitingExamples ??
          statusData.waitingWords ??
          0
        )
      );
      setConnected(true);
      setError("");
    } catch (err) {
      setConnected(false);
      setError(err.message || "ไม่สามารถโหลดข้อมูลจาก Backend ได้");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData(true);

    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        loadData(false);
      }
    }, 30000);

    return () => window.clearInterval(timer);
  }, [loadData]);

  const latestJob = jobs.find((job) =>
    ["preparing", "training", "evaluating", "pending"].includes(
      job.status
    )
  );

  const progress = Math.min(
    (Math.max(waitingCount, 0) / BATCH_SIZE) * 100,
    100
  );

  const remaining = Math.max(0, BATCH_SIZE - waitingCount);

  const categoryCounts = useMemo(
    () =>
      CATEGORIES.map((item) => ({
        ...item,
        count: examples.filter(
          (example) => example.category === item.value
        ).length,
      })),
    [examples]
  );

  const addExample = async (event) => {
    event.preventDefault();
    setNotice("");
    setError("");

    const text = sentence.normalize("NFKC").trim();

    if (!text) {
      setError("กรุณากรอกประโยคตัวอย่าง");
      return;
    }

    if (text.length > 2000) {
      setError("ประโยคต้องมีความยาวไม่เกิน 2000 ตัวอักษร");
      return;
    }

    if (!connected) {
      setError("ยังไม่สามารถเชื่อมต่อ Backend ได้");
      return;
    }

    try {
      setSaving(true);

      const result = await apiRequest("/training/examples", {
        method: "POST",
        body: JSON.stringify({ text, category }),
      });

      setSentence("");
      setNotice(
        result.queueResult?.createdJobs > 0
          ? "บันทึกสำเร็จ และสร้างงานฝึกโมเดลอัตโนมัติแล้ว"
          : result.queueResult === null
            ? "บันทึกประโยคสำเร็จ แต่ระบบสร้างคิวฝึกยังไม่สำเร็จ"
            : "บันทึกประโยคตัวอย่างเรียบร้อยแล้ว"
      );

      await loadData(false);
    } catch (err) {
      setError(err.message || "ไม่สามารถเพิ่มประโยคได้");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="admin-shell">
      <AdminSidebar />

      <main className="admin-main">
        <div className="admin-page-top">
          <div className="admin-word-breadcrumb">
            <span>หน้าหลัก</span>
            <span>/</span>
            <strong>ฝึกโมเดล AI</strong>
          </div>
          <AdminProfile />
        </div>

        <section className="amt-panel">
          <div className="amt-heading">
            <div className="amt-title">
              <span className="amt-title-icon">
                <FiCpu />
              </span>
              <div>
                <h1>ฝึกโมเดล AI</h1>
                <p>
                  เพิ่มประโยคตัวอย่างสำหรับพัฒนาระบบตรวจสอบ
                  ข้อความไม่เหมาะสม
                </p>
              </div>
            </div>

            <button
              type="button"
              className="admin-word-add"
              onClick={() => loadData(true)}
              disabled={loading || saving}
            >
              <FiRefreshCw />
              รีเฟรชข้อมูล
            </button>
          </div>

          <div className="amt-info">
            <FiAlertCircle />
            <div>
              <strong>
                {connected
                  ? "เชื่อมต่อ Backend แล้ว"
                  : "ยังไม่สามารถเชื่อมต่อ Backend ได้"}
              </strong>
              <p>
                {connected
                  ? "ประโยคที่เพิ่มจะถูกบันทึกลงฐานข้อมูล และเมื่อสะสมครบ 30 ประโยค ระบบจะสร้างงานฝึกอัตโนมัติ"
                  : "กรุณาตรวจสอบ Backend และฐานข้อมูล ขณะนี้ยังไม่สามารถเพิ่มประโยคได้"}
              </p>
            </div>
          </div>

          {error && (
            <p className="amt-error" role="alert">
              {error}
            </p>
          )}

          {notice && (
            <p style={{ color: "#0f8f83", fontSize: 13 }}>
              {notice}
            </p>
          )}

          <div className="amt-stats">
            <div className="amt-stat">
              <span>
                <FiDatabase /> ประโยคที่สะสม
              </span>
              <strong>
                {connected ? `${waitingCount} / 30` : "- / 30"}
              </strong>
              <small>ประโยคที่รอเข้ารอบฝึก</small>
            </div>

            <div className="amt-stat">
              <span>
                <FiClock /> ต้องเพิ่มอีก
              </span>
              <strong>{connected ? remaining : "-"}</strong>
              <small>ประโยคจึงจะครบชุดถัดไป</small>
            </div>

            <div className="amt-stat">
              <span>
                <FiCpu /> สถานะการฝึก
              </span>
              <strong className="amt-status-text">
                {!connected
                  ? "ไม่สามารถเชื่อมต่อ"
                  : latestJob
                    ? STATUS_LABELS[latestJob.status] ||
                      latestJob.status
                    : "ยังไม่มีงานที่รอฝึก"}
              </strong>
              <small>
                {latestJob
                  ? `Job #${latestJob.id}`
                  : "ข้อมูลจากระบบจริง"}
              </small>
            </div>
          </div>

          <div className="amt-progress-section">
            <div className="amt-progress-heading">
              <strong>ความคืบหน้าการสะสมข้อมูล</strong>
              <span>
                {connected ? `${Math.round(progress)}%` : "-"}
              </span>
            </div>

            <div
              className="amt-progress-track"
              role="progressbar"
              aria-valuenow={connected ? waitingCount : 0}
              aria-valuemin={0}
              aria-valuemax={BATCH_SIZE}
            >
              <div
                style={{
                  width: connected ? `${progress}%` : "0%",
                }}
              />
            </div>

            <p>
              {connected
                ? `เพิ่มอีก ${remaining} ประโยค เพื่อให้ครบชุดฝึกถัดไป`
                : "รอข้อมูลจาก Backend"}
            </p>
          </div>

          <div className="amt-section-heading">
            <h2>
              <FiPlus /> เพิ่มประโยคสำหรับฝึกโมเดล
            </h2>
            <p>เลือกประเภทข้อความให้ตรงกับประโยคตัวอย่าง</p>
          </div>

          <form className="amt-form" onSubmit={addExample}>
            <label>
              <span>ประโยคตัวอย่าง</span>
              <textarea
                value={sentence}
                onChange={(event) =>
                  setSentence(event.target.value)
                }
                placeholder="กรอกประโยคที่ต้องการนำไปฝึกโมเดล..."
                maxLength={2000}
                rows={3}
                disabled={!connected || saving}
              />
            </label>

            <div className="amt-form-bottom">
              <label>
                <span>ประเภทข้อความ</span>
                <select
                  value={category}
                  onChange={(event) =>
                    setCategory(event.target.value)
                  }
                  disabled={!connected || saving}
                >
                  {CATEGORIES.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </label>

              <button
                type="submit"
                disabled={!connected || saving}
              >
                <FiPlus />
                {saving ? "กำลังบันทึก..." : "เพิ่มประโยค"}
              </button>
            </div>
          </form>

          <div className="amt-category-summary">
            {categoryCounts.map((item) => (
              <div key={item.value}>
                <span>{item.label}</span>
                <strong>{connected ? item.count : "-"}</strong>
              </div>
            ))}
          </div>

          <div className="amt-section-heading">
            <h2>รายการประโยคที่เพิ่ม</h2>
            <p>
              {connected
                ? `แสดง ${examples.length} ประโยคล่าสุด`
                : "รอข้อมูลจาก Backend"}
            </p>
          </div>

          <div className="amt-table-wrap">
            <table className="amt-table">
              <thead>
                <tr>
                  <th>ลำดับ</th>
                  <th>ประโยคตัวอย่าง</th>
                  <th>ประเภทข้อความ</th>
                  <th>สถานะ</th>
                </tr>
              </thead>

              <tbody>
                {loading || !connected || examples.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="amt-empty">
                      {loading
                        ? "กำลังโหลดข้อมูล..."
                        : !connected
                          ? "ไม่สามารถโหลดข้อมูลจาก Backend ได้"
                          : "ยังไม่มีประโยคตัวอย่าง"}
                    </td>
                  </tr>
                ) : (
                  examples.map((item, index) => (
                    <tr key={item.id}>
                      <td>{index + 1}</td>
                      <td className="amt-sentence">
                        {item.text}
                      </td>
                      <td>
                        <span
                          className={`amt-category ${item.category}`}
                        >
                          {getCategoryLabel(item.category)}
                        </span>
                      </td>
                      <td>
                        {item.status === "waiting"
                          ? "รอสะสมข้อมูล"
                          : item.status === "queued"
                            ? "เข้าคิวฝึกแล้ว"
                            : item.status === "completed"
                              ? "ฝึกเสร็จแล้ว"
                              : item.status || "-"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="amt-section-heading amt-history-heading">
            <h2>
              <FiCheckCircle /> ประวัติการฝึกโมเดล
            </h2>
          </div>

          <div className="amt-table-wrap">
            <table className="amt-table">
              <thead>
                <tr>
                  <th>Job ID</th>
                  <th>เวอร์ชันโมเดล</th>
                  <th>สถานะ</th>
                  <th>วันที่เริ่มฝึก</th>
                </tr>
              </thead>

              <tbody>
                {loading || !connected || jobs.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="amt-empty">
                      {loading
                        ? "กำลังโหลดข้อมูล..."
                        : !connected
                          ? "ไม่สามารถโหลดประวัติได้"
                          : "ยังไม่มีประวัติการฝึก"}
                    </td>
                  </tr>
                ) : (
                  jobs.map((job) => (
                    <tr key={job.id}>
                      <td>#{job.id}</td>
                      <td>{job.modelVersion || "-"}</td>
                      <td>
                        {STATUS_LABELS[job.status] ||
                          job.status ||
                          "-"}
                      </td>
                      <td>
                        {formatDate(
                          job.startedAt || job.createdAt
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
}

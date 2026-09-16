import { useEffect, useMemo, useState } from "react";
import {
  FiEdit2,
  FiPlus,
  FiSearch,
  FiShield,
  FiTrash2,
  FiX,
} from "react-icons/fi";
import AdminSidebar from "../components/AdminSidebar";
import { useAlert } from "../src/context/AlertContext";
import "../styles/AdminInappropriateWords.css";

const API_URL = import.meta.env.VITE_API_URL;

const CATEGORY_OPTIONS = [
  { value: "profanity", label: "คำหยาบ" },
  { value: "insult", label: "คำดูหมิ่นหรือด่าทอ" },
  { value: "threat", label: "คำข่มขู่หรือคุกคาม" },
  { value: "sexual", label: "เนื้อหาทางเพศที่ไม่เหมาะสม" },
  { value: "spam", label: "สแปมหรือเนื้อหาเสี่ยง" },
  {
    value: "alcohol",
    label: "เนื้อหาที่เกี่ยวข้องกับเครื่องดื่มมึนเมา",
  },
];

const CATEGORY_LABELS = Object.fromEntries(
  CATEGORY_OPTIONS.map((item) => [item.value, item.label])
);

const ITEMS_PER_PAGE = 8;

export default function AdminInappropriateWords() {
  const { showAlert } = useAlert();

  const [words, setWords] = useState([]);
  const [search, setSearch] = useState("");
  const [levelFilter, setLevelFilter] = useState("all");
  const [page, setPage] = useState(1);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [showModal, setShowModal] = useState(false);
  const [editingWord, setEditingWord] = useState(null);

  const [form, setForm] = useState({
    word: "",
    category: "profanity",
    level: "warning",
  });

  const getToken = () => sessionStorage.getItem("token");

  const loadWords = async () => {
    try {
      setLoading(true);

      const response = await fetch(
        `${API_URL}/api/admin/inappropriate-words`,
        {
          headers: {
            Authorization: `Bearer ${getToken()}`,
          },
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message || "ไม่สามารถโหลดรายการคำไม่เหมาะสมได้"
        );
      }

      setWords(data);
    } catch (error) {
      await showAlert({
        type: "error",
        title: "เกิดข้อผิดพลาด",
        message: error.message,
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadWords();
  }, []);

  const filteredWords = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    return words.filter((item) => {
      const level =
        Number(item.weight) >= 70 ? "danger" : "warning";

      const matchSearch =
        !keyword ||
        String(item.word || "")
          .toLowerCase()
          .includes(keyword) ||
        String(CATEGORY_LABELS[item.category] || "")
          .toLowerCase()
          .includes(keyword);

      const matchLevel =
        levelFilter === "all" || levelFilter === level;

      return matchSearch && matchLevel;
    });
  }, [words, search, levelFilter]);

  const totalPages = Math.max(
    1,
    Math.ceil(filteredWords.length / ITEMS_PER_PAGE)
  );

  const currentWords = filteredWords.slice(
    (page - 1) * ITEMS_PER_PAGE,
    page * ITEMS_PER_PAGE
  );

  useEffect(() => {
    setPage(1);
  }, [search, levelFilter]);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  const openAddModal = () => {
    setEditingWord(null);

    setForm({
      word: "",
      category: "profanity",
      level: "warning",
    });

    setShowModal(true);
  };

  const openEditModal = (item) => {
    setEditingWord(item);

    setForm({
      word: item.word || "",
      category: item.category || "profanity",
      level:
        Number(item.weight) >= 70 ? "danger" : "warning",
    });

    setShowModal(true);
  };

  const closeModal = () => {
    if (saving) return;

    setShowModal(false);
    setEditingWord(null);
  };

  const handleSave = async () => {
    const cleanWord = form.word.trim();

    if (!cleanWord) {
      await showAlert({
        type: "warning",
        title: "กรุณากรอกข้อมูล",
        message: "กรุณากรอกคำที่ต้องการเพิ่ม",
      });

      return;
    }

    try {
      setSaving(true);

      const url = editingWord
        ? `${API_URL}/api/admin/inappropriate-words/${editingWord.id}`
        : `${API_URL}/api/admin/inappropriate-words`;

      const response = await fetch(url, {
        method: editingWord ? "PUT" : "POST",

        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getToken()}`,
        },

        body: JSON.stringify({
          word: cleanWord,
          category: form.category,
          level: form.level,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message || "ไม่สามารถบันทึกข้อมูลได้"
        );
      }

      setShowModal(false);
      setEditingWord(null);

      await loadWords();

      await showAlert({
        type: "success",
        title: editingWord
          ? "แก้ไขคำสำเร็จ"
          : "เพิ่มคำสำเร็จ",
        message: editingWord
          ? "แก้ไขคำที่ใช้ในการตรวจจับเรียบร้อยแล้ว"
          : "เพิ่มคำเข้าสู่ระบบตรวจจับเรียบร้อยแล้ว",
      });
    } catch (error) {
      await showAlert({
        type: "error",
        title: "เกิดข้อผิดพลาด",
        message: error.message,
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (item) => {
    const confirmed = window.confirm(
      `ต้องการลบคำ "${item.word}" ใช่หรือไม่`
    );

    if (!confirmed) return;

    try {
      const response = await fetch(
        `${API_URL}/api/admin/inappropriate-words/${item.id}`,
        {
          method: "DELETE",

          headers: {
            Authorization: `Bearer ${getToken()}`,
          },
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message || "ไม่สามารถลบคำได้"
        );
      }

      await loadWords();

      await showAlert({
        type: "success",
        title: "ลบคำสำเร็จ",
        message: "นำคำออกจากระบบตรวจจับเรียบร้อยแล้ว",
      });
    } catch (error) {
      await showAlert({
        type: "error",
        title: "เกิดข้อผิดพลาด",
        message: error.message,
      });
    }
  };

  return (
    <div className="admin-word-layout">
      <AdminSidebar />

      <main className="admin-word-main">
        <div className="admin-word-breadcrumb">
          <span>หน้าหลัก</span>
          <span>/</span>
          <strong>เพิ่มคำไม่เหมาะสม</strong>
        </div>

        <section className="admin-word-card">
          <div className="admin-word-heading">
            <div className="admin-word-title">
              <div className="admin-word-title-icon">
                <FiShield />
              </div>

              <div>
                <h1>เพิ่มคำไม่เหมาะสม</h1>

                <p>
                  เพิ่ม แก้ไข หรือลบคำที่ใช้ในการตรวจจับ
                  ข้อความไม่เหมาะสมในระบบ
                </p>
              </div>
            </div>

            <button
              type="button"
              className="admin-word-add"
              onClick={openAddModal}
            >
              <FiPlus />
              เพิ่มคำไม่เหมาะสม
            </button>
          </div>

          <div className="admin-word-info">
            <FiShield />

            <div>
              <strong>คำที่เพิ่มจะถูกนำไปใช้กับระบบวิเคราะห์ข้อความ</strong>

              <span>
                ระบบจะนำคำที่ผู้ดูแลระบบเพิ่มไปตรวจสอบร่วมกับ
                คำพื้นฐานที่มีอยู่ในระบบ
              </span>
            </div>
          </div>

          <div className="admin-word-toolbar">
            <label className="admin-word-search">
              <FiSearch />

              <input
                type="text"
                placeholder="ค้นหาคำ..."
                value={search}
                onChange={(event) =>
                  setSearch(event.target.value)
                }
              />
            </label>

            <select
              value={levelFilter}
              onChange={(event) =>
                setLevelFilter(event.target.value)
              }
            >
              <option value="all">ทุกระดับ</option>
              <option value="warning">Warning</option>
              <option value="danger">Danger</option>
            </select>
          </div>

          <div className="admin-word-table-wrap">
            <table className="admin-word-table">
              <thead>
                <tr>
                  <th>คำ</th>
                  <th>ประเภท</th>
                  <th>ระดับความรุนแรง</th>
                  <th>วันที่เพิ่ม</th>
                  <th>จัดการ</th>
                </tr>
              </thead>

              <tbody>
                {loading ? (
                  <tr>
                    <td
                      colSpan="5"
                      className="admin-word-empty"
                    >
                      กำลังโหลด...
                    </td>
                  </tr>
                ) : currentWords.length === 0 ? (
                  <tr>
                    <td
                      colSpan="5"
                      className="admin-word-empty"
                    >
                      ยังไม่มีคำที่ผู้ดูแลระบบเพิ่ม
                    </td>
                  </tr>
                ) : (
                  currentWords.map((item) => {
                    const isDanger =
                      Number(item.weight) >= 70;

                    return (
                      <tr key={item.id}>
                        <td>
                          <strong>{item.word}</strong>
                        </td>

                        <td>
                          {CATEGORY_LABELS[item.category] ||
                            item.category}
                        </td>

                        <td>
                          <span
                            className={`admin-word-level ${
                              isDanger
                                ? "danger"
                                : "warning"
                            }`}
                          >
                            {isDanger
                              ? "Danger"
                              : "Warning"}
                          </span>
                        </td>

                        <td>
                          {item.createdAt
                            ? new Date(
                                item.createdAt
                              ).toLocaleDateString(
                                "th-TH"
                              )
                            : "-"}
                        </td>

                        <td>
                          <div className="admin-word-actions">
                            <button
                              type="button"
                              title="แก้ไข"
                              onClick={() =>
                                openEditModal(item)
                              }
                            >
                              <FiEdit2 />
                            </button>

                            <button
                              type="button"
                              className="delete"
                              title="ลบ"
                              onClick={() =>
                                handleDelete(item)
                              }
                            >
                              <FiTrash2 />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="admin-word-pagination">
              <button
                type="button"
                disabled={page === 1}
                onClick={() =>
                  setPage((current) => current - 1)
                }
              >
                ‹
              </button>

              {Array.from(
                { length: totalPages },
                (_, index) => index + 1
              ).map((number) => (
                <button
                  type="button"
                  key={number}
                  className={
                    page === number ? "active" : ""
                  }
                  onClick={() => setPage(number)}
                >
                  {number}
                </button>
              ))}

              <button
                type="button"
                disabled={page === totalPages}
                onClick={() =>
                  setPage((current) => current + 1)
                }
              >
                ›
              </button>
            </div>
          )}
        </section>
      </main>

      {showModal && (
        <div
          className="admin-word-modal-overlay"
          onClick={closeModal}
        >
          <div
            className="admin-word-modal"
            onClick={(event) =>
              event.stopPropagation()
            }
          >
            <div className="admin-word-modal-header">
              <div>
                <h2>
                  {editingWord
                    ? "แก้ไขคำไม่เหมาะสม"
                    : "เพิ่มคำไม่เหมาะสม"}
                </h2>

                <p>
                  กำหนดคำ ประเภท และระดับความรุนแรง
                  สำหรับระบบตรวจจับ
                </p>
              </div>

              <button
                type="button"
                onClick={closeModal}
              >
                <FiX />
              </button>
            </div>

            <label className="admin-word-field">
              <span>คำที่ต้องการเพิ่ม</span>

              <input
                type="text"
                maxLength="255"
                placeholder="กรอกคำ..."
                value={form.word}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    word: event.target.value,
                  }))
                }
              />
            </label>

            <label className="admin-word-field">
              <span>ประเภท</span>

              <select
                value={form.category}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    category: event.target.value,
                  }))
                }
              >
                {CATEGORY_OPTIONS.map((item) => (
                  <option
                    key={item.value}
                    value={item.value}
                  >
                    {item.label}
                  </option>
                ))}
              </select>
            </label>

            <div className="admin-word-field">
              <span>ระดับความรุนแรง</span>

              <div className="admin-word-level-options">
                <label
                  className={
                    form.level === "warning"
                      ? "selected warning"
                      : ""
                  }
                >
                  <input
                    type="radio"
                    name="level"
                    value="warning"
                    checked={
                      form.level === "warning"
                    }
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        level: event.target.value,
                      }))
                    }
                  />

                  <div>
                    <strong>Warning</strong>
                    <small>
                      แจ้งเตือนให้ผู้ใช้ตรวจสอบข้อความ
                    </small>
                  </div>
                </label>

                <label
                  className={
                    form.level === "danger"
                      ? "selected danger"
                      : ""
                  }
                >
                  <input
                    type="radio"
                    name="level"
                    value="danger"
                    checked={
                      form.level === "danger"
                    }
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        level: event.target.value,
                      }))
                    }
                  />

                  <div>
                    <strong>Danger</strong>
                    <small>
                      ต้องแก้ไขข้อความก่อนดำเนินการ
                    </small>
                  </div>
                </label>
              </div>
            </div>

            <div className="admin-word-modal-actions">
              <button
                type="button"
                className="cancel"
                onClick={closeModal}
                disabled={saving}
              >
                ยกเลิก
              </button>

              <button
                type="button"
                className="save"
                onClick={handleSave}
                disabled={saving}
              >
                {saving
                  ? "กำลังบันทึก..."
                  : editingWord
                    ? "บันทึกการแก้ไข"
                    : "เพิ่มคำ"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  FiBell,
  FiCalendar,
  FiChevronLeft,
  FiChevronRight,
  FiEye,
  FiFlag,
  FiGrid,
  FiLogOut,
  FiMail,
  FiMoreVertical,
  FiSearch,
  FiSettings,
  FiStar,
  FiUserCheck,
  FiUserX,
  FiUsers,
} from "react-icons/fi";
import { MdGroups } from "react-icons/md";

import API_URL from "../config";
import "./AdminDashboard.css";
import "./AdminUsers.css";

const ITEMS_PER_PAGE = 8;

const fallbackAvatar =
  "https://placehold.co/100x100/EEEAFD/6846F5?text=U";

const getUserStatus = (user) => {
  if (
    user.isSuspended ||
    user.isBlocked ||
    ["suspended", "blocked", "disabled"].includes(
      String(user.status || "").toLowerCase()
    )
  ) {
    return "suspended";
  }

  return "active";
};

const formatDate = (dateValue) => {
  if (!dateValue) return "-";

  const date = new Date(dateValue);

  if (Number.isNaN(date.getTime())) return "-";

  return date.toLocaleDateString("th-TH", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
};

export default function AdminUsers() {
  const navigate = useNavigate();

  const [users, setUsers] = useState([]);
  const [activeTab, setActiveTab] = useState("all");
  const [search, setSearch] = useState("");
  const [sortOrder, setSortOrder] = useState("latest");
  const [page, setPage] = useState(1);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const navItems = [
    ["ภาพรวม", <FiGrid />, "/admin"],
    ["กิจกรรม", <FiCalendar />, "/admin/activities"],
    ["ผู้ใช้งาน", <FiUsers />, "/admin/users", true],
    ["รายงานกิจกรรม", <FiFlag />, "/admin/reports"],
    ["การแจ้งเตือน", <FiBell />, "/admin/notifications"],
    ["รีวิว", <FiStar />, "/admin/reviews"],
    ["การตั้งค่า", <FiSettings />, "/admin/settings"],
  ];

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      setLoading(true);
      setError("");

      const token = localStorage.getItem("token");

      const response = await fetch(`${API_URL}/api/admin/users`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json().catch(() => []);

      if (!response.ok) {
        throw new Error(data?.message || "โหลดข้อมูลผู้ใช้ไม่สำเร็จ");
      }

      const userList = Array.isArray(data)
        ? data
        : Array.isArray(data?.users)
          ? data.users
          : [];

      setUsers(userList);
    } catch (err) {
      console.error(err);
      setError(err.message || "ไม่สามารถโหลดข้อมูลผู้ใช้ได้");
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    navigate("/login");
  };

  const counts = useMemo(() => {
    return users.reduce(
      (result, user) => {
        const status = getUserStatus(user);

        result.all += 1;
        result[status] += 1;

        return result;
      },
      {
        all: 0,
        active: 0,
        suspended: 0,
      }
    );
  }, [users]);

  const filteredUsers = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    const result = users.filter((user) => {
      const status = getUserStatus(user);

      const matchesStatus =
        activeTab === "all" || activeTab === status;

      const searchableText = [
        user.firstName,
        user.lastName,
        user.name,
        user.username,
        user.email,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      const matchesSearch =
        !keyword || searchableText.includes(keyword);

      return matchesStatus && matchesSearch;
    });

    return [...result].sort((a, b) => {
      const dateA = new Date(a.createdAt || 0).getTime();
      const dateB = new Date(b.createdAt || 0).getTime();

      return sortOrder === "oldest"
        ? dateA - dateB
        : dateB - dateA;
    });
  }, [users, activeTab, search, sortOrder]);

  const totalPages = Math.max(
    1,
    Math.ceil(filteredUsers.length / ITEMS_PER_PAGE)
  );

  const visibleUsers = filteredUsers.slice(
    (page - 1) * ITEMS_PER_PAGE,
    page * ITEMS_PER_PAGE
  );

  useEffect(() => {
    setPage(1);
  }, [activeTab, search, sortOrder]);

  const handleSuspend = async (user) => {
    const userId = user.id || user._id;
    const status = getUserStatus(user);
    const isSuspended = status === "suspended";

    const confirmed = window.confirm(
      isSuspended
        ? "ต้องการเปิดใช้งานบัญชีนี้อีกครั้งไหม?"
        : "ต้องการระงับบัญชีผู้ใช้นี้ไหม?"
    );

    if (!confirmed) return;

    try {
      const token = localStorage.getItem("token");

      const response = await fetch(
        `${API_URL}/api/admin/users/${userId}/suspend`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            suspended: !isSuspended,
          }),
        }
      );

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          data?.message || "ไม่สามารถเปลี่ยนสถานะบัญชีได้"
        );
      }

      setUsers((currentUsers) =>
        currentUsers.map((currentUser) => {
          const currentId = currentUser.id || currentUser._id;

          if (String(currentId) !== String(userId)) {
            return currentUser;
          }

          return {
            ...currentUser,
            isSuspended: !isSuspended,
            status: !isSuspended ? "suspended" : "active",
          };
        })
      );
    } catch (err) {
      alert(err.message || "เกิดข้อผิดพลาด");
    }
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
          {navItems.map(([label, icon, path, active]) => (
            <button
              type="button"
              key={label}
              className={`admin-nav-item ${
                active ? "active" : ""
              }`}
              onClick={() => navigate(path)}
            >
              <span>{icon}</span>
              <b>{label}</b>
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
        <div className="admin-users-page">
          <header className="users-topbar">
            <div className="users-breadcrumb">
              <button
                type="button"
                onClick={() => navigate("/admin")}
              >
                หน้าหลัก
              </button>

              <span>/</span>
              <strong>ผู้ใช้งาน</strong>
            </div>
          </header>

          <section className="users-heading-card">
            <div className="users-heading-left">
              <span className="users-heading-icon">
                <FiUsers />
              </span>

              <div>
                <h1>จัดการผู้ใช้งาน</h1>
                <p>
                  ตรวจสอบข้อมูลและสถานะบัญชีผู้ใช้งานทั้งหมดในระบบ
                </p>
              </div>
            </div>

            <div className="users-summary-list">
              <div className="users-summary-item">
                <span className="summary-icon total">
                  <FiUsers />
                </span>

                <div>
                  <strong>
                    {counts.all.toLocaleString("th-TH")}
                  </strong>
                  <small>ผู้ใช้ทั้งหมด</small>
                </div>
              </div>

              <div className="users-summary-item">
                <span className="summary-icon active">
                  <FiUserCheck />
                </span>

                <div>
                  <strong>
                    {counts.active.toLocaleString("th-TH")}
                  </strong>
                  <small>ใช้งานปกติ</small>
                </div>
              </div>

              <div className="users-summary-item">
                <span className="summary-icon suspended">
                  <FiUserX />
                </span>

                <div>
                  <strong>
                    {counts.suspended.toLocaleString("th-TH")}
                  </strong>
                  <small>ถูกระงับ</small>
                </div>
              </div>
            </div>
          </section>

          <section className="users-content-card">
            <nav className="users-tabs">
              {[
                ["all", "ทั้งหมด"],
                ["active", "ใช้งานปกติ"],
                ["suspended", "ถูกระงับ"],
              ].map(([key, label]) => (
                <button
                  type="button"
                  key={key}
                  className={activeTab === key ? "active" : ""}
                  onClick={() => setActiveTab(key)}
                >
                  {label}
                  <span>{counts[key]}</span>
                </button>
              ))}
            </nav>

            <div className="users-toolbar">
              <label className="users-search">
                <FiSearch />

                <input
                  type="search"
                  value={search}
                  onChange={(event) =>
                    setSearch(event.target.value)
                  }
                  placeholder="ค้นหาชื่อ อีเมล หรือชื่อผู้ใช้..."
                />
              </label>

              <select
                className="users-sort"
                value={sortOrder}
                onChange={(event) =>
                  setSortOrder(event.target.value)
                }
              >
                <option value="latest">สมัครล่าสุด</option>
                <option value="oldest">สมัครเก่าสุด</option>
              </select>
            </div>

            {loading ? (
              <div className="users-state">
                <span className="users-loader" />
                <strong>กำลังโหลดข้อมูลผู้ใช้งาน</strong>
              </div>
            ) : error ? (
              <div className="users-state">
                <FiUserX />
                <strong>โหลดข้อมูลไม่สำเร็จ</strong>
                <p>{error}</p>

                <button type="button" onClick={loadUsers}>
                  ลองอีกครั้ง
                </button>
              </div>
            ) : visibleUsers.length === 0 ? (
              <div className="users-state">
                <FiUsers />
                <strong>ไม่พบผู้ใช้งาน</strong>
                <p>ไม่มีผู้ใช้ที่ตรงกับตัวกรองหรือคำค้นหา</p>
              </div>
            ) : (
              <div className="users-table-wrapper">
                <table className="users-table">
                  <thead>
                    <tr>
                      <th>ผู้ใช้งาน</th>
                      <th>อีเมล</th>
                      <th>กิจกรรม</th>
                      <th>วันที่สมัคร</th>
                      <th>สถานะ</th>
                      <th>จัดการ</th>
                    </tr>
                  </thead>

                  <tbody>
                    {visibleUsers.map((user) => {
                      const userId = user.id || user._id;
                      const status = getUserStatus(user);

                      const displayName =
                        user.name ||
                        [user.firstName, user.lastName]
                          .filter(Boolean)
                          .join(" ") ||
                        user.username ||
                        "ไม่ระบุชื่อ";

                      const avatar =
                        user.profileImage ||
                        user.avatar ||
                        fallbackAvatar;

                      const activityCount = Number(
                        user.activityCount ||
                        user.activitiesCount ||
                        user.createdActivities?.length ||
                        0
                      );

                      return (
                        <tr key={userId}>
                          <td>
                            <div className="user-profile-cell">
                              <img
                                src={avatar}
                                alt={displayName}
                                onError={(event) => {
                                  event.currentTarget.src =
                                    fallbackAvatar;
                                }}
                              />

                              <div>
                                <strong>{displayName}</strong>
                                <span>
                                  @{user.username || "unknown"}
                                </span>
                              </div>
                            </div>
                          </td>

                          <td>
                            <span className="user-email">
                              <FiMail />
                              {user.email || "-"}
                            </span>
                          </td>

                          <td>
                            <strong className="user-activity-count">
                              {activityCount.toLocaleString("th-TH")}
                            </strong>
                          </td>

                          <td>
                            <span className="user-created-date">
                              {formatDate(user.createdAt)}
                            </span>
                          </td>

                          <td>
                            <span
                              className={`user-status status-${status}`}
                            >
                              {status === "active"
                                ? "ใช้งานปกติ"
                                : "ถูกระงับ"}
                            </span>
                          </td>

                          <td>
                            <div className="user-action-buttons">
                              <button
                                type="button"
                                className="user-view-button"
                                onClick={() =>
                                  navigate(
                                    `/admin/users/${userId}`
                                  )
                                }
                                title="ดูรายละเอียด"
                              >
                                <FiEye />
                              </button>

                              <button
                                type="button"
                                className={`user-status-button ${
                                  status === "suspended"
                                    ? "restore"
                                    : ""
                                }`}
                                onClick={() =>
                                  handleSuspend(user)
                                }
                                title={
                                  status === "suspended"
                                    ? "เปิดใช้งานบัญชี"
                                    : "ระงับบัญชี"
                                }
                              >
                                {status === "suspended" ? (
                                  <FiUserCheck />
                                ) : (
                                  <FiUserX />
                                )}
                              </button>

                              <button
                                type="button"
                                className="user-more-button"
                                title="ตัวเลือกเพิ่มเติม"
                              >
                                <FiMoreVertical />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {!loading &&
              !error &&
              filteredUsers.length > 0 && (
                <footer className="users-pagination">
                  <span>
                    แสดง{" "}
                    {(page - 1) * ITEMS_PER_PAGE + 1}–
                    {Math.min(
                      page * ITEMS_PER_PAGE,
                      filteredUsers.length
                    )}{" "}
                    จาก {filteredUsers.length} รายการ
                  </span>

                  <div>
                    <button
                      type="button"
                      disabled={page === 1}
                      onClick={() =>
                        setPage((current) => current - 1)
                      }
                    >
                      <FiChevronLeft />
                    </button>

                    {Array.from(
                      { length: totalPages },
                      (_, index) => index + 1
                    ).map((pageNumber) => (
                      <button
                        type="button"
                        key={pageNumber}
                        className={
                          page === pageNumber ? "active" : ""
                        }
                        onClick={() => setPage(pageNumber)}
                      >
                        {pageNumber}
                      </button>
                    ))}

                    <button
                      type="button"
                      disabled={page === totalPages}
                      onClick={() =>
                        setPage((current) => current + 1)
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
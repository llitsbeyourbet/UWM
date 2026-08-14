import API_URL from "../config";
import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import "../styles/Search.css"
import { formatDate, formatTime } from "../utils/formatDate";
import { getCategoryIcon } from "../utils/categoryIcons";

function Search() {
  const navigate = useNavigate();

  // Filter State
  const [filters, setFilters] = useState({
    search: "",
    categories: [],
    type: "all",
    dateRange: "all",
    customDates: { start: "", end: "" },
    onlyAvailable: false,
    sortBy: "soonest",
  });

  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);

  const categories = ["กีฬา", "ดนตรี", "ภาพยนตร์", "ท่องเที่ยว", "อาหาร", "ศิลปะ", "เกม", "คาเฟ่"];


  useEffect(() => {
    const fetchActivities = async () => {
      try {
        const res = await fetch(`${API_URL}/api/activities`);
        const data = await res.json();
        setActivities(data);
      } catch (err) {
        console.log(err);
      } finally {
        setLoading(false);
      }
    };
    fetchActivities();
  }, []);

  // Filtering Logic
  const filteredActivities = useMemo(() => {
    let result = activities.filter((item) => {
      // 1. Hide ended activities
      if (item.date) {
        const dateStr = item.date.includes('T') ? item.date.split('T')[0] : item.date;
        const timeStr = item.endTime || item.time || "23:59";

        const [year, month, day] = dateStr.split('-').map(Number);
        const [hours, minutes] = timeStr.split(':').map(Number);

        if (!isNaN(year)) {
          const endDateTime = new Date(year, month - 1, day, hours || 0, minutes || 0);
          if (endDateTime < new Date()) return false;
        }
      }

      // 2. Status suspended
      if (item.status === "suspended") return false;

      // ... rest of filters


      // 3. Keyword search
      if (filters.search && !item.activityName.toLowerCase().includes(filters.search.toLowerCase())) {
        return false;
      }

      // 4. Categories filter
      if (filters.categories.length > 0) {
        const itemCats = Array.isArray(item.category) ? item.category : String(item.category || "").split(",").map(c => c.trim());
        if (!filters.categories.some(cat => itemCats.includes(cat))) return false;
      }

      // 5. Type filter (Public/Private)
      if (filters.type !== "all" && item.activityType !== filters.type) {
        return false;
      }

      // 6. Date range filter
      if (filters.dateRange !== "all") {
        const eventDate = new Date(item.date);
        eventDate.setHours(0, 0, 0, 0);
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        if (filters.dateRange === "today") {
          if (eventDate.getTime() !== today.getTime()) return false;
        } else if (filters.dateRange === "week") {
          const nextWeek = new Date(today);
          nextWeek.setDate(today.getDate() + 7);
          if (eventDate < today || eventDate > nextWeek) return false;
        } else if (filters.dateRange === "month") {
          const nextMonth = new Date(today);
          nextMonth.setDate(today.getDate() + 30);
          if (eventDate < today || eventDate > nextMonth) return false;
        } else if (filters.dateRange === "custom") {
          if (filters.customDates.start || filters.customDates.end) {
            const start = filters.customDates.start ? new Date(filters.customDates.start) : new Date(-8640000000000000);
            const end = filters.customDates.end ? new Date(filters.customDates.end) : new Date(8640000000000000);
            if (eventDate < start || eventDate > end) return false;
          }
        }
      }

      // 7. Only available slots
      if (filters.onlyAvailable) {
        const joined = item.joinedCount || 0;
        if (joined >= item.participantCount) return false;
      }

      return true;
    });

    // Sorting Logic
    return result.sort((a, b) => {
      if (filters.sortBy === "soonest") {
        const datePartA = a.date?.includes('T') ? a.date.split('T')[0] : a.date;
        const datePartB = b.date?.includes('T') ? b.date.split('T')[0] : b.date;

        const [yA, mA, dA] = (datePartA || "").split('-').map(Number);
        const [hA, minA] = (a.endTime || a.time || "00:00").split(':').map(Number);
        const dateA = new Date(yA, mA - 1, dA, hA || 0, minA || 0);

        const [yB, mB, dB] = (datePartB || "").split('-').map(Number);
        const [hB, minB] = (b.endTime || b.time || "00:00").split(':').map(Number);
        const dateB = new Date(yB, mB - 1, dB, hB || 0, minB || 0);

        return dateA - dateB;
      } else if (filters.sortBy === "newest") {
        return new Date(b.createdAt) - new Date(a.createdAt);
      } else if (filters.sortBy === "rating") {
        const ratingA = a.avgRating || 0;
        const ratingB = b.avgRating || 0;
        return ratingB - ratingA;
      }
      return 0;
    });
  }, [activities, filters]);

  const handleViewDetail = (activity) => {
    navigate(`/activity-detail?id=${activity.id}`);
  };

  const toggleCategory = (cat) => {
    setFilters(prev => {
      const current = prev.categories;
      const next = current.includes(cat)
        ? current.filter(c => c !== cat)
        : [...current, cat];
      return { ...prev, categories: next };
    });
  };

  const clearFilters = () => {
    setFilters(prev => ({
      ...prev,
      categories: [],
      type: "all",
      dateRange: "all",
      customDates: { start: "", end: "" },
      onlyAvailable: false,
      sortBy: "soonest",
    }));
  };

  const renderBadges = (item) => {
    const badges = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const eventDate = new Date(item.date);
    eventDate.setHours(0, 0, 0, 0);

    const diffDays = Math.round((eventDate - today) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) badges.push({ text: "เริ่มวันนี้", type: "today" });
    else if (diffDays === 1) badges.push({ text: "เริ่มพรุ่งนี้", type: "tomorrow" });

    const joined = item.joinedCount || 0;
    const slotsLeft = item.participantCount - joined;
    if (slotsLeft > 0 && slotsLeft < 5) {
      badges.push({ text: `เหลือ ${slotsLeft} ที่`, type: "slots" });
    }

    return badges.map((b, i) => (
      <span key={i} className={`activity-badge badge-${b.type}`}>{b.text}</span>
    ));
  };

  const renderEmptyState = () => {
    const isSearchActive = filters.search !== "";
    const isFilterActive = filters.categories.length > 0 || filters.type !== "all" || filters.dateRange !== "all" || filters.onlyAvailable;

    if (isSearchActive || isFilterActive) {
      return (
        <div className="empty-state">
          <div className="empty-icon">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#ccc" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </div>
          <p className="empty-title">ไม่พบกิจกรรมที่ค้นหา</p>
        </div>
      );
    }

    return (
      <div className="empty-state">
        <p className="empty-text">ยังไม่มีกิจกรรมที่กำลังจะมาถึง</p>
        <button className="create-activity-btn" onClick={() => navigate("/CreateActivities")}>
          สร้างกิจกรรมเลย!
        </button>
      </div>
    );
  };

  return (
    <div className="search-page">
      {/* Search Header */}
      <div className="search-header">
        <div className="search-bar-container">
          <div className="search-input-box">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#aaa" strokeWidth="2" strokeLinecap="round">
              <circle cx="11" cy="11" r="8"/>
              <line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input
              type="text"
              placeholder="ค้นหากิจกรรม..."
              value={filters.search}
              onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
            />
          </div>
          <button className="filter-trigger-btn" onClick={() => setIsFilterOpen(true)}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#111" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="4" y1="21" x2="4" y2="14"></line>
              <line x1="4" y1="10" x2="4" y2="3"></line>
              <line x1="12" y1="21" x2="12" y2="12"></line>
              <line x1="12" y1="8" x2="12" y2="3"></line>
              <line x1="20" y1="21" x2="20" y2="16"></line>
              <line x1="20" y1="12" x2="20" y2="3"></line>
              <line x1="1" y1="14" x2="7" y2="14"></line>
              <line x1="1" y1="8" x2="7" y2="8"></line>
              <line x1="1" y1="3" x2="7" y2="3"></line>
            </svg>
            <span className="filter-text">ตัวกรอง</span>
          </button>
        </div>

        {/* Active Filter Chips */}
        <div className="active-filters-container">
          {(filters.categories.length > 0 || filters.type !== "all" || filters.dateRange !== "all" || filters.onlyAvailable) && (
            <div className="filters-row">
              <div className="chips-container">
                {filters.categories.map(cat => (
                  <div key={cat} className="filter-chip">
                    {getCategoryIcon(cat)} {cat}
                    <span className="remove-chip" onClick={() => toggleCategory(cat)}>×</span>
                  </div>
                ))}
                {filters.type !== "all" && (
                  <div className="filter-chip">
                    {filters.type === "public" ? "สาธารณะ" : "ส่วนตัว"}
                    <span className="remove-chip" onClick={() => setFilters(prev => ({ ...prev, type: "all" }))}>×</span>
                  </div>
                )}
                {filters.dateRange !== "all" && (
                  <div className="filter-chip">
                    {filters.dateRange === "today" ? "วันนี้" : filters.dateRange === "week" ? "สัปดาห์นี้" : filters.dateRange === "month" ? "เดือนนี้" : "ช่วงวันที่"}
                    <span className="remove-chip" onClick={() => setFilters(prev => ({ ...prev, dateRange: "all" }))}>×</span>
                  </div>
                )}
                {filters.onlyAvailable && (
                  <div className="filter-chip">
                    ยังมีที่ว่าง
                    <span className="remove-chip" onClick={() => setFilters(prev => ({ ...prev, onlyAvailable: false }))}>×</span>
                  </div>
                )}
              </div>
              <button className="clear-filter-btn" onClick={clearFilters}>ล้างตัวกรอง</button>
            </div>
          )}
        </div>
      </div>

      {/* Activities List */}
      <div className="activity-list">
        {loading ? (
          <p className="empty-text">กำลังโหลด...</p>
        ) : filteredActivities.length === 0 ? renderEmptyState() : (
          filteredActivities.map((item) => (
            <div key={item.id} className="activity-card" onClick={() => handleViewDetail(item)}>
              <div className="card-cover-wrap">
                {item.cover ? (
                  <img
                    src={item.cover.startsWith("http") ? item.cover : `${API_URL}/uploads/${item.cover}`}
                    alt="cover"
                    className="card-cover"
                  />
                ) : (
                  <div className="card-cover-placeholder" />
                )}
                <div className="card-badges">
                  {renderBadges(item)}
                </div>
              </div>
              <div className="card-body">
                <p className="card-title">{item.activityName}</p>
                <p className="card-info">📍 {item.location || "-"} &nbsp;·&nbsp; 👥 {item.joinedCount || 0}/{item.participantCount} คน</p>
                <p className="card-date">{formatDate(item.date)} ·  {formatTime(item.time)} - {formatTime(item.endTime)}</p>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Filter Bottom Sheet */}
      {isFilterOpen && (
        <>
          <div className="bottom-sheet-overlay" onClick={() => setIsFilterOpen(false)} />
          <div className="bottom-sheet">
            <div className="bottom-sheet-handle" />
            <div className="bottom-sheet-content">
              <div className="bottom-sheet-header">
                <h3 className="sheet-title">ตัวกรอง</h3>
                <button className="close-sheet-btn" onClick={() => setIsFilterOpen(false)}>×</button>
              </div>

              <div className="filter-sections">
                {/* Categories */}
                <div className="filter-section">
                  <label className="filter-label">หมวดหมู่</label>
                  <div className="filter-options-grid">
                    {categories.map(cat => (
                      <div
                        key={cat}
                        className={`filter-option-pill ${filters.categories.includes(cat) ? "active" : ""}`}
                        onClick={() => toggleCategory(cat)}
                      >
                        {getCategoryIcon(cat)} {cat}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Activity Type */}
                <div className="filter-section">
                  <label className="filter-label">ประเภทกิจกรรม</label>
                  <div className="filter-options-row">
                    {["all", "public", "private"].map(type => (
                      <div
                        key={type}
                        className={`filter-option-pill ${filters.type === type ? "active" : ""}`}
                        onClick={() => setFilters(prev => ({ ...prev, type }))}
                      >
                        {type === "all" ? "ทั้งหมด" : type === "public" ? "สาธารณะ" : "ส่วนตัว"}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Date Range */}
                <div className="filter-section">
                  <label className="filter-label">ช่วงเวลา</label>
                  <div className="filter-options-row">
                    {["all", "today", "week", "month", "custom"].map(range => (
                      <div
                        key={range}
                        className={`filter-option-pill ${filters.dateRange === range ? "active" : ""}`}
                        onClick={() => setFilters(prev => ({ ...prev, dateRange: range }))}
                      >
                        {range === "all" ? "ทั้งหมด" : range === "today" ? "วันนี้" : range === "week" ? "สัปดาห์นี้" : range === "month" ? "เดือนนี้" : "กำหนดเอง"}
                      </div>
                    ))}
                  </div>
                  {filters.dateRange === "custom" && (
                    <div className="custom-date-inputs">
                      <input
                        type="date"
                        value={filters.customDates.start}
                        onChange={(e) => setFilters(prev => ({ ...prev, customDates: { ...prev.customDates, start: e.target.value } }))}
                      />
                      <span className="date-sep">ถึง</span>
                      <input
                        type="date"
                        value={filters.customDates.end}
                        onChange={(e) => setFilters(prev => ({ ...prev, customDates: { ...prev.customDates, end: e.target.value } }))}
                      />
                    </div>
                  )}
                </div>

                {/* Availability */}
                <div className="filter-section">
                  <label className="filter-label">สถานะที่ว่าง</label>
                  <div className="filter-toggle-row">
                    <span className="toggle-text">แสดงเฉพาะกิจกรรมที่ยังมีที่ว่าง</span>
                    <input
                      type="checkbox"
                      className="filter-checkbox"
                      checked={filters.onlyAvailable}
                      onChange={(e) => setFilters(prev => ({ ...prev, onlyAvailable: e.target.checked }))}
                    />
                  </div>
                </div>

                {/* Sorting */}
                <div className="filter-section">
                  <label className="filter-label">เรียงลำดับ</label>
                  <div className="filter-options-row">
                    {["soonest", "newest", "rating"].map(sort => (
                      <div
                        key={sort}
                        className={`filter-option-pill ${filters.sortBy === sort ? "active" : ""}`}
                        onClick={() => setFilters(prev => ({ ...prev, sortBy: sort }))}
                      >
                        {sort === "soonest" ? "ใกล้เริ่มที่สุด" : sort === "newest" ? "ล่าสุด" : "คะแนนสูงสุด"}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="bottom-sheet-footer">
                <button className="btn-clear-all" onClick={clearFilters}>ล้างตัวกรอง</button>
                <button className="btn-apply-filters" onClick={() => setIsFilterOpen(false)}>นำไปใช้</button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default Search;

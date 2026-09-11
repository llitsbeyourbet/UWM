import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import "../styles/Home.css";
import API_URL from "../config";
import { formatDate, formatTime } from "../utils/formatDate";
import { getCategoryIcon } from "../utils/categoryIcons";

function Home() {
  const navigate = useNavigate();

  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const [activeCategory, setActiveCategory] = useState("ทั้งหมด");

  const [username, setUsername] = useState("");

  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);


  const categories = [
    "ทั้งหมด",
    "กีฬา",
    "ดนตรี",
    "ภาพยนตร์",
    "ท่องเที่ยว",
    "อาหาร",
    "ศิลปะ",
    "เกม",
    "คาเฟ่",
    "เรียน",
    "สุขภาพ",
    "จิตอาสา",
  ];


  // ==================================================
  // โหลดข้อมูล User
  // ==================================================
  useEffect(() => {

    const fetchUser = async () => {

      const token =
        sessionStorage.getItem("token");


      if (!token) return;


      try {

        const res = await fetch(
          `${API_URL}/api/auth/me`,
          {
            headers: {
              Authorization:
                `Bearer ${token}`,
            },
          }
        );


        if (!res.ok) {
          return;
        }


        const data =
          await res.json();


        setUsername(
          data.username || ""
        );

      } catch (err) {

        console.log(err);
      }
    };


    fetchUser();

  }, []);


  // ==================================================
  // โหลดกิจกรรม
  // โหลดใหม่เมื่อเปลี่ยน category
  // ==================================================
  useEffect(() => {

    let cancelled = false;


    const fetchActivities =
      async () => {

        setLoading(true);


        try {

          const params =
            new URLSearchParams({
              page: "1",
              limit: "12",
              category:
                activeCategory,
            });


          const res =
            await fetch(
              `${API_URL}/api/activities/home?${params.toString()}`
            );


          if (!res.ok) {

            throw new Error(
              "โหลดกิจกรรมไม่สำเร็จ"
            );
          }


          const data =
            await res.json();


          if (cancelled) {
            return;
          }


          setActivities(
            Array.isArray(
              data.activities
            )
              ? data.activities
              : []
          );


          setPage(1);

          setHasMore(
            Boolean(data.hasMore)
          );

        } catch (err) {

          console.log(err);


          if (!cancelled) {

            setActivities([]);

            setHasMore(false);
          }

        } finally {

          if (!cancelled) {
            setLoading(false);
          }
        }
      };


    fetchActivities();


    return () => {
      cancelled = true;
    };

  }, [activeCategory]);


  // ==================================================
  // โหลดกิจกรรมเพิ่ม
  // ==================================================
  const handleLoadMore =
    async () => {

      if (
        loadingMore ||
        !hasMore
      ) {
        return;
      }


      const nextPage =
        page + 1;


      setLoadingMore(true);


      try {

        const params =
          new URLSearchParams({
            page:
              String(nextPage),

            limit:
              "12",

            category:
              activeCategory,
          });


        const res =
          await fetch(
            `${API_URL}/api/activities/home?${params.toString()}`
          );


        if (!res.ok) {

          throw new Error(
            "โหลดกิจกรรมเพิ่มเติมไม่สำเร็จ"
          );
        }


        const data =
          await res.json();


        const nextActivities =
          Array.isArray(
            data.activities
          )
            ? data.activities
            : [];


        setActivities(
          (prev) => {

            const existingIds =
              new Set(
                prev.map(
                  (item) =>
                    item.id
                )
              );


            const uniqueNext =
              nextActivities.filter(
                (item) =>
                  !existingIds.has(
                    item.id
                  )
              );


            return [
              ...prev,
              ...uniqueNext,
            ];
          }
        );


        setPage(nextPage);


        setHasMore(
          Boolean(
            data.hasMore
          )
        );

      } catch (err) {

        console.log(err);

      } finally {

        setLoadingMore(false);
      }
    };


  const handleViewDetail =
    (activity) => {

      navigate(
        `/activity-detail?id=${activity.id}`
      );
    };


  return (
    <div className="home">

      {/* Header */}
      <div className="home-header">

        <div>

          <p className="home-greeting">
            สวัสดี 👋
          </p>

          <p className="home-username">
            @{username}
          </p>

        </div>


        <div className="home-icons">

          {/* สแกน QR */}
          <div
            className="icon-btn"
            onClick={() =>
              navigate("/scan")
            }
          >

            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#010101"
              strokeWidth="2"
              strokeLinecap="round"
            >

              <path d="M3 7V3h4" />
              <path d="M21 7V3h-4" />
              <path d="M3 17v4h4" />
              <path d="M21 17v4h-4" />

              <line
                x1="8"
                y1="12"
                x2="16"
                y2="12"
              />

            </svg>

          </div>

        </div>

      </div>


      {/* Title */}
      <div className="home-title">

        <h1>
          Discover,
          <br />
          Create,{" "}
          <em>Enjoy</em>
        </h1>

        <p>
          หากิจกรรมสนุก ๆ กับเพื่อนใหม่
        </p>

      </div>


      {/* Categories */}
      <div className="category-scroll">

        {categories.map(
          (cat) => (

            <div
              key={cat}

              className={`category-pill ${
                activeCategory === cat
                  ? "active"
                  : ""
              }`}

              onClick={() =>
                setActiveCategory(cat)
              }
            >

              {cat === "ทั้งหมด"
                ? "🌟"
                : getCategoryIcon(cat)}

              {" "}
              {cat}

            </div>
          )
        )}

      </div>


      {/* Cards */}
      <div className="home-cards">

        {loading ? (

          <p className="loading-text">
            กำลังโหลด...
          </p>

        ) : activities.length === 0 ? (

          <p className="empty-text">
            ไม่พบกิจกรรม
          </p>

        ) : (

          activities.map(
            (item) => (

              <div
                key={item.id}

                className="home-card"

                onClick={() =>
                  handleViewDetail(
                    item
                  )
                }
              >

                {/* รูปภาพ */}
                <div className="card-image-wrap">

                  {item.cover ? (

                    <img
                      src={item.cover}
                      alt="cover"
                      className="card-image"

                      loading="lazy"

                      decoding="async"
                    />

                  ) : (

                    <div className="card-image-placeholder">
                      🎉
                    </div>

                  )}


                  <span
                    className={`card-tag ${
                      item.activityType ===
                      "public"
                        ? "tag-public"
                        : "tag-private"
                    }`}
                  >

                    {item.activityType ===
                    "public"
                      ? "สาธารณะ"
                      : "ส่วนตัว"}

                  </span>

                </div>


                {/* เนื้อหา */}
                <div className="card-content">

                  <div className="card-content-top">

                    <p className="card-name">
                      {item.activityName}
                    </p>

                  </div>


                  <p className="card-meta">
                    📍{" "}
                    {item.location || "-"}
                  </p>


                  <p className="card-meta">

                    📅{" "}

                    {formatDate(
                      item.date
                    )}

                  </p>


                  <p className="card-meta">

                    ⏰{" "}

                    {formatTime(
                      item.time
                    )}

                    {" - "}

                    {formatTime(
                      item.endTime
                    )}

                  </p>


                  <p className="card-meta">

                    👥{" "}

                    {item.joinedCount ??
                      0}

                    {" / "}

                    {item.participantCount}

                    {" คน"}

                  </p>


                  {/* Category */}
                  <div className="card-tags">

                    {(Array.isArray(
                      item.category
                    )
                      ? item.category

                      : String(
                          item.category ||
                            ""
                        )
                          .split(",")
                          .map(
                            (c) =>
                              c.trim()
                          )
                          .filter(
                            Boolean
                          )
                    ).map(
                      (cat) => (

                        <span
                          className="card-tag-chip"
                          key={cat}
                        >

                          {getCategoryIcon(
                            cat
                          )}

                          {" "}
                          {cat}

                        </span>
                      )
                    )}

                  </div>


                  <div className="card-bottom">

                    <div
                      className={`card-days-badge ${(() => {

                        if (!item.date) {
                          return "";
                        }


                        const now =
                          new Date();


                        const startDateTime =
                          new Date(
                            `${item.date}T${
                              item.time ||
                              "00:00"
                            }`
                          );


                        const endDateTime =
                          new Date(
                            `${item.date}T${
                              item.endTime ||
                              item.time ||
                              "23:59"
                            }`
                          );


                        // กำลังดำเนินกิจกรรม
                        if (
                          now >=
                            startDateTime &&
                          now <
                            endDateTime
                        ) {

                          return "ongoing";
                        }


                        const today =
                          new Date();

                        today.setHours(
                          0,
                          0,
                          0,
                          0
                        );


                        const eventDate =
                          new Date(
                            item.date
                          );

                        eventDate.setHours(
                          0,
                          0,
                          0,
                          0
                        );


                        const diff =
                          Math.round(
                            (
                              eventDate -
                              today
                            ) /
                              (
                                1000 *
                                60 *
                                60 *
                                24
                              )
                          );


                        // วันนี้
                        if (
                          diff === 0 &&
                          now <
                            startDateTime
                        ) {

                          return "today";
                        }


                        return "upcoming";

                      })()}`}
                    >

                      {(() => {

                        if (!item.date) {
                          return "-";
                        }


                        const now =
                          new Date();


                        const startDateTime =
                          new Date(
                            `${item.date}T${
                              item.time ||
                              "00:00"
                            }`
                          );


                        const endDateTime =
                          new Date(
                            `${item.date}T${
                              item.endTime ||
                              item.time ||
                              "23:59"
                            }`
                          );


                        // กำลังดำเนินกิจกรรม
                        if (
                          now >=
                            startDateTime &&
                          now <
                            endDateTime
                        ) {

                          return "กำลังดำเนินกิจกรรม";
                        }


                        const today =
                          new Date();

                        today.setHours(
                          0,
                          0,
                          0,
                          0
                        );


                        const eventDate =
                          new Date(
                            item.date
                          );

                        eventDate.setHours(
                          0,
                          0,
                          0,
                          0
                        );


                        const diff =
                          Math.round(
                            (
                              eventDate -
                              today
                            ) /
                              (
                                1000 *
                                60 *
                                60 *
                                24
                              )
                          );


                        // วันนี้
                        if (
                          diff === 0 &&
                          now <
                            startDateTime
                        ) {

                          return "วันนี้";
                        }


                        return `อีก ${diff} วัน`;

                      })()}

                    </div>


                    <div className="card-btn">
                      ดูรายละเอียด →
                    </div>

                  </div>

                </div>

              </div>
            )
          )
        )}

      </div>


      {/* โหลดเพิ่ม */}
      {!loading && hasMore && (

        <div
          style={{
            display: "flex",
            justifyContent:
              "center",
            padding:
              "12px 0 24px",
          }}
        >

          <button
            type="button"

            onClick={
              handleLoadMore
            }

            disabled={
              loadingMore
            }

            style={{
              border: "none",
              borderRadius:
                "999px",
              padding:
                "10px 22px",
              cursor:
                loadingMore
                  ? "default"
                  : "pointer",
              fontWeight: 600,
            }}
          >

            {loadingMore
              ? "กำลังโหลด..."
              : "โหลดกิจกรรมเพิ่มเติม"}

          </button>

        </div>
      )}

    </div>
  );
}

export default Home;
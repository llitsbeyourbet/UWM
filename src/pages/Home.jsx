import "./Home.css";


function Home() {
  const activities = [
    {
      id: 1,
      title: "แข่งขันแบดมินตัน",
      desc: "หาคนตีแบดช่วงเย็นที่สนามมหาลัย",
    },
    {
      id: 2,
      title: "อ่านหนังสือสอบ",
      desc: "ชวนอ่านหนังสือที่ห้องสมุด",
    },
    {
      id: 3,
      title: "วิ่งสวนสาธารณะ",
      desc: "หาคนวิ่งออกกำลังกายตอนเช้า",
    },
  ];

  return (
    <div className="home">
      <div className="welcome-box">
        <h1>Welcome to Until We Meet</h1>
        <p>ค้นหาและเข้าร่วมกิจกรรมกับเพื่อนใหม่ได้ง่าย ๆ</p>
      </div>

      <h2 className="section-title">กิจกรรมแนะนำ</h2>

      <div className="card-container">
        {activities.map((item) => (
          <div key={item.id} className="activity-card">
            <h3>{item.title}</h3>
            <p>{item.desc}</p>
            <button>ดูรายละเอียด</button>
          </div>
        ))}
      </div>
    </div>
  );
}

export default Home;

import "../styles/Loading.css";

export default function Loading({ text = "กำลังโหลดข้อมูล..." }) {
  return (
    <div className="uwm-loading">
      <div className="uwm-loading-spinner"></div>
      <p>{text}</p>
    </div>
  );
}
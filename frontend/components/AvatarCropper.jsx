import { useRef, useState } from "react";
import "./AvatarCropper.css";

const VP = 260;   // ขนาดกรอบครอป (px)
const OUT = 400;  // ขนาดรูปผลลัพธ์ (px)

/**
 * หน้าต่างปรับ/ครอปรูปโปรไฟล์แบบวงกลม
 * - ลากเพื่อเลื่อนตำแหน่ง (เมาส์ + ทัช)
 * - ซูมด้วยสไลเดอร์ / ลูกกลิ้งเมาส์ / นิ้วบีบ (pinch)
 * onConfirm(blob) ส่ง Blob รูป jpeg ที่ครอปแล้วกลับไป
 */
export default function AvatarCropper({ imageSrc, onCancel, onConfirm }) {
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(false);

  const natRef = useRef({ w: 0, h: 0 });
  const baseRef = useRef({ w: VP, h: VP });
  const zoomRef = useRef(1);
  const imgRef = useRef(null);
  const pointersRef = useRef(new Map());
  const lastPanRef = useRef(null);
  const pinchRef = useRef(null);

  const clampOffset = (o, z) => {
    const maxX = Math.max(0, (baseRef.current.w * z - VP) / 2);
    const maxY = Math.max(0, (baseRef.current.h * z - VP) / 2);
    return {
      x: Math.min(maxX, Math.max(-maxX, o.x)),
      y: Math.min(maxY, Math.max(-maxY, o.y)),
    };
  };

  const applyZoom = (z) => {
    z = Math.min(3, Math.max(1, z));
    zoomRef.current = z;
    setZoom(z);
    setOffset((o) => clampOffset(o, z));
  };

  const onImgLoad = (e) => {
    const w = e.target.naturalWidth;
    const h = e.target.naturalHeight;
    natRef.current = { w, h };
    const ratio = w / h;
    // scale ให้รูป "cover" กรอบสี่เหลี่ยมที่ zoom = 1
    baseRef.current = ratio > 1 ? { w: VP * ratio, h: VP } : { w: VP, h: VP / ratio };
    setOffset({ x: 0, y: 0 });
    applyZoom(1);
    setReady(true);
  };

  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

  const onPointerDown = (e) => {
    e.currentTarget.setPointerCapture?.(e.pointerId);
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const pts = [...pointersRef.current.values()];
    if (pts.length === 1) lastPanRef.current = pts[0];
    else if (pts.length === 2) pinchRef.current = { d: dist(pts[0], pts[1]), z: zoomRef.current };
  };

  const onPointerMove = (e) => {
    if (!pointersRef.current.has(e.pointerId)) return;
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const pts = [...pointersRef.current.values()];
    if (pts.length >= 2 && pinchRef.current) {
      applyZoom(pinchRef.current.z * (dist(pts[0], pts[1]) / pinchRef.current.d));
    } else if (pts.length === 1 && lastPanRef.current) {
      const p = pts[0];
      const dx = p.x - lastPanRef.current.x;
      const dy = p.y - lastPanRef.current.y;
      lastPanRef.current = p;
      setOffset((o) => clampOffset({ x: o.x + dx, y: o.y + dy }, zoomRef.current));
    }
  };

  const endPointer = (e) => {
    pointersRef.current.delete(e.pointerId);
    const pts = [...pointersRef.current.values()];
    if (pts.length === 1) {
      lastPanRef.current = pts[0];
      pinchRef.current = null;
    } else if (pts.length === 0) {
      lastPanRef.current = null;
      pinchRef.current = null;
    }
  };

  const onWheel = (e) => {
    e.preventDefault();
    applyZoom(zoomRef.current - e.deltaY * 0.0015);
  };

  const handleConfirm = () => {
    const img = imgRef.current;
    if (!img || !natRef.current.w) return;
    const z = zoomRef.current;
    const dispScale = (baseRef.current.w * z) / natRef.current.w; // px แสดงผล / px จริง
    const sx = ((baseRef.current.w * z) / 2 - VP / 2 - offset.x) / dispScale;
    const sy = ((baseRef.current.h * z) / 2 - VP / 2 - offset.y) / dispScale;
    const sSize = VP / dispScale;

    const canvas = document.createElement("canvas");
    canvas.width = OUT;
    canvas.height = OUT;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(img, sx, sy, sSize, sSize, 0, 0, OUT, OUT);

    setLoading(true);
    canvas.toBlob(
      (blob) => {
        if (blob) onConfirm(blob);
        else setLoading(false);
      },
      "image/jpeg",
      0.9
    );
  };

  return (
    <div className="cropper-backdrop" onClick={loading ? undefined : onCancel}>
      <div className="cropper-modal" onClick={(e) => e.stopPropagation()}>
        <p className="cropper-title">ปรับรูปโปรไฟล์</p>
        <p className="cropper-hint">ลากเพื่อเลื่อน • ซูมด้วยแถบด้านล่าง</p>

        <div
          className="cropper-viewport"
          style={{ width: VP, height: VP }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endPointer}
          onPointerCancel={endPointer}
          onWheel={onWheel}
        >
          <img
            ref={imgRef}
            src={imageSrc}
            alt="ครอปรูป"
            className="cropper-img"
            draggable={false}
            onLoad={onImgLoad}
            style={{
              width: baseRef.current.w * zoom,
              height: baseRef.current.h * zoom,
              transform: `translate(-50%, -50%) translate(${offset.x}px, ${offset.y}px)`,
              visibility: ready ? "visible" : "hidden",
            }}
          />
          <div className="cropper-ring" />
        </div>

        <input
          type="range"
          min="1"
          max="3"
          step="0.01"
          value={zoom}
          onChange={(e) => applyZoom(parseFloat(e.target.value))}
          className="cropper-slider"
          disabled={loading}
        />

        <div className="cropper-actions">
          <button className="cropper-btn cancel" onClick={onCancel} disabled={loading}>
            ยกเลิก
          </button>
          <button className="cropper-btn confirm" onClick={handleConfirm} disabled={loading || !ready}>
            {loading ? "กำลังบันทึก..." : "ใช้รูปนี้"}
          </button>
        </div>
      </div>
    </div>
  );
}

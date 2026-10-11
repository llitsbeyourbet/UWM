import { useEffect, useMemo, useRef, useState } from "react";
import "../styles/ImageCropModal.css";

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function ImageCropModal({
  src,
  aspect = 16 / 9,
  outputWidth = 1600,
  outputHeight = 900,
  fileName = "cropped.jpg",
  onCancel,
  onConfirm,
}) {
  const frameRef = useRef(null);
  const fileInputRef = useRef(null);
  const dragRef = useRef(null);
  const pointersRef = useRef(new Map());
  const gestureRef = useRef(null);
  const localUrlRef = useRef(null);

  const [currentSrc, setCurrentSrc] = useState(src);
  const [currentFileName, setCurrentFileName] = useState(fileName);
  const [natural, setNatural] = useState({ width: 0, height: 0 });
  const [frame, setFrame] = useState({ width: 0, height: 0 });
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const zoomRef = useRef(zoom);
  const offsetRef = useRef(offset);
  const [saving, setSaving] = useState(false);
  const [dragging, setDragging] = useState(false);

  zoomRef.current = zoom;
  offsetRef.current = offset;

  const isProfileCrop = Math.abs(aspect - 1) < 0.01;

  useEffect(() => {
    setCurrentSrc(src);
    setCurrentFileName(fileName);
    setZoom(1);
    setOffset({ x: 0, y: 0 });
    setNatural({ width: 0, height: 0 });
    pointersRef.current.clear();
    gestureRef.current = null;
  }, [src, fileName]);

  useEffect(() => {
    const updateFrame = () => {
      if (!frameRef.current) return;

      setFrame({
        width: frameRef.current.clientWidth,
        height: frameRef.current.clientHeight,
      });
    };

    updateFrame();
    window.addEventListener("resize", updateFrame);

    return () => {
      window.removeEventListener("resize", updateFrame);
    };
  }, []);

  useEffect(() => {
    return () => {
      if (localUrlRef.current) {
        URL.revokeObjectURL(localUrlRef.current);
      }
    };
  }, []);

  const metrics = useMemo(() => {
    if (
      !natural.width ||
      !natural.height ||
      !frame.width ||
      !frame.height
    ) {
      return null;
    }

    const baseScale = Math.max(
      frame.width / natural.width,
      frame.height / natural.height
    );

    const scale = baseScale * zoom;
    const displayWidth = natural.width * scale;
    const displayHeight = natural.height * scale;

    return {
      scale,
      displayWidth,
      displayHeight,
      maxX: Math.max(0, (displayWidth - frame.width) / 2),
      maxY: Math.max(0, (displayHeight - frame.height) / 2),
    };
  }, [natural, frame, zoom]);

  useEffect(() => {
    if (!metrics) return;

    setOffset((prev) => ({
      x: clamp(prev.x, -metrics.maxX, metrics.maxX),
      y: clamp(prev.y, -metrics.maxY, metrics.maxY),
    }));
  }, [metrics?.maxX, metrics?.maxY]);

  const getBounds = (nextZoom) => {
    if (!natural.width || !natural.height || !frame.width || !frame.height) return null;
    const baseScale = Math.max(frame.width / natural.width, frame.height / natural.height);
    return {
      x: Math.max(0, (natural.width * baseScale * nextZoom - frame.width) / 2),
      y: Math.max(0, (natural.height * baseScale * nextZoom - frame.height) / 2),
    };
  };

  const setPosition = (nextZoom, x, y) => {
    const z = clamp(nextZoom, 1, 3);
    const bounds = getBounds(z);
    if (!bounds) return;
    const nextOffset = {
      x: clamp(x, -bounds.x, bounds.x),
      y: clamp(y, -bounds.y, bounds.y),
    };
    zoomRef.current = z;
    offsetRef.current = nextOffset;
    setZoom(z);
    setOffset(nextOffset);
  };

  const getPair = () => Array.from(pointersRef.current.values()).slice(0, 2);
  const getDistance = (a, b) => Math.hypot(b.x - a.x, b.y - a.y);
  const getMidpoint = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });

  const startDrag = (e) => {
    if (!metrics || e.target.closest("button")) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture?.(e.pointerId);
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const points = getPair();
    if (points.length === 2) {
      const [a, b] = points;
      gestureRef.current = {
        kind: "pinch",
        distance: Math.max(1, getDistance(a, b)),
        midpoint: getMidpoint(a, b),
        zoom: zoomRef.current,
        offset: { ...offsetRef.current },
      };
    } else if (points.length === 1) {
      gestureRef.current = {
        kind: "drag", start: points[0], offset: { ...offsetRef.current },
      };
    }
    setDragging(true);
  };

  const moveDrag = (e) => {
    if (!pointersRef.current.has(e.pointerId)) return;
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const points = getPair();
    const gesture = gestureRef.current;
    if (!gesture) return;

    if (points.length === 2 && gesture.kind === "pinch") {
      const [a, b] = points;
      const midpoint = getMidpoint(a, b);
      const nextZoom = clamp(gesture.zoom * getDistance(a, b) / gesture.distance, 1, 3);
      const ratio = nextZoom / gesture.zoom;
      const rect = frameRef.current.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      // Keep the image point beneath the fingers anchored while zooming.
      const x = midpoint.x - centerX - (gesture.midpoint.x - centerX - gesture.offset.x) * ratio;
      const y = midpoint.y - centerY - (gesture.midpoint.y - centerY - gesture.offset.y) * ratio;
      setPosition(nextZoom, x, y);
    } else if (points.length === 1 && gesture.kind === "drag") {
      setPosition(zoomRef.current,
        gesture.offset.x + points[0].x - gesture.start.x,
        gesture.offset.y + points[0].y - gesture.start.y);
    }
  };

  const endDrag = (e) => {
    pointersRef.current.delete(e.pointerId);
    const points = getPair();
    if (points.length === 1) {
      gestureRef.current = { kind: "drag", start: points[0], offset: { ...offsetRef.current } };
    } else if (points.length === 0) {
      gestureRef.current = null;
      setDragging(false);
    }
  };

  const changeZoom = (nextZoom) => {
    setPosition(nextZoom, offsetRef.current.x, offsetRef.current.y);
  };

  const handleWheel = (e) => {
    e.preventDefault();

    changeZoom(
      zoom + (e.deltaY > 0 ? -0.08 : 0.08)
    );
  };

  const handleChangeImage = (e) => {
    const file = e.target.files?.[0];

    e.target.value = "";

    if (!file || !file.type.startsWith("image/")) {
      return;
    }

    if (localUrlRef.current) {
      URL.revokeObjectURL(localUrlRef.current);
    }

    const objectUrl = URL.createObjectURL(file);
    localUrlRef.current = objectUrl;

    setCurrentSrc(objectUrl);
    setCurrentFileName(file.name || "image.jpg");
    setNatural({ width: 0, height: 0 });
    setZoom(1);
    setOffset({ x: 0, y: 0 });
  };

  const confirmCrop = async () => {
    if (!metrics || saving) return;

    setSaving(true);

    try {
      const image = new Image();
      image.src = currentSrc;

      await new Promise((resolve, reject) => {
        image.onload = resolve;
        image.onerror = reject;
      });

      const sx =
        (
          (metrics.displayWidth - frame.width) / 2 -
          offset.x
        ) / metrics.scale;

      const sy =
        (
          (metrics.displayHeight - frame.height) / 2 -
          offset.y
        ) / metrics.scale;

      const sw = frame.width / metrics.scale;
      const sh = frame.height / metrics.scale;

      const canvas = document.createElement("canvas");

      canvas.width = outputWidth;
      canvas.height = outputHeight;

      const ctx = canvas.getContext("2d");

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";

      ctx.drawImage(
        image,
        sx,
        sy,
        sw,
        sh,
        0,
        0,
        outputWidth,
        outputHeight
      );

      const blob = await new Promise((resolve) => {
        canvas.toBlob(
          resolve,
          "image/jpeg",
          0.88
        );
      });

      if (!blob) {
        throw new Error("ไม่สามารถครอปรูปได้");
      }

      const safeName =
        (currentFileName || fileName)
          .replace(/\.[^.]+$/, "") + ".jpg";

      await onConfirm(
        new File(
          [blob],
          safeName,
          { type: "image/jpeg" }
        )
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="crop-modal-backdrop"
      role="dialog"
      aria-modal="true"
    >
      <div
        className={`crop-modal-card ${
          isProfileCrop ? "profile-crop" : ""
        }`}
      >
        <div className="crop-modal-header">
          <div>
            <h2>ปรับแต่งรูปภาพ</h2>
            <p>ลากรูปเพื่อจัดตำแหน่ง ใช้สองนิ้วเพื่อย่อหรือขยาย</p>
          </div>
          <span className="crop-aspect-tag">{isProfileCrop ? "1:1" : "16:9"}</span>
          
        </div>
        <div className="crop-stage">
        <div
          ref={frameRef}
          className={`crop-frame ${
            dragging ? "dragging" : ""
          }`}
          style={{
            aspectRatio: String(aspect),
          }}
          onPointerDown={startDrag}
          onPointerMove={moveDrag}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          onWheel={handleWheel}
        >
          <img
            src={currentSrc}
            alt="crop preview"
            draggable="false"
            onLoad={(e) =>
              setNatural({
                width:
                  e.currentTarget.naturalWidth,
                height:
                  e.currentTarget.naturalHeight,
              })
            }
            style={
              metrics
                ? {
                    width:
                      `${metrics.displayWidth}px`,
                    height:
                      `${metrics.displayHeight}px`,
                    transform:
                      `translate(calc(-50% + ${offset.x}px), calc(-50% + ${offset.y}px))`,
                  }
                : undefined
            }
          />

          {isProfileCrop ? (
            <>
              <div
                className="crop-profile-mask"
                aria-hidden="true"
              />

              <div
                className="crop-profile-circle"
                aria-hidden="true"
              />

              <div
                className="crop-profile-grid"
                aria-hidden="true"
              />
            </>
          ) : (
            <>
              <div
                className="crop-shade"
                aria-hidden="true"
              />

              <div
                className="crop-grid"
                aria-hidden="true"
              />
            </>
          )}


        </div>

        </div>
        <div className="crop-toolbar">
          <button
            type="button"
            className="crop-icon-btn"
            onClick={() =>
              fileInputRef.current?.click()
            }
            aria-label="เปลี่ยนรูปภาพ"
            title="เปลี่ยนรูปภาพ"
          >
            <svg
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <rect
                x="3"
                y="4"
                width="18"
                height="16"
                rx="3"
              />
              <circle
                cx="8.5"
                cy="9"
                r="1.5"
              />
              <path d="M4.5 17l4.7-4.6 3.4 3.1 2.5-2.4 4.4 3.9" />
            </svg>
            <span className="crop-action-label">เปลี่ยนรูป</span>
          </button>

          <div className="crop-zoom-area">
            <span className="crop-zoom-label">ย่อ / ขยาย</span>
          <div className="crop-zoom">
            <button
              type="button"
              className="crop-zoom-btn"
              onClick={() =>
                changeZoom(zoom - 0.15)
              }
              aria-label="ซูมออก"
            >
              −
            </button>

            <input
              type="range"
              min="1"
              max="3"
              step="0.01"
              value={zoom}
              onChange={(e) =>
                changeZoom(
                  Number(e.target.value)
                )
              }
              aria-label="ซูมรูปภาพ"
            />

            <button
              type="button"
              className="crop-zoom-btn"
              onClick={() =>
                changeZoom(zoom + 0.15)
              }
              aria-label="ซูมเข้า"
            >
              +
            </button>
          </div>

          </div>
          <div className="crop-confirm-group">
            <button
              type="button"
              className="crop-round-btn crop-round-cancel"
              onClick={onCancel}
              aria-label="ยกเลิก"
            >
              <svg
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
              <span>ยกเลิก</span>
            </button>

            <button
              type="button"
              className="crop-round-btn crop-round-confirm"
              onClick={confirmCrop}
              disabled={saving || !metrics}
              aria-label="ใช้รูปนี้"
            >
              {saving ? (
                <span
                  className="crop-spinner"
                  aria-hidden="true"
                />
              ) : (
                <svg
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path d="M5 12.5l4.2 4.2L19 7" />
                </svg>
              )}
              <span>{saving ? "กำลังบันทึก" : "ใช้รูปภาพนี้"}</span>
            </button>
          </div>

          <input
            ref={fileInputRef}
            className="crop-file-input"
            type="file"
            accept="image/*"
            onChange={handleChangeImage}
          />
        </div>
      </div>
    </div>
  );
}

export default ImageCropModal;
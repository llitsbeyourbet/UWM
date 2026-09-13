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
  const localUrlRef = useRef(null);

  const [currentSrc, setCurrentSrc] = useState(src);
  const [currentFileName, setCurrentFileName] = useState(fileName);
  const [natural, setNatural] = useState({ width: 0, height: 0 });
  const [frame, setFrame] = useState({ width: 0, height: 0 });
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [saving, setSaving] = useState(false);
  const [dragging, setDragging] = useState(false);

  const isProfileCrop = Math.abs(aspect - 1) < 0.01;

  useEffect(() => {
    setCurrentSrc(src);
    setCurrentFileName(fileName);
    setZoom(1);
    setOffset({ x: 0, y: 0 });
    setNatural({ width: 0, height: 0 });
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

  const startDrag = (e) => {
    if (!metrics) return;

    e.currentTarget.setPointerCapture?.(e.pointerId);

    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      originX: offset.x,
      originY: offset.y,
    };

    setDragging(true);
  };

  const moveDrag = (e) => {
    if (!dragRef.current || !metrics) return;

    const nextX =
      dragRef.current.originX +
      (e.clientX - dragRef.current.startX);

    const nextY =
      dragRef.current.originY +
      (e.clientY - dragRef.current.startY);

    setOffset({
      x: clamp(nextX, -metrics.maxX, metrics.maxX),
      y: clamp(nextY, -metrics.maxY, metrics.maxY),
    });
  };

  const endDrag = () => {
    dragRef.current = null;
    setDragging(false);
  };

  const changeZoom = (nextZoom) => {
    setZoom(clamp(nextZoom, 1, 3));
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

          <button
            type="button"
            className="crop-floating crop-floating-cancel"
            onClick={(e) => {
              e.stopPropagation();
              onCancel();
            }}
            aria-label="ยกเลิก"
          >
            <svg
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
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
          </button>

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
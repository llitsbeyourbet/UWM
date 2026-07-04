import { useEffect, useRef } from "react";
import { Html5Qrcode } from "html5-qrcode";

function ScanQR() {
  const scannerRef = useRef(null);

  const isStartedRef = useRef(false);

useEffect(() => {
  if (scannerRef.current) return;

  const scanner = new Html5Qrcode("reader");
  scannerRef.current = scanner;

  scanner
    .start(
      { facingMode: "environment" },
      {
        fps: 10,
        qrbox: 250,
      },
      async (decodedText) => {
        console.log(decodedText);

        try {
          await scanner.stop();
        } catch {}

        // ทำงานต่อ
      }
    )
    .then(() => {
      isStartedRef.current = true;
    })
    .catch(console.error);

  return () => {
    if (
      scannerRef.current &&
      isStartedRef.current
    ) {
      scannerRef.current
        .stop()
        .catch(() => {})
        .finally(() => {
          scannerRef.current = null;
          isStartedRef.current = false;
        });
    }
  };
}, []);

  return (
    <div className="scan-page">
      <h2>สแกน QR Code</h2>
      <div id="reader"></div>
    </div>
  );
}

export default ScanQR;
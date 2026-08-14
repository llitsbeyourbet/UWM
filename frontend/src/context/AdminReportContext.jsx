// frontend/src/context/AdminReportContext.jsx

import { createContext, useContext, useEffect, useState } from "react";
import API_URL from "../../config";
import { useSocket } from "./SocketContext";

const AdminReportContext = createContext();

export function AdminReportProvider({ children }) {
  const [pendingReportCount, setPendingReportCount] = useState(0);
  const { socket } = useSocket();

  const fetchPendingReports = async () => {
    try {
      const token = localStorage.getItem("token");

      if (!token) {
        setPendingReportCount(0);
        return;
      }

      const response = await fetch(`${API_URL}/api/admin/reports`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json().catch(() => []);

      if (!response.ok) {
        return;
      }

      const reports = Array.isArray(data) ? data : [];

      const count = reports.filter(
        (report) =>
          report.status === "pending" ||
          report.status === "reviewing"
      ).length;

      setPendingReportCount(count);
    } catch (error) {
      console.error("Fetch admin report count error:", error);
    }
  };

  useEffect(() => {
    fetchPendingReports();
  }, []);

  useEffect(() => {
    if (!socket) return;

    const handleNotification = (data) => {
      if (data?.notification?.type === "report") {
        fetchPendingReports();
      }
    };

    socket.on("notification", handleNotification);

    return () => {
      socket.off("notification", handleNotification);
    };
  }, [socket]);

  return (
    <AdminReportContext.Provider
      value={{
        pendingReportCount,
        refreshPendingReports: fetchPendingReports,
      }}
    >
      {children}
    </AdminReportContext.Provider>
  );
}

export function useAdminReport() {
  return useContext(AdminReportContext);
}
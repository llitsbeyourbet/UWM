// frontend/src/context/AdminReportContext.jsx

import { createContext, useContext, useEffect, useState } from "react";
import API_URL from "../../config";
import { useSocket } from "./SocketContext";

const AdminReportContext = createContext();

export function AdminReportProvider({ children }) {
  const [pendingReportCount, setPendingReportCount] = useState(0);
  const [pendingActivityModerations, setPendingActivityModerations] = useState(0);
  const [pendingReviewModerations, setPendingReviewModerations] = useState(0);

  const { socket } = useSocket();

  const getAdminAuth = () => {
    const token = sessionStorage.getItem("token");

    let user = {};
    try {
      user = JSON.parse(sessionStorage.getItem("user")) || {};
    } catch {
      user = {};
    }

    return { token, user };
  };

  const fetchPendingReports = async () => {
    try {
      const { token, user } = getAdminAuth();

      if (!token || user.role !== "admin") {
        setPendingReportCount(0);
        return;
      }

      const response = await fetch(`${API_URL}/api/admin/reports`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json().catch(() => []);

      if (!response.ok) return;

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

  const fetchModerationCounts = async () => {
    try {
      const { token, user } = getAdminAuth();

      if (!token || user.role !== "admin") {
        setPendingActivityModerations(0);
        setPendingReviewModerations(0);
        return;
      }

      const response = await fetch(`${API_URL}/api/admin/dashboard`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) return;

      setPendingActivityModerations(
        Number(data.pendingActivityModerations || 0)
      );

      setPendingReviewModerations(
        Number(data.pendingReviewModerations || 0)
      );
    } catch (error) {
      console.error("Fetch moderation counts error:", error);
    }
  };

  const refreshAdminCounts = async () => {
    await Promise.all([
      fetchPendingReports(),
      fetchModerationCounts(),
    ]);
  };

  useEffect(() => {
    refreshAdminCounts();
  }, []);

  useEffect(() => {
    if (!socket) return;

    const handleNotification = (data) => {
      const type = data?.notification?.type;

      if (type === "report") {
        fetchPendingReports();
      }

      if (
        type === "moderation_activity" ||
        type === "moderation_review"
      ) {
        fetchModerationCounts();
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
        pendingActivityModerations,
        pendingReviewModerations,
        refreshPendingReports: fetchPendingReports,
        refreshModerationCounts: fetchModerationCounts,
        refreshAdminCounts,
      }}
    >
      {children}
    </AdminReportContext.Provider>
  );
}

export function useAdminReport() {
  return useContext(AdminReportContext);
}
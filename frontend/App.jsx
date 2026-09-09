import { Routes, Route, useLocation, Navigate } from "react-router-dom";
import { AlertProvider } from "./src/context/AlertContext";
import BottomNavbar from "./components/BottomNavbar";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Home from "./pages/Home";
import ProtectedRoute from "./components/ProtectedRoute";
import CreateActivities from "./pages/CreateActivities";
import ActivityDetail from "./pages/ActivityDetail";
import Search from "./pages/Search";
import Profile from "./pages/Profile";
import Notifications from "./pages/Notifications";
import EditProfile from "./pages/EditProfile";
import EditActivity from "./pages/EditActivity";
import CheckIn from "./pages/CheckIn";
import AdminDashboard from "./pages/AdminDashboard";
import ReviewForm from "./pages/ReviewForm";
import ForgotPassword from "./pages/ForgotPassword";
import ChangePassword from "./pages/ChangePassword";
import "./assets/AppLayout.css";
import ScanQR from "./pages/ScanQR";
import UserProfile from "./pages/UserProfile";
import { SocketProvider } from "./src/context/SocketContext";
import { AdminReportProvider } from "./src/context/AdminReportContext";
import ActivitySummary from "./pages/ActivitySummary";
import ActivitySummaryDetail from "./pages/ActivitySummaryDetail";
import AdminReports from "./pages/AdminReports";
import AdminActivities from "./pages/AdminActivities";
import AdminUsers from "./pages/AdminUsers";
import AdminReviews from "./pages/AdminReviews";
import AdminReportDetail from "./pages/AdminReportDetail";
import AutoLogout from "./components/AutoLogout";
import SessionManager from "./components/SessionManager";

function HomeRedirect() {
  let user = null;

  try {
    user = JSON.parse(sessionStorage.getItem("user"));
  } catch {
    user = null;
  }

  if (user?.role === "admin") {
    return <Navigate to="/admin" replace />;
  }

  return <Home />;
}

function App() {
  const location = useLocation();

  const isAdmin =
    location.pathname.startsWith("/admin") ||
    (location.pathname === "/activity-detail" &&
      new URLSearchParams(location.search).get("from") === "admin");

  const hideNavbar =
    ["/login", "/register", "/scan", "/forgot-password"].includes(location.pathname) || isAdmin;

  return (
    <AlertProvider>
      <SocketProvider>
        <AdminReportProvider>
          <AutoLogout />
          <SessionManager />

          <div
            className={
              isAdmin ||
              location.pathname === "/login" ||
              location.pathname === "/register"
                ? ""
                : "app-shell"
            }
          >
            {!hideNavbar && <BottomNavbar />}

            <div
              className={
                isAdmin ||
                location.pathname === "/login" ||
                location.pathname === "/register"
                  ? ""
                  : "app-content"
              }
            >
              <Routes>
                <Route path="/login" element={<Login />} />
                <Route path="/register" element={<Register />} />
                <Route path="/forgot-password" element={<ForgotPassword />} />

                <Route path="/" element={<ProtectedRoute><HomeRedirect /></ProtectedRoute>} />
                <Route path="/CreateActivities" element={<ProtectedRoute><CreateActivities /></ProtectedRoute>} />
                <Route path="/activities" element={<ProtectedRoute><ActivityDetail /></ProtectedRoute>} />
                <Route path="/activity-detail" element={<ProtectedRoute><ActivityDetail /></ProtectedRoute>} />
                <Route path="/search" element={<ProtectedRoute><Search /></ProtectedRoute>} />
                <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
                <Route path="/user/:id" element={<ProtectedRoute><UserProfile /></ProtectedRoute>} />
                <Route path="/notifications" element={<ProtectedRoute><Notifications /></ProtectedRoute>} />
                <Route path="/edit-profile" element={<ProtectedRoute><EditProfile /></ProtectedRoute>} />
                <Route path="/edit-activity/:id" element={<ProtectedRoute><EditActivity /></ProtectedRoute>} />
                <Route path="/checkin/:activityId/:qrToken" element={<ProtectedRoute><CheckIn /></ProtectedRoute>} />
                <Route path="/review/:activityId" element={<ProtectedRoute><ReviewForm /></ProtectedRoute>} />
                <Route path="/change-password" element={<ProtectedRoute><ChangePassword /></ProtectedRoute>} />
                <Route path="/scan" element={<ProtectedRoute><ScanQR /></ProtectedRoute>} />
                <Route path="/activity-summary" element={<ProtectedRoute><ActivitySummary /></ProtectedRoute>} />
                <Route path="/activity-summary/:id" element={<ProtectedRoute><ActivitySummaryDetail /></ProtectedRoute>} />

                <Route path="/admin" element={<ProtectedRoute><AdminDashboard /></ProtectedRoute>} />
                <Route path="/admin/reports" element={<ProtectedRoute><AdminReports /></ProtectedRoute>} />
                <Route path="/admin/activities" element={<ProtectedRoute><AdminActivities /></ProtectedRoute>} />
                <Route path="/admin/users" element={<ProtectedRoute><AdminUsers /></ProtectedRoute>} />
                <Route path="/admin/reviews" element={<ProtectedRoute><AdminReviews /></ProtectedRoute>} />
                <Route path="/admin/reports/:id" element={<ProtectedRoute><AdminReportDetail /></ProtectedRoute>} />
              </Routes>
            </div>
          </div>
        </AdminReportProvider>
      </SocketProvider>
    </AlertProvider>
  );
}

export default App;
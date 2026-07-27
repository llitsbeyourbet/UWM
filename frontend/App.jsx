import { Routes, Route, useLocation } from "react-router-dom";
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
import "./assets/AppLayout.css"
import ScanQR from "./pages/ScanQR";
import UserProfile from "./pages/UserProfile";
import { SocketProvider } from "./src/context/SocketContext";
import ActivitySummary from "./pages/ActivitySummary";
import ActivitySummaryDetail from "./pages/ActivitySummaryDetail";
import AdminNotifications from "./pages/AdminNotifications";
import AdminReports from "./pages/AdminReports";
import AdminActivities from "./pages/AdminActivities";
import AdminUsers from "./pages/AdminUsers";
import AdminReviews from "./pages/AdminReviews";
import AdminReportDetail from "./pages/AdminReportDetail";
import AutoLogout from "./components/AutoLogout";

function App() {
  const location = useLocation();

  const isAdmin = location.pathname.startsWith("/admin") ||
    (location.pathname === "/activity-detail" && new URLSearchParams(location.search).get("from") === "admin");

  const hideNavbar = ["/login", "/register", "/scan"].includes(location.pathname) || isAdmin;


  return (
    <SocketProvider>
      <AutoLogout />
      <div className={isAdmin ? "" : "app-shell"}>
        {!hideNavbar && <BottomNavbar />}

        <div className={isAdmin ? "" : "app-content"}>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/" element={<ProtectedRoute><Home /></ProtectedRoute>} />
            <Route path="/CreateActivities" element={<ProtectedRoute><CreateActivities /></ProtectedRoute>} />
            <Route path="/activities" element={<ActivityDetail />} />
            <Route path="/activity-detail" element={<ActivityDetail />} />
            <Route path="/search" element={<Search />} />
            <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
            <Route path="/user/:id" element={<ProtectedRoute><UserProfile /></ProtectedRoute>} />
            <Route path="/notifications" element={<ProtectedRoute><Notifications /></ProtectedRoute>} />
            <Route path="/edit-profile" element={<ProtectedRoute><EditProfile /></ProtectedRoute>} />
            <Route path="/edit-activity/:id" element={<ProtectedRoute><EditActivity /></ProtectedRoute>} />
            <Route path="/checkin/:activityId/:qrToken" element={<CheckIn />} />
            <Route path="/admin" element={<AdminDashboard />} />
            <Route path="/review/:activityId" element={<ReviewForm />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/scan" element={<ScanQR />} />
            <Route path="/activity-summary" element={<ProtectedRoute><ActivitySummary /></ProtectedRoute>} />
            <Route path="/activity-summary/:id" element={<ProtectedRoute><ActivitySummaryDetail /></ProtectedRoute>} />
            <Route path="/admin/notifications" element={<AdminNotifications />}/>
            <Route path="/admin/reports" element={<AdminReports />} />
            <Route path="/admin/activities" element={<AdminActivities />}/>
            <Route path="/admin/users" element={<AdminUsers />} />
            <Route path="/admin/reviews" element={<AdminReviews />}/>
            <Route path="/admin/reports/:id" element={<AdminReportDetail />}/>


          </Routes>
        </div>
      </div>
    </SocketProvider>
  );
}

export default App;

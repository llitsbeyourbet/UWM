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


function App() {
  const location = useLocation();
  const hideNavbar = location.pathname === "/login" || location.pathname === "/register";

  return (
    <>
      <div className="page-wrapper">
        <div className="app-layout">

          {!hideNavbar && <BottomNavbar />}

          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/" element={<ProtectedRoute><Home /></ProtectedRoute>} />
            <Route path="/CreateActivities" element={<CreateActivities />} />
            <Route path="/activities" element={<ActivityDetail />} />
            <Route path="/activity-detail" element={<ActivityDetail />} />
            <Route path="/search" element={<Search />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/notifications" element={<Notifications />} />
            <Route path="/edit-profile" element={<EditProfile />} />
            <Route path="/edit-activity/:id" element={<EditActivity />} />
            <Route path="/checkin/:activityId/:qrToken" element={<CheckIn />} />
            <Route path="/admin" element={<AdminDashboard />} />
            <Route path="/review/:activityId" element={<ReviewForm />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/scan" element={<ScanQR />} />
          </Routes>

        </div>
      </div>
    </>
  );
}

export default App;

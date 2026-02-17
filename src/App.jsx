import { Routes, Route, useLocation } from "react-router-dom";
import Navbar from "./components/Navbar";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Home from "./pages/Home";

function App() {
  const location = useLocation();

  const hideNavbar =
    location.pathname.startsWith("/login") ||
    location.pathname.startsWith("/register");

  return (
    <>
      {!hideNavbar && <Navbar />}

      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/" element={<Home />} />
      </Routes>
    </> 
  );
}

export default App;

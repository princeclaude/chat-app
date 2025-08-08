// src/Navigation.jsx
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Signup from "./pages/Signup";
import SignIn from "./pages/Signin";
import ProfileSetup from "./pages/ProfileSetup";
import BottomTab from "./components/BottomTab";
import Home from "./pages/Home";
import ChatPanel from "./pages/ChatPanel";
import Explore from "./pages/Explore";
import Settings from "./pages/Settings";


export default function Navigation() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<SignIn />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/profilesetup" element={<ProfileSetup />} />
        <Route path="/home" element={<Home />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/explore" element={<Explore />} />
        <Route path="/chat/:pin" element={<ChatPanel />} />
        <Route path="/bottomtab" element={<BottomTab />} />
      </Routes>
    </Router>
  );
}

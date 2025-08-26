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
import CallerScreen from "./pages/CallerScreen";
import CallsScreen from "./pages/CallsScreen";
import ArchivedChatsScreen from "./pages/ArchivedChatsScreen";
import ResetPassword from "./pages/ResetPassword";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import About from "./pages/About";


export default function Navigation() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<SignIn />} />
        <Route path="/signin" element={<SignIn />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/profilesetup" element={<ProfileSetup />} />
        <Route path="/home" element={<Home />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/explore" element={<Explore />} />
        <Route path="/chat/:pin" element={<ChatPanel />} />
        <Route path="/callerscreen/:receiverPin" element={<CallerScreen />} />
        <Route path="calllogs" element={<CallsScreen/> } />
        <Route path="archived" element={<ArchivedChatsScreen/> } />
        <Route path="reset-password" element={<ResetPassword/> } />
        <Route path="privacypolicy" element={<PrivacyPolicy/> } />
        <Route path="about" element={<About/> } />
        <Route path="/bottomtab" element={<BottomTab />} />
      </Routes>
    </Router>
  );
}

import { FaCommentDots,  FaCog, FaSearch, FaPhoneAlt,FaBullhorn } from "react-icons/fa";
import { useLocation, useNavigate } from "react-router-dom";

export default function BottomTab({ isDesktop = false }) {
  const navigate = useNavigate();
  const location = useLocation();

  const tabs = [
    { icon: <FaCommentDots />, label: "Chirps", path: "/home" },
    { icon: <FaPhoneAlt />, label: "Chirp calls", path: "/calllogs" },
    
    
    { icon: <FaSearch />, label: "Explore", path: "/explore" },
    { icon: <FaCog />, label: "Settings", path: "/settings" },
  ];

  return (
    <div
      className={`${
        isDesktop
          ? "flex flex-col items-center gap-6"
          : "fixed bottom-2 left-4 right-4 flex justify-around bg-white border border-gray-200 py-3 rounded-2xl shadow-md z-50"
      } transition-all duration-200`}
    >
      {tabs.map((tab) => {
        const isActive = location.pathname === tab.path;
        
        return (
          <button
            key={tab.label}
            onClick={() => navigate(tab.path)}
            className={`flex flex-col items-center text-xs transition-transform duration-200 active:scale-95 ${
              isActive ? "text-purple-700 font-semibold" : "text-purple-400"
            }`}
          >
            <div className="text-xl">{tab.icon}</div>
            <span className={`${isDesktop ? "text-[10px]" : "mt-1"}`}>
              {tab.label}
            </span>
          </button>
        );
      })}
 </div>
);
}
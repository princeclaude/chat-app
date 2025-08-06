// src/components/BottomTab.jsx

import { FaHome, FaClock, FaCog } from "react-icons/fa";
import { useLocation, useNavigate } from "react-router-dom";

export default function BottomTab({ isDesktop = false }) {
  const navigate = useNavigate();
  const location = useLocation();

  const tabs = [
    { icon: <FaHome />, label: "Home", path: "/" },
    { icon: <FaClock />, label: "Expect", path: "/expect" },
    { icon: <FaCog />, label: "Settings", path: "/settings" },
  ];

  return (
    <div
      className={`${
        isDesktop
          ? "flex flex-col items-center gap-6"
          : "fixed bottom-0 left-0 right-0 flex justify-around bg-white border-t border-gray-200 py-2 z-50"
      }`}
    >
      {tabs.map((tab) => {
        const isActive = location.pathname === tab.path;
        return (
          <button
            key={tab.label}
            onClick={() => navigate(tab.path)}
            className={`flex flex-col items-center text-xs ${
              isActive ? "text-purple-600 font-semibold" : "text-gray-500"
            }`}
          >
            <div className="text-xl">{tab.icon}</div>
            <span className={`${isDesktop ? "text-[10px]" : ""}`}>
              {tab.label}
            </span>
          </button>
        );
      })}
 </div>
);
}
// src/pages/Home.jsx

import { useState } from "react";
import {
  FaEllipsisV,
  FaUserCircle,
  FaPhoneAlt,
  FaPaperclip,
  FaRegPaperPlane,
} from "react-icons/fa";
import BottomTab from "../components/BottomTab";
import { useProfile } from "../contexts/ProfileContext";
import { useNavigate } from "react-router-dom";

export default function Home() {
  const [showModal, setShowModal] = useState(false);
  const { profile, loading } = useProfile();
  const [searchQuery, setSearchQuery] = useState("");
  const navigate = useNavigate();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-600">
        Loading...
      </div>
    );
  }

  const pin = profile?.pin || "";
  const profilePic = profile?.profilePic || null;

  return (
    <div className="min-h-screen bg-white relative md:flex text-black">
      {/* Mobile Header */}
      <div className="fixed md:hidden top-0 left-0 right-0 z-50 backdrop-blur-md bg-white/30 border-b border-gray-100 shadow-sm">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            {profilePic ? (
              <img
                src={profilePic}
                alt="Profile"
                className="w-9 h-9 rounded-full object-cover"
              />
            ) : (
              <FaUserCircle className="text-3xl text-gray-600" />
            )}
            <span className="text-sm font-medium text-black">PIN: {pin}</span>
          </div>
          <button onClick={() => setShowModal(!showModal)}>
            <FaEllipsisV className="text-xl text-gray-700" />
          </button>
        </div>
      </div>
      {/* Mobile Menu Modal */}
      {showModal && (
        <div className="fixed top-16 right-4 bg-white shadow-lg rounded-md p-3 z-50">
          <p className="text-sm text-gray-700">Menu item (coming soon)</p>
        </div>
      )}
      <div className="flex-1 md:flex md:pt-0 pt-[130px]">
        {/* Sidebar - Desktop only */}
        <div className="hidden md:flex md:flex-col md:w-24 border-r border-gray-200 items-center py-6 gap-8 bg-white">
          <div className="flex flex-col items-center gap-1">
            {profilePic ? (
              <img
                src={profilePic}
                alt="Profile"
                className="w-10 h-10 rounded-full object-cover"
              />
            ) : (
              <FaUserCircle className="text-3xl text-gray-600" />
            )}
            <span className="text-[10px] text-black text-center tracking-wide uppercase">
              {pin}
            </span>
          </div>
          <BottomTab isDesktop />
        </div>

        {/* Chat List */}
        <div className="w-full md:w-1/3 border-r border-gray-200 px-4 pt-4 pb-20 md:pb-4 space-y-4 relative bg-white">
          <h2 className="text-xl font-semibold text-black px-1 mt-2 md:hidden">
            Chat
          </h2>

          {/* Search */}
          <input
            type="text"
            placeholder="Search chats..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
          />

          {/* Chat Entry */}
          <div
            className="flex items-center gap-3 p-3 bg-gray-50 rounded hover:bg-gray-100 cursor-pointer"
            onClick={() => navigate("/chat/XY78W")}
          >
            <FaUserCircle className="text-3xl text-gray-400" />
            <div className="flex-1">
              <p className="text-sm font-medium text-black">XY78W</p>
              <p className="text-xs text-gray-500 truncate">
                Last message preview here...
              </p>
            </div>
            <span className="text-xs text-gray-400">2m</span>
          </div>
        </div>

        {/* Chat Panel - Desktop */}
        <div className="hidden md:flex flex-col flex-1 px-4 pt-4 bg-white">
          {/* Chat Header */}
          <div className="flex items-center justify-between pb-3 border-b border-gray-200">
            <div className="flex items-center gap-3">
              <FaUserCircle className="text-3xl text-gray-400" />
              <div>
                <p className="text-sm font-medium text-black">XY78W</p>
                <p className="text-xs text-gray-500">Online</p>
              </div>
            </div>
            <FaPhoneAlt className="text-purple-600 text-xl cursor-pointer" />
          </div>

          {/* Message Bubbles */}
          <div className="flex-1 overflow-y-auto py-4 space-y-2 pr-2">
            {/* Received message */}
            <div className="max-w-xs bg-gray-100 text-sm px-4 py-2 rounded-lg rounded-tl-none text-black">
              Hey there! How are you?
            </div>

            {/* Sent message */}
            <div className="max-w-xs bg-purple-500 text-white text-sm px-4 py-2 rounded-lg rounded-tr-none self-end ml-auto">
              I’m good! How about you?
            </div>

            {/* Received message */}
            <div className="max-w-xs bg-gray-100 text-sm px-4 py-2 rounded-lg rounded-tl-none text-black">
              Doing great! Long time.
            </div>
          </div>

          {/* Input Box */}
          <div className="border-t border-gray-200 py-2 flex items-center gap-2">
            <button className="text-purple-600 text-xl p-2">
              <FaPaperclip />
            </button>
            <input
              type="text"
              placeholder="Type a message..."
              className="flex-1 px-4 py-2 rounded-full border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
            <button className="text-purple-600 text-xl p-2">
              <FaRegPaperPlane />
            </button>
          </div>
        </div>
      </div>
      {/* Bottom Tab - Mobile only */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-200">
        <BottomTab />
      </div>
      
    </div>
  );
}

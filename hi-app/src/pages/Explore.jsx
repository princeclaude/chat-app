// src/pages/Explore.jsx
import React, { useState, useEffect, useRef } from "react";
import { collection, query, where, getDocs, doc, getDoc } from "firebase/firestore";
import { db } from "../firebase";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import BottomTab from "../components/BottomTab";

export default function Explore() {
  const [pin, setPin] = useState("");
  const [userResult, setUserResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [searchTriggered, setSearchTriggered] = useState(false);
  const navigate = useNavigate();

  // store original viewport meta so we can restore it
  const originalViewportRef = useRef(null);
  const metaRef = useRef(null);

  useEffect(() => {
    // capture the viewport meta tag once on mount
    metaRef.current = document.querySelector('meta[name="viewport"]');
    if (metaRef.current) {
      originalViewportRef.current = metaRef.current.getAttribute("content");
    }
  }, []);

  const disableZoomTemporarily = () => {
    const meta = metaRef.current;
    if (!meta) return;
    // store original if not already stored
    if (originalViewportRef.current === null) {
      originalViewportRef.current = meta.getAttribute("content");
    }
    // set a viewport that disables zooming while typing/focus
    meta.setAttribute("content", "width=device-width, initial-scale=1, maximum-scale=1, user-scalable=0");
  };

  const restoreZoom = () => {
    const meta = metaRef.current;
    if (!meta) return;
    const orig = originalViewportRef.current;
    if (orig !== null && orig !== undefined) {
      meta.setAttribute("content", orig);
    } else {
      meta.setAttribute("content", "width=device-width, initial-scale=1");
    }
  };

  const formatLastActive = (value) => {
    if (!value) return "N/A";
    try {
      if (typeof value.toDate === "function") {
        return value.toDate().toLocaleString(); // Firestore Timestamp
      }
      if (value.seconds) {
        return new Date(value.seconds * 1000).toLocaleString();
      }
      if (value instanceof Date || typeof value === "string") {
        return new Date(value).toLocaleString();
      }
    } catch (err) {
      console.error("Error formatting lastActive:", err);
    }
    return "N/A";
  };

  const handleSearch = async () => {
    if (pin.length !== 5) return;
    setLoading(true);
    setSearchTriggered(true);
    setUserResult(null);

    try {
      // Step 1: Find user by PIN in "users"
      const q = query(collection(db, "users"), where("pin", "==", pin.toUpperCase()));
      const snap = await getDocs(q);

      if (!snap.empty) {
        const docSnap = snap.docs[0];
        const userId = docSnap.id;
        const baseUserData = docSnap.data();

        // Step 2: Get presence info from "currentUsers"
        const currentSnap = await getDoc(doc(db, "currentUsers", userId));
        let presenceData = {};
        if (currentSnap.exists()) {
          presenceData = currentSnap.data();
        }

        // Merge both
        setUserResult({
          id: userId,
          ...baseUserData,
          ...presenceData, // this will include lastActive if present
        });
      } else {
        setUserResult(null);
      }
    } catch (err) {
      console.error("Search error:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setPin("");
    setUserResult(null);
    setSearchTriggered(false);
    // restore viewport if user cancels while input was focused
    restoreZoom();
  };

  return (
    <div className="flex flex-col h-screen bg-white text-black p-4" style={{ WebkitTextSizeAdjust: "100%", MsTextSizeAdjust: "100%" }}>
      {/* Page Title */}
      <motion.h1
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-2xl font-bold text-purple-600 mb-4"
      >
        Explore
      </motion.h1>

      {/* Search Bar */}
      {/* sticky so it stays visually in place when mobile keyboard opens */}
      <div className="sticky top-16 z-40 mb-4 bg-white">
        <div className="flex items-center gap-2 w-full">
          <input
            type="text"
            value={pin}
            onChange={(e) =>
              setPin(e.target.value.replace(/[^a-zA-Z0-9]/g, "").toUpperCase())
            }
            maxLength={5}
            placeholder="Enter a Chirp"
            className="flex-1 border border-gray-300 rounded-lg px-2 sm:px-3 py-2 text-sm sm:text-base focus:outline-none focus:border-purple-500"
            // ensure font-size >= 16px to avoid iOS auto-zoom
            style={{ fontSize: 16, lineHeight: "20px" }}
            onFocus={() => {
              disableZoomTemporarily();
            }}
            onBlur={() => {
              // restore after small delay so taps on nearby buttons still work
              setTimeout(() => restoreZoom(), 100);
            }}
          />
          <button
            onClick={handleSearch}
            disabled={loading || pin.length !== 5}
            className="bg-purple-600 text-white px-2 sm:px-4 py-2 text-sm sm:text-base rounded-lg disabled:opacity-50"
          >
            Search
          </button>
          <button
            onClick={handleCancel}
            className="bg-gray-200 text-black px-2 sm:px-4 py-2 text-sm sm:text-base rounded-lg"
          >
            Cancel
          </button>
        </div>
      </div>

      {/* Results Section */}
      <div className="flex-1">
        <AnimatePresence>
          {loading && (
            <motion.p
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="text-center text-gray-500"
            >
              Searching...
            </motion.p>
          )}

          {!loading && userResult && (
            <motion.div
              key="result"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              whileHover={{ scale: 1.02 }}
              className="flex items-center gap-3 p-3 bg-gray-100 rounded-lg shadow-sm hover:bg-gray-200 transition cursor-pointer"
              onClick={() =>
                navigate(`/chat/${encodeURIComponent(userResult.id)}`, {
                  state: { otherUser: userResult },
                })
              }
            >
              <img
                src={userResult.profilePic || "/default-avatar.png"}
                alt="profile"
                className="w-12 h-12 rounded-full object-cover"
              />
              <div>
                <p className="font-bold text-purple-700">{userResult.pin}</p>
                <p className="text-sm text-gray-500">
                  Last active: {formatLastActive(userResult.lastActive)}
                </p>
              </div>
            </motion.div>
          )}

          {!loading && searchTriggered && !userResult && (
            <motion.p
              key="noresult"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="text-center text-gray-400"
            >
              No user found
            </motion.p>
          )}
        </AnimatePresence>
      </div>

      {/* Bottom Tab */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-200">
        <BottomTab />
      </div>
 </div>
);
}
// src/pages/Explore.jsx
import React, { useState } from "react";
import { collection, query, where, getDocs, doc, getDoc } from "firebase/firestore";
import { db } from "../firebase";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";

export default function Explore() {
  const [pin, setPin] = useState("");
  const [userResult, setUserResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [searchTriggered, setSearchTriggered] = useState(false);
  const navigate = useNavigate();

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
  };

  return (
    <div className="flex flex-col h-screen bg-white text-black p-4">
      {/* Page Title */}
      <motion.h1
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-2xl font-bold text-purple-600 mb-4"
      >
        Explore
      </motion.h1>

      {/* Search Bar */}
      <div className="flex items-center gap-2 mb-4">
        <input
          type="text"
          value={pin}
          onChange={(e) =>
            setPin(e.target.value.replace(/[^a-zA-Z0-9]/g, "").toUpperCase())
          }
          maxLength={5}
          placeholder="Enter a Chirp"
          className="flex-1 border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:border-purple-500"
        />
        <button
          onClick={handleSearch}
          disabled={loading || pin.length !== 5}
          className="bg-purple-600 text-white px-3 py-2 rounded-lg disabled:opacity-50"
        >
          Search
        </button>
        <button
          onClick={handleCancel}
          className="bg-gray-200 text-black px-3 py-2 rounded-lg"
        >
          Cancel
        </button>
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
              onClick={() => navigate(`/chat/${userResult.id}`)}
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
 </div>
);
}
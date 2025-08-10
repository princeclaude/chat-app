// src/pages/ChatList.jsx
import { useEffect, useState, useRef } from "react";
import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
} from "firebase/firestore";
import { db } from "../firebase";
import { useNavigate } from "react-router-dom";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import { FiMoreVertical, FiRefreshCw, FiSearch, FiX } from "react-icons/fi";
import BottomTab from "../components/BottomTab";
import { useProfile } from "../contexts/ProfileContext";

dayjs.extend(relativeTime);

export default function ChatList() {
  const { profile, loading } = useProfile();
  const [conversations, setConversations] = useState([]);
  const [enriched, setEnriched] = useState([]); // conversations merged with other user data
  const [showMenu, setShowMenu] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [isClosing, setIsClosing] = useState(false);
  const navigate = useNavigate();
  const userCacheRef = useRef(new Map()); // cache for user docs to avoid refetch

  const closeModal = () => {
    setIsClosing(true);
    setTimeout(() => {
      setShowProfileModal(false);
      setIsClosing(false);
    }, 250); // match animation duration
  };

  const currentUser = {
    pin: profile?.pin || "",
    profilePic: profile?.profilePic || "/default-profile.png",
    email: profile?.email || null,
  };

  // subscribe to conversations
  useEffect(() => {
    const q = query(collection(db, "conversations"), orderBy("updatedAt", "desc"));
    const unsub = onSnapshot(q, (snapshot) => {
      const convos = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
      // filter to conversations involving current user if profile is available
      const filtered = profile?.email
        ? convos.filter(
            (c) =>
              !c.participants || c.participants.includes(profile.email)
          )
        : convos;
      setConversations(filtered);
    });
    return () => unsub();
  }, [profile]);

  // when conversations or profile change, enrich conversations with other user's pin/profilePic
  useEffect(() => {
    if (!conversations || conversations.length === 0) {
      setEnriched([]);
      return;
    }

    // if we don't have profile.email yet, can't resolve the "other" participant
    const myEmail = profile?.email;
    if (!myEmail) {
      // just show raw conversation list until profile loads
      setEnriched(conversations.map((c) => ({ ...c })));
      return;
    }

    (async () => {
      try {
        // gather unique other user emails that we need to fetch
        const toFetch = new Set();
        const convosToResolve = conversations.map((c) => {
          let otherEmail = null;

          // Prefer participants array if present
          if (Array.isArray(c.participants) && c.participants.length > 0) {
            // find first participant that is not the current user
            otherEmail = c.participants.find((p) => p !== myEmail);
            // if participants only contains the current user (odd) fallback to null
          }

          // If participants didn't give us the other email, try to infer from conversation fields:
          // sometimes the convo doc may include otherEmail/otherUser fields
          if (!otherEmail) {
            if (c.otherUserEmail) otherEmail = c.otherUserEmail;
            else if (c.otherUserId) otherEmail = c.otherUserId;
            // else leave null (we'll display UNKNOWN)
          }

          if (otherEmail) {
            // Only queue fetch if not cached yet
            if (!userCacheRef.current.has(otherEmail)) toFetch.add(otherEmail);
          }

          return { ...c, otherEmail };
        });

        // fetch all missing user docs in parallel
        if (toFetch.size > 0) {
          const promises = Array.from(toFetch).map(async (email) => {
            try {
              // user documents are stored under their email as doc id per your design
              const userDocRef = doc(db, "users", email);
              const snap = await getDoc(userDocRef);
              if (snap.exists()) {
                userCacheRef.current.set(email, snap.data());
                return { email, data: snap.data() };
              } else {
                // store a fallback to avoid refetch attempts
                userCacheRef.current.set(email, null);
                return { email, data: null };
              }
            } catch (err) {
              console.error("Failed to fetch user doc for", email, err);
              userCacheRef.current.set(email, null);
              return { email, data: null };
            }
          });

          await Promise.all(promises);
        }

        // now merge cached user data into conversations
        const merged = convosToResolve.map((c) => {
          const other = c.otherEmail ? userCacheRef.current.get(c.otherEmail) : null;
          return {
            ...c,
            otherUserEmail: c.otherEmail || null,
            otherUserPin: other?.pin || c.otherUserPin || null,
            otherUserPic: other?.profilePic || c.otherUserPic || null,
          };
        });

        setEnriched(merged);
      } catch (err) {
        console.error("Error enriching conversations:", err);
        // fallback to raw list
        setEnriched(conversations.map((c) => ({ ...c })));
      }
    })();
  }, [conversations, profile]);

  const formatTime = (time) => {
    if (!time) return "";
    try {
      let date;
      if (typeof time?.toDate === "function") {
        date = time.toDate();
      } else if (time?.seconds) {
        date = new Date(time.seconds * 1000);
      } else if (typeof time === "number") {
        date = new Date(time);
      } else if (time instanceof Date) {
        date = time;
      } else {
        date = new Date(time);
        if (isNaN(date)) return "";
      }
      const diffDays = dayjs().diff(dayjs(date), "day");
      if (diffDays === 0) return dayjs(date).format("h:mm A");
      if (diffDays === 1) return "Yesterday";
      if (diffDays < 7) return dayjs(date).format("dddd");
      return dayjs(date).format("DD/MM/YYYY");
    } catch {
      return "";
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-white">
        <p className="text-gray-500">Loading...</p>
      </div>
    );
  }

  return (
    <div className="bg-white min-h-screen pb-16">
      {/* Header */}
      <div className="flex justify-between items-center px-4 py-3 bg-white sticky top-0 z-50 shadow-sm">
        <div className="flex items-center gap-3">
          <div
            className="p-[2px] rounded-full border-2 border-purple-500 cursor-pointer"
            onClick={() => setShowProfileModal(true)}
          >
            <img
              src={currentUser.profilePic}
              alt="Me"
              className="w-10 h-10 rounded-full object-cover border border-white"
            />
          </div>
          <span className="font-extrabold text-purple-700">
            {currentUser.pin}
          </span>
        </div>
        <div className="flex items-center gap-4 text-gray-600">
          <FiRefreshCw
            className="text-xl text-purple-600 font-bold cursor-pointer"
            title="Refresh"
            onClick={() => setConversations((c) => [...c])}
          />
          <FiMoreVertical
            className="text-xl text-purple-600 font-bold cursor-pointer"
            onClick={() => setShowMenu((prev) => !prev)}
          />
        </div>
      </div>

      {/* Action menu modal */}
      {showMenu && (
        <div className="absolute top-14 right-4 bg-white rounded-lg shadow-lg p-3 w-44 z-50 animate-fadeIn">
          <button className="w-full text-left px-2 py-2 hover:bg-purple-50 flex items-center gap-2">
            📞 Call
          </button>
          <button className="w-full text-left px-2 py-2 hover:bg-purple-50 flex items-center gap-2">
            📤 Share
          </button>
          <button className="w-full text-left px-2 py-2 hover:bg-purple-50 flex items-center gap-2">
            ⚙ Settings
          </button>
        </div>
      )}

      {/* Enlarged Profile Pic Modal */}
      {showProfileModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
          onClick={closeModal}
        >
          <div
            className={`relative ${isClosing ? "animate-zoomOut" : "animate-zoomIn"}`}
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={currentUser.profilePic}
              alt="Profile Large"
              className="w-72 h-72 rounded-full object-cover shadow-lg border-4 border-purple-500"
            />
            <button
              className="absolute -top-4 -right-4 bg-white text-purple-700 rounded-full p-2 shadow hover:bg-purple-100 transition"
              onClick={closeModal}
            >
              <FiX className="text-xl" />
            </button>
          </div>
        </div>
      )}

      {/* Title */}
      <h1 className="text-left ml-4 text-purple-600 font-extrabold text-2xl my-4">
        Chirps
      </h1>

      {/* Search bar */}
      <div className="px-4 mb-4">
        <div className="flex items-center bg-gray-100 rounded-full px-4 py-2 shadow-inner animate-slideIn">
          <FiSearch className="text-gray-500 mr-2" />
          <input
            type="text"
            placeholder="Search chirps..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="bg-transparent outline-none flex-1 text-gray-700 placeholder-gray-400"
          />
        </div>
      </div>

      {/* Chat list */}
      <div className="px-4 space-y-3">
        {enriched
          .filter((chat) =>
            !searchTerm
              ? true
              : (chat.otherUserPin || chat.otherUserEmail || "")
                  .toLowerCase()
                  .includes(searchTerm.toLowerCase())
          )
          .map((chat) => {
            const otherPic = chat.otherUserPic || "/default-avatar.png";
            const otherPin = chat.otherUserPin || chat.otherUserEmail || "UNKNOWN";

            // When navigating, pass the other user's email as the route param.
            // We'll URI-encode it to be safe for routes (so dots/@ don't break)
            const targetParam = encodeURIComponent(chat.otherUserEmail || chat.otherUserId || chat.id);

            return (
              <div
                key={chat.id}
                className="flex items-center justify-between p-3 rounded-lg shadow-md bg-gray-50 hover:bg-purple-50 transition-all duration-300 cursor-pointer"
                onClick={() => navigate(`/chat/${targetParam}`, { state: { otherUser: { email: chat.otherUserEmail, pin: chat.otherUserPin, profilePic: chat.otherUserPic } } })}
              >
                <div className="flex items-center">
                  <img
                    src={otherPic}
                    alt="Profile"
                    className="w-12 h-12 rounded-full border border-purple-300 object-cover"
                  />
                  <div className="ml-3">
                    <p className="font-semibold text-black">{otherPin}</p>
                    <p className="text-sm text-gray-500 truncate max-w-[200px]">
                      {chat.lastMessage || ""}
                    </p>
                  </div>
                </div>
                <span className="text-xs text-gray-400">
                  {formatTime(chat.lastMessageTime)}
                </span>
              </div>
            );
          })}
      </div>

      {/* Bottom Tab */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-200">
        <BottomTab />
      </div>
 </div>
);
}
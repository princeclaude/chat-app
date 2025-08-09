// src/pages/ChatPanel.jsx
import React, { useEffect, useRef, useState } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  addDoc,
  serverTimestamp,
  doc,
  getDoc,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { db } from "../firebase";
import { useProfile } from "../contexts/ProfileContext";
import {
  FaArrowLeft,
  FaPhoneAlt,
  FaPaperclip,
  FaPaperPlane,
  FaImage,
  FaBullhorn,
} from "react-icons/fa";
import dayjs from "dayjs";

export default function ChatPanel() {
  const { id: rawParamId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { profile, user } = useProfile();

  const passedOtherUser = location.state?.otherUser ?? null;
  const paramId = rawParamId ? decodeURIComponent(rawParamId) : null;
  const otherKey = passedOtherUser?.email || paramId || null;
  const currentEmail = user?.email || profile?.email || null;

  const [otherUser, setOtherUser] = useState(passedOtherUser ?? null);
  const [isOnline, setIsOnline] = useState(false);
  const [messages, setMessages] = useState([]);
  const [messageText, setMessageText] = useState("");
  const [convoId, setConvoId] = useState(null);
  const [loading, setLoading] = useState(true);

  const endRef = useRef(null);

  const sanitizeKey = (s = "") =>
    String(s).toLowerCase().replace(/[^a-z0-9]/g, "_");

  const formatTime = (ts) => {
    if (!ts) return "";
    try {
      if (typeof ts.toDate === "function") {
        const d = ts.toDate();
        const diffDays = dayjs().diff(dayjs(d), "day");
        if (diffDays === 0) return dayjs(d).format("h:mm A");
        if (diffDays === 1) return "Yesterday";
        if (diffDays < 7) return dayjs(d).format("dddd");
        return dayjs(d).format("DD/MM/YYYY");
      }
      if (ts?.seconds) {
        const d = new Date(ts.seconds * 1000);
        return dayjs(d).format("h:mm A");
      }
      const d = new Date(ts);
      if (!isNaN(d)) return dayjs(d).format("h:mm A");
    } catch (e) {
      // ignore
    }
    return "";
  };

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (!otherKey || !currentEmail) {
      setLoading(false);
      return;
    }

    let unsubMessages = null;
    let unsubPresence = null;
    let mounted = true;

    (async () => {
      try {
        if (!passedOtherUser) {
          const otherDocRef = doc(db, "users", otherKey);
          const otherSnap = await getDoc(otherDocRef);
          if (otherSnap.exists()) {
            const data = otherSnap.data();
            if (mounted)
              setOtherUser({
                email: data.email || otherKey,
                pin: data.pin,
                profilePic: data.profilePic,
              });
          } else {
            if (mounted)
              setOtherUser({ email: otherKey, pin: otherKey, profilePic: null });
          }
        }

        const a = sanitizeKey(currentEmail);
        const b = sanitizeKey(otherKey);
        const idCombined = [a, b].sort().join("");
        setConvoId(idCombined);

        const convoRef = doc(db, "conversations", idCombined);
        const convoSnap = await getDoc(convoRef);
        if (!convoSnap.exists()) {
          await setDoc(convoRef, {
            participants: [currentEmail, otherKey],
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            lastMessage: "",
            lastMessageTime: serverTimestamp(),
          });
        }

        const messagesQuery = query(
          collection(db, "conversations", idCombined, "messages"),
          orderBy("createdAt", "asc")
        );
        unsubMessages = onSnapshot(messagesQuery, (snap) => {
          const msgs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
          if (mounted) setMessages(msgs);
        });

        const presenceRef = doc(db, "currentUsers", otherKey);
        unsubPresence = onSnapshot(presenceRef, (snap) => {
          if (!mounted) return;
          setIsOnline(snap.exists());
        });
      } catch (err) {
        console.error("ChatPanel init error:", err);
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
      if (unsubMessages) unsubMessages();
      if (unsubPresence) unsubPresence();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [otherKey, currentEmail]);

  const handleSend = async () => {
    if (!messageText.trim() || !convoId || !currentEmail) return;
    try {
      const msg = {
        sender: currentEmail,
        text: messageText.trim(),
        createdAt: serverTimestamp(),
        status: "sent",
      };

      await addDoc(collection(db, "conversations", convoId, "messages"), msg);

      const convoRef = doc(db, "conversations", convoId);
      await updateDoc(convoRef, {
        lastMessage: msg.text,
        lastMessageTime: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      setMessageText("");
    } catch (err) {
      console.error("send message error:", err);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <p className="text-gray-500">Loading chat...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-white text-black">
      {/* Header - translucent with blur */}
      <div className="sticky top-0 z-50 backdrop-blur-md bg-white/30 border-b border-gray-100">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate(-1)} className="pr-1">
              <FaArrowLeft className="text-lg text-gray-700" />
            </button>

            <div className="w-10 h-10 rounded-full overflow-hidden bg-gray-100 border border-white">
              {otherUser?.profilePic ? (
                <img
                  src={otherUser.profilePic}
                  alt="other"
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="flex items-center justify-center w-full h-full text-gray-400">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="w-5 h-5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="1.5"
                      d="M5.121 17.804A13.937 13.937 0 0112 15c2.761 0 5.29.857 7.121 2.304M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                    />
                  </svg>
                </div>
              )}
            </div>

            <div>
              <div className="text-sm font-medium text-black">
                {otherUser?.pin || otherUser?.email}
              </div>
              <div
                className={`text-xs ${
                  isOnline ? "text-green-600" : "text-gray-500"
                }`}
              >
                {isOnline ? "Online" : "Offline"}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4 text-purple-600">
            <FaBullhorn className="text-xl" />
            <FaPhoneAlt className="text-xl" />
          </div>
        </div>
      </div>

      {/* Messages list */}
      <div
        className="flex-1 overflow-y-auto px-4 py-3 space-y-3"
        style={{ paddingBottom: 16 }}
      >
        {messages.length === 0 && (
          <div className="py-10 text-center text-gray-400">
            No messages yet. Say hi 👋
          </div>
        )}

        {messages.map((m, idx) => {
          const isMe = m.sender === currentEmail;

          // colors
          const pointerColor = isMe ? "#7c3aed" : "#f3e8ff"; // purple-600 / purple-100

          return (
            <div
              key={m.id || idx}
              className={`w-full flex ${isMe ? "justify-end" : "justify-start"} flex-col`}
            >
              {/* bubble - inline-block so width fits content, max-w caps large messages */}
              <div
                className={`relative inline-block w-auto max-w-[70%] break-words px-4 py-3 text-sm rounded-2xl transform transition-all duration-150 shadow-sm ${
                  isMe ? "bg-gradient-to-br from-purple-600 to-purple-500 text-white" : "bg-purple-50 text-black"
                } animate-pop`}
                style={{ wordBreak: "break-word" }}
              >
                
               
                {/* message text */}
                <div className="whitespace-pre-wrap">{m.text}</div>

                {/* timestamp inside bubble (bottom-left) */}
                <div
                  className="absolute text-[11px] opacity-80"
                  style={{
                    bottom: 6,
                    right: 12,
                    maxWidth: "60%",
                    whiteSpace: "nowrap",
                  }}
                >
                  {formatTime(m.createdAt)}
                </div>
              </div>

              {/* status outside beneath bubble, aligned with side */}
              <div
                className={`mt-1 text-[12px] ${
                  isMe ? "text-gray-500 text-left mr-2" : "text-gray-500 text-left ml-2"
                }`}
              >
                {isMe ? (m.status === "seen" ? "Seen" : "Sent") : ""}
              </div>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>

      {/* Input */}
      <div className="sticky bottom-0 z-40 bg-white border-t border-gray-200 px-3 py-2">
        <div className="flex items-center gap-3">
          <button className="text-gray-500 p-2" aria-label="attach file">
            <FaPaperclip className="text-xl" />
          </button>
          <button className="text-gray-500 p-2" aria-label="attach image">
            <FaImage className="text-xl" />
          </button>

          <input
            type="text"
            placeholder="Type a message"
            value={messageText}
            onChange={(e) => setMessageText(e.target.value)}
            onKeyDown={handleKeyDown}
            className="flex-1 px-4 py-2 rounded-full border border-gray-300 text-base focus:outline-none focus:ring-2 focus:ring-purple-500"
            inputMode="text"
            autoComplete="off"
            spellCheck={false}
            style={{ fontSize: 16 }}
          />

          <button
            onClick={handleSend}
            className={`p-3 rounded-full ${
              messageText.trim() ? "bg-purple-600 text-white" : "bg-gray-200 text-gray-400"
            }`}
            disabled={!messageText.trim()}
            aria-label="send"
          >
            <FaPaperPlane className="text-lg" />
          </button>
        </div>
      </div>

      {/* bubble animation */}
      <style>{`
        @keyframes pop {
          0% { transform: scale(0.94); opacity: 0; }
          60% { transform: scale(1.02); opacity: 1; }
          100% { transform: scale(1); opacity: 1; }
        }
        .animate-pop {
          animation: pop 220ms cubic-bezier(.2,.9,.3,1) both;
        }
        /* subtle hover nudge on larger screens */
        @media (hover: hover) and (pointer: fine) {
          .animate-pop:hover { transform: translateY(-2px) scale(1.01); box-shadow: 0 6px 18px rgba(16,24,40,0.06); }
        }
      `}</style>
 </div>
);
}
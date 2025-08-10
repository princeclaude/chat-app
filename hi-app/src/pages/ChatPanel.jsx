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
  writeBatch,
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
import { BsCheck, BsCheckAll } from "react-icons/bs";
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
  const [isTyping, setIsTyping] = useState(false);

  // modal state for profile image zoom
  const [showPicModal, setShowPicModal] = useState(false);

  const endRef = useRef(null);
  const sendSoundRef = useRef(new Audio("/sounds/send.mp3"));
  const receiveSoundRef = useRef(new Audio("/sounds/receive.mp3"));
  const presenceHeartbeatRef = useRef(null);

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
        return dayjs(new Date(ts.seconds * 1000)).format("h:mm A");
      }
      const d = new Date(ts);
      if (!isNaN(d)) return dayjs(d).format("h:mm A");
    } catch {
      return "";
    }
    return "";
  };

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  // presence helpers
  const setMeOnline = async () => {
    if (!currentEmail) return;
    try {
      // keep a small "online" flag plus lastActive server timestamp
      await setDoc(
        doc(db, "currentUsers", currentEmail),
        { online: true, lastActive: serverTimestamp() },
        { merge: true }
      );
    } catch (err) {
      console.warn("setMeOnline error", err);
    }
  };
  const setMeOffline = async () => {
    if (!currentEmail) return;
    try {
      // mark offline and update lastActive to server time so others can use recency check
      await setDoc(
        doc(db, "currentUsers", currentEmail),
        { online: false, lastActive: serverTimestamp() },
        { merge: true }
      );
    } catch (err) {
      // ignore
    }
  };

  // Manage current user's presence using visibility/focus/unload
  useEffect(() => {
    if (!currentEmail) return;

    // set online immediately
    setMeOnline();

    // heartbeat to update lastActive (keeps doc fresh)
    presenceHeartbeatRef.current = setInterval(() => {
      setMeOnline();
    }, 30_000); // every 30s

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        setMeOnline();
      } else {
        // when tab hidden => mark offline (best effort)
        setMeOffline();
      }
    };

    const onFocus = () => setMeOnline();
    const onBlur = () => setMeOffline();
    const onBeforeUnload = () => {
      
      setMeOffline();
    };

    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("focus", onFocus);
    window.addEventListener("blur", onBlur);
    window.addEventListener("beforeunload", onBeforeUnload);

    return () => {
      clearInterval(presenceHeartbeatRef.current);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("beforeunload", onBeforeUnload);
      // cleanup: attempt to set offline on unmount
      setMeOffline();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentEmail]);

  useEffect(() => {
    if (!otherKey || !currentEmail) {
      setLoading(false);
      return;
    }

    let unsubMessages = null;
    let unsubPresence = null;
    let unsubTyping = null;
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

        // Messages listener
        unsubMessages = onSnapshot(
          query(
            collection(db, "conversations", idCombined, "messages"),
            orderBy("createdAt", "asc")
          ),
          async (snap) => {
            const msgs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

            // Play receive sound if last msg is from other user
            if (
              msgs.length > messages.length &&
              msgs[msgs.length - 1]?.sender !== currentEmail
            ) {
              receiveSoundRef.current.play().catch(() => {});
            }

            // Auto-update "sent" → "delivered"
            const batch = writeBatch(db);
            msgs.forEach((m) => {
              if (m.sender !== currentEmail && m.status === "sent") {
                batch.update(
                  doc(db, "conversations", idCombined, "messages", m.id),
                  { status: "delivered" }
                );
              }
            });
            await batch.commit().catch(() => {});

            if (mounted) setMessages(msgs);
          }
        );

        // Presence listener for other user:
        // We interpret the other user's doc fields: { online: boolean, lastActive: Timestamp }
        // To avoid "stale online" we also consider lastActive recency (threshold)
        const ONLINE_THRESHOLD_MS = 90_000; // 90 seconds

        unsubPresence = onSnapshot(doc(db, "currentUsers", otherKey), (snap) => {
          if (!mounted) return;

          if (!snap.exists()) {
            setIsOnline(false);
            return;
          }

          const data = snap.data() || {};
          let onlineFlag = !!data.online;

          // compute recency from lastActive (if available)
          const la = data.lastActive;
          let lastMs = 0;
          if (la) {
            if (typeof la.toDate === "function") {
              lastMs = la.toDate().getTime();
            } else if (la.seconds) {
              lastMs = la.seconds * 1000;
            } else {
              const parsed = new Date(la);
              if (!isNaN(parsed)) lastMs = parsed.getTime();
            }
          }

          const now = Date.now();
          const recent = lastMs && now - lastMs <= ONLINE_THRESHOLD_MS;

          // final online determination: either online flag true OR lastActive is recent
          const computedOnline = onlineFlag || recent;
          setIsOnline(Boolean(computedOnline));
        });

        // Typing indicator listener
        unsubTyping = onSnapshot(
          doc(db, "typingStatus", idCombined),
          (snap) => {
            if (!mounted) return;
            const data = snap.data();
            if (data && data.typing && data.user === otherKey) {
              setIsTyping(true);
            } else {
              setIsTyping(false);
            }
          }
        );
      } catch (err) {
        console.error("ChatPanel init error:", err);
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
      unsubMessages && unsubMessages();
      unsubPresence && unsubPresence();
      unsubTyping && unsubTyping();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [otherKey, currentEmail, passedOtherUser, messages.length]);

  // Auto-update "delivered" → "seen" when chat is open
  useEffect(() => {
    if (!convoId || !messages.length) return;

    const unseen = messages.filter(
      (m) => m.sender !== currentEmail && m.status !== "seen"
    );
    if (unseen.length > 0) {
      const batch = writeBatch(db);
      unseen.forEach((m) => {
        batch.update(doc(db, "conversations", convoId, "messages", m.id), {
          status: "seen",
        });
      });
      batch.commit().catch(() => {});
    }
  }, [messages, convoId, currentEmail]);

  const updateTypingStatus = async (typing) => {
    if (!convoId) return;
    await setDoc(
      doc(db, "typingStatus", convoId),
      { typing, user: currentEmail },
      { merge: true }
    );
  };

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
      sendSoundRef.current.play().catch(() => {});

      await updateDoc(doc(db, "conversations", convoId), {
        lastMessage: msg.text,
        lastMessageTime: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      setMessageText("");
      await updateTypingStatus(false);
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

  const handleChange = (e) => {
    setMessageText(e.target.value);
    updateTypingStatus(e.target.value.trim().length > 0);
  };

  const renderStatusIcon = (status) => {
    switch (status) {
      case "sent":
        return <BsCheck className="inline text-white text-lg font-bold" />;
      case "delivered":
        return <BsCheckAll className="inline text-white text-lg font-bold" />;
      case "seen":
        return <BsCheckAll className="inline text-green-600 text-lg font-bold" />;
      default:
        return null;
    }
  };

  // profile pic modal handlers
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape" && showPicModal) setShowPicModal(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [showPicModal]);

  const onProfileClick = () => {
    if (!otherUser?.profilePic) return;
    setShowPicModal(true);
  };

  const closePicModal = () => setShowPicModal(false);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <p className="text-gray-500">Loading chat...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-white text-black">
      {/* Header */}
      <div className="sticky top-0 z-50 backdrop-blur-md bg-white/30 border-b border-gray-100">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate(-1)} className="pr-1">
              <FaArrowLeft className="text-lg text-purple-700" />
            </button>

            <button
              onClick={onProfileClick}
              aria-label="Open profile"
              className="w-10 h-10 rounded-full overflow-hidden bg-gray-100 border border-white p-0"
            >
              {otherUser?.profilePic ? (
                <img
                  src={otherUser.profilePic}
                  alt="other"
                  className="p-[2px] rounded-full border-2 border-purple-500 cursor-pointer"
                />
              ) : (
                <div className="flex items-center justify-center w-full h-full text-gray-400">
                  👤
                </div>
              )}
            </button>

            <div>
              <div className="text-sm font-medium">
                {otherUser?.pin || otherUser?.email}
              </div>
              <div
                className={`text-xs ${
                  isOnline
                    ? "text-green-600 font-bold"
                    : "text-gray-600 font-bold"
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

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {messages.length === 0 && (
          <div className="py-10 text-center text-gray-400">
            No messages yet. Send a chirp!
          </div>
        )}

        {messages.map((m) => {
          const isMe = m.sender === currentEmail;
          return (
            <div
              key={m.id}
              className={`flex ${isMe ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`relative px-4 py-2 rounded-2xl max-w-[70%] animate-pop shadow-sm ${
                  isMe
                    ? "bg-gradient-to-br from-purple-700 to-purple-600 text-white rounded-br-none"
                    : "bg-purple-500 text-white rounded-bl-none"
                }`}
              >
                <div className="whitespace-pre-wrap">{m.text}</div>
                <div
                  className={`flex items-center ${
                    isMe ? "justify-end" : "justify-start"
                  } gap-1 text-[10px] mt-1 opacity-70`}
                >
                  {formatTime(m.createdAt)}
                  {isMe && renderStatusIcon(m.status)}
                </div>
              </div>
            </div>
          );
        })}

        {/* Typing indicator */}
        {isTyping && (
          <div className="flex justify-start">
            <div className="flex justify-start">
              <div className="flex items-center gap-1 px-3 py-2 bg-purple-500 text-white rounded-2xl rounded-bl-none shadow-sm">
                <span className="dot" />
                <span className="dot" />
                <span className="dot" />
              </div>
            </div>
          </div>
        )}

        <div ref={endRef} />
      </div>

      {/* Input */}
      <div className="sticky bottom-0 bg-white border-t px-3 py-2">
        <div className="flex items-center gap-3">
          <FaPaperclip className="text-xl text-purple-600" />
          <FaImage className="text-xl text-purple-600" />
          <input
            type="text"
            placeholder="Type a message"
            value={messageText}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            className="flex-1 px-4 py-2 rounded-full border border-gray-300 focus:outline-none"
          />
          <button
            onClick={handleSend}
            className={`p-3 rounded-full ${
              messageText.trim()
                ? "bg-purple-600 text-white"
                : "bg-gray-200 text-gray-400"
            }`}
            disabled={!messageText.trim()}
          >
            <FaPaperPlane />
          </button>
        </div>
      </div>

      {/* Profile image modal */}
      {showPicModal && otherUser?.profilePic && (
        <div
          className="fixed inset-0 z-60 flex items-center justify-center bg-black/60"
          onClick={closePicModal}
        >
          <div
            className="max-w-[92%] max-h-[86%] p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              aria-label="Close"
              onClick={closePicModal}
              className="absolute top-6 right-6 z-70 text-white text-2xl"
            >
              ✕
            </button>
            <div className="w-full h-full flex items-center justify-center">
             
              <img
                src={otherUser.profilePic}
                alt="Profile zoom"
                className="max-w-full max-h-[80vh] rounded-full mt-4 object-cover border-4 border-purple-500 shadow-lg transform transition-transform duration-400 ease-out scale-100 animate-zoom-in"
                style={{
                  animation: "zoomIn 320ms cubic-bezier(.2,.9,.3,1) both",
                }}
              />
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes pop {
          0% { transform: scale(0.94); opacity: 0; }
          60% { transform: scale(1.02); opacity: 1; }
          100% { transform: scale(1); opacity: 1; }
        }
        .animate-pop {
          animation: pop 220ms cubic-bezier(.2,.9,.3,1) both;
        }

        @keyframes blink {
          0%, 80%, 100% { transform: scale(0.8); opacity: 0.4; }
          40% { transform: scale(1); opacity: 1; }
        }
        .dot {
          width: 6px;
          height: 6px;
          background-color: white;
          border-radius: 50%;
          display: inline-block;
          animation: blink 1.4s infinite both;
        }
        .dot:nth-child(1) { animation-delay: 0s; }
        .dot:nth-child(2) { animation-delay: 0.2s; }
        .dot:nth-child(3) { animation-delay: 0.4s; }

        /* zoom-in animation used for modal image */
        @keyframes zoomIn {
          0% { transform: scale(0.88); opacity: 0; }
          60% { transform: scale(1.02); opacity: 1; }
          100% { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
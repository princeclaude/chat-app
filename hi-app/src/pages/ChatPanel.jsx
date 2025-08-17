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
  deleteDoc,
  getDocs,
  writeBatch,
} from "firebase/firestore";
import { db } from "../firebase";
import { useProfile } from "../contexts/ProfileContext";
import {
  
  FaPhoneAlt,
  FaGamepad,
  FaPaperPlane,
  FaImage,
  FaBullhorn,
  FaUser,
  FaWhatsapp,
  FaReply, 
  FaTrash, FaCopy,FaEdit, FaShare,
  FaChevronLeft
} from "react-icons/fa";
import { BsCheck, BsCheckAll } from "react-icons/bs";
import dayjs from "dayjs";
import { useToast } from "../contexts/ToastContext";
import GamePicker from "../components/GamePicker";


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
  const [isSystemConversation, setIsSystemConversation] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isTyping, setIsTyping] = useState(false);
  const { showToast } = useToast();
  const [replyTo, setReplyTo] = useState(null);
  const [showPicModal, setShowPicModal] = useState(false);
  const [imageModalUrl, setImageModalUrl] = useState(null);
  const [activeGame, setActiveGame] = useState(null);
  const [chatBgUrl, setChatBgUrl] = useState(null);

  const [isUploading, setIsUploading] = useState(false);

  const endRef = useRef(null);
  const sendSoundRef = useRef(new Audio("/sounds/send.mp3"));
  const receiveSoundRef = useRef(new Audio("/sounds/receive.mp3"));
  const presenceHeartbeatRef = useRef(null);

  const [showGamePicker, setShowGamePicker] = useState(false);
  const openGamePicker = () => setShowGamePicker(true);
  const closeGamePicker = () => setShowGamePicker(false);
  const [gamesList] = useState([
    {
      id: "catch-dot",
      title: "Catch Dot",
      url: "/games/catch-dot/index.html",
      thumbnail: "/games/catch-dot.jpg"
      
    }
  ])


  // touch helpers to detect an intentional tap (mobile)
  const touchStartRef = useRef({});

  

  

  useEffect(() => {
    if (!convoId) return;
    const gameRef = doc(db, "conversations", convoId, "game", "current");
    const unsub = onSnapshot(gameRef, (snap) => {
      setActiveGame(snap.exists() ? snap.data() : null);
    });
    return unsub;
  }, [convoId]);

 

  useEffect(() => {
    if (!currentEmail) return;
    const unsub = onSnapshot(doc(db, "users", currentEmail), (snap) => {
      setChatBgUrl(snap.data()?.chatBackground || null);
    });
    return unsub;
  }, [currentEmail]);

  useEffect(() => {
    if (!convoId) {
      setIsSystemConversation(false);
      return;
    }

    let mounted = true;
    (async () => {
      try {
        const snap = await getDoc(doc(db, "conversations", convoId));
        const data = snap && snap.exists() ? snap.data() : null;
        if (mounted)
          setIsSystemConversation(Boolean(data?.isSystemConversation));
      } catch (err) {
        console.error("Failed to read conversation meta:", err);
        if (mounted) setIsSystemConversation(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [convoId]);

  const handleTouchStart = (e, id) => {
    const t = e.touches?.[0];
    if (!t) return;
    touchStartRef.current[id] = { x: t.clientX, y: t.clientY, t: Date.now() };
  };

  const startGame = async (game) => {
    const url = game?.url; // local file in /public/games/...
    if (!convoId || !currentEmail || !url) {
      showToast?.("Can't start game (missing data)", "default", 1400);
      return;
    }
    try {
      await setDoc(
        doc(db, "conversations", convoId, "game", "current"),
        {
          title: game.title || "Game",
          url, // <-- local URL
          startedAt: serverTimestamp(),
          startedBy: currentEmail,
        },
        { merge: true }
      );
      closeGamePicker();
    } catch (e) {
      console.error("startGame error", e);
      showToast?.("Couldn't start game", "default", 1500);
    }
  };

  const endGame = async () => {
    if (!convoId) return;
    try {
      await deleteDoc(doc(db, "conversations", convoId, "game", "current"));
    } catch (e) {
      console.error("endGame error", e);
      showToast?.("Couldn't end game", "default", 1500);
    }
  };

  const handleTouchEnd = (e, message) => {
    const t = e.changedTouches?.[0];
    if (!t) return;
    const start = touchStartRef.current[message.id] || {};
    const dx = Math.abs((start.x || 0) - t.clientX);
    const dy = Math.abs((start.y || 0) - t.clientY);
    const dt = Date.now() - (start.t || 0);

    // treat as tap if small movement and reasonably quick
    if (dx < 12 && dy < 12 && dt < 700) {
      // call the same handler as mouse click, using the event so currentTarget is available
      handleBubbleClick(e, message);
    }

    delete touchStartRef.current[message.id];
  };

  const [actionModal, setActionModal] = useState({
    show: false,
    x: 0,
    y: 0,
    message: null,
  });

  const handleBubbleClick = (e, message) => {
    // prevent page-level handlers from interfering
    try {
      e.stopPropagation();
    } catch (err) {}

    // If modal is already showing for this message, hide it
    if (actionModal.show && actionModal.message?.id === message.id) {
      setActionModal((prev) => ({ ...prev, show: false }));
      return;
    }

    // get the bounding rect in a safe way (touchend and click both provide currentTarget)
    const targetEl = e.currentTarget || e.target;
    if (!targetEl || !targetEl.getBoundingClientRect) {
      // fallback: show modal centered
      const centerX = Math.round(window.innerWidth / 2 - 80);
      const centerY = Math.round(window.innerHeight / 2 - 150);
      setActionModal({
        show: true,
        x: Math.max(8, centerX),
        y: Math.max(8, centerY),
        message,
      });
      return;
    }

    const rect = targetEl.getBoundingClientRect();

    const modalWidth = 180; // slightly bigger for buttons
    const modalHeight = 260; // safe height
    const padding = 8;
    const screenWidth = window.innerWidth;
    const screenHeight = window.innerHeight;

    // decide horizontal placement: prefer right of bubble, else left, else center
    let x;
    const spaceRight = screenWidth - rect.right;
    const spaceLeft = rect.left;
    if (spaceRight >= modalWidth + padding) {
      x = rect.right + padding;
    } else if (spaceLeft >= modalWidth + padding) {
      x = Math.max(padding, rect.left - modalWidth - padding);
    } else {
      x = Math.min(
        Math.max(rect.left + rect.width / 2 - modalWidth / 2, padding),
        screenWidth - modalWidth - padding
      );
    }

    let y = rect.top;

    if (rect.top + modalHeight + padding > screenHeight) {
      // try to place above the bubble
      if (rect.top - modalHeight - padding >= 0) {
        y = rect.top - modalHeight - padding;
      } else {
        // still not enough space: clamp inside viewport with small margin
        y = Math.max(padding, screenHeight - modalHeight - padding);
      }
    } else {
      // enough space below — but ensure not too close to top
      y = Math.max(padding, rect.top);
    }

    setActionModal({
      show: true,
      x: Math.round(x),
      y: Math.round(y),
      message,
    });
  };

  const closeActionModal = () =>
    setActionModal({ show: false, x: 0, y: 0, message: null });

  // click outside to close
  useEffect(() => {
    const closeOnOutside = (e) => {
      if (actionModal.show && !e.target.closest(".msg-action-modal")) {
        closeActionModal();
      }
    };
    window.addEventListener("click", closeOnOutside);
    return () => window.removeEventListener("click", closeOnOutside);
  }, [actionModal.show]);

  const handleDelete = async () => {
    const msg = actionModal?.message;
    if (!msg || !convoId || !msg.id) {
      closeActionModal?.();
      return;
    }

    // close the action modal immediately
    closeActionModal?.();

    // optimistic UI remove
    setMessages((prev) => prev.filter((m) => m.id !== msg.id));

    try {
      // delete the message document
      await deleteDoc(doc(db, "conversations", convoId, "messages", msg.id));

      // recompute conversation lastMessage by fetching the newest message (if any)
      const lastSnap = await getDocs(
        query(
          collection(db, "conversations", convoId, "messages"),
          orderBy("createdAt", "desc")
        )
      );

      if (!lastSnap.empty) {
        const lastDoc = lastSnap.docs[0];
        const last = lastDoc.data();
        const lastText =
          (last.text && last.text.trim()) ||
          (last.imageThumbUrl || last.imageFullUrl ? "📷 Photo" : "");
        await updateDoc(doc(db, "conversations", convoId), {
          lastMessage: lastText,
          lastMessageTime: last.createdAt || serverTimestamp(),
          updatedAt: serverTimestamp(),
        }).catch(() => {});
      } else {
        // no messages left in conversation
        await updateDoc(doc(db, "conversations", convoId), {
          lastMessage: "",
          lastMessageTime: serverTimestamp(),
          updatedAt: serverTimestamp(),
        }).catch(() => {});
      }

      showToast?.("Message deleted", "default", 1200);
    } catch (err) {
      console.error("Failed to delete message:", err);
      showToast?.("Failed to delete message", "default", 2000);

      // rollback / refresh: re-fetch whole messages list to ensure UI sync
      try {
        const snap = await getDocs(
          query(
            collection(db, "conversations", convoId, "messages"),
            orderBy("createdAt", "asc")
          )
        );
        const msgs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setMessages(msgs);
      } catch (e) {
        console.error("Failed to refresh messages after delete failure:", e);
      }
    }
  };

  const handleReply = (message) => {
    // message should be the message object (include id)
    if (!message) return;
    setReplyTo({
      id: message.id,
      sender: message.sender,
      text: message.text || null,
      imageThumbUrl: message.imageThumbUrl || null,
    });
    closeActionModal(); // optional: close the action modal after selecting reply
    // ensure input is focused (optional UX)
    setTimeout(() => {
      const el = document.querySelector('input[type="text"]');
      if (el) el.focus();
    }, 50);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(actionModal.message.text || "");
    showToast("Copied!", "default", 1000);
    closeActionModal();
  };
  const handleEdit = () => {
    console.log("Edit message:", actionModal.message);
    closeActionModal();
  };
  const handleForward = () => {
    console.log("Forward message:", actionModal.message);
    closeActionModal();
  };

  // file input ref (hidden)
  const fileInputRef = useRef(null);

  const sanitizeKey = (s = "") =>
    String(s)
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "_");

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
      await setDoc(
        doc(db, "currentUsers", currentEmail),
        { online: false, lastActive: serverTimestamp() },
        { merge: true }
      );
    } catch (err) {
      // ignore
    }
  };

  const comingSoon = () => {
    showToast("Sorry feature disabled!", "default", 1000);
  };

  // Manage presence
  useEffect(() => {
    if (!currentEmail) return;

    setMeOnline();
    presenceHeartbeatRef.current = setInterval(() => setMeOnline(), 30_000);

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") setMeOnline();
      else setMeOffline();
    };
    const onFocus = () => setMeOnline();
    const onBlur = () => setMeOffline();
    const onBeforeUnload = () => setMeOffline();

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
      setMeOffline();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentEmail]);

  // main listeners
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
                whatsappNumber: data.whatsappNumber,
              });
          } else {
            if (mounted)
              setOtherUser({
                email: otherKey,
                pin: otherKey,
                profilePic: null,
              });
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

        unsubMessages = onSnapshot(
          query(
            collection(db, "conversations", idCombined, "messages"),
            orderBy("createdAt", "asc")
          ),
          async (snap) => {
            const msgs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

            if (
              msgs.length > messages.length &&
              msgs[msgs.length - 1]?.sender !== currentEmail
            ) {
              receiveSoundRef.current.play().catch(() => {});
            }

            // Auto-update sent -> delivered
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

        // presence listener
        const ONLINE_THRESHOLD_MS = 90_000;
        unsubPresence = onSnapshot(
          doc(db, "currentUsers", otherKey),
          (snap) => {
            if (!mounted) return;
            if (!snap.exists()) {
              setIsOnline(false);
              return;
            }
            const data = snap.data() || {};
            let onlineFlag = !!data.online;
            const la = data.lastActive;
            let lastMs = 0;
            if (la) {
              if (typeof la.toDate === "function")
                lastMs = la.toDate().getTime();
              else if (la.seconds) lastMs = la.seconds * 1000;
              else {
                const parsed = new Date(la);
                if (!isNaN(parsed)) lastMs = parsed.getTime();
              }
            }
            const now = Date.now();
            const recent = lastMs && now - lastMs <= ONLINE_THRESHOLD_MS;
            const computedOnline = onlineFlag || recent;
            setIsOnline(Boolean(computedOnline));
          }
        );

        unsubTyping = onSnapshot(
          doc(db, "typingStatus", idCombined),
          (snap) => {
            if (!mounted) return;
            const data = snap.data();
            if (data && data.typing && data.user === otherKey)
              setIsTyping(true);
            else setIsTyping(false);
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

  // Auto-update delivered -> seen when chat is open
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
    if (isSystemConversation) {
      showToast?.("This conversation is readonly!", "default", 1400);
      return;
    }
    if (!convoId || !currentEmail) return;
    if (!messageText.trim() && !replyTo && !isUploading) return; // nothing to send

    try {
      const msg = {
        sender: currentEmail,
        text: messageText.trim() || "", // empty string allowed when replying only
        createdAt: serverTimestamp(),
        status: "sent",
      };

      // attach reply metadata if present
      if (replyTo) {
        // Keep this a plain object (no Firestore refs) so it serializes cleanly
        msg.replyTo = {
          id: replyTo.id,
          sender: replyTo.sender,
          text: replyTo.text || null,
          imageThumbUrl: replyTo.imageThumbUrl || null,
        };
      }

      await addDoc(collection(db, "conversations", convoId, "messages"), msg);
      sendSoundRef.current.play().catch(() => {});

      // update conversation metadata
      await updateDoc(doc(db, "conversations", convoId), {
        lastMessage: msg.text || "📷 Photo",
        lastMessageTime: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      // clear composer + reply preview after successful send
      setMessageText("");
      setReplyTo(null);
      await updateTypingStatus(false);
    } catch (err) {
      console.error("send message error:", err);
      showToast?.("Failed to send message", "error", 2000);
    } finally {
      // ensure uploading flag is reset in any case
      setIsUploading(false);
    }
  };
  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const cancelReply = () => {
    setReplyTo(null);
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
        return (
          <BsCheckAll className="inline text-green-600 text-lg font-bold" />
        );
      default:
        return null;
    }
  };

  // hidden file input click
  const onPickImageClick = () => {
    if (!convoId) {
      alert("Conversation not ready yet.");
      return;
    }
    if (fileInputRef.current) fileInputRef.current.click();
  };

  const onFileSelected = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      alert("Please choose an image file.");
      e.target.value = "";
      return;
    }

    try {
      setIsUploading(true);

      // prepare thumb and full blobs
      const thumbBlob = await resizeImageToBlob(file, 400, 0.7);
      const fullBlob = await resizeImageToBlob(file, 1400, 0.85);

      // Upload both (parallel)
      const [thumbUrl, fullUrl] = await Promise.all([
        uploadToUploadcare(thumbBlob),
        uploadToUploadcare(fullBlob),
      ]);

      // Save message with urls in Firestore
      const msg = {
        sender: currentEmail,
        text: "",
        imageThumbUrl: thumbUrl,
        imageFullUrl: fullUrl,
        createdAt: serverTimestamp(),
        status: "sent",
      };

      await addDoc(collection(db, "conversations", convoId, "messages"), msg);
      sendSoundRef.current.play().catch(() => {});

      await updateDoc(doc(db, "conversations", convoId), {
        lastMessage: "📷 Photo",
        lastMessageTime: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      // clear file input so same file can be picked again
      e.target.value = "";
    } catch (err) {
      console.error("Image upload/send error:", err);
      alert("Failed to upload/send image.");
    } finally {
      setIsUploading(false);
    }
  };
  const canSend = messageText.trim().length > 0 || !!replyTo || isUploading;

  // -----------------------
  // Modals (profile + image)
  // -----------------------
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") {
        if (showPicModal) setShowPicModal(false);
        if (imageModalUrl) setImageModalUrl(null);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [showPicModal, imageModalUrl]);

  const onProfileClick = () => {
    if (!otherUser?.profilePic) return;
    setShowPicModal(true);
  };
  const closePicModal = () => setShowPicModal(false);

  const openImageModal = (url) => setImageModalUrl(url);
  const closeImageModal = () => setImageModalUrl(null);

  // WhatsApp helper (send last message)
  const handleWhatsAppClick = async () => {
    try {
      let number = otherUser?.whatsappNumber;
      if (!number) {
        const uSnap = await getDoc(doc(db, "users", otherKey));
        if (uSnap.exists()) number = uSnap.data()?.whatsappNumber;
      }
      if (!number) {
        showToast(
          `${otherUser.pin} does not have whatsap number set!`,
          "default",
          1500
        );
        return;
      }
      const last = messages.length ? messages[messages.length - 1] : null;
      let text = "Hi!";
      if (last) {
        if (last.text && last.text.trim()) text = last.text;
        else if (last.imageThumbUrl || last.imageFullUrl) text = "📷 Photo";
        else text = last.text || "Hi!";
      }
      const digits = number.replace(/[^\d]/g, "");
      if (!digits) {
        alert("Invalid WhatsApp number.");
        return;
      }
      const encoded = encodeURIComponent(text);
      const url = `https://wa.me/${digits}?text=${encoded}`;
      window.open(url, "_blank");
    } catch (err) {
      console.error("WhatsApp open error:", err);
      alert("Unable to open WhatsApp.");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <p className="text-gray-500">Loading chat...</p>
      </div>
    );
  }
  const messageAreaStyle = chatBgUrl
    ? {
        backgroundImage: `url(${chatBgUrl})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
      }
    : {};
  return (
    <div className="flex flex-col h-screen bg-white text-black">
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        onChange={onFileSelected}
      />

      {/* Header */}
      <div className="sticky top-0 z-50 backdrop-blur-md bg-white/30 border-b border-gray-100">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate(-1)} className="pr-1">
              <FaChevronLeft className="text-lg text-purple-700" />
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
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="flex items-center justify-center w-full h-full text-gray-400">
                  <FaUser className="text-purple-500 " />
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
                {isOnline ? "Active" : "In-active"}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4 text-purple-600">
            <button
              onClick={handleWhatsAppClick}
              title="Send last message via WhatsApp"
              className="p-1"
            >
              <FaWhatsapp className="text-xl text-green-500" />
            </button>

            <FaBullhorn className="text-xl" />
            <button
              onClick={() =>
                navigate(
                  `/callerscreen/${encodeURIComponent(
                    otherUser?.pin || otherUser?.email
                  )}`,
                  { state: { receiver: { profilleImage: otherUser?.profile } } }
                )
              }
            >
              <FaPhoneAlt className="text-xl" />
            </button>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div
        className="flex-1 overflow-y-auto px-4 py-3 space-y-3 cursor-default"
        style={messageAreaStyle}
      >
        {messages.length === 0 && (
          <div className="py-10 text-center text-gray-400 cursor-pointer">
            No messages yet. Send a chirp!
          </div>
        )}
        {replyTo && (
          <div className="quoted bg-white/10 px-2 py-1 rounded-md mb-2 text-xs text-gray-200">
            <div className="font-semibold text-[10px] mb-0">
              {replyTo.sender}
            </div>
            <div className="truncate">
              {replyTo.text
                ? replyTo.text
                : replyTo.imageThumbUrl
                ? "📷 Photo"
                : ""}
            </div>
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
                onClick={(e) => handleBubbleClick(e, m)}
                onTouchStart={(e) => handleTouchStart(e, m.id)}
                onTouchEnd={(e) => handleTouchEnd(e, m)}
                className={`no-select-touch relative px-4 py-2 rounded-2xl max-w-[70%] animate-pop shadow-sm ${
                  isMe
                    ? "bg-gradient-to-br from-purple-700 to-purple-600 text-white rounded-br-none"
                    : "bg-purple-500 text-white rounded-bl-none"
                }`}
              >
                {/* Image message */}
                {m.imageThumbUrl ? (
                  <div
                    className="cursor-pointer"
                    onClick={() =>
                      openImageModal(m.imageFullUrl || m.imageThumbUrl)
                    }
                  >
                    <img
                      src={m.imageThumbUrl}
                      alt="sent"
                      className="w-full max-w-[320px] h-auto rounded-lg object-cover"
                    />
                  </div>
                ) : (
                  <div className="whitespace-pre-wrap">{m.text}</div>
                )}

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
      {actionModal.show && (
        <div
          className="msg-action-modal fixed z-50 bg-white shadow-lg rounded-xl p-2 flex flex-col gap-2 border border-gray-200 animate-slide-in"
          style={{
            top: `${actionModal.y}px`,
            left: `${actionModal.x}px`,
          }}
        >
          <button
            onClick={handleDelete}
            className="flex items-center gap-2 hover:bg-gray-100 p-2 rounded-md"
          >
            <FaTrash className="text-red-500" /> Delete
          </button>
          <button
            onClick={() => handleReply(actionModal.message)}
            className="flex items-center gap-2 hover:bg-gray-100 p-2 rounded-md"
          >
            <FaReply className="text-blue-500" /> Reply
          </button>
          <button
            onClick={handleCopy}
            className="flex items-center gap-2 hover:bg-gray-100 p-2 rounded-md"
          >
            <FaCopy className="text-gray-600" /> Copy
          </button>
          <button
            onClick={handleEdit}
            className="flex items-center gap-2 hover:bg-gray-100 p-2 rounded-md"
          >
            <FaEdit className="text-green-500" /> Edit
          </button>
          <button
            onClick={handleForward}
            className="flex items-center gap-2 hover:bg-gray-100 p-2 rounded-md"
          >
            <FaShare className="text-purple-500" /> Forward
          </button>
        </div>
      )}

      {/* Reply preview */}
      {replyTo && (
        <div className="mb-2 px-3 py-2 rounded-lg bg-gray-50 border-l-4 border-purple-500 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-xs text-gray-500">{passedOtherUser?.pin}</div>
            <div className="text-sm text-gray-800 truncate max-w-[280px]">
              {replyTo.text
                ? replyTo.text
                : replyTo.imageThumbUrl
                ? "📷 Photo"
                : ""}
            </div>
          </div>
          <button
            onClick={cancelReply}
            aria-label="Cancel reply"
            className="text-gray-400 hover:text-gray-600 ml-2"
          >
            ✕
          </button>
        </div>
      )}

      {/* Input */}
      <div className="sticky bottom-0 bg-white border-t px-3 py-2">
        <div className="flex items-center gap-3">
          {/* image pick button */}
          <button onClick={comingSoon}>
            <FaImage className="text-xl text-purple-600" />
          </button>
          <button
            onClick={openGamePicker}
            disabled={isSystemConversation}
            title="Play a game"
          >
            <FaGamepad
              className={`text-xl ${
                isSystemConversation ? "text-gray-300" : "text-purple-600"
              }`}
            />
          </button>

          <input
            type="text"
            placeholder="Type chirps..."
            value={messageText}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            className="flex-1 px-4 py-2 rounded-full border border-purple-400 focus:outline-none"
          />
          {/* before return (or just above JSX) you can add:
   const canSend = messageText.trim().length > 0 || !!replyTo || isUploading;
*/}
          <button
            onClick={handleSend}
            className={`p-3 rounded-full ${
              canSend ? "bg-purple-600 text-white" : "bg-gray-200 text-gray-400"
            }`}
            disabled={!canSend}
          >
            <FaPaperPlane />
          </button>
        </div>
      </div>

      {showGamePicker && (
        <div
          className="fixed inset-0 bg-black/50 z-90"
          onClick={closeGamePicker}
        >
          <div
            className="absolute bottom-0 left-0 right-0 bg-white rounded-t-2xl p-4 max-h-[75vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-lg font-semibold">Pick a Game</h3>
              <button onClick={closeGamePicker} className="text-gray-500">
                Close
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {gamesList.map((g) => (
                <button
                  key={g.id}
                  onClick={() => startGame(g)} // <-- pass the local object
                  className="rounded-xl overflow-hidden shadow hover:shadow-lg"
                >
                  <div className="w-full aspect-[4/3] bg-gray-200 overflow-hidden">
                    {g.thumbnail ? (
                      <img
                        src={g.thumbnail}
                        alt={g.title}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        🎮
                      </div>
                    )}
                  </div>
                  <div className="p-2">
                    <div className="text-sm font-semibold truncate">
                      {g.title}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeGame && (
        <div className="bg-black/60 rounded-lg overflow-hidden mb-3 border border-purple-300">
          <div className="flex items-center justify-between bg-purple-600 text-white px-3 py-2">
            <div className="text-sm font-semibold truncate">
              {activeGame.title}
            </div>
            <button
              onClick={endGame}
              className="text-xs px-2 py-1 bg-white/20 rounded"
            >
              ✖ End
            </button>
          </div>
          <iframe
            src={activeGame.url}
            title={activeGame.title}
            className="w-full h-[320px] sm:h-[380px] border-0"
            allow="autoplay; fullscreen; clipboard-read; clipboard-write; gamepad *"
            allowFullScreen
            loading="lazy"
            referrerPolicy="no-referrer"
          />
          
        </div>
      )}

      <style>{`

      
@keyframes sheetUp { from { transform: translateY(12%); opacity: .6; } to { transform: translateY(0); opacity: 1; } }
        @keyframes pop {
          0% { transform: scale(0.94); opacity: 0; }
          60% { transform: scale(1.02); opacity: 1; }
          100% { transform: scale(1); opacity: 1; }
        }
        .animate-pop { animation: pop 220ms cubic-bezier(.2,.9,.3,1) both; }

        @keyframes blink {
          0%, 80%, 100% { transform: scale(0.8); opacity: 0.4; }
          40% { transform: scale(1); opacity: 1; }
        }
        .dot { width: 6px; height: 6px; background-color: white; border-radius: 50%; display: inline-block; animation: blink 1.4s infinite both; }
        .dot:nth-child(1) { animation-delay: 0s; } .dot:nth-child(2) { animation-delay: 0.2s; } .dot:nth-child(3) { animation-delay: 0.4s; }

        @keyframes zoomIn {
          0% { transform: scale(0.88); opacity: 0; }
          60% { transform: scale(1.02); opacity: 1; }
          100% { transform: scale(1); opacity: 1; }
        }

        @keyframes slideIn {
  0% { transform: translateY(-8px); opacity: 0; }
  100% { transform: translateY(0); opacity: 1; }
}
.animate-slide-in {
  animation: slideIn 200ms ease-out forwards;
}

 .msg-action-modal {
  pointer-events: auto;
  max-height: calc(100vh - 48px); /* leave some margin for status bar / keyboard */
  overflow-y: auto;
  box-sizing: border-box;
  width: 180px; /* match modalWidth used in positioning */
}

/* make bubbles more responsive on mobile */
.no-select-touch {
  -webkit-user-select: none;
  -ms-user-select: none;
  user-select: none;
  -webkit-tap-highlight-color: transparent;
  touch-action: manipulation;
}
      `}</style>
    </div>
  );
}
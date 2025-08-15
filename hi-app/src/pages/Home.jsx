// src/pages/ChatList.jsx
import { useEffect, useState, useRef } from "react";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  deleteDoc,
  writeBatch,
  limit,
  startAfter,
  updateDoc,
  where,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../firebase";
import { useNavigate } from "react-router-dom";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import { FiMoreVertical, FiRefreshCw, FiSearch, FiArchive } from "react-icons/fi";
import { FaUser, FaTrash, FaFile, FaShare, FaLock, FaLockOpen, FaScroll, FaInfo , FaEnvelopeOpen} from "react-icons/fa";
import BottomTab from "../components/BottomTab";
import { useProfile } from "../contexts/ProfileContext";
import { FaTimes } from "react-icons/fa";
import ConversationRow from "../components/ConversationRow";

dayjs.extend(relativeTime);

export default function ChatList() {
  const { profile, loading } = useProfile();
  const [conversations, setConversations] = useState([]);
  const [enriched, setEnriched] = useState([]); // conversations merged with other user data
  const [showMenu, setShowMenu] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [isClosing, setIsClosing] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const navigate = useNavigate();
  const userCacheRef = useRef(new Map()); 
  const [archivedCount, setArchivedCount] = useState(0);
  const [accountPrivacy, setAccountPrivacy] = useState(profile?.accountPrivacy || "unlocked")


  useEffect(() => {
    setAccountPrivacy(profile?.accountPrivacy || "unlocked");
  }, [profile?.accountPrivacy]);

  // toggle account privacy in Firestore (optimistic UI)
  const toggleAccountPrivacy = async () => {
    if (!profile?.email) return;
    const prev = accountPrivacy;
    const next = prev === "locked" ? "unlocked" : "locked";

    // optimistic UI
    setAccountPrivacy(next);

    try {
      await updateDoc(doc(db, "users", profile.email), {
        accountPrivacy: next,
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      console.error("Failed to update account privacy:", err);
      // revert UI on failure
      setAccountPrivacy(prev);
    } finally {
      // close the menu so user sees immediate feedback
      setShowMenu(false);
    }
  };


  // pointer / drag state
  const pointerStartXRef = useRef(null);
  const activePointerIdRef = useRef(null);
  const [activeDrag, setActiveDrag] = useState(null); // { id, delta }
  const [swipedId, setSwipedId] = useState(null); // persistent partial swipe reveal

  // long-press state/refs (for mobile)
  const longPressTimerRef = useRef(null);
  const longPressStartYRef = useRef(0);
  const longPressMovedRef = useRef(false);
  const [actionModalFor, setActionModalFor] = useState(null); // conversation id for long-press actions

  const clearLongPressTimer = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    longPressMovedRef.current = false;
    longPressStartYRef.current = 0;
  };

  const startLongPress = (e, id) => {
    // Only start long-press for touch inputs (avoid desktop mouse long-press)
    const isTouchPointer =
      // PointerEvent (React) will have pointerType
      (e.pointerType && e.pointerType === "touch") ||
      // fallback for touchstart (if any)
      (e.touches && e.touches[0]);

    if (!isTouchPointer) return;

    longPressMovedRef.current = false;
    longPressStartYRef.current = e.clientY ?? (e.touches?.[0]?.clientY ?? 0);

    // 600ms long press
    longPressTimerRef.current = setTimeout(() => {
      if (!longPressMovedRef.current) {
        // open action modal for this conversation
        setActionModalFor(id);
        // cancel any active drag state
        pointerStartXRef.current = null;
        activePointerIdRef.current = null;
        setActiveDrag(null);
        setSwipedId(null);
      }
      longPressTimerRef.current = null;
    }, 600);
  };

  const moveLongPress = (e) => {
    // If long-press not started, nothing to do.
    if (!longPressTimerRef.current) return;

    const currentY = e.clientY ?? (e.touches?.[0]?.clientY ?? null);
    if (currentY == null) return;
    if (Math.abs(currentY - longPressStartYRef.current) > 10) {
      longPressMovedRef.current = true;
      clearLongPressTimer();
    }
  };

  const endLongPress = () => {
    clearLongPressTimer();
  };

  const closeModal = () => {
    setIsClosing(true);
    setTimeout(() => {
      setShowProfileModal(false);
      setIsClosing(false);
    }, 250); // match animation duration
  };

  useEffect(() => {
    if (!profile?.email) {
      setArchivedCount(0);
      return;
    }
    const q = query(
      collection(db, "conversations"),
      where("participants", "array-contains", profile.email),
      where("archived", "==", true)
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        setArchivedCount(snap.size || 0);
      },
      (err) => {
        console.error("Archived count listener error:", err);
        setArchivedCount(0);
      }
    );

    return () => unsub();
  }, [profile?.email]);

  

  const currentUser = {
    pin: profile?.pin || "",
    profilePic: profile?.profilePic || "/default-profile.png",
    email: profile?.email || null,
  };

  // subscribe to conversations (exclude archived by default in UI)
  useEffect(() => {
    const q = query(collection(db, "conversations"), orderBy("updatedAt", "desc"));
    const unsub = onSnapshot(q, (snapshot) => {
      const convos = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
      // hide archived conversations from main list
      const visible = convos.filter((c) => !c.archived);
      const filtered = profile?.email
        ? visible.filter((c) => !c.participants || c.participants.includes(profile.email))
        : visible;
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

    const myEmail = profile?.email;
    if (!myEmail) {
      setEnriched(conversations.map((c) => ({ ...c })));
      return;
    }

    (async () => {
      try {
        const toFetch = new Set();
        const convosToResolve = conversations.map((c) => {
          let otherEmail = null;

          if (Array.isArray(c.participants) && c.participants.length > 0) {
            otherEmail = c.participants.find((p) => p !== myEmail);
          }

          if (!otherEmail) {
            if (c.otherUserEmail) otherEmail = c.otherUserEmail;
            else if (c.otherUserId) otherEmail = c.otherUserId;
          }

          if (otherEmail && !userCacheRef.current.has(otherEmail)) toFetch.add(otherEmail);
          return { ...c, otherEmail };
        });

        if (toFetch.size > 0) {
          const promises = Array.from(toFetch).map(async (email) => {
            try {
              const userDocRef = doc(db, "users", email);
              const snap = await getDoc(userDocRef);
              if (snap.exists()) {
                userCacheRef.current.set(email, snap.data());
                return { email, data: snap.data() };
              } else {
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

  // delete conversation including messages subcollection in paged batches
  const deleteConversationWithMessages = async (conversationId) => {
    // Optimistic UI removal
    setConversations((prev) => prev.filter((c) => c.id !== conversationId));
    setEnriched((prev) => prev.filter((c) => c.id !== conversationId));
    setSwipedId((id) => (id === conversationId ? null : id));
    setConfirmDeleteId(null);

    try {
      const messagesColRef = collection(db, "conversations", conversationId, "messages");
      let last = null;
      const pageSize = 500;

      while (true) {
        // order by createdAt (reliable message timestamp)
        const qArgs = [messagesColRef, orderBy("createdAt"), limit(pageSize)];
        if (last) qArgs.push(startAfter(last));
        const q = query(...qArgs);
        const snap = await getDocs(q);
        if (snap.empty) break;

        const batch = writeBatch(db);
        snap.docs.forEach((d) => {
          batch.delete(doc(db, "conversations", conversationId, "messages", d.id));
        });
        await batch.commit();
        last = snap.docs[snap.docs.length - 1];
        if (snap.docs.length < pageSize) break;
      }

      // finally delete the conversation doc
      await deleteDoc(doc(db, "conversations", conversationId));
    } catch (err) {
      console.error("Failed to delete conversation and messages:", err);
      // optional: re-fetch if needed
    }
  };

  // archive conversation (mark archived: true)
  const archiveConversation = async (conversationId) => {
    // optimistic removal from UI
    setConversations((prev) => prev.filter((c) => c.id !== conversationId));
    setEnriched((prev) => prev.filter((c) => c.id !== conversationId));
    setSwipedId((id) => (id === conversationId ? null : id));

    try {
      await updateDoc(doc(db, "conversations", conversationId), {
        archived: true,
        archivedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      // optional: update a badge count in localStorage so other UI pieces can react
      try {
        const prevCount = Number(localStorage.getItem("archivedCount") || 0);
        localStorage.setItem("archivedCount", String(prevCount + 1));
        // you may also dispatch a custom event so other parts of app can listen
        window.dispatchEvent(new CustomEvent("archive:updated", { detail: { count: prevCount + 1 } }));
      } catch (err) {
        // ignore storage errors
      }
    } catch (err) {
      console.error("Failed to archive conversation:", err);
      // optional: re-fetch list
    }
  };

  // pointer/touch handlers
  const handlePointerDown = (e, id) => {
    // support pointer and touch
    const clientX = e.clientX ?? (e.touches?.[0]?.clientX ?? null);
    pointerStartXRef.current = clientX;
    activePointerIdRef.current = id;

    // Make sure we're not leaving stale drag state
    setActiveDrag({ id, delta: 0 });

    // Start long press only for touch pointers
    startLongPress(e, id);
  };

  const handlePointerMove = (e, id, rowRef) => {
    // move long-press detection if applicable
    moveLongPress(e);

    if (activePointerIdRef.current !== id) return;
    const startX = pointerStartXRef.current;
    if (startX == null) return;
    const currentX = e.clientX ?? (e.touches?.[0]?.clientX ?? null);
    if (currentX == null) return;
    let delta = currentX - startX; // right swipe => positive
    // clamp - allow some left drag but we mainly support right swipes
    if (delta < 0) delta = 0;
    // limit delta so row doesn't fly away
    const maxDelta = (rowRef?.current?.offsetWidth || window.innerWidth) * 0.9;
    if (delta > maxDelta) delta = maxDelta;

    // if user starts dragging, cancel long press
    if (Math.abs(delta) > 8) {
      longPressMovedRef.current = true;
      clearLongPressTimer();
    }

    setActiveDrag({ id, delta });
  };

  const handlePointerUp = (e, id, rowRef) => {
    // always clear long-press timer when pointer is lifted
    endLongPress();

    const active = activeDrag;
    pointerStartXRef.current = null;
    activePointerIdRef.current = null;

    if (!active || active.id !== id) {
      setActiveDrag(null);
      return;
    }

    const delta = active.delta || 0;
    const rowWidth = rowRef?.current?.offsetWidth || window.innerWidth;
    // Full-swipe threshold: 50% of row or 140px
    const fullThreshold = Math.min(140, rowWidth * 0.5);
    // Partial reveal threshold
    const partialThreshold = 60;

    if (delta >= fullThreshold) {
      // Trigger confirm delete automatically on full swipe
      setActiveDrag(null);
      setConfirmDeleteId(id);
      setSwipedId(null);
      return;
    }

    if (delta >= partialThreshold) {
      // Keep revealed state
      setSwipedId(id);
    } else {
      // Reset
      setSwipedId(null);
    }

    setActiveDrag(null);
  };

  // helper row ref map to read width per row
  const rowRefs = useRef(new Map());
  const getRowRef = (id) => {
    if (!rowRefs.current.has(id)) rowRefs.current.set(id, { current: null });
    return rowRefs.current.get(id);
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
            {currentUser.profilePic ? (
              <img
                src={currentUser.profilePic}
                alt="Me"
                className="w-10 h-10 rounded-full object-cover border border-white"
              />
            ) : (
              <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center border border-white">
                <FaUser className="text-purple-600" />
              </div>
            )}
          </div>
          <span className="font-extrabold text-purple-700">
            {currentUser.pin}
          </span>
        </div>
        <div className="flex items-center gap-4 text-gray-600">
          {/* Archive button + badge (replace your existing FiArchive + badge block) */}
          <div className="relative">
            <button
              onClick={() => navigate("/archived")}
              title="Archived"
              className="p-1 rounded-full relative z-10"
              aria-label="Open archived chats"
            >
              <FiArchive className="text-xl text-purple-600 font-bold" />
            </button>

            {archivedCount > 0 && (
              <span
                className="absolute -top-1 -right-1 z-20 inline-flex items-center justify-center bg-red-600 text-white text-xs font-bold rounded-full px-1.5 py-0.5 leading-none shadow"
                aria-hidden="true"
              >
                {archivedCount}
              </span>
            )}
          </div>
          <FiMoreVertical
            className="text-xl text-purple-600 font-bold cursor-pointer"
            onClick={() => setShowMenu((prev) => !prev)}
          />
        </div>
      </div>

      {/* Action menu modal */}
      {showMenu && (
        <div className="absolute top-14 right-4 bg-white rounded-lg shadow-lg p-3 w-44 z-50 animate-fadeIn">
          <button className="w-full text-left text-purple-500 px-2 py-2 hover:bg-purple-50 flex items-center gap-2">
            <FaFile />
            Report
          </button>

          <button className="w-full text-left text-purple-500 px-2 py-2 hover:bg-purple-50 flex items-center gap-2">
            <FaShare />
            Share
          </button>
          <button
            onClick={toggleAccountPrivacy}
            className="w-full text-left text-purple-500 px-2 py-2 hover:bg-purple-50 flex items-center gap-2"
          >
            {accountPrivacy === "locked" ? <FaLockOpen /> : <FaLock />}
            {accountPrivacy === "locked" ? "Unlock Account" : "Lock Account"}
          </button>
          <button className="w-full text-left text-purple-500 px-2 py-2 hover:bg-purple-50 flex items-center gap-2">
            <FaScroll />
            Privacy Policy
          </button>
          <button className="w-full text-left text-purple-500 px-2 py-2 hover:bg-purple-50 flex items-center gap-2">
            <FaInfo />
            About Us
          </button>
          <button className="w-full text-left text-purple-500 px-2 py-2 hover:bg-purple-50 flex items-center gap-2">
            <FaEnvelopeOpen />
            Contact Us
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
            className={`relative ${
              isClosing ? "animate-zoomOut" : "animate-zoomIn"
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={currentUser.profilePic}
              alt="Profile Large"
              className="w-72 h-72 rounded-full object-cover shadow-lg border-4 border-purple-500"
            />
            <button
              className="absolute -top-4 -right-4 w-8 h-8 bg-white text-purple-700 rounded-full p-2 shadow hover:bg-purple-100 transition"
              onClick={closeModal}
            >
              {/* small close X */}
              <FaTimes />
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
            const otherPic = chat.otherUserPic || null; // null triggers FaUser fallback
            const otherPin =
              chat.otherUserPin || chat.otherUserEmail || "UNKNOWN";
            const targetParam = encodeURIComponent(
              chat.otherUserEmail || chat.otherUserId || chat.id
            );
            const rowRef = getRowRef(chat.id);

            // compute transform based on activeDrag or swipedId
            let translateX = 0;
            if (activeDrag?.id === chat.id) {
              translateX = Math.min(
                activeDrag.delta,
                (rowRef?.current?.offsetWidth || window.innerWidth) * 0.9
              );
            } else if (swipedId === chat.id) {
              translateX = 96; // persistent reveal amount to make space for two icons
            } else {
              translateX = 0;
            }

            // when revealed, show both archive + delete buttons (left side)
            const showActions =
              (activeDrag?.id === chat.id && activeDrag.delta > 30) ||
              swipedId === chat.id;

            return (
              <div
                key={chat.id}
                className="relative group"
                onPointerDown={(e) => handlePointerDown(e, chat.id)}
                onPointerMove={(e) => handlePointerMove(e, chat.id, rowRef)}
                onPointerUp={(e) => handlePointerUp(e, chat.id, rowRef)}
                onPointerCancel={() => {
                  pointerStartXRef.current = null;
                  activePointerIdRef.current = null;
                  setActiveDrag(null);
                  endLongPress();
                }}
              >
                {/* Archive button (left side top) */}
                <button
                  aria-label="Archive conversation"
                  onClick={(ev) => {
                    ev.stopPropagation();
                    archiveConversation(chat.id);
                  }}
                  className={`absolute left-3 top-1/2 transform -translate-y-[120%] z-20 shadow text-white p-3 rounded-full transition-all duration-150 ${
                    showActions
                      ? "opacity-100 translate-y-[-0.75rem] bg-yellow-600"
                      : "opacity-0 md:group-hover:opacity-100 bg-yellow-600"
                  }`}
                >
                  <FiArchive className="w-4 h-4" />
                </button>

                {/* Delete button (left side bottom) */}
                <button
                  aria-label="Delete conversation"
                  onClick={(ev) => {
                    ev.stopPropagation();
                    setConfirmDeleteId(chat.id);
                    setSwipedId(null);
                  }}
                  className={`absolute left-3 top-1/2 transform translate-y-[8%] z-20 shadow text-white p-3 rounded-full transition-all duration-150 ${
                    showActions
                      ? "opacity-100 bg-red-600"
                      : "opacity-0 md:group-hover:opacity-100 bg-red-600"
                  }`}
                >
                  <FaTrash />
                </button>

                {/* clickable row; translates right when swiped right */}
                <div
                  ref={(el) => {
                    const r = getRowRef(chat.id);
                    if (r) r.current = el;
                  }}
                  onClick={() => {
                    // if currently revealed, dismiss on click; else navigate
                    if (actionModalFor === chat.id) {
                      // if action modal is open for this id, don't navigate
                      return;
                    }
                    if (swipedId === chat.id) {
                      setSwipedId(null);
                      return;
                    }
                    navigate(`/chat/${targetParam}`, {
                      state: {
                        otherUser: {
                          email: chat.otherUserEmail,
                          pin: chat.otherUserPin,
                          profilePic: chat.otherUserPic,
                        },
                      },
                    });
                  }}
                  // Also add touch move/end events to manage long-press correctly (extra safety)
                  onTouchMove={(e) => moveLongPress(e)}
                  onTouchEnd={() => endLongPress()}
                  className="no-select-touch flex items-center justify-between p-3 rounded-lg shadow-md bg-gray-50 hover:bg-purple-50 transition-all duration-150 cursor-pointer"
                  style={{
                    transform: `translateX(${translateX}px)`,
                    transition:
                      activeDrag?.id === chat.id
                        ? "none"
                        : "transform 160ms ease",
                  }}
                >
                  <div className="flex items-center">
                    {otherPic ? (
                      <img
                        src={otherPic}
                        alt="Profile"
                        className="w-12 h-12 rounded-full border border-purple-300 object-cover"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center border border-purple-300">
                        <FaUser className="text-purple-600" />
                      </div>
                    )}
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
              </div>
            );
          })}
      </div>

      {/* Bottom Tab */}
      {!actionModalFor && (
        <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-200">
          <BottomTab />
        </div>
      )}

      {/* Confirm delete modal */}
      {confirmDeleteId && (
        <div
          className="fixed inset-0 z-60 flex items-center justify-center bg-black/50"
          onClick={() => setConfirmDeleteId(null)}
        >
          <div
            className="bg-white rounded-lg p-5 w-[90%] max-w-md shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold mb-2">Delete conversation?</h3>
            <p className="text-sm text-gray-600 mb-4">
              This will permanently delete the conversation and all messages.
              This cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button
                className="px-4 py-2 rounded-lg bg-gray-100 text-gray-700"
                onClick={() => setConfirmDeleteId(null)}
              >
                Cancel
              </button>
              <button
                className="px-4 py-2 rounded-lg bg-red-600 text-white"
                onClick={() => deleteConversationWithMessages(confirmDeleteId)}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Long-press action modal (mobile) */}
      {actionModalFor && (
        <div
          className="fixed inset-0 z-70 flex items-end justify-center"
          onClick={() => {
            // clicking backdrop closes modal
            setActionModalFor(null);
          }}
        >
          {/* semi-transparent backdrop */}
          <div className="absolute inset-0 bg-black/40" />

          {/* bottom action sheet */}
          <div
            className="relative w-full max-w-md bg-white rounded-t-xl shadow-xl p-4 z-80"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="font-semibold">Conversation actions</p>
                <p className="text-xs text-gray-500">
                  Archive or delete this conversation
                </p>
              </div>
              <button
                className="text-gray-500"
                onClick={() => {
                  setActionModalFor(null);
                }}
              >
                <FaTimes />
              </button>
            </div>

            <div className="flex gap-3 justify-center">
              <button
                onClick={() => {
                  archiveConversation(actionModalFor);
                  setActionModalFor(null);
                }}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-yellow-500 text-white"
              >
                <FiArchive />
                Archive
              </button>

              <button
                onClick={() => {
                  // open confirm delete so user still confirms delete
                  setConfirmDeleteId(actionModalFor);
                  setActionModalFor(null);
                }}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-600 text-white"
              >
                <FaTrash />
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* small CSS animations if you want to tune them */}
      <style>{`
        @keyframes zoomIn {
          0% { transform: scale(0.9); opacity: 0; }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes zoomOut {
          0% { transform: scale(1); opacity: 1; }
          100% { transform: scale(0.9); opacity: 0; }
        }
        .animate-zoomIn { animation: zoomIn 200ms ease both; }
        .animate-zoomOut { animation: zoomOut 180ms ease both; }

        /* small fade in for the menu if needed */
        @keyframes fadeIn { from { opacity: 0; transform: translateY(-4px);} to { opacity: 1; transform: translateY(0);} }
        .animate-fadeIn { animation: fadeIn 140ms ease both; }

        /* Optional: Slightly larger touch targets on mobile for the action buttons */
        @media (hover: none) and (pointer: coarse) {
          .action-touch { padding: 12px; width: 46px; height: 46px; }
        }
      `}</style>
    </div>
  );
}
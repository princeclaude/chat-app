// src/pages/Explore.jsx
import React, { useState, useEffect, useRef } from "react";
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  getDoc,
  addDoc,
  serverTimestamp,
  onSnapshot,
  orderBy,
  startAt,
  endAt,
  limit
} from "firebase/firestore";
import { db } from "../firebase";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import BottomTab from "../components/BottomTab";
import { FaUser } from "react-icons/fa";
import { useProfile } from "../contexts/ProfileContext"; // to capture requester info if available

export default function Explore() {
  const { profile } = useProfile(); // may be undefined while loading
  const [pin, setPin] = useState("");
  const [userResult, setUserResult] = useState(null);

  const [suggestions, setSuggestions] = useState([]); // array of user docs
  const suggestionsUnsubRef = useRef(null); // to keep current onSnapshot unsubscribe
  const debounceRef = useRef(null);
  const [loading, setLoading] = useState(false);
  const [searchTriggered, setSearchTriggered] = useState(false);
  const navigate = useNavigate();

  // locked-account modal state
  const [showLockedModal, setShowLockedModal] = useState(false);
  const [lockedUser, setLockedUser] = useState(null);
  const [requesting, setRequesting] = useState(false);
  const [requestSent, setRequestSent] = useState(false);

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

  // real-time suggestions for pin prefix as user types
  useEffect(() => {
    // clean previous debounce/listener
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
    if (suggestionsUnsubRef.current) {
      suggestionsUnsubRef.current();
      suggestionsUnsubRef.current = null;
    }

    const prefix = (pin || "").toUpperCase().trim();
    if (!prefix) {
      setSuggestions([]);
      setSearchTriggered(false);
      setLoading(false);
      return;
    }

    // debounce to avoid firing on every keystroke
    debounceRef.current = setTimeout(() => {
      try {
        // Build a prefix range query on 'pin'
        // Requires ordering by pin for startAt/endAt to work
        const q = query(
          collection(db, "users"),
          orderBy("pin"),
          startAt(prefix),
          endAt(prefix + "\uf8ff"),
          limit(10)
        );

        setLoading(true);
        suggestionsUnsubRef.current = onSnapshot(
          q,
          async (snap) => {
            try {
              // map raw docs to shallow user objects
              const raw = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

              if (!raw || raw.length === 0) {
                setSuggestions([]);
                setLoading(false);
                setSearchTriggered(true);
                return;
              }

              // a small cancellation guard in case component unmounts while we're fetching
              let canceled = false;
              const unsubRef = suggestionsUnsubRef.current;
              // if unsubRef becomes null later, consider it canceled
              // (we can't directly detect unsubscribe here, so we check a flag after awaits)
              // NOTE: We'll re-check before setting state below.

              // Enrich each suggestion with presence, fresh user doc and conversation existence
              const enrichedPromises = raw.map(async (u) => {
                try {
                  // re-fetch latest user doc (to include accountPrivacy etc.)
                  const freshSnap = await getDoc(doc(db, "users", u.id)).catch(
                    () => null
                  );
                  const baseUser =
                    freshSnap && freshSnap.exists() ? freshSnap.data() : u;

                  // get presence info
                  const presenceSnap = await getDoc(
                    doc(db, "currentUsers", u.id)
                  ).catch(() => null);
                  const presence =
                    presenceSnap && presenceSnap.exists()
                      ? presenceSnap.data()
                      : {};

                  // check existing conversation (uses your helper)
                  const hasConversation = await checkConversationExists(u.id);

                  return {
                    id: u.id,
                    ...baseUser,
                    ...presence, // lastActive, online flags etc.
                    hasConversation: !!hasConversation,
                  };
                } catch (err) {
                  console.error("Failed to enrich suggestion for", u.id, err);
                  // fallback to the raw doc if any sub-fetch fails
                  return {
                    id: u.id,
                    ...u,
                    hasConversation: false,
                  };
                }
              });

              const enriched = await Promise.all(enrichedPromises);

              // If the snapshot listener was unsubscribed meanwhile, don't set state
              if (!suggestionsUnsubRef.current) {
                // listener gone -> component likely unmounted or q changed; abort
                return;
              }

              setSuggestions(enriched);
              setLoading(false);
              setSearchTriggered(true);
            } catch (err) {
              console.error("Suggestions onSnapshot error (enrich):", err);
              setLoading(false);
            }
          },
          (err) => {
            console.error("Suggestions onSnapshot error:", err);
            setLoading(false);
          }
        );
      } catch (err) {
        console.error("Suggestion query construction error:", err);
        setLoading(false);
      }
    }, 250); // 250ms debounce

    // cleanup when pin changes or component unmounts
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
        debounceRef.current = null;
      }
      if (suggestionsUnsubRef.current) {
        suggestionsUnsubRef.current();
        suggestionsUnsubRef.current = null;
      }
    };
  }, [pin]);



  const disableZoomTemporarily = () => {
    const meta = metaRef.current;
    if (!meta) return;
    // store original if not already stored
    if (originalViewportRef.current === null) {
      originalViewportRef.current = meta.getAttribute("content");
    }
    // set a viewport that disables zooming while typing/focus
    meta.setAttribute(
      "content",
      "width=device-width, initial-scale=1, maximum-scale=1, user-scalable=0"
    );
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

  // helper: check whether a conversation exists between current user and otherUserId
  const checkConversationExists = async (otherUserId) => {
    try {
      if (!profile?.email || !otherUserId) return false;
      // get conversations that include current user and check participants client-side for otherUserId
      const q = query(
        collection(db, "conversations"),
        where("participants", "array-contains", profile.email)
      );
      const snap = await getDocs(q);
      if (snap.empty) return false;
      for (const d of snap.docs) {
        const data = d.data();
        const participants = Array.isArray(data.participants)
          ? data.participants
          : [];
        // documents may store user id/email; compare directly
        if (participants.includes(otherUserId)) return true;
      }
      return false;
    } catch (err) {
      console.error("Failed to check conversation existence:", err);
      return false;
    }
  };

  const handleSearch = async () => {
    if (pin.length !== 5) return;
    setLoading(true);
    setSearchTriggered(true);
    setUserResult(null);

    try {
      // Step 1: Find user by PIN in "users"
      const q = query(
        collection(db, "users"),
        where("pin", "==", pin.toUpperCase())
      );
      const snap = await getDocs(q);

      if (!snap.empty) {
        const docSnap = snap.docs[0];
        const userId = docSnap.id;

        // Re-fetch the user document directly to ensure we have the latest fields (accountPrivacy etc.)
        const userDocRef = doc(db, "users", userId);
        const freshUserSnap = await getDoc(userDocRef);
        const baseUserData = freshUserSnap.exists()
          ? freshUserSnap.data()
          : docSnap.data();

        // Step 2: Get presence info from "currentUsers"
        const currentSnap = await getDoc(doc(db, "currentUsers", userId));
        let presenceData = {};
        if (currentSnap.exists()) {
          presenceData = currentSnap.data();
        }

        // Step 3: determine whether a conversation already exists (important: only if we have current profile)
        const hasConversation = await checkConversationExists(userId);

        // Merge both and include hasConversation flag
        setUserResult({
          id: userId,
          ...baseUserData,
          ...presenceData, // this will include lastActive if present
          hasConversation: !!hasConversation,
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

  // when user clicks the result row: check privacy (freshly) and whether a conversation exists
  const handleResultClick = async (user) => {
    try {
      // re-fetch user's doc to ensure latest accountPrivacy
      const userDocRef = doc(db, "users", user.id);
      const fresh = await getDoc(userDocRef);
      const freshData = fresh.exists() ? fresh.data() : {};
      const accountPrivacy = (
        freshData.accountPrivacy ||
        user.accountPrivacy ||
        ""
      )
        .toString()
        .toLowerCase();

      // check conversation existence live (so if a conversation was created meanwhile, we continue)
      const hasConversation = await checkConversationExists(user.id);

      // if there is already a conversation, always allow navigation (continue)
      if (hasConversation) {
        navigate(`/chat/${encodeURIComponent(user.id)}`, {
          state: { otherUser: { id: user.id, ...freshData, ...user } },
        });
        return;
      }

      // otherwise if the user's account is locked, show the request modal
      if (accountPrivacy === "locked") {
        setLockedUser({ id: user.id, ...freshData, ...user });
        setShowLockedModal(true);
        setRequestSent(false);
        return;
      }

      // default: open chat
      navigate(`/chat/${encodeURIComponent(user.id)}`, {
        state: { otherUser: { id: user.id, ...freshData, ...user } },
      });
    } catch (err) {
      console.error("Error on result click:", err);
      // fallback to navigate if something goes wrong
      try {
        navigate(`/chat/${encodeURIComponent(user.id)}`, {
          state: { otherUser: user },
        });
      } catch {}
    }
  };

  // send an access request doc to Firestore
  const sendAccessRequest = async () => {
    if (!lockedUser) return;
    setRequesting(true);
    try {
      await addDoc(collection(db, "accessRequests"), {
        requesterEmail: profile?.email || null,
        requesterPin: profile?.pin || null,
        receiverId: lockedUser.id,
        receiverPin: lockedUser.pin || null,
        status: "pending",
        createdAt: serverTimestamp(),
      });
      setRequestSent(true);
      // optionally auto-close after a short delay
      setTimeout(() => {
        setShowLockedModal(false);
        setLockedUser(null);
        setRequesting(false);
      }, 1400);
    } catch (err) {
      console.error("Failed to create access request:", err);
      setRequesting(false);
    }
  };

  return (
    <div
      className="flex flex-col h-screen bg-white text-black p-4"
      style={{ WebkitTextSizeAdjust: "100%", MsTextSizeAdjust: "100%" }}
    >
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

          {/* suggestions (real-time) */}
          {!loading && suggestions && suggestions.length > 0 && (
            <motion.div
              key="suggestions"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-2"
            >
              {suggestions.map((u) => (
                <motion.div
                  key={u.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  whileHover={{ scale: 1.01 }}
                  className="flex items-center gap-3 p-3 bg-gray-100 rounded-lg shadow-sm hover:bg-gray-200 transition cursor-pointer"
                  onClick={() => handleResultClick(u)}
                >
                  {u.profilePic ? (
                    <img
                      src={u.profilePic}
                      alt="profile"
                      className="w-12 h-12 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-gray-100 flex border-2 border-purple-700 items-center justify-center">
                      <FaUser className="text-purple-500" />
                    </div>
                  )}

                  <div>
                    <p className="font-bold text-purple-700">
                      {u.pin || "UNKNOWN"}
                    </p>
                    <p className="text-sm text-gray-500">
                      Last active: {formatLastActive(u.lastActive)}
                    </p>
                    {u.accountPrivacy && (
                      <p className="text-xs mt-1">
                        <strong>Privacy:</strong> {String(u.accountPrivacy)}
                      </p>
                    )}
                    {u.hasConversation && (
                      <p className="text-xs text-green-600 mt-1">
                        Chirped! - tap to continue.
                      </p>
                    )}
                    
                  </div>
                </motion.div>
              ))}
            </motion.div>
          )}

          {/* single explicit result (keeps existing behavior if you still use handleSearch) */}
          {!loading && userResult && suggestions.length === 0 && (
            <motion.div
              key="result"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              whileHover={{ scale: 1.02 }}
              className="flex items-center gap-3 p-3 bg-gray-100 rounded-lg shadow-sm hover:bg-gray-200 transition cursor-pointer"
              onClick={() => handleResultClick(userResult)}
            >
              {userResult.profilePic ? (
                <img
                  src={userResult.profilePic}
                  alt="profile"
                  className="w-12 h-12 rounded-full object-cover"
                />
              ) : (
                <div className="w-12 h-12 rounded-full bg-gray-100 flex border-2 border-purple-700 items-center justify-center">
                  <FaUser className="text-purple-500" />
                </div>
              )}
              <div>
                <p className="font-bold text-purple-700">{userResult.pin}</p>
                <p className="text-sm text-gray-500">
                  Last active: {formatLastActive(userResult.lastActive)}
                </p>
                {userResult.accountPrivacy && (
                  <p className="text-xs mt-1">
                    <strong>Privacy:</strong>{" "}
                    {String(userResult.accountPrivacy)}
                  </p>
                )}
                {userResult.hasConversation && (
                  <p className="text-xs text-green-600 mt-1">
                    Chirped! - tap to continue.
                  </p>
                )}
              </div>
            </motion.div>
          )}

          {/* show "No user found" when user explicitly searched, or when there are no suggestions AND user typed */}
          {!loading &&
            suggestions.length === 0 &&
            searchTriggered &&
            !userResult && (
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
      {!showLockedModal && (
        <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-200">
          <BottomTab />
        </div>
      )}

      {/* Locked-account bottom modal (AnimatePresence + framer-motion) */}
      <AnimatePresence>
        {showLockedModal && lockedUser && (
          <>
            {/* backdrop */}
            <motion.div
              key="locked-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.35 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                setShowLockedModal(false);
                setLockedUser(null);
              }}
              className="fixed inset-0 bg-black z-50"
            />

            {/* bottom sheet */}
            <motion.div
              key="locked-sheet"
              initial={{ y: 300, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 300, opacity: 0 }}
              transition={{ type: "spring", stiffness: 320, damping: 30 }}
              className="fixed left-0 right-0 bottom-0 z-60 bg-white rounded-t-xl shadow-xl p-5"
              style={{ maxWidth: 800, margin: "0 auto" }}
            >
              <div className="mx-auto max-w-lg text-center">
                <div className="w-12 h-12 rounded-full bg-purple-50 mx-auto flex items-center justify-center mb-4">
                  {lockedUser.profilePic ? (
                    <img
                      src={lockedUser.profilePic}
                      alt="profile"
                      className="w-12 h-12 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-gray-100 flex border-2 border-purple-700 items-center justify-center">
                      <FaUser className="text-purple-500" />
                    </div>
                  )}
                </div>
                <h3 className="text-lg font-semibold text-gray-800 mb-2">
                  This user has locked their account!
                </h3>
                <p className="text-sm text-gray-500 mb-6">
                  {lockedUser.pin ? `${lockedUser.pin}` : "This user"} is not
                  accepting direct chats right now. You can send a request to
                  ask for access.
                </p>

                <div className="flex gap-3 justify-center">
                  <button
                    onClick={() => {
                      setShowLockedModal(false);
                      setLockedUser(null);
                    }}
                    className="px-4 py-2 rounded-lg border border-gray-200 text-gray-700"
                    disabled={requesting}
                  >
                    Cancel
                  </button>

                  <button
                    onClick={sendAccessRequest}
                    className="px-4 py-2 rounded-lg bg-purple-600 text-white disabled:opacity-60"
                    disabled={requesting || requestSent}
                  >
                    {requesting
                      ? "Requesting..."
                      : requestSent
                      ? "Requested ✓"
                      : "Request"}
                  </button>
                </div>

                {requestSent && (
                  <p className="text-xs text-green-600 mt-3">
                    Request sent — the user will be notified.
                  </p>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
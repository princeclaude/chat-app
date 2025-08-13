// src/pages/ArchivedChatsScreen.jsx
import React, { useEffect, useState, useRef } from "react";
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  updateDoc,
  doc,
  getDoc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../firebase";
import { useProfile } from "../contexts/ProfileContext";
import dayjs from "dayjs";
import { useNavigate } from "react-router-dom";
import { FaChevronLeft } from "react-icons/fa";

export default function ArchivedChatsScreen() {
  const { profile } = useProfile();
  const myId = profile?.email; // keep using email in participants (adapt if you store pin/uid)
  const navigate = useNavigate();

  const [archivedConvos, setArchivedConvos] = useState([]);
  // cache for other user docs so we don't refetch repeatedly
  const userCacheRef = useRef(new Map());
  // small state to force rerender when cache fills
  const [, setCacheTick] = useState(0);
  

  useEffect(() => {
    if (!myId) return;

    const q = query(
      collection(db, "conversations"),
      where("participants", "array-contains", myId),
      where("archived", "==", true),
      orderBy("archivedAt", "desc")
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setArchivedConvos(rows);
      },
      (err) => {
        console.error("Archived convo listener error:", err);
      }
    );

    return () => unsub();
  }, [myId]);

  // whenever archivedConvos changes, fetch missing other-user docs into cache
  useEffect(() => {
    const missing = new Set();
    archivedConvos.forEach((c) => {
      const other = (c.participants || []).find((p) => p !== myId);
      if (other && !userCacheRef.current.has(other)) missing.add(other);
    });
    if (missing.size === 0) return;

    (async () => {
      for (const email of Array.from(missing)) {
        try {
          const userDocRef = doc(db, "users", email);
          const snap = await getDoc(userDocRef);
          if (snap.exists()) userCacheRef.current.set(email, snap.data());
          else userCacheRef.current.set(email, null);
        } catch (err) {
          console.error("Failed to fetch user for archived convo:", email, err);
          userCacheRef.current.set(email, null);
        }
      }
      // trigger rerender
      setCacheTick((t) => t + 1);
    })();
  }, [archivedConvos, myId]);

  const formatTime = (ts) => {
    if (!ts) return "";
    try {
      const d = typeof ts.toDate === "function" ? ts.toDate() : new Date(ts);
      return dayjs(d).fromNow();
    } catch {
      return "";
    }
  };

  const openConversation = (conversation, otherEmail) => {
  // Only navigate to chat panel — do NOT modify the archived flag.
  const other = userCacheRef.current.get(otherEmail) || null;
  navigate(`/chat/${encodeURIComponent(otherEmail)}`, {
    state: {
      otherUser: {
        email: otherEmail,
        pin: other?.pin || otherEmail,
        profilePic: other?.profilePic || null,
      },
 },
 });
};

  const unarchiveOnly = async (conversationId) => {
    try {
      await updateDoc(doc(db, "conversations", conversationId), {
        archived: false,
        archivedAt: null,
        updatedAt: serverTimestamp(),
      });
        navigate("/home")
    } catch (err) {
      console.error("Failed to unarchive conversation:", err);
    }
  };

  if (!myId) return <p>Loading...</p>;

  return (
      <div className="p-4">
           <button onClick={() => navigate(-1)} className="pr-1">
                        <FaChevronLeft className="text-lg text-purple-700" />
                      </button>
          
      <h2 className="text-xl font-bold mb-4 text-purple-600">Archived Chats</h2>

      {archivedConvos.length === 0 ? (
        <p className="text-purple-400">No archived conversations</p>
      ) : (
        <div className="space-y-3">
          {archivedConvos.map((c) => {
            const otherEmail = (c.participants || []).find((p) => p !== myId) || "";
            const otherUser = userCacheRef.current.get(otherEmail) || null;
            const displayPin = otherUser?.pin || otherEmail;
            const profilePic = otherUser?.profilePic || null;

            return (
              <button
                key={c.id}
                onClick={() => openConversation(c, otherEmail)}
                className="w-full text-left flex items-center justify-between p-3 bg-purple-100 rounded-md shadow-sm hover:bg-gray-50 transition"
              >
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full overflow-hidden bg-gray-200 flex items-center justify-center">
                    {profilePic ? (
                      <img src={profilePic} alt={displayPin} className="w-full h-full object-cover" />
                    ) : (
                      <div className="text-gray-500 font-semibold">{(displayPin || "U").charAt(0)}</div>
                    )}
                  </div>

                  <div className="min-w-0">
                    <div className="font-semibold text-sm text-gray-900">{displayPin}</div>
                    <div className="text-xs text-gray-500 truncate max-w-[60vw]">
                      {c.lastMessage || "No messages"}
                    </div>
                  </div>
                </div>

                <div className="flex flex-col items-end gap-2">
                  <div className="text-xs text-gray-400">{c.archivedAt ? formatTime(c.archivedAt) : ""}</div>
                  <div className="flex gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        unarchiveOnly(c.id);
                      }}
                      className="text-xs text-blue-600 px-2 py-1 rounded hover:bg-blue-50"
                    >
                      Unarchive
                    </button>

                    
                  </div>
                </div>
              </button>
            );
          })}
                  </div>
                  
          )}
          
    </div>
  );

  
  async function deleteConversation(conversationId) {
    try {
      //
      setArchivedConvos((prev) => prev.filter((x) => x.id !== conversationId));
      
      await updateDoc(doc(db, "conversations", conversationId), { _deleted: true });
     
    } catch (err) {
      console.error("Failed to delete archived conversation:", err);
}
}
}
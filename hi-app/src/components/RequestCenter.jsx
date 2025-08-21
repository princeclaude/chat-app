// src/components/RequestsCenter.jsx
import React, { useEffect, useState } from "react";
import {
  collection,
  query,
  onSnapshot,
  updateDoc,
  doc,
  serverTimestamp,
  deleteDoc,
  getDoc,
  setDoc,
  orderBy,
  getDocs,
} from "firebase/firestore";
import { db } from "../firebase";
import { FaUserPlus } from "react-icons/fa";
import { useProfile } from "../contexts/ProfileContext";
import { useNavigate } from "react-router-dom";
import { useToast } from "../contexts/ToastContext";

/**
 * RequestsCenter
 * - Shows button with badge (incoming pending count)
 * - Modal shows Incoming / Outgoing tabs in realtime
 *
 * Data layout:
 *  - Both incoming and outgoing copies are stored at:
 *    users/{userId}/requests/{requestId}
 *  - Each request uses the same requestId so updates can be mirrored.
 */

export default function RequestsCenter() {
  const { profile, user } = useProfile();
  const navigate = useNavigate();
  const { showToast } = useToast();

  const currentEmail = profile?.email || user?.email || null;
  const currentUserId = profile?.email || user?.email || null; // adapt if you use uid

  const [incoming, setIncoming] = useState([]);
  const [outgoing, setOutgoing] = useState([]);
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("incoming"); // or 'outgoing'
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentUserId) return;

    setLoading(true);

    // Single real-time listener to the user's requests subcollection
    const colRef = collection(db, "users", currentUserId, "requests");
    const q = query(colRef, orderBy("createdAt", "desc"));

    const unsub = onSnapshot(
      q,
      (snap) => {
        const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        // partition into incoming vs outgoing based on fields
        const incomingList = docs.filter(
          (r) => String(r.receiverId) === String(currentUserId)
        );
        const outgoingList = docs.filter(
          (r) => String(r.requesterEmail) === String(currentEmail)
        );

        // sort defensively (newest first)
        const sortByCreatedAtDesc = (a, b) =>
          (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0);

        setIncoming(incomingList.sort(sortByCreatedAtDesc));
        setOutgoing(outgoingList.sort(sortByCreatedAtDesc));
        setLoading(false);
      },
      (err) => {
        console.error("Requests onSnapshot error:", err);
        setLoading(false);
      }
    );

    return () => unsub();
  }, [currentUserId, currentEmail]);

  // number of pending incoming requests
  const pendingIncomingCount = incoming.filter((r) => r.status === "pending")
    .length;

  // Accept a request (the receiver clicks Accept)
  const acceptRequest = async (request) => {
    try {
      // update receiver copy
      const receiverRef = doc(db, "users", currentUserId, "requests", request.id);
      await updateDoc(receiverRef, {
        status: "approved",
        respondedAt: serverTimestamp(),
        responderEmail: currentEmail,
      });

      // update requester's copy (same collection name 'requests')
      if (request.requesterEmail) {
        const requesterRef = doc(
          db,
          "users",
          request.requesterEmail,
          "requests",
          request.id
        );
        const snap = await getDoc(requesterRef);
        if (snap.exists()) {
          await updateDoc(requesterRef, {
            status: "approved",
            respondedAt: serverTimestamp(),
            responderEmail: currentEmail,
          });
        } else {
          // if the requester copy is not in same path, try outgoingRequests for backward-compat
          const altRef = doc(
            db,
            "users",
            request.requesterEmail,
            "outgoingRequests",
            request.id
          );
          const altSnap = await getDoc(altRef);
          if (altSnap.exists()) {
            await updateDoc(altRef, {
              status: "approved",
              respondedAt: serverTimestamp(),
              responderEmail: currentEmail,
            });
          }
        }
      }

      // create conversation for both parties if not exist
      const requesterEmail = request.requesterEmail;
      const receiverEmail = currentEmail;

      if (requesterEmail && receiverEmail) {
        const sanitize = (s = "") =>
          String(s).toLowerCase().replace(/[^a-z0-9]/g, "_");
        const convoId = [sanitize(requesterEmail), sanitize(receiverEmail)]
          .sort()
          .join("");

        const convoRef = doc(db, "conversations", convoId);
        const convoSnap = await getDoc(convoRef);
        if (!convoSnap.exists()) {
          await setDoc(convoRef, {
            participants: [requesterEmail, receiverEmail],
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            lastMessage: "",
            lastMessageTime: serverTimestamp(),
          });
        }
      }

      showToast?.("Request approved");
    } catch (err) {
      console.error("acceptRequest error:", err);
      showToast?.("Failed to approve request", "error");
    }
  };

  // Decline (receiver)
  const declineRequest = async (request) => {
    try {
      const receiverRef = doc(db, "users", currentUserId, "requests", request.id);
      await updateDoc(receiverRef, {
        status: "declined",
        respondedAt: serverTimestamp(),
        responderEmail: currentEmail,
      });

      if (request.requesterEmail) {
        const requesterRef = doc(
          db,
          "users",
          request.requesterEmail,
          "requests",
          request.id
        );
        const snap = await getDoc(requesterRef);
        if (snap.exists()) {
          await updateDoc(requesterRef, {
            status: "declined",
            respondedAt: serverTimestamp(),
            responderEmail: currentEmail,
          });
        } else {
          // fallback to outgoingRequests for backward-compat
          const altRef = doc(
            db,
            "users",
            request.requesterEmail,
            "outgoingRequests",
            request.id
          );
          const altSnap = await getDoc(altRef);
          if (altSnap.exists()) {
            await updateDoc(altRef, {
              status: "declined",
              respondedAt: serverTimestamp(),
              responderEmail: currentEmail,
            });
          }
        }
      }

      showToast?.("Request declined");
    } catch (err) {
      console.error("declineRequest error:", err);
      showToast?.("Failed to decline request", "error");
    }
  };

  // Cancel outgoing (requester cancels their own pending request)
  const cancelRequest = async (request) => {
    try {
      // delete outgoing copy under me
      const myOutgoingRef = doc(db, "users", currentUserId, "requests", request.id);
      await deleteDoc(myOutgoingRef).catch(() => {});

      // delete incoming copy under receiver (if exists)
      const receiverKey = request.receiverId || request.receiverEmail;
      if (receiverKey) {
        const receiverReqRef = doc(db, "users", receiverKey, "requests", request.id);
        await deleteDoc(receiverReqRef).catch(() => {});
      }

      // also try alt path outgoingRequests in case older copies used that
      const altRef = doc(db, "users", currentUserId, "outgoingRequests", request.id);
      await deleteDoc(altRef).catch(() => {});

      showToast?.("Request cancelled");
    } catch (err) {
      console.error("cancelRequest error:", err);
      showToast?.("Failed to cancel request", "error");
    }
  };

  // Open chat from request (requester or receiver)
  const openChatFromRequest = (request) => {
    const sanitize = (s = "") =>
      String(s).toLowerCase().replace(/[^a-z0-9]/g, "_");
    const a = sanitize(request.requesterEmail || currentEmail || "");
    const b = sanitize(request.receiverEmail || request.receiverId || "");
    const convoId = [a, b].sort().join("");
    // determine otherKey to route to chat param (the app uses the other user's id/email)
    const otherKey = request.requesterEmail
      ? request.requesterEmail === currentEmail
        ? request.receiverId || request.receiverEmail
        : request.requesterEmail
      : request.receiverId || request.receiverEmail;
    if (!otherKey) return;
    navigate(`/chat/${encodeURIComponent(otherKey)}`);
  };

  return (
    <>
      <button
        onClick={() => setOpen((s) => !s)}
        title="Requests"
        className="relative p-2"
        aria-label="Requests"
      >
        <FaUserPlus className="text-lg text-purple-600" />
        {pendingIncomingCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-600 text-white text-xs rounded-full px-2">
            {pendingIncomingCount}
          </span>
        )}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-60 flex items-center justify-center bg-black/40"
          onClick={() => setOpen(false)}
        >
          <div
            className="bg-white rounded-lg shadow-lg max-w-[92%] w-[720px] p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-lg">Connection Requests</h3>
              <div>
                <button
                  className={`px-3 py-1 rounded-md mr-2 ${
                    activeTab === "incoming" ? "bg-purple-600 text-white" : "bg-gray-100"
                  }`}
                  onClick={() => setActiveTab("incoming")}
                >
                  Incoming
                </button>
                <button
                  className={`px-3 py-1 rounded-md ${
                    activeTab === "outgoing" ? "bg-purple-600 text-white" : "bg-gray-100"
                  }`}
                  onClick={() => setActiveTab("outgoing")}
                >
                  Outgoing
                </button>
              </div>
            </div>

            <div style={{ maxHeight: "60vh", overflowY: "auto" }}>
              {activeTab === "incoming" &&
                (incoming.length === 0 ? (
                  <p className="text-center text-gray-500">No incoming requests</p>
                ) : (
                  incoming.map((r) => (
                    <div key={r.id} className="flex items-center gap-3 p-3 border-b">
                      <div className="w-12 h-12 rounded-full overflow-hidden bg-gray-100">
                        {r.requesterProfilePic ? (
                          <img src={r.requesterProfilePic} alt="p" className="w-full h-full object-cover" />
                        ) : (
                          <div className="flex items-center justify-center h-full text-gray-600">👤</div>
                        )}
                      </div>

                      <div className="flex-1">
                        <div className="font-semibold">{r.requesterPin || r.requesterEmail || "Unknown"}</div>
                        <div className="text-xs text-gray-500">Sent: {r.createdAt?.toDate ? r.createdAt.toDate().toLocaleString() : ""}</div>
                        <div className="text-xs mt-1">Status: <strong>{r.status}</strong></div>
                      </div>

                      <div className="flex items-center gap-2">
                        {r.status === "pending" && (
                          <>
                            <button onClick={() => acceptRequest(r)} className="px-3 py-2 rounded bg-green-500 text-white">Accept</button>
                            <button onClick={() => declineRequest(r)} className="px-3 py-2 rounded bg-red-500 text-white">Decline</button>
                          </>
                        )}

                        {r.status === "approved" && (
                          <button onClick={() => { openChatFromRequest(r); setOpen(false); }} className="px-3 py-2 rounded bg-purple-600 text-white">
                            Open Chat
                          </button>
                        )}

                        {r.status === "declined" && <div className="text-xs text-gray-500">Declined</div>}
                      </div>
                    </div>
                  ))
                ))}

              {activeTab === "outgoing" &&
                (outgoing.length === 0 ? (
                  <p className="text-center text-gray-500">No outgoing requests</p>
                ) : (
                  outgoing.map((r) => (
                    <div key={r.id} className="flex items-center gap-3 p-3 border-b">
                      <div className="w-12 h-12 rounded-full overflow-hidden bg-gray-100">
                        {r.receiverProfilePic ? (
                          <img src={r.receiverProfilePic} alt="p" className="w-full h-full object-cover" />
                        ) : (
                          <div className="flex items-center justify-center h-full text-gray-600">👤</div>
                        )}
                      </div>

                      <div className="flex-1">
                        <div className="font-semibold">{r.receiverPin || r.receiverId || r.receiverEmail || "Unknown"}</div>
                        <div className="text-xs text-gray-500">Sent: {r.createdAt?.toDate ? r.createdAt.toDate().toLocaleString() : ""}</div>
                        <div className="text-xs mt-1">Status: <strong>{r.status}</strong></div>
                      </div>

                      <div className="flex items-center gap-2">
                        {r.status === "pending" && (
                          <button onClick={() => cancelRequest(r)} className="px-3 py-2 rounded bg-gray-200">Cancel</button>
                        )}
                        {r.status === "approved" && (
                          <button onClick={() => openChatFromRequest(r)} className="px-3 py-2 rounded bg-purple-600 text-white">Open Chat</button>
                        )}
                        {r.status === "declined" && <div className="text-xs text-gray-500">Declined</div>}
                      </div>
                    </div>
                  ))
                ))}
            </div>

            <div className="mt-3 text-right">
              <button onClick={() => setOpen(false)} className="px-3 py-2 rounded bg-gray-100">Close</button>
            </div>
          </div>
        </div>
      )}
</>
);
}
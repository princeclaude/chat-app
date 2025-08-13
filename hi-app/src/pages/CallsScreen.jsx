// src/pages/CallsScreen.jsx
import React, { useEffect, useState } from "react";
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
} from "firebase/firestore";
import { db } from "../firebase";
import { FaPhoneSlash, FaArrowUp, FaArrowDown } from "react-icons/fa";
import { useProfile } from "../contexts/ProfileContext";
import BottomTab from "../components/BottomTab";

export default function CallsScreen() {
  const { user } = useProfile();
  const [calls, setCalls] = useState([]);

  useEffect(() => {
    if (!user?.pin) return; // Don’t fetch if PIN is missing

    const callsQuery = query(
      collection(db, "calls"),
      where("participants", "array-contains", user.pin),
      orderBy("timestamp", "desc")
    );

    const unsubscribe = onSnapshot(callsQuery, (snapshot) => {
      const logs = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setCalls(logs);
    });

    return unsubscribe; // Clean up listener on unmount
  }, [user?.pin]);

  const formatTime = (timestamp) => {
    if (!timestamp) return "";
    const date = timestamp.toDate();
    return date.toLocaleString();
  };

  const getOtherPin = (participants) => {
    return participants.find((p) => p !== user.pin) || "Unknown";
  };

  const getStatusColor = (status) => {
    const colors = {
      missed: "text-red-400",
      received: "text-green-400",
      outgoing: "text-blue-400",
    };
    return colors[status] || "text-gray-400";
  };

  const renderStatusIcon = (status, isCaller) => {
    if (status === "missed") {
      return <FaPhoneSlash className="text-red-500" />;
    }
    return isCaller ? (
      <FaArrowUp className="text-green-500" />
    ) : (
      <FaArrowDown className="text-blue-500" />
    );
  };

  return (
    <div className="p-4 text-purple-700 bg-white min-h-screen">
      <h1 className="text-xl font-bold mb-4">Call Logs</h1>

      {calls.length === 0 ? (
        <p className="text-purple-500">No calls yet</p>
      ) : (
        <div className="space-y-3">
          {calls.map((call) => {
            const otherPin = getOtherPin(call.participants);
            const isCaller = call.callerPin === user.pin;

            return (
              <div
                key={call.id}
                className="flex items-center justify-between p-3 bg-gray-800 rounded-lg"
              >
                <div className="flex items-center gap-3">
                  {renderStatusIcon(call.status, isCaller)}
                  <div>
                    <p className="font-semibold">{otherPin}</p>
                    <p className={text-sm `${getStatusColor(call.status)}`}>
                                {call.status}
                                </p>
                    
                  </div>
                </div>
                <p className="text-gray-500 text-xs">
                  {formatTime(call.timestamp)}
                </p>
              </div>
            );
          })}
        </div>
      )}

      {/* Bottom Tab */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-200">
        <BottomTab />
      </div>
    </div>
  );
}

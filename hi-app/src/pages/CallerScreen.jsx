// src/pages/CallerScreen.jsx
import React, { useState, useEffect, useRef } from "react";
import { useLocation, useParams, useNavigate } from "react-router-dom";
import { FaUser, FaVolumeUp, FaVolumeMute, FaPhoneSlash } from "react-icons/fa";
import { db } from "../firebase";
import {
  collection,
  query,
  where,
  onSnapshot,
  addDoc,
  updateDoc,
  doc,
  serverTimestamp
} from "firebase/firestore";

export default function CallerScreen() {
  const { receiverPin } = useParams();
  const { state } = useLocation();
  const navigate = useNavigate();

  const [receiver, setReceiver] = useState(state?.receiver || {});
  const [speakerOn, setSpeakerOn] = useState(false);
  const [dots, setDots] = useState("");
  const [callStatus, setCallStatus] = useState("ringing");
  const [callId, setCallId] = useState(null);

  const audioRef = useRef(null);

  // Log call when screen opens
  useEffect(() => {
    const logCall = async () => {
      try {
        const docRef = await addDoc(collection(db, "calls"), {
          callerPin: state?.callerPin || "unknown",
          receiverPin,
          participants: [state?.callerPin || "unknown", receiverPin],
          status: "outgoing", // start as outgoing
          timestamp: serverTimestamp()
        });
        setCallId(docRef.id);
      } catch (err) {
        console.error("Error logging call:", err);
      }
    };
    logCall();
  }, [receiverPin, state?.callerPin]);

  // Listen to receiver's call status in Firestore
  useEffect(() => {
    const q = query(collection(db, "users"), where("pin", "==", receiverPin));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (!snapshot.empty) {
        const userData = snapshot.docs[0].data();
        setReceiver(userData);

        if (userData.callStatus) {
          setCallStatus(userData.callStatus);

          if (userData.callStatus === "accepted") {
            if (audioRef.current) audioRef.current.pause();
            if (callId) {
              updateDoc(doc(db, "calls", callId), { status: "received" });
            }
          }

          if (userData.callStatus === "ended") {
            if (callId) {
              updateDoc(doc(db, "calls", callId), { status: "ended" });
            }
            navigate(-1);
          }
        }
      }
    });

    return () => unsubscribe();
  }, [receiverPin, navigate, callId]);

  // Animate "Calling..."
  useEffect(() => {
    const interval = setInterval(() => {
      setDots((prev) => (prev.length < 3 ? prev + "." : ""));
    }, 500);
    return () => clearInterval(interval);
  }, []);

  // Play ringtone
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.loop = true;
      audioRef.current.play().catch((err) => {
        console.log("Autoplay blocked:", err);
      });
    }
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }
    };
  }, []);

  const toggleSpeaker = () => setSpeakerOn((prev) => !prev);

  const endCall = () => {
    if (audioRef.current) {
      audioRef.current.pause();
    }
    if (callId) {
      // If never accepted, mark as missed
      updateDoc(doc(db, "calls", callId), {
        status: callStatus === "ringing" ? "missed" : "ended"
      });
    }
    navigate(-1);
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-black text-white p-4">
      <audio ref={audioRef} src="/sounds/ringtone.mp3" />
      <div className="w-28 h-28 rounded-full overflow-hidden bg-gray-700 flex items-center justify-center mb-4 animate-pulse-slow">
        {receiver?.profilePic ? (
          <img
            src={receiver.profilePic}
            alt="Receiver"
            className="w-full h-full object-cover animate-scale-loop"
          />
        ) : (
          <FaUser className="text-5xl text-gray-300 animate-scale-loop" />
        )}
      </div>
      <p className="text-lg font-semibold mb-2">{receiverPin}</p>
      <p className="text-gray-400 mb-8 animate-pulse">
        {callStatus === "ringing" && `Calling${dots}`}
        {callStatus === "accepted" && "Call in progress..."}
        {callStatus === "ended" && "Call ended"}
      </p>
      <div className="flex gap-8">
        <button
          onClick={toggleSpeaker}
          className={`p-4 rounded-full transition-colors duration-300 ${
            speakerOn ? "bg-purple-600" : "bg-gray-700"
          }`}
        >
          {speakerOn ? (
            <FaVolumeUp className="text-xl" />
          ) : (
            <FaVolumeMute className="text-xl" />
          )}
        </button>

        <button
          onClick={endCall}
          className="p-4 rounded-full bg-red-600 hover:bg-red-700 transition-colors duration-300"
        >
          <FaPhoneSlash className="text-xl" />
        </button>
      </div>
 </div>
);
}
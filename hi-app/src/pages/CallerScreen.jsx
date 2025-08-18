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
  serverTimestamp,
} from "firebase/firestore";

import {
  initWebRTC,
  createOffer,
  setupIceCandidates,
  listenForAnswer,
  endWebRTC,
} from "../utils/webrtc";

export default function CallerScreen() {
  const { receiverPin } = useParams();
  const { state } = useLocation();
  const navigate = useNavigate();

  const callerPin = state?.callerPin || "unknown";
  const [receiver, setReceiver] = useState(state?.receiver || {});
  const [speakerOn, setSpeakerOn] = useState(false);
  const [dots, setDots] = useState("");
  const [callStatus, setCallStatus] = useState("ringing");
  const [callId, setCallId] = useState(null);

  const audioRef = useRef(null);

  // 🔹 Log call
  useEffect(() => {
    const logCall = async () => {
      try {
        const docRef = await addDoc(collection(db, "calls"), {
          callerPin,
          receiverPin,
          participants: [callerPin, receiverPin],
          status: "ringing",
          createdAt: serverTimestamp(),
        });
        setCallId(docRef.id);
      } catch (err) {
        console.error("Error logging call:", err);
      }
    };
    logCall();
  }, [callerPin, receiverPin]);

  // 🔹 Listen to receiver status
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
              updateDoc(doc(db, "calls", callId), { status: "accepted" });
            }

            (async () => {
              const { localStream, remoteStream } = await initWebRTC();
              document.getElementById("localAudio").srcObject = localStream;
              document.getElementById("remoteAudio").srcObject = remoteStream;
              await createOffer(callId);
              setupIceCandidates(callId);
              listenForAnswer(callId); // 🔹 wait for receiver’s answer
            })();
          }

          if (userData.callStatus === "ended") {
            if (callId) {
              updateDoc(doc(db, "calls", callId), { status: "ended" });
            }
            endWebRTC();
            navigate(-1);
          }
        }
      }
    });

    return () => unsubscribe();
  }, [receiverPin, navigate, callId]);

  // 🔹 Animate "Calling..."
  useEffect(() => {
    const interval = setInterval(() => {
      setDots((prev) => (prev.length < 3 ? prev + "." : ""));
    }, 500);
    return () => clearInterval(interval);
  }, []);

  // 🔹 Ringtone
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

  // 🔹 Auto-miss after 30s
  useEffect(() => {
    if (callStatus === "ringing" && callId) {
      const timer = setTimeout(() => {
        updateDoc(doc(db, "calls", callId), {
          status: "missed",
          endedAt: serverTimestamp(),
        }).then(() => {
          if (audioRef.current) {
            audioRef.current.pause();
          }
          navigate(-1);
        });
      }, 30000);

      return () => clearTimeout(timer);
    }
  }, [callStatus, callId, navigate]);

  const toggleSpeaker = () => setSpeakerOn((prev) => !prev);

  const endCall = () => {
    if (audioRef.current) {
      audioRef.current.pause();
    }
    if (callId) {
      updateDoc(doc(db, "calls", callId), {
        status: callStatus === "ringing" ? "missed" : "ended",
        endedAt: serverTimestamp(),
      });
    }
    endWebRTC();
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
            className="w-28 h-28 object-cover animate-scale-loop"
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

        <audio id="localAudio" autoPlay muted hidden />
        <audio id="remoteAudio" autoPlay hidden />
      </div>
 </div>
);
}
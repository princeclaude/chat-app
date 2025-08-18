// src/pages/ReceiverScreen.jsx
import React, { useEffect, useState } from "react";
import { db } from "../firebase";
import { doc, onSnapshot } from "firebase/firestore";
import { answerCall, endCall } from "../utils/callFunctions";
import {
  initWebRTC,
  createAnswer,
  setupIceCandidates,
  endWebRTC,
} from "../utils/webrtc";

const ReceiverScreen = ({ callId }) => {
  const [callData, setCallData] = useState(null);

  useEffect(() => {
    if (!callId) return;

    const unsub = onSnapshot(doc(db, "calls", callId), (docSnap) => {
      if (docSnap.exists()) {
        setCallData(docSnap.data());
      }
    });

    return () => unsub();
  }, [callId]);

  if (!callData) {
    return (
      <div className="flex items-center justify-center h-screen text-gray-500">
        Waiting for call...
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center h-screen bg-black text-white">
      {/* Caller profile picture */}
      <img
        src={callData.callerPic || "/default-avatar.png"}
        alt="Caller"
        className="w-28 h-28 rounded-full border-4 border-purple-500 mb-4"
      />

      {/* Caller PIN */}
      <h2 className="text-xl font-bold mb-2">{callData.callerPin}</h2>

      {/* Status */}
      <p className="text-gray-300 mb-6">
        {callData.status === "ringing"
          ? "Incoming Call..."
          : callData.status === "accepted"
          ? "Call in Progress"
          : callData.status === "missed"
          ? "Missed Call"
          : "Call Ended"}
      </p>

      {/* Buttons */}
      {callData.status === "ringing" && (
        <div className="flex gap-6">
          {/* Accept */}
          <button
            onClick={async () => {
              await answerCall(callId); // update Firestore status
              const { localStream, remoteStream } = await initWebRTC();
              document.getElementById("localAudio").srcObject = localStream;
              document.getElementById("remoteAudio").srcObject = remoteStream;
              await createAnswer(callId);
              setupIceCandidates(callId);
            }}
            className="bg-green-500 hover:bg-green-600 text-white rounded-full p-4"
          >
            ✅ Accept
          </button>

          {/* Reject */}
          <button
            onClick={() => {
              endCall(callId);
              endWebRTC();
            }}
            className="bg-red-500 hover:bg-red-600 text-white rounded-full p-4"
          >
            ❌ Reject
          </button>
        </div>
      )}

      {callData.status === "accepted" && (
        <div className="flex gap-6">
          {/* End */}
          <button
            onClick={() => {
              endCall(callId);
              endWebRTC();
            }}
            className="bg-red-500 hover:bg-red-600 text-white rounded-full p-4"
          >
            ⏹ End
          </button>

          {/* Volume */}
          <button
            onClick={() => alert("Volume control not yet implemented")}
            className="bg-gray-700 hover:bg-gray-600 text-white rounded-full p-4"
          >
            🔊 Volume
          </button>
        </div>
      )}

      <audio id="localAudio" autoPlay muted hidden />
      <audio id="remoteAudio" autoPlay hidden />
    </div>
  );
};

export default ReceiverScreen;

// src/components/AudioCallScreen.jsx
import React, { useContext, useEffect, useRef } from "react";
import { AudioCallContext } from "../contexts/AudioCallContext";
import { FaPhoneSlash, FaMicrophone, FaMicrophoneSlash } from "react-icons/fa";

const AudioCallScreen = ({ onEnd }) => {
  const { localStream, remoteStream, endCall } = useContext(AudioCallContext);
  const localAudioRef = useRef();
  const remoteAudioRef = useRef();
  const [muted, setMuted] = React.useState(false);

  useEffect(() => {
    if (localAudioRef.current && localStream) {
      localAudioRef.current.srcObject = localStream;
    }
    if (remoteAudioRef.current && remoteStream) {
      remoteAudioRef.current.srcObject = remoteStream;
    }
  }, [localStream, remoteStream]);

  return (
    <div className="fixed inset-0 bg-black text-white flex flex-col items-center justify-center">
      <audio ref={localAudioRef} autoPlay muted />
      <audio ref={remoteAudioRef} autoPlay />

      <h1 className="text-xl mb-4">Audio Call</h1>
      <div className="flex gap-6">
        <button
          onClick={() => {
            localStream.getAudioTracks()[0].enabled = muted;
            setMuted(!muted);
          }}
          className="p-4 rounded-full bg-gray-700"
        >
          {muted ? <FaMicrophoneSlash /> : <FaMicrophone />}
        </button>

        <button
          onClick={() => {
            endCall();
            onEnd();
          }}
          className="p-4 rounded-full bg-red-600"
        >
          <FaPhoneSlash />
        </button>
      </div>
    </div>
  );
};

export default AudioCallScreen;

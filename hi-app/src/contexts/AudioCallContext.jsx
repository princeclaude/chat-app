// src/contexts/AudioCallContext.jsx
import React, { createContext, useState, useRef } from "react";
import { db } from "../firebase";
import {
  collection,
  doc,
  setDoc,
  updateDoc,
  onSnapshot,
  addDoc,
} from "firebase/firestore";

export const AudioCallContext = createContext();

export const AudioCallProvider = ({ children }) => {
  const [callData, setCallData] = useState(null);
  const [inCall, setInCall] = useState(false);
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const peerConnection = useRef(null);

  const servers = {
    iceServers: [{ urls: ["stun:stun.l.google.com:19302"] }],
  };

  const startCall = async (calleePIN, callerPIN) => {
    peerConnection.current = new RTCPeerConnection(servers);

    // Remote stream
    const remoteMediaStream = new MediaStream();
    setRemoteStream(remoteMediaStream);

    peerConnection.current.ontrack = (event) => {
      event.streams[0].getTracks().forEach((track) => {
        remoteMediaStream.addTrack(track);
      });
    };

    // Local stream
    const localMediaStream = await navigator.mediaDevices.getUserMedia({
      audio: true,
    });
    setLocalStream(localMediaStream);

    localMediaStream.getTracks().forEach((track) => {
      peerConnection.current.addTrack(track, localMediaStream);
    });

    // Firestore call doc
    const callDoc = doc(collection(db, "calls"));
    const offerCandidates = collection(callDoc, "offerCandidates");
    const answerCandidates = collection(callDoc, "answerCandidates");

    // ICE candidates
    peerConnection.current.onicecandidate = (event) => {
      if (event.candidate) {
        addDoc(offerCandidates, event.candidate.toJSON());
      }
    };

    // Create offer
    const offerDescription = await peerConnection.current.createOffer();
    await peerConnection.current.setLocalDescription(offerDescription);

    const offer = {
      sdp: offerDescription.sdp,
      type: offerDescription.type,
    };

    await setDoc(callDoc, {
      offer,
      participants: { callerPIN, calleePIN },
      status: "ringing",
    });

    // Listen for answer
    onSnapshot(callDoc, (snapshot) => {
      const data = snapshot.data();
      if (data?.answer && !peerConnection.current.currentRemoteDescription) {
        const answerDescription = new RTCSessionDescription(data.answer);
        peerConnection.current.setRemoteDescription(answerDescription);
      }
    });

    // Listen for answer ICE candidates
    onSnapshot(answerCandidates, (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === "added") {
          const candidate = new RTCIceCandidate(change.doc.data());
          peerConnection.current.addIceCandidate(candidate);
        }
      });
    });

    setCallData({ callId: callDoc.id, calleePIN });
    setInCall(true);
  };

  const answerCall = async (callId) => {
    const callDoc = doc(db, "calls", callId);
    const answerCandidates = collection(callDoc, "answerCandidates");
    const offerCandidates = collection(callDoc, "offerCandidates");

    peerConnection.current = new RTCPeerConnection(servers);

    const remoteMediaStream = new MediaStream();
    setRemoteStream(remoteMediaStream);

    peerConnection.current.ontrack = (event) => {
      event.streams[0].getTracks().forEach((track) => {
        remoteMediaStream.addTrack(track);
      });
    };

    const localMediaStream = await navigator.mediaDevices.getUserMedia({
      audio: true,
    });
    setLocalStream(localMediaStream);
    localMediaStream.getTracks().forEach((track) => {
      peerConnection.current.addTrack(track, localMediaStream);
    });

    peerConnection.current.onicecandidate = (event) => {
      if (event.candidate) {
        addDoc(answerCandidates, event.candidate.toJSON());
      }
    };

    const callData = (await getDoc(callDoc)).data();
    const offerDescription = callData.offer;
    await peerConnection.current.setRemoteDescription(
      new RTCSessionDescription(offerDescription)
    );

    const answerDescription = await peerConnection.current.createAnswer();
    await peerConnection.current.setLocalDescription(answerDescription);

    const answer = {
      type: answerDescription.type,
      sdp: answerDescription.sdp,
    };

    await updateDoc(callDoc, { answer, status: "accepted" });

    onSnapshot(offerCandidates, (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === "added") {
          const candidate = new RTCIceCandidate(change.doc.data());
          peerConnection.current.addIceCandidate(candidate);
        }
      });
    });

    setInCall(true);
  };

  const endCall = async () => {
    if (peerConnection.current) {
      peerConnection.current.close();
    }
    setLocalStream(null);
    setRemoteStream(null);
    setInCall(false);
  };

  return (
    <AudioCallContext.Provider
      value={{
        startCall,
        answerCall,
        endCall,
        localStream,
        remoteStream,
        inCall,
        callData,
      }}
    >
      {children}
    </AudioCallContext.Provider>
  );
};

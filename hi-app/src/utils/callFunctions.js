// src/utils/callFunctions.js
import {
  doc,
  setDoc,
  getDoc,
  updateDoc,
  collection,
  addDoc,
  onSnapshot,
} from "firebase/firestore";
import { db } from "../firebase";

let pc; // PeerConnection (reused)

export const initPeerConnection = (remoteAudioRef) => {
  pc = new RTCPeerConnection();

  // Remote stream
  pc.ontrack = (event) => {
    if (remoteAudioRef.current) {
      remoteAudioRef.current.srcObject = event.streams[0];
    }
  };

  return pc;
};

export const startCall = async (callId, localStream) => {
  const callDoc = doc(db, "calls", callId);
  const offerCandidates = collection(callDoc, "callerCandidates");

  // Add local stream
  localStream.getTracks().forEach((track) => pc.addTrack(track, localStream));

  // Collect ICE candidates
  pc.onicecandidate = (event) => {
    if (event.candidate) {
      addDoc(offerCandidates, event.candidate.toJSON());
    }
  };

  // Create offer
  const offerDescription = await pc.createOffer();
  await pc.setLocalDescription(offerDescription);

  const offer = {
    sdp: offerDescription.sdp,
    type: offerDescription.type,
  };

  await updateDoc(callDoc, { offer });

  // Listen for answer
  onSnapshot(callDoc, (snapshot) => {
    const data = snapshot.data();
    if (data?.answer && !pc.currentRemoteDescription) {
      const answerDescription = new RTCSessionDescription(data.answer);
      pc.setRemoteDescription(answerDescription);
    }
  });

  // Listen for receiver ICE candidates
  const answerCandidates = collection(callDoc, "receiverCandidates");
  onSnapshot(answerCandidates, (snapshot) => {
    snapshot.docChanges().forEach((change) => {
      if (change.type === "added") {
        const candidate = new RTCIceCandidate(change.doc.data());
        pc.addIceCandidate(candidate);
      }
    });
  });
};

export const answerCall = async (callId, localStream) => {
  const callDoc = doc(db, "calls", callId);
  const answerCandidates = collection(callDoc, "receiverCandidates");

  // Add local stream
  localStream.getTracks().forEach((track) => pc.addTrack(track, localStream));

  // Collect ICE candidates
  pc.onicecandidate = (event) => {
    if (event.candidate) {
      addDoc(answerCandidates, event.candidate.toJSON());
    }
  };

  const callData = (await getDoc(callDoc)).data();

  const offerDescription = callData.offer;
  await pc.setRemoteDescription(new RTCSessionDescription(offerDescription));

  // Create answer
  const answerDescription = await pc.createAnswer();
  await pc.setLocalDescription(answerDescription);

  const answer = {
    type: answerDescription.type,
    sdp: answerDescription.sdp,
  };

  await updateDoc(callDoc, { answer });

  // Listen for caller ICE candidates
  const offerCandidates = collection(callDoc, "callerCandidates");
  onSnapshot(offerCandidates, (snapshot) => {
    snapshot.docChanges().forEach((change) => {
      if (change.type === "added") {
        const candidate = new RTCIceCandidate(change.doc.data());
        pc.addIceCandidate(candidate);
      }
    });
  });
};

export const endCall = async (callId) => {
  pc.close();
  await updateDoc(doc(db, "calls", callId), { status: "ended" });
};

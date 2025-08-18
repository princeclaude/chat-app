// src/utils/callFunctions.js
import {
  doc,
  setDoc,
  getDoc,
  updateDoc,
  collection,
  addDoc,
  onSnapshot,
  deleteDoc,
} from "firebase/firestore";
import { db } from "../firebase";

let pc = null; // PeerConnection (singleton for now)
let unsubCall = null;
let unsubCandidates = null;

export const initPeerConnection = (remoteAudioRef) => {
  pc = new RTCPeerConnection();

  // Remote audio stream
  pc.ontrack = (event) => {
    if (remoteAudioRef?.current) {
      remoteAudioRef.current.srcObject = event.streams[0];
    }
  };

  return pc;
};

export const startCall = async (callId, localStream) => {
  const callDoc = doc(db, "calls", callId);
  const offerCandidates = collection(callDoc, "callerCandidates");

  // Attach local tracks
  localStream?.getTracks().forEach((track) => pc.addTrack(track, localStream));

  // Gather ICE candidates
  pc.onicecandidate = (event) => {
    if (event.candidate) {
      addDoc(offerCandidates, event.candidate.toJSON());
    }
  };

  // Create and set offer
  const offerDescription = await pc.createOffer();
  await pc.setLocalDescription(offerDescription);

  const offer = {
    type: offerDescription.type,
    sdp: offerDescription.sdp,
  };

  await setDoc(callDoc, {
    offer,
    status: "ongoing",
    createdAt: Date.now(),
  });

  // Listen for answer
  unsubCall = onSnapshot(callDoc, (snapshot) => {
    const data = snapshot.data();
    if (data?.answer && !pc.currentRemoteDescription) {
      const answerDescription = new RTCSessionDescription(data.answer);
      pc.setRemoteDescription(answerDescription);
    }
  });

  // Listen for receiver ICE candidates
  const answerCandidates = collection(callDoc, "receiverCandidates");
  unsubCandidates = onSnapshot(answerCandidates, (snapshot) => {
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

  // Attach local tracks
  localStream?.getTracks().forEach((track) => pc.addTrack(track, localStream));

  // Gather ICE candidates
  pc.onicecandidate = (event) => {
    if (event.candidate) {
      addDoc(answerCandidates, event.candidate.toJSON());
    }
  };

  const callData = (await getDoc(callDoc)).data();
  if (!callData?.offer) throw new Error("No offer found for this call");

  // Set remote offer
  const offerDescription = callData.offer;
  await pc.setRemoteDescription(new RTCSessionDescription(offerDescription));

  // Create and set answer
  const answerDescription = await pc.createAnswer();
  await pc.setLocalDescription(answerDescription);

  const answer = {
    type: answerDescription.type,
    sdp: answerDescription.sdp,
  };

  await updateDoc(callDoc, { answer, status: "answered" });

  // Listen for caller ICE candidates
  const offerCandidates = collection(callDoc, "callerCandidates");
  unsubCandidates = onSnapshot(offerCandidates, (snapshot) => {
    snapshot.docChanges().forEach((change) => {
      if (change.type === "added") {
        const candidate = new RTCIceCandidate(change.doc.data());
        pc.addIceCandidate(candidate);
      }
    });
  });
};

export const endCall = async (callId) => {
  if (pc) {
    pc.getSenders().forEach((sender) => sender.track?.stop());
    pc.close();
    pc = null;
  }

  // Unsubscribe from Firestore listeners
  if (unsubCall) unsubCall();
  if (unsubCandidates) unsubCandidates();

  // Update Firestore status
  await updateDoc(doc(db, "calls", callId), {
    status: "ended",
    endedAt: Date.now(),
  });

  // Optionally clean up call doc after some delay
  // setTimeout(() => deleteDoc(doc(db, "calls", callId)), 60000);
};

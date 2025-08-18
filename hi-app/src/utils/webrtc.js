// src/utils/webrtc.js
import { db } from "../firebase";
import {
  collection,
  doc,
  setDoc,
  getDoc,
  onSnapshot,
  updateDoc,
  addDoc,
} from "firebase/firestore";

let pc;
let localStream;
let remoteStream;

// ICE servers (use STUN, add TURN later if needed)
const servers = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
};

// 🔹 Initialize peer connection
export const initWebRTC = async () => {
  pc = new RTCPeerConnection(servers);

  // Local mic audio
  localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
  localStream.getTracks().forEach((track) => pc.addTrack(track, localStream));

  // Remote audio
  remoteStream = new MediaStream();
  pc.ontrack = (event) => {
    event.streams[0].getTracks().forEach((track) => {
      remoteStream.addTrack(track);
    });
  };

  return { pc, localStream, remoteStream };
};

// 🔹 Caller creates an offer
export const createOffer = async (callId) => {
  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);

  await updateDoc(doc(db, "calls", callId), {
    offer: {
      type: offer.type,
      sdp: offer.sdp,
    },
  });
};

// 🔹 Receiver answers
export const createAnswer = async (callId) => {
  const callRef = doc(db, "calls", callId);
  const callDoc = await getDoc(callRef);
  const offer = callDoc.data().offer;

  if (!offer) throw new Error("No offer found for this call");

  await pc.setRemoteDescription(new RTCSessionDescription(offer));

  const answer = await pc.createAnswer();
  await pc.setLocalDescription(answer);

  await updateDoc(callRef, {
    answer: {
      type: answer.type,
      sdp: answer.sdp,
    },
  });
};

// 🔹 Listen for answer (caller side)
export const listenForAnswer = (callId) => {
  const callRef = doc(db, "calls", callId);
  onSnapshot(callRef, (snapshot) => {
    const data = snapshot.data();
    if (data?.answer && !pc.currentRemoteDescription) {
      pc.setRemoteDescription(new RTCSessionDescription(data.answer));
    }
  });
};

// 🔹 Setup ICE candidates
export const setupIceCandidates = (callId) => {
  const callRef = doc(db, "calls", callId);
  const candidatesCollection = collection(callRef, "candidates");

  pc.onicecandidate = async (event) => {
    if (event.candidate) {
      await addDoc(candidatesCollection, event.candidate.toJSON());
    }
  };

  onSnapshot(candidatesCollection, (snapshot) => {
    snapshot.docChanges().forEach((change) => {
      if (change.type === "added") {
        let candidate = new RTCIceCandidate(change.doc.data());
        pc.addIceCandidate(candidate);
      }
    });
  });
};

// 🔹 End call
export const endWebRTC = () => {
  if (localStream) {
    localStream.getTracks().forEach((t) => t.stop());
  }
  if (pc) {
    pc.close();
  }
  pc = null;
  localStream = null;
  remoteStream = null;
};

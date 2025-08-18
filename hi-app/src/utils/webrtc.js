// src/utils/webrtc.js
import { db } from "../firebase";
import { collection, doc, setDoc, addDoc, getDoc, onSnapshot, updateDoc } from "firebase/firestore";

let peerConnection;
let localStream;
let remoteStream;

// ICE servers (use Google STUN for now; you can later add TURN)
const servers = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
};

// End and cleanup WebRTC
export const endWebRTC = () => {
  if (peerConnection) {
    peerConnection.close();
    peerConnection = null;
  }

  if (localStream) {
    localStream.getTracks().forEach((track) => track.stop());
    localStream = null;
  }

  if (remoteStream) {
    remoteStream.getTracks().forEach((track) => track.stop());
    remoteStream = null;
}
};
export const initWebRTC = async () => {
  peerConnection = new RTCPeerConnection(servers);

  // Setup streams
  localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
  remoteStream = new MediaStream();

  localStream.getTracks().forEach((track) => {
    peerConnection.addTrack(track, localStream);
  });

  peerConnection.ontrack = (event) => {
    event.streams[0].getTracks().forEach((track) => {
      remoteStream.addTrack(track);
    });
  };

  return { peerConnection, localStream, remoteStream };
};

// Caller: create offer
export const createOffer = async (callId) => {
  const offer = await peerConnection.createOffer();
  await peerConnection.setLocalDescription(offer);

  await updateDoc(doc(db, "calls", callId), {
    offer: {
      type: offer.type,
      sdp: offer.sdp,
    },
  });
};

// Receiver: create answer
export const createAnswer = async (callId) => {
  const callRef = doc(db, "calls", callId);
  const callDoc = await getDoc(callRef);
  const offer = callDoc.data().offer;

  await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));

  const answer = await peerConnection.createAnswer();
  await peerConnection.setLocalDescription(answer);

  await updateDoc(callRef, {
    answer: {
      type: answer.type,
      sdp: answer.sdp,
    },
  });
};

// Listen for ICE candidates
export const setupIceCandidates = (callId) => {
  const callRef = doc(db, "calls", callId);
  const candidatesCollection = collection(callRef, "candidates");

  peerConnection.onicecandidate = async (event) => {
 if (event.candidate) {
   await addDoc(candidatesCollection, event.candidate.toJSON());
 }
 };
    
    

  // Listen for remote ICE candidates
  onSnapshot(candidatesCollection, (snapshot) => {
    snapshot.docChanges().forEach((change) => {
      if (change.type === "added") {
        let candidate = new RTCIceCandidate(change.doc.data());
        peerConnection.addIceCandidate(candidate);
      }
    });
  });
};

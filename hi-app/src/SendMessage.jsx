import { doc, setDoc, updateDoc, collection, addDoc, serverTimestamp, getDoc } from "firebase/firestore";
import { db } from "./firebase";

export const SendMessage = async (senderId, receiverId, text) => {
  // Create a consistent conversation ID
  const conversationId =
    senderId < receiverId ? `${senderId}_${receiverId}` : `${receiverId}_${senderId}`;

  const conversationRef = doc(db, "conversations", conversationId);
  const conversationSnap = await getDoc(conversationRef);

  if (!conversationSnap.exists()) {
    await setDoc(conversationRef, {
      participants: [senderId, receiverId],
      lastMessage: text,
      lastMessageTime: serverTimestamp(),
    });
  } else {
    await updateDoc(conversationRef, {
      lastMessage: text,
      lastMessageTime: serverTimestamp(),
    });
  }

  // Add message to subcollection
  const messagesRef = collection(conversationRef, "messages");
  await addDoc(messagesRef, {
    senderId,
    text,
    createdAt: serverTimestamp(),
});
};
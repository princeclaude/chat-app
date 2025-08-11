import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "./src/firebase"; // adjust if firebase config is elsewhere

async function seedFakeConversation() {
  const conversationId = "fakeUser1_fakeUser2";

  await setDoc(doc(db, "conversations", conversationId), {
    participants: ["fakeUser1", "fakeUser2"],
    updatedAt: serverTimestamp(),
    lastMessage: "Hey, are you coming to the event?",
    lastMessageTime: serverTimestamp(),
    otherUserPin: "AB123",
    otherUserPic: "https://via.placeholder.com/150",
  });

  console.log("✅ Fake conversation seeded!");
}

seedFakeConversation();

// src/pages/ChatsList.jsx
import { useEffect, useState } from "react";
import { collection, query, where, orderBy, getDocs, doc, getDoc } from "firebase/firestore";
import { db, auth } from "../firebase";
import { useNavigate } from "react-router-dom";

export default function ChatsList() {
  const [chats, setChats] = useState([]);
  const navigate = useNavigate();

  const formatTime = (timestamp) => {
    if (!timestamp) return "";
    const date = timestamp.toDate();
    const now = new Date();
    const diffDays = Math.floor((now - date) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    } else if (diffDays === 1) {
      return "Yesterday";
    } else if (diffDays < 7) {
      return date.toLocaleDateString([], { weekday: "long" });
    } else {
      return date.toLocaleDateString([], { month: "2-digit", day: "2-digit", year: "numeric" });
    }
  };

  useEffect(() => {
    const fetchChats = async () => {
      const currentUserId = auth.currentUser?.uid;
      if (!currentUserId) return;

      // Query chats where current user is a participant
      const q = query(
        collection(db, "chats"),
        where("participants", "array-contains", currentUserId),
        orderBy("lastMessageTime", "desc")
      );

      const snap = await getDocs(q);
      const chatData = await Promise.all(
        snap.docs.map(async (docSnap) => {
          const chat = docSnap.data();
          const otherUserId = chat.participants.find((id) => id !== currentUserId);

          // Get other user info
          const userSnap = await getDoc(doc(db, "users", otherUserId));
          const userInfo = userSnap.exists() ? userSnap.data() : {};

          return {
            id: docSnap.id,
            lastMessage: chat.lastMessage || "",
            lastMessageTime: chat.lastMessageTime,
            pin: userInfo.pin,
            profilePic: userInfo.profilePic,
          };
        })
      );

      setChats(chatData);
    };

    fetchChats();
  }, []);

  return (
    <div className="flex flex-col h-screen bg-white">
      <div className="px-4 py-3 font-bold text-xl border-b sticky top-0 bg-white z-50">Chats</div>
      <div className="flex-1 overflow-y-auto">
        {chats.map((chat) => (
          <div
            key={chat.id}
            onClick={() => navigate(`/chat/${chat.pin}`)}
            className="flex items-center gap-3 px-4 py-3 border-b cursor-pointer hover:bg-gray-100"
          >
            <img
              src={chat.profilePic || "/default-avatar.png"}
              alt="profile"
              className="w-12 h-12 rounded-full object-cover"
            />
            <div className="flex-1">
              <div className="flex justify-between">
                <p className="font-bold text-purple-700">{chat.pin}</p>
                <span className="text-xs text-gray-500">
                  {formatTime(chat.lastMessageTime)}
                </span>
              </div>
              <p className="text-sm text-gray-600 truncate">{chat.lastMessage}</p>
            </div>
          </div>
        ))}
      </div>
 </div>
);
}
// ConversationRow.jsx
import React, { useRef } from "react";

export default function ConversationRow({
  conversation,
  onClick,
  showActionModal,
}) {
  const timerRef = useRef(null);
  const startYRef = useRef(0);
  const movedRef = useRef(false);

  const handleTouchStart = (e) => {
    movedRef.current = false;
    startYRef.current = e.touches[0].clientY;

    timerRef.current = setTimeout(() => {
      if (!movedRef.current) {
        showActionModal(conversation); // Open modal only if not moved
      }
    }, 600); // Long press duration
  };

  const handleTouchMove = (e) => {
    const currentY = e.touches[0].clientY;
    if (Math.abs(currentY - startYRef.current) > 5) {
      movedRef.current = true; // Mark as scroll
      clearTimeout(timerRef.current);
    }
  };

  const handleTouchEnd = () => {
    clearTimeout(timerRef.current);
  };

  return (
    <div
      className="conversation-row"
      onClick={() => onClick(conversation)}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onContextMenu={(e) => {
        e.preventDefault();
        showActionModal(conversation);
      }}
    >
      {/* Conversation UI */}
      <div className="flex items-center gap-3">
        <img
          src={conversation.profilePic || "/default-avatar.png"}
          alt=""
          className="w-10 h-10 rounded-full"
        />
        <div>
          <p className="font-semibold">{conversation.pin}</p>
          <p className="text-sm text-gray-500">{conversation.lastMessage}</p>
        </div>
      </div>
      
    </div>
  );
}

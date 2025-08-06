import { useParams, useNavigate } from "react-router-dom";
import {
  FaArrowLeft,
  FaPhoneAlt,
  FaPaperclip,
  FaPaperPlane,
  FaEdit,
  FaTrash,
  FaHeart,
  FaCopy,
  FaImage,
} from "react-icons/fa";
import { useEffect, useRef, useState } from "react";

const ChatPanel = () => {
  const { pin } = useParams();
  const navigate = useNavigate();
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState([
    { sender: "them", text: "Hey! 👋" },
    { sender: "me", text: "Hello! How are you?" },
  ]);
  const [selectedMessageIndex, setSelectedMessageIndex] = useState(null);
  const messageEndRef = useRef(null);

  useEffect(() => {
    messageEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = () => {
    if (message.trim() === "") return;
    setMessages([...messages, { sender: "me", text: message }]);
    setMessage("");
  };

  const handleEdit = () => {
    const newText = prompt(
      "Edit your message:",
      messages[selectedMessageIndex].text
    );
    if (newText !== null) {
      const updated = [...messages];
      updated[selectedMessageIndex].text = newText;
      setMessages(updated);
      setSelectedMessageIndex(null);
    }
  };

  const handleDelete = () => {
    const updated = messages.filter((_, idx) => idx !== selectedMessageIndex);
    setMessages(updated);
    setSelectedMessageIndex(null);
  };

  const handleLike = () => {
    alert("You liked the message! 💜");
    setSelectedMessageIndex(null);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(messages[selectedMessageIndex].text);
    alert("Message copied!");
    setSelectedMessageIndex(null);
  };

  return (
    <div className="flex flex-col h-screen bg-white">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 sticky top-0 z-50 backdrop-blur-md bg-white/70 border-b">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)}>
            <FaArrowLeft className="text-lg text-gray-600" />
          </button>
          <img
            src="/default-profile.jpg"
            alt="User"
            className="w-9 h-9 rounded-full object-cover"
          />
          <span className="font-medium text-black text-sm">{pin}</span>
        </div>
        <FaPhoneAlt className="text-purple-600 text-xl" />
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 bg-white ">
        {messages.map((msg, index) => (
          <div key={index} className="relative group">
            <div
              onClick={() =>
                selectedMessageIndex === index
                  ? setSelectedMessageIndex(null)
                  : setSelectedMessageIndex(index)
              }
              className={`relative max-w-[75%] px-4 py-2 text-sm whitespace-pre-wrap transition break-words
                ${
                  msg.sender === "me"
                    ? "bg-purple-600 mt-8 text-white ml-auto rounded-2xl rounded-br-none before:content-[''] before:absolute before:right-[-6px] before:top-2 before:border-[6px] before:border-transparent before:border-l-purple-600"
                    : "bg-purple-400 text-black rounded-2xl rounded-bl-none before:content-[''] before:absolute before:left-[-6px] before:top-2 before:border-[6px] before:border-transparent before:border-r-gray-200"
                }`}
            >
              {msg.text}
            </div>

            {/* Action Menu */}
            {selectedMessageIndex === index && (
              <div
                className={`absolute top-full mt-1 ${
                  msg.sender === "me" ? "right-0" : "left-0"
                } bg-white shadow-md rounded-md border border-gray-200 z-10 w-max`}
              >
                <ul className="text-sm">
                  {msg.sender === "me" && (
                    <>
                      <li
                        className="flex items-center gap-2 px-4 py-2 hover:bg-gray-100 cursor-pointer"
                        onClick={handleEdit}
                      >
                        <FaEdit /> Edit
                      </li>
                      <li
                        className="flex items-center gap-2 px-4 py-2 hover:bg-gray-100 cursor-pointer text-red-500"
                        onClick={handleDelete}
                      >
                        <FaTrash /> Delete
                      </li>
                    </>
                  )}
                  <li
                    className="flex items-center gap-2 px-4 py-2 hover:bg-gray-100 cursor-pointer"
                    onClick={handleLike}
                  >
                    <FaHeart /> Like
                  </li>
                  <li
                    className="flex items-center gap-2 px-4 py-2 hover:bg-gray-100 cursor-pointer"
                    onClick={handleCopy}
                  >
                    <FaCopy /> Copy
                  </li>
                </ul>
              </div>
            )}
          </div>
        ))}
        <div ref={messageEndRef} />
      </div>

      {/* Input */}
      <div className="px-3 py-2 border-t border-gray-200 bg-white sticky bottom-0 z-40">
        <div className="flex items-center gap-3">
          <button className="text-purple-500">
            <FaPaperclip className="text-xl" />
          </button>
          <button className="text-purple-500">
            <FaImage className="text-xl" />
          </button>
          <input
            type="text"
            placeholder="Type a message"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
            inputMode="text"
            autoComplete="off"
            spellCheck={false}
          />
          <button
            onClick={handleSend}
            className="bg-purple-600 text-white p-2 rounded-full hover:bg-purple-700 transition"
          >
            <FaPaperPlane className="text-lg" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChatPanel;

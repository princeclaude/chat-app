import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import BottomTab from "../components/BottomTab";
import { db, auth } from "../firebase";
import {
  collection,
  query,
  where,
  getDocs,
  updateDoc,
  doc,
} from "firebase/firestore";
import { useSettings } from "../contexts/SettingsContext";
import { useNavigate } from "react-router-dom";

export default function Settings() {
  const {
    updateProfilePic,
    changeEmail,
    changePassword,
    logout,
    deleteAccount,
  } = useSettings();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [profilePicFile, setProfilePicFile] = useState(null);
  const [persistedPic, setPersistedPic] = useState(null);
  const [pin, setPin] = useState(null);
  const [loading, setLoading] = useState(true);

  const navigate = useNavigate();

  // Fetch data for the current user ONLY
  useEffect(() => {
    const fetchUserData = async () => {
      const currentUser = auth.currentUser;
      if (!currentUser) return;

      setEmail(currentUser.email || "");

      const q = query(
        collection(db, "users"),
        where("email", "==", currentUser.email.toLowerCase())
      );
      const snapshot = await getDocs(q);
      if (!snapshot.empty) {
        const data = snapshot.docs[0].data();
        setPin(data.pin || null);
        setPersistedPic(data.profilePic || null);
      }
      setLoading(false);
    };

    fetchUserData();
  }, []);

  const handlelogout = async () => {
    await logout();
    navigate("/")
    
  }

  const handlePicUpload = async () => {
    if (!profilePicFile) return;
    const uploadedUrl = await updateProfilePic(profilePicFile);

    const q = query(
      collection(db, "users"),
      where("email", "==", auth.currentUser.email.toLowerCase())
    );
    const snapshot = await getDocs(q);
    if (!snapshot.empty) {
      const userRef = doc(db, "users", snapshot.docs[0].id);
      await updateDoc(userRef, { profilePic: uploadedUrl });
    }
    setPersistedPic(uploadedUrl);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <p>Loading settings...</p>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-4 space-y-6 bg-white text-black min-h-screen"
    >
      <div className="flex flex-col items-center space-y-2">
        {persistedPic ? (
          <img
            src={persistedPic}
            alt="Profile"
            className="w-24 h-24 rounded-full object-cover border"
          />
        ) : (
          <div className="w-24 h-24 rounded-full bg-gray-100 flex items-center justify-center border">
            <span className="text-gray-400">No Pic</span>
          </div>
        )}

        <strong className="text-lg text-purple-700 font-bold">
          {pin || ""}
        </strong>

        <input
          type="file"
          accept="image/*"
          onChange={(e) => setProfilePicFile(e.target.files[0])}
        />
        <button
          onClick={handlePicUpload}
          className="bg-purple-600 text-white px-4 py-1 rounded"
        >
          Upload Profile Picture
        </button>
      </div>

      <div>
        <label>Email</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="border rounded px-3 py-2 w-full"
        />
        <button
          onClick={() => changeEmail(email)}
          className="bg-purple-600 text-white px-4 py-1 rounded mt-2"
        >
          Update Email
        </button>
      </div>

      <div>
        <label>Password</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="border rounded px-3 py-2 w-full"
        />
        <button
          onClick={() => changePassword(password)}
          className="bg-purple-600 text-white px-4 py-1 rounded mt-2"
        >
          Update Password
        </button>
      </div>

      <div className="flex flex-col gap-2 pt-4">
        <button
          onClick={handlelogout}
          className="bg-gray-800 text-white px-4 py-2 rounded"
        >
          Logout
        </button>
        <button
          onClick={deleteAccount}
          className="bg-red-600 text-white px-4 py-2 rounded"
        >
          Delete Account
        </button>
      </div>

      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t">
        <BottomTab />
      </div>
    </motion.div>
  );
}

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import BottomTab from "../components/BottomTab";
import { db, auth } from "../firebase";
import {
  collection,
  query,
  where,
  onSnapshot,
  updateDoc,
  doc,
  getDocs,
  serverTimestamp,
} from "firebase/firestore";
import { useSettings } from "../contexts/SettingsContext";
import { useNavigate } from "react-router-dom";
import { useToast } from "../contexts/ToastContext";

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
  // number should be a string for controlled input
  const [number, setNumber] = useState("");
  const [profilePicFile, setProfilePicFile] = useState(null);
  const [persistedPic, setPersistedPic] = useState(null);
  const [pin, setPin] = useState(null);
  const [loading, setLoading] = useState(true);
  const [savingNumber, setSavingNumber] = useState(false);

  const navigate = useNavigate();
  const { showToast } = useToast();

  // Real-time user data
  useEffect(() => {
    const currentUser = auth.currentUser;
    if (!currentUser) return;

    setEmail(currentUser.email || "");

    const q = query(
      collection(db, "users"),
      where("email", "==", currentUser.email.toLowerCase())
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (!snapshot.empty) {
        const data = snapshot.docs[0].data();
        setPin(data.pin || null);
        setPersistedPic(data.profilePic || null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleLogout = async () => {
    await logout();
    navigate("/");
  };

  const handlePicUpload = async () => {
    if (!profilePicFile) return;

    const uploadedUrl = await updateProfilePic(profilePicFile);

    const q = query(
      collection(db, "users"),
      where("email", "==", auth.currentUser.email.toLowerCase())
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (!snapshot.empty) {
        const userRef = doc(db, "users", snapshot.docs[0].id);
        updateDoc(userRef, { profilePic: uploadedUrl });
      }
    });

    unsubscribe(); // immediately unsubscribe to avoid memory leak
  };

  // Helper: normalize Nigerian phone to E.164 (+234XXXXXXXXXX)
  const normalizeNigerianNumber = (input) => {
    if (!input) return null;
    const trimmed = String(input).trim();
    // keep a flag if user had leading plus
    const hadPlus = trimmed.startsWith("+");
    // strip all non-digit characters
    const digits = trimmed.replace(/\D/g, "");

    // If user entered +234... and digits is 13 starting with 234, return +234...
    if (hadPlus && digits.length === 13 && digits.startsWith("234")) {
      return "+" + digits;
    }

    // If digits length is 11 and starts with 0 -> drop leading 0 and prefix +234
    if (digits.length === 11 && digits.startsWith("0")) {
      const nsn = digits.slice(1); // national significant number (10 digits)
      if (nsn.length === 10) return "+234" + nsn;
    }

    // If digits length is 10 -> assume NSN (no leading zero) => +234 + nsn
    if (digits.length === 10) {
      return "+234" + digits;
    }

    // If digits length is 13 and starts with 234 -> add leading +
    if (digits.length === 13 && digits.startsWith("234")) {
      return "+" + digits;
    }

    // Otherwise invalid for our rules
    return null;
  };

  // small showToast helper with fallback
  const toast = (message, type = "info") => {
    if (typeof showToast === "function") {
      try {
        showToast(message, type);
        return;
      } catch (e) {
        // fallthrough to window
      }
    }
    if (window && typeof window.showToast === "function") {
      try {
        window.showToast(message, type);
        return;
      } catch (e) {
        // fallthrough
      }
    }
    // final fallback
    // eslint-disable-next-line no-alert
    alert(message);
  };

  // Add / change number in Firestore users collection
  const changeNumber = async (rawNumber) => {
    if (!auth?.currentUser) {
      toast("No signed-in user found", "error");
      return;
    }

    const normalized = normalizeNigerianNumber(rawNumber);
    if (!normalized) {
      toast(
        "Invalid Nigerian WhatsApp number. Example: 08012345678, 8012345678, +2348012345678",
        "error"
      );
      return;
    }

    // Prevent double submissions
    setSavingNumber(true);
    try {
      // lookup user's doc by email
      const q = query(
        collection(db, "users"),
        where("email", "==", auth.currentUser.email.toLowerCase())
      );
      const snap = await getDocs(q);
      if (snap.empty) {
        toast("User record not found", "error");
        setSavingNumber(false);
        return;
      }

      const userDoc = snap.docs[0];
      const userRef = doc(db, "users", userDoc.id);

      await updateDoc(userRef, {
        phone: normalized,
        updatedAt: serverTimestamp(),
      });

      // update local input and UI
      setNumber(normalized);
      setPersistedPic((p) => p); // keep other UI unchanged (no-op)
      toast("WhatsApp number added successfully", "success");
    } catch (err) {
      console.error("Failed to update phone number:", err);
      toast("Failed to add WhatsApp number, please try again", "error");
    } finally {
      setSavingNumber(false);
    }
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
      {/* Profile Section */}
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
          className="sm:ml-2 bg-purple-500 rounded-sm text-white"
        />
        <button
          onClick={handlePicUpload}
          className="bg-purple-600 text-white px-4 py-1 rounded"
        >
          Upload Profile Picture
        </button>
      </div>

      {/* Email Section */}
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

      {/* Password Section */}
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

      <div>
        <label>Add Whatsapp Number.</label>
        <input
          type="tel"
          value={number}
          onChange={(e) => setNumber(e.target.value)}
          className="border rounded px-3 py-2 w-full"
          placeholder="e.g. 08012345678 or +2348012345678"
        />
        <button
          onClick={() => changeNumber(number)}
          className="bg-purple-600 text-white px-4 py-1 rounded mt-2"
          disabled={savingNumber}
        >
          {savingNumber ? "Saving..." : "Add Number"}
        </button>
      </div>

      {/* Logout & Delete */}
      <div className="flex flex-col gap-2 pt-4">
        <button
          onClick={handleLogout}
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

      {/* Bottom Tab */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t">
        <BottomTab />
      </div>
    </motion.div>
  );
}

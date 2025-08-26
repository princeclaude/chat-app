import { useState, useEffect, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";

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
import { FaChevronLeft } from "react-icons/fa";
import { updateProfile as updateAuthProfile } from "firebase/auth";


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

  const [number, setNumber] = useState("");
  const [profilePicFile, setProfilePicFile] = useState(null);
  const [persistedPic, setPersistedPic] = useState(null);
  const [pin, setPin] = useState(null);
  const [loading, setLoading] = useState(true);
  const [savingNumber, setSavingNumber] = useState(false);
  const [previewUrl, setPreviewUrl] = useState(null);
  const fileInputRef = useRef(null);

  // upload progress states
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const progressTimerRef = useRef(null);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const navigate = useNavigate();
  const { showToast } = useToast();

  const { fetchBackgrounds, setChatBackground } = useSettings();
  const [backgrounds, setBackgrounds] = useState([]);
  const [selectedBg, setSelectedBg] = useState(null);
  
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");

  const handleChangePassword = async () => {
    try {
      if (!currentPassword || !newPassword) {
        showToast("Enter both current and new password", "error", 2000);
        return;
      }
      await changePassword(newPassword, currentPassword);
      navigate("/signin"); // force re-login
      showToast("Password changed successfully!", "success", 2000);
    } catch (err) {
      console.error("Password change error", err);
      showToast("Failed to change password: " + err.message, "error", 2000);
    }
  };

  useEffect(() => {
    const fetch = async () => {
      const bgs = await fetchBackgrounds();
      setBackgrounds(bgs);
    };
    fetch();
  }, []);

  useEffect(() => {
    if (!profilePicFile) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(profilePicFile);
    setPreviewUrl(url);
    return () => {
      URL.revokeObjectURL(url);
    };
  }, [profilePicFile]);

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
    setShowLogoutModal(true);
  };

  const confirmLogout = async () => {
    try {
      await logout();
      navigate("/signin");
    } catch (err) {
      console.error("logout error", err);
      showToast("Failed to logout", "error", 1000);
    }
  };

  const handledeleteaccount = async () => {
    setShowDeleteModal(true);
  };

  const confirmDelete = async () => {
    try {
      await deleteAccount();
      navigate("/signin");
    } catch (err) {
      console.error("Delete faile", err);
      showToast("Delete account failed, try again", "default", 1000);
    }
  };

  const startFakeProgress = () => {
    clearInterval(progressTimerRef.current);
    // start small
    setUploadProgress(4);
    progressTimerRef.current = setInterval(() => {
      setUploadProgress((p) => {
        // nudge toward 90%, with slightly random increments for natural feeling
        if (p >= 90) return 90;
        const inc = Math.random() * 6 + 1; // 1 - 7
        return Math.min(90, Math.round((p + inc) * 10) / 10);
      });
    }, 360);
  };

  const stopFakeProgress = () => {
    if (progressTimerRef.current) {
      clearInterval(progressTimerRef.current);
      progressTimerRef.current = null;
    }
  };

  // handlePicUpload now shows progress UI while calling updateProfilePic
  const handlePicUpload = async () => {
    if (!profilePicFile) return;

    setIsUploadingPhoto(true);
    setUploadProgress(0);
    startFakeProgress();

    try {
      // call your existing upload helper (this may be using Firebase Storage, S3, Uploadcare, etc.)
      const uploadedUrl = await updateProfilePic(profilePicFile);

      // stop the fake progress and animate to 100%
      stopFakeProgress();
      setUploadProgress(100);

      // small delay so user sees the finished state
      await new Promise((res) => setTimeout(res, 350));

      // update the user doc with the returned URL
      const q = query(
        collection(db, "users"),
        where("email", "==", auth.currentUser.email.toLowerCase())
      );

      const snap = await getDocs(q);
      if (!snap.empty) {
        const userRef = doc(db, "users", snap.docs[0].id);
        await updateDoc(userRef, {
          profilePic: uploadedUrl,
          updatedAt: serverTimestamp(),
        });
        setPersistedPic(uploadedUrl); // show new image immediately
      }

      // success toast
      if (typeof showToast === "function")
        showToast("Profile picture uploaded", "success");
    } catch (err) {
      console.error("Image upload error:", err);
      stopFakeProgress();
      setUploadProgress(0);
      if (typeof showToast === "function")
        console.log("Failed to upload profile picture", "error");
    } finally {
      // cleanup UI state after small delay so animation feels smooth
      setTimeout(() => {
        setIsUploadingPhoto(false);
        setUploadProgress(0);
      }, 400);
    }
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
      <button onClick={() => navigate(-1)}>
        <FaChevronLeft size={24} className="text-purple-600 ml-1" />
      </button>
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

        {/* File picker (styled) */}
        <div className="w-full flex flex-col items-center gap-3 mt-2">
          {/* Hidden native file input */}
          <input
            id="profile-pic-input"
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0] || null;
              setProfilePicFile(f);
            }}
          />

          {/* Styled picker (click opens native picker) */}
          <label
            htmlFor="profile-pic-input"
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                fileInputRef.current?.click();
              }
            }}
            className="w-full max-w-xs mx-auto cursor-pointer rounded-xl border-2 border-dashed border-purple-200 p-4 flex flex-col items-center justify-center gap-2 text-center bg-white shadow-sm hover:border-purple-300 focus:outline-none focus:ring-2 focus:ring-purple-200 relative"
            role="button"
            tabIndex={0}
            aria-label="Select an image"
          >
            <div className="relative">
              {previewUrl || persistedPic ? (
                <img
                  src={previewUrl || persistedPic}
                  alt="Selected preview"
                  className="w-28 h-28 object-cover rounded-full border-2 border-purple-100 shadow-sm"
                />
              ) : (
                <div className="w-28 h-28 rounded-full bg-purple-50 flex items-center justify-center text-purple-400 text-2xl shadow-inner">
                  📷
                </div>
              )}

              {/* Upload overlay (shows only while uploading) */}
              {isUploadingPhoto && (
                <div className="absolute inset-0 rounded-full flex flex-col items-center justify-center bg-black/40">
                  <div className="flex flex-col items-center gap-2">
                    {/* spinner */}
                    <div className="w-10 h-10 rounded-full border-4 border-white border-t-transparent animate-spin" />
                    {/* percent */}
                    <div className="text-sm text-white font-semibold">
                      {Math.round(uploadProgress)}%
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="mt-2">
              <div className="text-sm font-semibold text-gray-800">
                Select an image
              </div>
              <div className="text-xs text-gray-500">
                Square images work best
              </div>
            </div>

            {/* Linear progress bar underneath the label area when uploading */}
            {isUploadingPhoto && (
              <div className="w-full mt-3">
                <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${uploadProgress}% ` }}
                    transition={{ ease: "easeOut", duration: 0.4 }}
                    className="h-full bg-gradient-to-r from-purple-500 to-purple-700"
                  />
                </div>
              </div>
            )}
          </label>

          {/* Upload / remove controls */}
          <div className="flex items-center gap-3">
            <button
              onClick={handlePicUpload}
              disabled={!profilePicFile || isUploadingPhoto}
              className={`px-4 py-2 rounded-lg text-white ${
                profilePicFile && !isUploadingPhoto
                  ? "bg-purple-600 hover:bg-purple-700"
                  : "bg-gray-300 cursor-not-allowed"
              }`}
            >
              {isUploadingPhoto ? "Uploading..." : "Upload"}
            </button>
            {profilePicFile && !isUploadingPhoto && (
              <button
                onClick={() => {
                  setProfilePicFile(null);
                  // also clear native input value so same file can be selected again
                  if (fileInputRef.current) fileInputRef.current.value = "";
                }}
                className="px-3 py-2 rounded-lg border border-gray-200 text-gray-700"
              >
                Remove
              </button>
            )}
          </div>
        </div>
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
      {/* Password Section */}
      <div>
        <label className="block font-semibold mb-1">Current Password</label>
        <input
          type="password"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          className="border rounded px-3 py-2 w-full mb-3"
          placeholder="Enter current password"
        />

        <label className="block font-semibold mb-1">New Password</label>
        <input
          type="password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          className="border rounded px-3 py-2 w-full"
          placeholder="Enter new password"
        />

        <button
          onClick={handleChangePassword}
          className="bg-purple-600 text-white px-4 py-1 rounded mt-3"
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
      {/* Background Selection Section */}
      <div className="mt-6">
        <h2 className="text-lg font-semibold mb-2">Choose Chat Background</h2>
        <div className="grid grid-cols-3 gap-3">
          {backgrounds.map((bg) => (
            <div key={bg.id} className="cursor-pointer">
              <img
                src={bg.url}
                alt={bg.name}
                className="w-full h-24 object-cover rounded-lg shadow"
                onClick={() => setSelectedBg(bg)} // open modal
              />
            </div>
          ))}
        </div>
      </div>
      {selectedBg && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-4 max-w-md w-full relative">
            {/* Close button */}
            <button
              onClick={() => setSelectedBg(null)}
              className="absolute top-2 right-2 text-gray-600 hover:text-black"
            >
              ✕
            </button>

            {/* Enlarged Image */}
            <img
              src={selectedBg.url}
              alt={selectedBg.name}
              className="w-full h-64 object-cover rounded mb-4"
            />

            {/* Set Background Button */}
            <button
              onClick={async () => {
                await setChatBackground(selectedBg.url);
                showToast("Chat background updated!", "success");
                setSelectedBg(null); // close modal
              }}
              className="bg-purple-600 text-white px-4 py-2 rounded w-full"
            >
              Set as Chat Background
            </button>
          </div>
        </div>
      )}

      {/* Logout & Delete */}
      <div className="flex flex-col gap-2 pt-4">
        <button
          onClick={handleLogout}
          className="bg-gray-800 text-white px-4 py-2 rounded"
        >
          Logout
        </button>
        <button
          onClick={handledeleteaccount}
          className="bg-red-600 text-white px-4 py-2 rounded"
        >
          Delete Account
        </button>
      </div>
      <AnimatePresence>
        {showLogoutModal && (
          <motion.div
            className="fixed inset-0 bg-black/40 flex items-end justify-center z-50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowLogoutModal(false)}
          >
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", stiffness: 120 }}
              className="bg-white w-full max-w-md rounded-t-2xl p-6 shadow-lg"
              onClick={(e) => e.stopPropagation()} // prevent backdrop close
            >
              <h2 className="text-lg font-bold text-center text-purple-700 mb-4">
                Sure you want to log out?
              </h2>

              <div className="flex gap-3">
                <button
                  onClick={confirmLogout}
                  className="flex-1 bg-purple-600 text-white py-2 rounded-lg hover:bg-purple-700 transition"
                >
                  Continue
                </button>
                <button
                  onClick={() => setShowLogoutModal(false)}
                  className="flex-1 bg-gray-200 text-black py-2 rounded-lg hover:bg-gray-300 transition"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {showDeleteModal && (
          <motion.div
            className="fixed inset-0 bg-black/40 flex items-end justify-center z-50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowDeleteModal(false)}
          >
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", stiffness: 120 }}
              className="bg-white w-full max-w-md rounded-t-2xl p-6 shadow-lg"
              onClick={(e) => e.stopPropagation()}
            >
              <h2 className="text-lg font-bold text-center text-purple-700 mb-4">
                Sure you want to delete your account?
              </h2>

              <div className="flex gap-3">
                <button
                  onClick={confirmDelete}
                  className="flex-1 bg-purple-600 text-white py-2 rounded-lg hover:bg-purple-700 transition"
                >
                  Continue
                </button>
                <button
                  onClick={() => setShowDeleteModal(false)}
                  className="flex-1 bg-gray-200 text-black py-2 rounded-lg hover:bg-gray-300 transition"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
// SettingsContext.jsx
import React, { createContext, useContext, useState, useEffect } from "react";
import { auth, db } from "../firebase";
import {
  updateEmail as fbUpdateEmail,
  updatePassword as fbUpdatePassword,
  signOut,
  deleteUser,
} from "firebase/auth";
import { doc, updateDoc, getDoc } from "firebase/firestore";
import { UploadClient } from "@uploadcare/upload-client";

const SettingsContext = createContext();
export const useSettings = () => useContext(SettingsContext);

export const SettingsProvider = ({ children }) => {
  const [userData, setUserData] = useState(null);
  const [loadingUser, setLoadingUser] = useState(true);

  // Fetch user data by email
  useEffect(() => {
    const fetchUserData = async () => {
      if (!auth.currentUser?.email) {
        setLoadingUser(false);
        return;
      }

      const userDoc = await getDoc(doc(db, "users", auth.currentUser.email));
      if (userDoc.exists()) {
        setUserData(userDoc.data());
      }
      setLoadingUser(false);
    };

    fetchUserData();
  }, []);

  // ✅ Update profile picture with Uploadcare
  const updateProfilePic = async (file) => {
    if (!auth.currentUser?.email) {
      console.error("User email is missing");
      return;
    }

    try {
      // Upload to Uploadcare
      const client = new UploadClient({ publicKey: "86ef078d93587e6ae382" });
      const uploadedFile = await client.uploadFile(file);
      const imageUrl = uploadedFile.cdnUrl;

      // Save URL to Firestore
      await updateDoc(doc(db, "users", auth.currentUser.email), {
        profilePic: imageUrl,
      });

      // Update local state
      setUserData((prev) => ({ ...prev, profilePic: imageUrl }));
      console.log("Profile picture updated successfully:", imageUrl);
    } catch (error) {
      console.error("Error uploading profile picture:", error);
    }
  };

  // ✅ Update email
  const changeEmail = async (newEmail) => {
    if (!auth.currentUser) return;
    await fbUpdateEmail(auth.currentUser, newEmail);
    await updateDoc(doc(db, "users", auth.currentUser.email), {
      email: newEmail,
    });
  };

  // ✅ Update password
  const changePassword = async (newPassword) => {
    if (!auth.currentUser) return;
    await fbUpdatePassword(auth.currentUser, newPassword);
  };

  // ✅ Logout
  const logout = async () => {
    await signOut(auth);
  };

  // ✅ Delete account
  const deleteAccount = async () => {
    if (!auth.currentUser) return;
    await deleteUser(auth.currentUser);
    await updateDoc(doc(db, "users", auth.currentUser.email), {
      deleted: true,
    });
  };

  return (
    <SettingsContext.Provider
      value={{
        userData,
        loadingUser,
        updateProfilePic,
        changeEmail,
        changePassword,
        logout,
        deleteAccount,
      }}
    >
      {children}
    </SettingsContext.Provider>
  );
};

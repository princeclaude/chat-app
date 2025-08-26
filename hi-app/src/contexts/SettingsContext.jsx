import React, { createContext, useContext, useState, useEffect } from "react";
import { auth, db } from "../firebase";

import {
  updateEmail as fbUpdateEmail,
  updatePassword as fbUpdatePassword,
  signOut,
  deleteUser,
  EmailAuthProvider,
  reauthenticateWithCredential,
} from "firebase/auth";
import {
  doc,
  updateDoc,
  getDoc,
  collection,
  getDocs,
} from "firebase/firestore";
import { UploadClient } from "@uploadcare/upload-client";


const SettingsContext = createContext();
export const useSettings = () => useContext(SettingsContext);

export const SettingsProvider = ({ children }) => {
  const [userData, setUserData] = useState(null);
  const [loadingUser, setLoadingUser] = useState(true);
  const [backgrounds, setBackgrounds] = useState([]);

  const reauthenticate = async (password) => {
    if (!auth.currentUser?.email) throw new Error("No user logged in");

    const credential = EmailAuthProvider.credential(
      auth.currentUser.email,
      password
    );

    await reauthenticateWithCredential(auth.currentUser, credential);
  };
  


  // Fetch user data
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

  // ✅ Fetch all available backgrounds
  const fetchBackgrounds = async () => {
    try {
      const querySnapshot = await getDocs(collection(db, "backgrounds"));
      const list = [];
      querySnapshot.forEach((docSnap) => {
        list.push({ id: docSnap.id, ...docSnap.data() });
      });
      setBackgrounds(list);
      return list;
    } catch (error) {
      console.error("Error fetching backgrounds:", error);
    }
  };

  // ✅ Update selected background for the user
  const setChatBackground = async (backgroundUrl) => {
    if (!auth.currentUser?.email) return;

    try {
      await updateDoc(doc(db, "users", auth.currentUser.email), {
        chatBackground: backgroundUrl,
      });

      setUserData((prev) => ({ ...prev, chatBackground: backgroundUrl }));
      console.log("Chat background updated:", backgroundUrl);
    } catch (error) {
      console.error("Error setting background:", error);
    }
  };

  // ✅ Update profile picture with Uploadcare
  const updateProfilePic = async (file) => {
    if (!auth.currentUser?.email) {
      console.error("User email is missing");
      return;
    }

    try {
      const client = new UploadClient({ publicKey: "86ef078d93587e6ae382" });
      const uploadedFile = await client.uploadFile(file);
      const imageUrl = uploadedFile.cdnUrl;

      await updateDoc(doc(db, "users", auth.currentUser.email), {
        profilePic: imageUrl,
      });

      setUserData((prev) => ({ ...prev, profilePic: imageUrl }));
      console.log("Profile picture updated successfully:", imageUrl);
    } catch (error) {
      console.error("Error uploading profile picture:", error);
    }
  };

  const changeEmail = async (newEmail, currentPassword) => {
    try {
      await reauthenticate(currentPassword); // user must enter current password
      await fbUpdateEmail(auth.currentUser, newEmail);

      await updateDoc(doc(db, "users", auth.currentUser.uid), {
        email: newEmail,
      });

      console.log("Email updated successfully");
    } catch (error) {
      console.error("Error updating email:", error);
      throw error;
    }
  };

  // ✅ Update password (with re-authentication)
  const changePassword = async (newPassword, currentPassword) => {
    try {
      await reauthenticate(currentPassword); // re-auth first
      await fbUpdatePassword(auth.currentUser, newPassword);
      console.log("Password updated successfully");
    } catch (error) {
      console.error("Error updating password:", error);
      throw error;
    }
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
        backgrounds, // ✅ all available backgrounds
        fetchBackgrounds, // ✅ call to fetch from Firestore
        setChatBackground, // ✅ update selected background
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

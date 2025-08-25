// src/contexts/ProfileContext.jsx
import { createContext, useContext, useEffect, useState } from "react";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
} from "firebase/auth";
import {
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  serverTimestamp,
} from "firebase/firestore";
import { app, db } from "../firebase";
import { toast } from "react-toastify";
import { useToast } from "../contexts/ToastContext";
import { sendPasswordResetEmail } from "firebase/auth";

// Context setup
const ProfileContext = createContext();
export const useProfile = () => useContext(ProfileContext);

export const ProfileProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const { showToast } = useToast();
  const auth = getAuth(app);


  
  const resetPassword = async (email) => {
    try {
      if (!email) {
        showToast("Please enter your email", "default", 1000);
        return false;
      }

      const actionCodeSettings = {
        url: "https://chat-app-blush-one.vercel.app/reset-password",
        handleCodeInApp: false,
      };

      
      await sendPasswordResetEmail(auth, email, actionCodeSettings);

      showToast(
        "Password reset email sent! Check your inbox.",
        "default",
        2000
      );
      return true;
    } catch (err) {
      console.error("resetPassword error:", err.code, err.message);
      if (err.code === "auth/user-not-found") {
        showToast("No account found with this email", "default", 2000);
      } else if (err.code === "auth/invalid-email") {
        showToast("Invalid email format", "default", 2000);
      } else {
        showToast("Failed to send reset email", "default", 2000);
      }
      return false;
    }
  };
  
  const generatePin = () => {
    const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let pin = "";
    for (let i = 0; i < 5; i++) {
      pin += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    return pin;
  };

  
  const signup = async (email, password) => {
    try {
      const existingUser = await getDoc(doc(db, "users", email));
      if (existingUser.exists()) {
        toast.error("Email already registered");
        return;
      }

      const pin = generatePin();

      const res = await createUserWithEmailAndPassword(auth, email, password);
      const createdUser = res.user;

      await setDoc(doc(db, "users", email), {
        email,
        pin,
        verified: false,
        accountPrivacy: "unlocked",
        createdAt: serverTimestamp(),
      });

      // --- REPLACE WITH THIS in signup (after creating users/{email}) ---
      const teamId = "chirp-team@system.local"; // canonical team id (use stable id)
      const sanitize = (s = "") =>
        String(s)
          .toLowerCase()
          .replace(/[^a-z0-9]/g, "_");

      // ensure a "chirp-team" user exists (optional if you already created it elsewhere)
      await setDoc(
        doc(db, "users", teamId),
        {
          email: teamId,
          pin: "Chirp Team",
          profilePic: null, // or a URL to your team avatar
          system: true,
          createdAt: serverTimestamp(),
        },
        { merge: true }
      );

      
      const a = sanitize(email);
      const b = sanitize(teamId);
      const convoId = [a, b].sort().join("");

      // conversation doc at top level
      const convoRef = doc(db, "conversations", convoId);
      const convoSnap = await getDoc(convoRef);
      if (!convoSnap.exists()) {
        await setDoc(convoRef, {
          id: convoId,
          participants: [email, teamId],
          otherUserEmail: teamId, 
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          lastMessage:
            "👋 Welcome to Chirp! Tap the links below to learn more.",
          lastMessageTime: serverTimestamp(),
          isSystemConversation: true,
          archived: false,
        });
      }

      // add a single welcome message (idempotent)
      const welcomeMsgRef = doc(
        db,
        "conversations",
        convoId,
        "messages",
        "welcome"
      );
      // const welcomeSnap = await getDoc(welcomeMsgRef);
      // if (!welcomeSnap.exists()) {
      //   await setDoc(welcomeMsgRef, {
      //     id: "welcome",
      //     sender: teamId,
      //     text: "Welcome to Chirp 🎉\n\nPrivacy Policy: https://yourapp.com/privacy\nAbout Us: https://yourapp.com/about\nContact: https://yourapp.com/contact",
      //     createdAt: serverTimestamp(),
      //     status: "delivered",
      //     nonReplyable: true,
      //   });
      // }

      // update conversation metadata (safe to run even if exists)
      await setDoc(
        convoRef,
        {
          lastMessage:
            "👋 Welcome to Chirp! Tap the links below to learn more.",
          lastMessageTime: serverTimestamp(),
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
  

      setUser(createdUser);
      setProfile({ email, pin, verified: false });
      toast.success("Signup successful");
      return pin;
    } catch (error) {
      toast.error(error.message || "Signup failed");
    }
  };

  
  const signin = async (email, password) => {
    try {
      if (!email || !password) {
        showToast("Email and password are required", "default", 1000);
        return false;
      }

      
      const userDocRef = doc(db, "users", email);
      const profileDoc = await getDoc(userDocRef);

      if (!profileDoc.exists()) {
        showToast("No account found with this email", "default",1000);
        return false; 
      }

      
      const res = await signInWithEmailAndPassword(auth, email, password);
      const signedInUser = res.user;

      
      const profileData = profileDoc.data();

      
      setUser(signedInUser);
      setProfile(profileData);

      
      await setDoc(doc(db, "currentUsers", email), {
        ...profileData,
        email,
        lastActive: serverTimestamp(),
      });

      
      return true;
    } catch (err) {
      
      if (err.code === "auth/wrong-password") {
        showToast("Incorrect password", "default", 1000);
      } else if (err.code === "auth/user-not-found") {
        showToast("No user found with these credentials", "default", 1000);
      } else {
        showToast( "Sign-in failed, check email or password!", "default", 1000);
      }

      return false;
    }
  };
  
  const signout = async () => {
    try {
      if (auth.currentUser?.email) {
        await deleteDoc(doc(db, "currentUsers", auth.currentUser.email));
      }
      await firebaseSignOut(auth);
      setUser(null);
      setProfile(null);
      toast.success("Signed out");
    } catch (err) {
      toast.error("Failed to sign out");
    }
  };

  
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);

      if (firebaseUser?.email) {
        const profileDoc = await getDoc(doc(db, "users", firebaseUser.email));
        if (profileDoc.exists()) {
          const profileData = profileDoc.data();
          setProfile(profileData);
          await setDoc(doc(db, "currentUsers", firebaseUser.email), {
            ...profileData,
            email: firebaseUser.email,
            lastActive: serverTimestamp(),
          });
        }
      } else {
        setProfile(null);
      }

      setLoading(false);
    });

    // Remove currentUser on unload
    const handleUnload = async () => {
      if (auth.currentUser?.email) {
        await deleteDoc(doc(db, "currentUsers", auth.currentUser.email));
      }
    };
    window.addEventListener("beforeunload", handleUnload);

    return () => {
      unsubscribe();
      window.removeEventListener("beforeunload", handleUnload);
    };
  }, []);

  return (
    <ProfileContext.Provider
      value={{
        user,
        profile,
        loading,
        signup,
        signin,
        signout,
        resetPassword,
      }}
    >
      {children}
    </ProfileContext.Provider>
  );
};

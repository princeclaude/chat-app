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
import { auth, db } from "../firebase";
import { toast } from "react-toastify";
import { useToast } from "../contexts/ToastContext";

// Context setup
const ProfileContext = createContext();
export const useProfile = () => useContext(ProfileContext);

export const ProfileProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const { showToast } = useToast();

  
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
        createdAt: serverTimestamp(),
      });

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

  // 🔄 Auto-login listener
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
      }}
    >
      {children}
    </ProfileContext.Provider>
  );
};

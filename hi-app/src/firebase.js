import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getMessaging } from "firebase/messaging"; // ✅ Import messaging

const firebaseConfig = {
  apiKey: "AIzaSyD9Qu-nSOfIE8g5BswnzMnJ0oa2DYJmMqM",
  authDomain: "hi-app-4f799.firebaseapp.com",
  databaseURL:
    "https://hi-app-4f799-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "hi-app-4f799",
  storageBucket: "hi-app-4f799.appspot.com",
  messagingSenderId: "376315716692",
  appId: "1:376315716692:web:0146b76463c5190af7f9c1",
};

export const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app); 
export const messaging = getMessaging(app); 

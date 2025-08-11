import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getMessaging, getToken, onMessage } from "firebase/messaging";

const firebaseConfig = {
  apiKey: "AIzaSyD9Qu-nSOfIE8g5BswnzMnJ0oa2DYJmMqM",
  authDomain: "hi-app-4f799.firebaseapp.com",
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

export const requestForToken = async () => {
  try {
    const currentToken = await getToken(messaging, {
      vapidKey:
        "BBcHArMmnKqG2aK3rBuc3bNyVh6mNAXgki4V0-izBsDVOWLzJ_cyRGBST_i4wTYjcNP2kQlTNwEQwQjJLpqi7gU", // paste your VAPID key here
    });
    if (currentToken) {
      console.log("Token:", currentToken);
      return currentToken;
    } else {
      console.log("No registration token available.");
    }
  } catch (err) {
    console.error("An error occurred while retrieving token.", err);
  }
};

// src/firebase/firebaseMessaging.js
import { messaging } from "./firebaseConfig";
import { getToken } from "firebase/messaging";

export const requestForToken = async () => {
  try {
    const currentToken = await getToken(messaging, {
      vapidKey:
        "BBcHArMmnKqG2aK3rBuc3bNyVh6mNAXgki4V0-izBsDVOWLzJ_cyRGBST_i4wTYjcNP2kQlTNwEQwQjJLpqi7gU",
    });

    if (currentToken) {
      console.log("FCM Token:", currentToken);
      // You can save this token to Firestore under the user’s document
    } else {
      console.log("No registration token available. Request permission.");
    }
  } catch (error) {
    console.error("An error occurred while retrieving token. ", error);
  }
};

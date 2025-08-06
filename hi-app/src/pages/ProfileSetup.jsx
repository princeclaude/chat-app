import { useState, useEffect } from "react";
import {
  getStorage,
  ref,
  uploadBytes,
  getDownloadURL,
} from "firebase/storage";
import { db, auth } from "../firebase";
import {
  doc,
  updateDoc,
  getDocs,
  query,
  where,
  collection,
} from "firebase/firestore";
import {
  signInAnonymously,
  onAuthStateChanged
} from "firebase/auth";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { useNavigate, useLocation } from "react-router-dom";

export default function ProfileSetup() {
  const [image, setImage] = useState(null);
  const [preview, setPreview] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [userId, setUserId] = useState(null);

  const navigate = useNavigate();
  const location = useLocation();
  const userEmail = location.state?.email;

  // Sign in anonymously
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setUserId(user.uid);
      } else {
        try {
          const result = await signInAnonymously(auth);
          setUserId(result.user.uid);
        } catch (error) {
          console.error("Anonymous sign-in failed", error);
          toast.error("Could not authenticate. Please try again.", {
            position: "top-center",
          });
        }
      }
    });

    return () => unsubscribe();
  }, []);

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setImage(file);
      setPreview(URL.createObjectURL(file));
    }
  };

  const handleUpload = async () => {
    if (!image) {
      toast.warning("Please select an image", { position: "top-center" });
      return;
    }

    try {
      setUploading(true);
      const storage = getStorage();
      const storageRef = ref(storage, `profilePics/${userId}`);
      await uploadBytes(storageRef, image);
      const downloadURL = await getDownloadURL(storageRef);

      // Update Firestore user doc by email
      const usersRef = collection(db, "users");
      const q = query(usersRef, where("email", "==", userEmail.toLowerCase()));
      const querySnapshot = await getDocs(q);

      if (!querySnapshot.empty) {
        const userDoc = querySnapshot.docs[0];
        const userDocRef = doc(db, "users", userDoc.id);
        await updateDoc(userDocRef, {
          profilePic: downloadURL,
        });
      }

      toast.success("Profile picture uploaded!", { position: "top-center" });
      navigate("/home");
    } catch (error) {
      console.error(error);
      toast.error("Upload failed. Try again.", { position: "top-center" });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-start bg-white p-4 pt-8">
      <ToastContainer />

      <div className="w-full max-w-md mb-6">
        <h1 className="font-poppins text-purple-700 text-2xl font-bold tracking-tight">hi!</h1>
      </div>

      <div className="w-full max-w-md bg-white shadow-md rounded-lg p-6 text-center">
        <h2 className="text-xl font-semibold mb-4 text-gray-800">
          Set Your Profile Picture
        </h2>

        {preview ? (
          <img
            src={preview}
            alt="Preview"
            className="w-32 h-32 object-cover rounded-full mx-auto mb-4"
          />
        ) : (
          <div className="w-32 h-32 rounded-full bg-gray-200 mx-auto mb-4 flex items-center justify-center text-gray-500">
            No Image
          </div>
        )}

        <input
          type="file"
          accept="image/*"
          className="mb-4"
          onChange={handleImageChange}
        />

        <button
          onClick={handleUpload}
          disabled={uploading}
          className={`w-full ${
            uploading ? "bg-gray-400" : "bg-purple-600 hover:bg-purple-700"
          } text-white font-semibold py-3 rounded transition`}
        >
          {uploading ? "Uploading..." : "Save & Continue"}
        </button>
      </div>
 </div>
);
}
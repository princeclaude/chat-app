import React, { useState } from "react";
import { useProfile } from "../contexts/ProfileContext";
import { motion, AnimatePresence } from "framer-motion";

const ForgotPasswordModal = ({ isOpen, onClose }) => {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState(null);
  const { resetPassword } = useProfile();

  if (!isOpen) return null;

  const handleReset = async (e) => {
    e.preventDefault();
    try {
      await resetPassword(email);
      setStatus("success");
    } catch (err) {
      console.error("Reset password error:", err);
      setStatus("error");
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 bg-black bg-opacity-40 flex items-end justify-center z-50"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose} // close if backdrop clicked
        >
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 120 }}
            className="bg-white w-full max-w-md rounded-t-2xl p-6 shadow-lg"
            onClick={(e) => e.stopPropagation()} // prevent closing when modal clicked
          >
            <h2 className="text-xl font-bold mb-4 text-center text-purple-700">
              Reset Password
            </h2>

            {status === "success" ? (
              <p className="text-green-600 text-center">
                ✅ A reset link has been sent to your email.
              </p>
            ) : (
              <form onSubmit={handleReset} className="space-y-4">
                <input
                  type="email"
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  required
                />
                <button
                  type="submit"
                  className="w-full bg-purple-600 text-white py-2 rounded-lg hover:bg-purple-700 transition"
                >
                  Send Reset Link
                </button>
              </form>
            )}

            {status === "error" && (
              <p className="text-red-600 mt-3 text-center">
                Failed to send reset email. Please check your address.
              </p>
            )}

                      <button
                          type="button"
              onClick={onClose}
              className="mt-6 w-full bg-gray-200 text-black py-2 rounded-lg hover:bg-gray-300 transition"
            >
              Close
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default ForgotPasswordModal;

import React, { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { verifyPasswordResetCode, confirmPasswordReset } from "firebase/auth";
import { auth } from "../firebase"; // adapt if you export auth differently
import { useToast } from "../contexts/ToastContext";
import { FaEye, FaEyeSlash } from "react-icons/fa";

export default function ResetPassword() {
  const location = useLocation();
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [oobCode, setOobCode] = useState(null);
  const [email, setEmail] = useState("");
  const [codeValid, setCodeValid] = useState(false);
  const [loading, setLoading] = useState(true);

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    // parse oobCode from URL
    const params = new URLSearchParams(location.search);
    const code = params.get("oobCode") || params.get("oobcode") || null;
    setOobCode(code);

    if (!code) {
      setCodeValid(false);
      setLoading(false);
      return;
    }

    // verify the code (returns the email if valid)
    (async () => {
      setLoading(true);
      try {
        const acctEmail = await verifyPasswordResetCode(auth, code);
        setEmail(acctEmail || "");
        setCodeValid(true);
      } catch (err) {
        console.error("verifyPasswordResetCode error:", err);
        setCodeValid(false);
        showToast?.(
          "This password reset link is invalid or expired.",
          "default",
          3000
        );
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.search]);

  const validate = () => {
    if (!password || !confirm) {
      showToast?.(
        "Please enter and confirm your new password",
        "default",
        1800
      );
      return false;
    }
    if (password !== confirm) {
      showToast?.("Passwords do not match", "default", 1800);
      return false;
    }
    if (password.length < 6) {
      // Firebase minimum is 6
      showToast?.("Password must be at least 6 characters", "default", 2000);
      return false;
    }
    return true;
  };

  const handleSubmit = async (e) => {
    e?.preventDefault?.();
    if (!oobCode) {
      showToast?.("Missing reset code", "default", 2000);
      return;
    }
    if (!validate()) return;

    setSubmitting(true);
    try {
      await confirmPasswordReset(auth, oobCode, password);
      showToast?.(
        "Password reset successful — please sign in",
        "default",
        2500
      );
      setTimeout(() => navigate("/signin"), 900);
    } catch (err) {
      console.error("confirmPasswordReset error:", err);
      // Map common errors to friendly messages
      const code = err?.code || "";
      if (code.includes("expired")) {
        showToast?.(
          "This reset link has expired. Request a new one.",
          "default",
          3000
        );
      } else if (
        code.includes("invalid-action-code") ||
        code.includes("invalid")
      ) {
        showToast?.("Invalid reset link. Request a new one.", "default", 3000);
      } else if (code.includes("weak-password")) {
        showToast?.("Password too weak. Use >= 6 characters.", "default", 3000);
      } else {
        showToast?.("Failed to reset password. Try again.", "default", 3000);
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <AnimatePresence>
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 20, opacity: 0 }}
          className="w-full max-w-md bg-white rounded-xl p-6 shadow"
        >
          <h2 className="text-xl font-semibold text-purple-600 mb-4 text-center">
            Reset your password
          </h2>

          {loading ? (
            <p className="text-center text-gray-500">Verifying link…</p>
          ) : !codeValid ? (
            <>
              <p className="text-center text-red-600">
                This password reset link is invalid or expired.
              </p>
              <div className="mt-4">
                <button
                  onClick={() => navigate("/signin")}
                  className="w-full bg-purple-600 text-white py-2 rounded"
                >
                  Back to Sign in
                </button>
              </div>
            </>
          ) : (
            <>
              <p className="text-sm text-gray-600 mb-4 text-center">
                Resetting account:{" "}
                <strong className="text-gray-800">{email}</strong>
              </p>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="New password (min 6 chars)"
                    className="w-full px-4 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-purple-500"
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((s) => !s)}
                    className="absolute right-3 top-2.5 text-gray-500"
                  >
                    {showPassword ? <FaEyeSlash /> : <FaEye />}
                  </button>
                </div>

                <input
                  type="password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder="Confirm new password"
                  className="w-full px-4 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-purple-500"
                  autoComplete="new-password"
                />

                <button
                  type="submit"
                  disabled={submitting}
                  className={`w-full py-2 rounded text-white ${
                    submitting
                      ? "bg-gray-400"
                      : "bg-purple-600 hover:bg-purple-700"
                  }`}
                >
                  {submitting ? "Resetting…" : "Set new password"}
                </button>
              </form>

              <div className="mt-4 text-center">
                <button
                  onClick={() => navigate("/signin")}
                  className="text-sm text-purple-600 hover:underline"
                >
                  Back to sign in
                </button>
              </div>
            </>
          )}
        </motion.div>
      </AnimatePresence>
      
    </div>
  );
}

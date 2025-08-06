import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { useNavigate, Link } from "react-router-dom";
import { FaEye, FaEyeSlash } from "react-icons/fa";
import { useProfile } from "../contexts/ProfileContext";

export default function Signup() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [pin, setPin] = useState("");
  const navigate = useNavigate();
  const { signup } = useProfile();

  const handleSignup = async (e) => {
    e.preventDefault();
    setPin("");

    if (!email || !email.includes("@")) {
      toast.warning("Please enter a valid email");
      return;
    }

    if (!password) {
      toast.warning("Please enter password");
      return;
    }

    if (password.length > 8) {
      toast.warning("Password must be 8 characters or less");
      return;
    }

    try {
      const generatedPin = await signup(email, password);
      setPin(generatedPin);
      // toast.success("PIN created successfully!");
      setEmail("");
      setPassword("");
    } catch (err) {
      toast.error(err.message || "Something went wrong. Try again.");
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(pin);
      toast.info("PIN copied to clipboard");
    } catch {
      toast.error("Failed to copy PIN");
    }
  };

  
  useEffect(() => {
    if (pin) {
      const timer = setTimeout(() => {
        navigate("/");
      }, 6000);

      return () => clearTimeout(timer);
    }
  }, [pin, navigate]);

  useEffect(() => {
    return () => {
      setEmail("");
      setPassword("");
      setPin("");
      setShowPassword(false);
    };
  }, []);


  return (
    <div className="min-h-screen flex flex-col items-center justify-start bg-white p-4 pt-8">
      <ToastContainer />
      <div className="w-full max-w-md mb-6">
        <h1 className="font-poppins text-purple-700 text-2xl font-bold tracking-tight">
          Hey!
        </h1>
      </div>
      <div className="bg-white w-full max-w-md shadow-xl rounded-lg p-6">
        {!pin ? (
          <form onSubmit={handleSignup} autoComplete="off">
            <h2 className="text-xl font-semibold mb-4 text-gray-700 text-center">
              Create Your Account
            </h2>

            <input
              type="email"
              placeholder="Enter your email"
              className="w-full p-3 border border-gray-300 rounded mb-4 focus:outline-none focus:ring-2 focus:ring-purple-500"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="new-email"
            />

            <div className="relative mb-4">
              <input
                type={showPassword ? "text" : "password"}
                placeholder="Enter password"
                maxLength={8}
                className="w-full p-3 pr-10 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-purple-500"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                className="absolute right-3 top-3 text-gray-500"
              >
                {showPassword ? <FaEyeSlash /> : <FaEye />}
              </button>
            </div>

            <p className="text-sm mb-3 text-left">
              <Link className="text-purple-500 italic" to="/">
                Already have an account?
              </Link>
            </p>

            <button className="w-full bg-purple-600 hover:bg-purple-700 text-white font-semibold py-3 rounded transition">
              Sign Up
            </button>
          </form>
        ) : (
          <div className="text-center">
            <h2 className="text-lg font-medium text-gray-700 mb-2">
              Your Hey! PIN:
            </h2>
            <motion.div
              className="text-4xl font-bold text-purple-700 tracking-widest mb-3"
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.6 }}
            >
              {pin}
            </motion.div>
            <button
              onClick={handleCopy}
              className="mb-3 px-4 py-2 bg-gray-200 hover:bg-gray-300 text-sm rounded"
            >
              Copy PIN
            </button>
            <p className="text-gray-500 text-sm mt-2">
              Redirecting to sign in in a few seconds...
            </p>
          </div>
        )}
      </div>
      
    </div>
  );
}

import { useState } from "react";
import { useProfile } from "../contexts/ProfileContext";
import { useNavigate, Link } from "react-router-dom";
import { FaUserPlus } from "react-icons/fa";

import { useToast } from "../contexts/ToastContext";
import { FaEye, FaEyeSlash } from "react-icons/fa";

const Signin = () => {
  const { signin } = useProfile();
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const { showToast } = useToast();
  const [showPassword, setShowPassword] = useState(false);

  const handleSignin = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      showToast("Email and password are required", "default", 1000)
      return;
    }

    setLoading(true);

    try {
      const success = await signin(email, password);

      if (success) {
        showToast("Signed in successfully!", "default", 1000)
        navigate("/home");
      }
    } catch (error) {
      console.log("error signing in", error);
      showToast("Invalid email or password", "default", 1000)
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 p-4 pt-8 flex  flex-col items-center justify-start">
      <div className="w-full max-w-md mb-6">
        <h1 className="font-poppins text-purple-700 text-2xl font-bold tracking-tight">
          Chirp!
        </h1>
      </div>

      <div className="w-full max-w-md">
        <form
          onSubmit={handleSignin}
          className="w-full bg-white p-6 rounded-xl shadow-md"
          autoComplete="off"
        >
          <h2 className="text-xl font-semibold text-purple-600 mb-4">
            Sign In
          </h2>

          <input
            type="email"
            placeholder="Email"
            className="w-full p-3 mb-4 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-purple-500"
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
              className="absolute right-3 top-3 text-gray-500 mt-3"
            >
              {showPassword ? <FaEyeSlash /> : <FaEye />}
            </button>
          </div>

          <div className="flex items-center justify-between mb-4">
            <Link to="/" className="text-sm text-purple-500 hover:underline">
              Forgot password?
            </Link>
            <Link to="/signup" className="text-purple-600 text-xl">
              <FaUserPlus />
            </Link>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-purple-600 text-white py-3 rounded hover:bg-purple-700 transition duration-200"
          >
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>
      </div>
    </div>
  );
};

export default Signin;

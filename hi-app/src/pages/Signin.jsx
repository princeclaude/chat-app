import { useState } from "react";
import { useProfile } from "../contexts/ProfileContext";
import { useNavigate, Link } from "react-router-dom";
import { FaUserPlus } from "react-icons/fa";
import { toast } from "react-toastify";

const Signin = () => {
  const { signin } = useProfile();
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSignin = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      toast.warning("Email and password are required");
      return;
    }

    setLoading(true);

    try {
      const success = await signin(email, password);

      if (success) {
        toast.success("Signed in successfully");
        navigate("/home");
      }
    } catch (error) {
      console.log("error signing in", error);
      toast.error("Invalid email or password");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 p-4 pt-8 flex  flex-col items-center justify-start">
      
      <div className="w-full max-w-md mb-6">
        <h1 className="font-poppins text-purple-700 text-2xl font-bold tracking-tight">
          Hey!
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

          <input
            type="password"
            placeholder="Password"
            className="w-full p-3 mb-4 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-purple-500"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
          />

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

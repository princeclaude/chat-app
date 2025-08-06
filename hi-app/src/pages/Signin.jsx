// src/pages/Signin.jsx
import { useState } from "react";
import { useProfile } from "../contexts/ProfileContext";
import { useNavigate, Link} from "react-router-dom";
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
      const success = await signin(email, password); // this will throw if auth fails

      if (success) {
        toast.success("Signed in successfully");
        navigate("/home"); // only runs if no error
      }

      
      
    } catch (error) {
      console.log("error signing in", error)
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 px-4">
      
      <form
        onSubmit={handleSignin}
        className="w-full max-w-md bg-white p-6 rounded shadow"
        autoComplete="off"
      >
        <h2 className="text-2xl font-semibold text-center text-purple-600 mb-4">
          Sign In
        </h2>

        <input
          type="email"
          placeholder="Email"
          className="w-full p-2 mb-3 border border-gray-300 rounded"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="new-email"
        />

        <input
          type="password"
          placeholder="Password"
          className="w-full p-2 mb-3 border border-gray-300 rounded"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="new-password"
        />

        
        <div className="flex flex-row gap-5 items-center justify-between mb-2">
          <p>
            <Link className="text-sm text-purple-400 mb-4" to="/">
              Forgot password?
            </Link>
         </p>
          <Link to="/signup">
            <FaUserPlus className="text-purple-600  text-lg"/>
            
          </Link>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-purple-600 text-white py-2 rounded hover:bg-purple-700 transition"
        >
          {loading ? "Signing in..." : "Sign In"}
        </button>
      </form>
    </div>
  );
};

export default Signin;

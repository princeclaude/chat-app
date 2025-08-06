// src/App.jsx
import Navigation from "./Navigation";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { ProfileProvider } from "./contexts/ProfileContext";


function App() {
  return (
    <>
      <ProfileProvider>
        <ToastContainer position="top-right" autoClose={1000}
          hideProgressBar={true}
          closeOnClick
          pauseOnHover={false}
          draggable={false}
          pauseOnFocusLoss={false}
        />
        <Navigation />
      </ProfileProvider>
    </>
  );
}

export default App;

// src/App.jsx
import Navigation from "./Navigation";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { ProfileProvider } from "./contexts/ProfileContext";


function App() {
  return (
    <>
      <ProfileProvider>
        <ToastContainer position="top-center" autoClose={1000}
          hideProgressBar={true}
          closeOnClick
          pauseOnHover={false}
          draggable={false}
          pauseOnFocusLoss={false}
          icon={false}
          
        />
        <Navigation />
      </ProfileProvider>
    </>
  );
}

export default App;

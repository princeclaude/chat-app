// src/App.jsx
import Navigation from "./Navigation";
// import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { ProfileProvider } from "./contexts/ProfileContext";
import { ToastProvider } from "./contexts/ToastContext";
import { SettingsProvider } from "./contexts/SettingsContext";


function App() {
  return (
    <>
      <ProfileProvider>
        <SettingsProvider>
          <ToastProvider>
            <Navigation />
          </ToastProvider>
        </SettingsProvider>
      </ProfileProvider>
    </>
  );
}

export default App;

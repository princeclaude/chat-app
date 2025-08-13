// src/App.jsx
import Navigation from "./Navigation";
// import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { ProfileProvider } from "./contexts/ProfileContext";
import { ToastProvider } from "./contexts/ToastContext";
import { SettingsProvider } from "./contexts/SettingsContext";
import { AudioCallProvider } from "./contexts/AudioCallContext";




function App() {
  
  return (
    <>
      <ToastProvider>
      <ProfileProvider>
        <AudioCallProvider>
          <SettingsProvider>
            
              <Navigation />
            
          </SettingsProvider>
        </AudioCallProvider>
      </ProfileProvider>
      </ToastProvider>
    </>
  );
}

export default App;

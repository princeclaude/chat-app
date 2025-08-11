import { useEffect } from "react";
import Navigation from "./Navigation";
import "react-toastify/dist/ReactToastify.css";
import { ProfileProvider } from "./contexts/ProfileContext";
import { ToastProvider } from "./contexts/ToastContext";
import { SettingsProvider } from "./contexts/SettingsContext";
import { AudioCallProvider } from "./contexts/AudioCallContext";
import UseDisableBrowserNavigation from "./hooks/UseDisableBrowserNavigation";
import { requestForToken } from "./firebase";

function App() {
  UseDisableBrowserNavigation(true, () => {
    console.log("This is prevented, use in-app navigation!");
  });

  useEffect(() => {
    Notification.requestPermission().then((permission) => {
      if (permission === "granted") {
        console.log("Notification permission granted.");
        requestForToken();
      } else {
        console.log("Notification permission denied.");
      }
    });
  }, []);

  return (
    <ProfileProvider>
      <AudioCallProvider>
        <SettingsProvider>
          <ToastProvider>
            <Navigation />
          </ToastProvider>
        </SettingsProvider>
      </AudioCallProvider>
    </ProfileProvider>
  );
}

export default App;

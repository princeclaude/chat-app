import { useEffect, useRef } from "react";

/**
 * Prevent browser back/forward from leaving the app while enabled.
 * Note: this doesn't remove browser buttons — it just intercepts history changes
 * and pushes state back so the user remains on the same SPA route.
 *
 * @param {boolean} enabled - when true, disables browser navigation
 * @param {(event) => void} onBlocked - optional callback when back/forward is attempted
 */
export default function UseDisableBrowserNavigation(enabled = true, onBlocked) {
  const enabledRef = useRef(enabled);
  const onBlockedRef = useRef(onBlocked);

  useEffect(() => {
    enabledRef.current = enabled;
  }, [enabled]);

  useEffect(() => {
    onBlockedRef.current = onBlocked;
  }, [onBlocked]);

  useEffect(() => {
    if (!enabledRef.current) return;

    // push an initial state so there is something to return to
    const pushState = () => {
      try {
        window.history.pushState(
          { _in_app_block_: true },
          document.title,
          window.location.href
        );
      } catch (e) {
        // some browsers may throw in weird contexts
      }
    };

    pushState();

    const onPop = (e) => {
      // If the popstate is our dummy entry, re-push to prevent navigation.
      // Call onBlocked callback for any UI feedback.
      try {
        // re-push to keep user on app
        pushState();
      } catch (err) {
        // ignore
      }
      if (typeof onBlockedRef.current === "function") {
        try {
          onBlockedRef.current(e);
        } catch (e2) {
          // ignore
        }
      }
    };

    window.addEventListener("popstate", onPop);

    return () => {
      window.removeEventListener("popstate", onPop);
      // Try to clean up the extra history entry by going back once (best-effort).
      // Use setTimeout to avoid interfering with unmounts in some browsers.
      try {
        setTimeout(() => {
          // only attempt if still enabledRef was true when mounting -> best-effort
          if (enabledRef.current) {
            // This will navigate back once if possible. If there is nothing back, nothing happens.
            window.history.back();
          }
        }, 50);
      } catch (e) {}
    };
  }, []); // run once on mount
}

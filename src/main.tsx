import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.tsx";
import "./styles.css";

// PWA auto-update: the service worker (registerType: autoUpdate) installs a new
// build in the background and claims the page. Reload once when that happens so
// open tabs pick up the new UI without a manual hard refresh. We skip the very
// first install (no prior controller) to avoid an unnecessary reload.
if ("serviceWorker" in navigator) {
  let reloading = false;
  const hadController = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (reloading || !hadController) return;
    reloading = true;
    window.location.reload();
  });
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

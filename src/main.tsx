import React from "react";
import ReactDOM from "react-dom/client";
import PlatformApp from "./PlatformApp";
import "./styles.css";
import "./auth/auth.css";
import "./design-system.css";
import "./workspace/sidebar.css";
import "./feeds/feed-studio.css";
import "./components/post-viewer.css";
import "./motion.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <PlatformApp />
  </React.StrictMode>,
);

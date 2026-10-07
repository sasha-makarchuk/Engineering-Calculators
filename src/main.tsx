// React application entry point: imports the root component, shared unit provider, and global styles.
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { UnitProvider } from "./components/units/UnitContext";
import "./index.css";

// Mount the React component tree inside the <div id="root"> element from index.html.
ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <UnitProvider>
      <App />
    </UnitProvider>
  </React.StrictMode>,
);

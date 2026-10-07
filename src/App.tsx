// App-level routing: the application currently has a homepage and the weld-strength calculator.
import { useEffect, useState } from "react";
import { HomePage } from "./pages/HomePage";
import { WeldStrengthPage } from "./pages/WeldStrengthPage";

// Read the URL hash so GitHub Pages can use a simple client-side route.
function getRoute(): string {
  const hash = window.location.hash.replace(/^#/, "");
  return hash || "/";
}

// Root React component: tracks the active route and renders the corresponding page.
export default function App() {
  const [route, setRoute] = useState(getRoute);

  // Keep React route state synchronized with browser hash changes.
  useEffect(() => {
    const handleHashChange = () => setRoute(getRoute());
    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, []);

  // Update the browser tab title whenever the active route changes.
  useEffect(() => {
    document.title = route === "/weld-strength"
      ? "Weld Group Analysis & Stress Calculator"
        : "Engineering Calculators";

      window.scrollTo({
          top: 0,
          left: 0,
          behavior: "instant",
      });

  }, [route]);

  // Render the page associated with the current route.
  switch (route) {
    case "/weld-strength":
      return <WeldStrengthPage />;
    default:
      return <HomePage />;
  }
}

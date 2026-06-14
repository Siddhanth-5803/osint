import { useState } from "react";
import Landing from "./components/Landing";
import Studio from "./components/Studio";

export default function App() {
  const [view, setView] = useState<"landing" | "studio">("landing");
  return (
    <div className="aurora min-h-screen">
      {view === "landing" ? (
        <Landing onStart={() => setView("studio")} />
      ) : (
        <Studio onHome={() => setView("landing")} />
      )}
    </div>
  );
}

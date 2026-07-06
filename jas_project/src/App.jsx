import { useRef, useState } from "react";
import Navbar from "./components/Navbar/Navbar.jsx";
import PageTransition from "./components/PageTransition.jsx";
import Shifts from "./components/Pages/Shifts/Shifts_glassy.jsx";
import Calendar from "./components/Pages/Calendar/Calendar_glassy.jsx";
import Profile from "./components/Pages/profile/Profile_glassy.jsx";
import "./styles/pages.css";
import "./styles/animations.css";
import "./styles/glass_toast.css";
import { ToastProvider } from "./lib/glass_toast_provider.jsx";

const TAB_ORDER = ["Shifts", "Calendar", "Profile"];

const PAGES = {
  Shifts: Shifts,
  Calendar: Calendar,
  Profile: Profile,
};

function App() {
  const [activeNav, setActiveNav] = useState("Shifts");
  const [direction, setDirection] = useState("forward");
  const prevNavRef = useRef("Shifts");

  const handleNavChange = (id) => {
    if (id === activeNav) return;

    const prevIndex = TAB_ORDER.indexOf(prevNavRef.current);
    const nextIndex = TAB_ORDER.indexOf(id);
    setDirection(nextIndex > prevIndex ? "forward" : "backward");
    prevNavRef.current = id;
    setActiveNav(id);
  };

  const ActivePage = PAGES[activeNav];

  return (
    <ToastProvider>
      <div className="app app--glassy">
        <main className="app__content">
          <PageTransition pageKey={activeNav} direction={direction}>
            <ActivePage />
          </PageTransition>
        </main>
        <Navbar activeId={activeNav} onChange={handleNavChange} />
      </div>
    </ToastProvider>
  );
}

export default App;

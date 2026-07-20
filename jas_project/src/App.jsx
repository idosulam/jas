import { useRef, useState, lazy, Suspense } from "react";
import { AnimatePresence, motion } from "framer-motion";
import Navbar from "./components/navbar/Navbar.jsx";
import Page_transition from "./components/Page_transition.jsx";
import { ToastProvider } from "./lib/glass_toast_provider.jsx";
import { supabase } from "./lib/superbase.jsx";
import { AuthProvider, useAuth } from "./lib/Auth_context.jsx";

// Lazy-loaded page components (route-level code splitting)
const Shifts = lazy(() => import("./components/Pages/Shifts/Shifts.jsx"));
const Calendar = lazy(() => import("./components/Pages/Calendar/Calendar.jsx"));
const Profile = lazy(() => import("./components/Pages/profile/Profile.jsx"));
const Workplaces = lazy(
  () => import("./components/Pages/Workplaces/Work_places.jsx"),
);
const Auth = lazy(() => import("./components/Auth/Auth.jsx"));

const TAB_ORDER = ["Shifts", "Calendar", "Profile"];

const PAGES = {
  Shifts: Shifts,
  Calendar: Calendar,
  Profile: Profile,
  Workplaces: Workplaces,
};

function AppContent() {
  const { session, loading } = useAuth();
  const [activeNav, setActiveNav] = useState("Shifts");
  const [direction, setDirection] = useState("forward");
  const [returnTo, setReturnTo] = useState("Shifts");
  const prevNavRef = useRef("Shifts");

  const handleNavChange = (id) => {
    if (id === activeNav) return;

    if (id === "Workplaces") {
      setReturnTo(activeNav);
    }

    const prevIndex = TAB_ORDER.indexOf(prevNavRef.current);
    const nextIndex = TAB_ORDER.indexOf(id);
    setDirection(nextIndex > prevIndex ? "forward" : "backward");
    prevNavRef.current = id;
    setActiveNav(id);
  };

  const handleSignOut = async () => {
    if (supabase) {
      await supabase.auth.signOut();
    }
  };

  // Loading screen
  if (loading) {
    return (
      <div
        className="app app--glassy"
        style={{ justifyContent: "center", alignItems: "center" }}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4 }}
          style={{ textAlign: "center" }}
        >
          <div
            style={{
              width: 36,
              height: 36,
              border: "3px solid rgba(255,255,255,0.15)",
              borderTopColor: "var(--color-primary, #818cf8)",
              borderRadius: "50%",
              animation: "authSpin 0.7s linear infinite",
              margin: "0 auto 1rem",
            }}
          />
          <p style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>
            Loading…
          </p>
        </motion.div>
      </div>
    );
  }

  // Show auth page — require a real session when Supabase is configured
  const isAuthenticated = !!supabase && !!session;

  const ActivePage = PAGES[activeNav];

  return (
    <AnimatePresence mode="wait">
      {!isAuthenticated ? (
        <motion.div
          key="auth"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, scale: 0.96 }}
          transition={{ duration: 0.3 }}
        >
          <Suspense fallback={null}>
            <Auth />
          </Suspense>
        </motion.div>
      ) : (
        <motion.div
          key="app"
          className="app app--glassy"
          initial={{ opacity: 0, scale: 1.02 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        >
          <main className="app__content">
            <Page_transition pageKey={activeNav} direction={direction}>
              <Suspense
                fallback={
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "center",
                      alignItems: "center",
                      height: "100%",
                    }}
                  >
                    <div
                      style={{
                        width: 36,
                        height: 36,
                        border: "3px solid rgba(255,255,255,0.15)",
                        borderTopColor: "var(--color-primary, #818cf8)",
                        borderRadius: "50%",
                        animation: "authSpin 0.7s linear infinite",
                      }}
                    />
                  </div>
                }
              >
                <ActivePage onNavigate={handleNavChange} returnTo={returnTo} />
              </Suspense>
            </Page_transition>
          </main>
          <Navbar activeId={activeNav} onChange={handleNavChange} />
          {supabase && (
            <button
              type="button"
              onClick={handleSignOut}
              style={{
                position: "fixed",
                top: "calc(env(safe-area-inset-top, 0px) + 0.75rem)",
                right: "1rem",
                zIndex: 100,
                display: "flex",
                alignItems: "center",
                gap: "0.35rem",
                padding: "0.4rem 0.7rem",
                fontSize: "0.72rem",
                fontFamily: "var(--font-heading)",
                fontWeight: 600,
                letterSpacing: "0.04em",
                textTransform: "uppercase",
                color: "var(--text-dim, rgba(255,255,255,0.35))",
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: "var(--radius-pill, 999px)",
                cursor: "pointer",
                backdropFilter: "blur(12px)",
                WebkitBackdropFilter: "blur(12px)",
                transition: "color 0.2s, background 0.2s, border-color 0.2s",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = "var(--color-danger, #f87171)";
                e.currentTarget.style.background = "rgba(248,113,113,0.08)";
                e.currentTarget.style.borderColor = "rgba(248,113,113,0.2)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color =
                  "var(--text-dim, rgba(255,255,255,0.35))";
                e.currentTarget.style.background = "rgba(255,255,255,0.04)";
                e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)";
              }}
              aria-label="Sign out"
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
              Sign out
            </button>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </ToastProvider>
  );
}

export default App;

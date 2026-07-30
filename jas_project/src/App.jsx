import { useRef, useState, lazy, Suspense } from "react";
import { AnimatePresence, motion } from "framer-motion";
import Navbar from "./components/Navbar/navbar.jsx";
import Page_transition from "./components/page_transition.jsx";
import { ToastProvider } from "./lib/glass_toast_provider.jsx";
import { supabase } from "./lib/superbase.jsx";
import { AuthProvider, use_auth } from "./lib/auth_context.jsx";
import { HouseholdProvider } from "./lib/household_context.jsx";

// Lazy-loaded page components (route-level code splitting)
const Shifts = lazy(() => import("./components/Pages/Shifts/shifts.jsx"));
const Calendar = lazy(() => import("./components/Pages/Calendar/calendar.jsx"));
const Household = lazy(
  () => import("./components/Pages/Household/household.jsx"),
);
const Profile = lazy(() => import("./components/Pages/profile/profile.jsx"));
const Workplaces = lazy(
  () => import("./components/Pages/Workplaces/Work_places.jsx"),
);
const Fitness = lazy(
  () => import("./components/Pages/Fitness/fitness.jsx"),
);
const Auth = lazy(() => import("./components/Auth/Auth.jsx"));
const ProfileOnboarding = lazy(
  () => import("./components/Pages/profile/profile_onboarding.jsx"),
);

const TAB_ORDER = ["Shifts", "Calendar", "Fitness", "Household", "Profile"];

const PAGES = {
  Shifts: Shifts,
  Calendar: Calendar,
  Fitness: Fitness,
  Household: Household,
  Profile: Profile,
  Workplaces: Workplaces,
};

function AppContent() {
  const { session, loading } = use_auth();
  const [active_nav, set_active_nav] = useState("Shifts");
  const [direction, set_direction] = useState("forward");
  const [return_to, set_return_to] = useState("Shifts");
  const prev_nav_ref = useRef("Shifts");

  const handle_nav_change = (id) => {
    if (id === active_nav) return;

    if (id === "Workplaces") {
      set_return_to(active_nav);
    }

    const prev_index = TAB_ORDER.indexOf(prev_nav_ref.current);
    const next_index = TAB_ORDER.indexOf(id);
    set_direction(next_index > prev_index ? "forward" : "backward");
    prev_nav_ref.current = id;
    set_active_nav(id);
  };

  const handle_sign_out = async () => {
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
            className="app__spinner"
            style={{
              width: 40,
              height: 40,
              margin: "0 auto 1rem",
              position: "relative",
            }}
          >
            <div
              style={{
                position: "absolute",
                inset: 0,
                border: "3px solid rgba(255,255,255,0.08)",
                borderTopColor: "var(--color-primary, #818cf8)",
                borderRadius: "50%",
                animation: "spin 0.8s linear infinite",
              }}
            />
            <div
              style={{
                position: "absolute",
                inset: "6px",
                border: "2px solid transparent",
                borderBottomColor: "var(--color-secondary, #c084fc)",
                borderRadius: "50%",
                animation: "spin 1.2s linear infinite reverse",
              }}
            />
          </div>
          <p style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>
            Loading…
          </p>
        </motion.div>
      </div>
    );
  }

  // Show auth page — require a real session when Supabase is configured
  const is_authenticated = !!supabase && !!session;

  const ActivePage = PAGES[active_nav];

  return (
    <AnimatePresence mode="wait">
      {!is_authenticated ? (
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
            <Page_transition page_key={active_nav} direction={direction}>
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
                <ActivePage onNavigate={handle_nav_change} return_to={return_to} />
              </Suspense>
            </Page_transition>
          </main>
          <Navbar active_id={active_nav} onChange={handle_nav_change} />
          <Suspense fallback={null}>
            <ProfileOnboarding />
          </Suspense>
          {supabase && (
            <button
              type="button"
              onClick={handle_sign_out}
              className="sign-out-btn"
              style={{
                position: "absolute",
                top: "calc(env(safe-area-inset-top, 0px) + 0.75rem)",
                right: "1rem",
                zIndex: 100,
                display: "flex",
                alignItems: "center",
                gap: "0.35rem",
                padding: "0.4rem 0.75rem",
                fontSize: "0.72rem",
                fontFamily: "var(--font-heading)",
                fontWeight: 600,
                letterSpacing: "0.04em",
                textTransform: "uppercase",
                color: "var(--text-dim, rgba(255,255,255,0.4))",
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: "var(--radius-pill, 999px)",
                cursor: "pointer",
                backdropFilter: "blur(16px)",
                WebkitBackdropFilter: "blur(16px)",
                transition: "color 0.2s, background 0.2s, border-color 0.2s, box-shadow 0.2s",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = "var(--color-danger, #f87171)";
                e.currentTarget.style.background = "rgba(248,113,113,0.08)";
                e.currentTarget.style.borderColor = "rgba(248,113,113,0.2)";
                e.currentTarget.style.boxShadow = "0 0 12px rgba(248,113,113,0.1)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color =
                  "var(--text-dim, rgba(255,255,255,0.4))";
                e.currentTarget.style.background = "rgba(255,255,255,0.04)";
                e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)";
                e.currentTarget.style.boxShadow = "none";
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
        <HouseholdProvider>
          <AppContent />
        </HouseholdProvider>
      </AuthProvider>
    </ToastProvider>
  );
}

export default App;

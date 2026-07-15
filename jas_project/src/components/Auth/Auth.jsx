import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { getSupabaseClient } from "../../lib/superbase.jsx";
import { useGlassToast } from "../../lib/glass_toast_provider.jsx";
import "./Auth.css";

const MODES = { LOGIN: "login", REGISTER: "register", FORGOT: "forgot" };

const slideVariants = {
  enter: (dir) => ({ x: dir > 0 ? 80 : -80, opacity: 0, scale: 0.96 }),
  center: { x: 0, opacity: 1, scale: 1 },
  exit: (dir) => ({ x: dir > 0 ? -80 : 80, opacity: 0, scale: 0.96 }),
};

function Auth() {
  const [mode, setMode] = useState(MODES.LOGIN);
  const [direction, setDirection] = useState(1);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);
  const [cooldown, setCooldown] = useState(0);
  const emailRef = useRef(null);
  const { success: toastSuccess, error: toastError } = useGlassToast();

  // Focus email field on mount
  useEffect(() => {
    const timer = setTimeout(() => emailRef.current?.focus(), 400);
    return () => clearTimeout(timer);
  }, []);

  // Cooldown timer for rate-limited actions
  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setInterval(() => setCooldown((c) => c - 1), 1000);
    return () => clearInterval(t);
  }, [cooldown]);

  const switchMode = (newMode) => {
    setError(null);
    setSuccessMsg(null);
    setDirection(newMode === MODES.REGISTER ? 1 : -1);
    setMode(newMode);
  };

  const validateEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    if (!validateEmail(email)) {
      setError("Please enter a valid email address.");
      return;
    }

    if (mode !== MODES.FORGOT) {
      if (password.length < 6) {
        setError("Password must be at least 6 characters.");
        return;
      }
      if (mode === MODES.REGISTER && password !== confirmPassword) {
        setError("Passwords do not match.");
        return;
      }
    }

    setLoading(true);

    try {
      const supabase = getSupabaseClient();

      if (mode === MODES.LOGIN) {
        const { error: authError } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (authError) {
          setError(authError.message);
          toastError("Login failed.");
        } else {
          toastSuccess("Welcome back!");
        }
      } else if (mode === MODES.REGISTER) {
        const { error: authError } = await supabase.auth.signUp({
          email: email.trim(),
          password,
        });
        if (authError) {
          setError(authError.message);
          toastError("Registration failed.");
        } else {
          setSuccessMsg("Check your email for a confirmation link!");
          toastSuccess("Account created.");
        }
      } else if (mode === MODES.FORGOT) {
        const { error: authError } = await supabase.auth.resetPasswordForEmail(
          email.trim(),
          { redirectTo: window.location.origin },
        );
        if (authError) {
          setError(authError.message);
          toastError("Could not send reset email.");
        } else {
          setSuccessMsg("Password reset email sent! Check your inbox.");
          setCooldown(60);
          toastSuccess("Reset email sent.");
        }
      }
    } catch (err) {
      setError(err.message || "Something went wrong.");
      toastError("Authentication error.");
    }

    setLoading(false);
  };

  const titles = {
    [MODES.LOGIN]: "Welcome back",
    [MODES.REGISTER]: "Create account",
    [MODES.FORGOT]: "Reset password",
  };

  const subtitles = {
    [MODES.LOGIN]: "Sign in to track your shifts and earnings",
    [MODES.REGISTER]: "Start tracking your work shifts today",
    [MODES.FORGOT]: "We'll send you a reset link",
  };

  return (
    <div className="auth">
      {/* Ambient orbs */}
      <div className="auth__orb auth__orb--1" aria-hidden="true" />
      <div className="auth__orb auth__orb--2" aria-hidden="true" />
      <div className="auth__orb auth__orb--3" aria-hidden="true" />

      {/* Logo / Brand */}
      <motion.div
        className="auth__brand"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      >
        <div className="auth__logo">
          <svg viewBox="0 0 40 40" fill="none" aria-hidden="true">
            <rect width="40" height="40" rx="12" fill="url(#logoGrad)" />
            <path
              d="M12 28V12h4l6 10 6-10h4v16h-4V18l-6 10-6-10v10h-4Z"
              fill="white"
              fillOpacity="0.95"
            />
            <defs>
              <linearGradient id="logoGrad" x1="0" y1="0" x2="40" y2="40">
                <stop stopColor="#818cf8" />
                <stop offset="1" stopColor="#c084fc" />
              </linearGradient>
            </defs>
          </svg>
        </div>
        <h1 className="auth__brand-name">Jaz</h1>
      </motion.div>

      {/* Card */}
      <motion.div
        className="auth__card"
        initial={{ opacity: 0, y: 30, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
      >
        <div className="auth__card-shine" aria-hidden="true" />

        {/* Header */}
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={mode + "-header"}
            className="auth__header"
            custom={direction}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
          >
            <h2 className="auth__title">{titles[mode]}</h2>
            <p className="auth__subtitle">{subtitles[mode]}</p>
          </motion.div>
        </AnimatePresence>

        {/* Form */}
        <AnimatePresence mode="wait" custom={direction}>
          <motion.form
            key={mode + "-form"}
            className="auth__form"
            onSubmit={handleSubmit}
            custom={direction}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
          >
            {/* Email */}
            <div className="auth__field">
              <label className="auth__label" htmlFor="auth-email">
                Email
              </label>
              <div className="auth__input-wrap">
                <svg className="auth__input-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true">
                  <rect x="2" y="4" width="20" height="16" rx="3" />
                  <path d="m2 7 10 6 10-6" />
                </svg>
                <input
                  ref={emailRef}
                  id="auth-email"
                  type="email"
                  className="auth__input"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); setError(null); }}
                  required
                  autoComplete="email"
                  autoCapitalize="none"
                  spellCheck="false"
                />
              </div>
            </div>

            {/* Password */}
            {mode !== MODES.FORGOT && (
              <motion.div
                className="auth__field"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.25 }}
              >
                <label className="auth__label" htmlFor="auth-password">
                  Password
                </label>
                <div className="auth__input-wrap">
                  <svg className="auth__input-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true">
                    <rect x="3" y="11" width="18" height="11" rx="3" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                  <input
                    id="auth-password"
                    type={showPassword ? "text" : "password"}
                    className="auth__input"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => { setPassword(e.target.value); setError(null); }}
                    required
                    autoComplete={mode === MODES.LOGIN ? "current-password" : "new-password"}
                    minLength={6}
                  />
                  <button
                    type="button"
                    className="auth__eye-btn"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    tabIndex={-1}
                  >
                    {showPassword ? (
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
                        <path d="M3 3l18 18M10.5 10.5a3 3 0 1 0 4.24 4.24" />
                        <path d="M9.88 5.09A10.37 10.37 0 0 1 12 5c5 0 9 4 10 7-.37 1.1-1.06 2.24-2.06 3.32M6.12 6.12C3.56 7.76 2 10 2 10s3 6 10 6c1.38 0 2.66-.25 3.82-.68" />
                      </svg>
                    ) : (
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
                        <path d="M2 10s3-6 10-6 10 6 10 6-3 6-10 6S2 10 2 10Z" />
                        <circle cx="12" cy="10" r="3" />
                      </svg>
                    )}
                  </button>
                </div>
              </motion.div>
            )}

            {/* Confirm Password */}
            {mode === MODES.REGISTER && (
              <motion.div
                className="auth__field"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.25 }}
              >
                <label className="auth__label" htmlFor="auth-confirm">
                  Confirm password
                </label>
                <div className="auth__input-wrap">
                  <svg className="auth__input-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" />
                    <path d="m9 12 2 2 4-4" />
                  </svg>
                  <input
                    id="auth-confirm"
                    type={showPassword ? "text" : "password"}
                    className="auth__input"
                    placeholder="••••••••"
                    value={confirmPassword}
                    onChange={(e) => { setConfirmPassword(e.target.value); setError(null); }}
                    required
                    autoComplete="new-password"
                    minLength={6}
                  />
                </div>
              </motion.div>
            )}

            {/* Error */}
            <AnimatePresence>
              {error && (
                <motion.div
                  className="auth__error"
                  initial={{ opacity: 0, y: -8, height: 0 }}
                  animate={{ opacity: 1, y: 0, height: "auto" }}
                  exit={{ opacity: 0, y: -8, height: 0 }}
                  transition={{ duration: 0.2 }}
                  role="alert"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="8" x2="12" y2="12" />
                    <line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                  {error}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Success */}
            <AnimatePresence>
              {successMsg && (
                <motion.div
                  className="auth__success"
                  initial={{ opacity: 0, y: -8, height: 0 }}
                  animate={{ opacity: 1, y: 0, height: "auto" }}
                  exit={{ opacity: 0, y: -8, height: 0 }}
                  transition={{ duration: 0.2 }}
                  role="status"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                    <circle cx="12" cy="12" r="10" />
                    <path d="m9 12 2 2 4-4" />
                  </svg>
                  {successMsg}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Submit */}
            <motion.button
              type="submit"
              className="auth__submit"
              disabled={loading || cooldown > 0}
              whileTap={{ scale: 0.97 }}
              whileHover={{ scale: 1.01 }}
            >
              {loading ? (
                <span className="auth__spinner" aria-label="Loading" />
              ) : mode === MODES.FORGOT ? (
                cooldown > 0 ? `Resend in ${cooldown}s` : "Send reset link"
              ) : mode === MODES.LOGIN ? (
                "Sign in"
              ) : (
                "Create account"
              )}
            </motion.button>

            {/* Divider */}
            {mode !== MODES.FORGOT && (
              <div className="auth__divider">
                <span>or</span>
              </div>
            )}

            {/* Google sign-in placeholder */}
            {mode !== MODES.FORGOT && (
              <button
                type="button"
                className="auth__social-btn"
                onClick={() => toastError("Google sign-in coming soon!")}
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1Z" fill="#4285F4" />
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23Z" fill="#34A853" />
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62Z" fill="#FBBC05" />
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53Z" fill="#EA4335" />
                </svg>
                Continue with Google
              </button>
            )}
          </motion.form>
        </AnimatePresence>

        {/* Footer links */}
        <motion.div
          className="auth__footer"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4, duration: 0.4 }}
        >
          {mode === MODES.LOGIN && (
            <>
              <button
                type="button"
                className="auth__link"
                onClick={() => switchMode(MODES.FORGOT)}
              >
                Forgot password?
              </button>
              <span className="auth__footer-sep">·</span>
              <button
                type="button"
                className="auth__link"
                onClick={() => switchMode(MODES.REGISTER)}
              >
                Create account
              </button>
            </>
          )}
          {mode === MODES.REGISTER && (
            <button
              type="button"
              className="auth__link"
              onClick={() => switchMode(MODES.LOGIN)}
            >
              Already have an account? Sign in
            </button>
          )}
          {mode === MODES.FORGOT && (
            <button
              type="button"
              className="auth__link"
              onClick={() => switchMode(MODES.LOGIN)}
            >
              ← Back to sign in
            </button>
          )}
        </motion.div>
      </motion.div>

      {/* Bottom tagline */}
      <motion.p
        className="auth__tagline"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6, duration: 0.5 }}
      >
        Track shifts. Count earnings. Stay organized.
      </motion.p>
    </div>
  );
}

export default Auth;

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { getSupabaseClient } from "../../lib/superbase.jsx";
import { useGlassToast } from "../../lib/glass_toast_provider.jsx";
import "./Auth.css";

const MODES = { LOGIN: "login", REGISTER: "register" };

const slideVariants = {
  enter: (dir) => ({ x: dir > 0 ? 80 : -80, opacity: 0, scale: 0.96 }),
  center: { x: 0, opacity: 1, scale: 1 },
  exit: (dir) => ({ x: dir > 0 ? -80 : 80, opacity: 0, scale: 0.96 }),
};

/* ── Password strength ── */
function getPasswordStrength(pw) {
  let score = 0;
  const checks = {
    length: pw.length >= 8,
    lowercase: /[a-z]/.test(pw),
    uppercase: /[A-Z]/.test(pw),
    numbers: /\d/.test(pw),
    special: /[!@#$%^&*(),.?":{}|<>]/.test(pw),
  };
  Object.values(checks).forEach((v) => v && score++);
  if (pw.length < 6) score = Math.min(score, 1);
  const labels = ["Too weak", "Weak", "Fair", "Good", "Strong", "Very strong"];
  const colors = ["#f87171", "#fb923c", "#fbbf24", "#a3e635", "#34d399", "#22d3ee"];
  return { score, label: labels[score], color: colors[score], checks };
}

function PasswordStrengthBar({ password, mode }) {
  if (mode === MODES.LOGIN || !password) return null;
  const { score, label, color, checks } = getPasswordStrength(password);
  const percent = (score / 5) * 100;
  return (
    <motion.div
      className="auth__strength"
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.25 }}
    >
      <div className="auth__strength-bar-track">
        <motion.div
          className="auth__strength-bar-fill"
          initial={{ width: 0 }}
          animate={{ width: `${percent}%` }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          style={{ background: color }}
        />
      </div>
      <div className="auth__strength-row">
        <motion.span
          className="auth__strength-label"
          key={label}
          initial={{ opacity: 0, x: -6 }}
          animate={{ opacity: 1, x: 0 }}
          style={{ color }}
        >
          {label}
        </motion.span>
        <div className="auth__strength-checks">
          {Object.entries(checks).map(([key, pass]) => (
            <span
              key={key}
              className={`auth__strength-check ${pass ? "auth__strength-check--pass" : ""}`}
            >
              {key === "length" ? "8+" : key === "lowercase" ? "a-z" : key === "uppercase" ? "A-Z" : key === "numbers" ? "0-9" : "!@#"}
            </span>
          ))}
        </div>
      </div>
    </motion.div>
  );
}

/* ── Inline check / cross indicator ── */
function FieldIndicator({ state }) {
  return (
    <AnimatePresence mode="wait">
      {state === "valid" && (
        <motion.span
          key="check"
          className="auth__field-check"
          initial={{ scale: 0, opacity: 0, rotate: -90 }}
          animate={{ scale: 1, opacity: 1, rotate: 0 }}
          exit={{ scale: 0, opacity: 0 }}
          transition={{ type: "spring", stiffness: 400, damping: 15 }}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </motion.span>
      )}
      {state === "error" && (
        <motion.span
          key="cross"
          className="auth__field-cross"
          initial={{ scale: 0, opacity: 0, rotate: 90 }}
          animate={{ scale: 1, opacity: 1, rotate: 0 }}
          exit={{ scale: 0, opacity: 0 }}
          transition={{ type: "spring", stiffness: 400, damping: 15 }}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </motion.span>
      )}
    </AnimatePresence>
  );
}

function FieldError({ message }) {
  return (
    <AnimatePresence>
      {message && (
        <motion.span
          className="auth__field-error-msg"
          initial={{ opacity: 0, y: -4, height: 0 }}
          animate={{ opacity: 1, y: 0, height: "auto" }}
          exit={{ opacity: 0, y: -4, height: 0 }}
          transition={{ duration: 0.2 }}
        >
          {message}
        </motion.span>
      )}
    </AnimatePresence>
  );
}

/* ── Shake wrapper (applied to individual fields) ── */
function ShakeField({ trigger, children, ...rest }) {
  return (
    <motion.div
      key={"shake-" + trigger}
      initial={false}
      animate={
        trigger > 0
          ? { x: [0, -10, 10, -8, 8, -4, 4, 0] }
          : { x: 0 }
      }
      transition={{ duration: 0.5, ease: "easeInOut" }}
      {...rest}
    >
      {children}
    </motion.div>
  );
}

/* ── Main Auth component ── */
function Auth() {
  const [mode, setMode] = useState(MODES.LOGIN);
  const [direction, setDirection] = useState(1);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  // Field states: "idle" | "valid" | "error"
  const [emailState, setEmailState] = useState("idle");
  const [passwordState, setPasswordState] = useState("idle");
  const [confirmState, setConfirmState] = useState("idle");
  const [emailError, setEmailError] = useState(null);
  const [passwordError, setPasswordError] = useState(null);
  const [confirmError, setConfirmError] = useState(null);

  const [emailTouched, setEmailTouched] = useState(false);
  const [passwordTouched, setPasswordTouched] = useState(false);
  const [confirmTouched, setConfirmTouched] = useState(false);
  const [nameTouched, setNameTouched] = useState(false);
  const [nameState, setNameState] = useState("idle");
  const [nameError, setNameError] = useState(null);
  const [shakeKey, setShakeKey] = useState(0);

  const emailRef = useRef(null);
  const { success: toastSuccess, error: toastError } = useGlassToast();

  useEffect(() => {
    const t = setTimeout(() => emailRef.current?.focus(), 400);
    return () => clearTimeout(t);
  }, []);

  const switchMode = (newMode) => {
    setError(null);
    setSuccessMsg(null);
    setEmailState("idle");
    setPasswordState("idle");
    setConfirmState("idle");
    setEmailError(null);
    setPasswordError(null);
    setConfirmError(null);
    setEmailTouched(false);
    setPasswordTouched(false);
    setConfirmTouched(false);
    setNameTouched(false);
    setNameState("idle");
    setNameError(null);
    setDisplayName("");
    setDirection(newMode === MODES.REGISTER ? 1 : -1);
    setMode(newMode);
  };

  /* ── Validators ── */

  const validateEmailField = useCallback((value) => {
    if (!value.trim()) { setEmailState("idle"); setEmailError(null); return; }
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())) {
      setEmailState("valid"); setEmailError(null);
    } else {
      setEmailState("error"); setEmailError("Invalid email format");
    }
  }, []);

  const validatePasswordField = useCallback((value, isRegister) => {
    if (!value) { setPasswordState("idle"); setPasswordError(null); return; }
    if (isRegister) {
      if (value.length >= 8) { setPasswordState("valid"); setPasswordError(null); }
      else if (value.length >= 6) { setPasswordState("idle"); setPasswordError(null); }
      else { setPasswordState("error"); setPasswordError("At least 6 characters"); }
    } else {
      setPasswordState(value.length > 0 ? "valid" : "idle");
      setPasswordError(null);
    }
  }, []);

  const validateConfirmField = useCallback((value, pw) => {
    if (!value) { setConfirmState("idle"); setConfirmError(null); return; }
    if (value === pw) { setConfirmState("valid"); setConfirmError(null); }
    else { setConfirmState("error"); setConfirmError("Passwords don't match"); }
  }, []);

  const validateNameField = useCallback((value) => {
    const trimmed = value.trim();
    if (!trimmed) { setNameState("idle"); setNameError(null); return; }
    if (trimmed.length >= 2 && trimmed.length <= 40) { setNameState("valid"); setNameError(null); }
    else if (trimmed.length > 40) { setNameState("error"); setNameError("Name too long (max 40)"); }
    else { setNameState("error"); setNameError("At least 2 characters"); }
  }, []);

  useEffect(() => {
    if (confirmTouched && mode === MODES.REGISTER) validateConfirmField(confirmPassword, password);
  }, [password, confirmPassword, confirmTouched, mode, validateConfirmField]);

  const handleEmailBlur = () => { setEmailTouched(true); validateEmailField(email); };
  const handlePasswordBlur = () => { setPasswordTouched(true); validatePasswordField(password, mode === MODES.REGISTER); };
  const handleConfirmBlur = () => { setConfirmTouched(true); validateConfirmField(confirmPassword, password); };
  const handleNameBlur = () => { setNameTouched(true); validateNameField(displayName); };
  const handleNameChange = (e) => { const v = e.target.value; setDisplayName(v); setError(null); if (nameTouched) validateNameField(v); };

  const handleEmailChange = (e) => { const v = e.target.value; setEmail(v); setError(null); if (emailTouched) validateEmailField(v); };
  const handlePasswordChange = (e) => { const v = e.target.value; setPassword(v); setError(null); if (passwordTouched) validatePasswordField(v, mode === MODES.REGISTER); };
  const handleConfirmChange = (e) => { const v = e.target.value; setConfirmPassword(v); setError(null); if (confirmTouched) validateConfirmField(v, password); };

  /* ── Submit ── */
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    setEmailTouched(true);
    setPasswordTouched(true);
    if (mode === MODES.REGISTER) {
      setConfirmTouched(true);
      setNameTouched(true);
    }

    let hasError = false;
    if (mode === MODES.REGISTER) {
      const trimmedName = displayName.trim();
      if (!trimmedName || trimmedName.length < 2) { setNameState("error"); setNameError(trimmedName ? "At least 2 characters" : "Name is required"); hasError = true; }
      else if (trimmedName.length > 40) { setNameState("error"); setNameError("Name too long (max 40)"); hasError = true; }
    }
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setEmailState("error"); setEmailError(email.trim() ? "Invalid email format" : "Email is required"); hasError = true;
    }
    if (mode === MODES.REGISTER && password.length < 6) { setPasswordState("error"); setPasswordError("At least 6 characters"); hasError = true; }
      else if (!password) { setPasswordState("error"); setPasswordError("Password is required"); hasError = true; }
      if (mode === MODES.REGISTER && password !== confirmPassword) { setConfirmState("error"); setConfirmError("Passwords don't match"); hasError = true; }
    if (hasError) { setShakeKey((k) => k + 1); return; }

    setLoading(true);
    try {
      const supabase = getSupabaseClient();

      if (mode === MODES.LOGIN) {
        const { error: authError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (authError) { setError(authError.message); setShakeKey((k) => k + 1); toastError("Login failed."); }
        else { toastSuccess("Welcome back!"); }
      } else if (mode === MODES.REGISTER) {
        const { data: signUpData, error: authError } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { data: { display_name: displayName.trim() } },
        });
        if (authError) { setError(authError.message); setShakeKey((k) => k + 1); toastError("Registration failed."); }
        else { toastSuccess("Account created! Welcome!"); }
      }
    } catch (err) {
      setError(err.message || "Something went wrong."); setShakeKey((k) => k + 1); toastError("Authentication error.");
    }
    setLoading(false);
  };

  const titles = { [MODES.LOGIN]: "Welcome back", [MODES.REGISTER]: "Create account" };
  const subtitles = { [MODES.LOGIN]: "Sign in to track your shifts and earnings", [MODES.REGISTER]: "Start tracking your work shifts today" };

  const inputClass = (touched, state) =>
    ["auth__input", touched && state === "valid" ? "auth__input--valid" : "", touched && state === "error" ? "auth__input--error" : ""].filter(Boolean).join(" ");
  const wrapClass = (touched, state) =>
    `${touched && state === "valid" ? "auth__input-wrap--valid" : ""} ${touched && state === "error" ? "auth__input-wrap--error" : ""}`.trim();

  return (
    <div className="auth">
      <div className="auth__orb auth__orb--1" aria-hidden="true" />
      <div className="auth__orb auth__orb--2" aria-hidden="true" />
      <div className="auth__orb auth__orb--3" aria-hidden="true" />

      <motion.div className="auth__brand" initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}>
        <div className="auth__logo">
          <svg viewBox="0 0 40 40" fill="none" aria-hidden="true">
            <rect width="40" height="40" rx="12" fill="url(#logoGrad)" />
            <path d="M12 28V12h4l6 10 6-10h4v16h-4V18l-6 10-6-10v10h-4Z" fill="white" fillOpacity="0.95" />
            <defs><linearGradient id="logoGrad" x1="0" y1="0" x2="40" y2="40"><stop stopColor="#818cf8" /><stop offset="1" stopColor="#c084fc" /></linearGradient></defs>
          </svg>
        </div>
        <h1 className="auth__brand-name">Jaz</h1>
      </motion.div>

      <motion.div className="auth__card" initial={{ opacity: 0, y: 30, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: 0.5, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}>
        <div className="auth__card-shine" aria-hidden="true" />

        <AnimatePresence mode="wait" custom={direction}>
          <motion.div key={mode + "-header"} className="auth__header" custom={direction} variants={slideVariants} initial="enter" animate="center" exit="exit" transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}>
            <h2 className="auth__title">{titles[mode]}</h2>
            <p className="auth__subtitle">{subtitles[mode]}</p>
          </motion.div>
        </AnimatePresence>

        <AnimatePresence mode="wait" custom={direction}>
          <motion.form key={mode + "-form"} className="auth__form" onSubmit={handleSubmit} custom={direction} variants={slideVariants} initial="enter" animate="center" exit="exit" transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}>

            {/* Name (register only) */}
            {mode === MODES.REGISTER && (
              <ShakeField trigger={nameState === "error" ? shakeKey : 0} className="auth__field">
                <label className="auth__label" htmlFor="auth-name">Name</label>
                <div className={`auth__input-wrap ${wrapClass(nameTouched, nameState)}`}>
                  <svg className="auth__input-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
                  </svg>
                  <input id="auth-name" type="text" className={inputClass(nameTouched, nameState)} placeholder="Your name" value={displayName} onChange={handleNameChange} onBlur={handleNameBlur} required autoComplete="name" maxLength={40} />
                  {nameTouched && <FieldIndicator state={nameState} />}
                </div>
                <FieldError message={nameTouched ? nameError : null} />
              </ShakeField>
            )}

            {/* Email */}
            <ShakeField trigger={emailState === "error" ? shakeKey : 0} className="auth__field">
              <label className="auth__label" htmlFor="auth-email">Email</label>
              <div className={`auth__input-wrap ${wrapClass(emailTouched, emailState)}`}>
                <svg className="auth__input-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true">
                  <rect x="2" y="4" width="20" height="16" rx="3" /><path d="m2 7 10 6 10-6" />
                </svg>
                <input ref={emailRef} id="auth-email" type="email" className={inputClass(emailTouched, emailState)} placeholder="you@example.com" value={email} onChange={handleEmailChange} onBlur={handleEmailBlur} required autoComplete="email" autoCapitalize="none" spellCheck="false" />
                {emailTouched && <FieldIndicator state={emailState} />}
              </div>
              <FieldError message={emailTouched ? emailError : null} />
            </ShakeField>

            {/* Password */}
            <ShakeField trigger={passwordState === "error" ? shakeKey : 0} className="auth__field">
                <label className="auth__label" htmlFor="auth-password">Password</label>
                <div className={`auth__input-wrap ${wrapClass(passwordTouched, passwordState)}`}>
                  <svg className="auth__input-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true">
                    <rect x="3" y="11" width="18" height="11" rx="3" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                  <input id="auth-password" type={showPassword ? "text" : "password"} className={inputClass(passwordTouched, passwordState)} placeholder="••••••••" value={password} onChange={handlePasswordChange} onBlur={handlePasswordBlur} required autoComplete={mode === MODES.LOGIN ? "current-password" : "new-password"} minLength={6} />
                  <button type="button" className="auth__eye-btn" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? "Hide password" : "Show password"} tabIndex={-1}>
                    {showPassword ? (
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75"><path d="M3 3l18 18M10.5 10.5a3 3 0 1 0 4.24 4.24" /><path d="M9.88 5.09A10.37 10.37 0 0 1 12 5c5 0 9 4 10 7-.37 1.1-1.06 2.24-2.06 3.32M6.12 6.12C3.56 7.76 2 10 2 10s3 6 10 6c1.38 0 2.66-.25 3.82-.68" /></svg>
                    ) : (
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75"><path d="M2 10s3-6 10-6 10 6 10 6-3 6-10 6S2 10 2 10Z" /><circle cx="12" cy="10" r="3" /></svg>
                    )}
                  </button>
                  {passwordTouched && <FieldIndicator state={passwordState} />}
                </div>
                <FieldError message={passwordTouched ? passwordError : null} />
                <PasswordStrengthBar password={password} mode={mode} />
              </ShakeField>

            {/* Confirm Password */}
            {mode === MODES.REGISTER && (
              <ShakeField trigger={confirmState === "error" ? shakeKey : 0} className="auth__field">
                <label className="auth__label" htmlFor="auth-confirm">Confirm password</label>
                <div className={`auth__input-wrap ${wrapClass(confirmTouched, confirmState)}`}>
                  <svg className="auth__input-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" /><path d="m9 12 2 2 4-4" />
                  </svg>
                  <input id="auth-confirm" type={showPassword ? "text" : "password"} className={inputClass(confirmTouched, confirmState)} placeholder="••••••••" value={confirmPassword} onChange={handleConfirmChange} onBlur={handleConfirmBlur} required autoComplete="new-password" minLength={6} />
                  {confirmTouched && <FieldIndicator state={confirmState} />}
                </div>
                <FieldError message={confirmTouched ? confirmError : null} />
              </ShakeField>
            )}

            {/* Global Error */}
            <AnimatePresence>
              {error && (
                <motion.div className="auth__error" initial={{ opacity: 0, y: -8, height: 0 }} animate={{ opacity: 1, y: 0, height: "auto" }} exit={{ opacity: 0, y: -8, height: 0 }} transition={{ duration: 0.2 }} role="alert">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
                  {error}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Global Success */}
            <AnimatePresence>
              {successMsg && (
                <motion.div className="auth__success" initial={{ opacity: 0, y: -8, height: 0 }} animate={{ opacity: 1, y: 0, height: "auto" }} exit={{ opacity: 0, y: -8, height: 0 }} transition={{ duration: 0.2 }} role="status">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><circle cx="12" cy="12" r="10" /><path d="m9 12 2 2 4-4" /></svg>
                  {successMsg}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Submit */}
            <motion.button type="submit" className={`auth__submit ${loading ? "auth__submit--loading" : ""}`} disabled={loading} whileTap={{ scale: 0.97 }} whileHover={{ scale: 1.01 }}>
              <AnimatePresence mode="wait">
                {loading ? (
                  <motion.span key="spinner" className="auth__spinner" initial={{ opacity: 0, scale: 0.5 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.5 }} aria-label="Loading" />
                ) : (
                  <motion.span key="text" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                    {mode === MODES.LOGIN ? "Sign in" : "Create account"}
                  </motion.span>
                )}
              </AnimatePresence>
            </motion.button>
          </motion.form>
        </AnimatePresence>

        <motion.div className="auth__footer" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4, duration: 0.4 }}>
          {mode === MODES.LOGIN && (
            <>
              <button type="button" className="auth__link" onClick={() => switchMode(MODES.REGISTER)}>Create account</button>
            </>
          )}
          {mode === MODES.REGISTER && <button type="button" className="auth__link" onClick={() => switchMode(MODES.LOGIN)}>Already have an account? Sign in</button>}
        </motion.div>
      </motion.div>

      <motion.p className="auth__tagline" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6, duration: 0.5 }}>
        Track shifts. Count earnings. Stay organized.
      </motion.p>
    </div>
  );
}

export default Auth;

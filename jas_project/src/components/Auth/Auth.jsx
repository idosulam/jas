import { MODES } from "./password_strength_bar";
import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { getSupabaseClient } from "../../lib/superbase.jsx";
import { useGlassToast } from "../../lib/glass_toast_provider.jsx";
import { hapticError } from "../../lib/security";
import AuthForm, { slideVariants } from "./auth_form";
import "./auth.css";

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

  const validateEmailField = useCallback((value, isBlur = false) => {
    if (!value.trim()) {
      if (isBlur) {
        setEmailState("error");
        setEmailError("Email is required");
      } else {
        setEmailState("idle");
        setEmailError(null);
      }
      return;
    }
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())) {
      setEmailState("valid");
      setEmailError(null);
    } else {
      setEmailState("error");
      setEmailError("Invalid email format");
    }
  }, []);

  const validatePasswordField = useCallback((value, isRegister, isBlur = false) => {
    if (!value) {
      if (isBlur) {
        setPasswordState("error");
        setPasswordError("Password is required");
      } else {
        setPasswordState("idle");
        setPasswordError(null);
      }
      return;
    }
    if (isRegister) {
      if (value.length >= 8) {
        setPasswordState("valid");
        setPasswordError(null);
      } else if (value.length >= 6) {
        setPasswordState("idle");
        setPasswordError(null);
      } else {
        setPasswordState("error");
        setPasswordError("At least 6 characters");
      }
    } else {
      setPasswordState(value.length > 0 ? "valid" : "idle");
      setPasswordError(null);
    }
  }, []);

  const validateConfirmField = useCallback((value, pw, isBlur = false) => {
    if (!value) {
      if (isBlur) {
        setConfirmState("error");
        setConfirmError("Confirm your password");
      } else {
        setConfirmState("idle");
        setConfirmError(null);
      }
      return;
    }
    if (value === pw) {
      setConfirmState("valid");
      setConfirmError(null);
    } else {
      setConfirmState("error");
      setConfirmError("Passwords don't match");
    }
  }, []);

  const validateNameField = useCallback((value, isBlur = false) => {
    const trimmed = value.trim();
    if (!trimmed) {
      if (isBlur) {
        setNameState("error");
        setNameError("Name is required");
      } else {
        setNameState("idle");
        setNameError(null);
      }
      return;
    }
    if (trimmed.length >= 2 && trimmed.length <= 40) {
      setNameState("valid");
      setNameError(null);
    } else if (trimmed.length > 40) {
      setNameState("error");
      setNameError("Name too long (max 40)");
    } else {
      setNameState("error");
      setNameError("At least 2 characters");
    }
  }, []);

  useEffect(() => {
    if (confirmTouched && mode === MODES.REGISTER)
      validateConfirmField(confirmPassword, password);
  }, [password, confirmPassword, confirmTouched, mode, validateConfirmField]);

  const handleEmailBlur = () => {
    setEmailTouched(true);
    validateEmailField(email, true);
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setShakeKey((k) => k + 1);
      hapticError();
    }
  };
  const handlePasswordBlur = () => {
    setPasswordTouched(true);
    validatePasswordField(password, mode === MODES.REGISTER, true);
    if (!password || (mode === MODES.REGISTER && password.length < 6)) {
      setShakeKey((k) => k + 1);
      hapticError();
    }
  };
  const handleConfirmBlur = () => {
    setConfirmTouched(true);
    validateConfirmField(confirmPassword, password, true);
    if (!confirmPassword || confirmPassword !== password) {
      setShakeKey((k) => k + 1);
      hapticError();
    }
  };
  const handleNameBlur = () => {
    setNameTouched(true);
    validateNameField(displayName, true);
    if (!displayName.trim() || displayName.trim().length < 2) {
      setShakeKey((k) => k + 1);
      hapticError();
    }
  };
  const handleNameChange = (e) => {
    const v = e.target.value;
    setDisplayName(v);
    setError(null);
    if (nameTouched) validateNameField(v);
  };

  const handleEmailChange = (e) => {
    const v = e.target.value;
    setEmail(v);
    setError(null);
    if (emailTouched) validateEmailField(v);
  };
  const handlePasswordChange = (e) => {
    const v = e.target.value;
    setPassword(v);
    setError(null);
    if (passwordTouched) validatePasswordField(v, mode === MODES.REGISTER);
  };
  const handleConfirmChange = (e) => {
    const v = e.target.value;
    setConfirmPassword(v);
    setError(null);
    if (confirmTouched) validateConfirmField(v, password);
  };

  /* ── Submit ── */
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    setEmailTouched(true);
    setPasswordTouched(true);
    if (mode === MODES.REGISTER || mode === MODES.FORGOT) {
      setConfirmTouched(true);
      setNameTouched(true);
    }

    let hasError = false;
    if (mode === MODES.REGISTER) {
      const trimmedName = displayName.trim();
      if (!trimmedName || trimmedName.length < 2) {
        setNameState("error");
        setNameError(
          trimmedName ? "At least 2 characters" : "Name is required",
        );
        hasError = true;
      } else if (trimmedName.length > 40) {
        setNameState("error");
        setNameError("Name too long (max 40)");
        hasError = true;
      }
    }
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setEmailState("error");
      setEmailError(
        email.trim() ? "Invalid email format" : "Email is required",
      );
      hasError = true;
    }
    if (mode === MODES.REGISTER && password.length < 6) {
      setPasswordState("error");
      setPasswordError("At least 6 characters");
      hasError = true;
    } else if (!password) {
      setPasswordState("error");
      setPasswordError("Password is required");
      hasError = true;
    }
    if (
      (mode === MODES.REGISTER || mode === MODES.FORGOT) &&
      password !== confirmPassword
    ) {
      setConfirmState("error");
      setConfirmError("Passwords don't match");
      hasError = true;
    }
    if (hasError) {
      setShakeKey((k) => k + 1);
      return;
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
          setShakeKey((k) => k + 1);
          toastError("Login failed.");
        } else {
          toastSuccess("Welcome back!");
        }
      } else if (mode === MODES.REGISTER) {
        const { data: signUpData, error: authError } =
          await supabase.auth.signUp({
            email: email.trim(),
            password,
            options: { data: { display_name: displayName.trim() } },
          });
        if (authError) {
          setError(authError.message);
          setShakeKey((k) => k + 1);
          toastError("Registration failed.");
        } else {
          toastSuccess("Account created! Welcome!");
        }
      } else if (mode === MODES.FORGOT) {
        const { error: resetError } = await supabase.rpc(
          "reset_user_password",
          {
            user_email: email.trim(),
            new_password: password,
          },
        );
        if (resetError) {
          setError(resetError.message);
          setShakeKey((k) => k + 1);
          toastError("Password reset failed.");
        } else {
          toastSuccess("Password updated! Sign in with your new password.");
          switchMode(MODES.LOGIN);
        }
      }
    } catch (err) {
      setError(err.message || "Something went wrong.");
      setShakeKey((k) => k + 1);
      toastError("Authentication error.");
    }
    setLoading(false);
  };

  /* ── Form validity ── */
  const isFormValid = useMemo(() => {
    if (mode === MODES.LOGIN) {
      return email.trim().length > 0 && password.length > 0;
    }
    if (mode === MODES.REGISTER) {
      return (
        displayName.trim().length >= 2 &&
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) &&
        password.length >= 6 &&
        confirmPassword === password
      );
    }
    if (mode === MODES.FORGOT) {
      return (
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) &&
        password.length >= 6 &&
        confirmPassword === password
      );
    }
    return false;
  }, [mode, email, password, confirmPassword, displayName]);

  const titles = {
    [MODES.LOGIN]: "Welcome back",
    [MODES.REGISTER]: "Create account",
    [MODES.FORGOT]: "Reset password",
  };
  const subtitles = {
    [MODES.LOGIN]: "Sign in to track your shifts and earnings",
    [MODES.REGISTER]: "Start tracking your work shifts today",
    [MODES.FORGOT]: "Enter your email and new password",
  };

  return (
    <div className="auth">
      <div className="auth__orb auth__orb--1" aria-hidden="true" />
      <div className="auth__orb auth__orb--2" aria-hidden="true" />
      <div className="auth__orb auth__orb--3" aria-hidden="true" />

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

      <motion.div
        className="auth__card"
        initial={{ opacity: 0, y: 30, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
      >
        <div className="auth__card-shine" aria-hidden="true" />

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

        <AuthForm
          mode={mode}
          direction={direction}
          email={email}
          password={password}
          confirmPassword={confirmPassword}
          displayName={displayName}
          showPassword={showPassword}
          loading={loading}
          error={error}
          successMsg={successMsg}
          emailState={emailState}
          passwordState={passwordState}
          confirmState={confirmState}
          nameState={nameState}
          emailError={emailError}
          passwordError={passwordError}
          confirmError={confirmError}
          nameError={nameError}
          emailTouched={emailTouched}
          passwordTouched={passwordTouched}
          confirmTouched={confirmTouched}
          nameTouched={nameTouched}
          shakeKey={shakeKey}
          emailRef={emailRef}
          isFormValid={isFormValid}
          onEmailChange={handleEmailChange}
          onPasswordChange={handlePasswordChange}
          onConfirmChange={handleConfirmChange}
          onNameChange={handleNameChange}
          onEmailBlur={handleEmailBlur}
          onPasswordBlur={handlePasswordBlur}
          onConfirmBlur={handleConfirmBlur}
          onNameBlur={handleNameBlur}
          onToggleShowPassword={() => setShowPassword(!showPassword)}
          onSubmit={handleSubmit}
        />

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

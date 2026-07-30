import { MODES } from "./Password_strength_bar";
import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { get_supabase_client } from "../../Lib/Superbase.jsx";
import { use_glass_toast } from "../../Lib/Glass_toast_provider.jsx";
import { haptic_error } from "../../Lib/Security";
import AuthForm, { slide_variants } from "./Auth_form";
import "./Auth.css";

/* ── Main Auth component ── */
function Auth() {
  const [mode, set_mode] = useState(MODES.LOGIN);
  const [direction, set_direction] = useState(1);
  const [email, set_email] = useState("");
  const [password, set_password] = useState("");
  const [confirm_password, set_confirm_password] = useState("");
  const [display_name, set_display_name] = useState("");
  const [show_password, set_show_password] = useState(false);
  const [loading, set_loading] = useState(false);
  const [error, set_error] = useState(null);
  const [success_msg, set_success_msg] = useState(null);

  // Field states: "idle" | "valid" | "error"
  const [email_state, set_email_state] = useState("idle");
  const [password_state, set_password_state] = useState("idle");
  const [confirm_state, set_confirm_state] = useState("idle");
  const [email_error, set_email_error] = useState(null);
  const [password_error, set_password_error] = useState(null);
  const [confirm_error, set_confirm_error] = useState(null);

  const [email_touched, set_email_touched] = useState(false);
  const [password_touched, set_password_touched] = useState(false);
  const [confirm_touched, set_confirm_touched] = useState(false);
  const [name_touched, set_name_touched] = useState(false);
  const [name_state, set_name_state] = useState("idle");
  const [name_error, set_name_error] = useState(null);
  const [shake_key, set_shake_key] = useState(0);

  const email_ref = useRef(null);
  const { success: toast_success, error: toast_error } = use_glass_toast();

  useEffect(() => {
    const t = setTimeout(() => email_ref.current?.focus(), 400);
    return () => clearTimeout(t);
  }, []);

  const switch_mode = (new_mode) => {
    set_error(null);
    set_success_msg(null);
    set_email_state("idle");
    set_password_state("idle");
    set_confirm_state("idle");
    set_email_error(null);
    set_password_error(null);
    set_confirm_error(null);
    set_email_touched(false);
    set_password_touched(false);
    set_confirm_touched(false);
    set_name_touched(false);
    set_name_state("idle");
    set_name_error(null);
    set_display_name("");
    set_direction(new_mode === MODES.REGISTER ? 1 : -1);
    set_mode(new_mode);
  };

  /* ── Validators ── */

  const validate_email_field = useCallback((value, is_blur = false) => {
    if (!value.trim()) {
      if (is_blur) {
        set_email_state("error");
        set_email_error("Email is required");
      } else {
        set_email_state("idle");
        set_email_error(null);
      }
      return;
    }
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())) {
      set_email_state("valid");
      set_email_error(null);
    } else {
      set_email_state("error");
      set_email_error("Invalid email format");
    }
  }, []);

  const validate_password_field = useCallback((value, is_register, is_blur = false) => {
    if (!value) {
      if (is_blur) {
        set_password_state("error");
        set_password_error("Password is required");
      } else {
        set_password_state("idle");
        set_password_error(null);
      }
      return;
    }
    if (is_register) {
      if (value.length >= 8) {
        set_password_state("valid");
        set_password_error(null);
      } else if (value.length >= 6) {
        set_password_state("idle");
        set_password_error(null);
      } else {
        set_password_state("error");
        set_password_error("At least 6 characters");
      }
    } else {
      set_password_state(value.length > 0 ? "valid" : "idle");
      set_password_error(null);
    }
  }, []);

  const validate_confirm_field = useCallback((value, pw, is_blur = false) => {
    if (!value) {
      if (is_blur) {
        set_confirm_state("error");
        set_confirm_error("Confirm your password");
      } else {
        set_confirm_state("idle");
        set_confirm_error(null);
      }
      return;
    }
    if (value === pw) {
      set_confirm_state("valid");
      set_confirm_error(null);
    } else {
      set_confirm_state("error");
      set_confirm_error("Passwords don't match");
    }
  }, []);

  const validate_name_field = useCallback((value, is_blur = false) => {
    const trimmed = value.trim();
    if (!trimmed) {
      if (is_blur) {
        set_name_state("error");
        set_name_error("Name is required");
      } else {
        set_name_state("idle");
        set_name_error(null);
      }
      return;
    }
    if (trimmed.length >= 2 && trimmed.length <= 40) {
      set_name_state("valid");
      set_name_error(null);
    } else if (trimmed.length > 40) {
      set_name_state("error");
      set_name_error("Name too long (max 40)");
    } else {
      set_name_state("error");
      set_name_error("At least 2 characters");
    }
  }, []);

  useEffect(() => {
    if (confirm_touched && mode === MODES.REGISTER)
      validate_confirm_field(confirm_password, password);
  }, [password, confirm_password, confirm_touched, mode, validate_confirm_field]);

  const handle_email_blur = () => {
    set_email_touched(true);
    validate_email_field(email, true);
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      set_shake_key((k) => k + 1);
      haptic_error();
    }
  };
  const handle_password_blur = () => {
    set_password_touched(true);
    validate_password_field(password, mode === MODES.REGISTER, true);
    if (!password || (mode === MODES.REGISTER && password.length < 6)) {
      set_shake_key((k) => k + 1);
      haptic_error();
    }
  };
  const handle_confirm_blur = () => {
    set_confirm_touched(true);
    validate_confirm_field(confirm_password, password, true);
    if (!confirm_password || confirm_password !== password) {
      set_shake_key((k) => k + 1);
      haptic_error();
    }
  };
  const handle_name_blur = () => {
    set_name_touched(true);
    validate_name_field(display_name, true);
    if (!display_name.trim() || display_name.trim().length < 2) {
      set_shake_key((k) => k + 1);
      haptic_error();
    }
  };
  const handle_name_change = (e) => {
    const v = e.target.value;
    set_display_name(v);
    set_error(null);
    if (name_touched) validate_name_field(v);
  };

  const handle_email_change = (e) => {
    const v = e.target.value;
    set_email(v);
    set_error(null);
    if (email_touched) validate_email_field(v);
  };
  const handle_password_change = (e) => {
    const v = e.target.value;
    set_password(v);
    set_error(null);
    if (password_touched) validate_password_field(v, mode === MODES.REGISTER);
  };
  const handle_confirm_change = (e) => {
    const v = e.target.value;
    set_confirm_password(v);
    set_error(null);
    if (confirm_touched) validate_confirm_field(v, password);
  };

  /* ── Submit ── */
  const handle_submit = async (e) => {
    e.preventDefault();
    set_error(null);
    set_success_msg(null);

    set_email_touched(true);
    set_password_touched(true);
    if (mode === MODES.REGISTER || mode === MODES.FORGOT) {
      set_confirm_touched(true);
      set_name_touched(true);
    }

    let has_error = false;
    if (mode === MODES.REGISTER) {
      const trimmed_name = display_name.trim();
      if (!trimmed_name || trimmed_name.length < 2) {
        set_name_state("error");
        set_name_error(
          trimmed_name ? "At least 2 characters" : "Name is required",
        );
        has_error = true;
      } else if (trimmed_name.length > 40) {
        set_name_state("error");
        set_name_error("Name too long (max 40)");
        has_error = true;
      }
    }
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      set_email_state("error");
      set_email_error(
        email.trim() ? "Invalid email format" : "Email is required",
      );
      has_error = true;
    }
    if (mode === MODES.REGISTER && password.length < 6) {
      set_password_state("error");
      set_password_error("At least 6 characters");
      has_error = true;
    } else if (!password) {
      set_password_state("error");
      set_password_error("Password is required");
      has_error = true;
    }
    if (
      (mode === MODES.REGISTER || mode === MODES.FORGOT) &&
      password !== confirm_password
    ) {
      set_confirm_state("error");
      set_confirm_error("Passwords don't match");
      has_error = true;
    }
    if (has_error) {
      set_shake_key((k) => k + 1);
      return;
    }

    set_loading(true);
    try {
      const supabase = get_supabase_client();

      if (mode === MODES.LOGIN) {
        const { error: auth_error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (auth_error) {
          set_error(auth_error.message);
          set_shake_key((k) => k + 1);
          toast_error("Login failed.");
        } else {
          toast_success("Welcome back!");
        }
      } else if (mode === MODES.REGISTER) {
        const { data: signUpData, error: auth_error } =
          await supabase.auth.signUp({
            email: email.trim(),
            password,
            options: { data: { display_name: display_name.trim() } },
          });
        if (auth_error) {
          set_error(auth_error.message);
          set_shake_key((k) => k + 1);
          toast_error("Registration failed.");
        } else {
          toast_success("Account created! Welcome!");
        }
      } else if (mode === MODES.FORGOT) {
        const { error: reset_error } = await supabase.rpc(
          "reset_user_password",
          {
            user_email: email.trim(),
            new_password: password,
          },
        );
        if (reset_error) {
          set_error(reset_error.message);
          set_shake_key((k) => k + 1);
          toast_error("Password reset failed.");
        } else {
          toast_success("Password updated! Sign in with your new password.");
          switch_mode(MODES.LOGIN);
        }
      }
    } catch (err) {
      set_error(err.message || "Something went wrong.");
      set_shake_key((k) => k + 1);
      toast_error("Authentication error.");
    }
    set_loading(false);
  };

  /* ── Form validity ── */
  const is_form_valid = useMemo(() => {
    if (mode === MODES.LOGIN) {
      return email.trim().length > 0 && password.length > 0;
    }
    if (mode === MODES.REGISTER) {
      return (
        display_name.trim().length >= 2 &&
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) &&
        password.length >= 6 &&
        confirm_password === password
      );
    }
    if (mode === MODES.FORGOT) {
      return (
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) &&
        password.length >= 6 &&
        confirm_password === password
      );
    }
    return false;
  }, [mode, email, password, confirm_password, display_name]);

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
            <rect width="40" height="40" rx="12" fill="url(#logo_grad)" />
            <path
              d="M12 28V12h4l6 10 6-10h4v16h-4V18l-6 10-6-10v10h-4Z"
              fill="white"
              fillOpacity="0.95"
            />
            <defs>
              <linearGradient id="logo_grad" x1="0" y1="0" x2="40" y2="40">
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
        <div className="auth__card-pattern" aria-hidden="true" />
        <div className="auth__card-shine" aria-hidden="true" />

        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={mode + "-header"}
            className="auth__header"
            custom={direction}
            variants={slide_variants}
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
          confirm_password={confirm_password}
          display_name={display_name}
          show_password={show_password}
          loading={loading}
          error={error}
          success_msg={success_msg}
          email_state={email_state}
          password_state={password_state}
          confirm_state={confirm_state}
          name_state={name_state}
          email_error={email_error}
          password_error={password_error}
          confirm_error={confirm_error}
          name_error={name_error}
          email_touched={email_touched}
          password_touched={password_touched}
          confirm_touched={confirm_touched}
          name_touched={name_touched}
          shake_key={shake_key}
          email_ref={email_ref}
          is_form_valid={is_form_valid}
          on_email_change={handle_email_change}
          on_password_change={handle_password_change}
          onConfirmChange={handle_confirm_change}
          on_name_change={handle_name_change}
          on_email_blur={handle_email_blur}
          on_password_blur={handle_password_blur}
          on_confirm_blur={handle_confirm_blur}
          on_name_blur={handle_name_blur}
          onToggleShowPassword={() => set_show_password(!show_password)}
          onSubmit={handle_submit}
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
                onClick={() => switch_mode(MODES.FORGOT)}
              >
                Forgot password?
              </button>
              <span className="auth__footer-sep">·</span>
              <button
                type="button"
                className="auth__link"
                onClick={() => switch_mode(MODES.REGISTER)}
              >
                Create account
              </button>
            </>
          )}
          {mode === MODES.REGISTER && (
            <button
              type="button"
              className="auth__link"
              onClick={() => switch_mode(MODES.LOGIN)}
            >
              Already have an account? Sign in
            </button>
          )}
          {mode === MODES.FORGOT && (
            <button
              type="button"
              className="auth__link"
              onClick={() => switch_mode(MODES.LOGIN)}
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

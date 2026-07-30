import { MODES } from "./Password_strength_bar";
import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Get_supabase_client } from "../../Lib/Superbase.jsx";
import { Use_glass_toast } from "../../Lib/Glass_toast_provider.jsx";
import { Haptic_error } from "../../Lib/Security";
import AuthForm, { slide_variants } from "./Auth_form";
import "./Auth.css";

/* ── Main Auth component ── */
function Auth() {
  const [mode, Set_mode] = useState(MODES.LOGIN);
  const [direction, Set_direction] = useState(1);
  const [email, Set_email] = useState("");
  const [password, Set_password] = useState("");
  const [confirm_password, Set_confirm_password] = useState("");
  const [display_name, Set_display_name] = useState("");
  const [show_password, Set_show_password] = useState(false);
  const [Loading, Set_loading] = useState(false);
  const [error, Set_error] = useState(null);
  const [success_msg, Set_success_msg] = useState(null);

  // Field states: "idle" | "valid" | "error"
  const [email_state, Set_email_state] = useState("idle");
  const [password_state, Set_password_state] = useState("idle");
  const [confirm_state, Set_confirm_state] = useState("idle");
  const [email_error, Set_email_error] = useState(null);
  const [password_error, Set_password_error] = useState(null);
  const [confirm_error, Set_confirm_error] = useState(null);

  const [email_touched, Set_email_touched] = useState(false);
  const [password_touched, Set_password_touched] = useState(false);
  const [confirm_touched, Set_confirm_touched] = useState(false);
  const [name_touched, Set_name_touched] = useState(false);
  const [name_state, Set_name_state] = useState("idle");
  const [name_error, Set_name_error] = useState(null);
  const [Shake_key, Set_shake_key] = useState(0);

  const Email_ref = useRef(null);
  const { success: Toast_success, error: Toast_error } = Use_glass_toast();

  useEffect(() => {
    const t = setTimeout(() => Email_ref.current?.focus(), 400);
    return () => clearTimeout(t);
  }, []);

  const Switch_mode = (new_mode) => {
    Set_error(null);
    Set_success_msg(null);
    Set_email_state("idle");
    Set_password_state("idle");
    Set_confirm_state("idle");
    Set_email_error(null);
    Set_password_error(null);
    Set_confirm_error(null);
    Set_email_touched(false);
    Set_password_touched(false);
    Set_confirm_touched(false);
    Set_name_touched(false);
    Set_name_state("idle");
    Set_name_error(null);
    Set_display_name("");
    Set_direction(new_mode === MODES.REGISTER ? 1 : -1);
    Set_mode(new_mode);
  };

  /* ── Validators ── */

  const Validate_email_field = useCallback((value, is_blur = false) => {
    if (!value.trim()) {
      if (is_blur) {
        Set_email_state("error");
        Set_email_error("Email is required");
      } else {
        Set_email_state("idle");
        Set_email_error(null);
      }
      return;
    }
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())) {
      Set_email_state("valid");
      Set_email_error(null);
    } else {
      Set_email_state("error");
      Set_email_error("Invalid email format");
    }
  }, []);

  const Validate_password_field = useCallback((value, is_register, is_blur = false) => {
    if (!value) {
      if (is_blur) {
        Set_password_state("error");
        Set_password_error("Password is required");
      } else {
        Set_password_state("idle");
        Set_password_error(null);
      }
      return;
    }
    if (is_register) {
      if (value.length >= 8) {
        Set_password_state("valid");
        Set_password_error(null);
      } else if (value.length >= 6) {
        Set_password_state("idle");
        Set_password_error(null);
      } else {
        Set_password_state("error");
        Set_password_error("At least 6 characters");
      }
    } else {
      Set_password_state(value.length > 0 ? "valid" : "idle");
      Set_password_error(null);
    }
  }, []);

  const Validate_confirm_field = useCallback((value, pw, is_blur = false) => {
    if (!value) {
      if (is_blur) {
        Set_confirm_state("error");
        Set_confirm_error("Confirm your password");
      } else {
        Set_confirm_state("idle");
        Set_confirm_error(null);
      }
      return;
    }
    if (value === pw) {
      Set_confirm_state("valid");
      Set_confirm_error(null);
    } else {
      Set_confirm_state("error");
      Set_confirm_error("Passwords don't match");
    }
  }, []);

  const Validate_name_field = useCallback((value, is_blur = false) => {
    const trimmed = value.trim();
    if (!trimmed) {
      if (is_blur) {
        Set_name_state("error");
        Set_name_error("Name is required");
      } else {
        Set_name_state("idle");
        Set_name_error(null);
      }
      return;
    }
    if (trimmed.length >= 2 && trimmed.length <= 40) {
      Set_name_state("valid");
      Set_name_error(null);
    } else if (trimmed.length > 40) {
      Set_name_state("error");
      Set_name_error("Name too long (max 40)");
    } else {
      Set_name_state("error");
      Set_name_error("At least 2 characters");
    }
  }, []);

  useEffect(() => {
    if (confirm_touched && mode === MODES.REGISTER)
      Validate_confirm_field(confirm_password, password);
  }, [password, confirm_password, confirm_touched, mode, Validate_confirm_field]);

  const Handle_email_blur = () => {
    Set_email_touched(true);
    Validate_email_field(email, true);
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      Set_shake_key((k) => k + 1);
      Haptic_error();
    }
  };
  const Handle_password_blur = () => {
    Set_password_touched(true);
    Validate_password_field(password, mode === MODES.REGISTER, true);
    if (!password || (mode === MODES.REGISTER && password.length < 6)) {
      Set_shake_key((k) => k + 1);
      Haptic_error();
    }
  };
  const Handle_confirm_blur = () => {
    Set_confirm_touched(true);
    Validate_confirm_field(confirm_password, password, true);
    if (!confirm_password || confirm_password !== password) {
      Set_shake_key((k) => k + 1);
      Haptic_error();
    }
  };
  const Handle_name_blur = () => {
    Set_name_touched(true);
    Validate_name_field(display_name, true);
    if (!display_name.trim() || display_name.trim().length < 2) {
      Set_shake_key((k) => k + 1);
      Haptic_error();
    }
  };
  const Handle_name_change = (e) => {
    const v = e.target.value;
    Set_display_name(v);
    Set_error(null);
    if (name_touched) Validate_name_field(v);
  };

  const Handle_email_change = (e) => {
    const v = e.target.value;
    Set_email(v);
    Set_error(null);
    if (email_touched) Validate_email_field(v);
  };
  const Handle_password_change = (e) => {
    const v = e.target.value;
    Set_password(v);
    Set_error(null);
    if (password_touched) Validate_password_field(v, mode === MODES.REGISTER);
  };
  const Handle_confirm_change = (e) => {
    const v = e.target.value;
    Set_confirm_password(v);
    Set_error(null);
    if (confirm_touched) Validate_confirm_field(v, password);
  };

  /* ── Submit ── */
  const Handle_submit = async (e) => {
    e.preventDefault();
    Set_error(null);
    Set_success_msg(null);

    Set_email_touched(true);
    Set_password_touched(true);
    if (mode === MODES.REGISTER || mode === MODES.FORGOT) {
      Set_confirm_touched(true);
      Set_name_touched(true);
    }

    let has_error = false;
    if (mode === MODES.REGISTER) {
      const trimmed_name = display_name.trim();
      if (!trimmed_name || trimmed_name.length < 2) {
        Set_name_state("error");
        Set_name_error(
          trimmed_name ? "At least 2 characters" : "Name is required",
        );
        has_error = true;
      } else if (trimmed_name.length > 40) {
        Set_name_state("error");
        Set_name_error("Name too long (max 40)");
        has_error = true;
      }
    }
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      Set_email_state("error");
      Set_email_error(
        email.trim() ? "Invalid email format" : "Email is required",
      );
      has_error = true;
    }
    if (mode === MODES.REGISTER && password.length < 6) {
      Set_password_state("error");
      Set_password_error("At least 6 characters");
      has_error = true;
    } else if (!password) {
      Set_password_state("error");
      Set_password_error("Password is required");
      has_error = true;
    }
    if (
      (mode === MODES.REGISTER || mode === MODES.FORGOT) &&
      password !== confirm_password
    ) {
      Set_confirm_state("error");
      Set_confirm_error("Passwords don't match");
      has_error = true;
    }
    if (has_error) {
      Set_shake_key((k) => k + 1);
      return;
    }

    Set_loading(true);
    try {
      const supabase = Get_supabase_client();

      if (mode === MODES.LOGIN) {
        const { error: auth_error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (auth_error) {
          Set_error(auth_error.message);
          Set_shake_key((k) => k + 1);
          Toast_error("Login failed.");
        } else {
          Toast_success("Welcome back!");
        }
      } else if (mode === MODES.REGISTER) {
        const { data: signUpData, error: auth_error } =
          await supabase.auth.signUp({
            email: email.trim(),
            password,
            options: { data: { display_name: display_name.trim() } },
          });
        if (auth_error) {
          Set_error(auth_error.message);
          Set_shake_key((k) => k + 1);
          Toast_error("Registration failed.");
        } else {
          Toast_success("Account created! Welcome!");
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
          Set_error(reset_error.message);
          Set_shake_key((k) => k + 1);
          Toast_error("Password reset failed.");
        } else {
          Toast_success("Password updated! Sign in with your new password.");
          Switch_mode(MODES.LOGIN);
        }
      }
    } catch (err) {
      Set_error(err.message || "Something went wrong.");
      Set_shake_key((k) => k + 1);
      Toast_error("Authentication error.");
    }
    Set_loading(false);
  };

  /* ── Form validity ── */
  const Is_form_valid = useMemo(() => {
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
          Loading={Loading}
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
          Shake_key={Shake_key}
          Email_ref={Email_ref}
          Is_form_valid={Is_form_valid}
          on_email_change={Handle_email_change}
          on_password_change={Handle_password_change}
          onConfirmChange={Handle_confirm_change}
          on_name_change={Handle_name_change}
          on_email_blur={Handle_email_blur}
          on_password_blur={Handle_password_blur}
          on_confirm_blur={Handle_confirm_blur}
          on_name_blur={Handle_name_blur}
          onToggleShowPassword={() => Set_show_password(!show_password)}
          onSubmit={Handle_submit}
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
                onClick={() => Switch_mode(MODES.FORGOT)}
              >
                Forgot password?
              </button>
              <span className="auth__footer-sep">·</span>
              <button
                type="button"
                className="auth__link"
                onClick={() => Switch_mode(MODES.REGISTER)}
              >
                Create account
              </button>
            </>
          )}
          {mode === MODES.REGISTER && (
            <button
              type="button"
              className="auth__link"
              onClick={() => Switch_mode(MODES.LOGIN)}
            >
              Already have an account? Sign in
            </button>
          )}
          {mode === MODES.FORGOT && (
            <button
              type="button"
              className="auth__link"
              onClick={() => Switch_mode(MODES.LOGIN)}
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

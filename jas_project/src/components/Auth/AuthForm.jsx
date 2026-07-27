import PasswordStrengthBar, { MODES } from "./PasswordStrengthBar";
import { motion, AnimatePresence } from "framer-motion";

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
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
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
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
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

/* ── Shake wrapper ── */
function ShakeField({ trigger, children, ...rest }) {
  return (
    <motion.div
      key={"shake-" + trigger}
      initial={false}
      animate={trigger > 0 ? { x: [0, -10, 10, -8, 8, -4, 4, 0] } : { x: 0 }}
      transition={{ duration: 0.5, ease: "easeInOut" }}
      {...rest}
    >
      {children}
    </motion.div>
  );
}

const slideVariants = {
  enter: (dir) => ({ x: dir > 0 ? 80 : -80, opacity: 0, scale: 0.96 }),
  center: { x: 0, opacity: 1, scale: 1 },
  exit: (dir) => ({ x: dir > 0 ? -80 : 80, opacity: 0, scale: 0.96 }),
};

function AuthForm({
  mode,
  direction,
  email,
  password,
  confirmPassword,
  displayName,
  showPassword,
  loading,
  error,
  successMsg,
  emailState,
  passwordState,
  confirmState,
  nameState,
  emailError,
  passwordError,
  confirmError,
  nameError,
  emailTouched,
  passwordTouched,
  confirmTouched,
  nameTouched,
  shakeKey,
  emailRef,
  isFormValid,
  onEmailChange,
  onPasswordChange,
  onConfirmChange,
  onNameChange,
  onEmailBlur,
  onPasswordBlur,
  onConfirmBlur,
  onNameBlur,
  onToggleShowPassword,
  onSubmit,
}) {
  const inputClass = (touched, state) =>
    [
      "auth__input",
      touched && state === "valid" ? "auth__input--valid" : "",
      touched && state === "error" ? "auth__input--error" : "",
    ]
      .filter(Boolean)
      .join(" ");

  const wrapClass = (touched, state) =>
    `${touched && state === "valid" ? "auth__input-wrap--valid" : ""} ${touched && state === "error" ? "auth__input-wrap--error" : ""}`.trim();

  return (
    <AnimatePresence mode="wait" custom={direction}>
      <motion.form
        key={mode + "-form"}
        className="auth__form"
        onSubmit={onSubmit}
        custom={direction}
        variants={slideVariants}
        initial="enter"
        animate="center"
        exit="exit"
        transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
      >
        {/* Name (register only) */}
        {mode === MODES.REGISTER && (
          <ShakeField
            trigger={nameState === "error" ? shakeKey : 0}
            className="auth__field"
          >
            <label className="auth__label" htmlFor="auth-name">
              Name
            </label>
            <div
              className={`auth__input-wrap ${wrapClass(nameTouched, nameState)}`}
            >
              <svg
                className="auth__input-icon"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.75"
                aria-hidden="true"
              >
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
              <input
                id="auth-name"
                type="text"
                className={inputClass(nameTouched, nameState)}
                placeholder="Your name"
                value={displayName}
                onChange={onNameChange}
                onBlur={onNameBlur}
                required
                autoComplete="name"
                maxLength={40}
              />
              {nameTouched && <FieldIndicator state={nameState} />}
            </div>
            <FieldError message={nameTouched ? nameError : null} />
          </ShakeField>
        )}

        {/* Email */}
        <ShakeField
          trigger={emailState === "error" ? shakeKey : 0}
          className="auth__field"
        >
          <label className="auth__label" htmlFor="auth-email">
            Email
          </label>
          <div
            className={`auth__input-wrap ${wrapClass(emailTouched, emailState)}`}
          >
            <svg
              className="auth__input-icon"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.75"
              aria-hidden="true"
            >
              <rect x="2" y="4" width="20" height="16" rx="3" />
              <path d="m2 7 10 6 10-6" />
            </svg>
            <input
              ref={emailRef}
              id="auth-email"
              type="email"
              className={inputClass(emailTouched, emailState)}
              placeholder="you@example.com"
              value={email}
              onChange={onEmailChange}
              onBlur={onEmailBlur}
              required
              autoComplete="email"
              autoCapitalize="none"
              spellCheck="false"
            />
            {emailTouched && <FieldIndicator state={emailState} />}
          </div>
          <FieldError message={emailTouched ? emailError : null} />
        </ShakeField>

        {/* Password */}
        <ShakeField
          trigger={passwordState === "error" ? shakeKey : 0}
          className="auth__field"
        >
          <label className="auth__label" htmlFor="auth-password">
            Password
          </label>
          <div
            className={`auth__input-wrap ${wrapClass(passwordTouched, passwordState)}`}
          >
            <svg
              className="auth__input-icon"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.75"
              aria-hidden="true"
            >
              <rect x="3" y="11" width="18" height="11" rx="3" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
            <input
              id="auth-password"
              type={showPassword ? "text" : "password"}
              className={inputClass(passwordTouched, passwordState)}
              placeholder="••••••••"
              value={password}
              onChange={onPasswordChange}
              onBlur={onPasswordBlur}
              required
              autoComplete={
                mode === MODES.LOGIN ? "current-password" : "new-password"
              }
              minLength={6}
            />
            <button
              type="button"
              className="auth__eye-btn"
              onClick={onToggleShowPassword}
              aria-label={showPassword ? "Hide password" : "Show password"}
              tabIndex={-1}
            >
              {showPassword ? (
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.75"
                >
                  <path d="M3 3l18 18M10.5 10.5a3 3 0 1 0 4.24 4.24" />
                  <path d="M9.88 5.09A10.37 10.37 0 0 1 12 5c5 0 9 4 10 7-.37 1.1-1.06 2.24-2.06 3.32M6.12 6.12C3.56 7.76 2 10 2 10s3 6 10 6c1.38 0 2.66-.25 3.82-.68" />
                </svg>
              ) : (
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.75"
                >
                  <path d="M2 10s3-6 10-6 10 6 10 6-3 6-10 6S2 10 2 10Z" />
                  <circle cx="12" cy="10" r="3" />
                </svg>
              )}
            </button>
            {passwordTouched && <FieldIndicator state={passwordState} />}
          </div>
          <FieldError message={passwordTouched ? passwordError : null} />
          <PasswordStrengthBar password={password} mode={mode} />
        </ShakeField>

        {/* Confirm Password */}
        {(mode === MODES.REGISTER || mode === MODES.FORGOT) && (
          <ShakeField
            trigger={confirmState === "error" ? shakeKey : 0}
            className="auth__field"
          >
            <label className="auth__label" htmlFor="auth-confirm">
              Confirm password
            </label>
            <div
              className={`auth__input-wrap ${wrapClass(confirmTouched, confirmState)}`}
            >
              <svg
                className="auth__input-icon"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.75"
                aria-hidden="true"
              >
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" />
                <path d="m9 12 2 2 4-4" />
              </svg>
              <input
                id="auth-confirm"
                type={showPassword ? "text" : "password"}
                className={inputClass(confirmTouched, confirmState)}
                placeholder="••••••••"
                value={confirmPassword}
                onChange={onConfirmChange}
                onBlur={onConfirmBlur}
                required
                autoComplete="new-password"
                minLength={6}
              />
              {confirmTouched && <FieldIndicator state={confirmState} />}
            </div>
            <FieldError message={confirmTouched ? confirmError : null} />
          </ShakeField>
        )}

        {/* Global Error */}
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
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                aria-hidden="true"
              >
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              {error}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Global Success */}
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
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                aria-hidden="true"
              >
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
          className={`auth__submit ${loading ? "auth__submit--loading" : ""}`}
          disabled={loading || !isFormValid}
          whileTap={{ scale: 0.97 }}
          whileHover={{ scale: 1.01 }}
        >
          <AnimatePresence mode="wait">
            {loading ? (
              <motion.span
                key="spinner"
                className="auth__spinner"
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.5 }}
                aria-label="Loading"
              />
            ) : (
              <motion.span
                key="text"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                {mode === MODES.LOGIN
                  ? "Sign in"
                  : mode === MODES.REGISTER
                    ? "Create account"
                    : "Reset password"}
              </motion.span>
            )}
          </AnimatePresence>
        </motion.button>
      </motion.form>
    </AnimatePresence>
  );
}

export { FieldIndicator, FieldError, ShakeField, slideVariants };
export default AuthForm;

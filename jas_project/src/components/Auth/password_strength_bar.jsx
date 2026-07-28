import { motion } from "framer-motion";

export const MODES = { LOGIN: "login", REGISTER: "register", FORGOT: "forgot" };

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
  const colors = [
    "#f87171",
    "#fb923c",
    "#fbbf24",
    "#a3e635",
    "#34d399",
    "#22d3ee",
  ];
  return { score, label: labels[score], color: colors[score], checks };
}

export default function PasswordStrengthBar({ password, mode }) {
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
              {key === "length"
                ? "8+"
                : key === "lowercase"
                  ? "a-z"
                  : key === "uppercase"
                    ? "A-Z"
                    : key === "numbers"
                      ? "0-9"
                      : "!@#"}
            </span>
          ))}
        </div>
      </div>
    </motion.div>
  );
}

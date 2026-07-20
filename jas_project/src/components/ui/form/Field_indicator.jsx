import { motion, AnimatePresence } from "framer-motion";

/**
 * FieldIndicator — Animated check (valid) or cross (error) circle inline.
 * @param {{ state: "idle" | "valid" | "error" }} props
 */
export default function FieldIndicator({ state }) {
  return (
    <AnimatePresence mode="wait">
      {state === "valid" && (
        <motion.span
          key="check"
          className="form-field__indicator form-field__indicator--valid"
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
          className="form-field__indicator form-field__indicator--error"
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

import { motion, AnimatePresence } from "framer-motion";

/**
 * FieldError — Animated error message that slides in/out.
 * @param {{ message: string | null }} props
 */
export default function FieldError({ message }) {
  return (
    <AnimatePresence>
      {message && (
        <motion.span
          className="form-field__error-msg"
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

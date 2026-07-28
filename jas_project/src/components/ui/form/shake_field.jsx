import { motion } from "framer-motion";

/**
 * ShakeField — Wrapper that shakes children when trigger count changes.
 * @param {{ trigger: number, children: React.ReactNode, className?: string }} props
 */
export default function ShakeField({ trigger, children, className, ...rest }) {
  return (
    <motion.div
      key={"shake-" + trigger}
      initial={false}
      animate={trigger > 0 ? { x: [0, -10, 10, -8, 8, -4, 4, 0] } : { x: 0 }}
      transition={{ duration: 0.5, ease: "easeInOut" }}
      className={className}
      {...rest}
    >
      {children}
    </motion.div>
  );
}

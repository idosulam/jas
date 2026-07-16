/**
 * FormField — Label + input/select/textarea + error text + char count.
 * Replaces the repeated label + input + error pattern.
 *
 * Enhanced mode (when `state` prop is provided):
 *   - Shows FieldIndicator (check/cross) if `showIndicator` is true
 *   - Uses animated FieldError instead of static error text
 *   - Wraps in ShakeField if `shake` is truthy
 *   - Adds form-field--valid or form-field--error-enhanced class
 */
import { Children } from "react";
import FieldIndicator from "./FieldIndicator";
import FieldError from "./FieldError";
import ShakeField from "./ShakeField";
import "./FormField.css";

export default function FormField({
  label,
  error,
  charCount,
  maxChars,
  children,
  className = "",
  optional = false,
  // Enhanced mode props:
  state, // "idle" | "valid" | "error"
  showIndicator = false,
  shake, // boolean or number — truthy enables shake wrapper
}) {
  const hasError = !!error;
  const enhanced = state != null;

  // Determine CSS class for enhanced mode
  let stateClass = "";
  if (enhanced) {
    if (state === "valid") stateClass = "form-field--valid";
    else if (state === "error") stateClass = "form-field--error-enhanced";
  }

  // In enhanced mode with indicator, wrap the first child (input/select/textarea)
  // in a positioned container so the indicator sits inside the field
  let fieldContent = children;
  if (enhanced && showIndicator) {
    const childArray = Children.toArray(children);
    if (childArray.length > 0) {
      const firstChild = childArray[0];
      if (firstChild && typeof firstChild === "object" && firstChild.props) {
        const wrapped = (
          <div className="form-field__input-wrap">
            {firstChild}
            <FieldIndicator state={state} />
          </div>
        );
        fieldContent = [wrapped, ...childArray.slice(1)];
      }
    }
  }

  const inner = (
    <label
      className={`form-field ${hasError && !enhanced ? "form-field--error" : ""} ${stateClass} ${className}`}
    >
      <span>
        {label}{" "}
        {optional && <span className="form-field__optional">(optional)</span>}
        {hasError && !enhanced && (
          <span className="form-field__error-inline"> — {error}</span>
        )}
      </span>
      {fieldContent}
      {enhanced ? (
        <FieldError message={error || null} />
      ) : null}
      {charCount != null && maxChars != null && charCount > 0 && (
        <span className="form-field__char-count">
          {charCount}/{maxChars}
        </span>
      )}
    </label>
  );

  if (enhanced && shake) {
    const trigger = typeof shake === "number" ? shake : 1;
    return <ShakeField trigger={trigger}>{inner}</ShakeField>;
  }

  return inner;
}

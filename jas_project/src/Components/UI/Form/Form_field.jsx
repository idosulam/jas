/**
 * Form_field — Label + input/select/textarea + error text + char count.
 * Replaces the repeated label + input + error pattern.
 *
 * Enhanced mode (when `state` prop is provided):
 *   - Shows Field_indicator (check/cross) if `show_indicator` is true
 *   - Uses animated Field_error instead of static error text
 *   - Wraps in Shake_field if `shake` is truthy
 *   - Adds form-field--valid or form-field--error-enhanced class
 */
import { Children } from "react";
import Field_indicator from "./Field_indicator";
import Field_error from "./Field_error";
import Shake_field from "./Shake_field";
import "./Form_field.css";

export default function Form_field({
  label,
  error,
  char_count,
  max_chars,
  children,
  className = "",
  optional = false,
  // Enhanced mode props:
  state, // "idle" | "valid" | "error"
  show_indicator = false,
  shake, // boolean or number — truthy enables shake wrapper
}) {
  const has_error = !!error;
  const enhanced = state != null;

  // Determine CSS class for enhanced mode
  let state_class = "";
  if (enhanced) {
    if (state === "valid") state_class = "form-field--valid";
    else if (state === "error") state_class = "form-field--error-enhanced";
  }

  // In enhanced mode with indicator, wrap the first child (input/select/textarea)
  // in a positioned container so the indicator sits inside the field
  let field_content = children;
  if (enhanced && show_indicator) {
    const child_array = Children.toArray(children);
    if (child_array.length > 0) {
      const first_child = child_array[0];
      if (first_child && typeof first_child === "object" && first_child.props) {
        const wrapped = (
          <div key="form-field-wrap" className="form-field__input-wrap">
            {first_child}
            <Field_indicator state={state} />
          </div>
        );
        field_content = [wrapped, ...child_array.slice(1)];
      }
    }
  }

  const inner = (
    <label
      className={`form-field ${has_error && !enhanced ? "form-field--error" : ""} ${state_class} ${className}`}
    >
      <span>
        {label}{" "}
        {optional && <span className="form-field__optional">(optional)</span>}
        {has_error && !enhanced && (
          <span className="form-field__error-inline"> — {error}</span>
        )}
      </span>
      {field_content}
      {enhanced ? <Field_error message={error || null} /> : null}
      {char_count != null && max_chars != null && char_count > 0 && (
        <span className="form-field__char-count">
          {char_count}/{max_chars}
        </span>
      )}
    </label>
  );

  if (enhanced && shake) {
    const trigger = typeof shake === "number" ? shake : 1;
    return <Shake_field trigger={trigger}>{inner}</Shake_field>;
  }

  return inner;
}

/**
 * FormField — Label + input/select/textarea + error text + char count.
 * Replaces the repeated label + input + error pattern.
 */
export default function FormField({
  label,
  error,
  charCount,
  maxChars,
  children,
  className = "",
  fieldClassName = "",
  optional = false,
}) {
  const hasError = !!error;

  return (
    <label className={`form-field ${hasError ? "form-field--error" : ""} ${className}`}>
      <span>
        {label}{" "}
        {optional && <span className="form-field__optional">(optional)</span>}
        {hasError && (
          <span className="form-field__error-inline"> — {error}</span>
        )}
      </span>
      {children}
      {charCount != null && maxChars != null && charCount > 0 && (
        <span className="form-field__char-count">
          {charCount}/{maxChars}
        </span>
      )}
    </label>
  );
}

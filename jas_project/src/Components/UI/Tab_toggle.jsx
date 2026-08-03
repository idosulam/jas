import { useEffect } from "react";

export default function Tab_toggle({
  options,
  activeId,
  onChange,
  ariaLabel,
  indicator,
  setIndicator,
  containerRef,
  className = "",
  role = "tablist",
  buttonRole = "tab",
  renderOption,
}) {
  useEffect(() => {
    if (!containerRef?.current || !setIndicator) return;

    const updateIndicator = () => {
      const active = containerRef.current.querySelector(
        ".tab-toggle__btn--active",
      );
      if (!active) return;
      const cRect = containerRef.current.getBoundingClientRect();
      const aRect = active.getBoundingClientRect();
      setIndicator({
        left: aRect.left - cRect.left,
        width: aRect.width,
      });
    };

    updateIndicator();
    window.addEventListener("resize", updateIndicator);
    return () => window.removeEventListener("resize", updateIndicator);
  }, [activeId, containerRef, setIndicator, options]);

  return (
    <div
      className={`tab-toggle animate-in animate-in--1 ${className}`}
      role={role}
      aria-label={ariaLabel}
      ref={containerRef}
    >
      {options.map((option) => {
        const isActive = activeId === option.id;
        const optionClass = `tab-toggle__btn${isActive ? " tab-toggle__btn--active" : ""}${option.className ? ` ${option.className}` : ""}`;
        return (
          <button
            key={option.id}
            type="button"
            className={optionClass}
            onClick={() => onChange(option.id)}
            role={buttonRole}
            aria-label={option.ariaLabel || option.label}
            aria-selected={buttonRole === "tab" ? isActive : undefined}
            aria-pressed={buttonRole !== "tab" ? isActive : undefined}
            aria-controls={option.controlId}
          >
            {renderOption ? renderOption(option, isActive) : option.label}
          </button>
        );
      })}
      {indicator && (
        <span
          className="tab-toggle__indicator"
          style={{
            transform: `translateX(${indicator.left}px)`,
            width: indicator.width,
          }}
          aria-hidden="true"
        />
      )}
    </div>
  );
}

import {
  memo,
  useCallback,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";

const TabToggleButton = memo(function TabToggleButton({
  option,
  isActive,
  onChange,
  buttonRole,
  renderOption,
}) {
  const handleClick = useCallback(() => {
    onChange(option.id);
  }, [onChange, option.id]);

  return (
    <button
      type="button"
      className={`tab-toggle__btn${isActive ? " tab-toggle__btn--active" : ""}${option.className ? ` ${option.className}` : ""}`}
      onClick={handleClick}
      role={buttonRole}
      aria-label={option.ariaLabel || option.label}
      aria-selected={buttonRole === "tab" ? isActive : undefined}
      aria-pressed={buttonRole !== "tab" ? isActive : undefined}
      aria-controls={option.controlId}
    >
      {renderOption ? renderOption(option, isActive) : option.label}
    </button>
  );
});

function Tab_toggle({
  options,
  activeId,
  onChange,
  ariaLabel,
  className = "",
  role = "tablist",
  buttonRole = "tab",
  renderOption,
}) {
  const ref = useRef(null);
  const [localIndicator, setLocalIndicator] = useState({ left: 0, width: 0 });

  const updateIndicator = useCallback(() => {
    if (!ref.current) return;
    const active = ref.current.querySelector(".tab-toggle__btn--active");
    if (!active) return;
    const cRect = ref.current.getBoundingClientRect();
    const aRect = active.getBoundingClientRect();
    setLocalIndicator({ left: aRect.left - cRect.left, width: aRect.width });
  }, []);

  useLayoutEffect(() => {
    updateIndicator();
    window.addEventListener("resize", updateIndicator);
    return () => window.removeEventListener("resize", updateIndicator);
  }, [updateIndicator, options, activeId]);

  const renderButtons = useMemo(
    () =>
      options.map((option) => {
        const isActive = activeId === option.id;
        return (
          <TabToggleButton
            key={option.id}
            option={option}
            isActive={isActive}
            onChange={onChange}
            buttonRole={buttonRole}
            renderOption={renderOption}
          />
        );
      }),
    [activeId, buttonRole, onChange, options, renderOption],
  );

  return (
    <div
      className={`tab-toggle animate-in animate-in--1 ${className}`}
      role={role}
      aria-label={ariaLabel}
      ref={ref}
    >
      {renderButtons}
      <span
        className="tab-toggle__indicator"
        style={{
          transform: `translateX(${localIndicator.left}px)`,
          width: localIndicator.width,
        }}
        aria-hidden="true"
      />
    </div>
  );
}

export default memo(Tab_toggle);

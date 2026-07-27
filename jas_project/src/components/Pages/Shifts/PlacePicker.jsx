import SheetModal from "../../../components/ui/modals/Sheet_modal";

/**
 * Workplace filter: inline pills (desktop) or trigger + picker sheet (mobile).
 *
 * Props:
 *   places            – PLACES map
 *   placeFilters      – array of { id, label, active? }
 *   selectedPlaceId   – current filter id ("all" or a slug)
 *   onSelect(id)      – select a filter
 *   isMobile          – boolean
 *   pickerOpen        – mobile picker modal open flag
 *   pickerClosing     – mobile picker modal closing flag
 *   onOpenPicker()    – open mobile picker
 *   onClosePicker()   – close mobile picker
 *   indicator         – { left, width } for the sliding pill indicator
 *   containerRef      – ref for the inline-pills container
 */
export default function PlacePicker({
  places,
  placeFilters,
  selectedPlaceId,
  onSelect,
  isMobile,
  pickerOpen,
  pickerClosing,
  onOpenPicker,
  onClosePicker,
  indicator,
  containerRef,
}) {
  const useInline = !isMobile && placeFilters.length > 1;

  if (placeFilters.length <= 1) return null;

  if (useInline) {
    return (
      <div
        className="shifts__place-filter animate-in animate-in--2"
        role="group"
        aria-label="Filter by place"
        ref={containerRef}
      >
        {placeFilters.map(({ id, label, active }) => (
          <button
            key={id}
            type="button"
            data-place={id}
            className={`shifts__place-btn${selectedPlaceId === id ? " shifts__place-btn--active" : ""}${id !== "all" ? ` shifts__place-btn--${id}` : ""}${active === false ? " shifts__place-btn--deactivated" : ""}`}
            onClick={() => onSelect(id)}
            aria-pressed={selectedPlaceId === id}
          >
            {label}
            {active === false && (
              <span
                className="shifts__place-deactivated-dot"
                aria-label="Deactivated"
              />
            )}
          </button>
        ))}
        <span
          className="shifts__place-indicator"
          style={{
            transform: `translateX(${indicator.left}px)`,
            width: indicator.width,
          }}
          aria-hidden="true"
        />
      </div>
    );
  }

  // Mobile trigger + picker sheet
  return (
    <>
      <button
        type="button"
        className="shifts__place-trigger animate-in animate-in--2"
        onClick={onOpenPicker}
        aria-haspopup="listbox"
        aria-expanded={pickerOpen}
      >
        <span
          className="shifts__place-trigger-dot"
          style={{
            background:
              selectedPlaceId === "all"
                ? "var(--color-primary, #818cf8)"
                : places[selectedPlaceId]?.color ||
                  "var(--color-primary, #818cf8)",
          }}
        />
        {placeFilters.find((f) => f.id === selectedPlaceId)?.label || "All"}
        <span className="shifts__place-trigger-chevron" aria-hidden="true">
          ▾
        </span>
      </button>

      <SheetModal
        open={pickerOpen}
        closing={pickerClosing}
        onClose={onClosePicker}
        title="Filter by workplace"
        compact
      >
        <ul className="shifts__picker-list">
          {placeFilters.map(({ id, label, active }) => {
            const isActive = selectedPlaceId === id;
            const color =
              id === "all"
                ? "var(--color-primary, #818cf8)"
                : places[id]?.color || "var(--color-primary, #818cf8)";
            return (
              <li key={id}>
                <button
                  type="button"
                  className={`shifts__picker-item${isActive ? " shifts__picker-item--active" : ""}${active === false ? " shifts__picker-item--deactivated" : ""}`}
                  onClick={() => onSelect(id)}
                  role="option"
                  aria-selected={isActive}
                >
                  <span
                    className="shifts__picker-dot"
                    style={{ background: color }}
                  />
                  <span className="shifts__picker-label">{label}</span>
                  {active === false && (
                    <span className="shifts__picker-deactivated-tag">
                      inactive
                    </span>
                  )}
                  {isActive && (
                    <span className="shifts__picker-check" aria-hidden="true">
                      ✓
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </SheetModal>
    </>
  );
}

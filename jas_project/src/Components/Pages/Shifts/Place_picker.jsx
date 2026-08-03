import Sheet_modal from "../../../Components/UI/Modals/Sheet_modal";

/**
 * Workplace filter: inline pills (desktop) or trigger + picker sheet (mobile).
 *
 * Props:
 *   places            – PLACES map
 *   placeFilters      – array of { id, label, active? }
 *   selectedPlaceId   – current filter id ("all" or a slug)
 *   onSelect(id)      – select a filter
 *   Is_mobile          – boolean
 *   Picker_open        – mobile picker modal open flag
 *   Picker_closing     – mobile picker modal closing flag
 *   onOpenPicker()    – open mobile picker
 *   onClosePicker()   – close mobile picker
 *   indicator         – { left, width } for the sliding pill indicator
 *   containerRef      – ref for the inline-pills container
 */
export default function Place_picker({
  places,
  placeFilters,
  selectedPlaceId,
  onSelect,
  Is_mobile,
  Picker_open,
  Picker_closing,
  onOpenPicker,
  onClosePicker,
  indicator,
  containerRef,
}) {
  const useInline = !Is_mobile && placeFilters.length > 1;

  if (placeFilters.length <= 1) return null;

  if (useInline) {
    return (
      <div
        className="tab-toggle animate-in animate-in--2"
        role="group"
        aria-label="Filter by place"
        ref={containerRef}
      >
        {placeFilters.map(({ id, label, active }) => (
          <button
            key={id}
            type="button"
            data-place={id}
            className={`tab-toggle__btn${selectedPlaceId === id ? " tab-toggle__btn--active" : ""}${id !== "all" ? ` tab-toggle__btn--${id}` : ""}${active === false ? " tab-toggle__btn--deactivated" : ""}`}
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
          className="tab-toggle__indicator"
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
        className="picker-trigger animate-in animate-in--2"
        onClick={onOpenPicker}
        aria-haspopup="listbox"
        aria-expanded={Picker_open}
      >
        <span
          className="picker-trigger__dot"
          style={{
            background:
              selectedPlaceId === "all"
                ? "var(--color-primary, #818cf8)"
                : places[selectedPlaceId]?.color ||
                  "var(--color-primary, #818cf8)",
          }}
        />
        {placeFilters.find((f) => f.id === selectedPlaceId)?.label || "All"}
        <span className="picker-trigger__chevron" aria-hidden="true">
          ▾
        </span>
      </button>

      <Sheet_modal
        open={Picker_open}
        closing={Picker_closing}
        onClose={onClosePicker}
        title="Filter by workplace"
        compact
      >
        <ul className="picker-list">
          {placeFilters.map(({ id, label, active }) => {
            const is_active = selectedPlaceId === id;
            const color =
              id === "all"
                ? "var(--color-primary, #818cf8)"
                : places[id]?.color || "var(--color-primary, #818cf8)";
            return (
              <li key={id}>
                <button
                  type="button"
                  className={`picker-item${is_active ? " picker-item--active" : ""}${active === false ? " picker-item--deactivated" : ""}`}
                  onClick={() => onSelect(id)}
                  role="option"
                  aria-selected={is_active}
                >
                  <span
                    className="picker-item__dot"
                    style={{ background: color }}
                  />
                  <span className="picker-item__label">{label}</span>
                  {active === false && (
                    <span className="picker-item__deactivated-tag">
                      inactive
                    </span>
                  )}
                  {is_active && (
                    <span className="picker-item__check" aria-hidden="true">
                      ✓
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </Sheet_modal>
    </>
  );
}

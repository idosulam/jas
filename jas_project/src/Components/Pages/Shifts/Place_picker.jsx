import { useCallback, useMemo } from "react";
import Sheet_modal from "../../../Components/UI/Modals/Sheet_modal";
import Tab_toggle from "../../../Components/UI/Tab_toggle";

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
}) {
  const useInline = !Is_mobile && placeFilters.length > 1;

  if (placeFilters.length <= 1) return null;

  const placeOptions = useMemo(
    () =>
      placeFilters.map(({ id, label, active }) => ({
        id,
        label,
        className: `${id !== "all" ? `tab-toggle__btn--${id}` : ""}${active === false ? " tab-toggle__btn--deactivated" : ""}`,
        ariaLabel: label,
        deactivated: active === false,
      })),
    [placeFilters],
  );

  const renderOption = useCallback(
    (option) => (
      <>
        {option.label}
        {option.deactivated && (
          <span
            className="shifts__place-deactivated-dot"
            aria-label="Deactivated"
          />
        )}
      </>
    ),
    [],
  );

  if (useInline) {
    return (
      <Tab_toggle
        options={placeOptions}
        activeId={selectedPlaceId}
        onChange={onSelect}
        ariaLabel="Filter by place"
        role="group"
        buttonRole="button"
        renderOption={renderOption}
      />
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

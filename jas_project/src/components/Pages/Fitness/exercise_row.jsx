import { kg_to_lbs, lbs_to_kg } from "../../../lib/weight";
import ShakeField from "../../../components/UI/form/shake_field";
import FieldIndicator from "../../../components/UI/form/field_indicator";

export default function ExerciseRow({
  exercise,
  index,
  onChange,
  onRemove,
  showRemove,
  errors = {},
  states = {},
  shake_key = 0,
  onFieldBlur,
}) {
  const err = (field) => errors[`${index}_${field}`] || null;
  const state = (field) => states[`${index}_${field}`] || "idle";

  const fieldClass = (field) => {
    const s = state(field);
    if (s === "error") return " fitness__exercise-field--error";
    if (s === "valid") return " fitness__exercise-field--valid";
    return "";
  };

  const handle_blur = (field) => {
    if (onFieldBlur) onFieldBlur(index, field);
  };

  const nameField = (
    <>
      <div className="form-field__input-wrap">
        <input
          type="text"
          className={`fitness__exercise-name${fieldClass("name")}`}
          placeholder="Exercise name"
          value={exercise.name}
          maxLength={80}
          onChange={(e) => onChange(index, "name", e.target.value)}
          onBlur={() => handle_blur("name")}
        />
        <FieldIndicator state={state("name")} />
      </div>
    </>
  );

  return (
    <div className="fitness__exercise-row">
      <div className="fitness__exercise-fields">
        {err("name") ? (
          <ShakeField trigger={shake_key}>{nameField}</ShakeField>
        ) : (
          nameField
        )}
        <div className="fitness__exercise-numbers">
          {["weight", "weight_lbs", "sets", "reps"].map((field) => {
            const isWeight = field === "weight";
            const isLbs = field === "weight_lbs";
            const placeholder = isWeight
              ? "kg"
              : isLbs
                ? "lbs"
                : field;
            const step = isWeight || isLbs ? "0.5" : undefined;

            const input = (
              <div key={field} className="form-field__input-wrap form-field__input-wrap--num">
                <input
                  type="number"
                  className={`fitness__exercise-input${fieldClass(field)}`}
                  placeholder={placeholder}
                  min="0"
                  step={step}
                  value={exercise[field]}
                  onChange={(e) => {
                    onChange(index, field, e.target.value);
                    if (isWeight) onChange(index, "weight_lbs", kg_to_lbs(e.target.value));
                    if (isLbs) onChange(index, "weight", lbs_to_kg(e.target.value));
                  }}
                  onBlur={() => handle_blur(field)}
                />
              </div>
            );

            if (err(field)) {
              return (
                <ShakeField key={field} trigger={shake_key}>{input}</ShakeField>
              );
            }
            return input;
          })}
        </div>
      </div>
      {showRemove && (
        <button
          type="button"
          className="fitness__exercise-remove"
          onClick={() => onRemove(index)}
          aria-label="Remove exercise"
        >
          ×
        </button>
      )}
    </div>
  );
}

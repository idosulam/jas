import { Kg_to_lbs, Lbs_to_kg } from "../../../Lib/weight";
import Shake_field from "../../../Components/UI/Form/Shake_field";
import Field_indicator from "../../../Components/UI/Form/Field_indicator";

export default function Exercise_row({
  exercise,
  index,
  onChange,
  onRemove,
  showRemove,
  errors = {},
  states = {},
  Shake_key = 0,
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
        <Field_indicator state={state("name")} />
      </div>
    </>
  );

  return (
    <div className="fitness__exercise-row">
      <div className="fitness__exercise-fields">
        {err("name") ? (
          <Shake_field trigger={Shake_key}>{nameField}</Shake_field>
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
                    if (isWeight) onChange(index, "weight_lbs", Kg_to_lbs(e.target.value));
                    if (isLbs) onChange(index, "weight", Lbs_to_kg(e.target.value));
                  }}
                  onBlur={() => handle_blur(field)}
                />
              </div>
            );

            if (err(field)) {
              return (
                <Shake_field key={field} trigger={Shake_key}>{input}</Shake_field>
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

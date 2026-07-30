import SheetModal from "../../../Components/UI/Modals/Sheet_modal";
import FormField from "../../../Components/UI/Form/Form_field.jsx";

const MEAL_TYPES = [
  { id: "breakfast", label: "Breakfast" },
  { id: "lunch", label: "Lunch" },
  { id: "dinner", label: "Dinner" },
  { id: "snack", label: "Snack" },
];

function DietEntryForm({
  open,
  closing,
  onClose,
  editingEntry,
  form,
  set_form,
  saving,
  is_form_valid,
  field_errors,
  set_field_errors,
  field_states,
  shake_key,
  onSubmit,
  onFieldBlur,
}) {
  return (
    <SheetModal
      open={open}
      closing={closing}
      onClose={onClose}
      title={editingEntry ? "Edit food" : "Log food"}
    >
      <form className="fitness__form" onSubmit={onSubmit}>
        <FormField
          label="Date"
          error={field_errors.entry_date}
          state={field_states.entry_date}
          show_indicator
          shake={field_errors.entry_date ? shake_key : 0}
        >
          <input
            type="date"
            value={form.entry_date}
            onChange={(e) => {
              set_form((f) => ({ ...f, entry_date: e.target.value }));
              set_field_errors((prev) => ({ ...prev, entry_date: null }));
            }}
            onBlur={() => onFieldBlur("entry_date")}
            required
          />
        </FormField>

        <FormField label="Meal type">
          <select
            value={form.meal_type}
            onChange={(e) =>
              set_form((f) => ({ ...f, meal_type: e.target.value }))
            }
          >
            {MEAL_TYPES.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
        </FormField>

        <FormField
          label="Food name"
          error={field_errors.food_name}
          state={field_states.food_name}
          show_indicator
          shake={field_errors.food_name ? shake_key : 0}
        >
          <input
            type="text"
            placeholder="e.g. Chicken breast, Rice"
            value={form.food_name}
            maxLength={120}
            onChange={(e) => {
              set_form((f) => ({ ...f, food_name: e.target.value }));
              set_field_errors((prev) => ({ ...prev, food_name: null }));
            }}
            onBlur={() => onFieldBlur("food_name")}
            required
          />
        </FormField>

        <FormField label="Calories (kcal)">
          <input
            type="number"
            min="0"
            max="10000"
            step="1"
            placeholder="0"
            value={form.calories}
            onChange={(e) =>
              set_form((f) => ({ ...f, calories: e.target.value }))
            }
          />
        </FormField>

        <div className="fitness__macro-inputs">
          <FormField label="Protein (g)">
            <input
              type="number"
              min="0"
              max="999"
              step="0.1"
              placeholder="0"
              value={form.protein_g}
              onChange={(e) =>
                set_form((f) => ({ ...f, protein_g: e.target.value }))
              }
            />
          </FormField>
          <FormField label="Carbs (g)">
            <input
              type="number"
              min="0"
              max="999"
              step="0.1"
              placeholder="0"
              value={form.carbs_g}
              onChange={(e) =>
                set_form((f) => ({ ...f, carbs_g: e.target.value }))
              }
            />
          </FormField>
          <FormField label="Fats (g)">
            <input
              type="number"
              min="0"
              max="999"
              step="0.1"
              placeholder="0"
              value={form.fats_g}
              onChange={(e) =>
                set_form((f) => ({ ...f, fats_g: e.target.value }))
              }
            />
          </FormField>
        </div>

        <FormField label="Fiber (g)" optional>
          <input
            type="number"
            min="0"
            max="99"
            step="0.1"
            placeholder="0"
            value={form.fiber_g}
            onChange={(e) =>
              set_form((f) => ({ ...f, fiber_g: e.target.value }))
            }
          />
        </FormField>

        <div className="btn-row">
          <button
            type="button"
            className="btn btn--ghost"
            onClick={onClose}
            disabled={saving}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="btn btn--primary"
            disabled={saving || !is_form_valid}
          >
            {saving ? (
              <>
                <span className="btn__spinner" aria-hidden="true" />
                Saving…
              </>
            ) : editingEntry ? (
              "Save changes"
            ) : (
              "Log food"
            )}
          </button>
        </div>
      </form>
    </SheetModal>
  );
}

export default DietEntryForm;

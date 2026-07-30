import Sheet_modal from "../../../Components/UI/Modals/Sheet_modal";
import Form_field from "../../../Components/UI/Form/Form_field.jsx";

const MEAL_TYPES = [
  { id: "breakfast", label: "Breakfast" },
  { id: "lunch", label: "Lunch" },
  { id: "dinner", label: "Dinner" },
  { id: "snack", label: "Snack" },
];

function Diet_entry_form({
  open,
  closing,
  onClose,
  editingEntry,
  form,
  Set_form,
  Saving,
  Is_form_valid,
  Field_errors,
  Set_field_errors,
  Field_states,
  Shake_key,
  onSubmit,
  onFieldBlur,
}) {
  return (
    <Sheet_modal
      open={open}
      closing={closing}
      onClose={onClose}
      title={editingEntry ? "Edit food" : "Log food"}
    >
      <form className="fitness__form" onSubmit={onSubmit}>
        <Form_field
          label="Date"
          error={Field_errors.Entry_date}
          state={Field_states.Entry_date}
          show_indicator
          shake={Field_errors.Entry_date ? Shake_key : 0}
        >
          <input
            type="date"
            value={form.Entry_date}
            onChange={(e) => {
              Set_form((f) => ({ ...f, Entry_date: e.target.value }));
              Set_field_errors((prev) => ({ ...prev, Entry_date: null }));
            }}
            onBlur={() => onFieldBlur("Entry_date")}
            required
          />
        </Form_field>

        <Form_field label="Meal type">
          <select
            value={form.meal_type}
            onChange={(e) =>
              Set_form((f) => ({ ...f, meal_type: e.target.value }))
            }
          >
            {MEAL_TYPES.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
        </Form_field>

        <Form_field
          label="Food name"
          error={Field_errors.food_name}
          state={Field_states.food_name}
          show_indicator
          shake={Field_errors.food_name ? Shake_key : 0}
        >
          <input
            type="text"
            placeholder="e.g. Chicken breast, Rice"
            value={form.food_name}
            maxLength={120}
            onChange={(e) => {
              Set_form((f) => ({ ...f, food_name: e.target.value }));
              Set_field_errors((prev) => ({ ...prev, food_name: null }));
            }}
            onBlur={() => onFieldBlur("food_name")}
            required
          />
        </Form_field>

        <Form_field label="Calories (kcal)">
          <input
            type="number"
            min="0"
            max="10000"
            step="1"
            placeholder="0"
            value={form.calories}
            onChange={(e) =>
              Set_form((f) => ({ ...f, calories: e.target.value }))
            }
          />
        </Form_field>

        <div className="fitness__macro-inputs">
          <Form_field label="Protein (g)">
            <input
              type="number"
              min="0"
              max="999"
              step="0.1"
              placeholder="0"
              value={form.protein_g}
              onChange={(e) =>
                Set_form((f) => ({ ...f, protein_g: e.target.value }))
              }
            />
          </Form_field>
          <Form_field label="Carbs (g)">
            <input
              type="number"
              min="0"
              max="999"
              step="0.1"
              placeholder="0"
              value={form.carbs_g}
              onChange={(e) =>
                Set_form((f) => ({ ...f, carbs_g: e.target.value }))
              }
            />
          </Form_field>
          <Form_field label="Fats (g)">
            <input
              type="number"
              min="0"
              max="999"
              step="0.1"
              placeholder="0"
              value={form.fats_g}
              onChange={(e) =>
                Set_form((f) => ({ ...f, fats_g: e.target.value }))
              }
            />
          </Form_field>
        </div>

        <Form_field label="Fiber (g)" optional>
          <input
            type="number"
            min="0"
            max="99"
            step="0.1"
            placeholder="0"
            value={form.fiber_g}
            onChange={(e) =>
              Set_form((f) => ({ ...f, fiber_g: e.target.value }))
            }
          />
        </Form_field>

        <div className="btn-row">
          <button
            type="button"
            className="btn btn--ghost"
            onClick={onClose}
            disabled={Saving}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="btn btn--primary"
            disabled={Saving || !Is_form_valid}
          >
            {Saving ? (
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
    </Sheet_modal>
  );
}

export default Diet_entry_form;

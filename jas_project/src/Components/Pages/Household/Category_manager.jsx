import Form_field from "../../UI/Form/Form_field.jsx";
import Color_palette_picker from "../../../Lib/Color_palette_picker.jsx";

export const DEFAULT_ICONS = [
  "🍔",
  "🚗",
  "🛍️",
  "💡",
  "🎬",
  "💊",
  "📚",
  "🏠",
  "👕",
  "🎁",
  "📱",
  "📦",
  "💰",
  "💻",
  "💵",
  "🎉",
  "📈",
  "☕",
  "✈️",
  "🏋️",
  "🐕",
  "🎵",
  "🔧",
];

export default function Category_manager({
  categories,
  categoryForm,
  setCategoryForm,
  editingCategory,
  formType,
  onEditCategory,
  onDeleteCategory,
  onSave,
  onClose,
}) {
  const filteredCategories = categories.filter((c) => c.type === formType);

  return (
    <div className="transactions__form">
      {/* Existing categories list */}
      {!editingCategory && (
        <div style={{ marginBottom: 16 }}>
          <label className="transactions__form-label">
            Your {formType} labels
          </label>
          {filteredCategories.length === 0 ? (
            <p
              style={{
                color: "var(--text-muted, #888)",
                fontSize: 14,
                margin: "8px 0",
              }}
            >
              No labels yet. Create one below.
            </p>
          ) : (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 6,
                marginBottom: 12,
              }}
            >
              {filteredCategories.map((cat) => (
                <div
                  key={cat.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "8px 12px",
                    borderRadius: 10,
                    background: "rgba(255,255,255,0.05)",
                    cursor: "pointer",
                  }}
                  onClick={() => onEditCategory(cat)}
                >
                  <span style={{ fontSize: 20 }}>{cat.icon}</span>
                  <span style={{ flex: 1, fontSize: 14 }}>{cat.name}</span>
                  <div
                    style={{
                      width: 12,
                      height: 12,
                      borderRadius: "50%",
                      background: cat.color,
                    }}
                  />
                  <span
                    style={{
                      color: "var(--text-muted, #888)",
                      fontSize: 12,
                    }}
                  >
                    ✎
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Create / Edit form */}
      <Form_field label="Label name">
        <input
          type="text"
          value={categoryForm.name}
          onChange={(e) =>
            setCategoryForm((f) => ({ ...f, name: e.target.value }))
          }
          placeholder="e.g. Coffee, Rent, Groceries"
          maxLength={40}
        />
      </Form_field>

      {/* Icon picker */}
      <div className="transactions__category-grid-wrap">
        <label className="transactions__form-label">Icon</label>
        <div className="transactions__category-grid">
          {DEFAULT_ICONS.map((icon) => (
            <button
              key={icon}
              type="button"
              className={`transactions__category-chip ${categoryForm.icon === icon ? "active" : ""}`}
              style={
                categoryForm.icon === icon
                  ? {
                      borderColor: categoryForm.color,
                      background: `${categoryForm.color}15`,
                    }
                  : {}
              }
              onClick={() => setCategoryForm((f) => ({ ...f, icon }))}
            >
              <span>{icon}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Color picker */}
      <div className="transactions__category-grid-wrap">
        <label className="transactions__form-label">Color</label>
        <Color_palette_picker
          value={categoryForm.color}
          onChange={(color) => setCategoryForm((f) => ({ ...f, color }))}
        />
      </div>

      {/* Type selector */}
      <div className="transactions__category-grid-wrap">
        <label className="transactions__form-label">Type</label>
        <div className="transactions__type-toggle" style={{ maxWidth: 220 }}>
          {["expense", "income"].map((t) => (
            <button
              key={t}
              type="button"
              className={`transactions__type-btn ${categoryForm.type === t ? `transactions__type-btn--active ${t}` : ""}`}
              onClick={() => setCategoryForm((f) => ({ ...f, type: t }))}
            >
              {t === "expense" ? "Expense" : "Income"}
            </button>
          ))}
        </div>
      </div>

      <div className="btn-row">
        <button type="button" className="btn btn--ghost" onClick={onClose}>
          {editingCategory ? "Back" : "Done"}
        </button>
        {editingCategory && (
          <button
            type="button"
            className="btn btn--danger"
            onClick={onDeleteCategory}
          >
            Delete
          </button>
        )}
        <button
          type="button"
          className="btn btn--primary"
          onClick={onSave}
          disabled={!categoryForm.name.trim()}
        >
          {editingCategory ? "Update" : "Create"}
        </button>
      </div>
    </div>
  );
}

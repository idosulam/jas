function MealGroup({
  meal,
  entries,
  Removing_id,
  onEdit,
  onDelete,
  on_add_for_meal,
  Add_btn_ref,
}) {
  const mealCals = entries.reduce(
    (s, e) => s + (Number(e.calories) || 0),
    0,
  );

  return (
    <div className="fitness__meal-group">
      <div className="fitness__meal-header">
        <h3 className="fitness__meal-title">{meal.label}</h3>
        <div className="fitness__meal-actions">
          <span className="fitness__meal-cals">
            {Math.round(mealCals)} kcal
          </span>
          <button
            type="button"
            className="fitness__meal-add"
            onClick={() => on_add_for_meal(meal.id)}
            ref={meal.id === "breakfast" ? Add_btn_ref : undefined}
            aria-label={`Add ${meal.label} entry`}
          >
            +
          </button>
        </div>
      </div>
      {entries.length === 0 ? (
        <p className="fitness__meal-empty">No entries</p>
      ) : (
        <ul className="fitness__meal-list">
          {entries.map((entry) => {
            const isRemoving = Removing_id === entry.id;
            return (
              <li
                key={entry.id}
                className={`fitness__entry${isRemoving ? " fitness__entry--removing" : ""}`}
              >
                <div className="fitness__entry-main">
                  <span className="fitness__entry-name">
                    {entry.food_name}
                  </span>
                  <span className="fitness__entry-macros">
                    {Number(entry.calories) > 0 && (
                      <span>{Math.round(Number(entry.calories))}kcal</span>
                    )}
                    {Number(entry.protein_g) > 0 && (
                      <span>P:{Math.round(Number(entry.protein_g))}g</span>
                    )}
                    {Number(entry.carbs_g) > 0 && (
                      <span>C:{Math.round(Number(entry.carbs_g))}g</span>
                    )}
                    {Number(entry.fats_g) > 0 && (
                      <span>F:{Math.round(Number(entry.fats_g))}g</span>
                    )}
                  </span>
                </div>
                <div className="fitness__entry-actions">
                  <button
                    type="button"
                    className="fitness__entry-btn fitness__entry-btn--edit"
                    onClick={() => onEdit(entry)}
                    aria-label="Edit entry"
                  >
                    ✎
                  </button>
                  <button
                    type="button"
                    className="fitness__entry-btn fitness__entry-btn--delete"
                    onClick={() => onDelete(entry)}
                    aria-label="Delete entry"
                  >
                    ×
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export default MealGroup;

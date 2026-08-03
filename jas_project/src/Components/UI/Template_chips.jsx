export default function Template_chips({
  items,
  onSelect,
  onEdit,
  onAdd,
  renderMeta,
  addLabel = "+ New preset",
  className = "",
}) {
  return (
    <div className={`template-chips animate-in animate-in--3 ${className}`}>
      {items.map((item) => (
        <div key={item.id} className="preset">
          <button
            type="button"
            className="template-chip"
            onClick={() => onSelect(item)}
          >
            {item.label || item.name}
            {renderMeta ? renderMeta(item) : null}
          </button>
          {onEdit && (
            <button
              type="button"
              className="preset__edit"
              onClick={() => onEdit(item)}
              aria-label={`Edit ${item.label || item.name} preset`}
            >
              ✎
            </button>
          )}
        </div>
      ))}
      <button
        type="button"
        className="template-chip template-chip--add"
        onClick={onAdd}
      >
        {addLabel}
      </button>
    </div>
  );
}

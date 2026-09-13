import { memo, useCallback } from "react";

const Template_chip = memo(function Template_chip({
  item,
  onSelect,
  onEdit,
  renderMeta,
}) {
  const handleSelect = useCallback(() => onSelect(item), [onSelect, item]);
  const handleEdit = useCallback(
    (event) => {
      event.stopPropagation();
      onEdit?.(item);
    },
    [onEdit, item],
  );

  return (
    <div className="preset">
      <button type="button" className="template-chip" onClick={handleSelect}>
        {item.label || item.name}
        {renderMeta ? renderMeta(item) : null}
      </button>
      {onEdit && (
        <button
          type="button"
          className="preset__edit"
          onClick={handleEdit}
          aria-label={`Edit ${item.label || item.name} preset`}
        >
          ✎
        </button>
      )}
    </div>
  );
});

function Template_chips({
  items,
  onSelect,
  onEdit,
  onAdd,
  renderMeta,
  addLabel = "+ New preset",
  className = "",
}) {
  const handleAdd = useCallback(() => {
    onAdd();
  }, [onAdd]);

  return (
    <div className={`template-chips animate-in animate-in--3 ${className}`}>
      {items.map((item) => (
        <Template_chip
          key={item.id}
          item={item}
          onSelect={onSelect}
          onEdit={onEdit}
          renderMeta={renderMeta}
        />
      ))}
      <button
        type="button"
        className="template-chip template-chip--add"
        onClick={handleAdd}
      >
        {addLabel}
      </button>
    </div>
  );
}

export default memo(Template_chips);

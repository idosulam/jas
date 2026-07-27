import { formatMoney } from "../../../lib/format";

export default function TransactionCard({ transaction, onEdit }) {
  const {
    id,
    description,
    amount,
    type,
    category_icon,
    category_color,
    category_name,
    display_name,
    is_me,
    is_recurring,
  } = transaction;

  return (
    <div
      className="transactions__item"
      onClick={() => onEdit(transaction)}
    >
      <div
        className="transactions__item-icon"
        style={{
          background: `${category_color}18`,
          color: category_color,
        }}
      >
        {category_icon}
      </div>
      <div className="transactions__item-info">
        <span className="transactions__item-desc">{description}</span>
        <span className="transactions__item-meta">
          {category_name}
          {` · ${is_me ? "You" : display_name}`}
          {is_recurring && " · 🔄"}
        </span>
      </div>
      <span className={`transactions__item-amount ${type}`}>
        {type === "expense" ? "-" : "+"}
        {formatMoney(amount)}
      </span>
    </div>
  );
}

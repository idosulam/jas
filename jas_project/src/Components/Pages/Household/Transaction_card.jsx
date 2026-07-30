import { Format_money } from "../../../Lib/Format";

/**
 * Avatar color palette — rotates based on name hash.
 */
const AVATAR_COLORS = [
  "#818cf8",
  "#f472b6",
  "#34d399",
  "#fbbf24",
  "#60a5fa",
  "#a78bfa",
  "#f97316",
  "#22d3ee",
];

function Get_avatar_color(name) {
  let hash = 0;
  for (let i = 0; i < (name || "").length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

export default function Transaction_card({ transaction, onEdit }) {
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

  const isContribute = type === "contribute";
  const avatarLetter = (is_me ? "Y" : (display_name || "U").charAt(0)).toUpperCase();
  const avatarColor = Get_avatar_color(is_me ? "You" : display_name);

  return (
    <div
      className="transactions__item"
      onClick={() => onEdit(transaction)}
    >
      <div className="transactions__item-icon-wrap">
        <div
          className="transactions__item-icon"
          style={{
            background: `${category_color}18`,
            color: category_color,
          }}
        >
          {category_icon}
        </div>
        {!isContribute && (
          <span
            className="transactions__item-avatar"
            style={{ background: avatarColor }}
            title={is_me ? "You" : display_name}
          >
            {avatarLetter}
          </span>
        )}
      </div>
      <div className="transactions__item-info">
        <span className="transactions__item-desc">{description}</span>
        <span className="transactions__item-meta">
          {category_name}
          {!isContribute && (
            <>
              {` · `}
              <span className="transactions__item-user">{is_me ? "You" : display_name}</span>
            </>
          )}
          {is_recurring && " · 🔄"}
        </span>
      </div>
      <span className={`transactions__item-amount ${type}`}>
        {type === "expense" ? "-" : "+"}
        {Format_money(amount)}
      </span>
    </div>
  );
}

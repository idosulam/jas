import "../../styles/Empty_state.css";

export default function EmptyState({
  icon,
  title,
  text,
  action,
  className = "",
}) {
  return (
    <div className={`empty-state glass-card ${className}`}>
      {icon && (
        <div className="empty-state__icon" aria-hidden="true">
          {icon}
        </div>
      )}
      {title && <p className="empty-state__title">{title}</p>}
      {text && <p className="empty-state__text">{text}</p>}
      {action && <div className="empty-state__action">{action}</div>}
    </div>
  );
}

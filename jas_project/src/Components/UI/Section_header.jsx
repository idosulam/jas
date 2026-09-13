import { memo } from "react";

function Section_header({
  title,
  subtitle,
  right,
  className = "",
  titleClassName = "",
  ...props
}) {
  return (
    <div
      className={`list-header animate-in animate-in--4 ${className}`}
      {...props}
    >
      <div className="list-header__title-wrap">
        <h2 className={`list-header__title ${titleClassName}`}>{title}</h2>
        {subtitle ? (
          <span className="list-header__subtitle">{subtitle}</span>
        ) : null}
      </div>
      {right ? <div className="list-header__actions">{right}</div> : null}
    </div>
  );
}

export default memo(Section_header);

/**
 * PageHeader — Eyebrow + Title + optional subtitle.
 * Consistent header across all pages.
 */
export default function PageHeader({ eyebrow, title, subtitle, className = "", children }) {
  return (
    <header className={`${className}`}>
      {eyebrow && <p className="page__eyebrow">{eyebrow}</p>}
      {title && <h1 className="page__title">{title}</h1>}
      {subtitle && <p className="page__subtitle">{subtitle}</p>}
      {children}
    </header>
  );
}

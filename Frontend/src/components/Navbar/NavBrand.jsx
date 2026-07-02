function NavBrand({ onSelect, className = '' }) {
  return (
    <button
      type="button"
      className={`nav-brand ${className}`.trim()}
      aria-label="Pulse home"
      onClick={() => onSelect?.('home')}
    >
      <span className="nav-brand__icon" aria-hidden="true" />
      <span className="nav-brand__text">Pulse</span>
    </button>
  )
}

export default NavBrand

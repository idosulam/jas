function MobileMenuButton({ isOpen, onToggle, className = '' }) {
  return (
    <button
      type="button"
      className={`nav-toggle ${isOpen ? 'nav-toggle--open' : ''} ${className}`.trim()}
      aria-expanded={isOpen}
      aria-controls="nav-menu"
      aria-label={isOpen ? 'Close navigation menu' : 'Open navigation menu'}
      onClick={onToggle}
    >
      <span className="nav-toggle__line nav-toggle__line--top" />
      <span className="nav-toggle__line nav-toggle__line--middle" />
      <span className="nav-toggle__line nav-toggle__line--bottom" />
    </button>
  )
}

export default MobileMenuButton

function NavItem({ item, isActive, onSelect, className = '' }) {
  return (
    <li className={`nav-item ${className}`.trim()}>
      <a
        className={`nav-item__link ${isActive ? 'nav-item__link--active' : ''}`.trim()}
        href={item.href}
        aria-current={isActive ? 'page' : undefined}
        onClick={(event) => {
          event.preventDefault()
          onSelect(item.id)
        }}
      >
        <span className="nav-item__label">{item.label}</span>
        <span className="nav-item__glow" aria-hidden="true" />
      </a>
    </li>
  )
}

export default NavItem

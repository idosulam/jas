import NavItem from './NavItem'

function NavMenu({ items, activeId, onSelect, isOpen = false, className = '' }) {
  return (
    <nav
      id="nav-menu"
      className={`nav-menu ${isOpen ? 'nav-menu--open' : ''} ${className}`.trim()}
      aria-label="Main navigation"
    >
      <ul className="nav-menu__list">
        {items.map((item) => (
          <NavItem
            key={item.id}
            item={item}
            isActive={activeId === item.id}
            onSelect={onSelect}
          />
        ))}
      </ul>
    </nav>
  )
}

export default NavMenu

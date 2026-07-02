import { useCallback, useEffect, useState } from 'react'
import NavBrand from './NavBrand'
import NavMenu from './NavMenu'
import MobileMenuButton from './MobileMenuButton'
import { navItems } from './navItems'
import './Navbar.css'

function Navbar({
  items = navItems,
  activeId = null,
  onSelect,
  className = '',
}) {
  const [isMobileOpen, setIsMobileOpen] = useState(false)

  const handleSelect = useCallback(
    (id) => {
      onSelect?.(id)
      setIsMobileOpen(false)
    },
    [onSelect],
  )

  const handleToggle = useCallback(() => {
    setIsMobileOpen((open) => !open)
  }, [])

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 768) {
        setIsMobileOpen(false)
      }
    }

    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  useEffect(() => {
    document.body.classList.toggle('nav-mobile-open', isMobileOpen)
    return () => document.body.classList.remove('nav-mobile-open')
  }, [isMobileOpen])

  return (
    <>
      <header className={`navbar ${className}`.trim()}>
        <div className="navbar__liquid navbar__liquid--one" aria-hidden="true" />
        <div className="navbar__liquid navbar__liquid--two" aria-hidden="true" />

        <div className="navbar__inner">
          <NavBrand onSelect={handleSelect} />

          <NavMenu
            items={items}
            activeId={activeId}
            onSelect={handleSelect}
            className="nav-menu--desktop"
          />

          <MobileMenuButton isOpen={isMobileOpen} onToggle={handleToggle} />
        </div>
      </header>

      <div
        className={`nav-drawer-backdrop ${isMobileOpen ? 'nav-drawer-backdrop--visible' : ''}`.trim()}
        aria-hidden="true"
        onClick={handleToggle}
      />

      <NavMenu
        items={items}
        activeId={activeId}
        onSelect={handleSelect}
        isOpen={isMobileOpen}
        className="nav-menu--mobile"
      />
    </>
  )
}

export default Navbar

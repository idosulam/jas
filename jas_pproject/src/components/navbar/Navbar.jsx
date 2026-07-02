import { useCallback, useEffect, useRef, useState } from 'react';
import nav_Shifts from '../navbar/Nav_Shifts';
import NavWorkouts from '../navbar/NavWorkouts';
import NavProfile from '../navbar/NavProfile';
import './Navbar.css';


const NAV_ITEMS = [
  { id: 'Shifts', Component: nav_Shifts },
  { id: 'workouts', Component: NavWorkouts },
  { id: 'profile', Component: NavProfile },
];

function Navbar({ activeId, onChange }) {
  const navRef = useRef(null);
  const prevActiveRef = useRef(activeId);
  const [indicator, setIndicator] = useState({ left: 0, width: 0 });
  const [isPulsing, setIsPulsing] = useState(false);

  const updateIndicator = useCallback(() => {
    const nav = navRef.current;
    if (!nav) return;

    const activeButton = nav.querySelector(`[data-nav-id="${activeId}"]`);
    if (!activeButton) return;

    const navRect = nav.getBoundingClientRect();
    const buttonRect = activeButton.getBoundingClientRect();

    setIndicator({
      left: buttonRect.left - navRect.left,
      width: buttonRect.width,
    });
  }, [activeId]);

  useEffect(() => {
    updateIndicator();
    window.addEventListener('resize', updateIndicator);
    return () => window.removeEventListener('resize', updateIndicator);
  }, [updateIndicator]);

  useEffect(() => {
    if (prevActiveRef.current === activeId) return;

    prevActiveRef.current = activeId;
    setIsPulsing(true);

    const timer = setTimeout(() => setIsPulsing(false), 450);
    return () => clearTimeout(timer);
  }, [activeId]);

  return (
    
    <nav className="navbar" aria-label="Main navigation">
      <div className={`navbar__glass ${isPulsing ? 'navbar__glass--pulse' : ''}`}>
        <div className="navbar__shine" aria-hidden="true" />
        <div className="navbar__inner" ref={navRef}>
          <div
            className="navbar__indicator"
            style={{
              transform: `translateX(${indicator.left}px)`,
              width: indicator.width,
            }}
            aria-hidden="true"
          />
          {NAV_ITEMS.map(({ id, Component }) => (
            <div key={id} data-nav-id={id} className="navbar__item">
              <Component
                isActive={activeId === id}
                onClick={() => onChange(id)}
              />
            </div>
          ))}
        </div>
      </div>
    </nav>
    
  );
}

export default Navbar;
import { useCallback, useEffect, useRef, useState } from "react";
import NavShifts from "./nav_shifts";
import NavCalendar from "./nav_calendar";
import NavFitness from "./nav_fitness";
import NavHousehold from "./nav_household";
import NavProfile from "./nav_profile";
import "./navbar.css";

const NAV_ITEMS = [
  { id: "Shifts", Component: NavShifts },
  { id: "Calendar", Component: NavCalendar },
  { id: "Fitness", Component: NavFitness },
  { id: "Household", Component: NavHousehold },
  { id: "Profile", Component: NavProfile },
];

function Navbar({ active_id, onChange }) {
  const nav_ref = useRef(null);
  const prev_active_ref = useRef(active_id);
  const [indicator, set_indicator] = useState({ left: 0, width: 0 });
  const [is_pulsing, set_is_pulsing] = useState(false);

  const update_indicator = useCallback(() => {
    const nav = nav_ref.current;
    if (!nav) return;

    const active_button = nav.querySelector(`[data-nav-id="${active_id}"]`);
    if (!active_button) return;

    const nav_rect = nav.getBoundingClientRect();
    const button_rect = active_button.getBoundingClientRect();

    set_indicator({
      left: button_rect.left - nav_rect.left,
      width: button_rect.width,
    });
  }, [active_id]);

  useEffect(() => {
    update_indicator();
    window.addEventListener("resize", update_indicator);
    return () => window.removeEventListener("resize", update_indicator);
  }, [update_indicator]);

  useEffect(() => {
    if (prev_active_ref.current === active_id) return;

    prev_active_ref.current = active_id;
    set_is_pulsing(true);

    const timer = setTimeout(() => set_is_pulsing(false), 450);
    return () => clearTimeout(timer);
  }, [active_id]);

  return (
    <nav className="navbar" aria-label="Main navigation">
      <div
        className={`navbar__glass ${is_pulsing ? "navbar__glass--pulse" : ""}`}
      >
        <div className="navbar__shine" aria-hidden="true" />
        <div className="navbar__inner" ref={nav_ref}>
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
                is_active={active_id === id}
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

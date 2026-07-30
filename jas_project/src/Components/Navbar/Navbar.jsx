import { useCallback, useEffect, useRef, useState } from "react";
import Nav_shifts from "./Nav_shifts";
import Nav_calendar from "./Nav_calendar";
import Nav_fitness from "./Nav_fitness";
import Nav_household from "./Nav_household";
import Nav_profile from "./Nav_profile";
import "./Navbar.css";

const NAV_ITEMS = [
  { id: "Shifts", Component: Nav_shifts },
  { id: "Calendar", Component: Nav_calendar },
  { id: "Fitness", Component: Nav_fitness },
  { id: "Household", Component: Nav_household },
  { id: "Profile", Component: Nav_profile },
];

function Navbar({ active_id, onChange }) {
  const Nav_ref = useRef(null);
  const Prev_active_ref = useRef(active_id);
  const [indicator, Set_indicator] = useState({ left: 0, width: 0 });
  const [Is_pulsing, Set_is_pulsing] = useState(false);

  const Update_indicator = useCallback(() => {
    const nav = Nav_ref.current;
    if (!nav) return;

    const Active_button = nav.querySelector(`[data-nav-id="${active_id}"]`);
    if (!Active_button) return;

    const Nav_rect = nav.getBoundingClientRect();
    const Button_rect = Active_button.getBoundingClientRect();

    Set_indicator({
      left: Button_rect.left - Nav_rect.left,
      width: Button_rect.width,
    });
  }, [active_id]);

  useEffect(() => {
    Update_indicator();
    window.addEventListener("resize", Update_indicator);
    return () => window.removeEventListener("resize", Update_indicator);
  }, [Update_indicator]);

  useEffect(() => {
    if (Prev_active_ref.current === active_id) return;

    Prev_active_ref.current = active_id;
    Set_is_pulsing(true);

    const timer = setTimeout(() => Set_is_pulsing(false), 450);
    return () => clearTimeout(timer);
  }, [active_id]);

  return (
    <nav className="navbar" aria-label="Main navigation">
      <div
        className={`navbar__glass ${Is_pulsing ? "navbar__glass--pulse" : ""}`}
      >
        <div className="navbar__shine" aria-hidden="true" />
        <div className="navbar__inner" ref={Nav_ref}>
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

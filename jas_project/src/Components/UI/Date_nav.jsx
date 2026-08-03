/**
 * Date_nav — Shared date navigation bar
 * Prev/next arrows + date label + optional "Today" button
 *
 * Props:
 *   label         – string to display between arrows
 *   isToday       – boolean, hides the "Today" button when true
 *   onPrev()      – called when left arrow is tapped
 *   onNext()      – called when right arrow is tapped
 *   onToday()     – called when "Today" is tapped
 *   className     – optional extra class on the root element
 *   prevLabel     – aria-label for prev button (default "Previous")
 *   nextLabel     – aria-label for next button (default "Next")
 */
export default function Date_nav({
  label,
  isToday,
  onPrev,
  onNext,
  onToday,
  className = "",
  prevLabel = "Previous",
  nextLabel = "Next",
}) {
  return (
    <div className={`date-nav ${className}`}>
      <div className="date-nav__top">
        <button
          type="button"
          className="date-nav__btn"
          onClick={onPrev}
          aria-label={prevLabel}
        >
          ‹
        </button>
        <span className="date-nav__label">{label}</span>
        <button
          type="button"
          className="date-nav__btn"
          onClick={onNext}
          aria-label={nextLabel}
        >
          ›
        </button>
      </div>
      {!isToday && (
        <button
          type="button"
          className="date-nav__today"
          onClick={onToday}
        >
          Today
        </button>
      )}
    </div>
  );
}

function NavFitness({ is_active, onClick }) {
  return (
    <button
      type="button"
      className={`nav-option ${is_active ? "nav-option--active" : ""}`}
      onClick={onClick}
      aria-current={is_active ? "page" : undefined}
    >
      <svg
        className="nav-option__icon"
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden="true"
      >
        {/* Dumbbell icon */}
        <path
          d="M6.5 6.5h11M6.5 17.5h11"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
        />
        <rect
          x="2"
          y="8"
          width="3"
          height="8"
          rx="1"
          stroke="currentColor"
          strokeWidth="1.75"
        />
        <rect
          x="19"
          y="8"
          width="3"
          height="8"
          rx="1"
          stroke="currentColor"
          strokeWidth="1.75"
        />
        <rect
          x="5"
          y="9.5"
          width="2"
          height="5"
          rx="0.5"
          stroke="currentColor"
          strokeWidth="1.25"
        />
        <rect
          x="17"
          y="9.5"
          width="2"
          height="5"
          rx="0.5"
          stroke="currentColor"
          strokeWidth="1.25"
        />
        <path
          d="M9 12h6"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
        />
      </svg>
      <span className="nav-option__label">Fitness</span>
    </button>
  );
}

export default NavFitness;

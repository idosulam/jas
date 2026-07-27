function Nav_Shifts({ isActive, onClick }) {
  return (
    <button
      type="button"
      className={`nav-option ${isActive ? "nav-option--active" : ""}`}
      onClick={onClick}
      aria-current={isActive ? "page" : undefined}
    >
      <svg
        className="nav-option__icon"
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden="true"
      >
        <path
          d="M3 10.5L12 3l9 7.5V20a1 1 0 01-1 1h-5v-6H9v6H4a1 1 0 01-1-1v-9.5z"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinejoin="round"
        />
      </svg>
      <span className="nav-option__label">Shifts</span>
    </button>
  );
}

export default Nav_Shifts;

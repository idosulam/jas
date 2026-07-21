function Nav_Household({ isActive, onClick }) {
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
          d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinejoin="round"
        />
        <circle cx="9" cy="14" r="2" stroke="currentColor" strokeWidth="1.5" />
        <circle cx="15" cy="14" r="2" stroke="currentColor" strokeWidth="1.5" />
        <path
          d="M9 16.5c0 0 1.5 2 3 2s3-2 3-2"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      </svg>
      <span className="nav-option__label">Us</span>
    </button>
  );
}

export default Nav_Household;

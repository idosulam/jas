function NavProfile({ isActive, onClick }) {
  return (
    <button
      type="button"
      className={`nav-option ${isActive ? 'nav-option--active' : ''}`}
      onClick={onClick}
      aria-current={isActive ? 'page' : undefined}
    >
      <svg className="nav-option__icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle cx="12" cy="8" r="4" stroke="currentColor" strokeWidth="1.75" />
        <path
          d="M5 20c0-3.866 3.134-7 7-7s7 3.134 7 7"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
        />
      </svg>
      <span className="nav-option__label">Profile</span>
    </button>
  );
}

export default NavProfile;

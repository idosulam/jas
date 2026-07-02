function NavWorkouts({ isActive, onClick }) {
  return (
    <button
      type="button"
      className={`nav-option ${isActive ? 'nav-option--active' : ''}`}
      onClick={onClick}
      aria-current={isActive ? 'page' : undefined}
    >
      <svg className="nav-option__icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d="M6.5 6.5a2.5 2.5 0 015 0v11a2.5 2.5 0 01-5 0v-11zm6 0a2.5 2.5 0 015 0v11a2.5 2.5 0 01-5 0v-11z"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
        />
      </svg>
      <span className="nav-option__label">Workouts</span>
    </button>
  );
}

export default NavWorkouts;

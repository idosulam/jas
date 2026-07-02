import './Profile.css';

function Profile() {
  return (
    <section className="page">
      <div className="profile__avatar animate-scale animate-in--1" aria-hidden="true">
        J
      </div>
      <h1 className="page__title animate-in animate-in--2">Profile</h1>
      <p className="page__subtitle animate-in animate-in--3">
        View stats and manage your account.
      </p>
    </section>
  );
}

export default Profile;

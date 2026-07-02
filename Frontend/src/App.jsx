import { useRef, useState } from 'react';
import Navbar from './components/Navbar/Navbar.jsx';
import PageTransition from './components/PageTransition.jsx';
import Home from './components/Pages/home/Home.jsx';
import Workouts from './components/Pages/workouts/Workouts.jsx';
import Profile from './components/Pages/profile/Profile.jsx';
import './styles/pages.css';
import './styles/animations.css';
import './App.css';

const TAB_ORDER = ['home', 'workouts', 'profile'];

const PAGES = {
  home: Home,
  workouts: Workouts,
  profile: Profile,
};

function App() {
  const [activeNav, setActiveNav] = useState('home');
  const [direction, setDirection] = useState('forward');
  const prevNavRef = useRef('home');

  const handleNavChange = (id) => {
    if (id === activeNav) return;

    const prevIndex = TAB_ORDER.indexOf(prevNavRef.current);
    const nextIndex = TAB_ORDER.indexOf(id);
    setDirection(nextIndex > prevIndex ? 'forward' : 'backward');
    prevNavRef.current = id;
    setActiveNav(id);
  };

  const ActivePage = PAGES[activeNav];

  return (
    <div className="app">
      <main className="app__content">
        <PageTransition pageKey={activeNav} direction={direction}>
          <ActivePage />
        </PageTransition>
      </main>
      <Navbar activeId={activeNav} onChange={handleNavChange} />
    </div>
  );
}

export default App;

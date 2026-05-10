import { NavLink } from 'react-router-dom';
import ThemeSwitcher from './ThemeSwitcher';

export default function Sidebar() {
  return (
    <aside className="sidebar">
      <div className="sidebar-top">
        <div>
          <div className="sidebar-logo">Books Core Ideas</div>
          <div className="sidebar-subtitle">Your personal reading journal</div>
        </div>
        <ThemeSwitcher />
      </div>
      <nav className="sidebar-nav">
        <NavLink to="/" end className={({ isActive }) => isActive ? 'active' : ''}>
          <span>📚</span> My Library
        </NavLink>
      </nav>
    </aside>
  );
}

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
        <NavLink to="/collections" className={({ isActive }) => isActive ? 'active' : ''}>
          <span>🗂️</span> Collections
        </NavLink>
        <NavLink to="/favorites" className={({ isActive }) => isActive ? 'active' : ''}>
          <span>⭐</span> Favorite Chapters
        </NavLink>
        <NavLink to="/reviews" className={({ isActive }) => isActive ? 'active' : ''}>
          <span>📝</span> Review Bank
        </NavLink>
        <NavLink to="/history" className={({ isActive }) => isActive ? 'active' : ''}>
          <span>🔖</span> Reading History
        </NavLink>
      </nav>
    </aside>
  );
}

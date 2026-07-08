import { NavLink, Link, Outlet } from 'react-router-dom';
import './hub.css';

export default function HubLayout() {
  return (
    <div className="hub-root">
      <nav className="hub-nav">
        <Link to="/hub" className="hub-nav-brand">
          <span className="hub-nav-eyebrow">FLUXNOVA</span>
          <span className="hub-nav-title">Innovation Lab</span>
        </Link>

        <div className="hub-nav-links">
          <NavLink
            to="/hub"
            end
            className={({ isActive }) =>
              `hub-nav-link${isActive ? ' active' : ''}`
            }
          >
            Demo Library
          </NavLink>
          <NavLink
            to="/hub/learn"
            className={({ isActive }) =>
              `hub-nav-link${isActive ? ' active' : ''}`
            }
          >
            Learn FluxNova
          </NavLink>
          <a href="/hub#about" className="hub-nav-link">
            About
          </a>
          <Link to="/apply" className="hub-nav-link hub-nav-back">
            ← Portal
          </Link>
        </div>
      </nav>

      <div className="hub-body">
        <Outlet />
      </div>
    </div>
  );
}

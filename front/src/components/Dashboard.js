import React, { memo } from 'react';
import { NavLink } from 'react-router-dom';
import './Dashboard.css';

const Dashboard = ({ user, onLogout, children }) => {
    return (
        <div className="dashboard">
            <header className="dashboard-header">
                <h2>Bienvenue, {user.username} !</h2>
                <button onClick={onLogout} className="btn btn-secondary">
                    Déconnexion
                </button>
            </header>

            <nav className="dashboard-nav">
                <NavLink
                    to="/matches"
                    className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
                >
                    Matchs
                </NavLink>
                <NavLink
                    to="/leagues"
                    className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
                >
                    Ligues
                </NavLink>
                <NavLink
                    to="/tickets"
                    className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
                >
                    Tickets
                </NavLink>
                <NavLink
                    to="/profile"
                    className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
                >
                    Profil
                </NavLink>
            </nav>

            <main className="dashboard-content">
                {children}
            </main>
        </div>
    );
};

export default memo(Dashboard);


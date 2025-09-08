import React from 'react';

const Dashboard = ({ user, onLogout }) => {
    return (
        <div className="dashboard">
            <header className="dashboard-header">
                <h2>Bienvenue, {user.username} !</h2>
                <button onClick={onLogout} className="btn btn-secondary">
                    Déconnexion
                </button>
            </header>
            <div className="dashboard-content">
                <p>Tableau de bord en cours de développement...</p>
            </div>
        </div>
    );
};

export default Dashboard;

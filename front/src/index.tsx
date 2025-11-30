import React from "react";
import ReactDOM from "react-dom/client";
import './styles/index.css'; // Nouveau design system
import AppRouter from './components/AppRouter';
import { initTheme } from './theme';

// Appliquer le thème au plus tôt pour éviter le FOUC
initTheme();

// Désactiver le mode debug global par défaut; on le conditionne via l'env
const isAuthDebug = process.env.REACT_APP_DEBUG === 'true';
if (isAuthDebug) {
  (window as any).__AUTH_DEBUG__ = true;
} else {
  delete (window as any).__AUTH_DEBUG__;
}

const rootElement = document.getElementById("root");
if (!rootElement) throw new Error('Failed to find root element');
const root = ReactDOM.createRoot(rootElement);
root.render(
    <React.StrictMode>
        <AppRouter />
    </React.StrictMode>
);

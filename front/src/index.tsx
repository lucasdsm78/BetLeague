import React from "react";
import ReactDOM from "react-dom/client";
import './styles/index.css'; // Nouveau design system
import AppRouter from './components/AppRouter';

const rootElement = document.getElementById("root");
if (!rootElement) throw new Error('Failed to find root element');
const root = ReactDOM.createRoot(rootElement);
root.render(
    <React.StrictMode>
        <AppRouter />
    </React.StrictMode>
);

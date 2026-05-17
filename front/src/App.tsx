/**
 * App Component - Public Home Entry Point
 */

import React, { memo, useEffect } from 'react';
import { initializeServices } from './services';
import { initializeStores } from './store';
import { InstallPrompt } from './components/pwa/InstallPrompt';
import Home from './components/home/Home';
import './styles/App.css';

function App(): React.JSX.Element {
  useEffect(() => {
    try {
      initializeServices();
      initializeStores();
    } catch (error) {
      console.error("Erreur d'initialisation", error);
    }
  }, []);

  return (
    <div className="app">
      <Home />
      <InstallPrompt />
    </div>
  );
}

export default memo(App);

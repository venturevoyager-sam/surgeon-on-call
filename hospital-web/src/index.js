/**
 * HOSPITAL WEB APP - Entry Point
 * 
 * This is the starting point of the React application.
 * It renders the root App component into the HTML page.
 */

import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css'; // Global styles including Tailwind

import App from './App';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';
// AUTH_BYPASS — import { MsalProvider } from '@azure/msal-react';
// AUTH_BYPASS — import { msalInstance, initializeMsal } from './authConfig';

// AUTH_BYPASS — original: initializeMsal().then(() => { ... })
const root = ReactDOM.createRoot(document.getElementById('root')); // AUTH_BYPASS
root.render(                                                        // AUTH_BYPASS
    <React.StrictMode>
        <App />
    </React.StrictMode>
);                                                                  // AUTH_BYPASS

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
reportWebVitals();

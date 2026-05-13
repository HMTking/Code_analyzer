import React from 'react';
// AUTH_BYPASS — import { Navigate } from 'react-router-dom';
// AUTH_BYPASS — import { useIsAuthenticated, useMsal } from '@azure/msal-react';
// AUTH_BYPASS — import { InteractionStatus } from '@azure/msal-browser';
// AUTH_BYPASS — import CircularProgress from '@mui/material/CircularProgress';
// AUTH_BYPASS — import Box from '@mui/material/Box';

function ProtectedRoute({ children }) {
    // AUTH_BYPASS — all auth checks commented out, always render children
    return children;
}

export default ProtectedRoute;

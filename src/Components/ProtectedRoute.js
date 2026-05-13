import React from 'react';
import { Navigate } from 'react-router-dom';
import { useIsAuthenticated, useMsal } from '@azure/msal-react';
import { InteractionStatus } from '@azure/msal-browser';
import CircularProgress from '@mui/material/CircularProgress';
import Box from '@mui/material/Box';

function ProtectedRoute({ children }) {
    const isAuthenticated = useIsAuthenticated();
    const { inProgress } = useMsal();
    
    // Wait for MSAL to finish any interactions (login, token acquisition, etc.)
    if (inProgress !== InteractionStatus.None) {
        return (
            <Box sx={{ 
                display: 'flex', 
                justifyContent: 'center', 
                alignItems: 'center', 
                height: '100vh',
                flexDirection: 'column',
                gap: 2
            }}>
                <CircularProgress sx={{ color: '#059bbf' }} />
                <span style={{ color: '#666' }}>Loading...</span>
            </Box>
        );
    }
    
    if (!isAuthenticated) {
        // Redirect to home page for login
        return <Navigate to="/" replace />;
    }
    
    return children;
}

export default ProtectedRoute;

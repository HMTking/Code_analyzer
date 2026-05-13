import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Typography, Card, CardContent, CardActionArea, Chip, Button, Dialog, DialogContent, Avatar } from '@mui/material';
import { useIsAuthenticated, useMsal } from '@azure/msal-react';
import { loginRequest } from '../authConfig';
import logo from '../Images/Logo.png';
import LogoutIcon from '@mui/icons-material/Logout';

const versions = [
    {
        title: 'Version 1',
        subtitle: 'Classic',
        description: 'Original data analysis and migration tools',
        features: [
            'Data Analysis: Fabric',
            'Data Analysis: Databricks',
            'Pipeline Migrator',
            'Notebook Migrator',
        ],
        color: '#0d6efd',
        path: '/v1',
    },
    {
        title: 'Version 2',
        subtitle: 'Enhanced',
        description: 'Next-gen analysis with repo exploration',
        features: [
            'Data Analysis: Fabric Enhanced',
            'POSOT Data Explorer',
        ],
        color: '#0891b2',
        path: '/v2',
    },
];

function Home() {
    const navigate = useNavigate();
    const isAuthenticated = useIsAuthenticated();
    const { instance, accounts } = useMsal();
    const [profilePhoto, setProfilePhoto] = useState(null);

    const fullName = accounts.length > 0 ? accounts[0].name || accounts[0].username : '';
    const userName = fullName.split('|')[0].trim();

    // Fetch profile photo from Microsoft Graph
    useEffect(() => {
        const fetchProfilePhoto = async () => {
            if (!isAuthenticated || accounts.length === 0) return;
            
            try {
                const response = await instance.acquireTokenSilent({
                    ...loginRequest,
                    account: accounts[0]
                });
                
                const photoResponse = await fetch('https://graph.microsoft.com/v1.0/me/photo/$value', {
                    headers: {
                        'Authorization': `Bearer ${response.accessToken}`
                    }
                });
                
                if (photoResponse.ok) {
                    const blob = await photoResponse.blob();
                    const photoUrl = URL.createObjectURL(blob);
                    setProfilePhoto(photoUrl);
                }
            } catch (error) {
                console.log('Could not fetch profile photo:', error);
            }
        };
        
        fetchProfilePhoto();
    }, [isAuthenticated, accounts, instance]);

    // Save user alias to database on login
    useEffect(() => {
        if (!isAuthenticated || accounts.length === 0) return;
        const userAlias = accounts[0].username;
        const name = (accounts[0].name || accounts[0].username).split('|')[0].trim();
        fetch('/api/user-alias', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userAlias: userAlias, userName: name })
        }).catch(err => console.log('Could not save user alias:', err));
    }, [isAuthenticated, accounts]);

    const handleLogin = () => {
        instance.loginRedirect(loginRequest);
    };

    const handleLogout = () => {
        const account = accounts[0];
        instance.logoutRedirect({
            account: account,
            postLogoutRedirectUri: window.location.origin,
            onRedirectNavigate: () => {
                // Return false to skip redirect to Microsoft logout page
                return false;
            }
        }).catch(() => {});
        
        // Clear all accounts and redirect immediately
        instance.clearCache();
        window.location.href = '/';
    };

    const handleCardClick = (path) => {
        if (isAuthenticated) {
            navigate(path);
        }
    };

    return (
        <Box sx={{ minHeight: '100vh', background: 'linear-gradient(135deg, #f0f4f8 0%, #d9e2ec 100%)', position: 'relative' }}>

            {/* Login Popup Dialog */}
            <Dialog 
                open={!isAuthenticated} 
                PaperProps={{
                    sx: {
                        borderRadius: 3,
                        p: 2,
                        minWidth: 360,
                        textAlign: 'center',
                    }
                }}
            >
                <DialogContent>
                    <img src={logo} alt="Code Analyzer" style={{ height: 60, objectFit: 'contain', marginBottom: 16 }} />
                    <Typography variant="h5" sx={{ fontWeight: 700, mb: 1 }}>
                        Welcome to Code Analyzer
                    </Typography>
                    <Typography variant="body2" sx={{ color: '#666', mb: 3 }}>
                        Please sign in with your MAQ Software account to continue
                    </Typography>
                    <Button 
                        variant="contained" 
                        fullWidth
                        onClick={handleLogin}
                        sx={{ 
                            borderRadius: 2, 
                            textTransform: 'none', 
                            background: '#0078d4',
                            py: 1.2,
                            fontSize: '1rem',
                            fontWeight: 600,
                            '&:hover': {
                                background: '#005a9e'
                            }
                        }}
                    >
                        Sign in with MAQ Software
                    </Button>
                </DialogContent>
            </Dialog>

            {/* User profile and logout */}
            {isAuthenticated && (
                <Box sx={{ 
                    position: 'absolute', 
                    top: 24, 
                    right: 40, 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: 1.5,
                    background: '#fff',
                    borderRadius: 3,
                    pl: 1.2,
                    pr: 3,
                    py: 1.2,
                    boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
                    border: '1px solid rgba(0,0,0,0.06)',
                    cursor: 'pointer',
                    transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                    '&:hover': {
                        boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
                        transform: 'translateY(-3px)',
                        borderColor: 'rgba(13,110,253,0.2)',
                        background: 'linear-gradient(135deg, #fff 0%, #f8fafc 100%)'
                    }
                }}>
                    <Avatar 
                        src={profilePhoto}
                        src={profilePhoto}
                        sx={{ 
                            width: 44, 
                            height: 44,
                            bgcolor: '#0d6efd',
                            fontSize: '1rem',
                            fontWeight: 600,
                            border: '2px solid #fff',
                            boxShadow: '0 2px 6px rgba(0,0,0,0.1)'
                        }}
                    >
                        {userName.charAt(0).toUpperCase()}
                    </Avatar>
                    <Box>
                        <Typography 
                            sx={{ 
                                color: '#1a1a1a', 
                                fontWeight: 600, 
                                fontSize: '0.95rem', 
                                lineHeight: 1.3,
                                letterSpacing: '-0.01em'
                            }}
                        >
                            {userName}
                        </Typography>
                        <Box 
                            onClick={handleLogout}
                            sx={{ 
                                display: 'flex',
                                alignItems: 'center',
                                gap: 0.5,
                                cursor: 'pointer',
                                color: '#666',
                                transition: 'all 0.2s ease',
                                mt: 0.2,
                                borderRadius: 1,
                                mx: -0.5,
                                px: 0.5,
                                '&:hover': {
                                    color: '#e53935',
                                    background: 'rgba(229,57,53,0.08)'
                                },
                                '&:hover .logout-icon': {
                                    transform: 'translateX(3px)'
                                }
                            }}
                        >
                            <LogoutIcon className="logout-icon" sx={{ 
                                fontSize: 14, 
                                transition: 'transform 0.2s ease' 
                            }} />
                            <Typography sx={{ 
                                fontSize: '0.8rem',
                                fontWeight: 500,
                                letterSpacing: '0.02em'
                            }}>
                                Sign out
                            </Typography>
                        </Box>
                    </Box>
                </Box>
            )}

            {/* Header */}
            <Box sx={{ textAlign: 'center', pt: 6, pb: 2 }}>
                <img src={logo} alt="Code Analyzer" style={{ height: 80, objectFit: 'contain' }} />
                <Typography variant="h4" sx={{ fontWeight: 700, mt: 2, fontFamily: 'Poppins, sans-serif' }}>
                    Code Analyzer
                </Typography>
                <Typography variant="body1" sx={{ color: '#666', mt: 1 }}>
                    Select a version to get started
                </Typography>
            </Box>

            {/* Version Cards */}
            <Box sx={{ display: 'flex', justifyContent: 'center', gap: 5, mt: 6, flexWrap: 'wrap', px: 3, alignItems: 'stretch' }}>
                {versions.map((v) => (
                    <Card
                        key={v.title}
                        sx={{
                            width: 360,
                            borderRadius: 4,
                            boxShadow: '0 8px 30px rgba(0,0,0,0.12)',
                            transition: 'transform 0.2s, box-shadow 0.2s',
                            display: 'flex',
                            flexDirection: 'column',
                            '&:hover': {
                                transform: 'translateY(-6px)',
                                boxShadow: '0 16px 40px rgba(0,0,0,0.18)',
                            },
                        }}
                    >
                        <CardActionArea onClick={() => handleCardClick(v.path)} sx={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'stretch', justifyContent: 'flex-start' }}>
                            {/* Colored top bar */}
                            <Box sx={{ height: 8, background: v.color }} />
                            <CardContent sx={{ p: 4 }}>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1 }}>
                                    <Typography variant="h5" sx={{ fontWeight: 700 }}>
                                        {v.title}
                                    </Typography>
                                    <Chip label={v.subtitle} size="small" sx={{ background: v.color, color: '#fff', fontWeight: 600 }} />
                                </Box>
                                <Typography variant="body2" sx={{ color: '#888', mb: 3 }}>
                                    {v.description}
                                </Typography>
                                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.2 }}>
                                    {v.features.map((f) => (
                                        <Box key={f} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                            <Box sx={{ width: 8, height: 8, borderRadius: '50%', background: v.color, flexShrink: 0 }} />
                                            <Typography variant="body2" sx={{ fontWeight: 500 }}>
                                                {f}
                                            </Typography>
                                        </Box>
                                    ))}
                                </Box>
                            </CardContent>
                        </CardActionArea>
                    </Card>
                ))}
            </Box>
        </Box>
    );
}

export default Home;

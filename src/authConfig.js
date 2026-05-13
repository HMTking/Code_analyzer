import { PublicClientApplication, LogLevel } from '@azure/msal-browser';

// Loaded from .env (REACT_APP_* are inlined by CRA at build time)
const CLIENT_ID = process.env.REACT_APP_AZURE_CLIENT_ID;
const TENANT_ID = process.env.REACT_APP_AZURE_TENANT_ID;
const REDIRECT_URI = process.env.REACT_APP_REDIRECT_URI || window.location.origin;

if (!CLIENT_ID || !TENANT_ID) {
    // eslint-disable-next-line no-console
    console.warn('[authConfig] REACT_APP_AZURE_CLIENT_ID or REACT_APP_AZURE_TENANT_ID is not set.');
}

// MSAL configuration
export const msalConfig = {
    auth: {
        clientId: CLIENT_ID,
        authority: `https://login.microsoftonline.com/${TENANT_ID}`,
        redirectUri: REDIRECT_URI,
        postLogoutRedirectUri: REDIRECT_URI,
        navigateToLoginRequestUrl: true,
    },
    cache: {
        cacheLocation: 'localStorage',
        storeAuthStateInCookie: false,
    },
    system: {
        loggerOptions: {
            loggerCallback: (level, message, containsPii) => {
                if (containsPii) return;
                switch (level) {
                    case LogLevel.Error:
                        console.error(message);
                        break;
                    case LogLevel.Warning:
                        console.warn(message);
                        break;
                    default:
                        break;
                }
            },
            logLevel: LogLevel.Warning,
        },
    },
};

// Login request scopes
export const loginRequest = {
    scopes: ['openid', 'profile', 'User.Read'],
};

// Create MSAL instance
export const msalInstance = new PublicClientApplication(msalConfig);

// Initialize MSAL
export async function initializeMsal() {
    await msalInstance.initialize();
    
    // Handle redirect response
    const response = await msalInstance.handleRedirectPromise();
    if (response) {
        msalInstance.setActiveAccount(response.account);
    } else {
        // Set active account if one exists
        const accounts = msalInstance.getAllAccounts();
        if (accounts.length > 0) {
            msalInstance.setActiveAccount(accounts[0]);
        }
    }
    return msalInstance;
}

// Check if user is logged in
export function isLoggedIn() {
    const accounts = msalInstance.getAllAccounts();
    return accounts.length > 0;
}

// Get current user account
export function getActiveAccount() {
    return msalInstance.getActiveAccount();
}

// Login function
export async function login() {
    try {
        await msalInstance.loginRedirect(loginRequest);
    } catch (error) {
        console.error('Login failed:', error);
        throw error;
    }
}

// Get access token silently for the current user
export async function getAccessToken() {
    const account = msalInstance.getActiveAccount();
    if (!account) throw new Error('No active account');
    const response = await msalInstance.acquireTokenSilent({
        ...loginRequest,
        account,
    });
    return response.idToken;
}

// Logout function
export async function logout() {
    const account = msalInstance.getActiveAccount();
    await msalInstance.logoutRedirect({
        account: account,
        postLogoutRedirectUri: REDIRECT_URI,
    });
}

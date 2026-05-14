# Prompt: Temporarily Disable Auth & Switch AI Model (Code Analyzer)

> [!IMPORTANT]
> Copy the entire prompt below (everything inside the fenced block) and paste it into the LLM.

---

````text
## Context

I have a React + Express project called "Code Analyzer" located at:
`c:\Users\PatelVinodbhaiMAQSof\Desktop\Code Analyzer - Antigravity`

The project currently uses:
1. **Azure AD (MSAL)** for frontend authentication and JWT verification on the backend.
2. **Azure OpenAI** (`openai` npm package with `AzureOpenAI` class) on the backend `/call-gpt` endpoint.

I do NOT have Azure AD credentials (Client ID / Tenant ID) available right now, so the app cannot start. I need you to **temporarily** disable auth and swap the AI model so I can develop new features locally.

---

## CRITICAL RULES

1. **Tag every change** with a comment so it can be found and reverted later:
   - Auth-related changes: tag with `// AUTH_BYPASS`
   - Model-related changes: tag with `// MODEL_SWAP`
2. **Do NOT delete any original code.** Comment it out and add the bypass/swap code next to it.
3. Keep all existing comments and docstrings intact.
4. Do NOT rename any files, functions, variables, or endpoints.
5. Do NOT change any import paths, CSS, or unrelated logic.
6. Do NOT install or uninstall any npm packages.

---

## CHANGE 1 — Frontend: Disable MSAL Authentication

### File: `src/index.js`

**Current behavior:** Wraps `<App />` inside `<MsalProvider>` and calls `initializeMsal()` before rendering.

**Required change:**
- Comment out the `MsalProvider` import and `msalInstance`/`initializeMsal` imports.
- Comment out the `initializeMsal().then(...)` wrapper.
- Render `<App />` directly inside `<React.StrictMode>` without `<MsalProvider>`.
- Tag every commented line with `// AUTH_BYPASS`.

**Result should look like:**
```jsx
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

reportWebVitals();
```

---

### File: `src/Components/ProtectedRoute.js`

**Current behavior:** Uses `useIsAuthenticated()` and `useMsal()` hooks. Redirects to `/` if not authenticated.

**Required change:**
- Comment out all MSAL imports and hook usage.
- Make the component always render `children` (pass-through).
- Tag with `// AUTH_BYPASS`.

**Result should look like:**
```jsx
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
```

---

### File: `src/Components/Home.js`

**Current behavior:** Shows a login dialog when `!isAuthenticated`. Uses `useMsal()` for login/logout, profile photo fetching, and user alias saving.

**Required change:**
- Comment out `useIsAuthenticated` and `useMsal` imports and their hook calls.
- Comment out `loginRequest` import.
- Create hardcoded mock values:
  ```js
  const isAuthenticated = true;                               // AUTH_BYPASS
  const accounts = [{ name: 'Dev User', username: 'dev@local' }]; // AUTH_BYPASS
  const instance = { loginRedirect: () => {}, logoutRedirect: () => Promise.resolve(), clearCache: () => {} }; // AUTH_BYPASS
  ```
- Comment out the `useEffect` that fetches profile photo (lines 46-73) and the `useEffect` that saves user alias (lines 76-85). Tag each with `// AUTH_BYPASS`.
- Comment out `handleLogin` and `handleLogout` functions, replace with no-ops. Tag with `// AUTH_BYPASS`.
- The login `<Dialog open={!isAuthenticated}>` will never open because `isAuthenticated` is always `true`.
- Everything else stays the same.

---

### File: `src/Components/IdleLogout.js`

**Current behavior:** Uses `useIsAuthenticated()` to conditionally start idle timers.

**Required change:**
- Comment out the `useIsAuthenticated` import.
- Comment out `import { logout } from '../authConfig'`.
- Replace `const isAuthenticated = useIsAuthenticated();` with `const isAuthenticated = true; // AUTH_BYPASS`.
- Comment out the `await logout()` call inside `triggerLogout` and replace with `console.log('[IdleLogout] AUTH_BYPASS: logout skipped'); // AUTH_BYPASS`.

---

### File: `src/Components/FabricEnhanced.js`

**Current behavior:** Imports `getActiveAccount` and `getAccessToken` from `authConfig`. Uses them in `canSaveToRepo` and `saveToRepoExplorer` (around lines 1212-1248).

**Required change:**
- Comment out `import { getActiveAccount, getAccessToken } from '../authConfig';` → tag `// AUTH_BYPASS`.
- Replace `canSaveToRepo` computation (lines 1212-1216) with:
  ```js
  const canSaveToRepo = true; // AUTH_BYPASS — always allow in dev mode
  ```
- In `saveToRepoExplorer` (line 1230), comment out `const token = await getAccessToken();` and the `headers: { Authorization: ... }` in the axios call. Replace with a simple `await axios.post(...)` without auth header. Tag with `// AUTH_BYPASS`.

---

### File: `src/authConfig.js`

**No changes needed.** This file can remain as-is. The bypasses above prevent it from being used.

---

## CHANGE 2 — Backend: Switch from Azure OpenAI to OpenAI API

### File: `Backend/.env.example`

Add these new env vars (keep existing ones, just add below):
```
# MODEL_SWAP — OpenAI API key (temporary, for local dev)
OPENAI_API_KEY=
OPENAI_MODEL=gpt-4o
```

### File: `Backend/.env` (create if not exists, or update)

Set the actual values:
```
PORT=3001
OPENAI_API_KEY=sk-proj-YOUR_API_KEY_HERE
OPENAI_MODEL=gpt-4o
```

### File: `Backend/index.js`

#### 2a. Update CONFIG block (around lines 14-32)

Comment out the `azureOpenAi` config, add OpenAI config:
```js
const CONFIG = {
    port: process.env.PORT || 3001,
    tenantId: process.env.TENANT_ID,
    clientId: process.env.CLIENT_ID,
    allowedSaveEmails: (process.env.ALLOWED_SAVE_EMAILS || '')
        .split(',')
        .map(e => e.trim().toLowerCase())
        .filter(Boolean),
    // MODEL_SWAP — original Azure OpenAI config:
    // azureOpenAi: {
    //     endpoint: process.env.AZURE_OPENAI_ENDPOINT,
    //     model: process.env.AZURE_OPENAI_MODEL,
    //     apiVersion: process.env.AZURE_OPENAI_API_VERSION || '2024-12-01-preview',
    // },
    openAi: {                                           // MODEL_SWAP
        apiKey: process.env.OPENAI_API_KEY,             // MODEL_SWAP
        model: process.env.OPENAI_MODEL || 'gpt-4o',   // MODEL_SWAP
    },                                                  // MODEL_SWAP
    sql: {
        server: process.env.SQL_SERVER,
        database: process.env.SQL_DATABASE,
    },
};
```

#### 2b. Update the startup env-validation loop (around lines 36-45)

Comment out the `AZURE_OPENAI_ENDPOINT` and `AZURE_OPENAI_MODEL` checks and add `OPENAI_API_KEY` check instead. Tag with `// MODEL_SWAP`.

#### 2c. Replace `getGPTData` function (around lines 305-316)

Comment out the existing function entirely. Add a new one that uses the **standard OpenAI SDK** (the `openai` package is already installed, version ^6.27.0):

```js
// MODEL_SWAP — original getGPTData using AzureOpenAI:
// async function getGPTData(message, endpoint, model, apiKey) {
//     const client = new AzureOpenAI({
//         endpoint,
//         apiKey,
//         deployment: model,
//         apiVersion: CONFIG.azureOpenAi.apiVersion,
//     });
//     return client.chat.completions.create({
//         model,
//         messages: message,
//     });
// }

// MODEL_SWAP — new getGPTData using standard OpenAI API
const { OpenAI } = require('openai'); // MODEL_SWAP
async function getGPTData(message, _endpoint, _model, _key) {
    // When called from /call-gpt, _key is the per-request key from the frontend.
    // Fall back to the server-wide OPENAI_API_KEY from .env.
    const effectiveKey = _key || CONFIG.openAi.apiKey;
    const effectiveModel = _model || CONFIG.openAi.model;
    const client = new OpenAI({ apiKey: effectiveKey }); // MODEL_SWAP
    return client.chat.completions.create({
        model: effectiveModel,
        messages: message,
    });
}
```

#### 2d. Update `/call-gpt` route (around lines 318-342)

The route currently destructures `{ content, endpoint, model, key }` from `req.body` and validates all three. Since users may or may not fill in the UI fields, change the validation to only require the key (or fall back to server env):

```js
app.post('/call-gpt', async (req, res) => {
    const { content, endpoint, model, key } = req.body;

    // MODEL_SWAP — original validation required endpoint+model+key from Azure
    // if (!endpoint || !model || !key) {
    //     return res.status(400).send({
    //         error: 'Deployment Endpoint, Model Name, and API Key are required.',
    //     });
    // }

    // MODEL_SWAP — relaxed: use server-side key/model as fallback
    const effectiveKey = key || CONFIG.openAi.apiKey;
    if (!effectiveKey) {
        return res.status(400).send({
            error: 'API Key is required. Set OPENAI_API_KEY in Backend/.env or provide it in the UI.',
        });
    }

    const message = [
        { role: "system", content: "You are a coding assistant. You need to parse the code and just give the exact answer; don't include any additional explanation." },
        { role: "user", content: content || "" },
    ];

    try {
        const result = await getGPTData(message, endpoint, model, effectiveKey);
        if (!result) {
            return res.status(502).send({ error: "Empty response from model." });
        }
        res.status(200).send(result);
    } catch (error) {
        console.error('[/call-gpt] failure:', error && error.message ? error.message : error);
        res.status(500).send({ error: "An error occurred while processing your request." });
    }
});
```

#### 2e. Backend auth: Disable JWT verification on `/save-to-repo` (around lines 515-533)

Comment out the token verification block and replace with a pass-through. Tag with `// AUTH_BYPASS`:

```js
app.post('/save-to-repo', async (req, res) => {
    try {
        // AUTH_BYPASS — original token verification:
        // const authHeader = req.headers.authorization;
        // if (!authHeader || !authHeader.startsWith('Bearer ')) {
        //     return res.status(401).json({ error: 'Missing or invalid authorization token.' });
        // }
        // const token = authHeader.split(' ')[1];
        // let decoded;
        // try {
        //     decoded = await verifyToken(token);
        // } catch (tokenErr) {
        //     console.error('Token verification failed:', tokenErr.message);
        //     return res.status(401).json({ error: 'Invalid or expired token.' });
        // }
        // const userEmail = (decoded.preferred_username || decoded.email || '').toLowerCase();
        // if (!userEmail || !ALLOWED_SAVE_EMAILS.includes(userEmail)) {
        //     return res.status(403).json({ error: 'You are not authorized to save to POSOT Data Explorer.' });
        // }

        console.log('[save-to-repo] AUTH_BYPASS: skipping token verification'); // AUTH_BYPASS

        const { repoName, pipelines, bronzeDetails, silverDetails, goldDetails, stagingtables } = req.body;
        // ... rest of the function remains EXACTLY the same ...
```

**Do NOT modify anything after line 535 in this function — the database logic stays identical.**

#### 2f. SQL connection: Disable Azure credential for SQL (around lines 350-398)

The `getSqlPool()` function uses `DefaultAzureCredential` for SQL auth, which will fail without Azure. Comment out the entire function body and replace with a console warning that SQL features are unavailable:

```js
async function getSqlPool() {
    // AUTH_BYPASS — original Azure AD SQL pool:
    // const now = Date.now();
    // ... (comment out entire original body) ...

    // AUTH_BYPASS — SQL disabled in dev mode
    console.warn('[getSqlPool] AUTH_BYPASS: SQL Server connection disabled in dev mode. Database features will not work.');
    throw new Error('SQL Server connection is disabled in dev mode (AUTH_BYPASS). Set up local SQL or restore Azure credentials.');
}
```

This way, routes that use SQL (`/getrepo-json`, `/get-json`, `/save-to-repo`, `/api/user-alias`) will return 500 errors with a clear message, instead of crashing the server at startup.

---

## CHANGE 3 — Disable startup crash for missing Azure imports

### File: `Backend/index.js` (lines 2-4)

Comment out the Azure Identity import since it won't be used:
```js
// AUTH_BYPASS — const { DefaultAzureCredential, getBearerTokenProvider } = require('@azure/identity');
// const { OpenAIClient } = require('@azure/openai');
// MODEL_SWAP — const { AzureOpenAI } = require('openai');
```

---

## Summary of Files Changed

| File | Change Type | Tag |
|------|-----------|-----|
| `src/index.js` | Remove MsalProvider wrapper | `AUTH_BYPASS` |
| `src/Components/ProtectedRoute.js` | Always render children | `AUTH_BYPASS` |
| `src/Components/Home.js` | Mock auth state, skip login dialog | `AUTH_BYPASS` |
| `src/Components/IdleLogout.js` | Skip real auth check | `AUTH_BYPASS` |
| `src/Components/FabricEnhanced.js` | Skip token for save-to-repo | `AUTH_BYPASS` |
| `Backend/.env` | Add OPENAI_API_KEY, OPENAI_MODEL | `MODEL_SWAP` |
| `Backend/.env.example` | Add OPENAI env template | `MODEL_SWAP` |
| `Backend/index.js` | Switch to OpenAI SDK, disable JWT & SQL auth | `AUTH_BYPASS` + `MODEL_SWAP` |

---

## HOW TO REVERT

When you have Azure credentials again, search the entire project for:
```
AUTH_BYPASS
MODEL_SWAP
```

Uncomment every original line and remove the temporary bypass code.

---

## Verification Checklist

After making all changes, confirm:
- [ ] `npm run client` starts without MSAL errors
- [ ] Home page loads without login dialog (auto-authenticated)
- [ ] All routes (`/v1`, `/v2`, etc.) are accessible without redirect
- [ ] `npm run server` starts without Azure credential errors
- [ ] The `/call-gpt` endpoint works with the provided OpenAI API key (test with a simple POST request)
- [ ] No original code has been deleted — only commented out
- [ ] All bypass/swap lines are tagged with `// AUTH_BYPASS` or `// MODEL_SWAP`
````

---


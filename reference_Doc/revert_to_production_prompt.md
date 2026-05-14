# Prompt: Revert Dev Mode → Restore Production Auth & Azure OpenAI

> [!IMPORTANT]
> Copy the entire prompt below (everything inside the fenced block) and paste it into the LLM.
> This prompt assumes that during dev mode, a **Column-to-Column Lineage Mapping** feature was added. All those feature changes must be PRESERVED while reverting auth and AI model.

---

````text
## Context

I have a React + Express project called "Code Analyzer" located at:
`c:\Users\PatelVinodbhaiMAQSof\Desktop\Code Analyzer - Antigravity`

The project was temporarily modified for local development:
1. **Azure AD (MSAL) authentication was disabled** — tagged with `// AUTH_BYPASS` comments
2. **Azure OpenAI was replaced with standard OpenAI API** — tagged with `// MODEL_SWAP` comments

During dev mode, a **new feature was added: Column-to-Column Lineage Mapping**. This feature added:
- **New files:** `src/Components/ColumnLineageView.js` and `src/Components/ColumnLineageView.css`
- **Modified files:** `src/Components/FabricEnhanced.js` (new state `columnLineage`, GPT prompt changes, localStorage changes) and `src/Components/OutputViewFabricEnhanced.js` (view mode dropdown, conditional rendering)

**Goal:** Restore all production configurations (Azure AD auth + Azure OpenAI + SQL Server auth) while keeping the column lineage feature fully intact.

---

## CRITICAL RULES

1. **Search for every `AUTH_BYPASS` and `MODEL_SWAP` comment** in the codebase and revert each one.
2. **PRESERVE all column lineage feature code** — the `columnLineage` state, GPT prompt additions, `ColumnLineageView` component, view mode dropdown, etc. must NOT be removed.
3. **Uncomment all original code** that was commented out during dev mode.
4. **Remove all temporary bypass/swap code** that was added during dev mode.
5. **Remove the `// AUTH_BYPASS` and `// MODEL_SWAP` comment tags** after reverting.
6. Do NOT rename any files, functions, variables, or endpoints.
7. Do NOT delete `ColumnLineageView.js` or `ColumnLineageView.css` — these are new permanent features.

---

## HOW TO FIND ALL CHANGES

Run this search across the entire project to find every dev-mode change:

```bash
grep -rn "AUTH_BYPASS\|MODEL_SWAP" --include="*.js" --include="*.jsx" --include="*.env*" .
```

Or in PowerShell:
```powershell
Select-String -Path ".\**\*.js",".\**\*.env*" -Pattern "AUTH_BYPASS|MODEL_SWAP" -Recurse | Select-Object Filename, LineNumber, Line
```

---

## REVERT 1 — Frontend: Restore MSAL Authentication

### File: `src/index.js`

**What to do:** Uncomment the original MSAL code, remove the bypass.

**Restore to:**
```jsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';
import { MsalProvider } from '@azure/msal-react';
import { msalInstance, initializeMsal } from './authConfig';

// Initialize MSAL before rendering
initializeMsal().then(() => {
    const root = ReactDOM.createRoot(document.getElementById('root'));
    root.render(
        <React.StrictMode>
            <MsalProvider instance={msalInstance}>
                <App />
            </MsalProvider>
        </React.StrictMode>
    );
});

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
reportWebVitals();
```

---

### File: `src/Components/ProtectedRoute.js`

**What to do:** Uncomment all MSAL imports and auth checks, remove the pass-through bypass.

**Restore to:**
```jsx
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
```

---

### File: `src/Components/Home.js`

**What to do:**
- Uncomment the real `useIsAuthenticated`, `useMsal`, and `loginRequest` imports.
- Remove the hardcoded mock values (`const isAuthenticated = true;`, mock `accounts`, mock `instance`).
- Uncomment the real hook calls: `const isAuthenticated = useIsAuthenticated();` and `const { instance, accounts } = useMsal();`
- Uncomment the `useEffect` for profile photo fetching.
- Uncomment the `useEffect` for user alias saving.
- Uncomment the real `handleLogin` and `handleLogout` functions.

**Key lines to restore:**
```jsx
import { useIsAuthenticated, useMsal } from '@azure/msal-react';
import { loginRequest } from '../authConfig';

// Inside the function:
const isAuthenticated = useIsAuthenticated();
const { instance, accounts } = useMsal();
```

Remove ALL lines containing `// AUTH_BYPASS`.

---

### File: `src/Components/IdleLogout.js`

**What to do:**
- Uncomment `import { useIsAuthenticated } from '@azure/msal-react';`
- Uncomment `import { logout } from '../authConfig';`
- Replace `const isAuthenticated = true; // AUTH_BYPASS` with `const isAuthenticated = useIsAuthenticated();`
- Uncomment `await logout();` inside `triggerLogout`.
- Remove the `console.log('[IdleLogout] AUTH_BYPASS: logout skipped')` line.

---

### File: `src/Components/FabricEnhanced.js`

**What to do:**
- Uncomment `import { getActiveAccount, getAccessToken } from '../authConfig';`
- Restore `canSaveToRepo` to its original computation:
  ```js
  const canSaveToRepo = (() => {
      const account = getActiveAccount();
      const candidates = getAccountEmailCandidates(account);
      return candidates.some(email => ALLOWED_SAVE_EMAILS.includes(email));
  })();
  ```
- Restore `saveToRepoExplorer` to use `getAccessToken()` and include the Authorization header:
  ```js
  const token = await getAccessToken();
  await axios.post(`${backend_url}/save-to-repo`, {
      repoName: repoName.trim(),
      pipelines,
      bronzeDetails,
      silverDetails,
      goldDetails,
      stagingtables
  }, {
      headers: { Authorization: `Bearer ${token}` }
  });
  ```

**IMPORTANT — PRESERVE these column lineage changes (NOT tagged with AUTH_BYPASS):**
- The `const [columnLineage, setColumnLineage] = useState([]);` state
- The GPT prompt modifications adding `columnLineage` to Silver/Gold schemas + instruction text
- The `setColumnLineage(...)` calls in Silver (flag 3) and Gold (flag 4) response handlers
- The `columnLineage` field in `outputData` object for localStorage
- The `if (data.columnLineage) setColumnLineage(data.columnLineage);` restoration line
- The `columnLineage` in the useEffect dependency array

---

### File: `src/authConfig.js`

**No changes needed.** This file was never modified during dev mode.

---

## REVERT 2 — Backend: Restore Azure OpenAI

### File: `Backend/.env`

**What to do:** Remove `OPENAI_API_KEY` and `OPENAI_MODEL`. Restore the original Azure OpenAI env vars:

```env
PORT=3001

TENANT_ID=<your_tenant_id>
CLIENT_ID=<your_client_id>

ALLOWED_SAVE_EMAILS=

AZURE_OPENAI_ENDPOINT=<your_azure_openai_endpoint>
AZURE_OPENAI_MODEL=<your_model_name>
AZURE_OPENAI_API_VERSION=2024-12-01-preview

SQL_SERVER=<your_sql_server>
SQL_DATABASE=<your_sql_database>
```

### File: `Backend/.env.example`

**What to do:** Remove `OPENAI_API_KEY` and `OPENAI_MODEL` lines. Restore to:

```env
PORT=3001

TENANT_ID=
CLIENT_ID=

ALLOWED_SAVE_EMAILS=

AZURE_OPENAI_ENDPOINT=
AZURE_OPENAI_MODEL=
AZURE_OPENAI_API_VERSION=2024-12-01-preview

SQL_SERVER=
SQL_DATABASE=
```

---

### File: `Backend/index.js`

#### 2a. Restore imports (lines 2-4)

Uncomment the Azure Identity import and AzureOpenAI import:
```js
const { DefaultAzureCredential, getBearerTokenProvider } = require('@azure/identity');
// const { OpenAIClient } = require('@azure/openai');
const { AzureOpenAI } = require('openai');
```

Remove any `const { OpenAI } = require('openai'); // MODEL_SWAP` line.

#### 2b. Restore CONFIG block

Uncomment the `azureOpenAi` config, remove the `openAi` config:
```js
const CONFIG = {
    port: process.env.PORT || 3001,
    tenantId: process.env.TENANT_ID,
    clientId: process.env.CLIENT_ID,
    allowedSaveEmails: (process.env.ALLOWED_SAVE_EMAILS || '')
        .split(',')
        .map(e => e.trim().toLowerCase())
        .filter(Boolean),
    azureOpenAi: {
        endpoint: process.env.AZURE_OPENAI_ENDPOINT,
        model: process.env.AZURE_OPENAI_MODEL,
        apiVersion: process.env.AZURE_OPENAI_API_VERSION || '2024-12-01-preview',
    },
    sql: {
        server: process.env.SQL_SERVER,
        database: process.env.SQL_DATABASE,
    },
};
```

#### 2c. Restore env validation

Uncomment `AZURE_OPENAI_ENDPOINT` and `AZURE_OPENAI_MODEL` checks, remove `OPENAI_API_KEY` check:
```js
for (const [k, v] of Object.entries({
    TENANT_ID: CONFIG.tenantId,
    CLIENT_ID: CONFIG.clientId,
    AZURE_OPENAI_ENDPOINT: CONFIG.azureOpenAi.endpoint,
    AZURE_OPENAI_MODEL: CONFIG.azureOpenAi.model,
    SQL_SERVER: CONFIG.sql.server,
    SQL_DATABASE: CONFIG.sql.database,
})) {
    if (!v) console.warn(`[config] WARNING: ${k} is not set in environment.`);
}
```

#### 2d. Restore `getGPTData` function

Remove the standard OpenAI version, uncomment the Azure OpenAI version:
```js
async function getGPTData(message, endpoint, model, apiKey) {
    const client = new AzureOpenAI({
        endpoint,
        apiKey,
        deployment: model,
        apiVersion: CONFIG.azureOpenAi.apiVersion,
    });
    return client.chat.completions.create({
        model,
        messages: message,
    });
}
```

#### 2e. Restore `/call-gpt` route

Restore the original validation that requires endpoint + model + key from the frontend:
```js
app.post('/call-gpt', async (req, res) => {
    const { content, endpoint, model, key } = req.body;

    if (!endpoint || !model || !key) {
        return res.status(400).send({
            error: 'Deployment Endpoint, Model Name, and API Key are required.',
        });
    }

    const message = [
        { role: "system", content: "You are a coding assistant. You need to parse the code and just give the exact answer; don't include any additional explanation." },
        { role: "user", content: content || "" },
    ];

    try {
        const result = await getGPTData(message, endpoint, model, key);
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

#### 2f. Restore `/save-to-repo` JWT verification

Uncomment the entire token verification block at the top of the route handler:
```js
app.post('/save-to-repo', async (req, res) => {
    try {
        // Verify Azure AD token from Authorization header
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'Missing or invalid authorization token.' });
        }
        const token = authHeader.split(' ')[1];
        let decoded;
        try {
            decoded = await verifyToken(token);
        } catch (tokenErr) {
            console.error('Token verification failed:', tokenErr.message);
            return res.status(401).json({ error: 'Invalid or expired token.' });
        }
        const userEmail = (decoded.preferred_username || decoded.email || '').toLowerCase();
        if (!userEmail || !ALLOWED_SAVE_EMAILS.includes(userEmail)) {
            return res.status(403).json({ error: 'You are not authorized to save to POSOT Data Explorer.' });
        }

        const { repoName, pipelines, bronzeDetails, silverDetails, goldDetails, stagingtables } = req.body;
        // ... rest stays the same ...
```

Remove the `console.log('[save-to-repo] AUTH_BYPASS: ...')` line.

#### 2g. Restore `getSqlPool` function

Uncomment the entire original Azure AD SQL pool function:
```js
async function getSqlPool() {
    const now = Date.now();
    // Reuse the existing pool if the token is still valid (with 5-min buffer)
    if (cachedPool && cachedPool.connected && now < tokenExpiresOn - 5 * 60 * 1000) {
        return cachedPool;
    }

    // Close stale pool before reconnecting
    try { await sql.close(); } catch (_) {}
    cachedPool = null;

    const credential = new DefaultAzureCredential();
    const accessToken = await credential.getToken("https://database.windows.net/");
    tokenExpiresOn = accessToken.expiresOnTimestamp;

    const config = {
        server: CONFIG.sql.server,
        database: CONFIG.sql.database,
        options: {
            encrypt: true,
            enableArithAbort: true
        },
        authentication: {
            type: 'azure-active-directory-access-token',
            options: {
                token: accessToken.token
            }
        },
        pool: {
            max: 10,
            min: 1,
            idleTimeoutMillis: 300000
        }
    };

    cachedPool = await sql.connect(config);

    cachedPool.on('error', (err) => {
        console.error('[mssql pool error]', err && err.message ? err.message : err);
        cachedPool = null;
        tokenExpiresOn = 0;
    });

    return cachedPool;
}
```

Remove the `console.warn('[getSqlPool] AUTH_BYPASS: ...')` line and the `throw new Error('SQL Server connection is disabled...')` line.

---

## WHAT MUST REMAIN AFTER REVERT (Column Lineage Feature)

These items were added as a NEW FEATURE during dev mode and must NOT be removed during revert:

### New Files (KEEP)
- `src/Components/ColumnLineageView.js` — Column mapping visualization component
- `src/Components/ColumnLineageView.css` — Styles for column lineage view

### FabricEnhanced.js Changes (KEEP)
- `const [columnLineage, setColumnLineage] = useState([]);` — New state variable
- GPT prompt additions: `columnLineage` array in Silver (flag 3) and Gold (flag 4) JSON schemas + instruction text about populating columnLineage
- `setColumnLineage(...)` calls after Silver and Gold `setStagingTables` blocks — these parse columnLineage from GPT response and tag with `targetLayer: 'Silver'` or `targetLayer: 'Gold'`
- `columnLineage` added to `outputData` object for localStorage persistence
- `if (data.columnLineage) setColumnLineage(data.columnLineage);` in localStorage restore useEffect
- `columnLineage` in the save-to-localStorage useEffect dependency array

### OutputViewFabricEnhanced.js Changes (KEEP)
- `import ColumnLineageView from './ColumnLineageView';`
- `const [viewMode, setViewMode] = useState('table');` — View mode state
- `columnLineage` field added to `getStoredData` return object and fallback return
- View mode dropdown (`<Form.Select>` with "Table Lineage" / "Column Mapping" options)
- `{viewMode === 'table' && (...)}` wrapping "View Lineage" and "Filter Lineage" buttons
- Conditional rendering: `viewMode === 'table'` shows existing ReactFlow, `viewMode === 'column'` shows `<ColumnLineageView>`

---

## Summary of Revert Changes

| File | Action | Tags Removed |
|------|--------|-------------|
| `src/index.js` | Restore MsalProvider wrapper | `AUTH_BYPASS` |
| `src/Components/ProtectedRoute.js` | Restore auth guards | `AUTH_BYPASS` |
| `src/Components/Home.js` | Restore real MSAL hooks, remove mocks | `AUTH_BYPASS` |
| `src/Components/IdleLogout.js` | Restore real auth check + logout | `AUTH_BYPASS` |
| `src/Components/FabricEnhanced.js` | Restore getAccessToken for save-to-repo | `AUTH_BYPASS` |
| `Backend/.env` | Restore Azure OpenAI vars, remove OPENAI vars | `MODEL_SWAP` |
| `Backend/.env.example` | Restore Azure OpenAI template | `MODEL_SWAP` |
| `Backend/index.js` | Restore Azure imports, CONFIG, getGPTData, /call-gpt, JWT, SQL pool | `AUTH_BYPASS` + `MODEL_SWAP` |

### Files NOT touched during revert (new feature — KEEP AS-IS)
| File | Status |
|------|--------|
| `src/Components/ColumnLineageView.js` | NEW feature — keep |
| `src/Components/ColumnLineageView.css` | NEW feature — keep |

---

## Verification Checklist

After making all changes, confirm:
- [ ] No `AUTH_BYPASS` or `MODEL_SWAP` comments remain anywhere in the codebase
- [ ] `npm run client` starts and shows the MSAL login dialog
- [ ] After Azure AD login, all routes (`/v1`, `/v2`, etc.) are accessible
- [ ] ProtectedRoute redirects to `/` when not authenticated
- [ ] IdleLogout works (logs out after 30 min inactivity)
- [ ] Home page shows real user profile photo and name
- [ ] `npm run server` starts and connects to SQL Server via Azure AD
- [ ] `/call-gpt` endpoint works with Azure OpenAI (requires Deployment Endpoint, Model Name, API Key from UI)
- [ ] `/save-to-repo` requires valid Bearer token and checks allowed emails
- [ ] `/getrepo-json` and `/get-json` endpoints query SQL Server successfully
- [ ] Column Lineage feature works: "Column Mapping" dropdown on lineage page shows two-panel view
- [ ] GPT prompts still include `columnLineage` field in Silver/Gold schemas
- [ ] `columnLineage` data persists in localStorage and restores on page refresh
````

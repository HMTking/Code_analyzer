# Code Analyzer

AI-powered data pipeline analysis tool that traces data lineage across **Bronze → Silver → Gold** layers in Databricks and Microsoft Fabric environments.

Upload your notebook or pipeline code, and the tool uses an LLM to extract tables, columns, transformations, and column-level lineage — then visualizes everything as interactive graphs.

---

## Features

### Data Analysis (Fabric Enhanced)
- Upload Fabric notebook/pipeline code
- AI extracts structured metadata: tables, columns, transformations, and logic per layer
- Interactive **ReactFlow** graph showing Bronze → Silver → Gold data flow
- **Column-level lineage** — click-to-select mapping between source and target columns with auto-scroll and highlight
- Export results as Excel, PNG, or JSON

### Data Analysis (Classic)
- Databricks notebook analysis
- Fabric pipeline analysis
- Custom prompt support for targeted extraction

### Pipeline Migrator
- Transform pipeline definitions between systems
- Mapping file support for field translation

### Notebook Migrator
- Break Databricks notebooks into individual cells
- Prepare notebooks for cross-platform migration

### Repo Explorer (POSOT)
- Browse and search previously analyzed data repos
- Filter by lineage, tables, and columns
- Graphical and tabular views

---

## Tech Stack

| Layer     | Technology                                       |
|-----------|--------------------------------------------------|
| Frontend  | React 18, Material-UI, React Bootstrap, ReactFlow |
| Backend   | Express.js, OpenAI SDK                           |
| AI Model  | GPT-4o / Gemini 2.5 Flash (configurable)         |
| Database  | SQL Server (optional, for repo save)             |
| Auth      | Azure AD via MSAL (optional)                     |

---

## Project Structure

```
├── Backend/
│   ├── index.js            # Express server, /call-gpt endpoint
│   ├── .env.example        # Backend env template
│   └── package.json
├── src/
│   ├── Components/
│   │   ├── FabricEnhanced.js           # Main analyzer (Enhanced)
│   │   ├── OutputViewFabricEnhanced.js # ReactFlow graph output
│   │   ├── ColumnLineageView.js        # Column-to-column mapping view
│   │   ├── Analyze.js                  # Classic Databricks analyzer
│   │   ├── NotebookMigrator.js         # Notebook migration tool
│   │   ├── RepoExplorer.js             # Repo browser
│   │   ├── FabricPipeline.js           # Pipeline migrator
│   │   └── Home.js                     # Landing page
│   ├── authConfig.js       # Azure AD config
│   └── App.js              # Router setup
├── .env.example            # Frontend env template
└── package.json
```

---

## Getting Started

### Prerequisites

- **Node.js** v18+
- **npm** v9+
- An API key for one of: OpenAI, Google Gemini, or OpenRouter

### 1. Clone the repo

```bash
git clone https://github.com/HMTking/Code_analyzer.git
cd Code_analyzer
```

### 2. Install Dependencies

```bash
# Install frontend dependencies (from project root)
npm install

# Install backend dependencies
cd Backend
npm install
cd ..
```

### 3. Configure Environment

```bash
# Create frontend env file
cp .env.example .env

# Create backend env file
cp Backend/.env.example Backend/.env
```

Edit `.env` and set your backend URL:

```dotenv
REACT_APP_API_BASE_URL=http://localhost:3001
```

Edit `Backend/.env` and configure your AI provider. Example for **Gemini**:

```dotenv
PORT=3001
OPENAI_API_KEY=your-gemini-api-key
OPENAI_MODEL=gemini-2.5-flash
OPENAI_BASE_URL=https://generativelanguage.googleapis.com/v1beta/openai/
```

Or for **OpenAI** directly:

```dotenv
PORT=3001
OPENAI_API_KEY=sk-your-openai-key
OPENAI_MODEL=gpt-4o
OPENAI_BASE_URL=
```

### 4. Run the app

From the project root, start both frontend and backend with a single command:

```bash
npm start
```

This uses `concurrently` to launch both the backend (`node Backend/index.js` on port 3001) and the React frontend (on port 5173) simultaneously.

The app opens at **http://localhost:5173** and the backend runs on **http://localhost:3001**.

---

## Environment Variables

### Frontend (`.env`)

| Variable | Description | Required |
|----------|-------------|----------|
| `REACT_APP_API_BASE_URL` | Backend server URL | Yes |
| `REACT_APP_AZURE_CLIENT_ID` | Azure AD app client ID | No (auth) |
| `REACT_APP_AZURE_TENANT_ID` | Azure AD tenant ID | No (auth) |
| `REACT_APP_REDIRECT_URI` | Auth redirect URI | No (auth) |
| `REACT_APP_FABRIC_WORKSPACE_ID` | Fabric workspace ID | No |

### Backend (`Backend/.env`)

| Variable | Description | Required |
|----------|-------------|----------|
| `PORT` | Server port (default: 3001) | No |
| `OPENAI_API_KEY` | API key for your AI provider | Yes |
| `OPENAI_MODEL` | Model name (e.g. `gpt-4o`, `gemini-2.5-flash`) | Yes |
| `OPENAI_BASE_URL` | Custom base URL (leave empty for OpenAI) | No |
| `TENANT_ID` | Azure AD tenant (for auth) | No |
| `CLIENT_ID` | Azure AD client (for auth) | No |
| `SQL_SERVER` | SQL Server host (for repo save) | No |
| `SQL_DATABASE` | SQL database name | No |

---

## Usage

1. Open the app and select **Version 2 → Data Analysis: Fabric Enhanced**
2. Upload your notebook or paste code into the input area
3. Click **Analyze** — the AI processes each layer (Bronze, Silver, Gold)
4. View results as:
   - **Table View** — structured table of extracted metadata
   - **Column Lineage** — interactive source → target column mapping with click-to-highlight
5. Export via the toolbar (Excel / PNG / JSON)

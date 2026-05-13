require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const { DefaultAzureCredential,getBearerTokenProvider } = require('@azure/identity');
// const { OpenAIClient  } = require('@azure/openai');
const { AzureOpenAI } = require('openai');
const express = require('express');
const fs = require('fs');
const app = express();
const cors = require('cors');
const path = require('path');
const sql = require('mssql');
const jwt = require('jsonwebtoken');
const jwksClient = require('jwks-rsa');

// --- Centralised env-derived configuration ---
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

// Fail fast if any critical secret is missing — surfaces config issues at boot
// instead of at first request (which manifests as a 500 / proxy error).
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

app.use(express.json({ limit: '40mb' }));
app.use(cors());

app.use(express.static(path.join(__dirname, 'build')));

// Prevent the process from exiting on background async errors emitted by
// SDKs (e.g. Azure Identity token refresh, OpenAI streaming sockets).
// Without these, an unhandled rejection in Node >=15 terminates the server
// mid-request, which surfaces as ECONNRESET followed by ECONNREFUSED in the
// dev-server proxy.
process.on('unhandledRejection', (reason) => {
    console.error('[unhandledRejection]', reason && reason.stack ? reason.stack : reason);
});
process.on('uncaughtException', (err) => {
    console.error('[uncaughtException]', err && err.stack ? err.stack : err);
});


app.post('/update-json/:flag', (req, res) => {
    const newData = req.body;
    const flag = req.params.flag

    if (flag == 1) {
        fs.writeFile('Mounts.json', JSON.stringify(newData), (err) => {
            if (err) {
                console.error(err);
                res.status(500).send('Error writing to file');
            } else {
                res.send('Successfully wrote to file');
            }
        });
    } else if (flag == 2) {
        fs.writeFile('extractedtables.json', JSON.stringify(newData), (err) => {
            if (err) {
                console.error(err);
                res.status(500).send('Error writing to file');
            } else {
                res.send('Successfully wrote to file');
            }
        });
    } else if (flag == 3) {
        fs.writeFile('martable.json', JSON.stringify(newData), (err) => {
            if (err) {
                console.error(err);
                res.status(500).send('Error writing to file');
            } else {
                res.send('Successfully wrote to file');
            }
        });
    } else if (flag == 4) {
        fs.writeFile('stagingtables.json', JSON.stringify(newData), (err) => {
            if (err) {
                console.error(err);
                res.status(500).send('Error writing to file');
            } else {
                res.send('Successfully wrote to file');
            }
        });
    } else if (flag == 5) {
        fs.writeFile('static.json', JSON.stringify(newData), (err) => {
            if (err) {
                console.error(err);
                res.status(500).send('Error writing to file');
            } else {
                res.send('Successfully wrote to file');
            }
        });
    } else if (flag == 6) {
        fs.writeFile('successfile.json', JSON.stringify(newData), (err) => {
            if (err) {
                console.error(err);
                res.status(500).send('Error writing to file');
            } else {
                res.send('Successfully wrote to file');
            }
        });
    } else if (flag == 7) {
        fs.writeFile('errorfile.json', JSON.stringify(newData), (err) => {
            if (err) {
                console.error(err);
                res.status(500).send('Error writing to file');
            } else {
                res.send('Successfully wrote to file');
            }
        });
    } else if (flag == 8) {
        fs.writeFile('nothing.json', JSON.stringify(newData), (err) => {
            if (err) {
                console.error(err);
                res.status(500).send('Error writing to file');
            } else {
                res.send('Successfully wrote to file');
            }
        });
    } else if (flag == 9) {
        fs.writeFile('views.json', JSON.stringify(newData), (err) => {
            if (err) {
                console.error(err);
                res.status(500).send('Error writing to file');
            } else {
                res.send('Successfully wrote to file');
            }
        });
    }  else if (flag == 10) {
        fs.writeFile('Pipeline.json', JSON.stringify(newData), (err) => {
            if (err) {
                console.error(err);
                res.status(500).send('Error writing to file');
            } else {
                res.send('Successfully wrote to file');
            }
        });
    }  else if (flag == 11) {
        fs.writeFile('BronzeLayer.json', JSON.stringify(newData), (err) => {
            if (err) {
                console.error(err);
                res.status(500).send('Error writing to file');
            } else {
                res.send('Successfully wrote to file');
            }
        });
    }  else if (flag == 12) {
        fs.writeFile('SilverLayer.json', JSON.stringify(newData), (err) => {
            if (err) {
                console.error(err);
                res.status(500).send('Error writing to file');
            } else {
                res.send('Successfully wrote to file');
            }
        });
    }   else if (flag == 13) {
        fs.writeFile('GoldLayer.json', JSON.stringify(newData), (err) => {
            if (err) {
                console.error(err);
                res.status(500).send('Error writing to file');
            } else {
                res.send('Successfully wrote to file');
            }
        });
    } else {
        console.log("Nothing happend")
    }
});

let MartToStg = []

function getStagingTablesUsed(tablename) {
    const allMartTables = marttables;
    let dbname = '';
    if (tablename.includes(".")) {
        dbname = tablename.split(".")[0];
        tablename = tablename.split(".")[1];
    }
    const tables = allMartTables.filter(table => table.tablename === tablename && (dbname === '' || table.databasename === dbname));
    const stagingTablesUsed = tables.map(table => table.Stagingtableused).flat(); //array of all the staging tables
    return stagingTablesUsed;
}

function addStagingTables(tableName, level, entry = {}, visited = new Set()) {
    if (visited.has(tableName)) {
        return;
    }
    visited.add(tableName);

    let entryCopy = { ...entry };

    if (level == 0) {
        entryCopy['TableName'] = tableName;
    }
    else {
        entryCopy[`StagingUsed${level}`] = tableName;
    }

    const stagingTables = getStagingTablesUsed(tableName);
    let len = stagingTables.length;
    if (len > 0) {
        stagingTables.forEach(stagingTable => {
            if (tableName != stagingTable) {
                addStagingTables(stagingTable, level + 1, entryCopy, visited);
            }
        });
    } else {

        let martToStgSet = new Set(MartToStg.map(e => JSON.stringify(e)));
        martToStgSet.add(JSON.stringify(entryCopy));
        MartToStg = Array.from(martToStgSet).map(e => JSON.parse(e));
    }
}

app.get('/api/marttostg', (req, res) => {

    let mtTables = [];
    marttables.forEach(table => {
        let entry = table;
        if (table.databasename != '') {
            entry['FullTableName'] = table.databasename + "." + table.tablename;
        }
        else {
            entry['FullTableName'] = table.tablename;
        }
        mtTables.push(entry);
    });

    // console.log(mtTables)

    mtTables.forEach(table => {
        let entry = {}
        addStagingTables(table.FullTableName, 0, entry);
    });

    res.json(MartToStg)
    console.log("mart to stg sent")
})

// async function getGPTData(message, endpoint, model, credential) {
//     try {
//         // Create a token provider function for Azure AD authentication
//         const scope = "https://cognitiveservices.azure.com/.default";
//         const azureADTokenProvider = getBearerTokenProvider(credential, scope);
//         const deploymentId = model;
//         const client = new AzureOpenAI({ endpoint, azureADTokenProvider, deploymentId, apiVersion: CONFIG.azureOpenAi.apiVersion });

//         const result = await client.chat.completions.create({
//             model: deploymentId,
//             messages: message
//         });
//         // console.log(result.choices[0].message.content)
//         return result
//     } catch (error) {
//         console.error("An error occurred:", error);
//         // Re-throw so the route handler's catch block runs and a 500 is
//         // returned to the client instead of sending `undefined`.
//         throw error;
//     }
// }

// app.post('/call-gpt', async (req, res) => {
//     const message = [
//         { role: "system", content: "You are a coding assistant. You need to parse the code and just give the exact answer; don't include any additional explanation." },
//         { role: "user", content: "" },
//     ]
//     message[1].content = req.body.content;
//     const endpoint = CONFIG.azureOpenAi.endpoint;
//     const model = CONFIG.azureOpenAi.model;
//     const credential = new DefaultAzureCredential();

//     try {
//         const result = await getGPTData(message, endpoint, model, credential);
//         if (!result) {
//             return res.status(502).send({ error: "Empty response from model." });
//         }
//         res.status(200).send(result);
//     } catch (error) {
//         console.error('[/call-gpt] failure:', error && error.message ? error.message : error);
//         res.status(500).send({ error: "An error occurred while processing your request." });
//     }
// })

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
})

const port = CONFIG.port;

// --- SQL Server connection helper ---
let cachedPool = null;
let tokenExpiresOn = 0;

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

    // IMPORTANT: handle pool-level errors so an emitted 'error' event does
    // not crash the entire Node process (mssql connection pool is an
    // EventEmitter — an unhandled 'error' is fatal in Node).
    cachedPool.on('error', (err) => {
        console.error('[mssql pool error]', err && err.message ? err.message : err);
        // Invalidate cache so the next request reconnects with a fresh token.
        cachedPool = null;
        tokenExpiresOn = 0;
    });

    return cachedPool;
}

// Global safety nets — log instead of crashing on stray async errors.
process.on('unhandledRejection', (reason) => {
    console.error('[unhandledRejection]', reason);
});
process.on('uncaughtException', (err) => {
    console.error('[uncaughtException]', err);
});

// 1) GET distinct repos
app.get('/getrepo-json', async (req, res) => {
    try {
        const pool = await getSqlPool();
        const result = await pool.request().query(
            'SELECT DISTINCT RepoName FROM [CodeAnalyzer].[Repos]'
        );
        res.json(result.recordset);
    } catch (error) {
        console.error('Error fetching repos:', error);
        res.status(500).json({ error: 'Database connection failed' });
    }
});

// 2) POST get data for repo(s)
app.post('/get-json', async (req, res) => {
    try {
        const repos = req.body; // array of repo names
        if (!Array.isArray(repos) || repos.length === 0) {
            return res.status(400).json({ error: 'Request body must be a non-empty array of repo names' });
        }

        const pool = await getSqlPool();

        // Build parameterised IN clause
        function buildRequest() {
            const req = pool.request();
            repos.forEach((r, i) => req.input(`repo${i}`, sql.VarChar, r));
            return req;
        }
        const inClause = repos.map((_, i) => `@repo${i}`).join(',');

        const columnsQuery = `
            SELECT RepoName, TargetTableName, NotebookPath, SourceTableName, ColumnName, LayerLevel, StagingTableColumns
            FROM [CodeAnalyzer].[ColumnsUsed]
            WHERE RepoName IN (${inClause})
        `;

        const [bronzeRes, silverRes, goldRes, columnsRes, pipelinesRes] = await Promise.all([
            buildRequest().query(
                `SELECT RepoName, TableName, SchemaDump, NotebookPath
                 FROM [CodeAnalyzer].[BronzeLayer]
                 WHERE RepoName IN (${inClause})`
            ),
            buildRequest().query(
                `SELECT RepoName, TableName, SchemaDump, NotebookPath
                 FROM [CodeAnalyzer].[SilverLayer]
                 WHERE RepoName IN (${inClause})`
            ),
            buildRequest().query(
                `SELECT RepoName, TableName, SchemaDump, NotebookPath
                 FROM [CodeAnalyzer].[GoldLayer]
                 WHERE RepoName IN (${inClause})`
            ),
            buildRequest().query(columnsQuery),
            buildRequest().query(
                `SELECT RepoName, TableName, [Path], SQLConnection, SourceDetails, DumpLocation, ColumnName
                 FROM [CodeAnalyzer].[Pipelines]
                 WHERE RepoName IN (${inClause})`
            )
        ]);

        res.json({
            BronzeLayer: bronzeRes.recordset,
            SilverLayer: silverRes.recordset,
            GoldLayer: goldRes.recordset,
            ColumnsUsed: columnsRes.recordset,
            Pipelines: pipelinesRes.recordset
        });
        console.log('Repo details sent');
    } catch (error) {
        console.error('Error fetching repo details:', error);
        res.status(500).json({ error: 'Database connection failed' });
    }
});

// 3) POST save FabricEnhanced data into the database so RepoExplorer can read it
const ALLOWED_SAVE_EMAILS = CONFIG.allowedSaveEmails;
const TENANT_ID = CONFIG.tenantId;
const CLIENT_ID = CONFIG.clientId;

const jwksRsa = jwksClient({
    jwksUri: `https://login.microsoftonline.com/${TENANT_ID}/discovery/v2.0/keys`,
    cache: true,
    rateLimit: true,
});

function getSigningKey(header, callback) {
    jwksRsa.getSigningKey(header.kid, (err, key) => {
        if (err) return callback(err);
        callback(null, key.getPublicKey());
    });
}

function verifyToken(token) {
    return new Promise((resolve, reject) => {
        jwt.verify(token, getSigningKey, {
            audience: CLIENT_ID,
            issuer: `https://login.microsoftonline.com/${TENANT_ID}/v2.0`,
            algorithms: ['RS256'],
        }, (err, decoded) => {
            if (err) return reject(err);
            resolve(decoded);
        });
    });
}

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
        if (!repoName) {
            return res.status(400).json({ error: 'repoName is required' });
        }

        const pool = await getSqlPool();

        // Helper: deduplicate an array by a key function
        function dedup(arr, keyFn) {
            const seen = new Set();
            return (arr || []).filter(item => {
                const key = keyFn(item);
                if (seen.has(key)) return false;
                seen.add(key);
                return true;
            });
        }

        // Helper: merge-deduplicate — when same key appears twice, merge arrays instead of dropping
        function mergeDedup(arr, keyFn) {
            const map = new Map();
            for (const item of (arr || [])) {
                const key = keyFn(item);
                if (map.has(key)) {
                    const existing = map.get(key);
                    // Merge array fields
                    if (Array.isArray(item.ColumnUsed)) {
                        existing.ColumnUsed = [...new Set([...(existing.ColumnUsed || []), ...item.ColumnUsed])];
                    }
                    if (Array.isArray(item.Tablesused)) {
                        existing.Tablesused = [...new Set([...(existing.Tablesused || []), ...item.Tablesused])];
                    }
                    if (Array.isArray(item.Columns)) {
                        existing.Columns = [...new Set([...(existing.Columns || []), ...item.Columns])];
                    }
                    if (item.SchemaDump && !existing.SchemaDump) {
                        existing.SchemaDump = item.SchemaDump;
                    }
                } else {
                    map.set(key, { ...item });
                }
            }
            return [...map.values()];
        }

        // Deduplicate input arrays by (tablename + notebookpath), merging columns/sources
        const uniqueBronze = mergeDedup(bronzeDetails, r => `${(r.tablename || '').toLowerCase()}|${(r.filepathname || '').toLowerCase()}`);
        const uniqueSilver = mergeDedup(silverDetails, r => `${(r.tablename || '').toLowerCase()}|${(r.filepathname || '').toLowerCase()}`);
        const uniqueGold = mergeDedup(goldDetails, r => `${(r.tablename || '').toLowerCase()}|${(r.filepathname || '').toLowerCase()}`);
        const uniquePipelines = mergeDedup(pipelines, r => `${(r.TableName || '').toLowerCase()}|${(r.filepathname || '').toLowerCase()}`);

        // Ensure repo exists in Repos table and always update the IST timestamp on save
        await pool.request()
            .input('repoName', sql.VarChar, repoName)
            .query(`
                IF NOT EXISTS (SELECT 1 FROM [CodeAnalyzer].[Repos] WHERE RepoName = @repoName)
                    INSERT INTO [CodeAnalyzer].[Repos] (RepoName, Timestamp)
                    VALUES (@repoName, DATEADD(MINUTE, 330, GETUTCDATE()))
                ELSE
                    UPDATE [CodeAnalyzer].[Repos]
                    SET Timestamp = DATEADD(MINUTE, 330, GETUTCDATE())
                    WHERE RepoName = @repoName
            `);

        // Delete old data for this repo so we do a full refresh

         // Azmal - we don't need this 
        const deleteTables = ['BronzeLayer', 'SilverLayer', 'GoldLayer', 'ColumnsUsed', 'Pipelines'];
        for (const tbl of deleteTables) {
            await pool.request()
                .input('repoName', sql.VarChar, repoName)
                .query(`DELETE FROM [CodeAnalyzer].[${tbl}] WHERE RepoName = @repoName`);
        }

        // Helper: batch INSERT for a layer table (500 rows per query for large dataset performance)
        async function batchInsertLayer(tableName, rows) {
            const LAYER_BATCH = 500;
            for (let i = 0; i < rows.length; i += LAYER_BATCH) {
                const batch = rows.slice(i, i + LAYER_BATCH);
                const req = pool.request();
                const vals = batch.map((row, idx) => {
                    req.input(`rn${idx}`, sql.VarChar(500), repoName);
                    req.input(`tn${idx}`, sql.VarChar(500), row.tablename || '');
                    req.input(`sd${idx}`, sql.VarChar(sql.MAX), row.SchemaDump || '');
                    req.input(`np${idx}`, sql.VarChar(2000), row.filepathname || '');
                    return `(@rn${idx},@tn${idx},@sd${idx},@np${idx})`;
                });
                await req.query(
                    `INSERT INTO [CodeAnalyzer].[${tableName}] (RepoName,TableName,SchemaDump,NotebookPath) VALUES ${vals.join(',')}`
                );
            }
        }

        // Insert Bronze Layer
        await batchInsertLayer('BronzeLayer', uniqueBronze);

        // Insert Silver Layer
        await batchInsertLayer('SilverLayer', uniqueSilver);

        // Insert Gold Layer
        await batchInsertLayer('GoldLayer', uniqueGold);

        // Build a notebook path lookup: tablename (lowercase) → filepathname
        const notebookPathLookup = new Map();
        [...uniqueBronze, ...uniqueSilver, ...uniqueGold].forEach(r => {
            if (r.tablename && r.filepathname) {
                notebookPathLookup.set(r.tablename.toLowerCase(), r.filepathname);
            }
        });

        // Build ColumnsUsed rows.
        // Primary source: stagingtables — each entry has exact source→columns→target mapping.
        // { tablename: source, consumerTable: target, ColumnsUsed: [cols], consumerLayer: layer }
        const columnsRows = [];
        const colSeen = new Set();

        for (const entry of (stagingtables || [])) {
            const source = (entry.tablename || '').trim();
            const target = (entry.consumerTable || '').trim();
            const layer = (entry.consumerLayer || '').trim();
            const cols = Array.isArray(entry.ColumnsUsed) ? entry.ColumnsUsed : [];
            if (!source || !target) continue;
            const notebookPath = notebookPathLookup.get(target.toLowerCase()) || '';
            for (const col of cols) {
                if (!col) continue;
                const key = `${target.toLowerCase()}|${source.toLowerCase()}|${String(col).toLowerCase()}|${layer.toLowerCase()}`;
                if (colSeen.has(key)) continue;
                colSeen.add(key);
                columnsRows.push({ targetTable: target, sourceTable: source, column: String(col), layer, notebookPath });
            }
        }

        // Fallback: for silver/gold/bronze rows whose target table is NOT covered by stagingtables,
        // use cross-product of ColumnUsed × Tablesused so no data is lost.
        const coveredTargets = new Set(columnsRows.map(r => r.targetTable.toLowerCase()));
        function addColumnRowFallback(row, layer) {
            const tname = (row.tablename || '').toLowerCase();
            for (const col of (row.ColumnUsed || [])) {
                for (const src of (row.Tablesused || [])) {
                    const key = `${tname}|${src.toLowerCase()}|${col.toLowerCase()}|${layer.toLowerCase()}`;
                    if (colSeen.has(key)) continue;
                    colSeen.add(key);
                    columnsRows.push({
                        targetTable: row.tablename || '',
                        sourceTable: src,
                        column: col,
                        layer,
                        notebookPath: row.filepathname || ''
                    });
                }
            }
        }
        for (const row of uniqueSilver) {
            if (!coveredTargets.has((row.tablename || '').toLowerCase())) addColumnRowFallback(row, 'Silver');
        }
        for (const row of uniqueGold) {
            if (!coveredTargets.has((row.tablename || '').toLowerCase())) addColumnRowFallback(row, 'Gold');
        }
        for (const row of uniqueBronze) {
            if (!coveredTargets.has((row.tablename || '').toLowerCase())) addColumnRowFallback(row, 'Bronze');
        }

        // SQL Server allows max 2100 parameters per request.
        // ColumnsUsed insert binds 7 parameters per row, so keep batch <= 300.
        // Use 250 for headroom and reliability.
        const COL_BATCH = 250;
        for (let i = 0; i < columnsRows.length; i += COL_BATCH) {
            const batch = columnsRows.slice(i, i + COL_BATCH);
            const req = pool.request();
            const vals = batch.map((r, idx) => {
                req.input(`rn${idx}`, sql.VarChar(500), repoName);
                req.input(`tt${idx}`, sql.VarChar(500), r.targetTable);
                req.input(`np${idx}`, sql.VarChar(2000), r.notebookPath);
                req.input(`st${idx}`, sql.VarChar(500), r.sourceTable);
                req.input(`cn${idx}`, sql.VarChar(500), r.column);
                req.input(`ll${idx}`, sql.VarChar(50), r.layer);
                req.input(`sc${idx}`, sql.VarChar(500), r.column);
                return `(@rn${idx},@tt${idx},@np${idx},@st${idx},@cn${idx},@ll${idx},@sc${idx})`;
            });
            await req.query(`INSERT INTO [CodeAnalyzer].[ColumnsUsed] (RepoName,TargetTableName,NotebookPath,SourceTableName,ColumnName,LayerLevel,StagingTableColumns) VALUES ${vals.join(',')}`);
        }

        // Insert Pipelines
        for (const row of uniquePipelines) {
            const columns = Array.isArray(row.Columns) ? row.Columns.join(', ') : (row.Columns || '');
            await pool.request()
                .input('repoName', sql.VarChar, repoName)
                .input('tableName', sql.VarChar, row.TableName || '')
                .input('path', sql.VarChar, row.Path || '')
                .input('sqlConn', sql.VarChar, row.SQLConnection || '')
                .input('sourceDetails', sql.VarChar, row.SourceDetails || '')
                .input('dumpLocation', sql.VarChar, row.DumpLocation || '')
                .input('columnName', sql.VarChar, columns)
                .query(`
                                        DECLARE @maxLen INT;
                                        SELECT @maxLen = CASE
                                                WHEN t.name IN ('nchar', 'nvarchar') THEN c.max_length / 2
                                                WHEN c.max_length = -1 THEN 8000
                                                ELSE c.max_length
                                        END
                                        FROM sys.columns c
                                        INNER JOIN sys.types t ON c.user_type_id = t.user_type_id
                                        WHERE c.object_id = OBJECT_ID('CodeAnalyzer.Pipelines')
                                            AND c.name = 'ColumnName';

                                        SET @maxLen = ISNULL(NULLIF(@maxLen, 0), 8000);

                                        DECLARE @safeColumnName VARCHAR(8000) = LEFT(@columnName, @maxLen);

                    IF NOT EXISTS (
                        SELECT 1
                        FROM [CodeAnalyzer].[Pipelines]
                                                WHERE ISNULL(RepoName, '') = ISNULL(@repoName, '')
                                                    AND ISNULL(TableName, '') = ISNULL(@tableName, '')
                                                    AND ISNULL([Path], '') = ISNULL(@path, '')
                                                    AND ISNULL(SQLConnection, '') = ISNULL(@sqlConn, '')
                                                    AND ISNULL(SourceDetails, '') = ISNULL(@sourceDetails, '')
                                                    AND ISNULL(DumpLocation, '') = ISNULL(@dumpLocation, '')
                                                    AND ISNULL(ColumnName, '') = ISNULL(@safeColumnName, '')
                    )
                    BEGIN
                        INSERT INTO [CodeAnalyzer].[Pipelines] (RepoName, TableName, [Path], SQLConnection, SourceDetails, DumpLocation, ColumnName)
                        VALUES (@repoName, @tableName, @path, @sqlConn, @sourceDetails, @dumpLocation, @safeColumnName)
                    END
                `);
        }

        console.log(`Repo "${repoName}" saved to database (Bronze: ${uniqueBronze.length}, Silver: ${uniqueSilver.length}, Gold: ${uniqueGold.length}, Columns: ${columnsRows.length}, Pipelines: ${uniquePipelines.length})`);
        res.json({ success: true, message: `Repo "${repoName}" saved successfully` });
    } catch (error) {
        console.error('Error saving repo data:', error);
        res.status(500).json({ error: 'Failed to save repo data to database' });
    }
});

// Record user login
app.post('/api/user-alias', async (req, res) => {
    const { userAlias, userName } = req.body;
    if (!userAlias || !userName) {
        return res.status(400).json({ error: 'userAlias and userName are required' });
    }
    try {
        const pool = await getSqlPool();
        await pool.request()
            .input('userAlias', sql.NVarChar(255), userAlias)
            .input('userName', sql.NVarChar(255), userName)
            .query(`
                INSERT INTO [CodeAnalyzer].[UserAliases] ([UserAlias], [UserName], [CreatedTimestamp]) VALUES (@userAlias, @userName, GETUTCDATE())
            `);
        res.json({ success: true });
    } catch (error) {
        console.error('Error saving user alias:', error);
        res.status(500).json({ error: 'Failed to save user alias' });
    }
});

// Catch-all: serve React build for any unmatched routes
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'build', 'index.html'));
});

app.listen(port, () => console.log(`Server listening on port ${port}`));
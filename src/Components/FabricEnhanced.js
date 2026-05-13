import React, { useEffect, useState } from 'react'
import { OpenAIClient, AzureKeyCredential } from '@azure/openai'
import "./Analyze.css"
import Navbar from './Navbar';
import TabsC from './TabsC';
import TabsFabricEnhanced from './TabsFabricEnhanced';
import CircularProgress from '@mui/material/CircularProgress';
import Backdrop from '@mui/material/Backdrop';
import { Box, Checkbox, FormControlLabel, LinearProgress, TextField, Typography } from '@mui/material';
import axios from 'axios';
import CheckBox from "./CheckBox.js";
import DatabricksLogo from "../Images/FabricLogo.png"
import HowTo1 from "../Images/Picture2.svg"
import { Stack } from 'react-bootstrap';
import { Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, Button } from '@mui/material';
import NavbarEnhanced from './NavbarEnhanced.js';
import { getActiveAccount, getAccessToken } from '../authConfig';

const ALLOWED_SAVE_EMAILS = (process.env.REACT_APP_ALLOWED_SAVE_EMAILS || '')
    .split(',')
    .map(e => e.trim().toLowerCase())
    .filter(Boolean);

function getAccountEmailCandidates(account) {
    const claims = account?.idTokenClaims || {};
    return [
        account?.username,
        claims?.preferred_username,
        claims?.upn,
        claims?.email,
        claims?.unique_name,
    ]
        .filter(Boolean)
        .map(v => String(v).trim().toLowerCase());
}

function Fabric() {

    // const endpoint = process.env.REACT_APP_AZURE_OPENAI_ENDPOINT;
    // const apiKey = process.env.REACT_APP_AZURE_OPENAI_API_KEY;
    // const model = process.env.REACT_APP_AZURE_OPENAI_MODEL;
    const backend_url = process.env.REACT_APP_API_BASE_URL;

    const [files, setFiles] = useState([]);
    const [open, setOpen] = useState(false);

    const handleFileChange = (event) => {
        const selectedFiles = [...event.target.files];
        console.log(`📂 TOTAL FILES SELECTED: ${selectedFiles.length}`);
        console.log("📂 ALL FILES:", selectedFiles.map((f, i) => `${i+1}. ${f.name} → ${f.webkitRelativePath}`).join('\n'));
        
        // Log Silver files specifically
        const silverFiles = selectedFiles.filter(f => f.webkitRelativePath.toLowerCase().includes('silver'));
        console.log(`🥈 SILVER FILES (${silverFiles.length}):`, silverFiles.map(f => f.webkitRelativePath));
        
        if (selectedFiles.length > 300) {
            setOpen(true);
        } else {
            setFiles(selectedFiles);
        }
    }

    const handleClose = () => {
        setOpen(false);
    };

    const [pipelines, setPipelines] = useState([]);
    // "TableName": ""
    // "Path": "",
    // "SQLCOnnection": "",
    // "SourceDetails": "",
    // "DumpLocation":"",
    // "Columns":""
    const [bronzeDetails, setBronzeDetails] = useState([]);
    // "tablename": "",
    // "SchemaDump": "",
    // "Source": "",
    // "TableUsed":"",

    const [silverDetails, setSilverDetails] = useState([]);
    const [goldDetails, setGoldDetails] = useState([]);
// "goldDetails": [
//     {
//         "tablename": "",
//         "SchemaDump": "",
//         "Tablesused": "",
//         "ColumnUsed": ["", ""],
//     },
//     {
//         "tablename": "",
//         "SchemaDump": "",
//         "Tablesused": "",
//         "ColumnUsed": ["", ""],
//     },
// ],
// "tablesinfo": [
//     {
//         "tablename": "",
//         "ColumnsUsed": []
//     }
// ]


    // Mounts data
    // const [mounts, setMounts] = useState([]);

    // Extracted tables data
    // const [extractedtables, setExtractedtables] = useState([]);

    // Database and static tables data
    // const [staticcreated, setStaticcreated] = useState({
    //     "databasecreated": [],
    //     "tablescreated": [],
    //     "filepathname": []
    // });

    // Mart tables details
    // const [marttables, setMarttables] = useState([]);

    // const [viewdetails, setViewDetails] = useState([]);

    const [stagingtables, setStagingTables] = useState([]);

    const [loading, setLoading] = useState(false);
    
    // Track if processing has actually started (to avoid saving empty data on mount)
    // Use sessionStorage to track THIS session's processing state (clears on tab close)
    const [hasProcessed, setHasProcessed] = useState(() => {
        return sessionStorage.getItem('fabricEnhancedSessionProcessed') === 'true';
    });

    const [usermessage, setUserMessage] = useState("");

    const [messageResponse, setMessageResponse] = useState([]);

    const [checked, setChecked] = useState(false);

    const [fileprocess, setFileprocess] = useState([]);
    const [fileError, setFileError] = useState([]);
    const [filenotdetected, setFilenotdetected] = useState([]);

    // Restore state from localStorage on mount ONLY if processing happened in this session
    useEffect(() => {
        // Check if processing happened in this session
        const sessionProcessed = sessionStorage.getItem('fabricEnhancedSessionProcessed') === 'true';
        
        if (!sessionProcessed) {
            // Fresh session - don't restore old data
            console.log('🔄 Fabric Enhanced: Fresh session - not restoring old data');
            return;
        }
        
        const savedState = localStorage.getItem('fabricEnhancedUIState');
        const savedOutput = localStorage.getItem('fabricEnhancedOutput');
        
        if (savedState) {
            try {
                const state = JSON.parse(savedState);
                if (state.fileprocess) setFileprocess(state.fileprocess);
                if (state.fileError) setFileError(state.fileError);
                if (state.filenotdetected) setFilenotdetected(state.filenotdetected);
                if (state.messageResponse) setMessageResponse(state.messageResponse);
                console.log('✅ Fabric Enhanced: UI state restored from localStorage');
            } catch (err) {
                console.log('Failed to parse saved UI state');
            }
        }
        
        if (savedOutput) {
            try {
                const data = JSON.parse(savedOutput);
                if (data.pipelines) setPipelines(data.pipelines);
                if (data.bronzeDetails) setBronzeDetails(data.bronzeDetails);
                if (data.silverDetails) setSilverDetails(data.silverDetails);
                if (data.goldDetails) setGoldDetails(data.goldDetails);
                if (data.stagingtables) setStagingTables(data.stagingtables);
                setHasProcessed(true);
                console.log('✅ Fabric Enhanced: Data restored from localStorage');
            } catch (err) {
                console.log('Failed to parse saved output data');
            }
        }
    }, []);

    // Save to localStorage whenever data changes (after processing starts)
    useEffect(() => {
        // Only save if processing has started
        if (hasProcessed) {
            // Create structured JSON output similar to Databricks format
            const finaljson = {
                "FabricEnhanced": {
                    "Pipelines": pipelines,
                    "BronzeLayer": bronzeDetails,
                    "SilverLayer": silverDetails,
                    "GoldLayer": goldDetails,
                    "StagingTables": stagingtables
                }
            };

            // Simple output format for lineage view
            const outputData = {
                pipelines,
                bronzeDetails,
                silverDetails,
                goldDetails,
                stagingtables
            };

            const hasData = pipelines.length > 0 || bronzeDetails.length > 0 || 
                           silverDetails.length > 0 || goldDetails.length > 0 || 
                           stagingtables.length > 0;
            
            if (hasData) {
                localStorage.setItem('fabricEnhancedOutput', JSON.stringify(outputData));
                console.log('✅ Fabric Enhanced: Data SAVED to localStorage');
                
                // Notify navbar and lineage view that data is available
                window.dispatchEvent(new CustomEvent('fabricEnhancedDataUpdated', { detail: outputData }));
                
                // Verify it was saved
                const verify = localStorage.getItem('fabricEnhancedOutput');
                console.log('✅ Verified in localStorage:', verify ? 'YES (length: ' + verify.length + ')' : 'NO');
            }
            
            // Log when processing is complete
            if (!loading && hasData) {
                console.log("========== FABRIC ENHANCED FINAL JSON ==========");
                console.log(JSON.stringify(finaljson, null, 2));
                console.log("================================================");
                console.log("Summary:");
                console.log("  - Pipelines:", pipelines.length);
                console.log("  - Bronze Layer Tables:", bronzeDetails.length);
                console.log("  - Silver Layer Tables:", silverDetails.length);
                console.log("  - Gold Layer Tables:", goldDetails.length);
                console.log("  - Staging Tables:", stagingtables.length);
            }
            
            // Also save UI state
            const uiState = {
                fileprocess,
                fileError,
                filenotdetected,
                messageResponse,
                hasProcessed: true
            };
            localStorage.setItem('fabricEnhancedUIState', JSON.stringify(uiState));
        }
    }, [hasProcessed, loading, pipelines, bronzeDetails, silverDetails, goldDetails, stagingtables, fileprocess, fileError, filenotdetected, messageResponse]);

    const handleChange = (event) => {
        setChecked(event.target.checked);
    };

    const handleMessageChange = (event) => {
        setUserMessage(event.target.value);
    };

    const [deploymentEndpoint, setDeploymentEndpoint] = useState('');
    const [modelName, setModelName] = useState('');
    const [apiKey, setApiKey] = useState('');

    const handleSubmit = async () => {

        // Clear old data when starting new processing
        localStorage.removeItem('fabricEnhancedOutput');
        localStorage.removeItem('fabricEnhancedUIState');
        localStorage.removeItem('fabricEnhancedLineageState');
        
        // Mark that processing has started in this session
        sessionStorage.setItem('fabricEnhancedSessionProcessed', 'true');
        
        // Reset all state variables
        setPipelines([]);
        setBronzeDetails([]);
        setSilverDetails([]);
        setGoldDetails([]);
        setStagingTables([]);
        setFileprocess([]);
        setFileError([]);
        setFilenotdetected([]);
        setMessageResponse([]);
        
        setLoading(true);
        setHasProcessed(true);  // Mark that processing has started
        
        if (checked) {
            // console.log("hello i entered")
            let idx = 0;
            for (const file of files) {
                console.log("File processes", file.name);
                const reader = new FileReader();
                reader.readAsText(file);
                reader.onloadend = async () => {
                    let result;
                    try {
                        const prompt = reader.result + usermessage + `
                            Please give response as a json object not a array of json
                            text will contains the explaination of what user has asked and code will contain the code output if any
                            JSON Format:
                            {
                                "text": "",
                                "code": ""
                            }
                        `
                        result = await axios.post(`${backend_url}/call-gpt`, { content: prompt, endpoint: deploymentEndpoint, model: modelName, key: apiKey });

                        // console.log(result);

                        for (const choice of result.data.choices) {
                            // console.log("this is gptresponse", choice.message.content)
                            console.log(file.name)

                            console.log(choice.message.content)
                            const jsonobject = JSON.parse(choice.message.content.replace(/^```json\n/, '').replace(/\n```$/, ''))


                            setMessageResponse(prevMounts => {
                                const arr = [...prevMounts, { fileName: file.name, explaintext: jsonobject.text, code: jsonobject.code }]
                                axios.post(`${backend_url}/update-json/${6}`, arr)
                                    .then((res) => {
                                        // console.log(`Status: ${res.status}`);
                                        // console.log('Body: ', res.data);
                                    }).catch((err) => {
                                        // console.error(err);
                                    });
                                return arr;
                            })
                        }
                        idx++;

                        if (files.length === idx || fileprocess.length + fileError.length === idx) {
                            setLoading(false)
                        }
                    } catch (err) {
                        console.log("Error in file", file.name)

                        setFileError(prevError => {
                            const newuniqueerror = [...prevError, { name: file.name, gptmessage: err.message, backenderror: result?.data }];
                            axios.post(`${backend_url}/update-json/${7}`, newuniqueerror)
                                .then((res) => {
                                    // console.log(`Status: ${res.status}`);
                                    // console.log('Body: ', res.data);
                                }).catch((err) => {
                                    // console.error(err);
                                });
                            return newuniqueerror
                        })

                        idx++;

                        if (files.length === idx || fileprocess.length + fileError.length === idx) {
                            setLoading(false)
                        }
                    }
                }

                await new Promise(resolve => setTimeout(resolve, 10000));
            }
        } else {
            let idx = 0;
            for (const file of files) {

                if(file.name === ".platform") {
                    idx++;
                    continue
                }
                console.log(`📁 PROCESSING FILE [${idx + 1}/${files.length}]: ${file.name}`);
                console.log(`   Path: ${file.webkitRelativePath}`);
                let reader;
                try {
                    reader = new FileReader();
                } catch (err) {
                    console.log("Error happened")
                }
                reader.readAsText(file);

                reader.onloadend = async () => {
                    let result;
                    try {
                    //     const prompt = reader.result + `\n \n Please analyze this file to determine its type from the following categories:

                    //     1. Pipeline file - A file which is pipeline 
                    //     2. Bronze Layer File - A file where tables are extracted from a blob, parquet, SQL Server database, Excel, or any other source.
                    //     3. Silver Layer File - A file where some tables are created using staging tables.
                    //     4. Gold Layer File - A file where views are created Identify all the view created including where these statement are 'INSERT INTO', 'CREATE PROCEDURE',  'CREATE OR REPLACE TEMPORARY VIEW', 'CREATE VIEW' or anything where view is created, insert, altered or any sql operation of view.
                    //     Can you identify what type of file this is and provide the requested information in the specified format?
                    //     Note: Please first use the file naming convention to identify whether the file belongs to the Bronze, Silver, or Gold layer. If the file name contains "Silver", classify it as a Silver layer file. If the file name contains "Bronze", classify it as a Bronze layer file. If the file name contains "Gold", classify it as a Gold layer file.Else according to your own.
                    //     I need a identifier also 1,2,3,4 to identify which type of file is this. and if it's not any of the file mark it as 5
                    //     Important - Please enclose every value in quotes. This means that each value should be surrounded by double quotation marks ("value"). For those which are in array enclose these in array
                        
                    // If it's a pipeline file Extract tablename that is extracted, path from where it is extracted, sql connection and any other source details. Give details of only those where some data is extracting. Skip any other pipelines. Important - Please skip the ones where you are not able to find the table name and source.
                    // JSON Format:
                    //     {
                    //         "identifier": 1,
                    //         "pipelines": [
                    //             {
                    //                 "TableName": ""
                    //                 "Path": "",
                    //                 "SQLCOnnection": "",
                    //                 "SourceDetails": "",
                    //                 "DumpLocation":"",
                    //                 "Columns":["", ""]
                    //             },
                    //             {
                    //                 "TableName": ""
                    //                 "Path": "",
                    //                 "SQLCOnnection": "",
                    //                 "SourceDetails": "",
                    //                 "DumpLocation":"",
                    //                 "Columns":["", ""]
                    //             }
                    //         ]
                    //     }

                    // If it's a Bronze layer file where tables are extracted, or created using some sources. For Table dump there can be function used to dump the table at some location. 
                    // Important - Please include every temporary view created in this do not left anything analyze every temporary view created 
                    // JSON Format:
                    // {
                    //     "identifier": 2,
                    //     "bronzeDetails": [
                    //         {
                    //             "tablename": "",
                    //             "SchemaDump": "",
                    //             "Source": "",
                    //             "TableUsed":["", ""],
                    //         },
                    //         {
                    //             "tablename": "",
                    //             "SchemaDump": "",
                    //             "Source": "",
                    //             "TableUsed":["", ""],
                    //         }
                    //     ]
                    // }

                    // If it's a Silver Layer file where tables are created using bronze/silver tables or dumps
                    // Identify all tables and views created in the file. Please include every views and dataframe created in this file. Please also include views that are not dumped. The view can be created using createOrReplaceTempView function so include every views creating using this as well.
                    // can you please present the information in a json format, including all these:
                    // (Include all tables views that are created whether its temporary or anything or its removed. Please do not miss any view or any dataframe include everything)
                    
                    // Please incude all dataframe that are created and also include every view that are created
                    // If not able to find schema put schema as null but give output for all the views
                    // Table Name (Do not include database name in tablename)
                    // Schema Dump (if mentioned) 
                    // Columns (List all the columns used in the creation of the Silver tables. Include the column names)
                    // Table used (Important = Please include schema name in table  )

                    // We are using temporary views through getdataframe function so Could you also please list the columns used of these tables in that notebook. 
                    // Only for those views that are created using getdataframe or any other extracting functions like readexcel or anything 
                    // Table name : Name of table (including databasename) 
                    // JSON Format:
                    // {
                    //     "identifier": 3,
                    //     "silverDetails": [
                    //         {
                    //             "tablename": "",
                    //             "SchemaDump": "",
                    //             "Tablesused": ["", ""],
                    //             "ColumnUsed": ["", ""],
                    //         },
                    //         {
                    //             "tablename": "",
                    //             "SchemaDump": "",
                    //             "Tablesused": ["", ""],
                    //             "ColumnUsed": ["", ""],
                    //         },
                    //     ],
                    //     "stagingtablesinfo": [
                    //         {
                    //             "tablename": "",
                    //             "ColumnsUsed": []
                    //         }
                    //     ]
                    // }"

                    // If it's a Gold Layer file where tables are created using bronze/ silver tables / dumps
                    // Identify all tables and views created in the file. Please include every temporary view and dataframe created in this file. The view can be created using createOrReplaceTempView function so include every views creating using this as well.
                    // can you please present the information in a json format, including all these:
                    // (Include all tables views that are created whether its temporary or anything or its removed. Please do not miss any view or any dataframe include everything)
                    
                    // Please incude dataframe that is created and also include every view that is created and For temporaray view there can be some function used writeTable to write that view data to schema (This function is used to write a temporary view to a lakehouse location so fetch the schema from this function )
                    // Table Name (Do not include database name in tablename)
                    // Schema Dump (if mentioned) 
                    // Columns (List all the columns used in the creation of the Silver tables. Include the column names)
                    // Table used (Important = Please include schema name in table  )
                    // Important - Please include views that are not dumped 
                    // We are using temporary views through getdataframe function so Could you also please list the columns used of these tables in that notebook. 
                    // Only for those views that are created using getdataframe or any other extracting functions like readexcel or anything 
                    // Table name : Name of table (including databasename) 
                    // JSON Format:
                    // {
                    //     "identifier": 4,
                    //     "goldDetails": [
                    //         {
                    //             "tablename": "",
                    //             "SchemaDump": "",
                    //             "Tablesused": ["", ""],
                    //             "ColumnUsed": ["", ""],
                    //         },
                    //         {
                    //             "tablename": "",
                    //             "SchemaDump": "",
                    //             "Tablesused": ["", ""],
                    //             "ColumnUsed": ["", ""],
                    //         },
                    //     ],
                    //     "stagingtablesinfo": [
                    //         {
                    //             "tablename": "",
                    //             "ColumnsUsed": []
                    //         }
                    //     ]
                    // }"


                    // If the file doesn't match any of the specified types, give this json as response
                    // JSON Format:
                    // {
                    //     "identifier": 6,
                    // }
                    // Important - identifier must be an integer
                    // Please give response as a json object not a array of json
                    // `
                    const prompt = reader.result + `\n\n` + `You are a code analysis engine for a Medallion Architecture (Bronze/Silver/Gold) data platform. Your task is to classify the above file into exactly ONE of the following categories, then return a single JSON object (not an array) with the structured information described for that category.

                        === CLASSIFICATION RULES ===

                        STEP 1 — Check the file name AND file path first:
                        - If the file name OR file path contains "Bronze" (case-insensitive), classify as Category 2 (Bronze Layer).
                        - If the file name OR file path contains "Silver" (case-insensitive), classify as Category 3 (Silver Layer).
                        - If the file name OR file path contains "Gold" (case-insensitive), classify as Category 4 (Gold Layer).

                        STEP 2 — If the file name/path does not match, analyze the file content for layer indicators:
                        - If the file uses getDataframe() or readexceltodf() with paths containing "Silver" (e.g., f"{SilverPublishSchema}/..."), AND has writeTable() with Silver paths → Category 3 (Silver Layer)
                        - If the file uses getDataframe() with paths containing "Bronze" AND has writeTable() with Bronze paths → Category 2 (Bronze Layer)
                        - If the file uses getDataframe() with paths containing "Silver" AND has writeTable() with Gold paths → Category 4 (Gold Layer)
                        - If the file reads from external sources (spark.read, OPENROWSET, SQL connections) with minimal transformation → Category 2 (Bronze Layer)

                        STEP 3 — Content-based classification (if Steps 1-2 don't apply):

                        Category 1 — Pipeline File:
                            A data pipeline definition file (e.g., JSON pipeline config, ADF pipeline, Fabric pipeline). It defines data movement activities that extract data from sources and load it to destinations. Only classify as pipeline if the file is a pipeline definition — not a notebook.

                        Category 2 — Bronze Layer File:
                            A file that extracts or ingests raw data from external sources (Blob Storage, Parquet, SQL Server, Excel, CSV, Delta, APIs, etc.) into the first layer of the lakehouse. Typically uses spark.read, COPY INTO, getDataframe(), readexceltodf(), OPENROWSET, or similar ingestion functions. Data is loaded with minimal transformation.

                        Category 3 — Silver Layer File:
                            A file that transforms and cleanses data into curated tables/views. Creates tables or views using joins, filters, aggregations, or business logic. Uses createOrReplaceTempView, writeTable(), DataFrame transformations, or SQL queries that read from other tables and produce outputs.

                        Category 4 — Gold Layer File:
                            A file that creates final consumption-ready views or tables. These are business-level aggregations, reporting views, or analytics-ready datasets.

                        Category 5 — None of the Above:
                            The file does not match any of the above categories. Use this ONLY if the file has no data processing, no table creation, and no writeTable() calls.

                        === GLOBAL RULES (apply to ALL categories) ===

                        1. QUOTE ALL VALUES: Every string value in the JSON output must be enclosed in double quotes. Array values must be arrays of quoted strings. The "identifier" field must be an integer (not a string).
                        2. TABLE NAME FORMAT: Tables can be persisted via several mechanisms — extract the table name from the LAST PATH SEGMENT in each case:
                           (a) writeTable(viewName, path, ...) → use the SECOND argument (the path), take the part after the last "/".
                               - writeTable("All_Events_Raw_Historical_Intermediate", f"{SilverPublishSchema}/All_Events_Raw_Historical", ...) → tablename = "All_Events_Raw_Historical"
                               - writeTable("Silver_DimTime", f"{SilverPublishSchema}/DimTime", ...) → tablename = "DimTime"
                           (b) Direct DataFrame write to an abfss:// (or wasbs:// / OneLake) path, e.g.
                               df.write.format("delta").mode("overwrite").save("abfss://{WorkspaceId}@msit-onelake.dfs.fabric.microsoft.com/{LakehouseId}/Tables/Bronze/DataDefinitionfile")
                               → tablename = LAST path segment after the final "/" → "DataDefinitionfile" (NOT the full URL).
                               The layer ("Bronze"/"Silver"/"Gold") is the path segment immediately BEFORE the table name (here "Bronze").
                           (c) saveAsTable("schema.TableName") or saveAsTable("Schema/TableName") → tablename = part after last "." or "/".
                           (d) CREATE TABLE / INSERT INTO / MERGE INTO <name> → tablename = the bare name (strip any "schema." or "layer/" prefix).
                           If none of the above persist the table, use the createOrReplaceTempView name but strip any layer prefix (Bronze_, Silver_, Gold_).
                           NEVER output a full URL, abfss://… string, or the writeTable() first argument as the tablename.
                        3. SCHEMA RESOLUTION: When a schema/dump location is determined by a function call (writeTable, df.write.save, saveAsTable, etc.), extract the schema/dump prefix as everything BEFORE the final table name in the path:
                           - writeTable("X", f"{SilverPublishSchema}/DimTime", ...) → SchemaDump = "SilverPublishSchema/DimTime"
                           - df.write.save("abfss://.../Tables/Bronze/DataDefinitionfile") → SchemaDump = "Bronze/DataDefinitionfile" (compress the abfss URL down to "<Layer>/<TableName>"; do NOT keep the full URL).
                           If multiple writes exist for the same table, prefer the one using an f-string/variable-based path (e.g., f"{SilverPublishSchema}/DimTime") over a hardcoded string path. Resolve the variable name but keep it in the output (e.g., "SilverPublishSchema/DimTime").
                           For Tablesused / stagingtablesinfo entries that reference a table written via abfss path, use the same compressed "Layer/TableName" form (e.g., "Bronze/DataDefinitionfile") — never the abfss URL.
                        4. FUNCTION NAMES: When referencing tables loaded via helper functions (getDataframe(), readexceltodf(), spark.read, etc.), use ONLY the table name — NOT the full function call syntax.
                        5. COMPLETENESS: Do NOT skip any table, view, DataFrame, or temporary view. Include everything, even if it is later dropped, renamed, or not persisted. If you cannot determine the schema, set SchemaDump to "null" but still include the entry.
                        6. Return ONLY the JSON object. No markdown code fences, no explanation, no text outside the JSON.

                        === OUTPUT FORMAT BY CATEGORY ===

                        --- CATEGORY 1: Pipeline File ---
                        
                        === CRITICAL PIPELINE CLASSIFICATION RULES ===
                        
                        STEP A: Identify pipeline type FIRST:
                        
                        1. ORCHESTRATION PIPELINE (SKIP/IGNORE):
                           - Contains activities like: GetConfiguration, Get_Status_Flag, If Condition, Set Status, Lookup (for config), Wait, Until loops for status checking
                           - Primary purpose is to: check status flags, invoke other pipelines, set completion status
                           - Activities include: "Execute Pipeline", "Invoke Pipeline", "Set Variable" (for status), "Web Activity" (for status APIs)
                           - Example pattern: GetConfiguration → Get_Status_Flag → If Condition → [Invoke Pipeline] → Set Status
                           - These pipelines DO NOT directly copy/fetch data - they orchestrate other pipelines
                           - For orchestration pipelines, return: {"identifier": 5, "note": "Orchestration pipeline - no direct data extraction"}
                        
                        2. DATA EXTRACTION PIPELINE (EXTRACT DETAILS):
                           - Contains actual Copy Activity, Copy Tables, or ForEach with Copy Activity inside
                           - Has source connection details (SQL Server, Database connections, Lakehouse sources)
                           - Has sink/destination details (Lakehouse tables, Bronze layer)
                           - Contains variables with table arrays like: [{"SchemaName":"Account","TableName":"Account","NewTableName":"DimAccount"}, ...]
                           - These pipelines DIRECTLY move data from source to destination
                        
                        STEP B: For DATA EXTRACTION PIPELINES ONLY, extract these details:
                        
                        For pipelines with ForEach loops iterating over table lists:
                        - Look for variables containing arrays of table definitions
                        - Extract EACH table as a separate entry
                        - Common variable names: DMC_Table, PMC_Table, Tables, TableList, etc.
                        
                        For each Copy Activity or table in ForEach, provide:
                        - "TableName": The destination/target table name. For ForEach loops, use NewTableName if available, otherwise TableName from the array.
                        - "Source": Short identifier of the source database (e.g., "DMC", "PMC", "SMC"). Extract from connection name or database name.
                        - "Path": The source schema.table path in format "SchemaName.TableName" (e.g., "Account.Account", "dbo.Users"). This comes from @item().SchemaName and @item().TableName or the source table configuration.
                        - "SQLConnection": The full SQL Server connection string/hostname (e.g., "dmc-db-prod-replica.database.windows.net", "pmc-sql-server.database.windows.net"). Look for Connection, linkedServiceName, or server details.
                        - "SourceDetails": The database name with type (e.g., "DMC Database", "PMC Database", "SQL Server - DMC", "Azure SQL - PMC").
                        - "DumpLocation": The destination lakehouse/schema path (e.g., "Bronze.DimAccount", "POSOT_DigitalLH/Bronze/User", "Lakehouse/Bronze").
                        - "Columns": Array of column names if mapping is specified, otherwise empty array [].
                        
                        STEP C: Key patterns to identify actual data extraction:
                        
                        ✓ EXTRACT DATA FROM THESE:
                        - "type": "Copy" or "CopyActivity" or "Copy data"
                        - ForEach activity with Copy inside
                        - Activities named like: "Copy Tables", "Copy_Data", "Fetch_Tables", "Extract_Data"
                        - Source configuration with: "type": "SqlSource", "AzureSqlSource", "SqlServerSource"
                        - Sink configuration with: "type": "LakehouseSink", "ParquetSink", "DeltaSink"
                        
                        ✗ SKIP/IGNORE THESE:
                        - "type": "ExecutePipeline" or "InvokePipeline" (just invokes another pipeline)
                        - "type": "Lookup" for status/config checking
                        - "type": "SetVariable" for status flags
                        - "type": "IfCondition" for branching logic
                        - "type": "WebActivity" for API calls to check status
                        - Activities named like: "GetConfiguration", "Get_Status_Flag", "Set_Status", "Check_Status"
                        
                        {
                        "identifier": 1,
                        "pipelines": [
                            {
                            "TableName": "<destination_table_name>",
                            "Source": "<DMC|PMC|SMC|etc>",
                            "Path": "<SchemaName.TableName>",
                            "SQLConnection": "<full_sql_server_hostname>",
                            "SourceDetails": "<database_name> Database",
                            "DumpLocation": "<Bronze.tablename or lakehouse/schema>",
                            "Columns": []
                            }
                        ]
                        }
                        
                        NOTE: If the pipeline is an orchestration pipeline with NO direct data extraction activities, return:
                        {
                            "identifier": 5,
                            "note": "Orchestration pipeline - invokes nested pipelines but does not directly extract data"
                        }

                        --- CATEGORY 2: Bronze Layer File ---
                        Identify ALL tables/views extracted or created in this file. This includes:
                        - Tables loaded from external sources (Blob, Parquet, SQL Server, Excel, CSV, Delta, etc.)
                        - Temporary views created via createOrReplaceTempView() or spark.sql("CREATE OR REPLACE TEMPORARY VIEW ...")
                        - DataFrames that are named/registered as views

                        For each table/view, provide:
                        - "tablename": The actual table name extracted from the writeTable() path argument — use the part after the last "/" in the f-string path (e.g., for writeTable("Bronze_DimTime", f"{BronzeSchema}/DimTime", ...), use "DimTime"). If no writeTable() exists, use the createOrReplaceTempView name but strip any layer prefix (Bronze_, Silver_, Gold_).
                        - "SchemaDump": The schema/lakehouse path where data is dumped or written (if a function like writeTable() or similar is used to persist the data). Set to "null" if not found.
                        - "Source": The extraction source description (e.g., "Parquet file at abfss://...", "SQL Server query", "Excel file", "getDataframe()").
                        - "TableUsed": Array of source table names used to create this table (if it reads from other tables). Empty array if loaded directly from an external source.
                        - "ColumnUsed": Array of EVERY column that the produced Bronze table contains/exposes — derived from the SELECT list, schema definition, withColumn() calls, or the source schema. Empty array only if truly unknown. De-duplicate.

                        Additionally, populate "stagingtablesinfo" for EVERY source table this Bronze file READS FROM (not the table it produces). This applies whenever the file reads other Bronze/Silver/Gold tables via getDataframe(), spark.read.table(), spark.sql("SELECT ... FROM ..."), JOINs, etc. Use the SAME normalization rules as Silver/Gold:
                        - "tablename": Normalize to "Layer/TableName" with "/" separator (e.g., "Bronze_DimCustomer" → "Bronze/DimCustomer", "Schema.Table" → "Schema/Table").
                        - "consumerTable": REQUIRED. The name of the produced Bronze table (from bronzeDetails above) that READS THIS source. If the file produces multiple Bronze tables, emit a SEPARATE stagingtablesinfo entry per (source, consumer) pair — do NOT merge them.
                        - "ColumnsUsed": The list of columns OF THIS SOURCE TABLE that the consumer table actually reads. Derive by literally scanning the file for references to this table when building the consumer; NEVER copy the produced Bronze table's column names. For 'SELECT src.SourceCol AS OutputCol' record 'SourceCol' not 'OutputCol'. For 'IFNULL(src.A, src.B) AS C', record 'A' and 'B'. Resolve aliases. Include WHERE/GROUP BY/ORDER BY/HAVING/JOIN-key columns. De-duplicate. List every column literally — never use "..." or "etc". Do not invent columns.
                        If the Bronze file only loads from external sources (Parquet/SQL Server/Excel) and reads NO other tables, return an empty array for stagingtablesinfo.
                        {
                        "identifier": 2,
                        "bronzeDetails": [
                            {
                            "tablename": "<table_or_view_name>",
                            "SchemaDump": "<schema_dump_path_or_null>",
                            "Source": "<source_description>",
                            "TableUsed": ["<source_table1>", "<source_table2>"],
                            "ColumnUsed": ["<col1>", "<col2>"]
                            }
                        ],
                        "stagingtablesinfo": [
                            {
                            "tablename": "<schema/source_table_name>",
                            "consumerTable": "<produced_bronze_table_name>",
                            "ColumnsUsed": ["<col1>", "<col2>"]
                            }
                        ]
                        }

                        --- CATEGORY 3: Silver Layer File ---
                        Step-by-step instructions:
                        1. Scan the ENTIRE file for ALL tables created or written:
                           - Tables persisted via writeTable(), spark.write, saveAsTable()
                           - Tables created via CREATE TABLE, INSERT INTO, MERGE INTO
                           - The FINAL output table(s) of the file (what the file ultimately produces)
                        2. For each table found, provide:
                           - "tablename": If writeTable() exists, use the SECOND argument (the path), take the part after the last "/". Example: writeTable("VisitorChannelMapping_Update", f"{SilverPublishSchema}/VisitorChannelMapping", ...) → tablename = "VisitorChannelMapping". If no writeTable(), use the main output table/view name.
                           - "SchemaDump": The schema path if available (e.g., "SilverPublishSchema/TableName"), or "null" if not found.
                        3. CRITICAL for "Tablesused":
                           - List ONLY the source tables that THIS produced silver table actually reads — NOT every table loaded at the top of the file.
                           - Build the list by following ONLY the SQL/DataFrame chain that ends at THIS produced table's createOrReplaceTempView / writeTable / save call.
                           - RECURSIVELY EXPAND every intermediate dependency into its ultimate getDataframe()/readexceltodf()/spark.read source. This includes:
                             * Any temp view created earlier in the SAME file via createOrReplaceTempView("X") — do NOT list "X"; instead list the source tables X itself was built from. Recurse until you only have getDataframe()/read sources.
                             * Any WITH-CTE inside the SQL — do NOT list the CTE name; expand it to its source tables.
                             * Any DataFrame variable assigned from another transformation — trace back to the original load.
                           - Tables defined inline via spark.createDataFrame([...]) (static lookup tables) are NOT real source tables — OMIT them entirely from Tablesused.
                           - The final Tablesused list must contain ONLY names that came from getDataframe(), readexceltodf(), spark.read.table(), spark.read.format(...).load(...), or equivalent external loaders. Never temp-view names, never CTE names, never spark.createDataFrame names.
                           - If the file loads tables via getDataframe() that THIS produced table never references (directly or transitively), DO NOT include them. Each produced table in silverDetails must have its OWN, possibly different Tablesused list.
                           - Use the path format with "/" separator (e.g., "SilverPublishSchema/All_Events_Raw_Historical")
                        4. For "ColumnUsed": List ONLY the columns the produced silver table EXPOSES in its final projection (the names a downstream reader would see).
                           - These are the OUTPUT names from the outermost final SELECT (or the alias after AS, e.g. 'COUNT(DISTINCT x) AS Total_Rows' → 'Total_Rows').
                           - If the final SELECT projects a single aggregate like 'COUNT(DISTINCT a.b) AS Total', then ColumnUsed must be EXACTLY ['Total'] — nothing else.
                           - Do NOT include columns that only appear inside JOIN ON, WHERE, GROUP BY, HAVING, ORDER BY, CTE bodies, or as source-side references inside aggregations. Those belong in stagingtablesinfo.ColumnsUsed (per source), NOT here.
                           - Do NOT include source-table column names unless they literally appear (with that exact name or via 'AS <name>') in the final SELECT projection.

                        Additionally, populate "stagingtablesinfo" for EVERY source table referenced in this file. SOURCES INCLUDE BOTH:
                        (a) Tables loaded via getDataframe(), readexceltodf(), spark.read, etc., AND
                        (b) Tables referenced inline inside spark.sql("""...""") strings — any identifier appearing after FROM, JOIN, LEFT JOIN, RIGHT JOIN, INNER JOIN, CROSS JOIN, USING, MERGE INTO, INSERT INTO, UPDATE in the SQL body. Strip aliases (e.g. "Bronze_DimCustomer AS DC" → table = "Bronze_DimCustomer", alias = "DC").
                        For EACH such source table, emit a SEPARATE stagingtablesinfo entry per (source table, produced silver table) pair. If this file produces multiple silver tables and they all read the same source, emit ONE entry per consumer — do NOT merge them.
                        IMPORTANT: Only emit a (source, consumer) entry when that consumer ACTUALLY reads the source — directly in its SELECT/JOIN/CTE bodies, OR transitively via a temp view/CTE the consumer's chain uses. Do NOT emit a (source, consumer) entry just because the source was loaded at the top of the file: every emitted source must be present in the consumer's Tablesused list.
                        TEMP-VIEW EXPANSION: If the consumer references a temp view created earlier in the SAME file, do NOT emit the temp view name as the source. Instead, recurse into that temp view's own SQL and emit one stagingtablesinfo entry for each ULTIMATE getDataframe()/spark.read source it pulls from, attributing only the columns this consumer actually reads (transitively) from that source. Same for WITH-CTEs. Same for static spark.createDataFrame tables — omit them entirely.
                        - "tablename": Normalize the name to use "/" between the layer/schema and the table. Convert layer-prefix underscores: "Bronze_DimCustomer" → "Bronze/DimCustomer", "Silver_FactRevenue" → "Silver/FactRevenue", "Gold_DimIndustry" → "Gold/DimIndustry". If referenced as "Schema.Table", output "Schema/Table". Match the same naming convention used for tables loaded via getDataframe() so entries can be merged.
                        - "consumerTable": REQUIRED. The name of the produced silver table (from silverDetails above) that READS THIS source.
                        - "ColumnsUsed": The list of columns OF THIS SOURCE TABLE that the consumer table actually reads. You MUST derive this by literally scanning the file text for references to this table when building this consumer (via its alias, df variable, or qualified name) — NEVER copy the produced output table's column names and assume they match. Rules:
                          * For 'SELECT src.SourceCol AS OutputCol' record 'SourceCol' (the LEFT side of AS), NOT 'OutputCol'.
                          * For 'IFNULL(src.A, src.B) AS C', record 'A' and 'B' (both real source columns), NOT 'C'.
                          * For 'df.select("X", "Y")' on a dataframe loaded from this table, record 'X' and 'Y' only if they exist on this table.
                          * For 'df1.join(df2, df1.K == df2.K)', record 'K' for whichever side this table is.
                          * For SQL 'JOIN ON A.k1 = B.k2', record 'k1' for table A and 'k2' for table B.
                          * Include columns appearing in WHERE, GROUP BY, ORDER BY, HAVING, window PARTITION BY/ORDER BY, withColumn() expressions, CAST/COALESCE/IFNULL/CASE wrappers — always the SOURCE-SIDE name.
                          * Resolve every alias to its base table before recording.
                          * De-duplicate. List every column literally — never use "..." or "etc".
                          * If a column name in the output table does NOT appear textually as a reference to THIS source table anywhere in the file, do NOT include it.
                          * Do NOT invent or guess columns; only include names that literally occur in the file.
                        Do NOT skip a source table just because it was referenced inside an inline SQL string instead of getDataframe().
                        {
                        "identifier": 3,
                        "silverDetails": [
                            {
                            "tablename": "<output_table_name>",
                            "SchemaDump": "<schema_dump_path_or_null>",
                            "Tablesused": ["<schema/source_table1>", "<schema/source_table2>"],
                            "ColumnUsed": ["<col1>", "<col2>"]
                            }
                        ],
                        "stagingtablesinfo": [
                            {
                            "tablename": "<schema/source_table_name>",
                            "consumerTable": "<produced_silver_table_name>",
                            "ColumnsUsed": ["<col1>", "<col2>"]
                            }
                        ]
                        }

                        --- CATEGORY 4: Gold Layer File ---
                        Step-by-step instructions:
                        1. Scan the ENTIRE file for ALL tables created or written:
                           - Tables persisted via writeTable(), spark.write, saveAsTable()
                           - Tables created via CREATE TABLE, INSERT INTO, MERGE INTO
                           - The FINAL output table(s) of the file (what the file ultimately produces)
                        2. For each table found, provide:
                           - "tablename": If writeTable() exists, use the SECOND argument (the path), take the part after the last "/". If no writeTable(), use the main output table/view name.
                           - "SchemaDump": The schema path if available, or "null" if not found.
                        3. CRITICAL for "Tablesused":
                           - List ONLY the source tables that THIS produced gold table actually reads — NOT every table loaded at the top of the file.
                           - Build the list by following ONLY the SQL/DataFrame chain that ends at THIS produced table's createOrReplaceTempView / writeTable / save call.
                           - RECURSIVELY EXPAND every intermediate dependency into its ultimate getDataframe()/readexceltodf()/spark.read source. This includes:
                             * Any temp view created earlier in the SAME file via createOrReplaceTempView("X") — do NOT list "X"; instead list the source tables X itself was built from. Recurse until you only have getDataframe()/read sources.
                             * Any WITH-CTE inside the SQL — do NOT list the CTE name; expand it to its source tables.
                             * Any DataFrame variable assigned from another transformation — trace back to the original load.
                           - Tables defined inline via spark.createDataFrame([...]) (static lookup tables like PartnerBusinessModelStatic, Content_Owners, Industry_CampaignNames) are NOT real source tables — OMIT them entirely from Tablesused.
                           - The final Tablesused list must contain ONLY names that came from getDataframe(), readexceltodf(), spark.read.table(), spark.read.format(...).load(...), or equivalent external loaders. Never temp-view names, never CTE names, never spark.createDataFrame names.
                           - If the file loads tables via getDataframe() that THIS produced table never references (directly or transitively), DO NOT include them. Each produced table in goldDetails must have its OWN, possibly different Tablesused list.
                           - Use the path format with "/" separator (e.g., "SilverPublishSchema/DimTime", "Bronze/DimPartner").
                        4. For "ColumnUsed": List ONLY the columns the produced gold table EXPOSES in its final projection (the names a downstream reader would see).
                           - These are the OUTPUT names from the outermost final SELECT (or the alias after AS, e.g. 'COUNT(DISTINCT DP.PartnerOneKey) AS Total_Partners' → 'Total_Partners').
                           - If the final SELECT projects a single aggregate like 'COUNT(DISTINCT DP.PartnerOneKey) AS Total_Partners', then ColumnUsed must be EXACTLY ['Total_Partners'] — nothing else.
                           - Do NOT include columns that only appear inside JOIN ON, WHERE, GROUP BY, HAVING, ORDER BY, CTE bodies, or as source-side references inside aggregations. Those belong in stagingtablesinfo.ColumnsUsed (per source), NOT here.
                           - Do NOT include source-table column names like PartnerOneKey, PartnerOneID, MembershipStatus unless they literally appear (with that exact name or via 'AS <name>') in the final SELECT projection.

                        Additionally, populate "stagingtablesinfo" for EVERY source table referenced in this file. SOURCES INCLUDE BOTH:
                        (a) Tables loaded via getDataframe(), readexceltodf(), spark.read, etc., AND
                        (b) Tables referenced inline inside spark.sql("""...""") strings — any identifier appearing after FROM, JOIN, LEFT JOIN, RIGHT JOIN, INNER JOIN, CROSS JOIN, USING, MERGE INTO, INSERT INTO, UPDATE in the SQL body. Strip aliases (e.g. "Bronze_DimCustomer AS DC" → table = "Bronze_DimCustomer", alias = "DC").
                        For EACH such source table, emit a SEPARATE stagingtablesinfo entry per (source table, produced gold table) pair. If this file produces multiple gold tables and they all read the same source, emit ONE entry per consumer — do NOT merge them.
                        IMPORTANT: Only emit a (source, consumer) entry when that consumer ACTUALLY reads the source — directly in its SELECT/JOIN/CTE bodies, OR transitively via a temp view/CTE the consumer's chain uses. Do NOT emit a (source, consumer) entry just because the source was loaded at the top of the file: every emitted source must be present in the consumer's Tablesused list.
                        TEMP-VIEW EXPANSION: If the consumer references a temp view created earlier in the SAME file (e.g. SELECT ... FROM DMCLeads / FROM DPD), do NOT emit "DMCLeads" or "DPD" as the source. Instead, recurse into that temp view's own SQL and emit one stagingtablesinfo entry for each ULTIMATE getDataframe()/spark.read source it pulls from, attributing only the columns this consumer actually reads (transitively) from that source. Same for WITH-CTEs. Same for static spark.createDataFrame tables — omit them entirely (do not emit a staging entry for them).
                        - "tablename": Normalize the name to use "/" between the layer/schema and the table. Convert layer-prefix underscores: "Bronze_DimCustomer" → "Bronze/DimCustomer", "Silver_FactRevenue" → "Silver/FactRevenue", "Gold_DimIndustry" → "Gold/DimIndustry". If referenced as "Schema.Table", output "Schema/Table". Match the same naming convention used for tables loaded via getDataframe() so entries can be merged.
                        - "consumerTable": REQUIRED. The name of the produced gold table (from goldDetails above) that READS THIS source.
                        - "ColumnsUsed": The list of columns OF THIS SOURCE TABLE that the consumer table actually reads. You MUST derive this by literally scanning the file text for references to this table when building this consumer (via its alias, df variable, or qualified name) — NEVER copy the produced output table's column names and assume they match. Rules:
                          * For 'SELECT src.SourceCol AS OutputCol' record 'SourceCol' (the LEFT side of AS), NOT 'OutputCol'.
                          * For 'IFNULL(src.A, src.B) AS C', record 'A' and 'B' (both real source columns), NOT 'C'.
                          * For 'df.select("X", "Y")' on a dataframe loaded from this table, record 'X' and 'Y' only if they exist on this table.
                          * For 'df1.join(df2, df1.K == df2.K)', record 'K' for whichever side this table is.
                          * For SQL 'JOIN ON A.k1 = B.k2', record 'k1' for table A and 'k2' for table B.
                          * Include columns appearing in WHERE, GROUP BY, ORDER BY, HAVING, window PARTITION BY/ORDER BY, withColumn() expressions, CAST/COALESCE/IFNULL/CASE wrappers — always the SOURCE-SIDE name.
                          * Resolve every alias to its base table before recording.
                          * De-duplicate. List every column literally — never use "..." or "etc".
                          * If a column name in the output table does NOT appear textually as a reference to THIS source table anywhere in the file, do NOT include it.
                          * Do NOT invent or guess columns; only include names that literally occur in the file.
                        Do NOT skip a source table just because it was referenced inside an inline SQL string instead of getDataframe().
                        {
                        "identifier": 4,
                        "goldDetails": [
                            {
                            "tablename": "<output_table_name>",
                            "SchemaDump": "<schema_dump_path_or_null>",
                            "Tablesused": ["<schema/source_table1>", "<schema/source_table2>"],
                            "ColumnUsed": ["<col1>", "<col2>"]
                            }
                        ],
                        "stagingtablesinfo": [
                            {
                            "tablename": "<schema/source_table_name>",
                            "consumerTable": "<produced_gold_table_name>",
                            "ColumnsUsed": ["<col1>", "<col2>"]
                            }
                        ]
                        }

                        --- CATEGORY 5: No Match ---
                        {
                        "identifier": 5
                        }

                        === FINAL REMINDERS ===
                        - Return exactly ONE JSON object matching the identified category.
                        - The "identifier" field must be an integer: 1, 2, 3, 4, or 5.
                        - ALWAYS include at least one entry in silverDetails/goldDetails/bronzeDetails for the main output table of the file.
                        - For "Tablesused": TRACE through all temp views to find the ORIGINAL source tables loaded via getDataframe() - never list temp view names.
                        - All values must be quoted strings. Arrays must be arrays of quoted strings.
                        - Do NOT wrap the JSON in markdown code fences or add any text outside the JSON.
                        `

                        result = await axios.post(`${backend_url}/call-gpt`, { content: prompt, endpoint: deploymentEndpoint, model: modelName, key: apiKey });

                        // console.log("this is result", result)
                        for (const choice of result.data.choices) {
                            console.log("📄 Processing file:", file.name, "| Path:", file.webkitRelativePath)
                            console.log("🤖 GPT Response (first 800 chars):", choice.message.content.substring(0, 800))

                            let jsonobject;
                            try {
                                jsonobject = JSON.parse(choice.message.content.replace(/^```json\n/, '').replace(/\n```$/, '').replace(/```json/g, '').replace(/```/g, ''))
                            } catch (parseError) {
                                console.error("❌ JSON Parse Error for file:", file.name, parseError);
                                console.log("Raw content:", choice.message.content);
                                continue;
                            }

                            const flag = jsonobject.identifier;
                            console.log(`🏷️ File "${file.name}" → Identifier: ${flag} (1=Pipeline, 2=Bronze, 3=Silver, 4=Gold, 5=NotDetected)`)
                            
                            if (flag === 3) {
                                console.log("📋 Silver tables found:", jsonobject.silverDetails?.map(t => t.tablename));
                                if (!jsonobject.silverDetails || jsonobject.silverDetails.length === 0) {
                                    console.warn(`⚠️ WARNING: Silver file "${file.name}" has EMPTY silverDetails! Full response:`, jsonobject);
                                }
                            } else if (flag === 2) {
                                console.log("📋 Bronze tables found:", jsonobject.bronzeDetails?.map(t => t.tablename));
                            } else if (flag === 4) {
                                console.log("📋 Gold tables found:", jsonobject.goldDetails?.map(t => t.tablename));
                            }
                            
                            // Log full GPT response for debugging
                            if (file.name.toLowerCase().includes('alleventraw') || file.name.toLowerCase().includes('all_events_raw_digital') || file.name.toLowerCase().includes('alleventsraw')) {
                                console.log(`🔍 DEBUGGING "${file.name}" - Full GPT response:`, JSON.stringify(jsonobject, null, 2));
                            }
                            
                            if (flag === 1) {
                                const updatedobj = jsonobject?.pipelines?.map(pipeline => ({
                                    ...pipeline,
                                    filepathname: file.webkitRelativePath
                                }));
                                jsonobject.pipelines = updatedobj;
                                console.log("Executing pipelines")

                                setPipelines(prevPipelines => {
                                    const combinedarray = [...prevPipelines, ...(jsonobject?.pipelines || [])];
                                    const uniquearray = combinedarray.filter((value, index, self) =>
                                        index === self.findIndex((t) => (
                                            t?.TableName === value?.TableName && t?.filepathname === value?.filepathname
                                        ))
                                    );
                                    // console.log("Final Mounts", uniquearray)
                                    axios.post(`${backend_url}/update-json/${10}`, uniquearray)
                                        .then((res) => {
                                            // console.log(`Status: ${res.status}`);
                                            // console.log('Body: ', res.data);
                                        }).catch((err) => {
                                            // console.error(err);
                                        });

                                    return uniquearray;
                                });
                            } else if (flag === 2) {

                                const updatedobj = jsonobject?.bronzeDetails?.map(bronze => ({
                                    ...bronze,
                                    filepathname: file.webkitRelativePath
                                }));
                                jsonobject.bronzeDetails = updatedobj;

                                // Merge any source-table column usage emitted by the Bronze prompt
                                // into the shared stagingtables store (same shape as Silver/Gold).
                                if (Array.isArray(jsonobject?.stagingtablesinfo) && jsonobject.stagingtablesinfo.length > 0) {
                                    setStagingTables(prevMounts => {
                                        const updatedMounts = [...prevMounts];
                                        jsonobject.stagingtablesinfo.forEach(rawTable => {
                                            const newTable = { ...rawTable, consumerLayer: 'Bronze' };
                                            const existingTableIndex = updatedMounts.findIndex(t => t.tablename === newTable.tablename && (t.consumerTable || '') === (newTable.consumerTable || '') && (t.consumerLayer || '') === (newTable.consumerLayer || ''));
                                            if (existingTableIndex !== -1) {
                                                const existingTable = updatedMounts[existingTableIndex];
                                                const mergedColumns = Array.from(new Set([
                                                    ...(existingTable.ColumnsUsed || []),
                                                    ...(newTable.ColumnsUsed || [])
                                                ]));
                                                updatedMounts[existingTableIndex] = {
                                                    ...existingTable,
                                                    ...newTable,
                                                    ColumnsUsed: mergedColumns
                                                };
                                            } else {
                                                updatedMounts.push(newTable);
                                            }
                                        });
                                        axios.post(`${backend_url}/update-json/${4}`, updatedMounts).catch(() => {});
                                        return updatedMounts;
                                    });
                                }

                                setBronzeDetails(prevBronze => {
                                    const combinedarray = [...prevBronze, ...(jsonobject?.bronzeDetails || [])];
                                    const uniquearray = combinedarray.filter((value, index, self) =>
                                        index === self.findIndex((t) => (
                                            t?.tablename === value?.tablename && t?.filepathname === value?.filepathname
                                        ))
                                    );
                                    // console.log("this is extraction", uniquearray)
                                    axios.post(`${backend_url}/update-json/${11}`, uniquearray)
                                        .then((res) => {
                                            // console.log(`Status: ${res.status}`);
                                            // console.log('Body: ', res.data);
                                        }).catch((err) => {
                                            // console.error(err);
                                        });

                                    return uniquearray;
                                });
                            } else if (flag === 3) {

                                const updatedobj = jsonobject?.silverDetails?.map(mount => ({
                                    ...mount,
                                    filepathname: file.webkitRelativePath
                                }));
                                jsonobject.silverDetails = updatedobj;
                                
                                console.log(`✅ SILVER: "${file.name}" → Tables: ${updatedobj?.map(t => t.tablename).join(', ') || 'NONE'}`);

                                setSilverDetails(prevMounts => {
                                    const combinedarray = [...prevMounts, ...(jsonobject?.silverDetails || [])];
                                    const uniquearray = combinedarray.filter((value, index, self) =>
                                        index === self.findIndex((t) => (
                                            t?.tablename === value?.tablename && t?.filepathname === value?.filepathname
                                        ))
                                    );
                                    console.log(`📊 Silver Layer now has ${uniquearray.length} tables:`, uniquearray.map(t => t.tablename));
                                    axios.post(`${backend_url}/update-json/${12}`, uniquearray)
                                        .then((res) => {
                                            // console.log(`Status: ${res.status}`);
                                            // console.log('Body: ', res.data);
                                        }).catch((err) => {
                                            // console.error(err);
                                        });
                                    return uniquearray;
                                });

                                setStagingTables(prevMounts => {
                                    const updatedMounts = [...prevMounts];

                                    (jsonobject?.stagingtablesinfo || []).forEach(rawTable => {
                                        const newTable = { ...rawTable, consumerLayer: 'Silver' };
                                        const existingTableIndex = updatedMounts.findIndex(t => t.tablename === newTable.tablename && (t.consumerTable || '') === (newTable.consumerTable || '') && (t.consumerLayer || '') === (newTable.consumerLayer || ''));

                                        if (existingTableIndex !== -1) {
                                            const existingTable = updatedMounts[existingTableIndex];
                                            const mergedColumns = Array.from(new Set([...(existingTable.ColumnsUsed || []), ...(newTable.ColumnsUsed || [])]));

                                            updatedMounts[existingTableIndex] = {
                                                ...existingTable,
                                                ColumnsUsed: mergedColumns
                                            };
                                        } else {
                                            updatedMounts.push(newTable);
                                        }
                                    });
                                    // console.log("Final Mounts", uniquearray)
                                    axios.post(`${backend_url}/update-json/${4}`, updatedMounts)
                                        .then((res) => {
                                            // console.log(`Status: ${res.status}`);
                                            // console.log('Body: ', res.data);
                                        }).catch((err) => {
                                            // console.error(err);
                                        });
                                    return updatedMounts;
                                });
                            }
                            else if (flag === 4) {

                                const updatedobj = jsonobject?.goldDetails?.map(mount => ({
                                    ...mount,
                                    filepathname: file.webkitRelativePath
                                }));
                                jsonobject.goldDetails = updatedobj;

                                setGoldDetails(prevMounts => {
                                    const combinedarray = [...prevMounts, ...(jsonobject?.goldDetails || [])];
                                    const uniquearray = combinedarray.filter((value, index, self) =>
                                        index === self.findIndex((t) => (
                                            t?.tablename === value?.tablename && t?.filepathname === value?.filepathname
                                        ))
                                    );
                                    // console.log("Final Mounts", uniquearray)
                                    axios.post(`${backend_url}/update-json/${13}`, uniquearray)
                                        .then((res) => {
                                            // console.log(`Status: ${res.status}`);
                                            // console.log('Body: ', res.data);
                                        }).catch((err) => {
                                            // console.error(err);
                                        });
                                    return uniquearray;
                                });

                                setStagingTables(prevMounts => {
                                    const updatedMounts = [...prevMounts];

                                    (jsonobject?.stagingtablesinfo || []).forEach(rawTable => {
                                        const newTable = { ...rawTable, consumerLayer: 'Gold' };
                                        const existingTableIndex = updatedMounts.findIndex(t => t.tablename === newTable.tablename && (t.consumerTable || '') === (newTable.consumerTable || '') && (t.consumerLayer || '') === (newTable.consumerLayer || ''));

                                        if (existingTableIndex !== -1) {
                                            const existingTable = updatedMounts[existingTableIndex];
                                            const mergedColumns = Array.from(new Set([
                                                ...(existingTable.ColumnsUsed || []),
                                                ...(newTable.ColumnsUsed || [])
                                            ]));
                                            updatedMounts[existingTableIndex] = {
                                                ...existingTable,
                                                ...newTable,
                                                ColumnsUsed: mergedColumns
                                            };
                                        } else {
                                            updatedMounts.push(newTable);
                                        }
                                    });
                                    // console.log("Final Mounts", uniquearray)
                                    axios.post(`${backend_url}/update-json/${4}`, updatedMounts)
                                        .then((res) => {
                                            // console.log(`Status: ${res.status}`);
                                            // console.log('Body: ', res.data);
                                        }).catch((err) => {
                                            // console.error(err);
                                        });
                                    return updatedMounts;
                                });
                            }
                            else if (flag === 5){
                                // console.log("Do Nothing")
                                setFilenotdetected(prevfiles => {
                                    const allfiles = [...prevfiles, file?.name];

                                    axios.post(`${backend_url}/update-json/${8}`, allfiles)
                                        .then((res) => {
                                            // console.log(`Status: ${res.status}`);
                                            // console.log('Body: ', res.data);
                                        }).catch((err) => {
                                            // console.error(err);
                                        });

                                    return allfiles
                                })

                            }
                        }

                        setFileprocess(prevfiles => {
                            const allfiles = [...prevfiles, file.name]

                            axios.post(`${backend_url}/update-json/${6}`, allfiles)
                                .then((res) => {
                                    // console.log(`Status: ${res.status}`);
                                    // console.log('Body: ', res.data);
                                }).catch((err) => {
                                    // console.error(err);
                                });

                            return allfiles
                        })

                        idx++;

                        if (files.length === idx || fileprocess.length + fileError.length === idx) {
                            setLoading(false)
                        }
                    } catch (err) {
                        console.error(`❌ ERROR processing file "${file.name}":`, err.message);
                        console.error("   Full error:", err);

                        setFileError(prevError => {
                            const newuniqueerror = [...prevError, { name: file.name, gptmessage: err.message, backenderror: result?.data }];
                            axios.post(`${backend_url}/update-json/${7}`, newuniqueerror)
                                .then((res) => {
                                    // console.log(`Status: ${res.status}`);
                                    // console.log('Body: ', res.data);
                                }).catch((err) => {
                                    // console.error(err);
                                });
                            return newuniqueerror
                        })

                        idx++;

                        if (files.length === idx || fileprocess.length + fileError.length === idx) {
                            setLoading(false)
                        }
                    }
                };

                await new Promise(resolve => setTimeout(resolve, 10000));
            }
        }
    }

    const downloaderrordetails = () => {
        const filename = "Error Details"
        const jsonStr = JSON.stringify(fileError, null, 2); // Pretty print
        const blob = new Blob([jsonStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);

        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        link.click();

        URL.revokeObjectURL(url);
    }

    useEffect(() => {
        const finaljson = {
            "Repos": {
                "OCPStaging_Digital": {
                    "Pipelines": pipelines,
                    "bronzeDetails": bronzeDetails,
                    "silverDetails": silverDetails,
                    "goldDetails": goldDetails,
                    "StagingTableColumns": stagingtables
                }
            }
        }

        console.log("THIS IS FINAL")
        // console.log(finaljson)
        console.log(JSON.stringify(finaljson))
    }, [loading])

    // const [finaldata, setFinaldata] = useState({ "Repos": {} })

    // const fetchdata = async () => {
    //     const response = await fetch('${backend_url}/api/data')
    //     console.log(response.data)

    //     setFinaldata(prev => ({
    //         ...prev,
    //         Repos: response.data
    //     }))
    // }

    // useEffect(() => {
    //     fetch('${backend_url}/api/data')
    //         .then((res) => res.json())
    //         .then((data) => {
    //             console.log(data)
    //             setFinaldata(prev => {
    //                 const final = {
    //                     ...prev,
    //                     "Repos": data
    //                 }

    //                 return final
    //             })
    //         })

    //     // console.log(JSON.stringify(finaldata))
    //     // console.log(finaldata)
    // }, [])

    const [selectedvalue, setSelectedValue] = useState({
        "Repo": ["OCPStaging_Digital"],
        "DatabaseName": [],
        "TableName": []
    })

    // Repo Explorer integration
    const [repoName, setRepoName] = useState('');
    const [saving, setSaving] = useState(false);
    const [saveMessage, setSaveMessage] = useState('');

    const canSaveToRepo = (() => {
        const account = getActiveAccount();
        const candidates = getAccountEmailCandidates(account);
        return candidates.some(email => ALLOWED_SAVE_EMAILS.includes(email));
    })();

    const saveToRepoExplorer = async () => {
        if (!canSaveToRepo) {
            setSaveMessage('You are not authorized to save to POSOT Data Explorer.');
            return;
        }
        if (!repoName.trim()) {
            setSaveMessage('Please enter a repo name.');
            return;
        }
        setSaving(true);
        setSaveMessage('');
        try {
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
            setSaveMessage(`Saved to POSOT Data Explorer as "${repoName.trim()}" successfully!`);
        } catch (err) {
            console.error('Error saving to repo:', err);
            const backendError = err?.response?.data?.error;
            setSaveMessage(backendError ? `Failed to save to database: ${backendError}` : 'Failed to save to database. Check backend logs.');
        }
        setSaving(false);
    };

    return (
        <div style={{ fontFamily: "Poppins, sans-serif" }}>
            <NavbarEnhanced pipelines={pipelines} bronzeDetails={bronzeDetails} silverDetails={silverDetails} goldDetails={goldDetails} stagingtables={stagingtables}  loading={loading}/>
            <div className='container'>

                <div className='main__container' style={{ display: 'flex', padding: '2rem', backgroundColor: '#f9f9f9', maxWidth: "80%" }}>
                    {/* Left Section */}
                    <div className='left__section' style={{ flex: 1, padding: '2rem', backgroundColor: '#ffffff', borderRadius: '12px', boxShadow: '0px 4px 20px rgba(0,0,0,0.1)' }}>
                        {/* <h1 style={{ fontSize: '2rem', fontWeight: 'bold', color: '#059bbf' }}>Databricks</h1> */}
                        <div style={{ marginTop: '0.5rem' }}>
                            <img src={DatabricksLogo} alt="Databricks Logo" style={{ width: '250px', display: "block", marginLeft: "auto", marginRight: "auto" }} />
                        </div>
                        <p style={{ marginTop: '1rem', fontSize: '1rem', lineHeight: '1.6', color: '#333' }}>
                            Our web application enables you to upload code files or folders and extract detailed information about lakehouses, warehouses, tables (bronze, silver and gold), notebooks, and pipelines for Microsoft Fabric.
                            With a simple 'Submit' click, your files are processed, or use the 'Chat' textfield to specify extraction needs. It's a comprehensive tool for managing and
                            understanding your Fabric workloads and migrating from Databricks to Fabric.
                        </p>
                    </div>

                    {/* Right Section */}
                    <div className='right__section' style={{ flex: 1, marginLeft: '2rem', padding: '2rem', backgroundColor: '#ffffff', borderRadius: '12px', boxShadow: '0px 4px 20px rgba(0,0,0,0.1)' }}>
                        <div>
                            <label style={{ fontSize: '1rem', fontWeight: '500' }}>Upload your files or folders</label><br />
                            <input
                                type="file"
                                multiple
                                onChange={handleFileChange}
                                className="fileInput"
                                webkitdirectory="true"
                                mozdirectory="true"
                                msdirectory="true"
                                odirectory="true"
                                directory="true"
                                style={{ margin: '1rem 0' }}
                            /><br />

                            <FormControlLabel
                                control={
                                    <Checkbox
                                        checked={checked}
                                        onChange={handleChange}
                                    />
                                }
                                label="Do you want to specify additional extraction needs?"
                            />

                            {checked && (
                                <TextField
                                    onChange={handleMessageChange}
                                    value={usermessage}
                                    fullWidth
                                    id="outlined-basic"
                                    label="Message"
                                    variant="outlined"
                                    style={{ margin: '1.5rem 0', width: '100%' }}
                                />
                            )}

                            <Typography variant="h6" style={{ marginTop: '1rem', fontWeight: '600' }}>
                                Azure Open AI Details
                            </Typography>
                            {/* New Fields */}
                            <TextField
                                label="Deployment Endpoint"
                                variant="outlined"
                                fullWidth
                                value={deploymentEndpoint}
                                onChange={(e) => setDeploymentEndpoint(e.target.value)}
                                style={{ margin: '1rem 0' }}
                            />
                            <TextField
                                label="Model Name"
                                variant="outlined"
                                fullWidth
                                value={modelName}
                                onChange={(e) => setModelName(e.target.value)}
                                style={{ margin: '1rem 0' }}
                            />
                            <TextField
                                label="API Key"
                                variant="outlined"
                                fullWidth
                                type="password"
                                value={apiKey}
                                onChange={(e) => setApiKey(e.target.value)}
                                style={{ margin: '1rem 0' }}
                            />


                            <button
                                onClick={handleSubmit}
                                className='submitButton'
                                 disabled={
                                    files.length === 0 
                                    // ||
                                    // deploymentEndpoint === '' ||
                                    // modelName === '' ||
                                    // apiKey === ''
                                }
                                style={{
                                    marginTop: '1rem',
                                    padding: '0.75rem 1.5rem',
                                    backgroundColor: '#059bbf',
                                    color: '#fff',
                                    border: 'none',
                                    borderRadius: '6px',
                                    // cursor: files.length === 0 || deploymentEndpoint === '' || modelName === '' || apiKey === '' ? 'not-allowed' : 'pointer',
                                    fontWeight: 'bold',
                                    fontSize: '1rem'
                                }}
                            >
                                Submit
                            </button>
                            {
                                fileError.length != 0 ?
                                    <button onClick={downloaderrordetails} style={{
                                        marginTop: '1rem',
                                        padding: '0.75rem 1.5rem',
                                        backgroundColor: '#d32f2f',
                                        color: '#fff',
                                        border: 'none',
                                        borderRadius: '6px',
                                        cursor: 'pointer',
                                        fontWeight: 'bold',
                                        fontSize: '1rem',
                                    }}>
                                        Download Error Details
                                    </button>

                                    : <></>
                            }
                            <Dialog open={open} onClose={handleClose}>
                                <DialogTitle>{"Title: Free Open AI version quota exceeded."}</DialogTitle>
                                <DialogContent>
                                    <DialogContentText>
                                        You can upload a maximum of 20 files.
                                    </DialogContentText>
                                    <DialogContentText>
                                        If you want to analyze more than that, please reach out to Azmal Shaikh or Urja Gandhi. Additionally, please create an Azure OpenAI service and set up a deployment with the following configuration:

                                        Model: gpt-4 and Model Version: 0125-Preview
                                    </DialogContentText>
                                </DialogContent>
                                <DialogActions>
                                    <Button onClick={handleClose} color="primary">
                                        OK
                                    </Button>
                                </DialogActions>
                            </Dialog>
                        </div>
                    </div>
                </div>

                <Backdrop
                    sx={{ color: '#fff', zIndex: (theme) => theme.zIndex.drawer + 1 }}
                    open={loading}
                >
                    <Box sx={{ width: '350px', color: '#fff', textAlign: 'center' }}>
                        <Typography variant="h6" sx={{ mb: 2 }}>
                            Processing Files...
                        </Typography>

                        <LinearProgress variant="determinate" value={((fileprocess.length + fileError.length) / files.length) * 100} sx={{ height: 10, borderRadius: 6, mb: 2, '& .MuiLinearProgress-bar': { backgroundColor: '#059bbf', } }} />

                        <Typography variant="body2" sx={{ mt: 2 }}>
                            {fileprocess.length + fileError.length} of {files.length} processed
                        </Typography>

                        <Stack direction="row" justifyContent="space-between">
                            <Typography variant="body2">✅ Success: {fileprocess.length}</Typography>
                            <Typography variant="body2">❌ Errors: {fileError.length}</Typography>
                            <Typography variant="body2">⚠️ Not Detected: {filenotdetected.length}</Typography>
                        </Stack>
                    </Box>
                </Backdrop>

                {/* Tabs showing extracted data - shown after processing is complete */}
                {
                    hasProcessed && !loading && (pipelines.length > 0 || bronzeDetails.length > 0 || silverDetails.length > 0 || goldDetails.length > 0 || stagingtables.length > 0) ?
                        <>
                        <div style={{ width: "80%", marginTop: "3rem" }}>
                            <TabsFabricEnhanced 
                                pipelines={pipelines} 
                                bronzeDetails={bronzeDetails} 
                                silverDetails={silverDetails} 
                                goldDetails={goldDetails} 
                                stagingtables={stagingtables} 
                            />
                        </div>
                        <Box sx={{ width: '80%', mt: 3, p: 3, backgroundColor: '#fff', borderRadius: '12px', boxShadow: '0px 4px 20px rgba(0,0,0,0.1)' }}>
                            <Typography variant="h6" sx={{ fontWeight: 600, mb: 2, color: '#059bbf' }}>Save to POSOT Data Explorer</Typography>
                            <Typography variant="body2" sx={{ color: '#666', mb: 2 }}>
                                Save the processed data to the database so it can be viewed in POSOT Data Explorer.
                            </Typography>
                            <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
                                <TextField
                                    label="Repo Name"
                                    variant="outlined"
                                    size="small"
                                    value={repoName}
                                    onChange={(e) => setRepoName(e.target.value)}
                                    sx={{ minWidth: 300 }}
                                    placeholder="e.g. MyProject_Digital"
                                />
                                <Button
                                    variant="contained"
                                    onClick={saveToRepoExplorer}
                                    disabled={saving || !repoName.trim() || !canSaveToRepo}
                                    sx={{ backgroundColor: '#059bbf', '&:hover': { backgroundColor: '#048aa8' }, textTransform: 'none', fontWeight: 600 }}
                                >
                                    {saving ? 'Saving...' : 'Save to POSOT Data Explorer'}
                                </Button>
                                {!canSaveToRepo && (
                                    <Typography variant="body2" sx={{ color: 'red', ml: 1 }}>
                                        You are not authorized to save.
                                    </Typography>
                                )}
                            </Box>
                            {saveMessage && (
                                <Typography variant="body2" sx={{ mt: 1, color: saveMessage.includes('successfully') ? 'green' : 'red' }}>
                                    {saveMessage}
                                </Typography>
                            )}
                        </Box>
                        </>
                        : null
                }

                {/* {
                    (extractedtables.length !== 0 || staticcreated.databasecreated.length !== 0 || staticcreated.tablescreated.length !== 0 || marttables.length !== 0) && !loading ?

                        <>
                            <div style={{ width: "80%", marginTop: "3rem" }}>
                                <TabsC mounts={mounts} extractedtables={extractedtables} staticcreated={staticcreated} marttables={marttables} />
                            </div>
                        </>
                        :
                        <></>
                } */}

                {
                    checked && !loading && messageResponse.length != 0 ?
                        <><p style={{ width: "60%", fontSize: "20px" }}><span style={{ fontSize: "2rem", display: "block" }}>Extraction Details --</span><br></br>
                            {messageResponse.map((message, index) => (
                                <div key={index}>
                                    <p style={{ width: "100%", fontSize: "24px", fontWeight: "600", marginBottom: "0px" }}>File Name - {message.fileName}</p>
                                    <p style={{ marginTop: "5px" }}>{message.explaintext}</p>
                                    {message.code != "" ?
                                        <p style={{
                                            background: '#1e1e1e',
                                            color: '#d4d4d4',
                                            padding: '20px',
                                            borderRadius: '5px',
                                            fontSize: '14px',
                                            lineHeight: '1.5',
                                            fontFamily: 'Menlo, Monaco, "Courier New", monospace',
                                            overflowX: 'auto',
                                            boxShadow: '0 2px 4px #059bbf',
                                            borderLeft: '3px solid #059bbf',
                                            margin: '20px 0'
                                        }}>
                                            <code className={`language-${message.code.language}`}>
                                                {message.code}
                                            </code>
                                        </p> : <></>
                                    }
                                </div>
                            ))}
                        </p></>
                        : <></>
                }
                {/* <TableDetails /> */}

                {/* {Object.entries(finaldata.Repos).map(([repoName, repoData]) => (
                    <div key={repoName}>
                        <h2>{repoName}</h2>
                        <h3>StaticCreated</h3>
                        <p>Database Created: {repoData.StaticCreated.databasecreated.length}</p>
                        <h3>ExtractedTables</h3>
                        <p>Count: {repoData.ExtractedTables.length}</p>
                    </div>
                ))} */}

                {/* {
                    finaldata?.Repos != null ?
                        <div className='container__details'>
                            <div className='container__detailsFilters'>
                                <p style={{ fontSize: "2rem", marginBottom: "0px", display: "block", alignItems: "center", fontWeight: "bold" }}>Filters</p>
                                <CheckBox
                                    className='container__detailsSelect'
                                    data={Object.keys(finaldata?.Repos)}
                                    selectedValue={selectedvalue.Repo}
                                    setSelectedValue={(value) => setSelectedValue(prev => ({ ...prev, Repo: value }))}
                                    label="Repository"
                                    multiple={false}
                                />
                                <CheckBox
                                    className='container__detailsSelect'
                                    data={[...new Set(Object.values(finaldata?.Repos).flatMap(repo => repo.StaticCreated.databasecreated))]}
                                    selectedValue={selectedvalue.DatabaseName}
                                    setSelectedValue={(value) => setSelectedValue(prev => ({ ...prev, DatabaseName: value }))}
                                    label="Database"
                                />
                                <CheckBox
                                    className='container__detailsSelect'
                                    data={[...new Set(Object.values(finaldata?.Repos).flatMap(repo => [...(repo.StaticCreated.TablesCreated || []), ...(repo.ExtractedTables.map(table => table.tablename) || []), ...(repo.MartTables.map(table => table.tablename) || [])]))]}
                                    selectedValue={selectedvalue.TableName}
                                    setSelectedValue={(value) => setSelectedValue(prev => ({ ...prev, TableName: value }))}
                                    label="Table"
                                />
                            </div>

                            <div className='container__detailsData'>
                                <TabsC mounts={finaldata["Repos"]["OCPStaging_Digital"]["Mounts"]} extractedtables={finaldata["Repos"]["OCPStaging_Digital"]["ExtractedTables"]} staticcreated={finaldata["Repos"]["OCPStaging_Digital"]["StaticCreated"]} marttables={finaldata["Repos"]["OCPStaging_Digital"]["MartTables"]} />
                            </div>
                        </div>

                        : <></>
                }  */}

                <div style={{ display: 'flex', gap: '2rem', marginTop: '2rem', width: "auto" }}>
                    {/* Left Section: Instructions */}
                    <div style={{ flex: 1 }}>
                        <h2 style={{ marginBottom: '2rem', color: '#059bbf', textAlign: "center" }}>How to Use</h2>
                        <img src={HowTo1} alt="How To Use" className='container_howToImage' />
                    </div>

                    {/* Right Section: Video */}
                    {/* <div style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                        <video
                            width="100%"
                            height="315"
                            controls
                            style={{ borderRadius: '8px', boxShadow: '0px 4px 12px rgba(0,0,0,0.1)' }}
                        >
                            <source src={HowToUse} type="video/mp4" />
                            Your browser does not support the video tag.
                        </video>
                    </div> */}
                </div>

                <div style={{ maxWidth: '80%', marginTop: '2.5rem', width: '100%' }}>
                    <Typography variant="h5" sx={{ fontWeight: 700, color: '#1a1a2e', mb: 0.5, textAlign: 'center' }}>
                        Tab Details
                    </Typography>
                    <Typography variant="body2" sx={{ color: '#888', mb: 3, textAlign: 'center' }}>
                        After processing, your analysis results are organized into the following tabs
                    </Typography>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1.25rem' }}>

                        {/* Pipeline Details */}
                        <div style={{ backgroundColor: '#fff', borderRadius: '10px', border: '1px solid #e5e7eb', padding: '1.5rem', borderLeft: '4px solid #3b82f6' }}>
                            <Typography variant="subtitle1" sx={{ fontWeight: 700, color: '#1e293b', mb: 1 }}>
                                Pipeline Details
                            </Typography>
                            <Typography variant="body2" sx={{ color: '#555', lineHeight: 1.7, mb: 1.5 }}>
                                Displays data pipeline activities that extract data from external sources and load it to destinations.
                            </Typography>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                {['Table name being extracted or loaded', 'Source file path or storage path', 'SQL connection details (if applicable)', 'Source description and dump location', 'Columns involved in the extraction'].map((item, i) => (
                                    <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                                        <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#3b82f6', marginTop: '7px', flexShrink: 0 }} />
                                        <Typography variant="body2" sx={{ color: '#666', fontSize: '0.82rem' }}>{item}</Typography>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Bronze Layer */}
                        <div style={{ backgroundColor: '#fff', borderRadius: '10px', border: '1px solid #e5e7eb', padding: '1.5rem', borderLeft: '4px solid #cd7f32' }}>
                            <Typography variant="subtitle1" sx={{ fontWeight: 700, color: '#1e293b', mb: 1 }}>
                                Bronze Layer
                            </Typography>
                            <Typography variant="body2" sx={{ color: '#555', lineHeight: 1.7, mb: 1.5 }}>
                                Lists tables and views that ingest raw data from external sources (Blob Storage, Parquet, SQL Server, Excel, CSV, Delta, APIs) into the first layer of the lakehouse with minimal transformation.
                            </Typography>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                {['Table or view name', 'Schema / lakehouse dump path', 'Extraction source description', 'Source tables used (if derived from other tables)'].map((item, i) => (
                                    <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                                        <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#cd7f32', marginTop: '7px', flexShrink: 0 }} />
                                        <Typography variant="body2" sx={{ color: '#666', fontSize: '0.82rem' }}>{item}</Typography>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Silver Layer */}
                        <div style={{ backgroundColor: '#fff', borderRadius: '10px', border: '1px solid #e5e7eb', padding: '1.5rem', borderLeft: '4px solid #78909c' }}>
                            <Typography variant="subtitle1" sx={{ fontWeight: 700, color: '#1e293b', mb: 1 }}>
                                Silver Layer
                            </Typography>
                            <Typography variant="body2" sx={{ color: '#555', lineHeight: 1.7, mb: 1.5 }}>
                                Shows tables and views that transform and cleanse bronze-layer data into curated outputs using joins, filters, aggregations, or business logic.
                            </Typography>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                {['Table or view name', 'Schema / lakehouse dump path', 'Source tables used in the transformation', 'Columns used from each source table'].map((item, i) => (
                                    <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                                        <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#78909c', marginTop: '7px', flexShrink: 0 }} />
                                        <Typography variant="body2" sx={{ color: '#666', fontSize: '0.82rem' }}>{item}</Typography>
                                    </div>
                                ))}
                            </div>
                        </div>

                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1.25rem', marginTop: '1.25rem', maxWidth: '66.67%', margin: '1.25rem auto 0' }}>

                        {/* Gold Layer */}
                        <div style={{ backgroundColor: '#fff', borderRadius: '10px', border: '1px solid #e5e7eb', padding: '1.5rem', borderLeft: '4px solid #d4a017' }}>
                            <Typography variant="subtitle1" sx={{ fontWeight: 700, color: '#1e293b', mb: 1 }}>
                                Gold Layer
                            </Typography>
                            <Typography variant="body2" sx={{ color: '#555', lineHeight: 1.7, mb: 1.5 }}>
                                Displays final consumption-ready tables and views built from silver and bronze layer data for reporting and analytics.
                            </Typography>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                {['Table or view name', 'Schema / lakehouse dump path', 'Source tables used in the creation', 'Columns used from each source table'].map((item, i) => (
                                    <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                                        <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#d4a017', marginTop: '7px', flexShrink: 0 }} />
                                        <Typography variant="body2" sx={{ color: '#666', fontSize: '0.82rem' }}>{item}</Typography>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Column-Level Details */}
                        <div style={{ backgroundColor: '#fff', borderRadius: '10px', border: '1px solid #e5e7eb', padding: '1.5rem', borderLeft: '4px solid #7c3aed' }}>
                            <Typography variant="subtitle1" sx={{ fontWeight: 700, color: '#1e293b', mb: 1 }}>
                                Column-Level Details
                            </Typography>
                            <Typography variant="body2" sx={{ color: '#555', lineHeight: 1.7 }}>
                                Provides a detailed schema-level view showing all columns used from each source table across the uploaded files. This covers columns referenced in SELECT, JOIN, WHERE, GROUP BY, and other SQL clauses, giving you full visibility into column-level lineage and dependencies.
                            </Typography>
                        </div>

                    </div>
                </div>
            </div>

            {/* <OutputView /> */}

            {/* <Hello /> */}
            <div style={{ height: '4rem' }} />
        </div>
    )
}

export default Fabric
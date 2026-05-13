import React, { useEffect, useState } from 'react'
import { OpenAIClient, AzureKeyCredential } from '@azure/openai'
import "./Analyze.css"
import Navbar from './Navbar';
import TabsC from './TabsC';
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


function Fabric() {

    // const endpoint = process.env.REACT_APP_AZURE_OPENAI_ENDPOINT;
    // const apiKey = process.env.REACT_APP_AZURE_OPENAI_API_KEY;
    // const model = process.env.REACT_APP_AZURE_OPENAI_MODEL;
    const backend_url = process.env.REACT_APP_API_BASE_URL;

    const [files, setFiles] = useState([]);
    const [open, setOpen] = useState(false);

    const handleFileChange = (event) => {
        const selectedFiles = [...event.target.files];
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

    const [usermessage, setUserMessage] = useState("");

    const [messageResponse, setMessageResponse] = useState([]);

    const [checked, setChecked] = useState(false);

    const [fileprocess, setFileprocess] = useState([]);
    const [fileError, setFileError] = useState([]);
    const [filenotdetected, setFilenotdetected] = useState([]);

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

        setLoading(true);
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
                console.log(file.webkitRelativePath);
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
                        const prompt = reader.result + `\n\n` + `You are a code analysis engine for a Medallion Architecture (Bronze/Silver/Gold) data platform. Your task is to classify the above file into exactly ONE of the following categories, then return a single JSON object (not an array) with the structured information described for that category.

                        === CLASSIFICATION RULES ===

                        STEP 1 — Check the file name first:
                        - If the file name contains "Bronze" (case-insensitive), classify as Category 2 (Bronze Layer).
                        - If the file name contains "Silver" (case-insensitive), classify as Category 3 (Silver Layer).
                        - If the file name contains "Gold" (case-insensitive), classify as Category 4 (Gold Layer).

                        STEP 2 — If the file name does not match any layer keyword, analyze the file content:

                        Category 1 — Pipeline File:
                            A data pipeline definition file (e.g., JSON pipeline config, ADF pipeline, Fabric pipeline). It defines data movement activities that extract data from sources and load it to destinations. Only classify as pipeline if the file is a pipeline definition — not a notebook.

                        Category 2 — Bronze Layer File:
                            A file that extracts or ingests raw data from external sources (Blob Storage, Parquet, SQL Server, Excel, CSV, Delta, APIs, etc.) into the first layer of the lakehouse. Typically uses spark.read, COPY INTO, getDataframe(), readexceltodf(), OPENROWSET, or similar ingestion functions. Data is loaded with minimal transformation.

                        Category 3 — Silver Layer File:
                            A file that transforms and cleanses bronze-layer data into curated tables/views. Creates tables or temporary views from other tables/views using joins, filters, aggregations, or business logic. Uses operations like CREATE TABLE, SELECT INTO, createOrReplaceTempView, DataFrame transformations, or SQL queries that read from bronze/silver tables and produce refined outputs.

                        Category 4 — Gold Layer File:
                            A file that creates final consumption-ready views or tables from silver/bronze layer data. These are business-level aggregations, reporting views, or analytics-ready datasets. May also use createOrReplaceTempView, writeTable(), or similar functions to persist outputs to a lakehouse schema.

                        Category 5 — None of the Above:
                            The file does not match any of the above categories.

                        === GLOBAL RULES (apply to ALL categories) ===

                        1. QUOTE ALL VALUES: Every string value in the JSON output must be enclosed in double quotes. Array values must be arrays of quoted strings. The "identifier" field must be an integer (not a string).
                        2. TABLE NAME FORMAT: The writeTable() function signature is writeTable(viewName, path, ...). ALWAYS extract the table name from the SECOND argument (the path), NOT the first argument (the view name). Take the part after the last "/" in the second argument. Examples:
                           - writeTable("All_Events_Raw_Historical_Intermediate", f"{SilverPublishSchema}/All_Events_Raw_Historical", ...) → tablename = "All_Events_Raw_Historical"
                           - writeTable("Silver_DimTime", f"{SilverPublishSchema}/DimTime", ...) → tablename = "DimTime"
                           - writeTable("Silver_DimTime", "Silver/DimTime", ...) → tablename = "DimTime"
                           NEVER use the first argument as the table name. If there is no writeTable() call, use the createOrReplaceTempView name but strip any layer prefix (Bronze_, Silver_, Gold_).
                        3. SCHEMA RESOLUTION: When a schema/dump location is determined by a function call (e.g., writeTable()), extract the schema path from that function's arguments. IMPORTANT: If there are multiple writeTable() calls for the same table, ALWAYS prefer the one using an f-string (f"...") or variable-based path (e.g., f"{SilverPublishSchema}/DimTime") over a hardcoded string path (e.g., "Silver/DimTime"). Resolve the variable name but keep it in the output (e.g., "SilverPublishSchema/DimTime").
                        4. FUNCTION NAMES: When referencing tables loaded via helper functions (getDataframe(), readexceltodf(), spark.read, etc.), use ONLY the table name — NOT the full function call syntax.
                        5. COMPLETENESS: Do NOT skip any table, view, DataFrame, or temporary view. Include everything, even if it is later dropped, renamed, or not persisted. If you cannot determine the schema, set SchemaDump to "null" but still include the entry.
                        6. Return ONLY the JSON object. No markdown code fences, no explanation, no text outside the JSON.

                        === OUTPUT FORMAT BY CATEGORY ===

                        --- CATEGORY 1: Pipeline File ---
                        Extract details only for pipeline activities that perform data extraction (copy activities, data movement). Skip activities that do not extract data (e.g., control flow, notifications, logging).
                        If you cannot determine both the table name AND the source, skip that pipeline activity entirely.

                        For each data extraction activity, provide:
                        - "TableName": The name of the table being extracted or loaded.
                        - "Path": The source file path or storage path (if applicable).
                        - "SQLCOnnection": The SQL Server connection string or server details (if applicable, otherwise "").
                        - "SourceDetails": Description of the data source (e.g., "Azure SQL Database", "Blob Storage CSV", "Parquet file").
                        - "DumpLocation": Where the extracted data is written/dumped to.
                        - "Columns": Array of column names involved in the extraction (if identifiable from the pipeline definition).
                        {
                        "identifier": 1,
                        "pipelines": [
                            {
                            "TableName": "<table_name>",
                            "Path": "<source_path>",
                            "SQLCOnnection": "<connection_details>",
                            "SourceDetails": "<source_description>",
                            "DumpLocation": "<destination_path>",
                            "Columns": ["<col1>", "<col2>"]
                            }
                        ]
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
                        {
                        "identifier": 2,
                        "bronzeDetails": [
                            {
                            "tablename": "<table_or_view_name>",
                            "SchemaDump": "<schema_dump_path_or_null>",
                            "Source": "<source_description>",
                            "TableUsed": ["<source_table1>", "<source_table2>"]
                            }
                        ]
                        }

                        --- CATEGORY 3: Silver Layer File ---
                        Step-by-step instructions:
                        1. Scan the ENTIRE file for ALL tables, views, and DataFrames created. Include:
                        - Tables created via CREATE TABLE, SELECT INTO, INSERT INTO, ALTER TABLE, RENAME TO
                        - Temporary views created via createOrReplaceTempView(), spark.sql("CREATE OR REPLACE TEMPORARY VIEW ..."), or any SQL view creation
                        - DataFrame variables that are assigned the result of transformations (joins, filters, aggregations, etc.)
                        - Views that are NOT dumped/persisted — include them too
                        2. For each table/view/DataFrame found, provide all fields below. For "tablename": use the SECOND argument of writeTable() (the path), take the part after the last "/". Example: writeTable("All_Events_Raw_Historical_Intermediate", f"{SilverPublishSchema}/All_Events_Raw_Historical", ...) → tablename = "All_Events_Raw_Historical". NEVER use the first argument. If no writeTable() exists, use the createOrReplaceTempView name but strip any layer prefix (Bronze_, Silver_, Gold_). For SchemaDump, if the table has a writeTable() call with an f-string path, use that variable-based path (e.g., "SilverPublishSchema/All_Events_Raw_Historical") — do NOT use a hardcoded fallback.
                        3. For "Tablesused": List ONLY actual persisted tables (loaded via getDataframe(), readexceltodf(), spark.read, or similar) that are referenced in the creation of this table. Use the exact path as it appears in the code with "/" separator (e.g., "Bronze/DimTime", "Bronze/All_Events_Raw"). Do NOT include temporary views (created via createOrReplaceTempView) — trace through them to find the underlying real tables instead.
                        4. For "ColumnUsed": List EVERY SINGLE column name used in the final output of this table/view. This means every column in the final SELECT statement that produces the table — even if there are 50, 100, or more columns. Do NOT truncate, summarize, or skip any columns. Use original column names — do NOT include aliases. If a SELECT * is used, list all columns from the source tables. Count your columns and verify the count matches what the code produces.

                        Additionally, populate "stagingtablesinfo" for tables loaded via helper functions (getDataframe(), readexceltodf(), spark.read, etc.):
                        - "tablename": The table name (include schema/database prefix if known). Do NOT include the function call — just the table name.
                        - "ColumnsUsed": ALL columns used from this staging table across the entire file (in SELECT, JOIN ON, WHERE, GROUP BY, ORDER BY, HAVING, filter conditions, etc.). Never leave this empty — analyze the SQL/DataFrame operations carefully.
                        {
                        "identifier": 3,
                        "silverDetails": [
                            {
                            "tablename": "<table_or_view_name>",
                            "SchemaDump": "<schema_dump_path_or_null>",
                            "Tablesused": ["<schema.source_table1>", "<schema.source_table2>"],
                            "ColumnUsed": ["<col1>", "<col2>"]
                            }
                        ],
                        "stagingtablesinfo": [
                            {
                            "tablename": "<schema.table_name>",
                            "ColumnsUsed": ["<col1>", "<col2>"]
                            }
                        ]
                        }

                        --- CATEGORY 4: Gold Layer File ---
                        Step-by-step instructions:
                        1. Scan the ENTIRE file for ALL tables, views, and DataFrames created. Include:
                        - Tables created via CREATE TABLE, SELECT INTO, INSERT INTO, ALTER TABLE, RENAME TO
                        - Temporary views created via createOrReplaceTempView(), spark.sql("CREATE OR REPLACE TEMPORARY VIEW ..."), or any SQL view creation
                        - DataFrame variables that are assigned the result of transformations
                        - Views that are NOT dumped/persisted — include them too (set SchemaDump to "null")
                        2. For each table/view/DataFrame, provide all fields. For "tablename": use the SECOND argument of writeTable() (the path), take the part after the last "/". Example: writeTable("Gold_Report", f"{GoldSchema}/Report", ...) → tablename = "Report". NEVER use the first argument. If no writeTable() exists, use the createOrReplaceTempView name but strip any layer prefix (Bronze_, Silver_, Gold_). If schema cannot be determined, set SchemaDump to "null" but still include the entry.
                        3. SCHEMA FROM writeTable: If a temporary view is persisted using writeTable() or a similar function, extract the lakehouse schema path from that function call and use it as the SchemaDump value. If there are multiple writeTable() calls for the same table, ALWAYS prefer the f-string (f"...") or variable-based path over a hardcoded string path.
                        4. For "Tablesused": List ONLY actual persisted tables (loaded via getDataframe(), readexceltodf(), spark.read, or similar) that are referenced in the creation of this table. Use the exact path as it appears in the code with "/" separator (e.g., "Silver/DimTime"). Do NOT include temporary views (created via createOrReplaceTempView) — trace through them to find the underlying real tables instead.
                        5. For "ColumnUsed": List EVERY SINGLE column name used in the final output of this table/view. This means every column in the final SELECT statement — even if there are 50, 100, or more columns. Do NOT truncate, summarize, or skip any columns. Use original column names — no aliases. If a SELECT * is used, list all columns from the source tables. Count your columns and verify the count matches what the code produces.

                        Additionally, populate "stagingtablesinfo" for tables loaded via helper functions (getDataframe(), readexceltodf(), spark.read, etc.):
                        - "tablename": The table name only (with schema prefix if known). Do NOT include function call syntax.
                        - "ColumnsUsed": ALL columns used from this table across the entire file. Never leave this empty.
                        {
                        "identifier": 4,
                        "goldDetails": [
                            {
                            "tablename": "<table_or_view_name>",
                            "SchemaDump": "<schema_dump_path_or_null>",
                            "Tablesused": ["<schema.source_table1>", "<schema.source_table2>"],
                            "ColumnUsed": ["<col1>", "<col2>"]
                            }
                        ],
                        "stagingtablesinfo": [
                            {
                            "tablename": "<schema.table_name>",
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
                        - All other values must be quoted strings. Arrays must be arrays of quoted strings.
                        - Do NOT wrap the JSON in markdown code fences or add any text outside the JSON.
                        - Be EXHAUSTIVE: include every table, view, DataFrame, and temporary view in the file — even those that are not persisted, are dropped, or are intermediate.
                        - If SchemaDump is unknown, use "null" (as a string) — do NOT omit the entry.
                        - For stagingtablesinfo, ensure every ColumnsUsed array is populated. Analyze all SQL and DataFrame operations referencing that table.
                        - CRITICAL — COLUMN COMPLETENESS: You MUST list EVERY column in the "ColumnUsed" and "ColumnsUsed" arrays. Do NOT stop at 10 or 15 columns. If a final SELECT produces 78 columns, all 78 must appear. Scan every SELECT, withColumn, alias, JOIN ON, WHERE, GROUP BY, and ORDER BY in the entire file. Truncating or omitting columns is a failure.
                        `

                        result = await axios.post(`${backend_url}/call-gpt`, { content: prompt, endpoint: deploymentEndpoint, model: modelName, key: apiKey });

                        // console.log("this is result", result)
                        for (const choice of result.data.choices) {
                            console.log(file.name)
                            console.log("this is gptresponse", choice.message.content)

                            const jsonobject = JSON.parse(choice.message.content.replace(/^```json\n/, '').replace(/\n```$/, ''))
                            // console.log(jsonobject)

                            // const flag = 1;
                            const flag = jsonobject.identifier;
                            console.log(flag) 
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

                                setSilverDetails(prevMounts => {
                                    const combinedarray = [...prevMounts, ...(jsonobject?.silverDetails || [])];
                                    const uniquearray = combinedarray.filter((value, index, self) =>
                                        index === self.findIndex((t) => (
                                            t?.tablename === value?.tablename && t?.filepathname === value?.filepathname
                                        ))
                                    );
                                    // console.log("Final Mounts", uniquearray)
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

                                    jsonobject?.stagingtablesinfo.forEach(newTable => {
                                        const existingTableIndex = updatedMounts.findIndex(t => t.tablename === newTable.tablename);

                                        if (existingTableIndex !== -1) {
                                            const existingTable = updatedMounts[existingTableIndex];
                                            const mergedColumns = Array.from(new Set([...existingTable.ColumnsUsed, ...newTable.ColumnsUsed]));

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
                                    const combinedarray = [...prevMounts, ...jsonobject?.goldDetails];
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

                                    jsonobject?.stagingtablesinfo.forEach(newTable => {
                                        const existingTableIndex = updatedMounts.findIndex(t => t.tablename === newTable.tablename);

                                        if (existingTableIndex !== -1) {
                                            updatedMounts[existingTableIndex] = {
                                                ...updatedMounts[existingTableIndex],
                                                ...newTable
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
                            Our web application enables you to upload code files or folders and extract detailed information about databases, tables (static, staging and mart), and mounts.
                            With a simple 'Submit' click, your files are processed, or use the 'Chat' textfield to specify extraction needs. It's a comprehensive tool for managing and
                            understanding your coding environment.
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

                <div className='container__box' style={{ gap: '2rem', marginTop: '2rem', textAlign: "left" }}>
                    <h1>Tab Details</h1>
                    <div className="tab-details-content" style={{ marginTop: "1rem" }}>
                        <ul style={{ listStyleType: 'none', paddingLeft: 0 }}>
                            <li style={{ marginBottom: "1rem" }}>
                                <strong>1. Pipeline Details:</strong><br />
                                Displays data pipeline activities that extract data from external sources and load it to destinations. For each activity, it includes:
                                <ul style={{ listStyleType: 'disc', paddingLeft: "1.5rem" }}>
                                    <li>Table name being extracted or loaded</li>
                                    <li>Source file path or storage path</li>
                                    <li>SQL connection details (if applicable)</li>
                                    <li>Source description and dump location</li>
                                    <li>Columns involved in the extraction</li>
                                </ul>
                            </li>

                            <li style={{ marginBottom: "1rem" }}>
                                <strong>2. Bronze Layer:</strong><br />
                                Lists tables and views that ingest raw data from external sources (Blob Storage, Parquet, SQL Server, Excel, CSV, Delta, APIs, etc.) into the first layer of the lakehouse with minimal transformation. For each entry, it includes:
                                <ul style={{ listStyleType: 'disc', paddingLeft: "1.5rem" }}>
                                    <li>Table or view name</li>
                                    <li>Schema/lakehouse dump path</li>
                                    <li>Extraction source description</li>
                                    <li>Source tables used (if derived from other tables)</li>
                                </ul>
                            </li>

                            <li style={{ marginBottom: "1rem" }}>
                                <strong>3. Silver Layer:</strong><br />
                                Shows tables and views that transform and cleanse bronze-layer data into curated outputs using joins, filters, aggregations, or business logic. For each entry, it includes:
                                <ul style={{ listStyleType: 'disc', paddingLeft: "1.5rem" }}>
                                    <li>Table or view name</li>
                                    <li>Schema/lakehouse dump path</li>
                                    <li>Source tables used in the transformation</li>
                                    <li>Columns used from each source table</li>
                                </ul>
                            </li>

                            <li style={{ marginBottom: "1rem" }}>
                                <strong>4. Gold Layer:</strong><br />
                                Displays final consumption-ready tables and views built from silver/bronze layer data for reporting and analytics. For each entry, it includes:
                                <ul style={{ listStyleType: 'disc', paddingLeft: "1.5rem" }}>
                                    <li>Table or view name</li>
                                    <li>Schema/lakehouse dump path</li>
                                    <li>Source tables used in the creation</li>
                                    <li>Columns used from each source table</li>
                                </ul>
                            </li>

                            <li style={{ marginBottom: "1rem" }}>
                                <strong>5. Column-Level Details:</strong><br />
                                Provides a detailed schema-level view showing all columns used from each source table across the uploaded files — covering SELECT, JOIN, WHERE, GROUP BY, and other SQL clauses.
                            </li>
                        </ul>
                    </div>
                </div>

            </div>

            {/* <OutputView /> */}

            {/* <Hello /> */}
        </div>
    )
}

export default Fabric
import React, { useEffect, useState } from 'react'
import { saveAs } from 'file-saver';
import JSZip from 'jszip';
import "./Analyze.css"
import { AppBar, Box, IconButton, LinearProgress, TextField, Toolbar, Typography } from '@mui/material';
import axios, { all } from 'axios';
import CircularProgress from '@mui/material/CircularProgress';
import Backdrop from '@mui/material/Backdrop';
import HowTo1 from "../Images/Picture2.svg"
import logo from "../Images/Logo.png"
import DownloadIcon from '@mui/icons-material/Download';
import DatabricksLogo from "../Images/FabricLogo.png"
import Button from '@mui/material/Button';
import { Stack } from 'react-bootstrap';

const NotebookMigrator = () => {
    const [files, setFiles] = useState([]);
    const [inputFileName, setInputFileNames] = useState([]);
    const [outputFiles, setOutputFiles] = useState([]);
    const [fileError, setFileError] = useState([]);
    const backend_url = process.env.REACT_APP_API_BASE_URL;

    const [createdTables, setCreatedTables] = useState([]);
    const [refreshTables, setRefreshTables] = useState([]);

    const [loading, setLoading] = useState(false);


    useEffect(() => {
        console.log("THIS IS FINAL")
    }, [loading])

    const handleFileChange = (event) => {
        setFiles([...event.target.files]);
    }

    // Function to break notebook content into an array of JSON items
    function breakIntoJsonItems(notebookContent) {
        // Split the notebook content by cell delimiter (assuming each cell is separated by a specific delimiter)
        const cells = notebookContent.split('# COMMAND ----------');

        // Convert each cell into a JSON object
        const jsonItems = cells.map((cell, index) => ({
            cellIndex: index,
            cellContent: cell.trim()
        }));

        return jsonItems;
    }

    function replaceCellContent(refreshTbl, createdTbl) {
        console.log(refreshTbl)
        console.log(createdTbl)
        // Define the new content for the first cell
        const new_first_cell_content = {
            cellContent: `
    # Fabric notebook source

    # METADATA ********************

    # META {
    # META   "kernel_info": {
    # META     "name": "synapse_pyspark"
    # META   },
    # META   "dependencies": {
    # META     "lakehouse": {
    # META       "default_lakehouse_name": "",
    # META       "default_lakehouse_workspace_id": ""
    # META     },
    # META     "warehouse": {}
    # META   }
    # META }

    # MARKDOWN ********************

    # ###### Project Name:  
    # ###### Notebook Stage: []
    # 
    # ###### Purpose: Notebook to Populate  
    # ###### Parameter Info:
    # 
    # ###### Revision History:
    # 
    # | Date     |     Author    |  Description  |  Execution Time  |
    # |----------|:-------------:|--------------:|--------------:|
    # ||||4 min|
    `}

        const commomUtilityFunc_content = {
            cellContent: `%run CommonUtilitiesFunctions`
        };

        const notebookStatus_content = {
            cellContent: `
                import sempy.fabric as fabric
                NotebookName=fabric.resolve_item_name(notebookutils.runtime.context['currentNotebookId'])
                Result=GetNotebookStatus(NotebookName, StreamName, SilverStageLayer)
                if '0' in Result:
                    mssparkutils.notebook.exit("0")
                elif '-1' in Result:
                    System.exit(-1)
                elif '2' in Result:
                    mssparkutils.notebook.exit("2")
        `}

        const notebook_end = {
            cellContent: `SetNotebookStatus(NotebookName, StreamName, )`
        };

        if (createdTbl.createdTables.length > 0) {
            let updatedJson = [];

            updatedJson.push(new_first_cell_content, commomUtilityFunc_content, notebookStatus_content);
            // REFRESH STATEMENTS modified code
            if (refreshTbl.refreshedTables) {
                let bronzeTables = "";
                refreshTbl.refreshedTables.forEach(tableName => {
                    bronzeTables += `${tableName.replace(/\./g, '_')}_df=GetDataframe(WorkspaceID, LakehouseID, "${tableName}")\n`;
                });

                updatedJson.push({
                    cellContent: bronzeTables
                })
            }

            // CREATED tables modified code
            createdTbl.createdTables.forEach(tableName => {
                updatedJson.push({
                    cellContent: `spark.sql('''${tableName.selectStatement}''').createOrReplaceTempView('${tableName.objectName}')`
                })
            });

            updatedJson.push(notebook_end);
            console.log(updatedJson);

            updatedJson = createFabricNotebook(updatedJson);
            return updatedJson;
        }

    }

    function createFabricNotebook(notebookContent) {

        const cells = notebookContent.map(cell => {
            if (typeof cell.cellContent !== 'string') {
                console.error('cell.cellContent is not a string:', cell.cellContent);
            }

            return {
                cell_type: 'code',
                execution_count: null,
                metadata: {},
                outputs: [],
                source: typeof cell.cellContent === 'string'
                    ? cell.cellContent.split('\n').map(line => line + '\n')
                    : []
            };
        });

        const notebookJson = {
            cells: cells,
            metadata: {
                kernelspec: {
                    name: 'python3',
                    display_name: 'Python 3 with PySpark'
                },
                language_info: {
                    name: 'python',
                    version: '3.8.5'
                }
            },
            nbformat: 4,
            nbformat_minor: 4
        };

        // Convert JSON to string
        const notebookString = JSON.stringify(notebookJson, null, 2);
        return notebookString;
    }


    function downloadZipFolder() {
        const zip = new JSZip();

        outputFiles.forEach((element, index) => {
            const fileName = inputFileName[index].replace(/\.[^/.]+$/, "");
            zip.file(`${fileName}.ipynb`, element);
        });

        // Generate the zip file and trigger the download
        /*
        zip.generateAsync({ type: 'blob' }).then(content => {
            saveAs(content, 'FabricNotebooks_Folder.zip');
        });
        */

        // Generate the zip file and download it
        zip.generateAsync({ type: 'blob' }).then(content => {
            saveAs(content, 'FabricNotebooks_Folder.zip');
        }).catch(err => {
            console.error('Error generating zip file:', err);
        });
    }

    function cleanAndPrepareJson(jsonString) {
        try {
            // Step 1: Try parsing the JSON directly to check if it's valid
            let outputJSON = JSON.parse(jsonString);
            // If no error is thrown, return the original JSON string
            // return jsonString.trim();

            return outputJSON
        } catch (initialError) {
            try {
                // Step 2: Remove comments (both // and # styles)
                jsonString = jsonString.replace(/\/\/.*$/gm, ''); // Remove // comments
                jsonString = jsonString.replace(/#.*$/gm, '');    // Remove # comments

                // Step 3: Replace newlines with spaces (to prevent breaking)
                jsonString = jsonString.replace(/\n/g, ' ');

                // Step 4: Handle improperly escaped quotes
                jsonString = jsonString.replace(/(["'])(?:(?=(\\?))\2.)*?\1/g, (match) => {
                    // Ensure inner quotes are escaped properly
                    return match
                        .replace(/\\'/g, "'")  // Fix incorrectly escaped single quotes
                        .replace(/\\"/g, '"')  // Fix incorrectly escaped double quotes
                        .replace(/"/g, '\\"'); // Escape all unescaped double quotes
                });

                // Step 5: Quote unquoted keys
                jsonString = jsonString.replace(/(\w+):/g, '"$1":'); // Quote keys without quotes

                // Step 6: Fix broken JSON (e.g., improperly terminated strings)
                jsonString = jsonString.replace(/,(?=\s*[\]}])/g, ''); // Remove trailing commas before } or ]

                // Step 7: Escape necessary special characters in values
                jsonString = jsonString.replace(/\\(?!["/bfnrtu])/g, '\\\\') // Escape unescaped backslashes
                    .replace(/\t/g, '\\t') // Escape tabs
                    .replace(/\r/g, '\\r') // Escape carriage returns
                    .replace(/\n/g, '\\n'); // Escape newlines

                // Step 8: Validate the cleaned JSON
                const parsed = JSON.parse(jsonString); // Will throw error if invalid JSON
                // return JSON.stringify(parsed, null, 2); // Return formatted JSON
                return parsed
            } catch (finalError) {
                throw new Error(`Failed to clean and parse JSON: ${finalError.message}`);
            }
        }
    }


    const handleSubmit = async () => {
        setLoading(true);
        console.log(loading)
        let index = 0;
        for (const file of files) {
            console.log("File num:", index);
            console.log("File processes", file.name);
            let fName = file.name.split(".")[0];

            const reader = new FileReader();
            reader.readAsText(file)
            reader.onloadend = async () => {

                let response;

                try {
                    response = await callChatGptApi(reader.result, index);
                    console.log(response)
                    const jsonobject = cleanAndPrepareJson(
                        response.replace(/^```json\n/, '').replace(/\n```$/, '')
                    );
                    console.log(jsonobject);

                    // Filter JSON objects with identifier=1 and set to createdTables
                    const createdTablesArray = jsonobject.filter(item => item.identifier === 1);
                    setCreatedTables(createdTablesArray);

                    // Filter JSON objects with identifier=2 and set to refreshedTables
                    const refreshedTablesArray = jsonobject.filter(item => item.identifier === 2);
                    setRefreshTables(refreshedTablesArray);

                    // Create Fabric Notebook Cells V.1
                    let notebookContent = replaceCellContent(refreshedTablesArray[0], createdTablesArray[0]);
                    console.log(notebookContent);
                    setOutputFiles((prev) => [...prev, notebookContent]);
                    setInputFileNames((prevItem) => [...prevItem, file.name]);

                    index++;

                    if (files.length === index) {
                        setLoading(false);
                    }

                    // Wait for 10 seconds before proceeding
                    await new Promise(resolve => setTimeout(resolve, 150000));

                    console.log(response);
                }
                catch (err) {
                    console.log("Error in file", file.name)

                    setFileError(prevError => {
                        const newuniqueerror = [...prevError, { name: file.name, gptmessage: err.message, backenderror: response.data }];
                        axios.post(`${backend_url}/update-json/${7}`, newuniqueerror)
                            .then((res) => {
                                // console.log(`Status: ${res.status}`);
                                // console.log('Body: ', res.data);
                            }).catch((err) => {
                                // console.error(err);
                            });
                        return newuniqueerror
                    })

                    index++;

                    if (files.length === index) {
                        setLoading(false);
                    }
                }
            }
            // setLoading(false)
        }
    }

    const [deploymentEndpoint, setDeploymentEndpoint] = useState('');
    const [modelName, setModelName] = useState('');
    const [apiKey, setApiKey] = useState('');


    const callChatGptApi = async (DatabricksNotebook, index) => {
        // const DatabricksNotebook = JSON.stringify(batch, null, 2);
        // console.log(`Databricks Notebook ${index + 1}:\n${DatabricksNotebook}`);
        let result;
        try {


            const prompt = DatabricksNotebook + `\n\n 
            Analyze the provided list of Databricks notebooks and extract the following details:

            (1) Tables or Views Created and Their Corresponding SELECT Statements:

            -Identify all CREATE, CREATE TABLE, or CREATE VIEW statements in the notebooks.
            -Also, consider INSERT INTO or INSERT OVERWRITE statements as table creation steps if accompanied by a SELECT statement
            -Add an "identifier": 1 field to indicate table/view creation.
            -Extract the name of the table or view being created.
            -Extract the complete SELECT statement used for the table or view creation.
            -Please give response as a json object not a array of json.
            -Provide the results in the following JSON format:
            {
                "identifier": 1,
                "createdTables":[
                    {
                    "objectName": "<name_of_table_or_view>",
                    "objectType": "<'table' or 'view'>",
                    "selectStatement": "<complete_select_statement>"
                    },
                     {
                        "objectName": "<name_of_table_or_view>",
                        "objectType": "<'table' or 'view'>",
                        "selectStatement": "<complete_select_statement>"
                    }
                ]
            }

            (2) Another JSON obejct for Tables Referenced in REFRESH Statements:

            -Identify all REFRESH statements in the notebooks.
            -Add an "identifier": 2 field to indicate tables used in REFRESH statements.
            -Extract the names of the tables referenced in these statements.
            -Provide the list of tables in the following format:
            {
                "identifier": 2,
                "refreshedTables": ["<table_name_1>", "<table_name_2>", ...]
            }

            Instructions:

            -Ensure the analysis includes both tables and views being created.
            -Clearly differentiate between "identifier": 1 for creation and "identifier": 2 for refresh-related tables.
            -Accurately extract object names (table or view) and SELECT statements.
            -List all unique table names identified in REFRESH statements.
            -Return the results in the specified JSON format without additional commentary or explanations.
            -Please give response as array of json objects.
        `;

            result = await axios.post(`${backend_url}/call-gpt`, { content: prompt, endpoint: deploymentEndpoint, model: modelName, key: apiKey });
            // console.log(result.data.choices)

            return result.data.choices.map(c => c.message.content).join('\n');
        } catch (error) {
            // console.error(`Error processing Databricks Notebook ${index + 1}:`, error.message);
            return result;
        }
    };

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


    const handleDownload = async () => {
        downloadZipFolder();

        // console.log(files.length)
        // console.log(inputFileName.length)
        // console.log(outputFiles.length)

        // setOutputFiles([])
        // setFiles([])
    }

    const navItems = [
        { label: 'Home', href: '/' },
        { label: 'Data Analysis - Databricks', href: '/v1' },
        { label: 'Data Analysis - Fabric', href: '/v1/fabric' },
        { label: 'Pipeline Migrator', href: '/v1/fabricdatapipeline' },
        { label: 'Notebook Migrator', href: '/v1/fabricnotebook' }
    ]

    const LogoHeader = () => (
        <Box sx={{ textAlign: 'center', backgroundColor: '#f5f5f5', padding: "10px 0px 1px 0px" }}>
            <a href="/">
                <img
                    src={logo} // Replace with actual logo path
                    alt="Code Analyzer Logo"
                    style={{ height: '70px', objectFit: 'contain' }}
                />
            </a>
        </Box>
    );

    return (
        <div>

            <div>

                <LogoHeader />

                <AppBar
                    position="sticky"
                    elevation={4}
                    sx={{
                        backgroundColor: '#059bbf !important',
                        px: 2,
                    }}
                >
                    <Toolbar
                        sx={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            flexWrap: 'wrap',
                        }}
                    >
                        {/* Left Side: Nav Items */}
                        <Box sx={{ display: 'flex', gap: 2 }}>
                            {navItems.map((item, i) => (
                                <Button
                                    key={i}
                                    href={item.href}
                                    sx={{
                                        borderRadius: "0px",
                                        color:
                                            (item.label === "Notebook Migrator") ? '#3A3A3A' :
                                                'white',
                                        fontFamily: "Poppins, sans-serif",
                                        fontWeight:
                                            (item.label === "Notebook Migrator")
                                                ? 'bold'
                                                : 'normal',
                                        borderBottom:
                                            (item.label === "Notebook Migrator")
                                                ? '2px solid #3A3A3A'
                                                : 'none',
                                        textTransform: 'none',
                                        '&:hover': {
                                            backgroundColor: 'rgba(255,255,255,0.1)',
                                            borderRadius: 1,
                                        },
                                    }}
                                >
                                    {item.label}
                                </Button>

                            ))}
                        </Box>

                        {/* Right Side: Download */}
                        {/* { loading ?  */}
                        {outputFiles.length != 0 ? <Button color="inherit" onClick={handleDownload}><DownloadIcon /></Button> : <></>}

                    </Toolbar>
                </AppBar>
            </div>

            <div className='container'>

                <div className='main__container' style={{ display: 'flex', padding: '2rem', backgroundColor: '#f9f9f9', maxWidth: "80%" }}>
                    {/* Left Section */}
                    <div className='left__section' style={{ flex: 1, padding: '2rem', backgroundColor: '#ffffff', borderRadius: '12px', boxShadow: '0px 4px 20px rgba(0,0,0,0.1)' }}>
                        {/* <h1 style={{ fontSize: '2rem', fontWeight: 'bold', color: '#059bbf' }}>Databricks</h1> */}
                        <div style={{ marginTop: '0.5rem' }}>
                            <img src={DatabricksLogo} alt="Databricks Logo" style={{ width: '250px', display: "block", marginLeft: "auto", marginRight: "auto" }} />
                        </div>
                        <p style={{ marginTop: '1rem', fontSize: '1rem', lineHeight: '1.6', color: '#333' }}>
                            <b>Notebook Migrator Databricks to Fabric Code Converter - </b>

                            The Notebook Migrator is a utility designed to streamline the transition from Databricks to Microsoft Fabric by automatically converting code written in SQL within Databricks notebooks to equivalent Python or PySpark code compatible with Fabric notebooks. This tool simplifies the migration process by parsing the original SQL logic, identifying key operations (such as data transformations, joins, aggregations, and table creations), and generating clean, readable PySpark or Python scripts that replicate the original functionality within the Fabric ecosystem. <br></br>
                        </p>
                    </div>

                    {/* Right Section */}
                    <div className='right__section' style={{ flex: 1, marginLeft: '2rem', padding: '2rem', backgroundColor: '#ffffff', borderRadius: '12px', boxShadow: '0px 4px 20px rgba(0,0,0,0.1)' }}>
                        <div>
                            Upload Databricks Folder:<br></br>
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
                            /> <br></br>
                        </div>
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
                        <button onClick={handleSubmit} className='submitButton'
                            disabled={
                                files.length === 0 ||
                                deploymentEndpoint === '' ||
                                modelName === '' ||
                                apiKey === ''
                            }
                            style={{
                                marginTop: '1rem',
                                padding: '0.75rem 1.5rem',
                                backgroundColor: '#059bbf',
                                color: '#fff',
                                border: 'none',
                                borderRadius: '6px',
                                cursor: files.length === 0 || deploymentEndpoint === '' || modelName === '' || apiKey === '' ? 'not-allowed' : 'pointer',
                                fontWeight: 'bold',
                                fontSize: '1rem'
                            }}>Submit</button>
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
                    </div>
                </div>

                <div style={{ display: 'flex', gap: '2rem', marginTop: '1rem', width: "auto", marginBottom: "2rem" }}>
                    {/* Left Section: Instructions */}
                    <div style={{ flex: 1 }}>
                        <h2 style={{ marginBottom: '2rem', color: '#059bbf', textAlign: "center" }}>How to Use</h2>
                        <img src={HowTo1} alt="How To Use" className='container_howToImage' />
                    </div>

                    {/* Right Section: Video
                    <div style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
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
            </div>

            {/* <div className='container'>
                <div className='container__box'>
                    <p>
                        Please upload the Databricks folder for your GPS architecture Repository file
                    </p>
                    <div>
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
                        /> <br></br>
                    </div>
                    <div>
                        <button onClick={handleSubmit} className='submitButton' disabled={files.length === 0}>Submit</button>
                    </div><br />
                    <div>
                        <button onClick={handleDownload} className='submitButton'>Download</button>
                    </div>
                </div>
            </div> */}

            <Backdrop
                sx={{ color: '#fff', zIndex: (theme) => theme.zIndex.drawer + 1 }}
                open={loading}
            >
                <Box sx={{ width: '350px', color: '#fff', textAlign: 'center' }}>
                    <Typography variant="h6" sx={{ mb: 2 }}>
                        Processing Files...
                    </Typography>

                    <LinearProgress variant="determinate" value={((inputFileName.length + fileError.length) / files.length) * 100} sx={{ height: 10, borderRadius: 6, mb: 2, '& .MuiLinearProgress-bar': { backgroundColor: '#059bbf', } }} />

                    <Typography variant="body2" sx={{ mt: 2 }}>
                        {inputFileName.length + fileError.length} of {files.length} processed
                    </Typography>

                    <Stack direction="row" justifyContent="space-between">
                        <Typography variant="body2">✅ Success: {inputFileName.length}</Typography>
                        <Typography variant="body2">❌ Errors: {fileError.length}</Typography>
                    </Stack>
                </Box>
            </Backdrop>
        </div>
    )
}

export default NotebookMigrator
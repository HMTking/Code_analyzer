import React, { useEffect, useState } from 'react'
import "./Analyze.css"
import Navbar from './Navbar';
import TabsC from './TabsC';
import CircularProgress from '@mui/material/CircularProgress';
import Backdrop from '@mui/material/Backdrop';
import { Checkbox, FormControlLabel, TextField } from '@mui/material';
import { LinearProgress, Typography, Box } from '@mui/material';
import axios from 'axios';
import DatabricksLogo from "../Images/DatabricksLogo.png"
import HowTo from "../Images/HowTo.png"
import HowTo1 from "../Images/Picture2.svg"
import { Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, Button } from '@mui/material';
import { Stack } from 'react-bootstrap';



function Analyze() {

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

    // Mounts data
    const [mounts, setMounts] = useState([]);

    // Extracted tables data
    const [extractedtables, setExtractedtables] = useState([]);

    // Database and static tables data
    const [staticcreated, setStaticcreated] = useState({
        "databasecreated": [],
        "tablescreated": [],
        "filepathname": []
    });

    // Mart tables details
    const [marttables, setMarttables] = useState([]);

    const [viewdetails, setViewDetails] = useState([]);

    const [stagingtables, setStagingTables] = useState([]);

    const [loading, setLoading] = useState(false);
    
    // Track if processing has actually started (to avoid saving empty data on mount)
    // Use sessionStorage to track THIS session's processing state (clears on tab close)
    const [hasProcessed, setHasProcessed] = useState(() => {
        return sessionStorage.getItem('codeAnalyzerSessionProcessed') === 'true';
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
        const sessionProcessed = sessionStorage.getItem('codeAnalyzerSessionProcessed') === 'true';
        
        if (!sessionProcessed) {
            // Fresh session - don't restore old data, clear any stale localStorage
            console.log('🔄 Fresh session - not restoring old data');
            return;
        }
        
        const savedState = localStorage.getItem('codeAnalyzerUIState');
        const savedOutput = localStorage.getItem('codeAnalyzerOutput');
        
        if (savedState) {
            try {
                const state = JSON.parse(savedState);
                if (state.fileprocess) setFileprocess(state.fileprocess);
                if (state.fileError) setFileError(state.fileError);
                if (state.filenotdetected) setFilenotdetected(state.filenotdetected);
                if (state.messageResponse) setMessageResponse(state.messageResponse);
                console.log('✅ UI state restored from localStorage');
            } catch (err) {
                console.log('Failed to parse saved UI state');
            }
        }
        
        if (savedOutput) {
            try {
                const data = JSON.parse(savedOutput);
                const repo = data?.Repos?.OCPStaging_Digital;
                if (repo) {
                    if (repo.Mounts) setMounts(repo.Mounts);
                    if (repo.ExtractedTables) setExtractedtables(repo.ExtractedTables);
                    if (repo.StaticCreated) setStaticcreated(repo.StaticCreated);
                    if (repo.MartTables) setMarttables(repo.MartTables);
                    if (repo.StagingTable) setStagingTables(repo.StagingTable);
                    if (repo.ViewDetails) setViewDetails(repo.ViewDetails);
                    setHasProcessed(true);
                    console.log('✅ Data restored from localStorage');
                }
            } catch (err) {
                console.log('Failed to parse saved output data');
            }
        }
    }, []);

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
        localStorage.removeItem('lineageViewState');
        localStorage.removeItem('codeAnalyzerOutput');
        localStorage.removeItem('codeAnalyzerUIState');
        
        // Mark that processing has started in this session
        sessionStorage.setItem('codeAnalyzerSessionProcessed', 'true');
        
        // Notify navbar that data was cleared (same-tab event)
        window.dispatchEvent(new CustomEvent('codeAnalyzerDataCleared'));
        
        // Reset all state variables
        setMounts([]);
        setExtractedtables([]);
        setStaticcreated({ "databasecreated": [], "tablescreated": [], "filepathname": [] });
        setMarttables([]);
        setViewDetails([]);
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
                        const prompt = reader.result + `\n \n Please analyze this file to determine its type from the following categories:

                            1. A file where mounts are created.
                            2. A file where tables are extracted from a blob, parquet, SQL Server database, Excel, or any other source.
                            3. A file where some tables/views are created using staging tables.
                            4. A file where databases and static tables are created.
                            Can you identify what type of file this is and provide the requested information in the specified format?

                            I need a identifier also 1,2,3,4 to identify which type of file is this. and if it's not any of the file mark it as 5
                            Important - Please enclose every value in quotes. This means that each value should be surrounded by double quotation marks ("value").

                        If it's a file where mounts are created, provide the actual and dummy path of mounts. 
                        JSON Format:
                            {
                                "identifier": 1,
                                "mounts": [
                                    {
                                        "DummyPath": "",
                                        "ActualPath": ""
                                    },
                                    {
                                        "DummyPath": "",
                                        "ActualPath": ""
                                    }
                                ]
                            }

                        If it's a file where tables are extracted, provide the tables extracted (actual name and created name, database name((if mentioned) (The database the table belongs to. If not explicitly mentioned, use the database name from the 'USE' command. It can be anywhere in file pls read and mention correct database))), their extraction source (blob, parquet, SQL Server, Excel, or any other), their extraction details (if there is sql query fetch that whole sql query and If the table is extracted from a parquet file, provide the complete path of the parquet file. and Identify the path and latest_path variable and provide its value.
                        eg: parquet path (give complete path and do not include any variable in that), sql server details or any other.
                        (Do not include database name in tablename)
                        JSON Format:
                        {
                            "identifier": 2,
                            "extractedtables": [
                                {
                                    "tablename": "",
                                    "actualname": "",
                                    "createdname": "",
                                    "databasename":"",
                                    "extractionSource": "",
                                    "extractiondetails": "",
                                    "latest_path": ""
                                },
                                {
                                    "tablename": "",
                                    "actualname": "",
                                    "createdname": "",
                                    "databasename":"",
                                    "extractionSource": "",
                                    "extractiondetails": "",
                                    "latest_path": ""
                                }
                            ]
                        }

                        If it's a file where tables are created using staging tables
                        Identify all tables, views and tmp tables referenced in the file, without exception including those used in 'CREATE', 'CREATE OR REPLACE TEMPORARY VIEW', 'CREATE VIEW',  'SELECT', 'UPDATE', 'DELETE', 'INSERT INTO', and 'JOIN' statements. For each referenced table, provide the table name.
                        and Where ALTER TABLE ... RENAME TO operation is used mark them as created.
                        can you please present the information in a json format, including all these:
                        (Include all tables whether its temporary or anything or its removed, altered anything i want all the tables and views. Analyzer all the table include tmp tables also)
                        
                        Table Name (Do not include database name in tablename)
                        Database (if mentioned) (The database the table belongs to. If not explicitly mentioned, use the database name from the 'USE' command. It can be anywhere in file pls read and mention correct database)
                        Type (whether it's a created table or altered or referenced table)
                        Columns (List all the columns used in the creation of the mart tables. Include the column names)
                        Staging table used (Important = Please include database name in table  If not explicitly mentioned, use the database name from the 'USE DATABASE' command. it can be anywhere in file  pls read and mention correct database and do not include square brackets '[', ']' between any name) (Pls include all the tables used in the creation, referenced or alteration of that table) ( List all the tables that are used temporarily to help create, change, or reference the main table. These tables are usually used in commands like 'SELECT INTO', 'INSERT INTO SELECT', 'ALTER TABLE', 'RENAME' or in subqueries. Pls include everything that is used in table creation do not left anything) (There may be case where table is just created first and then we have used INSERT, RENAME, ALTER or any sql operation so populate in that table) (Please include database name in that table). Note: In the process of creating a table, multiple Common Table Expressions (CTEs) may be used. they are not actual tables and thus should not be included in the output. However, these CTEs may reference actual tables, often referred to as "staging tables". These staging tables should be included in the output. In some cases, a CTE may reference another CTE, which in turn may reference another CTE, and so on. This can create a chain of CTEs. In such cases, Please traverse this chain to the end, and include all staging tables that are referenced at any level in the chain. 
                        
                        Could you also please list the columns that have been used for the staging tables? Please analyze the code correctly and provide me the columns that have been used for staging tables only. DO not leave this array empty i want the column that have used.
                        Table name : Name of table (including databasename) 
                        JSON Format:
                        {
                            "identifier": 3,
                            "marttablesinfo": [
                                {
                                    "tablename": "",
                                    "databasename": "",
                                    "tabletype": "",
                                    "ColumnUsed": ["", ""],
                                    "Stagingtableused": ["", ""]
                                },
                                {
                                    "tablename": "",
                                    "databasename": "",
                                    "tabletype": "",
                                    "ColumnUsed": ["", ""],
                                    "Stagingtableused": ["", ""]
                                },
                            ],
                            "stagingtablesinfo": [
                                {
                                    "tablename": "",
                                    "ColumnsUsed": []
                                }
                            ]
                        }"
                          

                        If it's a file where databases and static tables are created, provide the name of the database and tables created.
                        JSON Format:
                            {
                            "identifier": 4,
                            "databasecreated": [""],
                            "tablescreated": [""]
                            }


                        If the file doesn't match any of the specified types, give this json as response
                        JSON Format:
                        {
                            "identifier": 6,
                        }

                        Please give response as a json object not a array of json
                        `
                        // console.log(backend_url)
                        result = await axios.post(`${backend_url}/call-gpt`, { content: prompt, endpoint: deploymentEndpoint, model: modelName, key: apiKey });

                        // console.log("this is result", result.data)
                        for (const choice of result.data.choices) {
                            console.log(file.name)
                            // console.log("this is gptresponse", choice.message.content)

                            const jsonobject = JSON.parse(choice.message.content.replace(/^```json\n/, '').replace(/\n```$/, ''))
                            // console.log(jsonobject)

                            // const flag = 1;
                            const flag = jsonobject.identifier;
                            // console.log(flag) 
                            if (flag === 1) {
                                const updatedobj = jsonobject?.mounts?.map(mount => ({
                                    ...mount,
                                    filepathname: file.webkitRelativePath
                                }));
                                jsonobject.mounts = updatedobj;

                                setMounts(prevMounts => {
                                    const combinedarray = [...prevMounts, ...(jsonobject?.mounts || [])];
                                    const uniquearray = combinedarray.filter((value, index, self) =>
                                        index === self.findIndex((t) => (
                                            t?.DummyPath === value?.DummyPath && t?.filepathname === value?.filepathname
                                        ))
                                    );
                                    // console.log("Final Mounts", uniquearray)
                                    axios.post(`${backend_url}/update-json/${1}`, uniquearray)
                                        .then((res) => {
                                            // console.log(`Status: ${res.status}`);
                                            // console.log('Body: ', res.data);
                                        }).catch((err) => {
                                            // console.error(err);
                                        });

                                    return uniquearray;
                                });
                            } else if (flag === 2) {

                                const updatedobj = jsonobject?.extractedtables?.map(mount => ({
                                    ...mount,
                                    filepathname: file.webkitRelativePath
                                }));
                                jsonobject.extractedtables = updatedobj;

                                setExtractedtables(prevMounts => {
                                    const combinedarray = [...prevMounts, ...(jsonobject?.extractedtables || [])];
                                    const uniquearray = combinedarray.filter((value, index, self) =>
                                        index === self.findIndex((t) => (
                                            t?.tablename === value?.tablename && t?.actualname === value?.actualname && t?.createdname === value?.createdname && t?.filepathname === value?.filepathname
                                        ))
                                    );
                                    // console.log("this is extraction", uniquearray)
                                    axios.post(`${backend_url}/update-json/${2}`, uniquearray)
                                        .then((res) => {
                                            // console.log(`Status: ${res.status}`);
                                            // console.log('Body: ', res.data);
                                        }).catch((err) => {
                                            // console.error(err);
                                        });

                                    return uniquearray;
                                });
                            } else if (flag === 3) {

                                const updatedobj = jsonobject?.marttablesinfo?.map(mount => ({
                                    ...mount,
                                    filepathname: file.webkitRelativePath
                                }));
                                jsonobject.marttablesinfo = updatedobj;

                                setMarttables(prevMounts => {
                                    const combinedarray = [...prevMounts, ...(jsonobject?.marttablesinfo || [])];
                                    const uniquearray = combinedarray.filter((value, index, self) =>
                                        index === self.findIndex((t) => (
                                            t?.tablename === value?.tablename && t?.databasename === value?.databasename && t?.filepathname === value?.filepathname
                                        ))
                                    );
                                    // console.log("Final Mounts", uniquearray)
                                    axios.post(`${backend_url}/update-json/${3}`, uniquearray)
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
                            // else if (flag === 4) {

                            //     const updatedobj = jsonobject?.viewsinfo?.map(mount => ({
                            //         ...mount,
                            //         filepathname: file.webkitRelativePath
                            //     }));
                            //     jsonobject.viewsinfo = updatedobj;

                            //     setViewDetails(prevMounts => {
                            //         const combinedarray = [...prevMounts, ...jsonobject?.viewsinfo];
                            //         const uniquearray = combinedarray.filter((value, index, self) =>
                            //             index === self.findIndex((t) => (
                            //                 t?.viewname === value?.viewname && t?.databasename === value?.databasename && t?.filepathname === value?.filepathname
                            //             ))
                            //         );
                            //         // console.log("Final Mounts", uniquearray)
                            //         axios.post(`${backend_url}/update-json/${9}`, uniquearray)
                            //             .then((res) => {
                            //                 // console.log(`Status: ${res.status}`);
                            //                 // console.log('Body: ', res.data);
                            //             }).catch((err) => {
                            //                 // console.error(err);
                            //             });
                            //         return uniquearray;
                            //     });

                            //     setStagingTables(prevMounts => {
                            //         const updatedMounts = [...prevMounts];

                            //         jsonobject?.stagingtablesinfo.forEach(newTable => {
                            //             const existingTableIndex = updatedMounts.findIndex(t => t.tablename === newTable.tablename);

                            //             if (existingTableIndex !== -1) {
                            //                 updatedMounts[existingTableIndex] = {
                            //                     ...updatedMounts[existingTableIndex],
                            //                     ...newTable
                            //                 };
                            //             } else {
                            //                 updatedMounts.push(newTable);
                            //             }
                            //         });
                            //         // console.log("Final Mounts", uniquearray)
                            //         axios.post(`${backend_url}/update-json/${4}`, updatedMounts)
                            //             .then((res) => {
                            //                 // console.log(`Status: ${res.status}`);
                            //                 // console.log('Body: ', res.data);
                            //             }).catch((err) => {
                            //                 // console.error(err);
                            //             });
                            //         return updatedMounts;
                            //     });
                            // }

                            else if (flag === 4) {

                                setStaticcreated(prevMounts => {
                                    const uniquedatabase = [...new Set([...prevMounts?.databasecreated, ...(jsonobject?.databasecreated || [])])]
                                    const uniquetables = [...new Set([...prevMounts?.tablescreated, ...(jsonobject?.tablescreated || [])])]
                                    const uniquefilepath = [...new Set([...prevMounts.filepathname, file.webkitRelativePath])];
                                    const staticobj = {
                                        "databasecreated": uniquedatabase,
                                        "tablescreated": uniquetables,
                                        "filepathname": uniquefilepath
                                    }
                                    // console.log("static", staticobj)
                                    axios.post(`${backend_url}/update-json/${5}`, staticobj)
                                        .then((res) => {
                                            // console.log(`Status: ${res.status}`);
                                            // console.log('Body: ', res.data);
                                        }).catch((err) => {
                                            // console.error(err);
                                        });
                                    return staticobj
                                });
                            } else {
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

    // Save to localStorage whenever data changes (after processing starts)
    useEffect(() => {
        // Only save if processing has started
        if (hasProcessed) {
            const finaljson = {
                "Repos": {
                    "OCPStaging_Digital": {
                        "StaticCreated": staticcreated,
                        "ExtractedTables": extractedtables,
                        "Mounts": mounts,
                        "MartTables": marttables,
                        "StagingTable": stagingtables,
                        "ViewDetails": viewdetails
                    }
                }
            };

            const hasData = marttables.length > 0 || stagingtables.length > 0 || extractedtables.length > 0;
            if (hasData) {
                localStorage.setItem('codeAnalyzerOutput', JSON.stringify(finaljson));
                console.log('✅ Data SAVED to localStorage:', marttables.length, 'mart tables,', stagingtables.length, 'staging tables');
                
                // Notify navbar that data is available (same-tab event)
                window.dispatchEvent(new CustomEvent('codeAnalyzerDataUpdated'));
                
                // Verify it was saved
                const verify = localStorage.getItem('codeAnalyzerOutput');
                console.log('✅ Verified in localStorage:', verify ? 'YES (length: ' + verify.length + ')' : 'NO');
            }
            
            // Log when complete
            if (!loading && hasData) {
                console.log("THIS IS FINAL");
                console.log(JSON.stringify(finaljson));
            }
            
            // Also save UI state
            const uiState = {
                fileprocess,
                fileError,
                filenotdetected,
                messageResponse,
                hasProcessed: true
            };
            localStorage.setItem('codeAnalyzerUIState', JSON.stringify(uiState));
        }
    }, [hasProcessed, loading, staticcreated, extractedtables, mounts, marttables, stagingtables, viewdetails, fileprocess, fileError, filenotdetected, messageResponse]);

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
            <Navbar mounts={mounts} extractedtables={extractedtables} staticcreated={staticcreated} marttables={marttables} viewdetails={viewdetails} loading={loading} stagingtables={stagingtables} flagpage={1} />
            <div className='container'>

                <div className='main__container' style={{ display: 'flex', padding: '2rem', backgroundColor: '#f9f9f9', maxWidth: "80%" }}>
                    {/* Left Section */}
                    <div className='left__section' style={{ flex: 1, padding: '2rem', backgroundColor: '#ffffff', borderRadius: '12px', boxShadow: '0px 4px 20px rgba(0,0,0,0.1)' }}>
                        {/* <h1 style={{ fontSize: '2rem', fontWeight: 'bold', color: '#059bbf' }}>Databricks</h1> */}
                        <div style={{ marginTop: '0.5rem' }}>
                            <img src={DatabricksLogo} alt="Databricks Logo" style={{ width: '150px', display: "block", marginLeft: "auto", marginRight: "auto" }} />
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

                {/* File Processing Status - shown after processing is complete */}
                {
                    !loading && hasProcessed && (fileprocess.length > 0 || fileError.length > 0 || filenotdetected.length > 0) ?
                        <div style={{ 
                            width: "80%", 
                            marginTop: "2rem", 
                            padding: "1.5rem", 
                            backgroundColor: "#f8f9fa", 
                            borderRadius: "12px",
                            boxShadow: "0px 2px 10px rgba(0,0,0,0.1)"
                        }}>
                            <Typography variant="h6" sx={{ mb: 2, fontWeight: 'bold', color: '#059bbf' }}>
                                File Processing Summary
                            </Typography>
                            
                            <Box sx={{ display: 'flex', gap: 4, flexWrap: 'wrap', mb: 2 }}>
                                <Box sx={{ 
                                    padding: '1rem 2rem', 
                                    backgroundColor: '#e8f5e9', 
                                    borderRadius: '8px',
                                    textAlign: 'center',
                                    minWidth: '150px'
                                }}>
                                    <Typography variant="h4" sx={{ color: '#2e7d32', fontWeight: 'bold' }}>
                                        {fileprocess.length}
                                    </Typography>
                                    <Typography variant="body2" sx={{ color: '#2e7d32' }}>
                                        ✅ Files Processed
                                    </Typography>
                                </Box>
                                
                                <Box sx={{ 
                                    padding: '1rem 2rem', 
                                    backgroundColor: '#ffebee', 
                                    borderRadius: '8px',
                                    textAlign: 'center',
                                    minWidth: '150px'
                                }}>
                                    <Typography variant="h4" sx={{ color: '#c62828', fontWeight: 'bold' }}>
                                        {fileError.length}
                                    </Typography>
                                    <Typography variant="body2" sx={{ color: '#c62828' }}>
                                        ❌ Errors
                                    </Typography>
                                </Box>
                                
                                <Box sx={{ 
                                    padding: '1rem 2rem', 
                                    backgroundColor: '#fff3e0', 
                                    borderRadius: '8px',
                                    textAlign: 'center',
                                    minWidth: '150px'
                                }}>
                                    <Typography variant="h4" sx={{ color: '#ef6c00', fontWeight: 'bold' }}>
                                        {filenotdetected.length}
                                    </Typography>
                                    <Typography variant="body2" sx={{ color: '#ef6c00' }}>
                                        ⚠️ Not Detected
                                    </Typography>
                                </Box>
                            </Box>

                            {/* Expandable list of processed files */}
                            {fileprocess.length > 0 && (
                                <details style={{ marginTop: '1rem' }}>
                                    <summary style={{ cursor: 'pointer', fontWeight: '600', color: '#333' }}>
                                        View Processed Files ({fileprocess.length})
                                    </summary>
                                    <ul style={{ 
                                        maxHeight: '200px', 
                                        overflowY: 'auto', 
                                        marginTop: '0.5rem',
                                        paddingLeft: '1.5rem',
                                        fontSize: '0.9rem'
                                    }}>
                                        {fileprocess.map((file, index) => (
                                            <li key={index} style={{ color: '#2e7d32' }}>{file}</li>
                                        ))}
                                    </ul>
                                </details>
                            )}

                            {fileError.length > 0 && (
                                <details style={{ marginTop: '1rem' }}>
                                    <summary style={{ cursor: 'pointer', fontWeight: '600', color: '#c62828' }}>
                                        View Error Files ({fileError.length})
                                    </summary>
                                    <ul style={{ 
                                        maxHeight: '200px', 
                                        overflowY: 'auto', 
                                        marginTop: '0.5rem',
                                        paddingLeft: '1.5rem',
                                        fontSize: '0.9rem'
                                    }}>
                                        {fileError.map((file, index) => (
                                            <li key={index} style={{ color: '#c62828' }}>{file.name}</li>
                                        ))}
                                    </ul>
                                </details>
                            )}

                            {filenotdetected.length > 0 && (
                                <details style={{ marginTop: '1rem' }}>
                                    <summary style={{ cursor: 'pointer', fontWeight: '600', color: '#ef6c00' }}>
                                        View Not Detected Files ({filenotdetected.length})
                                    </summary>
                                    <ul style={{ 
                                        maxHeight: '200px', 
                                        overflowY: 'auto', 
                                        marginTop: '0.5rem',
                                        paddingLeft: '1.5rem',
                                        fontSize: '0.9rem'
                                    }}>
                                        {filenotdetected.map((file, index) => (
                                            <li key={index} style={{ color: '#ef6c00' }}>{file}</li>
                                        ))}
                                    </ul>
                                </details>
                            )}
                        </div>
                        : null
                }

                {
                    hasProcessed && !loading && (extractedtables.length !== 0 || staticcreated.databasecreated.length !== 0 || staticcreated.tablescreated.length !== 0 || marttables.length !== 0 || stagingtables.length !== 0 || mounts.length !== 0) ?

                        <>
                            <div style={{ width: "80%", marginTop: "3rem" }}>
                                <TabsC mounts={mounts} extractedtables={extractedtables} staticcreated={staticcreated} marttables={marttables} stagingtables={stagingtables} />
                            </div>
                        </>
                        :
                        <></>
                }

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
                                <strong>1. Database Created:</strong><br />
                                Lists all the databases that are created within the uploaded repository.
                            </li>

                            <li style={{ marginBottom: "1rem" }}>
                                <strong>2. Static Tables:</strong><br />
                                Displays tables where data is inserted manually or sourced from Excel files or data dumps.
                            </li>

                            <li style={{ marginBottom: "1rem" }}>
                                <strong>3. Mount Paths:</strong><br />
                                Shows all the mount points created, including both actual and dummy paths extracted from the code.
                            </li>

                            <li style={{ marginBottom: "1rem" }}>
                                <strong>4. Staging Tables:</strong><br />
                                Contains information about staging tables sourced from locations like Blob Storage, Excel, or SQL Data Warehouse. For each table, it includes:
                                <ul style={{ listStyleType: 'disc', paddingLeft: "1.5rem" }}>
                                    <li>Table name (both actual and created names)</li>
                                    <li>Extraction source (e.g., Parquet, Excel, SQL ADW, SharePoint)</li>
                                    <li><code>latestPath</code> variable details</li>
                                    <li>Extraction details like path, SQL DW connection, and queries</li>
                                </ul>
                            </li>

                            <li style={{ marginBottom: "1rem" }}>
                                <strong>5. Mart Tables / Views:</strong><br />
                                The most valuable tab — provides details of mart tables or views including:
                                <ul style={{ listStyleType: 'disc', paddingLeft: "1.5rem" }}>
                                    <li>Table name</li>
                                    <li>Database name</li>
                                    <li>Table type (Created, Referenced, or Altered)</li>
                                    <li>Associated staging tables used during mart table creation</li>
                                </ul>
                            </li>

                            <li style={{ marginBottom: "1rem" }}>
                                <strong>6. Mart to Staging Table Mapping:</strong><br />
                                Shows the complete end-to-end lineage — a hierarchical mapping of all staging tables used in the creation of mart tables.
                            </li>

                            <li style={{ marginBottom: "1rem" }}>
                                <strong>7. Staging Table Column Level:</strong><br />
                                Lists all the columns used within each staging table for a detailed view of schema-level information.
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

export default Analyze
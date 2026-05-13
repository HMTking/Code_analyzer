import React, { useState } from 'react'
import "./Analyze.css"
import { AppBar, Box, FormControlLabel, IconButton, Toolbar, Typography } from '@mui/material';
import * as XLSX from 'xlsx';
import CircularProgress from '@mui/material/CircularProgress';
import Backdrop from '@mui/material/Backdrop';
import DownloadIcon from '@mui/icons-material/Download';
import Button from '@mui/material/Button';
import logo from "../Images/Logo.png"
import DatabricksLogo from "../Images/FabricLogo.png"
import HowTo1 from "../Images/HowTo1.svg"

function FabricPipeline() {

    const [files, setFiles] = useState([]);
    const [mappingFile, setMappingFile] = useState([]);
    const [filePath, setFilePath] = useState({});

    const [result, setResult] = useState({});

    const handleFileChange = (event) => {
        setFiles([...event.target.files]);
    }

    const handleMappingFileChange = (event) => {
        setMappingFile([...event.target.files]);
        const file = event.target.files[0];
        const reader = new FileReader();

        reader.onload = (e) => {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: 'array' });

            // Assuming the first sheet is the one we want to read
            const firstSheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[firstSheetName];

            // Convert the sheet to JSON
            const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
            console.log(jsonData)
            setMappingFile(jsonData);
        };

        reader.readAsArrayBuffer(file);
    }


    const handleSubmit = () => {
        setLoading(true);
        const newResult = {};
        const fileNameMapping = {};

        const processFile = (file) => {
            return new Promise((resolve) => {
                const reader = new FileReader();
                reader.readAsText(file);
                reader.onloadend = () => {
                    const code = reader.result;
                    // console.log("Input content from file")
                    // console.log(code);

                    // Extract the writeTable2 path
                    const writeTable2Regex = /writeTable\("([^"]+)",\s*"([^"]+)",/;
                    // const writeTableRegex = /writeTable\("([^"]+)",\s*f\{([^}]+)\}\/([^"]+)"/;
                    const writeTable2Match = code.match(writeTable2Regex);
                    // console.log(writeTable2Match)
                    const writeTable2Path = writeTable2Match ? writeTable2Match[2].toLowerCase() : null;
                    // console.log(writeTable2Path)

                    if (writeTable2Path) {
                        newResult[writeTable2Path] = [];
                    }

                    // Extract the getDataframe paths
                    const getDataframeRegex = /getDataframe\(WorkspaceId, LakehouseId, "([^"]+)"\)/g;
                    const getDataframeMatches = [...code.matchAll(getDataframeRegex)];
                    const getDataframePaths = getDataframeMatches.map(match => match[1].toLowerCase());

                    if (writeTable2Path) {
                        newResult[writeTable2Path] = getDataframePaths;

                        // Extract the relevant part of the file path before ".Notebook"
                        const filePath = file.webkitRelativePath;
                        const relevantPath = filePath.substring(0, filePath.indexOf('.Notebook'));
                        // .toLowerCase();
                        fileNameMapping[writeTable2Path] = relevantPath;
                    }

                    resolve();
                }
            });
        }

        const processFiles = async () => {
            for (const file of files) {
                await processFile(file);
            }
            setResult(newResult);
            console.log(newResult)

            setLoading(false)

            const result = traverseDependencyGraph(newResult);
            console.log("Sorted Nodes:", result.sortedNodes);
            console.log("Levels:", result.levels);
            console.log("Node Levels:", result.nodeLevels);

            setSortedLevels(result.levels)
        }

        processFiles();
        setFilePath(fileNameMapping)
    }

    const hasNode = (graph, targetNode) => {
        for (const level in graph) {
            for (const nodeObject of graph[level]) {
                if (nodeObject.hasOwnProperty(targetNode)) {
                    return true;
                }
            }
        }
        return false;
    }

    const traverseAndReplace = (obj, mapping) => {
        console.log(obj)
        console.log(mapping)
        for (const key in obj) {
            if (Array.isArray(obj[key])) {
                obj[key].forEach(item => {
                    for (const innerKey in item) {
                        if (mapping[innerKey]) {
                            item[mapping[innerKey]] = item[innerKey];
                            delete item[innerKey];
                        }
                        if (Array.isArray(item[mapping[innerKey]])) {
                            item[mapping[innerKey]] = item[mapping[innerKey]].map(subItem => mapping[subItem] || subItem);
                        }
                    }
                });
            }
        }
    }

    const [dataJson, setDataJson] = useState();
    const [sortedLevels, setSortedLevels] = useState();
    const [circular, setCircular] = useState();

    const [loading, setLoading] = useState(false);

    // Original approach
    /*
    const topologicalSortDFS = (graph) => {
        const stack = [];
        const visited = new Set();

        const dfs = (node) => {
            const lowerCaseNode = node.toLowerCase();
            visited.add(lowerCaseNode);
            if (graph[lowerCaseNode]) {
                for (const adjacent of graph[lowerCaseNode]) {
                    if (!visited.has(adjacent)) {
                        dfs(adjacent);
                    }
                }
            }
            stack.push(lowerCaseNode);
        };

        for (const node in graph) {
            const lowerCaseNode = node.toLowerCase();
            if (!visited.has(lowerCaseNode)) {
                dfs(lowerCaseNode);
            }
        }

        // return stack.reverse();
        return stack;
    }
    */

    const topologicalSortDFS = (graph) => {
        const stack = [];
        const visited = new Set();
        const recStack = new Set();
        const circularDependency = [];

        const dfs = (node) => {
            const lowerCaseNode = node.toLowerCase();
            if (recStack.has(lowerCaseNode)) {
                circularDependency.push(lowerCaseNode);
                return;
            }
            if (visited.has(lowerCaseNode)) {
                return;
            }

            visited.add(lowerCaseNode);
            recStack.add(lowerCaseNode);

            if (graph[lowerCaseNode]) {
                for (const adjacent of graph[lowerCaseNode]) {
                    dfs(adjacent);
                }
            }

            recStack.delete(lowerCaseNode);
            stack.push(lowerCaseNode);
        };

        for (const node in graph) {
            const lowerCaseNode = node.toLowerCase();
            if (!visited.has(lowerCaseNode)) {
                dfs(lowerCaseNode);
            }
        }

        console.log("These are the circular dependencies:")
        console.log(circularDependency)

        setCircular(circularDependency)
        console.log("The below mentioned is the dependency graph:")
        console.log(stack)

        return stack;
    };

    const traverseDependencyGraph = (graph) => {
        const sortedNodes = topologicalSortDFS(graph);
        const levels = {};
        const levelsNotebookName = {};
        const nodeLevels = {};

        sortedNodes.forEach(node => {
            let maxLevel = 0;
            if (graph[node]) {
                graph[node].forEach(adjacent => {
                    maxLevel = Math.max(maxLevel, nodeLevels[adjacent] + 1 || 1);
                });
            }
            nodeLevels[node] = maxLevel;
            if (!levels[maxLevel]) levels[maxLevel] = [];

            // Only push nodes that are present in the graph JSON as a property
            if (graph.hasOwnProperty(node)) {
                const nodeObject = {};
                nodeObject[node] = graph[node].filter(adjacent => {
                    const adjacentLevel = nodeLevels[adjacent];
                    return adjacentLevel !== undefined && adjacentLevel < maxLevel && hasNode(levels, adjacent);
                });

                // levels[maxLevel].push(nodeObject);
                if (nodeObject[node].length === 0) {
                    if (!levels[0]) {
                        levels[0] = [];
                    }
                    levels[0].push(nodeObject);
                } else {
                    if (!levels[maxLevel]) {
                        levels[maxLevel] = [];
                    }
                    levels[maxLevel].push(nodeObject);
                }
            }
        })

        traverseAndReplace(levels, filePath);

        // Remove empty levels from the levels object
        for (const level in levels) {
            if (levels[level].length === 0) {
                delete levels[level];
            }
        }

        const pipeline = transformLevelsToPipeline(levels);
        console.log("Edit JSON:")
        console.log(JSON.stringify(pipeline, null, 2));

        setDataJson(pipeline)

        return { sortedNodes, levels, nodeLevels }
    }


    function transformLevelsToPipeline(levels) {
        // console.log(mappingFile)
        const activities = [];
        const activityNames = {};

        // Helper function to create activity objects
        function createActivity(name, dependencies) {
            const entry = mappingFile.find(item => item[0] === name);
            return {
                name: name,
                type: "TridentNotebook",
                dependsOn: dependencies.map(dep => ({
                    activity: dep,
                    dependencyConditions: ["Succeeded"]
                })),
                typeProperties: {
                    "notebookId": entry ? entry[1] : null,
                    "workspaceId": process.env.REACT_APP_FABRIC_WORKSPACE_ID //dynamic
                }
            };
        }

        // Iterate through levels and create activities
        Object.keys(levels).forEach(level => {
            levels[level].forEach(nodeObject => {
                Object.keys(nodeObject).forEach(node => {
                    const dependencies = nodeObject[node];
                    const activityName = node.split('/').pop(); // Extract the last part of the path as the activity name
                    const notebookPath = `/path/to/${activityName}`;
                    const baseParameters = { param: `value${level}` }; // Example base parameters

                    // Create the activity
                    const activity = createActivity(activityName, dependencies.map(dep => dep.split('/').pop()), notebookPath, baseParameters);
                    activities.push(activity);
                    activityNames[node] = activityName;
                });
            });
        });

        // Construct the final pipeline JSON
        const pipeline = {
            name: "ExamplePipeline",
            properties: {
                activities: activities
            }
        };

        return pipeline;
    }

    function handleDownload(data, filename) {
        const jsonStr = JSON.stringify(data, null, 2); // Pretty print
        const blob = new Blob([jsonStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);

        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        link.click();

        URL.revokeObjectURL(url);
    }

    function downloadExcel() {
        handleDownload(dataJson, "Pipeline Json")
        handleDownload(sortedLevels, "Levels")
        handleDownload(circular, "Circular Dependency")
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
                                            (item.label === "Pipeline Migrator") ? '#3A3A3A' :
                                                'white',
                                        fontFamily: "Poppins, sans-serif",
                                        fontWeight:
                                            (item.label === "Pipeline Migrator")
                                                ? 'bold'
                                                : 'normal',
                                        borderBottom:
                                            (item.label === "Pipeline Migrator")
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
                        {dataJson ? <Button color="inherit" onClick={downloadExcel}><DownloadIcon /></Button> : <></>}
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
                            Automated the process of creating a Fabric Data Pipelines by generating the Notebook Dependency Lineage in JSON format.
                            Reduced manual effort in identifying data product dependencies across all notebooks in the repository.
                            Eliminated the time-consuming task of manually creating Data Pipelines based on identified data product dependencies. <br></br>
                        </p>
                    </div>

                    {/* Right Section */}
                    <div className='right__section' style={{ flex: 1, marginLeft: '2rem', padding: '2rem', backgroundColor: '#ffffff', borderRadius: '12px', boxShadow: '0px 4px 20px rgba(0,0,0,0.1)' }}>
                        <div>
                            Upload Fabric Repository Folder:<br></br>
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
                        </div><br></br>
                        <div>
                            Upload Mapping File: <a
                                style={{
                                    textDecoration: "underline",
                                    display: "inline",
                                    marginTop: "1rem",
                                    color: "#0066cc",
                                    cursor: "pointer"
                                }}
                                target="_blank"
                                rel="noopener noreferrer"
                                href="https://testmaq-my.sharepoint.com/:u:/g/personal/urjag_maqsoftware_com/EUZUYqXwpiFBqMbR4V0_qEkBcL8WtAV4JsQLJIKdF68evQ?e=Ue4Jjc&xsdata=..."
                            >
                                Fetch all the Notebook IDs.ipynb
                            </a><br></br>

                            <input
                                type="file"
                                multiple
                                onChange={handleMappingFileChange}
                                className="fileInput"
                            /> <br></br>
                        </div>
                        <button onClick={handleSubmit} className='submitButton' 
                        // disabled={files.length === 0} 
                        style={{
                            marginTop: '1rem',
                            padding: '0.75rem 1.5rem',
                            backgroundColor: '#059bbf',
                            color: '#fff',
                            border: 'none',
                            borderRadius: '6px',
                            cursor: files.length === 0 ? 'not-allowed' : 'pointer',
                            fontWeight: 'bold',
                            fontSize: '1rem'
                        }}>Submit</button>

                    </div>
                </div>

                <Backdrop sx={{ color: '#fff', zIndex: (theme) => theme.zIndex.drawer + 1 }} open={loading}>
                    <CircularProgress color="inherit" />
                </Backdrop>

                <div style={{ display: 'flex', gap: '2rem', marginTop: '1rem', width: "auto", marginBottom: "2rem" }}>
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
            </div>
        </div>
    )
}

export default FabricPipeline
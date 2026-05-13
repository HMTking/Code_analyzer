import React, { useEffect, useState } from 'react'
import AppBar from '@mui/material/AppBar';
import Box from '@mui/material/Box';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import DownloadIcon from '@mui/icons-material/Download';
import { Tooltip } from '@mui/material';
import XLSX from 'xlsx-js-style';
import logo from "../Images/Logo.png"

function Navbar({ mounts, extractedtables, staticcreated, marttables, viewdetails, loading, stagingtables, flagpage }) {

    // Check if processing happened in this session (uses sessionStorage - cleared on tab close)
    const isSessionActive = () => {
        return sessionStorage.getItem('codeAnalyzerSessionProcessed') === 'true';
    };

    // Check if Fabric Enhanced session is active
    const isFabricEnhancedSessionActive = () => {
        return sessionStorage.getItem('fabricEnhancedSessionProcessed') === 'true';
    };

    // Check if lineage data exists in localStorage
    const checkLineageData = () => {
        try {
            // First check if session is active - don't show old data from previous sessions
            if (!isSessionActive()) return false;
            
            const stored = localStorage.getItem('codeAnalyzerOutput');
            if (!stored) return false;
            
            const data = JSON.parse(stored);
            const repos = data?.Repos;
            if (!repos) return false;
            
            // Check any repo for data
            for (const repoKey of Object.keys(repos)) {
                const repo = repos[repoKey];
                if (repo?.MartTables?.length > 0 || repo?.StagingTable?.length > 0) {
                    return true;
                }
            }
            return false;
        } catch (e) {
            console.error('Error checking lineage data:', e);
            return false;
        }
    };

    // Check if Fabric Enhanced lineage data exists
    const checkFabricEnhancedLineageData = () => {
        try {
            if (!isFabricEnhancedSessionActive()) return false;
            const stored = localStorage.getItem('fabricEnhancedOutput');
            if (!stored) return false;
            const data = JSON.parse(stored);
            if (data?.goldDetails?.length > 0 || data?.silverDetails?.length > 0) {
                return true;
            }
            return false;
        } catch (e) {
            return false;
        }
    };

    const [hasLineageData, setHasLineageData] = useState(false);
    const [hasFabricEnhancedLineageData, setHasFabricEnhancedLineageData] = useState(false);
    const [forceUpdate, setForceUpdate] = useState(0);

    // Check on mount and when props change
    useEffect(() => {
        const hasData = checkLineageData();
        const hasFabricData = checkFabricEnhancedLineageData();
        console.log('Navbar mount/update check - hasData:', hasData, 'hasFabricData:', hasFabricData, 'marttables:', marttables?.length, 'loading:', loading);
        setHasLineageData(hasData);
        setHasFabricEnhancedLineageData(hasFabricData);
    }, [forceUpdate]);

    // Update when marttables or stagingtables change
    useEffect(() => {
        if (marttables?.length > 0 || stagingtables?.length > 0) {
            console.log('Navbar: Props updated - marttables:', marttables.length);
            setHasLineageData(true);
        }
    }, [marttables, stagingtables]);

    // Listen for custom events
    useEffect(() => {
        const handleDataCleared = () => {
            console.log('Navbar: Data cleared');
            setHasLineageData(false);
        };
        
        const handleDataUpdated = () => {
            console.log('Navbar: Data updated event');
            setForceUpdate(prev => prev + 1);
            // Also directly check
            setTimeout(() => {
                const hasData = checkLineageData();
                console.log('Navbar: After event check - hasData:', hasData);
                setHasLineageData(hasData);
            }, 100);
        };

        const handleFabricEnhancedDataUpdated = () => {
            console.log('Navbar: Fabric Enhanced data updated event');
            setTimeout(() => {
                const hasFabricData = checkFabricEnhancedLineageData();
                console.log('Navbar: After Fabric Enhanced event check - hasFabricData:', hasFabricData);
                setHasFabricEnhancedLineageData(hasFabricData);
            }, 100);
        };
        
        window.addEventListener('codeAnalyzerDataCleared', handleDataCleared);
        window.addEventListener('codeAnalyzerDataUpdated', handleDataUpdated);
        window.addEventListener('fabricEnhancedDataUpdated', handleFabricEnhancedDataUpdated);
        window.addEventListener('storage', handleDataUpdated);
        
        // Initial check
        const hasData = checkLineageData();
        const hasFabricData = checkFabricEnhancedLineageData();
        setHasLineageData(hasData);
        setHasFabricEnhancedLineageData(hasFabricData);
        
        return () => {
            window.removeEventListener('codeAnalyzerDataCleared', handleDataCleared);
            window.removeEventListener('codeAnalyzerDataUpdated', handleDataUpdated);
            window.removeEventListener('fabricEnhancedDataUpdated', handleFabricEnhancedDataUpdated);
            window.removeEventListener('storage', handleDataUpdated);
        };
    }, []);

    const baseNavItems = [
        { label: 'Home', href: '/' },
        { label: 'Data Analysis - Databricks', href: '/v1' },
        { label: 'Data Analysis - Fabric', href: '/v1/fabric' },
        { label: 'Pipeline Migrator', href: '/v1/fabricdatapipeline' },
        { label: 'Notebook Migrator', href: '/v1/fabricnotebook' },
    ];

    // Show Lineage View when:
    // 1. We're on lineage page (flagpage === 2), OR
    // 2. Has marttables prop data, OR
    // 3. Has localStorage data AND not loading
    const showLineageView = flagpage === 2 || marttables?.length > 0 || (hasLineageData && !loading);
    const showFabricLineageView = flagpage === 3 || hasFabricEnhancedLineageData;
    
    console.log('Navbar render - showLineageView:', showLineageView, 'showFabricLineageView:', showFabricLineageView, 'flagpage:', flagpage);
    
    // Build nav items with both lineage views if available
    let navItems = [...baseNavItems];
    if (showLineageView) {
        navItems.push({ label: 'Lineage View', href: '/v1/lineageView' });
    }

    const [MartToStg, setMartToStg] = useState([]);
    // const [ViewsToStg, setViewsToStg] = useState([]);


    const [flag, setFlag] = useState(false);

    // Helper to normalize table name for matching
    const normalizeTableNameForMatch = (name) => {
        if (!name) return '';
        const parts = name.split('.');
        return parts[parts.length - 1].toLowerCase();
    };

    // Helper to find if a table exists as a mart table
    const isIntermediateTable = (tableName) => {
        const normalizedName = normalizeTableNameForMatch(tableName);
        return marttables.some(t => {
            const normalizedMart = normalizeTableNameForMatch(t.tablename);
            return normalizedMart === normalizedName && 
                   t.Stagingtableused && 
                   t.Stagingtableused.length > 0;
        });
    };

    // Get the actual staging tables of an intermediate table
    const getIntermediateStagingTables = (tableName) => {
        const normalizedName = normalizeTableNameForMatch(tableName);
        const martTable = marttables.find(t => 
            normalizeTableNameForMatch(t.tablename) === normalizedName
        );
        return martTable?.Stagingtableused || [];
    };

    function getStagingTablesUsed(tablename) {
        const allMartTables = marttables;
        let dbname = '';
        let shortName = tablename;
        if (tablename.includes(".")) {
            const parts = tablename.split(".");
            shortName = parts[parts.length - 1];
            dbname = parts.length > 1 ? parts[0] : '';
        }
        
        // Find matching mart table
        const tables = allMartTables.filter(table => {
            const tableShortName = table.tablename.includes('.') 
                ? table.tablename.split('.').pop() 
                : table.tablename;
            return tableShortName.toLowerCase() === shortName.toLowerCase() && 
                   (dbname === '' || table.databasename?.toLowerCase() === dbname.toLowerCase());
        });
        
        let stagingTablesUsed = tables.map(table => table.Stagingtableused).flat();
        
        // Clean up redundant dependencies
        // If we have intermediate tables, remove their children from direct dependencies
        const intermediates = stagingTablesUsed.filter(t => isIntermediateTable(t));
        if (intermediates.length > 0) {
            const transitiveChildren = new Set();
            intermediates.forEach(interTable => {
                const children = getIntermediateStagingTables(interTable);
                children.forEach(child => {
                    transitiveChildren.add(normalizeTableNameForMatch(child));
                });
            });
            
            // Filter out tables that are reachable through intermediates
            stagingTablesUsed = stagingTablesUsed.filter(t => {
                const normalized = normalizeTableNameForMatch(t);
                return !transitiveChildren.has(normalized);
            });
        }
        
        return stagingTablesUsed;
    }

    function addStagingTables(tableName, level, entry = {}, visited = new Set()) {
        const normalizedName = normalizeTableNameForMatch(tableName);
        if (visited.has(normalizedName)) {
            return;
        }
        visited.add(normalizedName);

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
                const normalizedStaging = normalizeTableNameForMatch(stagingTable);
                if (normalizedName !== normalizedStaging) {
                    addStagingTables(stagingTable, level + 1, entryCopy, visited);
                }
            });
        } else {

            setMartToStg(prevState => {
                let martToStgSet = new Set(prevState.map(e => JSON.stringify(e)));
                martToStgSet.add(JSON.stringify(entryCopy));
                return Array.from(martToStgSet).map(e => JSON.parse(e));
            });
        }
    }

    const showDownload =
        (extractedtables.length !== 0 ||
            staticcreated.databasecreated.length !== 0 ||
            staticcreated.tablescreated.length !== 0 ||
            marttables.length !== 0 ||
            viewdetails.length !== 0) &&
        !loading;


    useEffect(() => {
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

        console.log(mtTables)

        mtTables.forEach(table => {
            let entry = {}
            addStagingTables(table.FullTableName, 0, entry);
        });

        setFlag(true)

        // console.log(MartToStg)
        // console.log(mtTables)
    }, [marttables])

    // Explicit column name mappings for known columns
    const columnNameMappings = {
        'tablename': 'Table Name',
        'databasename': 'Database Name',
        'tabletype': 'Table Type',
        'filepathname': 'File Path Name',
        'fulltablename': 'Full Table Name',
        'stagingtableused': 'Staging Table Used',
        'columnsused': 'Columns Used',
        'columnused': 'Column Used',
        'tableusedwithdatabase': 'Table Used With Database',
        'viewname': 'View Name',
        'mountpoint': 'Mount Point',
        'sourcepath': 'Source Path',
        'stagingused1': 'Staging Used 1',
        'stagingused2': 'Staging Used 2',
        'stagingused3': 'Staging Used 3',
        'stagingused4': 'Staging Used 4',
        'stagingused5': 'Staging Used 5',
        'stagingused6': 'Staging Used 6',
        'stagingused7': 'Staging Used 7',
        'stagingused8': 'Staging Used 8',
        'stagingused9': 'Staging Used 9',
        'stagingused10': 'Staging Used 10'
    };

    // Helper function to format column names to proper case with spaces
    const formatColumnName = (name) => {
        // Check explicit mapping first
        const lowerName = name.toLowerCase();
        if (columnNameMappings[lowerName]) {
            return columnNameMappings[lowerName];
        }
        
        // Handle numbers at the end (StagingUsed1 -> StagingUsed 1)
        let result = name.replace(/(\D)(\d)/g, '$1 $2');
        // Handle camelCase and PascalCase - insert space before each capital letter
        result = result.replace(/([a-z])([A-Z])/g, '$1 $2');
        // Split by common separators and rejoin with spaces
        return result
            .replace(/_/g, ' ')
            .replace(/\s+/g, ' ')
            .trim()
            .split(' ')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
            .join(' ');
    };

    // Helper function to transform data with formatted column names
    const transformDataWithFormattedColumns = (data) => {
        if (!data || data.length === 0) return { data: [], columnMap: {} };
        
        const columnMap = {};
        const keys = Object.keys(data[0] || {});
        
        keys.forEach(key => {
            columnMap[key] = formatColumnName(key);
        });
        
        const transformedData = data.map(row => {
            const newRow = {};
            keys.forEach(key => {
                newRow[columnMap[key]] = row[key];
            });
            return newRow;
        });
        
        return { data: transformedData, columnMap };
    };

    // Helper function to auto-fit column widths and format sheet with styled headers
    const formatSheet = (ws, data) => {
        if (!data || data.length === 0) return ws;
        
        // Get all keys (column headers)
        const keys = Object.keys(data[0] || {});
        
        // Calculate max width for each column
        const colWidths = keys.map((key, colIndex) => {
            let maxWidth = key.length;
            data.forEach(row => {
                const value = row[key];
                if (value !== null && value !== undefined) {
                    const cellLength = String(value).length;
                    maxWidth = Math.max(maxWidth, cellLength);
                }
            });
            return { wch: Math.min(maxWidth + 3, 55) };
        });
        
        ws['!cols'] = colWidths;
        
        // Style header row (first row) - Dark blue like Excel table
        // xlsx-js-style requires patternType: 'solid' for fills
        const headerStyle = {
            font: { bold: true, color: { rgb: 'FFFFFF' }, sz: 11 },
            fill: { patternType: 'solid', fgColor: { rgb: '4472C4' } },
            alignment: { horizontal: 'center', vertical: 'center' },
            border: {
                top: { style: 'thin', color: { rgb: '4472C4' } },
                bottom: { style: 'thin', color: { rgb: '4472C4' } },
                left: { style: 'thin', color: { rgb: '4472C4' } },
                right: { style: 'thin', color: { rgb: '4472C4' } }
            }
        };
        
        // Style data cells
        const cellStyle = {
            alignment: { horizontal: 'left', vertical: 'center' },
            border: {
                top: { style: 'thin', color: { rgb: 'D9D9D9' } },
                bottom: { style: 'thin', color: { rgb: 'D9D9D9' } },
                left: { style: 'thin', color: { rgb: 'D9D9D9' } },
                right: { style: 'thin', color: { rgb: 'D9D9D9' } }
            }
        };
        
        // Apply header styles
        keys.forEach((key, colIndex) => {
            const cellRef = XLSX.utils.encode_cell({ r: 0, c: colIndex });
            if (ws[cellRef]) {
                ws[cellRef].s = headerStyle;
            }
        });
        
        // Apply cell styles to data rows
        data.forEach((row, rowIndex) => {
            keys.forEach((key, colIndex) => {
                const cellRef = XLSX.utils.encode_cell({ r: rowIndex + 1, c: colIndex });
                if (ws[cellRef]) {
                    ws[cellRef].s = cellStyle;
                }
            });
        });
        
        // Set row height for header
        ws['!rows'] = [{ hpt: 25 }];
        
        // Add autofilter for header row
        const lastCol = XLSX.utils.encode_col(keys.length - 1);
        const lastRow = data.length;
        ws['!autofilter'] = { ref: `A1:${lastCol}${lastRow + 1}` };
        
        return ws;
    };

    const downloadExcel = () => {
        const wb = XLSX.utils.book_new();

        // Mounts Sheet
        if (mounts.length > 0) {
            const { data: formattedMounts } = transformDataWithFormattedColumns(mounts);
            const mountsSheet = formatSheet(XLSX.utils.json_to_sheet(formattedMounts), formattedMounts);
            XLSX.utils.book_append_sheet(wb, mountsSheet, "Mounts");
        }

        // Extracted Tables Sheet
        if (extractedtables.length > 0) {
            const { data: formattedExtracted } = transformDataWithFormattedColumns(extractedtables);
            const extractedtablesSheet = formatSheet(XLSX.utils.json_to_sheet(formattedExtracted), formattedExtracted);
            XLSX.utils.book_append_sheet(wb, extractedtablesSheet, "Extracted Tables");
        }

        // const formattedStaticcreated = {
        //     databasecreated: staticcreated.databasecreated.join(', '),
        //     tablescreated: staticcreated.tablescreated.join(', '),
        //     filepathname: staticcreated.filepathname.join(", ")
        // };

        // const staticcreatedSheet = XLSX.utils.json_to_sheet([formattedStaticcreated]);
        // XLSX.utils.book_append_sheet(wb, staticcreatedSheet, "Static Created");

        // Mart Tables Sheet
        let flattenedMarttables = [];
        marttables.forEach(table => {
            const { ColumnUsed, Stagingtableused, ...otherProps } = table;

            if (Stagingtableused.length === 0) {
                flattenedMarttables.push({
                    ...otherProps,
                    Stagingtableused: null
                });
            } else {
                Stagingtableused.forEach(stagingTable => {
                    flattenedMarttables.push({
                        ...otherProps,
                        Stagingtableused: stagingTable
                    });
                });
            }
        });

        if (flattenedMarttables.length > 0) {
            const { data: formattedMart } = transformDataWithFormattedColumns(flattenedMarttables);
            const marttablesSheet = formatSheet(XLSX.utils.json_to_sheet(formattedMart), formattedMart);
            XLSX.utils.book_append_sheet(wb, marttablesSheet, "Mart Tables");
        }

        // Views Sheet
        let flattenedviews = [];
        viewdetails.forEach(table => {
            const { Tableusedwithdatabase, ...otherProps } = table;

            if (Tableusedwithdatabase.length === 0) {
                flattenedviews.push({
                    ...otherProps,
                    Tableusedwithdatabase: null
                });
            } else {
                Tableusedwithdatabase.forEach(tableUsed => {
                    flattenedviews.push({
                        ...otherProps,
                        Tableusedwithdatabase: tableUsed
                    });
                });
            }
        });

        if (flattenedviews.length > 0) {
            const { data: formattedViews } = transformDataWithFormattedColumns(flattenedviews);
            const viewsSheet = formatSheet(XLSX.utils.json_to_sheet(formattedViews), formattedViews);
            XLSX.utils.book_append_sheet(wb, viewsSheet, "Views");
        }

        // Staging Table - Column Sheet
        const stagingtablesc = [];
        stagingtables.forEach(table => {
            const { ColumnsUsed, ...otherProps } = table;

            if (ColumnsUsed.length == 0) {
                stagingtablesc.push({
                    ...otherProps,
                    ColumnsUsed: null
                });
            } else {
                ColumnsUsed.forEach(column => {
                    stagingtablesc.push({
                        ...otherProps,
                        ColumnsUsed: column
                    });
                });
            }
        });

        if (stagingtablesc.length > 0) {
            const { data: formattedStaging } = transformDataWithFormattedColumns(stagingtablesc);
            const stagingSheet = formatSheet(XLSX.utils.json_to_sheet(formattedStaging), formattedStaging);
            XLSX.utils.book_append_sheet(wb, stagingSheet, "Staging Table - Column");
        }

        // Mart To Staging Tables Sheet
        marttables.forEach(table => {
            let entry = {}
            addStagingTables(table.tablename, 0, entry);
            setFlag(true)
        });

        // viewdetails.forEach(view => {
        //     let entry = {}
        //     addStagingTables(table.tablename, 0, entry);
        //     setFlag(true);
        // })

        // const stagingtablesSheet = XLSX.utils.json_to_sheet(martToStg);
        // XLSX.utils.book_append_sheet(wb, stagingtablesSheet, "Mart To Staging Tables");

        // const flattenedStagingtables = stagingtables.map(table => ({
        //     ...table,
        //     ColumnsUsed: Array.isArray(table.ColumnsUsed) ? table.ColumnsUsed.join(', ') : table.ColumnsUsed,
        // }));

        // const stagingtablesSheet = XLSX.utils.json_to_sheet(flattenedStagingtables);
        // XLSX.utils.book_append_sheet(wb, stagingtablesSheet, "Staging Tables");

        if (MartToStg.length > 0) {
            const { data: formattedMartToStg } = transformDataWithFormattedColumns(MartToStg);
            const stagingtablesSheet = formatSheet(XLSX.utils.json_to_sheet(formattedMartToStg), formattedMartToStg);
            XLSX.utils.book_append_sheet(wb, stagingtablesSheet, "Mart To Staging Tables");
        }

        // Write with explicit options for styling support
        XLSX.writeFile(wb, "Data.xlsx", { bookType: 'xlsx', type: 'binary' });
    };

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
        <>
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
                                        (flagpage === 1 && item.label === "Data Analysis - Databricks") ? '#3A3A3A' :
                                            (flagpage === 0 && item.label === "Data Analysis - Fabric") ? '#3A3A3A' :
                                                (flagpage === 2 && item.label === "Lineage View") ? '#3A3A3A' :
                                                    'white',
                                    fontFamily: "Poppins, sans-serif",
                                    fontWeight:
                                        (flagpage === 1 && item.label === "Data Analysis - Databricks") ||
                                            (flagpage === 0 && item.label === "Data Analysis - Fabric") ||
                                            (flagpage === 2 && item.label === "Lineage View")
                                            ? 'bold'
                                            : 'normal',
                                    borderBottom:
                                        (flagpage === 1 && item.label === "Data Analysis - Databricks") ||
                                            (flagpage === 0 && item.label === "Data Analysis - Fabric") ||
                                            (flagpage === 2 && item.label === "Lineage View")
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
                    {showDownload && (
                        <IconButton onClick={downloadExcel} sx={{ color: 'white' }}>
                            <DownloadIcon />
                        </IconButton>
                    )}
                </Toolbar>
            </AppBar>
        </>
    );
}

export default Navbar

import React, { useState, useEffect, useCallback, useRef } from 'react';
import ReactFlow, { useNodesState, useEdgesState, addEdge, MiniMap, Controls, Background, MarkerType } from 'reactflow';
import ColorSelectorNode from './CustomNode';
import 'reactflow/dist/style.css';
import '../App.css';
import './OutputView.css';
import Button from 'react-bootstrap/Button';
import Container from 'react-bootstrap/Container';
import Navbar from './Navbar';
import Row from 'react-bootstrap/Row';
import Col from 'react-bootstrap/Col';
import Form from 'react-bootstrap/Form';
import XLSX from 'xlsx-js-style';
import { toPng } from 'html-to-image';
import IconButton from '@mui/material/IconButton';
import DownloadIcon from '@mui/icons-material/Download';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import TableChartIcon from '@mui/icons-material/TableChart';
import ImageIcon from '@mui/icons-material/Image';

const initBgColor = '#1A192B';
const connectionLineStyle = { stroke: '#fff' };
const snapGrid = [20, 20];
const nodeTypes = {
    selectorNode: ColorSelectorNode,
};
const defaultViewport = { x: 0, y: 0, zoom: 1.5 };

function OutputView() {

    // Read data from localStorage (set by Analyze.js)
    const getStoredData = () => {
        const stored = localStorage.getItem('codeAnalyzerOutput');
        console.log('Raw localStorage data:', stored ? stored.substring(0, 200) + '...' : 'NULL');
        if (stored) {
            try {
                const parsed = JSON.parse(stored);
                console.log('Parsed MartTables count:', parsed?.Repos?.OCPStaging_Digital?.MartTables?.length || 0);
                return parsed;
            } catch (e) {
                console.error('Error parsing stored data:', e);
            }
        }
        // Default empty structure if no data found
        return {
            "Repos": {
                "OCPStaging_Digital": {
                    "StaticCreated": { "databasecreated": [], "tablescreated": [], "filepathname": [] },
                    "ExtractedTables": [],
                    "Mounts": [],
                    "MartTables": [],
                    "StagingTable": [],
                    "ViewDetails": []
                }
            }
        };
    };

    const [outputJSON, setOutputJSON] = useState(getStoredData());

    // Listen for data updates (when Analyze.js saves new data)
    useEffect(() => {
        const handleStorageChange = () => {
            console.log('Storage changed, reloading data...');
            setOutputJSON(getStoredData());
        };

        // Listen for custom event (same-tab communication)
        const handleCustomEvent = (event) => {
            console.log('Received new data from Analyze:', event.detail);
            setOutputJSON(event.detail);
        };

        window.addEventListener('storage', handleStorageChange);
        window.addEventListener('codeAnalyzerDataUpdated', handleCustomEvent);

        // Load data on component mount
        const storedData = getStoredData();
        console.log('Loaded data from localStorage:', storedData);
        setOutputJSON(storedData);

        return () => {
            window.removeEventListener('storage', handleStorageChange);
            window.removeEventListener('codeAnalyzerDataUpdated', handleCustomEvent);
        };
    }, []);

    // Old hardcoded data (keeping for reference, can be removed)

    let filteredJSON = outputJSON;
    const martTables = outputJSON?.Repos?.OCPStaging_Digital?.MartTables || [];
    
    // Restore lineage view state from localStorage
    const getStoredLineageState = () => {
        const stored = localStorage.getItem('lineageViewState');
        if (stored) {
            try {
                return JSON.parse(stored);
            } catch (e) {
                console.error('Error parsing lineage state:', e);
            }
        }
        return null;
    };
    
    const storedLineageState = getStoredLineageState();
    
    // Ref for ReactFlow container (for image download)
    const flowRef = useRef(null);
    
    // Ref for ReactFlow instance to call fitView programmatically
    const reactFlowInstance = useRef(null);
    
    const [selectedTable, setSelectedTable] = useState(storedLineageState?.selectedTable || '');
    const [nodes, setNodes, onNodesChange] = useNodesState(storedLineageState?.nodes || []);
    const [edges, setEdges, onEdgesChange] = useEdgesState(storedLineageState?.edges || []);
    const [bgColor, setBgColor] = useState(initBgColor);
    const [checked, setChecked] = useState(storedLineageState?.checked || false);
    const [isFiltered, setIsFiltered] = useState(storedLineageState?.isFiltered || false);
    
    // Download menu state
    const [downloadMenuAnchor, setDownloadMenuAnchor] = useState(null);
    const downloadMenuOpen = Boolean(downloadMenuAnchor);
    
    const handleDownloadClick = (event) => {
        setDownloadMenuAnchor(event.currentTarget);
    };
    
    const handleDownloadClose = () => {
        setDownloadMenuAnchor(null);
    };
    
    // Display name mappings for lineage view (frontend only)
    const tableDisplayNameMappings = {
        'CampaignLeads': 'MarketingEngagements',
        'AssetLeads': 'ContentEngagements',
        'TempAzureConsumedRevenue': 'TempUsageMetrics',
        'TempFieldRevenueAccountability': 'TempFinancialMetrics'
    };

    // Helper function to get display name for a table (handles full table names like "AnalyticsDW.CampaignLeads")
    const getTableDisplayName = (tableName) => {
        if (!tableName) return tableName;
        // Extract the simple table name (last part after dots)
        const parts = tableName.split('.');
        const simpleTableName = parts[parts.length - 1];
        // Check if we have a mapping for this table
        if (tableDisplayNameMappings[simpleTableName]) {
            // Replace the simple name in the full name
            parts[parts.length - 1] = tableDisplayNameMappings[simpleTableName];
            return parts.join('.');
        }
        return tableName;
    };

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
        's.no': 'S.No',
        'source table': 'Source Table',
        'target table': 'Target Table',
        'relationship': 'Relationship'
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
    
    // Helper function to auto-fit column widths and style headers
    const formatExcelSheet = (ws, data) => {
        if (!data || data.length === 0) return ws;
        
        const keys = Object.keys(data[0] || {});
        const colWidths = keys.map(key => {
            let maxWidth = key.length;
            data.forEach(row => {
                const value = row[key];
                if (value !== null && value !== undefined) {
                    maxWidth = Math.max(maxWidth, String(value).length);
                }
            });
            return { wch: Math.min(maxWidth + 3, 55) };
        });
        
        ws['!cols'] = colWidths;
        
        // Style header row - Dark blue like Excel table
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
        
        ws['!rows'] = [{ hpt: 25 }];
        
        // Add autofilter for header row
        const lastCol = XLSX.utils.encode_col(keys.length - 1);
        const lastRow = data.length;
        ws['!autofilter'] = { ref: `A1:${lastCol}${lastRow + 1}` };
        
        return ws;
    };
    
    const downloadTableRelations = () => {
        const relations = [];
        edges.forEach((edge, index) => {
            const sourceNode = nodes.find(n => n.id === edge.source);
            const targetNode = nodes.find(n => n.id === edge.target);
            if (sourceNode && targetNode) {
                relations.push({
                    'S.No': index + 1,
                    'Source Table': sourceNode.data.label,
                    'Target Table': targetNode.data.label,
                    'Relationship': 'Depends On'
                });
            }
        });
        const wb = XLSX.utils.book_new();
        const ws = formatExcelSheet(XLSX.utils.json_to_sheet(relations), relations);
        XLSX.utils.book_append_sheet(wb, ws, 'Table Relations');
        const displaySelectedTable = selectedTable ? getTableDisplayName(selectedTable) : selectedTable;
        const fileName = isFiltered && displaySelectedTable ? `Lineage_${displaySelectedTable}.xlsx` : 'Lineage_All_Tables.xlsx';
        XLSX.writeFile(wb, fileName, { bookType: 'xlsx', type: 'binary' });
        handleDownloadClose();
    };
    
    const downloadLineageImage = () => {
        if (!nodes || nodes.length === 0) {
            alert('No diagram to download');
            handleDownloadClose();
            return;
        }
        
        // Calculate bounds manually for compatibility
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        nodes.forEach(node => {
            const x = node.position.x;
            const y = node.position.y;
            const width = node.style?.width ? parseInt(node.style.width) : 250;
            const height = 60;
            
            minX = Math.min(minX, x);
            minY = Math.min(minY, y);
            maxX = Math.max(maxX, x + width);
            maxY = Math.max(maxY, y + height);
        });
        
        // Add padding 
        const padding = 80;
        const diagramWidth = maxX - minX + padding * 2;
        const diagramHeight = maxY - minY + padding * 2;
        
        // Calculate scale to fit everything
        const scale = 1;
        const imageWidth = diagramWidth * scale;
        const imageHeight = diagramHeight * scale;
        
        // Calculate translation to center the diagram
        const translateX = (-minX + padding) * scale;
        const translateY = (-minY + padding) * scale;
        
        // Find the viewport element
        const viewportEl = flowRef.current?.querySelector('.react-flow__viewport');
        
        if (viewportEl) {
            // Store original transform
            const originalTransform = viewportEl.style.transform;
            
            // Apply transform to show full diagram
            viewportEl.style.transform = `translate(${translateX}px, ${translateY}px) scale(${scale})`;
            
            // Small delay to let the transform apply
            setTimeout(() => {
                toPng(flowRef.current, {
                    backgroundColor: '#f5f5f5',
                    width: imageWidth,
                    height: imageHeight,
                    quality: 1,
                    pixelRatio: 2,
                    filter: (node) => {
                        // Exclude the download button
                        if (node.getAttribute && node.getAttribute('data-html2canvas-ignore') === 'true') {
                            return false;
                        }
                        // Exclude ReactFlow controls
                        if (node.classList && node.classList.contains('react-flow__controls')) {
                            return false;
                        }
                        return true;
                    }
                }).then((dataUrl) => {
                    // Restore original transform
                    viewportEl.style.transform = originalTransform;
                    
                    const link = document.createElement('a');
                    const displaySelectedTable = selectedTable ? getTableDisplayName(selectedTable) : selectedTable;
                    link.download = isFiltered && displaySelectedTable ? `Lineage_${displaySelectedTable}.png` : 'Lineage_All_Tables.png';
                    link.href = dataUrl;
                    link.click();
                }).catch((err) => {
                    // Restore original transform on error
                    viewportEl.style.transform = originalTransform;
                    console.error('Error downloading image:', err);
                    alert('Failed to download image. Please try again.');
                });
            }, 100);
        } else {
            alert('Could not find diagram viewport');
        }
        handleDownloadClose();
    };
    
    // Save lineage view state to localStorage whenever it changes
    useEffect(() => {
        if (checked && (nodes.length > 0 || edges.length > 0)) {
            const lineageState = {
                nodes,
                edges,
                selectedTable,
                checked,
                isFiltered
            };
            localStorage.setItem('lineageViewState', JSON.stringify(lineageState));
            console.log('✅ Lineage view state saved');
        }
    }, [nodes, edges, selectedTable, checked, isFiltered]);

    const handleSelectChange = (event) => {
        setSelectedTable(event.target.value);
    };

    const handleFilter = async () => {
        if (!selectedTable || selectedTable === '') {
            // If no table selected, show all
            setIsFiltered(false);
            handleSubmit();
            return;
        }
        setIsFiltered(true);
        // Clear existing nodes and edges first
        setNodes([]);
        setEdges([]);
        // Small delay to ensure state is cleared before new render
        setTimeout(() => {
            renderFilteredLineage(selectedTable);
        }, 50);
    }

    const renderFilteredLineage = (tblName) => {
        console.log('=== renderFilteredLineage called for:', tblName, '===');
        const newNodes = [];
        const newEdges = [];
        let nodeMap = new Map(); // Maps table name to node id
        let nodeId = 0;

        const repo = outputJSON?.Repos?.OCPStaging_Digital;
        if (!repo || !repo.MartTables) {
            console.log('No data available - repo:', repo);
            return;
        }
        
        console.log('Total MartTables in data:', repo.MartTables.length);
        console.log('MartTables names:', repo.MartTables.map(t => t.tablename));

        // Helper function to normalize table name for matching
        const normalizeTableName = (name) => {
            if (!name) return '';
            // Remove database prefix if present (e.g., "AnalyticsDW.Stage.TableName" -> "TableName")
            const parts = name.split('.');
            return parts[parts.length - 1].toLowerCase();
        };

        // Helper function to find a mart table by name (handles various formats)
        const findMartTable = (tableName) => {
            if (!tableName) return null;
            const normalizedInput = normalizeTableName(tableName);
            
            return repo.MartTables.find(t => {
                // Direct match (case-insensitive)
                if (t.tablename?.toLowerCase() === tableName.toLowerCase()) return true;
                if (t.FullTableName?.toLowerCase() === tableName.toLowerCase()) return true;
                // Match normalized names
                if (normalizeTableName(t.tablename) === normalizedInput) return true;
                if (normalizeTableName(t.FullTableName) === normalizedInput) return true;
                return false;
            });
        };

        // Helper function to find dependencies of a table (recursive)
        const findDependencies = (tableName, visited = new Set()) => {
            const normalizedName = normalizeTableName(tableName);
            if (visited.has(normalizedName)) return [];
            visited.add(normalizedName);

            let dependencies = [];

            // Check if it's a mart table
            const martTable = findMartTable(tableName);
            console.log(`Finding dependencies for: ${tableName}, found mart table:`, martTable?.tablename || 'NOT FOUND');
            if (martTable && martTable.Stagingtableused && martTable.Stagingtableused.length > 0) {
                console.log(`  -> Staging tables used:`, martTable.Stagingtableused);
                martTable.Stagingtableused.forEach(dep => {
                    if (dep) {
                        dependencies.push({ parent: tableName, child: dep });
                        // Recursively find dependencies of this dependency
                        const childDeps = findDependencies(dep, visited);
                        dependencies = dependencies.concat(childDeps);
                    }
                });
            }

            return dependencies;
        };

        // Get all dependencies recursively
        let allDependencies = findDependencies(tblName);
        console.log('All dependencies found (before cleanup):', allDependencies);
        console.log('Total MartTables available:', repo.MartTables.length);
        
        // Post-process: Remove redundant direct dependencies
        // If A depends on B, and B depends on C, then A -> C direct link is redundant
        const cleanupRedundantDependencies = (deps) => {
            // Build a map of what each table's children are
            const childrenMap = new Map();
            deps.forEach(dep => {
                const normalizedParent = normalizeTableName(dep.parent);
                if (!childrenMap.has(normalizedParent)) {
                    childrenMap.set(normalizedParent, new Set());
                }
                childrenMap.get(normalizedParent).add(normalizeTableName(dep.child));
            });
            
            console.log('Children map:', [...childrenMap.entries()].map(([k,v]) => [k, [...v]]));
            
            // Find direct dependencies of the target that are also mart tables (intermediates)
            const targetNorm = normalizeTableName(tblName);
            const directChildren = childrenMap.get(targetNorm) || new Set();
            
            // Find which direct children are intermediate tables (have their own children)
            const intermediateTables = [...directChildren].filter(child => {
                return childrenMap.has(child) && childrenMap.get(child).size > 0;
            });
            
            console.log('Direct children of target:', [...directChildren]);
            console.log('Intermediate tables (have their own deps):', intermediateTables);
            
            if (intermediateTables.length === 0) {
                // No intermediates - nothing to clean up
                return deps;
            }
            
            // Collect all tables reachable through intermediates
            const transitiveChildren = new Set();
            const collectAllChildren = (tableNorm, visited = new Set()) => {
                if (visited.has(tableNorm)) return;
                visited.add(tableNorm);
                
                const children = childrenMap.get(tableNorm);
                if (children) {
                    children.forEach(child => {
                        transitiveChildren.add(child);
                        collectAllChildren(child, visited);
                    });
                }
            };
            
            intermediateTables.forEach(t => collectAllChildren(t));
            console.log('Tables reachable through intermediates:', [...transitiveChildren]);
            
            // Remove direct dependencies from target to tables that are reachable via intermediates
            return deps.filter(dep => {
                const parentNorm = normalizeTableName(dep.parent);
                const childNorm = normalizeTableName(dep.child);
                
                // Only filter direct deps from the target table
                if (parentNorm === targetNorm && transitiveChildren.has(childNorm)) {
                    console.log(`Removing redundant: ${dep.parent} -> ${dep.child} (reachable via intermediate)`);
                    return false;
                }
                return true;
            });
        };
        
        allDependencies = cleanupRedundantDependencies(allDependencies);
        console.log('All dependencies found (after cleanup):', allDependencies);
        console.log('Total dependencies count:', allDependencies.length);

        // If no dependencies found, at least show the target table
        if (allDependencies.length === 0) {
            console.log('No dependencies found, showing only target table');
        }

        // Build level map based on MINIMUM distance from target (for proper grouping)
        const levelMap = new Map();
        levelMap.set(tblName, 0);

        // Calculate minimum level for each table (closest path to target)
        let changed = true;
        while (changed) {
            changed = false;
            allDependencies.forEach(dep => {
                const parentLevel = levelMap.get(dep.parent);
                if (parentLevel !== undefined) {
                    const currentLevel = levelMap.get(dep.child);
                    const newLevel = parentLevel + 1;
                    if (currentLevel === undefined || newLevel < currentLevel) {
                        levelMap.set(dep.child, newLevel);
                        changed = true;
                    }
                }
            });
        }

        // Find max level
        const maxLevel = Math.max(...levelMap.values(), 0);
        console.log('Max level:', maxLevel);
        console.log('Level map:', [...levelMap.entries()]);

        // Group tables by level
        const levelGroups = new Map();
        levelMap.forEach((level, tableName) => {
            if (!levelGroups.has(level)) {
                levelGroups.set(level, []);
            }
            levelGroups.get(level).push(tableName);
        });
        console.log('Level groups:', [...levelGroups.entries()]);

        // Sort tables within each level to minimize edge crossings
        // Tables that connect to similar targets should be adjacent
        levelGroups.forEach((tables, level) => {
            if (level < maxLevel) {
                tables.sort((a, b) => {
                    // Find what each table connects to
                    const aTargets = allDependencies.filter(d => d.child === a).map(d => d.parent);
                    const bTargets = allDependencies.filter(d => d.child === b).map(d => d.parent);
                    // Sort by first target alphabetically
                    const aFirst = aTargets[0] || '';
                    const bFirst = bTargets[0] || '';
                    return aFirst.localeCompare(bFirst);
                });
            }
        });

        // Calculate layout parameters
        const nodeWidth = 240;
        const nodeHeight = 45;
        const horizontalGap = 320; // Space between levels (columns)
        const verticalGap = 65; // Space between nodes in same level

        // Find the level with most nodes
        let maxNodesInLevel = 0;
        levelGroups.forEach((tables) => {
            maxNodesInLevel = Math.max(maxNodesInLevel, tables.length);
        });

        // Level labels and colors
        const levelConfig = {
            0: { color: '#e65100', label: 'Target', border: '#bf360c' },
            1: { color: '#7b1fa2', label: 'Direct Dependencies', border: '#4a148c' },
            2: { color: '#1565c0', label: 'Level 2 Sources', border: '#0d47a1' },
            3: { color: '#00838f', label: 'Level 3 Sources', border: '#006064' },
            4: { color: '#2e7d32', label: 'Level 4 Sources', border: '#1b5e20' }
        };

        // Create nodes positioned by level
        console.log('Creating nodes for each level group...');
        levelGroups.forEach((tables, level) => {
            console.log(`Level ${level}: ${tables.length} tables - `, tables);
            const xPosition = (maxLevel - level) * horizontalGap + 80;
            const totalHeight = tables.length * (nodeHeight + verticalGap) - verticalGap;
            const canvasHeight = Math.max(maxNodesInLevel * (nodeHeight + verticalGap), 400);
            const startY = (canvasHeight - totalHeight) / 2 + 30;

            const config = levelConfig[level] || levelConfig[4];

            tables.forEach((tableName, index) => {
                if (!nodeMap.has(tableName)) {
                    const id = nodeId++;
                    const yPosition = startY + index * (nodeHeight + verticalGap);
                    console.log(`  Creating node ${id} for "${tableName}" at x=${xPosition}, y=${yPosition}`);

                    // Check if this table connects to multiple levels (multi-connection node)
                    const connections = allDependencies.filter(d => d.child === tableName);
                    const isMultiConnection = connections.length > 1;

                    newNodes.push({
                        id: String(id),
                        position: { x: xPosition, y: yPosition },
                        data: { label: getTableDisplayName(tableName) },
                        sourcePosition: 'right',
                        targetPosition: 'left',
                        style: {
                            width: `${nodeWidth}px`,
                            padding: '10px 14px',
                            background: config.color,
                            color: '#fff',
                            fontWeight: level === 0 ? '700' : '500',
                            fontSize: '11px',
                            borderRadius: '6px',
                            border: isMultiConnection ? `3px dashed #ffd700` : `2px solid ${config.border}`,
                            boxShadow: isMultiConnection
                                ? '0 4px 12px rgba(255, 215, 0, 0.4)'
                                : '0 3px 8px rgba(0,0,0,0.25)',
                            textAlign: 'center'
                        }
                    });
                    nodeMap.set(tableName, id);
                }
            });
        });
        console.log('Total nodes created:', newNodes.length);

        // Create edges with different colors for direct vs indirect connections
        console.log('Creating edges...');
        allDependencies.forEach(dep => {
            const sourceId = nodeMap.get(dep.child);
            const targetId = nodeMap.get(dep.parent);
            const targetLevel = levelMap.get(dep.parent);
            
            console.log(`  Edge: ${dep.child} -> ${dep.parent}, sourceId=${sourceId}, targetId=${targetId}`);

            if (sourceId !== undefined && targetId !== undefined) {
                // Direct connection to target gets special styling
                const isDirect = targetLevel === 0;

                newEdges.push({
                    id: `edge-${sourceId}-${targetId}-${Math.random()}`,
                    source: String(sourceId),
                    target: String(targetId),
                    sourceHandle: 'right',
                    targetHandle: 'left',
                    type: 'smoothstep',
                    animated: isDirect,
                    style: {
                        stroke: isDirect ? '#ff5722' : '#666',
                        strokeWidth: isDirect ? 3 : 2
                    },
                    markerEnd: {
                        type: MarkerType.ArrowClosed,
                        color: isDirect ? '#ff5722' : '#666',
                        width: 18,
                        height: 18
                    }
                });
            } else {
                console.log(`  WARNING: Could not create edge - missing node IDs`);
            }
        });
        console.log('Total edges created:', newEdges.length);

        setNodes(newNodes);
        setEdges(newEdges);
        setChecked(true);
        console.log('Lineage rendering complete');
        
        // Fit view to show all nodes after filtering
        setTimeout(() => {
            if (reactFlowInstance.current) {
                reactFlowInstance.current.fitView({ padding: 0.2, duration: 300 });
            }
        }, 100);
    }

    const filterJSON = (category, tblName) => {
        console.log("JSON should be filtered for category " + category + " and tablename " + tblName);
        Object.keys(outputJSON.Repos).forEach((repoKey) => {
            const repo = outputJSON.Repos[repoKey];

            if (repo.MartTables) {
                repo.MartTables = repo.MartTables.filter(table =>
                    table.tablename === tblName ||
                    (table.Stagingtableused && table.Stagingtableused.includes(tblName))
                );
            }

        });
        // console.log(filteredJSON)
        handleSubmit()
    };

    const handleSubmit = async () => {
        // Clear existing nodes and edges first
        setNodes([]);
        setEdges([]);
        
        // Small delay to ensure state is cleared
        await new Promise(resolve => setTimeout(resolve, 50));
        
        const newNodes = [];
        const newEdges = [];
        // let usedStagingTables = new Set();
        let usedStagingTables = new Map();
        let usedMartTables = new Map();


        let nodeId = 0;
        let martTableY = 100; // Initial y position for MartTable nodes
        let stagingTableY = 200; // Initial y position for StagingTable nodes

        Object.keys(outputJSON.Repos).forEach((repoKey) => {
            const repo = outputJSON.Repos[repoKey];

            // Create a node for the repo
            //   const repoNodeId = nodeId++;
            //   newNodes.push({
            //     id: String(repoNodeId),
            //     position: { x: nodeId * 200, y: 20 },
            //     data: { label: repoKey }
            //     // ,type: 'input',
            //   });

            // (1) Create Nodes for all Staging tables in the JSON
            repo.StagingTable.forEach((stagingTableUsed) => {
                const stagingTableNodeId = nodeId++;
                const stg_tbl_name = stagingTableUsed.tablename;
                newNodes.push({
                    id: String(stagingTableNodeId),
                    position: { x: 200, y: stagingTableY }, // x is constant, y increases
                    data: { label: getTableDisplayName(stg_tbl_name) },
                    style: { width: `${getTableDisplayName(stg_tbl_name).length * 10}px` }
                    // type: 'output',
                });
                stagingTableY += 100; // Increase y position for next StagingTable node

                //Store it in a hashmap
                usedStagingTables.set(stg_tbl_name, stagingTableNodeId);

                //   newEdges.push({ id: `${martTableNodeId}-${stagingTableNodeId}`, source: String(martTableNodeId), target: String(stagingTableNodeId) });
            });


            // Create Mart table Nodes and there respective edges with existing staging table node
            repo.MartTables.forEach((martTable) => {

                const mart_tbl_name = martTable.tablename;
                let martTableNodeId;
                if (!usedMartTables.has(mart_tbl_name) && !usedStagingTables.has(mart_tbl_name)) {
                    martTableNodeId = nodeId++
                    newNodes.push({
                        id: String(martTableNodeId),
                        position: { x: 600, y: martTableY }, // x is constant, y increases
                        data: { label: getTableDisplayName(martTable.tablename) }
                        // type: 'output',
                    });
                    martTableY += 100; // Increase y position for next MartTable node
                    // newEdges.push({ id: `${repoNodeId}-${martTableNodeId}`, source: String(repoNodeId), target: String(martTableNodeId) }); 
                    usedMartTables.set(mart_tbl_name, martTableNodeId);
                }
                else {
                    martTableNodeId = (usedMartTables.has(mart_tbl_name) ? usedMartTables.get(mart_tbl_name) : usedStagingTables.get(mart_tbl_name));
                }

                martTable.Stagingtableused.forEach((stagingTableUsed) => {
                    //const stagingTable = repo.StagingTables.find((stagingTable) => stagingTable.tablename === stagingTableUsed);
                    let targetNodeId = null;
                    
                    // Check if it's a staging table
                    if (usedStagingTables.has(stagingTableUsed)) {
                        targetNodeId = usedStagingTables.get(stagingTableUsed);
                    }
                    // Also check if it's a mart table (intermediate table)
                    else if (usedMartTables.has(stagingTableUsed)) {
                        targetNodeId = usedMartTables.get(stagingTableUsed);
                    }
                    // Check by normalized name (without database prefix)
                    else {
                        const normalizedName = stagingTableUsed.split('.').pop();
                        for (const [key, value] of usedStagingTables) {
                            if (key.split('.').pop().toLowerCase() === normalizedName.toLowerCase()) {
                                targetNodeId = value;
                                break;
                            }
                        }
                        if (!targetNodeId) {
                            for (const [key, value] of usedMartTables) {
                                if (key.split('.').pop().toLowerCase() === normalizedName.toLowerCase()) {
                                    targetNodeId = value;
                                    break;
                                }
                            }
                        }
                    }
                    
                    if (targetNodeId !== null) {
                        newEdges.push({ 
                            id: `${targetNodeId}-${martTableNodeId}`, 
                            source: String(targetNodeId), 
                            target: String(martTableNodeId),
                            type: 'smoothstep',
                            style: { stroke: '#888', strokeWidth: 2 },
                            markerEnd: { type: MarkerType.ArrowClosed, color: '#888' }
                        });
                    }
                });
            });

        });

        setNodes(newNodes);
        setEdges(newEdges);
        setChecked(true);
        
        // Fit view to show all nodes
        setTimeout(() => {
            if (reactFlowInstance.current) {
                reactFlowInstance.current.fitView({ padding: 0.2, duration: 300 });
            }
        }, 100);
    }

    // Auto-render lineage view when component loads with data (if no stored state)
    useEffect(() => {
        // Only auto-render if:
        // 1. We have mart tables data
        // 2. No lineage view is currently shown (checked is false)
        // 3. No nodes are currently displayed
        if (martTables.length > 0 && !checked && nodes.length === 0) {
            console.log('Auto-rendering lineage view with', martTables.length, 'tables');
            handleSubmit();
        }
    }, [martTables.length]); // Only run when mart tables data changes

    const onConnect = useCallback(
        (params) =>
            setEdges((eds) => addEdge({ ...params, animated: true, style: { stroke: '#fff' } }, eds)),
        []
    );

    const onElementClick = (event, element) => {
        if (element.type === 'default') {
            setNodes((prevNodes) => {
                const connectedEdges = edges.filter(edge => edge.source === element.id || edge.target === element.id);
                const connectedNodes = prevNodes.filter(node => connectedEdges.some(edge => edge.source === node.id || edge.target === node.id));

                return prevNodes.map(node => {
                    if (node.id === element.id || connectedNodes.some(connectedNode => connectedNode.id === node.id)) {
                        return {
                            ...node,
                            style: { ...node.style, background: 'lightblue', color: 'black' }
                        };
                    } else {
                        return {
                            ...node,
                            style: { ...node.style, background: 'lightgray', color: 'gray' }
                        };
                    }
                });
            });

            setEdges((prevEdges) => {
                return prevEdges.map(edge => {
                    if (edge.source === element.id || edge.target === element.id) {
                        return {
                            ...edge,
                            style: { ...edge.style, stroke: 'blue' },
                            animated: true,
                            arrowHeadType: 'arrowclosed'
                        };
                    } else {
                        return {
                            ...edge,
                            style: { ...edge.style, stroke: 'gray' },
                            animated: false
                        };
                    }
                });
            });
        }
    };

    return (
        <>
            <Navbar
                flagpage={2}
                mounts={[]}
                extractedtables={[]}
                staticcreated={{ databasecreated: [], tablescreated: [], filepathname: [] }}
                marttables={[]}
                viewdetails={[]}
                loading={false}
                stagingtables={[]}
            />
            <div className='lineage-container'>
                <div className='lineage-header'>
                    <h2>Data Lineage View</h2>
                    <p style={{ fontSize: '12px', color: '#666', margin: '5px 0' }}>
                        {martTables.length > 0
                            ? `${martTables.length} tables loaded`
                            : 'No data - Run analysis first on the Data Analysis page'}
                    </p>
                </div>
                <div className='lineage-controls'>
                    <Button className='lineage-btn' style={{ backgroundColor: '#17a2b8', borderColor: '#17a2b8' }} onClick={() => setOutputJSON(getStoredData())}>
                        Refresh Data
                    </Button>
                    <Button className='lineage-btn' type="submit" onClick={handleSubmit}>
                        View Lineage
                    </Button>
                    <Form.Select className='lineage-select' aria-label="Select Table" value={selectedTable} onChange={handleSelectChange}>
                        <option value="">---Select Table Name---</option>
                        {martTables.map((table, index) => (
                            <option key={index} value={table.tablename}>{getTableDisplayName(table.tablename)}</option>
                        ))}
                    </Form.Select>
                    <Button className='lineage-btn lineage-btn-filter' type="submit" onClick={handleFilter}>
                        Filter Lineage
                    </Button>
                    <Button className='lineage-btn' style={{ backgroundColor: '#6c757d', borderColor: '#6c757d' }} onClick={() => {
                        setNodes([]);
                        setEdges([]);
                        setChecked(false);
                        setIsFiltered(false);
                        setSelectedTable('');
                        localStorage.removeItem('lineageViewState');
                    }}>
                        Reset
                    </Button>
                </div>
                {checked ?
                    <div className='lineage-flow-container' ref={flowRef} style={{ position: 'relative' }}>
                        {/* Download button at top-right of graph - excluded from image export */}
                        <div data-html2canvas-ignore="true" style={{ position: 'absolute', top: '10px', right: '10px', zIndex: 10 }}>
                            <IconButton 
                                onClick={handleDownloadClick}
                                sx={{ 
                                    backgroundColor: '#059bbf',
                                    color: 'white',
                                    '&:hover': {
                                        backgroundColor: '#047a99'
                                    }
                                }}
                            >
                                <DownloadIcon />
                            </IconButton>
                            <Menu
                                anchorEl={downloadMenuAnchor}
                                open={downloadMenuOpen}
                                onClose={handleDownloadClose}
                                anchorOrigin={{
                                    vertical: 'bottom',
                                    horizontal: 'right',
                                }}
                                transformOrigin={{
                                    vertical: 'top',
                                    horizontal: 'right',
                                }}
                            >
                                <MenuItem onClick={downloadTableRelations}>
                                    <ListItemIcon>
                                        <TableChartIcon fontSize="small" />
                                    </ListItemIcon>
                                    <ListItemText>Table Relations (Excel)</ListItemText>
                                </MenuItem>
                                <MenuItem onClick={downloadLineageImage}>
                                    <ListItemIcon>
                                        <ImageIcon fontSize="small" />
                                    </ListItemIcon>
                                    <ListItemText>Lineage Diagram (PNG)</ListItemText>
                                </MenuItem>
                            </Menu>
                        </div>
                        <ReactFlow
                            key={isFiltered ? 'filtered' : 'full'}
                            className='lineage-flow'
                            nodes={nodes}
                            edges={edges}
                            onNodesChange={onNodesChange}
                            onEdgesChange={onEdgesChange}
                            onConnect={onConnect}
                            nodeTypes={nodeTypes}
                            onElementClick={onElementClick}
                            connectionLineStyle={connectionLineStyle}
                            snapToGrid={true}
                            snapGrid={snapGrid}
                            fitView
                            minZoom={0.1}
                            maxZoom={2}
                            onInit={(instance) => {
                                reactFlowInstance.current = instance;
                            }}
                        >
                            <Controls />
                            <Background color="#e0e0e0" gap={24} size={1} />
                        </ReactFlow>
                    </div>
                    :
                    <div className='lineage-empty'>
                        <div className='lineage-empty-icon'>📊</div>
                        <div className='lineage-empty-text'>Click "View Lineage" to visualize data flow</div>
                    </div>
                }
            </div>
        </>
    )
}

export default OutputView
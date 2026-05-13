import React, { useState, useEffect, useCallback, useRef } from 'react';
import ReactFlow, { useNodesState, useEdgesState, addEdge, MiniMap, Controls, Background, MarkerType } from 'reactflow';
import ColorSelectorNode from './CustomNode';
import 'reactflow/dist/style.css';
import '../App.css';
import './OutputView.css';
import Button from 'react-bootstrap/Button';
import Form from 'react-bootstrap/Form';
import NavbarEnhanced from './NavbarEnhanced';
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

function OutputViewFabricEnhanced() {

    // Read data from localStorage (set by FabricEnhanced.js)
    const getStoredData = () => {
        const stored = localStorage.getItem('fabricEnhancedOutput');
        console.log('📦 Reading fabricEnhancedOutput from localStorage:', stored ? 'Found' : 'NULL');
        if (stored) {
            try {
                const parsed = JSON.parse(stored);
                console.log('📊 Parsed data counts:', {
                    Bronze: parsed?.bronzeDetails?.length || 0,
                    Silver: parsed?.silverDetails?.length || 0,
                    Gold: parsed?.goldDetails?.length || 0,
                    Pipelines: parsed?.pipelines?.length || 0,
                    Staging: parsed?.stagingtables?.length || 0
                });
                console.log('📋 Bronze tables:', (parsed?.bronzeDetails || []).map(t => t.tablename));
                console.log('📋 Silver tables:', (parsed?.silverDetails || []).map(t => t.tablename));
                console.log('📋 Gold tables:', (parsed?.goldDetails || []).map(t => t.tablename));
                return parsed;
            } catch (e) {
                console.error('❌ Error parsing stored data:', e);
            }
        }
        return {
            pipelines: [],
            bronzeDetails: [],
            silverDetails: [],
            goldDetails: [],
            stagingtables: []
        };
    };

    const [outputJSON, setOutputJSON] = useState(getStoredData());

    useEffect(() => {
        const handleStorageChange = () => {
            console.log('Storage changed, reloading Fabric Enhanced data...');
            setOutputJSON(getStoredData());
        };

        const handleCustomEvent = (event) => {
            console.log('Received new data from FabricEnhanced:', event.detail);
            if (event.detail) {
                setOutputJSON(event.detail);
            } else {
                setOutputJSON(getStoredData());
            }
        };

        window.addEventListener('storage', handleStorageChange);
        window.addEventListener('fabricEnhancedDataUpdated', handleCustomEvent);

        const storedData = getStoredData();
        console.log('Initial Fabric Enhanced data loaded:', storedData);
        setOutputJSON(storedData);

        return () => {
            window.removeEventListener('storage', handleStorageChange);
            window.removeEventListener('fabricEnhancedDataUpdated', handleCustomEvent);
        };
    }, []);

    // Restore lineage view state from localStorage
    const getStoredLineageState = () => {
        const stored = localStorage.getItem('fabricEnhancedLineageState');
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

    const flowRef = useRef(null);
    const reactFlowInstance = useRef(null);

    const [selectedTable, setSelectedTable] = useState(storedLineageState?.selectedTable || '');
    const [nodes, setNodes, onNodesChange] = useNodesState(storedLineageState?.nodes || []);
    const [edges, setEdges, onEdgesChange] = useEdgesState(storedLineageState?.edges || []);
    const [bgColor, setBgColor] = useState(initBgColor);
    const [checked, setChecked] = useState(storedLineageState?.checked || false);
    const [isFiltered, setIsFiltered] = useState(storedLineageState?.isFiltered || false);

    // Column-level inspection — when the user clicks a node, attach a
    // column-list "sub-node" right next to it (right of target tables,
    // left of source tables). The attached node uses a special id prefix
    // so we can find/remove it cleanly between clicks.
    const COLUMN_NODE_PREFIX = '__cols__';
    const COLUMN_EDGE_PREFIX = '__cole__';

    const normalizeForLookup = (name) => {
        if (!name) return '';
        // Take the last segment after "/" or "." so "Bronze/DimTime" and
        // "Bronze.DimTime" and "DimTime" all collide on the same key.
        const lastSlash = name.split('/').pop();
        const lastDot = lastSlash.split('.').pop();
        return lastDot.toLowerCase();
    };

    // Build the inspection payload for a clicked node.
    // `targetForFilter` (optional) limits the consumed-columns view to entries
    // whose `consumerTable` matches the currently-filtered target table — so
    // when the user is viewing the lineage for `DimTotalPartner` and clicks
    // `Bronze/DimReportingPartnerOne`, only the columns DimTotalPartner uses
    // from that source are shown (not the union of every notebook's reads).
    const getNodeDetails = (label, layer, targetForFilter) => {
        const norm = normalizeForLookup(label);
        // selectedTable is stored as "tablename|layer" — strip the layer suffix
        // before normalizing so comparison against consumerTable works.
        const targetNameOnly = targetForFilter
            ? String(targetForFilter).split('|')[0]
            : null;
        const targetNorm = targetNameOnly ? normalizeForLookup(targetNameOnly) : null;
        const { bronzeDetails = [], silverDetails = [], goldDetails = [], stagingtables = [] } = outputJSON || {};

        let layerRow = null;
        if (layer === 'Gold') layerRow = goldDetails.find(t => normalizeForLookup(t.tablename) === norm);
        else if (layer === 'Silver') layerRow = silverDetails.find(t => normalizeForLookup(t.tablename) === norm);
        else if (layer === 'Bronze') layerRow = bronzeDetails.find(t => normalizeForLookup(t.tablename) === norm);

        // Prefer per-(source, consumer) entries when a target filter is active
        // and matching rows exist; otherwise fall back to union over all consumers.
        const allMatchingForSource = stagingtables.filter(t => normalizeForLookup(t.tablename) === norm);
        let matchingStaging = allMatchingForSource;
        if (targetNorm) {
            const filtered = allMatchingForSource.filter(t => t.consumerTable && normalizeForLookup(t.consumerTable) === targetNorm);
            if (filtered.length > 0) matchingStaging = filtered;
        }
        const consumedSet = new Set();
        matchingStaging.forEach(row => {
            (Array.isArray(row?.ColumnsUsed) ? row.ColumnsUsed : []).forEach(c => {
                if (c != null && String(c).trim() !== '') consumedSet.add(String(c).trim());
            });
        });

        const outputColumns = Array.isArray(layerRow?.ColumnUsed) ? layerRow.ColumnUsed : [];
        const consumedColumns = Array.from(consumedSet);

        return { outputColumns, consumedColumns };
    };

    const handleNodeClick = useCallback((_event, node) => {
        if (!node || !node.data) return;
        // Ignore clicks on the column boxes themselves
        if (String(node.id).startsWith(COLUMN_NODE_PREFIX)) return;

        const { outputColumns, consumedColumns } = getNodeDetails(node.data.label, node.data.layer, selectedTable);

        // Decide which side to attach the column box on by the node's layer:
        // Bronze / Source nodes always sit on the LEFT of the diagram → open to the LEFT.
        // Silver / Gold nodes always sit on the RIGHT of the diagram → open to the RIGHT.
        setNodes(curr => {
            const tableNodes = curr.filter(n => !String(n.id).startsWith(COLUMN_NODE_PREFIX));
            // Prefer the freshest copy of this node from the current state
            // (so we use up-to-date position/layer if the user has moved it).
            const liveNode = tableNodes.find(n => n.id === node.id) || node;

            // Decide left vs right by where THIS node sits in the actual graph,
            // not by its layer name. A "Silver" table can be a source feeding a
            // Gold table → it sits on the LEFT of the diagram and must open LEFT.
            // Use the midpoint between min and max x of all table nodes; nodes
            // on/left of midpoint open LEFT, nodes right of midpoint open RIGHT.
            const xs = tableNodes.map(n => n.position?.x ?? 0);
            const minX = xs.length ? Math.min(...xs) : 0;
            const maxX = xs.length ? Math.max(...xs) : 0;
            const myX = liveNode.position?.x ?? 0;
            let isLeftSide;
            if (minX === maxX) {
                // Single column or all nodes share an x → fall back to layer.
                const layerStr = String(liveNode?.data?.layer || '').toLowerCase();
                isLeftSide = layerStr === 'bronze' || layerStr === 'source' || layerStr === 'silver';
            } else {
                const midX = (minX + maxX) / 2;
                isLeftSide = myX < midX;
            }
            console.log('[ColumnBox]', { id: node.id, label: node.data?.label, layer: node.data?.layer, x: myX, minX, maxX, isLeftSide });

            // Left-side nodes act as sources → show consumed columns.
            // Right-side nodes act as targets → show their own output columns.
            const columns = isLeftSide ? consumedColumns : outputColumns;
            const sideLabel = 'Columns';

            // Layer-aware accent palette (a lighter tint of the parent node colour).
            const accent = {
                Gold:   { bg: '#FFF8E1', border: '#DAA520', text: '#5d4200' },
                Silver: { bg: '#ECEFF1', border: '#607D8B', text: '#263238' },
                Bronze: { bg: '#FBE9D6', border: '#CD853F', text: '#5b3a1a' },
                Source: { bg: '#E8F5E9', border: '#2e7d32', text: '#1b5e20' }
            }[node.data.layer] || { bg: '#f5f5f5', border: '#888', text: '#222' };

            const parentWidth = liveNode.style?.width ? parseInt(liveNode.style.width, 10) : 220;
            const boxWidth = 200;
            const gap = 16;
            const colNodeId = `${COLUMN_NODE_PREFIX}${node.id}`;

            const columnNode = {
                id: colNodeId,
                position: {
                    x: isLeftSide ? (liveNode.position?.x ?? 0) - boxWidth - gap : (liveNode.position?.x ?? 0) + parentWidth + gap,
                    y: (liveNode.position?.y ?? 0) - 8
                },
                data: { label: '', layer: '__panel__' },
                draggable: false,
                selectable: false,
                connectable: false,
                sourcePosition: isLeftSide ? 'right' : 'left',
                targetPosition: isLeftSide ? 'right' : 'left',
                className: 'nowheel',
                style: {
                    width: `${boxWidth}px`,
                    padding: 0,
                    background: 'transparent',
                    border: 'none',
                    boxShadow: 'none'
                },
                type: 'default'
            };

            columnNode.data.label = (
                <div style={{
                    background: accent.bg,
                    border: `2px solid ${accent.border}`,
                    borderRadius: 6,
                    color: accent.text,
                    textAlign: 'left',
                    fontSize: 11,
                    fontWeight: 500,
                    boxShadow: '0 3px 8px rgba(0,0,0,0.18)',
                    cursor: 'default'
                }}>
                    <div style={{
                        padding: '6px 10px',
                        borderBottom: `1px solid ${accent.border}`,
                        fontWeight: 700,
                        fontSize: 10,
                        textTransform: 'uppercase',
                        letterSpacing: 0.5,
                        background: 'rgba(255,255,255,0.45)'
                    }}>
                        {sideLabel} ({columns.length})
                    </div>
                    <div
                        className="nowheel"
                        onWheel={(e) => e.stopPropagation()}
                        onWheelCapture={(e) => e.stopPropagation()}
                        style={{ maxHeight: 220, overflowY: 'auto', overscrollBehavior: 'contain', padding: '6px 10px' }}
                    >
                        {columns.length > 0 ? columns.map((c, i) => (
                            <div key={i} style={{ fontFamily: 'monospace', fontSize: 11, padding: '2px 0' }}>{c}</div>
                        )) : (
                            <div style={{ fontStyle: 'italic', color: '#888' }}>No columns recorded.</div>
                        )}
                    </div>
                </div>
            );

            // Dotted connector edge between parent node and column box.
            const connectorEdge = {
                id: `${COLUMN_EDGE_PREFIX}${node.id}`,
                source: isLeftSide ? colNodeId : node.id,
                target: isLeftSide ? node.id : colNodeId,
                type: 'straight',
                animated: false,
                style: { stroke: accent.border, strokeWidth: 2, strokeDasharray: '4 4' },
                selectable: false
            };
            setEdges(prev => [
                ...prev.filter(e => !String(e.id).startsWith(COLUMN_EDGE_PREFIX)),
                connectorEdge
            ]);

            return [
                ...tableNodes,
                columnNode
            ];
        });
    }, [outputJSON, setNodes, setEdges, selectedTable]);

    const clearColumnBoxes = useCallback(() => {
        setNodes(curr => curr.filter(n => !String(n.id).startsWith(COLUMN_NODE_PREFIX)));
        setEdges(curr => curr.filter(e => !String(e.id).startsWith(COLUMN_EDGE_PREFIX)));
    }, [setNodes, setEdges]);

    // Download menu state
    const [downloadMenuAnchor, setDownloadMenuAnchor] = useState(null);
    const downloadMenuOpen = Boolean(downloadMenuAnchor);

    const handleDownloadClick = (event) => {
        setDownloadMenuAnchor(event.currentTarget);
    };

    const handleDownloadClose = () => {
        setDownloadMenuAnchor(null);
    };

    // Helper function to format column names
    const formatColumnName = (name) => {
        let result = name.replace(/(\D)(\d)/g, '$1 $2');
        result = result.replace(/([a-z])([A-Z])/g, '$1 $2');
        return result
            .replace(/_/g, ' ')
            .replace(/\s+/g, ' ')
            .trim()
            .split(' ')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
            .join(' ');
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

        const cellStyle = {
            alignment: { horizontal: 'left', vertical: 'center' },
            border: {
                top: { style: 'thin', color: { rgb: 'D9D9D9' } },
                bottom: { style: 'thin', color: { rgb: 'D9D9D9' } },
                left: { style: 'thin', color: { rgb: 'D9D9D9' } },
                right: { style: 'thin', color: { rgb: 'D9D9D9' } }
            }
        };

        keys.forEach((key, colIndex) => {
            const cellRef = XLSX.utils.encode_cell({ r: 0, c: colIndex });
            if (ws[cellRef]) {
                ws[cellRef].s = headerStyle;
            }
        });

        data.forEach((row, rowIndex) => {
            keys.forEach((key, colIndex) => {
                const cellRef = XLSX.utils.encode_cell({ r: rowIndex + 1, c: colIndex });
                if (ws[cellRef]) {
                    ws[cellRef].s = cellStyle;
                }
            });
        });

        ws['!rows'] = [{ hpt: 25 }];

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
                    'Layer Flow': sourceNode.data.layer + ' → ' + targetNode.data.layer
                });
            }
        });
        const wb = XLSX.utils.book_new();
        const ws = formatExcelSheet(XLSX.utils.json_to_sheet(relations), relations);
        XLSX.utils.book_append_sheet(wb, ws, 'Table Relations');
        const fileName = isFiltered && selectedTable ? `FabricLineage_${selectedTable}.xlsx` : 'FabricLineage_All_Tables.xlsx';
        XLSX.writeFile(wb, fileName, { bookType: 'xlsx', type: 'binary' });
        handleDownloadClose();
    };

    const downloadLineageImage = () => {
        if (!nodes || nodes.length === 0) {
            alert('No diagram to download');
            handleDownloadClose();
            return;
        }

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

        const padding = 80;
        const diagramWidth = maxX - minX + padding * 2;
        const diagramHeight = maxY - minY + padding * 2;

        const scale = 1;
        const imageWidth = diagramWidth * scale;
        const imageHeight = diagramHeight * scale;

        const translateX = (-minX + padding) * scale;
        const translateY = (-minY + padding) * scale;

        const viewportEl = flowRef.current?.querySelector('.react-flow__viewport');

        if (viewportEl) {
            const originalTransform = viewportEl.style.transform;
            viewportEl.style.transform = `translate(${translateX}px, ${translateY}px) scale(${scale})`;

            setTimeout(() => {
                toPng(flowRef.current, {
                    backgroundColor: '#f5f5f5',
                    width: imageWidth,
                    height: imageHeight,
                    quality: 1,
                    pixelRatio: 2,
                    filter: (node) => {
                        if (node.getAttribute && node.getAttribute('data-html2canvas-ignore') === 'true') {
                            return false;
                        }
                        if (node.classList && node.classList.contains('react-flow__controls')) {
                            return false;
                        }
                        return true;
                    }
                }).then((dataUrl) => {
                    viewportEl.style.transform = originalTransform;

                    const link = document.createElement('a');
                    link.download = isFiltered && selectedTable ? `FabricLineage_${selectedTable}.png` : 'FabricLineage_All_Tables.png';
                    link.href = dataUrl;
                    link.click();
                }).catch((err) => {
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
            // Filter out the transient column-box nodes (their data.label is JSX
            // and cannot be JSON-serialized; they are recomputed on each click).
            const persistableNodes = nodes.filter(n => !String(n.id).startsWith(COLUMN_NODE_PREFIX));
            const persistableEdges = edges.filter(e => !String(e.id).startsWith(COLUMN_EDGE_PREFIX));
            const lineageState = {
                nodes: persistableNodes,
                edges: persistableEdges,
                selectedTable,
                checked,
                isFiltered
            };
            localStorage.setItem('fabricEnhancedLineageState', JSON.stringify(lineageState));
            console.log('✅ Fabric Enhanced Lineage view state saved');
        }
    }, [nodes, edges, selectedTable, checked, isFiltered]);

    // Auto-render lineage view when component loads with data (if no stored state)
    const allTablesCount = (outputJSON?.bronzeDetails?.length || 0) + 
                          (outputJSON?.silverDetails?.length || 0) + 
                          (outputJSON?.goldDetails?.length || 0);
    
    useEffect(() => {
        // Only auto-render if:
        // 1. We have table data
        // 2. No lineage view is currently shown (checked is false)
        // 3. No nodes are currently displayed
        if (allTablesCount > 0 && !checked && nodes.length === 0) {
            // Clear any stale lineage state before rendering fresh data
            localStorage.removeItem('fabricEnhancedLineageState');
            console.log('🔄 Auto-rendering lineage view with', allTablesCount, 'tables');
            handleSubmit();
        }
    }, [allTablesCount]); // Only run when table count changes

    // Fit view to screen whenever nodes change
    useEffect(() => {
        if (nodes.length > 0 && reactFlowInstance.current) {
            // Small delay to ensure nodes are rendered
            setTimeout(() => {
                reactFlowInstance.current.fitView({ padding: 0.2, duration: 200 });
            }, 100);
        }
    }, [nodes]);

    const handleSelectChange = (event) => {
        setSelectedTable(event.target.value);
    };

    const handleFilter = async () => {
        if (!selectedTable || selectedTable === '') {
            setIsFiltered(false);
            handleSubmit();
            return;
        }
        setIsFiltered(true);
        setNodes([]);
        setEdges([]);
        
        // Parse selectedTable which is in format "tablename|layer"
        const [tableName, tableLayer] = selectedTable.split('|');
        setTimeout(() => {
            renderFilteredLineage(tableName, tableLayer);
        }, 50);
    }

    const renderFilteredLineage = (tblName, specifiedLayer = null) => {
        console.log('=== renderFilteredLineage for Fabric Enhanced:', tblName, 'Layer:', specifiedLayer, '===');
        console.log('Available data:', {
            bronze: (outputJSON?.bronzeDetails || []).map(t => t.tablename),
            silver: (outputJSON?.silverDetails || []).map(t => t.tablename),
            gold: (outputJSON?.goldDetails || []).map(t => t.tablename)
        });
        
        const newNodes = [];
        const newEdges = [];
        let nodeMap = new Map();
        let nodeId = 0;

        const { bronzeDetails, silverDetails, goldDetails } = outputJSON;

        // Layer config - Databricks medallion architecture colors
        const layerConfig = {
            'Bronze': { color: '#CD853F', border: '#8B5A2B', x: 100 },
            'Silver': { color: '#607D8B', border: '#455A64', x: 450 },
            'Gold': { color: '#DAA520', border: '#B8860B', x: 800 }
        };

        const nodeWidth = 220;
        const nodeHeight = 45;
        const verticalGap = 65;

        // Find the selected table and its dependencies
        const normalizeTableName = (name) => {
            if (!name) return '';
            const parts = name.split('.');
            return parts[parts.length - 1].toLowerCase();
        };

        const findTableInLayer = (tableName, layer) => {
            const normalized = normalizeTableName(tableName);
            let tables = [];
            if (layer === 'Gold') tables = goldDetails || [];
            else if (layer === 'Silver') tables = silverDetails || [];
            else if (layer === 'Bronze') tables = bronzeDetails || [];

            return tables.find(t => normalizeTableName(t.tablename) === normalized);
        };

        // Find which layer the table belongs to (use specified layer if provided)
        const findTableLayer = (tableName, preferredLayer = null) => {
            if (preferredLayer) {
                // Verify the table exists in the preferred layer
                if (findTableInLayer(tableName, preferredLayer)) return preferredLayer;
            }
            // Fallback to auto-detection
            if (findTableInLayer(tableName, 'Gold')) return 'Gold';
            if (findTableInLayer(tableName, 'Silver')) return 'Silver';
            if (findTableInLayer(tableName, 'Bronze')) return 'Bronze';
            return null;
        };

        // Build COMPLETE dependency chain (follow all levels)
        const dependencies = [];
        const visited = new Set();

        // Recursive function to add dependencies at all levels
        const addDependenciesForTable = (tableName, layer) => {
            const tableKey = `${tableName}|${layer}`;
            if (visited.has(tableKey)) return;
            visited.add(tableKey);

            if (layer === 'Gold') {
                const table = (goldDetails || []).find(t => normalizeTableName(t.tablename) === normalizeTableName(tableName));
                if (table && table.Tablesused) {
                    const tablesUsed = Array.isArray(table.Tablesused) ? table.Tablesused : [table.Tablesused];
                    tablesUsed.forEach(dep => {
                        if (dep) {
                            dependencies.push({ from: table.tablename, to: dep, fromLayer: 'Gold', toLayer: 'Silver' });
                            // Recursively get Silver dependencies
                            addDependenciesForTable(dep, 'Silver');
                        }
                    });
                }
            } else if (layer === 'Silver') {
                const table = (silverDetails || []).find(t => normalizeTableName(t.tablename) === normalizeTableName(tableName));
                if (table && table.Tablesused) {
                    const tablesUsed = Array.isArray(table.Tablesused) ? table.Tablesused : [table.Tablesused];
                    tablesUsed.forEach(dep => {
                        if (dep) {
                            dependencies.push({ from: table.tablename, to: dep, fromLayer: 'Silver', toLayer: 'Bronze' });
                            // Recursively get Bronze dependencies
                            addDependenciesForTable(dep, 'Bronze');
                        }
                    });
                }
            } else if (layer === 'Bronze') {
                const table = (bronzeDetails || []).find(t => normalizeTableName(t.tablename) === normalizeTableName(tableName));
                if (table && table.TableUsed) {
                    const tablesUsed = Array.isArray(table.TableUsed) ? table.TableUsed : [table.TableUsed];
                    tablesUsed.forEach(dep => {
                        if (dep) {
                            dependencies.push({ from: table.tablename, to: dep, fromLayer: 'Bronze', toLayer: 'Source' });
                        }
                    });
                }
            }
        };

        // Get direct dependencies of the selected table only
        const selectedLayer = findTableLayer(tblName, specifiedLayer);
        console.log('Selected table layer:', selectedLayer);
        
        // Start building dependencies from selected table
        addDependenciesForTable(tblName, selectedLayer);

        console.log('All dependencies found:', dependencies);

        // Helper to find actual table name in a layer
        const getActualTableName = (depName, layer) => {
            const normalized = normalizeTableName(depName);
            let tables = [];
            if (layer === 'Gold') tables = goldDetails || [];
            else if (layer === 'Silver') tables = silverDetails || [];
            else if (layer === 'Bronze') tables = bronzeDetails || [];
            
            const found = tables.find(t => normalizeTableName(t.tablename) === normalized);
            return found ? found.tablename : depName; // Return original if not found
        };

        // Group tables by layer - use actual table names
        const layerGroups = { Gold: [], Silver: [], Bronze: [], Source: [] };

        // Add selected table (use actual name from layer)
        if (selectedLayer) {
            const actualSelectedName = getActualTableName(tblName, selectedLayer);
            layerGroups[selectedLayer].push(actualSelectedName);
        }

        // Map raw dependency names to actual table names
        const depMapping = new Map(); // Maps raw dep name to actual table name
        
        // Add dependencies - map to actual table names
        dependencies.forEach(dep => {
            const actualToName = getActualTableName(dep.to, dep.toLayer);
            depMapping.set(dep.to, actualToName);
            if (!layerGroups[dep.toLayer].includes(actualToName)) {
                layerGroups[dep.toLayer].push(actualToName);
            }
            // Also add the from table if not already added
            const actualFromName = getActualTableName(dep.from, dep.fromLayer);
            depMapping.set(dep.from, actualFromName);
            if (!layerGroups[dep.fromLayer].includes(actualFromName)) {
                layerGroups[dep.fromLayer].push(actualFromName);
            }
        });

        // Remove empty layers
        Object.keys(layerGroups).forEach(layer => {
            if (layerGroups[layer].length === 0) {
                delete layerGroups[layer];
            }
        });

        console.log('Layer groups:', layerGroups);

        // Extended layer config for Source
        const extendedLayerConfig = {
            ...layerConfig,
            'Source': { color: '#2e7d32', border: '#1b5e20', x: 1150 }
        };

        // Create nodes
        let maxNodesInLayer = Math.max(...Object.values(layerGroups).map(g => g.length), 1);
        const canvasHeight = maxNodesInLayer * (nodeHeight + verticalGap);

        Object.entries(layerGroups).forEach(([layer, tables]) => {
            const config = extendedLayerConfig[layer];
            if (!config) return;

            const totalHeight = tables.length * (nodeHeight + verticalGap) - verticalGap;
            const startY = (canvasHeight - totalHeight) / 2 + 30;

            tables.forEach((tableName, index) => {
                if (!nodeMap.has(tableName)) {
                    const id = String(nodeId++);
                    const yPosition = startY + index * (nodeHeight + verticalGap);
                    const isTarget = normalizeTableName(tableName) === normalizeTableName(tblName);

                    newNodes.push({
                        id,
                        position: { x: config.x, y: yPosition },
                        data: { label: tableName, layer },
                        sourcePosition: 'right',
                        targetPosition: 'left',
                        style: {
                            width: `${nodeWidth}px`,
                            padding: '10px 14px',
                            background: config.color,
                            color: layer === 'Gold' ? '#000' : '#fff',
                            fontWeight: isTarget ? '700' : '500',
                            fontSize: '11px',
                            borderRadius: '6px',
                            border: isTarget ? `3px solid ${config.border}` : `2px solid ${config.border}`,
                            boxShadow: isTarget ? '0 4px 12px rgba(0,0,0,0.4)' : '0 3px 8px rgba(0,0,0,0.25)',
                            textAlign: 'center'
                        }
                    });
                    nodeMap.set(tableName, id);
                }
            });
        });

        // Create edges using mapped actual table names
        dependencies.forEach((dep, index) => {
            const fromName = depMapping.get(dep.from) || dep.from;
            const toName = depMapping.get(dep.to) || dep.to;
            const sourceId = nodeMap.get(fromName);
            const targetId = nodeMap.get(toName);
            console.log(`Edge ${index}: ${fromName} (${sourceId}) -> ${toName} (${targetId})`);
            if (sourceId !== undefined && targetId !== undefined) {
                newEdges.push({
                    id: `edge-${index}`,
                    source: String(targetId),
                    target: String(sourceId),
                    type: 'smoothstep',
                    animated: true,
                    style: { stroke: '#555', strokeWidth: 2 },
                    markerEnd: { type: MarkerType.ArrowClosed, color: '#555' }
                });
            }
        });

        console.log('Nodes created:', newNodes.length, 'Edges created:', newEdges.length);
        setNodes(newNodes);
        setEdges(newEdges);
    };

    const handleSubmit = () => {
        console.log('=== Rendering full Fabric Enhanced Lineage ===');
        console.log('📊 Data available:', {
            Bronze: outputJSON?.bronzeDetails?.length || 0,
            Silver: outputJSON?.silverDetails?.length || 0,
            Gold: outputJSON?.goldDetails?.length || 0
        });
        
        const newNodes = [];
        const newEdges = [];
        let nodeMap = new Map();
        let nodeId = 0;

        const { bronzeDetails, silverDetails, goldDetails } = outputJSON;

        // Databricks medallion architecture colors
        const layerConfig = {
            'Bronze': { color: '#CD853F', border: '#8B5A2B', x: 100 },
            'Silver': { color: '#607D8B', border: '#455A64', x: 450 },
            'Gold': { color: '#DAA520', border: '#B8860B', x: 800 }
        };

        const nodeWidth = 220;
        const nodeHeight = 45;
        const verticalGap = 65;

        // Group all tables by layer
        const layerGroups = {
            Bronze: (bronzeDetails || []).map(t => t.tablename),
            Silver: (silverDetails || []).map(t => t.tablename),
            Gold: (goldDetails || []).map(t => t.tablename)
        };

        // Remove empty layers
        Object.keys(layerGroups).forEach(layer => {
            if (layerGroups[layer].length === 0) {
                delete layerGroups[layer];
            }
        });

        console.log('📋 All layer groups:', layerGroups);

        // Find max nodes in any layer for vertical centering
        let maxNodesInLayer = Math.max(...Object.values(layerGroups).map(g => g.length), 1);
        const canvasHeight = maxNodesInLayer * (nodeHeight + verticalGap);

        // Create nodes for each layer
        Object.entries(layerGroups).forEach(([layer, tables]) => {
            const config = layerConfig[layer];
            if (!config) return;

            const totalHeight = tables.length * (nodeHeight + verticalGap) - verticalGap;
            const startY = (canvasHeight - totalHeight) / 2 + 30;

            tables.forEach((tableName, index) => {
                if (!nodeMap.has(tableName)) {
                    const id = String(nodeId++);
                    const yPosition = startY + index * (nodeHeight + verticalGap);

                    newNodes.push({
                        id,
                        position: { x: config.x, y: yPosition },
                        data: { label: tableName, layer },
                        sourcePosition: 'right',
                        targetPosition: 'left',
                        style: {
                            width: `${nodeWidth}px`,
                            padding: '10px 14px',
                            background: config.color,
                            color: layer === 'Gold' ? '#000' : '#fff',
                            fontWeight: '500',
                            fontSize: '11px',
                            borderRadius: '6px',
                            border: `2px solid ${config.border}`,
                            boxShadow: '0 3px 8px rgba(0,0,0,0.25)',
                            textAlign: 'center'
                        }
                    });
                    nodeMap.set(tableName, id);
                }
            });
        });

        // Helper to normalize table names
        const normalizeTableName = (name) => {
            if (!name) return '';
            const parts = name.split('.');
            return parts[parts.length - 1].toLowerCase();
        };

        // Create edges based on table dependencies
        let edgeIndex = 0;

        // Gold → Silver connections
        (goldDetails || []).forEach(goldTable => {
            if (goldTable.Tablesused) {
                const tablesUsed = Array.isArray(goldTable.Tablesused) ? goldTable.Tablesused : [goldTable.Tablesused];
                tablesUsed.forEach(silverTableName => {
                    const goldNodeId = nodeMap.get(goldTable.tablename);
                    // Find silver table by normalized name
                    const silverTable = (silverDetails || []).find(s => 
                        normalizeTableName(s.tablename) === normalizeTableName(silverTableName)
                    );
                    if (silverTable) {
                        const silverNodeId = nodeMap.get(silverTable.tablename);
                        if (goldNodeId !== undefined && silverNodeId !== undefined) {
                            newEdges.push({
                                id: `edge-${edgeIndex++}`,
                                source: String(silverNodeId),
                                target: String(goldNodeId),
                                type: 'smoothstep',
                                animated: true,
                                style: { stroke: '#555', strokeWidth: 2 },
                                markerEnd: { type: MarkerType.ArrowClosed, color: '#555' }
                            });
                        }
                    }
                });
            }
        });

        // Silver → Bronze connections
        (silverDetails || []).forEach(silverTable => {
            if (silverTable.Tablesused) {
                const tablesUsed = Array.isArray(silverTable.Tablesused) ? silverTable.Tablesused : [silverTable.Tablesused];
                tablesUsed.forEach(bronzeTableName => {
                    const silverNodeId = nodeMap.get(silverTable.tablename);
                    // Find bronze table by normalized name
                    const bronzeTable = (bronzeDetails || []).find(b => 
                        normalizeTableName(b.tablename) === normalizeTableName(bronzeTableName)
                    );
                    if (bronzeTable) {
                        const bronzeNodeId = nodeMap.get(bronzeTable.tablename);
                        if (silverNodeId !== undefined && bronzeNodeId !== undefined) {
                            newEdges.push({
                                id: `edge-${edgeIndex++}`,
                                source: String(bronzeNodeId),
                                target: String(silverNodeId),
                                type: 'smoothstep',
                                animated: true,
                                style: { stroke: '#555', strokeWidth: 2 },
                                markerEnd: { type: MarkerType.ArrowClosed, color: '#555' }
                            });
                        }
                    }
                });
            }
        });

        console.log('Total nodes:', newNodes.length, 'Total edges:', newEdges.length);
        setNodes(newNodes);
        setEdges(newEdges);
        setChecked(true);
    };

    const onConnect = useCallback((params) => setEdges((eds) => addEdge(params, eds)), []);

    // Get ALL tables (Bronze, Silver, Gold) for the dropdown
    const goldTables = outputJSON?.goldDetails || [];
    const silverTables = outputJSON?.silverDetails || [];
    const bronzeTables = outputJSON?.bronzeDetails || [];
    
    // Combine all tables and sort alphabetically
    const allTables = [
        ...goldTables.map(t => ({ ...t, layer: 'Gold' })),
        ...silverTables.map(t => ({ ...t, layer: 'Silver' })),
        ...bronzeTables.map(t => ({ ...t, layer: 'Bronze' }))
    ]
        // Deduplicate by (tablename, layer) so the same table doesn't appear
        // multiple times in the dropdown when it shows up in multiple notebooks.
        .filter((t, idx, arr) => {
            const key = `${(t.tablename || '').toLowerCase()}|${t.layer}`;
            return arr.findIndex(o => `${(o.tablename || '').toLowerCase()}|${o.layer}` === key) === idx;
        })
        .sort((a, b) => (a.tablename || '').localeCompare(b.tablename || ''));

    return (
        <>
            <NavbarEnhanced
                pipelines={outputJSON?.pipelines || []}
                bronzeDetails={outputJSON?.bronzeDetails || []}
                silverDetails={outputJSON?.silverDetails || []}
                goldDetails={outputJSON?.goldDetails || []}
                stagingtables={outputJSON?.stagingtables || []}
                loading={false}
                flagpage={3}
            />
            <div className='lineage-container'>
                <div className='lineage-header'>
                    <h2>Fabric Enhanced - Data Lineage View</h2>
                    <p style={{ fontSize: '12px', color: '#666', margin: '5px 0' }}>
                        {allTables.length > 0
                            ? `${allTables.length} tables loaded | Bronze: ${bronzeTables.length} | Silver: ${silverTables.length} | Gold: ${goldTables.length}`
                            : 'No data - Run analysis first on the Fabric Enhanced page'}
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
                        <option value="">---Select Table---</option>
                        {allTables.map((table, index) => (
                            <option key={index} value={`${table.tablename}|${table.layer}`}>
                                {table.tablename} ({table.layer})
                            </option>
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
                        localStorage.removeItem('fabricEnhancedLineageState');
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
                        {/* Legend */}
                        <div data-html2canvas-ignore="true" style={{
                            position: 'absolute',
                            top: '10px',
                            left: '10px',
                            zIndex: 10,
                            backgroundColor: 'rgba(255,255,255,0.95)',
                            padding: '10px 15px',
                            borderRadius: '6px',
                            boxShadow: '0 2px 6px rgba(0,0,0,0.15)'
                        }}>
                            <div style={{ fontWeight: '600', marginBottom: '8px', fontSize: '12px' }}>Data Layers</div>
                            <div style={{ display: 'flex', gap: '15px', fontSize: '11px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                                    <div style={{ width: 16, height: 16, backgroundColor: '#CD853F', borderRadius: 3 }}></div>
                                    <span>Bronze</span>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                                    <div style={{ width: 16, height: 16, backgroundColor: '#607D8B', borderRadius: 3 }}></div>
                                    <span>Silver</span>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                                    <div style={{ width: 16, height: 16, backgroundColor: '#DAA520', borderRadius: 3 }}></div>
                                    <span>Gold</span>
                                </div>
                            </div>
                        </div>
                        <ReactFlow
                            key={isFiltered ? 'filtered' : 'full'}
                            className='lineage-flow'
                            nodes={nodes}
                            edges={edges}
                            onNodesChange={onNodesChange}
                            onEdgesChange={onEdgesChange}
                            onConnect={onConnect}
                            onNodeClick={handleNodeClick}
                            onPaneClick={clearColumnBoxes}
                            nodeTypes={nodeTypes}
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
                        <div className='lineage-empty-text'>
                            {allTablesCount > 0 
                                ? 'Click "View Lineage" to visualize Bronze → Silver → Gold data flow'
                                : 'No data available. Run analysis on the Fabric Enhanced page first, then click "Refresh Data"'}
                        </div>
                    </div>
                }
            </div>
        </>
    );
}

export default OutputViewFabricEnhanced;

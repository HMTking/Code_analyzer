import React, { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import ReactFlow, { useNodesState, useEdgesState, Controls, Background, MarkerType } from 'reactflow';
import 'reactflow/dist/style.css';
import './OutputView.css';
import NavbarEnhanced from './NavbarEnhanced';
import {
    Box, Typography, FormControl, InputLabel, Select, MenuItem,
    Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
    Paper, Tabs, Tab, Chip, CircularProgress, TextField, Autocomplete,
    IconButton, Tooltip, Alert, Card, CardContent
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import KeyboardArrowRightIcon from '@mui/icons-material/KeyboardArrowRight';
import Button from 'react-bootstrap/Button';
import Form from 'react-bootstrap/Form';
import DownloadIcon from '@mui/icons-material/Download';
import TableChartIcon from '@mui/icons-material/TableChart';
import ImageIcon from '@mui/icons-material/Image';
import Menu from '@mui/material/Menu';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import XLSX from 'xlsx-js-style';
import { toPng } from 'html-to-image';

const backend_url = process.env.REACT_APP_API_BASE_URL;

function RepoExplorer() {
    const [repos, setRepos] = useState([]);
    const [selectedRepo, setSelectedRepo] = useState(() => sessionStorage.getItem('repoExplorer_selectedRepo') || '');
    const [repoData, setRepoData] = useState(() => {
        try { const d = sessionStorage.getItem('repoExplorer_repoData'); return d ? JSON.parse(d) : null; } catch { return null; }
    });
    const [loading, setLoading] = useState(false);
    const [repoLoading, setRepoLoading] = useState(true);
    const [activeTab, setActiveTab] = useState(0);
    const [tableFilter, setTableFilter] = useState([]);
    const [columnFilter, setColumnFilter] = useState([]);
    const [sourceTableFilter, setSourceTableFilter] = useState([]);
    const [layerFilter, setLayerFilter] = useState([]);

    // Lineage view state
    const [lineageNodes, setLineageNodes, onNodesChange] = useNodesState([]);
    const [lineageEdges, setLineageEdges, onEdgesChange] = useEdgesState([]);
    const [lineageTable, setLineageTable] = useState('');
    const [lineageRendered, setLineageRendered] = useState(false);
    const flowRef = useRef(null);

    // Lineage download menu state
    const [downloadMenuAnchor, setDownloadMenuAnchor] = useState(null);
    const downloadMenuOpen = Boolean(downloadMenuAnchor);
    const handleDownloadClick = (event) => setDownloadMenuAnchor(event.currentTarget);
    const handleDownloadClose = () => setDownloadMenuAnchor(null);

    // Impact analysis state (shared between Columns Used and Lineage View)
    const [impactTables, setImpactTables] = useState([]);
    const [impactColumn, setImpactColumn] = useState([]);
    const [impactResults, setImpactResults] = useState(null); // { deletedTable, deletedColumns, directlyAffected, transitivelyAffected, affectedColumns }
    const [impactActive, setImpactActive] = useState(false);
    const [expandedImpactTables, setExpandedImpactTables] = useState(new Set());
    const [expandedColumnsTables, setExpandedColumnsTables] = useState(new Set());

    // Normalize table names so impact works even when source names are prefixed like Gold/DimX or Bronze.DimX.
    const normalizeTableName = (name) => {
        const raw = (name || '').toString().trim();
        if (!raw) return '';
        let normalized = raw;
        if (normalized.includes('/')) normalized = normalized.split('/').pop();
        if (normalized.includes('.')) normalized = normalized.split('.').pop();
        return normalized.trim();
    };

    // Source table options for impact dropdown, narrowed by selected columns.
    const allTableNames = (() => {
        if (!repoData) return [];
        const selectedColumns = new Set(impactColumn);
        const names = new Set();
        (repoData.ColumnsUsed || []).forEach(r => {
            if (selectedColumns.size === 0 || selectedColumns.has(r.ColumnName)) {
                names.add(normalizeTableName(r.SourceTableName));
            }
        });
        names.delete('');
        return [...names].sort();
    })();

    // Columns for selected impact tables (as source), or all columns if no tables selected
    const impactColumnOptions = (() => {
        if (!repoData) return [];
        const cols = new Set();
        if (impactTables.length === 0) {
            // Return all columns from ColumnsUsed when no table selected
            (repoData.ColumnsUsed || []).forEach(r => {
                if (r.ColumnName) cols.add(r.ColumnName);
            });
        } else {
            // Return columns from selected tables only
            const selectedSources = new Set(impactTables.map(t => normalizeTableName(t)).filter(Boolean));
            (repoData.ColumnsUsed || []).forEach(r => {
                if (selectedSources.has(normalizeTableName(r.SourceTableName))) cols.add(r.ColumnName);
            });
        }
        return [...cols].sort();
    })();

    // Keep selected impact filters valid when the paired filter narrows options.
    useEffect(() => {
        let changed = false;

        const validTables = new Set(allTableNames);
        const nextTables = impactTables.filter(t => validTables.has(t));
        if (nextTables.length !== impactTables.length) {
            setImpactTables(nextTables);
            changed = true;
        }

        const validCols = new Set(impactColumnOptions);
        const nextCols = impactColumn.filter(c => validCols.has(c));
        if (nextCols.length !== impactColumn.length) {
            setImpactColumn(nextCols);
            changed = true;
        }

        if (changed) {
            setImpactResults(null);
            setImpactActive(false);
        }
    }, [allTableNames, impactColumnOptions, impactTables, impactColumn]);

    const getTableLayer = (name) => {
        if (!repoData) return null;
        if ((repoData.GoldLayer || []).find(r => r.TableName === name)) return 'Gold';
        if ((repoData.SilverLayer || []).find(r => r.TableName === name)) return 'Silver';
        if ((repoData.BronzeLayer || []).find(r => r.TableName === name)) return 'Bronze';
        return null;
    };

    const computeImpact = () => {
        if (!repoData || impactTables.length === 0) return;
        const columnsUsed = repoData.ColumnsUsed || [];
        const impactKeys = new Set(impactTables.map(t => normalizeTableName(t)).filter(Boolean));

        // Build adjacency: normalized source table -> edge list
        const sourceToTargets = {};
        columnsUsed.forEach(row => {
            const sourceKey = normalizeTableName(row.SourceTableName);
            const targetKey = normalizeTableName(row.TargetTableName);
            if (!sourceKey || !targetKey) return;
            if (!sourceToTargets[sourceKey]) sourceToTargets[sourceKey] = [];
            sourceToTargets[sourceKey].push({
                sourceKey,
                targetKey,
                targetTable: targetKey,
                sourceTable: sourceKey,
                column: row.ColumnName,
                layer: row.LayerLevel || '',
                notebook: row.NotebookPath || ''
            });
        });

        // Direct affected tables & columns
        const directlyAffected = new Set();
        const affectedColumns = []; // { table, column, layer, isDirect }

        if (impactColumn.length > 0) {
            // Column-level deletion: only rows using selected columns from selected sources
            const selectedColumns = new Set(impactColumn);
            columnsUsed.forEach(row => {
                if (impactKeys.has(normalizeTableName(row.SourceTableName)) && selectedColumns.has(row.ColumnName)) {
                    const targetKey = normalizeTableName(row.TargetTableName);
                    if (!targetKey) return;
                    directlyAffected.add(targetKey);
                    affectedColumns.push({
                        table: targetKey,
                        column: row.ColumnName,
                        layer: row.LayerLevel,
                        notebook: row.NotebookPath,
                        isDirect: true,
                        via: normalizeTableName(row.SourceTableName)
                    });
                }
            });
        } else {
            // Table-level deletion: all targets depending on selected sources
            impactKeys.forEach((impactKey) => {
                (sourceToTargets[impactKey] || []).forEach((edge) => {
                    directlyAffected.add(edge.targetKey);
                    affectedColumns.push({
                        table: edge.targetTable,
                        column: edge.column,
                        layer: edge.layer,
                        notebook: edge.notebook,
                        isDirect: true,
                        via: impactKey
                    });
                });
            });
        }

        // Transitive (cascade) affected: BFS from directly affected tables
        const transitivelyAffected = new Set();
        const queue = [...directlyAffected];
        const visited = new Set([...impactKeys, ...directlyAffected]);
        while (queue.length > 0) {
            const current = queue.shift();
            const downstream = sourceToTargets[current] || [];
            downstream.forEach((edge) => {
                transitivelyAffected.add(edge.targetKey);
                affectedColumns.push({
                    table: edge.targetTable,
                    column: edge.column,
                    layer: edge.layer,
                    notebook: edge.notebook,
                    isDirect: false,
                    via: current
                });
                if (!visited.has(edge.targetKey)) {
                    visited.add(edge.targetKey);
                    queue.push(edge.targetKey);
                }
            });
        }

        setImpactResults({
            deletedTables: [...impactKeys],
            deletedTable: impactTables[0] || '',
            deletedColumns: impactColumn,
            directlyAffected: [...directlyAffected],
            transitivelyAffected: [...transitivelyAffected].filter(t => !directlyAffected.has(t)),
            affectedColumns,
            allAffectedTables: [...new Set([...directlyAffected, ...transitivelyAffected])]
        });
        setImpactActive(true);
    };

    const clearImpact = () => {
        setImpactTables([]);
        setImpactColumn([]);
        setImpactResults(null);
        setImpactActive(false);
        setExpandedImpactTables(new Set());
    };

    // Fetch repos on mount
    useEffect(() => {
        axios.get(`${backend_url}/getrepo-json`)
            .then(res => {
                const data = Array.isArray(res.data) ? res.data : [];
                setRepos(data.map(r => r.RepoName));
                setRepoLoading(false);
            })
            .catch(err => {
                console.error('Error fetching repos:', err);
                setRepoLoading(false);
            });
    }, []);

    // Fetch repo data on selection
    useEffect(() => {
        if (!selectedRepo) {
            setRepoData(null);
            sessionStorage.removeItem('repoExplorer_selectedRepo');
            sessionStorage.removeItem('repoExplorer_repoData');
            return;
        }
        sessionStorage.setItem('repoExplorer_selectedRepo', selectedRepo);
        setLoading(true);
        setTableFilter([]);
        setColumnFilter([]);
        setSourceTableFilter([]);
        setLayerFilter([]);
        clearImpact();
        axios.post(`${backend_url}/get-json`, [selectedRepo])
            .then(res => {
                setRepoData(res.data);
                sessionStorage.setItem('repoExplorer_repoData', JSON.stringify(res.data));
                setLoading(false);
            })
            .catch(err => {
                console.error('Error fetching repo data:', err);
                setLoading(false);
            });
    }, [selectedRepo]);

    const formatSheet = (ws, data) => {
        if (!data || data.length === 0) return ws;
        const keys = Object.keys(data[0] || {});
        ws['!cols'] = keys.map((key) => {
            let maxWidth = key.length;
            data.forEach(row => {
                const value = row[key];
                if (value !== null && value !== undefined) {
                    maxWidth = Math.max(maxWidth, String(value).length);
                }
            });
            return { wch: Math.min(maxWidth + 3, 55) };
        });
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
            if (ws[cellRef]) { ws[cellRef].s = headerStyle; }
        });
        data.forEach((row, rowIndex) => {
            keys.forEach((key, colIndex) => {
                const cellRef = XLSX.utils.encode_cell({ r: rowIndex + 1, c: colIndex });
                if (ws[cellRef]) { ws[cellRef].s = cellStyle; }
            });
        });
        ws['!rows'] = [{ hpt: 25 }];
        const lastCol = XLSX.utils.encode_col(keys.length - 1);
        ws['!autofilter'] = { ref: `A1:${lastCol}${data.length + 1}` };
        return ws;
    };

    const downloadExcel = () => {
        if (!repoData || !selectedRepo) return;
        const wb = XLSX.utils.book_new();

        // Bronze Layer sheet
        const bronzeRows = (repoData.BronzeLayer || []).map(r => ({
            'Table Name': r.TableName, 'Schema Dump': r.SchemaDump || '', 'Notebook Path': r.NotebookPath
        }));
        if (bronzeRows.length > 0) {
            const ws = XLSX.utils.json_to_sheet(bronzeRows);
            XLSX.utils.book_append_sheet(wb, formatSheet(ws, bronzeRows), 'Bronze Layer');
        }

        // Silver Layer sheet
        const silverRows = (repoData.SilverLayer || []).map(r => ({
            'Table Name': r.TableName, 'Schema Dump': r.SchemaDump || '', 'Notebook Path': r.NotebookPath
        }));
        if (silverRows.length > 0) {
            const ws = XLSX.utils.json_to_sheet(silverRows);
            XLSX.utils.book_append_sheet(wb, formatSheet(ws, silverRows), 'Silver Layer');
        }

        // Gold Layer sheet
        const goldRows = (repoData.GoldLayer || []).map(r => ({
            'Table Name': r.TableName, 'Schema Dump': r.SchemaDump || '', 'Notebook Path': r.NotebookPath
        }));
        if (goldRows.length > 0) {
            const ws = XLSX.utils.json_to_sheet(goldRows);
            XLSX.utils.book_append_sheet(wb, formatSheet(ws, goldRows), 'Gold Layer');
        }

        // Columns Used sheet
        const colRows = (repoData.ColumnsUsed || []).map(r => ({
            'Target Table': r.TargetTableName, 'Source Table': r.SourceTableName,
            'Column': r.ColumnName, 'Staging Table Columns': r.StagingTableColumns || r.ColumnName || '',
            'Layer': r.LayerLevel, 'Notebook Path': r.NotebookPath
        }));
        if (colRows.length > 0) {
            const ws = XLSX.utils.json_to_sheet(colRows);
            XLSX.utils.book_append_sheet(wb, formatSheet(ws, colRows), 'Columns Used');
        }

        // Pipelines sheet
        const pipeRows = (repoData.Pipelines || []).map(r => ({
            'Table Name': r.TableName, 'Path': r.Path || '', 'SQL Connection': r.SQLConnection || '',
            'Source Details': r.SourceDetails || '', 'Dump Location': r.DumpLocation || '', 'Column': r.ColumnName || ''
        }));
        if (pipeRows.length > 0) {
            const ws = XLSX.utils.json_to_sheet(pipeRows);
            XLSX.utils.book_append_sheet(wb, formatSheet(ws, pipeRows), 'Pipelines');
        }

        XLSX.writeFile(wb, `${selectedRepo}_RepoData.xlsx`, { bookType: 'xlsx', type: 'binary' });
    };

    // === Lineage View Logic ===
    const layerColors = {
        'Bronze': { color: '#cd7f32', border: '#8b4513' },
        'Silver': { color: '#c0c0c0', border: '#808080' },
        'Gold':   { color: '#ffd700', border: '#daa520' }
    };
    const nodeWidth = 220;
    const nodeHeight = 45;
    const verticalGap = 15;
    const maxPerColumn = 30;
    const colGap = 40;       // gap between columns within a layer
    const layerGap = 150;    // gap between layers

    const buildLineageAll = () => {
        if (!repoData) return;
        const newNodes = [];
        const newEdges = [];
        const nodeMap = new Map();
        let nodeId = 0;

        const bronze = (repoData.BronzeLayer || []).map(r => r.TableName);
        const silver = (repoData.SilverLayer || []).map(r => r.TableName);
        const gold   = (repoData.GoldLayer || []).map(r => r.TableName);

        const layerOrder = [];
        if (bronze.length) layerOrder.push({ name: 'Bronze', tables: bronze });
        if (silver.length) layerOrder.push({ name: 'Silver', tables: silver });
        if (gold.length)   layerOrder.push({ name: 'Gold',   tables: gold });

        let currentX = 100;
        layerOrder.forEach(({ name: layer, tables }) => {
            const cfg = layerColors[layer];
            if (!cfg) return;
            const cols = Math.ceil(tables.length / maxPerColumn);
            tables.forEach((tblName, idx) => {
                if (!nodeMap.has(tblName)) {
                    const id = String(nodeId++);
                    const col = Math.floor(idx / maxPerColumn);
                    const row = idx % maxPerColumn;
                    newNodes.push({
                        id, position: { x: currentX + col * (nodeWidth + colGap), y: 30 + row * (nodeHeight + verticalGap) },
                        data: { label: tblName, layer },
                        sourcePosition: 'right', targetPosition: 'left',
                        style: {
                            width: `${nodeWidth}px`, padding: '10px 14px',
                            background: cfg.color, color: layer === 'Gold' ? '#000' : '#fff',
                            fontWeight: '500', fontSize: '11px', borderRadius: '6px',
                            border: `2px solid ${cfg.border}`, boxShadow: '0 3px 8px rgba(0,0,0,0.25)',
                            textAlign: 'center'
                        }
                    });
                    nodeMap.set(tblName, id);
                }
            });
            currentX += cols * (nodeWidth + colGap) + layerGap;
        });

        // Build edges from ColumnsUsed (deduplicated by TargetTable→SourceTable)
        const edgeSet = new Set();
        let edgeIdx = 0;
        (repoData.ColumnsUsed || []).forEach(row => {
            const key = `${row.SourceTableName}->${row.TargetTableName}`;
            if (edgeSet.has(key)) return;
            edgeSet.add(key);
            const srcId = nodeMap.get(row.SourceTableName);
            const tgtId = nodeMap.get(row.TargetTableName);
            if (srcId !== undefined && tgtId !== undefined) {
                newEdges.push({
                    id: `edge-${edgeIdx++}`, source: srcId, target: tgtId,
                    type: 'smoothstep', animated: true,
                    style: { stroke: '#555', strokeWidth: 2 },
                    markerEnd: { type: MarkerType.ArrowClosed, color: '#555' }
                });
            }
        });

        setLineageNodes(newNodes);
        setLineageEdges(newEdges);
        setLineageRendered(true);
    };

    const buildLineageFiltered = (tblName) => {
        if (!repoData || !tblName) return;
        const newNodes = [];
        const newEdges = [];
        const nodeMap = new Map();
        let nodeId = 0;

        const tableLayer = (name) => {
            if ((repoData.GoldLayer || []).find(r => r.TableName === name)) return 'Gold';
            if ((repoData.SilverLayer || []).find(r => r.TableName === name)) return 'Silver';
            if ((repoData.BronzeLayer || []).find(r => r.TableName === name)) return 'Bronze';
            return null;
        };

        // Gather related tables: direct sources and direct targets
        const relatedTables = new Set([tblName]);
        const deps = [];
        (repoData.ColumnsUsed || []).forEach(row => {
            if (row.TargetTableName === tblName) {
                relatedTables.add(row.SourceTableName);
                deps.push({ from: row.SourceTableName, to: row.TargetTableName });
            }
            if (row.SourceTableName === tblName) {
                relatedTables.add(row.TargetTableName);
                deps.push({ from: row.SourceTableName, to: row.TargetTableName });
            }
        });

        // Deduplicate deps
        const uniqueDeps = [];
        const depSet = new Set();
        deps.forEach(d => {
            const key = `${d.from}->${d.to}`;
            if (!depSet.has(key)) { depSet.add(key); uniqueDeps.push(d); }
        });

        // Group by layer
        const layerGroups = {};
        relatedTables.forEach(name => {
            const layer = tableLayer(name) || 'Unknown';
            if (!layerGroups[layer]) layerGroups[layer] = [];
            if (!layerGroups[layer].includes(name)) layerGroups[layer].push(name);
        });

        const extColors = { ...layerColors, 'Unknown': { color: '#607d8b', border: '#455a64' } };
        const layerOrder = ['Bronze', 'Silver', 'Gold', 'Unknown'];

        let currentX = 100;
        layerOrder.forEach(layer => {
            const tables = layerGroups[layer];
            if (!tables || !tables.length) return;
            const cfg = extColors[layer];
            if (!cfg) return;
            const totalH = tables.length * (nodeHeight + verticalGap) - verticalGap;
            const startY = Math.max(0, (300 - totalH) / 2) + 30;
            tables.forEach((name, idx) => {
                if (!nodeMap.has(name)) {
                    const id = String(nodeId++);
                    const isTarget = name === tblName;
                    newNodes.push({
                        id, position: { x: currentX, y: startY + idx * (nodeHeight + verticalGap) },
                        data: { label: name, layer },
                        sourcePosition: 'right', targetPosition: 'left',
                        style: {
                            width: `${nodeWidth}px`, padding: '10px 14px',
                            background: cfg.color, color: layer === 'Gold' ? '#000' : '#fff',
                            fontWeight: isTarget ? '700' : '500', fontSize: '11px', borderRadius: '6px',
                            border: isTarget ? `3px solid ${cfg.border}` : `2px solid ${cfg.border}`,
                            boxShadow: isTarget ? '0 4px 12px rgba(0,0,0,0.4)' : '0 3px 8px rgba(0,0,0,0.25)',
                            textAlign: 'center'
                        }
                    });
                    nodeMap.set(name, id);
                }
            });
            currentX += nodeWidth + layerGap;
        });

        let edgeIdx = 0;
        uniqueDeps.forEach(dep => {
            const srcId = nodeMap.get(dep.from);
            const tgtId = nodeMap.get(dep.to);
            if (srcId !== undefined && tgtId !== undefined) {
                newEdges.push({
                    id: `edge-${edgeIdx++}`, source: srcId, target: tgtId,
                    type: 'smoothstep', animated: true,
                    style: { stroke: '#555', strokeWidth: 2 },
                    markerEnd: { type: MarkerType.ArrowClosed, color: '#555' }
                });
            }
        });

        setLineageNodes(newNodes);
        setLineageEdges(newEdges);
        setLineageRendered(true);
    };

    // Reset lineage when repo changes
    useEffect(() => {
        setLineageNodes([]);
        setLineageEdges([]);
        setLineageRendered(false);
        setLineageTable('');
    }, [selectedRepo]); // eslint-disable-line react-hooks/exhaustive-deps

    // All table names for lineage dropdown
    const lineageTableOptions = (() => {
        if (!repoData) return [];
        const names = new Set();
        (repoData.BronzeLayer || []).forEach(r => names.add(r.TableName));
        (repoData.SilverLayer || []).forEach(r => names.add(r.TableName));
        (repoData.GoldLayer || []).forEach(r => names.add(r.TableName));
        return [...names].sort();
    })();

    const onConnect = useCallback((params) => setLineageEdges((eds) => [...eds, params]), []); // eslint-disable-line react-hooks/exhaustive-deps

    const downloadLineageExcel = () => {
        const relations = [];
        lineageEdges.forEach((edge, index) => {
            const sourceNode = lineageNodes.find(n => n.id === edge.source);
            const targetNode = lineageNodes.find(n => n.id === edge.target);
            if (sourceNode && targetNode) {
                relations.push({
                    'S.No': index + 1,
                    'Source Table': sourceNode.data.label,
                    'Target Table': targetNode.data.label,
                    'Layer Flow': sourceNode.data.layer + ' \u2192 ' + targetNode.data.layer
                });
            }
        });
        const wb = XLSX.utils.book_new();
        const ws = formatSheet(XLSX.utils.json_to_sheet(relations), relations);
        XLSX.utils.book_append_sheet(wb, ws, 'Table Relations');
        const fileName = lineageTable ? `RepoLineage_${lineageTable}.xlsx` : 'RepoLineage_All_Tables.xlsx';
        XLSX.writeFile(wb, fileName, { bookType: 'xlsx', type: 'binary' });
        handleDownloadClose();
    };

    const downloadLineageImage = () => {
        if (!lineageNodes || lineageNodes.length === 0) {
            alert('No diagram to download');
            handleDownloadClose();
            return;
        }
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        lineageNodes.forEach(node => {
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
                        if (node.getAttribute && node.getAttribute('data-html2canvas-ignore') === 'true') return false;
                        if (node.classList && node.classList.contains('react-flow__controls')) return false;
                        return true;
                    }
                }).then((dataUrl) => {
                    viewportEl.style.transform = originalTransform;
                    const link = document.createElement('a');
                    link.download = lineageTable ? `RepoLineage_${lineageTable}.png` : 'RepoLineage_All_Tables.png';
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

    const renderImpactControls = () => (
        <Card sx={{ mb: 3, boxShadow: '0 2px 8px rgba(0,0,0,0.1)', borderRadius: 2 }}>
            <CardContent sx={{ pb: 3 }}>
                <Box sx={{ mt: 0, mb: 0 }}>
                    <Typography variant="h6" sx={{ fontWeight: 700, color: '#059bbf', fontSize: '1rem', mb: 3 }}>
                        Impact Analysis
                    </Typography>
                    <Box sx={{
                        mb: 2, p: 2, borderRadius: 2,
                        border: '1px solid #e0e0e0',
                        backgroundColor: '#fafafa'
                    }}>
                    <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
                <Autocomplete
                    multiple
                    size="small"
                    sx={{ minWidth: 360 }}
                    options={allTableNames}
                    value={impactTables}
                    onChange={(_, v) => { setImpactTables(v || []); setImpactColumn([]); setImpactResults(null); setImpactActive(false); }}
                    renderInput={(params) => <TextField {...params} label="Select Table(s)" />}
                />
                <Autocomplete
                    multiple
                    size="small"
                    sx={{ minWidth: 220 }}
                    options={impactColumnOptions}
                    value={impactColumn}
                    onChange={(_, v) => { setImpactColumn(v || []); setImpactResults(null); setImpactActive(false); }}
                    renderInput={(params) => <TextField {...params} label="Column (optional)" />}
                />
                <Button
                    className='lineage-btn'
                    style={{ backgroundColor: '#059bbf', borderColor: '#059bbf' }}
                    onClick={computeImpact}
                    disabled={impactTables.length === 0}
                >
                    Analyze Impact
                </Button>
                {(impactTables.length > 0 || impactColumn.length > 0 || impactActive) && (
                    <Typography
                        variant="body2"
                        sx={{ color: '#059bbf', cursor: 'pointer', whiteSpace: 'nowrap', ml: 1, '&:hover': { textDecoration: 'underline' } }}
                        onClick={clearImpact}
                    >
                        Clear all
                    </Typography>
                )}
            </Box>
            {impactActive && impactResults && (
                <Box sx={{ mt: 2 }}>
                    <Typography variant="body2" sx={{ color: '#555', mb: 1.5, fontSize: '0.85rem' }}>
                        {impactResults.allAffectedTables.length > 0
                            ? <><strong>{impactResults.allAffectedTables.length}</strong> table(s) impacted by deleting {impactResults.deletedColumns?.length > 0 ? <>column{impactResults.deletedColumns.length > 1 ? 's' : ''} <strong>{impactResults.deletedColumns.join(', ')}</strong> from </> : ''}{impactResults.deletedTables?.length > 1 ? <>tables <strong>{impactResults.deletedTables.join(', ')}</strong></> : <>table <strong>{impactResults.deletedTable}</strong></>}</>
                            : <>No downstream impact found for {impactResults.deletedColumns?.length > 0 ? <>column{impactResults.deletedColumns.length > 1 ? 's' : ''} <strong>{impactResults.deletedColumns.join(', ')}</strong> in </> : ''}{impactResults.deletedTables?.length > 1 ? <>tables <strong>{impactResults.deletedTables.join(', ')}</strong></> : <>table <strong>{impactResults.deletedTable}</strong></>}</>
                        }
                    </Typography>
                    {impactResults.directlyAffected.length > 0 && (
                        <Box sx={{ mb: 1 }}>
                            <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5, fontSize: '0.8rem', color: '#666' }}>
                                Direct ({impactResults.directlyAffected.length})
                            </Typography>
                            <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                                {impactResults.directlyAffected.map(t => (
                                    <Chip key={t} label={t} size="small" variant="outlined" sx={{ borderColor: '#ccc', color: '#444', fontSize: '0.75rem', height: 24 }} />
                                ))}
                            </Box>
                        </Box>
                    )}
                    {impactResults.transitivelyAffected.length > 0 && (
                        <Box sx={{ mb: 1 }}>
                            <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5, fontSize: '0.8rem', color: '#666' }}>
                                Cascade ({impactResults.transitivelyAffected.length})
                            </Typography>
                            <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                                {impactResults.transitivelyAffected.map(t => (
                                    <Chip key={t} label={t} size="small" variant="outlined" sx={{ borderColor: '#e0e0e0', color: '#666', fontSize: '0.75rem', height: 24 }} />
                                ))}
                            </Box>
                        </Box>
                    )}
                    {impactResults.affectedColumns.length > 0 && (() => {
                        // Group columns by table
                        const grouped = {};
                        impactResults.affectedColumns.forEach(row => {
                            if (!grouped[row.table]) {
                                grouped[row.table] = { layer: row.layer, isDirect: row.isDirect, viaSet: new Set(), notebook: row.notebook, columns: [] };
                            }
                            if (row.via) grouped[row.table].viaSet.add(row.via);
                            grouped[row.table].columns.push(row);
                        });
                        const tableNames = Object.keys(grouped);
                        const toggleTable = (name) => {
                            setExpandedImpactTables(prev => {
                                const next = new Set(prev);
                                if (next.has(name)) next.delete(name); else next.add(name);
                                return next;
                            });
                        };
                        return (
                            <TableContainer component="div" sx={{
                                mt: 1, maxWidth: '100%',
                                border: '1px solid #e0e0e0',
                                borderRadius: 1,
                                overflowX: 'auto',
                                overflowY: 'auto',
                                maxHeight: 250,
                                '& td, & th': { padding: '4px 8px' }
                            }}>
                                <Table stickyHeader size="small">
                                    <TableHead>
                                        <TableRow>
                                            <TableCell sx={{ ...headerStyle, width: impactColWidths.num }}>#</TableCell>
                                            <TableCell sx={{ ...headerStyle, width: impactColWidths.name }}>Table</TableCell>
                                            <TableCell sx={{ ...headerStyle, width: impactColWidths.layer }}>Layer</TableCell>
                                            <TableCell sx={{ ...headerStyle, width: impactColWidths.impact }}>Impact</TableCell>
                                            <TableCell sx={{ ...headerStyle, width: impactColWidths.via }}>Via</TableCell>
                                            <TableCell sx={{ ...headerStyle, width: impactColWidths.cols }}>Columns</TableCell>
                                            <TableCell sx={{ ...headerStyle, width: impactColWidths.nb }}>Notebook Path</TableCell>
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {tableNames.map((tblName, idx) => {
                                            const info = grouped[tblName];
                                            const isExpanded = expandedImpactTables.has(tblName);
                                            return (
                                                <React.Fragment key={tblName}>
                                                    <TableRow
                                                        onClick={() => toggleTable(tblName)}
                                                        sx={{
                                                            cursor: 'pointer',
                                                            backgroundColor: '#fff',
                                                            '&:hover': { backgroundColor: '#f5f5f5' }
                                                        }}
                                                    >
                                                        <TableCell sx={{ width: impactColWidths.num, py: 0.5, whiteSpace: 'nowrap' }}>
                                                            {idx + 1} <span style={{ verticalAlign: 'middle' }}>{isExpanded
                                                                ? <KeyboardArrowDownIcon sx={{ fontSize: 16, color: '#666', verticalAlign: 'middle' }} />
                                                                : <KeyboardArrowRightIcon sx={{ fontSize: 16, color: '#666', verticalAlign: 'middle' }} />
                                                            }</span>
                                                        </TableCell>
                                                        <TableCell sx={{ width: impactColWidths.name, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                            {tblName}
                                                        </TableCell>
                                                        <TableCell sx={{ width: impactColWidths.layer, fontSize: '0.82rem', color: '#666' }}>
                                                            {info.layer || '—'}
                                                        </TableCell>
                                                        <TableCell sx={{ width: impactColWidths.impact }}>
                                                            <Typography variant="body2" sx={{ fontSize: '0.75rem', color: info.isDirect ? '#c62828' : '#e65100', fontWeight: 500 }}>
                                                                {info.isDirect ? 'Direct' : 'Cascade'}
                                                            </Typography>
                                                        </TableCell>
                                                        <TableCell sx={{ width: impactColWidths.via, fontSize: '0.82rem', color: '#888', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{info.viaSet.size > 0 ? [...info.viaSet].join(', ') : '—'}</TableCell>
                                                        <TableCell sx={{ width: impactColWidths.cols, fontSize: '0.82rem', color: '#555' }}>
                                                            {info.columns.length} column{info.columns.length !== 1 ? 's' : ''}
                                                        </TableCell>
                                                        <TableCell sx={{ width: impactColWidths.nb, fontSize: '0.82rem', color: '#555', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                            {info.notebook || '—'}
                                                        </TableCell>
                                                    </TableRow>
                                                    {isExpanded && info.columns.map((col, ci) => (
                                                        <TableRow key={`${tblName}-${ci}`} sx={{ backgroundColor: '#fafafa' }}>
                                                            <TableCell />
                                                            <TableCell />
                                                            <TableCell />
                                                            <TableCell />
                                                            <TableCell sx={{ pl: 2, fontSize: '0.82rem', color: '#555', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                                <code>{col.column}</code>
                                                            </TableCell>
                                                            <TableCell />
                                                        </TableRow>
                                                    ))}
                                                </React.Fragment>
                                            );
                                        })}
                                    </TableBody>
                                </Table>
                            </TableContainer>
                        );
                    })()}
                </Box>
            )}
            </Box>
                </Box>
            </CardContent>
        </Card>
    );

    const renderLineageView = () => {
        const bronzeCount = (repoData?.BronzeLayer || []).length;
        const silverCount = (repoData?.SilverLayer || []).length;
        const goldCount = (repoData?.GoldLayer || []).length;
        const totalTables = bronzeCount + silverCount + goldCount;

        return (
            <Box>
                {renderImpactControls()}
                <Box sx={{ mb: 1 }}>
                    <Typography variant="body2" sx={{ color: '#666', mb: 1 }}>
                        {totalTables > 0
                            ? `${totalTables} tables | Bronze: ${bronzeCount} | Silver: ${silverCount} | Gold: ${goldCount}`
                            : 'No layer data available'}
                    </Typography>
                </Box>
                <Box sx={{ display: 'flex', gap: 2, mb: 2, alignItems: 'center', flexWrap: 'wrap' }}>
                    <Button className='lineage-btn' style={{ backgroundColor: '#059bbf', borderColor: '#059bbf' }} onClick={buildLineageAll}>
                        View Full Lineage
                    </Button>
                    <Form.Select
                        style={{ maxWidth: 300 }}
                        className='lineage-select'
                        value={lineageTable}
                        onChange={e => setLineageTable(e.target.value)}
                    >
                        <option value="">---Select Table---</option>
                        {lineageTableOptions.map((t, i) => (
                            <option key={i} value={t}>{t}</option>
                        ))}
                    </Form.Select>
                    <Button className='lineage-btn lineage-btn-filter' onClick={() => {
                        if (lineageTable) buildLineageFiltered(lineageTable);
                        else buildLineageAll();
                    }}>
                        Filter Lineage
                    </Button>
                    <Button className='lineage-btn' style={{ backgroundColor: '#6c757d', borderColor: '#6c757d' }} onClick={() => {
                        setLineageNodes([]);
                        setLineageEdges([]);
                        setLineageRendered(false);
                        setLineageTable('');
                    }}>
                        Reset
                    </Button>
                </Box>
                {lineageRendered ? (
                    <div className='lineage-flow-container' ref={flowRef} style={{ position: 'relative', height: 700 }}>
                        {/* Download button at top-right of graph */}
                        <div data-html2canvas-ignore="true" style={{ position: 'absolute', top: '10px', right: '10px', zIndex: 10 }}>
                            <IconButton
                                onClick={handleDownloadClick}
                                sx={{
                                    backgroundColor: '#059bbf',
                                    color: 'white',
                                    '&:hover': { backgroundColor: '#047a99' }
                                }}
                            >
                                <DownloadIcon />
                            </IconButton>
                            <Menu
                                anchorEl={downloadMenuAnchor}
                                open={downloadMenuOpen}
                                onClose={handleDownloadClose}
                                anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                                transformOrigin={{ vertical: 'top', horizontal: 'right' }}
                            >
                                <MenuItem onClick={downloadLineageExcel}>
                                    <ListItemIcon><TableChartIcon fontSize="small" /></ListItemIcon>
                                    <ListItemText>Table Relations (Excel)</ListItemText>
                                </MenuItem>
                                <MenuItem onClick={downloadLineageImage}>
                                    <ListItemIcon><ImageIcon fontSize="small" /></ListItemIcon>
                                    <ListItemText>Lineage Diagram (PNG)</ListItemText>
                                </MenuItem>
                            </Menu>
                        </div>
                        {/* Legend */}
                        <div style={{
                            position: 'absolute', top: 10, left: 10, zIndex: 10,
                            backgroundColor: 'rgba(255,255,255,0.95)', padding: '10px 15px',
                            borderRadius: 6, boxShadow: '0 2px 6px rgba(0,0,0,0.15)'
                        }}>
                            <div style={{ fontWeight: 600, marginBottom: 8, fontSize: 12 }}>Data Layers</div>
                            <div style={{ display: 'flex', gap: 15, fontSize: 11 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                                    <div style={{ width: 16, height: 16, backgroundColor: '#cd7f32', borderRadius: 3 }} />
                                    <span>Bronze</span>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                                    <div style={{ width: 16, height: 16, backgroundColor: '#c0c0c0', borderRadius: 3 }} />
                                    <span>Silver</span>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                                    <div style={{ width: 16, height: 16, backgroundColor: '#ffd700', borderRadius: 3 }} />
                                    <span>Gold</span>
                                </div>
                            </div>
                            {impactActive && impactResults && (
                                <>
                                    <div style={{ fontWeight: 600, marginBottom: 8, marginTop: 10, fontSize: 12, color: '#d32f2f' }}>Impact Analysis</div>
                                    <div style={{ display: 'flex', gap: 15, fontSize: 11 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                                            <div style={{ width: 16, height: 16, backgroundColor: '#d32f2f', borderRadius: 3 }} />
                                            <span>Deleted</span>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                                            <div style={{ width: 16, height: 16, backgroundColor: '#ef5350', borderRadius: 3 }} />
                                            <span>Direct Impact</span>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                                            <div style={{ width: 16, height: 16, backgroundColor: '#ff9800', borderRadius: 3 }} />
                                            <span>Cascade Impact</span>
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>
                        <ReactFlow
                            nodes={lineageNodes.map(node => {
                                if (!impactActive || !impactResults) return node;
                                const tableName = normalizeTableName(node.data.label);
                                const deletedSet = new Set((impactResults.deletedTables || [impactResults.deletedTable]).map(t => normalizeTableName(t)).filter(Boolean));
                                const isDeleted = deletedSet.has(tableName);
                                const isDirect = impactResults.directlyAffected.includes(tableName);
                                const isCascade = impactResults.transitivelyAffected.includes(tableName);
                                if (isDeleted) {
                                    return { ...node, style: { ...node.style, background: '#d32f2f', border: '3px solid #b71c1c', color: '#fff', boxShadow: '0 0 12px rgba(211,47,47,0.6)' } };
                                }
                                if (isDirect) {
                                    return { ...node, style: { ...node.style, background: '#ef5350', border: '3px solid #c62828', color: '#fff', boxShadow: '0 0 10px rgba(239,83,80,0.5)' } };
                                }
                                if (isCascade) {
                                    return { ...node, style: { ...node.style, background: '#ff9800', border: '3px solid #e65100', color: '#fff', boxShadow: '0 0 10px rgba(255,152,0,0.5)' } };
                                }
                                return node;
                            })}
                            edges={lineageEdges}
                            onNodesChange={onNodesChange}
                            onEdgesChange={onEdgesChange}
                            onConnect={onConnect}
                            snapToGrid={true}
                            snapGrid={[20, 20]}
                            fitView
                            minZoom={0.05}
                            maxZoom={2}
                            style={{ width: '100%', height: '100%' }}
                        >
                            <Controls />
                            <Background color="#e0e0e0" gap={24} size={1} />
                        </ReactFlow>
                    </div>
                ) : (
                    <Box sx={{ textAlign: 'center', py: 6, color: '#999' }}>
                        <Typography variant="body1">Click "View Full Lineage" to visualize Bronze → Silver → Gold data flow</Typography>
                    </Box>
                )}
            </Box>
        );
    };

    const tabLabels = ['Tables & Columns', 'Lineage View'];

    const counts = repoData ? [
        (repoData.ColumnsUsed || []).length,
        (repoData.BronzeLayer || []).length + (repoData.SilverLayer || []).length + (repoData.GoldLayer || []).length,
    ] : [0, 0];

    const renderLayerTable = (data, layer) => {
        const filtered = tableFilter.length > 0 ? data.filter(r => tableFilter.includes(r.TableName)) : data;
        const tableNames = [...new Set(data.map(r => r.TableName))].sort();
        return (
            <Box>
                <Box sx={{ display: 'flex', gap: 2, mb: 2, alignItems: 'center' }}>
                    <Autocomplete
                        multiple
                        size="small"
                        sx={{ minWidth: 300 }}
                        options={tableNames}
                        value={tableFilter}
                        onChange={(_, v) => setTableFilter(v)}
                        renderInput={(params) => <TextField {...params} label="Filter by Table Name" />}
                    />
                    {tableFilter.length > 0 && (
                        <Typography
                            variant="body2"
                            sx={{ color: '#059bbf', cursor: 'pointer', whiteSpace: 'nowrap', '&:hover': { textDecoration: 'underline' } }}
                            onClick={() => setTableFilter([])}
                        >
                            Clear
                        </Typography>
                    )}
                </Box>
                {filtered.length === 0 ? (
                    <Typography sx={{ p: 3, color: '#888' }}>No {layer} data{tableFilter.length > 0 ? ' matching filter' : ''}.</Typography>
                ) : (
                    <TableContainer component="div" sx={tableWrapperStyle}>
                        <Table stickyHeader size="small">
                            <TableHead>
                                <TableRow>
                                    <TableCell sx={headerStyle}>#</TableCell>
                                    <TableCell sx={headerStyle}>Table Name</TableCell>
                                    <TableCell sx={headerStyle}>Schema Dump</TableCell>
                                    <TableCell sx={headerStyle}>Notebook Path</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {filtered.map((row, i) => (
                                    <TableRow key={i} hover>
                                        <TableCell>{i + 1}</TableCell>
                                        <TableCell sx={{ fontWeight: 500 }}>{row.TableName}</TableCell>
                                        <TableCell>{row.SchemaDump || '—'}</TableCell>
                                        <TableCell sx={{ fontSize: '0.82rem', color: '#555' }}>{row.NotebookPath}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </TableContainer>
                )}
            </Box>
        );
    };

    const renderColumnsTable = (data) => {
        // Build a combined dataset: all ColumnsUsed rows + layer-only tables (no column info)
        const layerLookup = {};
        const notebookLookup = {};
        (repoData.BronzeLayer || []).forEach(r => { layerLookup[r.TableName] = 'Bronze'; notebookLookup[r.TableName] = r.NotebookPath; });
        (repoData.SilverLayer || []).forEach(r => { layerLookup[r.TableName] = 'Silver'; notebookLookup[r.TableName] = r.NotebookPath; });
        (repoData.GoldLayer || []).forEach(r => { layerLookup[r.TableName] = 'Gold'; notebookLookup[r.TableName] = r.NotebookPath; });

        // All tables that appear as targets in ColumnsUsed
        const tablesInColumnsUsed = new Set(data.map(r => r.TargetTableName));

        // Build combined rows: ColumnsUsed rows + standalone rows for tables not in ColumnsUsed
        const allLayerTables = Object.keys(layerLookup);
        const standaloneTables = allLayerTables.filter(t => !tablesInColumnsUsed.has(t));
        const standaloneRows = standaloneTables.map(t => ({
            TargetTableName: t,
            LayerLevel: layerLookup[t],
            SourceTableName: '—',
            ColumnName: '—',
            NotebookPath: notebookLookup[t] || '—',
            _isStandalone: true
        }));

        // Enrich ColumnsUsed rows with layer info for rows missing LayerLevel
        const enrichedData = data.map(r => ({
            ...r,
            LayerLevel: r.LayerLevel || layerLookup[r.TargetTableName] || '—',
            _isStandalone: false
        }));

        const combinedData = [...enrichedData, ...standaloneRows];

        // Apply filters
        let filtered = combinedData;
        if (tableFilter.length > 0) filtered = filtered.filter(r => tableFilter.includes(r.TargetTableName));
        if (columnFilter.length > 0) filtered = filtered.filter(r => columnFilter.includes(r.ColumnName));
        if (sourceTableFilter.length > 0) filtered = filtered.filter(r => sourceTableFilter.includes(r.SourceTableName));

        // Filter options (based on combined data, narrowed by siblings)
        let forTargetOptions = combinedData;
        if (columnFilter.length > 0) forTargetOptions = forTargetOptions.filter(r => columnFilter.includes(r.ColumnName));
        if (sourceTableFilter.length > 0) forTargetOptions = forTargetOptions.filter(r => sourceTableFilter.includes(r.SourceTableName));

        let forColOptions = combinedData;
        if (tableFilter.length > 0) forColOptions = forColOptions.filter(r => tableFilter.includes(r.TargetTableName));
        if (sourceTableFilter.length > 0) forColOptions = forColOptions.filter(r => sourceTableFilter.includes(r.SourceTableName));

        let forSrcOptions = combinedData;
        if (tableFilter.length > 0) forSrcOptions = forSrcOptions.filter(r => tableFilter.includes(r.TargetTableName));
        if (columnFilter.length > 0) forSrcOptions = forSrcOptions.filter(r => columnFilter.includes(r.ColumnName));

        const targetNames = [...new Set(forTargetOptions.map(r => r.TargetTableName))].sort();
        const colNames = [...new Set(forColOptions.map(r => r.ColumnName).filter(c => c !== '—'))].sort();
        const srcNames = [...new Set(forSrcOptions.map(r => r.SourceTableName).filter(s => s !== '—'))].sort();
        const hasFilter = tableFilter.length > 0 || columnFilter.length > 0 || sourceTableFilter.length > 0;

        const getSourceLayer = (name) => {
            if (name === '—') return '—';
            if (layerLookup[name]) return layerLookup[name];
            // Extract layer prefix from source table name (e.g., "Bronze/DimTime" → "Bronze")
            if (name.includes('/')) {
                const prefix = name.split('/')[0].toLowerCase();
                if (prefix.includes('bronze')) return 'Bronze';
                if (prefix.includes('silver')) return 'Silver';
                if (prefix.includes('gold')) return 'Gold';
            }
            return '—';
        };

        const getRowImpactType = (row) => {
            if (!impactActive || !impactResults) return 'none';
            const targetKey = normalizeTableName(row.TargetTableName);
            const sourceKey = normalizeTableName(row.SourceTableName);
            const deletedKey = normalizeTableName(impactResults.deletedTable);

            if (impactResults.directlyAffected.includes(targetKey) || (sourceKey && sourceKey === deletedKey)) {
                return 'direct';
            }
            if (impactResults.transitivelyAffected.includes(targetKey)) {
                return 'cascade';
            }
            return 'none';
        };

        let displayData = filtered;
        if (layerFilter.length > 0) displayData = displayData.filter(r => layerFilter.includes(r.LayerLevel));

        return (
            <Box>
                {renderImpactControls()}
                
                {/* Data Analysis Section */}
                <Card sx={{ boxShadow: '0 2px 8px rgba(0,0,0,0.1)', borderRadius: 2 }}>
                    <CardContent>
                        <Box sx={{ mt: 0, mb: 0 }}>
                            <Typography variant="h6" sx={{ fontWeight: 700, color: '#059bbf', fontSize: '1rem', mb: 3 }}>
                                Data Analysis
                            </Typography>
                    
                    <Box sx={{
                        mt: 2, mb: 3, p: 2.5, borderRadius: 2,
                        border: '1px solid #d0d0d0',
                        backgroundColor: '#fafafa',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.08)'
                    }}>
                        <Typography variant="subtitle2" sx={{ fontWeight: 600, color: '#444', fontSize: '0.85rem', mb: 2 }}>
                            Table & Column Filters
                        </Typography>
                    
                    <Box sx={{ display: 'flex', gap: 2, mb: 2, alignItems: 'center', flexWrap: 'wrap' }}>
                        <Autocomplete
                            multiple
                            size="small"
                            sx={{ minWidth: 240 }}
                            options={targetNames}
                            value={tableFilter}
                            onChange={(_, v) => setTableFilter(v)}
                            renderInput={(params) => <TextField {...params} label="Table Name" />}
                        />
                        <Autocomplete
                            multiple
                            size="small"
                            sx={{ minWidth: 240 }}
                            options={srcNames}
                            value={sourceTableFilter}
                            onChange={(_, v) => setSourceTableFilter(v)}
                            renderInput={(params) => <TextField {...params} label="Source Table" />}
                        />
                        <Autocomplete
                            multiple
                            size="small"
                            sx={{ minWidth: 240 }}
                            options={colNames}
                            value={columnFilter}
                            onChange={(_, v) => setColumnFilter(v)}
                            renderInput={(params) => <TextField {...params} label="Column Name" />}
                        />
                        {(hasFilter || layerFilter.length > 0) && (
                            <Typography
                                variant="body2"
                                sx={{ color: '#059bbf', cursor: 'pointer', whiteSpace: 'nowrap', ml: 1, '&:hover': { textDecoration: 'underline' } }}
                                onClick={() => { setTableFilter([]); setColumnFilter([]); setSourceTableFilter([]); setLayerFilter([]); }}
                            >
                                Clear all
                            </Typography>
                        )}
                    </Box>
                    
                    <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
                        <Typography variant="body2" sx={{ color: '#666', fontSize: '0.8rem', fontWeight: 500 }}>
                            Layer:
                        </Typography>
                        {['Bronze', 'Silver', 'Gold'].map(layer => (
                            <Chip
                                key={layer}
                                label={layer}
                                size="small"
                                variant={layerFilter.includes(layer) ? 'filled' : 'outlined'}
                                onClick={() => setLayerFilter(prev => prev.includes(layer) ? prev.filter(l => l !== layer) : [...prev, layer])}
                                sx={{
                                    cursor: 'pointer',
                                    borderColor: '#ccc',
                                    color: layerFilter.includes(layer) ? '#fff' : '#555',
                                    backgroundColor: layerFilter.includes(layer) ? '#059bbf' : 'transparent',
                                    fontSize: '0.75rem', height: 26,
                                    '&:hover': { backgroundColor: layerFilter.includes(layer) ? '#047a99' : '#f0f0f0' }
                                }}
                            />
                        ))}
                    </Box>
                </Box>
                {(() => {
                    // Group displayData by TargetTableName + SourceTableName
                    const grouped = {};
                    displayData.forEach(row => {
                        const key = `${row.TargetTableName}|||${row.SourceTableName}`;
                        if (!grouped[key]) {
                            grouped[key] = {
                                TargetTableName: row.TargetTableName,
                                LayerLevel: row.LayerLevel,
                                SourceTableName: row.SourceTableName,
                                NotebookPath: row.NotebookPath,
                                _isStandalone: row._isStandalone,
                                columns: []
                            };
                        }
                        if (row.ColumnName && row.ColumnName !== '—') {
                            grouped[key].columns.push(row.ColumnName);
                        }
                    });
                    const groupedEntries = Object.entries(grouped);
                    const totalColumns = displayData.filter(r => r.ColumnName && r.ColumnName !== '—').length;

                    const toggleColumnsTable = (key) => {
                        setExpandedColumnsTables(prev => {
                            const next = new Set(prev);
                            if (next.has(key)) next.delete(key); else next.add(key);
                            return next;
                        });
                    };

                    return (
                        <>
                            <Box sx={{
                                mb: 3, p: 2.5, borderRadius: 2,
                                backgroundColor: '#f0f7fb',
                                border: '1px solid #d9e8f0',
                                boxShadow: '0 1px 3px rgba(0,0,0,0.08)'
                            }}>
                                <Typography variant="body2" sx={{ color: '#555', fontSize: '0.85rem', fontWeight: 500 }}>
                                    Results: <strong>{groupedEntries.length}</strong> table group{groupedEntries.length !== 1 ? 's' : ''} | <strong>{totalColumns}</strong> column{totalColumns !== 1 ? 's' : ''} 
                                    <span style={{ marginLeft: '1rem', color: '#666' }}>
                                        Bronze: {combinedData.filter(r => r.LayerLevel === 'Bronze').length} • 
                                        Silver: {combinedData.filter(r => r.LayerLevel === 'Silver').length} • 
                                        Gold: {combinedData.filter(r => r.LayerLevel === 'Gold').length}
                                    </span>
                                </Typography>
                            </Box>
                            {groupedEntries.length === 0 ? (
                                <Typography sx={{ p: 3, color: '#888' }}>No data{hasFilter || layerFilter.length > 0 ? ' matching filters' : ''}.</Typography>
                            ) : (
                                <TableContainer component="div" sx={tableWrapperStyle}>
                                    <Table stickyHeader size="small">
                                        <TableHead>
                                            <TableRow>
                                                <TableCell sx={{ ...headerStyle, width: colWidths.num }}>#</TableCell>
                                                <TableCell sx={{ ...headerStyle, width: colWidths.name }}>Table Name</TableCell>
                                                <TableCell sx={{ ...headerStyle, width: colWidths.layer }}>Layer</TableCell>
                                                <TableCell sx={{ ...headerStyle, width: colWidths.src }}>Source Table</TableCell>
                                                <TableCell sx={{ ...headerStyle, width: colWidths.srcLayer }}>Source Layer</TableCell>
                                                <TableCell sx={{ ...headerStyle, width: colWidths.cols }}>Columns</TableCell>
                                                <TableCell sx={{ ...headerStyle, width: colWidths.nb }}>Notebook Path</TableCell>
                                            </TableRow>
                                        </TableHead>
                                        <TableBody>
                                            {groupedEntries.map(([key, info], idx) => {
                                                const isExpanded = expandedColumnsTables.has(key);
                                                const impactType = getRowImpactType(info);
                                                const impacted = impactType !== 'none';
                                                const isDirectImpact = impactType === 'direct';
                                                return (
                                                    <React.Fragment key={key}>
                                                        <TableRow
                                                            onClick={() => info.columns.length > 0 && toggleColumnsTable(key)}
                                                            sx={{
                                                                cursor: info.columns.length > 0 ? 'pointer' : 'default',
                                                                backgroundColor: impacted
                                                                    ? (isDirectImpact ? '#ffebee' : '#fff8e1')
                                                                    : (info._isStandalone ? '#fafafa' : '#fff'),
                                                                borderLeft: impacted
                                                                    ? (isDirectImpact ? '3px solid #c62828' : '3px solid #f9a825')
                                                                    : '3px solid transparent',
                                                                '&:hover': {
                                                                    backgroundColor: impacted
                                                                        ? (isDirectImpact ? '#ffcdd2' : '#ffecb3')
                                                                        : '#f5f5f5'
                                                                }
                                                            }}
                                                        >
                                                            <TableCell sx={{ width: colWidths.num, py: 0.5, whiteSpace: 'nowrap' }}>
                                                                {idx + 1} <span style={{ verticalAlign: 'middle' }}>{info.columns.length > 0 ? (
                                                                    isExpanded
                                                                        ? <KeyboardArrowDownIcon sx={{ fontSize: 16, color: '#666', verticalAlign: 'middle' }} />
                                                                        : <KeyboardArrowRightIcon sx={{ fontSize: 16, color: '#666', verticalAlign: 'middle' }} />
                                                                ) : null}</span>
                                                            </TableCell>
                                                            <TableCell sx={{ width: colWidths.name, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                                {info.TargetTableName}
                                                                {impacted && (
                                                                    <Typography
                                                                        component="span"
                                                                        sx={{
                                                                            ml: 1,
                                                                            fontSize: '0.7rem',
                                                                            color: isDirectImpact ? '#c62828' : '#e65100',
                                                                            fontWeight: 500
                                                                        }}
                                                                    >
                                                                        impacted
                                                                    </Typography>
                                                                )}
                                                            </TableCell>
                                                            <TableCell sx={{ width: colWidths.layer, fontSize: '0.82rem', color: '#666' }}>{info.LayerLevel}</TableCell>
                                                            <TableCell sx={{ width: colWidths.src, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{info.SourceTableName}</TableCell>
                                                            <TableCell sx={{ width: colWidths.srcLayer, fontSize: '0.82rem', color: '#666' }}>
                                                                {getSourceLayer(info.SourceTableName)}
                                                            </TableCell>
                                                            <TableCell sx={{ width: colWidths.cols, fontSize: '0.82rem', color: '#555' }}>
                                                                {info.columns.length > 0 ? `${info.columns.length} column${info.columns.length !== 1 ? 's' : ''}` : '—'}
                                                            </TableCell>
                                                            <TableCell sx={{ width: colWidths.nb, fontSize: '0.82rem', color: '#555', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                                {info.NotebookPath || '—'}
                                                            </TableCell>
                                                        </TableRow>
                                                        {isExpanded && info.columns.map((col, ci) => (
                                                            <TableRow key={`${key}-${ci}`} sx={{ backgroundColor: '#fafafa' }}>
                                                                <TableCell />
                                                                <TableCell />
                                                                <TableCell />
                                                                <TableCell />
                                                                <TableCell />
                                                                <TableCell sx={{ pl: 2, fontSize: '0.82rem', color: '#555' }}>
                                                                    <code>{col}</code>
                                                                </TableCell>
                                                                <TableCell />
                                                            </TableRow>
                                                        ))}
                                                    </React.Fragment>
                                                );
                                            })}
                                        </TableBody>
                                    </Table>
                                </TableContainer>
                            )}
                        </>
                    );
                })()}
                        </Box>
                    </CardContent>
                </Card>
                {/* End Data Analysis Section */}
            </Box>
        );
    };

    const renderPipelinesTable = (data) => {
        const filtered = tableFilter.length > 0 ? data.filter(r => tableFilter.includes(r.TableName)) : data;
        const tableNames = [...new Set(data.map(r => r.TableName))].sort();
        return (
            <Box>
                <Box sx={{ display: 'flex', gap: 2, mb: 2, alignItems: 'center' }}>
                    <Autocomplete
                        multiple
                        size="small"
                        sx={{ minWidth: 300 }}
                        options={tableNames}
                        value={tableFilter}
                        onChange={(_, v) => setTableFilter(v)}
                        renderInput={(params) => <TextField {...params} label="Filter by Table Name" />}
                    />
                    {tableFilter.length > 0 && (
                        <Typography
                            variant="body2"
                            sx={{ color: '#059bbf', cursor: 'pointer', whiteSpace: 'nowrap', '&:hover': { textDecoration: 'underline' } }}
                            onClick={() => setTableFilter([])}
                        >
                            Clear
                        </Typography>
                    )}
                </Box>
                {filtered.length === 0 ? (
                    <Typography sx={{ p: 3, color: '#888' }}>No pipeline data{tableFilter.length > 0 ? ' matching filter' : ''}.</Typography>
                ) : (
                    <TableContainer component="div" sx={tableWrapperStyle}>
                        <Table stickyHeader size="small">
                            <TableHead>
                                <TableRow>
                                    <TableCell sx={headerStyle}>#</TableCell>
                                    <TableCell sx={headerStyle}>Table Name</TableCell>
                                    <TableCell sx={headerStyle}>Path</TableCell>
                                    <TableCell sx={headerStyle}>SQL Connection</TableCell>
                                    <TableCell sx={headerStyle}>Source Details</TableCell>
                                    <TableCell sx={headerStyle}>Dump Location</TableCell>
                                    <TableCell sx={headerStyle}>Column</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {filtered.map((row, i) => (
                                    <TableRow key={i} hover>
                                        <TableCell>{i + 1}</TableCell>
                                        <TableCell sx={{ fontWeight: 500 }}>{row.TableName}</TableCell>
                                        <TableCell>{row.Path || '—'}</TableCell>
                                        <TableCell>{row.SQLConnection || '—'}</TableCell>
                                        <TableCell>{row.SourceDetails || '—'}</TableCell>
                                        <TableCell>{row.DumpLocation || '—'}</TableCell>
                                        <TableCell>{row.ColumnName || '—'}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </TableContainer>
                )}
            </Box>
        );
    };

    return (
        <div>
            <NavbarEnhanced
                pipelines={[]}
                bronzeDetails={[]}
                silverDetails={[]}
                goldDetails={[]}
                stagingtables={[]}
                loading={false}
                flagpage={4}
            />

            <Box sx={{ p: 3, maxWidth: 1400, margin: '0 auto', width: '100%' }}>
                <Typography variant="h5" sx={{ fontWeight: 600, mb: 3, fontFamily: 'Poppins, sans-serif' }}>
                    POSOT Data Explorer
                </Typography>

                {/* Repo selector */}
                <Box sx={{ display: 'flex', gap: 2, mb: 3, alignItems: 'center', flexWrap: 'wrap' }}>
                    <FormControl sx={{ minWidth: 280 }} size="small">
                        <InputLabel>Select Repository</InputLabel>
                        <Select
                            value={selectedRepo}
                            label="Select Repository"
                            onChange={e => setSelectedRepo(e.target.value)}
                            disabled={repoLoading}
                        >
                            {repos.map(r => (
                                <MenuItem key={r} value={r}>{r}</MenuItem>
                            ))}
                        </Select>
                    </FormControl>

                    {repoLoading && <CircularProgress size={24} />}

                    {repoData && (
                        <Tooltip title="Download Excel">
                            <IconButton onClick={downloadExcel} sx={{ color: '#059bbf' }}>
                                <DownloadIcon />
                            </IconButton>
                        </Tooltip>
                    )}
                </Box>

                {/* Loading spinner */}
                {loading && (
                    <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
                        <CircularProgress />
                    </Box>
                )}

                {/* Data view */}
                {repoData && !loading && (
                    <Box>
                        <Box>
                            <Tabs
                                value={activeTab}
                                onChange={(_, v) => { setActiveTab(v); setTableFilter([]); setColumnFilter([]); setSourceTableFilter([]); setLayerFilter([]); }}
                                sx={{ mb: 2, borderBottom: 1, borderColor: 'divider' }}
                            >
                                {tabLabels.map((label, i) => (
                                    <Tab
                                        key={i}
                                        label={label}
                                    />
                                ))}
                            </Tabs>

                            {activeTab === 0 && renderColumnsTable(repoData.ColumnsUsed || [])}
                            {activeTab === 1 && renderLineageView()}
                        </Box>
                    </Box>
                )}

                {/* Empty state */}
                {!selectedRepo && !loading && (
                    <Box sx={{ textAlign: 'center', py: 8, color: '#999' }}>
                        <Typography variant="h6">Select a repository to explore its data</Typography>
                    </Box>
                )}
            </Box>
        </div>
    );
}

// No custom block-display scroll hack needed — use MUI stickyHeader + maxHeight on TableContainer

// Column widths for Columns Used table (percentages)
const colWidths = { num: '5%', name: '17%', layer: '7%', src: '17%', srcLayer: '8%', cols: '8%', stgCols: '13%', nb: '25%' };
// Column widths for Impact table (percentages)
const impactColWidths = { num: '6%', name: '22%', layer: '8%', impact: '10%', via: '14%', cols: '10%', nb: '30%' };

const tableWrapperStyle = {
    width: '100%',
    maxHeight: 'calc(100vh - 400px)',
    border: '1px solid #e0e0e0',
    borderRadius: 0,
    overflowX: 'auto',
    overflowY: 'auto',
    '& td, & th': { padding: '4px 8px' }
};

const headerStyle = {
    fontWeight: 600,
    backgroundColor: '#059bbf',
    color: '#fff',
    fontFamily: 'Poppins, sans-serif',
    fontSize: '0.8rem',
    padding: '6px 8px',
    textAlign: 'left',
    borderColor: '#059bbf'
};

export default RepoExplorer;

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import './ColumnLineageView.css';
import { toPng } from 'html-to-image';
import * as XLSX from 'xlsx-js-style';
import DownloadIcon from '@mui/icons-material/Download';
import ImageIcon from '@mui/icons-material/Image';
import TableChartIcon from '@mui/icons-material/TableChart';
import IconButton from '@mui/material/IconButton';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';

const normalizeForLookup = (name) => {
    if (!name) return '';
    const lastSlash = name.split('/').pop();
    const lastDot = lastSlash.split('.').pop();
    return lastDot.toLowerCase();
};

function ColumnLineageView({
    columnLineage,
    silverDetails,
    goldDetails,
    bronzeDetails,
    stagingtables,
    selectedTable,
}) {
    const containerRef = useRef(null);
    const bodyRef = useRef(null);
    const leftPanelRef = useRef(null);
    const rightPanelRef = useRef(null);
    const [lines, setLines] = useState([]);
    const [hoveredLine, setHoveredLine] = useState(null);
    const [tooltip, setTooltip] = useState(null);
    const [selectedColumn, setSelectedColumn] = useState(null);
    const [downloadMenuAnchor, setDownloadMenuAnchor] = useState(null);
    const downloadMenuOpen = Boolean(downloadMenuAnchor);

    // Parse selectedTable
    const parts = selectedTable ? selectedTable.split('|') : [];
    const tableName = parts[0] || '';
    const layer = parts[1] || '';

    // Determine target/source data based on layer
    let targetColumns = [];
    let sourceEntries = [];
    let filteredLineage = [];
    let sourceLayerLabel = '';
    let targetLayerLabel = '';

    if (layer === 'Silver') {
        const detail = silverDetails.find(t => t.tablename === tableName);
        targetColumns = detail?.ColumnUsed || [];
        sourceEntries = stagingtables.filter(t => t.consumerTable === tableName && t.consumerLayer === 'Silver');
        filteredLineage = columnLineage.filter(t => t.targetTable === tableName && t.targetLayer === 'Silver');
        sourceLayerLabel = 'Bronze';
        targetLayerLabel = 'Silver';
    } else if (layer === 'Gold') {
        const detail = goldDetails.find(t => t.tablename === tableName);
        targetColumns = detail?.ColumnUsed || [];
        sourceEntries = stagingtables.filter(t => t.consumerTable === tableName && t.consumerLayer === 'Gold');
        filteredLineage = columnLineage.filter(t => t.targetTable === tableName && t.targetLayer === 'Gold');
        sourceLayerLabel = 'Silver';
        targetLayerLabel = 'Gold';
    }

    // Group source columns by source table
    const sourceGroups = {};
    sourceEntries.forEach(entry => {
        const key = entry.tablename || 'Unknown';
        if (!sourceGroups[key]) {
            sourceGroups[key] = new Set();
        }
        (entry.ColumnsUsed || []).forEach(col => sourceGroups[key].add(col));
    });

    // Also add Derived group from lineage entries
    filteredLineage.forEach(entry => {
        if (entry.sourceTable === 'Derived' || !entry.sourceTable) {
            if (!sourceGroups['Derived']) {
                sourceGroups['Derived'] = new Set();
            }
            sourceGroups['Derived'].add(entry.sourceColumn || 'None');
        }
    });

    // Convert sets to arrays
    const sourceGroupsArray = Object.entries(sourceGroups).map(([table, cols]) => ({
        table,
        columns: Array.from(cols),
    }));

    // Compute related sets based on selectedColumn
    const { relatedLineKeys, relatedSourceIds, relatedTargetIds, relatedEntries } = useMemo(() => {
        if (!selectedColumn) return { relatedLineKeys: new Set(), relatedSourceIds: new Set(), relatedTargetIds: new Set(), relatedEntries: [] };

        const lineKeys = new Set();
        const srcIds = new Set();
        const tgtIds = new Set();
        const entries = [];

        if (selectedColumn.side === 'source') {
            filteredLineage.forEach((entry, idx) => {
                const srcNorm = normalizeForLookup(entry.sourceTable);
                const srcCol = (entry.sourceColumn || 'none').toLowerCase().replace(/\s+/g, '_');
                if (srcNorm === normalizeForLookup(selectedColumn.table) && srcCol === (selectedColumn.column || 'none').toLowerCase().replace(/\s+/g, '_')) {
                    const srcId = `src-${srcNorm}-${srcCol}`;
                    const tgtId = `tgt-${(entry.targetColumn || '').toLowerCase().replace(/\s+/g, '_')}`;
                    lineKeys.add(`${srcId}-${tgtId}-${idx}`);
                    tgtIds.add(tgtId);
                    entries.push(entry);
                }
            });
        } else if (selectedColumn.side === 'target') {
            const tgtColNorm = (selectedColumn.column || '').toLowerCase().replace(/\s+/g, '_');
            filteredLineage.forEach((entry, idx) => {
                if ((entry.targetColumn || '').toLowerCase().replace(/\s+/g, '_') === tgtColNorm) {
                    const srcNorm = normalizeForLookup(entry.sourceTable);
                    const srcCol = (entry.sourceColumn || 'none').toLowerCase().replace(/\s+/g, '_');
                    const srcId = `src-${srcNorm}-${srcCol}`;
                    const tgtId = `tgt-${tgtColNorm}`;
                    lineKeys.add(`${srcId}-${tgtId}-${idx}`);
                    srcIds.add(srcId);
                    entries.push(entry);
                }
            });
        }

        return { relatedLineKeys: lineKeys, relatedSourceIds: srcIds, relatedTargetIds: tgtIds, relatedEntries: entries };
    }, [selectedColumn, filteredLineage]);

    // Reset selectedColumn when table changes
    useEffect(() => {
        setSelectedColumn(null);
    }, [selectedTable]);

    // Recalculate lines
    const calculateLines = useCallback(() => {
        if (!bodyRef.current || filteredLineage.length === 0) {
            setLines([]);
            return;
        }
        const bodyRect = bodyRef.current.getBoundingClientRect();
        const newLines = [];

        filteredLineage.forEach((entry, idx) => {
            const srcNorm = normalizeForLookup(entry.sourceTable);
            const srcCol = (entry.sourceColumn || 'none').toLowerCase().replace(/\s+/g, '_');
            const srcId = `src-${srcNorm}-${srcCol}`;
            const tgtId = `tgt-${(entry.targetColumn || '').toLowerCase().replace(/\s+/g, '_')}`;
            const srcEl = document.getElementById(srcId);
            const tgtEl = document.getElementById(tgtId);

            if (srcEl && tgtEl) {
                const sr = srcEl.getBoundingClientRect();
                const tr = tgtEl.getBoundingClientRect();
                newLines.push({
                    key: `${srcId}-${tgtId}-${idx}`,
                    x1: sr.right - bodyRect.left,
                    y1: sr.top + sr.height / 2 - bodyRect.top,
                    x2: tr.left - bodyRect.left,
                    y2: tr.top + tr.height / 2 - bodyRect.top,
                    sourceTable: entry.sourceTable,
                    sourceColumn: entry.sourceColumn,
                    targetColumn: entry.targetColumn,
                    transform: entry.transform,
                    expression: entry.expression,
                });
            }
        });
        setLines(newLines);
    }, [filteredLineage]);

    useEffect(() => {
        // Small delay to let DOM render
        const timer = setTimeout(calculateLines, 100);
        return () => clearTimeout(timer);
    }, [selectedTable, filteredLineage, calculateLines]);

    // Recalculate on scroll
    useEffect(() => {
        const body = bodyRef.current;
        if (!body) return;

        const panels = body.querySelectorAll('.col-lineage-panel');
        const onScroll = () => calculateLines();

        panels.forEach(panel => panel.addEventListener('scroll', onScroll));
        window.addEventListener('resize', onScroll);
        window.addEventListener('scroll', onScroll, true);

        return () => {
            panels.forEach(panel => panel.removeEventListener('scroll', onScroll));
            window.removeEventListener('resize', onScroll);
            window.removeEventListener('scroll', onScroll, true);
        };
    }, [calculateLines]);

    // Handle column chip click
    const handleColumnClick = useCallback((id, side, table, column) => {
        setSelectedColumn(prev => {
            if (prev && prev.id === id) {
                // Toggle off
                return null;
            }
            return { id, side, table, column };
        });

        // Auto-scroll the OPPOSITE panel internally after a short delay
        setTimeout(() => {
            let firstRelatedId = null;

            if (side === 'source') {
                // Find first related target column
                const srcNorm = normalizeForLookup(table);
                const srcCol = (column || 'none').toLowerCase().replace(/\s+/g, '_');
                for (const entry of filteredLineage) {
                    const eSrcNorm = normalizeForLookup(entry.sourceTable);
                    const eSrcCol = (entry.sourceColumn || 'none').toLowerCase().replace(/\s+/g, '_');
                    if (eSrcNorm === srcNorm && eSrcCol === srcCol) {
                        firstRelatedId = `tgt-${(entry.targetColumn || '').toLowerCase().replace(/\s+/g, '_')}`;
                        break;
                    }
                }
                // Scroll RIGHT PANEL internally (not the page)
                if (firstRelatedId && rightPanelRef.current) {
                    const el = document.getElementById(firstRelatedId);
                    if (el) {
                        const panelRect = rightPanelRef.current.getBoundingClientRect();
                        const elRect = el.getBoundingClientRect();
                        const scrollOffset = elRect.top - panelRect.top + rightPanelRef.current.scrollTop - panelRect.height / 2 + elRect.height / 2;
                        rightPanelRef.current.scrollTo({ top: scrollOffset, behavior: 'smooth' });
                    }
                }
            } else if (side === 'target') {
                // Find first related source column
                const tgtColNorm = (column || '').toLowerCase().replace(/\s+/g, '_');
                for (const entry of filteredLineage) {
                    if ((entry.targetColumn || '').toLowerCase().replace(/\s+/g, '_') === tgtColNorm) {
                        const srcNorm = normalizeForLookup(entry.sourceTable);
                        const srcCol = (entry.sourceColumn || 'none').toLowerCase().replace(/\s+/g, '_');
                        firstRelatedId = `src-${srcNorm}-${srcCol}`;
                        break;
                    }
                }
                // Scroll LEFT PANEL internally (already works correctly)
                if (firstRelatedId && leftPanelRef.current) {
                    const el = document.getElementById(firstRelatedId);
                    if (el) {
                        const panelRect = leftPanelRef.current.getBoundingClientRect();
                        const elRect = el.getBoundingClientRect();
                        const scrollOffset = elRect.top - panelRect.top + leftPanelRef.current.scrollTop - panelRect.height / 2 + elRect.height / 2;
                        leftPanelRef.current.scrollTo({ top: scrollOffset, behavior: 'smooth' });
                    }
                }
            }

            // Recalculate SVG lines after scroll animation completes
            setTimeout(calculateLines, 350);
        }, 50);
    }, [filteredLineage, calculateLines]);

    // Compute popup position
    const popupStyle = useMemo(() => {
        if (!selectedColumn || !bodyRef.current) return null;
        const el = document.getElementById(selectedColumn.id);
        if (!el) return null;
        const bodyRect = bodyRef.current.getBoundingClientRect();
        const chipRect = el.getBoundingClientRect();
        const top = chipRect.top + chipRect.height / 2 - bodyRect.top;

        if (selectedColumn.side === 'source') {
            return { top, left: '46%' };
        } else {
            return { top, right: '46%' };
        }
    }, [selectedColumn, lines]); // recalc when lines change (after scroll)

    const handleLineHover = (e, line) => {
        // Suppress hover tooltip when a column is selected
        if (selectedColumn) return;
        setHoveredLine(line.key);
        setTooltip({
            x: e.clientX,
            y: e.clientY,
            content: line,
        });
    };

    const handleLineLeave = () => {
        setHoveredLine(null);
        setTooltip(null);
    };

    // Determine line style based on selection state
    const getLineStyle = useCallback((lineKey) => {
        if (selectedColumn) {
            if (relatedLineKeys.has(lineKey)) {
                return { stroke: '#1976d2', strokeWidth: 2.5, opacity: 1 };
            }
            return { stroke: '#e0e0e0', strokeWidth: 1, opacity: 0.3 };
        }
        // Default: hover or normal
        if (hoveredLine === lineKey) {
            return { stroke: '#1976d2', strokeWidth: 2.5, opacity: 1 };
        }
        return { stroke: '#9e9e9e', strokeWidth: 1.5, opacity: 1 };
    }, [selectedColumn, relatedLineKeys, hoveredLine]);

    // Get CSS class for a source column chip
    const getSourceChipClass = useCallback((srcId) => {
        let cls = 'col-lineage-column-chip col-lineage-column-chip-source';
        if (selectedColumn) {
            if (selectedColumn.id === srcId) {
                cls += ' col-lineage-column-chip-selected';
            } else if (relatedSourceIds.has(srcId)) {
                cls += ' col-lineage-column-chip-related';
            }
        }
        return cls;
    }, [selectedColumn, relatedSourceIds]);

    // Get CSS class for a target column chip
    const getTargetChipClass = useCallback((tgtId) => {
        let cls = 'col-lineage-column-chip col-lineage-column-chip-target';
        if (selectedColumn) {
            if (selectedColumn.id === tgtId) {
                cls += ' col-lineage-column-chip-selected';
            } else if (relatedTargetIds.has(tgtId)) {
                cls += ' col-lineage-column-chip-related';
            }
        }
        return cls;
    }, [selectedColumn, relatedTargetIds]);

    const handleDownloadExcel = () => {
        if (!filteredLineage || filteredLineage.length === 0) return;

        const excelData = filteredLineage.map(item => ({
            "Target Column": item.targetColumn,
            "Source Table": item.sourceTable,
            "Source Column": item.sourceColumn,
            "Transform": item.transform,
            "Expression": item.expression
        }));

        const ws = XLSX.utils.json_to_sheet(excelData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Column Mapping");
        XLSX.writeFile(wb, `ColumnMapping_${tableName}.xlsx`);
        setDownloadMenuAnchor(null);
    };

    const handleDownloadImage = () => {
        if (containerRef.current === null) return;
        setDownloadMenuAnchor(null);

        const container = containerRef.current;
        const body = bodyRef.current;
        const leftPanel = leftPanelRef.current;
        const rightPanel = rightPanelRef.current;

        // Save original styles
        const origContainer = { height: container.style.height, maxHeight: container.style.maxHeight, overflow: container.style.overflow };
        const origBody = { overflow: body?.style.overflow, minHeight: body?.style.minHeight };
        const origLeft = { overflowY: leftPanel?.style.overflowY };
        const origRight = { overflowY: rightPanel?.style.overflowY };

        // Temporarily expand to full content height
        container.style.height = 'auto';
        container.style.maxHeight = 'none';
        container.style.overflow = 'visible';
        if (body) { body.style.overflow = 'visible'; body.style.minHeight = 'auto'; }
        if (leftPanel) { leftPanel.style.overflowY = 'visible'; }
        if (rightPanel) { rightPanel.style.overflowY = 'visible'; }

        // Recalculate SVG lines for expanded layout
        calculateLines();

        // Small delay to let the DOM reflow before capture
        setTimeout(() => {
            toPng(container, { cacheBust: true, backgroundColor: '#ffffff' })
                .then((dataUrl) => {
                    const link = document.createElement('a');
                    link.download = `ColumnMapping_${tableName}.png`;
                    link.href = dataUrl;
                    link.click();
                })
                .catch((err) => {
                    console.error('Failed to generate image', err);
                })
                .finally(() => {
                    // Restore original styles
                    container.style.height = origContainer.height;
                    container.style.maxHeight = origContainer.maxHeight;
                    container.style.overflow = origContainer.overflow;
                    if (body) { body.style.overflow = origBody.overflow; body.style.minHeight = origBody.minHeight; }
                    if (leftPanel) { leftPanel.style.overflowY = origLeft.overflowY; }
                    if (rightPanel) { rightPanel.style.overflowY = origRight.overflowY; }
                    // Recalculate lines for restored layout
                    calculateLines();
                });
        }, 100);
    };

    // Edge cases
    if (!selectedTable) {
        return (
            <div className="col-lineage-container">
                <div className="col-lineage-empty">
                    <div className="col-lineage-empty-icon">🔗</div>
                    <div className="col-lineage-empty-text">
                        Select a Silver or Gold table from the dropdown above to view column mappings.
                    </div>
                </div>
            </div>
        );
    }

    if (layer === 'Bronze') {
        return (
            <div className="col-lineage-container">
                <div className="col-lineage-empty">
                    <div className="col-lineage-empty-icon">⚠️</div>
                    <div className="col-lineage-empty-text">
                        Column mapping is available for Silver and Gold tables only. Please select a Silver or Gold table.
                    </div>
                </div>
            </div>
        );
    }

    if (filteredLineage.length === 0 && targetColumns.length === 0) {
        return (
            <div className="col-lineage-container">
                <div className="col-lineage-empty">
                    <div className="col-lineage-empty-icon">📭</div>
                    <div className="col-lineage-empty-text">
                        Column lineage data not available. Re-process files to generate column mappings.
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="col-lineage-container" ref={containerRef}>
            <div className="col-lineage-header">
                <div>
                    <span className="col-lineage-title">Column Lineage</span>
                    <span className="col-lineage-subtitle">
                        {sourceLayerLabel} → {targetLayerLabel} mappings for: <strong>{tableName}</strong>
                    </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <IconButton
                        onClick={(e) => setDownloadMenuAnchor(e.currentTarget)}
                        size="small"
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
                        onClose={() => setDownloadMenuAnchor(null)}
                        anchorOrigin={{
                            vertical: 'bottom',
                            horizontal: 'right',
                        }}
                        transformOrigin={{
                            vertical: 'top',
                            horizontal: 'right',
                        }}
                    >
                        <MenuItem onClick={handleDownloadExcel}>
                            <ListItemIcon>
                                <TableChartIcon fontSize="small" />
                            </ListItemIcon>
                            <ListItemText>Column Mapping (Excel)</ListItemText>
                        </MenuItem>
                        <MenuItem onClick={handleDownloadImage}>
                            <ListItemIcon>
                                <ImageIcon fontSize="small" />
                            </ListItemIcon>
                            <ListItemText>Column Mapping (PNG)</ListItemText>
                        </MenuItem>
                    </Menu>
                    <span className="col-lineage-edge-count">Edges: {filteredLineage.length}</span>
                </div>
            </div>

            <div className="col-lineage-body" ref={bodyRef}>
                {/* SVG Overlay */}
                <svg className="col-lineage-svg">
                    {lines.map((l) => {
                        const style = getLineStyle(l.key);
                        return (
                            <path
                                key={l.key}
                                d={`M ${l.x1} ${l.y1} C ${(l.x1 + l.x2) / 2} ${l.y1}, ${(l.x1 + l.x2) / 2} ${l.y2}, ${l.x2} ${l.y2}`}
                                stroke={style.stroke}
                                strokeWidth={style.strokeWidth}
                                opacity={style.opacity}
                                fill="none"
                                style={{ pointerEvents: 'stroke', cursor: 'pointer' }}
                                onMouseEnter={(e) => handleLineHover(e, l)}
                                onMouseLeave={handleLineLeave}
                            />
                        );
                    })}
                </svg>

                {/* Left Panel - Sources */}
                <div className="col-lineage-panel col-lineage-panel-left" ref={leftPanelRef}>
                    <div className="col-lineage-panel-header">
                        <span className="col-lineage-badge col-lineage-badge-source">{sourceLayerLabel}</span>
                        <span>Source Tables & Columns</span>
                    </div>
                    {sourceGroupsArray.length === 0 ? (
                        <div className="col-lineage-no-sources">No source tables found</div>
                    ) : (
                        sourceGroupsArray.map((group) => (
                            <div
                                key={group.table}
                                className={`col-lineage-source-group ${group.table === 'Derived' ? 'col-lineage-source-derived' : ''}`}
                            >
                                <div className="col-lineage-source-group-header">
                                    {group.table === 'Derived' ? (
                                        <em>Derived</em>
                                    ) : (
                                        normalizeForLookup(group.table) !== group.table.toLowerCase()
                                            ? group.table
                                            : group.table
                                    )}
                                </div>
                                <div className="col-lineage-column-list">
                                    {group.columns.map((col) => {
                                        const srcNorm = normalizeForLookup(group.table);
                                        const colNorm = (col || 'none').toLowerCase().replace(/\s+/g, '_');
                                        const chipId = `src-${srcNorm}-${colNorm}`;
                                        return (
                                            <div
                                                key={`${group.table}-${col}`}
                                                className={getSourceChipClass(chipId)}
                                                id={chipId}
                                                onClick={() => handleColumnClick(chipId, 'source', group.table, col)}
                                                style={{ cursor: 'pointer' }}
                                            >
                                                {col || 'None'}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        ))
                    )}
                </div>

                {/* Right Panel - Target */}
                <div className="col-lineage-panel col-lineage-panel-right" ref={rightPanelRef}>
                    <div className="col-lineage-panel-header">
                        <span className="col-lineage-badge col-lineage-badge-target">{targetLayerLabel}</span>
                        <span>{tableName} Columns</span>
                    </div>
                    <div className="col-lineage-column-list">
                        {targetColumns.map((col) => {
                            const colNorm = (col || '').toLowerCase().replace(/\s+/g, '_');
                            const chipId = `tgt-${colNorm}`;
                            return (
                                <div
                                    key={col}
                                    className={getTargetChipClass(chipId)}
                                    id={chipId}
                                    onClick={() => handleColumnClick(chipId, 'target', null, col)}
                                    style={{ cursor: 'pointer' }}
                                >
                                    {col}
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Persistent Popup for selected column */}
                {selectedColumn && relatedEntries.length > 0 && popupStyle && (
                    <div className="col-lineage-popup" style={popupStyle}>
                        {relatedEntries.map((entry, i) => (
                            <div key={i} className="col-lineage-popup-entry">
                                <div className="col-lineage-popup-label">Mapping</div>
                                <div className="col-lineage-popup-value">
                                    {entry.sourceTable || 'Derived'}.{entry.sourceColumn || 'N/A'} → {entry.targetColumn}
                                </div>
                                <div className="col-lineage-popup-label">Transform</div>
                                <div className="col-lineage-popup-value">{entry.transform || 'N/A'}</div>
                                <div className="col-lineage-popup-label">Expression</div>
                                <div className="col-lineage-popup-value">{entry.expression || 'N/A'}</div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Tooltip (only when no column is selected) */}
            {!selectedColumn && tooltip && (
                <div
                    className="col-lineage-tooltip"
                    style={{
                        position: 'fixed',
                        left: tooltip.x + 12,
                        top: tooltip.y - 10,
                    }}
                >
                    <div><strong>{tooltip.content.sourceTable}</strong>.{tooltip.content.sourceColumn || 'N/A'} → <strong>{tooltip.content.targetColumn}</strong></div>
                    <div>Transform: {tooltip.content.transform || 'N/A'}</div>
                    <div style={{ fontSize: '11px', color: '#888', wordBreak: 'break-all' }}>
                        {tooltip.content.expression || ''}
                    </div>
                </div>
            )}
        </div>
    );
}

export default ColumnLineageView;

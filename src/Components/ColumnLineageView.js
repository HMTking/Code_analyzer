import React, { useState, useEffect, useRef, useCallback } from 'react';
import './ColumnLineageView.css';

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
    const [lines, setLines] = useState([]);
    const [hoveredLine, setHoveredLine] = useState(null);
    const [tooltip, setTooltip] = useState(null);

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

        return () => {
            panels.forEach(panel => panel.removeEventListener('scroll', onScroll));
            window.removeEventListener('resize', onScroll);
        };
    }, [calculateLines]);

    const handleLineHover = (e, line) => {
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
                <span className="col-lineage-edge-count">Edges: {filteredLineage.length}</span>
            </div>

            <div className="col-lineage-body" ref={bodyRef}>
                {/* SVG Overlay */}
                <svg className="col-lineage-svg">
                    {lines.map((l) => (
                        <path
                            key={l.key}
                            d={`M ${l.x1} ${l.y1} C ${(l.x1 + l.x2) / 2} ${l.y1}, ${(l.x1 + l.x2) / 2} ${l.y2}, ${l.x2} ${l.y2}`}
                            stroke={hoveredLine === l.key ? '#1976d2' : '#9e9e9e'}
                            strokeWidth={hoveredLine === l.key ? 2.5 : 1.5}
                            fill="none"
                            style={{ pointerEvents: 'stroke', cursor: 'pointer' }}
                            onMouseEnter={(e) => handleLineHover(e, l)}
                            onMouseLeave={handleLineLeave}
                        />
                    ))}
                </svg>

                {/* Left Panel - Sources */}
                <div className="col-lineage-panel col-lineage-panel-left">
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
                                        return (
                                            <div
                                                key={`${group.table}-${col}`}
                                                className="col-lineage-column-chip col-lineage-column-chip-source"
                                                id={`src-${srcNorm}-${colNorm}`}
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
                <div className="col-lineage-panel col-lineage-panel-right">
                    <div className="col-lineage-panel-header">
                        <span className="col-lineage-badge col-lineage-badge-target">{targetLayerLabel}</span>
                        <span>{tableName} Columns</span>
                    </div>
                    <div className="col-lineage-column-list">
                        {targetColumns.map((col) => {
                            const colNorm = (col || '').toLowerCase().replace(/\s+/g, '_');
                            return (
                                <div
                                    key={col}
                                    className="col-lineage-column-chip col-lineage-column-chip-target"
                                    id={`tgt-${colNorm}`}
                                >
                                    {col}
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* Tooltip */}
            {tooltip && (
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

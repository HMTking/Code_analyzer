import * as React from 'react';
import PropTypes from 'prop-types';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell, { tableCellClasses } from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import { styled } from '@mui/material/styles';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import KeyboardArrowRightIcon from '@mui/icons-material/KeyboardArrowRight';
import IconButton from '@mui/material/IconButton';

const StyledTableCell = styled(TableCell)(({ theme }) => ({
    [`&.${tableCellClasses.head}`]: {
        backgroundColor: '#000000 !important',
        color: theme.palette.common.white,
        borderRight: '1px solid #444',
        borderBottom: '2px solid #444',
    },
    [`&.${tableCellClasses.body}`]: {
        fontSize: 14,
        borderRight: '1px solid #ddd',
        borderBottom: '1px solid #ddd',
        backgroundColor: '#fff',
        transition: 'background-color 0.15s ease-in-out',
    },
}));

const StyledTableRow = styled(TableRow)(({ theme }) => ({
    '&:nth-of-type(odd)': {
        backgroundColor: theme.palette.action.hover,
    },
}));

function CustomTabPanel(props) {
    const { children, value, index, ...other } = props;

    return (
        <div
            role="tabpanel"
            hidden={value !== index}
            id={`fabric-tabpanel-${index}`}
            aria-labelledby={`fabric-tab-${index}`}
            {...other}
            style={{ 
                overflowX: 'hidden', 
                overflowY: 'auto',
                opacity: value === index ? 1 : 0,
                transition: 'opacity 0.2s ease-in-out',
            }}
        >
            {value === index && (
                <Box sx={{ p: 0 }}>
                    {children}
                </Box>
            )}
        </div>
    );
}

CustomTabPanel.propTypes = {
    children: PropTypes.node,
    index: PropTypes.number.isRequired,
    value: PropTypes.number.isRequired,
};

function a11yProps(index) {
    return {
        id: `fabric-tab-${index}`,
        'aria-controls': `fabric-tabpanel-${index}`,
    };
}

// Helper to render array values on separate lines
function renderArrayValue(arr) {
    if (!arr || arr.length === 0) return '-';
    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            {arr.map((item, idx) => (
                <Box 
                    key={idx} 
                    sx={{ 
                        fontSize: '14px',
                        lineHeight: '1.5'
                    }}
                >
                    {item}
                </Box>
            ))}
        </Box>
    );
}

// Generic table component for displaying data with resizable columns
function DataTable({ data, columns, emptyMessage, tableId }) {
    const tableRef = React.useRef(null);
    const containerRef = React.useRef(null);
    const [expandedRows, setExpandedRows] = React.useState(new Set());
    
    const toggleRow = (rowIndex) => {
        setExpandedRows(prev => {
            const newSet = new Set(prev);
            if (newSet.has(rowIndex)) {
                newSet.delete(rowIndex);
            } else {
                newSet.add(rowIndex);
            }
            return newSet;
        });
    };
    
    // Check if row has expandable content (arrays with multiple items)
    const hasExpandableContent = (row) => {
        return columns.some(col => {
            const val = row[col.key];
            return Array.isArray(val) && val.length > 3;
        });
    };
    
    const [columnWidths, setColumnWidths] = React.useState(() => {
        // Initialize with equal percentages
        const widths = {};
        columns.forEach((col, index) => {
            widths[index] = 100 / columns.length;
        });
        return widths;
    });

    const resizingRef = React.useRef(null);
    const startXRef = React.useRef(0);
    const startWidthRef = React.useRef(0);
    const nextColStartWidthRef = React.useRef(0);

    const handleMouseDown = (e, colIndex) => {
        e.preventDefault();
        e.stopPropagation();
        if (colIndex >= columns.length - 1) return; // Can't resize last column from right edge
        
        resizingRef.current = colIndex;
        startXRef.current = e.clientX;
        startWidthRef.current = columnWidths[colIndex];
        nextColStartWidthRef.current = columnWidths[colIndex + 1];
        
        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
    };

    const handleMouseMove = React.useCallback((e) => {
        if (resizingRef.current === null || !containerRef.current) return;
        
        const containerWidth = containerRef.current.offsetWidth;
        const diffPx = e.clientX - startXRef.current;
        const diffPercent = (diffPx / containerWidth) * 100;
        
        const newWidth = Math.max(5, startWidthRef.current + diffPercent);
        const newNextWidth = Math.max(5, nextColStartWidthRef.current - diffPercent);
        
        // Only update if both columns stay above minimum
        if (newWidth >= 5 && newNextWidth >= 5) {
            setColumnWidths(prev => ({
                ...prev,
                [resizingRef.current]: newWidth,
                [resizingRef.current + 1]: newNextWidth
            }));
        }
    }, []);

    const handleMouseUp = React.useCallback(() => {
        resizingRef.current = null;
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
    }, [handleMouseMove]);

    if (!data || data.length === 0) {
        return <p style={{ width: "100%", textAlign: "center", fontSize: "20px" }}>{emptyMessage}</p>;
    }

    return (
        <TableContainer 
            ref={containerRef} 
            sx={{ 
                maxHeight: 500, 
                width: '100%', 
                overflowX: 'hidden', 
                overflowY: 'auto',
                scrollBehavior: 'smooth',
                WebkitOverflowScrolling: 'touch',
                '&::-webkit-scrollbar': {
                    width: '8px',
                },
                '&::-webkit-scrollbar-track': {
                    backgroundColor: '#f1f1f1',
                    borderRadius: '4px',
                },
                '&::-webkit-scrollbar-thumb': {
                    backgroundColor: '#059bbf',
                    borderRadius: '4px',
                    '&:hover': {
                        backgroundColor: '#047a96',
                    },
                },
            }}
        >
            <Table 
                ref={tableRef}
                stickyHeader 
                aria-label="data table" 
                sx={{ 
                    borderCollapse: 'separate', 
                    borderSpacing: 0, 
                    tableLayout: 'fixed',
                    width: '100%',
                    transform: 'translateZ(0)',
                }}
            >
                <TableHead>
                    <TableRow>
                        {columns.map((col, index) => (
                            <StyledTableCell 
                                key={index} 
                                sx={{ 
                                    width: `${columnWidths[index]}%`,
                                    wordBreak: 'break-word',
                                    position: 'relative',
                                    userSelect: 'none'
                                }}
                            >
                                {col.label}
                                {index < columns.length - 1 && (
                                    <Box
                                        onMouseDown={(e) => handleMouseDown(e, index)}
                                        sx={{
                                            position: 'absolute',
                                            right: 0,
                                            top: 0,
                                            bottom: 0,
                                            width: '5px',
                                            cursor: 'col-resize',
                                            backgroundColor: 'transparent',
                                            '&:hover': {
                                                backgroundColor: 'rgba(255,255,255,0.3)'
                                            }
                                        }}
                                    />
                                )}
                            </StyledTableCell>
                        ))}
                    </TableRow>
                </TableHead>
                <TableBody>
                    {data.map((row, rowIndex) => {
                        const isExpanded = expandedRows.has(rowIndex);
                        const canExpand = hasExpandableContent(row);
                        
                        return (
                            <StyledTableRow key={rowIndex}>
                                {columns.map((col, colIndex) => {
                                    const cellValue = row[col.key];
                                    const isArray = Array.isArray(cellValue);
                                    const showCollapsed = isArray && cellValue.length > 3 && !isExpanded;
                                    
                                    return (
                                        <TableCell 
                                            key={colIndex}
                                            sx={colIndex === 0 ? { 
                                                backgroundColor: '#059bbf', 
                                                color: 'white',
                                                fontWeight: 'bold',
                                                verticalAlign: 'top',
                                                borderRight: '1px solid #ddd',
                                                borderBottom: '1px solid #ddd',
                                                wordBreak: 'break-word',
                                                cursor: canExpand ? 'pointer' : 'default'
                                            } : { 
                                                verticalAlign: 'top',
                                                borderRight: '1px solid #ddd',
                                                borderBottom: '1px solid #ddd',
                                                wordBreak: 'break-word'
                                            }}
                                            onClick={colIndex === 0 && canExpand ? () => toggleRow(rowIndex) : undefined}
                                        >
                                            {colIndex === 0 && canExpand && (
                                                <IconButton 
                                                    size="small" 
                                                    sx={{ 
                                                        p: 0, 
                                                        mr: 0.5, 
                                                        color: 'white',
                                                        verticalAlign: 'middle'
                                                    }}
                                                    onClick={(e) => { e.stopPropagation(); toggleRow(rowIndex); }}
                                                >
                                                    {isExpanded ? 
                                                        <KeyboardArrowDownIcon sx={{ fontSize: 18 }} /> : 
                                                        <KeyboardArrowRightIcon sx={{ fontSize: 18 }} />
                                                    }
                                                </IconButton>
                                            )}
                                            {isArray 
                                                ? (showCollapsed 
                                                    ? <Box sx={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                                        {cellValue.slice(0, 3).map((item, idx) => (
                                                            <Box key={idx} sx={{ fontSize: '14px', lineHeight: '1.5' }}>{item}</Box>
                                                        ))}
                                                        <Box 
                                                            sx={{ 
                                                                fontSize: '12px', 
                                                                color: '#059bbf', 
                                                                cursor: 'pointer',
                                                                fontWeight: 500,
                                                                mt: 0.5
                                                            }}
                                                            onClick={() => toggleRow(rowIndex)}
                                                        >
                                                            +{cellValue.length - 3} more...
                                                        </Box>
                                                      </Box>
                                                    : renderArrayValue(cellValue))
                                                : cellValue || '-'}
                                        </TableCell>
                                    );
                                })}
                            </StyledTableRow>
                        );
                    })}
                </TableBody>
            </Table>
        </TableContainer>
    );
}

// Fabric Enhanced staging-tables panel: groups by OUTPUT (consumer) table.
// Each output table is a heading; under it list every source table that fed it
// and the columns consumed from that source.
function StagingTablesGrouped({ stagingtables }) {
    const COLLAPSED_COUNT = 4;
    const [expanded, setExpanded] = React.useState({});
    const groups = React.useMemo(() => {
        const map = {};
        (stagingtables || []).forEach(row => {
            if (!row || !row.tablename) return;
            const layer = row.consumerLayer ? `${row.consumerLayer}/` : '';
            const consumer = `${layer}${row.consumerTable || '(unknown)'}`;
            if (!map[consumer]) {
                map[consumer] = { consumerTable: consumer, sources: [] };
            }
            const cols = Array.isArray(row.ColumnsUsed)
                ? row.ColumnsUsed
                : (row.ColumnsUsed ? String(row.ColumnsUsed).split(',').map(s => s.trim()).filter(Boolean) : []);
            map[consumer].sources.push({
                tablename: row.tablename,
                ColumnsUsed: cols
            });
        });
        return Object.values(map).sort((a, b) => (a.consumerTable || '').localeCompare(b.consumerTable || ''));
    }, [stagingtables]);

    if (!stagingtables || stagingtables.length === 0) {
        return <p style={{ width: '100%', textAlign: 'center', fontSize: '20px' }}>No Staging Table Column data found in the files.</p>;
    }

    return (
        <Box sx={{ maxHeight: 500, overflowY: 'auto', pr: 1 }}>
            {groups.map((g, gi) => {
                const key = `${g.consumerTable}-${gi}`;
                const isOpen = !!expanded[key];
                const total = g.sources.length;
                const visible = isOpen ? g.sources : g.sources.slice(0, COLLAPSED_COUNT);
                const hiddenCount = total - visible.length;
                return (
                    <Box key={key} sx={{ mb: 2, border: '1px solid #ddd', borderRadius: 0, overflow: 'hidden' }}>
                        <Box sx={{
                            backgroundColor: '#000',
                            color: '#fff',
                            px: 2,
                            py: 1.25,
                            fontWeight: 700,
                            fontSize: 15,
                            borderBottom: '2px solid #444',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between'
                        }}>
                            <span>{g.consumerTable}</span>
                            <span style={{ fontSize: 12, fontWeight: 400, opacity: 0.8 }}>{total} source{total === 1 ? '' : 's'}</span>
                        </Box>
                        <Box sx={{ backgroundColor: '#fff' }}>
                            {visible.map((s, si) => (
                                <Box
                                    key={`${s.tablename}-${si}`}
                                    sx={{
                                        display: 'flex',
                                        alignItems: 'stretch',
                                        borderTop: si === 0 ? 'none' : '1px solid #ddd',
                                        backgroundColor: si % 2 === 1 ? 'rgba(0,0,0,0.04)' : '#fff'
                                    }}
                                >
                                    <Box sx={{
                                        width: 280,
                                        minWidth: 280,
                                        backgroundColor: '#059bbf',
                                        color: 'white',
                                        fontWeight: 'bold',
                                        fontSize: 14,
                                        px: 2,
                                        py: 1.25,
                                        borderRight: '1px solid #ddd',
                                        wordBreak: 'break-word'
                                    }}>
                                        {s.tablename}
                                    </Box>
                                    <Box sx={{
                                        flex: 1,
                                        fontSize: 14,
                                        color: '#333',
                                        px: 2,
                                        py: 1.25,
                                        wordBreak: 'break-word'
                                    }}>
                                        {s.ColumnsUsed.length > 0
                                            ? s.ColumnsUsed.join(', ')
                                            : <em style={{ color: '#888' }}>No columns recorded</em>}
                                    </Box>
                                </Box>
                            ))}
                            {total > COLLAPSED_COUNT && (
                                <Box
                                    onClick={() => setExpanded(prev => ({ ...prev, [key]: !prev[key] }))}
                                    sx={{
                                        cursor: 'pointer',
                                        userSelect: 'none',
                                        borderTop: '1px solid #ddd',
                                        backgroundColor: '#f5fbfd',
                                        color: '#059bbf',
                                        fontWeight: 600,
                                        fontSize: 13,
                                        px: 2,
                                        py: 1,
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 0.5,
                                        '&:hover': { backgroundColor: '#e6f5fa' }
                                    }}
                                >
                                    {isOpen
                                        ? <><KeyboardArrowDownIcon sx={{ fontSize: 18 }} /> Show less</>
                                        : <><KeyboardArrowRightIcon sx={{ fontSize: 18 }} /> Show {hiddenCount} more source{hiddenCount === 1 ? '' : 's'}</>
                                    }
                                </Box>
                            )}
                        </Box>
                    </Box>
                );
            })}
        </Box>
    );
}

function TabsFabricEnhanced({ pipelines, bronzeDetails, silverDetails, goldDetails, stagingtables }) {
    const [value, setValue] = React.useState(0);

    const handleChange = (event, newValue) => {
        setValue(newValue);
    };

    // Column definitions for each tab
    const pipelinesColumns = [
        { key: 'TableName', label: 'Table Name', width: '15%' },
        { key: 'Path', label: 'Path', width: '15%' },
        { key: 'SQLConnection', label: 'SQL Connection', width: '18%' },
        { key: 'SourceDetails', label: 'Source Details', width: '14%' },
        { key: 'DumpLocation', label: 'Dump Location', width: '14%' },
        { key: 'Columns', label: 'Columns', width: '12%' },
        { key: 'filepathname', label: 'File Path', width: '12%' }
    ];

    const bronzeColumns = [
        { key: 'tablename', label: 'Table Name', width: '15%' },
        { key: 'SchemaDump', label: 'Schema Dump', width: '20%' },
        { key: 'Source', label: 'Source', width: '15%' },
        { key: 'TableUsed', label: 'Tables Used', width: '25%' },
        { key: 'filepathname', label: 'File Path', width: '25%' }
    ];

    const silverGoldColumns = [
        { key: 'tablename', label: 'Table Name', width: '15%' },
        { key: 'SchemaDump', label: 'Schema Dump', width: '20%' },
        { key: 'Tablesused', label: 'Tables Used', width: '15%' },
        { key: 'ColumnUsed', label: 'Columns', width: '30%' },
        { key: 'filepathname', label: 'File Path', width: '20%' }
    ];

    const stagingColumns = [
        { key: 'tablename', label: 'Table Name', width: '30%' },
        { key: 'ColumnsUsed', label: 'Columns Used', width: '70%' }
    ];

    return (
        <div>
            <Box sx={{ width: '100%' }}>
                <Box sx={{ borderBottom: 1, borderColor: 'divider', margin: "1rem 0rem", marginBottom: "0rem" }}>
                    <Tabs value={value} onChange={handleChange} aria-label="fabric enhanced tabs">
                        <Tab label="Pipelines" {...a11yProps(0)} />
                        <Tab label="Bronze Layer" {...a11yProps(1)} />
                        <Tab label="Silver Layer" {...a11yProps(2)} />
                        <Tab label="Gold Layer" {...a11yProps(3)} />
                        <Tab label="Table and Column Summary" {...a11yProps(4)} />
                    </Tabs>
                </Box>

                <CustomTabPanel value={value} index={0}>
                    <DataTable 
                        data={[...pipelines]
                            .filter(p => {
                                // Only show pipelines with actual data - filter out empty entries
                                if (!p.TableName && !p.Path && !p.SQLConnection) return false;
                                return true;
                            })
                            .sort((a, b) => {
                                // First sort by SourceDetails (database) to group tables from same database together
                                const sourceCompare = (a.SourceDetails || '').localeCompare(b.SourceDetails || '');
                                if (sourceCompare !== 0) return sourceCompare;
                                // Then sort by TableName within each database group
                                return (a.TableName || '').localeCompare(b.TableName || '');
                            })} 
                        columns={pipelinesColumns} 
                        emptyMessage="No Pipeline data found in the files."
                    />
                </CustomTabPanel>

                <CustomTabPanel value={value} index={1}>
                    <DataTable 
                        data={[...bronzeDetails].sort((a, b) => (a.tablename || '').localeCompare(b.tablename || ''))} 
                        columns={bronzeColumns} 
                        emptyMessage="No Bronze Layer data found in the files."
                    />
                </CustomTabPanel>

                <CustomTabPanel value={value} index={2}>
                    <DataTable 
                        data={[...silverDetails].sort((a, b) => (a.tablename || '').localeCompare(b.tablename || ''))} 
                        columns={silverGoldColumns} 
                        emptyMessage="No Silver Layer data found in the files."
                    />
                </CustomTabPanel>

                <CustomTabPanel value={value} index={3}>
                    <DataTable 
                        data={[...goldDetails].sort((a, b) => (a.tablename || '').localeCompare(b.tablename || ''))} 
                        columns={silverGoldColumns} 
                        emptyMessage="No Gold Layer data found in the files."
                    />
                </CustomTabPanel>

                <CustomTabPanel value={value} index={4}>
                    <StagingTablesGrouped stagingtables={stagingtables} />
                </CustomTabPanel>
            </Box>
        </div>
    );
}

export default TabsFabricEnhanced;

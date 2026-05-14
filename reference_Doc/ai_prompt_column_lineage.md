# AI PROMPT: Build Column-to-Column Lineage Mapping Feature

## PROJECT CONTEXT

This is a React.js application called "Code Analyzer". It analyzes Fabric/Databricks notebook files using Azure OpenAI GPT, extracts data lineage (Bronze → Silver → Gold layers), and visualizes it.

**Tech stack:** React 18, MUI, ReactFlow, react-bootstrap, axios, localStorage for state persistence.

**Key page:** `/v2/fabricenhancedlineage` — The "Fabric Lineage View" page. Currently shows a ReactFlow graph of table-level lineage. We are adding a SECOND view mode to this SAME page.

---

## WHAT TO BUILD

Add a **"Column Mapping"** view mode to the existing lineage page. The user gets a **dropdown** to switch between:
- **"Table Lineage"** → existing ReactFlow view (DO NOT TOUCH)
- **"Column Mapping"** → NEW two-panel column-to-column mapping visualization

When "Column Mapping" is selected and a Silver/Gold table is chosen from the existing dropdown:
- **Silver table selected** → Right panel: Silver table columns | Left panel: Bronze source tables + columns | SVG lines connecting source→target columns
- **Gold table selected** → Right panel: Gold table columns | Left panel: Silver source tables + columns | SVG lines connecting source→target columns

### CRITICAL RULES
1. **DO NOT modify** the existing ReactFlow lineage view AT ALL
2. **DO NOT modify** any backend files
3. **DO NOT modify** `TabsFabricEnhanced.js` or `NavbarEnhanced.js`
4. The two view modes must be **completely independent**

---

## FILES TO MODIFY/CREATE

| File | Action |
|------|--------|
| `src/Components/FabricEnhanced.js` | MODIFY — GPT prompts + state + localStorage |
| `src/Components/OutputViewFabricEnhanced.js` | MODIFY — Add view mode dropdown + conditional render |
| `src/Components/ColumnLineageView.js` | **NEW** — The visualization component |
| `src/Components/ColumnLineageView.css` | **NEW** — Styles |

---

## STEP 1: Modify GPT Prompts in FabricEnhanced.js

### 1A. Silver Prompt (Category 3)

**Current JSON schema at ~line 741-758:**

```json
{
  "identifier": 3,
  "silverDetails": [
    {
      "tablename": "<output_table_name>",
      "SchemaDump": "<schema_dump_path_or_null>",
      "Tablesused": ["<schema/source_table1>", "<schema/source_table2>"],
      "ColumnUsed": ["<col1>", "<col2>"]
    }
  ],
  "stagingtablesinfo": [
    {
      "tablename": "<schema/source_table_name>",
      "consumerTable": "<produced_silver_table_name>",
      "ColumnsUsed": ["<col1>", "<col2>"]
    }
  ]
}
```

**Change to (ADD `columnLineage` field):**

```json
{
  "identifier": 3,
  "silverDetails": [
    {
      "tablename": "<output_table_name>",
      "SchemaDump": "<schema_dump_path_or_null>",
      "Tablesused": ["<schema/source_table1>", "<schema/source_table2>"],
      "ColumnUsed": ["<col1>", "<col2>"]
    }
  ],
  "stagingtablesinfo": [
    {
      "tablename": "<schema/source_table_name>",
      "consumerTable": "<produced_silver_table_name>",
      "ColumnsUsed": ["<col1>", "<col2>"]
    }
  ],
  "columnLineage": [
    {
      "targetTable": "<produced_silver_table_name>",
      "targetColumn": "<silver_output_column_name>",
      "sourceTable": "<source_table_name_matching_stagingtablesinfo_tablename>",
      "sourceColumn": "<source_column_name_or_null_if_derived>",
      "transform": "<direct_alias|cast|case_when|expression|derived>",
      "expression": "<the_SQL_or_PySpark_expression>"
    }
  ]
}
```

**Also ADD this instruction text** right after the existing stagingtablesinfo rules (before the closing `}` of the schema), around line 740:

```
Additionally, populate "columnLineage" with EVERY column-to-column mapping for the final output table(s).
For each column in silverDetails.ColumnUsed, emit ONE columnLineage entry with:
- "targetTable": the produced silver table name (matches silverDetails.tablename)
- "targetColumn": the output column name exactly as it appears in ColumnUsed
- "sourceTable": the source table this column originates from (must match a tablename in stagingtablesinfo). If the column is derived from a literal/timestamp/expression with no source table, use "Derived".
- "sourceColumn": the raw source column name (e.g., "VBELN", "KUNNR"). null if derived.
- "transform": one of "direct_alias", "cast", "case_when", "expression", "derived"
- "expression": the actual SQL/PySpark expression (e.g., "VBELN as delivery_number", "CAST(KLIMK AS DECIMAL(15,2))")
If a target column has MULTIPLE source columns (e.g., COALESCE(A.col1, B.col2)), emit MULTIPLE entries — one per source column — with the same targetColumn.
```

### 1B. Gold Prompt (Category 4)

**Do the EXACT same thing** for the Gold prompt at ~line 806-823. Add `columnLineage` to the JSON schema and add the same instruction text. The schema is identical.

---

## STEP 2: Add State & localStorage in FabricEnhanced.js

### 2A. Add state variable

**After line 122** (`const [stagingtables, setStagingTables] = useState([]);`), add:

```javascript
const [columnLineage, setColumnLineage] = useState([]);
```

### 2B. Restore from localStorage

**After line 176** (`if (data.stagingtables) setStagingTables(data.stagingtables);`), add:

```javascript
if (data.columnLineage) setColumnLineage(data.columnLineage);
```

### 2C. Add to outputData object

**At line 201-207**, change the `outputData` object to include `columnLineage`:

```javascript
const outputData = {
    pipelines,
    bronzeDetails,
    silverDetails,
    goldDetails,
    stagingtables,
    columnLineage
};
```

### 2D. Add to useEffect dependency array

**At line 248**, add `columnLineage` to the dependency array:

```javascript
}, [hasProcessed, loading, pipelines, bronzeDetails, silverDetails, goldDetails, stagingtables, columnLineage, fileprocess, fileError, filenotdetected, messageResponse]);
```

### 2E. Parse Silver GPT response (flag === 3)

**After the `setStagingTables` block that ends at line 1010** (the `});` closing the Silver setStagingTables), add:

```javascript
// Column lineage for Silver
if (Array.isArray(jsonobject?.columnLineage) && jsonobject.columnLineage.length > 0) {
    setColumnLineage(prev => {
        const updated = [...prev];
        jsonobject.columnLineage.forEach(entry => {
            const newEntry = { ...entry, targetLayer: 'Silver' };
            const exists = updated.some(e =>
                e.targetTable === newEntry.targetTable &&
                e.targetColumn === newEntry.targetColumn &&
                e.sourceTable === newEntry.sourceTable &&
                e.sourceColumn === newEntry.sourceColumn &&
                e.targetLayer === newEntry.targetLayer
            );
            if (!exists) updated.push(newEntry);
        });
        return updated;
    });
}
```

### 2F. Parse Gold GPT response (flag === 4)

**After the `setStagingTables` block that ends at ~line 1069** (the Gold setStagingTables closing), add the SAME code as 2E but with `targetLayer: 'Gold'`:

```javascript
// Column lineage for Gold
if (Array.isArray(jsonobject?.columnLineage) && jsonobject.columnLineage.length > 0) {
    setColumnLineage(prev => {
        const updated = [...prev];
        jsonobject.columnLineage.forEach(entry => {
            const newEntry = { ...entry, targetLayer: 'Gold' };
            const exists = updated.some(e =>
                e.targetTable === newEntry.targetTable &&
                e.targetColumn === newEntry.targetColumn &&
                e.sourceTable === newEntry.sourceTable &&
                e.sourceColumn === newEntry.sourceColumn &&
                e.targetLayer === newEntry.targetLayer
            );
            if (!exists) updated.push(newEntry);
        });
        return updated;
    });
}
```

---

## STEP 3: Modify OutputViewFabricEnhanced.js

### 3A. Add import (after line 19)

```javascript
import ColumnLineageView from './ColumnLineageView';
```

### 3B. Add columnLineage to getStoredData

**At line 43** (inside the console.log), add `ColumnLineage` count:

```javascript
ColumnLineage: parsed?.columnLineage?.length || 0
```

**At line 53-59** (the fallback return), add `columnLineage`:

```javascript
return {
    pipelines: [],
    bronzeDetails: [],
    silverDetails: [],
    goldDetails: [],
    stagingtables: [],
    columnLineage: []
};
```

### 3C. Add viewMode state (after line 115)

```javascript
const [viewMode, setViewMode] = useState('table'); // 'table' or 'column'
```

### 3D. Modify the controls JSX (lines 997-1025)

Replace the ENTIRE `<div className='lineage-controls'>` block with:

```jsx
<div className='lineage-controls'>
    <Button className='lineage-btn' style={{ backgroundColor: '#17a2b8', borderColor: '#17a2b8' }} onClick={() => setOutputJSON(getStoredData())}>
        Refresh Data
    </Button>

    {/* View Mode Selector - NEW */}
    <Form.Select
        className='lineage-select'
        value={viewMode}
        onChange={(e) => setViewMode(e.target.value)}
        style={{ minWidth: '200px', maxWidth: '220px' }}
    >
        <option value="table">Table Lineage</option>
        <option value="column">Column Mapping</option>
    </Form.Select>

    {/* These buttons only show in Table Lineage mode */}
    {viewMode === 'table' && (
        <Button className='lineage-btn' type="submit" onClick={handleSubmit}>
            View Lineage
        </Button>
    )}

    <Form.Select className='lineage-select' aria-label="Select Table" value={selectedTable} onChange={handleSelectChange}>
        <option value="">---Select Table---</option>
        {allTables.map((table, index) => (
            <option key={index} value={`${table.tablename}|${table.layer}`}>
                {table.tablename} ({table.layer})
            </option>
        ))}
    </Form.Select>

    {viewMode === 'table' && (
        <Button className='lineage-btn lineage-btn-filter' type="submit" onClick={handleFilter}>
            Filter Lineage
        </Button>
    )}

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
```

### 3E. Modify the main content area (lines 1026-1130)

Replace everything from `{checked ?` (line 1026) to the closing of the ternary before `</div>` (line 1130) with:

```jsx
{viewMode === 'table' ? (
    /* ===== EXISTING TABLE LINEAGE VIEW - COMPLETELY UNCHANGED ===== */
    checked ?
        <div className='lineage-flow-container' ref={flowRef} style={{ position: 'relative' }}>
            {/* ... KEEP EVERYTHING INSIDE HERE EXACTLY AS-IS ... */}
            {/* This includes the download button, legend, and ReactFlow component */}
            {/* Lines 1028-1119 stay UNCHANGED */}
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
) : (
    /* ===== NEW COLUMN MAPPING VIEW ===== */
    <ColumnLineageView
        columnLineage={outputJSON?.columnLineage || []}
        silverDetails={outputJSON?.silverDetails || []}
        goldDetails={outputJSON?.goldDetails || []}
        bronzeDetails={outputJSON?.bronzeDetails || []}
        stagingtables={outputJSON?.stagingtables || []}
        selectedTable={selectedTable}
    />
)}
```

**IMPORTANT:** The existing ReactFlow code (lines 1028-1119) must remain EXACTLY as-is inside the `checked ?` ternary. Just wrap the whole existing block in the `viewMode === 'table'` condition.

---

## STEP 4: Create ColumnLineageView.js (NEW FILE)

**Path:** `src/Components/ColumnLineageView.js`

This component renders the two-panel column mapping visualization with SVG connecting lines.

### Props

```javascript
function ColumnLineageView({
    columnLineage,    // Array of { targetTable, targetLayer, targetColumn, sourceTable, sourceColumn, transform, expression }
    silverDetails,    // Array of { tablename, ColumnUsed, Tablesused, ... }
    goldDetails,      // Array of { tablename, ColumnUsed, Tablesused, ... }
    bronzeDetails,    // Array of { tablename, ColumnUsed, ... }
    stagingtables,    // Array of { tablename, consumerTable, consumerLayer, ColumnsUsed }
    selectedTable,    // String "tablename|layer" from parent dropdown
})
```

### Data Flow Logic

```
1. Parse selectedTable → extract tableName and layer (split by "|")
2. If layer is "Silver":
   - Target columns = silverDetails.find(t => t.tablename === tableName).ColumnUsed
   - Source tables = stagingtables.filter(t => t.consumerTable === tableName && t.consumerLayer === 'Silver')
   - Column mappings = columnLineage.filter(t => t.targetTable === tableName && t.targetLayer === 'Silver')
3. If layer is "Gold":
   - Target columns = goldDetails.find(t => t.tablename === tableName).ColumnUsed
   - Source tables = stagingtables.filter(t => t.consumerTable === tableName && t.consumerLayer === 'Gold')
   - Column mappings = columnLineage.filter(t => t.targetTable === tableName && t.targetLayer === 'Gold')
```

### Table name matching helper

Use case-insensitive matching and strip layer prefixes:
```javascript
const normalizeForLookup = (name) => {
    if (!name) return '';
    const lastSlash = name.split('/').pop();
    const lastDot = lastSlash.split('.').pop();
    return lastDot.toLowerCase();
};
```

When matching, compare `normalizeForLookup(a) === normalizeForLookup(b)`.

### Layout Structure (matching the reference design)

```
┌─────────────────────────────────────────────────────────────────────────┐
│ Column Lineage                                            Edges: {N}   │
│ {sourceLayer} → {targetLayer} mappings for: {tableName}                │
├────────────────────────────┬────────────────────────────────────────────┤
│  LEFT PANEL (Sources)      │  RIGHT PANEL (Target)                     │
│                            │                                            │
│  ┌────────────────────┐    │    ┌──────────────────────────────┐        │
│  │ [Badge] tables &   │    │    │ [Badge]  {tableName}         │        │
│  │         columns    │    │    │ Columns                      │        │
│  ├────────────────────┤    │    ├──────────────────────────────┤        │
│  │                    │    │    │                              │        │
│  │ {SourceTable1}     │    │    │ ┌ target_col_1            ┐ │        │
│  │  ┌ src_col_a     ┐ │ ════════► │                              │        │
│  │  ┌ src_col_b     ┐ │ ════════► ┌ target_col_2            ┐ │        │
│  │                    │    │    │ ┌ target_col_3            ┐ │        │
│  │ Derived            │    │    │                              │        │
│  │  ┌ None          ┐ │ ════════► ┌ target_col_4            ┐ │        │
│  │                    │    │    │                              │        │
│  │ {SourceTable2}     │    │    │                              │        │
│  │  ┌ src_col_x     ┐ │ ════════► ┌ target_col_5            ┐ │        │
│  └────────────────────┘    │    └──────────────────────────────┘        │
│                            │                                            │
│        SVG OVERLAY         │                                            │
│     (curved Bezier lines)  │                                            │
└────────────────────────────┴────────────────────────────────────────────┘
```

### SVG Connector Lines Implementation

1. Use `useRef` on the container div
2. Assign unique `id` attributes to each source column chip: `id={`source-${sourceTable}-${sourceColumn}`}`
3. Assign unique `id` attributes to each target column chip: `id={`target-${targetColumn}`}`
4. After render, use `useEffect` + `useLayoutEffect` + `getBoundingClientRect()` to calculate line positions
5. Draw SVG `<path>` elements with cubic Bezier curves:

```javascript
useEffect(() => {
    if (!containerRef.current || filteredLineage.length === 0) {
        setLines([]);
        return;
    }
    const containerRect = containerRef.current.getBoundingClientRect();
    const newLines = [];

    filteredLineage.forEach((entry) => {
        const srcId = `src-${normalizeForLookup(entry.sourceTable)}-${(entry.sourceColumn || 'none').toLowerCase()}`;
        const tgtId = `tgt-${(entry.targetColumn || '').toLowerCase()}`;
        const srcEl = document.getElementById(srcId);
        const tgtEl = document.getElementById(tgtId);

        if (srcEl && tgtEl) {
            const sr = srcEl.getBoundingClientRect();
            const tr = tgtEl.getBoundingClientRect();
            newLines.push({
                x1: sr.right - containerRect.left,
                y1: sr.top + sr.height / 2 - containerRect.top,
                x2: tr.left - containerRect.left,
                y2: tr.top + tr.height / 2 - containerRect.top,
                sourceTable: entry.sourceTable,
                sourceColumn: entry.sourceColumn,
                targetColumn: entry.targetColumn,
                transform: entry.transform,
                expression: entry.expression,
            });
        }
    });
    setLines(newLines);
}, [selectedTable, filteredLineage]);
```

Each line rendered as:
```jsx
<path
    d={`M ${l.x1} ${l.y1} C ${(l.x1+l.x2)/2} ${l.y1}, ${(l.x1+l.x2)/2} ${l.y2}, ${l.x2} ${l.y2}`}
    stroke="#9e9e9e"
    strokeWidth="1.5"
    fill="none"
/>
```

### Color Scheme

| Element | Color |
|---------|-------|
| Source layer badge (e.g., "Bronze") | Green `#2e7d32` bg, white text |
| Target layer badge (e.g., "Silver") | Green `#2e7d32` bg, white text |
| Source table group header | Bold dark text, `#f5f5f5` bg |
| Source column chips | White bg, `#e0e0e0` border, dark text |
| Target column chips | `#e8f5e9` bg, `#4caf50` border, dark text |
| "Derived" source group | Italic text, light purple `#f3e5f5` bg |
| SVG lines (default) | `#9e9e9e`, 1.5px |
| SVG lines (hover) | `#1976d2`, 2.5px |
| Header bar | White bg, bottom border |

### Edge Cases

1. **No columnLineage data:** Show message "Column lineage data not available. Re-process files to generate column mappings."
2. **No table selected:** Show message "Select a Silver or Gold table from the dropdown above to view column mappings."
3. **Bronze table selected:** Show message "Column mapping is available for Silver and Gold tables only. Please select a Silver or Gold table."
4. **Derived columns** (sourceTable = "Derived", sourceColumn = null): Show in a special "Derived" group with label "None" for source column.
5. **Multiple sources for same target column:** Multiple lines drawn to the same target chip.

### Tooltip on Hover

When hovering over a connecting line, show a tooltip div:
```
{sourceTable}.{sourceColumn} → {targetColumn}
Transform: {transform}
Expression: {expression}
```

---

## STEP 5: Create ColumnLineageView.css (NEW FILE)

**Path:** `src/Components/ColumnLineageView.css`

Must use the same CSS variables from `OutputView.css`:
```css
--bg-light: #f5f5f5;
--bg-white: #ffffff;
--accent-teal: #00bcd4;
--text-dark: #333333;
--text-secondary: #666666;
--border-color: #e0e0e0;
```

Key classes needed:
- `.col-lineage-container` — full height, position relative, white bg, flex column
- `.col-lineage-header` — top bar with title + edge count, padding, border-bottom
- `.col-lineage-body` — position relative (for SVG overlay), flex row, flex 1
- `.col-lineage-panel` — each side panel, 45% width, overflow-y auto, padding
- `.col-lineage-svg` — position absolute, top 0, left 0, width 100%, height 100%, pointer-events none, z-index 1
- `.col-lineage-badge` — inline badge pill (border-radius 12px, padding 2px 10px)
- `.col-lineage-source-group` — grouped source table with header + column list
- `.col-lineage-column-chip` — individual column item, padding 6px 12px, border-radius 4px, font-size 13px, font-family monospace
- `.col-lineage-empty` — centered message for empty state

**Scrolling:** Both panels should scroll independently. The SVG overlay must recalculate positions on scroll (add scroll event listener).

---

## SAMPLE columnLineage DATA (for testing)

```json
[
  {
    "targetTable": "invoice_line_fact",
    "targetLayer": "Silver",
    "targetColumn": "delivery_number",
    "sourceTable": "Bronze/VBRK",
    "sourceColumn": "VBELN",
    "transform": "direct_alias",
    "expression": "VBELN as delivery_number"
  },
  {
    "targetTable": "invoice_line_fact",
    "targetLayer": "Silver",
    "targetColumn": "customer_number",
    "sourceTable": "Bronze/KNKK",
    "sourceColumn": "KUNNR",
    "transform": "direct_alias",
    "expression": "KN.KUNNR AS customer_number"
  },
  {
    "targetTable": "invoice_line_fact",
    "targetLayer": "Silver",
    "targetColumn": "credit_limit_amount",
    "sourceTable": "Bronze/KNKK",
    "sourceColumn": "KLIMK",
    "transform": "cast",
    "expression": "CAST(KN.KLIMK AS DECIMAL(15,2))"
  },
  {
    "targetTable": "invoice_line_fact",
    "targetLayer": "Silver",
    "targetColumn": "created_or_updated_on_dtm",
    "sourceTable": "Derived",
    "sourceColumn": null,
    "transform": "derived",
    "expression": "FROM_UTC_TIMESTAMP(current_timestamp(), 'America/Chicago')"
  }
]
```

---

## VERIFICATION CHECKLIST

1. `npm start` compiles without errors
2. Navigate to `/v2/fabricenhancedlineage`
3. The new "Table Lineage" / "Column Mapping" dropdown appears in the controls bar
4. When "Table Lineage" is selected → existing ReactFlow works identically (View Lineage + Filter buttons visible)
5. When "Column Mapping" is selected → View Lineage + Filter buttons are hidden
6. Selecting a Silver table shows Bronze sources on left, Silver columns on right, with SVG lines
7. Selecting a Gold table shows Silver sources on left, Gold columns on right, with SVG lines
8. Hover on a line shows tooltip with transform info
9. "Reset" works for both modes
10. Switching modes preserves selected table
11. Page works when no columnLineage data exists (shows fallback message)

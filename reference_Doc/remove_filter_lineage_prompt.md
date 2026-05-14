# Prompt: Remove "Filter Lineage" Button — Auto-Filter on Table Selection

> [!IMPORTANT]
> Copy the entire prompt below (everything inside the fenced block) and paste it into the LLM.

---

````text
## Context

I have a React project called "Code Analyzer" located at:
`c:\Users\PatelVinodbhaiMAQSof\Desktop\Code Analyzer - Antigravity`

The relevant file is:
- **`src/Components/OutputViewFabricEnhanced.js`** (1172 lines)

### Current Flow

The toolbar has a **table selector dropdown** (lines 1024-1031) and a **"Filter Lineage"** button (lines 1033-1037):

```jsx
{/* Dropdown — selects a table */}
<Form.Select className='lineage-select' aria-label="Select Table" value={selectedTable} onChange={handleSelectChange}>
    <option value="">---Select Table---</option>
    {allTables.map((table, index) => (
        <option key={index} value={`${table.tablename}|${table.layer}`}>
            {table.tablename} ({table.layer})
        </option>
    ))}
</Form.Select>

{/* Filter button — only shown when viewMode === 'table' */}
{viewMode === 'table' && (
    <Button className='lineage-btn lineage-btn-filter' type="submit" onClick={handleFilter}>
        Filter Lineage
    </Button>
)}
```

**`handleSelectChange`** (lines 553-555) only sets the state:
```js
const handleSelectChange = (event) => {
    setSelectedTable(event.target.value);
};
```

**`handleFilter`** (lines 557-572) does the actual filtering:
```js
const handleFilter = async () => {
    if (!selectedTable || selectedTable === '') {
        setIsFiltered(false);
        handleSubmit();   // Show all tables
        return;
    }
    setIsFiltered(true);
    setNodes([]);
    setEdges([]);
    
    const [tableName, tableLayer] = selectedTable.split('|');
    setTimeout(() => {
        renderFilteredLineage(tableName, tableLayer);
    }, 50);
}
```

### The Problem

The "Filter Lineage" button is redundant. The user selects a table from the dropdown, then has to click a separate button to apply the filter. This is an unnecessary extra click — **selecting a table should immediately filter the lineage.**

### What I Want

1. **Remove the "Filter Lineage" button** from the toolbar.
2. **Auto-trigger filtering** when the user selects a table from the dropdown (when `viewMode === 'table'`).
3. **Auto-show all tables** when the user clears the dropdown selection (selects "---Select Table---") while in table view mode.
4. **No change for Column Mapping view** — the dropdown already works correctly there (it passes `selectedTable` to `ColumnLineageView` as a prop, no extra button needed).

---

## CRITICAL RULES

1. **Do NOT delete any existing code.** Comment out removed UI elements with the tag `// REMOVED_FILTER_LINEAGE`.
2. **Preserve ALL existing comments and docstrings.**
3. **Do NOT rename any files, functions, variables, or CSS class names.**
4. **Do NOT remove `handleFilter()` function itself** — just comment out the button that calls it. The auto-filter logic will call it internally.
5. **Do NOT change any import paths or unrelated logic.**
6. **Do NOT install or uninstall any npm packages.**
7. **Keep the table selector dropdown, viewMode dropdown, Refresh Data button, and Reset button exactly as they are.**

---

## REQUIRED CHANGES

### CHANGE 1 — Remove the "Filter Lineage" button from the toolbar

**File:** `src/Components/OutputViewFabricEnhanced.js`

**Lines 1033-1037** currently render the button:
```jsx
{viewMode === 'table' && (
    <Button className='lineage-btn lineage-btn-filter' type="submit" onClick={handleFilter}>
        Filter Lineage
    </Button>
)}
```

**Comment out the entire block:**
```jsx
{/* REMOVED_FILTER_LINEAGE — Button removed; filtering now auto-triggers on dropdown change
{viewMode === 'table' && (
    <Button className='lineage-btn lineage-btn-filter' type="submit" onClick={handleFilter}>
        Filter Lineage
    </Button>
)}
*/}
```

---

### CHANGE 2 — Auto-trigger filtering when table selection changes

**Modify `handleSelectChange`** (lines 553-555) to call the filter logic automatically when in table view mode:

**Replace:**
```js
const handleSelectChange = (event) => {
    setSelectedTable(event.target.value);
};
```

**With:**
```js
const handleSelectChange = (event) => {
    const newValue = event.target.value;
    setSelectedTable(newValue);

    // REMOVED_FILTER_LINEAGE — auto-filter when in table lineage view
    if (viewMode === 'table') {
        // Use the new value directly (state update is async, so we can't rely on selectedTable yet)
        if (!newValue || newValue === '') {
            // Cleared selection → show all tables
            setIsFiltered(false);
            handleSubmit();
        } else {
            // Table selected → filter to that table's lineage
            setIsFiltered(true);
            setNodes([]);
            setEdges([]);
            const [tableName, tableLayer] = newValue.split('|');
            setTimeout(() => {
                renderFilteredLineage(tableName, tableLayer);
            }, 50);
        }
    }
    // Column Mapping view: no action needed — ColumnLineageView reads selectedTable as a prop
};
```

> **Why inline the logic instead of calling `handleFilter()`?**
> Because `handleFilter` reads from the `selectedTable` state, but React's `setState` is asynchronous — `selectedTable` will still hold the OLD value when `handleFilter` runs in the same event handler tick. By using `newValue` directly (the fresh value from the event), we avoid a stale-state bug.

---

## SUMMARY OF CHANGES

| Line(s) | What Changes | Tag |
|---------|-------------|-----|
| 553-555 | `handleSelectChange` now auto-triggers filter logic for table view mode using the fresh dropdown value | `REMOVED_FILTER_LINEAGE` |
| 1033-1037 | Comment out the "Filter Lineage" button | `REMOVED_FILTER_LINEAGE` |

**No other changes.** `handleFilter()` function stays intact (commented-out button just doesn't call it anymore). `handleSubmit()`, `renderFilteredLineage()`, `viewMode` dropdown, Reset, Refresh — all untouched.

---

## BEFORE vs AFTER

```
BEFORE:
  User selects "DimTotalPartner (Gold)" from dropdown
  → Nothing happens yet
  → User must click "Filter Lineage" button ← extra unnecessary click ❌
  → Diagram filters to show DimTotalPartner's dependency chain

AFTER:
  User selects "DimTotalPartner (Gold)" from dropdown
  → Diagram IMMEDIATELY filters to show DimTotalPartner's dependency chain ✅
  → No extra button click needed

  User clears dropdown to "---Select Table---"
  → Diagram IMMEDIATELY shows all tables (full lineage) ✅
```

**Updated toolbar layout (after both this and the View Lineage removal):**
```
[ Refresh Data ] [ Table Lineage ▼ / Column Mapping ▼ ] [ ---Select Table--- ▼ ] [ Reset ]
```

---

## VERIFICATION CHECKLIST

After making all changes, confirm:
- [ ] The "Filter Lineage" button is no longer visible in the toolbar
- [ ] Selecting a table from the dropdown in **Table Lineage** mode immediately filters the diagram to that table's dependency chain
- [ ] Clearing the dropdown selection ("---Select Table---") in **Table Lineage** mode immediately shows all tables (full lineage)
- [ ] Selecting a table from the dropdown in **Column Mapping** mode still works correctly (passes `selectedTable` as prop to `ColumnLineageView` — no auto-filter behavior)
- [ ] The React Flow diagram renders correctly after auto-filter (nodes, edges, layout)
- [ ] The "Reset" button still clears everything
- [ ] The "Refresh Data" button still reloads from localStorage
- [ ] The `viewMode` dropdown still switches between Table Lineage and Column Mapping correctly
- [ ] No console errors or warnings
- [ ] The commented-out button code is tagged with `REMOVED_FILTER_LINEAGE` for easy recovery
````

---

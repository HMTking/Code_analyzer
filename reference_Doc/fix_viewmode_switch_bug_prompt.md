# Prompt: Fix Stale Diagram When Switching from Column Mapping Back to Table Lineage

> [!IMPORTANT]
> Copy the entire prompt below (everything inside the fenced block) and paste it into the LLM.

---

````text
## Context

I have a React project called "Code Analyzer" located at:
`c:\Users\PatelVinodbhaiMAQSof\Desktop\Code Analyzer - Antigravity`

The relevant file is:
- **`src/Components/OutputViewFabricEnhanced.js`**

### The Bug

**Steps to reproduce:**
1. Open the page in **Table Lineage** mode — diagram shows (e.g., for `mat_cust_delv_brch_diverse_sales` in Gold layer).
2. Switch the `viewMode` dropdown to **Column Mapping**.
3. Select a **different table** from the table selector dropdown (e.g., `canada_material_branch_inv_fact (Silver)`).
4. Switch `viewMode` dropdown back to **Table Lineage**.
5. **BUG:** The diagram still shows the OLD table's lineage (`mat_cust_delv_brch_diverse_sales`), even though the dropdown now shows `canada_material_branch_inv_fact (Silver)`.

### Root Cause

The `selectedTable` state is updated when the user picks a new table in Column Mapping mode, BUT the React Flow diagram (nodes/edges) is NOT re-rendered because:

1. The `handleSelectChange` function (line ~553) only sets `selectedTable`. In the "remove filter lineage" enhancement, it also calls the filter logic — BUT only when `viewMode === 'table'`. When the user changes the table while in `viewMode === 'column'`, the auto-filter logic is skipped (correct for Column Mapping, but stale for when the user switches back).

2. When `viewMode` changes from `'column'` back to `'table'`, there is **no `useEffect`** watching for this transition. The component just renders the existing stale `nodes` and `edges` from the previous table's diagram.

3. The `selectedTable` state IS correct (the dropdown shows the right value), but the diagram data (nodes/edges) was never regenerated to match.

### The Fix

Add a `useEffect` that watches `viewMode`. When `viewMode` transitions to `'table'`, re-render the diagram based on the current `selectedTable`.

---

## CRITICAL RULES

1. **Do NOT delete any existing code.** Add the new `useEffect` alongside existing ones.
2. **Preserve ALL existing comments and docstrings.**
3. **Do NOT rename any files, functions, variables, or CSS class names.**
4. **Do NOT change any import paths or unrelated logic.**
5. **Do NOT install or uninstall any npm packages.**
6. **Do NOT modify `handleSubmit`, `renderFilteredLineage`, `handleSelectChange`, or any existing `useEffect`.** Only add a NEW `useEffect`.

---

## REQUIRED CHANGES

### CHANGE 1 — Add a `useEffect` to re-render diagram when switching back to Table Lineage mode

**File:** `src/Components/OutputViewFabricEnhanced.js`

**Add this `useEffect` after the existing `viewMode` state declaration (line 120) or alongside the other `useEffect` blocks (around line 541).**

Place it right after the auto-render `useEffect` (the one at line ~530-541 that watches `allTablesCount`):

```js
// FIX_VIEWMODE_SWITCH — Re-render table lineage when switching back from Column Mapping
// This ensures the diagram reflects the currently selected table (which may have
// been changed while in Column Mapping mode).
useEffect(() => {
    if (viewMode === 'table') {
        if (selectedTable && selectedTable !== '') {
            // A specific table is selected → render filtered lineage for that table
            setIsFiltered(true);
            setNodes([]);
            setEdges([]);
            const [tableName, tableLayer] = selectedTable.split('|');
            setTimeout(() => {
                renderFilteredLineage(tableName, tableLayer);
            }, 50);
        } else {
            // No table selected → render full lineage (all tables)
            setIsFiltered(false);
            handleSubmit();
        }
    }
}, [viewMode]); // Only trigger when viewMode changes
```

> **Why only watch `viewMode`?**
> - We do NOT add `selectedTable` to the dependency array. If we did, every dropdown change would double-trigger the diagram re-render (once from `handleSelectChange`'s auto-filter logic, and again from this `useEffect`).
> - This `useEffect` should ONLY fire when the user switches the view mode dropdown. `handleSelectChange` already handles table selection changes within the same view mode.

> **Why not use a ref to track the previous viewMode?**
> - A simpler approach works here: every time `viewMode` becomes `'table'`, we re-render the diagram based on the *current* `selectedTable` value. Even if the table hasn't changed (user switched to Column Mapping and back without changing the table), the re-render is fast and harmless — it just rebuilds the same diagram.

---

### CHANGE 2 — (No other file changes needed)

This is a single-`useEffect` fix. No CSS changes, no other component changes.

---

## SUMMARY OF CHANGES

| Line(s) | What Changes | Tag |
|---------|-------------|-----|
| After line ~541 | Add new `useEffect` watching `viewMode` — re-renders table lineage diagram when switching back from Column Mapping | `FIX_VIEWMODE_SWITCH` |

---

## BEFORE vs AFTER

```
BEFORE (bug):
  1. Table Lineage shows "mat_cust_delv_brch_diverse_sales" (Gold)
  2. Switch to Column Mapping
  3. Select "canada_material_branch_inv_fact (Silver)" in dropdown
  4. Switch back to Table Lineage
  5. ❌ Diagram STILL shows Gold table's dependencies
     Dropdown shows "canada_material_branch_inv_fact (Silver)" — MISMATCH

AFTER (fixed):
  1. Table Lineage shows "mat_cust_delv_brch_diverse_sales" (Gold)
  2. Switch to Column Mapping
  3. Select "canada_material_branch_inv_fact (Silver)" in dropdown
  4. Switch back to Table Lineage
  5. ✅ useEffect fires → detects viewMode === 'table' + selectedTable = "canada_material_branch_inv_fact|Silver"
     → Calls renderFilteredLineage("canada_material_branch_inv_fact", "Silver")
     → Diagram re-renders for the correct table
```

---

## VERIFICATION CHECKLIST

After making all changes, confirm:
- [ ] Switch to Column Mapping → select a different table → switch back to Table Lineage → diagram updates to the newly selected table
- [ ] Switch to Column Mapping → do NOT change table → switch back to Table Lineage → diagram still shows the same table (no break)
- [ ] Switch to Column Mapping → clear table selection ("---Select Table---") → switch back to Table Lineage → full lineage (all tables) is shown
- [ ] Staying in Table Lineage mode and changing the dropdown still auto-filters correctly (no double-render)
- [ ] Column Mapping view still works correctly when switching to it
- [ ] Reset button still clears everything
- [ ] No console errors or warnings
- [ ] No infinite render loops (the `useEffect` dependency array is `[viewMode]` only)
````

---

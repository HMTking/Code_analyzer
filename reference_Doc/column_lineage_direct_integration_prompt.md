# Prompt: Remove "View Lineage" Button — Auto-Render Table Lineage Directly

> [!IMPORTANT]
> Copy the entire prompt below (everything inside the fenced block) and paste it into the LLM.

---

````text
## Context

I have a React project called "Code Analyzer" located at:
`c:\Users\PatelVinodbhaiMAQSof\Desktop\Code Analyzer - Antigravity`

The relevant file is:
- **`src/Components/OutputViewFabricEnhanced.js`** (1172 lines)

### Current Flow (broken UX)

The component has a toolbar with these controls (lines 1002–1049):

```
[ Refresh Data ] [ Table Lineage ▼ / Column Mapping ▼ ] [ View Lineage ] [ ---Select Table--- ▼ ] [ Filter Lineage ] [ Reset ]
```

When `viewMode === 'table'` (line 1018-1022):
- The **"View Lineage"** button is shown. It calls `handleSubmit()` (line 1019-1021).
- `handleSubmit()` (lines 806-959) builds nodes/edges for the React Flow diagram and sets `checked = true`.
- When `checked === false`, the render shows an empty state saying _"Click View Lineage..."_ (lines 1147-1154).
- When `checked === true`, the React Flow diagram renders (lines 1052-1145).

**There IS an auto-render `useEffect`** (lines 530-541) that calls `handleSubmit()` when data exists and `checked` is false:
```js
useEffect(() => {
    if (allTablesCount > 0 && !checked && nodes.length === 0) {
        localStorage.removeItem('fabricEnhancedLineageState');
        handleSubmit();
    }
}, [allTablesCount]);
```

**BUT** the "View Lineage" button is still in the UI, which is confusing because:
1. The lineage auto-renders anyway when data is available.
2. The button is redundant — clicking it just re-does what already happened.
3. It creates a misleading impression that the user must click something first.

### What I Want

**Remove the "View Lineage" button entirely.** The Table Lineage should always render automatically when data is available (which it already does via the `useEffect`). The button is irrelevant.

Also clean up the empty state message that references "View Lineage" since it won't exist anymore.

---

## CRITICAL RULES

1. **Do NOT delete any existing code.** Comment out the removed button with a tag `// REMOVED_VIEW_LINEAGE` so it can be found and restored if needed.
2. **Preserve ALL existing comments and docstrings.**
3. **Do NOT rename any files, functions, variables, or CSS class names.**
4. **Do NOT change any import paths or unrelated logic.**
5. **Do NOT install or uninstall any npm packages.**
6. **Do NOT touch `handleSubmit()`, `handleFilter()`, `renderFilteredLineage()`, the auto-render `useEffect`, or any other logic.** Only change the JSX render section and the empty-state message.
7. **Keep the `viewMode` dropdown, table selector dropdown, Filter Lineage button, and Reset button exactly as they are.**

---

## REQUIRED CHANGES

### CHANGE 1 — Remove the "View Lineage" button from the toolbar

**File:** `src/Components/OutputViewFabricEnhanced.js`

**Lines 1018-1022** currently render the button conditionally:
```jsx
{viewMode === 'table' && (
    <Button className='lineage-btn' type="submit" onClick={handleSubmit}>
        View Lineage
    </Button>
)}
```

**Comment out the entire block** and tag it:
```jsx
{/* REMOVED_VIEW_LINEAGE — Button removed; lineage auto-renders via useEffect (line 530-541)
{viewMode === 'table' && (
    <Button className='lineage-btn' type="submit" onClick={handleSubmit}>
        View Lineage
    </Button>
)}
*/}
```

---

### CHANGE 2 — Update the empty state message

**Lines 1147-1154** currently show:
```jsx
<div className='lineage-empty'>
    <div className='lineage-empty-icon'>📊</div>
    <div className='lineage-empty-text'>
        {allTablesCount > 0 
            ? 'Click "View Lineage" to visualize Bronze → Silver → Gold data flow'
            : 'No data available. Run analysis on the Fabric Enhanced page first, then click "Refresh Data"'}
    </div>
</div>
```

Since the "View Lineage" button no longer exists, and the auto-render `useEffect` should handle rendering automatically, update the message to reflect the actual flow. **Replace the text content:**

```jsx
<div className='lineage-empty'>
    <div className='lineage-empty-icon'>📊</div>
    <div className='lineage-empty-text'>
        {allTablesCount > 0 
            ? 'Loading lineage diagram...'  // REMOVED_VIEW_LINEAGE — was: 'Click "View Lineage"...'
            : 'No data available. Run analysis on the Fabric Enhanced page first, then click "Refresh Data"'}
    </div>
</div>
```

> **Why "Loading lineage diagram..."?** — With the auto-render `useEffect`, when `allTablesCount > 0` and `checked === false`, `handleSubmit()` will be called automatically. The empty state is only visible for a brief moment (~100ms) while the `useEffect` fires. So the message should indicate that loading is in progress, not ask the user to click a non-existent button.

---

### CHANGE 3 (Optional but Recommended) — Add a loading spinner during auto-render

To make the brief "loading" moment feel polished instead of showing an empty state, consider replacing the empty state with a spinner when data exists but `checked` is false:

```jsx
{viewMode === 'table' ? (
    checked ?
    <div className='lineage-flow-container' ref={flowRef} style={{ position: 'relative' }}>
        {/* ... existing React Flow diagram ... */}
    </div>
    :
    <div className='lineage-empty'>
        {allTablesCount > 0 ? (
            <>
                {/* REMOVED_VIEW_LINEAGE — auto-rendering in progress */}
                <div className='lineage-empty-icon' style={{ fontSize: '32px' }}>⏳</div>
                <div className='lineage-empty-text'>Rendering lineage diagram...</div>
            </>
        ) : (
            <>
                <div className='lineage-empty-icon'>📊</div>
                <div className='lineage-empty-text'>
                    No data available. Run analysis on the Fabric Enhanced page first, then click "Refresh Data"
                </div>
            </>
        )}
    </div>
) : (
    /* ===== NEW COLUMN MAPPING VIEW ===== */
    <ColumnLineageView ... />
)}
```

---

## SUMMARY OF CHANGES

| Line(s) | What Changes | Tag |
|---------|-------------|-----|
| 1018-1022 | Comment out the "View Lineage" button | `REMOVED_VIEW_LINEAGE` |
| 1150-1152 | Update empty state text — remove "Click View Lineage" reference | `REMOVED_VIEW_LINEAGE` |

**No logic changes.** The `handleSubmit` function, the auto-render `useEffect`, the `checked` state, the `viewMode` dropdown, the `Filter Lineage` button, and the `Reset` button all remain exactly as they are.

---

## BEFORE vs AFTER

```
BEFORE:
  User opens page → auto-render fires → diagram appears
  BUT toolbar still shows "View Lineage" button → confusing ❌
  If auto-render somehow doesn't fire → empty state says "Click View Lineage" → fine
  But usually it fires instantly → the button is just visual noise

AFTER:
  User opens page → auto-render fires → diagram appears
  No "View Lineage" button in toolbar → clean, no confusion ✅
  Empty state briefly shows "Rendering lineage diagram..." → professional
  All other controls (Refresh, View Mode, Table dropdown, Filter, Reset) unchanged
```

**Updated toolbar layout:**
```
[ Refresh Data ] [ Table Lineage ▼ / Column Mapping ▼ ] [ ---Select Table--- ▼ ] [ Filter Lineage ] [ Reset ]
```

---

## VERIFICATION CHECKLIST

After making all changes, confirm:
- [ ] The "View Lineage" button is no longer visible in the toolbar
- [ ] The Table Lineage diagram still auto-renders when data is available (via the existing `useEffect`)
- [ ] The `viewMode` dropdown still switches between "Table Lineage" and "Column Mapping" correctly
- [ ] The "Filter Lineage" button still works — filtering by selected table
- [ ] The "Reset" button still clears the diagram
- [ ] The "Refresh Data" button still reloads data from localStorage
- [ ] The table selector dropdown still works for both Table Lineage and Column Mapping views
- [ ] When no data exists, the empty state says "No data available..." (not "Click View Lineage")
- [ ] When data exists but diagram hasn't rendered yet, the brief empty state shows "Rendering lineage diagram..." or similar (not "Click View Lineage")
- [ ] Column Mapping view still works unchanged
- [ ] No console errors or warnings
- [ ] The commented-out button code is tagged with `REMOVED_VIEW_LINEAGE` for easy recovery
````

---

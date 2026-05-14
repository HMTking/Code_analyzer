# Prompt: Column Lineage Dashboard — Visual Enhancement (Click-to-Select, Auto-Scroll, Highlight)

> [!IMPORTANT]
> Copy the entire prompt below (everything inside the fenced block) and paste it into the LLM.

---

````text
## Context

I have a React project called "Code Analyzer" located at:
`c:\Users\PatelVinodbhaiMAQSof\Desktop\Code Analyzer - Antigravity`

The Column Lineage feature lives in two files:
- **Component:** `src/Components/ColumnLineageView.js` (310 lines)
- **Styles:** `src/Components/ColumnLineageView.css` (216 lines)

### Current Architecture

The component renders a **two-panel layout** with an **SVG overlay** for connecting lines:

```
┌──────────────────────────────────────────────────────────────────┐
│  Column Lineage Header (title + edge count)                      │
├──────────────────┬───────────── SVG ─────────────┬───────────────┤
│  LEFT PANEL      │   (bezier curves connecting   │  RIGHT PANEL  │
│  (Source Tables  │    source → target columns)   │  (Target      │
│   & Columns)     │                               │   Columns)    │
│                  │                               │               │
│  - BronzeWARM    │     ─── curved line ───►      │  - col_a      │
│    • NA_NM       │     ─── curved line ───►      │  - col_b      │
│    • EU_PTR      │                               │  - col_c      │
│                  │                               │               │
│  - BronzeWARM    │     ─── curved line ───►      │  - col_d      │
│    • RA_TSK      │                               │  - col_e      │
│    • RK1244      │                               │               │
│    • sym_z       │                               │               │
│                  │                               │               │
│  - BronzeWARD    │                               │               │
│    • RA_TSK      │                               │               │
│    • AP_901      │                               │               │
└──────────────────┴───────────────────────────────┴───────────────┘
```

**Key implementation details:**
- `containerRef` → outer `.col-lineage-container` div
- `bodyRef` → inner `.col-lineage-body` div (holds SVG + both panels)
- Source columns have IDs: `src-{normalizedTable}-{normalizedCol}` (e.g., `src-bronzewarm-na_nm`)
- Target columns have IDs: `tgt-{normalizedCol}` (e.g., `tgt-col_a`)
- SVG lines are calculated in `calculateLines()` using `getBoundingClientRect()` on column chip elements
- Lines recalculate on panel scroll and window resize
- **Current hover behavior:** hovering a line shows a tooltip (fixed position, follows mouse) and highlights the line in blue (`#1976d2`). Leaving the line hides the tooltip immediately.
- Both panels currently have `overflow-y: auto` (both scroll independently)

**Data structures available:**
- `filteredLineage` — array of `{ sourceTable, sourceColumn, targetColumn, transform, expression }` objects
- `sourceGroupsArray` — array of `{ table, columns[] }` (source side, grouped by table)
- `targetColumns` — flat array of column name strings (target side)
- `lines` state — computed SVG line objects with `{ key, x1, y1, x2, y2, sourceTable, sourceColumn, targetColumn, transform, expression }`

---

## CRITICAL RULES

1. **Do NOT delete any existing code.** Modify in place.
2. **Preserve ALL existing comments and docstrings.**
3. **Do NOT rename any files, functions, variables, or CSS class names.**
4. **Do NOT change any import paths or unrelated logic.**
5. **Do NOT install or uninstall any npm packages.**
6. **Keep the existing hover-on-line behavior intact** — it should still work for lines that are NOT part of a selected column's relations.
7. **All new CSS classes must be prefixed with `col-lineage-`** to match existing convention.

---

## REQUIRED CHANGES

### BEHAVIOR 1 — Click-to-Select a Column (Either Panel)

**Current:** Columns are static (no click handler). Only SVG lines have hover interaction.

**Required:**
- When a user **clicks** any column chip (source OR target), that column becomes the **selected column**.
- Add a new state: `const [selectedColumn, setSelectedColumn] = useState(null);`
  - Value shape: `{ id: string, side: 'source' | 'target', table?: string, column: string }`
- **Toggle behavior:** Clicking the same column again **deselects** it (sets `selectedColumn` to `null`).
- Clicking a **different** column switches the selection to the new column (no need to deselect first).
- When a column is selected, the `hoveredLine` tooltip system should be **suppressed** (the persistent popup takes over — see Behavior 4).

Add `onClick` handlers to both source column chips (line ~250) and target column chips (line ~275).

---

### BEHAVIOR 2 — Auto-Scroll Opposite Panel to Align Related Columns

**When a column is clicked:**

1. **Find all related columns** on the opposite panel using `filteredLineage`:
   - If a **source column** is clicked → find all `targetColumn` values where `sourceTable` + `sourceColumn` match.
   - If a **target column** is clicked → find all `sourceTable` + `sourceColumn` pairs where `targetColumn` matches.

2. **Scroll the opposite panel** so the **first** related column is aligned vertically with the clicked column:
   - Use `element.scrollIntoView({ behavior: 'smooth', block: 'center' })` on the first matching element in the opposite panel.
   - Alternatively, calculate the offset and use `panel.scrollTo({ top: offset, behavior: 'smooth' })` for more precise alignment.

3. **Left panel** scrolling: The left panel has its own internal scrollbar (`overflow-y: auto`). When a right-side column is clicked, scroll the **left panel container** (`.col-lineage-panel-left`) to bring the related source columns into view.

4. **Right panel** scrolling: The right panel should **NOT** have its own scrollbar. It should scroll with the **page-level scrollbar** (the overall page scroll). When a left-side column is clicked, scroll the **window/page** so the related target columns come into view.

**CSS change for right panel:**
```css
.col-lineage-panel-right {
    margin-left: auto;
    overflow-y: visible; /* No internal scroll — uses page scroll */
}
```

**Important:** After the scroll animation completes, call `calculateLines()` (with a ~300ms delay) to recalculate SVG line positions, since scrolling changes element positions.

---

### BEHAVIOR 3 — Highlight Selected Column + Its Relation Lines

**When a column is selected:**

1. **Highlight the clicked column chip** with a distinct selected style:
   - Add class `col-lineage-column-chip-selected` to the clicked chip.
   - CSS:
     ```css
     .col-lineage-column-chip-selected {
         background: #1976d2 !important;
         color: #ffffff !important;
         border-color: #1565c0 !important;
         box-shadow: 0 2px 8px rgba(25, 118, 210, 0.4);
         font-weight: 600;
     }
     ```

2. **Highlight all related column chips** on the opposite side:
   - Add class `col-lineage-column-chip-related` to each related column on the opposite panel.
   - CSS:
     ```css
     .col-lineage-column-chip-related {
         background: #e3f2fd !important;
         border-color: #1976d2 !important;
         color: #1565c0 !important;
         font-weight: 600;
     }
     ```

3. **Highlight the connecting SVG lines:**
   - Lines connecting the selected column to its related columns should be highlighted:
     - `stroke: #1976d2` (blue)
     - `strokeWidth: 2.5`
   - **All other lines** (non-related) should be **dimmed**:
     - `stroke: #e0e0e0` (very light gray)
     - `strokeWidth: 1`
     - `opacity: 0.3`
   - This creates a clear visual focus on the selected column's relationships.

4. **When nothing is selected** (default state), all lines should render normally as they currently do (`stroke: #9e9e9e`, `strokeWidth: 1.5`).

**Implementation approach:**
- Compute a `Set` of related line keys from `filteredLineage` based on `selectedColumn`.
- In the SVG rendering loop, check if the current line's `key` is in the related set to determine stroke/width/opacity.
- For column chips, compute sets of related source IDs and target IDs, and conditionally apply CSS classes.

---

### BEHAVIOR 4 — Persistent Relation Info Popup (Replaces Hover Tooltip for Selected Columns)

**Current:** Tooltip appears on line hover and disappears on mouse leave.

**Required:**
- When a column is **selected** (clicked), show a **persistent popup** displaying the relationship information for ALL relations of that column.
- This popup should **remain visible** until:
  - The user **re-clicks** the same column (deselect), OR
  - The user **clicks a different column** (popup updates to new column's relations).

**Popup content:**
```
┌─────────────────────────────────────────────────┐
│  Mapping: {sourceTable}.{sourceColumn}          │
│         → {targetColumn}                        │
│  Transform: {transform}                         │
│  Expression: {expression}                       │
│─────────────────────────────────────────────────│
│  Mapping: {sourceTable}.{sourceColumn}          │  (if multiple relations)
│         → {targetColumn}                        │
│  Transform: {transform}                         │
│  Expression: {expression}                       │
└─────────────────────────────────────────────────┘
```

**Popup positioning:**
- Position the popup **near the selected column chip** (not at cursor position like the hover tooltip).
- If a **source column** is clicked: position the popup to the **right** of the left panel (horizontally centered in the SVG area).
- If a **target column** is clicked: position the popup to the **left** of the right panel (horizontally centered in the SVG area).
- Vertically align with the clicked column chip.
- Use `position: absolute` relative to `.col-lineage-body` (not `position: fixed` like the hover tooltip).

**Popup styling (new CSS class `col-lineage-popup`):**
```css
.col-lineage-popup {
    position: absolute;
    z-index: 10;
    background: #1e1e2e;
    color: #e0e0e0;
    padding: 14px 18px;
    border-radius: 10px;
    font-size: 12px;
    line-height: 1.6;
    max-width: 420px;
    max-height: 300px;
    overflow-y: auto;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.35);
    border: 1px solid rgba(255, 255, 255, 0.1);
    backdrop-filter: blur(8px);
}

.col-lineage-popup-entry {
    padding: 8px 0;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.col-lineage-popup-entry:last-child {
    border-bottom: none;
}

.col-lineage-popup-label {
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: #888;
    margin-bottom: 2px;
}

.col-lineage-popup-value {
    font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
    color: #90caf9;
    word-break: break-all;
}
```

**When `selectedColumn` is null:**
- Hide the popup.
- Re-enable normal hover tooltip on SVG lines (existing behavior).

**When `selectedColumn` is set:**
- Show the popup with all relations.
- **Suppress** the hover tooltip on SVG lines (set an early return in `handleLineHover` when `selectedColumn` is not null).

---

### BEHAVIOR 5 — Left Panel Internal Scroll (Preserve), Right Panel Page Scroll

**Left panel (`.col-lineage-panel-left`):**
- Keep `overflow-y: auto` (already has this). It should scroll internally within its own container.
- No changes needed here — it already works.

**Right panel (`.col-lineage-panel-right`):**
- Remove `overflow-y: auto`. The right panel should expand to its full content height and scroll with the overall page scrollbar.
- Change CSS:
  ```css
  .col-lineage-panel-right {
      margin-left: auto;
      overflow-y: visible;
  }
  ```
- The `.col-lineage-body` should also allow the right panel to overflow:
  ```css
  .col-lineage-body {
      position: relative;
      display: flex;
      flex-direction: row;
      flex: 1;
      overflow: visible; /* Changed from 'hidden' to allow right panel to expand */
  }
  ```
- **BUT** the `.col-lineage-container` should keep `overflow: hidden` on the horizontal axis only:
  ```css
  .col-lineage-container {
      display: flex;
      flex-direction: column;
      min-height: 500px;
      background-color: #ffffff;
      border-radius: 8px;
      overflow-x: hidden;
      overflow-y: visible;
      position: relative;
  }
  ```

- **Recalculate lines on page scroll:** Add a `window.addEventListener('scroll', onScroll)` in the existing scroll listener `useEffect` (line ~123-137). This already has `window.addEventListener('resize', onScroll)` — add scroll alongside it.

---

## SUMMARY OF CHANGES

| File | What Changes |
|------|-------------|
| `src/Components/ColumnLineageView.js` | Add `selectedColumn` state, click handlers on column chips, auto-scroll logic, related-set computation, persistent popup rendering, conditional line highlighting, suppress hover when selected |
| `src/Components/ColumnLineageView.css` | Add `.col-lineage-column-chip-selected`, `.col-lineage-column-chip-related`, `.col-lineage-popup` + sub-classes, modify `.col-lineage-panel-right` overflow, modify `.col-lineage-body` overflow, modify `.col-lineage-container` overflow, add dimmed line styles |

---

## STATE FLOW DIAGRAM

```
User clicks Source Column "NA_NM"
  │
  ├─► selectedColumn = { id: 'src-bronzewarm-na_nm', side: 'source', table: 'BronzeWARM', column: 'NA_NM' }
  │
  ├─► Find related targets from filteredLineage where sourceTable matches & sourceColumn matches
  │     → e.g., ['col_a', 'col_c']
  │
  ├─► Highlight: "NA_NM" chip gets .col-lineage-column-chip-selected
  │              "col_a" & "col_c" chips get .col-lineage-column-chip-related
  │              Lines connecting them get stroke=#1976d2, width=2.5
  │              All other lines get stroke=#e0e0e0, opacity=0.3
  │
  ├─► Auto-scroll: Right panel (page scroll) scrolls to bring "col_a" into view
  │
  ├─► Popup: Shows all mapping details for "NA_NM" → positioned near the chip
  │
  └─► User clicks "NA_NM" again → selectedColumn = null → everything resets to default
```

---

## VERIFICATION CHECKLIST

After making all changes, confirm:
- [ ] Clicking a source column highlights it in blue and dims unrelated lines
- [ ] Clicking a source column auto-scrolls the page to align the first related target column
- [ ] Clicking a target column auto-scrolls the LEFT PANEL (internally) to the first related source column
- [ ] The persistent popup appears near the clicked column with all relation details
- [ ] The popup stays until the user clicks the same column again or picks a different column
- [ ] Clicking a different column immediately switches highlight + popup to the new column
- [ ] The left panel scrolls independently with its own scrollbar
- [ ] The right panel scrolls with the page scrollbar (no independent scrollbar on right panel)
- [ ] SVG lines recalculate correctly after scroll animations complete
- [ ] The existing hover-on-line tooltip still works when NO column is selected
- [ ] When a column IS selected, hovering lines does NOT show the hover tooltip (popup takes priority)
- [ ] All existing features (header, badges, empty states, edge count) still work unchanged
- [ ] No console errors or warnings
````

---

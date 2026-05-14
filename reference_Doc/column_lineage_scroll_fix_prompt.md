# Prompt: Column Lineage — Fix Scroll Behavior (Both Panels Internal Scroll)

> [!IMPORTANT]
> Copy the entire prompt below (everything inside the fenced block) and paste it into the LLM.

---

````text
## Context

I have a React project called "Code Analyzer" located at:
`c:\Users\PatelVinodbhaiMAQSof\Desktop\Code Analyzer - Antigravity`

The Column Lineage feature lives in two files:
- **Component:** `src/Components/ColumnLineageView.js` (502 lines)
- **Styles:** `src/Components/ColumnLineageView.css` (281 lines)

### The Problem

Currently when a user clicks a column on the **left panel** (source), the auto-scroll logic calls `el.scrollIntoView({ behavior: 'smooth', block: 'center' })` on the related target column in the right panel. This scrolls the **entire page** to bring the target column into view — which causes the left panel's selected column to shift out of the viewport. The user loses sight of what they clicked.

The **right panel** currently has `overflow-y: visible` (CSS line 85), so it has no internal scrollbar — it relies on the page scroll. This is the root cause.

**What I want instead:** Both panels should have their **own independent internal scrollbars**. When any column is clicked, **only the opposite panel should scroll internally** — the page scroll and the clicked panel must NOT move at all.

---

## CRITICAL RULES

1. **Do NOT delete any existing code.** Modify in place.
2. **Preserve ALL existing comments and docstrings.**
3. **Do NOT rename any files, functions, variables, or CSS class names.**
4. **Do NOT change any import paths or unrelated logic.**
5. **Do NOT install or uninstall any npm packages.**
6. **Do NOT change any existing highlight, popup, or selection logic** — only fix the scroll behavior.
7. **All new CSS classes must be prefixed with `col-lineage-`** to match existing convention.

---

## REQUIRED CHANGES

### CHANGE 1 — CSS: Give BOTH panels internal scroll, contain the layout

**File:** `src/Components/ColumnLineageView.css`

#### 1a. Container — fixed height, no page overflow

The `.col-lineage-container` (line 3-12) currently has `overflow-y: visible`. Change it so the entire component has a **fixed viewport height** and does NOT push content to the page scroll:

```css
.col-lineage-container {
    display: flex;
    flex-direction: column;
    height: calc(100vh - 200px);   /* Fill available viewport minus header/nav */
    min-height: 500px;
    max-height: 900px;             /* Prevent it from being excessively tall */
    background-color: #ffffff;
    border-radius: 8px;
    overflow: hidden;              /* Contain everything — no page overflow */
    position: relative;
}
```

> **Note:** Adjust the `200px` offset to match the actual height consumed by elements above this component (navbar, header, tabs, etc.). If you're unsure, use `200px` as a safe default. The key is that the container must NOT exceed the viewport.

#### 1b. Body — fill remaining height, overflow hidden

The `.col-lineage-body` (line 48-54) currently has `overflow: visible`. Change it so it fills the remaining height (after the header) and hides overflow (panels handle their own scrolling):

```css
.col-lineage-body {
    position: relative;
    display: flex;
    flex-direction: row;
    flex: 1;
    overflow: hidden;              /* Changed from 'visible' — panels scroll individually */
    min-height: 0;                 /* IMPORTANT: Allows flex children to shrink below content size */
}
```

> **`min-height: 0` is critical.** Without it, flex children won't shrink and `overflow-y: auto` on the panels won't activate. This is a common flexbox gotcha.

#### 1c. Left panel — keep internal scroll (already correct)

The `.col-lineage-panel-left` (line 78-81) already has `overflow-y: auto`. **No change needed.**

#### 1d. Right panel — ADD internal scroll

The `.col-lineage-panel-right` (line 83-86) currently has `overflow-y: visible`. Change it to match the left panel:

```css
.col-lineage-panel-right {
    margin-left: auto;
    overflow-y: auto;              /* Changed from 'visible' — now scrolls internally */
}
```

#### 1e. Base panel — ensure both panels fill available height

The `.col-lineage-panel` (line 73-76) doesn't have a height constraint. Add flex properties so both panels fill the body height:

```css
.col-lineage-panel {
    width: 45%;
    padding: 16px 20px;
    height: 100%;                  /* Fill body height */
    box-sizing: border-box;        /* Padding doesn't add to height */
}
```

---

### CHANGE 2 — JS: Right panel ref + internal scroll for BOTH directions

**File:** `src/Components/ColumnLineageView.js`

#### 2a. Add a ref for the right panel

There's already a `leftPanelRef` (line 21). Add a matching ref for the right panel:

```js
const rightPanelRef = useRef(null);  // Add after leftPanelRef (line 21)
```

Attach it to the right panel div (line 437):

```jsx
<div className="col-lineage-panel col-lineage-panel-right" ref={rightPanelRef}>
```

#### 2b. Fix the `handleColumnClick` auto-scroll logic (lines 188-242)

The current logic for `side === 'source'` (lines 201-216) uses `el.scrollIntoView(...)` which scrolls the whole page. Replace it to scroll the **right panel container internally**, using the same offset-calculation approach already used for the left panel (lines 228-235).

**Replace the entire `handleColumnClick` function (lines 188-242) with:**

```js
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
```

**Key difference:** The `side === 'source'` branch now uses `rightPanelRef.current.scrollTo(...)` instead of `el.scrollIntoView(...)`. This scrolls only the right panel container, leaving the page and left panel untouched.

#### 2c. Update scroll event listener to include right panel

The existing `useEffect` for scroll recalculation (lines 169-185) already listens to `window.addEventListener('scroll', onScroll, true)`. Since the right panel now scrolls internally, it will be picked up by the `panels.forEach(panel => panel.addEventListener('scroll', onScroll))` loop (line 176) because it queries `.col-lineage-panel` — which already covers both panels. **No JS change needed here** — just verify the `querySelectorAll('.col-lineage-panel')` picks up both.

#### 2d. Remove the page-level scroll listener (optional cleanup)

Since neither panel uses page scroll anymore, the `window.addEventListener('scroll', onScroll, true)` on line 178 is no longer needed for panel alignment. However, **keep it** as a safety net in case the container itself is within a scrollable parent. No change needed.

---

### CHANGE 3 — SVG height must match the taller panel's content

Since both panels now scroll independently, the SVG overlay's height must cover the full scrollable content (not just the visible viewport). Otherwise, lines for off-screen columns won't render.

**In `calculateLines` (line 126-160):** The SVG already uses `position: absolute` with `width: 100%` and `height: 100%`, which fills the `.col-lineage-body` visible area. The line coordinates are calculated relative to `bodyRef.current.getBoundingClientRect()` — which is the visible viewport of the body.

**This is correct.** Lines for visible columns will render; lines for off-screen columns won't. This is acceptable and actually desirable (no phantom lines pointing off-screen). When the user scrolls, the `onScroll` listener triggers `calculateLines()` and the lines update dynamically.

**No change needed here** — just confirming the existing approach is compatible.

---

## SUMMARY OF CHANGES

| File | Line(s) | What Changes |
|------|---------|-------------|
| `ColumnLineageView.css` | 3-12 | Container: add fixed height (`calc(100vh - 200px)`), change to `overflow: hidden` |
| `ColumnLineageView.css` | 48-54 | Body: change to `overflow: hidden`, add `min-height: 0` |
| `ColumnLineageView.css` | 73-76 | Panel base: add `height: 100%`, `box-sizing: border-box` |
| `ColumnLineageView.css` | 83-86 | Right panel: change `overflow-y: visible` → `overflow-y: auto` |
| `ColumnLineageView.js` | 21 | Add `rightPanelRef = useRef(null)` |
| `ColumnLineageView.js` | 437 | Attach `ref={rightPanelRef}` to right panel div |
| `ColumnLineageView.js` | 201-216 | Replace `el.scrollIntoView(...)` with `rightPanelRef.current.scrollTo(...)` for internal scroll |

---

## BEFORE vs AFTER

```
BEFORE (broken):
  User clicks left column "NA_NM"
    → el.scrollIntoView() on right panel target
    → ENTIRE PAGE scrolls down
    → Left panel shifts — "NA_NM" goes out of view ❌
    → User loses context

AFTER (fixed):
  User clicks left column "NA_NM"
    → rightPanelRef.current.scrollTo() on right panel
    → ONLY RIGHT PANEL scrolls internally
    → Left panel stays put — "NA_NM" remains visible ✅
    → User sees both selected column and its target

  User clicks right column "col_a"
    → leftPanelRef.current.scrollTo() on left panel
    → ONLY LEFT PANEL scrolls internally
    → Right panel stays put — "col_a" remains visible ✅
```

---

## VERIFICATION CHECKLIST

After making all changes, confirm:
- [ ] Both left and right panels have their own independent vertical scrollbars when content overflows
- [ ] Clicking a source column (left) scrolls ONLY the right panel to the related target — left panel does NOT move
- [ ] Clicking a target column (right) scrolls ONLY the left panel to the related source — right panel does NOT move
- [ ] The page/window scroll does NOT move when clicking any column
- [ ] The selected column remains fully visible in its panel after clicking
- [ ] SVG lines recalculate correctly when either panel scrolls
- [ ] SVG lines update dynamically as the user manually scrolls either panel
- [ ] The persistent popup still appears correctly near the selected column
- [ ] Column highlight (selected + related) still works unchanged
- [ ] Line dimming (unrelated lines fade to 30% opacity) still works unchanged
- [ ] All existing features (header, badges, empty states, edge count, hover tooltip) still work unchanged
- [ ] No console errors or warnings
- [ ] Component looks correct at various viewport heights (resize the browser to test)
````

---

# Feature Implementation: Image and Excel Download for Column Mapping

## Objective
Implement a feature in `ColumnLineageView.js` that allows users to export the current column mapping visualization as an Image (PNG/SVG) and an Excel file (.xlsx), similar to the existing functionality in the Table Lineage view.

## Feasibility Assessment
**Yes, this is completely feasible.**

*   **Image Download (PNG/SVG):** The column mapping is built using standard DOM elements (React components) and an SVG overlay for the lines. We can use a library like `html-to-image` (already commonly used in React projects for this exact purpose) to capture the `containerRef` or `bodyRef` and convert it to a downloadable image format. Alternatively, since it's an SVG overlay on top of DOM nodes, we might need a library that handles both well, or we can extract just the SVG and the text nodes into a composite canvas. The simplest robust approach is usually `html2canvas` or `dom-to-image`.
*   **Excel Download (.xlsx):** We already have the structured data in the `filteredLineage` array and `sourceGroupsArray`. We can easily format this into an array of objects representing rows (e.g., Target Column, Source Table, Source Column, Transform Expression) and use the `xlsx` or `xlsx-js-style` library (which is already imported in your project, e.g., in `NavbarEnhanced.js`) to generate and download an Excel file.

## Instructions for the LLM

Please implement the "Download Image" and "Download Excel" functionality in the `ColumnLineageView` component.

### 1. Requirements

*   Add two buttons to the top right of the `ColumnLineageView` component (perhaps next to the table name or in a small toolbar).
    *   Button 1: "Download Image" (Icon: `DownloadIcon` or similar image icon).
    *   Button 2: "Download Excel" (Icon: `DownloadIcon` or similar table icon).
*   **Image Export:** When "Download Image" is clicked, capture the entire visual area of the column mapping (the left panel, right panel, and the SVG lines between them) and save it as a PNG file. Name the file `ColumnMapping_[TableName].png`.
*   **Excel Export:** When "Download Excel" is clicked, generate an Excel file containing the lineage data currently visible.
    *   The Excel file should have columns: `Target Column`, `Source Table`, `Source Column`, `Transform`, `Expression`.
    *   Name the file `ColumnMapping_[TableName].xlsx`.

### 2. Implementation Details

#### Step 2a: Update `ColumnLineageView.js` UI
1.  Import necessary icons from `@mui/icons-material`.
2.  Add a header/toolbar area above the main `.column-lineage-body` to hold the title and the new export buttons.

#### Step 2b: Implement Excel Export Logic
1.  Import the `* as XLSX` from `xlsx` or `xlsx-js-style` (whichever is already used in the project).
2.  Create a function `handleDownloadExcel()`.
3.  Inside this function, map the `filteredLineage` array to the desired format:
    ```javascript
    const excelData = filteredLineage.map(item => ({
        "Target Column": item.targetColumn,
        "Source Table": item.sourceTable,
        "Source Column": item.sourceColumn,
        "Transform": item.transform,
        "Expression": item.expression
    }));
    ```
4.  Use `XLSX.utils.json_to_sheet` and `XLSX.writeFile` to trigger the download.

#### Step 2b: Implement Image Export Logic
1.  You will likely need an external library for this. I recommend `html-to-image` as it handles modern DOM structures well.
    *   *Self-Correction for the user's environment:* If you cannot install new packages, check if `html2canvas` or similar is already in `package.json`. Assuming you can install `html-to-image`.
2.  Create a function `handleDownloadImage()`.
3.  Use the reference to the main container (e.g., `containerRef.current`) and pass it to the library to generate a data URL, then create a temporary link to download it.
    ```javascript
    import { toPng } from 'html-to-image';

    const handleDownloadImage = () => {
        if (containerRef.current === null) {
          return
        }

        toPng(containerRef.current, { cacheBust: true })
          .then((dataUrl) => {
            const link = document.createElement('a')
            link.download = `ColumnMapping_${tableName}.png`
            link.href = dataUrl
            link.click()
          })
          .catch((err) => {
            console.error('Failed to generate image', err)
          })
    }
    ```

### 3. Files to Modify
*   `src/Components/ColumnLineageView.js`: Add the buttons and the export handler functions.
*   `src/Components/ColumnLineageView.css` (Optional): Add styles for the new header/toolbar area to ensure it looks clean and aligns with the rest of the UI.
*   (If necessary) `package.json`: Add `html-to-image` if an image export library doesn't exist.

### 4. Code Snippet to provide to LLM

```javascript
// Add these imports at the top of ColumnLineageView.js
import { toPng } from 'html-to-image'; // You may need to npm install html-to-image
import * as XLSX from 'xlsx-js-style'; // Assuming this is already used in the project
import DownloadIcon from '@mui/icons-material/Download';
import ImageIcon from '@mui/icons-material/Image';
import TableChartIcon from '@mui/icons-material/TableChart';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';

// ... inside the ColumnLineageView component ...

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
    };

    const handleDownloadImage = () => {
        if (containerRef.current === null) return;
        
        // Temporarily adjust styles if needed so the full content is captured 
        // (e.g., if there's internal scrolling, you might need to expand the container briefly)

        toPng(containerRef.current, { cacheBust: true, backgroundColor: '#ffffff' })
            .then((dataUrl) => {
                const link = document.createElement('a');
                link.download = `ColumnMapping_${tableName}.png`;
                link.href = dataUrl;
                link.click();
            })
            .catch((err) => {
                console.error('Oops, something went wrong with image download!', err);
            });
    };

// ... in the JSX return ...
// Add a header div above the <div className="column-lineage-body" ref={bodyRef}>
    <div className="column-lineage-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
        <h3 style={{ margin: 0 }}>Column Mapping: {tableName}</h3>
        <div>
            <Tooltip title="Download Image">
                <IconButton onClick={handleDownloadImage} size="small" style={{ marginRight: '8px' }}>
                    <ImageIcon />
                </IconButton>
            </Tooltip>
            <Tooltip title="Download Excel">
                <IconButton onClick={handleDownloadExcel} size="small">
                    <TableChartIcon />
                </IconButton>
            </Tooltip>
        </div>
    </div>
```

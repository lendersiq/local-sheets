// js/sheets.js

// Default sheet configuration.
// This configuration may be overridden by a loaded sheet JSON.
let columnsConfig = [
    { heading: 'Portfolio', id: 'portfolio', column_type: 'data', data_type: 'unique' },
    { heading: 'Principal', id: 'principal', column_type: 'data', data_type: 'currency' },
    { heading: 'Rate', id: 'rate', column_type: 'data', data_type: 'rate' },
    { heading: 'Interest Income', id: 'interestIncome', column_type: 'function', function: 'interestIncome(principal, rate)', data_type: 'currency' },
    { heading: 'Commission', id: 'commission', column_type: 'formula', formula: 'interestIncome * 0.1', data_type: 'currency' }
];
  

// Global storage for the sheet data (parsed CSV rows)
let sheetData = [];

/* --------------------------------
   Utility: Safe Formula Evaluation
   --------------------------------
   The safeEvalFormula function validates that the formula string
   contains only allowed characters before evaluating it.
---------------------------------- */
function safeEvalFormula(formulaStr) {
  // Allow only digits, basic operators, decimal points, whitespace, and parentheses.
  if (/^[0-9+\-*/().\s]+$/.test(formulaStr)) {
    return Function('"use strict"; return (' + formulaStr + ')')();
  } else {
    throw new Error("Unsafe characters detected in formula: " + formulaStr);
  }
}

/* --------------------------------
   Navigation Menu Logic
---------------------------------- */
document.getElementById('fileMenuButton').addEventListener('click', () => {
  document.getElementById('fileDropdown').classList.toggle('show');
});
window.addEventListener('click', (e) => {
  if (!document.getElementById('fileMenuButton').contains(e.target)) {
    document.getElementById('fileDropdown').classList.remove('show');
  }
});

/* --------------------------------
   Open Sheet (Configuration)
---------------------------------- */
document.getElementById('openSheetButton').addEventListener('click', () => {
  document.getElementById('sheetConfigInput').click();
});
document.getElementById('sheetConfigInput').addEventListener('change', (event) => {
  const file = event.target.files[0];
  if (file) {
    const reader = new FileReader();
    reader.onload = function(e) {
      try {
        const config = JSON.parse(e.target.result);
        if (config.columnsConfig) {
          columnsConfig = config.columnsConfig;
          sheetData = [];
          renderSheet();
          alert('Sheet configuration loaded. Now open a CSV source.');
        } else {
          alert('Invalid sheet configuration file.');
        }
      } catch (err) {
        alert('Error parsing sheet configuration: ' + err.message);
      }
    };
    reader.readAsText(file);
  }
});

/* --------------------------------
   Open Sources (CSV file)
---------------------------------- */
document.getElementById('openSourcesButton').addEventListener('click', () => {
  document.getElementById('fileInput').click();
});
document.getElementById('fileInput').addEventListener('change', (event) => {
  const file = event.target.files[0];
  if (file) {
    const reader = new FileReader();
    reader.onload = function(e) {
      const csvText = e.target.result;
      parseCSV(csvText);
      mapColumns();
      recalcSheet();
      renderSheet();
    };
    reader.readAsText(file);
  }
});

/* --------------------------------
   CSV Parsing
---------------------------------- */
function parseCSV(text) {
  const lines = text.split(/\r?\n/).filter(line => line.trim() !== '');
  const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
  sheetData = lines.slice(1).map(line => {
    const values = line.split(',').map(v => v.trim());
    const row = {};
    headers.forEach((header, index) => {
      row[header] = values[index];
    });
    return row;
  });
}

/* --------------------------------
   Map CSV Headers to Columns
   For "data" columns, map CSV header values based on the column's id.
---------------------------------- */
function mapColumns() {
  columnsConfig.forEach(col => {
    if (col.column_type === 'data') {
      sheetData.forEach(row => {
        if (!(col.id in row)) {
          // Try a case-insensitive match.
          for (let key in row) {
            if (key.toLowerCase() === col.id.toLowerCase()) {
              row[col.id] = row[key];
              break;
            }
          }
          if (!(col.id in row)) {
            row[col.id] = null;
          }
        }
      });
    }
  });
}

/* --------------------------------
   Evaluate Formulas
   Two-pass evaluation:
     1. Function columns (using the function property).
     2. Formula columns (using the formula property and safeEvalFormula).
---------------------------------- */
function recalcSheet() {
  const errorDisplay = document.getElementById('errorDisplay');
  errorDisplay.innerHTML = '';

  sheetData.forEach((row, rowIndex) => {
    // First pass: evaluate function columns.
    columnsConfig.forEach(col => {
        if (col.column_type === 'function' && col.function) {
        const match = col.function.match(/^(\w+)\(([^)]*)\)$/);
        if (match) {
            const funcName = match[1];
            const argsStr = match[2];
            // Replace argument names using column ids.
            const args = argsStr.split(',')
                                .map(arg => arg.trim())
                                .map(arg => parseFloat(row[arg]) || 0);
            if (window.functions && window.functions[funcName]) {
            try {
                const result = window.functions[funcName].implementation(...args);
                row[col.id] = result;
            } catch (err) {
                row[col.id] = null;
                errorDisplay.innerHTML += `<div class="error">Row ${rowIndex + 1}, column "${col.heading}": ${err.message}</div>`;
            }
            } else {
            row[col.id] = null;
            errorDisplay.innerHTML += `<div class="error">Row ${rowIndex + 1}: Function "${funcName}" not found.</div>`;
            }
        }
        }
    });
  

    // Second pass: evaluate formula columns.
    columnsConfig.forEach(col => {
        if (col.column_type === 'formula' && col.formula) {
        let formulaStr = col.formula;
        // Replace each column id reference with its value from the row.
        columnsConfig.forEach(refCol => {
            const regex = new RegExp('\\b' + refCol.id + '\\b', 'g');
            formulaStr = formulaStr.replace(regex, row[refCol.id] !== undefined ? row[refCol.id] : 0);
        });
        try {
            const result = safeEvalFormula(formulaStr);
            // Store result using the column's id.
            row[col.id] = result;
        } catch (err) {
            row[col.id] = null;
            errorDisplay.innerHTML += `<div class="error">Row ${rowIndex + 1}, column "${col.heading}": ${err.message}</div>`;
        }
        }
    });
  
  });
}

/* --------------------------------
   Accordion Feature: Grouping Rows Based on Unique Column
---------------------------------- */
// Find the first column marked as unique.
function getUniqueColumn() {
  return columnsConfig.find(col => col.data_type === 'unique' && col.column_type === 'data');
}

// Group rows by the unique column's value. For duplicate groups, combine rows.
function groupRowsByUnique() {
  const uniqueCol = getUniqueColumn();
  if (!uniqueCol) return sheetData; // No grouping if no unique column.
  const groups = {};
  sheetData.forEach(row => {
    const key = row[uniqueCol.id];
    if (!groups[key]) groups[key] = [];
    groups[key].push(row);
  });

  const groupedRows = [];
  for (const key in groups) {
    const rows = groups[key];
    if (rows.length === 1) {
      groupedRows.push({ combined: rows[0], subRows: [] });
    } else {
      const combined = combineRows(rows);
      groupedRows.push({ combined, subRows: rows });
    }
  }
  return groupedRows;
}

// Combine an array of rows using aggregation rules based on data_type.
function combineRows(rows) {
  const combined = {};
  columnsConfig.forEach(col => {
    let values = rows.map(row => row[col.heading] || row[col.id]);
    switch(col.data_type) {
      case 'unique':
        combined[col.heading] = values[0];
        break;
      case 'currency':
      case 'float':
        combined[col.heading] = values.reduce((sum, val) => sum + (parseFloat(val) || 0), 0);
        break;
      case 'integer':
        const intValues = values.map(val => parseInt(val)).filter(v => !isNaN(v));
        combined[col.heading] = mode(intValues);
        break;
      case 'strings':
        combined[col.heading] = values.join(', ');
        break;
      case 'rate':
        const nums = values.map(val => parseFloat(val)).filter(v => !isNaN(v));
        combined[col.heading] = nums.length ? (nums.reduce((a, b) => a + b, 0) / nums.length) : 0;
        break;
      default:
        combined[col.heading] = values[0];
    }
  });
  return combined;
}

// Helper: Calculate the mode (most frequent value) of an array.
function mode(arr) {
  if (arr.length === 0) return null;
  const frequency = {};
  let maxFreq = 0;
  let modeValue = arr[0];
  arr.forEach(num => {
    frequency[num] = (frequency[num] || 0) + 1;
    if (frequency[num] > maxFreq) {
      maxFreq = frequency[num];
      modeValue = num;
    }
  });
  return modeValue;
}

/* --------------------------------
   Compute Totals Row for the Entire Sheet
---------------------------------- */
function computeTotals() {
  const totals = {};
  columnsConfig.forEach(col => {
    switch(col.data_type) {
      case 'currency':
      case 'float':
        totals[col.heading] = 0;
        break;
      case 'integer':
        totals[col.heading] = [];
        break;
      case 'rate':
        totals[col.heading] = { sum: 0, count: 0 };
        break;
      default:
        totals[col.heading] = '';
    }
  });
  // Sum across all original rows.
  sheetData.forEach(row => {
    columnsConfig.forEach(col => {
      let value = row[col.heading] || row[col.id];
      switch(col.data_type) {
        case 'currency':
        case 'float':
          totals[col.heading] += parseFloat(value) || 0;
          break;
        case 'integer':
          const intVal = parseInt(value);
          if (!isNaN(intVal)) totals[col.heading].push(intVal);
          break;
        case 'rate':
          const numVal = parseFloat(value);
          if (!isNaN(numVal)) {
            totals[col.heading].sum += numVal;
            totals[col.heading].count++;
          }
          break;
        default:
          break;
      }
    });
  });
  columnsConfig.forEach(col => {
    if (col.data_type === 'integer') {
      totals[col.heading] = totals[col.heading].length ? mode(totals[col.heading]) : '';
    } else if (col.data_type === 'rate') {
      totals[col.heading] = totals[col.heading].count ? (totals[col.heading].sum / totals[col.heading].count) : '';
    }
  });
  return totals;
}

/* --------------------------------
   Render the Spreadsheet with Accordion Rows and Totals
---------------------------------- */
function renderSheet() {
  const table = document.getElementById('spreadsheet');
  let html = '';

  // Table header using "heading"
  html += '<tr>';
  columnsConfig.forEach(col => {
    html += `<th>${col.heading}</th>`;
  });
  html += '</tr>';

  // Group rows by the unique column.
  const groupedRows = groupRowsByUnique();
  console.log('groupedRows', groupedRows);
  groupedRows.forEach((group, index) => {
    // Render the combined row.
    const hasSub = group.subRows && group.subRows.length > 0;
    html += `<tr class="combined-row ${hasSub ? 'accordion' : ''}" data-index="${index}">`;
    columnsConfig.forEach(col => {
      // Check for a value stored using the column's heading or its id.
      let cellValue = '';
      if (group.combined[col.heading] !== undefined) {
        cellValue = group.combined[col.heading];
      } else if (group.combined[col.id] !== undefined) {
        cellValue = group.combined[col.id];
      }
      html += `<td>${cellValue}</td>`;
    });
    html += '</tr>';
  
    // Render the hidden sub-rows if this group has duplicates.
    if (hasSub) {
      html += `<tr class="sub-rows" data-parent-index="${index}" style="display:none;"><td colspan="${columnsConfig.length}">`;
      html += '<table class="sub-table">';
      html += '<tr>';
      columnsConfig.forEach(col => {
        html += `<th>${col.heading}</th>`;
      });
      html += '</tr>';
      group.subRows.forEach(subRow => {
        html += '<tr>';
        columnsConfig.forEach(col => {
          let cellValue = '';
          if (subRow[col.heading] !== undefined) {
            cellValue = subRow[col.heading];
          } else if (subRow[col.id] !== undefined) {
            cellValue = subRow[col.id];
          }
          html += `<td>${cellValue}</td>`;
        });
        html += '</tr>';
      });
      html += '</table></td></tr>';
    }
  });  

  // Totals row.
  const totals = computeTotals();
  html += '<tr class="totals-row">';
  columnsConfig.forEach(col => {
    html += `<td>${totals[col.heading]}</td>`;
  });
  html += '</tr>';

  table.innerHTML = html;

  // Set up accordion toggle for combined rows.
  document.querySelectorAll('.combined-row.accordion').forEach(row => {
    row.addEventListener('click', function() {
      const index = this.getAttribute('data-index');
      const subRow = document.querySelector(`.sub-rows[data-parent-index="${index}"]`);
      subRow.style.display = (subRow.style.display === 'none') ? 'table-row' : 'none';
    });
  });
}

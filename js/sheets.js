// js/sheets.js

// Updated default columns configuration with source_name for data columns.
let columnsConfig = [
  { heading: 'Portfolio', id: 'portfolio', column_type: 'data', data_type: 'unique', source_name: 'loan' },
  { heading: 'Principal', id: 'principal', column_type: 'data', data_type: 'currency', source_name: 'loan' },
  { heading: 'Rate', id: 'rate', column_type: 'data', data_type: 'rate', source_name: 'loan' },
  { heading: 'Balance', id: 'Average_Balance', column_type: 'data', data_type: 'currency', source_name: 'checking' },
  { heading: 'Interest Income', id: 'interestIncome', column_type: 'function', function: 'interestIncome(principal, rate)', data_type: 'currency' },
  { heading: 'Commission', id: 'commission', column_type: 'formula', formula: 'interestIncome * 0.1', data_type: 'currency' }
];

// Global sheetData holds all rows (from all CSV files)
let sheetData = [];

// Currency formatter.
const USDollar = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
});

// Helper for formatting cell values based on data_type.
function formatValue(value, dataType) {
  if (value == null || value === '') return '';
  switch(dataType) {
    case 'currency':
      return USDollar.format(value);
    case 'rate':
      // Assume value is in decimal (e.g., 0.05 => 5.00%)
      return (parseFloat(value) * 100).toFixed(2) + '%';
    case 'integer':
      return parseInt(value);
    case 'float':
      return parseFloat(value).toFixed(2);
    default:
      return value;
  }
}

/* ---------------------------
   Safe Formula Evaluation
---------------------------- */
function safeEvalFormula(formulaStr) {
  // Allow only numbers, operators, whitespace, decimal points, and parentheses.
  if (/^[0-9+\-*/().\s]+$/.test(formulaStr)) {
    return Function('"use strict"; return (' + formulaStr + ')')();
  } else {
    throw new Error("Unsafe characters detected in formula: " + formulaStr);
  }
}

/* ---------------------------
   Navigation Menu Logic
---------------------------- */
document.getElementById('fileMenuButton').addEventListener('click', () => {
  document.getElementById('fileDropdown').classList.toggle('show');
});
window.addEventListener('click', (e) => {
  if (!document.getElementById('fileMenuButton').contains(e.target)) {
    document.getElementById('fileDropdown').classList.remove('show');
  }
});

/* ---------------------------
   Open Sheet (Configuration)
---------------------------- */
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
          alert('Sheet configuration loaded. Now open CSV sources.');
          // Rebuild the CSV file menu buttons.
          setupSourceFileInputs();
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

/* ---------------------------
   Multiple CSV Sources
---------------------------- */
// Build file input buttons for each distinct source_name.
let sourceFileInputs = {};

// Global counter for pending CSV file reads.
let pendingFileReads = 0;

// Updated file input change handler for each CSV source.
function setupSourceFileInputs() {
  // Remove any existing source buttons.
  const dropdown = document.getElementById('fileDropdown');
  // Remove all items except the first "Open Sheet" button.
  dropdown.querySelectorAll('.source-button').forEach(el => el.remove());
  sourceFileInputs = {};
  // Get distinct source names from data columns.
  const sourceNames = [...new Set(columnsConfig.filter(c => c.column_type === 'data').map(c => c.source_name))];
  sourceNames.forEach(source => {
    // Create a menu button.
    const btn = document.createElement('button');
    btn.className = 'dropdown-item source-button';
    btn.textContent = 'Open ' + source + ' CSV';
    btn.dataset.source = source;
    btn.addEventListener('click', () => {
      sourceFileInputs[source].click();
    });
    dropdown.appendChild(btn);

    // Create a hidden file input for this source.
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.csv';
    input.multiple = true;
    input.style.display = 'none';
    input.dataset.source = source;
    input.addEventListener('change', (event) => {
      const files = event.target.files;
      for (let file of files) {
        pendingFileReads++;  // Increase pending count
        const reader = new FileReader();
        reader.onload = (e) => {
          // Parse CSV for this source.
          parseCSVForSource(e.target.result, source);
          pendingFileReads--;  // File read finished
          if (pendingFileReads === 0) {
            // Once all files are loaded, process mapping, recalculation, and rendering.
            processAllCSV();
          }
        };
        reader.readAsText(file);
      }
    });
    document.body.appendChild(input);
    sourceFileInputs[source] = input;
  });
}

// Process all CSV files after all file reads have completed.
function processAllCSV() {
  // For each distinct source in the loaded data, map the CSV headers.
  const sources = [...new Set(sheetData.map(row => row.__source))];
  sources.forEach(source => {
    mapColumnsForSource(source);
  });
  recalcSheet();
  renderSheet();
}

// Initial call to set up file inputs (using default config).
setupSourceFileInputs();

/* ---------------------------
   CSV Parsing for a Given Source
---------------------------- */
function parseCSVForSource(text, source) {
  const lines = text.split(/\r?\n/).filter(line => line.trim() !== '');
  if (!lines.length) return;
  const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
  const newRows = lines.slice(1).map(line => {
    const values = line.split(',').map(v => v.trim());
    const row = {};
    headers.forEach((header, index) => {
      row[header] = values[index];
    });
    // Tag the row with its source.
    row.__source = source;
    return row;
  });
  sheetData = sheetData.concat(newRows);
}

/* ---------------------------
   Map CSV Headers to Columns (per Source)
---------------------------- */
// For each data column, if the row's source matches the column's source_name, try to map the CSV header to col.id.
function mapColumnsForSource(source) {
  sheetData.forEach(row => {
    if (row.__source === source) {
      columnsConfig.forEach(col => {
        if (col.column_type === 'data' && col.source_name === source) {
          if (!(col.id in row)) {
            // Try a case-insensitive match from CSV headers.
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
        }
      });
    }
  });
}

/* ---------------------------
   Evaluate Formulas
---------------------------- */
function recalcSheet() {
  const errorDisplay = document.getElementById('errorDisplay');
  errorDisplay.innerHTML = '';

  sheetData.forEach((row, rowIndex) => {
    // First pass: function columns.
    columnsConfig.forEach(col => {
      if (col.column_type === 'function' && col.function) {
        const match = col.function.match(/^(\w+)\(([^)]*)\)$/);
        if (match) {
          const funcName = match[1];
          const argsStr = match[2];
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

    // Second pass: formula columns.
    columnsConfig.forEach(col => {
      if (col.column_type === 'formula' && col.formula) {
        let formulaStr = col.formula;
        columnsConfig.forEach(refCol => {
          const regex = new RegExp('\\b' + refCol.id + '\\b', 'g');
          formulaStr = formulaStr.replace(regex, row[refCol.id] !== undefined ? row[refCol.id] : 0);
        });
        try {
          const result = safeEvalFormula(formulaStr);
          row[col.id] = result;
        } catch (err) {
          row[col.id] = null;
          errorDisplay.innerHTML += `<div class="error">Row ${rowIndex + 1}, column "${col.heading}": ${err.message}</div>`;
        }
      }
    });
  });
}

/* ---------------------------
   Grouping & Accordion (Unique Column)
---------------------------- */
function getUniqueColumn() {
  return columnsConfig.find(col => col.data_type === 'unique' && col.column_type === 'data');
}

function groupRowsByUnique() {
  const uniqueCol = getUniqueColumn();
  if (!uniqueCol) return sheetData.map(row => ({ combined: row, subRows: [] }));
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

function combineRows(rows) {
  const combined = {};
  columnsConfig.forEach(col => {
    let values = rows.map(row => row[col.id] || row[col.heading]);
    switch(col.data_type) {
      case 'unique':
        combined[col.id] = values[0];
        break;
      case 'currency':
      case 'float':
        combined[col.id] = values.reduce((sum, val) => sum + (parseFloat(val) || 0), 0);
        break;
      case 'integer':
        const intValues = values.map(val => parseInt(val)).filter(v => !isNaN(v));
        combined[col.id] = mode(intValues);
        break;
      case 'strings':
        combined[col.id] = values.join(', ');
        break;
      case 'rate':
        const nums = values.map(val => parseFloat(val)).filter(v => !isNaN(v));
        combined[col.id] = nums.length ? (nums.reduce((a, b) => a + b, 0) / nums.length) : 0;
        break;
      default:
        combined[col.id] = values[0];
    }
  });
  return combined;
}

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

/* ---------------------------
   Compute Totals Row
---------------------------- */
function computeTotals() {
  const totals = {};
  columnsConfig.forEach(col => {
    switch(col.data_type) {
      case 'currency':
      case 'float':
        totals[col.id] = 0;
        break;
      case 'integer':
        totals[col.id] = [];
        break;
      case 'rate':
        totals[col.id] = { sum: 0, count: 0 };
        break;
      default:
        totals[col.id] = '';
    }
  });
  sheetData.forEach(row => {
    columnsConfig.forEach(col => {
      let value = row[col.id] || row[col.heading];
      switch(col.data_type) {
        case 'currency':
        case 'float':
          totals[col.id] += parseFloat(value) || 0;
          break;
        case 'integer':
          const intVal = parseInt(value);
          if (!isNaN(intVal)) totals[col.id].push(intVal);
          break;
        case 'rate':
          const numVal = parseFloat(value);
          if (!isNaN(numVal)) {
            totals[col.id].sum += numVal;
            totals[col.id].count++;
          }
          break;
        default:
          break;
      }
    });
  });
  columnsConfig.forEach(col => {
    if (col.data_type === 'integer') {
      totals[col.id] = totals[col.id].length ? mode(totals[col.id]) : '';
    } else if (col.data_type === 'rate') {
      totals[col.id] = totals[col.id].count ? (totals[col.id].sum / totals[col.id].count) : '';
    }
  });
  return totals;
}

/* ---------------------------
   Render the Spreadsheet (with Row Numbers & Formatting)
---------------------------- */
function renderSheet() {
  const table = document.getElementById('spreadsheet');
  let html = '';

  // Build header row with a new "Row" number column.
  html += '<tr><th>Row</th>';
  columnsConfig.forEach(col => {
    html += `<th>${col.heading}</th>`;
  });
  html += '</tr>';

  const groupedRows = groupRowsByUnique();
  let rowNumber = 1;
  groupedRows.forEach((group, index) => {
    const hasSub = group.subRows && group.subRows.length > 0;
    // Render combined row with row number.
    html += `<tr class="combined-row ${hasSub ? 'accordion' : ''}" data-index="${index}">`;
    html += `<td>${rowNumber++}</td>`;
    columnsConfig.forEach(col => {
      let rawVal = (group.combined[col.id] !== undefined ? group.combined[col.id] : '');
      html += `<td>${formatValue(rawVal, col.data_type)}</td>`;
    });
    html += '</tr>';

    // Render sub-rows if available.
    if (hasSub) {
      html += `<tr class="sub-rows" data-parent-index="${index}" style="display:none;"><td colspan="${columnsConfig.length + 1}">`;
      html += '<table class="sub-table">';
      // Header for sub-table (with row numbers).
      html += '<tr><th>Row</th>';
      columnsConfig.forEach(col => {
        html += `<th>${col.heading}</th>`;
      });
      html += '</tr>';
      group.subRows.forEach(subRow => {
        html += '<tr>';
        html += `<td>${rowNumber++}</td>`;
        columnsConfig.forEach(col => {
          let rawVal = (subRow[col.id] !== undefined ? subRow[col.id] : subRow[col.heading] || '');
          html += `<td>${formatValue(rawVal, col.data_type)}</td>`;
        });
        html += '</tr>';
      });
      html += '</table></td></tr>';
    }
  });

  // Totals row.
  const totals = computeTotals();
  html += '<tr class="totals-row"><td></td>';
  columnsConfig.forEach(col => {
    html += `<td>${formatValue(totals[col.id], col.data_type)}</td>`;
  });
  html += '</tr>';

  table.innerHTML = html;

  // Set up accordion toggle.
  document.querySelectorAll('.combined-row.accordion').forEach(row => {
    row.addEventListener('click', function() {
      const index = this.getAttribute('data-index');
      const subRow = document.querySelector(`.sub-rows[data-parent-index="${index}"]`);
      subRow.style.display = (subRow.style.display === 'none') ? 'table-row' : 'none';
    });
  });
}

// Updated default columnsConfig can remain as is or be overwritten by a loaded/new sheet.

// -------------
// NEW SHEET MODAL LOGIC
// -------------
const newSheetButton = document.getElementById('newSheetButton');
const newSheetModal = document.getElementById('newSheetModal');
const closeModal = document.getElementById('closeModal');
const addColumnButton = document.getElementById('addColumnButton');
const columnsContainer = document.getElementById('columnsContainer');
const saveNewSheetButton = document.getElementById('saveNewSheetButton');
const newSheetNameInput = document.getElementById('newSheetName');

// Example: list of functions from functions.js (keys from window.functions)
const availableFunctions = window.functions ? Object.keys(window.functions) : [];

// Utility to create a new column editor row.
function createColumnEditor(initialData = {}) {
  const row = document.createElement('div');
  row.className = 'column-editor';
  // Heading input (enabled only on first row initially; can be edited later)
  row.innerHTML = `
    <div class="column-row">
      <input type="text" class="col-heading" placeholder="Heading" value="${initialData.heading || ''}" />
      <select class="col-type">
        <option value="data" ${initialData.column_type==='data'?'selected':''}>Data</option>
        <option value="function" ${initialData.column_type==='function'?'selected':''}>Function</option>
        <option value="formula" ${initialData.column_type==='formula'?'selected':''}>Formula</option>
      </select>
      <select class="data-type">
        <option value="unique">Unique (e.g., ID)</option>
        <option value="currency">Currency (e.g., $123.45)</option>
        <option value="rate">Rate (e.g., 5.00%)</option>
        <option value="float">Float (e.g., 12.34)</option>
        <option value="integer">Integer (e.g., 123)</option>
        <option value="strings">String</option>
      </select>
      <span class="icon move-left" title="Move Left">&#9664;</span>
      <span class="icon move-right" title="Move Right">&#9654;</span>
      <span class="icon remove" title="Remove Column">&#10006;</span>
    </div>
    <div class="column-extra">
      <!-- Extra fields appear based on column type -->
      <div class="data-options" style="display:none;">
        <input type="text" class="source-name" placeholder="Source Name" value="${initialData.source_name || ''}" />
        <input type="text" class="csv-id" placeholder="CSV Header ID" value="${initialData.id || ''}" />
      </div>
      <div class="function-options" style="display:none;">
        <div contenteditable="true" class="function-input" placeholder="Enter function e.g., interestIncome(principal, rate)">${initialData.function || ''}</div>
        <div class="function-hint">Available functions: ${availableFunctions.join(', ')}</div>
      </div>
      <div class="formula-options" style="display:none;">
        <div contenteditable="true" class="formula-input" placeholder="Enter formula e.g., interestIncome * 0.1">${initialData.formula || ''}</div>
      </div>
    </div>
  `;
  // Show/hide extra fields based on column type selection.
  const colTypeSelect = row.querySelector('.col-type');
  function updateExtraFields() {
    const type = colTypeSelect.value;
    row.querySelector('.data-options').style.display = (type === 'data') ? 'block' : 'none';
    row.querySelector('.function-options').style.display = (type === 'function') ? 'block' : 'none';
    row.querySelector('.formula-options').style.display = (type === 'formula') ? 'block' : 'none';
  }
  colTypeSelect.addEventListener('change', updateExtraFields);
  updateExtraFields();

  // Remove column event.
  row.querySelector('.remove').addEventListener('click', () => {
    row.remove();
  });
  // Move left/right events.
  row.querySelector('.move-left').addEventListener('click', () => {
    if (row.previousElementSibling) {
      columnsContainer.insertBefore(row, row.previousElementSibling);
    }
  });
  row.querySelector('.move-right').addEventListener('click', () => {
    if (row.nextElementSibling) {
      columnsContainer.insertBefore(row.nextElementSibling, row);
    }
  });
  return row;
}

// When user clicks "New", display the modal.
newSheetButton.addEventListener('click', () => {
  newSheetModal.style.display = 'block';
  // Clear previous content.
  columnsContainer.innerHTML = '';
  // Create one default column editor row.
  columnsContainer.appendChild(createColumnEditor());
});

// Close modal when the close button is clicked.
closeModal.addEventListener('click', () => {
  newSheetModal.style.display = 'none';
});

// Add column button.
addColumnButton.addEventListener('click', () => {
  columnsContainer.appendChild(createColumnEditor());
});

// When user clicks "Save", build the new columnsConfig JSON.
saveNewSheetButton.addEventListener('click', () => {
  const newColumns = [];
  const editors = columnsContainer.querySelectorAll('.column-editor');
  editors.forEach(editor => {
    const heading = editor.querySelector('.col-heading').value.trim();
    const column_type = editor.querySelector('.col-type').value;
    const data_type = editor.querySelector('.data-type').value;
    let col = { heading, column_type, data_type };
    // Always assign an id. For simplicity, convert heading to lowercase without spaces.
    col.id = heading.toLowerCase().replace(/\s+/g, '');
    if (column_type === 'data') {
      col.source_name = editor.querySelector('.source-name').value.trim();
      col.id = editor.querySelector('.csv-id').value.trim() || col.id;
    } else if (column_type === 'function') {
      col.function = editor.querySelector('.function-input').innerText.trim();
    } else if (column_type === 'formula') {
      col.formula = editor.querySelector('.formula-input').innerText.trim();
    }
    newColumns.push(col);
  });
  // Get the new sheet name.
  const sheetName = newSheetNameInput.value.trim() || "NewSheet";
  // Build the new configuration.
  const newConfig = {
    sheetName: sheetName,
    columnsConfig: newColumns
  };
  console.log("New sheet configuration:", newConfig);
  // Here you could save the JSON to a file or localStorage.
  // For demonstration, we update the global columnsConfig and close the modal.
  columnsConfig = newConfig.columnsConfig;
  newSheetModal.style.display = 'none';
  alert('New sheet configuration saved. You can now load CSV sources.');
});

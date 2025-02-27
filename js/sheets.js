// js/sheets.js

//
// 1. Updated default columnsConfig with date columns and formula
//
let columnsConfig = [
  { heading: 'Portfolio', id: 'Portfolio', column_type: 'data', data_type: 'unique'},
  { heading: 'Principal', id: 'principal', column_type: 'data', data_type: 'currency', source_name: 'loan' },
  { heading: 'Loan Type', id: 'Type_Code', column_type: 'data', data_type: 'integer', source_name: 'loan', filter: '{{20}}' },
  { heading: 'Payment',   id: 'Last_Payment',   column_type: 'data', data_type: 'currency', source_name: 'loan' },
  { heading: 'Maturity',  id: 'maturity_date',  column_type: 'data', data_type: 'date',     source_name: 'loan', filter: '< 2039-12-11' },
  { heading: 'Rate',      id: 'rate',           column_type: 'data', data_type: 'rate',     source_name: 'loan' },
  { heading: 'Balance',   id: 'average_balance', column_type: 'data', data_type: 'currency', source_name: 'checking' },
  { heading: 'Average',   id: 'averageBalance', column_type: 'function', function: 'averageBalance(principal, Last_Payment, rate, maturity_date)', data_type: 'currency' },
  { heading: 'Commission',id: 'commission',     column_type: 'formula',  formula: 'averageBalance * 0.1', data_type: 'currency' }
];

// Global storage for CSV data
let sheetData = [];
let statistics = {};
let sheetName = 'Local Sheets';
document.title = sheetName;

// ----------------------------------------------------------------------
// 2. Format values (currency, rate, etc.)
// ----------------------------------------------------------------------
const USDollar = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
});

function formatValue(value, dataType) {
  if (value == null || value === '') return '';
  switch (dataType) {
    case 'currency':
      return USDollar.format(value);
    case 'rate':
      // Assume value is decimal => 0.05 => 5.00%
      return (parseFloat(value) * 100).toFixed(2) + '%';
    case 'integer':
      return parseInt(value);
    case 'float':
      return parseFloat(value).toFixed(2);
    default:
      // date or strings or anything else
      return value;
  }
}

// ----------------------------------------------------------------------
// 3. Safe formula evaluation
// ----------------------------------------------------------------------
function safeEvalFormula(formulaStr, expectedType) {
  // 1. Replace DATE(...) tokens with day counts.
  let transformed = formulaStr.replace(/DATE\((.*?)\)/g, (match, p1) => {
    if (p1 === 'Invalid') return 'NaN';
    const dt = new Date(p1.trim());
    if (isNaN(dt.getTime())) return 'NaN';
    const daysSinceEpoch = Math.floor(dt.getTime() / (1000 * 3600 * 24));
    return String(daysSinceEpoch);
  });

  // 2. Safety check
  if (!/^[0-9+\-*/().\s]+$/.test(transformed)) {
    throw new Error("Unsafe characters detected in formula: " + transformed);
  }

  // 3. Evaluate
  let numericVal = Function('"use strict"; return (' + transformed + ')')();

  // 4. If we’re expecting a date, interpret numericVal as day offset (if it’s valid).
  if (expectedType === 'date' && typeof numericVal === 'number' && !isNaN(numericVal)) {
    // If numericVal is negative or extremely small, maybe it’s pre-1970 or invalid. Up to you.
    const dateCandidate = new Date(numericVal * 24 * 3600 * 1000);
    if (!isNaN(dateCandidate.getTime())) {
      // Return "YYYY-MM-DD"
      return dateCandidate.toISOString().slice(0,10);
    }
    // If invalid, or below threshold, you could throw or just return numericVal
  }

  // Otherwise (not a date type), just return numericVal
  return numericVal;
}

// ----------------------------------------------------------------------
// 4. Navigation Menu: File dropdown
// ----------------------------------------------------------------------
document.getElementById('fileMenuButton').addEventListener('click', () => {
  document.getElementById('fileDropdown').classList.toggle('show');
});
window.addEventListener('click', (e) => {
  if (!document.getElementById('fileMenuButton').contains(e.target)) {
    document.getElementById('fileDropdown').classList.remove('show');
  }
});

// ----------------------------------------------------------------------
// 5. Open an existing sheet config
// ----------------------------------------------------------------------
document.getElementById('openSheetButton').addEventListener('click', () => {
  document.getElementById('sheetConfigInput').click();
});
document.getElementById('sheetConfigInput').addEventListener('change', (event) => {
  const file = event.target.files[0];
  if (file) {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const config = JSON.parse(e.target.result);
        if (config.columnsConfig) {
          columnsConfig = config.columnsConfig;
          sheetData = [];
          renderSheet();
          sheetName =  file.name.replace(/\.json/g, "");
          document.title = sheetName;
          // Rebuild CSV file inputs
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

// ----------------------------------------------------------------------
// 6. Multiple CSV sources. Build file input for each source_name
// ----------------------------------------------------------------------
let sourceFileInputs = {};
let pendingFileReads = 0;

function setupSourceFileInputs() {
  // Clear out existing
  const dropdown = document.getElementById('fileDropdown');
  dropdown.querySelectorAll('.source-button').forEach(el => el.remove());
  sourceFileInputs = {};

  // Identify distinct sources from columnsConfig
  const sourceNames = [
    ...new Set(
      columnsConfig
        .filter(c => c.column_type === 'data' && c.data_type !== 'unique')
        .map(c => c.source_name)
    )
  ];  
  sourceNames.forEach(source => {
    // Create a dropdown button
    const btn = document.createElement('button');
    btn.className = 'dropdown-item source-button';
    btn.textContent = 'Open ' + source + ' CSV';
    btn.dataset.source = source;
    btn.addEventListener('click', () => {
      sourceFileInputs[source].click();
    });
    dropdown.appendChild(btn);

    // Create hidden file input
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.csv';
    input.multiple = true;
    input.style.display = 'none';
    input.dataset.source = source;
    input.addEventListener('change', (event) => {
      const files = event.target.files;
      for (let file of files) {
        pendingFileReads++;
        const reader = new FileReader();
        reader.onload = (e) => {
          parseCSVForSource(e.target.result, source);
          pendingFileReads--;
          if (pendingFileReads === 0) {
            processAllCSV(source);
          }
        };
        reader.readAsText(file);
      }
    });
    document.body.appendChild(input);
    sourceFileInputs[source] = input;
  });
}

// Load all CSV data for a given source, store in sheetData
function parseCSVForSource(text, source) {
  const lines = text.split(/\r?\n/).filter(line => line.trim() !== '');
  if (!lines.length) return;
  const headers = lines[0].split(',').map(h => h.trim());
  const newRows = lines.slice(1).map(line => {
    const values = line.split(',').map(v => v.trim());
    const row = {};
    headers.forEach((header, index) => {
      row[header] = values[index];
    });
    row.__source = source;
    return row;
  });
  sheetData = sheetData.concat(newRows);
}

// After all files loaded, map columns, recalc, render
function processAllCSV(source_name) {
  const sources = [...new Set(sheetData.map(r => r.__source))];
  sources.forEach(s => mapColumnsForSource(s));
  window.statistics = window.statistics || {};
  window.statistics[source_name] = computeStatistics(sheetData);
  console.log ('window.statistics', window.statistics)
  recalcSheet(source_name);
  renderSheet();
}

function computeStatistics(data) {
  const numericColumns = {};
  const dateColumns = {};
  const columnStatistics = {};

  data.forEach(item => {
    Object.keys(item).forEach(key => {
      const value = item[key];
      
      // If it's a string and looks like a date, classify it as a date.
      if (typeof value === 'string' && isDate(value)) {
        if (!dateColumns[key]) {
          dateColumns[key] = [];
        }
        dateColumns[key].push(value);
      } else {
        // Otherwise, try to parse it as a number.
        const num = parseFloat(value);
        if (!isNaN(num)) {
          if (!numericColumns[key]) {
            numericColumns[key] = [];
          }
          numericColumns[key].push(num);
        }
      }
    });
  });
  console.log('dateColumns', dateColumns)
  
  Object.keys(numericColumns).forEach(column => {
    const validValues = numericColumns[column].filter(value => value !== null && !isNaN(value));
    if (validValues.length > 0) {
      const { areaMode, nonzeroMin } = calculateAreaMode(validValues);
      columnStatistics[column] = {
        min: Math.min(...validValues),
        max: Math.max(...validValues),
        mean: mean(validValues),
        median: median(validValues),
        areaMode: areaMode, //focus is on the notion of ranges or areas, this name works well and is intuitive for the purpose of the function.
        nonzeroMin: nonzeroMin,
        variance: variance(validValues),
        stdDeviation: stdDeviation(validValues),
        twoStdDeviations: twoStdDeviations(validValues),
        threeStdDeviations: threeStdDeviations(validValues),
        sum: sum(validValues),
        count: validValues.length, 
        unique : uniqueValues(validValues)
      };
      columnStatistics[column].YTDfactor = yearToDateFactor(column);
      if (columnStatistics[column].unique > 4 && columnStatistics[column].unique <= 16  && parseInt(columnStatistics[column].median) < columnStatistics[column].unique-1 ) {
        columnStatistics[column].uniqueArray = [...new Set(validValues)];
        columnStatistics[column].convexProbability = createProbabilityArray(columnStatistics[column].mode, columnStatistics[column].unique, columnStatistics[column].uniqueArray);
      }
    }
  });
  return columnStatistics; 
}

// Map CSV headers to columns for a given source
function mapColumnsForSource(source) {
  sheetData.forEach(row => {
    if (row.__source === source) {
      columnsConfig.forEach(col => {
        if (col.column_type === 'data' && col.source_name === source) {
          if (!(col.id in row)) {
            // Attempt a case-insensitive match
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

// Initialize the file inputs from the default config
setupSourceFileInputs();

// ----------------------------------------------------------------------
// 7. Evaluate columns: function first, formula second. Now with date logic
// ----------------------------------------------------------------------
function recalcSheet(source) {
  const errorDisplay = document.getElementById('errorDisplay');
  errorDisplay.innerHTML = '';
  // First pass: function columns
  sheetData.forEach((row, rowIndex) => {
    columnsConfig.forEach(col => {
      if (col.column_type === 'function' && col.function) {
        const match = col.function.match(/^(\w+)\(([^)]*)\)$/);
        if (match) {
          const funcName = match[1];
          const argsStr = match[2];
          const args = argsStr.split(',').map(arg => arg.trim()).map(arg => parseFloat(row[arg]) || 0);
          if (window.functions && window.functions[funcName]) {
            try {
              args.push(source);
              row[col.id] = window.functions[funcName].implementation(...args);
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
  });

  // Second pass: formula columns (with date-handling)
  sheetData.forEach((row, rowIndex) => {
    columnsConfig.forEach(col => {
      if (col.column_type === 'formula' && col.formula) {
        let formulaStr = col.formula;
        //let allRefsPresent = true;
        columnsConfig.forEach(refCol => {
          const regex = new RegExp('\\b' + refCol.id + '\\b', 'g');
          let val = row[refCol.id];
          
          if (refCol.data_type === 'date') {
            if (val) {
              // Attempt to parse as date
              const dt = parseDate(val);
              if (dt) {
                // e.g. Maturity_Date => "DATE(2037-09-28)"
                val = `DATE(${dt.toISOString().substring(0,10)})`;
              } else {
                // Malformed date
                //allRefsPresent = false;
                val = 'DATE(Invalid)';
              }
            } else {
              // If it's missing entirely, treat as invalid
              //allRefsPresent = false;
              //val = 'DATE(Invalid)';
            }
          } else {
            // Non-date columns
            if (val == null) {
              // Missing numeric data => skip
              //allRefsPresent = false;
            } else {
              val = parseFloat(val) || 0;
            }
          }
          //if (allRefsPresent) {
            formulaStr = formulaStr.replace(regex, val);
          //}
        });

        // If not all references are present, skip evaluating for now
        //if (!allRefsPresent) {
        //  console.log('formulaStr', formulaStr)
        //  return;           
        //}

        try {
          row[col.id] = safeEvalFormula(formulaStr, col.data_type);
        } catch (err) {
          row[col.id] = null;
          /*
          errorDisplay.innerHTML += `<div class="error">
            Row ${rowIndex + 1}, column "${col.heading}": ${err.message}
          </div>`;
          */
        }
      }
    });
  });
}

// Convert date-like strings to Date objects
function parseDate(val) {
  if (val instanceof Date) return val;
  const dt = new Date(val);
  if (isNaN(dt.getTime())) return null;
  return dt;
}

// ----------------------------------------------------------------------
// 8. Grouping for Unique Column + Accordion
// ----------------------------------------------------------------------
function getUniqueColumn() {
  return columnsConfig.find(col => col.data_type === 'unique' && col.column_type === 'data');
}

function getColumnFilters() {
  return columnsConfig
    .filter(col => col.filter)
    .reduce((acc, col) => {
      // Create an object for the source_name if it doesn't exist
      if (!acc[col.source_name]) {
        acc[col.source_name] = {};
      }
      // Set the id as key with the filter as value
      acc[col.source_name][col.id] = col.filter;
      return acc;
    }, {});
}

// Create a condition function from a filter string, aware of the column's dataType (e.g., "date").
function createCondition(filterStr, dataType) {
  filterStr = filterStr.trim();

  // 1. Handle double-curly syntax, e.g. "{{20}}"
  if (filterStr.startsWith('{{') && filterStr.endsWith('}}')) {
    const inner = filterStr.slice(2, -2).trim();
    let cmpValue = inner;
    // Attempt to parse as number if numeric
    if (!isNaN(inner)) {
      cmpValue = Number(inner);
    } else if (
      (inner.startsWith("'") && inner.endsWith("'")) ||
      (inner.startsWith('"') && inner.endsWith('"'))
    ) {
      cmpValue = inner.slice(1, -1);
    }
    return value => value == cmpValue;
  }
  
  // 2. JSON array notation, e.g. "[20, 23, 25]"
  if (filterStr.startsWith('[') && filterStr.endsWith(']')) {
    try {
      const allowed = JSON.parse(filterStr);
      return rowValue => {
        // Attempt numeric comparison first
        const numericVal = Number(rowValue);
        if (!isNaN(numericVal)) {
          return allowed.some(item => Number(item) === numericVal);
        }
        // Otherwise, compare as strings
        return allowed.includes(rowValue);
      };
    } catch (e) {
      console.error('Error parsing JSON filter:', filterStr, e);
      return () => false;
    }
  }
  
  // 3. Comparison operators: support >, <, >=, <=, ==, !=
  const match = filterStr.match(/^(>=|<=|>|<|==|!=)\s*(.+)$/);
  if (match) {
    const operator = match[1];
    let cmpValue = match[2].trim();
    
    // Remove surrounding quotes if present
    if (
      (cmpValue.startsWith("'") && cmpValue.endsWith("'")) ||
      (cmpValue.startsWith('"') && cmpValue.endsWith('"'))
    ) {
      cmpValue = cmpValue.slice(1, -1);
    }
    
    // Return a function that applies this comparison to each row value
    return function(value) {
      // If this column is a date column, try date comparisons first
      if (dataType === 'date') {
        const cmpDate = new Date(cmpValue);
        const rowDate = new Date(value);
        
        if (!isNaN(cmpDate.getTime()) && !isNaN(rowDate.getTime())) {
          // Both parsed as valid dates => compare as dates
          switch (operator) {
            case '>':  return rowDate > cmpDate;
            case '<':  return rowDate < cmpDate;
            case '>=': return rowDate >= cmpDate;
            case '<=': return rowDate <= cmpDate;
            case '==': return rowDate.getTime() === cmpDate.getTime();
            case '!=': return rowDate.getTime() !== cmpDate.getTime();
          }
        }
        // If date parsing fails, fall back to numeric/string
      }
      
      // Attempt numeric comparison
      const numVal = Number(value);
      const cmpNum = Number(cmpValue);
      const lhs = isNaN(numVal) ? value : numVal;
      const rhs = isNaN(cmpNum) ? cmpValue : cmpNum;
      
      switch (operator) {
        case '>':  return lhs > rhs;
        case '<':  return lhs < rhs;
        case '>=': return lhs >= rhs;
        case '<=': return lhs <= rhs;
        case '==': return lhs == rhs; // loose equality
        case '!=': return lhs != rhs;
        default:   return false;
      }
    };
  }
  
  // 4. Fallback: literal equality
  let literal = filterStr;
  if (!isNaN(literal)) {
    literal = Number(literal);
  }
  return value => value == literal;
}

/**
 * Applies group-level filtering with "truth propagation" for double-curly filters.
 *
 * For each group (grouped by the unique column):
 *   - The group qualifies if, for every group-propagated filter, at least one row meets that filter.
 *   - From a qualified group, only rows that individually satisfy all row-level filters are returned.
 *
 * @param {Array<Object>} sheetData - Array of row objects.
 * @param {Array<Object>} columnsConfig - Array of column definitions.
 * @returns {Array<Object>} - Array of rows from qualified groups that pass the row-level filters.
 */
function applyGroupFilter(sheetData, columnsConfig) {
  // 1. Identify the "unique" column (grouping key).
  const uniqueCol = columnsConfig.find(col => col.data_type === 'unique');
  if (!uniqueCol) {
    console.error('No unique column defined in columnsConfig');
    return [];
  }
  const uniqueColId = uniqueCol.id;
  
  // 2. Build filter definitions:
  //    - groupFilters: those using the double-curly syntax => truth propagation
  //    - rowFilters: all other filters => must be met individually by each row
  const groupFilters = [];
  const rowFilters = [];
  columnsConfig.filter(col => col.filter).forEach(col => {
    // Pass col.data_type to createCondition for date logic
    const condition = createCondition(col.filter, col.data_type);
    const isGroup = col.filter.trim().startsWith('{{') && col.filter.trim().endsWith('}}');
    const filterDef = { id: col.id, condition, source: col.source_name || null };
    
    if (isGroup) {
      groupFilters.push(filterDef);
    } else {
      rowFilters.push(filterDef);
    }
  });
  
  // 3. Group rows by the unique column value.
  const groups = sheetData.reduce((acc, row) => {
    const key = row[uniqueColId];
    if (!acc[key]) {
      acc[key] = [];
    }
    acc[key].push(row);
    return acc;
  }, {});
  
  // 4. Determine which groups qualify by checking group-level filters.
  const qualifyingGroups = Object.values(groups).filter(group => {
    // For each filter in groupFilters, at least one row in this group must satisfy it
    return groupFilters.every(filterDef =>
      group.some(row => {
        if (filterDef.source && row.__source !== filterDef.source) {
          return false;
        }
        return filterDef.condition(row[filterDef.id]);
      })
    );
  });
  
  // 5. From each qualified group, only include rows that pass all row-level filters individually.
  const result = [];
  qualifyingGroups.forEach(group => {
    group.forEach(row => {
      const passesRow = rowFilters.every(filterDef => {
        if (filterDef.source && row.__source !== filterDef.source) {
          return true; // not applicable to this row
        }
        return filterDef.condition(row[filterDef.id]);
      });
      if (passesRow) {
        result.push(row);
      }
    });
  });
  
  return result;
}

// ----- Testing the logic -----

const columnsConfig2 = [
  { heading: 'Portfolio', id: 'portfolio', column_type: 'data', data_type: 'unique' },
  { heading: 'Principal', id: 'principal', column_type: 'data', data_type: 'currency', source_name: 'loan', filter: '> 100' },
  { heading: 'Loan Type', id: 'Type_Code', column_type: 'data', data_type: 'integer', source_name: 'loan', filter: '{{20}}' },
  { heading: 'Payment', id: 'Last_Payment', column_type: 'data', data_type: 'currency', source_name: 'loan' }
];

const sheetData2 = [
  // Group "A":
  // Row 1: passes both (150 > 100, Type_Code equals 20)
  { portfolio: "A", principal: "150", __source: "loan", Type_Code: "20", Last_Payment: "1000" },
  // Row 2: fails principal filter (50 is not > 100), should not be returned.
  { portfolio: "A", principal: "50",  __source: "loan", Type_Code: "20", Last_Payment: "1000" },
  // Row 3: passes principal filter (200 > 100) even though Type_Code is 15,
  // but group "A" qualifies because of row 1’s {{20}} condition.
  { portfolio: "A", principal: "200", __source: "loan", Type_Code: "15", Last_Payment: "2000" },
  // Group "C": Single row that passes both filters.
  { portfolio: "C", principal: "300", __source: "loan", Type_Code: "20", Last_Payment: "3000" }
];

const filteredRows = applyGroupFilter(sheetData2, columnsConfig2);
console.log('filteredRows 1', filteredRows);

/* Expected output:
[
  // From group "A": only rows that meet the row-level filter (principal > 100):
  { portfolio: "A", principal: "150", __source: "loan", Type_Code: "20", Last_Payment: "1000" },
  { portfolio: "A", principal: "200", __source: "loan", Type_Code: "15", Last_Payment: "2000" },
  // From group "C":
  { portfolio: "C", principal: "300", __source: "loan", Type_Code: "20", Last_Payment: "3000" }
]
*/



function groupRowsByUnique() {
  const uniqueCol = getUniqueColumn();
  const columnFilters = getColumnFilters();
  console.log('columnFilters', columnFilters)
  console.log('sheetData', sheetData)

  if (!uniqueCol) {
    return sheetData.map(r => ({ combined: r, subRows: [] }));
  }
  const groups = {};

  const filteredRows = applyGroupFilter(sheetData, columnsConfig);
  console.log('filteredRows 2', filteredRows);

  filteredRows.forEach(row => {
    const key = row[uniqueCol.id];
    if (!groups[key]) groups[key] = [];
    groups[key].push(row);
  });
  const grouped = [];
  for (const key in groups) {
    const arr = groups[key];
    if (arr.length === 1) {
      grouped.push({ combined: arr[0], subRows: [] });
    } else {
      grouped.push({ combined: combineRows(arr), subRows: arr });
    }
  }
  return grouped;
}

// Combine duplicates by summation, average, mode, etc.
function combineRows(rows) {
  const combined = {};
  columnsConfig.forEach(col => {
    const vals = rows.map(r => r[col.id]);
    switch (col.data_type) {
      case 'unique':
        combined[col.id] = vals[0];
        break;
      case 'currency':
      case 'float':
        combined[col.id] = vals.reduce((sum, v) => sum + (parseFloat(v) || 0), 0);
        break;
      case 'rate':
        const nums = vals.map(v => parseFloat(v)).filter(x => !isNaN(x));
        combined[col.id] = nums.length ? (nums.reduce((a,b) => a+b, 0) / nums.length) : 0;
        break;
      case 'integer':
        const arr = vals.map(v => parseInt(v)).filter(x => !isNaN(x));
        combined[col.id] = mode(arr);
        break;
      case 'strings':
        combined[col.id] = vals.join(', ');
        break;
      default:
        combined[col.id] = vals[0];
    }
  });
  return combined;
}

function mode(arr) {
  if (!arr.length) return null;
  const freq = {};
  let maxCount=0, modeVal=null;
  arr.forEach(x => {
    freq[x] = (freq[x]||0) +1;
    if (freq[x]>maxCount) {
      maxCount=freq[x];
      modeVal=x;
    }
  });
  return modeVal;
}

// ----------------------------------------------------------------------
// 9. Totals row
// ----------------------------------------------------------------------
function computeTotals(sheet) {
  const totals = {};
  // Initialize
  columnsConfig.forEach(col => {
    switch(col.data_type) {
      case 'currency':
      case 'float':
        totals[col.id] = 0;
        break;
      case 'rate':
        totals[col.id] = { sum:0, count:0 };
        break;
      case 'integer':
        totals[col.id] = [];
        break;
      default:
        totals[col.id] = '';
    }
  });
  // Summation pass
  sheet.forEach(row => {
    columnsConfig.forEach(col => {
      let val = row[col.id];
      switch(col.data_type) {
        case 'currency':
        case 'float':
          totals[col.id]+= parseFloat(val) || 0;
          break;
        case 'rate':
          const n = parseFloat(val);
          if (!isNaN(n)) {
            totals[col.id].sum+=n; 
            totals[col.id].count++;
          }
          break;
        case 'integer':
          const i = parseInt(val);
          if (!isNaN(i)) totals[col.id].push(i);
          break;
        default:
          // do nothing
      }
    });
  });
  // Post-process
  columnsConfig.forEach(col => {
    if (col.data_type==='rate') {
      totals[col.id] = (totals[col.id].count)
        ? totals[col.id].sum / totals[col.id].count
        : '';
    } else if (col.data_type==='integer') {
      totals[col.id] = totals[col.id].length ? mode(totals[col.id]) : '';
    }
  });
  return totals;
}

// ----------------------------------------------------------------------
// 10. Render Sheet
// ----------------------------------------------------------------------
function renderSheet() {
  const table = document.getElementById('spreadsheet');
  let html = '';

  // Header with row numbers
  html += '<thead><tr><th>Row</th>';
  columnsConfig.forEach(col => {
    html += `<th>${col.heading}</th>`;
    if (col.filter) console.log ('filter', col.filter, col.id)
  });
  html += '</tr></thead>';

  const groupedRows = groupRowsByUnique();
  console.log('groupedRows', groupedRows)
  let rowNumber = 1;

  groupedRows.forEach((g, idx) => {
    const hasSub = g.subRows && g.subRows.length > 0;
    html += `<tr class="combined-row ${hasSub ? 'accordion':''}" data-index="${idx}">`;
    html += `<td>${rowNumber++}</td>`;
    columnsConfig.forEach(col => {
      const rawVal = (g.combined[col.id] !== undefined) ? g.combined[col.id] : '';
      html += `<td>${formatValue(rawVal, col.data_type)}</td>`;
    });
    html += '</tr>';

    if (hasSub) {
      html += `<tr class="sub-rows" data-parent-index="${idx}" style="display:none;"><td colspan="${columnsConfig.length+1}">`;
      html += '<table class="sub-table">';
      html += '<tr><th>Row</th>';
      columnsConfig.forEach(col => {
        html += `<th>${col.heading}</th>`;
      });
      html += '</tr>';
      let subNumber = 1;
      g.subRows.forEach(row => {
        html += '<tr>';
        html += `<td>${rowNumber-1}.${subNumber++}</td>`;
        columnsConfig.forEach(col => {
          const rawVal = (row[col.id] !== undefined) ? row[col.id] : '';
          html += `<td>${formatValue(rawVal, col.data_type)}</td>`;
        });
        html += '</tr>';
      });
      html += '</table></td></tr>';
    }
  });

  // Totals row
  const tierOneRows = groupedRows.map(row => row.combined);
  const totals = computeTotals(tierOneRows);
  html += '<tr class="totals-row"><td></td>';
  columnsConfig.forEach(col => {
    html += `<td>${formatValue(totals[col.id], col.data_type)}</td>`;
  });
  html += '</tr>';

  table.innerHTML=html;

  // Accordion toggles
  document.querySelectorAll('.combined-row.accordion').forEach(row => {
    row.addEventListener('click', () => {
      const idx=row.getAttribute('data-index');
      const sub=document.querySelector(`.sub-rows[data-parent-index="${idx}"]`);
      sub.style.display=(sub.style.display==='none')?'table-row':'none';
    });
  });
}

// ----------------------------------------------------------------------
// 11. "New Sheet" & "Edit Sheet" Modal logic
// (We store user-defined source names for potential autocompletion.)
// ----------------------------------------------------------------------
let rememberedSourceNames = new Set();
let lastLoadedCsvHeaders = [];

const newSheetButton       = document.getElementById('newSheetButton');
const editSheetButton      = document.getElementById('editSheetButton');
const newSheetModal        = document.getElementById('newSheetModal');
const closeModal           = document.getElementById('closeModal');
const addColumnButton      = document.getElementById('addColumnButton');
const columnsContainer     = document.getElementById('columnsContainer');
const saveNewSheetButton   = document.getElementById('saveNewSheetButton');
const newSheetNameInput    = document.getElementById('newSheetName');
const modalTitle           = document.getElementById('modalTitle');
const csvHeadersInput      = document.getElementById('csvHeadersInput');
const csvHeadersNotice     = document.getElementById('csvHeadersNotice');

// If user picks a CSV just to see its headers in the modal
csvHeadersInput.addEventListener('change',(e)=>{
  const file=e.target.files[0];
  if (!file) return;
  const r=new FileReader();
  r.onload=(evt)=>{
    const lines=evt.target.result.split(/\r?\n/).filter(x=>x.trim()!=='');
    if (lines.length>0){
      const hdrs=lines[0].split(',').map(x=>x.trim());
      lastLoadedCsvHeaders=hdrs;
      csvHeadersNotice.textContent='Headers loaded: '+hdrs.join(', ');
    }
  };
  r.readAsText(file);
});

// Show "New" modal
newSheetButton.addEventListener('click', () => {
  showModal('New Sheet');
});

// Show "Edit" modal
editSheetButton.addEventListener('click', () => {
  showModal('Edit Sheet', columnsConfig, getSheetNameFromConfig());
});

closeModal.addEventListener('click', () => {
  newSheetModal.style.display='none';
});

addColumnButton.addEventListener('click', () => {
  columnsContainer.appendChild(createColumnEditor({}));
});

// Returns a default or existing name
function getSheetNameFromConfig() {
  // Could store config name in local storage; here we just guess a name
  return 'EditedSheet';
}

function showModal(mode, existingColumns, sheetName) {
  newSheetModal.style.display='block';
  modalTitle.textContent=mode;
  columnsContainer.innerHTML='';
  newSheetNameInput.value=sheetName||'';

  if (mode==='New Sheet') {
    columnsContainer.appendChild(createColumnEditor({}));
  } else {
    (existingColumns||[]).forEach(col=>{
      columnsContainer.appendChild(createColumnEditor(col));
      if (col.source_name) rememberedSourceNames.add(col.source_name);
    });
  }
}

// Builds an individual column editor
function createColumnEditor(initialData) {
  if (!initialData) initialData={};

  const container=document.createElement('div');
  container.className='column-editor';
  container.innerHTML=`
    <div class="editor-row">
      <label>Heading</label>
      <input type="text" class="col-heading" value="${initialData.heading||''}"/>
    </div>
    <div class="editor-row">
      <label>Type</label>
      <select class="col-type">
        <option value="data">data</option>
        <option value="function">function</option>
        <option value="formula">formula</option>
      </select>
    </div>
    <div class="editor-row">
      <label>Data&nbsp;Type</label>
      <select class="data-type">
        <option value="unique">unique</option>
        <option value="currency">currency</option>
        <option value="rate">rate</option>
        <option value="float">float</option>
        <option value="integer">integer</option>
        <option value="strings">strings</option>
        <option value="date">date</option>
      </select>
    </div>
    <div class="editor-row data-options" style="display:none;">
      <label>Source</label>
      <input type="text" class="source-name" list="sourceNamesList" placeholder="Source Name"/>
    </div>
    <div class="editor-row data-options" style="display:none;">
      <label>CSV&nbsp;ID</label>
      <select class="csv-id-select">
        <option value="">(No headers loaded)</option>
      </select>
    </div>
    <div class="editor-row function-options" style="display:none;">
      <label>Function</label>
      <div contenteditable="true" class="function-input"></div>
    </div>
    <div class="editor-row formula-options" style="display:none;">
      <label>Formula</label>
      <div contenteditable="true" class="formula-input"></div>
    </div>
    <div class="column-controls">
      <span class="icon move-left" title="Move Left">&#9664;</span>
      <span class="icon move-right" title="Move Right">&#9654;</span>
      <span class="icon remove" title="Remove Column">&#10006;</span>
    </div>
  `;

  const headingInput=container.querySelector('.col-heading');
  const colTypeSelect=container.querySelector('.col-type');
  const dataTypeSelect=container.querySelector('.data-type');
  const sourceNameInput=container.querySelector('.source-name');
  const csvIdSelect=container.querySelector('.csv-id-select');
  const funcInput=container.querySelector('.function-input');
  const formulaInput=container.querySelector('.formula-input');

  // Initialize from existing data
  if (initialData.column_type) colTypeSelect.value=initialData.column_type;
  if (initialData.data_type) dataTypeSelect.value=initialData.data_type;
  if (initialData.column_type==='data') {
    sourceNameInput.value=initialData.source_name||'';
  }
  if (initialData.column_type==='function' && initialData.function) {
    funcInput.textContent=initialData.function;
  }
  if (initialData.column_type==='formula' && initialData.formula) {
    formulaInput.textContent=initialData.formula;
  }

  // Build CSV ID <select>
  if (lastLoadedCsvHeaders.length>0) {
    csvIdSelect.innerHTML=lastLoadedCsvHeaders.map(h=>`<option value="${escapeHtml(h)}">${escapeHtml(h)}</option>`).join('');
    if (initialData.id && lastLoadedCsvHeaders.includes(initialData.id)) {
      csvIdSelect.value=initialData.id;
    } else {
      // Option to leave blank
      const optBlank=document.createElement('option');
      optBlank.value='';
      optBlank.textContent='(None)';
      csvIdSelect.insertBefore(optBlank, csvIdSelect.firstChild);
      csvIdSelect.value='';
    }
  } else {
    // If user had an ID set, add it
    if (initialData.id) {
      const opt=document.createElement('option');
      opt.value=initialData.id;
      opt.textContent=initialData.id;
      csvIdSelect.appendChild(opt);
      csvIdSelect.value=initialData.id;
    }
  }

  function updateExtraFields(){
    const t=colTypeSelect.value;
    container.querySelectorAll('.data-options').forEach(n=>n.style.display=(t==='data'?'flex':'none'));
    container.querySelector('.function-options').style.display=(t==='function'?'flex':'none');
    container.querySelector('.formula-options').style.display=(t==='formula'?'flex':'none');
  }
  colTypeSelect.addEventListener('change',updateExtraFields);
  updateExtraFields();

  // Move left
  container.querySelector('.move-left').addEventListener('click',()=>{
    if (container.previousElementSibling){
      columnsContainer.insertBefore(container, container.previousElementSibling);
    }
  });
  // Move right
  container.querySelector('.move-right').addEventListener('click',()=>{
    if (container.nextElementSibling){
      columnsContainer.insertBefore(container.nextElementSibling, container);
    }
  });
  // Remove
  container.querySelector('.remove').addEventListener('click',()=>{
    container.remove();
  });

  return container;
}

function escapeHtml(str){
  return str.replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

// Save new or edited config
saveNewSheetButton.addEventListener('click', ()=>{
  const newColumns=[];
  const editors=columnsContainer.querySelectorAll('.column-editor');
  editors.forEach(ed=>{
    const heading=ed.querySelector('.col-heading').value.trim();
    const column_type=ed.querySelector('.col-type').value;
    const data_type=ed.querySelector('.data-type').value;
    const sourceName=ed.querySelector('.source-name');
    const csvIdSel=ed.querySelector('.csv-id-select');
    const func=ed.querySelector('.function-input');
    const formula=ed.querySelector('.formula-input');

    let col={ heading, column_type, data_type };
    col.id=heading.toLowerCase().replace(/\s+/g,'');

    if (column_type==='data'){
      col.source_name=(sourceName?sourceName.value.trim():'');
      rememberedSourceNames.add(col.source_name);
      col.id=csvIdSel.value.trim()||col.id;
    } else if (column_type==='function'){
      col.function=(func?func.innerText.trim():'');
    } else if (column_type==='formula'){
      col.formula=(formula?formula.innerText.trim():'');
    }
    newColumns.push(col);
  });

  const sheetName=newSheetNameInput.value.trim()||'NewSheet';
  const newConfig={ sheetName, columnsConfig:newColumns };

  // Download JSON file
  const blob=new Blob([JSON.stringify(newConfig,null,2)],{type:'application/json'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');
  a.href=url;
  a.download=sheetName.replace(/\s+/g,'_')+'.json';
  a.click();
  URL.revokeObjectURL(url);

  // Update in memory
  columnsConfig=newColumns;
  newSheetModal.style.display='none';
  alert('New sheet configuration saved. You can now load CSV sources.');
  setupSourceFileInputs();
});

function exportTableToCSV(tableID, filename = sheetName) {
  var csv = [];
  // Get all rows within the designated table
  var allRows = document.querySelectorAll("table#" + tableID + " tr");
  
  allRows.forEach(function(currentRow) {
    // Check if the row belongs directly to the main table
    if (currentRow.closest("table").id !== tableID) {
      return; // Skip rows that belong to nested tables
    }
    // Skip rows with the "sub-rows" class
    if (currentRow.classList.contains("sub-rows")) {
      return;
    }
    
    var row = [];
    var cols = currentRow.querySelectorAll("td, th");
    cols.forEach(function(col, colIndex) {
      // Skip the first column (colIndex === 0)
      if (colIndex === 0) return;
      // Clone the cell to avoid modifying the original table
      var cellClone = col.cloneNode(true);
      // Remove any nested tables from the cloned cell
      var nestedTables = cellClone.querySelectorAll('table');
      nestedTables.forEach(function(nestedTable) {
        nestedTable.parentNode.removeChild(nestedTable);
      });
      // Clean and wrap the cell text
      var cellText = cellClone.innerText.trim();
      row.push('"' + cellText + '"');
    });
    csv.push(row.join(","));
  });
  
  // Create a Blob and download link for the CSV file
  var csvFile = new Blob([csv.join("\n")], { type: "text/csv" });
  var downloadLink = document.createElement("a");
  downloadLink.download = filename;
  downloadLink.href = window.URL.createObjectURL(csvFile);
  downloadLink.style.display = "none";
  
  document.body.appendChild(downloadLink);
  downloadLink.click();
  document.body.removeChild(downloadLink);
}
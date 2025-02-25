// ai.js
// Framing for more advanced AI

// Synonym library to map common synonym goups
// vocabulary set for banking-related Natural Language Processing
const synonymsDataset = [
  // Expanded existing entries
  ['fee', 'charge', 'cost', 'duty', 'collection', 'levy', 'assessment', 'imposition', 'surcharge', 'service fee', 'commission', 'toll', 'premium', 'tariff'],
  ['open', 'term', 'origination', 'start', 'create', 'establish', 'setup', 'initiate', 'commence', 'activate', 'launch', 'inception', 'beginning', 'provenance'],
  ['checking', 'dda', 'demand deposit', 'share', 'current account', 'transaction account', 'share draft'],
  ['savings', 'money market', 'thrift', 'deposit account', 'share savings'],
  ['withdrawal', 'check', 'draft', 'debit', 'payout', 'disbursement', 'deduction', 'cash out'],
  ['deposit', 'credit', 'payment', 'fund', 'lodge', 'add funds', 'contribution'],
  ['certificate', 'cd', 'cod', 'certificate of deposit', 'time deposit', 'term deposit', 'fixed deposit'],
  ['owner', 'responsibility', 'officer', 'holder', 'proprietor', 'account holder', 'signatory'],
  ['type', 'classification', 'class', 'category', 'kind', 'variety'],
  ['location', 'branch', 'office', 'site', 'outlet', 'region'],
  ['principal', 'balance', 'outstanding', 'capital', 'remaining amount', 'unpaid portion'],
  ['balance', 'funds on deposit', 'available funds', 'funds'],

  // New groups
  ['interest', 'finance charge', 'rate', 'accrued interest', 'return', 'yield'],
  ['loan', 'credit facility', 'mortgage', 'financing', 'advance', 'lending'],
  ['account', 'bank account', 'ledger', 'record', 'customer account'],
  ['statement', 'bank statement', 'account statement', 'summary', 'transaction record'],
  ['overdraft', 'negative balance', 'overdrawn account', 'shortfall', 'deficit'],
  ['wire transfer', 'electronic funds transfer', 'EFT', 'bank wire', 'remittance', 'telegraphic transfer', 'wires']
];


function stem(word) {
  // Convert to lowercase
  word = word.toLowerCase();
  
  // ---- (A) Check irregulars / lemma overrides ----
  const irregulars = {
    'running': 'run',
    'ran': 'run',
    'swimming': 'swim',
    'swam': 'swim',
    'taking': 'take',
    'took': 'take',
    'gone': 'go',
    'went': 'go',
    'being': 'be',
    'was': 'be',
    'were': 'be',
    'having': 'have',
    'had': 'have',
    'fees': 'fee',
    'responsibility': 'resp'
  };

  if (irregulars[word]) {
    return irregulars[word];
  }
  
  // ---- (B) Measure function ----
  // If you need more precise 'y' handling, consider
  // a more thorough approach. This is a simplified version.
  function measure(st) {
    return (st
      .replace(/[^aeiouy]+/g, 'C')
      .replace(/[aeiouy]+/g, 'V')
      .match(/VC/g) || []).length;
  }
  
  // Check if a string has a vowel
  function hasVowel(st) {
    return /[aeiouy]/.test(st);
  }

  // ---- (C) Early Exit for very short words ----
  if (word.length <= 2) {
    return word; // Stemming very short words often doesn't help
  }
  
  // ---- Step 1a: Plural S endings ----
  //  (i)  sses -> ss
  //  (ii) ies  -> i   (but some versions turn to "y" if measure>0)
  //  (iii) ss   -> ss (do nothing)
  //  (iv) s    -> (remove if there's a vowel before it)
  if (word.endsWith('sses')) {
    word = word.slice(0, -2); // "sses" -> "ss"
  } else if (word.endsWith('ies')) {
    word = word.slice(0, -3) + 'i'; // "ponies" -> "poni", "ties" -> "ti"
  } else if (word.endsWith('ss')) {
    // do nothing, "ss" stays
  } else if (word.endsWith('s')) {
    // remove the final 's' if there's a vowel somewhere before it
    let stem = word.slice(0, -1);
    if (hasVowel(stem)) {
      word = stem;
    }
  }

  // ---- Step 1b: Past tense / Gerund: -ed / -ing ----
  // Only remove if there's a vowel in the stem
  if (word.endsWith('ed')) {
    let stem = word.slice(0, -2);
    if (hasVowel(stem)) {
      word = stem;
      // After removing, handle some special endings:
      // e.g., "at"->"ate", "bl"->"ble", "iz"->"ize", or double consonant reduction
      if (word.endsWith('at') || word.endsWith('bl') || word.endsWith('iz')) {
        word += 'e';
      } else if (/(.)\1$/.test(word)) {
        // e.g. "hop" + "pp" -> "hopp" -> "hop"
        word = word.slice(0, -1);
      } else if (measure(word) === 1 && /^.*[^aeiou][aeiouy][^aeiouy]$/.test(word)) {
        // cvc where second c is not w,x,y => add "e"
        word += 'e';
      }
    }
  } else if (word.endsWith('ing')) {
    let stem = word.slice(0, -3);
    if (hasVowel(stem)) {
      word = stem;
      // same post-processing
      if (word.endsWith('at') || word.endsWith('bl') || word.endsWith('iz')) {
        word += 'e';
      } else if (/(.)\1$/.test(word)) {
        word = word.slice(0, -1);
      } else if (measure(word) === 1 && /^.*[^aeiou][aeiouy][^aeiouy]$/.test(word)) {
        word += 'e';
      }
    }
  }

  // ---- Step 1c: Turn final "y" -> "i" if there's a vowel in the stem
  if (word.endsWith('y')) {
    let stem = word.slice(0, -1);
    if (hasVowel(stem)) {
      word = stem + 'i';
    }
  }

  // ---- Step 2: Larger suffix replacements (measure(stem) > 0) ----
  //   Some examples from standard Porter:
  const step2Replacements = {
    'ational': 'ate',
    'tional': 'tion',
    'enci': 'ence',
    'anci': 'ance',
    'izer': 'ize',
    'bli': 'ble',
    'alli': 'al',
    'entli': 'ent',
    'eli': 'e',
    'ousli': 'ous',
    'ization': 'ize',
    'ation': 'ate',
    'ator': 'ate',
    'alism': 'al',
    'iveness': 'ive',
    'fulness': 'ful',
    'ousness': 'ous',
    'aliti': 'al',
    'iviti': 'ive',
    'biliti': 'ble',
    'logi': 'log'
  };

  for (let [suffix, replacement] of Object.entries(step2Replacements)) {
    if (word.endsWith(suffix)) {
      let stem = word.slice(0, -suffix.length);
      if (measure(stem) > 0) {
        word = stem + replacement;
      }
      break;
    }
  }

  // ---- Step 3: Some further suffixes (measure(stem) > 0) ----
  //  e.g., "icate" -> "ic", "ative" -> "", "alize" -> "al", etc.
  const step3Replacements = {
    'icate': 'ic',
    'ative': '',
    'alize': 'al',
    'iciti': 'ic',
    'ical': 'ic',
    'ful': '',
    'ness': ''
  };
  for (let [suffix, replacement] of Object.entries(step3Replacements)) {
    if (word.endsWith(suffix)) {
      let stem = word.slice(0, -suffix.length);
      if (measure(stem) > 0) {
        word = stem + replacement;
      }
      break;
    }
  }

  // ---- Step 4: Even more suffix chopping if measure(stem) > 1 ----
  //  E.g., "al", "ance", "ence", "er", "ic", "able", "ible", "ant", ...
  //  For brevity, let’s just do a few
  const step4Suffixes = [
    'al', 'ance', 'ence', 'er', 'ic', 'able', 'ible', 'ant',
    'ement', 'ment', 'ent', 'ou', 'ism', 'ate', 'iti', 'ous', 'ive', 'ize'
  ];
  for (let suffix of step4Suffixes) {
    if (word.endsWith(suffix)) {
      let stem = word.slice(0, -suffix.length);
      if (measure(stem) > 1) {
        word = stem;
      }
      break;
    }
  }

  // ---- Step 5: Final tidy ups ----
  // Remove a trailing "e" if measure(stem) > 1,
  // or if measure(stem) = 1 but NOT cvc
  if (word.endsWith('e')) {
    let stem = word.slice(0, -1);
    let m = measure(stem);
    if (m > 1 || (m === 1 && !/^.*[^aeiou][aeiouy][^aeiouy]$/.test(stem))) {
      word = stem;
    }
  }

  // If measure(word) > 1 and it ends with "ll", remove one "l"
  if (measure(word) > 1 && word.endsWith('ll')) {
      word = word.slice(0, -1);
  }
  return word;
}  

function aiTranslator(headers, field, strict=false) {
  let cleanField;
  // Check if the field contains a dot, indicating it's in the '{source}.{function or object}' format
  if (field.includes('.')) {
    // Extract everything after the dot
    cleanField = field.split('.')[1];
  } else {
    // Otherwise, keep the field as it is
    cleanField = field;
  }

  // Remove any special characters and trim whitespace
  cleanField = cleanField.replace(/[^a-zA-Z0-9]/g, '').trim();

  const headersLower = headers.map(h => h.toLowerCase());
  const stemmedField = stem(cleanField.toLowerCase());

  // 1) Try to find a direct match (substring) in headers
  let matchIndex = headersLower.findIndex(header => header.includes(stemmedField));
  if (matchIndex !== -1) {
    return headers[matchIndex];
  }

  if (!strict) {
    // 2) If no direct match and not strict, check the synonym library
    // Use a for-of loop (or .some() ) so we can break out early once we find a match
    for (const dataset of synonymsDataset) {
      // Optionally, this mapping could be precomputed if synonymsDataset is large
      const synonyms = dataset.map(synonym => stem(synonym));
      // Only check synonyms that match the field
      if (synonyms.includes(stemmedField)) {
        // Now find a header that includes ANY of those synonyms
        matchIndex = headersLower.findIndex(headerLower =>
          synonyms.some(synonym => headerLower.includes(synonym))
        );
        if (matchIndex !== -1) {
          return headers[matchIndex];
        }
      }
    } 
  }

  // 3) If we exhaust synonymsDataset with no match, return null
  return null;
}

// Helper function to check if a value is a valid date
function isDate(value) {
  // 1) Must be a string
  if (typeof value !== 'string') return false;

  // 2) Strip quotes/whitespace
  const stripped = value.trim().replace(/^['"]|['"]$/g, '');
  
  // 3) Strictly allow only certain date formats:
  //    (Adjust these as needed, but here we show 2 common ones.)
  const datePatterns = [
    // "YYYY-MM-DD" e.g. "2023-08-29"
    /^\d{4}-\d{2}-\d{2}$/,
    // "MM/DD/YYYY" e.g. "08/29/2023"
    /^\d{1,2}\/\d{1,2}\/\d{4}$/,
    /^\d{4}\/\d{2}\/\d{2}$/
  ];
  
  // 4) If it doesn’t match any allowed pattern, return false
  const matches = datePatterns.some(pattern => pattern.test(stripped));
  if (!matches) {
    return false;
  }
  
  // 5) If it matches the pattern, parse and confirm it's valid
  const dateObj = new Date(stripped);
  return !isNaN(dateObj.getTime());
}

// Helper functions for computing statistics (as previously defined)
function mean(values) {
  return sum(values) / values.length;
}

function median(values) {
  values.sort((a, b) => a - b);
  const mid = Math.floor(values.length / 2);
  return values.length % 2 !== 0 ? values[mid] : (values[mid - 1] + values[mid]) / 2;
}


function calculateAreaMode(values) {
  if (!values || values.length === 0) {
    return { mode: null, min: null };
  }

  const min = Math.min(...values.filter(value => value > 0));
  const roundingFactor = Math.pow(10, Math.floor(Math.log10(min)));

  const frequencyMap = {};
  let maxFreq = 0;
  let mode = [];

  values.forEach(value => {
    const roundedValue = Math.round(value / roundingFactor) * roundingFactor;
    frequencyMap[roundedValue] = (frequencyMap[roundedValue] || 0) + 1;
    if (frequencyMap[roundedValue] > maxFreq) {
      maxFreq = frequencyMap[roundedValue];
    }
  });

  for (const key in frequencyMap) {
    if (frequencyMap[key] === maxFreq) {
      mode.push(Number(key));
    }
  }

  return {
    areaMode: mode.length === 1 ? mode[0] : mode,
    nonzeroMin: min
  };
}

function mode(values) {
  const frequencyMap = {};
  let maxFreq = 0;
  let mode = [];

  // Create a frequency map
  values.forEach(value => {
    if (frequencyMap[value]) {
      frequencyMap[value]++;
    } else {
      frequencyMap[value] = 1;
    }
    if (frequencyMap[value] > maxFreq) {
      maxFreq = frequencyMap[value];
    }
  });

  // Find the mode(s)
  for (const key in frequencyMap) {
    if (frequencyMap[key] === maxFreq) {
      mode.push(Number(key));
    }
  }

  // If there's a single mode, return it, otherwise return an array of modes
  return mode.length === 1 ? mode[0] : mode;
}

function variance(values) {
  const m = mean(values);
  return mean(values.map(v => (v - m) ** 2));
}

function stdDeviation(values) {
  return Math.sqrt(variance(values));
}

function sum(values) {
  return values.reduce((acc, val) => acc + val, 0);
}

function uniqueValues(values) {
  const uniqueValues = new Set(values);
  return uniqueValues.size
}

// Function to calculate the range for two standard deviations
function twoStdDeviations(values) {
  const m = mean(values);
  const sd = stdDeviation(values);
  return [m - 2 * sd, m + 2 * sd];
}

// Function to calculate the range for three standard deviations
function threeStdDeviations(values) {
  const m = mean(values);
  const sd = stdDeviation(values);
  return [m - 3 * sd, m + 3 * sd];
}

function oldestDate(dates) {
  // Find the smallest timestamp
  const oldestTimestamp = Math.min(...dates.map(d => d.getTime()));
  return new Date(oldestTimestamp);
}

function allDatesUnique(dates) {
  // Convert each Date object to its numeric timestamp
  const timestamps = dates.map(date => date.getTime());
  // A Set of timestamps will have the same size as the array length only if all are unique
  return new Set(timestamps).size === dates.length;
}


function createProbabilityArray(mode, unique, uniqueArray) {
  //unique is quantity of unique values in a column, and uniqueArray contains all unique values
  /* Convexity in Risk Model applied here refers to the situation where the rate of probability becomes steeper as the value increases. 
  In other words, the relationship between value and probability is convex, 
  meaning that beyond the mode (value that appears most frequently in a data set which is the tipping point) small increases in value can lead to disproportionately large increases in the likelihood of an event (i.e., a loss).
  */
  mode = parseInt(mode);
  // Function to interpolate between two values over a number of steps
  function interpolate(startValue, endValue, steps) {
      const stepValue = (endValue - startValue) / (steps - 1);  
      const values = [];
      for (let i = 0; i < steps; i++) {
          values.push(startValue + i * stepValue);
      }
      return values;
  }
  // Generate arrays with the specified unique size
  let probabilityArray = [];
  // Interpolate between probabilityArray[0] and probabilityArray[median-1]
  const firstSegment = interpolate(0, 1, mode);
  // Interpolate between probabilityArray[median] and probabilityArray[unique-1]
  const secondSegment = interpolate(5, 100, unique - mode);
  console.log(`median: ${mode}, unique: ${unique}, firstSegment: ${firstSegment}, secondSegment : ${secondSegment}`)

  // Assign values to the first probability array
  for (let i = 0; i < firstSegment.length; i++) {
      probabilityArray[`'${uniqueArray[i]}'`] = parseFloat(firstSegment[i].toFixed(2));
  }
  for (let i = 0; i < secondSegment.length; i++) {
      probabilityArray[`'${uniqueArray[mode + i]}'`] = parseFloat(secondSegment[i].toFixed(2));
  }
  return probabilityArray;
}

function yearToDateFactor(fieldName) {
  let factor = 1; // default to 1
  const lowerStr = fieldName.toLowerCase();
  if (lowerStr.includes("mtd")) {
    factor = 12;
  } else if (lowerStr.includes("day") || lowerStr.includes("daily")) {
    factor = 365
  }
  return factor;
} 

// Helper function to convert values like "3W" to a numeric value (e.g., 3.5)
function convertToNumeric(value) {
    if (value === null) return null; // Return null for null values
    if (typeof value === 'string') {
      value = value.trim(); // Trim leading and trailing spaces if it's a string
      if (value.toLowerCase() === 'null') return null; // Return null for 'NULL' strings
      if (/^\d/.test(value)) {
        const numericPart = parseFloat(value.match(/^\d+/)[0]);
        return numericPart + (value.length === 1 ? 0 : 0.5); // Add .5 if the string contains a letter after the digit
      }
    }
    if (!isNaN(value)) return parseFloat(value); // Directly return numeric values
    return null; // Return null for non-numeric values
  }
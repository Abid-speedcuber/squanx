// ========================================
// Square-1 Scramble Normalizer Module
// Handles all normalization logic in one place
// ========================================

/**
 * Main executive function - normalizes any scramble input
 * @param {string} input - Raw scramble input
 * @returns {string} Normalized scramble
 */
function normalizeScramble(input) {
    if (!input) return '';
    
    // First, check if input has variables
    const hasVars = checkForVariables(input);
    
    if (hasVars) {
        // Expand variables recursively
        const expanded = expandVariablesRecursive(input);
        // Then normalize the expanded result
        return normalizeScrambleFormat(expanded);
    } else {
        // No variables, just normalize the format
        return normalizeScrambleFormat(input);
    }
}

/**
 * Check if input contains variable syntax
 * @param {string} input - Input string to check
 * @returns {boolean} True if variables exist
 */
function checkForVariables(input) {
    if (!input) return false;
    
    // Check for *varName* or <varName> patterns
    const asteriskPattern = /\*\w+\*/;
    const anglePattern = /<\w+>/;
    
    return asteriskPattern.test(input) || anglePattern.test(input);
}

/**
 * Recursively expand variables until none remain
 * @param {string} input - Input with variables
 * @param {number} depth - Recursion depth (safety limit)
 * @returns {string} Fully expanded string
 */
function expandVariablesRecursive(input, variableTable = null, depth = 0) {
    // Safety limit to prevent infinite loops
    if (depth > 10) {
        console.warn('Variable expansion depth limit reached');
        return input;
    }
    
    // Expand one level
    const expanded = expandVariablesOneLevel(input, variableTable);
    
    // Check if result still has variables
    if (checkForVariables(expanded)) {
        // Recursively expand again
        return expandVariablesRecursive(expanded, variableTable, depth + 1);
    }
    
    return expanded;
}

/**
 * Expand variables by ONE level only (dumb replacement)
 * @param {string} input - Input with variables
 * @returns {string} String with variables replaced by their raw values
 */
function expandVariablesOneLevel(input, variableTable = null) {
    if (!input) return input;
    
    // Use provided table, or try to get from global STATE, or use empty object
    const variables = variableTable || 
                     (typeof STATE !== 'undefined' && STATE.variables) || 
                     {};
    
    let result = input;
    const varRegex = /[*<](\w+)[*>]/g;
    
    result = result.replace(varRegex, (match, varName) => {
        if (variables[varName] !== undefined) {
            return variables[varName];
        }
        // If variable not found, keep the original syntax
        return match;
    });
    
    return result;
}

/**
 * Normalize scramble format (remove whitespace, combine moves)
 * @param {string} input - Raw scramble string
 * @returns {string} Normalized scramble
 */
function normalizeScrambleFormat(input) {
    if (!input) return '';
    
    // Remove all whitespace and normalize slashes
    let clean = normalizeInput(input);
    
    // SPECIAL CASE: Handle strings that are only slashes
    const onlySlashes = /^\/+$/.test(clean);
    if (onlySlashes) {
        const slashCount = clean.length;
        // Odd number of slashes = return single slash
        // Even number of slashes = return empty string
        return slashCount % 2 === 1 ? '/' : '';
    }
    
    // Parse into tokens
    let tokens = parseSets(clean);
    
    // Simplify (combine adjacent moves)
    let steps = [];
    let simplified = simplifyScramble(tokens, steps);
    
    // Convert back to string with proper spacing
    let output = simplified.map((tok, i) => {
        if (tok === "/") return "/";
        if (i === 0) return tok;
        return " " + tok;
    }).join("").replace(/\/\s*\(/g, "/ (");
    
    return output;
}

/**
 * Remove whitespace and normalize basic syntax
 */
function normalizeInput(str) {
    return str
        .replace(/\\/g, "/")
        .replace(/\+\+/g, "+")
        .trim();
}

/**
 * Decode letter shortcuts and prime notation into numbers
 * @param {string} str - Input with letters/primes
 * @returns {string} Decoded string with only numbers and valid syntax
 */
function decodeScramble(str) {
    if (!str) return '';
    
    // Define letter mappings (case-insensitive)
    const letterMap = {
        'U': '3', 'D': '3',
        'V': '4', 'E': '4',
        'W': '6', 'B': '6',
        'X': '5', 'F': '5',
        'A': '1', 'O': '1', 'S': '1',
        'T': '2', 'C': '2'
    };
    
    // Define digit mappings for 7, 8, 9
    const digitMap = {
        '7': '-5',
        '8': '-4',
        '9': '-3'
    };
    
    // First pass: normalize all apostrophe types to standard '
    let normalized = str.replace(/[''`']/g, "'");    
    let result = '';
    let i = 0;
    
    while (i < normalized.length) {
        const char = normalized[i];
        const upperChar = char.toUpperCase();
        
        // Check for minus sign BEFORE digit
        if (char === '-' && i + 1 < normalized.length && /\d/.test(normalized[i + 1])) {
            const nextDigit = normalized[i + 1];
            
            // Check if next digit is 7, 8, or 9
            if (digitMap[nextDigit]) {
                // -7 = 5, -8 = 4, -9 = 3 (flip the sign)
                const mappedValue = digitMap[nextDigit]; // e.g., "-5"
                const flipped = mappedValue.substring(1); // Remove the minus, so "-5" becomes "5"
                result += flipped;
                i += 2; // Skip both minus and digit
                continue;
            } else {
                // Regular digit with minus, keep the minus
                result += '-';
                i++;
                continue;
            }
        }
        
        // Check if it's a DIGIT
        if (/\d/.test(char)) {
            // Check if it's 7, 8, or 9 (special negative shortcuts)
            if (digitMap[char]) {
                result += digitMap[char];
            } else {
                result += char;
            }
            i++;
        }
        // Check if it's a LETTER we recognize
        else if (letterMap[upperChar]) {
            const baseValue = letterMap[upperChar];
            result += baseValue;
            i++;
        }
        // Check if it's a prime/apostrophe
        else if (char === "'") {
            result += "'";
            i++;
        }
        // Check if it's a standalone minus sign (not before a digit)
        else if (char === '-') {
            result += '-';
            i++;
        }
        // Keep structural characters
        else if (char === '/' || char === '(' || char === ')' || char === ',' || char === ' ') {
            result += char;
            i++;
        }
        // Skip everything else
        else {
            i++;
        }
    }
    
    return result;
}
/**
 * Parse scramble into token array
 */
function parseSets(str) {
    // Handle empty or whitespace-only input
    if (!str || str.trim() === '') {
        return [];
    }
    
    // SPECIAL CASE: naked slash only
    if (str.trim() === '/') {
        return ['/'];
    }
    
    // DECODE FIRST - convert letters and primes to numbers
    str = decodeScramble(str);
    
    // Check for leading/trailing slashes
    const hasLeadingSlash = str.trimStart().startsWith('/');
    const hasTrailingSlash = str.trimEnd().endsWith('/');
    
    // STEP 1: Parse into character array
    let chars = [...str];
    
    // STEP 2: Remove only whitespace
    chars = chars.filter(c => c !== ' ');
    
    // STEP 3: Process minus signs and primes
    let processed = [];
    let i = 0;
    
    while (i < chars.length) {
        const char = chars[i];
        
        if (char === '-') {
            // Find next number
            let j = i + 1;
            while (j < chars.length && !(/\d/.test(chars[j]))) {
                j++;
            }
            
            if (j < chars.length) {
                // Found a number, mark it as negative
                processed.push('-' + chars[j]);
                // Skip everything up to and including the number
                i = j + 1;
            } else {
                // No number found, skip the minus
                i++;
            }
        } else if (char === "'") {
            // Prime: negate previous number
            if (processed.length > 0) {
                const last = processed[processed.length - 1];
                if (/^-?\d+$/.test(last)) {
                    const num = parseInt(last);
                    // Special case: 6' = 6, 0' = 0
                    if (num === 0) {
                        processed[processed.length - 1] = '0';
                    } else if (Math.abs(num) === 6) {
                        processed[processed.length - 1] = '6';
                    } else if (num > 0) {
                        processed[processed.length - 1] = '-' + num;
                    } else {
                        // Already negative, make positive
                        processed[processed.length - 1] = Math.abs(num).toString();
                    }
                }
            }
            i++;
        } else if (/\d/.test(char)) {
            processed.push(char);
            i++;
        } else if (char === '/' || char === '(' || char === ')' || char === ',') {
            processed.push(char);
            i++;
        } else {
            // Skip unknown characters
            i++;
        }
    }
    
    // STEP 4: No additional cleaning needed, processed array is ready
    let cleaned = processed;
    
    // STEP 5: Extract numbers only (no slashes or other chars)
    let numbers = [];
    for (let item of cleaned) {
        if (/^-?\d+$/.test(item)) {
            numbers.push(parseInt(item));
        }
    }
    
    // If no numbers found, return empty array
    if (numbers.length === 0) {
        return [];
    }
    
    // If odd number of values, auto-pad with 0
    if (numbers.length % 2 !== 0) {
        console.warn(`Odd number of values (${numbers.length}). Auto-padding with 0.`);
        numbers.push(0);
    }
    
    // Group into pairs and format as tokens
    let tokens = [];
    
    // Add leading slash if present
    if (hasLeadingSlash) {
        tokens.push("/");
    }
    
    for (let i = 0; i < numbers.length; i += 2) {
        tokens.push(`(${numbers[i]},${numbers[i + 1]})`);
        // Add slash after each pair except the last
        if (i + 2 < numbers.length) {
            tokens.push("/");
        }
    }
    
    // Add trailing slash if present
    if (hasTrailingSlash) {
        tokens.push("/");
    }
    
    return tokens;
}

/**
 * Add two move sets together
 */
function addSets(a, b) {
    let m = /\((-?\d+),(-?\d+)\)/.exec(a);
    let n = /\((-?\d+),(-?\d+)\)/.exec(b);
    let x1 = parseInt(m[1]), y1 = parseInt(m[2]);
    let x2 = parseInt(n[1]), y2 = parseInt(n[2]);
    let x = x1 + x2, y = y1 + y2;
    
    function norm(v) {
        if (v > 6) v -= 12;
        if (v < -6) v += 12;
        return v;
    }
    
    x = norm(x); 
    y = norm(y);
    return `(${x},${y})`;
}

/**
 * Simplify scramble by combining adjacent moves
 */
function simplifyScramble(tokens, steps) {
    let changed = true;
    
    while (changed) {
        changed = false;
        
        // Remove double slashes
        for (let i = 0; i < tokens.length - 1; i++) {
            if (tokens[i] === "/" && tokens[i + 1] === "/") {
                tokens.splice(i, 2); 
                steps.push(tokens.join("")); 
                changed = true; 
                break;
            }
        }
        if (changed) continue;
        
        // Combine adjacent moves
        for (let i = 0; i < tokens.length - 1; i++) {
            if (tokens[i].startsWith("(") && tokens[i + 1].startsWith("(")) {
                let merged = addSets(tokens[i], tokens[i + 1]);
                tokens.splice(i, 2, merged); 
                steps.push(tokens.join("")); 
                changed = true; 
                break;
            }
        }
        if (changed) continue;
        
        // Remove (0,0) moves
        for (let i = 0; i < tokens.length; i++) {
            if (tokens[i] === "(0,0)") {
                tokens.splice(i, 1);
                steps.push(tokens.join(""));
                changed = true;
                break;
            }
        }
    }
    
    return tokens;
}

// Export for use
if (typeof window !== 'undefined') {
    window.ScrambleNormalizer = {
        normalizeScramble,
        checkForVariables,
        expandVariablesRecursive,
        normalizeScrambleFormat
    };
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        normalizeScramble,
        checkForVariables,
        expandVariablesRecursive,
        normalizeScrambleFormat
    };
}
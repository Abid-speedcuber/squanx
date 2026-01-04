// Square-1 Algorithm to Hex Encoder
// Works in both Node.js and browser environments

function sq1AlgToHex(scramble) {
  // Initial solved state
  let tlHex = '011233455677';
  let blHex = '998bbaddcffe';

  // Parse the scramble string
  const moves = parseScramble(scramble);

  // Apply each move
  for (let i = 0; i < moves.length; i++) {
    const move = moves[i];

    if (move.type === 'twist') {
      const result = twist(tlHex, blHex);
      tlHex = result.tlHex;
      blHex = result.blHex;
    } else if (move.type === 'turn') {
      tlHex = cycleLeft(tlHex, move.top);
      blHex = cycleLeft(blHex, move.bottom);
    }
  }
  return { tlHex, blHex };
}

function parseScramble(scramble) {
  const moves = [];
  
  let i = 0;
  while (i < scramble.length) {
    const char = scramble[i];
    
    // Check for slash - it's a twist move
    if (char === '/' || char === '\\') {
      moves.push({ type: 'twist' });
      i++;
    }
    // Check for opening parenthesis or digit/minus (start of turn move)
    else if (char === '(' || char === '-' || /\d/.test(char)) {
      // Extract the turn move
      let moveStr = '';
      let parenDepth = 0;
      let startPos = i;
      
      while (i < scramble.length) {
        const c = scramble[i];
        if (c === '(') parenDepth++;
        if (c === ')') parenDepth--;
        
        if (c === '/' || c === '\\') {
          // Hit a slash, stop here
          break;
        }
        
        if ((c === ',' || c === '-' || /\d/.test(c) || c === '(' || c === ')') && parenDepth >= 0) {
          moveStr += c;
        }
        
        i++;
        
        // If we've closed all parens and have a comma, we have a complete move
        if (parenDepth === 0 && moveStr.includes(',')) {
          break;
        }
      }
      
      // Parse the move
      const cleaned = moveStr.replace(/[()]/g, '').trim();
      if (cleaned.includes(',')) {
        const [top, bottom] = cleaned.split(',').map(n => parseInt(n.trim()));
        moves.push({ type: 'turn', top, bottom });
      }
    }
    // Skip whitespace
    else if (/\s/.test(char)) {
      i++;
    }
    // Unknown character, skip it
    else {
      i++;
    }
  }
  return moves;
}

function twist(tlHex, blHex) {
  // Swap last 6 of top with first 6 of bottom
  const tlFirst6 = tlHex.slice(0, 6);
  const tlLast6 = tlHex.slice(6);
  const blFirst6 = blHex.slice(0, 6);
  const blLast6 = blHex.slice(6);
  
  return {
    tlHex: tlFirst6 + blFirst6,
    blHex: tlLast6 + blLast6
  };
}

function cycleLeft(hex, places) {
  // Normalize to positive value mod 12
  const normalized = ((places % 12) + 12) % 12;
  
  // Cycle left by moving characters from start to end
  return hex.slice(normalized) + hex.slice(0, normalized);
}

// Example usage and testing
function runExample() {
  const scramble = '(1,0)/ (3,3)/ (6,0)/ (-3,0)/ (-1,-4)/ (0,-3)/ (6,-2)/ (-3,-3)/ (-2,-1)/ (6,-4)/ (0,-1)';
  const result = sq1AlgToHex(scramble);
  return result;
}

function pleaseInvertThisScrambleForSolutionVisualization(scrambleString) {
  if (!scrambleString) return scrambleString;
  let str = String(scrambleString).trim();
  
  const parts = str.split('/');
  const reversed = parts.slice().reverse();
  
  const inverted = reversed.map(part => {
    part = part.trim();
    
    const turnMatch = part.match(/\(([^)]+)\)/);
    if (turnMatch) {
      const values = turnMatch[1].split(',').map(v => v.trim());
      const invertedValues = values.map(v => {
        const num = parseInt(v);
        if (isNaN(num)) return v;
        return String(-num);
      });
      return '(' + invertedValues.join(',') + ')';
    }
    
    if (part.includes(',')) {
      const values = part.split(',').map(v => v.trim());
      const invertedValues = values.map(v => {
        const num = parseInt(v);
        if (isNaN(num)) return v;
        return String(-num);
      });
      return invertedValues.join(',');
    }
    
    return part;
  });
  
  return inverted.join('/');
}

// Export for Node.js or expose globally for browser
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { sq1AlgToHex, parseScramble, twist, cycleLeft };
}

// Browser: expose to window
if (typeof window !== 'undefined') {
  window.sq1AlgToHex = sq1AlgToHex;
  window.runExample = runExample;
  window.pleaseInvertThisScrambleForSolutionVisualization = pleaseInvertThisScrambleForSolutionVisualization;
}

// Run example if in Node.js and executed directly
if (typeof require !== 'undefined' && require.main === module) {
  runExample();
}
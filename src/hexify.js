// Square-1 Algorithm to Hex Encoder
// Works in both Node.js and browser environments

function sq1AlgToHex(scramble) {
  console.log('  [Hexify] Starting with scramble:', scramble);
  
  // Initial solved state
  let tlHex = '011233455677';
  let blHex = '998bbaddcffe';
  console.log('  [Hexify] Initial state - Top:', tlHex, 'Bottom:', blHex);
  
  // Parse the scramble string
  const moves = parseScramble(scramble);
  console.log('  [Hexify] Parsed moves:', JSON.stringify(moves, null, 2));
  
  // Apply each move
  for (let i = 0; i < moves.length; i++) {
    const move = moves[i];
    console.log(`  [Hexify] Move ${i + 1}/${moves.length}:`, move);
    
    if (move.type === 'twist') {
      console.log('    - Performing TWIST');
      console.log('    - Before: Top:', tlHex, 'Bottom:', blHex);
      const result = twist(tlHex, blHex);
      tlHex = result.tlHex;
      blHex = result.blHex;
      console.log('    - After: Top:', tlHex, 'Bottom:', blHex);
    } else if (move.type === 'turn') {
      console.log(`    - Performing TURN: Top by ${move.top}, Bottom by ${move.bottom}`);
      console.log('    - Before: Top:', tlHex, 'Bottom:', blHex);
      tlHex = cycleLeft(tlHex, move.top);
      blHex = cycleLeft(blHex, move.bottom);
      console.log('    - After: Top:', tlHex, 'Bottom:', blHex);
    }
  }
  
  console.log('  [Hexify] Final state - Top:', tlHex, 'Bottom:', blHex);
  return { tlHex, blHex };
}

function parseScramble(scramble) {
  const moves = [];
  console.log('  [Parser] Raw scramble input:', scramble);
  
  let i = 0;
  while (i < scramble.length) {
    const char = scramble[i];
    
    // Check for slash - it's a twist move
    if (char === '/' || char === '\\') {
      moves.push({ type: 'twist' });
      console.log(`  [Parser] Found TWIST at position ${i}`);
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
        console.log(`  [Parser] Found TURN (${top},${bottom}) from position ${startPos} to ${i}`);
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
  
  console.log('  [Parser] Final parsed moves:', JSON.stringify(moves, null, 2));
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
  
  console.log('Scramble:', scramble);
  console.log('Result:');
  console.log('  tlHex:', result.tlHex);
  console.log('  blHex:', result.blHex);
  
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
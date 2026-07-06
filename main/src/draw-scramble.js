// ========================================
// Square-1 Scramble Visualizer Library
// With ridiculously funny names to avoid conflicts!
// ========================================

// === SCRAMBLED STATE GENERATOR FUNCTIONS ===
function gimmeMeARandomNumberBelowThisPlease(n) {
    return Math.floor(Math.random() * n);
}

function ThisIsMySquare1CubieObjectWithFancyHexNumbers() {
    this.ul = 0x011233;
    this.ur = 0x455677;
    this.dl = 0x998bba;
    this.dr = 0xddcffe;
    this.ml = 0;
}

ThisIsMySquare1CubieObjectWithFancyHexNumbers.prototype.toString = function() {
    return this.ul.toString(16).padStart(6, '0') +
        this.ur.toString(16).padStart(6, '0') +
        "|/".charAt(this.ml) +
        this.dl.toString(16).padStart(6, '0') +
        this.dr.toString(16).padStart(6, '0');
}

ThisIsMySquare1CubieObjectWithFancyHexNumbers.prototype.setPiece = function(idx, value) {
    if (idx < 6) {
        this.ul &= ~(0xf << ((5 - idx) << 2));
        this.ul |= value << ((5 - idx) << 2);
    } else if (idx < 12) {
        this.ur &= ~(0xf << ((11 - idx) << 2));
        this.ur |= value << ((11 - idx) << 2);
    } else if (idx < 18) {
        this.dl &= ~(0xf << ((17 - idx) << 2));
        this.dl |= value << ((17 - idx) << 2);
    } else {
        this.dr &= ~(0xf << ((23 - idx) << 2));
        this.dr |= value << ((23 - idx) << 2);
    }
}

const theseAreAllThePossibleHalfLayerShapesISwear = [0, 3, 6, 12, 15, 24, 27, 30, 48, 51, 54, 60, 63];
const pleaseSaveAllValidShapeIndicesHereThankYou = [];

function pleaseInitializeAllTheShapesForMeRightNow() {
    let count = 0;
    for (let i = 0; i < 28561; i++) {
        const dr = theseAreAllThePossibleHalfLayerShapesISwear[i % 13];
        const dl = theseAreAllThePossibleHalfLayerShapesISwear[Math.floor(i / 13) % 13];
        const ur = theseAreAllThePossibleHalfLayerShapesISwear[Math.floor(Math.floor(i / 13) / 13) % 13];
        const ul = theseAreAllThePossibleHalfLayerShapesISwear[Math.floor(Math.floor(Math.floor(i / 13) / 13) / 13)];
        const value = ul << 18 | ur << 12 | dl << 6 | dr;
        
        let bitCount = 0;
        let temp = value;
        while (temp) {
            bitCount += temp & 1;
            temp >>= 1;
        }
        
        if (bitCount === 16) {
            pleaseSaveAllValidShapeIndicesHereThankYou[count++] = value;
        }
    }
}

function pleaseGenerateACubeFromThisShapeIndexForMe(shapeIndex) {
    const f = new ThisIsMySquare1CubieObjectWithFancyHexNumbers();
    const shape = pleaseSaveAllValidShapeIndicesHereThankYou[shapeIndex];
    let corner = 0x01234567 << 1 | 0x11111111;
    let edge = 0x01234567 << 1;
    let n_corner = 8, n_edge = 8;
    
    for (let i = 0; i < 24; i++) {
        if (((shape >> i) & 1) === 0) {
            const rnd = gimmeMeARandomNumberBelowThisPlease(n_edge) << 2;
            f.setPiece(23 - i, (edge >> rnd) & 0xf);
            const m = (1 << rnd) - 1;
            edge = (edge & m) + ((edge >> 4) & ~m);
            n_edge--;
        } else {
            const rnd = gimmeMeARandomNumberBelowThisPlease(n_corner) << 2;
            f.setPiece(23 - i, (corner >> rnd) & 0xf);
            f.setPiece(22 - i, (corner >> rnd) & 0xf);
            const m = (1 << rnd) - 1;
            corner = (corner & m) + ((corner >> 4) & ~m);
            n_corner--;
            i++;
        }
    }
    f.ml = gimmeMeARandomNumberBelowThisPlease(2);
    return f;
}

function convertThisShapeIndexIntoHexNotationPlease(shapeIndex) {
    const cube = pleaseGenerateACubeFromThisShapeIndexForMe(shapeIndex);
    const hexString = cube.toString();
    // Normalize separator to always use | instead of /
    return hexString.replace('/', '|');
}

// Initialize shapes
pleaseInitializeAllTheShapesForMeRightNow();

// === CONSTANTS WITH SILLY NAMES ===
const pleaseGiveMePieceLabelsThankYou = {
  A:"YOG", B:"YOG", C:"YG", D:"YGR", E:"YGR", F:"YR",
  G:"YRB", H:"YRB", I:"YB", J:"YBO", K:"YBO", L:"YO",
  M:"WR", N:"WRG", O:"WRG", P:"WG", Q:"WGO", R:"WGO", S:"WO",
  T:"WOB", U:"WOB", V:"WB", W:"WBR", X:"WBR"
};

const theseAreEdgePiecesIPromise = new Set(['C','F','I','L','M','P','S','V']);

const findMyPartnerPleaseAndThankYou = {
  A:'B',B:'A',D:'E',E:'D',G:'H',H:'G',J:'K',K:'J',
  N:'O',O:'N',Q:'R',R:'Q',T:'U',U:'T',W:'X',X:'W'
};

const whatIsMyCornerIDAgain = {
  A:'AB',B:'AB',D:'DE',E:'DE',G:'GH',H:'GH',J:'JK',K:'JK',
  N:'NO',O:'NO',Q:'QR',R:'QR',T:'TU',U:'TU',W:'WX',X:'WX'
};

const hexToPieceMapButBackwards = {
  'YO': '0', 'YOG': '77', 'YG': '6', 'YGR': '55', 'YR': '4', 'YRB': '33', 
  'YB': '2', 'YBO': '11', 'WR': 'a', 'WRG': 'bb', 'WG': '8', 'WGO': '99', 
  'WO': 'e', 'WOB': 'ff', 'WB': 'c', 'WBR': 'dd'
};

// === BASIC HELPER FUNCTIONS ===
function canYouRotateThisStringPlease(str, rotAmount) {
  const len = str.length;
  const normalizedRot = ((rotAmount % len) + len) % len;
  return str.slice(normalizedRot) + str.slice(0, normalizedRot);
}

function pleaseRotateThisArrayForMe(arr, rotAmount) {
  const len = arr.length;
  const normalizedRot = ((rotAmount % len) + len) % len;
  return arr.slice(normalizedRot).concat(arr.slice(0, normalizedRot));
}

function gimmeASolvedCubeRightNow() {
  return 'ABCDEFGHIJKLMNOPQRSTUVWX'.split('');
}

function rotateThisSectionOfArrayPlease(arr, startIdx, length, rotAmount) {
  const normalizedRot = ((rotAmount % length) + length) % length;
  if (normalizedRot === 0) return;
  
  const segment = arr.slice(startIdx, startIdx + length);
  const rotated = [];
  for (let i = 0; i < length; i++) {
    rotated[(i + normalizedRot) % length] = segment[i];
  }
  for (let i = 0; i < length; i++) {
    arr[startIdx + i] = rotated[i];
  }
}

function doTheSliceSwapDancePlease(arr) {
  for (let i = 0; i < 6; i++) {
    [arr[i], arr[12 + i]] = [arr[12 + i], arr[i]];
  }
}

// === SCRAMBLE PARSING ===
function* pleaseTokenizeThisScrambleForMe(scrambleString) {
  let idx = 0;
  const totalLen = scrambleString.length;
  const whitespaceRegex = /\s/;
  const integerRegex = /^([+-]?\d+)/;
  
  const skipWhitespace = () => {
    while (idx < totalLen && whitespaceRegex.test(scrambleString[idx])) idx++;
  };
  
  while (true) {
    skipWhitespace();
    if (idx >= totalLen) return;
    
    const currentChar = scrambleString[idx];
    
    if (currentChar === '(') {
      idx++;
      skipWhitespace();
      
      let match = scrambleString.slice(idx).match(integerRegex);
      if (!match) { idx++; continue; }
      const topValue = +match[1];
      idx += match[1].length;
      
      skipWhitespace();
      if (scrambleString[idx] === ',') idx++;
      skipWhitespace();
      
      match = scrambleString.slice(idx).match(integerRegex);
      if (!match) { idx++; continue; }
      const bottomValue = +match[1];
      idx += match[1].length;
      
      skipWhitespace();
      if (scrambleString[idx] === ')') idx++;
      skipWhitespace();
      
      const hasSlashAfter = (scrambleString[idx] === '/');
      if (hasSlashAfter) idx++;
      
      yield { moveType: 'turn', top: topValue, bottom: bottomValue, hasSlash: hasSlashAfter };
      continue;
    }
    
    if (currentChar === '/') {
      idx++;
      yield { moveType: 'slash' };
      continue;
    }
    
    idx++;
  }
}

function applyScrambleToCubePlease(scrambleString) {
  const cubeState = gimmeASolvedCubeRightNow();
  
  for (const token of pleaseTokenizeThisScrambleForMe(scrambleString)) {
    if (token.moveType === 'turn') {
      rotateThisSectionOfArrayPlease(cubeState, 0, 12, token.top);
      rotateThisSectionOfArrayPlease(cubeState, 12, 12, token.bottom);
      if (token.hasSlash) doTheSliceSwapDancePlease(cubeState);
    } else {
      doTheSliceSwapDancePlease(cubeState);
    }
  }
  
  return cubeState;
}

// === STATE ENCODING ===
function pleaseEncodeMyCubeStateToHexNotation(cubeStateArray) {
  const topLayerPieces = [];
  const bottomLayerPieces = [];
  
  // Process top layer (0-11)
  let idx = 0;
  while (idx < 12) {
    const piece = cubeStateArray[idx];
    if (theseAreEdgePiecesIPromise.has(piece)) {
      topLayerPieces.push(pleaseGiveMePieceLabelsThankYou[piece]);
      idx++;
    } else {
      const nextPiece = cubeStateArray[(idx + 1) % 12];
      if (findMyPartnerPleaseAndThankYou[piece] === nextPiece) {
        topLayerPieces.push(pleaseGiveMePieceLabelsThankYou[piece]);
        idx += 2;
      } else {
        return 'Error: Invalid corner pairing in top layer';
      }
    }
  }
  
  // Process bottom layer (12-23)
  idx = 12;
  while (idx < 24) {
    const piece = cubeStateArray[idx];
    if (theseAreEdgePiecesIPromise.has(piece)) {
      bottomLayerPieces.push(pleaseGiveMePieceLabelsThankYou[piece]);
      idx++;
    } else {
      const nextPiece = cubeStateArray[12 + ((idx - 12 + 1) % 12)];
      if (findMyPartnerPleaseAndThankYou[piece] === nextPiece) {
        bottomLayerPieces.push(pleaseGiveMePieceLabelsThankYou[piece]);
        idx += 2;
      } else {
        return 'Error: Invalid corner pairing in bottom layer';
      }
    }
  }
  
  // Convert to hex
  const topHexString = topLayerPieces.map(p => hexToPieceMapButBackwards[p] || '?').join('');
  const bottomHexString = bottomLayerPieces.map(p => hexToPieceMapButBackwards[p] || '?').join('');
  
  if (topHexString.includes('?') || bottomHexString.includes('?')) {
    return 'Error: Unknown piece mapping';
  }
  
  if (topHexString.length !== 12 || bottomHexString.length !== 12) {
    return 'Error: Invalid hex length';
  }
  
  // Format: reverse(L-A) | reverse(M-R) + reverse(S-X)
  const leftTopReversed = topHexString.split('').reverse().join('');
  const rightBottom1Reversed = bottomHexString.slice(0, 6).split('').reverse().join('');
  const rightBottom2Reversed = bottomHexString.slice(6, 12).split('').reverse().join('');
  
  return `${leftTopReversed}|${rightBottom1Reversed}${rightBottom2Reversed}`;
}

// === INVERT SCRAMBLE (for solution visualization) ===
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

// === SHAPE BUILDING ===
function pleaseBuildClustersFromThisShapeArray(shapeArray) {
  const slots = [];
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWX'.split('');
  
  function processOneLayerPlease(startIdx, endIdx) {
    let i = startIdx;
    while (i < endIdx) {
      const isThisACorner = shapeArray[i] === 1;
      
      if (isThisACorner) {
        const nextIdx = (i - startIdx + 1) % 12 + startIdx;
        if (nextIdx < endIdx && shapeArray[nextIdx] === 1) {
          slots.push({
            type: 'corner',
            startLetter: i,
            lettersCount: 2,
            label: letters[i] + letters[nextIdx]
          });
          i += 2;
        } else {
          slots.push({
            type: 'half-corner',
            startLetter: i,
            lettersCount: 1,
            label: letters[i]
          });
          i += 1;
        }
      } else {
        slots.push({
          type: 'edge',
          startLetter: i,
          lettersCount: 1,
          label: letters[i]
        });
        i += 1;
      }
    }
  }
  
  processOneLayerPlease(0, 12);
  processOneLayerPlease(12, 24);
  
  return slots;
}

function pleaseParseScrambleAssignmentsFromHexCode(hexScramble, slotsList) {
  const assignments = {};
  for (let i = 0; i < slotsList.length; i++) {
    const slot = slotsList[i];
    const letterIndex = slot.startLetter;
    
    const scrambleIdx = (letterIndex < 12) 
      ? letterIndex 
      : 13 + (letterIndex - 12);
    
    assignments[slot.label] = hexScramble[scrambleIdx];
  }
  
  return assignments;
}

// === GEOMETRY HELPERS ===
function polarToCartesianButWithFunnyName(centerX, centerY, radius, angleDegrees) {
  const angleRadians = angleDegrees * Math.PI / 180;
  return { 
    x: centerX + radius * Math.cos(angleRadians), 
    y: centerY - radius * Math.sin(angleRadians) 
  };
}

function pointArrayToSVGStringPlease(pointsArray) {
  return pointsArray.map(p => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' ');
}

function lerpBetweenTwoPointsPlease(pointA, pointB, interpolationAmount) {
  return { 
    x: pointA.x + (pointB.x - pointA.x) * interpolationAmount, 
    y: pointA.y + (pointB.y - pointA.y) * interpolationAmount 
  };
}

function gimmeTheAngleForThisSlotPlease(slot, angleArray) {
  const angles = [];
  for (let k = 0; k < slot.lettersCount; k++) {
    const globalIdx = slot.startLetter + k;
    const localIdx = globalIdx >= 12 ? globalIdx - 12 : globalIdx;
    angles.push(angleArray[localIdx]);
  }
  return angles.reduce((sum, angle) => sum + angle, 0) / angles.length;
}

// === COLOR MAPPING ===
function whatColorIsThisEdgePiecePlease(hexChar, colorScheme) {
  const { topColor, bottomColor, frontColor, rightColor, backColor, leftColor } = colorScheme;
  
  switch (hexChar.toLowerCase()) {
    case '0': return { inner: topColor, outer: backColor };
    case '2': return { inner: topColor, outer: leftColor };
    case '4': return { inner: topColor, outer: frontColor };
    case '6': return { inner: topColor, outer: rightColor };
    case '8': return { inner: bottomColor, outer: rightColor };
    case 'a': return { inner: bottomColor, outer: frontColor };
    case 'c': return { inner: bottomColor, outer: leftColor };
    case 'e': return { inner: bottomColor, outer: backColor };
    case 'E': return { inner: '#888888', outer: '#888888' };
    case 'R': return { inner: 'transparent', outer: 'transparent' };
    default: return { inner: '#4ecdc4', outer: '#4ecdc4' };
  }
}

function whatAreTheCornerColorLettersPlease(hexChar) {
  switch ((hexChar || '').toLowerCase()) {
    case '1': return { top: 'y', left: 'b', right: 'o' };
    case '3': return { top: 'y', left: 'r', right: 'b' };
    case '5': return { top: 'y', left: 'g', right: 'r' };
    case '7': return { top: 'y', left: 'o', right: 'g' };
    case '9': return { top: 'w', left: 'g', right: 'o' };
    case 'b': return { top: 'w', left: 'r', right: 'g' };
    case 'd': return { top: 'w', left: 'b', right: 'r' };
    case 'f': return { top: 'w', left: 'o', right: 'b' };
    case 'C': return { top: '#888888', left: '#888888', right: '#888888' };
    default: return { top: '#4ecdc4', left: '#4ecdc4', right: '#4ecdc4' };
  }
}

function convertColorLetterToHexCodePlease(colorLetter, colorScheme) {
  if (!colorLetter) return '#cccccc';
  const { topColor, bottomColor, frontColor, rightColor, backColor, leftColor } = colorScheme;
  
  switch (colorLetter.toLowerCase()) {
    case 'y': return topColor;
    case 'w': return bottomColor;
    case 'o': return backColor;
    case 'b': return leftColor;
    case 'r': return frontColor;
    case 'g': return rightColor;
    default: return '#cccccc';
  }
}

function gimmeCornerColorsAsHexCodesPlease(hexChar, isThisBottomLayer, colorScheme) {
  const colorTriplet = whatAreTheCornerColorLettersPlease(hexChar);
  let leftColor = convertColorLetterToHexCodePlease(colorTriplet.left, colorScheme);
  let rightColor = convertColorLetterToHexCodePlease(colorTriplet.right, colorScheme);
  const topColor = convertColorLetterToHexCodePlease(colorTriplet.top, colorScheme);
  
  return { top: topColor, left: leftColor, right: rightColor };
}

function whatColorIsThisHalfCornerPlease(hexChar) {
  return 'fill="#ff9999"';
}

// === SVG GENERATION FOR INDIVIDUAL PIECES ===
function pleaseCreateOnePieceSVGForMe(slot, pieceHex, centerX, centerY, centerAngle, radiusInner, radiusOuter, radiusApex, unit10vh, isBottomLayer, strokeThin, strokeMedium, strokeThick, colorScheme) {
  isBottomLayer = !!(slot && typeof slot.startLetter === 'number' && slot.startLetter >= 12);
  
  let svgMarkup = '';
  const halfAngle = slot.type === 'corner' ? 30 : 15;
  
  if (slot.type === 'edge') {
    const pointInner = polarToCartesianButWithFunnyName(centerX, centerY, radiusInner, centerAngle);
    const pointA = polarToCartesianButWithFunnyName(centerX, centerY, radiusOuter, centerAngle - halfAngle);
    const pointB = polarToCartesianButWithFunnyName(centerX, centerY, radiusOuter, centerAngle + halfAngle);
    
    const midRadius = radiusInner + (radiusOuter - radiusInner) * 0.8;
    const pointMidA = polarToCartesianButWithFunnyName(centerX, centerY, midRadius, centerAngle - halfAngle);
    const pointMidB = polarToCartesianButWithFunnyName(centerX, centerY, midRadius, centerAngle + halfAngle);
    
    const edgeColors = whatColorIsThisEdgePiecePlease(pieceHex, colorScheme);
    
    svgMarkup += `<polygon points="${pointArrayToSVGStringPlease([pointMidA, pointA, pointB, pointMidB])}" fill="${edgeColors.outer}" stroke="#333" stroke-width="${strokeMedium}"/>`;
    svgMarkup += `<polygon points="${pointArrayToSVGStringPlease([pointInner, pointMidA, pointMidB])}" fill="${edgeColors.inner}" stroke="#333" stroke-width="${strokeThin}"/>`;
    
  } else if (slot.type === 'corner') {
    const pointInner = polarToCartesianButWithFunnyName(centerX, centerY, radiusInner, centerAngle);
    const pointOuterRight = polarToCartesianButWithFunnyName(centerX, centerY, radiusOuter, centerAngle - halfAngle);
    const pointApex = polarToCartesianButWithFunnyName(centerX, centerY, radiusApex, centerAngle);
    const pointOuterLeft = polarToCartesianButWithFunnyName(centerX, centerY, radiusOuter, centerAngle + halfAngle);
    
    const scaleFactor = 0.80;
    const pointSmallLeft = lerpBetweenTwoPointsPlease(pointInner, pointOuterLeft, scaleFactor);
    const pointSmallRight = lerpBetweenTwoPointsPlease(pointInner, pointOuterRight, scaleFactor);
    const pointSmallBottom = lerpBetweenTwoPointsPlease(pointInner, pointApex, scaleFactor);
    
    const colors = gimmeCornerColorsAsHexCodesPlease(pieceHex, isBottomLayer, colorScheme);
    
    svgMarkup += `<polygon points="${pointArrayToSVGStringPlease([pointInner, pointOuterLeft, pointApex, pointSmallBottom, pointSmallLeft])}" fill="${colors.left}" stroke="#333" stroke-width="${strokeMedium}"/>`;
    svgMarkup += `<polygon points="${pointArrayToSVGStringPlease([pointInner, pointSmallRight, pointSmallBottom, pointApex, pointOuterRight])}" fill="${colors.right}" stroke="#333" stroke-width="${strokeMedium}"/>`;
    svgMarkup += `<polygon points="${pointArrayToSVGStringPlease([pointInner, pointSmallLeft, pointSmallBottom, pointSmallRight])}" fill="${colors.top}" stroke="#333" stroke-width="${strokeThin}"/>`;
    svgMarkup += `<polygon points="${pointArrayToSVGStringPlease([pointInner, pointOuterLeft, pointApex, pointOuterRight])}" fill="none" stroke="#333" stroke-width="${strokeMedium}"/>`;
    svgMarkup += `<line x1="${pointApex.x.toFixed(2)}" y1="${pointApex.y.toFixed(2)}" x2="${pointSmallBottom.x.toFixed(2)}" y2="${pointSmallBottom.y.toFixed(2)}" stroke="#333" stroke-width="${strokeMedium}" stroke-linecap="round"/>`;
    
  } else if (slot.type === 'half-corner') {
    const halfInnerAngle = 15;
    const pointInner = polarToCartesianButWithFunnyName(centerX, centerY, radiusInner, centerAngle);
    const pointOuterRight = polarToCartesianButWithFunnyName(centerX, centerY, radiusOuter, centerAngle - halfInnerAngle);
    const pointApex = polarToCartesianButWithFunnyName(centerX, centerY, radiusApex, centerAngle);
    const pointOuterLeft = polarToCartesianButWithFunnyName(centerX, centerY, radiusOuter, centerAngle + halfInnerAngle);
    
    const fillAttribute = whatColorIsThisHalfCornerPlease(pieceHex);
    svgMarkup += `<polygon points="${pointArrayToSVGStringPlease([pointInner, pointOuterRight, pointApex, pointOuterLeft])}" ${fillAttribute} stroke="#333" stroke-width="${strokeThin}"/>`;
  }
  
  return svgMarkup;
}

// === MAIN SVG GENERATION ===
function pleaseGenerateTheFullSVGFromHexNotation(hexScrambleCode, equatorChar, desiredSize, colorScheme, ringDistance = 5) {
  if (hexScrambleCode.length !== 25) {
    throw new Error('Invalid scramble format - needs 25 characters!');
  }
  
  const actualEquator = hexScrambleCode[12];
  const shapeArray = new Array(24);
  let scrambleIdx = 0;
  
  // Determine shape for top layer (0-11)
  for (let i = 0; i < 12; i++) {
    if (scrambleIdx === 12) scrambleIdx++;
    const piece = hexScrambleCode[scrambleIdx];
    const isCorner = ['1', '3', '5', '7', '9', 'b', 'd', 'f'].includes(piece.toLowerCase());
    shapeArray[i] = isCorner ? 1 : 0;
    scrambleIdx++;
  }
  
  // Determine shape for bottom layer (12-23)
  scrambleIdx = 13;
  for (let i = 12; i < 24; i++) {
    const piece = hexScrambleCode[scrambleIdx];
    const isCorner = ['1', '3', '5', '7', '9', 'b', 'd', 'f'].includes(piece.toLowerCase());
    shapeArray[i] = isCorner ? 1 : 0;
    scrambleIdx++;
  }
  
  const slots = pleaseBuildClustersFromThisShapeArray(shapeArray);
  const pieceAssignments = pleaseParseScrambleAssignmentsFromHexCode(hexScrambleCode, slots);
  
  // Calculate dimensions
  const svgSize = desiredSize;
  const unit10vh = desiredSize * 0.4;
  const centerX = svgSize / 2;
  const centerY = svgSize / 2;
  
  const radiusInner = 0;
  const radiusOuter = unit10vh * 0.7;
  const radiusApex = radiusOuter * 1.366025404;
  const ringRadius = radiusOuter + (unit10vh * 0.4);
  
  const strokeThin = desiredSize * 0.003;
  const strokeMedium = desiredSize * 0.004;
  const strokeThick = desiredSize * 0.005;
  const strokeRing = 0;
  const strokeLine = desiredSize * 0.008;
  
  const centerToCenterDistance = ringRadius * (2 + ringDistance / 100);
  const marginLeft = centerToCenterDistance - svgSize;
  let htmlOutput = `<div style="display: flex; align-items: center;">`;
  
  // LEFT SVG (top layer)
  htmlOutput += `<svg width="${svgSize}" height="${svgSize}" viewBox="0 0 ${svgSize} ${svgSize}">`;
  htmlOutput += `<circle cx="${centerX}" cy="${centerY}" r="${ringRadius}" fill="${colorScheme.circleColor}" stroke="rgba(0,0,0,0.08)" stroke-width="${strokeRing}"/>`;
  
  const linePoint1Left = polarToCartesianButWithFunnyName(centerX, centerY, ringRadius + 6, 75);
  const linePoint2Left = polarToCartesianButWithFunnyName(centerX, centerY, ringRadius + 6, 255);
  htmlOutput += `<line x1="${linePoint1Left.x}" y1="${linePoint1Left.y}" x2="${linePoint2Left.x}" y2="${linePoint2Left.y}" stroke="${colorScheme.dividerColor}" stroke-width="${strokeLine}"/>`;
  htmlOutput += `<circle cx="${centerX}" cy="${centerY}" r="${unit10vh * 0.05}" fill="rgba(0,0,0,0.06)"/>`;
  
  const leftLayerAngles = Array.from({ length: 12 }, (_, j) => 90 + j * 30);
  
  slots.forEach(slot => {
    if (slot.startLetter < 12) {
      const piece = pieceAssignments[slot.label];
      const angle = gimmeTheAngleForThisSlotPlease(slot, leftLayerAngles);
      htmlOutput += pleaseCreateOnePieceSVGForMe(slot, piece, centerX, centerY, angle, radiusInner, radiusOuter, radiusApex, unit10vh, false, strokeThin, strokeMedium, strokeThick, colorScheme);
    }
  });
  
  htmlOutput += `</svg>`;
  
  // RIGHT SVG (bottom layer)
  htmlOutput += `<svg width="${svgSize}" height="${svgSize}" viewBox="0 0 ${svgSize} ${svgSize}" style="margin-left: ${marginLeft}px;">`;
  htmlOutput += `<circle cx="${centerX}" cy="${centerY}" r="${ringRadius}" fill="${colorScheme.circleColor}" stroke="rgba(0,0,0,0.08)" stroke-width="${strokeRing}"/>`;
  
  const linePoint1Right = polarToCartesianButWithFunnyName(centerX, centerY, ringRadius + 6, 105);
  const linePoint2Right = polarToCartesianButWithFunnyName(centerX, centerY, ringRadius + 6, 285);
  htmlOutput += `<line x1="${linePoint1Right.x}" y1="${linePoint1Right.y}" x2="${linePoint2Right.x}" y2="${linePoint2Right.y}" stroke="${colorScheme.dividerColor}" stroke-width="${strokeLine}"/>`;
  htmlOutput += `<circle cx="${centerX}" cy="${centerY}" r="${unit10vh * 0.05}" fill="rgba(0,0,0,0.06)"/>`;
  
  const rightLayerAngles = Array.from({ length: 12 }, (_, j) => 300 + j * 30);
  
  slots.forEach(slot => {
    if (slot.startLetter >= 12) {
      const piece = pieceAssignments[slot.label];
      const angle = gimmeTheAngleForThisSlotPlease(slot, rightLayerAngles);
      htmlOutput += pleaseCreateOnePieceSVGForMe(slot, piece, centerX, centerY, angle, radiusInner, radiusOuter, radiusApex, unit10vh, true, strokeThin, strokeMedium, strokeThick, colorScheme);
    }
  });
  
  htmlOutput += `</svg></div>`;
  
  return htmlOutput;
}

// ========================================
// === SHAPE INDEX TO HEX CONVERSION ===
// ========================================

function convertShapeIndexToHexPlease(shapeIndex) {
  const hexString = convertThisShapeIndexIntoHexNotationPlease(shapeIndex);
  // Ensure we always use | separator
  return hexString.replace('/', '|');
}

// ========================================
// === CUBE SHAPE VISUALIZER ===
// ========================================

function pleaseCreateOneShapeOutlineSVGForMe(slot, centerX, centerY, centerAngle, radiusInner, radiusOuter, radiusApex, edgeFill, cornerFill, strokeWidth) {
  let svgMarkup = '';
  const halfAngle = slot.type === 'corner' ? 30 : 15;
  
  if (slot.type === 'edge') {
    const pointInner = polarToCartesianButWithFunnyName(centerX, centerY, radiusInner, centerAngle);
    const pointA = polarToCartesianButWithFunnyName(centerX, centerY, radiusOuter, centerAngle - halfAngle);
    const pointB = polarToCartesianButWithFunnyName(centerX, centerY, radiusOuter, centerAngle + halfAngle);
    
    svgMarkup += `<polygon points="${pointArrayToSVGStringPlease([pointInner, pointA, pointB])}" fill="${edgeFill}" stroke="#333" stroke-width="${strokeWidth}"/>`;
    
  } else if (slot.type === 'corner') {
    const pointInner = polarToCartesianButWithFunnyName(centerX, centerY, radiusInner, centerAngle);
    const pointOuterRight = polarToCartesianButWithFunnyName(centerX, centerY, radiusOuter, centerAngle - halfAngle);
    const pointApex = polarToCartesianButWithFunnyName(centerX, centerY, radiusApex, centerAngle);
    const pointOuterLeft = polarToCartesianButWithFunnyName(centerX, centerY, radiusOuter, centerAngle + halfAngle);
    
    svgMarkup += `<polygon points="${pointArrayToSVGStringPlease([pointInner, pointOuterLeft, pointApex, pointOuterRight])}" fill="${cornerFill}" stroke="#333" stroke-width="${strokeWidth}"/>`;
    
  } else if (slot.type === 'half-corner') {
    const halfInnerAngle = 15;
    const pointInner = polarToCartesianButWithFunnyName(centerX, centerY, radiusInner, centerAngle);
    const pointOuterRight = polarToCartesianButWithFunnyName(centerX, centerY, radiusOuter, centerAngle - halfInnerAngle);
    const pointApex = polarToCartesianButWithFunnyName(centerX, centerY, radiusApex, centerAngle);
    const pointOuterLeft = polarToCartesianButWithFunnyName(centerX, centerY, radiusOuter, centerAngle + halfInnerAngle);
    
    svgMarkup += `<polygon points="${pointArrayToSVGStringPlease([pointInner, pointOuterRight, pointApex, pointOuterLeft])}" fill="${cornerFill}" stroke="#333" stroke-width="${strokeWidth}"/>`;
  }
  
  return svgMarkup;
}

function pleaseGenerateShapeVisualizationSVG(hexScrambleCode, size, edgeFill, cornerFill, strokeWidthBase, ringDistance = 5) {
  if (hexScrambleCode.length !== 25) {
    throw new Error('Invalid scramble format - needs 25 characters!');
  }
  
  const shapeArray = new Array(24);
  let scrambleIdx = 0;
  
  // Determine shape for top layer (0-11)
  for (let i = 0; i < 12; i++) {
    if (scrambleIdx === 12) scrambleIdx++;
    const piece = hexScrambleCode[scrambleIdx];
    const isCorner = ['1', '3', '5', '7', '9', 'b', 'd', 'f'].includes(piece.toLowerCase());
    shapeArray[i] = isCorner ? 1 : 0;
    scrambleIdx++;
  }
  
  // Determine shape for bottom layer (12-23)
  scrambleIdx = 13;
  for (let i = 12; i < 24; i++) {
    const piece = hexScrambleCode[scrambleIdx];
    const isCorner = ['1', '3', '5', '7', '9', 'b', 'd', 'f'].includes(piece.toLowerCase());
    shapeArray[i] = isCorner ? 1 : 0;
    scrambleIdx++;
  }
  
  const slots = pleaseBuildClustersFromThisShapeArray(shapeArray);
  
  // Calculate dimensions
  const svgSize = size;
  const unit10vh = size * 0.4;
  const centerX = svgSize / 2;
  const centerY = svgSize / 2;
  
  const radiusInner = 0;
  const radiusOuter = unit10vh * 0.7;
  const radiusApex = radiusOuter * 1.366025404;
  const ringRadius = radiusOuter + (unit10vh * 0.4);
  
  const strokeWidth = (size / 200) * strokeWidthBase;
  const strokeRing = 0;
  const strokeLine = size * 0.008;
  
  const centerToCenterDistance = ringRadius * (2 + ringDistance / 100);
  const marginLeft = centerToCenterDistance - svgSize;
  let htmlOutput = `<div style="display: flex; align-items: center;">`;
  
  // LEFT SVG (top layer)
  htmlOutput += `<svg width="${svgSize}" height="${svgSize}" viewBox="0 0 ${svgSize} ${svgSize}">`;
  htmlOutput += `<circle cx="${centerX}" cy="${centerY}" r="${ringRadius}" fill="transparent" stroke="rgba(0,0,0,0.08)" stroke-width="${strokeRing}"/>`;
  
  const linePoint1Left = polarToCartesianButWithFunnyName(centerX, centerY, ringRadius + 6, 75);
  const linePoint2Left = polarToCartesianButWithFunnyName(centerX, centerY, ringRadius + 6, 255);
  htmlOutput += `<line x1="${linePoint1Left.x}" y1="${linePoint1Left.y}" x2="${linePoint2Left.x}" y2="${linePoint2Left.y}" stroke="#7a0000" stroke-width="${strokeLine}"/>`;
  htmlOutput += `<circle cx="${centerX}" cy="${centerY}" r="${unit10vh * 0.05}" fill="rgba(0,0,0,0.06)"/>`;
  
  const leftLayerAngles = Array.from({ length: 12 }, (_, j) => 90 + j * 30);
  
  slots.forEach(slot => {
    if (slot.startLetter < 12) {
      const angle = gimmeTheAngleForThisSlotPlease(slot, leftLayerAngles);
      htmlOutput += pleaseCreateOneShapeOutlineSVGForMe(slot, centerX, centerY, angle, radiusInner, radiusOuter, radiusApex, edgeFill, cornerFill, strokeWidth);
    }
  });
  
  htmlOutput += `</svg>`;
  
  // RIGHT SVG (bottom layer)
  htmlOutput += `<svg width="${svgSize}" height="${svgSize}" viewBox="0 0 ${svgSize} ${svgSize}" style="margin-left: ${marginLeft}px;">`;
  htmlOutput += `<circle cx="${centerX}" cy="${centerY}" r="${ringRadius}" fill="transparent" stroke="rgba(0,0,0,0.08)" stroke-width="${strokeRing}"/>`;
  
  const linePoint1Right = polarToCartesianButWithFunnyName(centerX, centerY, ringRadius + 6, 105);
  const linePoint2Right = polarToCartesianButWithFunnyName(centerX, centerY, ringRadius + 6, 285);
  htmlOutput += `<line x1="${linePoint1Right.x}" y1="${linePoint1Right.y}" x2="${linePoint2Right.x}" y2="${linePoint2Right.y}" stroke="#7a0000" stroke-width="${strokeLine}"/>`;
  htmlOutput += `<circle cx="${centerX}" cy="${centerY}" r="${unit10vh * 0.05}" fill="rgba(0,0,0,0.06)"/>`;
  
  const rightLayerAngles = Array.from({ length: 12 }, (_, j) => 300 + j * 30);
  
  slots.forEach(slot => {
    if (slot.startLetter >= 12) {
      const angle = gimmeTheAngleForThisSlotPlease(slot, rightLayerAngles);
      htmlOutput += pleaseCreateOneShapeOutlineSVGForMe(slot, centerX, centerY, angle, radiusInner, radiusOuter, radiusApex, edgeFill, cornerFill, strokeWidth);
    }
  });
  
  htmlOutput += `</svg></div>`;
  
  return htmlOutput;
}

/**
 * Visualize cube shape outlines only
 * @param {string|number} input - Can be: shapeIndex (number), hex code (string), or scramble notation (string)
 * @param {number} size - Desired size in pixels (default: 200)
 * @param {string} edgeFill - Fill color for edges (default: 'transparent')
 * @param {string} cornerFill - Fill color for corners (default: 'transparent')
 * @param {number} strokeWidth - Base stroke width (default: 2, scales with size)
 * @returns {string} HTML string containing the SVG visualization
 */
function visualizeCubeShapeOutlinesPlease(input, size = 200, edgeFill = 'transparent', cornerFill = 'transparent', strokeWidth = 2, ringDistance = 5) {
  let hexCode;
  
  // Check if input is a shape index (number)
  if (typeof input === 'number') {
    hexCode = convertShapeIndexToHexPlease(input);
  }
  // Check if input looks like hex code (contains |)
  else if (typeof input === 'string' && input.includes('|')) {
    hexCode = input;
  }
  // Otherwise treat as scramble notation
  else if (typeof input === 'string') {
    const cubeState = applyScrambleToCubePlease(input);
    hexCode = pleaseEncodeMyCubeStateToHexNotation(cubeState);
    
    if (hexCode.startsWith('Error:')) {
      return `<div style="color: #e53e3e; font-family: monospace; padding: 1rem;">${hexCode}</div>`;
    }
  }
  else {
    return `<div style="color: #e53e3e; font-family: monospace; padding: 1rem;">Error: Invalid input type</div>`;
  }
  
  return pleaseGenerateShapeVisualizationSVG(hexCode, size, edgeFill, cornerFill, strokeWidth, ringDistance);
}

// ========================================
// === THE THREE MAGICAL FUNCTIONS!!! ===
// ========================================

/**
 * Option 1: You already have the 25-character hex code
 * @param {string} hexCode - The 25-character scramble code (e.g., "6e0cc804a2a6|0e8c64ee20c4")
 * @param {number} size - Desired size in pixels (default: 200)
 * @param {object} colors - Color customization object with defaults
 * @returns {string} HTML string containing the SVG visualization
 */
function visualizeFromHexCodePlease(hexCode, size = 200, colors = {}, ringDistance = 5) {
  const colorScheme = {
    topColor: colors.topColor || '#000000',
    bottomColor: colors.bottomColor || '#FFFFFF',
    frontColor: colors.frontColor || '#CC0000',
    rightColor: colors.rightColor || '#00AA00',
    backColor: colors.backColor || '#FF8C00',
    leftColor: colors.leftColor || '#0066CC',
    dividerColor: colors.dividerColor || '#7a0000',
    circleColor: colors.circleColor || 'transparent'
  };
  
  return pleaseGenerateTheFullSVGFromHexNotation(hexCode, hexCode[12], size, colorScheme, ringDistance);
}

/**
 * Option 2: You have a scramble notation
 * @param {string} scramble - Scramble notation (e.g., "(1,0) / (3,3) / (1,0) / ...")
 * @param {number} size - Desired size in pixels (default: 200)
 * @param {object} colors - Color customization object
 * @returns {string} HTML string containing the SVG visualization
 */
function visualizeFromScrambleNotationPlease(scramble, size = 200, colors = {}, ringDistance = 5) {
  const colorScheme = {
    topColor: colors.topColor || '#000000',
    bottomColor: colors.bottomColor || '#FFFFFF',
    frontColor: colors.frontColor || '#CC0000',
    rightColor: colors.rightColor || '#00AA00',
    backColor: colors.backColor || '#FF8C00',
    leftColor: colors.leftColor || '#0066CC',
    dividerColor: colors.dividerColor || '#7a0000',
    circleColor: colors.circleColor || 'transparent'
  };
  
  const cubeState = applyScrambleToCubePlease(scramble);
  const hexCode = pleaseEncodeMyCubeStateToHexNotation(cubeState);
  
  if (hexCode.startsWith('Error:')) {
    return `<div style="color: #e53e3e; font-family: monospace; padding: 1rem;">${hexCode}</div>`;
  }
  
  return pleaseGenerateTheFullSVGFromHexNotation(hexCode, hexCode[12], size, colorScheme, ringDistance);
}

/**
 * Option 3: You have a solution notation (will be inverted to show the state)
 * @param {string} solution - Solution notation (e.g., "(1,0) / (3,3) / (1,0) / ...")
 * @param {number} size - Desired size in pixels (default: 200)
 * @param {object} colors - Color customization object
 * @returns {string} HTML string containing the SVG visualization
 */
function visualizeFromSolutionNotationPlease(solution, size = 200, colors = {}, ringDistance = 5) {
  const invertedScramble = pleaseInvertThisScrambleForSolutionVisualization(solution);
  return visualizeFromScrambleNotationPlease(invertedScramble, size, colors, ringDistance);
}

// ========================================
// === EXPORT FOR USE ===
// ========================================

// For direct browser usage, attach to window
if (typeof window !== 'undefined') {
  window.Square1VisualizerLibraryWithSillyNames = {
    visualizeFromHexCodePlease,
    visualizeFromScrambleNotationPlease,
    visualizeFromSolutionNotationPlease,
    visualizeCubeShapeOutlinesPlease  // <-- This line should be here!
  };
}

export {
  visualizeCubeShapeOutlinesPlease,
  visualizeFromHexCodePlease,
  visualizeFromScrambleNotationPlease,
  visualizeFromSolutionNotationPlease
};

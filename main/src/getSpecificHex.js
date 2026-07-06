// Node.js module for Square-1 hex state generation
// Can be used standalone or imported

const VALID_ROTATIONS = [-5, -4, -3, -2, -1, 0, 1, 2, 3, 4, 5, 6];
const ALL_ONES_ALLOWED_ROTATIONS = [0, 2, 4, 6, -4, -2];

// Shape computation
const Shape_halflayer = [0, 3, 6, 12, 15, 24, 27, 30, 48, 51, 54, 60, 63];
const Shape_ShapeIdx = [];

function initShapes() {
    let count = 0;
    for (let i = 0; i < 28561; i++) {
        const dr = Shape_halflayer[i % 13];
        const dl = Shape_halflayer[Math.floor(i / 13) % 13];
        const ur = Shape_halflayer[Math.floor(Math.floor(i / 13) / 13) % 13];
        const ul = Shape_halflayer[Math.floor(Math.floor(Math.floor(i / 13) / 13) / 13)];
        const value = ul << 18 | ur << 12 | dl << 6 | dr;

        let bitCount = 0;
        let temp = value;
        while (temp) {
            bitCount += temp & 1;
            temp >>= 1;
        }

        if (bitCount === 16) {
            Shape_ShapeIdx[count++] = value;
        }
    }
}

// RBL utilities
function leftRotate12(s, k) {
    k = ((k % 12) + 12) % 12;
    return s.slice(k) + s.slice(0, k);
}

function rightRotate12(s, k) {
    k = ((k % 12) + 12) % 12;
    return leftRotate12(s, 12 - k);
}

function rotate12(s, rot) {
    if (!rot) return s;
    if (rot > 0) return leftRotate12(s, rot);
    if (rot < 0) return rightRotate12(s, -rot);
    return s;
}

function countLeadingOnes(s) {
    let c = 0;
    for (let i = 0; i < s.length; i++) {
        if (s[i] === '1') c++; else break;
    }
    return c;
}

function countTrailingOnes(s) {
    let c = 0;
    for (let i = s.length - 1; i >= 0; i--) {
        if (s[i] === '1') c++; else break;
    }
    return c;
}

function countOnes(s) {
    return (s.match(/1/g) || []).length;
}

function layerIsValid(s) {
    if (s.length !== 12) return false;
    const lead = countLeadingOnes(s);
    if (lead % 2 === 1) return false;
    const trail = countTrailingOnes(s);
    if (trail % 2 === 1) return false;
    if (s[5] === '1') {
        const after = s.slice(6, 12);
        const onesAfter = countOnes(after);
        if (onesAfter % 2 === 1) return false;
    }
    return true;
}

function shapeValueTo24String(val) {
    return val.toString(2).padStart(24, '0');
}

function allowedRotationsForShapeValue(val) {
    const s24 = shapeValueTo24String(val);
    const top = s24.slice(0, 12);
    const bottom = s24.slice(12, 24);

    let topAllowed = [];
    if (top === '111111111111') {
        topAllowed = [...ALL_ONES_ALLOWED_ROTATIONS];
    } else {
        for (const r of VALID_ROTATIONS) {
            const t = rotate12(top, r);
            if (layerIsValid(t)) topAllowed.push(r);
        }
    }

    let bottomAllowed = [];
    if (bottom === '111111111111') {
        bottomAllowed = [...ALL_ONES_ALLOWED_ROTATIONS];
    } else {
        for (const r of VALID_ROTATIONS) {
            const t = rotate12(bottom, r);
            if (layerIsValid(t)) bottomAllowed.push(r);
        }
    }

    return { top: topAllowed, bottom: bottomAllowed };
}

function applyRBL(scramble, rulValue, rdlValue) {
    const rulRotation = rulValue < 0 ? 12 + rulValue : rulValue;
    const rdlRotation = rdlValue < 0 ? 12 + rdlValue : rdlValue;

    let result = '';
    for (let i = 0; i < 12; i++) {
        const sourceIndex = (i + rulRotation) % 12;
        result += scramble[sourceIndex];
    }
    result += scramble[12];
    for (let i = 0; i < 12; i++) {
        const sourceIndex = 13 + ((i + rdlRotation) % 12);
        result += scramble[sourceIndex];
    }
    return result;
}

// ABF utilities
function getABFPermutations() {
    return {
        'U0': {
            '0': '0', '1': '1', '2': '2', '3': '3', '4': '4', '5': '5', '6': '6', '7': '7',
            '8': '8', '9': '9', 'a': 'a', 'b': 'b', 'c': 'c', 'd': 'd', 'e': 'e', 'f': 'f'
        },
        'U': {
            '0': '2', '1': '3', '2': '4', '3': '5', '4': '6', '5': '7', '6': '0', '7': '1',
            '8': '8', '9': '9', 'a': 'a', 'b': 'b', 'c': 'c', 'd': 'd', 'e': 'e', 'f': 'f'
        },
        'U2': {
            '0': '4', '1': '5', '2': '6', '3': '7', '4': '0', '5': '1', '6': '2', '7': '3',
            '8': '8', '9': '9', 'a': 'a', 'b': 'b', 'c': 'c', 'd': 'd', 'e': 'e', 'f': 'f'
        },
        'U\'': {
            '0': '6', '1': '7', '2': '0', '3': '1', '4': '2', '5': '3', '6': '4', '7': '5',
            '8': '8', '9': '9', 'a': 'a', 'b': 'b', 'c': 'c', 'd': 'd', 'e': 'e', 'f': 'f'
        },
        'D0': {
            '0': '0', '1': '1', '2': '2', '3': '3', '4': '4', '5': '5', '6': '6', '7': '7',
            '8': '8', '9': '9', 'a': 'a', 'b': 'b', 'c': 'c', 'd': 'd', 'e': 'e', 'f': 'f'
        },
        'D': {
            '0': '0', '1': '1', '2': '2', '3': '3', '4': '4', '5': '5', '6': '6', '7': '7',
            '8': 'a', '9': 'b', 'a': 'c', 'b': 'd', 'c': 'e', 'd': 'f', 'e': '8', 'f': '9'
        },
        'D2': {
            '0': '0', '1': '1', '2': '2', '3': '3', '4': '4', '5': '5', '6': '6', '7': '7',
            '8': 'c', '9': 'd', 'a': 'e', 'b': 'f', 'c': '8', 'd': '9', 'e': 'a', 'f': 'b'
        },
        'D\'': {
            '0': '0', '1': '1', '2': '2', '3': '3', '4': '4', '5': '5', '6': '6', '7': '7',
            '8': 'e', '9': 'f', 'a': '8', 'b': '9', 'c': 'a', 'd': 'b', 'e': 'c', 'f': 'd'
        }
    };
}

function applyABF(scramble, aufCode, adfCode) {
    if (scramble.length !== 25) {
        throw new Error('Invalid scramble length for ABF application');
    }

    const permutations = getABFPermutations();
    const topPermutation = permutations[aufCode];
    const bottomPermutation = permutations[adfCode];

    if (!topPermutation || !bottomPermutation) {
        throw new Error(`Invalid ABF codes: ${aufCode}, ${adfCode}`);
    }

    let result = '';
    for (let i = 0; i < 25; i++) {
        if (i === 12) {
            result += scramble[i];
        } else {
            const char = scramble[i].toLowerCase();
            const afterTop = topPermutation[char] || char;
            const final = bottomPermutation[afterTop] || afterTop;
            result += final;
        }
    }
    return result;
}

// Shape parsing
function parseTextInputToShape(topText, bottomText) {
    if (topText.length !== 12 || bottomText.length !== 12) {
        throw new Error('Each layer must be exactly 12 characters long!');
    }

    const fullText = topText + bottomText;
    const shapeArray = new Array(24).fill(-1);
    const constraints = {};

    for (let i = 0; i < 24;) {
        const char = fullText[i];
        const positionLabel = String.fromCharCode(65 + i);

        if (char === 'R' || char === 'r') {
            shapeArray[i] = -1;
            i++;
        } else if (char === 'E') {
            shapeArray[i] = 0;
            i++;
        } else if (char === 'C') {
            shapeArray[i] = 1;
            i++;
        } else if (char === 'W') {
            // Black edge placeholder - only 0,2,4,6
            shapeArray[i] = 0;
            constraints[positionLabel] = ['0', '2', '4', '6'];
            i++;
        } else if (char === 'X') {
            // Black corner placeholder - only 1,3,5,7
            shapeArray[i] = 1;
            
            // Check if next position can be auto-paired (look ahead) or previous was unpaired
            if (i < 23 && (fullText[i + 1] === 'R' || fullText[i + 1] === 'X')) {
                shapeArray[i + 1] = 1;
                const pairLabel = positionLabel + String.fromCharCode(65 + i + 1);
                constraints[pairLabel] = ['1', '3', '5', '7'];
                i += 2;
            } else {
                // Just mark this position, pairing will happen in cluster building
                constraints[positionLabel] = ['1', '3', '5', '7'];
                i++;
            }
        } else if (char === 'Y') {
            // White edge placeholder - only 8,a,c,e
            shapeArray[i] = 0;
            constraints[positionLabel] = ['8', 'a', 'c', 'e'];
            i++;
        } else if (char === 'Z') {
            // White corner placeholder - only 9,b,d,f
            shapeArray[i] = 1;
            
            // Check if next position can be auto-paired (look ahead)
            if (i < 23 && (fullText[i + 1] === 'R' || fullText[i + 1] === 'Z')) {
                shapeArray[i + 1] = 1;
                const pairLabel = positionLabel + String.fromCharCode(65 + i + 1);
                constraints[pairLabel] = ['9', 'b', 'd', 'f'];
                i += 2;
            } else {
                // Just mark this position, pairing will happen in cluster building
                constraints[positionLabel] = ['9', 'b', 'd', 'f'];
                i++;
            }
        } else if (/[0-9A-Fa-f]/.test(char)) {
            const isOdd = parseInt(char.toLowerCase(), 16) % 2 === 1;

            if (isOdd) {
                shapeArray[i] = 1;
                if (i < 23 && (fullText[i + 1] === 'R' || fullText[i + 1] === 'C' || fullText[i + 1] === char)) {
                    shapeArray[i + 1] = 1;
                    const pairLabel = positionLabel + String.fromCharCode(65 + i + 1);
                    constraints[pairLabel] = [char.toLowerCase()];
                    i += 2;
                } else {
                    // Just mark this position, pairing will happen in cluster building
                    constraints[positionLabel] = [char.toLowerCase()];
                    i++;
                }
            } else {
                shapeArray[i] = 0;
                constraints[positionLabel] = [char.toLowerCase()];
                i++;
            }
        } else {
            throw new Error(`Invalid character '${char}' at position ${i + 1}`);
        }
    }

    return { shapeArray, constraints };
}

function buildClustersFromShape(shapeArray) {
    const clusters = [];
    let slotIndex = 0;
    let letterIndex = 0;

    for (let i = 0; i < 24;) {
        if (shapeArray[i] === -1) {
            i++;
            continue;
        }

        if (shapeArray[i] === 1 && i < 23 && shapeArray[i + 1] === 1 &&
            i !== 11 && i !== 5 && i !== 17) {
            const label = String.fromCharCode(65 + slotIndex) + String.fromCharCode(65 + slotIndex + 1);
            clusters.push({
                type: 'corner',
                indices: [i, i + 1],
                label,
                startLetter: letterIndex,
                lettersCount: 2
            });
            i += 2; slotIndex += 2; letterIndex += 2;
        } else if (shapeArray[i] === 1) {
            const label = String.fromCharCode(65 + slotIndex);
            clusters.push({
                type: 'half-corner',
                indices: [i],
                label,
                startLetter: letterIndex,
                lettersCount: 1
            });
            i++; slotIndex++; letterIndex++;
        } else if (shapeArray[i] === 0) {
            const label = String.fromCharCode(65 + slotIndex);
            clusters.push({
                type: 'edge',
                indices: [i],
                label,
                startLetter: letterIndex,
                lettersCount: 1
            });
            i++; slotIndex++; letterIndex++;
        } else {
            throw new Error(`Unknown shape value ${shapeArray[i]} at position ${i}`);
        }
    }

    let cornerSlots = 0;
    let edgeSlots = 0;
    for (const cluster of clusters) {
        if (cluster.type === 'corner' || cluster.type === 'half-corner') {
            cornerSlots++;
        } else if (cluster.type === 'edge') {
            edgeSlots++;
        }
    }

    if (cornerSlots !== 8 || edgeSlots !== 8) {
        throw new Error(`Invalid cluster configuration`);
    }

    return clusters;
}

function shapeArrayToValue(shapeArray) {
    let value = 0;
    for (let i = 0; i < 24; i++) {
        value |= shapeArray[23 - i] << i;
    }
    return value;
}

function validateLockedPositions(shapeArray, constraints) {
    for (const [positionLabel, values] of Object.entries(constraints)) {
        const isCornerConstraint = values.some(v =>
            ['1', '3', '5', '7', '9', 'b', 'd', 'f'].includes(v)
        );

        if (!isCornerConstraint) continue;

        const testClusteredSlots = buildClustersFromShape(shapeArray);
        const slot = testClusteredSlots.find(s => s.label === positionLabel);

        if (!slot || slot.type !== 'corner') {
            return false;
        }

        let cornerCountBefore = 0;
        for (let i = 0; i < slot.startLetter; i++) {
            if (shapeArray[i] === 1) {
                cornerCountBefore++;
            }
        }

        if (cornerCountBefore % 2 !== 0) {
            return false;
        }
    }

    return true;
}

function findMatchingShapes(targetShape, lockedConstraints = {}) {
    const matchingIndexes = [];

    for (let i = 0; i < Shape_ShapeIdx.length; i++) {
        const shapeValue = Shape_ShapeIdx[i];
        const shapeArray = new Array(24);
        for (let j = 0; j < 24; j++) {
            shapeArray[23 - j] = (shapeValue >> j) & 1;
        }

        if (!validateLockedPositions(shapeArray, lockedConstraints)) {
            continue;
        }

        let matches = true;
        for (let pos = 0; pos < 24; pos++) {
            if (targetShape[pos] !== -1) {
                if (targetShape[pos] !== shapeArray[pos]) {
                    matches = false;
                    break;
                }
            }
        }

        if (matches) {
            matchingIndexes.push(i);
        }
    }

    return matchingIndexes;
}

// Parity utilities
const CANONICAL_SETS = {
    topEdges: ['0', '2', '4', '6'],
    topCorners: ['1', '3', '5', '7'],
    bottomEdges: ['8', 'a', 'c', 'e'],
    bottomCorners: ['9', 'b', 'd', 'f'],
    overallEdges: ['0', '2', '4', '6', '8', 'a', 'c', 'e'],
    overallCorners: ['1', '3', '5', '7', '9', 'b', 'd', 'f']
};

function countSwaps(arr, canonical) {
    arr = [...arr];
    let swaps = 0;
    for (let i = 0; i < arr.length; i++) {
        const j = arr.indexOf(canonical[i]);
        if (j !== i) {
            [arr[i], arr[j]] = [arr[j], arr[i]];
            swaps++;
        }
    }
    return swaps;
}

function checkParity(assignment, clusteredSlots, parityMode) {
    // Extract pieces by type and position
    const topCorners = [];
    const topEdges = [];
    const bottomCorners = [];
    const bottomEdges = [];

    for (let i = 0; i < clusteredSlots.length; i++) {
        const slot = clusteredSlots[i];
        const piece = assignment[i];
        const isTop = slot.indices[0] < 12;

        if (slot.type === 'corner') {
            if (isTop) topCorners.push(piece);
            else bottomCorners.push(piece);
        } else {
            if (isTop) topEdges.push(piece);
            else bottomEdges.push(piece);
        }
    }

    // Calculate swaps based on mode
    if (parityMode === 'tnbn') {
        const topSwaps = countSwaps(topEdges, CANONICAL_SETS.topEdges) + 
                        countSwaps(topCorners, CANONICAL_SETS.topCorners);
        const bottomSwaps = countSwaps(bottomEdges, CANONICAL_SETS.bottomEdges) + 
                           countSwaps(bottomCorners, CANONICAL_SETS.bottomCorners);
        return topSwaps % 2 === 0 && bottomSwaps % 2 === 0;
    } else if (parityMode === 'tpbn') {
        const topSwaps = countSwaps(topEdges, CANONICAL_SETS.topEdges) + 
                        countSwaps(topCorners, CANONICAL_SETS.topCorners);
        const bottomSwaps = countSwaps(bottomEdges, CANONICAL_SETS.bottomEdges) + 
                           countSwaps(bottomCorners, CANONICAL_SETS.bottomCorners);
        return topSwaps % 2 === 1 && bottomSwaps % 2 === 0;
    } else if (parityMode === 'tnbp') {
        const topSwaps = countSwaps(topEdges, CANONICAL_SETS.topEdges) + 
                        countSwaps(topCorners, CANONICAL_SETS.topCorners);
        const bottomSwaps = countSwaps(bottomEdges, CANONICAL_SETS.bottomEdges) + 
                           countSwaps(bottomCorners, CANONICAL_SETS.bottomCorners);
        return topSwaps % 2 === 0 && bottomSwaps % 2 === 1;
    } else if (parityMode === 'tpbp') {
        const topSwaps = countSwaps(topEdges, CANONICAL_SETS.topEdges) + 
                        countSwaps(topCorners, CANONICAL_SETS.topCorners);
        const bottomSwaps = countSwaps(bottomEdges, CANONICAL_SETS.bottomEdges) + 
                           countSwaps(bottomCorners, CANONICAL_SETS.bottomCorners);
        return topSwaps % 2 === 1 && bottomSwaps % 2 === 1;
    } else if (parityMode === 'op') {
        const allCorners = [...topCorners, ...bottomCorners];
        const allEdges = [...topEdges, ...bottomEdges];
        const totalSwaps = countSwaps(allEdges, CANONICAL_SETS.overallEdges) + 
                          countSwaps(allCorners, CANONICAL_SETS.overallCorners);
        return totalSwaps % 2 === 1;
    } else if (parityMode === 'on') {
        const allCorners = [...topCorners, ...bottomCorners];
        const allEdges = [...topEdges, ...bottomEdges];
        const totalSwaps = countSwaps(allEdges, CANONICAL_SETS.overallEdges) + 
                          countSwaps(allCorners, CANONICAL_SETS.overallCorners);
        return totalSwaps % 2 === 0;
    }
    return false;
}

function findSwappablePairs(assignment, clusteredSlots, constraints, originalInputTop, originalInputBottom) {
    // Find pairs of slots that can be swapped to fix parity
    const swappable = { corners: [], edges: [] };
    const fullInput = originalInputTop + originalInputBottom;

    for (let i = 0; i < clusteredSlots.length; i++) {
        const slotA = clusteredSlots[i];
        const pieceA = assignment[i];
        const constraintA = constraints[slotA.label] || [];
        
        // Determine placeholder type from original input
        let placeholderA = null;
        if (slotA.indices.length === 2) {
            placeholderA = fullInput[slotA.indices[0]];
        } else {
            placeholderA = fullInput[slotA.indices[0]];
        }

        for (let j = i + 1; j < clusteredSlots.length; j++) {
            const slotB = clusteredSlots[j];
            const pieceB = assignment[j];
            const constraintB = constraints[slotB.label] || [];

            // Must be same type
            if (slotA.type !== slotB.type) continue;

            // Determine placeholder type for slot B
            let placeholderB = null;
            if (slotB.indices.length === 2) {
                placeholderB = fullInput[slotB.indices[0]];
            } else {
                placeholderB = fullInput[slotB.indices[0]];
            }

            // Check if placeholders are compatible for swapping
            const canSwap = (
                (placeholderA === placeholderB) || // Same placeholder type
                (placeholderA === 'R' || placeholderB === 'R') || // Universal placeholder
                (placeholderA === 'C' && placeholderB === 'C') || // Both any corner
                (placeholderA === 'E' && placeholderB === 'E') || // Both any edge
                (placeholderA === 'X' && placeholderB === 'X') || // Both black corner
                (placeholderA === 'Z' && placeholderB === 'Z') || // Both white corner
                (placeholderA === 'W' && placeholderB === 'W') || // Both black edge
                (placeholderA === 'Y' && placeholderB === 'Y')    // Both white edge
            );

            if (!canSwap) continue;

            // Check if swap satisfies constraints
            const aCanTakeB = constraintA.length === 0 || constraintA.includes(pieceB);
            const bCanTakeA = constraintB.length === 0 || constraintB.includes(pieceA);

            if (aCanTakeB && bCanTakeA) {
                if (slotA.type === 'corner') {
                    swappable.corners.push([i, j]);
                } else {
                    swappable.edges.push([i, j]);
                }
            }
        }
    }

    return swappable;
}

function attemptParityFix(assignment, clusteredSlots, constraints, parityMode, originalInputTop, originalInputBottom) {
    const swappable = findSwappablePairs(assignment, clusteredSlots, constraints, originalInputTop, originalInputBottom);
    
    // Try swapping corners first, then edges
    const allPairs = [...swappable.corners, ...swappable.edges];
    
    for (const [i, j] of allPairs) {
        // Swap pieces
        [assignment[i], assignment[j]] = [assignment[j], assignment[i]];
        
        // Check if parity is now satisfied
        if (checkParity(assignment, clusteredSlots, parityMode)) {
            return true;
        }
        
        // Swap back
        [assignment[i], assignment[j]] = [assignment[j], assignment[i]];
    }
    
    return false;
}

// Solver
function solveWithBacktracking(clusteredSlots, constraints, parityModes, originalInputTop, originalInputBottom) {
    const availableCorners = ['1', '3', '5', '7', '9', 'b', 'd', 'f'];
    const availableEdges = ['0', '2', '4', '6', '8', 'a', 'c', 'e'];

    let cornerSlotsCount = 0;
    let edgeSlotsCount = 0;

    for (const slot of clusteredSlots) {
        if (slot.type === 'corner') {
            cornerSlotsCount++;
        } else if (slot.type === 'edge') {
            edgeSlotsCount++;
        }
    }

    if (cornerSlotsCount !== 8 || edgeSlotsCount !== 8) {
        throw new Error('Invalid slot configuration');
    }

    // Determine if we should skip parity checks
    const skipParity = parityModes.length === 0 || 
                      (parityModes.includes('op') && parityModes.includes('on')) ||
                      (['tnbn', 'tpbn', 'tnbp', 'tpbp'].every(mode => parityModes.includes(mode)));
    
    // If no parity modes specified and not skipping, default to 'on' (overall no parity)
    const modesArray = skipParity ? ['skip'] : (parityModes && parityModes.length > 0 ? parityModes : ['on']);
    
    // Shuffle parity modes for random selection
    const shuffledModes = [...modesArray];
    for (let i = shuffledModes.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffledModes[i], shuffledModes[j]] = [shuffledModes[j], shuffledModes[i]];
    }

    // Try each parity mode
    for (const parityMode of shuffledModes) {
        const startTime = Date.now();
        const maxTime = 100; // 100ms timeout per mode
        let attempts = 0;

        while (Date.now() - startTime < maxTime) {
            attempts++;
            const usedPieces = new Set();
            const assignment = new Array(clusteredSlots.length).fill(null);

            function backtrack(slotIndex) {
                if (slotIndex >= clusteredSlots.length) {
                    return true;
                }

                const slot = clusteredSlots[slotIndex];
                const constraint = constraints[slot.label];

                const availablePieces = slot.type === 'corner' ? availableCorners : availableEdges;

                let possiblePieces;
                if (constraint && constraint.length > 0) {
                    possiblePieces = constraint.filter(piece =>
                        availablePieces.includes(piece) && !usedPieces.has(piece)
                    );
                } else {
                    possiblePieces = availablePieces.filter(piece => !usedPieces.has(piece));
                }

                // Shuffle for randomness
                for (let i = possiblePieces.length - 1; i > 0; i--) {
                    const j = Math.floor(Math.random() * (i + 1));
                    [possiblePieces[i], possiblePieces[j]] = [possiblePieces[j], possiblePieces[i]];
                }

                for (const piece of possiblePieces) {
                    assignment[slotIndex] = piece;
                    usedPieces.add(piece);

                    if (backtrack(slotIndex + 1)) {
                        return true;
                    }

                    assignment[slotIndex] = null;
                    usedPieces.delete(piece);
                }

                return false;
            }

            const success = backtrack(0);
            
            if (success) {
                // Skip parity check if specified
                if (parityMode === 'skip') {
                    return assignment;
                }
                
                // Check parity
                if (checkParity(assignment, clusteredSlots, parityMode)) {
                    return assignment;
                }
                
                // Try to fix parity by swapping compatible pieces
                if (attemptParityFix(assignment, clusteredSlots, constraints, parityMode, originalInputTop, originalInputBottom)) {
                    return assignment;
                }
            }
        }
    }

    return null;
}

// Main generation function
function generateHexState(config) {
    const {
        topLayer,
        bottomLayer,
        middleLayer = ['/'],
        RUL = [0],
        RDL = [0],
        AUF = ['U0'],
        ADF = ['D0'],
        constraints = {},
        parity = []  // Default to skip parity check
    } = config;

    // Parse input
    const { shapeArray, constraints: parsedConstraints } = parseTextInputToShape(topLayer, bottomLayer);
    const allConstraints = { ...parsedConstraints, ...constraints };

    let finalShapeArray = [...shapeArray];
    let shapeIndex = -1;

    // Check completeness
    let corners = 0, edges = 0;
    for (let i = 0; i < 24; i++) {
        if (finalShapeArray[i] === 1) corners++;
        else if (finalShapeArray[i] === 0) edges++;
    }

    if (corners !== 16 || edges !== 8) {
        const matchingShapes = findMatchingShapes(finalShapeArray, allConstraints);
        if (matchingShapes.length === 0) {
            throw new Error('No valid shapes match');
        }

        shapeIndex = matchingShapes[Math.floor(Math.random() * matchingShapes.length)];
        const shape = Shape_ShapeIdx[shapeIndex];

        for (let i = 0; i < 24; i++) {
            finalShapeArray[23 - i] = (shape >> i) & 1;
        }
    } else {
        const shapeValue = shapeArrayToValue(finalShapeArray);
        shapeIndex = Shape_ShapeIdx.indexOf(shapeValue);
        if (shapeIndex === -1) {
            throw new Error('Invalid shape');
        }
    }

    const clusteredSlots = buildClustersFromShape(finalShapeArray);
    const normalizedSlots = clusteredSlots.map(slot => ({
        ...slot,
        type: slot.type === 'half-corner' ? 'corner' : slot.type
    }));

    const solution = solveWithBacktracking(normalizedSlots, allConstraints, parity, topLayer, bottomLayer);
    if (!solution) {
        throw new Error('No solution found with any specified parity mode');
    }

    // Build base scramble
    let baseScramble = '';
    const positionToPiece = new Array(24);
    
    for (let i = 0; i < clusteredSlots.length; i++) {
        const slot = clusteredSlots[i];
        const piece = solution[i];

        if (slot.type === 'corner' && slot.indices.length === 2) {
            positionToPiece[slot.indices[0]] = piece;
            positionToPiece[slot.indices[1]] = piece;
        } else {
            positionToPiece[slot.indices[0]] = piece;
        }
    }

    for (let i = 0; i < 12; i++) {
        baseScramble += positionToPiece[i];
    }

    const equator = middleLayer[Math.floor(Math.random() * middleLayer.length)];
    baseScramble += equator;

    for (let i = 12; i < 24; i++) {
        baseScramble += positionToPiece[i];
    }

    // Apply ABF
    const selectedAUF = AUF[Math.floor(Math.random() * AUF.length)];
    const selectedADF = ADF[Math.floor(Math.random() * ADF.length)];
    let scrambleAfterABF = applyABF(baseScramble, selectedAUF, selectedADF);

    // Apply RBL with shape validation
    const validRotations = allowedRotationsForShapeValue(Shape_ShapeIdx[shapeIndex]);
    const validRUL = RUL.filter(r => validRotations.top.includes(r));
    const validRDL = RDL.filter(r => validRotations.bottom.includes(r));

    if (validRUL.length === 0 || validRDL.length === 0) {
        throw new Error('No valid RBL rotations for this shape');
    }

    const selectedRUL = validRUL[Math.floor(Math.random() * validRUL.length)];
    const selectedRDL = validRDL[Math.floor(Math.random() * validRDL.length)];
    const finalScramble = applyRBL(scrambleAfterABF, selectedRUL, selectedRDL);

    return {
        hexState: finalScramble,
        baseScramble,
        equator,
        abf: `${selectedAUF}-${selectedADF}`,
        rbl: `RUL:${selectedRUL}, RDL:${selectedRDL}`,
        shapeIndex
    };
}

// Initialize on load
initShapes();

// Test cases
const testCases = [
    /*
    {
        topLayer: 'RRRRRRRRRRRR',
        bottomLayer: 'RRRRRRRRRRRR',
        middleLayer: ['/', '|'],
        RUL: [0, 3, -3, 6],
        RDL: [0, 3, -3, 6],
        AUF: ['U0', 'U', 'U2', 'U\''],
        ADF: ['D0', 'D', 'D2', 'D\''],
        constraints: {}
    },
    {
        topLayer: '011233554776',
        bottomLayer: '998bbaddffce',
        middleLayer: ['/'],
        RUL: [0],
        RDL: [0],
        AUF: ['U0'],
        ADF: ['D0'],
        constraints: {}
    },
    {
        // Case with mixed placeholders and constraints
        topLayer: '1REECCEECCEC',
        bottomLayer: 'CCECCECCECCE',
        middleLayer: ['/', '|'],
        RUL: [0, 3, -3],
        RDL: [0, 3, -3],
        AUF: ['U0', 'U'],
        ADF: ['D0', 'D'],
        constraints: {
            'AB': ['1'],  // First corner must be piece '1'
            'C': ['0', '2'],  // This edge can be '0' or '2'
            'M': ['4', '6']   // Another edge constraint
        }
    },
    
    {
        // Case with specific piece constraints
        topLayer: 'CCCCCCCCCCCC',
        bottomLayer: 'RRRRRRRRRRRR',
        middleLayer: ['/'],
        RUL: [0, 2, 4],
        RDL: [0, -2, -4],
        AUF: ['U0'],
        ADF: ['D0'],
        constraints: {
            'AB': ['1', '3'],  // Top-left corner can be '1' or '3'
            'CD': ['5', '7'],  // Another corner constraint
          //  'W': ['e'],        // Specific edge must be 'e'
           // 'X': ['a', 'c']    // Edge can be 'a' or 'c'
        }
    },*/
    {
        // Complex case with multiple constraints
        topLayer: 'WXXWXXWXXWXX',
        bottomLayer: 'ZZYZZYZZYZZY',
        middleLayer: ['|'],
        RUL: [0,2,5],
        RDL: [0,-2,-5],
        AUF: ['U0'],
        ADF: ['D0'],
        constraints: {
          //  'BC': ['3'],       // First corner locked to piece '3'
          //  'G': ['2'],        // Specific edge
            //'HI': ['1', '5'],   // Edge with options
            //'Q': ['8', 'a', 'c'],  // Multiple edge options
            //'ST': ['b', 'd']   // Bottom corner constraint
        },
        parity: ['tpbp']
    }
];

// Export for browser
if (typeof window !== 'undefined') {
    window.generateHexState = generateHexState;
    window.testCases = testCases;
}

export { generateHexState, testCases };

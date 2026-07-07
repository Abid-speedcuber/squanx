// ========================================
// Square-1 Interactive Scramble Visualizer
// Modular, State-Based Architecture
// ========================================

// === COLOR CONFIGURATION ===
const DEFAULT_COLOR_SCHEME = {
    topColor: '#000000',
    bottomColor: '#FFFFFF',
    frontColor: '#CC0000',
    rightColor: '#00AA00',
    backColor: '#FF8C00',
    leftColor: '#0066CC',
    placeholderEdge: '#888888',
    placeholderCorner: '#888888',
    placeholderBlackEdge: '#000000ff',
    placeholderBlackCorner: '#000000ff',
    placeholderWhiteEdge: '#ffffffff',
    placeholderWhiteCorner: '#ffffffff',
    emptyFill: '#f6f6f6ff',
    emptyStroke: '#d0d0d0',
    ringStroke: 'transparent'
};

// === PIECE DEFINITIONS FACTORY ===
function createPieceDefinitions(colorScheme = DEFAULT_COLOR_SCHEME) {
    return {
        // Edges (even hex values)
        '0': { type: 'edge', colors: { inner: colorScheme.topColor, outer: colorScheme.backColor } },
        '2': { type: 'edge', colors: { inner: colorScheme.topColor, outer: colorScheme.leftColor } },
        '4': { type: 'edge', colors: { inner: colorScheme.topColor, outer: colorScheme.frontColor } },
        '6': { type: 'edge', colors: { inner: colorScheme.topColor, outer: colorScheme.rightColor } },
        '8': { type: 'edge', colors: { inner: colorScheme.bottomColor, outer: colorScheme.rightColor } },
        'a': { type: 'edge', colors: { inner: colorScheme.bottomColor, outer: colorScheme.frontColor } },
        'c': { type: 'edge', colors: { inner: colorScheme.bottomColor, outer: colorScheme.leftColor } },
        'e': { type: 'edge', colors: { inner: colorScheme.bottomColor, outer: colorScheme.backColor } },
        'E': { type: 'edge', colors: { inner: colorScheme.placeholderEdge, outer: colorScheme.placeholderEdge } },

        // Corners (odd hex values)
        '1': { type: 'corner', colors: { top: colorScheme.topColor, left: colorScheme.leftColor, right: colorScheme.backColor } },
        '3': { type: 'corner', colors: { top: colorScheme.topColor, left: colorScheme.frontColor, right: colorScheme.leftColor } },
        '5': { type: 'corner', colors: { top: colorScheme.topColor, left: colorScheme.rightColor, right: colorScheme.frontColor } },
        '7': { type: 'corner', colors: { top: colorScheme.topColor, left: colorScheme.backColor, right: colorScheme.rightColor } },
        '9': { type: 'corner', colors: { top: colorScheme.bottomColor, left: colorScheme.rightColor, right: colorScheme.backColor } },
        'b': { type: 'corner', colors: { top: colorScheme.bottomColor, left: colorScheme.frontColor, right: colorScheme.rightColor } },
        'd': { type: 'corner', colors: { top: colorScheme.bottomColor, left: colorScheme.leftColor, right: colorScheme.frontColor } },
        'f': { type: 'corner', colors: { top: colorScheme.bottomColor, left: colorScheme.backColor, right: colorScheme.leftColor } },
        'C': { type: 'corner', colors: { top: colorScheme.placeholderCorner, left: colorScheme.placeholderCorner, right: colorScheme.placeholderCorner },  },

        // Placeholders
        'W': { type: 'edge', colors: { inner: colorScheme.placeholderBlackEdge, outer: colorScheme.placeholderBlackEdge } },
        'X': { type: 'corner', colors: { top: colorScheme.placeholderBlackCorner, left: colorScheme.placeholderBlackCorner, right: colorScheme.placeholderBlackCorner } },
        'Y': { type: 'edge', colors: { inner: colorScheme.placeholderWhiteEdge, outer: colorScheme.placeholderWhiteEdge } },
        'Z': { type: 'corner', colors: { top: colorScheme.placeholderWhiteCorner, left: colorScheme.placeholderWhiteCorner, right: colorScheme.placeholderWhiteCorner } },

        // Empty/Rest
        'R': { type: 'empty', colors: { fill: colorScheme.emptyFill, stroke: colorScheme.emptyStroke } }
    };
}

const EDGE_PIECES = ['0', '2', '4', '6', '8', 'a', 'c', 'e', 'E', 'W', 'Y', 'R'];
const CORNER_PIECES = ['1', '3', '5', '7', '9', 'b', 'd', 'f', 'C', 'X', 'Z', 'R'];

// === STATE MANAGEMENT ===
class InteractiveScrambleState {
    constructor(topText, bottomText, colorScheme = DEFAULT_COLOR_SCHEME) {
        // Normalize inputs - top is always 12 chars, bottom is 12 chars (no | prefix needed)
        this.topText = topText || '';
        this.bottomText = bottomText || '';

        this.colorScheme = colorScheme;
        this.pieceDefinitions = createPieceDefinitions(colorScheme);
        this.shapeArray = null;
        this.clusters = null;
        this.listeners = [];

        this.parse();
    }

    parse() {
        try {
            // Validate layer lengths
            if (this.topText && this.topText.length !== 12) {
                throw new Error(`Top layer must be exactly 12 characters (currently ${this.topText.length})`);
            }
            if (this.bottomText && this.bottomText.length !== 12) {
                throw new Error(`Bottom layer must be exactly 12 characters (currently ${this.bottomText.length})`);
            }

            // Parse each layer independently
            const topValid = this.topText && this.topText.length === 12;
            const bottomValid = this.bottomText && this.bottomText.length === 12;

            if (!topValid && !bottomValid) {
                this.shapeArray = null;
                this.clusters = null;
                return;
            }

            // Build combined text for parsing
            const topPart = topValid ? this.topText : 'RRRRRRRRRRRR';
            const bottomPart = bottomValid ? this.bottomText : 'RRRRRRRRRRRR';

            const result = parseTextInputToShape(topPart, bottomPart);
            this.shapeArray = result.shapeArray;
            this.clusters = buildClustersFromShape(this.shapeArray, topPart, bottomPart);
        } catch (error) {
            console.error('Parse error:', error);
            this.shapeArray = null;
            this.clusters = null;
        }
    }

    updatePiece(position, layer, newPiece) {
        const textPosition = layer === 'top' ? position : position - 12;

        if (layer === 'top') {
            if (this.topText.length === 12) {
                this.topText = this.topText.substring(0, textPosition) + newPiece + this.topText.substring(textPosition + 1);
            }
        } else {
            if (this.bottomText.length === 12) {
                this.bottomText = this.bottomText.substring(0, textPosition) + newPiece + this.bottomText.substring(textPosition + 1);
            }
        }

        this.parse();
        this.notifyListeners();
    }

    getText(layer) {
        if (layer === 'top') {
            return this.topText;
        } else {
            return this.bottomText;
        }
    }

    getFullText() {
        const topPart = this.topText || '';
        const bottomPart = this.bottomText || '';
        return topPart + bottomPart;
    }

    onChange(callback) {
        this.listeners.push(callback);
    }

    notifyListeners() {
        this.listeners.forEach(cb => cb(this));
    }
}

// === PARSING FUNCTIONS (from draw-scramble.js) ===
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
            
            // Check if next position can be auto-paired
            if (i < 23 && (fullText[i + 1] === 'R' || fullText[i + 1] === 'X')) {
                shapeArray[i + 1] = 1;
                const pairLabel = positionLabel + String.fromCharCode(65 + i + 1);
                constraints[pairLabel] = ['1', '3', '5', '7'];
                i += 2;
            } else {
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
            
            // Check if next position can be auto-paired
            if (i < 23 && (fullText[i + 1] === 'R' || fullText[i + 1] === 'Z')) {
                shapeArray[i + 1] = 1;
                const pairLabel = positionLabel + String.fromCharCode(65 + i + 1);
                constraints[pairLabel] = ['9', 'b', 'd', 'f'];
                i += 2;
            } else {
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
                    constraints[positionLabel] = [char.toLowerCase()];
                    i++;
                }
            } else {
                shapeArray[i] = 0;
                constraints[positionLabel] = [char.toLowerCase()];
                i++;
            }
        } else {
            throw new Error(`Invalid character '${char}' at position ${i + 1}. Use R, E, C, W, X, Y, Z, or 0-F.`);
        }
    }

    return { shapeArray, constraints };
}

function buildClustersFromShape(shapeArray, topText, bottomText) {
    const clusters = [];
    const fullInput = topText + bottomText;

    for (let i = 0; i < 24; i++) {
        if (shapeArray[i] === -1) {
            clusters.push({
                type: 'empty',
                indices: [i],
                label: String.fromCharCode(65 + i),
                startLetter: i,
                lettersCount: 1
            });
            continue;
        }

        // Check if we can form a corner cluster
        const canFormCluster = shapeArray[i] === 1 && i < 23 && shapeArray[i + 1] === 1 &&
            i !== 11 && i !== 5 && i !== 17 &&
            !(i === 0 && (i + 1) === 23) &&
            !(i === 5 && (i + 1) === 6) &&
            !(i === 12 && (i + 1) === 23) &&
            !(i === 17 && (i + 1) === 18) &&
            fullInput[i] === fullInput[i + 1] &&
            fullInput[i] !== 'R';

        if (canFormCluster) {
            clusters.push({
                type: 'corner',
                indices: [i, i + 1],
                label: String.fromCharCode(65 + i) + String.fromCharCode(65 + i + 1),
                startLetter: i,
                lettersCount: 2
            });
            i++;
        } else if (shapeArray[i] === 1) {
            clusters.push({
                type: 'half-corner',
                indices: [i],
                label: String.fromCharCode(65 + i),
                startLetter: i,
                lettersCount: 1
            });
        } else {
            clusters.push({
                type: 'edge',
                indices: [i],
                label: String.fromCharCode(65 + i),
                startLetter: i,
                lettersCount: 1
            });
        }
    }

    return clusters;
}

// === GEOMETRY HELPERS ===
function polarToCartesian(cx, cy, radius, angleDeg) {
    const a = angleDeg * Math.PI / 180;
    return { x: cx + radius * Math.cos(a), y: cy - radius * Math.sin(a) };
}

function pointsToString(pts) {
    return pts.map(p => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' ');
}

function lerpPoint(a, b, t) {
    return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

// === PIECE USAGE TRACKING ===
function getUsedPieces(fullText, excludePosition) {
    return []; // No restrictions - all pieces always available
}

// === SVG RENDERING ===
function renderCluster(cluster, state, targetCx, targetCy, centerAngle, layer, position, dimensions) {
    const { r_inner, r_outer, r_outer_apex } = dimensions;
    const pieceStroke = dimensions.colorScheme?.pieceStroke || '#333';
    const half = cluster.type === 'corner' ? 30 : 15;
    let mainSVG = '';
    let interactionZones = '';
    let textLabels = '';

    const textPosition = layer === 'top' ? position : position - 12;
    const currentPiece = state.getText(layer)[textPosition];
    const pieceData = state.pieceDefinitions[currentPiece] || state.pieceDefinitions['R'];

    if (textPosition < 0 || textPosition >= 12 || !currentPiece) {
        return { mainSVG: '', interactionZones: '', textLabels: '' };
    }

    const isClusteredCorner = cluster.type === 'corner' && cluster.indices.length === 2;

    // Render main piece visual
    // IMPORTANT: Always check pieceData.type first, not cluster.type!
    // cluster.type tells us the SHAPE, pieceData.type tells us what's ACTUALLY there
    if (pieceData.type === 'edge' || pieceData.type === 'empty') {
        const pInner = polarToCartesian(targetCx, targetCy, r_inner, centerAngle);
        const pA = polarToCartesian(targetCx, targetCy, r_outer, centerAngle - half);
        const pB = polarToCartesian(targetCx, targetCy, r_outer, centerAngle + half);

        if (currentPiece === 'R') {
            mainSVG += `<polygon points="${pointsToString([pInner, pA, pB])}" fill="${pieceData.colors.fill}" stroke="${pieceData.colors.stroke}" stroke-width="0.6" pointer-events="none"/>`;
        } else if (currentPiece === 'E') {
            const midRadius = r_inner + (r_outer - r_inner) * 0.8;
            const pMidA = polarToCartesian(targetCx, targetCy, midRadius, centerAngle - half);
            const pMidB = polarToCartesian(targetCx, targetCy, midRadius, centerAngle + half);

            mainSVG += `<polygon points="${pointsToString([pMidA, pA, pB, pMidB])}" fill="${pieceData.colors.outer}" stroke="${pieceStroke}" stroke-width="1" pointer-events="none"/>`;
            mainSVG += `<polygon points="${pointsToString([pInner, pMidA, pMidB])}" fill="${pieceData.colors.inner}" stroke="${pieceStroke}" stroke-width="0.8" pointer-events="none"/>`;
        } else {
            const midRadius = r_inner + (r_outer - r_inner) * 0.8;
            const pMidA = polarToCartesian(targetCx, targetCy, midRadius, centerAngle - half);
            const pMidB = polarToCartesian(targetCx, targetCy, midRadius, centerAngle + half);

            mainSVG += `<polygon points="${pointsToString([pMidA, pA, pB, pMidB])}" fill="${pieceData.colors.outer}" stroke="${pieceStroke}" stroke-width="1" pointer-events="none"/>`;
            mainSVG += `<polygon points="${pointsToString([pInner, pMidA, pMidB])}" fill="${pieceData.colors.inner}" stroke="${pieceStroke}" stroke-width="0.8" pointer-events="none"/>`;
        }
    } else if (pieceData.type === 'corner') {
        const pInner = polarToCartesian(targetCx, targetCy, r_inner, centerAngle);
        const pOuterR = polarToCartesian(targetCx, targetCy, r_outer, centerAngle - half);
        const pApex = polarToCartesian(targetCx, targetCy, r_outer_apex, centerAngle);
        const pOuterL = polarToCartesian(targetCx, targetCy, r_outer, centerAngle + half);

        if (currentPiece === 'C') {
            const scale = 0.80;
            const pSmallL = lerpPoint(pInner, pOuterL, scale);
            const pSmallR = lerpPoint(pInner, pOuterR, scale);
            const pSmallBottom = lerpPoint(pInner, pApex, scale);

            mainSVG += `<polygon points="${pointsToString([pInner, pOuterL, pApex, pSmallBottom, pSmallL])}" fill="${pieceData.colors.left}" stroke="${pieceStroke}" stroke-width="1" pointer-events="none"/>`;
            mainSVG += `<polygon points="${pointsToString([pInner, pSmallR, pSmallBottom, pApex, pOuterR])}" fill="${pieceData.colors.right}" stroke="${pieceStroke}" stroke-width="1" pointer-events="none"/>`;
            mainSVG += `<polygon points="${pointsToString([pInner, pSmallL, pSmallBottom, pSmallR])}" fill="${pieceData.colors.top}" stroke="${pieceStroke}" stroke-width="0.8" pointer-events="none"/>`;
            mainSVG += `<polygon points="${pointsToString([pInner, pOuterL, pApex, pOuterR])}" fill="none" stroke="${pieceStroke}" stroke-width="1" pointer-events="none"/>`;
            mainSVG += `<line x1="${pApex.x.toFixed(2)}" y1="${pApex.y.toFixed(2)}" x2="${pSmallBottom.x.toFixed(2)}" y2="${pSmallBottom.y.toFixed(2)}" stroke="${pieceStroke}" stroke-width="1" stroke-linecap="round" pointer-events="none"/>`;
        } else {
            const scale = 0.80;
            const pSmallL = lerpPoint(pInner, pOuterL, scale);
            const pSmallR = lerpPoint(pInner, pOuterR, scale);
            const pSmallBottom = lerpPoint(pInner, pApex, scale);

            mainSVG += `<polygon points="${pointsToString([pInner, pOuterL, pApex, pSmallBottom, pSmallL])}" fill="${pieceData.colors.left}" stroke="${pieceStroke}" stroke-width="1" pointer-events="none"/>`;
            mainSVG += `<polygon points="${pointsToString([pInner, pSmallR, pSmallBottom, pApex, pOuterR])}" fill="${pieceData.colors.right}" stroke="${pieceStroke}" stroke-width="1" pointer-events="none"/>`;
            mainSVG += `<polygon points="${pointsToString([pInner, pSmallL, pSmallBottom, pSmallR])}" fill="${pieceData.colors.top}" stroke="${pieceStroke}" stroke-width="0.8" pointer-events="none"/>`;
            mainSVG += `<polygon points="${pointsToString([pInner, pOuterL, pApex, pOuterR])}" fill="none" stroke="${pieceStroke}" stroke-width="1" pointer-events="none"/>`;
            mainSVG += `<line x1="${pApex.x.toFixed(2)}" y1="${pApex.y.toFixed(2)}" x2="${pSmallBottom.x.toFixed(2)}" y2="${pSmallBottom.y.toFixed(2)}" stroke="${pieceStroke}" stroke-width="1" stroke-linecap="round" pointer-events="none"/>`;
        }
    }

    // Add interaction zones (both edge and corner)
    const { ringR, cornerRingR, unitSize } = dimensions;
    const edgeInnerR = 0;
    const edgeOuterR = ringR;
    const cornerInnerR = ringR - Math.round(unitSize * 0.40);
    const cornerOuterR = cornerRingR;

    // Add edge interaction zone (main clickable area)
    const edgeSegmentHalf = cluster.type === 'corner' ? 30 : 15;
    const edgeP1 = polarToCartesian(targetCx, targetCy, edgeInnerR, centerAngle - edgeSegmentHalf);
    const edgeP2 = polarToCartesian(targetCx, targetCy, edgeOuterR, centerAngle - edgeSegmentHalf);
    const edgeP3 = polarToCartesian(targetCx, targetCy, edgeOuterR, centerAngle + edgeSegmentHalf);
    const edgeP4 = polarToCartesian(targetCx, targetCy, edgeInnerR, centerAngle + edgeSegmentHalf);

    interactionZones += `<polygon points="${pointsToString([edgeP1, edgeP2, edgeP3, edgeP4])}" 
                   fill="transparent" stroke="none"
                   class="edge-interaction-zone" 
                   data-position="${position}" 
                   data-layer="${layer}" 
                   style="cursor: pointer; pointer-events: all;"/>`;

    // Add corner interaction zones (on top of edge zones)
    if (isClusteredCorner) {
        cluster.indices.forEach((idx, zoneIndex) => {
            const zoneAngle = centerAngle + (zoneIndex === 0 ? -15 : 15);
            const cornerSegmentHalf = 15;

            const cornerP1 = polarToCartesian(targetCx, targetCy, cornerInnerR, zoneAngle - cornerSegmentHalf);
            const cornerP2 = polarToCartesian(targetCx, targetCy, cornerOuterR, zoneAngle - cornerSegmentHalf);
            const cornerP3 = polarToCartesian(targetCx, targetCy, cornerOuterR, zoneAngle + cornerSegmentHalf);
            const cornerP4 = polarToCartesian(targetCx, targetCy, cornerInnerR, zoneAngle + cornerSegmentHalf);

            interactionZones += `<polygon points="${pointsToString([cornerP1, cornerP2, cornerP3, cornerP4])}" 
                     fill="rgba(0,0,0,0.05)" stroke="rgba(0,0,0,0.3)" stroke-width="0.8"
                     class="corner-interaction-zone" 
                     data-position="${idx}" 
                     data-layer="${layer}" 
                     style="cursor: pointer; pointer-events: all;"/>`;
        });
    } else {
        const cornerSegmentHalf = 15;
        const cornerP1 = polarToCartesian(targetCx, targetCy, cornerInnerR, centerAngle - cornerSegmentHalf);
        const cornerP2 = polarToCartesian(targetCx, targetCy, cornerOuterR, centerAngle - cornerSegmentHalf);
        const cornerP3 = polarToCartesian(targetCx, targetCy, cornerOuterR, centerAngle + cornerSegmentHalf);
        const cornerP4 = polarToCartesian(targetCx, targetCy, cornerInnerR, centerAngle + cornerSegmentHalf);

        interactionZones += `<polygon points="${pointsToString([cornerP1, cornerP2, cornerP3, cornerP4])}" 
                   fill="rgba(0,0,0,0.05)" stroke="rgba(0,0,0,0.3)" stroke-width="0.8"
                   class="corner-interaction-zone" 
                   data-position="${position}" 
                   data-layer="${layer}" 
                   style="cursor: pointer; pointer-events: all;"/>`;
    }

    // Add text label (separate from interaction zones and main SVG)
    const textRadius = cluster.type === 'edge' ? r_inner + (r_outer - r_inner) * 0.6 : r_inner + (r_outer_apex - r_inner) * 0.5;
    const mid = polarToCartesian(targetCx, targetCy, textRadius, centerAngle);
    textLabels += `<text x="${mid.x.toFixed(2)}" y="${mid.y.toFixed(2)}" text-anchor="middle" dominant-baseline="middle" font-size="${Math.max(10, Math.round(unitSize * 0.18))}" font-weight="bold" fill="#fff" stroke="#000" stroke-width="2" paint-order="stroke" pointer-events="none">${cluster.label}</text>`;

    return { mainSVG, interactionZones, textLabels };
}

function createInteractiveSVG(state, options = {}) {
    if (!state.clusters) {
        return '<div class="error-message">Invalid state - cannot render</div>';
    }

    const baseSize = options.size || 200;
    const unitSize = baseSize * 0.3;
    const svgSize = baseSize * 1.05;
    const cx = svgSize / 2,
        cy = svgSize / 2;

    const dimensions = {
        r_inner: 0,
        r_outer: Math.round(unitSize * 1.2),
        r_outer_apex: Math.round(unitSize * 1.2 * (Math.cos(Math.PI / 6) + Math.sin(Math.PI / 6))),
        ringR: Math.round(unitSize * 1.2) + Math.round(unitSize * 0.4),
        cornerRingR: Math.round(unitSize * 1.2) + Math.round(unitSize * 0.4) + Math.round(unitSize * 0.19),
        unitSize,
        colorScheme: state.colorScheme
    };

    // Determine which layer to render
    const hasTopLayer = state.topText && state.topText.length === 12;
    const hasBottomLayer = state.bottomText && state.bottomText.length === 12;

    let svgHTML = `<div class="cluster-container">`;

    // Top layer SVG
    if (hasTopLayer) {
        svgHTML += `<svg width="${svgSize}" height="${svgSize}" viewBox="0 0 ${svgSize} ${svgSize}" class="cluster-svg interactive-svg" data-layer="top">`;
        svgHTML += `<circle cx="${cx}" cy="${cy}" r="${dimensions.ringR}" fill="none" stroke="${dimensions.colorScheme?.ringStroke || '#e0e0e0'}" stroke-width="2"/>`;
        svgHTML += `<circle cx="${cx}" cy="${cy}" r="${dimensions.cornerRingR}" class="corner-ring" fill="none" stroke="rgba(255,0,0,0.1)" stroke-width="1" stroke-dasharray="2,2"/>`;
        const p1L = polarToCartesian(cx, cy, dimensions.ringR + 6, 75);
        const p2L = polarToCartesian(cx, cy, dimensions.ringR + 6, 255);
        svgHTML += `<line x1="${p1L.x}" y1="${p1L.y}" x2="${p2L.x}" y2="${p2L.y}" stroke="#d32f2f" stroke-width="3" pointer-events="none"/>`;
        svgHTML += `<circle cx="${cx}" cy="${cy}" r="${Math.max(2, Math.round(unitSize * 0.05))}" fill="rgba(0,0,0,0.06)"/>`;

        const leftLetterCenter = Array.from({ length: 12 }, (_, j) => 90 + j * 30);

        // First pass: render all interaction zones (behind)
        state.clusters.forEach(cluster => {
            if (cluster.startLetter < 12) {
                const angles = [];
                for (let k = 0; k < cluster.lettersCount; k++) {
                    const globalIdx = cluster.startLetter + k;
                    angles.push(leftLetterCenter[globalIdx]);
                }
                const centerAngle = angles.reduce((a, b) => a + b, 0) / angles.length;
                const result = renderCluster(cluster, state, cx, cy, centerAngle, 'top', cluster.startLetter, dimensions);
                if (result.interactionZones) {
                    svgHTML += result.interactionZones;
                }
            }
        });

        // Second pass: render all main pieces (in front)
        state.clusters.forEach(cluster => {
            if (cluster.startLetter < 12) {
                const angles = [];
                for (let k = 0; k < cluster.lettersCount; k++) {
                    const globalIdx = cluster.startLetter + k;
                    angles.push(leftLetterCenter[globalIdx]);
                }
                const centerAngle = angles.reduce((a, b) => a + b, 0) / angles.length;
                const result = renderCluster(cluster, state, cx, cy, centerAngle, 'top', cluster.startLetter, dimensions);
                svgHTML += result.mainSVG;
            }
        });

        // Third pass: render all text labels (on top)
        state.clusters.forEach(cluster => {
            if (cluster.startLetter < 12) {
                const angles = [];
                for (let k = 0; k < cluster.lettersCount; k++) {
                    const globalIdx = cluster.startLetter + k;
                    angles.push(leftLetterCenter[globalIdx]);
                }
                const centerAngle = angles.reduce((a, b) => a + b, 0) / angles.length;
                const result = renderCluster(cluster, state, cx, cy, centerAngle, 'top', cluster.startLetter, dimensions);
                svgHTML += result.textLabels;
            }
        });

        svgHTML += `</svg>`;
    }

    // Bottom layer SVG
    if (hasBottomLayer) {
        svgHTML += `<svg width="${svgSize}" height="${svgSize}" viewBox="0 0 ${svgSize} ${svgSize}" class="cluster-svg interactive-svg" data-layer="bottom">`;
        svgHTML += `<circle cx="${cx}" cy="${cy}" r="${dimensions.ringR}" fill="none" stroke="${dimensions.colorScheme?.ringStroke || '#e0e0e0'}" stroke-width="2"/>`;
        svgHTML += `<circle cx="${cx}" cy="${cy}" r="${dimensions.cornerRingR}" class="corner-ring" fill="none" stroke="rgba(255,0,0,0.1)" stroke-width="1" stroke-dasharray="2,2"/>`;
        const p1R = polarToCartesian(cx, cy, dimensions.ringR + 6, 105);
        const p2R = polarToCartesian(cx, cy, dimensions.ringR + 6, 285);
        svgHTML += `<line x1="${p1R.x}" y1="${p1R.y}" x2="${p2R.x}" y2="${p2R.y}" stroke="#d32f2f" stroke-width="3" pointer-events="none"/>`;
        svgHTML += `<circle cx="${cx}" cy="${cy}" r="${Math.max(2, Math.round(unitSize * 0.05))}" fill="rgba(0,0,0,0.06)"/>`;

        const rightLetterCenter = Array.from({ length: 12 }, (_, j) => 300 + j * 30);

        // First pass: render all interaction zones (behind)
        state.clusters.forEach(cluster => {
            if (cluster.startLetter >= 12) {
                const angles = [];
                for (let k = 0; k < cluster.lettersCount; k++) {
                    const globalIdx = cluster.startLetter + k;
                    const localIdx = globalIdx - 12;
                    angles.push(rightLetterCenter[localIdx]);
                }
                const centerAngle = angles.reduce((a, b) => a + b, 0) / angles.length;
                const result = renderCluster(cluster, state, cx, cy, centerAngle, 'bottom', cluster.startLetter, dimensions);
                if (result.interactionZones) {
                    svgHTML += result.interactionZones;
                }
            }
        });

        // Second pass: render all main pieces (in front)
        state.clusters.forEach(cluster => {
            if (cluster.startLetter >= 12) {
                const angles = [];
                for (let k = 0; k < cluster.lettersCount; k++) {
                    const globalIdx = cluster.startLetter + k;
                    const localIdx = globalIdx - 12;
                    angles.push(rightLetterCenter[localIdx]);
                }
                const centerAngle = angles.reduce((a, b) => a + b, 0) / angles.length;
                const result = renderCluster(cluster, state, cx, cy, centerAngle, 'bottom', cluster.startLetter, dimensions);
                svgHTML += result.mainSVG;
            }
        });

        // Third pass: render all text labels (on top)
        state.clusters.forEach(cluster => {
            if (cluster.startLetter >= 12) {
                const angles = [];
                for (let k = 0; k < cluster.lettersCount; k++) {
                    const globalIdx = cluster.startLetter + k;
                    const localIdx = globalIdx - 12;
                    angles.push(rightLetterCenter[localIdx]);
                }
                const centerAngle = angles.reduce((a, b) => a + b, 0) / angles.length;
                const result = renderCluster(cluster, state, cx, cy, centerAngle, 'bottom', cluster.startLetter, dimensions);
                svgHTML += result.textLabels;
            }
        });

        svgHTML += `</svg>`;
    }

    svgHTML += `</div>`;

    return svgHTML;
}

// === MINI PIECE SVG ===
function createMiniPieceSVG(piece, colorScheme = DEFAULT_COLOR_SCHEME) {
    const pieceDefinitions = createPieceDefinitions(colorScheme);
    const pieceData = pieceDefinitions[piece] || pieceDefinitions['R'];
    const size = 30;
    const cx = size / 2,
        cy = size / 2;
    const r = size * 0.3;

    let svg = `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">`;

    if (pieceData.type === 'empty') {
        svg += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${pieceData.colors.fill}" stroke="${pieceData.colors.stroke}" stroke-width="1"/>`;
    } else if (pieceData.type === 'edge') {
        svg += `<rect x="${cx - r}" y="${cy - r / 2}" width="${r * 2}" height="${r}" fill="${pieceData.colors.outer}" stroke="#333" stroke-width="1"/>`;
        svg += `<rect x="${cx - r * 0.6}" y="${cy - r / 2}" width="${r * 1.2}" height="${r}" fill="${pieceData.colors.inner}" stroke="#333" stroke-width="1"/>`;
    } else if (pieceData.type === 'corner') {
        const points = `${cx},${cy - r} ${cx + r},${cy + r / 2} ${cx},${cy + r / 3} ${cx - r},${cy + r / 2}`;
        svg += `<polygon points="${points}" fill="${pieceData.colors.top}" stroke="#333" stroke-width="1"/>`;
    }

    svg += `</svg>`;
    return svg;
}

// === PIECE SELECTION MODAL ===
function createPieceSelectionModal() {
    return `
    <div id="pieceSelectionModal" style="display: none; position: fixed; background: white; border: 2px solid #333; border-radius: 8px; padding: 15px; box-shadow: 0 4px 12px rgba(0,0,0,0.3); z-index: 10000; max-width: 300px;">
      <h3 style="margin: 0 0 10px 0; font-size: 14px; color: #333;">Select Piece</h3>
      <div id="pieceGrid" style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; max-height: 400px; overflow-y: auto;">
        <!-- Pieces will be populated here -->
      </div>
    </div>
  `;
}

// === INTERACTIVE EVENT SETUP ===
function setupInteractiveEvents(state, containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    // Add modal if it doesn't exist
    if (!document.getElementById('pieceSelectionModal')) {
        const modalDiv = document.createElement('div');
        modalDiv.innerHTML = createPieceSelectionModal();
        document.body.appendChild(modalDiv.firstElementChild);
    }

    const slots = container.querySelectorAll('.edge-interaction-zone, .corner-interaction-zone');

    // Scroll-switch mode state (shared across all slots)
    let scrollSwitchActive = false;
    let scrollSwitchData = null;
    let clickTimer = null;
    let mouseDownSlot = null;

    // Global mouse up handler to properly exit scroll-switch mode
    const globalMouseUpHandler = (e) => {
        if (scrollSwitchActive) {
            scrollSwitchActive = false;
            scrollSwitchData = null;
            
            // Remove orange cursor style
            const cursorStyle = document.getElementById('scroll-switch-cursor-style');
            if (cursorStyle) {
                cursorStyle.remove();
            }
            document.body.style.cursor = '';
            
            e.preventDefault();
            e.stopPropagation();
        }
        clearTimeout(clickTimer);
        clickTimer = null;
        mouseDownSlot = null;
    };

    // Helper function to update scroll cursor
    const updateScrollCursor = (state) => {
        let cursorStyle = document.getElementById('scroll-switch-cursor-style');
        if (!cursorStyle) {
            cursorStyle = document.createElement('style');
            cursorStyle.id = 'scroll-switch-cursor-style';
            document.head.appendChild(cursorStyle);
        }
        
        let svgContent = '';
        if (state === 'neutral') {
            // Ball with up and down arrows
            svgContent = '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><circle cx="16" cy="16" r="3" fill="%23fff" stroke="%23000" stroke-width="0.2"/><path d="M16 6 L12 10 L20 10 Z" fill="%23fff" stroke="%23000" stroke-width="0.5"/><path d="M16 26 L12 22 L20 22 Z" fill="%23fff" stroke="%23000" stroke-width="0.5"/></svg>';
        } else if (state === 'up') {
            // Ball with only up arrow (inverted/filled)
            svgContent = '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><circle cx="16" cy="16" r="3" fill="%23666666" stroke="%23000" stroke-width="0.2"/><path d="M16 6 L12 10 L20 10 Z" fill="%23666666" stroke="%23000" stroke-width="0.5"/></svg>';
        } else if (state === 'down') {
            // Ball with only down arrow (inverted/filled)
            svgContent = '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><circle cx="16" cy="16" r="3" fill="%23666666" stroke="%23000" stroke-width="0.2"/><path d="M16 26 L12 22 L20 22 Z" fill="%23666666" stroke="%23000" stroke-width="0.5"/></svg>';
        }
        
        cursorStyle.textContent = `
            * {
                cursor: url('data:image/svg+xml;utf8,${svgContent}') 16 16, ns-resize !important;
            }
        `;
    };

    // Global wheel listener for scroll-switch mode
    const wheelHandler = (e) => {
        if (scrollSwitchActive && scrollSwitchData) {
            e.preventDefault();
            e.stopPropagation();
            
            const direction = e.deltaY > 0 ? 1 : -1;
            
            // Update cursor based on scroll direction
            updateScrollCursor(direction > 0 ? 'down' : 'up');
            
            // Reset cursor back to neutral after a short delay
            clearTimeout(scrollSwitchData.cursorResetTimer);
            scrollSwitchData.cursorResetTimer = setTimeout(() => {
                if (scrollSwitchActive) {
                    updateScrollCursor('neutral');
                }
            }, 150);
            
            cyclePiece(state, scrollSwitchData.position, scrollSwitchData.layer, scrollSwitchData.isCornerZone, direction);
            
            // Re-render immediately for snappy interaction
            const targetContainer = document.getElementById(scrollSwitchData.containerId);
            if (targetContainer) {
                targetContainer.innerHTML = createInteractiveSVG(state, { size: 200 });
                setupInteractiveEvents(state, scrollSwitchData.containerId);
            }
        }
    };

    slots.forEach((slot, index) => {
        // Remove any existing listeners
        const newSlot = slot.cloneNode(true);
        slot.parentNode.replaceChild(newSlot, slot);

        let mouseDownTime = 0;

        // Mouse down - start timer for scroll-switch mode
        newSlot.addEventListener('mousedown', (e) => {
            if (e.button !== 0) return; // Only left click
            
            e.preventDefault();
            e.stopPropagation();
            
            mouseDownSlot = newSlot;
            mouseDownTime = Date.now();
            
            clickTimer = setTimeout(() => {
                // Enter scroll-switch mode
                scrollSwitchActive = true;
                
                const position = parseInt(newSlot.dataset.position);
                const layer = newSlot.dataset.layer;
                const isCornerZone = newSlot.classList.contains('corner-interaction-zone');
                
                scrollSwitchData = { position, layer, isCornerZone, containerId };
                
                // Change cursor to orange scroll mode (neutral state)
                updateScrollCursor('neutral');
            }, 300);
        });

        // Mouse up handler - check for quick click
        newSlot.addEventListener('mouseup', (e) => {
            if (e.button !== 0) return; // Only left click
            
            const mouseUpTime = Date.now();
            const pressDuration = mouseUpTime - mouseDownTime;
            
            // If released before 300ms, treat as normal click
            if (pressDuration < 300 && mouseDownSlot === newSlot && !scrollSwitchActive) {
                e.preventDefault();
                e.stopPropagation();
                
                clearTimeout(clickTimer);
                clickTimer = null;
                
                const position = parseInt(newSlot.dataset.position);
                const layer = newSlot.dataset.layer;
                const isCornerZone = newSlot.classList.contains('corner-interaction-zone');

                cyclePiece(state, position, layer, isCornerZone, 1);
                
                // Re-render just THIS container
                const targetContainer = document.getElementById(containerId);
                if (targetContainer) {
                    targetContainer.innerHTML = createInteractiveSVG(state, { size: 200 });
                    setupInteractiveEvents(state, containerId);
                }
            }
        });

        // Right click for piece selection modal (desktop only - mobile uses long press)
        newSlot.addEventListener('contextmenu', (e) => {
            // Only handle if not from touch device
            if (e.pointerType !== 'touch' && !('ontouchstart' in window)) {
                e.preventDefault();
                e.stopPropagation();
                const position = parseInt(newSlot.dataset.position);
                const layer = newSlot.dataset.layer;
                const isCornerZone = newSlot.classList.contains('corner-interaction-zone');

                showPieceSelectionModal(state, position, layer, isCornerZone, e.clientX, e.clientY, containerId);
            }
        });

        // Long press for touch devices
        let pressTimer;
        let touchStartTime = 0;
        let touchMoved = false;
        
        newSlot.addEventListener('touchstart', (e) => {
            touchStartTime = Date.now();
            touchMoved = false;
            
            pressTimer = setTimeout(() => {
                e.preventDefault();
                const position = parseInt(newSlot.dataset.position);
                const layer = newSlot.dataset.layer;
                const isCornerZone = newSlot.classList.contains('corner-interaction-zone');

                const touch = e.touches[0];
                showPieceSelectionModal(state, position, layer, isCornerZone, touch.clientX, touch.clientY, containerId);
            }, 500);
        });

        newSlot.addEventListener('touchend', (e) => {
            const touchDuration = Date.now() - touchStartTime;
            clearTimeout(pressTimer);
            
            // If it was a quick tap (< 500ms) and no movement, cycle the piece
            if (touchDuration < 500 && !touchMoved) {
                e.preventDefault();
                const position = parseInt(newSlot.dataset.position);
                const layer = newSlot.dataset.layer;
                const isCornerZone = newSlot.classList.contains('corner-interaction-zone');

                cyclePiece(state, position, layer, isCornerZone, 1);
                
                const targetContainer = document.getElementById(containerId);
                if (targetContainer) {
                    targetContainer.innerHTML = createInteractiveSVG(state, { size: 200 });
                    setupInteractiveEvents(state, containerId);
                }
            }
        });

        newSlot.addEventListener('touchmove', () => {
            touchMoved = true;
            clearTimeout(pressTimer);
        });
    });

    // Add global listeners
    document.addEventListener('mouseup', globalMouseUpHandler);
    container.addEventListener('wheel', wheelHandler, { passive: false });
    
    // Store cleanup function
    if (!container._cleanupListeners) {
        container._cleanupListeners = [];
    }
    container._cleanupListeners.push(() => {
        document.removeEventListener('mouseup', globalMouseUpHandler);
        container.removeEventListener('wheel', wheelHandler);
    });
}

function cyclePiece(state, position, layer, isCornerZone, direction) {
    const textPosition = layer === 'top' ? position : position - 12;
    const currentText = state.getText(layer);
    const currentPiece = currentText[textPosition];
    
    const availablePieces = isCornerZone ? CORNER_PIECES : EDGE_PIECES;
    const currentIndex = availablePieces.indexOf(currentPiece);
    
    let newIndex;
    if (currentIndex === -1) {
        newIndex = 0;
    } else {
        newIndex = (currentIndex + direction + availablePieces.length) % availablePieces.length;
    }
    
    const newPiece = availablePieces[newIndex];
    state.updatePiece(position, layer, newPiece);
}

function showPieceSelectionModal(state, position, layer, isCornerZone, x, y, containerId) {
    const modal = document.getElementById('pieceSelectionModal');
    const grid = document.getElementById('pieceGrid');

    // Create tab header
    const tabHeader = document.createElement('div');
    tabHeader.style.cssText = 'display: flex; gap: 4px; margin-bottom: 10px; border-bottom: 2px solid #ddd;';
    
    const edgeTab = document.createElement('button');
    edgeTab.textContent = 'Edges';
    edgeTab.style.cssText = 'flex: 1; padding: 8px; border: none; background: #f5f5f5; cursor: pointer; font-weight: 500; border-bottom: 3px solid transparent;';
    
    const cornerTab = document.createElement('button');
    cornerTab.textContent = 'Corners';
    cornerTab.style.cssText = 'flex: 1; padding: 8px; border: none; background: #f5f5f5; cursor: pointer; font-weight: 500; border-bottom: 3px solid transparent;';
    
    let currentTab = isCornerZone ? 'corner' : 'edge';
    
    const renderPieces = (tab) => {
        currentTab = tab;
        const availablePieces = tab === 'corner' ? CORNER_PIECES : EDGE_PIECES;
        
        // Update tab styles
        if (tab === 'edge') {
            edgeTab.style.background = '#fff';
            edgeTab.style.borderBottomColor = '#0078d4';
            cornerTab.style.background = '#f5f5f5';
            cornerTab.style.borderBottomColor = 'transparent';
        } else {
            cornerTab.style.background = '#fff';
            cornerTab.style.borderBottomColor = '#0078d4';
            edgeTab.style.background = '#f5f5f5';
            edgeTab.style.borderBottomColor = 'transparent';
        }
        
        grid.innerHTML = '';
        
        availablePieces.forEach(piece => {
            const button = document.createElement('button');
            button.style.cssText = 'padding: 12px; background: #f5f5f5; border: 2px solid #ddd; border-radius: 6px; cursor: pointer; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px;';
            button.onmouseover = () => button.style.background = '#e0e0e0';
            button.onmouseout = () => button.style.background = '#f5f5f5';
            button.onclick = (e) => {
                e.preventDefault();
                e.stopPropagation();
                state.updatePiece(position, layer, piece);
                window.closePieceModal();
                
                const container = document.getElementById(containerId);
                if (container) {
                    container.innerHTML = createInteractiveSVG(state, { size: 200 });
                    setupInteractiveEvents(state, containerId);
                }
            };

            const svgName = piece === 'E' ? 'piece_E_placeholder' : piece === 'C' ? 'piece_C_placeholder' : `piece_${piece}`;
            button.innerHTML = `<img src="viz/piece/${svgName}.svg" width="48" height="48">`;
            grid.appendChild(button);
        });
    };
    
    edgeTab.onclick = () => renderPieces('edge');
    cornerTab.onclick = () => renderPieces('corner');
    
    tabHeader.appendChild(edgeTab);
    tabHeader.appendChild(cornerTab);
    
    // Clear and setup modal - remove ALL existing tab headers
    const modalContent = modal.querySelector('h3').parentElement;
    const existingTabHeaders = modalContent.querySelectorAll('div');
    existingTabHeaders.forEach(header => {
        if (header !== grid && header.style.cssText.includes('border-bottom')) {
            header.remove();
        }
    });
    
    modalContent.insertBefore(tabHeader, grid);
    
    renderPieces(currentTab);

    // Show modal first to get its dimensions
    modal.style.display = 'block';
    modal.style.visibility = 'hidden';
    
    const modalRect = modal.getBoundingClientRect();
    const modalWidth = modalRect.width;
    const modalHeight = modalRect.height;
    
    let left = x;
    let top = y;
    
    if (left + modalWidth > window.innerWidth) {
        left = window.innerWidth - modalWidth - 10;
    }
    
    if (left < 10) {
        left = 10;
    }
    
    if (top + modalHeight > window.innerHeight) {
        top = window.innerHeight - modalHeight - 10;
    }
    
    if (top < 10) {
        top = 10;
    }
    
    modal.style.left = `${left}px`;
    modal.style.top = `${top}px`;
    modal.style.visibility = 'visible';

    setTimeout(() => {
        const closeOnOutsideClick = (e) => {
            if (!modal.contains(e.target)) {
                window.closePieceModal();
                document.removeEventListener('click', closeOnOutsideClick);
            }
        };
        document.addEventListener('click', closeOnOutsideClick);
    }, 10);
}

window.closePieceModal = function() {
    const modal = document.getElementById('pieceSelectionModal');
    if (modal) modal.style.display = 'none';
};

// === EXPORT ===
if (typeof window !== 'undefined') {
    window.InteractiveScrambleRenderer = {
        InteractiveScrambleState,
        createInteractiveSVG,
        createMiniPieceSVG,
        getUsedPieces,
        createPieceDefinitions,
        setupInteractiveEvents,
        createPieceSelectionModal,
        DEFAULT_COLOR_SCHEME,
        EDGE_PIECES,
        CORNER_PIECES
    };
}

export {
    CORNER_PIECES,
    DEFAULT_COLOR_SCHEME,
    EDGE_PIECES,
    InteractiveScrambleState,
    createInteractiveSVG,
    createMiniPieceSVG,
    createPieceDefinitions,
    createPieceSelectionModal,
    getUsedPieces,
    setupInteractiveEvents
};

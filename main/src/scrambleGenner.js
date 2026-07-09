//This code may contain a lot of redundant code, but I don't care :)
//As long as it is working, I am happy :)

const Solver_Shape_halflayer = [0, 3, 6, 12, 15, 24, 27, 30, 48, 51, 54, 60, 63];
const Solver_Shape_ShapeIdx = [];

(function initTrainingShapes() {
  let count = 0;
  for (let i = 0; i < 28561; i++) {
    const dr = Solver_Shape_halflayer[i % 13];
    const dl = Solver_Shape_halflayer[Math.floor(i / 13) % 13];
    const ur = Solver_Shape_halflayer[Math.floor(i / 169) % 13];
    const ul = Solver_Shape_halflayer[Math.floor(i / 2197)];
    const value = (ul << 18) | (ur << 12) | (dl << 6) | dr;
    let bits = 0, t = value;
    while (t) {
      bits += t & 1;
      t >>= 1;
    }
    if (bits === 16) Solver_Shape_ShapeIdx[count++] = value;
  }
})();

const CC = ['1', '3', '5', '7', '9', 'b', 'd', 'f'];
const CE = ['0', '2', '4', '6', '8', 'a', 'c', 'e'];

function parseHex(hex) {
  hex = hex.replace(/[\/|]/g, '').toLowerCase();
  const c = [], e = [];
  for (let i = 0; i < 24; i++) {
    const v = parseInt(hex[i], 16);
    if (v % 2 === 1) {
      if (i === 0 || hex[i - 1] !== hex[i]) c.push(hex[i]);
    } else {
      e.push(hex[i]);
    }
  }
  return { c, e };
}

function swaps(arr, canon) {
  arr = [...arr];
  let s = 0;
  for (let i = 0; i < arr.length; i++) {
    const j = arr.indexOf(canon[i]);
    if (j !== i) {
      [arr[i], arr[j]] = [arr[j], arr[i]];
      s++;
    }
  }
  return s;
}

function calculateParity(hex) {
  const { c, e } = parseHex(hex);
  return ((swaps(c, CC) + swaps(e, CE)) % 2 === 0) ? 'even' : 'odd';
}

function hexToShape(hex) {
  hex = hex.replace(/[\/|]/g, '').toLowerCase();
  
  if (hex.length !== 24) {
    throw new Error('Invalid hex string: must be 24 characters');
  }

  let shape = 0;
  let i = 0;
  let position = 23;

  while (i < 24) {
    const v = parseInt(hex[i], 16);
    
    if (v % 2 === 1) {
      if (i + 1 < 24 && hex[i] === hex[i + 1]) {
        shape |= (1 << position);
        if (position > 0) {
          shape |= (1 << (position - 1));
        }
        i += 2;
        position -= 2;
      } else {
        throw new Error('Invalid hex: odd digit must be followed by same digit');
      }
    } else {
      i += 1;
      position -= 1;
    }
  }

  return shape;
}

function findShapeIndex(shape) {
  for (let i = 0; i < Solver_Shape_ShapeIdx.length; i++) {
    if (Solver_Shape_ShapeIdx[i] === shape) {
      return i;
    }
  }
  return -1;
}

function getShapeIndexAndParity(hex) {
  const shape = hexToShape(hex);
  const shapeIndex = findShapeIndex(shape);
  const parity = calculateParity(hex);

  if (shapeIndex === -1) {
    throw new Error('Invalid shape: not in valid Sq-1 shape table');
  }

  return { shapeIndex, parity };
}

// ============================================================================
// MATH UTILITIES
// ============================================================================

function getNPerm(arr, n) {
    if (n === undefined) n = arr.length;
    var idx = 0;
    for (var i = 0; i < n; i++) {
        idx *= (n - i);
        for (var j = i + 1; j < n; j++) {
            if (arr[i] > arr[j]) {
                idx++;
            }
        }
    }
    return idx;
}

function setNPerm(arr, idx, n) {
    if (n === undefined) n = arr.length;
    arr.length = n;
    for (var i = n - 1; i >= 0; i--) {
        arr[i] = idx % (n - i);
        idx = ~~(idx / (n - i));
        for (var j = i + 1; j < n; j++) {
            if (arr[j] >= arr[i]) arr[j]++;
        }
    }
}

function circle(arr) {
    var leng = arguments.length - 1;
    var temp = arr[arguments[leng]];
    for (var i = leng; i > 1; i--) {
        arr[arguments[i]] = arr[arguments[i - 1]];
    }
    arr[arguments[1]] = temp;
    return circle;
}

// ============================================================================
// SQUARE-1 CUBIE MODEL
// ============================================================================

class SqCubie {
    constructor() {
        this.ul = 0x011233;
        this.ur = 0x455677;
        this.dl = 0x998bba;
        this.dr = 0xddcffe;
        this.ml = 0;
    }

    toString() {
        return this.ul.toString(16).padStart(6, 0) +
            this.ur.toString(16).padStart(6, 0) +
            "|/".charAt(this.ml) +
            this.dl.toString(16).padStart(6, 0) +
            this.dr.toString(16).padStart(6, 0);
    }

    pieceAt(idx) {
        var ret;
        if (idx < 6) {
            ret = this.ul >> ((5 - idx) << 2);
        } else if (idx < 12) {
            ret = this.ur >> ((11 - idx) << 2);
        } else if (idx < 18) {
            ret = this.dl >> ((17 - idx) << 2);
        } else {
            ret = this.dr >> ((23 - idx) << 2);
        }
        return ret & 0xf;
    }

    setPiece(idx, value) {
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

    copy(c) {
        this.ul = c.ul;
        this.ur = c.ur;
        this.dl = c.dl;
        this.dr = c.dr;
        this.ml = c.ml;
    }

    doMove(move) {
        var temp;
        move <<= 2;
        if (move > 24) {
            move = 48 - move;
            temp = this.ul;
            this.ul = (this.ul >> move | this.ur << 24 - move) & 0xffffff;
            this.ur = (this.ur >> move | temp << 24 - move) & 0xffffff;
        } else if (move > 0) {
            temp = this.ul;
            this.ul = (this.ul << move | this.ur >> 24 - move) & 0xffffff;
            this.ur = (this.ur << move | temp >> 24 - move) & 0xffffff;
        } else if (move == 0) {
            temp = this.ur;
            this.ur = this.dl;
            this.dl = temp;
            this.ml = 1 - this.ml;
        } else if (move >= -24) {
            move = -move;
            temp = this.dl;
            this.dl = (this.dl << move | this.dr >> 24 - move) & 0xffffff;
            this.dr = (this.dr << move | temp >> 24 - move) & 0xffffff;
        } else if (move < -24) {
            move = 48 + move;
            temp = this.dl;
            this.dl = (this.dl >> move | this.dr << 24 - move) & 0xffffff;
            this.dr = (this.dr >> move | temp << 24 - move) & 0xffffff;
        }
    }
}

// ============================================================================
// SQUARE STATE
// ============================================================================

class Square {
    constructor() {
        this.botEdgeFirst = false;
        this.cornperm = 0;
        this.edgeperm = 0;
        this.ml = 0;
        this.topEdgeFirst = false;
    }
}

// ============================================================================
// PRUNING TABLES
// ============================================================================

let SquarePrun = [];
let Square_TwistMove = [];
let Square_TopMove = [];
let Square_BottomMove = [];

function initSquareTables() {
    var i, pos, check, depth, done, find, idx, idxx, inv, m, ml;

    pos = [];
    for (i = 0; i < 40320; ++i) {
        setNPerm(pos, i, 8);
        circle(pos, 2, 4)(pos, 3, 5);
        Square_TwistMove[i] = getNPerm(pos, 8);
        setNPerm(pos, i, 8);
        circle(pos, 0, 3, 2, 1);
        Square_TopMove[i] = getNPerm(pos, 8);
        setNPerm(pos, i, 8);
        circle(pos, 4, 7, 6, 5);
        Square_BottomMove[i] = getNPerm(pos, 8);
    }

    for (i = 0; i < 80640; ++i) {
        SquarePrun[i] = -1;
    }
    SquarePrun[0] = 0;
    depth = 0;
    done = 1;

    while (done < 80640) {
        inv = depth >= 11;
        find = inv ? -1 : depth;
        check = inv ? depth : -1;
        ++depth;
        OUT: for (i = 0; i < 80640; ++i) {
            if (SquarePrun[i] == find) {
                idx = i >> 1;
                ml = i & 1;
                idxx = Square_TwistMove[idx] << 1 | 1 - ml;
                if (SquarePrun[idxx] == check) {
                    ++done;
                    SquarePrun[inv ? i : idxx] = depth;
                    if (inv)
                        continue OUT;
                }
                idxx = idx;
                for (m = 0; m < 4; ++m) {
                    idxx = Square_TopMove[idxx];
                    if (SquarePrun[idxx << 1 | ml] == check) {
                        ++done;
                        SquarePrun[inv ? i : idxx << 1 | ml] = depth;
                        if (inv)
                            continue OUT;
                    }
                }
                for (m = 0; m < 4; ++m) {
                    idxx = Square_BottomMove[idxx];
                    if (SquarePrun[idxx << 1 | ml] == check) {
                        ++done;
                        SquarePrun[inv ? i : idxx << 1 | ml] = depth;
                        if (inv)
                            continue OUT;
                    }
                }
            }
        }
    }
}

// ============================================================================
// RANDOM WALK SOLVER
// ============================================================================

class RandomWalkSearch {
    constructor() {
        this.Search_move = [];
        this.Search_d = new SqCubie();
        this.Search_sq = new Square();
        this.Search_c = null;
        this.Search_length1 = 0;
        this.Search_maxlen2 = 0;
        this.Search_sol_string = null;
        this.topEdgeFirst = false;
        this.botEdgeFirst = true;
    }

    fullCubeGetSquare(obj, sq) {
        var a, b;
        var prm = [];
        for (a = 0; a < 8; ++a) {
            prm[a] = obj.pieceAt(a * 3 + 1) >> 1;
        }
        sq.cornperm = getNPerm(prm, 8);
        sq.topEdgeFirst = obj.pieceAt(0) == obj.pieceAt(1);
        a = sq.topEdgeFirst ? 2 : 0;
        for (b = 0; b < 4; a += 3, ++b)
            prm[b] = obj.pieceAt(a) >> 1;
        sq.botEdgeFirst = obj.pieceAt(12) == obj.pieceAt(13);
        a = sq.botEdgeFirst ? 14 : 12;
        for (; b < 8; a += 3, ++b)
            prm[b] = obj.pieceAt(a) >> 1;
        sq.edgeperm = getNPerm(prm, 8);
        sq.ml = obj.ml;
    }

    move2string(len) {
        var s = "";
        var top = 0, bottom = 0;
        for (var i = len - 1; i >= 0; i--) {
            var val = this.Search_move[i];
            if (val > 0) {
                val = 12 - val;
                top = (val > 6) ? (val - 12) : val;
            } else if (val < 0) {
                val = 12 + val;
                bottom = (val > 6) ? (val - 12) : val;
            } else {
                var twst = "/";
                if (top == 0 && bottom == 0) {
                    s += twst;
                } else {
                    s += " (" + top + "," + bottom + ")" + twst;
                }
                top = bottom = 0;
            }
        }
        if (top == 0 && bottom == 0) { } else {
            s += " (" + top + "," + bottom + ") ";
        }
        return s;
    }

    init2() {
        var corner, edge, i, j, ml, prun;
        this.Search_d.copy(this.Search_c);
        for (i = 0; i < this.Search_length1; ++i) {
            this.Search_d.doMove(this.Search_move[i]);
        }
        this.fullCubeGetSquare(this.Search_d, this.Search_sq);
        edge = this.Search_sq.edgeperm;
        corner = this.Search_sq.cornperm;
        ml = this.Search_sq.ml;
        prun = Math.max(SquarePrun[this.Search_sq.edgeperm << 1 | ml], SquarePrun[this.Search_sq.cornperm << 1 | ml]);
        for (i = prun; i < this.Search_maxlen2; ++i) {
            if (this.solvePhase2(edge, corner, this.Search_sq.topEdgeFirst, this.Search_sq.botEdgeFirst, ml, i, this.Search_length1, 0)) {
                for (j = 0; j < i; ++j) {
                    this.Search_d.doMove(this.Search_move[this.Search_length1 + j]);
                }
                this.Search_sol_string = this.move2string(i + this.Search_length1);
                return true;
            }
        }
        return false;
    }

    solvePhase1() {
        let topEdgeFirst = this.topEdgeFirst;
        let botEdgeFirst = this.botEdgeFirst;
        const topVarSet = [1, 4, 7, 10];
        const bottomReverseVarSet = [-1, -4, -10];
        const topReverseVarSet = [11, 8, 5, 2];
        const bottomVarSet = [-11, -8, -2];
        const topFixedSet = [12, 3, 9];
        const bottomFixedSet = [-12, -3, -9];

        let initialState;
        if (!topEdgeFirst && botEdgeFirst) {
            initialState = 0;
        } else if (topEdgeFirst && botEdgeFirst) {
            initialState = 1;
        } else if (!topEdgeFirst && !botEdgeFirst) {
            initialState = 2;
        } else if (topEdgeFirst && !botEdgeFirst) {
            initialState = 3;
        }

        let middlePath = [];
        for (let i = 0; i < this.Search_length1 / 3; i++) {
            let newState;
            if (i >= 2 && middlePath[i-1] === middlePath[i-2]) {
                newState = middlePath[i-1] === 1 ? 2 : 1;
            } else {
                newState = Math.random() < 0.5 ? 1 : 2;
            }
            middlePath.push(newState);
        }
        
        let statePath = [initialState, ...middlePath];

        for (let depth = 0; depth < statePath.length - 1; depth++) {
            const fromState = statePath[depth];
            const toState = statePath[depth + 1];
            
            let topMove, bottomMove;
            do {
                if (fromState === 0 && toState === 1) {
                    topMove = topVarSet[Math.floor(Math.random() * topVarSet.length)];
                    bottomMove = bottomFixedSet[Math.floor(Math.random() * bottomFixedSet.length)];
                } else if (fromState === 0 && toState === 2) {
                    topMove = topFixedSet[Math.floor(Math.random() * topFixedSet.length)];
                    bottomMove = bottomVarSet[Math.floor(Math.random() * bottomVarSet.length)];
                } else if (fromState === 1 && toState === 1) {
                    topMove = topFixedSet[Math.floor(Math.random() * topFixedSet.length)];
                    bottomMove = bottomFixedSet[Math.floor(Math.random() * bottomFixedSet.length)];
                } else if (fromState === 1 && toState === 2) {
                    topMove = topReverseVarSet[Math.floor(Math.random() * topReverseVarSet.length)];
                    bottomMove = bottomVarSet[Math.floor(Math.random() * bottomVarSet.length)];
                } else if (fromState === 2 && toState === 2) {
                    topMove = topFixedSet[Math.floor(Math.random() * topFixedSet.length)];
                    bottomMove = bottomFixedSet[Math.floor(Math.random() * bottomFixedSet.length)];
                } else if (fromState === 2 && toState === 1) {
                    topMove = topVarSet[Math.floor(Math.random() * topVarSet.length)];
                    bottomMove = bottomReverseVarSet[Math.floor(Math.random() * bottomReverseVarSet.length)];
                } else if (fromState === 3 && toState === 2) {
                    topMove = topReverseVarSet[Math.floor(Math.random() * topReverseVarSet.length)];
                    bottomMove = bottomFixedSet[Math.floor(Math.random() * bottomFixedSet.length)];
                } else if (fromState === 3 && toState === 1) {
                    topMove = topFixedSet[Math.floor(Math.random() * topFixedSet.length)];
                    bottomMove = bottomReverseVarSet[Math.floor(Math.random() * bottomReverseVarSet.length)];
                }
            } while (topMove === 12 && bottomMove === -12);

            this.Search_move.push(topMove);
            this.Search_move.push(bottomMove);
            this.Search_move.push(0);
        }
        return this.init2();
    }

    solvePhase2(edge, corner, topEdgeFirst, botEdgeFirst, ml, maxl, depth, lm) {
        var botEdgeFirstx, cornerx, edgex, m, prun1, prun2, topEdgeFirstx;
        if (maxl == 0 && !topEdgeFirst && botEdgeFirst) {
            return true;
        }
        if (lm != 0 && topEdgeFirst == botEdgeFirst) {
            edgex = Square_TwistMove[edge];
            cornerx = Square_TwistMove[corner];
            if (SquarePrun[edgex << 1 | 1 - ml] < maxl && SquarePrun[cornerx << 1 | 1 - ml] < maxl) {
                this.Search_move[depth] = 0;
                if (this.solvePhase2(edgex, cornerx, topEdgeFirst, botEdgeFirst, 1 - ml, maxl - 1, depth + 1, 0)) {
                    return true;
                }
            }
        }
        if (lm <= 0) {
            topEdgeFirstx = !topEdgeFirst;
            edgex = topEdgeFirstx ? Square_TopMove[edge] : edge;
            cornerx = topEdgeFirstx ? corner : Square_TopMove[corner];
            m = topEdgeFirstx ? 1 : 2;
            prun1 = SquarePrun[edgex << 1 | ml];
            prun2 = SquarePrun[cornerx << 1 | ml];
            while (m < 12 && prun1 <= maxl && prun1 <= maxl) {
                if (prun1 < maxl && prun2 < maxl) {
                    this.Search_move[depth] = m;
                    if (this.solvePhase2(edgex, cornerx, topEdgeFirstx, botEdgeFirst, ml, maxl - 1, depth + 1, 1)) {
                        return true;
                    }
                }
                topEdgeFirstx = !topEdgeFirstx;
                if (topEdgeFirstx) {
                    edgex = Square_TopMove[edgex];
                    prun1 = SquarePrun[edgex << 1 | ml];
                    m += 1;
                } else {
                    cornerx = Square_TopMove[cornerx];
                    prun2 = SquarePrun[cornerx << 1 | ml];
                    m += 2;
                }
            }
        }
        if (lm <= 1) {
            botEdgeFirstx = !botEdgeFirst;
            edgex = botEdgeFirstx ? Square_BottomMove[edge] : edge;
            cornerx = botEdgeFirstx ? corner : Square_BottomMove[corner];
            m = botEdgeFirstx ? 1 : 2;
            prun1 = SquarePrun[edgex << 1 | ml];
            prun2 = SquarePrun[cornerx << 1 | ml];
            while (m < 5 && prun1 <= maxl && prun1 <= maxl) {
                if (prun1 < maxl && prun2 < maxl) {
                    this.Search_move[depth] = -m;
                    if (this.solvePhase2(edgex, cornerx, topEdgeFirst, botEdgeFirstx, ml, maxl - 1, depth + 1, 2)) {
                        return true;
                    }
                }
                botEdgeFirstx = !botEdgeFirstx;
                if (botEdgeFirstx) {
                    edgex = Square_BottomMove[edgex];
                    prun1 = SquarePrun[edgex << 1 | ml];
                    m += 1;
                } else {
                    cornerx = Square_BottomMove[cornerx];
                    prun2 = SquarePrun[cornerx << 1 | ml];
                    m += 2;
                }
            }
        }
        return false;
    }

    findSolution(c) {
        this.Search_c = c;
        do {
            this.Search_d.copy(c);
            this.fullCubeGetSquare(this.Search_d, this.Search_sq);

            this.topEdgeFirst = this.Search_sq.topEdgeFirst;
            this.botEdgeFirst = this.Search_sq.botEdgeFirst;

            this.Search_length1 = 3 * (Math.floor(Math.random() * 5) + 3);
            this.Search_maxlen2 = Math.min(45 - this.Search_length1, 18);
            this.Search_move = [];
        } while (!this.solvePhase1() || this.Search_sol_string.split("/").length-1 < 9)
        return this.Search_sol_string;
    }
}

// ============================================================================
// HEX RANDOMIZER (for non-square shapes)
// ============================================================================

class SQ1Enigma {
    constructor() {
        this.initialTop = "01234567";
        this.initialBottom = "98badcfe";
        this.moves = {
            top: {
                1: { shift: 1, notation: 1 },
                2: { shift: 1, notation: 2 },
                3: { shift: 2, notation: 3 },
                4: { shift: 3, notation: 4 },
                5: { shift: 3, notation: 5 },
                6: { shift: 4, notation: 6 },
                "-1": { shift: -1, notation: -1 },
                "-2": { shift: -1, notation: -2 },
                "-3": { shift: -2, notation: -3 },
                "-4": { shift: -3, notation: -4 },
                "-5": { shift: -3, notation: -5 },
                0: { shift: 0, notation: 0 }
            },
            bottom: {
                1: { shift: 1, notation: 1 },
                2: { shift: 1, notation: 2 },
                3: { shift: 2, notation: 3 },
                4: { shift: 3, notation: 4 },
                5: { shift: 3, notation: 5 },
                6: { shift: 4, notation: 6 },
                "-1": { shift: -1, notation: -1 },
                "-2": { shift: -1, notation: -2 },
                "-3": { shift: -2, notation: -3 },
                "-4": { shift: -3, notation: -4 },
                "-5": { shift: -3, notation: -5 },
                0: { shift: 0, notation: 0 }
            }
        };
    }

    cyclicShift(str, positions) {
        if (positions === 0) return str;
        const len = str.length;
        positions = ((positions % len) + len) % len;
        return str.slice(positions) + str.slice(0, positions);
    }

    swapLayers(top, bottom) {
        const topFirst4 = top.slice(0, 4);
        const topLast4 = top.slice(4);
        const bottomFirst4 = bottom.slice(0, 4);
        const bottomLast4 = bottom.slice(4);

        return {
            newTop: topFirst4 + bottomFirst4,
            newBottom: topLast4 + bottomLast4
        };
    }

    encode(input, depth = 1) {
        const separator = input.includes('/') ? '/' : '|';
        const parts = input.split(separator);

        if (parts.length !== 2) {
            throw new Error("Input must contain exactly one separator (/ or |)");
        }

        let currentTop = this.initialTop;
        let currentBottom = this.initialBottom;
        let currentSeparator = separator;
        let notation = [];

        const topVarSet = [1, 4, -5, -2];
        const bottomReverseVarSet = [1, 4, -5, -2];
        const topReverseVarSet = [-1, -4, 5, 2];
        const bottomVarSet = [-1, -4, 5, 2];
        const topFixedSet = [0, 3, 6, -3];
        const bottomFixedSet = [0, 3, 6, -3];

        let middlePath = [];
        for (let i = 0; i < depth; i++) {
            middlePath.push(Math.random() < 0.5 ? 1 : 2);
        }
        
        let statePath = [0, ...middlePath, 0];

        for (let i = 0; i < statePath.length - 1; i++) {
            const fromState = statePath[i];
            const toState = statePath[i + 1];
            
            let topMove, bottomMove;

            if (fromState === 0 && toState === 1) {
                topMove = topVarSet[Math.floor(Math.random() * topVarSet.length)];
                bottomMove = bottomFixedSet[Math.floor(Math.random() * bottomFixedSet.length)];
            } else if (fromState === 0 && toState === 2) {
                topMove = topFixedSet[Math.floor(Math.random() * topFixedSet.length)];
                bottomMove = bottomVarSet[Math.floor(Math.random() * bottomVarSet.length)];
            } else if (fromState === 1 && toState === 1) {
                topMove = topFixedSet[Math.floor(Math.random() * topFixedSet.length)];
                bottomMove = bottomFixedSet[Math.floor(Math.random() * bottomFixedSet.length)];
            } else if (fromState === 1 && toState === 2) {
                topMove = topReverseVarSet[Math.floor(Math.random() * topReverseVarSet.length)];
                bottomMove = bottomVarSet[Math.floor(Math.random() * bottomVarSet.length)];
            } else if (fromState === 1 && toState === 0) {
                topMove = topReverseVarSet[Math.floor(Math.random() * topReverseVarSet.length)];
                bottomMove = bottomFixedSet[Math.floor(Math.random() * bottomFixedSet.length)];
            } else if (fromState === 2 && toState === 2) {
                topMove = topFixedSet[Math.floor(Math.random() * topFixedSet.length)];
                bottomMove = bottomFixedSet[Math.floor(Math.random() * bottomFixedSet.length)];
            } else if (fromState === 2 && toState === 1) {
                topMove = topVarSet[Math.floor(Math.random() * topVarSet.length)];
                bottomMove = bottomReverseVarSet[Math.floor(Math.random() * bottomReverseVarSet.length)];
            } else if (fromState === 2 && toState === 0) {
                topMove = topFixedSet[Math.floor(Math.random() * topFixedSet.length)];
                bottomMove = bottomReverseVarSet[Math.floor(Math.random() * bottomReverseVarSet.length)];
            }

            currentTop = this.cyclicShift(currentTop, this.moves.top[topMove].shift);
            currentBottom = this.cyclicShift(currentBottom, this.moves.bottom[bottomMove].shift);

            notation.push(`(${this.moves.top[topMove].notation},${this.moves.bottom[bottomMove].notation})`);

            if (toState !== 0) {
                const swapped = this.swapLayers(currentTop, currentBottom);
                currentTop = swapped.newTop;
                currentBottom = swapped.newBottom;
                currentSeparator = currentSeparator === '/' ? '|' : '/';
                notation.push('/');
            }
        }

        const originalChars = this.initialTop + this.initialBottom;
        const encodedChars = currentTop + currentBottom;

        let result = '';
        for (let char of parts[0]) {
            const index = originalChars.indexOf(char);
            result += index !== -1 ? encodedChars[index] : char;
        }
        result += currentSeparator;
        for (let char of parts[1]) {
            const index = originalChars.indexOf(char);
            result += index !== -1 ? encodedChars[index] : char;
        }

        return {
            encoded: result,
            notation: notation.join('')
        };
    }
}

// ============================================================================
// SHUANG CHEN'S SQUARE-1 SOLVER
// ============================================================================

let ShapePrun = [];
let Shape_TopMove = [];
let Shape_BottomMove = [];
let Shape_TwistMove = [];
let Shape_ShapeIdxSolver = [];

function initShapeTables() {
    var count, depth, dl, done, done0, dr, i, idx, m, s, ul, ur, value, p1, p3, temp;
    
    Shape_ShapeIdxSolver = [];
    count = 0;
    for (i = 0; i < 28561; ++i) {
        dr = Solver_Shape_halflayer[i % 13];
        dl = Solver_Shape_halflayer[~~(i / 13) % 13];
        ur = Solver_Shape_halflayer[~~(~~(i / 13) / 13) % 13];
        ul = Solver_Shape_halflayer[~~(~~(~~(i / 13) / 13) / 13)];
        value = ul << 18 | ur << 12 | dl << 6 | dr;
        
        let bits = 0;
        let t = value;
        while (t) {
            bits += t & 1;
            t >>= 1;
        }
        if (bits === 16) {
            Shape_ShapeIdxSolver[count++] = value;
        }
    }
    
    function Shape_setIdx(obj, idx) {
        obj.Shape_parity = idx & 1;
        obj.top = Shape_ShapeIdxSolver[idx >> 1];
        obj.bottom = obj.top & 4095;
        obj.top >>= 12;
    }
    
    function Shape_getIdx(obj) {
        var ret;
        ret = binarySearch(Shape_ShapeIdxSolver, obj.top << 12 | obj.bottom) << 1 | obj.Shape_parity;
        return ret;
    }
    
    function bitCount(x) {
        x -= x >> 1 & 1431655765;
        x = (x >> 2 & 858993459) + (x & 858993459);
        x = (x >> 4) + x & 252645135;
        x += x >> 8;
        x += x >> 16;
        return x & 63;
    }
    
    function binarySearch(sortedArray, key) {
        var high, low, mid, midVal;
        low = 0;
        high = sortedArray.length - 1;
        while (low <= high) {
            mid = low + ((high - low) >> 1);
            midVal = sortedArray[mid];
            if (midVal < key) {
                low = mid + 1;
            } else if (midVal > key) {
                high = mid - 1;
            } else {
                return mid;
            }
        }
        return -low - 1;
    }
    
    function Shape_topMove(obj) {
        var move, moveParity;
        move = 0;
        moveParity = 0;
        do {
            if ((obj.top & 2048) == 0) {
                move += 1;
                obj.top = obj.top << 1;
            } else {
                move += 2;
                obj.top = obj.top << 2 ^ 12291;
            }
            moveParity = 1 - moveParity;
        }
        while ((bitCount(obj.top & 63) & 1) != 0);
        (bitCount(obj.top) & 2) == 0 && (obj.Shape_parity ^= moveParity);
        return move;
    }
    
    function Shape_bottomMove(obj) {
        var move, moveParity;
        move = 0;
        moveParity = 0;
        do {
            if ((obj.bottom & 2048) == 0) {
                move += 1;
                obj.bottom = obj.bottom << 1;
            } else {
                move += 2;
                obj.bottom = obj.bottom << 2 ^ 12291;
            }
            moveParity = 1 - moveParity;
        }
        while ((bitCount(obj.bottom & 63) & 1) != 0);
        (bitCount(obj.bottom) & 2) == 0 && (obj.Shape_parity ^= moveParity);
        return move;
    }
    
    s = { top: 0, bottom: 0, Shape_parity: 0 };
    
    for (i = 0; i < 7356; ++i) {
        Shape_setIdx(s, i);
        Shape_TopMove[i] = Shape_topMove(s);
        Shape_TopMove[i] |= Shape_getIdx(s) << 4;
        Shape_setIdx(s, i);
        Shape_BottomMove[i] = Shape_bottomMove(s);
        Shape_BottomMove[i] |= Shape_getIdx(s) << 4;
        Shape_setIdx(s, i);
        temp = s.top & 63;
        p1 = bitCount(temp);
        p3 = bitCount(s.bottom & 4032);
        s.Shape_parity ^= 1 & (p1 & p3) >> 1;
        s.top = s.top & 4032 | s.bottom >> 6 & 63;
        s.bottom = s.bottom & 63 | temp << 6;
        Shape_TwistMove[i] = Shape_getIdx(s);
    }
    
    for (i = 0; i < 7536; ++i) {
        ShapePrun[i] = -1;
    }
    
    function Shape_getShape2Idx(shp) {
        var ret;
        ret = binarySearch(Shape_ShapeIdxSolver, shp & 0xffffff) << 1 | shp >> 24;
        return ret;
    }
    
    ShapePrun[Shape_getShape2Idx(14378715)] = 0;
    ShapePrun[Shape_getShape2Idx(31157686)] = 0;
    ShapePrun[Shape_getShape2Idx(23967451)] = 0;
    ShapePrun[Shape_getShape2Idx(7191990)] = 0;
    done = 4;
    done0 = 0;
    depth = -1;
    
    while (done != done0) {
        done0 = done;
        ++depth;
        for (i = 0; i < 7536; ++i) {
            if (ShapePrun[i] == depth) {
                m = 0;
                idx = i;
                do {
                    idx = Shape_TopMove[idx];
                    m += idx & 15;
                    idx >>= 4;
                    if (ShapePrun[idx] == -1) {
                        ++done;
                        ShapePrun[idx] = depth + 1;
                    }
                }
                while (m != 12);
                m = 0;
                idx = i;
                do {
                    idx = Shape_BottomMove[idx];
                    m += idx & 15;
                    idx >>= 4;
                    if (ShapePrun[idx] == -1) {
                        ++done;
                        ShapePrun[idx] = depth + 1;
                    }
                }
                while (m != 12);
                idx = Shape_TwistMove[i];
                if (ShapePrun[idx] == -1) {
                    ++done;
                    ShapePrun[idx] = depth + 1;
                }
            }
        }
    }
}

class ShuangChenSearch {
    constructor() {
        this.Search_move = [];
        this.Search_d = new SqCubie();
        this.Search_sq = new Square();
        this.Search_c = null;
        this.Search_length1 = 0;
        this.Search_maxlen2 = 0;
        this.Search_sol_string = null;
    }
    
    FullCube_getParity(obj) {
        var a, b, cnt, i, p, arr;
        cnt = 0;
        arr = [obj.pieceAt(0)];
        for (i = 1; i < 24; ++i) {
            if (obj.pieceAt(i) != arr[cnt]) {
                arr[++cnt] = obj.pieceAt(i);
            }
        }
        p = 0;
        for (a = 0; a < 16; ++a) {
            for (b = a + 1; b < 16; ++b) {
                arr[a] > arr[b] && (p ^= 1);
            }
        }
        return p;
    }
    
    FullCube_getShapeIdx(obj) {
        var dlx, drx, ulx, urx;
        urx = obj.ur & 0x111111;
        urx |= urx >> 3;
        urx |= urx >> 6;
        urx = urx & 15 | urx >> 12 & 48;
        ulx = obj.ul & 0x111111;
        ulx |= ulx >> 3;
        ulx |= ulx >> 6;
        ulx = ulx & 15 | ulx >> 12 & 48;
        drx = obj.dr & 0x111111;
        drx |= drx >> 3;
        drx |= drx >> 6;
        drx = drx & 15 | drx >> 12 & 48;
        dlx = obj.dl & 0x111111;
        dlx |= dlx >> 3;
        dlx |= dlx >> 6;
        dlx = dlx & 15 | dlx >> 12 & 48;
        
        function binarySearch(sortedArray, key) {
            var high, low, mid, midVal;
            low = 0;
            high = sortedArray.length - 1;
            while (low <= high) {
                mid = low + ((high - low) >> 1);
                midVal = sortedArray[mid];
                if (midVal < key) {
                    low = mid + 1;
                } else if (midVal > key) {
                    high = mid - 1;
                } else {
                    return mid;
                }
            }
            return -low - 1;
        }
        
        const shapeValue = this.FullCube_getParity(obj) << 24 | ulx << 18 | urx << 12 | dlx << 6 | drx;
        const shapeIdx = binarySearch(Shape_ShapeIdxSolver, shapeValue & 0xffffff);
        return shapeIdx << 1 | (shapeValue >> 24);
    }
    
    FullCube_getSquare(obj, sq) {
        var a, b;
        var prm = [];
        for (a = 0; a < 8; ++a) {
            prm[a] = obj.pieceAt(a * 3 + 1) >> 1;
        }
        sq.cornperm = getNPerm(prm, 8);
        sq.topEdgeFirst = obj.pieceAt(0) == obj.pieceAt(1);
        a = sq.topEdgeFirst ? 2 : 0;
        for (b = 0; b < 4; a += 3, ++b)
            prm[b] = obj.pieceAt(a) >> 1;
        sq.botEdgeFirst = obj.pieceAt(12) == obj.pieceAt(13);
        a = sq.botEdgeFirst ? 14 : 12;
        for (; b < 8; a += 3, ++b)
            prm[b] = obj.pieceAt(a) >> 1;
        sq.edgeperm = getNPerm(prm, 8);
        sq.ml = obj.ml;
    }
    
    Search_move2string(obj, len) {
        var s = "";
        var top = 0, bottom = 0;
        for (var i = len - 1; i >= 0; i--) {
            var val = obj.Search_move[i];
            if (val > 0) {
                val = 12 - val;
                top = (val > 6) ? (val - 12) : val;
            } else if (val < 0) {
                val = 12 + val;
                bottom = (val > 6) ? (val - 12) : val;
            } else {
                var twst = "/";
                if (top == 0 && bottom == 0) {
                    s += twst;
                } else {
                    s += " (" + top + "," + bottom + ")" + twst;
                }
                top = bottom = 0;
            }
        }
        if (top == 0 && bottom == 0) { } else {
            s += " (" + top + "," + bottom + ") ";
        }
        return s;
    }
    
    Search_init2(obj) {
        var corner, edge, i, j, ml, prun;
        obj.Search_d.copy(obj.Search_c);
        for (i = 0; i < obj.Search_length1; ++i) {
            obj.Search_d.doMove(obj.Search_move[i]);
        }
        this.FullCube_getSquare(obj.Search_d, obj.Search_sq);
        edge = obj.Search_sq.edgeperm;
        corner = obj.Search_sq.cornperm;
        ml = obj.Search_sq.ml;
        prun = Math.max(SquarePrun[obj.Search_sq.edgeperm << 1 | ml], SquarePrun[obj.Search_sq.cornperm << 1 | ml]);
        for (i = prun; i < obj.Search_maxlen2; ++i) {
            if (this.Search_phase2(obj, edge, corner, obj.Search_sq.topEdgeFirst, obj.Search_sq.botEdgeFirst, ml, i, obj.Search_length1, 0)) {
                for (j = 0; j < i; ++j) {
                    obj.Search_d.doMove(obj.Search_move[obj.Search_length1 + j]);
                }
                obj.Search_sol_string = this.Search_move2string(obj, i + obj.Search_length1);
                return true;
            }
        }
        return false;
    }
    
    Search_phase1(obj, shape, prunvalue, maxl, depth, lm) {
        var m, prunx, shapex;
        if (prunvalue == 0 && maxl < 4) {
            return maxl == 0 && this.Search_init2(obj);
        }
        if (lm != 0) {
            shapex = Shape_TwistMove[shape];
            prunx = ShapePrun[shapex];
            if (prunx < maxl) {
                obj.Search_move[depth] = 0;
                if (this.Search_phase1(obj, shapex, prunx, maxl - 1, depth + 1, 0)) {
                    return true;
                }
            }
        }
        shapex = shape;
        if (lm <= 0) {
            m = 0;
            while (true) {
                m += Shape_TopMove[shapex];
                shapex = m >> 4;
                m &= 15;
                if (m >= 12) {
                    break;
                }
                prunx = ShapePrun[shapex];
                if (prunx > maxl) {
                    break;
                } else if (prunx < maxl) {
                    obj.Search_move[depth] = m;
                    if (this.Search_phase1(obj, shapex, prunx, maxl - 1, depth + 1, 1)) {
                        return true;
                    }
                }
            }
        }
        shapex = shape;
        if (lm <= 1) {
            m = 0;
            while (true) {
                m += Shape_BottomMove[shapex];
                shapex = m >> 4;
                m &= 15;
                if (m >= 6) {
                    break;
                }
                prunx = ShapePrun[shapex];
                if (prunx > maxl) {
                    break;
                } else if (prunx < maxl) {
                    obj.Search_move[depth] = -m;
                    if (this.Search_phase1(obj, shapex, prunx, maxl - 1, depth + 1, 2)) {
                        return true;
                    }
                }
            }
        }
        return false;
    }
    
    Search_phase2(obj, edge, corner, topEdgeFirst, botEdgeFirst, ml, maxl, depth, lm) {
        var botEdgeFirstx, cornerx, edgex, m, prun1, prun2, topEdgeFirstx;
        if (maxl == 0 && !topEdgeFirst && botEdgeFirst) {
            return true;
        }
        if (lm != 0 && topEdgeFirst == botEdgeFirst) {
            edgex = Square_TwistMove[edge];
            cornerx = Square_TwistMove[corner];
            if (SquarePrun[edgex << 1 | 1 - ml] < maxl && SquarePrun[cornerx << 1 | 1 - ml] < maxl) {
                obj.Search_move[depth] = 0;
                if (this.Search_phase2(obj, edgex, cornerx, topEdgeFirst, botEdgeFirst, 1 - ml, maxl - 1, depth + 1, 0)) {
                    return true;
                }
            }
        }
        if (lm <= 0) {
            topEdgeFirstx = !topEdgeFirst;
            edgex = topEdgeFirstx ? Square_TopMove[edge] : edge;
            cornerx = topEdgeFirstx ? corner : Square_TopMove[corner];
            m = topEdgeFirstx ? 1 : 2;
            prun1 = SquarePrun[edgex << 1 | ml];
            prun2 = SquarePrun[cornerx << 1 | ml];
            while (m < 12 && prun1 <= maxl && prun1 <= maxl) {
                if (prun1 < maxl && prun2 < maxl) {
                    obj.Search_move[depth] = m;
                    if (this.Search_phase2(obj, edgex, cornerx, topEdgeFirstx, botEdgeFirst, ml, maxl - 1, depth + 1, 1)) {
                        return true;
                    }
                }
                topEdgeFirstx = !topEdgeFirstx;
                if (topEdgeFirstx) {
                    edgex = Square_TopMove[edgex];
                    prun1 = SquarePrun[edgex << 1 | ml];
                    m += 1;
                } else {
                    cornerx = Square_TopMove[cornerx];
                    prun2 = SquarePrun[cornerx << 1 | ml];
                    m += 2;
                }
            }
        }
        if (lm <= 1) {
            botEdgeFirstx = !botEdgeFirst;
            edgex = botEdgeFirstx ? Square_BottomMove[edge] : edge;
            cornerx = botEdgeFirstx ? corner : Square_BottomMove[corner];
            m = botEdgeFirstx ? 1 : 2;
            prun1 = SquarePrun[edgex << 1 | ml];
            prun2 = SquarePrun[cornerx << 1 | ml];
            while (m < (maxl > 6 ? 6 : 12) && prun1 <= maxl && prun1 <= maxl) {
                if (prun1 < maxl && prun2 < maxl) {
                    obj.Search_move[depth] = -m;
                    if (this.Search_phase2(obj, edgex, cornerx, topEdgeFirst, botEdgeFirstx, ml, maxl - 1, depth + 1, 2)) {
                        return true;
                    }
                }
                botEdgeFirstx = !botEdgeFirstx;
                if (botEdgeFirstx) {
                    edgex = Square_BottomMove[edgex];
                    prun1 = SquarePrun[edgex << 1 | ml];
                    m += 1;
                } else {
                    cornerx = Square_BottomMove[cornerx];
                    prun2 = SquarePrun[cornerx << 1 | ml];
                    m += 2;
                }
            }
        }
        return false;
    }
    
    scrambleFromState(c) {
        var shape;
        this.Search_c = c;
        shape = this.FullCube_getShapeIdx(c);
        for (this.Search_length1 = ShapePrun[shape]; this.Search_length1 < 100; ++this.Search_length1) {
            this.Search_maxlen2 = Math.min(32 - this.Search_length1, 17);
            if (this.Search_phase1(this, shape, ShapePrun[shape], this.Search_length1, 0, -1)) {
                break;
            }
        }
        return this.Search_sol_string;
    }
}

const shuangChenSolver = new ShuangChenSearch();

// ============================================================================
// HEX FORMAT PARSER
// ============================================================================

function parseHexFormat(input) {
    const cubie = new SqCubie();

    try {
        input = input.replace(/\s/g, '');
        const parts = input.split(/[\|\/]/);

        if (parts.length !== 2) {
            throw new Error('Invalid format. Expected: 12 hex digits + separator + 12 hex digits');
        }

        const upperPart = parts[0];
        const lowerPart = parts[1];

        if (upperPart.length !== 12 || lowerPart.length !== 12) {
            throw new Error('Each part must be exactly 12 hex digits');
        }

        cubie.ul = parseInt(upperPart.substring(0, 6), 16);
        cubie.ur = parseInt(upperPart.substring(6, 12), 16);
        cubie.dl = parseInt(lowerPart.substring(0, 6), 16);
        cubie.dr = parseInt(lowerPart.substring(6, 12), 16);
        cubie.ml = input.includes('/') ? 1 : 0;

        return cubie;
    } catch (error) {
        throw new Error('Invalid hex format: ' + error.message);
    }
}

// ============================================================================
// SCRAMBLE UTILITIES
// ============================================================================

function normalizeInput(str) {
    return str
        .replace(/[`' ]/g, "")
        .replace(/\\/g, "/")
        .replace(/\+\+/g, "+")
        .trim();
}

function parseSets(str) {
    let tokens = [];
    let regex = /\(|\/|[-\d]+|,|\)/g;
    let match;
    let buffer = [];
    while ((match = regex.exec(str)) !== null) {
        if (match[0] === "/") {
            if (buffer.length) { tokens.push(buffer.join("")); buffer = []; }
            tokens.push("/");
        } else if (match[0] === "(") {
            buffer = ["("];
        } else if (match[0] === ")") {
            buffer.push(")");
            tokens.push(buffer.join(""));
            buffer = [];
        } else {
            buffer.push(match[0]);
        }
    }
    if (buffer.length) tokens.push(buffer.join(""));
    return tokens;
}

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
    x = norm(x); y = norm(y);
    return `(${x},${y})`;
}

function simplifyScramble(tokens, steps) {
    let changed = true;
    while (changed) {
        changed = false;
        for (let i = 0; i < tokens.length - 1; i++) {
            if (tokens[i] === "/" && tokens[i + 1] === "/") {
                tokens.splice(i, 2); steps.push(tokens.join("")); changed = true; break;
            }
        }
        if (changed) continue;

        for (let i = 0; i < tokens.length - 1; i++) {
            if (tokens[i].startsWith("(") && tokens[i + 1].startsWith("(")) {
                let merged = addSets(tokens[i], tokens[i + 1]);
                tokens.splice(i, 2, merged); steps.push(tokens.join("")); changed = true; break;
            }
        }
        if (changed) continue;

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

function invertScramble(s) {
    if (!s) return s;
    let str = String(s).trim().replace(/`/g, '');
    const tokens = str.match(/\([^\)]*\)|\/+/g);
    if (!tokens) return str;
    return tokens.slice().reverse().map(tok => {
        tok = tok.trim();
        if (tok.startsWith('(') && tok.endsWith(')')) {
            let inner = tok.slice(1, -1);
            let parts = inner.split(',').map(p => p.trim());
            let invParts = parts.map(p => {
                if (p === '') return p;
                const n = Number(p);
                if (Number.isNaN(n)) {
                    return p.charAt(0) === '-' ? p.slice(1) : ('-' + p);
                }
                let inverted = -n;
                if (inverted === -6) inverted = 6;
                return String(inverted);
            });
            return '(' + invParts.join(',') + ')';
        } else {
            return '/';
        }
    }).join('');
}

// ============================================================================
// MAIN SOLVER FUNCTION
// ============================================================================

function solveSquare1(hexInput) {
    // Ensure solver is initialized
    if (!solverInitialized) {
        initializeSolver();
    }
    
    try {
        // Get shape index and parity
        const { shapeIndex, parity } = getShapeIndexAndParity(hexInput);
        
        // Decide which solver to use
        const useRandomWalk = 
            (shapeIndex === 1015 && parity === 'odd') ||
            (shapeIndex === 1037 && parity === 'even') ||
            (shapeIndex === 2485 && parity === 'even') ||
            (shapeIndex === 2507 && parity === 'odd');
        
        if (useRandomWalk) {
            const cubie = parseHexFormat(hexInput);
            const solution = randomWalkSearch.findSolution(cubie);
            
            if (solution && solution !== '(solved)') {
                return solution.replace(/ \(|\)/g, "").trim();
            } else {
                throw new Error("No solution found or already solved");
            }
        } else {
            const enigma = new SQ1Enigma();
            const depth = Math.floor(Math.random() * 2) + 1; // Random depth 1-2
            const randomizedResult = enigma.encode(hexInput, depth);
            
            const invertedHint = invertScramble(randomizedResult.notation);
            
            // Now solve the randomized state using Shuang Chen's solver
            const randomizedCubie = parseHexFormat(randomizedResult.encoded);
            const shuangChenSolution = shuangChenSolver.scrambleFromState(randomizedCubie);
            
            if (!shuangChenSolution) {
                throw new Error('Could not generate scramble for randomized state');
            }
            
            // Combine: inverted hint + Shuang Chen's scramble
            const combined = invertedHint + ' ' + shuangChenSolution;            
            // Simplify the combined scramble
            const clean = normalizeInput(combined);
            const tokens = parseSets(clean);
            const steps = [];
            const simplified = simplifyScramble(tokens, steps);

            const finalOutput = simplified.map((tok, i) => {
                if (tok === "/") return "/";
                if (i === 0) return tok;
                return " " + tok;
            }).join("").replace(/\/\s*\(/g, "/ (");
            return finalOutput;
        }
    } catch (error) {
        throw new Error('Solver error: ' + error.message);
    }
}

// ============================================================================
// INITIALIZATION
// ============================================================================

let solverInitialized = false;

function initializeSolver() {
    if (solverInitialized) return;
    initSquareTables();
    initShapeTables();
    solverInitialized = true;
}

const randomWalkSearch = new RandomWalkSearch();

// ============================================================================
// BROWSER SUPPORT
// ============================================================================

if (typeof window !== 'undefined') {
    // Initialize synchronously on load
    initializeSolver();
    
    window.Square1Solver = {
        solve: solveSquare1,
        parseHexFormat: parseHexFormat,
        SqCubie: SqCubie,
        getShapeIndexAndParity: getShapeIndexAndParity,
        isInitialized: () => solverInitialized
    };
}

export { SqCubie, getShapeIndexAndParity, parseHexFormat, solveSquare1 };

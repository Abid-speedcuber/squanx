// =====================================================================
// === SCRAMBLE / ALG LOGIC ============================================
// =====================================================================

import SquanLib from '../squanlib.js';

// ── Karn → WCA unkarnify pipeline ────────────────────────────────────
// The full pipeline lives in ../squanlib.js (SquanLib). We keep a single
// shared instance so tempReplacements etc. persist across calls.
const squanLib = new SquanLib();

export function algToHex(scramble) {
    let tlHex = '011233455677';
    let blHex = '998bbaddcffe';
    for (const move of parseScramble(scramble)) {
        if (move.type === 'twist') {
            ({ tlHex, blHex } = twist(tlHex, blHex));
        } else {
            tlHex = cycleLeft(tlHex, move.top);
            blHex = cycleLeft(blHex, move.bottom);
        }
    }
    return { tlHex, blHex };
}

export function parseScramble(scramble) {
    const moves = [];
    const normalizedScramble = squanLib.addCommasPreservingSeparators(String(scramble).replace(/[()]/g, ''));
    const parts = normalizedScramble.replace(/[/\\|]/g, ' / ').trim().split(/\s+/).filter(Boolean);
    for (const part of parts) {
        if (part === '/') {
            moves.push({ type: 'twist' });
        } else if (part.includes(',')) {
            const [top, bottom] = part.replace(/[()]/g, '').split(',').map(n => parseInt(n.trim()));
            if (!isNaN(top) && !isNaN(bottom)) moves.push({ type: 'turn', top, bottom });
        } else if (/^-?\d/.test(part.replace(/[()]/g, ''))) {
            throw new Error(`Invalid numeric turn: "${part}"`);
        }
    }
    return moves;
}

function twist(tlHex, blHex) {
    return { tlHex: tlHex.slice(0, 6) + blHex.slice(0, 6), blHex: tlHex.slice(6) + blHex.slice(6) };
}

function cycleLeft(hex, places) {
    const n = ((places % 12) + 12) % 12;
    return hex.slice(n) + hex.slice(0, n);
}

export function invertScramble(str) {
    if (!str) return str;
    return String(str).trim().split('/').reverse().map(part => {
        part = part.trim();
        const src = part.includes('(') ? part.match(/\(([^)]+)\)/)?.[1] : part.includes(',') ? part : null;
        if (!src) return part;
        const inverted = src.split(',').map(v => { const n = parseInt(v.trim()); return isNaN(n) ? v.trim() : String(-n); }).join(',');
        return part.includes('(') ? `(${inverted})` : inverted;
    }).join('/');
}

export function unkarnify(scramble) {
    return squanLib.unkarnify(scramble);
}

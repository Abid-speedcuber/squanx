import { algToHex, invertScramble, unkarnify } from '../../../vendor/draw-a-squan/scripts/parseScramble.js';

function normalizeAlgorithmInput(rawInput, mode = 'inverse') {
    const input = String(rawInput || '').trim();
    if (!input) throw new Error('Algorithm input is empty');
    if (/^[0-9a-fA-FECWXYZR]{12}[|/]?[0-9a-fA-FECWXYZR]{12}$/.test(input)) {
        const hex = input.replace(/[|/]/g, '');
        return { tlHex: hex.slice(0, 12), blHex: hex.slice(12, 24), normalized: input, source: 'hex' };
    }

    const normalized = unkarnify(input);
    const parsed = mode === 'inverse'
        ? algToHex(invertScramble(normalized))
        : algToHex(normalized);
    return { ...parsed, normalized, source: 'algorithm' };
}

export { normalizeAlgorithmInput };

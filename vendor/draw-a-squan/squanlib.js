// =============================================================================
// Squan unkarnify pipeline
//
// Trimmed from the full SquanLib toolkit down to just the karn → WCA
// unkarnify pipeline (plus the helpers it depends on).
// =============================================================================

export default class SquanLib {

    // =========================================================================
    // SECTION 1: DATA TABLES
    // =========================================================================

    // -------------------------------------------------------------------------
    // karnToWCA
    // Keys are single karn tokens; values expand toward numeric turns. The
    // pipeline applies the table repeatedly (flattening) until only numeric
    // "u,d" turns remain.
    // -------------------------------------------------------------------------
    static karnToWCA = {
        "U4": "U U' U U'", "U4'": "U' U U' U",
        "D4": "D D' D D'", "D4'": "D' D D' D",
        "u4": "u u' u u'", "u4'": "u' u u' u",
        "d4": "d d' d d'", "d4'": "d' d d' d",

        "U3": "U U' U", "U3'": "U' U U'",
        "D3": "D D' D", "D3'": "D' D D'",
        "u3": "u u' u", "u3'": "u' u u'",
        "d3": "d d' d", "d3'": "d' d d'",
        "F3": "F F' F", "F3'": "F' F F'",
        "f3": "f f' f", "f3'": "f' f f'",

        "W": "U U'", "W'": "U' U",
        "B": "D D'", "B'": "D' D",
        "w": "u u'", "w'": "u' u",
        "b": "d d'", "b'": "d' d",
        "F2": "F F'", "F2'": "F' F",
        "f2": "f f'", "f2'": "f' f",
        "UU": "U U", "UU'": "U' U'",
        "DD": "D D", "DD'": "D' D'",
        "T2": "T T'", "T2'": "T' T",
        "t2": "t t'", "t2'": "t' t",
        "E2": "E E'", "E2'": "E' E",
        "ɇ": "U D", "ɇ'": "U' D'",
        "Ɇ": "U D'", "Ɇ'": "U' D",

        "U2": "6,0", "U2'": "6,0",
        "D2": "0,6",
        "U2D": "6,3", "U2D'": "6,-3",
        "U2'D": "6,3", "U2'D'": "6,-3",
        "U2D2": "6,6",
        "UD2": "3,6", "U'D2": "-3,6",

        "U": "3,0", "U'": "-3,0",
        "D": "0,3", "D'": "0,-3",
        "E": "3,-3", "E'": "-3,3",
        "e": "3,3", "e'": "-3,-3",
        "u": "2,-1", "u'": "-2,1",
        "d": "-1,2", "d'": "1,-2",
        "F": "4,1", "F'": "-4,-1",
        "f": "1,4", "f'": "-1,-4",
        "T": "2,-4", "T'": "-2,4",
        "t": "4,-2", "t'": "-4,2",
        "m": "2,2", "m'": "-2,-2",
        "M": "1,1", "M'": "-1,-1",
        "u2": "5,-1", "u2'": "-5,1",
        "d2": "-1,5", "d2'": "1,-5",
        "K": "5,2", "K'": "-5,-2",
        "k": "2,5", "k'": "-2,-5",
        "G": "5,-4", "G'": "-5,4",
        "g": "4,-5", "g'": "-4,5",
    };

    // -------------------------------------------------------------------------
    // shorthandToKarn
    // "move10" means top misalign, "move1-1" means double misalign, etc.
    // Some shorthands are alignment-independent (bjj, fjj, nn, …).
    // -------------------------------------------------------------------------
    static shorthandToKarn = {
        // ── alignment-independent ─────────────────────────────────────────────
        "bjj": "U' e D'", "fjj": "U e' D",
        "e2bjj": "U' e' U'", "e2fjj": "U e U",
        "nn": "E E'",
        "jn": "D4'", "nj": "U4",
        "jj": "U e' D", "bjj+e2": "U' e' U'",
        "-nn": "E' E",
        "-jn": "D4", "-nj": "D4'",
        // ── alignment-dependent ───────────────────────────────────────────────
        "bpj10": "d m' U", "bpj0-1": "u' m D'",
        "fpj10": "u m' D", "fpj0-1": "d' m U'",
        "aa10": "u m' u T'", "aa0-1": "U m' U t'",
        "fadj10": "D M' d'", "dadj10": "D M' d'",
        "fadj0-1": "U' M u", "u'adj0-1": "U' M u",
        "badj10": "U M' u'", "uadj10": "U M' u'",
        "badj0-1": "D' M d", "d'adj0-1": "D' M d",
        "bb10": "T u' e U'", "bb0-1": "t d e' D",
        "fdd10": "D e' d t", "fdd0-1": "U' e u' T",
        "bdd10": "U e' u T'", "bdd0-1": "D' e d' t'",
        "ff10": "d m' d M E", "ff0-1": "u' m U' M T",
        "fv10": "d4", "fv0-1": "d4'",
        "vf10": "u4", "vf0-1": "u4'",
        "y2fv10": "u d' u -5,4",
        "jf10": "w D' u T'", "jf0-1": "w' D u' T",
        "fj10": "b U' d t", "fj0-1": "b' U d' t'",
        "jr00": "e' w e", "jr10": "e' b e",
        "jr0-1": "e' w' e", "jr1-1": "e' b' e",
        "rj00": "e b' e'", "rj10": "e w e'",
        "rj0-1": "e b' e'", "rj1-1": "e w e'",
        "jv10": "b D d d2'", "jv0-1": "b' D' d' d2",
        "vj10": "w U u u2'", "vj0-1": "w' U' u' u2",
        "kk10": "u m' U E'", "kk0-1": "U m' u E'",
        "opp10": "u2 u2'", "opp0-1": "u2' u2",
        "pn10": "T T'", "pn0-1": "t t'",
        "px10": "f' d3' f'", "px0-1": "f d3 f",
        "xp10": "F' u3' F'", "xp0-1": "F u3 F",
        "tt10": "d m' F' u2'",
        "fss10": "u M D' E'", "fss0-1": "D' M u E'",
        "bss10": "D M' u' E", "bss0-1": "U' M d E",
        "vv10": "u M u m' E'",
        "zz10": "u M t' M D'", "zz0-1": "D' M t' M u",
        // random things
        "30adj10": "U M' u'", "-30adj0-1": "U' M u",
        "03adj10": "D M' d'",
        "obopp00": "1,0/M' F M' F M'/0,1",
        "oaopp1-1": "0,1/M' u' M' u' M'/0,1",
        "but00": "", "also00": "", "done!00": "0,0",
    };

    static alignmentIndependent = new Set([
        'bjj', 'fjj', 'nn', 'jn', 'nj', 'e2bjj', 'e2fjj',
        'jj', 'bjj+e2', '-nn', '-jn', '-nj',
    ]);


    // =========================================================================
    // SECTION 2: CONSTRUCTION
    // =========================================================================

    /**
     * @param {object} [tempReplacements] initial manual unkarnifications.
     */
    constructor(tempReplacements = { "meow :3": "meow :3" }) {
        // place to put manual unkarnifications
        this.tempReplacements = { ...tempReplacements };
    }

    /**
     * setTempReplacements: replace the entire tempReplacements map.
     *
     * @param {Object<string,string>} replacements the new key→value pairs
     * @returns {this}
     */
    setTempReplacements(replacements) {
        this.tempReplacements = { ...replacements };
        return this;
    }

    /**
     * addTempReplacements: merge key→value pairs into tempReplacements.
     *
     * @param {Object<string,string>} replacements: pairs to add (overwrites collisions)
     * @returns {this}
     */
    addTempReplacements(replacements) {
        Object.assign(this.tempReplacements, replacements);
        return this;
    }


    // =========================================================================
    // SECTION 3: CORE UTILITIES
    // =========================================================================

    /**
     * addCommas: e.g. "2-1" → "2,-1"
     *
     * length 1 → "N,0"
     * length 2 → starts with '-'? "-N,0" : "A,B"
     * length 3 → starts with '-'? "-A,B" : "A,BC"    (where BC is the second part)
     * length 4 → "AB,CD"
     * anything else that is not all-digits/minus → pass through unchanged
     *
     * @param {string} alg the scramble, any separator (no additional spaces). can have commas already.
     * @returns {string} the scramble, with commas added
     */
    addCommas(alg) {
        return alg.split(/[/\\| ]/).map(move => {
            if (!move || isNaN(Number(move.replaceAll('-', ''))) || move.includes(","))
                return move;
            switch (move.length) {
                case 1: return move + ',0';
                case 2: return move.charAt(0) === '-' ? move + ',0'
                    : move[0] + ',' + move[1];
                case 3: return move.charAt(0) === '-' ? move.slice(0, 2) + ',' + move[2]
                    : move[0] + ',' + move.slice(1);
                case 4: return move.slice(0, 2) + ',' + move.slice(2);
                default: throw new Error(`"${move}" is not a valid karn numeric move`);
            }
        }).join(' ');
    }

    /**
     * addCommasPreservingSeparators: add commas to numeric shorthand without
     * flattening slices/spaces into a single separator type.
     *
     * @param {string} alg the scramble
     * @returns {string} the scramble with numeric shorthand normalized
     */
    addCommasPreservingSeparators(alg) {
        return alg.split(/([/\\| ]+)/).map(part => {
            if (!part || /^[/\\| ]+$/.test(part)) return part;
            return this.addCommas(part);
        }).join('');
    }

    /**
     * isKarn: returns true if the string uses any letters, excluding A and a
     *
     * @param {string} str the alg
     * @returns {boolean} whether the alg contains letters, excluding A and a
     */
    isKarn(str) {
        return /[b-zB-Z]/.test(str);
    }

    /**
     * getAlignmentMove: turns topA and bottomA into a starting move
     *
     * @param {boolean} topA top misalign?
     * @param {boolean} bottomA bottom misalign?
     * @returns {string} e.g. "10", "1-1"
     */
    getAlignmentMove(topA, bottomA) {
        return (topA ? '1' : '0') + (bottomA ? '-1' : '0');
    }


    // =========================================================================
    // SECTION 4: UNKARNIFY PIPELINE
    // =========================================================================

    /**
     * unkarnifyHelp: does the actual unkarnifying
     *
     * @param {string} alg the alg
     * @returns {string} surface-level unkarnified alg
     */
    unkarnifyHelp(alg) {
        // trim and replace random ass characters
        alg = alg.trim().replaceAll(/[()]/g, "");
        // " / " → "/"
        alg = alg.replaceAll(/ ([\/\\\|]) /g, "$1")
        if (/[\/\\\|]{2,}/.test(alg)) throw new Error("unkarnifyHelp: Two slices in a row.");

        if (!this.isKarn(alg)) return this.addCommasPreservingSeparators(alg); // not karn at all

        // these can be "", if the alg starts/ends with a slice
        let firstMove, lastMove;
        if (!/[/\\| ]/.test(alg)) firstMove = lastMove = alg; // only one move
        else {
            firstMove = alg.match(/^([^/\\| ]*)[/\\| ]/)?.[1];
            lastMove = alg.match(/[/\\| ]([^/\\| ]*)$/)?.[1];
        }

        // only tests if it literally starts with a slice
        let startsSlice = ["/", "\\", "|"].includes(alg.charAt(0));
        // grab the literal starting slice, or just use a /
        let startingSlice = startsSlice ? alg.charAt(0) :
            firstMove in SquanLib.karnToWCA ? "/" : "";
        // same
        let endingSlice = "/" === alg.at(-1) ? "/" :
            lastMove in SquanLib.karnToWCA ? "/" : "";

        // replace all possible slices with spaces now that we have slice start
        alg = alg.replaceAll(/[/\\| ]+/g, ' ');
        alg = this.addCommas(alg);
        // now go through scramble move by move
        let s = alg.split(" ").filter(Boolean);
        for (let i = 0; i < s.length; i++)
            if (s[i] in SquanLib.karnToWCA) s[i] = SquanLib.karnToWCA[s[i]].split(" ");

        // high karns gone. now flatten
        s = s.flat();
        for (let i = 0; i < s.length; i++)
            if (s[i] in SquanLib.karnToWCA) s[i] = SquanLib.karnToWCA[s[i]];

        alg = startingSlice + s.join("/") + endingSlice;
        // sanity replacements
        alg = alg.replaceAll(/ +/g, "")
        if (/[\/\\\|]{2,}/.test(alg)) throw new Error("unkarnifyHelp: Two slices in a row post-replacements.");

        return alg;
    }

    /**
     * unkarnify: master karn → WCA
     * basically unkarnifyHelp + replaceShorthand with bling blings
     *
     * @param {string} alg the alg to be unkarnified
     * @returns {string} unkarnified alg, duh
     */
    unkarnify(alg) {
        // overrides
        if (alg in this.tempReplacements) return this.tempReplacements[alg];

        // legacy character substitutions
        alg = alg
            .replaceAll('&', '-1')
            .replaceAll('^', '-2')
            .replaceAll('9', '-3')
            .replaceAll('8', '-4')
            .replaceAll('7', '-5');

        // remove potential move counts, comments
        alg = alg.replaceAll(/\[.*?\]/g, "");

        // p scrambles
        let isPScramble = /^p[ /\\|]/.test(alg);
        let startingSlice;
        if (isPScramble) {
            startingSlice = alg.charAt(1) === " " ? "/" : alg.charAt(1);
            alg = alg.slice(2, -3);
        }

        // expand move groups, e.g. "(U U')3" → "U U' U U' U U'"
        for (const group of alg.matchAll(/(\(.*?\))(\d+)/g)) {
            const inner = group[1].replaceAll(/[()]/g, '');
            const count = parseInt(group[2], 10);
            alg = alg.replace(group[0], Array(count).fill(inner).join(' '));
        }

        // the core defer
        let final = this.replaceShorthands(this.unkarnifyHelp(alg));

        // handle p scramble
        if (isPScramble) {
            if (["/", "\\", "|"].includes(final.charAt(0))) final = final.slice(1);
            final = 'p' + startingSlice + final + "/p'";
        }
        final = final.replaceAll(/\/+/g, '/');

        return final;
    }

    /**
     * replaceShorthands: replace shorthands (bjj, fv, kk, …) in an alg,
     * tracking alignment state to choose the correct shorthand.
     *
     * @param {string} alg the alg
     * @returns {string} the alg with shorthands replaced... guys jsdoc is sometimes dumb
     */
    replaceShorthands(alg) {
        const moves = alg.split(/[\/\\\|]/);

        // early out: no shorthands
        const allKnown = moves.every(m =>
            !m || !this.isKarn(m) || (' ' + m + ' ' in SquanLib.karnToWCA)
        );
        if (allKnown) return this.unkarnifyHelp(alg);

        let topA = false, bottomA = false;

        for (const move of moves) {
            if (!move) continue;

            if (move.includes(',')) {
                // Numeric turn: update alignment tracker.
                const [u, d] = move.split(',');
                if (parseInt(u, 10) % 3 !== 0) topA = !topA;
                if (parseInt(d, 10) % 3 !== 0) bottomA = !bottomA;
            } else {
                // shorthand
                const key = SquanLib.alignmentIndependent.has(move.toLowerCase())
                    ? move.toLowerCase()
                    : move.toLowerCase() + this.getAlignmentMove(topA, bottomA);

                const replacement = SquanLib.shorthandToKarn[key];
                if (replacement === undefined)
                    throw new Error(`replaceShorthands: "${move}" with alignment ${this.getAlignmentMove(topA, bottomA)} is not defined.`);

                alg = alg.replace(move, replacement);

                // Update alignment based on what the replacement expands to.
                for (const sub of this.unkarnifyHelp(replacement).split('/')) {
                    if (!sub) continue;
                    const [u, d] = sub.split(',');
                    if (parseInt(u, 10) % 3 !== 0) topA = !topA;
                    if (parseInt(d, 10) % 3 !== 0) bottomA = !bottomA;
                }
            }
        }

        // unkarnify the shorthands that were replaced into the alg
        return this.unkarnifyHelp(alg);
    }
}

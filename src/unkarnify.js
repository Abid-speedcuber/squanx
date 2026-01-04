
function replaceUsingTheDictionaryGivenThankYou(str, dict) {
    // keys are already sorted longest → shortest
    const pattern = new RegExp(Object.keys(dict).join("|"), "g");
    while (str.replace(pattern, match => dict[match]) !== str)
        str = str.replace(pattern, match => dict[match]);
    return str;
}

const humanNotationCounterpartToKarn = {
    " U4 ": " U U' U U' ",
    " U4' ": " U' U U' U ",
    " D4 ": " D D' D D' ",
    " D4' ": " D' D D' D ",
    " u4 ": " u u' u u' ",
    " u4' ": " u' u u' u ",
    " d4 ": " d d' d d' ",
    " d4' ": " d' d d' d ",
    " U3 ": " U U' U ",
    " U3' ": " U' U U' ",
    " D3 ": " D D' D ",
    " D3' ": " D' D D' ",
    " u3 ": " u u' u ",
    " u3' ": " u' u u' ",
    " d3 ": " d d' d ",
    " d3' ": " d' d d' ",
    " F3 ": " F F' F ",
    " F3' ": " F' F F' ",
    " f3 ": " f f' f ",
    " f3' ": " f' f f' ",
    " W ": " U U' ",
    " W' ": " U' U ",
    " B ": " D D' ",
    " B' ": " D' D ",
    " w ": " u u' ",
    " w' ": " u' u ",
    " b ": " d d' ",
    " b' ": " d' d ",
    " F2 ": " F F' ",
    " F2' ": " F' F ",
    " f2 ": " f f' ",
    " f2' ": " f' f ",
    " UU ": " U U ",
    " UU' ": " U' U' ",
    " DD ": " D D ",
    " DD' ": " D' D' ",
    " U2 ": " 6,0 ",
    " U2D ": " 6,3 ",
    " U2D' ": " 6,-3 ",
    " U2D2 ": " 6,6 ",
    " D2 ": " 0,6 ",
    " UD2 ": " 3,6 ",
    " U'D2 ": " -3,6 ",
    " U ": " 3,0 ",
    " U' ": " -3,0 ",
    " D ": " 0,3 ",
    " D' ": " 0,-3 ",
    " E ": " 3,-3 ",
    " E' ": " -3,3 ",
    " e ": " 3,3 ",
    " e' ": " -3,-3 ",
    " u ": " 2,-1 ",
    " u' ": " -2,1 ",
    " d ": " -1,2 ",
    " d' ": " 1,-2 ",
    " F' ": " -4,-1 ",
    " F ": " 4,1 ",
    " f' ": " -1,-4 ",
    " f ": " 1,4 ",
    " T ": " 2,-4 ",
    " T' ": " -2,4 ",
    " t' ": " -4,2 ",
    " t ": " 4,-2 ",
    " m ": " 2,2 ",
    " m' ": " -2,-2 ",
    " M' ": " -1,-1 ",
    " M ": " 1,1 ",
    " u2 ": " 5,-1 ",
    " u2' ": " -5,1 ",
    " d2 ": " -1,5 ",
    " d2' ": " 1,-5 ",
    " K' ": " -5,-2 ",
    " K ": " 5,2 ",
    " k ": " 2,5 ",
    " k' ": " -2,-5 ",
};

const howShouldIReplaceAllTheShorthands = {
    "bJJ": "U' e D'",
    "E2bJJ": "U' e' U'",
    "fJJ": "U e' D",
    "E2fJJ": "U e U",

    "bpJ10": "d m' U",
    "bpJ0-1": "u' m D'",
    "E2bpJ10": "d 4,4 D",
    "fpJ10": "u m' D",
    "fpJ0-1": "d' m U'",
    "E2fpJ10": "u 4,4 U",

    "NN": "E E'",

    "AA10": "u m' u T'",
    "AA0-1": "U m' U t'",

    "fAdj10": "D M' d'",
    "fAdj0-1": "U' M u",
    "bAdj10": "U M u'",
    "bAdj0-1": "D' M d",

    "BB10": "T u' e U'",
    "BB0-1": "t d e' D",
    
    "fDD10": "D e' d t",
    "fDD0-1": "U' e u' T",
    "bDD10": "U e' u T'",
    "bDD0-1": "D' e d' t'",

    "FF10": "d m' d M E",

    "FV10": "d4",
    "FV0-1": "d4'",
    "VF10": "u4",
    "VF0-1": "u4'",

    "JF10": "w D' u T'",
    "JF0-1": "w' D u' T",
    "FJ10": "b U' d t",
    "FJ0-1": "b' U d' t'",

    "JR00": "e' w' e",
    "JR10": "e' b e",
    "JR0-1": "e' w' e",
    "JR1-1": "e' b e",
    "RJ00": "e b' e'",
    "RJ10": "e w e'",
    "RJ0-1": "e b' e'",
    "RJ1-1": "e w e'",

    "JV10": "b D d d2'",
    "JV0-1": "b' D' d' d2",
    "VJ10": "w U u u2'",
    "VJ0-1": "w' U' u' u2",

    "KK10": "u m' U E'",
    "KK0-1": "U m' u E'",

    "Opp10": "u2 u2'",
    "Opp0-1": "u2' u2",

    "pN10": "T T'",
    "pN0-1": "t t'",

    "PX10": "f' d3' f'",
    "PX0-1": "f d3 f",
    "XP10": "F' u3' F'",
    "XP0-1": "F u3 F",

    "TT10": "d m' F' u2'",

    "fSS10": "u M D' E'",
    "fSS0-1": "D' M u E'",
    "bSS10": "D' M' u' E",
    "bSS0-1": "U' M d E",

    "VV10": "u M u m' E'",

    "ZZ10": "u M t' M D'",
    "ZZ0-1": "D' M t' M u"
};

function makeAPBLDocScrambleWCANotationPlease(scramble) {
    // scramble is a string that contains the starting 10 or 0-1 and the end alignment, etc.
    // downslice and upslice to a space; remove parentheses; trim
    scramble = scramble.replaceAll(/\/|\\/g, " ").replaceAll(/\(|\)/g, "").trim();
    scramble = addCommasToLiteralMovesPlease(scramble);
    return replaceAllTheShorthands(replaceUsingTheDictionaryGivenThankYou(scramble, humanNotationCounterpartToKarn));
}

function replaceAllTheShorthands(scramble) {
    // scramble: e.g. "1,0 bJJ -3,0 2,-1 1,1 2,-1 -5,1 -1,0"
    // gonna assume the scramble is valid.
    let moves = scramble.split(" ");
    let topA = false;
    let bottomA = false;
    for (let move of moves) {
        if (move.includes(",")) {
            // it's a move, not a shorthand
            let [u, d] = move.split(",");
            if (parseInt(u, 10) % 3 !== 0) topA = !topA;
            if (parseInt(d, 10) % 3 !== 0) bottomA = !bottomA;
        } else {
            // it's a shorthand
            let replacement;
            if (["bJJ", "E2bJJ", "fJJ", "E2fJJ", "NN"].includes(move))
                replacement = howShouldIReplaceAllTheShorthands[move];
            else replacement = howShouldIReplaceAllTheShorthands[move+gimmeTheAlignmentSuffixPlease(topA, bottomA)];
            if (replacement === undefined) throw new Error(`${move} with ${gimmeTheAlignmentSuffixPlease(topA, bottomA)} alignment is not a thing.`)
            scramble = scramble.replace(move, replacement);
            for (let submove of replaceUsingTheDictionaryGivenThankYou(" "+replacement+" ", humanNotationCounterpartToKarn).split(" ")) {
                let [u, d] = submove.split(",");
                if (parseInt(u, 10) % 3 !== 0) topA = !topA;
                if (parseInt(d, 10) % 3 !== 0) bottomA = !bottomA;
            }
        }
    }
    if (topA || bottomA) throw new Error("this alg doesn't end in no misalign: "+scramble);
    return replaceUsingTheDictionaryGivenThankYou(" "+scramble+" ", humanNotationCounterpartToKarn).trim().replaceAll(" ", "/"); // unkarnify the shorthands
}

function gimmeTheAlignmentSuffixPlease(topA, bottomA) {
    let ret = "";
    ret += topA ? "1" : "0";
    ret += bottomA ? "-1" : "0";
    return ret;
}

function addCommasToLiteralMovesPlease(scramble) {
    // assume valid scramble
    let moves = scramble.split(" ")
    for (let inx = 0; inx < moves.length; inx++) {
        if (!Number.isNaN(parseInt(moves[inx].at(-1), 10))) {
            // we have a move like -23 or -10
            let move = moves[inx];
            switch (move.length) {
                case 2:
                    moves[inx] = move.charAt(0) + "," + move.charAt(1);
                    break;
                case 3:
                    moves[inx] = move.charAt(0) === "-" ?
                                move.slice(0,2) + "," + move.charAt(2) :
                                move.charAt(0) + "," + move.slice(1);
                    break;
                case 4:
                    moves[inx] = move.slice(0,2) + "," + move.slice(2);
                    break;
                default:
                    throw new Error(`${move} is not a valid move, idk how we got here`);
            }
        }
    }
    return moves.join(" ");
}

// Export for browser
if (typeof window !== 'undefined') {
    window.makeAPBLDocScrambleWCANotationPlease = makeAPBLDocScrambleWCANotationPlease;
}

// Node.js CLI support
if (typeof process !== 'undefined' && process.argv) {
    const args = process.argv.slice(2);
    if (args[0]) {
        console.log(makeAPBLDocScrambleWCANotationPlease(args[0]));
    }
}

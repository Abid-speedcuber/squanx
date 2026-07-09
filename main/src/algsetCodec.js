const COMPACT_VERSION = 1;
const COMPACT_FIELDS = ['equator', 'parity', 'constraints', 'auf', 'adf', 'rul', 'rdl'];

function isObject(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isExpandedCase(value) {
    return isObject(value) && typeof value.caseName === 'string';
}

function isCompactAlgset(value) {
    return isObject(value) && value.c === COMPACT_VERSION && isObject(value.t);
}

function stableStringify(value) {
    if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
    if (isObject(value)) {
        return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`;
    }
    return JSON.stringify(value);
}

function clone(value) {
    return value == null ? value : JSON.parse(JSON.stringify(value));
}

function collectCases(node) {
    const cases = [];
    for (const value of Object.values(node || {})) {
        if (isExpandedCase(value)) cases.push(value);
        else if (isObject(value)) cases.push(...collectCases(value));
    }
    return cases;
}

function computeDefaultPairs(cases, inheritedDefaults) {
    const pairs = [];
    if (!cases.length) return pairs;

    COMPACT_FIELDS.forEach((field, index) => {
        const counts = new Map();
        const values = new Map();
        for (const item of cases) {
            const value = item[field];
            const key = stableStringify(value);
            counts.set(key, (counts.get(key) || 0) + 1);
            values.set(key, value);
        }

        let bestKey = '';
        let bestCount = 0;
        for (const [key, count] of counts.entries()) {
            if (count > bestCount) {
                bestKey = key;
                bestCount = count;
            }
        }

        if (bestCount <= cases.length / 2) return;
        if (stableStringify(inheritedDefaults[field]) === bestKey) return;
        pairs.push([index, clone(values.get(bestKey))]);
    });

    return pairs;
}

function applyDefaultPairs(defaults, pairs) {
    const next = { ...defaults };
    for (const [index, value] of pairs || []) {
        const field = COMPACT_FIELDS[index];
        if (field) next[field] = clone(value);
    }
    return next;
}

function compactCase(item, defaults) {
    const overrides = [];
    COMPACT_FIELDS.forEach((field, index) => {
        if (stableStringify(item[field]) !== stableStringify(defaults[field])) {
            overrides.push([index, clone(item[field])]);
        }
    });

    const result = [item.inputTop, item.inputBottom];
    if (item.alg || overrides.length) result.push(item.alg || '');
    if (overrides.length) result.push(overrides);
    return result;
}

function compactNode(node, inheritedDefaults) {
    const cases = collectCases(node);
    const defaultPairs = computeDefaultPairs(cases, inheritedDefaults);
    const defaults = applyDefaultPairs(inheritedDefaults, defaultPairs);
    const children = {};

    for (const [key, value] of Object.entries(node || {})) {
        if (isExpandedCase(value)) children[key] = compactCase(value, defaults);
        else if (isObject(value)) children[key] = { _: compactNode(value, defaults) };
    }

    return [defaultPairs, children];
}

function compactAlgset(tree) {
    const [defaultPairs, children] = compactNode(tree, {});
    return { c: COMPACT_VERSION, d: defaultPairs, t: children };
}

function expandCompactCase(name, item, defaults) {
    const [inputTop = '', inputBottom = '', alg = '', overrides = []] = item;
    const finalDefaults = applyDefaultPairs(defaults, overrides);
    return {
        caseName: name,
        inputTop,
        inputBottom,
        equator: clone(finalDefaults.equator || []),
        parity: clone(finalDefaults.parity || []),
        constraints: clone(finalDefaults.constraints || {}),
        auf: clone(finalDefaults.auf || []),
        adf: clone(finalDefaults.adf || []),
        rul: clone(finalDefaults.rul || []),
        rdl: clone(finalDefaults.rdl || []),
        alg: String(alg || '')
    };
}

function expandCompactNode(node, defaults) {
    const tree = {};
    for (const [key, value] of Object.entries(node || {})) {
        if (Array.isArray(value)) {
            tree[key] = expandCompactCase(key, value, defaults);
        } else if (isObject(value) && Array.isArray(value._)) {
            const [defaultPairs = [], children = {}] = value._;
            tree[key] = expandCompactNode(children, applyDefaultPairs(defaults, defaultPairs));
        }
    }
    return tree;
}

function expandCompactAlgset(value) {
    if (!isCompactAlgset(value)) return value;
    return expandCompactNode(value.t, applyDefaultPairs({}, value.d || []));
}

function stringifyCompactAlgset(tree) {
    return JSON.stringify(compactAlgset(tree));
}

export {
    compactAlgset,
    expandCompactAlgset,
    isCompactAlgset,
    stringifyCompactAlgset
};

const DEFAULT_LAYER = 'RRRRRRRRRRRR';

const DEFAULT_CASE = Object.freeze({
    caseName: '',
    inputTop: DEFAULT_LAYER,
    inputBottom: DEFAULT_LAYER,
    equator: ['/', '|'],
    parity: [],
    constraints: {},
    auf: ['U0'],
    adf: ['D0'],
    rul: [0],
    rdl: [0],
    alg: ''
});

const MOVE_OPTIONS = ['U0', 'U', 'U2', "U'"];
const DOWN_MOVE_OPTIONS = ['D0', 'D', 'D2', "D'"];
const NUMBER_OPTIONS = [-5, -4, -3, -2, -1, 0, 1, 2, 3, 4, 5, 6];
const EQUATOR_OPTIONS = ['/', '|'];
const PARITY_OPTIONS = ['on', 'op', 'tnbn', 'tpbn', 'tnbp', 'tpbp'];

function clone(value) {
    if (value == null) return value;
    return JSON.parse(JSON.stringify(value));
}

function isObject(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isCase(value) {
    return isObject(value) && typeof value.caseName === 'string';
}

function isFolder(value) {
    return isObject(value) && !isCase(value);
}

function escapeHtml(value) {
    return String(value ?? '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;');
}

function splitPath(path) {
    if (!path) return [];
    const value = String(path);
    if (value.startsWith('[')) {
        try {
            const parts = JSON.parse(value);
            if (Array.isArray(parts)) return parts.map(String).filter(Boolean);
        } catch {
            return [];
        }
    }
    return value.split('/').filter(Boolean);
}

function joinPath(parts) {
    const cleanParts = parts.map(String).filter(Boolean);
    return cleanParts.length ? JSON.stringify(cleanParts) : '';
}

function childPath(parentPath, childName) {
    return joinPath([...splitPath(parentPath), childName]);
}

function normalizePath(path) {
    return joinPath(splitPath(path));
}

function getPathName(path) {
    return splitPath(path).at(-1) || '';
}

function isPathWithin(path, parentPath) {
    const parts = splitPath(path);
    const parentParts = splitPath(parentPath);
    return parentParts.length > 0
        && parts.length > parentParts.length
        && parentParts.every((part, index) => parts[index] === part);
}

function replacePathPrefix(path, previousPath, nextPath) {
    if (!path) return '';
    const parts = splitPath(path);
    const previousParts = splitPath(previousPath);
    if (!previousParts.length) return path;
    const matches = previousParts.every((part, index) => parts[index] === part);
    if (!matches) return path;
    const nextParts = splitPath(nextPath);
    return joinPath([...nextParts, ...parts.slice(previousParts.length)]);
}

function normalizeArray(value, fallback) {
    return Array.isArray(value) ? value.slice() : fallback.slice();
}

function normalizeConstraints(value) {
    if (!isObject(value)) return {};
    return Object.fromEntries(
        Object.entries(value)
            .filter(([key, values]) => key && Array.isArray(values))
            .map(([key, values]) => [key, values.map(String).filter(Boolean)])
    );
}

function normalizeCase(name, value = {}) {
    const source = isObject(value) ? value : {};
    return {
        caseName: String(source.caseName || name || ''),
        inputTop: String(source.inputTop || DEFAULT_CASE.inputTop).slice(0, 12),
        inputBottom: String(source.inputBottom || DEFAULT_CASE.inputBottom).slice(0, 12),
        equator: normalizeArray(source.equator, DEFAULT_CASE.equator),
        parity: normalizeArray(source.parity, DEFAULT_CASE.parity),
        constraints: normalizeConstraints(source.constraints),
        auf: normalizeArray(source.auf, DEFAULT_CASE.auf),
        adf: normalizeArray(source.adf, DEFAULT_CASE.adf),
        rul: normalizeArray(source.rul, DEFAULT_CASE.rul).map(Number),
        rdl: normalizeArray(source.rdl, DEFAULT_CASE.rdl).map(Number),
        alg: String(source.alg || '')
    };
}

function normalizeTree(source = {}) {
    if (!isObject(source)) return {};
    const tree = {};
    for (const [key, value] of Object.entries(source)) {
        if (!isObject(value)) continue;
        tree[key] = isCase(value) ? normalizeCase(key, value) : normalizeTree(value);
    }
    return tree;
}

function normalizeRoots(source, fallbackRoot) {
    const input = isObject(source) && Object.keys(source).length ? source : { default: fallbackRoot || {} };
    const roots = {};
    for (const [name, tree] of Object.entries(input)) {
        roots[name] = normalizeTree(tree);
    }
    if (!Object.keys(roots).length) roots.default = normalizeTree(fallbackRoot || {});
    return roots;
}

function getNode(root, path) {
    let current = root;
    for (const part of splitPath(path)) {
        if (!isFolder(current) || !isObject(current[part])) return null;
        current = current[part];
    }
    return current;
}

function getParent(root, path) {
    const parts = splitPath(path);
    const key = parts.pop() || '';
    const parent = getNode(root, joinPath(parts));
    return parent && isFolder(parent) ? { parent, key, parentPath: joinPath(parts) } : null;
}

function getTargetFolder(root, selectedPath) {
    const selected = getNode(root, selectedPath);
    if (!selectedPath || !selected) return { folder: root, path: '' };
    if (isFolder(selected)) return { folder: selected, path: selectedPath };
    const parentInfo = getParent(root, selectedPath);
    return parentInfo ? { folder: parentInfo.parent, path: parentInfo.parentPath } : { folder: root, path: '' };
}

function getUniqueName(parent, baseName) {
    if (!parent[baseName]) return baseName;
    let counter = 1;
    let name = `${baseName} ${counter}`;
    while (parent[name]) {
        counter += 1;
        name = `${baseName} ${counter}`;
    }
    return name;
}

function collectCases(node, path = []) {
    if (!isObject(node)) return [];
    const cases = [];
    for (const [key, value] of Object.entries(node)) {
        if (!isObject(value)) continue;
        const nextPath = [...path, key];
        if (isCase(value)) cases.push({ key, path: joinPath(nextPath), labelPath: nextPath.join(' > '), item: value });
        else cases.push(...collectCases(value, nextPath));
    }
    return cases;
}

function collectFolders(node, path = []) {
    if (!isObject(node)) return [];
    const folders = [];
    for (const [key, value] of Object.entries(node)) {
        if (isFolder(value)) {
            const nextPath = [...path, key];
            folders.push({ key, path: joinPath(nextPath), item: value });
            folders.push(...collectFolders(value, nextPath));
        }
    }
    return folders;
}

function findFirstCase(node) {
    return collectCases(node)[0] || null;
}

function deepMergeTree(target, source) {
    for (const [key, value] of Object.entries(normalizeTree(source))) {
        if (isFolder(value) && isFolder(target[key])) {
            deepMergeTree(target[key], value);
            continue;
        }

        let finalKey = key;
        if (target[finalKey]) finalKey = getUniqueName(target, key);
        target[finalKey] = clone(value);
        if (isCase(target[finalKey])) target[finalKey].caseName = finalKey;
    }
}

function createCaseFromTemplate(name, template) {
    const source = template ? clone(template) : clone(DEFAULT_CASE);
    const item = normalizeCase(name, source);
    item.caseName = name;
    if (source.alg) item.alg = String(source.alg);
    return item;
}

function createTemplateDraft(template) {
    const draft = normalizeCase('', template || DEFAULT_CASE);
    delete draft.caseName;
    delete draft.alg;
    return draft;
}

function sanitizeFilename(value) {
    return String(value || 'download').replace(/[^\w.-]+/g, '-').replace(/^-+|-+$/g, '') || 'download';
}

export {
    DEFAULT_CASE,
    DEFAULT_LAYER,
    DOWN_MOVE_OPTIONS,
    EQUATOR_OPTIONS,
    MOVE_OPTIONS,
    NUMBER_OPTIONS,
    PARITY_OPTIONS,
    childPath,
    clone,
    collectCases,
    collectFolders,
    createCaseFromTemplate,
    createTemplateDraft,
    deepMergeTree,
    escapeHtml,
    findFirstCase,
    getNode,
    getParent,
    getPathName,
    getTargetFolder,
    getUniqueName,
    isPathWithin,
    isCase,
    isFolder,
    isObject,
    joinPath,
    normalizePath,
    normalizeRoots,
    normalizeTree,
    replacePathPrefix,
    sanitizeFilename,
    splitPath
};

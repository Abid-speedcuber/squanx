import { clone } from './model.js';

const STORAGE_KEYS = Object.freeze({
    algorithmInputMode: 'algorithmInputMode',
    algorithmNotationType: 'algorithmNotationType',
    lastSelectedPath: 'jsonCreator_lastSelectedPath',
    lastSelectedRoot: 'jsonCreator_lastSelectedRoot',
    templatePrefix: 'caseTemplate_'
});

function readString(key, fallback = '') {
    try {
        return localStorage.getItem(key) ?? fallback;
    } catch {
        return fallback;
    }
}

function writeString(key, value) {
    try {
        localStorage.setItem(key, String(value));
    } catch {
        // Storage can be unavailable in private or embedded contexts.
    }
}

function removeKey(key) {
    try {
        localStorage.removeItem(key);
    } catch {
        // Ignore storage failures for transient UI preferences.
    }
}

function readJSON(key, fallback = null) {
    const raw = readString(key, '');
    if (!raw) return fallback;
    try {
        return JSON.parse(raw);
    } catch {
        return fallback;
    }
}

function writeJSON(key, value) {
    writeString(key, JSON.stringify(value));
}

function loadSelection() {
    return {
        root: readString(STORAGE_KEYS.lastSelectedRoot, ''),
        path: readString(STORAGE_KEYS.lastSelectedPath, '')
    };
}

function saveSelection(root, path) {
    writeString(STORAGE_KEYS.lastSelectedRoot, root || '');
    writeString(STORAGE_KEYS.lastSelectedPath, path || '');
}

function loadTemplate(rootName) {
    return readJSON(`${STORAGE_KEYS.templatePrefix}${rootName}`, null);
}

function saveTemplate(rootName, template) {
    writeJSON(`${STORAGE_KEYS.templatePrefix}${rootName}`, clone(template));
}

function clearTemplate(rootName) {
    removeKey(`${STORAGE_KEYS.templatePrefix}${rootName}`);
}

function loadAlgorithmPreferences() {
    return {
        algorithmInputMode: readString(STORAGE_KEYS.algorithmInputMode, 'false') === 'true',
        algorithmNotationType: readString(STORAGE_KEYS.algorithmNotationType, 'normal') || 'normal'
    };
}

function saveAlgorithmInputMode(enabled) {
    writeString(STORAGE_KEYS.algorithmInputMode, enabled ? 'true' : 'false');
}

function saveAlgorithmNotationType(type) {
    writeString(STORAGE_KEYS.algorithmNotationType, type || 'normal');
}

export {
    STORAGE_KEYS,
    clearTemplate,
    loadAlgorithmPreferences,
    loadSelection,
    loadTemplate,
    readJSON,
    saveAlgorithmInputMode,
    saveAlgorithmNotationType,
    saveSelection,
    saveTemplate,
    writeJSON
};

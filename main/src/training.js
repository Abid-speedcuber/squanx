import { ensureFeatureModules, openDevtoolFullscreen } from './moduleLoader.js';
import { expandCompactAlgset } from './algsetCodec.js';
import {
    loadLargeValues,
    readLocalJSON,
    readLocalString,
    saveLargeValue,
    saveLargeValues,
    writeLocalJSON,
    writeLocalString
} from './persistence.js';

const COMMAND_REFERENCE_URL = 'https://github.com/Abid-speedcuber/squanx/blob/ESmodule-build/docs/algset-script-command.md';

// Application State
const AppState = {
    selectedCases: [],
    selectedCasesByAlgset: {},
    caseTreeExpandedByAlgset: {},
    currentScramble: null,
    previousScramble: null,
    scrambleHistory: [],
    timerState: 'idle', // idle, preparing, running
    timerStart: 0,
    timerElapsed: 0,
    holdStart: 0,
    removeLastConsumedKey: '',
    trainingJSONs: {}, // Multiple training JSONs: { name: data }
    activeTrainingJSON: null, // Currently selected training JSON
    developingJSONs: {}, // Multiple developing JSONs for JSON creator
    activeDevelopingJSON: 'default', // Currently selected root in JSON creator
    sessionTimes: {}, // { algsetName: [{caseName: string, time: number}] }
    settings: {
        visualizationSize: 200,
        theme: 'dark', // 'light' or 'dark'
        startingCueDuration: 0.2 // Duration in seconds (0.0 to 0.5)
    }
};

const defaultTrainingJSONCache = {};

// Utility Functions (shared with devtool.js)
function showFloatingMessage(message, type = 'info', duration = 3000) {
    const existing = document.querySelector('.floating-message');
    if (existing) existing.remove();
    
    const msg = document.createElement('div');
    msg.className = `floating-message ${type}`;
    msg.textContent = message;
    document.body.appendChild(msg);
    
    setTimeout(() => {
        msg.style.animation = 'slideDown 0.3s ease-out reverse';
        setTimeout(() => msg.remove(), 300);
    }, duration);
}

function showConfirmationModal(title, message, onConfirm, onCancel = null) {
    const modal = document.createElement('div');
    modal.className = 'modal active confirmation-modal';
    modal.style.zIndex = '100001';
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h2>${title}</h2>
            </div>
            <div class="modal-body">
                <p>${message}</p>
                <div class="button-group">
                    <button class="btn btn-secondary" id="confirmCancelBtn">Cancel</button>
                    <button class="btn btn-primary" id="confirmOkBtn">OK</button>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    
    document.getElementById('confirmOkBtn').onclick = () => {
        modal.remove();
        if (onConfirm) onConfirm();
    };
    
    document.getElementById('confirmCancelBtn').onclick = () => {
        modal.remove();
        if (onCancel) onCancel();
    };
    
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.remove();
            if (onCancel) onCancel();
        }
    });
}

function formatScrambleDisplay(scramble) {
    const text = String(scramble || '').trim();
    if (!text || /^(solver|error)/i.test(text)) return text;
    const tokens = text.match(/\/|\(?\s*-?\d+\s*,\s*-?\d+\s*\)?/g);
    if (!tokens) return text;
    return tokens
        .map((token) => token === '/' ? '/' : token.replace(/[()]/g, '').replace(/\s+/g, '').replace(',', ','))
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function formatTrainingPathLabel(path, fallback = '') {
    return String(path || '')
        .split('.')
        .filter(Boolean)
        .join(' > ') || fallback || 'Unknown case';
}

function isRecoverableSolverRandomizationError(error) {
    const message = String(error?.message || error || '').toLowerCase();
    return message.includes("reading 'shift'")
        || message.includes('property "shift"')
        || message.includes("property 'shift'")
        || message.includes('.shift');
}

function cleanSolverErrorMessage(error) {
    return String(error?.message || error || 'Unknown solver error').replace(/^(solver error:\s*)+/i, '');
}

// Default algset structure
const DEFAULT_ALGSET = {
    "New Folder": {
        "New Case": {
            "caseName": "New Case",
            "inputTop": "RRRRRRRRRRRR",
            "inputBottom": "RRRRRRRRRRRR",
            "equator": ["/", "|"],
            "parity": ["on"],
            "constraints": {},
            "auf": ["U0"],
            "adf": ["D0"],
            "rul": [0],
            "rdl": [0],
            "alg": ""
        }
    }
};

const DEFAULT_TRAINING_ALGSETS = [
    { file: 'pll-plus-1.json', name: 'Lin- PLL+1', label: 'PLL+1', category: 'Lin', author: 'Amalogu' },
    { file: 'SB.json', name: 'Lin- SB', label: 'SB', category: 'Lin', author: 'Amalogu', info: { text: 'extra information to be added' } },
    { file: 'linm2pll.json', name: 'Lin-M2+PLL', label: 'M2+PLL', category: 'Lin', author: 'Woofle' },
    { file: 'EOCP.json', name: 'EOCP', label: 'EOCP', author: 'Abid' }
];

const DEFAULT_ALGSET_BASE_PATH = './default-algset/';
const DEVELOPING_ROOT_NAMES_KEY = 'sq1DevelopingRootNames';

function getDevelopingRootKey(name) {
    return `sq1DevelopingRoot:${name}`;
}

function isDefaultTrainingAlgset(name) {
    return DEFAULT_TRAINING_ALGSETS.some((item) => item.name === name);
}

function getImportedTrainingAlgsetNames() {
    return Object.keys(AppState.trainingJSONs).filter((name) => !isDefaultTrainingAlgset(name));
}

function getDefaultTrainingAlgset(name) {
    return DEFAULT_TRAINING_ALGSETS.find((item) => item.name === name) || null;
}

function getTrainingJSONData(name) {
    return AppState.trainingJSONs[name] || defaultTrainingJSONCache[name] || null;
}

function getFirstAvailableTrainingAlgsetName() {
    return getImportedTrainingAlgsetNames()[0] || null;
}

function getAlgsetDisplayLabel(name) {
    return getDefaultTrainingAlgset(name)?.label || name || 'Select Algset';
}

function getUniqueImportedTrainingAlgsetName(baseName) {
    const fallback = String(baseName || 'My algset').trim() || 'My algset';
    if (!AppState.trainingJSONs[fallback] && !isDefaultTrainingAlgset(fallback)) return fallback;
    let counter = 1;
    let name = `${fallback} ${counter}`;
    while (AppState.trainingJSONs[name] || isDefaultTrainingAlgset(name)) {
        counter += 1;
        name = `${fallback} ${counter}`;
    }
    return name;
}

function removeDefaultAlgsetsFromImportedStorage() {
    for (const name of Object.keys(AppState.trainingJSONs)) {
        if (isDefaultTrainingAlgset(name)) delete AppState.trainingJSONs[name];
    }
}

function hasAlgsetInfo(name) {
    const info = getDefaultTrainingAlgset(name)?.info;
    return Boolean(info && (info.text || (Array.isArray(info.links) && info.links.length)));
}

function getDefaultAlgsetGroups() {
    const groups = [];
    const groupMap = new Map();
    for (const algset of DEFAULT_TRAINING_ALGSETS) {
        const groupName = algset.category || 'Default';
        if (!groupMap.has(groupName)) {
            const group = { name: groupName, items: [] };
            groupMap.set(groupName, group);
            groups.push(group);
        }
        groupMap.get(groupName).items.push(algset);
    }
    return groups;
}

function escapeHtml(value) {
    return String(value ?? '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;');
}

function cloneJSON(value) {
    return JSON.parse(JSON.stringify(value));
}

async function fetchDefaultAlgsetData(name) {
    const algset = getDefaultTrainingAlgset(name);
    if (!algset) return null;
    const response = await fetch(`${DEFAULT_ALGSET_BASE_PATH}${algset.file}`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
}

async function ensureDefaultTrainingAlgset(name) {
    if (defaultTrainingJSONCache[name]) return defaultTrainingJSONCache[name];
    const data = await fetchDefaultAlgsetData(name);
    if (!data) return null;
    defaultTrainingJSONCache[name] = expandCompactAlgset(data);
    return defaultTrainingJSONCache[name];
}

// Load training JSONs from IndexedDB, with one-time localStorage migration.
function loadTrainingJSONs(persisted = {}) {
    const saved = persisted.sq1TrainingJSONs;
    if (saved && typeof saved === 'object') {
        AppState.trainingJSONs = saved;
        for (const [name, data] of Object.entries(AppState.trainingJSONs)) {
            AppState.trainingJSONs[name] = expandCompactAlgset(data);
        }
        removeDefaultAlgsetsFromImportedStorage();
    }

    const activeJSON = readLocalString('sq1ActiveTrainingJSON', '');
    if (activeJSON && (AppState.trainingJSONs[activeJSON] || isDefaultTrainingAlgset(activeJSON))) {
        AppState.activeTrainingJSON = activeJSON;
    } else if (Object.keys(AppState.trainingJSONs).length > 0) {
        AppState.activeTrainingJSON = Object.keys(AppState.trainingJSONs)[0];
    }
}

// Save training JSONs off the UI thread.
function saveTrainingJSONs() {
    saveLargeValue('sq1TrainingJSONs', AppState.trainingJSONs);
    if (AppState.activeTrainingJSON) {
        writeLocalString('sq1ActiveTrainingJSON', AppState.activeTrainingJSON);
    } else {
        writeLocalString('sq1ActiveTrainingJSON', '');
    }
}

function getTrainingCaseByPath(tree, path) {
    let current = tree;
    for (const part of String(path || '').split('.')) current = current?.[part];
    return current?.caseName !== undefined ? current : null;
}

function buildSelectedCasesForAlgset(name, paths = null) {
    const tree = getTrainingJSONData(name);
    if (!tree) return [];
    const casePaths = paths || getCasePaths(tree);
    return casePaths
        .map((path) => {
            const item = getTrainingCaseByPath(tree, path);
            return item ? { ...item, _path: path, _jsonName: name } : null;
        })
        .filter(Boolean);
}

function activateTrainingJSON(name, options = {}) {
    const { selectAllWhenMissing = true } = options;
    const tree = getTrainingJSONData(name);
    if (!name || !tree) return false;
    AppState.activeTrainingJSON = name;
    const savedSelection = AppState.selectedCasesByAlgset[name];
    if (Array.isArray(savedSelection)) {
        AppState.selectedCases = savedSelection.filter((item) => getTrainingCaseByPath(tree, item._path));
    } else {
        AppState.selectedCases = selectAllWhenMissing ? buildSelectedCasesForAlgset(name) : [];
    }
    saveTrainingJSONs();
    saveSelectedCases();
    return true;
}

function importTrainingJSONData(name, data, options = {}) {
    const { activate = true, selectAll = true } = options;
    const storageName = isDefaultTrainingAlgset(name) ? getUniqueImportedTrainingAlgsetName(`${name} copy`) : name;
    AppState.trainingJSONs[storageName] = expandCompactAlgset(data);
    AppState.selectedCasesByAlgset[storageName] = selectAll ? buildSelectedCasesForAlgset(storageName) : [];
    if (activate || !AppState.activeTrainingJSON) activateTrainingJSON(storageName, { selectAllWhenMissing: selectAll });
    saveTrainingJSONs();
    saveSelectedCases();
    return storageName;
}

// Load developing roots from per-root IndexedDB records, with legacy fallback.
async function loadDevelopingJSONs(persisted = {}) {
    const rootNames = Array.isArray(persisted[DEVELOPING_ROOT_NAMES_KEY]) ? persisted[DEVELOPING_ROOT_NAMES_KEY] : null;
    if (rootNames?.length) {
        const rootValues = await loadLargeValues(rootNames.map(getDevelopingRootKey));
        AppState.developingJSONs = {};
        for (const rootName of rootNames) {
            const rootValue = rootValues[getDevelopingRootKey(rootName)];
            if (rootValue && typeof rootValue === 'object') AppState.developingJSONs[rootName] = rootValue;
        }
    } else if (persisted.sq1DevelopingJSONs && typeof persisted.sq1DevelopingJSONs === 'object') {
        AppState.developingJSONs = persisted.sq1DevelopingJSONs;
        saveDevelopingJSONs();
    }

    if (!Object.keys(AppState.developingJSONs).length) {
        AppState.developingJSONs = { 'default': DEFAULT_ALGSET };
        saveDevelopingJSONs();
    }

    const activeRoot = readLocalString('sq1ActiveDevelopingJSON', '');
    if (activeRoot && AppState.developingJSONs[activeRoot]) {
        AppState.activeDevelopingJSON = activeRoot;
    }
}

// Save all developing roots. Prefer saveDevelopingRoot for high-frequency edits.
function saveDevelopingJSONs() {
    const rootNames = Object.keys(AppState.developingJSONs);
    const values = Object.fromEntries(rootNames.map((name) => [getDevelopingRootKey(name), AppState.developingJSONs[name]]));
    values[DEVELOPING_ROOT_NAMES_KEY] = rootNames;
    saveLargeValues(values);
    writeLocalString('sq1ActiveDevelopingJSON', AppState.activeDevelopingJSON);
}

function saveDevelopingRoot(rootName = AppState.activeDevelopingJSON, tree = AppState.developingJSONs[rootName]) {
    if (!rootName || !tree) return;
    AppState.developingJSONs[rootName] = tree;
    saveLargeValues({
        [getDevelopingRootKey(rootName)]: tree,
        [DEVELOPING_ROOT_NAMES_KEY]: Object.keys(AppState.developingJSONs)
    });
    writeLocalString('sq1ActiveDevelopingJSON', AppState.activeDevelopingJSON);
}

// Load selected cases from IndexedDB.
function loadSelectedCases(persisted = {}) {
    if (persisted.sq1SelectedCasesByAlgset && typeof persisted.sq1SelectedCasesByAlgset === 'object') {
        AppState.selectedCasesByAlgset = persisted.sq1SelectedCasesByAlgset || {};
    }

    if (Array.isArray(persisted.sq1SelectedCases) && Object.keys(AppState.selectedCasesByAlgset).length === 0 && AppState.activeTrainingJSON) {
        AppState.selectedCasesByAlgset[AppState.activeTrainingJSON] = persisted.sq1SelectedCases;
    }

    if (AppState.activeTrainingJSON) activateTrainingJSON(AppState.activeTrainingJSON, { selectAllWhenMissing: true });
}

// Load last screen state
function loadLastScreen() {
    const lastScreen = readLocalString('sq1LastScreen', '');
    return lastScreen || 'training';
}

// Save last screen state
function saveLastScreen(screen) {
    writeLocalString('sq1LastScreen', screen);
}

// Save selected cases off the UI thread.
let selectedCasesSaveTimer = null;

function syncSelectedCasesForActiveAlgset() {
    if (AppState.activeTrainingJSON) {
        AppState.selectedCasesByAlgset[AppState.activeTrainingJSON] = AppState.selectedCases;
    }
}

function saveSelectedCases() {
    syncSelectedCasesForActiveAlgset();
    saveLargeValues({
        sq1SelectedCasesByAlgset: AppState.selectedCasesByAlgset,
        sq1SelectedCases: AppState.selectedCases
    });
}

function scheduleSelectedCasesSave() {
    syncSelectedCasesForActiveAlgset();
    clearTimeout(selectedCasesSaveTimer);
    selectedCasesSaveTimer = setTimeout(() => {
        selectedCasesSaveTimer = null;
        saveSelectedCases();
    }, 250);
}

function loadCaseTreeExpandedState(persisted = {}) {
    if (persisted.sq1CaseTreeExpandedByAlgset && typeof persisted.sq1CaseTreeExpandedByAlgset === 'object') {
        AppState.caseTreeExpandedByAlgset = persisted.sq1CaseTreeExpandedByAlgset || {};
    }
}

function saveCaseTreeExpandedState() {
    saveLargeValue('sq1CaseTreeExpandedByAlgset', AppState.caseTreeExpandedByAlgset);
}

// Load session times from IndexedDB.
function loadSessionTimes(persisted = {}) {
    if (persisted.sq1SessionTimes && typeof persisted.sq1SessionTimes === 'object') {
        AppState.sessionTimes = persisted.sq1SessionTimes;
    }
}

// Save session times off the UI thread.
function saveSessionTimes() {
    saveLargeValue('sq1SessionTimes', AppState.sessionTimes);
}

// Load settings from localStorage
function loadSettings() {
    const settings = readLocalJSON('sq1Settings', null);
    if (settings) AppState.settings = { ...AppState.settings, ...settings };
}

// Save settings to localStorage
function saveSettings() {
    writeLocalJSON('sq1Settings', AppState.settings);
}

// Apply theme to body
function applyTheme() {
    document.body.className = `theme-${AppState.settings.theme}`;
}

// Initialize app
async function initApp() {
    loadSettings();
    const persisted = await loadLargeValues();
    loadTrainingJSONs(persisted);
    await loadDevelopingJSONs(persisted);
    loadCaseTreeExpandedState(persisted);
    if (isDefaultTrainingAlgset(AppState.activeTrainingJSON)) {
        await ensureDefaultTrainingAlgset(AppState.activeTrainingJSON);
    }
    loadSelectedCases(persisted);
    loadSessionTimes(persisted);
    applyTheme();
    
    const lastScreen = loadLastScreen();
    if (lastScreen === 'jsonCreator') {
        await openDevtoolFullscreen();
        return 'devtool';
    } else {
        saveLastScreen('training');
        renderApp();
        return 'trainer';
    }
}

// Get initial timer display value
function getInitialTimerDisplay() {
    if (AppState.selectedCases.length === 0) return '--:--';

    if (AppState.activeTrainingJSON && AppState.sessionTimes[AppState.activeTrainingJSON]) {
        const times = AppState.sessionTimes[AppState.activeTrainingJSON];
        if (times.length > 0) {
            const lastTime = times[times.length - 1].time;
            return lastTime.toFixed(2);
        }
    }
    return '0.00';
}

function getScrambleCaseKey(scramble) {
    if (!scramble) return '';
    const jsonName = scramble._jsonName || AppState.activeTrainingJSON || '';
    const path = scramble._path || '';
    if (path) return `${jsonName}:${path}`;
    return `${jsonName}:name:${scramble.caseName || ''}`;
}

function getSelectedCaseKey(item) {
    if (!item) return '';
    const jsonName = item._jsonName || AppState.activeTrainingJSON || '';
    const path = item._path || '';
    if (path) return `${jsonName}:${path}`;
    return `${jsonName}:name:${item.caseName || ''}`;
}

function canRemoveLastSolve() {
    const key = getScrambleCaseKey(AppState.previousScramble);
    return Boolean(key)
        && AppState.removeLastConsumedKey !== key
        && AppState.selectedCases.some((item) => getSelectedCaseKey(item) === key);
}

function trainerIconSprite() {
    return `
        <svg aria-hidden="true" style="display:none">
            <symbol id="rail-icon-cases" viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></symbol>
            <symbol id="rail-icon-help" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.8.4-1 .9-1 1.7"/><line x1="12" y1="17" x2="12" y2="17"/></symbol>
            <symbol id="rail-icon-settings" viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09A1.65 1.65 0 0 0 19.4 15z"/></symbol>
            <symbol id="rail-icon-import" viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></symbol>
            <symbol id="rail-icon-export" viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></symbol>
            <symbol id="rail-icon-devtool" viewBox="0 0 24 24"><path d="m16 18 6-6-6-6"/><path d="m8 6-6 6 6 6"/><path d="m14.5 4-5 16"/></symbol>
            <symbol id="rail-icon-info" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><line x1="12" y1="11" x2="12" y2="17"/><line x1="12" y1="7" x2="12" y2="7"/></symbol>
            <symbol id="icon-lightbulb" viewBox="0 0 24 24"><path d="M9 18h6"/><path d="M10 22h4"/><path d="M8.5 14.5c-1.6-1.1-2.5-2.9-2.5-4.8A6 6 0 0 1 18 9.7c0 1.9-.9 3.7-2.5 4.8-.6.4-.9 1-.9 1.7V17H9.4v-.8c0-.7-.3-1.3-.9-1.7z"/></symbol>
        </svg>
    `;
}

function railButton(action, icon, label) {
    return `
        <button class="rail-btn" data-action="${action}" data-tip="${label}" aria-label="${label}">
            <span class="rail-btn-icon">
                <svg width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><use href="#${icon}"/></svg>
            </span>
            <span class="rail-btn-label">${label}</span>
        </button>
    `;
}

// Render main app structure
function renderApp() {
    const app = document.getElementById('app');
    const hasActiveAlgset = Boolean(AppState.activeTrainingJSON);
    const hasSelectedCases = AppState.selectedCases.length > 0;
    const scramblePrompt = !hasActiveAlgset
        ? 'Select algset to train'
        : !hasSelectedCases
            ? 'Select cases to train'
            : 'Scramble will show up here';
    const currentScramble = escapeHtml(AppState.currentScramble?.scramble || scramblePrompt);
    const previousScramble = AppState.previousScramble
        ? escapeHtml(`${AppState.previousScramble.scramble} (${AppState.previousScramble.pathLabel || AppState.previousScramble.caseName || 'Unknown case'})`)
        : 'Last scramble will show up here';
    const activeAlgset = escapeHtml(getAlgsetDisplayLabel(AppState.activeTrainingJSON));
    const removeLastDisabled = canRemoveLastSolve() ? '' : 'disabled';
    const algsetInfoButton = hasAlgsetInfo(AppState.activeTrainingJSON)
        ? railButton('algset-info', 'rail-icon-info', 'Algset info')
        : '';
    const scrambleAction = !hasActiveAlgset ? 'select-algset' : !hasSelectedCases ? 'select-cases' : '';
    const scrambleActionClass = scrambleAction ? ' scramble-action' : '';

    app.innerHTML = `
        ${trainerIconSprite()}
        <div class="trainer-shell">
            <div class="navbar">
                <div class="nav-left">
                    <span class="squango" id="squango-home"><span class="squango-sq">Squan</span><span class="squango-go">Go</span></span>
                </div>
                <button class="nav-center algset-select-btn" id="selectAlgsetBtn" aria-haspopup="dialog">
                    <span>${activeAlgset}</span>
                    <span class="algset-select-arrow" aria-hidden="true">▾</span>
                </button>
                <div class="nav-spacer">
                    <span class="case-count" id="caseCount">${AppState.selectedCases.length} selected</span>
                </div>
            </div>

            <div class="trainer-main">
                <nav class="rail collapsed hidden-mobile" id="rail">
                    <button class="rail-toggle" id="rail-toggle" data-tip="Expand" aria-label="Toggle sidebar">
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="16" rx="2"/><line x1="9" y1="4" x2="9" y2="20"/></svg>
                    </button>
                    <div class="rail-actions">
                        ${railButton('cases', 'rail-icon-cases', 'Case selector')}
                        ${railButton('help', 'rail-icon-help', 'Help')}
                        ${railButton('settings', 'rail-icon-settings', 'Settings')}
                        ${algsetInfoButton}
                        ${railButton('devtool', 'rail-icon-devtool', 'Devtool')}
                    </div>
                    <div class="rail-extra">
                        ${railButton('import-data', 'rail-icon-import', "Import all app's data")}
                        ${railButton('export-data', 'rail-icon-export', "Export all app's data")}
                    </div>
                </nav>

                <div class="content">
                    <div class="top-bar">
                        <div class="scramble-row">
                            <div class="bar-scramble${scrambleActionClass}" id="scrambleDisplay" data-scramble-action="${scrambleAction}">${currentScramble}</div>
                        </div>
                        <div class="scramble-controls">
                            <button class="bar-btn" id="prevScrambleBtn" ${AppState.previousScramble ? '' : 'disabled'}>← Previous</button>
                            <button class="bar-btn" id="unselprev" ${removeLastDisabled}>Remove last</button>
                            <button class="bar-btn" id="nextScrambleBtn">Next →</button>
                            <button class="hint-btn" id="hintBtn" aria-label="Show hint">
                                <svg width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><use href="#icon-lightbulb"/></svg>
                            </button>
                        </div>
                    </div>

                    <div class="timer-zone timer-box ${AppState.selectedCases.length === 0 ? 'disabled' : ''}" id="timerZone">
                        <div class="timer-display" id="timerDisplay">${getInitialTimerDisplay()}</div>
                    </div>

                    <div class="bottom-bar">
                        <div class="bar-scramble previous-scramble" id="previousScrambleDisplay">${previousScramble}</div>
                    </div>
                </div>
            </div>

            <nav class="mobilebar" id="mobilebar">
                ${railButton('cases', 'rail-icon-cases', 'Case selector')}
                ${railButton('help', 'rail-icon-help', 'Help')}
                ${railButton('settings', 'rail-icon-settings', 'Settings')}
                ${algsetInfoButton}
                ${railButton('devtool', 'rail-icon-devtool', 'Devtool')}
                ${railButton('import-data', 'rail-icon-import', "Import all app's data")}
                ${railButton('export-data', 'rail-icon-export', "Export all app's data")}
            </nav>
        </div>
    `;
    setupEventListeners();
}

// Generate new scramble from selected cases
async function generateNewScramble() {
    if (AppState.selectedCases.length === 0) {
        if (AppState.currentScramble) AppState.scrambleHistory.push(AppState.currentScramble);
        AppState.previousScramble = AppState.scrambleHistory[AppState.scrambleHistory.length - 1] || null;
        AppState.currentScramble = null;
        renderApp();
        return;
    }

    const randomCase = AppState.selectedCases[Math.floor(Math.random() * AppState.selectedCases.length)];
    const pathLabel = formatTrainingPathLabel(randomCase._path, randomCase.caseName);
    
    try {
        const { generateHexState } = (await ensureFeatureModules()).hexState;

        // Config is already in correct format from JSON creator
        const config = {
            topLayer: randomCase.inputTop,
            bottomLayer: randomCase.inputBottom,
            middleLayer: randomCase.equator || ['/'],
            RUL: randomCase.rul || [0],
            RDL: randomCase.rdl || [0],
            AUF: randomCase.auf || ['U0'],
            ADF: randomCase.adf || ['D0'],
            constraints: randomCase.constraints || {},
            parity: randomCase.parity || ['on']
        };

        const result = generateHexState(config);
        
        // Generate scramble using solver with retry logic
        let scramble = '';
        let attempts = 0;
        const maxAttempts = 10;
        
        while (attempts < maxAttempts) {
            try {
                if (typeof window.Square1Solver !== 'undefined' && typeof window.Square1Solver.solve === 'function') {
                    scramble = window.Square1Solver.solve(result.hexState);
                    break;
                } else {
                    console.error('Square1Solver not available:', typeof window.Square1Solver);
                    scramble = 'Solver not loaded - check console';
                    break;
                }
            } catch (solverError) {
                attempts++;
                if (isRecoverableSolverRandomizationError(solverError)) {
                    if (attempts < maxAttempts) {
                        continue;
                    }
                }
                
                console.error('Solver error after retries:', solverError);
                scramble = 'Solver error: ' + cleanSolverErrorMessage(solverError);
                break;
            }
        }
        
        if (AppState.currentScramble) AppState.scrambleHistory.push(AppState.currentScramble);
        AppState.previousScramble = AppState.scrambleHistory[AppState.scrambleHistory.length - 1] || null;
        AppState.removeLastConsumedKey = '';
        AppState.currentScramble = {
            ...result, 
            caseName: randomCase.caseName, 
            pathLabel,
            _path: randomCase._path,
            _jsonName: randomCase._jsonName,
            alg: randomCase.alg || '',
            scramble: formatScrambleDisplay(scramble)
        };
        renderApp();
    } catch (error) {
        console.error('Error generating scramble:', error);
        if (AppState.currentScramble) AppState.scrambleHistory.push(AppState.currentScramble);
        AppState.previousScramble = AppState.scrambleHistory[AppState.scrambleHistory.length - 1] || null;
        AppState.removeLastConsumedKey = '';
        AppState.currentScramble = {
            hexState: 'Error generating scramble', 
            scramble: 'Error: ' + error.message,
            caseName: randomCase.caseName,
            pathLabel,
            _path: randomCase._path,
            _jsonName: randomCase._jsonName
        };
        renderApp();
    }
}

// Setup event listeners
let globalTimerListenersAttached = false;

function setupEventListeners() {
    document.getElementById('squango-home')?.addEventListener('click', () => {
        window.location.href = 'https://squan-go.web.app/';
    });

    document.getElementById('selectAlgsetBtn')?.addEventListener('click', openAlgsetSelectorModal);
    document.getElementById('scrambleDisplay')?.addEventListener('click', () => {
        const action = document.getElementById('scrambleDisplay')?.dataset.scrambleAction;
        if (action === 'select-algset') openAlgsetSelectorModal();
        if (action === 'select-cases') openCaseSelectionModal();
    });
    document.getElementById('prevScrambleBtn')?.addEventListener('click', () => {
        if (AppState.scrambleHistory.length > 0) {
            AppState.currentScramble = AppState.scrambleHistory.pop();
            AppState.previousScramble = AppState.scrambleHistory[AppState.scrambleHistory.length - 1] || null;
            renderApp();
            return;
        }
    });
    document.getElementById('nextScrambleBtn')?.addEventListener('click', () => {
        void generateNewScramble();
    });
    document.getElementById('unselprev')?.addEventListener('click', removeLastSolve);
    document.getElementById('hintBtn')?.addEventListener('click', openHintModal);
    document.getElementById('rail-toggle')?.addEventListener('click', () => {
        document.getElementById('rail')?.classList.toggle('collapsed');
    });

    document.querySelectorAll('[data-action]').forEach(button => {
        button.addEventListener('click', () => handleRailAction(button.dataset.action));
    });

    const timerZone = document.getElementById('timerZone');
    timerZone?.addEventListener('mousedown', handleTimerMouseDown);
    timerZone?.addEventListener('mouseup', handleTimerMouseUp);
    timerZone?.addEventListener('touchstart', handleTimerTouchStart);
    timerZone?.addEventListener('touchend', handleTimerTouchEnd);

    if (!globalTimerListenersAttached) {
        document.addEventListener('keydown', handleKeyDown);
        document.addEventListener('keyup', handleKeyUp);
        globalTimerListenersAttached = true;
    }
}

function handleRailAction(action) {
    switch (action) {
        case 'cases':
            if (AppState.activeTrainingJSON) {
                openCaseSelectionModal();
            } else {
                openAlgsetSelectorModal();
            }
            break;
        case 'help':
            openHelpModal();
            break;
        case 'settings':
            openSettingsModal();
            break;
        case 'algset-info':
            openAlgsetInfoModal();
            break;
        case 'import-data':
            openImportAllDataModal();
            break;
        case 'export-data':
            exportAllAppData();
            break;
        case 'devtool':
            void window.showJsonCreatorFullscreen();
            break;
    }
}

function downloadJSONFile(filename, data) {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
}

function exportAllAppData() {
    downloadJSONFile('squanx-app-data.json', {
        version: 1,
        exportedAt: new Date().toISOString(),
        trainingJSONs: AppState.trainingJSONs,
        activeTrainingJSON: AppState.activeTrainingJSON,
        selectedCasesByAlgset: AppState.selectedCasesByAlgset,
        selectedCases: AppState.selectedCases,
        caseTreeExpandedByAlgset: AppState.caseTreeExpandedByAlgset,
        developingJSONs: AppState.developingJSONs,
        activeDevelopingJSON: AppState.activeDevelopingJSON,
        sessionTimes: AppState.sessionTimes,
        settings: AppState.settings
    });
}

function openImportAllDataModal() {
    const modal = document.createElement('div');
    modal.className = 'modal active';
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h2>Import App Data</h2>
                <button class="close-btn" onclick="this.closest('.modal').remove()">×</button>
            </div>
            <div class="modal-body">
                <div class="settings-group">
                    <label class="settings-label">Paste JSON or Drag & Drop File</label>
                    <textarea class="settings-input import-drop-textarea" id="importAllDataInput" placeholder="Paste exported SquanX app data here..."
                        ondragover="event.preventDefault();"
                        ondrop="handleAllDataFileDrop(event)"></textarea>
                </div>
                <div class="button-group">
                    <button class="btn btn-secondary" onclick="this.closest('.modal').remove()">Cancel</button>
                    <button class="btn btn-primary" onclick="importAllAppData()">Import</button>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    modal.addEventListener('click', (event) => {
        if (event.target === modal) modal.remove();
    });
}

window.handleAllDataFileDrop = function(event) {
    event.preventDefault();
    const file = event.dataTransfer.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (loadEvent) => {
        document.getElementById('importAllDataInput').value = loadEvent.target.result;
    };
    reader.readAsText(file);
};

window.importAllAppData = async function() {
    const jsonText = document.getElementById('importAllDataInput')?.value.trim();
    if (!jsonText) return showFloatingMessage('Please paste or drop an app data export', 'error');
    try {
        const data = JSON.parse(jsonText);
        AppState.trainingJSONs = data.trainingJSONs || {};
        for (const [name, algsetData] of Object.entries(AppState.trainingJSONs)) {
            AppState.trainingJSONs[name] = expandCompactAlgset(algsetData);
        }
        removeDefaultAlgsetsFromImportedStorage();
        AppState.activeTrainingJSON = data.activeTrainingJSON && (AppState.trainingJSONs[data.activeTrainingJSON] || isDefaultTrainingAlgset(data.activeTrainingJSON))
            ? data.activeTrainingJSON
            : getFirstAvailableTrainingAlgsetName();
        AppState.selectedCasesByAlgset = data.selectedCasesByAlgset || {};
        AppState.caseTreeExpandedByAlgset = data.caseTreeExpandedByAlgset || {};
        if (Array.isArray(data.selectedCases) && AppState.activeTrainingJSON && !AppState.selectedCasesByAlgset[AppState.activeTrainingJSON]) {
            AppState.selectedCasesByAlgset[AppState.activeTrainingJSON] = data.selectedCases;
        }
        if (isDefaultTrainingAlgset(AppState.activeTrainingJSON)) await ensureDefaultTrainingAlgset(AppState.activeTrainingJSON);
        if (AppState.activeTrainingJSON) activateTrainingJSON(AppState.activeTrainingJSON, { selectAllWhenMissing: true });
        else AppState.selectedCases = [];
        AppState.developingJSONs = data.developingJSONs || { default: DEFAULT_ALGSET };
        AppState.activeDevelopingJSON = data.activeDevelopingJSON && AppState.developingJSONs[data.activeDevelopingJSON]
            ? data.activeDevelopingJSON
            : Object.keys(AppState.developingJSONs)[0] || 'default';
        AppState.sessionTimes = data.sessionTimes || {};
        AppState.settings = { ...AppState.settings, ...(data.settings || {}) };
        saveTrainingJSONs();
        saveDevelopingJSONs();
        saveSelectedCases();
        saveCaseTreeExpandedState();
        saveSessionTimes();
        saveSettings();
        AppState.currentScramble = null;
        AppState.previousScramble = null;
        AppState.scrambleHistory = [];
        applyTheme();
        document.querySelector('.modal')?.remove();
        renderApp();
        showFloatingMessage('App data imported', 'success');
    } catch (error) {
        showFloatingMessage(`Invalid app data: ${error.message}`, 'error');
    }
};

function removeLastSolve() {
    const targetKey = getScrambleCaseKey(AppState.previousScramble);
    if (!targetKey || AppState.removeLastConsumedKey === targetKey) {
        renderApp();
        return;
    }

    const previousCount = AppState.selectedCases.length;
    const removedCase = AppState.selectedCases.find((item) => getSelectedCaseKey(item) === targetKey);
    AppState.selectedCases = AppState.selectedCases.filter((item) => getSelectedCaseKey(item) !== targetKey);
    AppState.removeLastConsumedKey = targetKey;
    if (AppState.selectedCases.length === previousCount) {
        renderApp();
        return;
    }
    saveSelectedCases();
    if (AppState.selectedCases.length === 0) {
        AppState.timerState = 'idle';
        AppState.currentScramble = null;
    }
    showFloatingMessage(`Deselected ${removedCase?.caseName || AppState.previousScramble?.caseName || 'last case'}`, 'success');
    renderApp();
}

// Timer handlers
let spacePressed = false;
let timerHoldStartTime = 0;
let timerPreparingInterval = null;

function isEditableEventTarget(target) {
    if (!target || target === document || target === window) return false;
    return Boolean(target.closest?.('input, textarea, select, [contenteditable="true"], [contenteditable=""]'))
        || Boolean(target.isContentEditable);
}

function isInteractiveNonTimerTarget(target) {
    if (!target || target === document || target === window) return false;
    if (isEditableEventTarget(target)) return true;
    return Boolean(target.closest?.('button, a, input, textarea, select, [role="button"], [role="menuitem"]'));
}

function isTimerKeyboardContext(event) {
    if (isEditableEventTarget(event.target) || isEditableEventTarget(document.activeElement)) return false;
    if (document.querySelector('.modal.active') || document.getElementById('jsonCreatorFullscreen')) return false;

    const timerZone = document.getElementById('timerZone');
    if (!timerZone || timerZone.classList.contains('disabled')) return false;
    if (isInteractiveNonTimerTarget(event.target) || isInteractiveNonTimerTarget(document.activeElement)) return false;

    return true;
}

function handleTimerMouseDown() {
    if (AppState.selectedCases.length === 0) return;
    if (AppState.timerState === 'running') return;
    if (AppState.timerState === 'idle') {
        AppState.timerState = 'preparing';
        timerHoldStartTime = Date.now();
        updateTimerDisplay();
        
        const requiredDuration = AppState.settings.startingCueDuration * 1000;
        if (requiredDuration > 0) {
            timerPreparingInterval = setInterval(() => {
                if (AppState.timerState !== 'preparing') {
                    clearInterval(timerPreparingInterval);
                    return;
                }
                const holdDuration = Date.now() - timerHoldStartTime;
                if (holdDuration >= requiredDuration) {
                    updateTimerDisplay();
                    clearInterval(timerPreparingInterval);
                }
            }, 50);
        }
    }
}

function handleTimerMouseUp() {
    const display = document.getElementById('timerDisplay');
    if (!display) return;
    
    if (AppState.timerState === 'running') {
        stopTimer();
    } else if (AppState.timerState === 'preparing') {
        const holdDuration = Date.now() - timerHoldStartTime;
        const requiredDuration = AppState.settings.startingCueDuration * 1000;
        clearInterval(timerPreparingInterval);
        AppState.timerState = 'idle';
        display.className = 'timer-display';
        
        if (holdDuration >= requiredDuration) {
            startTimer();
        } else {
            updateTimerDisplay();
        }
    }
}

function handleTimerTouchStart(e) {
    e.preventDefault();
    handleTimerMouseDown(e);
}

function handleTimerTouchEnd(e) {
    e.preventDefault();
    handleTimerMouseUp();
}

function handleKeyDown(e) {
    if (!isTimerKeyboardContext(e)) return;
    if (e.code === 'Space' && !e.repeat) {
        e.preventDefault();
        if (AppState.selectedCases.length === 0) return;
        if (!spacePressed) {
            spacePressed = true;
            if (AppState.timerState === 'idle') {
                AppState.timerState = 'preparing';
                timerHoldStartTime = Date.now();
                updateTimerDisplay();
                
                const requiredDuration = AppState.settings.startingCueDuration * 1000;
                if (requiredDuration > 0) {
                    timerPreparingInterval = setInterval(() => {
                        if (AppState.timerState !== 'preparing') {
                            clearInterval(timerPreparingInterval);
                            return;
                        }
                        const holdDuration = Date.now() - timerHoldStartTime;
                        if (holdDuration >= requiredDuration) {
                            updateTimerDisplay();
                            clearInterval(timerPreparingInterval);
                        }
                    }, 50);
                }
            }
        }
    } else if (e.code === 'Escape') {
        if (AppState.timerState === 'running') {
            e.preventDefault();
            AppState.timerState = 'idle';
            updateTimerDisplay();
        }
    }
}

function handleKeyUp(e) {
    if (isEditableEventTarget(e.target) || isEditableEventTarget(document.activeElement)) return;
    if (!isTimerKeyboardContext(e) && !spacePressed) return;
    if (e.code === 'Space') {
        e.preventDefault();
        if (spacePressed) {
            spacePressed = false;
            const display = document.getElementById('timerDisplay');
            
            if (AppState.timerState === 'running') {
                stopTimer();
            } else if (AppState.timerState === 'preparing') {
                const holdDuration = Date.now() - timerHoldStartTime;
                const requiredDuration = AppState.settings.startingCueDuration * 1000;
                clearInterval(timerPreparingInterval);
                AppState.timerState = 'idle';
                display.className = 'timer-display';
                
                if (holdDuration >= requiredDuration) {
                    startTimer();
                } else {
                    updateTimerDisplay();
                }
            }
        }
    }
}

function startTimer() {
    AppState.timerState = 'running';
    AppState.timerStart = Date.now();
    AppState.timerElapsed = 0;
    const display = document.getElementById('timerDisplay');
    if (display) {
        display.className = 'timer-display';
    }
    requestAnimationFrame(updateTimer);
}

function stopTimer() {
    AppState.timerState = 'idle';
    AppState.timerElapsed = Date.now() - AppState.timerStart;
    clearInterval(AppState.timerInterval);
    const display = document.getElementById('timerDisplay');
    if (display) {
        display.className = 'timer-display';
        const seconds = (AppState.timerElapsed / 1000).toFixed(2);
        display.textContent = seconds;
    }

    // Save time to session
    if (AppState.activeTrainingJSON && AppState.currentScramble) {
        if (!AppState.sessionTimes[AppState.activeTrainingJSON]) {
            AppState.sessionTimes[AppState.activeTrainingJSON] = [];
        }
        const timeInSeconds = AppState.timerElapsed / 1000;
        AppState.sessionTimes[AppState.activeTrainingJSON].push({
            caseName: AppState.currentScramble.caseName,
            time: timeInSeconds
        });
        saveSessionTimes();
    }
    void generateNewScramble();
}

function updateTimer() {
    if (AppState.timerState === 'running') {
        AppState.timerElapsed = Date.now() - AppState.timerStart;
        const display = document.getElementById('timerDisplay');
        if (display) {
            const seconds = (AppState.timerElapsed / 1000).toFixed(2);
            display.textContent = seconds;
        }
        requestAnimationFrame(updateTimer);
    }
}

function updateTimerDisplay() {
    const display = document.getElementById('timerDisplay');
    if (!display) return;

    if (AppState.timerState === 'preparing') {
        const holdDuration = Date.now() - timerHoldStartTime;
        const requiredDuration = AppState.settings.startingCueDuration * 1000;
        
        display.className = 'timer-display';
        display.textContent = '0.00';
        if (holdDuration >= requiredDuration) {
            display.classList.add('ready');
        } else {
            display.classList.add('preparing');
        }
    } else if (AppState.timerState === 'running') {
        display.className = 'timer-display';
        const seconds = (AppState.timerElapsed / 1000).toFixed(2);
        display.textContent = seconds;
    } else if (AppState.timerState === 'idle') {

        display.className = 'timer-display';
        if (AppState.selectedCases.length === 0) {
            display.textContent = '--:--';
            return;
        }
        // Show last time from session
        if (AppState.activeTrainingJSON && AppState.sessionTimes[AppState.activeTrainingJSON]) {
            const times = AppState.sessionTimes[AppState.activeTrainingJSON];
            if (times.length > 0) {
                const lastTime = times[times.length - 1].time;
                display.textContent = lastTime.toFixed(2);
            } else {
                display.textContent = '0.00';
            }
        } else {
            display.textContent = '0.00';
        }
    }
}

// Case selection modal
// Case selection modal
// Algset selector modal
function openAlgsetSelectorModal() {
    const modal = document.createElement('div');
    modal.className = 'modal active';

    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h2>Select Algset</h2>
                <button class="close-btn" onclick="this.closest('.modal').remove()">×</button>
            </div>
            <div class="modal-body">
                <div id="algsetContent"></div>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    renderAlgsetSelectorContent();

    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.remove();
        }
    });
}

window.switchAlgsetTab = function(tab) {
    const allTabs = document.querySelectorAll('.algset-tab');
    allTabs.forEach(t => {
        if (t.id === `tab-${tab}`) {
            t.classList.add('active');
        } else {
            t.classList.remove('active');
        }
    });
    renderAlgsetSelectorContent();
};

function renderAlgsetSelectorContent() {
    const content = document.getElementById('algsetContent');
    if (!content) return;

    const importedAlgsets = getImportedTrainingAlgsetNames();
    const defaultGroups = getDefaultAlgsetGroups();

    const importedMarkup = importedAlgsets.length ? `
        <section class="algset-section">
            <h3>My algsets</h3>
            <div class="algset-list">
                ${importedAlgsets.map(name => `
                    <div class="algset-item ${name === AppState.activeTrainingJSON ? 'active' : ''}" onclick='selectImportedAlgset(${JSON.stringify(name)})' oncontextmenu='openAlgsetContextMenu(event, ${JSON.stringify(name)}, "imported")'>
                        <span>${escapeHtml(name)}</span>
                    </div>
                `).join('')}
            </div>
        </section>
    ` : '';

    content.innerHTML = `
        <section class="algset-section">
            <h3>Default</h3>
            ${defaultGroups.map((group) => `
                <div class="algset-subsection">
                    <h4>${escapeHtml(group.name)}</h4>
                    <div class="algset-list">
                        ${group.items.map(algset => `
                            <div class="algset-item ${algset.name === AppState.activeTrainingJSON ? 'active' : ''}" onclick='selectDefaultAlgset(${JSON.stringify(algset.name)})' oncontextmenu='openAlgsetContextMenu(event, ${JSON.stringify(algset.name)}, "default")'>
                                <span>${escapeHtml(algset.label)} <small>by ${escapeHtml(algset.author)}</small></span>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `).join('')}
        </section>
        ${importedMarkup}
        <div class="algset-import-footer">
            <button class="btn btn-primary" onclick="openImportAlgsetModal()">Add new algset</button>
        </div>
    `;
}

window.selectDefaultAlgset = async function(name) {
    try {
        await ensureDefaultTrainingAlgset(name);
    } catch (error) {
        console.error(`Could not load default algset ${name}:`, error);
        showFloatingMessage(`Couldn't grab ${name} right now.`, 'info');
        return;
    }
    activateTrainingJSON(name, { selectAllWhenMissing: true });
    document.querySelector('.modal')?.remove();
    renderApp();
    void generateNewScramble();
};

function closeAlgsetContextMenu() {
    document.querySelector('.algset-context-menu')?.remove();
}

function getAlgsetContextItems(name, type) {
    const items = [
        { action: 'select', label: 'Select' }
    ];
    if (type !== 'default') {
        const names = getImportedTrainingAlgsetNames();
        const index = names.indexOf(name);
        items.push(
            { action: 'delete', label: 'Delete' },
            { action: 'move-up', label: 'Move up', disabled: index <= 0 },
            { action: 'move-down', label: 'Move down', disabled: index < 0 || index >= names.length - 1 }
        );
    }
    items.push({ action: 'open-devtool', label: 'Open in devtool' });
    return items;
}

window.openAlgsetContextMenu = function(event, name, type) {
    event.preventDefault();
    event.stopPropagation();
    closeAlgsetContextMenu();

    const menu = document.createElement('div');
    menu.className = 'algset-context-menu';
    menu.innerHTML = getAlgsetContextItems(name, type).map((item) => `
        <button class="algset-context-item ${item.disabled ? 'disabled' : ''}" type="button" data-action="${item.action}" ${item.disabled ? 'disabled' : ''}>
            ${escapeHtml(item.label)}
        </button>
    `).join('');
    document.body.appendChild(menu);

    const rect = menu.getBoundingClientRect();
    menu.style.left = `${Math.max(8, Math.min(event.clientX, window.innerWidth - rect.width - 8))}px`;
    menu.style.top = `${Math.max(8, Math.min(event.clientY, window.innerHeight - rect.height - 8))}px`;

    menu.addEventListener('click', (clickEvent) => {
        const item = clickEvent.target.closest('.algset-context-item');
        if (!item || item.disabled) return;
        closeAlgsetContextMenu();
        void handleAlgsetContextAction(item.dataset.action, name, type);
    });

    setTimeout(() => {
        document.addEventListener('click', closeAlgsetContextMenu, { once: true });
        document.addEventListener('contextmenu', closeAlgsetContextMenu, { once: true });
    }, 0);
};

async function getAlgsetDataForAction(name, type) {
    if (type === 'default') return ensureDefaultTrainingAlgset(name);
    return getTrainingJSONData(name);
}

async function handleAlgsetContextAction(action, name, type) {
    if (action === 'select') {
        if (type === 'default') await window.selectDefaultAlgset(name);
        else window.selectImportedAlgset(name);
        return;
    }

    if (type !== 'default' && action === 'delete') {
        window.removeAlgset(name);
        return;
    }

    if (type !== 'default' && action === 'move-up') {
        moveImportedAlgset(name, -1);
        return;
    }

    if (type !== 'default' && action === 'move-down') {
        moveImportedAlgset(name, 1);
        return;
    }

    if (action === 'open-devtool') {
        await openAlgsetInDevtool(name, type);
    }
}

function moveImportedAlgset(name, direction) {
    const importedNames = getImportedTrainingAlgsetNames();
    const orderedNames = Object.keys(AppState.trainingJSONs);
    const importedIndex = importedNames.indexOf(name);
    const importedTargetName = importedNames[importedIndex + direction];
    if (!importedTargetName) return;
    const entries = Object.entries(AppState.trainingJSONs);
    const index = entries.findIndex(([entryName]) => entryName === name);
    const nextIndex = orderedNames.indexOf(importedTargetName);
    if (index < 0 || nextIndex < 0) return;
    [entries[index], entries[nextIndex]] = [entries[nextIndex], entries[index]];
    AppState.trainingJSONs = Object.fromEntries(entries);
    saveTrainingJSONs();
    renderAlgsetSelectorContent();
}

function getUniqueRootName(baseName) {
    const fallback = String(baseName || 'default').trim() || 'default';
    if (!AppState.developingJSONs[fallback]) return fallback;
    let counter = 1;
    let name = `${fallback} ${counter}`;
    while (AppState.developingJSONs[name]) {
        counter += 1;
        name = `${fallback} ${counter}`;
    }
    return name;
}

async function openAlgsetInDevtool(name, type) {
    let data;
    try {
        data = await getAlgsetDataForAction(name, type);
    } catch (error) {
        console.error(`Could not load algset ${name} for devtool:`, error);
        showFloatingMessage(`Couldn't grab ${name} right now.`, 'info');
        return;
    }
    if (!data) return;

    const rootName = getUniqueRootName(name);
    AppState.developingJSONs[rootName] = cloneJSON(data);
    AppState.activeDevelopingJSON = rootName;
    saveDevelopingJSONs();
    document.querySelectorAll('.modal').forEach((modal) => modal.remove());
    await openDevtoolFullscreen();
}

window.selectImportedAlgset = function(name) {
    activateTrainingJSON(name, { selectAllWhenMissing: true });
    document.querySelector('.modal')?.remove();
    renderApp();
    void generateNewScramble();
};

window.removeAlgset = function(name) {
    if (isDefaultTrainingAlgset(name)) return;
    showConfirmationModal(
        'Remove Algset',
        `Remove algset "${name}"?`,
        async () => {
            delete AppState.trainingJSONs[name];
            delete AppState.selectedCasesByAlgset[name];
            if (AppState.activeTrainingJSON === name) {
                AppState.activeTrainingJSON = getFirstAvailableTrainingAlgsetName();
                if (isDefaultTrainingAlgset(AppState.activeTrainingJSON)) await ensureDefaultTrainingAlgset(AppState.activeTrainingJSON);
                if (AppState.activeTrainingJSON) activateTrainingJSON(AppState.activeTrainingJSON, { selectAllWhenMissing: true });
                else AppState.selectedCases = [];
            }
            saveTrainingJSONs();
            saveSelectedCases();
            renderAlgsetSelectorContent();
            renderApp();
        }
    );
};

window.openImportAlgsetModal = function() {
    const modal = document.createElement('div');
    modal.className = 'modal active';
    modal.style.zIndex = '10001';
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h2>Import Algset</h2>
                <button class="close-btn" onclick="this.closest('.modal').remove()">×</button>
            </div>
            <div class="modal-body">
                <div class="settings-group">
                    <label class="settings-label">Algset Name</label>
                    <input type="text" id="importAlgsetName" class="settings-input" placeholder="Enter algset name">
                </div>
                <div class="settings-group">
                    <label class="settings-label">Paste JSON or Drag & Drop File</label>
                    <textarea class="settings-input import-drop-textarea" id="importAlgsetInput" placeholder="Paste your JSON here..."
                        ondragover="event.preventDefault();"
                        ondrop="handleAlgsetFileDrop(event)"
                        style="min-height: 300px; font-family: 'Courier New', monospace;"></textarea>
                </div>
                <div class="button-group">
                    <button class="btn btn-secondary" onclick="this.closest('.modal').remove()">Cancel</button>
                    <button class="btn btn-primary" onclick="importAlgset()">Import</button>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(modal);

    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.remove();
        }
    });
};

window.handleAlgsetFileDrop = function(event) {
    event.preventDefault();
    const file = event.dataTransfer.files[0];
    if (file && file.type === 'application/json') {
        const reader = new FileReader();
        reader.onload = function(e) {
            document.getElementById('importAlgsetInput').value = e.target.result;
            if (!document.getElementById('importAlgsetName').value) {
                document.getElementById('importAlgsetName').value = file.name.replace('.json', '');
            }
        };
        reader.readAsText(file);
    }
};

window.importAlgset = function() {
    const name = document.getElementById('importAlgsetName').value.trim();
    const jsonText = document.getElementById('importAlgsetInput').value.trim();

    if (!name) {
        showFloatingMessage('Please enter an algset name', 'error');
        return;
    }

    if (!jsonText) {
        showFloatingMessage('Please paste or drop a JSON file', 'error');
        return;
    }

    try {
        const parsed = JSON.parse(jsonText);
        importTrainingJSONData(name, parsed, { activate: true, selectAll: true });

        showFloatingMessage('Algset imported successfully!', 'success');
        setTimeout(() => {
            const modals = document.querySelectorAll('.modal');
            modals.forEach(m => m.remove());
            renderApp();
            void generateNewScramble();
        }, 500);
    } catch (error) {
        showFloatingMessage('Invalid JSON: ' + error.message, 'error');
    }
};

// Case selection modal
function openCaseSelectionModal() {
    if (!AppState.activeTrainingJSON || !getTrainingJSONData(AppState.activeTrainingJSON)) {
        showFloatingMessage('Please select an algset first', 'error');
        return;
    }

    const modal = document.createElement('div');
    modal.className = 'modal active';

    modal.innerHTML = `
        <div class="modal-content case-selection-content">
            <div class="modal-header">
                <h2>Select Cases - ${escapeHtml(getAlgsetDisplayLabel(AppState.activeTrainingJSON))}</h2>
                <button class="close-btn" onclick="this.closest('.modal').remove()">×</button>
            </div>
            <div class="modal-body">
                <div class="tree-view" id="caseTree"></div>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    renderCaseTree();
    const resizeCaseModal = () => updateCaseSelectionModalHeight();
    window.addEventListener('resize', resizeCaseModal);

    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            window.removeEventListener('resize', resizeCaseModal);
            modal.remove();
        }
    });
    modal.querySelector('.close-btn')?.addEventListener('click', () => window.removeEventListener('resize', resizeCaseModal), { once: true });
}

window.switchTrainingTab = function (name) {
    activateTrainingJSON(name, { selectAllWhenMissing: true });

    // Update tab styles
    const allTabs = document.querySelectorAll('#trainingTabs button');
    allTabs.forEach(tab => {
        if (tab.id === `tab-${name}`) {
            tab.classList.add('primary');
        } else {
            tab.classList.remove('primary');
        }
    });

    renderCaseTree();
};

// Render case tree
function renderCaseTree() {
    const treeContainer = document.getElementById('caseTree');
    if (!treeContainer) return;

    const activeData = getTrainingJSONData(AppState.activeTrainingJSON) || {};
    if (!AppState.caseTreeExpandedByAlgset[AppState.activeTrainingJSON]) {
        AppState.caseTreeExpandedByAlgset[AppState.activeTrainingJSON] = getFolderPaths(activeData);
        saveCaseTreeExpandedState();
    }
    treeContainer.innerHTML = renderTreeNode(activeData, [], 0);
    updateCaseSelectionModalHeight();
}

function getFolderPaths(node, path = []) {
    const paths = [];
    for (const [key, value] of Object.entries(node || {})) {
        if (value?.caseName !== undefined) continue;
        const nextPath = [...path, key];
        paths.push(nextPath.join('.'));
        paths.push(...getFolderPaths(value, nextPath));
    }
    return paths;
}

function getCasePaths(node, path = []) {
    const paths = [];
    for (const [key, value] of Object.entries(node || {})) {
        const nextPath = [...path, key];
        if (value?.caseName !== undefined) paths.push(nextPath.join('.'));
        else paths.push(...getCasePaths(value, nextPath));
    }
    return paths;
}

function getLongestCaseName(node) {
    return getCasePaths(node).reduce((longest, path) => {
        const parts = path.split('.');
        let current = node;
        for (const part of parts) current = current?.[part];
        const name = String(current?.caseName || parts.at(-1) || '');
        return Math.max(longest, name.length);
    }, 0);
}

function getCaseGridColumns(node, depth) {
    const longest = getLongestCaseName(node);
    const available = Math.max(260, window.innerWidth * 0.78 - depth * 24);
    const estimate = longest * 9 + 72;
    return Math.max(1, Math.min(4, Math.floor(available / Math.max(estimate, 170))));
}

function isPathSelected(path) {
    return AppState.selectedCases.some(c => c._path === path);
}

function escapeAttribute(value) {
    return escapeHtml(value);
}

function getTrainingNodeByPath(tree, path) {
    let current = tree;
    for (const part of String(path || '').split('.').filter(Boolean)) current = current?.[part];
    return current || null;
}

function updateSelectedCaseCountDisplay() {
    const count = document.getElementById('caseCount');
    if (count) count.textContent = `${AppState.selectedCases.length} selected`;
}

function findTreeNodeByPath(type, path) {
    const attr = type === 'folder' ? 'folderPath' : 'casePath';
    return [...document.querySelectorAll(`[data-${type}-path]`)].find((node) => node.dataset[attr] === path) || null;
}

function updateVisibleFolderCheckboxes() {
    const activeData = getTrainingJSONData(AppState.activeTrainingJSON);
    if (!activeData) return;

    document.querySelectorAll('[data-folder-path]').forEach((folderNode) => {
        const path = folderNode.dataset.folderPath;
        const folderData = getTrainingNodeByPath(activeData, path);
        const checkbox = folderNode.firstElementChild?.querySelector('.tree-checkbox');
        if (!folderData || !checkbox) return;
        const casePaths = getCasePaths(folderData, path.split('.').filter(Boolean));
        checkbox.checked = casePaths.length > 0 && casePaths.every(isPathSelected);
        checkbox.indeterminate = false;
    });
}

let selectionRefreshTimer = null;

function isCurrentScrambleSelected() {
    const key = getScrambleCaseKey(AppState.currentScramble);
    return Boolean(key) && AppState.selectedCases.some((item) => getSelectedCaseKey(item) === key);
}

function scheduleSelectionRefresh() {
    clearTimeout(selectionRefreshTimer);
    selectionRefreshTimer = setTimeout(() => {
        selectionRefreshTimer = null;
        if (AppState.selectedCases.length === 0) {
            AppState.currentScramble = null;
            AppState.timerState = 'idle';
            renderApp();
            return;
        }
        if (!AppState.currentScramble || !isCurrentScrambleSelected()) {
            void generateNewScramble();
        }
    }, 180);
}

function renderTreeNode(node, path, depth = 0, options = {}) {
    let html = '';

    for (const [key, value] of Object.entries(node)) {
        const currentPath = [...path, key];
        const pathString = currentPath.join('.');
        const isCase = value.caseName !== undefined;
        const pathArg = JSON.stringify(pathString);

        if (isCase) {
            const isSelected = isPathSelected(pathString);
            html += `
                        <div class="tree-node tree-node-case" data-case-path="${escapeAttribute(pathString)}" style="--tree-depth:${depth};">
                            <div class="tree-node-header">
                                <input type="checkbox" class="tree-checkbox" 
                                    ${isSelected ? 'checked' : ''} 
                                    onchange='toggleCaseSelection(${pathArg}, this.checked)'
                                >
                                <span class="tree-label">${value.caseName || key}</span>
                            </div>
                        </div>
                    `;
        } else {
            const casePaths = getCasePaths(value, currentPath);
            const allSelected = casePaths.length > 0 && casePaths.every(isPathSelected);
            const childColumns = getCaseGridColumns(value, depth + 1);
            const expandedPaths = AppState.caseTreeExpandedByAlgset[AppState.activeTrainingJSON] || [];
            const isExpanded = options.forceExpanded || expandedPaths.includes(pathString);
            const folderWeight = Math.max(600, Math.round(900 - (1 - (1 / (depth + 1))) * 380));
            html += `
                        <div class="tree-node tree-node-folder" data-folder-path="${escapeAttribute(pathString)}" style="--tree-depth:${depth};">
                            <div class="tree-node-header" onclick='toggleTreeNode(${pathArg})'>
                                <input type="checkbox" class="tree-checkbox" 
                                    ${allSelected ? 'checked' : ''} 
                                    onclick="event.stopPropagation()"
                                    onchange='toggleFolderSelection(${pathArg}, this.checked)'
                                >
                                <span class="tree-label tree-label-folder" style="--folder-weight:${folderWeight};">${key}</span>
                                <button class="tree-toggle" type="button" tabindex="-1">${isExpanded ? '▾' : '▸'}</button>
                            </div>
                            <div class="tree-children ${isExpanded ? 'expanded' : ''}" style="--case-columns:${childColumns};">
                                ${renderTreeNode(value, currentPath, depth + 1, options)}
                            </div>
                        </div>
                    `;
        }
    }

    return html;
}

function updateCaseSelectionModalHeight() {
    const modalContent = document.querySelector('.case-selection-content');
    const treeContainer = document.getElementById('caseTree');
    if (!modalContent || !treeContainer) return;
    if (window.matchMedia('(max-width: 600px)').matches) {
        modalContent.style.height = '';
        return;
    }

    const activeData = getTrainingJSONData(AppState.activeTrainingJSON) || {};
    const body = modalContent.querySelector('.modal-body');
    const header = modalContent.querySelector('.modal-header');
    if (!body || !header) return;

    const measure = document.createElement('div');
    measure.className = 'tree-view case-tree-measure';
    measure.style.width = `${treeContainer.clientWidth}px`;
    measure.innerHTML = renderTreeNode(activeData, [], 0, { forceExpanded: true });
    document.body.appendChild(measure);

    const bodyStyle = getComputedStyle(body);
    const bodyBlockPadding = parseFloat(bodyStyle.paddingTop) + parseFloat(bodyStyle.paddingBottom);
    const expandedHeight = measure.scrollHeight;
    measure.remove();

    const targetHeight = Math.min(
        Math.ceil(header.offsetHeight + bodyBlockPadding + expandedHeight),
        window.innerHeight - 28
    );
    modalContent.style.height = `${targetHeight}px`;
}

window.toggleTreeNode = function (path) {
    const name = AppState.activeTrainingJSON;
    if (!name) return;
    const expanded = new Set(AppState.caseTreeExpandedByAlgset[name] || []);
    if (expanded.has(path)) expanded.delete(path);
    else expanded.add(path);
    AppState.caseTreeExpandedByAlgset[name] = [...expanded];
    saveCaseTreeExpandedState();
    renderCaseTree();
};

window.toggleCaseSelection = function (path, checked) {
    const activeData = getTrainingJSONData(AppState.activeTrainingJSON);
    if (!activeData) return;
    const current = getTrainingNodeByPath(activeData, path);
    if (!current?.caseName) return;

    if (checked) {
        if (!AppState.selectedCases.some(c => c._path === path)) {
            AppState.selectedCases.push({ ...current, _path: path, _jsonName: AppState.activeTrainingJSON });
        }
    } else {
        AppState.selectedCases = AppState.selectedCases.filter(c => c._path !== path);
    }
    scheduleSelectedCasesSave();
    updateSelectedCaseCountDisplay();
    updateVisibleFolderCheckboxes();
    scheduleSelectionRefresh();
};

window.toggleFolderSelection = function (path, checked) {
    const pathParts = path.split('.').filter(Boolean);
    const activeData = getTrainingJSONData(AppState.activeTrainingJSON);
    if (!activeData) return;
    const current = getTrainingNodeByPath(activeData, path);
    if (!current) return;

    const paths = getCasePaths(current, pathParts);
    if (checked) {
        const selectedPaths = new Set(AppState.selectedCases.map(c => c._path));
        for (const casePath of paths) {
            if (!selectedPaths.has(casePath)) {
                const caseNode = getTrainingNodeByPath(activeData, casePath);
                if (!caseNode?.caseName) continue;
                AppState.selectedCases.push({ ...caseNode, _path: casePath, _jsonName: AppState.activeTrainingJSON });
                selectedPaths.add(casePath);
            }
        }
    } else {
        const pathSet = new Set(paths);
        AppState.selectedCases = AppState.selectedCases.filter(c => !pathSet.has(c._path));
    }

    const folderNode = findTreeNodeByPath('folder', path);
    folderNode?.querySelectorAll('.tree-node-case .tree-checkbox').forEach((checkbox) => {
        checkbox.checked = checked;
    });
    scheduleSelectedCasesSave();
    updateSelectedCaseCountDisplay();
    updateVisibleFolderCheckboxes();
    scheduleSelectionRefresh();
};

function openAlgsetInfoModal() {
    const algset = getDefaultTrainingAlgset(AppState.activeTrainingJSON);
    if (!algset || !hasAlgsetInfo(algset.name)) return;

    const info = algset.info || {};
    const links = Array.isArray(info.links) ? info.links : [];
    const linkMarkup = links.length ? `
        <ul class="algset-info-links">
            ${links.map((link) => `
                <li>
                    <a href="${escapeHtml(link.url || '#')}" target="_blank" rel="noopener noreferrer">${escapeHtml(link.label || link.url || 'Resource')}</a>
                </li>
            `).join('')}
        </ul>
    ` : '';

    const modal = document.createElement('div');
    modal.className = 'modal active';
    modal.innerHTML = `
        <div class="modal-content help-popup-inner">
            <div class="modal-header">
                <h2>${escapeHtml(getAlgsetDisplayLabel(algset.name))}</h2>
                <button class="close-btn" onclick="this.closest('.modal').remove()">×</button>
            </div>
            <div class="modal-body help-content algset-info-content">
                <section class="help-section">
                    <h3>${escapeHtml(algset.label)}</h3>
                    <p>${escapeHtml(info.text || '')}</p>
                    ${linkMarkup}
                </section>
            </div>
        </div>
    `;
    document.body.appendChild(modal);

    modal.addEventListener('click', (event) => {
        if (event.target === modal) modal.remove();
    });
}

// Settings modal
// Settings modal
// Settings modal
function openSettingsModal() {
    const modal = document.createElement('div');
    modal.className = 'modal active';
    modal.innerHTML = `
        <div class="modal-content settings-popup-inner">
            <div class="modal-header">
                <h2>Settings</h2>
                <button class="close-btn" onclick="this.closest('.modal').remove()">×</button>
            </div>
            <div class="modal-body settings-body">
                <label class="settings-row">
                    <span>Theme</span>
                    <button class="settings-cycle-btn" type="button" onclick="cycleTheme()">${AppState.settings.theme}</button>
                </label>
                <label class="settings-row">
                    <span>Starting cue</span>
                    <span class="cue-input-wrap">
                        <input type="number" class="settings-input cue-input" id="cueDurationInput"
                            min="0.0" max="0.5" step="0.05"
                            value="${AppState.settings.startingCueDuration}"
                            onchange="changeCueDuration(this.value)">
                        <span>sec</span>
                    </span>
                </label>
            </div>
        </div>
    `;
    document.body.appendChild(modal);

    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.remove();
        }
    });
}

function openAboutModal() {
    openHelpModal();
}

function openHelpModal() {
    const modal = document.createElement('div');
    modal.className = 'modal active';
    modal.innerHTML = `
        <div class="modal-content help-popup-inner">
            <div class="modal-header">
                <h2>Help</h2>
                <button class="close-btn" onclick="this.closest('.modal').remove()">×</button>
            </div>
            <div class="modal-body help-content">
                <section class="help-section">
                    <h3>Trainer</h3>
                    <p>The trainer is for selecting an algset, choosing cases, generating scrambles, timing solves, and reviewing hints. Use the algset selector in the top bar to choose EOCP or one of your own algsets. The first time an algset opens, every case is selected; after that, SquanX remembers your selected cases per algset.</p>
                    <p>Open Case selector from the rail to choose cases. Folder checkboxes select or deselect everything inside that folder, individual case checkboxes autosave immediately, and expanded folders are remembered.</p>
                    <p>Use Add new algset from the algset selector to import a JSON file by paste or drag-and-drop. Imported algsets appear under My algsets.</p>
                </section>
                <section class="help-section">
                    <h3>Devtool</h3>
                    <p>The devtool is the algset creator. Open it from the rail to create roots, folders, cases, templates, scripts, bulk imports, and JSON exports.</p>
                    <p>A root is one complete algset workspace. Use the Root dropdown above the tree to switch roots. Right-click roots, folders, or cases for the full action menu: rename, run, copy, paste, export JSON, move, reset, delete, and script actions where they apply.</p>
                    <p>The devtool has its own Help menu with the detailed shortcut and workflow reference. For scripted algset creation, see the <a href="${COMMAND_REFERENCE_URL}" target="_blank" rel="noopener noreferrer">Algset Script command reference</a>.</p>
                </section>
                <section class="help-section">
                    <h3>Backups</h3>
                    <p>Use the import/export buttons at the bottom of the rail to move all app data at once, including trainer algsets, selected cases, devtool roots, templates, settings, and session times.</p>
                </section>
                <section class="help-section">
                    <h3>Where Things Go</h3>
                    <p>Train in the devtool sends the current root straight to the trainer. Extract JSON shows the compact export for the current root. Download saves that export as a file. Copy copies the export text.</p>
                </section>
            </div>
        </div>
    `;
    document.body.appendChild(modal);

    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.remove();
        }
    });
}

window.changeTheme = function(theme) {
    AppState.settings.theme = theme;
    saveSettings();
    applyTheme();
    document.querySelector('.modal')?.remove();
    openSettingsModal();
};

window.cycleTheme = function() {
    window.changeTheme(AppState.settings.theme === 'dark' ? 'light' : 'dark');
};

window.changeCueDuration = function(value) {
    const numValue = parseFloat(value);
    if (!isNaN(numValue) && numValue >= 0.0 && numValue <= 0.5) {
        AppState.settings.startingCueDuration = numValue;
        saveSettings();
    }
};

// Import JSON modal
window.openImportJSONModal = function () {
    const modal = document.createElement('div');
    modal.className = 'modal active';
    modal.innerHTML = `
                <div class="modal-content">
                    <div class="modal-header">
                        <h2>Import Training JSON</h2>
                        <button class="close-btn" onclick="this.closest('.modal').remove()">×</button>
                    </div>
                    <div class="modal-body">
                        <div class="settings-group">
                            <label class="settings-label">JSON Name</label>
                            <input type="text" id="importJSONName" class="settings-input" placeholder="Enter a name for this training set" style="margin-bottom: 12px;">
                        </div>
                        <div class="settings-group">
                            <label class="settings-label">Paste JSON or Drag & Drop File</label>
                            <textarea class="settings-input import-drop-textarea" id="importJSONInput" placeholder="Paste your JSON here..."
                                ondragover="event.preventDefault();"
                                ondrop="handleJSONFileDrop(event)"
                                style="min-height: 300px; font-family: 'Courier New', monospace;"></textarea>
                        </div>
                        <div class="button-group">
                            <button class="btn btn-secondary" onclick="this.closest('.modal').remove()">Cancel</button>
                            <button class="btn btn-primary" onclick="importTrainingJSON()">Import</button>
                        </div>
                    </div>
                </div>
            `;
    document.body.appendChild(modal);

    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.remove();
        }
    });
};

window.handleJSONFileDrop = function (event) {
    event.preventDefault();
    const file = event.dataTransfer.files[0];
    if (file && file.type === 'application/json') {
        const reader = new FileReader();
        reader.onload = function (e) {
            document.getElementById('importJSONInput').value = e.target.result;
            if (!document.getElementById('importJSONName').value) {
                document.getElementById('importJSONName').value = file.name.replace('.json', '');
            }
        };
        reader.readAsText(file);
    }
};

window.importTrainingJSON = function () {
    const name = document.getElementById('importJSONName').value.trim();
    const jsonText = document.getElementById('importJSONInput').value.trim();

    if (!name) {
        showFloatingMessage('Please enter a name for this training set', 'error');
        return;
    }

    if (!jsonText) {
        showFloatingMessage('Please paste or drop a JSON file', 'error');
        return;
    }

    try {
        const parsed = JSON.parse(jsonText);
        importTrainingJSONData(name, parsed, { activate: true, selectAll: true });

        showFloatingMessage('Training JSON imported successfully!', 'success');
        setTimeout(() => {
            document.querySelector('.modal').remove();
            renderApp();
            void generateNewScramble();
        }, 500);
    } catch (error) {
        showFloatingMessage('Invalid JSON: ' + error.message, 'error');
    }
};

window.setActiveTrainingJSON = function (name) {
    activateTrainingJSON(name, { selectAllWhenMissing: true });
    document.querySelector('.modal').remove();
    openSettingsModal();
    renderApp();
};

window.removeTrainingJSON = function (name) {
    if (isDefaultTrainingAlgset(name)) return;
    showConfirmationModal(
        'Remove Training Set',
        `Remove training set "${name}"?`,
        async () => {
            delete AppState.trainingJSONs[name];
            delete AppState.selectedCasesByAlgset[name];
            if (AppState.activeTrainingJSON === name) {
                AppState.activeTrainingJSON = getFirstAvailableTrainingAlgsetName();
                if (isDefaultTrainingAlgset(AppState.activeTrainingJSON)) await ensureDefaultTrainingAlgset(AppState.activeTrainingJSON);
                if (AppState.activeTrainingJSON) activateTrainingJSON(AppState.activeTrainingJSON, { selectAllWhenMissing: true });
                else AppState.selectedCases = [];
            }
            saveTrainingJSONs();
            saveSelectedCases();
            document.querySelector('.modal').remove();
            openSettingsModal();
            renderApp();
        }
    );
};

function openHintModal() {
    const modal = document.createElement('div');
    modal.className = 'modal active';
    const current = AppState.currentScramble;
    modal.innerHTML = `
        <div class="modal-content hint-popup-inner">
            <div class="modal-header">
                <h2>${current?.caseName || 'Hint'}</h2>
                <button class="close-btn" onclick="this.closest('.modal').remove()">×</button>
            </div>
            <div class="modal-body hint-body">
                ${current?.alg ? `<pre>${escapeHtml(current.alg)}</pre>` : '<p>No algorithm hint for this case.</p>'}
            </div>
        </div>
    `;
    document.body.appendChild(modal);

    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.remove();
        }
    });
}

Object.assign(window, {
    initApp,
    openSettingsModal,
    openAboutModal,
    openHelpModal,
    openHintModal
});

export {
    AppState,
    DEFAULT_ALGSET,
    activateTrainingJSON,
    importTrainingJSONData,
    initApp,
    renderApp,
    generateNewScramble,
    setupEventListeners,
    saveDevelopingJSONs,
    saveDevelopingRoot,
    saveLastScreen
};

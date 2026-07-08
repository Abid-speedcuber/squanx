import { ensureFeatureModules, openDevtoolFullscreen } from './moduleLoader.js';

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
    { file: 'EOCP.json', name: 'EOCP', label: 'EOCP', author: 'Abid' }
];

const DEFAULT_ALGSET_BASE_PATH = './default-algset/';

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
    const algset = DEFAULT_TRAINING_ALGSETS.find((item) => item.name === name);
    if (!algset) return null;
    const response = await fetch(`${DEFAULT_ALGSET_BASE_PATH}${algset.file}`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
}

async function ensureDefaultTrainingAlgset(name) {
    if (AppState.trainingJSONs[name]) return AppState.trainingJSONs[name];
    const data = await fetchDefaultAlgsetData(name);
    if (!data) return null;
    importTrainingJSONData(name, data, { activate: false, selectAll: true });
    return AppState.trainingJSONs[name];
}

// Load training JSONs from localStorage
function loadTrainingJSONs() {
    const saved = localStorage.getItem('sq1TrainingJSONs');
    if (saved) {
        try {
            AppState.trainingJSONs = JSON.parse(saved);
        } catch (e) {
            console.error('Error loading training JSONs:', e);
            AppState.trainingJSONs = {};
        }
    }

    const activeJSON = localStorage.getItem('sq1ActiveTrainingJSON');
    if (activeJSON && AppState.trainingJSONs[activeJSON]) {
        AppState.activeTrainingJSON = activeJSON;
    } else if (Object.keys(AppState.trainingJSONs).length > 0) {
        AppState.activeTrainingJSON = Object.keys(AppState.trainingJSONs)[0];
    }
}

// Save training JSONs to localStorage
function saveTrainingJSONs() {
    localStorage.setItem('sq1TrainingJSONs', JSON.stringify(AppState.trainingJSONs));
    if (AppState.activeTrainingJSON) {
        localStorage.setItem('sq1ActiveTrainingJSON', AppState.activeTrainingJSON);
    }
}

function getTrainingCaseByPath(tree, path) {
    let current = tree;
    for (const part of String(path || '').split('.')) current = current?.[part];
    return current?.caseName !== undefined ? current : null;
}

function buildSelectedCasesForAlgset(name, paths = null) {
    const tree = AppState.trainingJSONs[name];
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
    if (!name || !AppState.trainingJSONs[name]) return false;
    AppState.activeTrainingJSON = name;
    const savedSelection = AppState.selectedCasesByAlgset[name];
    if (Array.isArray(savedSelection)) {
        AppState.selectedCases = savedSelection.filter((item) => getTrainingCaseByPath(AppState.trainingJSONs[name], item._path));
    } else {
        AppState.selectedCases = selectAllWhenMissing ? buildSelectedCasesForAlgset(name) : [];
    }
    saveTrainingJSONs();
    saveSelectedCases();
    return true;
}

function importTrainingJSONData(name, data, options = {}) {
    const { activate = true, selectAll = true } = options;
    AppState.trainingJSONs[name] = data;
    AppState.selectedCasesByAlgset[name] = selectAll ? buildSelectedCasesForAlgset(name) : [];
    if (activate || !AppState.activeTrainingJSON) activateTrainingJSON(name, { selectAllWhenMissing: selectAll });
    saveTrainingJSONs();
    saveSelectedCases();
}

// Load developing JSONs from localStorage
function loadDevelopingJSONs() {
    const saved = localStorage.getItem('sq1DevelopingJSONs');
    if (saved) {
        try {
            AppState.developingJSONs = JSON.parse(saved);
        } catch (e) {
            console.error('Error loading developing JSONs:', e);
            AppState.developingJSONs = { 'default': DEFAULT_ALGSET };
        }
    } else {
        AppState.developingJSONs = { 'default': DEFAULT_ALGSET };
    }

    const activeRoot = localStorage.getItem('sq1ActiveDevelopingJSON');
    if (activeRoot && AppState.developingJSONs[activeRoot]) {
        AppState.activeDevelopingJSON = activeRoot;
    }
}

// Save developing JSONs to localStorage
function saveDevelopingJSONs() {
    localStorage.setItem('sq1DevelopingJSONs', JSON.stringify(AppState.developingJSONs));
    localStorage.setItem('sq1ActiveDevelopingJSON', AppState.activeDevelopingJSON);
}

// Load selected cases from localStorage
function loadSelectedCases() {
    const savedByAlgset = localStorage.getItem('sq1SelectedCasesByAlgset');
    if (savedByAlgset) {
        try {
            AppState.selectedCasesByAlgset = JSON.parse(savedByAlgset) || {};
        } catch (e) {
            console.error('Error loading selected cases by algset:', e);
            AppState.selectedCasesByAlgset = {};
        }
    }

    const legacySaved = localStorage.getItem('sq1SelectedCases');
    if (legacySaved && Object.keys(AppState.selectedCasesByAlgset).length === 0 && AppState.activeTrainingJSON) {
        try {
            AppState.selectedCasesByAlgset[AppState.activeTrainingJSON] = JSON.parse(legacySaved);
        } catch (e) {
            console.error('Error loading selected cases:', e);
        }
    }

    if (AppState.activeTrainingJSON) activateTrainingJSON(AppState.activeTrainingJSON, { selectAllWhenMissing: true });
}

// Load last screen state
function loadLastScreen() {
    const lastScreen = localStorage.getItem('sq1LastScreen');
    return lastScreen || 'training';
}

// Save last screen state
function saveLastScreen(screen) {
    localStorage.setItem('sq1LastScreen', screen);
}

// Save selected cases to localStorage
function saveSelectedCases() {
    if (AppState.activeTrainingJSON) {
        AppState.selectedCasesByAlgset[AppState.activeTrainingJSON] = AppState.selectedCases;
    }
    localStorage.setItem('sq1SelectedCasesByAlgset', JSON.stringify(AppState.selectedCasesByAlgset));
    localStorage.setItem('sq1SelectedCases', JSON.stringify(AppState.selectedCases));
}

function loadCaseTreeExpandedState() {
    const saved = localStorage.getItem('sq1CaseTreeExpandedByAlgset');
    if (!saved) return;
    try {
        AppState.caseTreeExpandedByAlgset = JSON.parse(saved) || {};
    } catch (e) {
        console.error('Error loading case tree expanded state:', e);
        AppState.caseTreeExpandedByAlgset = {};
    }
}

function saveCaseTreeExpandedState() {
    localStorage.setItem('sq1CaseTreeExpandedByAlgset', JSON.stringify(AppState.caseTreeExpandedByAlgset));
}

// Load session times from localStorage
function loadSessionTimes() {
    const saved = localStorage.getItem('sq1SessionTimes');
    if (saved) {
        try {
            AppState.sessionTimes = JSON.parse(saved);
        } catch (e) {
            console.error('Error loading session times:', e);
            AppState.sessionTimes = {};
        }
    }
}

// Save session times to localStorage
function saveSessionTimes() {
    localStorage.setItem('sq1SessionTimes', JSON.stringify(AppState.sessionTimes));
}

// Load settings from localStorage
function loadSettings() {
    const saved = localStorage.getItem('sq1Settings');
    if (saved) {
        try {
            const settings = JSON.parse(saved);
            AppState.settings = { ...AppState.settings, ...settings };
        } catch (e) {
            console.error('Error loading settings:', e);
        }
    }
}

// Save settings to localStorage
function saveSettings() {
    localStorage.setItem('sq1Settings', JSON.stringify(AppState.settings));
}

// Apply theme to body
function applyTheme() {
    document.body.className = `theme-${AppState.settings.theme}`;
}

// Initialize app
async function initApp() {
    loadTrainingJSONs();
    loadDevelopingJSONs();
    loadCaseTreeExpandedState();
    loadSelectedCases();
    loadSessionTimes();
    loadSettings();
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

function trainerIconSprite() {
    return `
        <svg aria-hidden="true" style="display:none">
            <symbol id="rail-icon-cases" viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></symbol>
            <symbol id="rail-icon-help" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.8.4-1 .9-1 1.7"/><line x1="12" y1="17" x2="12" y2="17"/></symbol>
            <symbol id="rail-icon-settings" viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09A1.65 1.65 0 0 0 19.4 15z"/></symbol>
            <symbol id="rail-icon-import" viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></symbol>
            <symbol id="rail-icon-export" viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></symbol>
            <symbol id="rail-icon-devtool" viewBox="0 0 24 24"><path d="m16 18 6-6-6-6"/><path d="m8 6-6 6 6 6"/><path d="m14.5 4-5 16"/></symbol>
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
    const currentScramble = escapeHtml(AppState.currentScramble?.scramble || 'Scramble will show up here');
    const previousScramble = AppState.previousScramble
        ? escapeHtml(`${AppState.previousScramble.scramble} (${AppState.previousScramble.caseName || 'Unknown case'})`)
        : 'Last scramble will show up here';
    const activeAlgset = escapeHtml(AppState.activeTrainingJSON || 'Select Algset');

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
                            <div class="bar-scramble" id="scrambleDisplay">${currentScramble}</div>
                        </div>
                        <div class="scramble-controls">
                            <button class="bar-btn" id="prevScrambleBtn" ${AppState.previousScramble ? '' : 'disabled'}>← Previous</button>
                            <button class="bar-btn" id="unselprev">Remove last</button>
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
                if (solverError.message && solverError.message.includes("Cannot read properties of undefined (reading 'shift')")) {
                    if (attempts < maxAttempts) {
                        continue;
                    }
                }
                
                console.error('Solver error after retries:', solverError);
                scramble = 'Solver error: ' + solverError.message;
                break;
            }
        }
        
        if (AppState.currentScramble) AppState.scrambleHistory.push(AppState.currentScramble);
        AppState.previousScramble = AppState.scrambleHistory[AppState.scrambleHistory.length - 1] || null;
        AppState.currentScramble = {
            ...result, 
            caseName: randomCase.caseName, 
            alg: randomCase.alg || '',
            scramble: formatScrambleDisplay(scramble)
        };
        renderApp();
    } catch (error) {
        console.error('Error generating scramble:', error);
        if (AppState.currentScramble) AppState.scrambleHistory.push(AppState.currentScramble);
        AppState.previousScramble = AppState.scrambleHistory[AppState.scrambleHistory.length - 1] || null;
        AppState.currentScramble = {
            hexState: 'Error generating scramble', 
            scramble: 'Error: ' + error.message,
            caseName: randomCase.caseName
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

window.importAllAppData = function() {
    const jsonText = document.getElementById('importAllDataInput')?.value.trim();
    if (!jsonText) return showFloatingMessage('Please paste or drop an app data export', 'error');
    try {
        const data = JSON.parse(jsonText);
        AppState.trainingJSONs = data.trainingJSONs || {};
        AppState.activeTrainingJSON = data.activeTrainingJSON && AppState.trainingJSONs[data.activeTrainingJSON]
            ? data.activeTrainingJSON
            : Object.keys(AppState.trainingJSONs)[0] || null;
        AppState.selectedCasesByAlgset = data.selectedCasesByAlgset || {};
        AppState.caseTreeExpandedByAlgset = data.caseTreeExpandedByAlgset || {};
        if (Array.isArray(data.selectedCases) && AppState.activeTrainingJSON && !AppState.selectedCasesByAlgset[AppState.activeTrainingJSON]) {
            AppState.selectedCasesByAlgset[AppState.activeTrainingJSON] = data.selectedCases;
        }
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
        applyTheme();
        document.querySelector('.modal')?.remove();
        renderApp();
        showFloatingMessage('App data imported', 'success');
    } catch (error) {
        showFloatingMessage(`Invalid app data: ${error.message}`, 'error');
    }
};

function removeLastSolve() {
    if (!AppState.selectedCases.length) {
        showFloatingMessage('No selected case to remove', 'info');
        return;
    }

    const removed = AppState.selectedCases.pop();
    saveSelectedCases();
    showFloatingMessage(`Deselected ${removed.caseName || 'last case'}`, 'success');
    void generateNewScramble();
}

// Timer handlers
let spacePressed = false;
let timerHoldStartTime = 0;
let timerPreparingInterval = null;

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
    handleTimerMouseDown();
}

function handleTimerTouchEnd(e) {
    e.preventDefault();
    handleTimerMouseUp();
}

function handleKeyDown(e) {
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

    const importedAlgsets = Object.keys(AppState.trainingJSONs);

    content.innerHTML = `
        <section class="algset-section">
            <h3>Default</h3>
            <div class="algset-list">
                ${DEFAULT_TRAINING_ALGSETS.map(algset => `
                    <div class="algset-item ${algset.name === AppState.activeTrainingJSON ? 'active' : ''}" onclick='selectDefaultAlgset(${JSON.stringify(algset.name)})' oncontextmenu='openAlgsetContextMenu(event, ${JSON.stringify(algset.name)}, "default")'>
                        <span>${escapeHtml(algset.label)} <small>by ${escapeHtml(algset.author)}</small></span>
                    </div>
                `).join('')}
            </div>
        </section>
        <section class="algset-section">
            <h3>Imported</h3>
            <div class="algset-list">
                ${importedAlgsets.length === 0 ?
                    '<p class="empty-state">No imported algsets</p>' :
                    importedAlgsets.map(name => `
                        <div class="algset-item ${name === AppState.activeTrainingJSON ? 'active' : ''}" onclick='selectImportedAlgset(${JSON.stringify(name)})' oncontextmenu='openAlgsetContextMenu(event, ${JSON.stringify(name)}, "imported")'>
                            <span>${escapeHtml(name)}</span>
                            <button class="algset-remove-btn" onclick='event.stopPropagation(); removeAlgset(${JSON.stringify(name)})'>×</button>
                        </div>
                    `).join('')
                }
            </div>
        </section>
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
        const names = Object.keys(AppState.trainingJSONs);
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
    if (type === 'default' && !AppState.trainingJSONs[name]) {
        return fetchDefaultAlgsetData(name);
    }
    return AppState.trainingJSONs[name] || null;
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
    const entries = Object.entries(AppState.trainingJSONs);
    const index = entries.findIndex(([entryName]) => entryName === name);
    const nextIndex = index + direction;
    if (index < 0 || nextIndex < 0 || nextIndex >= entries.length) return;
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
    showConfirmationModal(
        'Remove Algset',
        `Remove algset "${name}"?`,
        () => {
            delete AppState.trainingJSONs[name];
            delete AppState.selectedCasesByAlgset[name];
            if (AppState.activeTrainingJSON === name) {
                AppState.activeTrainingJSON = Object.keys(AppState.trainingJSONs)[0] || null;
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
    if (!AppState.activeTrainingJSON || !AppState.trainingJSONs[AppState.activeTrainingJSON]) {
        showFloatingMessage('Please select an algset first', 'error');
        return;
    }

    const modal = document.createElement('div');
    modal.className = 'modal active';

    modal.innerHTML = `
        <div class="modal-content case-selection-content">
            <div class="modal-header">
                <h2>Select Cases - ${AppState.activeTrainingJSON}</h2>
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

    const activeData = AppState.trainingJSONs[AppState.activeTrainingJSON] || {};
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
                        <div class="tree-node tree-node-case" style="--tree-depth:${depth};">
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
                        <div class="tree-node tree-node-folder" style="--tree-depth:${depth};">
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

    const activeData = AppState.trainingJSONs[AppState.activeTrainingJSON] || {};
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
    const pathParts = path.split('.');
    const activeData = AppState.trainingJSONs[AppState.activeTrainingJSON];
    let current = activeData;

    for (const part of pathParts) {
        current = current[part];
    }

    if (checked) {
        if (!AppState.selectedCases.some(c => c._path === path)) {
            AppState.selectedCases.push({ ...current, _path: path, _jsonName: AppState.activeTrainingJSON });
        }
    } else {
        AppState.selectedCases = AppState.selectedCases.filter(c => c._path !== path);
    }
    saveSelectedCases();
    document.getElementById('caseCount').textContent = `${AppState.selectedCases.length} selected`;
    renderCaseTree();
    void generateNewScramble();
};

window.toggleFolderSelection = function (path, checked) {
    const pathParts = path.split('.');
    const activeData = AppState.trainingJSONs[AppState.activeTrainingJSON];
    let current = activeData;

    for (const part of pathParts) {
        current = current[part];
    }

    const paths = getCasePaths(current, pathParts);
    if (checked) {
        for (const casePath of paths) {
            if (!AppState.selectedCases.some(c => c._path === casePath)) {
                let caseNode = activeData;
                for (const part of casePath.split('.')) caseNode = caseNode[part];
                AppState.selectedCases.push({ ...caseNode, _path: casePath, _jsonName: AppState.activeTrainingJSON });
            }
        }
    } else {
        AppState.selectedCases = AppState.selectedCases.filter(c => !paths.includes(c._path));
    }
    saveSelectedCases();
    document.getElementById('caseCount').textContent = `${AppState.selectedCases.length} selected`;
    renderCaseTree();
    void generateNewScramble();
};

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
                    <h3>Getting an algset into the trainer</h3>
                    <p>Use Select Algset to choose one of your imported algsets. If you have never opened that algset before, SquanX selects every case in it automatically. After that, your exact selected cases are remembered per algset.</p>
                    <p>To import a JSON file, open Select Algset, press Import Algset, then paste JSON or drag a file onto the import box. The imported algset becomes active immediately and all of its cases are selected.</p>
                </section>
                <section class="help-section">
                    <h3>Creating an algset</h3>
                    <p>Open the Devtool from the left rail. Build folders and cases there, or use Bulk Import for CSV/XLSX files. When the root is ready, use Extract JSON, Download for a file, or Train to send the current root straight into this trainer.</p>
                </section>
                <section class="help-section">
                    <h3>Selecting cases</h3>
                    <p>The case selector remembers expanded folders. Folder checkboxes select or deselect everything inside that folder. Individual case checkboxes autosave instantly; there is no separate save button.</p>
                </section>
                <section class="help-section">
                    <h3>Data backup</h3>
                    <p>Use the import/export buttons at the bottom of the rail to move all app data at once, including trainer algsets, selected cases, devtool roots, templates, settings, and session times.</p>
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
    showConfirmationModal(
        'Remove Training Set',
        `Remove training set "${name}"?`,
        () => {
            delete AppState.trainingJSONs[name];
            delete AppState.selectedCasesByAlgset[name];
            if (AppState.activeTrainingJSON === name) {
                AppState.activeTrainingJSON = Object.keys(AppState.trainingJSONs)[0] || null;
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
    saveLastScreen
};

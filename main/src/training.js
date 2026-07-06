import { ensureFeatureModules, openDevtoolFullscreen } from './moduleLoader.js';

// Application State
const AppState = {
    selectedCases: [],
    currentScramble: null,
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
    const saved = localStorage.getItem('sq1SelectedCases');
    if (saved) {
        try {
            AppState.selectedCases = JSON.parse(saved);
        } catch (e) {
            console.error('Error loading selected cases:', e);
            AppState.selectedCases = [];
        }
    }
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
    localStorage.setItem('sq1SelectedCases', JSON.stringify(AppState.selectedCases));
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
        setupEventListeners();
        return 'trainer';
    }
}

// Get initial timer display value
function getInitialTimerDisplay() {

    if (AppState.activeTrainingJSON && AppState.sessionTimes[AppState.activeTrainingJSON]) {
        const times = AppState.sessionTimes[AppState.activeTrainingJSON];
        if (times.length > 0) {
            const lastTime = times[times.length - 1].time;
            return lastTime.toFixed(3);
        }
    }
    return '0.000';
}

// Render main app structure
function renderApp() {
    const app = document.getElementById('app');
    app.innerHTML = `
                <div class="top-navbar">
                    <div class="nav-left">
                        <div class="app-logo">
                            <div class="logo-title">SquanGo</div>
                            <div class="logo-subtitle">Algset Trainer</div>
                        </div>
                        <button class="nav-button algset-selector-btn" id="selectAlgsetBtn">${AppState.activeTrainingJSON || 'Select Algset'}</button>
                        <span class="case-count" id="caseCount">${AppState.selectedCases.length} case(s) selected</span>
                    </div>
                    <div class="nav-right">
                        <button class="nav-button" id="prevScrambleBtn">← Previous</button>
                        <button class="nav-button" id="nextScrambleBtn">Next →</button>
                        <button class="nav-button nav-menu-btn" id="menuBtn">⋮</button>
                    </div>
                </div>

                <div class="scramble-bar" style="cursor: pointer;" onclick="openScrambleDetailModal()">
    <div class="scramble-text" id="scrambleDisplay">
        ${AppState.currentScramble && AppState.currentScramble.scramble ? AppState.currentScramble.scramble : 'No scramble generated'}
    </div>
</div>

                <div class="main-content">
                    <div class="timer-zone" id="timerZone">
                        <div class="timer-display" id="timerDisplay">${getInitialTimerDisplay()}</div>
                    </div>
                </div>
            `;
    setupEventListeners();
}

// Generate visualization from hex state
function generateVisualization(hexState) {
    if (typeof window.Square1VisualizerLibraryWithSillyNames !== 'undefined') {
        const colors = {
            topColor: '#000000',
            bottomColor: '#FFFFFF',
            frontColor: '#CC0000',
            rightColor: '#00AA00',
            backColor: '#FF8C00',
            leftColor: '#0066CC',
            dividerColor: '#7a0000',
            circleColor: 'transparent'
        };
        return window.Square1VisualizerLibraryWithSillyNames.visualizeFromHexCodePlease(
            hexState,
            AppState.settings.visualizationSize,
            colors,
            5
        );
    }
    return '<div style="color: #888;">Visualization unavailable</div>';
}

// Generate new scramble from selected cases
async function generateNewScramble() {
    if (AppState.selectedCases.length === 0) {
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
        
        AppState.currentScramble = { 
            ...result, 
            caseName: randomCase.caseName, 
            alg: randomCase.alg || '',
            scramble: scramble
        };
        renderApp();
    } catch (error) {
        console.error('Error generating scramble:', error);
        AppState.currentScramble = { 
            hexState: 'Error generating scramble', 
            scramble: 'Error: ' + error.message,
            caseName: randomCase.caseName
        };
        renderApp();
    }
}

// Setup event listeners
function setupEventListeners() {
    document.getElementById('selectAlgsetBtn').addEventListener('click', openAlgsetSelectorModal);
    document.getElementById('prevScrambleBtn').addEventListener('click', () => {
        // For now, just generate a new scramble
        void generateNewScramble();
    });
    document.getElementById('nextScrambleBtn').addEventListener('click', () => {
        void generateNewScramble();
    });
    document.getElementById('menuBtn').addEventListener('click', openMenuModal);

    const timerZone = document.getElementById('timerZone');
    timerZone.addEventListener('mousedown', handleTimerMouseDown);
    timerZone.addEventListener('mouseup', handleTimerMouseUp);
    timerZone.addEventListener('touchstart', handleTimerTouchStart);
    timerZone.addEventListener('touchend', handleTimerTouchEnd);

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('keyup', handleKeyUp);
}

// Timer handlers
let spacePressed = false;
let timerHoldStartTime = 0;
let timerPreparingInterval = null;

function handleTimerMouseDown() {
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
        const seconds = (AppState.timerElapsed / 1000).toFixed(3);
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
            const seconds = (AppState.timerElapsed / 1000).toFixed(3);
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
        display.textContent = '0.000';
        if (holdDuration >= requiredDuration) {
            display.classList.add('ready');
        } else {
            display.classList.add('preparing');
        }
    } else if (AppState.timerState === 'running') {
        display.className = 'timer-display';
        const seconds = (AppState.timerElapsed / 1000).toFixed(3);
        display.textContent = seconds;
    } else if (AppState.timerState === 'idle') {

        display.className = 'timer-display';
        // Show last time from session
        if (AppState.activeTrainingJSON && AppState.sessionTimes[AppState.activeTrainingJSON]) {
            const times = AppState.sessionTimes[AppState.activeTrainingJSON];
            if (times.length > 0) {
                const lastTime = times[times.length - 1].time;
                display.textContent = lastTime.toFixed(3);
            } else {
                display.textContent = '0.000';
            }
        } else {
            display.textContent = '0.000';
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
            <div class="algset-tabs">
                <button class="algset-tab active" onclick="switchAlgsetTab('default')" id="tab-default">Default</button>
                <button class="algset-tab" onclick="switchAlgsetTab('imported')" id="tab-imported">Imported</button>
            </div>
            <div class="modal-body">
                <div id="algsetContent"></div>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    renderAlgsetTab('default');

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
    renderAlgsetTab(tab);
};

function renderAlgsetTab(tab) {
    const content = document.getElementById('algsetContent');
    if (!content) return;

    if (tab === 'default') {
        const defaultAlgsets = [
            'eo.json',
            'cp.json',
            'ep.json',
            'cubeshape.json'
        ];

        content.innerHTML = `
            <div class="algset-list">
                ${defaultAlgsets.map(name => `
                    <div class="algset-item" onclick="selectDefaultAlgset('${name}')">
                        <span>${name.replace('.json', '')}</span>
                    </div>
                `).join('')}
            </div>
        `;
    } else {
        const importedAlgsets = Object.keys(AppState.trainingJSONs);
        
        content.innerHTML = `
            <div class="algset-list">
                ${importedAlgsets.length === 0 ? 
                    '<p style="color: #888; text-align: center; padding: 40px;">No imported algsets</p>' :
                    importedAlgsets.map(name => `
                        <div class="algset-item ${name === AppState.activeTrainingJSON ? 'active' : ''}" onclick="selectImportedAlgset('${name}')">
                            <span>${name}</span>
                            <button class="algset-remove-btn" onclick="event.stopPropagation(); removeAlgset('${name}')">×</button>
                        </div>
                    `).join('')
                }
            </div>
            <div style="margin-top: 16px;">
                <button class="btn btn-primary" onclick="openImportAlgsetModal()">Add Algset</button>
            </div>
        `;
    }
}

window.selectDefaultAlgset = function(fileName) {
    showFloatingMessage(`Default algset "${fileName}" placeholder - will be implemented`, 'info');
    // Will load from default-algsets/fileName later
};

window.selectImportedAlgset = function(name) {
    AppState.activeTrainingJSON = name;
    saveTrainingJSONs();
    document.querySelector('.modal').remove();
    renderApp();
    openCaseSelectionModal();
};

window.removeAlgset = function(name) {
    showConfirmationModal(
        'Remove Algset',
        `Remove algset "${name}"?`,
        () => {
            delete AppState.trainingJSONs[name];
            if (AppState.activeTrainingJSON === name) {
                AppState.activeTrainingJSON = Object.keys(AppState.trainingJSONs)[0] || null;
                AppState.selectedCases = [];
                saveSelectedCases();
            }
            saveTrainingJSONs();
            renderAlgsetTab('imported');
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
                    <textarea class="settings-input" id="importAlgsetInput" placeholder="Paste your JSON here..."
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
        AppState.trainingJSONs[name] = parsed;
        if (!AppState.activeTrainingJSON) {
            AppState.activeTrainingJSON = name;
        }
        saveTrainingJSONs();

        showFloatingMessage('Algset imported successfully!', 'success');
        setTimeout(() => {
            const modals = document.querySelectorAll('.modal');
            modals.forEach(m => m.remove());
            openAlgsetSelectorModal();
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
        <div class="modal-content">
            <div class="modal-header">
                <h2>Select Cases - ${AppState.activeTrainingJSON}</h2>
                <button class="close-btn" onclick="this.closest('.modal').remove()">×</button>
            </div>
            <div class="modal-body">
                <div class="tree-view" id="caseTree"></div>
                <div class="button-group">
                    <button class="btn btn-secondary" onclick="this.closest('.modal').remove()">Cancel</button>
                    <button class="btn btn-primary" onclick="saveCaseSelection()">Save Selection</button>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    renderCaseTree();

    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.remove();
        }
    });
}

window.switchTrainingTab = function (name) {
    AppState.activeTrainingJSON = name;
    saveTrainingJSONs();

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
    treeContainer.innerHTML = renderTreeNode(activeData, []);
}

function renderTreeNode(node, path) {
    let html = '';

    for (const [key, value] of Object.entries(node)) {
        const currentPath = [...path, key];
        const pathString = currentPath.join('.');
        const isCase = value.caseName !== undefined;
        const hasChildren = !isCase && Object.keys(value).some(k => k !== 'icon');

        if (isCase) {
            const isSelected = AppState.selectedCases.some(c => c._path === pathString);
            html += `
                        <div class="tree-node">
                            <div class="tree-node-header">
                                <span class="tree-toggle"></span>
                                <input type="checkbox" class="tree-checkbox" 
                                    ${isSelected ? 'checked' : ''} 
                                    onchange="toggleCaseSelection('${pathString}', this.checked)"
                                >
                                <span class="tree-label">${value.caseName || key}</span>
                            </div>
                        </div>
                    `;
        } else {
            html += `
                        <div class="tree-node">
                            <div class="tree-node-header" onclick="toggleTreeNode(this)">
                                <span class="tree-toggle">▶</span>
                                <span class="tree-label">${key}</span>
                            </div>
                            <div class="tree-children">
                                ${renderTreeNode(value, currentPath)}
                            </div>
                        </div>
                    `;
        }
    }

    return html;
}

window.toggleTreeNode = function (header) {
    const children = header.nextElementSibling;
    const toggle = header.querySelector('.tree-toggle');

    if (children.classList.contains('expanded')) {
        children.classList.remove('expanded');
        toggle.textContent = '▶';
    } else {
        children.classList.add('expanded');
        toggle.textContent = '▼';
    }
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
};

window.saveCaseSelection = function () {
    saveSelectedCases();
    document.querySelector('.modal').remove();
    document.getElementById('caseCount').textContent = `${AppState.selectedCases.length} case(s) selected`;
    void generateNewScramble();
};

// Settings modal
// Settings modal
// Settings modal
function openSettingsModal() {
    const modal = document.createElement('div');
    modal.className = 'modal active';
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h2>Settings</h2>
                <button class="close-btn" onclick="this.closest('.modal').remove()">×</button>
            </div>
            <div class="modal-body">
                <div class="settings-group">
                    <label class="settings-label">Theme</label>
                    <select class="settings-input" id="themeSelect" onchange="changeTheme(this.value)">
                        <option value="dark" ${AppState.settings.theme === 'dark' ? 'selected' : ''}>Dark</option>
                        <option value="light" ${AppState.settings.theme === 'light' ? 'selected' : ''}>Light</option>
                    </select>
                </div>
                <div class="settings-group">
                    <label class="settings-label">Starting Cue Duration (seconds)</label>
                    <input type="number" class="settings-input" id="cueDurationInput" 
                        min="0.0" max="0.5" step="0.05" 
                        value="${AppState.settings.startingCueDuration}" 
                        onchange="changeCueDuration(this.value)">
                    <small style="color: var(--text-tertiary); font-size: 12px; margin-top: 4px; display: block;">
                        How long to hold before timer starts (0.0 - 0.5 seconds)
                    </small>
                </div>
                <div class="button-group">
                    <button class="btn btn-secondary" onclick="this.closest('.modal').remove()">Close</button>
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
}

// Menu modal
function openMenuModal() {
    const modal = document.createElement('div');
    modal.className = 'modal active';
    modal.innerHTML = `
        <div class="modal-content" style="max-width: 300px;">
            <div class="modal-header">
                <h2>Menu</h2>
                <button class="close-btn" onclick="this.closest('.modal').remove()">×</button>
            </div>
            <div class="modal-body">
                <div class="menu-list">
                    <button class="menu-item" onclick="this.closest('.modal').remove(); openSettingsModal();">
                        Settings
                    </button>
                    <button class="menu-item" onclick="this.closest('.modal').remove(); showJsonCreatorFullscreen();">
                        Open Algset Devtool
                    </button>
                    <button class="menu-item" onclick="this.closest('.modal').remove(); openAboutModal();">
                        About
                    </button>
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
}

function openAboutModal() {
    const modal = document.createElement('div');
    modal.className = 'modal active';
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h2>About SquanGo</h2>
                <button class="close-btn" onclick="this.closest('.modal').remove()">×</button>
            </div>
            <div class="modal-body">
                <p>Placeholder for About content</p>
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
                            <textarea class="settings-input" id="importJSONInput" placeholder="Paste your JSON here..."
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
        AppState.trainingJSONs[name] = parsed;
        if (!AppState.activeTrainingJSON) {
            AppState.activeTrainingJSON = name;
        }
        saveTrainingJSONs();

        showFloatingMessage('Training JSON imported successfully!', 'success');
        setTimeout(() => {
            document.querySelector('.modal').remove();
            openSettingsModal();
        }, 500);
    } catch (error) {
        showFloatingMessage('Invalid JSON: ' + error.message, 'error');
    }
};

window.setActiveTrainingJSON = function (name) {
    AppState.activeTrainingJSON = name;
    saveTrainingJSONs();
    AppState.selectedCases = [];
    saveSelectedCases();
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
            if (AppState.activeTrainingJSON === name) {
                AppState.activeTrainingJSON = Object.keys(AppState.trainingJSONs)[0] || null;
                AppState.selectedCases = [];
                saveSelectedCases();
            }
            saveTrainingJSONs();
            document.querySelector('.modal').remove();
            openSettingsModal();
            renderApp();
        }
    );
};

// Scramble detail modal
function openScrambleDetailModal() {
    if (!AppState.currentScramble || !AppState.currentScramble.hexState) return;

    const modal = document.createElement('div');
    modal.className = 'modal active';
    modal.innerHTML = `
                <div class="modal-content" style="max-width: 900px;">
                    <div class="modal-header">
                        <h2>Scramble Details</h2>
                        <button class="close-btn" onclick="this.closest('.modal').remove()">×</button>
                    </div>
                    <div class="modal-body">
                        <div style="margin-bottom: 20px;">
                            <h3 style="color: var(--text-tertiary); font-size: 14px; margin-bottom: 8px;">Case Name</h3>
                            <div style="color: var(--text-primary); font-size: 16px;">${AppState.currentScramble.caseName || 'Unknown Case'}</div>
                        </div>
                        <div style="margin-bottom: 20px;">
                            <h3 style="color: var(--text-tertiary); font-size: 14px; margin-bottom: 8px;">Hex State</h3>
                            <div style="color: var(--text-primary); font-family: monospace; font-size: 14px;">${AppState.currentScramble.hexState}</div>
                        </div>
                        <div style="margin-bottom: 20px;">
                            <h3 style="color: var(--text-tertiary); font-size: 14px; margin-bottom: 12px;">Visualization</h3>
                            <div style="display: flex; justify-content: center; background: var(--bg-primary); padding: 20px; border-radius: 8px; border: 1px solid var(--border-color);">
                                ${generateVisualization(AppState.currentScramble.hexState)}
                            </div>
                        </div>
                        <div style="margin-bottom: 20px;">
                            <h3 style="color: var(--text-tertiary); font-size: 14px; margin-bottom: 8px;">Algorithm</h3>
                            <div style="color: var(--text-primary); font-family: monospace; font-size: 14px; background: var(--bg-primary); padding: 12px; border-radius: 6px; border: 1px solid var(--border-color);">
                                ${AppState.currentScramble.alg || 'No algorithm provided'}
                            </div>
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
}

Object.assign(window, {
    initApp,
    openSettingsModal,
    openAboutModal,
    openScrambleDetailModal
});

export {
    AppState,
    DEFAULT_ALGSET,
    initApp,
    renderApp,
    generateNewScramble,
    setupEventListeners,
    saveDevelopingJSONs,
    saveLastScreen
};

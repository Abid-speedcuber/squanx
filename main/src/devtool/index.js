import { ensureFeatureModules, ensureXlsxScript } from '../moduleLoader.js';
import { AppState, DEFAULT_ALGSET, generateNewScramble, importTrainingJSONData, renderApp, saveDevelopingJSONs, saveDevelopingRoot, saveLastScreen } from '../training.js';
import { stringifyCompactAlgset } from '../algsetCodec.js';
import {
    DEFAULT_LAYER,
    DOWN_MOVE_OPTIONS,
    MOVE_OPTIONS,
    NUMBER_OPTIONS,
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
    normalizePath,
    normalizeRoots,
    normalizeTree,
    replacePathPrefix,
    sanitizeFilename,
    splitPath
} from './model.js';
import {
    clearExpandedFolders,
    clearTemplate,
    loadExpandedFolders,
    loadLastAlgsetScript,
    loadSelection,
    loadTemplate,
    saveExpandedFolders,
    saveLastAlgsetScript,
    saveSelection,
    saveTemplate
} from './storage.js';
import { normalizeAlgorithmInput } from './parseAdapter.js';
import {
    completeAlgsetScript,
    executeAlgsetScript,
    formatScriptSummary,
    getAlgsetScriptSuggestions
} from './algsetScript.js';

const RUN_COUNT = 100;
const SQUANX_WORDMARK = '<span class="squanx-brand"><span class="squango-sq">Squan</span><span class="squango-go">X</span></span>';
const COMMAND_REFERENCE_URL = 'https://github.com/Abid-speedcuber/squanx/blob/ESmodule-build/docs/algset-script-command.md';
const SCRIPT_VALUE_PICKER_FIELDS = new Set(['top-layer', 'bottom-layer', 'parity', 'pre-abf', 'post-abf', 'rul', 'rdl', 'auf', 'adf']);
const SCRIPT_PARITY_OPTIONS = [
    ['on', 'Overall No Parity'],
    ['op', 'Overall Parity'],
    ['tnbn', 'Both Color No Parity'],
    ['tpbn', 'Black Parity, White No Parity'],
    ['tnbp', 'Black No Parity, White Parity'],
    ['tpbp', 'Both Color Parity']
];

function normalizeScriptFieldAlias(field) {
    const key = String(field || '').toLowerCase();
    const map = {
        toplayer: 'top-layer',
        'top-layer': 'top-layer',
        bottomlayer: 'bottom-layer',
        'bottom-layer': 'bottom-layer',
        preabf: 'pre-abf',
        'pre-abf': 'pre-abf',
        postabf: 'post-abf',
        'post-abf': 'post-abf',
        preauf: 'rul',
        'pre-auf': 'rul',
        preadf: 'rdl',
        'pre-adf': 'rdl',
        postauf: 'auf',
        'post-auf': 'auf',
        postadf: 'adf',
        'post-adf': 'adf'
    };
    return map[key] || key;
}

function getScriptValuePickerRequest(text, cursor) {
    const before = text.slice(0, cursor);
    const match = before.match(/\b(top-layer|topLayer|bottom-layer|bottomLayer|parity|pre-abf|preABF|post-abf|postABF|pre-auf|preAUF|pre-adf|preADF|post-auf|postAUF|post-adf|postADF|rul|rdl|auf|adf)\s*=\s*(\[[^\]]*$|[^\s.,&]*)$/i);
    if (!match) return null;
    const field = normalizeScriptFieldAlias(match[1]);
    if (!SCRIPT_VALUE_PICKER_FIELDS.has(field)) return null;
    const value = match[2] || '';
    return {
        field,
        value,
        valueStart: cursor - value.length,
        valueEnd: cursor
    };
}

function parseScriptPickerList(value) {
    const text = String(value || '').trim();
    if (!text) return [];
    const inner = text.startsWith('[') && text.endsWith(']') ? text.slice(1, -1) : text;
    return inner.split(',').map((item) => item.trim().replace(/^['"]|['"]$/g, '')).filter(Boolean);
}

function formatScriptPickerList(values) {
    return `[${values.join(',')}]`;
}

function faceMoveToNumber(move) {
    const value = String(move || '').trim();
    if (!value || value.endsWith('0')) return '0';
    if (value.endsWith('2')) return '2';
    if (value.endsWith("'")) return '-1';
    return '1';
}

function equatorLabel(equator) {
    if (equator === '/') return 'Flipped';
    if (equator === '|') return 'Solved';
    return equator || '-';
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

function showFloatingMessage(message, type = 'info', duration = 3000) {
    const existing = document.querySelector('.floating-message');
    if (existing) existing.remove();

    const msg = document.createElement('div');
    msg.className = `floating-message ${type} devtool-theme`;
    msg.textContent = message;
    document.body.appendChild(msg);

    setTimeout(() => {
        msg.style.animation = 'slideDown 0.3s ease-out reverse';
        setTimeout(() => msg.remove(), 300);
    }, duration);
}

function downloadJSON(filename, data) {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${sanitizeFilename(filename)}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
}

function downloadTextJSON(filename, text) {
    const blob = new Blob([text], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${sanitizeFilename(filename)}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
}

function readFileAsText(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (event) => resolve(String(event.target?.result || ''));
        reader.onerror = () => reject(reader.error || new Error('Failed to read file'));
        reader.readAsText(file);
    });
}

function getStoredActiveDevelopingRoot() {
    try {
        return localStorage.getItem('sq1ActiveDevelopingJSON') || '';
    } catch {
        return '';
    }
}

function getScriptCompletionSuffix(text, cursor, suggestions) {
    if (!isScriptAutocompleteContext(text, cursor)) return '';
    const before = text.slice(0, cursor);
    const prefix = before.match(/[a-z0-9_./"-]*$/i)?.[0] || '';
    const suggestion = suggestions.find((item) => item.toLowerCase().startsWith(prefix.toLowerCase()));
    if (!suggestion || !prefix || suggestion.length <= prefix.length) return '';
    return suggestion.slice(prefix.length);
}

function isScriptAutocompleteContext(text, cursor) {
    if (cursor < text.length) return false;
    const before = text.slice(0, cursor);
    const quoteMatches = before.match(/(?<!\\)["']/g) || [];
    if (quoteMatches.length % 2 === 1) return false;
    const currentToken = before.match(/[^\s.,&]*$/)?.[0] || '';
    if (currentToken.includes('=')) return false;
    const currentSegment = before.split(/[.,&\n]/).at(-1) || '';
    if (/\b[a-z-]+\s*=\s*\S*$/i.test(currentSegment)) return false;
    return true;
}

function highlightAlgsetScript(text, cursor = text.length, completion = '') {
    const cursorMarker = '\uE000';
    const flowKeywords = new Set(['if', 'where', 'and', 'from', 'with', 'to', 'then']);
    const scopeKeywords = new Set(['in', 'here', 'root', 'selected', 'template', 'children', 'descendants']);
    const executeCommands = new Set(['append', 'set', 'add', 'remove', 'replace', 'rename', 'copy']);
    const createDeleteCommands = new Set(['create', 'delete']);
    const targetTypes = new Set(['case-name', 'folder-name', 'path']);
    const targetMethods = new Set(['is', 'contains', 'starts-with', 'ends-with', 'matches', 'has', 'split', 'left', 'right']);
    const fields = new Set(['top-layer', 'toplayer', 'bottom-layer', 'bottomlayer', 'alg', 'parity', 'constraints', 'pre-abf', 'preabf', 'post-abf', 'postabf', 'pre-auf', 'preauf', 'pre-adf', 'preadf', 'post-auf', 'postauf', 'post-adf', 'postadf', 'rul', 'rdl', 'auf', 'adf']);
    const source = `${text.slice(0, cursor)}${cursorMarker}${text.slice(cursor)}`;
    const tokens = source.match(/\uE000|"(?:\\.|[^"])*"|'(?:\\.|[^'])*'|\[[^\]]*\]|\{[^}]*\}|[a-zA-Z][a-zA-Z-]*|-?\d+|[=.,&]|\s+|./g) || [];
    return tokens.map((token) => {
        if (token === cursorMarker) return completion ? `<span class="script-ghost">${escapeHtml(completion)}</span>` : '';
        if (token.includes(cursorMarker)) token = token.replaceAll(cursorMarker, '');
        if (!token) return '';
        if (/^\s+$/.test(token)) return escapeHtml(token);
        const lower = token.toLowerCase();
        if (/^["']/.test(token)) return `<span class="script-string">${escapeHtml(token)}</span>`;
        if (/^\[/.test(token) || /^\{/.test(token)) return `<span class="script-list">${escapeHtml(token)}</span>`;
        if (targetTypes.has(lower)) return `<span class="script-target">${escapeHtml(token)}</span>`;
        if (targetMethods.has(lower)) return `<span class="script-method">${escapeHtml(token)}</span>`;
        if (executeCommands.has(lower)) return `<span class="script-command">${escapeHtml(token)}</span>`;
        if (createDeleteCommands.has(lower)) return `<span class="script-create-delete">${escapeHtml(token)}</span>`;
        if (fields.has(lower)) return `<span class="script-field">${escapeHtml(token)}</span>`;
        if (scopeKeywords.has(lower)) return `<span class="script-scope">${escapeHtml(token)}</span>`;
        if (flowKeywords.has(lower)) return `<span class="script-keyword">${escapeHtml(token)}</span>`;
        if (/^-?\d+$/.test(token)) return `<span class="script-number">${escapeHtml(token)}</span>`;
        if (/^[=.,&]$/.test(token)) return `<span class="script-punct">${escapeHtml(token)}</span>`;
        return escapeHtml(token);
    }).join('');
}

class JSONCreator {
    constructor() {
        this.root = null;
        this.abortController = null;
        this.shapeRenderPromise = null;
        this.state = {
            activeRoot: 'default',
            tree: {},
            selectedPath: '',
            editorPath: '',
            renamingPath: '',
            renamingValue: '',
            newItemRenamePath: '',
            renamingRoot: '',
            renamingRootValue: '',
            newRootRename: '',
            shapeValueEdit: null,
            expandedFolders: new Set(),
            editor: { type: 'welcome', tab: 'shape' },
            clipboard: null,
            caseTemplate: null,
            templateDraft: null,
            sidebarHidden: false,
            algorithm: {
                text: '',
                tempHex: null
            },
            modal: null,
            contextMenu: null,
            run: null
        };
    }

    show() {
        saveLastScreen('jsonCreator');
        document.getElementById('jsonCreatorFullscreen')?.remove();
        AppState.developingJSONs = normalizeRoots(AppState.developingJSONs, DEFAULT_ALGSET);
        const savedRoot = getStoredActiveDevelopingRoot() || loadSelection().root;
        if (savedRoot && AppState.developingJSONs[savedRoot]) AppState.activeDevelopingJSON = savedRoot;
        if (!AppState.activeDevelopingJSON || !AppState.developingJSONs[AppState.activeDevelopingJSON]) {
            AppState.activeDevelopingJSON = Object.keys(AppState.developingJSONs)[0] || 'default';
        }

        this.state.activeRoot = AppState.activeDevelopingJSON;
        this.state.tree = clone(AppState.developingJSONs[this.state.activeRoot] || {});
        this.state.caseTemplate = loadTemplate(this.state.activeRoot);
        this.state.expandedFolders = this.loadExpandedFolderState(this.state.activeRoot, this.state.tree);
        this.restoreSelection();
        this.mount();
        this.render();
    }

    mount() {
        this.root = document.createElement('div');
        this.root.className = 'json-creator-fullscreen';
        this.root.id = 'jsonCreatorFullscreen';
        document.body.appendChild(this.root);
        this.abortController = new AbortController();
        const options = { signal: this.abortController.signal };
        this.root.addEventListener('click', (event) => this.handleClick(event), options);
        this.root.addEventListener('dblclick', (event) => this.handleDoubleClick(event), options);
        this.root.addEventListener('contextmenu', (event) => this.handleContextMenu(event), options);
        this.root.addEventListener('input', (event) => this.handleInput(event), options);
        this.root.addEventListener('change', (event) => this.handleChange(event), options);
        this.root.addEventListener('dragover', (event) => this.handleDragOver(event), options);
        this.root.addEventListener('drop', (event) => this.handleDrop(event), options);
        this.root.addEventListener('keydown', (event) => this.handleRootKeydown(event), options);
        this.root.addEventListener('keyup', (event) => this.handleRootKeyup(event), options);
        this.root.addEventListener('focusout', (event) => this.handleFocusOut(event), options);
        this.root.addEventListener('scroll', () => this.closeInfoBoxes(), { ...options, capture: true });
        document.addEventListener('keydown', (event) => this.handleDocumentKeydown(event), options);
    }

    restoreSelection() {
        const selection = loadSelection();
        if (selection.root === this.state.activeRoot && selection.path && getNode(this.state.tree, selection.path)) {
            const normalizedSelectionPath = normalizePath(selection.path);
            this.state.selectedPath = normalizedSelectionPath;
            saveSelection(this.state.activeRoot, normalizedSelectionPath);
            const selected = getNode(this.state.tree, normalizedSelectionPath);
            if (isCase(selected)) {
                this.state.editorPath = normalizedSelectionPath;
                this.state.editor = { type: 'case', tab: 'shape' };
            } else {
                const firstCase = findFirstCase(this.state.tree);
                if (firstCase) {
                    this.state.editorPath = firstCase.path;
                    this.state.editor = { type: 'case', tab: 'shape' };
                }
            }
            return;
        }

        const firstCase = findFirstCase(this.state.tree);
        if (firstCase) {
            this.state.selectedPath = firstCase.path;
            this.state.editorPath = firstCase.path;
            saveSelection(this.state.activeRoot, firstCase.path);
            this.state.editor = { type: 'case', tab: 'shape' };
        }
        else this.setEditor('welcome');
    }

    persistRoot() {
        if (!this.state.activeRoot) return;
        AppState.developingJSONs[this.state.activeRoot] = this.state.tree;
        this.saveExpandedFolderState();
        saveDevelopingRoot(this.state.activeRoot, this.state.tree);
    }

    loadExpandedFolderState(rootName, tree) {
        const validFolders = new Set(collectFolders(tree).map((folder) => folder.path));
        const stored = loadExpandedFolders(rootName);
        if (Array.isArray(stored)) return new Set(stored.filter((path) => validFolders.has(path)));
        return new Set(validFolders);
    }

    pruneExpandedFolderState() {
        const validFolders = new Set(collectFolders(this.state.tree).map((folder) => folder.path));
        this.state.expandedFolders = new Set([...this.state.expandedFolders].filter((path) => validFolders.has(path)));
    }

    saveExpandedFolderState() {
        if (!this.state.activeRoot) return;
        this.pruneExpandedFolderState();
        saveExpandedFolders(this.state.activeRoot, [...this.state.expandedFolders]);
    }

    render() {
        if (!this.root) return;
        const runBodyScrollTop = this.root.querySelector('.run-modal-body')?.scrollTop ?? 0;
        const treeScrollTop = this.root.querySelector('#jsonCreatorTree')?.scrollTop ?? 0;
        if (this.state.run && runBodyScrollTop) this.state.run.scrollTop = runBodyScrollTop;
        this.root.innerHTML = `
            ${this.renderTopbar()}
            <div class="json-creator-main">
                ${this.renderSidebar()}
                <div class="json-creator-content">
                    ${this.renderEditorHeader()}
                    <div class="json-creator-content-body" id="jsonCreatorBody">${this.renderEditorBody()}</div>
                </div>
            </div>
            ${this.renderContextMenu()}
            ${this.renderModal()}
            ${this.renderRunModal()}
        `;
        this.afterRender({ runBodyScrollTop, treeScrollTop });
    }

    renderTopbar() {
        const themeIcon = AppState.settings.theme === 'dark'
            ? '<path d="M12 3v2"/><path d="M12 19v2"/><path d="M4.22 4.22l1.42 1.42"/><path d="M18.36 18.36l1.42 1.42"/><path d="M3 12h2"/><path d="M19 12h2"/><path d="M4.22 19.78l1.42-1.42"/><path d="M18.36 5.64l1.42-1.42"/><circle cx="12" cy="12" r="4"/>'
            : '<path d="M21 12.79A8.5 8.5 0 1 1 11.21 3 6.5 6.5 0 0 0 21 12.79z"/>';
        return `
            <div class="json-creator-topbar">
                <div style="display:flex;align-items:center;gap:12px;">
                    <button class="json-creator-icon-btn" data-action="toggle-sidebar" title="Toggle Sidebar"><img src="viz/hamburger-menu.svg" width="16" height="16" alt=""></button>
                    <div style="display:flex;flex-direction:column;line-height:1.2;">
                        <span style="font-size:18px;">${SQUANX_WORDMARK}</span>
                        <span style="font-size:11px;color:var(--devtool-muted,#666);">Algset Devtool</span>
                    </div>
                </div>
                <div style="display:flex;align-items:center;gap:8px;margin-left:auto;">
                    <button class="json-creator-icon-btn" data-action="toggle-theme" title="Toggle Theme"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${themeIcon}</svg></button>
                    <button class="json-creator-icon-btn" data-action="open-data-management" title="Data Management"><img src="viz/data.svg" width="16" height="16" alt=""></button>
                    <button class="json-creator-icon-btn" data-action="extract-json" title="Extract JSON"><img src="viz/extract.svg" width="16" height="16" alt=""></button>
                    <button class="json-creator-icon-btn" data-action="run-root" title="Run"><img src="viz/run.svg" width="16" height="16" alt=""></button>
                    <button class="json-creator-icon-btn" data-action="open-devtool-help" title="Help"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.7 2.7 0 0 1 5.1 1.3c0 1.8-1.5 2.4-2.3 3-.5.4-.6.8-.6 1.4"/><path d="M12 18h.01"/></svg></button>
                    <button class="json-creator-icon-btn" data-action="close" title="Quit"><img src="viz/exit.svg" width="16" height="16" alt=""></button>
                </div>
            </div>
        `;
    }

    renderSidebar() {
        return `
            <div class="json-creator-sidebar ${this.state.sidebarHidden ? 'hidden' : ''}" id="jsonCreatorSidebar">
                <div class="json-creator-toolbar">
                    <button class="json-creator-toolbar-btn" data-action="new-case" title="New Case"><img src="viz/new-case.svg" width="18" height="18" alt=""></button>
                    <button class="json-creator-toolbar-btn" data-action="new-folder" title="New Folder"><img src="viz/new-folder.svg" width="18" height="18" alt=""></button>
                    <button class="json-creator-toolbar-btn" data-action="copy" title="Copy"><img src="viz/copy.svg" width="18" height="18" alt=""></button>
                    <button class="json-creator-toolbar-btn" data-action="paste" title="Paste"><img src="viz/paste.svg" width="18" height="18" alt=""></button>
                    <button class="json-creator-toolbar-btn" data-action="delete" title="Delete"><img src="viz/delete.svg" width="18" height="18" alt=""></button>
                    <button class="json-creator-toolbar-btn" data-action="open-extra-tools" title="Extra Tools"><img src="viz/extra-tools.svg" width="18" height="18" alt=""></button>
                </div>
                <button id="rootSelectorBtn" class="json-creator-root-btn" data-action="open-root-selector">Root: ${escapeHtml(this.state.activeRoot)} <span aria-hidden="true">▾</span></button>
                <div class="json-creator-tree" id="jsonCreatorTree">${this.renderTreeNode(this.state.tree, '', 0)}</div>
            </div>
        `;
    }

    renderTreeNode(node, path, level) {
        return Object.entries(node)
            .filter(([, item]) => isFolder(item) || isCase(item))
            .map(([key, item]) => {
                const currentPath = childPath(path, key);
                const folder = isFolder(item);
                const expanded = this.state.expandedFolders.has(currentPath);
                const selected = this.state.selectedPath === currentPath ? 'selected' : '';
                const renaming = this.state.renamingPath === currentPath;
                const expander = folder ? (expanded ? '▾' : '▸') : '';
                const childMarkup = folder && expanded ? this.renderTreeNode(item, currentPath, level + 1) : '';
                const stickyOffset = level * 23;
                const row = `
                    <div class="json-creator-tree-item ${selected} ${renaming ? 'editing' : ''}" data-path="${escapeHtml(currentPath)}" data-kind="${folder ? 'folder' : 'case'}" data-action="select-tree-item" style="--tree-depth:${level};--sticky-offset:${stickyOffset}px;--sticky-z:${100 - level};padding-left:${8 + level * 16}px">
                        <span class="tree-expand-icon" data-action="toggle-folder" data-path="${escapeHtml(currentPath)}">${expander}</span>
                        <img class="tree-icon" src="viz/${folder ? 'folder' : 'case'}.svg" width="14" height="14" alt="">
                        ${renaming ? `<input id="treeRenameInput" class="tree-item-input" data-action="tree-rename-input" value="${escapeHtml(this.state.renamingValue || key)}" spellcheck="false">` : `<span class="tree-item-text">${escapeHtml(key)}</span>`}
                    </div>
                `;
                if (!folder) return row;
                return `<div class="json-creator-tree-folder-block" data-folder-path="${escapeHtml(currentPath)}">${row}${childMarkup}</div>`;
            })
            .join('');
    }

    renderEditorHeader() {
        const selected = this.getEditorCase();
        let title = SQUANX_WORDMARK;
        let subtitle = 'Case Editor';
        if (this.state.editor.type === 'case' && isCase(selected)) {
            const name = selected.caseName || getPathName(this.state.editorPath);
            title = `Case: ${escapeHtml(name)} <button class="json-creator-icon-btn" data-action="run-case" title="Run This Case" style="margin-left:8px;display:inline-flex;vertical-align:middle;"><img src="viz/run.svg" width="14" height="14" alt=""></button><button class="json-creator-icon-btn" data-action="reset-case" title="Reset Case to Template" style="margin-left:4px;display:inline-flex;vertical-align:middle;"><img src="viz/reset.svg" width="14" height="14" alt=""></button>`;
            subtitle = '';
        } else if (this.state.editor.type === 'template') {
            title = 'Case Template';
            subtitle = 'Any new case from now on will be pre-configured according to this case template.';
        }

        return `
            <div class="json-creator-content-header">
                <div class="json-creator-title-block">
                    <h3 id="jsonCreatorTitle">${title}</h3>
                    <p id="jsonCreatorSubtitle">${subtitle}</p>
                </div>
            </div>
        `;
    }

    renderEditorBody() {
        if (this.state.editor.type === 'template') return this.renderTemplateEditor();
        const selected = this.getEditorCase();
        if (this.state.editor.type === 'case' && isCase(selected)) return this.renderCaseEditor(selected);
        return `
            <div class="json-creator-welcome">
                <h3>Welcome to ${SQUANX_WORDMARK}</h3>
                <p>Create and organize your Square-1 algset cases.</p>
                <p>Use the toolbar to add folders and cases.</p>
            </div>
        `;
    }

    renderCaseEditor(item) {
        return `
            <div class="case-editor-tabs">
                <button class="case-editor-tab ${this.state.editor.tab === 'shape' ? 'active' : ''}" data-action="case-tab" data-tab="shape">Shape Input</button>
                <button class="case-editor-tab ${this.state.editor.tab === 'additional' ? 'active' : ''}" data-action="case-tab" data-tab="additional">Additional Information</button>
            </div>
            <div id="caseEditorContent">${this.state.editor.tab === 'shape' ? this.renderShapeTab(item, false) : this.renderAdditionalTab(item, false)}</div>
        `;
    }

    renderTemplateEditor() {
        const draft = this.state.templateDraft || createTemplateDraft(this.state.caseTemplate);
        return `
            <div class="template-editor-frame">
                <div class="template-editor-main">
                    <h2>Case Template</h2>
                    <div class="case-editor-tabs">
                        <button class="case-editor-tab ${this.state.editor.tab === 'shape' ? 'active' : ''}" data-action="template-tab" data-tab="shape">Shape Input</button>
                        <button class="case-editor-tab ${this.state.editor.tab === 'additional' ? 'active' : ''}" data-action="template-tab" data-tab="additional">Additional Information</button>
                    </div>
                    <div id="templateEditorContent">${this.state.editor.tab === 'shape' ? this.renderShapeTab(draft, true) : this.renderAdditionalTab(draft, true)}</div>
                </div>
                <div class="template-editor-actions">
                    <button class="json-creator-btn json-creator-btn-secondary" data-action="clear-template"><img src="viz/reset.svg" width="14" height="14" alt=""> Reset Template</button>
                    <button class="json-creator-btn" data-action="save-template"><img src="viz/save.svg" width="14" height="14" alt=""> Save Template</button>
                </div>
            </div>
        `;
    }

    renderShapeTab(item, template) {
        const prefix = template ? 'template' : 'case';
        return `
            ${template ? '' : this.renderAlgorithmInput()}
            <div class="shape-layer-grid">
                ${this.renderLayerInput('top', item.inputTop || DEFAULT_LAYER, prefix)}
                ${this.renderLayerInput('bottom', item.inputBottom || DEFAULT_LAYER, prefix)}
            </div>
            <div class="json-creator-section">
                <div class="constraints-panel">
                    <div class="constraints-header">
                        <h4>Constraints <button class="json-creator-icon-btn info-btn" type="button" style="display:inline-flex;padding:1px 6px;">i</button><span class="info-box">Limit which pieces are allowed at specific positions.</span></h4>
                    </div>
                    ${this.renderConstraints(item.constraints || {})}
                    <div class="constraints-form">
                        <label class="constraint-field">
                            <span>Position</span>
                            <input id="constraintPosition" placeholder="A, BC, D">
                        </label>
                        <label class="constraint-field">
                            <span>Allowed pieces</span>
                            <input id="constraintValues" placeholder="1, 3, 5, 7">
                        </label>
                        <button class="json-creator-btn constraint-add-btn" data-action="add-constraint" data-prefix="${prefix}">Add Constraint</button>
                    </div>
                </div>
            </div>
        `;
    }

    renderLayerInput(layer, value, prefix) {
        const title = layer === 'top' ? 'Top layer' : 'Bottom layer';
        const layerValue = value || DEFAULT_LAYER;
        const editing = this.state.shapeValueEdit?.layer === layer;
        const editingValue = editing ? this.state.shapeValueEdit.value : layerValue;
        return `
            <div class="json-creator-section shape-layer-card">
                <h4>${title}</h4>
                <input id="${layer}LayerInput" class="shape-layer-input" data-layer="${layer}" data-prefix="${prefix}" maxlength="12" value="${escapeHtml(layerValue)}" spellcheck="false">
                <button class="json-creator-icon-btn reset-layer-btn" data-action="reset-layer" data-layer="${layer}" title="Reset ${title}"><img src="viz/reset.svg" width="14" height="14" alt=""></button>
                <div id="${layer}Interactive" class="shape-renderer" data-layer="${layer}" style="display:flex;justify-content:center;margin-top:12px;min-height:210px;"></div>
                <div class="shape-layer-code-wrap">
                    ${editing
                        ? `<input id="shapeValueEditInput" class="shape-layer-code-input ${this.state.shapeValueEdit.invalid ? 'invalid' : ''}" data-action="shape-code-input" data-layer="${layer}" data-prefix="${prefix}" maxlength="12" value="${escapeHtml(editingValue)}" spellcheck="false">`
                        : `<button class="shape-layer-code" data-action="copy-shape-value" data-layer="${layer}" data-prefix="${prefix}" title="Click to copy. Shift-click to edit.">${escapeHtml(layerValue)}</button>`}
                </div>
            </div>
        `;
    }

    renderAlgorithmInput() {
        return `
            <div class="algorithm-input-bar">
                <input id="algorithmTextInput" class="algorithm-text-input" data-action="algorithm-input" placeholder="Input algorithm text" value="${escapeHtml(this.state.algorithm.text)}">
                <button class="algorithm-apply-btn" data-action="apply-algorithm" title="Apply this algorithm">Apply</button>
                <button class="algorithm-apply-btn" data-action="apply-append-algorithm" title="Apply this algorithm and append it to the algorithm field in the additional information tab">Apply & Append</button>
            </div>
        `;
    }

    renderAdditionalTab(item, template) {
        const prefix = template ? 'template' : 'case';
        const parityMode = this.getParityMode(item);
        return `
            <div class="json-creator-section-compact">
                <h4>Middle Layer</h4>
                <div class="json-creator-grid">
                    ${this.renderCheckbox(prefix, 'equator', '|', item.equator?.includes('|'), 'string', 'Solved')}
                    ${this.renderCheckbox(prefix, 'equator', '/', item.equator?.includes('/'), 'string', 'Flipped')}
                </div>
            </div>
            <div class="json-creator-section-compact">
                <h4>Parity <button class="json-creator-icon-btn info-btn" type="button" style="display:inline-flex;padding:1px 6px;">i</button><span class="info-box">Overall parity defines a Square-1 state, but may not be the state you are aiming for. Color specific parity decides explicit color-piece arrangements.</span></h4>
                <div class="parity-radio-group">
                    ${['ignore', 'overall', 'color-specific'].map((mode) => `
                        <label class="json-creator-grid-item"><input type="radio" name="${prefix}ParityMode" data-action="parity-mode" data-prefix="${prefix}" value="${mode}" ${parityMode === mode ? 'checked' : ''}> ${mode === 'color-specific' ? 'Color Specific' : mode[0].toUpperCase() + mode.slice(1)}</label>
                    `).join('')}
                </div>
                <div class="parity-checkboxes-vertical">
                    ${this.renderParityOptions(prefix, item, parityMode)}
                </div>
            </div>
            <div class="json-creator-section-compact">
                <h4>Post ABF <button class="json-creator-icon-btn info-btn" type="button" style="display:inline-flex;padding:1px 6px;">i</button><span class="info-box">Post ABF is Adjustment of Both Face after the algorithm is done.</span></h4>
                <div class="abf-grid">
                    ${MOVE_OPTIONS.map((value) => this.renderCheckbox(prefix, 'auf', value, item.auf?.includes(value))).join('')}
                    ${DOWN_MOVE_OPTIONS.map((value) => this.renderCheckbox(prefix, 'adf', value, item.adf?.includes(value))).join('')}
                </div>
            </div>
            <div class="json-creator-section-compact">
                <h4>Pre ABF <button class="json-creator-icon-btn info-btn" type="button" style="display:inline-flex;padding:1px 6px;">i</button><span class="info-box">Pre ABF is the adjustment you do before doing an alg.</span></h4>
                <div class="pre-abf-container">
                    <div class="pre-abf-section">
                        <h5>Pre AUF</h5>
                        <div class="pre-abf-grid">${NUMBER_OPTIONS.map((value) => this.renderCheckbox(prefix, 'rul', value, item.rul?.includes(value), 'number')).join('')}</div>
                    </div>
                    <div class="pre-abf-section">
                        <h5>Pre ADF</h5>
                        <div class="pre-abf-grid">${NUMBER_OPTIONS.map((value) => this.renderCheckbox(prefix, 'rdl', value, item.rdl?.includes(value), 'number')).join('')}</div>
                    </div>
                </div>
            </div>
            ${template ? '' : `
                <div class="json-creator-section-compact">
                    <h4>Algorithm <button class="json-creator-icon-btn info-btn" type="button" style="display:inline-flex;padding:1px 6px;">i</button><span class="info-box">This is the hint you see by pressing the light bulb in the trainer.</span></h4>
                    <textarea id="caseAlgorithm" data-field="alg" rows="4">${escapeHtml(item.alg || '')}</textarea>
                </div>
            `}
        `;
    }

    renderCheckbox(prefix, field, value, checked, type = 'string', label = value) {
        return `
            <label class="json-creator-grid-item">
                <input type="checkbox" data-prefix="${prefix}" data-field="${field}" data-value="${escapeHtml(value)}" data-value-type="${type}" ${checked ? 'checked' : ''}>
                <span>${escapeHtml(label)}</span>
            </label>
        `;
    }

    renderConstraints(constraints) {
        const entries = Object.entries(constraints);
        if (!entries.length) return '<div class="constraints-empty">No constraints set</div>';
        return `
            <div class="constraints-list">
                ${entries.map(([position, values]) => `
                    <div class="constraint-row">
                        <div class="constraint-row-main">
                            <span class="constraint-position">${escapeHtml(position)}</span>
                            <span class="constraint-values">${escapeHtml(values.join(', '))}</span>
                        </div>
                        <button class="json-creator-btn json-creator-btn-secondary constraint-remove-btn" data-action="remove-constraint" data-position="${escapeHtml(position)}">Remove</button>
                    </div>
                `).join('')}
            </div>
        `;
    }

    getParityMode(item) {
        if (!Array.isArray(item.parity) || item.parity.length === 0) return 'ignore';
        if (item.parity.some((value) => value === 'on' || value === 'op')) return 'overall';
        return 'color-specific';
    }

    renderParityOptions(prefix, item, parityMode) {
        if (parityMode === 'ignore') return '';
        const options = parityMode === 'overall'
            ? [['on', 'Overall No Parity'], ['op', 'Overall Parity']]
            : [['tnbn', 'Both Color No Parity'], ['tpbn', 'Black Parity, White No Parity'], ['tnbp', 'Black No Parity, White Parity'], ['tpbp', 'Both Color Parity']];
        return options.map(([value, label]) => this.renderCheckbox(prefix, 'parity', value, item.parity?.includes(value), 'string', label)).join('');
    }

    renderContextMenu() {
        const menu = this.state.contextMenu;
        if (!menu) return '';
        const items = this.getContextMenuItems(menu);
        return `
            <div class="context-menu" data-context-menu style="left:${menu.x}px;top:${menu.y}px;max-height:${menu.maxHeight || 'calc(100vh - 16px)'};">
                ${items.map((item) => item.separator ? '<div class="context-menu-separator"></div>' : `<div class="context-menu-item ${item.disabled ? 'disabled' : ''}" data-action="${escapeHtml(item.action)}">${escapeHtml(item.label)}</div>`).join('')}
            </div>
        `;
    }

    renderModal() {
        const modal = this.state.modal;
        if (!modal) return '';
        if (modal.type === 'confirm') return this.renderConfirmModal(modal);
        if (modal.type === 'rename') return this.renderRenameModal(modal);
        if (modal.type === 'root-selector') return this.renderRootSelector();
        if (modal.type === 'extract') return this.renderExtractModal();
        if (modal.type === 'file-import') return this.renderFileImportModal(modal);
        if (modal.type === 'bulk-import') return this.renderBulkImportModal();
        if (modal.type === 'data-management') return this.renderDataManagementModal();
        if (modal.type === 'devtool-help') return this.renderDevtoolHelpModal();
        if (modal.type === 'algset-script') return this.renderAlgsetScriptModal(modal);
        return '';
    }

    renderConfirmModal(modal) {
        return `
            <div class="modal active confirmation-modal" data-action="modal-backdrop">
                <div class="modal-content devtool-modal">
                    <div class="modal-header"><h2>${escapeHtml(modal.title)}</h2></div>
                    <div class="modal-body">
                        <p>${escapeHtml(modal.message)}</p>
                        <div class="button-group">
                            <button class="btn btn-secondary" data-action="modal-cancel">Cancel</button>
                            <button class="btn btn-primary" data-action="modal-confirm">OK</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    renderRenameModal(modal) {
        return `
            <div class="modal active confirmation-modal" data-action="modal-backdrop">
                <div class="modal-content devtool-modal">
                    <div class="modal-header"><h2>${escapeHtml(modal.title)}</h2></div>
                    <div class="modal-body">
                        <input id="renameInput" class="rename-modal-input" value="${escapeHtml(modal.value || '')}">
                        <div class="button-group">
                            <button class="btn btn-secondary" data-action="modal-cancel">Cancel</button>
                            <button class="btn btn-primary" data-action="rename-confirm">OK</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    renderRootSelector() {
        const names = Object.keys(AppState.developingJSONs);
        return `
            <div class="root-selector-backdrop" data-action="root-selector-backdrop"></div>
            <div class="root-selector-modal">
                <div id="rootList" class="root-list">
                    ${names.map((root) => {
                        const renaming = this.state.renamingRoot === root;
                        return `
                            <div class="root-list-item ${root === this.state.activeRoot ? 'active' : ''} ${renaming ? 'editing' : ''}" data-action="select-root" data-root="${escapeHtml(root)}">
                                ${renaming
                                    ? `<input id="rootRenameInput" class="root-item-input" data-action="root-rename-input" value="${escapeHtml(this.state.renamingRootValue || root)}" spellcheck="false">`
                                    : `<span class="root-item-text">${escapeHtml(root)}</span>`}
                            </div>
                        `;
                    }).join('')}
                </div>
                <div class="root-selector-footer"><button class="json-creator-btn" data-action="add-root">New Root</button></div>
            </div>
        `;
    }

    renderExtractModal() {
        const jsonText = this.getExtractedJSONText();
        return `
            <div class="modal active extract-json-modal" data-action="modal-backdrop">
                <div class="modal-content extract-json-content">
                    <div class="modal-header"><h2>Extract JSON: ${escapeHtml(this.state.activeRoot)}</h2><button class="close-btn" data-action="modal-cancel">×</button></div>
                    <div class="modal-body extract-json-body">
                        <textarea id="extractedJSON" readonly style="width:100%;height:55vh;font-family:monospace;">${escapeHtml(jsonText)}</textarea>
                        <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:12px;">
                            <button class="json-creator-btn json-creator-btn-secondary" data-action="copy-extracted-json">Copy</button>
                            <button class="json-creator-btn" data-action="train-extracted-json">Train</button>
                            <button class="json-creator-btn" data-action="download-root-json">Download</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    renderFileImportModal(modal) {
        return `
            <div class="modal active extract-json-modal" data-action="modal-backdrop">
                <div class="modal-content devtool-modal import-devtool-content">
                    <div class="modal-header"><h2>${escapeHtml(modal.title)}</h2><button class="close-btn" data-action="modal-cancel">×</button></div>
                    <div class="modal-body">
                        <label class="devtool-file-drop" data-file-target="jsonImportFile">
                            <span class="devtool-file-drop-title">Drop JSON here</span>
                            <span class="devtool-file-drop-subtitle">or choose a file</span>
                            <span class="devtool-file-name" data-file-name-for="jsonImportFile">No file selected</span>
                            <input type="file" id="jsonImportFile" accept=".json,application/json">
                        </label>
                        <div style="display:flex;gap:8px;margin-top:16px;">
                            <button class="json-creator-btn" data-action="process-file-import" data-mode="add">Merge/Add</button>
                            <button class="json-creator-btn json-creator-btn-secondary" data-action="process-file-import" data-mode="override">Override</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    renderBulkImportModal() {
        return `
            <div class="modal active extract-json-modal" data-action="modal-backdrop">
                <div class="modal-content devtool-modal import-devtool-content">
                    <div class="modal-header"><h2>Bulk Import</h2><button class="close-btn" data-action="modal-cancel">×</button></div>
                    <div class="modal-body">
                        <p>First column: case name. Second column: input algorithm. Third column: optional hint algorithm. Normal notation, karnotation, and shorthand are accepted automatically.</p>
                        <label class="devtool-file-drop" data-file-target="bulkImportFile">
                            <span class="devtool-file-drop-title">Drop CSV/XLSX here</span>
                            <span class="devtool-file-drop-subtitle">or choose a file</span>
                            <span class="devtool-file-name" data-file-name-for="bulkImportFile">No file selected</span>
                            <input type="file" id="bulkImportFile" accept=".csv,.xlsx">
                        </label>
                        <button class="json-creator-btn" data-action="process-bulk-import" style="margin-top:16px;width:100%;">Import</button>
                    </div>
                </div>
            </div>
        `;
    }

    renderDataManagementModal() {
        return `
            <div class="modal active data-management-modal" data-action="modal-backdrop">
                <div class="modal-content devtool-modal">
                    <div class="modal-header"><h2>Data Management</h2><button class="close-btn" data-action="modal-cancel">×</button></div>
                    <div class="modal-body" style="display:flex;flex-direction:column;gap:12px;">
                        <button class="json-creator-btn" data-action="export-all-data">Export All Data</button>
                        <button class="json-creator-btn" data-action="open-general-import">Import Data</button>
                        <button class="json-creator-btn json-creator-btn-secondary" data-action="reset-all-data">Reset All Data</button>
                    </div>
                </div>
            </div>
        `;
    }

    renderDevtoolHelpModal() {
        return `
            <div class="modal active extract-json-modal" data-action="modal-backdrop">
                <div class="modal-content devtool-modal devtool-help-content">
                    <div class="modal-header"><h2>SquanX Algset Devtool Help</h2><button class="close-btn" data-action="modal-cancel">×</button></div>
                    <div class="modal-body help-content">
                        <section class="help-section">
                            <h3>Roots</h3>
                            <p>A root is one complete algset workspace. If you are building EOCP, PLL+1, and PBL, each of those can live as a separate root. The active root name is shown above the tree.</p>
                            <ul>
                                <li>Click the Root button to switch roots or create a new root.</li>
                                <li>Right-click a root in the root dropdown to rename, export, reset, or delete it.</li>
                                <li>Deleting the last root automatically creates a fresh default root, so the devtool is never left rootless.</li>
                                <li>Switching roots loads that root's saved tree, selection, template, and folder expansion state.</li>
                            </ul>
                        </section>
                        <section class="help-section">
                            <h3>Tree Editing</h3>
                            <p>The left tree is folders and cases. Creating inside a selected folder puts the new item inside that folder. Creating while a case is selected puts the new item beside that case.</p>
                            <ul>
                                <li>Toolbar: New Case, New Folder, Copy, Paste, Delete, and Extra Tools.</li>
                                <li>Right-click the root area, a folder, or a case to open the context menu for the item under the pointer.</li>
                                <li>Double-click the text of an item to rename it. Folder and case icons are safe to click without entering rename.</li>
                                <li>During rename, Enter saves, Escape cancels, and clicking away accepts. If the item was just created, Escape removes it again.</li>
                                <li>Move Up and Move Down are in the case/folder context menu.</li>
                                <li>Delete asks for confirmation. For batch deletes, use script commands.</li>
                            </ul>
                        </section>
                        <section class="help-section">
                            <h3>Keyboard Shortcuts</h3>
                            <ul>
                                <li><kbd>n</kbd>: create a new folder when no input, modal, context menu, or run is active.</li>
                                <li><kbd>=</kbd>: create a new case under the current folder or beside the current case.</li>
                                <li><kbd>Delete</kbd>: delete the case currently open in the editor, or the selected tree item if no case editor is active.</li>
                                <li><kbd>Ctrl/Cmd+C</kbd>: copy the selected tree item to the app clipboard.</li>
                                <li><kbd>Ctrl/Cmd+V</kbd>: paste the app clipboard. If the app clipboard is empty, SquanX tries to read JSON from the system clipboard.</li>
                                <li><kbd>Ctrl/Cmd+N</kbd>: create a new case.</li>
                                <li><kbd>Ctrl/Cmd+Shift+N</kbd>: create a new folder.</li>
                                <li><kbd>Escape</kbd>: close the current context menu or modal.</li>
                                <li>Algorithm input: <kbd>Enter</kbd> applies the algorithm; <kbd>Shift+Enter</kbd> applies it and appends it to the algorithm hint.</li>
                                <li>Script editor: <kbd>Tab</kbd> accepts inline autocomplete or opens value pickers after fields like <code>top-layer=</code>; <kbd>Ctrl/Cmd+Enter</kbd> runs the script.</li>
                            </ul>
                        </section>
                        <section class="help-section">
                            <h3>Copy And Paste</h3>
                            <p>There are two paste paths. The normal Copy/Paste toolbar and <kbd>Ctrl/Cmd+C</kbd>/<kbd>Ctrl/Cmd+V</kbd> use SquanX's internal item clipboard. Copy JSON to Clipboard writes raw JSON for the selected case or folder to the system clipboard.</p>
                            <ul>
                                <li>Copy copies the selected case or folder for use inside the current root.</li>
                                <li>Paste inserts a unique-named copy into the selected folder, or beside the selected case.</li>
                                <li>If you press <kbd>Ctrl/Cmd+V</kbd> with no internal item copied, SquanX tries to import JSON from the system clipboard.</li>
                                <li>Browser clipboard permission can affect system clipboard paste; the internal copy/paste path does not need that permission.</li>
                            </ul>
                        </section>
                        <section class="help-section">
                            <h3>Shape Input</h3>
                            <p>The two layer fields store 12-character Square-1 layer strings. Click the interactive image to cycle pieces, or right-click a slot to open the piece selector. The Algorithm input can also update the shape from a typed algorithm.</p>
                            <ul>
                                <li>Apply reads the algorithm input and updates the current shape.</li>
                                <li>Apply &amp; Append updates the shape and appends the algorithm text to the case's Algorithm field.</li>
                                <li>Reset layer buttons restore a layer to the default all-R state.</li>
                            </ul>
                        </section>
                        <section class="help-section">
                            <h3>Additional Information</h3>
                            <p>Middle layer, parity, post-ABF, pre-ABF, constraints, and Algorithm describe how trainer scrambles are generated. Algorithm supports multiple lines and appears from the trainer light bulb.</p>
                            <ul>
                                <li>Post-ABF values control final top and bottom layer adjustment after generation.</li>
                                <li>Pre-ABF values control allowed setup adjustment before generation.</li>
                                <li>Constraints limit which pieces are allowed at specific positions.</li>
                                <li>Use the info buttons in this tab for field-specific notes.</li>
                            </ul>
                        </section>
                        <section class="help-section">
                            <h3>Templates</h3>
                            <p>Case Template defines defaults for future cases. It has its own editor frame and save/reset controls so template edits are visually separate from normal case edits.</p>
                            <ul>
                                <li>New cases are created from the current template.</li>
                                <li>Right-click a case and choose Set as Template to turn an existing case into the template.</li>
                                <li>Reset Case restores a case from the current template.</li>
                            </ul>
                        </section>
                        <section class="help-section">
                            <h3>Bulk Import</h3>
                            <p>Bulk Import accepts CSV or XLSX. Column 1 is the case name. Column 2 is the input algorithm. Column 3 is the optional hint algorithm. The importer parses normal notation, karnotation, and shorthand through the same parser used by shape input.</p>
                            <ul>
                                <li>Use Bulk Import from the root or folder context menu to choose the import target.</li>
                                <li>Imported cases are created under the selected folder or root.</li>
                            </ul>
                        </section>
                        <section class="help-section">
                            <h3>Scripts</h3>
                            <p>Scripts are manually run batch edits. Open Run Script from the root or folder context menu. The script scope starts at the item where you opened it, and the last script is remembered.</p>
                            <ul>
                                <li>Fast delete example: <code>delete if case-name contains "temp" in here.</code></li>
                                <li>Delete a folder by path: <code>delete folder ["3-3", "J/J"].</code></li>
                                <li>Batch set a layer: <code>if case-name split "/" left is "Jf" in here append top-layer=W11W55Y33W77.</code></li>
                                <li>Use <a href="${COMMAND_REFERENCE_URL}" target="_blank" rel="noopener noreferrer">the full command reference</a> for targets, execute commands, create commands, delete commands, and value picker syntax.</li>
                            </ul>
                        </section>
                        <section class="help-section">
                            <h3>Running And Training</h3>
                            <p>Run validates generated cases in-place. Extract JSON opens the compact root export. Copy copies it, Download saves it, and Train imports the current root into trainer mode, selects it, selects all cases, and switches back to the trainer.</p>
                        </section>
                    </div>
                </div>
            </div>
        `;
    }

    renderAlgsetScriptModal(modal) {
        const script = modal.script || '';
        const cursor = modal.cursor ?? script.length;
        const suggestions = getAlgsetScriptSuggestions({
            tree: this.state.tree,
            text: script,
            cursor
        });
        const completion = getScriptCompletionSuffix(script, cursor, suggestions);
        const highlighted = highlightAlgsetScript(script, cursor, completion);
        return `
            <div class="modal active extract-json-modal" data-action="modal-backdrop">
                <div class="modal-content devtool-modal algset-script-modal">
                    <div class="modal-header"><h2>Run Script: ${escapeHtml(modal.scopeLabel || 'root')}</h2><button class="close-btn" data-action="modal-cancel">×</button></div>
                    <div class="modal-body algset-script-body">
                        <p class="algset-script-help"><a href="${COMMAND_REFERENCE_URL}" target="_blank" rel="noopener noreferrer">Command reference</a></p>
                        <div class="algset-script-editor">
                            <pre id="algsetScriptHighlight" class="algset-script-highlight" aria-hidden="true">${highlighted}</pre>
                            <textarea id="algsetScriptInput" class="algset-script-input" data-action="algset-script-input" spellcheck="false" placeholder="if case-name contains &quot;Jf/&quot; in here append top-layer=W11W55Y33W77.">${escapeHtml(script)}</textarea>
                        </div>
                        <div class="algset-script-actions">
                            <button class="json-creator-btn json-creator-btn-secondary" data-action="modal-cancel">Close</button>
                            <button class="json-creator-btn" data-action="run-algset-script">Run</button>
                        </div>
                        ${modal.summary ? `<pre class="algset-script-summary">${escapeHtml(modal.summary)}</pre>` : ''}
                    </div>
                </div>
                ${modal.scriptPicker ? this.renderScriptValuePicker(modal.scriptPicker) : ''}
            </div>
        `;
    }

    renderScriptValuePicker(picker) {
        const title = this.getScriptPickerTitle(picker.field);
        return `
            <div class="script-value-picker-backdrop" data-action="script-picker-backdrop">
                <div class="modal-content devtool-modal script-value-picker-modal">
                    <div class="modal-header"><h2>${escapeHtml(title)}</h2><button class="close-btn" data-action="cancel-script-picker">×</button></div>
                    <div class="modal-body script-value-picker-body">
                        ${picker.kind === 'layer' ? this.renderScriptLayerPicker(picker) : this.renderScriptOptionsPicker(picker)}
                        <div class="script-value-picker-actions">
                            <button class="json-creator-btn json-creator-btn-secondary" data-action="cancel-script-picker">Cancel</button>
                            <button class="json-creator-btn" data-action="apply-script-picker">Insert</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    getScriptPickerTitle(field) {
        const titles = {
            'top-layer': 'Pick Top Layer',
            'bottom-layer': 'Pick Bottom Layer',
            parity: 'Pick Parity',
            'pre-abf': 'Pick Pre ABF',
            'post-abf': 'Pick Post ABF',
            rul: 'Pick Pre AUF',
            rdl: 'Pick Pre ADF',
            auf: 'Pick Post AUF',
            adf: 'Pick Post ADF'
        };
        return titles[field] || 'Pick Value';
    }

    renderScriptLayerPicker(picker) {
        const layer = picker.field === 'bottom-layer' ? 'bottom' : 'top';
        return `
            <div class="script-layer-picker">
                <input id="scriptLayerPickerInput" class="shape-layer-input script-layer-picker-input" maxlength="12" value="${escapeHtml(picker.value || DEFAULT_LAYER)}" spellcheck="false" readonly>
                <div id="scriptLayerPickerInteractive" class="shape-renderer script-layer-picker-renderer" data-layer="${layer}" data-render-size="240"></div>
            </div>
        `;
    }

    renderScriptOptionsPicker(picker) {
        const values = new Set(parseScriptPickerList(picker.value));
        if (picker.field === 'parity') {
            return `<div class="script-picker-grid script-picker-grid-wide">${SCRIPT_PARITY_OPTIONS.map(([value, label]) => this.renderScriptPickerCheckbox(value, values.has(value), label)).join('')}</div>`;
        }
        const config = this.getScriptOptionsPickerConfig(picker.field);
        return `
            <div class="script-picker-section">
                <h3>${escapeHtml(config.label)}</h3>
                <div class="script-picker-grid">${config.options.map((value) => this.renderScriptPickerCheckbox(value, values.has(String(value)), String(value))).join('')}</div>
            </div>
        `;
    }

    getScriptOptionsPickerConfig(field) {
        if (field === 'auf') return { label: 'Post AUF', options: MOVE_OPTIONS };
        if (field === 'adf') return { label: 'Post ADF', options: DOWN_MOVE_OPTIONS };
        if (field === 'post-abf') return { label: 'Post ABF values', options: MOVE_OPTIONS };
        return {
            label: field === 'rdl' ? 'Pre ADF' : field === 'rul' ? 'Pre AUF' : 'Pre ABF values',
            options: NUMBER_OPTIONS
        };
    }

    renderScriptPickerCheckbox(value, checked, label = value) {
        return `
            <label class="json-creator-grid-item script-picker-option">
                <input type="checkbox" data-script-picker-value="${escapeHtml(value)}" ${checked ? 'checked' : ''}>
                <span>${escapeHtml(label)}</span>
            </label>
        `;
    }

    renderRunModal() {
        const run = this.state.run;
        if (!run) return '';
        return `
            <div class="run-modal">
                <div class="run-modal-content">
                    <div class="run-modal-header"><h2>Running: ${escapeHtml(run.name)}</h2><button class="close-btn" data-action="close-run">×</button></div>
                    <div class="run-modal-progress">
                        <div class="progress-bar-container"><div class="progress-bar-fill" style="width:${run.progress}%"></div><div class="progress-text">${run.results.length} / ${RUN_COUNT}</div></div>
                        <button class="json-creator-btn json-creator-btn-secondary" data-action="stop-run" ${run.stopped || run.done ? 'disabled' : ''}>Stop</button>
                    </div>
                    <div class="run-modal-body">${run.results.map((result) => this.renderRunResult(result)).join('')}</div>
                </div>
            </div>
        `;
    }

    renderRunResult(result) {
        return `
            <div class="scramble-result-item">
                <div class="scramble-result-info">
                    <div class="run-field"><strong>Case Name:</strong><span>${escapeHtml(result.caseName)}</span></div>
                    <div class="run-field"><strong>Path:</strong><span>${escapeHtml(result.path)}</span></div>
                    <div class="run-field run-field-scramble"><strong>Scramble:</strong><span>${escapeHtml(result.scramble)}</span></div>
                    <div class="run-field"><strong>Post-ABF:</strong><span>${escapeHtml(result.postAbf)}</span></div>
                    <div class="run-field"><strong>Pre-ABF:</strong><span>${escapeHtml(result.preAbf)}</span></div>
                    <div class="run-field"><strong>Equator:</strong><span>${escapeHtml(result.equator)}</span></div>
                </div>
                <div class="scramble-result-viz">${result.viz || '<div style="color:#888;">Visualization unavailable</div>'}</div>
            </div>
        `;
    }

    afterRender(options = {}) {
        const rename = this.root?.querySelector('#renameInput');
        if (rename) {
            rename.focus();
            rename.select();
        }
        const scriptInput = this.root?.querySelector('#algsetScriptInput');
        const scriptPickerOpen = Boolean(this.state.modal?.type === 'algset-script' && this.state.modal.scriptPicker);
        if (scriptInput && !options.skipScriptFocus && !scriptPickerOpen) {
            scriptInput.focus();
            const cursor = this.state.modal?.type === 'algset-script'
                ? Math.min(this.state.modal.cursor ?? scriptInput.value.length, scriptInput.value.length)
                : scriptInput.value.length;
            scriptInput.selectionStart = scriptInput.selectionEnd = cursor;
            this.updateScriptSuggestions();
        }
        if (scriptInput) {
            scriptInput.addEventListener('scroll', () => this.syncScriptEditorScroll(scriptInput), { signal: this.abortController.signal });
        }
        const treeRename = this.root?.querySelector('#treeRenameInput');
        if (treeRename) {
            treeRename.focus();
            treeRename.select();
        }
        const rootRename = this.root?.querySelector('#rootRenameInput');
        if (rootRename) {
            rootRename.focus();
            rootRename.select();
        }
        const shapeValueEdit = this.root?.querySelector('#shapeValueEditInput');
        if (shapeValueEdit) {
            shapeValueEdit.focus();
            shapeValueEdit.select();
        }
        const runBody = this.root?.querySelector('.run-modal-body');
        if (runBody) {
            runBody.scrollTop = this.state.run?.scrollTop ?? options.runBodyScrollTop ?? 0;
            runBody.addEventListener('scroll', () => {
                if (this.state.run) this.state.run.scrollTop = runBody.scrollTop;
            });
        }
        const tree = this.root?.querySelector('#jsonCreatorTree');
        if (tree) tree.scrollTop = options.treeScrollTop ?? 0;
        if (treeRename && this.state.newItemRenamePath) this.scrollTreeRenameIntoView(treeRename);
        this.positionRootSelector();
        this.positionContextMenu();
        this.renderShapeVisuals();
        this.renderScriptPickerVisual();
    }

    scrollTreeRenameIntoView(input) {
        const tree = this.root?.querySelector('#jsonCreatorTree');
        const row = input.closest('.json-creator-tree-item');
        if (!tree || !row) return;
        const margin = 10;
        const treeRect = tree.getBoundingClientRect();
        const rowRect = row.getBoundingClientRect();
        if (rowRect.top < treeRect.top + margin) {
            tree.scrollTop -= treeRect.top + margin - rowRect.top;
        } else if (rowRect.bottom > treeRect.bottom - margin) {
            tree.scrollTop += rowRect.bottom - (treeRect.bottom - margin);
        }
    }

    handleClick(event) {
        const target = event.target;
        const infoButton = target.closest('.info-btn');
        if (infoButton && this.root?.contains(infoButton)) {
            this.toggleInfoBox(infoButton);
            return;
        }
        if (!target.closest('.info-box')) this.closeInfoBoxes();
        if (target.id === 'algsetScriptInput') {
            setTimeout(() => this.updateScriptCursorFromInput(target), 0);
        }
        if (this.state.contextMenu && !target.closest('[data-context-menu]')) {
            const keepRootSelector = this.state.modal?.type === 'root-selector' && target.closest('.root-selector-modal');
            this.update({ contextMenu: null, modal: keepRootSelector ? this.state.modal : null });
            return;
        }
        if (this.state.shapeValueEdit && !target.closest('#shapeValueEditInput')) {
            this.commitShapeValueEdit();
            if (this.state.shapeValueEdit) return;
        }
        const actionElement = target.closest('[data-action]');
        if (!actionElement || !this.root?.contains(actionElement)) {
            if (target.id === 'jsonCreatorTree') {
                this.state.selectedPath = '';
                saveSelection(this.state.activeRoot, '');
                this.update({ contextMenu: null, modal: this.state.modal?.type === 'root-selector' ? null : this.state.modal });
                return;
            }
            if (this.state.contextMenu || this.state.modal?.type === 'root-selector') {
                this.update({ contextMenu: null, modal: this.state.modal?.type === 'root-selector' ? null : this.state.modal });
            }
            return;
        }
        if (actionElement.classList.contains('disabled')) return;
        const action = actionElement.dataset.action;
        if (action !== 'tree-rename-input' && this.state.renamingPath && !target.closest('#treeRenameInput')) {
            this.commitInlineRename();
        }
        if (action !== 'root-rename-input' && this.state.renamingRoot && !target.closest('#rootRenameInput')) {
            const confirmingNewRoot = this.state.newRootRename === this.state.renamingRoot;
            this.commitRootRename();
            if (this.state.renamingRoot || confirmingNewRoot || action === 'add-root') return;
        }
        if (actionElement.closest('[data-context-menu]') && this.state.contextMenu?.type !== 'extra') {
            return this.handleContextAction(action);
        }

        if (action === 'modal-backdrop' && target === actionElement) return this.closeModal(true);
        if (action === 'root-selector-backdrop') return this.update({ modal: null, contextMenu: null });
        if (action === 'script-picker-backdrop' && target === actionElement) return this.closeScriptValuePicker();
        if (action === 'tree-rename-input') return;
        if (action === 'root-rename-input') return;
        if (action === 'shape-code-input') return;
        if (action === 'copy-shape-value') {
            if (event.shiftKey) return this.startShapeValueEdit(actionElement.dataset.layer);
            return void this.copyShapeValue(actionElement.dataset.layer);
        }
        if (action === 'select-tree-item') {
            if (event.detail >= 2 && this.isTreeTextRenameTarget(event)) return this.startInlineRename(actionElement.dataset.path);
            return this.selectPath(actionElement.dataset.path);
        }
        if (action === 'toggle-folder') return this.toggleFolder(actionElement.dataset.path);
        if (action === 'toggle-sidebar') return this.update({ sidebarHidden: !this.state.sidebarHidden });
        if (action === 'new-case') return this.newCase();
        if (action === 'new-folder') return this.newFolder();
        if (action === 'copy') return this.copy();
        if (action === 'paste') return this.paste();
        if (action === 'delete') return this.deleteSelected();
        if (action === 'open-extra-tools') return this.openExtraTools(event);
        if (action === 'open-root-selector') return this.update({ modal: this.state.modal?.type === 'root-selector' ? null : { type: 'root-selector' }, contextMenu: null });
        if (action === 'select-root') return this.switchRoot(actionElement.dataset.root);
        if (action === 'add-root') return this.addRootInline();
        if (action === 'toggle-theme') return this.toggleTheme();
        if (action === 'case-tab' || action === 'template-tab') return this.setEditor(this.state.editor.type, actionElement.dataset.tab);
        if (action === 'run-case') return this.runSelectedCase();
        if (action === 'reset-case') return this.resetCase();
        if (action === 'run-root') return this.runJSON();
        if (action === 'extract-json') return this.extractJSON();
        if (action === 'open-data-management') return this.update({ modal: { type: 'data-management' } });
        if (action === 'close') return this.close();
        if (action === 'modal-cancel') return this.closeModal(false);
        if (action === 'modal-confirm') return this.confirmModal();
        if (action === 'rename-confirm') return this.confirmRename();
        if (action === 'copy-extracted-json') return this.copyExtractedJSON();
        if (action === 'train-extracted-json') return this.trainExtractedJSON();
        if (action === 'download-root-json') return this.downloadRootJSON();
        if (action === 'open-case-template') return this.openCaseTemplate();
        if (action === 'import-root-data') return this.update({ modal: { type: 'file-import', scope: 'root', title: `Import Data to Root: ${this.state.activeRoot}` }, contextMenu: null });
        if (action === 'reset-root') return this.resetRoot();
        if (action === 'open-bulk-import') return this.update({ modal: { type: 'bulk-import' }, contextMenu: null });
        if (action === 'process-file-import') return void this.processFileImport(actionElement.dataset.mode);
        if (action === 'process-bulk-import') return void this.processBulkImport();
        if (action === 'run-algset-script') return this.runAlgsetScript();
        if (action === 'cancel-script-picker') return this.closeScriptValuePicker();
        if (action === 'apply-script-picker') return this.applyScriptValuePicker();
        if (action === 'export-all-data') return this.exportAllData();
        if (action === 'open-general-import') return this.update({ modal: { type: 'file-import', scope: 'all', title: 'Import Data' } });
        if (action === 'open-devtool-help') return this.update({ modal: { type: 'devtool-help' }, contextMenu: null });
        if (action === 'reset-all-data') return this.resetAllData();
        if (action === 'save-template') return this.saveCaseTemplate();
        if (action === 'clear-template') return this.clearCaseTemplate();
        if (action === 'set-as-template') return this.setSelectedAsTemplate();
        if (action === 'reset-layer') return this.resetLayer(actionElement.dataset.layer);
        if (action === 'apply-algorithm') return this.applyAlgorithmInput();
        if (action === 'apply-append-algorithm') return this.applyAlgorithmInput(true);
        if (action === 'add-constraint') return this.addConstraint(actionElement.dataset.prefix);
        if (action === 'remove-constraint') return this.removeConstraint(actionElement.dataset.position);
        if (action === 'close-run') return this.closeRun();
        if (action === 'stop-run') return this.stopRun();
        return this.handleContextAction(action);
    }

    handleDoubleClick(event) {
        if (!this.isTreeTextRenameTarget(event)) return;
        const row = event.target.closest('.json-creator-tree-item');
        if (!row) return;
        this.startInlineRename(row.dataset.path);
    }

    isTreeTextRenameTarget(event) {
        const text = event.target.closest('.tree-item-text');
        return Boolean(text && this.root?.contains(text));
    }

    handleContextMenu(event) {
        const row = event.target.closest('.json-creator-tree-item');
        if (row) {
            event.preventDefault();
            this.focusPathForContextMenu(row.dataset.path);
            this.openContextMenu(event.clientX, event.clientY, 'item', row.dataset.path);
            return;
        }
        const rootRow = event.target.closest('.root-list-item');
        if (rootRow) {
            event.preventDefault();
            this.openContextMenu(event.clientX, event.clientY, 'root-item', '', { rootName: rootRow.dataset.root, keepModal: true });
            return;
        }
        if (event.target.id === 'jsonCreatorTree') {
            event.preventDefault();
            this.openContextMenu(event.clientX, event.clientY, 'root', '');
        }
    }

    handleInput(event) {
        const target = event.target;
        if (target.matches('.shape-layer-card > .shape-layer-input')) return this.updateLayer(target.dataset.layer, target.value);
        if (target.dataset.action === 'algorithm-input') return void this.handleAlgorithmInput(target.value);
        if (target.dataset.action === 'algset-script-input') {
            if (this.state.modal?.type === 'algset-script') {
                this.state.modal.script = target.value;
                this.state.modal.cursor = target.selectionStart ?? target.value.length;
                this.updateScriptSuggestions();
            }
            return;
        }
        if (target.dataset.action === 'tree-rename-input') {
            this.state.renamingValue = target.value;
            return;
        }
        if (target.dataset.action === 'root-rename-input') {
            this.state.renamingRootValue = target.value;
            return;
        }
        if (target.dataset.action === 'shape-code-input') {
            if (this.state.shapeValueEdit) {
                this.state.shapeValueEdit.value = target.value.toUpperCase().slice(0, 12);
                this.state.shapeValueEdit.invalid = false;
                if (target.value !== this.state.shapeValueEdit.value) target.value = this.state.shapeValueEdit.value;
            }
            return;
        }
        if (target.dataset.field === 'alg') return this.updateCurrentField('alg', target.value);
    }

    handleChange(event) {
        const target = event.target;
        if (target.matches('input[type="file"]')) this.updateFileName(target);
        if (target.dataset.action === 'parity-mode') return this.updateParityMode(target.dataset.prefix, target.value);
        if (target.matches('input[type="checkbox"][data-field]')) {
            const value = target.dataset.valueType === 'number' ? Number(target.dataset.value) : target.dataset.value;
            return this.updateArrayField(target.dataset.prefix, target.dataset.field, value, target.checked);
        }
    }

    updateFileName(input) {
        const label = this.root?.querySelector(`[data-file-name-for="${input.id}"]`);
        if (label) label.textContent = input.files?.[0]?.name || 'No file selected';
    }

    handleDragOver(event) {
        if (!event.target.closest('.devtool-file-drop')) return;
        event.preventDefault();
        event.target.closest('.devtool-file-drop')?.classList.add('dragging');
    }

    handleDrop(event) {
        const zone = event.target.closest('.devtool-file-drop');
        if (!zone) return;
        event.preventDefault();
        zone.classList.remove('dragging');
        const input = this.root?.querySelector(`#${zone.dataset.fileTarget}`);
        const file = event.dataTransfer?.files?.[0];
        if (!input || !file) return;
        const transfer = new DataTransfer();
        transfer.items.add(file);
        input.files = transfer.files;
        input.dispatchEvent(new Event('change', { bubbles: true }));
        this.updateFileName(input);
    }

    handleRootKeydown(event) {
        if (event.target.id === 'algsetScriptInput') {
            if (event.key === 'Tab') {
                event.preventDefault();
                if (this.openScriptValuePickerFromInput(event.target)) return;
                this.completeAlgsetScriptInput();
            } else if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
                event.preventDefault();
                this.runAlgsetScript();
            }
            return;
        }
        if (this.state.modal?.type === 'algset-script' && this.state.modal.scriptPicker && event.key === 'Escape') {
            event.preventDefault();
            event.stopPropagation();
            this.closeScriptValuePicker();
            return;
        }
        if (event.target.id === 'algorithmTextInput' && event.key === 'Enter' && !event.isComposing) {
            event.preventDefault();
            this.handleAlgorithmInput(event.target.value);
            this.applyAlgorithmInput(event.shiftKey);
            return;
        }
        if (event.key !== 'Enter' && event.key !== 'Escape') return;
        if (event.target.id === 'renameInput') {
            if (event.key === 'Enter') this.confirmRename();
            if (event.key === 'Escape') this.closeModal(false);
        }
        if (event.target.id === 'treeRenameInput') {
            if (event.key === 'Enter') {
                event.preventDefault();
                this.commitInlineRename();
            }
            if (event.key === 'Escape') {
                event.preventDefault();
                this.cancelInlineRename();
            }
        }
        if (event.target.id === 'rootRenameInput') {
            if (event.key === 'Enter') {
                event.preventDefault();
                this.commitRootRename();
            }
            if (event.key === 'Escape') {
                event.preventDefault();
                this.cancelRootRename();
            }
        }
        if (event.target.id === 'shapeValueEditInput') {
            if (event.key === 'Enter') {
                event.preventDefault();
                this.commitShapeValueEdit();
            }
            if (event.key === 'Escape') {
                event.preventDefault();
                this.cancelShapeValueEdit();
            }
        }
    }

    handleRootKeyup(event) {
        if (event.target.id === 'algsetScriptInput') this.updateScriptCursorFromInput(event.target);
    }

    handleFocusOut(event) {
        if (event.target.id === 'shapeValueEditInput') {
            setTimeout(() => {
                if (this.state.shapeValueEdit && document.activeElement?.id !== 'shapeValueEditInput') {
                    this.commitShapeValueEdit();
                }
            }, 0);
            return;
        }
        if (event.target.id === 'rootRenameInput') {
            setTimeout(() => {
                if (this.state.renamingRoot && document.activeElement?.id !== 'rootRenameInput') {
                    this.commitRootRename();
                }
            }, 0);
            return;
        }
        if (event.target.id !== 'treeRenameInput') return;
        setTimeout(() => {
            if (this.state.renamingPath && document.activeElement?.id !== 'treeRenameInput') {
                this.commitInlineRename();
            }
        }, 0);
    }

    handleDocumentKeydown(event) {
        if (!this.root || !document.body.contains(this.root)) return;
        const activeElement = document.activeElement;
        const eventElement = event.target;
        const editingText = ['INPUT', 'TEXTAREA', 'SELECT'].includes(activeElement?.tagName || '')
            || ['INPUT', 'TEXTAREA', 'SELECT'].includes(eventElement?.tagName || '')
            || Boolean(activeElement?.isContentEditable)
            || Boolean(eventElement?.isContentEditable);
        if (editingText) return;
        const plainKey = !event.ctrlKey && !event.metaKey && !event.altKey && !event.shiftKey;
        const shortcutsAvailable = !this.state.modal && !this.state.contextMenu && !this.state.run;
        if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'c') {
            event.preventDefault();
            this.copy();
        } else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'v') {
            event.preventDefault();
            if (this.state.clipboard) this.paste();
            else void this.pasteSystemClipboard();
        } else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'n') {
            event.preventDefault();
            if (event.shiftKey) this.newFolder();
            else this.newCase();
        } else if (plainKey && shortcutsAvailable && event.key.toLowerCase() === 'n') {
            event.preventDefault();
            this.newFolder();
        } else if (plainKey && shortcutsAvailable && event.key === '=') {
            event.preventDefault();
            this.newCase();
        } else if (event.key === 'Delete' && shortcutsAvailable) {
            event.preventDefault();
            this.deleteEditorCase();
        } else if (event.key === 'Escape') {
            if (this.state.contextMenu) this.update({ contextMenu: null });
            else if (this.state.modal) this.closeModal(false);
        }
    }

    update(partial) {
        Object.assign(this.state, partial);
        this.render();
    }

    setEditor(type, tab = 'shape') {
        this.state.editor = { type, tab };
        this.render();
    }

    selectPath(path, shouldRender = true) {
        const node = getNode(this.state.tree, path);
        if (!node) return;
        this.state.selectedPath = path;
        saveSelection(this.state.activeRoot, path);
        if (isCase(node)) {
            this.state.editorPath = path;
            this.state.editor = { type: 'case', tab: 'shape' };
        } else if (isFolder(node)) {
            if (this.state.expandedFolders.has(path)) this.state.expandedFolders.delete(path);
            else this.state.expandedFolders.add(path);
            this.saveExpandedFolderState();
        }
        if (shouldRender) this.render();
    }

    focusPathForContextMenu(path) {
        const node = getNode(this.state.tree, path);
        if (!node) return;
        this.state.selectedPath = path;
        saveSelection(this.state.activeRoot, path);
        if (isCase(node)) {
            this.state.editorPath = path;
            this.state.editor = { type: 'case', tab: 'shape' };
        }
    }

    toggleFolder(path) {
        if (!path) return;
        if (this.state.expandedFolders.has(path)) this.state.expandedFolders.delete(path);
        else this.state.expandedFolders.add(path);
        this.saveExpandedFolderState();
        this.render();
    }

    newCase(basePath = this.state.selectedPath) {
        const target = getTargetFolder(this.state.tree, basePath);
        const name = getUniqueName(target.folder, 'New Case');
        target.folder[name] = createCaseFromTemplate(name, this.state.caseTemplate);
        if (target.path) this.state.expandedFolders.add(target.path);
        this.persistRoot();
        const path = childPath(target.path, name);
        this.selectPath(path, false);
        this.render();
        this.startInlineRename(path, { removeOnCancel: true });
    }

    newFolder(basePath = this.state.selectedPath) {
        const target = getTargetFolder(this.state.tree, basePath);
        const name = getUniqueName(target.folder, 'New Folder');
        target.folder[name] = {};
        if (target.path) this.state.expandedFolders.add(target.path);
        this.persistRoot();
        this.state.selectedPath = childPath(target.path, name);
        saveSelection(this.state.activeRoot, this.state.selectedPath);
        this.render();
        this.startInlineRename(this.state.selectedPath, { removeOnCancel: true });
    }

    renamePath(path, newName) {
        const trimmed = String(newName || '').trim();
        const info = getParent(this.state.tree, path);
        if (!trimmed || !info || trimmed === info.key) {
            this.state.renamingPath = '';
            this.state.renamingValue = '';
            return this.closeModal(false);
        }
        if (info.parent[trimmed]) {
            showFloatingMessage('An item with this name already exists', 'error');
            return;
        }
        const item = info.parent[info.key];
        const entries = Object.entries(info.parent).map(([key, value]) => key === info.key ? [trimmed, value] : [key, value]);
        for (const key of Object.keys(info.parent)) delete info.parent[key];
        for (const [key, value] of entries) info.parent[key] = value;
        if (isCase(item)) item.caseName = trimmed;
        const previousPath = path;
        const renamedPath = childPath(info.parentPath, trimmed);
        this.state.selectedPath = this.replacePathPrefix(this.state.selectedPath, previousPath, renamedPath);
        this.state.editorPath = this.replacePathPrefix(this.state.editorPath, previousPath, renamedPath);
        this.state.expandedFolders = new Set([...this.state.expandedFolders].map((folderPath) => this.replacePathPrefix(folderPath, previousPath, renamedPath)));
        this.state.renamingPath = '';
        this.state.renamingValue = '';
        this.state.newItemRenamePath = '';
        saveSelection(this.state.activeRoot, this.state.selectedPath);
        this.persistRoot();
        this.closeModal(false);
    }

    startInlineRename(path, options = {}) {
        const info = getParent(this.state.tree, path);
        if (!info) return;
        this.state.renamingPath = path;
        this.state.renamingValue = info.key;
        this.state.newItemRenamePath = options.removeOnCancel ? path : '';
        this.state.contextMenu = null;
        this.render();
    }

    commitInlineRename() {
        if (!this.state.renamingPath) return;
        const path = this.state.renamingPath;
        const value = this.state.renamingValue;
        this.renamePath(path, value);
    }

    cancelInlineRename() {
        if (this.state.newItemRenamePath && this.state.renamingPath === this.state.newItemRenamePath) {
            this.removeNewItemFromRename(this.state.newItemRenamePath);
            return;
        }
        this.state.renamingPath = '';
        this.state.renamingValue = '';
        this.state.newItemRenamePath = '';
        this.render();
    }

    copy(path = this.state.selectedPath) {
        const item = getNode(this.state.tree, path);
        if (!item) return showFloatingMessage('Nothing selected', 'info');
        this.state.clipboard = { item: clone(item), name: getPathName(path) };
        showFloatingMessage('Copied', 'success');
    }

    paste(basePath = this.state.selectedPath) {
        if (!this.state.clipboard) return showFloatingMessage('Clipboard is empty', 'info');
        const target = getTargetFolder(this.state.tree, basePath);
        const name = getUniqueName(target.folder, this.state.clipboard.name || 'Pasted Item');
        target.folder[name] = clone(this.state.clipboard.item);
        if (isCase(target.folder[name])) target.folder[name].caseName = name;
        this.persistRoot();
        this.selectPath(childPath(target.path, name), false);
        this.render();
    }

    async pasteSystemClipboard(basePath = this.state.selectedPath) {
        let text = '';
        try {
            text = await navigator.clipboard.readText();
        } catch (error) {
            showFloatingMessage(`System clipboard unavailable: ${error.message}`, 'error');
            return;
        }
        if (!text.trim()) return showFloatingMessage('System clipboard is empty', 'info');
        try {
            this.importClipboardJSON(JSON.parse(text), basePath);
            showFloatingMessage('JSON pasted from system clipboard', 'success');
        } catch (error) {
            showFloatingMessage(`Clipboard JSON failed: ${error.message}`, 'error');
        }
    }

    importClipboardJSON(data, basePath = this.state.selectedPath) {
        const target = getTargetFolder(this.state.tree, basePath);
        if (isCase(data)) {
            const name = getUniqueName(target.folder, data.caseName || 'Pasted Case');
            target.folder[name] = clone(data);
            target.folder[name].caseName = name;
            this.persistRoot();
            this.selectPath(childPath(target.path, name), false);
            this.render();
            return;
        }
        if (!isFolder(data)) throw new Error('Clipboard JSON must be a case or folder tree');
        deepMergeTree(target.folder, data);
        if (target.path) this.state.expandedFolders.add(target.path);
        this.persistRoot();
        this.render();
    }

    moveSelected(direction, path = this.state.selectedPath) {
        if (!path) return;
        const info = getParent(this.state.tree, path);
        if (!info) return;
        const entries = Object.entries(info.parent);
        const index = entries.findIndex(([key]) => key === info.key);
        const nextIndex = index + direction;
        if (index < 0 || nextIndex < 0 || nextIndex >= entries.length) {
            showFloatingMessage('Cannot move item beyond list boundaries', 'info');
            return;
        }
        [entries[index], entries[nextIndex]] = [entries[nextIndex], entries[index]];
        for (const key of Object.keys(info.parent)) delete info.parent[key];
        for (const [key, value] of entries) info.parent[key] = value;
        this.persistRoot();
        this.render();
    }

    deleteSelected(path = this.state.selectedPath) {
        if (!path) return showFloatingMessage('Nothing selected', 'info');
        const name = getPathName(path);
        this.openConfirm('Delete Item', `Delete "${name}"? This cannot be undone.`, () => {
            const info = getParent(this.state.tree, path);
            if (!info) return;
            delete info.parent[info.key];
            if (this.state.selectedPath === path || isPathWithin(this.state.selectedPath, path)) {
                this.state.selectedPath = '';
                saveSelection(this.state.activeRoot, '');
            }
            if (this.state.editorPath === path || isPathWithin(this.state.editorPath, path)) {
                this.state.editorPath = '';
                this.state.editor = { type: 'welcome', tab: 'shape' };
            }
            this.persistRoot();
            this.closeModal(false);
        });
    }

    deleteEditorCase() {
        const item = getNode(this.state.tree, this.state.editorPath);
        if (isCase(item)) {
            this.deleteSelected(this.state.editorPath);
            return;
        }
        this.deleteSelected();
    }

    removeNewItemFromRename(path) {
        const info = getParent(this.state.tree, path);
        const parentPath = info?.parentPath || '';
        if (info) delete info.parent[info.key];
        if (this.state.selectedPath === path || isPathWithin(this.state.selectedPath, path)) {
            this.state.selectedPath = parentPath;
            saveSelection(this.state.activeRoot, parentPath);
        }
        if (this.state.editorPath === path || isPathWithin(this.state.editorPath, path)) {
            this.state.editorPath = '';
            this.state.editor = { type: 'welcome', tab: 'shape' };
        }
        this.state.expandedFolders.delete(path);
        this.state.renamingPath = '';
        this.state.renamingValue = '';
        this.state.newItemRenamePath = '';
        this.persistRoot();
        this.render();
    }

    openContextMenu(x, y, type, path, extra = {}) {
        const { keepModal = false, ...menuExtra } = extra;
        this.update({
            contextMenu: {
                type,
                path,
                x,
                y,
                rawX: x,
                rawY: y,
                maxHeight: 'calc(100vh - 16px)',
                ...menuExtra
            },
            modal: keepModal ? this.state.modal : null
        });
    }

    positionContextMenu() {
        const menu = this.state.contextMenu;
        const element = this.root?.querySelector('[data-context-menu]');
        if (!menu || !element) return;
        const margin = 8;
        const availableHeight = Math.max(80, window.innerHeight - margin * 2);
        element.style.maxHeight = `${availableHeight}px`;
        const rect = element.getBoundingClientRect();
        const left = Math.max(margin, Math.min(menu.rawX ?? menu.x, window.innerWidth - rect.width - margin));
        const top = Math.max(margin, Math.min(menu.rawY ?? menu.y, window.innerHeight - rect.height - margin));
        if (left === menu.x && top === menu.y && menu.maxHeight === `${availableHeight}px`) return;
        this.state.contextMenu = {
            ...menu,
            x: left,
            y: top,
            maxHeight: `${availableHeight}px`
        };
        element.style.left = `${left}px`;
        element.style.top = `${top}px`;
        element.style.maxHeight = `${availableHeight}px`;
    }

    positionRootSelector() {
        if (this.state.modal?.type !== 'root-selector') return;
        const selector = this.root?.querySelector('.root-selector-modal');
        const button = this.root?.querySelector('#rootSelectorBtn');
        if (!selector || !button) return;
        const rect = button.getBoundingClientRect();
        const margin = 8;
        const width = Math.max(rect.width, 240);
        selector.style.width = `${width}px`;
        selector.style.left = `${Math.max(margin, Math.min(rect.left, window.innerWidth - width - margin))}px`;
        selector.style.top = `${Math.min(rect.bottom + 4, window.innerHeight - margin)}px`;
    }

    openExtraTools(event) {
        this.openContextMenu(event.clientX, event.clientY, 'extra', '');
    }

    getContextMenuItems(menu) {
        if (menu.type === 'extra') {
            return [
                { label: 'Case Template', action: 'open-case-template' },
                { label: 'Import Data to Root', action: 'import-root-data' },
                { label: 'Reset Root', action: 'reset-root' },
                { label: 'Bulk Import', action: 'open-bulk-import' },
                { separator: true },
                { label: 'Help', action: 'open-devtool-help' }
            ];
        }
        if (menu.type === 'root-item') {
            return [
                { label: 'Rename', action: 'rename-root' },
                { label: 'Export as JSON', action: 'export-root-json' },
                { label: 'Reset', action: 'reset-root-item' },
                { separator: true },
                { label: 'Delete', action: 'delete-root' }
            ];
        }
        if (menu.type === 'root') {
            return [
                { label: 'New Case', action: 'new-case' },
                { label: 'New Folder', action: 'new-folder' },
                { label: 'Bulk Import', action: 'open-bulk-import' },
                { label: 'Run Script...', action: 'open-algset-script' },
                { separator: true },
                { label: 'Paste', action: 'paste', disabled: !this.state.clipboard }
            ];
        }
        const item = getNode(this.state.tree, menu.path);
        if (isFolder(item)) {
            return [
                { label: 'New Case', action: 'new-case' },
                { label: 'New Folder', action: 'new-folder' },
                { label: 'Bulk Import', action: 'open-bulk-import' },
                { label: 'Run Script...', action: 'open-algset-script' },
                { separator: true },
                { label: 'Rename', action: 'rename-selected' },
                { label: 'Run', action: 'run-context' },
                { separator: true },
                { label: 'Copy', action: 'copy' },
                { label: 'Paste', action: 'paste', disabled: !this.state.clipboard },
                { label: 'Copy JSON to Clipboard', action: 'copy-item-json' },
                { label: 'Move Up', action: 'move-up' },
                { label: 'Move Down', action: 'move-down' },
                { separator: true },
                { label: 'Delete', action: 'delete' }
            ];
        }
        return [
            { label: 'Rename', action: 'rename-selected' },
            { label: 'Run', action: 'run-context' },
            { label: 'Reset Case', action: 'reset-case-context' },
            { label: 'Set as Template', action: 'set-as-template' },
            { separator: true },
            { label: 'Copy', action: 'copy' },
            { label: 'Paste', action: 'paste', disabled: !this.state.clipboard },
            { label: 'Copy JSON to Clipboard', action: 'copy-item-json' },
            { label: 'Move Up', action: 'move-up' },
            { label: 'Move Down', action: 'move-down' },
            { separator: true },
            { label: 'Delete', action: 'delete' }
        ];
    }

    handleContextAction(action) {
        const menu = this.state.contextMenu;
        if (!menu) return;
        if (action === 'rename-root') {
            const rootName = menu.rootName;
            return this.startRootInlineRename(rootName);
        }
        if (action === 'export-root-json') return this.exportRootJSON(menu.rootName);
        if (action === 'reset-root-item') return this.resetRootName(menu.rootName);
        if (action === 'delete-root') return this.deleteRoot(menu.rootName);
        if (action === 'new-case') return this.newCase(menu.path);
        if (action === 'new-folder') return this.newFolder(menu.path);
        if (action === 'open-bulk-import') return this.update({ modal: { type: 'bulk-import', targetPath: menu.path }, contextMenu: null });
        if (action === 'open-algset-script') return this.openAlgsetScript(menu.path);
        if (action === 'rename-selected') {
            return this.startInlineRename(menu.path);
        }
        if (action === 'run-context') return this.runPath(menu.path);
        if (action === 'reset-case-context') return this.resetCase(menu.path);
        if (action === 'set-as-template') return this.setSelectedAsTemplate(menu.path);
        if (action === 'copy') {
            this.copy(menu.path);
            return this.update({ contextMenu: null });
        }
        if (action === 'paste') {
            this.paste(menu.path);
            return this.update({ contextMenu: null });
        }
        if (action === 'move-up') return this.moveSelected(-1, menu.path);
        if (action === 'move-down') return this.moveSelected(1, menu.path);
        if (action === 'copy-item-json') return this.copyItemJSON(menu.path);
        if (action === 'delete') return this.deleteSelected(menu.path);
    }

    getEditorCase() {
        return getNode(this.state.tree, this.state.editorPath);
    }

    replacePathPrefix(path, previousPath, nextPath) {
        return replacePathPrefix(path, previousPath, nextPath);
    }

    toggleInfoBox(button) {
        const box = button.parentElement?.querySelector('.info-box');
        if (!box) return;
        const visible = box.classList.contains('show');
        this.closeInfoBoxes();
        if (visible) return;
        const rect = button.getBoundingClientRect();
        box.style.left = `${Math.min(rect.left, window.innerWidth - 320)}px`;
        box.style.top = `${rect.bottom + 8}px`;
        box.classList.add('show');
    }

    closeInfoBoxes() {
        this.root?.querySelectorAll('.info-box.show').forEach((openBox) => openBox.classList.remove('show'));
    }

    switchRoot(rootName, options = {}) {
        const { persistCurrent = true } = options;
        if (!rootName || !AppState.developingJSONs[rootName]) return;
        if (persistCurrent) this.persistRoot();
        AppState.activeDevelopingJSON = rootName;
        this.state.activeRoot = rootName;
        this.state.tree = clone(AppState.developingJSONs[rootName]);
        saveDevelopingJSONs();
        this.state.caseTemplate = loadTemplate(rootName);
        this.state.selectedPath = '';
        this.state.editorPath = '';
        this.state.editor = { type: 'welcome', tab: 'shape' };
        this.state.expandedFolders = this.loadExpandedFolderState(rootName, this.state.tree);
        this.clearRootRenameState();
        this.state.modal = null;
        this.restoreSelection();
        this.render();
    }

    addRoot(name) {
        const rootName = String(name || '').trim();
        if (!rootName) return;
        if (AppState.developingJSONs[rootName]) return showFloatingMessage('A root with this name already exists', 'error');
        this.persistRoot();
        AppState.developingJSONs[rootName] = {};
        saveDevelopingJSONs();
        this.clearRootRenameState();
        this.closeModal(false);
        this.switchRoot(rootName);
    }

    renameRoot(oldName, newName) {
        this.applyRootRename(oldName, newName);
    }

    addRootInline() {
        this.persistRoot();
        const rootName = getUniqueName(AppState.developingJSONs, 'New Root');
        AppState.developingJSONs[rootName] = {};
        saveDevelopingJSONs();
        this.state.modal = { type: 'root-selector' };
        this.state.contextMenu = null;
        this.state.renamingRoot = rootName;
        this.state.renamingRootValue = rootName;
        this.state.newRootRename = rootName;
        this.render();
    }

    startRootInlineRename(rootName, options = {}) {
        if (!rootName || !AppState.developingJSONs[rootName]) return;
        this.state.renamingRoot = rootName;
        this.state.renamingRootValue = rootName;
        this.state.newRootRename = options.removeOnCancel ? rootName : '';
        this.state.modal = { type: 'root-selector' };
        this.state.contextMenu = null;
        this.render();
    }

    commitRootRename() {
        const oldName = this.state.renamingRoot;
        if (!oldName) return;
        const rootName = String(this.state.renamingRootValue || '').trim();
        if (!rootName) {
            if (this.state.newRootRename === oldName) this.removeNewRootFromRename(oldName);
            else {
                this.clearRootRenameState();
                this.render();
            }
            return;
        }
        const confirmingNewRoot = this.state.newRootRename === oldName;
        this.applyRootRename(oldName, rootName, {
            keepSelector: !confirmingNewRoot,
            switchToRenamed: confirmingNewRoot
        });
    }

    cancelRootRename() {
        if (this.state.newRootRename && this.state.renamingRoot === this.state.newRootRename) {
            this.removeNewRootFromRename(this.state.newRootRename);
            return;
        }
        this.clearRootRenameState();
        this.render();
    }

    clearRootRenameState() {
        this.state.renamingRoot = '';
        this.state.renamingRootValue = '';
        this.state.newRootRename = '';
    }

    removeNewRootFromRename(rootName) {
        if (rootName && AppState.developingJSONs[rootName]) {
            delete AppState.developingJSONs[rootName];
            clearTemplate(rootName);
            clearExpandedFolders(rootName);
        }
        if (!Object.keys(AppState.developingJSONs).length) {
            AppState.developingJSONs.default = normalizeTree(DEFAULT_ALGSET);
            AppState.activeDevelopingJSON = 'default';
        } else if (AppState.activeDevelopingJSON === rootName) {
            AppState.activeDevelopingJSON = Object.keys(AppState.developingJSONs)[0];
        }
        this.clearRootRenameState();
        saveDevelopingJSONs();
        this.switchRoot(AppState.activeDevelopingJSON, { persistCurrent: false });
        this.state.modal = { type: 'root-selector' };
        this.render();
    }

    applyRootRename(oldName, newName, options = {}) {
        const { keepSelector = false, switchToRenamed = false } = options;
        const rootName = String(newName || '').trim();
        if (!oldName || !AppState.developingJSONs[oldName]) {
            this.clearRootRenameState();
            return this.update({ modal: keepSelector ? { type: 'root-selector' } : null, contextMenu: null });
        }
        if (!rootName || oldName === rootName) {
            this.clearRootRenameState();
            if (switchToRenamed && AppState.developingJSONs[oldName]) return this.switchRoot(oldName);
            return this.update({ modal: keepSelector ? { type: 'root-selector' } : null, contextMenu: null });
        }
        if (AppState.developingJSONs[rootName]) {
            showFloatingMessage('A root with this name already exists', 'error');
            this.state.modal = { type: 'root-selector' };
            this.state.contextMenu = null;
            this.render();
            return;
        }
        this.persistRoot();
        const template = loadTemplate(oldName);
        const expandedFolders = oldName === this.state.activeRoot
            ? [...this.state.expandedFolders]
            : loadExpandedFolders(oldName);
        AppState.developingJSONs[rootName] = AppState.developingJSONs[oldName] || {};
        delete AppState.developingJSONs[oldName];
        saveExpandedFolders(rootName, Array.isArray(expandedFolders) ? expandedFolders : []);
        clearExpandedFolders(oldName);
        if (template) saveTemplate(rootName, template);
        clearTemplate(oldName);
        if (AppState.activeDevelopingJSON === oldName) AppState.activeDevelopingJSON = rootName;
        saveDevelopingJSONs();
        this.clearRootRenameState();
        if (switchToRenamed) {
            this.switchRoot(rootName, { persistCurrent: false });
            return;
        }
        if (this.state.activeRoot === oldName) {
            this.switchRoot(AppState.activeDevelopingJSON, { persistCurrent: false });
            if (keepSelector) {
                this.state.modal = { type: 'root-selector' };
                this.render();
            }
            return;
        }
        this.update({ modal: keepSelector ? { type: 'root-selector' } : null, contextMenu: null });
    }

    exportRootJSON(rootName) {
        const root = AppState.developingJSONs[rootName];
        if (!root) return;
        if (rootName === this.state.activeRoot) this.persistRoot();
        downloadTextJSON(rootName, stringifyCompactAlgset(rootName === this.state.activeRoot ? this.state.tree : root));
        this.update({ contextMenu: null });
    }

    resetRootName(rootName) {
        if (!rootName || !AppState.developingJSONs[rootName]) return;
        AppState.developingJSONs[rootName] = normalizeTree(DEFAULT_ALGSET);
        clearExpandedFolders(rootName);
        if (rootName === this.state.activeRoot) {
            this.state.tree = clone(AppState.developingJSONs[rootName]);
            this.state.selectedPath = '';
            this.state.editorPath = '';
            this.state.editor = { type: 'welcome', tab: 'shape' };
            this.state.expandedFolders.clear();
            this.state.caseTemplate = null;
            clearTemplate(rootName);
            clearExpandedFolders(rootName);
        }
        saveDevelopingJSONs();
        showFloatingMessage('Root reset', 'success');
        this.update({ contextMenu: null });
    }

    deleteRoot(rootName) {
        if (!rootName || !AppState.developingJSONs[rootName]) return;
        delete AppState.developingJSONs[rootName];
        clearTemplate(rootName);
        clearExpandedFolders(rootName);
        if (!Object.keys(AppState.developingJSONs).length) {
            AppState.developingJSONs.default = normalizeTree(DEFAULT_ALGSET);
            AppState.activeDevelopingJSON = 'default';
        } else if (AppState.activeDevelopingJSON === rootName) {
            AppState.activeDevelopingJSON = Object.keys(AppState.developingJSONs)[0];
        }
        saveDevelopingJSONs();
        this.state.contextMenu = null;
        this.switchRoot(AppState.activeDevelopingJSON, { persistCurrent: false });
    }

    toggleTheme() {
        AppState.settings.theme = AppState.settings.theme === 'dark' ? 'light' : 'dark';
        localStorage.setItem('sq1Settings', JSON.stringify(AppState.settings));
        document.body.className = `theme-${AppState.settings.theme}`;
        this.render();
    }

    extractJSON() {
        this.persistRoot();
        this.update({ modal: { type: 'extract' }, contextMenu: null });
    }

    async copyExtractedJSON() {
        const textarea = this.root?.querySelector('#extractedJSON');
        try {
            await navigator.clipboard.writeText(textarea?.value || this.getExtractedJSONText());
            showFloatingMessage('JSON copied to clipboard', 'success');
        } catch (error) {
            showFloatingMessage(`Failed to copy: ${error.message}`, 'error');
        }
    }

    getExtractedJSONText() {
        return stringifyCompactAlgset(this.state.tree);
    }

    downloadRootJSON() {
        downloadTextJSON(this.state.activeRoot, this.getExtractedJSONText());
    }

    trainExtractedJSON() {
        this.persistRoot();
        importTrainingJSONData(this.state.activeRoot, clone(this.state.tree), { activate: true, selectAll: true });
        saveLastScreen('training');
        this.abortController?.abort();
        this.root?.remove();
        this.root = null;
        renderApp();
        void generateNewScramble();
    }

    openAlgsetScript(scopePath = '') {
        const scopeNode = scopePath ? getNode(this.state.tree, scopePath) : this.state.tree;
        const scopeLabel = scopePath && scopeNode ? getPathName(scopePath) : this.state.activeRoot;
        this.update({
            modal: {
                type: 'algset-script',
                scopePath: isFolder(scopeNode) ? scopePath : '',
                scopeLabel,
                script: loadLastAlgsetScript(),
                summary: ''
            },
            contextMenu: null
        });
    }

    updateScriptSuggestions() {
        const input = this.root?.querySelector('#algsetScriptInput');
        const highlight = this.root?.querySelector('#algsetScriptHighlight');
        if (!input || !highlight) return;
        const suggestions = getAlgsetScriptSuggestions({
            tree: this.state.tree,
            text: input.value,
            cursor: input.selectionStart ?? input.value.length
        });
        const cursor = input.selectionStart ?? input.value.length;
        const completion = getScriptCompletionSuffix(input.value, cursor, suggestions);
        highlight.innerHTML = highlightAlgsetScript(input.value, cursor, completion);
        this.syncScriptEditorScroll(input);
    }

    updateScriptCursorFromInput(input) {
        if (this.state.modal?.type !== 'algset-script') return;
        this.state.modal.script = input.value;
        this.state.modal.cursor = input.selectionStart ?? input.value.length;
        this.updateScriptSuggestions();
    }

    syncScriptEditorScroll(input) {
        const highlight = this.root?.querySelector('#algsetScriptHighlight');
        if (!highlight || !input) return;
        highlight.scrollTop = input.scrollTop;
        highlight.scrollLeft = input.scrollLeft;
    }

    completeAlgsetScriptInput() {
        const input = this.root?.querySelector('#algsetScriptInput');
        if (!input) return;
        const cursor = input.selectionStart ?? input.value.length;
        if (!isScriptAutocompleteContext(input.value, cursor)) {
            this.updateScriptSuggestions();
            return;
        }
        const completed = completeAlgsetScript({
            tree: this.state.tree,
            text: input.value,
            cursor
        });
        input.value = completed.text;
        input.selectionStart = input.selectionEnd = completed.cursor;
        if (this.state.modal?.type === 'algset-script') {
            this.state.modal.script = completed.text;
            this.state.modal.cursor = completed.cursor;
        }
        this.updateScriptSuggestions();
    }

    openScriptValuePickerFromInput(input) {
        if (this.state.modal?.type !== 'algset-script') return false;
        const cursor = input.selectionStart ?? input.value.length;
        const request = getScriptValuePickerRequest(input.value, cursor);
        if (!request) return false;
        this.state.modal.script = input.value;
        this.state.modal.cursor = cursor;
        this.state.modal.scriptPicker = this.createScriptValuePicker(request);
        this.render();
        return true;
    }

    createScriptValuePicker(request) {
        const layer = request.field === 'top-layer' || request.field === 'bottom-layer';
        const parsedValues = parseScriptPickerList(request.value);
        const value = layer
            ? (/^[0-9A-FECWXYZR]{12}$/i.test(request.value) ? request.value.toUpperCase() : DEFAULT_LAYER)
            : formatScriptPickerList(parsedValues);
        return {
            ...request,
            kind: layer ? 'layer' : 'options',
            value
        };
    }

    closeScriptValuePicker() {
        const modal = this.state.modal;
        if (modal?.type !== 'algset-script') return;
        this.update({ modal: { ...modal, scriptPicker: null }, contextMenu: null });
    }

    applyScriptValuePicker() {
        const modal = this.state.modal;
        const picker = modal?.scriptPicker;
        if (modal?.type !== 'algset-script' || !picker) return;
        const script = modal.script || '';
        const value = picker.kind === 'layer'
            ? (this.root?.querySelector('#scriptLayerPickerInput')?.value || picker.value || DEFAULT_LAYER)
            : this.getScriptOptionsPickerValue();
        const nextScript = `${script.slice(0, picker.valueStart)}${value}${script.slice(picker.valueEnd)}`;
        const nextCursor = picker.valueStart + value.length;
        this.update({
            modal: {
                ...modal,
                script: nextScript,
                cursor: nextCursor,
                scriptPicker: null
            },
            contextMenu: null
        });
    }

    getScriptOptionsPickerValue() {
        const checked = [...this.root?.querySelectorAll('[data-script-picker-value]:checked') || []]
            .map((input) => input.dataset.scriptPickerValue)
            .filter((value) => value !== undefined);
        return formatScriptPickerList(checked);
    }

    runAlgsetScript() {
        const modal = this.state.modal;
        if (modal?.type !== 'algset-script') return;
        const input = this.root?.querySelector('#algsetScriptInput');
        const script = input?.value || modal.script || '';
        saveLastAlgsetScript(script);
        const result = executeAlgsetScript(script, {
            tree: this.state.tree,
            scopePath: modal.scopePath || '',
            selectedPath: this.state.selectedPath,
            template: this.state.caseTemplate
        });
        const summary = formatScriptSummary(result.summary);
        if (!result.ok) {
            this.update({ modal: { ...modal, script, summary }, contextMenu: null });
            showFloatingMessage('Script did not run', 'error');
            return;
        }
        const deletedCount = result.summary.deletedCases + result.summary.deletedFolders;
        if (deletedCount > 5) {
            this.openConfirm('Run Script', `This script deletes ${deletedCount} items. Run it anyway?`, () => {
                this.applyAlgsetScriptResult(result, { ...modal, script, summary });
            }, () => {
                this.update({ modal: { ...modal, script, summary: `${summary}\n\nCancelled before applying deletes.` }, contextMenu: null });
            });
            return;
        }
        this.applyAlgsetScriptResult(result, { ...modal, script, summary });
    }

    applyAlgsetScriptResult(result, modal) {
        this.state.tree = result.tree;
        this.pruneExpandedFolderState();
        if (this.state.selectedPath && !getNode(this.state.tree, this.state.selectedPath)) {
            this.state.selectedPath = '';
            saveSelection(this.state.activeRoot, '');
        }
        if (this.state.editorPath && !getNode(this.state.tree, this.state.editorPath)) {
            this.state.editorPath = '';
            this.state.editor = { type: 'welcome', tab: 'shape' };
        }
        this.persistRoot();
        showFloatingMessage('Script ran', 'success');
        this.update({ modal: { ...modal, summary: modal.summary }, contextMenu: null });
    }

    openCaseTemplate() {
        this.state.templateDraft = createTemplateDraft(this.state.caseTemplate);
        this.state.contextMenu = null;
        this.state.editor = { type: 'template', tab: 'shape' };
        this.render();
    }

    saveCaseTemplate() {
        this.state.caseTemplate = clone(this.state.templateDraft || createTemplateDraft(null));
        saveTemplate(this.state.activeRoot, this.state.caseTemplate);
        showFloatingMessage('Case template saved successfully', 'success');
        this.setEditor('welcome');
    }

    clearCaseTemplate() {
        this.openConfirm('Clear Template', 'Are you sure you want to clear the case template?', () => {
            this.state.caseTemplate = null;
            this.state.templateDraft = null;
            clearTemplate(this.state.activeRoot);
            showFloatingMessage('Case template cleared', 'success');
            this.closeModal(false);
        });
    }

    setSelectedAsTemplate(path = this.state.selectedPath) {
        const item = getNode(this.state.tree, path);
        if (!isCase(item)) return;
        this.openConfirm('Set as Template', 'Do you want to override your current template?', () => {
            const template = clone(item);
            delete template.caseName;
            delete template.alg;
            this.state.caseTemplate = template;
            saveTemplate(this.state.activeRoot, template);
            showFloatingMessage('Case set as template', 'success');
            this.closeModal(false);
        });
    }

    resetCase(path = this.state.editorPath) {
        const item = getNode(this.state.tree, path);
        if (!isCase(item)) return showFloatingMessage('No case selected', 'info');
        const info = getParent(this.state.tree, path);
        if (!info) return;
        const name = info.key;
        info.parent[name] = createCaseFromTemplate(name, this.state.caseTemplate);
        this.persistRoot();
        showFloatingMessage('Case reset to template', 'success');
        this.render();
    }

    updateLayer(layer, rawValue) {
        const value = String(rawValue || '').toUpperCase().slice(0, 12);
        const target = this.getEditingTarget();
        if (!target) return;
        target[this.getLayerField(layer)] = value;
        this.state.algorithm.text = '';
        this.state.algorithm.tempHex = null;
        if (this.state.editor.type === 'case') this.persistRoot();
        this.syncShapeLayerCode(layer, value);
        this.renderShapeVisuals();
    }

    resetLayer(layer) {
        const target = this.getEditingTarget();
        if (!target) return;
        const field = this.getLayerField(layer);
        target[field] = this.state.caseTemplate?.[field] || DEFAULT_LAYER;
        if (this.state.editor.type === 'case') this.persistRoot();
        this.render();
    }

    updateCurrentField(field, value) {
        const item = this.getEditorCase();
        if (!isCase(item)) return;
        item[field] = value;
        this.persistRoot();
    }

    updateArrayField(prefix, field, value, checked) {
        const target = prefix === 'template' ? this.state.templateDraft : this.getEditorCase();
        if (!target) return;
        if (!Array.isArray(target[field])) target[field] = [];
        if (checked && !target[field].includes(value)) target[field].push(value);
        if (!checked) target[field] = target[field].filter((entry) => entry !== value);
        if (prefix !== 'template') this.persistRoot();
    }

    updateParityMode(prefix, mode) {
        const target = prefix === 'template' ? this.state.templateDraft : this.getEditorCase();
        if (!target) return;
        if (mode === 'ignore') target.parity = [];
        else if (mode === 'overall') target.parity = ['on'];
        else target.parity = ['tnbn'];
        if (prefix !== 'template') this.persistRoot();
        this.render();
    }

    addConstraint(prefix) {
        const position = this.root?.querySelector('#constraintPosition')?.value.trim();
        const values = this.root?.querySelector('#constraintValues')?.value.split(',').map((value) => value.trim()).filter(Boolean) || [];
        if (!position || !values.length) return showFloatingMessage('Please enter both position and values', 'error');
        const target = prefix === 'template' ? this.state.templateDraft : this.getEditorCase();
        if (!target) return;
        target.constraints = target.constraints || {};
        target.constraints[position] = values;
        if (prefix !== 'template') this.persistRoot();
        this.render();
    }

    removeConstraint(position) {
        const target = this.getEditingTarget();
        if (!target?.constraints) return;
        delete target.constraints[position];
        if (this.state.editor.type === 'case') this.persistRoot();
        this.render();
    }

    getEditingTarget() {
        return this.state.editor.type === 'template' ? this.state.templateDraft : this.getEditorCase();
    }

    getLayerField(layer) {
        return layer === 'bottom' ? 'inputBottom' : 'inputTop';
    }

    getCurrentLayerValue(layer) {
        const target = this.getEditingTarget();
        return target?.[this.getLayerField(layer)] || DEFAULT_LAYER;
    }

    isValidLayerValue(value) {
        return /^[0-9A-FECWXYZR]{12}$/i.test(String(value || ''));
    }

    startShapeValueEdit(layer) {
        if (layer !== 'top' && layer !== 'bottom') return;
        const value = this.getCurrentLayerValue(layer);
        this.state.shapeValueEdit = {
            layer,
            value,
            original: value,
            invalid: false
        };
        this.render();
    }

    commitShapeValueEdit() {
        const edit = this.state.shapeValueEdit;
        if (!edit) return true;
        const value = String(edit.value || '').trim().toUpperCase();
        if (!this.isValidLayerValue(value)) {
            showFloatingMessage('Invalid state. Enter a valid 12-character shape value.', 'error');
            this.state.shapeValueEdit = { ...edit, value, invalid: true };
            this.render();
            return false;
        }
        const target = this.getEditingTarget();
        if (!target) {
            this.state.shapeValueEdit = null;
            this.render();
            return true;
        }
        target[this.getLayerField(edit.layer)] = value;
        this.state.algorithm.text = '';
        this.state.algorithm.tempHex = null;
        this.state.shapeValueEdit = null;
        if (this.state.editor.type === 'case') this.persistRoot();
        this.render();
        return true;
    }

    cancelShapeValueEdit() {
        this.state.shapeValueEdit = null;
        this.render();
    }

    syncShapeLayerCode(layer, value) {
        const code = this.root?.querySelector(`.shape-layer-code[data-layer="${layer}"]`);
        if (code) code.textContent = value || DEFAULT_LAYER;
    }

    async copyShapeValue(layer) {
        const value = this.getCurrentLayerValue(layer);
        try {
            await navigator.clipboard.writeText(value);
            showFloatingMessage('Shape value copied', 'success', 1800);
        } catch (error) {
            showFloatingMessage(`Failed to copy: ${error.message}`, 'error');
        }
    }

    handleAlgorithmInput(text) {
        this.state.algorithm.text = text;
        this.state.algorithm.tempHex = null;
    }

    applyAlgorithmInput(appendToAlgorithm = false) {
        const target = this.getEditingTarget();
        if (!target) return showFloatingMessage('No case is open', 'error');
        const algorithmText = this.state.algorithm.text.trim();
        if (!algorithmText) return showFloatingMessage('No algorithm to apply', 'error');
        let hex;
        try {
            hex = normalizeAlgorithmInput(algorithmText, 'inverse');
        } catch (error) {
            showFloatingMessage(`Invalid algorithm: ${error.message}`, 'error');
            return;
        }
        target.inputTop = hex.tlHex || target.inputTop;
        target.inputBottom = hex.blHex || target.inputBottom;
        this.state.algorithm.tempHex = null;
        if (appendToAlgorithm && isCase(target)) {
            target.alg = [target.alg || '', algorithmText].filter(Boolean).join('\n').trim();
        }
        if (this.state.editor.type === 'case') this.persistRoot();
        showFloatingMessage(appendToAlgorithm ? 'Algorithm applied and appended' : 'Algorithm applied successfully', 'success');
        this.render();
    }

    async renderShapeVisuals() {
        if (!this.root?.querySelector('.shape-renderer')) return;
        if (!this.shapeRenderPromise) this.shapeRenderPromise = ensureFeatureModules().catch(() => null);
        await this.shapeRenderPromise;
        if (!window.InteractiveScrambleRenderer) return;
        const target = this.getEditingTarget();
        if (!target) return;
        const colorScheme = this.getInteractiveColorScheme();
        for (const layer of ['top', 'bottom']) {
            const container = this.root.querySelector(`#${layer}Interactive`);
            if (!container) continue;
            const value = target[layer === 'top' ? 'inputTop' : 'inputBottom'] || DEFAULT_LAYER;
            if (value.length !== 12) {
                container.innerHTML = `<div style="padding:40px;color:var(--devtool-muted,#777);">Enter 12 layer characters</div>`;
                continue;
            }
            if (!/^[0-9A-FECWXYZR]{12}$/i.test(value)) {
                container.innerHTML = `<div style="padding:40px;color:var(--devtool-muted,#777);">Invalid layer input</div>`;
                continue;
            }
            try {
                const state = new window.InteractiveScrambleRenderer.InteractiveScrambleState(
                    layer === 'top' ? value : '',
                    layer === 'bottom' ? value : '',
                    colorScheme
                );
                state.onChange((nextState) => {
                    const field = this.getLayerField(layer);
                    const nextValue = nextState.getText(layer);
                    if (!nextValue || nextValue.length !== 12) return;
                    target[field] = nextValue;
                    this.state.algorithm.text = '';
                    this.state.algorithm.tempHex = null;
                    const input = this.root?.querySelector(`#${layer}LayerInput`);
                    if (input) input.value = nextValue;
                    this.syncShapeLayerCode(layer, nextValue);
                    if (this.state.editor.type === 'case') this.persistRoot();
                });
                container.innerHTML = window.InteractiveScrambleRenderer.createInteractiveSVG(state, { size: 200 });
                window.InteractiveScrambleRenderer.setupInteractiveEvents(state, `${layer}Interactive`);
            } catch {
                container.innerHTML = `<div style="padding:40px;color:var(--devtool-muted,#777);">Invalid layer input</div>`;
            }
        }
    }

    async renderScriptPickerVisual() {
        const picker = this.state.modal?.type === 'algset-script' ? this.state.modal.scriptPicker : null;
        const container = this.root?.querySelector('#scriptLayerPickerInteractive');
        if (!picker || picker.kind !== 'layer' || !container) return;
        if (!this.shapeRenderPromise) this.shapeRenderPromise = ensureFeatureModules().catch(() => null);
        await this.shapeRenderPromise;
        if (!window.InteractiveScrambleRenderer) return;
        const layer = picker.field === 'bottom-layer' ? 'bottom' : 'top';
        const value = /^[0-9A-FECWXYZR]{12}$/i.test(picker.value || '') ? picker.value.toUpperCase() : DEFAULT_LAYER;
        const colorScheme = this.getInteractiveColorScheme();
        try {
            const state = new window.InteractiveScrambleRenderer.InteractiveScrambleState(
                layer === 'top' ? value : '',
                layer === 'bottom' ? value : '',
                colorScheme
            );
            state.onChange((nextState) => {
                const nextValue = nextState.getText(layer);
                if (!nextValue || nextValue.length !== 12) return;
                picker.value = nextValue;
                const input = this.root?.querySelector('#scriptLayerPickerInput');
                if (input) input.value = nextValue;
            });
            container.innerHTML = window.InteractiveScrambleRenderer.createInteractiveSVG(state, { size: 240 });
            window.InteractiveScrambleRenderer.setupInteractiveEvents(state, 'scriptLayerPickerInteractive');
        } catch {
            container.innerHTML = `<div style="padding:40px;color:var(--devtool-muted,#777);">Invalid layer input</div>`;
        }
    }

    getInteractiveColorScheme() {
        const base = window.InteractiveScrambleRenderer.DEFAULT_COLOR_SCHEME;
        if (AppState.settings.theme !== 'dark') return base;
        return {
            ...base,
            placeholderWhiteEdge: '#d8ecffff',
            placeholderWhiteCorner: '#d8ecffff',
            placeholderEdge: '#6687a8',
            placeholderCorner: '#6687a8',
            emptyFill: '#071321ff',
            emptyStroke: '#244b70',
            ringStroke: 'transparent',
            pieceStroke: '#315b83',
            cornerRingStroke: 'transparent',
            interactionZoneFill: 'rgba(49,91,131,0.08)',
            interactionZoneStroke: '#315b83'
        };
    }

    async processFileImport(mode) {
        const file = this.root?.querySelector('#jsonImportFile')?.files?.[0];
        if (!file) return showFloatingMessage('Please select a JSON file', 'error');
        try {
            const text = await readFileAsText(file);
            const data = JSON.parse(text);
            if (this.state.modal.scope === 'root') {
                if (mode === 'override') this.state.tree = normalizeTree(data);
                else deepMergeTree(this.state.tree, data);
                this.persistRoot();
                this.closeModal(false);
                showFloatingMessage('Data imported to root successfully', 'success');
                return;
            }
            if (mode === 'override') {
                AppState.developingJSONs = normalizeRoots(data, DEFAULT_ALGSET);
                AppState.activeDevelopingJSON = Object.keys(AppState.developingJSONs)[0] || 'default';
            } else {
                const roots = normalizeRoots(data, DEFAULT_ALGSET);
                for (const [rootName, tree] of Object.entries(roots)) {
                    let finalName = rootName;
                    let counter = 1;
                    while (AppState.developingJSONs[finalName]) {
                        finalName = `${rootName}_${counter}`;
                        counter += 1;
                    }
                    AppState.developingJSONs[finalName] = tree;
                }
            }
            saveDevelopingJSONs();
            this.closeModal(false);
            this.switchRoot(AppState.activeDevelopingJSON);
        } catch (error) {
            showFloatingMessage(`Invalid JSON: ${error.message}`, 'error');
        }
    }

    async processBulkImport() {
        const file = this.root?.querySelector('#bulkImportFile')?.files?.[0];
        if (!file) return showFloatingMessage('Please select a CSV or XLSX file', 'error');
        try {
            const rows = await this.readRows(file);
            const target = getTargetFolder(this.state.tree, this.state.modal?.targetPath ?? this.state.selectedPath);
            let success = 0;
            let failed = 0;
            for (const row of rows) {
                const caseName = String(row[0] || '').trim();
                const algorithm = String(row[1] || '').trim();
                const hintAlgorithm = String(row[2] || algorithm).trim();
                if (!caseName || !algorithm) {
                    failed += 1;
                    continue;
                }
                try {
                    const hex = normalizeAlgorithmInput(algorithm, 'inverse');
                    const finalName = getUniqueName(target.folder, caseName);
                    target.folder[finalName] = createCaseFromTemplate(finalName, this.state.caseTemplate);
                    target.folder[finalName].alg = hintAlgorithm;
                    target.folder[finalName].inputTop = hex.tlHex;
                    target.folder[finalName].inputBottom = hex.blHex;
                    success += 1;
                } catch (error) {
                    failed += 1;
                    console.error(`Failed to process case "${caseName}":`, error);
                }
            }
            if (target.path) this.state.expandedFolders.add(target.path);
            this.persistRoot();
            this.closeModal(false);
            showFloatingMessage(`Bulk import complete: ${success} cases imported, ${failed} failed`, failed ? 'info' : 'success');
        } catch (error) {
            showFloatingMessage(`Failed to process file: ${error.message}`, 'error');
        }
    }

    async readRows(file) {
        if (file.name.endsWith('.xlsx')) {
            await ensureXlsxScript();
            const data = await file.arrayBuffer();
            const workbook = window.XLSX.read(data, { type: 'array' });
            const sheet = workbook.Sheets[workbook.SheetNames[0]];
            return window.XLSX.utils.sheet_to_json(sheet, { header: 1 });
        }
        const text = await readFileAsText(file);
        if (typeof window.Papa !== 'undefined') return window.Papa.parse(text).data;
        return text.split(/\r?\n/).map((line) => line.split(',').map((cell) => cell.trim()));
    }

    resetRoot() {
        this.openConfirm('Reset Root', `Reset root "${this.state.activeRoot}"? This cannot be undone.`, () => {
            this.state.tree = {};
            this.state.selectedPath = '';
            this.state.editorPath = '';
            this.state.editor = { type: 'welcome', tab: 'shape' };
            this.state.expandedFolders.clear();
            this.state.caseTemplate = null;
            clearTemplate(this.state.activeRoot);
            clearExpandedFolders(this.state.activeRoot);
            this.persistRoot();
            showFloatingMessage('Root reset successfully', 'success');
            this.closeModal(false);
        });
    }

    resetAllData() {
        this.openConfirm('Reset All Data', 'Are you sure you want to reset ALL data?', () => {
            AppState.developingJSONs = { default: normalizeTree(DEFAULT_ALGSET) };
            AppState.activeDevelopingJSON = 'default';
            saveDevelopingJSONs();
            this.state.activeRoot = 'default';
            this.state.tree = clone(AppState.developingJSONs.default);
            this.state.selectedPath = '';
            this.state.editorPath = '';
            this.state.editor = { type: 'welcome', tab: 'shape' };
            this.state.expandedFolders.clear();
            this.state.caseTemplate = null;
            clearExpandedFolders('default');
            this.saveExpandedFolderState();
            showFloatingMessage('All data has been reset', 'success');
            this.closeModal(false);
        });
    }

    exportAllData() {
        this.persistRoot();
        downloadJSON('sq1-all-data', AppState.developingJSONs);
    }

    runSelectedCase() {
        this.runPath(this.state.editorPath);
    }

    runPath(path) {
        const item = getNode(this.state.tree, path);
        const name = path ? getPathName(path) : this.state.activeRoot;
        if (!item) return;
        const pathParts = splitPath(path);
        if (isCase(item)) this.openRunModal({ [pathParts.at(-1) || item.caseName]: item }, item.caseName, pathParts.slice(0, -1));
        else this.openRunModal(item, name, pathParts);
    }

    runJSON() {
        this.openRunModal(this.state.tree, this.state.activeRoot);
    }

    openRunModal(data, name, basePath = []) {
        const cases = collectCases(isCase(data) ? { [name]: data } : data, basePath);
        this.state.run = { name, cases, results: [], progress: 0, stopped: false, done: false, scrollTop: 0 };
        this.render();
        void this.generateRunResults();
    }

    async generateRunResults() {
        const run = this.state.run;
        if (!run) return;
        if (!run.cases.length) {
            run.done = true;
            run.progress = 100;
            this.syncRunProgress();
            return;
        }
        const modules = await ensureFeatureModules();
        const { generateHexState } = modules.hexState;
        for (let index = 0; index < RUN_COUNT; index += 1) {
            if (!this.state.run || this.state.run.stopped) break;
            const picked = run.cases[Math.floor(Math.random() * run.cases.length)];
            let resultData;
            try {
                const config = {
                    topLayer: picked.item.inputTop,
                    bottomLayer: picked.item.inputBottom,
                    middleLayer: picked.item.equator || ['/'],
                    RUL: picked.item.rul || [0],
                    RDL: picked.item.rdl || [0],
                    AUF: picked.item.auf || ['U0'],
                    ADF: picked.item.adf || ['D0'],
                    constraints: picked.item.constraints || {},
                    parity: picked.item.parity || ['on']
                };
                const generated = generateHexState(config);
                let scramble = 'Solver not loaded';
                for (let attempt = 0; attempt < 10; attempt += 1) {
                    try {
                        if (typeof window.Square1Solver?.solve === 'function') {
                            scramble = window.Square1Solver.solve(generated.hexState);
                        }
                        break;
                    } catch (error) {
                        const retry = isRecoverableSolverRandomizationError(error);
                        if (!retry || attempt === 9) {
                            scramble = `Error: ${cleanSolverErrorMessage(error)}`;
                            break;
                        }
                        await new Promise((resolve) => setTimeout(resolve, 10));
                    }
                }

                const [auf = 'U0', adf = 'D0'] = String(generated.abf || 'U0-D0').split('-');
                const rblMatch = String(generated.rbl || '').match(/RUL:(-?\d+), RDL:(-?\d+)/);
                const rul = rblMatch ? rblMatch[1] : '0';
                const rdl = rblMatch ? rblMatch[2] : '0';
                const viz = typeof window.Square1VisualizerLibraryWithSillyNames?.visualizeFromHexCodePlease === 'function'
                    ? window.Square1VisualizerLibraryWithSillyNames.visualizeFromHexCodePlease(
                        generated.hexState,
                        150,
                        {
                            topColor: '#000000',
                            bottomColor: '#FFFFFF',
                            frontColor: '#CC0000',
                            rightColor: '#00AA00',
                            backColor: '#FF8C00',
                            leftColor: '#0066CC',
                            dividerColor: '#7a0000',
                            circleColor: 'transparent'
                        },
                        5
                    )
                    : '';

                resultData = {
                    caseName: picked.item.caseName,
                    path: picked.labelPath,
                    scramble: formatScrambleDisplay(scramble),
                    postAbf: `(${faceMoveToNumber(auf)},${faceMoveToNumber(adf)})`,
                    preAbf: `(${rul},${rdl})`,
                    equator: equatorLabel(generated.equator),
                    viz
                };
            } catch (error) {
                resultData = {
                    caseName: picked.item.caseName,
                    path: picked.labelPath,
                    scramble: `Error: ${error.message}`,
                    postAbf: '(-,-)',
                    preAbf: '(-,-)',
                    equator: '-',
                    viz: ''
                };
            }
            run.results.push(resultData);
            run.progress = Math.round(((index + 1) / RUN_COUNT) * 100);
            this.appendRunResult(resultData);
            this.syncRunProgress();
            await new Promise((resolve) => setTimeout(resolve, 50));
        }
        if (this.state.run) {
            this.state.run.done = true;
            this.syncRunProgress();
        }
    }

    appendRunResult(result) {
        const body = this.root?.querySelector('.run-modal-body');
        if (!body) {
            this.render();
            return;
        }
        body.insertAdjacentHTML('beforeend', this.renderRunResult(result));
    }

    syncRunProgress() {
        const run = this.state.run;
        if (!run) return;
        const fill = this.root?.querySelector('.progress-bar-fill');
        const text = this.root?.querySelector('.progress-text');
        const stop = this.root?.querySelector('[data-action="stop-run"]');
        if (fill) fill.style.width = `${run.progress}%`;
        if (text) text.textContent = `${run.results.length} / ${RUN_COUNT}`;
        if (stop) stop.disabled = run.stopped || run.done;
    }

    stopRun() {
        if (!this.state.run) return;
        this.state.run.stopped = true;
        this.state.run.done = true;
        this.render();
    }

    closeRun() {
        if (this.state.run) this.state.run.stopped = true;
        this.state.run = null;
        this.render();
    }

    openConfirm(title, message, onConfirm, onCancel = null) {
        this.update({ modal: { type: 'confirm', title, message, onConfirm, onCancel }, contextMenu: null });
    }

    openRename(title, value, onConfirm) {
        this.update({ modal: { type: 'rename', title, value, onConfirm }, contextMenu: null });
    }

    closeModal(cancelled) {
        const modal = this.state.modal;
        this.state.modal = null;
        this.state.contextMenu = null;
        if (cancelled && modal?.onCancel) modal.onCancel();
        this.render();
    }

    confirmModal() {
        const callback = this.state.modal?.onConfirm;
        if (callback) callback();
        else this.closeModal(false);
    }

    confirmRename() {
        const modal = this.state.modal;
        const value = this.root?.querySelector('#renameInput')?.value.trim();
        if (!modal?.onConfirm || !value) return;
        modal.onConfirm(value);
    }

    copyItemJSON(path = this.state.selectedPath) {
        const item = getNode(this.state.tree, path);
        if (!item) return;
        void navigator.clipboard.writeText(JSON.stringify(item, null, 2))
            .then(() => showFloatingMessage('Item JSON copied', 'success'))
            .catch((error) => showFloatingMessage(`Failed to copy: ${error.message}`, 'error'));
        this.update({ contextMenu: null });
    }

    close() {
        this.persistRoot();
        saveLastScreen('training');
        this.abortController?.abort();
        this.root?.remove();
        this.root = null;
        renderApp();
        if (AppState.selectedCases.length > 0) void generateNewScramble();
    }
}

let jsonCreator = new JSONCreator();

function showJsonCreatorFullscreen() {
    jsonCreator = new JSONCreator();
    window.jsonCreator = jsonCreator;
    jsonCreator.show();
}

function closeJsonCreator() {
    jsonCreator.close();
}

Object.assign(window, {
    jsonCreator,
    showJsonCreatorFullscreen,
    closeJsonCreator
});

export { JSONCreator, closeJsonCreator, showJsonCreatorFullscreen };

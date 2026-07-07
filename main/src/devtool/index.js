import { ensureFeatureModules, ensureXlsxScript } from '../moduleLoader.js';
import { AppState, DEFAULT_ALGSET, generateNewScramble, renderApp, saveDevelopingJSONs, saveLastScreen } from '../training.js';
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
    getTargetFolder,
    getUniqueName,
    isCase,
    isFolder,
    normalizeRoots,
    normalizeTree,
    sanitizeFilename
} from './model.js';
import {
    clearTemplate,
    loadSelection,
    loadTemplate,
    saveSelection,
    saveTemplate
} from './storage.js';
import { normalizeAlgorithmInput } from './parseAdapter.js';

const RUN_COUNT = 100;
const SQUANX_WORDMARK = '<span class="squanx-brand"><span class="squango-sq">Squan</span><span class="squango-go">X</span></span>';

function faceMoveToNumber(move) {
    const value = String(move || '').trim();
    if (!value || value.endsWith('0')) return '0';
    if (value.endsWith('2')) return '2';
    if (value.endsWith("'")) return '-1';
    return '1';
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

function readFileAsText(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (event) => resolve(String(event.target?.result || ''));
        reader.onerror = () => reject(reader.error || new Error('Failed to read file'));
        reader.readAsText(file);
    });
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
        if (!AppState.activeDevelopingJSON || !AppState.developingJSONs[AppState.activeDevelopingJSON]) {
            AppState.activeDevelopingJSON = Object.keys(AppState.developingJSONs)[0] || 'default';
        }

        this.state.activeRoot = AppState.activeDevelopingJSON;
        this.state.tree = clone(AppState.developingJSONs[this.state.activeRoot] || {});
        this.state.caseTemplate = loadTemplate(this.state.activeRoot);
        this.state.expandedFolders = new Set(collectFolders(this.state.tree).map((folder) => folder.path));
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
        this.root.addEventListener('keydown', (event) => this.handleRootKeydown(event), options);
        this.root.addEventListener('scroll', () => this.closeInfoBoxes(), { ...options, capture: true });
        document.addEventListener('keydown', (event) => this.handleDocumentKeydown(event), options);
    }

    restoreSelection() {
        const selection = loadSelection();
        if (selection.root === this.state.activeRoot && selection.path && getNode(this.state.tree, selection.path)) {
            this.state.selectedPath = selection.path;
            saveSelection(this.state.activeRoot, selection.path);
            const selected = getNode(this.state.tree, selection.path);
            if (isCase(selected)) {
                this.state.editorPath = selection.path;
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
        AppState.developingJSONs[this.state.activeRoot] = clone(this.state.tree);
        saveDevelopingJSONs();
    }

    render() {
        if (!this.root) return;
        const runBodyScrollTop = this.root.querySelector('.run-modal-body')?.scrollTop ?? 0;
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
        this.afterRender({ runBodyScrollTop });
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
                    <button id="rootSelectorBtn" class="json-creator-btn json-creator-btn-secondary" data-action="open-root-selector">${escapeHtml(this.state.activeRoot)}</button>
                </div>
                <div style="display:flex;align-items:center;gap:8px;margin-left:auto;">
                    <button class="json-creator-icon-btn" data-action="open-data-management" title="Data Management"><img src="viz/data.svg" width="16" height="16" alt=""></button>
                    <button class="json-creator-icon-btn" data-action="toggle-theme" title="Toggle Theme"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${themeIcon}</svg></button>
                    <button class="json-creator-icon-btn" data-action="extract-json" title="Extract JSON"><img src="viz/extract.svg" width="16" height="16" alt=""></button>
                    <button class="json-creator-icon-btn" data-action="run-root" title="Run"><img src="viz/run.svg" width="16" height="16" alt=""></button>
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
                const expander = folder ? (expanded ? '▾' : '▸') : '';
                const childMarkup = folder && expanded ? this.renderTreeNode(item, currentPath, level + 1) : '';
                return `
                    <div class="json-creator-tree-item ${selected}" data-path="${escapeHtml(currentPath)}" data-kind="${folder ? 'folder' : 'case'}" data-action="select-tree-item" style="padding-left:${8 + level * 16}px">
                        <span class="tree-expand-icon" data-action="toggle-folder" data-path="${escapeHtml(currentPath)}">${expander}</span>
                        <img class="tree-icon" src="viz/${folder ? 'folder' : 'case'}.svg" width="14" height="14" alt="">
                        <span class="tree-item-text">${escapeHtml(key)}</span>
                    </div>
                    ${childMarkup}
                `;
            })
            .join('');
    }

    renderEditorHeader() {
        const selected = this.getEditorCase();
        let title = SQUANX_WORDMARK;
        let subtitle = 'Case Editor';
        if (this.state.editor.type === 'case' && isCase(selected)) {
            const name = selected.caseName || this.state.editorPath.split('/').pop();
            title = `Case: ${escapeHtml(name)} <button class="json-creator-icon-btn" data-action="run-case" title="Run This Case" style="margin-left:8px;display:inline-flex;vertical-align:middle;"><img src="viz/run.svg" width="14" height="14" alt=""></button><button class="json-creator-icon-btn" data-action="reset-case" title="Reset Case to Template" style="margin-left:4px;display:inline-flex;vertical-align:middle;"><img src="viz/reset.svg" width="14" height="14" alt=""></button>`;
            subtitle = '';
        } else if (this.state.editor.type === 'template') {
            title = `Case Template <button class="json-creator-icon-btn" data-action="save-template" title="Save Template" style="margin-left:8px;display:inline-flex;vertical-align:middle;"><img src="viz/save.svg" width="14" height="14" alt=""></button> <button class="json-creator-icon-btn" data-action="clear-template" title="Clear Template" style="margin-left:4px;display:inline-flex;vertical-align:middle;"><img src="viz/reset.svg" width="14" height="14" alt=""></button>`;
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
            <div class="case-editor-tabs">
                <button class="case-editor-tab ${this.state.editor.tab === 'shape' ? 'active' : ''}" data-action="template-tab" data-tab="shape">Shape Input</button>
                <button class="case-editor-tab ${this.state.editor.tab === 'additional' ? 'active' : ''}" data-action="template-tab" data-tab="additional">Additional Information</button>
            </div>
            <div id="templateEditorContent">${this.state.editor.tab === 'shape' ? this.renderShapeTab(draft, true) : this.renderAdditionalTab(draft, true)}</div>
        `;
    }

    renderShapeTab(item, template) {
        const prefix = template ? 'template' : 'case';
        return `
            ${this.renderAlgorithmInput()}
            <div class="shape-layer-grid">
                ${this.renderLayerInput('top', item.inputTop || DEFAULT_LAYER, prefix)}
                ${this.renderLayerInput('bottom', item.inputBottom || DEFAULT_LAYER, prefix)}
            </div>
            <div class="json-creator-section">
                <h4>Constraints</h4>
                <p style="font-size:12px;color:var(--devtool-muted,#666);margin:0 0 12px;font-style:italic;">Don't touch this unless you know what you are doing</p>
                ${this.renderConstraints(item.constraints || {})}
                <div class="json-creator-form-group">
                    <label>Position (e.g., A, BC, D)</label>
                    <input id="constraintPosition" placeholder="Enter position...">
                </div>
                <div class="json-creator-form-group">
                    <label>Allowed Pieces (comma-separated)</label>
                    <input id="constraintValues" placeholder="e.g., 1,3,5,7">
                </div>
                <button class="json-creator-btn" data-action="add-constraint" data-prefix="${prefix}">Add Constraint</button>
            </div>
        `;
    }

    renderLayerInput(layer, value, prefix) {
        const title = layer === 'top' ? 'Top layer' : 'Bottom layer';
        return `
            <div class="json-creator-section shape-layer-card">
                <h4>${title}</h4>
                <input id="${layer}LayerInput" class="shape-layer-input" data-layer="${layer}" data-prefix="${prefix}" maxlength="12" value="${escapeHtml(value || DEFAULT_LAYER)}" spellcheck="false">
                <button class="json-creator-icon-btn" data-action="reset-layer" data-layer="${layer}" title="Reset ${title}"><img src="viz/reset.svg" width="14" height="14" alt=""></button>
                <div id="${layer}Interactive" class="shape-renderer" data-layer="${layer}" style="display:flex;justify-content:center;margin-top:12px;min-height:210px;"></div>
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
                    <h4>Algorithm</h4>
                    <input id="caseAlgorithm" data-field="alg" value="${escapeHtml(item.alg || '')}">
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
        if (!entries.length) return '<p style="color:var(--devtool-muted,#777);">No constraints set.</p>';
        return entries.map(([position, values]) => `
            <div style="display:flex;justify-content:space-between;gap:12px;align-items:center;margin-bottom:8px;">
                <span><strong>${escapeHtml(position)}</strong>: ${escapeHtml(values.join(', '))}</span>
                <button class="json-creator-btn json-creator-btn-secondary" data-action="remove-constraint" data-position="${escapeHtml(position)}">Remove</button>
            </div>
        `).join('');
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
            <div class="context-menu" data-context-menu style="left:${menu.x}px;top:${menu.y}px;">
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
            <div class="root-selector-modal">
                <div id="rootList" class="root-list">
                    ${names.map((root) => `<div class="root-list-item ${root === this.state.activeRoot ? 'active' : ''}" data-action="select-root" data-root="${escapeHtml(root)}">${escapeHtml(root)}</div>`).join('')}
                </div>
                <div class="root-selector-footer"><button class="json-creator-btn" data-action="add-root">New Root</button></div>
            </div>
        `;
    }

    renderExtractModal() {
        return `
            <div class="modal active extract-json-modal" data-action="modal-backdrop">
                <div class="modal-content extract-json-content">
                    <div class="modal-header"><h2>Extract JSON: ${escapeHtml(this.state.activeRoot)}</h2><button class="close-btn" data-action="modal-cancel">×</button></div>
                    <div class="modal-body extract-json-body">
                        <textarea id="extractedJSON" readonly style="width:100%;height:55vh;font-family:monospace;">${escapeHtml(JSON.stringify(this.state.tree, null, 2))}</textarea>
                        <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:12px;">
                            <button class="json-creator-btn json-creator-btn-secondary" data-action="copy-extracted-json">Copy</button>
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
                <div class="modal-content devtool-modal" style="max-width:600px;">
                    <div class="modal-header"><h2>${escapeHtml(modal.title)}</h2><button class="close-btn" data-action="modal-cancel">×</button></div>
                    <div class="modal-body">
                        <input type="file" id="jsonImportFile" accept=".json,application/json">
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
                <div class="modal-content devtool-modal" style="max-width:600px;">
                    <div class="modal-header"><h2>Bulk Import</h2><button class="close-btn" data-action="modal-cancel">×</button></div>
                    <div class="modal-body">
                        <p>First column: case name. Second column: algorithm. Normal notation, karnotation, and shorthand are accepted automatically.</p>
                        <input type="file" id="bulkImportFile" accept=".csv,.xlsx">
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
                    <div class="run-modal-body">${run.results.map((result) => `
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
                    `).join('')}</div>
                </div>
            </div>
        `;
    }

    afterRender(options = {}) {
        const rename = this.root?.querySelector('#renameInput');
        if (rename) {
            rename.focus();
            rename.select();
        }
        const runBody = this.root?.querySelector('.run-modal-body');
        if (runBody) {
            runBody.scrollTop = this.state.run?.scrollTop ?? options.runBodyScrollTop ?? 0;
            runBody.addEventListener('scroll', () => {
                if (this.state.run) this.state.run.scrollTop = runBody.scrollTop;
            });
        }
        this.renderShapeVisuals();
    }

    handleClick(event) {
        const target = event.target;
        const infoButton = target.closest('.info-btn');
        if (infoButton && this.root?.contains(infoButton)) {
            this.toggleInfoBox(infoButton);
            return;
        }
        if (!target.closest('.info-box')) this.closeInfoBoxes();
        const actionElement = target.closest('[data-action]');
        if (!actionElement || !this.root?.contains(actionElement)) {
            if (target.id === 'jsonCreatorTree') {
                this.state.selectedPath = '';
                saveSelection(this.state.activeRoot, '');
                this.update({ contextMenu: null });
                return;
            }
            if (this.state.contextMenu || this.state.modal?.type === 'root-selector') {
                this.update({ contextMenu: null, modal: this.state.modal?.type === 'root-selector' ? null : this.state.modal });
            }
            return;
        }
        if (actionElement.classList.contains('disabled')) return;
        const action = actionElement.dataset.action;
        if (actionElement.closest('[data-context-menu]') && this.state.contextMenu?.type !== 'extra') {
            return this.handleContextAction(action);
        }

        if (action === 'modal-backdrop' && target === actionElement) return this.closeModal(true);
        if (action === 'select-tree-item') return this.selectPath(actionElement.dataset.path);
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
        if (action === 'add-root') return this.openRename('New Root', '', (name) => this.addRoot(name));
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
        if (action === 'download-root-json') return this.downloadRootJSON();
        if (action === 'open-case-template') return this.openCaseTemplate();
        if (action === 'import-root-data') return this.update({ modal: { type: 'file-import', scope: 'root', title: `Import Data to Root: ${this.state.activeRoot}` }, contextMenu: null });
        if (action === 'reset-root') return this.resetRoot();
        if (action === 'open-bulk-import') return this.update({ modal: { type: 'bulk-import' }, contextMenu: null });
        if (action === 'process-file-import') return void this.processFileImport(actionElement.dataset.mode);
        if (action === 'process-bulk-import') return void this.processBulkImport();
        if (action === 'export-all-data') return this.exportAllData();
        if (action === 'open-general-import') return this.update({ modal: { type: 'file-import', scope: 'all', title: 'Import Data' } });
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
        const row = event.target.closest('.json-creator-tree-item');
        if (!row) return;
        const path = row.dataset.path;
        const name = path.split('/').pop();
        this.openRename(`Rename ${name}`, name, (newName) => this.renamePath(path, newName));
    }

    handleContextMenu(event) {
        const row = event.target.closest('.json-creator-tree-item');
        if (row) {
            event.preventDefault();
            this.openContextMenu(event.clientX, event.clientY, 'item', row.dataset.path);
            return;
        }
        const rootRow = event.target.closest('.root-list-item');
        if (rootRow) {
            event.preventDefault();
            this.state.contextMenu = {
                type: 'root-item',
                path: '',
                rootName: rootRow.dataset.root,
                x: Math.max(10, Math.min(event.clientX, window.innerWidth - 210)),
                y: Math.max(10, Math.min(event.clientY, window.innerHeight - 260))
            };
            this.render();
            return;
        }
        if (event.target.id === 'jsonCreatorTree') {
            event.preventDefault();
            this.openContextMenu(event.clientX, event.clientY, 'root', '');
        }
    }

    handleInput(event) {
        const target = event.target;
        if (target.matches('.shape-layer-input')) return this.updateLayer(target.dataset.layer, target.value);
        if (target.dataset.action === 'algorithm-input') return void this.handleAlgorithmInput(target.value);
        if (target.dataset.field === 'alg') return this.updateCurrentField('alg', target.value);
    }

    handleChange(event) {
        const target = event.target;
        if (target.dataset.action === 'parity-mode') return this.updateParityMode(target.dataset.prefix, target.value);
        if (target.matches('input[type="checkbox"][data-field]')) {
            const value = target.dataset.valueType === 'number' ? Number(target.dataset.value) : target.dataset.value;
            return this.updateArrayField(target.dataset.prefix, target.dataset.field, value, target.checked);
        }
    }

    handleRootKeydown(event) {
        if (event.key !== 'Enter' && event.key !== 'Escape') return;
        if (event.target.id === 'renameInput') {
            if (event.key === 'Enter') this.confirmRename();
            if (event.key === 'Escape') this.closeModal(false);
        }
    }

    handleDocumentKeydown(event) {
        if (!this.root || !document.body.contains(this.root)) return;
        const editingText = ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName || '');
        if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'c' && !editingText) {
            event.preventDefault();
            this.copy();
        } else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'v' && !editingText) {
            event.preventDefault();
            this.paste();
        } else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'n') {
            event.preventDefault();
            if (event.shiftKey) this.newFolder();
            else this.newCase();
        } else if ((event.key === 'Delete' || event.key === 'Backspace') && !editingText) {
            event.preventDefault();
            this.deleteSelected();
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
        }
        if (shouldRender) this.render();
    }

    toggleFolder(path) {
        if (!path) return;
        if (this.state.expandedFolders.has(path)) this.state.expandedFolders.delete(path);
        else this.state.expandedFolders.add(path);
        this.render();
    }

    newCase(basePath = this.state.selectedPath) {
        const target = getTargetFolder(this.state.tree, basePath);
        const name = getUniqueName(target.folder, 'New Case');
        target.folder[name] = createCaseFromTemplate(name, this.state.caseTemplate);
        if (target.path) this.state.expandedFolders.add(target.path);
        this.persistRoot();
        this.selectPath(childPath(target.path, name), false);
        this.render();
        this.openRename(`Rename ${name}`, name, (newName) => this.renamePath(this.state.selectedPath, newName));
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
        this.openRename(`Rename ${name}`, name, (newName) => this.renamePath(this.state.selectedPath, newName));
    }

    renamePath(path, newName) {
        const trimmed = String(newName || '').trim();
        const info = getParent(this.state.tree, path);
        if (!trimmed || !info || trimmed === info.key) return this.closeModal(false);
        if (info.parent[trimmed]) {
            showFloatingMessage('An item with this name already exists', 'error');
            return;
        }
        const item = info.parent[info.key];
        delete info.parent[info.key];
        info.parent[trimmed] = item;
        if (isCase(item)) item.caseName = trimmed;
        const previousPath = path;
        const renamedPath = childPath(info.parentPath, trimmed);
        this.state.selectedPath = this.replacePathPrefix(this.state.selectedPath, previousPath, renamedPath);
        this.state.editorPath = this.replacePathPrefix(this.state.editorPath, previousPath, renamedPath);
        saveSelection(this.state.activeRoot, this.state.selectedPath);
        this.persistRoot();
        this.closeModal(false);
    }

    copy(path = this.state.selectedPath) {
        const item = getNode(this.state.tree, path);
        if (!item) return showFloatingMessage('Nothing selected', 'info');
        this.state.clipboard = { item: clone(item), name: path.split('/').pop() };
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
        const name = path.split('/').pop();
        this.openConfirm('Delete Item', `Delete "${name}"? This cannot be undone.`, () => {
            const info = getParent(this.state.tree, path);
            if (!info) return;
            delete info.parent[info.key];
            if (this.state.selectedPath === path || this.state.selectedPath.startsWith(`${path}/`)) {
                this.state.selectedPath = '';
                saveSelection(this.state.activeRoot, '');
            }
            if (this.state.editorPath === path || this.state.editorPath.startsWith(`${path}/`)) {
                this.state.editorPath = '';
                this.state.editor = { type: 'welcome', tab: 'shape' };
            }
            this.persistRoot();
            this.closeModal(false);
        });
    }

    openContextMenu(x, y, type, path) {
        const menuWidth = 190;
        const menuHeight = 260;
        this.update({
            contextMenu: {
                type,
                path,
                x: Math.max(10, Math.min(x, window.innerWidth - menuWidth - 10)),
                y: Math.max(10, Math.min(y, window.innerHeight - menuHeight - 10))
            },
            modal: null
        });
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
                { label: 'Bulk Import', action: 'open-bulk-import' }
            ];
        }
        if (menu.type === 'root-item') {
            const isLastRoot = Object.keys(AppState.developingJSONs).length <= 1;
            return [
                { label: 'Rename', action: 'rename-root' },
                { label: 'Export as JSON', action: 'export-root-json' },
                { label: 'Reset', action: 'reset-root-item' },
                { separator: true },
                { label: isLastRoot ? 'Reset Default Root' : 'Delete', action: 'delete-root' }
            ];
        }
        if (menu.type === 'root') {
            return [
                { label: 'New Case', action: 'new-case' },
                { label: 'New Folder', action: 'new-folder' },
                { label: 'Bulk Import', action: 'open-bulk-import' },
                { separator: true },
                { label: 'Paste', action: 'paste', disabled: !this.state.clipboard }
            ];
        }
        const item = getNode(this.state.tree, menu.path);
        const folderItems = isFolder(item)
            ? [
                { label: 'New Case', action: 'new-case' },
                { label: 'New Folder', action: 'new-folder' },
                { label: 'Bulk Import', action: 'open-bulk-import' },
                { separator: true }
            ]
            : [];
        return [
            ...folderItems,
            { label: 'Rename', action: 'rename-selected' },
            { label: 'Run', action: 'run-context' },
            { label: 'Reset Case', action: 'reset-case-context', disabled: !isCase(item) },
            { label: 'Set as Template', action: 'set-as-template', disabled: !isCase(item) },
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
            return this.openRename(`Rename ${rootName}`, rootName, (newName) => this.renameRoot(rootName, newName));
        }
        if (action === 'export-root-json') return this.exportRootJSON(menu.rootName);
        if (action === 'reset-root-item') return this.resetRootName(menu.rootName);
        if (action === 'delete-root') return this.deleteRoot(menu.rootName);
        if (action === 'new-case') return this.newCase(menu.path);
        if (action === 'new-folder') return this.newFolder(menu.path);
        if (action === 'open-bulk-import') return this.update({ modal: { type: 'bulk-import', targetPath: menu.path }, contextMenu: null });
        if (action === 'rename-selected') {
            const name = menu.path.split('/').pop();
            return this.openRename(`Rename ${name}`, name, (newName) => this.renamePath(menu.path, newName));
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
            return;
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
        if (!path) return '';
        if (path === previousPath) return nextPath;
        if (previousPath && path.startsWith(`${previousPath}/`)) return `${nextPath}${path.slice(previousPath.length)}`;
        return path;
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

    switchRoot(rootName) {
        if (!rootName || !AppState.developingJSONs[rootName]) return;
        this.persistRoot();
        AppState.activeDevelopingJSON = rootName;
        this.state.activeRoot = rootName;
        this.state.tree = clone(AppState.developingJSONs[rootName]);
        this.state.caseTemplate = loadTemplate(rootName);
        this.state.selectedPath = '';
        this.state.editorPath = '';
        this.state.editor = { type: 'welcome', tab: 'shape' };
        this.state.expandedFolders = new Set(collectFolders(this.state.tree).map((folder) => folder.path));
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
        this.closeModal(false);
        this.switchRoot(rootName);
    }

    renameRoot(oldName, newName) {
        const rootName = String(newName || '').trim();
        if (!oldName || !rootName || oldName === rootName) return this.closeModal(false);
        if (AppState.developingJSONs[rootName]) return showFloatingMessage('A root with this name already exists', 'error');
        this.persistRoot();
        AppState.developingJSONs[rootName] = AppState.developingJSONs[oldName] || {};
        delete AppState.developingJSONs[oldName];
        if (AppState.activeDevelopingJSON === oldName) AppState.activeDevelopingJSON = rootName;
        saveDevelopingJSONs();
        this.closeModal(false);
        this.switchRoot(AppState.activeDevelopingJSON);
    }

    exportRootJSON(rootName) {
        const root = AppState.developingJSONs[rootName];
        if (!root) return;
        if (rootName === this.state.activeRoot) this.persistRoot();
        downloadJSON(rootName, rootName === this.state.activeRoot ? this.state.tree : root);
        this.update({ contextMenu: null });
    }

    resetRootName(rootName) {
        if (!rootName || !AppState.developingJSONs[rootName]) return;
        AppState.developingJSONs[rootName] = normalizeTree(DEFAULT_ALGSET);
        if (rootName === this.state.activeRoot) {
            this.state.tree = clone(AppState.developingJSONs[rootName]);
            this.state.selectedPath = '';
            this.state.editorPath = '';
            this.state.editor = { type: 'welcome', tab: 'shape' };
            this.state.expandedFolders = new Set(collectFolders(this.state.tree).map((folder) => folder.path));
            this.state.caseTemplate = null;
            clearTemplate(rootName);
        }
        saveDevelopingJSONs();
        showFloatingMessage('Root reset', 'success');
        this.update({ contextMenu: null });
    }

    deleteRoot(rootName) {
        if (!rootName || !AppState.developingJSONs[rootName]) return;
        const roots = Object.keys(AppState.developingJSONs);
        if (roots.length <= 1) {
            this.resetRootName(rootName);
            return;
        }
        delete AppState.developingJSONs[rootName];
        if (AppState.activeDevelopingJSON === rootName) {
            AppState.activeDevelopingJSON = Object.keys(AppState.developingJSONs)[0];
        }
        saveDevelopingJSONs();
        this.state.contextMenu = null;
        this.switchRoot(AppState.activeDevelopingJSON);
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
            await navigator.clipboard.writeText(textarea?.value || JSON.stringify(this.state.tree, null, 2));
            showFloatingMessage('JSON copied to clipboard', 'success');
        } catch (error) {
            showFloatingMessage(`Failed to copy: ${error.message}`, 'error');
        }
    }

    downloadRootJSON() {
        downloadJSON(this.state.activeRoot, this.state.tree);
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
        target[layer === 'top' ? 'inputTop' : 'inputBottom'] = value;
        this.state.algorithm.text = '';
        this.state.algorithm.tempHex = null;
        if (this.state.editor.type === 'case') this.persistRoot();
        this.renderShapeVisuals();
    }

    resetLayer(layer) {
        const target = this.getEditingTarget();
        if (!target) return;
        const field = layer === 'top' ? 'inputTop' : 'inputBottom';
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
            target.alg = [target.alg || '', algorithmText].filter(Boolean).join(' ').trim();
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
                    const field = layer === 'top' ? 'inputTop' : 'inputBottom';
                    const nextValue = nextState.getText(layer);
                    if (!nextValue || nextValue.length !== 12) return;
                    target[field] = nextValue;
                    this.state.algorithm.text = '';
                    this.state.algorithm.tempHex = null;
                    const input = this.root?.querySelector(`#${layer}LayerInput`);
                    if (input) input.value = nextValue;
                    if (this.state.editor.type === 'case') this.persistRoot();
                });
                container.innerHTML = window.InteractiveScrambleRenderer.createInteractiveSVG(state, { size: 200 });
                window.InteractiveScrambleRenderer.setupInteractiveEvents(state, `${layer}Interactive`);
            } catch {
                container.innerHTML = `<div style="padding:40px;color:var(--devtool-muted,#777);">Invalid layer input</div>`;
            }
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
            ringStroke: '#2f5d88',
            pieceStroke: '#315b83'
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
                if (!caseName || !algorithm) {
                    failed += 1;
                    continue;
                }
                try {
                    const hex = normalizeAlgorithmInput(algorithm, 'inverse');
                    const finalName = getUniqueName(target.folder, caseName);
                    target.folder[finalName] = createCaseFromTemplate(finalName, this.state.caseTemplate);
                    target.folder[finalName].alg = algorithm;
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
            this.state.expandedFolders = new Set(collectFolders(this.state.tree).map((folder) => folder.path));
            this.state.caseTemplate = null;
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
        const name = path ? path.split('/').pop() : this.state.activeRoot;
        if (!item) return;
        if (isCase(item)) this.openRunModal({ [item.caseName]: item }, item.caseName);
        else this.openRunModal(item, name);
    }

    runJSON() {
        this.openRunModal(this.state.tree, this.state.activeRoot);
    }

    openRunModal(data, name) {
        const cases = collectCases(isCase(data) ? { [name]: data } : data);
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
            this.render();
            return;
        }
        const modules = await ensureFeatureModules();
        const { generateHexState } = modules.hexState;
        for (let index = 0; index < RUN_COUNT; index += 1) {
            if (!this.state.run || this.state.run.stopped) break;
            const picked = run.cases[Math.floor(Math.random() * run.cases.length)];
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
                        const retry = error.message?.includes("Cannot read properties of undefined (reading 'shift')");
                        if (!retry || attempt === 9) {
                            scramble = `Error: ${error.message}`;
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

                run.results.push({
                    caseName: picked.item.caseName,
                    path: picked.labelPath,
                    scramble,
                    postAbf: `(${faceMoveToNumber(auf)},${faceMoveToNumber(adf)})`,
                    preAbf: `(${rul},${rdl})`,
                    equator: generated.equator,
                    viz
                });
            } catch (error) {
                run.results.push({
                    caseName: picked.item.caseName,
                    path: picked.labelPath,
                    scramble: `Error: ${error.message}`,
                    postAbf: '(-,-)',
                    preAbf: '(-,-)',
                    equator: '-',
                    viz: ''
                });
            }
            run.progress = Math.round(((index + 1) / RUN_COUNT) * 100);
            if ((index + 1) % 5 === 0 || index === RUN_COUNT - 1) this.render();
            await new Promise((resolve) => setTimeout(resolve, 50));
        }
        if (this.state.run) {
            this.state.run.done = true;
            this.render();
        }
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

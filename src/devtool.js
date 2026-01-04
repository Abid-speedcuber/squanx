//Every Update to the state should instantly render to ensure snappyness of the app.

// Utility Functions
function showFloatingMessage(message, type = 'info', duration = 3000) {
    const existing = document.querySelector('.floating-message');
    if (existing) existing.remove();

    // Detect if we're in Algset Devtool context
    const isDevTool = document.getElementById('jsonCreatorFullscreen') !== null;
    const themeClass = isDevTool ? 'devtool-theme' : '';

    const msg = document.createElement('div');
    msg.className = `floating-message ${type} ${themeClass}`;
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

    // Detect if we're in Algset Devtool context
    const isDevTool = document.getElementById('jsonCreatorFullscreen') !== null;
    const modalClass = isDevTool ? 'modal-content devtool-modal' : 'modal-content';

    modal.innerHTML = `
        <div class="${modalClass}">
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

function showRenameModal(title, currentValue, onConfirm) {
    const modal = document.createElement('div');
    modal.className = 'modal active confirmation-modal';
    modal.style.zIndex = '100001';

    // Detect if we're in Algset Devtool context
    const isDevTool = document.getElementById('jsonCreatorFullscreen') !== null;
    const modalClass = isDevTool ? 'modal-content devtool-modal' : 'modal-content';

    modal.innerHTML = `
        <div class="${modalClass}">
            <div class="modal-header">
                <h2>${title}</h2>
            </div>
            <div class="modal-body">
                <input type="text" class="rename-modal-input" id="renameInput" value="${currentValue}">
                <div class="button-group">
                    <button class="btn btn-secondary" id="renameCancelBtn">Cancel</button>
                    <button class="btn btn-primary" id="renameOkBtn">OK</button>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(modal);

    const input = document.getElementById('renameInput');
    input.focus();
    input.select();

    const handleConfirm = () => {
        const value = input.value.trim();
        if (value) {
            modal.remove();
            onConfirm(value);
        }
    };

    document.getElementById('renameOkBtn').onclick = handleConfirm;
    document.getElementById('renameCancelBtn').onclick = () => modal.remove();

    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') handleConfirm();
        if (e.key === 'Escape') modal.remove();
    });

    modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.remove();
    });
}

// Algset Devtool Implementation
class JSONCreator {
    constructor() {
        // Core data
        this.treeData = {};
        this.clipboard = null;
        this.clipboardOperation = '';
        this.caseTemplate = null;
        this.itemOrder = {};
        
        // UI state (separate from editor state)
        this.uiState = {
            selectedPath: '',           // What's selected in the tree
            selectedItem: null,         // Reference to selected item in tree
            expandedFolders: new Set(), // Which folders are expanded
        };
        
        // Editor state (what's actually being edited)
        this.editorState = {
            type: 'welcome',            // 'welcome', 'case', 'template'
            item: null,                 // Item being edited
            itemName: '',               // Name of item being edited
            currentTab: 'shape',        // Current tab in case editor
        };
        
        // Context menu state
        this.contextMenu = null;
        
        // Algorithm input state
        this.algorithmInputMode = localStorage.getItem('algorithmInputMode') === 'true' || false;
        this.algorithmNotationType = localStorage.getItem('algorithmNotationType') || 'normal';
        this.tempAlgorithmInput = '';
        this.tempHexState = null;

        this.DEFAULT_CASE = {
            caseName: '',
            inputTop: "RRRRRRRRRRRR",
            inputBottom: "RRRRRRRRRRRR",
            equator: ["/", "|"],
            parity: [],
            constraints: {},
            auf: ["U0"],
            adf: ["D0"],
            rul: [0],
            rdl: [0],
            alg: ""
        };
    }

    // === STATE MANAGEMENT METHODS ===

setEditorState(type, item = null, itemName = '') {
    this.editorState.type = type;
    this.editorState.item = item;
    this.editorState.itemName = itemName;
    this.editorState.currentTab = 'shape';
}

getEditorItem() {
    return this.editorState.item;
}

setEditorTab(tab) {
    this.editorState.currentTab = tab;
}

renderEditor() {
    const title = document.getElementById('jsonCreatorTitle');
    const subtitle = document.getElementById('jsonCreatorSubtitle');
    const body = document.getElementById('jsonCreatorBody');
    
    if (!title || !subtitle || !body) return;

    switch (this.editorState.type) {
        case 'welcome':
            this.renderWelcomeEditor(title, subtitle, body);
            break;
        case 'case':
            this.renderCaseEditor(title, subtitle, body);
            break;
        case 'template':
            this.renderTemplateEditor(title, subtitle, body);
            break;
    }
}

renderWelcomeEditor(title, subtitle, body) {
    title.textContent = 'SquanGo';
    subtitle.textContent = 'Case Editor';
    body.innerHTML = `
        <div class="json-creator-welcome">
            <h3>Welcome to Algset Devtool</h3>
            <p>Create and organize your Square-1 algset cases.</p>
            <p>Use the toolbar to add folders and cases.</p>
        </div>
    `;
}

renderCaseEditor(title, subtitle, body) {
    const item = this.editorState.item;
    const name = this.editorState.itemName;
    
    if (!item || !item.caseName) {
        this.setEditorState('welcome');
        this.renderWelcomeEditor(title, subtitle, body);
        return;
    }

    title.innerHTML = `Case: ${name} <button class="json-creator-icon-btn" onclick="jsonCreator.runItem(jsonCreator.getEditorItem(), '${name}')" title="Run This Case" style="margin-left: 8px; display: inline-flex; align-items: center; vertical-align: middle;"><img src="viz/run.svg" width="14" height="14"></button>`;
    subtitle.innerHTML = ``;

    // Initialize arrays if they don't exist
    if (!item.auf) item.auf = ['U0'];
    if (!item.adf) item.adf = ['D0'];
    if (!item.rul) item.rul = [0];
    if (!item.rdl) item.rdl = [0];
    if (!item.constraints) item.constraints = {};

    body.innerHTML = `
        <div class="case-editor-tabs">
            <button class="case-editor-tab ${this.editorState.currentTab === 'shape' ? 'active' : ''}" onclick="jsonCreator.switchCaseTab('shape')">Shape Input</button>
            <button class="case-editor-tab ${this.editorState.currentTab === 'additional' ? 'active' : ''}" onclick="jsonCreator.switchCaseTab('additional')">Additional Information</button>
        </div>
        <div id="caseEditorContent"></div>
    `;

    this.renderCaseTab(item, name);
}

renderTemplateEditor(title, subtitle, body) {
    title.innerHTML = `Case Template <button class="json-creator-icon-btn" onclick="jsonCreator.saveCaseTemplate()" title="Save Template" style="margin-left: 8px; display: inline-flex; align-items: center; vertical-align: middle;"><img src="viz/save.svg" width="14" height="14" onerror="this.outerHTML='Save'"></button> <button class="json-creator-icon-btn" onclick="jsonCreator.clearCaseTemplate()" title="Clear Template" style="margin-left: 4px; display: inline-flex; align-items: center; vertical-align: middle;"><img src="viz/reset.svg" width="14" height="14" onerror="this.outerHTML='Reset'"></button>`;
    subtitle.innerHTML = `Any new case from now on will be pre-configured according to this case template.`;

    const template = this.caseTemplate || { ...this.DEFAULT_CASE };
    delete template.caseName;
    delete template.alg;

    this.editingTemplate = JSON.parse(JSON.stringify(template));

    body.innerHTML = `
        <div class="case-editor-tabs">
            <button class="case-editor-tab ${this.editorState.currentTab === 'shape' ? 'active' : ''}" onclick="jsonCreator.switchTemplateTab('shape')">Shape Input</button>
            <button class="case-editor-tab ${this.editorState.currentTab === 'additional' ? 'active' : ''}" onclick="jsonCreator.switchTemplateTab('additional')">Additional Information</button>
        </div>
        <div id="templateEditorContent"></div>
    `;

    this.renderTemplateTab();
}

    _createModal(title, bodyHTML, options = {}) {
        const modal = document.createElement('div');
        modal.className = `modal active ${options.className || ''}`;
        modal.style.zIndex = options.zIndex || '20000';
        modal.innerHTML = `
            <div class="modal-content ${options.contentClass || 'devtool-modal'}" style="max-width: ${options.maxWidth || '500px'};">
                <div class="modal-header">
                    <h2>${title}</h2>
                    <button class="close-btn" onclick="this.closest('.modal').remove()">×</button>
                </div>
                <div class="modal-body">
                    ${bodyHTML}
                </div>
            </div>
        `;
        document.body.appendChild(modal);

        if (options.closeOnOutsideClick !== false) {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    modal.remove();
                }
            });
        }

        return modal;
    }

    _createContextMenu(x, y, items) {
    this.hideContextMenu();
    this.setupContextMenuListener();
    
    const menu = document.createElement('div');
    menu.className = 'context-menu';
    
    items.forEach(item => {
        if (item.separator) {
            const sep = document.createElement('div');
            sep.className = 'context-menu-separator';
            menu.appendChild(sep);
        } else {
            const menuItem = document.createElement('div');
            menuItem.className = `context-menu-item ${item.disabled ? 'disabled' : ''}`;
            menuItem.textContent = item.text;
            if (!item.disabled) {
                menuItem.onclick = () => {
                    this.hideContextMenu();
                    item.action();
                };
            }
            menu.appendChild(menuItem);
        }
    });
    
    // Temporarily add to DOM to measure height
    menu.style.visibility = 'hidden';
    document.body.appendChild(menu);
    
    const menuHeight = menu.offsetHeight;
    const menuWidth = menu.offsetWidth;
    const viewportHeight = window.innerHeight;
    const viewportWidth = window.innerWidth;
    
    // Calculate position - open upward if not enough space below
    let finalX = x;
    let finalY = y;
    
    // Check if menu would go off bottom of screen
    if (y + menuHeight > viewportHeight - 10) {
        // Open upward instead
        finalY = y - menuHeight;
        // If still off screen at top, align to bottom of viewport
        if (finalY < 10) {
            finalY = viewportHeight - menuHeight - 10;
        }
    }
    
    // Check if menu would go off right of screen
    if (x + menuWidth > viewportWidth - 10) {
        finalX = viewportWidth - menuWidth - 10;
    }
    
    // Ensure menu doesn't go off left of screen
    if (finalX < 10) {
        finalX = 10;
    }
    
    menu.style.left = `${finalX}px`;
    menu.style.top = `${finalY}px`;
    menu.style.visibility = 'visible';
    
    this.contextMenu = menu;
    this.setupContextMenuScrollListener();
}

    _collectAllCases(obj, path = []) {
        const cases = [];
        for (const [key, value] of Object.entries(obj)) {
            if (value && typeof value === 'object') {
                if (value.caseName) {
                    cases.push({ ...value, path: [...path, key].join(' > ') });
                } else {
                    cases.push(...this._collectAllCases(value, [...path, key]));
                }
            }
        }
        return cases;
    }

    _createTreeItemElement(key, item, path, level) {
        const currentPath = path ? `${path}/${key}` : key;
        const isFolder = !item.caseName;
        const isExpanded = this.uiState.expandedFolders.has(currentPath);

        const itemDiv = document.createElement('div');
        itemDiv.className = 'json-creator-tree-item';
        itemDiv.style.paddingLeft = `${level * 16 + 8}px`;
        itemDiv.dataset.path = currentPath;

        if (this.uiState.selectedPath === currentPath) {
            itemDiv.classList.add('selected');
        }

        // Expand icon or spacer
        if (isFolder) {
            const expandIcon = document.createElement('div');
            expandIcon.className = 'tree-expand-icon';
            expandIcon.textContent = isExpanded ? '▼' : '▶';
            itemDiv.appendChild(expandIcon);
        } else {
            const spacer = document.createElement('div');
            spacer.style.width = '16px';
            itemDiv.appendChild(spacer);
        }

        // Icon
        const icon = document.createElement('img');
        icon.className = 'tree-icon';
        icon.src = isFolder ? 'viz/folder.svg' : 'viz/case.svg';
        icon.width = 16;
        icon.height = 16;
        itemDiv.appendChild(icon);

        // Text and input
        const textSpan = document.createElement('span');
        textSpan.className = 'tree-item-text';
        textSpan.textContent = key;
        itemDiv.appendChild(textSpan);

        const input = document.createElement('input');
        input.className = 'tree-item-input';
        input.value = key;
        itemDiv.appendChild(input);

        // Event handlers
        itemDiv.onclick = (e) => this.handleItemClick(e, currentPath, item, key);
        itemDiv.ondblclick = (e) => this.startRename(itemDiv, input, key);
        itemDiv.oncontextmenu = (e) => this.showContextMenu(e, currentPath, item, key);

        input.onblur = () => this.finishRename(currentPath, key, itemDiv, input);
        input.onkeydown = (e) => {
            if (e.key === 'Enter') input.blur();
            if (e.key === 'Escape') { input.value = key; input.blur(); }
            e.stopPropagation();
        };

        // Add long press for mobile context menu
        let treePressTimer;
        let treeTouchMoved = false;
        
        itemDiv.addEventListener('touchstart', (e) => {
            treeTouchMoved = false;
            treePressTimer = setTimeout(() => {
                e.preventDefault();
                e.stopPropagation();
                this.showContextMenu(e, currentPath, item, key);
            }, 500);
        });
        
        itemDiv.addEventListener('touchend', () => {
            clearTimeout(treePressTimer);
        });
        
        itemDiv.addEventListener('touchmove', () => {
            treeTouchMoved = true;
            clearTimeout(treePressTimer);
        });

        return { itemDiv, isFolder, isExpanded, currentPath };
    }

    _autoRenameAndFocus(basePath, itemName) {
        setTimeout(() => {
            const newPath = basePath ? `${basePath}/${itemName}` : itemName;
            const itemDiv = document.querySelector(`[data-path="${newPath}"]`);
            if (itemDiv) {
                const input = itemDiv.querySelector('.tree-item-input');
                this.startRename(itemDiv, input, itemName);
            }
        }, 100);
    }

    _saveCurrentRoot() {
        if (!AppState.activeDevelopingJSON || !this.treeData) return;
        AppState.developingJSONs[AppState.activeDevelopingJSON] = JSON.parse(JSON.stringify(this.treeData));
        saveDevelopingJSONs();
    }

    _loadRoot(rootName) {
        if (!AppState.developingJSONs[rootName]) {
            console.error(`Root "${rootName}" does not exist!`);
            return;
        }
        this.treeData = JSON.parse(JSON.stringify(AppState.developingJSONs[rootName]));
        this.itemOrder = {}; // Reset item order when switching roots
        this.uiState.selectedPath = '';
        this.uiState.selectedItem = null;
        this.uiState.expandedFolders.clear();
        this.expandAllFolders(this.treeData, '');
    }

    _navigateToParent(path) {
        const pathParts = path.split('/');
        pathParts.pop();
        let parent = this.treeData;
        pathParts.forEach(part => parent = parent[part]);
        return parent;
    }

    _navigateToFolder(path) {
    if (!path) return this.treeData;
    const pathParts = path.split('/');
    let current = this.treeData;
    pathParts.forEach(part => current = current[part]);
    return current;
}

_getOrderedKeys(node, path) {
    const keys = Object.keys(node);
    const orderKey = path || '__root__';
    
    // If we have stored order for this path, use it
    if (this.itemOrder[orderKey]) {
        const orderedKeys = this.itemOrder[orderKey].filter(k => keys.includes(k));
        const newKeys = keys.filter(k => !orderedKeys.includes(k));
        return [...orderedKeys, ...newKeys];
    }
    
    // Store initial order
    this.itemOrder[orderKey] = keys;
    return keys;
}

_saveItemOrder(path, keys) {
    const orderKey = path || '__root__';
    this.itemOrder[orderKey] = keys;
}

    _createFileImportModal(title, onProcess, context = 'general') {
        const fileIdPrefix = context === 'root' ? 'importRootData' : 'importData';
        const dropZoneId = context === 'root' ? 'importRootDropZone' : 'importDropZone';
        const fileNameId = context === 'root' ? 'importRootFileName' : 'importFileName';
        const actionsId = context === 'root' ? 'importRootActions' : 'importActions';

        const modal = document.createElement('div');
        modal.className = 'modal active extract-json-modal';
        modal.style.zIndex = '20000';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 600px;">
                <div class="modal-header">
                    <h2>${title}</h2>
                    <button class="close-btn" onclick="this.closest('.modal').remove()">×</button>
                </div>
                <div class="modal-body">
                    <div style="margin-bottom: 16px;">
                        <input type="file" id="${fileIdPrefix}File" accept=".json" style="display: none;">
                        <div id="${dropZoneId}" 
                             style="width: 100%; min-height: 200px; background: #f9f9f9; border: 2px dashed #d0d0d0; border-radius: 8px; display: flex; flex-direction: column; align-items: center; justify-content: center; cursor: pointer; color: #666; text-align: center; padding: 20px;">
                            <div style="font-size: 48px; margin-bottom: 12px;">📁</div>
                            <div style="font-size: 14px; font-weight: 500; margin-bottom: 4px;">Drop file here or click to choose</div>
                            <div style="font-size: 12px; color: #999;">Supports .json files</div>
                            <div id="${fileNameId}" style="margin-top: 12px; font-size: 13px; color: #0078d4; font-weight: 500;"></div>
                        </div>
                    </div>
                    <div id="${actionsId}" style="display: none; flex-direction: column; gap: 8px;">
                        <button class="json-creator-btn" data-mode="add">Add to Existing</button>
                        <button class="json-creator-btn" data-mode="override">Override (Delete Previous)</button>
                    </div>
                    <button class="json-creator-btn json-creator-btn-secondary" onclick="this.closest('.modal').remove()" style="margin-top: 12px; width: 100%;">Cancel</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);

        // Setup file handlers
        const fileInput = document.getElementById(`${fileIdPrefix}File`);
        const dropZone = document.getElementById(dropZoneId);
        const fileNameDisplay = document.getElementById(fileNameId);
        const actionsDiv = document.getElementById(actionsId);

        let selectedFile = null;

        const handleFile = (file) => {
            if (file && file.type === 'application/json') {
                const reader = new FileReader();
                reader.onload = (e) => {
                    selectedFile = e.target.result;
                    fileNameDisplay.textContent = `Selected: ${file.name}`;
                    actionsDiv.style.display = 'flex';
                };
                reader.readAsText(file);
            } else {
                showFloatingMessage('Please select a valid JSON file', 'error');
            }
        };

        dropZone.onclick = () => fileInput.click();
        fileInput.onchange = (e) => handleFile(e.target.files[0]);

        dropZone.ondragover = (e) => {
            e.preventDefault();
            dropZone.style.background = '#e0e0e0';
        };
        dropZone.ondragleave = () => {
            dropZone.style.background = '#f9f9f9';
        };
        dropZone.ondrop = (e) => {
            e.preventDefault();
            dropZone.style.background = '#f9f9f9';
            handleFile(e.dataTransfer.files[0]);
        };

        // Setup action buttons
        actionsDiv.querySelectorAll('button[data-mode]').forEach(btn => {
            btn.onclick = () => {
                if (selectedFile) {
                    onProcess(selectedFile, btn.dataset.mode);
                    modal.remove();
                }
            };
        });

        modal.addEventListener('click', (e) => {
            if (e.target === modal) modal.remove();
        });
    }

    _generateAdditionalInfoHTML(item, isTemplate = false) {
        const prefix = isTemplate ? 'Template' : '';
        const handler = isTemplate ? 'jsonCreator.updateTemplate' : 'jsonCreator.update';

        // Determine parity mode
        let parityMode = 'ignore';
        if (Array.isArray(item.parity) && item.parity.length > 0) {
            if (item.parity.includes('on') || item.parity.includes('op')) {
                parityMode = 'overall';
            } else {
                parityMode = 'color-specific';
            }
        } else if (!Array.isArray(item.parity) || item.parity.length === 0) {
            parityMode = 'ignore';
        }

        const parityOptionsHTML = parityMode === 'overall' ? `
            <div class="json-creator-grid-item">
                <input type="checkbox" ${Array.isArray(item.parity) && item.parity.includes('on') ? 'checked' : ''} 
                       onchange="${handler}MoveArray('parity', 'on', this.checked)">
                <label>Overall No Parity</label>
            </div>
            <div class="json-creator-grid-item">
                <input type="checkbox" ${Array.isArray(item.parity) && item.parity.includes('op') ? 'checked' : ''} 
                       onchange="${handler}MoveArray('parity', 'op', this.checked)">
                <label>Overall Parity</label>
            </div>
        ` : parityMode === 'color-specific' ? `
            <div class="json-creator-grid-item">
                <input type="checkbox" ${Array.isArray(item.parity) && item.parity.includes('tnbn') ? 'checked' : ''} 
                       onchange="${handler}MoveArray('parity', 'tnbn', this.checked)">
                <label>Both Color No Parity</label>
            </div>
            <div class="json-creator-grid-item">
                <input type="checkbox" ${Array.isArray(item.parity) && item.parity.includes('tpbn') ? 'checked' : ''} 
                       onchange="${handler}MoveArray('parity', 'tpbn', this.checked)">
                <label>Black Parity, White No Parity</label>
            </div>
            <div class="json-creator-grid-item">
                <input type="checkbox" ${Array.isArray(item.parity) && item.parity.includes('tnbp') ? 'checked' : ''} 
                       onchange="${handler}MoveArray('parity', 'tnbp', this.checked)">
                <label>Black No Parity, White Parity</label>
            </div>
            <div class="json-creator-grid-item">
                <input type="checkbox" ${Array.isArray(item.parity) && item.parity.includes('tpbp') ? 'checked' : ''} 
                       onchange="${handler}MoveArray('parity', 'tpbp', this.checked)">
                <label>Both Color Parity</label>
            </div>
        ` : '';

        return `
            <div class="json-creator-section-compact">
                <h4>Middle Layer</h4>
                <div class="json-creator-grid">
                    <div class="json-creator-grid-item">
                        <input type="checkbox" ${Array.isArray(item.equator) && item.equator.includes('|') ? 'checked' : ''} 
                               onchange="${handler}Equator('|', this.checked)">
                        <label>Solved</label>
                    </div>
                    <div class="json-creator-grid-item">
                        <input type="checkbox" ${Array.isArray(item.equator) && item.equator.includes('/') ? 'checked' : ''} 
                               onchange="${handler}Equator('/', this.checked)">
                        <label>Flipped</label>
                    </div>
                </div>
            </div>

            <div class="json-creator-section-compact">
                <h4>
                    Parity
                    <span class="info-wrapper">
                        <button class="info-btn" aria-label="More info">i</button>
                        <span class="info-box">
                            Parity here doesn't refer to conventional parity. Overall parity defines a state of the sq1, but probably not the state you are aiming for. So run the case to check if you really want this. Color specific: here you can explicitly decide the arrangement of each color pieces, again test each one to check for yourself what you really want.
                        </span>
                    </span>
                </h4>
                <div class="parity-radio-group">
                    <div class="parity-radio-item">
                        <input type="radio" name="parityMode" value="ignore" ${parityMode === 'ignore' ? 'checked' : ''} 
                               onchange="${handler}ParityMode('ignore')">
                        <label>Ignore</label>
                    </div>
                    <div class="parity-radio-item">
                        <input type="radio" name="parityMode" value="overall" ${parityMode === 'overall' ? 'checked' : ''} 
                               onchange="${handler}ParityMode('overall')">
                        <label>Overall</label>
                    </div>
                    <div class="parity-radio-item">
                        <input type="radio" name="parityMode" value="color-specific" ${parityMode === 'color-specific' ? 'checked' : ''} 
                               onchange="${handler}ParityMode('color-specific')">
                        <label>Color Specific</label>
                    </div>
                </div>
                <div id="parityOptions" class="parity-checkboxes-vertical">
                    ${parityOptionsHTML}
                </div>
            </div>

            <div class="json-creator-section-compact">
                <h4>
                    Post ABF
                    <span class="info-wrapper">
                        <button class="info-btn" aria-label="More info">i</button>
                        <span class="info-box">Post ABF is Adjustment of Both Face After the algorithm is done.</span>
                    </span>
                </h4>
                <div class="abf-grid">
                    ${['U0', 'U', 'U2', "U'", 'D0', 'D', 'D2', "D'"].map((move, idx) => {
            const field = idx < 4 ? 'auf' : 'adf';
            return `
                            <div class="json-creator-grid-item">
                                <input type="checkbox" ${item[field].includes(move) ? 'checked' : ''} 
                                       onchange="${handler}MoveArray('${field}', '${move}', this.checked)">
                                <label>${move}</label>
                            </div>
                        `;
        }).join('')}
                </div>
            </div>

            <div class="json-creator-section-compact">
                <h4>
                    Pre ABF
                    <span class="info-wrapper">
                        <button class="info-btn" aria-label="More info">i</button>
                        <span class="info-box">Pre ABF is the adjustment you do before doing an alg.</span>
                    </span>
                </h4>
                <div class="pre-abf-container">
                    <div class="pre-abf-section">
                        <h5>Pre AUF</h5>
                        <div class="pre-abf-grid">
                            ${[-5, -4, -3, -2, -1, 0, 1, 2, 3, 4, 5, 6].map(val => `
                                <div class="json-creator-grid-item">
                                    <input type="checkbox" ${Array.isArray(item.rul) && item.rul.includes(val) ? 'checked' : ''} 
                                           onchange="${handler}NumberArray('rul', ${val}, this.checked)">
                                    <label>${val}</label>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                    <div class="pre-abf-section">
                        <h5>Pre ADF</h5>
                        <div class="pre-abf-grid">
                            ${[-5, -4, -3, -2, -1, 0, 1, 2, 3, 4, 5, 6].map(val => `
                                <div class="json-creator-grid-item">
                                    <input type="checkbox" ${Array.isArray(item.rdl) && item.rdl.includes(val) ? 'checked' : ''} 
                                           onchange="${handler}NumberArray('rdl', ${val}, this.checked)">
                                    <label>${val}</label>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                </div>
            </div>
            ${!isTemplate ? `
                <div class="json-creator-section-compact">
                    <h4>Algorithm</h4>
                    <div class="json-creator-form-group">
                        <input type="text" onchange="jsonCreator.updateField('alg', this.value)" value="${item.alg || ''}" style="width: 100%; padding: 6px 8px; background: #ffffff; border: 1px solid #c0c0c0; border-radius: 2px; color: #1a1a1a;">
                    </div>
                </div>
            ` : ''}
        `;
    }

    _generateShapeInputHTML(item, isTemplate = false) {
        const constraintHandler = isTemplate ? 'Template' : '';

        return `
            <div class="json-creator-section" style="margin-bottom: 20px;">
                <div class="algorithm-mode-group">
                    <label class="algorithm-mode-label">
                        <input type="checkbox" id="algorithmInputModeCheckbox" 
                               ${this.algorithmInputMode ? 'checked' : ''}
                               onchange="jsonCreator.toggleAlgorithmInputMode(this.checked)">
                        <span>Input shape using algorithm text</span>
                    </label>
                </div>
                
                <div id="algorithmInputSection" class="algorithm-input-section" style="display: ${this.algorithmInputMode ? 'block' : 'none'};">
                    <div class="algorithm-notation-group">
                        <label class="algorithm-notation-label">
                            <input type="radio" name="algorithmNotationType" value="normal" 
                                   ${this.algorithmNotationType === 'normal' ? 'checked' : ''}
                                   onchange="jsonCreator.setAlgorithmNotationType('normal')">
                            <span>Normal Notation</span>
                        </label>
                        <label class="algorithm-notation-label">
                            <input type="radio" name="algorithmNotationType" value="karnotation" 
                                   ${this.algorithmNotationType === 'karnotation' ? 'checked' : ''}
                                   onchange="jsonCreator.setAlgorithmNotationType('karnotation')">
                            <span>Karnotation</span>
                        </label>
                    </div>
                    
                    <div class="algorithm-input-controls">
                        <input type="text" id="algorithmTextInput" class="algorithm-text-input" placeholder="Input algorithm (e.g., (1,0)/ (3,3)/ (0,-3)/)" 
                               oninput="jsonCreator.handleAlgorithmInputChange(this.value)">
                        <button class="algorithm-apply-btn" onclick="jsonCreator.applyAlgorithmInput()">Apply</button>
                    </div>
                    
                    <div id="algorithmAppliedActions" class="algorithm-applied-actions" style="display: none;">
                        <button class="algorithm-copy-btn" onclick="jsonCreator.copyAlgorithmToField()">
                            Copy this algorithm to the algorithm field below
                        </button>
                    </div>
                </div>
            </div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 20px;">
                <div class="json-creator-section">
                    <h4 style="display: flex; align-items: center; justify-content: space-between;">
                        Top Layer
                        <button class="json-creator-icon-btn" onclick="jsonCreator.resetShapeInput('top')" title="Reset Top Layer" style="display: inline-flex; align-items: center;">
                            <img src="viz/reset.svg" width="14" height="14">
                        </button>
                    </h4>
                    <div class="json-creator-form-group">
                        <input type="text" maxlength="12" id="topLayerInput" value="${item.inputTop || 'RRRRRRRRRRRR'}" 
                               style="font-family: monospace; width: 100%; padding: 8px; background: #2d2d2d; border: 1px solid #404040; border-radius: 4px; color: #e0e0e0; display: none;">
                    </div>
                    <div id="topInteractive" style="display: flex; justify-content: center; margin-top: 12px;"></div>
                </div>

                <div class="json-creator-section">
                    <h4 style="display: flex; align-items: center; justify-content: space-between;">
                        Bottom Layer
                        <button class="json-creator-icon-btn" onclick="jsonCreator.resetShapeInput('bottom')" title="Reset Bottom Layer" style="display: inline-flex; align-items: center;">
                            <img src="viz/reset.svg" width="14" height="14">
                        </button>
                    </h4>
                    <div class="json-creator-form-group">
                        <input type="text" maxlength="12" id="bottomLayerInput" value="${item.inputBottom || 'RRRRRRRRRRRR'}" 
                               style="font-family: monospace; width: 100%; padding: 8px; background: #2d2d2d; border: 1px solid #404040; border-radius: 4px; color: #e0e0e0; display: none;">
                    </div>
                    <div id="bottomInteractive" style="display: flex; justify-content: center; margin-top: 12px;"></div>
                </div>
            </div>

            <div class="json-creator-section">
                <h4>Constraints</h4>
                <p style="font-size: 12px; color: #666; margin: 0 0 12px 0; font-style: italic;">Don't touch this unless you know what you are doing</p>
                <div class="json-creator-form-group">
                    <label>Position (e.g., A, BC, D)</label>
                    <input type="text" id="constraintPosition" placeholder="Enter position...">
                </div>
                <div class="json-creator-form-group">
                    <label>Allowed Pieces (comma-separated)</label>
                    <input type="text" id="constraintValues" placeholder="e.g., 1,3,5,7">
                </div>
                <button class="json-creator-btn" onclick="jsonCreator.add${constraintHandler}Constraint()">Add Constraint</button>
                <div id="constraintsList" style="margin-top: 10px;">
                    ${Object.entries(item.constraints || {}).map(([pos, vals]) => `
                        <div style="display: flex; align-items: center; gap: 8px; margin-top: 4px; padding: 4px; background: #3c3c3c; border-radius: 2px;">
                            <span style="color: #cccccc; font-size: 12px;">${pos}: ${vals.join(', ')}</span>
                            <button onclick="jsonCreator.remove${constraintHandler}Constraint('${pos}')" style="background: #d32f2f; border: none; color: white; padding: 2px 8px; border-radius: 2px; cursor: pointer; font-size: 11px;">Remove</button>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }

    _renderShapeInputTab(item, content, isTemplate) {
        const alreadyRendered = content.querySelector('#topLayerInput');

        if (alreadyRendered) {
            this._updateShapeInputs(item);
            return;
        }

        this._initializeShapeStates(item, isTemplate);
        content.innerHTML = this._generateShapeInputHTML(item, isTemplate);
        this._setupShapeVisualization(item);
        this._setupShapeInputListeners(item, isTemplate);
    }

    _updateShapeInputs(item) {
        const topInput = document.getElementById('topLayerInput');
        const bottomInput = document.getElementById('bottomLayerInput');
        const topValue = item.inputTop || 'RRRRRRRRRRRR';
        const bottomValue = item.inputBottom || 'RRRRRRRRRRRR';

        if (topInput) topInput.value = topValue;
        if (bottomInput) bottomInput.value = bottomValue;

        if (this.topState && window.InteractiveScrambleRenderer) {
            this.topState.topText = topValue;
            this.topState.bottomText = '';
            this.topState.parse();
            const topContainer = document.getElementById('topInteractive');
            if (topContainer) {
                topContainer.innerHTML = window.InteractiveScrambleRenderer.createInteractiveSVG(this.topState, { size: 200 });
                window.InteractiveScrambleRenderer.setupInteractiveEvents(this.topState, 'topInteractive');
            }
        }

        if (this.bottomState && window.InteractiveScrambleRenderer) {
            this.bottomState.topText = '';
            this.bottomState.bottomText = bottomValue;
            this.bottomState.parse();
            const bottomContainer = document.getElementById('bottomInteractive');
            if (bottomContainer) {
                bottomContainer.innerHTML = window.InteractiveScrambleRenderer.createInteractiveSVG(this.bottomState, { size: 200 });
                window.InteractiveScrambleRenderer.setupInteractiveEvents(this.bottomState, 'bottomInteractive');
            }
        }
    }

    _initializeShapeStates(item, isTemplate) {
        if (!window.InteractiveScrambleRenderer) return;

        const target = isTemplate ? this.editingTemplate : this.uiState.selectedItem;

        this.topState = new window.InteractiveScrambleRenderer.InteractiveScrambleState(
            item.inputTop || 'RRRRRRRRRRRR',
            '',
            window.InteractiveScrambleRenderer.DEFAULT_COLOR_SCHEME
        );
        this.topState.onChange(() => {
            // If user manually edits shape, clear temporary algorithm state
            this.clearTemporaryAlgorithmState();
            const input = document.getElementById('algorithmTextInput');
            if (input) input.value = '';

            if (target) {
                target.inputTop = this.topState.topText;
                const topInput = document.getElementById('topLayerInput');
                if (topInput) topInput.value = this.topState.topText;
                if (!isTemplate) {
                    AppState.developingJSONs[AppState.activeDevelopingJSON] = JSON.parse(JSON.stringify(this.treeData));
                    saveDevelopingJSONs();
                }
            }
        });

        this.bottomState = new window.InteractiveScrambleRenderer.InteractiveScrambleState(
            '',
            item.inputBottom || 'RRRRRRRRRRRR',
            window.InteractiveScrambleRenderer.DEFAULT_COLOR_SCHEME
        );
        this.bottomState.onChange(() => {
            // If user manually edits shape, clear temporary algorithm state
            this.clearTemporaryAlgorithmState();
            const input = document.getElementById('algorithmTextInput');
            if (input) input.value = '';

            if (target) {
                target.inputBottom = this.bottomState.bottomText;
                const bottomInput = document.getElementById('bottomLayerInput');
                if (bottomInput) bottomInput.value = this.bottomState.bottomText;
                if (!isTemplate) {
                    AppState.developingJSONs[AppState.activeDevelopingJSON] = JSON.parse(JSON.stringify(this.treeData));
                    saveDevelopingJSONs();
                }
            }
        });
    }

    _setupShapeVisualization(item) {
        if (!window.InteractiveScrambleRenderer) return;

        const topContainer = document.getElementById('topInteractive');
        const bottomContainer = document.getElementById('bottomInteractive');

        if (topContainer) {
            this.topState.topText = item.inputTop || 'RRRRRRRRRRRR';
            this.topState.bottomText = '';
            this.topState.parse();
            topContainer.innerHTML = window.InteractiveScrambleRenderer.createInteractiveSVG(this.topState, { size: 200 });
            window.InteractiveScrambleRenderer.setupInteractiveEvents(this.topState, 'topInteractive');
        }

        if (bottomContainer) {
            this.bottomState.topText = '';
            this.bottomState.bottomText = item.inputBottom || 'RRRRRRRRRRRR';
            this.bottomState.parse();
            bottomContainer.innerHTML = window.InteractiveScrambleRenderer.createInteractiveSVG(this.bottomState, { size: 200 });
            window.InteractiveScrambleRenderer.setupInteractiveEvents(this.bottomState, 'bottomInteractive');
        }
    }

    toggleAlgorithmInputMode(checked) {
        this.algorithmInputMode = checked;
        localStorage.setItem('algorithmInputMode', checked);
        
        const section = document.getElementById('algorithmInputSection');
        if (section) {
            section.style.display = checked ? 'block' : 'none';
        }
        
        if (!checked) {
            this.clearTemporaryAlgorithmState();
        }
    }

    setAlgorithmNotationType(type) {
        this.algorithmNotationType = type;
        localStorage.setItem('algorithmNotationType', type);
        
        const input = document.getElementById('algorithmTextInput');
        if (input && input.value) {
            this.handleAlgorithmInputChange(input.value);
        }
    }

    handleAlgorithmInputChange(algorithmText) {
        if (!algorithmText.trim()) {
            this.clearTemporaryAlgorithmState();
            this._updateShapeInputs(this.uiState.selectedItem || this.editingTemplate);
            return;
        }

        this.tempAlgorithmInput = algorithmText;

        try {
            let processedAlg = algorithmText;
            console.log('=== Algorithm Encoding Process ===');
            console.log('Step 0 - Original Input:', algorithmText);

            // Process based on notation type
            if (this.algorithmNotationType === 'karnotation') {
                console.log('Step 1 - Karnotation Mode: ENABLED');
                if (typeof window.makeAPBLDocScrambleWCANotationPlease !== 'undefined') {
                    processedAlg = window.makeAPBLDocScrambleWCANotationPlease(algorithmText);
                    console.log('Step 1 - After Karnotation Conversion:', processedAlg);
                } else {
                    throw new Error('Karnotation converter not loaded');
                }
            } else {
                console.log('Step 1 - Karnotation Mode: DISABLED (using normal notation)');
            }

            // Normalize
            if (typeof window.ScrambleNormalizer !== 'undefined') {
                processedAlg = window.ScrambleNormalizer.normalizeScramble(processedAlg);
                console.log('Step 2 - After Normalization:', processedAlg);
            } else {
                console.warn('ScrambleNormalizer not loaded, skipping normalization');
            }

            // Invert
            if (typeof window.pleaseInvertThisScrambleForSolutionVisualization !== 'undefined') {
                processedAlg = window.pleaseInvertThisScrambleForSolutionVisualization(processedAlg);
                console.log('Step 3 - After Inversion:', processedAlg);
            } else {
                console.warn('Inversion function not loaded, skipping inversion');
            }

            // Hexify
            if (typeof window.sq1AlgToHex !== 'undefined') {
                console.log('Step 4 - Starting Hexification...');
                const hexResult = window.sq1AlgToHex(processedAlg);
                console.log('Step 4 - Hexification Result:', hexResult);
                console.log('  - Top Layer Hex:', hexResult.tlHex);
                console.log('  - Bottom Layer Hex:', hexResult.blHex);
                this.tempHexState = hexResult;

                // Live update visualization
                this._updateVisualizationFromHex(hexResult);
                console.log('Step 5 - Visualization Updated Successfully');
            } else {
                throw new Error('Hexify converter not loaded');
            }
            
            console.log('=== Encoding Complete ===');
        } catch (error) {
            console.error('❌ Algorithm conversion error at some step:', error);
            console.error('Error details:', error.message);
            console.error('Stack trace:', error.stack);
            showFloatingMessage('Invalid algorithm: ' + error.message, 'error');
            this.clearTemporaryAlgorithmState();
        }
    }

    _updateVisualizationFromHex(hexResult) {
        if (!window.InteractiveScrambleRenderer) return;

        const topInput = document.getElementById('topLayerInput');
        const bottomInput = document.getElementById('bottomLayerInput');

        if (topInput) topInput.value = hexResult.tlHex;
        if (bottomInput) bottomInput.value = hexResult.blHex;

        if (this.topState) {
            this.topState.topText = hexResult.tlHex;
            this.topState.bottomText = '';
            this.topState.parse();
            const topContainer = document.getElementById('topInteractive');
            if (topContainer) {
                topContainer.innerHTML = window.InteractiveScrambleRenderer.createInteractiveSVG(this.topState, { size: 200 });
                window.InteractiveScrambleRenderer.setupInteractiveEvents(this.topState, 'topInteractive');
            }
        }

        if (this.bottomState) {
            this.bottomState.topText = '';
            this.bottomState.bottomText = hexResult.blHex;
            this.bottomState.parse();
            const bottomContainer = document.getElementById('bottomInteractive');
            if (bottomContainer) {
                bottomContainer.innerHTML = window.InteractiveScrambleRenderer.createInteractiveSVG(this.bottomState, { size: 200 });
                window.InteractiveScrambleRenderer.setupInteractiveEvents(this.bottomState, 'bottomInteractive');
            }
        }
    }

    applyAlgorithmInput() {
        if (!this.tempHexState) {
            showFloatingMessage('No algorithm to apply', 'error');
            return;
        }

        const target = this.editingTemplate || this.uiState.selectedItem;
        if (!target) return;

        target.inputTop = this.tempHexState.tlHex;
        target.inputBottom = this.tempHexState.blHex;

        if (!this.editingTemplate) {
            AppState.developingJSONs[AppState.activeDevelopingJSON] = JSON.parse(JSON.stringify(this.treeData));
            saveDevelopingJSONs();
        }

        // Clear input and show action button
        const input = document.getElementById('algorithmTextInput');
        if (input) input.value = '';

        const actionsDiv = document.getElementById('algorithmAppliedActions');
        if (actionsDiv) actionsDiv.style.display = 'block';

        this.lastAppliedAlgorithm = this.tempAlgorithmInput;
        this.clearTemporaryAlgorithmState();

        showFloatingMessage('Algorithm applied successfully!', 'success');
    }

    copyAlgorithmToField() {
        if (!this.lastAppliedAlgorithm) return;

        const target = this.editingTemplate || this.uiState.selectedItem;
        if (!target) return;

        target.alg = this.lastAppliedAlgorithm;

        if (!this.editingTemplate) {
            AppState.developingJSONs[AppState.activeDevelopingJSON] = JSON.parse(JSON.stringify(this.treeData));
            saveDevelopingJSONs();
        }

        const actionsDiv = document.getElementById('algorithmAppliedActions');
        if (actionsDiv) actionsDiv.style.display = 'none';

        showFloatingMessage('Algorithm copied to algorithm field!', 'success');
    }

    clearTemporaryAlgorithmState() {
        this.tempAlgorithmInput = '';
        this.tempHexState = null;
        this.lastAppliedAlgorithm = null;

        const actionsDiv = document.getElementById('algorithmAppliedActions');
        if (actionsDiv) actionsDiv.style.display = 'none';
    }

    resetShapeInput(layer) {
    const target = this.editingTemplate || this.getEditorItem();
    if (!target) return;

    const field = layer === 'top' ? 'inputTop' : 'inputBottom';
    const currentValue = target[field];

    // Determine what to reset to
    let resetValue;
    const templateValue = this.caseTemplate ? this.caseTemplate[field] : 'RRRRRRRRRRRR';
    
    // If current value equals template, reset to RRRRRRRRRRRR
    // If current value is RRRRRRRRRRRR, reset to template
    // Otherwise, reset to template
    if (currentValue === templateValue) {
        resetValue = 'RRRRRRRRRRRR';
    } else if (currentValue === 'RRRRRRRRRRRR') {
        resetValue = templateValue;
    } else {
        resetValue = templateValue;
    }

    target[field] = resetValue;

    if (!this.editingTemplate) {
        AppState.developingJSONs[AppState.activeDevelopingJSON] = JSON.parse(JSON.stringify(this.treeData));
        saveDevelopingJSONs();
    }

    // Re-render the shape inputs
    this._updateShapeInputs(target);

    showFloatingMessage(`${layer === 'top' ? 'Top' : 'Bottom'} layer reset`, 'success');
}

    _setupShapeInputListeners(item, isTemplate) {
        const topInput = document.getElementById('topLayerInput');
        const bottomInput = document.getElementById('bottomLayerInput');

        // Re-setup interactive events for shape inputs after render
        setTimeout(() => {
            if (this.topState && window.InteractiveScrambleRenderer) {
                window.InteractiveScrambleRenderer.setupInteractiveEvents(this.topState, 'topInteractive');
            }
            if (this.bottomState && window.InteractiveScrambleRenderer) {
                window.InteractiveScrambleRenderer.setupInteractiveEvents(this.bottomState, 'bottomInteractive');
            }
        }, 100);

        const handleInputChange = (input, isTop) => {
            const value = input.value.toUpperCase().substring(0, 12);
            input.value = value;

            if (value.length < 12) {
                input.style.borderColor = '#ef4444';
                return;
            }

            input.style.borderColor = '#404040';

            if (value.length === 12) {
                try {
                    const state = isTop ? this.topState : this.bottomState;
                    const containerID = isTop ? 'topInteractive' : 'bottomInteractive';

                    if (isTop) {
                        state.topText = value;
                    } else {
                        state.bottomText = value;
                    }

                    state.parse();
                    const container = document.getElementById(containerID);
                    container.innerHTML = window.InteractiveScrambleRenderer.createInteractiveSVG(state, { size: 200 });
                    window.InteractiveScrambleRenderer.setupInteractiveEvents(state, containerID);

                    const target = isTemplate ? this.editingTemplate : this.uiState.selectedItem;
                    if (isTop) {
                        target.inputTop = value;
                    } else {
                        target.inputBottom = value;
                    }

                    if (!isTemplate) {
                        AppState.developingJSONs[AppState.activeDevelopingJSON] = JSON.parse(JSON.stringify(this.treeData));
                        saveDevelopingJSONs();
                    }
                } catch (error) {
                    console.error('Parse error:', error);
                    alert('Invalid input: ' + error.message);
                    input.style.borderColor = '#ef4444';
                }
            }
        };

        if (topInput) {
            topInput.addEventListener('input', (e) => handleInputChange(e.target, true));
        }

        if (bottomInput) {
            bottomInput.addEventListener('input', (e) => handleInputChange(e.target, false));
        }
    }

    show() {
        saveLastScreen('jsonCreator');
        // Load current developing JSON
        this.treeData = JSON.parse(JSON.stringify(AppState.developingJSONs[AppState.activeDevelopingJSON] || DEFAULT_ALGSET));

        // Load root-specific case template
        const templateKey = `caseTemplate_${AppState.activeDevelopingJSON}`;
        const storedTemplate = localStorage.getItem(templateKey);
        this.caseTemplate = storedTemplate ? JSON.parse(storedTemplate) : null;

        // Expand all folders on initialization
        this.expandAllFolders(this.treeData, '');

        // Load last selected case from localStorage
        const lastSelectedPath = localStorage.getItem('jsonCreator_lastSelectedPath');
        const lastSelectedRoot = localStorage.getItem('jsonCreator_lastSelectedRoot');

        if (lastSelectedRoot === AppState.activeDevelopingJSON && lastSelectedPath) {
            this.uiState.selectedPath = lastSelectedPath;
            const pathParts = lastSelectedPath.split('/');
            let current = this.treeData;
            for (const part of pathParts) {
                if (current[part]) {
                    current = current[part];
                } else {
                    this.uiState.selectedPath = '';
                    break;
                }
            }
            if (this.uiState.selectedPath) {
                this.uiState.selectedItem = current;
            }
        }

        // If no valid selection, select first case found
        if (!this.uiState.selectedPath || !this.uiState.selectedItem) {
            const findFirstCase = (obj, path = []) => {
                for (const [key, value] of Object.entries(obj)) {
                    if (value && typeof value === 'object') {
                        if (value.caseName) {
                            return { path: [...path, key].join('/'), item: value };
                        } else {
                            const found = findFirstCase(value, [...path, key]);
                            if (found) return found;
                        }
                    }
                }
                return null;
            };

            const firstCase = findFirstCase(this.treeData);
            if (firstCase) {
                this.uiState.selectedPath = firstCase.path;
                this.uiState.selectedItem = firstCase.item;
            }
        }

        const fullscreen = document.createElement('div');
        fullscreen.className = 'json-creator-fullscreen';
        fullscreen.id = 'jsonCreatorFullscreen';

        fullscreen.innerHTML = `
                    <div class="json-creator-topbar">
    <div style="display: flex; align-items: center; gap: 12px;">
        <button class="json-creator-icon-btn" onclick="jsonCreator.toggleSidebar()" title="Toggle Sidebar">
            <img src="viz/hamburger-menu.svg" width="16" height="16">
        </button>
        <div style="margin: 0; display: flex; flex-direction: column; line-height: 1.2;">
            <span style="font-size: 18px; font-weight: 700;">SquanGo</span>
            <span style="font-size: 11px; font-weight: 400; color: #666666;">Algset Devtool</span>
        </div>
        <button id="rootSelectorBtn" onclick="jsonCreator.openRootSelectorModal()" style="background: #f5f5f5; border: 1px solid #d0d0d0; color: #1a1a1a; padding: 4px 8px; border-radius: 4px; cursor: pointer; font-size: 13px;">
            ${AppState.activeDevelopingJSON}
        </button>
    </div>
    <div style="display: flex; align-items: center; gap: 8px; margin-left: auto;">
            <button class="json-creator-icon-btn" onclick="jsonCreator.openDataManagement()" title="Data Management">
            <img src="viz/data.svg" width="16" height="16">
        </button>
        <button class="json-creator-icon-btn" onclick="jsonCreator.extractJSON()" title="Extract JSON">
            <img src="viz/extract.svg" width="16" height="16">
        </button>
        <button class="json-creator-icon-btn" onclick="jsonCreator.runJSON()" title="Run">
            <img src="viz/run.svg" width="16" height="16">
        </button>
        <button class="json-creator-icon-btn" onclick="jsonCreator.close()" title="Quit">
            <img src="viz/exit.svg" width="16" height="16">
        </button>
    </div>
</div>
                    <div class="json-creator-main">
                        <div class="json-creator-sidebar" id="jsonCreatorSidebar">
                            <div class="json-creator-toolbar">
                                <button class="json-creator-toolbar-btn" onclick="jsonCreator.newCase()" title="New Case">
                                    <img src="viz/new-case.svg" width="18" height="18">
                                </button>
                                <button class="json-creator-toolbar-btn" onclick="jsonCreator.newFolder()" title="New Folder">
                                    <img src="viz/new-folder.svg" width="18" height="18">
                                </button>
                                <button class="json-creator-toolbar-btn" onclick="jsonCreator.copy()" title="Copy">
                                    <img src="viz/copy.svg" width="18" height="18">
                                </button>
                                <button class="json-creator-toolbar-btn" onclick="jsonCreator.paste()" title="Paste">
                                    <img src="viz/paste.svg" width="18" height="18">
                                </button>
                                <button class="json-creator-toolbar-btn" onclick="jsonCreator.delete()" title="Delete">
                                    <img src="viz/delete.svg" width="18" height="18">
                                </button>
                                <button class="json-creator-toolbar-btn" onclick="jsonCreator.showExtraTools(event)" title="Extra Tools">
                                    <img src="viz/extra-tools.svg" width="18" height="18">
                                </button>
                            </div>
                            <div class="json-creator-tree" id="jsonCreatorTree"></div>
                        </div>
                        <div class="json-creator-content">
                            <div class="json-creator-content-header">
                                <h3 id="jsonCreatorTitle">SquanGo</h3>
                                <p id="jsonCreatorSubtitle">Case Editor</p>
                            </div>
                            <div class="json-creator-content-body" id="jsonCreatorBody">
                            </div>
                        </div>
                    </div>
                `;

        document.body.appendChild(fullscreen);
        this.setupEventListeners();

        // Set initial editor state
        if (this.uiState.selectedItem && this.uiState.selectedItem.caseName) {
            const caseName = this.uiState.selectedPath.split('/').pop();
            this.setEditorState('case', this.uiState.selectedItem, caseName);
        } else {
            this.setEditorState('welcome');
        }
        
        // Render tree ONCE after everything is set up
        this.renderTree();
        this.renderEditor();
    }

    expandAllFolders(node, path) {
        Object.keys(node).forEach(key => {
            const item = node[key];
            if (typeof item === 'object' && item !== null && !item.caseName) {
                const currentPath = path ? `${path}/${key}` : key;
                this.uiState.expandedFolders.add(currentPath);
                this.expandAllFolders(item, currentPath);
            }
        });
    }

    setupEventListeners() {
        document.addEventListener('keydown', (e) => {
            const fullscreen = document.getElementById('jsonCreatorFullscreen');
            if (!fullscreen) return;

            if (e.ctrlKey || e.metaKey) {
                switch (e.key.toLowerCase()) {
                    case 'c':
                        e.preventDefault();
                        this.copy();
                        break;
                    case 'v':
                        e.preventDefault();
                        this.paste();
                        break;
                    case 'n':
                        e.preventDefault();
                        if (e.shiftKey) {
                            this.newFolder();
                        } else {
                            this.newCase();
                        }
                        break;
                }
            } else if (e.key === 'Delete') {
                e.preventDefault();
                this.delete();
            }
        });

        // Info button handler
        document.addEventListener('click', (e) => {
            // Close all info boxes first
            document.querySelectorAll('.info-box').forEach(box =>
                box.classList.remove('show')
            );

            // If an info button was clicked, open only that one
            if (e.target.classList.contains('info-btn')) {
                e.preventDefault();
                e.stopPropagation();
                const infoBox = e.target.nextElementSibling;
                infoBox.classList.add('show');

                // Position the info box dynamically
                const btnRect = e.target.getBoundingClientRect();
                const boxWidth = 300;
                const boxHeight = infoBox.offsetHeight || 100;

                // Try to position above the button
                let top = btnRect.top - boxHeight - 10;
                let left = btnRect.right - boxWidth;

                // If it goes above viewport, position below
                if (top < 10) {
                    top = btnRect.bottom + 10;
                }

                // If it goes off left edge, align to left of button
                if (left < 10) {
                    left = btnRect.left;
                }

                // If it goes off right edge, align to right edge
                if (left + boxWidth > window.innerWidth - 10) {
                    left = window.innerWidth - boxWidth - 10;
                }

                infoBox.style.top = top + 'px';
                infoBox.style.left = left + 'px';
            }
        });

        // Click outside to deselect
        document.getElementById('jsonCreatorTree').addEventListener('click', (e) => {
            if (e.target.id === 'jsonCreatorTree') {
                this.uiState.selectedPath = '';
                this.uiState.selectedItem = null;
                this.renderTree();
            }
        });

        // Right-click on tree root
        document.getElementById('jsonCreatorTree').addEventListener('contextmenu', (e) => {
            if (e.target.id === 'jsonCreatorTree') {
                e.preventDefault();
                this.showTreeRootContextMenu(e);
            }
        });
    }

    renderTree() {
        const container = document.getElementById('jsonCreatorTree');
        if (!container) return;
        
        console.log('[renderTree] Rendering tree for root:', AppState.activeDevelopingJSON);
        
        container.innerHTML = '';
        this.renderTreeNode(this.treeData, container, '', 0);
    }

    renderTreeNode(node, container, path, level) {
        const keys = this._getOrderedKeys(node, path);
        keys.forEach(key => {
            const item = node[key];
            if (typeof item !== 'object' || item === null) return;

            const { itemDiv, isFolder, isExpanded, currentPath } = this._createTreeItemElement(key, item, path, level);
            container.appendChild(itemDiv);

            if (isFolder && isExpanded) {
                this.renderTreeNode(item, container, currentPath, level + 1);
            }
        });
    }

    handleItemClick(e, path, item, key) {
    e.stopPropagation();
    this.hideContextMenu();

    // Update UI state (tree selection)
    this.uiState.selectedPath = path;
    this.uiState.selectedItem = item;
    localStorage.setItem('jsonCreator_lastSelectedPath', path);
    localStorage.setItem('jsonCreator_lastSelectedRoot', AppState.activeDevelopingJSON);

    if (!item.caseName) {
        // Folder clicked - toggle and re-render tree, but DON'T change editor
        this.toggleFolder(path);
        this.renderTree();
    } else {
        // Case clicked - update editor state and render both
        this.setEditorState('case', item, key);
        this.renderTree();
        this.renderEditor();
    }
}

    toggleFolder(path) {
        if (this.uiState.expandedFolders.has(path)) {
            this.uiState.expandedFolders.delete(path);
        } else {
            this.uiState.expandedFolders.add(path);
        }
    }

    startRename(itemDiv, input, currentName) {
        itemDiv.classList.add('editing');
        input.value = currentName;
        input.focus();
        input.select();
    }

    finishRename(path, originalName, itemDiv, input) {
        itemDiv.classList.remove('editing');
        const newName = input.value.trim();
        if (!newName || newName === originalName) return;

        const pathParts = path.split('/');
        pathParts.pop();
        const parentPath = pathParts.join('/');
        const parent = this._navigateToParent(path);

        if (parent[newName]) {
            showFloatingMessage('An item with this name already exists', 'error');
            input.value = originalName;
            return;
        }

        const item = parent[originalName];
        
        // Update item order BEFORE modifying parent object
        const keys = this._getOrderedKeys(parent, parentPath);
        const orderIndex = keys.indexOf(originalName);
        if (orderIndex !== -1) {
            keys[orderIndex] = newName;
            this._saveItemOrder(parentPath, keys);
        }

        // Now modify parent object
        delete parent[originalName];
        parent[newName] = item;

        if (item.caseName) {
            item.caseName = newName;
        }

        // Update UI state if this was the selected item
        if (this.uiState.selectedPath === path) {
            this.uiState.selectedPath = parentPath ? `${parentPath}/${newName}` : newName;
            this.uiState.selectedItem = item;
            localStorage.setItem('jsonCreator_lastSelectedPath', this.uiState.selectedPath);
        }

        // Update editor state if this was being edited
        if (this.editorState.item === item) {
            this.editorState.itemName = newName;
            this.renderEditor();
        }

        this.renderTree();
    }

    newCase() {
        let parent, targetPath;
        
        if (this.uiState.selectedItem && this.uiState.selectedItem.caseName) {
            // If a case is selected, add to its parent folder
            const pathParts = this.uiState.selectedPath.split('/');
            pathParts.pop();
            targetPath = pathParts.join('/');
            parent = targetPath ? this._navigateToFolder(targetPath) : this.treeData;
        } else {
            // If a folder is selected or nothing is selected
            parent = this.getTargetFolder();
            targetPath = this.uiState.selectedPath;
        }

        const name = this.getUniqueName(parent, 'New Case');

        // Use template if available
        if (this.caseTemplate) {
            parent[name] = JSON.parse(JSON.stringify(this.caseTemplate));
            parent[name].caseName = name;
        } else {
            parent[name] = { ...this.DEFAULT_CASE, caseName: name };
        }

        // Update item order
        const keys = this._getOrderedKeys(parent, targetPath);
        keys.push(name);
        this._saveItemOrder(targetPath, keys);

        // Auto-expand parent folder if not already expanded
        if (targetPath && !this.uiState.expandedFolders.has(targetPath)) {
            this.uiState.expandedFolders.add(targetPath);
        }

        this._saveCurrentRoot();
        this.renderTree();
        this._autoRenameAndFocus(targetPath, name);
    }

    newFolder() {
        let parent, targetPath;
        
        if (this.uiState.selectedItem && this.uiState.selectedItem.caseName) {
            // If a case is selected, add to its parent folder
            const pathParts = this.uiState.selectedPath.split('/');
            pathParts.pop();
            targetPath = pathParts.join('/');
            parent = targetPath ? this._navigateToFolder(targetPath) : this.treeData;
        } else {
            // If a folder is selected or nothing is selected
            parent = this.getTargetFolder();
            targetPath = this.uiState.selectedPath;
        }

        const name = this.getUniqueName(parent, 'New Folder');
        parent[name] = {};

        // Update item order
        const keys = this._getOrderedKeys(parent, targetPath);
        keys.push(name);
        this._saveItemOrder(targetPath, keys);

        // Auto-expand parent folder if not already expanded
        if (targetPath && !this.uiState.expandedFolders.has(targetPath)) {
            this.uiState.expandedFolders.add(targetPath);
        }

        this._saveCurrentRoot();
        this.renderTree();
        this._autoRenameAndFocus(targetPath, name);
    }

    getTargetFolder() {
        if (!this.uiState.selectedPath) return this.treeData;

        const pathParts = this.uiState.selectedPath.split('/');
        let current = this.treeData;

        for (const part of pathParts) {
            current = current[part];
        }

        if (current.caseName) {
            pathParts.pop();
            current = this.treeData;
            for (const part of pathParts) {
                current = current[part];
            }
        }

        return current;
    }

    getUniqueName(parent, baseName) {
        let name = baseName;
        let counter = 1;
        while (parent[name]) {
            name = `${baseName} ${counter}`;
            counter++;
        }
        return name;
    }

    copy() {
        if (!this.uiState.selectedItem) return;
        const name = this.uiState.selectedPath.split('/').pop();
        this.clipboard = {
            item: JSON.parse(JSON.stringify(this.uiState.selectedItem)),
            name: name
        };
        this.clipboardOperation = 'copy';
    }

    paste() {
        if (!this.clipboard) return;

        let targetPath;
        if (this.uiState.selectedItem && this.uiState.selectedItem.caseName) {
            const pathParts = this.uiState.selectedPath.split('/');
            pathParts.pop();
            targetPath = pathParts.join('/');
        } else {
            targetPath = this.uiState.selectedPath;
        }

        const parent = this.getTargetFolder();
        const name = this.getUniqueName(parent, this.clipboard.name);
        parent[name] = JSON.parse(JSON.stringify(this.clipboard.item));

        if (parent[name].caseName) {
            parent[name].caseName = name;
        }

        // Update item order
        const keys = this._getOrderedKeys(parent, targetPath);
        keys.push(name);
        this._saveItemOrder(targetPath, keys);

        // Auto-expand parent folder if not already expanded
        if (targetPath && !this.uiState.expandedFolders.has(targetPath)) {
            this.uiState.expandedFolders.add(targetPath);
        }

        this._saveCurrentRoot();
        this.renderTree();
        this._autoRenameAndFocus(targetPath, name);
    }

    delete() {
        if (!this.uiState.selectedPath) return;

        showConfirmationModal(
            'Delete Item',
            `Delete "${this.uiState.selectedPath.split('/').pop()}"?`,
            () => {
                const pathParts = this.uiState.selectedPath.split('/');
                const itemName = pathParts.pop();
                const parentPath = pathParts.join('/');
                const parent = this._navigateToParent(this.uiState.selectedPath);

                delete parent[itemName];

                // Update item order
                const keys = this._getOrderedKeys(parent, parentPath);
                const newKeys = keys.filter(k => k !== itemName);
                this._saveItemOrder(parentPath, newKeys);

                // If we deleted what was being edited, show welcome
                if (this.editorState.item === this.uiState.selectedItem) {
                    this.setEditorState('welcome');
                    this.renderEditor();
                }

                this.uiState.selectedPath = '';
                this.uiState.selectedItem = null;
                this._saveCurrentRoot();
                this.renderTree();
            }
        );
    }

    copyItemJSON(item) {
        const jsonString = JSON.stringify(item, null, 2);
        navigator.clipboard.writeText(jsonString)
            .then(() => showFloatingMessage('JSON copied to clipboard!', 'success'))
            .catch(err => showFloatingMessage('Failed to copy: ' + err, 'error'));
    }

    moveItem(path, direction) {
        const pathParts = path.split('/');
        const itemName = pathParts.pop();
        const parentPath = pathParts.join('/');
        const parent = pathParts.length > 0 ? this._navigateToParent(path) : this.treeData;

        const keys = this._getOrderedKeys(parent, parentPath);
        const currentIndex = keys.indexOf(itemName);

        if (currentIndex === -1) return;

        const newIndex = currentIndex + direction;
        if (newIndex < 0 || newIndex >= keys.length) {
            showFloatingMessage('Cannot move item beyond list boundaries', 'info');
            return;
        }

        // Swap in the order array
        [keys[currentIndex], keys[newIndex]] = [keys[newIndex], keys[currentIndex]];

        // Save the new order
        this._saveItemOrder(parentPath, keys);

        this._saveCurrentRoot();
        this.renderTree();
    }

    switchCaseTab(tab) {
    if (this.editorState.type !== 'case') return;
    
    this.setEditorTab(tab);
    
    const tabs = document.querySelectorAll('.case-editor-tab');
    tabs.forEach(t => t.classList.remove('active'));
    event.target.classList.add('active');
    
    const item = this.getEditorItem();
    if (!item || !item.caseName) return;
    
    this.renderCaseTab(item, this.editorState.itemName);
}

    renderCaseTab(item, name) {
        const content = document.getElementById('caseEditorContent');
        if (!content || !item) return;

        if (this.editorState.currentTab === 'shape') {
            this._renderShapeInputTab(item, content, false);
        } else if (this.editorState.currentTab === 'additional') {
            content.innerHTML = this._generateAdditionalInfoHTML(item, false);
        }
    }

    updateField(field, value) {
        const item = this.getEditorItem();
        if (item) {
            item[field] = value;
            AppState.developingJSONs[AppState.activeDevelopingJSON] = JSON.parse(JSON.stringify(this.treeData));
            saveDevelopingJSONs();
        }
    }

    _updateArray(target, field, value, checked) {
        if (!target) return;
        if (!Array.isArray(target[field])) {
            target[field] = [];
        }
        if (checked) {
            if (!target[field].includes(value)) {
                target[field].push(value);
            }
        } else {
            target[field] = target[field].filter(v => v !== value);
        }
    }

    _saveAndRefresh(isTemplate = false) {
        AppState.developingJSONs[AppState.activeDevelopingJSON] = JSON.parse(JSON.stringify(this.treeData));
        saveDevelopingJSONs();
        if (!isTemplate) {
            const item = this.getEditorItem();
            if (item) {
                this.renderCaseTab(item, this.editorState.itemName);
            }
        } else {
            this.renderTemplateTab();
        }
    }

    updateEquator(symbol, checked) {
        this._updateArray(this.getEditorItem(), 'equator', symbol, checked);
        this._saveAndRefresh();
    }

    updateParityMode(mode) {
        const item = this.getEditorItem();
        if (item) {
            if (mode === 'ignore') {
                item.parity = [];
            } else if (mode === 'overall') {
                item.parity = ['on'];
            } else if (mode === 'color-specific') {
                item.parity = ['tnbn'];
            }
            this._saveAndRefresh();
        }
    }

    updateMoveArray(field, move, checked) {
        this._updateArray(this.getEditorItem(), field, move, checked);
        this._saveAndRefresh();
    }

    updateNumberArray(field, num, checked) {
        this._updateArray(this.getEditorItem(), field, num, checked);
        this._saveAndRefresh();
    }

    _handleConstraint(target, action, position = null) {
        if (!target) return;

        if (action === 'add') {
            const posInput = document.getElementById('constraintPosition');
            const valsInput = document.getElementById('constraintValues');

            const pos = posInput.value.trim().toUpperCase();
            const values = valsInput.value.trim().split(',').map(v => v.trim().toLowerCase());

            if (!pos || !values.length || !values[0]) {
                showFloatingMessage('Please enter both position and values', 'error');
                return;
            }

            if (!target.constraints) target.constraints = {};
            target.constraints[pos] = values;

            posInput.value = '';
            valsInput.value = '';
        } else if (action === 'remove' && position) {
            if (target.constraints) {
                delete target.constraints[position];
            }
        }
    }

    addConstraint() {
        this._handleConstraint(this.getEditorItem(), 'add');
        this._saveAndRefresh();
    }

    removeConstraint(position) {
        this._handleConstraint(this.getEditorItem(), 'remove', position);
        this._saveAndRefresh();
    }

    showContextMenu(e, path, item, key) {
        e.preventDefault();
        e.stopPropagation();
        
        // Make mobile friendly
        const x = e.touches ? e.touches[0].clientX : e.clientX;
        const y = e.touches ? e.touches[0].clientY : e.clientY;

        this.uiState.selectedPath = path;
        this.uiState.selectedItem = item;
        this.renderTree();

        const isFolder = !item.caseName;
        const items = [];

        if (isFolder) {
            items.push({ text: 'New Case', action: () => this.newCase() });
            items.push({ text: 'New Folder', action: () => this.newFolder() });
            items.push({ text: 'Bulk Import', action: () => this.openBulkImport() });
            items.push({ separator: true });
        }

        items.push({ text: 'Rename', action: () => this.renameItem(path) });
        items.push({ text: 'Run', action: () => this.runItem(item, key) });
        if (!isFolder) {
            items.push({ text: 'Set as Template', action: () => this.setAsTemplate(item) });
        }
        items.push({ separator: true });
        items.push({ text: 'Copy', action: () => this.copy() });
        items.push({ text: 'Paste', action: () => this.paste(), disabled: !this.clipboard });
        items.push({ text: 'Copy JSON to Clipboard', action: () => this.copyItemJSON(item) });
        items.push({ separator: true });
        items.push({ text: 'Move Up', action: () => this.moveItem(path, -1) });
        items.push({ text: 'Move Down', action: () => this.moveItem(path, 1) });
        items.push({ separator: true });
        items.push({ text: 'Delete', action: () => this.delete() });

        this._createContextMenu(x, y, items);
    }

    showTreeRootContextMenu(e) {
        e.preventDefault();
        e.stopPropagation();

        // Make mobile friendly
        const x = e.touches ? e.touches[0].clientX : e.clientX;
        const y = e.touches ? e.touches[0].clientY : e.clientY;

        const items = [
            { text: 'New Case', action: () => { this.uiState.selectedPath = ''; this.uiState.selectedItem = null; this.newCase(); } },
            { text: 'New Folder', action: () => { this.uiState.selectedPath = ''; this.uiState.selectedItem = null; this.newFolder(); } },
            { text: 'Bulk Import', action: () => this.openBulkImportFromRoot() },
            { text: 'Paste', action: () => { this.uiState.selectedPath = ''; this.uiState.selectedItem = null; this.paste(); }, disabled: !this.clipboard },
            { separator: true },
            { text: 'Copy JSON to Clipboard', action: () => this.copyItemJSON(this.treeData) },
            { separator: true },
            { text: 'Run All', action: () => this.runJSON() }
        ];

        this._createContextMenu(x, y, items);
    }

    hideContextMenu() {
    if (this.contextMenu) {
        document.body.removeChild(this.contextMenu);
        this.contextMenu = null;
    }
    
    // Clean up scroll listener
    if (this.scrollHandler) {
        const treeContainer = document.getElementById('jsonCreatorTree');
        if (treeContainer) {
            treeContainer.removeEventListener('scroll', this.scrollHandler);
        }
        this.scrollHandler = null;
    }
}

    setupContextMenuListener() {
        const handleOutsideClick = (e) => {
            if (this.contextMenu && !this.contextMenu.contains(e.target)) {
                this.hideContextMenu();
            }
        };

        // Remove old listener if exists
        if (this.outsideClickHandler) {
            document.removeEventListener('click', this.outsideClickHandler);
        }

        this.outsideClickHandler = handleOutsideClick;
        setTimeout(() => {
            document.addEventListener('click', handleOutsideClick);
        }, 10);
    }

    setupContextMenuScrollListener() {
    const treeContainer = document.getElementById('jsonCreatorTree');
    if (!treeContainer) return;
    
    // Check if tree is actually scrollable
    const isScrollable = treeContainer.scrollHeight > treeContainer.clientHeight;
    
    if (!isScrollable) {
        // Tree is not scrollable, don't close context menu on scroll
        return;
    }
    
    const handleScroll = () => {
        if (this.contextMenu) {
            this.hideContextMenu();
            treeContainer.removeEventListener('scroll', handleScroll);
        }
    };
    
    // Remove old listener if exists
    if (this.scrollHandler) {
        treeContainer.removeEventListener('scroll', this.scrollHandler);
    }
    
    this.scrollHandler = handleScroll;
    treeContainer.addEventListener('scroll', handleScroll);
}

    renameItem(path) {
        setTimeout(() => {
            const itemDiv = document.querySelector(`[data-path="${path}"]`);
            if (itemDiv) {
                const input = itemDiv.querySelector('.tree-item-input');
                const currentName = path.split('/').pop();
                this.startRename(itemDiv, input, currentName);
            }
        }, 50);
    }

    runItem(item, key) {
        this.openRunModal(item, key);
    }

    switchRoot(rootName) {
        console.log('=== SWITCH ROOT START ===');
        console.log('Switching from:', AppState.activeDevelopingJSON, 'to:', rootName);
        console.log('Current treeData before save:', JSON.stringify(this.treeData).substring(0, 100));
        
        // Save current root BEFORE switching
        if (AppState.activeDevelopingJSON && this.treeData) {
            console.log('Saving current root:', AppState.activeDevelopingJSON);
            AppState.developingJSONs[AppState.activeDevelopingJSON] = JSON.parse(JSON.stringify(this.treeData));
            console.log('Saved data:', JSON.stringify(AppState.developingJSONs[AppState.activeDevelopingJSON]).substring(0, 100));
            saveDevelopingJSONs();
        }
        
        // Switch to new root
        AppState.activeDevelopingJSON = rootName;
        console.log('New active root:', AppState.activeDevelopingJSON);
        
        // Load the new root (with fresh data from AppState)
        if (!AppState.developingJSONs[rootName]) {
            console.error(`Root "${rootName}" does not exist!`);
            AppState.developingJSONs[rootName] = {};
        }
        
        console.log('Loading data for root:', rootName);
        console.log('Data from AppState:', JSON.stringify(AppState.developingJSONs[rootName]).substring(0, 100));
        
        this.treeData = JSON.parse(JSON.stringify(AppState.developingJSONs[rootName]));
        console.log('Loaded treeData:', JSON.stringify(this.treeData).substring(0, 100));
        
        this.itemOrder = {}; // Reset item order
        this.uiState.selectedPath = '';
        this.uiState.selectedItem = null;
        this.uiState.expandedFolders.clear();
        this.expandAllFolders(this.treeData, '');

        // Load root-specific case template
        const templateKey = `caseTemplate_${rootName}`;
        const storedTemplate = localStorage.getItem(templateKey);
        this.caseTemplate = storedTemplate ? JSON.parse(storedTemplate) : null;

        // Reset editor to welcome
        this.setEditorState('welcome');
        this.renderTree();
        this.renderEditor();

        const rootBtn = document.getElementById('rootSelectorBtn');
        if (rootBtn) rootBtn.textContent = rootName;
        
        console.log('=== SWITCH ROOT END ===');
    }

    openRootSelectorModal() {
        // Close existing modal if open
        const existingModal = document.querySelector('.root-selector-modal');
        if (existingModal) {
            existingModal.remove();
            return;
        }

        const button = document.getElementById('rootSelectorBtn');
        const buttonRect = button.getBoundingClientRect();

        const modal = document.createElement('div');
        modal.className = 'root-selector-modal';
        modal.style.cssText = `
            position: fixed;
            left: ${buttonRect.left}px;
            top: ${buttonRect.bottom + 2}px;
            min-width: ${buttonRect.width}px;
            background: #ffffff;
            border: 1px solid #d0d0d0;
            border-radius: 4px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            z-index: 20000;
        `;

        modal.innerHTML = `
            <div id="rootList" style="max-height: 400px; overflow-y: auto;">
                ${Object.keys(AppState.developingJSONs).map(root => `
                    <div class="root-list-item ${root === AppState.activeDevelopingJSON ? 'active' : ''}" 
                         data-root="${root}"
                         onclick="jsonCreator.selectRootFromModal('${root}')"
                         oncontextmenu="jsonCreator.showModalRootContextMenu(event, '${root}')"
                         style="padding: 10px 16px; cursor: pointer; font-size: 13px; color: #1a1a1a; border-bottom: 1px solid #e0e0e0;">
                        ${root}
                    </div>
                `).join('')}
            </div>
            <button onclick="jsonCreator.addRootFromModal()" style="width: 100%; padding: 10px 16px; background: #f5f5f5; border: none; border-top: 2px solid #d0d0d0; cursor: pointer; font-size: 13px; color: #0078d4; text-align: left;">
                + Add Root
            </button>
        `;

        document.body.appendChild(modal);

        // Close on outside click
        setTimeout(() => {
            const closeOnOutsideClick = (e) => {
                if (!modal.contains(e.target) && !button.contains(e.target)) {
                    modal.remove();
                    document.removeEventListener('click', closeOnOutsideClick);
                }
            };
            document.addEventListener('click', closeOnOutsideClick);
        }, 10);
    }

    selectRootFromModal(rootName) {
        this.switchRoot(rootName);
        const modal = document.querySelector('.root-selector-modal');
        if (modal) modal.remove();
    }

    showModalRootContextMenu(e, rootName) {
        e.preventDefault();
        e.stopPropagation();

        const items = [
            { text: 'Rename', action: () => this.renameRootFromModal(rootName) },
            { text: 'Delete', action: () => this.deleteRootFromModal(rootName), disabled: Object.keys(AppState.developingJSONs).length === 1 }
        ];

        this._createContextMenu(e.pageX, e.pageY, items);
    }

    addRootFromModal() {
        const modal = document.querySelector('.root-selector-modal');
        if (modal) modal.remove();

        showRenameModal('New Root', '', (name) => {
            if (AppState.developingJSONs[name]) {
                showFloatingMessage('A root with this name already exists', 'error');
                return;
            }

            AppState.developingJSONs[name] = {};
            saveDevelopingJSONs();

            this.switchRoot(name);
        });
    }

    renameRootFromModal(currentName) {
        const modal = document.querySelector('.root-selector-modal');
        if (modal) modal.remove();

        showRenameModal(`Rename Root: ${currentName}`, currentName, (newName) => {
            if (newName === currentName) return;

            if (AppState.developingJSONs[newName]) {
                showFloatingMessage('A root with this name already exists', 'error');
                return;
            }

            AppState.developingJSONs[newName] = AppState.developingJSONs[currentName];
            delete AppState.developingJSONs[currentName];

            if (AppState.activeDevelopingJSON === currentName) {
                AppState.activeDevelopingJSON = newName;
                this.treeData = AppState.developingJSONs[newName];
            }

            saveDevelopingJSONs();

            // Update button text if this was the active root
            const rootBtn = document.getElementById('rootSelectorBtn');
            if (rootBtn && AppState.activeDevelopingJSON === newName) {
                rootBtn.textContent = newName;
            }
        });
    }

    deleteRootFromModal(currentName) {
        if (Object.keys(AppState.developingJSONs).length === 1) {
            showFloatingMessage('Cannot delete the last root', 'error');
            return;
        }

        const modal = document.querySelector('.root-selector-modal');
        if (modal) modal.remove();

        showConfirmationModal(
            'Delete Root',
            `Delete root "${currentName}"? This cannot be undone.`,
            () => {
                console.log('=== DELETE ROOT START ===');
                console.log('Deleting root:', currentName);
                console.log('Active root before delete:', AppState.activeDevelopingJSON);
                console.log('All roots before delete:', Object.keys(AppState.developingJSONs));
                
                const isDeletingActiveRoot = AppState.activeDevelopingJSON === currentName;
                
                // Delete the root from AppState
                delete AppState.developingJSONs[currentName];
                
                console.log('All roots after delete:', Object.keys(AppState.developingJSONs));
                
                saveDevelopingJSONs();
                console.log('Saved to localStorage');

                // If we deleted the active root, switch to the first available one
                if (isDeletingActiveRoot) {
                    const firstRoot = Object.keys(AppState.developingJSONs)[0];
                    console.log('Deleted active root, switching to:', firstRoot);
                    
                    // DON'T call switchRoot - it will try to save the deleted root!
                    // Manually do what switchRoot does without saving first
                    AppState.activeDevelopingJSON = firstRoot;
                    
                    this.treeData = JSON.parse(JSON.stringify(AppState.developingJSONs[firstRoot]));
                    this.itemOrder = {};
                    this.uiState.selectedPath = '';
                    this.uiState.selectedItem = null;
                    this.uiState.expandedFolders.clear();
                    this.expandAllFolders(this.treeData, '');

                    const templateKey = `caseTemplate_${firstRoot}`;
                    const storedTemplate = localStorage.getItem(templateKey);
                    this.caseTemplate = storedTemplate ? JSON.parse(storedTemplate) : null;

                    this.setEditorState('welcome');
                    this.renderTree();
                    this.renderEditor();

                    const rootBtn = document.getElementById('rootSelectorBtn');
                    if (rootBtn) rootBtn.textContent = firstRoot;
                    
                    console.log('Switched to:', firstRoot);
                } else {
                    console.log('Deleted non-active root, current root:', AppState.activeDevelopingJSON);
                }
                
                console.log('=== DELETE ROOT END ===');
            }
        );
    }

    copyJSON() {
        navigator.clipboard.writeText(JSON.stringify(this.treeData, null, 2))
            .then(() => alert('JSON copied to clipboard!'))
            .catch(err => alert('Failed to copy: ' + err));
    }

    extractJSON() {

        this._saveCurrentRoot();

        const jsonString = JSON.stringify(this.treeData, null, 2);

        // Remove any existing extract modal first
        const existingModal = document.querySelector('.extract-json-modal');
        if (existingModal) {
            existingModal.remove();
        }

        const modal = document.createElement('div');
        modal.className = 'modal active extract-json-modal';
        modal.style.zIndex = '20000'; // Higher than json-creator-fullscreen (10000)
        modal.style.background = 'rgba(0, 0, 0, 0.5)';
        modal.innerHTML = `
        <div class="modal-content extract-json-content" style="max-width: 800px; background: #ffffff; border: 1px solid #d0d0d0;">
            <div class="modal-header" style="border-bottom: 1px solid #d0d0d0;">
                <h2 style="color: #1a1a1a;">Extract JSON: ${AppState.activeDevelopingJSON}</h2>
                <button class="close-btn" onclick="this.closest('.modal').remove()" style="color: #666666;">×</button>
            </div>
            <div class="modal-body extract-json-body">
                <textarea readonly id="extractedJSON" style="width: 100%; min-height: 400px; font-family: 'Courier New', monospace; background: #f9f9f9; color: #1a1a1a; border: 1px solid #d0d0d0; border-radius: 6px; padding: 12px; margin-bottom: 60px;">${jsonString}</textarea>
            </div>
            <div class="extract-json-footer">
                <button class="json-creator-btn" id="copyJSONBtn">Copy JSON</button>
                <button class="json-creator-btn" id="downloadJSONBtn">Download JSON</button>
            </div>
        </div>
    `;
        document.body.appendChild(modal);

        // Check for elements that might be covering the modal
        const allElements = Array.from(document.body.children);
        allElements.forEach((el, idx) => {
            const styles = window.getComputedStyle(el);
        });

        // Check if json-creator-fullscreen exists
        const jsonCreatorFullscreen = document.getElementById('jsonCreatorFullscreen');
        if (jsonCreatorFullscreen) {
        }

        // Add event listeners after modal is in DOM
        const copyBtn = document.getElementById('copyJSONBtn');
        const downloadBtn = document.getElementById('downloadJSONBtn');

        if (!copyBtn || !downloadBtn) {
            console.error('[extractJSON] Buttons not found!', { copyBtn, downloadBtn });
            return;
        }

        copyBtn.addEventListener('click', () => {
            const textarea = document.getElementById('extractedJSON');
            navigator.clipboard.writeText(textarea.value).then(() => {
                showFloatingMessage('JSON copied to clipboard!', 'success');
            }).catch(err => {
                showFloatingMessage('Failed to copy: ' + err, 'error');
            });
        });

        downloadBtn.addEventListener('click', () => {
            const textarea = document.getElementById('extractedJSON');
            const jsonContent = textarea.value;

            showConfirmationModal(
                'Download JSON',
                `<p><strong>Tip:</strong> Save your JSON with the same name as your algset.</p><p>This will download as: <strong>${AppState.activeDevelopingJSON}.json</strong></p>`,
                () => {
                    const blob = new Blob([jsonContent], { type: 'application/json' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `${AppState.activeDevelopingJSON}.json`;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                }
            );
        });

        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.remove();
            }
        });
    }

    runJSON() {
        this.openRunModal(this.treeData, AppState.activeDevelopingJSON);
    }

    openRunModal(jsonData, name) {
        const modal = document.createElement('div');
        modal.className = 'run-modal';
        modal.innerHTML = `
        <div class="run-modal-content">
            <div class="run-modal-header">
                <h2>Running: ${name}</h2>
                <button class="close-btn" onclick="this.closest('.run-modal').remove()">×</button>
            </div>
            <div class="run-modal-progress">
                <div class="progress-bar-container">
                    <div class="progress-bar-fill" id="runProgressBar" style="width: 0%"></div>
                    <div class="progress-text" id="runProgressText">0 / 100</div>
                </div>
                <button class="stop-button" id="stopRunButton">Stop</button>
            </div>
            <div class="run-modal-body" id="runResultsContainer"></div>
        </div>
    `;
        document.body.appendChild(modal);

        let stopped = false;
        const stopButton = document.getElementById('stopRunButton');
        stopButton.onclick = () => {
            stopped = true;
            stopButton.disabled = true;
            stopButton.textContent = 'Stopped';
        };

        // Wrap single case in an object structure if needed
        const dataToRun = jsonData.caseName ? { [name]: jsonData } : jsonData;
        this.generateScrambles(dataToRun, modal, () => stopped);
    }

    async generateScrambles(jsonData, modal, isStopped) {
        const resultsContainer = document.getElementById('runResultsContainer');
        const progressBar = document.getElementById('runProgressBar');
        const progressText = document.getElementById('runProgressText');

        const cases = this._collectAllCases(jsonData);

        if (cases.length === 0) {
            resultsContainer.innerHTML = '<div style="color: #888; text-align: center; padding: 40px;">No cases found in this JSON</div>';
            return;
        }

        const totalScrambles = 100;
        let generated = 0;

        const generateOne = async () => {
            if (isStopped() || generated >= totalScrambles) {
                return;
            }

            try {
                const randomCase = cases[Math.floor(Math.random() * cases.length)];

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

                let scramble = '';
                let solverAttempts = 0;
                const maxSolverAttempts = 10;
                let solverSuccess = false;

                while (!solverSuccess && solverAttempts < maxSolverAttempts) {
                    solverAttempts++;
                    try {
                        if (typeof window.Square1Solver !== 'undefined') {
                            scramble = window.Square1Solver.solve(result.hexState);
                            solverSuccess = true;
                        } else {
                            scramble = '⚠ Solver not loaded';
                            solverSuccess = true;
                        }
                    } catch (solverError) {
                        const isShiftError = solverError.message && solverError.message.includes("Cannot read properties of undefined (reading 'shift')");

                        if (isShiftError && solverAttempts < maxSolverAttempts) {
                            await new Promise(resolve => setTimeout(resolve, 10));
                            continue;
                        }

                        scramble = `⚠ Error: ${solverError.message}`;
                        solverSuccess = true;
                    }
                }

                const inputHex = config.topLayer + '|' + config.bottomLayer;

                // Extract ABF and RBL details
                const [auf, adf] = result.abf.split('-');
                const rblMatch = result.rbl.match(/RUL:(-?\d+), RDL:(-?\d+)/);
                const rul = rblMatch ? rblMatch[1] : '0';
                const rdl = rblMatch ? rblMatch[2] : '0';

                const resultDiv = document.createElement('div');
                resultDiv.className = 'scramble-result-item';
                resultDiv.innerHTML = `
                <div class="scramble-result-info">
                    <div><strong>Case Name:</strong> ${randomCase.caseName}</div>
                    <div><strong>Case Path:</strong> ${randomCase.path}</div>
                    <div><strong>Scramble:</strong> <span style="font-family: monospace;">${scramble}</span></div>
                    <div><strong>AUF:</strong> ${auf} , <strong>ADF:</strong> ${adf}</div>
                    <div><strong>RUL:</strong> ${rul} , <strong>RDL:</strong> ${rdl}</div>
                    <div><strong>Equator:</strong> ${result.equator}</div>
                </div>
                <div class="scramble-result-viz">
                    ${typeof window.Square1VisualizerLibraryWithSillyNames !== 'undefined'
                        ? window.Square1VisualizerLibraryWithSillyNames.visualizeFromHexCodePlease(
                            result.hexState,
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
                        : '<div style="color: #888;">Visualization unavailable</div>'
                    }
                </div>
            `;

                resultsContainer.appendChild(resultDiv);
                generated++;

                const progress = (generated / totalScrambles) * 100;
                progressBar.style.width = `${progress}%`;
                progressText.textContent = `${generated} / ${totalScrambles}`;

                // Debounce: wait 50ms before next generation
                await new Promise(resolve => setTimeout(resolve, 50));

                // Continue generating
                generateOne();

            } catch (error) {
                console.error('Error generating scramble:', error);
                const errorDiv = document.createElement('div');
                errorDiv.style.cssText = 'color: #ef4444; padding: 12px; background: #3a1a1a; border-radius: 6px; margin-bottom: 12px;';
                errorDiv.textContent = `Error: ${error.message}`;
                resultsContainer.appendChild(errorDiv);

                // Continue despite error
                generated++;
                await new Promise(resolve => setTimeout(resolve, 50));
                generateOne();
            }
        };

        // Start generation
        generateOne();
    }

    showExtraTools(event) {
        event.stopPropagation();

        const buttonRect = event.currentTarget.getBoundingClientRect();
        const items = [
            { text: 'Case Template', action: () => this.openCaseTemplate() },
            { text: 'Import Data to Root', action: () => this.importDataToRoot() },
            { text: 'Reset Root', action: () => this.resetRoot() }
        ];

        this._createContextMenu(buttonRect.left, buttonRect.bottom + 2, items);
    }

    openCaseTemplate() {
        // Use existing template or create default
        const template = this.caseTemplate || { ...this.DEFAULT_CASE };
        delete template.caseName;
        delete template.alg;

        // Store the template temporarily for editing
        this.editingTemplate = JSON.parse(JSON.stringify(template));

        this.setEditorState('template');
        this.renderEditor();
    }

    switchTemplateTab(tab) {
    if (this.editorState.type !== 'template') return;
    
    this.setEditorTab(tab);
    
    const tabs = document.querySelectorAll('.case-editor-tab');
    tabs.forEach(t => t.classList.remove('active'));
    event.target.classList.add('active');
    
    this.renderTemplateTab();
}

    renderTemplateTab() {
        const content = document.getElementById('templateEditorContent');
        if (!content || !this.editingTemplate) return;

        if (this.editorState.currentTab === 'shape') {
            this._renderShapeInputTab(this.editingTemplate, content, true);
        } else if (this.editorState.currentTab === 'additional') {
            content.innerHTML = this._generateAdditionalInfoHTML(this.editingTemplate, true);
        }
    }

    updateTemplateEquator(symbol, checked) {
        this._updateArray(this.editingTemplate, 'equator', symbol, checked);
    }

    updateTemplateParityMode(mode) {
        if (mode === 'ignore') {
            this.editingTemplate.parity = [];
        } else if (mode === 'overall') {
            this.editingTemplate.parity = ['on'];
        } else if (mode === 'color-specific') {
            this.editingTemplate.parity = ['tnbn'];
        }
        this.renderTemplateTab();
    }

    updateTemplateMoveArray(field, move, checked) {
        this._updateArray(this.editingTemplate, field, move, checked);
    }

    updateTemplateNumberArray(field, num, checked) {
        this._updateArray(this.editingTemplate, field, num, checked);
    }

    addTemplateConstraint() {
        this._handleConstraint(this.editingTemplate, 'add');
        this.renderTemplateTab();
    }

    removeTemplateConstraint(position) {
        this._handleConstraint(this.editingTemplate, 'remove', position);
        this.renderTemplateTab();
    }

    saveCaseTemplate() {
        this.caseTemplate = JSON.parse(JSON.stringify(this.editingTemplate));
        const templateKey = `caseTemplate_${AppState.activeDevelopingJSON}`;
        localStorage.setItem(templateKey, JSON.stringify(this.caseTemplate));
        showFloatingMessage('Case template saved successfully!', 'success');

        // Return to whatever was being edited before
        if (this.uiState.selectedItem && this.uiState.selectedItem.caseName) {
            const caseName = this.uiState.selectedPath.split('/').pop();
            this.setEditorState('case', this.uiState.selectedItem, caseName);
        } else {
            this.setEditorState('welcome');
        }
        this.renderEditor();
    }

    clearCaseTemplate() {
        showConfirmationModal(
            'Clear Template',
            'Are you sure you want to clear the case template?',
            () => {
                this.caseTemplate = null;
                this.editingTemplate = null;
                const templateKey = `caseTemplate_${AppState.activeDevelopingJSON}`;
                localStorage.removeItem(templateKey);
                showFloatingMessage('Case template cleared!', 'success');

                // Return to whatever was being edited before
                if (this.uiState.selectedItem && this.uiState.selectedItem.caseName) {
                    const caseName = this.uiState.selectedPath.split('/').pop();
                    this.setEditorState('case', this.uiState.selectedItem, caseName);
                } else {
                    this.setEditorState('welcome');
                }
                this.renderEditor();
            }
        );
    }

    setAsTemplate(item) {
        showConfirmationModal(
            'Override Template',
            'Do you want to override your current template? This cannot be undone.',
            () => {
                const template = JSON.parse(JSON.stringify(item));
                delete template.alg;
                delete template.caseName;

                this.caseTemplate = template;
                const templateKey = `caseTemplate_${AppState.activeDevelopingJSON}`;
                localStorage.setItem(templateKey, JSON.stringify(this.caseTemplate));
                showFloatingMessage('Case set as template successfully!', 'success');
            }
        );
    }

    importDataToRoot() {
        this._createFileImportModal(
            `Import Data to Root: ${AppState.activeDevelopingJSON}`,
            (jsonText, mode) => this._processRootImport(jsonText, mode),
            'root'
        );
    }

    _processRootImport(jsonText, mode) {
        try {
            const importedData = JSON.parse(jsonText);

            if (mode === 'override') {
                this.treeData = importedData;
                AppState.developingJSONs[AppState.activeDevelopingJSON] = JSON.parse(JSON.stringify(importedData));
            } else if (mode === 'add') {
                const mergeObjects = (target, source) => {
                    Object.keys(source).forEach(key => {
                        if (source[key] && typeof source[key] === 'object' && !source[key].caseName) {
                            if (!target[key]) target[key] = {};
                            mergeObjects(target[key], source[key]);
                        } else {
                            let finalKey = key;
                            let counter = 1;
                            while (target[finalKey]) {
                                finalKey = `${key}_${counter}`;
                                counter++;
                            }
                            target[finalKey] = JSON.parse(JSON.stringify(source[key]));
                            if (target[finalKey].caseName) {
                                target[finalKey].caseName = finalKey;
                            }
                        }
                    });
                };
                mergeObjects(this.treeData, importedData);
                AppState.developingJSONs[AppState.activeDevelopingJSON] = JSON.parse(JSON.stringify(this.treeData));
            }

            this.uiState.expandedFolders.clear();
            this.expandAllFolders(this.treeData, '');
            this._saveCurrentRoot();
            this.renderTree();
            showFloatingMessage('Data imported to root successfully!', 'success');
        } catch (error) {
            showFloatingMessage('Invalid JSON: ' + error.message, 'error');
        }
    }

    resetRoot() {
        showConfirmationModal(
            'Reset Root',
            `Are you sure you want to reset the root "${AppState.activeDevelopingJSON}"? This will delete all cases and folders. This cannot be undone.`,
            () => {
                this.treeData = {};
                AppState.developingJSONs[AppState.activeDevelopingJSON] = {};
                this.itemOrder = {};
                
                // Clear template for this root
                const templateKey = `caseTemplate_${AppState.activeDevelopingJSON}`;
                localStorage.removeItem(templateKey);
                this.caseTemplate = null;
                
                saveDevelopingJSONs();

                this.uiState.selectedPath = '';
                this.uiState.selectedItem = null;
                this.uiState.expandedFolders.clear();
                
                this.setEditorState('welcome');
                this.renderTree();
                this.renderEditor();

                showFloatingMessage('Root reset successfully!', 'success');
            }
        );
    }

    openBulkImportFromRoot() {
        showConfirmationModal(
            'Bulk Import to Root',
            'Bulk importing directly to the project root is deprecated. Do you want to proceed anyway?',
            () => {
                this.uiState.selectedPath = '';
                this.uiState.selectedItem = null;
                this.openBulkImport();
            }
        );
    }

    openBulkImport() {
        const modal = document.createElement('div');
        modal.className = 'modal active extract-json-modal';
        modal.style.zIndex = '20000';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 600px;">
                <div class="modal-header">
                    <h2>Bulk Import Cases</h2>
                    <button class="close-btn" onclick="this.closest('.modal').remove()">×</button>
                </div>
                <div class="modal-body">
                    <div style="margin-bottom: 16px;">
                        <label style="font-weight: 500; margin-bottom: 8px; display: block;">Algorithm Notation:</label>
                        <div style="display: flex; gap: 16px;">
                            <label style="display: flex; align-items: center; gap: 6px; cursor: pointer;">
                                <input type="radio" name="bulkImportNotation" value="normal" checked>
                                <span>Normal Notation</span>
                            </label>
                            <label style="display: flex; align-items: center; gap: 6px; cursor: pointer;">
                                <input type="radio" name="bulkImportNotation" value="karnotation">
                                <span>Karnotation</span>
                            </label>
                        </div>
                    </div>
                    
                    <div style="margin-bottom: 16px; padding: 12px; background: #f5f5f5; border-radius: 4px; font-size: 12px; color: #666;">
                        <strong>Note:</strong> Apart from the top and bottom input, everything else will be configured according to the case template.
                    </div>
                    
                    <div style="margin-bottom: 16px;">
                        <input type="file" id="bulkImportFile" accept=".csv,.xlsx" style="display: none;">
                        <div id="bulkImportDropZone" 
                             style="width: 100%; min-height: 200px; background: #f9f9f9; border: 2px dashed #d0d0d0; border-radius: 8px; display: flex; flex-direction: column; align-items: center; justify-content: center; cursor: pointer; color: #666; text-align: center; padding: 20px;">
                            <div style="font-size: 48px; margin-bottom: 12px;">📊</div>
                            <div style="font-size: 14px; font-weight: 500; margin-bottom: 4px;">Drop file here or click to choose</div>
                            <div style="font-size: 12px; color: #999;">Supports .csv and .xlsx files</div>
                            <div id="bulkImportFileName" style="margin-top: 12px; font-size: 13px; color: #0078d4; font-weight: 500;"></div>
                        </div>
                    </div>
                    
                    <button class="json-creator-btn" id="bulkImportProcessBtn" style="width: 100%; display: none;">Import Cases</button>
                    <button class="json-creator-btn json-creator-btn-secondary" onclick="this.closest('.modal').remove()" style="margin-top: 12px; width: 100%;">Cancel</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);

        const fileInput = document.getElementById('bulkImportFile');
        const dropZone = document.getElementById('bulkImportDropZone');
        const fileNameDisplay = document.getElementById('bulkImportFileName');
        const processBtn = document.getElementById('bulkImportProcessBtn');

        let selectedFile = null;

        const handleFile = (file) => {
            if (file && (file.name.endsWith('.csv') || file.name.endsWith('.xlsx'))) {
                selectedFile = file;
                fileNameDisplay.textContent = `Selected: ${file.name}`;
                processBtn.style.display = 'block';
            } else {
                showFloatingMessage('Please select a valid CSV or XLSX file', 'error');
            }
        };

        dropZone.onclick = () => fileInput.click();
        fileInput.onchange = (e) => handleFile(e.target.files[0]);

        dropZone.ondragover = (e) => {
            e.preventDefault();
            dropZone.style.background = '#e0e0e0';
        };
        dropZone.ondragleave = () => {
            dropZone.style.background = '#f9f9f9';
        };
        dropZone.ondrop = (e) => {
            e.preventDefault();
            dropZone.style.background = '#f9f9f9';
            handleFile(e.dataTransfer.files[0]);
        };

        processBtn.onclick = () => {
            const notation = document.querySelector('input[name="bulkImportNotation"]:checked').value;
            this.processBulkImport(selectedFile, notation);
            modal.remove();
        };

        modal.addEventListener('click', (e) => {
            if (e.target === modal) modal.remove();
        });
    }

    async processBulkImport(file, notation) {
        try {
            const data = await this.readFileData(file);
            
            if (!data || data.length === 0) {
                showFloatingMessage('File is empty or invalid', 'error');
                return;
            }

            const parent = this.getTargetFolder();
            let successCount = 0;
            let failCount = 0;

            for (let i = 0; i < data.length; i++) {
                const row = data[i];
                
                if (!row || row.length < 2) {
                    failCount++;
                    continue;
                }

                const caseName = String(row[0]).trim();
                const algorithm = String(row[1]).trim();

                if (!caseName || !algorithm) {
                    failCount++;
                    continue;
                }

                try {
                    // Process algorithm based on notation
                    let processedAlg = algorithm;

                    // Convert karnotation if needed
                    if (notation === 'karnotation') {
                        if (typeof window.makeAPBLDocScrambleWCANotationPlease !== 'undefined') {
                            processedAlg = window.makeAPBLDocScrambleWCANotationPlease(algorithm);
                        } else {
                            throw new Error('Karnotation converter not loaded');
                        }
                    }

                    // Normalize
                    if (typeof window.ScrambleNormalizer !== 'undefined') {
                        processedAlg = window.ScrambleNormalizer.normalizeScramble(processedAlg);
                    }

                    // Invert
                    if (typeof window.pleaseInvertThisScrambleForSolutionVisualization !== 'undefined') {
                        processedAlg = window.pleaseInvertThisScrambleForSolutionVisualization(processedAlg);
                    }

                    // Hexify
                    if (typeof window.sq1AlgToHex !== 'undefined') {
                        const hexResult = window.sq1AlgToHex(processedAlg);

                        // Create new case
                        const uniqueName = this.getUniqueName(parent, caseName);
                        
                        // Use template if available
                        if (this.caseTemplate) {
                            parent[uniqueName] = JSON.parse(JSON.stringify(this.caseTemplate));
                        } else {
                            parent[uniqueName] = { ...this.DEFAULT_CASE };
                        }

                        parent[uniqueName].caseName = uniqueName;
                        parent[uniqueName].inputTop = hexResult.tlHex;
                        parent[uniqueName].inputBottom = hexResult.blHex;
                        parent[uniqueName].alg = algorithm;

                        successCount++;
                    } else {
                        throw new Error('Hexify converter not loaded');
                    }
                } catch (error) {
                    console.error(`Failed to process case "${caseName}":`, error);
                    failCount++;
                }
            }

            // Auto-expand parent folder if not already expanded
            if (this.uiState.selectedPath && !this.uiState.expandedFolders.has(this.uiState.selectedPath)) {
                this.uiState.expandedFolders.add(this.uiState.selectedPath);
            }

            this.renderTree();

            showFloatingMessage(
                `Bulk import complete: ${successCount} cases imported, ${failCount} failed`,
                failCount === 0 ? 'success' : 'info'
            );
        } catch (error) {
            console.error('Bulk import error:', error);
            showFloatingMessage('Failed to process file: ' + error.message, 'error');
        }
    }

    async readFileData(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            
            reader.onload = async (e) => {
                try {
                    const content = e.target.result;
                    
                    if (file.name.endsWith('.csv')) {
                        // Use Papaparse for CSV
                        if (typeof Papa !== 'undefined') {
                            const parsed = Papa.parse(content, {
                                skipEmptyLines: true
                            });
                            resolve(parsed.data);
                        } else {
                            // Fallback simple CSV parsing
                            const lines = content.split('\n').filter(line => line.trim());
                            const data = lines.map(line => line.split(',').map(cell => cell.trim()));
                            resolve(data);
                        }
                    } else if (file.name.endsWith('.xlsx')) {
                        // Use SheetJS for XLSX
                        if (typeof XLSX !== 'undefined') {
                            const workbook = XLSX.read(content, { type: 'binary' });
                            const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
                            const data = XLSX.utils.sheet_to_json(firstSheet, { header: 1 });
                            resolve(data);
                        } else {
                            reject(new Error('XLSX library not loaded'));
                        }
                    } else {
                        reject(new Error('Unsupported file type'));
                    }
                } catch (error) {
                    reject(error);
                }
            };
            
            reader.onerror = () => reject(new Error('Failed to read file'));
            
            if (file.name.endsWith('.xlsx')) {
                reader.readAsBinaryString(file);
            } else {
                reader.readAsText(file);
            }
        });
    }

    close() {
        showConfirmationModal(
            'Close Algset Devtool',
            'Close Algset Devtool? All changes are auto-saved.',
            () => {
                this._saveCurrentRoot();
                saveLastScreen('training');

                const fullscreen = document.getElementById('jsonCreatorFullscreen');
                if (fullscreen) {
                    fullscreen.remove();
                }

                // Return to training screen
                renderApp();
                setupEventListeners();
                if (AppState.selectedCases.length > 0) {
                    generateNewScramble();
                }
            }
        );
    }

    openDataManagement() {
        this._createModal('Data Management', `
        <div style="display: flex; flex-direction: column; gap: 12px;">
            <button class="json-creator-btn" onclick="jsonCreator.exportAllData()">Export All Data</button>
            <button class="json-creator-btn" onclick="jsonCreator.importData()">Import Data</button>
            <button class="json-creator-btn" onclick="jsonCreator.resetAllData()">Reset All Data</button>
        </div>
    `, { className: 'data-management-modal' });
    }

    resetAllData() {
        showConfirmationModal(
            'Reset All Data',
            'Are you sure you want to reset ALL data? This will delete all developing JSONs and cannot be undone.',
            () => {
                AppState.developingJSONs = { 'default': DEFAULT_ALGSET };
                AppState.activeDevelopingJSON = 'default';
                saveDevelopingJSONs();

                this.treeData = JSON.parse(JSON.stringify(DEFAULT_ALGSET));
                this.uiState.selectedPath = '';
                this.uiState.selectedItem = null;
                this.uiState.expandedFolders.clear();
                this.expandAllFolders(this.treeData, '');
                
                this.setEditorState('welcome');
                this.renderTree();
                this.renderEditor();

                const rootBtn = document.getElementById('rootSelectorBtn');
                if (rootBtn) rootBtn.textContent = 'default';

                showFloatingMessage('All data has been reset', 'success');
                document.querySelector('.data-management-modal').remove();
            }
        );
    }

    exportAllData() {
        this._saveCurrentRoot();

        const allData = JSON.stringify(AppState.developingJSONs, null, 2);
        const blob = new Blob([allData], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'sq1-all-data.json';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    importData() {
        document.querySelector('.modal').remove();

        this._createFileImportModal(
            'Import Data',
            (jsonText, mode) => this._processGeneralImport(jsonText, mode),
            'general'
        );
    }

    _processGeneralImport(jsonText, mode) {
        try {
            const importedData = JSON.parse(jsonText);

            if (mode === 'override') {
                AppState.developingJSONs = importedData;
                AppState.activeDevelopingJSON = Object.keys(importedData)[0] || 'default';
            } else if (mode === 'add') {
                Object.keys(importedData).forEach(rootName => {
                    let finalName = rootName;
                    let counter = 1;
                    while (AppState.developingJSONs[finalName]) {
                        finalName = `${rootName}_${counter}`;
                        counter++;
                    }
                    AppState.developingJSONs[finalName] = importedData[rootName];
                });
            }

            saveDevelopingJSONs();
            this.switchRoot(AppState.activeDevelopingJSON);
            showFloatingMessage('Data imported successfully!', 'success');
        } catch (error) {
            showFloatingMessage('Invalid JSON: ' + error.message, 'error');
        }
    }

    toggleSidebar() {
        const sidebar = document.querySelector('.json-creator-sidebar');
        if (sidebar) {
            sidebar.classList.toggle('hidden');
        }
    }
}

let jsonCreator = new JSONCreator();

function showJsonCreatorFullscreen() {
    jsonCreator = new JSONCreator();
    jsonCreator.show();
}

function closeJsonCreator() {
    jsonCreator.close();
}
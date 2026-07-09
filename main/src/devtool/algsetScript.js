import {
    DEFAULT_CASE,
    childPath,
    clone,
    collectCases,
    collectFolders,
    createCaseFromTemplate,
    getNode,
    getParent,
    getUniqueName,
    isCase,
    isFolder,
    isObject,
    joinPath,
    splitPath
} from './model.js';

const EXECUTE_VERBS = ['append', 'set', 'add', 'remove', 'replace', 'rename', 'copy'];
const TARGET_FIELDS = ['case-name', 'folder-name', 'path', 'top-layer', 'bottom-layer', 'topLayer', 'bottomLayer', 'alg', 'parity', 'constraints', 'pre-abf', 'post-abf', 'preABF', 'postABF', 'pre-auf', 'pre-adf', 'post-auf', 'post-adf', 'rul', 'rdl', 'auf', 'adf'];
const KEYWORDS = ['if', 'in', 'here', 'root', 'selected', 'where', 'and', 'create', 'delete', 'append', 'set', 'add', 'remove', 'replace', 'rename', 'copy', 'from', 'template', 'with'];
const OPERATORS = ['is', 'contains', 'starts-with', 'ends-with', 'matches', 'has', 'split'];

function scriptError(message) {
    return new Error(message);
}

function normalizeSpace(value) {
    return String(value || '').replace(/\s+/g, ' ').trim();
}

function isWordBoundary(value, index) {
    return !/[a-z0-9-]/i.test(value[index] || '');
}

function hasKeywordBoundary(value, index, length) {
    return isWordBoundary(value, index - 1) && isWordBoundary(value, index + length);
}

function scanSegments(text, callback) {
    let quote = '';
    let square = 0;
    let curly = 0;
    for (let index = 0; index < text.length; index += 1) {
        const char = text[index];
        const previous = text[index - 1];
        if (quote) {
            if (char === quote && previous !== '\\') quote = '';
            continue;
        }
        if (char === '"' || char === "'") {
            quote = char;
            continue;
        }
        if (char === '[') square += 1;
        else if (char === ']') square = Math.max(0, square - 1);
        else if (char === '{') curly += 1;
        else if (char === '}') curly = Math.max(0, curly - 1);
        if (!square && !curly && callback(char, index, text) === true) return index;
    }
    return -1;
}

function splitStatements(script) {
    const statements = [];
    let start = 0;
    scanSegments(script, (char, index) => {
        if (char !== '.') return false;
        const statement = script.slice(start, index).trim();
        if (statement) statements.push(statement);
        start = index + 1;
        return false;
    });
    const tail = script.slice(start).trim();
    if (tail) statements.push(tail);
    return statements;
}

function findKeyword(text, keywords, startIndex = 0) {
    const lower = text.toLowerCase();
    return scanSegments(text, (_char, index) => {
        if (index < startIndex) return false;
        for (const keyword of keywords) {
            if (lower.startsWith(keyword, index) && hasKeywordBoundary(lower, index, keyword.length)) {
                return true;
            }
        }
        return false;
    });
}

function findExecuteStart(text) {
    return findKeyword(text, EXECUTE_VERBS);
}

function splitByCommandJoiners(text) {
    const parts = [];
    let start = 0;
    const lower = text.toLowerCase();
    scanSegments(text, (_char, index) => {
        const isAmp = text[index] === '&';
        const isAnd = lower.startsWith('and', index) && hasKeywordBoundary(lower, index, 3);
        if (!isAmp && !isAnd) return false;
        const joinerLength = isAmp ? 1 : 3;
        const after = text.slice(index + joinerLength).trimStart().toLowerCase();
        if (!EXECUTE_VERBS.some((verb) => after.startsWith(`${verb} `) || after === verb)) return false;
        const part = text.slice(start, index).trim();
        if (part) parts.push(part);
        start = index + joinerLength;
        return false;
    });
    const tail = text.slice(start).trim();
    if (tail) parts.push(tail);
    return parts;
}

function splitTargetFilters(text) {
    const parts = [];
    let start = 0;
    const lower = text.toLowerCase();
    scanSegments(text, (_char, index) => {
        const isWhere = lower.startsWith('where', index) && hasKeywordBoundary(lower, index, 5);
        const isAnd = lower.startsWith('and', index) && hasKeywordBoundary(lower, index, 3);
        const isAmp = text[index] === '&';
        if (!isWhere && !isAnd && !isAmp) return false;
        const length = isWhere ? 5 : isAnd ? 3 : 1;
        const part = text.slice(start, index).trim();
        if (part) parts.push(part);
        start = index + length;
        return false;
    });
    const tail = text.slice(start).trim();
    if (tail) parts.push(tail);
    return parts;
}

function findLastInClause(text) {
    let found = -1;
    const lower = text.toLowerCase();
    scanSegments(text, (_char, index) => {
        if (lower.startsWith('in', index) && hasKeywordBoundary(lower, index, 2)) found = index;
        return false;
    });
    return found;
}

function unquote(value) {
    const text = String(value || '').trim();
    if ((text.startsWith('"') && text.endsWith('"')) || (text.startsWith("'") && text.endsWith("'"))) {
        return text.slice(1, -1).replaceAll('\\"', '"').replaceAll("\\'", "'");
    }
    return text;
}

function parseList(value) {
    const text = String(value || '').trim();
    if (!text.startsWith('[') || !text.endsWith(']')) return [unquote(text)].filter((item) => item !== '');
    const inner = text.slice(1, -1);
    const items = [];
    let start = 0;
    scanSegments(inner, (char, index) => {
        if (char !== ',') return false;
        const item = unquote(inner.slice(start, index).trim());
        if (item !== '') items.push(item);
        start = index + 1;
        return false;
    });
    const tail = unquote(inner.slice(start).trim());
    if (tail !== '') items.push(tail);
    return items;
}

function parsePathValue(value) {
    const text = String(value || '').trim();
    if (text === 'root') return [];
    if (text.startsWith('[')) {
        try {
            const parsed = JSON.parse(text);
            if (Array.isArray(parsed)) return parsed.map(String).filter(Boolean);
        } catch {
            return parseList(text).map(String).filter(Boolean);
        }
    }
    const raw = unquote(text);
    if (!raw) return [];
    return [raw];
}

function parseObjectLiteral(value) {
    const text = String(value || '').trim();
    if (!text.startsWith('{') || !text.endsWith('}')) return null;
    const inner = text.slice(1, -1);
    const result = {};
    let start = 0;
    const pushPair = (rawPair) => {
        const index = rawPair.indexOf(':');
        if (index < 0) return;
        const key = unquote(rawPair.slice(0, index).trim());
        result[key] = parseList(rawPair.slice(index + 1).trim()).map(String);
    };
    scanSegments(inner, (char, index) => {
        if (char !== ',') return false;
        pushPair(inner.slice(start, index).trim());
        start = index + 1;
        return false;
    });
    pushPair(inner.slice(start).trim());
    return result;
}

function toNumbers(values) {
    return values.map(Number).filter((value) => Number.isFinite(value));
}

function normalizeMove(value, face) {
    const text = String(value || '').trim();
    if (!text) return face === 'D' ? 'D0' : 'U0';
    if (/^-?\d+$/.test(text)) {
        if (text === '0') return `${face}0`;
        if (text === '1') return face;
        if (text === '2') return `${face}2`;
        if (text === '-1') return `${face}'`;
    }
    if (face === 'D') return text.replace(/^U/, 'D');
    return text.replace(/^D/, 'U');
}

function parseFieldValue(field, value) {
    const objectValue = parseObjectLiteral(value);
    if (field === 'constraints' && objectValue) return objectValue;
    if (field === 'inputTop' || field === 'inputBottom' || field === 'alg') return unquote(value);
    const list = parseList(value);
    if (field === 'rul' || field === 'rdl' || field === 'pre-abf') return toNumbers(list);
    if (field === 'auf') return list.map((item) => normalizeMove(item, 'U'));
    if (field === 'adf') return list.map((item) => normalizeMove(item, 'D'));
    if (field === 'post-abf') return list;
    return list.map(String);
}

function fieldName(alias) {
    const key = String(alias || '').toLowerCase();
    const map = {
        'top-layer': 'inputTop',
        toplayer: 'inputTop',
        'bottom-layer': 'inputBottom',
        bottomlayer: 'inputBottom',
        'case-name': 'caseName',
        'pre-abf': 'pre-abf',
        preabf: 'pre-abf',
        'post-abf': 'post-abf',
        postabf: 'post-abf',
        'pre-auf': 'rul',
        preauf: 'rul',
        'pre-adf': 'rdl',
        preadf: 'rdl',
        'post-auf': 'auf',
        postauf: 'auf',
        'post-adf': 'adf',
        postadf: 'adf'
    };
    return map[key] || key;
}

function getFieldValue(caseInfo, field) {
    if (field === 'path') return caseInfo.parts.join('/');
    if (field === 'folder-name') return caseInfo.folderParts.at(-1) || '';
    if (field === 'case-name' || field === 'caseName') return caseInfo.item.caseName || caseInfo.key;
    if (field === 'inputTop' || field === 'inputBottom') return caseInfo.item[field];
    const name = fieldName(field);
    return caseInfo.item[name];
}

function compareText(actual, operator, expected) {
    const text = String(actual ?? '');
    if (Array.isArray(expected)) return expected.map(String).includes(text);
    const value = String(expected ?? '');
    if (operator === 'is') return text === value;
    if (operator === 'contains') return value === '' || text.includes(value);
    if (operator === 'starts-with') return text.startsWith(value);
    if (operator === 'ends-with') return text.endsWith(value);
    if (operator === 'matches') return new RegExp(value).test(text);
    return false;
}

function pathContains(parts, expectedParts) {
    if (!expectedParts.length) return true;
    return parts.some((_, index) => expectedParts.every((part, offset) => parts[index + offset] === part));
}

function comparePath(parts, operator, expectedParts) {
    if (operator === 'is') return parts.length === expectedParts.length && expectedParts.every((part, index) => parts[index] === part);
    if (operator === 'contains') return pathContains(parts, expectedParts);
    if (operator === 'starts-with') return expectedParts.every((part, index) => parts[index] === part);
    if (operator === 'ends-with') return expectedParts.every((part, index) => parts[parts.length - expectedParts.length + index] === part);
    if (operator === 'matches') return new RegExp(expectedParts.join('/')).test(parts.join('/'));
    return false;
}

function parseCondition(text) {
    const normalized = normalizeSpace(text);
    let match = normalized.match(/^(case-name|folder-name)\s+split\s+(.+?)\s+(left|right)\s+is\s+(.+)$/i);
    if (match) {
        return {
            type: 'split',
            field: match[1].toLowerCase(),
            separator: unquote(match[2]),
            side: match[3].toLowerCase(),
            value: unquote(match[4])
        };
    }

    match = normalized.match(/^constraints\s+([^\s=]+)\s+has\s+(.+)$/i);
    if (match) return { type: 'constraint-has-value', position: unquote(match[1]), value: unquote(match[2]) };

    match = normalized.match(/^constraints\s+has\s+(.+)$/i);
    if (match) return { type: 'constraint-has-position', position: unquote(match[1]) };

    match = normalized.match(/^(case-name|folder-name|path|top-layer|topLayer|bottom-layer|bottomLayer|alg|parity|constraints|pre-abf|preABF|post-abf|postABF|pre-auf|preAUF|pre-adf|preADF|post-auf|postAUF|post-adf|postADF|rul|rdl|auf|adf)\s+(is|contains|starts-with|ends-with|matches|has)\s+(.+)$/i);
    if (!match) throw scriptError(`Could not parse target: ${text}`);
    const [, field, operator, rawValue] = match;
    const lowerField = fieldName(field);
    if (lowerField === 'path') return { type: 'path', operator: operator.toLowerCase(), value: parsePathValue(rawValue) };
    const value = rawValue.trim().startsWith('[') ? parseList(rawValue) : unquote(rawValue);
    return { type: 'field', field: lowerField, operator: operator.toLowerCase(), value };
}

function conditionMatches(caseInfo, condition) {
    if (condition.type === 'path') return comparePath(caseInfo.parts, condition.operator, condition.value);
    if (condition.type === 'split') {
        const actual = condition.field === 'folder-name' ? caseInfo.folderParts.at(-1) || '' : caseInfo.item.caseName || caseInfo.key;
        const parts = actual.split(condition.separator);
        const value = condition.side === 'left' ? parts[0] : parts.at(-1);
        return value === condition.value;
    }
    if (condition.type === 'constraint-has-position') return Object.hasOwn(caseInfo.item.constraints || {}, condition.position);
    if (condition.type === 'constraint-has-value') return (caseInfo.item.constraints?.[condition.position] || []).map(String).includes(String(condition.value));
    const actual = getFieldValue(caseInfo, condition.field);
    if (condition.field === 'folder-name') {
        return caseInfo.folderParts.some((folderName) => compareText(folderName, condition.operator, condition.value));
    }
    if (condition.operator === 'has') {
        if (Array.isArray(actual)) return actual.map(String).includes(String(condition.value));
        if (isObject(actual)) return Object.hasOwn(actual, String(condition.value));
    }
    if (condition.field === 'path') return comparePath(caseInfo.parts, condition.operator, condition.value);
    return compareText(actual, condition.operator, condition.value);
}

function collectCaseInfos(tree, path = []) {
    return collectCases(tree, path).map((item) => {
        const parts = splitPath(item.path);
        return {
            ...item,
            parts,
            parentPath: joinPath(parts.slice(0, -1)),
            folderParts: parts.slice(0, -1),
            parent: getParent(tree, item.path)?.parent || tree
        };
    });
}

function getScopeNode(tree, context, scopeText) {
    const scope = normalizeSpace(scopeText || 'root');
    if (!scope || scope === 'root') return { path: '', node: tree };
    if (scope === 'here') {
        const node = context.scopePath ? getNode(tree, context.scopePath) : tree;
        return { path: context.scopePath || '', node: node || tree };
    }
    if (scope === 'selected') {
        const node = context.selectedPath ? getNode(tree, context.selectedPath) : tree;
        return { path: context.selectedPath || '', node: node || tree };
    }
    const parts = parsePathValue(scope);
    const path = joinPath(parts);
    const node = path ? getNode(tree, path) : tree;
    if (!node) throw scriptError(`Folder path not found: ${scope}`);
    return { path, node };
}

function collectScopedCases(tree, context, scopeText) {
    const scope = getScopeNode(tree, context, scopeText);
    if (isCase(scope.node)) {
        const parts = splitPath(scope.path);
        return [{
            key: parts.at(-1) || scope.node.caseName,
            path: scope.path,
            labelPath: parts.join(' > '),
            item: scope.node,
            parts,
            parentPath: joinPath(parts.slice(0, -1)),
            folderParts: parts.slice(0, -1),
            parent: getParent(tree, scope.path)?.parent || tree
        }];
    }
    return collectCaseInfos(scope.node, splitPath(scope.path));
}

function parseTarget(text) {
    const executeStart = findExecuteStart(text);
    if (executeStart < 0) throw scriptError(`Missing execute command in: ${text}`);
    const targetText = text.slice(0, executeStart).trim();
    const commandText = text.slice(executeStart).trim();
    const inIndex = findLastInClause(targetText);
    const filterText = inIndex >= 0 ? targetText.slice(0, inIndex).trim() : targetText;
    const scopeText = inIndex >= 0 ? targetText.slice(inIndex + 2).trim() : 'root';
    return {
        conditions: splitTargetFilters(filterText).map(parseCondition),
        scopeText,
        commandText
    };
}

function parseFieldAssignment(command, verb) {
    const match = command.match(new RegExp(`^${verb}\\s+([a-z-]+)(?:\\s+([^=\\s]+))?\\s*=\\s*([\\s\\S]+)$`, 'i'));
    if (!match) throw scriptError(`Could not parse ${verb} command: ${command}`);
    return {
        verb: verb === 'set' ? 'append' : verb,
        field: fieldName(match[1]),
        subfield: match[2] ? unquote(match[2]) : '',
        value: match[3].trim()
    };
}

function parseExecuteCommand(command) {
    const normalized = normalizeSpace(command);
    let match = normalized.match(/^(append|set|add)\s+/i);
    if (match) return parseFieldAssignment(command, match[1].toLowerCase());

    match = normalized.match(/^remove\s+constraints(?:\s+([^=\s]+))?(?:\s*=\s*([\s\S]+))?$/i);
    if (match) return { verb: 'remove', field: 'constraints', subfield: match[1] ? unquote(match[1]) : '', value: match[2]?.trim() || '' };

    match = normalized.match(/^remove\s+([a-z-]+)(?:\s*=\s*([\s\S]+))?$/i);
    if (match) return { verb: 'remove', field: fieldName(match[1]), subfield: '', value: match[2]?.trim() || '' };

    match = command.match(/^replace\s+(top-layer|bottom-layer)\s*=\s*(\S+)\s+with\s+(\S+)$/i);
    if (match) return { verb: 'replace', field: fieldName(match[1]), matchMask: match[2], replaceMask: match[3] };

    match = command.match(/^rename\s+(case-name|folder-name)\s+replace\s+(.+?)\s+with\s+(.+)$/i);
    if (match) return { verb: 'rename', field: match[1].toLowerCase(), from: unquote(match[2]), to: unquote(match[3]) };

    match = command.match(/^copy\s+from\s+template$/i);
    if (match) return { verb: 'copy-template' };

    match = command.match(/^copy\s+([a-z-]+)\s+to\s+([a-z-]+)$/i);
    if (match) return { verb: 'copy', from: fieldName(match[1]), to: fieldName(match[2]) };

    throw scriptError(`Could not parse execute command: ${command}`);
}

function parseIfStatement(statement) {
    const body = statement.replace(/^if\s+/i, '').trim();
    const target = parseTarget(body);
    return {
        type: 'if',
        conditions: target.conditions,
        scopeText: target.scopeText,
        commands: splitByCommandJoiners(target.commandText).map(parseExecuteCommand)
    };
}

function parseSourceTemplate(text) {
    const normalized = normalizeSpace(text);
    const source = { type: 'empty', casePath: '' };
    if (/\bfrom\s+template\b/i.test(normalized)) source.type = 'template';
    const caseMatch = text.match(/\bfrom\s+case\s+(\[[\s\S]*?\]|"[^"]+"|'[^']+')/i);
    if (caseMatch) {
        source.type = 'case';
        source.casePath = joinPath(parsePathValue(caseMatch[1]));
    }
    return source;
}

function parseCreateStatement(statement) {
    const body = statement.replace(/^create\s+/i, '').trim();
    let match = body.match(/^case\s+(.+?)(?:\s+(from|with|in)\b|$)/i);
    if (match) {
        const name = unquote(match[1].trim());
        const withIndex = findKeyword(body, ['with']);
        const inIndex = findLastInClause(body);
        return {
            type: 'create-case',
            name,
            source: parseSourceTemplate(body),
            withText: withIndex >= 0 ? body.slice(withIndex + 4, inIndex >= 0 ? inIndex : body.length).trim() : '',
            scopeText: inIndex >= 0 ? body.slice(inIndex + 2).trim() : 'here'
        };
    }

    match = body.match(/^cases\s+(\[[\s\S]*?\])([\s\S]*)$/i);
    if (match) {
        const inIndex = findLastInClause(body);
        return {
            type: 'create-cases',
            names: parseList(match[1]),
            source: parseSourceTemplate(body),
            scopeText: inIndex >= 0 ? body.slice(inIndex + 2).trim() : 'here'
        };
    }

    match = body.match(/^folder\s+(.+?)(?:\s+in\b|$)/i);
    if (match) {
        const inIndex = findLastInClause(body);
        return {
            type: 'create-folder',
            pathValue: match[1].trim(),
            scopeText: inIndex >= 0 ? body.slice(inIndex + 2).trim() : 'here'
        };
    }

    match = body.match(/^folders\s+(\[[\s\S]*?\])([\s\S]*)$/i);
    if (match) {
        const inIndex = findLastInClause(body);
        return {
            type: 'create-folders',
            names: parseList(match[1]),
            scopeText: inIndex >= 0 ? body.slice(inIndex + 2).trim() : 'here'
        };
    }

    match = body.match(/^tree\s+(\[[\s\S]*?\])([\s\S]*)$/i);
    if (match) {
        const inIndex = findLastInClause(body);
        return {
            type: 'create-tree',
            groups: parseTreeGroups(match[1]),
            source: parseSourceTemplate(body),
            scopeText: inIndex >= 0 ? body.slice(inIndex + 2).trim() : 'here'
        };
    }

    throw scriptError(`Could not parse create command: ${statement}`);
}

function parseTreeGroups(block) {
    const inner = block.trim().slice(1, -1);
    const lines = inner.split(/\n|;/).map((line) => line.trim()).filter(Boolean);
    return lines.map((line) => {
        const [key, values = ''] = line.split('=');
        if (!key?.trim()) throw scriptError(`Invalid tree group: ${line}`);
        return {
            key: unquote(key.trim().replace(/,$/, '')),
            values: values.split(',').map((value) => unquote(value.trim())).filter(Boolean)
        };
    });
}

function parseDeleteStatement(statement) {
    const body = statement.replace(/^delete\s+/i, '').trim();
    let match = body.match(/^case\s+(.+?)(?:\s+in\b|$)/i);
    if (match) {
        const inIndex = findLastInClause(body);
        return { type: 'delete-case', name: unquote(match[1].trim()), scopeText: inIndex >= 0 ? body.slice(inIndex + 2).trim() : 'here' };
    }

    match = body.match(/^folder\s+(.+?)(?:\s+in\b|$)/i);
    if (match) {
        const inIndex = findLastInClause(body);
        return { type: 'delete-folder', name: unquote(match[1].trim()), scopeText: inIndex >= 0 ? body.slice(inIndex + 2).trim() : 'here' };
    }

    match = body.match(/^cases\s+if\s+([\s\S]+)$/i);
    if (match) return { type: 'delete-cases-if', target: parseDeleteTarget(match[1]) };

    match = body.match(/^folders\s+if\s+([\s\S]+)$/i);
    if (match) return { type: 'delete-folders-if', target: parseDeleteTarget(match[1]) };

    match = body.match(/^empty-folders(?:\s+in\s+([\s\S]+))?$/i);
    if (match) return { type: 'delete-empty-folders', scopeText: match[1]?.trim() || 'here' };

    match = body.match(/^constraints\s+([^\s]+)\s+if\s+([\s\S]+)$/i);
    if (match) return { type: 'delete-constraints-if', position: unquote(match[1]), target: parseDeleteTarget(match[2]) };

    match = body.match(/^alg\s+if\s+([\s\S]+)$/i);
    if (match) return { type: 'delete-alg-if', target: parseDeleteTarget(match[1]) };

    throw scriptError(`Could not parse delete command: ${statement}`);
}

function parseDeleteTarget(text) {
    const inIndex = findLastInClause(text);
    const filterText = inIndex >= 0 ? text.slice(0, inIndex).trim() : text.trim();
    const scopeText = inIndex >= 0 ? text.slice(inIndex + 2).trim() : 'root';
    return { conditions: splitTargetFilters(filterText).map(parseCondition), scopeText };
}

function parseAlgsetScript(script) {
    return splitStatements(script).map((statement) => {
        if (/^if\s+/i.test(statement)) return parseIfStatement(statement);
        if (/^create\s+/i.test(statement)) return parseCreateStatement(statement);
        if (/^delete\s+/i.test(statement)) return parseDeleteStatement(statement);
        throw scriptError(`Unknown statement: ${statement}`);
    });
}

function addSummary(summary, key, count = 1) {
    summary[key] = (summary[key] || 0) + count;
}

function valueKey(value) {
    return JSON.stringify(value);
}

function setArrayUnique(current, values, mode) {
    const existing = Array.isArray(current) ? current.slice() : [];
    if (mode === 'append') return values.slice();
    if (mode === 'add') return [...existing, ...values.filter((value) => !existing.map(String).includes(String(value)))];
    return existing.filter((value) => !values.map(String).includes(String(value)));
}

function applyFieldCommand(item, command, summary) {
    if (command.field === 'constraints') return applyConstraintCommand(item, command, summary);
    if (command.field === 'pre-abf') {
        const values = parseFieldValue('pre-abf', command.value);
        const changedRul = setCaseField(item, 'rul', command.verb === 'remove' ? setArrayUnique(item.rul, values, 'remove') : setArrayUnique(item.rul, values, command.verb), summary, 'pre-abf');
        const changedRdl = setCaseField(item, 'rdl', command.verb === 'remove' ? setArrayUnique(item.rdl, values, 'remove') : setArrayUnique(item.rdl, values, command.verb), summary, 'pre-abf');
        return changedRul || changedRdl;
    }
    if (command.field === 'post-abf') {
        const values = parseFieldValue('post-abf', command.value);
        const auf = values.map((value) => normalizeMove(value, 'U'));
        const adf = values.map((value) => normalizeMove(value, 'D'));
        const changedAuf = setCaseField(item, 'auf', command.verb === 'remove' ? setArrayUnique(item.auf, auf, 'remove') : setArrayUnique(item.auf, auf, command.verb), summary, 'post-abf');
        const changedAdf = setCaseField(item, 'adf', command.verb === 'remove' ? setArrayUnique(item.adf, adf, 'remove') : setArrayUnique(item.adf, adf, command.verb), summary, 'post-abf');
        return changedAuf || changedAdf;
    }

    const field = command.field;
    const value = parseFieldValue(field, command.value);
    if (Array.isArray(item[field]) || ['parity', 'rul', 'rdl', 'auf', 'adf', 'equator'].includes(field)) {
        return setCaseField(item, field, setArrayUnique(item[field], value, command.verb), summary, field);
    }
    if (command.verb === 'remove') return false;
    return setCaseField(item, field, value, summary, field);
}

function setCaseField(item, field, value, summary, label = field) {
    if (valueKey(item[field]) === valueKey(value)) return false;
    item[field] = clone(value);
    addSummary(summary.fieldsChanged, label);
    return true;
}

function applyConstraintCommand(item, command, summary) {
    if (!isObject(item.constraints)) item.constraints = {};
    const before = valueKey(item.constraints);
    if (command.verb === 'remove' && !command.subfield) {
        if (!command.value) item.constraints = {};
        else {
            const removeValues = parseList(command.value).map(String);
            for (const key of Object.keys(item.constraints)) {
                item.constraints[key] = item.constraints[key].filter((entry) => !removeValues.includes(String(entry)));
                if (!item.constraints[key].length) delete item.constraints[key];
            }
        }
    } else if (command.subfield) {
        if (command.verb === 'remove' && !command.value) {
            delete item.constraints[command.subfield];
        } else {
            const values = parseList(command.value).map(String);
            item.constraints[command.subfield] = setArrayUnique(item.constraints[command.subfield], values, command.verb).map(String);
            if (!item.constraints[command.subfield].length) delete item.constraints[command.subfield];
        }
    } else {
        const objectValue = parseObjectLiteral(command.value) || {};
        if (command.verb === 'append') item.constraints = clone(objectValue);
        else {
            for (const [key, values] of Object.entries(objectValue)) {
                item.constraints[key] = setArrayUnique(item.constraints[key], values.map(String), command.verb).map(String);
                if (!item.constraints[key].length) delete item.constraints[key];
            }
        }
    }
    if (before === valueKey(item.constraints)) return false;
    addSummary(summary.fieldsChanged, 'constraints');
    return true;
}

function applyReplaceCommand(item, command, summary, warnings) {
    if (command.matchMask.length !== 12 || command.replaceMask.length !== 12) throw scriptError(`${command.field} mask must be 12 characters`);
    const current = String(item[command.field] || '').padEnd(12, 'R').slice(0, 12);
    const matches = [...command.matchMask].every((char, index) => char === '*' || current[index] === char);
    if (!matches) {
        warnings.push(`Mask did not match ${item.caseName}`);
        return false;
    }
    const next = [...current].map((char, index) => command.replaceMask[index] === '*' ? char : command.replaceMask[index]).join('');
    return setCaseField(item, command.field, next, summary, command.field);
}

function applyCopyCommand(item, command, context, summary) {
    if (command.verb === 'copy-template') {
        const template = context.template || DEFAULT_CASE;
        let changed = false;
        for (const [field, value] of Object.entries(template)) {
            if (field === 'caseName' || field === 'alg') continue;
            changed = setCaseField(item, field, value, summary, field) || changed;
        }
        return changed;
    }
    return setCaseField(item, command.to, item[command.from], summary, command.to);
}

function renameCase(tree, info, command, summary) {
    const name = info.key.replace(command.from, command.to);
    if (name === info.key) return false;
    const parentInfo = getParent(tree, info.path);
    if (!parentInfo) return false;
    const finalName = getUniqueName(parentInfo.parent, name);
    const entries = Object.entries(parentInfo.parent).map(([key, value]) => key === parentInfo.key ? [finalName, value] : [key, value]);
    for (const key of Object.keys(parentInfo.parent)) delete parentInfo.parent[key];
    for (const [key, value] of entries) parentInfo.parent[key] = value;
    parentInfo.parent[finalName].caseName = finalName;
    addSummary(summary.fieldsChanged, 'case-name');
    if (finalName !== name) summary.warnings.push(`Name collision: ${name} became ${finalName}`);
    return true;
}

function matchingCases(tree, context, target) {
    return collectScopedCases(tree, context, target.scopeText)
        .filter((caseInfo) => target.conditions.every((condition) => conditionMatches(caseInfo, condition)));
}

function executeIf(statement, tree, context, summary) {
    const cases = matchingCases(tree, context, statement);
    summary.matchedCases += cases.length;
    let changedCases = 0;
    for (const caseInfo of cases) {
        let changed = false;
        for (const command of statement.commands) {
            if (command.verb === 'append' || command.verb === 'add' || command.verb === 'remove') changed = applyFieldCommand(caseInfo.item, command, summary) || changed;
            else if (command.verb === 'replace') changed = applyReplaceCommand(caseInfo.item, command, summary, summary.warnings) || changed;
            else if (command.verb === 'copy' || command.verb === 'copy-template') changed = applyCopyCommand(caseInfo.item, command, context, summary) || changed;
            else if (command.verb === 'rename' && command.field === 'case-name') changed = renameCase(tree, caseInfo, command, summary) || changed;
            else if (command.verb === 'rename' && command.field === 'folder-name') summary.warnings.push('Folder rename from if command is not implemented yet');
        }
        if (changed) changedCases += 1;
    }
    summary.changedCases += changedCases;
}

function getCaseSource(tree, context, source, name) {
    if (source.type === 'template') return createCaseFromTemplate(name, context.template);
    if (source.type === 'case') {
        const item = getNode(tree, source.casePath);
        if (!isCase(item)) throw scriptError(`Source case not found: ${source.casePath}`);
        const next = clone(item);
        next.caseName = name;
        return next;
    }
    return createCaseFromTemplate(name, null);
}

function targetFolderForCreate(tree, context, scopeText, summary = null) {
    const scope = normalizeSpace(scopeText || 'here');
    if (summary && scope && !['here', 'root', 'selected'].includes(scope) && scope.startsWith('[')) {
        return createFolderAt({ folder: tree, path: '' }, parsePathValue(scope), summary);
    }
    const scopeNode = getScopeNode(tree, context, scopeText);
    if (isCase(scopeNode.node)) {
        const info = getParent(tree, scopeNode.path);
        return { folder: info?.parent || tree, path: info?.parentPath || '' };
    }
    return { folder: scopeNode.node, path: scopeNode.path };
}

function applyWithText(item, withText, summary) {
    if (!withText) return;
    const normalized = normalizeSpace(withText);
    const commands = EXECUTE_VERBS.some((verb) => normalized.toLowerCase().startsWith(`${verb} `))
        ? splitByCommandJoiners(withText).map(parseExecuteCommand)
        : parseWithAssignments(withText);
    for (const command of commands) {
        if (!command.verb) continue;
        applyFieldCommand(item, command, summary);
    }
}

function parseWithAssignments(text) {
    const fields = [...TARGET_FIELDS]
        .filter((field) => !['case-name', 'folder-name', 'path'].includes(field))
        .sort((a, b) => b.length - a.length);
    const assignments = [];
    let index = 0;
    while (index < text.length) {
        while (/\s/.test(text[index] || '')) index += 1;
        const lower = text.slice(index).toLowerCase();
        const field = fields.find((item) => {
            const lowerItem = item.toLowerCase();
            return lower.startsWith(`${lowerItem}=`) || lower.startsWith(`${lowerItem} `);
        });
        if (!field) break;
        index += field.length;
        let subfield = '';
        while (/\s/.test(text[index] || '')) index += 1;
        if (text[index] !== '=') {
            const start = index;
            while (text[index] && text[index] !== '=' && !/\s/.test(text[index])) index += 1;
            subfield = text.slice(start, index);
            while (/\s/.test(text[index] || '')) index += 1;
        }
        if (text[index] !== '=') throw scriptError(`Expected = after ${field}`);
        index += 1;
        const valueStart = index;
        let nextFieldIndex = text.length;
        scanSegments(text.slice(index), (_char, offset) => {
            if (!/\s/.test(text[index + offset])) return false;
            const after = text.slice(index + offset).trimStart().toLowerCase();
            if (fields.some((item) => {
                const lowerItem = item.toLowerCase();
                return after.startsWith(`${lowerItem}=`) || after.startsWith(`${lowerItem} `);
            })) {
                nextFieldIndex = index + offset;
                return true;
            }
            return false;
        });
        assignments.push({ verb: 'append', field: fieldName(field), subfield, value: text.slice(valueStart, nextFieldIndex).trim() });
        index = nextFieldIndex;
    }
    return assignments;
}

function createCase(tree, context, statement, summary, name = statement.name) {
    const target = targetFolderForCreate(tree, context, statement.scopeText, summary);
    const finalName = getUniqueName(target.folder, name);
    target.folder[finalName] = getCaseSource(tree, context, statement.source, finalName);
    applyWithText(target.folder[finalName], statement.withText, summary);
    summary.createdCases += 1;
    if (finalName !== name) summary.warnings.push(`Case already existed: ${name} became ${finalName}`);
    return childPath(target.path, finalName);
}

function createFolderAt(target, rawPath, summary) {
    const parts = Array.isArray(rawPath) ? rawPath : parsePathValue(rawPath);
    let current = target.folder;
    let currentPath = target.path;
    for (const part of parts) {
        const finalName = isFolder(current[part]) ? part : getUniqueName(current, part);
        if (!isFolder(current[finalName])) {
            current[finalName] = {};
            summary.createdFolders += 1;
            if (finalName !== part) summary.warnings.push(`Folder already existed: ${part} became ${finalName}`);
        }
        current = current[finalName];
        currentPath = childPath(currentPath, finalName);
    }
    return { folder: current, path: currentPath };
}

function executeCreate(statement, tree, context, summary) {
    if (statement.type === 'create-case') {
        createCase(tree, context, statement, summary);
        return;
    }
    if (statement.type === 'create-cases') {
        for (const name of statement.names) createCase(tree, context, { ...statement, name }, summary, name);
        return;
    }
    if (statement.type === 'create-folder') {
        createFolderAt(targetFolderForCreate(tree, context, statement.scopeText, summary), statement.pathValue, summary);
        return;
    }
    if (statement.type === 'create-folders') {
        const target = targetFolderForCreate(tree, context, statement.scopeText, summary);
        for (const name of statement.names) createFolderAt(target, [name], summary);
        return;
    }
    if (statement.type === 'create-tree') {
        const target = targetFolderForCreate(tree, context, statement.scopeText, summary);
        for (const left of statement.groups) {
            for (const right of statement.groups) {
                const folder = createFolderAt(target, [`${left.key}/${right.key}`], summary);
                for (const leftValue of left.values) {
                    for (const rightValue of right.values) {
                        createCase(tree, { ...context, scopePath: folder.path }, { type: 'create-case', name: `${leftValue}/${rightValue}`, source: statement.source, scopeText: 'here' }, summary, `${leftValue}/${rightValue}`);
                    }
                }
            }
        }
    }
}

function deleteCaseAt(tree, path, summary) {
    const info = getParent(tree, path);
    if (!info || !isCase(info.parent[info.key])) return false;
    delete info.parent[info.key];
    summary.deletedCases += 1;
    return true;
}

function executeDelete(statement, tree, context, summary) {
    if (statement.type === 'delete-case') {
        const target = targetFolderForCreate(tree, context, statement.scopeText);
        const item = target.folder[statement.name];
        if (isCase(item)) deleteCaseAt(tree, childPath(target.path, statement.name), summary);
        return;
    }
    if (statement.type === 'delete-folder') {
        const target = targetFolderForCreate(tree, context, statement.scopeText);
        if (isFolder(target.folder[statement.name])) {
            delete target.folder[statement.name];
            summary.deletedFolders += 1;
        }
        return;
    }
    if (statement.type === 'delete-cases-if') {
        for (const caseInfo of matchingCases(tree, context, statement.target)) deleteCaseAt(tree, caseInfo.path, summary);
        return;
    }
    if (statement.type === 'delete-folders-if') {
        const folders = collectFolders(getScopeNode(tree, context, statement.target.scopeText).node, splitPath(getScopeNode(tree, context, statement.target.scopeText).path))
            .filter((folder) => statement.target.conditions.every((condition) => conditionMatches({
                item: {},
                key: folder.key,
                path: folder.path,
                parts: splitPath(folder.path),
                folderParts: splitPath(folder.path)
            }, condition)))
            .sort((a, b) => splitPath(b.path).length - splitPath(a.path).length);
        for (const folder of folders) {
            const info = getParent(tree, folder.path);
            if (info && isFolder(info.parent[info.key])) {
                delete info.parent[info.key];
                summary.deletedFolders += 1;
            }
        }
        return;
    }
    if (statement.type === 'delete-empty-folders') {
        deleteEmptyFolders(getScopeNode(tree, context, statement.scopeText).node, summary);
        return;
    }
    if (statement.type === 'delete-constraints-if') {
        for (const caseInfo of matchingCases(tree, context, statement.target)) {
            if (caseInfo.item.constraints?.[statement.position]) {
                delete caseInfo.item.constraints[statement.position];
                summary.changedCases += 1;
                addSummary(summary.fieldsChanged, 'constraints');
            }
        }
        return;
    }
    if (statement.type === 'delete-alg-if') {
        for (const caseInfo of matchingCases(tree, context, statement.target)) {
            if (caseInfo.item.alg) {
                caseInfo.item.alg = '';
                summary.changedCases += 1;
                addSummary(summary.fieldsChanged, 'alg');
            }
        }
    }
}

function deleteEmptyFolders(node, summary) {
    for (const [key, value] of Object.entries(node)) {
        if (!isFolder(value)) continue;
        deleteEmptyFolders(value, summary);
        if (!Object.values(value).some((child) => isCase(child) || (isFolder(child) && Object.keys(child).length))) {
            delete node[key];
            summary.deletedFolders += 1;
        }
    }
}

function createSummary() {
    return {
        matchedCases: 0,
        changedCases: 0,
        createdCases: 0,
        createdFolders: 0,
        deletedCases: 0,
        deletedFolders: 0,
        fieldsChanged: {},
        warnings: [],
        errors: []
    };
}

function executeAlgsetScript(script, context = {}) {
    const tree = clone(context.tree || {});
    const summary = createSummary();
    try {
        const statements = parseAlgsetScript(script);
        for (const statement of statements) {
            if (statement.type === 'if') executeIf(statement, tree, context, summary);
            else if (statement.type.startsWith('create-')) executeCreate(statement, tree, context, summary);
            else if (statement.type.startsWith('delete-')) executeDelete(statement, tree, context, summary);
        }
        return { ok: true, tree, summary, statements };
    } catch (error) {
        summary.errors.push(error.message);
        return { ok: false, tree: context.tree, summary, statements: [] };
    }
}

function formatScriptSummary(summary) {
    const fields = Object.entries(summary.fieldsChanged)
        .map(([field, count]) => `${field} ${count}`)
        .join(', ') || 'none';
    const lines = [
        `Matched cases: ${summary.matchedCases}`,
        `Changed cases: ${summary.changedCases}`,
        `Created cases: ${summary.createdCases}`,
        `Created folders: ${summary.createdFolders}`,
        `Deleted cases: ${summary.deletedCases}`,
        `Deleted folders: ${summary.deletedFolders}`,
        `Fields changed: ${fields}`
    ];
    if (summary.warnings.length) lines.push(`Warnings: ${summary.warnings.length}`, ...summary.warnings.map((warning) => `- ${warning}`));
    if (summary.errors.length) lines.push(`Errors: ${summary.errors.length}`, ...summary.errors.map((error) => `- ${error}`));
    return lines.join('\n');
}

function pathSuggestion(path) {
    return `[${splitPath(path).map((part) => JSON.stringify(part)).join(', ')}]`;
}

function getAlgsetScriptSuggestions({ tree = {}, text = '', cursor = 0 } = {}) {
    const before = text.slice(0, cursor);
    const prefix = (before.match(/[a-z0-9_./"-]*$/i)?.[0] || '').replace(/^["']/, '');
    const folders = collectFolders(tree).map((folder) => pathSuggestion(folder.path));
    const base = [...KEYWORDS, ...OPERATORS, ...TARGET_FIELDS, ...folders];
    return [...new Set(base)]
        .filter((item) => !prefix || item.toLowerCase().startsWith(prefix.toLowerCase()))
        .slice(0, 12);
}

function completeAlgsetScript({ tree = {}, text = '', cursor = 0 } = {}) {
    const suggestions = getAlgsetScriptSuggestions({ tree, text, cursor });
    const suggestion = suggestions[0];
    if (!suggestion) return { text, cursor, suggestion: '' };
    const before = text.slice(0, cursor);
    const match = before.match(/[a-z0-9_./"-]*$/i);
    const start = match ? cursor - match[0].length : cursor;
    const nextText = `${text.slice(0, start)}${suggestion}${text.slice(cursor)}`;
    return { text: nextText, cursor: start + suggestion.length, suggestion };
}

export {
    completeAlgsetScript,
    executeAlgsetScript,
    formatScriptSummary,
    getAlgsetScriptSuggestions,
    parseAlgsetScript
};

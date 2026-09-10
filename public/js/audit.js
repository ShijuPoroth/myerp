// Audit Log Functions
let allAuditLogs = [];

async function loadAuditLogs() {
    try {
        const moduleFilter = document.getElementById('audit-module-filter')?.value || '';
        const actionFilter = document.getElementById('audit-action-filter')?.value || '';
        
        let url = `${API_BASE}/audit-logs`;
        const params = [];
        if (moduleFilter) params.push(`module=${moduleFilter}`);
        if (actionFilter) params.push(`action=${actionFilter}`);
        if (params.length > 0) url += '?' + params.join('&');
        
        const response = await fetch(url);
        allAuditLogs = await response.json();
        renderAuditLogs();
    } catch (error) {
        console.error('Error loading audit logs:', error);
    }
}

function parseAuditDetails(details) {
    if (!details) return { _raw: '', _fields: {}, _changes: [] };
    const fields = {};
    let changes = [];
    let raw = details;

    // Split on | but preserve the Changes: segment intact
    const changesMatch = details.match(/\|\s*Changes:\s*(.+)$/);
    let changesStr = '';
    let baseStr = details;
    if (changesMatch) {
        changesStr = changesMatch[1];
        baseStr = details.slice(0, changesMatch.index);
        // Parse individual changes: "Field: old → new" separated by commas
        // But field values themselves may contain commas, so split on ", " only before a known pattern "Word...: "
        const parts = changesStr.split(/,\s*(?=[^,]+?:\s*.+?→)/);
        parts.forEach(p => {
            const arrowIdx = p.indexOf('→');
            if (arrowIdx > -1) {
                const colonIdx = p.indexOf(':');
                if (colonIdx > -1 && colonIdx < arrowIdx) {
                    const field  = p.slice(0, colonIdx).trim();
                    const before = p.slice(colonIdx + 1, arrowIdx).trim();
                    const after  = p.slice(arrowIdx + 1).trim();
                    changes.push({ field, before, after });
                }
            } else {
                // No arrow — just a plain change note
                const colonIdx = p.indexOf(':');
                if (colonIdx > -1) {
                    const field = p.slice(0, colonIdx).trim();
                    const val   = p.slice(colonIdx + 1).trim();
                    if (field) changes.push({ field, before: null, after: val });
                }
            }
        });
    }

    // Parse base fields (pipe-separated key: value)
    baseStr.split('|').forEach(part => {
        const idx = part.indexOf(':');
        if (idx > -1) {
            const k = part.slice(0, idx).trim();
            const v = part.slice(idx + 1).trim();
            if (k) fields[k] = v;
        }
    });

    return { _raw: raw, _fields: fields, _changes: changes };
}

function buildAuditSummary(log) {
    const parsed = parseAuditDetails(log.details);
    const d = parsed._fields;
    const changes = parsed._changes;

    // Handle auth actions
    if (log.module === 'auth' || log.action === 'LOGIN' || log.action === 'LOGOUT' || log.action === 'LOGIN_FAILED') {
        const loginId = d['Login ID'] || '';
        const reason = d['Reason'] || '';
        const ip = d['IP'] || '';
        let summary = log.action === 'LOGIN' ? 'Logged in' : log.action === 'LOGOUT' ? 'Logged out' : 'Failed login';
        if (loginId) summary += ' — ' + loginId;
        if (reason) summary += ' (' + reason + ')';
        if (ip) summary += ' | IP: ' + ip;
        return summary;
    }

    const actionVerb = log.action === 'CREATE' ? 'Created' : log.action === 'UPDATE' ? 'Updated' : log.action === 'DELETE' ? 'Deleted' : log.action;
    const entity = log.entity || log.module || '';

    const name = d['Equipment'] || d['Name'] || d['Uniform Item'] || d['Kitchen Item'] || d['Order Number'] || d['Transfer Serial'] || '';
    const extra = [];
    if (d['From']) extra.push('from ' + d['From']);
    if (d['To']) extra.push('to ' + d['To']);
    if (d['Status']) extra.push('status: ' + d['Status']);
    if (d['Type']) extra.push('type: ' + d['Type']);
    if (d['Assigned To']) extra.push('assigned to ' + d['Assigned To']);

    // For updates, summarise changed fields
    if (log.action === 'UPDATE' && changes.length > 0) {
        const changedFields = changes.map(c => c.field).join(', ');
        let summary = actionVerb + ' ' + entity;
        if (name) summary += ': ' + name;
        summary += ' — changed: ' + changedFields;
        return summary;
    }

    let summary = actionVerb + ' ' + entity;
    if (name) summary += ': ' + name;
    if (extra.length) summary += ' (' + extra.join(', ') + ')';
    return summary;
}

function filterAuditLogs() {
    const term = (document.getElementById('audit-search')?.value || '').toLowerCase();
    if (!term) { renderAuditLogs(); return; }
    const filtered = allAuditLogs.filter(log => {
        const summary = (buildAuditSummary(log) || '').toLowerCase();
        return (log.user || '').toLowerCase().includes(term) ||
               (log.entity || '').toLowerCase().includes(term) ||
               (log.module || '').toLowerCase().includes(term) ||
               (log.action || '').toLowerCase().includes(term) ||
               summary.includes(term);
    });
    renderAuditLogs(filtered);
}

function parseAuditDate(dateString) {
    if (!dateString) return null;
    // SQLite CURRENT_TIMESTAMP stores UTC; append Z so JS parses as UTC and converts to local
    const s = String(dateString).replace(' ', 'T');
    if (!s.endsWith('Z')) return new Date(s + 'Z');
    return new Date(s);
}

function renderAuditLogs(logs) {
    const tbody = document.getElementById('audit-logs-table-body');
    if (!tbody) return;

    const data = logs || allAuditLogs;
    if (!Array.isArray(data)) {
        console.error('allAuditLogs is not an array:', data);
        tbody.innerHTML = '<tr><td colspan="6" class="px-6 py-4 text-center text-gray-500">No data available</td></tr>';
        return;
    }

    tbody.innerHTML = data.map(log => {
        const summary = buildAuditSummary(log);
        const dt = parseAuditDate(log.created_at);
        const dateStr = formatDate(dt);
        const timeStr = dt ? dt.toLocaleTimeString('en-GB', { hour:'2-digit', minute:'2-digit' }) : '-';
        return `
        <tr class="hover:bg-gray-50">
            <td class="px-3 py-1.5 whitespace-nowrap text-xs">
                <div class="font-medium">${dateStr}</div>
                <div class="text-gray-400" style="font-size:10px">${timeStr}</div>
            </td>
            <td class="px-3 py-1.5 whitespace-nowrap text-xs">
                <div class="font-medium">${log.user || 'System'}</div>
                <div class="text-gray-400" style="font-size:10px">${log.manager_module || '-'}</div>
            </td>
            <td class="px-3 py-1.5 whitespace-nowrap">
                <span class="px-2 py-0.5 text-xs font-semibold rounded-full ${getActionBadgeClass(log.action)}">${log.action}</span>
            </td>
            <td class="px-3 py-1.5 whitespace-nowrap text-xs">
                <div class="font-medium">${log.entity || '-'}</div>
                <div class="text-gray-400" style="font-size:10px">${log.module || ''}</div>
            </td>
            <td class="px-3 py-1.5 text-xs text-gray-700 max-w-sm truncate" title="${summary.replace(/"/g, '&quot;')}">${summary}</td>
            <td class="px-3 py-1.5 whitespace-nowrap">
                <button onclick="viewAuditDetails(${log.id})" class="text-blue-600 hover:text-blue-800 mr-2" title="View Full Details">
                    <i class="fas fa-eye text-xs"></i>
                </button>
                <button onclick="deleteAuditLog(${log.id})" class="text-red-500 hover:text-red-700" title="Delete">
                    <i class="fas fa-trash text-xs"></i>
                </button>
            </td>
        </tr>`;
    }).join('');
}

function getActionBadgeClass(action) {
    switch (action) {
        case 'CREATE':
            return 'bg-green-100 text-green-800';
        case 'UPDATE':
            return 'bg-blue-100 text-blue-800';
        case 'DELETE':
            return 'bg-red-100 text-red-800';
        case 'LOGIN':
            return 'bg-emerald-100 text-emerald-800';
        case 'LOGOUT':
            return 'bg-gray-100 text-gray-800';
        case 'LOGIN_FAILED':
            return 'bg-red-100 text-red-800';
        default:
            return 'bg-gray-100 text-gray-800';
    }
}

async function clearAuditLogs() {
    if (confirm('Are you sure you want to clear all audit logs? This action cannot be undone.')) {
        try {
            const response = await fetch(`${API_BASE}/audit-logs`, { method: 'DELETE' });
            if (response.ok) {
                loadAuditLogs();
            }
        } catch (error) {
            console.error('Error clearing audit logs:', error);
        }
    }
}

async function deleteAuditLog(id) {
    if (confirm('Are you sure you want to delete this audit log entry?')) {
        try {
            const response = await fetch(`${API_BASE}/audit-logs/${id}`, { method: 'DELETE' });
            if (response.ok) {
                loadAuditLogs();
            }
        } catch (error) {
            console.error('Error deleting audit log:', error);
        }
    }
}

function viewAuditDetails(id) {
    const log = allAuditLogs.find(l => l.id === id);
    if (!log) return;

    const parsed = parseAuditDetails(log.details);
    const fields = parsed._fields;
    const changes = parsed._changes;

    // Base fields section
    const fieldEntries = Object.entries(fields);
    const fieldsHtml = fieldEntries.length
        ? fieldEntries.map(([k, v]) =>
            `<div class="flex gap-2 py-1.5 border-b last:border-0">
                <span class="text-gray-500 text-xs w-36 flex-shrink-0 pt-0.5">${k}</span>
                <span class="text-sm font-medium text-gray-900">${v || '-'}</span>
            </div>`).join('')
        : '';

    // Changes section — before/after table
    let changesHtml = '';
    if (changes.length > 0) {
        const rows = changes.map(c => {
            if (c.before !== null) {
                return `<tr class="border-b last:border-0">
                    <td class="py-1.5 pr-3 text-xs text-gray-500 w-32 align-top">${c.field}</td>
                    <td class="py-1.5 pr-3 text-sm text-red-600 line-through align-top">${c.before || '-'}</td>
                    <td class="py-1.5 text-sm text-green-700 font-medium align-top">${c.after || '-'}</td>
                </tr>`;
            } else {
                return `<tr class="border-b last:border-0">
                    <td class="py-1.5 pr-3 text-xs text-gray-500 w-32 align-top">${c.field}</td>
                    <td colspan="2" class="py-1.5 text-sm font-medium text-gray-900">${c.after || '-'}</td>
                </tr>`;
            }
        }).join('');
        changesHtml = `
            <div class="bg-amber-50 border border-amber-200 rounded-lg p-4">
                <div class="text-xs font-semibold text-amber-700 uppercase tracking-wide mb-3">
                    <i class="fas fa-exchange-alt mr-1"></i> What Changed (${changes.length} field${changes.length > 1 ? 's' : ''})
                </div>
                <table class="w-full text-sm">
                    <thead><tr>
                        <th class="text-left text-xs text-gray-400 pb-1 pr-3">Field</th>
                        <th class="text-left text-xs text-gray-400 pb-1 pr-3">Before</th>
                        <th class="text-left text-xs text-gray-400 pb-1">After</th>
                    </tr></thead>
                    <tbody>${rows}</tbody>
                </table>
            </div>`;
    } else if (log.action === 'UPDATE' && !changesHtml) {
        changesHtml = `<div class="text-sm text-gray-400 italic">No field changes recorded.</div>`;
    }

    // Fallback: raw text if nothing parsed
    const detailsHtml = (fieldEntries.length === 0 && changes.length === 0)
        ? `<p class="text-sm text-gray-700 whitespace-pre-wrap">${log.details || '-'}</p>`
        : '';

    const actionColors = { CREATE: 'bg-green-100 text-green-800', UPDATE: 'bg-blue-100 text-blue-800', DELETE: 'bg-red-100 text-red-800', LOGIN: 'bg-emerald-100 text-emerald-800', LOGOUT: 'bg-gray-100 text-gray-800', LOGIN_FAILED: 'bg-red-100 text-red-800' };
    const ac = actionColors[log.action] || 'bg-gray-100 text-gray-800';

    const container = document.getElementById('audit-details-body');
    if (container) {
        container.innerHTML = `
            <!-- Who & When -->
            <div class="bg-gray-50 rounded-lg p-4">
                <div class="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Who &amp; When</div>
                <div class="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                    <div><span class="text-gray-500 text-xs">User:</span> <span class="font-medium block">${log.user || 'System'}</span></div>
                    <div><span class="text-gray-500 text-xs">Manager Module:</span> <span class="font-medium block">${log.manager_module || '-'}</span></div>
                    <div><span class="text-gray-500 text-xs">Timestamp:</span> <span class="font-medium block">${formatAuditDate(log.created_at)}</span></div>
                    <div><span class="text-gray-500 text-xs">Entity ID:</span> <span class="font-medium block">${log.entity_id || '-'}</span></div>
                </div>
            </div>
            <!-- What -->
            <div class="bg-blue-50 rounded-lg p-4">
                <div class="text-xs font-semibold text-blue-600 uppercase tracking-wide mb-3">What Happened</div>
                <div class="flex items-center gap-3 text-sm">
                    <span class="px-2.5 py-1 text-xs font-bold rounded-full ${ac}">${log.action}</span>
                    <span class="font-semibold">${log.entity || '-'}</span>
                    <span class="text-gray-400">in</span>
                    <span class="font-medium text-gray-700">${log.module || '-'}</span>
                </div>
            </div>
            <!-- Base fields -->
            ${fieldsHtml ? `<div class="bg-white border rounded-lg p-4">
                <div class="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Details</div>
                ${fieldsHtml}
            </div>` : ''}
            <!-- Changes before/after -->
            ${changesHtml}
            <!-- Fallback raw -->
            ${detailsHtml}
        `;
    }

    const modal = document.getElementById('audit-details-modal');
    modal.classList.add('active');
}

function closeAuditDetailsModal() {
    const modal = document.getElementById('audit-details-modal');
    modal.classList.remove('active');
}

async function logAudit(action, module, entity, entityId = null, details = '') {
    try {
        await fetch(`${API_BASE}/audit-logs`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action,
                module,
                entity,
                entity_id: entityId,
                details
            })
        });
    } catch (error) {
        console.error('Error logging audit:', error);
    }
}

function formatAuditDate(dateString) {
    const date = parseAuditDate(dateString);
    if (!date) return '-';
    const dateStr = formatDate(date);
    const timeStr = date.toLocaleTimeString('en-GB', { hour:'2-digit', minute:'2-digit' });
    return `${dateStr} ${timeStr}`;
}

let loggedInManager = null;

async function checkSession() {
    try {
        const response = await fetch(`${API_BASE}/check-session`);
        if (!response.ok) {
            throw new Error('Not authenticated');
        }
        loggedInManager = await response.json();
        return loggedInManager;
    } catch (error) {
        window.location.href = '/login';
        return null;
    }
}

async function logout() {
    try {
        await fetch(`${API_BASE}/logout`, { method: 'POST', credentials: 'same-origin' });
    } catch (error) {
        console.error('Logout error:', error);
    }
    localStorage.removeItem('mwh_current_module_manager');
    window.location.href = '/login';
}

// Expose for inline onclick and attach a direct listener as a fallback
window.logout = logout;

document.addEventListener('DOMContentLoaded', () => {
    const logoutBtn = document.getElementById('logout-button');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', logout);
    }
});

function updateAuthUI() {
    const logoutBtn = document.getElementById('logout-button');
    if (logoutBtn) logoutBtn.classList.remove('hidden');
    const userInfo = document.getElementById('logged-in-user-info');
    const userName = document.getElementById('logged-in-user-name');
    const userModule = document.getElementById('logged-in-user-module');
    if (loggedInManager && userInfo) {
        userInfo.classList.remove('hidden');
        if (userName) userName.textContent = loggedInManager.name;
        if (userModule) userModule.textContent = loggedInManager.module_name ? `(${loggedInManager.module_name})` : '';
    }
    if (loggedInManager && loggedInManager.module_name !== 'admin') {
        const mod = loggedInManager.module_name;
        // Show module-specific dashboard sidebar button
        const dashLi = document.getElementById(`sidebar-${mod}-dashboard-li`);
        if (dashLi) dashLi.style.display = '';
        // Hide the admin dashboard button
        document.querySelectorAll('.sidebar-item').forEach(btn => {
            const section = btn.getAttribute('data-section');
            if (section === 'dashboard') {
                btn.parentElement.style.display = 'none';
            } else if (section !== mod && section !== `${mod}-dashboard`) {
                btn.parentElement.style.display = 'none';
            }
        });
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    const manager = await checkSession();
    if (!manager) return;
    loggedInManager = manager;
    currentModuleManager = manager;
    localStorage.setItem('mwh_current_module_manager', JSON.stringify(manager));
    updateAuthUI();
    if (typeof updateCurrentModuleManagerUI === 'function') {
        updateCurrentModuleManagerUI();
    }
    if (typeof loadCurrentModulePermissions === 'function') {
        await loadCurrentModulePermissions();
    }
    // Re-fetch tab permissions to ensure proper objects (not just can_view)
    if (typeof moduleTabPermissions !== 'undefined' && currentModuleManager) {
        try {
            const tabRes = await fetch(`${API_BASE}/module-tab-permissions/${currentModuleManager.id}`);
            const tabRows = await tabRes.json();
            tabRows.forEach(p => {
                const key = (p.module_name || '') + '::' + (p.tab_key || '') + '::' + (p.subtab_key || '');
                moduleTabPermissions[key] = {
                    can_view: p.can_view,
                    can_add: p.can_add,
                    can_edit: p.can_edit,
                    can_delete: p.can_delete,
                    can_export: p.can_export !== undefined ? p.can_export : 1
                };
            });
            console.log('[AUTH-FIX] moduleTabPermissions loaded with', Object.keys(moduleTabPermissions).length, 'entries');
        } catch (e) { console.error('Error fixing tab permissions:', e); }
    }

    // Override hasTablePermission to correctly check tab/subtab permissions
    // This runs after all scripts are loaded, so admin-settings.js functions exist
    if (typeof hasTablePermission !== 'undefined' && !window._authFixApplied) {
        window._authFixApplied = true;
        hasTablePermission = function(tableName, action) {
            if (typeof loggedInManager !== 'undefined' && loggedInManager && loggedInManager.module_name === 'admin') return true;
            if (!currentModuleManager) return false;
            if (currentModuleTabContext && currentModuleTabContext.module) {
                const mod = currentModuleTabContext.module;
                const tab = currentModuleTabContext.tab;
                const subtab = currentModuleTabContext.subtab || '';
                const act = 'can_' + action;
                const key = mod + '::' + tab + '::' + subtab;
                const perm = moduleTabPermissions[key];
                if (perm && typeof perm === 'object') {
                    // can_export may be absent on rows loaded before the column existed — default allowed
                    if (act === 'can_export' && perm[act] === undefined) return true;
                    console.log('[AUTH-FIX] hasTablePermission', tableName, action, '->', !!perm[act], 'key:', key, 'perm:', JSON.stringify(perm));
                    return !!perm[act];
                }
                // Check parent tab (subtab is empty)
                const parentKey = mod + '::' + tab + '::';
                const parentPerm = moduleTabPermissions[parentKey];
                if (parentPerm && typeof parentPerm === 'object' && parentPerm[act]) {
                    console.log('[AUTH-FIX] hasTablePermission', tableName, action, '-> true (parent)', 'key:', parentKey);
                    return true;
                }
                // Check all subtabs of this tab for the action
                if (typeof MODULE_TABS !== 'undefined') {
                    const moduleTabs = MODULE_TABS[mod] || [];
                    const tabObj = moduleTabs.find(t => t.key === tab);
                    if (tabObj && tabObj.subtabs) {
                        for (const sub of tabObj.subtabs) {
                            const subKey = mod + '::' + tab + '::' + sub.key;
                            const subPerm = moduleTabPermissions[subKey];
                            if (subPerm && typeof subPerm === 'object' && subPerm[act]) {
                                console.log('[AUTH-FIX] hasTablePermission', tableName, action, '-> true (subtab)', 'key:', subKey);
                                return true;
                            }
                        }
                    }
                }
                console.log('[AUTH-FIX] hasTablePermission', tableName, action, '-> false', 'key:', key);
                return false;
            }
            // Fallback to legacy table permissions
            const p = modulePermissions ? modulePermissions[tableName] : null;
            if (!p) return false;
            if (action === 'add') return p.can_add;
            if (action === 'delete') return p.can_delete;
            return p.can_edit;
        };
        console.log('[AUTH-FIX] hasTablePermission overridden');
    }

    document.dispatchEvent(new CustomEvent('sessionReady', { detail: manager }));

    // Re-render employee list after override + permissions are loaded
    // The employee list was likely rendered before this async handler completed
    if (typeof loadEmployees === 'function') {
        console.log('[AUTH-FIX] Re-rendering employee list after permission fix');
        loadEmployees();
    }

    // Reveal after all sessionReady handlers + showSection have completed
    setTimeout(() => {
        const appContainer = document.querySelector('.app-container');
        if (appContainer) appContainer.classList.add('session-ready');
    }, 300);
});

// Utility functions

// ==================== SHARED LEAVE ACCRUAL LOGIC ====================
// Single source of truth for leave earning / carry-forward calculations,
// used by both the Leave Entry History (payment-management-leave-entry.js)
// and the Employee Leave History popup (employees.js). Mirrors the backend
// implementation in routes/hr.js (/employee-leave-balance).

function leaveDaysBetween(d1, d2) {
    return Math.floor((d2 - d1) / (1000 * 60 * 60 * 24));
}

// Cycle length in days: "X days after Y months" -> cycle = Y months/weeks/years
function leaveComputeCycleDays(hireDate, months, period) {
    const start = new Date(hireDate + 'T00:00:00');
    const cycleEnd = new Date(start);
    if (period === 'weeks') cycleEnd.setDate(cycleEnd.getDate() + (months * 7));
    else if (period === 'years') cycleEnd.setFullYear(cycleEnd.getFullYear() + months);
    else cycleEnd.setMonth(cycleEnd.getMonth() + months);
    return leaveDaysBetween(start, cycleEnd);
}

// Proportionate earning over an elapsed (paid) window
function leaveEarnedInWindow(windowStart, windowEnd, entitled, cycleDays, unpaidDays) {
    if (cycleDays <= 0 || entitled <= 0) return 0;
    const start = new Date(windowStart + 'T00:00:00');
    const end = new Date(windowEnd + 'T00:00:00');
    const windowDays = Math.max(0, leaveDaysBetween(start, end) - (unpaidDays || 0));
    return Math.floor((windowDays / cycleDays) * entitled);
}

// Returns the ISO date string of the start of the entitlement cycle (aligned to hireDate)
// that contains `date`. Used for "expires, does not carry forward" leave types.
function leaveGetCycleStart(hireDate, cycleDays, date) {
    if (!hireDate || cycleDays <= 0) return hireDate;
    const hire = new Date(hireDate + 'T00:00:00');
    const d = new Date(date + 'T00:00:00');
    const elapsedDays = leaveDaysBetween(hire, d);
    const cycleIndex = Math.max(0, Math.floor(elapsedDays / cycleDays));
    const cycleStart = new Date(hire);
    cycleStart.setDate(cycleStart.getDate() + cycleIndex * cycleDays);
    return cycleStart.getFullYear() + '-' + String(cycleStart.getMonth() + 1).padStart(2, '0') + '-' + String(cycleStart.getDate()).padStart(2, '0');
}

function leaveMapTypeToStatus(leaveType) {
    const lt = (leaveType || '').toLowerCase();
    if (lt.includes('medical')) return 'medical-leave';
    if (lt.includes('paid')) return 'paid-leave';
    if (lt.includes('compassionate')) return 'compassionate-leave';
    if (lt.includes('unpaid')) return 'unpaid-leave';
    if (lt.includes('day off') || lt.includes('day-off') || lt.includes('dayoff')) return 'day-off';
    return lt + '-leave';
}

// Groups a sorted (ascending by date) list of {date, status, notes?} records
// into consecutive-date ranges: [{status, from, to, days, notes}]
function leaveGroupConsecutivePeriods(sortedRecords) {
    const periods = [];
    let current = null;
    sortedRecords.forEach(r => {
        if (current && current.status === r.status) {
            const d = new Date(current.to + 'T00:00:00');
            d.setDate(d.getDate() + 1);
            const expectedNext = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
            if (r.date === expectedNext) {
                current.to = r.date;
                current.days++;
                if (r.notes && current.notes !== undefined && !current.notes.includes(r.notes)) current.notes += '; ' + r.notes;
                return;
            }
        }
        if (current) periods.push(current);
        current = { status: r.status, from: r.date, to: r.date, days: 1, notes: r.notes || '' };
    });
    if (current) periods.push(current);
    return periods;
}

// Runs the chained accrual calculation for a single leave type's periods
// (must be sorted ascending by `from`). Returns a Map keyed by `${from}|${to}`
// with { earned, prevCarryForward, accumulated, carryForward, windowStart },
// plus attaches `live` info (as-of-date earning) on the returned object.
//
// unpaidRecords: full list of {date, status} used to exclude unpaid-leave days
//                from the earning window (status === 'unpaid-leave').
function leaveComputeChain(periods, { hireDate, entitled, months, period, unpaidRecords, asOfDate, expireAtCycleEnd }) {
    const result = { periodCalc: new Map(), live: null };
    const hasCalc = hireDate && entitled > 0 && months > 0;
    const cycleDays = hasCalc ? leaveComputeCycleDays(hireDate, months, period) : 0;

    let windowStart = hireDate;
    let runningCarryForward = 0;

    periods.forEach(p => {
        const key = p.from + '|' + p.to;
        if (!hasCalc) {
            result.periodCalc.set(key, { earned: '-', prevCarryForward: '-', accumulated: '-', carryForward: '-', windowStart: null });
            return;
        }
        // Use-it-or-lose-it types: unused balance expires at each entitlement cycle
        // boundary instead of carrying forward indefinitely.
        if (expireAtCycleEnd) {
            const cycleStart = leaveGetCycleStart(hireDate, cycleDays, p.from);
            if (cycleStart > windowStart) {
                windowStart = cycleStart;
                runningCarryForward = 0;
            }
        }
        const unpaidInWindow = (unpaidRecords || []).filter(r =>
            r.status === 'unpaid-leave' && r.date > windowStart && r.date < p.from
        ).length;
        const earned = leaveEarnedInWindow(windowStart, p.from, entitled, cycleDays, unpaidInWindow);
        const prevCarryForward = runningCarryForward;
        const accumulated = earned + prevCarryForward;
        const carryForward = accumulated - p.days;
        result.periodCalc.set(key, { earned, prevCarryForward, accumulated, carryForward, windowStart });
        runningCarryForward = carryForward;
        windowStart = p.to;
    });

    if (asOfDate && hasCalc) {
        if (expireAtCycleEnd) {
            // Use-it-or-lose-it: full entitlement granted at cycle start
            const cycleStart = leaveGetCycleStart(hireDate, cycleDays, asOfDate);
            const takenInCurrentCycle = periods
                .filter(p => p.from >= cycleStart)
                .reduce((sum, p) => sum + p.days, 0);
            result.live = {
                windowStart: cycleStart,
                liveEarned: entitled,
                prevCarryForward: 0,
                liveBalance: entitled - takenInCurrentCycle
            };
        } else {
            const unpaidToDate = (unpaidRecords || []).filter(r =>
                r.status === 'unpaid-leave' && r.date > windowStart && r.date <= asOfDate
            ).length;
            const liveEarned = leaveEarnedInWindow(windowStart, asOfDate, entitled, cycleDays, unpaidToDate);
            result.live = {
                windowStart,
                liveEarned,
                prevCarryForward: runningCarryForward,
                liveBalance: liveEarned + runningCarryForward
            };
        }
    }

    return result;
}

function formatDate(dateInput) {
    if (!dateInput) return '-';
    const d = new Date(dateInput);
    if (isNaN(d.getTime())) return '-';
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    return `${dd}/${mm}/${yyyy}`;
}

function formatDateShort(dateInput) {
    if (!dateInput) return '-';
    const d = new Date(dateInput);
    if (isNaN(d.getTime())) return '-';
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    return `${dd}/${mm}`;
}

function syncDateDisplay(inputId, displayId) {
    const input = document.getElementById(inputId);
    const display = document.getElementById(displayId);
    if (!input || !display) return;
    display.style.display = 'none';
}

function initDDMMYYYYDatePickers() {
    // Native date inputs - no modification
}

function setEquipmentDateField(inputId, displayId, value) {
    const input = document.getElementById(inputId);
    const display = document.getElementById(displayId);
    if (!input || !display) return;
    input.value = value || '';
    syncDateDisplay(inputId, displayId);
}

function getEquipmentStatusColor(status) {
    const colors = {
        active: 'bg-green-100 text-green-800',
        maintenance: 'bg-yellow-100 text-yellow-800',
        retired: 'bg-red-100 text-red-800'
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
}

function getMaintenanceTypeColor(type) {
    const colors = {
        preventive: 'bg-blue-100 text-blue-800',
        corrective: 'bg-yellow-100 text-yellow-800',
        emergency: 'bg-red-100 text-red-800'
    };
    return colors[type] || 'bg-gray-100 text-gray-800';
}

function getLocationTypeColor(type) {
    const colors = {
        equipment: 'bg-blue-100 text-blue-800',
        kitchen: 'bg-green-100 text-green-800',
        uniform: 'bg-purple-100 text-purple-800'
    };
    return colors[type] || 'bg-gray-100 text-gray-800';
}

function getEmployeeStatusColor(status) {
    const colors = {
        active: 'bg-green-100 text-green-800',
        inactive: 'bg-red-100 text-red-800',
        on_leave: 'bg-yellow-100 text-yellow-800'
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
}

function adjustTableContainerHeights() {
    // Find the currently visible section
    const sectionIds = ['dashboard', 'equipment-dashboard', 'hr-dashboard', 'equipment', 'hr', 'admin', 'audit', 'authorizer', 'catering'];
    let visibleSection = null;
    for (const id of sectionIds) {
        const s = document.getElementById(id + '-section');
        if (s && s.style.display !== 'none' && s.offsetParent !== null) {
            visibleSection = s;
            break;
        }
    }
    const selectors = ['.table-scroll-container', '#payroll-table-wrapper', '#attendance-table-wrapper'];
    selectors.forEach(sel => {
        let elements;
        if (visibleSection) {
            // Only process elements inside the visible section
            elements = visibleSection.querySelectorAll(sel);
        } else {
            elements = document.querySelectorAll(sel);
        }
        elements.forEach(el => {
            if (el.offsetParent === null) return;
            el.style.removeProperty('max-height');
            el.style.removeProperty('height');
            const rect = el.getBoundingClientRect();
            const available = window.innerHeight - rect.top - 16;
            if (available > 100) {
                el.style.setProperty('height', available + 'px', 'important');
                el.style.setProperty('overflow-y', 'auto', 'important');
            }
        });
    });
}

window.addEventListener('resize', adjustTableContainerHeights);

const FILTER_ACTIVE_CLASS = 'border-yellow-400 bg-yellow-100 filter-active-blink';

function highlightFilters(filterIds, sublocationBtnId, sublocationCheckboxClass, sublocationCheckAllId) {
    filterIds.forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;
        const isActive = el.value && el.value.trim() !== '';
        if (isActive) {
            el.classList.add(...FILTER_ACTIVE_CLASS.split(' '));
        } else {
            el.classList.remove(...FILTER_ACTIVE_CLASS.split(' '));
        }
    });

    if (sublocationBtnId) {
        const subBtn = document.getElementById(sublocationBtnId);
        if (subBtn) {
            let selectedCount = 0;
            if (sublocationCheckAllId) {
                const checkAll = document.getElementById(sublocationCheckAllId);
                if (checkAll && checkAll.checked) {
                    selectedCount = 0;
                } else if (sublocationCheckboxClass) {
                    selectedCount = document.querySelectorAll(`.${sublocationCheckboxClass}:checked`).length;
                }
            } else if (sublocationCheckboxClass) {
                selectedCount = document.querySelectorAll(`.${sublocationCheckboxClass}:checked`).length;
            }
            if (selectedCount > 0) {
                subBtn.classList.add(...FILTER_ACTIVE_CLASS.split(' '));
            } else {
                subBtn.classList.remove(...FILTER_ACTIVE_CLASS.split(' '));
            }
        }
    }
}

function clearAllFilters(filterIds, sublocationCheckboxClass, sublocationCheckAllId, sublocationLabelId, sublocationListId, callback) {
    filterIds.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });

    if (sublocationCheckboxClass) {
        document.querySelectorAll(`.${sublocationCheckboxClass}`).forEach(cb => cb.checked = false);
    }
    if (sublocationCheckAllId) {
        const checkAll = document.getElementById(sublocationCheckAllId);
        if (checkAll) checkAll.checked = false;
    }
    if (sublocationLabelId) {
        const label = document.getElementById(sublocationLabelId);
        if (label) label.textContent = 'All Sublocations / Business Types';
    }
    if (sublocationListId) {
        const list = document.getElementById(sublocationListId);
        if (list) list.innerHTML = '';
    }

    if (callback) callback();
}

function lockColumnWidths(tableSelector) {
    const table = document.querySelector(tableSelector);
    if (!table) return;
    if (table.offsetParent === null) return;
    const ths = table.querySelectorAll('thead th');
    if (ths.length === 0) return;
    const widths = [];
    let allZero = true;
    ths.forEach(th => {
        const w = th.offsetWidth;
        widths.push(w);
        if (w > 0) allZero = false;
    });
    if (allZero) return;
    ths.forEach((th, i) => {
        if (widths[i] > 0) th.style.width = widths[i] + 'px';
    });
    table.style.tableLayout = 'fixed';
}

function unlockColumnWidths(tableSelector) {
    const table = document.querySelector(tableSelector);
    if (!table) return;
    table.style.tableLayout = 'auto';
    const ths = table.querySelectorAll('thead th');
    ths.forEach(th => {
        th.style.width = '';
    });
}

function applyColumnFreeze(tableSelector, freezeUpToCol) {
    const table = document.querySelector(tableSelector);
    if (!table) return;
    const ths = table.querySelectorAll('thead th');
    if (ths.length === 0) return;
    const thead = table.querySelector('thead');

    ths.forEach(th => {
        th.style.position = '';
        th.style.left = '';
        th.style.top = '';
        th.style.zIndex = '';
        th.style.background = '';
        th.style.boxShadow = '';
    });
    table.querySelectorAll('tbody td').forEach(td => {
        td.style.position = '';
        td.style.left = '';
        td.style.zIndex = '';
        td.style.background = '';
        td.style.boxShadow = '';
    });
    if (thead) thead.style.position = '';
    table.style.borderCollapse = '';
    table.style.borderSpacing = '';

    if (!freezeUpToCol) return;

    let freezeIndex = -1;
    for (let i = 0; i < ths.length; i++) {
        if (ths[i].getAttribute('data-col') === freezeUpToCol) {
            freezeIndex = i;
            break;
        }
    }
    if (freezeIndex < 0) return;

    table.style.borderCollapse = 'separate';
    table.style.borderSpacing = '0';
    if (thead) thead.style.position = 'static';

    ths.forEach(th => {
        th.style.position = 'sticky';
        th.style.top = '0';
        th.style.zIndex = '15';
        th.style.background = '#f9fafb';
    });

    let cumulativeLeft = 0;
    for (let i = 0; i <= freezeIndex; i++) {
        const th = ths[i];
        const w = th.offsetWidth;
        th.style.left = cumulativeLeft + 'px';
        th.style.zIndex = '20';
        if (i === freezeIndex) {
            th.style.boxShadow = '2px 0 4px -2px rgba(0,0,0,0.2)';
        }

        const rows = table.querySelectorAll('tbody tr');
        rows.forEach(row => {
            const td = row.children[i];
            if (td) {
                td.style.position = 'sticky';
                td.style.left = cumulativeLeft + 'px';
                td.style.zIndex = '10';
                // Preserve colored backgrounds for special status rows
                if (td.classList.contains('bg-orange-100')) {
                    td.style.background = '#ffedd5';
                } else if (td.classList.contains('bg-blue-100')) {
                    td.style.background = '#dbeafe';
                } else {
                    td.style.background = '#ffffff';
                }
                if (i === freezeIndex) {
                    td.style.boxShadow = '2px 0 4px -2px rgba(0,0,0,0.2)';
                }
            }
        });

        cumulativeLeft += w;
    }
}

function clearColumnFreeze(tableSelector) {
    applyColumnFreeze(tableSelector, null);
    const table = document.querySelector(tableSelector);
    if (table) {
        table.style.borderCollapse = '';
        table.style.borderSpacing = '';
    }
}

function populateFreezeSelect(selectId, columns, storageKey, tableSelector) {
    const select = document.getElementById(selectId);
    if (!select) return;
    const saved = localStorage.getItem(storageKey) || '';
    select.innerHTML = '<option value="">None</option>';
    columns.forEach(col => {
        const opt = document.createElement('option');
        opt.value = col.key;
        opt.textContent = col.label;
        if (saved === col.key) opt.selected = true;
        select.appendChild(opt);
    });
}

// ==================== TABLE LOADING SPINNER ====================
// No-op: the global fetch loader (below) is now the single loading
// indicator for every page/action, so per-table spinners are disabled
// to avoid showing two spinners at once.
function showTableLoading(tbodyId, message) {}

function showTableError(tbodyId, message) {
    const tbody = document.getElementById(tbodyId);
    if (!tbody) return;
    const msg = message || 'Error loading data. Please try again.';
    const colCount = tbody.closest('table')?.querySelectorAll('thead th')?.length || 10;
    tbody.innerHTML = `<tr><td colspan="${colCount}" class="text-center py-8 text-red-500 text-sm"><i class="fas fa-exclamation-circle mr-2"></i>${msg}</td></tr>`;
}

// ==================== MOBILE SIDEBAR ====================
function toggleMobileSidebar() {
    const c = document.querySelector('.app-container');
    if (c) c.classList.toggle('sidebar-open');
}
function closeMobileSidebar() {
    const c = document.querySelector('.app-container');
    if (c) c.classList.remove('sidebar-open');
}

// ==================== GLOBAL ACTION LOADER ====================
// Shows a blocking spinner overlay whenever any API call is in flight,
// so clicks get immediate visual feedback and can't be repeated while
// a request is running (matters on slow/tunnel connections).
(function () {
    let pendingCount = 0;
    let showTimer = null;
    let hideTimer = null;
    let loaderEl = null;

    function ensureLoader() {
        if (loaderEl && document.body.contains(loaderEl)) return loaderEl;
        loaderEl = document.createElement('div');
        loaderEl.id = 'global-fetch-loader';
        loaderEl.style.cssText = 'position:fixed;inset:0;z-index:99999;display:none;align-items:center;justify-content:center;background:rgba(255,255,255,0.45);';
        // Uses the animate-spin class from the static Tailwind stylesheet —
        // CSP blocks injected <style> elements, so custom keyframes won't work
        loaderEl.innerHTML =
            '<div style="display:flex;flex-direction:column;align-items:center;gap:12px;background:rgba(255,255,255,0.95);border-radius:12px;padding:22px 32px;box-shadow:0 10px 30px rgba(0,0,0,0.15);">' +
                '<div class="animate-spin" style="width:40px;height:40px;border:4px solid #bfdbfe;border-top-color:#2563eb;border-radius:50%;"></div>' +
                '<span style="color:#374151;font-size:13px;font-weight:500;">Please wait...</span>' +
            '</div>';
        document.body.appendChild(loaderEl);
        return loaderEl;
    }

    function showLoader() {
        clearTimeout(showTimer);
        clearTimeout(hideTimer);
        showTimer = setTimeout(() => {
            if (pendingCount <= 0) return;
            // Skip the overlay if a spinner is already visible elsewhere
            // (table loading rows, lightbox, etc.) - avoids double spinners
            const hasVisibleSpinner = Array.from(document.querySelectorAll('.animate-spin'))
                .some(el => el.offsetParent !== null && !el.closest('#global-fetch-loader'));
            if (!hasVisibleSpinner) ensureLoader().style.display = 'flex';
        }, 250); // debounce: skip flicker on fast requests
    }

    function hideLoader() {
        clearTimeout(showTimer);
        clearTimeout(hideTimer);
        // Hold the loader briefly after the last request finishes so chains
        // of consecutive fetches don't flash it off and back on
        hideTimer = setTimeout(() => {
            if (pendingCount === 0 && loaderEl) loaderEl.style.display = 'none';
        }, 350);
    }

    const origFetch = window.fetch.bind(window);
    window.fetch = function () {
        pendingCount++;
        showLoader();
        return origFetch.apply(null, arguments)
            .then(response => {
                // fetch resolves on headers - wrap body readers so the loader
                // stays up until the response body is actually consumed
                ['json', 'text', 'blob', 'arrayBuffer', 'formData'].forEach(m => {
                    const orig = response[m];
                    if (typeof orig !== 'function') return;
                    response[m] = function () {
                        pendingCount++;
                        showLoader();
                        return orig.apply(response, arguments).finally(() => {
                            pendingCount = Math.max(0, pendingCount - 1);
                            if (pendingCount === 0) hideLoader();
                        });
                    };
                });
                return response;
            })
            .finally(() => {
                pendingCount = Math.max(0, pendingCount - 1);
                if (pendingCount === 0) hideLoader();
            });
    };
})();

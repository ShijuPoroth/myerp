// ==================== LEAVE ENTRY ====================

let leaveEntryEmployees = [];
let leaveEntryEntitlements = {};
let leaveEntryBalances = {};
let leaveEntryHistoryData = [];
let leaveEntryGroupedData = [];
let leaveEntryPeriodCalc = new Map();

async function initLeaveEntry() {
    await loadLeaveEntryEmployees();
    loadLeaveEntryHistory();

    // Attach event delegation for leave history action buttons
    const container = document.getElementById('leave-entry-history');
    if (container) {
        container.removeEventListener('click', handleLeaveEntryAction);
        container.addEventListener('click', handleLeaveEntryAction);
    }
}

function openLeaveEntryModal() {
    const modal = document.getElementById('leave-entry-modal');
    if (!modal) return;
    modal.style.display = 'flex';
    // Clear form
    document.getElementById('leave-entry-employee-search').value = '';
    document.getElementById('leave-entry-employee').value = '';
    document.getElementById('leave-entry-from').value = '';
    document.getElementById('leave-entry-to').value = '';
    document.getElementById('leave-entry-notes').value = '';
    document.getElementById('leave-entry-type').value = '';
    document.getElementById('leave-entry-location').classList.add('hidden');
    document.getElementById('leave-entry-entitlements').classList.add('hidden');
    document.getElementById('leave-entry-preview').classList.add('hidden');
}

function closeLeaveEntryModal() {
    const modal = document.getElementById('leave-entry-modal');
    if (!modal) return;
    modal.style.display = 'none';
}

async function loadLeaveEntryEmployees() {
    try {
        const response = await fetch(`${API_BASE}/employees`);
        leaveEntryEmployees = await response.json();
        renderLeaveEntryDropdown('');
    } catch (error) {
        console.error('Error loading employees for leave entry:', error);
    }
}

function renderLeaveEntryDropdown(filterText) {
    const dropdown = document.getElementById('leave-entry-dropdown');
    if (!dropdown) return;
    const filtered = leaveEntryEmployees
        .filter(e => !e.is_terminated && e.status !== 'Terminated')
        .filter(e => {
            if (!filterText) return true;
            const name = `${e.first_name} ${e.last_name}`.toLowerCase();
            const empId = (e.employee_id || '').toLowerCase();
            return name.includes(filterText.toLowerCase()) || empId.includes(filterText.toLowerCase());
        })
        .sort((a, b) => (a.first_name + ' ' + a.last_name).localeCompare(b.first_name + ' ' + b.last_name));

    if (filtered.length === 0) {
        dropdown.innerHTML = '<div class="px-3 py-2 text-sm text-gray-400">No employees found</div>';
    } else {
        dropdown.innerHTML = filtered.map(emp =>
            `<div class="px-3 py-2 text-sm hover:bg-blue-50 cursor-pointer border-b border-gray-100 last:border-0" onmousedown="selectLeaveEntryEmployee(${emp.id})">
                <span class="font-medium">${emp.first_name} ${emp.last_name}</span>
                ${emp.employee_id ? '<span class="text-gray-400 text-xs ml-1">(' + emp.employee_id + ')</span>' : ''}
                ${emp.department ? '<span class="text-gray-400 text-xs ml-2">' + emp.department + '</span>' : ''}
            </div>`
        ).join('');
    }
}

function filterLeaveEntryEmployees() {
    const search = document.getElementById('leave-entry-employee-search');
    const dropdown = document.getElementById('leave-entry-dropdown');
    if (search.value.trim() === '') {
        document.getElementById('leave-entry-employee').value = '';
        document.getElementById('leave-entry-location').classList.add('hidden');
        document.getElementById('leave-entry-entitlements').classList.add('hidden');
        onLeaveEntryDateChange();
    }
    renderLeaveEntryDropdown(search.value);
    dropdown.classList.remove('hidden');
}

function showLeaveEntryDropdown() {
    const dropdown = document.getElementById('leave-entry-dropdown');
    const search = document.getElementById('leave-entry-employee-search');
    renderLeaveEntryDropdown(search.value);
    dropdown.classList.remove('hidden');
}

function hideLeaveEntryDropdown() {
    document.getElementById('leave-entry-dropdown').classList.add('hidden');
}

function selectLeaveEntryEmployee(empId) {
    const emp = leaveEntryEmployees.find(e => e.id == empId);
    if (!emp) return;
    document.getElementById('leave-entry-employee-search').value = `${emp.first_name} ${emp.last_name}${emp.employee_id ? ' (' + emp.employee_id + ')' : ''}`;
    document.getElementById('leave-entry-employee').value = emp.id;
    document.getElementById('leave-entry-dropdown').classList.add('hidden');
    onLeaveEntryEmployeeChange();
}

async function onLeaveEntryEmployeeChange() {
    const empId = document.getElementById('leave-entry-employee').value;
    const entContainer = document.getElementById('leave-entry-entitlements');
    const entList = document.getElementById('leave-entry-entitlements-list');
    const locContainer = document.getElementById('leave-entry-location');
    const locInfo = document.getElementById('leave-entry-location-info');

    if (!empId) {
        entContainer.classList.add('hidden');
        entList.innerHTML = '';
        locContainer.classList.add('hidden');
        locInfo.innerHTML = '';
        leaveEntryEntitlements = {};
        onLeaveEntryDateChange();
        return;
    }

    // Show location info
    const emp = leaveEntryEmployees.find(e => e.id == empId);
    if (emp) {
        locContainer.classList.remove('hidden');
        const subLocParts = [emp.sub_location_name, emp.business_type_name, emp.business_unit_code].filter(Boolean).join(' - ');
        locInfo.innerHTML = `
            <div><span class="text-gray-500 text-xs">Country:</span> <span class="font-medium">${emp.country_name || '-'}</span></div>
            <div><span class="text-gray-500 text-xs">Location:</span> <span class="font-medium">${emp.location_type_name || '-'}</span></div>
            <div><span class="text-gray-500 text-xs">Sub Location:</span> <span class="font-medium">${subLocParts || '-'}</span></div>
        `;
    }

    try {
        const [entRes, balRes] = await Promise.all([
            fetch(`${API_BASE}/employee-leave-entitlements/${empId}`),
            fetch(`${API_BASE}/employee-leave-balance/${empId}`)
        ]);
        const entitlements = await entRes.json();
        const balances = await balRes.json();
        leaveEntryEntitlements[empId] = entitlements;
        leaveEntryBalances[empId] = balances;

        if (entitlements.length > 0) {
            entContainer.classList.remove('hidden');
            entList.innerHTML = entitlements.map(ent => {
                const colorMap = {
                    'medical': 'bg-purple-50 text-purple-700 border-purple-200',
                    'paid': 'bg-yellow-50 text-yellow-700 border-yellow-200',
                    'compassionate': 'bg-orange-50 text-orange-700 border-orange-200',
                    'day off': 'bg-gray-50 text-gray-700 border-gray-200',
                    'dayoff': 'bg-gray-50 text-gray-700 border-gray-200',
                    'day-off': 'bg-gray-50 text-gray-700 border-gray-200'
                };
                const ltLower = (ent.leave_type || '').toLowerCase();
                const colorClass = Object.keys(colorMap).find(k => ltLower.includes(k)) ? colorMap[Object.keys(colorMap).find(k => ltLower.includes(k))] : 'bg-blue-50 text-blue-700 border-blue-200';
                const bal = balances.find(b => b.leave_type === ent.leave_type);
                const taken = bal ? bal.taken : 0;
                const earned = bal ? bal.earned : 0;
                const remaining = bal ? bal.remaining : ent.days_count;
                const remainingClass = remaining < 0 ? 'text-red-600 font-bold' : 'text-green-600 font-semibold';
                return `<div class="flex items-center justify-between px-3 py-2 rounded-lg border ${colorClass}">
                    <div class="flex flex-col">
                        <span class="text-sm font-medium">${ent.leave_type || '-'}</span>
                        <span class="text-xs text-gray-500">Entitled: ${ent.days_count} days after ${ent.months_count || 0} ${ent.period_type || 'months'}</span>
                    </div>
                    <div class="flex flex-col items-end">
                        <span class="text-xs">Earned: <span class="font-semibold text-blue-600">${earned}</span> / ${ent.days_count}</span>
                        <span class="text-xs">Taken: <span class="font-semibold">${taken}</span></span>
                        <span class="text-xs ${remainingClass}">Remaining: ${remaining}</span>
                    </div>
                </div>`;
            }).join('');
        } else {
            entContainer.classList.remove('hidden');
            entList.innerHTML = '<p class="text-xs text-gray-400 italic">No leave entitlements configured for this employee.</p>';
        }
    } catch (error) {
        console.error('Error loading leave entitlements:', error);
    }

    onLeaveEntryDateChange();
}

function onLeaveEntryDateChange() {
    const from = document.getElementById('leave-entry-from').value;
    const to = document.getElementById('leave-entry-to').value;
    const preview = document.getElementById('leave-entry-preview');
    const previewText = document.getElementById('leave-entry-preview-text');
    const daysDisplay = document.getElementById('leave-entry-days-count');

    if (from && to) {
        if (from > to) {
            preview.classList.remove('hidden');
            previewText.textContent = 'From date must be before or equal to To date.';
            preview.className = 'bg-red-50 border border-red-200 rounded-lg p-3 text-sm';
            previewText.className = 'text-red-700';
            if (daysDisplay) daysDisplay.textContent = '!';
            return;
        }

        const days = getLeaveDateRange(from, to).length;
        const leaveType = document.getElementById('leave-entry-type');
        const typeLabel = leaveType.options[leaveType.selectedIndex]?.text || '';

        if (daysDisplay) daysDisplay.textContent = days;

        preview.classList.remove('hidden');
        preview.className = 'bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm';
        previewText.className = 'text-blue-700';
        previewText.textContent = `${days} day${days !== 1 ? 's' : ''} of ${typeLabel || 'selected leave'} will be applied to attendance register.`;
    } else {
        preview.classList.add('hidden');
        if (daysDisplay) daysDisplay.textContent = '0';
    }
}

function getLeaveDateRange(from, to) {
    const dates = [];
    const start = new Date(from + 'T00:00:00');
    const end = new Date(to + 'T00:00:00');
    const current = new Date(start);
    while (current <= end) {
        const dateStr = current.getFullYear() + '-' + String(current.getMonth() + 1).padStart(2, '0') + '-' + String(current.getDate()).padStart(2, '0');
        dates.push(dateStr);
        current.setDate(current.getDate() + 1);
    }
    return dates;
}

async function applyLeaveEntry() {
    const empId = document.getElementById('leave-entry-employee').value;
    const leaveType = document.getElementById('leave-entry-type').value;
    const from = document.getElementById('leave-entry-from').value;
    const to = document.getElementById('leave-entry-to').value;
    const notes = document.getElementById('leave-entry-notes').value;

    if (!empId) { alert('Please select an employee.'); return; }
    if (!leaveType) { alert('Please select a leave type.'); return; }
    if (!from || !to) { alert('Please select both From and To dates.'); return; }
    if (from > to) { alert('From date must be before or equal to To date.'); return; }

    // Check if employee is entitled to this leave type
    const entitlements = leaveEntryEntitlements[empId] || [];
    const isEntitled = entitlements.some(ent => {
        const entType = (ent.leave_type || '').toLowerCase().replace(/[\s\-_]/g, '');
        const selectedType = leaveType.toLowerCase().replace(/[\s\-_]/g, '');
        return entType === selectedType;
    });
    if (!isEntitled) {
        const entitledTypes = entitlements.map(ent => ent.leave_type).join(', ');
        alert(`The selected employee is not entitled to "${leaveType}".\n\nEntitled leave types: ${entitledTypes || 'None'}`);
        return;
    }

    // Check if employee has earned leave balance available
    const dates = getLeaveDateRange(from, to);
    try {
        const balRes = await fetch(`${API_BASE}/employee-leave-balance/${empId}`);
        if (balRes.ok) {
            const balances = await balRes.json();
            const bal = balances.find(b => {
                const bType = (b.leave_type || '').toLowerCase().replace(/[\s\-_]/g, '');
                const selectedType = leaveType.toLowerCase().replace(/[\s\-_]/g, '');
                return bType === selectedType;
            });
            if (bal) {
                const remaining = bal.remaining || 0;
                const requestedDays = dates.length;
                if (remaining <= 0) {
                    if (!confirm(`This employee has no remaining balance for "${leaveType}".\n\nEarned: ${bal.earned || 0}, Taken: ${bal.taken || 0}, Remaining: ${remaining}\n\nDo you still want to apply this leave?`)) return;
                } else if (requestedDays > remaining) {
                    if (!confirm(`Insufficient leave balance for "${leaveType}".\n\nRemaining: ${remaining} days, Requested: ${requestedDays} days.\n\nThe balance will go negative. Do you still want to apply this leave?`)) return;
                }
            }
        }
    } catch (error) {
        console.error('Error checking leave balance:', error);
    }

    // Check for locked months in the date range
    const months = [...new Set(dates.map(d => d.substring(0, 7)))];
    try {
        for (const month of months) {
            const lockRes = await fetch(`${API_BASE}/attendance?month=${month}`);
            if (lockRes.ok) {
                const lockData = await lockRes.json();
                if (lockData.isLocked) {
                    alert(`Month ${month} is locked. Please unlock it first before applying leave.`);
                    return;
                }
            }
        }
    } catch (error) {
        console.error('Error checking lock status:', error);
    }

    // Build bulk records
    const records = dates.map(date => ({
        employee_id: parseInt(empId),
        date,
        status: leaveType,
        notes: notes || null
    }));

    try {
        const response = await fetch(`${API_BASE}/attendance/bulk`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ records })
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({ error: 'Unknown error' }));
            alert('Error applying leave: ' + (error.error || response.statusText));
            return;
        }

        const emp = leaveEntryEmployees.find(e => e.id == empId);
        const empName = emp ? `${emp.first_name} ${emp.last_name}` : 'Employee';
        const typeLabel = document.getElementById('leave-entry-type').options[document.getElementById('leave-entry-type').selectedIndex].text;

        await logAudit('CREATE', 'payment-management', 'Leave Entry', parseInt(empId),
            `Employee: ${empName} | Leave Type: ${typeLabel} | From: ${from} | To: ${to} | Days: ${dates.length}${notes ? ' | Notes: ' + notes : ''}`);

        alert(`Successfully applied ${dates.length} day${dates.length !== 1 ? 's' : ''} of ${typeLabel} to ${empName}'s attendance.`);

        // Close modal
        closeLeaveEntryModal();

        // Reload history
        loadLeaveEntryHistory();
    } catch (error) {
        console.error('Error applying leave:', error);
        alert('Error applying leave. Please try again.');
    }
}

async function loadLeaveEntryHistory() {
    const container = document.getElementById('leave-entry-history');
    if (!container) return;

    try {
        const response = await fetch(`${API_BASE}/leave-records`);
        const records = await response.json();
        leaveEntryHistoryData = records;

        if (!records || records.length === 0) {
            container.innerHTML = '<p class="text-gray-400 text-sm text-center py-8">No leave applications found. Click "Apply Leave" to add one.</p>';
            return;
        }

        // Fetch current leave balances for each unique employee
        const empIds = [...new Set(records.map(r => r.employee_id))];
        leaveEntryBalances = {};
        await Promise.all(empIds.map(async empId => {
            try {
                const resp = await fetch(`${API_BASE}/employee-leave-balance/${empId}`);
                if (resp.ok) leaveEntryBalances[empId] = await resp.json();
            } catch (e) {
                console.error('Error fetching leave balance for', empId, e);
            }
        }));

        renderLeaveEntryHistory(records);
    } catch (error) {
        console.error('Error loading leave history:', error);
        container.innerHTML = '<p class="text-red-400 text-sm text-center py-8">Error loading leave records.</p>';
    }
}

function renderLeaveEntryHistory(records) {
    const container = document.getElementById('leave-entry-history');
    if (!container) return;

    if (!records || records.length === 0) {
        container.innerHTML = '<p class="text-gray-400 text-sm text-center py-8">No leave applications found matching your search.</p>';
        return;
    }

    const statusInfo = {
        'medical-leave': { label: 'ML', color: 'bg-purple-100 text-purple-800', full: 'Medical Leave' },
        'paid-leave': { label: 'PL', color: 'bg-yellow-100 text-yellow-800', full: 'Paid Leave' },
        'compassionate-leave': { label: 'CL', color: 'bg-orange-100 text-orange-800', full: 'Compassionate Leave' },
        'unpaid-leave': { label: 'A', color: 'bg-red-100 text-red-800', full: 'Unpaid Leave' }
    };

    // Group consecutive dates with same status+employee into ranges
    const empLeaveRecords = {};
    records.forEach(r => {
        const empId = r.employee_id;
        if (!empLeaveRecords[empId]) empLeaveRecords[empId] = [];
        empLeaveRecords[empId].push({ date: r.date, status: r.status, notes: r.notes, empName: `${r.first_name} ${r.last_name}`, empCode: r.emp_code });
    });

    const groupedEntries = [];
    for (const [empIdStr, recs] of Object.entries(empLeaveRecords)) {
        const empId = parseInt(empIdStr);
        recs.sort((a, b) => a.date.localeCompare(b.date));
        const periods = leaveGroupConsecutivePeriods(recs);
        periods.forEach(p => {
            p.empId = empId;
            p.empName = recs[0].empName;
            p.empCode = recs[0].empCode;
        });
        groupedEntries.push(...periods);
    }

    // Sort by from date descending
    groupedEntries.sort((a, b) => b.from.localeCompare(a.from));
    leaveEntryGroupedData = groupedEntries;

    // Precompute sequential (chained) accumulated/carry-forward per employee + leave type,
    // processing periods in chronological order so each period's balance carries into the next.
    const periodCalc = new Map(); // key: empId|status|from|to -> {earned, prevCarryForward, accumulated, carryForward}
    const byEmpType = {};
    groupedEntries.forEach(e => {
        const key = e.empId + '|' + e.status;
        if (!byEmpType[key]) byEmpType[key] = [];
        byEmpType[key].push(e);
    });
    Object.entries(byEmpType).forEach(([key, periods]) => {
        periods.sort((a, b) => a.from.localeCompare(b.from));
        const [empIdStr, status] = key.split('|');
        const empId = parseInt(empIdStr);
        const balances = leaveEntryBalances[empId] || [];
        const typeKey = status.replace('-leave', '').toLowerCase();
        const bal = balances.find(b => (b.leave_type || '').toLowerCase().includes(typeKey)) || {};
        const emp = leaveEntryEmployees.find(emp => emp.id == empId) || {};
        const hireDate = emp.hire_date;
        const entitled = bal.days_count || 0;
        const months = bal.months_count || 0;
        const period = bal.period_type || 'months';
        const unpaidRecords = (leaveEntryHistoryData || []).filter(r => r.employee_id == empId);

        const { periodCalc: chainCalc } = leaveComputeChain(periods, {
            hireDate, entitled, months, period, unpaidRecords,
            expireAtCycleEnd: status === 'medical-leave'
        });
        chainCalc.forEach((calc, subKey) => {
            periodCalc.set(key + '|' + subKey, calc);
        });
    });
    leaveEntryPeriodCalc = periodCalc;

    container.innerHTML = `
        <div class="overflow-y-auto flex-1" id="leave-entry-history-table">
            <table class="w-full text-sm">
                <thead class="bg-gray-50 sticky top-0">
                    <tr>
                        <th class="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Employee</th>
                        <th class="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                        <th class="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase" title="Days earned since the previous return-to-work date (or hire date for the first record)">Earned (Cycle)</th>
                        <th class="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase" title="Balance brought forward from the previous leave record">Prev. Balance</th>
                        <th class="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase" title="Earned (Cycle) + Prev. Balance">Accumulated</th>
                        <th class="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Dates Taken</th>
                        <th class="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase">Days</th>
                        <th class="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase" title="Accumulated - Days Taken">Balance Carry Forward</th>
                        <th class="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Notes</th>
                        <th class="px-2 py-2 text-center text-xs font-medium text-gray-500 uppercase">Actions</th>
                    </tr>
                </thead>
                <tbody class="bg-white divide-y divide-gray-200">
                    ${groupedEntries.map((e, idx) => {
                        const si = statusInfo[e.status] || { label: '?', color: 'bg-gray-100', full: e.status };
                        const calc = periodCalc.get(e.empId + '|' + e.status + '|' + e.from + '|' + e.to) || { earned: '-', prevCarryForward: '-', accumulated: '-', carryForward: '-' };
                        const earned = calc.earned;
                        const prevCarryForward = calc.prevCarryForward;
                        const accumulated = calc.accumulated;
                        const carryForward = calc.carryForward;
                        const dateRange = formatDate(e.from) + (e.from !== e.to ? ' &ndash; ' + formatDate(e.to) : '');
                        return `<tr>
                            <td class="px-3 py-2 whitespace-nowrap text-xs">${e.empName}${e.empCode ? ' <span class="text-gray-400">(' + e.empCode + ')</span>' : ''}</td>
                            <td class="px-3 py-2 whitespace-nowrap"><span class="px-2 py-0.5 text-xs rounded-full ${si.color}" title="${si.full}">${si.label}</span></td>
                            <td class="px-3 py-2 text-center text-xs">${earned}</td>
                            <td class="px-3 py-2 text-center text-xs ${(typeof prevCarryForward === 'number' && prevCarryForward < 0) ? 'text-red-600' : ''}">${prevCarryForward}</td>
                            <td class="px-3 py-2 text-center text-xs font-semibold">${accumulated}</td>
                            <td class="px-3 py-2 whitespace-nowrap text-xs">${dateRange}</td>
                            <td class="px-3 py-2 text-center text-xs font-semibold">${e.days}</td>
                            <td class="px-3 py-2 text-center text-xs ${(typeof carryForward === 'number' && carryForward < 0) ? 'text-red-600 font-semibold' : ''}">${carryForward}</td>
                            <td class="px-3 py-2 text-xs text-gray-500 max-w-xs truncate" title="${(e.notes || '').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}">${(e.notes || '').replace(/</g, '&lt;').replace(/>/g, '&gt;') || '-'}</td>
                            <td class="px-2 py-2 whitespace-nowrap text-center">
                                <button class="leave-action-btn text-green-600 hover:text-green-800 text-xs mr-2" title="View" data-index="${idx}" data-action="view"><i class="fas fa-eye pointer-events-none"></i></button>
                                <button class="leave-action-btn text-blue-600 hover:text-blue-800 text-xs mr-2" title="Edit" data-index="${idx}" data-action="edit"><i class="fas fa-edit pointer-events-none"></i></button>
                                <button class="leave-action-btn text-red-500 hover:text-red-700 text-xs" title="Remove" data-index="${idx}" data-action="remove"><i class="fas fa-times pointer-events-none"></i></button>
                            </td>
                        </tr>`;
                    }).join('')}
                </tbody>
            </table>
        </div>
    `;
}

function filterLeaveEntryHistory() {
    const search = document.getElementById('leave-entry-history-search').value.toLowerCase();
    if (!search) {
        renderLeaveEntryHistory(leaveEntryHistoryData);
        return;
    }

    const filtered = leaveEntryHistoryData.filter(r => {
        const empName = `${r.first_name} ${r.last_name}`.toLowerCase();
        const empCode = (r.emp_code || '').toLowerCase();
        const status = r.status.toLowerCase();
        const notes = (r.notes || '').toLowerCase();
        const date = r.date;
        return empName.includes(search) || empCode.includes(search) || status.includes(search) || notes.includes(search) || date.includes(search);
    });

    renderLeaveEntryHistory(filtered);
}

function handleLeaveEntryAction(e) {
    const btn = e.target.closest('.leave-action-btn');
    if (!btn) return;
    
    e.preventDefault();
    e.stopPropagation();
    
    const idx = parseInt(btn.dataset.index);
    const action = btn.dataset.action;
    const data = leaveEntryGroupedData[idx];
    if (!data || !action) return;
    
    if (action === 'view') {
        viewLeaveEntry(data.empId, data.from, data.to, data.status, data.notes);
    } else if (action === 'edit') {
        editLeaveEntry(data.empId, data.from, data.to, data.status, data.notes);
    } else if (action === 'remove') {
        removeLeaveRange(data.empId, data.from, data.to);
    }
}

async function viewLeaveEntry(empId, fromDate, toDate, status, notes) {
    const statusLabels = {
        'medical-leave': 'Medical Leave',
        'paid-leave': 'Paid Leave',
        'compassionate-leave': 'Compassionate Leave',
        'unpaid-leave': 'Unpaid Leave'
    };
    const emp = leaveEntryEmployees.find(e => e.id == empId);
    const empName = emp ? `${emp.first_name} ${emp.last_name}` : 'Unknown';
    const empCode = emp ? emp.employee_id : '';
    const days = getLeaveDateRange(fromDate, toDate).length;
    const statusLabel = statusLabels[status] || status;

    const calc = leaveEntryPeriodCalc.get(empId + '|' + status + '|' + fromDate + '|' + toDate) ||
        { earned: '-', prevCarryForward: '-', accumulated: '-', carryForward: '-', windowStart: null };

    const windowLabel = calc.windowStart
        ? `${formatDate(calc.windowStart)} &ndash; ${formatDate(fromDate)}`
        : '-';
    const cfNegative = typeof calc.carryForward === 'number' && calc.carryForward < 0;

    // Remove existing popup
    const existing = document.getElementById('leave-view-popup');
    if (existing) existing.remove();

    const popup = document.createElement('div');
    popup.id = 'leave-view-popup';
    popup.style.cssText = 'position:fixed; top:50%; left:50%; transform:translate(-50%,-50%); background:#fff; border-radius:10px; padding:24px; z-index:9999; box-shadow:0 8px 30px rgba(0,0,0,0.25); min-width:380px; max-width:480px;';

    const backdrop = document.createElement('div');
    backdrop.id = 'leave-view-backdrop';
    backdrop.style.cssText = 'position:fixed; inset:0; background:rgba(0,0,0,0.3); z-index:9998;';
    document.body.appendChild(backdrop);
    document.body.appendChild(popup);

    popup.innerHTML = `
        <div style="text-align:center; margin-bottom:16px;">
            <div style="font-size:16px; font-weight:700; color:#1f2937;">Leave Details</div>
        </div>
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px 24px; margin-bottom:16px;">
            <div><span style="font-size:12px; color:#6b7280;">Employee</span><div style="font-weight:600; font-size:14px;">${empName}</div></div>
            <div><span style="font-size:12px; color:#6b7280;">Employee ID</span><div style="font-weight:600; font-size:14px;">${empCode || '-'}</div></div>
            <div><span style="font-size:12px; color:#6b7280;">Leave Type</span><div style="font-weight:600; font-size:14px;">${statusLabel}</div></div>
            <div><span style="font-size:12px; color:#6b7280;">Days Taken</span><div style="font-weight:600; font-size:14px;">${days}</div></div>
            <div><span style="font-size:12px; color:#6b7280;">From</span><div style="font-weight:600; font-size:14px;">${formatDate(fromDate)}</div></div>
            <div><span style="font-size:12px; color:#6b7280;">To</span><div style="font-weight:600; font-size:14px;">${formatDate(toDate)}</div></div>
        </div>
        ${notes ? `<div style="margin-bottom:16px;"><span style="font-size:12px; color:#6b7280;">Notes</span><div style="font-size:13px; color:#374151; margin-top:4px;">${notes}</div></div>` : ''}
        <div style="background:#f0fdfa; border-radius:8px; padding:14px; margin-bottom:16px;">
            <div style="font-size:12px; font-weight:700; color:#0d9488; text-transform:uppercase; letter-spacing:0.03em; margin-bottom:10px;">Balance Breakdown</div>
            <div style="font-size:12px; color:#6b7280; margin-bottom:8px;">Earning window: <span style="color:#374151; font-weight:500;">${windowLabel}</span></div>
            <table style="width:100%; font-size:13px; border-collapse:collapse;">
                <tr>
                    <td style="padding:4px 0; color:#6b7280;">Earned this cycle</td>
                    <td style="padding:4px 0; text-align:right; font-weight:600;">${calc.earned}</td>
                </tr>
                <tr>
                    <td style="padding:4px 0; color:#6b7280;">Previous balance</td>
                    <td style="padding:4px 0; text-align:right; font-weight:600; ${typeof calc.prevCarryForward === 'number' && calc.prevCarryForward < 0 ? 'color:#dc2626;' : ''}">${calc.prevCarryForward}</td>
                </tr>
                <tr style="border-top:1px solid #d1fae5;">
                    <td style="padding:4px 0; color:#374151; font-weight:600;">Accumulated (eligible)</td>
                    <td style="padding:4px 0; text-align:right; font-weight:700;">${calc.accumulated}</td>
                </tr>
                <tr>
                    <td style="padding:4px 0; color:#6b7280;">Days taken this period</td>
                    <td style="padding:4px 0; text-align:right; font-weight:600;">- ${days}</td>
                </tr>
                <tr style="border-top:1px solid #d1fae5;">
                    <td style="padding:6px 0 0; color:#374151; font-weight:700;">Balance carry forward</td>
                    <td style="padding:6px 0 0; text-align:right; font-weight:700; ${cfNegative ? 'color:#dc2626;' : 'color:#059669;'}">${calc.carryForward}</td>
                </tr>
            </table>
        </div>
        <div style="text-align:center;">
            <button id="leave-view-close" style="padding:8px 24px; border:1px solid #d1d5db; border-radius:6px; font-size:13px; cursor:pointer; background:#f9fafb;">Close</button>
        </div>
    `;

    function closeViewPopup() {
        if (popup.parentNode) popup.remove();
        if (backdrop.parentNode) backdrop.remove();
    }

    popup.querySelector('#leave-view-close').addEventListener('click', closeViewPopup);
    backdrop.addEventListener('click', closeViewPopup);
}

async function editLeaveEntry(empId, fromDate, toDate, status, notes) {
    // Remove existing leave records for this range, then open the apply modal pre-filled
    const emp = leaveEntryEmployees.find(e => e.id == empId);
    if (!emp) { alert('Employee not found.'); return; }

    const statusLabels = {
        'medical-leave': 'Medical Leave',
        'paid-leave': 'Paid Leave',
        'compassionate-leave': 'Compassionate Leave',
        'unpaid-leave': 'Unpaid Leave'
    };

    if (!confirm(`Edit leave entry?\n\nThis will remove the existing leave from ${formatDate(fromDate)} to ${formatDate(toDate)} (${statusLabels[status] || status}) and open the Apply Leave form pre-filled so you can make changes.`)) return;

    // Delete existing records in bulk
    try {
        const delRes = await fetch(`${API_BASE}/attendance/bulk/${empId}`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ from_date: fromDate, to_date: toDate })
        });
        if (!delRes.ok) {
            const err = await delRes.json().catch(() => ({ error: 'Unknown error' }));
            alert('Error removing old leave: ' + (err.error || delRes.statusText));
            return;
        }
    } catch (error) {
        console.error('Error removing old leave for edit:', error);
        alert('Error removing old leave entries for edit.');
        return;
    }

    // Open the apply leave modal pre-filled
    openLeaveEntryModal();

    // Pre-fill the form
    document.getElementById('leave-entry-employee-search').value = `${emp.first_name} ${emp.last_name}${emp.employee_id ? ' (' + emp.employee_id + ')' : ''}`;
    document.getElementById('leave-entry-employee').value = emp.id;
    document.getElementById('leave-entry-from').value = fromDate;
    document.getElementById('leave-entry-to').value = toDate;
    document.getElementById('leave-entry-type').value = status;
    document.getElementById('leave-entry-notes').value = notes || '';

    // Trigger entitlements/location display
    onLeaveEntryEmployeeChange();
    onLeaveEntryDateChange();

    // Reload history to reflect the deletion
    loadLeaveEntryHistory();
}

async function removeLeaveRange(empId, fromDate, toDate) {
    if (!confirm(`Remove leave from ${formatDate(fromDate)} to ${formatDate(toDate)}?`)) return;

    try {
        const delRes = await fetch(`${API_BASE}/attendance/bulk/${empId}`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ from_date: fromDate, to_date: toDate })
        });
        if (!delRes.ok) {
            const err = await delRes.json().catch(() => ({ error: 'Unknown error' }));
            alert('Error removing leave: ' + (err.error || delRes.statusText));
            return;
        }
        loadLeaveEntryHistory();
    } catch (error) {
        console.error('Error removing leave range:', error);
        alert('Error removing leave entries.');
    }
}

async function removeLeaveEntry(empId, date) {
    if (!confirm(`Remove leave entry for ${formatDate(date)}?`)) return;

    try {
        const response = await fetch(`${API_BASE}/attendance/${empId}/${date}`, { method: 'DELETE' });
        if (!response.ok) {
            const error = await response.json().catch(() => ({ error: 'Unknown error' }));
            alert('Error removing leave: ' + (error.error || response.statusText));
            return;
        }
        loadLeaveEntryHistory();
    } catch (error) {
        console.error('Error removing leave entry:', error);
        alert('Error removing leave entry.');
    }
}

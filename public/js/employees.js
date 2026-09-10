// Employee management

let employeeExpiryWarnings = {};
let employeeLeaveBalances = {};

async function loadEmployees() {
    showTableLoading('employees-table-body', 'Loading employees...');
    try {
        const response = await fetch(`${API_BASE}/employees?active=true&_t=${Date.now()}`);
        allEmployees = await response.json();
        await loadEmployeeExpiryWarnings();
        populateEmployeeHeaderFilters();
        unlockColumnWidths('#employee-table');
        if (typeof applyEmployeeColumnVisibility === 'function') applyEmployeeColumnVisibility();
        renderEmployeeList(allEmployees);
        if (typeof applyEmployeeColumnVisibility === 'function') applyEmployeeColumnVisibility();
        lockColumnWidths('#employee-table');
        if (typeof applyEmployeeFreeze === 'function') applyEmployeeFreeze();
        filterEmployees();
        populateEmployeeSelects();
        if (typeof adjustTableContainerHeights === 'function') adjustTableContainerHeights();
        loadEmployeeLeaveBalances().then(() => {
            renderEmployeeList(allEmployees);
            if (typeof applyEmployeeColumnVisibility === 'function') applyEmployeeColumnVisibility();
            if (typeof applyEmployeeFreeze === 'function') applyEmployeeFreeze();
            filterEmployees();
            if (typeof adjustTableContainerHeights === 'function') adjustTableContainerHeights();
        });
    } catch (error) {
        console.error('Error loading employees:', error);
        showTableError('employees-table-body', 'Error loading employees.');
    }
    if (typeof adjustTableContainerHeights === 'function') setTimeout(adjustTableContainerHeights, 100);
}

async function loadEmployeeLeaveBalances() {
    employeeLeaveBalances = {};
    if (!allEmployees || allEmployees.length === 0) return;
    try {
        const promises = allEmployees.map(emp =>
            fetch(`${API_BASE}/employee-leave-balance/${emp.id}`)
                .then(r => r.json())
                .then(balances => { employeeLeaveBalances[emp.id] = balances; })
                .catch(() => { employeeLeaveBalances[emp.id] = []; })
        );
        await Promise.all(promises);
    } catch (error) {
        console.error('Error loading leave balances:', error);
    }
}

async function loadEmployeeExpiryWarnings() {
    try {
        const response = await fetch(`${API_BASE}/employee-documents/expiry-warnings`);
        const warnings = await response.json();
        employeeExpiryWarnings = {};
        warnings.forEach(w => {
            if (!employeeExpiryWarnings[w.employee_id]) employeeExpiryWarnings[w.employee_id] = [];
            employeeExpiryWarnings[w.employee_id].push(w);
        });
    } catch (error) {
        console.error('Error loading expiry warnings:', error);
    }
}

function showExpiryWarnings(employeeId) {
    const warnings = employeeExpiryWarnings[employeeId];
    if (!warnings || warnings.length === 0) return;
    const emp = allEmployees.find(e => e.id === employeeId);
    const empName = emp ? `${emp.first_name} ${emp.last_name}` : 'Employee';

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const rows = warnings.map(w => {
        const expiry = new Date(w.expiry_date);
        expiry.setHours(0, 0, 0, 0);
        const diffDays = Math.ceil((expiry - today) / (1000 * 60 * 60 * 24));
        const statusClass = diffDays < 0 ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800';
        const statusText = diffDays < 0 ? `Expired (${Math.abs(diffDays)} days ago)` : `${diffDays} days left`;
        return `<tr>
            <td class="px-3 py-2 text-sm">${w.document_type}</td>
            <td class="px-3 py-2 text-sm">${formatDate(w.expiry_date)}</td>
            <td class="px-3 py-2 text-sm"><span class="px-2 py-0.5 text-xs rounded-full ${statusClass}">${statusText}</span></td>
        </tr>`;
    }).join('');

    let modal = document.getElementById('expiry-warnings-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'expiry-warnings-modal';
        modal.className = 'modal fixed inset-0 bg-black bg-opacity-50 items-center justify-center z-50';
        document.body.appendChild(modal);
    }
    modal.innerHTML = `
        <div class="bg-white rounded-lg shadow-xl w-full max-w-lg max-h-[80vh] overflow-y-auto">
            <div class="p-6">
                <div class="flex justify-between items-center mb-4">
                    <h3 class="text-lg font-semibold text-orange-600"><i class="fas fa-exclamation-triangle mr-2"></i>Document Expiry Warnings</h3>
                    <button onclick="document.getElementById('expiry-warnings-modal').classList.remove('active')" class="text-gray-400 hover:text-gray-600"><i class="fas fa-times"></i></button>
                </div>
                <p class="text-sm text-gray-600 mb-4">The following documents for <strong>${empName}</strong> are expiring soon or already expired:</p>
                <table class="w-full">
                    <thead class="bg-gray-50">
                        <tr>
                            <th class="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Document Type</th>
                            <th class="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Expiry Date</th>
                            <th class="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-gray-200">${rows}</tbody>
                </table>
                <div class="mt-4 flex justify-end">
                    <button onclick="document.getElementById('expiry-warnings-modal').classList.remove('active')" class="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700">Close</button>
                </div>
            </div>
        </div>
    `;
    modal.classList.add('active');
}

let allEmployeePositions = [];

async function loadEmployeeDropdowns() {
    try {
        // Load departments from HR Settings
        const deptResponse = await fetch(`${API_BASE}/departments`);
        const departments = await deptResponse.json();
        const deptSelect = document.getElementById('employee-department');
        if (deptSelect) {
            deptSelect.innerHTML = '<option value="">Select Department</option>' +
                departments.map(dept => `<option value="${dept.id}">${dept.name}</option>`).join('');
        }

        // Load positions from HR Settings (includes departments array from junction table)
        const posResponse = await fetch(`${API_BASE}/positions`);
        const positions = await posResponse.json();
        allEmployeePositions = positions;
        const posSelect = document.getElementById('employee-position');
        if (posSelect) {
            posSelect.innerHTML = '<option value="">Select Position</option>' +
                positions.map(pos => `<option value="${pos.id}">${pos.name}</option>`).join('');
        }

        // Load employee statuses from HR Settings
        const statusResponse = await fetch(`${API_BASE}/employee-statuses`);
        const statuses = await statusResponse.json();
        const statusSelect = document.getElementById('employee-status');
        if (statusSelect) {
            statusSelect.innerHTML = '<option value="">Select Status</option>' +
                statuses.map(status => `<option value="${status.id}">${status.name}</option>`).join('');
        }

        // Load nationalities from HR Settings
        const natResponse = await fetch(`${API_BASE}/nationalities`);
        const nationalities = await natResponse.json();
        const natSelect = document.getElementById('employee-nationality');
        if (natSelect) {
            natSelect.innerHTML = '<option value="">Select Nationality</option>' +
                nationalities.map(nat => `<option value="${nat.id}">${nat.name}</option>`).join('');
        }

        // Load remuneration types from HR Settings
        const remResponse = await fetch(`${API_BASE}/remuneration-types`);
        const remunerationTypes = await remResponse.json();
        const remSelect = document.getElementById('employee-remuneration-type');
        if (remSelect) {
            remSelect.innerHTML = '<option value="">Select Remuneration Type</option>' +
                remunerationTypes.map(rt => `<option value="${rt.id}">${rt.name}</option>`).join('');
        }

        // Load cascading location data and populate country select
        await ensureCascadingLocationData();
        populateCascadingCountrySelect('employee-country');
        const locationSelect = document.getElementById('employee-location');
        const sublocationSelect = document.getElementById('employee-sublocation');
        if (locationSelect) locationSelect.innerHTML = '<option value="">Select Location</option>';
        if (sublocationSelect) sublocationSelect.innerHTML = '<option value="">Select Sublocation / Business Type</option>';
        // Store leave types globally for entitlement rows
        const leaveTypesResponse = await fetch(`${API_BASE}/leave-types`);
        window.employeeLeaveTypesOptions = await leaveTypesResponse.json();
    } catch (error) {
        console.error('Error loading employee dropdowns:', error);
    }
}

function filterPositionsByDepartment(deptId) {
    const posSelect = document.getElementById('employee-position');
    if (!posSelect) return;
    const currentVal = posSelect.value;
    let filtered;
    if (!deptId) {
        filtered = allEmployeePositions;
    } else {
        filtered = allEmployeePositions.filter(pos =>
            (pos.departments || []).some(d => d.id == deptId)
        );
    }
    posSelect.innerHTML = '<option value="">Select Position</option>' +
        filtered.map(pos => `<option value="${pos.id}">${pos.name}</option>`).join('');
    if (currentVal && [...posSelect.options].some(o => o.value === currentVal)) {
        posSelect.value = currentVal;
    }
}

function getLeaveTypeOptionsHtml(selected = '', additionalTypes = []) {
    const types = window.employeeLeaveTypesOptions || [];
    const allTypes = new Set([...types.map(lt => lt.name), ...additionalTypes]);
    const sortedTypes = Array.from(allTypes).sort();
    return '<option value="">Select Leave Type</option>' +
        sortedTypes.map(lt => `<option value="${lt}" ${lt === selected ? 'selected' : ''}>${lt}</option>`).join('');
}

function addLeaveEntitlementRow(data = null) {
    const container = document.getElementById('leave-entitlements-container');
    const row = document.createElement('div');
    row.className = 'flex gap-2 items-center leave-entitlement-row';
    const additionalTypes = data && data.leave_type ? [data.leave_type] : [];
    row.innerHTML = `
        <select class="leave-ent-type flex-1 px-2 py-1.5 border rounded text-sm">
            ${getLeaveTypeOptionsHtml(data ? data.leave_type : '', additionalTypes)}
        </select>
        <input type="number" class="leave-ent-days w-16 px-2 py-1.5 border rounded text-sm" placeholder="Days" min="0" value="${data ? data.days_count : ''}">
        <select class="leave-ent-condition w-20 px-2 py-1.5 border rounded text-sm">
            <option value="after" ${data && data.condition_type === 'after' ? 'selected' : ''}>after</option>
            <option value="in" ${data && data.condition_type === 'in' ? 'selected' : ''}>in</option>
            <option value="per" ${data && data.condition_type === 'per' ? 'selected' : ''}>per</option>
            <option value="every" ${data && data.condition_type === 'every' ? 'selected' : ''}>every</option>
        </select>
        <input type="number" class="leave-ent-months w-16 px-2 py-1.5 border rounded text-sm" placeholder="Count" min="0" value="${data ? data.months_count : ''}">
        <select class="leave-ent-period w-20 px-2 py-1.5 border rounded text-sm">
            <option value="months" ${!data || !data.period_type || data.period_type === 'months' ? 'selected' : ''}>months</option>
            <option value="weeks" ${data && data.period_type === 'weeks' ? 'selected' : ''}>weeks</option>
            <option value="days" ${data && data.period_type === 'days' ? 'selected' : ''}>days</option>
        </select>
        <button type="button" onclick="this.parentElement.remove()" class="px-2 py-1 bg-red-500 text-white rounded text-sm hover:bg-red-600"><i class="fas fa-trash"></i></button>
    `;
    container.appendChild(row);
}

function getLeaveEntitlements() {
    const rows = document.querySelectorAll('.leave-entitlement-row');
    const entitlements = [];
    rows.forEach(row => {
        const leave_type = row.querySelector('.leave-ent-type').value;
        const days_count = row.querySelector('.leave-ent-days').value;
        const condition_type = row.querySelector('.leave-ent-condition').value;
        const months_count = row.querySelector('.leave-ent-months').value;
        const period_type = row.querySelector('.leave-ent-period').value;
        if (leave_type && days_count && months_count) {
            entitlements.push({ leave_type, days_count: parseInt(days_count), condition_type, months_count: parseInt(months_count), period_type });
        }
    });
    return entitlements;
}

async function loadLeaveEntitlementsForEmployee(employeeId) {
    const container = document.getElementById('leave-entitlements-container');
    container.innerHTML = '';
    if (!employeeId) return;
    try {
        const response = await fetch(`${API_BASE}/employee-leave-entitlements/${employeeId}`);
        const entitlements = await response.json();
        entitlements.forEach(ent => addLeaveEntitlementRow(ent));
    } catch (error) {
        console.error('Error loading leave entitlements:', error);
    }
}

function renderEmployees() {
    populateEmployeeHeaderFilters();
    unlockColumnWidths('#employee-table');
    if (typeof applyEmployeeColumnVisibility === 'function') applyEmployeeColumnVisibility();
    renderEmployeeList(allEmployees);
    if (typeof applyEmployeeColumnVisibility === 'function') applyEmployeeColumnVisibility();
    lockColumnWidths('#employee-table');
    if (typeof applyEmployeeFreeze === 'function') applyEmployeeFreeze();
}

// ===== Excel-style Header Filter System =====
const EMPLOYEE_HEADER_FILTER_COLS = [
    'name', 'employee_id', 'department', 'position',
    'country', 'location', 'subbusiness', 'nationality', 'status'
];
let employeeHeaderFilterState = {};

function getEmployeeColumnValue(emp, col) {
    switch (col) {
        case 'name': return `${emp.first_name || ''} ${emp.last_name || ''}`.trim() || '-';
        case 'employee_id': return emp.employee_id || '-';
        case 'department': return emp.department || '-';
        case 'position': return emp.position || '-';
        case 'country': return emp.country_name || '-';
        case 'location': return emp.location_type_name || '-';
        case 'subbusiness': return [emp.sub_location_name, emp.business_type_name, emp.business_unit_code].filter(Boolean).join(' - ') || '-';
        case 'nationality': return emp.nationality || '-';
        case 'status': return emp.status || '-';
        default: return '-';
    }
}

function populateEmployeeHeaderFilters() {
    EMPLOYEE_HEADER_FILTER_COLS.forEach(col => {
        const uniqueVals = [...new Set(allEmployees.map(e => getEmployeeColumnValue(e, col)))].sort();
        if (!employeeHeaderFilterState[col]) {
            employeeHeaderFilterState[col] = { selected: new Set(uniqueVals), allValues: uniqueVals };
        } else {
            const oldAllValues = employeeHeaderFilterState[col].allValues || [];
            employeeHeaderFilterState[col].allValues = uniqueVals;
            // Keep only valid selected values, add any new values
            const validSelected = new Set();
            uniqueVals.forEach(v => {
                // Keep if it was selected before
                if (employeeHeaderFilterState[col].selected.has(v)) {
                    validSelected.add(v);
                }
                // Also add if it's a new value (not in old allValues)
                // This ensures edited employees with new values remain visible
                if (!oldAllValues.includes(v)) {
                    validSelected.add(v);
                }
            });
            employeeHeaderFilterState[col].selected = validSelected;
        }
        renderEmployeeHeaderFilterCheckboxes(col);
        updateEmployeeHeaderFilterIcon(col);
    });
}

function renderEmployeeHeaderFilterCheckboxes(col) {
    const list = document.getElementById(`emp-header-checkbox-list-${col}`);
    if (!list) return;
    const state = employeeHeaderFilterState[col];
    const values = state.allValues;
    list.innerHTML = values.map(v => {
        const checked = state.selected.has(v) ? 'checked' : '';
        const displayVal = v === '-' ? '(blank)' : v;
        return `<label class="flex items-center px-3 py-2 hover:bg-gray-50 border-b text-sm cursor-pointer emp-header-cb-label" data-value="${v.replace(/"/g, '&quot;')}">
            <input type="checkbox" class="emp-header-cb mr-2" value="${v.replace(/"/g, '&quot;')}" ${checked} onchange="onEmployeeHeaderCheckboxChange('${col}')"> <span class="truncate">${displayVal}</span>
        </label>`;
    }).join('');
    const checkAll = document.getElementById(`emp-header-check-all-${col}`);
    if (checkAll) checkAll.checked = state.selected.size === state.allValues.length;
}

function toggleEmployeeHeaderFilter(col) {
    // Close all other dropdowns
    EMPLOYEE_HEADER_FILTER_COLS.forEach(c => {
        if (c !== col) {
            const d = document.getElementById(`emp-header-filter-${c}`);
            if (d) d.classList.add('hidden');
        }
    });
    const dropdown = document.getElementById(`emp-header-filter-${col}`);
    if (dropdown) {
        dropdown.classList.toggle('hidden');
        if (!dropdown.classList.contains('hidden')) {
            populateEmployeeHeaderFilterCheckboxes(col);
        }
    }
}

function populateEmployeeHeaderFilterCheckboxes(col) {
    const state = employeeHeaderFilterState[col];
    if (!state) return;
    const uniqueVals = [...new Set(allEmployees.map(e => getEmployeeColumnValue(e, col)))].sort();
    state.allValues = uniqueVals;
    renderEmployeeHeaderFilterCheckboxes(col);
}

function filterEmployeeHeaderList(col, search) {
    const searchLower = search.toLowerCase();
    const labels = document.querySelectorAll(`#emp-header-checkbox-list-${col} label`);
    labels.forEach(label => {
        const text = label.textContent.trim().toLowerCase();
        label.style.display = text.includes(searchLower) ? '' : 'none';
    });
}

function onEmployeeHeaderCheckAll(col) {
    const checkAll = document.getElementById(`emp-header-check-all-${col}`);
    const state = employeeHeaderFilterState[col];
    if (!state) return;
    if (checkAll.checked) {
        state.allValues.forEach(v => state.selected.add(v));
    } else {
        state.selected.clear();
    }
    renderEmployeeHeaderFilterCheckboxes(col);
    updateEmployeeHeaderFilterIcon(col);
    filterEmployees();
}

function onEmployeeHeaderCheckboxChange(col) {
    const state = employeeHeaderFilterState[col];
    if (!state) return;
    const checkboxes = document.querySelectorAll(`#emp-header-checkbox-list-${col} .emp-header-cb`);
    const checked = Array.from(checkboxes).filter(cb => cb.checked);
    const checkAll = document.getElementById(`emp-header-check-all-${col}`);
    if (checkAll) checkAll.checked = checked.length === checkboxes.length;
    state.selected = new Set(checked.map(cb => cb.value));
    updateEmployeeHeaderFilterIcon(col);
    filterEmployees();
}

function updateEmployeeHeaderFilterIcon(col) {
    const icon = document.querySelector(`.emp-header-filter-icon[data-col="${col}"]`);
    if (!icon) return;
    const state = employeeHeaderFilterState[col];
    if (state && state.selected.size < state.allValues.length) {
        icon.classList.add('text-yellow-500');
        icon.classList.remove('text-gray-400');
    } else {
        icon.classList.remove('text-yellow-500');
        icon.classList.add('text-gray-400');
    }
}

// Close header filter dropdowns on outside click
document.addEventListener('click', function(event) {
    EMPLOYEE_HEADER_FILTER_COLS.forEach(col => {
        const dropdown = document.getElementById(`emp-header-filter-${col}`);
        const btn = dropdown ? dropdown.parentElement.querySelector('button') : null;
        if (dropdown && btn && !dropdown.contains(event.target) && !btn.contains(event.target)) {
            dropdown.classList.add('hidden');
        }
    });
});

function renderEmployeeList(employees) {
    const tbody = document.getElementById('employees-table-body');
    const total = employees.length;
    const badge = document.getElementById('employee-count-badge');
    if (badge) badge.textContent = `(${total} employee${total !== 1 ? 's' : ''})`;

    tbody.innerHTML = employees.map((emp, index) => {
        const serial = total - index;
        const warnings = employeeExpiryWarnings[emp.id];
        const warningIcon = warnings && warnings.length > 0
            ? `<button onclick="showExpiryWarnings(${emp.id})" class="text-orange-500 hover:text-orange-700 ml-1 animate-pulse" title="${warnings.length} document(s) expiring soon"><i class="fas fa-exclamation-triangle"></i></button>`
            : '';
        const subBusiness = [emp.sub_location_name, emp.business_type_name, emp.business_unit_code].filter(Boolean).join(' - ') || '-';
        const isTerminated = emp.is_terminated === 1 || emp.is_terminated === true || emp.status === 'Terminated';
        const rowClass = isTerminated ? 'text-red-600' : '';
        return `
        <tr class="${rowClass}">
            <td data-col="serial" class="px-3 py-2 whitespace-nowrap text-gray-500 text-xs">${serial}</td>
            <td data-col="actions" class="px-3 py-2 whitespace-nowrap">
                <button onclick="viewEmployee(${emp.id})" class="text-green-600 hover:text-green-800 mr-2">
                    <i class="fas fa-eye"></i>
                </button>
                ${typeof getEditActionButton === 'function' ? getEditActionButton('employees', 'editEmployee', emp.id) : '<span style="color:red">NO_FN</span>'}
                ${typeof getDeleteActionButton === 'function' ? getDeleteActionButton('employees', 'deleteEmployee', emp.id) : '<span style="color:red">NO_FN</span>'}
            </td>
            <td data-col="employee_id" class="px-3 py-2 whitespace-nowrap">${emp.employee_id || '-'}</td>
            <td data-col="name" class="px-3 py-2 whitespace-nowrap">
                ${emp.photo_path ? `<img src="${emp.photo_path}" onclick="openPhotoLightbox('${emp.photo_path}')" class="w-8 h-8 rounded-full object-cover inline-block mr-2 align-middle cursor-pointer hover:opacity-80 transition">` : `<span class="w-8 h-8 rounded-full bg-gray-200 inline-flex items-center justify-center mr-2 align-middle text-gray-500 text-xs"><i class="fas fa-user"></i></span>`}${emp.first_name} ${emp.last_name}${warningIcon}
            </td>
            <td data-col="department" class="px-3 py-2 whitespace-nowrap">${emp.department || '-'}</td>
            <td data-col="position" class="px-3 py-2 whitespace-nowrap">${emp.position || '-'}</td>
            <td data-col="country" class="px-3 py-2 max-w-32 truncate" title="${emp.country_name || ''}">${emp.country_name || '-'}</td>
            <td data-col="location" class="px-3 py-2 max-w-32 truncate" title="${emp.location_type_name || ''}">${emp.location_type_name || '-'}</td>
            <td data-col="subbusiness" class="px-3 py-2 max-w-40 truncate" title="${subBusiness}">${subBusiness}</td>
            <td data-col="nationality" class="px-3 py-2 whitespace-nowrap">${emp.nationality || '-'}</td>
            <td data-col="status" class="px-3 py-2 whitespace-nowrap">
                <span class="px-2 py-0.5 text-xs rounded-full ${getEmployeeStatusColor(emp.status)}">${emp.status}</span>${emp.status === 'On Leave' && emp.leave_until ? `<span class="text-xs text-orange-600 ml-1">(${new Date(emp.leave_until + 'T00:00:00').toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })})</span>` : ''}
            </td>
            <td data-col="leavebalance" class="px-3 py-2 whitespace-nowrap text-xs">
                ${renderLeaveBalanceCell(emp.id)}
            </td>
            <td data-col="email" class="px-3 py-2 whitespace-nowrap text-xs">${emp.email || '-'}</td>
            <td data-col="phone" class="px-3 py-2 whitespace-nowrap text-xs">${emp.phone || '-'}</td>
            <td data-col="hiredate" class="px-3 py-2 whitespace-nowrap text-xs">${emp.hire_date || '-'}</td>
            <td data-col="remtype" class="px-3 py-2 whitespace-nowrap text-xs">${emp.remuneration_type || '-'}</td>
            <td data-col="remuneration" class="px-3 py-2 whitespace-nowrap text-xs">${emp.remuneration || '-'}</td>
            <td data-col="workhours" class="px-3 py-2 whitespace-nowrap text-xs">${emp.working_hours_per_day || '-'}</td>
            <td data-col="overtime" class="px-3 py-2 whitespace-nowrap text-xs">${emp.overtime_rate || '-'}</td>
            <td data-col="address" class="px-3 py-2 max-w-40 truncate text-xs" title="${emp.address || ''}">${emp.address || '-'}</td>
            <td data-col="emgcontact" class="px-3 py-2 whitespace-nowrap text-xs">${emp.emergency_contact || '-'}</td>
            <td data-col="emgphone" class="px-3 py-2 whitespace-nowrap text-xs">${emp.emergency_phone || '-'}</td>
        </tr>`;
    }).join('');

    if (typeof applyEmployeeColumnVisibility === 'function') applyEmployeeColumnVisibility();
}

function renderLeaveBalanceCell(empId) {
    const balances = employeeLeaveBalances[empId];
    if (!balances || balances.length === 0) return '<span class="text-gray-400">-</span>';
    const parts = balances.map(b => {
        const remaining = b.remaining || 0;
        const taken = b.taken || 0;
        const earned = b.earned || 0;
        const shortName = (b.leave_type || '').replace(/leave/i, '').trim().substring(0, 3);
        const color = remaining > 0 ? 'text-green-600' : (remaining < 0 ? 'text-red-600' : 'text-gray-400');
        return `<span class="${color}" title="${b.leave_type}: ${earned} earned, ${taken} taken, ${remaining} remaining">${shortName}: ${remaining}</span>`;
    });
    return parts.join('<span class="text-gray-300 mx-1">|</span>');
}

function populateEmployeeSelects() {
    const selects = ['maintenance-performed-by', 'maintenance-requested-by', 'uniform-distribution-employee', 'kitchen-delivery-received'];
    
    selects.forEach(selectId => {
        const select = document.getElementById(selectId);
        if (select) {
            const currentValue = select.value;
            if (Array.isArray(allEmployees)) {
                select.innerHTML = '<option value="">Select Employee</option>' + 
                    allEmployees.map(emp => `<option value="${emp.id}" data-name="${emp.first_name} ${emp.last_name}" data-employee-id="${emp.employee_id || ''}" data-department="${emp.department || ''}">${emp.first_name} ${emp.last_name} (${emp.employee_id || 'No ID'})</option>`).join('');
            } else {
                console.error('allEmployees is not an array:', allEmployees);
                select.innerHTML = '<option value="">Select Employee</option>';
            }
            select.value = currentValue;
        }
    });
}

function onEmployeeSelect() {
    const select = document.getElementById('uniform-distribution-employee');
    const selectedOption = select.options[select.selectedIndex];
    
    if (selectedOption.value) {
        document.getElementById('uniform-distribution-staff-name').value = selectedOption.dataset.name;
        document.getElementById('uniform-distribution-staff-id').value = selectedOption.dataset.employeeId;
        document.getElementById('uniform-distribution-department').value = selectedOption.dataset.department;
    } else {
        document.getElementById('uniform-distribution-staff-name').value = '';
        document.getElementById('uniform-distribution-staff-id').value = '';
        document.getElementById('uniform-distribution-department').value = '';
    }
}


async function openEmployeeModal(id = null) {
    const modal = document.getElementById('employee-modal');
    const form = document.getElementById('employee-form');
    const title = document.getElementById('employee-modal-title');
    
    form.reset();
    document.getElementById('employee-id').value = '';
    document.getElementById('employee-photo-preview').classList.add('hidden');
    document.getElementById('employee-photo-img').src = '';
    document.getElementById('leave-entitlements-container').innerHTML = '';
    document.getElementById('employee-documents-container').innerHTML = '';
    employeePhotoRemoved = false;
    
    // Load dropdowns first so existing values can be selected
    await loadEmployeeDropdowns();
    
    // Load document types for document rows
    try {
        const dtResponse = await fetch(`${API_BASE}/document-types`);
        employeeDocTypes = await dtResponse.json();
    } catch (error) {
        console.error('Error loading document types:', error);
        employeeDocTypes = [];
    }
    
    if (id) {
        const emp = allEmployees.find(e => e.id === id);
        if (emp) {
            title.textContent = 'Edit Employee';
            document.getElementById('employee-id').value = emp.id;
            document.getElementById('employee-employee-id').value = emp.employee_id || '';
            document.getElementById('employee-first-name').value = emp.first_name;
            document.getElementById('employee-last-name').value = emp.last_name;
            document.getElementById('employee-email').value = emp.email || '';
            document.getElementById('employee-phone').value = emp.phone || '';
            document.getElementById('employee-department').value = emp.department_id || '';
            filterPositionsByDepartment(emp.department_id || '');
            document.getElementById('employee-position').value = emp.position_id || '';
            await setCascadingLocationByAssignment(emp.location_id || '', 'employee-country', 'employee-location', 'employee-sublocation');
            document.getElementById('employee-hire-date').value = emp.hire_date || '';
            document.getElementById('employee-status').value = emp.employee_status_id || '';
            document.getElementById('employee-nationality').value = emp.nationality_id || '';
            document.getElementById('employee-address').value = emp.address || '';
            document.getElementById('employee-emergency-contact').value = emp.emergency_contact || '';
            document.getElementById('employee-emergency-phone').value = emp.emergency_phone || '';
            document.getElementById('employee-remuneration-type').value = emp.remuneration_type_id || '';
            document.getElementById('employee-remuneration').value = emp.remuneration || '';
            document.getElementById('employee-working-hours').value = emp.working_hours_per_day || 8;
            document.getElementById('employee-overtime-rate').value = emp.overtime_rate || 1;
            await loadLeaveEntitlementsForEmployee(emp.id);
            await loadEmployeeDocumentsForModal(emp.id);
            if (emp.photo_path) {
                document.getElementById('employee-photo-preview').classList.remove('hidden');
                document.getElementById('employee-photo-img').src = emp.photo_path;
            }
        }
    } else {
        title.textContent = 'Add Employee';
        try {
            const response = await fetch(`${API_BASE}/employees/next-id`);
            if (response.ok) {
                const data = await response.json();
                document.getElementById('employee-employee-id').value = data.next_id;
            }
        } catch (error) {
            console.error('Error fetching next employee ID:', error);
        }
    }
    
    modal.classList.add('active');
}

let employeePhotoRemoved = false;

function removeEmployeePhoto() {
    document.getElementById('employee-photo').value = '';
    document.getElementById('employee-photo-preview').classList.add('hidden');
    document.getElementById('employee-photo-img').src = '';
    employeePhotoRemoved = true;
}

function closeEmployeeModal() {
    employeePhotoRemoved = false;
    document.getElementById('employee-modal').classList.remove('active');
}

async function loadEmployeeDocumentsForModal(employeeId) {
    try {
        const response = await fetch(`${API_BASE}/employee-documents`);
        const allDocs = await response.json();
        const docs = allDocs.filter(d => d.employee_id === employeeId);
        
        const container = document.getElementById('employee-documents-container');
        container.innerHTML = '';
        
        if (docs.length > 0) {
            docs.forEach(doc => {
                const row = addEmployeeDocumentRow(true);
                row.querySelector('.emp-doc-row-type').value = doc.document_type;
                row.querySelector('.emp-doc-row-number').value = doc.document_number || '';
                row.querySelector('.emp-doc-row-issued').value = doc.issued_date || '';
                row.querySelector('.emp-doc-row-expiry').value = doc.expiry_date || '';
                
                // Add existing files as read-only info
                const filesList = row.querySelector('.emp-doc-row-files');
                if (doc.file_path) {
                    filesList.innerHTML = `
                        <div class="flex items-center gap-2 text-xs text-gray-600">
                            <i class="fas fa-file"></i>
                            <span>Existing file: ${doc.file_path.split('/').pop()}</span>
                        </div>
                    `;
                }
            });
        }
    } catch (error) {
        console.error('Error loading employee documents:', error);
    }
}

async function saveEmployeeDocuments(employeeId) {
    const container = document.getElementById('employee-documents-container');
    const rows = Array.from(container.children);
    
    for (const row of rows) {
        const docType = row.querySelector('.emp-doc-row-type').value;
        const docNumber = row.querySelector('.emp-doc-row-number').value;
        const issuedDate = row.querySelector('.emp-doc-row-issued').value;
        const expiryDate = row.querySelector('.emp-doc-row-expiry').value;
        const fileInputs = row.querySelectorAll('.emp-doc-file-input');
        
        if (!docType) continue; // Skip empty rows
        
        const formData = new FormData();
        formData.append('employee_id', employeeId);
        formData.append('document_type', docType);
        formData.append('document_number', docNumber);
        formData.append('issued_date', issuedDate);
        formData.append('expiry_date', expiryDate);
        
        // Add files
        fileInputs.forEach(input => {
            if (input.files && input.files[0]) {
                formData.append('files', input.files[0]);
            }
        });
        
        try {
            await fetch(`${API_BASE}/employee-documents`, {
                method: 'POST',
                body: formData
            });
        } catch (error) {
            console.error('Error saving employee document:', error);
        }
    }
}

async function loadBulkSettingsLeaveTypes() {
    try {
        const response = await fetch(`${API_BASE}/leave-types`);
        const leaveTypes = await response.json();
        const select = document.getElementById('bulk-leave-type');
        if (select) {
            select.innerHTML = '<option value="">Select Leave Type</option>';
            leaveTypes.forEach(lt => {
                const option = document.createElement('option');
                option.value = lt.name;
                option.textContent = lt.name;
                select.appendChild(option);
            });
        }
    } catch (error) {
        console.error('Error loading leave types:', error);
    }
}

async function applyBulkLeave() {
    const leaveType = document.getElementById('bulk-leave-type').value;
    const days = document.getElementById('bulk-leave-days').value;
    const condition = document.getElementById('bulk-leave-condition').value;
    const count = document.getElementById('bulk-leave-count').value;
    const period = document.getElementById('bulk-leave-period').value;

    if (!leaveType) {
        alert('Please select a leave type');
        return;
    }
    if (!days || !count) {
        alert('Please fill in all fields');
        return;
    }

    if (!confirm(`This will add "${leaveType}: ${days} day(s) ${condition} ${count} ${period}" to all employees. Existing entitlements for this leave type will be replaced. Continue?`)) {
        return;
    }

    await applyBulkLeaveEntitlement(leaveType, parseInt(days), condition, parseInt(count), period);
}

async function applyBulkLeaveEntitlement(leaveType, daysCount, conditionType, monthsCount, periodType) {
    try {
        const response = await fetch(`${API_BASE}/employees?_t=${Date.now()}`);
        const employees = await response.json();

        let successCount = 0;
        let errorCount = 0;

        for (const emp of employees) {
            try {
                // Fetch existing entitlements for this employee
                const existingEntResponse = await fetch(`${API_BASE}/employee-leave-entitlements/${emp.id}`);
                const existingEntitlements = existingEntResponse.ok ? await existingEntResponse.json() : [];
                
                // Remove existing entitlement for the same leave type (if exists)
                const filteredEntitlements = existingEntitlements.filter(ent => ent.leave_type !== leaveType);
                
                // Add the new entitlement
                filteredEntitlements.push({
                    leave_type: leaveType,
                    days_count: daysCount,
                    condition_type: conditionType,
                    months_count: monthsCount,
                    period_type: periodType
                });

                const entResponse = await fetch(`${API_BASE}/employee-leave-entitlements`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ employee_id: emp.id, entitlements: filteredEntitlements })
                });

                if (entResponse.ok) {
                    successCount++;
                } else {
                    errorCount++;
                }
            } catch (err) {
                console.error(`Error updating ${leaveType} for ${emp.employee_id}:`, err);
                errorCount++;
            }
        }

        alert(`${leaveType} update complete:\nSuccess: ${successCount}\nErrors: ${errorCount}`);
        
        // Refresh employee list and leave balances
        await loadEmployees();
    } catch (error) {
        console.error('Error in bulk leave update:', error);
        alert('Error updating leave entitlements: ' + error.message);
    }
}

async function saveEmployee(e) {
    e.preventDefault();
    const id = document.getElementById('employee-id').value;
    const firstName = document.getElementById('employee-first-name').value;
    const lastName = document.getElementById('employee-last-name').value;
    const remunerationType = document.getElementById('employee-remuneration-type').value;
    const remuneration = document.getElementById('employee-remuneration').value;

    if (!remunerationType) {
        alert('Remuneration Type is required');
        document.getElementById('employee-remuneration-type').focus();
        return;
    }
    if (!remuneration || parseFloat(remuneration) <= 0) {
        alert('Remuneration amount must be greater than 0');
        document.getElementById('employee-remuneration').focus();
        return;
    }

    const formData = new FormData();
    formData.append('employee_id', document.getElementById('employee-employee-id').value);
    formData.append('first_name', firstName);
    formData.append('last_name', lastName);
    formData.append('email', document.getElementById('employee-email').value);
    formData.append('phone', document.getElementById('employee-phone').value);
    const deptSelect = document.getElementById('employee-department');
    formData.append('department_id', deptSelect.value);
    formData.append('department', deptSelect.value ? (deptSelect.selectedOptions[0]?.text || '') : '');
    const posSelect = document.getElementById('employee-position');
    formData.append('position_id', posSelect.value);
    formData.append('position', posSelect.value ? (posSelect.selectedOptions[0]?.text || '') : '');
    formData.append('location_id', document.getElementById('employee-sublocation').value);
    formData.append('hire_date', document.getElementById('employee-hire-date').value);
    const statusSelect = document.getElementById('employee-status');
    formData.append('employee_status_id', statusSelect.value);
    formData.append('status', statusSelect.value ? (statusSelect.selectedOptions[0]?.text || '') : '');
    const natSelect = document.getElementById('employee-nationality');
    formData.append('nationality_id', natSelect.value);
    formData.append('nationality', natSelect.value ? (natSelect.selectedOptions[0]?.text || '') : '');
    formData.append('address', document.getElementById('employee-address').value);
    formData.append('emergency_contact', document.getElementById('employee-emergency-contact').value);
    formData.append('emergency_phone', document.getElementById('employee-emergency-phone').value);
    const remSelect = document.getElementById('employee-remuneration-type');
    formData.append('remuneration_type_id', remSelect.value);
    formData.append('remuneration_type', remSelect.value ? (remSelect.selectedOptions[0]?.text || '') : '');
    formData.append('remuneration', document.getElementById('employee-remuneration').value);
    formData.append('working_hours_per_day', document.getElementById('employee-working-hours').value);
    formData.append('overtime_rate', document.getElementById('employee-overtime-rate').value);
    
    const photoInput = document.getElementById('employee-photo');
    if (photoInput.files && photoInput.files[0]) {
        formData.append('photo', photoInput.files[0]);
    } else if (employeePhotoRemoved) {
        formData.append('existing_photo', '');
    } else if (id) {
        const emp = allEmployees.find(e => e.id == id);
        if (emp && emp.photo_path) {
            formData.append('existing_photo', emp.photo_path);
        }
    }
    
    try {
        const url = id ? `${API_BASE}/employees/${id}?manager_id=${currentModuleManager ? currentModuleManager.id : ''}` : `${API_BASE}/employees`;
        const method = id ? 'PUT' : 'POST';

        // For updates, fetch old record and old leave entitlements to compare changes
        let oldEmp = null;
        let oldLeaveEnts = [];
        if (id) {
            const [oldRes, oldLeaveRes] = await Promise.all([
                fetch(`${API_BASE}/employees/${id}`),
                fetch(`${API_BASE}/employee-leave-entitlements/${id}`)
            ]);
            if (oldRes.ok) oldEmp = await oldRes.json();
            if (oldLeaveRes.ok) oldLeaveEnts = await oldLeaveRes.json();
        }

        const response = await fetch(url, {
            method: method,
            body: formData
        });
        
        if (response.ok) {
            const result = await response.json();
            const employeeId = id || result.id;
            const action = id ? 'UPDATE' : 'CREATE';
            let details = `Employee: ${firstName} ${lastName}`;

            if (action === 'UPDATE' && oldEmp) {
                // Helpers to resolve dropdown IDs to human-readable labels
                const getSelectedText = (selectId) => {
                    const sel = document.getElementById(selectId);
                    if (!sel || !sel.value) return '';
                    return sel.selectedOptions[0] ? sel.selectedOptions[0].text.trim() : '';
                };
                const getOldLabel = (idField, textField, nameField, selectId) => {
                    if (oldEmp[nameField]) return oldEmp[nameField];
                    if (oldEmp[textField]) return oldEmp[textField];
                    if (oldEmp[idField]) {
                        const sel = document.getElementById(selectId);
                        if (sel) {
                            const opt = Array.from(sel.options).find(o => o.value === String(oldEmp[idField]));
                            if (opt) return opt.text.trim();
                        }
                    }
                    return '';
                };

                const newVals = {
                    employee_id: document.getElementById('employee-employee-id').value,
                    first_name: firstName,
                    last_name: lastName,
                    email: document.getElementById('employee-email').value,
                    phone: document.getElementById('employee-phone').value,
                    department: getSelectedText('employee-department'),
                    position: getSelectedText('employee-position'),
                    location_id: getSelectedText('employee-sublocation'),
                    hire_date: document.getElementById('employee-hire-date').value,
                    status: getSelectedText('employee-status'),
                    nationality: getSelectedText('employee-nationality'),
                    address: document.getElementById('employee-address').value,
                    emergency_contact: document.getElementById('employee-emergency-contact').value,
                    emergency_phone: document.getElementById('employee-emergency-phone').value,
                    remuneration_type: getSelectedText('employee-remuneration-type'),
                    remuneration: document.getElementById('employee-remuneration').value,
                    working_hours_per_day: document.getElementById('employee-working-hours').value,
                    overtime_rate: document.getElementById('employee-overtime-rate').value
                };
                const oldLabels = {
                    employee_id: oldEmp.employee_id || '',
                    first_name: oldEmp.first_name || '',
                    last_name: oldEmp.last_name || '',
                    email: oldEmp.email || '',
                    phone: oldEmp.phone || '',
                    department: getOldLabel('department_id', 'department', 'department_name', 'employee-department'),
                    position: getOldLabel('position_id', 'position', 'position_name', 'employee-position'),
                    location_id: getOldLabel('location_id', 'location_id', 'location_name', 'employee-sublocation'),
                    hire_date: oldEmp.hire_date || '',
                    status: getOldLabel('employee_status_id', 'status', 'employee_status_name', 'employee-status'),
                    nationality: getOldLabel('nationality_id', 'nationality', 'nationality_name', 'employee-nationality'),
                    address: oldEmp.address || '',
                    emergency_contact: oldEmp.emergency_contact || '',
                    emergency_phone: oldEmp.emergency_phone || '',
                    remuneration_type: getOldLabel('remuneration_type_id', 'remuneration_type', 'remuneration_type_name', 'employee-remuneration-type'),
                    remuneration: oldEmp.remuneration || '',
                    working_hours_per_day: oldEmp.working_hours_per_day || '',
                    overtime_rate: oldEmp.overtime_rate || ''
                };
                const fieldLabels = {
                    employee_id: 'Employee ID', first_name: 'First Name', last_name: 'Last Name',
                    email: 'Email', phone: 'Phone', department: 'Department', position: 'Position',
                    location_id: 'Location', hire_date: 'Hire Date', status: 'Status',
                    nationality: 'Nationality', address: 'Address', emergency_contact: 'Emergency Contact',
                    emergency_phone: 'Emergency Phone', remuneration_type: 'Remuneration Type',
                    remuneration: 'Remuneration', working_hours_per_day: 'Working Hours/Day',
                    overtime_rate: 'Overtime Rate'
                };
                const changes = [];
                for (const [field, label] of Object.entries(fieldLabels)) {
                    const oldVal = String(oldLabels[field] || '').trim();
                    const newVal = String(newVals[field] || '').trim();
                    if (oldVal !== newVal) {
                        changes.push(`${label}: ${oldVal || '-'} → ${newVal || '-'}`);
                    }
                }
                // Photo change detection
                const oldPhoto = oldEmp.photo_path || '';
                let newPhoto = '';
                if (photoInput.files && photoInput.files[0]) {
                    newPhoto = '(new photo uploaded)';
                } else if (employeePhotoRemoved) {
                    newPhoto = '';
                } else if (oldEmp.photo_path) {
                    newPhoto = oldPhoto;
                }
                if (oldPhoto !== newPhoto && (photoInput.files && photoInput.files[0] || employeePhotoRemoved)) {
                    changes.push(`Photo: ${oldPhoto ? '(photo existed)' : '-'} → ${newPhoto || '(removed)'}`);
                }
                // Leave entitlements change detection
                const newEntitlements = getLeaveEntitlements();
                const formatEnt = e => `${e.leave_type}: ${e.days_count}d ${e.condition_type} ${e.months_count}${e.period_type || 'months'}`;
                const oldEntStr = oldLeaveEnts.map(formatEnt).sort().join('; ');
                const newEntStr = newEntitlements.map(formatEnt).sort().join('; ');
                if (oldEntStr !== newEntStr) {
                    if (oldEntStr && newEntStr) {
                        changes.push(`Leave Entitlements: ${oldEntStr} → ${newEntStr}`);
                    } else if (!oldEntStr && newEntStr) {
                        changes.push(`Leave Entitlements: - → ${newEntStr}`);
                    } else {
                        changes.push(`Leave Entitlements: ${oldEntStr} → (removed)`);
                    }
                }
                details += changes.length > 0 ? ` | Changes: ${changes.join(', ')}` : ' | No changes detected';
            } else if (action === 'CREATE') {
                const empIdVal = document.getElementById('employee-employee-id').value;
                if (empIdVal) details += ` | Employee ID: ${empIdVal}`;
                if (photoInput.files && photoInput.files[0]) details += ` | Photo: (uploaded)`;
            }
            await logAudit(action, 'employees', 'Employee', employeeId, details);
            
            // Save leave entitlements
            const entitlements = getLeaveEntitlements();
            await fetch(`${API_BASE}/employee-leave-entitlements`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ employee_id: employeeId, entitlements })
            });
            
            // Save documents
            await saveEmployeeDocuments(employeeId);
            
            closeEmployeeModal();
            // Fetch fresh employee data directly with cache-busting
            const empResponse = await fetch(`${API_BASE}/employees?_t=${Date.now()}`);
            allEmployees = await empResponse.json();
            await loadEmployeeExpiryWarnings();
            await loadEmployeeLeaveBalances();
            filterEmployees();
            loadDashboardStats();
        } else {
            const errData = await response.json().catch(() => ({}));
            alert('Error saving employee: ' + (errData.error || response.statusText || 'Unknown error'));
        }
    } catch (error) {
        console.error('Error saving employee:', error);
        alert('Error saving employee: ' + error.message);
    }
    document.dispatchEvent(new CustomEvent('employeeListChanged'));
}

async function deleteEmployee(id) {
    if (!currentModuleManager) {
        alert('Please select a module manager.');
        return;
    }
    const emp = allEmployees.find(e => e.id === id);
    if (confirm('Are you sure you want to delete this employee?')) {
        try {
            const response = await fetch(`${API_BASE}/employees/${id}?manager_id=${currentModuleManager.id}`, { method: 'DELETE' });
            if (response.ok) {
                await logAudit('DELETE', 'employees', 'Employee', id, `Employee: ${emp?.first_name} ${emp?.last_name || 'Unknown'}`);
                loadEmployees();
                loadDashboardStats();
                document.dispatchEvent(new CustomEvent('employeeListChanged'));
            }
        } catch (error) {
            console.error('Error deleting employee:', error);
        }
    }
}

function editEmployee(id) {
    openEmployeeModal(id);
}

async function viewEmployee(id) {
    try {
        const response = await fetch(`${API_BASE}/employees/${id}`);
        const emp = await response.json();

        const photoHtml = emp.photo_path
            ? `<img src="${emp.photo_path}" class="w-20 h-20 object-cover rounded-lg border">`
            : `<div class="w-20 h-20 rounded-lg border bg-gray-100 flex items-center justify-center text-gray-400 text-2xl"><i class="fas fa-user"></i></div>`;

        // Load leave entitlements for view
        let leaveEnts = [];
        try {
            const leaveResponse = await fetch(`${API_BASE}/employee-leave-entitlements/${emp.id}`);
            leaveEnts = await leaveResponse.json();
        } catch (error) {
            console.error('Error loading leave entitlements:', error);
        }

        const leaveEntHtml = leaveEnts.length > 0
            ? `<div class="bg-indigo-50 rounded-lg p-4">
                <div class="text-xs font-semibold text-indigo-600 uppercase tracking-wide mb-3">Leave Entitlements</div>
                <div class="space-y-1.5 text-sm">
                    ${leaveEnts.map(le => `<div><span class="text-gray-500 text-xs">${le.leave_type}:</span> <span class="font-medium">${le.days_count} days ${le.condition_type} ${le.months_count} ${le.period_type || 'months'}</span></div>`).join('')}
                </div>
            </div>`
            : '';

        // Load leave balance for view modal
        let leaveBalances = [];
        try {
            const balResponse = await fetch(`${API_BASE}/employee-leave-balance/${emp.id}`);
            leaveBalances = await balResponse.json();
        } catch (error) {
            console.error('Error loading leave balances:', error);
        }

        const leaveBalHtml = leaveBalances.length > 0
            ? `<div class="bg-teal-50 rounded-lg p-4">
                <div class="text-xs font-semibold text-teal-600 uppercase tracking-wide mb-3">Leave Balance</div>
                <table class="w-full text-sm">
                    <thead>
                        <tr class="text-xs text-gray-500">
                            <th class="text-left pb-2">Leave Type</th>
                            <th class="text-center pb-2">Earned</th>
                            <th class="text-center pb-2">Taken</th>
                            <th class="text-center pb-2">Remaining</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${leaveBalances.map(b => {
                            const remaining = b.remaining || 0;
                            const remColor = remaining > 0 ? 'text-green-600 font-semibold' : (remaining < 0 ? 'text-red-600 font-semibold' : 'text-gray-400');
                            return `<tr class="border-t border-teal-100">
                                <td class="py-1.5 text-xs">${b.leave_type}</td>
                                <td class="py-1.5 text-center text-xs">${b.earned || 0}</td>
                                <td class="py-1.5 text-center text-xs">${b.taken || 0}</td>
                                <td class="py-1.5 text-center text-xs ${remColor}">${remaining}</td>
                            </tr>`;
                        }).join('')}
                    </tbody>
                </table>
            </div>`
            : '';

        const terminationHtml = (emp.is_terminated || emp.status === 'Terminated')
            ? `<div class="bg-red-50 rounded-lg p-4">
                <div class="text-xs font-semibold text-red-600 uppercase tracking-wide mb-3">Termination Details</div>
                <div class="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                    <div><span class="text-gray-500 text-xs">Date:</span> <span class="font-medium block">${emp.termination_date ? formatDate(emp.termination_date) : 'N/A'}</span></div>
                    <div><span class="text-gray-500 text-xs">Reason:</span> <span class="font-medium block">${emp.termination_reason || 'N/A'}</span></div>
                </div>
            </div>`
            : '';

        const statusColor = emp.status === 'Active' ? 'bg-green-100 text-green-800' : emp.status === 'Terminated' ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-800';

        function cell(label, value) {
            return `<div><span class="text-gray-500 text-xs">${label}:</span> <span class="font-medium block text-sm">${value || '-'}</span></div>`;
        }

        const detailsHtml = `
                <!-- Header -->
                <div class="px-5 py-4 border-b flex-shrink-0 flex justify-between items-center">
                    <div class="flex items-center gap-4">
                        ${photoHtml}
                        <div>
                            <h3 class="text-lg font-semibold">${emp.first_name || ''} ${emp.last_name || ''}</h3>
                            <p class="text-xs text-gray-500">${emp.employee_id || 'No Employee ID'} &nbsp;|&nbsp; <span class="px-2 py-0.5 text-xs rounded-full ${statusColor}">${emp.status || '-'}</span></p>
                        </div>
                    </div>
                    <button onclick="closeEmployeeViewModal()" class="text-gray-400 hover:text-gray-600"><i class="fas fa-times text-lg"></i></button>
                </div>

                <!-- Scrollable body -->
                <div class="p-5 overflow-y-auto flex-1 min-h-0 space-y-4">

                    <!-- Personal Info -->
                    <div class="bg-blue-50 rounded-lg p-4">
                        <div class="text-xs font-semibold text-blue-600 uppercase tracking-wide mb-3">Personal Information</div>
                        <div class="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                            <div class="col-span-2"><span class="text-gray-500 text-xs">Full Name:</span> <span class="font-semibold text-base block">${emp.first_name || '-'} ${emp.last_name || ''}</span></div>
                            ${cell('Employee ID', emp.employee_id)}
                            ${cell('Nationality', emp.nationality)}
                            ${cell('Email', emp.email)}
                            ${cell('Phone', emp.phone)}
                            ${cell('Hire Date', formatDate(emp.hire_date))}
                        </div>
                    </div>

                    <!-- Job & Location -->
                    <div class="grid grid-cols-2 gap-4">
                        <div class="bg-orange-50 rounded-lg p-4">
                            <div class="text-xs font-semibold text-orange-600 uppercase tracking-wide mb-3">Employment</div>
                            <div class="space-y-2 text-sm">
                                ${cell('Department', emp.department)}
                                ${cell('Position', emp.position)}
                                ${cell('Status', emp.status)}
                            </div>
                        </div>
                        <div class="bg-green-50 rounded-lg p-4">
                            <div class="text-xs font-semibold text-green-600 uppercase tracking-wide mb-3">Location</div>
                            <div class="space-y-2 text-sm">
                                ${cell('Country', emp.country_name)}
                                ${cell('Location', emp.location_type_name)}
                                ${cell('Sub Location', [emp.sub_location_name, emp.business_type_name, emp.business_unit_code].filter(Boolean).join(' - '))}
                            </div>
                        </div>
                    </div>

                    <!-- Remuneration -->
                    <div class="bg-purple-50 rounded-lg p-4">
                        <div class="text-xs font-semibold text-purple-600 uppercase tracking-wide mb-3">Remuneration</div>
                        <div class="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                            ${cell('Remuneration Type', emp.remuneration_type)}
                            ${cell('Remuneration', emp.remuneration)}
                            ${cell('Working Hours/Day', emp.working_hours_per_day || 8)}
                            ${cell('Overtime Rate', (emp.overtime_rate || 1) + 'x')}
                        </div>
                    </div>

                    <!-- Emergency & Address -->
                    <div class="bg-gray-50 rounded-lg p-4">
                        <div class="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Emergency & Address</div>
                        <div class="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                            ${cell('Emergency Contact', emp.emergency_contact)}
                            ${cell('Emergency Phone', emp.emergency_phone)}
                            <div class="col-span-2"><span class="text-gray-500 text-xs">Address:</span> <span class="font-medium block text-sm">${emp.address || '-'}</span></div>
                        </div>
                    </div>

                    ${terminationHtml}
                    ${leaveEntHtml}
                    ${leaveBalHtml}

                    <div class="text-xs text-gray-400">Created: ${formatDate(emp.created_at)} &nbsp;|&nbsp; Updated: ${formatDate(emp.updated_at)}</div>
                </div>

                <!-- Footer actions -->
                <div class="px-5 py-3 border-t flex-shrink-0 flex flex-wrap justify-between items-center gap-3">
                    <div class="flex items-center gap-4 text-sm">
                        <label class="flex items-center gap-1.5"><input type="checkbox" id="emp-print-details" checked> Details</label>
                        <label class="flex items-center gap-1.5"><input type="checkbox" id="emp-print-leave"> Leave Entitlements</label>
                        <label class="flex items-center gap-1.5"><input type="checkbox" id="emp-print-transfers"> Transfers</label>
                        <label class="flex items-center gap-1.5"><input type="checkbox" id="emp-print-documents"> Documents</label>
                        <label class="flex items-center gap-1.5"><input type="checkbox" id="emp-print-all" onchange="toggleEmpPrintAll(this)"> All</label>
                    </div>
                    <div class="flex flex-wrap gap-2">
                        <button onclick="printEmployeeReport(${emp.id})" class="px-3 py-1.5 text-sm rounded bg-purple-600 text-white hover:bg-purple-700 transition whitespace-nowrap"><i class="fas fa-print mr-1"></i>Print / PDF</button>
                        <button onclick="viewEmployeeTransferHistory(${emp.id})" class="px-3 py-1.5 text-sm rounded bg-green-600 text-white hover:bg-green-700 transition whitespace-nowrap"><i class="fas fa-exchange-alt mr-1"></i>Transfer History</button>
                        <button onclick="viewEmployeeLeaveHistory(${emp.id})" class="px-3 py-1.5 text-sm rounded bg-orange-600 text-white hover:bg-orange-700 transition whitespace-nowrap"><i class="fas fa-calendar-alt mr-1"></i>Leave History</button>
                        <button onclick="viewEmployeeDocumentHistory(${emp.id})" class="px-3 py-1.5 text-sm rounded bg-blue-600 text-white hover:bg-blue-700 transition whitespace-nowrap"><i class="fas fa-file-alt mr-1"></i>Documents</button>
                        <button onclick="closeEmployeeViewModal()" class="px-3 py-1.5 text-sm rounded border hover:bg-gray-100 transition whitespace-nowrap">Close</button>
                    </div>
                </div>
        `;

        let viewModal = document.getElementById('employee-view-modal');
        if (!viewModal) {
            viewModal = document.createElement('div');
            viewModal.id = 'employee-view-modal';
            viewModal.className = 'modal fixed inset-0 bg-black bg-opacity-50 items-center justify-center z-50';
            document.body.appendChild(viewModal);
        }
        viewModal.innerHTML = `<div class="bg-white rounded-lg shadow-xl w-full max-w-2xl my-6 flex flex-col overflow-hidden" style="max-height:80vh;">${detailsHtml}</div>`;
        viewModal.classList.add('active');
    } catch (error) {
        console.error('Error viewing employee:', error);
    }
}

function closeEmployeeViewModal() {
    const modal = document.getElementById('employee-view-modal');
    if (modal) modal.classList.remove('active');
}

function toggleEmpPrintAll(checkbox) {
    const checked = checkbox.checked;
    document.getElementById('emp-print-details').checked = checked;
    document.getElementById('emp-print-leave').checked = checked;
    document.getElementById('emp-print-transfers').checked = checked;
    document.getElementById('emp-print-documents').checked = checked;
}

async function printEmployeeReport(employeeId) {
    try {
        const printDetails = document.getElementById('emp-print-details').checked;
        const printLeave = document.getElementById('emp-print-leave').checked;
        const printTransfers = document.getElementById('emp-print-transfers').checked;
        const printDocuments = document.getElementById('emp-print-documents').checked;

        if (!printDetails && !printLeave && !printTransfers && !printDocuments) {
            alert('Please select at least one section to print.');
            return;
        }

        const [empResponse, leaveResponse, transferResponse, docResponse] = await Promise.all([
            fetch(`${API_BASE}/employees/${employeeId}`),
            printLeave ? fetch(`${API_BASE}/employee-leave-entitlements/${employeeId}`) : Promise.resolve({ json: () => [] }),
            printTransfers ? fetch(`${API_BASE}/employee-transfers`) : Promise.resolve({ json: () => [] }),
            printDocuments ? fetch(`${API_BASE}/employee-documents`) : Promise.resolve({ json: () => [] })
        ]);

        const emp = await empResponse.json();
        const leaveEnts = await leaveResponse.json();
        const allTransfers = await transferResponse.json();
        const allDocs = await docResponse.json();
        const transfers = allTransfers.filter(t => t.emp_db_id === employeeId);
        const documents = allDocs.filter(d => d.employee_id === employeeId);

        const today = formatDate(new Date());
        const reportTitle = `Employee Report - ${emp.first_name} ${emp.last_name}`;

        const photoHtml = emp.photo_path
            ? `<img src="${emp.photo_path}" style="width: 100px; height: 100px; object-fit: cover; border-radius: 8px; border: 1px solid #e2e8f0;">`
            : '';

        const detailRows = [
            ['Employee ID', emp.employee_id || 'N/A'],
            ['First Name', emp.first_name || 'N/A'],
            ['Last Name', emp.last_name || 'N/A'],
            ['Email', emp.email || 'N/A'],
            ['Phone', emp.phone || 'N/A'],
            ['Department', emp.department || 'N/A'],
            ['Position', emp.position || 'N/A'],
            ['Country', emp.country_name || 'N/A'],
            ['Location', emp.location_type_name || 'N/A'],
            ['Sub Location', [emp.sub_location_name, emp.business_type_name, emp.business_unit_code].filter(Boolean).join(' - ') || 'N/A'],
            ['Nationality', emp.nationality || 'N/A'],
            ['Hire Date', formatDate(emp.hire_date)],
            ['Status', emp.status || 'N/A'],
            ['Address', emp.address || 'N/A'],
            ['Emergency Contact', emp.emergency_contact || 'N/A'],
            ['Emergency Phone', emp.emergency_phone || 'N/A'],
            ['Remuneration Type', emp.remuneration_type || 'N/A'],
            ['Remuneration', emp.remuneration || 'N/A'],
            ['Working Hours/Day', emp.working_hours_per_day || '8'],
            ['Overtime Rate', (emp.overtime_rate || 1) + 'x'],
            ['Assigned To', emp.assigned_to_name || emp.assigned_to || 'N/A'],
            ['Created At', formatDate(emp.created_at)],
            ['Updated At', formatDate(emp.updated_at)]
        ];

        let reportHtml = `<div style="font-family: Arial, sans-serif; color: #333;">`;

        // Employee Details section
        if (printDetails) {
            reportHtml += `
                <div style="margin-bottom: 25px;">
                    <h3 style="background: #edf2f7; padding: 8px; color: #2d3748; border-left: 4px solid #4a5568; margin-bottom: 12px;">Employee Details</h3>
                    ${photoHtml ? `<div style="margin-bottom: 12px;">${photoHtml}</div>` : ''}
                    <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
                        ${detailRows.map(r => `<tr><td style="border: 1px solid #e2e8f0; padding: 6px; width: 30%;"><strong>${r[0]}</strong></td><td style="border: 1px solid #e2e8f0; padding: 6px;">${r[1]}</td></tr>`).join('')}
                    </table>
                </div>
            `;

            // Termination details if applicable
            if (emp.is_terminated || emp.status === 'Terminated') {
                reportHtml += `
                    <div style="margin-bottom: 25px;">
                        <h3 style="background: #fed7d7; padding: 8px; color: #c53030; border-left: 4px solid #e53e3e; margin-bottom: 12px;">Termination Details</h3>
                        <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
                            <tr><td style="border: 1px solid #e2e8f0; padding: 6px; width: 30%;"><strong>Termination Date</strong></td><td style="border: 1px solid #e2e8f0; padding: 6px;">${emp.termination_date ? formatDate(emp.termination_date) : 'N/A'}</td></tr>
                            <tr><td style="border: 1px solid #e2e8f0; padding: 6px; width: 30%;"><strong>Reason</strong></td><td style="border: 1px solid #e2e8f0; padding: 6px;">${emp.termination_reason || 'N/A'}</td></tr>
                        </table>
                    </div>
                `;
            }
        }

        // Leave Entitlements
        if (printLeave && leaveEnts && leaveEnts.length > 0) {
            reportHtml += `
                <div style="margin-bottom: 25px;">
                    <h3 style="background: #edf2f7; padding: 8px; color: #2d3748; border-left: 4px solid #3182ce; margin-bottom: 12px;">Leave Entitlements</h3>
                    <table style="width: 100%; border-collapse: collapse; font-size: 11px;">
                        <thead><tr style="background: #edf2f7;">
                            <th style="border: 1px solid #e2e8f0; padding: 6px; text-align: left;">Leave Type</th>
                            <th style="border: 1px solid #e2e8f0; padding: 6px; text-align: left;">Days</th>
                            <th style="border: 1px solid #e2e8f0; padding: 6px; text-align: left;">Condition</th>
                            <th style="border: 1px solid #e2e8f0; padding: 6px; text-align: left;">Months</th>
                            <th style="border: 1px solid #e2e8f0; padding: 6px; text-align: left;">Period</th>
                        </tr></thead>
                        <tbody>
                            ${leaveEnts.map(le => `<tr>
                                <td style="border: 1px solid #e2e8f0; padding: 6px;">${le.leave_type || '-'}</td>
                                <td style="border: 1px solid #e2e8f0; padding: 6px;">${le.days_count || '-'}</td>
                                <td style="border: 1px solid #e2e8f0; padding: 6px;">${le.condition_type || '-'}</td>
                                <td style="border: 1px solid #e2e8f0; padding: 6px;">${le.months_count || '-'}</td>
                                <td style="border: 1px solid #e2e8f0; padding: 6px;">${le.period_type || 'months'}</td>
                            </tr>`).join('')}
                        </tbody>
                    </table>
                </div>
            `;
        }

        // Transfer History
        if (printTransfers) {
            reportHtml += `
                <div style="margin-bottom: 25px;">
                    <h3 style="background: #edf2f7; padding: 8px; color: #2d3748; border-left: 4px solid #38a169; margin-bottom: 12px;">Transfer History</h3>
            `;
            if (transfers.length === 0) {
                reportHtml += '<p style="font-size: 12px; color: #718096;">No transfer records found.</p>';
            } else {
                reportHtml += `
                    <table style="width: 100%; border-collapse: collapse; font-size: 11px;">
                        <thead><tr style="background: #edf2f7;">
                            <th style="border: 1px solid #e2e8f0; padding: 6px; text-align: left;">Serial</th>
                            <th style="border: 1px solid #e2e8f0; padding: 6px; text-align: left;">Date</th>
                            <th style="border: 1px solid #e2e8f0; padding: 6px; text-align: left;">From</th>
                            <th style="border: 1px solid #e2e8f0; padding: 6px; text-align: left;">To</th>
                            <th style="border: 1px solid #e2e8f0; padding: 6px; text-align: left;">Reason</th>
                            <th style="border: 1px solid #e2e8f0; padding: 6px; text-align: left;">Remuneration</th>
                        </tr></thead>
                        <tbody>
                            ${transfers.map(t => `<tr>
                                <td style="border: 1px solid #e2e8f0; padding: 6px;">${t.transfer_serial_number || '-'}</td>
                                <td style="border: 1px solid #e2e8f0; padding: 6px;">${formatDate(t.transfer_date)}</td>
                                <td style="border: 1px solid #e2e8f0; padding: 6px;">${t.from_country_name || '-'}${t.from_location_type_name ? ' - ' + t.from_location_type_name : ''}</td>
                                <td style="border: 1px solid #e2e8f0; padding: 6px;">${t.to_country_name || '-'}${t.to_location_type_name ? ' - ' + t.to_location_type_name : ''}</td>
                                <td style="border: 1px solid #e2e8f0; padding: 6px;">${t.reason || '-'}</td>
                                <td style="border: 1px solid #e2e8f0; padding: 6px;">${t.new_remuneration_type || '-'} ${t.new_remuneration || ''}</td>
                            </tr>`).join('')}
                        </tbody>
                    </table>
                `;
            }
            reportHtml += '</div>';
        }

        // Documents
        if (printDocuments) {
            reportHtml += `
                <div style="margin-bottom: 25px;">
                    <h3 style="background: #edf2f7; padding: 8px; color: #2d3748; border-left: 4px solid #805ad5; margin-bottom: 12px;">Documents</h3>
            `;
            if (documents.length === 0) {
                reportHtml += '<p style="font-size: 12px; color: #718096;">No documents found.</p>';
            } else {
                reportHtml += `
                    <table style="width: 100%; border-collapse: collapse; font-size: 11px;">
                        <thead><tr style="background: #edf2f7;">
                            <th style="border: 1px solid #e2e8f0; padding: 6px; text-align: left;">Document Type</th>
                            <th style="border: 1px solid #e2e8f0; padding: 6px; text-align: left;">Issued Date</th>
                            <th style="border: 1px solid #e2e8f0; padding: 6px; text-align: left;">Expiry Date</th>
                        </tr></thead>
                        <tbody>
                            ${documents.map(d => `<tr>
                                <td style="border: 1px solid #e2e8f0; padding: 6px;">${d.document_type || '-'}</td>
                                <td style="border: 1px solid #e2e8f0; padding: 6px;">${formatDate(d.issued_date)}</td>
                                <td style="border: 1px solid #e2e8f0; padding: 6px;">${formatDate(d.expiry_date)}</td>
                            </tr>`).join('')}
                        </tbody>
                    </table>
                `;
            }
            reportHtml += '</div>';
        }

        reportHtml += '</div>';

        const printWindow = window.open('', '_blank');
        if (!printWindow) {
            alert('Popup blocked. Please allow popups for this site to print the report.');
            return;
        }

        printWindow.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>${reportTitle}</title>
                <style>
                    body { font-family: Arial, sans-serif; padding: 20px; color: #333; }
                    h2 { margin: 0; color: #2d3748; }
                    h3 { background: #edf2f7; padding: 8px; color: #2d3748; border-left: 4px solid #4a5568; margin-bottom: 12px; }
                    table { width: 100%; border-collapse: collapse; font-size: 12px; margin-bottom: 12px; }
                    th, td { border: 1px solid #e2e8f0; padding: 6px; text-align: left; }
                    th { background: #edf2f7; }
                    .header { text-align: center; margin-bottom: 20px; border-bottom: 2px solid #4a5568; padding-bottom: 10px; }
                    .header p { margin: 5px 0; font-size: 12px; color: #718096; }
                </style>
            </head>
            <body>
                <div class="header">
                    <h2><span style="color:#1a2e5a;font-weight:800;">Ops</span><span style="color:#e87722;font-weight:800;">Master</span></h2>
                    <p>${reportTitle}</p>
                    <p>Generated on ${today}</p>
                </div>
                ${reportHtml}
                <script>
                    window.onload = function() { setTimeout(function() { window.print(); }, 300); };
                </script>
            </body>
            </html>
        `);
        printWindow.document.close();
    } catch (error) {
        console.error('Error printing employee report:', error);
        alert('Error generating PDF. Please try again.');
    }
}

async function viewEmployeeTransferHistory(employeeId) {
    try {
        const response = await fetch(`${API_BASE}/employee-transfers`);
        const allTransfers = await response.json();
        const transfers = allTransfers.filter(t => t.emp_db_id === employeeId);

        let historyHtml = `<div class="p-6">
            <h3 class="text-xl font-semibold mb-4"><i class="fas fa-exchange-alt mr-2 text-green-600"></i>Transfer History</h3>`;

        if (transfers.length === 0) {
            historyHtml += '<p class="text-gray-500 text-center py-4">No transfer records found</p>';
        } else {
            historyHtml += `<table class="w-full text-sm">
                <thead class="bg-gray-50">
                    <tr>
                        <th class="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Serial</th>
                        <th class="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                        <th class="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Reason</th>
                        <th class="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Remuneration</th>
                        <th class="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">View</th>
                    </tr>
                </thead>
                <tbody class="divide-y divide-gray-200">
                    ${transfers.map(t => {
                        const remChanged = t.prev_remuneration !== t.new_remuneration || t.prev_remuneration_type !== t.new_remuneration_type;
                        const remText = t.new_remuneration_type ? `${t.new_remuneration_type}: ${t.new_remuneration || '0'}` : '-';
                        return `<tr>
                        <td class="px-3 py-2">${t.transfer_serial_number || '-'}</td>
                        <td class="px-3 py-2">${formatDate(t.transfer_date)}</td>
                        <td class="px-3 py-2">${t.reason || '-'}</td>
                        <td class="px-3 py-2 ${remChanged ? 'text-orange-600 font-medium' : ''}">${remText}</td>
                        <td class="px-3 py-2"><button onclick="viewEmployeeTransfer(${t.id})" class="text-green-600 hover:text-green-800"><i class="fas fa-eye"></i></button></td>
                    </tr>`;
                    }).join('')}
                </tbody>
            </table>`;
        }

        historyHtml += `<div class="mt-4 flex justify-end gap-3">
            <button onclick="viewEmployee(${employeeId})" class="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"><i class="fas fa-arrow-left mr-1"></i>Back</button>
            <button onclick="closeEmployeeViewModal()" class="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700">Close</button>
        </div></div>`;

        const viewModal = document.getElementById('employee-view-modal');
        viewModal.innerHTML = `<div class="bg-white rounded-lg shadow-xl w-full max-w-2xl my-6 max-h-[80vh] overflow-y-auto">${historyHtml}</div>`;
    } catch (error) {
        console.error('Error loading employee transfer history:', error);
    }
}

async function viewEmployeeLeaveHistory(employeeId) {
    try {
        const [recordsRes, empRes, entRes] = await Promise.all([
            fetch(`${API_BASE}/leave-records`),
            fetch(`${API_BASE}/employees/${employeeId}`),
            fetch(`${API_BASE}/employee-leave-entitlements/${employeeId}`)
        ]);
        const allRecords = await recordsRes.json();
        const emp = empRes.ok ? await empRes.json() : {};
        const entitlements = entRes.ok ? await entRes.json() : [];
        const leaveRecords = allRecords.filter(r => r.employee_id === employeeId);
        const hireDate = emp && emp.hire_date;

        let historyHtml = `<div class="p-6">
            <h3 class="text-xl font-semibold mb-4"><i class="fas fa-calendar-alt mr-2 text-orange-600"></i>Leave History</h3>`;

        if (leaveRecords.length === 0) {
            historyHtml += '<p class="text-gray-500 text-center py-4">No leave records found</p>';
        } else {
            // Group consecutive dates with same status into ranges
            const statusInfo = {
                'medical-leave': { label: 'Medical Leave', color: 'bg-purple-100 text-purple-800' },
                'paid-leave': { label: 'Paid Leave', color: 'bg-yellow-100 text-yellow-800' },
                'compassionate-leave': { label: 'Compassionate Leave', color: 'bg-orange-100 text-orange-800' },
                'unpaid-leave': { label: 'Unpaid Leave', color: 'bg-red-100 text-red-800' }
            };

            const sortedRecords = leaveRecords.sort((a, b) => a.date.localeCompare(b.date));
            const groupedEntries = leaveGroupConsecutivePeriods(sortedRecords);

            // ---- Chained accrual (shared logic from utils.js): earned per window, carrying balance forward ----
            const periodCalc = new Map(); // key: status|from|to -> {earned, prevCarryForward, accumulated, carryForward}
            const liveStatusList = []; // per leave type: live earning from last return date to today
            const byType = {};
            groupedEntries.forEach(e => {
                if (!byType[e.status]) byType[e.status] = [];
                byType[e.status].push(e);
            });
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const todayStr = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0') + '-' + String(today.getDate()).padStart(2, '0');

            Object.entries(byType).forEach(([status, periods]) => {
                periods.sort((a, b) => a.from.localeCompare(b.from));
                const ent = entitlements.find(en => leaveMapTypeToStatus(en.leave_type) === status);
                const entitled = ent ? (ent.days_count || 0) : 0;
                const months = ent ? (ent.months_count || 0) : 0;
                const period = ent ? (ent.period_type || 'months') : 'months';

                const { periodCalc: chainCalc, live } = leaveComputeChain(periods, {
                    hireDate, entitled, months, period, unpaidRecords: sortedRecords, asOfDate: todayStr,
                    expireAtCycleEnd: status === 'medical-leave'
                });
                chainCalc.forEach((calc, subKey) => periodCalc.set(status + '|' + subKey, calc));
                if (live) liveStatusList.push({ status, entitled, ...live });
            });

            // Sort by from date descending
            groupedEntries.sort((a, b) => b.from.localeCompare(a.from));

            const statusLabelsList = {
                'medical-leave': 'Medical Leave',
                'paid-leave': 'Paid Leave',
                'compassionate-leave': 'Compassionate Leave',
                'unpaid-leave': 'Unpaid Leave'
            };

            if (liveStatusList.length > 0) {
                historyHtml += `<div class="bg-teal-50 border border-teal-100 rounded-lg p-3 mb-4 space-y-1.5">
                    <div class="text-xs font-semibold text-teal-700 uppercase tracking-wide mb-1"><i class="fas fa-clock mr-1"></i>Live Balance (as of today)</div>
                    ${liveStatusList.map(ls => {
                        const label = statusLabelsList[ls.status] || ls.status;
                        const balColor = ls.liveBalance < 0 ? 'text-red-600' : 'text-green-700';
                        return `<div class="text-xs text-gray-700 flex flex-wrap items-center gap-1">
                            <span class="font-semibold">${label}:</span>
                            <span>${formatDate(ls.windowStart)} &ndash; ${formatDate(todayStr)}</span>
                            <span>&rarr; earned <span class="font-semibold">${ls.liveEarned}</span></span>
                            <span>+ prev. balance <span class="font-semibold ${ls.prevCarryForward < 0 ? 'text-red-600' : ''}">${ls.prevCarryForward}</span></span>
                            <span>= current balance <span class="font-bold ${balColor}">${ls.liveBalance}</span></span>
                        </div>`;
                    }).join('')}
                </div>`;
            }

            historyHtml += `<table class="w-full text-sm">
                <thead class="bg-gray-50">
                    <tr>
                        <th class="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase" title="Period actually on duty: from hire date or previous return-to-work date, up to the day before this leave started">Duty Period</th>
                        <th class="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Leave Type</th>
                        <th class="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase" title="Days earned since the previous return-to-work date (or hire date for the first record)">Earned</th>
                        <th class="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase" title="Balance brought forward from the previous leave record">Prev. Balance</th>
                        <th class="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase">Accumulated</th>
                        <th class="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">From</th>
                        <th class="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">To</th>
                        <th class="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase">Days</th>
                        <th class="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase" title="Accumulated - Days Taken">Carry Forward</th>
                        <th class="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Notes</th>
                    </tr>
                </thead>
                <tbody class="divide-y divide-gray-200">
                    ${groupedEntries.map(e => {
                        const si = statusInfo[e.status] || { label: e.status, color: 'bg-gray-100' };
                        const calc = periodCalc.get(e.status + '|' + e.from + '|' + e.to) || { earned: '-', prevCarryForward: '-', accumulated: '-', carryForward: '-', windowStart: null };
                        const cfNegative = typeof calc.carryForward === 'number' && calc.carryForward < 0;
                        const prevNegative = typeof calc.prevCarryForward === 'number' && calc.prevCarryForward < 0;
                        let dutyPeriod = '-';
                        if (calc.windowStart) {
                            const dayBefore = new Date(e.from + 'T00:00:00');
                            dayBefore.setDate(dayBefore.getDate() - 1);
                            const dayBeforeStr = dayBefore.getFullYear() + '-' + String(dayBefore.getMonth() + 1).padStart(2, '0') + '-' + String(dayBefore.getDate()).padStart(2, '0');
                            dutyPeriod = `${formatDate(calc.windowStart)} &ndash; ${formatDate(dayBeforeStr)}`;
                        }
                        return `<tr>
                            <td class="px-3 py-2 whitespace-nowrap text-xs text-gray-600">${dutyPeriod}</td>
                            <td class="px-3 py-2"><span class="px-2 py-0.5 text-xs rounded-full ${si.color}">${si.label}</span></td>
                            <td class="px-3 py-2 text-center">${calc.earned}</td>
                            <td class="px-3 py-2 text-center ${prevNegative ? 'text-red-600' : ''}">${calc.prevCarryForward}</td>
                            <td class="px-3 py-2 text-center font-semibold">${calc.accumulated}</td>
                            <td class="px-3 py-2">${formatDate(e.from)}</td>
                            <td class="px-3 py-2">${formatDate(e.to)}</td>
                            <td class="px-3 py-2 text-center font-semibold">${e.days}</td>
                            <td class="px-3 py-2 text-center font-semibold ${cfNegative ? 'text-red-600' : 'text-green-600'}">${calc.carryForward}</td>
                            <td class="px-3 py-2 text-gray-500 max-w-xs truncate" title="${e.notes}">${e.notes || '-'}</td>
                        </tr>`;
                    }).join('')}
                </tbody>
            </table>`;
        }

        historyHtml += `<div class="mt-4 flex justify-end gap-3">
            <button onclick="viewEmployee(${employeeId})" class="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"><i class="fas fa-arrow-left mr-1"></i>Back</button>
            <button onclick="closeEmployeeViewModal()" class="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700">Close</button>
        </div></div>`;

        const viewModal = document.getElementById('employee-view-modal');
        viewModal.innerHTML = `<div class="bg-white rounded-lg shadow-xl w-full max-w-5xl my-6 max-h-[80vh] overflow-y-auto">${historyHtml}</div>`;
    } catch (error) {
        console.error('Error loading employee leave history:', error);
    }
}

async function viewEmployeeDocumentHistory(employeeId) {
    try {
        const response = await fetch(`${API_BASE}/employee-documents`);
        const allDocs = await response.json();
        const docs = allDocs.filter(d => d.employee_id === employeeId);

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        let historyHtml = `<div class="p-6">
            <h3 class="text-xl font-semibold mb-4"><i class="fas fa-file-alt mr-2 text-blue-600"></i>Employee Documents</h3>`;

        if (docs.length === 0) {
            historyHtml += '<p class="text-gray-500 text-center py-4">No documents found</p>';
        } else {
            historyHtml += `<table class="w-full text-sm">
                <thead class="bg-gray-50">
                    <tr>
                        <th class="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                        <th class="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Issued Date</th>
                        <th class="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Expiry Date</th>
                        <th class="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                        <th class="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">File</th>
                    </tr>
                </thead>
                <tbody class="divide-y divide-gray-200">
                    ${docs.map(d => {
                        let statusHtml = '<span class="px-2 py-0.5 text-xs rounded-full bg-green-100 text-green-800">Valid</span>';
                        if (d.expiry_date) {
                            const expiry = new Date(d.expiry_date);
                            expiry.setHours(0, 0, 0, 0);
                            const diffDays = Math.ceil((expiry - today) / (1000 * 60 * 60 * 24));
                            if (diffDays < 0) statusHtml = '<span class="px-2 py-0.5 text-xs rounded-full bg-red-100 text-red-800">Expired</span>';
                            else if (diffDays <= 30) statusHtml = '<span class="px-2 py-0.5 text-xs rounded-full bg-yellow-100 text-yellow-800">Expiring Soon</span>';
                        }
                        const fileHtml = d.document_path ? d.document_path.split(',').map((p, i) => `<a href="${p.trim()}" target="_blank" class="text-blue-600 hover:underline text-xs">File ${i+1}</a>`).join(' ') : '-';
                        return `<tr>
                            <td class="px-3 py-2">${d.document_type || '-'}</td>
                            <td class="px-3 py-2">${formatDate(d.issued_date)}</td>
                            <td class="px-3 py-2">${formatDate(d.expiry_date)}</td>
                            <td class="px-3 py-2">${statusHtml}</td>
                            <td class="px-3 py-2">${fileHtml}</td>
                        </tr>`;
                    }).join('')}
                </tbody>
            </table>`;
        }

        historyHtml += `<div class="mt-4 flex justify-end gap-3">
            <button onclick="viewEmployee(${employeeId})" class="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"><i class="fas fa-arrow-left mr-1"></i>Back</button>
            <button onclick="closeEmployeeViewModal()" class="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700">Close</button>
        </div></div>`;

        const viewModal = document.getElementById('employee-view-modal');
        viewModal.innerHTML = `<div class="bg-white rounded-lg shadow-xl w-full max-w-2xl my-6 max-h-[80vh] overflow-y-auto">${historyHtml}</div>`;
    } catch (error) {
        console.error('Error loading employee documents:', error);
    }
}

// Terminate Employee Functions
let allTerminatedEmployees = [];

async function loadTerminatedEmployees() {
    showTableLoading('terminated-employees-table-body', 'Loading terminated employees...');
    try {
        const response = await fetch(`${API_BASE}/employees`);
        const employees = await response.json();
        allTerminatedEmployees = employees.filter(emp => emp.is_terminated === 1 || emp.status === 'Terminated');
        populateTerminatedEmployeeFilters();
        filterTerminatedEmployees();
    } catch (error) {
        console.error('Error loading terminated employees:', error);
        showTableError('terminated-employees-table-body', 'Error loading terminated employees.');
    }
}

function populateTerminatedEmployeeFilters() {
    if (!allTerminatedEmployees || allTerminatedEmployees.length === 0) return;

    const countrySelect = document.getElementById('terminated-employee-filter-country');
    if (countrySelect) {
        const uniqueCountries = [...new Set(allTerminatedEmployees.map(e => e.country_name).filter(c => c))].sort();
        countrySelect.innerHTML = '<option value="">All Countries</option>' +
            uniqueCountries.map(c => `<option value="${c}">${c}</option>`).join('');
    }

    const locationSelect = document.getElementById('terminated-employee-filter-location');
    if (locationSelect) {
        locationSelect.innerHTML = '<option value="">All Locations</option>';
    }

    const checkboxList = document.getElementById('terminated-employee-sublocation-checkbox-list');
    if (checkboxList) checkboxList.innerHTML = '';
    const checkAll = document.getElementById('terminated-employee-sublocation-check-all');
    if (checkAll) checkAll.checked = true;
    const label = document.getElementById('terminated-employee-filter-sublocation-label');
    if (label) label.textContent = 'All Sublocations';
}

function onTerminatedEmployeeFilterCountryChange() {
    const country = document.getElementById('terminated-employee-filter-country').value;
    const locationSelect = document.getElementById('terminated-employee-filter-location');

    if (country && allTerminatedEmployees && allTerminatedEmployees.length) {
        const locationNames = [...new Set(allTerminatedEmployees
            .filter(e => e.country_name === country)
            .map(e => e.location_type_name)
            .filter(loc => loc))].sort();
        locationSelect.innerHTML = '<option value="">All Locations</option>' +
            locationNames.map(loc => `<option value="${loc}">${loc}</option>`).join('');
    } else {
        locationSelect.innerHTML = '<option value="">All Locations</option>';
    }

    const checkboxList = document.getElementById('terminated-employee-sublocation-checkbox-list');
    if (checkboxList) checkboxList.innerHTML = '';
    const checkAll = document.getElementById('terminated-employee-sublocation-check-all');
    if (checkAll) checkAll.checked = true;
    const label = document.getElementById('terminated-employee-filter-sublocation-label');
    if (label) label.textContent = 'All Sublocations';

    filterTerminatedEmployees();
}

function onTerminatedEmployeeFilterLocationChange() {
    const country = document.getElementById('terminated-employee-filter-country').value;
    const location = document.getElementById('terminated-employee-filter-location').value;

    if (country && location && allTerminatedEmployees && allTerminatedEmployees.length) {
        const subOptions = [...new Set(allTerminatedEmployees
            .filter(e => e.country_name === country && e.location_type_name === location)
            .map(e => [e.sub_location_name, e.business_type_name, e.business_unit_code].filter(Boolean).join(' - '))
            .filter(sub => sub))].sort();

        const checkboxList = document.getElementById('terminated-employee-sublocation-checkbox-list');
        if (checkboxList) {
            checkboxList.innerHTML = subOptions.map(sub => `
                <label class="flex items-center px-3 py-2 hover:bg-gray-50 border-b text-sm cursor-pointer">
                    <input type="checkbox" class="terminated-employee-sublocation-checkbox mr-2" value="${sub.replace(/"/g, '&quot;')}" onchange="onTerminatedEmployeeSublocationCheckboxChange()"> <span>${sub}</span>
                </label>
            `).join('');
        }
    } else {
        const checkboxList = document.getElementById('terminated-employee-sublocation-checkbox-list');
        if (checkboxList) checkboxList.innerHTML = '';
    }

    const checkAll = document.getElementById('terminated-employee-sublocation-check-all');
    if (checkAll) checkAll.checked = true;
    const label = document.getElementById('terminated-employee-filter-sublocation-label');
    if (label) label.textContent = 'All Sublocations';

    filterTerminatedEmployees();
}

function toggleTerminatedEmployeeSublocationCheckboxDropdown() {
    const dropdown = document.getElementById('terminated-employee-filter-sublocation-dropdown');
    if (dropdown) dropdown.classList.toggle('hidden');
}

function filterTerminatedEmployeeSublocationCheckboxes() {
    const search = (document.getElementById('terminated-employee-sublocation-search')?.value || '').toLowerCase();
    const labels = document.querySelectorAll('#terminated-employee-sublocation-checkbox-list label');
    labels.forEach(label => {
        const text = label.textContent.trim().toLowerCase();
        label.style.display = text.includes(search) ? '' : 'none';
    });
}

function onTerminatedEmployeeSublocationCheckAllChange() {
    const checkAll = document.getElementById('terminated-employee-sublocation-check-all');
    const checkboxes = document.querySelectorAll('.terminated-employee-sublocation-checkbox');
    checkboxes.forEach(cb => cb.checked = checkAll.checked);
    updateTerminatedEmployeeSublocationFilterLabel();
    filterTerminatedEmployees();
}

function onTerminatedEmployeeSublocationCheckboxChange() {
    const checkboxes = document.querySelectorAll('.terminated-employee-sublocation-checkbox');
    const checkedCount = Array.from(checkboxes).filter(cb => cb.checked).length;
    const checkAll = document.getElementById('terminated-employee-sublocation-check-all');
    if (checkAll) checkAll.checked = checkboxes.length > 0 && checkedCount === checkboxes.length;
    updateTerminatedEmployeeSublocationFilterLabel();
    filterTerminatedEmployees();
}

function updateTerminatedEmployeeSublocationFilterLabel() {
    const label = document.getElementById('terminated-employee-filter-sublocation-label');
    if (!label) return;
    const checkboxes = document.querySelectorAll('.terminated-employee-sublocation-checkbox');
    const checked = Array.from(checkboxes).filter(cb => cb.checked);
    if (checked.length === 0 || checked.length === checkboxes.length) {
        label.textContent = 'All Sublocations';
    } else if (checked.length === 1) {
        label.textContent = checked[0].nextElementSibling.textContent.trim();
    } else {
        label.textContent = checked.length + ' selected';
    }
}

function getSelectedTerminatedEmployeeSublocationIds() {
    const checkboxes = document.querySelectorAll('.terminated-employee-sublocation-checkbox');
    const allChecked = document.getElementById('terminated-employee-sublocation-check-all');
    if (allChecked && allChecked.checked) return [];
    return Array.from(checkboxes).filter(cb => cb.checked).map(cb => cb.value);
}

function filterTerminatedEmployees() {
    if (!Array.isArray(allTerminatedEmployees)) return;
    const search = (document.getElementById('terminated-employee-search')?.value || '').toLowerCase();
    const country = document.getElementById('terminated-employee-filter-country')?.value || '';
    const location = document.getElementById('terminated-employee-filter-location')?.value || '';
    const selectedSubIds = getSelectedTerminatedEmployeeSublocationIds();

    let filtered = allTerminatedEmployees;
    if (country) filtered = filtered.filter(e => e.country_name === country);
    if (location) filtered = filtered.filter(e => e.location_type_name === location);
    if (selectedSubIds.length > 0) {
        filtered = filtered.filter(e => selectedSubIds.includes(
            [e.sub_location_name, e.business_type_name, e.business_unit_code].filter(Boolean).join(' - ')
        ));
    }
    if (search) {
        filtered = filtered.filter(e =>
            (e.first_name && e.first_name.toLowerCase().includes(search)) ||
            (e.last_name && e.last_name.toLowerCase().includes(search)) ||
            (e.employee_id && e.employee_id.toLowerCase().includes(search))
        );
    }
    renderTerminatedEmployees(filtered);
}

document.addEventListener('click', function(event) {
    const btn = document.getElementById('terminated-employee-filter-sublocation-btn');
    const dropdown = document.getElementById('terminated-employee-filter-sublocation-dropdown');
    if (btn && dropdown && !btn.contains(event.target) && !dropdown.contains(event.target)) {
        dropdown.classList.add('hidden');
    }
});

function renderTerminatedEmployees(employees) {
    const tbody = document.getElementById('terminated-employees-table-body');
    if (!tbody) return;
    if (!employees || !Array.isArray(employees) || employees.length === 0) {
        tbody.innerHTML = '<tr><td colspan="11" class="px-6 py-4 text-center text-gray-500">No terminated employees found</td></tr>';
        return;
    }
    const total = employees.length;
    tbody.innerHTML = employees.map((emp, index) => {
        const subBiz = [emp.sub_location_name, emp.business_type_name, emp.business_unit_code].filter(Boolean).join(' - ') || '-';
        return `
        <tr>
            <td class="px-6 py-4 whitespace-nowrap text-gray-500 text-sm">${total - index}</td>
            <td class="px-6 py-4 whitespace-nowrap">${emp.first_name} ${emp.last_name}</td>
            <td class="px-6 py-4 whitespace-nowrap">${emp.employee_id || '-'}</td>
            <td class="px-6 py-4 whitespace-nowrap">${emp.department || '-'}</td>
            <td class="px-6 py-4 whitespace-nowrap">${emp.position || '-'}</td>
            <td class="px-6 py-4 whitespace-nowrap">${emp.country_name || '-'}</td>
            <td class="px-6 py-4 whitespace-nowrap">${emp.location_type_name || '-'}</td>
            <td class="px-6 py-4 whitespace-nowrap">${subBiz}</td>
            <td class="px-6 py-4 whitespace-nowrap">${formatDate(emp.termination_date)}</td>
            <td class="px-6 py-4 whitespace-nowrap">${emp.termination_reason || '-'}</td>
            <td class="px-6 py-4 whitespace-nowrap">
                <button onclick="viewEmployee(${emp.id})" class="text-green-600 hover:text-green-800 mr-2" title="View">
                    <i class="fas fa-eye"></i>
                </button>
                ${hasTablePermission('terminated-employees', 'edit') ? `<button onclick="viewTerminationDetails(${emp.id})" class="text-blue-600 hover:text-blue-800 mr-2" title="Edit Termination"><i class="fas fa-edit"></i></button>` : ''}
                ${hasTablePermission('terminated-employees', 'delete') ? `<button onclick="deleteEmployee(${emp.id})" class="text-red-600 hover:text-red-800" title="Delete"><i class="fas fa-trash"></i></button>` : ''}
            </td>
        </tr>
    `}).join('');
}

async function viewTerminationDetails(id) {
    try {
        const response = await fetch(`${API_BASE}/employees/${id}`);
        const emp = await response.json();

        const photoHtml = emp.photo_path
            ? `<img src="${emp.photo_path}" class="w-16 h-16 object-cover rounded-lg border">`
            : `<div class="w-16 h-16 rounded-lg border bg-gray-100 flex items-center justify-center text-gray-400 text-xl"><i class="fas fa-user"></i></div>`;

        const detailsHtml = `
                <div class="px-5 py-4 border-b flex-shrink-0 flex justify-between items-center bg-red-50">
                    <div class="flex items-center gap-3">
                        ${photoHtml}
                        <div>
                            <h3 class="text-lg font-semibold text-red-800">Edit Termination Details</h3>
                            <p class="text-sm text-gray-600">${emp.first_name || ''} ${emp.last_name || ''} (${emp.employee_id || '-'})</p>
                        </div>
                    </div>
                    <button onclick="closeTerminationDetailsModal()" class="text-gray-400 hover:text-gray-600"><i class="fas fa-times text-lg"></i></button>
                </div>
                <div class="p-5 overflow-y-auto flex-1 min-h-0 space-y-4">
                    <div class="bg-gray-50 rounded-lg p-4">
                        <div class="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Employee Information</div>
                        <div class="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                            <div><span class="text-gray-500 text-xs">Department:</span> <span class="font-medium block">${emp.department || '-'}</span></div>
                            <div><span class="text-gray-500 text-xs">Position:</span> <span class="font-medium block">${emp.position || '-'}</span></div>
                            <div><span class="text-gray-500 text-xs">Hire Date:</span> <span class="font-medium block">${emp.hire_date ? formatDate(emp.hire_date) : '-'}</span></div>
                            <div><span class="text-gray-500 text-xs">Status:</span> <span class="font-medium block">${emp.status || '-'}</span></div>
                        </div>
                    </div>
                    <div class="bg-red-50 rounded-lg p-4 border border-red-200">
                        <div class="text-xs font-semibold text-red-600 uppercase tracking-wide mb-3">Termination Information</div>
                        <div class="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
                            <div>
                                <label class="text-gray-500 text-xs block mb-1">Termination Date *</label>
                                <input type="date" id="td-termination-date" value="${emp.termination_date || ''}" class="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-red-300">
                            </div>
                            <div>
                                <label class="text-gray-500 text-xs block mb-1">Reason *</label>
                                <select id="td-termination-reason" class="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-red-300">
                                    <option value="">Select Reason</option>
                                    <option value="Resignation" ${emp.termination_reason === 'Resignation' ? 'selected' : ''}>Resignation</option>
                                    <option value="Termination" ${emp.termination_reason === 'Termination' ? 'selected' : ''}>Termination</option>
                                    <option value="Retirement" ${emp.termination_reason === 'Retirement' ? 'selected' : ''}>Retirement</option>
                                    <option value="End of Contract" ${emp.termination_reason === 'End of Contract' ? 'selected' : ''}>End of Contract</option>
                                    <option value="Other" ${emp.termination_reason === 'Other' ? 'selected' : ''}>Other</option>
                                </select>
                            </div>
                            <div class="col-span-2">
                                <label class="text-gray-500 text-xs block mb-1">Notes</label>
                                <textarea id="td-termination-notes" rows="3" class="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-red-300" placeholder="Additional notes...">${emp.termination_notes || ''}</textarea>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="px-5 py-3 border-t flex justify-end gap-3 flex-shrink-0">
                    <button onclick="closeTerminationDetailsModal()" class="px-4 py-2 text-sm bg-gray-100 rounded-lg hover:bg-gray-200 transition">Cancel</button>
                    <button onclick="saveTerminationDetails(${emp.id})" class="px-5 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 transition font-semibold">
                        <i class="fas fa-save mr-1"></i>Save Changes
                    </button>
                </div>
        `;

        let modal = document.getElementById('termination-details-modal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'termination-details-modal';
            modal.className = 'modal fixed inset-0 bg-black bg-opacity-50 items-center justify-center z-50';
            modal.style.display = 'flex';
            document.body.appendChild(modal);
        }
        modal.innerHTML = `<div class="bg-white rounded-xl shadow-2xl w-full max-w-2xl mx-4 my-6 flex flex-col overflow-hidden" style="max-height:80vh;">${detailsHtml}</div>`;
        modal.style.display = 'flex';
        initDDMMYYYYDatePickers();
    } catch (error) {
        console.error('Error loading termination details:', error);
        alert('Error loading termination details.');
    }
}

async function saveTerminationDetails(id) {
    const date = document.getElementById('td-termination-date').value;
    const reason = document.getElementById('td-termination-reason').value;
    const notes = document.getElementById('td-termination-notes').value;

    if (!date) { alert('Please select a termination date.'); return; }
    if (!reason) { alert('Please select a termination reason.'); return; }

    try {
        const managerId = (typeof currentModuleManager !== 'undefined' && currentModuleManager) ? currentModuleManager.id : '';
        const response = await fetch(`${API_BASE}/employees/${id}/terminate?manager_id=${managerId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ termination_date: date, termination_reason: reason, termination_notes: notes })
        });
        const data = await response.json();
        if (response.ok) {
            alert('Termination details updated successfully.');
            closeTerminationDetailsModal();
            loadTerminatedEmployees();
        } else {
            alert('Error: ' + (data.error || 'Could not update termination details.'));
        }
    } catch (error) {
        console.error('Error saving termination details:', error);
        alert('Error saving termination details.');
    }
}

function closeTerminationDetailsModal() {
    const modal = document.getElementById('termination-details-modal');
    if (modal) modal.style.display = 'none';
}

let _terminationLiabilityEmpId = null;
let _terminationLiabilityEmpName = null;
let _terminationLiabilityData = null;

let _terminateEmployees = [];

async function openTerminateEmployeeModal() {
    const modal = document.getElementById('terminate-employee-modal');
    const form = document.getElementById('terminate-employee-form');
    form.reset();
    document.getElementById('terminate-employee-search').value = '';
    document.getElementById('terminate-employee-id').value = '';
    document.getElementById('terminate-employee-location-info').classList.add('hidden');

    try {
        const response = await fetch(`${API_BASE}/employees?active=true`);
        _terminateEmployees = await response.json();
    } catch (error) {
        console.error('Error loading employees for termination:', error);
        _terminateEmployees = [];
    }

    setupTerminateEmployeeSearch();
    modal.classList.add('active');
}

function setupTerminateEmployeeSearch() {
    const searchInput = document.getElementById('terminate-employee-search');
    const hiddenInput = document.getElementById('terminate-employee-id');
    const dropdown = document.getElementById('terminate-employee-dropdown');
    if (!searchInput || !dropdown) return;

    const renderOptions = (filter = '') => {
        const term = filter.toLowerCase();
        const filtered = _terminateEmployees
            .filter(emp => {
                const text = `${emp.first_name || ''} ${emp.last_name || ''} ${emp.employee_id || ''} ${emp.department || ''}`.toLowerCase();
                return text.includes(term);
            })
            .slice(0, 50);
        const options = filtered
            .map((emp, i) => {
                const subBiz = [emp.sub_location_name, emp.business_type_name, emp.business_unit_code].filter(Boolean).join(' - ') || '-';
                return `<div class="px-3 py-2 hover:bg-gray-100 cursor-pointer text-sm" data-id="${emp.id}">
                    <span class="text-gray-400 mr-1">${i + 1}.</span> ${emp.first_name || ''} ${emp.last_name || ''} ${emp.employee_id ? '(' + emp.employee_id + ')' : ''}
                    <div class="text-xs text-gray-500 mt-0.5">${emp.country_name || '-'} · ${emp.location_type_name || '-'} · ${subBiz}</div>
                </div>`;
            })
            .join('');
        dropdown.innerHTML = options || '<div class="px-3 py-2 text-sm text-gray-400">No employees found</div>';
    };

    searchInput.onfocus = () => {
        renderOptions(searchInput.value);
        dropdown.classList.remove('hidden');
    };

    searchInput.oninput = () => {
        if (!searchInput.value.trim()) {
            hiddenInput.value = '';
            document.getElementById('terminate-employee-location-info').classList.add('hidden');
        }
        renderOptions(searchInput.value);
        dropdown.classList.remove('hidden');
    };

    dropdown.onclick = (e) => {
        const item = e.target.closest('[data-id]');
        if (!item) return;
        const empId = item.getAttribute('data-id');
        hiddenInput.value = empId;
        searchInput.value = item.textContent.split('(')[0].trim();
        dropdown.classList.add('hidden');
        showTerminateEmployeeLocation(parseInt(empId));
    };

    document.onclick = (e) => {
        if (!searchInput.contains(e.target) && !dropdown.contains(e.target)) {
            dropdown.classList.add('hidden');
        }
    };
}

function showTerminateEmployeeLocation(empId) {
    const emp = _terminateEmployees.find(e => e.id === empId);
    if (!emp) return;
    const infoBox = document.getElementById('terminate-employee-location-info');
    document.getElementById('terminate-emp-country').textContent = emp.country_name || '-';
    document.getElementById('terminate-emp-location').textContent = emp.location_type_name || '-';
    const subBiz = [emp.sub_location_name, emp.business_type_name, emp.business_unit_code].filter(Boolean).join(' - ') || '-';
    document.getElementById('terminate-emp-sublocation').textContent = subBiz;
    document.getElementById('terminate-emp-equipment').textContent = 'Loading...';
    infoBox.classList.remove('hidden');

    fetch(`${API_BASE}/equipment`)
        .then(r => r.json())
        .then(equipment => {
            const assigned = equipment.filter(eq => eq.assigned_to == empId && eq.status !== 'Written Off');
            if (assigned.length === 0) {
                document.getElementById('terminate-emp-equipment').textContent = 'None';
            } else {
                const list = assigned.map(eq => `${eq.auto_serial_number || 'No Serial'} - ${eq.name}`).join(', ');
                document.getElementById('terminate-emp-equipment').textContent = list;
            }
        })
        .catch(() => {
            document.getElementById('terminate-emp-equipment').textContent = '-';
        });
}

function closeTerminateEmployeeModal() {
    document.getElementById('terminate-employee-modal').classList.remove('active');
}

async function saveTerminateEmployee(e) {
    e.preventDefault();
    const id = document.getElementById('terminate-employee-id').value;
    const date = document.getElementById('terminate-employee-date').value;
    const reason = document.getElementById('terminate-employee-reason').value;
    const notes = document.getElementById('terminate-employee-notes').value;
    if (!id) { alert('Please select an employee'); return; }

    const empName = document.getElementById('terminate-employee-search').value || 'Employee';

    closeTerminateEmployeeModal();
    await openTerminationLiabilityModal(id, empName, date, reason, notes);
}

async function openTerminationLiabilityModal(empId, empName, prefillDate, prefillReason, prefillNotes) {
    _terminationLiabilityEmpId = empId;
    _terminationLiabilityEmpName = empName;

    document.getElementById('termination-liability-emp-name').textContent = empName;

    const today = new Date().toISOString().split('T')[0];
    document.getElementById('tl-termination-date').value = prefillDate || today;
    document.getElementById('tl-termination-reason').value = prefillReason || '';
    document.getElementById('tl-termination-notes').value = prefillNotes || '';

    document.getElementById('termination-equipment-list').innerHTML = '<p class="text-sm text-gray-400">Loading...</p>';
    document.getElementById('termination-advance-details').innerHTML = 'Loading...';
    document.getElementById('termination-deduction-summary').classList.add('hidden');
    document.getElementById('termination-blocker-msg').classList.add('hidden');
    document.getElementById('tl-confirm-btn').disabled = false;

    document.getElementById('termination-liability-modal').classList.add('active');

    try {
        const res = await fetch(`${API_BASE}/employees/${empId}/liabilities`);
        const data = await res.json();
        if (!res.ok) {
            throw new Error(data.error || `HTTP ${res.status}`);
        }
        _terminationLiabilityData = data;
        renderTerminationLiabilities(_terminationLiabilityData);
    } catch (err) {
        console.error('Error fetching liabilities:', err);
        document.getElementById('termination-equipment-list').innerHTML = `<p class="text-sm text-red-500"><i class="fas fa-exclamation-circle mr-1"></i>Failed to load liabilities: ${err.message}</p>`;
        document.getElementById('termination-advance-details').innerHTML = '';
    }
}

function renderTerminationLiabilities(data) {
    const equipment = data.equipment || [];
    const totalAdvance = data.totalAdvance || 0;
    const advanceDetails = data.advanceDetails || [];
    const eqCount = document.getElementById('termination-equipment-count');
    const eqList = document.getElementById('termination-equipment-list');

    eqCount.textContent = equipment.length;

    if (equipment.length === 0) {
        eqList.innerHTML = '<p class="text-sm text-green-700 bg-green-50 rounded-lg px-3 py-2"><i class="fas fa-check-circle mr-1"></i>No equipment assigned — cleared.</p>';
    } else {
        eqList.innerHTML = equipment.map(eq => {
            const cost = parseFloat(eq.purchase_cost || eq.price || 0);
            const label = [eq.name, eq.auto_serial_number, eq.serial_number].filter(Boolean).join(' | ');
            const location = [eq.sub_location_name, eq.business_type_name, eq.location_name].filter(Boolean).join(' - ');
            return `<div class="border border-orange-200 rounded-lg p-3 bg-orange-50" data-eq-id="${eq.id}">
                <div class="flex items-start justify-between gap-2 mb-2">
                    <div>
                        <p class="text-sm font-semibold text-gray-800">${label}</p>
                        <p class="text-xs text-gray-500">${location || '-'} &bull; Status: ${eq.status || '-'}</p>
                        <p class="text-xs text-gray-400">Purchase Cost: <strong>${cost > 0 ? cost.toFixed(2) : 'N/A'}</strong></p>
                    </div>
                    <span class="text-xs bg-orange-200 text-orange-800 rounded px-2 py-0.5 whitespace-nowrap font-semibold">Not Returned</span>
                </div>
                <div class="flex items-center gap-2">
                    <label class="text-xs text-gray-600 whitespace-nowrap">Charge employee (or 0 if returned):</label>
                    <input type="number" min="0" step="0.01" value="${cost > 0 ? cost.toFixed(2) : ''}"
                        id="eq-charge-${eq.id}"
                        onchange="updateTerminationDeductionSummary()"
                        class="border rounded px-2 py-1 text-sm w-32 focus:ring-2 focus:ring-red-300"
                        placeholder="0.00">
                </div>
            </div>`;
        }).join('');
    }

    const advEl = document.getElementById('termination-advance-details');
    if (totalAdvance > 0) {
        const rows = advanceDetails.map(a =>
            `<div class="flex justify-between text-xs py-0.5">
                <span>${a.date}${a.notes ? ' — ' + a.notes : ''}</span>
                <span class="font-semibold">${parseFloat(a.amount).toFixed(2)}</span>
            </div>`
        ).join('');
        advEl.innerHTML = `${rows}<div class="flex justify-between text-sm font-bold border-t mt-1 pt-1">
            <span>Total Outstanding</span><span class="text-red-700">${totalAdvance.toFixed(2)}</span></div>
            <p class="text-xs text-blue-600 mt-1"><i class="fas fa-info-circle mr-1"></i>These advances are already tracked in the payroll deductions.</p>`;
    } else {
        advEl.innerHTML = '<p class="text-green-700 text-sm"><i class="fas fa-check-circle mr-1"></i>No outstanding advances.</p>';
    }

    updateTerminationDeductionSummary();
}

function updateTerminationDeductionSummary() {
    if (!_terminationLiabilityData) return;
    const { equipment } = _terminationLiabilityData;
    let total = 0;
    const lines = [];

    equipment.forEach(eq => {
        const input = document.getElementById(`eq-charge-${eq.id}`);
        if (!input) return;
        const val = parseFloat(input.value) || 0;
        if (val > 0) {
            const label = [eq.name, eq.auto_serial_number].filter(Boolean).join(' ');
            lines.push(`<div class="flex justify-between"><span>${label}</span><span>${val.toFixed(2)}</span></div>`);
            total += val;
        }
    });

    const summaryEl = document.getElementById('termination-deduction-summary');
    const listEl = document.getElementById('termination-deduction-list');
    const totalEl = document.getElementById('termination-deduction-total');

    if (total > 0) {
        summaryEl.classList.remove('hidden');
        listEl.innerHTML = lines.join('');
        totalEl.textContent = total.toFixed(2);
    } else {
        summaryEl.classList.add('hidden');
    }
}

function closeTerminationLiabilityModal() {
    document.getElementById('termination-liability-modal').classList.remove('active');
    _terminationLiabilityEmpId = null;
    _terminationLiabilityData = null;
}

async function confirmTerminationWithDeductions() {
    const date = document.getElementById('tl-termination-date').value;
    const reason = document.getElementById('tl-termination-reason').value;
    const notes = document.getElementById('tl-termination-notes').value;

    if (!date) { alert('Please select a termination date.'); return; }
    if (!reason) { alert('Please select a termination reason.'); return; }

    const equipment = (_terminationLiabilityData && _terminationLiabilityData.equipment) || [];
    const equipment_charges = equipment.map(eq => ({
        equipment_id: eq.id,
        equipment_name: [eq.name, eq.auto_serial_number].filter(Boolean).join(' '),
        charge_amount: parseFloat(document.getElementById(`eq-charge-${eq.id}`)?.value || 0) || 0
    }));

    const unhandled = equipment.filter(eq => {
        const val = parseFloat(document.getElementById(`eq-charge-${eq.id}`)?.value);
        return isNaN(val);
    });
    if (unhandled.length > 0) {
        alert('Please enter a charge amount for all equipment (enter 0 if returned).');
        return;
    }

    const totalCharge = equipment_charges.reduce((s, c) => s + c.charge_amount, 0);
    const chargeMsg = totalCharge > 0 ? `\n\nEquipment charges totalling ${totalCharge.toFixed(2)} will be added as deductions to the final payslip.` : '';
    if (!confirm(`Terminate ${_terminationLiabilityEmpName}?${chargeMsg}\n\nThis action cannot be undone.`)) return;

    document.getElementById('tl-confirm-btn').disabled = true;

    try {
        const response = await fetch(`${API_BASE}/employees/${_terminationLiabilityEmpId}/terminate-with-deductions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ termination_date: date, termination_reason: reason, termination_notes: notes, equipment_charges })
        });
        if (!response.ok) {
            const err = await response.json().catch(() => ({ error: 'Unknown error' }));
            alert('Error: ' + (err.error || 'Termination failed'));
            document.getElementById('tl-confirm-btn').disabled = false;
            return;
        }
        closeTerminationLiabilityModal();
        const chargeCount = equipment_charges.filter(c => c.charge_amount > 0).length;
        alert(`Employee terminated successfully.${chargeCount > 0 ? `\n${chargeCount} equipment charge(s) added to payroll deductions.` : ''}`);
        loadEmployees();
        loadTerminatedEmployees();
    } catch (error) {
        console.error('Error terminating employee:', error);
        alert('Error terminating employee.');
        document.getElementById('tl-confirm-btn').disabled = false;
    }
}

function getFilteredEmployees() {
    if (!Array.isArray(allEmployees)) return [];
    const search = (document.getElementById('employee-search')?.value || '').toLowerCase();

    return allEmployees.filter(emp => {
        const matchesSearch = !search ||
            emp.first_name.toLowerCase().includes(search) ||
            emp.last_name.toLowerCase().includes(search) ||
            (emp.employee_id && emp.employee_id.toLowerCase().includes(search));
        if (!matchesSearch) return false;

        for (const col of EMPLOYEE_HEADER_FILTER_COLS) {
            const state = employeeHeaderFilterState[col];
            if (state && state.selected.size < state.allValues.length) {
                const val = getEmployeeColumnValue(emp, col);
                if (!state.selected.has(val)) return false;
            }
        }
        return true;
    });
}

function filterEmployees() {
    renderEmployeeList(getFilteredEmployees());
    if (typeof applyEmployeeColumnVisibility === 'function') applyEmployeeColumnVisibility();
    if (typeof applyEmployeeFreeze === 'function') applyEmployeeFreeze();
    const searchInput = document.getElementById('employee-search');
    const clearBtn = document.getElementById('employee-clear-filters-btn');
    const hasSearch = searchInput && searchInput.value && searchInput.value.trim() !== '';
    const hasHeaderFilter = EMPLOYEE_HEADER_FILTER_COLS.some(col => {
        const state = employeeHeaderFilterState[col];
        return state && state.selected.size < state.allValues.length;
    });
    const hasFilter = hasSearch || hasHeaderFilter;
    if (searchInput) {
        if (hasSearch) {
            searchInput.classList.add('border-yellow-400', 'bg-yellow-100', 'filter-active-blink');
        } else {
            searchInput.classList.remove('border-yellow-400', 'bg-yellow-100', 'filter-active-blink');
        }
    }
    if (clearBtn) {
        if (hasFilter) {
            clearBtn.classList.add('border-yellow-400', 'bg-yellow-100', 'text-yellow-700', 'filter-active-blink');
        } else {
            clearBtn.classList.remove('border-yellow-400', 'bg-yellow-100', 'text-yellow-700', 'filter-active-blink');
        }
    }
}

function clearEmployeeFilters() {
    const searchInput = document.getElementById('employee-search');
    if (searchInput) searchInput.value = '';
    EMPLOYEE_HEADER_FILTER_COLS.forEach(col => {
        if (employeeHeaderFilterState[col]) {
            employeeHeaderFilterState[col].selected = new Set(employeeHeaderFilterState[col].allValues);
        }
        renderEmployeeHeaderFilterCheckboxes(col);
        updateEmployeeHeaderFilterIcon(col);
    });
    unlockColumnWidths('#employee-table');
    if (typeof applyEmployeeColumnVisibility === 'function') applyEmployeeColumnVisibility();
    renderEmployeeList(allEmployees);
    if (typeof applyEmployeeColumnVisibility === 'function') applyEmployeeColumnVisibility();
    lockColumnWidths('#employee-table');
    if (typeof applyEmployeeFreeze === 'function') applyEmployeeFreeze();
    filterEmployees();
}

function exportEmployeesCSV() {
    const filtered = getFilteredEmployees();
    const visibility = (typeof getEmployeeColumnVisibility === 'function') ? getEmployeeColumnVisibility() : null;
    const columns = (typeof EMPLOYEE_COLUMNS !== 'undefined') ? EMPLOYEE_COLUMNS : [
        { key: 'serial', label: '#' }, { key: 'name', label: 'Name' },
        { key: 'employee_id', label: 'Employee ID' }, { key: 'department', label: 'Department' },
        { key: 'position', label: 'Position' }, { key: 'country', label: 'Country' },
        { key: 'location', label: 'Location' }, { key: 'subbusiness', label: 'Sub / Business' },
        { key: 'nationality', label: 'Nationality' }, { key: 'status', label: 'Status' }
    ];

    const activeColumns = columns.filter(col => col.key !== 'actions' && (!visibility || visibility[col.key] !== false));
    const headers = activeColumns.map(col => col.label);
    let csv = employeesBuildCSVRow(headers);
    const total = filtered.length;
    filtered.forEach((emp, index) => {
        const serial = total - index;
        const values = activeColumns.map(col => getEmployeeExportValue(emp, col.key, serial));
        csv += employeesBuildCSVRow(values);
    });

    employeesDownloadCSV(csv, 'employees_export.csv');
}

function exportEmployeesPDF() {
    const filtered = getFilteredEmployees();
    const visibility = (typeof getEmployeeColumnVisibility === 'function') ? getEmployeeColumnVisibility() : null;
    const columns = (typeof EMPLOYEE_COLUMNS !== 'undefined') ? EMPLOYEE_COLUMNS : [
        { key: 'serial', label: '#' }, { key: 'name', label: 'Name' },
        { key: 'employee_id', label: 'Employee ID' }, { key: 'department', label: 'Department' },
        { key: 'position', label: 'Position' }, { key: 'country', label: 'Country' },
        { key: 'location', label: 'Location' }, { key: 'subbusiness', label: 'Sub / Business' },
        { key: 'nationality', label: 'Nationality' }, { key: 'status', label: 'Status' }
    ];

    const activeColumns = columns.filter(col => col.key !== 'actions' && (!visibility || visibility[col.key] !== false));
    const headers = activeColumns.map(col => col.label);
    const total = filtered.length;
    const rows = filtered.map((emp, index) => {
        const serial = total - index;
        return activeColumns.map(col => employeesEscapeHTML(String(getEmployeeExportValue(emp, col.key, serial))));
    });
    const filterCriteria = getEmployeeFilterCriteria();

    const html = buildEmployeesPDFHtml(headers, rows, filtered.length, filterCriteria);
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.width = '100%';
    iframe.style.height = '100%';
    iframe.style.top = '0';
    iframe.style.left = '0';
    iframe.style.border = 'none';
    iframe.style.zIndex = '9999';
    document.body.appendChild(iframe);
    iframe.contentWindow.document.open();
    iframe.contentWindow.document.write(html);
    iframe.contentWindow.document.close();
    iframe.contentWindow.focus();
    iframe.contentWindow.print();

    iframe.style.visibility = 'hidden';
    const removeIframe = () => {
        if (iframe.parentNode) document.body.removeChild(iframe);
    };
    try {
        iframe.contentWindow.addEventListener('afterprint', removeIframe, { once: true });
    } catch (e) {}
    setTimeout(removeIframe, 500);
}

function getEmployeeExportValue(emp, key, serial) {
    switch (key) {
        case 'serial': return String(serial);
        case 'name': return `${emp.first_name || ''} ${emp.last_name || ''}`.trim() || '-';
        case 'employee_id': return emp.employee_id || '-';
        case 'department': return emp.department || '-';
        case 'position': return emp.position || '-';
        case 'country': return emp.country_name || '-';
        case 'location': return emp.location_type_name || '-';
        case 'subbusiness': return [emp.sub_location_name, emp.business_type_name, emp.business_unit_code].filter(Boolean).join(' - ') || '-';
        case 'nationality': return emp.nationality || '-';
        case 'status': return emp.status || '-';
        case 'email': return emp.email || '-';
        case 'phone': return emp.phone || '-';
        case 'hiredate': return emp.hire_date || '-';
        case 'remtype': return emp.remuneration_type || '-';
        case 'remuneration': return emp.remuneration || '-';
        case 'workhours': return emp.working_hours_per_day || '-';
        case 'overtime': return emp.overtime_rate || '-';
        case 'address': return emp.address || '-';
        case 'emgcontact': return emp.emergency_contact || '-';
        case 'emgphone': return emp.emergency_phone || '-';
        default: return '';
    }
}

function getEmployeeFilterCriteria() {
    const criteria = [];
    const search = document.getElementById('employee-search')?.value.trim();
    if (search) criteria.push(`Search: ${search}`);
    EMPLOYEE_HEADER_FILTER_COLS.forEach(col => {
        const state = employeeHeaderFilterState[col];
        if (state && state.selected.size < state.allValues.length) {
            const label = EMPLOYEE_COLUMNS.find(c => c.key === col)?.label || col;
            criteria.push(`${label}: ${[...state.selected].join(', ')}`);
        }
    });
    return criteria;
}

function employeesEscapeCSV(value) {
    const str = value == null ? '' : String(value);
    if (/[",\n\r]/.test(str)) return '"' + str.replace(/"/g, '""') + '"';
    return str;
}

function employeesBuildCSVRow(values) {
    return values.map(employeesEscapeCSV).join(',') + '\n';
}

function employeesDownloadCSV(csv, filename) {
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
}

function employeesEscapeHTML(value) {
    const str = value == null ? '' : String(value);
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function buildEmployeesPDFHtml(headers, rows, total, filterCriteria) {
    const headerCells = headers.map(h => `<th>${h}</th>`).join('');
    const bodyRows = rows.map(cells => `<tr>${cells.map(c => `<td>${c}</td>`).join('')}</tr>`).join('');
    const filterHtml = filterCriteria.length
        ? `<div class="filters"><strong>Filters:</strong> ${filterCriteria.map(f => employeesEscapeHTML(f)).join(' &nbsp;|&nbsp; ')}</div>`
        : '';
    return `<!DOCTYPE html>
<html>
<head>
    <title>Employee List</title>
    <style>
        @page { size: landscape; margin: 10mm; }
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 20px; color: #1f2937; font-size: 10px; }
        h1 { margin: 0 0 8px; font-size: 18px; }
        .meta, .filters { margin-bottom: 10px; font-size: 11px; color: #6b7280; }
        .filters strong { color: #374151; }
        table { width: 100%; border-collapse: collapse; }
        th, td { border: 1px solid #d1d5db; padding: 5px 6px; text-align: left; vertical-align: top; }
        th { background: #1e40af; color: #fff; font-weight: 600; }
        tr:nth-child(even) { background: #f9fafb; }
    </style>
</head>
<body>
    <h1>Employee List</h1>
    <div class="meta">Total records: ${total} &nbsp;|&nbsp; Exported on ${formatDate(new Date())}</div>
    ${filterHtml}
    <table>
        <thead><tr>${headerCells}</tr></thead>
        <tbody>${bodyRows}</tbody>
    </table>
</body>
</html>`;
}

function updateTransferEmployeeAddButtonVisibility() {
    const btn = document.getElementById('transfer-employee-add-btn');
    if (!btn) return;
    const canAdd = typeof hasTablePermission === 'function' && hasTablePermission('employee-transfers', 'edit');
    btn.style.display = canAdd ? '' : 'none';
}

// Transfer Employee Functions
async function loadEmployeeTransfers() {
    updateTransferEmployeeAddButtonVisibility();
    showTableLoading('employee-transfers-table-body', 'Loading employee transfers...');
    try {
        const response = await fetch(`${API_BASE}/employee-transfers`);
        allEmployeeTransfers = await response.json();
populateEmployeeTransferFilters();
        filterEmployeeTransfersList();
    } catch (error) {
        console.error('Error loading employee transfers:', error);
        showTableError('employee-transfers-table-body', 'Error loading employee transfers.');
    }
}

function getEmployeeTransferCountryField() {
    const direction = document.getElementById('employee-transfer-filter-direction')?.value || '';
    return direction === 'to' ? 'to_country_name' : 'from_country_name';
}

function getEmployeeTransferLocationField() {
    const direction = document.getElementById('employee-transfer-filter-direction')?.value || '';
    return direction === 'to' ? 'to_location_type_name' : 'from_location_type_name';
}

function getEmployeeTransferSubFields() {
    const direction = document.getElementById('employee-transfer-filter-direction')?.value || '';
    if (direction === 'to') {
        return ['to_sub_location_name', 'to_business_type_name', 'to_business_unit_code'];
    }
    return ['from_sub_location_name', 'from_business_type_name', 'from_business_unit_code'];
}

function populateEmployeeTransferFilters() {
    if (!allEmployeeTransfers || allEmployeeTransfers.length === 0) return;

    const countryField = getEmployeeTransferCountryField();
    const countrySelect = document.getElementById('employee-transfer-filter-country');
    if (countrySelect) {
        const uniqueCountries = [...new Set(allEmployeeTransfers.map(t => t[countryField]).filter(c => c))].sort();
        countrySelect.innerHTML = '<option value="">All Countries</option>' +
            uniqueCountries.map(c => `<option value="${c}">${c}</option>`).join('');
    }

    const locationSelect = document.getElementById('employee-transfer-filter-location');
    if (locationSelect) {
        locationSelect.innerHTML = '<option value="">All Locations</option>';
    }

    const checkboxList = document.getElementById('employee-transfer-sublocation-checkbox-list');
    if (checkboxList) checkboxList.innerHTML = '';
    const checkAll = document.getElementById('employee-transfer-sublocation-check-all');
    if (checkAll) checkAll.checked = true;
    const label = document.getElementById('employee-transfer-filter-sublocation-label');
    if (label) label.textContent = 'All Sublocations';
}

function onEmployeeTransferFilterCountryChange() {
    const countryField = getEmployeeTransferCountryField();
    const locationField = getEmployeeTransferLocationField();
    const country = document.getElementById('employee-transfer-filter-country').value;
    const locationSelect = document.getElementById('employee-transfer-filter-location');

    if (country && allEmployeeTransfers && allEmployeeTransfers.length) {
        const locationNames = [...new Set(allEmployeeTransfers
            .filter(t => t[countryField] === country)
            .map(t => t[locationField])
            .filter(loc => loc))].sort();
        locationSelect.innerHTML = '<option value="">All Locations</option>' +
            locationNames.map(loc => `<option value="${loc}">${loc}</option>`).join('');
    } else {
        locationSelect.innerHTML = '<option value="">All Locations</option>';
    }

    const checkboxList = document.getElementById('employee-transfer-sublocation-checkbox-list');
    if (checkboxList) checkboxList.innerHTML = '';
    const checkAll = document.getElementById('employee-transfer-sublocation-check-all');
    if (checkAll) checkAll.checked = true;
    const label = document.getElementById('employee-transfer-filter-sublocation-label');
    if (label) label.textContent = 'All Sublocations';

    filterEmployeeTransfersList();
}

function onEmployeeTransferFilterLocationChange() {
    const countryField = getEmployeeTransferCountryField();
    const locationField = getEmployeeTransferLocationField();
    const subFields = getEmployeeTransferSubFields();
    const country = document.getElementById('employee-transfer-filter-country').value;
    const location = document.getElementById('employee-transfer-filter-location').value;

    if (country && location && allEmployeeTransfers && allEmployeeTransfers.length) {
        const subOptions = [...new Set(allEmployeeTransfers
            .filter(t => t[countryField] === country && t[locationField] === location)
            .map(t => subFields.map(f => t[f]).filter(Boolean).join(' - '))
            .filter(sub => sub))].sort();

        const checkboxList = document.getElementById('employee-transfer-sublocation-checkbox-list');
        if (checkboxList) {
            checkboxList.innerHTML = subOptions.map(sub => `
                <label class="flex items-center px-3 py-2 hover:bg-gray-50 border-b text-sm cursor-pointer">
                    <input type="checkbox" class="employee-transfer-sublocation-checkbox mr-2" value="${sub.replace(/"/g, '&quot;')}" onchange="onEmployeeTransferSublocationCheckboxChange()"> <span>${sub}</span>
                </label>
            `).join('');
        }
    } else {
        const checkboxList = document.getElementById('employee-transfer-sublocation-checkbox-list');
        if (checkboxList) checkboxList.innerHTML = '';
    }

    const checkAll = document.getElementById('employee-transfer-sublocation-check-all');
    if (checkAll) checkAll.checked = true;
    const label = document.getElementById('employee-transfer-filter-sublocation-label');
    if (label) label.textContent = 'All Sublocations';

    filterEmployeeTransfersList();
}

function toggleEmployeeTransferSublocationCheckboxDropdown() {
    const dropdown = document.getElementById('employee-transfer-filter-sublocation-dropdown');
    if (dropdown) dropdown.classList.toggle('hidden');
}

function filterEmployeeTransferSublocationCheckboxes() {
    const search = (document.getElementById('employee-transfer-sublocation-search')?.value || '').toLowerCase();
    const labels = document.querySelectorAll('#employee-transfer-sublocation-checkbox-list label');
    labels.forEach(label => {
        const text = label.textContent.trim().toLowerCase();
        label.style.display = text.includes(search) ? '' : 'none';
    });
}

function onEmployeeTransferSublocationCheckAllChange() {
    const checkAll = document.getElementById('employee-transfer-sublocation-check-all');
    const checkboxes = document.querySelectorAll('.employee-transfer-sublocation-checkbox');
    checkboxes.forEach(cb => cb.checked = checkAll.checked);
    updateEmployeeTransferSublocationFilterLabel();
    filterEmployeeTransfersList();
}

function onEmployeeTransferSublocationCheckboxChange() {
    const checkboxes = document.querySelectorAll('.employee-transfer-sublocation-checkbox');
    const checkedCount = Array.from(checkboxes).filter(cb => cb.checked).length;
    const checkAll = document.getElementById('employee-transfer-sublocation-check-all');
    if (checkAll) checkAll.checked = checkboxes.length > 0 && checkedCount === checkboxes.length;
    updateEmployeeTransferSublocationFilterLabel();
    filterEmployeeTransfersList();
}

function updateEmployeeTransferSublocationFilterLabel() {
    const label = document.getElementById('employee-transfer-filter-sublocation-label');
    if (!label) return;
    const checkboxes = document.querySelectorAll('.employee-transfer-sublocation-checkbox');
    const checked = Array.from(checkboxes).filter(cb => cb.checked);
    if (checked.length === 0 || checked.length === checkboxes.length) {
        label.textContent = 'All Sublocations';
    } else if (checked.length === 1) {
        label.textContent = checked[0].nextElementSibling.textContent.trim();
    } else {
        label.textContent = checked.length + ' selected';
    }
}

function getSelectedEmployeeTransferSublocationIds() {
    const checkboxes = document.querySelectorAll('.employee-transfer-sublocation-checkbox');
    const allChecked = document.getElementById('employee-transfer-sublocation-check-all');
    if (allChecked && allChecked.checked) return [];
    return Array.from(checkboxes).filter(cb => cb.checked).map(cb => cb.value);
}

function filterEmployeeTransfersList() {
    if (!Array.isArray(allEmployeeTransfers)) return;
    const search = (document.getElementById('employee-transfer-search')?.value || '').toLowerCase();
    const countryField = getEmployeeTransferCountryField();
    const locationField = getEmployeeTransferLocationField();
    const subFields = getEmployeeTransferSubFields();
    const country = document.getElementById('employee-transfer-filter-country')?.value || '';
    const location = document.getElementById('employee-transfer-filter-location')?.value || '';
    const selectedSubIds = getSelectedEmployeeTransferSublocationIds();

    let filtered = allEmployeeTransfers;
    if (country) filtered = filtered.filter(t => t[countryField] === country);
    if (location) filtered = filtered.filter(t => t[locationField] === location);
    if (selectedSubIds.length > 0) {
        filtered = filtered.filter(t => selectedSubIds.includes(
            subFields.map(f => t[f]).filter(Boolean).join(' - ')
        ));
    }
    if (search) {
        filtered = filtered.filter(t =>
            (t.employee_name && t.employee_name.toLowerCase().includes(search)) ||
            (t.employee_id && t.employee_id.toLowerCase().includes(search))
        );
    }

    const tbody = document.getElementById('employee-transfers-table-body');
    if (!tbody) return;
    if (filtered.length === 0) {
        tbody.innerHTML = '<tr><td colspan="11" class="px-6 py-4 text-center text-gray-500">No transfers found</td></tr>';
        return;
    }
    tbody.innerHTML = filtered.map(t => {
        const fromParts = (t.from_location_name || '').split(' - ');
        const toParts = (t.to_location_name || '').split(' - ');
        const fromCountry = t.from_country_name || fromParts[0] || '-';
        const fromLocation = t.from_location_type_name || fromParts[1] || '-';
        const fromSub = [t.from_sub_location_name, t.from_business_type_name, t.from_business_unit_code].filter(Boolean).join(' - ') || fromParts.slice(2).join(' - ') || '-';
        const toCountry = t.to_country_name || toParts[0] || '-';
        const toLocation = t.to_location_type_name || toParts[1] || '-';
        const toSub = [t.to_sub_location_name, t.to_business_type_name, t.to_business_unit_code].filter(Boolean).join(' - ') || toParts.slice(2).join(' - ') || '-';
        return `
        <tr>
            <td class="px-6 py-4 whitespace-nowrap">${t.transfer_serial_number || '-'}</td>
            <td class="px-6 py-4 whitespace-nowrap">${t.employee_name || `Unknown Employee (ID: ${t.emp_db_id || t.employee_id || '-'})`}</td>
            <td class="px-6 py-4 whitespace-nowrap">${fromCountry}</td>
            <td class="px-6 py-4 whitespace-nowrap">${fromLocation}</td>
            <td class="px-6 py-4 whitespace-nowrap">${fromSub}</td>
            <td class="px-6 py-4 whitespace-nowrap">${toCountry}</td>
            <td class="px-6 py-4 whitespace-nowrap">${toLocation}</td>
            <td class="px-6 py-4 whitespace-nowrap">${toSub}</td>
            <td class="px-6 py-4 whitespace-nowrap">${formatDate(t.transfer_date)}</td>
            <td class="px-6 py-4 whitespace-nowrap">${t.reason || '-'}</td>
            <td class="px-6 py-4 whitespace-nowrap">
                <button onclick="viewEmployeeTransfer(${t.id})" class="text-green-600 hover:text-green-800 mr-2" title="View">
                    <i class="fas fa-eye"></i>
                </button>
                ${typeof getEditActionButton === 'function' ? getEditActionButton('employee-transfers', 'editEmployeeTransfer', t.id) : ''}
                ${typeof getDeleteActionButton === 'function' ? getDeleteActionButton('employee-transfers', 'deleteEmployeeTransfer', t.id) : ''}
            </td>
        </tr>
    `}).join('');
}

document.addEventListener('click', function(event) {
    const btn = document.getElementById('employee-transfer-filter-sublocation-btn');
    const dropdown = document.getElementById('employee-transfer-filter-sublocation-dropdown');
    if (btn && dropdown && !btn.contains(event.target) && !dropdown.contains(event.target)) {
        dropdown.classList.add('hidden');
    }
});

function renderEmployeeTransfers() {
    const tbody = document.getElementById('employee-transfers-table-body');
    if (!tbody) return;
    if (!allEmployeeTransfers || !Array.isArray(allEmployeeTransfers) || allEmployeeTransfers.length === 0) {
        tbody.innerHTML = '<tr><td colspan="11" class="px-6 py-4 text-center text-gray-500">No transfers found</td></tr>';
        return;
    }
    tbody.innerHTML = allEmployeeTransfers.map(t => {
        const fromParts = (t.from_location_name || '').split(' - ');
        const toParts = (t.to_location_name || '').split(' - ');
        const fromCountry = t.from_country_name || fromParts[0] || '-';
        const fromLocation = t.from_location_type_name || fromParts[1] || '-';
        const fromSub = [t.from_sub_location_name, t.from_business_type_name, t.from_business_unit_code].filter(Boolean).join(' - ') || fromParts.slice(2).join(' - ') || '-';
        const toCountry = t.to_country_name || toParts[0] || '-';
        const toLocation = t.to_location_type_name || toParts[1] || '-';
        const toSub = [t.to_sub_location_name, t.to_business_type_name, t.to_business_unit_code].filter(Boolean).join(' - ') || toParts.slice(2).join(' - ') || '-';
        return `
        <tr>
            <td class="px-6 py-4 whitespace-nowrap">${t.transfer_serial_number || '-'}</td>
            <td class="px-6 py-4 whitespace-nowrap">${t.employee_name || `Unknown Employee (ID: ${t.emp_db_id || t.employee_id || '-'})`}</td>
            <td class="px-6 py-4 whitespace-nowrap">${fromCountry}</td>
            <td class="px-6 py-4 whitespace-nowrap">${fromLocation}</td>
            <td class="px-6 py-4 whitespace-nowrap">${fromSub}</td>
            <td class="px-6 py-4 whitespace-nowrap">${toCountry}</td>
            <td class="px-6 py-4 whitespace-nowrap">${toLocation}</td>
            <td class="px-6 py-4 whitespace-nowrap">${toSub}</td>
            <td class="px-6 py-4 whitespace-nowrap">${formatDate(t.transfer_date)}</td>
            <td class="px-6 py-4 whitespace-nowrap">${t.reason || '-'}</td>
            <td class="px-6 py-4 whitespace-nowrap">
                <button onclick="viewEmployeeTransfer(${t.id})" class="text-green-600 hover:text-green-800 mr-2" title="View">
                    <i class="fas fa-eye"></i>
                </button>
                ${typeof getEditActionButton === 'function' ? getEditActionButton('employee-transfers', 'editEmployeeTransfer', t.id) : ''}
                ${typeof getDeleteActionButton === 'function' ? getDeleteActionButton('employee-transfers', 'deleteEmployeeTransfer', t.id) : ''}
            </td>
        </tr>
    `}).join('');
}

// Store previous remuneration values for transfer snapshot
let transferPrevRemunerationType = '';
let transferPrevRemuneration = '';
let transferPrevLeaveEntitlements = [];

function addTransferLeaveEntitlementRow(data = null) {
    const container = document.getElementById('transfer-leave-entitlements-container');
    const row = document.createElement('div');
    row.className = 'flex gap-2 items-center transfer-leave-entitlement-row';
    row.innerHTML = `
        <select class="leave-ent-type flex-1 px-2 py-1.5 border rounded text-sm">
            ${getLeaveTypeOptionsHtml(data ? data.leave_type : '')}
        </select>
        <input type="number" class="leave-ent-days w-16 px-2 py-1.5 border rounded text-sm" placeholder="Days" min="0" value="${data ? data.days_count : ''}">
        <select class="leave-ent-condition w-20 px-2 py-1.5 border rounded text-sm">
            <option value="after" ${data && data.condition_type === 'after' ? 'selected' : ''}>after</option>
            <option value="in" ${data && data.condition_type === 'in' ? 'selected' : ''}>in</option>
            <option value="per" ${data && data.condition_type === 'per' ? 'selected' : ''}>per</option>
            <option value="every" ${data && data.condition_type === 'every' ? 'selected' : ''}>every</option>
        </select>
        <input type="number" class="leave-ent-months w-16 px-2 py-1.5 border rounded text-sm" placeholder="Count" min="0" value="${data ? data.months_count : ''}">
        <select class="leave-ent-period w-20 px-2 py-1.5 border rounded text-sm">
            <option value="months" ${!data || !data.period_type || data.period_type === 'months' ? 'selected' : ''}>months</option>
            <option value="weeks" ${data && data.period_type === 'weeks' ? 'selected' : ''}>weeks</option>
            <option value="days" ${data && data.period_type === 'days' ? 'selected' : ''}>days</option>
        </select>
        <button type="button" onclick="this.parentElement.remove()" class="px-2 py-1 bg-red-500 text-white rounded text-sm hover:bg-red-600"><i class="fas fa-trash"></i></button>
    `;
    container.appendChild(row);
}

function getTransferLeaveEntitlements() {
    const rows = document.querySelectorAll('.transfer-leave-entitlement-row');
    const entitlements = [];
    rows.forEach(row => {
        const leave_type = row.querySelector('.leave-ent-type').value;
        const days_count = row.querySelector('.leave-ent-days').value;
        const condition_type = row.querySelector('.leave-ent-condition').value;
        const months_count = row.querySelector('.leave-ent-months').value;
        const period_type = row.querySelector('.leave-ent-period').value;
        if (leave_type && days_count && months_count) {
            entitlements.push({ leave_type, days_count: parseInt(days_count), condition_type, months_count: parseInt(months_count), period_type });
        }
    });
    return entitlements;
}

async function openTransferEmployeeModal(transferId = null) {
    const modal = document.getElementById('transfer-employee-modal');
    const form = document.getElementById('transfer-employee-form');
    form.reset();
    document.getElementById('transfer-employee-id').value = transferId || '';
    document.getElementById('transfer-leave-entitlements-container').innerHTML = '';
    transferPrevRemunerationType = '';
    transferPrevRemuneration = '';
    transferPrevLeaveEntitlements = [];

    await ensureCascadingLocationData();
    const isEdit = !!transferId;
    let transferData = null;
    if (isEdit) {
        try {
            const response = await fetch(`${API_BASE}/employee-transfers/${transferId}`);
            if (!response.ok) throw new Error('Transfer not found');
            transferData = await response.json();
        } catch (error) {
            console.error('Error loading transfer for edit:', error);
            alert('Error loading transfer');
            return;
        }
    } else {
        try {
            const serialResponse = await fetch(`${API_BASE}/employee-transfers/next-serial`);
            if (serialResponse.ok) {
                const data = await serialResponse.json();
                document.getElementById('transfer-employee-serial').value = data.serial || 'ET-001';
            }
        } catch (error) {
            console.error('Error fetching next serial:', error);
        }
    }

    // Load remuneration types dropdown
    try {
        const remResponse = await fetch(`${API_BASE}/remuneration-types`);
        const remunerationTypes = await remResponse.json();
        const remSelect = document.getElementById('transfer-remuneration-type');
        remSelect.innerHTML = '<option value="">Select Remuneration Type</option>' +
            remunerationTypes.map(rt => `<option value="${rt.name}">${rt.name}</option>`).join('');
    } catch (error) {
        console.error('Error loading remuneration types:', error);
    }

    // Load leave types for entitlement rows
    try {
        const ltResponse = await fetch(`${API_BASE}/leave-types`);
        window.employeeLeaveTypesOptions = await ltResponse.json();
    } catch (error) {
        console.error('Error loading leave types:', error);
    }

    const empSelect = document.getElementById('transfer-employee-employee-id');
    try {
        const response = await fetch(`${API_BASE}/employees?active=true`);
        const employees = await response.json();
        empSelect.innerHTML = '<option value="">Select Employee</option>' +
            employees.map(emp => `<option value="${emp.id}" data-location-id="${emp.location_id || ''}">${emp.employee_id || ''} - ${emp.first_name} ${emp.last_name}</option>`).join('');
        empSelect.disabled = isEdit;
        empSelect.onchange = async () => {
            const employee = employees.find(e => e.id == empSelect.value);
            const fromSub = [employee?.sub_location_name, employee?.business_type_name, employee?.business_unit_code].filter(Boolean).join(' - ') || '';
            document.getElementById('transfer-employee-from-country').value = employee?.country_name || '';
            document.getElementById('transfer-employee-from-location-type').value = employee?.location_type_name || '';
            document.getElementById('transfer-employee-from-sublocation-business-type').value = fromSub;
            document.getElementById('transfer-employee-from-location-id').value = employee?.location_id || '';
            // Auto-fill remuneration
            transferPrevRemunerationType = employee?.remuneration_type || '';
            transferPrevRemuneration = employee?.remuneration || '';
            document.getElementById('transfer-remuneration-type').value = transferPrevRemunerationType;
            document.getElementById('transfer-remuneration').value = transferPrevRemuneration;
            // Auto-fill leave entitlements
            document.getElementById('transfer-leave-entitlements-container').innerHTML = '';
            transferPrevLeaveEntitlements = [];
            if (employee) {
                try {
                    const leaveResponse = await fetch(`${API_BASE}/employee-leave-entitlements/${employee.id}`);
                    const entitlements = await leaveResponse.json();
                    transferPrevLeaveEntitlements = entitlements.map(e => ({
                        leave_type: e.leave_type, days_count: e.days_count,
                        condition_type: e.condition_type, months_count: e.months_count
                    }));
                    entitlements.forEach(ent => addTransferLeaveEntitlementRow(ent));
                } catch (error) {
                    console.error('Error loading leave entitlements:', error);
                }
            }
        };
    } catch (error) {
        console.error('Error loading employees:', error);
    }

    try {
        populateCascadingCountrySelect('transfer-employee-to-country');
        document.getElementById('transfer-employee-to-location-type').innerHTML = '<option value="">Select Location</option>';
        document.getElementById('transfer-employee-to-sublocation-business-type').innerHTML = '<option value="">Select Sub / Business</option>';
    } catch (error) {
        console.error('Error loading locations:', error);
    }

    // Populate edit mode values after dropdowns are built
    if (isEdit && transferData) {
        document.getElementById('transfer-employee-serial').value = transferData.transfer_serial_number || '';
        empSelect.value = transferData.emp_db_id || transferData.employee_id || '';
        // Trigger onchange manually to load previous values and entitlements
        if (typeof empSelect.onchange === 'function') {
            empSelect.onchange();
        }
        // Then override with saved previous values from the transfer snapshot
        transferPrevRemunerationType = transferData.prev_remuneration_type || '';
        transferPrevRemuneration = transferData.prev_remuneration || '';
        document.getElementById('transfer-remuneration-type').value = transferData.new_remuneration_type || '';
        document.getElementById('transfer-remuneration').value = transferData.new_remuneration || '';
        const fromSub = [transferData.from_sub_location_name, transferData.from_business_type_name, transferData.from_business_unit_code].filter(Boolean).join(' - ') || '';
        document.getElementById('transfer-employee-from-country').value = transferData.from_country_name || '';
        document.getElementById('transfer-employee-from-location-type').value = transferData.from_location_type_name || '';
        document.getElementById('transfer-employee-from-sublocation-business-type').value = fromSub;
        document.getElementById('transfer-employee-from-location-id').value = transferData.from_location_id || '';
        await setCascadingLocationByAssignment(transferData.to_location_id || '', 'transfer-employee-to-country', 'transfer-employee-to-location-type', 'transfer-employee-to-sublocation-business-type');
        document.getElementById('transfer-employee-date').value = transferData.transfer_date || '';
        document.getElementById('transfer-employee-reason').value = transferData.reason || '';
        document.getElementById('transfer-employee-notes').value = transferData.notes || '';
        document.getElementById('transfer-employee-created-by').value = transferData.created_by || '';
        // Restore previous leave entitlements snapshot
        transferPrevLeaveEntitlements = [];
        document.getElementById('transfer-leave-entitlements-container').innerHTML = '';
        try {
            const prevLeaves = transferData.prev_leave_entitlements ? JSON.parse(transferData.prev_leave_entitlements) : [];
            transferPrevLeaveEntitlements = prevLeaves;
        } catch (e) { console.error('Error parsing previous leave entitlements:', e); }
        // Restore new leave entitlements snapshot
        try {
            const newLeaves = transferData.new_leave_entitlements ? JSON.parse(transferData.new_leave_entitlements) : [];
            newLeaves.forEach(ent => addTransferLeaveEntitlementRow(ent));
        } catch (e) { console.error('Error parsing new leave entitlements:', e); }
    }

    modal.classList.add('active');
}

function closeTransferEmployeeModal() {
    document.getElementById('transfer-employee-modal').classList.remove('active');
}

async function editEmployeeTransfer(id) {
    await openTransferEmployeeModal(id);
}

async function deleteEmployeeTransfer(id) {
    if (!confirm('Are you sure you want to delete this transfer?')) return;
    const managerId = currentModuleManager ? currentModuleManager.id : '';
    try {
        const response = await fetch(`${API_BASE}/employee-transfers/${id}?manager_id=${managerId}`, { method: 'DELETE' });
        if (!response.ok) {
            const err = await response.json().catch(() => ({ error: 'Unknown error' }));
            alert('Error: ' + (err.error || response.statusText));
            return;
        }
        alert('Transfer deleted successfully');
        loadEmployeeTransfers();
    } catch (error) {
        console.error('Error deleting transfer:', error);
        alert('Error deleting transfer');
    }
}

async function saveTransferEmployee(e) {
    e.preventDefault();
    const newLeaveEntitlements = getTransferLeaveEntitlements();
    const data = {
        transfer_serial_number: document.getElementById('transfer-employee-serial').value,
        employee_id: document.getElementById('transfer-employee-employee-id').value,
        from_location_id: document.getElementById('transfer-employee-from-location-id').value,
        to_location_id: document.getElementById('transfer-employee-to-sublocation-business-type').value,
        transfer_date: document.getElementById('transfer-employee-date').value,
        reason: document.getElementById('transfer-employee-reason').value,
        notes: document.getElementById('transfer-employee-notes').value,
        created_by: document.getElementById('transfer-employee-created-by').value,
        prev_remuneration_type: transferPrevRemunerationType,
        prev_remuneration: transferPrevRemuneration,
        new_remuneration_type: document.getElementById('transfer-remuneration-type').value,
        new_remuneration: document.getElementById('transfer-remuneration').value,
        prev_leave_entitlements: transferPrevLeaveEntitlements,
        new_leave_entitlements: newLeaveEntitlements
    };
    if (!data.employee_id || !data.to_location_id || !data.transfer_date || !data.reason) {
        alert('Please fill all required fields');
        return;
    }
    const transferId = document.getElementById('transfer-employee-id').value;
    const managerId = currentModuleManager ? currentModuleManager.id : '';
    const url = transferId ? `${API_BASE}/employee-transfers/${transferId}?manager_id=${managerId}` : `${API_BASE}/employee-transfers?manager_id=${managerId}`;
    const method = transferId ? 'PUT' : 'POST';
    try {
        const response = await fetch(url, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        if (!response.ok) {
            const err = await response.json().catch(() => ({ error: 'Unknown error' }));
            alert('Error: ' + (err.error || response.statusText));
            return;
        }
        alert(transferId ? 'Transfer updated successfully' : 'Employee transferred successfully');
        closeTransferEmployeeModal();
        loadEmployeeTransfers();
    } catch (error) {
        console.error('Error transferring employee:', error);
        alert('Error transferring employee');
    }
}

async function viewEmployeeTransfer(id) {
    try {
        const response = await fetch(`${API_BASE}/employee-transfers/${id}`);
        const t = await response.json();

        // Remuneration changes
        let remChangeHtml = '';
        if (t.prev_remuneration_type || t.new_remuneration_type || t.prev_remuneration || t.new_remuneration) {
            const prevRem = t.prev_remuneration_type ? `${t.prev_remuneration_type}: ${t.prev_remuneration || '0'}` : 'N/A';
            const newRem = t.new_remuneration_type ? `${t.new_remuneration_type}: ${t.new_remuneration || '0'}` : 'N/A';
            const changed = (t.prev_remuneration_type !== t.new_remuneration_type || t.prev_remuneration !== t.new_remuneration);
            remChangeHtml = `
                <div class="mt-4 p-3 ${changed ? 'bg-yellow-50 border-yellow-200' : 'bg-gray-50 border-gray-200'} border rounded-lg">
                    <h4 class="font-semibold text-sm mb-2"><i class="fas fa-money-bill-wave mr-1"></i>Remuneration</h4>
                    <div class="grid grid-cols-2 gap-2 text-sm">
                        <div><strong>Previous:</strong> ${prevRem}</div>
                        <div><strong>New:</strong> ${newRem}</div>
                    </div>
                </div>`;
        }

        // Leave entitlement changes
        let leaveChangeHtml = '';
        let prevLeaves = [];
        let newLeaves = [];
        try { prevLeaves = t.prev_leave_entitlements ? JSON.parse(t.prev_leave_entitlements) : []; } catch(e) {}
        try { newLeaves = t.new_leave_entitlements ? JSON.parse(t.new_leave_entitlements) : []; } catch(e) {}
        if (prevLeaves.length > 0 || newLeaves.length > 0) {
            leaveChangeHtml = `
                <div class="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <h4 class="font-semibold text-sm mb-2"><i class="fas fa-calendar-alt mr-1"></i>Leave Entitlements</h4>
                    <div class="grid grid-cols-2 gap-4 text-sm">
                        <div>
                            <strong class="text-gray-600">Previous:</strong>
                            ${prevLeaves.length > 0 ? prevLeaves.map(le => `<div class="ml-2">${le.leave_type}: ${le.days_count}d ${le.condition_type} ${le.months_count} ${le.period_type || 'months'}</div>`).join('') : '<div class="ml-2 text-gray-400">None</div>'}
                        </div>
                        <div>
                            <strong class="text-gray-600">New:</strong>
                            ${newLeaves.length > 0 ? newLeaves.map(le => `<div class="ml-2">${le.leave_type}: ${le.days_count}d ${le.condition_type} ${le.months_count} ${le.period_type || 'months'}</div>`).join('') : '<div class="ml-2 text-gray-400">None</div>'}
                        </div>
                    </div>
                </div>`;
        }

        const detailsHtml = `
            <div class="p-6">
                <h3 class="text-xl font-semibold mb-4"><i class="fas fa-exchange-alt mr-2 text-green-600"></i>Transfer Details</h3>
                <div class="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
                    <div><strong>Transfer #:</strong> ${t.transfer_serial_number || 'N/A'}</div>
                    <div><strong>Employee:</strong> ${t.employee_name || 'N/A'}</div>
                    <div><strong>Employee ID:</strong> ${t.employee_id || 'N/A'}</div>
                    <div><strong>Transfer Date:</strong> ${formatDate(t.transfer_date)}</div>
                    <div><strong>From Country:</strong> ${t.from_country_name || 'N/A'}</div>
                    <div><strong>To Country:</strong> ${t.to_country_name || 'N/A'}</div>
                    <div><strong>From Location:</strong> ${t.from_location_type_name || 'N/A'}</div>
                    <div><strong>To Location:</strong> ${t.to_location_type_name || 'N/A'}</div>
                    <div><strong>From Sub / Business:</strong> ${[t.from_sub_location_name, t.from_business_type_name, t.from_business_unit_code].filter(Boolean).join(' - ') || 'N/A'}</div>
                    <div><strong>To Sub / Business:</strong> ${[t.to_sub_location_name, t.to_business_type_name, t.to_business_unit_code].filter(Boolean).join(' - ') || 'N/A'}</div>
                    <div><strong>Reason:</strong> ${t.reason || 'N/A'}</div>
                    <div><strong>Created By:</strong> ${t.created_by || 'N/A'}</div>
                    <div class="col-span-2"><strong>Notes:</strong> ${t.notes || 'N/A'}</div>
                </div>
                ${remChangeHtml}
                ${leaveChangeHtml}
                <div class="mt-6 flex justify-end">
                    <button onclick="closeEmployeeViewModal()" class="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700">Close</button>
                </div>
            </div>
        `;

        let viewModal = document.getElementById('employee-view-modal');
        if (!viewModal) {
            viewModal = document.createElement('div');
            viewModal.id = 'employee-view-modal';
            viewModal.className = 'modal fixed inset-0 bg-black bg-opacity-50 items-center justify-center z-50';
            document.body.appendChild(viewModal);
        }
        viewModal.innerHTML = `<div class="bg-white rounded-lg shadow-xl w-full max-w-2xl my-6 max-h-[80vh] overflow-y-auto">${detailsHtml}</div>`;
        viewModal.classList.add('active');
    } catch (error) {
        console.error('Error viewing transfer:', error);
    }
}

// Employee Documents
let allEmployeeDocuments = [];

async function loadEmployeeDocuments() {
    showTableLoading('employee-documents-table-body', 'Loading employee documents...');
    try {
        const response = await fetch(`${API_BASE}/employee-documents`);
        allEmployeeDocuments = await response.json();
        populateDocTypeFilter();
        filterEmployeeDocuments();
    } catch (error) {
        console.error('Error loading employee documents:', error);
        showTableError('employee-documents-table-body', 'Error loading employee documents.');
    }
}

function populateDocTypeFilter() {
    const select = document.getElementById('emp-doc-type-filter');
    if (!select) return;
    const types = [...new Set(allEmployeeDocuments.map(d => d.document_type).filter(Boolean))].sort();
    const current = select.value;
    select.innerHTML = '<option value="">All Document Types</option>' +
        types.map(t => `<option value="${t}">${t}</option>`).join('');
    select.value = current;
}

function filterEmployeeDocuments() {
    const search = (document.getElementById('emp-doc-search').value || '').toLowerCase();
    const typeFilter = document.getElementById('emp-doc-type-filter').value;
    const expiryBefore = document.getElementById('emp-doc-expiry-before').value;

    const filtered = allEmployeeDocuments.filter(doc => {
        const name = `${doc.first_name || ''} ${doc.last_name || ''} ${doc.emp_id || ''}`.toLowerCase();
        const matchesSearch = !search || name.includes(search);
        const matchesType = !typeFilter || doc.document_type === typeFilter;
        let matchesExpiry = true;
        if (expiryBefore && doc.expiry_date) {
            matchesExpiry = doc.expiry_date <= expiryBefore;
        } else if (expiryBefore && !doc.expiry_date) {
            matchesExpiry = false;
        }
        return matchesSearch && matchesType && matchesExpiry;
    });

    renderEmployeeDocumentsList(filtered);
}

function clearEmployeeDocFilters() {
    document.getElementById('emp-doc-search').value = '';
    document.getElementById('emp-doc-type-filter').value = '';
    document.getElementById('emp-doc-expiry-before').value = '';
    renderEmployeeDocuments();
}

function getDaysToExpiry(expiryDate) {
    if (!expiryDate) return { text: '-', class: '' };
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const expiry = new Date(expiryDate);
    expiry.setHours(0, 0, 0, 0);
    const diffTime = expiry - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    if (diffDays < 0) return { text: `Expired (${Math.abs(diffDays)} days ago)`, class: 'bg-red-100 text-red-800' };
    if (diffDays <= 30) return { text: `${diffDays} days`, class: 'bg-yellow-100 text-yellow-800' };
    if (diffDays <= 90) return { text: `${diffDays} days`, class: 'bg-blue-100 text-blue-800' };
    return { text: `${diffDays} days`, class: 'bg-green-100 text-green-800' };
}

function renderEmployeeDocuments() {
    renderEmployeeDocumentsList(allEmployeeDocuments);
}

function renderEmployeeDocumentsList(docs) {
    const tbody = document.getElementById('employee-documents-table-body');
    if (!tbody) return;
    tbody.innerHTML = docs.map(doc => {
        const expiry = getDaysToExpiry(doc.expiry_date);
        return `
        <tr>
            <td class="px-3 py-2 whitespace-nowrap">
                ${doc.employee_photo ? `<img src="${doc.employee_photo}" class="w-8 h-8 rounded-full object-cover inline-block mr-2 align-middle">` : `<span class="w-8 h-8 rounded-full bg-gray-200 inline-flex items-center justify-center mr-2 align-middle text-gray-500 text-xs"><i class="fas fa-user"></i></span>`}${doc.first_name || ''} ${doc.last_name || ''} ${doc.emp_id ? '(' + doc.emp_id + ')' : ''}
            </td>
            <td class="px-3 py-2 whitespace-nowrap">${doc.document_type || '-'}</td>
            <td class="px-3 py-2 whitespace-nowrap font-medium text-gray-700">${doc.document_number || '-'}</td>
            <td class="px-3 py-2 whitespace-nowrap">${doc.issued_date || '-'}</td>
            <td class="px-3 py-2 whitespace-nowrap">${doc.expiry_date || '-'}</td>
            <td class="px-3 py-2 whitespace-nowrap"><span class="px-2 py-0.5 text-xs rounded-full ${expiry.class}">${expiry.text}</span></td>
            <td class="px-3 py-2 whitespace-nowrap">${doc.document_path ? doc.document_path.split(',').map((p, i) => `<a href="${p.trim()}" target="_blank" class="text-blue-600 hover:underline mr-2"><i class="fas fa-file-download mr-1"></i>${doc.document_path.split(',').length > 1 ? (i+1) : 'View'}</a>`).join('') : '-'}</td>
            <td class="px-3 py-2 whitespace-nowrap">
                <button onclick="editEmployeeDocument(${doc.id})" class="text-blue-600 hover:text-blue-800 mr-2"><i class="fas fa-edit"></i></button>
                <button onclick="deleteEmployeeDocument(${doc.id})" class="text-red-600 hover:text-red-800"><i class="fas fa-trash"></i></button>
            </td>
        </tr>`;
    }).join('');
}

let employeeDocEmployees = [];
let employeeDocTypes = [];

async function openEmployeeDocumentModal(id = null) {
    const modal = document.getElementById('employee-document-modal');
    const form = document.getElementById('employee-document-form');
    const title = document.getElementById('employee-document-modal-title');
    form.reset();
    document.getElementById('employee-document-id').value = '';
    document.getElementById('employee-document-employee').value = '';
    document.getElementById('employee-document-employee-search').value = '';
    document.getElementById('employee-document-employee-dropdown').classList.add('hidden');
    document.getElementById('employee-document-rows').innerHTML = '';

    // Load employees for searchable dropdown
    try {
        const empResponse = await fetch(`${API_BASE}/employees?active=true`);
        employeeDocEmployees = await empResponse.json();
    } catch (error) {
        console.error('Error loading employees for document modal:', error);
    }

    // Populate document type dropdown
    try {
        const dtResponse = await fetch(`${API_BASE}/document-types`);
        employeeDocTypes = await dtResponse.json();
    } catch (error) {
        console.error('Error loading document types for document modal:', error);
    }

    if (id) {
        const doc = allEmployeeDocuments.find(d => d.id === id);
        if (doc) {
            title.textContent = 'Edit Employee Document';
            document.getElementById('employee-document-id').value = doc.id;
            document.getElementById('employee-document-employee').value = doc.employee_id;
            document.getElementById('employee-document-employee-search').value = `${doc.first_name || ''} ${doc.last_name || ''} (${doc.emp_id || ''})`;
            document.getElementById('add-document-row-btn').style.display = 'none';

            const row = addDocumentRow(true);
            row.querySelector('.doc-row-type').value = doc.document_type;
            row.querySelector('.doc-row-number').value = doc.document_number || '';
            row.querySelector('.doc-row-issued').value = doc.issued_date || '';
            row.querySelector('.doc-row-expiry').value = doc.expiry_date || '';
            if (doc.document_path) {
                const paths = doc.document_path.split(',').filter(p => p.trim());
                const filesList = row.querySelector('.doc-row-files');
                paths.forEach(path => {
                    const fileName = path.split('/').pop();
                    const fileRow = document.createElement('div');
                    fileRow.className = 'flex items-center gap-2 p-2 bg-gray-50 rounded border text-sm';
                    fileRow.innerHTML = `
                        <i class="fas fa-file text-blue-500"></i>
                        <a href="${path}" target="_blank" class="text-blue-600 hover:underline flex-1 truncate">${fileName}</a>
                        <input type="hidden" name="existing_doc_path" value="${path}">
                        <button type="button" onclick="this.parentElement.remove()" class="text-red-500 hover:text-red-700"><i class="fas fa-times"></i></button>
                    `;
                    filesList.appendChild(fileRow);
                });
            }
        }
    } else {
        title.textContent = 'Add Employee Document';
        document.getElementById('add-document-row-btn').style.display = '';
        addDocumentRow(true);
    }
    modal.classList.add('active');
}

function showEmployeeDocDropdown() {
    filterEmployeeDocDropdown();
    document.getElementById('employee-document-employee-dropdown').classList.remove('hidden');
}

function filterEmployeeDocDropdown() {
    const search = document.getElementById('employee-document-employee-search').value.toLowerCase();
    const dropdown = document.getElementById('employee-document-employee-dropdown');
    const filtered = employeeDocEmployees.filter(e => {
        const name = `${e.first_name} ${e.last_name}`.toLowerCase();
        const empId = (e.employee_id || '').toLowerCase();
        return name.includes(search) || empId.includes(search);
    });
    dropdown.innerHTML = filtered.length ? filtered.map(e =>
        `<div class="px-3 py-2 hover:bg-blue-50 cursor-pointer text-sm" onclick="selectEmployeeDocEmployee(${e.id}, '${e.first_name} ${e.last_name}', '${e.employee_id || ''}')">${e.first_name} ${e.last_name} (${e.employee_id || 'No ID'})</div>`
    ).join('') : '<div class="px-3 py-2 text-gray-400 text-sm">No employees found</div>';
    dropdown.classList.remove('hidden');
}

function selectEmployeeDocEmployee(id, name, empId) {
    document.getElementById('employee-document-employee').value = id;
    document.getElementById('employee-document-employee-search').value = `${name} (${empId})`;
    document.getElementById('employee-document-employee-dropdown').classList.add('hidden');
}

// Close dropdown when clicking outside
document.addEventListener('click', function(e) {
    const dropdown = document.getElementById('employee-document-employee-dropdown');
    const searchInput = document.getElementById('employee-document-employee-search');
    if (dropdown && searchInput && !dropdown.contains(e.target) && e.target !== searchInput) {
        dropdown.classList.add('hidden');
    }
});

function addEmployeeDocumentRow(isFirst = false) {
    const rowsContainer = document.getElementById('employee-documents-container');
    const row = document.createElement('div');
    row.className = 'border rounded-lg p-3 bg-gray-50 space-y-2 relative';
    const typeOptions = '<option value="">Select Document Type</option>' +
        employeeDocTypes.map(dt => `<option value="${dt.name}">${dt.name}</option>`).join('');
    row.innerHTML = `
        ${!isFirst ? '<button type="button" onclick="this.parentElement.remove()" class="absolute top-2 right-2 text-red-500 hover:text-red-700"><i class="fas fa-times"></i></button>' : ''}
        <div class="grid grid-cols-2 gap-2">
            <div>
                <label class="block text-xs font-medium text-gray-600 mb-1">Document Type *</label>
                <select class="emp-doc-row-type w-full px-2 py-1.5 border rounded-lg text-sm" required>${typeOptions}</select>
            </div>
            <div>
                <label class="block text-xs font-medium text-gray-600 mb-1">Document Number</label>
                <input type="text" class="emp-doc-row-number w-full px-2 py-1.5 border rounded-lg text-sm" placeholder="e.g. Passport No.">
            </div>
        </div>
        <div class="grid grid-cols-2 gap-2">
            <div>
                <label class="block text-xs font-medium text-gray-600 mb-1">Issued Date</label>
                <input type="date" class="emp-doc-row-issued w-full px-2 py-1.5 border rounded-lg text-sm">
            </div>
            <div>
                <label class="block text-xs font-medium text-gray-600 mb-1">Expiry Date</label>
                <input type="date" class="emp-doc-row-expiry w-full px-2 py-1.5 border rounded-lg text-sm">
            </div>
        </div>
        <div>
            <label class="block text-xs font-medium text-gray-600 mb-1">Attachments</label>
            <div class="emp-doc-row-files space-y-1.5 mb-1.5"></div>
            <button type="button" onclick="addEmployeeFileToRow(this)" class="text-blue-600 hover:text-blue-800 text-xs"><i class="fas fa-plus mr-1"></i>Add File</button>
        </div>
    `;
    rowsContainer.appendChild(row);
    addEmployeeFileToRow(row.querySelector('button'));
    return row;
}

function addEmployeeFileToRow(btn) {
    const filesList = btn.previousElementSibling;
    const fileRow = document.createElement('div');
    fileRow.className = 'flex items-center gap-2';
    fileRow.innerHTML = `
        <input type="file" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" class="flex-1 px-2 py-1 border rounded-lg text-xs emp-doc-file-input">
        <button type="button" onclick="this.parentElement.remove()" class="text-red-500 hover:text-red-700 px-1"><i class="fas fa-times text-xs"></i></button>
    `;
    filesList.appendChild(fileRow);
}

function addDocumentRow(isFirst = false) {
    const rowsContainer = document.getElementById('employee-document-rows');
    const row = document.createElement('div');
    row.className = 'border rounded-lg p-3 bg-gray-50 space-y-2 relative';
    const typeOptions = '<option value="">Select Document Type</option>' +
        employeeDocTypes.map(dt => `<option value="${dt.name}">${dt.name}</option>`).join('');
    row.innerHTML = `
        ${!isFirst ? '<button type="button" onclick="this.parentElement.remove()" class="absolute top-2 right-2 text-red-500 hover:text-red-700"><i class="fas fa-times"></i></button>' : ''}
        <div class="grid grid-cols-2 gap-2">
            <div>
                <label class="block text-xs font-medium text-gray-600 mb-1">Document Type *</label>
                <select class="doc-row-type w-full px-2 py-1.5 border rounded-lg text-sm" required>${typeOptions}</select>
            </div>
            <div>
                <label class="block text-xs font-medium text-gray-600 mb-1">Document Number</label>
                <input type="text" class="doc-row-number w-full px-2 py-1.5 border rounded-lg text-sm" placeholder="e.g. Passport No.">
            </div>
        </div>
        <div class="grid grid-cols-2 gap-2">
            <div>
                <label class="block text-xs font-medium text-gray-600 mb-1">Issued Date</label>
                <input type="date" class="doc-row-issued w-full px-2 py-1.5 border rounded-lg text-sm">
            </div>
            <div>
                <label class="block text-xs font-medium text-gray-600 mb-1">Expiry Date</label>
                <input type="date" class="doc-row-expiry w-full px-2 py-1.5 border rounded-lg text-sm">
            </div>
        </div>
        <div>
            <label class="block text-xs font-medium text-gray-600 mb-1">Attachments</label>
            <div class="doc-row-files space-y-1.5 mb-1.5"></div>
            <button type="button" onclick="addFileToRow(this)" class="text-blue-600 hover:text-blue-800 text-xs"><i class="fas fa-plus mr-1"></i>Add File</button>
        </div>
    `;
    rowsContainer.appendChild(row);
    addFileToRow(row.querySelector('button'));
    return row;
}

function addFileToRow(btn) {
    const filesList = btn.previousElementSibling;
    const fileRow = document.createElement('div');
    fileRow.className = 'flex items-center gap-2';
    fileRow.innerHTML = `
        <input type="file" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" class="flex-1 px-2 py-1 border rounded-lg text-xs">
        <button type="button" onclick="this.parentElement.remove()" class="text-red-500 hover:text-red-700 px-1"><i class="fas fa-times text-xs"></i></button>
    `;
    filesList.appendChild(fileRow);
}

function closeEmployeeDocumentModal() {
    document.getElementById('employee-document-modal').classList.remove('active');
}

async function saveEmployeeDocument(e) {
    e.preventDefault();
    const id = document.getElementById('employee-document-id').value;
    const employeeId = document.getElementById('employee-document-employee').value;

    if (!employeeId) {
        alert('Please select an employee');
        return;
    }

    const rows = document.querySelectorAll('#employee-document-rows > div');
    if (rows.length === 0) {
        alert('Please add at least one document');
        return;
    }

    const saveBtn = e.target.querySelector('button[type="submit"]');
    const originalText = saveBtn.textContent;
    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving...';

    try {
        if (id) {
            // Edit mode - single document
            const row = rows[0];
            const formData = new FormData();
            formData.append('employee_id', employeeId);
            formData.append('document_type', row.querySelector('.doc-row-type').value);
            formData.append('document_number', row.querySelector('.doc-row-number').value);
            formData.append('issued_date', row.querySelector('.doc-row-issued').value);
            formData.append('expiry_date', row.querySelector('.doc-row-expiry').value);

            row.querySelectorAll('.doc-row-files input[type="file"]').forEach(input => {
                if (input.files && input.files[0]) formData.append('documents', input.files[0]);
            });
            row.querySelectorAll('.doc-row-files input[name="existing_doc_path"]').forEach(input => {
                formData.append('existing_documents', input.value);
            });

            const docType = row.querySelector('.doc-row-type').value;
            const docNumber = row.querySelector('.doc-row-number').value;
            const response = await fetch(`${API_BASE}/employee-documents/${id}`, { method: 'PUT', body: formData });
            if (response.ok) {
                const emp = allEmployees.find(e => e.id == employeeId);
                const empName = emp ? `${emp.first_name} ${emp.last_name}` : 'Unknown';
                await logAudit('UPDATE', 'employee-documents', 'EmployeeDocument', id, `Employee: ${empName}, Doc Type: ${docType}${docNumber ? ', Doc No: ' + docNumber : ''}`);
            } else {
                const errData = await response.json().catch(() => ({}));
                alert('Error updating document: ' + (errData.error || 'Unknown error'));
            }
        } else {
            // Add mode - multiple documents
            let successCount = 0;
            let errorCount = 0;
            for (const row of rows) {
                const docType = row.querySelector('.doc-row-type').value;
                if (!docType) {
                    alert('Please select a document type for all rows');
                    return;
                }

                const formData = new FormData();
                formData.append('employee_id', employeeId);
                formData.append('document_type', docType);
                formData.append('document_number', row.querySelector('.doc-row-number').value);
                formData.append('issued_date', row.querySelector('.doc-row-issued').value);
                formData.append('expiry_date', row.querySelector('.doc-row-expiry').value);

                row.querySelectorAll('.doc-row-files input[type="file"]').forEach(input => {
                    if (input.files && input.files[0]) formData.append('documents', input.files[0]);
                });

                const docNumber = row.querySelector('.doc-row-number').value;
                const response = await fetch(`${API_BASE}/employee-documents`, { method: 'POST', body: formData });
                if (response.ok) {
                    successCount++;
                    const emp = allEmployees.find(e => e.id == employeeId);
                    const empName = emp ? `${emp.first_name} ${emp.last_name}` : 'Unknown';
                    await logAudit('CREATE', 'employee-documents', 'EmployeeDocument', null, `Employee: ${empName}, Doc Type: ${docType}${docNumber ? ', Doc No: ' + docNumber : ''}`);
                } else {
                    errorCount++;
                    const errData = await response.json().catch(() => ({}));
                    console.error('Failed to save document:', docType, errData.error);
                }
            }
            if (errorCount > 0) {
                alert(`${successCount} document(s) saved successfully. ${errorCount} failed.`);
            }
        }
        closeEmployeeDocumentModal();
        loadEmployeeDocuments();
    } catch (error) {
        console.error('Error saving employee document:', error);
        alert('Error saving document: ' + error.message);
    } finally {
        saveBtn.disabled = false;
        saveBtn.textContent = originalText;
    }
}

function editEmployeeDocument(id) {
    openEmployeeDocumentModal(id);
}

async function deleteEmployeeDocument(id) {
    if (confirm('Are you sure you want to delete this document?')) {
        try {
            const doc = allEmployeeDocuments.find(d => d.id === id);
            const response = await fetch(`${API_BASE}/employee-documents/${id}`, { method: 'DELETE' });
            if (response.ok) {
                const empName = doc ? `${doc.first_name || ''} ${doc.last_name || ''}`.trim() : 'Unknown';
                await logAudit('DELETE', 'employee-documents', 'EmployeeDocument', id, `Employee: ${empName}, Doc Type: ${doc?.document_type || 'Unknown'}${doc?.document_number ? ', Doc No: ' + doc.document_number : ''}`);
            }
            loadEmployeeDocuments();
        } catch (error) {
            console.error('Error deleting employee document:', error);
        }
    }
}

// Bulk import employees
function openBulkImportEmployeesModal() {
    let modal = document.getElementById('bulk-import-employees-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'bulk-import-employees-modal';
        modal.className = 'modal fixed inset-0 bg-black bg-opacity-50 items-center justify-center z-50';
        modal.innerHTML = `
            <div class="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[85vh] my-6 overflow-hidden flex flex-col">
                <div class="p-6 border-b flex justify-between items-center">
                    <h3 class="text-xl font-semibold"><i class="fas fa-file-import mr-2 text-teal-600"></i>Bulk Import Employees</h3>
                    <button onclick="closeBulkImportEmployeesModal()" class="text-gray-400 hover:text-gray-600"><i class="fas fa-times text-lg"></i></button>
                </div>
                <div class="p-6 overflow-y-auto flex-1">
                    <div class="bg-blue-50 border border-blue-100 rounded-lg p-4 mb-4 text-sm text-blue-800">
                        <p class="font-medium mb-1">How it works</p>
                        <ul class="list-disc list-inside space-y-1">
                            <li>Download the Excel template below and fill one row per employee.</li>
                            <li>Required columns: <strong>first_name, last_name, remuneration_type, remuneration</strong>.</li>
                            <li><strong>Employee ID is automatically generated</strong> to avoid duplicates.</li>
                            <li>Use the database dropdowns in <strong>Country</strong>, <strong>Location</strong>, and <strong>Sublocation / Business Type</strong> to avoid location errors.</li>
                            <li>Department, Position, Status, Nationality and Remuneration Type will be matched by name and created if not found.</li>
                            <li>Leave entitlements can be added individually after import.</li>
                        </ul>
                    </div>
                    <div class="flex flex-wrap gap-3 mb-4">
                        <button onclick="downloadEmployeeImportTemplate()" class="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-sm">
                            <i class="fas fa-download mr-1"></i> Download Excel Template
                        </button>
                        <label class="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 text-sm cursor-pointer inline-flex items-center">
                            <i class="fas fa-folder-open mr-1"></i> Choose Import File
                            <input type="file" id="bulk-import-employees-file" accept=".xlsx,.csv" class="hidden" onchange="previewEmployeeImportCsv()">
                        </label>
                        <button onclick="importEmployeesCsv()" id="bulk-import-employees-btn" class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm disabled:opacity-50 disabled:cursor-not-allowed" disabled>
                            <i class="fas fa-upload mr-1"></i> Import
                        </button>
                    </div>
                    <div id="bulk-import-employees-file-name" class="text-sm text-gray-600 mb-2"></div>
                    <div id="bulk-import-employees-preview" class="hidden">
                        <div class="text-sm font-medium text-gray-700 mb-2">Preview (first 5 rows)</div>
                        <div class="overflow-x-auto border rounded-lg">
                            <table class="w-full text-sm">
                                <thead class="bg-gray-50">
                                    <tr id="bulk-import-employees-preview-head"></tr>
                                </thead>
                                <tbody id="bulk-import-employees-preview-body" class="divide-y divide-gray-100"></tbody>
                            </table>
                        </div>
                    </div>
                    <div id="bulk-import-employees-result" class="mt-4 hidden"></div>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    }
    modal.classList.add('active');
    document.getElementById('bulk-import-employees-result').classList.add('hidden');
    document.getElementById('bulk-import-employees-result').innerHTML = '';
    document.getElementById('bulk-import-employees-preview').classList.add('hidden');
    document.getElementById('bulk-import-employees-file-name').textContent = '';
    document.getElementById('bulk-import-employees-btn').disabled = true;
    const fileInput = document.getElementById('bulk-import-employees-file');
    if (fileInput) fileInput.value = '';
    window._bulkImportEmployeesCsv = null;
    window._bulkImportEmployeesXlsx = null;
}

function closeBulkImportEmployeesModal() {
    const modal = document.getElementById('bulk-import-employees-modal');
    if (modal) modal.classList.remove('active');
}

async function downloadEmployeeImportTemplate() {
    try {
        const response = await fetch(`${API_BASE}/employees/bulk-import/template-xlsx?t=${Date.now()}`);
        if (!response.ok) throw new Error('Failed to download template');
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'employee_import_template.xlsx';
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);
    } catch (error) {
        console.error('Error downloading template:', error);
        alert('Error downloading template');
    }
}

function parseEmployeeImportCsv(text) {
    const rows = [];
    let row = [];
    let cell = '';
    let inQuotes = false;
    for (let i = 0; i < text.length; i++) {
        const char = text[i];
        if (inQuotes) {
            if (char === '"') {
                if (i + 1 < text.length && text[i + 1] === '"') {
                    cell += '"';
                    i++;
                } else {
                    inQuotes = false;
                }
            } else {
                cell += char;
            }
        } else {
            if (char === '"') {
                inQuotes = true;
            } else if (char === ',') {
                row.push(cell);
                cell = '';
            } else if (char === '\n' || char === '\r') {
                if (cell !== '' || row.length > 0) {
                    row.push(cell);
                    rows.push(row);
                    row = [];
                }
                cell = '';
            } else {
                cell += char;
            }
        }
    }
    if (cell !== '' || row.length > 0) {
        row.push(cell);
        rows.push(row);
    }
    return rows;
}

function previewEmployeeImportCsv() {
    const fileInput = document.getElementById('bulk-import-employees-file');
    const fileNameEl = document.getElementById('bulk-import-employees-file-name');
    const previewDiv = document.getElementById('bulk-import-employees-preview');
    const previewHead = document.getElementById('bulk-import-employees-preview-head');
    const previewBody = document.getElementById('bulk-import-employees-preview-body');
    const importBtn = document.getElementById('bulk-import-employees-btn');
    const resultDiv = document.getElementById('bulk-import-employees-result');

    resultDiv.classList.add('hidden');
    resultDiv.innerHTML = '';

    if (!fileInput.files || !fileInput.files[0]) {
        previewDiv.classList.add('hidden');
        importBtn.disabled = true;
        fileNameEl.textContent = '';
        window._bulkImportEmployeesCsv = null;
        window._bulkImportEmployeesXlsx = null;
        return;
    }

    const file = fileInput.files[0];
    fileNameEl.textContent = `Selected: ${file.name}`;

    if (file.name.toLowerCase().endsWith('.xlsx')) {
        const reader = new FileReader();
        reader.onload = function(e) {
            window._bulkImportEmployeesXlsx = e.target.result.split(',')[1];
            window._bulkImportEmployeesCsv = null;
            previewDiv.classList.add('hidden');
            importBtn.disabled = false;
            fileNameEl.textContent = `Selected: ${file.name} (Excel workbook ready to import)`;
        };
        reader.readAsDataURL(file);
        return;
    }

    const reader = new FileReader();
    reader.onload = function(e) {
        const text = e.target.result;
        window._bulkImportEmployeesCsv = text;
        window._bulkImportEmployeesXlsx = null;
        const rows = parseEmployeeImportCsv(text);
        if (rows.length < 2) {
            previewDiv.classList.add('hidden');
            importBtn.disabled = true;
            alert('CSV must contain a header and at least one data row.');
            return;
        }
        const headers = rows[0];
        previewHead.innerHTML = headers.map(h => `<th class="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">${h}</th>`).join('');
        previewBody.innerHTML = rows.slice(1, 6).map(r => {
            return `<tr>${headers.map((_, i) => `<td class="px-3 py-2 whitespace-nowrap">${r[i] || ''}</td>`).join('')}</tr>`;
        }).join('');
        previewDiv.classList.remove('hidden');
        importBtn.disabled = false;
    };
    reader.readAsText(file);
}

async function importEmployeesCsv() {
    const csvText = window._bulkImportEmployeesCsv;
    const xlsxData = window._bulkImportEmployeesXlsx;
    if ((!csvText || !csvText.trim()) && !xlsxData) {
        alert('Please select a CSV or Excel file first.');
        return;
    }

    const importBtn = document.getElementById('bulk-import-employees-btn');
    const resultDiv = document.getElementById('bulk-import-employees-result');
    importBtn.disabled = true;
    importBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-1"></i> Importing...';

    try {
        const response = await fetch(`${API_BASE}/employees/bulk-import`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(xlsxData ? { xlsx: xlsxData } : { csv: csvText })
        });
        const result = await response.json();
        if (!response.ok) {
            throw new Error(result.error || 'Import failed');
        }

        let html = `
            <div class="bg-green-50 border border-green-200 rounded-lg p-4 text-sm">
                <p class="font-semibold text-green-800">Import complete</p>
                <p class="text-green-700">${result.success} of ${result.total} employees imported successfully.</p>
        `;
        if (result.errors && result.errors.length > 0) {
            html += `<div class="mt-2 text-red-700"><p class="font-medium">Errors:</p><ul class="list-disc list-inside">`;
            result.errors.forEach(err => {
                html += `<li>Row ${err.row}: ${err.message}</li>`;
            });
            html += `</ul></div>`;
        }
        html += `</div>`;
        resultDiv.innerHTML = html;
        resultDiv.classList.remove('hidden');

        if (result.success > 0) {
            loadEmployees();
        }
    } catch (error) {
        console.error('Error importing employees:', error);
        resultDiv.innerHTML = `<div class="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700">Import failed: ${error.message}</div>`;
        resultDiv.classList.remove('hidden');
    } finally {
        importBtn.disabled = false;
        importBtn.innerHTML = '<i class="fas fa-upload mr-1"></i> Import';
    }
}

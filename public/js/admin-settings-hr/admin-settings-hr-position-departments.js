// POSITION-DEPARTMENT ASSIGNMENT
let allPositionDepartments = [];

async function loadPositionDepartments() {
    showTableLoading('position-departments-table-body', 'Loading positions...');
    try {
        const [posRes, deptRes] = await Promise.all([
            fetch(`${API_BASE}/positions`),
            fetch(`${API_BASE}/departments`)
        ]);
        const positions = await posRes.json();
        const departments = await deptRes.json();
        allPositionDepartments = positions;
        allDepartments = departments;
        populatePosDeptFilter(departments);
        renderPositionDepartments();
    } catch (error) {
        console.error('Error loading position-departments:', error);
        showTableError('position-departments-table-body', 'Error loading position-department assignments.');
    }
}

function populatePosDeptFilter(departments) {
    const filter = document.getElementById('position-departments-dept-filter');
    if (!filter) return;
    const currentVal = filter.value;
    filter.innerHTML = '<option value="">All Departments</option>' +
        departments.map(d => `<option value="${d.id}">${d.name}</option>`).join('');
    if (currentVal) filter.value = currentVal;
}

function renderPositionDepartments() {
    const tbody = document.getElementById('position-departments-table-body');
    if (!tbody) return;
    const sorted = [...allPositionDepartments].sort((a, b) => a.name.localeCompare(b.name));
    tbody.innerHTML = sorted.map((item, idx) => {
        const deptNames = (item.departments || []).map(d => d.name);
        const deptBadges = deptNames.length
            ? deptNames.map(n => `<span class="inline-block bg-blue-100 text-blue-700 text-xs px-2 py-0.5 rounded-full mr-1 mb-0.5">${n}</span>`).join('')
            : '<span class="text-gray-400">Not Assigned</span>';
        const escapedName = (item.name || '').replace(/'/g, "\\'");
        return `
        <tr>
            <td class="px-3 py-2 whitespace-nowrap">${idx + 1}</td>
            <td class="px-3 py-2 whitespace-nowrap">${item.name}</td>
            <td class="px-3 py-2 max-w-32 truncate" title="${item.description || ''}">${item.description || '-'}</td>
            <td class="px-3 py-2">${deptBadges}</td>
            <td class="px-3 py-2 whitespace-nowrap">
                <button onclick="assignDepartmentsToPosition(${item.id}, '${escapedName}')" class="text-blue-600 hover:text-blue-800 mr-2"><i class="fas fa-edit"></i></button>
            </td>
        </tr>`;
    }).join('');
}

function filterPositionDepartments() {
    const searchTerm = (document.getElementById('position-departments-search')?.value || '').toLowerCase();
    const deptFilter = document.getElementById('position-departments-dept-filter')?.value || '';
    const filtered = allPositionDepartments.filter(item => {
        const deptNames = (item.departments || []).map(d => d.name.toLowerCase());
        const matchesSearch = !searchTerm ||
            (item.name && item.name.toLowerCase().includes(searchTerm)) ||
            deptNames.some(n => n.includes(searchTerm)) ||
            (item.description && item.description.toLowerCase().includes(searchTerm));
        const matchesDept = !deptFilter || (item.departments || []).some(d => d.id == deptFilter);
        return matchesSearch && matchesDept;
    });
    const tbody = document.getElementById('position-departments-table-body');
    if (!tbody) return;
    const sorted = [...filtered].sort((a, b) => a.name.localeCompare(b.name));
    tbody.innerHTML = sorted.map((item, idx) => {
        const deptNames = (item.departments || []).map(d => d.name);
        const deptBadges = deptNames.length
            ? deptNames.map(n => `<span class="inline-block bg-blue-100 text-blue-700 text-xs px-2 py-0.5 rounded-full mr-1 mb-0.5">${n}</span>`).join('')
            : '<span class="text-gray-400">Not Assigned</span>';
        const escapedName = (item.name || '').replace(/'/g, "\\'");
        return `
        <tr>
            <td class="px-3 py-2 whitespace-nowrap">${idx + 1}</td>
            <td class="px-3 py-2 whitespace-nowrap">${item.name}</td>
            <td class="px-3 py-2 max-w-32 truncate" title="${item.description || ''}">${item.description || '-'}</td>
            <td class="px-3 py-2">${deptBadges}</td>
            <td class="px-3 py-2 whitespace-nowrap">
                <button onclick="assignDepartmentsToPosition(${item.id}, '${escapedName}')" class="text-blue-600 hover:text-blue-800 mr-2"><i class="fas fa-edit"></i></button>
            </td>
        </tr>`;
    }).join('');
}

function assignDepartmentsToPosition(positionId, positionName) {
    const position = allPositionDepartments.find(p => p.id === positionId);
    const currentDeptIds = (position?.departments || []).map(d => d.id);
    const checkboxes = allDepartments.map(d =>
        `<label class="flex items-center gap-2 py-1 cursor-pointer hover:bg-blue-50 rounded px-2">
            <input type="checkbox" name="pos-dept-checkbox" value="${d.id}" ${currentDeptIds.includes(d.id) ? 'checked' : ''} class="rounded text-blue-600">
            <span class="text-sm">${d.name}</span>
        </label>`
    ).join('');
    const modalHtml = `
        <div id="pos-dept-modal" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div class="bg-white rounded-lg shadow-xl p-6 w-96">
                <h3 class="text-lg font-semibold mb-4">Assign Departments to Position</h3>
                <div class="mb-4">
                    <label class="block text-sm font-medium text-gray-700 mb-1">Position</label>
                    <div class="px-3 py-2 bg-gray-100 rounded-lg text-sm">${positionName}</div>
                </div>
                <div class="mb-4">
                    <label class="block text-sm font-medium text-gray-700 mb-1">Departments</label>
                    <div class="border rounded-lg p-2 max-h-60 overflow-y-auto">${checkboxes}</div>
                </div>
                <div class="flex justify-end gap-2">
                    <button onclick="closePosDeptModal()" class="px-4 py-2 text-sm border rounded-lg hover:bg-gray-50">Cancel</button>
                    <button onclick="savePosDeptAssignment(${positionId})" class="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700">Save</button>
                </div>
            </div>
        </div>
    `;
    const existing = document.getElementById('pos-dept-modal');
    if (existing) existing.remove();
    document.getElementById('modals-container').insertAdjacentHTML('beforeend', modalHtml);
}

function closePosDeptModal() {
    const modal = document.getElementById('pos-dept-modal');
    if (modal) modal.remove();
}

async function savePosDeptAssignment(positionId) {
    const checked = [...document.querySelectorAll('input[name="pos-dept-checkbox"]:checked')].map(cb => parseInt(cb.value));
    try {
        await fetch(`${API_BASE}/positions/${positionId}/departments`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ department_ids: checked })
        });
        closePosDeptModal();
        loadPositionDepartments();
    } catch (error) {
        console.error('Error saving position-department assignments:', error);
    }
}

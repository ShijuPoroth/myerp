// EMPLOYEE STATUSES
async function loadEmployeeStatuses() {
    showTableLoading('employee-statuses-table-body', 'Loading employee statuses...');
    try {
        const response = await fetch(`${API_BASE}/employee-statuses`);
        allEmployeeStatuses = await response.json();
        renderEmployeeStatuses();
    } catch (error) {
        console.error('Error loading employee statuses:', error);
    }
}

function renderEmployeeStatuses() {
    const tbody = document.getElementById('employee-statuses-table-body');
    if (!tbody) return;
    tbody.innerHTML = allEmployeeStatuses.map(item => `
        <tr>
            <td class="px-3 py-2 whitespace-nowrap">${item.id}</td>
            <td class="px-3 py-2 whitespace-nowrap">${item.name}</td>
            <td class="px-3 py-2 whitespace-nowrap">${item.description || '-'}</td>
            <td class="px-3 py-2 whitespace-nowrap">
                <button onclick="editEmployeeStatus(${item.id})" class="text-blue-600 hover:text-blue-800 mr-2"><i class="fas fa-edit"></i></button>
                <button onclick="deleteEmployeeStatus(${item.id})" class="text-red-600 hover:text-red-800"><i class="fas fa-trash"></i></button>
            </td>
        </tr>
    `).join('');
}

function filterEmployeeStatusesHR() {
    const searchTerm = (document.getElementById('employee-statuses-search')?.value || '').toLowerCase();
    const filtered = allEmployeeStatuses.filter(item =>
        !searchTerm ||
        (item.name && item.name.toLowerCase().includes(searchTerm)) ||
        (item.description && item.description.toLowerCase().includes(searchTerm))
    );
    const tbody = document.getElementById('employee-statuses-table-body');
    if (!tbody) return;
    tbody.innerHTML = filtered.map(item => `
        <tr>
            <td class="px-3 py-2 whitespace-nowrap">${item.id}</td>
            <td class="px-3 py-2 whitespace-nowrap">${item.name}</td>
            <td class="px-3 py-2 whitespace-nowrap">${item.description || '-'}</td>
            <td class="px-3 py-2 whitespace-nowrap">
                <button onclick="editEmployeeStatus(${item.id})" class="text-blue-600 hover:text-blue-800 mr-2"><i class="fas fa-edit"></i></button>
                <button onclick="deleteEmployeeStatus(${item.id})" class="text-red-600 hover:text-red-800"><i class="fas fa-trash"></i></button>
            </td>
        </tr>
    `).join('');
}

function openEmployeeStatusModal(id = null) {
    const modal = document.getElementById('employee-status-modal');
    const form = document.getElementById('employee-status-form');
    const title = document.getElementById('employee-status-modal-title');
    form.reset();
    document.getElementById('employee-status-id').value = '';
    if (id) {
        const item = allEmployeeStatuses.find(i => i.id === id);
        if (item) {
            title.textContent = 'Edit Employee Status';
            document.getElementById('employee-status-id').value = item.id;
            document.getElementById('employee-status-name').value = item.name;
            document.getElementById('employee-status-description').value = item.description || '';
        }
    } else {
        title.textContent = 'Add Employee Status';
    }
    modal.classList.add('active');
}

function closeEmployeeStatusModal() {
    document.getElementById('employee-status-modal').classList.remove('active');
}

async function saveEmployeeStatus(e) {
    e.preventDefault();
    const id = document.getElementById('employee-status-id').value;
    const data = {
        name: document.getElementById('employee-status-name').value,
        description: document.getElementById('employee-status-description').value
    };
    try {
        const url = id ? `${API_BASE}/employee-statuses/${id}` : `${API_BASE}/employee-statuses`;
        const method = id ? 'PUT' : 'POST';
        await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
        closeEmployeeStatusModal();
        loadEmployeeStatuses();
    } catch (error) {
        console.error('Error saving employee status:', error);
    }
}

async function editEmployeeStatus(id) {
    openEmployeeStatusModal(id);
}

async function deleteEmployeeStatus(id) {
    if (confirm('Are you sure you want to delete this employee status?')) {
        try {
            await fetch(`${API_BASE}/employee-statuses/${id}`, { method: 'DELETE' });
            loadEmployeeStatuses();
        } catch (error) {
            console.error('Error deleting employee status:', error);
        }
    }
}

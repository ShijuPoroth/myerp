// LEAVE TYPES
let allLeaveTypes = [];

async function loadLeaveTypes() {
    showTableLoading('leave-types-table-body', 'Loading leave types...');
    try {
        const response = await fetch(`${API_BASE}/leave-types`);
        allLeaveTypes = await response.json();
        renderLeaveTypes();
    } catch (error) {
        console.error('Error loading leave types:', error);
    }
}

function renderLeaveTypes() {
    const tbody = document.getElementById('leave-types-table-body');
    if (!tbody) return;
    const sorted = [...allLeaveTypes].sort((a, b) => a.id - b.id);
    tbody.innerHTML = sorted.map(item => `
        <tr>
            <td class="px-3 py-2 whitespace-nowrap">${item.id}</td>
            <td class="px-3 py-2 whitespace-nowrap">${item.name}</td>
            <td class="px-3 py-2 max-w-32 truncate" title="${item.description || ''}">${item.description || '-'}</td>
            <td class="px-3 py-2 whitespace-nowrap">
                <button onclick="editLeaveType(${item.id})" class="text-blue-600 hover:text-blue-800 mr-2"><i class="fas fa-edit"></i></button>
                <button onclick="deleteLeaveType(${item.id})" class="text-red-600 hover:text-red-800"><i class="fas fa-trash"></i></button>
            </td>
        </tr>
    `).join('');
}

function filterLeaveTypes() {
    const searchTerm = (document.getElementById('leave-types-search')?.value || '').toLowerCase();
    const filtered = allLeaveTypes.filter(item =>
        !searchTerm ||
        (item.name && item.name.toLowerCase().includes(searchTerm)) ||
        (item.description && item.description.toLowerCase().includes(searchTerm))
    );
    const tbody = document.getElementById('leave-types-table-body');
    if (!tbody) return;
    const sorted = [...filtered].sort((a, b) => a.id - b.id);
    tbody.innerHTML = sorted.map(item => `
        <tr>
            <td class="px-3 py-2 whitespace-nowrap">${item.id}</td>
            <td class="px-3 py-2 whitespace-nowrap">${item.name}</td>
            <td class="px-3 py-2 max-w-32 truncate" title="${item.description || ''}">${item.description || '-'}</td>
            <td class="px-3 py-2 whitespace-nowrap">
                <button onclick="editLeaveType(${item.id})" class="text-blue-600 hover:text-blue-800 mr-2"><i class="fas fa-edit"></i></button>
                <button onclick="deleteLeaveType(${item.id})" class="text-red-600 hover:text-red-800"><i class="fas fa-trash"></i></button>
            </td>
        </tr>
    `).join('');
}

function openLeaveTypeModal(id = null) {
    const modal = document.getElementById('leave-type-modal');
    const form = document.getElementById('leave-type-form');
    const title = document.getElementById('leave-type-modal-title');
    form.reset();
    document.getElementById('leave-type-id').value = '';
    if (id) {
        const item = allLeaveTypes.find(i => i.id === id);
        if (item) {
            title.textContent = 'Edit Leave Type';
            document.getElementById('leave-type-id').value = item.id;
            document.getElementById('leave-type-name').value = item.name;
            document.getElementById('leave-type-description').value = item.description || '';
        }
    } else {
        title.textContent = 'Add Leave Type';
    }
    modal.classList.add('active');
}

function closeLeaveTypeModal() {
    document.getElementById('leave-type-modal').classList.remove('active');
}

async function saveLeaveType(e) {
    e.preventDefault();
    const id = document.getElementById('leave-type-id').value;
    const data = {
        name: document.getElementById('leave-type-name').value,
        description: document.getElementById('leave-type-description').value
    };
    const url = id ? `${API_BASE}/leave-types/${id}` : `${API_BASE}/leave-types`;
    const method = id ? 'PUT' : 'POST';
    try {
        await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
        closeLeaveTypeModal();
        loadLeaveTypes();
    } catch (error) {
        console.error('Error saving leave type:', error);
    }
}

async function editLeaveType(id) {
    openLeaveTypeModal(id);
}

async function deleteLeaveType(id) {
    if (confirm('Are you sure you want to delete this leave type?')) {
        try {
            await fetch(`${API_BASE}/leave-types/${id}`, { method: 'DELETE' });
            loadLeaveTypes();
        } catch (error) {
            console.error('Error deleting leave type:', error);
        }
    }
}

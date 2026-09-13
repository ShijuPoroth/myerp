// OVERTIME TYPES
let allOvertimeTypes = [];

async function loadOvertimeTypes() {
    showTableLoading('overtime-types-table-body', 'Loading overtime types...');
    try {
        const response = await fetch(`${API_BASE}/overtime-types`);
        allOvertimeTypes = await response.json();
        renderOvertimeTypes();
    } catch (error) {
        console.error('Error loading overtime types:', error);
    }
}

function renderOvertimeTypes() {
    const tbody = document.getElementById('overtime-types-table-body');
    if (!tbody) return;
    const sorted = [...allOvertimeTypes].sort((a, b) => a.id - b.id);
    tbody.innerHTML = sorted.map(item => `
        <tr>
            <td class="px-3 py-2 whitespace-nowrap">${item.id}</td>
            <td class="px-3 py-2 whitespace-nowrap">${item.name}</td>
            <td class="px-3 py-2 max-w-32 truncate" title="${item.description || ''}">${item.description || '-'}</td>
            <td class="px-3 py-2 whitespace-nowrap">
                <button onclick="editOvertimeType(${item.id})" class="text-blue-600 hover:text-blue-800 mr-2"><i class="fas fa-edit"></i></button>
                <button onclick="deleteOvertimeType(${item.id})" class="text-red-600 hover:text-red-800"><i class="fas fa-trash"></i></button>
            </td>
        </tr>
    `).join('');
}

function filterOvertimeTypes() {
    const searchTerm = (document.getElementById('overtime-types-search')?.value || '').toLowerCase();
    const filtered = allOvertimeTypes.filter(item =>
        !searchTerm ||
        (item.name && item.name.toLowerCase().includes(searchTerm)) ||
        (item.description && item.description.toLowerCase().includes(searchTerm))
    );
    const tbody = document.getElementById('overtime-types-table-body');
    if (!tbody) return;
    const sorted = [...filtered].sort((a, b) => a.id - b.id);
    tbody.innerHTML = sorted.map(item => `
        <tr>
            <td class="px-3 py-2 whitespace-nowrap">${item.id}</td>
            <td class="px-3 py-2 whitespace-nowrap">${item.name}</td>
            <td class="px-3 py-2 max-w-32 truncate" title="${item.description || ''}">${item.description || '-'}</td>
            <td class="px-3 py-2 whitespace-nowrap">
                <button onclick="editOvertimeType(${item.id})" class="text-blue-600 hover:text-blue-800 mr-2"><i class="fas fa-edit"></i></button>
                <button onclick="deleteOvertimeType(${item.id})" class="text-red-600 hover:text-red-800"><i class="fas fa-trash"></i></button>
            </td>
        </tr>
    `).join('');
}

function openOvertimeTypeModal(id = null) {
    const modal = document.getElementById('overtime-type-modal');
    const form = document.getElementById('overtime-type-form');
    const title = document.getElementById('overtime-type-modal-title');
    form.reset();
    document.getElementById('overtime-type-id').value = '';
    if (id) {
        const item = allOvertimeTypes.find(i => i.id === id);
        if (item) {
            title.textContent = 'Edit Overtime Type';
            document.getElementById('overtime-type-id').value = item.id;
            document.getElementById('overtime-type-name').value = item.name;
            document.getElementById('overtime-type-description').value = item.description || '';
        }
    } else {
        title.textContent = 'Add Overtime Type';
    }
    modal.classList.add('active');
}

function closeOvertimeTypeModal() {
    document.getElementById('overtime-type-modal').classList.remove('active');
}

async function saveOvertimeType(e) {
    e.preventDefault();
    const id = document.getElementById('overtime-type-id').value;
    const data = {
        name: document.getElementById('overtime-type-name').value,
        description: document.getElementById('overtime-type-description').value
    };
    const url = id ? `${API_BASE}/overtime-types/${id}` : `${API_BASE}/overtime-types`;
    const method = id ? 'PUT' : 'POST';
    try {
        await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
        closeOvertimeTypeModal();
        loadOvertimeTypes();
    } catch (error) {
        console.error('Error saving overtime type:', error);
    }
}

async function editOvertimeType(id) {
    openOvertimeTypeModal(id);
}

async function deleteOvertimeType(id) {
    if (confirm('Are you sure you want to delete this overtime type?')) {
        try {
            await fetch(`${API_BASE}/overtime-types/${id}`, { method: 'DELETE' });
            loadOvertimeTypes();
        } catch (error) {
            console.error('Error deleting overtime type:', error);
        }
    }
}

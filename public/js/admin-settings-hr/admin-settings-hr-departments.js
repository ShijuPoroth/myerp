// DEPARTMENTS
async function loadDepartments() {
    showTableLoading('departments-table-body', 'Loading departments...');
    try {
        const response = await fetch(`${API_BASE}/departments`);
        allDepartments = await response.json();
        renderDepartments();
    } catch (error) {
        console.error('Error loading departments:', error);
    }
}

function renderDepartments() {
    const tbody = document.getElementById('departments-table-body');
    if (!tbody) return;
    const sortedDepartments = [...allDepartments].sort((a, b) => a.id - b.id);
    tbody.innerHTML = sortedDepartments.map((item, idx) => `
        <tr>
            <td class="px-3 py-2 whitespace-nowrap">${idx + 1}</td>
            <td class="px-3 py-2 whitespace-nowrap">${item.name}</td>
            <td class="px-3 py-2 max-w-32 truncate" title="${item.description || ''}">${item.description || '-'}</td>
            <td class="px-3 py-2 whitespace-nowrap">
                <button onclick="editDepartment(${item.id})" class="text-blue-600 hover:text-blue-800 mr-2"><i class="fas fa-edit"></i></button>
                <button onclick="deleteDepartment(${item.id})" class="text-red-600 hover:text-red-800"><i class="fas fa-trash"></i></button>
            </td>
        </tr>
    `).join('');
}

function filterDepartments() {
    const searchTerm = (document.getElementById('departments-search')?.value || '').toLowerCase();
    const filtered = allDepartments.filter(item =>
        !searchTerm ||
        (item.name && item.name.toLowerCase().includes(searchTerm)) ||
        (item.description && item.description.toLowerCase().includes(searchTerm))
    );
    const tbody = document.getElementById('departments-table-body');
    if (!tbody) return;
    const sorted = [...filtered].sort((a, b) => a.id - b.id);
    tbody.innerHTML = sorted.map((item, idx) => `
        <tr>
            <td class="px-3 py-2 whitespace-nowrap">${idx + 1}</td>
            <td class="px-3 py-2 whitespace-nowrap">${item.name}</td>
            <td class="px-3 py-2 max-w-32 truncate" title="${item.description || ''}">${item.description || '-'}</td>
            <td class="px-3 py-2 whitespace-nowrap">
                <button onclick="editDepartment(${item.id})" class="text-blue-600 hover:text-blue-800 mr-2"><i class="fas fa-edit"></i></button>
                <button onclick="deleteDepartment(${item.id})" class="text-red-600 hover:text-red-800"><i class="fas fa-trash"></i></button>
            </td>
        </tr>
    `).join('');
}

function openDepartmentModal(id = null) {
    const modal = document.getElementById('department-modal');
    const form = document.getElementById('department-form');
    const title = document.getElementById('department-modal-title');
    form.reset();
    document.getElementById('department-id').value = '';
    if (id) {
        const item = allDepartments.find(i => i.id === id);
        if (item) {
            title.textContent = 'Edit Department';
            document.getElementById('department-id').value = item.id;
            document.getElementById('department-name').value = item.name;
            document.getElementById('department-description').value = item.description || '';
        }
    } else {
        title.textContent = 'Add Department';
    }
    modal.classList.add('active');
}

function closeDepartmentModal() {
    document.getElementById('department-modal').classList.remove('active');
}

async function saveDepartment(e) {
    e.preventDefault();
    const id = document.getElementById('department-id').value;
    const data = {
        name: document.getElementById('department-name').value,
        description: document.getElementById('department-description').value
    };
    try {
        const url = id ? `${API_BASE}/departments/${id}` : `${API_BASE}/departments`;
        const method = id ? 'PUT' : 'POST';
        await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
        closeDepartmentModal();
        loadDepartments();
    } catch (error) {
        console.error('Error saving department:', error);
    }
}

async function editDepartment(id) {
    openDepartmentModal(id);
}

async function deleteDepartment(id) {
    if (confirm('Are you sure you want to delete this department?')) {
        try {
            await fetch(`${API_BASE}/departments/${id}`, { method: 'DELETE' });
            loadDepartments();
        } catch (error) {
            console.error('Error deleting department:', error);
        }
    }
}

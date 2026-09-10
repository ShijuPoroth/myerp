// UNIFORM TYPES
async function loadUniformTypes() {
    try {
        const response = await fetch(`${API_BASE}/uniform-types`);
        allUniformTypes = await response.json();
        renderUniformTypes();
    } catch (error) {
        console.error('Error loading uniform types:', error);
    }
}

function renderUniformTypes() {
    const tbody = document.getElementById('uniform-types-table-body');
    if (!tbody) return;
    const sortedUniformTypes = [...allUniformTypes].sort((a, b) => a.id - b.id);
    tbody.innerHTML = sortedUniformTypes.map(item => `
        <tr>
            <td class="px-3 py-2 whitespace-nowrap">${item.id}</td>
            <td class="px-3 py-2 whitespace-nowrap">${item.name}</td>
            <td class="px-3 py-2 max-w-32 truncate" title="${item.description || ''}">${item.description || '-'}</td>
            <td class="px-3 py-2 whitespace-nowrap">
                <button onclick="editUniformType(${item.id})" class="text-blue-600 hover:text-blue-800 mr-2"><i class="fas fa-edit"></i></button>
                <button onclick="deleteUniformType(${item.id})" class="text-red-600 hover:text-red-800"><i class="fas fa-trash"></i></button>
            </td>
        </tr>
    `).join('');
}

function filterUniformTypes() {
    const searchTerm = (document.getElementById('uniform-types-search')?.value || '').toLowerCase();
    const filtered = allUniformTypes.filter(item =>
        !searchTerm ||
        (item.name && item.name.toLowerCase().includes(searchTerm)) ||
        (item.description && item.description.toLowerCase().includes(searchTerm))
    );
    const tbody = document.getElementById('uniform-types-table-body');
    if (!tbody) return;
    const sorted = [...filtered].sort((a, b) => a.id - b.id);
    tbody.innerHTML = sorted.map(item => `
        <tr>
            <td class="px-3 py-2 whitespace-nowrap">${item.id}</td>
            <td class="px-3 py-2 whitespace-nowrap">${item.name}</td>
            <td class="px-3 py-2 max-w-32 truncate" title="${item.description || ''}">${item.description || '-'}</td>
            <td class="px-3 py-2 whitespace-nowrap">
                <button onclick="editUniformType(${item.id})" class="text-blue-600 hover:text-blue-800 mr-2"><i class="fas fa-edit"></i></button>
                <button onclick="deleteUniformType(${item.id})" class="text-red-600 hover:text-red-800"><i class="fas fa-trash"></i></button>
            </td>
        </tr>
    `).join('');
}

function openUniformTypeModal(id = null) {
    const modal = document.getElementById('uniform-type-modal');
    const form = document.getElementById('uniform-type-form');
    const title = document.getElementById('uniform-type-modal-title');
    form.reset();
    document.getElementById('uniform-type-id').value = '';
    if (id) {
        const item = allUniformTypes.find(i => i.id === id);
        if (item) {
            title.textContent = 'Edit Uniform Type';
            document.getElementById('uniform-type-id').value = item.id;
            document.getElementById('uniform-type-name').value = item.name;
            document.getElementById('uniform-type-description').value = item.description || '';
        }
    } else {
        title.textContent = 'Add Uniform Type';
    }
    modal.classList.add('active');
}

function closeUniformTypeModal() {
    document.getElementById('uniform-type-modal').classList.remove('active');
}

async function saveUniformType(e) {
    e.preventDefault();
    const id = document.getElementById('uniform-type-id').value;
    const data = {
        name: document.getElementById('uniform-type-name').value,
        description: document.getElementById('uniform-type-description').value
    };
    try {
        const url = id ? `${API_BASE}/uniform-types/${id}` : `${API_BASE}/uniform-types`;
        const method = id ? 'PUT' : 'POST';
        await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
        closeUniformTypeModal();
        loadUniformTypes();
    } catch (error) {
        console.error('Error saving uniform type:', error);
    }
}

async function editUniformType(id) {
    openUniformTypeModal(id);
}

async function deleteUniformType(id) {
    if (confirm('Are you sure you want to delete this uniform type?')) {
        try {
            await fetch(`${API_BASE}/uniform-types/${id}`, { method: 'DELETE' });
            loadUniformTypes();
        } catch (error) {
            console.error('Error deleting uniform type:', error);
        }
    }
}

// REMUNERATION TYPES
let allRemunerationTypes = [];

async function loadRemunerationTypes() {
    showTableLoading('remuneration-types-table-body', 'Loading remuneration types...');
    try {
        const response = await fetch(`${API_BASE}/remuneration-types`);
        allRemunerationTypes = await response.json();
        renderRemunerationTypes();
    } catch (error) {
        console.error('Error loading remuneration types:', error);
    }
}

function renderRemunerationTypes() {
    const tbody = document.getElementById('remuneration-types-table-body');
    if (!tbody) return;
    const sorted = [...allRemunerationTypes].sort((a, b) => a.id - b.id);
    tbody.innerHTML = sorted.map(item => `
        <tr>
            <td class="px-3 py-2 whitespace-nowrap">${item.id}</td>
            <td class="px-3 py-2 whitespace-nowrap">${item.name}</td>
            <td class="px-3 py-2 max-w-32 truncate" title="${item.description || ''}">${item.description || '-'}</td>
            <td class="px-3 py-2 whitespace-nowrap">
                <button onclick="editRemunerationType(${item.id})" class="text-blue-600 hover:text-blue-800 mr-2"><i class="fas fa-edit"></i></button>
                <button onclick="deleteRemunerationType(${item.id})" class="text-red-600 hover:text-red-800"><i class="fas fa-trash"></i></button>
            </td>
        </tr>
    `).join('');
}

function filterRemunerationTypes() {
    const searchTerm = (document.getElementById('remuneration-types-search')?.value || '').toLowerCase();
    const filtered = allRemunerationTypes.filter(item =>
        !searchTerm ||
        (item.name && item.name.toLowerCase().includes(searchTerm)) ||
        (item.description && item.description.toLowerCase().includes(searchTerm))
    );
    const tbody = document.getElementById('remuneration-types-table-body');
    if (!tbody) return;
    const sorted = [...filtered].sort((a, b) => a.id - b.id);
    tbody.innerHTML = sorted.map(item => `
        <tr>
            <td class="px-3 py-2 whitespace-nowrap">${item.id}</td>
            <td class="px-3 py-2 whitespace-nowrap">${item.name}</td>
            <td class="px-3 py-2 max-w-32 truncate" title="${item.description || ''}">${item.description || '-'}</td>
            <td class="px-3 py-2 whitespace-nowrap">
                <button onclick="editRemunerationType(${item.id})" class="text-blue-600 hover:text-blue-800 mr-2"><i class="fas fa-edit"></i></button>
                <button onclick="deleteRemunerationType(${item.id})" class="text-red-600 hover:text-red-800"><i class="fas fa-trash"></i></button>
            </td>
        </tr>
    `).join('');
}

function openRemunerationTypeModal(id = null) {
    const modal = document.getElementById('remuneration-type-modal');
    const form = document.getElementById('remuneration-type-form');
    const title = document.getElementById('remuneration-type-modal-title');
    form.reset();
    document.getElementById('remuneration-type-id').value = '';
    if (id) {
        const item = allRemunerationTypes.find(i => i.id === id);
        if (item) {
            title.textContent = 'Edit Remuneration Type';
            document.getElementById('remuneration-type-id').value = item.id;
            document.getElementById('remuneration-type-name').value = item.name;
            document.getElementById('remuneration-type-description').value = item.description || '';
        }
    } else {
        title.textContent = 'Add Remuneration Type';
    }
    modal.classList.add('active');
}

function closeRemunerationTypeModal() {
    document.getElementById('remuneration-type-modal').classList.remove('active');
}

async function saveRemunerationType(e) {
    e.preventDefault();
    const id = document.getElementById('remuneration-type-id').value;
    const data = {
        name: document.getElementById('remuneration-type-name').value,
        description: document.getElementById('remuneration-type-description').value
    };
    const url = id ? `${API_BASE}/remuneration-types/${id}` : `${API_BASE}/remuneration-types`;
    const method = id ? 'PUT' : 'POST';
    try {
        await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
        closeRemunerationTypeModal();
        loadRemunerationTypes();
    } catch (error) {
        console.error('Error saving remuneration type:', error);
    }
}

async function editRemunerationType(id) {
    openRemunerationTypeModal(id);
}

async function deleteRemunerationType(id) {
    if (confirm('Are you sure you want to delete this remuneration type?')) {
        try {
            await fetch(`${API_BASE}/remuneration-types/${id}`, { method: 'DELETE' });
            loadRemunerationTypes();
        } catch (error) {
            console.error('Error deleting remuneration type:', error);
        }
    }
}

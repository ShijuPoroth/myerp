// DOCUMENT TYPES
async function loadDocumentTypes() {
    try {
        const response = await fetch(`${API_BASE}/document-types`);
        allDocumentTypes = await response.json();
        renderDocumentTypes();
    } catch (error) {
        console.error('Error loading document types:', error);
    }
}

function renderDocumentTypes() {
    const tbody = document.getElementById('document-types-table-body');
    if (!tbody) return;
    const sorted = [...allDocumentTypes].sort((a, b) => a.id - b.id);
    tbody.innerHTML = sorted.map(item => `
        <tr>
            <td class="px-3 py-2 whitespace-nowrap">${item.id}</td>
            <td class="px-3 py-2 whitespace-nowrap">${item.name}</td>
            <td class="px-3 py-2 max-w-32 truncate" title="${item.description || ''}">${item.description || '-'}</td>
            <td class="px-3 py-2 whitespace-nowrap">${item.notification_days || 30} days</td>
            <td class="px-3 py-2 whitespace-nowrap">
                <button onclick="editDocumentType(${item.id})" class="text-blue-600 hover:text-blue-800 mr-2"><i class="fas fa-edit"></i></button>
                <button onclick="deleteDocumentType(${item.id})" class="text-red-600 hover:text-red-800"><i class="fas fa-trash"></i></button>
            </td>
        </tr>
    `).join('');
}

function filterDocumentTypes() {
    const searchTerm = (document.getElementById('document-types-search')?.value || '').toLowerCase();
    const filtered = allDocumentTypes.filter(item =>
        !searchTerm ||
        (item.name && item.name.toLowerCase().includes(searchTerm)) ||
        (item.description && item.description.toLowerCase().includes(searchTerm))
    );
    const tbody = document.getElementById('document-types-table-body');
    if (!tbody) return;
    const sorted = [...filtered].sort((a, b) => a.id - b.id);
    tbody.innerHTML = sorted.map(item => `
        <tr>
            <td class="px-3 py-2 whitespace-nowrap">${item.id}</td>
            <td class="px-3 py-2 whitespace-nowrap">${item.name}</td>
            <td class="px-3 py-2 max-w-32 truncate" title="${item.description || ''}">${item.description || '-'}</td>
            <td class="px-3 py-2 whitespace-nowrap">${item.notification_days || 30} days</td>
            <td class="px-3 py-2 whitespace-nowrap">
                <button onclick="editDocumentType(${item.id})" class="text-blue-600 hover:text-blue-800 mr-2"><i class="fas fa-edit"></i></button>
                <button onclick="deleteDocumentType(${item.id})" class="text-red-600 hover:text-red-800"><i class="fas fa-trash"></i></button>
            </td>
        </tr>
    `).join('');
}

function openDocumentTypeModal(id = null) {
    const modal = document.getElementById('document-type-modal');
    const form = document.getElementById('document-type-form');
    const title = document.getElementById('document-type-modal-title');
    form.reset();
    document.getElementById('document-type-id').value = '';
    if (id) {
        const item = allDocumentTypes.find(i => i.id === id);
        if (item) {
            title.textContent = 'Edit Document Type';
            document.getElementById('document-type-id').value = item.id;
            document.getElementById('document-type-name').value = item.name;
            document.getElementById('document-type-description').value = item.description || '';
            document.getElementById('document-type-notification-days').value = item.notification_days || 30;
        }
    } else {
        title.textContent = 'Add Document Type';
    }
    modal.classList.add('active');
}

function closeDocumentTypeModal() {
    document.getElementById('document-type-modal').classList.remove('active');
}

async function saveDocumentType(e) {
    e.preventDefault();
    const id = document.getElementById('document-type-id').value;
    const data = {
        name: document.getElementById('document-type-name').value,
        description: document.getElementById('document-type-description').value,
        notification_days: document.getElementById('document-type-notification-days').value || 30
    };
    const url = id ? `${API_BASE}/document-types/${id}` : `${API_BASE}/document-types`;
    const method = id ? 'PUT' : 'POST';
    try {
        await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
        closeDocumentTypeModal();
        loadDocumentTypes();
    } catch (error) {
        console.error('Error saving document type:', error);
    }
}

async function editDocumentType(id) {
    openDocumentTypeModal(id);
}

async function deleteDocumentType(id) {
    if (confirm('Are you sure you want to delete this document type?')) {
        try {
            await fetch(`${API_BASE}/document-types/${id}`, { method: 'DELETE' });
            loadDocumentTypes();
        } catch (error) {
            console.error('Error deleting document type:', error);
        }
    }
}

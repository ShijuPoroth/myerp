// ACCOMMODATION TYPES
async function loadAccommodationTypes() {
    try {
        const response = await fetch(`${API_BASE}/accommodation-types`);
        allAccommodationTypes = await response.json();
        renderAccommodationTypes();
    } catch (error) {
        console.error('Error loading accommodation types:', error);
    }
}

function renderAccommodationTypes() {
    const tbody = document.getElementById('accommodation-types-table-body');
    if (!tbody) return;
    tbody.innerHTML = allAccommodationTypes.map(item => `
        <tr>
            <td class="px-3 py-2 whitespace-nowrap">${item.id}</td>
            <td class="px-3 py-2 whitespace-nowrap">${item.name}</td>
            <td class="px-3 py-2 whitespace-nowrap">${item.description || '-'}</td>
            <td class="px-3 py-2 whitespace-nowrap">
                <button onclick="editAccommodationType(${item.id})" class="text-blue-600 hover:text-blue-800 mr-2"><i class="fas fa-edit"></i></button>
                <button onclick="deleteAccommodationType(${item.id})" class="text-red-600 hover:text-red-800"><i class="fas fa-trash"></i></button>
            </td>
        </tr>
    `).join('');
}

function openAccommodationTypeModal(id = null) {
    const modal = document.getElementById('accommodation-type-modal');
    const form = document.getElementById('accommodation-type-form');
    const title = document.getElementById('accommodation-type-modal-title');
    form.reset();
    document.getElementById('accommodation-type-id').value = '';
    if (id) {
        const item = allAccommodationTypes.find(i => i.id === id);
        if (item) {
            title.textContent = 'Edit Accommodation Type';
            document.getElementById('accommodation-type-id').value = item.id;
            document.getElementById('accommodation-type-name').value = item.name;
            document.getElementById('accommodation-type-description').value = item.description || '';
        }
    } else {
        title.textContent = 'Add Accommodation Type';
    }
    modal.classList.add('active');
}

function closeAccommodationTypeModal() {
    document.getElementById('accommodation-type-modal').classList.remove('active');
}

async function saveAccommodationType(e) {
    e.preventDefault();
    const id = document.getElementById('accommodation-type-id').value;
    const data = {
        name: document.getElementById('accommodation-type-name').value,
        description: document.getElementById('accommodation-type-description').value
    };
    try {
        const url = id ? `${API_BASE}/accommodation-types/${id}` : `${API_BASE}/accommodation-types`;
        const method = id ? 'PUT' : 'POST';
        await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
        closeAccommodationTypeModal();
        loadAccommodationTypes();
    } catch (error) {
        console.error('Error saving accommodation type:', error);
    }
}

async function editAccommodationType(id) {
    openAccommodationTypeModal(id);
}

async function deleteAccommodationType(id) {
    if (confirm('Are you sure you want to delete this accommodation type?')) {
        try {
            await fetch(`${API_BASE}/accommodation-types/${id}`, { method: 'DELETE' });
            loadAccommodationTypes();
        } catch (error) {
            console.error('Error deleting accommodation type:', error);
        }
    }
}

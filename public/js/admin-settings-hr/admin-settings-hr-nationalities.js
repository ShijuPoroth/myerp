// NATIONALITIES
async function loadNationalities() {
    try {
        const response = await fetch(`${API_BASE}/nationalities`);
        allNationalities = await response.json();
        renderNationalities();
    } catch (error) {
        console.error('Error loading nationalities:', error);
    }
}

function renderNationalities() {
    const tbody = document.getElementById('nationalities-table-body');
    if (!tbody) return;
    const sortedNationalities = [...allNationalities].sort((a, b) => a.id - b.id);
    tbody.innerHTML = sortedNationalities.map(item => `
        <tr>
            <td class="px-3 py-2 whitespace-nowrap">${item.id}</td>
            <td class="px-3 py-2 whitespace-nowrap">${item.name}</td>
            <td class="px-3 py-2 max-w-32 truncate" title="${item.description || ''}">${item.description || '-'}</td>
            <td class="px-3 py-2 whitespace-nowrap">
                <button onclick="editNationality(${item.id})" class="text-blue-600 hover:text-blue-800 mr-2"><i class="fas fa-edit"></i></button>
                <button onclick="deleteNationality(${item.id})" class="text-red-600 hover:text-red-800"><i class="fas fa-trash"></i></button>
            </td>
        </tr>
    `).join('');
}

function filterNationalities() {
    const searchTerm = (document.getElementById('nationalities-search')?.value || '').toLowerCase();
    const filtered = allNationalities.filter(item =>
        !searchTerm ||
        (item.name && item.name.toLowerCase().includes(searchTerm)) ||
        (item.description && item.description.toLowerCase().includes(searchTerm))
    );
    const tbody = document.getElementById('nationalities-table-body');
    if (!tbody) return;
    const sorted = [...filtered].sort((a, b) => a.id - b.id);
    tbody.innerHTML = sorted.map(item => `
        <tr>
            <td class="px-3 py-2 whitespace-nowrap">${item.id}</td>
            <td class="px-3 py-2 whitespace-nowrap">${item.name}</td>
            <td class="px-3 py-2 max-w-32 truncate" title="${item.description || ''}">${item.description || '-'}</td>
            <td class="px-3 py-2 whitespace-nowrap">
                <button onclick="editNationality(${item.id})" class="text-blue-600 hover:text-blue-800 mr-2"><i class="fas fa-edit"></i></button>
                <button onclick="deleteNationality(${item.id})" class="text-red-600 hover:text-red-800"><i class="fas fa-trash"></i></button>
            </td>
        </tr>
    `).join('');
}

function openNationalityModal(id = null) {
    const modal = document.getElementById('nationality-modal');
    const form = document.getElementById('nationality-form');
    const title = document.getElementById('nationality-modal-title');
    form.reset();
    document.getElementById('nationality-id').value = '';
    if (id) {
        const item = allNationalities.find(i => i.id === id);
        if (item) {
            title.textContent = 'Edit Nationality';
            document.getElementById('nationality-id').value = item.id;
            document.getElementById('nationality-name').value = item.name;
            document.getElementById('nationality-description').value = item.description || '';
        }
    } else {
        title.textContent = 'Add Nationality';
    }
    modal.classList.add('active');
}

function closeNationalityModal() {
    document.getElementById('nationality-modal').classList.remove('active');
}

async function saveNationality(e) {
    e.preventDefault();
    const id = document.getElementById('nationality-id').value;
    const data = {
        name: document.getElementById('nationality-name').value,
        description: document.getElementById('nationality-description').value
    };
    const url = id ? `${API_BASE}/nationalities/${id}` : `${API_BASE}/nationalities`;
    const method = id ? 'PUT' : 'POST';
    try {
        await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
        closeNationalityModal();
        loadNationalities();
    } catch (error) {
        console.error('Error saving nationality:', error);
    }
}

async function editNationality(id) {
    openNationalityModal(id);
}

async function deleteNationality(id) {
    if (confirm('Are you sure you want to delete this nationality?')) {
        try {
            await fetch(`${API_BASE}/nationalities/${id}`, { method: 'DELETE' });
            loadNationalities();
        } catch (error) {
            console.error('Error deleting nationality:', error);
        }
    }
}

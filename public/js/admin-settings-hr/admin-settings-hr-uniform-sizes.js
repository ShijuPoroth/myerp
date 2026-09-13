// UNIFORM SIZES
async function loadUniformSizes() {
    showTableLoading('uniform-sizes-table-body', 'Loading uniform sizes...');
    try {
        const response = await fetch(`${API_BASE}/uniform-sizes`);
        allUniformSizes = await response.json();
        renderUniformSizes();
    } catch (error) {
        console.error('Error loading uniform sizes:', error);
    }
}

function renderUniformSizes() {
    const tbody = document.getElementById('uniform-sizes-table-body');
    if (!tbody) return;
    const sortedUniformSizes = [...allUniformSizes].sort((a, b) => a.id - b.id);
    tbody.innerHTML = sortedUniformSizes.map(item => `
        <tr>
            <td class="px-3 py-2 whitespace-nowrap">${item.id}</td>
            <td class="px-3 py-2 whitespace-nowrap">${item.name}</td>
            <td class="px-3 py-2 max-w-32 truncate" title="${item.description || ''}">${item.description || '-'}</td>
            <td class="px-3 py-2 whitespace-nowrap">
                <button onclick="editUniformSize(${item.id})" class="text-blue-600 hover:text-blue-800 mr-2"><i class="fas fa-edit"></i></button>
                <button onclick="deleteUniformSize(${item.id})" class="text-red-600 hover:text-red-800"><i class="fas fa-trash"></i></button>
            </td>
        </tr>
    `).join('');
}

function filterUniformSizes() {
    const searchTerm = (document.getElementById('uniform-sizes-search')?.value || '').toLowerCase();
    const filtered = allUniformSizes.filter(item =>
        !searchTerm ||
        (item.name && item.name.toLowerCase().includes(searchTerm)) ||
        (item.description && item.description.toLowerCase().includes(searchTerm))
    );
    const tbody = document.getElementById('uniform-sizes-table-body');
    if (!tbody) return;
    const sorted = [...filtered].sort((a, b) => a.id - b.id);
    tbody.innerHTML = sorted.map(item => `
        <tr>
            <td class="px-3 py-2 whitespace-nowrap">${item.id}</td>
            <td class="px-3 py-2 whitespace-nowrap">${item.name}</td>
            <td class="px-3 py-2 max-w-32 truncate" title="${item.description || ''}">${item.description || '-'}</td>
            <td class="px-3 py-2 whitespace-nowrap">
                <button onclick="editUniformSize(${item.id})" class="text-blue-600 hover:text-blue-800 mr-2"><i class="fas fa-edit"></i></button>
                <button onclick="deleteUniformSize(${item.id})" class="text-red-600 hover:text-red-800"><i class="fas fa-trash"></i></button>
            </td>
        </tr>
    `).join('');
}

function openUniformSizeModal(id = null) {
    const modal = document.getElementById('uniform-size-modal');
    const form = document.getElementById('uniform-size-form');
    const title = document.getElementById('uniform-size-modal-title');
    form.reset();
    document.getElementById('uniform-size-id').value = '';
    if (id) {
        const item = allUniformSizes.find(i => i.id === id);
        if (item) {
            title.textContent = 'Edit Uniform Size';
            document.getElementById('uniform-size-id').value = item.id;
            document.getElementById('uniform-size-name').value = item.name;
            document.getElementById('uniform-size-description').value = item.description || '';
        }
    } else {
        title.textContent = 'Add Uniform Size';
    }
    modal.classList.add('active');
}

function closeUniformSizeModal() {
    document.getElementById('uniform-size-modal').classList.remove('active');
}

async function saveUniformSize(e) {
    e.preventDefault();
    const id = document.getElementById('uniform-size-id').value;
    const data = {
        name: document.getElementById('uniform-size-name').value,
        description: document.getElementById('uniform-size-description').value
    };
    const url = id ? `${API_BASE}/uniform-sizes/${id}` : `${API_BASE}/uniform-sizes`;
    const method = id ? 'PUT' : 'POST';
    try {
        await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
        closeUniformSizeModal();
        loadUniformSizes();
    } catch (error) {
        console.error('Error saving uniform size:', error);
    }
}

async function editUniformSize(id) {
    openUniformSizeModal(id);
}

async function deleteUniformSize(id) {
    if (confirm('Are you sure you want to delete this uniform size?')) {
        try {
            await fetch(`${API_BASE}/uniform-sizes/${id}`, { method: 'DELETE' });
            loadUniformSizes();
        } catch (error) {
            console.error('Error deleting uniform size:', error);
        }
    }
}

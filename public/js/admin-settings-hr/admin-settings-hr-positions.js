// POSITIONS
async function loadPositions() {
    try {
        const response = await fetch(`${API_BASE}/positions`);
        allPositions = await response.json();
        renderPositions();
    } catch (error) {
        console.error('Error loading positions:', error);
    }
}

function renderPositions() {
    const tbody = document.getElementById('positions-table-body');
    if (!tbody) return;
    const sortedPositions = [...allPositions].sort((a, b) => a.id - b.id);
    tbody.innerHTML = sortedPositions.map(item => `
        <tr>
            <td class="px-3 py-2 whitespace-nowrap">${item.id}</td>
            <td class="px-3 py-2 whitespace-nowrap">${item.name}</td>
            <td class="px-3 py-2 max-w-32 truncate" title="${item.description || ''}">${item.description || '-'}</td>
            <td class="px-3 py-2 whitespace-nowrap">
                <button onclick="editPosition(${item.id})" class="text-blue-600 hover:text-blue-800 mr-2"><i class="fas fa-edit"></i></button>
                <button onclick="deletePosition(${item.id})" class="text-red-600 hover:text-red-800"><i class="fas fa-trash"></i></button>
            </td>
        </tr>
    `).join('');
}

function filterPositions() {
    const searchTerm = (document.getElementById('positions-search')?.value || '').toLowerCase();
    const filtered = allPositions.filter(item =>
        !searchTerm ||
        (item.name && item.name.toLowerCase().includes(searchTerm)) ||
        (item.description && item.description.toLowerCase().includes(searchTerm))
    );
    const tbody = document.getElementById('positions-table-body');
    if (!tbody) return;
    const sorted = [...filtered].sort((a, b) => a.id - b.id);
    tbody.innerHTML = sorted.map(item => `
        <tr>
            <td class="px-3 py-2 whitespace-nowrap">${item.id}</td>
            <td class="px-3 py-2 whitespace-nowrap">${item.name}</td>
            <td class="px-3 py-2 max-w-32 truncate" title="${item.description || ''}">${item.description || '-'}</td>
            <td class="px-3 py-2 whitespace-nowrap">
                <button onclick="editPosition(${item.id})" class="text-blue-600 hover:text-blue-800 mr-2"><i class="fas fa-edit"></i></button>
                <button onclick="deletePosition(${item.id})" class="text-red-600 hover:text-red-800"><i class="fas fa-trash"></i></button>
            </td>
        </tr>
    `).join('');
}

function openPositionModal(id = null) {
    const modal = document.getElementById('position-modal');
    const form = document.getElementById('position-form');
    const title = document.getElementById('position-modal-title');
    form.reset();
    document.getElementById('position-id').value = '';
    if (id) {
        const item = allPositions.find(i => i.id === id);
        if (item) {
            title.textContent = 'Edit Position';
            document.getElementById('position-id').value = item.id;
            document.getElementById('position-name').value = item.name;
            document.getElementById('position-description').value = item.description || '';
        }
    } else {
        title.textContent = 'Add Position';
    }
    modal.classList.add('active');
}

function closePositionModal() {
    document.getElementById('position-modal').classList.remove('active');
}

async function savePosition(e) {
    e.preventDefault();
    const id = document.getElementById('position-id').value;
    const data = {
        name: document.getElementById('position-name').value,
        description: document.getElementById('position-description').value
    };
    try {
        const url = id ? `${API_BASE}/positions/${id}` : `${API_BASE}/positions`;
        const method = id ? 'PUT' : 'POST';
        await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
        closePositionModal();
        loadPositions();
    } catch (error) {
        console.error('Error saving position:', error);
    }
}

async function editPosition(id) {
    openPositionModal(id);
}

async function deletePosition(id) {
    if (confirm('Are you sure you want to delete this position?')) {
        try {
            await fetch(`${API_BASE}/positions/${id}`, { method: 'DELETE' });
            loadPositions();
        } catch (error) {
            console.error('Error deleting position:', error);
        }
    }
}

// ACCOMMODATION BLOCKS
let allAccommodationBlocks = [];

async function loadAccommodationBlocks() {
    showTableLoading('accommodation-blocks-table-body', 'Loading accommodation blocks...');
    try {
        const response = await fetch(`${API_BASE}/accommodation-blocks`);
        allAccommodationBlocks = await response.json();
        renderAccommodationBlocks();
    } catch (error) {
        console.error('Error loading accommodation blocks:', error);
    }
}

function renderAccommodationBlocks() {
    const tbody = document.getElementById('accommodation-blocks-table-body');
    if (!tbody) return;
    const search = (document.getElementById('accommodation-blocks-search')?.value || '').toLowerCase();
    const filtered = allAccommodationBlocks.filter(item =>
        !search || (item.name || '').toLowerCase().includes(search) || (item.location_name || '').toLowerCase().includes(search)
    );
    tbody.innerHTML = filtered.length ? filtered.map(item => `
        <tr>
            <td class="px-3 py-2 whitespace-nowrap">${item.id}</td>
            <td class="px-3 py-2 whitespace-nowrap">${item.name}</td>
            <td class="px-3 py-2 whitespace-nowrap">${item.location_name || '-'}</td>
            <td class="px-3 py-2 whitespace-nowrap">${item.capacity || 0}</td>
            <td class="px-3 py-2 whitespace-nowrap">${item.description || '-'}</td>
            <td class="px-3 py-2 whitespace-nowrap">
                <button onclick="editAccommodationBlock(${item.id})" class="text-blue-600 hover:text-blue-800 mr-2"><i class="fas fa-edit"></i></button>
                <button onclick="deleteAccommodationBlock(${item.id})" class="text-red-600 hover:text-red-800"><i class="fas fa-trash"></i></button>
            </td>
        </tr>
    `).join('') : '<tr><td colspan="6" class="px-3 py-4 text-center text-gray-400">No accommodation blocks found</td></tr>';
}

function filterAccommodationBlocks() {
    renderAccommodationBlocks();
}

function openAccommodationBlockModal(id = null) {
    const existing = document.getElementById('accommodation-block-modal');
    if (existing) existing.remove();
    const item = id ? allAccommodationBlocks.find(i => i.id === id) : null;
    const locationOptions = (allAccommodationLocations || []).map(loc =>
        `<option value="${loc.id}" ${item && item.location_id === loc.id ? 'selected' : ''}>${loc.name}</option>`
    ).join('');
    const modal = document.createElement('div');
    modal.id = 'accommodation-block-modal';
    modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
    modal.innerHTML = `
        <div class="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
            <h3 class="text-lg font-semibold mb-4">${item ? 'Edit' : 'Add'} Accommodation Block</h3>
            <form id="accommodation-block-form" onsubmit="saveAccommodationBlock(event, ${id || 'null'})">
                <div class="mb-3">
                    <label class="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                    <input type="text" id="accommodation-block-name" required value="${item ? item.name : ''}" class="w-full px-3 py-2 text-sm border rounded-lg">
                </div>
                <div class="mb-3">
                    <label class="block text-sm font-medium text-gray-700 mb-1">Location</label>
                    <select id="accommodation-block-location-id" class="w-full px-3 py-2 text-sm border rounded-lg">
                        <option value="">-- Select Location --</option>
                        ${locationOptions}
                    </select>
                </div>
                <div class="mb-3">
                    <label class="block text-sm font-medium text-gray-700 mb-1">Capacity</label>
                    <input type="number" id="accommodation-block-capacity" min="0" value="${item ? (item.capacity || 0) : 0}" class="w-full px-3 py-2 text-sm border rounded-lg">
                </div>
                <div class="mb-4">
                    <label class="block text-sm font-medium text-gray-700 mb-1">Description</label>
                    <textarea id="accommodation-block-description" rows="2" class="w-full px-3 py-2 text-sm border rounded-lg">${item ? (item.description || '') : ''}</textarea>
                </div>
                <div class="flex justify-end gap-2">
                    <button type="button" onclick="closeAccommodationBlockModal()" class="px-4 py-2 text-sm bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300">Cancel</button>
                    <button type="submit" class="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700">${item ? 'Update' : 'Add'}</button>
                </div>
            </form>
        </div>
    `;
    document.body.appendChild(modal);
    modal.addEventListener('click', e => { if (e.target === modal) closeAccommodationBlockModal(); });
}

function closeAccommodationBlockModal() {
    const modal = document.getElementById('accommodation-block-modal');
    if (modal) modal.remove();
}

async function saveAccommodationBlock(e, id) {
    e.preventDefault();
    const data = {
        name: document.getElementById('accommodation-block-name').value,
        location_id: document.getElementById('accommodation-block-location-id').value || null,
        capacity: parseInt(document.getElementById('accommodation-block-capacity').value) || 0,
        description: document.getElementById('accommodation-block-description').value
    };
    try {
        const url = id ? `${API_BASE}/accommodation-blocks/${id}` : `${API_BASE}/accommodation-blocks`;
        const method = id ? 'PUT' : 'POST';
        const response = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
        if (!response.ok) { const err = await response.json().catch(() => ({})); alert('Error: ' + (err.error || 'Unknown')); return; }
        closeAccommodationBlockModal();
        loadAccommodationBlocks();
    } catch (error) {
        console.error('Error saving accommodation block:', error);
        alert('Error saving accommodation block');
    }
}

function editAccommodationBlock(id) {
    openAccommodationBlockModal(id);
}

async function deleteAccommodationBlock(id) {
    if (confirm('Are you sure you want to delete this accommodation block?')) {
        try {
            await fetch(`${API_BASE}/accommodation-blocks/${id}`, { method: 'DELETE' });
            loadAccommodationBlocks();
        } catch (error) {
            console.error('Error deleting accommodation block:', error);
        }
    }
}

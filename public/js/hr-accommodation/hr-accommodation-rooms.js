// HR Accommodation Management - Rooms
let hrAllAccommodationRooms = [];

async function loadHRAccommodationRooms() {
    showTableLoading('hr-accommodation-rooms-table-body', 'Loading accommodation rooms...');
    try {
        const [roomsRes, locRes] = await Promise.all([
            fetch(`${API_BASE}/accommodation-rooms`),
            fetch(`${API_BASE}/accommodation-locations`)
        ]);
        hrAllAccommodationRooms = await roomsRes.json();
        hrAllAccommodationLocations = await locRes.json();
        renderHRAccommodationRooms();
    } catch (error) {
        console.error('Error loading accommodation rooms:', error);
        showTableError('hr-accommodation-rooms-table-body', 'Error loading accommodation rooms.');
    }
}

function renderHRAccommodationRooms() {
    const tbody = document.getElementById('hr-accommodation-rooms-table-body');
    if (!tbody) return;
    const search = (document.getElementById('hr-accommodation-rooms-search')?.value || '').toLowerCase();
    const filtered = hrAllAccommodationRooms.filter(item =>
        !search || (item.name || '').toLowerCase().includes(search) ||
        (item.location_name || '').toLowerCase().includes(search)
    ).sort((a, b) => {
        const aNum = parseFloat(a.name) || 0;
        const bNum = parseFloat(b.name) || 0;
        return aNum - bNum;
    });
    const countEl = document.getElementById('hr-accommodation-rooms-count');
    if (countEl) countEl.textContent = `(${filtered.length})`;
    tbody.innerHTML = filtered.length ? filtered.map((item, idx) => `
        <tr>
            <td class="px-3 py-1 whitespace-nowrap">${idx + 1}</td>
            <td class="px-3 py-1 whitespace-nowrap">${item.location_name || '-'}</td>
            <td class="px-3 py-1 whitespace-nowrap">${item.name}</td>
            <td class="px-3 py-1 whitespace-nowrap">${item.capacity || 0}</td>
            <td class="px-3 py-1 whitespace-nowrap">${item.description || '-'}</td>
            <td class="px-3 py-1 whitespace-nowrap">
                <button onclick="viewRoomHistory(${item.id})" class="text-green-600 hover:text-green-800 mr-2" title="View History"><i class="fas fa-eye"></i></button>
                <button onclick="editHRAccommodationRoom(${item.id})" class="text-blue-600 hover:text-blue-800 mr-2"><i class="fas fa-edit"></i></button>
                <button onclick="deleteHRAccommodationRoom(${item.id})" class="text-red-600 hover:text-red-800"><i class="fas fa-trash"></i></button>
            </td>
        </tr>
    `).join('') : '<tr><td colspan="6" class="px-3 py-4 text-center text-gray-400">No accommodation rooms found</td></tr>';
}

function filterHRAccommodationRooms() {
    renderHRAccommodationRooms();
}

function openHRAccommodationRoomModal(id = null) {
    const existing = document.getElementById('hr-accommodation-room-modal');
    if (existing) existing.remove();
    const item = id ? hrAllAccommodationRooms.find(i => i.id === id) : null;
    const locationOptions = hrAllAccommodationLocations.map(loc =>
        `<option value="${loc.id}" ${item && item.accommodation_location_id == loc.id ? 'selected' : ''}>${loc.name}</option>`
    ).join('');
    const modal = document.createElement('div');
    modal.id = 'hr-accommodation-room-modal';
    modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
    modal.innerHTML = `
        <div class="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
            <h3 class="text-lg font-semibold mb-4">${item ? 'Edit' : 'Add'} Room</h3>
            <form id="hr-accommodation-room-form" onsubmit="saveHRAccommodationRoom(event, ${id || 'null'})">
                <div class="mb-3">
                    <label class="block text-sm font-medium text-gray-700 mb-1">Room Number *</label>
                    <input type="text" id="hr-accommodation-room-name" required value="${item ? item.name : ''}" class="w-full px-3 py-2 text-sm border rounded-lg">
                </div>
                <div class="mb-3">
                    <label class="block text-sm font-medium text-gray-700 mb-1">Accommodation Location</label>
                    <select id="hr-accommodation-room-location" class="w-full px-3 py-2 text-sm border rounded-lg">
                        <option value="">-- Select Location --</option>
                        ${locationOptions}
                    </select>
                </div>
                <div class="mb-3">
                    <label class="block text-sm font-medium text-gray-700 mb-1">Capacity</label>
                    <input type="number" id="hr-accommodation-room-capacity" min="0" value="${item ? (item.capacity || 0) : 0}" class="w-full px-3 py-2 text-sm border rounded-lg">
                </div>
                <div class="mb-4">
                    <label class="block text-sm font-medium text-gray-700 mb-1">Description</label>
                    <textarea id="hr-accommodation-room-description" rows="2" class="w-full px-3 py-2 text-sm border rounded-lg">${item ? (item.description || '') : ''}</textarea>
                </div>
                <div class="flex justify-end gap-2">
                    <button type="button" onclick="closeHRAccommodationRoomModal()" class="px-4 py-2 text-sm bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300">Cancel</button>
                    <button type="submit" class="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700">${item ? 'Update' : 'Add'}</button>
                </div>
            </form>
        </div>
    `;
    document.body.appendChild(modal);
    modal.addEventListener('click', e => { if (e.target === modal) closeHRAccommodationRoomModal(); });
}

function closeHRAccommodationRoomModal() {
    const modal = document.getElementById('hr-accommodation-room-modal');
    if (modal) modal.remove();
}

async function saveHRAccommodationRoom(e, id) {
    e.preventDefault();
    const data = {
        name: document.getElementById('hr-accommodation-room-name').value,
        accommodation_location_id: document.getElementById('hr-accommodation-room-location').value || null,
        capacity: document.getElementById('hr-accommodation-room-capacity').value || 0,
        description: document.getElementById('hr-accommodation-room-description').value
    };
    try {
        const url = id ? `${API_BASE}/accommodation-rooms/${id}` : `${API_BASE}/accommodation-rooms`;
        const method = id ? 'PUT' : 'POST';
        const response = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
        if (!response.ok) { const err = await response.json().catch(() => ({})); alert('Error: ' + (err.error || 'Unknown')); return; }
        const result = await response.json().catch(() => ({}));
        await logAudit(id ? 'UPDATE' : 'CREATE', 'hr-accommodation', 'Accommodation Room', id || result.id || null, `Room: ${data.name}`);
        closeHRAccommodationRoomModal();
        loadHRAccommodationRooms();
    } catch (error) {
        console.error('Error saving accommodation room:', error);
        alert('Error saving accommodation room');
    }
}

function editHRAccommodationRoom(id) {
    openHRAccommodationRoomModal(id);
}

async function deleteHRAccommodationRoom(id) {
    if (confirm('Are you sure you want to delete this room?')) {
        try {
            await fetch(`${API_BASE}/accommodation-rooms/${id}`, { method: 'DELETE' });
            const item = hrAllAccommodationRooms.find(i => i.id === id);
            await logAudit('DELETE', 'hr-accommodation', 'Accommodation Room', id, `Room: ${item?.name || 'Unknown'}`);
            loadHRAccommodationRooms();
        } catch (error) {
            console.error('Error deleting accommodation room:', error);
        }
    }
}

async function viewRoomHistory(roomId) {
    const room = hrAllAccommodationRooms.find(r => r.id === roomId);
    const modal = document.createElement('div');
    modal.id = 'room-history-modal';
    modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
    modal.innerHTML = `
        <div class="bg-white rounded-lg shadow-xl w-full max-w-3xl max-h-[85vh] overflow-y-auto my-6">
            <div class="flex items-center justify-between px-6 py-4 border-b sticky top-0 bg-white z-10">
                <h3 class="text-lg font-semibold">Room History — ${room ? room.name : ''} ${room && room.location_name ? '(' + room.location_name + ')' : ''}</h3>
                <button onclick="closeRoomHistoryModal()" class="text-gray-400 hover:text-gray-600"><i class="fas fa-times text-xl"></i></button>
            </div>
            <div class="p-6">
                <p class="text-sm text-gray-400 mb-4">Loading history...</p>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    modal.addEventListener('click', e => { if (e.target === modal) closeRoomHistoryModal(); });

    try {
        const response = await fetch(`${API_BASE}/accommodation-rooms/${roomId}/history`);
        const history = await response.json();
        const content = modal.querySelector('.p-6');
        if (!history || history.length === 0) {
            content.innerHTML = '<p class="text-sm text-gray-400 text-center py-8">No assignment history found for this room.</p>';
            return;
        }
        content.innerHTML = `
            <div class="overflow-x-auto">
                <table class="w-full text-sm border rounded-lg">
                    <thead class="bg-gray-100 sticky top-0">
                        <tr>
                            <th class="px-3 py-2 text-left">#</th>
                            <th class="px-3 py-2 text-left">Employee</th>
                            <th class="px-3 py-2 text-left">Emp Code</th>
                            <th class="px-3 py-2 text-left">Assigned Date</th>
                            <th class="px-3 py-2 text-left">Vacated Date</th>
                            <th class="px-3 py-2 text-left">Duration</th>
                            <th class="px-3 py-2 text-left">Status</th>
                            <th class="px-3 py-2 text-left">Notes</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-gray-200">
                        ${history.map((h, idx) => {
                            const assigned = h.assigned_date || '-';
                            const vacated = h.vacated_date || null;
                            let duration = '-';
                            if (h.assigned_date) {
                                const end = vacated ? new Date(vacated) : new Date();
                                const start = new Date(h.assigned_date);
                                const days = Math.round((end - start) / (1000 * 60 * 60 * 24));
                                if (days >= 0) {
                                    duration = days === 0 ? 'Same day' : `${days} day${days !== 1 ? 's' : ''}`;
                                }
                            }
                            const status = vacated
                                ? '<span class="px-2 py-0.5 text-xs rounded-full bg-gray-100 text-gray-600">Vacated</span>'
                                : '<span class="px-2 py-0.5 text-xs rounded-full bg-green-100 text-green-700">Current</span>';
                            return `
                                <tr>
                                    <td class="px-3 py-2">${idx + 1}</td>
                                    <td class="px-3 py-2 font-medium">${h.employee_name || 'Unknown'}</td>
                                    <td class="px-3 py-2">${h.emp_code || '-'}</td>
                                    <td class="px-3 py-2">${assigned}</td>
                                    <td class="px-3 py-2">${vacated || '<span class="text-green-600 font-medium">—</span>'}</td>
                                    <td class="px-3 py-2 text-gray-500">${duration}</td>
                                    <td class="px-3 py-2">${status}</td>
                                    <td class="px-3 py-2 text-gray-500">${h.notes || '-'}</td>
                                </tr>
                            `;
                        }).join('')}
                    </tbody>
                </table>
            </div>
        `;
    } catch (error) {
        console.error('Error loading room history:', error);
        modal.querySelector('.p-6').innerHTML = '<p class="text-sm text-red-500 text-center py-8">Error loading room history.</p>';
    }
}

function closeRoomHistoryModal() {
    const modal = document.getElementById('room-history-modal');
    if (modal) modal.remove();
}

// HR Accommodation Management - Room Assignments
let hrAllRoomAssignments = [];
let hrAllRoomsForAssignment = [];

const ROOM_ASSIGNMENT_COLUMNS = [
    { key: 'num', label: '#' },
    { key: 'employee', label: 'Employee' },
    { key: 'country', label: 'Country' },
    { key: 'location', label: 'Location' },
    { key: 'sub_location', label: 'Sub Location' },
    { key: 'business_type', label: 'Business Type' },
    { key: 'acc_name', label: 'Accommodation' },
    { key: 'acc_location', label: 'Acc. Location' },
    { key: 'room', label: 'Room' },
    { key: 'assigned_date', label: 'Assigned Date' },
    { key: 'notes', label: 'Notes' },
    { key: 'actions', label: 'Actions' }
];
let roomAssignmentColumnVisibility = {};
let roomAssignmentFreezeCount = 0;
const RA_COL_VIS_KEY = 'ra_col_visibility_v5';
const RA_FREEZE_KEY = 'ra_freeze_count_v5';

// Clear stale keys from previous versions
try { localStorage.removeItem('ra_col_visibility_v2'); localStorage.removeItem('ra_freeze_count_v2'); } catch(e) {}
try { localStorage.removeItem('ra_col_visibility_v3'); localStorage.removeItem('ra_freeze_count_v3'); } catch(e) {}
try { localStorage.removeItem('ra_col_visibility_v4'); localStorage.removeItem('ra_freeze_count_v4'); } catch(e) {}

function saveRoomAssignmentColumnSettings() {
    try {
        localStorage.setItem(RA_COL_VIS_KEY, JSON.stringify(roomAssignmentColumnVisibility));
        localStorage.setItem(RA_FREEZE_KEY, String(roomAssignmentFreezeCount));
    } catch(e) {}
}

function loadRoomAssignmentColumnSettings() {
    try {
        const vis = JSON.parse(localStorage.getItem(RA_COL_VIS_KEY));
        if (vis && typeof vis === 'object') {
            ROOM_ASSIGNMENT_COLUMNS.forEach(c => {
                if (vis[c.key] !== undefined) roomAssignmentColumnVisibility[c.key] = vis[c.key];
                else roomAssignmentColumnVisibility[c.key] = true;
            });
        } else {
            ROOM_ASSIGNMENT_COLUMNS.forEach(c => roomAssignmentColumnVisibility[c.key] = true);
        }
        const fc = localStorage.getItem(RA_FREEZE_KEY);
        roomAssignmentFreezeCount = fc ? parseInt(fc) || 0 : 0;
    } catch(e) {
        ROOM_ASSIGNMENT_COLUMNS.forEach(c => roomAssignmentColumnVisibility[c.key] = true);
        roomAssignmentFreezeCount = 0;
    }
}

function initRoomAssignmentColumnSettings() {
    loadRoomAssignmentColumnSettings();
    const container = document.getElementById('room-assignment-column-checkboxes');
    if (container) {
        container.innerHTML = ROOM_ASSIGNMENT_COLUMNS.map(c => {
            const checked = roomAssignmentColumnVisibility[c.key] ? 'checked' : '';
            return `<label style="display:block" class="text-sm cursor-pointer hover:bg-gray-50 px-2 py-1 rounded">
                <input type="checkbox" ${checked} onchange="toggleRoomAssignmentColumn('${c.key}')" class="mr-2" ra-col="${c.key}">${c.label}
            </label>`;
        }).join('');
    }
    const freezeSelect = document.getElementById('room-assignment-freeze-select');
    if (freezeSelect) {
        freezeSelect.innerHTML = '<option value="0">None</option>' +
            ROOM_ASSIGNMENT_COLUMNS.map((c, i) => `<option value="${i + 1}">Up to ${c.label}</option>`).join('');
        freezeSelect.value = String(roomAssignmentFreezeCount);
    }
}

initRoomAssignmentColumnSettings();

function toggleRoomAssignmentColumnSettings() {
    const panel = document.getElementById('room-assignment-column-settings');
    if (panel) panel.classList.toggle('hidden');
}

function toggleRoomAssignmentColumn(key) {
    roomAssignmentColumnVisibility[key] = !roomAssignmentColumnVisibility[key];
    saveRoomAssignmentColumnSettings();
    applyRoomAssignmentColumnVisibility();
}

function changeRoomAssignmentFreezeCount() {
    const freezeSelect = document.getElementById('room-assignment-freeze-select');
    if (!freezeSelect) return;
    roomAssignmentFreezeCount = parseInt(freezeSelect.value) || 0;
    saveRoomAssignmentColumnSettings();
    applyRoomAssignmentColumnVisibility();
}

function applyRoomAssignmentColumnVisibility() {
    const table = document.querySelector('#accommodation-room-assignments-tab table');
    if (!table) return;
    const serverRestr = (typeof serverColumnVisibility !== 'undefined' && serverColumnVisibility['accommodation-management']) || {};
    ROOM_ASSIGNMENT_COLUMNS.forEach(c => {
        if (serverRestr[c.key] !== undefined && !serverRestr[c.key]) {
            roomAssignmentColumnVisibility[c.key] = false;
        }
    });
    const visibleCols = ROOM_ASSIGNMENT_COLUMNS.filter(c => roomAssignmentColumnVisibility[c.key]);
    const visibleKeys = visibleCols.map(c => c.key);

    ROOM_ASSIGNMENT_COLUMNS.forEach((c, idx) => {
        const visible = roomAssignmentColumnVisibility[c.key];
        const th = table.querySelector(`thead th[data-col="${c.key}"]`);
        if (th) th.style.display = visible ? '' : 'none';
        table.querySelectorAll(`tbody tr td:nth-child(${idx + 1})`).forEach(td => td.style.display = visible ? '' : 'none');
    });

    const freezeCount = Math.min(roomAssignmentFreezeCount, visibleCols.length);

    ROOM_ASSIGNMENT_COLUMNS.forEach((c, idx) => {
        const th = table.querySelector(`thead th[data-col="${c.key}"]`);
        const tds = table.querySelectorAll(`tbody tr td:nth-child(${idx + 1})`);
        const visibleIdx = visibleKeys.indexOf(c.key);
        if (visibleIdx < 0) return;

        if (visibleIdx < freezeCount) {
            const leftOffset = visibleCols.slice(0, visibleIdx).reduce((sum, col) => {
                const sampleTh = table.querySelector(`thead th[data-col="${col.key}"]`);
                return sum + (sampleTh ? sampleTh.offsetWidth : 0);
            }, 0);
            if (th) {
                th.style.left = leftOffset + 'px';
                th.style.zIndex = '30';
                th.style.backgroundColor = '#dbeafe';
            }
            tds.forEach(td => {
                td.style.position = 'sticky';
                td.style.left = leftOffset + 'px';
                td.style.zIndex = '10';
                td.style.backgroundColor = '#ffffff';
            });
        } else {
            if (th) {
                th.style.left = '';
                th.style.zIndex = '';
                th.style.backgroundColor = '';
            }
            tds.forEach(td => {
                td.style.position = '';
                td.style.left = '';
                td.style.zIndex = '';
                td.style.backgroundColor = '';
            });
        }
    });

}

function resetRoomAssignmentColumns() {
    ROOM_ASSIGNMENT_COLUMNS.forEach(c => roomAssignmentColumnVisibility[c.key] = true);
    roomAssignmentFreezeCount = 0;
    saveRoomAssignmentColumnSettings();
    const container = document.getElementById('room-assignment-column-checkboxes');
    if (container) {
        container.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = true);
    }
    const freezeSelect = document.getElementById('room-assignment-freeze-select');
    if (freezeSelect) freezeSelect.value = '0';
    applyRoomAssignmentColumnVisibility();
}

document.addEventListener('click', function(event) {
    const panel = document.getElementById('room-assignment-column-settings');
    const btn = panel ? panel.parentElement.querySelector('button') : null;
    if (panel && !panel.contains(event.target) && btn && !btn.contains(event.target)) {
        panel.classList.add('hidden');
    }
});

document.addEventListener('employeeListChanged', function() {
    if (typeof loadHRAccommodationRoomAssignments === 'function' &&
        document.getElementById('accommodation-room-assignments-tab') &&
        !document.getElementById('accommodation-room-assignments-tab').classList.contains('hidden')) {
        loadHRAccommodationRoomAssignments();
    }
});

async function loadHRAccommodationRoomAssignments() {
    showTableLoading('hr-accommodation-room-assignments-table-body', 'Loading room assignments...');
    try {
        const [assignRes, roomRes, locRes] = await Promise.all([
            fetch(`${API_BASE}/accommodation-room-assignments`),
            fetch(`${API_BASE}/accommodation-rooms`),
            fetch(`${API_BASE}/accommodation-locations`)
        ]);
        hrAllRoomAssignments = await assignRes.json();
        hrAllRoomsForAssignment = await roomRes.json();
        hrAllAccommodationLocations = await locRes.json();
        populateRoomAssignmentLocationFilter();
        populateRAHeaderFilters();
        renderHRAccommodationRoomAssignments();
    } catch (error) {
        console.error('Error loading room assignments:', error);
        showTableError('hr-accommodation-room-assignments-table-body', 'Error loading room assignments.');
    }
}

function populateRoomAssignmentLocationFilter() {
    const select = document.getElementById('hr-accommodation-room-assignments-location-filter');
    if (!select) return;
    const currentVal = select.value;
    select.innerHTML = '<option value="">All Locations</option>' +
        hrAllAccommodationLocations.map(l => `<option value="${l.id}">${l.name}</option>`).join('');
    select.value = currentVal;
}

function populateRAHeaderFilters() {
    const accLocSelect = document.getElementById('ra-filter-acc-location');
    const roomSelect = document.getElementById('ra-filter-room');
    if (accLocSelect) {
        const currentVal = accLocSelect.value;
        accLocSelect.innerHTML = '<option value="">All</option>' +
            hrAllAccommodationLocations.map(l => `<option value="${l.id}">${l.name}</option>`).join('');
        accLocSelect.value = currentVal;
    }
    populateRAHeaderRoomFilter();
    populateRAHeaderEmpLocationFilters();
}

function populateRAHeaderEmpLocationFilters() {
    const countrySelect = document.getElementById('ra-filter-country');
    const locationSelect = document.getElementById('ra-filter-location');
    const subLocationSelect = document.getElementById('ra-filter-sub-location');

    const countries = [...new Set(hrAllRoomAssignments.map(a => a.emp_country).filter(Boolean))].sort();
    const locations = [...new Set(hrAllRoomAssignments.map(a => a.emp_location).filter(Boolean))].sort();
    const subLocations = [...new Set(hrAllRoomAssignments.map(a => a.emp_sub_location).filter(Boolean))].sort();

    if (countrySelect) {
        const currentVal = countrySelect.value;
        countrySelect.innerHTML = '<option value="">All</option>' +
            countries.map(c => `<option value="${c}">${c}</option>`).join('');
        if (currentVal && [...countrySelect.options].some(o => o.value === currentVal)) countrySelect.value = currentVal;
    }
    if (locationSelect) {
        const currentVal = locationSelect.value;
        locationSelect.innerHTML = '<option value="">All</option>' +
            locations.map(l => `<option value="${l}">${l}</option>`).join('');
        if (currentVal && [...locationSelect.options].some(o => o.value === currentVal)) locationSelect.value = currentVal;
    }
    if (subLocationSelect) {
        const currentVal = subLocationSelect.value;
        subLocationSelect.innerHTML = '<option value="">All</option>' +
            subLocations.map(s => `<option value="${s}">${s}</option>`).join('');
        if (currentVal && [...subLocationSelect.options].some(o => o.value === currentVal)) subLocationSelect.value = currentVal;
    }
}

function populateRAHeaderRoomFilter() {
    const roomSelect = document.getElementById('ra-filter-room');
    const accLocSelect = document.getElementById('ra-filter-acc-location');
    if (!roomSelect) return;
    const accLocId = accLocSelect?.value || '';
    const currentVal = roomSelect.value;
    let rooms = hrAllRoomsForAssignment;
    if (accLocId) {
        rooms = rooms.filter(r => r.accommodation_location_id == accLocId);
    }
    roomSelect.innerHTML = '<option value="">All</option>' +
        rooms.map(r => {
            const locName = hrAllAccommodationLocations.find(l => l.id == r.accommodation_location_id)?.name || '';
            return `<option value="${r.id}">${locName ? locName + ' - ' : ''}${r.name}</option>`;
        }).join('');
    if (currentVal && [...roomSelect.options].some(o => o.value === currentVal)) {
        roomSelect.value = currentVal;
    }
}

function onRAFilterAccLocationChange() {
    populateRAHeaderRoomFilter();
    filterHRAccommodationRoomAssignments();
}

function renderHRAccommodationRoomAssignments() {
    const tbody = document.getElementById('hr-accommodation-room-assignments-table-body');
    if (!tbody) return;
    const searchInput = document.getElementById('hr-accommodation-room-assignments-search');
    const locFilter = document.getElementById('hr-accommodation-room-assignments-location-filter');
    const clearBtn = document.getElementById('hr-accommodation-room-assignments-clear');
    const search = (searchInput?.value || '').toLowerCase();
    const locFilterVal = locFilter?.value || '';
    const hasSearch = !!search;
    const hasLocFilter = !!locFilterVal;
    const hasFilter = hasSearch || hasLocFilter || !!(document.getElementById('ra-filter-acc-location')?.value) || !!(document.getElementById('ra-filter-room')?.value) || !!(document.getElementById('ra-filter-country')?.value) || !!(document.getElementById('ra-filter-location')?.value) || !!(document.getElementById('ra-filter-sub-location')?.value);

    if (searchInput) {
        if (hasSearch) searchInput.classList.add('border-yellow-400', 'bg-yellow-100', 'filter-active-blink');
        else searchInput.classList.remove('border-yellow-400', 'bg-yellow-100', 'filter-active-blink');
    }
    if (locFilter) {
        if (hasLocFilter) locFilter.classList.add('border-yellow-400', 'bg-yellow-100', 'filter-active-blink');
        else locFilter.classList.remove('border-yellow-400', 'bg-yellow-100', 'filter-active-blink');
    }
    if (clearBtn) {
        if (hasFilter) clearBtn.classList.add('border-yellow-400', 'bg-yellow-100', 'text-yellow-700', 'filter-active-blink');
        else clearBtn.classList.remove('border-yellow-400', 'bg-yellow-100', 'text-yellow-700', 'filter-active-blink');
    }

    const filtered = hrAllRoomAssignments.filter(item => {
        const empName = `${item.first_name || ''} ${item.last_name || ''}`.trim().toLowerCase();
        const matchesSearch = !search || empName.includes(search) ||
            (item.emp_code || '').toLowerCase().includes(search) ||
            (item.room_name || '').toLowerCase().includes(search) ||
            (item.accommodation_name || '').toLowerCase().includes(search);
        const matchesLoc = !locFilterVal || item.accommodation_name === (hrAllAccommodationLocations.find(l => l.id == locFilterVal)?.name || '');
        const accLocFilter = document.getElementById('ra-filter-acc-location');
        const roomFilter = document.getElementById('ra-filter-room');
        const countryFilter = document.getElementById('ra-filter-country');
        const locationFilter = document.getElementById('ra-filter-location');
        const subLocationFilter = document.getElementById('ra-filter-sub-location');
        const accLocVal = accLocFilter?.value || '';
        const roomVal = roomFilter?.value || '';
        const countryVal = countryFilter?.value || '';
        const locationVal = locationFilter?.value || '';
        const subLocationVal = subLocationFilter?.value || '';
        const matchesAccLoc = !accLocVal || hrAllAccommodationLocations.find(l => l.id == accLocVal && l.name === item.accommodation_name);
        const matchesRoom = !roomVal || item.room_id == roomVal;
        const matchesCountry = !countryVal || item.emp_country === countryVal;
        const matchesLocation = !locationVal || item.emp_location === locationVal;
        const matchesSubLocation = !subLocationVal || item.emp_sub_location === subLocationVal;
        return matchesSearch && matchesLoc && matchesAccLoc && matchesRoom && matchesCountry && matchesLocation && matchesSubLocation;
    });
    const countEl = document.getElementById('hr-accommodation-room-assignments-count');
    if (countEl) countEl.textContent = `(${filtered.length})`;
    tbody.innerHTML = filtered.length ? filtered.map((item, idx) => {
        const empName = `${item.first_name || ''} ${item.last_name || ''}`.trim();
        const assignedDate = item.assigned_date ? new Date(item.assigned_date).toLocaleDateString() : '-';
        const hasAssignment = !!item.assignment_id;
        const empLocation = [item.emp_country, item.emp_location, item.emp_sub_location, item.emp_business_type].filter(Boolean).join(' - ') || '-';
        return `
        <tr>
            <td class="px-3 py-1 whitespace-nowrap">${idx + 1}</td>
            <td class="px-3 py-1 whitespace-nowrap">${item.photo_path ? `<img src="${item.photo_path}" onclick="openPhotoLightbox('${item.photo_path}')" class="w-8 h-8 rounded-full object-cover inline-block mr-2 align-middle cursor-pointer hover:opacity-80 transition">` : `<span class="w-8 h-8 rounded-full bg-gray-200 inline-flex items-center justify-center mr-2 align-middle text-gray-500 text-xs"><i class="fas fa-user"></i></span>`}${empName} (${item.emp_code || '-'})</td>
            <td class="px-3 py-1 whitespace-nowrap">${item.emp_country || '-'}</td>
            <td class="px-3 py-1 whitespace-nowrap">${item.emp_location || '-'}</td>
            <td class="px-3 py-1 whitespace-nowrap">${item.emp_sub_location || '-'}</td>
            <td class="px-3 py-1 whitespace-nowrap">${item.emp_business_type || '-'}</td>
            <td class="px-3 py-1 whitespace-nowrap">${item.accommodation_name || '-'}</td>
            <td class="px-3 py-1 whitespace-nowrap">${[item.acc_country, item.acc_location].filter(Boolean).join(' - ') || '-'}</td>
            <td class="px-3 py-1 whitespace-nowrap">${item.room_name || '<span class="text-gray-400">Not Assigned</span>'}</td>
            <td class="px-3 py-1 whitespace-nowrap">${assignedDate}</td>
            <td class="px-3 py-1 whitespace-nowrap">${item.notes || '-'}</td>
            <td class="px-3 py-1 whitespace-nowrap">
                ${hasAssignment ? `<button onclick="viewRoomHistory(${item.room_id})" class="text-green-600 hover:text-green-800 mr-2" title="View Room History"><i class="fas fa-eye"></i></button><button onclick="editHRAccommodationRoomAssignment(${item.emp_pk_id})" class="text-blue-600 hover:text-blue-800 mr-2" title="Edit"><i class="fas fa-edit"></i></button><button onclick="deleteHRAccommodationRoomAssignment(${item.assignment_id})" class="text-red-600 hover:text-red-800" title="Remove Assignment"><i class="fas fa-trash"></i></button>` : `<button onclick="editHRAccommodationRoomAssignment(${item.emp_pk_id})" class="px-2 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700" title="Assign Room"><i class="fas fa-bed mr-1"></i>Assign</button>`}
            </td>
        </tr>`;
    }).join('') : '<tr><td colspan="12" class="px-3 py-4 text-center text-gray-400">No employees found</td></tr>';

    const unassignedCount = hrAllRoomAssignments.filter(a => !a.assignment_id).length;
    const countSpan = document.getElementById('hr-room-assignments-unassigned-count');
    if (countSpan) {
        countSpan.textContent = unassignedCount > 0 ? `(${unassignedCount} unassigned)` : '';
        if (unassignedCount > 0) {
            countSpan.classList.add('text-red-600', 'font-semibold', 'filter-active-blink');
        } else {
            countSpan.classList.remove('text-red-600', 'font-semibold', 'filter-active-blink');
        }
    }

    applyRoomAssignmentColumnVisibility();
}

function filterHRAccommodationRoomAssignments() {
    renderHRAccommodationRoomAssignments();
}

function openHRAccommodationRoomAssignmentModal(empPkId = null) {
    const existing = document.getElementById('hr-accommodation-room-assignment-modal');
    if (existing) existing.remove();
    const item = empPkId ? hrAllRoomAssignments.find(i => i.emp_pk_id == empPkId) : null;
    const hasAssignment = item && !!item.assignment_id;
    const empName = item ? `${item.first_name || ''} ${item.last_name || ''}`.trim() : '';
    const empCode = item ? (item.emp_code || '') : '';

    const roomCounts = {};
    hrAllRoomAssignments.forEach(a => {
        if (a.room_id) roomCounts[a.room_id] = (roomCounts[a.room_id] || 0) + 1;
    });

    const roomOptions = hrAllRoomsForAssignment
        .filter(r => {
            const count = roomCounts[r.id] || 0;
            const isCurrentRoom = item && item.room_id == r.id;
            return isCurrentRoom || count < (r.capacity || 0);
        })
        .map(r => {
            const locName = hrAllAccommodationLocations.find(l => l.id == r.accommodation_location_id)?.name || '';
            const count = roomCounts[r.id] || 0;
            const avail = (r.capacity || 0) - count;
            const availLabel = (r.capacity || 0) > 1 ? ` (${avail} available)` : '';
            return `<option value="${r.id}" ${item && item.room_id == r.id ? 'selected' : ''}>${locName ? locName + ' - ' : ''}${r.name}${availLabel}</option>`;
        }).join('');

    const today = new Date().toISOString().split('T')[0];

    const modal = document.createElement('div');
    modal.id = 'hr-accommodation-room-assignment-modal';
    modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
    modal.innerHTML = `
        <div class="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
            <h3 class="text-lg font-semibold mb-4">${hasAssignment ? 'Edit' : 'Assign'} Room</h3>
            <form id="hr-accommodation-room-assignment-form" onsubmit="saveHRAccommodationRoomAssignment(event, ${empPkId || 'null'})">
                <div class="mb-3">
                    <label class="block text-sm font-medium text-gray-700 mb-1">Employee</label>
                    <input type="text" value="${empName} (${empCode})" disabled class="w-full px-3 py-2 text-sm border rounded-lg bg-gray-100">
                </div>
                <div class="mb-3">
                    <label class="block text-sm font-medium text-gray-700 mb-1">Room *</label>
                    <select id="hr-room-assignment-room" required class="w-full px-3 py-2 text-sm border rounded-lg">
                        <option value="">-- Select Room --</option>
                        ${roomOptions}
                    </select>
                </div>
                <div class="mb-3">
                    <label class="block text-sm font-medium text-gray-700 mb-1">Assigned Date</label>
                    <input type="date" id="hr-room-assignment-date" value="${item ? (item.assigned_date || '') : today}" class="w-full px-3 py-2 text-sm border rounded-lg">
                </div>
                <div class="mb-4">
                    <label class="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                    <textarea id="hr-room-assignment-notes" rows="2" class="w-full px-3 py-2 text-sm border rounded-lg">${item ? (item.notes || '') : ''}</textarea>
                </div>
                <div class="flex justify-end gap-2">
                    <button type="button" onclick="closeHRAccommodationRoomAssignmentModal()" class="px-4 py-2 text-sm bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300">Cancel</button>
                    <button type="submit" class="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700">${hasAssignment ? 'Update' : 'Assign'}</button>
                </div>
            </form>
        </div>
    `;
    document.body.appendChild(modal);
    modal.addEventListener('click', e => { if (e.target === modal) closeHRAccommodationRoomAssignmentModal(); });
}

function closeHRAccommodationRoomAssignmentModal() {
    const modal = document.getElementById('hr-accommodation-room-assignment-modal');
    if (modal) modal.remove();
}

async function saveHRAccommodationRoomAssignment(e, empPkId) {
    e.preventDefault();
    const item = hrAllRoomAssignments.find(i => i.emp_pk_id == empPkId);
    const assignmentId = item ? item.assignment_id : null;
    const data = {
        employee_id: empPkId,
        room_id: document.getElementById('hr-room-assignment-room').value,
        assigned_date: document.getElementById('hr-room-assignment-date').value,
        notes: document.getElementById('hr-room-assignment-notes').value
    };
    try {
        const url = assignmentId ? `${API_BASE}/accommodation-room-assignments/${assignmentId}` : `${API_BASE}/accommodation-room-assignments`;
        const method = assignmentId ? 'PUT' : 'POST';
        const response = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
        if (!response.ok) { const err = await response.json().catch(() => ({})); alert('Error: ' + (err.error || 'Unknown')); return; }
        const empName = item ? `${item.first_name || ''} ${item.last_name || ''}`.trim() : '';
        const roomSelect = document.getElementById('hr-room-assignment-room');
        const roomName = roomSelect ? roomSelect.options[roomSelect.selectedIndex]?.text : '';
        await logAudit(assignmentId ? 'UPDATE' : 'CREATE', 'hr-accommodation', 'Room Assignment', assignmentId || null, `Employee: ${empName}, Room: ${roomName}`);
        closeHRAccommodationRoomAssignmentModal();
        loadHRAccommodationRoomAssignments();
    } catch (error) {
        console.error('Error saving room assignment:', error);
        alert('Error saving room assignment');
    }
}

function editHRAccommodationRoomAssignment(empPkId) {
    openHRAccommodationRoomAssignmentModal(empPkId);
}

async function deleteHRAccommodationRoomAssignment(id) {
    if (confirm('Are you sure you want to remove this room assignment?')) {
        try {
            await fetch(`${API_BASE}/accommodation-room-assignments/${id}`, { method: 'DELETE' });
            const assignment = hrAllRoomAssignments.find(a => a.assignment_id == id);
            const empName = assignment ? `${assignment.first_name || ''} ${assignment.last_name || ''}`.trim() : '';
            await logAudit('DELETE', 'hr-accommodation', 'Room Assignment', id, `Employee: ${empName}, Room: ${assignment?.room_name || 'Unknown'}`);
            loadHRAccommodationRoomAssignments();
        } catch (error) {
            console.error('Error deleting room assignment:', error);
        }
    }
}

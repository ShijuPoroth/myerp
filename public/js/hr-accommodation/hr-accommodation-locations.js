// HR Accommodation Management - Locations
let hrAllAccommodationLocations = [];
let hrAllCountries = [];
let hrAllLocationTypes = [];

async function loadHRAccommodationLocations() {
    showTableLoading('hr-accommodation-locations-table-body', 'Loading accommodation locations...');
    try {
        const [locRes, countryRes, ltRes] = await Promise.all([
            fetch(`${API_BASE}/accommodation-locations`),
            fetch(`${API_BASE}/countries`),
            fetch(`${API_BASE}/location-types`)
        ]);
        hrAllAccommodationLocations = await locRes.json();
        hrAllCountries = await countryRes.json();
        hrAllLocationTypes = await ltRes.json();
        renderHRAccommodationLocations();
    } catch (error) {
        console.error('Error loading accommodation locations:', error);
        showTableError('hr-accommodation-locations-table-body', 'Error loading accommodation locations.');
    }
}

function renderHRAccommodationLocations() {
    const tbody = document.getElementById('hr-accommodation-locations-table-body');
    if (!tbody) return;
    const search = (document.getElementById('hr-accommodation-locations-search')?.value || '').toLowerCase();
    const filtered = hrAllAccommodationLocations.filter(item =>
        !search || (item.name || '').toLowerCase().includes(search) ||
        (item.address || '').toLowerCase().includes(search) ||
        (item.country_name || '').toLowerCase().includes(search) ||
        (item.location_name || '').toLowerCase().includes(search)
    );
    const countEl = document.getElementById('hr-accommodation-locations-count');
    if (countEl) countEl.textContent = `(${filtered.length})`;
    tbody.innerHTML = filtered.length ? filtered.map((item, idx) => `
        <tr>
            <td class="px-3 py-1 whitespace-nowrap">${idx + 1}</td>
            <td class="px-3 py-1 whitespace-nowrap">${item.name}</td>
            <td class="px-3 py-1 whitespace-nowrap">${item.country_name || '-'}</td>
            <td class="px-3 py-1 whitespace-nowrap">${item.location_name || '-'}</td>
            <td class="px-3 py-1 whitespace-nowrap">${item.address || '-'}</td>
            <td class="px-3 py-1 whitespace-nowrap">${item.description || '-'}</td>
            <td class="px-3 py-1 whitespace-nowrap">
                <button onclick="editHRAccommodationLocation(${item.id})" class="text-blue-600 hover:text-blue-800 mr-2"><i class="fas fa-edit"></i></button>
                <button onclick="deleteHRAccommodationLocation(${item.id})" class="text-red-600 hover:text-red-800"><i class="fas fa-trash"></i></button>
            </td>
        </tr>
    `).join('') : '<tr><td colspan="7" class="px-3 py-4 text-center text-gray-400">No accommodation locations found</td></tr>';
}

function filterHRAccommodationLocations() {
    renderHRAccommodationLocations();
}

function openHRAccommodationLocationModal(id = null) {
    const existing = document.getElementById('hr-accommodation-location-modal');
    if (existing) existing.remove();
    const item = id ? hrAllAccommodationLocations.find(i => i.id === id) : null;
    const modal = document.createElement('div');
    modal.id = 'hr-accommodation-location-modal';
    modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
    modal.innerHTML = `
        <div class="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
            <h3 class="text-lg font-semibold mb-4">${item ? 'Edit' : 'Add'} Accommodation Location</h3>
            <form id="hr-accommodation-location-form" onsubmit="saveHRAccommodationLocation(event, ${id || 'null'})">
                <div class="mb-3">
                    <label class="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                    <input type="text" id="hr-accommodation-location-name" required value="${item ? item.name : ''}" class="w-full px-3 py-2 text-sm border rounded-lg">
                </div>
                <div class="mb-3 relative">
                    <label class="block text-sm font-medium text-gray-700 mb-1">Country</label>
                    <input type="text" id="hr-accommodation-location-country-search" placeholder="Search country..." autocomplete="off"
                        value="${item ? (item.country_name || '') : ''}"
                        class="w-full px-3 py-2 text-sm border rounded-lg mb-1"
                        oninput="filterHRAccommodationCountryDropdown()"
                        onfocus="showHRAccommodationCountryDropdown()"
                        onblur="setTimeout(()=>hideHRAccommodationCountryDropdown(),200)">
                    <input type="hidden" id="hr-accommodation-location-country-id" value="${item ? (item.country_id || '') : ''}">
                    <div id="hr-accommodation-location-country-dropdown" class="absolute left-0 right-0 z-50 bg-white border rounded-lg shadow-lg max-h-48 overflow-y-auto hidden"></div>
                </div>
                <div class="mb-3 relative">
                    <label class="block text-sm font-medium text-gray-700 mb-1">Location</label>
                    <input type="text" id="hr-accommodation-location-location-search" placeholder="Search location..." autocomplete="off"
                        value="${item ? (item.location_name || '') : ''}"
                        class="w-full px-3 py-2 text-sm border rounded-lg mb-1"
                        oninput="filterHRAccommodationLocationDropdown()"
                        onfocus="showHRAccommodationLocationDropdown()"
                        onblur="setTimeout(()=>hideHRAccommodationLocationDropdown(),200)">
                    <input type="hidden" id="hr-accommodation-location-location-id" value="${item ? (item.location_id || '') : ''}">
                    <div id="hr-accommodation-location-location-dropdown" class="absolute left-0 right-0 z-50 bg-white border rounded-lg shadow-lg max-h-48 overflow-y-auto hidden"></div>
                </div>
                <div class="mb-3">
                    <label class="block text-sm font-medium text-gray-700 mb-1">Address</label>
                    <textarea id="hr-accommodation-location-address" rows="2" class="w-full px-3 py-2 text-sm border rounded-lg">${item ? (item.address || '') : ''}</textarea>
                </div>
                <div class="mb-4">
                    <label class="block text-sm font-medium text-gray-700 mb-1">Description</label>
                    <textarea id="hr-accommodation-location-description" rows="2" class="w-full px-3 py-2 text-sm border rounded-lg">${item ? (item.description || '') : ''}</textarea>
                </div>
                <div class="flex justify-end gap-2">
                    <button type="button" onclick="closeHRAccommodationLocationModal()" class="px-4 py-2 text-sm bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300">Cancel</button>
                    <button type="submit" class="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700">${item ? 'Update' : 'Add'}</button>
                </div>
            </form>
        </div>
    `;
    document.body.appendChild(modal);
    modal.addEventListener('click', e => { if (e.target === modal) closeHRAccommodationLocationModal(); });
}

function closeHRAccommodationLocationModal() {
    const modal = document.getElementById('hr-accommodation-location-modal');
    if (modal) modal.remove();
}

function showHRAccommodationCountryDropdown() {
    const dd = document.getElementById('hr-accommodation-location-country-dropdown');
    const search = document.getElementById('hr-accommodation-location-country-search').value.toLowerCase();
    const list = hrAllCountries.filter(c => c.name.toLowerCase().includes(search));
    dd.innerHTML = list.length ? list.map(c =>
        `<div class="px-3 py-2 text-sm hover:bg-blue-50 cursor-pointer" onclick="selectHRAccommodationCountry(${c.id}, '${c.name.replace(/'/g, "\\'")}')">${c.name}</div>`
    ).join('') : '<div class="px-3 py-2 text-sm text-gray-400">No countries found</div>';
    dd.classList.remove('hidden');
}
function filterHRAccommodationCountryDropdown() {
    document.getElementById('hr-accommodation-location-country-id').value = '';
    showHRAccommodationCountryDropdown();
}
function selectHRAccommodationCountry(id, name) {
    document.getElementById('hr-accommodation-location-country-id').value = id;
    document.getElementById('hr-accommodation-location-country-search').value = name;
    document.getElementById('hr-accommodation-location-country-dropdown').classList.add('hidden');
    document.getElementById('hr-accommodation-location-location-id').value = '';
    document.getElementById('hr-accommodation-location-location-search').value = '';
}
function hideHRAccommodationCountryDropdown() {
    document.getElementById('hr-accommodation-location-country-dropdown').classList.add('hidden');
}

function showHRAccommodationLocationDropdown() {
    const dd = document.getElementById('hr-accommodation-location-location-dropdown');
    const countryId = document.getElementById('hr-accommodation-location-country-id').value;
    const search = document.getElementById('hr-accommodation-location-location-search').value.toLowerCase();
    let list = hrAllLocationTypes;
    if (countryId) list = list.filter(lt => lt.country_id == countryId);
    list = list.filter(lt => lt.name.toLowerCase().includes(search));
    dd.innerHTML = list.length ? list.map(lt =>
        `<div class="px-3 py-2 text-sm hover:bg-blue-50 cursor-pointer" onclick="selectHRAccommodationLocation(${lt.id}, '${lt.name.replace(/'/g, "\\'")}')">${lt.name}</div>`
    ).join('') : '<div class="px-3 py-2 text-sm text-gray-400">No locations found</div>';
    dd.classList.remove('hidden');
}
function filterHRAccommodationLocationDropdown() {
    document.getElementById('hr-accommodation-location-location-id').value = '';
    showHRAccommodationLocationDropdown();
}
function selectHRAccommodationLocation(id, name) {
    document.getElementById('hr-accommodation-location-location-id').value = id;
    document.getElementById('hr-accommodation-location-location-search').value = name;
    document.getElementById('hr-accommodation-location-location-dropdown').classList.add('hidden');
}
function hideHRAccommodationLocationDropdown() {
    document.getElementById('hr-accommodation-location-location-dropdown').classList.add('hidden');
}

async function saveHRAccommodationLocation(e, id) {
    e.preventDefault();
    const data = {
        name: document.getElementById('hr-accommodation-location-name').value,
        address: document.getElementById('hr-accommodation-location-address').value,
        description: document.getElementById('hr-accommodation-location-description').value,
        country_id: document.getElementById('hr-accommodation-location-country-id').value || null,
        location_id: document.getElementById('hr-accommodation-location-location-id').value || null
    };
    try {
        const url = id ? `${API_BASE}/accommodation-locations/${id}` : `${API_BASE}/accommodation-locations`;
        const method = id ? 'PUT' : 'POST';
        const response = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
        if (!response.ok) { const err = await response.json().catch(() => ({})); alert('Error: ' + (err.error || 'Unknown')); return; }
        const result = await response.json().catch(() => ({}));
        await logAudit(id ? 'UPDATE' : 'CREATE', 'hr-accommodation', 'Accommodation Location', id || result.id || null, `Location: ${data.name}`);
        closeHRAccommodationLocationModal();
        loadHRAccommodationLocations();
    } catch (error) {
        console.error('Error saving accommodation location:', error);
        alert('Error saving accommodation location');
    }
}

function editHRAccommodationLocation(id) {
    openHRAccommodationLocationModal(id);
}

async function deleteHRAccommodationLocation(id) {
    if (confirm('Are you sure you want to delete this accommodation location?')) {
        try {
            await fetch(`${API_BASE}/accommodation-locations/${id}`, { method: 'DELETE' });
            const item = hrAllAccommodationLocations.find(i => i.id === id);
            await logAudit('DELETE', 'hr-accommodation', 'Accommodation Location', id, `Location: ${item?.name || 'Unknown'}`);
            loadHRAccommodationLocations();
        } catch (error) {
            console.error('Error deleting accommodation location:', error);
        }
    }
}

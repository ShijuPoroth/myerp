// ACCOMMODATION LOCATIONS
let allAccommodationLocations = [];
let allCountriesForAccommodation = [];
let allLocationTypesForAccommodation = [];

async function loadAccommodationLocations() {
    showTableLoading('accommodation-locations-table-body', 'Loading accommodation locations...');
    try {
        const [locRes, countryRes, ltRes] = await Promise.all([
            fetch(`${API_BASE}/accommodation-locations`),
            fetch(`${API_BASE}/countries`),
            fetch(`${API_BASE}/location-types`)
        ]);
        allAccommodationLocations = await locRes.json();
        allCountriesForAccommodation = await countryRes.json();
        allLocationTypesForAccommodation = await ltRes.json();
        renderAccommodationLocations();
    } catch (error) {
        console.error('Error loading accommodation locations:', error);
    }
}

function renderAccommodationLocations() {
    const tbody = document.getElementById('accommodation-locations-table-body');
    if (!tbody) return;
    const search = (document.getElementById('accommodation-locations-search')?.value || '').toLowerCase();
    const filtered = allAccommodationLocations.filter(item =>
        !search || (item.name || '').toLowerCase().includes(search) || (item.address || '').toLowerCase().includes(search) || (item.country_name || '').toLowerCase().includes(search) || (item.location_name || '').toLowerCase().includes(search)
    );
    tbody.innerHTML = filtered.length ? filtered.map(item => `
        <tr>
            <td class="px-3 py-2 whitespace-nowrap">${item.id}</td>
            <td class="px-3 py-2 whitespace-nowrap">${item.name}</td>
            <td class="px-3 py-2 whitespace-nowrap">${item.country_name || '-'}</td>
            <td class="px-3 py-2 whitespace-nowrap">${item.location_name || '-'}</td>
            <td class="px-3 py-2 whitespace-nowrap">${item.address || '-'}</td>
            <td class="px-3 py-2 whitespace-nowrap">${item.description || '-'}</td>
            <td class="px-3 py-2 whitespace-nowrap">
                <button onclick="editAccommodationLocation(${item.id})" class="text-blue-600 hover:text-blue-800 mr-2"><i class="fas fa-edit"></i></button>
                <button onclick="deleteAccommodationLocation(${item.id})" class="text-red-600 hover:text-red-800"><i class="fas fa-trash"></i></button>
            </td>
        </tr>
    `).join('') : '<tr><td colspan="7" class="px-3 py-4 text-center text-gray-400">No accommodation locations found</td></tr>';
}

function filterAccommodationLocations() {
    renderAccommodationLocations();
}

function openAccommodationLocationModal(id = null) {
    const existing = document.getElementById('accommodation-location-modal');
    if (existing) existing.remove();
    const item = id ? allAccommodationLocations.find(i => i.id === id) : null;
    const countryOptions = allCountriesForAccommodation.map(c =>
        `<option value="${c.id}" ${item && item.country_id == c.id ? 'selected' : ''}>${c.name}</option>`
    ).join('');
    const filteredLocations = item && item.country_id
        ? allLocationTypesForAccommodation.filter(lt => lt.country_id == item.country_id)
        : allLocationTypesForAccommodation;
    const locationOptions = filteredLocations.map(lt =>
        `<option value="${lt.id}" ${item && item.location_id == lt.id ? 'selected' : ''}>${lt.name}</option>`
    ).join('');
    const modal = document.createElement('div');
    modal.id = 'accommodation-location-modal';
    modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
    modal.innerHTML = `
        <div class="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
            <h3 class="text-lg font-semibold mb-4">${item ? 'Edit' : 'Add'} Accommodation Location</h3>
            <form id="accommodation-location-form" onsubmit="saveAccommodationLocation(event, ${id || 'null'})">
                <div class="mb-3">
                    <label class="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                    <input type="text" id="accommodation-location-name" required value="${item ? item.name : ''}" class="w-full px-3 py-2 text-sm border rounded-lg">
                </div>
                <div class="mb-3 relative">
                    <label class="block text-sm font-medium text-gray-700 mb-1">Country</label>
                    <input type="text" id="accommodation-location-country-search" placeholder="Search country..." autocomplete="off"
                        value="${item ? (item.country_name || '') : ''}"
                        class="w-full px-3 py-2 text-sm border rounded-lg mb-1"
                        oninput="filterAccommodationCountryDropdown()"
                        onfocus="showAccommodationCountryDropdown()"
                        onblur="setTimeout(()=>hideAccommodationCountryDropdown(),200)">
                    <input type="hidden" id="accommodation-location-country-id" value="${item ? (item.country_id || '') : ''}">
                    <div id="accommodation-location-country-dropdown" class="absolute left-0 right-0 z-50 bg-white border rounded-lg shadow-lg max-h-48 overflow-y-auto hidden"></div>
                </div>
                <div class="mb-3 relative">
                    <label class="block text-sm font-medium text-gray-700 mb-1">Location</label>
                    <input type="text" id="accommodation-location-location-search" placeholder="Search location..." autocomplete="off"
                        value="${item ? (item.location_name || '') : ''}"
                        class="w-full px-3 py-2 text-sm border rounded-lg mb-1"
                        oninput="filterAccommodationLocationDropdown()"
                        onfocus="showAccommodationLocationDropdown()"
                        onblur="setTimeout(()=>hideAccommodationLocationDropdown(),200)">
                    <input type="hidden" id="accommodation-location-location-id" value="${item ? (item.location_id || '') : ''}">
                    <div id="accommodation-location-location-dropdown" class="absolute left-0 right-0 z-50 bg-white border rounded-lg shadow-lg max-h-48 overflow-y-auto hidden"></div>
                </div>
                <div class="mb-3">
                    <label class="block text-sm font-medium text-gray-700 mb-1">Address</label>
                    <textarea id="accommodation-location-address" rows="2" class="w-full px-3 py-2 text-sm border rounded-lg">${item ? (item.address || '') : ''}</textarea>
                </div>
                <div class="mb-4">
                    <label class="block text-sm font-medium text-gray-700 mb-1">Description</label>
                    <textarea id="accommodation-location-description" rows="2" class="w-full px-3 py-2 text-sm border rounded-lg">${item ? (item.description || '') : ''}</textarea>
                </div>
                <div class="flex justify-end gap-2">
                    <button type="button" onclick="closeAccommodationLocationModal()" class="px-4 py-2 text-sm bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300">Cancel</button>
                    <button type="submit" class="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700">${item ? 'Update' : 'Add'}</button>
                </div>
            </form>
        </div>
    `;
    document.body.appendChild(modal);
    modal.addEventListener('click', e => { if (e.target === modal) closeAccommodationLocationModal(); });
}

function showAccommodationCountryDropdown() {
    const dd = document.getElementById('accommodation-location-country-dropdown');
    const search = document.getElementById('accommodation-location-country-search').value.toLowerCase();
    renderAccommodationCountryDropdown(allCountriesForAccommodation.filter(c => c.name.toLowerCase().includes(search)));
    dd.classList.remove('hidden');
}
function filterAccommodationCountryDropdown() {
    document.getElementById('accommodation-location-country-id').value = '';
    showAccommodationCountryDropdown();
}
function renderAccommodationCountryDropdown(list) {
    const dd = document.getElementById('accommodation-location-country-dropdown');
    dd.innerHTML = list.length ? list.map(c =>
        `<div class="px-3 py-2 text-sm hover:bg-blue-50 cursor-pointer" onclick="selectAccommodationCountry(${c.id}, '${c.name.replace(/'/g, "\\'")}')">${c.name}</div>`
    ).join('') : '<div class="px-3 py-2 text-sm text-gray-400">No countries found</div>';
}
function selectAccommodationCountry(id, name) {
    document.getElementById('accommodation-location-country-id').value = id;
    document.getElementById('accommodation-location-country-search').value = name;
    document.getElementById('accommodation-location-country-dropdown').classList.add('hidden');
    // Reset location when country changes
    document.getElementById('accommodation-location-location-id').value = '';
    document.getElementById('accommodation-location-location-search').value = '';
}
function hideAccommodationCountryDropdown() {
    document.getElementById('accommodation-location-country-dropdown').classList.add('hidden');
}

function showAccommodationLocationDropdown() {
    const dd = document.getElementById('accommodation-location-location-dropdown');
    const countryId = document.getElementById('accommodation-location-country-id').value;
    const search = document.getElementById('accommodation-location-location-search').value.toLowerCase();
    let list = allLocationTypesForAccommodation;
    if (countryId) list = list.filter(lt => lt.country_id == countryId);
    list = list.filter(lt => lt.name.toLowerCase().includes(search));
    renderAccommodationLocationDropdown(list);
    dd.classList.remove('hidden');
}
function filterAccommodationLocationDropdown() {
    document.getElementById('accommodation-location-location-id').value = '';
    showAccommodationLocationDropdown();
}
function renderAccommodationLocationDropdown(list) {
    const dd = document.getElementById('accommodation-location-location-dropdown');
    dd.innerHTML = list.length ? list.map(lt =>
        `<div class="px-3 py-2 text-sm hover:bg-blue-50 cursor-pointer" onclick="selectAccommodationLocation(${lt.id}, '${lt.name.replace(/'/g, "\\'")}')">${lt.name}</div>`
    ).join('') : '<div class="px-3 py-2 text-sm text-gray-400">No locations found</div>';
}
function selectAccommodationLocation(id, name) {
    document.getElementById('accommodation-location-location-id').value = id;
    document.getElementById('accommodation-location-location-search').value = name;
    document.getElementById('accommodation-location-location-dropdown').classList.add('hidden');
}
function hideAccommodationLocationDropdown() {
    document.getElementById('accommodation-location-location-dropdown').classList.add('hidden');
}

function closeAccommodationLocationModal() {
    const modal = document.getElementById('accommodation-location-modal');
    if (modal) modal.remove();
}

async function saveAccommodationLocation(e, id) {
    e.preventDefault();
    const data = {
        name: document.getElementById('accommodation-location-name').value,
        address: document.getElementById('accommodation-location-address').value,
        description: document.getElementById('accommodation-location-description').value,
        country_id: document.getElementById('accommodation-location-country-id').value || null,
        location_id: document.getElementById('accommodation-location-location-id').value || null
    };
    try {
        const url = id ? `${API_BASE}/accommodation-locations/${id}` : `${API_BASE}/accommodation-locations`;
        const method = id ? 'PUT' : 'POST';
        const response = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
        if (!response.ok) { const err = await response.json().catch(() => ({})); alert('Error: ' + (err.error || 'Unknown')); return; }
        closeAccommodationLocationModal();
        loadAccommodationLocations();
    } catch (error) {
        console.error('Error saving accommodation location:', error);
        alert('Error saving accommodation location');
    }
}

function editAccommodationLocation(id) {
    openAccommodationLocationModal(id);
}

async function deleteAccommodationLocation(id) {
    if (confirm('Are you sure you want to delete this accommodation location?')) {
        try {
            await fetch(`${API_BASE}/accommodation-locations/${id}`, { method: 'DELETE' });
            loadAccommodationLocations();
        } catch (error) {
            console.error('Error deleting accommodation location:', error);
        }
    }
}

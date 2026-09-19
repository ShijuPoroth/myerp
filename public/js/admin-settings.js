// Admin Settings - Configuration Options Management

// Global state for configuration options
let allContactCategories = [];
let allContactStatuses = [];
let allContactStatusAssignments = [];
let allCountries = [];
let allLocationTypes = [];
let allSubLocationTypes = [];
let allBusinessTypes = [];
let allBusinessTypeAssignments = [];
let allItemCategories = [];
let allItemSubcategories = [];
let allItemUnits = [];
let allItemTypes = [];
let allItems = [];
let allSuppliers = [];
let allSupplierAssignments = [];
let allEquipmentCategories = [];
let allEquipmentStatuses = [];
let allPositions = [];
let allDepartments = [];
let allEmployeeStatuses = [];
let allUniformTypes = [];
let allUniformSizes = [];
let allAccommodationTypes = [];
let allNationalities = [];
let allDocumentTypes = [];
let employeeIdPrefix = { prefix: 'EMP' };
let allEmployeeTransfers = [];
let allEquipmentOwners = [];

// CONTACT CATEGORIES
async function loadContactCategories() {
    showTableLoading('contact-categories-table-body', 'Loading contact categories...');
    try {
        const response = await fetch(`${API_BASE}/contact-categories`);
        allContactCategories = await response.json();
        renderContactCategories();
    } catch (error) {
        console.error('Error loading contact categories:', error);
    }
}

function renderContactCategories() {
    const tbody = document.getElementById('contact-categories-table-body');
    tbody.innerHTML = allContactCategories.map(category => `
        <tr>
            <td class="px-3 py-2 whitespace-nowrap">${category.id}</td>
            <td class="px-3 py-2 whitespace-nowrap">${category.name}</td>
            <td class="px-3 py-2 whitespace-nowrap">${category.description || '-'}</td>
            <td class="px-3 py-2 whitespace-nowrap">
                <button onclick="editContactCategory(${category.id})" class="text-blue-600 hover:text-blue-800 mr-2">
                    <i class="fas fa-edit"></i>
                </button>
                <button onclick="deleteContactCategory(${category.id})" class="text-red-600 hover:text-red-800">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        </tr>
    `).join('');
}

function filterContactCategories() {
    const searchTerm = (document.getElementById('contact-categories-search')?.value || '').toLowerCase();
    const filtered = allContactCategories.filter(cat =>
        !searchTerm ||
        (cat.name && cat.name.toLowerCase().includes(searchTerm)) ||
        (cat.description && cat.description.toLowerCase().includes(searchTerm))
    );
    const tbody = document.getElementById('contact-categories-table-body');
    tbody.innerHTML = filtered.map(category => `
        <tr>
            <td class="px-3 py-2 whitespace-nowrap">${category.id}</td>
            <td class="px-3 py-2 whitespace-nowrap">${category.name}</td>
            <td class="px-3 py-2 whitespace-nowrap">${category.description || '-'}</td>
            <td class="px-3 py-2 whitespace-nowrap">
                <button onclick="editContactCategory(${category.id})" class="text-blue-600 hover:text-blue-800 mr-2">
                    <i class="fas fa-edit"></i>
                </button>
                <button onclick="deleteContactCategory(${category.id})" class="text-red-600 hover:text-red-800">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        </tr>
    `).join('');
}

function openContactCategoryModal(id = null) {
    const modal = document.getElementById('contact-category-modal');
    const form = document.getElementById('contact-category-form');
    const title = document.getElementById('contact-category-modal-title');
    
    form.reset();
    document.getElementById('contact-category-id').value = '';
    
    if (id) {
        const category = allContactCategories.find(c => c.id === id);
        if (category) {
            title.textContent = 'Edit Contact Category';
            document.getElementById('contact-category-id').value = category.id;
            document.getElementById('contact-category-name').value = category.name;
            document.getElementById('contact-category-description').value = category.description || '';
        }
    } else {
        title.textContent = 'Add Contact Category';
    }
    
    modal.classList.add('active');
}

function closeContactCategoryModal() {
    document.getElementById('contact-category-modal').classList.remove('active');
}

async function saveContactCategory(e) {
    e.preventDefault();
    const id = document.getElementById('contact-category-id').value;
    const name = document.getElementById('contact-category-name').value;
    const data = {
        name: name,
        description: document.getElementById('contact-category-description').value
    };
    
    try {
        if (id) {
            await fetch(`${API_BASE}/contact-categories/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            await logAudit('UPDATE', 'admin', 'Contact Category', id, `Contact Category: ${name}`);
        } else {
            const response = await fetch(`${API_BASE}/contact-categories`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            const result = await response.json();
            await logAudit('CREATE', 'admin', 'Contact Category', result.id, `Contact Category: ${name}`);
        }
        closeContactCategoryModal();
        loadContactCategories();
    } catch (error) {
        console.error('Error saving contact category:', error);
    }
}

async function editContactCategory(id) {
    openContactCategoryModal(id);
}

async function deleteContactCategory(id) {
    const category = allContactCategories.find(c => c.id === id);
    if (confirm('Are you sure you want to delete this contact category?')) {
        try {
            await fetch(`${API_BASE}/contact-categories/${id}`, { method: 'DELETE' });
            await logAudit('DELETE', 'admin', 'Contact Category', id, `Contact Category: ${category?.name || 'Unknown'}`);
            loadContactCategories();
        } catch (error) {
            console.error('Error deleting contact category:', error);
        }
    }
}

// CONTACT STATUSES
async function loadContactStatuses() {
    showTableLoading('contact-statuses-table-body', 'Loading contact statuses...');
    try {
        const response = await fetch(`${API_BASE}/contact-statuses`);
        allContactStatuses = await response.json();
        renderContactStatuses();
    } catch (error) {
        console.error('Error loading contact statuses:', error);
    }
}

function renderContactStatuses() {
    const tbody = document.getElementById('contact-statuses-table-body');
    tbody.innerHTML = allContactStatuses.map(status => `
        <tr>
            <td class="px-3 py-2 whitespace-nowrap">${status.id}</td>
            <td class="px-3 py-2 whitespace-nowrap">${status.name}</td>
            <td class="px-3 py-2 whitespace-nowrap">${status.description || '-'}</td>
            <td class="px-3 py-2 whitespace-nowrap">
                <button onclick="editContactStatus(${status.id})" class="text-blue-600 hover:text-blue-800 mr-2">
                    <i class="fas fa-edit"></i>
                </button>
                <button onclick="deleteContactStatus(${status.id})" class="text-red-600 hover:text-red-800">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        </tr>
    `).join('');
}

function filterContactStatuses() {
    const searchTerm = (document.getElementById('contact-statuses-search')?.value || '').toLowerCase();
    const filtered = allContactStatuses.filter(s =>
        !searchTerm ||
        (s.name && s.name.toLowerCase().includes(searchTerm)) ||
        (s.description && s.description.toLowerCase().includes(searchTerm))
    );
    const tbody = document.getElementById('contact-statuses-table-body');
    tbody.innerHTML = filtered.map(status => `
        <tr>
            <td class="px-3 py-2 whitespace-nowrap">${status.id}</td>
            <td class="px-3 py-2 whitespace-nowrap">${status.name}</td>
            <td class="px-3 py-2 whitespace-nowrap">${status.description || '-'}</td>
            <td class="px-3 py-2 whitespace-nowrap">
                <button onclick="editContactStatus(${status.id})" class="text-blue-600 hover:text-blue-800 mr-2">
                    <i class="fas fa-edit"></i>
                </button>
                <button onclick="deleteContactStatus(${status.id})" class="text-red-600 hover:text-red-800">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        </tr>
    `).join('');
}

function openContactStatusModal(id = null) {
    const modal = document.getElementById('contact-status-modal');
    const form = document.getElementById('contact-status-form');
    const title = document.getElementById('contact-status-modal-title');
    
    form.reset();
    document.getElementById('contact-status-id').value = '';
    
    if (id) {
        const status = allContactStatuses.find(s => s.id === id);
        if (status) {
            title.textContent = 'Edit Contact Status';
            document.getElementById('contact-status-id').value = status.id;
            document.getElementById('contact-status-name').value = status.name;
            document.getElementById('contact-status-description').value = status.description || '';
        }
    } else {
        title.textContent = 'Add Contact Status';
    }
    
    modal.classList.add('active');
}

function closeContactStatusModal() {
    document.getElementById('contact-status-modal').classList.remove('active');
}

async function saveContactStatus(e) {
    e.preventDefault();
    const id = document.getElementById('contact-status-id').value;
    const name = document.getElementById('contact-status-name').value;
    const data = {
        name: name,
        description: document.getElementById('contact-status-description').value
    };
    
    try {
        if (id) {
            await fetch(`${API_BASE}/contact-statuses/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            await logAudit('UPDATE', 'admin', 'Contact Status', id, `Contact Status: ${name}`);
        } else {
            const response = await fetch(`${API_BASE}/contact-statuses`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            const result = await response.json();
            await logAudit('CREATE', 'admin', 'Contact Status', result.id, `Contact Status: ${name}`);
        }
        closeContactStatusModal();
        loadContactStatuses();
    } catch (error) {
        console.error('Error saving contact status:', error);
    }
}

async function editContactStatus(id) {
    openContactStatusModal(id);
}

async function deleteContactStatus(id) {
    const status = allContactStatuses.find(s => s.id === id);
    if (confirm('Are you sure you want to delete this contact status?')) {
        try {
            await fetch(`${API_BASE}/contact-statuses/${id}`, { method: 'DELETE' });
            await logAudit('DELETE', 'admin', 'Contact Status', id, `Contact Status: ${status?.name || 'Unknown'}`);
            loadContactStatuses();
        } catch (error) {
            console.error('Error deleting contact status:', error);
        }
    }
}

// CONTACT STATUS ASSIGNMENTS
async function loadContactStatusAssignments() {
    showTableLoading('contact-status-assignments-table-body', 'Loading status assignments...');
    try {
        const response = await fetch(`${API_BASE}/contact-status-assignments`);
        allContactStatusAssignments = await response.json();
        renderContactStatusAssignments();
    } catch (error) {
        console.error('Error loading contact status assignments:', error);
    }
}

function renderContactStatusAssignments() {
    const tbody = document.getElementById('contact-status-assignments-table-body');
    tbody.innerHTML = allContactStatusAssignments.map(assignment => `
        <tr>
            <td class="px-3 py-2 whitespace-nowrap">${assignment.id}</td>
            <td class="px-3 py-2 whitespace-nowrap">${assignment.category_name || '-'}</td>
            <td class="px-3 py-2 whitespace-nowrap">${assignment.status_name || '-'}</td>
            <td class="px-3 py-2 whitespace-nowrap">
                <button onclick="deleteContactStatusAssignment(${assignment.id})" class="text-red-600 hover:text-red-800">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        </tr>
    `).join('');
}

function filterContactStatusAssignments() {
    const searchTerm = (document.getElementById('contact-status-assignments-search')?.value || '').toLowerCase();
    const filtered = allContactStatusAssignments.filter(a =>
        !searchTerm ||
        (a.category_name && a.category_name.toLowerCase().includes(searchTerm)) ||
        (a.status_name && a.status_name.toLowerCase().includes(searchTerm))
    );
    const tbody = document.getElementById('contact-status-assignments-table-body');
    tbody.innerHTML = filtered.map(assignment => `
        <tr>
            <td class="px-3 py-2 whitespace-nowrap">${assignment.id}</td>
            <td class="px-3 py-2 whitespace-nowrap">${assignment.category_name || '-'}</td>
            <td class="px-3 py-2 whitespace-nowrap">${assignment.status_name || '-'}</td>
            <td class="px-3 py-2 whitespace-nowrap">
                <button onclick="deleteContactStatusAssignment(${assignment.id})" class="text-red-600 hover:text-red-800">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        </tr>
    `).join('');
}

function openContactStatusAssignmentModal() {
    const modal = document.getElementById('contact-status-assignment-modal');
    const form = document.getElementById('contact-status-assignment-form');
    const title = document.getElementById('contact-status-assignment-modal-title');
    
    form.reset();
    document.getElementById('contact-status-assignment-id').value = '';
    
    // Populate category dropdown
    const categorySelect = document.getElementById('contact-status-assignment-category');
    categorySelect.innerHTML = '<option value="">Select Category</option>' + 
        allContactCategories.map(cat => `<option value="${cat.id}">${cat.name}</option>`).join('');
    
    // Populate status dropdown
    const statusSelect = document.getElementById('contact-status-assignment-status');
    statusSelect.innerHTML = '<option value="">Select Status</option>' + 
        allContactStatuses.map(status => `<option value="${status.id}">${status.name}</option>`).join('');
    
    title.textContent = 'Assign Status to Category';
    modal.classList.add('active');
}

function closeContactStatusAssignmentModal() {
    document.getElementById('contact-status-assignment-modal').classList.remove('active');
}

async function saveContactStatusAssignment(e) {
    e.preventDefault();
    const category_id = document.getElementById('contact-status-assignment-category').value;
    const status_id = document.getElementById('contact-status-assignment-status').value;
    const data = {
        category_id: category_id,
        status_id: status_id
    };
    
    try {
        const response = await fetch(`${API_BASE}/contact-status-assignments`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        const result = await response.json();
        const category = allContactCategories.find(c => c.id == category_id);
        const status = allContactStatuses.find(s => s.id == status_id);
        await logAudit('CREATE', 'admin', 'Contact Status Assignment', result.id, `Category: ${category?.name}, Status: ${status?.name}`);
        closeContactStatusAssignmentModal();
        loadContactStatusAssignments();
    } catch (error) {
        console.error('Error saving contact status assignment:', error);
    }
}

async function deleteContactStatusAssignment(id) {
    const assignment = allContactStatusAssignments.find(a => a.id === id);
    if (confirm('Are you sure you want to delete this status assignment?')) {
        try {
            await fetch(`${API_BASE}/contact-status-assignments/${id}`, { method: 'DELETE' });
            await logAudit('DELETE', 'admin', 'Contact Status Assignment', id, `Category: ${assignment?.category_name}, Status: ${assignment?.status_name}`);
            loadContactStatusAssignments();
        } catch (error) {
            console.error('Error deleting contact status assignment:', error);
        }
    }
}

// COUNTRIES
async function loadCountries() {
    showTableLoading('countries-table-body', 'Loading countries...');
    try {
        const response = await fetch(`${API_BASE}/countries`);
        allCountries = await response.json();
        renderCountries();
    } catch (error) {
        console.error('Error loading countries:', error);
    }
}

function renderCountries() {
    const tbody = document.getElementById('countries-table-body');
    if (!tbody) return;
    filterCountries();
}

function getFilteredCountries() {
    const search = (document.getElementById('country-filter-search')?.value || '').toLowerCase();
    return allCountries.filter(c => !search || c.name.toLowerCase().includes(search));
}

function filterCountries() {
    const tbody = document.getElementById('countries-table-body');
    if (!tbody) return;
    const filtered = getFilteredCountries();
    tbody.innerHTML = filtered.map(country => `
        <tr>
            <td class="px-3 py-2 whitespace-nowrap">${country.name}</td>
            <td class="px-3 py-2 whitespace-nowrap">
                <button onclick="deleteCountry(${country.id})" class="text-red-600 hover:text-red-800">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        </tr>
    `).join('');
}

function exportCountriesCSV() {
    const filtered = getFilteredCountries();
    if (!filtered.length) { alert('No data to export.'); return; }
    const escCSV = (val) => { const s = String(val || '-'); return s.includes(',') || s.includes('"') || s.includes('\n') ? '"' + s.replace(/"/g, '""') + '"' : s; };
    const csv = ['Name', ...filtered.map(c => escCSV(c.name))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'countries.csv';
    link.click();
    URL.revokeObjectURL(link.href);
}

function openCountryModal() {
    const modal = document.getElementById('country-modal');
    const form = document.getElementById('country-form');
    form.reset();
    modal.classList.add('active');
}

function closeCountryModal() {
    document.getElementById('country-modal').classList.remove('active');
}

async function saveCountry(e) {
    e.preventDefault();
    const name = document.getElementById('country-name').value;
    const data = {
        name: name
    };
    
    try {
        const response = await fetch(`${API_BASE}/countries`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        const result = await response.json();
        await logAudit('CREATE', 'admin', 'Country', result.id, `Country: ${name}`);
        closeCountryModal();
        loadCountries();
    } catch (error) {
        console.error('Error saving country:', error);
    }
}

async function deleteCountry(id) {
    const country = allCountries.find(c => c.id === id);
    if (confirm('Are you sure you want to delete this country?')) {
        try {
            const response = await fetch(`${API_BASE}/countries/${id}`, { method: 'DELETE' });
            if (!response.ok) {
                const error = await response.json();
                alert(error.error || 'Error deleting country');
                return;
            }
            await logAudit('DELETE', 'admin', 'Country', id, `Country: ${country?.name || 'Unknown'}`);
            loadCountries();
        } catch (error) {
            console.error('Error deleting country:', error);
            alert('Error deleting country');
        }
    }
}

// LOCATION TYPES
async function loadLocationTypes() {
    showTableLoading('location-types-table-body', 'Loading location types...');
    try {
        const response = await fetch(`${API_BASE}/location-types`);
        allLocationTypes = await response.json();
renderLocationTypes();
    } catch (error) {
        console.error('Error loading location types:', error);
    }
}

function renderLocationTypes() {
    const tbody = document.getElementById('location-types-table-body');
    if (!tbody) return;
    
    if (!Array.isArray(allLocationTypes)) {
        console.error('allLocationTypes is not an array:', allLocationTypes);
        tbody.innerHTML = '<tr><td colspan="3" class="px-3 py-2 text-center text-gray-500">No data available</td></tr>';
        return;
    }

    populateLTFilterDropdowns();
    filterLocationTypes();
}

function populateLTFilterDropdowns() {
    if (!Array.isArray(allLocationTypes)) return;
    const countries = [...new Set(allLocationTypes.map(a => a.country_name).filter(Boolean))].sort();
    const sel = document.getElementById('lt-filter-country');
    if (sel) {
        const current = sel.value;
        sel.innerHTML = '<option value="">All Countries</option>' + countries.map(v => `<option value="${v}" ${v === current ? 'selected' : ''}>${v}</option>`).join('');
    }
}

function getFilteredLocationTypes() {
    const country = document.getElementById('lt-filter-country')?.value || '';
    const search = (document.getElementById('lt-filter-search')?.value || '').toLowerCase();
    return allLocationTypes.filter(a => {
        if (country && a.country_name !== country) return false;
        if (search && !a.name.toLowerCase().includes(search) && !(a.country_name || '').toLowerCase().includes(search)) return false;
        return true;
    });
}

function filterLocationTypes() {
    const tbody = document.getElementById('location-types-table-body');
    if (!tbody) return;
    const filtered = getFilteredLocationTypes();
    tbody.innerHTML = filtered.map(type => `
        <tr>
            <td class="px-3 py-2 whitespace-nowrap">${type.country_name || '-'}</td>
            <td class="px-3 py-2 whitespace-nowrap">${type.name}</td>
            <td class="px-3 py-2 whitespace-nowrap">
                <button onclick="editLocationType(${type.id})" class="text-blue-600 hover:text-blue-800 mr-2">
                    <i class="fas fa-edit"></i>
                </button>
                <button onclick="deleteLocationType(${type.id})" class="text-red-600 hover:text-red-800">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        </tr>
    `).join('');
}

function exportLocationTypesCSV() {
    const filtered = getFilteredLocationTypes();
    if (!filtered.length) { alert('No data to export.'); return; }
    const escCSV = (val) => { const s = String(val || '-'); return s.includes(',') || s.includes('"') || s.includes('\n') ? '"' + s.replace(/"/g, '""') + '"' : s; };
    const rows = filtered.map(a => [a.country_name, a.name].map(escCSV).join(','));
    const csv = ['Country,Location Name', ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'locations.csv';
    link.click();
    URL.revokeObjectURL(link.href);
}

function openLocationTypeModal(id = null) {
    const modal = document.getElementById('location-type-modal');
    const form = document.getElementById('location-type-form');
    const title = document.getElementById('location-type-modal-title');
    
    form.reset();
    document.getElementById('location-type-id').value = '';
    
    // Populate country dropdown
    const countrySelect = document.getElementById('location-type-country');
    countrySelect.innerHTML = '<option value="">Select Country</option>';
    allCountries.forEach(country => {
        countrySelect.innerHTML += `<option value="${country.id}">${country.name}</option>`;
    });
    
    // Add country change event listener to filter locations (not needed for Add Location modal since it doesn't have location dropdown)
    
    if (id) {
        const type = allLocationTypes.find(t => t.id === id);
        if (type) {
            title.textContent = 'Edit Location';
            document.getElementById('location-type-id').value = type.id;
            document.getElementById('location-type-country').value = type.country_id || '';
            document.getElementById('location-type-name').value = type.name;
        }
    } else {
        title.textContent = 'Add Location';
    }
    
    modal.classList.add('active');
}

function closeLocationTypeModal() {
    document.getElementById('location-type-modal').classList.remove('active');
}

async function saveLocationType(e) {
    e.preventDefault();
    const id = document.getElementById('location-type-id').value;
    const data = {
        country_id: document.getElementById('location-type-country').value,
        name: document.getElementById('location-type-name').value
    };
try {
        if (id) {
            await fetch(`${API_BASE}/location-types/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
        } else {
            await fetch(`${API_BASE}/location-types`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
        }
        closeLocationTypeModal();
        loadLocationTypes();
    } catch (error) {
        console.error('Error saving location type:', error);
    }
}

async function editLocationType(id) {
    openLocationTypeModal(id);
}

async function deleteLocationType(id) {
    const location = allLocationTypes.find(l => l.id === id);
    if (confirm('Are you sure you want to delete this location?')) {
        try {
            const response = await fetch(`${API_BASE}/location-types/${id}`, { method: 'DELETE' });
            if (!response.ok) {
                const error = await response.json();
                alert(error.error || 'Error deleting location');
                return;
            }
            await logAudit('DELETE', 'admin', 'Location', id, `Location: ${location?.name || 'Unknown'}`);
            loadLocationTypes();
        } catch (error) {
            console.error('Error deleting location type:', error);
            alert('Error deleting location');
        }
    }
}

// SUB LOCATION TYPES
async function loadSubLocationTypes() {
    showTableLoading('sub-location-types-table-body', 'Loading sub-location types...');
    try {
        const response = await fetch(`${API_BASE}/sub-location-types`);
        allSubLocationTypes = await response.json();
renderSubLocationTypes();
    } catch (error) {
        console.error('Error loading sub location types:', error);
    }
}

function renderSubLocationTypes() {
    const tbody = document.getElementById('sub-location-types-table-body');
    if (!tbody) return;
    
    if (!Array.isArray(allSubLocationTypes)) {
        console.error('allSubLocationTypes is not an array:', allSubLocationTypes);
        tbody.innerHTML = '<tr><td colspan="4" class="px-3 py-2 text-center text-gray-500">No data available</td></tr>';
        return;
    }

    populateSLTFilterDropdowns();
    filterSubLocationTypes();
}

function populateSLTFilterDropdowns() {
    if (!Array.isArray(allSubLocationTypes)) return;
    const countries = [...new Set(allSubLocationTypes.map(a => a.country_name).filter(Boolean))].sort();
    const locations = [...new Set(allSubLocationTypes.map(a => a.location_name).filter(Boolean))].sort();
    const setOpts = (id, values, label) => {
        const sel = document.getElementById(id);
        if (!sel) return;
        const current = sel.value;
        sel.innerHTML = `<option value="">All ${label}</option>` + values.map(v => `<option value="${v}" ${v === current ? 'selected' : ''}>${v}</option>`).join('');
    };
    setOpts('slt-filter-country', countries, 'Countries');
    setOpts('slt-filter-location', locations, 'Locations');
}

function getFilteredSubLocationTypes() {
    const country = document.getElementById('slt-filter-country')?.value || '';
    const location = document.getElementById('slt-filter-location')?.value || '';
    const search = (document.getElementById('slt-filter-search')?.value || '').toLowerCase();
    return allSubLocationTypes.filter(a => {
        if (country && a.country_name !== country) return false;
        if (location && a.location_name !== location) return false;
        if (search && !a.name.toLowerCase().includes(search) && !(a.country_name || '').toLowerCase().includes(search) && !(a.location_name || '').toLowerCase().includes(search)) return false;
        return true;
    });
}

function filterSubLocationTypes() {
    const tbody = document.getElementById('sub-location-types-table-body');
    if (!tbody) return;
    const filtered = getFilteredSubLocationTypes();
    tbody.innerHTML = filtered.map(type => `
        <tr>
            <td class="px-3 py-2 whitespace-nowrap">${type.country_name || '-'}</td>
            <td class="px-3 py-2 whitespace-nowrap">${type.location_name || '-'}</td>
            <td class="px-3 py-2 whitespace-nowrap">${type.name}</td>
            <td class="px-3 py-2 whitespace-nowrap">
                <button onclick="editSubLocationType(${type.id})" class="text-blue-600 hover:text-blue-800 mr-2">
                    <i class="fas fa-edit"></i>
                </button>
                <button onclick="deleteSubLocationType(${type.id})" class="text-red-600 hover:text-red-800">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        </tr>
    `).join('');
}

function exportSubLocationTypesCSV() {
    const filtered = getFilteredSubLocationTypes();
    if (!filtered.length) { alert('No data to export.'); return; }
    const escCSV = (val) => { const s = String(val || '-'); return s.includes(',') || s.includes('"') || s.includes('\n') ? '"' + s.replace(/"/g, '""') + '"' : s; };
    const rows = filtered.map(a => [a.country_name, a.location_name, a.name].map(escCSV).join(','));
    const csv = ['Country,Location,Sublocation Name', ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'sublocations.csv';
    link.click();
    URL.revokeObjectURL(link.href);
}

function openSubLocationTypeModal(id = null) {
    const modal = document.getElementById('sub-location-type-modal');
    const form = document.getElementById('sub-location-type-form');
    const title = document.getElementById('sub-location-type-modal-title');
    
    form.reset();
    document.getElementById('sub-location-type-id').value = '';
    
    // Populate country dropdown
    const countrySelect = document.getElementById('sub-location-type-country');
    countrySelect.innerHTML = '<option value="">Select Country</option>';
    allCountries.forEach(country => {
        countrySelect.innerHTML += `<option value="${country.id}">${country.name}</option>`;
    });
    
    // Add country change event listener to filter locations
    countrySelect.onchange = function() {
        const selectedCountryId = this.value;
        const locationSelect = document.getElementById('sub-location-type-location');
        locationSelect.innerHTML = '<option value="">Select Location</option>';
        
        if (selectedCountryId) {
            const filteredLocations = allLocationTypes.filter(loc => loc.country_id == selectedCountryId);
            filteredLocations.forEach(location => {
                locationSelect.innerHTML += `<option value="${location.id}">${location.name}</option>`;
            });
        }
    };
    
    // Populate location dropdown (initially empty until country is selected)
    const locationSelect = document.getElementById('sub-location-type-location');
    locationSelect.innerHTML = '<option value="">Select Location</option>';
    
    if (id) {
        const type = allSubLocationTypes.find(t => t.id === id);
        if (type) {
            title.textContent = 'Edit Sublocation';
            document.getElementById('sub-location-type-id').value = type.id;
            document.getElementById('sub-location-type-country').value = type.country_id || '';
            // Trigger the onchange event to populate locations
            countrySelect.dispatchEvent(new Event('change'));
            document.getElementById('sub-location-type-location').value = type.location_id || '';
            document.getElementById('sub-location-type-name').value = type.name;
        }
    } else {
        title.textContent = 'Add Sublocation';
    }
    
    modal.classList.add('active');
}

function closeSubLocationTypeModal() {
    document.getElementById('sub-location-type-modal').classList.remove('active');
}

async function saveSubLocationType(e) {
    e.preventDefault();
    const id = document.getElementById('sub-location-type-id').value;
    const data = {
        country_id: document.getElementById('sub-location-type-country').value,
        location_id: document.getElementById('sub-location-type-location').value,
        name: document.getElementById('sub-location-type-name').value
    };
    
    try {
        if (id) {
            await fetch(`${API_BASE}/sub-location-types/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
        } else {
            await fetch(`${API_BASE}/sub-location-types`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
        }
        closeSubLocationTypeModal();
        loadSubLocationTypes();
    } catch (error) {
        console.error('Error saving sub location type:', error);
    }
}

async function editSubLocationType(id) {
    openSubLocationTypeModal(id);
}

async function deleteSubLocationType(id) {
    const sublocation = allSubLocationTypes.find(s => s.id === id);
    if (confirm('Are you sure you want to delete this sublocation?')) {
        try {
            const response = await fetch(`${API_BASE}/sub-location-types/${id}`, { method: 'DELETE' });
            if (!response.ok) {
                const error = await response.json();
                alert(error.error || 'Error deleting sublocation');
                return;
            }
            await logAudit('DELETE', 'admin', 'Sublocation', id, `Sublocation: ${sublocation?.name || 'Unknown'}`);
            loadSubLocationTypes();
        } catch (error) {
            console.error('Error deleting sub location type:', error);
            alert('Error deleting sublocation');
        }
    }
}

// BUSINESS TYPES
async function loadBusinessTypes() {
    showTableLoading('business-types-table-body', 'Loading business types...');
    try {
        const response = await fetch(`${API_BASE}/business-types`);
        allBusinessTypes = await response.json();
        renderBusinessTypes();
    } catch (error) {
        console.error('Error loading business types:', error);
    }
}

function renderBusinessTypes() {
    const tbody = document.getElementById('business-types-table-body');
    if (!tbody) return;
    filterBusinessTypes();
}

function getFilteredBusinessTypes() {
    const search = (document.getElementById('bt-filter-search')?.value || '').toLowerCase();
    return allBusinessTypes.filter(t => !search || t.name.toLowerCase().includes(search) || (t.description || '').toLowerCase().includes(search));
}

function filterBusinessTypes() {
    const tbody = document.getElementById('business-types-table-body');
    if (!tbody) return;
    const filtered = getFilteredBusinessTypes();
    tbody.innerHTML = filtered.map(type => `
        <tr>
            <td class="px-3 py-2 whitespace-nowrap">${type.name}</td>
            <td class="px-3 py-2 whitespace-nowrap">${type.description || '-'}</td>
            <td class="px-3 py-2 whitespace-nowrap">
                <button onclick="editBusinessType(${type.id})" class="text-blue-600 hover:text-blue-800 mr-2">
                    <i class="fas fa-edit"></i>
                </button>
                <button onclick="deleteBusinessType(${type.id})" class="text-red-600 hover:text-red-800">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        </tr>
    `).join('');
}

function exportBusinessTypesCSV() {
    const filtered = getFilteredBusinessTypes();
    if (!filtered.length) { alert('No data to export.'); return; }
    const escCSV = (val) => { const s = String(val || '-'); return s.includes(',') || s.includes('"') || s.includes('\n') ? '"' + s.replace(/"/g, '""') + '"' : s; };
    const rows = filtered.map(t => [t.name, t.description].map(escCSV).join(','));
    const csv = ['Name,Description', ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'business_types.csv';
    link.click();
    URL.revokeObjectURL(link.href);
}

function openBusinessTypeModal(id = null) {
    const modal = document.getElementById('business-type-modal');
    const form = document.getElementById('business-type-form');
    const title = document.getElementById('business-type-modal-title');
    
    form.reset();
    document.getElementById('business-type-id').value = '';
    
    if (id) {
        const type = allBusinessTypes.find(t => t.id === id);
        if (type) {
            title.textContent = 'Edit Business Type';
            document.getElementById('business-type-id').value = type.id;
            document.getElementById('business-type-name').value = type.name;
            document.getElementById('business-type-description').value = type.description || '';
        }
    } else {
        title.textContent = 'Add Business Type';
    }
    
    modal.classList.add('active');
}

function closeBusinessTypeModal() {
    document.getElementById('business-type-modal').classList.remove('active');
}

async function saveBusinessType(e) {
    e.preventDefault();
    const id = document.getElementById('business-type-id').value;
    const name = document.getElementById('business-type-name').value;
    const data = {
        name: name,
        description: document.getElementById('business-type-description').value
    };
    
    try {
        if (id) {
            await fetch(`${API_BASE}/business-types/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            await logAudit('UPDATE', 'admin', 'Business Type', id, `Business Type: ${name}`);
        } else {
            const response = await fetch(`${API_BASE}/business-types`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            const result = await response.json();
            await logAudit('CREATE', 'admin', 'Business Type', result.id, `Business Type: ${name}`);
        }
        closeBusinessTypeModal();
        loadBusinessTypes();
    } catch (error) {
        console.error('Error saving business type:', error);
    }
}

async function editBusinessType(id) {
    openBusinessTypeModal(id);
}

async function deleteBusinessType(id) {
    const type = allBusinessTypes.find(t => t.id === id);
    if (confirm('Are you sure you want to delete this business type?')) {
        try {
            const response = await fetch(`${API_BASE}/business-types/${id}`, { method: 'DELETE' });
            if (!response.ok) {
                const error = await response.json();
                alert(error.error || 'Error deleting business type');
                return;
            }
            await logAudit('DELETE', 'admin', 'Business Type', id, `Business Type: ${type?.name || 'Unknown'}`);
            loadBusinessTypes();
        } catch (error) {
            console.error('Error deleting business type:', error);
            alert('Error deleting business type');
        }
    }
}

// BUSINESS TYPE ASSIGNMENTS
async function loadBusinessTypeAssignments() {
    showTableLoading('business-type-assignments-table-body', 'Loading business type assignments...');
    try {
        const response = await fetch(`${API_BASE}/business-type-assignments`);
        allBusinessTypeAssignments = await response.json();
renderBusinessTypeAssignments();
    } catch (error) {
        console.error('Error loading business type assignments:', error);
    }
}

function renderBusinessTypeAssignments() {
    const tbody = document.getElementById('business-type-assignments-table-body');
    if (!tbody) return;
    
    if (!Array.isArray(allBusinessTypeAssignments)) {
        console.error('allBusinessTypeAssignments is not an array:', allBusinessTypeAssignments);
        tbody.innerHTML = '<tr><td colspan="6" class="px-3 py-2 text-center text-gray-500">No data available</td></tr>';
        return;
    }

    populateBTAFilterDropdowns();
    filterBusinessTypeAssignments();
}

function populateBTAFilterDropdowns() {
    if (!Array.isArray(allBusinessTypeAssignments)) return;
    const countries = [...new Set(allBusinessTypeAssignments.map(a => a.country_name).filter(Boolean))].sort();
    const locations = [...new Set(allBusinessTypeAssignments.map(a => a.location_name).filter(Boolean))].sort();
    const sublocations = [...new Set(allBusinessTypeAssignments.map(a => a.sub_location_name).filter(Boolean))].sort();
    const businessTypes = [...new Set(allBusinessTypeAssignments.map(a => a.business_type_name).filter(Boolean))].sort();

    const setOptions = (id, values, label) => {
        const sel = document.getElementById(id);
        if (!sel) return;
        const current = sel.value;
        sel.innerHTML = `<option value="">All ${label}</option>` + values.map(v => `<option value="${v}" ${v === current ? 'selected' : ''}>${v}</option>`).join('');
    };
    setOptions('bta-filter-country', countries, 'Countries');
    setOptions('bta-filter-location', locations, 'Locations');
    setOptions('bta-filter-sublocation', sublocations, 'Sublocations');
    setOptions('bta-filter-business-type', businessTypes, 'Business Types');
}

function getFilteredBusinessTypeAssignments() {
    const country = document.getElementById('bta-filter-country')?.value || '';
    const location = document.getElementById('bta-filter-location')?.value || '';
    const sublocation = document.getElementById('bta-filter-sublocation')?.value || '';
    const businessType = document.getElementById('bta-filter-business-type')?.value || '';

    return allBusinessTypeAssignments.filter(a => {
        if (country && a.country_name !== country) return false;
        if (location && a.location_name !== location) return false;
        if (sublocation && a.sub_location_name !== sublocation) return false;
        if (businessType && a.business_type_name !== businessType) return false;
        return true;
    });
}

function filterBusinessTypeAssignments() {
    const tbody = document.getElementById('business-type-assignments-table-body');
    if (!tbody) return;

    const filtered = getFilteredBusinessTypeAssignments();
    tbody.innerHTML = filtered.map(assignment => `
        <tr>
            <td class="px-3 py-2 whitespace-nowrap">${assignment.country_name || '-'}</td>
            <td class="px-3 py-2 whitespace-nowrap">${assignment.location_name || '-'}</td>
            <td class="px-3 py-2 whitespace-nowrap">${assignment.sub_location_name || '-'}</td>
            <td class="px-3 py-2 whitespace-nowrap">${assignment.business_type_name || '-'}</td>
            <td class="px-3 py-2 whitespace-nowrap">${assignment.business_unit_code || '-'}</td>
            <td class="px-3 py-2 whitespace-nowrap">
                <button onclick="editBusinessTypeAssignment(${assignment.id})" class="text-blue-600 hover:text-blue-800 mr-2">
                    <i class="fas fa-edit"></i>
                </button>
                <button onclick="deleteBusinessTypeAssignment(${assignment.id})" class="text-red-600 hover:text-red-800">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        </tr>
    `).join('');
}

function exportBusinessTypeAssignmentsCSV() {
    const filtered = getFilteredBusinessTypeAssignments();
    if (!filtered.length) { alert('No data to export.'); return; }

    const headers = ['Country', 'Location', 'Sublocation', 'Business Type', 'Business Unit Code'];
    const escCSV = (val) => { const s = String(val || '-'); return s.includes(',') || s.includes('"') || s.includes('\n') ? '"' + s.replace(/"/g, '""') + '"' : s; };
    const rows = filtered.map(a => [a.country_name, a.location_name, a.sub_location_name, a.business_type_name, a.business_unit_code].map(escCSV).join(','));
    const csv = [headers.join(','), ...rows].join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'business_type_assignments.csv';
    link.click();
    URL.revokeObjectURL(link.href);
}

function openBusinessTypeAssignmentModal(id = null) {
    const modal = document.getElementById('business-type-assignment-modal');
    const form = document.getElementById('business-type-assignment-form');
    const title = document.getElementById('business-type-assignment-modal-title');
    
    form.reset();
    document.getElementById('business-type-assignment-id').value = '';
    
    // Populate country dropdown
    const countrySelect = document.getElementById('business-type-assignment-country');
    countrySelect.innerHTML = '<option value="">Select Country</option>';
    allCountries.forEach(country => {
        countrySelect.innerHTML += `<option value="${country.id}">${country.name}</option>`;
    });
    
    // Add country change event listener to filter locations
    countrySelect.onchange = function() {
        const selectedCountryId = this.value;
        const locationSelect = document.getElementById('business-type-assignment-location');
        locationSelect.innerHTML = '<option value="">Select Location</option>';
        
        if (selectedCountryId) {
            const filteredLocations = allLocationTypes.filter(loc => loc.country_id == selectedCountryId);
            filteredLocations.forEach(location => {
                locationSelect.innerHTML += `<option value="${location.id}">${location.name}</option>`;
            });
        }
        
        // Reset sublocation dropdown when country changes
        const sublocationSelect = document.getElementById('business-type-assignment-sublocation');
        sublocationSelect.innerHTML = '<option value="">Select Sublocation</option>';
    };
    
    // Populate location dropdown (initially empty until country is selected)
    const locationSelect = document.getElementById('business-type-assignment-location');
    locationSelect.innerHTML = '<option value="">Select Location</option>';
    
    // Add location change event listener to filter sublocations
    locationSelect.onchange = function() {
        const selectedLocationId = this.value;
        const sublocationSelect = document.getElementById('business-type-assignment-sublocation');
        sublocationSelect.innerHTML = '<option value="">Select Sublocation</option>';
        
        if (selectedLocationId) {
            const filteredSublocations = allSubLocationTypes.filter(sub => sub.location_id == selectedLocationId);
            filteredSublocations.forEach(sublocation => {
                sublocationSelect.innerHTML += `<option value="${sublocation.id}">${sublocation.name}</option>`;
            });
        }
    };
    
    // Populate sublocation dropdown (initially empty until location is selected)
    const sublocationSelect = document.getElementById('business-type-assignment-sublocation');
    sublocationSelect.innerHTML = '<option value="">Select Sublocation</option>';
    
    // Populate business type dropdown
    const businessTypeSelect = document.getElementById('business-type-assignment-business-type');
    businessTypeSelect.innerHTML = '<option value="">Select Business Type</option>';
    allBusinessTypes.forEach(businessType => {
        businessTypeSelect.innerHTML += `<option value="${businessType.id}">${businessType.name}</option>`;
    });
    
    if (id) {
        const assignment = allBusinessTypeAssignments.find(a => a.id === id);
        if (assignment) {
            title.textContent = 'Edit Business Type Assignment';
            document.getElementById('business-type-assignment-id').value = assignment.id;
            document.getElementById('business-type-assignment-country').value = assignment.country_id || '';
            // Trigger the onchange event to populate locations
            countrySelect.dispatchEvent(new Event('change'));
            document.getElementById('business-type-assignment-location').value = assignment.location_id || '';
            // Trigger the onchange event to populate sublocations
            locationSelect.dispatchEvent(new Event('change'));
            document.getElementById('business-type-assignment-sublocation').value = assignment.sub_location_id || '';
            document.getElementById('business-type-assignment-business-type').value = assignment.business_type_id || '';
        }
    } else {
        title.textContent = 'Assign Business Type';
    }
    
    modal.classList.add('active');
}

function closeBusinessTypeAssignmentModal() {
    document.getElementById('business-type-assignment-modal').classList.remove('active');
}

async function saveBusinessTypeAssignment(e) {
    e.preventDefault();
    const id = document.getElementById('business-type-assignment-id').value;
    const country_id = document.getElementById('business-type-assignment-country').value;
    const location_id = document.getElementById('business-type-assignment-location').value;
    const sub_location_id = document.getElementById('business-type-assignment-sublocation').value;
    const business_type_id = document.getElementById('business-type-assignment-business-type').value;
    
    const data = {
        country_id,
        location_id,
        sub_location_id,
        business_type_id
    };
try {
        if (id) {
            await fetch(`${API_BASE}/business-type-assignments/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
        } else {
            await fetch(`${API_BASE}/business-type-assignments`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
        }
        closeBusinessTypeAssignmentModal();
        loadBusinessTypeAssignments();
    } catch (error) {
        console.error('Error saving business type assignment:', error);
    }
}

async function editBusinessTypeAssignment(id) {
    openBusinessTypeAssignmentModal(id);
}

async function deleteBusinessTypeAssignment(id) {
    if (confirm('Are you sure you want to delete this business type assignment?')) {
        try {
            await fetch(`${API_BASE}/business-type-assignments/${id}`, { method: 'DELETE' });
            loadBusinessTypeAssignments();
        } catch (error) {
            console.error('Error deleting business type assignment:', error);
        }
    }
}

// ITEM CATEGORIES
async function loadItemCategories() {
    showTableLoading('item-categories-table-body', 'Loading item categories...');
    try {
        const response = await fetch(`${API_BASE}/item-categories`);
        allItemCategories = await response.json();
        renderItemCategories();
    } catch (error) {
        console.error('Error loading item categories:', error);
    }
}

function renderItemCategories() {
    const tbody = document.getElementById('item-categories-table-body');
    tbody.innerHTML = allItemCategories.map(cat => `
        <tr>
            <td class="px-3 py-2 whitespace-nowrap">${cat.serial_number || '-'}</td>
            <td class="px-3 py-2 whitespace-nowrap">${cat.name}</td>
            <td class="px-3 py-2 whitespace-nowrap">${cat.description || '-'}</td>
            <td class="px-3 py-2 whitespace-nowrap">
                <button onclick="editItemCategory(${cat.id})" class="text-blue-600 hover:text-blue-800 mr-2">
                    <i class="fas fa-edit"></i>
                </button>
                <button onclick="deleteItemCategory(${cat.id})" class="text-red-600 hover:text-red-800">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        </tr>
    `).join('');
}

function filterItemCategories() {
    const searchTerm = (document.getElementById('item-categories-search')?.value || '').toLowerCase();
    const filtered = allItemCategories.filter(cat => {
        const matchesSearch = !searchTerm ||
            (cat.name && cat.name.toLowerCase().includes(searchTerm)) ||
            (cat.serial_number && cat.serial_number.toLowerCase().includes(searchTerm)) ||
            (cat.description && cat.description.toLowerCase().includes(searchTerm));
        return matchesSearch;
    });
    const tbody = document.getElementById('item-categories-table-body');
    tbody.innerHTML = filtered.map(cat => `
        <tr>
            <td class="px-3 py-2 whitespace-nowrap">${cat.serial_number || '-'}</td>
            <td class="px-3 py-2 whitespace-nowrap">${cat.name}</td>
            <td class="px-3 py-2 whitespace-nowrap">${cat.description || '-'}</td>
            <td class="px-3 py-2 whitespace-nowrap">
                <button onclick="editItemCategory(${cat.id})" class="text-blue-600 hover:text-blue-800 mr-2">
                    <i class="fas fa-edit"></i>
                </button>
                <button onclick="deleteItemCategory(${cat.id})" class="text-red-600 hover:text-red-800">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        </tr>
    `).join('');
}

function openItemCategoryModal(id = null) {
    const modal = document.getElementById('item-category-modal');
    const form = document.getElementById('item-category-form');
    const title = document.getElementById('item-category-modal-title');

    form.reset();
    document.getElementById('item-category-id').value = '';
    document.getElementById('item-category-serial').value = '';

    if (id) {
        const cat = allItemCategories.find(c => c.id === id);
        if (cat) {
            title.textContent = 'Edit Item Category';
            document.getElementById('item-category-id').value = cat.id;
            document.getElementById('item-category-serial').value = cat.serial_number || '';
            document.getElementById('item-category-name').value = cat.name;
            document.getElementById('item-category-description').value = cat.description || '';
        }
    } else {
        title.textContent = 'Add Item Category';
        // Fetch next serial number
        fetch(`${API_BASE}/item-categories/next-serial`)
            .then(response => response.json())
            .then(data => {
                document.getElementById('item-category-serial').value = data.next_serial;
            })
            .catch(error => {
                console.error('Error fetching next serial:', error);
            });
    }

    modal.classList.add('active');
}

function closeItemCategoryModal() {
    document.getElementById('item-category-modal').classList.remove('active');
}

async function saveItemCategory(e) {
    e.preventDefault();
    const id = document.getElementById('item-category-id').value;
    const data = {
        name: document.getElementById('item-category-name').value,
        description: document.getElementById('item-category-description').value,
        serial_number: document.getElementById('item-category-serial').value
    };

    try {
        if (id) {
            await fetch(`${API_BASE}/item-categories/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
        } else {
            await fetch(`${API_BASE}/item-categories`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
        }
        closeItemCategoryModal();
        loadItemCategories();
    } catch (error) {
        console.error('Error saving item category:', error);
    }
}

async function editItemCategory(id) {
    openItemCategoryModal(id);
}

async function deleteItemCategory(id) {
    if (confirm('Are you sure you want to delete this item category?')) {
        try {
            const response = await fetch(`${API_BASE}/item-categories/${id}`, { method: 'DELETE' });
            if (response.ok) {
                loadItemCategories();
            } else {
                const error = await response.json();
                alert(error.error || 'Error deleting item category');
            }
        } catch (error) {
            console.error('Error deleting item category:', error);
            alert('Error deleting item category');
        }
    }
}

// ITEM UNITS
async function loadItemUnits() {
    showTableLoading('item-units-table-body', 'Loading item units...');
    try {
        const response = await fetch(`${API_BASE}/item-units`);
        allItemUnits = await response.json();
        renderItemUnits();
    } catch (error) {
        console.error('Error loading item units:', error);
    }
}

function renderItemUnits() {
    const tbody = document.getElementById('item-units-table-body');
    tbody.innerHTML = allItemUnits.map(unit => `
        <tr>
            <td class="px-3 py-2 whitespace-nowrap">${unit.serial_number || '-'}</td>
            <td class="px-3 py-2 whitespace-nowrap">${unit.name}</td>
            <td class="px-3 py-2 whitespace-nowrap">${unit.description || '-'}</td>
            <td class="px-3 py-2 whitespace-nowrap">
                <button onclick="editItemUnit(${unit.id})" class="text-blue-600 hover:text-blue-800 mr-2">
                    <i class="fas fa-edit"></i>
                </button>
                <button onclick="deleteItemUnit(${unit.id})" class="text-red-600 hover:text-red-800">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        </tr>
    `).join('');
}

function filterItemUnits() {
    const searchTerm = (document.getElementById('item-units-search')?.value || '').toLowerCase();
    const filtered = allItemUnits.filter(unit => {
        const matchesSearch = !searchTerm ||
            (unit.name && unit.name.toLowerCase().includes(searchTerm)) ||
            (unit.serial_number && unit.serial_number.toLowerCase().includes(searchTerm)) ||
            (unit.description && unit.description.toLowerCase().includes(searchTerm));
        return matchesSearch;
    });
    const tbody = document.getElementById('item-units-table-body');
    tbody.innerHTML = filtered.map(unit => `
        <tr>
            <td class="px-3 py-2 whitespace-nowrap">${unit.serial_number || '-'}</td>
            <td class="px-3 py-2 whitespace-nowrap">${unit.name}</td>
            <td class="px-3 py-2 whitespace-nowrap">${unit.description || '-'}</td>
            <td class="px-3 py-2 whitespace-nowrap">
                <button onclick="editItemUnit(${unit.id})" class="text-blue-600 hover:text-blue-800 mr-2">
                    <i class="fas fa-edit"></i>
                </button>
                <button onclick="deleteItemUnit(${unit.id})" class="text-red-600 hover:text-red-800">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        </tr>
    `).join('');
}

function openItemUnitModal(id = null) {
    const modal = document.getElementById('item-unit-modal');
    const form = document.getElementById('item-unit-form');
    const title = document.getElementById('item-unit-modal-title');

    form.reset();
    document.getElementById('item-unit-id').value = '';
    document.getElementById('item-unit-serial').value = '';

    if (id) {
        const unit = allItemUnits.find(u => u.id === id);
        if (unit) {
            title.textContent = 'Edit Item Unit';
            document.getElementById('item-unit-id').value = unit.id;
            document.getElementById('item-unit-serial').value = unit.serial_number || '';
            document.getElementById('item-unit-name').value = unit.name;
            document.getElementById('item-unit-description').value = unit.description || '';
        }
    } else {
        title.textContent = 'Add Item Unit';
        // Fetch next serial number
        fetch(`${API_BASE}/item-units/next-serial`)
            .then(response => response.json())
            .then(data => {
                document.getElementById('item-unit-serial').value = data.next_serial;
            })
            .catch(error => {
                console.error('Error fetching next serial:', error);
            });
    }

    modal.classList.add('active');
}

function closeItemUnitModal() {
    document.getElementById('item-unit-modal').classList.remove('active');
}

async function saveItemUnit(e) {
    e.preventDefault();
    const id = document.getElementById('item-unit-id').value;
    const data = {
        name: document.getElementById('item-unit-name').value,
        description: document.getElementById('item-unit-description').value,
        serial_number: document.getElementById('item-unit-serial').value
    };

    try {
        if (id) {
            await fetch(`${API_BASE}/item-units/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
        } else {
            await fetch(`${API_BASE}/item-units`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
        }
        closeItemUnitModal();
        loadItemUnits();
    } catch (error) {
        console.error('Error saving item unit:', error);
    }
}

async function editItemUnit(id) {
    openItemUnitModal(id);
}

async function deleteItemUnit(id) {
    if (confirm('Are you sure you want to delete this item unit?')) {
        try {
            await fetch(`${API_BASE}/item-units/${id}`, { method: 'DELETE' });
            loadItemUnits();
        } catch (error) {
            console.error('Error deleting item unit:', error);
        }
    }
}

// ITEM SUBCATEGORIES
async function loadItemSubcategories() {
    showTableLoading('item-subcategories-table-body', 'Loading item subcategories...');
    try {
        const response = await fetch(`${API_BASE}/item-subcategories`);
        allItemSubcategories = await response.json();
        renderItemSubcategories();
    } catch (error) {
        console.error('Error loading item subcategories:', error);
    }
}

function renderItemSubcategories() {
    const tbody = document.getElementById('item-subcategories-table-body');
    if (!tbody) return;

    // Populate category filter dropdown
    const categoryFilter = document.getElementById('item-subcategories-filter-category');
    if (categoryFilter && allItemCategories) {
        const currentVal = categoryFilter.value;
        const uniqueCategories = [...new Map(allItemCategories.map(c => [c.id, c])).values()];
        categoryFilter.innerHTML = '<option value="">All Categories</option>' +
            uniqueCategories.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
        categoryFilter.value = currentVal;
    }

    const filtered = getFilteredItemSubcategories();
    tbody.innerHTML = filtered.map(sub => `
        <tr>
            <td class="px-3 py-2 whitespace-nowrap">${sub.serial_number || '-'}</td>
            <td class="px-3 py-2 whitespace-nowrap">${sub.item_category_name || '-'}</td>
            <td class="px-3 py-2 whitespace-nowrap">${sub.name}</td>
            <td class="px-3 py-2 whitespace-nowrap">${sub.description || '-'}</td>
            <td class="px-3 py-2 whitespace-nowrap">
                <button onclick="editItemSubcategory(${sub.id})" class="text-blue-600 hover:text-blue-800 mr-2">
                    <i class="fas fa-edit"></i>
                </button>
                <button onclick="deleteItemSubcategory(${sub.id})" class="text-red-600 hover:text-red-800">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        </tr>
    `).join('');

    highlightItemSubcategoryFilters();
}

function getFilteredItemSubcategories() {
    if (!Array.isArray(allItemSubcategories)) return [];
    const search = (document.getElementById('item-subcategories-search')?.value || '').toLowerCase();
    const categoryFilter = document.getElementById('item-subcategories-filter-category')?.value || '';

    return allItemSubcategories.filter(sub => {
        const matchesSearch = !search ||
            (sub.name && sub.name.toLowerCase().includes(search)) ||
            (sub.serial_number && sub.serial_number.toLowerCase().includes(search)) ||
            (sub.item_category_name && sub.item_category_name.toLowerCase().includes(search)) ||
            (sub.description && sub.description.toLowerCase().includes(search));
        const matchesCategory = !categoryFilter || sub.item_category_id == categoryFilter;
        return matchesSearch && matchesCategory;
    });
}

function filterItemSubcategories() {
    renderItemSubcategories();
}

function highlightItemSubcategoryFilters() {
    const activeClass = 'border-yellow-400 bg-yellow-100';
    const filterIds = ['item-subcategories-search', 'item-subcategories-filter-category'];
    filterIds.forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;
        if (el.value && el.value.trim()) {
            el.classList.add(...activeClass.split(' '));
        } else {
            el.classList.remove(...activeClass.split(' '));
        }
    });
}

function clearItemSubcategoryFilters() {
    document.getElementById('item-subcategories-search').value = '';
    const categoryFilter = document.getElementById('item-subcategories-filter-category');
    if (categoryFilter) categoryFilter.value = '';
    filterItemSubcategories();
}

function openItemSubcategoryModal(id = null) {
    const modal = document.getElementById('item-subcategory-modal');
    const form = document.getElementById('item-subcategory-form');
    const title = document.getElementById('item-subcategory-modal-title');

    form.reset();
    document.getElementById('item-subcategory-id').value = '';
    document.getElementById('item-subcategory-serial').value = '';

    // Load item categories if not already loaded
    if (!allItemCategories || allItemCategories.length === 0) {
        loadItemCategories();
    }

    // Populate item category dropdown
    const categorySelect = document.getElementById('item-subcategory-category');
    if (categorySelect && allItemCategories) {
        categorySelect.innerHTML = '<option value="">Select Category</option>' +
            allItemCategories.map(cat => `<option value="${cat.id}">${cat.name}</option>`).join('');
    }

    // Add event listener to form
    const newForm = form.cloneNode(true);
    form.parentNode.replaceChild(newForm, form);
    newForm.addEventListener('submit', saveItemSubcategory);

    if (id) {
        const sub = allItemSubcategories.find(s => s.id === id);
        if (sub) {
            title.textContent = 'Edit Item Subcategory';
            document.getElementById('item-subcategory-id').value = sub.id;
            document.getElementById('item-subcategory-serial').value = sub.serial_number || '';
            document.getElementById('item-subcategory-category').value = sub.item_category_id || '';
            document.getElementById('item-subcategory-name').value = sub.name;
            document.getElementById('item-subcategory-description').value = sub.description || '';
        }
    } else {
        title.textContent = 'Add Item Subcategory';
        // Fetch next serial number
        fetch(`${API_BASE}/item-subcategories/next-serial`)
            .then(response => response.json())
            .then(data => {
                document.getElementById('item-subcategory-serial').value = data.next_serial;
            })
            .catch(error => {
                console.error('Error fetching next serial:', error);
            });
    }

    modal.classList.add('active');
}

function closeItemSubcategoryModal() {
    document.getElementById('item-subcategory-modal').classList.remove('active');
}

async function saveItemSubcategory(e) {
    e.preventDefault();
    const id = document.getElementById('item-subcategory-id').value;
    const data = {
        name: document.getElementById('item-subcategory-name').value,
        description: document.getElementById('item-subcategory-description').value,
        item_category_id: document.getElementById('item-subcategory-category').value || null,
        serial_number: document.getElementById('item-subcategory-serial').value
    };

    try {
        if (id) {
            await fetch(`${API_BASE}/item-subcategories/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
        } else {
            await fetch(`${API_BASE}/item-subcategories`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
        }
        closeItemSubcategoryModal();
        loadItemSubcategories();
    } catch (error) {
        console.error('Error saving item subcategory:', error);
    }
}

async function editItemSubcategory(id) {
    openItemSubcategoryModal(id);
}

async function deleteItemSubcategory(id) {
    if (confirm('Are you sure you want to delete this item subcategory?')) {
        try {
            const response = await fetch(`${API_BASE}/item-subcategories/${id}`, { method: 'DELETE' });
            if (response.ok) {
                loadItemSubcategories();
            } else {
                const error = await response.json();
                alert(error.error || 'Error deleting item subcategory');
            }
        } catch (error) {
            console.error('Error deleting item subcategory:', error);
            alert('Error deleting item subcategory');
        }
    }
}

// ITEM TYPES
async function loadItemTypes() {
    showTableLoading('item-types-table-body', 'Loading item types...');
    try {
        const response = await fetch(`${API_BASE}/item-types`);
        allItemTypes = await response.json();
        renderItemTypes();
        populateItemTypesFilters();
    } catch (error) {
        console.error('Error loading item types:', error);
    }
}

function populateItemTypesFilters() {
    // Populate category filter
    const categoryFilter = document.getElementById('item-types-filter-category');
    if (categoryFilter && allItemCategories) {
        categoryFilter.innerHTML = '<option value="">All Categories</option>' +
            allItemCategories.map(cat => `<option value="${cat.id}">${cat.name}</option>`).join('');
    }

    // Populate subcategory filter with all subcategories (not unique names)
    const subcategoryFilter = document.getElementById('item-types-filter-subcategory');
    if (subcategoryFilter && allItemSubcategories) {
        subcategoryFilter.innerHTML = '<option value="">All Subcategories</option>' +
            allItemSubcategories.map(sub => `<option value="${sub.id}" data-category-id="${sub.item_category_id}" style="display:none;">${sub.name}</option>`).join('');
    }

    // Populate type filter with all types (not unique names)
    const typeFilter = document.getElementById('item-types-filter-type');
    if (typeFilter && allItemTypes) {
        typeFilter.innerHTML = '<option value="">All Types</option>' +
            allItemTypes.map(type => `<option value="${type.id}" data-subcategory-id="${type.item_subcategory_id}" style="display:none;">${type.name}</option>`).join('');
    }
}

// Update subcategory filter when category changes
document.addEventListener('DOMContentLoaded', function() {
    const categoryFilter = document.getElementById('item-types-filter-category');
    const subcategoryFilter = document.getElementById('item-types-filter-subcategory');
    const typeFilter = document.getElementById('item-types-filter-type');

    if (categoryFilter) {
        categoryFilter.addEventListener('change', function() {
            const selectedCategoryId = this.value;
            const subcategoryOptions = subcategoryFilter.querySelectorAll('option');
            
            subcategoryOptions.forEach(option => {
                if (option.value === '') {
                    option.style.display = 'block';
                } else {
                    const optionCategoryId = option.getAttribute('data-category-id');
                    if (!selectedCategoryId || optionCategoryId == selectedCategoryId) {
                        option.style.display = 'block';
                    } else {
                        option.style.display = 'none';
                    }
                }
            });
            
            // Reset subcategory and type filters
            subcategoryFilter.value = '';
            typeFilter.value = '';
            filterItemTypes();
        });
    }

    if (subcategoryFilter) {
        subcategoryFilter.addEventListener('change', function() {
            const selectedSubcategoryId = this.value;
            const typeOptions = typeFilter.querySelectorAll('option');
            
            typeOptions.forEach(option => {
                if (option.value === '') {
                    option.style.display = 'block';
                } else {
                    const optionSubcategoryId = option.getAttribute('data-subcategory-id');
                    if (!selectedSubcategoryId || optionSubcategoryId == selectedSubcategoryId) {
                        option.style.display = 'block';
                    } else {
                        option.style.display = 'none';
                    }
                }
            });
            
            // Reset type filter
            typeFilter.value = '';
            filterItemTypes();
        });
    }
});

function filterItemTypes() {
    const searchTerm = document.getElementById('item-types-search').value.toLowerCase();
    const categoryFilter = document.getElementById('item-types-filter-category').value;
    const subcategoryFilter = document.getElementById('item-types-filter-subcategory').value;
    const typeFilter = document.getElementById('item-types-filter-type').value;

    const filteredTypes = allItemTypes.filter(type => {
        const matchesSearch = !searchTerm ||
            type.name.toLowerCase().includes(searchTerm) ||
            (type.serial_number && type.serial_number.toLowerCase().includes(searchTerm));
        const matchesCategory = !categoryFilter || type.item_category_id == categoryFilter;
        const matchesSubcategory = !subcategoryFilter || type.item_subcategory_id == subcategoryFilter || type.item_subcategory_name === allItemSubcategories.find(s => s.id == subcategoryFilter)?.name;
        const matchesType = !typeFilter || type.id == typeFilter || type.name === allItemTypes.find(t => t.id == typeFilter)?.name;

        return matchesSearch && matchesCategory && matchesSubcategory && matchesType;
    });

    renderItemTypesFiltered(filteredTypes);
}

function renderItemTypesFiltered(types) {
    const tbody = document.getElementById('item-types-table-body');
    tbody.innerHTML = types.map(type => `
        <tr>
            <td class="px-3 py-2 whitespace-nowrap">${type.serial_number || '-'}</td>
            <td class="px-3 py-2 whitespace-nowrap">${type.item_category_name || '-'}</td>
            <td class="px-3 py-2 whitespace-nowrap">${type.item_subcategory_name || '-'}</td>
            <td class="px-3 py-2 whitespace-nowrap">${type.name}</td>
            <td class="px-3 py-2 whitespace-nowrap">${type.description || '-'}</td>
            <td class="px-3 py-2 whitespace-nowrap">
                <button onclick="editItemType(${type.id})" class="text-blue-600 hover:text-blue-800 mr-2">
                    <i class="fas fa-edit"></i>
                </button>
                <button onclick="deleteItemType(${type.id})" class="text-red-600 hover:text-red-800">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        </tr>
    `).join('');
}

function exportItemTypesToCSV() {
    const searchTerm = document.getElementById('item-types-search').value.toLowerCase();
    const categoryFilter = document.getElementById('item-types-filter-category').value;
    const subcategoryFilter = document.getElementById('item-types-filter-subcategory').value;
    const typeFilter = document.getElementById('item-types-filter-type').value;

    const filteredTypes = allItemTypes.filter(type => {
        const matchesSearch = !searchTerm ||
            type.name.toLowerCase().includes(searchTerm) ||
            (type.serial_number && type.serial_number.toLowerCase().includes(searchTerm));
        const matchesCategory = !categoryFilter || type.item_category_id == categoryFilter;
        const matchesSubcategory = !subcategoryFilter || type.item_subcategory_id == subcategoryFilter || type.item_subcategory_name === allItemSubcategories.find(s => s.id == subcategoryFilter)?.name;
        const matchesType = !typeFilter || type.id == typeFilter || type.name === allItemTypes.find(t => t.id == typeFilter)?.name;

        return matchesSearch && matchesCategory && matchesSubcategory && matchesType;
    });

    // Create CSV content
    const headers = ['Serial Number', 'Category', 'Subcategory', 'Type', 'Description'];
    const csvContent = [
        headers.join(','),
        ...filteredTypes.map(type => [
            type.serial_number || '',
            type.item_category_name || '',
            type.item_subcategory_name || '',
            type.name || '',
            type.description || ''
        ].map(field => `"${String(field).replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    // Create download link
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `item_types_${new Date().toISOString().slice(0,10)}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

function renderItemTypes() {
    const tbody = document.getElementById('item-types-table-body');
    tbody.innerHTML = allItemTypes.map(type => `
        <tr>
            <td class="px-3 py-2 whitespace-nowrap">${type.serial_number || '-'}</td>
            <td class="px-3 py-2 whitespace-nowrap">${type.item_category_name || '-'}</td>
            <td class="px-3 py-2 whitespace-nowrap">${type.item_subcategory_name || '-'}</td>
            <td class="px-3 py-2 whitespace-nowrap">${type.name}</td>
            <td class="px-3 py-2 whitespace-nowrap">${type.description || '-'}</td>
            <td class="px-3 py-2 whitespace-nowrap">
                <button onclick="editItemType(${type.id})" class="text-blue-600 hover:text-blue-800 mr-2">
                    <i class="fas fa-edit"></i>
                </button>
                <button onclick="deleteItemType(${type.id})" class="text-red-600 hover:text-red-800">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        </tr>
    `).join('');
}

function openItemTypeModal(id = null) {
    const modal = document.getElementById('item-type-modal');
    const form = document.getElementById('item-type-form');
    const title = document.getElementById('item-type-modal-title');

    form.reset();
    document.getElementById('item-type-id').value = '';
    document.getElementById('item-type-serial').value = '';

    // Load item categories if not already loaded
    if (!allItemCategories || allItemCategories.length === 0) {
        loadItemCategories();
    }

    // Load item subcategories if not already loaded
    if (!allItemSubcategories || allItemSubcategories.length === 0) {
        loadItemSubcategories();
    }

    // Populate item category dropdown
    const categorySelect = document.getElementById('item-type-category');
    if (categorySelect && allItemCategories) {
        categorySelect.innerHTML = '<option value="">Select Category</option>' +
            allItemCategories.map(cat => `<option value="${cat.id}">${cat.name}</option>`).join('');
    }

    // Populate item subcategory dropdown
    const subcategorySelect = document.getElementById('item-type-subcategory');
    if (subcategorySelect && allItemSubcategories) {
        subcategorySelect.innerHTML = '<option value="">Select Subcategory</option>' +
            allItemSubcategories.map(sub => `<option value="${sub.id}">${sub.name}</option>`).join('');
    }

    // Add event listener to category dropdown to filter subcategories
    if (categorySelect) {
        categorySelect.addEventListener('change', function() {
            const selectedCategoryId = this.value;
            if (subcategorySelect && allItemSubcategories) {
                const filteredSubcategories = selectedCategoryId
                    ? allItemSubcategories.filter(sub => sub.item_category_id == selectedCategoryId)
                    : allItemSubcategories;
                subcategorySelect.innerHTML = '<option value="">Select Subcategory</option>' +
                    filteredSubcategories.map(sub => `<option value="${sub.id}">${sub.name}</option>`).join('');
            }
        });
    }

    if (id) {
        const type = allItemTypes.find(t => t.id === id);
        if (type) {
            title.textContent = 'Edit Item Type';
            document.getElementById('item-type-id').value = type.id;
            document.getElementById('item-type-serial').value = type.serial_number || '';
            document.getElementById('item-type-name').value = type.name;
            document.getElementById('item-type-category').value = type.item_category_id || '';
            document.getElementById('item-type-description').value = type.description || '';

            // Filter subcategories based on selected category
            if (type.item_category_id && subcategorySelect && allItemSubcategories) {
                const filteredSubcategories = allItemSubcategories.filter(sub => sub.item_category_id == type.item_category_id);
                subcategorySelect.innerHTML = '<option value="">Select Subcategory</option>' +
                    filteredSubcategories.map(sub => `<option value="${sub.id}">${sub.name}</option>`).join('');
                document.getElementById('item-type-subcategory').value = type.item_subcategory_id || '';
            }
        }
    } else {
        title.textContent = 'Add Item Type';
        // Fetch next serial number
        fetch(`${API_BASE}/item-types/next-serial`)
            .then(response => response.json())
            .then(data => {
                document.getElementById('item-type-serial').value = data.next_serial;
            })
            .catch(error => {
                console.error('Error fetching next serial:', error);
            });
    }

    modal.classList.add('active');
}

function closeItemTypeModal() {
    document.getElementById('item-type-modal').classList.remove('active');
}

async function saveItemType(e) {
    e.preventDefault();
    const id = document.getElementById('item-type-id').value;
    const data = {
        name: document.getElementById('item-type-name').value,
        item_category_id: document.getElementById('item-type-category').value || null,
        item_subcategory_id: document.getElementById('item-type-subcategory').value || null,
        description: document.getElementById('item-type-description').value,
        serial_number: document.getElementById('item-type-serial').value
    };

    try {
        if (id) {
            await fetch(`${API_BASE}/item-types/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
        } else {
            await fetch(`${API_BASE}/item-types`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
        }
        closeItemTypeModal();
        loadItemTypes();
    } catch (error) {
        console.error('Error saving item type:', error);
    }
}

async function editItemType(id) {
    openItemTypeModal(id);
}

async function deleteItemType(id) {
    if (confirm('Are you sure you want to delete this item type?')) {
        try {
            await fetch(`${API_BASE}/item-types/${id}`, { method: 'DELETE' });
            loadItemTypes();
        } catch (error) {
            console.error('Error deleting item type:', error);
        }
    }
}

// ITEMS
async function loadItems() {
    showTableLoading('items-table-body', 'Loading items...');
    try {
        const response = await fetch(`${API_BASE}/items`);
        allItems = await response.json();
        renderItems();
    } catch (error) {
        console.error('Error loading items:', error);
    }
}

function renderItems() {
    const tbody = document.getElementById('items-table-body');
    tbody.innerHTML = allItems.map(item => `
        <tr>
            <td class="px-3 py-2 whitespace-nowrap">${item.product_code || '-'}</td>
            <td class="px-3 py-2 whitespace-nowrap">${item.name}</td>
            <td class="px-3 py-2 whitespace-nowrap">${item.category_name || '-'}</td>
            <td class="px-3 py-2 whitespace-nowrap">${item.subcategory_name || '-'}</td>
            <td class="px-3 py-2 whitespace-nowrap">${item.type_name || '-'}</td>
            <td class="px-3 py-2 whitespace-nowrap">${item.unit_name || '-'}</td>
            <td class="px-3 py-2 whitespace-nowrap">${item.description || '-'}</td>
            <td class="px-3 py-2 whitespace-nowrap">
                <button onclick="editItem(${item.id})" class="text-blue-600 hover:text-blue-800 mr-2">
                    <i class="fas fa-edit"></i>
                </button>
                <button onclick="deleteItem(${item.id})" class="text-red-600 hover:text-red-800">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        </tr>
    `).join('');
    
    // Populate filter dropdowns
    populateItemsFilters();
}

function populateItemsFilters() {
    // Populate category filter with unique categories
    const categoryFilter = document.getElementById('items-filter-category');
    const categories = [...new Set(allItems.map(item => item.category_name).filter(Boolean))];
    categoryFilter.innerHTML = '<option value="">All Categories</option>' + 
        categories.map(cat => `<option value="${cat}">${cat}</option>`).join('');
    
    // Populate subcategory filter with all subcategories (not unique names) and their category
    const subcategoryFilter = document.getElementById('items-filter-subcategory');
    const subcategoryMap = new Map();
    allItems.forEach(item => {
        if (item.subcategory_name) {
            const key = `${item.subcategory_name}-${item.category_name}`;
            if (!subcategoryMap.has(key)) {
                subcategoryMap.set(key, {
                    name: item.subcategory_name,
                    category: item.category_name
                });
            }
        }
    });
    const subcategories = Array.from(subcategoryMap.values());
    subcategoryFilter.innerHTML = '<option value="">All Subcategories</option>' + 
        subcategories.map(sub => `<option value="${sub.name}" data-category="${sub.category || ''}" style="display:none;">${sub.name}</option>`).join('');
    
    // Populate unit filter with unique units
    const unitFilter = document.getElementById('items-filter-unit');
    const units = [...new Set(allItems.map(item => item.unit_name).filter(Boolean))];
    unitFilter.innerHTML = '<option value="">All Units</option>' + 
        units.map(unit => `<option value="${unit}">${unit}</option>`).join('');
}

// Update subcategory filter when category changes
document.addEventListener('DOMContentLoaded', function() {
    const categoryFilter = document.getElementById('items-filter-category');
    const subcategoryFilter = document.getElementById('items-filter-subcategory');

    if (categoryFilter && subcategoryFilter) {
        categoryFilter.addEventListener('change', function() {
            const selectedCategory = this.value;
            const subcategoryOptions = subcategoryFilter.querySelectorAll('option');
            
            subcategoryOptions.forEach(option => {
                if (option.value === '') {
                    option.style.display = 'block';
                } else {
                    const optionCategory = option.getAttribute('data-category');
                    if (!selectedCategory || optionCategory === selectedCategory) {
                        option.style.display = 'block';
                    } else {
                        option.style.display = 'none';
                    }
                }
            });
            
            // Reset subcategory filter
            subcategoryFilter.value = '';
            filterItems();
        });
    }
});

function filterItems() {
    const searchTerm = document.getElementById('items-search').value.toLowerCase();
    const categoryFilter = document.getElementById('items-filter-category').value;
    const subcategoryFilter = document.getElementById('items-filter-subcategory').value;
    const unitFilter = document.getElementById('items-filter-unit').value;
    
    const filteredItems = allItems.filter(item => {
        const matchesSearch = !searchTerm || 
            (item.product_code && item.product_code.toLowerCase().includes(searchTerm)) ||
            (item.name && item.name.toLowerCase().includes(searchTerm));
        
        const matchesCategory = !categoryFilter || item.category_name === categoryFilter;
        const matchesSubcategory = !subcategoryFilter || item.subcategory_name === subcategoryFilter;
        const matchesUnit = !unitFilter || item.unit_name === unitFilter;
        
        return matchesSearch && matchesCategory && matchesSubcategory && matchesUnit;
    });
    
    const tbody = document.getElementById('items-table-body');
    tbody.innerHTML = filteredItems.map(item => `
        <tr>
            <td class="px-3 py-2 whitespace-nowrap">${item.product_code || '-'}</td>
            <td class="px-3 py-2 whitespace-nowrap">${item.name}</td>
            <td class="px-3 py-2 whitespace-nowrap">${item.category_name || '-'}</td>
            <td class="px-3 py-2 whitespace-nowrap">${item.subcategory_name || '-'}</td>
            <td class="px-3 py-2 whitespace-nowrap">${item.type_name || '-'}</td>
            <td class="px-3 py-2 whitespace-nowrap">${item.unit_name || '-'}</td>
            <td class="px-3 py-2 whitespace-nowrap">${item.description || '-'}</td>
            <td class="px-3 py-2 whitespace-nowrap">
                <button onclick="editItem(${item.id})" class="text-blue-600 hover:text-blue-800 mr-2">
                    <i class="fas fa-edit"></i>
                </button>
                <button onclick="deleteItem(${item.id})" class="text-red-600 hover:text-red-800">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        </tr>
    `).join('');
}

function exportItemsToCSV() {
    const searchTerm = document.getElementById('items-search').value.toLowerCase();
    const categoryFilter = document.getElementById('items-filter-category').value;
    const subcategoryFilter = document.getElementById('items-filter-subcategory').value;
    const unitFilter = document.getElementById('items-filter-unit').value;
    
    const filteredItems = allItems.filter(item => {
        const matchesSearch = !searchTerm || 
            (item.product_code && item.product_code.toLowerCase().includes(searchTerm)) ||
            (item.name && item.name.toLowerCase().includes(searchTerm));
        
        const matchesCategory = !categoryFilter || item.category_name === categoryFilter;
        const matchesSubcategory = !subcategoryFilter || item.subcategory_name === subcategoryFilter;
        const matchesUnit = !unitFilter || item.unit_name === unitFilter;
        
        return matchesSearch && matchesCategory && matchesSubcategory && matchesUnit;
    });
    
    // Create CSV content
    const headers = ['Product Code', 'Item Name', 'Category', 'Subcategory', 'Item Type', 'Unit', 'Description'];
    const csvContent = [
        headers.join(','),
        ...filteredItems.map(item => [
            item.product_code || '',
            item.name || '',
            item.category_name || '',
            item.subcategory_name || '',
            item.type_name || '',
            item.unit_name || '',
            item.description || ''
        ].map(field => `"${field}"`).join(','))
    ].join('\n');
    
    // Create download link
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `items_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

function openItemModal() {
    const modal = document.getElementById('item-modal');
    const form = document.getElementById('item-form');
    const title = document.getElementById('item-modal-title');
    
    form.reset();
    document.getElementById('item-id').value = '';
    
    // Generate next product code
    generateProductCode();
    
    // Populate category dropdown
    const categorySelect = document.getElementById('item-category');
    categorySelect.innerHTML = '<option value="">Select Category</option>' + 
        allItemCategories.map(cat => `<option value="${cat.id}">${cat.name}</option>`).join('');
    
    // Populate unit dropdown
    const unitSelect = document.getElementById('item-unit');
    unitSelect.innerHTML = '<option value="">Select Unit</option>' + 
        allItemUnits.map(unit => `<option value="${unit.id}">${unit.name}</option>`).join('');
    
    // Clear subcategory and type dropdowns
    document.getElementById('item-subcategory').innerHTML = '<option value="">Select Subcategory</option>';
    document.getElementById('item-type').innerHTML = '<option value="">Select Item Type</option>';
    
    title.textContent = 'Add Item';
    modal.classList.add('active');
}

async function generateProductCode() {
    try {
        const response = await fetch(`${API_BASE}/items/next-product-code`);
        if (!response.ok) {
            throw new Error('Network response was not ok');
        }
        const data = await response.json();
        document.getElementById('item-product-code').value = data.nextCode || 'PC-001';
    } catch (error) {
        console.error('Error generating product code:', error);
        // Fallback to PC-001 if API fails
        document.getElementById('item-product-code').value = 'PC-001';
    }
}

function updateItemSubcategories() {
    const categoryId = document.getElementById('item-category').value;
    const subcategorySelect = document.getElementById('item-subcategory');

    if (!categoryId) {
        subcategorySelect.innerHTML = '<option value="">Select Subcategory</option>';
        document.getElementById('item-type').innerHTML = '<option value="">Select Item Type</option>';
        return;
    }

    const subcategories = allItemSubcategories.filter(sub => sub.item_category_id == categoryId);
    subcategorySelect.innerHTML = '<option value="">Select Subcategory</option>' +
        subcategories.map(sub => `<option value="${sub.id}">${sub.name}</option>`).join('');

    // Clear item type dropdown
    document.getElementById('item-type').innerHTML = '<option value="">Select Item Type</option>';
}

function updateItemTypes() {
    const categoryId = document.getElementById('item-category').value;
    const subcategoryId = document.getElementById('item-subcategory').value;
    const typeSelect = document.getElementById('item-type');

    if (!categoryId || !subcategoryId) {
        typeSelect.innerHTML = '<option value="">Select Item Type</option>';
        return;
    }

    const types = allItemTypes.filter(type => type.item_category_id == categoryId && type.item_subcategory_id == subcategoryId);
    typeSelect.innerHTML = '<option value="">Select Item Type</option>' +
        types.map(type => `<option value="${type.id}">${type.name}</option>`).join('');
}

function closeItemModal() {
    document.getElementById('item-modal').classList.remove('active');
}

async function saveItem(e) {
    e.preventDefault();
    const id = document.getElementById('item-id').value;
    const product_code = document.getElementById('item-product-code').value;
    const name = document.getElementById('item-name').value;
    const category_id = document.getElementById('item-category').value;
    const subcategory_id = document.getElementById('item-subcategory').value;
    const type_id = document.getElementById('item-type').value;
    const unit_id = document.getElementById('item-unit').value;
    const description = document.getElementById('item-description').value;

    const data = {
        product_code: product_code,
        name: name,
        category_id: category_id,
        subcategory_id: subcategory_id,
        type_id: type_id,
        unit_id: unit_id,
        description: description
    };
try {
        if (id) {
            // Update existing item
            const response = await fetch(`${API_BASE}/items/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            await logAudit('UPDATE', 'admin', 'Item', id, `Item: ${name}`);
        } else {
            // Create new item
            const response = await fetch(`${API_BASE}/items`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            if (!response.ok) {
                const errorText = await response.text();
                console.error('Server error:', errorText);
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const result = await response.json();
await logAudit('CREATE', 'admin', 'Item', result.id, `Item: ${name}`);
        }
        closeItemModal();
        // Save current filter values before reload
        const savedSearch = document.getElementById('items-search')?.value || '';
        const savedCategory = document.getElementById('items-filter-category')?.value || '';
        const savedSubcategory = document.getElementById('items-filter-subcategory')?.value || '';
        const savedUnit = document.getElementById('items-filter-unit')?.value || '';
        await loadItems();
        // Restore filter values (populateItemsFilters resets them)
        const searchEl = document.getElementById('items-search');
        const catEl = document.getElementById('items-filter-category');
        const subEl = document.getElementById('items-filter-subcategory');
        const unitEl = document.getElementById('items-filter-unit');
        if (searchEl) searchEl.value = savedSearch;
        if (catEl) catEl.value = savedCategory;
        if (subEl) {
            subEl.value = savedSubcategory;
            // Re-show/hide subcategory options based on restored category
            const subOptions = subEl.querySelectorAll('option');
            subOptions.forEach(option => {
                if (option.value === '') { option.style.display = 'block'; }
                else {
                    const optionCategory = option.getAttribute('data-category');
                    option.style.display = (!savedCategory || optionCategory === savedCategory) ? 'block' : 'none';
                }
            });
        }
        if (unitEl) unitEl.value = savedUnit;
        filterItems();
    } catch (error) {
        console.error('Error saving item:', error);
        alert('Error saving item: ' + error.message);
    }
}

async function editItem(id) {
    const item = allItems.find(i => i.id === id);
    if (!item) return;
    
    const modal = document.getElementById('item-modal');
    const form = document.getElementById('item-form');
    const title = document.getElementById('item-modal-title');
    
    // Populate form fields
    document.getElementById('item-id').value = item.id;
    document.getElementById('item-product-code').value = item.product_code || '';
    document.getElementById('item-name').value = item.name;
    document.getElementById('item-description').value = item.description || '';
    
    // Populate category dropdown
    const categorySelect = document.getElementById('item-category');
    categorySelect.innerHTML = '<option value="">Select Category</option>' + 
        allItemCategories.map(cat => `<option value="${cat.id}" ${cat.id == item.category_id ? 'selected' : ''}>${cat.name}</option>`).join('');
    
    // Populate unit dropdown
    const unitSelect = document.getElementById('item-unit');
    unitSelect.innerHTML = '<option value="">Select Unit</option>' + 
        allItemUnits.map(unit => `<option value="${unit.id}" ${unit.id == item.unit_id ? 'selected' : ''}>${unit.name}</option>`).join('');
    
    // Load subcategories and types for the selected category
    updateItemSubcategories();
    setTimeout(() => {
        document.getElementById('item-subcategory').value = item.subcategory_id || '';
        updateItemTypes();
        setTimeout(() => {
            document.getElementById('item-type').value = item.type_id || '';
        }, 100);
    }, 100);

    title.textContent = 'Edit Item';
    modal.classList.add('active');
}

async function deleteItem(id) {
    const item = allItems.find(i => i.id === id);
    if (confirm('Are you sure you want to delete this item?')) {
        try {
            await fetch(`${API_BASE}/items/${id}`, { method: 'DELETE' });
            await logAudit('DELETE', 'admin', 'Item', id, `Item: ${item?.name || 'Unknown'}`);
            loadItems();
        } catch (error) {
            console.error('Error deleting item:', error);
        }
    }
}

// SUPPLIERS
async function loadSuppliers() {
    showTableLoading('suppliers-table-body', 'Loading suppliers...');
    try {
        const response = await fetch(`${API_BASE}/suppliers`);
        allSuppliers = await response.json();
        renderSuppliers();
    } catch (error) {
        console.error('Error loading suppliers:', error);
    }
}

function renderSuppliers() {
    const tbody = document.getElementById('suppliers-table-body');
    tbody.innerHTML = allSuppliers.map(supplier => `
        <tr>
            <td class="px-3 py-2 whitespace-nowrap">${supplier.name}</td>
            <td class="px-3 py-2 whitespace-nowrap">${supplier.contact_person || '-'}</td>
            <td class="px-3 py-2 whitespace-nowrap">${supplier.email || '-'}</td>
            <td class="px-3 py-2 whitespace-nowrap">${supplier.phone || '-'}</td>
            <td class="px-3 py-2 whitespace-nowrap">
                <button onclick="editSupplier(${supplier.id})" class="text-blue-600 hover:text-blue-800 mr-2">
                    <i class="fas fa-edit"></i>
                </button>
                <button onclick="deleteSupplier(${supplier.id})" class="text-red-600 hover:text-red-800">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        </tr>
    `).join('');
}

function filterSuppliers() {
    const searchTerm = (document.getElementById('suppliers-search')?.value || '').toLowerCase();
    const filtered = allSuppliers.filter(s =>
        !searchTerm ||
        (s.name && s.name.toLowerCase().includes(searchTerm)) ||
        (s.contact_person && s.contact_person.toLowerCase().includes(searchTerm)) ||
        (s.email && s.email.toLowerCase().includes(searchTerm)) ||
        (s.phone && s.phone.toLowerCase().includes(searchTerm))
    );
    const tbody = document.getElementById('suppliers-table-body');
    tbody.innerHTML = filtered.map(supplier => `
        <tr>
            <td class="px-3 py-2 whitespace-nowrap">${supplier.name}</td>
            <td class="px-3 py-2 whitespace-nowrap">${supplier.contact_person || '-'}</td>
            <td class="px-3 py-2 whitespace-nowrap">${supplier.email || '-'}</td>
            <td class="px-3 py-2 whitespace-nowrap">${supplier.phone || '-'}</td>
            <td class="px-3 py-2 whitespace-nowrap">
                <button onclick="editSupplier(${supplier.id})" class="text-blue-600 hover:text-blue-800 mr-2">
                    <i class="fas fa-edit"></i>
                </button>
                <button onclick="deleteSupplier(${supplier.id})" class="text-red-600 hover:text-red-800">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        </tr>
    `).join('');
}

function openSupplierModal(id = null) {
    const modal = document.getElementById('supplier-modal');
    const form = document.getElementById('supplier-form');
    const title = document.getElementById('supplier-modal-title');
    
    form.reset();
    document.getElementById('supplier-id').value = '';
    
    if (id) {
        const supplier = allSuppliers.find(s => s.id === id);
        if (supplier) {
            title.textContent = 'Edit Supplier';
            document.getElementById('supplier-id').value = supplier.id;
            document.getElementById('supplier-name').value = supplier.name;
            document.getElementById('supplier-contact-person').value = supplier.contact_person || '';
            document.getElementById('supplier-email').value = supplier.email || '';
            document.getElementById('supplier-phone').value = supplier.phone || '';
            document.getElementById('supplier-address').value = supplier.address || '';
        }
    } else {
        title.textContent = 'Add Supplier';
    }
    
    modal.classList.add('active');
}

function closeSupplierModal() {
    document.getElementById('supplier-modal').classList.remove('active');
}

async function saveSupplier(e) {
    e.preventDefault();
    const id = document.getElementById('supplier-id').value;
    const data = {
        name: document.getElementById('supplier-name').value,
        contact_person: document.getElementById('supplier-contact-person').value,
        email: document.getElementById('supplier-email').value,
        phone: document.getElementById('supplier-phone').value,
        address: document.getElementById('supplier-address').value
    };
    
    try {
        if (id) {
            await fetch(`${API_BASE}/suppliers/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
        } else {
            await fetch(`${API_BASE}/suppliers`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
        }
        closeSupplierModal();
        loadSuppliers();
    } catch (error) {
        console.error('Error saving supplier:', error);
    }
}

async function editSupplier(id) {
    openSupplierModal(id);
}

async function deleteSupplier(id) {
    if (confirm('Are you sure you want to delete this supplier?')) {
        try {
            await fetch(`${API_BASE}/suppliers/${id}`, { method: 'DELETE' });
            loadSuppliers();
        } catch (error) {
            console.error('Error deleting supplier:', error);
        }
    }
}

// SUPPLIER ASSIGNMENTS
async function loadSupplierAssignments() {
    showTableLoading('supplier-assignments-table-body', 'Loading supplier assignments...');
    try {
        const response = await fetch(`${API_BASE}/suppliers/assignments`);
        allSupplierAssignments = await response.json();
        populateSupplierAssignmentFilters();
        renderSupplierAssignments();
    } catch (error) {
        console.error('Error loading supplier assignments:', error);
    }
}

function getFilteredSupplierAssignments() {
    const country = document.getElementById('supplier-assignment-filter-country')?.value || '';
    const location = document.getElementById('supplier-assignment-filter-location')?.value || '';
    const supplier = document.getElementById('supplier-assignment-filter-supplier')?.value || '';
    return (allSupplierAssignments || []).filter(a => {
        if (country && a.country_name !== country) return false;
        if (location && a.location_name !== location) return false;
        if (supplier && a.supplier_name !== supplier) return false;
        return true;
    });
}

function populateSupplierAssignmentFilters() {
    if (!allSupplierAssignments) return;
    const countries = [...new Set(allSupplierAssignments.map(a => a.country_name).filter(Boolean))].sort();
    const suppliers = [...new Set(allSupplierAssignments.map(a => a.supplier_name).filter(Boolean))].sort();

    const countryFilter = document.getElementById('supplier-assignment-filter-country');
    if (countryFilter) {
        const current = countryFilter.value;
        countryFilter.innerHTML = '<option value="">All Countries</option>' +
            countries.map(c => `<option value="${c}">${c}</option>`).join('');
        countryFilter.value = current;
    }
    const supplierFilter = document.getElementById('supplier-assignment-filter-supplier');
    if (supplierFilter) {
        const current = supplierFilter.value;
        supplierFilter.innerHTML = '<option value="">All Suppliers</option>' +
            suppliers.map(s => `<option value="${s}">${s}</option>`).join('');
        supplierFilter.value = current;
    }
}

function onSupplierAssignmentFilterCountryChange() {
    const country = document.getElementById('supplier-assignment-filter-country')?.value || '';
    const locationFilter = document.getElementById('supplier-assignment-filter-location');
    const locations = country
        ? [...new Set(allSupplierAssignments.filter(a => a.country_name === country).map(a => a.location_name).filter(Boolean))].sort()
        : [...new Set(allSupplierAssignments.map(a => a.location_name).filter(Boolean))].sort();
    if (locationFilter) {
        locationFilter.innerHTML = '<option value="">All Locations</option>' +
            locations.map(l => `<option value="${l}">${l}</option>`).join('');
    }
    renderSupplierAssignments();
}

function clearSupplierAssignmentFilters() {
    const ids = ['supplier-assignment-filter-country', 'supplier-assignment-filter-location', 'supplier-assignment-filter-supplier'];
    ids.forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
    onSupplierAssignmentFilterCountryChange();
}

function renderSupplierAssignments() {
    const tbody = document.getElementById('supplier-assignments-table-body');
    const filtered = getFilteredSupplierAssignments();
    if (filtered.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="px-3 py-2 text-center text-gray-400">No supplier assignments found</td></tr>';
        return;
    }
    tbody.innerHTML = filtered.map((assignment, index) => {
        const sublocationText = assignment.sub_location_name && assignment.business_type_name && assignment.business_unit_code
            ? `${assignment.sub_location_name} - ${assignment.business_type_name} (${assignment.business_unit_code})`
            : '-';
        return `
        <tr>
            <td class="px-3 py-2 whitespace-nowrap text-gray-500">${index + 1}</td>
            <td class="px-3 py-2 whitespace-nowrap">${assignment.supplier_name}</td>
            <td class="px-3 py-2 whitespace-nowrap">${assignment.country_name || '-'}</td>
            <td class="px-3 py-2 whitespace-nowrap">${assignment.location_name || '-'}</td>
            <td class="px-3 py-2 whitespace-nowrap">${sublocationText}</td>
            <td class="px-3 py-2 whitespace-nowrap">${assignment.notes || '-'}</td>
            <td class="px-3 py-2 whitespace-nowrap">
                <button onclick="deleteSupplierAssignment(${assignment.id})" class="text-red-600 hover:text-red-800">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        </tr>
    `;
    }).join('');
}

async function populateSupplierSelect() {
    try {
        const response = await fetch(`${API_BASE}/suppliers`);
        const suppliers = await response.json();
        const select = document.getElementById('supplier-assignment-supplier');
        select.innerHTML = '<option value="">Select Supplier</option>' + 
            suppliers.map(s => `<option value="${s.id}">${s.name}</option>`).join('');
    } catch (error) {
        console.error('Error loading suppliers for assignment:', error);
    }
}

async function populateBusinessTypeAssignmentsSelect() {
    try {
        const [assignmentsRes, countriesRes, locationTypesRes] = await Promise.all([
            fetch(`${API_BASE}/business-type-assignments`),
            fetch(`${API_BASE}/countries`),
            fetch(`${API_BASE}/location-types`)
        ]);
        window.allSupplierAssignmentsData = await assignmentsRes.json();
        window.allSupplierCountries = await countriesRes.json();
        window.allSupplierLocationTypes = await locationTypesRes.json();

        const countrySelect = document.getElementById('supplier-assignment-country');
        if (countrySelect) {
            countrySelect.innerHTML = '<option value="">Select Country</option>' +
                window.allSupplierCountries.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
        }
        const locationTypeSelect = document.getElementById('supplier-assignment-location-type');
        if (locationTypeSelect) {
            locationTypeSelect.innerHTML = '<option value="">Select Location</option>';
        }
        const sublocationSelect = document.getElementById('supplier-assignment-sublocation');
        if (sublocationSelect) {
            sublocationSelect.innerHTML = '<option value="">Select Sublocation / Business Type</option>';
        }
    } catch (error) {
        console.error('Error loading business type assignments for supplier assignment:', error);
    }
}

function onSupplierAssignmentCountryChange() {
    const countryId = document.getElementById('supplier-assignment-country').value;
    const locationTypeSelect = document.getElementById('supplier-assignment-location-type');
    const sublocationSelect = document.getElementById('supplier-assignment-sublocation');

    locationTypeSelect.innerHTML = '<option value="">Select Location</option>';
    sublocationSelect.innerHTML = '<option value="">Select Sublocation / Business Type</option>';

    if (countryId && window.allSupplierLocationTypes) {
        const filtered = window.allSupplierLocationTypes.filter(lt => lt.country_id == countryId);
        filtered.forEach(lt => {
            locationTypeSelect.innerHTML += `<option value="${lt.id}">${lt.name}</option>`;
        });
    }
}

function onSupplierAssignmentLocationTypeChange() {
    const countryId = document.getElementById('supplier-assignment-country').value;
    const locationTypeId = document.getElementById('supplier-assignment-location-type').value;
    const sublocationSelect = document.getElementById('supplier-assignment-sublocation');

    sublocationSelect.innerHTML = '<option value="">Select Sublocation / Business Type</option>';

    if (countryId && locationTypeId && window.allSupplierAssignmentsData) {
        const filtered = window.allSupplierAssignmentsData.filter(a =>
            a.country_id == countryId && a.location_id == locationTypeId
        );
        filtered.forEach(a => {
            const text = `${a.sub_location_name || ''} - ${a.business_type_name || ''} - ${a.business_unit_code || ''}`;
            sublocationSelect.innerHTML += `<option value="${a.id}">${text}</option>`;
        });
    }
}

function openSupplierAssignmentModal() {
    const modal = document.getElementById('supplier-assignment-modal');
    const form = document.getElementById('supplier-assignment-form');
    form.reset();
    populateSupplierSelect();
    populateBusinessTypeAssignmentsSelect();
    modal.classList.add('active');
}

function closeSupplierAssignmentModal() {
    document.getElementById('supplier-assignment-modal').classList.remove('active');
}

async function saveSupplierAssignment(e) {
    e.preventDefault();
    const data = {
        supplier_id: document.getElementById('supplier-assignment-supplier').value,
        business_type_assignment_id: document.getElementById('supplier-assignment-sublocation').value,
        notes: document.getElementById('supplier-assignment-notes').value
    };
    
    try {
        const response = await fetch(`${API_BASE}/suppliers/assignments`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        if (!response.ok) {
            const error = await response.json();
            console.error('Error saving supplier assignment:', error);
            alert('Error saving supplier assignment: ' + (error.error || 'Unknown error'));
            return;
        }
        closeSupplierAssignmentModal();
        loadSupplierAssignments();
    } catch (error) {
        console.error('Error saving supplier assignment:', error);
    }
}

async function deleteSupplierAssignment(id) {
    if (confirm('Are you sure you want to delete this supplier assignment?')) {
        try {
            const response = await fetch(`${API_BASE}/suppliers/assignments/${id}`, { method: 'DELETE' });
            if (!response.ok) {
                const error = await response.json();
                console.error('Error deleting supplier assignment:', error);
                alert('Error deleting supplier assignment: ' + (error.error || 'Unknown error'));
                return;
            }
            loadSupplierAssignments();
        } catch (error) {
            console.error('Error deleting supplier assignment:', error);
        }
    }
}

// EQUIPMENT STATUSES
async function loadEquipmentStatuses() {
    showTableLoading('equipment-statuses-table-body', 'Loading equipment statuses...');
    try {
        const response = await fetch(`${API_BASE}/equipment/statuses`);
        allEquipmentStatuses = await response.json();
        renderEquipmentStatuses();
    } catch (error) {
        console.error('Error loading equipment statuses:', error);
    }
}

function renderEquipmentStatuses() {
    const tbody = document.getElementById('equipment-statuses-table-body');
    tbody.innerHTML = allEquipmentStatuses.map(status => `
        <tr>
            <td class="px-3 py-2 whitespace-nowrap">${status.name}</td>
            <td class="px-3 py-2 whitespace-nowrap">${status.description || '-'}</td>
            <td class="px-3 py-2 whitespace-nowrap">
                <button onclick="editEquipmentStatus(${status.id})" class="text-blue-600 hover:text-blue-800 mr-2">
                    <i class="fas fa-edit"></i>
                </button>
                <button onclick="deleteEquipmentStatus(${status.id})" class="text-red-600 hover:text-red-800">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        </tr>
    `).join('');
}

function filterEquipmentStatuses() {
    const searchTerm = (document.getElementById('equipment-statuses-search')?.value || '').toLowerCase();
    const filtered = allEquipmentStatuses.filter(s =>
        !searchTerm ||
        (s.name && s.name.toLowerCase().includes(searchTerm)) ||
        (s.description && s.description.toLowerCase().includes(searchTerm))
    );
    const tbody = document.getElementById('equipment-statuses-table-body');
    tbody.innerHTML = filtered.map(status => `
        <tr>
            <td class="px-3 py-2 whitespace-nowrap">${status.name}</td>
            <td class="px-3 py-2 whitespace-nowrap">${status.description || '-'}</td>
            <td class="px-3 py-2 whitespace-nowrap">
                <button onclick="editEquipmentStatus(${status.id})" class="text-blue-600 hover:text-blue-800 mr-2">
                    <i class="fas fa-edit"></i>
                </button>
                <button onclick="deleteEquipmentStatus(${status.id})" class="text-red-600 hover:text-red-800">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        </tr>
    `).join('');
}

function openEquipmentStatusModal(id = null) {
    const modal = document.getElementById('equipment-status-modal');
    const form = document.getElementById('equipment-status-form');
    const title = document.getElementById('equipment-status-modal-title');
    
    form.reset();
    document.getElementById('equipment-status-id').value = '';
    
    if (id) {
        const status = allEquipmentStatuses.find(s => s.id === id);
        if (status) {
            title.textContent = 'Edit Equipment Status';
            document.getElementById('equipment-status-id').value = status.id;
            document.getElementById('equipment-status-name').value = status.name;
            document.getElementById('equipment-status-description').value = status.description || '';
        }
    } else {
        title.textContent = 'Add Equipment Status';
    }
    
    modal.classList.add('active');
}

function closeEquipmentStatusModal() {
    document.getElementById('equipment-status-modal').classList.remove('active');
}

async function saveEquipmentStatus(e) {
    e.preventDefault();
    const id = document.getElementById('equipment-status-id').value;
    const data = {
        name: document.getElementById('equipment-status-name').value,
        description: document.getElementById('equipment-status-description').value
    };

    try {
        if (id) {
            await fetch(`${API_BASE}/equipment/statuses/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
        } else {
            await fetch(`${API_BASE}/equipment/statuses`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
        }
        closeEquipmentStatusModal();
        loadEquipmentStatuses();
    } catch (error) {
        console.error('Error saving equipment status:', error);
    }
}

async function editEquipmentStatus(id) {
    openEquipmentStatusModal(id);
}

async function deleteEquipmentStatus(id) {
    if (confirm('Are you sure you want to delete this equipment status?')) {
        try {
            await fetch(`${API_BASE}/equipment/statuses/${id}`, { method: 'DELETE' });
            loadEquipmentStatuses();
        } catch (error) {
            console.error('Error deleting equipment status:', error);
        }
    }
}

// EQUIPMENTS (in Admin Settings) - Equipment Catalog
let allEquipmentsSettings = [];

async function loadEquipmentsSettings() {
    showTableLoading('equipments-settings-table-body', 'Loading equipment catalog...');
    try {
        const response = await fetch(`${API_BASE}/equipment-catalog`);
        allEquipmentsSettings = await response.json();
        renderEquipmentsSettings();
    } catch (error) {
        console.error('Error loading equipment catalog:', error);
    }
}

function renderEquipmentsSettings() {
    const tbody = document.getElementById('equipments-settings-table-body');
    tbody.innerHTML = allEquipmentsSettings.map(eq => `
        <tr>
            <td class="px-3 py-2 whitespace-nowrap">${eq.name}</td>
            <td class="px-3 py-2 whitespace-nowrap">${eq.category || '-'}</td>
            <td class="px-3 py-2 whitespace-nowrap">
                <button onclick="editEquipmentFromSettings(${eq.id})" class="text-blue-600 hover:text-blue-800 mr-2">
                    <i class="fas fa-edit"></i>
                </button>
                <button onclick="deleteEquipmentFromSettings(${eq.id})" class="text-red-600 hover:text-red-800">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        </tr>
    `).join('');
}

function openEquipmentFromSettingsModal(id = null) {
    const modal = document.getElementById('equipment-from-settings-modal');
    const form = document.getElementById('equipment-from-settings-form');
    const title = document.getElementById('equipment-from-settings-modal-title');

    form.reset();
    document.getElementById('equipment-from-settings-id').value = '';

    // Populate category dropdown
    const categorySelect = document.getElementById('equipment-from-settings-category');
    categorySelect.innerHTML = '<option value="">Select Category</option>';
    allEquipmentCategories.forEach(cat => {
        categorySelect.innerHTML += `<option value="${cat.name}">${cat.name}</option>`;
    });

    if (id) {
        const eq = allEquipmentsSettings.find(e => e.id === id);
        if (eq) {
            title.textContent = 'Edit Equipment';
            document.getElementById('equipment-from-settings-id').value = eq.id;
            document.getElementById('equipment-from-settings-name').value = eq.name;
            document.getElementById('equipment-from-settings-category').value = eq.category || '';
        }
    } else {
        title.textContent = 'Add Equipment';
    }

    modal.classList.add('active');
}

function closeEquipmentFromSettingsModal() {
    document.getElementById('equipment-from-settings-modal').classList.remove('active');
}

async function saveEquipmentFromSettings(e) {
    e.preventDefault();
    const id = document.getElementById('equipment-from-settings-id').value;
    const data = {
        name: document.getElementById('equipment-from-settings-name').value,
        category: document.getElementById('equipment-from-settings-category').value
    };

    try {
        if (id) {
            await fetch(`${API_BASE}/equipment-catalog/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
        } else {
            await fetch(`${API_BASE}/equipment-catalog`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
        }
        closeEquipmentFromSettingsModal();
        loadEquipmentsSettings();
    } catch (error) {
        console.error('Error saving equipment catalog:', error);
    }
}

async function editEquipmentFromSettings(id) {
    openEquipmentFromSettingsModal(id);
}

async function deleteEquipmentFromSettings(id) {
    if (confirm('Are you sure you want to delete this equipment?')) {
        try {
            await fetch(`${API_BASE}/equipment-catalog/${id}`, { method: 'DELETE' });
            loadEquipmentsSettings();
        } catch (error) {
            console.error('Error deleting equipment catalog:', error);
        }
    }
}

// EQUIPMENT CONDITIONS
let allEquipmentConditions = [];

async function loadEquipmentConditions() {
    showTableLoading('equipment-conditions-table-body', 'Loading equipment conditions...');
    try {
        const response = await fetch(`${API_BASE}/equipment/conditions`);
        allEquipmentConditions = await response.json();
        renderEquipmentConditions();
    } catch (error) {
        console.error('Error loading equipment conditions:', error);
    }
}

function renderEquipmentConditions() {
    const tbody = document.getElementById('equipment-conditions-table-body');
    tbody.innerHTML = allEquipmentConditions.map(cond => `
        <tr>
            <td class="px-3 py-2 whitespace-nowrap">${cond.name}</td>
            <td class="px-3 py-2 whitespace-nowrap">${cond.description || '-'}</td>
            <td class="px-3 py-2 whitespace-nowrap">
                <button onclick="editEquipmentCondition(${cond.id})" class="text-blue-600 hover:text-blue-900 mr-2">Edit</button>
                <button onclick="deleteEquipmentCondition(${cond.id})" class="text-red-600 hover:text-red-900">Delete</button>
            </td>
        </tr>
    `).join('');
}

function filterEquipmentConditions() {
    const searchTerm = (document.getElementById('equipment-conditions-search')?.value || '').toLowerCase();
    const filtered = allEquipmentConditions.filter(c =>
        !searchTerm ||
        (c.name && c.name.toLowerCase().includes(searchTerm)) ||
        (c.description && c.description.toLowerCase().includes(searchTerm))
    );
    const tbody = document.getElementById('equipment-conditions-table-body');
    tbody.innerHTML = filtered.map(cond => `
        <tr>
            <td class="px-3 py-2 whitespace-nowrap">${cond.name}</td>
            <td class="px-3 py-2 whitespace-nowrap">${cond.description || '-'}</td>
            <td class="px-3 py-2 whitespace-nowrap">
                <button onclick="editEquipmentCondition(${cond.id})" class="text-blue-600 hover:text-blue-900 mr-2">Edit</button>
                <button onclick="deleteEquipmentCondition(${cond.id})" class="text-red-600 hover:text-red-900">Delete</button>
            </td>
        </tr>
    `).join('');
}

function openEquipmentConditionModal(id = null) {
    const modal = document.getElementById('equipment-condition-modal');
    const form = document.getElementById('equipment-condition-form');
    const title = document.getElementById('equipment-condition-modal-title');

    form.reset();
    document.getElementById('equipment-condition-id').value = '';

    if (id) {
        const condition = allEquipmentConditions.find(c => c.id === id);
        if (condition) {
            document.getElementById('equipment-condition-id').value = condition.id;
            document.getElementById('equipment-condition-name').value = condition.name;
            document.getElementById('equipment-condition-description').value = condition.description || '';
            title.textContent = 'Edit Equipment Condition';
        }
    } else {
        title.textContent = 'Add Equipment Condition';
    }

    modal.classList.add('active');
}

function closeEquipmentConditionModal() {
    document.getElementById('equipment-condition-modal').classList.remove('active');
}

async function saveEquipmentCondition(e) {
    e.preventDefault();
    const id = document.getElementById('equipment-condition-id').value;
    const data = {
        name: document.getElementById('equipment-condition-name').value,
        description: document.getElementById('equipment-condition-description').value
    };

    try {
        if (id) {
            await fetch(`${API_BASE}/equipment/conditions/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
        } else {
            await fetch(`${API_BASE}/equipment/conditions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
        }
        closeEquipmentConditionModal();
        loadEquipmentConditions();
    } catch (error) {
        console.error('Error saving equipment condition:', error);
    }
}

async function editEquipmentCondition(id) {
    openEquipmentConditionModal(id);
}

async function deleteEquipmentCondition(id) {
    if (confirm('Are you sure you want to delete this equipment condition?')) {
        try {
            await fetch(`${API_BASE}/equipment/conditions/${id}`, { method: 'DELETE' });
            loadEquipmentConditions();
        } catch (error) {
            console.error('Error deleting equipment condition:', error);
        }
    }
}

// EQUIPMENT OWNERS
async function loadEquipmentOwners() {
    showTableLoading('equipment-owners-table-body', 'Loading equipment owners...');
    try {
        const response = await fetch(`${API_BASE}/equipment/owners`);
        allEquipmentOwners = await response.json();
        renderEquipmentOwners();
    } catch (error) {
        console.error('Error loading equipment owners:', error);
    }
}

function renderEquipmentOwners() {
    const tbody = document.getElementById('equipment-owners-table-body');
    tbody.innerHTML = allEquipmentOwners.map(owner => `
        <tr>
            <td class="px-3 py-2 whitespace-nowrap">${owner.name}</td>
            <td class="px-3 py-2 whitespace-nowrap">${owner.description || '-'}</td>
            <td class="px-3 py-2 whitespace-nowrap">
                <button onclick="editEquipmentOwner(${owner.id})" class="text-blue-600 hover:text-blue-800 mr-2">
                    <i class="fas fa-edit"></i>
                </button>
                <button onclick="deleteEquipmentOwner(${owner.id})" class="text-red-600 hover:text-red-800">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        </tr>
    `).join('');
}

function filterEquipmentOwners() {
    const searchTerm = (document.getElementById('equipment-owners-search')?.value || '').toLowerCase();
    const filtered = allEquipmentOwners.filter(o =>
        !searchTerm ||
        (o.name && o.name.toLowerCase().includes(searchTerm)) ||
        (o.description && o.description.toLowerCase().includes(searchTerm))
    );
    const tbody = document.getElementById('equipment-owners-table-body');
    tbody.innerHTML = filtered.map(owner => `
        <tr>
            <td class="px-3 py-2 whitespace-nowrap">${owner.name}</td>
            <td class="px-3 py-2 whitespace-nowrap">${owner.description || '-'}</td>
            <td class="px-3 py-2 whitespace-nowrap">
                <button onclick="editEquipmentOwner(${owner.id})" class="text-blue-600 hover:text-blue-800 mr-2">
                    <i class="fas fa-edit"></i>
                </button>
                <button onclick="deleteEquipmentOwner(${owner.id})" class="text-red-600 hover:text-red-800">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        </tr>
    `).join('');
}

function openEquipmentOwnerModal(id = null) {
    const modal = document.getElementById('equipment-owner-modal');
    const form = document.getElementById('equipment-owner-form');
    const title = document.getElementById('equipment-owner-modal-title');

    form.reset();
    document.getElementById('equipment-owner-id').value = '';

    if (id) {
        const owner = allEquipmentOwners.find(o => o.id === id);
        if (owner) {
            title.textContent = 'Edit Equipment Owner';
            document.getElementById('equipment-owner-id').value = owner.id;
            document.getElementById('equipment-owner-name').value = owner.name;
            document.getElementById('equipment-owner-description').value = owner.description || '';
        }
    } else {
        title.textContent = 'Add Equipment Owner';
    }

    modal.classList.add('active');
}

function closeEquipmentOwnerModal() {
    document.getElementById('equipment-owner-modal').classList.remove('active');
}

async function saveEquipmentOwner(e) {
    e.preventDefault();
    const id = document.getElementById('equipment-owner-id').value;
    const data = {
        name: document.getElementById('equipment-owner-name').value,
        description: document.getElementById('equipment-owner-description').value
    };

    try {
        if (id) {
            await fetch(`${API_BASE}/equipment/owners/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
        } else {
            await fetch(`${API_BASE}/equipment/owners`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
        }
        closeEquipmentOwnerModal();
        loadEquipmentOwners();
    } catch (error) {
        console.error('Error saving equipment owner:', error);
    }
}

async function editEquipmentOwner(id) {
    openEquipmentOwnerModal(id);
}

async function deleteEquipmentOwner(id) {
    if (confirm('Are you sure you want to delete this equipment owner?')) {
        try {
            await fetch(`${API_BASE}/equipment/owners/${id}`, { method: 'DELETE' });
            loadEquipmentOwners();
        } catch (error) {
            console.error('Error deleting equipment owner:', error);
        }
    }
}

// MODULE MANAGER / TABLE PERMISSIONS
let currentModuleManager = null;
let allModuleManagers = [];
let modulePermissions = {};

const MODULE_TABLES = {
    'equipment': [
        { key: 'equipment', label: 'Equipment List' },
        { key: 'transfers', label: 'Equipment Transfers' },
        { key: 'maintenance', label: 'Maintenance Logs' },
        { key: 'write-offs', label: 'Write Offs' },
        { key: 'spare-parts', label: 'Spare Parts' },
        { key: 'parts-items', label: 'Parts Items' },
        { key: 'parts-purchases', label: 'Parts Purchases' },
        { key: 'purchases', label: 'Equipment Purchases' }
    ],
    'hr': [
        { key: 'employees', label: 'Employees' },
        { key: 'terminated-employees', label: 'Terminated Employees' },
        { key: 'employee-transfers', label: 'Employee Transfers' },
        { key: 'payments', label: 'Payments' },
        { key: 'uniforms', label: 'Uniforms' }
    ]
};

// Module tab/subtab hierarchy for access control
const MODULE_TABS = {
    'equipment': [
        { key: 'equipment', label: 'Equipment List' },
        { key: 'transfers', label: 'Equipment Transfers' },
        { key: 'maintenance', label: 'Equipment Maintenance' },
        { key: 'spare-parts', label: 'Spare Parts' },
        { key: 'write-offs', label: 'Write Offs' },
        { key: 'returns', label: 'Equipment Returns' }
    ],
    'hr': [
        {
            key: 'employee-management',
            label: 'Employee Management',
            subtabs: [
                { key: 'add-employee', label: 'Add Employee' },
                { key: 'terminate-employee', label: 'Terminate Employee' },
                { key: 'transfer-employee', label: 'Transfer Employee' },
                { key: 'employee-documents', label: 'Employee Documents' },
                { key: 'bulk-settings', label: 'Bulk Settings' }
            ]
        },
        { key: 'accommodation-management', label: 'Accommodation Management' },
        {
            key: 'uniform-management',
            label: 'Uniform Management',
            subtabs: [
                { key: 'items', label: 'Items' },
                { key: 'purchases', label: 'Purchases' },
                { key: 'distributions', label: 'Distributions' }
            ]
        },
        {
            key: 'payment-management',
            label: 'Payment Management',
            subtabs: [
                { key: 'attendance-register', label: 'Attendance Register' },
                { key: 'leave-entry', label: 'Leave Entry' },
                { key: 'advance-payments', label: 'Advance Payments' },
                { key: 'payment-calculation', label: 'Payment Calculation' },
                { key: 'payment-history', label: 'Payment History' }
            ]
        }
    ],
    'catering': [
        { key: 'recipes', label: 'Recipes' },
        { key: 'menus', label: 'Menus' },
        { key: 'menu-assignments', label: 'Menu Assignments' },
        { key: 'ingredients', label: 'Ingredients Stock' },
        { key: 'sales', label: 'Sales' },
        { key: 'employees', label: 'Catering Employees' },
        { key: 'deployments', label: 'Employee Deployments' }
    ],
    'authorizer': [
        { key: 'equipment', label: 'Equipment Management' },
        { key: 'hr', label: 'HR Management' },
        { key: 'warehouse', label: 'Warehouse' },
        { key: 'procurement', label: 'Procurement' }
    ],
    'admin': [
        {
            key: 'contacts-settings',
            label: 'Contacts Settings',
            subtabs: [
                { key: 'contact-categories', label: 'Contact Categories' },
                { key: 'contact-statuses', label: 'Contact Statuses' },
                { key: 'assign-statuses', label: 'Assign Status' }
            ]
        },
        {
            key: 'location-settings',
            label: 'Location Settings',
            subtabs: [
                { key: 'countries', label: 'Add Country' },
                { key: 'location-types', label: 'Add Location' },
                { key: 'sub-location-types', label: 'Add Sublocation' },
                { key: 'business-types', label: 'Add Business Types' },
                { key: 'assign-business-types', label: 'Assign Business Type' }
            ]
        },
        {
            key: 'equipment-settings',
            label: 'Equipment Settings',
            subtabs: [
                { key: 'equipment-statuses', label: 'Equipment Statuses' },
                { key: 'equipment-conditions', label: 'Equipment Conditions' },
                { key: 'equipment-owners', label: 'Equipment Owners' },
                { key: 'pm-tasks', label: 'Preventive Maintenance Tasks' }
            ]
        },
        {
            key: 'warehouse-settings',
            label: 'Warehouse Settings',
            subtabs: [
                { key: 'item-categories', label: 'Item Categories' },
                { key: 'item-subcategories', label: 'Item Subcategories' },
                { key: 'item-units', label: 'Item Units' },
                { key: 'item-types', label: 'Item Types' },
                { key: 'items-list', label: 'Items List' }
            ]
        },
        {
            key: 'supplier-settings',
            label: 'Supplier Settings',
            subtabs: [
                { key: 'suppliers', label: 'Suppliers' },
                { key: 'supplier-assignments', label: 'Supplier Assignments' }
            ]
        },
        {
            key: 'hr-settings',
            label: 'HR Settings',
            subtabs: [
                { key: 'positions', label: 'Positions' },
                { key: 'departments', label: 'Departments' },
                { key: 'employee-statuses', label: 'Employee Statuses' },
                { key: 'nationalities', label: 'Nationalities' },
                { key: 'document-types', label: 'Document Types' },
                { key: 'uniform-types', label: 'Uniform Types' },
                { key: 'uniform-sizes', label: 'Uniform Sizes' },
                { key: 'remuneration-types', label: 'Remuneration Types' },
                { key: 'leave-types', label: 'Leave Types' },
                { key: 'overtime-types', label: 'Overtime Types' }
            ]
        },
        { key: 'access-control', label: 'Access Control' }
    ]
};

let moduleTabPermissions = {};
let currentModuleTabContext = { module: '', tab: '', subtab: '' };

function setCurrentModuleTabContext(module, tab, subtab) {
    currentModuleTabContext = { module: module || '', tab: tab || '', subtab: subtab || '' };
}

function getCurrentModuleTabContext() {
    return currentModuleTabContext;
}

function getTabPermKey(module, tab, subtab) {
    return [module || '', tab || '', subtab || ''].join('::');
}

function getTabPermObject(module, tab, subtab) {
    const key = getTabPermKey(module, tab, subtab);
    const defaults = { can_view: 1, can_add: 1, can_edit: 0, can_delete: 0 };
    return moduleTabPermissions[key] || defaults;
}

function hasTabPermission(module, tab, subtab) {
    if (typeof loggedInManager !== 'undefined' && loggedInManager && loggedInManager.module_name === 'admin') return true;
    if (!currentModuleManager || !module) return false;
    if (currentModuleManager.module_name !== module && currentModuleManager.module_name !== 'admin') return false;

    const subPerm = getTabPermObject(module, tab, subtab || '');
    const tabPerm = getTabPermObject(module, tab, '');

    // Specific subtab permission takes priority
    if (moduleTabPermissions[getTabPermKey(module, tab, subtab || '')] !== undefined) {
        return !!subPerm.can_view;
    }
    // Fall back to parent tab permission
    if (moduleTabPermissions[getTabPermKey(module, tab, '')] !== undefined) {
        return !!tabPerm.can_view;
    }

    // Default visible if never configured
    return true;
}

function hasTabActionPermission(module, tab, subtab, action) {
    if (typeof loggedInManager !== 'undefined' && loggedInManager && loggedInManager.module_name === 'admin') return true;
    if (!currentModuleManager || !module) return false;
    if (currentModuleManager.module_name !== module && currentModuleManager.module_name !== 'admin') return false;
    if (!action) return false;

    const subPerm = getTabPermObject(module, tab, subtab || '');
    const tabPerm = getTabPermObject(module, tab, '');

    // Helper: check if any subtab of this tab has the given action permission
    function checkSubtabsForAction(mod, tabKey, act) {
        const moduleTabs = MODULE_TABS[mod] || [];
        const tabObj = moduleTabs.find(t => t.key === tabKey);
        if (tabObj && tabObj.subtabs) {
            for (const sub of tabObj.subtabs) {
                const subKey = getTabPermKey(mod, tabKey, sub.key);
                if (moduleTabPermissions[subKey] !== undefined && moduleTabPermissions[subKey][act]) {
                    return true;
                }
            }
        }
        return false;
    }

    // Specific subtab permission takes priority
    if (moduleTabPermissions[getTabPermKey(module, tab, subtab || '')] !== undefined) {
        // If this is the parent tab (subtab is empty) and action is not can_view,
        // check subtabs for action permissions
        if (!subtab && action !== 'can_view') {
            if (subPerm[action]) return true;
            return checkSubtabsForAction(module, tab, action);
        }
        return !!subPerm[action];
    }
    // Fall back to parent tab permission
    if (moduleTabPermissions[getTabPermKey(module, tab, '')] !== undefined) {
        if (tabPerm[action]) return true;
        if (action === 'can_view') return false;
        return checkSubtabsForAction(module, tab, action);
    }

    return action === 'can_add' ? true : false;
}

function getAllowedSubtabs(module, tab) {
    if (!module || !tab) return [];
    const moduleTabs = MODULE_TABS[module];
    if (!moduleTabs) return [];
    const tabObj = moduleTabs.find(t => t.key === tab);
    if (!tabObj || !tabObj.subtabs) return [];
    return tabObj.subtabs.filter(s => hasTabPermission(module, tab, s.key)).map(s => s.key);
}

function getAllowedTabs(module) {
    if (!module) return [];
    const tabs = MODULE_TABS[module];
    if (!tabs) return [];
    return tabs.filter(t => {
        if (!t.subtabs || t.subtabs.length === 0) return hasTabPermission(module, t.key, '');
        return t.subtabs.some(s => hasTabPermission(module, t.key, s.key));
    }).map(t => t.key);
}

function tagTabButtons() {
    const mapping = [
        { section: 'equipment', tabClass: 'equipment-sub-tab', tabAttr: 'data-tab' },
        { section: 'hr', tabClass: 'hr-tab', tabAttr: 'data-tab' },
        { section: 'hr', tabClass: 'employee-management-tab', tabAttr: 'data-tab', parentTab: 'employee-management' },
        { section: 'hr', tabClass: 'uniform-tab', tabAttr: 'data-tab', parentTab: 'uniform-management' },
        { section: 'hr', tabClass: 'payment-tab', tabAttr: 'data-tab', parentTab: 'payment-management' },
        { section: 'admin', tabClass: 'admin-tab', tabAttr: 'data-tab' },
        { section: 'admin', tabClass: 'contacts-settings-tab', tabAttr: 'data-tab', parentTab: 'contacts-settings' },
        { section: 'admin', tabClass: 'location-settings-tab', tabAttr: 'data-tab', parentTab: 'location-settings' },
        { section: 'admin', tabClass: 'equipment-settings-tab', tabAttr: 'data-tab', parentTab: 'equipment-settings' },
        { section: 'admin', tabClass: 'warehouse-settings-tab', tabAttr: 'data-tab', parentTab: 'warehouse-settings' },
        { section: 'admin', tabClass: 'supplier-settings-tab', tabAttr: 'data-tab', parentTab: 'supplier-settings' },
        { section: 'admin', tabClass: 'hr-settings-tab', tabAttr: 'data-tab', parentTab: 'hr-settings' },
        { section: 'catering', tabClass: 'catering-sub-tab', tabAttr: 'data-tab' },
        { section: 'authorizer', tabClass: 'authorizer-tab', tabAttr: 'data-tab' }
    ];

    mapping.forEach(({ section, tabClass, tabAttr, parentTab }) => {
        const sectionEl = document.getElementById(`${section}-section`);
        if (!sectionEl) return;
        sectionEl.querySelectorAll(`.${tabClass}`).forEach(btn => {
            if (btn.dataset.module) return; // already tagged
            btn.dataset.module = section;
            const tab = btn.getAttribute(tabAttr);
            btn.dataset.tab = tab;
            if (parentTab) {
                btn.dataset.parentTab = parentTab;
                btn.dataset.subtab = tab;
            }
        });
    });
}

function applyTabPermissionVisibility() {
    tagTabButtons();

    // Hide tab buttons that are not allowed
    document.querySelectorAll('[data-module][data-tab]').forEach(btn => {
        const module = btn.dataset.module;
        const tab = btn.dataset.tab;
        const subtab = btn.dataset.subtab || '';
        if (!hasTabPermission(module, tab, subtab)) {
            btn.style.display = 'none';
        } else {
            btn.style.display = '';
        }
    });

    // Hide parent tab content if no subtabs are allowed
    Object.keys(MODULE_TABS).forEach(module => {
        MODULE_TABS[module].forEach(tabObj => {
            if (!tabObj.subtabs || tabObj.subtabs.length === 0) return;
            const allowedSubtabs = getAllowedSubtabs(module, tabObj.key);
            const contentEl = document.getElementById(`${module}-${tabObj.key}-tab`) ||
                              document.getElementById(`${tabObj.key}-${module}-tab`);
            const tabBtn = document.querySelector(`[data-module="${module}"][data-tab="${tabObj.key}"]:not([data-subtab])`);
            if (allowedSubtabs.length === 0) {
                if (contentEl) contentEl.style.display = 'none';
                if (tabBtn) tabBtn.style.display = 'none';
            }
        });
    });
}

async function loadCurrentModuleTabPermissions() {
    if (!currentModuleManager) return;
    try {
        const response = await fetch(`${API_BASE}/module-tab-permissions/${currentModuleManager.id}`);
        const rows = await response.json();
        rows.forEach(p => {
            moduleTabPermissions[getTabPermKey(p.module_name, p.tab_key, p.subtab_key || '')] = {
                can_view: p.can_view,
                can_add: p.can_add,
                can_edit: p.can_edit,
                can_delete: p.can_delete
            };
        });
    } catch (error) {
        console.error('Error loading module tab permissions:', error);
    }
}

function getCurrentModuleManager() {
    if (!currentModuleManager) {
        const saved = localStorage.getItem('mwh_current_module_manager');
        if (saved) {
            try {
                currentModuleManager = JSON.parse(saved);
            } catch (e) {}
        }
    }
    return currentModuleManager;
}

async function setCurrentModuleManager(managerId) {
    if (!managerId) {
        currentModuleManager = null;
        localStorage.removeItem('mwh_current_module_manager');
        updateCurrentModuleManagerUI();
        reloadCurrentSection();
        return;
    }
    try {
        const response = await fetch(`${API_BASE}/module-managers/${managerId}`);
        const manager = await response.json();
        if (manager) {
            currentModuleManager = manager;
            localStorage.setItem('mwh_current_module_manager', JSON.stringify(manager));
        }
    } catch (error) {
        console.error('Error loading module manager:', error);
    }
    updateCurrentModuleManagerUI();
    await loadCurrentModulePermissions();
    await loadCurrentModuleTabPermissions();
    applyTabPermissionVisibility();
    reloadCurrentSection();
}

function updateCurrentModuleManagerUI() {
    // User selector removed; module manager is now taken from the login session
}

function reloadCurrentSection() {
    applyDataPermissionVisibility();
    const equipmentSection = document.getElementById('equipment-section');
    if (equipmentSection && equipmentSection.style.display === 'block') {
        if (typeof loadEquipment === 'function') loadEquipment();
        if (typeof loadTransfers === 'function') loadTransfers();
        if (typeof loadMaintenance === 'function') loadMaintenance();
        if (typeof loadWriteOffs === 'function') loadWriteOffs();
    }
    const hrSection = document.getElementById('hr-section');
    if (hrSection && hrSection.style.display === 'block') {
        if (typeof loadEmployees === 'function') loadEmployees();
        if (typeof loadEmployeeTransfers === 'function') loadEmployeeTransfers();
    }
    const adminSection = document.getElementById('admin-section');
    if (adminSection && adminSection.style.display === 'block') {
        const accessTab = document.getElementById('admin-access-control-tab');
        if (accessTab && accessTab.style.display !== 'none') {
            loadAccessControl();
        }
    }
}

async function loadModuleManagers() {
    try {
        const response = await fetch(`${API_BASE}/module-managers`);
        const data = await response.json();
        allModuleManagers = Array.isArray(data) ? data : [];
        renderAccessControl();
    } catch (error) {
        console.error('Error loading module managers:', error);
    }
}

function populateModuleManagerSelect() {
    const select = document.getElementById('current-module-manager-select');
    if (!select) return;
    const isAdmin = typeof loggedInManager !== 'undefined' && loggedInManager && loggedInManager.module_name === 'admin';
    select.innerHTML = '<option value="">Select module manager</option>';
    allModuleManagers.forEach(manager => {
        if (!isAdmin && manager.id !== (loggedInManager && loggedInManager.id)) {
            return;
        }
        const option = document.createElement('option');
        option.value = manager.id;
        option.textContent = manager.name;
        select.appendChild(option);
    });
    if (currentModuleManager) select.value = currentModuleManager.id;
}

async function loadCurrentModulePermissions() {
    modulePermissions = {};
    moduleTabPermissions = {};
    if (!currentModuleManager) return;
    try {
        const [tableRes, tabRes] = await Promise.all([
            fetch(`${API_BASE}/module-table-permissions/${currentModuleManager.id}`),
            fetch(`${API_BASE}/module-tab-permissions/${currentModuleManager.id}`)
        ]);
        const tableRows = await tableRes.json();
        const tabRows = await tabRes.json();
        tableRows.forEach(p => {
            modulePermissions[p.table_name] = { can_add: p.can_add, can_edit: p.can_edit, can_delete: p.can_delete };
        });
        tabRows.forEach(p => {
            moduleTabPermissions[getTabPermKey(p.module_name, p.tab_key, p.subtab_key || '')] = {
                can_view: p.can_view,
                can_add: p.can_add,
                can_edit: p.can_edit,
                can_delete: p.can_delete
            };
        });
    } catch (error) {
        console.error('Error loading module permissions:', error);
    }
}

function hasTablePermission(tableName, action) {
    if (typeof loggedInManager !== 'undefined' && loggedInManager && loggedInManager.module_name === 'admin') return true;
    if (!currentModuleManager) return false;

    // When inside a specific tab/subtab, that tab's action permission is the source of truth
    if (currentModuleTabContext && currentModuleTabContext.module) {
        const result = hasTabActionPermission(currentModuleTabContext.module, currentModuleTabContext.tab, currentModuleTabContext.subtab, 'can_' + action);
        if (tableName === 'employees' && action !== 'add') {
            console.log('[DEBUG] hasTablePermission', tableName, action, '->', result, '| ctx:', JSON.stringify(currentModuleTabContext), '| perm:', JSON.stringify(moduleTabPermissions[getTabPermKey(currentModuleTabContext.module, currentModuleTabContext.tab, currentModuleTabContext.subtab)]));
        }
        return result;
    }

    // Fallback to legacy table permissions when no tab context is available
    const p = modulePermissions[tableName];
    if (!p) return false;
    if (action === 'add') return p.can_add;
    if (action === 'delete') return p.can_delete;
    return p.can_edit;
}

function getAddActionButton(tableName, html) {
    if (hasTablePermission(tableName, 'add')) {
        return html;
    }
    return '';
}

function applyDataPermissionVisibility() {
    document.querySelectorAll('[data-permission]').forEach(el => {
        const perm = el.getAttribute('data-permission');
        const [table, action] = perm.split(':');
        if (!hasTablePermission(table, action)) {
            el.style.display = 'none';
        } else {
            el.style.display = '';
        }
    });
}

function getEditActionButton(tableName, editFnName, id) {
    if (hasTablePermission(tableName, 'edit')) {
        return `<button onclick="${editFnName}(${id})" class="text-blue-600 hover:text-blue-800 mr-2" title="Edit"><i class="fas fa-edit"></i></button>`;
    }
    return '';
}

function getDeleteActionButton(tableName, deleteFnName, id) {
    if (hasTablePermission(tableName, 'delete')) {
        return `<button onclick="${deleteFnName}(${id})" class="text-red-600 hover:text-red-800" title="Delete"><i class="fas fa-trash"></i></button>`;
    }
    return '';
}

async function loadAccessControl() {
    await loadModuleManagers();
}

let _renderAccessControlToken = 0;
async function renderAccessControl() {
    const container = document.getElementById('access-control-modules-container');
    if (!container) return;
    const token = ++_renderAccessControlToken;
    container.innerHTML = '';

    const grid = document.createElement('div');
    grid.className = 'grid grid-cols-2 gap-4';

    for (const manager of allModuleManagers) {
        if (token !== _renderAccessControlToken) return; // abort if superseded
        const tabs = MODULE_TABS[manager.module_name] || [];
        const tabRes = await fetch(`${API_BASE}/module-tab-permissions/${manager.id}`);
        const tabPerms = await tabRes.json();

        const tabPermMap = {};
        tabPerms.forEach(p => {
            tabPermMap[getTabPermKey(p.module_name, p.tab_key, p.subtab_key || '')] = {
                can_view: p.can_view,
                can_add: p.can_add,
                can_edit: p.can_edit,
                can_delete: p.can_delete
            };
        });

        const getPerm = (module, tab, subtab) => {
            const key = getTabPermKey(module, tab, subtab || '');
            return tabPermMap[key] || { can_view: 1, can_add: 1, can_edit: 0, can_delete: 0 };
        };

        const makeCheck = (managerId, module, tab, subtab, action, checked) =>
            `<input type="checkbox" ${checked ? 'checked' : ''} data-mgr="${managerId}" data-tab="${tab}" data-subtab="${subtab}" data-action="${action}" onchange="toggleTabPermission(${managerId}, '${module}', '${tab}', '${subtab}', '${action}', this.checked)">`;

        const makeActionCells = (p, managerId, module, tab, subtab) => `
            <td class="px-1 py-1 text-center">${makeCheck(managerId, module, tab, subtab, 'add', p.can_add)}</td>
            <td class="px-1 py-1 text-center">${makeCheck(managerId, module, tab, subtab, 'edit', p.can_edit)}</td>
            <td class="px-1 py-1 text-center">${makeCheck(managerId, module, tab, subtab, 'delete', p.can_delete)}</td>
        `;

        let tabRows = '';
        tabs.forEach(tab => {
            const p = getPerm(manager.module_name, tab.key, '');
            const hasSubtabs = tab.subtabs && tab.subtabs.length > 0;

            tabRows += `
                <tr class="bg-gray-50 border-b border-gray-100">
                    <td class="px-3 py-1.5 text-xs font-semibold text-gray-700">${tab.label}</td>
                    <td class="px-1 py-1 text-center">${makeCheck(manager.id, manager.module_name, tab.key, '', 'view', p.can_view)}</td>
                    ${hasSubtabs ? '<td class="px-1 py-1 text-center" colspan="3"></td>' : makeActionCells(p, manager.id, manager.module_name, tab.key, '')}
                </tr>`;

            if (hasSubtabs) {
                tab.subtabs.forEach(sub => {
                    const sp = getPerm(manager.module_name, tab.key, sub.key);
                    tabRows += `
                        <tr class="border-b border-gray-50 hover:bg-gray-50">
                            <td class="px-3 py-1 text-xs text-gray-600 pl-6">${sub.label}</td>
                            <td class="px-1 py-1 text-center">${makeCheck(manager.id, manager.module_name, tab.key, sub.key, 'view', sp.can_view)}</td>
                            ${makeActionCells(sp, manager.id, manager.module_name, tab.key, sub.key)}
                        </tr>`;
                });
            }
        });

        const card = document.createElement('div');
        card.className = 'bg-white rounded-lg border shadow-sm';

        // Fetch location filters for equipment managers
        let locationFilterHtml = '';
        let ownerFilterHtml = '';
        let columnVisibilityHtml = '';
        if (manager.module_name === 'equipment') {
            let allowedIds = [];
            try { allowedIds = await loadManagerLocationFilters(manager.id); } catch(e) {}
            let btaRows = '';
            try {
                const btaRes = await fetch(`${API_BASE}/business-type-assignments`);
                const btaList = await btaRes.json();
                btaList.forEach(bta => {
                    const label = [bta.country_name, bta.location_name, bta.sub_location_name, bta.business_type_name, bta.business_unit_code].filter(Boolean).join(' - ');
                    const checked = allowedIds.includes(bta.id) ? 'checked' : '';
                    btaRows += `<label class="flex items-center gap-1.5 text-xs text-gray-600 py-0.5"><input type="checkbox" name="loc-filter-${manager.id}" value="${bta.id}" ${checked}> ${label}</label>`;
                });
            } catch(e) {}
            locationFilterHtml = `
                <div class="px-3 py-2 border-t bg-gray-50">
                    <div class="flex items-center justify-between mb-1">
                        <span class="text-xs font-semibold text-gray-600">Allowed Locations (empty = all)</span>
                        <div class="flex gap-1">
                            <button onclick="toggleAllLocationFilters(${manager.id}, true)" class="bg-gray-200 text-gray-700 text-xs px-2 py-0.5 rounded hover:bg-gray-300">Select All</button>
                            <button onclick="toggleAllLocationFilters(${manager.id}, false)" class="bg-gray-200 text-gray-700 text-xs px-2 py-0.5 rounded hover:bg-gray-300">Clear</button>
                            <button onclick="saveManagerLocationFilters(${manager.id})" class="bg-blue-600 text-white text-xs px-2 py-0.5 rounded hover:bg-blue-700">Save Locations</button>
                        </div>
                    </div>
                    <div class="max-h-32 overflow-y-auto grid grid-cols-2 gap-x-3">${btaRows || '<span class="text-xs text-gray-400">No locations available</span>'}</div>
                </div>`;

            let allowedOwnerIds = [];
            try { allowedOwnerIds = await loadManagerOwnerFilters(manager.id); } catch(e) {}
            let ownerRows = '';
            try {
                const ownerRes = await fetch(`${API_BASE}/equipment/owners`);
                const ownerList = await ownerRes.json();
                ownerList.forEach(o => {
                    const checked = allowedOwnerIds.includes(o.id) ? 'checked' : '';
                    ownerRows += `<label class="flex items-center gap-1.5 text-xs text-gray-600 py-0.5"><input type="checkbox" name="owner-filter-${manager.id}" value="${o.id}" ${checked}> ${o.name}</label>`;
                });
            } catch(e) {}
            ownerFilterHtml = `
                <div class="px-3 py-2 border-t bg-gray-50">
                    <div class="flex items-center justify-between mb-1">
                        <span class="text-xs font-semibold text-gray-600">Allowed Owners (empty = all)</span>
                        <div class="flex gap-1">
                            <button onclick="toggleAllOwnerFilters(${manager.id}, true)" class="bg-gray-200 text-gray-700 text-xs px-2 py-0.5 rounded hover:bg-gray-300">Select All</button>
                            <button onclick="toggleAllOwnerFilters(${manager.id}, false)" class="bg-gray-200 text-gray-700 text-xs px-2 py-0.5 rounded hover:bg-gray-300">Clear</button>
                            <button onclick="saveManagerOwnerFilters(${manager.id})" class="bg-blue-600 text-white text-xs px-2 py-0.5 rounded hover:bg-blue-700">Save Owners</button>
                        </div>
                    </div>
                    <div class="max-h-32 overflow-y-auto grid grid-cols-2 gap-x-3">${ownerRows || '<span class="text-xs text-gray-400">No owners available</span>'}</div>
                </div>`;
        }

        // Generic column visibility controls for all tabs/subtabs with columns defined
        const modTabs = MODULE_TABS[manager.module_name] || [];
        for (const tab of modTabs) {
            // Check tab itself
            if (TAB_COLUMNS[tab.key] && TAB_COLUMNS[tab.key].columns.length > 0) {
                const tc = TAB_COLUMNS[tab.key];
                let colRows = '';
                try {
                    const colRes = await fetch(`${API_BASE}/column-visibility/${manager.id}?tab_key=${tab.key}`);
                    const colList = await colRes.json();
                    const colMap = {};
                    colList.forEach(c => { colMap[c.column_key] = c.is_visible; });
                    colRows = tc.columns.map(col => {
                        const isVisible = colMap[col.key] !== undefined ? colMap[col.key] : 1;
                        return `<label class="flex items-center gap-1.5 text-xs text-gray-600 py-0.5"><input type="checkbox" name="col-vis-${manager.id}-${tab.key}" data-col-key="${col.key}" ${isVisible ? 'checked' : ''}> ${col.label}</label>`;
                    }).join('');
                } catch(e) {}
                columnVisibilityHtml += `
                <div class="px-3 py-2 border-t bg-gray-50">
                    <div class="flex items-center justify-between mb-1">
                        <span class="text-xs font-semibold text-gray-600">${tc.label} Column Visibility</span>
                        <div class="flex gap-1">
                            <button onclick="toggleAllColumnVisibilityTab(${manager.id}, '${tab.key}', true)" class="bg-gray-200 text-gray-700 text-xs px-2 py-0.5 rounded hover:bg-gray-300">Select All</button>
                            <button onclick="toggleAllColumnVisibilityTab(${manager.id}, '${tab.key}', false)" class="bg-gray-200 text-gray-700 text-xs px-2 py-0.5 rounded hover:bg-gray-300">Clear</button>
                            <button onclick="saveColumnVisibility(${manager.id}, '${manager.module_name}', '${tab.key}')" class="bg-blue-600 text-white text-xs px-2 py-0.5 rounded hover:bg-blue-700">Save</button>
                        </div>
                    </div>
                    <div class="max-h-32 overflow-y-auto grid grid-cols-3 gap-x-3">${colRows || '<span class="text-xs text-gray-400">No columns available</span>'}</div>
                </div>`;
            }
            // Check subtabs
            if (tab.subtabs) {
                for (const sub of tab.subtabs) {
                    if (TAB_COLUMNS[sub.key] && TAB_COLUMNS[sub.key].columns.length > 0) {
                        const tc = TAB_COLUMNS[sub.key];
                        let colRows = '';
                        try {
                            const colRes = await fetch(`${API_BASE}/column-visibility/${manager.id}?tab_key=${sub.key}`);
                            const colList = await colRes.json();
                            const colMap = {};
                            colList.forEach(c => { colMap[c.column_key] = c.is_visible; });
                            colRows = tc.columns.map(col => {
                                const isVisible = colMap[col.key] !== undefined ? colMap[col.key] : 1;
                                return `<label class="flex items-center gap-1.5 text-xs text-gray-600 py-0.5"><input type="checkbox" name="col-vis-${manager.id}-${sub.key}" data-col-key="${col.key}" ${isVisible ? 'checked' : ''}> ${col.label}</label>`;
                            }).join('');
                        } catch(e) {}
                        columnVisibilityHtml += `
                        <div class="px-3 py-2 border-t bg-gray-50">
                            <div class="flex items-center justify-between mb-1">
                                <span class="text-xs font-semibold text-gray-600">${tc.label} Column Visibility</span>
                                <div class="flex gap-1">
                                    <button onclick="toggleAllColumnVisibilityTab(${manager.id}, '${sub.key}', true)" class="bg-gray-200 text-gray-700 text-xs px-2 py-0.5 rounded hover:bg-gray-300">Select All</button>
                                    <button onclick="toggleAllColumnVisibilityTab(${manager.id}, '${sub.key}', false)" class="bg-gray-200 text-gray-700 text-xs px-2 py-0.5 rounded hover:bg-gray-300">Clear</button>
                                    <button onclick="saveColumnVisibility(${manager.id}, '${manager.module_name}', '${sub.key}')" class="bg-blue-600 text-white text-xs px-2 py-0.5 rounded hover:bg-blue-700">Save</button>
                                </div>
                            </div>
                            <div class="max-h-32 overflow-y-auto grid grid-cols-3 gap-x-3">${colRows || '<span class="text-xs text-gray-400">No columns available</span>'}</div>
                        </div>`;
                    }
                }
            }
        }

        // Delete button for non-admin managers
        const deleteBtn = manager.module_name !== 'admin'
            ? `<button onclick="deleteManager(${manager.id}, '${manager.name.replace(/'/g, "\\'")}')" class="bg-red-600 text-white text-xs px-2 py-0.5 rounded hover:bg-red-700 ml-1">Delete</button>`
            : '';

        card.innerHTML = `
            <div class="px-3 py-2 border-b bg-gray-50 rounded-t-lg">
                <div class="flex items-center justify-between">
                    <span class="text-sm font-semibold text-gray-800">${manager.name}
                        <span class="text-xs font-normal text-gray-400 ml-1">${manager.module_name || ''}</span>
                    </span>
                    <div class="flex gap-1 items-center">
                        <input type="password" id="manager-password-${manager.id}" placeholder="New password" class="border rounded px-2 py-0.5 text-xs w-28">
                        <button onclick="setManagerPassword(${manager.id})" class="bg-indigo-600 text-white text-xs px-2 py-0.5 rounded hover:bg-indigo-700">Set PW</button>
                        ${deleteBtn}
                    </div>
                </div>
                <div class="flex items-center gap-1 mt-1.5">
                    <span class="text-xs text-gray-400 w-16 flex-shrink-0">Login ID:</span>
                    <input type="text" id="manager-loginid-${manager.id}" value="${manager.login_id || ''}" placeholder="Set login ID" class="border rounded px-2 py-0.5 text-xs flex-1">
                    <button onclick="setManagerLoginId(${manager.id})" class="bg-green-600 text-white text-xs px-2 py-0.5 rounded hover:bg-green-700 whitespace-nowrap">Set ID</button>
                </div>
            </div>
            <table class="w-full text-xs">
                <thead>
                    <tr class="text-gray-400 border-b">
                        <th class="px-3 py-1 text-left font-medium">Tab / Subtab</th>
                        <th class="px-1 py-1 text-center font-medium w-10">View</th>
                        <th class="px-1 py-1 text-center font-medium w-10">Add</th>
                        <th class="px-1 py-1 text-center font-medium w-10">Edit</th>
                        <th class="px-1 py-1 text-center font-medium w-10">Delete</th>
                    </tr>
                </thead>
                <tbody class="divide-y divide-gray-100">${tabRows}</tbody>
            </table>
            <div class="px-3 py-2 border-t bg-gray-50 flex justify-end">
                <button onclick="saveAllPermissions(${manager.id}, '${manager.module_name}')" class="bg-green-600 text-white text-xs px-3 py-1 rounded hover:bg-green-700">Save All Permissions</button>
            </div>
            ${locationFilterHtml}
            ${ownerFilterHtml}
            ${columnVisibilityHtml}`;

        grid.appendChild(card);
    }

    if (token !== _renderAccessControlToken) return; // abort if superseded
    container.appendChild(grid);
}

async function setManagerLoginId(managerId) {
    const input = document.getElementById(`manager-loginid-${managerId}`);
    const login_id = input.value.trim();
    if (!login_id || login_id.length < 3) {
        alert('Login ID must be at least 3 characters.');
        return;
    }
    try {
        const response = await fetch(`${API_BASE}/module-managers/${managerId}/login-id`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ login_id })
        });
        const data = await response.json();
        if (response.ok) {
            alert('Login ID updated successfully.');
        } else {
            alert('Error: ' + (data.error || 'Could not update Login ID.'));
        }
    } catch (error) {
        console.error('Error setting login ID:', error);
        alert('Error setting Login ID.');
    }
}

async function setManagerPassword(managerId) {
    const input = document.getElementById(`manager-password-${managerId}`);
    const password = input.value;
    if (!password || password.length < 4) {
        alert('Password must be at least 4 characters.');
        return;
    }
    try {
        const response = await fetch(`${API_BASE}/module-managers/${managerId}/password`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ password })
        });
        const data = await response.json();
        if (response.ok) {
            alert('Password updated successfully.');
            input.value = '';
        } else {
            alert('Error: ' + (data.error || 'Could not update password.'));
        }
    } catch (error) {
        console.error('Error setting password:', error);
        alert('Error setting password.');
    }
}

async function saveAllPermissions(managerId, moduleName) {
    const tabs = MODULE_TABS[moduleName] || [];
    let saved = 0;
    for (const tab of tabs) {
        const viewCb = document.querySelector(`input[data-mgr="${managerId}"][data-tab="${tab.key}"][data-subtab=""][data-action="view"]`);
        const addCb = document.querySelector(`input[data-mgr="${managerId}"][data-tab="${tab.key}"][data-subtab=""][data-action="add"]`);
        const editCb = document.querySelector(`input[data-mgr="${managerId}"][data-tab="${tab.key}"][data-subtab=""][data-action="edit"]`);
        const delCb = document.querySelector(`input[data-mgr="${managerId}"][data-tab="${tab.key}"][data-subtab=""][data-action="delete"]`);
        const body = {
            module_name: moduleName,
            tab_key: tab.key,
            subtab_key: '',
            can_view: viewCb && viewCb.checked ? 1 : 0,
            can_add: addCb && addCb.checked ? 1 : 0,
            can_edit: editCb && editCb.checked ? 1 : 0,
            can_delete: delCb && delCb.checked ? 1 : 0
        };
        await fetch(`${API_BASE}/module-tab-permissions/${managerId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
        saved++;
        if (tab.subtabs) {
            for (const sub of tab.subtabs) {
                const sViewCb = document.querySelector(`input[data-mgr="${managerId}"][data-tab="${tab.key}"][data-subtab="${sub.key}"][data-action="view"]`);
                const sAddCb = document.querySelector(`input[data-mgr="${managerId}"][data-tab="${tab.key}"][data-subtab="${sub.key}"][data-action="add"]`);
                const sEditCb = document.querySelector(`input[data-mgr="${managerId}"][data-tab="${tab.key}"][data-subtab="${sub.key}"][data-action="edit"]`);
                const sDelCb = document.querySelector(`input[data-mgr="${managerId}"][data-tab="${tab.key}"][data-subtab="${sub.key}"][data-action="delete"]`);
                const sBody = {
                    module_name: moduleName,
                    tab_key: tab.key,
                    subtab_key: sub.key,
                    can_view: sViewCb && sViewCb.checked ? 1 : 0,
                    can_add: sAddCb && sAddCb.checked ? 1 : 0,
                    can_edit: sEditCb && sEditCb.checked ? 1 : 0,
                    can_delete: sDelCb && sDelCb.checked ? 1 : 0
                };
                await fetch(`${API_BASE}/module-tab-permissions/${managerId}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(sBody)
                });
                saved++;
            }
        }
    }
    alert(`Saved ${saved} permission${saved !== 1 ? 's' : ''} successfully.`);
}

async function toggleTabPermission(managerId, moduleName, tabKey, subtabKey, action, checked) {
    try {
        const body = {
            module_name: moduleName,
            tab_key: tabKey,
            subtab_key: subtabKey
        };
        if (action === 'view') body.can_view = checked ? 1 : 0;
        else if (action === 'add') body.can_add = checked ? 1 : 0;
        else if (action === 'edit') body.can_edit = checked ? 1 : 0;
        else if (action === 'delete') body.can_delete = checked ? 1 : 0;

        const response = await fetch(`${API_BASE}/module-tab-permissions/${managerId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
        if (!response.ok) {
            const err = await response.json();
            alert('Error updating tab permission: ' + (err.error || 'Unknown error'));
            await loadAccessControl();
        } else if (currentModuleManager && currentModuleManager.id === managerId) {
            await loadCurrentModulePermissions();
            applyTabPermissionVisibility();
            reloadCurrentSection();
        }
    } catch (error) {
        console.error('Error toggling tab permission:', error);
        await loadAccessControl();
    }
}

async function toggleTablePermission(managerId, tableName, action, checked) {
    try {
        const field = action === 'add' ? 'can_add' : action === 'edit' ? 'can_edit' : 'can_delete';
        const response = await fetch(`${API_BASE}/module-table-permissions/${managerId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ table_name: tableName, [field]: checked ? 1 : 0 })
        });
        if (!response.ok) {
            const err = await response.json();
            alert('Error updating permission: ' + (err.error || 'Unknown error'));
            await loadAccessControl();
        } else if (currentModuleManager && currentModuleManager.id === managerId) {
            await loadCurrentModulePermissions();
            reloadCurrentSection();
        }
    } catch (error) {
        console.error('Error toggling permission:', error);
        await loadAccessControl();
    }
}

// Initialize on load
getCurrentModuleManager();
loadModuleManagers().then(() => {
    updateCurrentModuleManagerUI();
    if (currentModuleManager) {
        loadCurrentModulePermissions().then(() => {
            applyDataPermissionVisibility();
            tagTabButtons();
            applyTabPermissionVisibility();
        });
    } else {
        applyDataPermissionVisibility();
        tagTabButtons();
        applyTabPermissionVisibility();
    }
});

// ---- Add New Manager ----
function showAddManagerModal() {
    const modal = document.getElementById('add-manager-modal');
    if (modal) {
        modal.classList.remove('hidden');
        modal.classList.add('flex');
    }
}

function closeAddManagerModal() {
    const modal = document.getElementById('add-manager-modal');
    if (modal) {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    }
    document.getElementById('new-manager-name').value = '';
    document.getElementById('new-manager-login-id').value = '';
    document.getElementById('new-manager-password').value = '';
}

async function createNewManager() {
    const name = document.getElementById('new-manager-name').value.trim();
    const module_name = document.getElementById('new-manager-module').value;
    const login_id = document.getElementById('new-manager-login-id').value.trim();
    const password = document.getElementById('new-manager-password').value;

    if (!name || !login_id || !password) {
        alert('All fields are required.');
        return;
    }
    if (login_id.length < 3) {
        alert('Login ID must be at least 3 characters.');
        return;
    }
    if (password.length < 4) {
        alert('Password must be at least 4 characters.');
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/module-managers`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, module_name, login_id, password })
        });
        const data = await response.json();
        if (response.ok) {
            const newManagerId = data.id;
            // Initialize default tab permissions for all tabs in this module
            const tabs = MODULE_TABS[module_name] || [];
            for (const tab of tabs) {
                await fetch(`${API_BASE}/module-tab-permissions/${newManagerId}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ module_name, tab_key: tab.key, subtab_key: '', can_view: 1, can_add: 1, can_edit: 0, can_delete: 0 })
                });
                if (tab.subtabs) {
                    for (const sub of tab.subtabs) {
                        await fetch(`${API_BASE}/module-tab-permissions/${newManagerId}`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ module_name, tab_key: tab.key, subtab_key: sub.key, can_view: 1, can_add: 1, can_edit: 0, can_delete: 0 })
                        });
                    }
                }
            }
            closeAddManagerModal();
            await loadAccessControl();
            renderAccessControl();
            alert('Manager created successfully with default permissions.');
        } else {
            alert('Error: ' + (data.error || 'Could not create manager.'));
        }
    } catch (error) {
        console.error('Error creating manager:', error);
        alert('Error creating manager.');
    }
}

// ---- Delete Manager ----
async function deleteManager(managerId, managerName) {
    if (!confirm(`Delete manager "${managerName}"? This cannot be undone.`)) return;
    try {
        const response = await fetch(`${API_BASE}/module-managers/${managerId}`, { method: 'DELETE' });
        const data = await response.json();
        if (response.ok) {
            await loadAccessControl();
            renderAccessControl();
            alert('Manager deleted.');
        } else {
            alert('Error: ' + (data.error || 'Could not delete manager.'));
        }
    } catch (error) {
        console.error('Error deleting manager:', error);
        alert('Error deleting manager.');
    }
}

// ---- Location Filters for Equipment Managers ----
async function loadManagerLocationFilters(managerId) {
    try {
        const res = await fetch(`${API_BASE}/module-managers/${managerId}/location-filters`);
        return await res.json();
    } catch (e) {
        console.error('Error loading location filters:', e);
        return [];
    }
}

async function saveManagerLocationFilters(managerId) {
    const checkboxes = document.querySelectorAll(`input[name="loc-filter-${managerId}"]:checked`);
    const location_ids = Array.from(checkboxes).map(cb => parseInt(cb.value));
    try {
        const response = await fetch(`${API_BASE}/module-managers/${managerId}/location-filters`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ location_ids })
        });
        const data = await response.json();
        if (response.ok) {
            alert('Location filters saved.');
        } else {
            alert('Error: ' + (data.error || 'Could not save location filters.'));
        }
    } catch (error) {
        console.error('Error saving location filters:', error);
        alert('Error saving location filters.');
    }
}

function toggleAllLocationFilters(managerId, checked) {
    document.querySelectorAll(`input[name="loc-filter-${managerId}"]`).forEach(cb => { cb.checked = checked; });
}

// ---- Owner Filters for Equipment Managers ----
async function loadManagerOwnerFilters(managerId) {
    try {
        const res = await fetch(`${API_BASE}/module-managers/${managerId}/owner-filters`);
        return await res.json();
    } catch (e) {
        console.error('Error loading owner filters:', e);
        return [];
    }
}

async function saveManagerOwnerFilters(managerId) {
    const checkboxes = document.querySelectorAll(`input[name="owner-filter-${managerId}"]:checked`);
    const owner_ids = Array.from(checkboxes).map(cb => parseInt(cb.value));
    try {
        const response = await fetch(`${API_BASE}/module-managers/${managerId}/owner-filters`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ owner_ids })
        });
        const data = await response.json();
        if (response.ok) {
            alert('Owner filters saved.');
        } else {
            alert('Error: ' + (data.error || 'Could not save owner filters.'));
        }
    } catch (error) {
        console.error('Error saving owner filters:', error);
        alert('Error saving owner filters.');
    }
}

function toggleAllOwnerFilters(managerId, checked) {
    document.querySelectorAll(`input[name="owner-filter-${managerId}"]`).forEach(cb => { cb.checked = checked; });
}

// COLUMN VISIBILITY (access control)
function toggleAllColumnVisibility(managerId, checked) {
    document.querySelectorAll(`input[name="col-vis-${managerId}"]`).forEach(cb => { cb.checked = checked; });
}

function toggleAllColumnVisibilityTab(managerId, tabKey, checked) {
    document.querySelectorAll(`input[name="col-vis-${managerId}-${tabKey}"]`).forEach(cb => { cb.checked = checked; });
}

async function saveColumnVisibility(managerId, moduleName, tabKey) {
    // Support both tab-specific (hr) and generic (equipment) checkbox names
    const checkboxName = `col-vis-${managerId}-${tabKey}`;
    let checkboxes = document.querySelectorAll(`input[name="${checkboxName}"]`);
    if (checkboxes.length === 0) {
        checkboxes = document.querySelectorAll(`input[name="col-vis-${managerId}"]`);
    }
    const columns = Array.from(checkboxes).map(cb => ({
        column_key: cb.getAttribute('data-col-key'),
        is_visible: cb.checked ? 1 : 0
    }));
    try {
        const response = await fetch(`${API_BASE}/column-visibility/${managerId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ module_name: moduleName, tab_key: tabKey, columns })
        });
        const data = await response.json();
        if (response.ok) {
            alert('Column visibility saved.');
        } else {
            alert('Error: ' + (data.error || 'Could not save column visibility.'));
        }
    } catch (error) {
        console.error('Error saving column visibility:', error);
        alert('Error saving column visibility.');
    }
}

// EQUIPMENT COLUMN SETTINGS
const EQUIPMENT_COLUMNS = [
    { key: 'serial',             label: '#',                      default: true  },
    { key: 'actions',            label: 'Actions',                default: true  },
    { key: 'auto_serial',        label: 'Auto Serial',            default: true  },
    { key: 'thumbnail',          label: 'Thumbnail',              default: true  },
    { key: 'name',               label: 'Name',                   default: true  },
    { key: 'brand',              label: 'Brand',                  default: false },
    { key: 'model',              label: 'Model',                  default: false },
    { key: 'barcode',            label: 'Barcode',                default: true  },
    { key: 'serial_number',      label: 'Serial Number',          default: true  },
    { key: 'category',           label: 'Category',               default: true  },
    { key: 'specification',      label: 'Specification',          default: false },
    { key: 'condition',          label: 'Condition',              default: false },
    { key: 'po_number',                 label: 'PO Number',                 default: true  },
    { key: 'country',                   label: 'Country',                   default: true  },
    { key: 'location',                  label: 'Location',                  default: true  },
    { key: 'sublocation_business_type', label: 'Sublocation / Business Type', default: true  },
    { key: 'status',                    label: 'Status',                    default: true  },
    { key: 'owner',              label: 'Owner',                  default: true  },
    { key: 'assigned_to',        label: 'Assigned To',            default: true  },
    { key: 'price',              label: 'Price',                  default: false },
    { key: 'other_charges',      label: 'Other Charges',          default: false },
    { key: 'purchase_cost',      label: 'Purchase Cost',          default: false },
    { key: 'purchase_date',      label: 'Purchase Date',          default: false },
    { key: 'warranty_expiry',    label: 'Warranty Expiry',        default: false },
    { key: 'next_pm',            label: 'Next PM Date',           default: true  },
    { key: 'maintenance_status', label: 'Maintenance Status',     default: true  },
    { key: 'comments',           label: 'Comments',               default: false },
];

const EQ_COL_STORAGE_KEY = 'mwh_equipment_columns';

function loadEquipmentColumnSettings() {
    const saved = localStorage.getItem(EQ_COL_STORAGE_KEY);
    if (!saved) return null;
    try { return JSON.parse(saved); } catch (e) { return null; }
}

function saveEquipmentColumnSettings(settings) {
    localStorage.setItem(EQ_COL_STORAGE_KEY, JSON.stringify(settings));
}

function getEquipmentColumnVisibility() {
    let saved = loadEquipmentColumnSettings();
    // Discard stale data from old format (keys like 'col-barcode', 'col-num')
    if (saved && Object.keys(saved).some(k => k.startsWith('col-'))) {
        localStorage.removeItem(EQ_COL_STORAGE_KEY);
        saved = null;
    }
    const visibility = {};
    EQUIPMENT_COLUMNS.forEach(col => {
        visibility[col.key] = saved ? (saved[col.key] !== undefined ? saved[col.key] : col.default) : col.default;
    });
    return visibility;
}

function renderEquipmentColumnCheckboxes() {
    const container = document.getElementById('equipment-column-checkboxes');
    if (!container) return;
    const visibility = getEquipmentColumnVisibility();
    const serverRestr = serverColumnVisibility['equipment'] || {};
    container.innerHTML = EQUIPMENT_COLUMNS.map(col => {
        const serverHidden = serverRestr[col.key] !== undefined && !serverRestr[col.key];
        return `
        <label class="flex items-center gap-2 text-sm py-0.5 ${serverHidden ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}">
            <input type="checkbox" ${visibility[col.key] ? 'checked' : ''} ${serverHidden ? 'disabled' : ''}
                onchange="toggleEquipmentColumn('${col.key}', this.checked)"
                class="rounded">
            <span>${col.label}${serverHidden ? ' <span class="text-xs text-red-500">(locked)</span>' : ''}</span>
        </label>`;
    }).join('');
    if (typeof populateFreezeSelect === 'function') {
        populateFreezeSelect('equipment-freeze-select', EQUIPMENT_COLUMNS, 'mwh_equipment_freeze', '#equipment-table');
    }
}

function getEquipmentFreezeColumn() {
    return localStorage.getItem('mwh_equipment_freeze') || '';
}

function onEquipmentFreezeChange(value) {
    localStorage.setItem('mwh_equipment_freeze', value);
    if (typeof applyColumnFreeze === 'function') {
        applyColumnFreeze('#equipment-table', value);
    }
}

function applyEquipmentFreeze() {
    const freezeCol = getEquipmentFreezeColumn();
    if (freezeCol && typeof applyColumnFreeze === 'function') {
        applyColumnFreeze('#equipment-table', freezeCol);
    }
}

function toggleEquipmentColumn(key, visible) {
    const visibility = getEquipmentColumnVisibility();
    visibility[key] = visible;
    saveEquipmentColumnSettings(visibility);
    applyEquipmentColumnVisibility();
    relockEquipmentColumnWidths();
}

// Server-side column visibility restrictions (set per manager by admin)
let serverColumnVisibility = {}; // { 'equipment': { 'owner': 0, 'price': 0, ... } }

function applyEquipmentColumnVisibility() {
    const visibility = getEquipmentColumnVisibility();
    const table = document.querySelector('#equipment-table');
    if (!table) return;
    EQUIPMENT_COLUMNS.forEach(col => {
        // Local user preference
        let show = visibility[col.key] !== false;
        // Server-side restriction: if admin hid this column for this manager, always hide
        const serverRestriction = serverColumnVisibility['equipment'] && serverColumnVisibility['equipment'][col.key] !== undefined;
        if (serverRestriction && !serverColumnVisibility['equipment'][col.key]) {
            show = false;
        }
        table.querySelectorAll(`[data-col="${col.key}"]`).forEach(el => {
            el.classList.remove('eq-col-hidden');
            el.style.display = show ? '' : 'none';
        });
    });
    renderEquipmentColumnCheckboxes();
}

function relockEquipmentColumnWidths() {
    if (typeof unlockColumnWidths !== 'function' || typeof lockColumnWidths !== 'function') return;
    unlockColumnWidths('#equipment-table');
    if (typeof filterEquipment === 'function') filterEquipment();
    lockColumnWidths('#equipment-table');
    if (typeof applyEquipmentFreeze === 'function') applyEquipmentFreeze();
}

function toggleEquipmentColumnSettings() {
    const panel = document.getElementById('equipment-column-settings');
    if (!panel) return;
    const isHidden = panel.classList.contains('hidden');
    if (isHidden) {
        renderEquipmentColumnCheckboxes();
        panel.classList.remove('hidden');
        setTimeout(() => {
            document.addEventListener('click', closeEqColSettingsOutside, { once: true });
        }, 0);
    } else {
        panel.classList.add('hidden');
    }
}

function closeEqColSettingsOutside(e) {
    const panel = document.getElementById('equipment-column-settings');
    if (panel && !panel.contains(e.target)) {
        panel.classList.add('hidden');
    } else if (panel && !panel.classList.contains('hidden')) {
        setTimeout(() => {
            document.addEventListener('click', closeEqColSettingsOutside, { once: true });
        }, 0);
    }
}

function resetEquipmentColumns() {
    localStorage.removeItem(EQ_COL_STORAGE_KEY);
    applyEquipmentColumnVisibility();
    relockEquipmentColumnWidths();
}

// EMPLOYEE COLUMN SETTINGS
const EMPLOYEE_COLUMNS = [
    { key: 'serial',      label: '#',           default: true  },
    { key: 'actions',     label: 'Actions',     default: true  },
    { key: 'employee_id', label: 'Employee ID', default: true  },
    { key: 'name',        label: 'Name',        default: true  },
    { key: 'department',  label: 'Department',  default: true  },
    { key: 'position',    label: 'Position',    default: true  },
    { key: 'country',     label: 'Country',     default: true  },
    { key: 'location',    label: 'Location',    default: true  },
    { key: 'subbusiness', label: 'Sub / Business', default: true  },
    { key: 'nationality', label: 'Nationality', default: true  },
    { key: 'status',      label: 'Status',      default: true  },
    { key: 'leavebalance', label: 'Leave Balance', default: true  },
    { key: 'email',       label: 'Email',       default: false },
    { key: 'phone',       label: 'Phone',       default: false },
    { key: 'hiredate',    label: 'Hire Date',   default: false },
    { key: 'remtype',     label: 'Remuneration Type', default: false },
    { key: 'remuneration', label: 'Remuneration', default: false },
    { key: 'workhours',   label: 'Working Hours/Day', default: false },
    { key: 'overtime',    label: 'Overtime Rate', default: false },
    { key: 'address',     label: 'Address',     default: false },
    { key: 'emgcontact',  label: 'Emergency Contact', default: false },
    { key: 'emgphone',    label: 'Emergency Phone', default: false },
];

const EMP_COL_STORAGE_KEY = 'mwh_employee_columns';

function loadEmployeeColumnSettings() {
    const saved = localStorage.getItem(EMP_COL_STORAGE_KEY);
    if (!saved) return null;
    try { return JSON.parse(saved); } catch (e) { return null; }
}

function saveEmployeeColumnSettings(settings) {
    localStorage.setItem(EMP_COL_STORAGE_KEY, JSON.stringify(settings));
}

function getEmployeeColumnVisibility() {
    const saved = loadEmployeeColumnSettings();
    const visibility = {};
    EMPLOYEE_COLUMNS.forEach(col => {
        visibility[col.key] = saved ? (saved[col.key] !== undefined ? saved[col.key] : col.default) : col.default;
    });
    return visibility;
}

function renderEmployeeColumnToggles() {
    const container = document.getElementById('employee-column-toggles');
    if (!container) return;
    const visibility = getEmployeeColumnVisibility();
    container.innerHTML = EMPLOYEE_COLUMNS.map(col => `
        <label class="flex items-center gap-3 bg-white border rounded-lg px-4 py-3 cursor-pointer hover:bg-gray-50 select-none">
            <input type="checkbox" class="w-4 h-4 text-blue-600 rounded" ${visibility[col.key] ? 'checked' : ''}
                onchange="toggleEmployeeColumn('${col.key}', this.checked)">
            <span class="text-sm font-medium text-gray-700">${col.label}</span>
        </label>
    `).join('');
    renderEmployeeColumnCheckboxes();
}

function renderEmployeeColumnCheckboxes() {
    const container = document.getElementById('employee-column-checkboxes');
    if (!container) return;
    const visibility = getEmployeeColumnVisibility();
    const serverRestr = serverColumnVisibility['employee-management'] || {};
    container.innerHTML = EMPLOYEE_COLUMNS.map(col => {
        const serverHidden = serverRestr[col.key] !== undefined && !serverRestr[col.key];
        return `
        <label class="flex items-center gap-2 text-sm py-0.5 ${serverHidden ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}">
            <input type="checkbox" ${visibility[col.key] ? 'checked' : ''} ${serverHidden ? 'disabled' : ''}
                onchange="toggleEmployeeColumn('${col.key}', this.checked)"
                class="rounded">
            <span>${col.label}${serverHidden ? ' <span class="text-xs text-red-500">(locked)</span>' : ''}</span>
        </label>`;
    }).join('');
    if (typeof populateFreezeSelect === 'function') {
        populateFreezeSelect('employee-freeze-select', EMPLOYEE_COLUMNS, 'mwh_employee_freeze', '#employee-table');
    }
}

function getEmployeeFreezeColumn() {
    return localStorage.getItem('mwh_employee_freeze') || '';
}

function onEmployeeFreezeChange(value) {
    localStorage.setItem('mwh_employee_freeze', value);
    if (typeof applyColumnFreeze === 'function') {
        applyColumnFreeze('#employee-table', value);
    }
}

function applyEmployeeFreeze() {
    const freezeCol = getEmployeeFreezeColumn();
    if (freezeCol && typeof applyColumnFreeze === 'function') {
        applyColumnFreeze('#employee-table', freezeCol);
    }
}

function toggleEmployeeColumn(key, visible) {
    const visibility = getEmployeeColumnVisibility();
    visibility[key] = visible;
    saveEmployeeColumnSettings(visibility);
    applyEmployeeColumnVisibility();
    relockEmployeeColumnWidths();
}

function applyEmployeeColumnVisibility() {
    const visibility = getEmployeeColumnVisibility();
    const table = document.querySelector('#employee-table');
    if (!table) return;
    const serverRestr = serverColumnVisibility['employee-management'] || {};
    EMPLOYEE_COLUMNS.forEach(col => {
        let show = visibility[col.key] !== false;
        if (serverRestr[col.key] !== undefined && !serverRestr[col.key]) show = false;
        table.querySelectorAll(`[data-col="${col.key}"]`).forEach(el => {
            el.style.display = show ? '' : 'none';
        });
    });
    renderEmployeeColumnCheckboxes();
}

function relockEmployeeColumnWidths() {
    if (typeof unlockColumnWidths !== 'function' || typeof lockColumnWidths !== 'function') return;
    unlockColumnWidths('#employee-table');
    if (typeof renderEmployeeList === 'function' && typeof allEmployees !== 'undefined') {
        renderEmployeeList(allEmployees);
    }
    lockColumnWidths('#employee-table');
    if (typeof filterEmployees === 'function') filterEmployees();
    if (typeof applyEmployeeFreeze === 'function') applyEmployeeFreeze();
}

function toggleEmployeeColumnSettings() {
    const panel = document.getElementById('employee-column-settings');
    if (!panel) return;
    const isHidden = panel.classList.contains('hidden');
    if (isHidden) {
        renderEmployeeColumnCheckboxes();
        panel.classList.remove('hidden');
        setTimeout(() => {
            document.addEventListener('click', closeEmpColSettingsOutside, { once: true });
        }, 0);
    } else {
        panel.classList.add('hidden');
    }
}

function closeEmpColSettingsOutside(e) {
    const panel = document.getElementById('employee-column-settings');
    if (panel && !panel.contains(e.target)) {
        panel.classList.add('hidden');
    } else if (panel && !panel.classList.contains('hidden')) {
        setTimeout(() => {
            document.addEventListener('click', closeEmpColSettingsOutside, { once: true });
        }, 0);
    }
}

function showAllEmployeeColumns() {
    const visibility = {};
    EMPLOYEE_COLUMNS.forEach(col => { visibility[col.key] = true; });
    saveEmployeeColumnSettings(visibility);
    renderEmployeeColumnToggles();
    applyEmployeeColumnVisibility();
    relockEmployeeColumnWidths();
}

function hideAllEmployeeColumns() {
    const visibility = {};
    EMPLOYEE_COLUMNS.forEach(col => { visibility[col.key] = col.key === 'actions'; });
    saveEmployeeColumnSettings(visibility);
    renderEmployeeColumnToggles();
    applyEmployeeColumnVisibility();
    relockEmployeeColumnWidths();
}

function resetEmployeeColumns() {
    localStorage.removeItem(EMP_COL_STORAGE_KEY);
    renderEmployeeColumnToggles();
    applyEmployeeColumnVisibility();
    relockEmployeeColumnWidths();
}

// PAYROLL COLUMN SETTINGS
const PAYROLL_COLUMNS = [
    { key: 'serial',            label: '#',                 default: true  },
    { key: 'name',              label: 'Employee',          default: true  },
    { key: 'employee_id',       label: 'Emp ID',            default: true  },
    { key: 'department',        label: 'Department',        default: true  },
    { key: 'remType',           label: 'Rem. Type',         default: true  },
    { key: 'remAmount',         label: 'Rem. Amount',     default: true  },
    { key: 'present',           label: 'P',                 default: true  },
    { key: 'unpaidLeave',       label: 'A',                 default: true  },
    { key: 'medicalLeave',      label: 'ML',                default: true  },
    { key: 'paidLeave',         label: 'PL',                default: true  },
    { key: 'dayOff',            label: 'D',                 default: true  },
    { key: 'compassionateLeave', label: 'CL',               default: true  },
    { key: 'totalOvertimeHours', label: 'OT Hours',         default: true  },
    { key: 'totalDays',         label: 'Total Days',        default: true  },
    { key: 'paidDays',          label: 'Paid Days',         default: true  },
    { key: 'grossAmount',       label: 'Gross',             default: true  },
    { key: 'empAdvance',        label: 'Advance',           default: true  },
    { key: 'netAmount',         label: 'Net',               default: true  },
    { key: 'paidAmount',        label: 'Paid',              default: true  },
    { key: 'balance',           label: 'Balance',           default: true  },
    { key: 'view',              label: 'Payslip',           default: true  },
    { key: 'pay',               label: 'Pay',               default: true  }
];

const PAYROLL_COL_STORAGE_KEY = 'mwh_payroll_columns';

function loadPayrollColumnSettings() {
    const saved = localStorage.getItem(PAYROLL_COL_STORAGE_KEY);
    if (!saved) return null;
    try { return JSON.parse(saved); } catch (e) { return null; }
}

function savePayrollColumnSettings(settings) {
    localStorage.setItem(PAYROLL_COL_STORAGE_KEY, JSON.stringify(settings));
}

function getPayrollColumnVisibility() {
    const saved = loadPayrollColumnSettings();
    const visibility = {};
    PAYROLL_COLUMNS.forEach(col => {
        visibility[col.key] = saved ? (saved[col.key] !== undefined ? saved[col.key] : col.default) : col.default;
    });
    return visibility;
}

function renderPayrollColumnCheckboxes() {
    const container = document.getElementById('payroll-column-checkboxes');
    if (!container) return;
    const visibility = getPayrollColumnVisibility();
    const serverRestr = serverColumnVisibility['payment-calculation'] || {};
    container.innerHTML = PAYROLL_COLUMNS.map(col => {
        const serverHidden = serverRestr[col.key] !== undefined && !serverRestr[col.key];
        return `
        <label class="flex items-center gap-2 text-sm py-0.5 ${serverHidden ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}">
            <input type="checkbox" ${visibility[col.key] ? 'checked' : ''} ${serverHidden ? 'disabled' : ''}
                onchange="togglePayrollColumn('${col.key}', this.checked)"
                class="rounded">
            <span>${col.label}${serverHidden ? ' <span class="text-xs text-red-500">(locked)</span>' : ''}</span>
        </label>`;
    }).join('');
    if (typeof populateFreezeSelect === 'function') {
        populateFreezeSelect('payroll-freeze-select', PAYROLL_COLUMNS, 'mwh_payroll_freeze', '#payroll-table');
    }
}

function getPayrollFreezeColumn() {
    return localStorage.getItem('mwh_payroll_freeze') || '';
}

function onPayrollFreezeChange(value) {
    localStorage.setItem('mwh_payroll_freeze', value);
    if (typeof applyColumnFreeze === 'function') {
        applyColumnFreeze('#payroll-table', value);
    }
}

function applyPayrollFreeze() {
    const freezeCol = getPayrollFreezeColumn();
    if (freezeCol && typeof applyColumnFreeze === 'function') {
        applyColumnFreeze('#payroll-table', freezeCol);
    }
}

function relockPayrollColumnWidths() {
    if (typeof unlockColumnWidths !== 'function' || typeof lockColumnWidths !== 'function') return;
    unlockColumnWidths('#payroll-table');
    lockColumnWidths('#payroll-table');
    applyPayrollFreeze();
}

function togglePayrollColumn(key, visible) {
    const visibility = getPayrollColumnVisibility();
    visibility[key] = visible;
    savePayrollColumnSettings(visibility);
    applyPayrollColumnVisibility();
    relockPayrollColumnWidths();
    renderPayrollColumnCheckboxes();
}

function applyPayrollColumnVisibility() {
    const visibility = getPayrollColumnVisibility();
    const table = document.querySelector('#payroll-table');
    if (!table) return;
    const serverRestr = serverColumnVisibility['payment-calculation'] || {};
    PAYROLL_COLUMNS.forEach(col => {
        let show = visibility[col.key] !== false;
        if (serverRestr[col.key] !== undefined && !serverRestr[col.key]) show = false;
        document.querySelectorAll(`#payroll-table-wrapper col[data-col="${col.key}"]`).forEach(el => {
            el.style.display = show ? '' : 'none';
        });
        const th = table.querySelector(`thead th[data-col="${col.key}"]`);
        if (th) {
            th.style.display = show ? '' : 'none';
            const cellIndex = Array.from(th.parentNode.children).indexOf(th);
            table.querySelectorAll('tbody tr').forEach(row => {
                const td = row.children[cellIndex];
                if (td) td.style.display = show ? '' : 'none';
            });
        }
    });
    renderPayrollColumnCheckboxes();
}

function togglePayrollColumnSettings() {
    const panel = document.getElementById('payroll-column-settings');
    if (!panel) return;
    const isHidden = panel.classList.contains('hidden');
    if (isHidden) {
        renderPayrollColumnCheckboxes();
        panel.classList.remove('hidden');
        setTimeout(() => {
            document.addEventListener('click', closePayrollColumnSettingsOutside, { once: true });
        }, 0);
    } else {
        panel.classList.add('hidden');
    }
}

function closePayrollColumnSettingsOutside(e) {
    const panel = document.getElementById('payroll-column-settings');
    if (panel && !panel.contains(e.target)) {
        panel.classList.add('hidden');
    } else if (panel && !panel.classList.contains('hidden')) {
        setTimeout(() => {
            document.addEventListener('click', closePayrollColumnSettingsOutside, { once: true });
        }, 0);
    }
}

// PAYMENT HISTORY COLUMN SETTINGS
const PAYMENT_HISTORY_COLUMNS = [
    { key: 'serial',         label: '#',              default: true  },
    { key: 'name',           label: 'Employee',       default: true  },
    { key: 'emp_code',       label: 'Emp ID',         default: true  },
    { key: 'monthLabel',     label: 'Month',          default: true  },
    { key: 'gross_amount',   label: 'Gross',          default: true  },
    { key: 'advance_amount', label: 'Advance',        default: true  },
    { key: 'net_amount',     label: 'Net',            default: true  },
    { key: 'paid_amount',    label: 'Paid',           default: true  },
    { key: 'carry_forward',  label: 'Carry Forward',  default: true  },
    { key: 'balance',        label: 'Balance',        default: true  },
    { key: 'paidDate',       label: 'Paid Date',      default: true  },
    { key: 'signedStatus',   label: 'Signed',         default: true  },
    { key: 'actions',        label: 'Actions',        default: true  }
];

const PAYMENT_HISTORY_COL_STORAGE_KEY = 'mwh_payment_history_columns';

// Central mapping of tab_key → column definitions for access control
// Keys are the tab_key or subtab_key used in MODULE_TABS
const TAB_COLUMNS = {
    'equipment':                { label: 'Equipment List',      columns: EQUIPMENT_COLUMNS },
    'employee-management':     { label: 'Employee',             columns: EMPLOYEE_COLUMNS },
    'payment-calculation':      { label: 'Payroll',              columns: PAYROLL_COLUMNS },
    'payment-history':          { label: 'Payment History',      columns: PAYMENT_HISTORY_COLUMNS },
    'accommodation-management': { label: 'Accommodation',        columns: typeof ROOM_ASSIGNMENT_COLUMNS !== 'undefined' ? ROOM_ASSIGNMENT_COLUMNS : [] },
    'items':                    { label: 'Uniform Items',        columns: typeof UNIFORM_ITEM_COLUMNS !== 'undefined' ? UNIFORM_ITEM_COLUMNS : [] },
    'purchases':               { label: 'Uniform Purchases',    columns: typeof UNIFORM_PURCHASE_COLUMNS !== 'undefined' ? UNIFORM_PURCHASE_COLUMNS : [] }
};

function loadPaymentHistoryColumnSettings() {
    const saved = localStorage.getItem(PAYMENT_HISTORY_COL_STORAGE_KEY);
    if (!saved) return null;
    try { return JSON.parse(saved); } catch (e) { return null; }
}

function savePaymentHistoryColumnSettings(settings) {
    localStorage.setItem(PAYMENT_HISTORY_COL_STORAGE_KEY, JSON.stringify(settings));
}

function getPaymentHistoryColumnVisibility() {
    const saved = loadPaymentHistoryColumnSettings();
    const visibility = {};
    PAYMENT_HISTORY_COLUMNS.forEach(col => {
        visibility[col.key] = saved ? (saved[col.key] !== undefined ? saved[col.key] : col.default) : col.default;
    });
    return visibility;
}

function renderPaymentHistoryColumnCheckboxes() {
    const container = document.getElementById('payment-history-column-checkboxes');
    if (!container) return;
    const visibility = getPaymentHistoryColumnVisibility();
    const serverRestr = serverColumnVisibility['payment-history'] || {};
    container.innerHTML = PAYMENT_HISTORY_COLUMNS.map(col => {
        const serverHidden = serverRestr[col.key] !== undefined && !serverRestr[col.key];
        return `
        <label class="flex items-center gap-2 text-sm py-0.5 ${serverHidden ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}">
            <input type="checkbox" ${visibility[col.key] ? 'checked' : ''} ${serverHidden ? 'disabled' : ''}
                onchange="togglePaymentHistoryColumn('${col.key}', this.checked)"
                class="rounded">
            <span>${col.label}${serverHidden ? ' <span class="text-xs text-red-500">(locked)</span>' : ''}</span>
        </label>`;
    }).join('');
}

function togglePaymentHistoryColumn(key, visible) {
    const visibility = getPaymentHistoryColumnVisibility();
    visibility[key] = visible;
    savePaymentHistoryColumnSettings(visibility);
    applyPaymentHistoryColumnVisibility();
    renderPaymentHistoryColumnCheckboxes();
}

function applyPaymentHistoryColumnVisibility() {
    const visibility = getPaymentHistoryColumnVisibility();
    const table = document.querySelector('#payment-history-wrapper table');
    if (!table) return;
    const serverRestr = serverColumnVisibility['payment-history'] || {};
    PAYMENT_HISTORY_COLUMNS.forEach(col => {
        let show = visibility[col.key] !== false;
        if (serverRestr[col.key] !== undefined && !serverRestr[col.key]) show = false;
        document.querySelectorAll(`#payment-history-wrapper col[data-col="${col.key}"]`).forEach(el => {
            el.style.display = show ? '' : 'none';
        });
        const th = table.querySelector(`thead th[data-col="${col.key}"]`);
        if (th) {
            th.style.display = show ? '' : 'none';
            const cellIndex = Array.from(th.parentNode.children).indexOf(th);
            table.querySelectorAll('tbody tr').forEach(row => {
                const td = row.children[cellIndex];
                if (td) td.style.display = show ? '' : 'none';
            });
        }
    });
    renderPaymentHistoryColumnCheckboxes();
}

function togglePaymentHistoryColumnSettings() {
    const panel = document.getElementById('payment-history-column-settings');
    if (!panel) return;
    const isHidden = panel.classList.contains('hidden');
    if (isHidden) {
        renderPaymentHistoryColumnCheckboxes();
        panel.classList.remove('hidden');
        setTimeout(() => {
            document.addEventListener('click', closePaymentHistoryColumnSettingsOutside, { once: true });
        }, 0);
    } else {
        panel.classList.add('hidden');
    }
}

function closePaymentHistoryColumnSettingsOutside(e) {
    const panel = document.getElementById('payment-history-column-settings');
    if (panel && !panel.contains(e.target)) {
        panel.classList.add('hidden');
    } else if (panel && !panel.classList.contains('hidden')) {
        setTimeout(() => {
            document.addEventListener('click', closePaymentHistoryColumnSettingsOutside, { once: true });
        }, 0);
    }
}

// Load server-side column visibility restrictions for the current manager
async function loadServerColumnVisibility() {
    if (typeof loggedInManager === 'undefined' || !loggedInManager) return;
    if (loggedInManager.module_name === 'admin') return; // admin sees all
    try {
        const res = await fetch(`${API_BASE}/column-visibility/${loggedInManager.id}`);
        const rows = await res.json();
        serverColumnVisibility = {};
        rows.forEach(r => {
            if (!serverColumnVisibility[r.tab_key]) serverColumnVisibility[r.tab_key] = {};
            serverColumnVisibility[r.tab_key][r.column_key] = r.is_visible;
        });
    } catch (e) {
        console.error('Error loading server column visibility:', e);
    }
}

document.addEventListener('sessionReady', () => {
    loadServerColumnVisibility().then(() => {
        setTimeout(() => {
            applyEquipmentColumnVisibility();
            applyEmployeeColumnVisibility();
            applyPayrollColumnVisibility();
            applyPaymentHistoryColumnVisibility();
        }, 800);
    });
});

// PREVENTIVE MAINTENANCE TASKS
let allPMTasks = [];
let allEquipmentItems = [];
let pmTaskListBuffer = [];

async function loadPMTasks() {
    showTableLoading('pm-tasks-table-body', 'Loading PM tasks...');
    try {
        const [tasksRes, itemsRes] = await Promise.all([
            fetch(`${API_BASE}/pm-tasks`),
            fetch(`${API_BASE}/equipment-items`)
        ]);
        allPMTasks = await tasksRes.json();
        allEquipmentItems = await itemsRes.json();
        renderPMTasks();
    } catch (error) {
        console.error('Error loading PM tasks:', error);
    }
}

function pmTypeLabel(type) {
    const labels = { 'daily': 'Daily', 'weekly': 'Weekly', 'monthly': 'Monthly', 'quarterly': 'Quarterly', 'bi-annually': 'Bi-Annually', 'annually': 'Annually' };
    return labels[type] || 'Monthly';
}

function pmTypeBadgeClass(type) {
    const classes = { 'daily': 'bg-blue-100 text-blue-700', 'weekly': 'bg-cyan-100 text-cyan-700', 'monthly': 'bg-green-100 text-green-700', 'quarterly': 'bg-yellow-100 text-yellow-700', 'bi-annually': 'bg-orange-100 text-orange-700', 'annually': 'bg-purple-100 text-purple-700' };
    return classes[type] || 'bg-green-100 text-green-700';
}

function renderPMTasks() {
    const tbody = document.getElementById('pm-tasks-table-body');
    if (!tbody) return;
    tbody.innerHTML = allPMTasks.map((task, i) => `
        <tr>
            <td class="px-3 py-2 whitespace-nowrap">${i + 1}</td>
            <td class="px-3 py-2 whitespace-nowrap">${task.item_name || '-'}</td>
            <td class="px-3 py-2 whitespace-nowrap">${task.product_code || '-'}</td>
            <td class="px-3 py-2 whitespace-nowrap"><span class="px-2 py-0.5 text-xs rounded-full ${pmTypeBadgeClass(task.pm_type)}">${pmTypeLabel(task.pm_type)}</span></td>
            <td class="px-3 py-2">${task.task_text}</td>
            <td class="px-3 py-2 whitespace-nowrap">
                <button onclick="editPMTask(${task.id})" class="text-blue-600 hover:text-blue-800 mr-2">
                    <i class="fas fa-edit"></i>
                </button>
                <button onclick="deletePMTask(${task.id})" class="text-red-600 hover:text-red-800">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        </tr>
    `).join('');
}

function filterPMTasks() {
    const search = (document.getElementById('pm-tasks-search')?.value || '').toLowerCase();
    const filtered = allPMTasks.filter(task =>
        !search ||
        (task.item_name && task.item_name.toLowerCase().includes(search)) ||
        (task.task_text && task.task_text.toLowerCase().includes(search)) ||
        (task.product_code && task.product_code.toLowerCase().includes(search)) ||
        (task.pm_type && pmTypeLabel(task.pm_type).toLowerCase().includes(search))
    );
    const tbody = document.getElementById('pm-tasks-table-body');
    tbody.innerHTML = filtered.map((task, i) => `
        <tr>
            <td class="px-3 py-2 whitespace-nowrap">${i + 1}</td>
            <td class="px-3 py-2 whitespace-nowrap">${task.item_name || '-'}</td>
            <td class="px-3 py-2 whitespace-nowrap">${task.product_code || '-'}</td>
            <td class="px-3 py-2 whitespace-nowrap"><span class="px-2 py-0.5 text-xs rounded-full ${pmTypeBadgeClass(task.pm_type)}">${pmTypeLabel(task.pm_type)}</span></td>
            <td class="px-3 py-2">${task.task_text}</td>
            <td class="px-3 py-2 whitespace-nowrap">
                <button onclick="editPMTask(${task.id})" class="text-blue-600 hover:text-blue-800 mr-2">
                    <i class="fas fa-edit"></i>
                </button>
                <button onclick="deletePMTask(${task.id})" class="text-red-600 hover:text-red-800">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        </tr>
    `).join('');
}

function openPMTaskModal() {
    document.getElementById('pm-task-modal-title').textContent = 'Add PM Task';
    document.getElementById('pm-task-id').value = '';
    document.getElementById('pm-task-text').value = '';
    document.getElementById('pm-task-type').value = 'monthly';
    pmTaskListBuffer = [];
    renderPMTaskList();

    document.getElementById('pm-task-equipment').value = '';
    document.getElementById('pm-task-equipment-search').value = '';

    document.getElementById('pm-task-form').onsubmit = savePMTasks;
    document.getElementById('pm-task-modal').classList.add('flex');
    document.getElementById('pm-task-single-input').style.display = 'block';
}

function closePMTaskModal() {
    document.getElementById('pm-task-modal').classList.remove('flex');
}

function addPMTaskToList() {
    const input = document.getElementById('pm-task-text');
    const text = input.value.trim();
    if (!text) return;
    pmTaskListBuffer.push(text);
    input.value = '';
    renderPMTaskList();
    input.focus();
}

function removePMTaskFromList(index) {
    pmTaskListBuffer.splice(index, 1);
    renderPMTaskList();
}

function renderPMTaskList() {
    const container = document.getElementById('pm-task-list');
    if (pmTaskListBuffer.length === 0) {
        container.innerHTML = '<p class="text-sm text-gray-400 text-center" id="pm-task-list-empty">No tasks added yet</p>';
        return;
    }
    container.innerHTML = pmTaskListBuffer.map((task, i) => `
        <div class="flex items-center justify-between py-1 px-2 bg-white rounded border mb-1">
            <span class="text-sm">${i + 1}. ${task}</span>
            <button type="button" onclick="removePMTaskFromList(${i})" class="text-red-600 hover:text-red-800 ml-2">
                <i class="fas fa-times"></i>
            </button>
        </div>
    `).join('');
}

function filterPMEquipment(query) {
    const dropdown = document.getElementById('pm-task-equipment-dropdown');
    const q = (query || '').toLowerCase();
    const filtered = allEquipmentItems.filter(item =>
        !q ||
        (item.name && item.name.toLowerCase().includes(q)) ||
        (item.product_code && item.product_code.toLowerCase().includes(q)) ||
        (item.category_name && item.category_name.toLowerCase().includes(q))
    );
    if (filtered.length === 0) {
        dropdown.innerHTML = '<div class="px-3 py-2 text-sm text-gray-400">No equipment found</div>';
        dropdown.classList.remove('hidden');
        return;
    }
    dropdown.innerHTML = filtered.map(item =>
        `<div class="px-3 py-2 text-sm hover:bg-blue-50 cursor-pointer border-b border-gray-100" onclick="selectPMEquipment(${item.id})">${item.name}${item.product_code ? ' (' + item.product_code + ')' : ''}<span class="text-xs text-gray-400 ml-2">${item.category_name || ''}</span></div>`
    ).join('');
    dropdown.classList.remove('hidden');
}

function selectPMEquipment(id) {
    const item = allEquipmentItems.find(i => i.id === id);
    if (!item) return;
    document.getElementById('pm-task-equipment').value = id;
    document.getElementById('pm-task-equipment-search').value = `${item.name}${item.product_code ? ' (' + item.product_code + ')' : ''}`;
    document.getElementById('pm-task-equipment-dropdown').classList.add('hidden');
}

async function savePMTasks(e) {
    e.preventDefault();
    const itemId = document.getElementById('pm-task-equipment').value;
    const editId = document.getElementById('pm-task-id').value;

    if (!itemId) {
        alert('Please select equipment');
        return;
    }

    try {
        if (editId) {
            const taskText = document.getElementById('pm-task-text').value.trim();
            if (!taskText) {
                alert('Please enter a task description');
                return;
            }
            const pmType = document.getElementById('pm-task-type').value;
            const response = await fetch(`${API_BASE}/pm-tasks/${editId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ item_id: itemId, task_text: taskText, pm_type: pmType })
            });
            if (!response.ok) {
                const err = await response.json();
                alert(err.error || 'Error updating PM task');
                return;
            }
        } else {
            if (pmTaskListBuffer.length === 0) {
                const singleTask = document.getElementById('pm-task-text').value.trim();
                if (singleTask) pmTaskListBuffer.push(singleTask);
            }
            if (pmTaskListBuffer.length === 0) {
                alert('Please add at least one task');
                return;
            }
            const pmType = document.getElementById('pm-task-type').value;
            for (const taskText of pmTaskListBuffer) {
                const response = await fetch(`${API_BASE}/pm-tasks`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ item_id: itemId, task_text: taskText, pm_type: pmType })
                });
                if (!response.ok) {
                    const err = await response.json();
                    alert(err.error || 'Error adding PM task');
                    return;
                }
            }
        }
        closePMTaskModal();
        loadPMTasks();
    } catch (error) {
        console.error('Error saving PM tasks:', error);
        alert('Error saving PM tasks');
    }
}

function editPMTask(id) {
    const task = allPMTasks.find(t => t.id === id);
    if (!task) return;

    document.getElementById('pm-task-modal-title').textContent = 'Edit PM Task';
    document.getElementById('pm-task-id').value = task.id;
    document.getElementById('pm-task-text').value = task.task_text;
    document.getElementById('pm-task-type').value = task.pm_type || 'monthly';
    pmTaskListBuffer = [];
    renderPMTaskList();

    const item = allEquipmentItems.find(i => i.id === task.item_id);
    document.getElementById('pm-task-equipment').value = task.item_id;
    document.getElementById('pm-task-equipment-search').value = item ? `${item.name}${item.product_code ? ' (' + item.product_code + ')' : ''}` : '';

    document.getElementById('pm-task-form').onsubmit = savePMTasks;
    document.getElementById('pm-task-single-input').style.display = 'block';
    document.getElementById('pm-task-modal').classList.add('flex');
}

async function deletePMTask(id) {
    if (!confirm('Delete this PM task?')) return;
    try {
        const response = await fetch(`${API_BASE}/pm-tasks/${id}`, { method: 'DELETE' });
        if (!response.ok) {
            const err = await response.json();
            alert(err.error || 'Error deleting PM task');
            return;
        }
        loadPMTasks();
    } catch (error) {
        console.error('Error deleting PM task:', error);
    }
}



// Location management

async function loadLocations() {
    try {
        const response = await fetch(`${API_BASE}/locations`);
        allLocations = await response.json();
        renderLocations();
        populateLocationSelects();
    } catch (error) {
        console.error('Error loading locations:', error);
    }
}

function renderLocations() {
    const tbody = document.getElementById('locations-table-body');
    if (!tbody) {
        return;
    }
    tbody.innerHTML = allLocations.map(loc => `
        <tr>
            <td class="px-6 py-4 whitespace-nowrap">${loc.name}</td>
            <td class="px-6 py-4 whitespace-nowrap">${loc.country || '-'}</td>
            <td class="px-6 py-4 whitespace-nowrap">${loc.location || '-'}</td>
            <td class="px-6 py-4 whitespace-nowrap">${loc.sub_location || '-'}</td>
            <td class="px-6 py-4 whitespace-nowrap">${loc.business_type || '-'}</td>
            <td class="px-6 py-4 whitespace-nowrap">
                <button onclick="editLocation(${loc.id})" class="text-blue-600 hover:text-blue-800 mr-2">
                    <i class="fas fa-edit"></i>
                </button>
                <button onclick="deleteLocation(${loc.id})" class="text-red-600 hover:text-red-800">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        </tr>
    `).join('');
}

function populateLocationSelects() {
    const selects = ['equipment-location', 'transfer-from', 'transfer-to', 'kitchen-item-location', 'kitchen-purchase-location', 'kitchen-delivery-location', 'uniform-item-location', 'uniform-purchase-location', 'uniform-distribution-location'];
    
    selects.forEach(selectId => {
        const select = document.getElementById(selectId);
        if (select) {
            const currentValue = select.value;
            select.innerHTML = '<option value="">Select Location</option>' + 
                allLocations.map(loc => `<option value="${loc.id}">${loc.name}</option>`).join('');
            select.value = currentValue;
        }
    });
}

function openLocationModal(id = null) {
    const modal = document.getElementById('location-modal');
    const form = document.getElementById('location-form');
    const title = document.getElementById('location-modal-title');
    
    form.reset();
    document.getElementById('location-id').value = '';
    
    if (id) {
        const loc = allLocations.find(l => l.id === id);
        if (loc) {
            title.textContent = 'Edit Location';
            document.getElementById('location-id').value = loc.id;
            document.getElementById('location-name').value = loc.name;
            document.getElementById('location-country').value = loc.country || '';
            document.getElementById('location-location').value = loc.location || '';
            document.getElementById('location-sub-location').value = loc.sub_location || '';
            document.getElementById('location-business-type').value = loc.business_type || '';
            document.getElementById('location-address').value = loc.address || '';
        }
    } else {
        title.textContent = 'Add Location';
    }
    
    modal.classList.add('active');
}

function closeLocationModal() {
    document.getElementById('location-modal').classList.remove('active');
}

async function saveLocation(e) {
    e.preventDefault();
    const id = document.getElementById('location-id').value;
    const data = {
        name: document.getElementById('location-name').value,
        country: document.getElementById('location-country').value,
        location: document.getElementById('location-location').value,
        sub_location: document.getElementById('location-sub-location').value,
        business_type: document.getElementById('location-business-type').value,
        address: document.getElementById('location-address').value
    };
    
    try {
        const url = id ? `${API_BASE}/locations/${id}` : `${API_BASE}/locations`;
        const method = id ? 'PUT' : 'POST';
        
        const response = await fetch(url, {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        
        if (response.ok) {
            closeLocationModal();
            loadLocations();
        }
    } catch (error) {
        console.error('Error saving location:', error);
    }
}

function editLocation(id) {
    openLocationModal(id);
}

async function deleteLocation(id) {
    if (confirm('Are you sure you want to delete this location?')) {
        try {
            const response = await fetch(`${API_BASE}/locations/${id}`, {
                method: 'DELETE'
            });
            
            if (response.ok) {
                loadLocations();
            }
        } catch (error) {
            console.error('Error deleting location:', error);
        }
    }
}

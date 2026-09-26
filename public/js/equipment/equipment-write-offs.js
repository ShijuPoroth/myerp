// Write Offs
let allWriteOffs = [];

async function loadWriteOffs() {
    showTableLoading('write-offs-table-body', 'Loading write-offs...');
    try {
const response = await fetch(`${API_BASE}/equipment/write-offs`);
        if (!response.ok) {
            console.error('Error loading write-offs:', response.status, response.statusText);
            allWriteOffs = [];
            renderWriteOffs([]);
            return;
        }
        allWriteOffs = await response.json();
populateWriteOffFilters();
        filterWriteOffs();
    } catch (error) {
        console.error('Error loading write-offs:', error);
        showTableError('write-offs-table-body', 'Error loading write-offs.');
        allWriteOffs = [];
        renderWriteOffs([]);
    }
}

function renderWriteOffs(writeOffs) {
    const tbody = document.getElementById('write-offs-table-body');
if (!tbody) return;
    if (!writeOffs || !Array.isArray(writeOffs)) {
        tbody.innerHTML = '';
        return;
    }
    const total = writeOffs.length;
    tbody.innerHTML = writeOffs.map((wo, index) => {
        const serial = total - index;
        const photoThumbnails = (wo.photos && wo.photos.length > 0)
            ? wo.photos.map(p => `<img src="${p.photo_path}" class="h-8 w-8 object-cover rounded border inline-block mr-1" title="Photo">`).join('')
            : '';
        return `
        <tr>
            <td class="px-3 py-2 whitespace-nowrap text-gray-500 text-xs">${serial}</td>
            <td class="px-3 py-2 max-w-32 truncate" title="${wo.equipment_name || ''}">${wo.equipment_name || '-'}</td>
            <td class="px-3 py-2 whitespace-nowrap">${wo.equipment_auto_serial || '-'}</td>
            <td class="px-3 py-2 whitespace-nowrap">${formatDate(wo.write_off_date)}</td>
            <td class="px-3 py-2 max-w-40 truncate" title="${wo.reason || ''}">${wo.reason || '-'}</td>
            <td class="px-3 py-2 whitespace-nowrap">
                <span class="px-2 py-1 text-xs rounded-full ${getWriteOffStatusColor(wo.status)}">${wo.status || 'Pending'}</span>
            </td>
            <td class="px-3 py-2 whitespace-nowrap">${wo.requested_by || '-'}</td>
            <td class="px-3 py-2 whitespace-nowrap">${wo.approved_by || '-'}</td>
            <td class="px-3 py-2 whitespace-nowrap">
                ${photoThumbnails}
                <button onclick="viewWriteOff(${wo.id})" class="text-green-600 hover:text-green-800 mr-2" title="View report">
                    <i class="fas fa-eye"></i>
                </button>
                ${wo.equipment_id ? `<button onclick="viewEquipment(${wo.equipment_id})" class="text-blue-600 hover:text-blue-800 mr-2" title="View Equipment"><i class="fas fa-desktop"></i></button>` : ''}
                ${getEditActionButton('write-offs', 'editWriteOff', wo.id)}
                ${getDeleteActionButton('write-offs', 'deleteWriteOff', wo.id)}
            </td>
        </tr>
        `;
    }).join('');
}

function getWriteOffStatusColor(status) {
    switch(status) {
        case 'Approved': return 'bg-green-100 text-green-800';
        case 'Rejected': return 'bg-red-100 text-red-800';
        case 'Pending':
        default: return 'bg-yellow-100 text-yellow-800';
    }
}

function filterWriteOffs() {
    highlightWriteOffFilters();
    const searchText = document.getElementById('write-off-search').value.toLowerCase();
    const status = document.getElementById('write-off-filter-status').value;
    const country = document.getElementById('write-off-filter-country')?.value || '';
    const location = document.getElementById('write-off-filter-location')?.value || '';
    const selectedSublocationIds = getSelectedWriteOffSublocationIds();
    const owner = document.getElementById('write-off-filter-owner')?.value || '';

    let filtered = allWriteOffs;
    if (status) {
        filtered = filtered.filter(wo => wo.status === status);
    }
    if (country) {
        filtered = filtered.filter(wo => wo.equipment_country === country);
    }
    if (location) {
        filtered = filtered.filter(wo => wo.equipment_location === location);
    }
    if (selectedSublocationIds.length > 0) {
        filtered = filtered.filter(wo => {
            const subBiz = [wo.equipment_sub_location, wo.equipment_business_type, wo.equipment_business_unit_code].filter(Boolean).join(' - ');
            return selectedSublocationIds.includes(subBiz);
        });
    }
    if (owner) {
        filtered = filtered.filter(wo => wo.equipment_owner === owner);
    }
    if (searchText) {
        filtered = filtered.filter(wo =>
            (wo.equipment_name && wo.equipment_name.toLowerCase().includes(searchText)) ||
            (wo.equipment_auto_serial && wo.equipment_auto_serial.toLowerCase().includes(searchText)) ||
            (wo.reason && wo.reason.toLowerCase().includes(searchText))
        );
    }
    renderWriteOffs(filtered);
}

function populateWriteOffFilters() {
    if (!allWriteOffs || allWriteOffs.length === 0) return;

    const countrySelect = document.getElementById('write-off-filter-country');
    if (countrySelect) {
        const uniqueCountries = [...new Set(allWriteOffs.map(wo => wo.equipment_country).filter(c => c))].sort();
        countrySelect.innerHTML = '<option value="">All Countries</option>' +
            uniqueCountries.map(c => `<option value="${c}">${c}</option>`).join('');
    }

    const locationSelect = document.getElementById('write-off-filter-location');
    if (locationSelect) {
        locationSelect.innerHTML = '<option value="">All Locations</option>';
    }

    const checkboxList = document.getElementById('write-off-sublocation-checkbox-list');
    if (checkboxList) checkboxList.innerHTML = '';
    const checkAll = document.getElementById('write-off-sublocation-check-all');
    if (checkAll) checkAll.checked = true;
    const label = document.getElementById('write-off-filter-sublocation-label');
    if (label) label.textContent = 'All Sublocations / Business Types';

    const ownerSelect = document.getElementById('write-off-filter-owner');
    if (ownerSelect) {
        const uniqueOwners = [...new Set(allWriteOffs.map(wo => wo.equipment_owner).filter(o => o))].sort();
        ownerSelect.innerHTML = '<option value="">All Owners</option>' +
            uniqueOwners.map(o => `<option value="${o}">${o}</option>`).join('');
    }
}

function onWriteOffFilterCountryChange() {
    const country = document.getElementById('write-off-filter-country').value;
    const locationSelect = document.getElementById('write-off-filter-location');

    if (country && allWriteOffs && allWriteOffs.length) {
        const locationNames = [...new Set(allWriteOffs
            .filter(wo => wo.equipment_country === country)
            .map(wo => wo.equipment_location)
            .filter(loc => loc))].sort();
        locationSelect.innerHTML = '<option value="">All Locations</option>' +
            locationNames.map(loc => `<option value="${loc}">${loc}</option>`).join('');
    } else {
        locationSelect.innerHTML = '<option value="">All Locations</option>';
    }

    const checkboxList = document.getElementById('write-off-sublocation-checkbox-list');
    if (checkboxList) checkboxList.innerHTML = '';
    const checkAll = document.getElementById('write-off-sublocation-check-all');
    if (checkAll) checkAll.checked = true;
    const label = document.getElementById('write-off-filter-sublocation-label');
    if (label) label.textContent = 'All Sublocations / Business Types';

    filterWriteOffs();
}

function onWriteOffFilterLocationChange() {
    const country = document.getElementById('write-off-filter-country').value;
    const location = document.getElementById('write-off-filter-location').value;

    if (country && location && allWriteOffs && allWriteOffs.length) {
        const subBizOptions = [...new Set(allWriteOffs
            .filter(wo => wo.equipment_country === country && wo.equipment_location === location)
            .map(wo => [wo.equipment_sub_location, wo.equipment_business_type, wo.equipment_business_unit_code].filter(Boolean).join(' - '))
            .filter(s => s))].sort();

        const checkboxList = document.getElementById('write-off-sublocation-checkbox-list');
        if (checkboxList) {
            checkboxList.innerHTML = subBizOptions.map(sub => `
                <label class="flex items-center px-3 py-2 hover:bg-gray-50 border-b text-sm cursor-pointer">
                    <input type="checkbox" class="write-off-sublocation-checkbox mr-2" value="${sub.replace(/"/g, '&quot;')}" onchange="onWriteOffSublocationCheckboxChange()"> <span>${sub}</span>
                </label>
            `).join('');
        }
    } else {
        const checkboxList = document.getElementById('write-off-sublocation-checkbox-list');
        if (checkboxList) checkboxList.innerHTML = '';
    }

    const checkAll = document.getElementById('write-off-sublocation-check-all');
    if (checkAll) checkAll.checked = true;
    const label = document.getElementById('write-off-filter-sublocation-label');
    if (label) label.textContent = 'All Sublocations / Business Types';

    filterWriteOffs();
}

function toggleWriteOffSublocationCheckboxDropdown() {
    const dropdown = document.getElementById('write-off-filter-sublocation-dropdown');
    if (dropdown) dropdown.classList.toggle('hidden');
}

function filterWriteOffSublocationCheckboxes() {
    const search = (document.getElementById('write-off-sublocation-search')?.value || '').toLowerCase();
    const labels = document.querySelectorAll('#write-off-sublocation-checkbox-list label');
    labels.forEach(label => {
        const text = label.textContent.trim().toLowerCase();
        label.style.display = text.includes(search) ? '' : 'none';
    });
}

function onWriteOffSublocationCheckAllChange() {
    const checkAll = document.getElementById('write-off-sublocation-check-all');
    const checkboxes = document.querySelectorAll('.write-off-sublocation-checkbox');
    checkboxes.forEach(cb => cb.checked = checkAll.checked);
    updateWriteOffSublocationFilterLabel();
    filterWriteOffs();
}

function onWriteOffSublocationCheckboxChange() {
    const checkboxes = document.querySelectorAll('.write-off-sublocation-checkbox');
    const checkedCount = Array.from(checkboxes).filter(cb => cb.checked).length;
    const checkAll = document.getElementById('write-off-sublocation-check-all');
    if (checkAll) checkAll.checked = checkboxes.length > 0 && checkedCount === checkboxes.length;
    updateWriteOffSublocationFilterLabel();
    filterWriteOffs();
}

function updateWriteOffSublocationFilterLabel() {
    const label = document.getElementById('write-off-filter-sublocation-label');
    if (!label) return;
    const checkboxes = document.querySelectorAll('.write-off-sublocation-checkbox');
    const checked = Array.from(checkboxes).filter(cb => cb.checked);
    if (checked.length === 0 || checked.length === checkboxes.length) {
        label.textContent = 'All Sublocations / Business Types';
    } else if (checked.length === 1) {
        label.textContent = checked[0].nextElementSibling.textContent.trim();
    } else {
        label.textContent = checked.length + ' selected';
    }
}

function getSelectedWriteOffSublocationIds() {
    const checkboxes = document.querySelectorAll('.write-off-sublocation-checkbox');
    const allChecked = document.getElementById('write-off-sublocation-check-all');
    if (allChecked && allChecked.checked) return [];
    return Array.from(checkboxes).filter(cb => cb.checked).map(cb => cb.value);
}

document.addEventListener('click', function(event) {
    const btn = document.getElementById('write-off-filter-sublocation-btn');
    const dropdown = document.getElementById('write-off-filter-sublocation-dropdown');
    if (btn && dropdown && !btn.contains(event.target) && !dropdown.contains(event.target)) {
        dropdown.classList.add('hidden');
    }
});

let writeOffEquipmentList = [];
let writeOffEquipmentSelectedIndex = -1;

async function populateWriteOffEquipmentSelect() {
    try {
        const response = await fetch(`${API_BASE}/equipment`);
        writeOffEquipmentList = (await response.json()).filter(eq => (eq.display_status || eq.status) !== 'Written Off');
        document.getElementById('write-off-equipment').value = '';
        document.getElementById('write-off-equipment-search').value = '';
        filterWriteOffEquipmentByLocation();
    } catch (error) {
        console.error('Error loading equipment for write-off:', error);
    }
}

let writeOffFilteredList = [];

function filterWriteOffEquipmentByLocation() {
    const countryId   = document.getElementById('wo-filter-country')?.value || '';
    const locationId  = document.getElementById('wo-filter-location')?.value || '';
    const sublocation = document.getElementById('wo-filter-sublocation')?.value || '';

    const dropdown = document.getElementById('write-off-equipment-dropdown');
    const countEl = document.getElementById('wo-eq-count');

    if (!countryId) {
        writeOffFilteredList = [];
        if (countEl) countEl.textContent = '(0)';
        document.getElementById('write-off-equipment').value = '';
        document.getElementById('write-off-equipment-search').value = '';
        if (dropdown) {
            dropdown.innerHTML = '<div class="px-3 py-2 text-gray-500 text-sm">Select a country first</div>';
            dropdown.classList.add('hidden');
        }
        return;
    }

    let filtered = writeOffEquipmentList;
    if (countryId) {
        filtered = filtered.filter(eq => String(eq.country_id || '') === countryId);
    }
    if (locationId) {
        filtered = filtered.filter(eq => String(eq.location_type_id || '') === locationId);
    }
    if (sublocation) {
        filtered = filtered.filter(eq => String(eq.location_id || '') === sublocation);
    }

    writeOffFilteredList = filtered;
    if (countEl) countEl.textContent = `(${filtered.length})`;

    writeOffEquipmentSelectedIndex = -1;
    renderWriteOffEquipmentDropdown(filtered);
}

function renderWriteOffEquipmentDropdown(equipment) {
    const dropdown = document.getElementById('write-off-equipment-dropdown');
    if (!dropdown) return;
    if (!equipment || equipment.length === 0) {
        dropdown.innerHTML = '<div class="px-3 py-2 text-gray-500 text-sm">No equipment found</div>';
        dropdown.classList.remove('hidden');
        return;
    }
    dropdown.innerHTML = equipment.map((eq, index) => `
        <div class="write-off-equipment-option px-3 py-2 cursor-pointer hover:bg-gray-100 text-sm ${index === writeOffEquipmentSelectedIndex ? 'bg-gray-100' : ''}"
            data-id="${eq.id}"
            data-index="${index}"
            onclick="selectWriteOffEquipment(${eq.id}, '${(eq.auto_serial_number || eq.name || '').replace(/'/g, "\\'")} - ${(eq.name || '').replace(/'/g, "\\'")}')">
            ${eq.auto_serial_number || ''} - ${eq.name || ''}
        </div>
    `).join('');
    dropdown.classList.remove('hidden');
}

function filterWriteOffEquipmentOptions() {
    const searchText = document.getElementById('write-off-equipment-search').value.toLowerCase();
    const filtered = writeOffFilteredList.filter(eq =>
        (eq.auto_serial_number && eq.auto_serial_number.toLowerCase().includes(searchText)) ||
        (eq.name && eq.name.toLowerCase().includes(searchText)) ||
        (eq.barcode && eq.barcode.toLowerCase().includes(searchText))
    );
    writeOffEquipmentSelectedIndex = -1;
    renderWriteOffEquipmentDropdown(filtered);
}

function showWriteOffEquipmentDropdown() {
    const countryId = document.getElementById('wo-filter-country')?.value || '';
    if (!countryId) return;
    const dropdown = document.getElementById('write-off-equipment-dropdown');
    if (dropdown) dropdown.classList.remove('hidden');
}

function hideWriteOffEquipmentDropdown() {
    const dropdown = document.getElementById('write-off-equipment-dropdown');
    if (dropdown) dropdown.classList.add('hidden');
}

function selectWriteOffEquipment(id, displayText) {
    document.getElementById('write-off-equipment').value = id;
    document.getElementById('write-off-equipment-search').value = displayText;
    hideWriteOffEquipmentDropdown();
}

function handleWriteOffEquipmentKeydown(event) {
    const dropdown = document.getElementById('write-off-equipment-dropdown');
    const searchText = document.getElementById('write-off-equipment-search').value.toLowerCase();
    const filtered = writeOffFilteredList.filter(eq =>
        (eq.auto_serial_number && eq.auto_serial_number.toLowerCase().includes(searchText)) ||
        (eq.name && eq.name.toLowerCase().includes(searchText)) ||
        (eq.barcode && eq.barcode.toLowerCase().includes(searchText))
    );

    if (event.key === 'ArrowDown') {
        event.preventDefault();
        writeOffEquipmentSelectedIndex = Math.min(writeOffEquipmentSelectedIndex + 1, filtered.length - 1);
        renderWriteOffEquipmentDropdown(filtered);
    } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        writeOffEquipmentSelectedIndex = Math.max(writeOffEquipmentSelectedIndex - 1, -1);
        renderWriteOffEquipmentDropdown(filtered);
    } else if (event.key === 'Enter') {
        event.preventDefault();
        if (writeOffEquipmentSelectedIndex >= 0 && filtered[writeOffEquipmentSelectedIndex]) {
            const eq = filtered[writeOffEquipmentSelectedIndex];
            selectWriteOffEquipment(eq.id, `${eq.auto_serial_number || ''} - ${eq.name || ''}`);
        }
    } else if (event.key === 'Escape') {
        hideWriteOffEquipmentDropdown();
    }
}

// Close dropdown when clicking outside
document.addEventListener('click', function(event) {
    const container = document.getElementById('write-off-equipment-search');
    const dropdown = document.getElementById('write-off-equipment-dropdown');
    if (container && dropdown && !container.contains(event.target) && !dropdown.contains(event.target)) {
        hideWriteOffEquipmentDropdown();
    }
});

function renderWriteOffPhotoPreview(files) {
    const preview = document.getElementById('write-off-photo-preview');
    if (!preview) return;
    preview.innerHTML = '';
    if (!files) return;
    Array.from(files).forEach(file => {
        const reader = new FileReader();
        reader.onload = function(e) {
            preview.innerHTML += `<img src="${e.target.result}" class="h-16 w-16 object-cover rounded border">`;
        };
        reader.readAsDataURL(file);
    });
}

function renderExistingWriteOffPhotos(photos) {
    const container = document.getElementById('write-off-existing-photos');
    if (!container) return;
    container.innerHTML = '';
    if (!photos || photos.length === 0) return;
    container.innerHTML = photos.map(p => `
        <div class="relative inline-block">
            <img src="${p.photo_path}" class="h-16 w-16 object-cover rounded border">
            <button type="button" onclick="deleteWriteOffPhoto(${p.write_off_id}, ${p.id})" class="absolute -top-1 -right-1 bg-red-600 text-white rounded-full h-4 w-4 flex items-center justify-center text-xs" title="Delete photo">&times;</button>
        </div>
    `).join('');
}

function setupWriteOffPhotoPreview() {
    const input = document.getElementById('write-off-photos');
    if (!input) return;
    input.addEventListener('change', function() {
        renderWriteOffPhotoPreview(this.files);
    });
}

async function openWriteOffModal() {
    const modal = document.getElementById('write-off-modal');
    const form = document.getElementById('write-off-form');
    if (form) form.reset();
    document.getElementById('write-off-id').value = '';
    document.getElementById('write-off-modal-title').textContent = 'New Write Off';
    document.getElementById('write-off-status').value = 'Pending';
    const statusWrapper = document.getElementById('write-off-status-wrapper');
    if (statusWrapper) statusWrapper.classList.add('hidden');
    renderWriteOffPhotoPreview([]);
    renderExistingWriteOffPhotos([]);
    setupWriteOffPhotoPreview();
    hideWriteOffEquipmentDropdown();

    // Init cascading location dropdowns
    await ensureCascadingLocationData();
    const countrySel = document.getElementById('wo-filter-country');
    if (countrySel) {
        countrySel.innerHTML = '<option value="">All Countries</option>' +
            (window.allCountries || []).map(c => `<option value="${c.id}">${c.name}</option>`).join('');
    }
    const locSel = document.getElementById('wo-filter-location');
    if (locSel) locSel.innerHTML = '<option value="">All Locations</option>';
    const subSel = document.getElementById('wo-filter-sublocation');
    if (subSel) subSel.innerHTML = '<option value="">All</option>';

    await populateWriteOffEquipmentSelect();
    if (modal) modal.classList.add('active');
}

function closeWriteOffModal() {
    const modal = document.getElementById('write-off-modal');
    if (modal) modal.classList.remove('active');
}

async function editWriteOff(id) {
    const wo = allWriteOffs.find(w => w.id === id);
    if (!wo) return;
    const modal = document.getElementById('write-off-modal');
    const form = document.getElementById('write-off-form');
    if (form) form.reset();
    document.getElementById('write-off-id').value = wo.id;
    document.getElementById('write-off-modal-title').textContent = 'Edit Write Off';
    await populateWriteOffEquipmentSelect();
    const eq = writeOffEquipmentList.find(e => e.id === wo.equipment_id);
    if (eq) {
        selectWriteOffEquipment(eq.id, `${eq.auto_serial_number || ''} - ${eq.name || ''}`);
    } else {
        document.getElementById('write-off-equipment').value = wo.equipment_id || '';
        document.getElementById('write-off-equipment-search').value = `${wo.equipment_auto_serial || ''} - ${wo.equipment_name || ''}`;
    }
    document.getElementById('write-off-date').value = wo.write_off_date || '';
    document.getElementById('write-off-status').value = wo.status || 'Pending';
    const statusWrapper = document.getElementById('write-off-status-wrapper');
    if (statusWrapper) statusWrapper.classList.remove('hidden');
    document.getElementById('write-off-reason').value = wo.reason || '';
    document.getElementById('write-off-requested-by').value = wo.requested_by || '';
    document.getElementById('write-off-approved-by').value = wo.approved_by || '';
    document.getElementById('write-off-approval-date').value = wo.approval_date || '';
    document.getElementById('write-off-notes').value = wo.notes || '';
    renderWriteOffPhotoPreview([]);
    renderExistingWriteOffPhotos(wo.photos || []);
    setupWriteOffPhotoPreview();
    if (modal) modal.classList.add('active');
}

async function saveWriteOff(e) {
    e.preventDefault();
    const id = document.getElementById('write-off-id').value;
    const formData = new FormData();
    formData.append('equipment_id', document.getElementById('write-off-equipment').value);
    formData.append('write_off_date', document.getElementById('write-off-date').value);
    formData.append('status', document.getElementById('write-off-status').value);
    formData.append('reason', document.getElementById('write-off-reason').value);
    formData.append('requested_by', document.getElementById('write-off-requested-by').value);
    formData.append('approved_by', document.getElementById('write-off-approved-by').value);
    formData.append('approval_date', document.getElementById('write-off-approval-date').value);
    formData.append('notes', document.getElementById('write-off-notes').value);

    const photoInput = document.getElementById('write-off-photos');
    if (photoInput && photoInput.files) {
        Array.from(photoInput.files).forEach(file => {
            formData.append('photos', file);
        });
    }

    try {
        const url = id ? `${API_BASE}/equipment/write-offs/${id}?manager_id=${currentModuleManager ? currentModuleManager.id : ''}` : `${API_BASE}/equipment/write-offs`;
        const method = id ? 'PUT' : 'POST';
        const response = await fetch(url, {
            method: method,
            body: formData
        });

        if (response.ok) {
            closeWriteOffModal();
            loadWriteOffs();
            loadEquipment();
        } else {
            const err = await response.json();
            console.error('Error saving write-off:', err);
            alert('Error saving write-off: ' + (err.error || response.statusText));
        }
    } catch (error) {
        console.error('Error saving write-off:', error);
        alert('Error saving write-off');
    }
}

async function deleteWriteOff(id) {
    if (!currentModuleManager) {
        alert('Please select a module manager.');
        return;
    }
    if (!confirm('Are you sure you want to delete this write-off?')) return;
    try {
        const response = await fetch(`${API_BASE}/equipment/write-offs/${id}?manager_id=${currentModuleManager.id}`, {
            method: 'DELETE'
        });
        if (response.ok) {
            loadWriteOffs();
        } else {
            const err = await response.json();
            console.error('Error deleting write-off:', err);
            alert('Error deleting write-off: ' + (err.error || response.statusText));
        }
    } catch (error) {
        console.error('Error deleting write-off:', error);
        alert('Error deleting write-off');
    }
}

async function deleteWriteOffPhoto(writeOffId, photoId) {
    if (!confirm('Are you sure you want to delete this photo?')) return;
    try {
        const response = await fetch(`${API_BASE}/equipment/write-offs/${writeOffId}/photos/${photoId}`, {
            method: 'DELETE'
        });
        if (response.ok) {
            await loadWriteOffs();
            const wo = allWriteOffs.find(w => w.id === writeOffId);
            if (wo) renderExistingWriteOffPhotos(wo.photos || []);
        } else {
            const err = await response.json();
            console.error('Error deleting photo:', err);
            alert('Error deleting photo: ' + (err.error || response.statusText));
        }
    } catch (error) {
        console.error('Error deleting photo:', error);
        alert('Error deleting photo');
    }
}

let _currentViewedWriteOff = null;

function getWOStatusBadgeClass(status) {
    if (status === 'Approved') return 'bg-green-100 text-green-800';
    if (status === 'Rejected') return 'bg-red-100 text-red-800';
    return 'bg-yellow-100 text-yellow-800';
}

function viewWriteOff(id) {
    const wo = allWriteOffs.find(w => w.id === id);
    if (!wo) return;
    _currentViewedWriteOff = wo;

    const locationFull = [wo.equipment_country, wo.equipment_location, wo.equipment_sub_location, wo.equipment_business_type, wo.equipment_business_unit_code].filter(Boolean).join(' - ') || '-';

    document.getElementById('vwo-equipment-name').textContent = wo.equipment_name || '-';
    document.getElementById('vwo-auto-serial').textContent    = wo.equipment_auto_serial || '-';
    document.getElementById('vwo-barcode').textContent        = wo.equipment_barcode || '-';
    document.getElementById('vwo-serial-number').textContent  = wo.equipment_serial_number || '-';
    document.getElementById('vwo-category').textContent       = wo.equipment_category || '-';
    document.getElementById('vwo-brand').textContent          = wo.equipment_brand || '-';
    document.getElementById('vwo-model').textContent          = wo.equipment_model || '-';
    document.getElementById('vwo-condition').textContent      = wo.equipment_condition || '-';
    document.getElementById('vwo-eq-status').textContent      = wo.equipment_status || '-';
    document.getElementById('vwo-owner').textContent          = wo.equipment_owner || '-';
    document.getElementById('vwo-assigned-to').textContent    = wo.equipment_assigned_to || '-';
    document.getElementById('vwo-purchase-date').textContent  = formatDate(wo.equipment_purchase_date);
    document.getElementById('vwo-purchase-cost').textContent  = wo.equipment_purchase_cost || '-';
    document.getElementById('vwo-location').textContent       = locationFull;

    document.getElementById('vwo-date').textContent           = formatDate(wo.write_off_date);
    document.getElementById('vwo-status').innerHTML           = '<span class="px-2 py-0.5 text-xs rounded-full ' + getWOStatusBadgeClass(wo.status) + '">' + (wo.status || 'Pending') + '</span>';
    document.getElementById('vwo-requested-by').textContent   = wo.requested_by || '-';
    document.getElementById('vwo-approved-by').textContent    = wo.approved_by || '-';
    document.getElementById('vwo-approval-date').textContent  = formatDate(wo.approval_date);
    document.getElementById('vwo-reason').textContent         = wo.reason || '-';
    document.getElementById('vwo-notes').textContent          = wo.notes || '-';

    const photosEl = document.getElementById('vwo-photos');
    if (photosEl) {
        const photos = wo.photos || [];
        photosEl.innerHTML = photos.length
            ? photos.map(function(p) { return '<a href="' + p.photo_path + '" target="_blank"><img src="' + p.photo_path + '" class="h-20 w-20 object-cover rounded border hover:opacity-80"></a>'; }).join('')
            : '<span class="text-gray-400 text-sm">No photos</span>';
    }

    const modal = document.getElementById('view-writeoff-modal');
    if (modal) modal.classList.add('active');
}

function closeViewWriteOffModal() {
    const modal = document.getElementById('view-writeoff-modal');
    if (modal) modal.classList.remove('active');
}

function printWriteOffDetails() {
    const wo = _currentViewedWriteOff;
    if (!wo) return;

    var locationFull = [wo.equipment_country, wo.equipment_location, wo.equipment_sub_location, wo.equipment_business_type, wo.equipment_business_unit_code].filter(Boolean).join(' - ') || '-';

    var photos = wo.photos || [];
    var photoHtml = photos.length
        ? photos.map(function(p) { return '<img src="' + p.photo_path + '" style="height:110px;width:110px;object-fit:cover;border-radius:6px;border:1px solid #e2e8f0;">'; }).join('')
        : '<span style="color:#9ca3af;font-size:12px;">No photos</span>';

    var statusStyle = wo.status === 'Approved' ? 'background:#dcfce7;color:#166534'
                    : wo.status === 'Rejected' ? 'background:#fee2e2;color:#991b1b'
                    : 'background:#fef9c3;color:#854d0e';

    var woDate  = formatDate(wo.write_off_date);
    var appDate = formatDate(wo.approval_date);
    var purDate = formatDate(wo.equipment_purchase_date);

    var html = '<!DOCTYPE html><html><head><title>Write-Off Report - ' + (wo.equipment_name || '') + '</title>'
        + '<style>'
        + '@page{margin:1cm 1cm 1.8cm 1cm;@bottom-right{content:"Page " counter(page) " of " counter(pages);font-size:10px;color:#999;}}'
        + "body{font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;padding:0;margin:0;color:#333;font-size:11px;line-height:1.3;}"
        + '.page{max-width:800px;margin:0 auto;padding:20px;}'
        + '.doc-header{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #1e40af;padding-bottom:12px;margin-bottom:16px;}'
        + '.doc-header .logo-block{flex:1;}'
        + '.doc-header .logo-block img{max-height:80px;max-width:220px;object-fit:contain;display:block;}'
        + '.doc-header .logo-block .logo-fallback{display:none;font-size:13px;color:#6b7280;font-style:italic;}'
        + '.doc-header .title-block{flex:1;text-align:center;}'
        + '.doc-header .title-block h1{margin:0;font-size:22px;font-weight:700;color:#1e40af;letter-spacing:0.3px;}'
        + '.doc-header .title-block p{margin:4px 0 0;color:#6b7280;font-size:12px;}'
        + '.doc-header .doc-id{flex:1;text-align:right;}'
        + '.doc-header .doc-id .id-label{font-size:10px;color:#9ca3af;text-transform:uppercase;letter-spacing:0.5px;}'
        + '.doc-header .doc-id .id-value{font-size:14px;font-weight:700;color:#1f2937;}'
        + 'h2{font-size:11px;color:#555;margin:12px 0 4px;border-bottom:1px solid #ddd;padding-bottom:2px;text-transform:uppercase;letter-spacing:.04em;}'
        + 'table{width:100%;border-collapse:collapse;margin-bottom:4px;}'
        + 'td{padding:4px 6px;border:1px solid #e2e8f0;vertical-align:top;}'
        + '.lbl{font-weight:bold;background:#f8fafc;width:28%;}'
        + '.badge{display:inline-block;padding:2px 7px;border-radius:9999px;font-size:10px;font-weight:bold;}'
        + '.photos{display:flex;flex-wrap:wrap;gap:10px;margin-top:8px;}'
        + '.actions{text-align:center;margin-bottom:20px;}'
        + '.actions button{padding:10px 24px;font-size:14px;background:#1e40af;color:#fff;border:none;border-radius:6px;cursor:pointer;}'
        + '@media print{.actions{display:none;}}'
        + '</style></head><body>'
        + '<div class="page">'
        + '<div class="doc-header">'
        + '<div class="logo-block">'
        + '<img src="/company-logo/company-logo.png" alt="Company Logo" onerror="this.style.display=\'none\';this.nextElementSibling.style.display=\'block\';">'
        + '<div class="logo-fallback" style="display:none;">[Company Logo]<br><span style="font-size:10px;">Place company-logo.png in public/company-logo/</span></div>'
        + '</div>'
        + '<div class="title-block"><h1>Equipment Write-Off</h1><p>Write-Off Report</p></div>'
        + '<div class="doc-id"><div class="id-label">Generated On</div><div class="id-value">' + formatDate(new Date()) + '</div></div>'
        + '</div>'
        + '<div class="actions"><button onclick="window.print()">&#x1F5A8; Print / Save as PDF</button></div>'
        + '<h2>Equipment</h2>'
        + '<table>'
        + '<tr><td class="lbl">Name</td><td colspan="3">' + (wo.equipment_name || '-') + '</td></tr>'
        + '<tr><td class="lbl">Auto Serial</td><td>' + (wo.equipment_auto_serial || '-') + '</td><td class="lbl">Barcode</td><td>' + (wo.equipment_barcode || '-') + '</td></tr>'
        + '<tr><td class="lbl">Serial Number</td><td>' + (wo.equipment_serial_number || '-') + '</td><td class="lbl">Category</td><td>' + (wo.equipment_category || '-') + '</td></tr>'
        + '<tr><td class="lbl">Brand</td><td>' + (wo.equipment_brand || '-') + '</td><td class="lbl">Model</td><td>' + (wo.equipment_model || '-') + '</td></tr>'
        + '<tr><td class="lbl">Condition</td><td>' + (wo.equipment_condition || '-') + '</td><td class="lbl">Eq. Status</td><td>' + (wo.equipment_status || '-') + '</td></tr>'
        + '<tr><td class="lbl">Owner</td><td>' + (wo.equipment_owner || '-') + '</td><td class="lbl">Assigned To</td><td>' + (wo.equipment_assigned_to || '-') + '</td></tr>'
        + '<tr><td class="lbl">Purchase Date</td><td>' + purDate + '</td><td class="lbl">Purchase Cost</td><td>' + (wo.equipment_purchase_cost || '-') + '</td></tr>'
        + '<tr><td class="lbl">Location</td><td colspan="3">' + locationFull + '</td></tr>'
        + '</table>'
        + '<h2>Write-Off Request</h2>'
        + '<table>'
        + '<tr><td class="lbl">Write Off Date</td><td>' + woDate + '</td><td class="lbl">Status</td><td><span class="badge" style="' + statusStyle + '">' + (wo.status || 'Pending') + '</span></td></tr>'
        + '<tr><td class="lbl">Requested By</td><td>' + (wo.requested_by || '-') + '</td><td class="lbl">Approved By</td><td>' + (wo.approved_by || '-') + '</td></tr>'
        + '<tr><td class="lbl">Approval Date</td><td colspan="3">' + appDate + '</td></tr>'
        + '<tr><td class="lbl">Reason</td><td colspan="3">' + (wo.reason || '-') + '</td></tr>'
        + '<tr><td class="lbl">Notes</td><td colspan="3">' + (wo.notes || '-') + '</td></tr>'
        + '</table>'
        + '<h2>Photos</h2><div class="photos">' + photoHtml + '</div>'
        + '</div></body></html>';

    var iframe = document.createElement('iframe');
    iframe.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;border:none;z-index:9999;';
    document.body.appendChild(iframe);
    iframe.contentWindow.document.open();
    iframe.contentWindow.document.write(html);
    iframe.contentWindow.document.close();
    iframe.contentWindow.focus();
    iframe.contentWindow.print();
    iframe.style.visibility = 'hidden';
    var remove = function() { if (iframe.parentNode) document.body.removeChild(iframe); };
    try { iframe.contentWindow.addEventListener('afterprint', remove, { once: true }); } catch(e) {}
    setTimeout(remove, 500);
}

function highlightWriteOffFilters() {
    highlightFilters([
        'write-off-search',
        'write-off-filter-status',
        'write-off-filter-country',
        'write-off-filter-location',
        'write-off-filter-owner'
    ], 'write-off-filter-sublocation-btn', 'write-off-sublocation-checkbox', 'write-off-sublocation-check-all');
}

function clearWriteOffFilters() {
    clearAllFilters([
        'write-off-search',
        'write-off-filter-status',
        'write-off-filter-country',
        'write-off-filter-location',
        'write-off-filter-owner'
    ], 'write-off-sublocation-checkbox', 'write-off-sublocation-check-all', 'write-off-filter-sublocation-label', 'write-off-sublocation-checkbox-list', filterWriteOffs);
}

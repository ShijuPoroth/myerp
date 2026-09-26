// Spare Parts Management
let allSpareParts = [];

async function loadSpareParts() {
    showTableLoading('spare-parts-table-body', 'Loading spare parts...');
    try {
const response = await fetch(`${API_BASE}/equipment/spare-parts`);
        allSpareParts = await response.json();
populateSparePartsCategoryFilter();
        populateSparePartsLocationFilters();
        filterSpareParts();
    } catch (error) {
        console.error('Error loading spare parts:', error);
        showTableError('spare-parts-table-body', 'Error loading spare parts.');
    }
}

function parseSparePartLocationString(location) {
    const parts = (location || '').split(' - ').map(s => s.trim()).filter(Boolean);
    return {
        country: parts[0] || '',
        location: parts[1] || '',
        sublocation: parts.slice(2).join(' - ') || ''
    };
}

function renderSpareParts(parts = allSpareParts) {
    const tbody = document.getElementById('spare-parts-table-body');
if (!tbody) {
        return;
    }
    const total = parts.length;
    tbody.innerHTML = parts.map((part, index) => {
        const serial = total - index;
        const loc = parseSparePartLocationString(part.location);
        return `
        <tr>
            <td class="px-3 py-2 whitespace-nowrap text-gray-500 text-xs">${serial}</td>
            <td class="px-3 py-2 whitespace-nowrap">${part.photo_path ? `<img src="${part.photo_path}" onclick="openPhotoLightbox('${part.photo_path}')" class="w-8 h-8 rounded object-cover border bg-gray-50 cursor-pointer hover:opacity-80">` : `<span class="w-8 h-8 rounded bg-gray-100 inline-flex items-center justify-center text-gray-400 text-xs"><i class="fas fa-image"></i></span>`}</td>
            <td class="px-3 py-2 whitespace-nowrap">${part.spare_part_serial_number || part.purchase_order_number || '-'}</td>
            <td class="px-3 py-2 whitespace-nowrap">${part.po_number || '-'}</td>
            <td class="px-3 py-2 whitespace-nowrap">${part.part_serial_number || part.part_number || '-'}</td>
            <td class="px-3 py-2 max-w-32 truncate" title="${part.name || ''}">${part.name || '-'}</td>
            <td class="px-3 py-2 whitespace-nowrap">${part.brand || '-'}</td>
            <td class="px-3 py-2 whitespace-nowrap">${part.category || '-'}</td>
            <td class="px-3 py-2 whitespace-nowrap">${part.quantity || 0}</td>
            <td class="px-3 py-2 whitespace-nowrap">${part.unit_cost ? '$' + parseFloat(part.unit_cost).toFixed(2) : '-'}</td>
            <td class="px-3 py-2 whitespace-nowrap">${part.total_cost ? '$' + parseFloat(part.total_cost).toFixed(2) : '-'}</td>
            <td class="px-3 py-2 max-w-32 truncate" title="${loc.country}">${loc.country || '-'}</td>
            <td class="px-3 py-2 max-w-32 truncate" title="${loc.location}">${loc.location || '-'}</td>
            <td class="px-3 py-2 max-w-40 truncate" title="${loc.sublocation}">${loc.sublocation || '-'}</td>
            <td class="px-3 py-2 max-w-32 truncate" title="${part.supplier || ''}">${part.supplier || '-'}</td>
            <td class="px-3 py-2 whitespace-nowrap">${formatDate(part.purchase_date)}</td>
            <td class="px-3 py-2 whitespace-nowrap">
                <button onclick="viewSparePartHistory(${part.id})" class="text-green-600 hover:text-green-800 mr-2" title="View History">
                    <i class="fas fa-history"></i>
                </button>
                <button onclick="openAddStockModal(${part.id})" class="text-purple-600 hover:text-purple-800 mr-2" title="Add Stock">
                    <i class="fas fa-plus-circle"></i>
                </button>
                ${getEditActionButton('spare-parts', 'editSparePart', part.id)}
                ${getDeleteActionButton('spare-parts', 'deleteSparePart', part.id)}
            </td>
        </tr>
        `;
    }).join('');
}

function filterSpareParts() {
    highlightSparePartsFilters();
    const searchText = document.getElementById('spare-parts-search').value.toLowerCase();
    const category = document.getElementById('spare-parts-filter-category').value;
    const country = document.getElementById('spare-parts-filter-country')?.value || '';
    const location = document.getElementById('spare-parts-filter-location')?.value || '';
    const selectedSublocationIds = getSelectedSparePartsSublocationIds();

    let filtered = allSpareParts;

    if (category) {
        filtered = filtered.filter(part => part.category === category);
    }

    if (country) {
        filtered = filtered.filter(part => {
            const loc = parseSparePartLocationString(part.location);
            return loc.country === country;
        });
    }
    if (location) {
        filtered = filtered.filter(part => {
            const loc = parseSparePartLocationString(part.location);
            return loc.location === location;
        });
    }
    if (selectedSublocationIds.length > 0) {
        filtered = filtered.filter(part => {
            const loc = parseSparePartLocationString(part.location);
            return selectedSublocationIds.includes(loc.sublocation);
        });
    }

    if (searchText) {
        filtered = filtered.filter(part => {
            const loc = parseSparePartLocationString(part.location);
            return (part.name && part.name.toLowerCase().includes(searchText)) ||
                (part.part_number && part.part_number.toLowerCase().includes(searchText)) ||
                (part.brand && part.brand.toLowerCase().includes(searchText)) ||
                (loc.country && loc.country.toLowerCase().includes(searchText)) ||
                (loc.location && loc.location.toLowerCase().includes(searchText)) ||
                (loc.sublocation && loc.sublocation.toLowerCase().includes(searchText));
        });
    }

    renderSpareParts(filtered);
}

function populateSparePartsCategoryFilter() {
    const categorySelect = document.getElementById('spare-parts-filter-category');
    if (categorySelect) {
        const uniqueCategories = [...new Set(allSpareParts.map(part => part.category).filter(cat => cat))];
        categorySelect.innerHTML = '<option value="">All Categories</option>' +
            uniqueCategories.map(cat => `<option value="${cat}">${cat}</option>`).join('');
    }
}

function populateSparePartsLocationFilters() {
    if (!allSpareParts || allSpareParts.length === 0) return;

    const countrySelect = document.getElementById('spare-parts-filter-country');
    if (countrySelect) {
        const uniqueCountries = [...new Set(allSpareParts.map(part => parseSparePartLocationString(part.location).country).filter(c => c))].sort();
        countrySelect.innerHTML = '<option value="">All Countries</option>' +
            uniqueCountries.map(c => `<option value="${c}">${c}</option>`).join('');
    }

    const locationSelect = document.getElementById('spare-parts-filter-location');
    if (locationSelect) {
        locationSelect.innerHTML = '<option value="">All Locations</option>';
    }

    const checkboxList = document.getElementById('spare-parts-sublocation-checkbox-list');
    if (checkboxList) checkboxList.innerHTML = '';
    const checkAll = document.getElementById('spare-parts-sublocation-check-all');
    if (checkAll) checkAll.checked = true;
    const label = document.getElementById('spare-parts-filter-sublocation-label');
    if (label) label.textContent = 'All Sublocations / Business Types';
}

function onSparePartsFilterCountryChange() {
    const country = document.getElementById('spare-parts-filter-country').value;
    const locationSelect = document.getElementById('spare-parts-filter-location');

    if (country && allSpareParts && allSpareParts.length) {
        const locationNames = [...new Set(allSpareParts
            .map(part => parseSparePartLocationString(part.location))
            .filter(loc => loc.country === country)
            .map(loc => loc.location)
            .filter(loc => loc))].sort();
        locationSelect.innerHTML = '<option value="">All Locations</option>' +
            locationNames.map(loc => `<option value="${loc}">${loc}</option>`).join('');
    } else {
        locationSelect.innerHTML = '<option value="">All Locations</option>';
    }

    const checkboxList = document.getElementById('spare-parts-sublocation-checkbox-list');
    if (checkboxList) checkboxList.innerHTML = '';
    const checkAll = document.getElementById('spare-parts-sublocation-check-all');
    if (checkAll) checkAll.checked = true;
    const label = document.getElementById('spare-parts-filter-sublocation-label');
    if (label) label.textContent = 'All Sublocations / Business Types';

    filterSpareParts();
}

function onSparePartsFilterLocationChange() {
    const country = document.getElementById('spare-parts-filter-country').value;
    const location = document.getElementById('spare-parts-filter-location').value;

    if (country && location && allSpareParts && allSpareParts.length) {
        const subOptions = [...new Set(allSpareParts
            .map(part => parseSparePartLocationString(part.location))
            .filter(loc => loc.country === country && loc.location === location)
            .map(loc => loc.sublocation)
            .filter(sub => sub))].sort();

        const checkboxList = document.getElementById('spare-parts-sublocation-checkbox-list');
        if (checkboxList) {
            checkboxList.innerHTML = subOptions.map(sub => `
                <label class="flex items-center px-3 py-2 hover:bg-gray-50 border-b text-sm cursor-pointer">
                    <input type="checkbox" class="spare-parts-sublocation-checkbox mr-2" value="${sub.replace(/"/g, '&quot;')}" onchange="onSparePartsSublocationCheckboxChange()"> <span>${sub}</span>
                </label>
            `).join('');
        }
    } else {
        const checkboxList = document.getElementById('spare-parts-sublocation-checkbox-list');
        if (checkboxList) checkboxList.innerHTML = '';
    }

    const checkAll = document.getElementById('spare-parts-sublocation-check-all');
    if (checkAll) checkAll.checked = true;
    const label = document.getElementById('spare-parts-filter-sublocation-label');
    if (label) label.textContent = 'All Sublocations / Business Types';

    filterSpareParts();
}

function toggleSparePartsSublocationCheckboxDropdown() {
    const dropdown = document.getElementById('spare-parts-filter-sublocation-dropdown');
    if (dropdown) dropdown.classList.toggle('hidden');
}

function filterSparePartsSublocationCheckboxes() {
    const search = (document.getElementById('spare-parts-sublocation-search')?.value || '').toLowerCase();
    const labels = document.querySelectorAll('#spare-parts-sublocation-checkbox-list label');
    labels.forEach(label => {
        const text = label.textContent.trim().toLowerCase();
        label.style.display = text.includes(search) ? '' : 'none';
    });
}

function onSparePartsSublocationCheckAllChange() {
    const checkAll = document.getElementById('spare-parts-sublocation-check-all');
    const checkboxes = document.querySelectorAll('.spare-parts-sublocation-checkbox');
    checkboxes.forEach(cb => cb.checked = checkAll.checked);
    updateSparePartsSublocationFilterLabel();
    filterSpareParts();
}

function onSparePartsSublocationCheckboxChange() {
    const checkboxes = document.querySelectorAll('.spare-parts-sublocation-checkbox');
    const checkedCount = Array.from(checkboxes).filter(cb => cb.checked).length;
    const checkAll = document.getElementById('spare-parts-sublocation-check-all');
    if (checkAll) checkAll.checked = checkboxes.length > 0 && checkedCount === checkboxes.length;
    updateSparePartsSublocationFilterLabel();
    filterSpareParts();
}

function updateSparePartsSublocationFilterLabel() {
    const label = document.getElementById('spare-parts-filter-sublocation-label');
    if (!label) return;
    const checkboxes = document.querySelectorAll('.spare-parts-sublocation-checkbox');
    const checked = Array.from(checkboxes).filter(cb => cb.checked);
    if (checked.length === 0 || checked.length === checkboxes.length) {
        label.textContent = 'All Sublocations / Business Types';
    } else if (checked.length === 1) {
        label.textContent = checked[0].nextElementSibling.textContent.trim();
    } else {
        label.textContent = checked.length + ' selected';
    }
}

function getSelectedSparePartsSublocationIds() {
    const checkboxes = document.querySelectorAll('.spare-parts-sublocation-checkbox');
    const allChecked = document.getElementById('spare-parts-sublocation-check-all');
    if (allChecked && allChecked.checked) return [];
    return Array.from(checkboxes).filter(cb => cb.checked).map(cb => cb.value);
}

document.addEventListener('click', function(event) {
    const btn = document.getElementById('spare-parts-filter-sublocation-btn');
    const dropdown = document.getElementById('spare-parts-filter-sublocation-dropdown');
    if (btn && dropdown && !btn.contains(event.target) && !dropdown.contains(event.target)) {
        dropdown.classList.add('hidden');
    }
});

async function openSparePartModal(id = null) {
    const modal = document.getElementById('spare-part-modal');
    const form = document.getElementById('spare-part-form');
    const title = document.getElementById('spare-part-modal-title');

    form.reset();
    document.getElementById('spare-part-id').value = '';
    document.getElementById('spare-part-existing-photo').value = '';
    document.getElementById('spare-part-photo-preview').innerHTML = '';

    // Add event listener to form
    const newForm = form.cloneNode(true);
    form.parentNode.replaceChild(newForm, form);
    newForm.addEventListener('submit', saveSparePart);

    // Add photo preview listener
    const photoInput = document.getElementById('spare-part-photo');
    if (photoInput) {
        photoInput.addEventListener('change', function(e) {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = function(e) {
                    document.getElementById('spare-part-photo-preview').innerHTML = `<img src="${e.target.result}" class="h-20 w-20 object-cover rounded">`;
                };
                reader.readAsDataURL(file);
            }
        });
    }

    // Load supplier assignments if not already loaded
    if (!window.allSupplierAssignments) {
        loadSupplierAssignmentsForEquipment();
    }

    // Load cascading location data and populate country select
    ensureCascadingLocationData().then(() => {
        populateCascadingCountrySelect('spare-part-country');
        const locationSelect = document.getElementById('spare-part-location');
        const sublocationSelect = document.getElementById('spare-part-sublocation');
        if (locationSelect) locationSelect.innerHTML = '<option value="">Select Location</option>';
        if (sublocationSelect) sublocationSelect.innerHTML = '<option value="">Select Sublocation / Business Type</option>';
    });

    // Fetch next serial number for new parts
    if (!id) {
        document.getElementById('spare-part-quantity').readOnly = false;
        document.getElementById('spare-part-quantity').classList.remove('bg-gray-100', 'cursor-not-allowed');
        fetch(`${API_BASE}/equipment/spare-parts/next-serial`)
            .then(response => response.json())
            .then(data => {
                document.getElementById('spare-part-serial').value = data.next_serial;
            })
            .catch(error => {
                console.error('Error fetching next spare part serial:', error);
                document.getElementById('spare-part-serial').value = 'SP-001';
            });
    }

    if (id) {
        title.textContent = 'Edit Spare Part';
        const part = allSpareParts.find(p => p.id === id);
        if (part) {
            document.getElementById('spare-part-id').value = part.id;
            document.getElementById('spare-part-serial').value = part.spare_part_serial_number || part.purchase_order_number || '';
            document.getElementById('spare-part-po-number').value = part.po_number || '';
            document.getElementById('spare-part-number').value = part.part_serial_number || part.part_number || '';
            document.getElementById('spare-part-name').value = part.name;
            document.getElementById('spare-part-brand').value = part.brand || '';
            document.getElementById('spare-part-category').value = part.category || '';
            document.getElementById('spare-part-specification').value = part.specification || '';
            document.getElementById('spare-part-quantity').value = part.quantity || 0;
            document.getElementById('spare-part-quantity').readOnly = false;
            document.getElementById('spare-part-quantity').classList.remove('bg-gray-100', 'cursor-not-allowed');
            document.getElementById('spare-part-unit-cost').value = part.unit_cost || '';
            document.getElementById('spare-part-total-cost').value = part.total_cost || '';
            // Restore cascading location selects and hidden location value
            await setCascadingLocationByFullString(part.location || '', 'spare-part-country', 'spare-part-location', 'spare-part-sublocation', 'spare-part-location-hidden');
            document.getElementById('spare-part-purchase-date').value = part.purchase_date || '';
            document.getElementById('spare-part-existing-photo').value = part.photo_path || '';

            // Trigger sublocation change to populate suppliers
            const sublocationSelect = document.getElementById('spare-part-sublocation');
            if (sublocationSelect && sublocationSelect.value) {
                sublocationSelect.dispatchEvent(new Event('change'));
                // Set supplier after suppliers are populated
                setTimeout(() => {
                    document.getElementById('spare-part-supplier').value = part.supplier_id || '';
                }, 100);
            }

            if (part.photo_path) {
                document.getElementById('spare-part-photo-preview').innerHTML = `<img src="${part.photo_path}" class="h-20 w-20 object-cover rounded">`;
            }
        }
    } else {
        title.textContent = 'Add Spare Part';
    }

    modal.classList.add('active');
}

function calculateTotalCost() {
    const quantity = parseFloat(document.getElementById('spare-part-quantity').value) || 0;
    const unitCost = parseFloat(document.getElementById('spare-part-unit-cost').value) || 0;
    const totalCost = quantity * unitCost;
    document.getElementById('spare-part-total-cost').value = totalCost.toFixed(2);
}

function onSparePartSublocationChange() {
    const sublocationSelect = document.getElementById('spare-part-sublocation');
    const hiddenInput = document.getElementById('spare-part-location-hidden');
    const supplierSelect = document.getElementById('spare-part-supplier');
    const locationId = sublocationSelect ? sublocationSelect.value : '';

    // Update hidden location text to the full combined name of selected assignment
    if (hiddenInput && window.allBusinessTypeAssignments) {
        const assignment = window.allBusinessTypeAssignments.find(a => a.id == locationId);
        hiddenInput.value = assignment ? formatFullLocationString(assignment) : '';
    }

    // Filter suppliers by selected assignment
    if (supplierSelect) {
        supplierSelect.innerHTML = '<option value="">Select Supplier</option>';
        if (locationId && window.allSupplierAssignments) {
            const assignedSuppliers = window.allSupplierAssignments.filter(a => a.business_type_assignment_id == locationId);
            assignedSuppliers.forEach(sup => {
                supplierSelect.innerHTML += `<option value="${sup.supplier_id}">${sup.supplier_name}</option>`;
            });
        }
    }
}

function closeSparePartModal() {
    document.getElementById('spare-part-modal').classList.remove('active');
}

async function saveSparePart(e) {
    e.preventDefault();
    const id = document.getElementById('spare-part-id').value;
    const formData = new FormData();

    formData.append('purchase_order_number', document.getElementById('spare-part-serial').value);
    formData.append('po_number', document.getElementById('spare-part-po-number').value);
    formData.append('part_serial_number', document.getElementById('spare-part-number').value);
    formData.append('name', document.getElementById('spare-part-name').value);
    formData.append('brand', document.getElementById('spare-part-brand').value);
    formData.append('category', document.getElementById('spare-part-category').value);
    formData.append('specification', document.getElementById('spare-part-specification').value);
    formData.append('quantity', document.getElementById('spare-part-quantity').value);
    formData.append('unit_cost', document.getElementById('spare-part-unit-cost').value);
    formData.append('total_cost', document.getElementById('spare-part-total-cost').value);
    formData.append('location', document.getElementById('spare-part-location-hidden').value);
    formData.append('supplier_id', document.getElementById('spare-part-supplier').value);
    formData.append('purchase_date', document.getElementById('spare-part-purchase-date').value);
    formData.append('existing_photo', document.getElementById('spare-part-existing-photo').value);

    const photoInput = document.getElementById('spare-part-photo');
    if (photoInput.files[0]) {
        formData.append('photo', photoInput.files[0]);
    }

    try {
        const url = id ? `${API_BASE}/equipment/spare-parts/${id}?manager_id=${currentModuleManager ? currentModuleManager.id : ''}` : `${API_BASE}/equipment/spare-parts`;
        const method = id ? 'PUT' : 'POST';

        const response = await fetch(url, {
            method: method,
            body: formData
        });

        if (response.ok) {
            closeSparePartModal();
            loadSpareParts();
        } else {
            const text = await response.text().catch(() => 'Unknown error');
            let message = `Server error ${response.status}`;
            try {
                const error = JSON.parse(text);
                message = error.error || error.message || message;
            } catch (e) {
                if (text) message = text.substring(0, 200);
            }
            alert('Error saving spare part: ' + message);
        }
    } catch (error) {
        console.error('Error saving spare part:', error);
        alert('Error saving spare part: ' + error.message);
    }
}

function editSparePart(id) {
    openSparePartModal(id);
}

async function deleteSparePart(id) {
    if (!currentModuleManager) {
        alert('Please select a module manager.');
        return;
    }
    const part = allSpareParts.find(p => p.id === id);
    if (confirm(`Are you sure you want to delete ${part?.name || 'this spare part'}?`)) {
        try {
            const response = await fetch(`${API_BASE}/equipment/spare-parts/${id}?manager_id=${currentModuleManager.id}`, { method: 'DELETE' });
            if (response.ok) {
                loadSpareParts();
            } else {
                const data = await response.json();
                alert(data.error || 'Could not delete spare part.');
            }
        } catch (error) {
            console.error('Error deleting spare part:', error);
            alert('Error deleting spare part.');
        }
    }
}

function calculateAddStockTotal() {
    const quantity = parseFloat(document.getElementById('add-stock-quantity').value) || 0;
    const unitCost = parseFloat(document.getElementById('add-stock-unit-cost').value) || 0;
    document.getElementById('add-stock-total-cost').value = (quantity * unitCost).toFixed(2);
}

function openAddStockModal(id) {
    const modal = document.getElementById('add-stock-modal');
    const form = document.getElementById('add-stock-form');
    const title = document.getElementById('add-stock-modal-title');
    const part = allSpareParts.find(p => p.id === id);

    form.reset();
    document.getElementById('add-stock-spare-part-id').value = id;
    title.textContent = `Add Stock - ${part ? part.name : ''}`;
    document.getElementById('add-stock-purchase-date').value = new Date().toISOString().split('T')[0];
    if (part && part.unit_cost) {
        document.getElementById('add-stock-unit-cost').value = part.unit_cost;
    }
    calculateAddStockTotal();
    modal.classList.add('active');
}

function closeAddStockModal() {
    document.getElementById('add-stock-modal').classList.remove('active');
}

async function saveAddStock(e) {
    e.preventDefault();
    const id = document.getElementById('add-stock-spare-part-id').value;
    const data = {
        quantity: parseInt(document.getElementById('add-stock-quantity').value),
        unit_cost: parseFloat(document.getElementById('add-stock-unit-cost').value) || 0,
        total_cost: parseFloat(document.getElementById('add-stock-total-cost').value) || 0,
        supplier: document.getElementById('add-stock-supplier').value,
        purchase_date: document.getElementById('add-stock-purchase-date').value,
        notes: document.getElementById('add-stock-notes').value
    };

    try {
        const response = await fetch(`${API_BASE}/equipment/spare-parts/${id}/purchase`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        if (response.ok) {
            closeAddStockModal();
            loadSpareParts();
        } else {
            const text = await response.text().catch(() => 'Unknown error');
            alert('Error adding stock: ' + text);
        }
    } catch (error) {
        console.error('Error adding stock:', error);
        alert('Error adding stock: ' + error.message);
    }
}

async function viewSparePartHistory(id) {
    const part = allSpareParts.find(p => p.id === id);
    if (!part) return;

    _currentSparePartHistoryPart = part;

    document.getElementById('spare-part-history-modal-title').textContent = 'Spare Part History';
    document.getElementById('spare-part-history-name').textContent = part.name || '-';
    document.getElementById('spare-part-history-serial').textContent = part.part_serial_number || part.part_number || '-';
    document.getElementById('spare-part-history-po').textContent = part.po_number || '-';
    document.getElementById('spare-part-history-auto-serial').textContent = part.spare_part_serial_number || part.purchase_order_number || '-';
    document.getElementById('spare-part-history-brand').textContent = part.brand || '-';
    document.getElementById('spare-part-history-category').textContent = part.category || '-';
    document.getElementById('spare-part-history-stock').textContent = part.quantity || 0;
    document.getElementById('spare-part-history-unit-cost').textContent = part.unit_cost ? '$' + parseFloat(part.unit_cost).toFixed(2) : '-';
    document.getElementById('spare-part-history-total-cost').textContent = part.total_cost ? '$' + parseFloat(part.total_cost).toFixed(2) : '-';
    document.getElementById('spare-part-history-supplier').textContent = part.supplier || '-';
    document.getElementById('spare-part-history-purchase-date').textContent = formatDate(part.purchase_date);
    document.getElementById('spare-part-history-location').textContent = part.location || '-';
    document.getElementById('spare-part-history-specification').textContent = part.specification || '-';

    const photoDiv = document.getElementById('spare-part-history-photo');
    if (part.photo_path) {
        photoDiv.innerHTML = `<img src="${part.photo_path}" class="w-20 h-20 rounded object-cover border bg-gray-50">`;
    } else {
        photoDiv.innerHTML = `<span class="w-20 h-20 rounded bg-gray-100 inline-flex items-center justify-center text-gray-400 text-2xl"><i class="fas fa-image"></i></span>`;
    }

    try {
        const response = await fetch(`${API_BASE}/equipment/spare-parts/${id}/transactions`);
        const transactions = await response.json();
        _currentSparePartHistoryTransactions = transactions;
        const tbody = document.getElementById('spare-part-history-table-body');
        tbody.innerHTML = transactions.map(t => `
            <tr>
                <td class="px-4 py-2 whitespace-nowrap">${formatDate(t.transaction_date) || formatDate(t.created_at)}</td>
                <td class="px-4 py-2 whitespace-nowrap">
                    <span class="px-2 py-1 text-xs rounded-full ${t.transaction_type === 'purchase' ? 'bg-green-100 text-green-800' : t.transaction_type === 'consumption' ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'}">${t.transaction_type}</span>
                </td>
                <td class="px-4 py-2 whitespace-nowrap">${t.quantity}</td>
                <td class="px-4 py-2 whitespace-nowrap">${t.unit_cost ? '$' + parseFloat(t.unit_cost).toFixed(2) : '-'}</td>
                <td class="px-4 py-2 whitespace-nowrap">${t.total_cost ? '$' + parseFloat(t.total_cost).toFixed(2) : '-'}</td>
                <td class="px-4 py-2 whitespace-nowrap">${t.reference_type === 'maintenance_log' ? 'Maintenance #' + t.reference_id : t.transaction_type === 'adjustment' ? 'Manual Adjustment' : 'Purchase'}</td>
                <td class="px-4 py-2 whitespace-nowrap">${t.notes || '-'}</td>
            </tr>
        `).join('');
        document.getElementById('spare-part-history-modal').classList.add('active');
    } catch (error) {
        console.error('Error loading spare part history:', error);
    }
}

function closeSparePartHistoryModal() {
    document.getElementById('spare-part-history-modal').classList.remove('active');
}

var _currentSparePartHistoryPart = null;
var _currentSparePartHistoryTransactions = [];

function printSparePartHistory() {
    const part = _currentSparePartHistoryPart;
    const transactions = _currentSparePartHistoryTransactions || [];
    if (!part) return;

    const today = formatDate(new Date());

    const txRows = transactions.map((t, i) => {
        const date = formatDate(t.transaction_date) || formatDate(t.created_at);
        const type = t.transaction_type || '-';
        const qty = t.quantity || 0;
        const unitCost = t.unit_cost ? '$' + parseFloat(t.unit_cost).toFixed(2) : '-';
        const totalCost = t.total_cost ? '$' + parseFloat(t.total_cost).toFixed(2) : '-';
        const ref = t.reference_type === 'maintenance_log' ? 'Maintenance #' + t.reference_id : t.transaction_type === 'adjustment' ? 'Manual Adjustment' : 'Purchase';
        const notes = t.notes || '-';
        return '<tr><td>' + date + '</td><td>' + type + '</td><td>' + qty + '</td><td>' + unitCost + '</td><td>' + totalCost + '</td><td>' + ref + '</td><td>' + notes + '</td></tr>';
    }).join('');

    const html = '<!DOCTYPE html><html><head><title>Spare Part History - ' + (part.name || '') + '</title>'
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
        + 'th{background:#1e40af;color:#fff;padding:5px 8px;text-align:left;font-size:11px;}'
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
        + '<div class="title-block"><h1>Spare Part History</h1><p>Transaction Report</p></div>'
        + '<div class="doc-id"><div class="id-label">Generated On</div><div class="id-value">' + today + '</div></div>'
        + '</div>'
        + '<div class="actions"><button onclick="window.print()">&#x1F5A8; Print / Save as PDF</button></div>'
        + '<h2>Part Information</h2>'
        + '<table>'
        + '<tr><td class="lbl">Name</td><td>' + (part.name || '-') + '</td><td class="lbl">Auto Serial</td><td>' + (part.spare_part_serial_number || part.purchase_order_number || '-') + '</td></tr>'
        + '<tr><td class="lbl">Part Serial</td><td>' + (part.part_serial_number || part.part_number || '-') + '</td><td class="lbl">PO Number</td><td>' + (part.po_number || '-') + '</td></tr>'
        + '<tr><td class="lbl">Brand</td><td>' + (part.brand || '-') + '</td><td class="lbl">Category</td><td>' + (part.category || '-') + '</td></tr>'
        + '<tr><td class="lbl">Current Stock</td><td>' + (part.quantity || 0) + '</td><td class="lbl">Unit Cost</td><td>' + (part.unit_cost ? '$' + parseFloat(part.unit_cost).toFixed(2) : '-') + '</td></tr>'
        + '<tr><td class="lbl">Total Cost</td><td>' + (part.total_cost ? '$' + parseFloat(part.total_cost).toFixed(2) : '-') + '</td><td class="lbl">Supplier</td><td>' + (part.supplier || '-') + '</td></tr>'
        + '<tr><td class="lbl">Purchase Date</td><td>' + formatDate(part.purchase_date) + '</td><td class="lbl">Location</td><td>' + (part.location || '-') + '</td></tr>'
        + '<tr><td class="lbl">Specification</td><td colspan="3">' + (part.specification || '-') + '</td></tr>'
        + '</table>'
        + '<h2>Transaction History</h2>'
        + '<table><thead><tr><th>Date</th><th>Type</th><th>Qty</th><th>Unit Cost</th><th>Total Cost</th><th>Reference</th><th>Notes</th></tr></thead><tbody>'
        + txRows
        + '</tbody></table>'
        + '</div></body></html>';

    const iframe = document.createElement('iframe');
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

function highlightSparePartsFilters() {
    highlightFilters([
        'spare-parts-search',
        'spare-parts-filter-category',
        'spare-parts-filter-country',
        'spare-parts-filter-location'
    ], 'spare-parts-filter-sublocation-btn', 'spare-parts-sublocation-checkbox', 'spare-parts-sublocation-check-all');
}

function clearSparePartsFilters() {
    clearAllFilters([
        'spare-parts-search',
        'spare-parts-filter-category',
        'spare-parts-filter-country',
        'spare-parts-filter-location'
    ], 'spare-parts-sublocation-checkbox', 'spare-parts-sublocation-check-all', 'spare-parts-filter-sublocation-label', 'spare-parts-sublocation-checkbox-list', filterSpareParts);
}

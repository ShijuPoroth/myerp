// Equipment Returns
let allEquipmentReturns = [];

async function loadEquipmentReturns() {
    showTableLoading('equipment-returns-table-body', 'Loading equipment returns...');
    try {
        const response = await fetch(`${API_BASE}/equipment/returns`);
        if (!response.ok) {
            console.error('Error loading equipment returns:', response.status, response.statusText);
            allEquipmentReturns = [];
            renderEquipmentReturns([]);
            return;
        }
        allEquipmentReturns = await response.json();
        filterEquipmentReturns();
    } catch (error) {
        console.error('Error loading equipment returns:', error);
        showTableError('equipment-returns-table-body', 'Error loading equipment returns.');
        allEquipmentReturns = [];
        renderEquipmentReturns([]);
    }
}

function renderEquipmentReturns(returns) {
    const tbody = document.getElementById('equipment-returns-table-body');
    if (!tbody) return;
    if (!returns || !Array.isArray(returns)) {
        tbody.innerHTML = '';
        return;
    }
    const total = returns.length;
    tbody.innerHTML = returns.map((ret, index) => {
        const serial = index + 1;
        return `
        <tr>
            <td class="px-3 py-2 whitespace-nowrap text-gray-500 text-xs">${serial}</td>
            <td class="px-3 py-2 max-w-32 truncate" title="${ret.equipment_name || ''}">${ret.equipment_name || '-'}</td>
            <td class="px-3 py-2 whitespace-nowrap">${ret.equipment_auto_serial || '-'}</td>
            <td class="px-3 py-2 whitespace-nowrap">${ret.supplier_name || '-'}</td>
            <td class="px-3 py-2 whitespace-nowrap">${formatDate(ret.return_date)}</td>
            <td class="px-3 py-2 max-w-40 truncate" title="${ret.reason || ''}">${ret.reason || '-'}</td>
            <td class="px-3 py-2 whitespace-nowrap">
                <span class="px-2 py-1 text-xs rounded-full ${getReturnStatusColor(ret.status)}">${ret.status || 'Pending'}</span>
            </td>
            <td class="px-3 py-2 whitespace-nowrap">${ret.requested_by || '-'}</td>
            <td class="px-3 py-2 whitespace-nowrap">${ret.approved_by || '-'}</td>
            <td class="px-3 py-2 whitespace-nowrap">
                <button onclick="viewEquipmentReturn(${ret.id})" class="text-green-600 hover:text-green-800 mr-2" title="View return report">
                    <i class="fas fa-eye"></i>
                </button>
                ${ret.equipment_id ? `<button onclick="viewEquipment(${ret.equipment_id})" class="text-blue-600 hover:text-blue-800 mr-2" title="View Equipment"><i class="fas fa-desktop"></i></button>` : ''}
                ${getEditActionButton('equipment-returns', 'editEquipmentReturn', ret.id)}
                ${getDeleteActionButton('equipment-returns', 'deleteEquipmentReturn', ret.id)}
            </td>
        </tr>
        `;
    }).join('') || '<tr><td colspan="10" class="px-3 py-4 text-center text-gray-400">No equipment returns found</td></tr>';
}

function getReturnStatusColor(status) {
    switch(status) {
        case 'Approved': return 'bg-green-100 text-green-800';
        case 'Rejected': return 'bg-red-100 text-red-800';
        case 'Pending':
        default: return 'bg-yellow-100 text-yellow-800';
    }
}

function filterEquipmentReturns() {
    const searchText = (document.getElementById('equipment-return-search')?.value || '').toLowerCase();
    const status = document.getElementById('equipment-return-filter-status')?.value || '';

    let filtered = allEquipmentReturns;
    if (status) {
        filtered = filtered.filter(r => r.status === status);
    }
    if (searchText) {
        filtered = filtered.filter(r =>
            (r.equipment_name && r.equipment_name.toLowerCase().includes(searchText)) ||
            (r.equipment_auto_serial && r.equipment_auto_serial.toLowerCase().includes(searchText)) ||
            (r.supplier_name && r.supplier_name.toLowerCase().includes(searchText)) ||
            (r.reason && r.reason.toLowerCase().includes(searchText))
        );
    }
    renderEquipmentReturns(filtered);
}

function clearEquipmentReturnFilters() {
    const searchInput = document.getElementById('equipment-return-search');
    if (searchInput) searchInput.value = '';
    const statusSelect = document.getElementById('equipment-return-filter-status');
    if (statusSelect) statusSelect.value = '';
    filterEquipmentReturns();
}

// Equipment select for return modal
let returnEquipmentList = [];
let returnEquipmentSelectedIndex = -1;
let returnFilteredList = [];

async function populateReturnEquipmentSelect() {
    try {
        const response = await fetch(`${API_BASE}/equipment`);
        returnEquipmentList = (await response.json()).filter(eq => {
            const st = eq.display_status || eq.status;
            return st !== 'Written Off' && st !== 'Returned';
        });
        document.getElementById('return-equipment').value = '';
        document.getElementById('return-equipment-search').value = '';
        filterReturnEquipmentByLocation();
    } catch (error) {
        console.error('Error loading equipment for return:', error);
    }
}

function filterReturnEquipmentByLocation() {
    const countryId   = document.getElementById('ret-filter-country')?.value || '';
    const locationId  = document.getElementById('ret-filter-location')?.value || '';
    const sublocation = document.getElementById('ret-filter-sublocation')?.value || '';

    const dropdown = document.getElementById('return-equipment-dropdown');
    const countEl = document.getElementById('ret-eq-count');

    if (!countryId) {
        returnFilteredList = [];
        if (countEl) countEl.textContent = '(0)';
        document.getElementById('return-equipment').value = '';
        document.getElementById('return-equipment-search').value = '';
        if (dropdown) {
            dropdown.innerHTML = '<div class="px-3 py-2 text-gray-500 text-sm">Select a country first</div>';
            dropdown.classList.add('hidden');
        }
        resetReturnSupplierDropdown();
        return;
    }

    let filtered = returnEquipmentList;
    if (countryId) {
        filtered = filtered.filter(eq => String(eq.country_id || '') === countryId);
    }
    if (locationId) {
        filtered = filtered.filter(eq => String(eq.location_type_id || '') === locationId);
    }
    if (sublocation) {
        filtered = filtered.filter(eq => String(eq.location_id || '') === sublocation);
    }

    returnFilteredList = filtered;
    if (countEl) countEl.textContent = `(${filtered.length})`;

    returnEquipmentSelectedIndex = -1;
    renderReturnEquipmentDropdown(filtered);
}

async function loadReturnSuppliers() {
    const sublocationId = document.getElementById('ret-filter-sublocation')?.value || '';
    const supplierSelect = document.getElementById('equipment-return-supplier');
    if (!supplierSelect) return;

    if (!sublocationId) {
        supplierSelect.innerHTML = '<option value="">Select supplier (choose sublocation first)</option>';
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/suppliers/by-location?business_type_assignment_id=${sublocationId}`);
        if (!response.ok) {
            console.error('Error loading suppliers:', response.status);
            supplierSelect.innerHTML = '<option value="">Error loading suppliers</option>';
            return;
        }
        const suppliers = await response.json();
        if (suppliers.length === 0) {
            supplierSelect.innerHTML = '<option value="">No suppliers assigned to this location</option>';
        } else {
            supplierSelect.innerHTML = '<option value="">Select a supplier</option>' +
                suppliers.map(s => `<option value="${s.id}">${s.name}</option>`).join('');
        }
    } catch (error) {
        console.error('Error loading suppliers:', error);
        supplierSelect.innerHTML = '<option value="">Error loading suppliers</option>';
    }
}

function resetReturnSupplierDropdown() {
    const supplierSelect = document.getElementById('equipment-return-supplier');
    if (supplierSelect) {
        supplierSelect.innerHTML = '<option value="">Select supplier (choose location first)</option>';
    }
}

function renderReturnEquipmentDropdown(equipment) {
    const dropdown = document.getElementById('return-equipment-dropdown');
    if (!dropdown) return;
    if (!equipment || equipment.length === 0) {
        dropdown.innerHTML = '<div class="px-3 py-2 text-gray-500 text-sm">No equipment found</div>';
        dropdown.classList.remove('hidden');
        return;
    }
    dropdown.innerHTML = equipment.map((eq, index) => `
        <div class="return-equipment-option px-3 py-2 cursor-pointer hover:bg-gray-100 text-sm ${index === returnEquipmentSelectedIndex ? 'bg-gray-100' : ''}"
            data-id="${eq.id}"
            data-index="${index}"
            onclick="selectReturnEquipment(${eq.id}, '${(eq.auto_serial_number || eq.name || '').replace(/'/g, "\\'")} - ${(eq.name || '').replace(/'/g, "\\'")}')">
            ${eq.auto_serial_number || ''} - ${eq.name || ''}
        </div>
    `).join('');
    dropdown.classList.remove('hidden');
}

function filterReturnEquipmentOptions() {
    const searchText = document.getElementById('return-equipment-search').value.toLowerCase();
    const filtered = returnFilteredList.filter(eq =>
        (eq.auto_serial_number && eq.auto_serial_number.toLowerCase().includes(searchText)) ||
        (eq.name && eq.name.toLowerCase().includes(searchText)) ||
        (eq.barcode && eq.barcode.toLowerCase().includes(searchText))
    );
    returnEquipmentSelectedIndex = -1;
    renderReturnEquipmentDropdown(filtered);
}

function showReturnEquipmentDropdown() {
    const countryId = document.getElementById('ret-filter-country')?.value || '';
    if (!countryId) return;
    const dropdown = document.getElementById('return-equipment-dropdown');
    if (dropdown) dropdown.classList.remove('hidden');
}

function hideReturnEquipmentDropdown() {
    const dropdown = document.getElementById('return-equipment-dropdown');
    if (dropdown) dropdown.classList.add('hidden');
}

function selectReturnEquipment(id, displayText) {
    document.getElementById('return-equipment').value = id;
    document.getElementById('return-equipment-search').value = displayText;
    hideReturnEquipmentDropdown();
}

function handleReturnEquipmentKeydown(event) {
    const dropdown = document.getElementById('return-equipment-dropdown');
    const searchText = document.getElementById('return-equipment-search').value.toLowerCase();
    const filtered = returnFilteredList.filter(eq =>
        (eq.auto_serial_number && eq.auto_serial_number.toLowerCase().includes(searchText)) ||
        (eq.name && eq.name.toLowerCase().includes(searchText)) ||
        (eq.barcode && eq.barcode.toLowerCase().includes(searchText))
    );

    if (event.key === 'ArrowDown') {
        event.preventDefault();
        returnEquipmentSelectedIndex = Math.min(returnEquipmentSelectedIndex + 1, filtered.length - 1);
        renderReturnEquipmentDropdown(filtered);
    } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        returnEquipmentSelectedIndex = Math.max(returnEquipmentSelectedIndex - 1, -1);
        renderReturnEquipmentDropdown(filtered);
    } else if (event.key === 'Enter') {
        event.preventDefault();
        if (returnEquipmentSelectedIndex >= 0 && filtered[returnEquipmentSelectedIndex]) {
            const eq = filtered[returnEquipmentSelectedIndex];
            selectReturnEquipment(eq.id, `${eq.auto_serial_number || ''} - ${eq.name || ''}`);
        }
    } else if (event.key === 'Escape') {
        hideReturnEquipmentDropdown();
    }
}

document.addEventListener('click', function(event) {
    const container = document.getElementById('return-equipment-search');
    const dropdown = document.getElementById('return-equipment-dropdown');
    if (container && dropdown && !container.contains(event.target) && !dropdown.contains(event.target)) {
        hideReturnEquipmentDropdown();
    }
});

async function openEquipmentReturnModal() {
    const modal = document.getElementById('equipment-return-modal');
    const form = document.getElementById('equipment-return-form');
    if (form) form.reset();
    document.getElementById('equipment-return-id').value = '';
    document.getElementById('equipment-return-modal-title').textContent = 'New Equipment Return';
    resetReturnSupplierDropdown();
    hideReturnEquipmentDropdown();

    await ensureCascadingLocationData();
    const countrySel = document.getElementById('ret-filter-country');
    if (countrySel) {
        countrySel.innerHTML = '<option value="">All Countries</option>' +
            (window.allCountries || []).map(c => `<option value="${c.id}">${c.name}</option>`).join('');
    }
    const locSel = document.getElementById('ret-filter-location');
    if (locSel) locSel.innerHTML = '<option value="">All Locations</option>';
    const subSel = document.getElementById('ret-filter-sublocation');
    if (subSel) subSel.innerHTML = '<option value="">All</option>';

    await populateReturnEquipmentSelect();
    if (modal) modal.classList.add('active');
}

function closeEquipmentReturnModal() {
    const modal = document.getElementById('equipment-return-modal');
    if (modal) modal.classList.remove('active');
}

async function editEquipmentReturn(id) {
    const ret = allEquipmentReturns.find(r => r.id === id);
    if (!ret) return;
    const modal = document.getElementById('equipment-return-modal');
    const form = document.getElementById('equipment-return-form');
    if (form) form.reset();
    document.getElementById('equipment-return-id').value = ret.id;
    document.getElementById('equipment-return-modal-title').textContent = 'Edit Equipment Return';
    resetReturnSupplierDropdown();
    await populateReturnEquipmentSelect();
    const eq = returnEquipmentList.find(e => e.id === ret.equipment_id);
    if (eq) {
        selectReturnEquipment(eq.id, `${eq.auto_serial_number || ''} - ${eq.name || ''}`);
        await setCascadingLocationByAssignment(eq.location_id, 'ret-filter-country', 'ret-filter-location', 'ret-filter-sublocation');
        await loadReturnSuppliers();
        const supplierSelect = document.getElementById('equipment-return-supplier');
        if (supplierSelect && ret.supplier_name) {
            for (let i = 0; i < supplierSelect.options.length; i++) {
                if (supplierSelect.options[i].text === ret.supplier_name) {
                    supplierSelect.selectedIndex = i;
                    break;
                }
            }
        }
    } else {
        document.getElementById('return-equipment').value = ret.equipment_id || '';
        document.getElementById('return-equipment-search').value = `${ret.equipment_auto_serial || ''} - ${ret.equipment_name || ''}`;
    }
    document.getElementById('equipment-return-date').value = ret.return_date || '';
    document.getElementById('equipment-return-reason').value = ret.reason || '';
    document.getElementById('equipment-return-requested-by').value = ret.requested_by || '';
    document.getElementById('equipment-return-notes').value = ret.notes || '';
    if (modal) modal.classList.add('active');
}

async function saveEquipmentReturn(e) {
    e.preventDefault();
    const id = document.getElementById('equipment-return-id').value;
    const supplierSelect = document.getElementById('equipment-return-supplier');
    const supplierName = supplierSelect.selectedOptions[0]?.text || '';
    const data = {
        equipment_id: document.getElementById('return-equipment').value,
        supplier_name: supplierSelect.value ? supplierName : '',
        return_date: document.getElementById('equipment-return-date').value,
        reason: document.getElementById('equipment-return-reason').value,
        requested_by: document.getElementById('equipment-return-requested-by').value,
        notes: document.getElementById('equipment-return-notes').value
    };

    if (!data.equipment_id) { alert('Please select an equipment.'); return; }
    if (!data.return_date) { alert('Please select a return date.'); return; }
    if (!data.reason) { alert('Please enter a reason.'); return; }

    try {
        const managerId = (typeof currentModuleManager !== 'undefined' && currentModuleManager) ? currentModuleManager.id : '';
        const url = id ? `${API_BASE}/equipment/returns/${id}?manager_id=${managerId}` : `${API_BASE}/equipment/returns`;
        const method = id ? 'PUT' : 'POST';
        const response = await fetch(url, {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });

        if (response.ok) {
            closeEquipmentReturnModal();
            loadEquipmentReturns();
        } else {
            const err = await response.json();
            alert('Error saving equipment return: ' + (err.error || response.statusText));
        }
    } catch (error) {
        console.error('Error saving equipment return:', error);
        alert('Error saving equipment return');
    }
}

async function deleteEquipmentReturn(id) {
    if (!currentModuleManager) {
        alert('Please select a module manager.');
        return;
    }
    if (!confirm('Are you sure you want to delete this equipment return?')) return;
    try {
        const response = await fetch(`${API_BASE}/equipment/returns/${id}?manager_id=${currentModuleManager.id}`, {
            method: 'DELETE'
        });
        if (response.ok) {
            loadEquipmentReturns();
        } else {
            const err = await response.json();
            alert('Error deleting equipment return: ' + (err.error || response.statusText));
        }
    } catch (error) {
        console.error('Error deleting equipment return:', error);
        alert('Error deleting equipment return');
    }
}

let _currentViewedReturn = null;

function viewEquipmentReturn(id) {
    const ret = allEquipmentReturns.find(r => r.id === id);
    if (!ret) return;
    _currentViewedReturn = ret;

    const locationFull = [ret.equipment_country, ret.equipment_location, ret.equipment_sub_location, ret.equipment_business_type, ret.equipment_business_unit_code].filter(Boolean).join(' - ') || '-';

    document.getElementById('ver-equipment-name').textContent = ret.equipment_name || '-';
    document.getElementById('ver-auto-serial').textContent = ret.equipment_auto_serial || '-';
    document.getElementById('ver-barcode').textContent = ret.equipment_barcode || '-';
    document.getElementById('ver-serial-number').textContent = ret.equipment_serial_number || '-';
    document.getElementById('ver-category').textContent = ret.equipment_category || '-';
    document.getElementById('ver-brand').textContent = ret.equipment_brand || '-';
    document.getElementById('ver-model').textContent = ret.equipment_model || '-';
    document.getElementById('ver-condition').textContent = ret.equipment_condition || '-';
    document.getElementById('ver-eq-status').textContent = ret.equipment_status || '-';
    document.getElementById('ver-owner').textContent = ret.equipment_owner || '-';
    document.getElementById('ver-assigned-to').textContent = ret.equipment_assigned_to || '-';
    document.getElementById('ver-purchase-date').textContent = formatDate(ret.equipment_purchase_date);
    document.getElementById('ver-purchase-cost').textContent = ret.equipment_purchase_cost || '-';
    document.getElementById('ver-location').textContent = locationFull;

    document.getElementById('ver-supplier').textContent = ret.supplier_name || '-';
    document.getElementById('ver-date').textContent = formatDate(ret.return_date);
    document.getElementById('ver-status').innerHTML = '<span class="px-2 py-0.5 text-xs rounded-full ' + getReturnStatusColor(ret.status) + '">' + (ret.status || 'Pending') + '</span>';
    document.getElementById('ver-requested-by').textContent = ret.requested_by || '-';
    document.getElementById('ver-approved-by').textContent = ret.approved_by || '-';
    document.getElementById('ver-approval-date').textContent = formatDate(ret.approval_date);
    document.getElementById('ver-reason').textContent = ret.reason || '-';
    document.getElementById('ver-notes').textContent = ret.notes || '-';

    const modal = document.getElementById('view-equipment-return-modal');
    if (modal) modal.classList.add('active');
}

function closeViewEquipmentReturnModal() {
    const modal = document.getElementById('view-equipment-return-modal');
    if (modal) modal.classList.remove('active');
}

function printEquipmentReturnDetails() {
    const ret = _currentViewedReturn;
    if (!ret) return;

    var locationFull = [ret.equipment_country, ret.equipment_location, ret.equipment_sub_location, ret.equipment_business_type, ret.equipment_business_unit_code].filter(Boolean).join(' - ') || '-';

    var statusStyle = ret.status === 'Completed' ? 'background:#dcfce7;color:#166534'
                    : ret.status === 'Rejected' ? 'background:#fee2e2;color:#991b1b'
                    : 'background:#fef9c3;color:#854d0e';

    var retDate = formatDate(ret.return_date);
    var appDate = formatDate(ret.approval_date);
    var purDate = formatDate(ret.equipment_purchase_date);

    var html = '<!DOCTYPE html><html><head><title>Equipment Return - ' + (ret.equipment_name || '') + '</title>'
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
        + '.actions{text-align:center;margin-bottom:20px;}'
        + '.actions button{padding:10px 24px;font-size:14px;background:#1e40af;color:#fff;border:none;border-radius:6px;cursor:pointer;}'
        + '@media print{.actions{display:none;}}'
        + '</style></head><body>'
        + '<div class="page">'
        + '<div class="doc-header">'
        + '<div class="logo-block">'
        + '<img src="/company-logo/company-logo.png" alt="Company Logo" onerror="this.style.display=\'none\';this.nextElementSibling.style.display=\'block\';">'
        + '<div class="logo-fallback">[Company Logo]<br><span style="font-size:10px;">Place company-logo.png in public/company-logo/</span></div>'
        + '</div>'
        + '<div class="title-block"><h1>Equipment Return</h1><p>Return to Supplier Report</p></div>'
        + '<div class="doc-id"><div class="id-label">Generated On</div><div class="id-value">' + formatDate(new Date()) + '</div></div>'
        + '</div>'
        + '<div class="actions"><button onclick="window.print()">&#x1F5A8; Print / Save as PDF</button></div>'
        + '<h2>Equipment</h2>'
        + '<table>'
        + '<tr><td class="lbl">Name</td><td colspan="3">' + (ret.equipment_name || '-') + '</td></tr>'
        + '<tr><td class="lbl">Auto Serial</td><td>' + (ret.equipment_auto_serial || '-') + '</td><td class="lbl">Barcode</td><td>' + (ret.equipment_barcode || '-') + '</td></tr>'
        + '<tr><td class="lbl">Serial Number</td><td>' + (ret.equipment_serial_number || '-') + '</td><td class="lbl">Category</td><td>' + (ret.equipment_category || '-') + '</td></tr>'
        + '<tr><td class="lbl">Brand</td><td>' + (ret.equipment_brand || '-') + '</td><td class="lbl">Model</td><td>' + (ret.equipment_model || '-') + '</td></tr>'
        + '<tr><td class="lbl">Condition</td><td>' + (ret.equipment_condition || '-') + '</td><td class="lbl">Eq. Status</td><td>' + (ret.equipment_status || '-') + '</td></tr>'
        + '<tr><td class="lbl">Owner</td><td>' + (ret.equipment_owner || '-') + '</td><td class="lbl">Assigned To</td><td>' + (ret.equipment_assigned_to || '-') + '</td></tr>'
        + '<tr><td class="lbl">Purchase Date</td><td>' + purDate + '</td><td class="lbl">Purchase Cost</td><td>' + (ret.equipment_purchase_cost || '-') + '</td></tr>'
        + '<tr><td class="lbl">Location</td><td colspan="3">' + locationFull + '</td></tr>'
        + '</table>'
        + '<h2>Return Details</h2>'
        + '<table>'
        + '<tr><td class="lbl">Supplier</td><td colspan="3">' + (ret.supplier_name || '-') + '</td></tr>'
        + '<tr><td class="lbl">Return Date</td><td>' + retDate + '</td><td class="lbl">Status</td><td><span class="badge" style="' + statusStyle + '">' + (ret.status || 'Pending') + '</span></td></tr>'
        + '<tr><td class="lbl">Requested By</td><td>' + (ret.requested_by || '-') + '</td><td class="lbl">Approved By</td><td>' + (ret.approved_by || '-') + '</td></tr>'
        + '<tr><td class="lbl">Approval Date</td><td colspan="3">' + appDate + '</td></tr>'
        + '<tr><td class="lbl">Reason</td><td colspan="3">' + (ret.reason || '-') + '</td></tr>'
        + '<tr><td class="lbl">Notes</td><td colspan="3">' + (ret.notes || '-') + '</td></tr>'
        + '</table>'
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

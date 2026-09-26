// Transfers
async function loadTransfers() {
    showTableLoading('transfers-table-body', 'Loading transfers...');
    try {
const response = await fetch(`${API_BASE}/equipment/transfers`);
        if (!response.ok) {
            console.error('Error loading transfers:', response.status, response.statusText);
            allTransfers = [];
            renderTransfers([]);
            return;
        }
        const transfers = await response.json();
allTransfers = transfers;
        const transferFilterSelect = document.getElementById('transfer-filter-equipment');
        if (transferFilterSelect && allEquipment.length > 0) {
            const equipmentInTransfers = allEquipment.filter(eq =>
                allTransfers.some(t => t.equipment_id == eq.id)
            );
            transferFilterSelect.innerHTML = '<option value="">All Equipment</option>' +
                equipmentInTransfers.map(eq => `<option value="${eq.id}">${eq.auto_serial_number || 'No Serial'} - ${eq.name}</option>`).join('');
        }
        filterTransfers();
    } catch (error) {
        console.error('Error loading transfers:', error);
        showTableError('transfers-table-body', 'Error loading transfers.');
        allTransfers = [];
        renderTransfers([]);
    }
}

function filterTransfers() {
    highlightTransferFilters();
    const searchText = document.getElementById('transfer-search').value.toLowerCase();
    const equipmentId = document.getElementById('transfer-filter-equipment').value;
    const fromCountry = document.getElementById('transfer-filter-from-country')?.value || '';
    const fromLocation = document.getElementById('transfer-filter-from-location')?.value || '';
    const fromSublocation = document.getElementById('transfer-filter-from-sublocation')?.value || '';
    const toCountry = document.getElementById('transfer-filter-to-country')?.value || '';
    const toLocation = document.getElementById('transfer-filter-to-location')?.value || '';
    const toSublocation = document.getElementById('transfer-filter-to-sublocation')?.value || '';

    let filtered = allTransfers;

    if (equipmentId) {
        filtered = filtered.filter(t => t.equipment_id == equipmentId);
    }

    if (fromCountry) {
        filtered = filtered.filter(t => t.from_country_name === fromCountry);
    }

    if (fromLocation) {
        filtered = filtered.filter(t => t.from_location_type_name === fromLocation);
    }

    if (fromSublocation) {
        filtered = filtered.filter(t => {
            const subBiz = [t.from_sub_location_name, t.from_business_type_name].filter(Boolean).join(' - ');
            return subBiz === fromSublocation;
        });
    }

    if (toCountry) {
        filtered = filtered.filter(t => t.to_country_name === toCountry);
    }

    if (toLocation) {
        filtered = filtered.filter(t => t.to_location_type_name === toLocation);
    }

    if (toSublocation) {
        filtered = filtered.filter(t => {
            const subBiz = [t.to_sub_location_name, t.to_business_type_name].filter(Boolean).join(' - ');
            return subBiz === toSublocation;
        });
    }

    if (searchText) {
        filtered = filtered.filter(t =>
            (t.transfer_serial_number && t.transfer_serial_number.toLowerCase().includes(searchText)) ||
            (t.equipment_name && t.equipment_name.toLowerCase().includes(searchText)) ||
            (t.equipment_auto_serial && t.equipment_auto_serial.toLowerCase().includes(searchText)) ||
            (t.equipment_barcode && t.equipment_barcode.toLowerCase().includes(searchText)) ||
            (t.from_location_name && t.from_location_name.toLowerCase().includes(searchText)) ||
            (t.to_location_name && t.to_location_name.toLowerCase().includes(searchText)) ||
            (t.created_by && t.created_by.toLowerCase().includes(searchText))
        );
    }

    renderTransfers(filtered);
}

function renderTransfers(transfers) {
    const tbody = document.getElementById('transfers-table-body');
if (!tbody) return;
    if (!transfers || !Array.isArray(transfers)) {
        tbody.innerHTML = '';
        return;
    }
    const total = transfers.length;
    tbody.innerHTML = transfers.map((t, index) => {
        const serial = total - index;
        const barcodeDisplay = (typeof t.equipment_barcode === 'object' || t.equipment_barcode === '[object Object]') ? '-' : (t.equipment_barcode || '-');
        const fromSubBusiness = [t.from_sub_location_name, t.from_business_type_name, t.from_business_unit_code].filter(Boolean).join(' - ') || '-';
        const toSubBusiness = [t.to_sub_location_name, t.to_business_type_name, t.to_business_unit_code].filter(Boolean).join(' - ') || '-';
        return `
        <tr>
            <td class="px-3 py-2 whitespace-nowrap text-gray-500 text-xs">${serial}</td>
            <td class="px-3 py-2 whitespace-nowrap">${t.transfer_serial_number || '-'}</td>
            <td class="px-3 py-2 whitespace-nowrap">${t.equipment_auto_serial || '-'}</td>
            <td class="px-3 py-2 max-w-32 truncate" title="${t.equipment_name}">${t.equipment_name}</td>
            <td class="px-3 py-2 whitespace-nowrap">${barcodeDisplay}</td>
            <td class="px-3 py-2 max-w-32 truncate" title="${t.from_country_name || ''}">${t.from_country_name || '-'}</td>
            <td class="px-3 py-2 max-w-32 truncate" title="${t.from_location_type_name || ''}">${t.from_location_type_name || '-'}</td>
            <td class="px-3 py-2 max-w-40 truncate" title="${fromSubBusiness}">${fromSubBusiness}</td>
            <td class="px-3 py-2 max-w-32 truncate" title="${t.to_country_name || ''}">${t.to_country_name || '-'}</td>
            <td class="px-3 py-2 max-w-32 truncate" title="${t.to_location_type_name || ''}">${t.to_location_type_name || '-'}</td>
            <td class="px-3 py-2 max-w-40 truncate" title="${toSubBusiness}">${toSubBusiness}</td>
            <td class="px-3 py-2 whitespace-nowrap">${formatDate(t.transfer_date)}</td>
            <td class="px-3 py-2 whitespace-nowrap">${t.created_by || '-'}</td>
            <td class="px-3 py-2 whitespace-nowrap">
                <button onclick="viewTransfer(${t.id})" class="text-green-600 hover:text-green-800 mr-2" title="View Details">
                    <i class="fas fa-eye"></i>
                </button>
                ${getEditActionButton('transfers', 'editTransfer', t.id)}
                ${getDeleteActionButton('transfers', 'deleteTransfer', t.id)}
            </td>
        </tr>
    `}).join('');
}

async function openTransferModal() {
    const modal = document.getElementById('transfer-modal');
    document.getElementById('transfer-form').reset();
    document.getElementById('transfer-id').value = '';
    document.getElementById('transfer-current-assigned-to').value = '';

    // Fetch next transfer serial number from server
    try {
        const response = await fetch(`${API_BASE}/equipment/transfers/next-serial`);
        if (!response.ok) {
            console.error('Error fetching next transfer serial:', response.status, response.statusText);
            document.getElementById('transfer-serial').value = 'TRF-001';
            return;
        }
        const data = await response.json();
        document.getElementById('transfer-serial').value = data.next_serial;
    } catch (error) {
        console.error('Error fetching next transfer serial:', error);
        document.getElementById('transfer-serial').value = 'TRF-001';
    }

    // Populate equipment dropdown
    populateEquipmentSelects();

    // Load cascading location data and reset to-location selects
    await ensureCascadingLocationData();
    populateCascadingCountrySelect('transfer-to-country');
    const locationSelect = document.getElementById('transfer-to-location');
    const sublocationSelect = document.getElementById('transfer-to-sublocation');
    if (locationSelect) locationSelect.innerHTML = '<option value="">Select Location</option>';
    if (sublocationSelect) sublocationSelect.innerHTML = '<option value="">Select Sublocation / Business Type</option>';

    // Populate assigned to dropdown with employees
    loadEmployeesForTransfer();

    // Add event listener to auto-populate from location when equipment is selected
    const equipmentSelect = document.getElementById('transfer-equipment');
    const fromLocationSelect = document.getElementById('transfer-from-location');
    
    // Remove existing listener to avoid duplicates
    const newEquipmentSelect = equipmentSelect.cloneNode(true);
    equipmentSelect.parentNode.replaceChild(newEquipmentSelect, equipmentSelect);
    
    const currentAssignedToInput = document.getElementById('transfer-current-assigned-to');

    newEquipmentSelect.addEventListener('change', function() {
        const selectedValue = this.value;
        const datalist = document.getElementById('transfer-equipment-list');
        const selectedOption = Array.from(datalist.options).find(opt => opt.value === selectedValue);
        const equipmentIdInput = document.getElementById('transfer-equipment-id');
        const barcodeInput = document.getElementById('transfer-barcode');

        if (selectedOption) {
            const equipmentId = selectedOption.getAttribute('data-id');
            const locationId = selectedOption.getAttribute('data-location-id');
            const locationName = selectedOption.getAttribute('data-location-name');
            const barcode = selectedOption.getAttribute('data-barcode') || '';
            const assignedToName = selectedOption.getAttribute('data-assigned-to-name') || '';

            // Store the ID in hidden field
            if (equipmentIdInput) {
                equipmentIdInput.value = equipmentId;
            }

            if (barcodeInput) {
                barcodeInput.value = barcode;
            }

            if (currentAssignedToInput) {
                currentAssignedToInput.value = assignedToName || 'Not Assigned';
            }

            const fromLocationHidden = document.getElementById('transfer-from-location');
            const fromCountryInput = document.getElementById('transfer-from-country');
            const fromLocationNameInput = document.getElementById('transfer-from-location-name');
            const fromSublocationNameInput = document.getElementById('transfer-from-sublocation-name');
            const assignment = window.allBusinessTypeAssignments ? window.allBusinessTypeAssignments.find(a => a.id == locationId) : null;

            if (fromLocationHidden) fromLocationHidden.value = locationId || '';
            if (fromCountryInput) fromCountryInput.value = assignment ? assignment.country_name || '' : '';
            if (fromLocationNameInput) fromLocationNameInput.value = assignment ? assignment.location_name || '' : '';
            if (fromSublocationNameInput) fromSublocationNameInput.value = assignment ? formatSublocationOptionText(assignment) : '';

            // Reset to-location cascading selects
            const toCountrySelect = document.getElementById('transfer-to-country');
            const toLocationSelect = document.getElementById('transfer-to-location');
            const toSublocationSelect = document.getElementById('transfer-to-sublocation');
            if (toCountrySelect) toCountrySelect.value = '';
            if (toLocationSelect) toLocationSelect.innerHTML = '<option value="">Select Location</option>';
            if (toSublocationSelect) toSublocationSelect.innerHTML = '<option value="">Select Sublocation / Business Type</option>';
        } else {
            if (barcodeInput) {
                barcodeInput.value = '';
            }
            if (currentAssignedToInput) {
                currentAssignedToInput.value = '';
            }
            const fromLocationHidden = document.getElementById('transfer-from-location');
            const fromCountryInput = document.getElementById('transfer-from-country');
            const fromLocationNameInput = document.getElementById('transfer-from-location-name');
            const fromSublocationNameInput = document.getElementById('transfer-from-sublocation-name');
            if (fromLocationHidden) fromLocationHidden.value = '';
            if (fromCountryInput) fromCountryInput.value = '';
            if (fromLocationNameInput) fromLocationNameInput.value = '';
            if (fromSublocationNameInput) fromSublocationNameInput.value = '';
        }
    });
    
    modal.classList.add('active');
}

function closeTransferModal() {
    document.getElementById('transfer-modal').classList.remove('active');
}

async function loadEmployeesForTransfer() {
    try {
        const response = await fetch(`${API_BASE}/employees`);
        const employees = await response.json();
        const assignedToSelect = document.getElementById('transfer-assigned-to');
        if (assignedToSelect) {
            assignedToSelect.innerHTML = '<option value="">Select Employee</option>';
            employees.forEach(emp => {
                assignedToSelect.innerHTML += `<option value="${emp.id}">${emp.first_name} ${emp.last_name}</option>`;
            });
        }
    } catch (error) {
        console.error('Error loading employees:', error);
    }
}

async function saveTransfer(e) {
    e.preventDefault();
    const transferId = document.getElementById('transfer-id').value;
    const equipmentId = document.getElementById('transfer-equipment-id').value;
    const equipment = allEquipment.find(eq => eq.id == equipmentId);
    const fromLocationId = document.getElementById('transfer-from-location').value;
    const toLocationId = document.getElementById('transfer-to-sublocation').value;

    if (toLocationId && toLocationId == fromLocationId) {
        alert('To location cannot be the same as the current from location.');
        return;
    }

    const data = {
        transfer_serial_number: document.getElementById('transfer-serial').value,
        equipment_id: equipmentId,
        from_location_id: fromLocationId,
        to_location_id: toLocationId,
        transfer_date: document.getElementById('transfer-date').value,
        assigned_to: document.getElementById('transfer-assigned-to').value,
        notes: document.getElementById('transfer-notes').value,
        created_by: document.getElementById('transfer-created-by').value
    };
    
    try {
        const url = transferId ? `${API_BASE}/equipment/transfers/${transferId}?manager_id=${currentModuleManager ? currentModuleManager.id : ''}` : `${API_BASE}/equipment/transfers`;
        const method = transferId ? 'PUT' : 'POST';
        const response = await fetch(url, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({ error: 'Unknown error' }));
            console.error('Error saving transfer:', error);
            alert('Error saving transfer: ' + (error.error || response.statusText));
            return;
        }

        const transferSerial = document.getElementById('transfer-serial').value;
        const equipmentName = document.getElementById('transfer-equipment').value;
        const fromLocationId = document.getElementById('transfer-from-location').value;
        const fromAssignment = window.allBusinessTypeAssignments ? window.allBusinessTypeAssignments.find(a => a.id == fromLocationId) : null;
        const fromLocation = fromAssignment ? formatSublocationOptionText(fromAssignment) : fromLocationId;
        const toLocationSelect = document.getElementById('transfer-to-sublocation');
        const toLocation = toLocationSelect.options[toLocationSelect.selectedIndex]?.text || document.getElementById('transfer-to-sublocation').value;
        const transferDate = document.getElementById('transfer-date').value;
        const assignedToSelect = document.getElementById('transfer-assigned-to');
        const assignedTo = assignedToSelect.options[assignedToSelect.selectedIndex]?.text || assignedToSelect.value;
        const notes = document.getElementById('transfer-notes').value;

        let details = `Transfer Serial: ${transferSerial} | Equipment: ${equipmentName} | From: ${fromLocation} | To: ${toLocation}`;
        if (transferDate) details += ` | Date: ${transferDate}`;
        if (assignedTo) details += ` | Assigned To: ${assignedTo}`;
        if (notes) details += ` | Notes: ${notes}`;

        await logAudit(transferId ? 'UPDATE' : 'CREATE', 'equipment', 'Transfer', transferId || null, details);
        closeTransferModal();
        await loadTransfers();
        await loadEquipment();
    } catch (error) {
        console.error('Error saving transfer:', error);
        alert('Error saving transfer: ' + error.message);
    }
}

async function viewTransfer(id) {
    const transfer = allTransfers.find(t => t.id === id);
    if (!transfer) return;
    _currentViewedTransfer = transfer;

    const modal = document.getElementById('view-transfer-modal');
    if (!modal) {
        alert('View transfer modal not found');
        return;
    }
    
    const barcodeDisplay = (typeof transfer.equipment_barcode === 'object' || transfer.equipment_barcode === '[object Object]') ? '-' : (transfer.equipment_barcode || '-');
    const fromSubBusiness = [transfer.from_sub_location_name, transfer.from_business_type_name, transfer.from_business_unit_code].filter(Boolean).join(' - ') || '-';
    const toSubBusiness = [transfer.to_sub_location_name, transfer.to_business_type_name, transfer.to_business_unit_code].filter(Boolean).join(' - ') || '-';

    document.getElementById('view-transfer-serial').textContent = transfer.transfer_serial_number || '-';
    document.getElementById('view-equipment-serial').textContent = transfer.equipment_auto_serial || '-';
    document.getElementById('view-equipment-name').textContent = transfer.equipment_name || '-';
    document.getElementById('view-equipment-barcode').textContent = barcodeDisplay;
    document.getElementById('view-from-country').textContent = transfer.from_country_name || '-';
    document.getElementById('view-from-location').textContent = transfer.from_location_type_name || '-';
    document.getElementById('view-from-subbusiness').textContent = fromSubBusiness;
    document.getElementById('view-to-country').textContent = transfer.to_country_name || '-';
    document.getElementById('view-to-location').textContent = transfer.to_location_type_name || '-';
    document.getElementById('view-to-subbusiness').textContent = toSubBusiness;
    document.getElementById('view-transfer-date').textContent = formatDate(transfer.transfer_date);
    document.getElementById('view-created-by').textContent = transfer.created_by || '-';
    document.getElementById('view-previous-assigned-to').textContent = transfer.previous_assigned_to_name || transfer.previous_assigned_to || '-';
    document.getElementById('view-assigned-to').textContent = transfer.assigned_to_name || transfer.assigned_to || '-';
    document.getElementById('view-notes').textContent = transfer.notes || '-';
    
    modal.classList.add('active');
}

function closeViewTransferModal() {
    document.getElementById('view-transfer-modal').classList.remove('active');
}

let _currentViewedTransfer = null;

function printTransferDetails() {
    const t = _currentViewedTransfer;
    if (!t) return;

    const barcodeDisplay = (typeof t.equipment_barcode === 'object' || t.equipment_barcode === '[object Object]') ? '-' : (t.equipment_barcode || '-');
    const fromSubBusiness = [t.from_sub_location_name, t.from_business_type_name, t.from_business_unit_code].filter(Boolean).join(' - ') || '-';
    const toSubBusiness   = [t.to_sub_location_name,   t.to_business_type_name,   t.to_business_unit_code].filter(Boolean).join(' - ') || '-';

    const html = `<!DOCTYPE html>
<html>
<head>
    <title>Transfer Report - ${t.transfer_serial_number || t.id}</title>
    <style>
        @page { margin: 1cm 1cm 1.8cm 1cm; @bottom-right { content: "Page " counter(page) " of " counter(pages); font-size: 10px; color: #999; } }
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 0; margin: 0; color: #333; font-size: 11px; line-height: 1.3; }
        .page { max-width: 800px; margin: 0 auto; padding: 20px; }
        .doc-header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #1e40af; padding-bottom: 12px; margin-bottom: 16px; }
        .doc-header .logo-block { flex: 1; }
        .doc-header .logo-block img { max-height: 80px; max-width: 220px; object-fit: contain; display: block; }
        .doc-header .logo-block .logo-fallback { display: none; font-size: 13px; color: #6b7280; font-style: italic; }
        .doc-header .title-block { flex: 1; text-align: center; }
        .doc-header .title-block h1 { margin: 0; font-size: 22px; font-weight: 700; color: #1e40af; letter-spacing: 0.3px; }
        .doc-header .title-block p { margin: 4px 0 0; color: #6b7280; font-size: 12px; }
        .doc-header .doc-id { flex: 1; text-align: right; }
        .doc-header .doc-id .id-label { font-size: 10px; color: #9ca3af; text-transform: uppercase; letter-spacing: 0.5px; }
        .doc-header .doc-id .id-value { font-size: 14px; font-weight: 700; color: #1f2937; }
        h2  { font-size: 11px; color: #555; margin: 12px 0 4px; border-bottom: 1px solid #ddd; padding-bottom: 2px; text-transform: uppercase; letter-spacing: .04em; }
        table  { width: 100%; border-collapse: collapse; margin-bottom: 4px; }
        td { padding: 4px 6px; border: 1px solid #e2e8f0; vertical-align: top; }
        .lbl { font-weight: bold; background: #f8fafc; width: 30%; }
        .grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 4px; }
        .box  { border: 1px solid #e2e8f0; border-radius: 6px; padding: 8px; }
        .box-title { font-size: 10px; font-weight: bold; text-transform: uppercase; letter-spacing: .06em; margin-bottom: 6px; }
        .from-title { color: #c2410c; }
        .to-title   { color: #15803d; }
        .actions { text-align: center; margin-bottom: 20px; }
        .actions button { padding: 10px 24px; font-size: 14px; background: #1e40af; color: #fff; border: none; border-radius: 6px; cursor: pointer; }
        @media print { .actions { display: none; } }
    </style>
</head>
<body>
    <div class="page">
    <div class="doc-header">
        <div class="logo-block">
            <img src="/company-logo/company-logo.png" alt="Company Logo" onerror="this.style.display='none'; this.nextElementSibling.style.display='block';">
            <div class="logo-fallback" style="display:none;">[Company Logo]<br><span style="font-size:10px;">Place company-logo.png in public/company-logo/</span></div>
        </div>
        <div class="title-block">
            <h1>Equipment Transfer</h1>
            <p>Transfer Report</p>
        </div>
        <div class="doc-id">
            <div class="id-label">Transfer Ref</div>
            <div class="id-value">${t.transfer_serial_number || t.id}</div>
        </div>
    </div>
    <div class="actions"><button onclick="window.print()">&#x1F5A8; Print / Save as PDF</button></div>

    <h2>Equipment</h2>
    <table>
        <tr><td class="lbl">Name</td><td colspan="3">${t.equipment_name || '-'}</td></tr>
        <tr><td class="lbl">Auto Serial</td><td>${t.equipment_auto_serial || '-'}</td>
            <td class="lbl">Barcode</td><td>${barcodeDisplay}</td></tr>
    </table>

    <h2>Transfer</h2>
    <table>
        <tr><td class="lbl">Transfer Serial</td><td>${t.transfer_serial_number || '-'}</td>
            <td class="lbl">Transfer Date</td><td>${formatDate(t.transfer_date)}</td></tr>
        <tr><td class="lbl">Created By</td><td>${t.created_by || '-'}</td>
            <td class="lbl">Assigned To</td><td>${t.assigned_to_name || t.assigned_to || '-'}</td></tr>
        <tr><td class="lbl">Previous Assigned To</td><td colspan="3">${t.previous_assigned_to_name || t.previous_assigned_to || '-'}</td></tr>
        <tr><td class="lbl">Notes</td><td colspan="3">${t.notes || '-'}</td></tr>
    </table>

    <h2>Location</h2>
    <div class="grid2">
        <div class="box">
            <div class="box-title from-title">From</div>
            <table>
                <tr><td class="lbl">Country</td><td>${t.from_country_name || '-'}</td></tr>
                <tr><td class="lbl">Location</td><td>${t.from_location_type_name || '-'}</td></tr>
                <tr><td class="lbl">Sub / Business</td><td>${fromSubBusiness}</td></tr>
            </table>
        </div>
        <div class="box">
            <div class="box-title to-title">To</div>
            <table>
                <tr><td class="lbl">Country</td><td>${t.to_country_name || '-'}</td></tr>
                <tr><td class="lbl">Location</td><td>${t.to_location_type_name || '-'}</td></tr>
                <tr><td class="lbl">Sub / Business</td><td>${toSubBusiness}</td></tr>
            </table>
        </div>
    </div>
    </div>
</body>
</html>`;

    const iframe = document.createElement('iframe');
    iframe.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;border:none;z-index:9999;';
    document.body.appendChild(iframe);
    iframe.contentWindow.document.open();
    iframe.contentWindow.document.write(html);
    iframe.contentWindow.document.close();
    iframe.contentWindow.focus();
    iframe.contentWindow.print();
    iframe.style.visibility = 'hidden';
    const remove = () => { if (iframe.parentNode) document.body.removeChild(iframe); };
    try { iframe.contentWindow.addEventListener('afterprint', remove, { once: true }); } catch(e) {}
    setTimeout(remove, 500);
}

async function editTransfer(id) {
    const transfer = allTransfers.find(t => t.id === id);
    if (!transfer) return;

    await openTransferModal();

    document.getElementById('transfer-id').value = transfer.id;
    document.getElementById('transfer-serial').value = transfer.transfer_serial_number || '';
    document.getElementById('transfer-equipment').value = transfer.equipment_name || '';
    document.getElementById('transfer-from-location').value = transfer.from_location_id || '';

    const fromAssignment = window.allBusinessTypeAssignments ? window.allBusinessTypeAssignments.find(a => a.id == transfer.from_location_id) : null;
    document.getElementById('transfer-from-country').value = fromAssignment ? fromAssignment.country_name || '' : '';
    document.getElementById('transfer-from-location-name').value = fromAssignment ? fromAssignment.location_name || '' : '';
    document.getElementById('transfer-from-sublocation-name').value = fromAssignment ? formatSublocationOptionText(fromAssignment) : '';

    document.getElementById('transfer-date').value = transfer.transfer_date || '';
    document.getElementById('transfer-assigned-to').value = transfer.assigned_to || '';
    document.getElementById('transfer-notes').value = transfer.notes || '';
    document.getElementById('transfer-created-by').value = transfer.created_by || '';
    const eq = allEquipment.find(e => e.id === transfer.equipment_id);
    document.getElementById('transfer-current-assigned-to').value = (eq && eq.assigned_to_name) ? eq.assigned_to_name : 'Not Assigned';

    // Set cascading to-location selects from the saved assignment id
    await setCascadingLocationByAssignment(transfer.to_location_id, 'transfer-to-country', 'transfer-to-location', 'transfer-to-sublocation');
}

async function deleteTransfer(id) {
    if (!currentModuleManager) {
        alert('Please select a module manager.');
        return;
    }
    if (!confirm('Are you sure you want to delete this transfer?')) return;

    try {
        const response = await fetch(`${API_BASE}/equipment/transfers/${id}?manager_id=${currentModuleManager.id}`, { method: 'DELETE' });
        if (!response.ok) {
            const error = await response.json().catch(() => ({ error: 'Unknown error' }));
            console.error('Error deleting transfer:', error);
            alert('Error deleting transfer: ' + (error.error || response.statusText));
            return;
        }

        await loadTransfers();
        await loadEquipment();
    } catch (error) {
        console.error('Error deleting transfer:', error);
        alert('Error deleting transfer: ' + error.message);
    }
}

function highlightTransferFilters() {
    highlightFilters([
        'transfer-search',
        'transfer-filter-equipment',
        'transfer-filter-from-country',
        'transfer-filter-from-location',
        'transfer-filter-from-sublocation',
        'transfer-filter-to-country',
        'transfer-filter-to-location',
        'transfer-filter-to-sublocation'
    ]);
}

function clearTransferFilters() {
    clearAllFilters([
        'transfer-search',
        'transfer-filter-equipment',
        'transfer-filter-from-country',
        'transfer-filter-from-location',
        'transfer-filter-from-sublocation',
        'transfer-filter-to-country',
        'transfer-filter-to-location',
        'transfer-filter-to-sublocation'
    ], null, null, null, null, filterTransfers);
}

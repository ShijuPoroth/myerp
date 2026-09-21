// Equipment core: list, filters, modal, view, print, CSV, and shared helpers
let allTransfers = [];
let allMaintenance = [];
let allPartsItems = [];
let allPartsPurchases = [];
let allEquipmentPurchases = [];

// Global variables for warehouse settings data (renamed to avoid conflicts with admin-settings.js)
let equipmentItemCategories = [];
let equipmentItemSubcategories = [];
let equipmentItemTypes = [];
let equipmentItems = [];

// ===== Excel-style Header Filter System for Equipment =====
const EQUIPMENT_HEADER_FILTER_COLS = [
    'auto_serial', 'name', 'brand', 'model', 'barcode', 'serial_number', 'category',
    'specification', 'condition', 'po_number', 'country', 'location', 'sublocation_business_type',
    'status', 'owner', 'assigned_to', 'price', 'other_charges', 'purchase_cost',
    'purchase_date', 'warranty_expiry', 'next_pm', 'maintenance_status', 'comments'
];
let equipmentHeaderFilterState = {};

function getEquipmentColumnValue(eq, col) {
    switch (col) {
        case 'auto_serial': return eq.auto_serial_number || '-';
        case 'name': return eq.name || '-';
        case 'barcode': return (typeof eq.barcode === 'object' || eq.barcode === '[object Object]') ? '-' : (eq.barcode || '-');
        case 'serial_number': return eq.serial_number || '-';
        case 'category': return eq.category || '-';
        case 'po_number': return eq.purchase_order_number || '-';
        case 'country': return eq.country_name || '-';
        case 'location': return eq.location_name || '-';
        case 'sublocation_business_type': return (eq.sub_location_name && eq.business_type_name ? eq.sub_location_name + ' - ' + eq.business_type_name : eq.sub_location_name || eq.business_type_name || eq.business_unit_code || '-');
        case 'status': return eq.display_status || eq.status || '-';
        case 'maintenance_status': return eq.maintenance_status || '-';
        case 'owner': return eq.owner_name || '-';
        case 'assigned_to': return eq.assigned_to_name || '-';
        case 'brand': return eq.brand || '-';
        case 'model': return eq.model || '-';
        case 'specification': return eq.specification || '-';
        case 'condition': return eq.condition || '-';
        case 'price': return eq.price != null ? String(eq.price) : '-';
        case 'other_charges': return eq.other_charges != null ? String(eq.other_charges) : '-';
        case 'purchase_cost': return eq.purchase_cost != null ? String(eq.purchase_cost) : '-';
        case 'purchase_date': return eq.purchase_date ? formatDate(eq.purchase_date) : '-';
        case 'warranty_expiry': return eq.warranty_expiry ? formatDate(eq.warranty_expiry) : '-';
        case 'next_pm': return eq.next_pm_date ? formatDate(eq.next_pm_date) : '-';
        case 'comments': return eq.comments || '-';
        default: return '-';
    }
}

function populateEquipmentHeaderFilters() {
    EQUIPMENT_HEADER_FILTER_COLS.forEach(col => {
        const uniqueVals = [...new Set(allEquipment.map(eq => getEquipmentColumnValue(eq, col)))].sort();
        if (!equipmentHeaderFilterState[col]) {
            equipmentHeaderFilterState[col] = { selected: new Set(uniqueVals), allValues: uniqueVals };
        } else {
            equipmentHeaderFilterState[col].allValues = uniqueVals;
            const validSelected = new Set();
            uniqueVals.forEach(v => {
                if (equipmentHeaderFilterState[col].selected.has(v) || equipmentHeaderFilterState[col].selected.size === 0) {
                    validSelected.add(v);
                }
            });
            if (equipmentHeaderFilterState[col].selected.size === 0) {
                uniqueVals.forEach(v => validSelected.add(v));
            }
            equipmentHeaderFilterState[col].selected = validSelected;
        }
        renderEquipmentHeaderFilterCheckboxes(col);
        updateEquipmentHeaderFilterIcon(col);
    });
}

function renderEquipmentHeaderFilterCheckboxes(col) {
    const list = document.getElementById(`eq-header-checkbox-list-${col}`);
    if (!list) return;
    const state = equipmentHeaderFilterState[col];
    const values = state.allValues;
    list.innerHTML = values.map(v => {
        const checked = state.selected.has(v) ? 'checked' : '';
        const displayVal = v === '-' ? '(blank)' : v;
        return `<label class="flex items-center px-3 py-2 hover:bg-gray-50 border-b text-sm cursor-pointer eq-header-cb-label" data-value="${v.replace(/"/g, '&quot;')}">
            <input type="checkbox" class="eq-header-cb mr-2" value="${v.replace(/"/g, '&quot;')}" ${checked} onchange="onEquipmentHeaderCheckboxChange('${col}')"> <span class="truncate">${displayVal}</span>
        </label>`;
    }).join('');
    const checkAll = document.getElementById(`eq-header-check-all-${col}`);
    if (checkAll) checkAll.checked = state.selected.size === state.allValues.length;
}

function toggleEquipmentHeaderFilter(col) {
    EQUIPMENT_HEADER_FILTER_COLS.forEach(c => {
        if (c !== col) {
            const d = document.getElementById(`eq-header-filter-${c}`);
            if (d) d.classList.add('hidden');
        }
    });
    const dropdown = document.getElementById(`eq-header-filter-${col}`);
    if (dropdown) {
        dropdown.classList.toggle('hidden');
        if (!dropdown.classList.contains('hidden')) {
            const state = equipmentHeaderFilterState[col];
            if (state && col !== 'location' && col !== 'sublocation_business_type') {
                state.allValues = [...new Set(allEquipment.map(eq => getEquipmentColumnValue(eq, col)))].sort();
                renderEquipmentHeaderFilterCheckboxes(col);
            }
        }
    }
}

function filterEquipmentHeaderList(col, search) {
    const searchLower = search.toLowerCase();
    const labels = document.querySelectorAll(`#eq-header-checkbox-list-${col} label`);
    labels.forEach(label => {
        const text = label.textContent.trim().toLowerCase();
        label.style.display = text.includes(searchLower) ? '' : 'none';
    });
}

function onEquipmentHeaderCheckAll(col) {
    const checkAll = document.getElementById(`eq-header-check-all-${col}`);
    const state = equipmentHeaderFilterState[col];
    if (!state) return;
    if (checkAll.checked) {
        state.allValues.forEach(v => state.selected.add(v));
    } else {
        state.selected.clear();
    }
    renderEquipmentHeaderFilterCheckboxes(col);
    updateEquipmentHeaderFilterIcon(col);
    if (col === 'country' || col === 'location') {
        cascadeEquipmentFilters();
    }
    filterEquipment();
}

function onEquipmentHeaderCheckboxChange(col) {
    const state = equipmentHeaderFilterState[col];
    if (!state) return;
    const checkboxes = document.querySelectorAll(`#eq-header-checkbox-list-${col} .eq-header-cb`);
    const checked = Array.from(checkboxes).filter(cb => cb.checked);
    const checkAll = document.getElementById(`eq-header-check-all-${col}`);
    if (checkAll) checkAll.checked = checked.length === checkboxes.length;
    state.selected = new Set(checked.map(cb => cb.value));
    updateEquipmentHeaderFilterIcon(col);
    if (col === 'country' || col === 'location') {
        cascadeEquipmentFilters();
    }
    filterEquipment();
}

function cascadeEquipmentFilters() {
    // Step 1: Filter equipment by all columns except location and sublocation
    const countryState = equipmentHeaderFilterState['country'];
    const countryFiltered = allEquipment.filter(eq => {
        if (countryState && countryState.selected.size < countryState.allValues.length) {
            return countryState.selected.has(getEquipmentColumnValue(eq, 'country'));
        }
        return true;
    });

    // Step 2: Update location allValues based on country-filtered equipment
    const locState = equipmentHeaderFilterState['location'];
    if (locState) {
        const newLocVals = [...new Set(countryFiltered.map(eq => getEquipmentColumnValue(eq, 'location')))];
        locState.allValues = newLocVals.sort();
        // Keep only selected values that are still available
        const newSelected = new Set();
        locState.selected.forEach(v => {
            if (newLocVals.includes(v)) newSelected.add(v);
        });
        // If nothing was selected (all unchecked), keep nothing selected
        // If all were selected before, select all new values
        if (locState.selected.size === 0 && newLocVals.length > 0) {
            // keep empty (user unchecked all)
        } else if (newSelected.size === 0 && locState.selected.size > 0) {
            // All previously selected are gone, select all new
            newLocVals.forEach(v => newSelected.add(v));
        }
        locState.selected = newSelected;
        renderEquipmentHeaderFilterCheckboxes('location');
        updateEquipmentHeaderFilterIcon('location');
    }

    // Step 3: Filter by country + location to get sublocation values
    const locFiltered = countryFiltered.filter(eq => {
        if (locState && locState.selected.size < locState.allValues.length) {
            return locState.selected.has(getEquipmentColumnValue(eq, 'location'));
        }
        return true;
    });

    // Step 4: Update sublocation allValues
    const subState = equipmentHeaderFilterState['sublocation_business_type'];
    if (subState) {
        const newSubVals = [...new Set(locFiltered.map(eq => getEquipmentColumnValue(eq, 'sublocation_business_type')))];
        subState.allValues = newSubVals.sort();
        const newSelected = new Set();
        subState.selected.forEach(v => {
            if (newSubVals.includes(v)) newSelected.add(v);
        });
        if (subState.selected.size === 0 && newSubVals.length > 0) {
            // keep empty
        } else if (newSelected.size === 0 && subState.selected.size > 0) {
            newSubVals.forEach(v => newSelected.add(v));
        }
        subState.selected = newSelected;
        renderEquipmentHeaderFilterCheckboxes('sublocation_business_type');
        updateEquipmentHeaderFilterIcon('sublocation_business_type');
    }
}

function updateEquipmentHeaderFilterIcon(col) {
    const icon = document.querySelector(`.eq-header-filter-icon[data-col="${col}"]`);
    if (!icon) return;
    const state = equipmentHeaderFilterState[col];
    if (state && state.selected.size < state.allValues.length) {
        icon.classList.add('text-yellow-500');
        icon.classList.remove('text-gray-400');
    } else {
        icon.classList.remove('text-yellow-500');
        icon.classList.add('text-gray-400');
    }
}

document.addEventListener('click', function(event) {
    EQUIPMENT_HEADER_FILTER_COLS.forEach(col => {
        const dropdown = document.getElementById(`eq-header-filter-${col}`);
        const btn = dropdown ? dropdown.parentElement.querySelector('button') : null;
        if (dropdown && btn && !dropdown.contains(event.target) && !btn.contains(event.target)) {
            dropdown.classList.add('hidden');
        }
    });
});

async function loadAllEmployeesForEquipment() {
    if (typeof allEmployees !== 'undefined' && allEmployees && allEmployees.length > 0) {
        return allEmployees;
    }
    try {
        const response = await fetch(`${API_BASE}/employees`);
        const employees = await response.json();
        if (typeof allEmployees !== 'undefined') allEmployees = employees;
        return employees;
    } catch (error) {
        console.error('Error loading employees for equipment:', error);
        return [];
    }
}

// Setup assigned_to dropdown once after modals are loaded
document.addEventListener('modalsLoaded', () => {
    setupEquipmentAssignedToDropdown();
});

function getNextPreventiveMaintenanceDate(purchaseDate, months) {
    if (!purchaseDate || !months || months <= 0) return null;
    const start = new Date(purchaseDate);
    if (isNaN(start.getTime())) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    let next = new Date(start);
    next.setHours(0, 0, 0, 0);
    while (next < today) {
        next.setMonth(next.getMonth() + parseInt(months));
    }
    return next;
}

function getPreviousPreventiveMaintenanceDate(purchaseDate, months) {
    const next = getNextPreventiveMaintenanceDate(purchaseDate, months);
    if (!next) return null;
    const prev = new Date(next);
    prev.setMonth(prev.getMonth() - parseInt(months));
    return prev;
}

function getNextDueDateFromAnchor(anchorDate, months) {
    if (!anchorDate || !months || months <= 0) return null;
    const anchor = new Date(anchorDate);
    if (isNaN(anchor.getTime())) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    let next = new Date(anchor);
    next.setHours(0, 0, 0, 0);
    next.setMonth(next.getMonth() + parseInt(months));
    while (next < today) {
        next.setMonth(next.getMonth() + parseInt(months));
    }
    return next;
}

function getNearestMaintenanceDueDate(purchaseDate, months, lastMaintenanceDate, inServiceDate, transferCount, accumulatedUsageDays) {
    if (!months || months <= 0) return null;
    if (!inServiceDate) return null;

    const accDays = parseInt(accumulatedUsageDays) || 0;
    let anchorDate = null;

    if (lastMaintenanceDate && accDays === 0) {
        // Maintenance was done and no accumulated usage since — count from last maintenance
        anchorDate = lastMaintenanceDate;
    } else {
        // Count from in service date, back-dated by accumulated usage days
        // This accounts for time the equipment was in service before being returned to store
        const baseDate = new Date(inServiceDate);
        baseDate.setDate(baseDate.getDate() - accDays);
        anchorDate = baseDate.toISOString().split('T')[0];
    }

    if (!anchorDate) return null;
    const anchor = new Date(anchorDate);
    if (isNaN(anchor.getTime())) return null;

    return getNextDueDateFromAnchor(anchorDate, months);
}

function getMaintenanceWarning(dueDate, thresholdDays = 30) {
    if (!dueDate) return { text: '', class: '', approaching: false };
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const diffTime = dueDate - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    if (diffDays < 0) {
        return { text: `Overdue (${Math.abs(diffDays)}d)`, class: 'bg-red-100 text-red-700', approaching: true };
    }
    if (diffDays <= thresholdDays) {
        return { text: `Due in ${diffDays}d`, class: 'bg-yellow-100 text-yellow-700', approaching: true };
    }
    return { text: '', class: '', approaching: false };
}

async function loadEquipment() {
showTableLoading('equipment-table-body', 'Loading equipment list...');
    try {
        const response = await fetch(`${API_BASE}/equipment?_t=${Date.now()}`);
        allEquipment = await response.json();
if (Array.isArray(allEquipment)) {
            populateEquipmentHeaderFilters();
            populateEquipmentSelects();
            unlockColumnWidths('#equipment-table');
            if (typeof applyEquipmentColumnVisibility === 'function') applyEquipmentColumnVisibility();
            const tbody = document.getElementById('equipment-table-body');
            if (tbody) {
                const total = allEquipment.length;
                tbody.innerHTML = allEquipment.map((eq, index) => {
                    const serial = index + 1;
                    return renderEquipmentRow(eq, serial, total);
                }).join('');
            }
            if (typeof applyEquipmentColumnVisibility === 'function') applyEquipmentColumnVisibility();
            lockColumnWidths('#equipment-table');
            if (typeof applyEquipmentFreeze === 'function') applyEquipmentFreeze();
            filterEquipment();
        } else {
            console.error('Equipment data is not an array:', allEquipment);
        }
    } catch (error) {
        console.error('Error loading equipment:', error);
        showTableError('equipment-table-body', 'Error loading equipment. Please try again.');
    }
}

async function importEquipmentCSV(input) {
    const file = input.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('csv', file);

    try {
        const response = await fetch(`${API_BASE}/equipment/import-csv`, {
            method: 'POST',
            body: formData
        });
        const result = await response.json();
        if (response.ok) {
            const msg = result.errors && result.errors.length > 0
                ? `${result.message}\n\nErrors:\n${result.errors.join('\n')}`
                : result.message;
            alert(msg);
            loadEquipment();
            input.value = '';
        } else {
            alert('Import failed: ' + (result.error || 'Unknown error'));
        }
    } catch (error) {
        console.error('Error importing CSV:', error);
        alert('Error importing CSV');
    }
}

function downloadEquipmentCSVTemplate() {
    window.open(`${API_BASE}/equipment/export-template`, '_blank');
}

function exportEquipmentCSV() {
    if (typeof hasTablePermission === 'function' && !hasTablePermission('equipment', 'export')) {
        alert('You do not have permission to export.');
        return;
    }
    const filtered = getFilteredEquipment();
    const visibility = (typeof getEquipmentColumnVisibility === 'function') ? getEquipmentColumnVisibility() : null;
    const columns = (typeof EQUIPMENT_COLUMNS !== 'undefined') ? EQUIPMENT_COLUMNS : [
        { key: 'serial', label: '#' }, { key: 'auto_serial', label: 'Auto Serial' }, { key: 'name', label: 'Name' },
        { key: 'brand', label: 'Brand' }, { key: 'model', label: 'Model' }, { key: 'barcode', label: 'Barcode' },
        { key: 'serial_number', label: 'Serial Number' }, { key: 'category', label: 'Category' },
        { key: 'specification', label: 'Specification' }, { key: 'condition', label: 'Condition' },
        { key: 'po_number', label: 'PO Number' }, { key: 'country', label: 'Country' },
        { key: 'location', label: 'Location' }, { key: 'sublocation_business_type', label: 'Sublocation / Business Type' },
        { key: 'status', label: 'Status' }, { key: 'owner', label: 'Owner' }, { key: 'assigned_to', label: 'Assigned To' },
        { key: 'price', label: 'Price' }, { key: 'other_charges', label: 'Other Charges' },
        { key: 'purchase_cost', label: 'Purchase Cost' }, { key: 'purchase_date', label: 'Purchase Date' },
        { key: 'warranty_expiry', label: 'Warranty Expiry' }, { key: 'pm', label: 'Preventive Maintenance' },
        { key: 'next_pm', label: 'Next PM Date' }, { key: 'maintenance_status', label: 'Maintenance Status' },
        { key: 'comments', label: 'Comments' }
    ];

    const activeColumns = columns.filter(col => col.key !== 'actions' && (!visibility || visibility[col.key] !== false));
    const filterCriteria = getEquipmentFilterCriteria();
    const headers = activeColumns.map(col => col.label);
    let csv = '';
    if (filterCriteria.length > 0) {
        csv += buildCSVRow(['Filters: ' + filterCriteria.join(' | ')]);
        csv += buildCSVRow(['']);
    }
    csv += buildCSVRow(headers);
    const total = filtered.length;
    filtered.forEach((eq, index) => {
        const serial = index + 1;
        const values = activeColumns.map(col => getEquipmentExportValue(eq, col.key, serial));
        csv += buildCSVRow(values);
    });

    downloadCSV(csv, 'equipment_export.csv');
}

async function exportEquipmentExcel() {
    if (typeof hasTablePermission === 'function' && !hasTablePermission('equipment', 'export')) {
        alert('You do not have permission to export.');
        return;
    }
    const filtered = getFilteredEquipment();
    if (filtered.length === 0) {
        alert('No equipment to export.');
        return;
    }
    const visibility = (typeof getEquipmentColumnVisibility === 'function') ? getEquipmentColumnVisibility() : null;
    const columns = (typeof EQUIPMENT_COLUMNS !== 'undefined') ? EQUIPMENT_COLUMNS : [
        { key: 'serial', label: '#' }, { key: 'auto_serial', label: 'Auto Serial' }, { key: 'name', label: 'Name' },
        { key: 'brand', label: 'Brand' }, { key: 'model', label: 'Model' }, { key: 'barcode', label: 'Barcode' },
        { key: 'serial_number', label: 'Serial Number' }, { key: 'category', label: 'Category' },
        { key: 'specification', label: 'Specification' }, { key: 'condition', label: 'Condition' },
        { key: 'po_number', label: 'PO Number' }, { key: 'country', label: 'Country' },
        { key: 'location', label: 'Location' }, { key: 'sublocation_business_type', label: 'Sublocation / Business Type' },
        { key: 'status', label: 'Status' }, { key: 'owner', label: 'Owner' }, { key: 'assigned_to', label: 'Assigned To' },
        { key: 'price', label: 'Price' }, { key: 'other_charges', label: 'Other Charges' },
        { key: 'purchase_cost', label: 'Purchase Cost' }, { key: 'purchase_date', label: 'Purchase Date' },
        { key: 'warranty_expiry', label: 'Warranty Expiry' },
        { key: 'next_pm', label: 'Next PM Date' }, { key: 'maintenance_status', label: 'Maintenance Status' },
        { key: 'comments', label: 'Comments' }
    ];
    const activeColumns = columns.filter(col => col.key !== 'actions' && (!visibility || visibility[col.key] !== false));
    const equipmentIds = filtered.map(eq => eq.id);
    const filterCriteria = getEquipmentFilterCriteria();

    try {
        const response = await fetch(`${API_BASE}/equipment/export-xlsx`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ equipmentIds, columns: activeColumns, filterCriteria })
        });
        if (!response.ok) {
            const err = await response.json().catch(() => ({}));
            throw new Error(err.error || 'Export failed');
        }
        const blob = await response.blob();
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = 'equipment_export.xlsx';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(link.href);
    } catch (error) {
        console.error('Error exporting Excel:', error);
        alert('Error exporting Excel: ' + error.message);
    }
}

function exportEquipmentPDF() {
    if (typeof hasTablePermission === 'function' && !hasTablePermission('equipment', 'export')) {
        alert('You do not have permission to export.');
        return;
    }
    const filtered = getFilteredEquipment();
    const visibility = (typeof getEquipmentColumnVisibility === 'function') ? getEquipmentColumnVisibility() : null;
    const columns = (typeof EQUIPMENT_COLUMNS !== 'undefined') ? EQUIPMENT_COLUMNS : [
        { key: 'serial', label: '#' }, { key: 'auto_serial', label: 'Auto Serial' }, { key: 'name', label: 'Name' },
        { key: 'brand', label: 'Brand' }, { key: 'model', label: 'Model' }, { key: 'barcode', label: 'Barcode' },
        { key: 'serial_number', label: 'Serial Number' }, { key: 'category', label: 'Category' },
        { key: 'specification', label: 'Specification' }, { key: 'condition', label: 'Condition' },
        { key: 'po_number', label: 'PO Number' }, { key: 'country', label: 'Country' },
        { key: 'location', label: 'Location' }, { key: 'sublocation_business_type', label: 'Sublocation / Business Type' },
        { key: 'status', label: 'Status' }, { key: 'owner', label: 'Owner' }, { key: 'assigned_to', label: 'Assigned To' },
        { key: 'price', label: 'Price' }, { key: 'other_charges', label: 'Other Charges' },
        { key: 'purchase_cost', label: 'Purchase Cost' }, { key: 'purchase_date', label: 'Purchase Date' },
        { key: 'warranty_expiry', label: 'Warranty Expiry' }, { key: 'pm', label: 'Preventive Maintenance' },
        { key: 'next_pm', label: 'Next PM Date' }, { key: 'maintenance_status', label: 'Maintenance Status' },
        { key: 'comments', label: 'Comments' }
    ];

    const activeColumns = columns.filter(col => col.key !== 'actions' && (!visibility || visibility[col.key] !== false));
    const headers = activeColumns.map(col => col.label);
    const total = filtered.length;
    const rows = filtered.map((eq, index) => {
        const serial = index + 1;
        return activeColumns.map(col => {
            const value = getEquipmentExportValue(eq, col.key, serial);
            // Don't escape HTML for thumbnail column to allow image rendering
            return col.key === 'thumbnail' ? value : escapeHTML(String(value));
        });
    });
    const filterCriteria = getEquipmentFilterCriteria();

    const html = buildEquipmentPDFHtml(headers, rows, filtered.length, filterCriteria);
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.width = '100%';
    iframe.style.height = '100%';
    iframe.style.top = '0';
    iframe.style.left = '0';
    iframe.style.border = 'none';
    iframe.style.zIndex = '9999';
    document.body.appendChild(iframe);
    iframe.contentWindow.document.open();
    iframe.contentWindow.document.write(html);
    iframe.contentWindow.document.close();
    iframe.contentWindow.focus();
    iframe.contentWindow.print();

    iframe.style.visibility = 'hidden';
    const removeIframe = () => {
        if (iframe.parentNode) document.body.removeChild(iframe);
    };
    try {
        iframe.contentWindow.addEventListener('afterprint', removeIframe, { once: true });
    } catch (e) {
        // ignore cross-origin or unsupported cases
    }
    setTimeout(removeIframe, 500);
}

function getEquipmentFilterCriteria() {
    const criteria = [];
    const search = document.getElementById('equipment-search')?.value.trim();
    if (search) criteria.push(`Search: ${search}`);
    EQUIPMENT_HEADER_FILTER_COLS.forEach(col => {
        const state = equipmentHeaderFilterState[col];
        if (state && state.selected.size < state.allValues.length) {
            const label = (typeof EQUIPMENT_COLUMNS !== 'undefined') ? (EQUIPMENT_COLUMNS.find(c => c.key === col)?.label || col) : col;
            const selectedVals = Array.from(state.selected).sort();
            if (selectedVals.length === 0) {
                criteria.push(`${label}: (blank)`);
            } else if (col === 'barcode' || col === 'serial_number') {
                criteria.push(`${label}: filtered`);
            } else {
                criteria.push(`${label}: ${selectedVals.join(', ')}`);
            }
        }
    });
    return criteria;
}

function escapeHTML(value) {
    const str = value == null ? '' : String(value);
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function buildEquipmentPDFHtml(headers, rows, total, filterCriteria) {
    const headerCells = headers.map(h => `<th>${h}</th>`).join('');
    const bodyRows = rows.map(cells => `<tr>${cells.map(c => `<td>${c}</td>`).join('')}</tr>`).join('');
    const filterHtml = filterCriteria.length
        ? `<div class="filters"><strong>Filters:</strong> ${filterCriteria.map(f => escapeHTML(f)).join(' &nbsp;|&nbsp; ')}</div>`
        : '';
    return `<!DOCTYPE html>
<html>
<head>
    <title>Equipment List</title>
    <style>
        @page { size: landscape; margin: 10mm 10mm 18mm 10mm; @bottom-right { content: "Page " counter(page) " of " counter(pages); font-size: 10px; color: #999; } }
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 20px; color: #1f2937; font-size: 10px; }
        h1 { margin: 0 0 8px; font-size: 18px; }
        .meta, .filters { margin-bottom: 10px; font-size: 11px; color: #6b7280; }
        .filters strong { color: #374151; }
        table { width: 100%; border-collapse: collapse; }
        th, td { border: 1px solid #d1d5db; padding: 5px 6px; text-align: left; vertical-align: top; }
        th { background: #1e40af; color: #fff; font-weight: 600; }
        tr:nth-child(even) { background: #f9fafb; }
        .no-print { text-align: center; margin-top: 20px; }
        .no-print button { padding: 8px 18px; background: #1e40af; color: #fff; border: none; border-radius: 4px; cursor: pointer; font-size: 12px; }
        @media print { .no-print { display: none; } }
    </style>
</head>
<body>
    <h1>Equipment List</h1>
    <div class="meta">Total records: ${total} &nbsp;|&nbsp; Exported on ${formatDate(new Date())}</div>
    ${filterHtml}
    <table>
        <thead><tr>${headerCells}</tr></thead>
        <tbody>${bodyRows}</tbody>
    </table>
</body>
</html>`;
}

function escapeCSV(value) {
    const str = value == null ? '' : String(value);
    if (/[",\n\r]/.test(str)) return '"' + str.replace(/"/g, '""') + '"';
    return str;
}

function buildCSVRow(values) {
    return values.map(escapeCSV).join(',') + '\n';
}

function downloadCSV(csv, filename) {
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
}

function getEquipmentExportValue(eq, key, serial) {
    switch (key) {
        case 'serial': return String(serial);
        case 'auto_serial': return eq.auto_serial_number || '-';
        case 'thumbnail': return eq.thumbnail_photo ? `<img src="${eq.thumbnail_photo}" loading="lazy" style="width: 40px; height: 40px; object-fit: cover; border-radius: 4px;">` : '-';
        case 'name': return eq.name || '-';
        case 'brand': return eq.brand || '-';
        case 'model': return eq.model || '-';
        case 'barcode': return (typeof eq.barcode === 'object' || eq.barcode === '[object Object]') ? '-' : (eq.barcode || '-');
        case 'serial_number': return eq.serial_number || '-';
        case 'category': return eq.category || '-';
        case 'specification': return eq.specification || '-';
        case 'condition': return eq.condition || '-';
        case 'po_number': return eq.purchase_order_number || '-';
        case 'country': return eq.country_name || '-';
        case 'location': return eq.location_name || '-';
        case 'sublocation_business_type': return (eq.sub_location_name && eq.business_type_name ? eq.sub_location_name + ' - ' + eq.business_type_name : eq.sub_location_name || eq.business_type_name || eq.business_unit_code || '-');
        case 'status': return eq.display_status || eq.status || '-';
        case 'owner': return eq.owner_name || '-';
        case 'assigned_to': return eq.assigned_to_name || '-';
        case 'price': return eq.price || '-';
        case 'other_charges': return eq.other_charges || '-';
        case 'purchase_cost': return eq.purchase_cost || '-';
        case 'purchase_date': return formatDate(eq.purchase_date) || '-';
        case 'warranty_expiry': return formatDate(eq.warranty_expiry) || '-';
        case 'pm': {
            return '-';
        }
        case 'next_pm': {
            const pmTypeLabels = { 'daily': 'Daily', 'weekly': 'Weekly', 'monthly': 'Monthly', 'quarterly': 'Quarterly', 'bi-annually': 'Bi-Annually', 'annually': 'Annually' };
            const nextPMDate = eq.next_pm_date ? new Date(eq.next_pm_date) : null;
            const nextPMTypeLabel = eq.next_pm_type ? (pmTypeLabels[eq.next_pm_type] || eq.next_pm_type) : '';
            return nextPMDate ? `${formatDate(nextPMDate)}${nextPMTypeLabel ? ' (' + nextPMTypeLabel + ')' : ''}` : '-';
        }
        case 'maintenance_status': return eq.maintenance_status || '-';
        case 'comments': return eq.comments || '-';
        default: return '';
    }
}

async function loadEquipmentDropdowns() {
    try {
const [suppliersRes, assignmentsRes] = await Promise.all([
            fetch(`${API_BASE}/suppliers`),
            fetch(`${API_BASE}/business-type-assignments`)
        ]);

        const suppliers = await suppliersRes.json();
        const assignments = await assignmentsRes.json();

        // Store assignments globally for filtering
        window.allBusinessTypeAssignments = assignments;

        // Populate transfer location filters
        populateTransferLocationFilters();

        // Populate supplier dropdown (filtered by assignment in the modal)
        const supplierSelect = document.getElementById('equipment-supplier');
        if (supplierSelect) {
            supplierSelect.innerHTML = '<option value="">Select Supplier</option>' +
                suppliers.map(s => `<option value="${s.id}">${s.name}</option>`).join('');
        }
    } catch (error) {
        console.error('Error loading equipment dropdowns:', error);
    }
}

// Function to load warehouse settings data for equipment modal
async function loadWarehouseSettingsForEquipment() {
    try {
const [categoriesRes, subcategoriesRes, itemTypesRes, itemsRes] = await Promise.all([
            fetch(`${API_BASE}/item-categories`),
            fetch(`${API_BASE}/item-subcategories`),
            fetch(`${API_BASE}/item-types`),
            fetch(`${API_BASE}/items`)
        ]);

        equipmentItemCategories = await categoriesRes.json();
        equipmentItemSubcategories = await subcategoriesRes.json();
        equipmentItemTypes = await itemTypesRes.json();
        equipmentItems = await itemsRes.json();
    } catch (error) {
        console.error('Error loading warehouse settings data:', error);
    }
}

// Function to populate equipment select dropdown based on selected category, subcategory, and equipment type
function populateEquipmentSelectDropdown(categoryId = null, equipmentTypeName = null, subcategoryId = null) {
    const equipmentSelect = document.getElementById('equipment-select');
    if (!equipmentSelect) return;

    let filteredItems = equipmentItems;

    // Filter by subcategory if selected
    if (subcategoryId) {
        filteredItems = filteredItems.filter(item => item.subcategory_id == subcategoryId);
    } else if (categoryId) {
        filteredItems = filteredItems.filter(item => item.category_id == categoryId);
    }

    // Filter by equipment type name if selected
    if (equipmentTypeName) {
        filteredItems = filteredItems.filter(item => item.type_name == equipmentTypeName);
    }

    equipmentSelect.innerHTML = '<option value="">-- Select Equipment --</option>' +
        filteredItems.map(item => `<option value="${item.id}" data-category-id="${item.category_id}" data-subcategory-id="${item.subcategory_id}" data-type-id="${item.type_id}">${item.product_code || 'No Code'} - ${item.name}</option>`).join('');
}

// Function to handle category change - cascades to equipment type
function onCategoryChange() {
    const categorySelect = document.getElementById('equipment-category-new');
    const selectedCategoryId = categorySelect.value;
    const equipmentTypeSelect = document.getElementById('equipment-type-new');

    // Find a subcategory with "Equipment" in its name (case-insensitive) for the selected category
    const equipmentSubcategory = equipmentItemSubcategories.find(sub => 
        sub.item_category_id == selectedCategoryId && 
        sub.name.toLowerCase().includes('equipment')
    );
    const equipmentSubcategoryId = equipmentSubcategory ? equipmentSubcategory.id : null;

    // Filter equipment types based on selected category and equipment-related subcategory
    if (selectedCategoryId && equipmentSubcategoryId) {
        const itemsInCategoryAndSubcategory = equipmentItems.filter(item => 
            item.category_id == selectedCategoryId && item.subcategory_id == equipmentSubcategoryId
        );
        const uniqueTypes = [...new Set(itemsInCategoryAndSubcategory.map(item => item.type_name).filter(name => name))];
        equipmentTypeSelect.innerHTML = '<option value="">-- Select Equipment Type --</option>' +
            uniqueTypes.map(typeName => `<option value="${typeName}">${typeName}</option>`).join('');
    } else if (selectedCategoryId) {
        // If no equipment subcategory found, show all types in the category
        const itemsInCategory = equipmentItems.filter(item => item.category_id == selectedCategoryId);
        const uniqueTypes = [...new Set(itemsInCategory.map(item => item.type_name).filter(name => name))];
        equipmentTypeSelect.innerHTML = '<option value="">-- Select Equipment Type --</option>' +
            uniqueTypes.map(typeName => `<option value="${typeName}">${typeName}</option>`).join('');
    } else {
        equipmentTypeSelect.innerHTML = '<option value="">-- Select Equipment Type --</option>';
    }

    // Reset equipment select dropdown
    populateEquipmentSelectDropdown(selectedCategoryId, null, equipmentSubcategoryId);
}

// Function to handle equipment type change - cascades to equipment list
function onEquipmentTypeChange() {
    const categorySelect = document.getElementById('equipment-category-new');
    const equipmentTypeSelect = document.getElementById('equipment-type-new');
    const selectedCategoryId = categorySelect.value;
    const selectedEquipmentTypeName = equipmentTypeSelect.value;

    // Find a subcategory with "Equipment" in its name (case-insensitive) for the selected category
    const equipmentSubcategory = equipmentItemSubcategories.find(sub => 
        sub.item_category_id == selectedCategoryId && 
        sub.name.toLowerCase().includes('equipment')
    );
    const equipmentSubcategoryId = equipmentSubcategory ? equipmentSubcategory.id : null;

    // Filter equipment list based on selected category, equipment type name, and equipment-related subcategory
    populateEquipmentSelectDropdown(selectedCategoryId, selectedEquipmentTypeName, equipmentSubcategoryId);
}


function renderEquipment() {
    populateEquipmentHeaderFilters();
    unlockColumnWidths('#equipment-table');
    const tbody = document.getElementById('equipment-table-body');
    if (!tbody) {
        console.error('Equipment table body not found');
        return;
    }
    const total = allEquipment.length;
    tbody.innerHTML = allEquipment.map((eq, index) => {
        const serial = total - index;
        return renderEquipmentRow(eq, serial, total);
    }).join('');
    if (typeof applyEquipmentColumnVisibility === 'function') applyEquipmentColumnVisibility();
    lockColumnWidths('#equipment-table');
    if (typeof applyEquipmentFreeze === 'function') applyEquipmentFreeze();
}

document.addEventListener('click', function(e) {
    const dropdown = document.getElementById('equipment-filter-sublocation-dropdown');
    const btn = document.getElementById('equipment-filter-sublocation-btn');
    if (dropdown && !dropdown.classList.contains('hidden') && btn && !btn.contains(e.target) && !dropdown.contains(e.target)) {
        dropdown.classList.add('hidden');
    }
});
function populateEquipmentSelects() {
    // Populate maintenance equipment select
    const maintenanceSelect = document.getElementById('maintenance-equipment');
    if (maintenanceSelect) {
        maintenanceSelect.innerHTML = '<option value="">Select Equipment</option>' +
            allEquipment.map(eq => `<option value="${eq.id}" data-location-id="${eq.location_id}" data-location-name="${eq.location_name || ''}">${eq.auto_serial_number || 'No Serial'} - ${eq.name}</option>`).join('');
    }

    // Populate maintenance filter equipment dropdown
    const maintenanceFilterSelect = document.getElementById('maintenance-filter-equipment');
    if (maintenanceFilterSelect) {
        maintenanceFilterSelect.innerHTML = '<option value="">All Equipment</option>' +
            allEquipment.map(eq => `<option value="${eq.id}">${eq.auto_serial_number || 'No Serial'} - ${eq.name}</option>`).join('');
    }

    // Populate transfer filter equipment dropdown — only equipment that exists in current transfers
    const transferFilterSelect = document.getElementById('transfer-filter-equipment');
    if (transferFilterSelect) {
        const equipmentInTransfers = allEquipment.filter(eq =>
            allTransfers && allTransfers.some(t => t.equipment_id == eq.id)
        );
        transferFilterSelect.innerHTML = '<option value="">All Equipment</option>' +
            equipmentInTransfers.map(eq => `<option value="${eq.id}">${eq.auto_serial_number || 'No Serial'} - ${eq.name}</option>`).join('');
    }

    // Populate transfer location filter dropdowns
    populateTransferLocationFilters();

    // Populate transfer equipment datalist — only active (non-Written-Off) equipment
    const transferDatalist = document.getElementById('transfer-equipment-list');
    if (transferDatalist) {
        const activeEquipment = allEquipment.filter(eq => eq.status !== 'Written Off');
        transferDatalist.innerHTML = activeEquipment.map(eq => {
            const barcode = (typeof eq.barcode === 'object' || eq.barcode === '[object Object]') ? '' : (eq.barcode || '');
            return `<option value="${eq.auto_serial_number || 'No Serial'} - ${eq.name}" data-id="${eq.id}" data-location-id="${eq.location_id}" data-location-name="${eq.location_name || ''}" data-barcode="${barcode}" data-assigned-to-name="${eq.assigned_to_name || ''}"></option>`;
        }).join('');
    }
}

function populateTransferLocationFilters() {
    if (!allTransfers || !allTransfers.length) return;

    const fromCountries = [...new Set(allTransfers.map(t => t.from_country_name).filter(Boolean))].sort();
    const fromCountrySel = document.getElementById('transfer-filter-from-country');
    if (fromCountrySel) {
        fromCountrySel.innerHTML = '<option value="">From Country</option>' +
            fromCountries.map(c => `<option value="${c}">${c}</option>`).join('');
    }

    const toCountries = [...new Set(allTransfers.map(t => t.to_country_name).filter(Boolean))].sort();
    const toCountrySel = document.getElementById('transfer-filter-to-country');
    if (toCountrySel) {
        toCountrySel.innerHTML = '<option value="">To Country</option>' +
            toCountries.map(c => `<option value="${c}">${c}</option>`).join('');
    }

    const fromLocSel = document.getElementById('transfer-filter-from-location');
    if (fromLocSel) fromLocSel.innerHTML = '<option value="">From Location</option>';
    const fromSubSel = document.getElementById('transfer-filter-from-sublocation');
    if (fromSubSel) fromSubSel.innerHTML = '<option value="">From Sub/Business</option>';
    const toLocSel = document.getElementById('transfer-filter-to-location');
    if (toLocSel) toLocSel.innerHTML = '<option value="">To Location</option>';
    const toSubSel = document.getElementById('transfer-filter-to-sublocation');
    if (toSubSel) toSubSel.innerHTML = '<option value="">To Sub/Business</option>';
}

function onTransferFilterFromCountryChange() {
    const country = document.getElementById('transfer-filter-from-country').value;
    const locSel = document.getElementById('transfer-filter-from-location');
    const subSel = document.getElementById('transfer-filter-from-sublocation');
    if (subSel) subSel.innerHTML = '<option value="">From Sub/Business</option>';
    if (locSel) {
        if (country) {
            const locations = [...new Set(allTransfers.filter(t => t.from_country_name === country).map(t => t.from_location_type_name).filter(Boolean))].sort();
            locSel.innerHTML = '<option value="">From Location</option>' +
                locations.map(l => `<option value="${l}">${l}</option>`).join('');
        } else {
            locSel.innerHTML = '<option value="">From Location</option>';
        }
    }
    filterTransfers();
}

function onTransferFilterFromLocationChange() {
    const country = document.getElementById('transfer-filter-from-country').value;
    const location = document.getElementById('transfer-filter-from-location').value;
    const subSel = document.getElementById('transfer-filter-from-sublocation');
    if (subSel) {
        if (country && location) {
            const subs = [...new Set(allTransfers
                .filter(t => t.from_country_name === country && t.from_location_type_name === location)
                .map(t => [t.from_sub_location_name, t.from_business_type_name].filter(Boolean).join(' - '))
                .filter(Boolean))].sort();
            subSel.innerHTML = '<option value="">From Sub/Business</option>' +
                subs.map(s => `<option value="${s}">${s}</option>`).join('');
        } else {
            subSel.innerHTML = '<option value="">From Sub/Business</option>';
        }
    }
    filterTransfers();
}

function onTransferFilterToCountryChange() {
    const country = document.getElementById('transfer-filter-to-country').value;
    const locSel = document.getElementById('transfer-filter-to-location');
    const subSel = document.getElementById('transfer-filter-to-sublocation');
    if (subSel) subSel.innerHTML = '<option value="">To Sub/Business</option>';
    if (locSel) {
        if (country) {
            const locations = [...new Set(allTransfers.filter(t => t.to_country_name === country).map(t => t.to_location_type_name).filter(Boolean))].sort();
            locSel.innerHTML = '<option value="">To Location</option>' +
                locations.map(l => `<option value="${l}">${l}</option>`).join('');
        } else {
            locSel.innerHTML = '<option value="">To Location</option>';
        }
    }
    filterTransfers();
}

function onTransferFilterToLocationChange() {
    const country = document.getElementById('transfer-filter-to-country').value;
    const location = document.getElementById('transfer-filter-to-location').value;
    const subSel = document.getElementById('transfer-filter-to-sublocation');
    if (subSel) {
        if (country && location) {
            const subs = [...new Set(allTransfers
                .filter(t => t.to_country_name === country && t.to_location_type_name === location)
                .map(t => [t.to_sub_location_name, t.to_business_type_name].filter(Boolean).join(' - '))
                .filter(Boolean))].sort();
            subSel.innerHTML = '<option value="">To Sub/Business</option>' +
                subs.map(s => `<option value="${s}">${s}</option>`).join('');
        } else {
            subSel.innerHTML = '<option value="">To Sub/Business</option>';
        }
    }
    filterTransfers();
}

function setupEquipmentAssignedToDropdown() {
    const searchInput = document.getElementById('equipment-assigned-to-search');
    const hiddenInput = document.getElementById('equipment-assigned-to');
    const dropdown = document.getElementById('equipment-assigned-to-dropdown');
    if (!searchInput || !dropdown) return;

    let allEmps = [];
    loadAllEmployeesForEquipment().then(emps => { allEmps = emps || []; });

    const renderOptions = (filter = '') => {
        const term = filter.toLowerCase();
        const options = allEmps
            .filter(emp => {
                const text = `${emp.first_name || ''} ${emp.last_name || ''} ${emp.employee_id || ''}`.toLowerCase();
                return text.includes(term);
            })
            .slice(0, 50)
            .map(emp => `<div class="px-3 py-2 hover:bg-gray-100 cursor-pointer text-sm" data-id="${emp.id}">${emp.first_name || ''} ${emp.last_name || ''} ${emp.employee_id ? '(' + emp.employee_id + ')' : ''}</div>`)
            .join('');
        dropdown.innerHTML = options || '<div class="px-3 py-2 text-sm text-gray-400">No employees found</div>';
    };

    searchInput.addEventListener('focus', () => {
        renderOptions(searchInput.value);
        dropdown.classList.remove('hidden');
    });

    searchInput.addEventListener('input', () => {
        if (!searchInput.value.trim()) {
            hiddenInput.value = '';
        }
        renderOptions(searchInput.value);
        dropdown.classList.remove('hidden');
    });

    dropdown.addEventListener('click', (e) => {
        const item = e.target.closest('[data-id]');
        if (!item) return;
        hiddenInput.value = item.getAttribute('data-id');
        searchInput.value = item.textContent.split('(')[0].trim();
        dropdown.classList.add('hidden');
    });

    document.addEventListener('click', (e) => {
        if (!searchInput.contains(e.target) && !dropdown.contains(e.target)) {
            dropdown.classList.add('hidden');
        }
    });
}

async function openEquipmentModal(id = null) {
const modal = document.getElementById('equipment-modal');
    const form = document.getElementById('equipment-form');
    const title = document.getElementById('equipment-modal-title');

    form.reset();
    document.getElementById('equipment-id').value = '';
    document.getElementById('equipment-copied-photos').value = '';
    document.getElementById('equipment-assigned-to').value = '';
    document.getElementById('equipment-assigned-to-search').value = '';
    const photosGrid = document.getElementById('equipment-photos-grid');
    if (photosGrid) photosGrid.innerHTML = '';
    const newPhotosPreview = document.getElementById('equipment-new-photos-preview');
    if (newPhotosPreview) newPhotosPreview.innerHTML = '';
    const existingDocs = document.getElementById('equipment-existing-documents');
    if (existingDocs) existingDocs.innerHTML = '';
    const newDocsPreview = document.getElementById('equipment-new-documents-preview');
    if (newDocsPreview) newDocsPreview.innerHTML = '';
    syncDateDisplay('equipment-purchase-date', 'equipment-purchase-date-display');
    syncDateDisplay('equipment-warranty-expiry', 'equipment-warranty-expiry-display');

    // Reset new dropdowns
    document.getElementById('equipment-category-new').value = '';
    document.getElementById('equipment-type-new').value = '';
    document.getElementById('equipment-select').value = '';

    // Load all dropdowns in parallel
    await Promise.all([
        loadEquipmentCatalogForModal(),
        loadBusinessTypeAssignmentsForEquipment(),
        loadSupplierAssignmentsForEquipment(),
        loadEquipmentConditionsForModal(),
        loadEquipmentStatusesForModal(),
        loadEquipmentOwnersForModal(),
        loadWarehouseSettingsForEquipment()
    ]);

    // Populate new dropdowns
    const categoryNewSelect = document.getElementById('equipment-category-new');
    if (categoryNewSelect && equipmentItemCategories.length > 0) {
        // Filter categories to only show those with linked subcategories
        const categoriesWithSubcategories = equipmentItemCategories.filter(category =>
            equipmentItemSubcategories.some(sub => sub.item_category_id == category.id)
        );
        categoryNewSelect.innerHTML = '<option value="">-- Select Category --</option>' +
            categoriesWithSubcategories.map(cat => `<option value="${cat.id}">${cat.name}</option>`).join('');
    }

    const equipmentTypeNewSelect = document.getElementById('equipment-type-new');
    if (equipmentTypeNewSelect) {
        // Initialize as empty - will be populated when category is selected
        equipmentTypeNewSelect.innerHTML = '<option value="">-- Select Equipment Type --</option>';
    }

    // Populate equipment select dropdown
    populateEquipmentSelectDropdown();

    if (id) {
        // Edit mode - fetch and populate existing data
        title.textContent = 'Edit Equipment';
        try {
            const response = await fetch(`${API_BASE}/equipment/${id}`);
            const data = await response.json();
document.getElementById('equipment-id').value = data.id;
            document.getElementById('equipment-select').value = data.catalog_id || '';
            document.getElementById('equipment-brand').value = data.brand || '';
            document.getElementById('equipment-model').value = data.model || '';
            document.getElementById('equipment-serial').value = data.serial_number || '';
            document.getElementById('equipment-specification').value = data.specification || '';

            // Set cascading location dropdowns
            const assignment = window.allBusinessTypeAssignments ? window.allBusinessTypeAssignments.find(a => a.id == data.location_id) : null;
            const countrySelect = document.getElementById('equipment-country');
            const locationTypeSelect = document.getElementById('equipment-location-type');
            const sublocationBusinessTypeSelect = document.getElementById('equipment-sublocation-business-type');
            if (assignment) {
                if (countrySelect) {
                    countrySelect.value = assignment.country_id || '';
                    countrySelect.dispatchEvent(new Event('change'));
                }
                if (locationTypeSelect) {
                    locationTypeSelect.value = assignment.location_id || '';
                    locationTypeSelect.dispatchEvent(new Event('change'));
                }
                if (sublocationBusinessTypeSelect) {
                    sublocationBusinessTypeSelect.value = assignment.id || '';
                    sublocationBusinessTypeSelect.dispatchEvent(new Event('change'));
                }
            } else {
                if (countrySelect) countrySelect.value = '';
                if (locationTypeSelect) locationTypeSelect.value = '';
                if (sublocationBusinessTypeSelect) sublocationBusinessTypeSelect.value = '';
            }
            // Supplier dropdown is populated by the change event above; set saved value afterwards
            setTimeout(() => {
                document.getElementById('equipment-supplier').value = data.supplier_id || '';
            }, 0);
            document.getElementById('equipment-price').value = data.price || '';
            document.getElementById('equipment-other-charges').value = data.other_charges || '';
            document.getElementById('equipment-purchase-cost').value = data.purchase_cost || '';
            setEquipmentDateField('equipment-purchase-date', 'equipment-purchase-date-display', data.purchase_date || '');
            document.getElementById('equipment-purchase-order-number').value = data.purchase_order_number || '';
            setEquipmentDateField('equipment-warranty-expiry', 'equipment-warranty-expiry-display', data.warranty_expiry || '');
            document.getElementById('equipment-condition').value = data.condition_id || '';
            document.getElementById('equipment-status').value = data.status_id || '';
            document.getElementById('equipment-in-service-date').value = data.in_service_date ? data.in_service_date.split('T')[0] : '';
            onEquipmentStatusChange();
            document.getElementById('equipment-owner').value = data.owner_id || '';
            document.getElementById('equipment-preventive-maintenance').value = data.preventive_maintenance_months || '';
            document.getElementById('equipment-comments').value = data.comments || '';
            document.getElementById('equipment-barcode').value = data.barcode || '';
            if (data.assigned_to) {
                document.getElementById('equipment-assigned-to').value = data.assigned_to;
                document.getElementById('equipment-assigned-to-search').value = data.assigned_to_name || '';
            } else {
                document.getElementById('equipment-assigned-to').value = '';
                document.getElementById('equipment-assigned-to-search').value = '';
            }
            loadEquipmentPhotosForModal(id);
            renderExistingDocuments(data.manual_document_path);

            // Populate Category and Equipment Type dropdowns based on selected equipment
            if (data.catalog_id) {
                const selectedItem = equipmentItems.find(item => item.id == data.catalog_id);
                if (selectedItem) {
                    // Set Category dropdown
                    document.getElementById('equipment-category-new').value = selectedItem.category_id || '';
                    // Trigger category change to populate equipment types (hardcoded to "Equipment" subcategory)
                    onCategoryChange();
                    // Set Equipment Type dropdown
                    setTimeout(() => {
                        document.getElementById('equipment-type-new').value = selectedItem.type_name || '';
                        // Populate equipment select dropdown with filtered items using the item's actual subcategory
                        populateEquipmentSelectDropdown(selectedItem.category_id, selectedItem.type_name, selectedItem.subcategory_id);
                        // Set the Select Equipment dropdown value
                        document.getElementById('equipment-select').value = data.catalog_id || '';
                    }, 50);
                }
            }

            // Disable editing if equipment is Written Off
            setEquipmentFormReadOnly(data.status === 'Written Off');
        } catch (error) {
            console.error('Error fetching equipment data:', error);
        }
    } else {
        title.textContent = 'Add Equipment';
        setEquipmentFormReadOnly(false);
    }

    modal.classList.add('active');
    form.scrollTop = 0;
}

function setEquipmentFormReadOnly(readOnly) {
    const form = document.getElementById('equipment-form');
    const warning = document.getElementById('equipment-written-off-warning');
    const saveBtn = document.getElementById('equipment-save-btn');
    if (!form) return;

    const fields = form.querySelectorAll('input, select, textarea');
    fields.forEach(field => {
        if (readOnly) {
            field.setAttribute('disabled', 'disabled');
        } else {
            field.removeAttribute('disabled');
        }
    });

    // Always keep the hidden id and existing-photo fields enabled
    const idField = document.getElementById('equipment-id');
    const existingPhotoField = document.getElementById('equipment-existing-photo');
    if (idField) idField.removeAttribute('disabled');
    if (existingPhotoField) existingPhotoField.removeAttribute('disabled');

    // Disable save button
    if (saveBtn) {
        if (readOnly) {
            saveBtn.setAttribute('disabled', 'disabled');
            saveBtn.classList.add('opacity-50', 'cursor-not-allowed');
        } else {
            saveBtn.removeAttribute('disabled');
            saveBtn.classList.remove('opacity-50', 'cursor-not-allowed');
        }
    }

    // Show/hide warning
    if (warning) {
        if (readOnly) {
            warning.classList.remove('hidden');
        } else {
            warning.classList.add('hidden');
        }
    }
}

async function loadBusinessTypeAssignmentsForEquipment() {
try {
        const [assignmentsRes, countriesRes, locationTypesRes] = await Promise.all([
            fetch(`${API_BASE}/business-type-assignments`),
            fetch(`${API_BASE}/countries`),
            fetch(`${API_BASE}/location-types`)
        ]);
        const assignments = await assignmentsRes.json();
        const countries = await countriesRes.json();
        const locationTypes = await locationTypesRes.json();
window.allBusinessTypeAssignments = assignments;
        window.allCountries = countries;
        window.allLocationTypes = locationTypes;

        const countrySelect = document.getElementById('equipment-country');
        if (countrySelect) {
            countrySelect.innerHTML = '<option value="">Select Country</option>' +
                countries.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
        }

        const locationTypeSelect = document.getElementById('equipment-location-type');
        if (locationTypeSelect) {
            locationTypeSelect.innerHTML = '<option value="">Select Location</option>';
        }

        const sublocationBusinessTypeSelect = document.getElementById('equipment-sublocation-business-type');
        if (sublocationBusinessTypeSelect) {
            sublocationBusinessTypeSelect.innerHTML = '<option value="">Select Sublocation / Business Type</option>';
        }
} catch (error) {
        console.error('Error loading business type assignments:', error);
    }
}

function onEquipmentCountryChange() {
    const countryId = document.getElementById('equipment-country').value;
    const locationTypeSelect = document.getElementById('equipment-location-type');
    const sublocationBusinessTypeSelect = document.getElementById('equipment-sublocation-business-type');

    locationTypeSelect.innerHTML = '<option value="">Select Location</option>';
    sublocationBusinessTypeSelect.innerHTML = '<option value="">Select Sublocation / Business Type</option>';

    if (countryId && window.allLocationTypes) {
        const filtered = window.allLocationTypes.filter(lt => lt.country_id == countryId);
        filtered.forEach(lt => {
            locationTypeSelect.innerHTML += `<option value="${lt.id}">${lt.name}</option>`;
        });
    }
}

function onEquipmentLocationTypeChange() {
    const countryId = document.getElementById('equipment-country').value;
    const locationTypeId = document.getElementById('equipment-location-type').value;
    const sublocationBusinessTypeSelect = document.getElementById('equipment-sublocation-business-type');

    sublocationBusinessTypeSelect.innerHTML = '<option value="">Select Sublocation / Business Type</option>';

    if (countryId && locationTypeId && window.allBusinessTypeAssignments) {
        let filtered = window.allBusinessTypeAssignments.filter(a =>
            a.country_id == countryId && a.location_id == locationTypeId
        );
        filtered.sort((a, b) => {
            const textA = `${a.sub_location_name || ''} - ${a.business_type_name || ''} - ${a.business_unit_code || ''}`;
            const textB = `${b.sub_location_name || ''} - ${b.business_type_name || ''} - ${b.business_unit_code || ''}`;
            return textA.localeCompare(textB);
        });
        filtered.forEach(a => {
            const text = `${a.sub_location_name || ''} - ${a.business_type_name || ''} - ${a.business_unit_code || ''}`;
            sublocationBusinessTypeSelect.innerHTML += `<option value="${a.id}">${text}</option>`;
        });
    }
}

async function loadSupplierAssignmentsForEquipment() {
try {
        const response = await fetch(`${API_BASE}/suppliers/assignments`);
        const assignments = await response.json();
window.allSupplierAssignments = assignments;
    } catch (error) {
        console.error('Error loading supplier assignments:', error);
    }
}

// Generic cascading location helpers (country -> location -> sublocation/business type)
async function ensureCascadingLocationData() {
    if (window.allCountries && window.allLocationTypes && window.allBusinessTypeAssignments) return;
    try {
        const [assignmentsRes, countriesRes, locationTypesRes] = await Promise.all([
            fetch(`${API_BASE}/business-type-assignments`),
            fetch(`${API_BASE}/countries`),
            fetch(`${API_BASE}/location-types`)
        ]);
        window.allBusinessTypeAssignments = await assignmentsRes.json();
        window.allCountries = await countriesRes.json();
        window.allLocationTypes = await locationTypesRes.json();
    } catch (error) {
        console.error('Error loading cascading location data:', error);
    }
}

function formatSublocationOptionText(a) {
    const parts = [a.sub_location_name, a.business_type_name, a.business_unit_code].filter(Boolean);
    return parts.length ? parts.join(' - ') : '';
}

function formatFullLocationString(a) {
    const parts = [a.country_name, a.location_name, a.sub_location_name, a.business_type_name, a.business_unit_code].filter(Boolean);
    return parts.length ? parts.join(' - ') : '';
}

function populateCascadingCountrySelect(selectId) {
    const select = document.getElementById(selectId);
    if (!select) return;
    select.innerHTML = '<option value="">Select Country</option>' +
        (window.allCountries || []).map(c => `<option value="${c.id}">${c.name}</option>`).join('');
}

function onCascadingCountryChange(countrySelectId, locationSelectId, sublocationSelectId) {
    const countryId = document.getElementById(countrySelectId).value;
    const locationSelect = document.getElementById(locationSelectId);
    const sublocationSelect = document.getElementById(sublocationSelectId);
    if (!locationSelect || !sublocationSelect) return;

    locationSelect.innerHTML = '<option value="">Select Location</option>';
    sublocationSelect.innerHTML = '<option value="">Select Sublocation / Business Type</option>';

    if (countryId && window.allLocationTypes) {
        window.allLocationTypes.filter(lt => lt.country_id == countryId).forEach(lt => {
            locationSelect.innerHTML += `<option value="${lt.id}">${lt.name}</option>`;
        });
    }
}

function onCascadingLocationChange(countrySelectId, locationSelectId, sublocationSelectId) {
    const countryId = document.getElementById(countrySelectId).value;
    const locationTypeId = document.getElementById(locationSelectId).value;
    const sublocationSelect = document.getElementById(sublocationSelectId);
    if (!sublocationSelect) return;

    sublocationSelect.innerHTML = '<option value="">Select Sublocation / Business Type</option>';

    if (countryId && locationTypeId && window.allBusinessTypeAssignments) {
        window.allBusinessTypeAssignments.filter(a =>
            a.country_id == countryId && a.location_id == locationTypeId
        ).sort((a, b) => {
            const textA = formatSublocationOptionText(a).toLowerCase();
            const textB = formatSublocationOptionText(b).toLowerCase();
            return textA.localeCompare(textB);
        }).forEach(a => {
            sublocationSelect.innerHTML += `<option value="${a.id}">${formatSublocationOptionText(a)}</option>`;
        });
    }
}

async function setCascadingLocationByAssignment(assignmentId, countrySelectId, locationSelectId, sublocationSelectId) {
    await ensureCascadingLocationData();
    const assignment = window.allBusinessTypeAssignments ? window.allBusinessTypeAssignments.find(a => a.id == assignmentId) : null;
    if (!assignment) return;

    const countrySelect = document.getElementById(countrySelectId);
    const locationSelect = document.getElementById(locationSelectId);
    const sublocationSelect = document.getElementById(sublocationSelectId);

    if (countrySelect) {
        countrySelect.value = assignment.country_id || '';
        countrySelect.dispatchEvent(new Event('change'));
    }
    if (locationSelect) {
        locationSelect.value = assignment.location_id || '';
        locationSelect.dispatchEvent(new Event('change'));
    }
    if (sublocationSelect) {
        sublocationSelect.value = assignment.id || '';
    }
}

async function setCascadingLocationByFullString(locationString, countrySelectId, locationSelectId, sublocationSelectId, hiddenInputId) {
    await ensureCascadingLocationData();
    if (!window.allBusinessTypeAssignments || !locationString) return;
    const assignment = window.allBusinessTypeAssignments.find(a => formatFullLocationString(a) === locationString);
    if (assignment) {
        await setCascadingLocationByAssignment(assignment.id, countrySelectId, locationSelectId, sublocationSelectId);
    }
    if (hiddenInputId) {
        const hidden = document.getElementById(hiddenInputId);
        if (hidden) hidden.value = locationString;
    }
}

async function loadEquipmentCatalogForModal() {
try {
        const response = await fetch(`${API_BASE}/equipment/catalog`);
        if (!response.ok) {
            console.error('Error loading equipment catalog:', response.status, response.statusText);
            return;
        }
        const catalog = await response.json();
window.allEquipmentCatalog = catalog;
        const equipmentSelect = document.getElementById('equipment-select');
        if (equipmentSelect) {
            equipmentSelect.innerHTML = '<option value="">-- Select Equipment --</option>';
            catalog.forEach(eq => {
                equipmentSelect.innerHTML += `<option value="${eq.id}">${eq.name} (${eq.category})</option>`;
            });
} else {
            console.error('Equipment select element not found');
        }
    } catch (error) {
        console.error('Error loading equipment catalog:', error);
    }
}

async function loadEquipmentConditionsForModal() {
try {
        const response = await fetch(`${API_BASE}/equipment/conditions`);
        const conditions = await response.json();
const conditionSelect = document.getElementById('equipment-condition');
        if (conditionSelect) {
            conditionSelect.innerHTML = '<option value="">Select Condition</option>';
            conditions.forEach(cond => {
                conditionSelect.innerHTML += `<option value="${cond.id}">${cond.name}</option>`;
            });
} else {
            console.error('Condition select element not found');
        }
    } catch (error) {
        console.error('Error loading equipment conditions:', error);
    }
}

async function loadEquipmentStatusesForModal() {
try {
        const response = await fetch(`${API_BASE}/equipment/statuses`);
        const statuses = await response.json();
const statusSelect = document.getElementById('equipment-status');
        if (statusSelect) {
            statusSelect.innerHTML = '<option value="">Select Status</option>';
            statuses.forEach(st => {
                statusSelect.innerHTML += `<option value="${st.id}">${st.name}</option>`;
            });
} else {
            console.error('Status select element not found');
        }
    } catch (error) {
        console.error('Error loading equipment statuses:', error);
    }
}

async function loadEquipmentOwnersForModal() {
try {
        const response = await fetch(`${API_BASE}/equipment/owners`);
        const owners = await response.json();
window.allEquipmentOwners = owners;
        const ownerSelect = document.getElementById('equipment-owner');
        if (ownerSelect) {
            ownerSelect.innerHTML = '<option value="">Select Owner</option>';
            owners.forEach(owner => {
                ownerSelect.innerHTML += `<option value="${owner.id}">${owner.name}</option>`;
            });
} else {
            console.error('Owner select element not found');
        }
    } catch (error) {
        console.error('Error loading equipment owners:', error);
    }
}

function closeEquipmentModal() {
    document.getElementById('equipment-modal').classList.remove('active');
    setEquipmentFormReadOnly(false);
}

function removeEquipmentPhoto() {
    document.getElementById('equipment-existing-photo').value = '';
    document.getElementById('equipment-photo-preview').innerHTML = '';
    document.getElementById('equipment-photo').value = '';
}

async function loadEquipmentPhotosForModal(equipmentId) {
    const grid = document.getElementById('equipment-photos-grid');
    if (!grid) return;
    try {
        const res = await fetch(`${API_BASE}/equipment/${equipmentId}/photos`);
        const photos = res.ok ? await res.json() : [];
        grid.innerHTML = photos.map(p => `
            <div class="relative group" data-photo-id="${p.id}">
                <img src="${p.photo_path}" class="w-20 h-20 object-contain rounded border bg-gray-50">
                <button type="button" onclick="deleteEquipmentPhotoFromModal(${equipmentId}, ${p.id}, this)"
                    class="absolute top-0 right-0 hidden group-hover:flex items-center justify-center w-5 h-5 bg-red-600 text-white rounded-full text-xs hover:bg-red-700">
                    <i class="fas fa-times"></i>
                </button>
            </div>`).join('');
    } catch (e) {
        grid.innerHTML = '';
    }
}

async function deleteEquipmentPhotoFromModal(equipmentId, photoId, btn) {
    if (!confirm('Remove this photo?')) return;
    const res = await fetch(`${API_BASE}/equipment/${equipmentId}/photos/${photoId}`, { method: 'DELETE' });
    if (res.ok) {
        btn.closest('[data-photo-id]').remove();
    }
}

async function deleteEquipmentPhoto(equipmentId, photoId, btn) {
    if (!confirm('Remove this photo?')) return;
    const res = await fetch(`${API_BASE}/equipment/${equipmentId}/photos/${photoId}`, { method: 'DELETE' });
    if (res.ok) {
        btn.closest('.relative').remove();
    }
}

function previewNewEquipmentPhotos(input) {
    const container = document.getElementById('equipment-new-photos-preview');
    if (!container) return;
    container.innerHTML = '';
    Array.from(input.files).forEach((file, i) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const div = document.createElement('div');
            div.className = 'relative group';
            div.innerHTML = `
                <img src="${e.target.result}" class="w-20 h-20 object-contain rounded border bg-gray-50">
                <button type="button" onclick="removeNewPhotoPreview(this, ${i})"
                    class="absolute top-0 right-0 hidden group-hover:flex items-center justify-center w-5 h-5 bg-red-600 text-white rounded-full text-xs hover:bg-red-700">
                    <i class="fas fa-times"></i>
                </button>`;
            container.appendChild(div);
        };
        reader.readAsDataURL(file);
    });
}

function removeNewPhotoPreview(btn) {
    btn.closest('.relative').remove();
}

function renderCopiedPhotos(photoPaths) {
    const grid = document.getElementById('equipment-photos-grid');
    const copiedPhotosField = document.getElementById('equipment-copied-photos');
    if (!copiedPhotosField) return;
    copiedPhotosField.value = JSON.stringify(photoPaths || []);
    if (!grid) return;
    if (!photoPaths || photoPaths.length === 0) {
        grid.innerHTML = '';
        return;
    }
    grid.innerHTML = photoPaths.map(p => `
        <div class="relative group" data-copied-path="${p}">
            <img src="${p}" class="w-20 h-20 object-contain rounded border bg-gray-50">
            <span class="absolute bottom-0 left-0 right-0 bg-teal-500 text-white text-[8px] text-center py-0.5">copied</span>
            <button type="button" onclick="removeCopiedPhoto('${encodeURIComponent(p)}')"
                class="absolute top-0 right-0 hidden group-hover:flex items-center justify-center w-5 h-5 bg-red-600 text-white rounded-full text-xs hover:bg-red-700">
                <i class="fas fa-times"></i>
            </button>
        </div>
    `).join('');
}

function removeCopiedPhoto(encodedPath) {
    if (!confirm('Remove this copied photo?')) return;
    const path = decodeURIComponent(encodedPath);
    const field = document.getElementById('equipment-copied-photos');
    if (!field || !field.value) return;
    try {
        const paths = JSON.parse(field.value);
        const updated = paths.filter(p => p !== path);
        renderCopiedPhotos(updated);
    } catch (e) { console.error('Error removing copied photo:', e); }
}

function previewNewEquipmentDocuments(input) {
    const container = document.getElementById('equipment-new-documents-preview');
    if (!container) return;
    container.innerHTML = '';
    Array.from(input.files).forEach((file, i) => {
        const div = document.createElement('div');
        div.className = 'relative group flex items-center gap-1 px-2 py-1 bg-gray-100 rounded border text-xs';
        div.innerHTML = `
            <i class="fas fa-file text-gray-500"></i>
            <span class="truncate max-w-[120px]">${file.name}</span>
            <button type="button" onclick="removeNewDocumentPreview(this, ${i})"
                class="text-red-600 hover:text-red-800 ml-1">
                <i class="fas fa-times"></i>
            </button>`;
        container.appendChild(div);
    });
}

function removeNewDocumentPreview(btn) {
    btn.closest('.relative').remove();
}

function renderExistingDocuments(docPath) {
    const container = document.getElementById('equipment-existing-documents');
    if (!container) return;
    container.innerHTML = '';
    if (!docPath) return;
    const paths = docPath.split(',').filter(p => p.trim());
    paths.forEach(p => {
        const filename = p.split('/').pop();
        const div = document.createElement('div');
        div.className = 'relative group flex items-center gap-1 px-2 py-1 bg-blue-50 rounded border text-xs';
        div.innerHTML = `
            <i class="fas fa-file text-blue-500"></i>
            <a href="${p.trim()}" target="_blank" class="text-blue-600 hover:underline truncate max-w-[120px]">${filename}</a>`;
        container.appendChild(div);
    });
}

function openPhotoLightbox(src, photos) {
    let lb = document.getElementById('photo-lightbox');
    if (!lb) {
        lb = document.createElement('div');
        lb.id = 'photo-lightbox';
        lb.className = 'fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-[9999]';
        document.body.appendChild(lb);
    }

    const photoList = (photos && photos.length > 0) ? photos : [src];
    let currentIndex = Math.max(0, photoList.indexOf(src));

    function render() {
        lb.innerHTML = `
            <div class="relative flex items-center justify-center w-full h-full">
                <div id="lightbox-spinner" class="absolute inset-0 flex items-center justify-center"><div class="animate-spin rounded-full h-10 w-10 border-4 border-white border-opacity-30 border-t-white"></div></div>
                <img src="${photoList[currentIndex]}" class="max-w-[90vw] max-h-[90vh] object-contain rounded shadow-2xl" style="visibility:hidden">
                ${photoList.length > 1 ? `
                    <button id="lightbox-prev" class="absolute left-4 top-1/2 -translate-y-1/2 bg-white bg-opacity-20 hover:bg-opacity-40 text-white rounded-full w-12 h-12 flex items-center justify-center text-2xl transition">&lsaquo;</button>
                    <button id="lightbox-next" class="absolute right-4 top-1/2 -translate-y-1/2 bg-white bg-opacity-20 hover:bg-opacity-40 text-white rounded-full w-12 h-12 flex items-center justify-center text-2xl transition">&rsaquo;</button>
                    <div class="absolute bottom-4 left-1/2 -translate-x-1/2 text-white text-sm bg-black bg-opacity-50 px-3 py-1 rounded-full">${currentIndex + 1} / ${photoList.length}</div>
                ` : ''}
                <button id="lightbox-close" class="absolute top-4 right-4 bg-white bg-opacity-20 hover:bg-opacity-40 text-white rounded-full w-10 h-10 flex items-center justify-center text-xl transition">&times;</button>
            </div>
        `;
        const lbImg = lb.querySelector('img');
        const lbSpinner = document.getElementById('lightbox-spinner');
        const showImg = () => { lbImg.style.visibility = 'visible'; if (lbSpinner) lbSpinner.style.display = 'none'; };
        lbImg.onload = showImg;
        lbImg.onerror = () => { if (lbSpinner) lbSpinner.innerHTML = '<span class="text-gray-300 text-sm">Could not load image</span>'; };
        if (lbImg.complete && lbImg.naturalWidth > 0) showImg();
        const prevBtn = document.getElementById('lightbox-prev');
        const nextBtn = document.getElementById('lightbox-next');
        const closeBtn = document.getElementById('lightbox-close');
        if (prevBtn) prevBtn.onclick = (e) => { e.stopPropagation(); currentIndex = (currentIndex - 1 + photoList.length) % photoList.length; render(); };
        if (nextBtn) nextBtn.onclick = (e) => { e.stopPropagation(); currentIndex = (currentIndex + 1) % photoList.length; render(); };
        if (closeBtn) closeBtn.onclick = (e) => { e.stopPropagation(); lb.remove(); };
        lb.onclick = (e) => { if (e.target !== lb.querySelector('img')) lb.remove(); };
    }

    render();
}

async function openEquipmentPhotoLightbox(equipmentId, thumbnailSrc) {
    try {
        const response = await fetch(`${API_BASE}/equipment/${equipmentId}/photos`);
        const photos = response.ok ? await response.json() : [];
        const photoPaths = photos.map(p => p.photo_path);
        if (photoPaths.length === 0 && thumbnailSrc) {
            photoPaths.push(thumbnailSrc);
        }
        openPhotoLightbox(thumbnailSrc || photoPaths[0], photoPaths);
    } catch (e) {
        if (thumbnailSrc) openPhotoLightbox(thumbnailSrc);
    }
}

function calculatePurchaseCost() {
    const price = parseFloat(document.getElementById('equipment-price').value) || 0;
    const otherCharges = parseFloat(document.getElementById('equipment-other-charges').value) || 0;
    const purchaseCost = price + otherCharges;
    document.getElementById('equipment-purchase-cost').value = purchaseCost.toFixed(2);
}

function onEquipmentStatusChange() {
    const statusSelect = document.getElementById('equipment-status');
    const statusText = statusSelect.selectedOptions[0]?.text || '';
    const inServiceDateInput = document.getElementById('equipment-in-service-date');
    const isInService = statusText.toLowerCase() === 'in service';
    inServiceDateInput.disabled = !isInService;
    inServiceDateInput.required = isInService;
    if (!isInService) {
        inServiceDateInput.value = '';
    }
    if (isInService) {
        inServiceDateInput.classList.remove('bg-gray-100');
        inServiceDateInput.classList.add('bg-white');
    } else {
        inServiceDateInput.classList.remove('bg-white');
        inServiceDateInput.classList.add('bg-gray-100');
    }
}

function onEquipmentSelect() {
    const catalogId = document.getElementById('equipment-select').value;
    if (catalogId) {
        const item = equipmentItems.find(i => i.id == catalogId);
        if (item) {
}
    }
}

function onEquipmentSublocationBusinessTypeChange() {
    const locationId = document.getElementById('equipment-sublocation-business-type').value;
    const supplierSelect = document.getElementById('equipment-supplier');
    supplierSelect.innerHTML = '<option value="">Select Supplier</option>';

    if (locationId && window.allSupplierAssignments) {
        // Filter suppliers by location using supplier assignments
        const assignedSuppliers = window.allSupplierAssignments.filter(a => a.business_type_assignment_id == locationId);
        assignedSuppliers.forEach(sup => {
            supplierSelect.innerHTML += `<option value="${sup.supplier_id}">${sup.supplier_name}</option>`;
        });
}
}

async function saveEquipment(e) {
    e.preventDefault();
const id = document.getElementById('equipment-id').value;
    const statusField = document.getElementById('equipment-status');
    const statusText = statusField.selectedOptions[0]?.text || '';
    if (id && statusText === 'Written Off') {
        alert('This equipment is Written Off. Editing is not allowed.');
        return;
    }
    const formData = new FormData();
    const catalogSelect = document.getElementById('equipment-select').value;

    if (!catalogSelect) {
        alert('Please select an equipment');
        return;
    }

    const locationId = document.getElementById('equipment-sublocation-business-type').value;
    const supplierId = document.getElementById('equipment-supplier').value;
    const conditionSelect = document.getElementById('equipment-condition');
    const conditionId = conditionSelect.value;
    const conditionText = conditionSelect.selectedOptions[0]?.text || '';
    const statusId = statusField.value;
    const ownerId = document.getElementById('equipment-owner').value;

    if (!locationId) {
        alert('Please select a location');
        return;
    }
    if (!supplierId) {
        alert('Please select a supplier');
        return;
    }
    if (!conditionId) {
        alert('Please select a condition');
        return;
    }
    if (!statusId) {
        alert('Please select a status');
        return;
    }
    if (!ownerId) {
        alert('Please select an owner');
        return;
    }

    // Get the selected item from Items List to get its name and category
    const selectedItem = equipmentItems.find(item => item.id == catalogSelect);
    const equipmentName = selectedItem ? selectedItem.name : '';

    const barcodeValue = document.getElementById('equipment-barcode').value;
    const cleanBarcode = (typeof barcodeValue === 'object') ? '' : String(barcodeValue || '').replace(/\[object Object\]/g, '').trim();

    const brand = document.getElementById('equipment-brand').value;
    const model = document.getElementById('equipment-model').value;
    const serial = document.getElementById('equipment-serial').value;
    const specification = document.getElementById('equipment-specification').value;
    const price = document.getElementById('equipment-price').value;
    const otherCharges = document.getElementById('equipment-other-charges').value;
    const purchaseCost = document.getElementById('equipment-purchase-cost').value;
    const purchaseDate = document.getElementById('equipment-purchase-date').value;
    const purchaseOrderNumber = document.getElementById('equipment-purchase-order-number').value;
    const warrantyExpiry = document.getElementById('equipment-warranty-expiry').value;
    const comments = document.getElementById('equipment-comments').value;
    const inServiceDate = document.getElementById('equipment-in-service-date').value;
    const locationName = document.getElementById('equipment-sublocation-business-type').options[document.getElementById('equipment-sublocation-business-type').selectedIndex]?.text || locationId;
    const ownerName = document.getElementById('equipment-owner').options[document.getElementById('equipment-owner').selectedIndex]?.text || ownerId;

    formData.append('catalog_id', catalogSelect);
    formData.append('name', equipmentName);
    formData.append('category', selectedItem ? selectedItem.category_name : '');
    formData.append('brand', brand);
    formData.append('model', model);
    formData.append('serial_number', serial);
    formData.append('barcode', cleanBarcode);
    formData.append('specification', specification);
    formData.append('location_id', locationId);
    formData.append('supplier_id', supplierId);
    formData.append('price', price);
    formData.append('other_charges', otherCharges);
    formData.append('purchase_cost', purchaseCost);
    formData.append('purchase_date', purchaseDate);
    formData.append('purchase_order_number', purchaseOrderNumber);
    formData.append('warranty_expiry', warrantyExpiry);
    formData.append('condition_id', conditionId);
    formData.append('condition', conditionText);
    formData.append('status_id', statusId);
    formData.append('status', statusText);
    formData.append('in_service_date', inServiceDate);
    formData.append('owner_id', ownerId);
    formData.append('preventive_maintenance_months', document.getElementById('equipment-preventive-maintenance').value || '');
    formData.append('comments', comments);
    formData.append('assigned_to', document.getElementById('equipment-assigned-to').value || '');

    const documentInput = document.getElementById('equipment-document');
    if (documentInput.files.length > 0) {
        Array.from(documentInput.files).forEach(f => formData.append('document', f));
    }
    const existingDocsContainer = document.getElementById('equipment-existing-documents');
    if (existingDocsContainer) {
        const existingLinks = Array.from(existingDocsContainer.querySelectorAll('a')).map(a => a.getAttribute('href'));
        if (existingLinks.length > 0) {
            formData.append('existing_document', existingLinks.join(','));
        }
    }

    try {
        const url = id ? `${API_BASE}/equipment/${id}?manager_id=${currentModuleManager ? currentModuleManager.id : ''}` : `${API_BASE}/equipment`;
        const method = id ? 'PUT' : 'POST';
const response = await fetch(url, {
            method: method,
            body: formData
        });
if (response.ok) {
            const action = id ? 'UPDATE' : 'CREATE';
            const result = await response.json();

            const newAssignedTo = document.getElementById('equipment-assigned-to').value || '';
            const newAssignedToName = document.getElementById('equipment-assigned-to-search').value || '';
            const newPM = document.getElementById('equipment-preventive-maintenance').value || '';
            const supplierName = document.getElementById('equipment-supplier').options[document.getElementById('equipment-supplier').selectedIndex]?.text || '';
            const subLocationName = document.getElementById('equipment-sublocation-business-type').options[document.getElementById('equipment-sublocation-business-type').selectedIndex]?.text || '';

            let details = `Equipment: ${equipmentName}`;

            if (id) {
                // UPDATE — context snapshot + change list
                const oldEq = allEquipment.find(e => e.id == id);
                if (oldEq) {
                    if (oldEq.auto_serial_number) details += ` | Auto Serial: ${oldEq.auto_serial_number}`;
                    if (oldEq.serial_number) details += ` | Serial: ${oldEq.serial_number}`;
                    const barcodeVal = (typeof oldEq.barcode === 'object' || oldEq.barcode === '[object Object]') ? null : oldEq.barcode;
                    if (barcodeVal) details += ` | Barcode: ${barcodeVal}`;
                    if (oldEq.brand || oldEq.model) details += ` | Model: ${[oldEq.brand, oldEq.model].filter(Boolean).join(' ')}`;
                    if (oldEq.location_name) details += ` | Location: ${oldEq.location_name}`;
                    const sublocParts = [oldEq.sub_location_name, oldEq.business_type_name].filter(Boolean);
                    if (sublocParts.length) details += ` | Sublocation: ${sublocParts.join(' - ')}`;
                    if (oldEq.status) details += ` | Status: ${oldEq.status}`;
                    if (oldEq.condition) details += ` | Condition: ${oldEq.condition}`;
                    if (oldEq.owner_name) details += ` | Owner: ${oldEq.owner_name}`;
                    if (oldEq.assigned_to_name) details += ` | Assigned To: ${oldEq.assigned_to_name}`;
                }
                const changes = [];
                if (oldEq) {
                    if (String(oldEq.catalog_id || oldEq.item_id || '') !== String(catalogSelect)) changes.push(`Item: ${oldEq.name || '-'} → ${equipmentName || '-'}`);
                    if (oldEq.brand !== brand) changes.push(`Brand: ${oldEq.brand || '-'} → ${brand || '-'}`);
                    if (oldEq.model !== model) changes.push(`Model: ${oldEq.model || '-'} → ${model || '-'}`);
                    if (oldEq.serial_number !== serial) changes.push(`Serial: ${oldEq.serial_number || '-'} → ${serial || '-'}`);
                    const oldBarcode = (typeof oldEq.barcode === 'object' || oldEq.barcode === '[object Object]') ? '' : String(oldEq.barcode || '').trim();
                    if (oldBarcode !== cleanBarcode) changes.push(`Barcode: ${oldBarcode || '-'} → ${cleanBarcode || '-'}`);
                    if (oldEq.specification !== specification) changes.push(`Specification: ${oldEq.specification || '-'} → ${specification || '-'}`);
                    if (String(oldEq.location_id) !== String(locationId)) changes.push(`Location/Sublocation: ${[oldEq.sub_location_name, oldEq.business_type_name].filter(Boolean).join(' - ') || oldEq.location_name || '-'} → ${subLocationName || '-'}`);
                    if (String(oldEq.condition_id || '') !== String(conditionId || '')) changes.push(`Condition: ${oldEq.condition || '-'} → ${conditionText || '-'}`);
                    if (String(oldEq.status_id || '') !== String(statusId || '')) changes.push(`Status: ${oldEq.status || '-'} → ${statusText || '-'}`);
                    if (String(oldEq.owner_id) !== String(ownerId)) changes.push(`Owner: ${oldEq.owner_name || '-'} → ${ownerName || '-'}`);
                    if (String(oldEq.assigned_to || '') !== String(newAssignedTo)) changes.push(`Assigned To: ${oldEq.assigned_to_name || '-'} → ${newAssignedToName || '-'}`);
                    if (String(oldEq.supplier_id || '') !== String(supplierId || '')) changes.push(`Supplier: ${oldEq.supplier_name || '-'} → ${supplierName || '-'}`);
                    if (String(oldEq.price || '') !== String(price || '')) changes.push(`Price: ${oldEq.price || '-'} → ${price || '-'}`);
                    if (String(oldEq.other_charges || '') !== String(otherCharges || '')) changes.push(`Other Charges: ${oldEq.other_charges || '-'} → ${otherCharges || '-'}`);
                    if (String(oldEq.purchase_cost || '') !== String(purchaseCost || '')) changes.push(`Purchase Cost: ${oldEq.purchase_cost || '-'} → ${purchaseCost || '-'}`);
                    if (String(oldEq.purchase_date || '') !== String(purchaseDate || '')) changes.push(`Purchase Date: ${oldEq.purchase_date || '-'} → ${purchaseDate || '-'}`);
                    if (String(oldEq.purchase_order_number || '') !== String(purchaseOrderNumber || '')) changes.push(`PO Number: ${oldEq.purchase_order_number || '-'} → ${purchaseOrderNumber || '-'}`);
                    if (String(oldEq.warranty_expiry || '') !== String(warrantyExpiry || '')) changes.push(`Warranty Expiry: ${oldEq.warranty_expiry || '-'} → ${warrantyExpiry || '-'}`);
                    if (String(oldEq.in_service_date || '') !== String(inServiceDate || '')) changes.push(`In Service Date: ${oldEq.in_service_date || '-'} → ${inServiceDate || '-'}`);
                    if (String(oldEq.preventive_maintenance_months || '') !== String(newPM)) changes.push(`PM Schedule: ${oldEq.preventive_maintenance_months || '-'} → ${newPM || '-'}`);
                    if (String(oldEq.comments || '') !== String(comments || '')) changes.push(`Comments: ${oldEq.comments || '-'} → ${comments || '-'}`);
                }
                details += changes.length > 0 ? ` | Changes: ${changes.join(', ')}` : ' | No changes detected';
            } else {
                // CREATE — full snapshot of all entered values
                if (result.auto_serial_number) details += ` | Auto Serial: ${result.auto_serial_number}`;
                if (serial) details += ` | Serial: ${serial}`;
                if (cleanBarcode) details += ` | Barcode: ${cleanBarcode}`;
                if (brand || model) details += ` | Model: ${[brand, model].filter(Boolean).join(' ')}`;
                if (specification) details += ` | Specification: ${specification}`;
                if (subLocationName) details += ` | Location: ${subLocationName}`;
                if (conditionText) details += ` | Condition: ${conditionText}`;
                if (statusText) details += ` | Status: ${statusText}`;
                if (ownerName) details += ` | Owner: ${ownerName}`;
                if (newAssignedToName) details += ` | Assigned To: ${newAssignedToName}`;
                if (supplierName) details += ` | Supplier: ${supplierName}`;
                if (purchaseCost) details += ` | Purchase Cost: ${purchaseCost}`;
                if (purchaseDate) details += ` | Purchase Date: ${purchaseDate}`;
                if (purchaseOrderNumber) details += ` | PO Number: ${purchaseOrderNumber}`;
                if (warrantyExpiry) details += ` | Warranty Expiry: ${warrantyExpiry}`;
                if (inServiceDate) details += ` | In Service Date: ${inServiceDate}`;
                if (newPM) details += ` | PM Schedule: ${newPM} months`;
                if (comments) details += ` | Comments: ${comments}`;
            }

            const savedId = id || result.id;
            const photoInput = document.getElementById('equipment-photo');
            const hasPhotos = photoInput && photoInput.files.length > 0;
            const hasDoc = documentInput && documentInput.files.length > 0;
            if (hasPhotos) {
                const photoFormData = new FormData();
                Array.from(photoInput.files).forEach(f => photoFormData.append('photos', f));
                await fetch(`${API_BASE}/equipment/${savedId}/photos`, { method: 'POST', body: photoFormData });
                details += ` | Photos Added: ${photoInput.files.length}`;
            }
            // Link copied photos (files already exist on disk)
            const copiedPhotosField = document.getElementById('equipment-copied-photos');
            if (copiedPhotosField && copiedPhotosField.value) {
                try {
                    const copiedPaths = JSON.parse(copiedPhotosField.value);
                    if (copiedPaths.length > 0) {
                        await fetch(`${API_BASE}/equipment/${savedId}/link-photos`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ photo_paths: copiedPaths })
                        });
                        details += ` | Photos Copied: ${copiedPaths.length}`;
                    }
                } catch (e) { console.error('Error linking copied photos:', e); }
            }
            if (hasDoc) details += ` | Documents Uploaded: ${Array.from(documentInput.files).map(f => f.name).join(', ')}`;
            await logAudit(action, 'equipment', 'Equipment', savedId, details);
            closeEquipmentModal();
            await loadEquipment();
// Preserve existing header filter selections but add the saved item's values
            // so it passes the filters and appears in the filtered list
            const savedEq = allEquipment.find(e => e.id == savedId);
            if (savedEq) {
                EQUIPMENT_HEADER_FILTER_COLS.forEach(col => {
                    if (equipmentHeaderFilterState[col]) {
                        const val = getEquipmentColumnValue(savedEq, col);
                        equipmentHeaderFilterState[col].selected.add(val);
                        renderEquipmentHeaderFilterCheckboxes(col);
                        updateEquipmentHeaderFilterIcon(col);
                    }
                });
            }
            filterEquipment();
loadDashboardStats();
} else {
            const error = await response.json();
            console.error('Error saving equipment:', error);
            alert('Error saving equipment: ' + (error.error || 'Unknown error'));
        }
    } catch (error) {
        console.error('Error saving equipment:', error);
        alert('Error saving equipment: ' + error.message);
    }
}

async function deleteEquipment(id) {
    if (!currentModuleManager) {
        alert('Please select a module manager.');
        return;
    }
    const eq = allEquipment.find(e => e.id === id);
    if (confirm('Are you sure you want to delete this equipment?')) {
        try {
            const response = await fetch(`${API_BASE}/equipment/${id}?manager_id=${currentModuleManager.id}`, { method: 'DELETE' });
            if (response.ok) {
                const parts = [];
                if (eq?.auto_serial_number) parts.push(`Auto Serial: ${eq.auto_serial_number}`);
                if (eq?.serial_number) parts.push(`Serial: ${eq.serial_number}`);
                if (eq?.location_name) parts.push(`Location: ${eq.location_name}`);
                if (eq?.status) parts.push(`Status: ${eq.status}`);
                if (eq?.condition) parts.push(`Condition: ${eq.condition}`);
                if (eq?.category) parts.push(`Category: ${eq.category}`);
                if (eq?.brand) parts.push(`Brand: ${eq.brand}`);
                if (eq?.model) parts.push(`Model: ${eq.model}`);

                const details = `Deleted equipment: ${eq?.name || 'Unknown'}${parts.length > 0 ? ' (' + parts.join(', ') + ')' : ''}`;

                await logAudit('DELETE', 'equipment', 'Equipment', id, details);
                loadEquipment();
                loadDashboardStats();
            } else {
                const error = await response.json().catch(() => ({ error: 'Unknown error' }));
                alert('Error deleting equipment: ' + (error.error || response.statusText));
            }
        } catch (error) {
            console.error('Error deleting equipment:', error);
        }
    }
}

function editEquipment(id) {
    openEquipmentModal(id);
}

async function copyEquipment(id) {
    // Remove any existing copy modal
    const existing = document.getElementById('copy-equipment-modal');
    if (existing) existing.remove();

    // Build modal
    const modal = document.createElement('div');
    modal.id = 'copy-equipment-modal';
    modal.className = 'fixed inset-0 flex items-center justify-center bg-black bg-opacity-50';
    modal.style.zIndex = '99999';
    modal.innerHTML = `
        <div class="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
            <div class="px-6 py-4 border-b border-gray-200">
                <h3 class="text-lg font-semibold text-gray-800">Copy Equipment</h3>
            </div>
            <div class="px-6 py-4 space-y-4">
                <div class="flex flex-col gap-3">
                    <label class="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                        <input type="radio" name="copy-type" value="single" checked class="copy-type-radio">
                        <div>
                            <div class="font-medium text-gray-700">Single Copy</div>
                            <div class="text-sm text-gray-500">Opens the form to edit details before saving</div>
                        </div>
                    </label>
                    <label class="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                        <input type="radio" name="copy-type" value="bulk" class="copy-type-radio">
                        <div>
                            <div class="font-medium text-gray-700">Bulk Copy</div>
                            <div class="text-sm text-gray-500">Creates multiple copies with same details (blank serial/barcode)</div>
                        </div>
                    </label>
                </div>
                <div id="bulk-copy-count-wrap" class="hidden">
                    <label class="block text-sm font-medium text-gray-700 mb-1">Number of copies <span class="text-gray-400">(max 500)</span></label>
                    <input type="number" id="bulk-copy-count" min="1" max="500" value="1" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
                </div>
            </div>
            <div class="px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
                <button id="copy-modal-cancel" class="px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50">Cancel</button>
                <button id="copy-modal-proceed" class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">Proceed</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);

    // Toggle bulk count visibility
    const radios = modal.querySelectorAll('.copy-type-radio');
    const bulkWrap = modal.querySelector('#bulk-copy-count-wrap');
    radios.forEach(r => r.addEventListener('change', () => {
        bulkWrap.classList.toggle('hidden', r.value === 'bulk' && !r.checked || r.value !== 'bulk');
        if (r.value === 'bulk' && r.checked) bulkWrap.classList.remove('hidden');
        if (r.value === 'single' && r.checked) bulkWrap.classList.add('hidden');
    }));

    // Cancel button
    modal.querySelector('#copy-modal-cancel').addEventListener('click', () => modal.remove());

    // Click outside to close
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });

    // Proceed button
    modal.querySelector('#copy-modal-proceed').addEventListener('click', async () => {
        const selected = modal.querySelector('input[name="copy-type"]:checked').value;
        const bulkCountInput = modal.querySelector('#bulk-copy-count');
        const count = bulkCountInput ? parseInt(bulkCountInput.value, 10) : 1;
        modal.remove();

        if (selected === 'single') {
            // Normal single copy flow
            await openEquipmentModal(null);
            try {
                const response = await fetch(`${API_BASE}/equipment/${id}`);
                const data = await response.json();

                // Update title
                const title = document.getElementById('equipment-modal-title');
                if (title) title.textContent = 'Add Equipment (Copied)';

                // Pre-fill only: category, equipment type, equipment name, brand, model, specification
                if (data.catalog_id) {
                    const selectedItem = equipmentItems.find(item => item.id == data.catalog_id);
                    if (selectedItem) {
                        // Set Category dropdown
                        const categorySelect = document.getElementById('equipment-category-new');
                        if (categorySelect) {
                            categorySelect.value = selectedItem.category_id || '';
                            categorySelect.dispatchEvent(new Event('change'));
                        }
                        // Set Equipment Type dropdown (populated by category change event)
                        setTimeout(() => {
                            const typeSelect = document.getElementById('equipment-type-new');
                            if (typeSelect) {
                                typeSelect.value = selectedItem.type_name || '';
                                typeSelect.dispatchEvent(new Event('change'));
                            }
                            // Set Equipment select dropdown (populated by type change event)
                            setTimeout(() => {
                                const eqSelect = document.getElementById('equipment-select');
                                if (eqSelect) eqSelect.value = data.catalog_id || '';
                            }, 0);
                        }, 0);
                    }
                }

                // Set brand, model, specification
                document.getElementById('equipment-brand').value = data.brand || '';
                document.getElementById('equipment-model').value = data.model || '';
                document.getElementById('equipment-specification').value = data.specification || '';

                // Clear serial number and barcode so user enters new ones
                document.getElementById('equipment-serial').value = '';
                document.getElementById('equipment-barcode').value = '';

                // Clear location, supplier, assigned-to, and other fields that should be unique per equipment
                const countrySelect = document.getElementById('equipment-country');
                const locationTypeSelect = document.getElementById('equipment-location-type');
                const sublocationBusinessTypeSelect = document.getElementById('equipment-sublocation-business-type');
                if (countrySelect) countrySelect.value = '';
                if (locationTypeSelect) locationTypeSelect.value = '';
                if (sublocationBusinessTypeSelect) sublocationBusinessTypeSelect.value = '';
                document.getElementById('equipment-assigned-to').value = '';
                document.getElementById('equipment-assigned-to-search').value = '';

                // Copy photos from source equipment (files already exist on disk via dedup)
                const copiedPhotosField = document.getElementById('equipment-copied-photos');
                const photosGrid = document.getElementById('equipment-photos-grid');
                if (photosGrid) photosGrid.innerHTML = '';
                const newPhotosPreview = document.getElementById('equipment-new-photos-preview');
                if (newPhotosPreview) newPhotosPreview.innerHTML = '';

                // Fetch source equipment's photos
                const photosRes = await fetch(`${API_BASE}/equipment/${id}/photos`);
                const photos = photosRes.ok ? await photosRes.json() : [];
                const legacyPhoto = data.photo_path && !photos.find(p => p.photo_path === data.photo_path) ? [{ id: null, photo_path: data.photo_path }] : [];
                const allPhotos = [...photos, ...legacyPhoto];

                if (allPhotos.length > 0) {
                    const photoPaths = allPhotos.map(p => p.photo_path);
                    renderCopiedPhotos(photoPaths);
                }

            } catch (error) {
                console.error('Error fetching equipment for copy:', error);
                alert('Error loading equipment data for copy.');
            }
        } else {
            // Bulk copy flow
            if (!count || count < 1) {
                alert('Please enter a valid number.');
                return;
            }
            if (count > 500) {
                alert('Maximum 500 copies at a time.');
                return;
            }

            try {
                const managerId = (typeof currentManager !== 'undefined' && currentManager) ? currentManager.id : '';
                const response = await fetch(`${API_BASE}/equipment/${id}/bulk-copy?manager_id=${managerId}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ count })
                });
                const result = await response.json();
                if (!response.ok) {
                    alert('Error: ' + (result.error || 'Bulk copy failed'));
                    return;
                }
                alert(result.message || `Created ${count} copies successfully.`);
                if (typeof loadEquipment === 'function') loadEquipment();
            } catch (error) {
                console.error('Error during bulk copy:', error);
                alert('Error during bulk copy: ' + error.message);
            }
        }
    });
}

async function viewEquipment(id) {
    try {
        const [response, logsResponse, transfersResponse] = await Promise.all([
            fetch(`${API_BASE}/equipment/${id}`),
            fetch(`${API_BASE}/equipment/${id}/maintenance-history`),
            fetch(`${API_BASE}/equipment/${id}/transfer-history`)
        ]);
        const eq = await response.json();
        const logs = logsResponse.ok ? await logsResponse.json() : [];
        const transfers = transfersResponse.ok ? await transfersResponse.json() : [];

        const photosRes = await fetch(`${API_BASE}/equipment/${id}/photos`);
        const photos = photosRes.ok ? await photosRes.json() : [];
        const legacyPhoto = eq.photo_path && !photos.find(p => p.photo_path === eq.photo_path) ? [{ id: null, photo_path: eq.photo_path }] : [];
        const allPhotos = [...photos, ...legacyPhoto];
        const photoHtml = allPhotos.length > 0
            ? `<div class="flex flex-wrap gap-3 mt-1">${allPhotos.map(p => `
                <div class="relative group">
                    <img src="${p.photo_path}" class="w-28 h-28 object-contain rounded border bg-gray-50 cursor-pointer"
                        onclick="openPhotoLightbox('${p.photo_path}')">
                    ${p.id ? `<button onclick="deleteEquipmentPhoto(${id}, ${p.id}, this)" class="absolute top-1 right-1 hidden group-hover:flex items-center justify-center w-6 h-6 bg-red-600 text-white rounded-full text-xs hover:bg-red-700"><i class="fas fa-times"></i></button>` : ''}
                </div>`).join('')}</div>`
            : '<span class="text-gray-400 text-sm">No photos</span>';
        const documentPaths = eq.manual_document_path ? eq.manual_document_path.split(',').filter(p => p.trim()) : [];
        const documentHtml = documentPaths.length > 0
            ? documentPaths.map(p => `<a href="${p.trim()}" target="_blank" class="text-blue-600 hover:underline mr-2"><i class="fas fa-file mr-1"></i>${p.split('/').pop()}</a>`).join('')
            : 'No document';
        const barcodeDisplay = (typeof eq.barcode === 'object' || eq.barcode === '[object Object]') ? '-' : (eq.barcode || 'N/A');

        const lastMaintenanceLog = (logs || [])
            .filter(log => log.performed_date && log.maintenance_status && log.maintenance_status.toLowerCase() === 'completed')
            .sort((a, b) => new Date(b.performed_date) - new Date(a.performed_date))[0];
        const lastMaintenanceDate = lastMaintenanceLog ? lastMaintenanceLog.performed_date : null;

        const isInStore = eq.status === 'In Stores';
        const nextPM = eq.next_pm_date ? new Date(eq.next_pm_date) : null;
        const nextPMTypeLabel = eq.next_pm_type || '';

        const subLocation = [eq.sub_location_name, eq.business_type_name, eq.business_unit_code].filter(Boolean).join(' - ') || 'N/A';

        const statusColor = eq.display_status === 'Written Off' ? 'bg-red-100 text-red-800'
            : eq.display_status === 'Under Maintenance' ? 'bg-yellow-100 text-yellow-800'
            : eq.display_status === 'In Stores' ? 'bg-blue-100 text-blue-800'
            : eq.display_status === 'Pending Return' ? 'bg-orange-100 text-orange-800'
            : eq.display_status === 'Returned' ? 'bg-purple-100 text-purple-800'
            : eq.display_status === 'Pending Write Off' ? 'bg-orange-100 text-orange-800'
            : 'bg-green-100 text-green-800';

        function cell(label, value) {
            return `<div><span class="text-gray-500 text-xs">${label}:</span> <span class="font-medium block text-sm">${value || '-'}</span></div>`;
        }

        const detailsTableHtml = `
        <div class="space-y-4">

            <!-- Identity card -->
            <div class="bg-blue-50 rounded-lg p-4">
                <div class="text-xs font-semibold text-blue-600 uppercase tracking-wide mb-3">Identity</div>
                <div class="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                    <div class="col-span-2"><span class="text-gray-500 text-xs">Name:</span> <span class="font-semibold text-base block">${eq.name || '-'}</span></div>
                    ${cell('Auto Serial', eq.auto_serial_number)}
                    ${cell('Barcode', barcodeDisplay)}
                    ${cell('Serial Number', eq.serial_number)}
                    ${cell('Category', eq.category)}
                    ${cell('Brand', eq.brand)}
                    ${cell('Model', eq.model)}
                    ${cell('Specification', eq.specification)}
                    <div><span class="text-gray-500 text-xs">Condition:</span> <span class="font-medium block text-sm">${eq.condition || '-'}</span></div>
                    <div><span class="text-gray-500 text-xs">Status:</span><br><span class="px-2 py-0.5 text-xs rounded-full ${statusColor}">${eq.display_status || eq.status || '-'}</span></div>
                </div>
            </div>

            <!-- Location & Assignment -->
            <div class="grid grid-cols-2 gap-4">
                <div class="bg-orange-50 rounded-lg p-4">
                    <div class="text-xs font-semibold text-orange-600 uppercase tracking-wide mb-3">Location</div>
                    <div class="space-y-2 text-sm">
                        ${cell('Country', eq.country_name)}
                        ${cell('Location', eq.location_name)}
                        ${cell('Sub / Business', subLocation)}
                    </div>
                </div>
                <div class="bg-green-50 rounded-lg p-4">
                    <div class="text-xs font-semibold text-green-600 uppercase tracking-wide mb-3">Assignment</div>
                    <div class="space-y-2 text-sm">
                        ${cell('Owner', eq.owner_name)}
                        ${cell('Assigned To', eq.assigned_to_name)}
                        ${cell('Transfer Count', eq.transfer_count || 0)}
                    </div>
                </div>
            </div>

            <!-- Financial -->
            <div class="bg-gray-50 rounded-lg p-4">
                <div class="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Financial & Procurement</div>
                <div class="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                    ${cell('PO Number', eq.purchase_order_number)}
                    ${cell('Supplier', eq.supplier_name)}
                    ${cell('Purchase Cost', eq.purchase_cost)}
                    ${cell('Price', eq.price)}
                    ${cell('Other Charges', eq.other_charges)}
                    ${cell('Purchase Date', formatDate(eq.purchase_date))}
                    ${cell('In Service Date', formatDate(eq.in_service_date))}
                    ${cell('Warranty Expiry', formatDate(eq.warranty_expiry))}
                </div>
            </div>

            <!-- Maintenance schedule -->
            <div class="bg-purple-50 rounded-lg p-4">
                <div class="text-xs font-semibold text-purple-600 uppercase tracking-wide mb-3">Maintenance Schedule</div>
                <div class="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                    <div class="col-span-2"><span class="text-gray-500 text-xs">PM Types:</span> <span class="font-medium block text-sm">${eq.pm_types && eq.pm_types.length > 0 ? [...new Set(eq.pm_types.map(t => t.pm_type))].map(t => t.charAt(0).toUpperCase() + t.slice(1)).join(', ') : 'None configured'}</span></div>
                    ${cell('Last Maintenance', formatDate(eq.last_maintenance_date))}
                    ${cell('Next Preventive Maintenance', nextPM ? formatDate(nextPM) + (nextPMTypeLabel ? ' (' + nextPMTypeLabel.charAt(0).toUpperCase() + nextPMTypeLabel.slice(1) + ')' : '') + (eq.next_pm_overdue ? ' <span class="px-1.5 py-0.5 text-xs rounded bg-red-100 text-red-700">Overdue</span>' : '') : 'N/A')}
                    ${cell('Maintenance Status', eq.maintenance_status)}
                    ${cell('Current Usage (this period)', eq.last_service_transfer_date ? `${Math.max(0, Math.round((new Date() - new Date(eq.last_service_transfer_date)) / (1000 * 60 * 60 * 24)))} days` : (eq.in_service_date && !(eq.status && eq.status.toLowerCase() === 'in stores') ? `${Math.max(0, Math.round((new Date() - new Date(eq.in_service_date)) / (1000 * 60 * 60 * 24)))} days` : 'N/A'))}
                    ${cell('Total Usage Days', eq.in_service_date ? `${Math.max(0, Math.round((new Date() - new Date(eq.in_service_date)) / (1000 * 60 * 60 * 24)) - (parseInt(eq.accumulated_usage_days) || 0))} days` : 'N/A')}
                </div>
                ${eq.missed_pm_dates && eq.missed_pm_dates.length > 0 ? `
                <div class="mt-3 pt-3 border-t border-purple-200">
                    <div class="text-xs font-semibold text-red-600 uppercase tracking-wide mb-2">Missed PM Schedules</div>
                    ${eq.missed_pm_dates.map(m => `
                        <div class="text-sm mb-1">
                            <span class="font-medium capitalize">${m.pm_type}</span>:
                            <span class="text-red-600">${m.missed_dates.map(d => formatDate(d)).join(', ')}</span>
                        </div>
                    `).join('')}
                </div>` : ''}
            </div>

            ${eq.comments ? `<div class="text-sm"><span class="text-xs font-semibold text-gray-500 uppercase tracking-wide">Comments</span><p class="mt-1 p-2 bg-gray-50 border rounded whitespace-pre-wrap">${eq.comments}</p></div>` : ''}
            <div class="text-xs text-gray-400">Created: ${formatDate(eq.created_at)} &nbsp;|&nbsp; Updated: ${formatDate(eq.updated_at)}</div>
        </div>`;

        const maintenanceHistoryHtml = logs.length === 0
            ? '<p class="text-gray-600 text-sm">No maintenance records found.</p>'
            : `
                <table class="w-full min-w-full text-sm border">
                    <thead class="bg-gray-50">
                        <tr>
                            <th class="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Serial</th>
                            <th class="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                            <th class="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">PM Type</th>
                            <th class="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                            <th class="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
                            <th class="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Performed By</th>
                            <th class="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Parts Used</th>
                        </tr>
                    </thead>
                    <tbody class="bg-white divide-y divide-gray-200">
                        ${logs.map(log => {
                            const partsUsed = log.parts && log.parts.length > 0
                                ? log.parts.map(p => `${p.spare_part_name} (${p.quantity_used})`).join(', ')
                                : '-';
                            const pmTypeDisplay = log.pm_types && log.pm_types.length > 0
                                ? log.pm_types.map(t => t.charAt(0).toUpperCase() + t.slice(1)).join(', ')
                                : (log.maintenance_type || '-');
                            return `
                                <tr>
                                    <td class="px-3 py-2 whitespace-nowrap">${log.maintenance_serial_number || '-'}</td>
                                    <td class="px-3 py-2 whitespace-nowrap">${formatDate(log.performed_date)}</td>
                                    <td class="px-3 py-2 whitespace-nowrap">${pmTypeDisplay}</td>
                                    <td class="px-3 py-2 whitespace-nowrap">${log.maintenance_status || 'Pending'}</td>
                                    <td class="px-3 py-2">${log.description || '-'}</td>
                                    <td class="px-3 py-2 whitespace-nowrap">${log.performed_by_name || log.performed_by || '-'}</td>
                                    <td class="px-3 py-2">${partsUsed}</td>
                                </tr>
                            `;
                        }).join('')}
                    </tbody>
                </table>
            `;

        const transferHistoryHtml = transfers.length === 0
            ? '<p class="text-gray-600 text-sm">No transfer records found.</p>'
            : `
                <table class="w-full min-w-full text-sm border">
                    <thead class="bg-gray-50">
                        <tr>
                            <th class="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Transfer Serial</th>
                            <th class="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Transfer Date</th>
                            <th class="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">From Location</th>
                            <th class="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">To Location</th>
                            <th class="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Previous Assigned To</th>
                            <th class="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Assigned To</th>
                            <th class="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Created By</th>
                            <th class="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Notes</th>
                        </tr>
                    </thead>
                    <tbody class="bg-white divide-y divide-gray-200">
                        ${transfers.map(t => `
                            <tr>
                                <td class="px-3 py-2 whitespace-nowrap">${t.transfer_serial_number || '-'}</td>
                                <td class="px-3 py-2 whitespace-nowrap">${formatDate(t.transfer_date)}</td>
                                <td class="px-3 py-2">${t.from_location_name || '-'}</td>
                                <td class="px-3 py-2">${t.to_location_name || '-'}</td>
                                <td class="px-3 py-2 whitespace-nowrap">${t.previous_assigned_to_name || t.previous_assigned_to || '-'}</td>
                                <td class="px-3 py-2 whitespace-nowrap">${t.assigned_to_name || t.assigned_to || '-'}</td>
                                <td class="px-3 py-2 whitespace-nowrap">${t.created_by || '-'}</td>
                                <td class="px-3 py-2">${t.notes || '-'}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            `;

        const detailsHtml = `
                <!-- Header -->
                <div class="px-5 py-4 border-b flex-shrink-0 flex justify-between items-center">
                    <div>
                        <h3 class="text-lg font-semibold">Equipment Details</h3>
                        <p class="text-xs text-gray-500">${eq.auto_serial_number || ''}</p>
                    </div>
                    <button onclick="closeEquipmentViewModal()" class="text-gray-400 hover:text-gray-600"><i class="fas fa-times text-lg"></i></button>
                </div>

                <!-- Scrollable body -->
                <div class="p-5 overflow-y-auto flex-1 min-h-0 space-y-4">
                    ${detailsTableHtml}

                    <!-- Photos & Document -->
                    <div class="grid grid-cols-2 gap-4">
                        <div class="bg-gray-50 rounded-lg p-4">
                            <div class="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Photos</div>
                            ${photoHtml}
                        </div>
                        <div class="bg-gray-50 rounded-lg p-4">
                            <div class="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Document</div>
                            <div class="text-sm">${documentHtml}</div>
                        </div>
                    </div>

                    <!-- Maintenance History -->
                    <div>
                        <div class="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Maintenance History</div>
                        <div class="overflow-x-auto rounded border">${maintenanceHistoryHtml}</div>
                    </div>

                    <!-- Transfer History -->
                    <div>
                        <div class="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Transfer History</div>
                        <div class="overflow-x-auto rounded border">${transferHistoryHtml}</div>
                    </div>
                </div>

                <!-- Footer actions -->
                <div class="px-5 py-3 border-t flex-shrink-0 flex flex-wrap justify-between items-center gap-3">
                    <div class="flex items-center gap-4 text-sm">
                        <label class="flex items-center gap-1.5"><input type="checkbox" id="print-details" checked> Details</label>
                        <label class="flex items-center gap-1.5"><input type="checkbox" id="print-maintenance"> Maintenance</label>
                        <label class="flex items-center gap-1.5"><input type="checkbox" id="print-transfer"> Transfers</label>
                        <label class="flex items-center gap-1.5"><input type="checkbox" id="print-all" onchange="togglePrintAll(this)"> All</label>
                    </div>
                    <div class="flex gap-2">
                        <button onclick="printEquipmentReport(${eq.id})" class="px-3 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-sm"><i class="fas fa-print mr-1"></i>Print / PDF</button>
                        <button onclick="viewEquipmentMaintenanceHistory(${eq.id})" class="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm">Maintenance History</button>
                        <button onclick="viewEquipmentTransferHistory(${eq.id})" class="px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm">Transfer History</button>
                        <button onclick="closeEquipmentViewModal()" class="px-3 py-2 border rounded-lg hover:bg-gray-100 text-sm">Close</button>
                    </div>
                </div>
        `;

        // Create or update view modal
        let viewModal = document.getElementById('equipment-view-modal');
        if (!viewModal) {
            viewModal = document.createElement('div');
            viewModal.id = 'equipment-view-modal';
            viewModal.className = 'modal fixed inset-0 bg-black bg-opacity-50 items-center justify-center z-50';
            document.body.appendChild(viewModal);
        }
        viewModal.innerHTML = `
            <div class="bg-white rounded-lg shadow-xl w-full max-w-5xl flex flex-col my-6 overflow-hidden" style="max-height:80vh;">
                ${detailsHtml}
            </div>
        `;
        viewModal.classList.add('active');
    } catch (error) {
        console.error('Error viewing equipment:', error);
    }
}

function closeEquipmentViewModal() {
    const viewModal = document.getElementById('equipment-view-modal');
    if (viewModal) {
        viewModal.classList.remove('active');
    }
}

function togglePrintAll(checkbox) {
    const checked = checkbox.checked;
    document.getElementById('print-details').checked = checked;
    document.getElementById('print-maintenance').checked = checked;
    document.getElementById('print-transfer').checked = checked;
}

async function printEquipmentReport(equipmentId) {
    try {
        const printDetails = document.getElementById('print-details').checked;
        const printMaintenance = document.getElementById('print-maintenance').checked;
        const printTransfer = document.getElementById('print-transfer').checked;

        if (!printDetails && !printMaintenance && !printTransfer) {
            alert('Please select at least one section to print.');
            return;
        }

        const [eqResponse, maintenanceResponse, transferResponse] = await Promise.all([
            fetch(`${API_BASE}/equipment/${equipmentId}`),
            printMaintenance ? fetch(`${API_BASE}/equipment/${equipmentId}/maintenance-history`) : Promise.resolve({ json: () => [] }),
            printTransfer ? fetch(`${API_BASE}/equipment/${equipmentId}/transfer-history`) : Promise.resolve({ json: () => [] })
        ]);

        const eq = await eqResponse.json();
        const maintenanceLogs = await maintenanceResponse.json();
        const transfers = await transferResponse.json();

        const today = formatDate(new Date());
        const reportTitle = `Equipment Report - ${eq.auto_serial_number || eq.name || 'N/A'}`;

        const lastMaintenanceLog = (maintenanceLogs || [])
            .filter(log => log.performed_date && log.maintenance_status && log.maintenance_status.toLowerCase() === 'completed')
            .sort((a, b) => new Date(b.performed_date) - new Date(a.performed_date))[0];
        const lastMaintenanceDate = lastMaintenanceLog ? lastMaintenanceLog.performed_date : null;

        const isInStore = eq.status === 'In Stores';
        const nextPM = eq.next_pm_date ? new Date(eq.next_pm_date) : null;
        const nextPMTypeLabel = eq.next_pm_type || '';

        const subLocation = [eq.sub_location_name, eq.business_type_name, eq.business_unit_code].filter(Boolean).join(' - ') || 'N/A';
        const barcodeDisplay = (typeof eq.barcode === 'object' || eq.barcode === '[object Object]') ? '-' : (eq.barcode || 'N/A');

        const detailRows = [
            ['Auto Serial', eq.auto_serial_number || 'N/A'],
            ['Name', eq.name || 'N/A'],
            ['Brand', eq.brand || 'N/A'],
            ['Model', eq.model || 'N/A'],
            ['Serial Number', eq.serial_number || 'N/A'],
            ['Barcode', barcodeDisplay],
            ['Category', eq.category || 'N/A'],
            ['Specification', eq.specification || 'N/A'],
            ['Condition', eq.condition || 'N/A'],
            ['Status', eq.display_status || eq.status || 'N/A'],
            ['Country', eq.country_name || 'N/A'],
            ['Location', eq.location_name || 'N/A'],
            ['Sub / Business', subLocation],
            ['Owner', eq.owner_name || 'N/A'],
            ['Assigned To', eq.assigned_to_name || 'N/A'],
            ['PO Number', eq.purchase_order_number || 'N/A'],
            ['Purchase Cost', eq.purchase_cost || 'N/A'],
            ['Price', eq.price || 'N/A'],
            ['Other Charges', eq.other_charges || 'N/A'],
            ['Purchase Date', formatDate(eq.purchase_date)],
            ['In Service Date', formatDate(eq.in_service_date)],
            ['Warranty Expiry', formatDate(eq.warranty_expiry)],
            ['Current Usage (this period)', eq.last_service_transfer_date ? `${Math.max(0, Math.round((new Date() - new Date(eq.last_service_transfer_date)) / (1000 * 60 * 60 * 24)))} days` : (eq.in_service_date && !(eq.status && eq.status.toLowerCase() === 'in stores') ? `${Math.max(0, Math.round((new Date() - new Date(eq.in_service_date)) / (1000 * 60 * 60 * 24)))} days` : 'N/A')],
            ['Total Usage Days', eq.in_service_date ? `${Math.max(0, Math.round((new Date() - new Date(eq.in_service_date)) / (1000 * 60 * 60 * 24)) - (parseInt(eq.accumulated_usage_days) || 0))} days` : 'N/A'],
            ['Transfer Count', eq.transfer_count || 0],
            ['Supplier', eq.supplier_name || 'Not found'],
            ['Comments', eq.comments || 'N/A']
        ];

        let reportHtml = `<div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #333;">`;

        if (printDetails) {
            const photoHtml = eq.thumbnail_photo
                ? `<img src="${eq.thumbnail_photo}" loading="lazy" style="max-width: 120px; max-height: 120px; object-fit: contain; border: 1px solid #e2e8f0; border-radius: 6px; margin-bottom: 12px;">`
                : '';
            reportHtml += `
                <div style="margin-bottom: 15px;">
                    <h3 style="background: #edf2f7; padding: 5px 8px; color: #2d3748; border-left: 4px solid #4a5568; margin-bottom: 8px; font-size: 13px;">Equipment Details</h3>
                    ${photoHtml}
                    <table style="width: 100%; border-collapse: collapse; font-size: 11px;">
                        ${detailRows.map(r => `<tr><td style="border: 1px solid #e2e8f0; padding: 3px 6px; width: 30%; line-height: 1.3;"><strong>${r[0]}</strong></td><td style="border: 1px solid #e2e8f0; padding: 3px 6px; line-height: 1.3;">${r[1]}</td></tr>`).join('')}
                    </table>
                </div>
            `;
        }

        if (printMaintenance) {
            const pmScheduleRows = [
                ['PM Types', eq.pm_types && eq.pm_types.length > 0 ? [...new Set(eq.pm_types.map(t => t.pm_type))].map(t => t.charAt(0).toUpperCase() + t.slice(1)).join(', ') : 'None configured'],
                ['Last Maintenance Date', formatDate(eq.last_maintenance_date)],
                ['Next Preventive Maintenance', nextPM ? formatDate(nextPM) + (nextPMTypeLabel ? ' (' + nextPMTypeLabel + ')' : '') + (eq.next_pm_overdue ? ' [OVERDUE]' : '') : 'N/A'],
                ['Missed PM Schedules', eq.missed_pm_dates && eq.missed_pm_dates.length > 0 ? eq.missed_pm_dates.map(m => `${m.pm_type}: ${m.missed_dates.map(d => formatDate(d)).join(', ')}`).join(' | ') : 'None'],
                ['Maintenance Status', eq.maintenance_status || 'N/A']
            ];
            reportHtml += `
                <div style="margin-bottom: 15px;">
                    <h3 style="background: #edf2f7; padding: 5px 8px; color: #2d3748; border-left: 4px solid #3182ce; margin-bottom: 8px; font-size: 13px;">Maintenance Schedule</h3>
                    <table style="width: 100%; border-collapse: collapse; font-size: 11px;">
                        ${pmScheduleRows.map(r => `<tr><td style="border: 1px solid #e2e8f0; padding: 3px 6px; width: 30%; line-height: 1.3;"><strong>${r[0]}</strong></td><td style="border: 1px solid #e2e8f0; padding: 3px 6px; line-height: 1.3;">${r[1]}</td></tr>`).join('')}
                    </table>
                </div>
                <div style="margin-bottom: 15px;">
                    <h3 style="background: #edf2f7; padding: 5px 8px; color: #2d3748; border-left: 4px solid #3182ce; margin-bottom: 8px; font-size: 13px;">Maintenance History</h3>
            `;
            if (maintenanceLogs.length === 0) {
                reportHtml += '<p style="font-size: 12px; color: #718096;">No maintenance records found.</p>';
            } else {
                reportHtml += `
                    <table style="width: 100%; border-collapse: collapse; font-size: 11px;">
                        <thead>
                            <tr style="background: #edf2f7;">
                                <th style="border: 1px solid #e2e8f0; padding: 3px 6px; text-align: left;">Serial</th>
                                <th style="border: 1px solid #e2e8f0; padding: 3px 6px; text-align: left;">Date</th>
                                <th style="border: 1px solid #e2e8f0; padding: 3px 6px; text-align: left;">Type</th>
                                <th style="border: 1px solid #e2e8f0; padding: 3px 6px; text-align: left;">Status</th>
                                <th style="border: 1px solid #e2e8f0; padding: 3px 6px; text-align: left;">Description</th>
                                <th style="border: 1px solid #e2e8f0; padding: 3px 6px; text-align: left;">Performed By</th>
                                <th style="border: 1px solid #e2e8f0; padding: 3px 6px; text-align: left;">Parts Used</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${maintenanceLogs.map(log => {
                                const partsUsed = log.parts && log.parts.length > 0
                                    ? log.parts.map(p => `${p.spare_part_name} (${p.quantity_used})`).join(', ')
                                    : '-';
                                return `
                                    <tr>
                                        <td style="border: 1px solid #e2e8f0; padding: 3px 6px; line-height: 1.3;">${log.maintenance_serial_number || '-'}</td>
                                        <td style="border: 1px solid #e2e8f0; padding: 3px 6px; line-height: 1.3;">${formatDate(log.performed_date)}</td>
                                        <td style="border: 1px solid #e2e8f0; padding: 3px 6px; line-height: 1.3;">${log.maintenance_type || '-'}</td>
                                        <td style="border: 1px solid #e2e8f0; padding: 3px 6px; line-height: 1.3;">${log.maintenance_status || 'Pending'}</td>
                                        <td style="border: 1px solid #e2e8f0; padding: 3px 6px; line-height: 1.3;">${log.description || '-'}</td>
                                        <td style="border: 1px solid #e2e8f0; padding: 3px 6px; line-height: 1.3;">${log.performed_by_name || log.performed_by || '-'}</td>
                                        <td style="border: 1px solid #e2e8f0; padding: 3px 6px; line-height: 1.3;">${partsUsed}</td>
                                    </tr>
                                `;
                            }).join('')}
                        </tbody>
                    </table>
                `;
            }
            reportHtml += '</div>';
        }

        if (printTransfer) {
            reportHtml += `
                <div style="margin-bottom: 15px;">
                    <h3 style="background: #edf2f7; padding: 5px 8px; color: #2d3748; border-left: 4px solid #38a169; margin-bottom: 8px; font-size: 13px;">Transfer History</h3>
            `;
            if (transfers.length === 0) {
                reportHtml += '<p style="font-size: 12px; color: #718096;">No transfer records found.</p>';
            } else {
                reportHtml += `
                    <table style="width: 100%; border-collapse: collapse; font-size: 11px;">
                        <thead>
                            <tr style="background: #edf2f7;">
                                <th style="border: 1px solid #e2e8f0; padding: 3px 6px; text-align: left;">Transfer Serial</th>
                                <th style="border: 1px solid #e2e8f0; padding: 3px 6px; text-align: left;">Transfer Date</th>
                                <th style="border: 1px solid #e2e8f0; padding: 3px 6px; text-align: left;">From Location</th>
                                <th style="border: 1px solid #e2e8f0; padding: 3px 6px; text-align: left;">To Location</th>
                                <th style="border: 1px solid #e2e8f0; padding: 3px 6px; text-align: left;">Previous Assigned To</th>
                                <th style="border: 1px solid #e2e8f0; padding: 3px 6px; text-align: left;">Assigned To</th>
                                <th style="border: 1px solid #e2e8f0; padding: 3px 6px; text-align: left;">Created By</th>
                                <th style="border: 1px solid #e2e8f0; padding: 3px 6px; text-align: left;">Notes</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${transfers.map(t => `
                                <tr>
                                    <td style="border: 1px solid #e2e8f0; padding: 3px 6px; line-height: 1.3;">${t.transfer_serial_number || '-'}</td>
                                    <td style="border: 1px solid #e2e8f0; padding: 3px 6px; line-height: 1.3;">${formatDate(t.transfer_date)}</td>
                                    <td style="border: 1px solid #e2e8f0; padding: 3px 6px; line-height: 1.3;">${t.from_location_name || '-'}</td>
                                    <td style="border: 1px solid #e2e8f0; padding: 3px 6px; line-height: 1.3;">${t.to_location_name || '-'}</td>
                                    <td style="border: 1px solid #e2e8f0; padding: 3px 6px; line-height: 1.3;">${t.previous_assigned_to_name || t.previous_assigned_to || '-'}</td>
                                    <td style="border: 1px solid #e2e8f0; padding: 3px 6px; line-height: 1.3;">${t.assigned_to_name || t.assigned_to || '-'}</td>
                                    <td style="border: 1px solid #e2e8f0; padding: 3px 6px; line-height: 1.3;">${t.created_by || '-'}</td>
                                    <td style="border: 1px solid #e2e8f0; padding: 3px 6px; line-height: 1.3;">${t.notes || '-'}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                `;
            }
            reportHtml += '</div>';
        }

        reportHtml += '</div>';

        const iframe = document.createElement('iframe');
        iframe.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;border:none;z-index:9999;';
        document.body.appendChild(iframe);
        iframe.contentWindow.document.open();
        iframe.contentWindow.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>${reportTitle}</title>
                <style>
                    @page { margin: 1cm 1cm 1.8cm 1cm; @bottom-right { content: "Page " counter(page) " of " counter(pages); font-size: 10px; color: #999; } }
                    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 0; margin: 0; color: #333; }
                    h2 { margin: 0; color: #2d3748; }
                    h3 { background: #edf2f7; padding: 5px 8px; color: #2d3748; border-left: 4px solid #4a5568; margin-bottom: 8px; font-size: 13px; }
                    table { width: 100%; border-collapse: collapse; font-size: 11px; margin-bottom: 8px; }
                    th, td { border: 1px solid #e2e8f0; padding: 3px 6px; text-align: left; line-height: 1.3; }
                    th { background: #edf2f7; }
                    .doc-header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #1e40af; padding-bottom: 16px; margin-bottom: 24px; }
                    .doc-header .logo-block { flex: 1; }
                    .doc-header .logo-block img { max-height: 80px; max-width: 220px; object-fit: contain; display: block; }
                    .doc-header .logo-block .logo-fallback { display: none; font-size: 13px; color: #6b7280; font-style: italic; }
                    .doc-header .title-block { flex: 1; text-align: center; }
                    .doc-header .title-block h1 { margin: 0; font-size: 22px; font-weight: 700; color: #1e40af; letter-spacing: 0.3px; }
                    .doc-header .title-block p { margin: 4px 0 0; color: #6b7280; font-size: 12px; }
                    .doc-header .doc-id { flex: 1; text-align: right; }
                    .doc-header .doc-id .id-label { font-size: 10px; color: #9ca3af; text-transform: uppercase; letter-spacing: 0.5px; }
                    .doc-header .doc-id .id-value { font-size: 14px; font-weight: 700; color: #1f2937; }
                    .content { padding: 20px; }
                </style>
            </head>
            <body>
                <div class="content">
                <div class="doc-header">
                    <div class="logo-block">
                        <img src="/company-logo/company-logo.png" alt="Company Logo" onerror="this.style.display='none'; this.nextElementSibling.style.display='block';">
                        <div class="logo-fallback">[Company Logo]<br><span style="font-size:10px;">Place company-logo.png in public/company-logo/</span></div>
                    </div>
                    <div class="title-block">
                        <h1>Equipment Details</h1>
                        <p>${reportTitle}</p>
                    </div>
                    <div class="doc-id">
                        <div class="id-label">Generated On</div>
                        <div class="id-value">${today}</div>
                    </div>
                </div>
                ${reportHtml}
                </div>
            </body>
            </html>
        `);
        iframe.contentWindow.document.close();
        iframe.contentWindow.focus();
        iframe.contentWindow.print();
        iframe.style.visibility = 'hidden';
        var removeIframe = function() { if (iframe.parentNode) document.body.removeChild(iframe); };
        try { iframe.contentWindow.addEventListener('afterprint', removeIframe, { once: true }); } catch(e) {}
        setTimeout(removeIframe, 500);
    } catch (error) {
        console.error('Error printing equipment report:', error);
        alert('Error generating PDF. Please try again.');
    }
}

function getMissedPMDates(anchorDate, months, logs) {
    if (!anchorDate || !months || months <= 0) return [];
    const anchor = new Date(anchorDate);
    if (isNaN(anchor.getTime())) return [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const missed = [];
    let due = new Date(anchor);
    due.setHours(0, 0, 0, 0);
    due.setMonth(due.getMonth() + parseInt(months));
    while (due <= today) {
        // Check if a maintenance log exists within ±15 days of this due date
        const dueCovered = (logs || []).some(log => {
            if (!log.performed_date) return false;
            const logDate = new Date(log.performed_date);
            const diffDays = Math.abs((logDate - due) / (1000 * 60 * 60 * 24));
            return diffDays <= 15;
        });
        if (!dueCovered) missed.push(new Date(due));
        due = new Date(due);
        due.setMonth(due.getMonth() + parseInt(months));
    }
    return missed;
}

async function viewEquipmentMaintenanceHistory(equipmentId) {
    try {
        const response = await fetch(`${API_BASE}/equipment/${equipmentId}/maintenance-history`);
        const logs = await response.json();
        const equipment = allEquipment.find(eq => eq.id === equipmentId);

        // Calculate missed PM schedules
        let missedHtml = '';
        if (equipment && equipment.preventive_maintenance_months && equipment.status !== 'In Stores' && equipment.status !== 'Written Off') {
            const lastLog = (logs || []).filter(l => l.performed_date && l.maintenance_status && l.maintenance_status.toLowerCase() === 'completed')
                .sort((a, b) => new Date(b.performed_date) - new Date(a.performed_date))[0];
            const lastDone = lastLog ? lastLog.performed_date : null;
            const accDays = parseInt(equipment.accumulated_usage_days) || 0;
            let pmAnchor = null;
            if (lastDone && accDays === 0) {
                pmAnchor = lastDone;
            } else if (equipment.in_service_date) {
                // Back-date in_service_date by accumulated usage days
                const baseDate = new Date(equipment.in_service_date);
                baseDate.setDate(baseDate.getDate() - accDays);
                pmAnchor = baseDate.toISOString().split('T')[0];
            }
            const missed = getMissedPMDates(pmAnchor, equipment.preventive_maintenance_months, logs);
            if (missed.length > 0) {
                missedHtml = `
                    <div class="mb-5 p-4 bg-red-50 border border-red-200 rounded-lg">
                        <div class="flex items-center gap-2 mb-2">
                            <i class="fas fa-exclamation-triangle text-red-600"></i>
                            <span class="font-semibold text-red-700">Missed PM Schedules (${missed.length})</span>
                        </div>
                        <p class="text-xs text-red-600 mb-2">The following preventive maintenance dates were missed with no maintenance record found:</p>
                        <div class="flex flex-wrap gap-2">
                            ${missed.map(d => `<span class="px-2 py-1 bg-red-100 text-red-700 text-xs rounded font-medium">${formatDate(d)}</span>`).join('')}
                        </div>
                    </div>
                `;
            }
        }

        let historyHtml = `
            <div class="p-6">
                <h3 class="text-xl font-semibold mb-4">Maintenance History - ${equipment ? equipment.name : 'Equipment'}</h3>
                ${missedHtml}
        `;

        if (logs.length === 0) {
            historyHtml += '<p class="text-gray-600">No maintenance records found.</p>';
        } else {
            historyHtml += `
                <table class="w-full min-w-full text-sm">
                    <thead class="bg-gray-50">
                        <tr>
                            <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Serial</th>
                            <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                            <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                            <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                            <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
                            <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Performed By</th>
                            <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Parts Used</th>
                        </tr>
                    </thead>
                    <tbody class="bg-white divide-y divide-gray-200">
            `;
            historyHtml += logs.map(log => {
                const partsUsed = log.parts && log.parts.length > 0
                    ? log.parts.map(p => `${p.spare_part_name} (${p.quantity_used})`).join(', ')
                    : '-';
                return `
                    <tr>
                        <td class="px-4 py-2 whitespace-nowrap">${log.maintenance_serial_number || '-'}</td>
                        <td class="px-4 py-2 whitespace-nowrap">${formatDate(log.performed_date)}</td>
                        <td class="px-4 py-2 whitespace-nowrap">${log.maintenance_type || '-'}</td>
                        <td class="px-4 py-2 whitespace-nowrap">${log.maintenance_status || 'Pending'}</td>
                        <td class="px-4 py-2">${log.description || '-'}</td>
                        <td class="px-4 py-2 whitespace-nowrap">${log.performed_by_name || log.performed_by || '-'}</td>
                        <td class="px-4 py-2">${partsUsed}</td>
                    </tr>
                `;
            }).join('');
            historyHtml += '</tbody></table>';
        }

        historyHtml += `
                <div class="mt-6 flex justify-end">
                    <button onclick="closeEquipmentMaintenanceHistoryModal()" class="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700">Close</button>
                </div>
            </div>
        `;

        let historyModal = document.getElementById('equipment-maintenance-history-modal');
        if (!historyModal) {
            historyModal = document.createElement('div');
            historyModal.id = 'equipment-maintenance-history-modal';
            historyModal.className = 'modal fixed inset-0 bg-black bg-opacity-50 items-center justify-center z-50';
            document.body.appendChild(historyModal);
        }
        historyModal.innerHTML = `
            <div class="bg-white rounded-lg shadow-xl w-full max-w-5xl my-6 max-h-[80vh] overflow-y-auto">
                ${historyHtml}
            </div>
        `;
        historyModal.classList.add('active');
    } catch (error) {
        console.error('Error loading equipment maintenance history:', error);
    }
}

function formatSublocationFilterOptionText(a) {
    const parts = [a.sub_location_name, a.business_type_name, a.business_unit_code].filter(Boolean);
    return parts.length ? parts.join(' - ') : '';
}

function populateSublocationFilterOptions(select, assignments) {
    const checkboxList = document.getElementById('sublocation-checkbox-list');
    if (!checkboxList) return;
    const checkAll = document.getElementById('sublocation-check-all');
    if (checkAll) checkAll.checked = true;
    checkboxList.innerHTML = assignments
        .filter(a => a.sub_location_name || a.business_type_name || a.business_unit_code)
        .sort((a, b) => formatSublocationFilterOptionText(a).localeCompare(formatSublocationFilterOptionText(b)))
        .map(a => {
            const text = formatSublocationFilterOptionText(a);
            return `<label class="flex items-center px-3 py-2 hover:bg-gray-50 text-sm cursor-pointer">
                <input type="checkbox" value="${a.id}" onchange="onSublocationCheckboxChange()" class="mr-2 sublocation-checkbox"> <span class="truncate">${text}</span>
            </label>`;
        }).join('');
    updateSublocationFilterLabel();
}

function getSelectedSublocationIds() {
    return Array.from(document.querySelectorAll('.sublocation-checkbox:checked')).map(cb => cb.value);
}

function toggleSublocationCheckboxDropdown() {
    const dropdown = document.getElementById('equipment-filter-sublocation-dropdown');
    if (dropdown) dropdown.classList.toggle('hidden');
}

function onSublocationCheckAllChange() {
    const checkAll = document.getElementById('sublocation-check-all');
    const checkboxes = document.querySelectorAll('.sublocation-checkbox');
    checkboxes.forEach(cb => cb.checked = checkAll.checked);
    updateSublocationFilterLabel();
    filterEquipment();
}

function onSublocationCheckboxChange() {
    const checkboxes = document.querySelectorAll('.sublocation-checkbox');
    const checkedCount = Array.from(checkboxes).filter(cb => cb.checked).length;
    const checkAll = document.getElementById('sublocation-check-all');
    if (checkAll) checkAll.checked = checkboxes.length > 0 && checkedCount === checkboxes.length;
    updateSublocationFilterLabel();
    filterEquipment();
}

function updateSublocationFilterLabel() {
    const label = document.getElementById('equipment-filter-sublocation-label');
    if (!label) return;
    const checkboxes = document.querySelectorAll('.sublocation-checkbox');
    const checked = Array.from(checkboxes).filter(cb => cb.checked);
    if (checked.length === 0 || checked.length === checkboxes.length) {
        label.textContent = 'All Sublocations / Business Types';
    } else if (checked.length === 1) {
        label.textContent = checked[0].nextElementSibling.textContent.trim();
    } else {
        label.textContent = checked.length + ' selected';
    }
}

function filterSublocationCheckboxes() {
    const search = (document.getElementById('sublocation-search')?.value || '').toLowerCase();
    const labels = document.querySelectorAll('#sublocation-checkbox-list label');
    labels.forEach(label => {
        const text = label.textContent.trim().toLowerCase();
        label.style.display = text.includes(search) ? '' : 'none';
    });
}

function onEquipmentFilterCountryChange() {
    const country = document.getElementById('equipment-filter-country').value;
    const locationSelect = document.getElementById('equipment-filter-location');

    // Location only shows data when a country is selected
    if (country && allEquipment && allEquipment.length) {
        const locationNames = [...new Set(allEquipment
            .filter(eq => eq.country_name === country)
            .map(eq => eq.location_name)
            .filter(loc => loc))].sort();
        locationSelect.innerHTML = '<option value="">All Locations</option>' +
            locationNames.map(loc => `<option value="${loc}">${loc}</option>`).join('');
    } else {
        locationSelect.innerHTML = '<option value="">All Locations</option>';
    }

    // Sublocation is reset until both country and location are selected
    const checkboxList = document.getElementById('sublocation-checkbox-list');
    if (checkboxList) checkboxList.innerHTML = '';
    const checkAll = document.getElementById('sublocation-check-all');
    if (checkAll) checkAll.checked = true;
    const label = document.getElementById('equipment-filter-sublocation-label');
    if (label) label.textContent = 'All Sublocations / Business Types';

    filterEquipment();
}

function onEquipmentFilterLocationChange() {
    const country = document.getElementById('equipment-filter-country').value;
    const location = document.getElementById('equipment-filter-location').value;

    // Sublocation / business type only shows data when both country and location are selected
    if (country && location && window.allBusinessTypeAssignments) {
        const assignments = window.allBusinessTypeAssignments.filter(a =>
            a.country_name === country && a.location_name === location
        );
        populateSublocationFilterOptions(null, assignments);
    } else {
        const checkboxList = document.getElementById('sublocation-checkbox-list');
        if (checkboxList) checkboxList.innerHTML = '';
        const checkAll = document.getElementById('sublocation-check-all');
        if (checkAll) checkAll.checked = true;
        const label = document.getElementById('equipment-filter-sublocation-label');
        if (label) label.textContent = 'All Sublocations / Business Types';
    }

    filterEquipment();
}

function closeEquipmentMaintenanceHistoryModal() {
    const modal = document.getElementById('equipment-maintenance-history-modal');
    if (modal) {
        modal.classList.remove('active');
    }
}

async function viewEquipmentTransferHistory(equipmentId) {
    try {
        const response = await fetch(`${API_BASE}/equipment/${equipmentId}/transfer-history`);
        const transfers = await response.json();
        const equipment = allEquipment.find(eq => eq.id === equipmentId);

        let historyHtml = `
            <div class="p-6">
                <h3 class="text-xl font-semibold mb-4">Transfer History - ${equipment ? equipment.name : 'Equipment'}</h3>
        `;

        if (transfers.length === 0) {
            historyHtml += '<p class="text-gray-600">No transfer records found.</p>';
        } else {
            historyHtml += `
                <table class="w-full min-w-full text-sm">
                    <thead class="bg-gray-50">
                        <tr>
                            <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Transfer Serial</th>
                            <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Transfer Date</th>
                            <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">From Location</th>
                            <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">To Location</th>
                            <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Previous Assigned To</th>
                            <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Assigned To</th>
                            <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Created By</th>
                            <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Notes</th>
                        </tr>
                    </thead>
                    <tbody class="bg-white divide-y divide-gray-200">
            `;
            historyHtml += transfers.map(t => `
                <tr>
                    <td class="px-4 py-2 whitespace-nowrap">${t.transfer_serial_number || '-'}</td>
                    <td class="px-4 py-2 whitespace-nowrap">${formatDate(t.transfer_date)}</td>
                    <td class="px-4 py-2">${t.from_location_name || '-'}</td>
                    <td class="px-4 py-2">${t.to_location_name || '-'}</td>
                    <td class="px-4 py-2 whitespace-nowrap">${t.previous_assigned_to_name || t.previous_assigned_to || '-'}</td>
                    <td class="px-4 py-2 whitespace-nowrap">${t.assigned_to_name || t.assigned_to || '-'}</td>
                    <td class="px-4 py-2 whitespace-nowrap">${t.created_by || '-'}</td>
                    <td class="px-4 py-2">${t.notes || '-'}</td>
                </tr>
            `).join('');
            historyHtml += '</tbody></table>';
        }

        historyHtml += `
                <div class="mt-6 flex justify-end">
                    <button onclick="closeEquipmentTransferHistoryModal()" class="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700">Close</button>
                </div>
            </div>
        `;

        let historyModal = document.getElementById('equipment-transfer-history-modal');
        if (!historyModal) {
            historyModal = document.createElement('div');
            historyModal.id = 'equipment-transfer-history-modal';
            historyModal.className = 'modal fixed inset-0 bg-black bg-opacity-50 items-center justify-center z-50';
            document.body.appendChild(historyModal);
        }
        historyModal.innerHTML = `
            <div class="bg-white rounded-lg shadow-xl w-full max-w-5xl my-6 max-h-[80vh] overflow-y-auto">
                ${historyHtml}
            </div>
        `;
        historyModal.classList.add('active');
    } catch (error) {
        console.error('Error loading equipment transfer history:', error);
    }
}

function closeEquipmentTransferHistoryModal() {
    const modal = document.getElementById('equipment-transfer-history-modal');
    if (modal) {
        modal.classList.remove('active');
    }
}

function getFilteredEquipment() {
    if (!Array.isArray(allEquipment)) return [];
    const search = (document.getElementById('equipment-search')?.value || '').toLowerCase();

    return allEquipment.filter(eq => {
        const status = eq.display_status || eq.status;
        if (status === 'Written Off' || status === 'Returned') return false;

        const matchesSearch = !search ||
                             eq.name.toLowerCase().includes(search) ||
                             (eq.serial_number && eq.serial_number.toLowerCase().includes(search)) ||
                             (eq.barcode && String(eq.barcode).toLowerCase().includes(search)) ||
                             (eq.auto_serial_number && eq.auto_serial_number.toLowerCase().includes(search)) ||
                             (eq.assigned_to_name && eq.assigned_to_name.toLowerCase().includes(search)) ||
                             (eq.purchase_order_number && eq.purchase_order_number.toLowerCase().includes(search)) ||
                             (eq.location_name && eq.location_name.toLowerCase().includes(search)) ||
                             (eq.country_name && eq.country_name.toLowerCase().includes(search)) ||
                             (eq.sub_location_name && eq.sub_location_name.toLowerCase().includes(search)) ||
                             (eq.business_type_name && eq.business_type_name.toLowerCase().includes(search)) ||
                             (eq.owner_name && eq.owner_name.toLowerCase().includes(search)) ||
                             (eq.category && eq.category.toLowerCase().includes(search)) ||
                             (eq.brand && eq.brand.toLowerCase().includes(search)) ||
                             (eq.model && eq.model.toLowerCase().includes(search)) ||
                             (eq.transfer_assigned_history && eq.transfer_assigned_history.toLowerCase().includes(search)) ||
                             (eq.write_off_history && eq.write_off_history.toLowerCase().includes(search)) ||
                             (eq.comments && eq.comments.toLowerCase().includes(search));
        if (!matchesSearch) return false;

        for (const col of EQUIPMENT_HEADER_FILTER_COLS) {
            const state = equipmentHeaderFilterState[col];
            if (state && state.selected.size < state.allValues.length) {
                const val = getEquipmentColumnValue(eq, col);
                if (!state.selected.has(val)) return false;
            }
        }
        return true;
    });
}

function clearEquipmentFilters() {
    const searchInput = document.getElementById('equipment-search');
    if (searchInput) searchInput.value = '';
    EQUIPMENT_HEADER_FILTER_COLS.forEach(col => {
        if (equipmentHeaderFilterState[col]) {
            equipmentHeaderFilterState[col].allValues = [...new Set(allEquipment.map(eq => getEquipmentColumnValue(eq, col)))].sort();
            equipmentHeaderFilterState[col].selected = new Set(equipmentHeaderFilterState[col].allValues);
        }
        renderEquipmentHeaderFilterCheckboxes(col);
        updateEquipmentHeaderFilterIcon(col);
    });
    unlockColumnWidths('#equipment-table');
    filterEquipment();
    lockColumnWidths('#equipment-table');
}

function renderEquipmentRow(eq, serial, total) {
    const barcodeDisplay = (typeof eq.barcode === 'object' || eq.barcode === '[object Object]') ? '-' : (eq.barcode || '-');
    const status = eq.display_status || eq.status;
    const nextPMDate = eq.next_pm_date ? new Date(eq.next_pm_date) : null;
    const pmTypeLabels = { 'daily': 'Daily', 'weekly': 'Weekly', 'monthly': 'Monthly', 'quarterly': 'Quarterly', 'bi-annually': 'Bi-Annually', 'annually': 'Annually' };
    const nextPMTypeLabel = eq.next_pm_type ? (pmTypeLabels[eq.next_pm_type] || eq.next_pm_type) : '';
    const warning = (status === 'Under Maintenance' || status === 'Written Off') ? { text: '', class: '', approaching: false } : getMaintenanceWarning(nextPMDate);
    const isOverdue = eq.next_pm_overdue || (warning.text && warning.text.startsWith('Overdue'));
    const overdueBadge = isOverdue
        ? ` <button onclick="openMissedPMModal(${eq.id}); event.stopPropagation();" class="ml-1 px-1.5 py-0.5 text-xs rounded bg-red-100 text-red-700 hover:bg-red-200 border border-transparent hover:border-red-300" title="View missed PM schedules">Overdue</button>`
        : '';
    const nextPMDisplay = nextPMDate
        ? `${formatDate(nextPMDate)}${nextPMTypeLabel ? ' <span class="text-xs text-gray-400">(' + nextPMTypeLabel + ')</span>' : ''}${overdueBadge}${(!overdueBadge && warning.approaching) ? ' <span class="ml-1 px-1.5 py-0.5 text-xs rounded ' + warning.class + '">' + warning.text + '</span>' : ''}`
        : '-';
    let cellClass = '';
    if (status === 'Pending Write Off') {
        cellClass = 'bg-orange-100';
    } else if (status === 'Under Maintenance') {
        cellClass = 'bg-blue-100';
    }
    return `
        <tr>
            <td data-col="serial" class="px-3 py-2 whitespace-nowrap text-gray-500 text-xs ${cellClass}">${serial}</td>
            <td data-col="actions" class="px-3 py-2 whitespace-nowrap ${cellClass}">
                <button onclick="viewEquipment(${eq.id})" class="text-green-600 hover:text-green-800 mr-2" title="View">
                    <i class="fas fa-eye"></i>
                </button>
                ${getEditActionButton('equipment', 'editEquipment', eq.id)}
                ${getAddActionButton('equipment', `<button onclick="copyEquipment(${eq.id})" class="text-teal-600 hover:text-teal-800 mr-2" title="Copy to new"><i class="fas fa-copy"></i></button>`)}
                ${getDeleteActionButton('equipment', 'deleteEquipment', eq.id)}
            </td>
            <td data-col="auto_serial" class="px-3 py-2 whitespace-nowrap ${cellClass}">${eq.auto_serial_number || '-'}</td>
            <td data-col="thumbnail" class="px-3 py-2 whitespace-nowrap ${cellClass}">
                ${eq.thumbnail_photo ? `<img src="${eq.thumbnail_photo}" loading="lazy" onclick="openEquipmentPhotoLightbox(${eq.id}, '${eq.thumbnail_photo}')" class="w-8 h-8 rounded object-cover inline-block align-middle border bg-gray-50 cursor-pointer hover:opacity-80">` : `<span class="w-8 h-8 rounded bg-gray-100 inline-flex items-center justify-center align-middle text-gray-400 text-xs"><i class="fas fa-image"></i></span>`}
            </td>
            <td data-col="name" class="px-3 py-2 whitespace-nowrap ${cellClass}">${eq.name}</td>
            <td data-col="brand" class="px-3 py-2 whitespace-nowrap ${cellClass}" style="display:none">${eq.brand || '-'}</td>
            <td data-col="model" class="px-3 py-2 whitespace-nowrap ${cellClass}" style="display:none">${eq.model || '-'}</td>
            <td data-col="barcode" class="px-3 py-2 whitespace-nowrap ${cellClass}">${barcodeDisplay}</td>
            <td data-col="serial_number" class="px-3 py-2 whitespace-nowrap ${cellClass}">${eq.serial_number || '-'}</td>
            <td data-col="category" class="px-3 py-2 whitespace-nowrap ${cellClass}">${eq.category || '-'}</td>
            <td data-col="specification" class="px-3 py-2 max-w-40 truncate ${cellClass}" style="display:none" title="${eq.specification || ''}">${eq.specification || '-'}</td>
            <td data-col="condition" class="px-3 py-2 whitespace-nowrap ${cellClass}" style="display:none">${eq.condition || '-'}</td>
            <td data-col="po_number" class="px-3 py-2 whitespace-nowrap ${cellClass}">${eq.purchase_order_number || '-'}</td>
            <td data-col="country" class="px-3 py-2 whitespace-nowrap ${cellClass}">${eq.country_name || '-'}</td>
            <td data-col="location" class="px-3 py-2 whitespace-nowrap ${cellClass}">${eq.location_name || '-'}</td>
            <td data-col="sublocation_business_type" class="px-3 py-2 max-w-40 truncate ${cellClass}" title="${(eq.sub_location_name || '') + ' / ' + (eq.business_type_name || '') + ' / ' + (eq.business_unit_code || '')}">${(eq.sub_location_name && eq.business_type_name ? eq.sub_location_name + ' - ' + eq.business_type_name : eq.sub_location_name || eq.business_type_name || eq.business_unit_code || '-')}</td>
            <td data-col="status" class="px-3 py-2 whitespace-nowrap ${cellClass} ${getEquipmentStatusTextColor(eq.display_status || eq.status)}">
                ${eq.display_status || eq.status}
            </td>
            <td data-col="owner" class="px-3 py-2 whitespace-nowrap ${cellClass}">${eq.owner_name || '-'}</td>
            <td data-col="assigned_to" class="px-3 py-2 whitespace-nowrap ${cellClass}">${eq.assigned_to_name || '-'}</td>
            <td data-col="price" class="px-3 py-2 whitespace-nowrap ${cellClass}" style="display:none">${eq.price || '-'}</td>
            <td data-col="other_charges" class="px-3 py-2 whitespace-nowrap ${cellClass}" style="display:none">${eq.other_charges || '-'}</td>
            <td data-col="purchase_cost" class="px-3 py-2 whitespace-nowrap ${cellClass}" style="display:none">${eq.purchase_cost || '-'}</td>
            <td data-col="purchase_date" class="px-3 py-2 whitespace-nowrap ${cellClass}" style="display:none">${formatDate(eq.purchase_date)}</td>
            <td data-col="warranty_expiry" class="px-3 py-2 whitespace-nowrap ${cellClass}" style="display:none">${formatDate(eq.warranty_expiry)}</td>
            <td data-col="next_pm" class="px-3 py-2 whitespace-nowrap ${cellClass}">${nextPMDisplay}</td>
            <td data-col="maintenance_status" class="px-3 py-2 whitespace-nowrap ${cellClass}">${eq.maintenance_status ? `<span class="px-2 py-0.5 text-xs rounded-full ${getMaintenanceStatusColor(eq.maintenance_status)}">${eq.maintenance_status}</span>` : '-'}</td>
            <td data-col="comments" class="px-3 py-2 max-w-40 truncate ${cellClass}" style="display:none" title="${eq.comments || ''}">${eq.comments || '-'}</td>
        </tr>
    `;
}

function filterEquipment() {
    const searchInput = document.getElementById('equipment-search');
    const clearBtn = document.getElementById('equipment-clear-filters-btn');
    const hasSearch = searchInput && searchInput.value && searchInput.value.trim() !== '';
    const hasHeaderFilter = EQUIPMENT_HEADER_FILTER_COLS.some(col => {
        const state = equipmentHeaderFilterState[col];
        return state && state.selected.size < state.allValues.length;
    });
    const hasFilter = hasSearch || hasHeaderFilter;
    if (searchInput) {
        if (hasSearch) {
            searchInput.classList.add('border-yellow-400', 'bg-yellow-100', 'filter-active-blink');
        } else {
            searchInput.classList.remove('border-yellow-400', 'bg-yellow-100', 'filter-active-blink');
        }
    }
    if (clearBtn) {
        if (hasFilter) {
            clearBtn.classList.add('border-yellow-400', 'bg-yellow-100', 'text-yellow-700', 'filter-active-blink');
        } else {
            clearBtn.classList.remove('border-yellow-400', 'bg-yellow-100', 'text-yellow-700', 'filter-active-blink');
        }
    }
    const filtered = getFilteredEquipment();
    const tbody = document.getElementById('equipment-table-body');
    const total = filtered.length;
    updateEquipmentSerialHeader(total);
    tbody.innerHTML = filtered.map((eq, index) => {
        const serial = index + 1;
        return renderEquipmentRow(eq, serial, total);
    }).join('');
    if (typeof applyEquipmentColumnVisibility === 'function') applyEquipmentColumnVisibility();
    if (typeof applyEquipmentFreeze === 'function') applyEquipmentFreeze();
}

function updateEquipmentSerialHeader(count) {
    const th = document.getElementById('equipment-serial-header');
    if (th) th.textContent = `# (${count})`;
}

// Uniform warehouse management

async function loadUniformItems() {
    showTableLoading('uniform-items-table-body', 'Loading uniform items...');
    try {
        const response = await fetch(`${API_BASE}/uniform-items`);
        allUniformItems = await response.json();
        renderUniformItems();
        populateUniformItemSelects();
        renderUniformItemColumnCheckboxes();
    } catch (error) {
        console.error('Error loading uniform items:', error);
        showTableError('uniform-items-table-body', 'Error loading uniform items.');
    }
}

function filterUniformItems() {
    const term = (document.getElementById('uniform-items-search')?.value || '').toLowerCase();
    const filtered = allUniformItems.filter(item =>
        (item.name || '').toLowerCase().includes(term) ||
        (item.size || '').toLowerCase().includes(term) ||
        (item.color || '').toLowerCase().includes(term) ||
        (item.notes || '').toLowerCase().includes(term)
    );
    renderUniformItems(filtered);
}

const UNIFORM_ITEM_COLUMNS = [
    { key: 'num', label: '#' },
    { key: 'name', label: 'Item' },
    { key: 'size', label: 'Size' },
    { key: 'color', label: 'Color' },
    { key: 'notes', label: 'Notes' },
    { key: 'stock', label: 'Stock' },
    { key: 'actions', label: 'Actions' }
];

let uniformItemColumnVisibility = {};

function getUniformItemColumnValue(item, key, index) {
    switch (key) {
        case 'num': return index + 1;
        case 'name': return item.name || '-';
        case 'size': return item.size || '-';
        case 'color': return item.color || '-';
        case 'notes': return item.notes || '-';
        case 'stock': return item.current_stock;
        case 'actions': return null;
        default: return '-';
    }
}

function getActiveUniformItemColumns() {
    const serverRestr = (typeof serverColumnVisibility !== 'undefined' && serverColumnVisibility['items']) || {};
    return UNIFORM_ITEM_COLUMNS.filter(col => {
        if (serverRestr[col.key] !== undefined && !serverRestr[col.key]) return false;
        return uniformItemColumnVisibility[col.key] !== false;
    });
}

function renderUniformItemTableHead() {
    const thead = document.getElementById('uniform-items-table-head');
    if (!thead) return;
    const activeCols = getActiveUniformItemColumns();
    thead.innerHTML = `<tr>${activeCols.map(col => `<th class="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">${col.label}</th>`).join('')}</tr>`;
}

function renderUniformItemColumnCheckboxes() {
    const container = document.getElementById('uniform-item-column-checkboxes');
    if (!container) return;
    const serverRestr = (typeof serverColumnVisibility !== 'undefined' && serverColumnVisibility['items']) || {};
    container.innerHTML = UNIFORM_ITEM_COLUMNS.map(col => {
        const serverHidden = serverRestr[col.key] !== undefined && !serverRestr[col.key];
        return `
        <label class="flex items-center gap-2 text-sm ${serverHidden ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}">
            <input type="checkbox" ${uniformItemColumnVisibility[col.key] !== false ? 'checked' : ''} ${serverHidden ? 'disabled' : ''} onchange="toggleUniformItemColumn('${col.key}')" class="rounded">
            <span>${col.label}${serverHidden ? ' <span class="text-xs text-red-500">(locked)</span>' : ''}</span>
        </label>`;
    }).join('');
}

function toggleUniformItemColumn(key) {
    uniformItemColumnVisibility[key] = uniformItemColumnVisibility[key] === false ? true : false;
    renderUniformItemTableHead();
    renderUniformItems();
}

function toggleUniformItemColumnSettings() {
    const panel = document.getElementById('uniform-item-column-settings');
    if (panel) panel.classList.toggle('hidden');
}

function resetUniformItemColumns() {
    uniformItemColumnVisibility = {};
    renderUniformItemColumnCheckboxes();
    renderUniformItemTableHead();
    renderUniformItems();
}

function renderUniformItems(items) {
    const data = items || allUniformItems;
    const tbody = document.getElementById('uniform-items-table-body');
    const activeCols = getActiveUniformItemColumns();
    renderUniformItemTableHead();
    tbody.innerHTML = data.map((item, i) => {
        const cells = activeCols.map(col => {
            if (col.key === 'actions') {
                return `<td class="px-3 py-1 whitespace-nowrap"><button onclick="viewUniformItem(${item.id})" class="text-green-600 hover:text-green-800 mr-2" title="View"><i class="fas fa-eye"></i></button>${getEditActionButton('uniforms', 'editUniformItem', item.id)}${getDeleteActionButton('uniforms', 'deleteUniformItem', item.id)}</td>`;
            }
            if (col.key === 'stock') {
                return `<td class="px-3 py-1 whitespace-nowrap"><span class="${item.current_stock <= item.minimum_stock ? 'text-red-600 font-bold' : ''}">${item.current_stock}</span></td>`;
            }
            if (col.key === 'num') {
                return `<td class="px-3 py-1 whitespace-nowrap text-gray-400">${i + 1}</td>`;
            }
            const val = getUniformItemColumnValue(item, col.key, i);
            return `<td class="px-3 py-1 whitespace-nowrap">${val}</td>`;
        }).join('');
        return `<tr>${cells}</tr>`;
    }).join('');
}

function viewUniformItem(itemId) {
    const item = allUniformItems.find(i => i.id == itemId);
    if (!item) return;
    const totalPurchased = item.total_purchased || 0;
    const totalDistributed = item.total_distributed || 0;
    const currentStock = item.current_stock || 0;

    const content = `
        <div class="mb-4 grid grid-cols-2 gap-4 text-sm">
            <div><span class="font-semibold text-gray-600">Item:</span> ${item.name || '-'}</div>
            <div><span class="font-semibold text-gray-600">Category:</span> ${item.category || '-'}</div>
            <div><span class="font-semibold text-gray-600">Size:</span> ${item.size || '-'}</div>
            <div><span class="font-semibold text-gray-600">Color:</span> ${item.color || '-'}</div>
            <div><span class="font-semibold text-gray-600">Gender:</span> ${item.gender || '-'}</div>
            <div><span class="font-semibold text-gray-600">Location:</span> ${item.location_name || '-'}</div>
            <div><span class="font-semibold text-gray-600">Notes:</span> ${item.notes || '-'}</div>
        </div>
        <div class="overflow-x-auto">
            <table class="w-full text-sm border rounded-lg">
                <thead class="bg-gray-100">
                    <tr>
                        <th class="px-4 py-2 text-left">Total Purchased</th>
                        <th class="px-4 py-2 text-left">Total Distributed</th>
                        <th class="px-4 py-2 text-left">Current Stock</th>
                        <th class="px-4 py-2 text-left">Minimum Stock</th>
                    </tr>
                </thead>
                <tbody class="divide-y divide-gray-200">
                    <tr>
                        <td class="px-4 py-2 font-semibold text-blue-700">${totalPurchased}</td>
                        <td class="px-4 py-2 font-semibold text-orange-700">${totalDistributed}</td>
                        <td class="px-4 py-2 font-semibold ${currentStock <= (item.minimum_stock || 0) ? 'text-red-600' : 'text-green-700'}">${currentStock}</td>
                        <td class="px-4 py-2">${item.minimum_stock || 0}</td>
                    </tr>
                </tbody>
            </table>
        </div>`;

    document.getElementById('uniform-item-view-content').innerHTML = content;
    document.getElementById('uniform-item-view-modal').classList.add('active');
}

function closeUniformItemViewModal() {
    const modal = document.getElementById('uniform-item-view-modal');
    if (modal) modal.classList.remove('active');
}

let uniformSuppliers = [];

async function loadUniformSuppliers() {
    try {
        const response = await fetch(`${API_BASE}/suppliers`);
        uniformSuppliers = await response.json();
    } catch (error) {
        console.error('Error loading suppliers:', error);
    }
}

function populateUniformSupplierSelect(selectId) {
    const select = document.getElementById(selectId);
    if (select) {
        select.innerHTML = '<option value="">Select Supplier</option>' +
            uniformSuppliers.map(s => `<option value="${s.id}">${s.name}</option>`).join('');
    }
}

function populateUniformItemSelects() {
    const selects = ['uniform-purchase-item', 'uniform-distribution-item'];
    
    selects.forEach(selectId => {
        const select = document.getElementById(selectId);
        if (select) {
            select.innerHTML = '<option value="">Select Item</option>' + 
                allUniformItems.map(item => `<option value="${item.id}">${item.name} (${item.size || 'N/A'}${item.color ? ' - ' + item.color : ''})</option>`).join('');
        }
    });
}

async function populateUniformItemModalDropdowns() {
    if (!allUniformTypes || allUniformTypes.length === 0) {
        try {
            const res = await fetch(`${API_BASE}/uniform-types`);
            allUniformTypes = await res.json();
        } catch (e) { console.error('Error loading uniform types:', e); }
    }
    if (!allUniformSizes || allUniformSizes.length === 0) {
        try {
            const res = await fetch(`${API_BASE}/uniform-sizes`);
            allUniformSizes = await res.json();
        } catch (e) { console.error('Error loading uniform sizes:', e); }
    }
    const itemSelect = document.getElementById('uniform-item-name');
    const sizeSelect = document.getElementById('uniform-item-size');
    if (itemSelect) {
        itemSelect.innerHTML = '<option value="">Select Item</option>' +
            (allUniformTypes || []).map(t => `<option value="${t.name}">${t.name}</option>`).join('');
    }
    if (sizeSelect) {
        sizeSelect.innerHTML = '<option value="">Select Size</option>' +
            (allUniformSizes || []).map(s => `<option value="${s.name}">${s.name}</option>`).join('');
    }
}

async function openUniformItemModal(id = null) {
    const modal = document.getElementById('uniform-item-modal');
    const form = document.getElementById('uniform-item-form');
    const title = document.getElementById('uniform-item-modal-title');
    
    form.reset();
    document.getElementById('uniform-item-id').value = '';
    await populateUniformItemModalDropdowns();
    
    if (id) {
        const item = allUniformItems.find(i => i.id == id);
        if (item) {
            title.textContent = 'Edit Uniform Item';
            document.getElementById('uniform-item-id').value = item.id;
            document.getElementById('uniform-item-name').value = item.name;
            document.getElementById('uniform-item-size').value = item.size || '';
            document.getElementById('uniform-item-color').value = item.color || '';
            document.getElementById('uniform-item-notes').value = item.notes || '';
        }
    } else {
        title.textContent = 'Add Uniform Item';
    }
    
    modal.classList.add('active');
}

function closeUniformItemModal() {
    document.getElementById('uniform-item-modal').classList.remove('active');
}

async function saveUniformItem(e) {
    e.preventDefault();
    const id = document.getElementById('uniform-item-id').value;
    const itemName = document.getElementById('uniform-item-name').value;
    const data = {
        name: itemName,
        category: '',
        size: document.getElementById('uniform-item-size').value,
        gender: 'unisex',
        current_stock: 0,
        minimum_stock: 0,
        location_id: null,
        color: document.getElementById('uniform-item-color').value,
        notes: document.getElementById('uniform-item-notes').value
    };
    
    try {
        const url = id ? `${API_BASE}/uniform-items/${id}?manager_id=${currentModuleManager ? currentModuleManager.id : ''}` : `${API_BASE}/uniform-items`;
        const method = id ? 'PUT' : 'POST';
        
        const response = await fetch(url, {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        
        if (response.ok) {
            const action = id ? 'UPDATE' : 'CREATE';
            await logAudit(action, 'uniforms', 'Uniform Item', id || response.json().then(r => r.id), `Uniform Item: ${itemName}`);
            closeUniformItemModal();
            loadUniformItems();
        }
    } catch (error) {
        console.error('Error saving uniform item:', error);
    }
}

async function deleteUniformItem(id) {
    if (!currentModuleManager) {
        alert('Please select a module manager.');
        return;
    }
    const item = allUniformItems.find(i => i.id === id);
    if (confirm('Are you sure you want to delete this uniform item?')) {
        try {
            const response = await fetch(`${API_BASE}/uniform-items/${id}?manager_id=${currentModuleManager.id}`, { method: 'DELETE' });
            if (response.ok) {
                await logAudit('DELETE', 'uniforms', 'Uniform Item', id, `Uniform Item: ${item?.name || 'Unknown'}`);
                loadUniformItems();
                loadDashboardStats();
            }
        } catch (error) {
            console.error('Error deleting uniform item:', error);
        }
    }
}

function editUniformItem(id) {
    openUniformItemModal(id);
}

let allUniformPurchases = [];

async function loadUniformPurchases() {
    showTableLoading('uniform-purchases-table-body', 'Loading uniform purchases...');
    try {
        const response = await fetch(`${API_BASE}/uniform-purchases`);
        allUniformPurchases = await response.json();
        renderUniformPurchases(allUniformPurchases);
        renderUniformPurchaseColumnCheckboxes();
    } catch (error) {
        console.error('Error loading uniform purchases:', error);
        showTableError('uniform-purchases-table-body', 'Error loading uniform purchases.');
    }
}

function filterUniformPurchases() {
    const term = (document.getElementById('uniform-purchases-search')?.value || '').toLowerCase();
    const filtered = allUniformPurchases.filter(p =>
        (p.item_name || '').toLowerCase().includes(term) ||
        (p.supplier_name || '').toLowerCase().includes(term)
    );
    renderUniformPurchases(filtered);
}

const UNIFORM_PURCHASE_COLUMNS = [
    { key: 'num', label: '#' },
    { key: 'item_name', label: 'Item' },
    { key: 'item_size', label: 'Size' },
    { key: 'item_color', label: 'Color' },
    { key: 'supplier_name', label: 'Supplier' },
    { key: 'totalQty', label: 'Quantity' },
    { key: 'totalCost', label: 'Total Cost' },
    { key: 'invoice', label: 'Invoice' },
    { key: 'purchaseCount', label: 'Purchases' },
    { key: 'country_name', label: 'Country' },
    { key: 'bta_location_name', label: 'Location' },
    { key: 'subLoc', label: 'Sublocation' },
    { key: 'actions', label: 'Actions' }
];

let uniformPurchaseColumnVisibility = {};

function getActiveUniformPurchaseColumns() {
    const serverRestr = (typeof serverColumnVisibility !== 'undefined' && serverColumnVisibility['purchases']) || {};
    return UNIFORM_PURCHASE_COLUMNS.filter(col => {
        if (serverRestr[col.key] !== undefined && !serverRestr[col.key]) return false;
        return uniformPurchaseColumnVisibility[col.key] !== false;
    });
}

function getUniformPurchaseColumnValue(g, key, index) {
    const subLocStr = g.subLocParts.length ? g.subLocParts.join(' - ') : '-';
    switch (key) {
        case 'num': return index + 1;
        case 'item_name': return g.item_name || '-';
        case 'item_size': return g.item_size || '-';
        case 'item_color': return g.item_color || '-';
        case 'supplier_name': return g.supplier_name || '-';
        case 'totalQty': return `<span class="font-semibold">${g.totalQty}</span>`;
        case 'totalCost': return `$${g.totalCost.toFixed(2)}`;
        case 'invoice': return g.invoiceNumbers || '-';
        case 'purchaseCount': return `${g.purchases.length} purchase(s)`;
        case 'country_name': return g.country_name || '-';
        case 'bta_location_name': return g.bta_location_name || '-';
        case 'subLoc': return subLocStr;
        default: return '-';
    }
}

function renderUniformPurchaseTableHead() {
    const thead = document.getElementById('uniform-purchases-table-head');
    if (!thead) return;
    const activeCols = getActiveUniformPurchaseColumns();
    thead.innerHTML = `<tr>${activeCols.map(col => `<th class="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">${col.label}</th>`).join('')}</tr>`;
}

function renderUniformPurchaseColumnCheckboxes() {
    const container = document.getElementById('uniform-purchase-column-checkboxes');
    if (!container) return;
    const serverRestr = (typeof serverColumnVisibility !== 'undefined' && serverColumnVisibility['purchases']) || {};
    container.innerHTML = UNIFORM_PURCHASE_COLUMNS.map(col => {
        const serverHidden = serverRestr[col.key] !== undefined && !serverRestr[col.key];
        return `
        <label class="flex items-center gap-2 text-sm ${serverHidden ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}">
            <input type="checkbox" ${uniformPurchaseColumnVisibility[col.key] !== false ? 'checked' : ''} ${serverHidden ? 'disabled' : ''} onchange="toggleUniformPurchaseColumn('${col.key}')" class="rounded">
            <span>${col.label}${serverHidden ? ' <span class="text-xs text-red-500">(locked)</span>' : ''}</span>
        </label>`;
    }).join('');
}

function toggleUniformPurchaseColumn(key) {
    uniformPurchaseColumnVisibility[key] = uniformPurchaseColumnVisibility[key] === false ? true : false;
    renderUniformPurchaseTableHead();
    renderUniformPurchases(allUniformPurchases);
}

function toggleUniformPurchaseColumnSettings() {
    const panel = document.getElementById('uniform-purchase-column-settings');
    if (panel) panel.classList.toggle('hidden');
}

function resetUniformPurchaseColumns() {
    uniformPurchaseColumnVisibility = {};
    renderUniformPurchaseColumnCheckboxes();
    renderUniformPurchaseTableHead();
    renderUniformPurchases(allUniformPurchases);
}

function renderUniformPurchases(purchases) {
    const tbody = document.getElementById('uniform-purchases-table-body');
    const grouped = {};
    purchases.forEach(p => {
        const key = p.item_id;
        if (!grouped[key]) {
            grouped[key] = {
                item_id: p.item_id,
                item_name: p.item_name,
                item_size: p.item_size,
                item_color: p.item_color,
                supplier_name: p.supplier_name,
                country_name: p.country_name,
                bta_location_name: p.bta_location_name,
                subLocParts: [p.sub_location_name, p.business_type_name, p.business_unit_code].filter(Boolean),
                totalQty: 0,
                totalCost: 0,
                purchases: [],
                invoiceNumbers: []
            };
        }
        grouped[key].totalQty += p.quantity;
        grouped[key].totalCost += parseFloat(p.total_cost || 0);
        grouped[key].purchases.push(p);
        if (p.invoice_number) grouped[key].invoiceNumbers.push(p.invoice_number);
    });
    const activeCols = getActiveUniformPurchaseColumns();
    renderUniformPurchaseTableHead();
    tbody.innerHTML = Object.values(grouped).map((g, i) => {
        g.invoiceNumbers = [...new Set(g.invoiceNumbers)].join(', ');
        const cells = activeCols.map(col => {
            if (col.key === 'actions') {
                return `<td class="px-3 py-1 whitespace-nowrap"><button onclick="viewUniformPurchase(${g.item_id})" class="text-green-600 hover:text-green-800 mr-2" title="View History"><i class="fas fa-eye"></i></button><button onclick="addMoreUniformPurchaseByItem(${g.item_id})" class="text-blue-600 hover:text-blue-800 mr-2" title="Add More"><i class="fas fa-plus"></i></button></td>`;
            }
            const val = getUniformPurchaseColumnValue(g, col.key, i);
            return `<td class="px-3 py-1 whitespace-nowrap">${val}</td>`;
        }).join('');
        return `<tr>${cells}</tr>`;
    }).join('');
}

function calcUniformPurchaseTotalCost() {
    const qty = parseFloat(document.getElementById('uniform-purchase-quantity')?.value) || 0;
    const price = parseFloat(document.getElementById('uniform-purchase-unit-price')?.value) || 0;
    const total = (qty * price).toFixed(2);
    const totalInput = document.getElementById('uniform-purchase-total-cost');
    if (totalInput) totalInput.value = total;
}

async function openUniformPurchaseModal() {
    const modal = document.getElementById('uniform-purchase-modal');
    const form = document.getElementById('uniform-purchase-form');
    form.reset();
    delete form.dataset.editId;
    document.getElementById('uniform-purchase-date').value = new Date().toISOString().split('T')[0];
    await loadUniformSuppliers();
    populateUniformSupplierSelect('uniform-purchase-supplier');
    populateUniformPurchaseItemSelect();
    await ensureCascadingLocationData();
    populateCascadingCountrySelect('uniform-purchase-country');
    const title = document.querySelector('#uniform-purchase-modal h3');
    if (title) title.textContent = 'Add Uniform Purchase';
    const submitBtn = document.querySelector('#uniform-purchase-form button[type=submit]');
    if (submitBtn) submitBtn.textContent = 'Save';
    modal.classList.add('active');
}

function populateUniformPurchaseItemSelect() {
    const select = document.getElementById('uniform-purchase-item');
    if (!select) return;
    const purchasedItemIds = new Set(allUniformPurchases.map(p => String(p.item_id)));
    const available = allUniformItems.filter(item => !purchasedItemIds.has(String(item.id)));
    if (available.length === 0) {
        select.innerHTML = '<option value="">All items already have purchases</option>';
    } else {
        select.innerHTML = '<option value="">Select Item</option>' +
            available.map(item => `<option value="${item.id}">${item.name} (${item.size || 'N/A'}${item.color ? ' - ' + item.color : ''})</option>`).join('');
    }
}

function closeUniformPurchaseModal() {
    document.getElementById('uniform-purchase-modal').classList.remove('active');
}

async function editUniformPurchase(id) {
    const purchase = allUniformPurchases.find(p => p.id == id);
    if (!purchase) return;
    closeUniformPurchaseViewModal();
    const modal = document.getElementById('uniform-purchase-modal');
    const form = document.getElementById('uniform-purchase-form');
    form.reset();
    document.getElementById('uniform-purchase-item').value = purchase.item_id;
    await loadUniformSuppliers();
    populateUniformSupplierSelect('uniform-purchase-supplier');
    document.getElementById('uniform-purchase-supplier').value = purchase.supplier_id || '';
    document.getElementById('uniform-purchase-quantity').value = purchase.quantity;
    document.getElementById('uniform-purchase-unit-price').value = purchase.unit_price;
    calcUniformPurchaseTotalCost();
    document.getElementById('uniform-purchase-date').value = purchase.purchase_date || '';
    document.getElementById('uniform-purchase-invoice').value = purchase.invoice_number || '';
    await ensureCascadingLocationData();
    populateCascadingCountrySelect('uniform-purchase-country');
    if (purchase.business_type_assignment_id) {
        await setCascadingLocationByAssignment(purchase.business_type_assignment_id, 'uniform-purchase-country', 'uniform-purchase-location', 'uniform-purchase-sublocation');
    }
    const title = document.querySelector('#uniform-purchase-modal h3');
    if (title) title.textContent = 'Edit Uniform Purchase';
    const submitBtn = document.querySelector('#uniform-purchase-form button[type=submit]');
    if (submitBtn) submitBtn.textContent = 'Update';
    modal.classList.add('active');
    form.dataset.editId = id;
}

async function addMoreUniformPurchase(id) {
    const purchase = allUniformPurchases.find(p => p.id == id);
    if (!purchase) return;
    const modal = document.getElementById('uniform-purchase-modal');
    const form = document.getElementById('uniform-purchase-form');
    form.reset();
    const itemSelect = document.getElementById('uniform-purchase-item');
    const item = allUniformItems.find(i => i.id == purchase.item_id);
    if (itemSelect && item) {
        itemSelect.innerHTML = `<option value="${item.id}" selected>${item.name} (${item.size || 'N/A'}${item.color ? ' - ' + item.color : ''})</option>`;
    }
    await loadUniformSuppliers();
    populateUniformSupplierSelect('uniform-purchase-supplier');
    document.getElementById('uniform-purchase-supplier').value = purchase.supplier_id || '';
    document.getElementById('uniform-purchase-quantity').value = '';
    document.getElementById('uniform-purchase-unit-price').value = '';
    document.getElementById('uniform-purchase-total-cost').value = '';
    document.getElementById('uniform-purchase-date').value = new Date().toISOString().split('T')[0];
    document.getElementById('uniform-purchase-invoice').value = purchase.invoice_number || '';
    await ensureCascadingLocationData();
    populateCascadingCountrySelect('uniform-purchase-country');
    if (purchase.business_type_assignment_id) {
        await setCascadingLocationByAssignment(purchase.business_type_assignment_id, 'uniform-purchase-country', 'uniform-purchase-location', 'uniform-purchase-sublocation');
    }
    const title = document.querySelector('#uniform-purchase-modal h3');
    if (title) title.textContent = 'Add More - Uniform Purchase';
    const submitBtn = document.querySelector('#uniform-purchase-form button[type=submit]');
    if (submitBtn) submitBtn.textContent = 'Save';
    modal.classList.add('active');
    delete form.dataset.editId;
}

async function addMoreUniformPurchaseByItem(itemId) {
    const purchase = allUniformPurchases.find(p => p.item_id == itemId);
    if (!purchase) return;
    await addMoreUniformPurchase(purchase.id);
}

async function deleteUniformPurchase(id) {
    if (!currentModuleManager) {
        alert('Please select a module manager.');
        return;
    }
    const purchase = allUniformPurchases.find(p => p.id == id);
    if (confirm('Are you sure you want to delete this uniform purchase? Stock will be adjusted.')) {
        try {
            const response = await fetch(`${API_BASE}/uniform-purchases/${id}?manager_id=${currentModuleManager.id}`, { method: 'DELETE' });
            if (response.ok) {
                await logAudit('DELETE', 'uniforms', 'Purchase', id, `Purchase: ${purchase?.quantity || 0} units of ${purchase?.item_name || 'Unknown'}`);
                await loadUniformPurchases();
                loadUniformItems();
                loadDashboardStats();
                const modal = document.getElementById('uniform-purchase-view-modal');
                if (modal && modal.classList.contains('active') && purchase) {
                    viewUniformPurchase(purchase.item_id);
                }
            }
        } catch (error) {
            console.error('Error deleting uniform purchase:', error);
        }
    }
}

async function saveUniformPurchase(e) {
    e.preventDefault();
    const itemId = document.getElementById('uniform-purchase-item').value;
    const item = allUniformItems.find(i => i.id == itemId);
    const supplierSelect = document.getElementById('uniform-purchase-supplier');
    const supplierId = supplierSelect.value;
    const supplierName = supplierSelect.selectedOptions[0]?.text || '';
    const sublocationId = document.getElementById('uniform-purchase-sublocation').value;
    const assignment = window.allBusinessTypeAssignments ? window.allBusinessTypeAssignments.find(a => a.id == sublocationId) : null;
    const data = {
        item_id: itemId,
        supplier_id: supplierId,
        supplier_name: supplierName,
        quantity: parseInt(document.getElementById('uniform-purchase-quantity').value),
        unit_price: parseFloat(document.getElementById('uniform-purchase-unit-price').value),
        total_cost: parseFloat(document.getElementById('uniform-purchase-total-cost').value),
        purchase_date: document.getElementById('uniform-purchase-date').value,
        invoice_number: document.getElementById('uniform-purchase-invoice').value,
        location_id: assignment ? assignment.location_id : null,
        business_type_assignment_id: sublocationId || null
    };
    
    const form = document.getElementById('uniform-purchase-form');
    const editId = form.dataset.editId;
    
    try {
        const url = editId ? `${API_BASE}/uniform-purchases/${editId}?manager_id=${currentModuleManager ? currentModuleManager.id : ''}` : `${API_BASE}/uniform-purchases`;
        const method = editId ? 'PUT' : 'POST';
        const response = await fetch(url, {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        
        if (response.ok) {
            const action = editId ? 'UPDATE' : 'CREATE';
            await logAudit(action, 'uniforms', 'Purchase', editId || null, `Purchase: ${data.quantity} units of ${item?.name || 'Unknown'}`);
            closeUniformPurchaseModal();
            loadUniformPurchases();
            loadUniformItems();
        }
    } catch (error) {
        console.error('Error saving uniform purchase:', error);
    }
}

let allUniformDistributions = [];

async function loadUniformDistributions() {
    showTableLoading('uniform-distributions-table-body', 'Loading uniform distributions...');
    try {
        const response = await fetch(`${API_BASE}/uniform-distributions`);
        allUniformDistributions = await response.json();
        renderUniformDistributions(allUniformDistributions);
    } catch (error) {
        console.error('Error loading uniform distributions:', error);
        showTableError('uniform-distributions-table-body', 'Error loading uniform distributions.');
    }
}

function filterUniformDistributions() {
    const term = (document.getElementById('uniform-distributions-search')?.value || '').toLowerCase();
    const filtered = allUniformDistributions.filter(d =>
        (d.item_name || '').toLowerCase().includes(term) ||
        (d.staff_name || '').toLowerCase().includes(term)
    );
    renderUniformDistributions(filtered);
}

function renderUniformDistributions(distributions) {
    const tbody = document.getElementById('uniform-distributions-table-body');
    const grouped = {};
    distributions.forEach(d => {
        const key = d.employee_id || ('staff_' + (d.staff_name || 'unknown'));
        if (!grouped[key]) {
            grouped[key] = {
                employee_id: d.employee_id,
                employee_name: d.employee_name || d.staff_name || '-',
                employee_code: d.employee_code || d.staff_id || '',
                department: d.emp_department || d.department || '',
                photo_path: d.photo_path || '',
                country_name: d.country_name || '',
                location_type_name: d.location_type_name || '',
                subLocParts: [d.sub_location_name, d.business_type_name, d.business_unit_code].filter(Boolean),
                items: [],
                totalQty: 0,
                distributions: []
            };
        }
        grouped[key].items.push(`${d.item_name} (${d.quantity})`);
        grouped[key].totalQty += d.quantity;
        grouped[key].distributions.push(d);
    });
    tbody.innerHTML = Object.values(grouped).map((g, i) => {
        const subLocStr = g.subLocParts.length ? g.subLocParts.join(' - ') : '-';
        const itemsStr = g.items.length <= 2 ? g.items.join(', ') : `${g.items.slice(0, 2).join(', ')} ... (+${g.items.length - 2} more)`;
        return `
        <tr>
            <td class="px-3 py-1 whitespace-nowrap text-gray-400">${i + 1}</td>
            <td class="px-3 py-1 whitespace-nowrap">${g.photo_path ? `<img src="${g.photo_path}" class="w-7 h-7 rounded-full object-cover inline-block mr-2 align-middle">` : `<span class="w-7 h-7 rounded-full bg-gray-200 inline-flex items-center justify-center mr-2 align-middle text-gray-500 text-xs"><i class="fas fa-user"></i></span>`}${g.employee_name}</td>
            <td class="px-3 py-1 whitespace-nowrap">${g.country_name || '-'}</td>
            <td class="px-3 py-1 whitespace-nowrap">${g.location_type_name || '-'}</td>
            <td class="px-3 py-1 whitespace-nowrap">${subLocStr}</td>
            <td class="px-3 py-1 whitespace-normal text-xs">${itemsStr}</td>
            <td class="px-3 py-1 whitespace-nowrap">${g.totalQty}</td>
            <td class="px-3 py-1 whitespace-nowrap">
                <button onclick="viewUniformDistribution(${g.employee_id || `'${g.employee_name}'`})" class="text-green-600 hover:text-green-800 mr-2" title="View All"><i class="fas fa-eye"></i></button>
                <button onclick="addUniformDistributionToEmployee(${g.employee_id || 'null'})" class="text-purple-600 hover:text-purple-800 mr-2" title="Add More Items"><i class="fas fa-plus"></i></button>
                <button onclick="deleteUniformDistributionByEmployee(${g.employee_id || `'${g.employee_name}'`})" class="text-red-600 hover:text-red-800" title="Delete All"><i class="fas fa-trash"></i></button>
            </td>
        </tr>`;
    }).join('');
}

function openUniformDistributionModal() {
    const modal = document.getElementById('uniform-distribution-modal');
    document.getElementById('uniform-distribution-form').reset();
    document.getElementById('uniform-distribution-employee').value = '';
    document.getElementById('uniform-distribution-employee-search').value = '';
    document.getElementById('uniform-distribution-staff-name').value = '';
    document.getElementById('uniform-distribution-staff-id').value = '';
    document.getElementById('uniform-distribution-department').value = '';
    document.getElementById('uniform-distribution-employee-results').classList.add('hidden');
    document.getElementById('uniform-distribution-date').value = new Date().toISOString().split('T')[0];
    document.getElementById('uniform-distribution-items-container').innerHTML = '';
    addUniformDistributionItemRow();
    modal.classList.add('active');
}

let uniformDistributionItemRowCount = 0;

function addUniformDistributionItemRow() {
    const container = document.getElementById('uniform-distribution-items-container');
    const rowId = ++uniformDistributionItemRowCount;
    const row = document.createElement('div');
    row.id = `dist-item-row-${rowId}`;
    row.className = 'flex items-start gap-2';
    row.innerHTML = `
        <div class="relative flex-1">
            <input type="hidden" id="dist-item-id-${rowId}">
            <input type="text" id="dist-item-search-${rowId}" placeholder="Search item..." class="w-full px-3 py-1.5 border rounded-lg text-sm" oninput="filterUniformDistributionItems(${rowId})" onfocus="filterUniformDistributionItems(${rowId})">
            <div id="dist-item-results-${rowId}" class="absolute z-50 w-full mt-1 bg-white border rounded-lg shadow-lg max-h-48 overflow-y-auto hidden"></div>
        </div>
        <input type="number" id="dist-item-qty-${rowId}" placeholder="Qty" min="1" required class="w-20 px-3 py-1.5 border rounded-lg text-sm">
        <button type="button" onclick="removeUniformDistributionItemRow(${rowId})" class="px-2 py-1.5 text-red-600 hover:text-red-800 border rounded-lg" title="Remove"><i class="fas fa-trash"></i></button>
    `;
    container.appendChild(row);
}

function removeUniformDistributionItemRow(rowId) {
    const row = document.getElementById(`dist-item-row-${rowId}`);
    if (row) row.remove();
}

function filterUniformDistributionItems(rowId) {
    const term = (document.getElementById(`dist-item-search-${rowId}`)?.value || '').toLowerCase();
    const results = document.getElementById(`dist-item-results-${rowId}`);
    if (!results) return;
    const filtered = (allUniformItems || []).filter(item =>
        (item.name || '').toLowerCase().includes(term) ||
        (item.size || '').toLowerCase().includes(term) ||
        (item.color || '').toLowerCase().includes(term)
    );
    if (filtered.length === 0) {
        results.innerHTML = '<div class="px-3 py-2 text-gray-500 text-sm">No items found</div>';
    } else {
        results.innerHTML = filtered.map(item =>
            `<div class="px-3 py-2 hover:bg-blue-50 cursor-pointer text-sm" onclick="selectUniformDistributionItem(${item.id}, ${rowId})">${item.name} (${item.size || 'N/A'}${item.color ? ' - ' + item.color : ''})</div>`
        ).join('');
    }
    results.classList.remove('hidden');
}

function selectUniformDistributionItem(id, rowId) {
    const item = allUniformItems.find(i => i.id == id);
    if (!item) return;
    document.getElementById(`dist-item-id-${rowId}`).value = id;
    document.getElementById(`dist-item-search-${rowId}`).value = `${item.name} (${item.size || 'N/A'}${item.color ? ' - ' + item.color : ''})`;
    document.getElementById(`dist-item-results-${rowId}`).classList.add('hidden');
}

function filterUniformDistributionEmployees() {
    const term = (document.getElementById('uniform-distribution-employee-search')?.value || '').toLowerCase();
    const results = document.getElementById('uniform-distribution-employee-results');
    if (!results) return;
    const distributedEmpIds = new Set(allUniformDistributions.map(d => String(d.employee_id)).filter(Boolean));
    const filtered = (allEmployees || []).filter(emp =>
        (`${emp.first_name} ${emp.last_name}`).toLowerCase().includes(term) ||
        (emp.employee_id || '').toLowerCase().includes(term) ||
        (emp.department || '').toLowerCase().includes(term)
    );
    if (filtered.length === 0) {
        results.innerHTML = '<div class="px-3 py-2 text-gray-500 text-sm">No employees found</div>';
    } else {
        results.innerHTML = filtered.map(emp => {
            const alreadyDist = distributedEmpIds.has(String(emp.id));
            if (alreadyDist) {
                return `<div class="px-3 py-2 text-gray-400 text-sm cursor-not-allowed" title="Already has distributions">${emp.first_name} ${emp.last_name} (${emp.employee_id || 'No ID'})${emp.department ? ' - ' + emp.department : ''} <span class="text-xs text-gray-400">(already distributed)</span></div>`;
            }
            return `<div class="px-3 py-2 hover:bg-blue-50 cursor-pointer text-sm" onclick="selectUniformDistributionEmployee(${emp.id})">${emp.first_name} ${emp.last_name} (${emp.employee_id || 'No ID'})${emp.department ? ' - ' + emp.department : ''}</div>`;
        }).join('');
    }
    results.classList.remove('hidden');
}

function selectUniformDistributionEmployee(id) {
    const emp = allEmployees.find(e => e.id == id);
    if (!emp) return;
    document.getElementById('uniform-distribution-employee').value = id;
    document.getElementById('uniform-distribution-employee-search').value = `${emp.first_name} ${emp.last_name} (${emp.employee_id || 'No ID'})`;
    document.getElementById('uniform-distribution-staff-name').value = `${emp.first_name} ${emp.last_name}`;
    document.getElementById('uniform-distribution-staff-id').value = emp.employee_id || '';
    document.getElementById('uniform-distribution-department').value = emp.department || '';
    document.getElementById('uniform-distribution-employee-results').classList.add('hidden');
}

document.addEventListener('click', function(e) {
    const empResults = document.getElementById('uniform-distribution-employee-results');
    const empSearch = document.getElementById('uniform-distribution-employee-search');
    if (empResults && !empResults.contains(e.target) && e.target !== empSearch) {
        empResults.classList.add('hidden');
    }
    document.querySelectorAll('[id^="dist-item-results-"]').forEach(el => {
        const searchEl = el.id.replace('results', 'search');
        const searchInput = document.getElementById(searchEl);
        if (!el.contains(e.target) && e.target !== searchInput) {
            el.classList.add('hidden');
        }
    });
});

function closeUniformDistributionModal() {
    document.getElementById('uniform-distribution-modal').classList.remove('active');
}

async function saveUniformDistribution(e) {
    e.preventDefault();
    const employeeId = document.getElementById('uniform-distribution-employee').value;
    if (!employeeId) { alert('Please select an employee.'); return; }
    const emp = allEmployees.find(e => e.id == employeeId);
    if (!emp) { alert('Invalid employee.'); return; }
    const staffName = `${emp.first_name} ${emp.last_name}`;
    const distributionDate = document.getElementById('uniform-distribution-date').value;
    const notes = document.getElementById('uniform-distribution-notes').value;

    const container = document.getElementById('uniform-distribution-items-container');
    const rows = container.querySelectorAll('[id^="dist-item-row-"]');
    if (rows.length === 0) { alert('Please add at least one item.'); return; }

    const items = [];
    for (const row of rows) {
        const rowId = row.id.replace('dist-item-row-', '');
        const itemId = document.getElementById(`dist-item-id-${rowId}`).value;
        const qty = parseInt(document.getElementById(`dist-item-qty-${rowId}`).value);
        if (!itemId) { alert('Please select an item in all rows.'); return; }
        if (!qty || qty < 1) { alert('Please enter a valid quantity in all rows.'); return; }
        items.push({ item_id: itemId, quantity: qty });
    }

    try {
        for (const item of items) {
            const data = {
                item_id: item.item_id,
                employee_id: employeeId,
                staff_name: staffName,
                staff_id: emp.employee_id || '',
                department: emp.department || '',
                quantity: item.quantity,
                distribution_date: distributionDate,
                notes: notes
            };
            const response = await fetch(`${API_BASE}/uniform-distributions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            if (!response.ok) {
                const err = await response.json();
                alert('Error saving distribution: ' + (err.error || 'Unknown error'));
                return;
            }
            const ui = allUniformItems.find(i => i.id == item.item_id);
            await logAudit('CREATE', 'uniforms', 'Distribution', null, `Distribution: ${item.quantity} units of ${ui?.name || 'Unknown'} to ${staffName}`);
        }
        closeUniformDistributionModal();
        loadUniformDistributions();
        loadUniformItems();
    } catch (error) {
        console.error('Error saving uniform distribution:', error);
        alert('Error saving distribution.');
    }
}

function viewUniformPurchase(itemId) {
    const purchases = allUniformPurchases.filter(p => p.item_id == itemId);
    if (purchases.length === 0) return;
    const p0 = purchases[0];
    const subLocParts = [p0.sub_location_name, p0.business_type_name, p0.business_unit_code].filter(Boolean);
    const totalQty = purchases.reduce((sum, p) => sum + p.quantity, 0);
    const totalCost = purchases.reduce((sum, p) => sum + parseFloat(p.total_cost || 0), 0);
    const content = document.getElementById('uniform-purchase-view-content');
    content.innerHTML = `
        <div class="grid grid-cols-2 gap-4 text-sm mb-4">
            <div><span class="font-semibold text-gray-600">Item:</span> ${p0.item_name || '-'}</div>
            <div><span class="font-semibold text-gray-600">Size:</span> ${p0.item_size || '-'}</div>
            <div><span class="font-semibold text-gray-600">Color:</span> ${p0.item_color || '-'}</div>
            <div><span class="font-semibold text-gray-600">Supplier:</span> ${p0.supplier_name || '-'}</div>
            <div><span class="font-semibold text-gray-600">Total Quantity:</span> ${totalQty}</div>
            <div><span class="font-semibold text-gray-600">Total Cost:</span> $${totalCost.toFixed(2)}</div>
            <div><span class="font-semibold text-gray-600">Country:</span> ${p0.country_name || '-'}</div>
            <div><span class="font-semibold text-gray-600">Location:</span> ${p0.bta_location_name || '-'}</div>
            <div class="col-span-2"><span class="font-semibold text-gray-600">Sublocation:</span> ${subLocParts.length ? subLocParts.join(' - ') : '-'}</div>
        </div>
        <div class="mt-2 pt-2 border-t">
            <h4 class="text-sm font-semibold text-gray-700 mb-2">Purchase History (${purchases.length})</h4>
            <table class="w-full text-xs border-collapse">
                <thead>
                    <tr class="bg-gray-100">
                        <th class="px-2 py-1 text-left border border-gray-200">#</th>
                        <th class="px-2 py-1 text-left border border-gray-200">Date</th>
                        <th class="px-2 py-1 text-left border border-gray-200">Qty</th>
                        <th class="px-2 py-1 text-left border border-gray-200">Unit Price</th>
                        <th class="px-2 py-1 text-left border border-gray-200">Total</th>
                        <th class="px-2 py-1 text-left border border-gray-200">Invoice</th>
                        <th class="px-2 py-1 text-left border border-gray-200">Actions</th>
                    </tr>
                </thead>
                <tbody>
                    ${purchases.map((p, i) => `
                        <tr class="${i % 2 === 0 ? '' : 'bg-gray-50'}">
                            <td class="px-2 py-1 border border-gray-200">${i + 1}</td>
                            <td class="px-2 py-1 border border-gray-200">${formatDate(p.purchase_date)}</td>
                            <td class="px-2 py-1 border border-gray-200 font-semibold">${p.quantity}</td>
                            <td class="px-2 py-1 border border-gray-200">$${parseFloat(p.unit_price || 0).toFixed(2)}</td>
                            <td class="px-2 py-1 border border-gray-200">$${parseFloat(p.total_cost || 0).toFixed(2)}</td>
                            <td class="px-2 py-1 border border-gray-200">${p.invoice_number || '-'}</td>
                            <td class="px-2 py-1 border border-gray-200 whitespace-nowrap">
                                ${getEditActionButton('uniforms', 'editUniformPurchase', p.id)}
                                ${getDeleteActionButton('uniforms', 'deleteUniformPurchase', p.id)}
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>`;
    document.getElementById('uniform-purchase-view-modal').classList.add('active');
}

function closeUniformPurchaseViewModal() {
    document.getElementById('uniform-purchase-view-modal').classList.remove('active');
}

function viewUniformDistribution(employeeId) {
    const dists = allUniformDistributions.filter(d => {
        if (typeof employeeId === 'string') return (d.employee_name || d.staff_name) === employeeId;
        return d.employee_id == employeeId;
    });
    if (dists.length === 0) return;
    const d0 = dists[0];
    const subLocParts = [d0.sub_location_name, d0.business_type_name, d0.business_unit_code].filter(Boolean);
    const content = document.getElementById('uniform-distribution-view-content');
    content.innerHTML = `
        <div class="mb-4 grid grid-cols-2 gap-4 text-sm">
            <div><span class="font-semibold text-gray-600">Employee:</span> ${d0.employee_name || d0.staff_name || '-'}</div>
            <div><span class="font-semibold text-gray-600">Staff ID:</span> ${d0.employee_code || d0.staff_id || '-'}</div>
            <div><span class="font-semibold text-gray-600">Department:</span> ${d0.emp_department || d0.department || '-'}</div>
            <div><span class="font-semibold text-gray-600">Country:</span> ${d0.country_name || '-'}</div>
            <div><span class="font-semibold text-gray-600">Location:</span> ${d0.location_type_name || '-'}</div>
            <div><span class="font-semibold text-gray-600">Sublocation:</span> ${subLocParts.length ? subLocParts.join(' - ') : '-'}</div>
        </div>
        <div class="overflow-x-auto">
            <table class="w-full text-sm border rounded-lg">
                <thead class="bg-gray-100">
                    <tr>
                        <th class="px-3 py-2 text-left">Item</th>
                        <th class="px-3 py-2 text-left">Size</th>
                        <th class="px-3 py-2 text-left">Color</th>
                        <th class="px-3 py-2 text-left">Quantity</th>
                        <th class="px-3 py-2 text-left">Date</th>
                        <th class="px-3 py-2 text-left">Notes</th>
                        <th class="px-3 py-2 text-left">Actions</th>
                    </tr>
                </thead>
                <tbody class="divide-y divide-gray-200">
                    ${dists.map(d => `
                        <tr>
                            <td class="px-3 py-2">${d.item_name || '-'}</td>
                            <td class="px-3 py-2">${d.item_size || '-'}</td>
                            <td class="px-3 py-2">${d.item_color || '-'}</td>
                            <td class="px-3 py-2">${d.quantity}</td>
                            <td class="px-3 py-2">${formatDate(d.distribution_date)}</td>
                            <td class="px-3 py-2">${d.notes || '-'}</td>
                            <td class="px-3 py-2"><button onclick="deleteUniformDistribution(${d.id})" class="text-red-600 hover:text-red-800" title="Delete"><i class="fas fa-trash"></i></button></td>
                        </tr>
                    `).join('')}
                </tbody>
                <tfoot class="bg-gray-50 font-semibold">
                    <tr>
                        <td class="px-3 py-2">Total</td>
                        <td colspan="2"></td>
                        <td class="px-3 py-2">${dists.reduce((sum, d) => sum + d.quantity, 0)}</td>
                        <td colspan="3"></td>
                    </tr>
                </tfoot>
            </table>
        </div>`;
    document.getElementById('uniform-distribution-view-modal').classList.add('active');
}

function closeUniformDistributionViewModal() {
    document.getElementById('uniform-distribution-view-modal').classList.remove('active');
}

function addUniformDistributionToEmployee(employeeId) {
    openUniformDistributionModal();
    if (employeeId) {
        const emp = allEmployees.find(e => e.id == employeeId);
        if (emp) {
            document.getElementById('uniform-distribution-employee').value = emp.id;
            document.getElementById('uniform-distribution-employee-search').value = `${emp.first_name} ${emp.last_name} (${emp.employee_id || 'No ID'})`;
            document.getElementById('uniform-distribution-staff-name').value = `${emp.first_name} ${emp.last_name}`;
            document.getElementById('uniform-distribution-staff-id').value = emp.employee_id || '';
            document.getElementById('uniform-distribution-department').value = emp.department || '';
        }
    }
}

async function deleteUniformDistribution(id) {
    if (!confirm('Are you sure you want to delete this distribution? Stock will be restored.')) return;
    try {
        const response = await fetch(`${API_BASE}/uniform-distributions/${id}`, { method: 'DELETE' });
        if (response.ok) {
            await loadUniformDistributions();
            await loadUniformItems();
            closeUniformDistributionViewModal();
        } else {
            const err = await response.json();
            alert('Error: ' + (err.error || 'Failed to delete'));
        }
    } catch (error) {
        console.error('Error deleting uniform distribution:', error);
        alert('Error deleting distribution');
    }
}

async function deleteUniformDistributionByEmployee(employeeId) {
    const dists = allUniformDistributions.filter(d => {
        if (typeof employeeId === 'string') return (d.employee_name || d.staff_name) === employeeId;
        return d.employee_id == employeeId;
    });
    if (dists.length === 0) return;
    if (!confirm(`Are you sure you want to delete all ${dists.length} distribution(s) for ${dists[0].employee_name || dists[0].staff_name}? Stock will be restored.`)) return;
    try {
        for (const d of dists) {
            await fetch(`${API_BASE}/uniform-distributions/${d.id}`, { method: 'DELETE' });
        }
        await loadUniformDistributions();
        await loadUniformItems();
    } catch (error) {
        console.error('Error deleting distributions:', error);
        alert('Error deleting distributions');
    }
}

function exportUniformItemsCSV() {
    const term = (document.getElementById('uniform-items-search')?.value || '').toLowerCase();
    const data = allUniformItems.filter(item =>
        (item.name || '').toLowerCase().includes(term) ||
        (item.size || '').toLowerCase().includes(term) ||
        (item.color || '').toLowerCase().includes(term) ||
        (item.notes || '').toLowerCase().includes(term)
    );
    const exportCols = UNIFORM_ITEM_COLUMNS.filter(col => col.key !== 'actions' && uniformItemColumnVisibility[col.key] !== false);
    const headers = exportCols.map(col => col.label);
    let csv = headers.map(h => escapeCSV(h)).join(',') + '\n';
    data.forEach((item, i) => {
        const values = exportCols.map(col => getUniformItemColumnValue(item, col.key, i));
        csv += values.map(v => escapeCSV(v)).join(',') + '\n';
    });
    downloadCSV(csv, 'uniform_items_export.csv');
}

function exportUniformItemsPDF() {
    const term = (document.getElementById('uniform-items-search')?.value || '').toLowerCase();
    const data = allUniformItems.filter(item =>
        (item.name || '').toLowerCase().includes(term) ||
        (item.size || '').toLowerCase().includes(term) ||
        (item.color || '').toLowerCase().includes(term) ||
        (item.notes || '').toLowerCase().includes(term)
    );
    const exportCols = UNIFORM_ITEM_COLUMNS.filter(col => col.key !== 'actions' && uniformItemColumnVisibility[col.key] !== false);
    const headers = exportCols.map(col => col.label);
    const rows = data.map((item, i) => exportCols.map(col => getUniformItemColumnValue(item, col.key, i)));

    const html = `
    <!DOCTYPE html>
    <html>
    <head>
        <title>Uniform Items Export</title>
        <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            h2 { text-align: center; margin-bottom: 20px; }
            .info { text-align: center; font-size: 12px; color: #666; margin-bottom: 15px; }
            table { width: 100%; border-collapse: collapse; font-size: 12px; }
            th { background: #3b82f6; color: white; padding: 6px 8px; text-align: left; border: 1px solid #ddd; }
            td { padding: 5px 8px; border: 1px solid #ddd; }
            tr:nth-child(even) { background: #f9fafb; }
            .footer { text-align: center; font-size: 10px; color: #999; margin-top: 20px; }
        </style>
    </head>
    <body>
        <h2>Uniform Items Report</h2>
        <div class="info">Generated on: ${new Date().toLocaleString()} | Total Items: ${data.length}</div>
        <table>
            <thead><tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr></thead>
            <tbody>
                ${rows.map(r => `<tr>${r.map(c => `<td>${c}</td>`).join('')}</tr>`).join('')}
            </tbody>
        </table>
        <div class="footer">MWH Management System - Uniform Items Export</div>
    </body>
    </html>`;

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
    const removeIframe = () => { if (iframe.parentNode) document.body.removeChild(iframe); };
    try { iframe.contentWindow.addEventListener('afterprint', removeIframe, { once: true }); } catch (e) {}
    setTimeout(removeIframe, 500);
}

// Warehouse Management

let allWarehouseItems = [];
let allWarehousePurchaseRequests = [];
let allWarehouseDeliveries = [];
let allWarehouseTransfers = [];
let allWarehouseSuppliers = [];
let allBusinessUnits = [];

window.showWarehouseSubTab = showWarehouseSubTab;
window.openWarehouseItemModal = openWarehouseItemModal;
window.closeWarehouseItemModal = closeWarehouseItemModal;
window.editWarehouseItem = editWarehouseItem;
window.deleteWarehouseItem = deleteWarehouseItem;
window.openPurchaseRequestModal = openPurchaseRequestModal;
window.closePurchaseRequestModal = closePurchaseRequestModal;
window.addPurchaseRequestItemRow = addPurchaseRequestItemRow;
window.viewPurchaseRequest = viewPurchaseRequest;
window.deletePurchaseRequest = deletePurchaseRequest;
window.openDeliveryModal = openDeliveryModal;
window.closeDeliveryModal = closeDeliveryModal;
window.viewDelivery = viewDelivery;
window.deleteDelivery = deleteDelivery;
window.openWarehouseTransferModal = openWarehouseTransferModal;
window.closeWarehouseTransferModal = closeWarehouseTransferModal;
window.addTransferItemRow = addTransferItemRow;
window.viewWarehouseTransfer = viewWarehouseTransfer;
window.deleteWarehouseTransfer = deleteWarehouseTransfer;

function showWarehouseSubTab(tab) {
    document.querySelectorAll('.warehouse-sub-tab-content').forEach(c => c.classList.add('hidden'));
    document.querySelectorAll('.warehouse-sub-tab').forEach(btn => {
        btn.classList.remove('bg-blue-600', 'text-white');
        btn.classList.add('bg-gray-200', 'text-gray-700');
    });
    const content = document.getElementById('warehouse-' + tab + '-tab');
    if (content) content.classList.remove('hidden');
    const btn = document.querySelector(`.warehouse-sub-tab[data-tab="${tab}"]`);
    if (btn) { btn.classList.add('bg-blue-600', 'text-white'); btn.classList.remove('bg-gray-200', 'text-gray-700'); }

    if (tab === 'items') loadWarehouseItems();
    else if (tab === 'purchase-requests') loadWarehousePurchaseRequests();
    else if (tab === 'deliveries') loadWarehouseDeliveries();
    else if (tab === 'transfers') loadWarehouseTransfers();
    setTimeout(adjustTableContainerHeights, 150);
}

async function loadWarehouseData() {
    await Promise.all([
        loadWarehouseItems(),
        loadSuppliers(),
        loadBusinessUnits()
    ]);
}

// ─── Warehouse Items ───
async function loadWarehouseItems() {
    showTableLoading('warehouse-items-table-body', 'Loading warehouse items...');
    try {
        const response = await fetch(`${API_BASE}/warehouse-management/items`);
        if (response.ok) {
            allWarehouseItems = await response.json();
            renderWarehouseItems();
        }
    } catch (error) {
        console.error('Error loading warehouse items:', error);
    }
}

function renderWarehouseItems() {
    const tbody = document.getElementById('warehouse-items-table-body');
    if (!tbody) return;
    tbody.innerHTML = allWarehouseItems.map(item => `
        <tr>
            <td class="px-4 py-2">${item.name}</td>
            <td class="px-4 py-2">${item.unit}</td>
            <td class="px-4 py-2 ${item.current_stock <= item.min_stock ? 'text-red-600 font-semibold' : ''}">${item.current_stock}</td>
            <td class="px-4 py-2">${item.min_stock}</td>
            <td class="px-4 py-2">${item.cost_per_unit || 0}</td>
            <td class="px-4 py-2">
                <button onclick="editWarehouseItem(${item.id})" class="text-blue-600 hover:text-blue-800 mr-2" title="Edit"><i class="fas fa-edit"></i></button>
                <button onclick="deleteWarehouseItem(${item.id})" class="text-red-600 hover:text-red-800" title="Delete"><i class="fas fa-trash"></i></button>
            </td>
        </tr>
    `).join('') || '<tr><td colspan="6" class="px-4 py-2 text-center text-gray-500">No items found</td></tr>';
}

function openWarehouseItemModal(id = null) {
    const modal = document.getElementById('warehouse-item-modal');
    const title = document.getElementById('warehouse-item-modal-title');
    const form = document.getElementById('warehouse-item-form');
    form.reset();
    document.getElementById('warehouse-item-id').value = '';
    if (id) {
        title.textContent = 'Edit Warehouse Item';
        const item = allWarehouseItems.find(i => i.id === id);
        if (item) {
            document.getElementById('warehouse-item-id').value = item.id;
            document.getElementById('warehouse-item-name').value = item.name;
            document.getElementById('warehouse-item-unit').value = item.unit;
            document.getElementById('warehouse-item-stock').value = item.current_stock;
            document.getElementById('warehouse-item-min-stock').value = item.min_stock;
            document.getElementById('warehouse-item-cost').value = item.cost_per_unit;
        }
    } else {
        title.textContent = 'Add Warehouse Item';
    }
    modal.classList.remove('hidden');
    modal.classList.add('flex');
}

function closeWarehouseItemModal() {
    const modal = document.getElementById('warehouse-item-modal');
    modal.classList.add('hidden');
    modal.classList.remove('flex');
}

safeAddFormListener('warehouse-item-form', async function(e) {
    e.preventDefault();
    const id = document.getElementById('warehouse-item-id').value;
    const data = {
        name: document.getElementById('warehouse-item-name').value,
        unit: document.getElementById('warehouse-item-unit').value,
        current_stock: parseFloat(document.getElementById('warehouse-item-stock').value) || 0,
        min_stock: parseFloat(document.getElementById('warehouse-item-min-stock').value) || 0,
        cost_per_unit: parseFloat(document.getElementById('warehouse-item-cost').value) || 0
    };
    try {
        const url = id ? `${API_BASE}/warehouse-management/items/${id}` : `${API_BASE}/warehouse-management/items`;
        const method = id ? 'PUT' : 'POST';
        const response = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
        if (response.ok) {
            closeWarehouseItemModal();
            loadWarehouseItems();
        } else {
            const err = await response.json();
            alert(err.error || 'Error saving item');
        }
    } catch (error) {
        console.error('Error saving warehouse item:', error);
        alert('Error saving item');
    }
});

function editWarehouseItem(id) { openWarehouseItemModal(id); }

async function deleteWarehouseItem(id) {
    if (!confirm('Are you sure you want to delete this warehouse item?')) return;
    try {
        const response = await fetch(`${API_BASE}/warehouse-management/items/${id}`, { method: 'DELETE' });
        if (response.ok) loadWarehouseItems();
        else alert('Error deleting item');
    } catch (error) {
        console.error('Error deleting warehouse item:', error);
    }
}

// ─── Suppliers ───
async function loadSuppliers() {
    try {
        const response = await fetch(`${API_BASE}/warehouse-management/suppliers`);
        if (response.ok) allWarehouseSuppliers = await response.json();
    } catch (error) {
        console.error('Error loading suppliers:', error);
    }
}

// ─── Business Units ───
async function loadBusinessUnits() {
    try {
        const response = await fetch(`${API_BASE}/warehouse-management/business-units`);
        if (response.ok) allBusinessUnits = await response.json();
    } catch (error) {
        console.error('Error loading business units:', error);
    }
}

// ─── Purchase Requests ───
async function loadWarehousePurchaseRequests() {
    showTableLoading('warehouse-purchase-requests-table-body', 'Loading purchase requests...');
    try {
        const response = await fetch(`${API_BASE}/warehouse-management/purchase-requests`);
        if (response.ok) {
            allWarehousePurchaseRequests = await response.json();
            renderWarehousePurchaseRequests();
        }
    } catch (error) {
        console.error('Error loading purchase requests:', error);
    }
}

function renderWarehousePurchaseRequests() {
    const tbody = document.getElementById('warehouse-purchase-requests-table-body');
    if (!tbody) return;
    tbody.innerHTML = allWarehousePurchaseRequests.map(pr => `
        <tr>
            <td class="px-4 py-2">${pr.request_number}</td>
            <td class="px-4 py-2">${pr.request_date}</td>
            <td class="px-4 py-2">${pr.supplier_name || '-'}</td>
            <td class="px-4 py-2">${pr.item_count || 0}</td>
            <td class="px-4 py-2"><span class="px-2 py-1 rounded text-xs ${pr.status === 'Pending' ? 'bg-yellow-100 text-yellow-800' : pr.status === 'Delivered' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}">${pr.status}</span></td>
            <td class="px-4 py-2">
                <button onclick="viewPurchaseRequest(${pr.id})" class="text-green-600 hover:text-green-800 mr-2" title="View"><i class="fas fa-eye"></i></button>
                <button onclick="deletePurchaseRequest(${pr.id})" class="text-red-600 hover:text-red-800" title="Delete"><i class="fas fa-trash"></i></button>
            </td>
        </tr>
    `).join('') || '<tr><td colspan="6" class="px-4 py-2 text-center text-gray-500">No purchase requests found</td></tr>';
}

function openPurchaseRequestModal() {
    const modal = document.getElementById('warehouse-purchase-request-modal');
    const form = document.getElementById('warehouse-purchase-request-form');
    form.reset();
    document.getElementById('warehouse-pr-id').value = '';
    document.getElementById('warehouse-pr-items-container').innerHTML = '';
    // Populate supplier dropdown
    const supplierSelect = document.getElementById('warehouse-pr-supplier');
    supplierSelect.innerHTML = '<option value="">Select Supplier</option>' +
        allWarehouseSuppliers.map(s => `<option value="${s.id}">${s.name}</option>`).join('');
    // Set default request number
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
    document.getElementById('warehouse-pr-number').value = 'PR-' + dateStr + '-' + Math.floor(Math.random() * 1000);
    document.getElementById('warehouse-pr-date').value = now.toISOString().slice(0, 10);
    addPurchaseRequestItemRow();
    modal.classList.remove('hidden');
    modal.classList.add('flex');
}

function closePurchaseRequestModal() {
    const modal = document.getElementById('warehouse-purchase-request-modal');
    modal.classList.add('hidden');
    modal.classList.remove('flex');
}

function addPurchaseRequestItemRow() {
    const container = document.getElementById('warehouse-pr-items-container');
    const row = document.createElement('div');
    row.className = 'flex gap-2 items-center';
    row.innerHTML = `
        <select class="warehouse-pr-item-select flex-1 px-2 py-1 border rounded text-sm">
            <option value="">Select Item</option>
            ${allWarehouseItems.map(item => `<option value="${item.id}" data-unit="${item.unit}">${item.name} (${item.unit})</option>`).join('')}
        </select>
        <input type="number" step="0.01" class="warehouse-pr-qty w-24 px-2 py-1 border rounded text-sm" placeholder="Qty" value="1">
        <input type="text" class="warehouse-pr-unit w-20 px-2 py-1 border rounded text-sm" placeholder="Unit">
        <input type="number" step="0.01" class="warehouse-pr-price w-24 px-2 py-1 border rounded text-sm" placeholder="Price" value="0">
        <button type="button" onclick="this.parentElement.remove()" class="text-red-600 hover:text-red-800"><i class="fas fa-times"></i></button>
    `;
    container.appendChild(row);
    // Auto-fill unit when item selected
    row.querySelector('.warehouse-pr-item-select').addEventListener('change', function() {
        const opt = this.selectedOptions[0];
        if (opt) row.querySelector('.warehouse-pr-unit').value = opt.dataset.unit || '';
    });
}

safeAddFormListener('warehouse-purchase-request-form', async function(e) {
    e.preventDefault();
    const id = document.getElementById('warehouse-pr-id').value;
    const items = [];
    document.querySelectorAll('#warehouse-pr-items-container > div').forEach(row => {
        const warehouse_item_id = row.querySelector('.warehouse-pr-item-select').value;
        const quantity = parseFloat(row.querySelector('.warehouse-pr-qty').value);
        const unit = row.querySelector('.warehouse-pr-unit').value;
        const unit_price = parseFloat(row.querySelector('.warehouse-pr-price').value) || 0;
        if (warehouse_item_id && quantity) items.push({ warehouse_item_id, quantity, unit, unit_price });
    });
    if (items.length === 0) { alert('Add at least one item'); return; }
    const data = {
        request_number: document.getElementById('warehouse-pr-number').value,
        request_date: document.getElementById('warehouse-pr-date').value,
        supplier_id: document.getElementById('warehouse-pr-supplier').value || null,
        notes: document.getElementById('warehouse-pr-notes').value,
        items
    };
    try {
        const url = id ? `${API_BASE}/warehouse-management/purchase-requests/${id}` : `${API_BASE}/warehouse-management/purchase-requests`;
        const method = id ? 'PUT' : 'POST';
        const response = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
        if (response.ok) {
            closePurchaseRequestModal();
            loadWarehousePurchaseRequests();
        } else {
            const err = await response.json();
            alert(err.error || 'Error saving purchase request');
        }
    } catch (error) {
        console.error('Error saving purchase request:', error);
        alert('Error saving purchase request');
    }
});

async function viewPurchaseRequest(id) {
    try {
        const response = await fetch(`${API_BASE}/warehouse-management/purchase-requests/${id}`);
        if (response.ok) {
            const pr = await response.json();
            const modal = document.getElementById('warehouse-pr-view-modal');
            const body = document.getElementById('warehouse-pr-view-body');
            body.innerHTML = `
                <div class="mb-4 space-y-1">
                    <p><strong>Request #:</strong> ${pr.request_number}</p>
                    <p><strong>Date:</strong> ${pr.request_date}</p>
                    <p><strong>Supplier:</strong> ${pr.supplier_name || '-'}</p>
                    <p><strong>Status:</strong> ${pr.status}</p>
                    <p><strong>Notes:</strong> ${pr.notes || '-'}</p>
                </div>
                <table class="w-full text-sm border rounded">
                    <thead class="bg-gray-50">
                        <tr>
                            <th class="px-3 py-2 text-left">Item</th>
                            <th class="px-3 py-2 text-left">Qty</th>
                            <th class="px-3 py-2 text-left">Unit</th>
                            <th class="px-3 py-2 text-left">Unit Price</th>
                            <th class="px-3 py-2 text-left">Total</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${(pr.items || []).map(i => `
                            <tr class="border-t">
                                <td class="px-3 py-2">${i.item_name || '-'}</td>
                                <td class="px-3 py-2">${i.quantity}</td>
                                <td class="px-3 py-2">${i.unit || i.item_unit || '-'}</td>
                                <td class="px-3 py-2">${i.unit_price || 0}</td>
                                <td class="px-3 py-2">${((i.quantity || 0) * (i.unit_price || 0)).toFixed(2)}</td>
                            </tr>
                        `).join('') || '<tr><td colspan="5" class="px-3 py-2 text-center text-gray-500">No items</td></tr>'}
                    </tbody>
                </table>
            `;
            modal.classList.remove('hidden');
            modal.classList.add('flex');
        }
    } catch (error) {
        console.error('Error viewing purchase request:', error);
    }
}

async function deletePurchaseRequest(id) {
    if (!confirm('Delete this purchase request?')) return;
    try {
        const response = await fetch(`${API_BASE}/warehouse-management/purchase-requests/${id}`, { method: 'DELETE' });
        if (response.ok) loadWarehousePurchaseRequests();
        else alert('Error deleting purchase request');
    } catch (error) {
        console.error('Error deleting purchase request:', error);
    }
}

// ─── Deliveries ───
async function loadWarehouseDeliveries() {
    showTableLoading('warehouse-deliveries-table-body', 'Loading deliveries...');
    try {
        const response = await fetch(`${API_BASE}/warehouse-management/deliveries`);
        if (response.ok) {
            allWarehouseDeliveries = await response.json();
            renderWarehouseDeliveries();
        }
    } catch (error) {
        console.error('Error loading deliveries:', error);
    }
}

function renderWarehouseDeliveries() {
    const tbody = document.getElementById('warehouse-deliveries-table-body');
    if (!tbody) return;
    tbody.innerHTML = allWarehouseDeliveries.map(d => `
        <tr>
            <td class="px-4 py-2">${d.delivery_number}</td>
            <td class="px-4 py-2">${d.delivery_date}</td>
            <td class="px-4 py-2">${d.request_number || '-'}</td>
            <td class="px-4 py-2">${d.supplier_name || '-'}</td>
            <td class="px-4 py-2">${d.received_by || '-'}</td>
            <td class="px-4 py-2"><span class="px-2 py-1 rounded text-xs bg-green-100 text-green-800">${d.status}</span></td>
            <td class="px-4 py-2">
                <button onclick="viewDelivery(${d.id})" class="text-green-600 hover:text-green-800 mr-2" title="View"><i class="fas fa-eye"></i></button>
                <button onclick="deleteDelivery(${d.id})" class="text-red-600 hover:text-red-800" title="Delete"><i class="fas fa-trash"></i></button>
            </td>
        </tr>
    `).join('') || '<tr><td colspan="7" class="px-4 py-2 text-center text-gray-500">No deliveries found</td></tr>';
}

function openDeliveryModal() {
    const modal = document.getElementById('warehouse-delivery-modal');
    const form = document.getElementById('warehouse-delivery-form');
    form.reset();
    document.getElementById('warehouse-delivery-items-container').innerHTML = '';
    // Populate supplier dropdown
    const supplierSelect = document.getElementById('warehouse-delivery-supplier');
    supplierSelect.innerHTML = '<option value="">Select Supplier</option>' +
        allWarehouseSuppliers.map(s => `<option value="${s.id}">${s.name}</option>`).join('');
    // Populate purchase request dropdown
    const prSelect = document.getElementById('warehouse-delivery-pr');
    prSelect.innerHTML = '<option value="">Select Purchase Request (optional)</option>' +
        allWarehousePurchaseRequests.map(pr => `<option value="${pr.id}">${pr.request_number} (${pr.request_date})</option>`).join('');
    // Set default delivery number and date
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
    document.getElementById('warehouse-delivery-number').value = 'DEL-' + dateStr + '-' + Math.floor(Math.random() * 1000);
    document.getElementById('warehouse-delivery-date').value = now.toISOString().slice(0, 10);
    addDeliveryItemRow();
    modal.classList.remove('hidden');
    modal.classList.add('flex');
}

function closeDeliveryModal() {
    const modal = document.getElementById('warehouse-delivery-modal');
    modal.classList.add('hidden');
    modal.classList.remove('flex');
}

function addDeliveryItemRow() {
    const container = document.getElementById('warehouse-delivery-items-container');
    const row = document.createElement('div');
    row.className = 'flex gap-2 items-center';
    row.innerHTML = `
        <select class="warehouse-delivery-item-select flex-1 px-2 py-1 border rounded text-sm">
            <option value="">Select Item</option>
            ${allWarehouseItems.map(item => `<option value="${item.id}" data-unit="${item.unit}">${item.name} (${item.unit})</option>`).join('')}
        </select>
        <input type="number" step="0.01" class="warehouse-delivery-ordered w-24 px-2 py-1 border rounded text-sm" placeholder="Ordered" value="0">
        <input type="number" step="0.01" class="warehouse-delivery-received w-24 px-2 py-1 border rounded text-sm" placeholder="Received" value="0">
        <input type="text" class="warehouse-delivery-unit w-20 px-2 py-1 border rounded text-sm" placeholder="Unit">
        <input type="number" step="0.01" class="warehouse-delivery-price w-24 px-2 py-1 border rounded text-sm" placeholder="Price" value="0">
        <button type="button" onclick="this.parentElement.remove()" class="text-red-600 hover:text-red-800"><i class="fas fa-times"></i></button>
    `;
    container.appendChild(row);
    row.querySelector('.warehouse-delivery-item-select').addEventListener('change', function() {
        const opt = this.selectedOptions[0];
        if (opt) row.querySelector('.warehouse-delivery-unit').value = opt.dataset.unit || '';
    });
}

window.addDeliveryItemRow = addDeliveryItemRow;

safeAddFormListener('warehouse-delivery-form', async function(e) {
    e.preventDefault();
    const items = [];
    document.querySelectorAll('#warehouse-delivery-items-container > div').forEach(row => {
        const warehouse_item_id = row.querySelector('.warehouse-delivery-item-select').value;
        const ordered_quantity = parseFloat(row.querySelector('.warehouse-delivery-ordered').value) || 0;
        const received_quantity = parseFloat(row.querySelector('.warehouse-delivery-received').value) || 0;
        const unit = row.querySelector('.warehouse-delivery-unit').value;
        const unit_price = parseFloat(row.querySelector('.warehouse-delivery-price').value) || 0;
        if (warehouse_item_id && received_quantity > 0) items.push({ warehouse_item_id, ordered_quantity, received_quantity, unit, unit_price });
    });
    if (items.length === 0) { alert('Add at least one item with received quantity'); return; }
    const data = {
        delivery_number: document.getElementById('warehouse-delivery-number').value,
        delivery_date: document.getElementById('warehouse-delivery-date').value,
        purchase_request_id: document.getElementById('warehouse-delivery-pr').value || null,
        supplier_id: document.getElementById('warehouse-delivery-supplier').value || null,
        received_by: document.getElementById('warehouse-delivery-received-by').value,
        notes: document.getElementById('warehouse-delivery-notes').value,
        items
    };
    try {
        const response = await fetch(`${API_BASE}/warehouse-management/deliveries`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data)
        });
        if (response.ok) {
            closeDeliveryModal();
            loadWarehouseDeliveries();
            loadWarehouseItems();
        } else {
            const err = await response.json();
            alert(err.error || 'Error saving delivery');
        }
    } catch (error) {
        console.error('Error saving delivery:', error);
        alert('Error saving delivery');
    }
});

async function viewDelivery(id) {
    try {
        const response = await fetch(`${API_BASE}/warehouse-management/deliveries/${id}`);
        if (response.ok) {
            const d = await response.json();
            const modal = document.getElementById('warehouse-delivery-view-modal');
            const body = document.getElementById('warehouse-delivery-view-body');
            body.innerHTML = `
                <div class="mb-4 space-y-1">
                    <p><strong>Delivery #:</strong> ${d.delivery_number}</p>
                    <p><strong>Date:</strong> ${d.delivery_date}</p>
                    <p><strong>Purchase Request:</strong> ${d.request_number || '-'}</p>
                    <p><strong>Supplier:</strong> ${d.supplier_name || '-'}</p>
                    <p><strong>Received By:</strong> ${d.received_by || '-'}</p>
                    <p><strong>Notes:</strong> ${d.notes || '-'}</p>
                </div>
                <table class="w-full text-sm border rounded">
                    <thead class="bg-gray-50">
                        <tr>
                            <th class="px-3 py-2 text-left">Item</th>
                            <th class="px-3 py-2 text-left">Ordered</th>
                            <th class="px-3 py-2 text-left">Received</th>
                            <th class="px-3 py-2 text-left">Unit</th>
                            <th class="px-3 py-2 text-left">Unit Price</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${(d.items || []).map(i => `
                            <tr class="border-t">
                                <td class="px-3 py-2">${i.item_name || '-'}</td>
                                <td class="px-3 py-2">${i.ordered_quantity}</td>
                                <td class="px-3 py-2 font-semibold text-green-600">${i.received_quantity}</td>
                                <td class="px-3 py-2">${i.unit || i.item_unit || '-'}</td>
                                <td class="px-3 py-2">${i.unit_price || 0}</td>
                            </tr>
                        `).join('') || '<tr><td colspan="5" class="px-3 py-2 text-center text-gray-500">No items</td></tr>'}
                    </tbody>
                </table>
            `;
            modal.classList.remove('hidden');
            modal.classList.add('flex');
        }
    } catch (error) {
        console.error('Error viewing delivery:', error);
    }
}

async function deleteDelivery(id) {
    if (!confirm('Delete this delivery? Stock will be reversed.')) return;
    try {
        const response = await fetch(`${API_BASE}/warehouse-management/deliveries/${id}`, { method: 'DELETE' });
        if (response.ok) {
            loadWarehouseDeliveries();
            loadWarehouseItems();
        } else {
            const err = await response.json();
            alert(err.error || 'Error deleting delivery');
        }
    } catch (error) {
        console.error('Error deleting delivery:', error);
    }
}

// ─── Transfers to Catering ───
async function loadWarehouseTransfers() {
    showTableLoading('warehouse-transfers-table-body', 'Loading transfers...');
    try {
        const response = await fetch(`${API_BASE}/warehouse-management/transfers`);
        if (response.ok) {
            allWarehouseTransfers = await response.json();
            renderWarehouseTransfers();
        }
    } catch (error) {
        console.error('Error loading transfers:', error);
    }
}

function renderWarehouseTransfers() {
    const tbody = document.getElementById('warehouse-transfers-table-body');
    if (!tbody) return;
    tbody.innerHTML = allWarehouseTransfers.map(t => `
        <tr>
            <td class="px-4 py-2">${t.transfer_number}</td>
            <td class="px-4 py-2">${t.transfer_date}</td>
            <td class="px-4 py-2">${t.item_count || 0}</td>
            <td class="px-4 py-2"><span class="px-2 py-1 rounded text-xs ${t.status === 'Pending' ? 'bg-yellow-100 text-yellow-800' : t.status === 'Completed' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}">${t.status}</span></td>
            <td class="px-4 py-2">${t.notes || '-'}</td>
            <td class="px-4 py-2">
                <button onclick="viewWarehouseTransfer(${t.id})" class="text-green-600 hover:text-green-800 mr-2" title="View"><i class="fas fa-eye"></i></button>
                <button onclick="deleteWarehouseTransfer(${t.id})" class="text-red-600 hover:text-red-800" title="Delete"><i class="fas fa-trash"></i></button>
            </td>
        </tr>
    `).join('') || '<tr><td colspan="6" class="px-4 py-2 text-center text-gray-500">No transfers found</td></tr>';
}

function openWarehouseTransferModal() {
    const modal = document.getElementById('warehouse-transfer-modal');
    const form = document.getElementById('warehouse-transfer-form');
    form.reset();
    document.getElementById('warehouse-transfer-items-container').innerHTML = '';
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
    document.getElementById('warehouse-transfer-number').value = 'TRF-' + dateStr + '-' + Math.floor(Math.random() * 1000);
    document.getElementById('warehouse-transfer-date').value = now.toISOString().slice(0, 10);
    addTransferItemRow();
    modal.classList.remove('hidden');
    modal.classList.add('flex');
}

function closeWarehouseTransferModal() {
    const modal = document.getElementById('warehouse-transfer-modal');
    modal.classList.add('hidden');
    modal.classList.remove('flex');
}

function addTransferItemRow() {
    const container = document.getElementById('warehouse-transfer-items-container');
    const row = document.createElement('div');
    row.className = 'flex gap-2 items-center';
    row.innerHTML = `
        <select class="warehouse-transfer-item-select flex-1 px-2 py-1 border rounded text-sm">
            <option value="">Select Item</option>
            ${allWarehouseItems.map(item => `<option value="${item.id}" data-unit="${item.unit}" data-stock="${item.current_stock}">${item.name} (Stock: ${item.current_stock} ${item.unit})</option>`).join('')}
        </select>
        <input type="number" step="0.01" class="warehouse-transfer-qty w-24 px-2 py-1 border rounded text-sm" placeholder="Qty" value="1">
        <input type="text" class="warehouse-transfer-unit w-20 px-2 py-1 border rounded text-sm" placeholder="Unit">
        <button type="button" onclick="this.parentElement.remove()" class="text-red-600 hover:text-red-800"><i class="fas fa-times"></i></button>
    `;
    container.appendChild(row);
    row.querySelector('.warehouse-transfer-item-select').addEventListener('change', function() {
        const opt = this.selectedOptions[0];
        if (opt) row.querySelector('.warehouse-transfer-unit').value = opt.dataset.unit || '';
    });
}

safeAddFormListener('warehouse-transfer-form', async function(e) {
    e.preventDefault();
    const items = [];
    document.querySelectorAll('#warehouse-transfer-items-container > div').forEach(row => {
        const warehouse_item_id = row.querySelector('.warehouse-transfer-item-select').value;
        const sent_quantity = parseFloat(row.querySelector('.warehouse-transfer-qty').value);
        const unit = row.querySelector('.warehouse-transfer-unit').value;
        if (warehouse_item_id && sent_quantity) items.push({ warehouse_item_id, sent_quantity, unit });
    });
    if (items.length === 0) { alert('Add at least one item'); return; }
    const data = {
        transfer_number: document.getElementById('warehouse-transfer-number').value,
        transfer_date: document.getElementById('warehouse-transfer-date').value,
        notes: document.getElementById('warehouse-transfer-notes').value,
        items
    };
    try {
        const response = await fetch(`${API_BASE}/warehouse-management/transfers`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data)
        });
        if (response.ok) {
            closeWarehouseTransferModal();
            loadWarehouseTransfers();
            loadWarehouseItems();
        } else {
            const err = await response.json();
            alert(err.error || 'Error creating transfer');
        }
    } catch (error) {
        console.error('Error creating transfer:', error);
        alert('Error creating transfer');
    }
});

async function viewWarehouseTransfer(id) {
    try {
        const response = await fetch(`${API_BASE}/warehouse-management/transfers/${id}`);
        if (response.ok) {
            const t = await response.json();
            const modal = document.getElementById('warehouse-transfer-view-modal');
            const body = document.getElementById('warehouse-transfer-view-body');
            body.innerHTML = `
                <div class="mb-4 space-y-1">
                    <p><strong>Transfer #:</strong> ${t.transfer_number}</p>
                    <p><strong>Date:</strong> ${t.transfer_date}</p>
                    <p><strong>Status:</strong> ${t.status}</p>
                    <p><strong>Notes:</strong> ${t.notes || '-'}</p>
                </div>
                <table class="w-full text-sm border rounded">
                    <thead class="bg-gray-50">
                        <tr>
                            <th class="px-3 py-2 text-left">Item</th>
                            <th class="px-3 py-2 text-left">Sent Qty</th>
                            <th class="px-3 py-2 text-left">Received Qty</th>
                            <th class="px-3 py-2 text-left">Unit</th>
                            <th class="px-3 py-2 text-left">Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${(t.items || []).map(i => `
                            <tr class="border-t">
                                <td class="px-3 py-2">${i.item_name || '-'}</td>
                                <td class="px-3 py-2">${i.sent_quantity}</td>
                                <td class="px-3 py-2">${i.received_quantity || '-'}</td>
                                <td class="px-3 py-2">${i.unit || i.item_unit || '-'}</td>
                                <td class="px-3 py-2">${i.status}</td>
                            </tr>
                        `).join('') || '<tr><td colspan="5" class="px-3 py-2 text-center text-gray-500">No items</td></tr>'}
                    </tbody>
                </table>
            `;
            modal.classList.remove('hidden');
            modal.classList.add('flex');
        }
    } catch (error) {
        console.error('Error viewing transfer:', error);
    }
}

async function deleteWarehouseTransfer(id) {
    if (!confirm('Delete this transfer?')) return;
    try {
        const response = await fetch(`${API_BASE}/warehouse-management/transfers/${id}`, { method: 'DELETE' });
        if (response.ok) loadWarehouseTransfers();
        else alert('Error deleting transfer');
    } catch (error) {
        console.error('Error deleting transfer:', error);
    }
}

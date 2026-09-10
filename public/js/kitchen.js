// Kitchen warehouse management

let kitchenSuppliers = [];

async function loadSuppliers() {
    try {
        const response = await fetch(`${API_BASE}/suppliers`);
        kitchenSuppliers = await response.json();
    } catch (error) {
        console.error('Error loading suppliers:', error);
    }
}

function populateSupplierSelect(selectId) {
    const select = document.getElementById(selectId);
    if (select) {
        select.innerHTML = '<option value="">Select Supplier</option>' +
            kitchenSuppliers.map(s => `<option value="${s.id}">${s.name}</option>`).join('');
    }
}

async function loadKitchenItems() {
    try {
        const response = await fetch(`${API_BASE}/kitchen-items`);
        allKitchenItems = await response.json();
        renderKitchenItems();
        populateKitchenItemSelects();
    } catch (error) {
        console.error('Error loading kitchen items:', error);
    }
}

function renderKitchenItems() {
    const tbody = document.getElementById('kitchen-items-table-body');
    tbody.innerHTML = allKitchenItems.map(item => `
        <tr>
            <td class="px-6 py-4 whitespace-nowrap">${item.name}</td>
            <td class="px-6 py-4 whitespace-nowrap">
                <span class="px-2 py-1 text-xs rounded-full ${item.category === 'utensil' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'}">${item.category}</span>
            </td>
            <td class="px-6 py-4 whitespace-nowrap">${item.sku || '-'}</td>
            <td class="px-6 py-4 whitespace-nowrap">
                <span class="${item.current_stock <= item.minimum_stock ? 'text-red-600 font-bold' : ''}">${item.current_stock}</span> ${item.unit}
            </td>
            <td class="px-6 py-4 whitespace-nowrap">${item.location_name || '-'}</td>
            <td class="px-6 py-4 whitespace-nowrap">
                <button onclick="editKitchenItem(${item.id})" class="text-blue-600 hover:text-blue-800 mr-2">
                    <i class="fas fa-edit"></i>
                </button>
                <button onclick="deleteKitchenItem(${item.id})" class="text-red-600 hover:text-red-800">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        </tr>
    `).join('');
}

function populateKitchenItemSelects() {
    const selects = ['kitchen-purchase-item', 'kitchen-delivery-item'];
    
    selects.forEach(selectId => {
        const select = document.getElementById(selectId);
        if (select) {
            select.innerHTML = '<option value="">Select Item</option>' + 
                allKitchenItems.map(item => `<option value="${item.id}">${item.name} (${item.sku || 'No SKU'})</option>`).join('');
        }
    });
}

function openKitchenItemModal(id = null) {
    const modal = document.getElementById('kitchen-item-modal');
    const form = document.getElementById('kitchen-item-form');
    const title = document.getElementById('kitchen-item-modal-title');
    
    form.reset();
    document.getElementById('kitchen-item-id').value = '';
    
    if (id) {
        const item = allKitchenItems.find(i => i.id === id);
        if (item) {
            title.textContent = 'Edit Kitchen Item';
            document.getElementById('kitchen-item-id').value = item.id;
            document.getElementById('kitchen-item-name').value = item.name;
            document.getElementById('kitchen-item-category').value = item.category;
            document.getElementById('kitchen-item-sku').value = item.sku || '';
            document.getElementById('kitchen-item-unit').value = item.unit;
            document.getElementById('kitchen-item-stock').value = item.current_stock;
            document.getElementById('kitchen-item-min-stock').value = item.minimum_stock;
            document.getElementById('kitchen-item-location').value = item.location_id || '';
        }
    } else {
        title.textContent = 'Add Kitchen Item';
    }
    
    modal.classList.add('active');
}

function closeKitchenItemModal() {
    document.getElementById('kitchen-item-modal').classList.remove('active');
}

async function saveKitchenItem(e) {
    e.preventDefault();
    const id = document.getElementById('kitchen-item-id').value;
    const itemName = document.getElementById('kitchen-item-name').value;
    const data = {
        name: itemName,
        category: document.getElementById('kitchen-item-category').value,
        sku: document.getElementById('kitchen-item-sku').value,
        unit: document.getElementById('kitchen-item-unit').value,
        current_stock: parseInt(document.getElementById('kitchen-item-stock').value),
        minimum_stock: parseInt(document.getElementById('kitchen-item-min-stock').value),
        location_id: document.getElementById('kitchen-item-location').value
    };
    
    try {
        const url = id ? `${API_BASE}/kitchen-items/${id}` : `${API_BASE}/kitchen-items`;
        const method = id ? 'PUT' : 'POST';
        
        const response = await fetch(url, {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        
        if (response.ok) {
            const action = id ? 'UPDATE' : 'CREATE';
            await logAudit(action, 'kitchen', 'Kitchen Item', id || response.json().then(r => r.id), `Kitchen Item: ${itemName}`);
            closeKitchenItemModal();
            loadKitchenItems();
        }
    } catch (error) {
        console.error('Error saving kitchen item:', error);
    }
}

async function deleteKitchenItem(id) {
    const item = allKitchenItems.find(i => i.id === id);
    if (confirm('Are you sure you want to delete this kitchen item?')) {
        try {
            const response = await fetch(`${API_BASE}/kitchen-items/${id}`, { method: 'DELETE' });
            if (response.ok) {
                await logAudit('DELETE', 'kitchen', 'Kitchen Item', id, `Kitchen Item: ${item?.name || 'Unknown'}`);
                loadKitchenItems();
                loadDashboardStats();
            }
        } catch (error) {
            console.error('Error deleting kitchen item:', error);
        }
    }
}

function editKitchenItem(id) {
    openKitchenItemModal(id);
}

async function loadKitchenPurchases() {
    try {
        const response = await fetch(`${API_BASE}/kitchen-purchases`);
        const purchases = await response.json();
        renderKitchenPurchases(purchases);
    } catch (error) {
        console.error('Error loading kitchen purchases:', error);
    }
}

function renderKitchenPurchases(purchases) {
    const tbody = document.getElementById('kitchen-purchases-table-body');
    tbody.innerHTML = purchases.map(p => `
        <tr>
            <td class="px-6 py-4 whitespace-nowrap">${p.item_name}</td>
            <td class="px-6 py-4 whitespace-nowrap">${p.supplier_name}</td>
            <td class="px-6 py-4 whitespace-nowrap">${p.quantity}</td>
            <td class="px-6 py-4 whitespace-nowrap">$${parseFloat(p.total_cost).toFixed(2)}</td>
            <td class="px-6 py-4 whitespace-nowrap">${formatDate(p.purchase_date)}</td>
        </tr>
    `).join('');
}

async function openKitchenPurchaseModal() {
    const modal = document.getElementById('kitchen-purchase-modal');
    document.getElementById('kitchen-purchase-form').reset();
    document.getElementById('kitchen-purchase-date').value = new Date().toISOString().split('T')[0];
    await loadSuppliers();
    populateSupplierSelect('kitchen-purchase-supplier');
    modal.classList.add('active');
}

function closeKitchenPurchaseModal() {
    document.getElementById('kitchen-purchase-modal').classList.remove('active');
}

async function saveKitchenPurchase(e) {
    e.preventDefault();
    const itemId = document.getElementById('kitchen-purchase-item').value;
    const item = allKitchenItems.find(i => i.id == itemId);
    const supplierSelect = document.getElementById('kitchen-purchase-supplier');
    const supplierId = supplierSelect.value;
    const supplierName = supplierSelect.selectedOptions[0]?.text || '';
    const data = {
        item_id: itemId,
        supplier_id: supplierId,
        supplier_name: supplierName,
        quantity: parseInt(document.getElementById('kitchen-purchase-quantity').value),
        unit_price: parseFloat(document.getElementById('kitchen-purchase-unit-price').value),
        total_cost: parseFloat(document.getElementById('kitchen-purchase-total-cost').value),
        purchase_date: document.getElementById('kitchen-purchase-date').value,
        invoice_number: document.getElementById('kitchen-purchase-invoice').value,
        location_id: document.getElementById('kitchen-purchase-location').value
    };
    
    try {
        const response = await fetch(`${API_BASE}/kitchen-purchases`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        
        if (response.ok) {
            await logAudit('CREATE', 'kitchen', 'Purchase', null, `Purchase: ${data.quantity} units of ${item?.name || 'Unknown'}`);
            closeKitchenPurchaseModal();
            loadKitchenPurchases();
            loadKitchenItems();
        }
    } catch (error) {
        console.error('Error saving kitchen purchase:', error);
    }
}

async function loadKitchenDeliveries() {
    try {
        const response = await fetch(`${API_BASE}/kitchen-deliveries`);
        const deliveries = await response.json();
        renderKitchenDeliveries(deliveries);
    } catch (error) {
        console.error('Error loading kitchen deliveries:', error);
    }
}

function renderKitchenDeliveries(deliveries) {
    const tbody = document.getElementById('kitchen-deliveries-table-body');
    tbody.innerHTML = deliveries.map(d => `
        <tr>
            <td class="px-6 py-4 whitespace-nowrap">${d.item_name}</td>
            <td class="px-6 py-4 whitespace-nowrap">${d.catering_unit_name}</td>
            <td class="px-6 py-4 whitespace-nowrap">${d.quantity}</td>
            <td class="px-6 py-4 whitespace-nowrap">${d.received_by_name || d.received_by || '-'}</td>
            <td class="px-6 py-4 whitespace-nowrap">${formatDate(d.delivery_date)}</td>
        </tr>
    `).join('');
}

async function openKitchenDeliveryModal() {
    const modal = document.getElementById('kitchen-delivery-modal');
    document.getElementById('kitchen-delivery-form').reset();
    document.getElementById('kitchen-delivery-date').value = new Date().toISOString().split('T')[0];
    if (typeof populateEmployeeSelects === 'function') populateEmployeeSelects();
    modal.classList.add('active');
}

function closeKitchenDeliveryModal() {
    document.getElementById('kitchen-delivery-modal').classList.remove('active');
}

async function saveKitchenDelivery(e) {
    e.preventDefault();
    const itemId = document.getElementById('kitchen-delivery-item').value;
    const item = allKitchenItems.find(i => i.id == itemId);
    const receivedSelect = document.getElementById('kitchen-delivery-received');
    const employeeId = receivedSelect.value;
    const employeeName = receivedSelect.selectedOptions[0]?.text || '';
    const data = {
        item_id: itemId,
        catering_unit_name: document.getElementById('kitchen-delivery-unit').value,
        quantity: parseInt(document.getElementById('kitchen-delivery-quantity').value),
        delivery_date: document.getElementById('kitchen-delivery-date').value,
        employee_id: employeeId,
        received_by: employeeName,
        notes: document.getElementById('kitchen-delivery-notes').value,
        location_id: document.getElementById('kitchen-delivery-location').value
    };
    
    try {
        const response = await fetch(`${API_BASE}/kitchen-deliveries`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        
        if (response.ok) {
            await logAudit('CREATE', 'kitchen', 'Delivery', null, `Delivery: ${data.quantity} units of ${item?.name || 'Unknown'}`);
            closeKitchenDeliveryModal();
            loadKitchenDeliveries();
            loadKitchenItems();
        }
    } catch (error) {
        console.error('Error saving kitchen delivery:', error);
    }
}

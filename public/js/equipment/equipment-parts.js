// Parts Management

let equipmentPurchaseSuppliers = [];

async function loadEquipmentPurchaseSuppliers() {
    try {
        const response = await fetch(`${API_BASE}/suppliers`);
        equipmentPurchaseSuppliers = await response.json();
    } catch (error) {
        console.error('Error loading suppliers:', error);
    }
}

function populateEquipmentPurchaseSupplierSelect() {
    const select = document.getElementById('equipment-purchase-supplier');
    if (select) {
        select.innerHTML = '<option value="">Select Supplier</option>' +
            equipmentPurchaseSuppliers.map(s => `<option value="${s.id}">${s.name}</option>`).join('');
    }
}

async function loadPartsItems() {
    showTableLoading('parts-items-table-body', 'Loading parts items...');
    try {
        const response = await fetch(`${API_BASE}/parts-items`);
        allPartsItems = await response.json();
        if (Array.isArray(allPartsItems)) {
            renderPartsItems();
        } else {
            console.error('Parts items data is not an array:', allPartsItems);
        }
    } catch (error) {
        console.error('Error loading parts items:', error);
        showTableError('parts-items-table-body', 'Error loading parts items.');
    }
}

async function loadPartsPurchases() {
    showTableLoading('parts-purchases-table-body', 'Loading parts purchases...');
    try {
        const response = await fetch(`${API_BASE}/parts-purchases`);
        allPartsPurchases = await response.json();
        if (Array.isArray(allPartsPurchases)) {
            renderPartsPurchases();
        } else {
            console.error('Parts purchases data is not an array:', allPartsPurchases);
        }
    } catch (error) {
        console.error('Error loading parts purchases:', error);
        showTableError('parts-purchases-table-body', 'Error loading parts purchases.');
    }
}

function renderPartsItems() {
    const tbody = document.getElementById('parts-items-table-body');
    if (!tbody) {
        return;
    }
    tbody.innerHTML = allPartsItems.map(item => `
        <tr>
            <td class="px-6 py-4 whitespace-nowrap">
                ${item.image_path ? `<img src="${item.image_path}" class="w-10 h-10 object-cover rounded" alt="${item.name}">` : '-'}
            </td>
            <td class="px-6 py-4 whitespace-nowrap">${item.name}</td>
            <td class="px-6 py-4 whitespace-nowrap">${item.part_number || '-'}</td>
            <td class="px-6 py-4 whitespace-nowrap">${item.brand || '-'}</td>
            <td class="px-6 py-4 whitespace-nowrap">${item.category || '-'}</td>
            <td class="px-6 py-4 whitespace-nowrap">${item.current_stock || 0}</td>
            <td class="px-6 py-4 whitespace-nowrap">${item.assigned_equipment || '-'}</td>
            <td class="px-6 py-4 whitespace-nowrap">
                ${getEditActionButton('parts-items', 'editPartsItem', item.id)}
                ${getDeleteActionButton('parts-items', 'deletePartsItem', item.id)}
            </td>
        </tr>
    `).join('');
}

function renderPartsPurchases() {
    const tbody = document.getElementById('parts-purchases-table-body');
    if (!tbody) {
        return;
    }
    tbody.innerHTML = allPartsPurchases.map(purchase => `
        <tr>
            <td class="px-6 py-4 whitespace-nowrap">${purchase.item_name}</td>
            <td class="px-6 py-4 whitespace-nowrap">${purchase.supplier_name}</td>
            <td class="px-6 py-4 whitespace-nowrap">${purchase.quantity}</td>
            <td class="px-6 py-4 whitespace-nowrap">$${parseFloat(purchase.unit_price).toFixed(2)}</td>
            <td class="px-6 py-4 whitespace-nowrap">$${parseFloat(purchase.total_cost).toFixed(2)}</td>
            <td class="px-6 py-4 whitespace-nowrap">${formatDate(purchase.purchase_date)}</td>
            <td class="px-6 py-4 whitespace-nowrap">
                ${getDeleteActionButton('parts-purchases', 'deletePartsPurchase', purchase.id)}
            </td>
        </tr>
    `).join('');
}

function openPartsItemModal() {
    const modal = document.getElementById('parts-item-modal');
    document.getElementById('parts-item-form').reset();
    document.getElementById('parts-item-existing-image').value = '';
    document.getElementById('parts-item-image-preview').innerHTML = '';
    
    // Populate equipment dropdown
    const equipmentSelect = document.getElementById('parts-item-equipment');
    if (equipmentSelect && allEquipment) {
        equipmentSelect.innerHTML = allEquipment.map(eq => 
            `<option value="${eq.id}">${eq.auto_serial_number || 'No Serial'} - ${eq.name}</option>`
        ).join('');
    }
    
    modal.classList.add('active');
}

function closePartsItemModal() {
    document.getElementById('parts-item-modal').classList.remove('active');
}

async function savePartsItem(e) {
    e.preventDefault();
    const formData = new FormData();
    formData.append('name', document.getElementById('parts-item-name').value);
    formData.append('part_number', document.getElementById('parts-item-part-number').value);
    formData.append('brand', document.getElementById('parts-item-brand').value);
    formData.append('specification', document.getElementById('parts-item-specification').value);
    formData.append('category', document.getElementById('parts-item-category').value);
    formData.append('existing_image', document.getElementById('parts-item-existing-image').value);
    
    const imageInput = document.getElementById('parts-item-image');
    if (imageInput.files[0]) {
        formData.append('image', imageInput.files[0]);
    }
    
    // Get selected equipment IDs
    const equipmentSelect = document.getElementById('parts-item-equipment');
    const selectedEquipment = Array.from(equipmentSelect.selectedOptions).map(option => option.value);
    selectedEquipment.forEach(equipmentId => {
        formData.append('equipment_ids', equipmentId);
    });
    
    try {
        const response = await fetch(`${API_BASE}/parts-items`, {
            method: 'POST',
            body: formData
        });
        
        if (response.ok) {
            closePartsItemModal();
            loadPartsItems();
        }
    } catch (error) {
        console.error('Error saving parts item:', error);
    }
}

function editPartsItem(id) {
    const item = allPartsItems.find(i => i.id === id);
    if (item) {
        openPartsItemModal();
        document.getElementById('parts-item-name').value = item.name;
        document.getElementById('parts-item-part-number').value = item.part_number || '';
        document.getElementById('parts-item-brand').value = item.brand || '';
        document.getElementById('parts-item-specification').value = item.specification || '';
        document.getElementById('parts-item-category').value = item.category || '';
        document.getElementById('parts-item-existing-image').value = item.image_path || '';
        
        if (item.image_path) {
            document.getElementById('parts-item-image-preview').innerHTML = 
                `<img src="${item.image_path}" class="w-20 h-20 object-cover rounded" alt="${item.name}">`;
        }
        
        // Select assigned equipment
        const equipmentSelect = document.getElementById('parts-item-equipment');
        if (item.assigned_equipment) {
            const assignedEquipment = item.assigned_equipment.split(', ');
            Array.from(equipmentSelect.options).forEach(option => {
                const equipmentName = option.text;
                if (assignedEquipment.some(ae => ae.includes(equipmentName))) {
                    option.selected = true;
                }
            });
        }
    }
}

async function deletePartsItem(id) {
    if (!currentModuleManager) {
        alert('Please select a module manager.');
        return;
    }
    if (confirm('Are you sure you want to delete this parts item?')) {
        try {
            const response = await fetch(`${API_BASE}/parts-items/${id}?manager_id=${currentModuleManager.id}`, {
                method: 'DELETE'
            });
            
            if (response.ok) {
                loadPartsItems();
            }
        } catch (error) {
            console.error('Error deleting parts item:', error);
        }
    }
}

async function openPartsPurchaseModal() {
    const modal = document.getElementById('parts-purchase-modal');
    document.getElementById('parts-purchase-form').reset();

    // Populate items dropdown
    const itemSelect = document.getElementById('parts-purchase-item');
    if (itemSelect) {
        itemSelect.innerHTML = '<option value="">Select Item</option>' +
            allPartsItems.map(item => `<option value="${item.id}">${item.name} (${item.part_number || 'No Part Number'}) - Stock: ${item.current_stock || 0}</option>`).join('');
    }

    // Load suppliers
    await loadEquipmentPurchaseSuppliers();
    populateEquipmentPurchaseSupplierSelect();

    // Add auto-calculation for total cost
    const quantityInput = document.getElementById('parts-purchase-quantity');
    const unitPriceInput = document.getElementById('parts-purchase-unit-price');
    const totalCostInput = document.getElementById('parts-purchase-total-cost');
    
    function calculateTotalCost() {
        const quantity = parseFloat(quantityInput.value) || 0;
        const unitPrice = parseFloat(unitPriceInput.value) || 0;
        totalCostInput.value = (quantity * unitPrice).toFixed(2);
    }
    
    quantityInput.addEventListener('input', calculateTotalCost);
    unitPriceInput.addEventListener('input', calculateTotalCost);
    
    modal.classList.add('active');
}

function closePartsPurchaseModal() {
    document.getElementById('parts-purchase-modal').classList.remove('active');
}

async function openEquipmentPurchaseModal() {
    const modal = document.getElementById('equipment-purchase-modal');
    document.getElementById('equipment-purchase-form').reset();

    // Populate equipment dropdown
    const equipmentSelect = document.getElementById('equipment-purchase-equipment');
    if (equipmentSelect && allEquipment) {
        equipmentSelect.innerHTML = '<option value="">Select Equipment</option>' +
            allEquipment.map(eq => `<option value="${eq.id}">${eq.auto_serial_number || 'No Serial'} - ${eq.name}</option>`).join('');
    }

    // Load suppliers
    await loadEquipmentPurchaseSuppliers();
    populateEquipmentPurchaseSupplierSelect();

    modal.classList.add('active');
}

function closeEquipmentPurchaseModal() {
    document.getElementById('equipment-purchase-modal').classList.remove('active');
}

async function saveEquipmentPurchase(e) {
    e.preventDefault();
    const supplierSelect = document.getElementById('equipment-purchase-supplier');
    const supplierId = supplierSelect.value;
    const supplierName = supplierSelect.selectedOptions[0]?.text || '';
    const data = {
        equipment_id: document.getElementById('equipment-purchase-equipment').value,
        supplier_id: supplierId,
        supplier_name: supplierName,
        purchase_cost: document.getElementById('equipment-purchase-cost').value,
        purchase_date: document.getElementById('equipment-purchase-date').value,
        invoice_number: document.getElementById('equipment-purchase-invoice').value,
        notes: document.getElementById('equipment-purchase-notes').value
    };

    try {
        const response = await fetch(`${API_BASE}/equipment/purchases`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });

        if (response.ok) {
            closeEquipmentPurchaseModal();
            loadEquipmentPurchases();
        }
    } catch (error) {
        console.error('Error saving equipment purchase:', error);
    }
}

async function loadEquipmentPurchases() {
    showTableLoading('equipment-purchase-table-body', 'Loading equipment purchases...');
    try {
        const response = await fetch(`${API_BASE}/equipment/purchases`);
        allEquipmentPurchases = await response.json();
        if (Array.isArray(allEquipmentPurchases)) {
            renderEquipmentPurchases();
        } else {
            console.error('Equipment purchases data is not an array:', allEquipmentPurchases);
        }
    } catch (error) {
        console.error('Error loading equipment purchases:', error);
        showTableError('equipment-purchase-table-body', 'Error loading equipment purchases.');
    }
}

function renderEquipmentPurchases() {
    const tbody = document.getElementById('equipment-purchase-table-body');
    if (!tbody) {
        return;
    }
    tbody.innerHTML = allEquipmentPurchases.map(purchase => `
        <tr>
            <td class="px-6 py-4 whitespace-nowrap">${purchase.equipment_name || '-'} (${purchase.auto_serial_number || 'No Serial'})</td>
            <td class="px-6 py-4 whitespace-nowrap">${purchase.supplier_name || '-'}</td>
            <td class="px-6 py-4 whitespace-nowrap">${purchase.purchase_date || '-'}</td>
            <td class="px-6 py-4 whitespace-nowrap">${purchase.purchase_cost || '-'}</td>
            <td class="px-6 py-4 whitespace-nowrap">
                ${getDeleteActionButton('purchases', 'deleteEquipmentPurchase', purchase.id)}
            </td>
        </tr>
    `).join('');
}

async function deleteEquipmentPurchase(id) {
    if (!currentModuleManager) {
        alert('Please select a module manager.');
        return;
    }
    if (confirm('Are you sure you want to delete this equipment purchase?')) {
        try {
            const response = await fetch(`${API_BASE}/equipment/purchases/${id}?manager_id=${currentModuleManager.id}`, {
                method: 'DELETE'
            });

            if (response.ok) {
                loadEquipmentPurchases();
            }
        } catch (error) {
            console.error('Error deleting equipment purchase:', error);
        }
    }
}

async function savePartsPurchase(e) {
    e.preventDefault();
    const supplierSelect = document.getElementById('parts-purchase-supplier');
    const supplierId = supplierSelect.value;
    const supplierName = supplierSelect.selectedOptions[0]?.text || '';
    const data = {
        item_id: document.getElementById('parts-purchase-item').value,
        supplier_id: supplierId,
        supplier_name: supplierName,
        quantity: document.getElementById('parts-purchase-quantity').value,
        unit_price: document.getElementById('parts-purchase-unit-price').value,
        total_cost: document.getElementById('parts-purchase-total-cost').value,
        purchase_date: document.getElementById('parts-purchase-date').value,
        invoice_number: document.getElementById('parts-purchase-invoice').value
    };
    
    try {
        const response = await fetch(`${API_BASE}/parts-purchases`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        
        if (response.ok) {
            closePartsPurchaseModal();
            loadPartsPurchases();
            loadPartsItems(); // Reload items to update stock
        }
    } catch (error) {
        console.error('Error saving parts purchase:', error);
    }
}

async function deletePartsPurchase(id) {
    if (!currentModuleManager) {
        alert('Please select a module manager.');
        return;
    }
    if (confirm('Are you sure you want to delete this parts purchase?')) {
        try {
            const response = await fetch(`${API_BASE}/parts-purchases/${id}?manager_id=${currentModuleManager.id}`, {
                method: 'DELETE'
            });
            
            if (response.ok) {
                loadPartsPurchases();
            }
        } catch (error) {
            console.error('Error deleting parts purchase:', error);
        }
    }
}

function showPartsTab(tab) {
    // Hide all parts tab contents
    document.querySelectorAll('.parts-tab-content').forEach(content => content.classList.add('hidden'));
    
    // Show selected tab content
    document.getElementById(`parts-${tab}-tab`).classList.remove('hidden');
    
    // Update tab buttons
    document.querySelectorAll('.parts-tab').forEach(btn => {
        btn.classList.remove('bg-blue-600', 'text-white');
        btn.classList.add('bg-gray-200', 'text-gray-700');
    });
    document.querySelector(`.parts-tab[data-tab="${tab}"]`).classList.remove('bg-gray-200', 'text-gray-700');
    document.querySelector(`.parts-tab[data-tab="${tab}"]`).classList.add('bg-blue-600', 'text-white');
    
    // Load data based on tab
    if (tab === 'items') {
        loadPartsItems();
    } else if (tab === 'purchases') {
        loadPartsPurchases();
    }
}

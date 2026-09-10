// Procurement Management

// Global state for procurement
let allPurchaseOrders = [];
let allItemsReceipt = [];
let allItemTransfers = [];

// PURCHASE ORDERS
async function loadPurchaseOrders() {
    try {
        const response = await fetch(`${API_BASE}/purchase-orders`);
        allPurchaseOrders = await response.json();
        renderPurchaseOrders();
    } catch (error) {
        console.error('Error loading purchase orders:', error);
    }
}

function renderPurchaseOrders() {
    const tbody = document.getElementById('purchase-orders-table-body');
    tbody.innerHTML = allPurchaseOrders.map(order => `
        <tr>
            <td class="px-6 py-4 whitespace-nowrap">${order.id}</td>
            <td class="px-6 py-4 whitespace-nowrap">${order.order_number || '-'}</td>
            <td class="px-6 py-4 whitespace-nowrap">${order.supplier_name || '-'}</td>
            <td class="px-6 py-4 whitespace-nowrap">${order.status || '-'}</td>
            <td class="px-6 py-4 whitespace-nowrap">${formatDate(order.order_date)}</td>
            <td class="px-6 py-4 whitespace-nowrap">
                <button onclick="viewPurchaseOrder(${order.id})" class="text-blue-600 hover:text-blue-800 mr-2">
                    <i class="fas fa-eye"></i>
                </button>
                <button onclick="deletePurchaseOrder(${order.id})" class="text-red-600 hover:text-red-800">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        </tr>
    `).join('');
}

function openPurchaseOrderModal() {
    const modal = document.getElementById('purchase-order-modal');
    const form = document.getElementById('purchase-order-form');
    const title = document.getElementById('purchase-order-modal-title');
    
    form.reset();
    document.getElementById('purchase-order-id').value = '';
    
    // Set default date to today
    document.getElementById('purchase-order-date').value = new Date().toISOString().split('T')[0];
    
    // Populate supplier dropdown using allSuppliers from admin-settings.js
    const supplierSelect = document.getElementById('purchase-order-supplier');
    supplierSelect.innerHTML = '<option value="">Select Supplier</option>' + 
        allSuppliers.map(supplier => `<option value="${supplier.id}">${supplier.name}</option>`).join('');
    
    title.textContent = 'Create Purchase Order';
    modal.classList.add('active');
}

function closePurchaseOrderModal() {
    document.getElementById('purchase-order-modal').classList.remove('active');
}

async function savePurchaseOrder(e) {
    e.preventDefault();
    const order_number = document.getElementById('purchase-order-number').value;
    const order_date = document.getElementById('purchase-order-date').value;
    const supplier_id = document.getElementById('purchase-order-supplier').value;
    const status = document.getElementById('purchase-order-status').value;
    const notes = document.getElementById('purchase-order-notes').value;
    
    const data = {
        order_number: order_number,
        order_date: order_date,
        supplier_id: supplier_id,
        status: status,
        notes: notes
    };
    
    try {
        const response = await fetch(`${API_BASE}/purchase-orders`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        const result = await response.json();
        await logAudit('CREATE', 'procurement', 'Purchase Order', result.id, `Order Number: ${order_number}`);
        closePurchaseOrderModal();
        loadPurchaseOrders();
    } catch (error) {
        console.error('Error saving purchase order:', error);
    }
}

async function deletePurchaseOrder(id) {
    const order = allPurchaseOrders.find(o => o.id === id);
    if (confirm('Are you sure you want to delete this purchase order?')) {
        try {
            await fetch(`${API_BASE}/purchase-orders/${id}`, { method: 'DELETE' });
            await logAudit('DELETE', 'procurement', 'Purchase Order', id, `Order Number: ${order?.order_number || 'Unknown'}`);
            loadPurchaseOrders();
        } catch (error) {
            console.error('Error deleting purchase order:', error);
        }
    }
}

function viewPurchaseOrder(id) {
    alert('View purchase order details coming soon...');
}

// ITEMS RECEIPT
async function loadItemsReceipt() {
    try {
        const response = await fetch(`${API_BASE}/items-receipt`);
        allItemsReceipt = await response.json();
        renderItemsReceipt();
    } catch (error) {
        console.error('Error loading items receipt:', error);
    }
}

function renderItemsReceipt() {
    const tbody = document.getElementById('items-receipt-table-body');
    tbody.innerHTML = allItemsReceipt.map(receipt => `
        <tr>
            <td class="px-6 py-4 whitespace-nowrap">${receipt.id}</td>
            <td class="px-6 py-4 whitespace-nowrap">${receipt.purchase_order_number || '-'}</td>
            <td class="px-6 py-4 whitespace-nowrap">${receipt.item_name || '-'}</td>
            <td class="px-6 py-4 whitespace-nowrap">${receipt.quantity || '-'}</td>
            <td class="px-6 py-4 whitespace-nowrap">${formatDate(receipt.receipt_date)}</td>
            <td class="px-6 py-4 whitespace-nowrap">
                <button onclick="deleteItemsReceipt(${receipt.id})" class="text-red-600 hover:text-red-800">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        </tr>
    `).join('');
}

function openItemsReceiptModal() {
    alert('Items Receipt modal coming soon...');
}

// ITEM TRANSFER
async function loadItemTransfers() {
    try {
        const response = await fetch(`${API_BASE}/item-transfers`);
        allItemTransfers = await response.json();
        renderItemTransfers();
    } catch (error) {
        console.error('Error loading item transfers:', error);
    }
}

function renderItemTransfers() {
    const tbody = document.getElementById('item-transfer-table-body');
    tbody.innerHTML = allItemTransfers.map(transfer => `
        <tr>
            <td class="px-6 py-4 whitespace-nowrap">${transfer.id}</td>
            <td class="px-6 py-4 whitespace-nowrap">${transfer.item_name || '-'}</td>
            <td class="px-6 py-4 whitespace-nowrap">${transfer.from_location || '-'}</td>
            <td class="px-6 py-4 whitespace-nowrap">${transfer.to_location || '-'}</td>
            <td class="px-6 py-4 whitespace-nowrap">${transfer.quantity || '-'}</td>
            <td class="px-6 py-4 whitespace-nowrap">${formatDate(transfer.transfer_date)}</td>
            <td class="px-6 py-4 whitespace-nowrap">
                <button onclick="deleteItemTransfer(${transfer.id})" class="text-red-600 hover:text-red-800">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        </tr>
    `).join('');
}

function openItemTransferModal() {
    alert('Item Transfer modal coming soon...');
}

// ==================== PAYMENT HISTORY ====================

let paymentHistoryData = [];

async function loadPaymentHistory() {
    const monthFilter = document.getElementById('payment-history-month-filter').value;
    const searchInput = document.getElementById('payment-history-search');
    if (searchInput) searchInput.value = '';
    
    try {
        showTableLoading('payment-history-body', 'Loading payment history...');
        let url = `${API_BASE}/employee-payments`;
        if (monthFilter) {
            url += `?month=${monthFilter}`;
        }
        
        const response = await fetch(url);
        const payments = await response.json();
        paymentHistoryData = payments;
        
        // Populate month filter if empty
        if (!monthFilter) {
            populateMonthFilter(payments);
        }
        
        renderPaymentHistory(payments);
    } catch (error) {
        console.error('Error loading payment history:', error);
        document.getElementById('payment-history-body').innerHTML = '<tr><td colspan="12" class="px-3 py-8 text-center text-red-400 text-sm">Error loading payment history.</td></tr>';
    }
}

function populateMonthFilter(payments) {
    const select = document.getElementById('payment-history-month-filter');
    const currentSelection = select.value;
    
    // Get unique months
    const months = [...new Set(payments.map(p => p.month))].sort().reverse();
    
    select.innerHTML = '<option value="">All Months</option>';
    months.forEach(month => {
        const [year, mon] = month.split('-');
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const label = `${monthNames[parseInt(mon) - 1]} ${year}`;
        select.innerHTML += `<option value="${month}">${label}</option>`;
    });
    
    select.value = currentSelection;
}

function renderPaymentHistory(payments) {
    const tbody = document.getElementById('payment-history-body');
    const summary = document.getElementById('payment-history-summary');
    
    if (!payments || payments.length === 0) {
        tbody.innerHTML = '<tr><td colspan="12" class="px-3 py-8 text-center text-gray-400 text-sm">No payment records found.</td></tr>';
        summary.textContent = '0 records';
        return;
    }
    
    // Sort by month descending, then by employee name
    payments.sort((a, b) => {
        if (b.month !== a.month) return b.month.localeCompare(a.month);
        const nameA = `${a.first_name} ${a.last_name}`.toLowerCase();
        const nameB = `${b.first_name} ${b.last_name}`.toLowerCase();
        return nameA.localeCompare(nameB);
    });
    
    let html = '';
    let totalGross = 0, totalNet = 0, totalPaid = 0, totalBalance = 0;
    
    payments.forEach((p, idx) => {
        totalGross += p.gross_amount || 0;
        totalNet += p.net_amount || 0;
        totalPaid += p.paid_amount || 0;
        totalBalance += p.balance || 0;
        
        const [year, mon] = p.month.split('-');
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const monthLabel = `${monthNames[parseInt(mon) - 1]} ${year}`;
        
        const paidDate = p.paid_at ? new Date(p.paid_at).toLocaleDateString() : '-';
        const signedStatus = p.signed_payslip_path ? '<span class="text-green-600"><i class="fas fa-check-circle"></i></span>' : '<span class="text-gray-400"><i class="fas fa-minus-circle"></i></span>';
        
        html += `<tr class="hover:bg-gray-50">
            <td class="px-3 py-2 text-xs text-gray-400">${idx + 1}</td>
            <td class="px-3 py-2 font-medium text-sm">${p.first_name} ${p.last_name}</td>
            <td class="px-3 py-2 text-xs text-gray-500">${p.emp_code || '-'}</td>
            <td class="px-3 py-2 text-xs text-gray-500">${monthLabel}</td>
            <td class="px-3 py-2 text-right text-sm font-bold text-green-800 bg-green-50">${(p.gross_amount || 0).toFixed(2)}</td>
            <td class="px-3 py-2 text-right text-sm font-bold text-red-700 bg-red-50">${(p.advance_amount || 0).toFixed(2)}</td>
            <td class="px-3 py-2 text-right text-sm font-bold text-blue-800 bg-blue-50">${(p.net_amount || 0).toFixed(2)}</td>
            <td class="px-3 py-2 text-right text-sm font-bold text-purple-800 bg-purple-50">${(p.paid_amount || 0).toFixed(2)}</td>
            <td class="px-3 py-2 text-right text-sm font-bold text-yellow-700 bg-yellow-50">${(p.carry_forward || 0).toFixed(2)}</td>
            <td class="px-3 py-2 text-right text-sm font-bold ${p.balance > 0 ? 'text-red-700' : 'text-green-700'} bg-orange-50">${(p.balance || 0).toFixed(2)}</td>
            <td class="px-3 py-2 text-center text-xs text-gray-500">${paidDate}</td>
            <td class="px-3 py-2 text-center">${signedStatus}</td>
            <td class="px-3 py-2 text-center">
                <button onclick="viewPaymentDetails(${p.id})" class="text-blue-600 hover:text-blue-800 text-xs mr-1" title="View Details"><i class="fas fa-eye"></i></button>
                ${p.signed_payslip_path ? `<button onclick="viewSignedPayslipHistory('${p.signed_payslip_path}')" class="text-green-600 hover:text-green-800 text-xs mr-1" title="View Signed Payslip"><i class="fas fa-signature"></i></button>` : ''}
                <button onclick="openUpdatePaymentModal(${p.id})" class="bg-amber-500 hover:bg-amber-600 text-white px-2 py-1 rounded text-xs mr-1" title="Update Paid Amount">Update</button>
                <button onclick="deletePayment(${p.id})" class="bg-red-500 hover:bg-red-600 text-white px-2 py-1 rounded text-xs" title="Delete">Delete</button>
            </td>
        </tr>`;
    });
    
    tbody.innerHTML = html;
    summary.textContent = `${payments.length} records | Gross: ${totalGross.toFixed(2)} | Paid: ${totalPaid.toFixed(2)} | Balance: ${totalBalance.toFixed(2)}`;
    
    window._paymentHistoryAllRows = tbody.innerHTML;
    if (typeof applyPaymentHistoryColumnVisibility === 'function') applyPaymentHistoryColumnVisibility();
}

function filterPaymentHistory() {
    const search = document.getElementById('payment-history-search').value.toLowerCase();
    if (!search) {
        renderPaymentHistory(paymentHistoryData);
        return;
    }
    
    const filtered = paymentHistoryData.filter(p => {
        const name = `${p.first_name} ${p.last_name}`.toLowerCase();
        const empCode = (p.emp_code || '').toLowerCase();
        const month = p.month.toLowerCase();
        return name.includes(search) || empCode.includes(search) || month.includes(search);
    });
    
    renderPaymentHistory(filtered);
}

function viewPaymentDetails(paymentId) {
    const payment = paymentHistoryData.find(p => p.id === paymentId);
    if (!payment) return;
    
    const [year, mon] = payment.month.split('-');
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const monthLabel = `${monthNames[parseInt(mon) - 1]} ${year}`;
    
    const details = `
        <div style="font-family: Arial, sans-serif; max-width: 500px;">
            <h3 style="margin: 0 0 16px; font-size: 18px; color: #1a2e5a;">Payment Details</h3>
            <table style="width: 100%; font-size: 14px;">
                <tr><td style="padding: 8px 0; color: #6b7280;"><strong>Employee:</strong></td><td style="padding: 8px 0;">${payment.first_name} ${payment.last_name}</td></tr>
                <tr><td style="padding: 8px 0; color: #6b7280;"><strong>Employee ID:</strong></td><td style="padding: 8px 0;">${payment.emp_code || '-'}</td></tr>
                <tr><td style="padding: 8px 0; color: #6b7280;"><strong>Month:</strong></td><td style="padding: 8px 0;">${monthLabel}</td></tr>
                <tr><td style="padding: 8px 0; color: #6b7280;"><strong>Gross Amount:</strong></td><td style="padding: 8px 0;">${(payment.gross_amount || 0).toFixed(2)}</td></tr>
                <tr><td style="padding: 8px 0; color: #6b7280;"><strong>Advance Amount:</strong></td><td style="padding: 8px 0;">${(payment.advance_amount || 0).toFixed(2)}</td></tr>
                <tr><td style="padding: 8px 0; color: #6b7280;"><strong>Net Amount:</strong></td><td style="padding: 8px 0;">${(payment.net_amount || 0).toFixed(2)}</td></tr>
                <tr><td style="padding: 8px 0; color: #6b7280;"><strong>Paid Amount:</strong></td><td style="padding: 8px 0; font-weight: bold; color: #059669;">${(payment.paid_amount || 0).toFixed(2)}</td></tr>
                <tr><td style="padding: 8px 0; color: #6b7280;"><strong>Carry Forward:</strong></td><td style="padding: 8px 0; font-weight: bold; color: #f59e0b;">${(payment.carry_forward || 0).toFixed(2)}</td></tr>
                <tr style="border-top: 1px solid #d1d5db;"><td style="padding: 8px 0; color: #6b7280;"><strong>Balance:</strong></td><td style="padding: 8px 0; font-weight: bold; color: ${payment.balance > 0 ? '#dc2626' : '#059669'};">${(payment.balance || 0).toFixed(2)}</td></tr>
                <tr><td style="padding: 8px 0; color: #6b7280;"><strong>Paid Date:</strong></td><td style="padding: 8px 0;">${payment.paid_at ? new Date(payment.paid_at).toLocaleString() : '-'}</td></tr>
            </table>
        </div>
    `;
    
    // Show in a simple alert for now (could be enhanced with a modal)
    const modal = document.createElement('div');
    modal.className = 'fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4';
    modal.innerHTML = `
        <div class="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            ${details}
            <button onclick="this.closest('.fixed').remove()" class="mt-4 w-full px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300">Close</button>
        </div>
    `;
    document.body.appendChild(modal);
}

function confirmDeletePayment(paymentId) {
    const payment = paymentHistoryData.find(p => p.id === paymentId);
    if (!payment) return;
const [year, mon] = payment.month.split('-');
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const monthLabel = `${monthNames[parseInt(mon) - 1]} ${year}`;

    const modal = document.createElement('div');
    modal.id = 'delete-payment-confirm-modal';
    modal.className = 'fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4';
    modal.innerHTML = `
        <div class="bg-white rounded-lg shadow-xl max-w-sm w-full p-6">
            <h3 class="text-lg font-bold text-gray-800 mb-2">Delete Payment?</h3>
            <p class="text-sm text-gray-600 mb-4">
                ${payment.first_name} ${payment.last_name} &mdash; ${monthLabel}<br>
                Paid: <strong>${(payment.paid_amount || 0).toFixed(2)}</strong>
            </p>
            <p class="text-xs text-red-600 mb-4">This action cannot be undone.</p>
            <div class="flex gap-2">
                <button onclick="proceedDeletePayment(${paymentId})" class="flex-1 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 text-sm font-semibold">Delete</button>
                <button onclick="document.getElementById('delete-payment-confirm-modal').remove()" class="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 text-sm font-semibold">Cancel</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
}

async function proceedDeletePayment(paymentId) {
const managerId = (typeof currentModuleManager !== 'undefined' && currentModuleManager) ? currentModuleManager.id : '';
    const url = `${API_BASE}/employee-payments/${paymentId}?manager_id=${managerId}`;
try {
        const response = await fetch(url, { method: 'DELETE' });
if (response.ok) {
            document.getElementById('delete-payment-confirm-modal')?.remove();
            alert('Payment record deleted successfully');
            loadPaymentHistory();
        } else {
            const error = await response.json();
            console.error('DELETE error:', error);
            alert('Error deleting payment: ' + (error.error || 'Unknown error'));
        }
    } catch (error) {
        console.error('Error deleting payment:', error);
        alert('Error deleting payment: ' + error.message);
    }
}

// Deprecated: kept for safety, now handled by confirmDeletePayment
function deletePayment(paymentId) {
    confirmDeletePayment(paymentId);
}

function openUpdatePaymentModal(paymentId) {
    const payment = paymentHistoryData.find(p => p.id === paymentId);
    if (!payment) return;

    const [year, mon] = payment.month.split('-');
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const monthLabel = `${monthNames[parseInt(mon) - 1]} ${year}`;
    const currentPaid = (payment.paid_amount || 0).toFixed(2);
    const netAmount = (payment.net_amount || 0).toFixed(2);

    const modal = document.createElement('div');
    modal.id = 'update-payment-modal';
    modal.className = 'fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4';
    modal.innerHTML = `
        <div class="bg-white rounded-lg shadow-xl max-w-sm w-full p-6">
            <h3 class="text-lg font-bold text-gray-800 mb-4">Update Payment</h3>
            <p class="text-sm text-gray-600 mb-4">${payment.first_name} ${payment.last_name} &mdash; ${monthLabel}</p>
            <div class="mb-4">
                <label class="block text-xs font-medium text-gray-700 mb-1">Net Amount</label>
                <input type="text" value="${netAmount}" disabled class="w-full px-3 py-2 border rounded text-sm bg-gray-100 text-gray-700">
            </div>
            <div class="mb-4">
                <label class="block text-xs font-medium text-gray-700 mb-1">Paid Amount</label>
                <input type="number" id="update-paid-amount" value="${currentPaid}" min="0" step="0.01" class="w-full px-3 py-2 border rounded text-sm" oninput="recalcUpdateBalance(${payment.net_amount || 0})">
            </div>
            <div class="mb-6">
                <label class="block text-xs font-medium text-gray-700 mb-1">New Balance</label>
                <input type="text" id="update-new-balance" value="${(payment.balance || 0).toFixed(2)}" disabled class="w-full px-3 py-2 border rounded text-sm bg-gray-100 font-bold ${payment.balance > 0 ? 'text-red-700' : 'text-green-700'}">
            </div>
            <div class="flex gap-2">
                <button onclick="savePaymentUpdate(${paymentId})" class="flex-1 px-4 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 text-sm font-semibold">Save</button>
                <button onclick="document.getElementById('update-payment-modal').remove()" class="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 text-sm font-semibold">Cancel</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
}

function recalcUpdateBalance(netAmount) {
    const paidInput = document.getElementById('update-paid-amount');
    const balanceInput = document.getElementById('update-new-balance');
    if (!paidInput || !balanceInput) return;
    const paid = parseFloat(paidInput.value) || 0;
    const balance = netAmount - paid;
    balanceInput.value = balance.toFixed(2);
    balanceInput.className = `w-full px-3 py-2 border rounded text-sm bg-gray-100 font-bold ${balance > 0 ? 'text-red-700' : 'text-green-700'}`;
}

async function savePaymentUpdate(paymentId) {
    const payment = paymentHistoryData.find(p => p.id === paymentId);
    if (!payment) return;

    const paidInput = document.getElementById('update-paid-amount');
    const paidAmount = parseFloat(paidInput.value) || 0;
    const balance = (payment.net_amount || 0) - paidAmount;

    const managerId = (typeof currentModuleManager !== 'undefined' && currentModuleManager) ? currentModuleManager.id : '';

    try {
        const response = await fetch(`${API_BASE}/employee-payments/${paymentId}?manager_id=${managerId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ paid_amount: paidAmount, balance: balance })
        });

        if (response.ok) {
            document.getElementById('update-payment-modal')?.remove();
            alert('Payment updated successfully');
            loadPaymentHistory();
        } else {
            const error = await response.json();
            alert('Error updating payment: ' + (error.error || 'Unknown error'));
        }
    } catch (error) {
        console.error('Error updating payment:', error);
        alert('Error updating payment: ' + error.message);
    }
}

function viewSignedPayslipHistory(path) {
    window.open(path, '_blank');
}

// ==================== ADVANCE PAYMENTS ====================

function initAdvancePayments() {
    const picker = document.getElementById('advance-month-picker');
    if (!picker.value) {
        const now = new Date();
        picker.value = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    }
    // Set default date to today
    const dateInput = document.getElementById('advance-date');
    if (!dateInput.value) {
        const now = new Date();
        dateInput.value = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    }
    updateAdvanceMonthLabel();
    loadAdvanceEmployees();
    loadAdvancePayments();
}

function changeAdvanceMonth(delta) {
    const picker = document.getElementById('advance-month-picker');
    const [year, month] = picker.value.split('-').map(Number);
    const newDate = new Date(year, month - 1 + delta, 1);
    const now = new Date();
    const currentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    if (newDate > currentMonth) return;
    picker.value = `${newDate.getFullYear()}-${String(newDate.getMonth() + 1).padStart(2, '0')}`;
    updateAdvanceMonthLabel();
    loadAdvancePayments();
}

function updateAdvanceMonthLabel() {
    const picker = document.getElementById('advance-month-picker');
    const [year, month] = picker.value.split('-').map(Number);
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const label = document.getElementById('advance-month-label');
    label.textContent = `${monthNames[month - 1]} ${year}`;
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    if (picker.value < currentMonth) {
        label.className = 'text-xs font-semibold min-w-[100px] text-center px-2 py-1 bg-yellow-200 text-yellow-800 rounded';
    } else {
        label.className = 'text-xs font-semibold text-gray-800 min-w-[100px] text-center';
    }
}

async function loadAdvanceEmployees() {
    try {
        const now = new Date();
        const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        const response = await fetch(`${API_BASE}/attendance?month=${currentMonth}`);
        const data = await response.json();
        const select = document.getElementById('advance-employee-select');
        select.innerHTML = '<option value="">Select Employee</option>';
        (data.employees || []).forEach(emp => {
            select.innerHTML += `<option value="${emp.id}">${emp.first_name} ${emp.last_name} (${emp.employee_id || '-'})</option>`;
        });
    } catch (error) {
        console.error('Error loading employees for advance:', error);
    }
}

async function loadAdvancePayments() {
    const month = document.getElementById('advance-month-picker').value;
    if (!month) return;
    updateAdvanceMonthLabel();

    try {
        showTableLoading('advance-payments-body', 'Loading advance payments...');
        const response = await fetch(`${API_BASE}/advance-payments?month=${month}`);
        const payments = await response.json();
        renderAdvancePayments(payments);
    } catch (error) {
        console.error('Error loading advance payments:', error);
        showTableError('advance-payments-body', 'Error loading advance payments.');
    }
}

function renderAdvancePayments(payments) {
    const tbody = document.getElementById('advance-payments-body');
    if (!payments || payments.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="px-3 py-4 text-center text-sm text-gray-400">No advance payments for this month</td></tr>';
        document.getElementById('advance-total').textContent = '';
        return;
    }

    let total = 0;
    let html = '';
    payments.forEach((p, idx) => {
        total += parseFloat(p.amount);
        html += `<tr class="hover:bg-gray-50">
            <td class="px-3 py-2 text-xs text-gray-400">${idx + 1}</td>
            <td class="px-3 py-2 text-sm font-medium">${p.first_name} ${p.last_name}</td>
            <td class="px-3 py-2 text-xs text-gray-500">${formatDate(p.date)}</td>
            <td class="px-3 py-2 text-right text-sm font-semibold">${parseFloat(p.amount).toFixed(2)}</td>
            <td class="px-3 py-2 text-xs text-gray-500">${p.notes || '-'}</td>
            <td class="px-3 py-2 text-center">
                <button onclick="deleteAdvancePayment(${p.id})" class="text-red-500 hover:text-red-700 text-xs"><i class="fas fa-trash"></i></button>
            </td>
        </tr>`;
    });
    tbody.innerHTML = html;
    document.getElementById('advance-total').textContent = `Total: ${total.toFixed(2)}`;
}

async function saveAdvancePayment(event) {
    event.preventDefault();
    const employee_id = document.getElementById('advance-employee-select').value;
    const amount = document.getElementById('advance-amount').value;
    const date = document.getElementById('advance-date').value;
    const notes = document.getElementById('advance-notes').value;

    if (!employee_id || !amount || !date) return;

    try {
        const response = await fetch(`${API_BASE}/advance-payments`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ employee_id, amount, date, notes })
        });
        const data = await response.json();
        if (!response.ok) {
            alert(data.error || 'Failed to save');
            return;
        }
        // Reset form
        document.getElementById('advance-amount').value = '';
        document.getElementById('advance-notes').value = '';
        loadAdvancePayments();
    } catch (error) {
        console.error('Error saving advance payment:', error);
    }
}

async function deleteAdvancePayment(id) {
    if (!currentModuleManager) {
        alert('Please select a module manager.');
        return;
    }
    if (!confirm('Delete this advance payment?')) return;
    try {
        await fetch(`${API_BASE}/advance-payments/${id}?manager_id=${currentModuleManager.id}`, { method: 'DELETE' });
        loadAdvancePayments();
    } catch (error) {
        console.error('Error deleting advance payment:', error);
    }
}

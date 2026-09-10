// ==================== PAYMENT CALCULATION ====================

function initPayrollCalculation() {
    const picker = document.getElementById('payroll-month-picker');
    if (!picker.value) {
        const now = new Date();
        picker.value = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    }
    updatePayrollMonthLabel();
    loadPayrollCalculation();
}

function changePayrollMonth(delta) {
    const picker = document.getElementById('payroll-month-picker');
    const [year, month] = picker.value.split('-').map(Number);
    const newDate = new Date(year, month - 1 + delta, 1);
    const now = new Date();
    const currentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    if (newDate > currentMonth) return; // prevent going to future months
    picker.value = `${newDate.getFullYear()}-${String(newDate.getMonth() + 1).padStart(2, '0')}`;
    updatePayrollMonthLabel();
    loadPayrollCalculation();
}

function updatePayrollMonthLabel() {
    const picker = document.getElementById('payroll-month-picker');
    const [year, month] = picker.value.split('-').map(Number);
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const label = document.getElementById('payroll-month-label');
    label.textContent = `${monthNames[month - 1]} ${year}`;
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    if (picker.value < currentMonth) {
        label.className = 'text-sm font-semibold min-w-[120px] text-center px-3 py-1 bg-yellow-200 text-yellow-800 rounded-lg';
    } else {
        label.className = 'text-sm font-semibold text-gray-800 min-w-[120px] text-center';
    }
}

async function loadPayrollCalculation() {
    const month = document.getElementById('payroll-month-picker').value;
    if (!month) return;
    updatePayrollMonthLabel();
    const searchInput = document.getElementById('payroll-search');
    if (searchInput) searchInput.value = '';

    try {
        showTableLoading('payroll-table-body', 'Loading payroll...');
        const [attResponse, advResponse, transferResponse, paymentResponse, carryForwardResponse] = await Promise.all([
            fetch(`${API_BASE}/attendance?month=${month}`),
            fetch(`${API_BASE}/advance-payments?month=${month}`),
            fetch(`${API_BASE}/employee-transfers/month?month=${month}`),
            fetch(`${API_BASE}/employee-payments?month=${month}`),
            fetch(`${API_BASE}/employee-payments/carry-forward?month=${month}`)
        ]);
        const data = await attResponse.json();
        const advances = await advResponse.json();
        const transfers = await transferResponse.json();
        const payments = await paymentResponse.json();
        const carryForwardMap = await carryForwardResponse.json();
        renderPayrollCalculation(data, month, advances, transfers, payments, carryForwardMap);
    } catch (error) {
        console.error('Error loading payroll data:', error);
    }
}

function renderPayrollCalculation(data, month, advances, transfers, payments, carryForwardMap = {}) {
    const { employees, attendanceMap, daysInMonth } = data;
    const [year, mon] = month.split('-');
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    const tbody = document.getElementById('payroll-table-body');
    const tfoot = document.getElementById('payroll-table-foot');
    if (typeof unlockColumnWidths === 'function') unlockColumnWidths('#payroll-table');

    // Build payment map
    const paymentMap = {};
    (payments || []).forEach(p => {
        paymentMap[p.employee_id] = p;
    });

    // Group transfers by employee database ID (emp_db_id)
    const transferMap = {};
    (transfers || []).forEach(t => {
        const empDbId = t.emp_db_id || t.employee_id;
        if (!transferMap[empDbId]) transferMap[empDbId] = [];
        transferMap[empDbId].push(t);
    });

    // Build advance totals per employee
    const advanceMap = {};
    const advanceDetails = {};
    (advances || []).forEach(a => {
        advanceMap[a.employee_id] = (advanceMap[a.employee_id] || 0) + parseFloat(a.amount);
        if (!advanceDetails[a.employee_id]) advanceDetails[a.employee_id] = [];
        advanceDetails[a.employee_id].push({ date: a.date, amount: parseFloat(a.amount), notes: a.notes || '' });
    });

    let totPresent = 0, totUnpaid = 0, totMedical = 0, totPaid = 0, totDayOff = 0, totCompassionate = 0, totWorking = 0, totGross = 0, totAdvance = 0, totNet = 0, totOvertime = 0;

    window._payslipData = [];
    let bodyHtml = '';
    employees.forEach((emp, idx) => {
        const empAtt = attendanceMap[emp.id] || {};
        let present = 0, unpaidLeave = 0, medicalLeave = 0, paidLeave = 0, dayOff = 0, compassionateLeave = 0, noRecord = 0;
        let totalPresentHours = 0, totalOvertimeHours = 0, totalRegularHours = 0;
        const workingHoursPerDay = emp.working_hours_per_day || 8;
        const overtimeMultiplier = emp.overtime_rate || 1;

        for (let d = 1; d <= daysInMonth; d++) {
            const dateStr = `${month}-${String(d).padStart(2, '0')}`;
            if (dateStr > todayStr) continue;
            const record = empAtt[dateStr];
            if (!record) { noRecord++; continue; }
            switch (record.status) {
                case 'present':
                    present++;
                    const hrs = parseFloat(record.hours) || workingHoursPerDay;
                    totalPresentHours += hrs;
                    if (hrs > workingHoursPerDay) {
                        totalRegularHours += workingHoursPerDay;
                        totalOvertimeHours += (hrs - workingHoursPerDay);
                    } else {
                        totalRegularHours += hrs;
                    }
                    break;
                case 'unpaid-leave': unpaidLeave++; break;
                case 'medical-leave': medicalLeave++; break;
                case 'paid-leave': paidLeave++; break;
                case 'day-off': dayOff++; break;
                case 'compassionate-leave': compassionateLeave++; break;
            }
        }

        const totalDays = present + unpaidLeave + medicalLeave + paidLeave + dayOff + compassionateLeave + noRecord;
        // Effective present days = regular hours / standard hours (so 4h out of 8h = 0.5 day)
        const effectivePresentDays = workingHoursPerDay > 0 ? totalRegularHours / workingHoursPerDay : present;
        // Working days = present days (paid leaves, medical, compassionate, day off are paid but not "working")
        const workingDays = present;
        const paidDays = effectivePresentDays + paidLeave + medicalLeave + compassionateLeave + dayOff;
        const remAmount = parseFloat(emp.remuneration) || 0;
        const remType = (emp.remuneration_type || '').toLowerCase();
        const empTransfers = transferMap[emp.id] || [];

        let grossAmount = 0;
        if (empTransfers.length > 0) {
            // Deduplicate multiple transfers on same date
            const dedupMap = {};
            empTransfers.slice().sort((a, b) => a.transfer_date.localeCompare(b.transfer_date)).forEach(t => {
                dedupMap[t.transfer_date] = t;
            });
            const dedupedTransfers = Object.values(dedupMap).sort((a, b) => a.transfer_date.localeCompare(b.transfer_date));
            const startDate = `${month}-01`;
            const endDate = `${month}-${String(daysInMonth).padStart(2, '0')}`;
            let currentFrom = startDate;
            let currentRemType = empTransfers[0].prev_remuneration_type || emp.remuneration_type || '';
            let currentRemAmount = parseFloat(empTransfers[0].prev_remuneration) || 0;
            const periods = [];
            dedupedTransfers.forEach(t => {
                const transferDate = t.transfer_date;
                const dayBefore = new Date(new Date(transferDate).getTime() - 86400000).toISOString().split('T')[0];
                const periodEnd = dayBefore < currentFrom ? currentFrom : dayBefore;
                if (currentFrom <= periodEnd) {
                    periods.push({ fromDate: currentFrom, toDate: periodEnd, remType: currentRemType, remAmount: currentRemAmount });
                }
                currentFrom = transferDate;
                currentRemType = t.new_remuneration_type || emp.remuneration_type || '';
                currentRemAmount = parseFloat(t.new_remuneration) || remAmount;
            });
            if (currentFrom <= endDate) {
                periods.push({ fromDate: currentFrom, toDate: endDate, remType: currentRemType, remAmount: currentRemAmount });
            }

            const paidStatuses = ['present', 'paid-leave', 'medical-leave', 'compassionate-leave', 'day-off'];
            periods.forEach(p => {
                const rType = (p.remType || '').toLowerCase();
                const pAmount = p.remAmount || 0;
                let periodPaidDays = 0;
                for (let dNum = 1; dNum <= daysInMonth; dNum++) {
                    const dateStr = `${month}-${String(dNum).padStart(2, '0')}`;
                    if (dateStr >= p.fromDate && dateStr <= p.toDate) {
                        const record = empAtt[dateStr];
                        if (record && paidStatuses.includes(record.status)) {
                            if (record.status === 'present') {
                                const hrs = parseFloat(record.hours) || workingHoursPerDay;
                                periodPaidDays += workingHoursPerDay > 0 ? Math.min(hrs, workingHoursPerDay) / workingHoursPerDay : 1;
                            } else {
                                periodPaidDays++;
                            }
                        }
                    }
                }
                let dailyR = 0;
                if (rType === 'daily' || rType === 'daily wage') {
                    dailyR = pAmount;
                } else if (rType === 'hourly') {
                    dailyR = pAmount * workingHoursPerDay;
                } else {
                    dailyR = daysInMonth > 0 ? pAmount / daysInMonth : 0;
                }
                grossAmount += dailyR * periodPaidDays;
            });
        } else {
            if (remType === 'monthly' || remType === 'salary') {
                grossAmount = totalDays > 0 ? (remAmount / daysInMonth) * paidDays : 0;
            } else if (remType === 'daily' || remType === 'daily wage') {
                grossAmount = remAmount * paidDays;
            } else if (remType === 'hourly') {
                grossAmount = remAmount * totalPresentHours;
            } else {
                grossAmount = totalDays > 0 ? (remAmount / daysInMonth) * paidDays : 0;
            }
        }

        // Calculate overtime pay
        // Hourly rate = daily rate / working hours per day
        // For monthly: daily rate = remAmount / daysInMonth; hourly = daily / workingHoursPerDay
        // For daily: hourly = remAmount / workingHoursPerDay
        // For hourly: hourly = remAmount
        let hourlyRate = 0;
        if (remType === 'hourly') {
            hourlyRate = remAmount;
        } else if (remType === 'daily' || remType === 'daily wage') {
            hourlyRate = remAmount / workingHoursPerDay;
        } else {
            // monthly/salary
            hourlyRate = daysInMonth > 0 ? (remAmount / daysInMonth) / workingHoursPerDay : 0;
        }
        const overtimeAmount = totalOvertimeHours * hourlyRate * overtimeMultiplier;
        grossAmount += overtimeAmount;

        const empAdvance = advanceMap[emp.id] || 0;
        const carryForward = (carryForwardMap[emp.id] || 0);
        const netAmount = grossAmount - empAdvance + carryForward;
        
        // Get existing payment data
        const existingPayment = paymentMap[emp.id];
        const paidAmount = existingPayment ? existingPayment.paid_amount : 0;
        const balance = existingPayment ? existingPayment.balance : netAmount;
        const isPaid = existingPayment && paidAmount > 0;

        // Store payslip data for this employee
        window._payslipData.push({
            id: emp.id,
            name: `${emp.first_name} ${emp.last_name}`,
            empId: emp.employee_id || '-',
            email: emp.email || '',
            phone: emp.phone || '',
            department: emp.department || '-',
            position: emp.position || '-',
            remType: emp.remuneration_type || '-',
            remAmount, month, daysInMonth,
            workingHoursPerDay, overtimeMultiplier,
            present, effectivePresentDays, unpaidLeave, medicalLeave, paidLeave, dayOff, compassionateLeave,
            totalPresentHours, totalRegularHours, totalOvertimeHours, overtimeAmount,
            totalDays, paidDays, workingDays,
            grossAmount, empAdvance, netAmount,
            empAtt: empAtt,
            advanceDetails: advanceDetails[emp.id] || [],
            termination_date: emp.termination_date ? emp.termination_date.substring(0, 10) : null,
            is_terminated: emp.is_terminated || 0,
            paidAmount: paidAmount,
            balance: balance,
            carryForward: carryForward
        });

        totPresent += present;
        totUnpaid += unpaidLeave;
        totMedical += medicalLeave;
        totPaid += paidLeave;
        totDayOff += dayOff;
        totCompassionate += compassionateLeave;
        totWorking += workingDays;
        totOvertime += overtimeAmount;
        totGross += grossAmount;
        totAdvance += empAdvance;
        totNet += netAmount;

        bodyHtml += `<tr class="hover:bg-gray-50">
            <td class="px-3 py-1 text-xs text-gray-400">${idx + 1}</td>
            <td class="px-3 py-1 font-medium text-sm">${emp.first_name} ${emp.last_name}</td>
            <td class="px-3 py-1 text-xs text-gray-500">${emp.employee_id || '-'}</td>
            <td class="px-3 py-1 text-xs text-gray-500">${emp.department || '-'}</td>
            <td class="px-3 py-1 text-xs">${emp.remuneration_type || '-'}</td>
            <td class="px-3 py-1 text-right text-xs">${remAmount > 0 ? remAmount.toFixed(2) : '-'}</td>
            <td class="px-3 py-1 text-center text-xs font-bold text-green-700 bg-green-50">${present || '-'}</td>
            <td class="px-3 py-1 text-center text-xs font-bold text-red-700 bg-red-50">${unpaidLeave || '-'}</td>
            <td class="px-3 py-1 text-center text-xs font-bold text-purple-700 bg-purple-50">${medicalLeave || '-'}</td>
            <td class="px-3 py-1 text-center text-xs font-bold text-yellow-700 bg-yellow-50">${paidLeave || '-'}</td>
            <td class="px-3 py-1 text-center text-xs font-bold text-gray-600 bg-gray-100">${dayOff || '-'}</td>
            <td class="px-3 py-1 text-center text-xs font-bold text-orange-700 bg-orange-50">${compassionateLeave || '-'}</td>
            <td class="px-3 py-1 text-center text-xs font-semibold text-blue-700 bg-blue-50">${totalOvertimeHours > 0 ? totalOvertimeHours.toFixed(2) : '-'}</td>
            <td class="px-3 py-1 text-center text-xs font-semibold">${totalDays || '-'}</td>
            <td class="px-3 py-1 text-center text-xs font-semibold">${paidDays || '-'}</td>
            <td class="px-3 py-1 text-right text-sm font-bold text-green-800 bg-green-50">${grossAmount > 0 ? grossAmount.toFixed(2) : '-'}</td>
            <td class="px-3 py-1 text-right text-sm font-bold text-red-700 bg-red-50">${empAdvance > 0 ? empAdvance.toFixed(2) : '-'}</td>
            <td class="px-3 py-1 text-right text-sm font-bold ${netAmount < 0 ? 'text-red-700' : 'text-blue-800'} bg-blue-50">${netAmount !== 0 ? netAmount.toFixed(2) : '-'}</td>
            <td class="px-3 py-1 text-center">
                <input type="number" id="paid-amount-${emp.id}" class="w-20 px-2 py-1 border rounded text-xs text-center ${isPaid ? 'bg-gray-100' : ''}" value="${paidAmount || ''}" min="0" step="0.01" onchange="updatePaymentBalance(${emp.id}, ${netAmount})" ${isPaid ? 'disabled' : ''}>
            </td>
            <td class="px-3 py-1 text-center">
                <span id="balance-${emp.id}" class="text-xs font-semibold ${balance < 0 ? 'text-red-700' : 'text-green-700'}">${balance !== 0 ? balance.toFixed(2) : '-'}</span>
                ${carryForward !== 0 ? `<br><span class="text-xs ${carryForward < 0 ? 'text-red-600' : 'text-orange-600'}">CF: ${carryForward.toFixed(2)}</span>` : ''}
            </td>
            <td class="px-3 py-1 text-center">
                <button onclick="viewPayslip(${idx})" class="text-blue-600 hover:text-blue-800 text-xs"><i class="fas fa-eye mr-1"></i>View</button>
            </td>
            <td class="px-3 py-1 text-center">
                <button onclick="processPayment(${emp.id}, ${netAmount})" class="${isPaid ? 'bg-gray-400 text-white cursor-not-allowed' : 'bg-green-600 text-white hover:bg-green-700'} px-2 py-1 rounded text-xs" ${isPaid ? 'disabled' : ''}>
                    <i class="fas fa-${isPaid ? 'check' : 'money-bill'} mr-1"></i>${isPaid ? 'Paid' : 'Pay'}
                </button>
            </td>
        </tr>`;
    });

    tbody.innerHTML = bodyHtml;

    tfoot.innerHTML = `<tr>
        <td colspan="15" class="px-3 py-1 text-right text-xs font-bold uppercase">Totals</td>
        <td class="px-3 py-1 text-right text-sm font-bold text-green-800 bg-green-50">${totGross.toFixed(2)}</td>
        <td class="px-3 py-1 text-right text-sm font-bold text-red-700 bg-red-50">${totAdvance > 0 ? totAdvance.toFixed(2) : '-'}</td>
        <td class="px-3 py-1 text-right text-sm font-bold text-blue-800 bg-blue-50">${totNet.toFixed(2)}</td>
        <td></td>
        <td></td>
        <td></td>
        <td></td>
    </tr>`;

    document.getElementById('payroll-summary').textContent = `${employees.length} employees | ${month} | Gross: ${totGross.toFixed(2)} | Net: ${totNet.toFixed(2)}`;
    window._payrollAllRows = tbody.innerHTML;
    window._payrollAllCount = employees.length;
    window._payrollTotGross = totGross;
    window._payrollTotAdvance = totAdvance;
    window._payrollTotNet = totNet;
    window._payrollMonth = month;
    if (typeof applyPayrollColumnVisibility === 'function') applyPayrollColumnVisibility();
    if (typeof lockColumnWidths === 'function') lockColumnWidths('#payroll-table');
    if (typeof applyPayrollFreeze === 'function') applyPayrollFreeze();
}

function exportPayrollCSV() {
    if (!window._payslipData || window._payslipData.length === 0) {
        alert('No payroll data to export');
        return;
    }

    const [year, mon] = window._payrollMonth.split('-');
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const monthYear = `${monthNames[parseInt(mon) - 1]} ${year}`;
    const fileName = `Payroll_${monthYear.replace(/\s+/g, '_')}.csv`;

    // CSV headers
    const headers = [
        'No', 'Employee Name', 'Employee ID', 'Department', 'Position',
        'Remuneration Type', 'Remuneration Amount', 'Days in Month',
        'Present', 'Unpaid Leave', 'Medical Leave', 'Paid Leave', 'Day Off', 'Compassionate Leave',
        'Total Days', 'Paid Days', 'Overtime Hours', 'Overtime Amount',
        'Gross Amount', 'Advance', 'Net Amount', 'Paid Amount', 'Balance'
    ];

    // CSV rows
    const rows = window._payslipData.map((emp, idx) => [
        idx + 1,
        emp.name,
        emp.empId,
        emp.department,
        emp.position,
        emp.remType,
        emp.remAmount.toFixed(2),
        emp.daysInMonth,
        emp.present,
        emp.unpaidLeave,
        emp.medicalLeave,
        emp.paidLeave,
        emp.dayOff,
        emp.compassionateLeave,
        emp.totalDays,
        emp.paidDays,
        emp.totalOvertimeHours.toFixed(2),
        emp.overtimeAmount.toFixed(2),
        emp.grossAmount.toFixed(2),
        emp.empAdvance.toFixed(2),
        emp.netAmount.toFixed(2),
        (emp.paidAmount || 0).toFixed(2),
        (emp.balance !== undefined ? emp.balance : emp.netAmount).toFixed(2)
    ]);

    // Add totals row
    rows.push([
        '', 'TOTAL', '', '', '', '', '', '',
        '', '', '', '', '', '', '', '', '',
        window._payrollTotGross.toFixed(2),
        window._payrollTotAdvance.toFixed(2),
        window._payrollTotNet.toFixed(2),
        '', ''
    ]);

    // Escape CSV values
    function escapeCSV(value) {
        const str = String(value);
        if (str.includes(',') || str.includes('"') || str.includes('\n')) {
            return '"' + str.replace(/"/g, '""') + '"';
        }
        return str;
    }

    // Build CSV content
    const csvContent = [headers.map(escapeCSV).join(','), ...rows.map(row => row.map(escapeCSV).join(','))].join('\n');

    // Download CSV
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }, 100);
}

function updatePaymentBalance(empId, netAmount) {
    const paidInput = document.getElementById(`paid-amount-${empId}`);
    const balanceSpan = document.getElementById(`balance-${empId}`);
    const paidAmount = parseFloat(paidInput.value) || 0;
    const balance = netAmount - paidAmount;
    balanceSpan.textContent = balance.toFixed(2);
    balanceSpan.className = `text-xs font-semibold ${balance < 0 ? 'text-red-700' : 'text-green-700'}`;
}

async function processPayment(empId, netAmount) {
    const paidInput = document.getElementById(`paid-amount-${empId}`);
    const paidAmount = parseFloat(paidInput.value) || 0;
    const month = document.getElementById('payroll-month-picker').value;
    
    if (paidAmount <= 0) {
        alert('Please enter a paid amount greater than 0');
        return;
    }
    
    if (paidAmount > netAmount) {
        if (!confirm(`Paid amount (${paidAmount}) exceeds net amount (${netAmount.toFixed(2)}). Continue?`)) {
            return;
        }
    }
    
    const emp = window._payslipData.find(e => e.id === empId);
    if (!emp) {
        alert('Employee data not found');
        return;
    }
    
    const balance = netAmount - paidAmount;
    
    try {
        const response = await fetch(`${API_BASE}/employee-payments`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                employee_id: empId,
                month: month,
                net_amount: netAmount,
                paid_amount: paidAmount,
                balance: balance,
                gross_amount: emp.grossAmount,
                advance_amount: emp.empAdvance
            })
        });
        
        if (response.ok) {
            alert(`Payment recorded successfully!\nPaid: ${paidAmount.toFixed(2)}\nBalance: ${balance.toFixed(2)}`);
            // Update the payslip data
            emp.paidAmount = paidAmount;
            emp.balance = balance;
            // Disable the pay button
            const payBtn = document.querySelector(`button[onclick="processPayment(${empId}, ${netAmount})"]`);
            if (payBtn) {
                payBtn.disabled = true;
                payBtn.className = 'bg-gray-400 text-white px-2 py-1 rounded text-xs cursor-not-allowed';
                payBtn.innerHTML = '<i class="fas fa-check mr-1"></i>Paid';
            }
            // Disable the paid amount input
            paidInput.disabled = true;
            paidInput.className = 'w-20 px-2 py-1 border rounded text-xs text-center bg-gray-100';
        } else {
            const error = await response.json();
            alert('Error recording payment: ' + (error.error || 'Unknown error'));
        }
    } catch (error) {
        console.error('Error processing payment:', error);
        alert('Error processing payment: ' + error.message);
    }
}

function filterPayrollCalculation() {
    const tbody = document.getElementById('payroll-table-body');
    if (!tbody || !window._payrollAllRows) return;
    const search = (document.getElementById('payroll-search')?.value || '').toLowerCase().trim();
    const searchInput = document.getElementById('payroll-search');
    const clearBtn = document.getElementById('payroll-search-clear');
    
    if (searchInput) {
        if (search) {
            searchInput.classList.add('border-yellow-400', 'bg-yellow-100', 'filter-active-blink');
        } else {
            searchInput.classList.remove('border-yellow-400', 'bg-yellow-100', 'filter-active-blink');
        }
    }
    
    // Show/hide clear button
    if (clearBtn) {
        clearBtn.classList.toggle('hidden', !search);
    }
    
    if (!search) {
        tbody.innerHTML = window._payrollAllRows;
        document.getElementById('payroll-summary').textContent = `${window._payrollAllCount} employees | ${window._payrollMonth} | Gross: ${window._payrollTotGross.toFixed(2)} | Net: ${window._payrollTotNet.toFixed(2)}`;
        if (typeof applyPayrollFreeze === 'function') applyPayrollFreeze();
        return;
    }
    const allRows = tbody.querySelectorAll('tr');
    let visibleCount = 0;
    allRows.forEach(row => {
        const cells = row.querySelectorAll('td');
        if (cells.length < 3) return;
        const name = (cells[1]?.textContent || '').toLowerCase();
        const empId = (cells[2]?.textContent || '').toLowerCase();
        if (name.includes(search) || empId.includes(search)) {
            row.style.display = '';
            visibleCount++;
        } else {
            row.style.display = 'none';
        }
    });
    document.getElementById('payroll-summary').textContent = `${visibleCount} of ${window._payrollAllCount} employees | ${window._payrollMonth} | Gross: ${window._payrollTotGross.toFixed(2)} | Net: ${window._payrollTotNet.toFixed(2)}`;
}

function clearPayrollSearch() {
    const searchInput = document.getElementById('payroll-search');
    if (searchInput) {
        searchInput.value = '';
        filterPayrollCalculation();
    }
}

// ==================== ATTENDANCE REGISTER ====================

const ATTENDANCE_STATUSES = {
    'present':            { label: 'P',  color: 'bg-green-200 text-green-800', title: 'Present' },
    'unpaid-leave':       { label: 'A',  color: 'bg-red-200 text-red-800', title: 'Unpaid Leave' },
    'medical-leave':      { label: 'ML', color: 'bg-purple-200 text-purple-800', title: 'Medical Leave' },
    'paid-leave':         { label: 'PL', color: 'bg-yellow-200 text-yellow-800', title: 'Paid Leave' },
    'day-off':            { label: 'D',  color: 'bg-gray-200 text-gray-800', title: 'Day Off' },
    'compassionate-leave':{ label: 'CL', color: 'bg-orange-200 text-orange-800', title: 'Compassionate Leave' }
};

// Base status order for cycling (ML, D, CL are conditional based on entitlements)
const BASE_STATUS_ORDER = ['present', 'unpaid-leave', 'paid-leave'];

let attendanceData = null;

function initAttendanceRegister() {
    const picker = document.getElementById('attendance-month-picker');
    if (!picker.value) {
        const now = new Date();
        picker.value = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    }
    updateMonthLabel();
    loadAttendanceRegister();
}

function changeAttendanceMonth(delta) {
    const picker = document.getElementById('attendance-month-picker');
    const [year, month] = picker.value.split('-').map(Number);
    const newDate = new Date(year, month - 1 + delta, 1);
    const now = new Date();
    const currentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    if (newDate > currentMonth) return; // prevent going to future months
    picker.value = `${newDate.getFullYear()}-${String(newDate.getMonth() + 1).padStart(2, '0')}`;
    updateMonthLabel();
    loadAttendanceRegister();
}

function updateMonthLabel() {
    const picker = document.getElementById('attendance-month-picker');
    const [year, month] = picker.value.split('-').map(Number);
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const label = document.getElementById('attendance-month-label');
    label.textContent = `${monthNames[month - 1]} ${year}`;
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    if (picker.value < currentMonth) {
        label.className = 'text-sm font-semibold min-w-[120px] text-center px-3 py-1 bg-yellow-200 text-yellow-800 rounded-lg';
    } else {
        label.className = 'text-sm font-semibold text-gray-800 min-w-[120px] text-center';
    }
}

async function loadAttendanceRegister() {
    const month = document.getElementById('attendance-month-picker').value;
    if (!month) return;
    updateMonthLabel();

    try {
        const response = await fetch(`${API_BASE}/attendance?month=${month}`);
        attendanceData = await response.json();

        // Auto-fill missing past/today dates as 'present'
        await autoFillPresentForMonth();

        renderAttendanceRegister();
        updateLockUI();
    } catch (error) {
        console.error('Error loading attendance:', error);
    }
}

function updateLockUI() {
    if (!attendanceData) return;
    const { month, isLocked } = attendanceData;
    const lockBtn = document.getElementById('attendance-lock-btn');
    const lockStatus = document.getElementById('attendance-lock-status');
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    if (isLocked) {
        // Show locked status and unlock button
        lockBtn.classList.remove('hidden', 'bg-red-600', 'bg-green-600');
        lockBtn.classList.add('bg-orange-500', 'text-white', 'hover:bg-orange-600');
        lockBtn.innerHTML = '<i class="fas fa-unlock mr-1"></i><span>Unlock</span>';
        lockBtn.style.display = '';
        lockStatus.textContent = '🔒 Locked';
        lockStatus.className = 'text-sm font-medium text-red-600';
        lockStatus.classList.remove('hidden');
    } else if (month < currentMonth) {
        // Past month, not locked — show lock button
        lockBtn.classList.remove('hidden', 'bg-orange-500', 'bg-green-600');
        lockBtn.classList.add('bg-red-600', 'text-white', 'hover:bg-red-700');
        lockBtn.innerHTML = '<i class="fas fa-lock mr-1"></i><span>Lock Data</span>';
        lockBtn.style.display = '';
        lockStatus.classList.add('hidden');
    } else {
        // Current or future month — hide lock button
        lockBtn.classList.add('hidden');
        lockStatus.classList.add('hidden');
    }
}

async function toggleAttendanceLock() {
    if (!attendanceData) return;
    const { month, isLocked } = attendanceData;
    const action = isLocked ? 'unlock' : 'lock';
    const confirmMsg = isLocked
        ? `Are you sure you want to unlock ${month}? This will allow editing.`
        : `Are you sure you want to lock ${month}? No edits will be allowed after locking.`;

    if (!confirm(confirmMsg)) return;

    try {
        const response = await fetch(`${API_BASE}/attendance/${action}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ month })
        });
        const data = await response.json();
        if (!response.ok) {
            alert(data.error || 'Failed to ' + action);
            return;
        }
        // Reload to reflect new state
        loadAttendanceRegister();
    } catch (error) {
        console.error('Error toggling lock:', error);
    }
}

async function autoFillPresentForMonth() {
    if (!attendanceData) return;
    const { employees, attendanceMap, daysInMonth, month } = attendanceData;
    const today = new Date();
    const currentMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;

    // Only auto-fill for the current month, not past months
    if (month !== currentMonth) return;

    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

    const bulkRecords = [];
    employees.forEach(emp => {
        const empAtt = attendanceMap[emp.id] || {};
        for (let d = 1; d <= daysInMonth; d++) {
            const dateStr = `${month}-${String(d).padStart(2, '0')}`;
            if (dateStr > todayStr) continue; // skip future
            if (empAtt[dateStr]) continue; // already has a record
            bulkRecords.push({ employee_id: emp.id, date: dateStr, status: 'present' });
            // Update local data immediately
            if (!attendanceMap[emp.id]) attendanceMap[emp.id] = {};
            attendanceMap[emp.id][dateStr] = { status: 'present' };
        }
    });

    if (bulkRecords.length > 0) {
        try {
            await fetch(`${API_BASE}/attendance/bulk`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ records: bulkRecords })
            });
        } catch (error) {
            console.error('Error auto-filling attendance:', error);
        }
    }
}

function renderAttendanceRegister() {
    if (!attendanceData) return;
    const { employees, attendanceMap, daysInMonth, month, isLocked } = attendanceData;
    const [year, mon] = month.split('-');
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

    // Build header row with day numbers and day names
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    let headerHtml = `<tr>
        <th class="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase sticky left-0 bg-gray-50 z-10 min-w-[40px]">#</th>
        <th class="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase sticky left-[40px] bg-gray-50 z-10 min-w-[120px]">Employee</th>
        <th class="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase sticky left-[160px] bg-gray-50 z-10 min-w-[80px]">Dept</th>`;
    
    for (let d = 1; d <= daysInMonth; d++) {
        const dateObj = new Date(year, mon - 1, d);
        const dayName = dayNames[dateObj.getDay()];
        const isSunday = dateObj.getDay() === 0;
        const dateStr = `${month}-${String(d).padStart(2, '0')}`;
        const isToday = dateStr === todayStr;
        headerHtml += `<th class="px-1 py-1 text-center text-xs font-medium min-w-[32px] ${isSunday ? 'bg-red-50 text-red-500' : 'text-gray-500'} ${isToday ? 'ring-2 ring-blue-400' : ''}" title="${dateStr}">
            <div>${d}</div>
            <div class="text-[10px] font-normal">${dayName}</div>
        </th>`;
    }
    headerHtml += `<th class="px-2 py-2 text-center text-xs font-medium text-gray-500 uppercase min-w-[30px]" title="Present">P</th>`;
    headerHtml += `<th class="px-2 py-2 text-center text-xs font-medium text-gray-500 uppercase min-w-[30px]" title="Unpaid Leave">A</th>`;
    headerHtml += `<th class="px-2 py-2 text-center text-xs font-medium text-gray-500 uppercase min-w-[30px]" title="Medical Leave">ML</th>`;
    headerHtml += `<th class="px-2 py-2 text-center text-xs font-medium text-gray-500 uppercase min-w-[30px]" title="Paid Leave">PL</th>`;
    headerHtml += `<th class="px-2 py-2 text-center text-xs font-medium text-gray-500 uppercase min-w-[30px]" title="Day Off">D</th>`;
    headerHtml += `<th class="px-2 py-2 text-center text-xs font-medium text-gray-500 uppercase min-w-[30px]" title="Compassionate Leave">CL</th>`;
    headerHtml += `</tr>`;
    document.getElementById('attendance-table-head').innerHTML = headerHtml;

    // Build body rows
    let bodyHtml = '';
    employees.forEach((emp, idx) => {
        const empAttendance = attendanceMap[emp.id] || {};
        let pCount = 0, aCount = 0, mlCount = 0, plCount = 0, dCount = 0, clCount = 0;

        bodyHtml += `<tr class="hover:bg-gray-50">
            <td class="px-2 py-1 whitespace-nowrap sticky left-0 bg-white z-10 text-xs text-gray-400">${idx + 1}</td>
            <td class="px-2 py-1 whitespace-nowrap sticky left-[40px] bg-white z-10 font-medium text-xs" title="${emp.employee_id || ''}">${emp.first_name} ${emp.last_name}</td>
            <td class="px-2 py-1 whitespace-nowrap sticky left-[160px] bg-white z-10 text-xs text-gray-500">${emp.department || '-'}</td>`;
        
        for (let d = 1; d <= daysInMonth; d++) {
            const dateStr = `${month}-${String(d).padStart(2, '0')}`;
            const dateObj = new Date(year, mon - 1, d);
            const isSunday = dateObj.getDay() === 0;
            const isFuture = dateStr > todayStr;
            const record = empAttendance[dateStr];
            const status = record ? record.status : null;

            if (status === 'present') pCount++;
            else if (status === 'unpaid-leave') aCount++;
            else if (status === 'medical-leave') mlCount++;
            else if (status === 'paid-leave') plCount++;
            else if (status === 'day-off') dCount++;
            else if (status === 'compassionate-leave') clCount++;

            const statusInfo = status ? ATTENDANCE_STATUSES[status] : null;
            const cellBg = isFuture ? 'bg-gray-50' : (statusInfo ? statusInfo.color : (isSunday ? 'bg-red-50' : ''));
            const cellText = statusInfo ? statusInfo.label : (isFuture ? '' : '-');
            const isToday = dateStr === todayStr;

            const cellDisabled = isFuture || isLocked;
            bodyHtml += `<td class="px-0 py-0 text-center ${isToday ? 'ring-2 ring-blue-400 ring-inset' : ''}">
                <button onclick="cycleAttendance(${emp.id}, '${dateStr}', this)" 
                    class="w-full h-full px-1 py-1 text-xs font-medium ${cellBg} ${cellDisabled ? 'opacity-60 cursor-not-allowed' : 'hover:opacity-80 cursor-pointer'} transition" 
                    title="${statusInfo ? statusInfo.title : 'Click to set'} - ${dateStr}${isLocked ? ' (Locked)' : ''}"
                    ${cellDisabled ? 'disabled' : ''}
                    data-employee-id="${emp.id}" data-date="${dateStr}" data-status="${status || ''}">
                    ${cellText}
                </button>
            </td>`;
        }

        bodyHtml += `<td class="px-1 py-1 text-center text-xs font-bold text-green-700">${pCount}</td>`;
        bodyHtml += `<td class="px-1 py-1 text-center text-xs font-bold text-red-700">${aCount}</td>`;
        bodyHtml += `<td class="px-1 py-1 text-center text-xs font-bold text-purple-700">${mlCount}</td>`;
        bodyHtml += `<td class="px-1 py-1 text-center text-xs font-bold text-yellow-700">${plCount}</td>`;
        bodyHtml += `<td class="px-1 py-1 text-center text-xs font-bold text-gray-600">${dCount}</td>`;
        bodyHtml += `<td class="px-1 py-1 text-center text-xs font-bold text-orange-700">${clCount}</td>`;
        bodyHtml += `</tr>`;
    });

    document.getElementById('attendance-table-body').innerHTML = bodyHtml;

    // Summary
    document.getElementById('attendance-summary').textContent = `${employees.length} employees | ${month}`;
}

async function cycleAttendance(employeeId, date, btn) {
    // Prevent editing locked months
    if (attendanceData && attendanceData.isLocked) return;

    // Build status order: include ML, D, CL only if employee is entitled, clear at end
    let statusOrder = [...BASE_STATUS_ORDER];
    if (attendanceData && attendanceData.leaveEntitlements) {
        const empEntitlements = attendanceData.leaveEntitlements[employeeId] || [];
        const hasML = empEntitlements.some(e => e.leave_type && e.leave_type.toLowerCase().includes('medical'));
        const hasD = empEntitlements.some(e => e.leave_type && (e.leave_type.toLowerCase().includes('day off') || e.leave_type.toLowerCase().includes('dayoff') || e.leave_type.toLowerCase().includes('day-off')));
        const hasCL = empEntitlements.some(e => e.leave_type && e.leave_type.toLowerCase().includes('compassionate'));
        if (hasML) statusOrder.push('medical-leave');
        if (hasD) statusOrder.push('day-off');
        if (hasCL) statusOrder.push('compassionate-leave');
    }
    // Add clear as last option to allow undo
    statusOrder.push('');

    const currentStatus = btn.dataset.status || '';
    let currentIdx = statusOrder.indexOf(currentStatus);
    if (currentIdx === -1) currentIdx = statusOrder.length - 1; // treat unknown as clear
    const nextIdx = (currentIdx + 1) % statusOrder.length;
    const newStatus = statusOrder[nextIdx];

    if (!newStatus) {
        // Clear attendance
        try {
            await fetch(`${API_BASE}/attendance/${employeeId}/${date}`, { method: 'DELETE' });
            btn.dataset.status = '';
            updateAttendanceCell(btn, '');
            updateAttendanceData(employeeId, date, null);
        } catch (error) {
            console.error('Error clearing attendance:', error);
        }
    } else {
        try {
            await fetch(`${API_BASE}/attendance`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ employee_id: employeeId, date, status: newStatus })
            });
            btn.dataset.status = newStatus;
            updateAttendanceCell(btn, newStatus);
            updateAttendanceData(employeeId, date, newStatus);
        } catch (error) {
            console.error('Error saving attendance:', error);
        }
    }
}

function updateAttendanceCell(btn, status) {
    const statusInfo = status ? ATTENDANCE_STATUSES[status] : null;
    // Remove all status classes
    btn.className = btn.className.replace(/bg-\w+-\d+/g, '').replace(/text-\w+-\d+/g, '');
    btn.className = `w-full h-full px-1 py-1 text-xs font-medium hover:opacity-80 transition cursor-pointer ${statusInfo ? statusInfo.color : ''}`;
    btn.textContent = statusInfo ? statusInfo.label : '-';
    btn.title = (statusInfo ? statusInfo.title : 'Click to set') + ' - ' + btn.dataset.date;

    // Update row totals
    updateRowTotals(btn);
}

function updateRowTotals(btn) {
    const row = btn.closest('tr');
    if (!row) return;
    const cells = row.querySelectorAll('button[data-status]');
    let pCount = 0, aCount = 0, mlCount = 0, plCount = 0, dCount = 0, clCount = 0;
    cells.forEach(cell => {
        const s = cell.dataset.status;
        if (s === 'present') pCount++;
        else if (s === 'unpaid-leave') aCount++;
        else if (s === 'medical-leave') mlCount++;
        else if (s === 'paid-leave') plCount++;
        else if (s === 'day-off') dCount++;
        else if (s === 'compassionate-leave') clCount++;
    });
    const tds = row.querySelectorAll('td');
    const totalCells = Array.from(tds).slice(-6);
    if (totalCells[0]) totalCells[0].textContent = pCount;
    if (totalCells[1]) totalCells[1].textContent = aCount;
    if (totalCells[2]) totalCells[2].textContent = mlCount;
    if (totalCells[3]) totalCells[3].textContent = plCount;
    if (totalCells[4]) totalCells[4].textContent = dCount;
    if (totalCells[5]) totalCells[5].textContent = clCount;
}

function updateAttendanceData(employeeId, date, status) {
    if (!attendanceData) return;
    if (!attendanceData.attendanceMap[employeeId]) {
        attendanceData.attendanceMap[employeeId] = {};
    }
    if (status) {
        attendanceData.attendanceMap[employeeId][date] = { status };
    } else {
        delete attendanceData.attendanceMap[employeeId][date];
    }
}

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

    try {
        const [attResponse, advResponse, transferResponse] = await Promise.all([
            fetch(`${API_BASE}/attendance?month=${month}`),
            fetch(`${API_BASE}/advance-payments?month=${month}`),
            fetch(`${API_BASE}/employee-transfers/month?month=${month}`)
        ]);
        const data = await attResponse.json();
        const advances = await advResponse.json();
        const transfers = await transferResponse.json();
        renderPayrollCalculation(data, month, advances, transfers);
    } catch (error) {
        console.error('Error loading payroll data:', error);
    }
}

function renderPayrollCalculation(data, month, advances, transfers) {
    const { employees, attendanceMap, daysInMonth } = data;
    const [year, mon] = month.split('-');
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    const tbody = document.getElementById('payroll-table-body');
    const tfoot = document.getElementById('payroll-table-foot');

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
        advanceDetails[a.employee_id].push({ date: a.date, amount: parseFloat(a.amount) });
    });

    let totPresent = 0, totUnpaid = 0, totMedical = 0, totPaid = 0, totDayOff = 0, totCompassionate = 0, totWorking = 0, totGross = 0, totAdvance = 0, totNet = 0;

    window._payslipData = [];
    let bodyHtml = '';
    employees.forEach((emp, idx) => {
        const empAtt = attendanceMap[emp.id] || {};
        let present = 0, unpaidLeave = 0, medicalLeave = 0, paidLeave = 0, dayOff = 0, compassionateLeave = 0, noRecord = 0;

        for (let d = 1; d <= daysInMonth; d++) {
            const dateStr = `${month}-${String(d).padStart(2, '0')}`;
            if (dateStr > todayStr) continue;
            const record = empAtt[dateStr];
            if (!record) { noRecord++; continue; }
            switch (record.status) {
                case 'present': present++; break;
                case 'unpaid-leave': unpaidLeave++; break;
                case 'medical-leave': medicalLeave++; break;
                case 'paid-leave': paidLeave++; break;
                case 'day-off': dayOff++; break;
                case 'compassionate-leave': compassionateLeave++; break;
            }
        }

        const totalDays = present + unpaidLeave + medicalLeave + paidLeave + dayOff + compassionateLeave + noRecord;
        // Working days = present days (paid leaves, medical, compassionate, day off are paid but not "working")
        const workingDays = present;
        const paidDays = present + paidLeave + medicalLeave + compassionateLeave + dayOff;
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
                            periodPaidDays++;
                        }
                    }
                }
                let dailyR = 0;
                if (rType === 'daily' || rType === 'daily wage') {
                    dailyR = pAmount;
                } else if (rType === 'hourly') {
                    dailyR = pAmount * 8;
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
                grossAmount = remAmount * workingDays * 8;
            } else {
                grossAmount = totalDays > 0 ? (remAmount / daysInMonth) * paidDays : 0;
            }
        }

        const empAdvance = advanceMap[emp.id] || 0;
        const netAmount = grossAmount - empAdvance;

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
            present, unpaidLeave, medicalLeave, paidLeave, dayOff, compassionateLeave,
            totalDays, paidDays, workingDays,
            grossAmount, empAdvance, netAmount,
            empAtt: empAtt,
            advanceDetails: advanceDetails[emp.id] || []
        });

        totPresent += present;
        totUnpaid += unpaidLeave;
        totMedical += medicalLeave;
        totPaid += paidLeave;
        totDayOff += dayOff;
        totCompassionate += compassionateLeave;
        totWorking += workingDays;
        totGross += grossAmount;
        totAdvance += empAdvance;
        totNet += netAmount;

        bodyHtml += `<tr class="hover:bg-gray-50">
            <td class="px-3 py-2 text-xs text-gray-400">${idx + 1}</td>
            <td class="px-3 py-2 font-medium text-sm">${emp.first_name} ${emp.last_name}</td>
            <td class="px-3 py-2 text-xs text-gray-500">${emp.employee_id || '-'}</td>
            <td class="px-3 py-2 text-xs text-gray-500">${emp.department || '-'}</td>
            <td class="px-3 py-2 text-xs">${emp.remuneration_type || '-'}</td>
            <td class="px-3 py-2 text-right text-xs">${remAmount > 0 ? remAmount.toFixed(2) : '-'}</td>
            <td class="px-3 py-2 text-center text-xs font-bold text-green-700 bg-green-50">${present}</td>
            <td class="px-3 py-2 text-center text-xs font-bold text-red-700 bg-red-50">${unpaidLeave}</td>
            <td class="px-3 py-2 text-center text-xs font-bold text-purple-700 bg-purple-50">${medicalLeave}</td>
            <td class="px-3 py-2 text-center text-xs font-bold text-yellow-700 bg-yellow-50">${paidLeave}</td>
            <td class="px-3 py-2 text-center text-xs font-bold text-gray-600 bg-gray-100">${dayOff}</td>
            <td class="px-3 py-2 text-center text-xs font-bold text-orange-700 bg-orange-50">${compassionateLeave}</td>
            <td class="px-3 py-2 text-center text-xs font-semibold">${totalDays}</td>
            <td class="px-3 py-2 text-center text-xs font-semibold">${paidDays}</td>
            <td class="px-3 py-2 text-right text-sm font-bold text-green-800 bg-green-50">${grossAmount > 0 ? grossAmount.toFixed(2) : '-'}</td>
            <td class="px-3 py-2 text-right text-sm font-bold text-red-700 bg-red-50">${empAdvance > 0 ? empAdvance.toFixed(2) : '-'}</td>
            <td class="px-3 py-2 text-right text-sm font-bold ${netAmount < 0 ? 'text-red-700' : 'text-blue-800'} bg-blue-50">${netAmount !== 0 ? netAmount.toFixed(2) : '-'}</td>
            <td class="px-3 py-2 text-center">
                <button onclick="viewPayslip(${idx})" class="text-blue-600 hover:text-blue-800 text-xs"><i class="fas fa-eye mr-1"></i>View</button>
            </td>
        </tr>`;
    });

    tbody.innerHTML = bodyHtml;

    tfoot.innerHTML = `<tr>
        <td colspan="14" class="px-3 py-2 text-right text-xs font-bold uppercase">Totals</td>
        <td class="px-3 py-2 text-right text-sm font-bold text-green-800 bg-green-50">${totGross.toFixed(2)}</td>
        <td class="px-3 py-2 text-right text-sm font-bold text-red-700 bg-red-50">${totAdvance > 0 ? totAdvance.toFixed(2) : '-'}</td>
        <td class="px-3 py-2 text-right text-sm font-bold text-blue-800 bg-blue-50">${totNet.toFixed(2)}</td>
        <td></td>
    </tr>`;

    document.getElementById('payroll-summary').textContent = `${employees.length} employees | ${month} | Gross: ${totGross.toFixed(2)} | Net: ${totNet.toFixed(2)}`;
}

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
        const response = await fetch(`${API_BASE}/advance-payments?month=${month}`);
        const payments = await response.json();
        renderAdvancePayments(payments);
    } catch (error) {
        console.error('Error loading advance payments:', error);
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
            <td class="px-3 py-2 text-xs text-gray-500">${p.date}</td>
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

// ==================== PAYSLIP ====================

async function viewPayslip(idx) {
    const d = window._payslipData[idx];
    if (!d) return;

    const [year, mon] = d.month.split('-');
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const monthYear = `${monthNames[parseInt(mon) - 1]} ${year}`;
    const printDate = formatDate(new Date());

    // Fetch transfer periods for this employee in this month
    let transfers = [];
    let empLocation = '';
    try {
        const resp = await fetch(`${API_BASE}/employee-salary-periods?employee_id=${d.id}&month=${d.month}`);
        const periodData = await resp.json();
        transfers = periodData.transfers || [];
        empLocation = periodData.employee?.location_name || '-';
    } catch (e) { console.error('Error fetching transfer periods:', e); }

    // Build salary periods: segments of the month with different rates/locations
    let periods = [];
    const startDate = `${d.month}-01`;
    const endDate = `${d.month}-${String(d.daysInMonth).padStart(2, '0')}`;

    if (transfers.length === 0) {
        // No transfer this month — single period
        periods.push({
            location: empLocation,
            fromDate: startDate,
            toDate: endDate,
            remType: d.remType,
            remAmount: d.remAmount
        });
    } else {
        // Deduplicate transfers on the same date: keep only the last one per date
        // but use the first transfer's prev values as starting point
        const deduped = [];
        const firstPrev = {
            remType: transfers[0].prev_remuneration_type || d.remType,
            remAmount: parseFloat(transfers[0].prev_remuneration) || 0,
            location: transfers[0].from_location_name || '-'
        };
        for (let i = 0; i < transfers.length; i++) {
            const next = transfers[i + 1];
            if (next && next.transfer_date === transfers[i].transfer_date) {
                continue; // skip intermediate, keep only the last one for this date
            }
            deduped.push(transfers[i]);
        }

        // Build periods from deduplicated transfers
        let currentFrom = startDate;
        let currentRemType = firstPrev.remType;
        let currentRemAmount = firstPrev.remAmount;
        let currentLocation = firstPrev.location;

        deduped.forEach(t => {
            const transferDate = t.transfer_date;
            // Period before transfer
            const dayBefore = new Date(transferDate);
            dayBefore.setDate(dayBefore.getDate() - 1);
            const periodEnd = `${dayBefore.getFullYear()}-${String(dayBefore.getMonth()+1).padStart(2,'0')}-${String(dayBefore.getDate()).padStart(2,'0')}`;

            if (currentFrom <= periodEnd) {
                periods.push({
                    location: currentLocation,
                    fromDate: currentFrom,
                    toDate: periodEnd,
                    remType: currentRemType,
                    remAmount: currentRemAmount
                });
            }
            // Move to new period
            currentFrom = transferDate;
            currentRemType = t.new_remuneration_type || d.remType;
            currentRemAmount = parseFloat(t.new_remuneration) || d.remAmount;
            currentLocation = t.to_location_name || empLocation;
        });

        // Final period from last transfer to end of month
        periods.push({
            location: currentLocation,
            fromDate: currentFrom,
            toDate: endDate,
            remType: currentRemType,
            remAmount: currentRemAmount
        });
    }

    // Count actual paid days in each period from attendance records
    const paidStatuses = ['present', 'paid-leave', 'medical-leave', 'compassionate-leave', 'day-off'];
    periods.forEach(p => {
        let periodPaidDays = 0;
        for (let dNum = 1; dNum <= d.daysInMonth; dNum++) {
            const dateStr = `${d.month}-${String(dNum).padStart(2, '0')}`;
            if (dateStr >= p.fromDate && dateStr <= p.toDate) {
                const record = d.empAtt?.[dateStr];
                if (record && paidStatuses.includes(record.status)) {
                    periodPaidDays++;
                }
            }
        }
        p.days = periodPaidDays;
    });

    // Build location-wise earnings breakdown
    let locationBreakdownHtml = '';
    let totalLocationEarnings = 0;
    const hasMultiplePeriods = periods.length > 1;

    if (hasMultiplePeriods) {
        locationBreakdownHtml = `
            <div style="margin-bottom: 16px;">
                <h4 style="margin: 0 0 8px; font-size: 14px; color: #4338ca; border-bottom: 1px solid #d1d5db; padding-bottom: 4px;">LOCATION-WISE SALARY BREAKDOWN</h4>
                <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
                    <tr style="background: #f9fafb;">
                        <th style="text-align: left; padding: 6px 4px; color: #6b7280;">Location</th>
                        <th style="text-align: center; padding: 6px 4px; color: #6b7280;">Period</th>
                        <th style="text-align: center; padding: 6px 4px; color: #6b7280;">Days</th>
                        <th style="text-align: right; padding: 6px 4px; color: #6b7280;">Rate</th>
                        <th style="text-align: right; padding: 6px 4px; color: #6b7280;">Amount</th>
                    </tr>`;
        periods.forEach(p => {
            let dailyR = 0;
            const rType = (p.remType || '').toLowerCase();
            if (rType === 'daily' || rType === 'daily wage') {
                dailyR = p.remAmount;
            } else if (rType === 'hourly') {
                dailyR = p.remAmount * 8;
            } else {
                if (p.remAmount > 0 && d.daysInMonth > 0) {
                    dailyR = p.remAmount / d.daysInMonth;
                }
            }
            const periodAmt = dailyR * p.days;
            totalLocationEarnings += periodAmt;
            const fromStr = formatDateShort(p.fromDate);
            const toStr = formatDateShort(p.toDate);
            locationBreakdownHtml += `
                    <tr style="border-bottom: 1px solid #e5e7eb;">
                        <td style="padding: 5px 4px; font-size: 12px;">${p.location}</td>
                        <td style="padding: 5px 4px; text-align: center; font-size: 11px;">${fromStr} - ${toStr}</td>
                        <td style="padding: 5px 4px; text-align: center;">${p.days}</td>
                        <td style="padding: 5px 4px; text-align: right;">${p.remAmount.toFixed(2)} <span style="font-size:10px;color:#6b7280;">${rType === 'daily' || rType === 'daily wage' ? '/day' : '/mo'}</span></td>
                        <td style="padding: 5px 4px; text-align: right; font-weight: 600;">${periodAmt.toFixed(2)}</td>
                    </tr>`;
        });
        locationBreakdownHtml += `
                    <tr style="border-top: 2px solid #d1d5db; font-weight: bold;">
                        <td colspan="4" style="padding: 6px 4px; font-size: 13px;">Total Earnings (all locations)</td>
                        <td style="text-align: right; padding: 6px 4px; font-size: 13px; color: #4338ca;">${totalLocationEarnings.toFixed(2)}</td>
                    </tr>
                </table>
            </div>`;
    }

    // Calculate per-day rate for single-period breakdown
    let dailyRate = 0;
    const remTypeLower = (d.remType || '').toLowerCase();
    if (remTypeLower === 'daily' || remTypeLower === 'daily wage') {
        dailyRate = d.remAmount;
    } else if (remTypeLower === 'hourly') {
        dailyRate = d.remAmount * 8;
    } else {
        if (d.remAmount > 0 && d.daysInMonth > 0) {
            dailyRate = d.remAmount / d.daysInMonth;
        }
    }

    // Build earnings rows (attendance-based)
    let earningsHtml = '';
    let earningsTotal = 0;

    if (d.present > 0) {
        const amt = dailyRate * d.present;
        earningsTotal += amt;
        earningsHtml += `<tr><td style="padding: 4px 0; font-size: 13px;">Present Days</td><td style="padding: 4px 0; font-size: 13px; text-align: center;">${d.present}</td><td style="padding: 4px 0; font-size: 13px; text-align: right;">${amt.toFixed(2)}</td></tr>`;
    }
    if (d.paidLeave > 0) {
        const amt = dailyRate * d.paidLeave;
        earningsTotal += amt;
        earningsHtml += `<tr><td style="padding: 4px 0; font-size: 13px;">Paid Leave (PL)</td><td style="padding: 4px 0; font-size: 13px; text-align: center;">${d.paidLeave}</td><td style="padding: 4px 0; font-size: 13px; text-align: right;">${amt.toFixed(2)}</td></tr>`;
    }
    if (d.medicalLeave > 0) {
        const amt = dailyRate * d.medicalLeave;
        earningsTotal += amt;
        earningsHtml += `<tr><td style="padding: 4px 0; font-size: 13px;">Medical Leave (ML)</td><td style="padding: 4px 0; font-size: 13px; text-align: center;">${d.medicalLeave}</td><td style="padding: 4px 0; font-size: 13px; text-align: right;">${amt.toFixed(2)}</td></tr>`;
    }
    if (d.dayOff > 0) {
        const amt = dailyRate * d.dayOff;
        earningsTotal += amt;
        earningsHtml += `<tr><td style="padding: 4px 0; font-size: 13px;">Day Off (D)</td><td style="padding: 4px 0; font-size: 13px; text-align: center;">${d.dayOff}</td><td style="padding: 4px 0; font-size: 13px; text-align: right;">${amt.toFixed(2)}</td></tr>`;
    }
    if (d.compassionateLeave > 0) {
        const amt = dailyRate * d.compassionateLeave;
        earningsTotal += amt;
        earningsHtml += `<tr><td style="padding: 4px 0; font-size: 13px;">Compassionate Leave (CL)</td><td style="padding: 4px 0; font-size: 13px; text-align: center;">${d.compassionateLeave}</td><td style="padding: 4px 0; font-size: 13px; text-align: right;">${amt.toFixed(2)}</td></tr>`;
    }

    // Build deductions rows
    let deductionsHtml = '';
    let deductionsTotal = 0;

    if (d.unpaidLeave > 0) {
        deductionsHtml += `<tr><td style="padding: 4px 0; font-size: 13px;">Unpaid Leave (A)</td><td style="padding: 4px 0; font-size: 13px; text-align: center;">${d.unpaidLeave}</td><td style="padding: 4px 0; font-size: 13px; text-align: right;">-</td></tr>`;
    }
    if (d.empAdvance > 0) {
        deductionsTotal += d.empAdvance;
        const advDates = (d.advanceDetails || []).map(a => {
            try { return formatDate(a.date); }
            catch (e) { return a.date; }
        }).join('; ');
        const advanceLabel = advDates ? `Advance Payment (${advDates})` : 'Advance Payment';
        deductionsHtml += `<tr><td style="padding: 4px 0; font-size: 13px;">${advanceLabel}</td><td style="padding: 4px 0; font-size: 13px; text-align: center;">-</td><td style="padding: 4px 0; font-size: 13px; text-align: right;">${d.empAdvance.toFixed(2)}</td></tr>`;
    }

    // Use location-based gross if there was a transfer, else attendance-based
    const grossDisplay = hasMultiplePeriods ? totalLocationEarnings : d.grossAmount;
    const netDisplay = grossDisplay - d.empAdvance;

    const content = `
        <div id="payslip-printable" style="font-family: Arial, sans-serif;">
            <!-- Header -->
            <div style="text-align: center; border-bottom: 2px solid #1e40af; padding-bottom: 12px; margin-bottom: 16px;">
                <h2 style="margin: 0; font-size: 20px; color: #1e40af;">MWH MANAGEMENT</h2>
                <p style="margin: 4px 0 0; font-size: 13px; color: #6b7280;">PAYSLIP</p>
                <p style="margin: 4px 0 0; font-size: 14px; font-weight: 600; color: #374151;">For the month of ${monthYear}</p>
            </div>

            <!-- Employee Details -->
            <table style="width: 100%; margin-bottom: 16px; font-size: 13px;">
                <tr>
                    <td style="width: 50%; padding: 3px 0;"><strong>Employee Name:</strong> ${d.name}</td>
                    <td style="width: 50%; padding: 3px 0;"><strong>Employee ID:</strong> ${d.empId}</td>
                </tr>
                <tr>
                    <td style="padding: 3px 0;"><strong>Department:</strong> ${d.department}</td>
                    <td style="padding: 3px 0;"><strong>Position:</strong> ${d.position}</td>
                </tr>
                <tr>
                    <td style="padding: 3px 0;"><strong>Current Location:</strong> ${empLocation}</td>
                    <td style="padding: 3px 0;"><strong>Print Date:</strong> ${printDate}</td>
                </tr>
                <tr>
                    <td style="padding: 3px 0;"><strong>Days in Month:</strong> ${d.daysInMonth}</td>
                    <td style="padding: 3px 0;"><strong>Pay Type:</strong> ${d.remType}</td>
                </tr>
            </table>

            <!-- Attendance Summary -->
            <div style="background: #f3f4f6; padding: 8px 12px; border-radius: 6px; margin-bottom: 16px;">
                <table style="width: 100%; font-size: 12px;">
                    <tr>
                        <td><strong>Total Days:</strong> ${d.totalDays}</td>
                        <td><strong>Paid Days:</strong> ${d.paidDays}</td>
                        <td><strong>Working Days:</strong> ${d.workingDays}</td>
                    </tr>
                </table>
            </div>

            <!-- Location-wise Breakdown (only if transfer happened this month) -->
            ${locationBreakdownHtml}

            <!-- Earnings -->
            ${!hasMultiplePeriods ? `
            <div style="margin-bottom: 16px;">
                <h4 style="margin: 0 0 8px; font-size: 14px; color: #047857; border-bottom: 1px solid #d1d5db; padding-bottom: 4px;">EARNINGS</h4>
                <table style="width: 100%; border-collapse: collapse;">
                    <tr style="background: #f9fafb;">
                        <th style="text-align: left; padding: 4px 0; font-size: 12px; color: #6b7280;">Description</th>
                        <th style="text-align: center; padding: 4px 0; font-size: 12px; color: #6b7280;">Days</th>
                        <th style="text-align: right; padding: 4px 0; font-size: 12px; color: #6b7280;">Amount</th>
                    </tr>
                    ${earningsHtml}
                    <tr style="border-top: 1px solid #d1d5db; font-weight: bold;">
                        <td colspan="2" style="padding: 6px 0; font-size: 13px;">Gross Pay</td>
                        <td style="text-align: right; padding: 6px 0; font-size: 13px; color: #047857;">${d.grossAmount.toFixed(2)}</td>
                    </tr>
                </table>
            </div>
            ` : ''}

            <!-- Deductions -->
            ${deductionsHtml || d.empAdvance > 0 ? `
            <div style="margin-bottom: 16px;">
                <h4 style="margin: 0 0 8px; font-size: 14px; color: #dc2626; border-bottom: 1px solid #d1d5db; padding-bottom: 4px;">DEDUCTIONS</h4>
                <table style="width: 100%; border-collapse: collapse;">
                    <tr style="background: #f9fafb;">
                        <th style="text-align: left; padding: 4px 0; font-size: 12px; color: #6b7280;">Description</th>
                        <th style="text-align: center; padding: 4px 0; font-size: 12px; color: #6b7280;">Days</th>
                        <th style="text-align: right; padding: 4px 0; font-size: 12px; color: #6b7280;">Amount</th>
                    </tr>
                    ${deductionsHtml}
                    <tr style="border-top: 1px solid #d1d5db; font-weight: bold;">
                        <td colspan="2" style="padding: 6px 0; font-size: 13px;">Total Deductions</td>
                        <td style="text-align: right; padding: 6px 0; font-size: 13px; color: #dc2626;">${deductionsTotal.toFixed(2)}</td>
                    </tr>
                </table>
            </div>
            ` : ''}

            <!-- Net Pay -->
            <div style="background: ${netDisplay < 0 ? '#fef2f2' : '#eff6ff'}; border: 2px solid ${netDisplay < 0 ? '#dc2626' : '#1e40af'}; border-radius: 8px; padding: 12px; text-align: center; margin-top: 16px;">
                <p style="margin: 0; font-size: 12px; color: #6b7280; text-transform: uppercase; letter-spacing: 1px;">Net Pay</p>
                <p style="margin: 4px 0 0; font-size: 24px; font-weight: bold; color: ${netDisplay < 0 ? '#dc2626' : '#1e40af'};">${netDisplay.toFixed(2)}</p>
            </div>

            <!-- Signature lines -->
            <div style="display: flex; justify-content: space-between; margin-top: 40px; font-size: 12px; color: #6b7280;">
                <div style="text-align: center; width: 40%;">
                    <div style="border-top: 1px solid #9ca3af; padding-top: 4px;">Employee Signature</div>
                </div>
                <div style="text-align: center; width: 40%;">
                    <div style="border-top: 1px solid #9ca3af; padding-top: 4px;">Authorized Signature</div>
                </div>
            </div>
        </div>
    `;

    document.getElementById('payslip-content').innerHTML = content;
    document.getElementById('payslip-modal').classList.remove('hidden');

    // Show/hide email button based on employee email
    const emailBtn = document.getElementById('email-payslip-btn');
    if (d.email) {
        emailBtn.classList.remove('hidden');
        emailBtn.title = `Send to ${d.email}`;
    } else {
        emailBtn.classList.add('hidden');
    }
    window._currentPayslipIdx = idx;
}

function closePayslipModal() {
    document.getElementById('payslip-modal').classList.add('hidden');
}

function printPayslip() {
    const content = document.getElementById('payslip-printable').innerHTML;
    const printWindow = window.open('', '_blank', 'width=700,height=900');
    printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Payslip</title>
            <style>
                body { margin: 30px; font-family: Arial, sans-serif; }
                table { width: 100%; border-collapse: collapse; }
                td, th { padding: 4px 0; }
                @media print {
                    body { margin: 20px; }
                }
            </style>
        </head>
        <body>${content}</body>
        </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => { printWindow.print(); }, 300);
}

function savePayslipPDF() {
    const d = window._payslipData[window._currentPayslipIdx];
    if (!d) return;
    const element = document.getElementById('payslip-printable');
    const [year, mon] = d.month.split('-');
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const filename = `Payslip_${d.name.replace(/\s+/g, '_')}_${monthNames[parseInt(mon) - 1]}_${year}.pdf`;

    const opt = {
        margin: 10,
        filename: filename,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2 },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };
    html2pdf().set(opt).from(element).save();
}

async function emailPayslip() {
    const d = window._payslipData[window._currentPayslipIdx];
    if (!d || !d.email) {
        alert('No email address available for this employee.');
        return;
    }

    const emailBtn = document.getElementById('email-payslip-btn');
    emailBtn.disabled = true;
    emailBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-1"></i>Sending...';

    try {
        const element = document.getElementById('payslip-printable');
        const [year, mon] = d.month.split('-');
        const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
        const monthYear = `${monthNames[parseInt(mon) - 1]} ${year}`;

        // Generate PDF as base64
        const opt = {
            margin: 10,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { scale: 2 },
            jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
        };
        const pdfBlob = await html2pdf().set(opt).from(element).outputPdf('blob');

        // Convert blob to base64
        const reader = new FileReader();
        reader.readAsDataURL(pdfBlob);
        reader.onloadend = async function() {
            const base64data = reader.result.split(',')[1];
            try {
                const response = await fetch(`${API_BASE}/send-payslip`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        email: d.email,
                        name: d.name,
                        month: monthYear,
                        pdfBase64: base64data
                    })
                });
                const result = await response.json();
                if (response.ok) {
                    alert(`Payslip sent successfully to ${d.email}`);
                } else {
                    alert(result.error || 'Failed to send email');
                }
            } catch (err) {
                alert('Failed to send email: ' + err.message);
            }
            emailBtn.disabled = false;
            emailBtn.innerHTML = '<i class="fas fa-envelope mr-1"></i>Email';
        };
    } catch (error) {
        alert('Failed to generate PDF: ' + error.message);
        emailBtn.disabled = false;
        emailBtn.innerHTML = '<i class="fas fa-envelope mr-1"></i>Email';
    }
}

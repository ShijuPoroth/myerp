// ==================== ATTENDANCE REGISTER ====================

const ATTENDANCE_STATUSES = {
    'unpaid-leave':       { label: 'A',  color: 'bg-red-100 text-red-800 border border-red-500', title: 'Unpaid Leave' },
    'medical-leave':      { label: 'ML', color: 'bg-purple-100 text-purple-800 border border-purple-500', title: 'Medical Leave' },
    'paid-leave':         { label: 'PL', color: 'bg-yellow-100 text-yellow-800 border border-yellow-500', title: 'Paid Leave' },
    'day-off':            { label: 'D',  color: 'bg-gray-100 text-gray-800 border border-gray-500', title: 'Day Off' },
    'compassionate-leave':{ label: 'CL', color: 'bg-orange-100 text-orange-800 border border-orange-500', title: 'Compassionate Leave' }
};

// Get employee working hours from attendanceData
function getEmployeeWorkingHours(empId) {
    if (!attendanceData || !attendanceData.employees) return 8;
    const emp = attendanceData.employees.find(e => e.id === empId);
    return (emp && emp.working_hours_per_day) || 8;
}

// Base status order for cycling — only present and day-off (leaves are managed via Apply Leave form)
const BASE_STATUS_ORDER = ['present'];
const DAY_OFF_STATUS = 'day-off';

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

let attendancePopupYear = null;

function toggleAttendanceMonthPicker() {
    const popup = document.getElementById('attendance-month-popup');
    if (!popup) return;
    if (!popup.classList.contains('hidden')) {
        closeAttendanceMonthPicker();
        return;
    }
    const picker = document.getElementById('attendance-month-picker');
    const [year] = (picker.value || '').split('-').map(Number);
    attendancePopupYear = year || new Date().getFullYear();
    renderAttendancePopup();
    popup.classList.remove('hidden');
    // Close when clicking outside the popup
    setTimeout(() => document.addEventListener('click', attendancePopupOutsideClick), 0);
}

function closeAttendanceMonthPicker() {
    const popup = document.getElementById('attendance-month-popup');
    if (popup) popup.classList.add('hidden');
    document.removeEventListener('click', attendancePopupOutsideClick);
}

function attendancePopupOutsideClick(e) {
    const popup = document.getElementById('attendance-month-popup');
    if (popup && !popup.contains(e.target) && !e.target.closest('[onclick="toggleAttendanceMonthPicker()"]')) {
        closeAttendanceMonthPicker();
    }
}

function attendancePopupChangeYear(delta) {
    attendancePopupYear += delta;
    renderAttendancePopup();
}

function renderAttendancePopup() {
    const yearLabel = document.getElementById('attendance-popup-year');
    const monthsContainer = document.getElementById('attendance-popup-months');
    if (!yearLabel || !monthsContainer) return;
    yearLabel.textContent = attendancePopupYear;

    const picker = document.getElementById('attendance-month-picker');
    const [selYear, selMonth] = (picker.value || '').split('-').map(Number);
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;

    const monthAbbr = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    monthsContainer.innerHTML = monthAbbr.map((label, idx) => {
        const m = idx + 1;
        const isFuture = attendancePopupYear > currentYear || (attendancePopupYear === currentYear && m > currentMonth);
        const isSelected = attendancePopupYear === selYear && m === selMonth;
        const classes = isFuture
            ? 'text-gray-300 cursor-not-allowed'
            : isSelected
                ? 'bg-blue-600 text-white font-semibold'
                : 'text-gray-700 hover:bg-blue-50';
        return `<button ${isFuture ? 'disabled' : `onclick="selectAttendancePopupMonth(${m})"`} class="py-1.5 rounded text-sm ${classes}">${label}</button>`;
    }).join('');
}

function selectAttendancePopupMonth(month) {
    const picker = document.getElementById('attendance-month-picker');
    picker.value = `${attendancePopupYear}-${String(month).padStart(2, '0')}`;
    closeAttendanceMonthPicker();
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

    // Clear search when loading new month
    const searchInput = document.getElementById('attendance-search');
    if (searchInput) searchInput.value = '';
    const clearBtn = document.getElementById('attendance-search-clear');
    if (clearBtn) clearBtn.classList.add('hidden');

    try {
        showTableLoading('attendance-table-body', 'Loading attendance...');
        const response = await fetch(`${API_BASE}/attendance?month=${month}`);
        attendanceData = await response.json();

        renderAttendanceRegister();
        updateLockUI();
    } catch (error) {
        console.error('Error loading attendance:', error);
        showTableError('attendance-table-body', 'Error loading attendance.');
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
        // Don't auto-fill past the termination date
        const terminationDateStr = emp.termination_date ? emp.termination_date.substring(0, 10) : null;
        for (let d = 1; d <= daysInMonth; d++) {
            const dateStr = `${month}-${String(d).padStart(2, '0')}`;
            if (dateStr > todayStr) continue; // skip future
            if (terminationDateStr && dateStr > terminationDateStr) continue; // skip post-termination
            if (empAtt[dateStr]) continue; // already has a record
            bulkRecords.push({ employee_id: emp.id, date: dateStr, status: 'present', hours: emp.working_hours_per_day || 8 });
            // Update local data immediately
            if (!attendanceMap[emp.id]) attendanceMap[emp.id] = {};
            attendanceMap[emp.id][dateStr] = { status: 'present', hours: emp.working_hours_per_day || 8 };
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
    headerHtml += `<th class="px-2 py-2 text-center text-xs font-medium text-amber-600 uppercase min-w-[30px]" title="Overtime Hours">OT</th>`;
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
        let pCount = 0, aCount = 0, mlCount = 0, plCount = 0, dCount = 0, clCount = 0, otHours = 0;
        const workingHrsPerDay = emp.working_hours_per_day || 8;

        bodyHtml += `<tr class="hover:bg-gray-50">
            <td class="px-2 py-1 whitespace-nowrap sticky left-0 bg-white z-10 text-xs text-gray-400">${idx + 1}</td>
            <td class="px-2 py-1 whitespace-nowrap sticky left-[40px] bg-white z-10 font-medium text-xs" title="${emp.employee_id || ''}">${emp.first_name} ${emp.last_name}</td>
            <td class="px-2 py-1 whitespace-nowrap sticky left-[160px] bg-white z-10 text-xs text-gray-500">${emp.department || '-'}</td>`;
        
        const terminationDateStr = emp.termination_date ? emp.termination_date.substring(0, 10) : null;
        for (let d = 1; d <= daysInMonth; d++) {
            const dateStr = `${month}-${String(d).padStart(2, '0')}`;
            const dateObj = new Date(year, mon - 1, d);
            const isSunday = dateObj.getDay() === 0;
            const isFuture = dateStr > todayStr;
            const isAfterTermination = terminationDateStr && dateStr > terminationDateStr;
            const isTerminationDay = terminationDateStr && dateStr === terminationDateStr;
            const record = empAttendance[dateStr];
            const status = record ? record.status : null;

            if (!isAfterTermination) {
                if (status === 'present') {
                    pCount++;
                    const hrs = parseFloat(record && record.hours) || workingHrsPerDay;
                    if (hrs > workingHrsPerDay) otHours += (hrs - workingHrsPerDay);
                }
                else if (status === 'unpaid-leave') aCount++;
                else if (status === 'medical-leave') mlCount++;
                else if (status === 'paid-leave') plCount++;
                else if (status === 'day-off') dCount++;
                else if (status === 'compassionate-leave') clCount++;
            }

            const statusInfo = status ? ATTENDANCE_STATUSES[status] : null;
            const isToday = dateStr === todayStr;

            if (isAfterTermination) {
                // Grey out cells after termination — no interaction
                bodyHtml += `<td class="px-0 py-0 text-center">
                    <span class="block px-1 py-1 text-xs text-gray-400 cursor-not-allowed" title="Terminated on ${terminationDateStr}"></span>
                </td>`;
            } else {
                let cellText;
                let cellClass = '';
                if (isTerminationDay && !status) {
                    cellText = 'T';
                    cellClass = 'bg-red-50 text-red-700 border border-red-500';
                } else if (status === 'present') {
                    const hrs = record && record.hours ? record.hours : getEmployeeWorkingHours(emp.id);
                    cellText = hrs;
                    if (hrs > workingHrsPerDay) {
                        cellClass = 'bg-blue-100 text-blue-800 border border-blue-500';
                    } else {
                        cellClass = 'bg-green-100 text-green-800 border border-green-500';
                    }
                } else if (statusInfo) {
                    cellText = statusInfo.label;
                    cellClass = statusInfo.color;
                } else {
                    cellText = isFuture ? '' : '-';
                    cellClass = 'text-gray-400';
                }
                const cellTitle = isTerminationDay ? `Termination date - ${dateStr}` : (statusInfo ? statusInfo.title : 'Click to set') + ` - ${dateStr}${isLocked ? ' (Locked)' : ''}`;
                const cellDisabled = isFuture || isLocked;
                bodyHtml += `<td class="px-0 py-0 text-center ${isToday ? 'ring-2 ring-blue-400 ring-inset' : ''}">
                    <button onclick="handleAttendanceClick(${emp.id}, '${dateStr}', this)" 
                        class="w-full h-full px-1 py-1 text-xs font-medium ${cellClass} ${cellDisabled ? 'opacity-60 cursor-not-allowed' : 'hover:opacity-80 cursor-pointer'} transition" 
                        title="${cellTitle} (click to edit hours)"
                        ${cellDisabled ? 'disabled' : ''}
                        data-employee-id="${emp.id}" data-date="${dateStr}" data-status="${status || ''}" data-hours="${(status === 'present' && record && record.hours) ? record.hours : ''}">
                        ${cellText}
                    </button>
                </td>`;
            }
        }

        const otDisplay = otHours > 0 ? otHours.toFixed(1) : '';
        bodyHtml += `<td class="px-1 py-1 text-center text-xs font-bold text-amber-600">${otDisplay}</td>`;
        bodyHtml += `<td class="px-1 py-1 text-center text-xs font-bold text-green-700">${pCount || ''}</td>`;
        bodyHtml += `<td class="px-1 py-1 text-center text-xs font-bold text-red-700">${aCount || ''}</td>`;
        bodyHtml += `<td class="px-1 py-1 text-center text-xs font-bold text-purple-700">${mlCount || ''}</td>`;
        bodyHtml += `<td class="px-1 py-1 text-center text-xs font-bold text-yellow-700">${plCount || ''}</td>`;
        bodyHtml += `<td class="px-1 py-1 text-center text-xs font-bold text-gray-600">${dCount || ''}</td>`;
        bodyHtml += `<td class="px-1 py-1 text-center text-xs font-bold text-orange-700">${clCount || ''}</td>`;
        bodyHtml += `</tr>`;
    });

    document.getElementById('attendance-table-body').innerHTML = bodyHtml;

    // Summary
    document.getElementById('attendance-summary').textContent = `${employees.length} employees | ${month}`;
}

function filterAttendanceRegister() {
    const tbody = document.getElementById('attendance-table-body');
    if (!tbody) return;
    const searchInput = document.getElementById('attendance-search');
    const clearBtn = document.getElementById('attendance-search-clear');
    const search = (searchInput?.value || '').toLowerCase().trim();
    
    // Show/hide clear button
    if (clearBtn) {
        clearBtn.classList.toggle('hidden', !search);
    }
    
    // Highlight search input
    if (searchInput) {
        if (search) {
            searchInput.classList.add('border-yellow-400', 'bg-yellow-100');
        } else {
            searchInput.classList.remove('border-yellow-400', 'bg-yellow-100');
        }
    }
    
    const rows = tbody.querySelectorAll('tr');
    rows.forEach(row => {
        const cells = row.querySelectorAll('td');
        if (cells.length < 2) return;
        const name = (cells[1]?.textContent || '').toLowerCase();
        const empId = (cells[1]?.getAttribute('title') || '').toLowerCase();
        if (!search || name.includes(search) || empId.includes(search)) {
            row.style.display = '';
        } else {
            row.style.display = 'none';
        }
    });
}

function clearAttendanceSearch() {
    const searchInput = document.getElementById('attendance-search');
    if (searchInput) {
        searchInput.value = '';
        filterAttendanceRegister();
    }
}

// Single-click handler: if already present, open edit popup; otherwise cycle status
function handleAttendanceClick(employeeId, date, btn) {
    if (attendanceData && attendanceData.isLocked) return;
    if (btn.disabled) return;

    if (btn.dataset.status === 'present') {
        // Already present — open hours edit popup
        editAttendanceHours(employeeId, date, btn);
    } else {
        // Not present — cycle to next status
        cycleAttendance(employeeId, date, btn);
    }
}

async function cycleAttendance(employeeId, date, btn) {
    // Prevent editing locked months
    if (attendanceData && attendanceData.isLocked) return;

    // Build status order: present, day-off (if entitled)
    // Leave types (unpaid, medical, paid, compassionate) are managed via Apply Leave form
    let statusOrder = [...BASE_STATUS_ORDER];
    if (attendanceData && attendanceData.leaveEntitlements) {
        const empEntitlements = attendanceData.leaveEntitlements[employeeId] || [];
        const hasD = empEntitlements.some(e => e.leave_type && (e.leave_type.toLowerCase().includes('day off') || e.leave_type.toLowerCase().includes('dayoff') || e.leave_type.toLowerCase().includes('day-off')));
        if (hasD) statusOrder.push(DAY_OFF_STATUS);
    }

    const currentStatus = btn.dataset.status || '';
    let currentIdx = statusOrder.indexOf(currentStatus);
    if (currentIdx === -1) currentIdx = statusOrder.length - 1; // treat unknown as last
    const nextIdx = (currentIdx + 1) % statusOrder.length;
    const newStatus = statusOrder[nextIdx];

    // For present status, auto-fill working hours
    let hours = null;
    if (newStatus === 'present') {
        hours = getEmployeeWorkingHours(employeeId);
    }

    try {
        await fetch(`${API_BASE}/attendance`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ employee_id: employeeId, date, status: newStatus, hours })
        });
        btn.dataset.status = newStatus;
        btn.dataset.hours = hours || '';
        updateAttendanceCell(btn, newStatus, hours);
        updateAttendanceData(employeeId, date, newStatus, hours);
    } catch (error) {
        console.error('Error saving attendance:', error);
    }
}

function editAttendanceHours(employeeId, date, btn) {
    if (attendanceData && attendanceData.isLocked) return;
    if (btn.dataset.status !== 'present') return; // only edit hours for present days

    const currentHours = parseFloat(btn.dataset.hours) || getEmployeeWorkingHours(employeeId);
    const currentHrs = Math.floor(currentHours);
    const currentMins = Math.round((currentHours - currentHrs) * 60);

    // Remove any existing popup
    const existing = document.getElementById('attendance-hours-popup');
    if (existing) existing.remove();

    // Build popup
    const popup = document.createElement('div');
    popup.id = 'attendance-hours-popup';
    popup.style.cssText = 'position:fixed; top:50%; left:50%; transform:translate(-50%,-50%); background:#fff; border:2px solid #22c55e; border-radius:10px; padding:20px 24px; z-index:9999; box-shadow:0 8px 30px rgba(0,0,0,0.25); min-width:280px;';

    const emp = attendanceData.employees.find(e => e.id === employeeId);
    const empName = emp ? `${emp.first_name} ${emp.last_name}` : '';
    const workingHrs = getEmployeeWorkingHours(employeeId);

    // Check if employee is entitled to day off
    let hasDayOff = false;
    if (attendanceData && attendanceData.leaveEntitlements) {
        const empEntitlements = attendanceData.leaveEntitlements[employeeId] || [];
        hasDayOff = empEntitlements.some(e => e.leave_type && (e.leave_type.toLowerCase().includes('day off') || e.leave_type.toLowerCase().includes('dayoff') || e.leave_type.toLowerCase().includes('day-off')));
    }

    popup.innerHTML = `
        <div style="text-align:center; margin-bottom:16px;">
            <div style="font-size:16px; font-weight:700; color:#1f2937;">Edit Working Hours</div>
            <div style="font-size:12px; color:#6b7280; margin-top:4px;">${empName} — ${date}</div>
            <div style="font-size:11px; color:#9ca3af; margin-top:2px;">Standard: ${workingHrs}h/day</div>
        </div>
        <div style="display:flex; gap:12px; align-items:center; justify-content:center; margin-bottom:16px;">
            <div>
                <label style="font-size:12px; color:#6b7280; display:block; margin-bottom:4px;">Hours</label>
                <input type="number" id="popup-hours" min="0" max="24" value="${currentHrs}" style="width:60px; padding:8px; border:1px solid #d1d5db; border-radius:6px; text-align:center; font-size:16px; font-weight:600;">
            </div>
            <div style="font-size:20px; font-weight:700; color:#9ca3af; padding-top:20px;">:</div>
            <div>
                <label style="font-size:12px; color:#6b7280; display:block; margin-bottom:4px;">Minutes</label>
                <input type="number" id="popup-mins" min="0" max="59" step="15" value="${currentMins}" style="width:60px; padding:8px; border:1px solid #d1d5db; border-radius:6px; text-align:center; font-size:16px; font-weight:600;">
            </div>
        </div>
        <div style="text-align:center; font-size:12px; color:#6b7280; margin-bottom:16px;">
            Total: <span id="popup-total" style="font-weight:700; color:#22c55e;">${currentHours.toFixed(2)}h</span>
            <span id="popup-overtime" style="display:none; margin-left:8px; color:#f59e0b; font-weight:600;"></span>
        </div>
        <div style="display:flex; gap:8px; justify-content:center; flex-wrap:wrap;">
            <button id="popup-cancel" style="padding:8px 16px; border:1px solid #d1d5db; border-radius:6px; font-size:13px; cursor:pointer; background:#f9fafb;">Cancel</button>
            ${hasDayOff ? `<button id="popup-dayoff" style="padding:8px 16px; border:1px solid #d1d5db; border-radius:6px; font-size:13px; cursor:pointer; background:#f3f4f6; color:#6b7280;">Mark Day Off</button>` : ''}
            <button id="popup-save" style="padding:8px 20px; border:none; border-radius:6px; font-size:13px; cursor:pointer; background:#22c55e; color:#fff; font-weight:600;">Save</button>
        </div>
    `;

    // Backdrop
    const backdrop = document.createElement('div');
    backdrop.id = 'attendance-hours-backdrop';
    backdrop.style.cssText = 'position:fixed; inset:0; background:rgba(0,0,0,0.3); z-index:9998;';
    document.body.appendChild(backdrop);
    document.body.appendChild(popup);

    const hrsInput = popup.querySelector('#popup-hours');
    const minsInput = popup.querySelector('#popup-mins');
    const totalSpan = popup.querySelector('#popup-total');
    const overtimeSpan = popup.querySelector('#popup-overtime');

    function updateTotal() {
        const h = parseInt(hrsInput.value) || 0;
        const m = parseInt(minsInput.value) || 0;
        const total = h + m / 60;
        totalSpan.textContent = `${total.toFixed(2)}h`;
        if (total > workingHrs) {
            const ot = total - workingHrs;
            overtimeSpan.style.display = 'inline';
            overtimeSpan.textContent = `(Overtime: ${ot.toFixed(2)}h)`;
        } else {
            overtimeSpan.style.display = 'none';
        }
    }

    hrsInput.addEventListener('input', updateTotal);
    minsInput.addEventListener('input', updateTotal);
    hrsInput.focus();
    hrsInput.select();

    let saved = false;

    async function saveHours() {
        if (saved) return;
        saved = true;
        const h = parseInt(hrsInput.value) || 0;
        const m = parseInt(minsInput.value) || 0;
        const newHours = h + m / 60;

        if (newHours <= 0) {
            closePopup();
            return;
        }
        try {
            await fetch(`${API_BASE}/attendance`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ employee_id: employeeId, date, status: 'present', hours: newHours })
            });
            btn.dataset.hours = newHours;
            btn.textContent = newHours % 1 === 0 ? newHours : newHours.toFixed(1);
            updateAttendanceData(employeeId, date, 'present', newHours);
            updateAttendanceCell(btn, 'present', newHours);
        } catch (error) {
            console.error('Error saving hours:', error);
        }
        closePopup();
    }

    function closePopup() {
        if (popup.parentNode) popup.remove();
        if (backdrop.parentNode) backdrop.remove();
    }

    popup.querySelector('#popup-save').addEventListener('click', saveHours);
    popup.querySelector('#popup-cancel').addEventListener('click', closePopup);
    backdrop.addEventListener('click', closePopup);

    // Day Off button
    const dayOffBtn = popup.querySelector('#popup-dayoff');
    if (dayOffBtn) {
        dayOffBtn.addEventListener('click', async () => {
            if (saved) return;
            saved = true;
            try {
                await fetch(`${API_BASE}/attendance`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ employee_id: employeeId, date, status: 'day-off', hours: null })
                });
                btn.dataset.status = 'day-off';
                btn.dataset.hours = '';
                updateAttendanceCell(btn, 'day-off');
                updateAttendanceData(employeeId, date, 'day-off');
            } catch (error) {
                console.error('Error saving day off:', error);
            }
            closePopup();
        });
    }

    // Enter to save, Escape to cancel
    [hrsInput, minsInput].forEach(inp => {
        inp.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') { e.preventDefault(); saveHours(); }
            if (e.key === 'Escape') { e.preventDefault(); closePopup(); }
        });
    });
}

function updateAttendanceCell(btn, status, hours) {
    const statusInfo = status ? ATTENDANCE_STATUSES[status] : null;
    const empId = parseInt(btn.dataset.employeeId);
    const workingHrs = getEmployeeWorkingHours(empId);
    // Build cell color class with fill and thin border
    let cellClass = '';
    let cellText = '';
    if (status === 'present') {
        const h = hours || workingHrs;
        cellText = h;
        if (h > workingHrs) {
            cellClass = 'bg-amber-100 text-amber-800 border border-amber-500';
        } else {
            cellClass = 'bg-green-100 text-green-800 border border-green-500';
        }
    } else if (statusInfo) {
        cellText = statusInfo.label;
        cellClass = statusInfo.color;
    } else {
        cellText = '-';
        cellClass = 'text-gray-400';
    }
    // Reset button classes, keep base + cell color + interaction
    const isDisabled = btn.disabled;
    btn.className = `w-full h-full px-1 py-1 text-xs font-medium ${cellClass} ${isDisabled ? 'opacity-60 cursor-not-allowed' : 'hover:opacity-80 cursor-pointer'} transition`;
    btn.textContent = cellText;
    btn.title = (statusInfo ? statusInfo.title : 'Click to set') + ' - ' + btn.dataset.date + ' (click to edit hours)';

    // Update row totals
    updateRowTotals(btn);
}

function updateRowTotals(btn) {
    const row = btn.closest('tr');
    if (!row) return;
    const cells = row.querySelectorAll('button[data-status]');
    let pCount = 0, aCount = 0, mlCount = 0, plCount = 0, dCount = 0, clCount = 0, otHours = 0;
    const empId = parseInt(btn.dataset.employeeId);
    const workingHrs = getEmployeeWorkingHours(empId);
    cells.forEach(cell => {
        const s = cell.dataset.status;
        if (s === 'present') {
            pCount++;
            const hrs = parseFloat(cell.dataset.hours) || workingHrs;
            if (hrs > workingHrs) otHours += (hrs - workingHrs);
        }
        else if (s === 'unpaid-leave') aCount++;
        else if (s === 'medical-leave') mlCount++;
        else if (s === 'paid-leave') plCount++;
        else if (s === 'day-off') dCount++;
        else if (s === 'compassionate-leave') clCount++;
    });
    const tds = row.querySelectorAll('td');
    const totalCells = Array.from(tds).slice(-7);
    if (totalCells[0]) totalCells[0].textContent = otHours > 0 ? otHours.toFixed(1) : '';
    if (totalCells[1]) totalCells[1].textContent = pCount || '';
    if (totalCells[2]) totalCells[2].textContent = aCount || '';
    if (totalCells[3]) totalCells[3].textContent = mlCount || '';
    if (totalCells[4]) totalCells[4].textContent = plCount || '';
    if (totalCells[5]) totalCells[5].textContent = dCount || '';
    if (totalCells[6]) totalCells[6].textContent = clCount || '';
}

function updateAttendanceData(employeeId, date, status, hours) {
    if (!attendanceData) return;
    if (!attendanceData.attendanceMap[employeeId]) {
        attendanceData.attendanceMap[employeeId] = {};
    }
    if (status) {
        attendanceData.attendanceMap[employeeId][date] = { status };
        if (hours !== undefined && hours !== null) {
            attendanceData.attendanceMap[employeeId][date].hours = hours;
        }
    } else {
        delete attendanceData.attendanceMap[employeeId][date];
    }
}

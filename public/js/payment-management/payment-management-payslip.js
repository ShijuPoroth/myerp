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

    // Fetch leave balance for paid leave info
    let paidLeaveBalance = null;
    try {
        const lbResp = await fetch(`${API_BASE}/employee-leave-balance/${d.id}`);
        const lbData = await lbResp.json();
        if (Array.isArray(lbData)) {
            paidLeaveBalance = lbData.find(b =>
                (b.leave_type || '').toLowerCase().includes('paid')
            ) || null;
        }
    } catch (e) { console.error('Error fetching leave balance:', e); }

    // Build salary periods: segments of the month with different rates/locations
    let periods = [];
    const startDate = `${d.month}-01`;
    const monthEndStr = `${d.month}-${String(d.daysInMonth).padStart(2, '0')}`;
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;
    // Cap at termination date if terminated, otherwise cap at today for current month
    let endDate = monthEndStr;
    if (d.termination_date && d.termination_date < endDate) {
        endDate = d.termination_date; // terminated — always cap at their last day
    } else if (todayStr < endDate) {
        endDate = todayStr; // current month not finished — cap at today
    }

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
    const whpd = d.workingHoursPerDay || 8;
    periods.forEach(p => {
        let periodPaidDays = 0;
        for (let dNum = 1; dNum <= d.daysInMonth; dNum++) {
            const dateStr = `${d.month}-${String(dNum).padStart(2, '0')}`;
            if (dateStr >= p.fromDate && dateStr <= p.toDate) {
                const record = d.empAtt?.[dateStr];
                if (record && paidStatuses.includes(record.status)) {
                    if (record.status === 'present') {
                        const hrs = parseFloat(record.hours) || whpd;
                        periodPaidDays += whpd > 0 ? Math.min(hrs, whpd) / whpd : 1;
                    } else {
                        periodPaidDays++;
                    }
                }
            }
        }
        p.days = periodPaidDays;
    });

    // Build location-wise earnings breakdown (always show, even for single period)
    let locationBreakdownHtml = `
        <div style="margin-bottom: 16px;">
            <h4 style='margin: 0 0 8px; font-size: 14px; color: #4338ca; border-bottom: 1px solid #d1d5db; padding-bottom: 4px;'>LOCATION-WISE SALARY BREAKDOWN</h4>
            <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
                <tr style='background: #f9fafb;'>
                    <th style="text-align: left; padding: 6px 4px; color: #6b7280;">Location</th>
                    <th style="text-align: center; padding: 6px 4px; color: #6b7280;">Period</th>
                    <th style="text-align: center; padding: 6px 4px; color: #6b7280;">Days</th>
                    <th style="text-align: right; padding: 6px 4px; color: #6b7280;">Rate</th>
                    <th style="text-align: right; padding: 6px 4px; color: #6b7280;">Amount</th>
                </tr>`;
    let totalLocationEarnings = 0;
    periods.forEach(p => {
        let dailyR = 0;
        const rType = (p.remType || '').toLowerCase();
        if (rType === 'daily' || rType === 'daily wage') {
            dailyR = p.remAmount;
        } else if (rType === 'hourly') {
            dailyR = p.remAmount * (d.workingHoursPerDay || 8);
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
                <tr style='border-top: 2px solid #d1d5db; font-weight: bold;'>
                    <td colspan="4" style='padding: 6px 4px; font-size: 13px;'>Total Earnings (all locations)</td>
                    <td style='text-align: right; padding: 6px 4px; font-size: 13px; color: #4338ca;'>${totalLocationEarnings.toFixed(2)}</td>
                </tr>
            </table>
        </div>`;

    // Calculate per-day rate for single-period breakdown
    let dailyRate = 0;
    const remTypeLower = (d.remType || '').toLowerCase();
    if (remTypeLower === 'daily' || remTypeLower === 'daily wage') {
        dailyRate = d.remAmount;
    } else if (remTypeLower === 'hourly') {
        dailyRate = d.remAmount * (d.workingHoursPerDay || 8);
    } else {
        if (d.remAmount > 0 && d.daysInMonth > 0) {
            dailyRate = d.remAmount / d.daysInMonth;
        }
    }

    // Build earnings rows (attendance-based)
    let earningsHtml = '';
    let earningsTotal = 0;

    if (d.present > 0) {
        const effDays = d.effectivePresentDays || d.present;
        const amt = dailyRate * effDays;
        earningsTotal += amt;
        const dayLabel = effDays % 1 === 0 ? d.present : `${d.present} (${effDays.toFixed(1)} eff)`;
        earningsHtml += `<tr><td style="padding: 4px 0; font-size: 13px;">Present Days</td><td style="padding: 4px 0; font-size: 13px; text-align: center;">${dayLabel}</td><td style="padding: 4px 0; font-size: 13px; text-align: right;">${amt.toFixed(2)}</td></tr>`;
    }
    if (d.totalOvertimeHours > 0 && d.overtimeAmount > 0) {
        earningsTotal += d.overtimeAmount;
        earningsHtml += `<tr><td style="padding: 4px 0; font-size: 13px;">Overtime (${d.totalOvertimeHours}h @ ${d.overtimeMultiplier}x)</td><td style="padding: 4px 0; font-size: 13px; text-align: center;">-</td><td style="padding: 4px 0; font-size: 13px; text-align: right;">${d.overtimeAmount.toFixed(2)}</td></tr>`;
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
        const allDetails = d.advanceDetails || [];
        const eqCharges = allDetails.filter(a => a.notes && a.notes.startsWith('Equipment charge:'));
        const cashAdvances = allDetails.filter(a => !a.notes || !a.notes.startsWith('Equipment charge:'));

        if (cashAdvances.length > 0) {
            const cashTotal = cashAdvances.reduce((s, a) => s + a.amount, 0);
            deductionsTotal += cashTotal;
            const advDates = cashAdvances.map(a => {
                try { return formatDate(a.date); }
                catch (e) { return a.date; }
            }).join('; ');
            const advanceLabel = advDates ? `Salary Advance (${advDates})` : 'Salary Advance';
            deductionsHtml += `<tr><td style="padding: 4px 0; font-size: 13px;">${advanceLabel}</td><td style="padding: 4px 0; font-size: 13px; text-align: center;">-</td><td style="padding: 4px 0; font-size: 13px; text-align: right;">${cashTotal.toFixed(2)}</td></tr>`;
        }

        eqCharges.forEach(a => {
            deductionsTotal += a.amount;
            const label = a.notes.replace('Equipment charge:', '').trim();
            const fmtDate = (() => { try { return formatDate(a.date); } catch(e) { return a.date; } })();
            deductionsHtml += `<tr><td style="padding: 4px 0; font-size: 13px;">Equipment Charge — ${label} (${fmtDate})</td><td style="padding: 4px 0; font-size: 13px; text-align: center;">-</td><td style="padding: 4px 0; font-size: 13px; text-align: right;">${a.amount.toFixed(2)}</td></tr>`;
        });
    }

    // Use location-based earnings total + overtime for gross/net
    const grossDisplay = totalLocationEarnings + (d.overtimeAmount || 0);
    const netDisplay = grossDisplay - deductionsTotal + (d.carryForward || 0);

    const content = `
        <div id='payslip-printable' style='font-family:"Segoe UI","Roboto",Arial,sans-serif;'>
            <!-- Header -->
            <div style='border-bottom: 2px solid #1a2e5a; padding-bottom: 12px; margin-bottom: 16px;'>
                <div style="display:flex; align-items:center; justify-content:space-between; gap:12px;">
                    <!-- Company Logo (left) -->
                    <div style="flex:1;">
                        <img src="/company-logo/company-logo.png"
                             alt="Company Logo"
                             style="max-height:80px; max-width:220px; object-fit:contain; display:block;"
                             onerror="this.style.display='none'; this.nextElementSibling.style.display='block';">
                        <div style="display:none; font-size:13px; color:#6b7280; font-style:italic;">[Company Logo]<br><span style="font-size:10px;">Place company-logo.png in public/company-logo/</span></div>
                    </div>
                    <!-- Centre: Payslip title -->
                    <div style="text-align:center; flex:1;">
                        <p style='margin:0; font-size:15px; font-weight:700; color:#1a2e5a; letter-spacing:2px;'>PAYSLIP</p>
                        <p style='margin:4px 0 0; font-size:13px; font-weight:600; color:#374151;'>For the month of ${monthYear}</p>
                    </div>
                </div>
            </div>

            <!-- Employee Details -->
            <table style='width: 100%; margin-bottom: 16px; font-size: 13px;'>
                <tr>
                    <td style='width: 50%; padding: 3px 0;'><strong>Employee Name:</strong> ${d.name}</td>
                    <td style='width: 50%; padding: 3px 0;'><strong>Employee ID:</strong> ${d.empId}</td>
                </tr>
                <tr>
                    <td style='padding: 3px 0;'><strong>Department:</strong> ${d.department}</td>
                    <td style='padding: 3px 0;'><strong>Position:</strong> ${d.position}</td>
                </tr>
                <tr>
                    <td style='padding: 3px 0;'><strong>Current Location:</strong> ${empLocation}</td>
                    <td style='padding: 3px 0;'><strong>Print Date:</strong> ${printDate}</td>
                </tr>
                <tr>
                    <td style='padding: 3px 0;'><strong>Days in Month:</strong> ${d.daysInMonth}</td>
                    <td style='padding: 3px 0;'><strong>Pay Type:</strong> ${d.remType}</td>
                </tr>
            </table>

            <!-- Attendance Summary -->
            <div style='background: #f3f4f6; padding: 8px 12px; border-radius: 6px; margin-bottom: 16px;'>
                <table style="width: 100%; font-size: 12px;">
                    <tr>
                        <td><strong>Total Days:</strong> ${d.totalDays}</td>
                        <td><strong>Paid Days:</strong> ${d.paidDays}</td>
                        <td><strong>Working Days:</strong> ${d.workingDays}</td>
                        ${d.totalOvertimeHours > 0 ? `<td><strong>Overtime:</strong> ${d.totalOvertimeHours}h</td>` : ''}
                    </tr>
                </table>
            </div>

            <!-- Location-wise Salary Breakdown -->
            ${locationBreakdownHtml}

            <!-- Attendance-based Earnings (single period only, for leave type breakdown) -->
            ${periods.length <= 1 ? `
            <div style="margin-bottom: 16px;">
                <h4 style='margin: 0 0 8px; font-size: 14px; color: #047857; border-bottom: 1px solid #d1d5db; padding-bottom: 4px;'>EARNINGS</h4>
                <table style="width: 100%; border-collapse: collapse;">
                    <tr style='background: #f9fafb;'>
                        <th style="text-align: left; padding: 4px 0; font-size: 12px; color: #6b7280;">Description</th>
                        <th style="text-align: center; padding: 4px 0; font-size: 12px; color: #6b7280;">Days</th>
                        <th style="text-align: right; padding: 4px 0; font-size: 12px; color: #6b7280;">Amount</th>
                    </tr>
                    ${earningsHtml}
                    <tr style="border-top: 1px solid #d1d5db; font-weight: bold;">
                        <td colspan="2" style="padding: 6px 0; font-size: 13px;">Gross Pay</td>
                        <td style="text-align: right; padding: 6px 0; font-size: 13px; color: #047857;">${grossDisplay.toFixed(2)}</td>
                    </tr>
                </table>
            </div>
            ` : ''}

            <!-- Deductions -->
            ${deductionsHtml || d.empAdvance > 0 ? `
            <div style="margin-bottom: 16px;">
                <h4 style='margin: 0 0 8px; font-size: 14px; color: #dc2626; border-bottom: 1px solid #d1d5db; padding-bottom: 4px;'>DEDUCTIONS</h4>
                <table style="width: 100%; border-collapse: collapse;">
                    <tr style='background: #f9fafb;'>
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
            <div style='display: flex; justify-content: flex-end; margin-top: 16px;'>
                <div style='display: inline-block; min-width: 180px; background: ${netDisplay < 0 ? '#fef2f2' : '#eff6ff'}; border: 2px solid ${netDisplay < 0 ? '#dc2626' : '#1e40af'}; border-radius: 6px; padding: 6px 12px;'>
                    <table style="width: 100%; font-size: 13px;">
                        <tr>
                            <td style='padding-right: 12px; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px;'>Net Pay</td>
                            <td style='text-align: right; font-size: 17px; font-weight: bold; color: ${netDisplay < 0 ? '#dc2626' : '#1e40af'}; white-space: nowrap;'>${netDisplay.toFixed(2)}</td>
                        </tr>
                    </table>
                </div>
            </div>

            <!-- Payment Details -->
            ${d.paidAmount > 0 || d.carryForward !== 0 ? `
            <div style="margin-top: 16px; background: #f9fafb; border: 1px solid #d1d5db; border-radius: 6px; padding: 12px;">
                <h4 style='margin: 0 0 8px; font-size: 14px; color: #4b5563; border-bottom: 1px solid #d1d5db; padding-bottom: 4px;'>PAYMENT DETAILS</h4>
                <table style="width: 100%; font-size: 13px;">
                    ${d.carryForward !== 0 ? `
                    <tr>
                        <td style="padding: 4px 0; color: #6b7280;">Carry Forward from Previous Month</td>
                        <td style="padding: 4px 0; text-align: right; font-weight: 600; ${d.carryForward < 0 ? 'color: #dc2626;' : 'color: #f59e0b;'}">${d.carryForward.toFixed(2)}</td>
                    </tr>
                    ` : ''}
                    ${d.paidAmount > 0 ? `
                    <tr>
                        <td style="padding: 4px 0; color: #6b7280;">Amount Paid</td>
                        <td style="padding: 4px 0; text-align: right; font-weight: 600; color: #059669;">${d.paidAmount.toFixed(2)}</td>
                    </tr>
                    ` : ''}
                    <tr style="border-top: 1px solid #d1d5db; font-weight: bold;">
                        <td style="padding: 6px 0; color: #374151;">${d.balance > 0 ? 'Balance Due' : (d.balance < 0 ? 'Overpayment' : 'Settled')}</td>
                        <td style="padding: 6px 0; text-align: right; font-weight: bold; color: ${d.balance > 0 ? '#dc2626' : (d.balance < 0 ? '#059669' : '#6b7280')};">${d.balance.toFixed(2)}</td>
                    </tr>
                </table>
            </div>
            ` : ''}

            <!-- Paid Leave Balance -->
            ${paidLeaveBalance ? `
            <div style="margin-top: 10px; font-size: 11px; color: #6b7280; text-align: center;">
                <strong>Paid Leave:</strong> ${paidLeaveBalance.days_count} days ${paidLeaveBalance.condition_type} ${paidLeaveBalance.months_count} ${paidLeaveBalance.period_type} &nbsp;|&nbsp; <strong>Remaining:</strong> <span style="font-weight: bold; color: ${paidLeaveBalance.remaining > 0 ? '#1e40af' : '#dc2626'};">${paidLeaveBalance.remaining}</span>
            </div>
            ` : ''}

            <!-- Signature lines -->
            <div style='display: flex; justify-content: space-between; margin-top: 40px; font-size: 12px; color: #6b7280;'>
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

    // Show/hide WhatsApp button based on employee phone
    const whatsappBtn = document.getElementById('whatsapp-payslip-btn');
    if (d.phone) {
        whatsappBtn.classList.remove('hidden');
        whatsappBtn.title = `Send to ${d.phone}`;
    } else {
        whatsappBtn.classList.add('hidden');
    }
    window._currentPayslipIdx = idx;

    // Load signed payslip info if payment exists
    loadSignedPayslipInfo(d.id, d.month);
}

function closePayslipModal() {
    document.getElementById('payslip-modal').classList.add('hidden');
    document.getElementById('signed-payslip-section').classList.add('hidden');
}

async function loadSignedPayslipInfo(employeeId, month) {
    try {
        const response = await fetch(`${API_BASE}/employee-payments?employee_id=${employeeId}&month=${month}`);
        const payments = await response.json();
        const payment = payments.find(p => p.employee_id === employeeId && p.month === month);
        
        const signedSection = document.getElementById('signed-payslip-section');
        const signedContent = document.getElementById('signed-payslip-content');
        const viewBtn = document.getElementById('view-signed-payslip-btn');
        const deleteBtn = document.getElementById('delete-signed-payslip-btn');
        
        if (payment && payment.signed_payslip_path) {
            signedSection.classList.remove('hidden');
            signedContent.innerHTML = `
                <div class="flex items-center gap-2 text-sm text-green-600">
                    <i class="fas fa-check-circle"></i>
                    <span>Signed copy uploaded on ${payment.signed_at ? new Date(payment.signed_at).toLocaleDateString() : 'N/A'}</span>
                </div>
            `;
            viewBtn.classList.remove('hidden');
            deleteBtn.classList.remove('hidden');
            window._currentSignedPayslipPath = payment.signed_payslip_path;
            window._currentPaymentId = payment.id;
        } else {
            signedSection.classList.remove('hidden');
            signedContent.innerHTML = `<div class="text-sm text-gray-500">No signed copy uploaded yet</div>`;
            viewBtn.classList.add('hidden');
            deleteBtn.classList.add('hidden');
            window._currentSignedPayslipPath = null;
            window._currentPaymentId = payment ? payment.id : null;
        }
    } catch (error) {
        console.error('Error loading signed payslip info:', error);
    }
}

async function uploadSignedPayslip() {
    const fileInput = document.getElementById('signed-payslip-upload');
    const file = fileInput.files[0];
    
    if (!file) return;
    
    if (!window._currentPaymentId) {
        alert('No payment record found. Please process payment first.');
        return;
    }
    
    const formData = new FormData();
    formData.append('signed_payslip', file);
    
    try {
        const response = await fetch(`${API_BASE}/employee-payments/${window._currentPaymentId}/signed-payslip`, {
            method: 'POST',
            body: formData
        });
        
        if (response.ok) {
            const result = await response.json();
            alert('Signed payslip uploaded successfully');
            loadSignedPayslipInfo(window._payslipData[window._currentPayslipIdx].id, window._payslipData[window._currentPayslipIdx].month);
        } else {
            const error = await response.json();
            alert('Error uploading signed payslip: ' + (error.error || 'Unknown error'));
        }
    } catch (error) {
        console.error('Error uploading signed payslip:', error);
        alert('Error uploading signed payslip: ' + error.message);
    }
    
    fileInput.value = '';
}

function viewSignedPayslip() {
    if (window._currentSignedPayslipPath) {
        window.open(window._currentSignedPayslipPath, '_blank');
    }
}

async function deleteSignedPayslip() {
    if (!confirm('Are you sure you want to delete the signed payslip copy?')) {
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE}/employee-payments/${window._currentPaymentId}/signed-payslip`, {
            method: 'DELETE'
        });
        
        if (response.ok) {
            alert('Signed payslip deleted successfully');
            loadSignedPayslipInfo(window._payslipData[window._currentPayslipIdx].id, window._payslipData[window._currentPayslipIdx].month);
        } else {
            const error = await response.json();
            alert('Error deleting signed payslip: ' + (error.error || 'Unknown error'));
        }
    } catch (error) {
        console.error('Error deleting signed payslip:', error);
        alert('Error deleting signed payslip: ' + error.message);
    }
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
                body { margin: 30px; font-family:'Segoe UI','Roboto',Arial,sans-serif; }
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
    emailBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-1"></i>Generating...';

    try {
        const element = document.getElementById('payslip-printable');
        const [year, mon] = d.month.split('-');
        const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
        const monthYear = `${monthNames[parseInt(mon) - 1]} ${year}`;
        const fileName = `Payslip_${d.name.replace(/\s+/g, '_')}_${monthYear.replace(/\s+/g, '_')}.pdf`;

        // Generate PDF and download
        const opt = {
            margin: 10,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { scale: 2 },
            jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
        };
        
        const pdfBlob = await html2pdf().set(opt).from(element).outputPdf('blob');
        
        // Download the PDF
        const url = URL.createObjectURL(pdfBlob);
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

        // Open Outlook with pre-filled email
        emailBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-1"></i>Opening Outlook...';
        
        const subject = encodeURIComponent(`Payslip for ${monthYear} - MWH Management`);
        const body = encodeURIComponent(`Dear ${d.name},\n\nPlease find attached your payslip for the month of ${monthYear}.\n\nRegards,\nMWH Management`);
        const mailtoUrl = `mailto:${d.email}?subject=${subject}&body=${body}`;
        
        window.location.href = mailtoUrl;
        
        alert(`PDF downloaded as "${fileName}".\n\nOutlook has been opened with pre-filled email.\nPlease attach the PDF to the email.`);
    } catch (error) {
        alert('Failed to generate PDF: ' + error.message);
    }
    
    emailBtn.disabled = false;
    emailBtn.innerHTML = '<i class="fas fa-envelope mr-1"></i>Email';
}

async function whatsappPayslip() {
    const d = window._payslipData[window._currentPayslipIdx];
    if (!d || !d.phone) {
        alert('No phone number available for this employee.');
        return;
    }

    const [year, mon] = d.month.split('-');
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const monthYear = `${monthNames[parseInt(mon) - 1]} ${year}`;

    // Clean phone number (remove spaces, dashes, etc.)
    const cleanPhone = d.phone.replace(/[\s\-\(\)]/g, '');
    
    // Open WhatsApp with pre-filled message
    const message = encodeURIComponent(`Hi ${d.name},\n\nPlease find attached your payslip for ${monthYear}.\n\nBest regards`);
    const whatsappUrl = `https://wa.me/${cleanPhone}?text=${message}`;
    
    window.open(whatsappUrl, '_blank');
    
    alert(`WhatsApp opened.\n\nPlease attach the payslip PDF to the message.\n\nTip: First click "Save PDF" to download the payslip, then click WhatsApp to share it.`);
}

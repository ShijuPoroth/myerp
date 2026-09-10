// Dashboard functionality

async function showExpiringDocsPopup() {
    try {
        const response = await fetch(`${API_BASE}/employee-documents/expiry-warnings`);
        const warnings = await response.json();

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const rows = warnings.map(w => {
            const expiry = new Date(w.expiry_date);
            expiry.setHours(0, 0, 0, 0);
            const diffDays = Math.ceil((expiry - today) / (1000 * 60 * 60 * 24));
            const statusClass = diffDays < 0 ? 'bg-red-100 text-red-800' : diffDays <= 7 ? 'bg-orange-100 text-orange-800' : 'bg-yellow-100 text-yellow-800';
            const statusText = diffDays < 0 ? `Expired (${Math.abs(diffDays)}d ago)` : `${diffDays} days left`;
            return `<tr>
                <td class="px-3 py-2 text-sm">${w.first_name || ''} ${w.last_name || ''}</td>
                <td class="px-3 py-2 text-sm">${w.emp_id || '-'}</td>
                <td class="px-3 py-2 text-sm">${w.document_type || '-'}</td>
                <td class="px-3 py-2 text-sm">${w.expiry_date}</td>
                <td class="px-3 py-2 text-sm"><span class="px-2 py-0.5 text-xs rounded-full ${statusClass}">${statusText}</span></td>
            </tr>`;
        }).join('');

        let modal = document.getElementById('expiring-docs-popup');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'expiring-docs-popup';
            modal.className = 'modal fixed inset-0 bg-black bg-opacity-50 items-center justify-center z-50';
            document.body.appendChild(modal);
        }
        modal.innerHTML = `
            <div class="bg-white rounded-lg shadow-xl w-full max-w-3xl my-6 max-h-[80vh] overflow-y-auto">
                <div class="p-6">
                    <div class="flex justify-between items-center mb-4">
                        <h3 class="text-lg font-semibold text-red-600"><i class="fas fa-file-alt mr-2"></i>Documents Expiring Soon (${warnings.length})</h3>
                        <button onclick="document.getElementById('expiring-docs-popup').classList.remove('active')" class="text-gray-400 hover:text-gray-600"><i class="fas fa-times text-lg"></i></button>
                    </div>
                    ${warnings.length > 0 ? `
                    <table class="w-full">
                        <thead class="bg-gray-50">
                            <tr>
                                <th class="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Employee</th>
                                <th class="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">ID</th>
                                <th class="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Document Type</th>
                                <th class="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Expiry Date</th>
                                <th class="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-gray-200">${rows}</tbody>
                    </table>` : '<p class="text-gray-500 text-center py-8">No documents expiring soon</p>'}
                    <div class="mt-4 flex justify-end">
                        <button onclick="document.getElementById('expiring-docs-popup').classList.remove('active')" class="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700">Close</button>
                    </div>
                </div>
            </div>
        `;
        modal.classList.add('active');
    } catch (error) {
        console.error('Error loading expiring documents:', error);
    }
}

async function loadModuleDashboard(forceModule) {
    try {
        const url = `${API_BASE}/dashboard/module-stats${forceModule ? '?module=' + forceModule : ''}`;
const res = await fetch(url, { credentials: 'include' });
        const s = await res.json();
const mod = forceModule || s.module;
        const containerId = mod === 'hr' ? 'hr-dashboard-container' : 'equipment-dashboard-container';
        const container = document.getElementById(containerId);
        if (!container) return;

        if (mod === 'equipment') {
            const pmAlerts = await fetchPMAlerts();
            const overduePMs = pmAlerts.filter(p => p.overdue);
            const upcomingPMs = pmAlerts.filter(p => !p.overdue);
            const recentMaintCount = (s.recentMaintenance || []).length;
            const writeOffCount = s.pendingWriteOff ?? 0;
            window._dashboardData = { overduePMs, upcomingPMs, recentMaintenance: s.recentMaintenance || [], pendingWriteOffList: s.pendingWriteOffList || [] };
            container.innerHTML = `
            <div class="mb-6">
                <h2 class="text-xl font-bold text-gray-800 mb-4"><i class="fas fa-tools mr-2 text-blue-600"></i>Equipment Dashboard</h2>
                <div class="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
                    <div class="bg-white rounded-xl shadow p-5">
                        <div class="flex items-center gap-3 mb-3">
                            <div class="p-3 bg-blue-100 rounded-full"><i class="fas fa-boxes text-blue-600 text-lg"></i></div>
                            <div>
                                <p class="text-xs text-gray-500">Total Equipment</p>
                                <p class="text-2xl font-bold text-gray-800">${s.total ?? 0}</p>
                            </div>
                        </div>
                        <div class="border-t border-gray-100 pt-2 space-y-1">
                            ${(s.ownerBreakdown || []).map(o => `
                            <div class="flex justify-between text-xs">
                                <span class="text-gray-500">${o.owner || 'Unassigned'}</span>
                                <span class="font-semibold text-blue-700">${o.count}</span>
                            </div>`).join('')}
                            <div class="border-t border-gray-50 mt-1 pt-1 space-y-1">
                            ${(s.statusBreakdown || []).map(st => `
                            <div class="flex justify-between text-xs">
                                <span class="text-gray-400">${st.status || 'Unknown'}</span>
                                <span class="font-semibold text-gray-600">${st.count}</span>
                            </div>`).join('')}
                            </div>
                        </div>
                    </div>
                    <div class="bg-white rounded-xl shadow p-5">
                        <div class="flex items-center gap-3 mb-3">
                            <div class="p-3 bg-purple-100 rounded-full"><i class="fas fa-cogs text-purple-600 text-lg"></i></div>
                            <div>
                                <p class="text-xs text-gray-500">Spare Parts</p>
                                <p class="text-lg font-bold text-gray-800">${(s.spareParts && s.spareParts.count) ?? 0} <span class="text-xs font-normal text-gray-400">types &bull; ${(s.spareParts && s.spareParts.stock) ?? 0} in stock</span></p>
                            </div>
                        </div>
                        <div class="border-t border-gray-100 pt-2 space-y-1">
                            <div class="flex justify-between text-xs">
                                <span class="text-gray-500">Total Purchased</span>
                                <span class="font-semibold text-purple-700">$${((s.spareParts && s.spareParts.purchaseCost) ?? 0).toLocaleString('en-US', {minimumFractionDigits:2, maximumFractionDigits:2})}</span>
                            </div>
                            <div class="flex justify-between text-xs">
                                <span class="text-gray-500">Total Consumed</span>
                                <span class="font-semibold text-red-600">$${((s.spareParts && s.spareParts.consumptionCost) ?? 0).toLocaleString('en-US', {minimumFractionDigits:2, maximumFractionDigits:2})}</span>
                            </div>
                        </div>
                    </div>
                    <div class="bg-white rounded-xl shadow p-5 flex items-center gap-4 ${writeOffCount > 0 ? 'border-l-4 border-red-400 cursor-pointer hover:shadow-lg transition-shadow' : ''}" ${writeOffCount > 0 ? 'onclick="showDashboardDetailModal(\'writeoff\')"' : ''}>
                        <div class="p-3 bg-red-100 rounded-full"><i class="fas fa-trash-alt text-red-500 text-xl"></i></div>
                        <div><p class="text-xs text-gray-500">Pending Write-Off</p><p class="text-2xl font-bold ${writeOffCount > 0 ? 'text-red-600' : 'text-gray-800'}">${writeOffCount}</p></div>
                    </div>
                </div>
                <div class="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
                    <div class="bg-white rounded-xl shadow p-5 flex items-center gap-4 ${overduePMs.length > 0 ? 'border-l-4 border-red-500 cursor-pointer hover:shadow-lg transition-shadow' : ''}" ${overduePMs.length > 0 ? 'onclick="showDashboardDetailModal(\'overdue-pm\')"' : ''}>
                        <div class="p-3 bg-red-100 rounded-full"><i class="fas fa-exclamation-circle text-red-500 text-xl"></i></div>
                        <div>
                            <p class="text-xs text-gray-500">Overdue PM</p>
                            <p class="text-2xl font-bold ${overduePMs.length > 0 ? 'text-red-600' : 'text-gray-800'}">${overduePMs.length}</p>
                            ${overduePMs.length > 0 ? '<p class="text-xs text-red-400 mt-1">Click to view details</p>' : ''}
                        </div>
                    </div>
                    <div class="bg-white rounded-xl shadow p-5 flex items-center gap-4 ${upcomingPMs.length > 0 ? 'border-l-4 border-yellow-400 cursor-pointer hover:shadow-lg transition-shadow' : ''}" ${upcomingPMs.length > 0 ? 'onclick="showDashboardDetailModal(\'upcoming-pm\')"' : ''}>
                        <div class="p-3 bg-yellow-100 rounded-full"><i class="fas fa-clock text-yellow-500 text-xl"></i></div>
                        <div>
                            <p class="text-xs text-gray-500">Upcoming PM (10 Days)</p>
                            <p class="text-2xl font-bold ${upcomingPMs.length > 0 ? 'text-yellow-600' : 'text-gray-800'}">${upcomingPMs.length}</p>
                            ${upcomingPMs.length > 0 ? '<p class="text-xs text-yellow-500 mt-1">Click to view details</p>' : ''}
                        </div>
                    </div>
                    <div class="bg-white rounded-xl shadow p-5 flex items-center gap-4 ${recentMaintCount > 0 ? 'border-l-4 border-orange-400 cursor-pointer hover:shadow-lg transition-shadow' : ''}" ${recentMaintCount > 0 ? 'onclick="showDashboardDetailModal(\'maintenance\')"' : ''}>
                        <div class="p-3 bg-orange-100 rounded-full"><i class="fas fa-exclamation-triangle text-orange-500 text-xl"></i></div>
                        <div>
                            <p class="text-xs text-gray-500">Ongoing Maintenance</p>
                            <p class="text-2xl font-bold ${recentMaintCount > 0 ? 'text-orange-600' : 'text-gray-800'}">${recentMaintCount}</p>
                            ${recentMaintCount > 0 ? '<p class="text-xs text-orange-400 mt-1">Click to view details</p>' : ''}
                        </div>
                    </div>
                </div>
            </div>`;
        } else if (mod === 'hr') {
            const acc = s.accommodation || {};
            const ps = s.payrollSummary;
            container.innerHTML = `
            <div class="mb-6">
                <h2 class="text-xl font-bold text-gray-800 mb-4"><i class="fas fa-users mr-2 text-indigo-600"></i>HR Dashboard</h2>
                <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">

                    <!-- Employee Overview Card -->
                    <div class="bg-white rounded-xl shadow p-5">
                        <div class="flex items-center gap-3 mb-4">
                            <div class="p-3 bg-indigo-100 rounded-full"><i class="fas fa-users text-indigo-600 text-xl"></i></div>
                            <div>
                                <p class="text-sm font-bold text-gray-700">Employee Overview</p>
                                <p class="text-2xl font-bold text-indigo-700">${s.totalEmp}</p>
                            </div>
                        </div>
                        <div class="grid grid-cols-2 gap-2">
                            <div class="bg-green-50 rounded-lg p-3 cursor-pointer hover:bg-green-100 transition" onclick="showHRDashboardDetail('active')">
                                <div class="flex items-center justify-between">
                                    <span class="text-xs text-gray-500">Active</span>
                                    <span class="text-lg font-bold text-green-700">${s.activeEmp}</span>
                                </div>
                            </div>
                            <div class="bg-red-50 rounded-lg p-3 cursor-pointer hover:bg-red-100 transition" onclick="showHRDashboardDetail('terminated')">
                                <div class="flex items-center justify-between">
                                    <span class="text-xs text-gray-500">Terminated</span>
                                    <span class="text-lg font-bold text-red-600">${s.terminatedEmp}</span>
                                </div>
                            </div>
                            <div class="bg-orange-50 rounded-lg p-3 cursor-pointer hover:bg-orange-100 transition" onclick="showHRDashboardDetail('on-leave')">
                                <div class="flex items-center justify-between">
                                    <span class="text-xs text-gray-500">On Leave Today</span>
                                    <span class="text-lg font-bold ${s.onLeaveToday > 0 ? 'text-orange-600' : 'text-gray-700'}">${s.onLeaveToday || 0}</span>
                                </div>
                            </div>
                            <div class="bg-orange-50 rounded-lg p-3 cursor-pointer hover:bg-orange-100 transition" onclick="showHRDashboardDetail('absent')">
                                <div class="flex items-center justify-between">
                                    <span class="text-xs text-gray-500">Absent Today</span>
                                    <span class="text-lg font-bold ${s.absentToday > 0 ? 'text-orange-600' : 'text-gray-700'}">${s.absentToday}</span>
                                </div>
                            </div>
                            <div class="bg-red-50 rounded-lg p-3 cursor-pointer hover:bg-red-100 transition" onclick="showHRDashboardDetail('docs-expiring')">
                                <div class="flex items-center justify-between">
                                    <span class="text-xs text-gray-500">Docs Expiring</span>
                                    <span class="text-lg font-bold ${s.docsExpiring > 0 ? 'text-red-600' : 'text-gray-700'}">${s.docsExpiring}</span>
                                </div>
                            </div>
                            <div class="bg-blue-50 rounded-lg p-3 cursor-pointer hover:bg-blue-100 transition" onclick="showHRDashboardDetail('new-this-month')">
                                <div class="flex items-center justify-between">
                                    <span class="text-xs text-gray-500">New This Month</span>
                                    <span class="text-lg font-bold text-blue-600">${s.newThisMonth}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Accommodation Overview Card -->
                    <div class="bg-white rounded-xl shadow p-5">
                        <div class="flex items-center gap-3 mb-4">
                            <div class="p-3 bg-teal-100 rounded-full"><i class="fas fa-bed text-teal-600 text-xl"></i></div>
                            <div>
                                <p class="text-sm font-bold text-gray-700">Accommodation Overview</p>
                                <p class="text-2xl font-bold text-teal-700">${acc.total_rooms || 0} Rooms</p>
                            </div>
                        </div>
                        <div class="grid grid-cols-2 gap-2">
                            <div class="bg-teal-50 rounded-lg p-3 cursor-pointer hover:bg-teal-100 transition" onclick="showHRDashboardDetail('acc-all-rooms')">
                                <div class="flex items-center justify-between">
                                    <span class="text-xs text-gray-500">Total Rooms</span>
                                    <span class="text-lg font-bold text-teal-700">${acc.total_rooms || 0}</span>
                                </div>
                            </div>
                            <div class="bg-green-50 rounded-lg p-3 cursor-pointer hover:bg-green-100 transition" onclick="showHRDashboardDetail('acc-occupied')">
                                <div class="flex items-center justify-between">
                                    <span class="text-xs text-gray-500">Occupied</span>
                                    <span class="text-lg font-bold text-green-700">${acc.occupied_rooms || 0}</span>
                                </div>
                            </div>
                            <div class="bg-blue-50 rounded-lg p-3 cursor-pointer hover:bg-blue-100 transition" onclick="showHRDashboardDetail('acc-empty')">
                                <div class="flex items-center justify-between">
                                    <span class="text-xs text-gray-500">Empty</span>
                                    <span class="text-lg font-bold text-blue-600">${acc.empty_rooms || 0}</span>
                                </div>
                            </div>
                            <div class="bg-orange-50 rounded-lg p-3 cursor-pointer hover:bg-orange-100 transition" onclick="showHRDashboardDetail('acc-unassigned')">
                                <div class="flex items-center justify-between">
                                    <span class="text-xs text-gray-500">Unassigned Employees</span>
                                    <span class="text-lg font-bold ${(acc.unassigned_employees || 0) > 0 ? 'text-orange-600' : 'text-gray-700'}">${acc.unassigned_employees || 0}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Payment Overview Card -->
                    <div class="bg-white rounded-xl shadow p-5">
                        <div class="flex items-center gap-3 mb-4">
                            <div class="p-3 bg-green-100 rounded-full"><i class="fas fa-money-bill-wave text-green-600 text-xl"></i></div>
                            <div>
                                <p class="text-sm font-bold text-gray-700">Payment Overview</p>
                                <p class="text-xs text-gray-400">${ps ? ps.month : '-'}</p>
                            </div>
                        </div>
                        ${ps ? `
                        <div class="grid grid-cols-2 gap-2">
                            <div class="bg-green-50 rounded-lg p-3">
                                <div class="flex items-center justify-between">
                                    <span class="text-xs text-gray-500">Gross Pay</span>
                                    <span class="text-lg font-bold text-green-700">${ps.totalGross.toFixed(2)}</span>
                                </div>
                            </div>
                            <div class="bg-red-50 rounded-lg p-3">
                                <div class="flex items-center justify-between">
                                    <span class="text-xs text-gray-500">Advances</span>
                                    <span class="text-lg font-bold text-red-600">${ps.totalAdvance.toFixed(2)}</span>
                                </div>
                            </div>
                            <div class="bg-blue-50 rounded-lg p-3">
                                <div class="flex items-center justify-between">
                                    <span class="text-xs text-gray-500">Net Pay</span>
                                    <span class="text-lg font-bold ${ps.totalNet < 0 ? 'text-red-600' : 'text-blue-700'}">${ps.totalNet.toFixed(2)}</span>
                                </div>
                            </div>
                            <div class="bg-purple-50 rounded-lg p-3">
                                <div class="flex items-center justify-between">
                                    <span class="text-xs text-gray-500">Overtime</span>
                                    <span class="text-lg font-bold text-purple-700">${ps.totalOvertime.toFixed(2)}</span>
                                </div>
                            </div>
                        </div>` : '<p class="text-gray-400 text-sm text-center py-4">No payment data available</p>'}
                    </div>

                    <!-- Uniform Overview Card -->
                    <div class="bg-white rounded-xl shadow p-5 cursor-pointer hover:shadow-lg transition-shadow" onclick="showSection('hr'); showHRTab('uniform-management');">
                        <div class="flex items-center gap-3 mb-4">
                            <div class="p-3 bg-purple-100 rounded-full"><i class="fas fa-tshirt text-purple-600 text-xl"></i></div>
                            <div>
                                <p class="text-sm font-bold text-gray-700">Uniform Overview</p>
                                <p class="text-xs text-gray-400">Click to manage uniforms</p>
                            </div>
                        </div>
                        <div class="grid grid-cols-2 gap-2">
                            <div class="bg-gray-50 rounded-lg p-3">
                                <div class="flex items-center justify-between">
                                    <span class="text-xs text-gray-400">Total Items</span>
                                    <span class="text-lg font-bold text-gray-700">${s.totalUniformItems ?? 0}</span>
                                </div>
                            </div>
                            <div class="bg-gray-50 rounded-lg p-3">
                                <div class="flex items-center justify-between">
                                    <span class="text-xs text-gray-400">Low Stock</span>
                                    <span class="text-lg font-bold ${(s.uniformLowStock ?? 0) > 0 ? 'text-red-600' : 'text-gray-700'}">${s.uniformLowStock ?? 0}</span>
                                </div>
                            </div>
                            <div class="bg-gray-50 rounded-lg p-3">
                                <div class="flex items-center justify-between">
                                    <span class="text-xs text-gray-400">Distributions</span>
                                    <span class="text-lg font-bold text-gray-700">${s.uniformDistributions ?? 0}</span>
                                </div>
                            </div>
                            <div class="bg-gray-50 rounded-lg p-3">
                                <div class="flex items-center justify-between">
                                    <span class="text-xs text-gray-400">Purchases</span>
                                    <span class="text-lg font-bold text-gray-700">${s.uniformPurchases ?? 0}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                </div>
            </div>`;
        } else {
            container.innerHTML = `
            <div class="bg-white rounded-xl shadow p-8 text-center text-gray-400">
                <i class="fas fa-tachometer-alt text-4xl mb-3 text-blue-300"></i>
                <p class="text-lg font-semibold">Welcome to OpsMaster</p>
                <p class="text-sm mt-1">Use the sidebar to navigate to your module.</p>
            </div>`;
        }
    } catch(e) {
        console.error('Error loading module dashboard:', e);
    }
}

async function loadDashboardStats() {
    try {
        const [equipmentRes, employeesRes, authorizerRes] = await Promise.all([
            fetch(`${API_BASE}/equipment?_t=${Date.now()}`, { credentials: 'include' }),
            fetch(`${API_BASE}/employees?_t=${Date.now()}`, { credentials: 'include' }),
            fetch(`${API_BASE}/equipment/write-offs`, { credentials: 'include' })
        ]);

        const equipment = equipmentRes.ok ? await equipmentRes.json() : [];
        const employees = employeesRes.ok ? await employeesRes.json() : [];
        const authorizerRequests = authorizerRes.ok ? await authorizerRes.json() : [];

        window._adminDashboardData = { equipment, employees, authorizerRequests };

        // Equipment counts (case-insensitive status matching)
        const eqStatus = eq => (eq.display_status || eq.status || '').toLowerCase();
        const inService = equipment.filter(eq => eqStatus(eq) === 'in service').length;
        const inStores = equipment.filter(eq => eqStatus(eq) === 'in stores').length;
        const underMaintenance = equipment.filter(eq => eqStatus(eq) === 'under maintenance').length;
        const pendingWriteOff = equipment.filter(eq => eqStatus(eq) === 'pending write off').length;

        document.getElementById('dash-equipment-total').textContent = equipment.length;
        document.getElementById('dash-equipment-in-service').textContent = inService;
        document.getElementById('dash-equipment-in-stores').textContent = inStores;
        document.getElementById('dash-equipment-under-maintenance').textContent = underMaintenance;
        document.getElementById('dash-equipment-pending-write-off').textContent = pendingWriteOff;

        // HR counts
        const active = employees.filter(emp => emp.status === 'Active').length;
        const onLeave = employees.filter(emp => emp.status === 'On Leave').length;
        const terminated = employees.filter(emp => emp.status === 'Terminated' || emp.is_terminated === 1).length;

        document.getElementById('dash-hr-total').textContent = employees.length;
        document.getElementById('dash-hr-active').textContent = active;
        document.getElementById('dash-hr-on-leave').textContent = onLeave;
        document.getElementById('dash-hr-terminated').textContent = terminated;

        // Authorizer counts
        const pending = authorizerRequests.filter(r => r.status === 'Pending').length;
        const approved = authorizerRequests.filter(r => r.status === 'Approved').length;
        const rejected = authorizerRequests.filter(r => r.status === 'Rejected').length;

        document.getElementById('dash-authorizer-total').textContent = authorizerRequests.length;
        document.getElementById('dash-authorizer-pending').textContent = pending;
        document.getElementById('dash-authorizer-approved').textContent = approved;
        document.getElementById('dash-authorizer-rejected').textContent = rejected;
    } catch (error) {
        console.error('Error loading admin dashboard stats:', error);
    }
}

async function fetchPMAlerts() {
    try {
        const res = await fetch(`${API_BASE}/equipment`, { credentials: 'include' });
        if (!res.ok) return [];
        const equipment = await res.json();
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tenDaysLater = new Date(today);
        tenDaysLater.setDate(tenDaysLater.getDate() + 10);

        const alerts = [];
        for (const eq of equipment) {
            if (!eq.next_pm_date) continue;
            if (eq.status === 'Written Off') continue;
            const dueDate = new Date(eq.next_pm_date);
            if (isNaN(dueDate.getTime())) continue;
            dueDate.setHours(0, 0, 0, 0);

            if (eq.next_pm_overdue) {
                let daysOverdue = 0;
                if (eq.missed_pm_dates && eq.missed_pm_dates.length > 0) {
                    const allMissedDates = eq.missed_pm_dates.flatMap(m => m.missed_dates || []);
                    if (allMissedDates.length > 0) {
                        const latestMissed = allMissedDates.map(d => new Date(d)).sort((a, b) => b - a)[0];
                        latestMissed.setHours(0, 0, 0, 0);
                        daysOverdue = Math.round((today - latestMissed) / (1000 * 60 * 60 * 24));
                    }
                }
                alerts.push({
                    ...eq,
                    overdue: true,
                    days_overdue: daysOverdue
                });
            } else if (dueDate <= tenDaysLater) {
                const diffDays = Math.round((dueDate - today) / (1000 * 60 * 60 * 24));
                alerts.push({
                    ...eq,
                    overdue: false,
                    days_left: diffDays
                });
            }
        }
        alerts.sort((a, b) => {
            if (a.overdue && !b.overdue) return -1;
            if (!a.overdue && b.overdue) return 1;
            return new Date(a.next_pm_date) - new Date(b.next_pm_date);
        });
        return alerts;
    } catch (e) {
        console.error('Error fetching PM alerts:', e);
        return [];
    }
}

function showDashboardDetailModal(type) {
    const data = window._dashboardData || {};
    let title = '', icon = '', iconColor = '', tableHtml = '';

    if (type === 'overdue-pm') {
        const items = data.overduePMs || [];
        title = `Overdue Preventive Maintenance (${items.length})`;
        icon = 'fa-exclamation-circle';
        iconColor = 'text-red-500';
        tableHtml = `
            <table class="w-full text-sm">
                <thead><tr class="text-xs text-gray-500 border-b">
                    <th class="text-left pb-2">Equipment</th>
                    <th class="text-left pb-2">EQ No.</th>
                    <th class="text-left pb-2">Location</th>
                    <th class="text-left pb-2">PM Type</th>
                    <th class="text-left pb-2">Next PM Date</th>
                    <th class="text-left pb-2">Days Overdue</th>
                    <th class="text-left pb-2">Missed PM Schedules</th>
                </tr></thead>
                <tbody class="divide-y divide-gray-100">
                    ${items.map(p => {
                        const loc = [p.country_name, p.location_name, p.sub_location_name].filter(Boolean).join(' › ');
                        const missedHtml = p.missed_pm_dates && p.missed_pm_dates.length > 0
                            ? p.missed_pm_dates.map(m => `<div class="mb-1"><span class="font-medium capitalize">${m.pm_type}</span>: ${m.missed_dates.map(d => formatDate(d)).join(', ')}</div>`).join('')
                            : '-';
                        return `<tr>
                            <td class="py-2 font-medium">${p.name || '-'}</td>
                            <td class="py-2 text-gray-600">${p.auto_serial_number || '-'}</td>
                            <td class="py-2 text-gray-500 text-xs">${loc || '-'}</td>
                            <td class="py-2"><span class="px-2 py-0.5 text-xs rounded-full bg-blue-100 text-blue-700 capitalize">${p.next_pm_type || '-'}</span></td>
                            <td class="py-2 text-gray-600 font-semibold">${formatDate(p.next_pm_date)}</td>
                            <td class="py-2"><span class="px-2 py-0.5 text-xs rounded-full bg-red-100 text-red-700">${p.days_overdue} day${p.days_overdue !== 1 ? 's' : ''}</span></td>
                            <td class="py-2 text-xs text-red-600">${missedHtml}</td>
                        </tr>`;
                    }).join('')}
                </tbody>
            </table>`;
    } else if (type === 'upcoming-pm') {
        const items = data.upcomingPMs || [];
        title = `Upcoming Preventive Maintenance - Within 10 Days (${items.length})`;
        icon = 'fa-clock';
        iconColor = 'text-yellow-500';
        tableHtml = `
            <table class="w-full text-sm">
                <thead><tr class="text-xs text-gray-500 border-b">
                    <th class="text-left pb-2">Equipment</th>
                    <th class="text-left pb-2">EQ No.</th>
                    <th class="text-left pb-2">Location</th>
                    <th class="text-left pb-2">PM Type</th>
                    <th class="text-left pb-2">Due Date</th>
                    <th class="text-left pb-2">Days Left</th>
                </tr></thead>
                <tbody class="divide-y divide-gray-100">
                    ${items.map(p => {
                        const loc = [p.country_name, p.location_name, p.sub_location_name].filter(Boolean).join(' › ');
                        return `<tr>
                            <td class="py-2 font-medium">${p.name || '-'}</td>
                            <td class="py-2 text-gray-600">${p.auto_serial_number || '-'}</td>
                            <td class="py-2 text-gray-500 text-xs">${loc || '-'}</td>
                            <td class="py-2"><span class="px-2 py-0.5 text-xs rounded-full bg-blue-100 text-blue-700 capitalize">${p.next_pm_type || '-'}</span></td>
                            <td class="py-2 text-yellow-600 font-semibold">${formatDate(p.next_pm_date)}</td>
                            <td class="py-2"><span class="px-2 py-0.5 text-xs rounded-full bg-yellow-100 text-yellow-700">${p.days_left} day${p.days_left !== 1 ? 's' : ''}</span></td>
                        </tr>`;
                    }).join('')}
                </tbody>
            </table>`;
    } else if (type === 'maintenance') {
        const items = data.recentMaintenance || [];
        title = `Ongoing / Pending Maintenance (${items.length})`;
        icon = 'fa-exclamation-triangle';
        iconColor = 'text-orange-500';
        tableHtml = `
            <table class="w-full text-sm">
                <thead><tr class="text-xs text-gray-500 border-b">
                    <th class="text-left pb-2">Equipment</th>
                    <th class="text-left pb-2">EQ No.</th>
                    <th class="text-left pb-2">Barcode</th>
                    <th class="text-left pb-2">Serial No.</th>
                    <th class="text-left pb-2">Location</th>
                    <th class="text-left pb-2">Type</th>
                    <th class="text-left pb-2">Status</th>
                </tr></thead>
                <tbody class="divide-y divide-gray-100">
                    ${items.map(m => {
                        const loc = [m.country_name, m.location_name, m.sub_location_name].filter(Boolean).join(' › ');
                        return `<tr>
                            <td class="py-2 font-medium">${m.equip_name || '-'}</td>
                            <td class="py-2 text-gray-600">${m.auto_serial_number || '-'}</td>
                            <td class="py-2 text-gray-600">${m.barcode || '-'}</td>
                            <td class="py-2 text-gray-600">${m.serial_number || '-'}</td>
                            <td class="py-2 text-gray-500 text-xs">${loc || '-'}</td>
                            <td class="py-2 text-gray-600">${m.maintenance_type || '-'}</td>
                            <td class="py-2"><span class="px-2 py-0.5 text-xs rounded-full bg-orange-100 text-orange-700">${m.maintenance_status || '-'}</span></td>
                        </tr>`;
                    }).join('')}
                </tbody>
            </table>`;
    } else if (type === 'writeoff') {
        const items = data.pendingWriteOffList || [];
        title = `Pending Write-Off Requests (${items.length})`;
        icon = 'fa-trash-alt';
        iconColor = 'text-red-500';
        tableHtml = `
            <table class="w-full text-sm">
                <thead><tr class="text-xs text-gray-500 border-b">
                    <th class="text-left pb-2">Equipment</th>
                    <th class="text-left pb-2">EQ No.</th>
                    <th class="text-left pb-2">Barcode</th>
                    <th class="text-left pb-2">Serial No.</th>
                    <th class="text-left pb-2">Location</th>
                    <th class="text-left pb-2">Write-Off Date</th>
                    <th class="text-left pb-2">Reason</th>
                </tr></thead>
                <tbody class="divide-y divide-gray-100">
                    ${items.map(w => {
                        const loc = [w.country_name, w.location_name, w.sub_location_name].filter(Boolean).join(' › ');
                        return `<tr>
                            <td class="py-2 font-medium">${w.equip_name || '-'}</td>
                            <td class="py-2 text-gray-600">${w.auto_serial_number || '-'}</td>
                            <td class="py-2 text-gray-600">${w.barcode || '-'}</td>
                            <td class="py-2 text-gray-600">${w.serial_number || '-'}</td>
                            <td class="py-2 text-gray-500 text-xs">${loc || '-'}</td>
                            <td class="py-2 text-gray-500">${w.write_off_date || '-'}</td>
                            <td class="py-2 text-gray-600">${w.reason || '-'}</td>
                        </tr>`;
                    }).join('')}
                </tbody>
            </table>`;
    }

    let modal = document.getElementById('dashboard-detail-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'dashboard-detail-modal';
        modal.className = 'fixed inset-0 z-[9999] flex items-center justify-center p-4';
        modal.innerHTML = `
            <div class="absolute inset-0 bg-black bg-opacity-50" onclick="closeDashboardDetailModal()"></div>
            <div class="relative bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[85vh] flex flex-col">
                <div class="flex items-center justify-between px-6 py-4 border-b border-gray-200">
                    <h3 id="dashboard-detail-title" class="text-lg font-bold text-gray-800"></h3>
                    <button onclick="closeDashboardDetailModal()" class="text-gray-400 hover:text-gray-600 text-2xl leading-none">&times;</button>
                </div>
                <div id="dashboard-detail-body" class="overflow-y-auto p-6"></div>
            </div>
        `;
        document.body.appendChild(modal);
    }
    document.getElementById('dashboard-detail-title').innerHTML = `<i class="fas ${icon} mr-2 ${iconColor}"></i>${title}`;
    document.getElementById('dashboard-detail-body').innerHTML = tableHtml;
    modal.classList.remove('hidden');
    modal.style.display = 'flex';
}

function closeDashboardDetailModal() {
    const modal = document.getElementById('dashboard-detail-modal');
    if (modal) {
        modal.style.display = 'none';
    }
}

async function assignFromDashboard(empPkId) {
    closeDashboardDetailModal();
    showSection('hr');
    showHRTab('accommodation-management');
    showAccommodationTab('room-assignments');
    await loadHRAccommodationRoomAssignments();
    openHRAccommodationRoomAssignmentModal(empPkId);
}

async function showHRDashboardDetail(type) {
    let title = '', icon = '', iconColor = '', tableHtml = '';

    try {
        if (type === 'acc-unassigned' || type === 'acc-occupied' || type === 'acc-empty' || type === 'acc-all-rooms') {
            const [assignRes, roomsRes] = await Promise.all([
                fetch(`${API_BASE}/accommodation-room-assignments`, { credentials: 'include' }),
                fetch(`${API_BASE}/accommodation-rooms`, { credentials: 'include' })
            ]);
            const assignments = assignRes.ok ? await assignRes.json() : [];
            const rooms = (roomsRes.ok ? await roomsRes.json() : []).sort((a, b) => {
                const an = parseFloat(a.name), bn = parseFloat(b.name);
                if (!isNaN(an) && !isNaN(bn)) return an - bn;
                if (!isNaN(an)) return -1;
                if (!isNaN(bn)) return 1;
                return (a.name || '').localeCompare(b.name || '');
            });

            const assignedEmpIds = new Set(assignments.filter(a => a.assignment_id).map(a => a.emp_pk_id));
            const occupiedRoomIds = new Set(assignments.filter(a => a.assignment_id).map(a => a.room_id));

            if (type === 'acc-unassigned') {
                const items = assignments.filter(a => !a.assignment_id);
                title = `Unassigned Employees (${items.length})`;
                icon = 'fa-user-plus';
                iconColor = 'text-orange-500';
                tableHtml = `
                    <table class="w-full text-sm">
                        <thead class="sticky top-0 bg-gray-100 z-10 border-b border-gray-300 shadow-sm"><tr class="text-xs text-gray-500">
                            <th class="text-left pb-3 pt-3" style="width:40px">#</th>
                            <th class="text-left pb-3 pt-3">Employee</th>
                            <th class="text-left pb-3 pt-3">Emp Code</th>
                            <th class="text-left pb-3 pt-3" style="width:80px">Action</th>
                        </tr></thead>
                        <tbody class="divide-y divide-gray-100">
                            ${items.length === 0 ? '<tr><td colspan="4" class="py-4 text-center text-gray-400">All employees are assigned</td></tr>' : items.map((a, i) => `
                                <tr>
                                    <td class="py-2 text-gray-400">${i + 1}</td>
                                    <td class="py-2 font-medium">${a.first_name || '-'} ${a.last_name || ''}</td>
                                    <td class="py-2 text-gray-600">${a.emp_code || '-'}</td>
                                    <td class="py-2"><button onclick="assignFromDashboard(${a.emp_pk_id})" class="px-3 py-1 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"><i class="fas fa-bed mr-1"></i>Assign</button></td>
                                </tr>`).join('')}
                        </tbody>
                    </table>`;
            } else if (type === 'acc-occupied') {
                const occupiedRooms = rooms.filter(r => occupiedRoomIds.has(r.id));
                title = `Occupied Rooms (${occupiedRooms.length})`;
                icon = 'fa-bed';
                iconColor = 'text-green-600';
                tableHtml = `
                    <table class="w-full text-sm">
                        <thead class="sticky top-0 bg-gray-100 z-10 border-b border-gray-300 shadow-sm"><tr class="text-xs text-gray-500">
                            <th class="text-left pb-3 pt-3" style="width:40px">#</th>
                            <th class="text-left pb-3 pt-3">Room</th>
                            <th class="text-left pb-3 pt-3">Location</th>
                            <th class="text-left pb-3 pt-3">Capacity</th>
                            <th class="text-left pb-3 pt-3">Assigned</th>
                            <th class="text-left pb-3 pt-3">Employees</th>
                        </tr></thead>
                        <tbody class="divide-y divide-gray-100">
                            ${occupiedRooms.length === 0 ? '<tr><td colspan="6" class="py-4 text-center text-gray-400">No occupied rooms</td></tr>' : occupiedRooms.map((r, i) => {
                                const assignedEmps = assignments.filter(a => a.room_id === r.id && a.assignment_id);
                                const empNames = assignedEmps.map(a => `${a.first_name || '-'} ${a.last_name || ''}`).join(', ');
                                return `<tr>
                                    <td class="py-2 text-gray-400">${i + 1}</td>
                                    <td class="py-2 font-medium">${r.name || '-'}</td>
                                    <td class="py-2 text-gray-600">${r.location_name || '-'}</td>
                                    <td class="py-2 text-gray-600">${r.capacity || 0}</td>
                                    <td class="py-2"><span class="px-2 py-0.5 text-xs rounded-full bg-green-100 text-green-700">${assignedEmps.length}</span></td>
                                    <td class="py-2 text-gray-600">${empNames || '-'}</td>
                                </tr>`;
                            }).join('')}
                        </tbody>
                    </table>`;
            } else if (type === 'acc-empty') {
                const emptyRooms = rooms.filter(r => !occupiedRoomIds.has(r.id));
                title = `Empty Rooms (${emptyRooms.length})`;
                icon = 'fa-door-closed';
                iconColor = 'text-blue-500';
                tableHtml = `
                    <table class="w-full text-sm">
                        <thead class="sticky top-0 bg-gray-100 z-10 border-b border-gray-300 shadow-sm"><tr class="text-xs text-gray-500">
                            <th class="text-left pb-3 pt-3" style="width:40px">#</th>
                            <th class="text-left pb-3 pt-3">Room</th>
                            <th class="text-left pb-3 pt-3">Location</th>
                            <th class="text-left pb-3 pt-3">Capacity</th>
                        </tr></thead>
                        <tbody class="divide-y divide-gray-100">
                            ${emptyRooms.length === 0 ? '<tr><td colspan="4" class="py-4 text-center text-gray-400">No empty rooms</td></tr>' : emptyRooms.map((r, i) => `
                                <tr>
                                    <td class="py-2 text-gray-400">${i + 1}</td>
                                    <td class="py-2 font-medium">${r.name || '-'}</td>
                                    <td class="py-2 text-gray-600">${r.location_name || '-'}</td>
                                    <td class="py-2 text-gray-600">${r.capacity || 0}</td>
                                </tr>`).join('')}
                        </tbody>
                    </table>`;
            } else if (type === 'acc-all-rooms') {
                title = `All Rooms (${rooms.length})`;
                icon = 'fa-door-open';
                iconColor = 'text-teal-600';
                tableHtml = `
                    <table class="w-full text-sm">
                        <thead class="sticky top-0 bg-gray-100 z-10 border-b border-gray-300 shadow-sm"><tr class="text-xs text-gray-500">
                            <th class="text-left pb-3 pt-3" style="width:40px">#</th>
                            <th class="text-left pb-3 pt-3">Room</th>
                            <th class="text-left pb-3 pt-3">Location</th>
                            <th class="text-left pb-3 pt-3">Capacity</th>
                            <th class="text-left pb-3 pt-3">Assigned</th>
                            <th class="text-left pb-3 pt-3">Status</th>
                        </tr></thead>
                        <tbody class="divide-y divide-gray-100">
                            ${rooms.length === 0 ? '<tr><td colspan="6" class="py-4 text-center text-gray-400">No rooms found</td></tr>' : rooms.map((r, i) => {
                                const assignedCount = assignments.filter(a => a.room_id === r.id && a.assignment_id).length;
                                const status = assignedCount >= (r.capacity || 0) ? '<span class="px-2 py-0.5 text-xs rounded-full bg-red-100 text-red-700">Full</span>' : assignedCount > 0 ? '<span class="px-2 py-0.5 text-xs rounded-full bg-green-100 text-green-700">Occupied</span>' : '<span class="px-2 py-0.5 text-xs rounded-full bg-blue-100 text-blue-700">Empty</span>';
                                return `<tr>
                                    <td class="py-2 text-gray-400">${i + 1}</td>
                                    <td class="py-2 font-medium">${r.name || '-'}</td>
                                    <td class="py-2 text-gray-600">${r.location_name || '-'}</td>
                                    <td class="py-2 text-gray-600">${r.capacity || 0}</td>
                                    <td class="py-2 text-gray-600">${assignedCount}</td>
                                    <td class="py-2">${status}</td>
                                </tr>`;
                            }).join('')}
                        </tbody>
                    </table>`;
            }

        } else if (type === 'active' || type === 'terminated' || type === 'on-leave' || type === 'absent' || type === 'docs-expiring' || type === 'new-this-month') {
            const empRes = await fetch(`${API_BASE}/employees?_t=${Date.now()}`, { credentials: 'include' });
            const employees = empRes.ok ? await empRes.json() : [];
            const today = new Date().toISOString().split('T')[0];
            const currentMonth = `${today.substring(0, 7)}`;
            let items = [];

            if (type === 'active') {
                items = employees.filter(e => !e.is_terminated || e.is_terminated === 0);
                title = `Active Employees (${items.length})`;
                icon = 'fa-user-check';
                iconColor = 'text-green-600';
            } else if (type === 'terminated') {
                items = employees.filter(e => e.is_terminated === 1 || e.status === 'Terminated');
                title = `Terminated Employees (${items.length})`;
                icon = 'fa-user-times';
                iconColor = 'text-red-500';
            } else if (type === 'on-leave') {
                const leaveRes = await fetch(`${API_BASE}/attendance?month=${currentMonth}`, { credentials: 'include' });
                const attData = leaveRes.ok ? await leaveRes.json() : {};
                const attMap = attData.attendanceMap || {};
                items = (attData.employees || []).filter(e => {
                    const att = attMap[e.id] && attMap[e.id][today];
                    return att && ['paid-leave', 'medical-leave', 'compassionate-leave', 'unpaid-leave'].includes(att.status);
                });
                window._hrOnLeaveAttMap = attMap;
                title = `Employees On Leave Today (${items.length})`;
                icon = 'fa-calendar-times';
                iconColor = 'text-orange-500';
            } else if (type === 'absent') {
                const leaveRes = await fetch(`${API_BASE}/attendance?month=${currentMonth}`, { credentials: 'include' });
                const attData = leaveRes.ok ? await leaveRes.json() : {};
                const attMap = attData.attendanceMap || {};
                items = (attData.employees || []).filter(e => {
                    const att = attMap[e.id] && attMap[e.id][today];
                    return att && att.status === 'unpaid-leave';
                });
                window._hrOnLeaveAttMap = attMap;
                title = `Absent Employees Today (${items.length})`;
                icon = 'fa-user-slash';
                iconColor = 'text-orange-500';
            } else if (type === 'docs-expiring') {
                const docsRes = await fetch(`${API_BASE}/employee-documents/expiry-warnings`, { credentials: 'include' });
                items = docsRes.ok ? await docsRes.json() : [];
                title = `Documents Expiring Soon (${items.length})`;
                icon = 'fa-file-alt';
                iconColor = 'text-red-500';
                tableHtml = `
                    <table class="w-full text-sm">
                        <thead class="sticky top-0 bg-gray-100 z-10 border-b border-gray-300 shadow-sm"><tr class="text-xs text-gray-500">
                            <th class="text-left pb-3 pt-3" style="width:40px">#</th>
                            <th class="text-left pb-3 pt-3">Employee</th>
                            <th class="text-left pb-3 pt-3">Emp ID</th>
                            <th class="text-left pb-3 pt-3">Document Type</th>
                            <th class="text-left pb-3 pt-3">Expiry Date</th>
                        </tr></thead>
                        <tbody class="divide-y divide-gray-100">
                            ${items.length === 0 ? '<tr><td colspan="5" class="py-4 text-center text-gray-400">No documents expiring soon</td></tr>' : items.map((d, i) => `
                                <tr>
                                    <td class="py-2 text-gray-400">${i + 1}</td>
                                    <td class="py-2 font-medium">${d.first_name || '-'} ${d.last_name || ''}</td>
                                    <td class="py-2 text-gray-600">${d.emp_id || '-'}</td>
                                    <td class="py-2 text-gray-600">${d.document_type || '-'}</td>
                                    <td class="py-2 text-red-600 font-medium">${formatDate(d.expiry_date)}</td>
                                </tr>`).join('')}
                        </tbody>
                    </table>`;
            } else if (type === 'new-this-month') {
                items = employees.filter(e => e.hire_date && e.hire_date.substring(0, 7) === currentMonth);
                title = `New Employees This Month (${items.length})`;
                icon = 'fa-user-plus';
                iconColor = 'text-blue-500';
            }

            if (type !== 'docs-expiring') {
                if (type === 'on-leave' || type === 'absent') {
                    const attMap = window._hrOnLeaveAttMap || {};
                    tableHtml = `
                        <table class="w-full text-sm">
                            <thead class="sticky top-0 bg-gray-100 z-10 border-b border-gray-300 shadow-sm"><tr class="text-xs text-gray-500">
                                <th class="text-left pb-3 pt-3" style="width:40px">#</th>
                                <th class="text-left pb-3 pt-3">Employee</th>
                                <th class="text-left pb-3 pt-3">Emp Code</th>
                                <th class="text-left pb-3 pt-3">Leave Type</th>
                            </tr></thead>
                            <tbody class="divide-y divide-gray-100">
                                ${items.length === 0 ? '<tr><td colspan="4" class="py-4 text-center text-gray-400">None found</td></tr>' : items.map((e, i) => {
                                    const att = attMap[e.id] && attMap[e.id][today];
                                    const leaveLabel = { 'paid-leave': 'Paid Leave', 'medical-leave': 'Medical Leave', 'compassionate-leave': 'Compassionate Leave', 'unpaid-leave': 'Unpaid Leave' }[att?.status] || att?.status || '-';
                                    return `<tr>
                                        <td class="py-2 text-gray-400">${i + 1}</td>
                                        <td class="py-2 font-medium">${e.first_name || '-'} ${e.last_name || ''}</td>
                                        <td class="py-2 text-gray-600">${e.employee_id || '-'}</td>
                                        <td class="py-2"><span class="px-2 py-0.5 text-xs rounded-full bg-orange-100 text-orange-700">${leaveLabel}</span></td>
                                    </tr>`;
                                }).join('')}
                            </tbody>
                        </table>`;
                } else {
                    tableHtml = `
                        <table class="w-full text-sm">
                            <thead class="sticky top-0 bg-gray-100 z-10 border-b border-gray-300 shadow-sm"><tr class="text-xs text-gray-500">
                                <th class="text-left pb-3 pt-3" style="width:40px">#</th>
                                <th class="text-left pb-3 pt-3">Employee</th>
                                <th class="text-left pb-3 pt-3">Emp Code</th>
                                <th class="text-left pb-3 pt-3">Department</th>
                                <th class="text-left pb-3 pt-3">Status</th>
                            </tr></thead>
                            <tbody class="divide-y divide-gray-100">
                                ${items.length === 0 ? '<tr><td colspan="5" class="py-4 text-center text-gray-400">None found</td></tr>' : items.map((e, i) => `
                                    <tr>
                                        <td class="py-2 text-gray-400">${i + 1}</td>
                                        <td class="py-2 font-medium">${e.first_name || '-'} ${e.last_name || ''}</td>
                                        <td class="py-2 text-gray-600">${e.employee_id || '-'}</td>
                                        <td class="py-2 text-gray-600">${e.department || '-'}</td>
                                        <td class="py-2"><span class="px-2 py-0.5 text-xs rounded-full ${e.is_terminated ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}">${e.status || '-'}</span></td>
                                    </tr>`).join('')}
                            </tbody>
                        </table>`;
                }
            }
        }

        let modal = document.getElementById('dashboard-detail-modal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'dashboard-detail-modal';
            modal.className = 'fixed inset-0 z-[9999] flex items-center justify-center p-4';
            modal.innerHTML = `
                <div class="absolute inset-0 bg-black bg-opacity-50" onclick="closeDashboardDetailModal()"></div>
                <div class="relative bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[85vh] flex flex-col">
                    <div class="flex items-center justify-between px-6 py-4 border-b border-gray-200 flex-shrink-0">
                        <h3 id="dashboard-detail-title" class="text-lg font-bold text-gray-800"></h3>
                        <button onclick="closeDashboardDetailModal()" class="text-gray-400 hover:text-gray-600 text-2xl leading-none">&times;</button>
                    </div>
                    <div id="dashboard-detail-body" class="overflow-y-auto flex-1 min-h-0"></div>
                </div>
            `;
            document.body.appendChild(modal);
        }
        document.getElementById('dashboard-detail-title').innerHTML = `<i class="fas ${icon} mr-2 ${iconColor}"></i>${title}`;
        document.getElementById('dashboard-detail-body').innerHTML = `<div class="px-6 pb-6">${tableHtml}</div>`;
        modal.classList.remove('hidden');
        modal.style.display = 'flex';
    } catch (error) {
        console.error('Error loading HR dashboard detail:', error);
    }
}

function showAdminDashboardDetailModal(title, icon, iconColor, contentHtml) {
    let modal = document.getElementById('admin-dashboard-detail-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'admin-dashboard-detail-modal';
        modal.className = 'fixed inset-0 z-[9999] flex items-center justify-center p-4';
        modal.innerHTML = `
            <div class="absolute inset-0 bg-black bg-opacity-50" onclick="closeAdminDashboardDetailModal()"></div>
            <div class="relative bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[85vh] flex flex-col">
                <div class="flex items-center justify-between px-6 py-4 border-b border-gray-200">
                    <h3 id="admin-dashboard-detail-title" class="text-lg font-bold text-gray-800"></h3>
                    <button onclick="closeAdminDashboardDetailModal()" class="text-gray-400 hover:text-gray-600 text-2xl leading-none">&times;</button>
                </div>
                <div id="admin-dashboard-detail-body" class="overflow-y-auto p-6"></div>
            </div>
        `;
        document.body.appendChild(modal);
    }
    document.getElementById('admin-dashboard-detail-title').innerHTML = `<i class="fas ${icon} mr-2 ${iconColor}"></i>${title}`;
    document.getElementById('admin-dashboard-detail-body').innerHTML = contentHtml;
    modal.style.display = 'flex';
}

function closeAdminDashboardDetailModal() {
    const modal = document.getElementById('admin-dashboard-detail-modal');
    if (modal) modal.style.display = 'none';
}

function showEquipmentDashboardDetails(filterStatus = null) {
    const data = window._adminDashboardData || {};
    const equipment = data.equipment || [];

    const statusBadges = {
        'in service': 'bg-green-100 text-green-700',
        'in stores': 'bg-yellow-100 text-yellow-700',
        'under maintenance': 'bg-purple-100 text-purple-700',
        'pending write off': 'bg-orange-100 text-orange-700',
        'written off': 'bg-red-100 text-red-700'
    };

    const normalizeStatus = s => (s || '').toLowerCase();

    const displayEquipment = filterStatus
        ? equipment.filter(eq => normalizeStatus(eq.display_status || eq.status) === normalizeStatus(filterStatus))
        : equipment;

    let rows = '';
    displayEquipment.forEach(eq => {
        const status = eq.display_status || eq.status || 'Unknown';
        const loc = [eq.country_name, eq.location_name, eq.sub_location_name].filter(Boolean).join(' › ');
        const badgeClass = statusBadges[normalizeStatus(status)] || 'bg-gray-100 text-gray-700';
        rows += `<tr>
            <td class="py-2 text-sm">${eq.auto_serial_number || '-'}</td>
            <td class="py-2 font-medium text-sm">${eq.name || '-'}</td>
            <td class="py-2 text-sm text-gray-500">${eq.category || '-'}</td>
            <td class="py-2 text-sm text-gray-500">${loc || '-'}</td>
            <td class="py-2 text-sm"><span class="px-2 py-0.5 text-xs rounded-full ${badgeClass}">${status}</span></td>
        </tr>`;
    });

    const inService = equipment.filter(eq => normalizeStatus(eq.display_status || eq.status) === 'in service').length;
    const inStores = equipment.filter(eq => normalizeStatus(eq.display_status || eq.status) === 'in stores').length;
    const underMaintenance = equipment.filter(eq => normalizeStatus(eq.display_status || eq.status) === 'under maintenance').length;
    const pendingWriteOff = equipment.filter(eq => normalizeStatus(eq.display_status || eq.status) === 'pending write off').length;

    const title = filterStatus
        ? `${filterStatus} Equipment (${displayEquipment.length})`
        : `Equipment Details (${equipment.length})`;

    const contentHtml = `
        <div class="mb-4 flex flex-wrap gap-2 text-sm">
            <span class="px-3 py-1 rounded-full ${filterStatus === 'In Service' ? 'bg-green-200 text-green-800 font-semibold' : 'bg-green-100 text-green-700'}">In Service: ${inService}</span>
            <span class="px-3 py-1 rounded-full ${filterStatus === 'In Stores' ? 'bg-yellow-200 text-yellow-800 font-semibold' : 'bg-yellow-100 text-yellow-700'}">In Stores: ${inStores}</span>
            <span class="px-3 py-1 rounded-full ${filterStatus === 'Under Maintenance' ? 'bg-purple-200 text-purple-800 font-semibold' : 'bg-purple-100 text-purple-700'}">Under Maintenance: ${underMaintenance}</span>
            <span class="px-3 py-1 rounded-full ${filterStatus === 'Pending Write Off' ? 'bg-orange-200 text-orange-800 font-semibold' : 'bg-orange-100 text-orange-700'}">Pending Write Off: ${pendingWriteOff}</span>
        </div>
        <table class="w-full text-sm">
            <thead><tr class="text-xs text-gray-500 border-b">
                <th class="text-left pb-2">Auto Serial</th>
                <th class="text-left pb-2">Name</th>
                <th class="text-left pb-2">Category</th>
                <th class="text-left pb-2">Location</th>
                <th class="text-left pb-2">Status</th>
            </tr></thead>
            <tbody class="divide-y divide-gray-100">${rows}</tbody>
        </table>
    `;

    showAdminDashboardDetailModal(title, 'fa-tools', 'text-blue-600', contentHtml);
}

function showHRDashboardDetails(filterStatus = null) {
    const data = window._adminDashboardData || {};
    const employees = data.employees || [];

    const statusBadges = {
        'active': 'bg-green-100 text-green-700',
        'on leave': 'bg-orange-100 text-orange-700',
        'terminated': 'bg-red-100 text-red-700'
    };

    const normalizeStatus = s => (s || '').toLowerCase();
    const getEmpStatus = emp => emp.status === 'Terminated' || emp.is_terminated === 1 ? 'Terminated' : (emp.status || 'Unknown');

    const displayEmployees = filterStatus
        ? employees.filter(emp => normalizeStatus(getEmpStatus(emp)) === normalizeStatus(filterStatus))
        : employees;

    let rows = '';
    displayEmployees.forEach(emp => {
        const status = getEmpStatus(emp);
        const loc = [emp.country_name, emp.location_name, emp.sub_location_name].filter(Boolean).join(' › ');
        const badgeClass = statusBadges[normalizeStatus(status)] || 'bg-gray-100 text-gray-700';
        const leaveUntilStr = emp.leave_until ? new Date(emp.leave_until + 'T00:00:00').toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '-';
        rows += `<tr>
            <td class="py-2 text-sm">${emp.employee_id || '-'}</td>
            <td class="py-2 font-medium text-sm">${emp.first_name || ''} ${emp.last_name || ''}</td>
            <td class="py-2 text-sm text-gray-500">${emp.position || '-'}</td>
            <td class="py-2 text-sm text-gray-500">${emp.department || '-'}</td>
            <td class="py-2 text-sm text-gray-500">${loc || '-'}</td>
            <td class="py-2 text-sm"><span class="px-2 py-0.5 text-xs rounded-full ${badgeClass}">${status}</span></td>
            ${filterStatus === 'On Leave' ? `<td class="py-2 text-sm text-orange-600 font-medium">${leaveUntilStr}</td>` : ''}
        </tr>`;
    });

    const active = employees.filter(emp => emp.status === 'Active').length;
    const onLeave = employees.filter(emp => emp.status === 'On Leave').length;
    const terminated = employees.filter(emp => emp.status === 'Terminated' || emp.is_terminated === 1).length;

    const title = filterStatus
        ? `${filterStatus} Employees (${displayEmployees.length})`
        : `Employee Details (${employees.length})`;

    const contentHtml = `
        <div class="mb-4 flex flex-wrap gap-2 text-sm">
            <span class="px-3 py-1 rounded-full ${filterStatus === 'Active' ? 'bg-green-200 text-green-800 font-semibold' : 'bg-green-100 text-green-700'}">Active: ${active}</span>
            <span class="px-3 py-1 rounded-full ${filterStatus === 'On Leave' ? 'bg-orange-200 text-orange-800 font-semibold' : 'bg-orange-100 text-orange-700'}">On Leave: ${onLeave}</span>
            <span class="px-3 py-1 rounded-full ${filterStatus === 'Terminated' ? 'bg-red-200 text-red-800 font-semibold' : 'bg-red-100 text-red-700'}">Terminated: ${terminated}</span>
        </div>
        <table class="w-full text-sm">
            <thead><tr class="text-xs text-gray-500 border-b">
                <th class="text-left pb-2">Employee ID</th>
                <th class="text-left pb-2">Name</th>
                <th class="text-left pb-2">Position</th>
                <th class="text-left pb-2">Department</th>
                <th class="text-left pb-2">Location</th>
                <th class="text-left pb-2">Status</th>
                ${filterStatus === 'On Leave' ? '<th class="text-left pb-2">Leave Until</th>' : ''}
            </tr></thead>
            <tbody class="divide-y divide-gray-100">${rows}</tbody>
        </table>
    `;

    showAdminDashboardDetailModal(title, 'fa-users', 'text-indigo-600', contentHtml);
}

function showAuthorizerDashboardDetails(filterStatus = null) {
    const data = window._adminDashboardData || {};
    const requests = data.authorizerRequests || [];

    const statusBadges = {
        'pending': 'bg-yellow-100 text-yellow-700',
        'approved': 'bg-green-100 text-green-700',
        'rejected': 'bg-red-100 text-red-700'
    };

    const normalizeStatus = s => (s || '').toLowerCase();

    const displayRequests = filterStatus
        ? requests.filter(req => normalizeStatus(req.status) === normalizeStatus(filterStatus))
        : requests;

    let rows = '';
    displayRequests.forEach(req => {
        const status = req.status || 'Pending';
        const loc = [req.country_name, req.location_name, req.sub_location_name].filter(Boolean).join(' › ');
        const badgeClass = statusBadges[normalizeStatus(status)] || 'bg-gray-100 text-gray-700';
        rows += `<tr>
            <td class="py-2 font-medium text-sm">${req.equipment_name || '-'}</td>
            <td class="py-2 text-sm">${req.equipment_auto_serial || '-'}</td>
            <td class="py-2 text-sm text-gray-500">${loc || '-'}</td>
            <td class="py-2 text-sm text-gray-500">${formatDate(req.write_off_date)}</td>
            <td class="py-2 text-sm text-gray-500 max-w-xs truncate" title="${req.reason || ''}">${req.reason || '-'}</td>
            <td class="py-2 text-sm text-gray-500">${req.requested_by || '-'}</td>
            <td class="py-2 text-sm"><span class="px-2 py-0.5 text-xs rounded-full ${badgeClass}">${status}</span></td>
        </tr>`;
    });

    const pending = requests.filter(r => r.status === 'Pending').length;
    const approved = requests.filter(r => r.status === 'Approved').length;
    const rejected = requests.filter(r => r.status === 'Rejected').length;

    const title = filterStatus
        ? `${filterStatus} Write-Off Requests (${displayRequests.length})`
        : `Write-Off Requests (${requests.length})`;

    const contentHtml = `
        <div class="mb-4 flex flex-wrap gap-2 text-sm">
            <span class="px-3 py-1 rounded-full ${filterStatus === 'Pending' ? 'bg-yellow-200 text-yellow-800 font-semibold' : 'bg-yellow-100 text-yellow-700'}">Pending: ${pending}</span>
            <span class="px-3 py-1 rounded-full ${filterStatus === 'Approved' ? 'bg-green-200 text-green-800 font-semibold' : 'bg-green-100 text-green-700'}">Approved: ${approved}</span>
            <span class="px-3 py-1 rounded-full ${filterStatus === 'Rejected' ? 'bg-red-200 text-red-800 font-semibold' : 'bg-red-100 text-red-700'}">Rejected: ${rejected}</span>
        </div>
        <table class="w-full text-sm">
            <thead><tr class="text-xs text-gray-500 border-b">
                <th class="text-left pb-2">Equipment</th>
                <th class="text-left pb-2">Auto Serial</th>
                <th class="text-left pb-2">Location</th>
                <th class="text-left pb-2">Write-Off Date</th>
                <th class="text-left pb-2">Reason</th>
                <th class="text-left pb-2">Requested By</th>
                <th class="text-left pb-2">Status</th>
            </tr></thead>
            <tbody class="divide-y divide-gray-100">${rows}</tbody>
        </table>
    `;

    showAdminDashboardDetailModal(title, 'fa-check-circle', 'text-teal-600', contentHtml);
}

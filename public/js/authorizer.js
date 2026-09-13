// Authorizer - Centralized approval requests

function showAuthorizerTab(tab) {
    if (typeof hasTabPermission === 'function' && !hasTabPermission('authorizer', tab, '')) {
        const allowed = typeof getAllowedTabs === 'function' ? getAllowedTabs('authorizer')[0] : null;
        if (allowed && allowed !== tab) { showAuthorizerTab(allowed); }
        return;
    }
    if (typeof setCurrentModuleTabContext === 'function') setCurrentModuleTabContext('authorizer', tab, '');

    document.querySelectorAll('.authorizer-tab').forEach(btn => {
        btn.classList.remove('bg-blue-600', 'text-white');
        btn.classList.add('bg-gray-200', 'text-gray-700');
    });
    const activeBtn = document.querySelector(`.authorizer-tab[data-tab="${tab}"]`);
    if (activeBtn) {
        activeBtn.classList.remove('bg-gray-200', 'text-gray-700');
        activeBtn.classList.add('bg-blue-600', 'text-white');
    }

    document.querySelectorAll('.authorizer-tab-content').forEach(content => content.classList.add('hidden'));
    const activeContent = document.getElementById(`authorizer-${tab}-tab`);
    if (activeContent) {
        activeContent.classList.remove('hidden');
    }

    if (tab === 'equipment') {
        loadAuthorizerEquipmentRequests();
    } else if (tab === 'equipment-returns') {
        loadAuthorizerReturnRequests();
    }
}

let authorizerEquipmentRequests = [];

async function loadAuthorizerEquipmentRequests() {
    showTableLoading('authorizer-equipment-table-body', 'Loading write-off requests...');
    try {
        const response = await fetch(`${API_BASE}/equipment/write-offs`);
        if (!response.ok) {
            console.error('Error loading write-off requests:', response.status, response.statusText);
            authorizerEquipmentRequests = [];
            renderAuthorizerEquipmentRequests([]);
            return;
        }
        authorizerEquipmentRequests = await response.json();
        renderAuthorizerEquipmentRequests(authorizerEquipmentRequests);
    } catch (error) {
        console.error('Error loading write-off requests:', error);
        authorizerEquipmentRequests = [];
        renderAuthorizerEquipmentRequests([]);
    }
}

function renderAuthorizerEquipmentRequests(requests) {
    const tbody = document.getElementById('authorizer-equipment-table-body');
    const countBadge = document.getElementById('authorizer-equipment-count');
    if (!tbody) return;

    const pending = requests.filter(r => r.status === 'Pending');
    if (countBadge) {
        countBadge.textContent = `${pending.length} pending`;
    }

    if (!requests || !Array.isArray(requests) || requests.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" class="px-4 py-4 text-center text-gray-500">No write-off requests found.</td></tr>';
        return;
    }

    const total = requests.length;
    tbody.innerHTML = requests.map((req, index) => {
        const serial = total - index;
        const isPending = req.status === 'Pending';
        return `
        <tr>
            <td class="px-4 py-2 whitespace-nowrap text-gray-500 text-xs">${serial}</td>
            <td class="px-4 py-2 max-w-32 truncate" title="${req.equipment_name || ''}">${req.equipment_name || '-'}</td>
            <td class="px-4 py-2 whitespace-nowrap">${req.equipment_auto_serial || '-'}</td>
            <td class="px-4 py-2 whitespace-nowrap">${formatDate(req.write_off_date)}</td>
            <td class="px-4 py-2 max-w-40 truncate" title="${req.reason || ''}">${req.reason || '-'}</td>
            <td class="px-4 py-2 whitespace-nowrap">${req.requested_by || '-'}</td>
            <td class="px-4 py-2 whitespace-nowrap">
                <span class="px-2 py-1 text-xs rounded-full ${getAuthorizerStatusColor(req.status)}">${req.status || 'Pending'}</span>
            </td>
            <td class="px-4 py-2 whitespace-nowrap">
                <button onclick="viewWriteOffRequest(${req.id})" class="text-blue-600 hover:text-blue-800 mr-2" title="View">
                    <i class="fas fa-eye"></i>
                </button>
                ${isPending ? `
                <button onclick="approveWriteOffRequest(${req.id})" class="text-green-600 hover:text-green-800 mr-2" title="Approve">
                    <i class="fas fa-check"></i>
                </button>
                <button onclick="rejectWriteOffRequest(${req.id})" class="text-red-600 hover:text-red-800" title="Reject">
                    <i class="fas fa-times"></i>
                </button>
                ` : '<span class="text-gray-400 text-xs">-</span>'}
            </td>
        </tr>
        `;
    }).join('');
}

function getAuthorizerStatusColor(status) {
    switch(status) {
        case 'Approved': return 'bg-green-100 text-green-800';
        case 'Rejected': return 'bg-red-100 text-red-800';
        case 'Pending':
        default: return 'bg-yellow-100 text-yellow-800';
    }
}

async function approveWriteOffRequest(id) {
    if (!confirm('Are you sure you want to approve this write-off request?')) return;
    try {
        const response = await fetch(`${API_BASE}/equipment/write-offs/${id}/approve`, {
            method: 'POST'
        });
        if (response.ok) {
            loadAuthorizerEquipmentRequests();
            // Also refresh equipment list if visible
            if (typeof loadEquipment === 'function') loadEquipment();
        } else {
            const err = await response.json();
            console.error('Error approving write-off:', err);
            alert('Error approving write-off: ' + (err.error || response.statusText));
        }
    } catch (error) {
        console.error('Error approving write-off:', error);
        alert('Error approving write-off');
    }
}

async function rejectWriteOffRequest(id) {
    if (!confirm('Are you sure you want to reject this write-off request?')) return;
    try {
        const response = await fetch(`${API_BASE}/equipment/write-offs/${id}/reject`, {
            method: 'POST'
        });
        if (response.ok) {
            loadAuthorizerEquipmentRequests();
        } else {
            const err = await response.json();
            console.error('Error rejecting write-off:', err);
            alert('Error rejecting write-off: ' + (err.error || response.statusText));
        }
    } catch (error) {
        console.error('Error rejecting write-off:', error);
        alert('Error rejecting write-off');
    }
}

function viewWriteOffRequest(id) {
    const req = authorizerEquipmentRequests.find(r => r.id === id);
    if (!req) return;

    // Request fields
    document.getElementById('view-wor-id').textContent = req.id || '-';
    document.getElementById('view-wor-status').innerHTML = `<span class="px-2 py-1 text-xs rounded-full ${getAuthorizerStatusColor(req.status)}">${req.status || 'Pending'}</span>`;
    document.getElementById('view-wor-date').textContent = formatDate(req.write_off_date);
    document.getElementById('view-wor-requested-by').textContent = req.requested_by || '-';
    document.getElementById('view-wor-approved-by').textContent = req.approved_by || '-';
    document.getElementById('view-wor-approval-date').textContent = formatDate(req.approval_date);
    document.getElementById('view-wor-reason').textContent = req.reason || '-';
    document.getElementById('view-wor-notes').textContent = req.notes || '-';

    // Equipment fields
    document.getElementById('view-wor-equipment').textContent = req.equipment_name || '-';
    document.getElementById('view-wor-auto-serial').textContent = req.equipment_auto_serial || '-';
    document.getElementById('view-wor-barcode').textContent = req.equipment_barcode || '-';
    document.getElementById('view-wor-serial-number').textContent = req.equipment_serial_number || '-';
    document.getElementById('view-wor-category').textContent = req.equipment_category || '-';
    document.getElementById('view-wor-brand').textContent = req.equipment_brand || '-';
    document.getElementById('view-wor-model').textContent = req.equipment_model || '-';
    document.getElementById('view-wor-condition').textContent = req.equipment_condition || '-';
    document.getElementById('view-wor-eq-status').textContent = req.equipment_status || '-';
    document.getElementById('view-wor-owner').textContent = req.equipment_owner || '-';
    document.getElementById('view-wor-assigned-to').textContent = req.equipment_assigned_to || '-';
    document.getElementById('view-wor-purchase-date').textContent = req.equipment_purchase_date ? formatDate(req.equipment_purchase_date) : '-';
    document.getElementById('view-wor-purchase-cost').textContent = req.equipment_purchase_cost || '-';
    const locFull = [req.equipment_country, req.equipment_location, req.equipment_sub_location, req.equipment_business_type, req.equipment_business_unit_code].filter(Boolean).join(' - ') || '-';
    document.getElementById('view-wor-location-full').textContent = locFull;

    const photosContainer = document.getElementById('view-wor-photos');
    if (photosContainer) {
        const photos = req.photos || [];
        if (photos.length === 0) {
            photosContainer.innerHTML = '<span class="text-gray-400 text-sm">No photos</span>';
        } else {
            photosContainer.innerHTML = photos.map(p => `
                <a href="${p.photo_path}" target="_blank" class="inline-block">
                    <img src="${p.photo_path}" class="h-24 w-24 object-cover rounded border hover:opacity-80">
                </a>
            `).join('');
        }
    }

    const modal = document.getElementById('view-write-off-request-modal');
    if (modal) modal.classList.add('active');
}

function closeViewWriteOffRequestModal() {
    const modal = document.getElementById('view-write-off-request-modal');
    if (modal) modal.classList.remove('active');
}

// ===== Equipment Return Requests =====

let authorizerReturnRequests = [];

asynshowTableLoading('authorizer-returns-table-body', 'Loading return requests...');
    c function loadAuthorizerReturnRequests() {
    try {
        const response = await fetch(`${API_BASE}/equipment/returns`);
        if (!response.ok) {
            console.error('Error loading return requests:', response.status, response.statusText);
            authorizerReturnRequests = [];
            renderAuthorizerReturnRequests([]);
            return;
        }
        authorizerReturnRequests = await response.json();
        renderAuthorizerReturnRequests(authorizerReturnRequests);
    } catch (error) {
        console.error('Error loading return requests:', error);
        authorizerReturnRequests = [];
        renderAuthorizerReturnRequests([]);
    }
}

function renderAuthorizerReturnRequests(requests) {
    const tbody = document.getElementById('authorizer-returns-table-body');
    const countBadge = document.getElementById('authorizer-returns-count');
    if (!tbody) return;

    const pending = requests.filter(r => r.status === 'Pending');
    if (countBadge) {
        countBadge.textContent = `${pending.length} pending`;
    }

    if (!requests || !Array.isArray(requests) || requests.length === 0) {
        tbody.innerHTML = '<tr><td colspan="9" class="px-4 py-4 text-center text-gray-500">No equipment return requests found.</td></tr>';
        return;
    }

    const total = requests.length;
    tbody.innerHTML = requests.map((req, index) => {
        const serial = total - index;
        const isPending = req.status === 'Pending';
        return `
        <tr>
            <td class="px-4 py-2 whitespace-nowrap text-gray-500 text-xs">${serial}</td>
            <td class="px-4 py-2 max-w-32 truncate" title="${req.equipment_name || ''}">${req.equipment_name || '-'}</td>
            <td class="px-4 py-2 whitespace-nowrap">${req.equipment_auto_serial || '-'}</td>
            <td class="px-4 py-2 whitespace-nowrap">${req.supplier_name || '-'}</td>
            <td class="px-4 py-2 whitespace-nowrap">${formatDate(req.return_date)}</td>
            <td class="px-4 py-2 max-w-40 truncate" title="${req.reason || ''}">${req.reason || '-'}</td>
            <td class="px-4 py-2 whitespace-nowrap">${req.requested_by || '-'}</td>
            <td class="px-4 py-2 whitespace-nowrap">
                <span class="px-2 py-1 text-xs rounded-full ${getAuthorizerStatusColor(req.status)}">${req.status || 'Pending'}</span>
            </td>
            <td class="px-4 py-2 whitespace-nowrap">
                <button onclick="viewReturnRequest(${req.id})" class="text-blue-600 hover:text-blue-800 mr-2" title="View">
                    <i class="fas fa-eye"></i>
                </button>
                ${isPending ? `
                <button onclick="approveReturnRequest(${req.id})" class="text-green-600 hover:text-green-800 mr-2" title="Approve">
                    <i class="fas fa-check"></i>
                </button>
                <button onclick="rejectReturnRequest(${req.id})" class="text-red-600 hover:text-red-800" title="Reject">
                    <i class="fas fa-times"></i>
                </button>
                ` : '<span class="text-gray-400 text-xs">-</span>'}
            </td>
        </tr>
        `;
    }).join('');
}

async function approveReturnRequest(id) {
    if (!confirm('Are you sure you want to approve this equipment return request?')) return;
    try {
        const response = await fetch(`${API_BASE}/equipment/returns/${id}/approve`, {
            method: 'POST'
        });
        if (response.ok) {
            loadAuthorizerReturnRequests();
            if (typeof loadEquipment === 'function') loadEquipment();
        } else {
            const err = await response.json();
            console.error('Error approving return:', err);
            alert('Error approving return: ' + (err.error || response.statusText));
        }
    } catch (error) {
        console.error('Error approving return:', error);
        alert('Error approving return');
    }
}

async function rejectReturnRequest(id) {
    if (!confirm('Are you sure you want to reject this equipment return request?')) return;
    try {
        const response = await fetch(`${API_BASE}/equipment/returns/${id}/reject`, {
            method: 'POST'
        });
        if (response.ok) {
            loadAuthorizerReturnRequests();
        } else {
            const err = await response.json();
            console.error('Error rejecting return:', err);
            alert('Error rejecting return: ' + (err.error || response.statusText));
        }
    } catch (error) {
        console.error('Error rejecting return:', error);
        alert('Error rejecting return');
    }
}

function viewReturnRequest(id) {
    const req = authorizerReturnRequests.find(r => r.id === id);
    if (!req) return;

    document.getElementById('view-rr-id').textContent = req.id || '-';
    document.getElementById('view-rr-status').innerHTML = `<span class="px-2 py-1 text-xs rounded-full ${getAuthorizerStatusColor(req.status)}">${req.status || 'Pending'}</span>`;
    document.getElementById('view-rr-date').textContent = formatDate(req.return_date);
    document.getElementById('view-rr-requested-by').textContent = req.requested_by || '-';
    document.getElementById('view-rr-approved-by').textContent = req.approved_by || '-';
    document.getElementById('view-rr-approval-date').textContent = formatDate(req.approval_date);
    document.getElementById('view-rr-supplier').textContent = req.supplier_name || '-';
    document.getElementById('view-rr-reason').textContent = req.reason || '-';
    document.getElementById('view-rr-notes').textContent = req.notes || '-';

    document.getElementById('view-rr-equipment').textContent = req.equipment_name || '-';
    document.getElementById('view-rr-auto-serial').textContent = req.equipment_auto_serial || '-';
    document.getElementById('view-rr-barcode').textContent = req.equipment_barcode || '-';
    document.getElementById('view-rr-serial-number').textContent = req.equipment_serial_number || '-';
    document.getElementById('view-rr-category').textContent = req.equipment_category || '-';
    document.getElementById('view-rr-brand').textContent = req.equipment_brand || '-';
    document.getElementById('view-rr-model').textContent = req.equipment_model || '-';
    document.getElementById('view-rr-condition').textContent = req.equipment_condition || '-';
    document.getElementById('view-rr-eq-status').textContent = req.equipment_status || '-';
    document.getElementById('view-rr-owner').textContent = req.equipment_owner || '-';
    document.getElementById('view-rr-assigned-to').textContent = req.equipment_assigned_to || '-';
    const locFull = [req.equipment_country, req.equipment_location, req.equipment_sub_location, req.equipment_business_type, req.equipment_business_unit_code].filter(Boolean).join(' - ') || '-';
    document.getElementById('view-rr-location-full').textContent = locFull;

    const modal = document.getElementById('view-return-request-modal');
    if (modal) modal.classList.add('active');
}

function closeViewReturnRequestModal() {
    const modal = document.getElementById('view-return-request-modal');
    if (modal) modal.classList.remove('active');
}

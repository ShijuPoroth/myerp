// Maintenance
let allMaintenanceLogs = [];
let currentMaintenanceLog = null;
let currentMaintenanceParts = [];
let currentMaintenancePhotos = [];
let currentMaintenanceTasks = [];
let currentMaintenancePMType = '';
let currentMaintenancePMSchedule = [];
let maintenancePhotoFiles = [];

function previewMaintenancePhotos(input) {
    const preview = document.getElementById('maintenance-new-photos-preview');
    if (!preview || !input.files) return;
    maintenancePhotoFiles = Array.from(input.files);
    preview.innerHTML = '';
    maintenancePhotoFiles.forEach(file => {
        const reader = new FileReader();
        reader.onload = (e) => {
            preview.innerHTML += `<div class="w-20 h-20"><img src="${e.target.result}" class="w-20 h-20 object-cover rounded border" title="${file.name}"></div>`;
        };
        reader.readAsDataURL(file);
    });
}

async function loadMaintenancePhotosForEdit(logId) {
    const container = document.getElementById('maintenance-existing-photos');
    if (!container) return;
    try {
        const response = await fetch(`${API_BASE}/equipment/maintenance-logs/${logId}/photos`);
        const photos = response.ok ? await response.json() : [];
        if (photos.length === 0) {
            container.innerHTML = '<span class="text-xs text-gray-500">No photos yet</span>';
            return;
        }
        container.innerHTML = photos.map(photo =>
            `<div class="relative group">
                <img src="${photo.photo_path}" class="w-20 h-20 object-cover rounded border cursor-pointer" title="Click to enlarge" onclick="window.open('${photo.photo_path}', '_blank')">
                <button type="button" class="absolute top-0 right-0 bg-red-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition" title="Delete photo" onclick="deleteMaintenancePhoto(${photo.id}, ${logId}, this)">
                    <i class="fas fa-times"></i>
                </button>
            </div>`
        ).join('');
    } catch (error) {
        console.error('Error loading maintenance photos for edit:', error);
        container.innerHTML = '<span class="text-xs text-red-500">Error loading photos</span>';
    }
}

async function deleteMaintenancePhoto(photoId, logId, btn) {
    if (!confirm('Delete this photo?')) return;
    try {
        const response = await fetch(`${API_BASE}/equipment/maintenance-logs/${logId}/photos/${photoId}`, {
            method: 'DELETE'
        });
        if (response.ok) {
            const wrapper = btn.closest('.relative');
            if (wrapper) wrapper.remove();
            const container = document.getElementById('maintenance-existing-photos');
            if (container && container.children.length === 0) {
                container.innerHTML = '<span class="text-xs text-gray-500">No photos yet</span>';
            }
        } else {
            const err = await response.json().catch(() => ({}));
            alert('Failed to delete photo: ' + (err.error || response.statusText));
        }
    } catch (error) {
        alert('Failed to delete photo: ' + (error.message || 'Network error'));
    }
}

async function uploadMaintenancePhotos(logId) {
    if (!maintenancePhotoFiles || maintenancePhotoFiles.length === 0) return;
    const formData = new FormData();
    maintenancePhotoFiles.forEach(file => formData.append('photos', file));
    try {
        const response = await fetch(`${API_BASE}/equipment/maintenance-logs/${logId}/photos`, {
            method: 'POST',
            body: formData
        });
        if (!response.ok) {
            const err = await response.json().catch(() => ({}));
            const errMsg = err.error || response.statusText || 'Unknown error';
            console.error('Error uploading maintenance photos:', errMsg);
            alert('Failed to upload photos: ' + errMsg + '\n\nPossible reasons:\n- File too large (max 15MB per file)\n- File is not an image\n- Server error');
        }
    } catch (error) {
        console.error('Error uploading maintenance photos:', error);
        alert('Failed to upload photos: ' + (error.message || 'Network error'));
    }
    maintenancePhotoFiles = [];
    const preview = document.getElementById('maintenance-new-photos-preview');
    if (preview) preview.innerHTML = '';
    const input = document.getElementById('maintenance-photos');
    if (input) input.value = '';
}

async function loadMaintenance() {
    showTableLoading('maintenance-table-body', 'Loading maintenance logs...');
    try {
const response = await fetch(`${API_BASE}/equipment/maintenance-logs`);
        if (!response.ok) {
            console.error('Error loading maintenance logs:', response.status, response.statusText);
            allMaintenanceLogs = [];
            renderMaintenance([]);
            return;
        }
        const logs = await response.json();
allMaintenanceLogs = logs;
        populateMaintenanceFilters();
        filterMaintenance();
    } catch (error) {
        console.error('Error loading maintenance logs:', error);
        showTableError('maintenance-table-body', 'Error loading maintenance logs.');
        allMaintenanceLogs = [];
        renderMaintenance([]);
    }
}

function renderMaintenance(logs) {
    const tbody = document.getElementById('maintenance-table-body');
if (!tbody) return;
    if (!logs || !Array.isArray(logs)) {
        tbody.innerHTML = '';
        return;
    }
    const total = logs.length;
    tbody.innerHTML = logs.map((log, index) => {
        const serial = total - index;
        const subBusiness = [log.sub_location_name, log.business_type_name, log.business_unit_code].filter(Boolean).join(' - ') || '-';
        return `
        <tr>
            <td class="px-3 py-2 whitespace-nowrap text-gray-500 text-xs">${serial}</td>
            <td class="px-3 py-2 whitespace-nowrap">${log.maintenance_serial_number || '-'}</td>
            <td class="px-3 py-2 whitespace-nowrap">${log.equipment_auto_serial || '-'}</td>
            <td class="px-3 py-2 max-w-32 truncate" title="${log.equipment_name}">${log.equipment_name}</td>
            <td class="px-3 py-2 max-w-32 truncate" title="${log.country_name || ''}">${log.country_name || '-'}</td>
            <td class="px-3 py-2 max-w-32 truncate" title="${log.location_type_name || ''}">${log.location_type_name || '-'}</td>
            <td class="px-3 py-2 max-w-40 truncate" title="${subBusiness}">${subBusiness}</td>
            <td class="px-3 py-2 whitespace-nowrap">
                <span class="px-2 py-1 text-xs rounded-full ${getMaintenanceTypeColor(log.maintenance_type)}">${log.maintenance_type}</span>
            </td>
            <td class="px-3 py-2 whitespace-nowrap">
                <span class="px-2 py-1 text-xs rounded-full ${getMaintenanceStatusColor(log.maintenance_status)}">${log.maintenance_status || 'Pending'}</span>
            </td>
            <td class="px-3 py-2 max-w-32 truncate" title="${log.description}">${log.description}</td>
            <td class="px-3 py-2 whitespace-nowrap">${log.requested_by_name || log.requested_by || '-'}</td>
            <td class="px-3 py-2 whitespace-nowrap">${log.performed_by_name || log.performed_by || '-'}</td>
            <td class="px-3 py-2 whitespace-nowrap">${formatDate(log.performed_date)}</td>
            <td class="px-3 py-2 whitespace-nowrap">
                <button onclick="viewMaintenance(${log.id})" class="text-green-600 hover:text-green-800 mr-2" title="View Details">
                    <i class="fas fa-eye"></i>
                </button>
                ${getEditActionButton('maintenance', 'editMaintenance', log.id)}
                ${getDeleteActionButton('maintenance', 'deleteMaintenance', log.id)}
            </td>
        </tr>
        `;
    }).join('');
}

function getEquipmentStatusTextColor(status) {
    const s = (status || '').toLowerCase();
    if (s.includes('written off') || s.includes('written_off')) return 'text-red-600 font-semibold';
    if (s.includes('under maintenance') || s.includes('under_maintenance')) return 'text-yellow-600 font-semibold';
    if (s.includes('pending return')) return 'text-orange-600 font-semibold';
    if (s.includes('returned')) return 'text-purple-600 font-semibold';
    return '';
}

function getMaintenanceStatusColor(status) {
    switch(status) {
        case 'Completed':
            return 'bg-green-100 text-green-800';
        case 'In Progress':
            return 'bg-blue-100 text-blue-800';
        case 'On Hold':
            return 'bg-yellow-100 text-yellow-800';
        case 'Cancelled':
        case 'Cancelled due to write off':
            return 'bg-red-100 text-red-800';
        case 'Pending Write Off':
            return 'bg-orange-100 text-orange-800';
        case 'Pending':
        default:
            return 'bg-gray-100 text-gray-800';
    }
}

function editMaintenance(id) {
    const log = allMaintenanceLogs.find(l => l.id === id);
    if (log) {
        openMaintenanceModal(log);
    }
}

async function deleteMaintenance(id) {
    if (!currentModuleManager) {
        alert('Please select a module manager.');
        return;
    }
    const log = allMaintenanceLogs.find(l => l.id === id);
    if (confirm(`Are you sure you want to delete this maintenance log?`)) {
        try {
            const response = await fetch(`${API_BASE}/equipment/maintenance-logs/${id}?manager_id=${currentModuleManager.id}`, { method: 'DELETE' });
            if (response.ok) {
                const details = `Equipment: ${log.equipment_name} | Type: ${log.maintenance_type} | Status: ${log.maintenance_status}`;
                await logAudit('DELETE', 'equipment', 'Maintenance Log', id, details);
                loadMaintenance();
            } else {
                const error = await response.json().catch(() => ({ error: 'Unknown error' }));
                alert('Error deleting maintenance log: ' + (error.error || response.statusText));
            }
        } catch (error) {
            console.error('Error deleting maintenance log:', error);
        }
    }
}

async function viewMaintenance(id) {
    const log = allMaintenanceLogs.find(l => l.id === id);
    if (!log) return;
    currentMaintenanceLog = log;
    currentMaintenanceParts = [];
    currentMaintenanceTasks = [];

    const subBusiness = [log.sub_location_name, log.business_type_name, log.business_unit_code].filter(Boolean).join(' - ') || '-';

    document.getElementById('view-maintenance-serial').textContent = log.maintenance_serial_number || '-';
    document.getElementById('view-maintenance-auto-serial').textContent = log.equipment_auto_serial || '-';
    document.getElementById('view-maintenance-equipment').textContent = log.equipment_name || '-';
    document.getElementById('view-maintenance-country').textContent = log.country_name || '-';
    document.getElementById('view-maintenance-location').textContent = log.location_type_name || '-';
    document.getElementById('view-maintenance-subbusiness').textContent = subBusiness;
    document.getElementById('view-maintenance-type').textContent = log.maintenance_type;
    const pmTypeRow = document.getElementById('view-maintenance-pm-type-row');
    const pmTypeLabel = document.getElementById('view-maintenance-pm-type');
    if (log.maintenance_type === 'preventive') {
        pmTypeRow.classList.remove('hidden');
        pmTypeLabel.textContent = 'Loading...';
    } else {
        pmTypeRow.classList.add('hidden');
        pmTypeLabel.textContent = '-';
    }
    currentMaintenancePMType = '';
    document.getElementById('view-maintenance-status').textContent = log.maintenance_status || 'Pending';
    document.getElementById('view-maintenance-cost').textContent = log.cost ? `$${log.cost}` : '-';
    document.getElementById('view-maintenance-requested-by').textContent = log.requested_by_name || log.requested_by || '-';
    document.getElementById('view-maintenance-performed-by').textContent = log.performed_by_name || log.performed_by || '-';
    document.getElementById('view-maintenance-date').textContent = formatDate(log.performed_date);
    document.getElementById('view-maintenance-next-date').textContent = formatDate(log.next_maintenance_date);
    document.getElementById('view-maintenance-description').textContent = log.description || '-';

    const partsBody = document.getElementById('view-maintenance-parts-body');
    partsBody.innerHTML = '<tr><td colspan="6" class="px-4 py-2 text-sm text-gray-500">Loading parts...</td></tr>';

    try {
        const response = await fetch(`${API_BASE}/equipment/maintenance-logs/${id}/parts`);
        if (response.ok) {
            const parts = await response.json();
            currentMaintenanceParts = parts;
            if (parts.length === 0) {
                partsBody.innerHTML = '<tr><td colspan="6" class="px-4 py-2 text-sm text-gray-500">No parts used</td></tr>';
            } else {
                partsBody.innerHTML = parts.map((part, i) => `
                    <tr>
                        <td class="px-4 py-2 text-sm">${i + 1}</td>
                        <td class="px-4 py-2 text-sm">${part.spare_part_auto_serial || '-'}</td>
                        <td class="px-4 py-2 text-sm">${part.spare_part_name || '-'}</td>
                        <td class="px-4 py-2 text-sm">${part.spare_part_serial || '-'}</td>
                        <td class="px-4 py-2 text-sm">${part.quantity_used || 0}</td>
                        <td class="px-4 py-2 text-sm">$${part.cost_at_time || 0}</td>
                    </tr>
                `).join('');
            }
        } else {
            partsBody.innerHTML = '<tr><td colspan="6" class="px-4 py-2 text-sm text-red-500">Error loading parts</td></tr>';
        }
    } catch (error) {
        console.error('Error loading maintenance parts:', error);
        partsBody.innerHTML = '<tr><td colspan="6" class="px-4 py-2 text-sm text-red-500">Error loading parts</td></tr>';
    }

    // Load PM tasks if preventive
    const tasksSection = document.getElementById('view-maintenance-tasks-section');
    const tasksBody = document.getElementById('view-maintenance-tasks-body');
    if (log.maintenance_type === 'preventive') {
        try {
            const tasksResponse = await fetch(`${API_BASE}/equipment/maintenance-logs/${id}/tasks`);
            if (tasksResponse.ok) {
                const tasks = await tasksResponse.json();
                currentMaintenanceTasks = tasks;
                // Fetch PM type from the first saved task's pm_task_id
                if (tasks.length > 0 && tasks[0].pm_task_id) {
                    const equipment = allEquipment.find(eq => eq.id == log.equipment_id);
                    const itemId = equipment ? (equipment.catalog_id || equipment.item_id) : null;
                    if (itemId) {
                        const pmTaskResp = await fetch(`${API_BASE}/pm-tasks?item_id=${itemId}`);
                        if (pmTaskResp.ok) {
                            const allPMTasks = await pmTaskResp.json();
                            const matched = allPMTasks.find(t => t.id === tasks[0].pm_task_id);
                            if (matched) {
                                currentMaintenancePMType = matched.pm_type || '';
                                const pmTypeLabels = { 'daily': 'Daily', 'weekly': 'Weekly', 'monthly': 'Monthly', 'quarterly': 'Quarterly', 'bi-annually': 'Bi-Annually', 'annually': 'Annually' };
                                pmTypeLabel.textContent = pmTypeLabels[matched.pm_type] || matched.pm_type || '-';
                            }
                        }
                    }
                } else {
                    pmTypeLabel.textContent = '-';
                }
                if (tasks.length > 0) {
                    tasksSection.classList.remove('hidden');
                    tasksBody.innerHTML = tasks.map(task => `
                        <tr>
                            <td class="px-4 py-2 text-sm">${task.is_checked ? '<i class="fas fa-check text-green-600"></i>' : '<i class="fas fa-times text-gray-300"></i>'}</td>
                            <td class="px-4 py-2 text-sm">${task.task_text}</td>
                            <td class="px-4 py-2 text-sm">${task.notes || '-'}</td>
                        </tr>
                    `).join('');
                } else {
                    tasksSection.classList.add('hidden');
                }
            } else {
                tasksSection.classList.add('hidden');
            }
        } catch (error) {
            console.error('Error loading maintenance tasks:', error);
            tasksSection.classList.add('hidden');
        }
    } else {
        tasksSection.classList.add('hidden');
    }

    // Fetch and display next PM schedule (all PM types with due dates)
    if (log.maintenance_type === 'preventive') {
        try {
            const pmSchedResponse = await fetch(`${API_BASE}/equipment/${log.equipment_id}/next-pm-schedule?fallback_date=${log.performed_date || ''}`);
            if (pmSchedResponse.ok) {
                const pmSched = await pmSchedResponse.json();
                const pmTypeLabels = { 'daily': 'Daily', 'weekly': 'Weekly', 'monthly': 'Monthly', 'quarterly': 'Quarterly', 'bi-annually': 'Bi-Annually', 'annually': 'Annually' };
                if (pmSched.pm_schedules && pmSched.pm_schedules.length > 0) {
                    currentMaintenancePMSchedule = pmSched.pm_schedules;
                    let nextPmText = pmSched.pm_schedules.map(s => {
                        const label = pmTypeLabels[s.pm_type] || s.pm_type;
                        const dueStr = s.next_due_date ? formatDate(s.next_due_date) : 'N/A';
                        const isNext = s.pm_type === pmSched.next_pm_type;
                        return isNext ? `<strong>${label} — Due: ${dueStr} (Next)</strong>` : `${label} — Due: ${dueStr}`;
                    }).join(' | ');
                    document.getElementById('view-maintenance-next-date').innerHTML = nextPmText;
                }
            }
        } catch (e) {
            console.error('Error fetching PM schedule:', e);
        }
    }

    const photosSection = document.getElementById('view-maintenance-photos-section');
    const photosContainer = document.getElementById('view-maintenance-photos');
    try {
        const photosResponse = await fetch(`${API_BASE}/equipment/maintenance-logs/${id}/photos`);
        const photos = photosResponse.ok ? await photosResponse.json() : [];
        currentMaintenancePhotos = photos;
        if (photos.length > 0) {
            photosSection.classList.remove('hidden');
            photosContainer.innerHTML = photos.map(photo =>
                `<img src="${photo.photo_path}" class="w-32 h-32 object-cover rounded border cursor-pointer" title="Click to enlarge" onclick="window.open('${photo.photo_path}', '_blank')">`
            ).join('');
        } else {
            photosSection.classList.add('hidden');
            photosContainer.innerHTML = '';
        }
    } catch (error) {
        console.error('Error loading maintenance photos:', error);
        photosSection.classList.add('hidden');
        photosContainer.innerHTML = '';
    }

    document.getElementById('view-maintenance-modal').classList.add('active');
}

function closeViewMaintenanceModal() {
    document.getElementById('view-maintenance-modal').classList.remove('active');
}

function printMaintenanceDetails(mode) {
    if (!currentMaintenanceLog) return;
    const log = currentMaintenanceLog;
    const equipment = allEquipment.find(eq => eq.id == log.equipment_id);
    const subBusiness = [log.sub_location_name, log.business_type_name, log.business_unit_code].filter(Boolean).join(' - ') || '-';
    const equipmentName = log.equipment_name || '-';
    const equipmentAutoSerial = log.equipment_auto_serial || '-';

    const partsRows = currentMaintenanceParts.length === 0
        ? '<tr><td colspan="6" style="padding:12px;text-align:center;color:#6b7280;">No parts used</td></tr>'
        : currentMaintenanceParts.map((part, i) => `
            <tr>
                <td style="text-align:center;">${i + 1}</td>
                <td>${part.spare_part_auto_serial || '-'}</td>
                <td>${part.spare_part_name || '-'}</td>
                <td>${part.spare_part_serial || '-'}</td>
                <td style="text-align:center;">${part.quantity_used || 0}</td>
                <td style="text-align:right;">$${parseFloat(part.cost_at_time || 0).toFixed(2)}</td>
            </tr>
        `).join('');

    const tasksSection = currentMaintenanceTasks.length === 0
        ? ''
        : `<div class="section">
            <div class="section-title">PM Tasks Checklist</div>
            <table class="parts">
                <thead>
                    <tr><th style="text-align:center;width:50px;">Done</th><th>Task</th><th>Notes</th></tr>
                </thead>
                <tbody>
                    ${currentMaintenanceTasks.map(task => `
                        <tr>
                            <td style="text-align:center;">${task.is_checked ? '&#10003;' : '&#10007;'}</td>
                            <td>${task.task_text}</td>
                            <td>${task.notes || '-'}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
           </div>`;

    const photoSection = currentMaintenancePhotos.length === 0
        ? ''
        : `<div class="section">
            <div class="section-title">Maintenance Photos</div>
            <div class="photo-grid">
                ${currentMaintenancePhotos.map(photo => `<img src="${window.location.origin}${photo.photo_path}" alt="Maintenance photo">`).join('')}
            </div>
           </div>`;

    const printHtml = `
        <!DOCTYPE html>
        <html>
        <head>
            <title>Maintenance Log - ${log.maintenance_serial_number || ''}</title>
            <link rel="stylesheet" href="${window.location.origin}/css/maintenance-print.css">
        </head>
        <body>
            <div class="page">
                <div class="doc-header">
                    <div class="logo-block">
                        <img src="/company-logo/company-logo.png" alt="Company Logo" onerror="this.style.display='none'; this.nextElementSibling.style.display='block';">
                        <div class="logo-fallback" style="display:none;">[Company Logo]<br><span style="font-size:10px;">Place company-logo.png in public/company-logo/</span></div>
                    </div>
                    <div class="title-block">
                        <h1>Maintenance Log</h1>
                        <p>Equipment Management System</p>
                    </div>
                    <div class="doc-id">
                        <div class="id-label">Log Reference</div>
                        <div class="id-value">${log.maintenance_serial_number || '-'}</div>
                    </div>
                </div>

                <div class="section">
                    <div class="section-title">Equipment Information</div>
                    <div class="details-grid">
                        <div class="detail-row"><span class="label">Maintenance Serial</span><span class="value">${log.maintenance_serial_number || '-'}</span></div>
                        <div class="detail-row"><span class="label">Equipment Auto Serial</span><span class="value">${equipmentAutoSerial}</span></div>
                        <div class="detail-row"><span class="label">Equipment</span><span class="value">${equipmentName}</span></div>
                        <div class="detail-row"><span class="label">Country</span><span class="value">${log.country_name || '-'}</span></div>
                        <div class="detail-row"><span class="label">Location</span><span class="value">${log.location_type_name || '-'}</span></div>
                        <div class="detail-row"><span class="label">Sub / Business</span><span class="value">${subBusiness}</span></div>
                    </div>
                </div>

                <div class="section">
                    <div class="section-title">Maintenance Details</div>
                    <div class="details-grid">
                        <div class="detail-row"><span class="label">Maintenance Type</span><span class="value">${(log.maintenance_type || '-').replace('-', ' ').replace(/\b\w/g, c => c.toUpperCase())}</span></div>
                        ${currentMaintenancePMType ? `<div class="detail-row"><span class="label">PM Type</span><span class="value">${({ 'daily': 'Daily', 'weekly': 'Weekly', 'monthly': 'Monthly', 'quarterly': 'Quarterly', 'bi-annually': 'Bi-Annually', 'annually': 'Annually' })[currentMaintenancePMType] || currentMaintenancePMType}</span></div>` : ''}
                        <div class="detail-row"><span class="label">Status</span><span class="value"><span class="status-badge status-${(log.maintenance_status || 'pending').toLowerCase().replace(/\s+/g, '-')}">${log.maintenance_status || 'Pending'}</span></span></div>
                        <div class="detail-row"><span class="label">Requested By</span><span class="value">${log.requested_by_name || log.requested_by || '-'}</span></div>
                        <div class="detail-row"><span class="label">Performed By</span><span class="value">${log.performed_by_name || log.performed_by || '-'}</span></div>
                        <div class="detail-row"><span class="label">Performed Date</span><span class="value">${formatDate(log.performed_date)}</span></div>
                        <div class="detail-row"><span class="label">Cost</span><span class="value">${log.cost ? `$${parseFloat(log.cost).toFixed(2)}` : '-'}</span></div>
                        <div class="detail-row"><span class="label">Next Maintenance Date</span><span class="value">${formatDate(log.next_maintenance_date)}</span></div>
                    </div>
                </div>

                ${currentMaintenancePMSchedule.length > 0 ? `<div class="section">
                    <div class="section-title">PM Schedule Overview</div>
                    <table class="parts">
                        <thead>
                            <tr><th>PM Type</th><th>Last Done</th><th>Next Due</th><th>Status</th></tr>
                        </thead>
                        <tbody>
                            ${currentMaintenancePMSchedule.map(s => {
                                const pmTypeLabels = { 'daily': 'Daily', 'weekly': 'Weekly', 'monthly': 'Monthly', 'quarterly': 'Quarterly', 'bi-annually': 'Bi-Annually', 'annually': 'Annually' };
                                const label = pmTypeLabels[s.pm_type] || s.pm_type;
                                const lastDone = formatDate(s.last_done_date) || 'Never';
                                const nextDue = formatDate(s.next_due_date) || 'N/A';
                                const isOverdue = s.next_due_date && new Date(s.next_due_date) < new Date();
                                const status = isOverdue ? '<span style="color:#dc2626;font-weight:700;">Overdue</span>' : '<span style="color:#059669;font-weight:600;">Scheduled</span>';
                                return `<tr><td>${label}</td><td>${lastDone}</td><td>${nextDue}</td><td>${status}</td></tr>`;
                            }).join('')}
                        </tbody>
                    </table>
                </div>` : ''}

                <div class="section">
                    <div class="section-title">Description</div>
                    <div class="description-box">${log.description || '-'}</div>
                </div>

                <div class="section">
                    <div class="section-title">Parts Used</div>
                    <table class="parts">
                        <thead>
                            <tr><th>#</th><th>Auto Serial</th><th>Part Name</th><th>Part Serial</th><th>Qty</th><th>Cost</th></tr>
                        </thead>
                        <tbody>${partsRows}</tbody>
                    </table>
                </div>

                ${tasksSection}

                ${photoSection}

                <div class="section signature-section">
                    <div class="signature-grid">
                        <div class="signature-box">
                            <div class="signature-label">Requested By</div>
                            <div class="signature-name">${log.requested_by_name || log.requested_by || ''}</div>
                            <div class="signature-line"></div>
                            <div class="signature-caption">Signature &amp; Date</div>
                        </div>
                        <div class="signature-box">
                            <div class="signature-label">Performed By</div>
                            <div class="signature-name">${log.performed_by_name || log.performed_by || ''}</div>
                            <div class="signature-line"></div>
                            <div class="signature-caption">Signature &amp; Date</div>
                        </div>
                    </div>
                </div>

                <div class="footer">
                    <span>Generated on ${formatDate(new Date())}</span>
                    <span>Maintenance Log Details</span>
                </div>
            </div>
        </body>
        </html>
    `;

    // Print via a hidden iframe inside the app page: the browser's
    // Save-PDF/print preview opens over the app and cancel/save simply
    // returns to the app — no popup window left behind.
    let iframe = document.getElementById('maintenance-print-frame');
    if (iframe) iframe.remove();
    iframe = document.createElement('iframe');
    iframe.id = 'maintenance-print-frame';
    iframe.style.cssText = 'position:absolute;width:0;height:0;border:0;';
    document.body.appendChild(iframe);

    let written = false;
    iframe.onload = function() {
        if (!written) return; // skip the initial about:blank load
        try { iframe.contentWindow.focus(); } catch (e) {}
        iframe.contentWindow.onafterprint = function() { iframe.remove(); };
        iframe.contentWindow.print();
    };

    const doc = iframe.contentWindow.document;
    doc.open();
    doc.write(printHtml);
    doc.close();
    written = true;
}

function openAddMaintenanceForEquipment(equipmentId) {
    openMaintenanceModal(null, equipmentId);
}

function openMissedPMModal(equipmentId) {
    const equipment = allEquipment.find(eq => eq.id == equipmentId);
    if (!equipment) {
        console.warn('Equipment not found for missed PM modal:', equipmentId);
        return;
    }

    const modal = document.getElementById('missed-pm-modal');
    const title = document.getElementById('missed-pm-title');
    const body = document.getElementById('missed-pm-body');
    const addBtn = document.getElementById('missed-pm-add-btn');

    if (!modal || !title || !body || !addBtn) {
        console.error('Missed PM modal elements not found');
        return;
    }

    title.textContent = `Missed PM Schedules: ${equipment.name || 'Equipment'}`;

    const locationText = [equipment.country_name, equipment.location_name, equipment.sub_location_name, equipment.business_type_name].filter(Boolean).join(' - ') || 'N/A';

    let missedHtml = '';
    if (Array.isArray(equipment.missed_pm_dates) && equipment.missed_pm_dates.length > 0) {
        missedHtml = equipment.missed_pm_dates.map(m => {
            const dates = Array.isArray(m.missed_dates) ? m.missed_dates.map(d => `<span class="inline-block">${formatDate(d)}</span>`).join(', ') : '-';
            return `<div class="py-2 border-b border-red-100 last:border-0">
                <div class="font-medium capitalize mb-1">${m.pm_type || 'Unknown'}</div>
                <div class="text-sm text-red-600 flex flex-wrap gap-x-1 gap-y-0.5">${dates}</div>
            </div>`;
        }).join('');
    } else {
        missedHtml = '<p class="text-gray-500 text-center py-2">No missed PM schedules recorded.</p>';
    }

    body.innerHTML = `
        <div class="space-y-4">
            <div class="grid grid-cols-2 gap-4">
                <div><span class="text-gray-500">Auto Serial:</span> <span class="font-medium">${equipment.auto_serial_number || '-'}</span></div>
                <div><span class="text-gray-500">Location:</span> <span class="font-medium">${locationText}</span></div>
                <div><span class="text-gray-500">Next PM Date:</span> <span class="font-medium">${equipment.next_pm_date ? formatDate(equipment.next_pm_date) : '-'}</span></div>
                <div><span class="text-gray-500">Next PM Type:</span> <span class="font-medium capitalize">${equipment.next_pm_type || '-'}</span></div>
            </div>
            <div>
                <h4 class="text-sm font-semibold text-gray-700 mb-2">Missed Schedules</h4>
                <div class="bg-red-50 border border-red-100 rounded-lg p-3">
                    ${missedHtml}
                </div>
            </div>
        </div>
    `;

    addBtn.onclick = function() {
        closeMissedPMModal();
        openAddMaintenanceForEquipment(equipment.id);
    };

    modal.classList.add('active');
}

function closeMissedPMModal() {
    const modal = document.getElementById('missed-pm-modal');
    if (modal) modal.classList.remove('active');
}

async function preselectMaintenanceEquipment(equipmentId) {
    const equipment = allEquipment.find(eq => eq.id == equipmentId);
    if (!equipment) {
        console.warn('Equipment not found for maintenance preselection:', equipmentId);
        return;
    }

    const equipmentSelect = document.getElementById('maintenance-equipment');
    if (!equipmentSelect) return;

    await ensureCascadingLocationData();

    const assignment = window.allBusinessTypeAssignments ? window.allBusinessTypeAssignments.find(a => a.id == equipment.location_id) : null;
    if (!assignment) {
        equipmentSelect.value = equipment.id;
        equipmentSelect.dispatchEvent(new Event('change'));
        return;
    }

    const countrySelect = document.getElementById('maintenance-country');
    const locationSelect = document.getElementById('maintenance-location');
    const sublocationSelect = document.getElementById('maintenance-sublocation');

    if (countrySelect) {
        countrySelect.value = assignment.country_id || '';
        countrySelect.dispatchEvent(new Event('change'));
    }
    if (locationSelect) {
        locationSelect.value = assignment.location_id || '';
        locationSelect.dispatchEvent(new Event('change'));
    }
    if (sublocationSelect) {
        sublocationSelect.value = assignment.id || '';
        sublocationSelect.dispatchEvent(new Event('change'));
    }

    equipmentSelect.value = equipment.id;
    equipmentSelect.dispatchEvent(new Event('change'));

    if (equipment.next_pm_type) {
        const pmTypeSelect = document.getElementById('maintenance-pm-type');
        if (pmTypeSelect) {
            pmTypeSelect.value = equipment.next_pm_type;
            pmTypeSelect.dispatchEvent(new Event('change'));
        }
    }
}

async function openMaintenanceModal(log = null, equipmentId = null) {
const modal = document.getElementById('maintenance-modal');
    if (!modal) {
        console.error('Maintenance modal not found');
        return;
    }

    const titleElement = document.getElementById('maintenance-modal-title');
    const isEdit = !!log;
    if (titleElement) {
        titleElement.textContent = isEdit ? 'Edit Maintenance Log' : 'Add Maintenance Log';
    }

    document.getElementById('maintenance-form').reset();
    document.getElementById('maintenance-id').value = isEdit ? log.id : '';
    document.getElementById('maintenance-date').value = new Date().toISOString().split('T')[0];
    document.getElementById('maintenance-existing-photos').innerHTML = '';
    document.getElementById('maintenance-new-photos-preview').innerHTML = '';
    maintenancePhotoFiles = [];
    populateEmployeeSelects();

    // Fetch next maintenance serial number from server only for new logs
    if (!log) {
        try {
            const response = await fetch(`${API_BASE}/equipment/maintenance-logs/next-serial`);
            if (!response.ok) throw new Error(response.statusText);
            const data = await response.json();
            document.getElementById('maintenance-serial').value = data.next_serial;
        } catch (error) {
            console.error('Error fetching next maintenance serial:', error);
            document.getElementById('maintenance-serial').value = 'MA-001';
        }
    }

    // Add event listener to form if not already added
    const form = document.getElementById('maintenance-form');
    const newForm = form.cloneNode(true);
    form.parentNode.replaceChild(newForm, form);
    newForm.addEventListener('submit', saveMaintenance);

    // Show/hide PM type selector based on default maintenance type
    onMaintenanceTypeChange();

    // Reset parts container for new logs to avoid stale rows from previous edits
    if (!log) {
        await populateMaintenancePartsRows([]);
    }
    
    // Load cascading location data and setup equipment filter
    const equipmentSelect = document.getElementById('maintenance-equipment');

    if (!equipmentSelect) {
        console.error('Equipment select not found in maintenance modal');
        return;
    }

    try {
        await ensureCascadingLocationData();
        populateCascadingCountrySelect('maintenance-country');
        const locationSelect = document.getElementById('maintenance-location');
        const sublocationSelect = document.getElementById('maintenance-sublocation');
        if (locationSelect) locationSelect.innerHTML = '<option value="">Select Location</option>';
        if (sublocationSelect) sublocationSelect.innerHTML = '<option value="">Select Sublocation / Business Type</option>';
        setupMaintenanceLocationFilter(equipmentSelect);
        if (log) {
            await populateMaintenanceEditValues(log);
        } else if (equipmentId) {
            await preselectMaintenanceEquipment(equipmentId);
        }
    } catch (error) {
        console.error('Error loading cascading location data:', error);
    }
    
    modal.classList.add('active');
}

function setupMaintenanceLocationFilter(equipmentSelect) {
    const sublocationSelect = document.getElementById('maintenance-sublocation');
    if (!sublocationSelect) return;

    // Add event listener to filter equipment when sublocation is selected
    // Remove existing listener to avoid duplicates by cloning
    const newSublocationSelect = sublocationSelect.cloneNode(true);
    sublocationSelect.parentNode.replaceChild(newSublocationSelect, sublocationSelect);

    newSublocationSelect.addEventListener('change', function() {
        const selectedLocationId = parseInt(this.value);

        if (selectedLocationId) {
            // Filter equipment by selected sublocation/business type assignment
            const filteredEquipment = allEquipment.filter(eq => eq.location_id == selectedLocationId);
            equipmentSelect.innerHTML = '<option value="">Select Equipment</option>' +
                filteredEquipment.map(eq => `<option value="${eq.id}">${eq.auto_serial_number || 'No Serial'} - ${eq.name}</option>`).join('');
        } else {
            // Show all equipment
            equipmentSelect.innerHTML = '<option value="">Select Equipment</option>' +
                allEquipment.map(eq => `<option value="${eq.id}">${eq.auto_serial_number || 'No Serial'} - ${eq.name}</option>`).join('');
        }
    });

    // Trigger PM tasks reload when equipment changes
    equipmentSelect.addEventListener('change', function() {
        if (document.getElementById('maintenance-type').value === 'preventive' && document.getElementById('maintenance-pm-type').value) {
            loadPMTasksForMaintenance();
        }
    });
}

function onMaintenanceSublocationChange() {
    // Cascading select change handled by setupMaintenanceLocationFilter
}

function onMaintenanceTypeChange() {
    const type = document.getElementById('maintenance-type').value;
    const pmTypeWrapper = document.getElementById('maintenance-pm-type-wrapper');
    const pmTasksSection = document.getElementById('maintenance-pm-tasks-section');
    if (type === 'preventive') {
        pmTypeWrapper.classList.remove('hidden');
        pmTasksSection.classList.remove('hidden');
    } else {
        pmTypeWrapper.classList.add('hidden');
        pmTasksSection.classList.add('hidden');
        document.getElementById('maintenance-pm-type').value = '';
        document.getElementById('maintenance-pm-tasks-container').innerHTML = '<p class="text-sm text-gray-400 text-center py-4">Select equipment and PM type to load tasks</p>';
        document.getElementById('maintenance-next-date').value = '';
    }
}

function calculateNextMaintenanceDate() {
    const pmType = document.getElementById('maintenance-pm-type').value;
    const performedDate = document.getElementById('maintenance-date').value;
    const nextDateField = document.getElementById('maintenance-next-date');

    if (!pmType || !performedDate) {
        nextDateField.value = '';
        return;
    }

    const base = new Date(performedDate);
    if (isNaN(base.getTime())) return;

    const next = new Date(base);
    switch (pmType) {
        case 'daily':
            next.setDate(next.getDate() + 1);
            break;
        case 'weekly':
            next.setDate(next.getDate() + 7);
            break;
        case 'monthly':
            next.setMonth(next.getMonth() + 1);
            break;
        case 'quarterly':
            next.setMonth(next.getMonth() + 3);
            break;
        case 'bi-annually':
            next.setMonth(next.getMonth() + 6);
            break;
        case 'annually':
            next.setFullYear(next.getFullYear() + 1);
            break;
        default:
            nextDateField.value = '';
            return;
    }
    nextDateField.value = next.toISOString().split('T')[0];
}

async function loadPMTasksForMaintenance() {
    const equipmentId = document.getElementById('maintenance-equipment').value;
    const pmType = document.getElementById('maintenance-pm-type').value;
    const container = document.getElementById('maintenance-pm-tasks-container');

    if (!equipmentId || !pmType) {
        container.innerHTML = '<p class="text-sm text-gray-400 text-center py-4">Select equipment and PM type to load tasks</p>';
        return;
    }

    // PM tasks are stored by item_id (catalog_id), not equipment id
    const equipment = allEquipment.find(eq => eq.id == equipmentId);
    const itemId = equipment ? (equipment.catalog_id || equipment.item_id) : null;
    if (!itemId) {
        container.innerHTML = '<p class="text-sm text-gray-400 text-center py-4">No item linked to this equipment</p>';
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/pm-tasks?item_id=${itemId}&pm_type=${pmType}`);
        if (!response.ok) {
            container.innerHTML = '<p class="text-sm text-red-500 text-center py-4">Error loading tasks</p>';
            return;
        }
        const tasks = await response.json();
        if (tasks.length === 0) {
            container.innerHTML = '<p class="text-sm text-gray-400 text-center py-4">No PM tasks found for this equipment and PM type</p>';
            return;
        }
        container.innerHTML = tasks.map((task, i) => `
            <div class="flex items-center gap-3 px-3 py-2 border-b hover:bg-gray-50">
                <input type="checkbox" class="maintenance-pm-task-check h-4 w-4 text-blue-600 rounded" data-pm-task-id="${task.id}" data-task-text="${task.task_text.replace(/"/g, '&quot;')}" ${task._checked ? 'checked' : ''}>
                <span class="text-sm flex-1">${task.task_text}</span>
                <input type="text" class="maintenance-pm-task-notes flex-1 px-2 py-1 border rounded text-sm" placeholder="Notes..." value="${task._notes || ''}">
            </div>
        `).join('');
    } catch (error) {
        console.error('Error loading PM tasks for maintenance:', error);
        container.innerHTML = '<p class="text-sm text-red-500 text-center py-4">Error loading tasks</p>';
    }
}

function getMaintenancePMTasksData() {
    const tasks = [];
    const rows = document.querySelectorAll('#maintenance-pm-tasks-container .maintenance-pm-task-check');
    rows.forEach(check => {
        const row = check.closest('.flex');
        const notesInput = row.querySelector('.maintenance-pm-task-notes');
        tasks.push({
            pm_task_id: parseInt(check.dataset.pmTaskId),
            task_text: check.dataset.taskText,
            is_checked: check.checked,
            notes: notesInput ? notesInput.value : ''
        });
    });
    return tasks;
}

async function populateMaintenanceEditValues(log) {
    const equipment = allEquipment.find(eq => eq.id == log.equipment_id);
    const equipmentSelect = document.getElementById('maintenance-equipment');

    // Set cascading location selects from the equipment's assignment
    if (equipment && equipment.location_id) {
        await setCascadingLocationByAssignment(equipment.location_id, 'maintenance-country', 'maintenance-location', 'maintenance-sublocation');
        // Trigger sublocation change to filter equipment dropdown
        const sublocationSelect = document.getElementById('maintenance-sublocation');
        if (sublocationSelect) sublocationSelect.dispatchEvent(new Event('change'));
    }

    if (equipmentSelect) {
        equipmentSelect.value = log.equipment_id;
    }
    
    document.getElementById('maintenance-serial').value = log.maintenance_serial_number || '';
    document.getElementById('maintenance-type').value = log.maintenance_type;
    onMaintenanceTypeChange();
    document.getElementById('maintenance-status').value = log.maintenance_status || 'Pending';
    document.getElementById('maintenance-description').value = log.description;
    document.getElementById('maintenance-cost').value = log.cost || '';
    document.getElementById('maintenance-requested-by').value = log.requested_by_id || '';
    document.getElementById('maintenance-performed-by').value = log.performed_by_id || '';
    document.getElementById('maintenance-date').value = log.performed_date || '';
    document.getElementById('maintenance-next-date').value = log.next_maintenance_date || '';
    document.getElementById('maintenance-id').value = log.id;

    // Load and populate parts used
    try {
        const response = await fetch(`${API_BASE}/equipment/maintenance-logs/${log.id}/parts`);
        if (response.ok) {
            const parts = await response.json();
            await populateMaintenancePartsRows(parts);
        } else {
            await populateMaintenancePartsRows([]);
        }
    } catch (error) {
        console.error('Error loading maintenance parts for edit:', error);
        await populateMaintenancePartsRows([]);
    }

    // Load existing photos
    loadMaintenancePhotosForEdit(log.id);

    // Load existing PM tasks
    try {
        const tasksResponse = await fetch(`${API_BASE}/equipment/maintenance-logs/${log.id}/tasks`);
        if (tasksResponse.ok) {
            const savedTasks = await tasksResponse.json();
            if (savedTasks.length > 0 && log.maintenance_type === 'preventive') {
                // Set PM type from first task's pm_type (infer from pm_task_id lookup)
                // We need to fetch the PM tasks for this equipment to get pm_type
                const pmTaskResponse = await fetch(`${API_BASE}/pm-tasks?item_id=${equipment ? (equipment.catalog_id || equipment.item_id) : log.equipment_id}`);
                if (pmTaskResponse.ok) {
                    const allPMTasks = await pmTaskResponse.json();
                    const matchedTask = allPMTasks.find(t => t.id === savedTasks[0].pm_task_id);
                    if (matchedTask) {
                        document.getElementById('maintenance-pm-type').value = matchedTask.pm_type || 'monthly';
                    }
                }
                // Now load tasks and mark checked ones
                await loadPMTasksForMaintenance();
                // Apply saved state
                savedTasks.forEach(savedTask => {
                    const checkbox = document.querySelector(`.maintenance-pm-task-check[data-pm-task-id="${savedTask.pm_task_id}"]`);
                    if (checkbox) {
                        checkbox.checked = savedTask.is_checked === 1;
                        const notesInput = checkbox.closest('.flex').querySelector('.maintenance-pm-task-notes');
                        if (notesInput) notesInput.value = savedTask.notes || '';
                    }
                });
            }
        }
    } catch (error) {
        console.error('Error loading maintenance tasks for edit:', error);
    }
}

async function populateMaintenancePartsRows(parts) {
    const container = document.getElementById('maintenance-parts-container');
    if (!container) return;
    
    // Clear container
    container.innerHTML = '';
    
    if (!parts || parts.length === 0) {
        // Add one empty row
        addMaintenancePartRow();
        return;
    }
    
    parts.forEach(part => {
        const newRow = document.createElement('div');
        newRow.className = 'flex gap-2 items-center maintenance-part-row';
        newRow.innerHTML = `
            <div class="maintenance-part-select-wrapper flex-1 relative">
                <button type="button" class="maintenance-part-select-btn w-full flex items-center gap-2 px-3 py-2 border rounded-lg bg-white text-left hover:border-gray-400" onclick="toggleMaintenancePartDropdown(this)">
                    <span class="text-gray-400 text-sm">Select Part</span>
                </button>
                <input type="hidden" class="maintenance-part-select" value="${part.spare_part_id || ''}" data-cost="${part.cost_at_time || 0}" data-quantity="${part.quantity_used || 1}">
                <div class="maintenance-part-dropdown hidden absolute z-50 mt-1 w-full bg-white border rounded-lg shadow-lg max-h-72 overflow-y-auto">
                    <input type="text" class="maintenance-part-search w-full px-3 py-2 border-b text-sm" placeholder="Search parts..." oninput="filterMaintenanceParts(this)">
                    <div class="maintenance-part-options"></div>
                </div>
            </div>
            <input type="number" class="maintenance-part-quantity w-24 px-3 py-2 border rounded-lg" placeholder="Qty" min="1" value="${part.quantity_used || 1}">
            <button type="button" onclick="removeMaintenancePartRow(this)" class="px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700">-</button>
        `;
        container.appendChild(newRow);
    });
    
    // Wait for dropdown options to populate - button text will be set from currentValue
    await populateMaintenancePartsDropdown();
}


function closeMaintenanceModal() {
    const modal = document.getElementById('maintenance-modal');
    if (modal) modal.classList.remove('active');
    const form = document.getElementById('maintenance-form');
    if (form) {
        form.reset();
        const idField = document.getElementById('maintenance-id');
        if (idField) idField.value = '';
    }
}

let _maintenancePartsCache = null;

function populateMaintenancePartsDropdown() {
    return fetch(`${API_BASE}/equipment/spare-parts`)
        .then(response => response.json())
        .then(parts => {
            _maintenancePartsCache = parts;
            const wrappers = document.querySelectorAll('.maintenance-part-select-wrapper');
            wrappers.forEach(wrapper => populateMaintenancePartOptions(wrapper, parts));
            return parts;
        })
        .catch(error => {
            console.error('Error loading spare parts:', error);
            return [];
        });
}

function populateMaintenancePartOptions(wrapper, parts) {
    const optionsContainer = wrapper.querySelector('.maintenance-part-options');
    if (!optionsContainer) return;
    const hiddenInput = wrapper.querySelector('.maintenance-part-select');
    const currentValue = hiddenInput ? hiddenInput.value : '';
    optionsContainer.innerHTML = parts.map(part => {
        const photoHtml = part.photo_path
            ? `<img src="${part.photo_path}" class="w-10 h-10 rounded object-cover flex-shrink-0 border">`
            : `<div class="w-10 h-10 rounded bg-gray-100 flex items-center justify-center flex-shrink-0 border text-gray-400"><i class="fas fa-image text-xs"></i></div>`;
        const partNum = part.part_number || part.spare_part_serial_number || 'No Part #';
        const brand = part.brand ? ` · ${part.brand}` : '';
        const spec = part.specification ? ` · ${part.specification}` : '';
        return `<div class="maintenance-part-option flex items-center gap-2 px-3 py-2 hover:bg-blue-50 cursor-pointer border-b" onclick="selectMaintenancePart(this, ${part.id}, '${part.name.replace(/'/g, "\\'")}', '${partNum.replace(/'/g, "\\'")}', ${part.unit_cost || 0}, ${part.quantity || 0}, '${part.photo_path || ''}')" data-search="${(part.name + ' ' + partNum + ' ' + (part.brand || '') + ' ' + (part.specification || '')).toLowerCase()}">
            ${photoHtml}
            <div class="flex-1 min-w-0">
                <div class="text-sm font-medium text-gray-800 truncate">${part.name}</div>
                <div class="text-xs text-gray-500 truncate">${partNum}${brand}${spec} · Qty: ${part.quantity || 0} · $${part.unit_cost || 0}</div>
            </div>
        </div>`;
    }).join('');
    if (currentValue) {
        const selectedPart = parts.find(p => p.id == currentValue);
        if (selectedPart) {
            const btn = wrapper.querySelector('.maintenance-part-select-btn');
            const photoHtml = selectedPart.photo_path
                ? `<img src="${selectedPart.photo_path}" class="w-6 h-6 rounded object-cover flex-shrink-0">`
                : `<div class="w-6 h-6 rounded bg-gray-100 flex items-center justify-center flex-shrink-0 text-gray-400"><i class="fas fa-image text-xs"></i></div>`;
            btn.innerHTML = `${photoHtml}<span class="text-sm text-gray-800 truncate">${selectedPart.name} (${selectedPart.part_number || selectedPart.spare_part_serial_number || 'No Part #'})</span>`;
        }
    }
}

function toggleMaintenancePartDropdown(btn) {
    const wrapper = btn.closest('.maintenance-part-select-wrapper');
    const dropdown = wrapper.querySelector('.maintenance-part-dropdown');
    const isOpen = !dropdown.classList.contains('hidden');
    document.querySelectorAll('.maintenance-part-dropdown').forEach(d => d.classList.add('hidden'));
    if (!isOpen) {
        dropdown.classList.remove('hidden');
        const searchInput = wrapper.querySelector('.maintenance-part-search');
        if (searchInput) searchInput.focus();
    }
}

function filterMaintenanceParts(input) {
    const query = input.value.toLowerCase();
    const optionsContainer = input.parentElement.querySelector('.maintenance-part-options');
    const options = optionsContainer.querySelectorAll('.maintenance-part-option');
    options.forEach(opt => {
        const searchText = opt.getAttribute('data-search');
        opt.style.display = searchText.includes(query) ? '' : 'none';
    });
}

function selectMaintenancePart(element, partId, partName, partNum, unitCost, availableQty, photoPath) {
    const wrapper = element.closest('.maintenance-part-select-wrapper');
    const hiddenInput = wrapper.querySelector('.maintenance-part-select');
    const btn = wrapper.querySelector('.maintenance-part-select-btn');
    hiddenInput.value = partId;
    hiddenInput.dataset.cost = unitCost;
    hiddenInput.dataset.quantity = availableQty;
    const photoHtml = photoPath
        ? `<img src="${photoPath}" class="w-6 h-6 rounded object-cover flex-shrink-0">`
        : `<div class="w-6 h-6 rounded bg-gray-100 flex items-center justify-center flex-shrink-0 text-gray-400"><i class="fas fa-image text-xs"></i></div>`;
    btn.innerHTML = `${photoHtml}<span class="text-sm text-gray-800 truncate">${partName} (${partNum})</span>`;
    const dropdown = wrapper.querySelector('.maintenance-part-dropdown');
    dropdown.classList.add('hidden');
}

function addMaintenancePartRow() {
    const container = document.getElementById('maintenance-parts-container');
    const newRow = document.createElement('div');
    newRow.className = 'flex gap-2 items-center maintenance-part-row';
    newRow.innerHTML = `
        <div class="maintenance-part-select-wrapper flex-1 relative">
            <button type="button" class="maintenance-part-select-btn w-full flex items-center gap-2 px-3 py-2 border rounded-lg bg-white text-left hover:border-gray-400" onclick="toggleMaintenancePartDropdown(this)">
                <span class="text-gray-400 text-sm">Select Part</span>
            </button>
            <input type="hidden" class="maintenance-part-select" value="">
            <div class="maintenance-part-dropdown hidden absolute z-50 mt-1 w-full bg-white border rounded-lg shadow-lg max-h-72 overflow-y-auto">
                <input type="text" class="maintenance-part-search w-full px-3 py-2 border-b text-sm" placeholder="Search parts..." oninput="filterMaintenanceParts(this)">
                <div class="maintenance-part-options"></div>
            </div>
        </div>
        <input type="number" class="maintenance-part-quantity w-24 px-3 py-2 border rounded-lg" placeholder="Qty" min="1">
        <button type="button" onclick="removeMaintenancePartRow(this)" class="px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700">-</button>
    `;
    container.appendChild(newRow);
    const wrapper = newRow.querySelector('.maintenance-part-select-wrapper');
    if (_maintenancePartsCache) {
        populateMaintenancePartOptions(wrapper, _maintenancePartsCache);
    } else {
        fetch(`${API_BASE}/equipment/spare-parts`)
            .then(response => response.json())
            .then(parts => populateMaintenancePartOptions(wrapper, parts))
            .catch(error => console.error('Error loading spare parts:', error));
    }
}

function removeMaintenancePartRow(button) {
    const row = button.closest('.maintenance-part-row');
    if (document.querySelectorAll('.maintenance-part-row').length > 1) {
        row.remove();
    }
}

function getMaintenancePartsData() {
    const parts = [];
    const rows = document.querySelectorAll('.maintenance-part-row');
    rows.forEach(row => {
        const hiddenInput = row.querySelector('.maintenance-part-select');
        const quantityInput = row.querySelector('.maintenance-part-quantity');
        const partId = hiddenInput.value;
        const quantity = parseInt(quantityInput.value);

        if (partId && quantity > 0) {
            const costAtTime = parseFloat(hiddenInput.dataset.cost) || 0;
            parts.push({
                spare_part_id: parseInt(partId),
                quantity_used: quantity,
                cost_at_time: costAtTime
            });
        }
    });
    return parts;
}

async function saveMaintenance(e) {
    e.preventDefault();

    // Disable submit button to prevent duplicate submissions
    const submitBtn = e.target.querySelector('button[type="submit"]');
    const originalText = submitBtn.textContent;
    submitBtn.disabled = true;
    submitBtn.textContent = 'Saving...';

    const titleElement = document.getElementById('maintenance-modal-title');
    const isAddMode = !titleElement || titleElement.textContent.trim() === 'Add Maintenance Log';
    const id = isAddMode ? '' : document.getElementById('maintenance-id').value;
    const equipmentId = document.getElementById('maintenance-equipment').value;
    const equipment = allEquipment.find(eq => eq.id == equipmentId);
    const maintenanceType = document.getElementById('maintenance-type').value;
    const partsData = getMaintenancePartsData();

    // Calculate total cost from parts
    let partsCost = 0;
    partsData.forEach(part => {
        partsCost += part.quantity_used * part.cost_at_time;
    });

    const requestedBySelect = document.getElementById('maintenance-requested-by');
    const performedBySelect = document.getElementById('maintenance-performed-by');
    const requestedById = requestedBySelect.value;
    const requestedByName = requestedBySelect.selectedOptions[0]?.text || '';
    const performedById = performedBySelect.value;
    const performedByName = performedBySelect.selectedOptions[0]?.text || '';

    const data = {
        maintenance_serial_number: document.getElementById('maintenance-serial').value,
        equipment_id: equipmentId,
        maintenance_type: maintenanceType,
        maintenance_status: document.getElementById('maintenance-status').value,
        description: document.getElementById('maintenance-description').value,
        cost: document.getElementById('maintenance-cost').value || partsCost,
        requested_by_id: requestedById,
        requested_by: requestedByName,
        performed_by_id: performedById,
        performed_by: performedByName,
        performed_date: document.getElementById('maintenance-date').value,
        next_maintenance_date: document.getElementById('maintenance-next-date').value,
        parts: partsData,
        pm_tasks: getMaintenancePMTasksData()
    };

    try {
        const url = id ? `${API_BASE}/equipment/maintenance-logs/${id}?manager_id=${currentModuleManager ? currentModuleManager.id : ''}` : `${API_BASE}/equipment/maintenance-logs`;
        const method = id ? 'PUT' : 'POST';

        const response = await fetch(url, {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });

        if (response.ok) {
            const result = await response.json();
            const savedId = id || result.id;
            if (savedId) {
                await uploadMaintenancePhotos(savedId);
                // Save PM tasks if any
                const pmTasks = getMaintenancePMTasksData();
                if (pmTasks.length > 0) {
                    await fetch(`${API_BASE}/equipment/maintenance-logs/${savedId}/tasks`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ tasks: pmTasks })
                    });
                }
            }

            const equipmentSelect = document.getElementById('maintenance-equipment');
            const equipmentName = equipmentSelect.options[equipmentSelect.selectedIndex]?.text || document.getElementById('maintenance-equipment').value;
            const maintenanceDate = document.getElementById('maintenance-date').value;
            const cost = data.cost;
            const requestedByName = requestedBySelect.selectedOptions[0]?.text || '';
            const performedByName = performedBySelect.selectedOptions[0]?.text || '';
            const description = document.getElementById('maintenance-description').value;

            let details = `Equipment: ${equipmentName} | Type: ${maintenanceType}`;
            if (maintenanceDate) details += ` | Date: ${maintenanceDate}`;
            if (cost) details += ` | Cost: ${cost}`;
            if (requestedByName) details += ` | Requested By: ${requestedByName}`;
            if (performedByName) details += ` | Performed By: ${performedByName}`;
            if (description) details += ` | Description: ${description}`;
            if (partsData.length > 0) {
                details += ` | Parts Used: ${partsData.length}`;
            }

            const action = id ? 'UPDATE' : 'CREATE';
            await logAudit(action, 'equipment', 'Maintenance Log', savedId, details);
            alert('Maintenance log saved successfully!');
            closeMaintenanceModal();
            loadMaintenance();
        } else {
            const error = await response.json();
            alert('Error saving maintenance log: ' + (error.error || 'Unknown error'));
        }
    } catch (error) {
        console.error('Error saving maintenance log:', error);
        alert('Error saving maintenance log: ' + error.message);
    } finally {
        // Re-enable submit button
        submitBtn.disabled = false;
        submitBtn.textContent = originalText;
    }
}

function filterMaintenance() {
    highlightMaintenanceFilters();
    const searchText = document.getElementById('maintenance-search').value.toLowerCase();
    const equipmentId = document.getElementById('maintenance-filter-equipment').value;
    const maintenanceType = document.getElementById('maintenance-filter-type').value;
    const country = document.getElementById('maintenance-filter-country')?.value || '';
    const location = document.getElementById('maintenance-filter-location')?.value || '';
    const selectedSublocationIds = getSelectedMaintenanceSublocationIds();
    const owner = document.getElementById('maintenance-filter-owner')?.value || '';

    let filtered = allMaintenanceLogs;

    if (country) {
        filtered = filtered.filter(log => log.country_name === country);
    }
    if (location) {
        filtered = filtered.filter(log => log.location_type_name === location);
    }
    if (selectedSublocationIds.length > 0) {
        filtered = filtered.filter(log => {
            const subBiz = [log.sub_location_name, log.business_type_name, log.business_unit_code].filter(Boolean).join(' - ');
            return selectedSublocationIds.includes(subBiz);
        });
    }

    if (owner) {
        filtered = filtered.filter(log => log.owner_name === owner);
    }

    if (equipmentId) {
        filtered = filtered.filter(log => log.equipment_id == equipmentId);
    }

    if (maintenanceType) {
        filtered = filtered.filter(log => log.maintenance_type == maintenanceType);
    }

    if (searchText) {
        filtered = filtered.filter(log => {
            const subBusinessText = [log.sub_location_name, log.business_type_name, log.business_unit_code].filter(Boolean).join(' ').toLowerCase();
            return (log.equipment_name && log.equipment_name.toLowerCase().includes(searchText)) ||
                (log.equipment_auto_serial && log.equipment_auto_serial.toLowerCase().includes(searchText)) ||
                (log.maintenance_serial_number && log.maintenance_serial_number.toLowerCase().includes(searchText)) ||
                (log.description && log.description.toLowerCase().includes(searchText)) ||
                (log.performed_by_name && log.performed_by_name.toLowerCase().includes(searchText)) ||
                (log.performed_by && log.performed_by.toLowerCase().includes(searchText)) ||
                (log.country_name && log.country_name.toLowerCase().includes(searchText)) ||
                (log.location_type_name && log.location_type_name.toLowerCase().includes(searchText)) ||
                (subBusinessText && subBusinessText.includes(searchText));
        });
    }

    renderMaintenance(filtered);
}

function populateMaintenanceFilters() {
    if (!allMaintenanceLogs || allMaintenanceLogs.length === 0) return;

    const countrySelect = document.getElementById('maintenance-filter-country');
    if (countrySelect) {
        const uniqueCountries = [...new Set(allMaintenanceLogs.map(log => log.country_name).filter(c => c))].sort();
        countrySelect.innerHTML = '<option value="">All Countries</option>' +
            uniqueCountries.map(c => `<option value="${c}">${c}</option>`).join('');
    }

    const locationSelect = document.getElementById('maintenance-filter-location');
    if (locationSelect) {
        locationSelect.innerHTML = '<option value="">All Locations</option>';
    }

    const checkboxList = document.getElementById('maintenance-sublocation-checkbox-list');
    if (checkboxList) checkboxList.innerHTML = '';
    const checkAll = document.getElementById('maintenance-sublocation-check-all');
    if (checkAll) checkAll.checked = true;
    const label = document.getElementById('maintenance-filter-sublocation-label');
    if (label) label.textContent = 'All Sublocations / Business Types';

    const ownerSelect = document.getElementById('maintenance-filter-owner');
    if (ownerSelect) {
        const uniqueOwners = [...new Set(allMaintenanceLogs.map(log => log.owner_name).filter(o => o))].sort();
        ownerSelect.innerHTML = '<option value="">All Owners</option>' +
            uniqueOwners.map(o => `<option value="${o}">${o}</option>`).join('');
    }

    updateMaintenanceEquipmentFilter();
}

function onMaintenanceFilterCountryChange() {
    const country = document.getElementById('maintenance-filter-country').value;
    const locationSelect = document.getElementById('maintenance-filter-location');

    if (country && allMaintenanceLogs && allMaintenanceLogs.length) {
        const locationNames = [...new Set(allMaintenanceLogs
            .filter(log => log.country_name === country)
            .map(log => log.location_type_name)
            .filter(loc => loc))].sort();
        locationSelect.innerHTML = '<option value="">All Locations</option>' +
            locationNames.map(loc => `<option value="${loc}">${loc}</option>`).join('');
    } else {
        locationSelect.innerHTML = '<option value="">All Locations</option>';
    }

    const checkboxList = document.getElementById('maintenance-sublocation-checkbox-list');
    if (checkboxList) checkboxList.innerHTML = '';
    const checkAll = document.getElementById('maintenance-sublocation-check-all');
    if (checkAll) checkAll.checked = true;
    const label = document.getElementById('maintenance-filter-sublocation-label');
    if (label) label.textContent = 'All Sublocations / Business Types';

    updateMaintenanceEquipmentFilter();
    filterMaintenance();
}

function onMaintenanceFilterLocationChange() {
    const country = document.getElementById('maintenance-filter-country').value;
    const location = document.getElementById('maintenance-filter-location').value;

    if (country && location && allMaintenanceLogs && allMaintenanceLogs.length) {
        const subBizOptions = [...new Set(allMaintenanceLogs
            .filter(log => log.country_name === country && log.location_type_name === location)
            .map(log => [log.sub_location_name, log.business_type_name, log.business_unit_code].filter(Boolean).join(' - '))
            .filter(s => s))].sort();

        const checkboxList = document.getElementById('maintenance-sublocation-checkbox-list');
        if (checkboxList) {
            checkboxList.innerHTML = subBizOptions.map((sub, i) => `
                <label class="flex items-center px-3 py-2 hover:bg-gray-50 border-b text-sm cursor-pointer">
                    <input type="checkbox" class="maintenance-sublocation-checkbox mr-2" value="${sub.replace(/"/g, '&quot;')}" onchange="onMaintenanceSublocationCheckboxChange()"> <span>${sub}</span>
                </label>
            `).join('');
        }
    } else {
        const checkboxList = document.getElementById('maintenance-sublocation-checkbox-list');
        if (checkboxList) checkboxList.innerHTML = '';
    }

    const checkAll = document.getElementById('maintenance-sublocation-check-all');
    if (checkAll) checkAll.checked = true;
    const label = document.getElementById('maintenance-filter-sublocation-label');
    if (label) label.textContent = 'All Sublocations / Business Types';

    updateMaintenanceEquipmentFilter();
    filterMaintenance();
}

function updateMaintenanceEquipmentFilter() {
    const country = document.getElementById('maintenance-filter-country')?.value || '';
    const location = document.getElementById('maintenance-filter-location')?.value || '';
    const selectedSublocationIds = getSelectedMaintenanceSublocationIds();

    const eqSelect = document.getElementById('maintenance-filter-equipment');
    if (eqSelect) {
        // Only populate equipment if at least one location filter is selected
        if (!country && !location && selectedSublocationIds.length === 0) {
            eqSelect.innerHTML = '<option value="">All Equipment</option>';
            return;
        }

        let filtered = allMaintenanceLogs;
        if (country) filtered = filtered.filter(log => log.country_name === country);
        if (location) filtered = filtered.filter(log => log.location_type_name === location);
        if (selectedSublocationIds.length > 0) {
            filtered = filtered.filter(log => {
                const subBiz = [log.sub_location_name, log.business_type_name, log.business_unit_code].filter(Boolean).join(' - ');
                return selectedSublocationIds.includes(subBiz);
            });
        }

        const uniqueEquipment = [...new Map(filtered.map(log => [log.equipment_id, log])).values()]
            .filter(log => log.equipment_id)
            .sort((a, b) => (a.equipment_auto_serial || '').localeCompare(b.equipment_auto_serial || ''));
        eqSelect.innerHTML = '<option value="">All Equipment</option>' +
            uniqueEquipment.map(log => `<option value="${log.equipment_id}">${log.equipment_auto_serial || 'No Serial'} - ${log.equipment_name}</option>`).join('');
    }
}

function toggleMaintenanceSublocationCheckboxDropdown() {
    const dropdown = document.getElementById('maintenance-filter-sublocation-dropdown');
    if (dropdown) dropdown.classList.toggle('hidden');
}

function filterMaintenanceSublocationCheckboxes() {
    const search = (document.getElementById('maintenance-sublocation-search')?.value || '').toLowerCase();
    const labels = document.querySelectorAll('#maintenance-sublocation-checkbox-list label');
    labels.forEach(label => {
        const text = label.textContent.trim().toLowerCase();
        label.style.display = text.includes(search) ? '' : 'none';
    });
}

function onMaintenanceSublocationCheckAllChange() {
    const checkAll = document.getElementById('maintenance-sublocation-check-all');
    const checkboxes = document.querySelectorAll('.maintenance-sublocation-checkbox');
    checkboxes.forEach(cb => cb.checked = checkAll.checked);
    updateMaintenanceSublocationFilterLabel();
    updateMaintenanceEquipmentFilter();
    filterMaintenance();
}

function onMaintenanceSublocationCheckboxChange() {
    const checkboxes = document.querySelectorAll('.maintenance-sublocation-checkbox');
    const checkedCount = Array.from(checkboxes).filter(cb => cb.checked).length;
    const checkAll = document.getElementById('maintenance-sublocation-check-all');
    if (checkAll) checkAll.checked = checkboxes.length > 0 && checkedCount === checkboxes.length;
    updateMaintenanceSublocationFilterLabel();
    updateMaintenanceEquipmentFilter();
    filterMaintenance();
}

function updateMaintenanceSublocationFilterLabel() {
    const label = document.getElementById('maintenance-filter-sublocation-label');
    if (!label) return;
    const checkboxes = document.querySelectorAll('.maintenance-sublocation-checkbox');
    const checked = Array.from(checkboxes).filter(cb => cb.checked);
    if (checked.length === 0 || checked.length === checkboxes.length) {
        label.textContent = 'All Sublocations / Business Types';
    } else if (checked.length === 1) {
        label.textContent = checked[0].nextElementSibling.textContent.trim();
    } else {
        label.textContent = checked.length + ' selected';
    }
}

function getSelectedMaintenanceSublocationIds() {
    const checkboxes = document.querySelectorAll('.maintenance-sublocation-checkbox');
    const allChecked = document.getElementById('maintenance-sublocation-check-all');
    if (allChecked && allChecked.checked) return [];
    return Array.from(checkboxes).filter(cb => cb.checked).map(cb => cb.value);
}

// Close maintenance sublocation dropdown when clicking outside
document.addEventListener('click', function(event) {
    const btn = document.getElementById('maintenance-filter-sublocation-btn');
    const dropdown = document.getElementById('maintenance-filter-sublocation-dropdown');
    if (btn && dropdown && !btn.contains(event.target) && !dropdown.contains(event.target)) {
        dropdown.classList.add('hidden');
    }
});

function highlightMaintenanceFilters() {
    highlightFilters([
        'maintenance-search',
        'maintenance-filter-type',
        'maintenance-filter-country',
        'maintenance-filter-location',
        'maintenance-filter-equipment',
        'maintenance-filter-owner'
    ], 'maintenance-filter-sublocation-btn', 'maintenance-sublocation-checkbox', 'maintenance-sublocation-check-all');
}

function clearMaintenanceFilters() {
    clearAllFilters([
        'maintenance-search',
        'maintenance-filter-type',
        'maintenance-filter-country',
        'maintenance-filter-location',
        'maintenance-filter-equipment',
        'maintenance-filter-owner'
    ], 'maintenance-sublocation-checkbox', 'maintenance-sublocation-check-all', 'maintenance-filter-sublocation-label', 'maintenance-sublocation-checkbox-list', filterMaintenance);
}

document.addEventListener('click', function(e) {
    if (!e.target.closest('.maintenance-part-select-wrapper')) {
        document.querySelectorAll('.maintenance-part-dropdown').forEach(d => d.classList.add('hidden'));
    }
});

// Navigation logic

function showSection(section) {
    // Hide all sections by explicit IDs
    var sectionIds = ['dashboard', 'equipment-dashboard', 'hr-dashboard', 'equipment', 'hr', 'admin', 'audit', 'authorizer', 'catering', 'warehouse'];
    sectionIds.forEach(function(id) {
        var s = document.getElementById(id + '-section');
        if (s) s.style.display = 'none';
    });

    // Show selected section — use flex so column layout is preserved
    var el = document.getElementById(section + '-section');
    if (el) {
        const flexSections = ['hr', 'admin', 'equipment', 'catering', 'warehouse'];
        el.style.display = flexSections.includes(section) ? 'flex' : 'block';
    }
    
    // Update sidebar
    document.querySelectorAll('.sidebar-item').forEach(item => item.classList.remove('active'));
    const activeSidebarItem = document.querySelector(`.sidebar-item[data-section="${section}"]`);
    if (activeSidebarItem) activeSidebarItem.classList.add('active');

    // Update page title
    const titles = {
        dashboard: 'Dashboard',
        'equipment-dashboard': 'Dashboard',
        'hr-dashboard': 'Dashboard',
        equipment: 'Equipment Management',
        hr: 'HR Management',
        audit: 'Audit Log',
        admin: 'Admin Settings',
        authorizer: 'Authorizer',
        catering: 'Catering Management',
        warehouse: 'Warehouse Management'
    };
    document.getElementById('page-title').textContent = titles[section];

    // Load data for section
    if (section === 'dashboard') {
        loadDashboardStats();
    } else if (section === 'equipment-dashboard') {
        loadModuleDashboard('equipment');
    } else if (section === 'hr-dashboard') {
        loadModuleDashboard('hr');
    } else if (section === 'equipment') {
        loadEquipmentDropdowns();
        loadEquipment();
        loadTransfers();
        loadMaintenance();
        showEquipmentSubTab('equipment');
        setTimeout(adjustTableContainerHeights, 150);
    } else if (section === 'hr') {
        document.querySelectorAll('.hr-tab-content').forEach(function(c) { c.style.display = 'none'; });
        var hrtEl = document.getElementById('hr-employee-management-tab');
        if (hrtEl) hrtEl.style.display = 'flex';
        document.querySelectorAll('.employee-management-tab-content').forEach(function(c) { c.style.display = 'none'; });
        var emtEl = document.getElementById('employee-management-add-employee-tab');
        if (emtEl) emtEl.style.display = 'flex';
        // Reset HR tab buttons
        document.querySelectorAll('.hr-tab').forEach(function(btn) { btn.classList.remove('bg-blue-600', 'text-white'); btn.classList.add('bg-gray-200', 'text-gray-700'); });
        var hrEmpBtn = document.querySelector('.hr-tab[data-tab="employee-management"]');
        if (hrEmpBtn) { hrEmpBtn.classList.remove('bg-gray-200', 'text-gray-700'); hrEmpBtn.classList.add('bg-blue-600', 'text-white'); }
        // Reset employee management sub-tab buttons
        document.querySelectorAll('.employee-management-tab').forEach(function(btn) { btn.classList.remove('bg-blue-600', 'text-white'); btn.classList.add('bg-gray-200', 'text-gray-700'); });
        var addEmpBtn = document.querySelector('.employee-management-tab[data-tab="add-employee"]');
        if (addEmpBtn) { addEmpBtn.classList.remove('bg-gray-200', 'text-gray-700'); addEmpBtn.classList.add('bg-blue-600', 'text-white'); }
        // Set tab context so hasTablePermission checks the correct tab/subtab permissions
        if (typeof setCurrentModuleTabContext === 'function') {
            setCurrentModuleTabContext('hr', 'employee-management', 'add-employee');
        }
        loadEmployees();
        loadUniformItems();
        setTimeout(adjustTableContainerHeights, 150);
    } else if (section === 'catering') {
        showCateringSubTab('recipes');
        loadCateringData();
        if (typeof updateTransferNotificationBadge === 'function') updateTransferNotificationBadge();
        setTimeout(adjustTableContainerHeights, 150);
    } else if (section === 'warehouse') {
        showWarehouseSubTab('items');
        loadWarehouseData();
        setTimeout(adjustTableContainerHeights, 150);
    } else if (section === 'audit') {
        loadAuditLogs();
    } else if (section === 'admin') {
        showAdminTab('contacts-settings');
    } else if (section === 'authorizer') {
        showAuthorizerTab('equipment');
        loadAuthorizerEquipmentRequests();
    }
    if (typeof applyTabPermissionVisibility === 'function') applyTabPermissionVisibility();
    if (typeof applyDataPermissionVisibility === 'function') applyDataPermissionVisibility();
}

// Equipment Sub Tab Switching (Equipment, Transfers, Maintenance)
function showEquipmentSubTab(tab) {
    if (typeof hasTabPermission === 'function' && !hasTabPermission('equipment', tab, '')) {
        const allowed = typeof getAllowedTabs === 'function' ? getAllowedTabs('equipment')[0] : null;
        if (allowed && allowed !== tab) { showEquipmentSubTab(allowed); }
        return;
    }
    if (typeof setCurrentModuleTabContext === 'function') setCurrentModuleTabContext('equipment', tab, '');
    const subTabBtns = document.querySelectorAll('.equipment-sub-tab');
    if (subTabBtns.length === 0) {
        return;
    }

    subTabBtns.forEach(btn => {
        btn.classList.remove('bg-blue-600', 'text-white');
        btn.classList.add('bg-gray-200', 'text-gray-700');
    });

    const activeBtn = document.querySelector(`.equipment-sub-tab[data-tab="${tab}"]`);
    if (activeBtn) {
        activeBtn.classList.remove('bg-gray-200', 'text-gray-700');
        activeBtn.classList.add('bg-blue-600', 'text-white');
    }

    const subTabContents = document.querySelectorAll('.equipment-sub-tab-content');
    subTabContents.forEach(content => {
        content.classList.add('hidden');
        content.style.display = '';
    });

    const activeContent = document.getElementById(`equipment-${tab}-tab`);
    if (activeContent) {
        activeContent.classList.remove('hidden');
        activeContent.style.display = 'flex';
        activeContent.style.setProperty('visibility', 'visible', 'important');
        activeContent.style.setProperty('opacity', '1', 'important');
        activeContent.scrollIntoView({ behavior: 'auto', block: 'start' });
        activeContent.querySelectorAll('.table-scroll-container').forEach(el => { el.scrollLeft = 0; });
        const main = document.querySelector('.app-main');
        if (main) main.scrollLeft = 0;
        setTimeout(adjustTableContainerHeights, 50);
    }

    // Load data based on sub-tab
    if (tab === 'equipment') {
        loadEquipment();
    } else if (tab === 'transfers') {
        loadTransfers();
    } else if (tab === 'maintenance') {
        loadMaintenance();
    } else if (tab === 'spare-parts') {
        loadSpareParts();
    } else if (tab === 'write-offs') {
        loadWriteOffs();
    } else if (tab === 'returns') {
        loadEquipmentReturns();
    }
}

// Equipment Tab Switching (legacy, kept for compatibility)
function showEquipmentTab(tab) {
    showEquipmentMainTab(tab);
}

// Admin Tab Switching
function showAdminTab(tab) {
    if (typeof hasTabPermission === 'function' && !hasTabPermission('admin', tab, '')) {
        const allowed = typeof getAllowedTabs === 'function' ? getAllowedTabs('admin')[0] : null;
        if (allowed && allowed !== tab) { showAdminTab(allowed); }
        return;
    }
    if (typeof setCurrentModuleTabContext === 'function') setCurrentModuleTabContext('admin', tab, '');
    document.querySelectorAll('.admin-tab').forEach(btn => {
        btn.classList.remove('bg-blue-600', 'text-white');
        btn.classList.add('bg-gray-200', 'text-gray-700');
    });
    document.querySelector(`.admin-tab[data-tab="${tab}"]`).classList.remove('bg-gray-200', 'text-gray-700');
    document.querySelector(`.admin-tab[data-tab="${tab}"]`).classList.add('bg-blue-600', 'text-white');
    
    document.querySelectorAll('.admin-tab-content').forEach(content => { content.classList.add('hidden'); content.style.display = 'none'; });
    const targetContent = document.getElementById(`admin-${tab}-tab`);
    targetContent.classList.remove('hidden');
    const flexTabs = ['contacts-settings', 'location-settings', 'equipment-settings', 'warehouse-settings', 'supplier-settings', 'hr-settings'];
    targetContent.style.display = flexTabs.includes(tab) ? 'flex' : 'block';
    
    // Load data for the selected tab
    switch(tab) {
        case 'contacts-settings':
            loadContactCategories();
            loadContactStatuses();
            loadContactStatusAssignments();
            break;
        case 'location-settings':
            loadCountries();
            loadLocationTypes();
            loadSubLocationTypes();
            loadBusinessTypes();
            break;
        case 'equipment-settings':
            loadEquipmentStatuses();
            break;
        case 'warehouse-settings':
            loadItemCategories();
            loadItemSubcategories();
            loadItemUnits();
            loadItemTypes();
            loadItems();
            break;
        case 'supplier-settings':
            loadSuppliers();
            loadSupplierAssignments();
            break;
        case 'hr-settings':
            loadHRSettings();
            break;
        case 'access-control':
            loadAccessControl();
            break;
    }
}

// Contacts Settings Tab Switching
function showContactsSettingsTab(tab) {
    if (typeof hasTabPermission === 'function' && !hasTabPermission('admin', 'contacts-settings', tab)) {
        const allowed = typeof getAllowedSubtabs === 'function' ? getAllowedSubtabs('admin', 'contacts-settings')[0] : null;
        if (allowed && allowed !== tab) { showContactsSettingsTab(allowed); }
        return;
    }
    if (typeof setCurrentModuleTabContext === 'function') setCurrentModuleTabContext('admin', 'contacts-settings', tab);
    document.querySelectorAll('.contacts-settings-tab').forEach(btn => {
        btn.classList.remove('bg-blue-600', 'text-white');
        btn.classList.add('bg-gray-200', 'text-gray-700');
    });
    document.querySelector(`.contacts-settings-tab[data-tab="${tab}"]`).classList.remove('bg-gray-200', 'text-gray-700');
    document.querySelector(`.contacts-settings-tab[data-tab="${tab}"]`).classList.add('bg-blue-600', 'text-white');
    
    document.querySelectorAll('.contacts-settings-tab-content').forEach(content => { content.classList.add('hidden'); content.style.display = ''; });
    const active = document.getElementById(`contacts-settings-${tab}-tab`);
    active.classList.remove('hidden');
    active.style.display = 'flex';
}

// Equipment Settings Tab Switching
function showEquipmentSettingsTab(tab) {
    if (typeof hasTabPermission === 'function' && !hasTabPermission('admin', 'equipment-settings', tab)) {
        const allowed = typeof getAllowedSubtabs === 'function' ? getAllowedSubtabs('admin', 'equipment-settings')[0] : null;
        if (allowed && allowed !== tab) { showEquipmentSettingsTab(allowed); }
        return;
    }
    if (typeof setCurrentModuleTabContext === 'function') setCurrentModuleTabContext('admin', 'equipment-settings', tab);
    document.querySelectorAll('.equipment-settings-tab').forEach(btn => {
        btn.classList.remove('bg-blue-600', 'text-white');
        btn.classList.add('bg-gray-200', 'text-gray-700');
    });
    document.querySelector(`.equipment-settings-tab[data-tab="${tab}"]`).classList.remove('bg-gray-200', 'text-gray-700');
    document.querySelector(`.equipment-settings-tab[data-tab="${tab}"]`).classList.add('bg-blue-600', 'text-white');

    document.querySelectorAll('.equipment-settings-tab-content').forEach(content => { content.classList.add('hidden'); content.style.display = ''; });
    const active = document.getElementById(`equipment-settings-${tab}-tab`);
    active.classList.remove('hidden');
    active.style.display = 'flex';

    // Load data based on tab
    if (tab === 'equipment-statuses') {
        loadEquipmentStatuses();
    } else if (tab === 'equipment-conditions') {
        loadEquipmentConditions();
    } else if (tab === 'equipment-owners') {
        loadEquipmentOwners();
    } else if (tab === 'pm-tasks') {
        loadPMTasks();
    }
}

// Location Settings Tab Switching
function showLocationSettingsTab(tab) {
    if (typeof hasTabPermission === 'function' && !hasTabPermission('admin', 'location-settings', tab)) {
        const allowed = typeof getAllowedSubtabs === 'function' ? getAllowedSubtabs('admin', 'location-settings')[0] : null;
        if (allowed && allowed !== tab) { showLocationSettingsTab(allowed); }
        return;
    }
    if (typeof setCurrentModuleTabContext === 'function') setCurrentModuleTabContext('admin', 'location-settings', tab);
    document.querySelectorAll('.location-settings-tab').forEach(btn => {
        btn.classList.remove('bg-blue-600', 'text-white');
        btn.classList.add('bg-gray-200', 'text-gray-700');
    });
    document.querySelector(`.location-settings-tab[data-tab="${tab}"]`).classList.remove('bg-gray-200', 'text-gray-700');
    document.querySelector(`.location-settings-tab[data-tab="${tab}"]`).classList.add('bg-blue-600', 'text-white');
    
    document.querySelectorAll('.location-settings-tab-content').forEach(content => { content.classList.add('hidden'); content.style.display = ''; });
    const active = document.getElementById(`location-settings-${tab}-tab`);
    active.classList.remove('hidden');
    active.style.display = 'flex';
    
    // Load data based on tab
    if (tab === 'assign-business-types') {
        loadBusinessTypeAssignments();
    }
}

// Warehouse Settings Tab Switching
function showWarehouseSettingsTab(tab) {
    if (typeof hasTabPermission === 'function' && !hasTabPermission('admin', 'warehouse-settings', tab)) {
        const allowed = typeof getAllowedSubtabs === 'function' ? getAllowedSubtabs('admin', 'warehouse-settings')[0] : null;
        if (allowed && allowed !== tab) { showWarehouseSettingsTab(allowed); }
        return;
    }
    if (typeof setCurrentModuleTabContext === 'function') setCurrentModuleTabContext('admin', 'warehouse-settings', tab);
    document.querySelectorAll('.warehouse-settings-tab').forEach(btn => {
        btn.classList.remove('bg-blue-600', 'text-white');
        btn.classList.add('bg-gray-200', 'text-gray-700');
    });
    document.querySelector(`.warehouse-settings-tab[data-tab="${tab}"]`).classList.remove('bg-gray-200', 'text-gray-700');
    document.querySelector(`.warehouse-settings-tab[data-tab="${tab}"]`).classList.add('bg-blue-600', 'text-white');
    
    document.querySelectorAll('.warehouse-settings-tab-content').forEach(content => { content.classList.add('hidden'); content.style.display = ''; });
    const active = document.getElementById(`warehouse-settings-${tab}-tab`);
    active.classList.remove('hidden');
    active.style.display = 'flex';
}

// Supplier Settings Tab Switching
function showSupplierSettingsTab(tab) {
    if (typeof hasTabPermission === 'function' && !hasTabPermission('admin', 'supplier-settings', tab)) {
        const allowed = typeof getAllowedSubtabs === 'function' ? getAllowedSubtabs('admin', 'supplier-settings')[0] : null;
        if (allowed && allowed !== tab) { showSupplierSettingsTab(allowed); }
        return;
    }
    if (typeof setCurrentModuleTabContext === 'function') setCurrentModuleTabContext('admin', 'supplier-settings', tab);
    document.querySelectorAll('.supplier-settings-tab').forEach(btn => {
        btn.classList.remove('bg-blue-600', 'text-white');
        btn.classList.add('bg-gray-200', 'text-gray-700');
    });
    document.querySelector(`.supplier-settings-tab[data-tab="${tab}"]`).classList.remove('bg-gray-200', 'text-gray-700');
    document.querySelector(`.supplier-settings-tab[data-tab="${tab}"]`).classList.add('bg-blue-600', 'text-white');
    
    document.querySelectorAll('.supplier-settings-tab-content').forEach(content => { content.classList.add('hidden'); content.style.display = ''; });
    const active = document.getElementById(`supplier-settings-${tab}-tab`);
    active.classList.remove('hidden');
    active.style.display = 'flex';
}

// HR Settings Tab Switching
function showHRSettingsGroup(group) {
    // Toggle group buttons
    document.querySelectorAll('.hr-settings-group-tab').forEach(btn => {
        btn.classList.remove('bg-blue-600', 'text-white');
        btn.classList.add('bg-gray-200', 'text-gray-700');
    });
    const activeGroupBtn = document.querySelector(`.hr-settings-group-tab[data-group="${group}"]`);
    if (activeGroupBtn) {
        activeGroupBtn.classList.remove('bg-gray-200', 'text-gray-700');
        activeGroupBtn.classList.add('bg-blue-600', 'text-white');
    }
    // Toggle group content
    document.querySelectorAll('.hr-settings-group-content').forEach(content => { content.classList.add('hidden'); });
    const groupContent = document.getElementById(`hr-settings-group-${group}`);
    if (groupContent) groupContent.classList.remove('hidden');
    // Activate the first sub-tab in the group
    const firstSubTab = groupContent && groupContent.querySelector('.hr-settings-tab');
    if (firstSubTab) {
        showHRSettingsTab(firstSubTab.getAttribute('data-tab'));
    }
}

function showHRSettingsTab(tab) {
    if (typeof hasTabPermission === 'function' && !hasTabPermission('admin', 'hr-settings', tab)) {
        const allowed = typeof getAllowedSubtabs === 'function' ? getAllowedSubtabs('admin', 'hr-settings')[0] : null;
        if (allowed && allowed !== tab) { showHRSettingsTab(allowed); }
        return;
    }
    if (typeof setCurrentModuleTabContext === 'function') setCurrentModuleTabContext('admin', 'hr-settings', tab);
    // Only toggle sub-tab buttons that are within the active group
    document.querySelectorAll('.hr-settings-group-content:not(.hidden) .hr-settings-tab').forEach(btn => {
        btn.classList.remove('bg-blue-600', 'text-white');
        btn.classList.add('bg-gray-200', 'text-gray-700');
    });
    const activeBtn = document.querySelector(`.hr-settings-group-content:not(.hidden) .hr-settings-tab[data-tab="${tab}"]`);
    if (activeBtn) {
        activeBtn.classList.remove('bg-gray-200', 'text-gray-700');
        activeBtn.classList.add('bg-blue-600', 'text-white');
    }

    document.querySelectorAll('.hr-settings-tab-content').forEach(content => { content.classList.add('hidden'); content.style.display = ''; });
    const active = document.getElementById(`hr-settings-${tab}-tab`);
    active.classList.remove('hidden');
    active.style.display = 'flex';

    if (tab === 'positions') loadPositions();
    else if (tab === 'departments') loadDepartments();
    else if (tab === 'employee-statuses') loadEmployeeStatuses();
    else if (tab === 'nationalities') loadNationalities();
    else if (tab === 'document-types') loadDocumentTypes();
    else if (tab === 'position-departments') loadPositionDepartments();
    else if (tab === 'uniform-types') loadUniformTypes();
    else if (tab === 'uniform-sizes') loadUniformSizes();
    else if (tab === 'accommodation-types') loadAccommodationTypes();
    else if (tab === 'remuneration-types') loadRemunerationTypes();
    else if (tab === 'leave-types') loadLeaveTypes();
    else if (tab === 'overtime-types') loadOvertimeTypes();
    else if (tab === 'employee-id-prefix') loadEmployeeIdPrefix();
}

// HR Management Tab Switching
function showHRTab(tab) {
    if (typeof hasTabPermission === 'function' && !hasTabPermission('hr', tab, '')) {
        const allowed = typeof getAllowedTabs === 'function' ? getAllowedTabs('hr')[0] : null;
        if (allowed && allowed !== tab) { showHRTab(allowed); }
        return;
    }
    if (typeof setCurrentModuleTabContext === 'function') setCurrentModuleTabContext('hr', tab, '');
    document.querySelectorAll('.hr-tab').forEach(btn => {
        btn.classList.remove('bg-blue-600', 'text-white');
        btn.classList.add('bg-gray-200', 'text-gray-700');
    });
    document.querySelector(`.hr-tab[data-tab="${tab}"]`).classList.remove('bg-gray-200', 'text-gray-700');
    document.querySelector(`.hr-tab[data-tab="${tab}"]`).classList.add('bg-blue-600', 'text-white');
    
    document.querySelectorAll('.hr-tab-content').forEach(content => { content.classList.add('hidden'); content.style.display = 'none'; });
    const activeTab = document.getElementById(`hr-${tab}-tab`);
    activeTab.classList.remove('hidden');
    activeTab.style.display = 'flex';
    
    // Load data for the selected HR tab
    switch(tab) {
        case 'employee-management':
            showEmployeeManagementTab('add-employee');
            break;
        case 'accommodation-management':
            showAccommodationTab('room-assignments');
            break;
        case 'uniform-management':
            showUniformTab('items');
            break;
        case 'payment-management':
            showPaymentTab('attendance-register');
            break;
    }
}

// Accommodation Management Tab Switching
function showAccommodationTab(tab) {
    document.querySelectorAll('.accommodation-tab').forEach(btn => {
        btn.classList.remove('bg-blue-600', 'text-white');
        btn.classList.add('bg-gray-200', 'text-gray-700');
    });
    const activeBtn = document.querySelector(`.accommodation-tab[data-tab="${tab}"]`);
    if (activeBtn) {
        activeBtn.classList.remove('bg-gray-200', 'text-gray-700');
        activeBtn.classList.add('bg-blue-600', 'text-white');
    }
    document.querySelectorAll('.accommodation-tab-content').forEach(content => { content.classList.add('hidden'); });
    const activeTab = document.getElementById(`accommodation-${tab}-tab`);
    if (activeTab) activeTab.classList.remove('hidden');

    if (tab === 'locations') loadHRAccommodationLocations();
    else if (tab === 'rooms') loadHRAccommodationRooms();
    else if (tab === 'room-assignments') loadHRAccommodationRoomAssignments();
}

// Payment Management Tab Switching
function showPaymentTab(tab) {
    if (typeof hasTabPermission === 'function' && !hasTabPermission('hr', 'payment-management', tab)) {
        const allowed = typeof getAllowedSubtabs === 'function' ? getAllowedSubtabs('hr', 'payment-management')[0] : null;
        if (allowed && allowed !== tab) { showPaymentTab(allowed); }
        return;
    }
    if (typeof setCurrentModuleTabContext === 'function') setCurrentModuleTabContext('hr', 'payment-management', tab);
    document.querySelectorAll('.payment-tab').forEach(btn => {
        btn.classList.remove('bg-blue-600', 'text-white');
        btn.classList.add('bg-gray-200', 'text-gray-700');
    });
    document.querySelector(`.payment-tab[data-tab="${tab}"]`).classList.remove('bg-gray-200', 'text-gray-700');
    document.querySelector(`.payment-tab[data-tab="${tab}"]`).classList.add('bg-blue-600', 'text-white');
    
    document.querySelectorAll('.payment-tab-content').forEach(content => { content.classList.add('hidden'); content.style.display = 'none'; });
    const activePayTab = document.getElementById(`payment-${tab}-tab`);
    activePayTab.classList.remove('hidden');
    activePayTab.style.display = 'flex';
    
    if (tab === 'attendance-register') {
        initAttendanceRegister();
    } else if (tab === 'leave-entry') {
        initLeaveEntry();
    } else if (tab === 'advance-payments') {
        initAdvancePayments();
    } else if (tab === 'payment-calculation') {
        initPayrollCalculation();
    } else if (tab === 'payment-history') {
        loadPaymentHistory();
    }
    setTimeout(adjustTableContainerHeights, 50);
}

// Employee Management Tab Switching
function showEmployeeManagementTab(tab) {
    if (typeof hasTabPermission === 'function' && !hasTabPermission('hr', 'employee-management', tab)) {
        const allowed = typeof getAllowedSubtabs === 'function' ? getAllowedSubtabs('hr', 'employee-management')[0] : null;
        if (allowed && allowed !== tab) { showEmployeeManagementTab(allowed); }
        return;
    }
    if (typeof setCurrentModuleTabContext === 'function') setCurrentModuleTabContext('hr', 'employee-management', tab);
    document.querySelectorAll('.employee-management-tab').forEach(btn => {
        btn.classList.remove('bg-blue-600', 'text-white');
        btn.classList.add('bg-gray-200', 'text-gray-700');
    });
    document.querySelector(`.employee-management-tab[data-tab="${tab}"]`).classList.remove('bg-gray-200', 'text-gray-700');
    document.querySelector(`.employee-management-tab[data-tab="${tab}"]`).classList.add('bg-blue-600', 'text-white');
    
    document.querySelectorAll('.employee-management-tab-content').forEach(content => { content.classList.add('hidden'); content.style.display = ''; });
    const activeEmpTab = document.getElementById(`employee-management-${tab}-tab`);
    activeEmpTab.classList.remove('hidden');
    activeEmpTab.style.display = 'flex';
    
    // Load data for the selected employee management tab
    switch(tab) {
        case 'add-employee':
            loadEmployees();
            break;
        case 'terminate-employee':
            loadTerminatedEmployees();
            break;
        case 'transfer-employee':
            loadTransferEmployees();
            break;
        case 'employee-documents':
            loadEmployeeDocuments();
            break;
        case 'bulk-settings':
            loadBulkSettingsLeaveTypes();
            break;
    }
    setTimeout(adjustTableContainerHeights, 50);
}

// Uniform Tab Switching
function showUniformTab(tab) {
    if (typeof hasTabPermission === 'function' && !hasTabPermission('hr', 'uniform-management', tab)) {
        const allowed = typeof getAllowedSubtabs === 'function' ? getAllowedSubtabs('hr', 'uniform-management')[0] : null;
        if (allowed && allowed !== tab) { showUniformTab(allowed); }
        return;
    }
    if (typeof setCurrentModuleTabContext === 'function') setCurrentModuleTabContext('hr', 'uniform-management', tab);
    document.querySelectorAll('.uniform-tab').forEach(btn => {
        btn.classList.remove('bg-blue-600', 'text-white');
        btn.classList.add('bg-gray-200', 'text-gray-700');
    });
    document.querySelector(`.uniform-tab[data-tab="${tab}"]`).classList.remove('bg-gray-200', 'text-gray-700');
    document.querySelector(`.uniform-tab[data-tab="${tab}"]`).classList.add('bg-blue-600', 'text-white');
    
    document.querySelectorAll('.uniform-tab-content').forEach(content => { content.classList.add('hidden'); content.style.display = ''; });
    const activeUniformTab = document.getElementById(`uniform-${tab}-tab`);
    activeUniformTab.classList.remove('hidden');
    activeUniformTab.style.display = 'flex';
    if (tab === 'purchases') loadUniformPurchases();
    if (tab === 'distributions') loadUniformDistributions();
}

// Bind sidebar navigation clicks
document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.sidebar-item').forEach(btn => {
        btn.addEventListener('click', () => {
            const section = btn.getAttribute('data-section');
            if (section) showSection(section);
        });
    });
});

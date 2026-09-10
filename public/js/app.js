// Main application initialization

// Initialize after session is known
document.addEventListener('sessionReady', (e) => {
    const manager = e.detail;
    if (manager && manager.module_name !== 'admin') {
        showSection(`${manager.module_name}-dashboard`);
    } else {
        showSection('dashboard');
        loadDashboardStats();
    }
    loadLocations();
});

// Initialize date pickers in index.html on DOMContentLoaded
document.addEventListener('DOMContentLoaded', () => {
    initDDMMYYYYDatePickers();
});

// Wait for modals to be loaded before attaching event listeners
document.addEventListener('modalsLoaded', () => {
    initDDMMYYYYDatePickers();

    // Form event listeners
    document.getElementById('equipment-form')?.addEventListener('submit', saveEquipment);
    document.getElementById('transfer-form')?.addEventListener('submit', saveTransfer);
    document.getElementById('maintenance-form')?.addEventListener('submit', saveMaintenance);
    document.getElementById('parts-item-form')?.addEventListener('submit', savePartsItem);
    document.getElementById('parts-purchase-form')?.addEventListener('submit', savePartsPurchase);
    document.getElementById('equipment-purchase-form')?.addEventListener('submit', saveEquipmentPurchase);
    document.getElementById('uniform-item-form')?.addEventListener('submit', saveUniformItem);
    document.getElementById('uniform-purchase-form')?.addEventListener('submit', saveUniformPurchase);
    document.getElementById('uniform-distribution-form')?.addEventListener('submit', saveUniformDistribution);
    document.getElementById('employee-form')?.addEventListener('submit', saveEmployee);
    document.getElementById('location-form')?.addEventListener('submit', saveLocation);
    
    // Admin Settings form event listeners
    document.getElementById('contact-category-form')?.addEventListener('submit', saveContactCategory);
    document.getElementById('contact-status-form')?.addEventListener('submit', saveContactStatus);
    document.getElementById('contact-status-assignment-form')?.addEventListener('submit', saveContactStatusAssignment);
    
    // Admin Settings form event listeners
    document.getElementById('country-form')?.addEventListener('submit', saveCountry);
    document.getElementById('location-type-form')?.addEventListener('submit', saveLocationType);
    document.getElementById('sub-location-type-form')?.addEventListener('submit', saveSubLocationType);
    document.getElementById('business-type-form')?.addEventListener('submit', saveBusinessType);
    document.getElementById('business-type-assignment-form')?.addEventListener('submit', saveBusinessTypeAssignment);
    document.getElementById('item-category-form')?.addEventListener('submit', saveItemCategory);
    document.getElementById('item-unit-form')?.addEventListener('submit', saveItemUnit);
    document.getElementById('item-type-form')?.addEventListener('submit', saveItemType);
    document.getElementById('item-form')?.addEventListener('submit', saveItem);
    document.getElementById('supplier-form')?.addEventListener('submit', saveSupplier);
    document.getElementById('supplier-assignment-form')?.addEventListener('submit', saveSupplierAssignment);
    document.getElementById('equipment-status-form')?.addEventListener('submit', saveEquipmentStatus);
    document.getElementById('equipment-condition-form')?.addEventListener('submit', saveEquipmentCondition);
    document.getElementById('equipment-owner-form')?.addEventListener('submit', saveEquipmentOwner);
    document.getElementById('add-stock-form')?.addEventListener('submit', saveAddStock);

    // HR Settings form event listeners
    document.getElementById('position-form')?.addEventListener('submit', savePosition);
    document.getElementById('department-form')?.addEventListener('submit', saveDepartment);
    document.getElementById('employee-status-form')?.addEventListener('submit', saveEmployeeStatus);
    document.getElementById('uniform-type-form')?.addEventListener('submit', saveUniformType);
    document.getElementById('uniform-size-form')?.addEventListener('submit', saveUniformSize);
    document.getElementById('accommodation-type-form')?.addEventListener('submit', saveAccommodationType);

    // Employee selection handler
    document.getElementById('uniform-distribution-employee')?.addEventListener('change', onEmployeeSelect);
});

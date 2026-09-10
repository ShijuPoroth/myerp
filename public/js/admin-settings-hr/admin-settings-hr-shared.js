// Generic HR Settings modal opener
function openHRSettingsModal(type) {
    if (type === 'position') openPositionModal();
    else if (type === 'department') openDepartmentModal();
    else if (type === 'employee-status') openEmployeeStatusModal();
    else if (type === 'nationality') openNationalityModal();
    else if (type === 'document-type') openDocumentTypeModal();
    else if (type === 'uniform-type') openUniformTypeModal();
    else if (type === 'uniform-size') openUniformSizeModal();
    else if (type === 'accommodation-type') openAccommodationTypeModal();
    else if (type === 'remuneration-type') openRemunerationTypeModal();
    else if (type === 'leave-type') openLeaveTypeModal();
    else if (type === 'overtime-type') openOvertimeTypeModal();
}

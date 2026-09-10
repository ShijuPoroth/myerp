// EMPLOYEE ID PREFIX
async function loadEmployeeIdPrefix() {
    try {
        const response = await fetch(`${API_BASE}/employee-id-prefix`);
        employeeIdPrefix = await response.json();
        document.getElementById('employee-id-prefix-input').value = employeeIdPrefix.prefix || 'EMP';
    } catch (error) {
        console.error('Error loading employee ID prefix:', error);
    }
}

async function saveEmployeeIdPrefix() {
    const prefix = document.getElementById('employee-id-prefix-input').value.trim();
    if (!prefix) {
        alert('Please enter a prefix');
        return;
    }
    try {
        await fetch(`${API_BASE}/employee-id-prefix`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prefix })
        });
        alert('Employee ID prefix saved');
        loadEmployeeIdPrefix();
    } catch (error) {
        console.error('Error saving employee ID prefix:', error);
    }
}

// Loader for HTML partials

async function loadModals() {
    try {
        const response = await fetch('partials/modals.html?v=37');
        const html = await response.text();
        document.getElementById('modals-container').innerHTML = html;
        
        // Dispatch event to notify that modals are loaded
        document.dispatchEvent(new Event('modalsLoaded'));
    } catch (error) {
        console.error('Error loading modals:', error);
    }
}

// Load modals when DOM is ready
document.addEventListener('DOMContentLoaded', loadModals);

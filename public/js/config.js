// Configuration
const API_BASE = '/api';

// Global fetch wrapper: redirect to login on 401
(function() {
    const originalFetch = window.fetch;
    window.fetch = async function(...args) {
        const response = await originalFetch.apply(this, args);
        if (response.status === 401) {
            const url = args[0] ? String(args[0]) : '';
            if (!url.includes('/login') && !url.includes('/check-session') && window.location.pathname !== '/') {
                window.location.href = '/';
            }
        }
        return response;
    };
})();

// Capture uncaught JS errors for server-side debugging
(function() {
    function sendClientError(payload) {
        try {
            fetch('/api/client-error', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            }).catch(() => {});
        } catch (e) {}
    }
    window.onerror = function(message, source, line, column, error) {
        sendClientError({ message, source, line, column, stack: error && error.stack ? error.stack : '', url: window.location.href });
    };
    window.addEventListener('unhandledrejection', function(event) {
        const reason = event.reason;
        sendClientError({ message: String(reason && reason.message ? reason.message : reason), stack: reason && reason.stack ? reason.stack : '', url: window.location.href });
    });
})();

// Global state
let allEquipment = [];
let allLocations = [];
let allKitchenItems = [];
let allUniformItems = [];
let allEmployees = [];

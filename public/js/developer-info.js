const DEVELOPER_INFO = {
    name: 'Shiju Poroth',
    phone: '+91 9633290081',
    whatsappLink: 'https://wa.me/919633290081'
};

function renderDeveloperCredit() {
    const elements = document.querySelectorAll('[data-developer-credit]');
    elements.forEach(el => {
        el.innerHTML = `
            <p class="text-blue-400" style="font-size:0.6rem; letter-spacing:0.05em;">DEVELOPED BY</p>
            <p class="text-white font-semibold" style="font-size:0.75rem;">${DEVELOPER_INFO.name}</p>
            <a href="${DEVELOPER_INFO.whatsappLink}" target="_blank" class="text-blue-300 hover:text-orange-400 transition" style="font-size:0.65rem;">
                <i class="fab fa-whatsapp mr-1"></i>${DEVELOPER_INFO.phone}
            </a>
        `;
    });
}

function renderLoginContact() {
    const elements = document.querySelectorAll('[data-login-contact]');
    elements.forEach(el => {
        el.innerHTML = `
            <a href="${DEVELOPER_INFO.whatsappLink}" target="_blank" style="display:inline-flex;align-items:center;gap:6px;border:1.5px solid #1a2e5a;border-radius:999px;padding:4px 14px;font-family:Arial,sans-serif;font-size:0.8rem;font-weight:600;color:#1a2e5a;text-decoration:none;">
                <i class="fas fa-phone-alt" style="color:#e87722;font-size:0.75rem;"></i>
                <i class="fab fa-whatsapp" style="color:#25d366;font-size:0.9rem;"></i>
                ${DEVELOPER_INFO.phone}
            </a>
        `;
    });
}

document.addEventListener('DOMContentLoaded', function() {
    renderDeveloperCredit();
    renderLoginContact();
});

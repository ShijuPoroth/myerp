// Central event dispatcher — replaces inline on* attributes with data-* bindings
// so we can remove 'unsafe-inline' from script-src-attr in the CSP.
(function () {
    function dispatch(element, eventType) {
        const action = element.getAttribute(`data-${eventType}`);
        if (!action) return false;

        const handler = window[action];
        if (typeof handler !== 'function') {
            console.warn(`No handler found for action: ${action}`);
            return false;
        }

        // Pass simple arguments encoded in data-arg-* attributes
        const args = [];
        for (let i = 0; i < 5; i++) {
            const arg = element.getAttribute(`data-arg-${i}`);
            if (arg === null) break;
            args.push(arg);
        }

        handler.apply(element, args);
        return true;
    }

    function bindDelegated(eventType) {
        document.addEventListener(eventType, (e) => {
            const target = e.target.closest(`[data-${eventType}]`);
            if (target) {
                if (eventType === 'click') {
                    e.preventDefault();
                }
                dispatch(target, eventType);
            }
        });
    }

    // Bind common delegated events
    ['click', 'change', 'input', 'keyup', 'submit'].forEach(bindDelegated);

    // Direct binding helper for dynamically created elements
    window.bindAction = function (element, eventType, action) {
        element.addEventListener(eventType, () => {
            if (typeof window[action] === 'function') {
                window[action]();
            }
        });
    };
})();

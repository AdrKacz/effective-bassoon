const FB_ALLOWED = {
    Lead: ['currency', 'value'],
    Subscribe: ['currency', 'predicted_ltv', 'value'],
};

const GG_CONVERSIONS = {
    "Log in": "AW-17026062763/LojNCLrul70aEKuz1LY_",
};

const gtag_report_conversion = (send_to) => (new Promise(resolve => {
    const callback = () => (resolve());
    gtag('event', 'conversion', {
        'send_to': send_to,
        'event_callback': callback
    });
}));

document.querySelectorAll('[data-event]').forEach(el => {
    el.addEventListener('click', (e) => {
        const eventName = el.getAttribute('data-event');
        const href = el.getAttribute('href');
        const isLink = el.tagName.toLowerCase() === 'a' && href;

        const data = {};
        Array.from(el.attributes).forEach(attr => {
          if (attr.name.startsWith('data-event-') && attr.name !== 'data-event') {
            const key = attr.name.replace('data-event-', '');
            data[key] = attr.value;
          }
        });

        // Track event - Umami
        if (typeof umami !== 'undefined' && typeof umami.track === 'function') {
          umami.track(eventName, Object.keys(data).length ? data : undefined);
        }
        
        // Track event - Google
        const promises = []
        if (typeof gtag === 'function') {
            if (Object.keys(GG_CONVERSIONS).includes(eventName)) {
                promises.push(gtag_report_conversion(GG_CONVERSIONS[eventName]));
            }
        }
        
        // Track event - Facebook
        // if (typeof fbq === 'function') {
        //     const fbEvent = Object.keys(FB_ALLOWED).includes(eventName)
        //         ? eventName
        //         : Object.keys(FB_ALLOWED).includes(data['fb'])
        //         ? data['fb']
        //         : null;
        //     if (fbEvent) {
        //         const filteredData = Object.fromEntries(
        //             Object.entries(data).filter(([key]) => FB_ALLOWED[fbEvent].includes(key))
        //         );
        //         console.log('Emit', fbEvent, filteredData);
        //         fbq('track', fbEvent, filteredData)
        //     }
        // }

        // If it's a link, prevent default and redirect after a short delay (unless it's a download)
        if (isLink && !el.hasAttribute('download')) {
            e.preventDefault();
            // Small delay to allow umami to fire (you can tweak this value)
            // 150ms is usually enough
            const delay = new Promise(resolve => setTimeout(resolve, 150));
            Promise.all([...promises, delay]).then(() => {
                if (href === '#') window.location.reload();
                else window.location.href = href; 
            });
        }
    });
});
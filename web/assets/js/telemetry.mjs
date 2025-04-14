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

    // Trigger tracking
    if (typeof umami !== 'undefined' && typeof umami.track === 'function') {
      umami.track(eventName, Object.keys(data).length ? data : undefined);
    }

    // If it's a link, prevent default and redirect after a short delay
    if (isLink) {
      e.preventDefault();
      // Small delay to allow umami to fire (you can tweak this value)
      setTimeout(() => {
          if (href === '#') window.location.reload();
          else window.location.href = href;  
      }, 150); // 150ms is usually enough
    }
  });
});

(() => {
  window.addEventListener('message', async event => {
    if (event.source !== window || event.origin !== location.origin || event.data?.source !== 'GA_CORE_EREQ') return;
    const { type, requestId, draft } = event.data;
    if (!['PING', 'OPEN'].includes(type) || typeof requestId !== 'string') return;
    try {
      const result = await chrome.runtime.sendMessage({ type, draft });
      window.postMessage({ source:'GA_CORE_EREQ_EXTENSION', requestId, ...result }, location.origin);
    } catch {
      window.postMessage({ source:'GA_CORE_EREQ_EXTENSION', requestId, ok:false, error:'Ekstensi perlu dimuat ulang. Refresh halaman ini.' }, location.origin);
    }
  });
})();

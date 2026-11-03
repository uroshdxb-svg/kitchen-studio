// Website-only traffic measurement. This file is never included in offline exports.
(() => {
  'use strict';
  if (window.KS_analytics) return;
  const status = window.KS_analytics = { state: 'disabled' };
  const config = document.currentScript?.dataset || {};
  const key = config.amplitudeKey || '';
  const host = location.hostname;
  const path = location.pathname;
  const storeKey = 'KS_analytics_disabled';
  let excluded = false;
  try { excluded = localStorage.getItem(storeKey) === '1'; } catch (_) {}
  status.excludeThisBrowser = () => {
    try { localStorage.setItem(storeKey, '1'); } catch (_) {}
    window.amplitude?.setOptOut(true);
    status.state = 'excluded';
  };
  // Do not mix previews, automated tests, or authentication screens into visitor counts.
  if (!key || !['kitchenstudio.design', 'www.kitchenstudio.design'].includes(host) ||
      location.protocol !== 'https:' || navigator.webdriver || excluded ||
      navigator.globalPrivacyControl || navigator.doNotTrack === '1' ||
      /^(?:\/oauth(?:\/|$)|\/connect(?:\/|$))/.test(path)) return;

  // Never send kitchen/share IDs, query strings, URL fragments, page titles or form values.
  let page = 'other', safePath = '/other/';
  if (path === '/') { page = 'landing'; safePath = '/'; }
  else if (/^\/app\/?$/.test(path)) { page = 'builder'; safePath = '/app/'; }
  else if (/^\/k\//.test(path)) { page = 'shared_kitchen'; safePath = '/k/[shared]/'; }
  else if (/^\/guides\//.test(path)) { page = 'guide'; safePath = '/guides/'; }
  else if (/^\/docs\//.test(path)) { page = 'documentation'; safePath = '/docs/'; }
  else if (/^\/equipment\/?$/.test(path)) { page = 'equipment'; safePath = '/equipment/'; }
  else if (/^\/showcase\/?$/.test(path)) { page = 'showcase'; safePath = '/showcase/'; }
  let referrer = '';
  try { referrer = new URL(document.referrer).hostname; } catch (_) {}
  const properties = { site: 'kitchenstudio.design', page, path: safePath, referrer_host: referrer };
  const script = document.createElement('script');
  script.src = 'https://cdn.amplitude.com/libs/analytics-browser-2.48.1-min.js.gz';
  script.async = true;
  script.referrerPolicy = 'no-referrer';
  script.onerror = () => { status.state = 'blocked'; };
  script.onload = async () => {
    try {
      if (status.state === 'excluded') return;
      const amplitude = window.amplitude;
      if (!amplitude?.init) { status.state = 'blocked'; return; }
      await amplitude.init(key, {
        serverZone: config.amplitudeZone === 'EU' ? 'EU' : 'US',
        identityStorage: 'localStorage',
        trackingOptions: { ipAddress: false },
        remoteConfig: { fetchRemoteConfig: false },
        enableDiagnostics: false,
        transport: { referrerPolicy: 'no-referrer' },
        autocapture: {
          sessions: true, attribution: false, pageViews: false,
          fileDownloads: false, formInteractions: false, elementInteractions: false,
          networkTracking: false, webVitals: false, frustrationInteractions: false
        }
      }).promise;
      if (status.state === 'excluded') { amplitude.setOptOut(true); return; }
      amplitude.track('Kitchen Studio Page Viewed', properties);
      if (page === 'builder') amplitude.track('Kitchen Studio Builder Opened', properties);
      status.state = 'active';
    } catch (_) {
      // Analytics is optional: an unavailable service must never interrupt the planner.
      status.state = 'blocked';
    }
  };
  status.state = 'loading';
  document.head.appendChild(script);
})();

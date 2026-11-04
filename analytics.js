// Website-only traffic measurement. This file is never included in offline exports.
(() => {
  'use strict';
  if (window.KS_analytics) return;
  const status = window.KS_analytics = { state: 'disabled', track: () => {}, identify: () => {}, reset: () => {} };
  const pending = [];
  const params = new URLSearchParams(location.search);
  const config = document.currentScript?.dataset || {};
  const key = config.amplitudeKey || '';
  const host = location.hostname;
  const path = location.pathname;
  const storeKey = 'KS_analytics_disabled';
  let excluded = false;
  try {
    if (params.get('analytics_exclude') === '1') localStorage.setItem(storeKey, '1');
    if (params.get('analytics_exclude') === '0') localStorage.removeItem(storeKey);
    excluded = localStorage.getItem(storeKey) === '1';
  } catch (_) { excluded = params.get('analytics_exclude') === '1'; }
  let internalTest = params.get('analytics_test') === '1';
  try {
    if (internalTest) sessionStorage.setItem('KS_analytics_test', '1');
    internalTest = internalTest || sessionStorage.getItem('KS_analytics_test') === '1';
  } catch (_) {}
  status.excludeThisBrowser = () => {
    try { localStorage.setItem(storeKey, '1'); } catch (_) {}
    try { window.amplitude?.setOptOut(true); } catch (_) {}
    pending.length = 0;
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
  const properties = { site: 'kitchenstudio.design', page, path: safePath, referrer_host: referrer,
    country_code: 'Unknown', internal_test: internalTest, measurement_version: 2 };
  const roles = ['operator','chef','restaurant_manager','general_manager','owner','supplier','other'];
  const uses = ['new_opening','redesign','client_project','equipment_sales','exploring'];
  const guest = () => ({ account_status:'guest', profile_country_code:'Unknown', professional_role:'unknown', use_case:'unknown' });
  let identity = { id:null, profile:guest(), epoch:0 };
  let appliedIdentity = null;
  const snapshot = () => ({ ...identity, profile:{...identity.profile} });
  const canMeasure = () => ['loading','active'].includes(status.state);
  function applyIdentity(next) {
    const amplitude = window.amplitude;
    const previousId = appliedIdentity ? appliedIdentity.id : (amplitude.getUserId?.() || null);
    // A different account or sign-out must get a new device identifier. Otherwise
    // Amplitude can attach the next person's anonymous activity to the previous user.
    const resetRequired = (previousId && previousId !== next.id) ||
        (appliedIdentity && appliedIdentity.epoch !== next.epoch) ||
        (!appliedIdentity && next.epoch > 0);
    if (resetRequired) amplitude.reset();
    if (resetRequired || previousId !== next.id || (next.id && !appliedIdentity)) amplitude.setUserId(next.id || undefined);
    if (next.id && (!appliedIdentity || JSON.stringify(appliedIdentity.profile) !== JSON.stringify(next.profile) || appliedIdentity.id !== next.id)) {
      if (amplitude.Identify && amplitude.identify) {
        const traits = new amplitude.Identify();
        for (const [name,value] of Object.entries(next.profile)) traits.set(name,value);
        amplitude.identify(traits);
      }
    }
    appliedIdentity = next;
  }
  status.identify = (userId, profile = {}) => {
    if (!canMeasure()) return;
    // Supabase account UUIDs only: never accept an email address as an analytics ID.
    if (typeof userId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId)) return;
    if (!profile || typeof profile !== 'object') profile = {};
    const nextProfile = { account_status:'signed_in',
      profile_country_code:/^[A-Z]{2}$/.test(profile.country_code) && profile.country_code !== 'XX' ? profile.country_code : 'Unknown',
      professional_role:roles.includes(profile.professional_role) ? profile.professional_role : 'unknown',
      use_case:uses.includes(profile.use_case) ? profile.use_case : 'unknown' };
    identity = { id:userId, profile:nextProfile, epoch:identity.epoch + (identity.id && identity.id !== userId ? 1 : 0) };
    if (status.state === 'active') { try { applyIdentity(snapshot()); } catch (_) {} }
  };
  status.reset = () => {
    if (!canMeasure()) return;
    identity = { id:null, profile:guest(), epoch:identity.epoch + 1 };
    if (status.state === 'active') { try { applyIdentity(snapshot()); } catch (_) {} }
  };
  const events = new Set(['App Engaged', 'Equipment Added', 'Project Saved', 'Project Created', 'Export Generated', 'Share Enabled',
    'Signup Prompt Viewed', 'Signup Prompt Dismissed', 'Sign In Requested', 'Sign In Completed', 'Profile Completed',
    'Feature Gated', 'Guest Trial Started', 'Guest Trial Expired']);
  function emit(name, details, who) {
    applyIdentity(who);
    window.amplitude.track('Kitchen Studio ' + name, { ...properties, ...who.profile, ...details });
  }
  const once = new Set();
  status.track = (name, details = {}) => {
    if (!events.has(name) || !['loading', 'active'].includes(status.state)) return;
    if (name === 'App Engaged') { if (once.has(name)) return; once.add(name); }
    const safe = {};
    for (const [key, values] of Object.entries({storage:['local','cloud'],format:['json','csv','svg','pdf','txt','other'],source:['catalogue','custom','fabricated','duplicate','intake'],destination:['download','host'],
      reason:['engagement','export','save','mcp','custom_equipment','trial_expired','account','profile_required'],
      feature:['export','save','mcp','custom_equipment'], action:['email','google','profile','dismiss','continue']})) {
      if (values.includes(details[key])) safe[key] = details[key];
    }
    if (typeof details.example_layout === 'boolean') safe.example_layout = details.example_layout;
    if (Number.isInteger(details.quantity) && details.quantity > 0) safe.quantity = Math.min(details.quantity, 400);
    const who = snapshot();
    if (status.state === 'loading') { if (pending.length < 100) pending.push([name, safe, who]); return; }
    try { emit(name, safe, who); } catch (_) {}
  };
  // Only the country code leaves Cloudflare, never the visitor's IP or precise location.
  const countryReady = (async () => {
    let timer;
    try {
      const data = await Promise.race([
        fetch('/analytics-country', { cache:'no-store', credentials:'omit', referrerPolicy:'no-referrer' }).then(r => r.ok ? r.json() : {}),
        new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('timeout')), 1500); })
      ]);
      if (/^[A-Z]{2}$/.test(data.country_code) && data.country_code !== 'XX') properties.country_code = data.country_code;
    } catch (_) {} finally { clearTimeout(timer); }
  })();
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
      await countryReady;
      if (status.state === 'excluded') return;
      amplitude.add({name:'ks-reporting-context',type:'enrichment',execute:async event => {
        // Preserve event-time profile snapshots when a queued event is processed
        // after sign-out. SDK session events receive the current safe context.
        event.event_properties = { ...properties, ...identity.profile, ...event.event_properties };
        return event;
      }});
      await amplitude.init(key, {
        serverZone: config.amplitudeZone === 'EU' ? 'EU' : 'US',
        identityStorage: 'localStorage',
        // Resolve the app's identity before automatic session events can use a
        // persisted SDK identity from a previously signed-in account.
        optOut: true,
        trackingOptions: { ipAddress: false },
        remoteConfig: { fetchRemoteConfig: false },
        enableDiagnostics: false,
        transport: { referrerPolicy: 'no-referrer' },
        autocapture: {
          sessions: true, attribution: false, pageViews: false, pageUrlEnrichment: false,
          fileDownloads: false, formInteractions: false, elementInteractions: false,
          networkTracking: false, webVitals: false, frustrationInteractions: false
        }
      }).promise;
      if (status.state === 'excluded') { amplitude.setOptOut(true); return; }
      const firstIdentity = pending.length ? pending[0][2] : snapshot();
      applyIdentity(firstIdentity);
      amplitude.setOptOut(false);
      emit('Page Viewed', {}, firstIdentity);
      if (page === 'builder') emit('Builder Opened', {}, firstIdentity);
      status.state = 'active';
      for (const [name, details, who] of pending.splice(0)) emit(name, details, who);
      applyIdentity(snapshot());
    } catch (_) {
      // Analytics is optional: an unavailable service must never interrupt the planner.
      status.state = 'blocked';
    }
  };
  status.state = 'loading';
  document.head.appendChild(script);
})();

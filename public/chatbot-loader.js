
/**
 * Manowar Widget Loader
 * Production-ready script for embedding the Manowar chat widget.
 * Implements Intercom-style secure identity, command queueing, and handshake protocol.
 */
(function(W, D) {
  var MANOWAR_ORIGIN = 'https://manowar.cloud';
  var API_BASE_URL = 'https://manowar.cloud';
  
  // 1. Capture configuration from the script tag
  var scriptEl = D.currentScript || D.querySelector('script[src*="chatbot-loader.js"]');
  var botId = scriptEl ? scriptEl.getAttribute('data-bot-id') : null;
  var hubId = scriptEl ? scriptEl.getAttribute('data-hub-id') : null;
  
  var iframe = null;
  var isReady = false;
  var pendingIdentity = null;

  // 2. Session Persistence
  var anonymousVisitorId = localStorage.getItem('manowar_chat_visitor_id');
  if (!anonymousVisitorId) {
    anonymousVisitorId = 'v_' + Math.random().toString(36).slice(2);
    localStorage.setItem('manowar_chat_visitor_id', anonymousVisitorId);
  }

  /**
   * Main command handler for window.Manowar() calls.
   */
  function handleCommand() {
    var args = Array.prototype.slice.call(arguments);
    var cmd = args[0];
    var params = args[1] || {};

    switch(cmd) {
      case 'boot':
        boot(params);
        break;
      case 'update':
        update(params);
        break;
      case 'show':
        toggleVisibility(true);
        break;
      case 'hide':
        toggleVisibility(false);
        break;
      case 'shutdown':
        shutdown();
        break;
    }
  }

  function boot(params) {
    if (params.bot_id) botId = params.bot_id;
    if (params.hub_id) hubId = params.hub_id;
    if (!botId || !hubId) {
      console.warn('[Manowar] Cannot boot: missing bot_id or hub_id');
      return;
    }

    if (!iframe) {
      createIframe();
    }
    
    // Store identity for execution once the widget is ready
    if (params.provider_id && (params.user_id || params.email)) {
        pendingIdentity = params;
    }
  }

  function update(params) {
    if (params.bot_id) botId = params.bot_id;
    if (params.hub_id) hubId = params.hub_id;
    updateIdentity(params);
  }

  /**
   * Securely identifies the user via the Manowar API.
   * If Secure Mode is enabled, requires a valid HMAC signature (user_hash).
   */
  function updateIdentity(settings) {
    if (!settings.provider_id) return;
    
    // If widget isn't ready yet, queue the update
    if (!isReady) {
      pendingIdentity = settings;
      return;
    }

    fetch(API_BASE_URL + '/api/widget/identity', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        botId: botId,
        hubId: hubId,
        providerId: settings.provider_id,
        anonymousVisitorId: anonymousVisitorId,
        user_id: settings.user_id,
        email: settings.email,
        name: settings.name,
        user_hash: settings.user_hash,
        custom_attributes: settings.custom_attributes
      })
    })
    .then(function(r) { return r.json(); })
    .then(function(data) {
      if (data.contactId && iframe) {
        iframe.contentWindow.postMessage({ type: 'manowar-identity-update', identity: data }, MANOWAR_ORIGIN);
      }
    })
    .catch(function(e) { console.error('[Manowar] Identity verification failed', e); });
  }

  function createIframe() {
    iframe = D.createElement('iframe');
    var src = MANOWAR_ORIGIN + '/chatbot/' + hubId + '/' + botId;
    
    // Pass visitor context via URL for initial frame state
    src += '?v_id=' + anonymousVisitorId;
    
    iframe.src = src;
    iframe.id = 'manowar-chat-iframe';
    iframe.style.cssText = 'position:fixed;bottom:20px;right:20px;width:380px;height:600px;border:none;z-index:999999;display:none;border-radius:16px;box-shadow:0 10px 25px rgba(0,0,0,0.2);';
    D.body.appendChild(iframe);

    iframe.onload = function() {
      // Initiate the origin handshake
      iframe.contentWindow.postMessage({ 
        type: 'manowar-parent-hello', 
        widgetInstanceId: anonymousVisitorId 
      }, MANOWAR_ORIGIN);
    };
  }

  function toggleVisibility(show) {
    if (iframe) iframe.style.display = show ? 'block' : 'none';
  }

  function shutdown() {
    if (iframe) {
      iframe.parentNode.removeChild(iframe);
      iframe = null;
      isReady = false;
      pendingIdentity = null;
    }
  }

  // 3. Global Communication Listener
  W.addEventListener('message', function(event) {
    if (event.origin !== MANOWAR_ORIGIN) return;

    if (event.data === 'close-manowar-chat') {
      toggleVisibility(false);
    }
    
    // Once the widget ack's the handshake, we can execute queued identity updates
    if (event.data && event.data.type === 'manowar-widget-ready') {
      isReady = true;
      if (pendingIdentity) {
        updateIdentity(pendingIdentity);
        pendingIdentity = null;
      } else if (W.manowarSettings) {
        updateIdentity(W.manowarSettings);
      }
    }
  });

  // 4. Intercom-style Command Queue Replay
  var q = W.Manowar && W.Manowar.q ? W.Manowar.q : [];
  W.Manowar = handleCommand;
  for (var i = 0; i < q.length; i++) {
    W.Manowar.apply(null, q[i]);
  }

  // 5. Automatic boot if configuration is present
  if (W.manowarSettings) {
    boot(W.manowarSettings);
  }

})(window, document);

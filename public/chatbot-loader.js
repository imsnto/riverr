
(function(W, D) {
  var MANOWAR_ORIGIN = 'https://manowar.cloud';
  var API_BASE_URL = 'https://manowar.cloud';
  var scriptEl = D.currentScript;
  
  var botId = scriptEl.getAttribute('data-bot-id');
  var hubId = scriptEl.getAttribute('data-hub-id');
  var iframe = null;
  var isReady = false;

  // 1. Generate/Persist Anonymous Visitor ID
  var anonymousVisitorId = localStorage.getItem('manowar_chat_visitor_id');
  if (!anonymousVisitorId) {
    anonymousVisitorId = 'v_' + Math.random().toString(36).slice(2);
    localStorage.setItem('manowar_chat_visitor_id', anonymousVisitorId);
  }

  function toggleVisibility(show) {
    if (!iframe) return;
    iframe.style.display = show ? 'block' : 'none';
  }

  function updateIdentity(settings) {
    if (!settings.provider_id) return;

    var payload = {
      botId: botId,
      hubId: hubId,
      providerId: settings.provider_id,
      anonymousVisitorId: anonymousVisitorId,
      user_id: settings.user_id,
      email: settings.email,
      name: settings.name,
      user_hash: settings.user_hash,
      custom_attributes: settings.custom_attributes,
      conversationId: settings.conversation_id
    };

    fetch(API_BASE_URL + '/api/widget/identity', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
    .then(function(r) { return r.json(); })
    .then(function(data) {
      if (data.status === 'identified' && iframe) {
        iframe.contentWindow.postMessage({
          type: 'manowar-identity-update',
          identity: data
        }, MANOWAR_ORIGIN);
      }
    })
    .catch(function(e) { console.error('[Manowar] Identity update failed', e); });
  }

  function handleCommand() {
    var args = Array.prototype.slice.call(arguments);
    var cmd = args[0];
    var params = args[1] || {};

    switch(cmd) {
      case 'boot':
        if (params.bot_id) botId = params.bot_id;
        if (params.hub_id) hubId = params.hub_id;
        createIframe();
        if (params.user_id || params.email) updateIdentity(params);
        break;
      case 'update':
        updateIdentity(params);
        break;
      case 'show': toggleVisibility(true); break;
      case 'hide': toggleVisibility(false); break;
      case 'shutdown':
        if (iframe) {
          iframe.parentNode.removeChild(iframe);
          iframe = null;
        }
        break;
    }
  }

  function createIframe() {
    if (iframe) return;
    iframe = D.createElement('iframe');
    var src = MANOWAR_ORIGIN + '/chatbot/' + hubId + '/' + botId;
    iframe.src = src;
    
    // Styling
    Object.assign(iframe.style, {
      position: 'fixed',
      bottom: '20px',
      right: '20px',
      width: '380px',
      height: '600px',
      border: 'none',
      borderRadius: '16px',
      boxShadow: '0 10px 25px rgba(0,0,0,0.2)',
      zIndex: '999999',
      display: 'none' // Default to hidden until 'show' or manual interaction
    });

    iframe.onload = function() {
      // Handshake: Let the widget know who its parent is
      iframe.contentWindow.postMessage({ type: 'manowar-parent-hello' }, MANOWAR_ORIGIN);
    };

    D.body.appendChild(iframe);
  }

  // Handle messages FROM the widget
  W.addEventListener('message', function(event) {
    if (event.origin !== MANOWAR_ORIGIN) return;

    if (event.data === 'close-manowar-chat') {
      toggleVisibility(false);
    }
    
    if (event.data && event.data.type === 'manowar-widget-ready') {
      isReady = true;
      // Replay identity if we have settings waiting
      if (W.manowarSettings) updateIdentity(W.manowarSettings);
    }
  });

  // Intercom-style Queue handling
  var q = W.Manowar && W.Manowar.q ? W.Manowar.q : [];
  W.Manowar = handleCommand;
  for (var i = 0; i < q.length; i++) {
    handleCommand.apply(null, q[i]);
  }

  // Auto-boot if settings exist or data-attributes are present
  if (W.manowarSettings || (botId && hubId)) {
    handleCommand('boot', W.manowarSettings || {});
  }

})(window, document);

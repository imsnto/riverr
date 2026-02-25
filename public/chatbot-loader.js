
(function(W, D) {
  var MANOWAR_ORIGIN = 'https://manowar.cloud';
  var scriptEl = D.currentScript;
  var iframe = null;
  var isReady = false;

  // 1. Intercom-style Queue Setup
  var q = W.Manowar && W.Manowar.q ? W.Manowar.q : [];
  
  function handleCommand() {
    var args = Array.prototype.slice.call(arguments);
    var cmd = args[0];
    var params = args[1] || {};

    if (cmd === 'boot') {
      createIframe(params);
    } else if (cmd === 'update') {
      updateIdentity(params);
    } else if (cmd === 'shutdown') {
      shutdown();
    } else if (cmd === 'show' || cmd === 'hide') {
      toggleVisibility(cmd === 'show');
    }
  }

  // Replace queue with real handler
  W.Manowar = function() {
    handleCommand.apply(null, arguments);
  };

  function createIframe(settings) {
    if (iframe) return;

    var botId = settings.bot_id || scriptEl.getAttribute('data-bot-id');
    var hubId = settings.hub_id || scriptEl.getAttribute('data-hub-id');

    if (!botId || !hubId) {
      console.error('Manowar: Missing botId or hubId');
      return;
    }

    iframe = D.createElement('iframe');
    iframe.src = MANOWAR_ORIGIN + '/chatbot/' + hubId + '/' + botId;
    iframe.id = 'manowar-chat-iframe';
    
    // Style for the "launcher" and widget
    Object.assign(iframe.style, {
      position: 'fixed',
      bottom: '20px',
      right: '20px',
      width: '380px',
      height: '600px',
      border: 'none',
      zIndex: '999999',
      borderRadius: '16px',
      boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
      display: 'none',
      colorScheme: 'none'
    });

    D.body.appendChild(iframe);

    iframe.onload = function() {
      isReady = true;
      // SECURE HANDSHAKE: Widget learns parent origin from this first message
      iframe.contentWindow.postMessage({ type: 'manowar-parent-hello' }, MANOWAR_ORIGIN);
      
      // Auto-identify if credentials provided in boot
      if (settings.user_id || settings.email) {
        updateIdentity(settings);
      }
      toggleVisibility(true);
    };
  }

  function updateIdentity(settings) {
    if (!iframe || !isReady) return;

    var botId = settings.bot_id || scriptEl.getAttribute('data-bot-id');
    var hubId = settings.hub_id || scriptEl.getAttribute('data-hub-id');

    var payload = {
      botId: botId,
      hubId: hubId,
      providerId: settings.provider_id,
      user_id: settings.user_id,
      email: settings.email,
      name: settings.name,
      user_hash: settings.user_hash,
      custom_attributes: settings.custom_attributes,
      anonymousVisitorId: localStorage.getItem('manowar_chat_visitor_id')
    };

    fetch(MANOWAR_ORIGIN + '/api/widget/identity', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
    .then(function(r) { return r.json(); })
    .then(function(data) {
      if (data.status === 'identified') {
        iframe.contentWindow.postMessage({ 
          type: 'manowar-identity-update', 
          identity: data 
        }, MANOWAR_ORIGIN);
      }
    });
  }

  function toggleVisibility(show) {
    if (iframe) iframe.style.display = show ? 'block' : 'none';
  }

  function shutdown() {
    if (iframe) {
      iframe.remove();
      iframe = null;
      isReady = false;
    }
  }

  // Handle incoming messages from the widget (origins checked)
  W.addEventListener('message', function(event) {
    if (event.origin !== MANOWAR_ORIGIN) return;

    if (event.data === 'close-manowar-chat') {
      toggleVisibility(false);
    }
  });

  // 2. Replay Queued Commands
  for (var i = 0; i < q.length; i++) {
    handleCommand.apply(null, q[i]);
  }

  // 3. Support window.manowarSettings if defined
  if (W.manowarSettings) {
    handleCommand('boot', W.manowarSettings);
  }

})(window, document);

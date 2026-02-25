(function() {
  var W = window;
  var D = document;

  // 1. Initialize Queue (Intercom style)
  var M = function() {
    M.c(arguments);
  };
  M.q = [];
  M.c = function(args) {
    M.q.push(args);
  };

  if (typeof W.Manowar !== 'function') {
    W.Manowar = M;
  }

  var MANOWAR_BASE_URL = 'https://manowar.cloud'; // Change to current origin if needed
  var API_BASE_URL = window.location.origin;

  function getSettings() {
    return W.manowarSettings || {};
  }

  function createIframe(settings) {
    if (D.getElementById('manowar-iframe')) return;

    var botId = settings.bot_id || D.currentScript.getAttribute('data-bot-id');
    var hubId = settings.hub_id || D.currentScript.getAttribute('data-hub-id');

    if (!botId || !hubId) {
      console.error('[Manowar] Missing bot_id or hub_id');
      return;
    }

    var iframe = D.createElement('iframe');
    iframe.id = 'manowar-iframe';
    iframe.src = MANOWAR_BASE_URL + '/chatbot/' + hubId + '/' + botId;
    iframe.style.position = 'fixed';
    iframe.style.bottom = '20px';
    iframe.style.right = '20px';
    iframe.style.width = '380px';
    iframe.style.height = '600px';
    iframe.style.border = 'none';
    iframe.style.zIndex = '999999';
    iframe.style.borderRadius = '16px';
    iframe.style.boxShadow = '0 4px 20px rgba(0,0,0,0.15)';
    iframe.style.transition = 'transform 0.3s ease, opacity 0.3s ease';
    iframe.style.display = 'none'; // Initially hidden

    D.body.appendChild(iframe);

    // Initial Identify if settings present
    if (settings.user_id || settings.email) {
      W.Manowar('update', settings);
    }
  }

  // 2. Real Handler Implementation
  var isBooted = false;
  W.Manowar = function() {
    var args = Array.prototype.slice.call(arguments);
    var command = args[0];
    var data = args[1];

    if (command === 'boot') {
      if (isBooted) return;
      createIframe(data || getSettings());
      isBooted = true;
    } else if (command === 'update') {
      var s = data || getSettings();
      var botId = s.bot_id || D.currentScript.getAttribute('data-bot-id');
      var hubId = s.hub_id || D.currentScript.getAttribute('data-hub-id');
      var visitorId = localStorage.getItem('manowar_chat_visitor_id');

      fetch(API_BASE_URL + '/api/widget/identity', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          botId: botId,
          hubId: hubId,
          providerId: s.provider_id,
          user_id: s.user_id,
          email: s.email,
          name: s.name,
          user_hash: s.user_hash,
          custom_attributes: s.custom_attributes,
          anonymousVisitorId: visitorId
        })
      }).then(function(res) { return res.json(); })
        .then(function(result) {
          var frame = D.getElementById('manowar-iframe');
          if (frame && frame.contentWindow) {
            frame.contentWindow.postMessage({ type: 'manowar-identity-update', identity: result }, '*');
          }
        });
    } else if (command === 'show') {
      var f = D.getElementById('manowar-iframe');
      if (f) f.style.display = 'block';
    } else if (command === 'hide') {
      var f = D.getElementById('manowar-iframe');
      if (f) f.style.display = 'none';
    } else if (command === 'shutdown') {
      var f = D.getElementById('manowar-iframe');
      if (f) f.parentNode.removeChild(f);
      isBooted = false;
    }
  };

  // 3. Replay Queue
  if (M.q && M.q.length > 0) {
    for (var i = 0; i < M.q.length; i++) {
      W.Manowar.apply(W, M.q[i]);
    }
  }

  // 4. Auto-boot if manowarSettings or script tags present
  if (W.manowarSettings) {
    W.Manowar('boot');
  } else if (D.currentScript.getAttribute('data-bot-id')) {
    W.Manowar('boot');
  }

  // Listen for close events from widget
  W.addEventListener('message', function(event) {
    if (event.data === 'close-manowar-chat') {
      W.Manowar('hide');
    }
  });

})();

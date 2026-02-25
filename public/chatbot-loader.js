
(function(W, D) {
  // CONFIGURATION
  var API_BASE_URL = 'https://manowar.cloud'; 
  var scriptEl = D.currentScript;
  var parentOrigin = W.location.origin;

  // Initialize the queue if it doesn't exist
  W.Manowar = W.Manowar || function() {
    (W.Manowar.q = W.Manowar.q || []).push(arguments);
  };

  var iframe = null;
  var isBooted = false;
  var anonymousVisitorId = localStorage.getItem('manowar_chat_visitor_id');

  if (!anonymousVisitorId) {
    anonymousVisitorId = 'v_' + Math.random().toString(36).substring(2, 15);
    localStorage.setItem('manowar_chat_visitor_id', anonymousVisitorId);
  }

  function createIframe(botId, hubId) {
    if (iframe) return;

    iframe = D.createElement('iframe');
    // Pass parent origin for postMessage validation inside the widget
    var src = API_BASE_URL + '/chatbot/' + hubId + '/' + botId + '?parent_origin=' + encodeURIComponent(parentOrigin);
    
    iframe.src = src;
    iframe.id = 'manowar-chat-widget';
    iframe.style.position = 'fixed';
    iframe.style.bottom = '20px';
    iframe.style.right = '20px';
    iframe.style.width = '380px';
    iframe.style.height = '600px';
    iframe.style.border = 'none';
    iframe.style.borderRadius = '16px';
    iframe.style.boxShadow = '0 10px 25px rgba(0,0,0,0.15)';
    iframe.style.zIndex = '999999';
    iframe.style.display = 'none'; // Hidden until 'show'
    iframe.style.transition = 'transform 0.3s ease, opacity 0.3s ease';
    
    D.body.appendChild(iframe);
  }

  function handleCommand(args) {
    var cmd = args[0];
    var params = args[1] || {};

    switch(cmd) {
      case 'boot':
        if (isBooted) return;
        var bId = params.bot_id || scriptEl.getAttribute('data-bot-id');
        var hId = params.hub_id || scriptEl.getAttribute('data-hub-id');
        if (!bId || !hId) return console.error('[Manowar] Missing bot_id or hub_id');
        
        createIframe(bId, hId);
        isBooted = true;

        if (params.user_id || params.email) {
          handleCommand(['update', params]);
        }
        break;

      case 'update':
        if (!isBooted) return;
        var botId = params.bot_id || scriptEl.getAttribute('data-bot-id');
        var hubId = params.hub_id || scriptEl.getAttribute('data-hub-id');

        fetch(API_BASE_URL + '/api/widget/identity', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            botId: botId,
            hubId: hubId,
            providerId: params.provider_id,
            user_id: params.user_id,
            user_hash: params.user_hash,
            email: params.email,
            name: params.name,
            anonymousVisitorId: anonymousVisitorId,
            custom_attributes: params.custom_attributes
          })
        })
        .then(function(r) { return r.json(); })
        .then(function(data) {
          if (data.contactId && iframe) {
            // Securely post to the iframe origin
            iframe.contentWindow.postMessage({
              type: 'manowar-identity-update',
              identity: data
            }, API_BASE_URL);
          }
        })
        .catch(function(e) { console.error('[Manowar] Identity failed', e); });
        break;

      case 'show':
        if (iframe) iframe.style.display = 'block';
        break;

      case 'hide':
        if (iframe) iframe.style.display = 'none';
        break;

      case 'shutdown':
        if (iframe) {
          D.body.removeChild(iframe);
          iframe = null;
          isBooted = false;
        }
        break;
    }
  }

  // Listen for messages from the widget
  W.addEventListener('message', function(event) {
    // SECURITY: Only trust messages from the Manowar origin
    if (event.origin !== API_BASE_URL) return;

    if (event.data === 'close-manowar-chat') {
      handleCommand(['hide']);
    }
  });

  // Replay queued commands
  if (W.Manowar && W.Manowar.q) {
    var q = W.Manowar.q;
    W.Manowar = handleCommand;
    for (var i = 0; i < q.length; i++) {
      handleCommand(q[i]);
    }
  } else {
    W.Manowar = handleCommand;
  }

  // Auto-boot if manowarSettings is present
  if (W.manowarSettings) {
    handleCommand(['boot', W.manowarSettings]);
  } else {
    // Or fallback to data attributes on the script tag
    var bId = scriptEl.getAttribute('data-bot-id');
    var hId = scriptEl.getAttribute('data-hub-id');
    if (bId && hId) {
      handleCommand(['boot', {}]);
    }
  }

})(window, document);

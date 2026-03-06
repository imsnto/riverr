
(function () {
  var MANOWAR_ORIGIN = window.location.origin; // In production this would be https://manowar.cloud
  
  if (window.Manowar) return;

  var script = document.currentScript;
  var botId = script.getAttribute('data-bot-id');
  var hubId = script.getAttribute('data-hub-id');
  var providerId = script.getAttribute('data-provider-id');

  var iframe = null;
  var iframeReady = false;
  var pendingUpdate = null;
  var hasIdentified = false;

  // Developer guidance warning
  if (providerId) {
    setTimeout(function () {
      if (!hasIdentified) {
        console.info(
          "[Manowar] Widget loaded anonymously. To identify logged-in users, call Manowar('update', { provider_id, user_id, email, name, user_hash }) after your auth state is available."
        );
      }
    }, 5000);
  }

  function sendToIframe(type, data) {
    if (iframe && iframe.contentWindow) {
      iframe.contentWindow.postMessage({ type: type, data: data }, '*');
    }
  }

  function init(settings) {
    if (iframe) return;
    
    var bId = (settings && settings.bot_id) || botId;
    var hId = (settings && settings.hub_id) || hubId;

    if (!bId || !hId) {
      console.warn('[Manowar] Cannot boot widget: Missing bot ID or Hub ID.');
      return;
    }
    
    iframe = document.createElement('iframe');
    iframe.src = MANOWAR_ORIGIN + '/chatbot/' + hId + '/' + bId;
    iframe.id = 'manowar-chatbot-iframe';
    
    // Style the iframe
    Object.assign(iframe.style, {
      position: 'fixed',
      bottom: '20px',
      right: '20px',
      width: '400px',
      height: '600px',
      border: 'none',
      zIndex: '999999',
      display: 'none',
      borderRadius: '16px',
      boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
      transition: 'transform 0.3s ease, opacity 0.3s ease'
    });

    document.body.appendChild(iframe);

    window.addEventListener('message', function (event) {
      // Basic security check for future proofing
      // if (event.origin !== MANOWAR_ORIGIN) return;

      if (event.data === 'close-manowar-chat') {
        iframe.style.display = 'none';
      }
      
      if (event.data && event.data.type === 'manowar-widget-ready') {
        iframeReady = true;
        
        // Complete the handshake
        event.source.postMessage({ type: 'manowar-parent-hello' }, '*');
        
        // Replay any pending identity update
        if (pendingUpdate) {
          sendToIframe('manowar-identity-payload', pendingUpdate);
          pendingUpdate = null;
        }
      }
    });
  }

  window.Manowar = function (cmd, data) {
    switch (cmd) {
      case 'boot':
        init(data);
        break;
      case 'update':
        hasIdentified = true;
        if (!iframeReady) {
          // Store only the latest update payload
          pendingUpdate = data;
        } else {
          sendToIframe('manowar-identity-payload', data);
        }
        break;
      case 'show':
        if (iframe) iframe.style.display = 'block';
        break;
      case 'hide':
        if (iframe) iframe.style.display = 'none';
        break;
      case 'shutdown':
        if (iframe) {
          iframe.remove();
          iframe = null;
          iframeReady = false;
        }
        break;
      default:
        console.warn('[Manowar] Unknown command: ' + cmd);
    }
  };

  // Auto-init if IDs are present on script tag
  if (botId && hubId) {
    init();
  }
})();

(function() {
  const script = document.currentScript;
  const botId = script.getAttribute('data-bot-id') || script.getAttribute('data-widget-id');
  const hubId = script.getAttribute('data-hub-id');

  if (!botId || !hubId) {
    console.error("Riverr Chat: 'data-bot-id' and 'data-hub-id' are required on the script tag.");
    return;
  }

  const iframe = document.createElement('iframe');
  const launcher = document.createElement('div');
  
  // Launcher Style
  Object.assign(launcher.style, {
    position: 'fixed',
    bottom: '20px',
    right: '20px',
    width: '60px',
    height: '60px',
    borderRadius: '50%',
    backgroundColor: '#3b82f6',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
    zIndex: '999998',
    transition: 'transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
  });
  
  launcher.innerHTML = `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>`;

  // Iframe Style
  Object.assign(iframe.style, {
    position: 'fixed',
    bottom: '90px',
    right: '20px',
    width: '400px',
    maxWidth: 'calc(100vw - 40px)',
    height: '600px',
    maxHeight: 'calc(100vh - 120px)',
    border: 'none',
    zIndex: '999999',
    borderRadius: '16px',
    boxShadow: '0 12px 24px rgba(0,0,0,0.15)',
    display: 'none',
    opacity: '0',
    transform: 'translateY(20px)',
    transition: 'all 0.3s ease'
  });

  const origin = window.location.origin;
  iframe.src = `https://manowar.cloud/chatbot/${hubId}/${botId}?parentOrigin=${encodeURIComponent(origin)}`;
  
  document.body.appendChild(launcher);
  document.body.appendChild(iframe);

  let isOpen = false;

  const toggle = () => {
    isOpen = !isOpen;
    if (isOpen) {
      iframe.style.display = 'block';
      setTimeout(() => {
        iframe.style.opacity = '1';
        iframe.style.transform = 'translateY(0)';
      }, 10);
      launcher.style.transform = 'rotate(-90deg) scale(0.8)';
      launcher.innerHTML = `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`;
    } else {
      iframe.style.opacity = '0';
      iframe.style.transform = 'translateY(20px)';
      setTimeout(() => {
        iframe.style.display = 'none';
      }, 300);
      launcher.style.transform = 'rotate(0deg) scale(1)';
      launcher.innerHTML = `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>`;
    }
  };

  launcher.onclick = toggle;

  window.addEventListener('message', (event) => {
    if (event.data === 'close-manowar-chat') {
      toggle();
    }
  });
})();
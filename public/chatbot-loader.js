
(function() {

  if (window.self !== window.top) {
    return;
  }

  if (document.getElementById('riverr-chat-widget-container')) {
    return;
  }
  
  var script = document.currentScript;

  // Read data attributes
  var botId = script.getAttribute('data-bot-id');
  var hubId = script.getAttribute('data-hub-id');
  if (!botId || !hubId) {
    console.error("Riverr Chat: botId and hubId are required in the config.");
    return;
  }

  // Create a container for the widget and button
  const container = document.createElement('div');
  container.id = 'riverr-chat-widget-container';
  container.style.position = 'fixed';
  container.style.bottom = '20px';
  container.style.right = '20px';
  container.style.zIndex = '9999';
  document.body.appendChild(container);

  // Create the iframe
  const iframe = document.createElement('iframe');
  iframe.id = 'riverr-chat-iframe';
  iframe.src = `https://studio--timeflow-6i3eo.us-central1.hosted.app/chatbot/${hubId}/${botId}`;
  iframe.style.width = '350px';
  iframe.style.height = 'calc(100vh - 120px)';
  iframe.style.maxHeight = '600px';
  iframe.style.border = 'none';
  iframe.style.borderRadius = '0.75rem';
  iframe.style.boxShadow = '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)';
  iframe.style.display = 'none'; // Initially hidden
  iframe.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
  iframe.style.opacity = '0';
  iframe.style.transform = 'translateY(20px)';
  container.appendChild(iframe);

  // Create the floating action button
  const fab = document.createElement('button');
  let fabGet = document.getElementById('riverr-chat-fab');
  fab.id = 'riverr-chat-fab';
  fab.style.width = '60px';
  fab.style.height = '60px';
  fab.style.borderRadius = '50%';
  fab.style.border = 'none';
  fab.style.cursor = 'pointer';
  fab.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)';
  fab.style.display = 'flex';
  fab.style.alignItems = 'center';
  fab.style.justifyContent = 'center';
  fab.innerHTML = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 2L14.5 9.5L22 12L14.5 14.5L12 22L9.5 14.5L2 12L9.5 9.5L12 2Z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  
  // We can't get the primary color here easily without another request.
  // So, for now, it's hardcoded. The user can ask to change it later.
  fab.style.backgroundColor = '#3b82f6';
  fab.style.color = 'white';
  
  if(!fabGet){
    container.appendChild(fab);
  }

  let isOpen = false;

  function toggleChat() {
    isOpen = !isOpen;
    if (isOpen) {
      iframe.style.display = 'block';
      setTimeout(() => {
        iframe.style.opacity = '1';
        iframe.style.transform = 'translateY(0)';
      }, 10);
      fab.innerHTML = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M18 6L6 18" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M6 6L18 18" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    } else {
      iframe.style.opacity = '0';
      iframe.style.transform = 'translateY(20px)';
      setTimeout(() => {
        iframe.style.display = 'none';
      }, 300);
      fab.innerHTML = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 2L14.5 9.5L22 12L14.5 14.5L12 22L9.5 14.5L2 12L9.5 9.5L12 2Z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    }
  }

  fab.addEventListener('click', toggleChat);
})();

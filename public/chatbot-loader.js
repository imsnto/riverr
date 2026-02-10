
(function() {
    'use strict';

    // Find the script tag and extract attributes
    const scriptTag = document.currentScript;
    if (!scriptTag) {
        console.error("Riverr Chat: Could not find script tag. Make sure to load this script with 'async' or 'defer'.");
        return;
    }

    const botId = scriptTag.getAttribute('data-bot-id');
    const hubId = scriptTag.getAttribute('data-hub-id');
    const scriptUrl = new URL(scriptTag.src);
    const origin = scriptUrl.origin;

    if (!botId || !hubId) {
        console.error("Riverr Chat: 'data-bot-id' or 'data-hub-id' not found on script tag.");
        return;
    }

    // --- Create DOM elements ---
    const launcher = document.createElement('button');
    const iframeContainer = document.createElement('div');
    const iframe = document.createElement('iframe');

    let isOpen = false;

    // --- Function to apply styles ---
    function applyStyles(chatBotColors) {
        // Launcher styles
        Object.assign(launcher.style, {
            position: 'fixed',
            bottom: '20px',
            right: '20px',
            width: '60px',
            height: '60px',
            borderRadius: '50%',
            backgroundColor: chatBotColors.chatbotIconsColor, // Default color
            color: chatBotColors.chatbotIconsTextColor,
            border: 'none',
            cursor: 'pointer',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: '99998',
            transition: 'transform 0.2s ease-in-out, background-color 0.2s',
        });
        launcher.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>`;
        launcher.setAttribute('aria-label', 'Open Chat');
        launcher.id = 'riverr-chat-launcher';


        // Iframe Container styles
        Object.assign(iframeContainer.style, {
            position: 'fixed',
            bottom: '90px',
            right: '20px',
            width: 'min(400px, calc(100vw - 40px))',
            height: 'min(70vh, 640px)',
            border: 'none',
            borderRadius: '16px',
            boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
            overflow: 'hidden',
            display: 'none',
            zIndex: '99999',
            transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            transform: 'translateY(20px)',
            opacity: '0',
        });
        iframeContainer.id = 'riverr-chat-container';

        // Iframe styles
        Object.assign(iframe.style, {
            width: '100%',
            height: '100%',
            border: 'none',
        });
        iframe.src = `${origin}/chatbot/${hubId}/${botId}`;
        iframe.setAttribute('allow', 'clipboard-write');
    }

    // --- Functionality ---
    function toggleChat() {
        isOpen = !isOpen;
        if (isOpen) {
            iframeContainer.style.display = 'block';
            const isMobile = window.innerWidth < 640;
            setTimeout(() => {
                iframeContainer.style.transform = 'translateY(0)';
                iframeContainer.style.opacity = '1';
                if(isMobile){
                    iframeContainer.style.width = '100vw';
                    iframeContainer.style.height = '100vh';
                    iframeContainer.style.bottom = '0';
                    iframeContainer.style.right = '0';
                    launcher.innerHTML = ``;
                } else {
                    iframeContainer.style.width = 'min(400px, calc(100vw - 40px))';
                    iframeContainer.style.height = 'min(70vh, 640px)';
                    iframeContainer.style.bottom = '90px';
                    iframeContainer.style.right = '20px';
                    launcher.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-chevron-down h-7 w-7"><path d="m6 9 6 6 6-6"></path></svg>`;
                }
                }, 10); // Short delay to allow display:block to take effect
        } else {
            iframeContainer.style.transform = 'translateY(20px)';
            iframeContainer.style.opacity = '0';
            launcher.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>`;
            setTimeout(() => {
                iframeContainer.style.display = 'none';
            }, 300); // Match transition duration
        }
    }

    // --- Initialization ---
    async function init() {
        // 1. Safety Guards (Iframe & Duplication)
        if (window.self !== window.top) return; 
        if (window.__RIVERR_CHAT_INITIALIZED__ || document.getElementById('riverr-chat-launcher')) return;
        window.__RIVERR_CHAT_INITIALIZED__ = true;
    
        try {
            // 2. Fetch Settings FIRST
            const response = await fetch(`${origin}/api/bot-settings?botId=${botId}`, {
                method: "GET",
                mode: "cors",
            });
            if (!response.ok) throw new Error('Settings fetch failed');
            const data = await response.json();
    
            // 3. Extract Dynamic Color
            const chatbotIconsColor = data.styleSettings?.chatbotIconsColor || '#ffffff';
            const chatbotIconsTextColor = data.styleSettings?.chatbotIconsTextColor || '#000000';
            const chatBotColors = {
                chatbotIconsColor,
                chatbotIconsTextColor
            }
    
            // 4. Apply styles AND THEN append to DOM
            applyStyles(chatBotColors); 
            
            iframeContainer.appendChild(iframe);
            document.body.appendChild(launcher);
            document.body.appendChild(iframeContainer);
    
            // 5. Attach Events
            launcher.addEventListener('click', toggleChat);
            window.addEventListener('message', (event) => {
                if (event.origin !== origin) return;
                if (event.data === 'close-riverr-chat' && isOpen) toggleChat();
            });
    
        } catch (error) {
            console.error("Riverr Chat failed to load:", error);
        }
    }
    
    // Wait for DOM to be ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();

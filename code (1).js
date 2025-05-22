document.addEventListener('DOMContentLoaded', () => {
    const startButton = document.getElementById('startButton');
    const statusDisplay = document.getElementById('status');
    const chatbox = document.getElementById('chatbox');

    // Check for browser support
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const speechSynthesis = window.speechSynthesis;

    if (!SpeechRecognition) {
        statusDisplay.textContent = 'Speech recognition not supported in this browser. Try Chrome or Edge.';
        statusDisplay.className = 'status-error';
        startButton.disabled = true;
        return;
    }

    if (!speechSynthesis) {
        statusDisplay.textContent = 'Speech synthesis not supported in this browser.';
        // We can still proceed with text-only interaction if synthesis is not available
        // but for this tool, it's a core feature.
        // You could add a flag to disable speaking if needed.
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = false; // Process single utterances
    recognition.lang = 'en-US';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    let conversationActive = false;

    const addMessageToChat = (text, sender) => {
        const messageDiv = document.createElement('div');
        messageDiv.classList.add('message', sender === 'user' ? 'user-message' : 'bot-message');
        
        // Sanitize text to prevent HTML injection if displaying user input directly
        const textNode = document.createTextNode(text);
        messageDiv.appendChild(textNode);
        
        chatbox.appendChild(messageDiv);
        chatbox.scrollTop = chatbox.scrollHeight; // Auto-scroll to bottom
    };

    const speakText = (text, onEndCallback) => {
        if (!speechSynthesis) {
            if (onEndCallback) onEndCallback();
            return;
        }
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'en-US';
        utterance.pitch = 1;
        utterance.rate = 1;
        
        // Optional: try to pick a good voice
        const voices = speechSynthesis.getVoices();
        let femaleVoice = voices.find(voice => voice.name.includes('Female') && voice.lang === 'en-US');
        if (!femaleVoice) {
            femaleVoice = voices.find(voice => voice.lang === 'en-US' && (voice.name.includes('Google') || voice.name.includes('Microsoft Zira') || voice.name.includes('Samantha')));
        }
        if (femaleVoice) {
            utterance.voice = femaleVoice;
        }

        utterance.onend = () => {
            if (onEndCallback) onEndCallback();
        };
        utterance.onerror = (event) => {
            console.error('SpeechSynthesis Error:', event);
            addMessageToChat(`Bot: Error synthesizing speech. ${event.error}`, 'bot');
            if (onEndCallback) onEndCallback(); // Ensure workflow continues
        };
        speechSynthesis.speak(utterance);
    };

    // Ensure voices are loaded (needed for some browsers)
    if (speechSynthesis && speechSynthesis.onvoiceschanged !== undefined) {
        speechSynthesis.onvoiceschanged = () => {
            // console.log("Voices loaded:", speechSynthesis.getVoices());
        };
    }


    const processUserInput = (text) => {
        let originalText = text;
        let correctedText = text;
        let responseText = "";
        let correctionMade = false;

        // Simple grammar corrections (case-insensitive using regex with 'i' flag)
        const corrections = {
            "i is": "I am",
            "he dont": "he doesn't",
            "she dont": "she doesn't",
            "they dont": "they don't",
            "we dont": "we don't",
            "you dont": "you don't",
            "i has": "I have",
            "he has go": "he has gone",
            "she have": "she has",
            "me want": "I want",
            "there is many": "there are many",
            "there are much": "there is much",
            "can i has": "can I have"
        };

        for (const wrong in corrections) {
            const regex = new RegExp(`\\b${wrong}\\b`, 'gi'); // \b for whole word, g for global, i for case-insensitive
            if (regex.test(correctedText)) {
                correctedText = correctedText.replace(regex, corrections[wrong]);
                correctionMade = true;
            }
        }
        
        // Predefined responses (case-insensitive)
        const lowerCaseText = correctedText.toLowerCase();

        if (lowerCaseText.includes("hello") || lowerCaseText.includes("hi")) {
            responseText = "Hello there! How are you today?";
        } else if (lowerCaseText.includes("how are you")) {
            responseText = "I'm doing well, thank you for asking! How can I help you practice?";
        } else if (lowerCaseText.includes("what is your name") || lowerCaseText.includes("who are you")) {
            responseText = "I am your friendly English practice bot. Let's talk!";
        } else if (lowerCaseText.includes("thank you") || lowerCaseText.includes("thanks")) {
            responseText = "You're welcome!";
        } else if (lowerCaseText.includes("bye") || lowerCaseText.includes("goodbye")) {
            responseText = "Goodbye! Practice again soon!";
            conversationActive = false; // Optionally end conversation on bye
        } else if (correctionMade) {
            responseText = `I think you meant: "${correctedText}". That's a great sentence! What else would you like to say?`;
        } else {
            responseText = `You said: "${correctedText}". That's interesting. Tell me more!`;
        }
        
        if (originalText.toLowerCase() !== correctedText.toLowerCase() && !responseText.includes("I think you meant")) {
             // If correction was made but not handled by a specific "I think you meant" response
             addMessageToChat(`Bot: (Correction: "${originalText}" -> "${correctedText}")`, 'bot');
        }

        addMessageToChat(`Bot: ${responseText}`, 'bot');
        speakText(responseText, () => {
            if (conversationActive) {
                startButton.disabled = false;
                statusDisplay.textContent = 'Status: Idle. Click "Start Talking" to speak again.';
                statusDisplay.className = 'status-idle';
            } else {
                statusDisplay.textContent = 'Status: Conversation ended. Refresh to start over or click to begin a new one.';
                statusDisplay.className = 'status-idle';
                startButton.disabled = false; // Allow restarting
            }
        });
    };

    startButton.addEventListener('click', () => {
        conversationActive = true; // Ensure conversation continues
        startButton.disabled = true;
        statusDisplay.textContent = 'Status: Listening...';
        statusDisplay.className = 'status-listening';
        try {
            recognition.start();
        } catch (e) {
            // Handle cases like "recognition already started"
            console.warn("Recognition start error:", e.message);
            // If it was already started and somehow button was re-enabled, just update status
            // Or, if it's a more severe error, show it.
            // For now, we assume this is rare with continuous=false and proper button disabling.
        }
    });

    recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        addMessageToChat(`You: ${transcript}`, 'user');
        statusDisplay.textContent = 'Status: Processing...';
        statusDisplay.className = 'status-processing';
        processUserInput(transcript);
    };

    recognition.onspeechend = () => {
        recognition.stop(); // Explicitly stop after speech if continuous was true, good practice anyway
        // statusDisplay.textContent = 'Status: Finished listening.';
        // statusDisplay.className = 'status-idle';
    };

    recognition.onerror = (event) => {
        let errorMessage = `Speech recognition error: ${event.error}`;
        if (event.error === 'no-speech') {
            errorMessage = "No speech detected. Please try speaking louder or closer to the microphone.";
        } else if (event.error === 'audio-capture') {
            errorMessage = "Audio capture error. Ensure your microphone is working and permissions are granted.";
        } else if (event.error === 'not-allowed') {
            errorMessage = "Microphone access denied. Please allow microphone access in your browser settings.";
        }
        
        addMessageToChat(`Bot: ${errorMessage}`, 'bot');
        speakText(errorMessage, () => {
            startButton.disabled = false;
            statusDisplay.textContent = 'Status: Idle. Try again.';
            statusDisplay.className = 'status-error';
        });
    };
    
    recognition.onend = () => {
        // This event fires after recognition stops, regardless of success or error.
        // If we are not in an active processing state (i.e., bot is not about to speak),
        // re-enable the button. This is mostly handled by the speakText callback now.
        // console.log("Recognition ended.");
        // If the bot isn't scheduled to speak (e.g., an error occurred before processing)
        // and conversation is active, ensure button is enabled.
        if (conversationActive && statusDisplay.className !== 'status-processing') {
            startButton.disabled = false;
            if (statusDisplay.className !== 'status-error' && statusDisplay.className !== 'status-listening') {
                 statusDisplay.textContent = 'Status: Idle. Click "Start Talking" to speak again.';
                 statusDisplay.className = 'status-idle';
            }
        }
    };

    // Initial welcome message
    const welcomeMessage = "Welcome to the English Speaking Practice tool! Click 'Start Talking' to begin.";
    addMessageToChat(`Bot: ${welcomeMessage}`, 'bot');
    speakText(welcomeMessage);
});
// Remove the hard-coded API key
// const GEMINI_API_KEY = "AIzaSyDwVpvo9dl847OtQbHu_ZEfk_wDLuLOBXA"; 

let eventObject;

// Function to check if API key exists in local storage
async function checkApiKey() {
    return new Promise((resolve) => {
        chrome.storage.local.get("geminiApiKey", (data) => {
            resolve(data.geminiApiKey || null);
        });
    });
}

// Function to prompt user for API key
function promptForApiKey() {
    const eventDetailsDiv = document.getElementById("eventDetails");
    const loadingDiv = document.getElementById("loading");
    
    loadingDiv.style.display = "none";
    
    eventDetailsDiv.innerHTML = `
        <div class="api-key-form">
            <h3>API Key Required</h3>
            <p>Please enter your Gemini API key to continue:</p>
            <input type="text" id="apiKeyInput" placeholder="Enter your Gemini API key" class="api-key-input">
            <p class="api-key-info">You can get an API key from <a href="https://ai.google.dev/" target="_blank">Google AI Developer Platform</a></p>
            <button id="saveApiKeyBtn" class="primary-button">Save Key</button>
        </div>
    `;
    
    eventDetailsDiv.style.display = "block";
    
    document.getElementById("saveApiKeyBtn").addEventListener("click", () => {
        const apiKey = document.getElementById("apiKeyInput").value.trim();
        if (apiKey) {
            chrome.storage.local.set({ "geminiApiKey": apiKey }, () => {
                console.log("API key saved");
                location.reload(); // Reload to continue with the saved API key
            });
        } else {
            alert("Please enter a valid API key");
        }
    });
}

// Modified fetchEventDetails function to use API key from storage
async function fetchEventDetails(selectedText) {
    try {
        const apiKey = await checkApiKey();
        if (!apiKey) {
            throw new Error("No API key found");
        }
        
        const response = await fetch(`https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                contents: [{
                    parts: [{
                        text: `Extract event details from this text and keep the time in 24 hours format. Make a title which is suitable and short:
                        """${selectedText}"""

                        Expected format:
                        Title: <Extracted Event Title>
                        Date: <YYYY-MM-DD>
                        Start Time: <HH:MM>
                        End Time: <HH:MM or empty if not provided>
                        Location: <Extracted Location or empty if not provided>
                        Description: <Short event summary>

                        Example Output:
                        Title: AI Workshop
                        Date: 2024-11-22
                        Start Time: 10:00
                        End Time: 13:00
                        Location: College Auditorium
                        Description: Workshop on AI advancements.
                        `
                    }]
                }]
            })
        });

        const result = await response.json();
        console.log("Gemini API Response:", result);

        if (!result || !result.candidates || result.candidates.length === 0) {
            throw new Error("No event details extracted.");
        }

        return result.candidates[0].content.parts[0].text.trim();
    } catch (error) {
        console.error("Error fetching Gemini API:", error);
        return null;
    }
}

// Modified askMissingDetails function to use API key from storage
async function askMissingDetails(missingFields) {
    console.log("Fetching MCQs for missing fields:", missingFields);

    // Get the original selected text for context
    const { selectedText } = await new Promise(resolve => {
        chrome.storage.local.get("selectedText", (data) => {
            resolve(data);
        });
    });

    try {
        const apiKey = await checkApiKey();
        if (!apiKey) {
            throw new Error("No API key found");
        }
        
        const response = await fetch(`https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                contents: [{
                    parts: [{
                        text: `Based on this original text:
                        """${selectedText}"""
                        
                        Generate multiple-choice questions (MCQs) to fill missing event details.
                        The missing fields are: ${missingFields.join(", ")}
                        
                        Make intelligent guesses based on the context of the original text.
                        For time-related fields, offer reasonable time options based on context clues.
                        For location fields, suggest plausible locations based on any context.
                        
                        Return ONLY valid JSON in this format:
                        [
                            {
                                "field": "startTime",
                                "question": "What is the start time?",
                                "options": ["6 PM", "7 PM", "8 PM", "Other"]
                            },
                            {
                                "field": "location",
                                "question": "Where is the event?",
                                "options": ["Community Hall", "Grand Hotel", "Park", "Other"]
                            }
                        ]`
                    }]
                }]
            })
        });

        const result = await response.json();
        console.log("MCQ API Response:", result);

        if (!result || !result.candidates || result.candidates.length === 0) {
            throw new Error("No MCQs generated.");
        }

        let mcqText = result.candidates[0].content.parts[0].text.trim();
        mcqText = mcqText.replace(/```json|```/g, "").trim();

        return JSON.parse(mcqText);
    } catch (error) {
        console.error("Error fetching Gemini API for MCQ:", error);
        return [];
    }
}

// Modified DOMContentLoaded event listener
document.addEventListener("DOMContentLoaded", async () => {
    console.log("Popup.js loaded");

    const eventDetailsDiv = document.getElementById("eventDetails");
    const loadingDiv = document.getElementById("loading"); 
    const addToCalendarBtn = document.getElementById("addToCalendarBtn");
    
    loadingDiv.style.display = "block";
    eventDetailsDiv.style.display = "none";

    // Check if API key exists
    const apiKey = await checkApiKey();
    if (!apiKey) {
        promptForApiKey();
        return;
    }

    // Initialize Add to Calendar button
    addToCalendarBtn.addEventListener("click", async () => {
        if (eventObject) {
            console.log("Adding to calendar:", eventObject);
            try {
                await createCalendarEvent(eventObject);
            } catch (error) {
                console.error("Error adding event to calendar:", error);
                showNotification("Error", "Failed to add event to calendar. Please try again.");
            }
        } else {
            console.error("Event object is not defined.");
            alert("No event details found. Please extract event details first.");
        }
    });

    // Process selected text
    chrome.storage.local.get("selectedText", async (data) => {
        console.log("Selected text:", data.selectedText);

        if (data.selectedText) {
            try {
                const extractedText = await fetchEventDetails(data.selectedText);
                if (!extractedText) throw new Error("No event details extracted.");

                eventObject = parseEventDetails(extractedText);
                console.log("Parsed Event Object:", eventObject);
                let missingFields = Object.keys(eventObject).filter(key => !eventObject[key]);

                loadingDiv.style.display = "none";
                eventDetailsDiv.style.display = "block";

                if (missingFields.length > 0) {
                    const mcqs = await askMissingDetails(missingFields);
                    displayMCQs(mcqs, eventObject);
                } else {
                    displayEventDetails(eventObject);
                }

            } catch (error) {
                console.error("Error:", error);
                loadingDiv.style.display = "none";
                eventDetailsDiv.style.display = "block";
                if (error.message === "No API key found") {
                    promptForApiKey();
                } else {
                    eventDetailsDiv.innerText = "Error fetching event details.";
                }
            }
        } else {
            loadingDiv.style.display = "none";
            eventDetailsDiv.style.display = "block";
            eventDetailsDiv.innerText = "No event details found.";
        }
    });

    function resizePopup() {
        let width = 420; 
        let height = Math.max(document.body.scrollHeight, 300); 

        chrome.runtime.getPlatformInfo(() => {
            window.resizeTo(width, height);
        });
    }
    setTimeout(resizePopup, 100);
});

// Add API key management UI
function addApiKeyManagementUI() {
    const apiKeySettingsBtn = document.createElement("button");
    apiKeySettingsBtn.id = "apiKeySettingsBtn";
    apiKeySettingsBtn.innerText = "⚙️ API Settings";
    apiKeySettingsBtn.classList.add("settings-button");
    apiKeySettingsBtn.addEventListener("click", async () => {
        const apiKey = await checkApiKey();
        
        const settingsDiv = document.getElementById("eventDetails");
        settingsDiv.innerHTML = `
            <div class="api-key-form">
                <h3>API Key Settings</h3>
                <input type="text" id="apiKeyInput" placeholder="Enter your Gemini API key" class="api-key-input" value="${apiKey || ''}">
                <p class="api-key-info">You can get an API key from <a href="https://ai.google.dev/" target="_blank">Google AI Developer Platform</a></p>
                <div class="button-row">
                    <button id="saveApiKeyBtn" class="primary-button">Save Key</button>
                    <button id="backBtn" class="secondary-button">Back</button>
                </div>
            </div>
        `;
        
        document.getElementById("saveApiKeyBtn").addEventListener("click", () => {
            const newApiKey = document.getElementById("apiKeyInput").value.trim();
            if (newApiKey) {
                chrome.storage.local.set({ "geminiApiKey": newApiKey }, () => {
                    console.log("API key saved");
                    location.reload();
                });
            } else {
                alert("Please enter a valid API key");
            }
        });
        
        document.getElementById("backBtn").addEventListener("click", () => {
            location.reload();
        });
    });
    
    document.body.appendChild(apiKeySettingsBtn);
}

// Add this to DOMContentLoaded callback
document.addEventListener("DOMContentLoaded", () => {
    console.log("Popup.js loaded");

    const eventDetailsDiv = document.getElementById("eventDetails");
    const loadingDiv = document.getElementById("loading"); 
    const addToCalendarBtn = document.getElementById("addToCalendarBtn");
    
    loadingDiv.style.display = "block";
    eventDetailsDiv.style.display = "none";

    // Initialize Add to Calendar button
    addToCalendarBtn.addEventListener("click", async () => {
        if (eventObject) {
            console.log("Adding to calendar:", eventObject);
            try {
                await createCalendarEvent(eventObject);
            } catch (error) {
                console.error("Error adding event to calendar:", error);
                showNotification("Error", "Failed to add event to calendar. Please try again.");
            }
        } else {
            console.error("Event object is not defined.");
            alert("No event details found. Please extract event details first.");
        }
    });

    // Process selected text
    chrome.storage.local.get("selectedText", async (data) => {
        console.log("Selected text:", data.selectedText);

        if (data.selectedText) {
            try {
                const extractedText = await fetchEventDetails(data.selectedText);
                if (!extractedText) throw new Error("No event details extracted.");

                eventObject = parseEventDetails(extractedText);
                console.log("Parsed Event Object:", eventObject);
                let missingFields = Object.keys(eventObject).filter(key => !eventObject[key]);

                loadingDiv.style.display = "none";
                eventDetailsDiv.style.display = "block";

                if (missingFields.length > 0) {
                    const mcqs = await askMissingDetails(missingFields);
                    displayMCQs(mcqs, eventObject);
                } else {
                    displayEventDetails(eventObject);
                }

            } catch (error) {
                console.error("Error:", error);
                loadingDiv.style.display = "none";
                eventDetailsDiv.style.display = "block";
                eventDetailsDiv.innerText = "Error fetching event details.";
            }
        } else {
            loadingDiv.style.display = "none";
            eventDetailsDiv.style.display = "block";
            eventDetailsDiv.innerText = "No event details found.";
        }
    });

    function resizePopup() {
        let width = 420; 
        let height = Math.max(document.body.scrollHeight, 300); 

        chrome.runtime.getPlatformInfo(() => {
            window.resizeTo(width, height);
        });
    }
    setTimeout(resizePopup, 100);
    addApiKeyManagementUI();
});
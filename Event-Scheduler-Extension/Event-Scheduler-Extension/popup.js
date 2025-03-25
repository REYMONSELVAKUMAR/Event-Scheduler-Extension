let eventObject;

async function checkApiKey() {
    return new Promise((resolve) => {
        chrome.storage.local.get("geminiApiKey", (data) => {
            resolve(data.geminiApiKey || null);
        });
    });
}

function promptForApiKey() {
    const eventDetailsDiv = document.getElementById("eventDetails");
    const loadingDiv = document.getElementById("loading");
    
    loadingDiv.style.display = "none";
    
    eventDetailsDiv.innerHTML = `
        <div class="api-key-form">
            <h3>API Key Required</h3>
            <p>Please enter your Gemini API key to continue:</p>
            <input type="text" id="apiKeyInput" placeholder="Enter your Gemini API key" class="api-key-input">
            <p class="api-key-info">You can get an API key from <a href="https://aistudio.google.com/app/apikey" target="_blank">Google AI Developer Platform</a></p>
            <button id="saveApiKeyBtn" class="primary-button">Save Key</button>
        </div>
    `;
    
    eventDetailsDiv.style.display = "block";
    
    // Add event listener after the element is in the DOM
    setTimeout(() => {
        const saveButton = document.getElementById("saveApiKeyBtn");
        if (saveButton) {
            saveButton.addEventListener("click", () => {
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
    }, 100);
}

document.addEventListener("DOMContentLoaded", async () => {
    console.log("Popup.js loaded");

    const eventDetailsDiv = document.getElementById("eventDetails");
    const loadingDiv = document.getElementById("loading"); 
    const addToCalendarBtn = document.getElementById("addToCalendarBtn");
    const popupBody = document.body;
    
    loadingDiv.style.display = "block";
    eventDetailsDiv.style.display = "none";

    // Fix: Added await to properly check the API key
    const apiKey = await checkApiKey();
    if (!apiKey) {
        promptForApiKey();
        return;
    }

    // Initialize Add to Calendar button - using a single listener
    if (addToCalendarBtn) {
        addToCalendarBtn.addEventListener("click", async () => {
            if (eventObject) {
                console.log("Adding to calendar:", eventObject);

                // Replace the entire popup with the loader and resize it
                popupBody.innerHTML = `
                    <div id="calendarLoading" style="
                        width: 100%;
                        height: 100px;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        background: white;
                    ">
                        <img src="loader2.gif" alt="Loading..." style="width: 80px; height: 80px;">
                    </div>
                `;

                resizePopup(150, 200); 

                try {
                    await createCalendarEvent(eventObject);
                    setTimeout(() => {
                        window.close();
                    }, 2000);

                } catch (error) {
                    console.error("Error adding event to calendar:", error);
                    showNotification("Error", "Failed to add event to calendar. Please try again.");
                    
                    // Close popup after a short delay
                    setTimeout(() => {
                        window.close();
                    }, 1500);
                }

            } else {
                console.error("Event object is not defined.");
                alert("No event details found. Please extract event details first.");
            }
        });
    }

    // Process selected text
    chrome.storage.local.get("selectedText", async (data) => {
        console.log("Selected text:", data.selectedText);

        if (data.selectedText) {
            try {
                const extractedText = await fetchEventDetails(data.selectedText);
                if (!extractedText) throw new Error("No event details extracted.");

                eventObject = parseEventDetails(extractedText);
                console.log("Parsed Event Object:", eventObject);
                
                // Validate event object data
                validateEventObject(eventObject);
                
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
                eventDetailsDiv.innerHTML = `<p>Error fetching event details: ${error.message}</p>`;
            }
        } else {
            loadingDiv.style.display = "none";
            eventDetailsDiv.style.display = "block";
            eventDetailsDiv.innerHTML = "<p>No event details found.</p>";
        }
    });

    function resizePopup(width = 420, height = 300) {
        chrome.runtime.getPlatformInfo(() => {
            window.resizeTo(width, height);
        });
    }

    setTimeout(resizePopup, 100);
    addApiKeyManagementUI();
});



// Function to validate event object data
function validateEventObject(eventObj) {
    // Validate date format (YYYY-MM-DD)
    if (eventObj.date) {
        const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
        if (!dateRegex.test(eventObj.date)) {
            eventObj.date = formatDate(eventObj.date);
        }
    }
    
    // Validate time formats (HH:MM)
    if (eventObj.startTime) {
        const timeRegex = /^\d{2}:\d{2}$/;
        if (!timeRegex.test(eventObj.startTime)) {
            eventObj.startTime = formatTime(eventObj.startTime);
        }
    }
    
    if (eventObj.endTime) {
        const timeRegex = /^\d{2}:\d{2}$/;
        if (!timeRegex.test(eventObj.endTime)) {
            eventObj.endTime = formatTime(eventObj.endTime);
        }
    }
    
    return eventObj;
}

// Helper function to format date
function formatDate(dateStr) {
    try {
        // Try to parse the date string
        const date = new Date(dateStr);
        if (isNaN(date.getTime())) {
            // If invalid, return today's date
            const today = new Date();
            return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
        }
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    } catch (e) {
        // On error, return today's date
        const today = new Date();
        return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    }
}

// Helper function to format time
function formatTime(timeStr) {
    const timeRegex = /(\d{1,2}):?(\d{2})?\s*(am|pm)?/i;
    const match = timeStr.match(timeRegex);
    
    if (!match) return "12:00"; // Default time
    
    let hours = parseInt(match[1], 10);
    let minutes = match[2] ? parseInt(match[2], 10) : 0;
    let period = match[3] ? match[3].toLowerCase() : null;
    
    // Convert to 24-hour format if AM/PM is specified
    if (period === "pm" && hours < 12) hours += 12;
    if (period === "am" && hours === 12) hours = 0;
    
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

function addApiKeyManagementUI() {
    const apiKeySettingsBtn = document.createElement("button");
    apiKeySettingsBtn.id = "apiKeySettingsBtn";
    apiKeySettingsBtn.innerHTML = "⚙️"; // Gear icon
    apiKeySettingsBtn.title = "API Settings";
    apiKeySettingsBtn.classList.add("settings-button");
    apiKeySettingsBtn.addEventListener("click", async () => {
        const apiKey = await checkApiKey();
        
        const settingsDiv = document.getElementById("eventDetails");
        if (!settingsDiv) return;
        
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
        
        // Add event listeners after the elements are in the DOM
        setTimeout(() => {
            const saveBtn = document.getElementById("saveApiKeyBtn");
            const backBtn = document.getElementById("backBtn");
            
            if (saveBtn) {
                saveBtn.addEventListener("click", () => {
                    const newApiKey = document.getElementById("apiKeyInput").value.trim();
                    if (newApiKey) {
                        chrome.storage.local.set({ "geminiApiKey": newApiKey }, () => {
                            console.log("API key saved");
                            location.reload();
                        });
                    } else {
                        const inputEl = document.getElementById("apiKeyInput");
                        inputEl.classList.add("input-error");
                        
                        // Create error message if it doesn't exist
                        let errorEl = document.querySelector(".api-key-form .error-message");
                        if (!errorEl) {
                            errorEl = document.createElement("span");
                            errorEl.classList.add("error-message");
                            inputEl.parentNode.insertBefore(errorEl, inputEl.nextSibling);
                        }
                        
                        errorEl.textContent = "⚠️ Please enter a valid API key";
                    }
                });
            }
            
            if (backBtn) {
                backBtn.addEventListener("click", () => {
                    location.reload();
                });
            }
        }, 100);
    });
    
    document.body.appendChild(apiKeySettingsBtn);
}



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
        throw error;
    }
}

function parseEventDetails(text) {
    const extractValue = (regex) => {
        const match = text.match(regex);
        return match ? match[1].trim() : "";
    };

    let startTime = extractValue(/Start Time:\s*(\d{2}:\d{2})/);
    let endTime = extractValue(/End Time:\s*(\d{2}:\d{2})/);
    startTime = (startTime === "00:00") ? "" : startTime;
    endTime = (endTime === "00:00") ? "" : endTime;

    return {
        title: extractValue(/Title:\s*(.*?)(?=\n|$)/),
        date: extractValue(/Date:\s*(\d{4}-\d{2}-\d{2})/),
        startTime: startTime,
        endTime: endTime,
        location: extractValue(/Location:\s*(.*?)(?=\n|$)/),
        description: extractValue(/Description:\s*(.*)(?=\n|$)/)
    };
}

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

function validateAndFormatTime(input, isEndTime, otherTime) {
    input = input.trim().toLowerCase();

    // More comprehensive time regex to catch more formats
    const timeRegex = /^(\d{1,2})(?::(\d{1,2}))?\s*(am|pm)?$/;
    const match = input.match(timeRegex);

    if (!match) return null; // Invalid input

    let hours = parseInt(match[1], 10);
    let minutes = match[2] ? parseInt(match[2], 10) : 0;
    let period = match[3];

    // Validate hours and minutes
    if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;

    // If hours is 1-12 and no period specified, determine AM/PM
    if (hours <= 12 && !period) {
        if (otherTime) {
            // Try to determine AM/PM based on the other time
            let otherHours = parseInt(otherTime.split(":")[0], 10);
           
            if (isEndTime && hours < otherHours % 12) {
                // If this is end time and hours are less than start time hours, assume PM
                period = "pm";
            } else if (!isEndTime && otherHours >= 12 && hours > otherHours % 12) {
                // If this is start time and hours are greater than end time hours, assume AM
                period = "am";
            } else {
                // Use the same period as the other time
                period = otherHours >= 12 ? "pm" : "am";
            }
        } else {
            // Default assumption: 7AM-7PM are likely AM, 7PM-7AM are likely PM
            period = (hours >= 7 && hours < 12) ? "am" : "pm";
        }
    }

    // Convert to 24-hour format
    if (period === "pm" && hours !== 12) hours += 12;
    if (period === "am" && hours === 12) hours = 0;

    return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}`;
}

function handleUserInput(field, value, div, question, eventObject) {
    // Store references to elements that will be modified
    const currentDiv = div;
    
    if (value !== "Other") {
        eventObject[field] = value;
        currentDiv.innerHTML = `<p><strong>${question}</strong> ${eventObject[field]}</p>`;
        checkAllFieldsFilled(eventObject);
        return;
    }

    // Clear current div content
    currentDiv.innerHTML = '';
    
    // Create container for input and error message
    const inputContainer = document.createElement("div");
    inputContainer.classList.add("input-container");
    
    // Create question text
    const questionText = document.createElement("p");
    questionText.innerHTML = `<strong>${question}</strong>`;
    inputContainer.appendChild(questionText);
    
    // Create input field
    const input = document.createElement("input");
    input.type = "text";
    
    // Set appropriate placeholder based on field type
    if (field === "startTime" || field === "endTime") {
        input.placeholder = "Format: HH:MM AM/PM";
    } else if (field === "date") {
        input.placeholder = "Format: YYYY-MM-DD";
    } else {
        input.placeholder = `Enter ${field}..`;
    }
    
    input.classList.add("option-input");
    inputContainer.appendChild(input);
    
    // Create error message element (hidden by default)
    const errorMessage = document.createElement("span");
    errorMessage.classList.add("error-message");
    errorMessage.style.display = "none";
    inputContainer.appendChild(errorMessage);
    
    // Add input container to div
    currentDiv.appendChild(inputContainer);
    
    // Focus on the input field
    input.focus();

    // Create a local function to handle input processing
    function processInputValue() {
        let userInput = input.value.trim();
        
        if (!userInput) {
            showError(`Please enter a valid ${field}.`);
            return false;
        }

        // Handle time-specific fields
        if (field === "startTime" || field === "endTime") {
            let referenceTime = field === "startTime" ? eventObject.endTime : eventObject.startTime;
            let validTime = validateAndFormatTime(userInput, field === "endTime", referenceTime);

            if (!validTime) {
                showError(`Invalid time format Use HH:MM AM/PM.`);
                return false;
            }
            
            eventObject[field] = validTime;
        } 
        // Handle date field
        else if (field === "date") {
            const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
            if (!dateRegex.test(userInput)) {
                const formattedDate = formatDate(userInput);
                if (formattedDate) {
                    eventObject[field] = formattedDate;
                } else {
                    showError(`Invalid date format.Use YYYY-MM-DD.`);
                    return false;
                }
            } else {
                eventObject[field] = userInput;
            }
        } 
        // Handle other fields
        else {
            eventObject[field] = userInput;
        }

        // Check if the element still exists in the DOM before updating
        if (currentDiv && currentDiv.isConnected) {
            currentDiv.innerHTML = `<p><strong>${question}</strong> ${eventObject[field]}</p>`;
            checkAllFieldsFilled(eventObject);
        }
        
        return true;
    }
    
    // Function to show error message
    function showError(message) {
        errorMessage.textContent = message;
        errorMessage.style.display = "block";
        input.classList.add("input-error");
    }
    
    // Function to hide error message
    function hideError() {
        errorMessage.style.display = "none";
        input.classList.remove("input-error");
    }

    // Handle input events
    input.addEventListener("input", () => {
        hideError();
    });
    
    // Handle blur event with a cleanup mechanism
    input.addEventListener("blur", () => {
        // Use setTimeout to allow other events to process first
        setTimeout(() => {
            if (input && input.isConnected) {
                processInputValue();
            }
        }, 100);
    });
    
    // Handle enter key press
    input.addEventListener("keypress", (e) => {
        if (e.key === "Enter") {
            e.preventDefault();
            processInputValue();
        }
    });
}

function displayMCQs(mcqs, eventObject) {
    const eventDetailsDiv = document.getElementById("eventDetails");
    if (!eventDetailsDiv) return;
    
    eventDetailsDiv.innerHTML = "<h3>Fill Missing Event Details:</h3>";

    mcqs.forEach(mcq => {
        const div = document.createElement("div");
        div.innerHTML = `<p><strong>${mcq.question}</strong></p>`;

        mcq.options.forEach(option => {
            const button = document.createElement("button");
            button.innerText = option;
            button.classList.add("option-button");
            button.onclick = () => handleUserInput(mcq.field, option, div, mcq.question, eventObject);
            div.appendChild(button);
        });

        if (!mcq.options.includes("Other")) {
            const otherButton = document.createElement("button");
            otherButton.innerText = "Other";
            otherButton.classList.add("option-button");
            otherButton.onclick = () => handleUserInput(mcq.field, "Other", div, mcq.question, eventObject);
            div.appendChild(otherButton);
        }

        eventDetailsDiv.appendChild(div);
    });
}

function checkAllFieldsFilled(eventObject) {
    // Add validation before checking
    validateEventObject(eventObject);
    
    if (Object.values(eventObject).every(val => val)) {
        displayEventDetails(eventObject);
    }
}

function displayEventDetails(eventObject) {
    const eventDetailsDiv = document.getElementById("eventDetails");
    if (!eventDetailsDiv) return;
    
    eventDetailsDiv.innerHTML = `
        <h3>Event Details:</h3>
        <p><strong>Title:</strong> ${eventObject.title || "Untitled Event"}</p>
        <p><strong>Date:</strong> ${eventObject.date}</p>
        <p><strong>Start Time:</strong> ${eventObject.startTime || "Not specified"}</p>
        <p><strong>End Time:</strong> ${eventObject.endTime || "Not specified"}</p>
        <p><strong>Location:</strong> ${eventObject.location || "Not specified"}</p>
        <p><strong>Description:</strong> ${eventObject.description || "No description"}</p>
    `;
    
    // Show the button only if it exists
    const addToCalendarBtn = document.getElementById("addToCalendarBtn");
    if (addToCalendarBtn) {
        addToCalendarBtn.style.display = "block";
    }
}

async function getAuthToken() {
    return new Promise((resolve, reject) => {
        chrome.identity.getAuthToken({ interactive: true }, (token) => {
            if (chrome.runtime.lastError) {
                console.error("Auth Error:", chrome.runtime.lastError);
                reject(chrome.runtime.lastError);
            } else {
                console.log("Token received:", token);
                resolve(token);
            }
        });
    });
}

function formatToISO(date, time) {
    // Validate date format
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        date = formatDate(date);
    }
    
    // Validate time format
    if (time && !/^\d{2}:\d{2}$/.test(time)) {
        time = formatTime(time);
    }
    
    return time ? `${date}T${time}:00+05:30` : `${date}T00:00:00+05:30`;
}

async function createCalendarEvent(event) {
    try {
        // Add validation for all fields before creating an event
        validateEventObject(event);
        
        let token = await getAuthToken();

        // Ensure we have a title
        if (!event.title) {
            event.title = "Untitled Event";
        }
        
        // Ensure we have a valid date
        if (!event.date || !/^\d{4}-\d{2}-\d{2}$/.test(event.date)) {
            event.date = formatDate(event.date);
        }

        // Fallback to all-day event if no times provided
        const useDateTime = event.startTime && event.endTime;
        
        let eventData = {
            summary: event.title,
            location: event.location || "",
            description: event.description ? event.description.replace(/\.\s+/g, ".\n") : "",
        };
        
        console.log("Creating event with data (before formatting):", eventData);
        
        // Handle both timed events and all-day events
        if (useDateTime) {
            eventData.start = { 
                dateTime: formatToISO(event.date, event.startTime),
                timeZone: "Asia/Kolkata" 
            };
            eventData.end = { 
                dateTime: formatToISO(event.date, event.endTime),
                timeZone: "Asia/Kolkata" 
            };
        } else {
            eventData.start = { 
                date: event.date
            };
            eventData.end = { 
                date: event.date
            };
        }

        console.log("Creating event with data (after formatting):", eventData);

        let response = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
            method: 'POST',
            headers: {
                'Authorization': 'Bearer ' + token,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(eventData)
        });

        let data = await response.json();
        console.log("API Response:", data);
        
        if (response.ok) {
            console.log("Event Created:", data);
            showNotification("Success", "Event Added to Google Calendar!");
            
            // Store in local storage as well for backup
            chrome.storage.local.set({ lastAddedEvent: event }, () => {
                console.log("Event stored in local storage");
            });
            
            return data;
        } else {
            console.error("Error Creating Event:", data);
            let errorMessage = data.error ? data.error.message : "Unknown error";
            showNotification("Error", "Failed to add event: " + errorMessage);
            throw new Error("Failed to add event: " + errorMessage);
        }
    } catch (error) {
        console.error("Calendar API Error:", error);
        showNotification("Error", error.message || "Failed to add event to calendar");
        throw error;
    }
}

function showNotification(title, message) {
    chrome.notifications.create({
        type: "basic",
        iconUrl: "icon48.png",
        title: title,
        message: message
    });
}
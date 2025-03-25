chrome.runtime.onInstalled.addListener(() => {
    updateContextMenu();
});

// Function to update the context menu
function updateContextMenu() {
    chrome.contextMenus.removeAll(() => {
        chrome.contextMenus.create({
            id: "scheduleEvent",
            title: "Schedule Event",
            contexts: ["selection"], 
        });
    });
}

chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId === "scheduleEvent" && info.selectionText) {
        console.log("Selected Text:", info.selectionText);

        // Store selected text in chrome local storage
        chrome.storage.local.set({ selectedText: info.selectionText }, () => {
            if (chrome.runtime.lastError) {
                console.error("Error saving selected text:", chrome.runtime.lastError);
            } else {
                console.log("Selected text saved:", info.selectionText);
                
                // Open the popup after saving the selected text
                chrome.action.openPopup();
            }
        });
    }
});

// Listen for messages from popup.js
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "getSelectedText") {
        chrome.storage.local.get("selectedText", (data) => {
            sendResponse({ selectedText: data.selectedText });
        });
        return true; // Indicates async response
    }
});
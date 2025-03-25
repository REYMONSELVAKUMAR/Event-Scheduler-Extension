
document.addEventListener("DOMContentLoaded", () => {
    chrome.storage.local.get("selectedText", (data) => {
        if (data.selectedText) {
            document.getElementById("eventDetails").innerText = data.selectedText;
        }
    });
});

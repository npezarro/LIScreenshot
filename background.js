// LinkedIn Puzzle Screenshot Tool - Background Script

// Listen for messages from content script
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  if (request.action === 'downloadScreenshot') {
    chrome.downloads.download({
      url: request.dataUrl,
      filename: request.filename,
      saveAs: false
    });
  }
});

// Listen for installation
chrome.runtime.onInstalled.addListener(function(details) {
  if (details.reason === 'install') {
    // Open options page on install
    chrome.tabs.create({ url: 'popup.html' });
  }
});

// Handle extension icon click
chrome.action.onClicked.addListener(function(tab) {
  // Open the popup
  chrome.action.openPopup();
});
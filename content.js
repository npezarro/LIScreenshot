// LinkedIn Puzzle Screenshot Tool - Content Script

// Listen for messages from the popup
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  if (request.action === 'captureScreenshot') {
    captureScreenshot(request.puzzleData, request.autoMode, sendResponse);
    return true; // Required for async response
  }
});

/**
 * Capture screenshot with data overlay
 * @param {Object} puzzleData - Data from spreadsheet for this puzzle
 * @param {Boolean} autoMode - Whether running in automated mode
 * @param {Function} sendResponse - Callback to respond to message
 */
async function captureScreenshot(puzzleData, autoMode, sendResponse) {
  try {
    // First, add data overlay
    const overlay = addDataOverlay(puzzleData);
    
    // Wait a moment for overlay to render
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Use html2canvas to take screenshot
    const canvas = await html2canvas(document.documentElement, {
      logging: false,
      allowTaint: true,
      useCORS: true,
      scale: window.devicePixelRatio || 1
    });
    
    // Convert to data URL
    const dataUrl = canvas.toDataURL('image/png');
    
    // Remove overlay after capturing
    document.body.removeChild(overlay);
    
    // Generate filename from puzzle data
    let filename = 'linkedin_puzzle';
    if (puzzleData.id) {
      filename += `_${puzzleData.id}`;
    } else if (puzzleData.ID) {
      filename += `_${puzzleData.ID}`;
    } else {
      // Use timestamp
      filename += `_${new Date().toISOString().replace(/:/g, '-')}`;
    }
    filename += '.png';
    
    // Save the screenshot
    if (autoMode) {
      // In auto mode, send to background to download
      chrome.runtime.sendMessage({
        action: 'downloadScreenshot',
        dataUrl: dataUrl,
        filename: filename
      });
      
      sendResponse({ success: true });
    } else {
      // In manual mode, trigger download directly
      const link = document.createElement('a');
      link.href = dataUrl;
      link.download = filename;
      link.click();
      
      sendResponse({ success: true });
    }
  } catch (error) {
    console.error('Screenshot capture error:', error);
    sendResponse({ success: false, error: error.message });
  }
}

/**
 * Add data overlay to the page
 * @param {Object} puzzleData - Data from spreadsheet
 * @returns {HTMLElement} - The overlay element
 */
function addDataOverlay(puzzleData) {
  // Create overlay element
  const overlay = document.createElement('div');
  overlay.style.position = 'fixed';
  overlay.style.top = '10px';
  overlay.style.left = '10px';
  overlay.style.backgroundColor = 'rgba(255, 255, 255, 0.9)';
  overlay.style.padding = '15px';
  overlay.style.border = '2px solid #0077B5'; // LinkedIn blue
  overlay.style.borderRadius = '5px';
  overlay.style.zIndex = '9999';
  overlay.style.fontFamily = 'Arial, sans-serif';
  overlay.style.fontSize = '14px';
  overlay.style.color = '#000';
  overlay.style.maxWidth = '300px';
  overlay.style.boxShadow = '0 2px 10px rgba(0, 0, 0, 0.1)';
  
  // Create content for overlay
  let overlayContent = '<div style="font-weight: bold; font-size: 16px; margin-bottom: 10px;">Puzzle Information:</div>';
  
  // Add all properties from puzzleData
  if (puzzleData && Object.keys(puzzleData).length > 0) {
    for (const [key, value] of Object.entries(puzzleData)) {
      // Skip URL field
      if (key.toLowerCase() === 'url') continue;
      
      overlayContent += `<div style="margin: 5px 0;"><strong>${key}:</strong> ${value}</div>`;
    }
  } else {
    overlayContent += '<div>No data available for this puzzle.</div>';
  }
  
  // Add timestamp
  const timestamp = new Date().toLocaleString();
  overlayContent += `<div style="margin-top: 10px; font-size: 12px; color: #666;">Captured: ${timestamp}</div>`;
  
  overlay.innerHTML = overlayContent;
  document.body.appendChild(overlay);
  
  return overlay;
}

// Initialize html2canvas library
function initHtml2Canvas() {
  const script = document.createElement('script');
  script.src = chrome.runtime.getURL('html2canvas.min.js');
  script.onload = function() {
    this.remove();
  };
  (document.head || document.documentElement).appendChild(script);
}

// Initialize on content script load
initHtml2Canvas();
// Ensure libraries are loaded
let Papa; // Will be assigned after loading

document.addEventListener('DOMContentLoaded', function () {
  function loadScript(url, callback) {
    const script = document.createElement('script');
    script.src = url;
    script.onload = callback;
    document.head.appendChild(script);
  }

  // Load scripts sequentially
  loadScript('lib/papaparse.min.js', function () {
    Papa = window.Papa; // Assign PapaParse library
    loadScript('lib/xlsx.full.min.js', function () {
      loadScript('lib/html2canvas.min.js', function () {
        initializeUI();
      });
    });
  });

  /** Update status message */
  function updateStatusMessage(message, type) {
    const status = document.getElementById('status');
    if (status) {
      status.textContent = message;
      status.className = type;
      status.classList.remove('hidden');
    }
  }
});

function initializeUI() {
  // DOM Elements
  const spreadsheetUpload = document.getElementById('spreadsheet-upload');
  const fileInfo = document.getElementById('file-info');
  const filename = document.getElementById('filename');
  const urlCount = document.getElementById('url-count');
  const takeScreenshotBtn = document.getElementById('take-screenshot');
  const startAutoBtn = document.getElementById('start-auto');
  const stopAutoBtn = document.getElementById('stop-auto');
  const status = document.getElementById('status');
  const progressContainer = document.getElementById('progress-container');
  const progressText = document.getElementById('progress-text');
  const progressBar = document.getElementById('progress-bar');
  const currentUrlDisplay = document.getElementById('current-url');

  // State variables
  let puzzleData = [];
  let currentPuzzleIndex = 0;
  let isAutoRunning = false;

  // Event listeners
  spreadsheetUpload.addEventListener('change', handleFileUpload);
  takeScreenshotBtn.addEventListener('click', captureCurrentPage);
  startAutoBtn.addEventListener('click', startAutoMode);
  stopAutoBtn.addEventListener('click', stopAutoMode);

  // Load stored data
  chrome.storage.local.get(['puzzleData', 'currentPuzzleIndex', 'isAutoRunning'], function (result) {
    if (Array.isArray(result.puzzleData) && result.puzzleData.length > 0) {
      puzzleData = result.puzzleData;
      currentPuzzleIndex = result.currentPuzzleIndex || 0;
      fileInfo.classList.remove('hidden');
      filename.textContent = 'Loaded from storage';
      urlCount.textContent = puzzleData.length;
      takeScreenshotBtn.disabled = false;
      startAutoBtn.disabled = false;
      updateProgressDisplay();
    }

    if (result.isAutoRunning) {
      isAutoRunning = true;
      progressContainer.classList.remove('hidden');
      startAutoBtn.disabled = true;
      stopAutoBtn.disabled = false;
      updateStatusMessage('Auto mode is running...', 'success');
    }
  });

  /** Handle spreadsheet file upload */
  async function handleFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    try {
      updateStatusMessage('Processing spreadsheet...', 'loading');

      const reader = new FileReader();
      reader.onload = function (e) {
        if (file.name.endsWith('.csv')) {
          Papa.parse(e.target.result, {
            header: true,
            skipEmptyLines: true,
            complete: function (results) {
              processData(results.data, file.name);
            },
            error: function (error) {
              updateStatusMessage('Error parsing CSV: ' + error.message, 'error');
            },
          });
        } else if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
          const data = new Uint8Array(e.target.result);
          const workbook = XLSX.read(data, { type: 'array' });
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          const jsonData = XLSX.utils.sheet_to_json(worksheet);
          processData(jsonData, file.name);
        } else {
          updateStatusMessage('Unsupported file format. Please upload a CSV or Excel file.', 'error');
        }
      };

      if (file.name.endsWith('.csv')) {
        reader.readAsText(file);
      } else {
        reader.readAsArrayBuffer(file);
      }
    } catch (error) {
      updateStatusMessage('Error processing file: ' + error.message, 'error');
    }
  }

  /** Process data from the uploaded spreadsheet */
  function processData(data, fileName) {
    if (!data || data.length === 0) {
      updateStatusMessage('No data found in the spreadsheet.', 'error');
      return;
    }

    const firstRow = data[0];
    const urlColumnName = Object.keys(firstRow).find(key =>
      ['url', 'link', 'puzzle'].some(term => key.toLowerCase().includes(term))
    );

    if (!urlColumnName) {
      updateStatusMessage('No URL column found. Please ensure your spreadsheet has a column named "URL".', 'error');
      return;
    }

    puzzleData = data
      .map(row => {
        let url = row[urlColumnName]?.trim();
        if (url && !url.startsWith('http')) {
          url = 'https://' + url;
        }
        return { ...row, url };
      })
      .filter(row => row.url);

    chrome.storage.local.set({ puzzleData, currentPuzzleIndex: 0 });

    fileInfo.classList.remove('hidden');
    filename.textContent = fileName;
    urlCount.textContent = puzzleData.length;
    takeScreenshotBtn.disabled = false;
    startAutoBtn.disabled = false;
    currentPuzzleIndex = 0;

    updateStatusMessage(`Loaded ${puzzleData.length} URLs from ${fileName}`, 'success');
    updateProgressDisplay();
  }

  /** Find the puzzle data that matches the current URL */
  function findMatchingPuzzle(currentUrl) {
    return puzzleData.find(puzzle => puzzle.url && (currentUrl.includes(puzzle.url) || puzzle.url.includes(currentUrl)));
  }

  /** Start automated screenshot mode */
  function startAutoMode() {
    if (puzzleData.length === 0) {
      updateStatusMessage('Upload a spreadsheet with puzzle URLs first.', 'error');
      return;
    }

    isAutoRunning = true;
    chrome.storage.local.set({ isAutoRunning: true });

    startAutoBtn.disabled = true;
    stopAutoBtn.disabled = false;
    progressContainer.classList.remove('hidden');

    updateStatusMessage('Starting auto screenshot mode...', 'success');
    processNextPuzzle();
  }

  /** Stop automated screenshot mode */
  function stopAutoMode() {
    isAutoRunning = false;
    chrome.storage.local.set({ isAutoRunning: false });

    startAutoBtn.disabled = false;
    stopAutoBtn.disabled = true;

    updateStatusMessage('Auto screenshot mode stopped.', 'info');
  }
}

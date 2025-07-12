// background.js
let currentTab = null;
let startTime = null;
let timeSpent = {};

// Website categories
const productiveCategories = [
  'github.com', 'stackoverflow.com', 'codepen.io', 'repl.it', 'leetcode.com',
  'hackerrank.com', 'coursera.org', 'udemy.com', 'edx.org', 'khanacademy.org',
  'docs.google.com', 'notion.so', 'trello.com', 'asana.com', 'slack.com',
  'teams.microsoft.com', 'zoom.us', 'meet.google.com'
];

const unproductiveCategories = [
  'facebook.com', 'instagram.com', 'twitter.com', 'tiktok.com', 'snapchat.com',
  'youtube.com', 'netflix.com', 'twitch.tv', 'reddit.com', 'pinterest.com',
  'linkedin.com', 'whatsapp.com', 'telegram.org'
];

function getDomain(url) {
  try {
    return new URL(url).hostname.replace('www.', '');
  } catch {
    return '';
  }
}

function categorizeWebsite(domain) {
  if (productiveCategories.some(cat => domain.includes(cat))) {
    return 'productive';
  }
  if (unproductiveCategories.some(cat => domain.includes(cat))) {
    return 'unproductive';
  }
  return 'neutral';
}

function saveTimeData(domain, timeSpent, category) {
  const data = {
    domain,
    timeSpent,
    category,
    timestamp: new Date().toISOString(),
    date: new Date().toDateString()
  };

  // Send to backend
  fetch('http://localhost:3000/api/time-entry', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data)
  }).catch(err => console.log('Backend not available:', err));

  // Also save locally
  chrome.storage.local.get(['timeData'], (result) => {
    const existingData = result.timeData || [];
    existingData.push(data);
    chrome.storage.local.set({ timeData: existingData });
  });
}

chrome.tabs.onActivated.addListener(async (activeInfo) => {
  // Save time for previous tab
  if (currentTab && startTime) {
    const timeSpentOnTab = Date.now() - startTime;
    const domain = getDomain(currentTab.url);
    const category = categorizeWebsite(domain);
    saveTimeData(domain, timeSpentOnTab, category);
  }

  // Start tracking new tab
  try {
    const tab = await chrome.tabs.get(activeInfo.tabId);
    currentTab = tab;
    startTime = Date.now();
  } catch (error) {
    console.log('Error getting tab info:', error);
  }
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.active) {
    // Save time for previous URL if it was different
    if (currentTab && currentTab.url !== tab.url && startTime) {
      const timeSpentOnTab = Date.now() - startTime;
      const domain = getDomain(currentTab.url);
      const category = categorizeWebsite(domain);
      saveTimeData(domain, timeSpentOnTab, category);
    }

    currentTab = tab;
    startTime = Date.now();
  }
});

chrome.windows.onFocusChanged.addListener((windowId) => {
  if (windowId === chrome.windows.WINDOW_ID_NONE) {
    // Browser lost focus
    if (currentTab && startTime) {
      const timeSpentOnTab = Date.now() - startTime;
      const domain = getDomain(currentTab.url);
      const category = categorizeWebsite(domain);
      saveTimeData(domain, timeSpentOnTab, category);
      startTime = null;
    }
  } else {
    // Browser gained focus
    if (currentTab) {
      startTime = Date.now();
    }
  }
});

// Initialize on startup
chrome.runtime.onStartup.addListener(() => {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0]) {
      currentTab = tabs[0];
      startTime = Date.now();
    }
  });
});
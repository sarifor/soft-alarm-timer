// Restart
document.getElementById('restartBtn').addEventListener('click', async () => {
  const data = await chrome.storage.local.get(['duration']);
  const sec = data.duration || 300;

  await chrome.storage.local.set({
    isRunning: true,
    endTime: Date.now() + sec * 1000,
    isFinished: false
  });

  chrome.runtime.sendMessage({ action: 'startTimer' });
  window.close();
});

// Dismiss
document.getElementById('dismissBtn').addEventListener('click', async () => {
  await chrome.storage.local.set({ isFinished: false });
  window.close();
});

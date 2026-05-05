const $ = id => document.getElementById(id);

const display = $('display');
const minutesInput = $('minutes');
const secondsInput = $('seconds');
const mainView = $('main');
const finishPopup = $('finishPopup');

let interval;

const formatTime = (s) =>
  `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

const getSeconds = () =>
  (parseInt(minutesInput.value) || 0) * 60 + (parseInt(secondsInput.value) || 0);

// 입력값 순환 (0-60, 양방향)
const wrapInput = (input) => {
  input.addEventListener('input', () => {
    let val = parseInt(input.value);
    if (isNaN(val)) return;
    if (val > 60) input.value = 0;
    if (val < 0) input.value = 60;
  });
};
wrapInput(minutesInput);
wrapInput(secondsInput);

const update = async () => {
  const data = await chrome.storage.local.get(['isRunning', 'endTime', 'duration', 'isFinished']);

  if (data.isFinished) {
    mainView.classList.add('hidden');
    finishPopup.classList.remove('hidden');
    clearInterval(interval);
    return;
  }

  mainView.classList.remove('hidden');
  finishPopup.classList.add('hidden');

  if (data.isRunning && data.endTime) {
    const left = Math.max(0, Math.ceil((data.endTime - Date.now()) / 1000));
    display.textContent = formatTime(left);

    // 타이머 완료 감지 - 즉시 background에 알림
    if (left === 0) {
      await chrome.storage.local.set({
        isRunning: false,
        endTime: null,
        isFinished: true
      });
      chrome.runtime.sendMessage({ action: 'timerDone' });
      clearInterval(interval);
      mainView.classList.add('hidden');
      finishPopup.classList.remove('hidden');
    }
  } else {
    display.textContent = formatTime(data.duration || 0);
  }
};

// Start
$('startBtn').addEventListener('click', async () => {
  const sec = getSeconds();
  if (sec <= 0) return;

  const endTime = Date.now() + sec * 1000;

  await chrome.storage.local.set({
    duration: sec,
    isRunning: true,
    endTime: endTime,
    isFinished: false
  });

  chrome.runtime.sendMessage({ action: 'startTimer', endTime: endTime });

  clearInterval(interval);
  interval = setInterval(update, 200);
});

// Stop
$('stopBtn').addEventListener('click', async () => {
  const data = await chrome.storage.local.get(['endTime']);
  const left = data.endTime ? Math.max(0, Math.ceil((data.endTime - Date.now()) / 1000)) : 0;

  await chrome.storage.local.set({
    duration: left,
    isRunning: false,
    endTime: null
  });

  chrome.runtime.sendMessage({ action: 'stopTimer' });
  clearInterval(interval);
  update();
});

// Reset
$('resetBtn').addEventListener('click', async () => {
  await chrome.storage.local.set({
    duration: getSeconds(),
    isRunning: false,
    endTime: null,
    isFinished: false
  });

  chrome.runtime.sendMessage({ action: 'stopTimer' });
  clearInterval(interval);
  update();
});

// Restart (in finish popup)
$('restartBtn').addEventListener('click', async () => {
  const data = await chrome.storage.local.get(['duration']);
  const sec = data.duration || 300;
  const endTime = Date.now() + sec * 1000;

  await chrome.storage.local.set({
    isRunning: true,
    endTime: endTime,
    isFinished: false
  });

  chrome.runtime.sendMessage({ action: 'startTimer', endTime: endTime });

  clearInterval(interval);
  interval = setInterval(update, 200);
});

// Dismiss
$('dismissBtn').addEventListener('click', async () => {
  await chrome.storage.local.set({ isFinished: false });
  chrome.runtime.sendMessage({ action: 'dismiss' });
  update();
});

// Init
(async () => {
  const data = await chrome.storage.local.get(['duration', 'isRunning']);
  const sec = data.duration || 300;
  minutesInput.value = Math.floor(sec / 60);
  secondsInput.value = sec % 60;
  update();
  if (data.isRunning) interval = setInterval(update, 200);
})();

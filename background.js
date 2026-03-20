// 뱃지 깜빡임 상태
let blinking = false;
let blinkInterval = null;

// 뱃지 깜빡임 시작
const startBlink = () => {
  if (blinking) return;
  blinking = true;

  const colors = ['#e8b4b8', '#b8d4e8', '#d4e8b8', '#e8d4b8'];
  let i = 0;

  chrome.action.setBadgeText({ text: '♡' });
  chrome.action.setBadgeBackgroundColor({ color: colors[0] });

  blinkInterval = setInterval(() => {
    i++;
    chrome.action.setBadgeBackgroundColor({ color: colors[i % colors.length] });
  }, 400);
};

// 뱃지 깜빡임 중지
const stopBlink = () => {
  blinking = false;
  if (blinkInterval) {
    clearInterval(blinkInterval);
    blinkInterval = null;
  }
  chrome.action.setBadgeText({ text: '' });
};

// 알람 리스너 - 타이머 완료 시
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'timer') {
    await chrome.storage.local.set({
      isRunning: false,
      endTime: null,
      isFinished: true
    });
    startBlink();
  }
});

// 메시지 리스너
chrome.runtime.onMessage.addListener(async (msg) => {
  if (msg.action === 'startTimer') {
    stopBlink();
    if (msg.endTime) {
      // 정확한 종료 시간에 알람 설정
      chrome.alarms.create('timer', { when: msg.endTime });
    }
  }

  if (msg.action === 'stopTimer') {
    chrome.alarms.clear('timer');
  }

  if (msg.action === 'timerDone') {
    startBlink();
  }

  if (msg.action === 'dismiss') {
    stopBlink();
  }

  return true;
});

// 설치 시 초기화
chrome.runtime.onInstalled.addListener(async () => {
  await chrome.storage.local.set({
    duration: 900,
    isRunning: false,
    endTime: null,
    isFinished: false
  });
});

// 브라우저 시작 시 기존 타이머 복구
chrome.runtime.onStartup.addListener(async () => {
  const data = await chrome.storage.local.get(['isRunning', 'endTime']);
  if (data.isRunning && data.endTime) {
    if (Date.now() >= data.endTime) {
      // 이미 종료됨
      await chrome.storage.local.set({
        isRunning: false,
        endTime: null,
        isFinished: true
      });
      startBlink();
    } else {
      // 알람 재설정
      chrome.alarms.create('timer', { when: data.endTime });
    }
  }
});

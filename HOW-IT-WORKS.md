# Soft Alarm Timer - 프로젝트 완전 해부

---

## 이 프로젝트는 뭘 하는 건가요?

"25분 뽀모도로 타이머 맞춰놓고, 다른 탭에서 작업하다가 시간 다 되면 알려주면 좋겠다..."

그런데 대부분의 타이머 확장 프로그램은 팝업을 닫으면 타이머도 같이 사라집니다. <br/>
이 프로젝트는 **팝업을 닫아도 타이머가 계속 돌아가고**, 시간이 다 되면 **아이콘이 반짝반짝** 알려줍니다.

---

## 기술 아키텍처: 레고 블록처럼 이해하기

### 전체 구조도

```
soft-alarm-timer/
├── manifest.json      ← 확장 프로그램의 "신분증"
├── background.js      ← 보이지 않는 곳에서 일하는 비서
├── popup.html         ← 사용자가 보는 화면 (뼈대)
├── popup.css          ← 아늑하면서 심플한(cozy minimal) 스타일링
├── popup.js           ← 팝업의 두뇌
├── finish.html/css/js ← 타이머 완료 시 화면 (현재 미사용)
└── README.md          ← 프로젝트 설명서
```

### 각 파일의 역할을 비유로 설명하면...

**manifest.json = 신분증 + 이력서**

```json
{
  "manifest_version": 3,
  "permissions": ["storage", "alarms"],  // "저장소랑 알람 쓸게요!"
  "background": {
    "service_worker": "background.js"    // "이 녀석이 백그라운드에서 일해요"
  }
}
```

**background.js = 보이지 않는 비서**

팝업이 닫혀도 묵묵히 일하는 Service Worker입니다. <br/>
"10분 후에 알려줘"라고 하면, 팝업이 닫혀도 10분 뒤에 알림을 줍니다.

**popup.js = 팝업의 두뇌**

사용자가 버튼을 누르면 반응하고, 타이머를 표시하고, background.js에게 "알람 맞춰줘!"라고 부탁합니다.

---

## 코드 깊이 들여다보기

### 핵심 문제: "팝업 닫으면 타이머가 멈춰요"

Chrome 확장 프로그램의 팝업은 닫히면 **완전히 사라집니다**. <br/>
`setInterval`로 타이머를 만들어도 팝업이 닫히면 끝이에요.

**해결책: chrome.alarms API**

```javascript
// popup.js에서
const endTime = Date.now() + sec * 1000;
chrome.runtime.sendMessage({ action: 'startTimer', endTime: endTime });

// background.js에서
chrome.alarms.create('timer', { when: msg.endTime });
```

`chrome.alarms`는 브라우저 레벨에서 알람을 관리합니다. <br/>
팝업이 닫혀도, 심지어 확장 프로그램 팝업을 한 번도 안 열어도, 지정한 시간에 정확히 알람이 발생합니다.

### 메시지 통신: popup ↔ background

팝업과 백그라운드는 서로 다른 세계에 살고 있어요. 어떻게 대화할까요?

```javascript
// popup.js (보내는 쪽)
chrome.runtime.sendMessage({ action: 'startTimer', endTime: 1234567890 });

// background.js (받는 쪽)
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.action === 'startTimer') {
    chrome.alarms.create('timer', { when: msg.endTime });
  }
});
```

마치 편지를 주고받는 것처럼, `sendMessage`로 보내고 `onMessage`로 받습니다.

### 아이콘 깜빡임: 아늑하면서 심플한(cozy minimal)

```javascript
const colors = ['#e8b4b8', '#b8d4e8', '#d4e8b8', '#e8d4b8'];
let i = 0;

chrome.action.setBadgeText({ text: '♡' });

blinkInterval = setInterval(() => {
  i++;
  chrome.action.setBadgeBackgroundColor({ color: colors[i % colors.length] });
}, 400);
```

파스텔 핑크 → 파스텔 블루 → 파스텔 그린 → 파스텔 오렌지... 0.4초마다 색상이 바뀌며 부드럽게 깜빡입니다.

---

## 삽질의 역사: 우리가 겪은 문제들

### 삽질 1: "팝업 닫으면 타이머가 안 돼요"

**시도 1: setInterval** → 팝업 닫으면 끝<br/>
**시도 2: chrome.alarms** → 최소 30초 제한이 있어서 짧은 타이머 불가<br/>
**시도 3: Offscreen API** → 작동 안 함 (Chrome 버전/환경 문제 추정)<br/>
**시도 4: 별도 창 열기** → 작동은 하지만 새까만 창이 뜸<br/>
**최종 해결: chrome.alarms의 `when` 파라미터**

```javascript
// delayInMinutes 대신 when 사용
chrome.alarms.create('timer', { when: Date.now() + 10000 }); // 정확히 10초 후
```

`when` 파라미터는 밀리초 단위 타임스탬프를 받아서 **정확한 시간**에 알람을 발생시킵니다. 30초 제한 없이!

### 삽질 2: "Start 누르면 팝업이 닫혀요"

타이머 시작 시 background.js에서 별도 창(worker.html)을 열었는데, 새 창이 포커스를 가져가면서 팝업이 닫혔습니다.

**해결: setTimeout으로 지연 + focused: false**

```javascript
setTimeout(() => {
  chrome.windows.create({
    url: 'worker.html',
    focused: false,
    state: 'minimized'
  });
}, 300);
```

300ms 지연을 주면 팝업이 먼저 렌더링을 완료하고, 사용자가 외부를 클릭해야 닫힙니다.

(결국 이 방식도 폐기하고 chrome.alarms만 사용)

### 삽질 3: "0에서 아래 화살표 누르면 60이 안 돼요"

HTML `<input type="number">`에 `min="0" max="60"`을 넣으면, 브라우저가 범위를 벗어나는 것을 막습니다.

**해결: min/max 제거 + JavaScript로 순환 처리**

```javascript
input.addEventListener('input', () => {
  let val = parseInt(input.value);
  if (val > 60) input.value = 0;
  if (val < 0) input.value = 60;
});
```

---

## Manifest V3의 현실

Chrome은 Manifest V2를 지원 중단합니다. V3로 마이그레이션하면서 겪는 고통:

### Service Worker의 한계

V2에서는 `background.js`가 항상 살아있었습니다. V3에서는 Service Worker라서 **비활성화될 수 있어요**.

```javascript
// 이렇게 하면 안 됨 (Service Worker가 꺼지면 사라짐)
let timer = setInterval(() => { ... }, 1000);

// 이렇게 해야 함 (Chrome이 관리)
chrome.alarms.create('timer', { when: endTime });
```

### Offscreen API: 이론 vs 현실

Manifest V3에서 백그라운드 작업을 위해 Offscreen API를 제공하지만... 실제로는 잘 안 되는 경우가 많습니다. <br/>
reason 설정, Chrome 버전, 타이밍 등 여러 변수가 있어요.

**교훈**: 새 API는 충분히 검증되기 전까지 신중하게 사용하세요.

---

## 영리한 설계 결정들

### 1. endTime을 저장하는 이유

```javascript
// 틀린 방법: 남은 시간 저장
await chrome.storage.local.set({ remaining: 600 }); // 10분 남음

// 올바른 방법: 종료 시간 저장
await chrome.storage.local.set({ endTime: Date.now() + 600000 });
```

"10분 남음"을 저장하면, 언제 저장했는지에 따라 값이 달라집니다. <br/>
"1710000000000에 끝남"을 저장하면, 언제 읽어도 정확한 남은 시간을 계산할 수 있어요.

### 2. 메시지에 endTime 직접 포함

```javascript
// 위험: storage에서 읽기 (비동기 타이밍 이슈 가능)
await chrome.storage.local.set({ endTime });
chrome.runtime.sendMessage({ action: 'startTimer' });
// background.js에서 storage 읽을 때 아직 저장 안 됐을 수도?

// 안전: 메시지에 직접 포함
chrome.runtime.sendMessage({ action: 'startTimer', endTime: endTime });
```

### 3. 이중 체크 (Belt and Suspenders)

```javascript
// popup.js - 팝업 열려있을 때 체크
if (left === 0) {
  chrome.runtime.sendMessage({ action: 'timerDone' });
}

// background.js - 팝업 닫혀있을 때 체크
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'timer') {
    startBlink();
  }
});
```

팝업이 열려있으면 popup.js가 즉시 감지하고, 닫혀있으면 background.js가 알람으로 감지합니다.

---

## 엔지니어처럼 생각하기

### "동작하는 코드"보다 "이해되는 코드"

```javascript
// 나쁜 예
const c = ['#e8b4b8', '#b8d4e8', '#d4e8b8', '#e8d4b8'];
let i = 0;
setInterval(() => { chrome.action.setBadgeBackgroundColor({ color: c[i++ % c.length] }); }, 400);

// 좋은 예
const colors = ['#e8b4b8', '#b8d4e8', '#d4e8b8', '#e8d4b8'];
let colorIndex = 0;

blinkInterval = setInterval(() => {
  colorIndex++;
  chrome.action.setBadgeBackgroundColor({
    color: colors[colorIndex % colors.length]
  });
}, 400);
```

6개월 후의 나도 이해할 수 있게 작성하세요.

### 실패를 빠르게, 자주

이 프로젝트에서 시도한 방법들:
1. setInterval → 실패
2. chrome.alarms (delayInMinutes) → 부분 실패
3. Offscreen API → 실패
4. 별도 창 → 성공하지만 UX 나쁨
5. chrome.alarms (when) → 성공!

처음부터 완벽한 해결책을 찾으려 하지 마세요. 빠르게 시도하고, 빠르게 실패하고, 배우세요.

---

## 다음 단계로 가고 싶다면?

1. **소리 알림 추가** → Web Audio API 또는 Audio 엘리먼트
2. **뽀모도로 모드** → 작업 25분 + 휴식 5분 자동 반복
3. **통계 기능** → 오늘 몇 번 타이머를 완료했는지
4. **다크 모드** → CSS 변수 + prefers-color-scheme

---

## 마무리

Chrome 확장 프로그램 개발은 "왜 이게 안 되지?"의 연속입니다. <br/>
특히 Manifest V3에서 백그라운드 작업은 많은 제약이 있어요.

하지만 그 제약 안에서 해결책을 찾아가는 과정이 엔지니어링입니다. <br/>
`chrome.alarms`의 `when` 파라미터 하나로 모든 문제가 해결되었을 때의 기쁨... 직접 경험해보세요!

---

*이 문서는 Claude Code가 작성했습니다.*

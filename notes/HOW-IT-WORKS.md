# HOW-IT-WORKS.md <!-- omit in toc -->

> 이 문서는 soft-alarm-timer의 기술 아키텍처, 설계 결정, 버그 해결 경험을 기록합니다.<br/>
> 작업 중 변경된 점들, 새롭게 배운 것들이 있다면 즉시 갱신됩니다.

---

## 목차 <!-- omit in toc -->

- [한 줄 요약](#한-줄-요약)
- [아키텍처](#아키텍처)
- [파일/폴더 구성](#파일폴더-구성)
  - [전체 구조도](#전체-구조도)
  - [background.js vs offscreen.js — 헷갈리기 쉬운 둘의 차이](#backgroundjs-vs-offscreenjs--헷갈리기-쉬운-둘의-차이)
  - [각 파일의 역할을 비유로 설명하면...](#각-파일의-역할을-비유로-설명하면)
- [코드 깊이 들여다보기](#코드-깊이-들여다보기)
  - [핵심 문제: "팝업 닫으면 타이머가 멈춰요"](#핵심-문제-팝업-닫으면-타이머가-멈춰요)
  - [메시지 통신: popup ↔ background](#메시지-통신-popup--background)
  - [아이콘 깜빡임: 아늑하면서 심플한(cozy minimal)](#아이콘-깜빡임-아늑하면서-심플한cozy-minimal)
- [삽질의 역사: 우리가 겪은 문제들](#삽질의-역사-우리가-겪은-문제들)
  - [삽질 1: "팝업 닫으면 타이머가 안 돼요"](#삽질-1-팝업-닫으면-타이머가-안-돼요)
  - [삽질 2: "Start 누르면 팝업이 닫혀요"](#삽질-2-start-누르면-팝업이-닫혀요)
  - [삽질 3: "소리는 finish.js에 넣으면 되겠지?"](#삽질-3-소리는-finishjs에-넣으면-되겠지)
  - [삽질 4: "Offscreen API, 이번엔 됩니다"](#삽질-4-offscreen-api-이번엔-됩니다)
  - [삽질 5: "0에서 아래 화살표 누르면 60이 안 돼요"](#삽질-5-0에서-아래-화살표-누르면-60이-안-돼요)
- [Web Audio API: 파일 없이 소리 만들기](#web-audio-api-파일-없이-소리-만들기)
- [Manifest V3의 현실](#manifest-v3의-현실)
  - [Service Worker의 한계](#service-worker의-한계)
  - [그럼 V3는 개악된 건가?](#그럼-v3는-개악된-건가)
  - [Offscreen API: 이론 vs 현실](#offscreen-api-이론-vs-현실)
- [영리한 설계 결정들](#영리한-설계-결정들)
  - [1. endTime을 저장하는 이유](#1-endtime을-저장하는-이유)
  - [2. 메시지에 endTime 직접 포함](#2-메시지에-endtime-직접-포함)
  - [3. 이중 체크 (Belt and Suspenders)](#3-이중-체크-belt-and-suspenders)
- [엔지니어처럼 생각하기](#엔지니어처럼-생각하기)
  - ["동작하는 코드"보다 "이해되는 코드"](#동작하는-코드보다-이해되는-코드)
  - [실패를 빠르게, 자주](#실패를-빠르게-자주)
- [다음 단계로 가고 싶다면?](#다음-단계로-가고-싶다면)
- [마무리](#마무리)

---

## 한 줄 요약

"25분 뽀모도로 타이머 맞춰놓고, 다른 탭에서 작업하다가 시간 다 되면 알려주면 좋겠다..."

그런데 대부분의 타이머 확장 프로그램은 팝업을 닫으면 타이머도 같이 사라집니다. <br/>
이 프로젝트는 **팝업을 닫아도 타이머가 계속 돌아가고**, 시간이 다 되면 **아이콘이 반짝이며 소리로** 알려줍니다.

---

## 아키텍처

```
사용자 입력 (분/초 설정 → Start 클릭)
       │
       ▼
┌─────────────────┐   endTime 계산 → chrome.storage.local 저장
│   popup.js      │──────────────────────────────────────────→ background.js에 메시지
└─────────────────┘
       │
       ▼
┌─────────────────┐   chrome.alarms.create('timer', {when: endTime})
│  background.js  │──→ 타이머 완료 시: isFinished=true, 배지 깜빡임, offscreen 생성
└─────────────────┘
       │
       ▼
┌─────────────────┐   Web Audio API (사인파 880Hz, 2초 감쇠)
│  offscreen.js   │──→ 재생 완료 → 'offscreen-done' 메시지 전송
└─────────────────┘
       │
       ▼
  background.js → closeDocument()
  사용자: 아이콘 클릭 → popup.js → Dismiss 또는 Restart
```

---

## 파일/폴더 구성

### 전체 구조도

```
soft-alarm-timer/
├── manifest.json      ← 확장 프로그램의 "신분증"
├── background.js      ← 보이지 않는 곳에서 일하는 비서
├── popup.html         ← 사용자가 보는 화면 (뼈대)
├── popup.css          ← 아늑하면서 심플한(cozy minimal) 스타일링
├── popup.js           ← 팝업의 두뇌
├── offscreen.html     ← 화면엔 안 보이는 오디오 재생 전용 페이지
├── offscreen.js       ← 알람 사운드 생성 (Web Audio API)
├── action.gif         ← README에 쓰이는 데모 GIF
├── notes/             ← 제작 과정 메모 (앱 실행에는 불필요)
├── .gitignore         ← git 추적 제외 파일/폴더 목록 (앱 실행에는 불필요)
├── CLAUDE.md          ← AI 어시스턴트 작업 규칙 (앱 실행에는 불필요)
└── README.md          ← 프로젝트 설명서
```

### background.js vs offscreen.js — 헷갈리기 쉬운 둘의 차이

둘 다 화면에 안 보이는 곳에서 돌아가지만, 역할과 환경이 다릅니다.

| | `background.js` | `offscreen.js` |
|---|---|---|
| 실행 환경 | Service Worker (DOM 없음) | 숨겨진 HTML 페이지 (DOM 있음) |
| 역할 | 타이머 감지, 알람 관리, 배지 깜빡임, 메시지 라우팅 | 오디오 재생 전담 |
| 수명 | 이벤트 있을 때마다 Chrome이 깨움. 단, 할 일이 없으면 Chrome이 강제로 꺼버리는데, 이때 배지 깜빡임(setInterval)도 같이 사라져 깜빡임이 중간에 멈출 수 있음 | 소리 재생할 때만 생성 → 완료 후 닫힘 |
| 왜 분리? | 팝업(`popup.js`)은 사용자가 닫으면 사라짐. **팝업이 닫혀도 타이머를 유지하려면 Chrome이 별도로 살려두는 Service Worker가 필요.** 단, 창(탭)이 없어서 소리는 못 내고 offscreen.js에 위임 | **Service Worker는 창이 없어서 소리를 못 냄. offscreen.js는 소리 재생을 위한 "숨겨진 창" 역할.** background.js가 "지금 소리 틀어"라고 문서를 생성하는 순간, offscreen.js는 추가 지시 없이 로드되자마자 바로 재생 시작 |

한 줄 요약: **`background.js`는 총괄 관리자, `offscreen.js`는 소리만 담당하는 심부름꾼.**

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

`chrome.alarms`는 **브라우저 레벨**에서 알람을 관리합니다. <br/>
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

시도 1: setInterval → 팝업 닫으면 끝<br/>
시도 2: chrome.alarms → 최소 30초 제한이 있어서 짧은 타이머 불가<br/>
시도 3: Offscreen API → 작동 안 함 (Chrome 버전/환경 문제 추정)<br/>
시도 4: 별도 창 열기 → 작동은 하지만 새까만 창이 뜸<br/>
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

### 삽질 3: "소리는 finish.js에 넣으면 되겠지?"

`finish.html`이라는 파일이 있으니 당연히 거기에 소리 코드를 넣었습니다. 근데 소리가 안 납니다.

알고 보니 실제 완료 화면은 `finish.html`이 아니라 `popup.html` 안의 `#finishPopup` div였습니다. `finish.html`은 프로젝트에 존재하지만 현재 플로우에서 열리지 않는 **유령 파일**이었던 것.

**교훈**: 코드를 넣기 전에 그 파일이 실제로 실행되는지 먼저 확인하세요.

→ `finish.html`, `finish.css`, `finish.js`는 결국 완전 미사용 확인 후 프로젝트에서 삭제했습니다.

### 삽질 4: "Offscreen API, 이번엔 됩니다"

**삽질 1**에 "Offscreen API → 작동 안 함"이라고 적혀 있는데... 이번에 성공했습니다.

Service Worker는 DOM이 없어서 Web Audio API를 직접 쓸 수 없습니다. 그래서 **Offscreen Document**를 생성해서 거기서 소리를 재생했습니다.

```
background.js (Service Worker, DOM 없음)
    ↓ createDocument()
offscreen.html (숨겨진 페이지, DOM 있음)
    → Web Audio API 사용 가능
    → 소리 재생 완료 → 'offscreen-done' 메시지 전송
    ↓
background.js → closeDocument()
```

핵심은 `reasons: ['AUDIO_PLAYBACK']`입니다. 이 이유를 명시해야 Chrome이 오디오 재생을 허용합니다.

**이전 실패의 원인 추정**: Chrome 버전이나 reason 설정이 달랐을 가능성이 높습니다.

### 삽질 5: "0에서 아래 화살표 누르면 60이 안 돼요"

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

## Web Audio API: 파일 없이 소리 만들기

`.mp3` 파일 없이 코드로 벨소리를 생성했습니다.

```javascript
const osc = ctx.createOscillator(); // 음파 생성기
const gain = ctx.createGain();       // 볼륨 조절기

osc.type = 'sine';         // 부드러운 사인파
osc.frequency.value = 880; // A5 음 (880Hz)

// 0.5에서 시작해서 2초에 걸쳐 0에 가깝게 감쇠
gain.gain.setValueAtTime(0.5, ctx.currentTime);
gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 2);
```

처음엔 크게, 점점 작아지는 "띵~" 소리입니다. 파일 크기 0, 외부 리소스 없음.

---

## Manifest V3의 현실

Chrome은 Manifest V2를 지원 중단합니다. V3로 마이그레이션하면서 겪는 고통:

### Service Worker의 한계

V2에서는 `background.js`가 브라우저가 켜져 있는 한 항상 살아있었습니다.<br/>
V3에서는 `background.js`가 **Service Worker**로 바뀌었는데, 이게 핵심 차이입니다.

Service Worker는 Chrome이 "할 일 없다"고 판단하면 **언제든 종료**시킵니다.<br/>
마치 자리를 비울 수 있는 야간 경비원 같아요 — 아무 일도 없으면 Chrome이 퇴근시킵니다.

문제는 `setInterval`로 타이머를 돌리고 있었다면, 경비원이 퇴근하는 순간 타이머도 같이 사라진다는 겁니다.

| | MV2 background.js | MV3 Service Worker |
|--|--|--|
| 수명 | 항상 켜져 있음 | 유휴 상태면 Chrome이 종료 |
| setInterval | 정상 작동 | 종료되면 타이머도 사라짐 |
| 해결책 | 필요 없음 | chrome.alarms 사용 |

`chrome.alarms`는 경비원(Service Worker)이 아닌 **경비 본부(Chrome 자체)** 가 관리합니다.<br/>
경비원이 잠들어 있어도, 정해진 시간에 Chrome이 직접 깨워서 알람을 발생시킵니다.

```javascript
// 이렇게 하면 안 됨 (Service Worker가 꺼지면 사라짐)
let timer = setInterval(() => { ... }, 1000);

// 이렇게 해야 함 (Chrome이 관리)
chrome.alarms.create('timer', { when: endTime });
```

### 그럼 V3는 개악된 건가?

개발자 입장에서 **불편해진 건 맞습니다.** 하지만 트레이드오프입니다.

**MV2가 편했던 이유**는 `background.js`가 **항상 켜져** 있어서 `setInterval`, 전역변수, 소켓 연결 등 **뭐든 자유롭게** 쓸 수 있었기 때문입니다.

**근데 그게 문제였습니다.**<br/>
확장 프로그램 수십 개를 설치하면 각각의 `background.js`가 항상 메모리를 잡아먹었고, 악성 확장 프로그램이 백그라운드에서 조용히 사용자 데이터를 빼내기도 쉬웠습니다.

**MV3가 해결한 것:**
- Service Worker는 **필요할 때만** 켜지니 메모리·배터리 **효율**이 좋아졌습니다.
- 보안 정책 강화로 악성 확장 만들기가 어려워졌습니다.

**그럼에도 개악 논란이 생긴 진짜 이유**는 `webRequest API` 제한 때문입니다.<br/>
uBlock Origin 같은 광고 차단기가 웹 요청을 가로채는 방식이 막히면서<br/>
*"구글이 광고 수익 지키려고 MV3를 밀어붙이는 거 아니냐"* 는 비판이 나왔습니다.<br/>
Service Worker 제약보다 이게 개악 논란의 본질입니다.

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

1. **뽀모도로 모드** → 작업 25분 + 휴식 5분 자동 반복
2. **통계 기능** → 오늘 몇 번 타이머를 완료했는지
3. **다크 모드** → CSS 변수 + prefers-color-scheme

---

## 마무리

Chrome 확장 프로그램 개발은 "왜 이게 안 되지?"의 연속입니다. <br/>
특히 Manifest V3에서 백그라운드 작업은 많은 제약이 있어요.

하지만 그 제약 안에서 해결책을 찾아가는 과정이 엔지니어링입니다. <br/>
`chrome.alarms`의 `when` 파라미터 하나로 모든 문제가 해결되었을 때의 기쁨... 직접 경험해보세요!
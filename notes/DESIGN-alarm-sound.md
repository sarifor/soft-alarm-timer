# 설계: 알람 사운드 기능 추가

## 개요

타이머 완료 시 부드러운 벨소리를 자동 재생한다.

## 결정 사항

| 항목 | 결정 | 이유 | 실제 구현 |
|------|------|------|----------|
| 사운드 파일 방식 | Web Audio API로 코드 생성 | 외부 파일 불필요. 사인파 + 감쇠로 부드러운 벨소리 구현 | |
| 파일 위치 | 없음 | 외부 파일 불필요 | |
| 재생 타이밍 | `finish.html` 로드 시 자동 재생 | 타이머 완료 = 팝업 열림 | `background.js`가 알람 감지 → offscreen document 생성 → 팝업 열림 여부 무관하게 즉시 재생 |
| 재생 횟수 | 1회 | 소프트한 벨소리라 반복 불필요 | |
| 볼륨 | 1.0 (기본값) | | 0.5에서 시작해 2초에 걸쳐 0으로 감쇠 (`exponentialRampToValueAtTime`) |
| 재생 중단 | Dismiss·Restart 클릭 시 `audio.pause()` | | 재생 주체가 offscreen document로 바뀌면서 중단 방법도 변경. `audio.pause()`(일시정지) 대신 `background.js`에서 `chrome.offscreen.closeDocument()`로 재생 중인 페이지 자체를 닫아 소리를 끔 |

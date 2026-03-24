# Claude Code Tips & Settings

당신의 Claude Code 설정과 팁을 정리해두는 문서입니다.

## Voice Mode (음성 모드)
- **활성화**: Space 키를 누르고 있으면 음성 입력 가능
- **언어 설정**: `/config` → "Dictation language" 에서 변경
  - 한국어 설정 가능 (한국어 음성 인식 지원)
  - 현재 설정: 한국어로 응답 언어 설정 (Korean)
- **알려진 제한사항**: 자동 언어 감지 기능 없음 (한 번에 한 언어만 설정 가능)

## Configuration (설정)
- `/config` 명령어로 설정 변경 가능
  - 응답 언어 설정
  - 음성 인식 언어 설정
  - 기타 UI 설정

## Slash Commands (슬래시 커맨드)
- **`/model`**: Claude 모델 선택
  - Haiku (빠름), Sonnet (중간), Opus (가장 강력)
  - **활용 예시**: HOW-IT-WORKS.md 작성 시 `/model Opus` 사용, 간단한 버그 수정 시 `/model Haiku`로 변경

- **`/effort`**: 작업 난이도/노력 수준 설정
  - low (빠르게), auto (자동 판단), high (깊게 분석)
  - **활용 예시**: 복잡한 구조 분석할 때 `/effort high` 설정, 간단한 오류 수정 시 `/effort low`로 변경

- **`/config`**: 설정 변경 (응답 언어, 음성 인식 언어 등)

- **한 세션 내에서 변경 가능**: 작업의 복잡도에 따라 필요할 때마다 언제든 변경 가능

## Model/Effort 제안 프로세스
- Claude는 자동으로 모델/effort를 바꿀 수 없음 (시스템 제약)
- 대신 사용자가 작업을 요청하면:
  1. 현재 모델/effort 확인
  2. 작업에 맞는 권장 설정 제안
  3. 사용자가 `/model`, `/effort` 명령으로 변경
- **활용 예시**:
  - 사용자: "새 기능 추가해줘"
  - Claude: "지금 Haiku/low인데, 이 작업은 Sonnet/high를 권장합니다"
  - 사용자: `/model Sonnet` 후 작업 진행

## Tips & Tricks
- 한국어와 영어를 섞어서 사용할 때: 응답 언어를 한국어로 설정하면 모든 텍스트 입력 이해 가능
- 메모리 시스템: Claude Code는 대화 간에 당신의 선호도와 팁들을 자동으로 기억함
- 모델 선택 팁: 빠른 작업은 Haiku, 복잡한 작업은 Sonnet/Opus 사용

## 추가 학습 항목
(새로운 팁을 배울 때마다 여기에 추가됩니다)

---
*마지막 업데이트: 2026-03-24*

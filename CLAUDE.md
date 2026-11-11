# 클래스보드(ClassBoard)

교실 화면에 띄워 두고 쓰는 위젯 기반 웹앱(HTML/CSS/JS만 사용, 서버·빌드 없음).

## 작업 방식
- 작업 전 `docs/spec/`의 PRD.md(무엇을), TRD.md(어떻게), TASK.md(순서)를 읽는다.
- 한 번에 TASK 하나만 진행하고, 끝나면 확인 방법을 알려 준다.
- TASK가 끝나면 `docs/spec/LOG.md`에 기록한다(형식은 TRD 7장).
- 문서와 다르게 만들어야 하면 코드보다 문서를 먼저 고친다.

## 금지 사항 (TRD 1장)
- npm 패키지, CDN 링크, 외부 글꼴, 이미지·소리 파일
- `alert` / `confirm` / `prompt`
- ES 모듈(`import`/`export`) — 일반 `<script defer>`만 쓴다

## 코딩 규칙 (TRD 5장)
1. `var` 금지. `const` 기본, 값이 바뀔 때만 `let`.
2. 사용자 입력(이름, 메모)은 `textContent`로만 넣는다. `innerHTML`에 넣지 않는다.
3. 누를 수 있는 것은 모두 `<button type="button">`. 아이콘만 있는 버튼에는 `aria-label`.
4. CSS 클래스는 소문자+하이픈, 위젯별 접두사(`.card-header`, `.timer-display`).
5. 상태 클래스는 `is-` 접두사(`.is-active`, `.is-ringing`).
6. 이름은 영어 camelCase, 주석은 한국어로 "왜"를 적는다.
7. 한 파일은 한 가지 일만. 위젯 코드는 자기 파일과 `widgets.css`의 자기 구역 안에서 끝낸다.
8. 숫자 값(시간 간격, 크기)은 파일 맨 위에 이름 붙은 상수로 둔다.
- 전역 변수는 `window.App` 하나, 각 파일은 `(function () { 'use strict'; ... })();`로 감싼다.
- 경로는 상대 경로만(`css/style.css`). `/`로 시작하지 않는다.

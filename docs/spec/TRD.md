# TRD — 클래스보드(ClassBoard) 기술 요구사항 문서

이 문서는 PRD.md의 요구사항을 어떤 기술과 구조로 구현할지 정한다. 구현 중 이 문서와 다르게 만들어야 할 이유가 생기면, 코드를 바꾸기 전에 이 문서를 먼저 고친다.

## 1. 기술 스택

| 항목 | 선택 | 이유 |
|---|---|---|
| 언어 | HTML5, CSS3, JavaScript(ES2020) | 설치와 빌드 없이 동작한다 |
| 프레임워크·라이브러리 | 사용 안 함 | 실습 범위에서 불필요하고 구조를 직접 이해하기 좋다 |
| 스크립트 방식 | 일반 `<script defer>` (ES 모듈 사용 안 함) | `index.html`을 더블클릭으로 열어도 동작한다 |
| 아이콘 | 이모지 | 아이콘 CDN 없이 표시된다 |
| 저장 | 브라우저 `localStorage` | 서버 없이 상태를 유지한다 |
| 소리 | Web Audio API | 소리 파일 없이 알림음을 만든다 |
| 그림 | Canvas 2D API | 그림판 구현 |
| 개발 도구 | Visual Studio Code, Claude 확장 | 수업 지정 환경 |

금지 사항: npm 패키지, CDN 링크, 외부 글꼴, 이미지·소리 파일, `alert`/`confirm`/`prompt`.

## 2. 폴더 구조

```
(프로젝트 폴더)/
├─ index.html
├─ README.md
├─ CLAUDE.md               # Claude에게 주는 프로젝트 규칙 요약
├─ css/
│  ├─ style.css            # 전체 레이아웃, 색 변수, 도구 모음, 카드 공통
│  └─ widgets.css          # 위젯별 스타일
├─ js/
│  ├─ storage.js           # 저장·불러오기
│  ├─ drag.js              # 카드 끌기
│  ├─ app.js               # App 네임스페이스, 위젯 등록, 카드·도구 모음 생성
│  ├─ widgets/
│  │  ├─ background.js
│  │  ├─ timer.js
│  │  ├─ stopwatch.js
│  │  ├─ picker.js
│  │  ├─ dice.js
│  │  ├─ note.js
│  │  ├─ draw.js
│  │  └─ worksymbol.js
│  └─ main.js              # App.init() 호출
└─ docs/
   └─ spec/
      ├─ PRD.md
      ├─ TRD.md
      ├─ TASK.md
      └─ LOG.md            # 작업 기록
```

- `index.html`의 스크립트 순서는 `storage.js → drag.js → app.js → widgets/*.js → main.js`로 고정한다.
- 모든 경로는 상대 경로(`css/style.css`, `js/app.js`)로 쓴다. `/css/style.css`처럼 `/`로 시작하면 나중에 GitHub Pages에 올렸을 때 깨진다.
- 프로젝트 폴더 이름과 배포용 폴더 배치는 이 문서에서 정하지 않는다. 배포할 때 폴더를 옮겨도 상대 경로라 그대로 동작한다.

## 3. 구조 설계

### 3.1 전역 네임스페이스

전역 변수는 `window.App` 하나만 만든다. 각 파일은 즉시 실행 함수 `(function () { 'use strict'; ... })();`로 감싼다.

```js
App.storage   // storage.js: load(), save(state), reset()
App.drag      // drag.js: makeDraggable(cardEl, handleEl, onEnd)
App.registerWidget(definition)   // 위젯 파일이 호출
App.init()    // main.js가 호출: 상태 불러오기 → 도구 모음 생성 → 열린 위젯 복원
App.openWidget(id) / App.closeWidget(id) / App.toggleWidget(id)
App.setBackground(presetId)
App.getBackground()   // 현재 배경 프리셋 id (배경 위젯이 선택 표시에 사용)
App.backgrounds       // background.js가 넣는 배경 프리셋 목록 [{ id, name, css }]
App.confirmButton(buttonEl, confirmText, action)   // 두 번 눌러야 실행되는 버튼
```

### 3.2 위젯 정의 규격

모든 위젯은 같은 모양의 객체로 등록한다. 새 위젯을 추가할 때 `app.js`를 고치지 않아도 되게 한다.

```js
App.registerWidget({
  id: 'timer',                 // 영문 소문자, 저장 키로 사용
  title: '타이머',             // 카드 제목과 도구 모음 이름
  icon: '⏳',                  // 도구 모음 아이콘(이모지)
  size: { w: 320, h: 280 },    // 카드 크기(px, 고정)
  defaultData: { minutes: 5, seconds: 0 },
  // bodyEl: 카드 본문 요소, data: 저장된 데이터, save(newData): 저장 요청
  mount(bodyEl, data, save) { /* 화면 만들기, 이벤트 연결 */ },
  unmount() { /* setInterval, requestAnimationFrame, 소리 정리 */ }
});
```

- `mount`는 카드가 열릴 때마다, `unmount`는 닫힐 때마다 호출된다.
- 반복 동작(`setInterval`, `requestAnimationFrame`, `setTimeout`)을 쓰는 위젯은 `unmount`에서 반드시 정리한다.
- 위젯은 다른 위젯의 DOM이나 데이터를 직접 건드리지 않는다. 배경 위젯만 `App.setBackground()`를 호출한다.

위젯 목록:

| id | 제목 | 아이콘 | 카드 크기(w×h) |
|---|---|---|---|
| background | 배경 | 🖼 | 320×240 |
| timer | 타이머 | ⏳ | 320×280 |
| stopwatch | 스톱워치 | ⏱ | 320×360 |
| picker | 제비뽑기 | 🎯 | 360×440 |
| dice | 주사위 | 🎲 | 300×280 |
| note | 메모장 | 📝 | 360×300 |
| draw | 그림판 | 🎨 | 520×440 |
| worksymbol | 활동 상태 | 🤫 | 320×320 |

### 3.3 저장 데이터

`localStorage` 키는 `classboard:v1` 하나다. 값은 JSON 문자열이다.

```json
{
  "background": "sky",
  "zTop": 12,
  "widgets": {
    "timer": {
      "open": true,
      "x": 80, "y": 60, "z": 12,
      "data": { "minutes": 5, "seconds": 0 }
    },
    "picker": {
      "open": false,
      "x": 420, "y": 60, "z": 3,
      "data": { "names": "김하나\n이두리\n박세나", "count": 1, "exclude": true, "picked": [0] }
    }
  }
}
```

위젯별 `data` 내용:

| 위젯 | data |
|---|---|
| background | 없음(최상위 `background`에 프리셋 id 저장) |
| timer | `minutes`, `seconds` (설정값만 저장) |
| stopwatch | 없음(새로고침하면 0으로 돌아간다) |
| picker | `names`(줄바꿈으로 구분한 문자열), `count`(1~5), `exclude`(true/false), `picked`(이미 뽑힌 사람의 목록 순번 배열) |
| dice | `count` (1 또는 2) |
| note | `text`, `size`(`"s"`, `"m"`, `"l"`), `color`(`"black"`, `"red"`, `"blue"`, `"green"`) |
| draw | `image`(캔버스의 PNG data URL 문자열 또는 `null`) |
| worksymbol | `selected` (`"quiet"`, `"whisper"`, `"group"`, `"question"`, `null`) |

저장 규칙:

- `load()`와 `save()`는 `try/catch`로 감싼다. 값이 없거나 JSON이 깨졌거나 저장 공간이 부족해도 앱은 계속 동작해야 한다.
- 불러온 데이터에 없는 항목은 위젯의 `defaultData`로 채운다.
- 메모와 이름 목록처럼 입력이 잦은 저장은 300ms 디바운스한다.
- 처음 여는 위젯의 위치는 화면 가운데에서 위젯마다 30px씩 어긋나게 잡는다.

## 4. 구현 세부 사항

### 4.1 레이아웃

- `html, body`는 `height: 100%; margin: 0; overflow: hidden`.
- `#stage`가 화면 전체를 덮고 배경을 가진다. 카드는 `#stage` 안에 `position: absolute`로 놓고 `left`, `top`(px)으로 위치를 정한다.
- `#toolbar`는 `position: fixed`로 하단 가운데에 둔다. 카드보다 항상 위에 보이도록 `z-index: 10000`.
- 색, 둥근 모서리, 그림자, 글꼴은 `:root`의 CSS 변수로 정의하고 재사용한다.
- 글꼴은 시스템 글꼴: `"Malgun Gothic", "Apple SD Gothic Neo", sans-serif`.
- 큰 글자(타이머 숫자, 당첨자 이름, 활동 상태)는 카드 크기에 맞춰 크게 잡는다. 숫자는 `font-variant-numeric: tabular-nums`로 폭이 흔들리지 않게 한다.
- PRD 2장의 "화면 높이의 8% 이상"은 `font-size`로 잰다(1080px × 8% ≈ 86px → 88px 이상). 카드 크기가 고정이라 실제 글자 높이로 재면 카드 너비를 넘기 때문이다. 타이머 숫자는 항상, 제비뽑기는 1명을 뽑을 때 이 기준을 지킨다. 여러 명이거나 이름이 길어 카드 너비를 넘으면 넘지 않을 때까지 글자를 줄인다.

### 4.2 카드 끌기 (drag.js)

- 마우스와 터치를 한 번에 처리하기 위해 Pointer Events(`pointerdown`, `pointermove`, `pointerup`, `pointercancel`)를 쓴다.
- `pointerdown`에서 `handleEl.setPointerCapture(e.pointerId)`를 호출해 빠르게 끌어도 놓치지 않게 한다.
- 제목 줄에 `touch-action: none`을 준다. 없으면 터치 화면에서 끌기 대신 스크롤이 된다.
- 닫기 버튼 위에서 시작한 `pointerdown`은 끌기로 처리하지 않는다.
- 이동 중 좌표는 `0 ≤ x ≤ 화면너비 − 카드너비`, `0 ≤ y ≤ 화면높이 − 카드높이 − 도구모음높이`로 제한한다.
- 끌기가 끝나면(`pointerup`) `onEnd(x, y)`로 한 번만 저장한다. 이동 중에는 저장하지 않는다.
- 카드에서 `pointerdown`이 일어나면 `zTop`을 1 올려 그 카드의 `z-index`로 준다.
- `window`의 `resize` 이벤트에서 모든 카드 좌표를 같은 규칙으로 다시 제한한다.

### 4.3 두 번 눌러 확인하는 버튼 (App.confirmButton)

모두 초기화와 그림판의 모두 지우기에 쓴다. 첫 번째 누름에 버튼 문구가 `confirmText`(예: "정말 지울까요?")로 바뀌고, 3초 안에 다시 누르면 `action`을 실행한다. 3초가 지나면 원래 문구로 돌아간다.

### 4.4 타이머

- 1초씩 빼는 방식은 쓰지 않는다. 시작할 때 `endAt = Date.now() + 남은밀리초`를 기록하고, 250ms마다 `남은시간 = endAt − Date.now()`를 계산해 표시한다. 탭이 백그라운드에 가도 시간이 어긋나지 않는다.
- 일시정지하면 남은 밀리초를 변수에 보관하고 인터벌을 멈춘다.
- 표시는 `Math.ceil(남은밀리초 / 1000)`을 분·초로 나눠 `padStart(2, '0')`로 맞춘다.
- 입력값 보정: `parseInt` 결과가 숫자가 아니면 0, 분은 0~99, 초는 0~59로 자른다.
- 알림음: `AudioContext`는 시작 버튼을 누를 때(사용자 동작 안에서) 만든다. 브라우저는 사용자 동작 없이 소리를 재생하지 못하게 막기 때문이다. 종료 시 `OscillatorNode`로 880Hz 소리를 0.2초씩 0.3초 간격으로 3번 낸다.
- 깜빡임은 카드에 CSS 클래스(`is-ringing`)를 붙여 `@keyframes`로 처리한다.

### 4.5 스톱워치

- 타이머와 같은 이유로 시각 차이로 계산한다. `경과 = 보관된경과 + (Date.now() − 시작시각)`.
- 화면 갱신은 `requestAnimationFrame`으로 한다. 일시정지하면 경과를 보관하고 갱신을 멈춘다.
- 표시는 분, 초, 1/100초를 각각 두 자리로 맞춘 `MM:SS.cc`.
- 랩은 `{ 번호, 구간시간, 누적시간 }`으로 배열에 넣는다. 구간시간은 "현재 누적 − 직전 랩의 누적"이다. 30개를 넘으면 랩 버튼을 비활성화한다.

### 4.6 제비뽑기

- 이름 배열은 `names.split('\n').map(s => s.trim()).filter(Boolean)`으로 만든다. 같은 이름이 두 번 있으면 두 명으로 본다.
- 같은 이름이 여러 번 있을 수 있으므로 뽑힌 사람은 이름이 아니라 **목록의 순번(index)** 으로 `picked`에 기록한다.
- 후보는 제외 옵션이 켜져 있으면 "전체 순번 − picked", 꺼져 있으면 전체 순번이다.
- 여러 명 뽑기: 후보 배열을 Fisher–Yates 방식으로 섞은 뒤 앞에서 `Math.min(count, 후보수)`명을 가져온다.
- 연출: 80ms 간격으로 후보 이름을 무작위로 바꿔 보여 주다가 1.5초 뒤 최종 결과로 멈춘다. 연출 중에는 추첨 버튼을 비활성화한다.
- 당첨자가 여러 명이면 한 줄에 한 명씩 보여 주고, 인원이 많을수록 글자를 줄인다.
- 이름 목록 내용이 바뀌면 `picked`를 비운다.

### 4.7 주사위

- 눈은 `Math.floor(Math.random() * 6) + 1`.
- 주사위 면은 3×3 CSS Grid에 점 9칸을 두고, 눈 값에 따라 보일 칸만 표시한다. 값은 `data-value` 속성으로 주고 CSS에서 칸을 고른다.
- 연출: 80ms 간격으로 임의의 눈을 보여 주다가 1초 뒤 최종 값으로 멈춘다. 굴리는 동안 흔들리는 CSS 애니메이션 클래스(`is-rolling`)를 붙인다.

### 4.8 메모장

- `<textarea>`를 쓴다. `input` 이벤트에서 디바운스 저장한다.
- 크기와 색은 `textarea`에 클래스(`note-size-m`, `note-color-red`)를 붙여 바꾼다.

### 4.9 그림판

- `<canvas width="480" height="300">`을 쓰고 CSS 크기도 같은 값으로 고정한다. 속성 크기와 CSS 크기가 다르면 좌표가 어긋난다.
- Pointer Events로 그린다. 캔버스에 `touch-action: none`을 주고 `pointerdown`에서 `setPointerCapture`를 호출한다.
- 좌표는 `e.clientX − canvas.getBoundingClientRect().left` 방식으로 구한다.
- 선은 `lineCap = 'round'`, `lineJoin = 'round'`로 하고, `pointermove`마다 직전 점에서 현재 점까지 `lineTo`로 잇는다. 점만 찍으면 빠르게 그을 때 끊긴다.
- 굵기는 3, 6, 12px. 지우개는 `globalCompositeOperation = 'destination-out'`에 굵기 24px로 그린다. 펜으로 돌아오면 `'source-over'`로 되돌린다.
- 캔버스 배경은 CSS로 흰색을 주고, 캔버스 자체는 투명하게 둔다(지우개가 배경까지 지우지 않게).
- 저장: 선 하나를 다 그었을 때(`pointerup`) `canvas.toDataURL('image/png')`를 `data.image`에 저장한다. `mount`에서 `Image` 객체로 불러와 `drawImage`로 복원한다.
- 모두 지우기는 `clearRect` 후 `image`를 `null`로 저장한다.

### 4.10 활동 상태, 배경

- 활동 상태: 선택 버튼 4개는 `<button>`으로 만들고 `aria-pressed`로 선택 상태를 표시한다. 상태 목록은 `{ id, icon, label }` 배열로 둔다.
- 배경: 프리셋은 `{ id, name, css }` 배열로 `background.js` 안에 두고 `App.backgrounds`로 공개한다. `css`는 `#stage`의 `background` 값이다(예: `linear-gradient(135deg, #89f7fe, #66a6ff)`).
- `App.setBackground(presetId)`는 `app.js`에 있고 `App.backgrounds`에서 id로 `css`를 찾아 `#stage`에 적용한 뒤 저장한다. `App.init()`도 같은 방법으로 저장된 배경을 적용하므로, 배경 카드가 닫혀 있어도 새로고침 후 배경이 복원된다. 목록에 없는 id면 첫 번째 프리셋을 쓴다.

### 4.11 전체 화면, 초기화

- 전체 화면: `document.documentElement.requestFullscreen()`과 `document.exitFullscreen()`. `fullscreenchange` 이벤트로 버튼 표시를 갱신한다.
- 모두 초기화: `App.confirmButton`으로 확인 후 `App.storage.reset()`, `location.reload()`.

## 5. 코딩 규칙

1. `var`를 쓰지 않고 `const`를 기본으로, 값이 바뀔 때만 `let`을 쓴다.
2. 사용자가 입력한 글(이름, 메모)을 화면에 넣을 때는 `textContent`만 쓴다. `innerHTML`에 사용자 입력을 넣지 않는다.
3. 누를 수 있는 것은 모두 `<button type="button">`으로 만든다. 아이콘만 있는 버튼에는 `aria-label`을 붙인다.
4. CSS 클래스 이름은 소문자와 하이픈을 쓰고 위젯별 접두사를 붙인다. 예: `.card`, `.card-header`, `.timer-display`, `.picker-result`.
5. 상태 표시는 `is-` 접두사 클래스로 한다. 예: `.is-active`, `.is-ringing`, `.is-rolling`.
6. 함수와 변수 이름은 영어 camelCase, 주석은 한국어로 "왜 이렇게 했는지"를 적는다.
7. 한 파일은 한 가지 일만 한다. 위젯 코드는 자기 파일과 `widgets.css`의 자기 구역 안에서 끝낸다.
8. 숫자 값(시간 간격, 크기)은 파일 맨 위에 상수로 이름 붙여 둔다.

## 6. 확인 방법

자동 테스트는 만들지 않고, TASK마다 정해진 확인 절차를 브라우저에서 직접 해 본다.

- 실행: `index.html`을 더블클릭하거나 VS Code의 Live Server 확장으로 연다.
- 매번 확인: 개발자 도구(F12) 콘솔에 빨간 오류가 없어야 한다.
- 저장 확인: 개발자 도구 → Application → Local Storage에서 `classboard:v1` 값을 본다.
- 터치 확인: 개발자 도구의 기기 모드(Ctrl+Shift+M)에서 카드를 끌고 그림을 그려 본다.
- 처음 방문 확인: Local Storage의 `classboard:v1`을 지우고 새로고침한다.

## 7. 작업 기록 (LOG.md)

TASK 하나가 끝날 때마다 `docs/spec/LOG.md`에 한 항목을 추가한다.

```
## T2-4 타이머 위젯 (2026-11-12)
- 한 일: timer.js 작성, widgets.css에 타이머 구역 추가
- 확인 결과: 완료 기준 통과
- 문제와 해결: 알림음이 안 나서 AudioContext 생성을 시작 버튼 안으로 옮김
```

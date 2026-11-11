// App 네임스페이스: 위젯 등록, 카드 생성, 도구 모음 생성, 열기·닫기 (TRD 3.1, 3.2)
(function () {
  'use strict';

  // 처음 여는 카드는 화면 가운데에서 위젯 순서마다 이만큼씩 어긋나게 놓는다(TRD 3.3)
  const FIRST_OPEN_OFFSET = 30;
  // 두 번 눌러 확인하는 버튼이 확인 문구를 보여 주는 시간(TRD 4.3)
  const CONFIRM_TIMEOUT_MS = 3000;

  const FULLSCREEN_OFF = { icon: '🖥️', label: '전체 화면' };
  const FULLSCREEN_ON = { icon: '↩️', label: '창 모드' };
  const RESET_BUTTON = { icon: '🧹', label: '모두 초기화', confirmText: '정말 지울까요?' };

  const App = window.App || (window.App = {});

  // 등록 순서가 곧 도구 모음 버튼 순서이므로 순서를 보존하는 배열로 둔다
  const definitions = [];
  // 열린 카드 요소: id → { cardEl, bodyEl }
  const openCards = {};
  // 도구 모음의 위젯 버튼: id → buttonEl
  const toolbarButtons = {};

  let state = null;
  let stageEl = null;
  let toolbarEl = null;
  // 모두 초기화 후 새로고침 직전에 위젯이 저장(예: 메모장의 pagehide 저장)을 해서
  // 지운 내용이 되살아나지 않도록 저장을 막는 표시
  let isResetting = false;

  function findDefinition(id) {
    return definitions.find(function (def) {
      return def.id === id;
    }) || null;
  }

  // defaultData를 그대로 쓰면 여러 곳이 같은 배열·객체를 공유하게 되므로 복사해서 쓴다
  function cloneData(data) {
    return JSON.parse(JSON.stringify(data || {}));
  }

  function persist() {
    if (isResetting) {
      return;
    }
    App.storage.save(state);
  }

  // 도구 모음을 뺀, 카드가 놓일 수 있는 높이(drag.js의 제한 범위와 같은 기준)
  function getUsableHeight() {
    const styles = getComputedStyle(document.documentElement);
    const toolbarHeight = parseFloat(styles.getPropertyValue('--toolbar-height')) || 0;
    const toolbarGap = parseFloat(styles.getPropertyValue('--toolbar-gap')) || 0;
    return window.innerHeight - toolbarHeight - toolbarGap;
  }

  // 화면 안으로 넣는 처리는 makeDraggable이 붙을 때 drag.js가 맡으므로 여기서는 가운데 위치만 구한다
  function getFirstOpenPosition(def) {
    const index = definitions.indexOf(def);
    const offset = index * FIRST_OPEN_OFFSET;
    return {
      x: Math.round((window.innerWidth - def.size.w) / 2 + offset),
      y: Math.round((getUsableHeight() - def.size.h) / 2 + offset)
    };
  }

  // 저장된 위젯 상태가 없거나 일부가 빠져 있으면 채운다(TRD 3.3 "없는 항목은 defaultData로")
  function ensureWidgetState(def) {
    const saved = state.widgets[def.id] || {};
    const widgetState = {
      open: saved.open === true,
      x: Number.isFinite(saved.x) ? saved.x : null,
      y: Number.isFinite(saved.y) ? saved.y : null,
      z: Number.isFinite(saved.z) ? saved.z : 0,
      data: Object.assign(cloneData(def.defaultData), saved.data || {})
    };
    state.widgets[def.id] = widgetState;
    return widgetState;
  }

  function bringToFront(id) {
    const widgetState = state.widgets[id];
    const card = openCards[id];
    // 이미 맨 앞이면 z를 올리거나 저장할 필요가 없다
    if (widgetState.z === state.zTop && state.zTop > 0) {
      return false;
    }
    state.zTop += 1;
    widgetState.z = state.zTop;
    if (card) {
      card.cardEl.style.zIndex = String(widgetState.z);
    }
    return true;
  }

  function updateToolbarButton(id) {
    const button = toolbarButtons[id];
    if (!button) {
      return;
    }
    const isOpen = Boolean(openCards[id]);
    button.classList.toggle('is-active', isOpen);
    button.setAttribute('aria-pressed', String(isOpen));
  }

  function createCard(def, widgetState) {
    const cardEl = document.createElement('section');
    cardEl.className = 'card card-' + def.id;
    cardEl.dataset.widget = def.id;
    cardEl.setAttribute('aria-labelledby', 'card-title-' + def.id);
    cardEl.style.width = def.size.w + 'px';
    cardEl.style.height = def.size.h + 'px';
    cardEl.style.left = widgetState.x + 'px';
    cardEl.style.top = widgetState.y + 'px';
    cardEl.style.zIndex = String(widgetState.z);

    const headerEl = document.createElement('header');
    headerEl.className = 'card-header';

    const titleEl = document.createElement('h2');
    titleEl.className = 'card-title';
    titleEl.id = 'card-title-' + def.id;

    const iconEl = document.createElement('span');
    iconEl.className = 'card-icon';
    iconEl.setAttribute('aria-hidden', 'true');
    iconEl.textContent = def.icon;

    const titleTextEl = document.createElement('span');
    titleTextEl.textContent = def.title;

    titleEl.append(iconEl, titleTextEl);

    const closeEl = document.createElement('button');
    closeEl.type = 'button';
    closeEl.className = 'card-close';
    closeEl.setAttribute('aria-label', def.title + ' 닫기');
    closeEl.textContent = '×';
    closeEl.addEventListener('click', function () {
      closeWidget(def.id);
    });

    headerEl.append(titleEl, closeEl);

    const bodyEl = document.createElement('div');
    bodyEl.className = 'card-body';

    cardEl.append(headerEl, bodyEl);
    return { cardEl: cardEl, headerEl: headerEl, bodyEl: bodyEl };
  }

  // isRestore: 새로고침 복원일 때는 저장된 z 순서를 그대로 살리고 맨 앞으로 올리지 않는다
  function showWidget(id, isRestore) {
    const def = findDefinition(id);
    if (!def || openCards[id]) {
      // 같은 위젯은 하나만 연다(PRD 4.1)
      return;
    }
    const widgetState = state.widgets[id];

    if (widgetState.x === null || widgetState.y === null) {
      const pos = getFirstOpenPosition(def);
      widgetState.x = pos.x;
      widgetState.y = pos.y;
    }

    const parts = createCard(def, widgetState);
    openCards[id] = parts;
    stageEl.appendChild(parts.cardEl);

    if (!isRestore) {
      bringToFront(id);
    }

    // 카드 어디를 눌러도 맨 앞으로(PRD F-00-6). 본문 버튼을 눌러도 올라오도록 카드 전체에 건다.
    parts.cardEl.addEventListener('pointerdown', function () {
      if (bringToFront(id)) {
        persist();
      }
    });

    // 끌기가 끝났을 때와 창 크기 변경으로 안으로 들어왔을 때 위치를 저장한다
    App.drag.makeDraggable(parts.cardEl, parts.headerEl, function (x, y) {
      widgetState.x = x;
      widgetState.y = y;
      persist();
    });

    // 위젯은 save(newData)로 자기 data만 바꾼다. 일부 항목만 넘겨도 되도록 합쳐서 저장한다.
    function saveData(newData) {
      widgetState.data = Object.assign({}, widgetState.data, newData);
      persist();
    }
    def.mount(parts.bodyEl, cloneData(widgetState.data), saveData);

    widgetState.open = true;
    updateToolbarButton(id);
    persist();
  }

  function openWidget(id) {
    showWidget(id, false);
  }

  function closeWidget(id) {
    const def = findDefinition(id);
    const card = openCards[id];
    if (!def || !card) {
      return;
    }
    // 인터벌·애니메이션·소리 정리는 카드를 지우기 전에 위젯에게 맡긴다(TRD 3.2)
    if (typeof def.unmount === 'function') {
      def.unmount();
    }
    card.cardEl.remove();
    delete openCards[id];

    state.widgets[id].open = false;
    updateToolbarButton(id);
    persist();
  }

  function toggleWidget(id) {
    if (openCards[id]) {
      closeWidget(id);
    } else {
      openWidget(id);
    }
  }

  // 아이콘(위)과 한글 이름(아래)을 가진 도구 모음 버튼을 만든다(PRD F-00-2)
  function createToolbarButton(icon, label) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'toolbar-button';

    const iconEl = document.createElement('span');
    iconEl.className = 'toolbar-icon';
    iconEl.setAttribute('aria-hidden', 'true');
    iconEl.textContent = icon;

    const labelEl = document.createElement('span');
    labelEl.className = 'toolbar-label';
    labelEl.textContent = label;

    button.append(iconEl, labelEl);
    return button;
  }

  function createWidgetButton(def) {
    const button = createToolbarButton(def.icon, def.title);
    button.dataset.widget = def.id;
    button.setAttribute('aria-pressed', 'false');
    button.addEventListener('click', function () {
      toggleWidget(def.id);
    });
    return button;
  }

  // 첫 번째 누름에는 문구만 바꾸고, 3초 안에 다시 눌러야 action을 실행한다(TRD 4.3).
  // 브라우저 알림창(confirm)은 쓰지 않는다(PRD F-00-9).
  // 버튼 안에 .confirm-label 요소가 있으면 그 글자만 바꾸고, 없으면 버튼 글자 전체를 바꾼다.
  // 돌려주는 함수는 대기 중인 확인을 취소한다(위젯 unmount에서 타이머 정리용).
  function confirmButton(buttonEl, confirmText, action) {
    const labelEl = buttonEl.querySelector('.confirm-label') || buttonEl;
    let timerId = null;
    let originalText = '';

    function restore() {
      clearTimeout(timerId);
      timerId = null;
      labelEl.textContent = originalText;
      buttonEl.classList.remove('is-confirming');
    }

    buttonEl.addEventListener('click', function () {
      if (timerId === null) {
        originalText = labelEl.textContent;
        labelEl.textContent = confirmText;
        buttonEl.classList.add('is-confirming');
        timerId = setTimeout(restore, CONFIRM_TIMEOUT_MS);
        return;
      }
      restore();
      action();
    });

    return function cancel() {
      if (timerId !== null) {
        restore();
      }
    };
  }

  function createFullscreenButton() {
    const button = createToolbarButton(FULLSCREEN_OFF.icon, FULLSCREEN_OFF.label);
    button.classList.add('toolbar-fullscreen');
    button.setAttribute('aria-pressed', 'false');

    // 전체 화면을 지원하지 않는 환경에서는 눌러도 아무 일이 없으므로 비활성화한다
    if (!document.fullscreenEnabled) {
      button.disabled = true;
      return button;
    }

    button.addEventListener('click', function () {
      // 요청이 거절돼도(권한, 브라우저 정책) 콘솔에 잡히지 않은 오류가 남지 않도록 처리한다
      const request = document.fullscreenElement
        ? document.exitFullscreen()
        : document.documentElement.requestFullscreen();
      request.catch(function (err) {
        console.warn('전체 화면을 전환하지 못했습니다.', err);
      });
    });

    // Esc로 해제될 때도 버튼 표시가 맞게 바뀌도록 버튼 클릭이 아니라 이 이벤트에서 갱신한다
    document.addEventListener('fullscreenchange', function () {
      const isFullscreen = Boolean(document.fullscreenElement);
      const look = isFullscreen ? FULLSCREEN_ON : FULLSCREEN_OFF;
      button.querySelector('.toolbar-icon').textContent = look.icon;
      button.querySelector('.toolbar-label').textContent = look.label;
      button.setAttribute('aria-pressed', String(isFullscreen));
    });

    return button;
  }

  function createResetButton() {
    const button = createToolbarButton(RESET_BUTTON.icon, RESET_BUTTON.label);
    button.classList.add('toolbar-reset');
    button.querySelector('.toolbar-label').classList.add('confirm-label');
    confirmButton(button, RESET_BUTTON.confirmText, function () {
      isResetting = true;
      App.storage.reset();
      location.reload();
    });
    return button;
  }

  function buildToolbar() {
    toolbarEl.textContent = '';
    definitions.forEach(function (def) {
      const button = createWidgetButton(def);
      toolbarButtons[def.id] = button;
      toolbarEl.appendChild(button);
    });

    const divider = document.createElement('span');
    divider.className = 'toolbar-divider';
    divider.setAttribute('aria-hidden', 'true');

    toolbarEl.append(divider, createFullscreenButton(), createResetButton());
  }

  // 배경 프리셋 목록은 background.js가 App.backgrounds로 넣는다(TRD 4.10).
  // 목록에 없는 id면 첫 번째 프리셋으로 대신한다.
  function findBackground(presetId) {
    const presets = App.backgrounds || [];
    return presets.find(function (preset) {
      return preset.id === presetId;
    }) || presets[0] || null;
  }

  function applyBackground(presetId) {
    const preset = findBackground(presetId);
    if (!preset) {
      // 프리셋 목록이 없으면 style.css의 기본 배경을 그대로 둔다
      return;
    }
    state.background = preset.id;
    stageEl.style.background = preset.css;
  }

  function setBackground(presetId) {
    applyBackground(presetId);
    persist();
  }

  function getBackground() {
    return state.background;
  }

  function registerWidget(definition) {
    if (!definition || typeof definition.id !== 'string' || typeof definition.mount !== 'function') {
      console.warn('위젯 정의가 올바르지 않아 등록하지 않았습니다.', definition);
      return;
    }
    if (findDefinition(definition.id)) {
      console.warn('이미 등록된 위젯입니다: ' + definition.id);
      return;
    }
    definitions.push(definition);
  }

  // main.js가 호출: 상태 불러오기 → 도구 모음 생성 → 열린 위젯 복원(TRD 3.1)
  function init() {
    stageEl = document.getElementById('stage');
    toolbarEl = document.getElementById('toolbar');
    state = App.storage.load();

    // 배경 카드가 닫혀 있어도 저장된 배경이 복원되도록 여기서 적용한다
    applyBackground(state.background);
    // 지금은 없는 위젯(개발 중 임시 위젯 등)의 저장 정보가 남지 않도록 지운다
    Object.keys(state.widgets).forEach(function (id) {
      if (!findDefinition(id)) {
        delete state.widgets[id];
      }
    });
    definitions.forEach(ensureWidgetState);
    buildToolbar();

    definitions.forEach(function (def) {
      if (state.widgets[def.id].open) {
        showWidget(def.id, true);
      }
    });
    persist();
  }

  App.registerWidget = registerWidget;
  App.init = init;
  App.openWidget = openWidget;
  App.closeWidget = closeWidget;
  App.toggleWidget = toggleWidget;
  App.confirmButton = confirmButton;
  App.setBackground = setBackground;
  App.getBackground = getBackground;
})();

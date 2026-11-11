// 메모장 위젯 (PRD 4.7, TRD 4.8)
(function () {
  'use strict';

  const App = window.App;

  // 입력할 때마다 저장하면 localStorage 쓰기가 너무 잦으므로 입력이 멈춘 뒤 저장한다(TRD 3.3)
  const SAVE_DEBOUNCE_MS = 300;

  const SIZES = [
    { id: 's', label: '작게' },
    { id: 'm', label: '보통' },
    { id: 'l', label: '크게' }
  ];

  const COLORS = [
    { id: 'black', label: '검정' },
    { id: 'red', label: '빨강' },
    { id: 'blue', label: '파랑' },
    { id: 'green', label: '초록' }
  ];

  // 카드를 닫을 때 대기 중인 저장과 이벤트를 정리하는 함수(mount에서 채운다)
  let cleanup = null;

  function hasOption(options, id) {
    return options.some(function (option) {
      return option.id === id;
    });
  }

  function createOptionButton(className, option) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = className;
    button.dataset.value = option.id;
    return button;
  }

  function markSelected(buttons, value) {
    buttons.forEach(function (button) {
      const isSelected = button.dataset.value === value;
      button.classList.toggle('is-active', isSelected);
      button.setAttribute('aria-pressed', String(isSelected));
    });
  }

  App.registerWidget({
    id: 'note',
    title: '메모장',
    icon: '📝',
    size: { w: 360, h: 300 },
    defaultData: { text: '', size: 'm', color: 'black' },

    mount: function (bodyEl, data, save) {
      // 저장값이 잘못돼 있으면(직접 고친 값 등) 기본값으로 시작한다
      let size = hasOption(SIZES, data.size) ? data.size : 'm';
      let color = hasOption(COLORS, data.color) ? data.color : 'black';
      let saveTimer = null;

      const controls = document.createElement('div');
      controls.className = 'note-controls';

      const sizeGroup = document.createElement('div');
      sizeGroup.className = 'note-group';
      sizeGroup.setAttribute('role', 'group');
      sizeGroup.setAttribute('aria-label', '글자 크기');
      const sizeButtons = SIZES.map(function (option) {
        const button = createOptionButton('note-size-button', option);
        button.textContent = option.label;
        sizeGroup.appendChild(button);
        return button;
      });

      const colorGroup = document.createElement('div');
      colorGroup.className = 'note-group';
      colorGroup.setAttribute('role', 'group');
      colorGroup.setAttribute('aria-label', '글자 색');
      const colorButtons = COLORS.map(function (option) {
        const button = createOptionButton('note-color-button note-swatch-' + option.id, option);
        // 색 동그라미만 보이는 버튼이라 설명 문구를 붙인다(TRD 5장 3번)
        button.setAttribute('aria-label', '글자 색 ' + option.label);
        button.title = option.label;
        colorGroup.appendChild(button);
        return button;
      });

      const clearButton = document.createElement('button');
      clearButton.type = 'button';
      clearButton.className = 'note-clear';
      clearButton.textContent = '지우기';

      controls.append(sizeGroup, colorGroup, clearButton);

      // textarea의 value는 글자 그대로 보여 주므로 <b> 같은 태그도 해석되지 않는다(PRD 4.7)
      const textarea = document.createElement('textarea');
      textarea.className = 'note-text';
      textarea.setAttribute('aria-label', '메모 내용');
      textarea.placeholder = '오늘의 과제를 적어 보세요';
      textarea.spellcheck = false;
      textarea.value = typeof data.text === 'string' ? data.text : '';

      function applyLook() {
        textarea.className = 'note-text note-size-' + size + ' note-color-' + color;
        markSelected(sizeButtons, size);
        markSelected(colorButtons, color);
      }

      function saveTextNow() {
        clearTimeout(saveTimer);
        saveTimer = null;
        save({ text: textarea.value });
      }

      function scheduleSave() {
        clearTimeout(saveTimer);
        saveTimer = setTimeout(saveTextNow, SAVE_DEBOUNCE_MS);
      }

      // 입력 직후 300ms 안에 새로고침·탭 닫기를 해도 마지막 글이 사라지지 않게 한다
      function onPageHide() {
        if (saveTimer !== null) {
          saveTextNow();
        }
      }

      textarea.addEventListener('input', scheduleSave);
      window.addEventListener('pagehide', onPageHide);

      sizeButtons.forEach(function (button) {
        button.addEventListener('click', function () {
          size = button.dataset.value;
          applyLook();
          save({ size: size });
        });
      });

      colorButtons.forEach(function (button) {
        button.addEventListener('click', function () {
          color = button.dataset.value;
          applyLook();
          save({ color: color });
        });
      });

      clearButton.addEventListener('click', function () {
        textarea.value = '';
        saveTextNow();
        textarea.focus();
      });

      bodyEl.append(controls, textarea);
      applyLook();

      cleanup = function () {
        // 닫기 직전에 입력한 글도 남도록 대기 중인 저장은 버리지 않고 바로 저장한다
        if (saveTimer !== null) {
          saveTextNow();
        }
        window.removeEventListener('pagehide', onPageHide);
      };
    },

    unmount: function () {
      if (cleanup) {
        cleanup();
        cleanup = null;
      }
    }
  });
})();

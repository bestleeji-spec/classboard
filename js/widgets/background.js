// 배경 위젯 (PRD 4.2, TRD 4.10)
(function () {
  'use strict';

  const App = window.App;

  // 이미지 파일을 쓰지 않으므로 CSS background 값만으로 만든다.
  // 첫 번째 프리셋은 저장값이 없거나 잘못됐을 때의 기본 배경이므로 storage.js의 기본값(sky)과 맞춘다.
  const PRESETS = [
    { id: 'sky', name: '하늘', css: 'linear-gradient(135deg, #89f7fe, #66a6ff)' },
    { id: 'sunset', name: '노을', css: 'linear-gradient(135deg, #ffd194, #f5576c)' },
    { id: 'forest', name: '숲', css: 'linear-gradient(135deg, #b7e4a8, #2f8f6b)' },
    { id: 'lavender', name: '라벤더', css: 'linear-gradient(135deg, #e0c3fc, #8e9ef5)' },
    { id: 'chalkboard', name: '칠판', css: '#2f4a3a' },
    { id: 'navy', name: '남색', css: '#1f2a44' },
    { id: 'cream', name: '크림', css: '#f3ead7' },
    { id: 'slate', name: '회색', css: '#6b7686' }
  ];

  App.backgrounds = PRESETS;

  function updateSelection(buttons, selectedId) {
    buttons.forEach(function (button) {
      const isSelected = button.dataset.preset === selectedId;
      button.classList.toggle('is-active', isSelected);
      button.setAttribute('aria-pressed', String(isSelected));
    });
  }

  function createOption(preset) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'background-option';
    button.dataset.preset = preset.id;

    // 미리보기 색은 실제 화면 배경과 같은 값을 써서 고르기 전에 결과를 볼 수 있게 한다
    const swatch = document.createElement('span');
    swatch.className = 'background-swatch';
    swatch.setAttribute('aria-hidden', 'true');
    swatch.style.background = preset.css;

    const name = document.createElement('span');
    name.className = 'background-name';
    name.textContent = preset.name;

    button.append(swatch, name);
    return button;
  }

  App.registerWidget({
    id: 'background',
    title: '배경',
    // 🖼 뒤에 이모지 표시 문자(U+FE0F)를 붙여야 흑백 기호가 아니라 컬러 이모지로 나온다
    icon: '🖼️',
    size: { w: 320, h: 240 },
    // 배경 id는 위젯 data가 아니라 저장 데이터 최상위 background에 둔다(TRD 3.3)
    defaultData: {},

    mount: function (bodyEl) {
      const grid = document.createElement('div');
      grid.className = 'background-grid';

      const buttons = PRESETS.map(createOption);
      buttons.forEach(function (button) {
        button.addEventListener('click', function () {
          App.setBackground(button.dataset.preset);
          updateSelection(buttons, App.getBackground());
        });
        grid.appendChild(button);
      });

      bodyEl.appendChild(grid);
      updateSelection(buttons, App.getBackground());
    },

    // 타이머·애니메이션을 쓰지 않으므로 정리할 것이 없다
    unmount: function () {}
  });
})();

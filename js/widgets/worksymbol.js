// 활동 상태 위젯 (PRD 4.9, TRD 4.10)
(function () {
  'use strict';

  const App = window.App;

  const STATES = [
    { id: 'quiet', icon: '🤫', label: '조용히' },
    { id: 'whisper', icon: '💬', label: '소곤소곤' },
    { id: 'group', icon: '👥', label: '모둠 활동' },
    { id: 'question', icon: '🙋', label: '질문하기' }
  ];

  const EMPTY_TEXT = '상태를 선택하세요';

  function findState(id) {
    return STATES.find(function (item) {
      return item.id === id;
    }) || null;
  }

  function createChoice(item) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'worksymbol-choice';
    button.dataset.state = item.id;

    const icon = document.createElement('span');
    icon.className = 'worksymbol-choice-icon';
    icon.setAttribute('aria-hidden', 'true');
    icon.textContent = item.icon;

    const label = document.createElement('span');
    label.className = 'worksymbol-choice-label';
    label.textContent = item.label;

    button.append(icon, label);
    return button;
  }

  App.registerWidget({
    id: 'worksymbol',
    title: '활동 상태',
    icon: '🤫',
    size: { w: 320, h: 320 },
    defaultData: { selected: null },

    mount: function (bodyEl, data, save) {
      // 저장값이 목록에 없는 id면(직접 고친 값 등) 선택 안 함으로 본다
      let selectedId = findState(data.selected) ? data.selected : null;

      const display = document.createElement('div');
      display.className = 'worksymbol-display';
      // 화면 읽기 프로그램에도 상태가 바뀐 것을 알린다
      display.setAttribute('aria-live', 'polite');

      const displayIcon = document.createElement('span');
      displayIcon.className = 'worksymbol-display-icon';
      displayIcon.setAttribute('aria-hidden', 'true');

      const displayLabel = document.createElement('span');
      displayLabel.className = 'worksymbol-display-label';

      display.append(displayIcon, displayLabel);

      const choices = document.createElement('div');
      choices.className = 'worksymbol-choices';
      const buttons = STATES.map(createChoice);

      function render() {
        const current = findState(selectedId);
        display.dataset.state = current ? current.id : '';
        displayIcon.textContent = current ? current.icon : '';
        displayLabel.textContent = current ? current.label : EMPTY_TEXT;
        display.classList.toggle('is-empty', !current);

        // 한 번에 하나만 선택된다
        buttons.forEach(function (button) {
          const isSelected = button.dataset.state === selectedId;
          button.classList.toggle('is-active', isSelected);
          button.setAttribute('aria-pressed', String(isSelected));
        });
      }

      buttons.forEach(function (button) {
        // <button>이라 Tab으로 이동하고 Enter·Space로 누를 수 있다(PRD 4.9 완료 기준)
        button.addEventListener('click', function () {
          const id = button.dataset.state;
          // 고른 상태를 다시 누르면 선택이 풀린다
          selectedId = selectedId === id ? null : id;
          save({ selected: selectedId });
          render();
        });
        choices.appendChild(button);
      });

      bodyEl.append(display, choices);
      render();
    },

    // 타이머·애니메이션을 쓰지 않으므로 정리할 것이 없다
    unmount: function () {}
  });
})();

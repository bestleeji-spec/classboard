// 주사위 위젯 (PRD 4.6, TRD 4.7)
(function () {
  'use strict';

  const App = window.App;

  const ROLL_FRAME_MS = 80;
  const ROLL_DURATION_MS = 1000;
  const PIP_SLOTS = 9;
  const COUNT_OPTIONS = [1, 2];
  const IDLE_TEXT = '굴리기를 눌러 보세요';

  // 카드를 닫을 때 굴리는 연출의 타이머를 정리하는 함수(mount에서 채운다)
  let cleanup = null;

  function randomFace() {
    return Math.floor(Math.random() * 6) + 1;
  }

  // 점 9칸을 미리 만들어 두고, 어느 칸을 보일지는 data-value에 따라 CSS가 고른다(TRD 4.7)
  function createDie() {
    const face = document.createElement('div');
    face.className = 'dice-face';
    face.setAttribute('role', 'img');
    for (let i = 0; i < PIP_SLOTS; i += 1) {
      const pip = document.createElement('span');
      pip.className = 'dice-pip';
      face.appendChild(pip);
    }
    return face;
  }

  function setFace(face, value) {
    face.dataset.value = String(value);
    face.setAttribute('aria-label', '주사위 ' + value);
  }

  App.registerWidget({
    id: 'dice',
    title: '주사위',
    icon: '🎲',
    size: { w: 300, h: 280 },
    defaultData: { count: 1 },

    mount: function (bodyEl, data, save) {
      let count = COUNT_OPTIONS.indexOf(data.count) >= 0 ? data.count : 1;
      let values = [1, 1];
      let hasRolled = false;
      let isRolling = false;
      let frameTimer = null;
      let stopTimer = null;

      // ----- 화면 만들기 -----
      const tray = document.createElement('div');
      tray.className = 'dice-tray';
      const faces = [createDie(), createDie()];
      tray.append(faces[0], faces[1]);

      const result = document.createElement('p');
      result.className = 'dice-result';
      // 굴린 결과를 화면 읽기 프로그램에도 알린다
      result.setAttribute('aria-live', 'polite');

      const controls = document.createElement('div');
      controls.className = 'dice-controls';

      const countGroup = document.createElement('div');
      countGroup.className = 'dice-count';
      countGroup.setAttribute('role', 'group');
      countGroup.setAttribute('aria-label', '주사위 개수');
      const countButtons = COUNT_OPTIONS.map(function (n) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'dice-count-button';
        button.dataset.count = String(n);
        button.textContent = n + '개';
        countGroup.appendChild(button);
        return button;
      });

      const rollButton = document.createElement('button');
      rollButton.type = 'button';
      rollButton.className = 'dice-roll';
      rollButton.textContent = '굴리기';

      controls.append(countGroup, rollButton);
      bodyEl.append(tray, result, controls);

      // ----- 상태 표시 -----
      function render() {
        faces.forEach(function (face, i) {
          face.hidden = i >= count;
          setFace(face, values[i]);
          face.classList.toggle('is-rolling', isRolling);
        });

        countButtons.forEach(function (button) {
          const isSelected = Number(button.dataset.count) === count;
          button.classList.toggle('is-active', isSelected);
          button.setAttribute('aria-pressed', String(isSelected));
          // 굴리는 중에는 개수도 바꾸지 못하게 해서 연출이 꼬이지 않게 한다
          button.disabled = isRolling;
        });
        // 굴리는 중에는 버튼이 눌리지 않는다(PRD 4.6)
        rollButton.disabled = isRolling;

        if (isRolling) {
          result.textContent = '굴리는 중…';
        } else if (!hasRolled) {
          result.textContent = IDLE_TEXT;
        } else if (count === 2) {
          // 2개일 때는 합계를 함께 보여 준다(PRD 4.6)
          result.textContent = '합계 ' + (values[0] + values[1]);
        } else {
          result.textContent = '나온 눈 ' + values[0];
        }
      }

      // ----- 동작 -----
      function clearTimers() {
        clearInterval(frameTimer);
        clearTimeout(stopTimer);
        frameTimer = null;
        stopTimer = null;
      }

      function shuffleFaces() {
        values = [randomFace(), randomFace()];
        render();
      }

      function finishRoll() {
        clearTimers();
        values = [randomFace(), randomFace()];
        isRolling = false;
        hasRolled = true;
        render();
      }

      // 80ms마다 임의의 눈을 보여 주다가 1초 뒤 최종 값으로 멈춘다(TRD 4.7)
      function roll() {
        if (isRolling) {
          return;
        }
        isRolling = true;
        shuffleFaces();
        frameTimer = setInterval(shuffleFaces, ROLL_FRAME_MS);
        stopTimer = setTimeout(finishRoll, ROLL_DURATION_MS);
      }

      countButtons.forEach(function (button) {
        button.addEventListener('click', function () {
          const n = Number(button.dataset.count);
          if (n === count) {
            return;
          }
          count = n;
          // 개수가 바뀌면 이전 결과의 합계가 맞지 않으므로 결과 안내를 처음으로 돌린다
          hasRolled = false;
          save({ count: count });
          render();
        });
      });
      rollButton.addEventListener('click', roll);

      render();

      cleanup = clearTimers;
    },

    unmount: function () {
      if (cleanup) {
        cleanup();
        cleanup = null;
      }
    }
  });
})();

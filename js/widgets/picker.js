// 제비뽑기 위젯 (PRD 4.5, TRD 4.6)
(function () {
  'use strict';

  const App = window.App;

  const ROLL_FRAME_MS = 80;
  const ROLL_DURATION_MS = 1500;
  const MIN_COUNT = 1;
  const MAX_COUNT = 5;
  // 이름 목록은 입력이 잦으므로 입력이 멈춘 뒤 저장한다(TRD 3.3)
  const SAVE_DEBOUNCE_MS = 300;
  // 긴 이름이 카드 너비를 넘으면 이 간격씩 줄이되, 이보다 작게는 줄이지 않는다(TRD 4.1)
  const FIT_STEP_PX = 4;
  const FIT_MIN_PX = 20;

  const TEXT_READY = '추첨을 눌러 보세요';
  const TEXT_EMPTY = '이름을 먼저 입력하세요';
  const TEXT_ALL_PICKED = '모두 뽑았어요';

  // 카드를 닫을 때 연출 타이머와 대기 중인 저장을 정리하는 함수(mount에서 채운다)
  let cleanup = null;

  // 빈 줄과 앞뒤 공백은 무시한다. 같은 이름이 두 번 있으면 두 명으로 본다(TRD 4.6)
  function parseNames(text) {
    return text.split('\n').map(function (s) {
      return s.trim();
    }).filter(Boolean);
  }

  // Fisher–Yates: 모든 순서가 같은 확률로 나오도록 섞는다(TRD 4.6)
  function shuffle(array) {
    const result = array.slice();
    for (let i = result.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      const temp = result[i];
      result[i] = result[j];
      result[j] = temp;
    }
    return result;
  }

  function clampCount(value) {
    const n = parseInt(value, 10);
    if (Number.isNaN(n)) {
      return MIN_COUNT;
    }
    return Math.min(Math.max(n, MIN_COUNT), MAX_COUNT);
  }

  // 저장된 순번 중 지금 목록 범위 안의 정수만, 중복 없이 남긴다
  function sanitizePicked(picked, nameCount) {
    if (!Array.isArray(picked)) {
      return [];
    }
    return picked.filter(function (index, i) {
      return Number.isInteger(index) && index >= 0 && index < nameCount && picked.indexOf(index) === i;
    });
  }

  // 글자 크기는 CSS가 인원 수에 맞춰 정하고, 그래도 넘치는 긴 이름만 넘치지 않을 때까지 줄인다
  function fitLine(line) {
    let size = parseFloat(getComputedStyle(line).fontSize);
    while (line.scrollWidth > line.clientWidth && size > FIT_MIN_PX) {
      size = Math.max(size - FIT_STEP_PX, FIT_MIN_PX);
      line.style.fontSize = size + 'px';
    }
  }

  function createButton(className, text) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = className;
    button.textContent = text;
    return button;
  }

  App.registerWidget({
    id: 'picker',
    title: '제비뽑기',
    icon: '🎯',
    size: { w: 360, h: 440 },
    defaultData: { names: '', count: 1, exclude: true, picked: [] },

    mount: function (bodyEl, data, save) {
      let namesText = typeof data.names === 'string' ? data.names : '';
      let count = clampCount(data.count);
      let exclude = data.exclude !== false;
      // 같은 이름이 여러 번 있을 수 있으므로 이름이 아니라 목록의 순번으로 기록한다(TRD 4.6)
      let picked = sanitizePicked(data.picked, parseNames(namesText).length);
      let isRolling = false;
      let frameTimer = null;
      let stopTimer = null;
      let saveTimer = null;

      // ----- 화면 만들기 -----
      const result = document.createElement('div');
      result.className = 'picker-result';
      result.setAttribute('aria-live', 'polite');

      const options = document.createElement('div');
      options.className = 'picker-options';

      const countGroup = document.createElement('div');
      countGroup.className = 'picker-count';
      countGroup.setAttribute('role', 'group');
      countGroup.setAttribute('aria-label', '뽑을 인원');
      const countLabel = document.createElement('span');
      countLabel.className = 'picker-count-label';
      countLabel.textContent = '인원';
      countGroup.appendChild(countLabel);
      const countButtons = [];
      for (let n = MIN_COUNT; n <= MAX_COUNT; n += 1) {
        const button = createButton('picker-count-button', String(n));
        button.dataset.count = String(n);
        button.setAttribute('aria-label', n + '명 뽑기');
        countButtons.push(button);
        countGroup.appendChild(button);
      }

      // 켜고 끄는 옵션이라 aria-pressed를 가진 버튼으로 만든다(TRD 5장 3번)
      const excludeButton = createButton('picker-exclude', '뽑힌 사람 제외');

      options.append(countGroup, excludeButton);

      const namesInput = document.createElement('textarea');
      namesInput.className = 'picker-names';
      namesInput.setAttribute('aria-label', '이름 목록, 한 줄에 한 명');
      namesInput.placeholder = '한 줄에 한 명씩 이름을 입력하세요';
      namesInput.spellcheck = false;
      namesInput.value = namesText;

      const footer = document.createElement('div');
      footer.className = 'picker-footer';
      const info = document.createElement('span');
      info.className = 'picker-info';
      const refillButton = createButton('picker-refill', '다시 채우기');
      const drawButton = createButton('picker-draw', '추첨');
      footer.append(info, refillButton, drawButton);

      bodyEl.append(result, options, namesInput, footer);

      // ----- 계산 -----
      function getNames() {
        return parseNames(namesText);
      }

      // 제외 옵션이 켜져 있으면 "전체 순번 − picked", 꺼져 있으면 전체 순번(TRD 4.6)
      function getCandidates() {
        const all = getNames().map(function (name, index) {
          return index;
        });
        if (!exclude) {
          return all;
        }
        return all.filter(function (index) {
          return picked.indexOf(index) === -1;
        });
      }

      // ----- 상태 표시 -----
      // 당첨자가 여러 명이면 한 줄에 한 명씩, 인원이 많을수록 글자를 줄인다(TRD 4.6)
      function showNames(list) {
        result.textContent = '';
        result.classList.remove('is-message');
        result.dataset.count = String(list.length);
        list.forEach(function (name) {
          const line = document.createElement('div');
          line.className = 'picker-result-name';
          line.textContent = name;
          result.appendChild(line);
          fitLine(line);
        });
      }

      function showMessage(text) {
        result.textContent = text;
        result.classList.add('is-message');
        delete result.dataset.count;
      }

      function renderControls() {
        const total = getNames().length;
        countButtons.forEach(function (button) {
          const isSelected = Number(button.dataset.count) === count;
          button.classList.toggle('is-active', isSelected);
          button.setAttribute('aria-pressed', String(isSelected));
          button.disabled = isRolling;
        });
        excludeButton.classList.toggle('is-active', exclude);
        excludeButton.setAttribute('aria-pressed', String(exclude));
        excludeButton.disabled = isRolling;

        // 추첨 중에 목록이 바뀌면 순번이 어긋나므로 잠시 고칠 수 없게 한다
        namesInput.readOnly = isRolling;
        drawButton.disabled = isRolling;
        refillButton.disabled = isRolling || picked.length === 0;
        result.setAttribute('aria-busy', String(isRolling));

        info.textContent = exclude
          ? '남은 인원 ' + getCandidates().length + ' / ' + total + '명'
          : '전체 ' + total + '명';
      }

      // ----- 저장 -----
      function saveNamesNow() {
        clearTimeout(saveTimer);
        saveTimer = null;
        save({ names: namesText, picked: picked });
      }

      function scheduleNamesSave() {
        clearTimeout(saveTimer);
        saveTimer = setTimeout(saveNamesNow, SAVE_DEBOUNCE_MS);
      }

      // 입력 직후 300ms 안에 새로고침해도 마지막 목록이 사라지지 않게 한다
      function onPageHide() {
        if (saveTimer !== null) {
          saveNamesNow();
        }
      }

      // ----- 추첨 -----
      function clearRollTimers() {
        clearInterval(frameTimer);
        clearTimeout(stopTimer);
        frameTimer = null;
        stopTimer = null;
      }

      function draw() {
        if (isRolling) {
          return;
        }
        // 대기 중인 목록 저장을 먼저 끝내서 추첨 결과(picked)와 목록이 같은 내용으로 저장되게 한다
        if (saveTimer !== null) {
          saveNamesNow();
        }

        const names = getNames();
        if (names.length === 0) {
          showMessage(TEXT_EMPTY);
          return;
        }
        const candidates = getCandidates();
        if (candidates.length === 0) {
          showMessage(TEXT_ALL_PICKED);
          return;
        }

        // 남은 인원이 뽑을 인원보다 적으면 남은 사람을 모두 뽑는다(PRD 4.5)
        const takeCount = Math.min(count, candidates.length);
        // 한 번의 추첨에서는 섞은 뒤 앞에서 가져오므로 같은 사람이 두 번 나오지 않는다
        const winners = shuffle(candidates).slice(0, takeCount);

        isRolling = true;
        renderControls();

        // 80ms마다 후보 이름을 무작위로 바꿔 보여 주다가 1.5초 뒤 최종 결과로 멈춘다(TRD 4.6)
        function showRandomFrame() {
          showNames(shuffle(candidates).slice(0, takeCount).map(function (index) {
            return names[index];
          }));
        }
        showRandomFrame();
        frameTimer = setInterval(showRandomFrame, ROLL_FRAME_MS);

        stopTimer = setTimeout(function () {
          clearRollTimers();
          isRolling = false;
          showNames(winners.map(function (index) {
            return names[index];
          }));
          if (exclude) {
            picked = picked.concat(winners);
            save({ picked: picked });
          }
          renderControls();
        }, ROLL_DURATION_MS);
      }

      // ----- 이벤트 -----
      namesInput.addEventListener('input', function () {
        namesText = namesInput.value;
        // 목록 내용이 바뀌면 순번이 어긋나므로 뽑힌 기록을 비운다(TRD 4.6)
        picked = [];
        renderControls();
        scheduleNamesSave();
      });

      countButtons.forEach(function (button) {
        button.addEventListener('click', function () {
          count = Number(button.dataset.count);
          save({ count: count });
          renderControls();
        });
      });

      excludeButton.addEventListener('click', function () {
        exclude = !exclude;
        save({ exclude: exclude });
        renderControls();
      });

      refillButton.addEventListener('click', function () {
        picked = [];
        save({ picked: picked });
        showMessage(TEXT_READY);
        renderControls();
      });

      drawButton.addEventListener('click', draw);
      window.addEventListener('pagehide', onPageHide);

      showMessage(TEXT_READY);
      renderControls();

      cleanup = function () {
        clearRollTimers();
        // 닫기 직전에 입력한 목록도 남도록 대기 중인 저장은 버리지 않고 바로 저장한다
        if (saveTimer !== null) {
          saveNamesNow();
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

// 스톱워치 위젯 (PRD 4.4, TRD 4.5)
(function () {
  'use strict';

  const App = window.App;

  const MAX_LAPS = 30;
  const MS_PER_CENTISECOND = 10;

  // 카드를 닫을 때 화면 갱신(requestAnimationFrame)을 멈추는 함수(mount에서 채운다)
  let cleanup = null;

  function pad2(n) {
    return String(n).padStart(2, '0');
  }

  // 1/100초 단위 정수를 MM:SS.cc로 바꾼다
  function formatCentiseconds(cs) {
    const totalSeconds = Math.floor(cs / 100);
    const minutes = Math.floor(totalSeconds / 60);
    return pad2(minutes) + ':' + pad2(totalSeconds % 60) + '.' + pad2(cs % 100);
  }

  function toCentiseconds(ms) {
    return Math.floor(ms / MS_PER_CENTISECOND);
  }

  function createButton(className, text) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = className;
    button.textContent = text;
    return button;
  }

  function createCell(className, text) {
    const cell = document.createElement('span');
    cell.className = className;
    cell.textContent = text;
    return cell;
  }

  App.registerWidget({
    id: 'stopwatch',
    title: '스톱워치',
    // ⏱ 뒤에 이모지 표시 문자(U+FE0F)를 붙여야 흑백 기호가 아니라 컬러 이모지로 나온다
    icon: '⏱️',
    size: { w: 320, h: 360 },
    // 새로고침하면 0으로 돌아가므로 저장할 데이터가 없다(TRD 3.3)
    defaultData: {},

    mount: function (bodyEl) {
      // 경과 = 보관된경과 + (지금 − 시작시각). 1씩 더하지 않아야 탭을 옮겨도 어긋나지 않는다(TRD 4.5)
      let storedMs = 0;
      let startedAt = 0;
      let isRunning = false;
      let frameId = null;
      // { index, splitCs, totalCs } — 최신 기록이 배열 앞에 온다
      let laps = [];

      // ----- 화면 만들기 -----
      const display = document.createElement('div');
      display.className = 'stopwatch-display';
      display.setAttribute('role', 'timer');

      const controls = document.createElement('div');
      controls.className = 'stopwatch-controls';
      const startButton = createButton('stopwatch-button stopwatch-start', '시작');
      const pauseButton = createButton('stopwatch-button stopwatch-pause', '일시정지');
      const lapButton = createButton('stopwatch-button stopwatch-lap', '랩');
      const resetButton = createButton('stopwatch-button stopwatch-reset', '초기화');
      controls.append(startButton, pauseButton, lapButton, resetButton);

      const lapHead = document.createElement('div');
      lapHead.className = 'stopwatch-lap-row stopwatch-lap-head';
      lapHead.setAttribute('aria-hidden', 'true');
      lapHead.append(
        createCell('stopwatch-lap-index', '번호'),
        createCell('stopwatch-lap-split', '구간'),
        createCell('stopwatch-lap-total', '누적')
      );

      // 길어지면 카드 크기는 그대로 두고 이 목록만 스크롤된다(PRD 4.4)
      const lapList = document.createElement('ol');
      lapList.className = 'stopwatch-laps';
      lapList.setAttribute('aria-label', '랩 기록');

      const lapEmpty = document.createElement('p');
      lapEmpty.className = 'stopwatch-laps-empty';
      lapEmpty.textContent = '랩 기록이 없습니다';

      const lapBox = document.createElement('div');
      lapBox.className = 'stopwatch-lap-box';
      lapBox.append(lapHead, lapList, lapEmpty);

      bodyEl.append(display, controls, lapBox);

      // ----- 상태 표시 -----
      function elapsedMs() {
        return isRunning ? storedMs + (Date.now() - startedAt) : storedMs;
      }

      function renderTime() {
        display.textContent = formatCentiseconds(toCentiseconds(elapsedMs()));
      }

      function renderButtons() {
        startButton.disabled = isRunning;
        startButton.textContent = !isRunning && storedMs > 0 ? '계속' : '시작';
        pauseButton.disabled = !isRunning;
        // 랩은 실행 중일 때만, 30개까지만(PRD 4.4, TRD 4.5)
        lapButton.disabled = !isRunning || laps.length >= MAX_LAPS;
        lapButton.textContent = laps.length >= MAX_LAPS ? '랩 ' + MAX_LAPS + '/' + MAX_LAPS : '랩';
        resetButton.disabled = isRunning === false && storedMs === 0 && laps.length === 0;
      }

      function renderLaps() {
        lapList.textContent = '';
        laps.forEach(function (lap) {
          const row = document.createElement('li');
          row.className = 'stopwatch-lap-row';
          row.append(
            createCell('stopwatch-lap-index', '랩 ' + lap.index),
            createCell('stopwatch-lap-split', formatCentiseconds(lap.splitCs)),
            createCell('stopwatch-lap-total', formatCentiseconds(lap.totalCs))
          );
          lapList.appendChild(row);
        });
        // 기록이 없을 때는 빈 목록 대신 안내 문구가 가운데에 오도록 목록을 숨긴다
        lapList.hidden = laps.length === 0;
        lapEmpty.hidden = laps.length > 0;
        // 새 기록이 위에 붙으므로 목록을 맨 위로 올려 바로 보이게 한다
        lapList.scrollTop = 0;
      }

      function render() {
        renderTime();
        renderButtons();
      }

      // ----- 동작 -----
      function loop() {
        renderTime();
        frameId = requestAnimationFrame(loop);
      }

      function stopLoop() {
        if (frameId !== null) {
          cancelAnimationFrame(frameId);
          frameId = null;
        }
      }

      function start() {
        if (isRunning) {
          return;
        }
        startedAt = Date.now();
        isRunning = true;
        stopLoop();
        frameId = requestAnimationFrame(loop);
        render();
      }

      function pause() {
        if (!isRunning) {
          return;
        }
        storedMs += Date.now() - startedAt;
        isRunning = false;
        stopLoop();
        render();
      }

      // 구간은 1/100초 정수로 계산해야, 화면에 보이는 구간 시간의 합이 누적 시간과 정확히 같다.
      // 밀리초로 빼고 나중에 자르면 자리 버림 때문에 0.01초씩 어긋날 수 있다.
      function lap() {
        if (!isRunning || laps.length >= MAX_LAPS) {
          return;
        }
        const totalCs = toCentiseconds(elapsedMs());
        const previousTotalCs = laps.length > 0 ? laps[0].totalCs : 0;
        laps.unshift({
          index: laps.length + 1,
          splitCs: totalCs - previousTotalCs,
          totalCs: totalCs
        });
        renderLaps();
        renderButtons();
      }

      function reset() {
        stopLoop();
        isRunning = false;
        storedMs = 0;
        laps = [];
        renderLaps();
        render();
      }

      startButton.addEventListener('click', start);
      pauseButton.addEventListener('click', pause);
      lapButton.addEventListener('click', lap);
      resetButton.addEventListener('click', reset);

      renderLaps();
      render();

      cleanup = stopLoop;
    },

    unmount: function () {
      if (cleanup) {
        cleanup();
        cleanup = null;
      }
    }
  });
})();

// 타이머 위젯 (PRD 4.3, TRD 4.4)
(function () {
  'use strict';

  const App = window.App;

  // 1초씩 빼지 않고 끝나는 시각과의 차이로 계산하므로, 갱신 간격은 화면이 매끄럽게 바뀔 정도면 된다
  const TICK_MS = 250;
  const WARNING_MS = 10 * 1000;
  const MAX_MINUTES = 99;
  const MAX_SECONDS = 59;
  const QUICK_MINUTES = [1, 3, 5, 10];

  // 알림음: 880Hz 소리를 0.2초씩 0.3초 간격으로 3번(TRD 4.4)
  const BEEP_FREQUENCY = 880;
  const BEEP_DURATION_S = 0.2;
  const BEEP_GAP_S = 0.3;
  const BEEP_COUNT = 3;
  const BEEP_VOLUME = 0.3;
  // 소리를 갑자기 켜고 끄면 '딱' 소리가 나므로 아주 짧게 키우고 줄인다
  const BEEP_RAMP_S = 0.01;

  // 카드를 닫을 때 인터벌·소리·깜빡임을 정리하는 함수(mount에서 채운다)
  let cleanup = null;

  // 숫자가 아니면 0, 범위를 넘으면 허용 범위로 자른다(TRD 4.4 입력값 보정)
  function clampInt(value, max) {
    const n = parseInt(value, 10);
    if (Number.isNaN(n)) {
      return 0;
    }
    return Math.min(Math.max(n, 0), max);
  }

  function pad2(n) {
    return String(n).padStart(2, '0');
  }

  // 남은 밀리초를 올림한 초로 바꿔야 "00:01"이 1초 동안 보이고 0이 되는 순간 끝난다
  function formatRemaining(ms) {
    const totalSeconds = Math.ceil(Math.max(ms, 0) / 1000);
    return pad2(Math.floor(totalSeconds / 60)) + ':' + pad2(totalSeconds % 60);
  }

  function createButton(className, text) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = className;
    button.textContent = text;
    return button;
  }

  function createNumberInput(className, max, label) {
    const input = document.createElement('input');
    input.type = 'number';
    input.className = className;
    input.min = '0';
    input.max = String(max);
    input.step = '1';
    input.inputMode = 'numeric';
    input.setAttribute('aria-label', label);
    return input;
  }

  App.registerWidget({
    id: 'timer',
    title: '타이머',
    icon: '⏳',
    size: { w: 320, h: 280 },
    defaultData: { minutes: 5, seconds: 0 },

    mount: function (bodyEl, data, save) {
      const cardEl = bodyEl.closest('.card');

      let minutes = clampInt(data.minutes, MAX_MINUTES);
      let seconds = clampInt(data.seconds, MAX_SECONDS);
      // 'idle' 설정값 표시, 'running' 진행 중, 'paused' 일시정지, 'ringing' 0이 되어 알리는 중
      let mode = 'idle';
      let remainingMs = 0;
      let endAt = 0;
      let tickTimer = null;
      let audioCtx = null;
      let oscillators = [];

      // ----- 화면 만들기 -----
      const display = document.createElement('div');
      display.className = 'timer-display';
      display.setAttribute('role', 'timer');
      display.setAttribute('aria-live', 'off');

      const settings = document.createElement('div');
      settings.className = 'timer-settings';

      const minutesInput = createNumberInput('timer-input', MAX_MINUTES, '분');
      const secondsInput = createNumberInput('timer-input', MAX_SECONDS, '초');
      const minutesUnit = document.createElement('span');
      minutesUnit.className = 'timer-unit';
      minutesUnit.textContent = '분';
      const secondsUnit = document.createElement('span');
      secondsUnit.className = 'timer-unit';
      secondsUnit.textContent = '초';

      const quickGroup = document.createElement('div');
      quickGroup.className = 'timer-quick';
      const quickButtons = QUICK_MINUTES.map(function (m) {
        const button = createButton('timer-quick-button', m + '분');
        button.dataset.minutes = String(m);
        quickGroup.appendChild(button);
        return button;
      });

      settings.append(minutesInput, minutesUnit, secondsInput, secondsUnit, quickGroup);

      const controls = document.createElement('div');
      controls.className = 'timer-controls';
      const startButton = createButton('timer-button timer-start', '시작');
      const pauseButton = createButton('timer-button timer-pause', '일시정지');
      const resetButton = createButton('timer-button timer-reset', '초기화');
      controls.append(startButton, pauseButton, resetButton);

      bodyEl.append(display, settings, controls);

      // ----- 상태 표시 -----
      function settingMs() {
        return (minutes * 60 + seconds) * 1000;
      }

      function currentMs() {
        if (mode === 'idle') {
          return settingMs();
        }
        if (mode === 'running') {
          return endAt - Date.now();
        }
        return remainingMs;
      }

      function render() {
        const ms = currentMs();
        display.textContent = formatRemaining(ms);
        // 세는 중에만 10초 이하 경고색을 쓴다(설정값이 10초 이하인 것은 경고가 아니다)
        display.classList.toggle('is-warning', mode !== 'idle' && ms <= WARNING_MS);

        const isRunning = mode === 'running';
        // 실행 중에는 시간 입력을 바꿀 수 없다(PRD 4.3)
        minutesInput.disabled = isRunning;
        secondsInput.disabled = isRunning;
        quickButtons.forEach(function (button) {
          button.disabled = isRunning;
        });
        startButton.disabled = isRunning || (mode === 'idle' && settingMs() === 0);
        startButton.textContent = mode === 'paused' ? '계속' : '시작';
        pauseButton.disabled = !isRunning;
      }

      function writeInputs() {
        minutesInput.value = pad2(minutes);
        secondsInput.value = pad2(seconds);
      }

      // 입력칸의 값을 보정해서 설정값으로 삼고 저장한다
      function readInputs() {
        minutes = clampInt(minutesInput.value, MAX_MINUTES);
        seconds = clampInt(secondsInput.value, MAX_SECONDS);
        writeInputs();
        save({ minutes: minutes, seconds: seconds });
      }

      // ----- 소리 -----
      // 브라우저는 사용자 동작 없이 소리를 막으므로 AudioContext는 시작 버튼을 누를 때 만든다(TRD 4.4)
      function prepareAudio() {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (!AudioContextClass) {
          return;
        }
        try {
          if (!audioCtx) {
            audioCtx = new AudioContextClass();
          }
          if (audioCtx.state === 'suspended') {
            audioCtx.resume();
          }
        } catch (err) {
          // 소리를 못 내도 타이머는 동작해야 한다
          console.warn('알림음을 준비하지 못했습니다.', err);
          audioCtx = null;
        }
      }

      function playBeeps() {
        if (!audioCtx) {
          return;
        }
        const startAt = audioCtx.currentTime;
        for (let i = 0; i < BEEP_COUNT; i += 1) {
          const t = startAt + i * (BEEP_DURATION_S + BEEP_GAP_S);
          const osc = audioCtx.createOscillator();
          const gain = audioCtx.createGain();
          osc.type = 'sine';
          osc.frequency.value = BEEP_FREQUENCY;
          gain.gain.setValueAtTime(0, t);
          gain.gain.linearRampToValueAtTime(BEEP_VOLUME, t + BEEP_RAMP_S);
          gain.gain.setValueAtTime(BEEP_VOLUME, t + BEEP_DURATION_S - BEEP_RAMP_S);
          gain.gain.linearRampToValueAtTime(0, t + BEEP_DURATION_S);
          osc.connect(gain);
          gain.connect(audioCtx.destination);
          osc.start(t);
          osc.stop(t + BEEP_DURATION_S);
          oscillators.push(osc);
        }
      }

      function stopBeeps() {
        oscillators.forEach(function (osc) {
          try {
            osc.stop();
          } catch (err) {
            // 이미 끝난 소리는 stop에서 오류가 날 수 있는데, 멈추려던 목적은 이뤄졌으므로 무시한다
          }
        });
        oscillators = [];
      }

      // ----- 동작 -----
      function stopTicking() {
        clearInterval(tickTimer);
        tickTimer = null;
      }

      function ring() {
        stopTicking();
        mode = 'ringing';
        remainingMs = 0;
        cardEl.classList.add('is-ringing');
        playBeeps();
        render();
      }

      function stopRinging() {
        stopBeeps();
        cardEl.classList.remove('is-ringing');
        mode = 'idle';
        render();
      }

      function tick() {
        if (endAt - Date.now() <= 0) {
          ring();
          return;
        }
        render();
      }

      function start() {
        if (mode === 'running') {
          return;
        }
        if (mode === 'idle') {
          readInputs();
          remainingMs = settingMs();
        }
        // 0분 0초로는 시작하지 않는다(PRD 4.3)
        if (remainingMs <= 0) {
          render();
          return;
        }
        prepareAudio();
        endAt = Date.now() + remainingMs;
        mode = 'running';
        tickTimer = setInterval(tick, TICK_MS);
        render();
      }

      function pause() {
        if (mode !== 'running') {
          return;
        }
        remainingMs = Math.max(endAt - Date.now(), 0);
        stopTicking();
        mode = 'paused';
        render();
      }

      function reset() {
        stopTicking();
        mode = 'idle';
        render();
      }

      // 설정을 바꾸면 일시정지 중이던 남은 시간은 버리고 새 설정값을 보여 준다
      function onSettingChange() {
        readInputs();
        mode = 'idle';
        render();
      }

      // ----- 이벤트 -----
      // 알림 중에는 카드 안의 아무 버튼이나 눌러 멈추고, 그 누름은 원래 동작으로 이어지지 않게 한다(PRD 4.3).
      // 캡처 단계에서 받아야 각 버튼의 click 처리보다 먼저 실행된다.
      function onRingingClick(e) {
        if (mode === 'ringing' && e.target.closest('button')) {
          e.stopPropagation();
          stopRinging();
        }
      }
      bodyEl.addEventListener('click', onRingingClick, true);

      startButton.addEventListener('click', start);
      pauseButton.addEventListener('click', pause);
      resetButton.addEventListener('click', reset);

      minutesInput.addEventListener('change', onSettingChange);
      secondsInput.addEventListener('change', onSettingChange);

      quickButtons.forEach(function (button) {
        button.addEventListener('click', function () {
          minutesInput.value = button.dataset.minutes;
          secondsInput.value = '0';
          onSettingChange();
        });
      });

      writeInputs();
      render();

      cleanup = function () {
        stopTicking();
        stopBeeps();
        cardEl.classList.remove('is-ringing');
        if (audioCtx) {
          audioCtx.close().catch(function () {});
          audioCtx = null;
        }
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

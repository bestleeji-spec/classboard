// 그림판 위젯 (PRD 4.8, TRD 4.9)
(function () {
  'use strict';

  const App = window.App;

  // 캔버스 속성 크기와 CSS 크기가 다르면 좌표가 어긋나므로 같은 값으로 고정한다(TRD 4.9)
  const CANVAS_WIDTH = 480;
  const CANVAS_HEIGHT = 300;
  const ERASER_WIDTH = 24;
  const MOUSE_LEFT_BUTTON = 0;
  const IMAGE_PREFIX = 'data:image/png';

  const COLORS = [
    { id: 'black', label: '검정', value: '#1f2933' },
    { id: 'red', label: '빨강', value: '#e03131' },
    { id: 'blue', label: '파랑', value: '#1c64d6' },
    { id: 'green', label: '초록', value: '#2b8a3e' },
    { id: 'yellow', label: '노랑', value: '#f5c400' },
    { id: 'purple', label: '보라', value: '#7b3fe4' }
  ];

  const WIDTHS = [
    { id: 'thin', label: '가늘게', value: 3 },
    { id: 'normal', label: '보통', value: 6 },
    { id: 'thick', label: '굵게', value: 12 }
  ];

  // 카드를 닫을 때 그리기 상태와 "모두 지우기" 확인 대기를 정리하는 함수(mount에서 채운다)
  let cleanup = null;

  function createButton(className) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = className;
    return button;
  }

  function markSelected(buttons, selectedId) {
    buttons.forEach(function (button) {
      const isSelected = button.dataset.id === selectedId;
      button.classList.toggle('is-active', isSelected);
      button.setAttribute('aria-pressed', String(isSelected));
    });
  }

  App.registerWidget({
    id: 'draw',
    title: '그림판',
    icon: '🎨',
    size: { w: 520, h: 440 },
    defaultData: { image: null },

    mount: function (bodyEl, data, save) {
      let colorId = COLORS[0].id;
      let widthId = WIDTHS[1].id;
      let isEraser = false;
      // 그리는 중인 포인터와 직전 점. 다른 손가락이 끼어들어도 처음 손가락만 따라간다
      let stroke = null;

      // ----- 화면 만들기 -----
      const tools = document.createElement('div');
      tools.className = 'draw-tools';

      const colorGroup = document.createElement('div');
      colorGroup.className = 'draw-group';
      colorGroup.setAttribute('role', 'group');
      colorGroup.setAttribute('aria-label', '펜 색');
      const colorButtons = COLORS.map(function (color) {
        const button = createButton('draw-color');
        button.dataset.id = color.id;
        button.style.background = color.value;
        // 색 동그라미만 보이는 버튼이라 설명 문구를 붙인다(TRD 5장 3번)
        button.setAttribute('aria-label', '펜 색 ' + color.label);
        button.title = color.label;
        colorGroup.appendChild(button);
        return button;
      });

      const widthGroup = document.createElement('div');
      widthGroup.className = 'draw-group';
      widthGroup.setAttribute('role', 'group');
      widthGroup.setAttribute('aria-label', '펜 굵기');
      const widthButtons = WIDTHS.map(function (width) {
        const button = createButton('draw-width');
        button.dataset.id = width.id;
        button.setAttribute('aria-label', '굵기 ' + width.label);
        button.title = width.label;
        // 실제 굵기만 한 점을 보여 줘서 글자 없이도 차이를 알 수 있게 한다
        const dot = document.createElement('span');
        dot.className = 'draw-width-dot';
        dot.setAttribute('aria-hidden', 'true');
        dot.style.width = width.value + 'px';
        dot.style.height = width.value + 'px';
        button.appendChild(dot);
        widthGroup.appendChild(button);
        return button;
      });

      const eraserButton = createButton('draw-eraser');
      eraserButton.textContent = '지우개';

      const clearButton = createButton('draw-clear');
      clearButton.textContent = '모두 지우기';

      tools.append(colorGroup, widthGroup, eraserButton, clearButton);

      const canvas = document.createElement('canvas');
      canvas.className = 'draw-canvas';
      canvas.width = CANVAS_WIDTH;
      canvas.height = CANVAS_HEIGHT;
      canvas.style.width = CANVAS_WIDTH + 'px';
      canvas.style.height = CANVAS_HEIGHT + 'px';
      canvas.setAttribute('role', 'img');
      canvas.setAttribute('aria-label', '그림판');

      bodyEl.append(tools, canvas);

      const ctx = canvas.getContext('2d');
      // 빠르게 그어도 선이 끊기지 않고 이음매가 둥글게 이어지도록 한다(TRD 4.9)
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      // ----- 도구 상태 -----
      function currentColor() {
        return COLORS.find(function (c) {
          return c.id === colorId;
        }).value;
      }

      function currentWidth() {
        return isEraser ? ERASER_WIDTH : WIDTHS.find(function (w) {
          return w.id === widthId;
        }).value;
      }

      function renderTools() {
        // 지우개를 쓰는 동안에는 펜 색 선택 표시를 끄고 지우개만 강조한다
        markSelected(colorButtons, isEraser ? null : colorId);
        markSelected(widthButtons, widthId);
        eraserButton.classList.toggle('is-active', isEraser);
        eraserButton.setAttribute('aria-pressed', String(isEraser));
        canvas.classList.toggle('is-erasing', isEraser);
      }

      // 지우개는 지나간 자리를 투명하게 만든다. 캔버스는 투명하고 흰색은 CSS 배경이므로
      // 배경까지 지워지지 않는다(TRD 4.9). 펜으로 돌아오면 원래 방식으로 되돌린다.
      function applyBrush() {
        ctx.globalCompositeOperation = isEraser ? 'destination-out' : 'source-over';
        ctx.strokeStyle = currentColor();
        ctx.fillStyle = currentColor();
        ctx.lineWidth = currentWidth();
      }

      // ----- 그리기 -----
      function getPoint(e) {
        const rect = canvas.getBoundingClientRect();
        return { x: e.clientX - rect.left, y: e.clientY - rect.top };
      }

      // 클릭만 하고 움직이지 않아도 점이 찍히도록 둥근 점을 하나 그린다
      function drawDot(p) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, currentWidth() / 2, 0, Math.PI * 2);
        ctx.fill();
      }

      // 직전 점에서 현재 점까지 선으로 잇는다. 점만 찍으면 빠르게 그을 때 끊긴다(TRD 4.9)
      function drawSegment(from, to) {
        ctx.beginPath();
        ctx.moveTo(from.x, from.y);
        ctx.lineTo(to.x, to.y);
        ctx.stroke();
      }

      function saveImage() {
        save({ image: canvas.toDataURL('image/png') });
      }

      function onPointerDown(e) {
        if (stroke || (e.pointerType === 'mouse' && e.button !== MOUSE_LEFT_BUTTON)) {
          return;
        }
        // 글자 선택이나 터치 스크롤 같은 기본 동작이 그리기를 방해하지 않게 한다
        e.preventDefault();
        // 빠르게 그어 포인터가 캔버스 밖으로 나가도 선이 이어지게 한다(TRD 4.9)
        canvas.setPointerCapture(e.pointerId);
        applyBrush();
        const p = getPoint(e);
        stroke = { pointerId: e.pointerId, last: p };
        drawDot(p);
      }

      function onPointerMove(e) {
        if (!stroke || e.pointerId !== stroke.pointerId) {
          return;
        }
        // 브라우저가 한 프레임에 묶어 보낸 중간 좌표까지 써서 빠른 선도 매끄럽게 그린다
        const events = typeof e.getCoalescedEvents === 'function' ? e.getCoalescedEvents() : [];
        const list = events.length > 0 ? events : [e];
        list.forEach(function (ev) {
          const p = getPoint(ev);
          drawSegment(stroke.last, p);
          stroke.last = p;
        });
      }

      // 선 하나를 다 그었을 때 한 번 저장한다(TRD 4.9)
      function onPointerEnd(e) {
        if (!stroke || e.pointerId !== stroke.pointerId) {
          return;
        }
        stroke = null;
        if (canvas.hasPointerCapture(e.pointerId)) {
          canvas.releasePointerCapture(e.pointerId);
        }
        saveImage();
      }

      canvas.addEventListener('pointerdown', onPointerDown);
      canvas.addEventListener('pointermove', onPointerMove);
      canvas.addEventListener('pointerup', onPointerEnd);
      canvas.addEventListener('pointercancel', onPointerEnd);
      canvas.addEventListener('lostpointercapture', onPointerEnd);

      // ----- 도구 버튼 -----
      colorButtons.forEach(function (button) {
        button.addEventListener('click', function () {
          colorId = button.dataset.id;
          // 색을 고르면 지우개에서 펜으로 돌아온다
          isEraser = false;
          renderTools();
        });
      });

      widthButtons.forEach(function (button) {
        button.addEventListener('click', function () {
          widthId = button.dataset.id;
          isEraser = false;
          renderTools();
        });
      });

      eraserButton.addEventListener('click', function () {
        isEraser = !isEraser;
        renderTools();
      });

      // 두 번 눌러야 실행된다(PRD 4.8, TRD 4.3)
      const cancelClearConfirm = App.confirmButton(clearButton, '정말 지울까요?', function () {
        ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
        save({ image: null });
      });

      // ----- 저장된 그림 복원 -----
      if (typeof data.image === 'string' && data.image.indexOf(IMAGE_PREFIX) === 0) {
        const img = new Image();
        img.onload = function () {
          // 그림을 불러오기 전에 이미 그은 선이 있으면 그 선이 위에 남도록 뒤쪽에 그린다
          ctx.save();
          ctx.globalCompositeOperation = 'destination-over';
          ctx.drawImage(img, 0, 0);
          ctx.restore();
        };
        img.src = data.image;
      }

      renderTools();

      cleanup = function () {
        stroke = null;
        cancelClearConfirm();
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

// 카드 끌기 (TRD 4.2)
// 마우스와 터치를 한 번에 처리하려고 Pointer Events를 쓴다.
(function () {
  'use strict';

  const MOUSE_LEFT_BUTTON = 0;

  const App = window.App || (window.App = {});

  // 창 크기가 바뀔 때 다시 제한해야 하므로 끌기를 붙인 카드를 기억해 둔다
  const entries = [];

  // 카드 아래쪽이 도구 모음과 겹치지 않도록, 화면 아래에서 도구 모음이 차지하는 높이를 구한다.
  // 값은 style.css의 변수를 그대로 읽어서 CSS와 JS가 어긋나지 않게 한다.
  function getToolbarSpace() {
    const styles = getComputedStyle(document.documentElement);
    const toolbarHeight = parseFloat(styles.getPropertyValue('--toolbar-height')) || 0;
    const toolbarGap = parseFloat(styles.getPropertyValue('--toolbar-gap')) || 0;
    return toolbarHeight + toolbarGap;
  }

  // 0 ≤ x ≤ 화면너비 − 카드너비, 0 ≤ y ≤ 화면높이 − 카드높이 − 도구모음높이.
  // 창이 카드보다 작으면 최댓값이 음수가 되는데, 그때도 0에 붙여서 제목 줄은 항상 잡을 수 있게 한다.
  function clampPosition(cardEl, x, y) {
    const maxX = window.innerWidth - cardEl.offsetWidth;
    const maxY = window.innerHeight - cardEl.offsetHeight - getToolbarSpace();
    return {
      x: Math.round(Math.max(0, Math.min(x, maxX))),
      y: Math.round(Math.max(0, Math.min(y, maxY)))
    };
  }

  function setPosition(cardEl, pos) {
    cardEl.style.left = pos.x + 'px';
    cardEl.style.top = pos.y + 'px';
  }

  // 현재 위치가 범위를 벗어나 있으면 안으로 넣고, 옮겼으면 onEnd로 알린다
  function keepInside(entry) {
    const cardEl = entry.cardEl;
    const pos = clampPosition(cardEl, cardEl.offsetLeft, cardEl.offsetTop);
    if (pos.x !== cardEl.offsetLeft || pos.y !== cardEl.offsetTop) {
      setPosition(cardEl, pos);
      entry.onEnd(pos.x, pos.y);
    }
  }

  function makeDraggable(cardEl, handleEl, onEnd) {
    const entry = { cardEl: cardEl, onEnd: onEnd };
    entries.push(entry);

    // pointerId: 끌기를 시작한 손가락·마우스만 따라가기 위해 기억한다
    let drag = null;

    function onPointerDown(e) {
      if (e.pointerType === 'mouse' && e.button !== MOUSE_LEFT_BUTTON) {
        return;
      }
      // 닫기 버튼을 누른 것은 끌기가 아니라 클릭으로 처리해야 한다
      if (e.target.closest('button')) {
        return;
      }
      // 끄는 동안 글자가 선택되는 것을 막는다
      e.preventDefault();
      // 빠르게 끌어 포인터가 제목 줄 밖으로 나가도 이벤트를 계속 받는다
      handleEl.setPointerCapture(e.pointerId);
      drag = {
        pointerId: e.pointerId,
        startX: e.clientX,
        startY: e.clientY,
        startLeft: cardEl.offsetLeft,
        startTop: cardEl.offsetTop,
        moved: false
      };
      cardEl.classList.add('is-dragging');
    }

    function onPointerMove(e) {
      if (!drag || e.pointerId !== drag.pointerId) {
        return;
      }
      const pos = clampPosition(
        cardEl,
        drag.startLeft + (e.clientX - drag.startX),
        drag.startTop + (e.clientY - drag.startY)
      );
      if (pos.x !== cardEl.offsetLeft || pos.y !== cardEl.offsetTop) {
        setPosition(cardEl, pos);
        drag.moved = true;
      }
    }

    // 이동 중에는 저장하지 않고, 끝났을 때 한 번만 저장한다
    function onPointerEnd(e) {
      if (!drag || e.pointerId !== drag.pointerId) {
        return;
      }
      const moved = drag.moved;
      drag = null;
      cardEl.classList.remove('is-dragging');
      if (handleEl.hasPointerCapture(e.pointerId)) {
        handleEl.releasePointerCapture(e.pointerId);
      }
      if (moved) {
        onEnd(cardEl.offsetLeft, cardEl.offsetTop);
      }
    }

    handleEl.addEventListener('pointerdown', onPointerDown);
    handleEl.addEventListener('pointermove', onPointerMove);
    handleEl.addEventListener('pointerup', onPointerEnd);
    handleEl.addEventListener('pointercancel', onPointerEnd);
    handleEl.addEventListener('lostpointercapture', onPointerEnd);

    // 저장된 위치가 지금 창보다 바깥일 수 있으므로(작은 화면에서 다시 연 경우) 붙이자마자 한 번 맞춘다
    keepInside(entry);
  }

  // 창을 줄이면 화면 밖에 걸친 카드를 안으로 들인다(PRD F-00-10)
  window.addEventListener('resize', function () {
    for (let i = entries.length - 1; i >= 0; i -= 1) {
      // 닫힌 카드는 화면에서 빠졌으므로 목록에서도 지운다
      if (!entries[i].cardEl.isConnected) {
        entries.splice(i, 1);
      } else {
        keepInside(entries[i]);
      }
    }
  });

  App.drag = {
    makeDraggable: makeDraggable
  };
})();

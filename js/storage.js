// 저장·불러오기 (TRD 3.3)
// 앱 상태 전체를 localStorage의 키 하나에 JSON으로 저장한다.
(function () {
  'use strict';

  const STORAGE_KEY = 'classboard:v1';
  const DEFAULT_BACKGROUND = 'sky';
  const DEFAULT_Z_TOP = 0;

  // storage.js가 가장 먼저 실행되므로 여기서 전역 App을 만든다(전역은 App 하나만)
  const App = window.App || (window.App = {});

  // 처음 방문하거나 저장값이 깨졌을 때 쓰는 기본 상태.
  // 위젯별 defaultData 채우기는 위젯 정의를 아는 app.js가 맡는다.
  function createDefaultState() {
    return {
      background: DEFAULT_BACKGROUND,
      zTop: DEFAULT_Z_TOP,
      widgets: {}
    };
  }

  function isPlainObject(value) {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }

  // JSON은 정상이어도 모양이 다를 수 있으므로(직접 고친 값, 옛 버전 등)
  // 항목마다 검사해서 잘못된 것만 기본값으로 바꾼다.
  function normalizeState(raw) {
    const state = createDefaultState();
    if (!isPlainObject(raw)) {
      return state;
    }
    if (typeof raw.background === 'string' && raw.background !== '') {
      state.background = raw.background;
    }
    if (Number.isFinite(raw.zTop) && raw.zTop >= 0) {
      state.zTop = raw.zTop;
    }
    if (isPlainObject(raw.widgets)) {
      Object.keys(raw.widgets).forEach(function (id) {
        if (isPlainObject(raw.widgets[id])) {
          state.widgets[id] = raw.widgets[id];
        }
      });
    }
    return state;
  }

  // 값이 없거나, JSON이 깨졌거나, localStorage 접근이 막혀도
  // 앱이 멈추지 않도록 항상 기본 상태를 돌려준다.
  function load() {
    try {
      const text = window.localStorage.getItem(STORAGE_KEY);
      if (text === null) {
        return createDefaultState();
      }
      return normalizeState(JSON.parse(text));
    } catch (err) {
      console.warn('저장된 상태를 읽지 못해 기본 상태로 시작합니다.', err);
      return createDefaultState();
    }
  }

  // 저장 공간 부족 등으로 실패해도 앱은 계속 동작해야 하므로 예외를 밖으로 던지지 않는다.
  // 성공 여부만 true/false로 알려 준다.
  function save(state) {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      return true;
    } catch (err) {
      console.warn('상태를 저장하지 못했습니다.', err);
      return false;
    }
  }

  function reset() {
    try {
      window.localStorage.removeItem(STORAGE_KEY);
      return true;
    } catch (err) {
      console.warn('저장된 상태를 지우지 못했습니다.', err);
      return false;
    }
  }

  App.storage = {
    load: load,
    save: save,
    reset: reset
  };
})();

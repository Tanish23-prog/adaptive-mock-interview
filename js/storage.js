(function () {
  const fallbackQuestions = window.AppData.fallbackQuestions;
  const KEYS = {
    questionBank: "adaptiveInterview.questionBank",
    sessions: "adaptiveInterview.sessions",
    appState: "adaptiveInterview.appState",
  };

  function parseJSON(value, fallback) {
    try {
      return value ? JSON.parse(value) : fallback;
    } catch {
      return fallback;
    }
  }

  function writeJSON(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  async function seedQuestionBank() {
    const existing = parseJSON(localStorage.getItem(KEYS.questionBank), null);
    if (Array.isArray(existing) && existing.length) {
      return existing;
    }

    writeJSON(KEYS.questionBank, fallbackQuestions);
    return fallbackQuestions;
  }

  function getQuestionBank() {
    return parseJSON(localStorage.getItem(KEYS.questionBank), []);
  }

  function getSessions() {
    return parseJSON(localStorage.getItem(KEYS.sessions), []);
  }

  function saveSession(session) {
    const sessions = getSessions();
    sessions.push(session);
    writeJSON(KEYS.sessions, sessions);
  }

  function getAppState() {
    return parseJSON(localStorage.getItem(KEYS.appState), {});
  }

  function saveAppState(state) {
    writeJSON(KEYS.appState, state);
  }

  function clearAllData() {
    Object.values(KEYS).forEach((key) => localStorage.removeItem(key));
  }

  window.AppStorage = {
    seedQuestionBank,
    getQuestionBank,
    getSessions,
    saveSession,
    getAppState,
    saveAppState,
    clearAllData,
  };
})();

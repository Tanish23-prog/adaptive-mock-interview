;(function () {
const {
  clearAllData,
  getAppState,
  getQuestionBank,
  getSessions,
  saveAppState,
  saveSession,
  seedQuestionBank,
} = window.AppStorage;
const {
  buildSuggestions,
  calculateConfidenceIndex,
  calculateConfidenceDetails,
  chooseNextQuestion,
  determineNextDifficulty,
  scoreQuestion,
} = window.InterviewEngine;
const { buildSidebarStats, computeAnalytics } = window.Analytics;
const {
  renderAnswerInput,
  renderAnalyticsHighlights,
  renderCharts,
  renderEmptyDashboard,
  renderInterviewState,
  renderLandingStats,
  renderResults,
  renderSidebarStats,
  renderSuggestions,
  setThemeButtonLabel,
  showView,
} = window.AppUI;
const THEME_KEY = "adaptiveInterview.theme";

const state = {
  questionBank: [],
  sessions: [],
  activeSession: null,
  timerId: null,
  remainingSeconds: 0,
  questionStartedAt: 0,
  lastRenderedQuestionId: null,
  lastConfig: {
    category: "DSA",
    difficulty: "Medium",
    questionCount: 5,
    timerSeconds: 90,
  },
};

const categorySelect = document.getElementById("categorySelect");
const difficultySelect = document.getElementById("difficultySelect");
const questionCountSelect = document.getElementById("questionCountSelect");
const timerSelect = document.getElementById("timerSelect");
const setupForm = document.getElementById("setupForm");
const submitAnswerBtn = document.getElementById("submitAnswerBtn");
const skipQuestionBtn = document.getElementById("skipQuestionBtn");
const retrySessionBtn = document.getElementById("retrySessionBtn");
const clearDataBtn = document.getElementById("clearDataBtn");
const resumeLastSessionBtn = document.getElementById("resumeLastSessionBtn");
const themeToggleBtn = document.getElementById("themeToggleBtn");

function applyTheme(theme) {
  const isDarkMode = theme === "dark";
  document.body.classList.toggle("dark-mode", isDarkMode);
  localStorage.setItem(THEME_KEY, theme);
  setThemeButtonLabel(isDarkMode);

  if (state.sessions.length) {
    const analytics = computeAnalytics(state.sessions);
    renderAnalyticsHighlights(analytics);
    renderCharts(analytics);
  }
}

function initializeTheme() {
  const savedTheme = localStorage.getItem(THEME_KEY);
  const systemPrefersDark =
    window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
  applyTheme(savedTheme || (systemPrefersDark ? "dark" : "light"));
}

function getSetupConfig() {
  return {
    category: categorySelect.value,
    difficulty: difficultySelect.value,
    questionCount: Number(questionCountSelect.value),
    timerSeconds: Number(timerSelect.value),
  };
}

function syncSetupConfig() {
  state.lastConfig = getSetupConfig();
}

function updatePersistentUi() {
  state.sessions = getSessions();
  renderLandingStats(state.sessions);
  renderSidebarStats(buildSidebarStats(state.sessions));

  if (state.sessions.length) {
    const analytics = computeAnalytics(state.sessions);
    renderAnalyticsHighlights(analytics);
    renderCharts(analytics);
    renderSuggestions(buildSuggestions(state.sessions));
  } else {
    document.getElementById("analyticsHighlights").innerHTML = "";
    renderEmptyDashboard();
  }
}

function createSession(config) {
  const firstQuestion = chooseNextQuestion({
    questionBank: state.questionBank,
    category: config.category,
    targetDifficulty: config.difficulty,
    usedQuestionIds: [],
  });

  if (!firstQuestion) {
    alert("No questions are available for the selected setup.");
    return null;
  }

  return {
    id: `session-${Date.now()}`,
    category: config.category,
    initialDifficulty: config.difficulty,
    currentDifficulty: config.difficulty,
    finalDifficulty: config.difficulty,
    questionCount: config.questionCount,
    timerSeconds: config.timerSeconds,
    currentQuestionIndex: 0,
    usedQuestionIds: [],
    questionResults: [],
    currentQuestion: firstQuestion,
    adaptiveNotes: ["Session started. The first question uses your chosen difficulty."],
  };
}

function saveWorkingState() {
  saveAppState({
    activeSession: state.activeSession,
    lastConfig: state.lastConfig,
  });
}

function restoreWorkingState() {
  const persisted = getAppState();
  if (persisted.lastConfig) {
    state.lastConfig = persisted.lastConfig;
    categorySelect.value = persisted.lastConfig.category;
    difficultySelect.value = persisted.lastConfig.difficulty;
    questionCountSelect.value = String(persisted.lastConfig.questionCount);
    timerSelect.value = String(persisted.lastConfig.timerSeconds);
  }

  if (persisted.activeSession?.currentQuestion) {
    state.activeSession = persisted.activeSession;
  }
}

function clearTimer() {
  if (state.timerId) {
    clearInterval(state.timerId);
    state.timerId = null;
  }
}

function getAverageQuestionScore() {
  const results = state.activeSession?.questionResults || [];
  if (!results.length) return 0;
  return results.reduce((sum, result) => sum + result.score, 0) / results.length;
}

function renderCurrentQuestion() {
  const session = state.activeSession;
  if (!session?.currentQuestion) return;

  renderInterviewState({
    question: session.currentQuestion,
    currentQuestionNumber: session.currentQuestionIndex + 1,
    totalQuestions: session.questionCount,
    remainingSeconds: state.remainingSeconds,
    category: session.category,
    difficulty: session.currentDifficulty,
    averageScore: getAverageQuestionScore(),
    recentNote: session.adaptiveNotes[session.adaptiveNotes.length - 1],
    progressPercent: (session.currentQuestionIndex / session.questionCount) * 100,
  });

  if (state.lastRenderedQuestionId !== session.currentQuestion.id) {
    renderAnswerInput(session.currentQuestion);
    state.lastRenderedQuestionId = session.currentQuestion.id;
  }
}

function startQuestionTimer() {
  clearTimer();
  state.remainingSeconds = state.activeSession.timerSeconds;
  state.questionStartedAt = Date.now();

  state.timerId = setInterval(() => {
    state.remainingSeconds -= 1;
    renderCurrentQuestion();

    if (state.remainingSeconds <= 0) {
      submitCurrentAnswer({ forced: true });
    }
  }, 1000);
}

function beginInterview(config) {
  state.activeSession = createSession(config);
  if (!state.activeSession) return;

  state.lastRenderedQuestionId = null;
  showView("interview");
  renderCurrentQuestion();
  startQuestionTimer();
  saveWorkingState();
}

function getCurrentAnswer() {
  const question = state.activeSession.currentQuestion;
  if (question.type === "mcq") {
    const checked = document.querySelector('input[name="answerOption"]:checked');
    return { textAnswer: "", selectedOption: checked ? checked.value : "" };
  }

  const textArea = document.getElementById("textAnswer");
  return { textAnswer: textArea ? textArea.value.trim() : "", selectedOption: "" };
}

function completeSession() {
  clearTimer();

  const session = state.activeSession;
  const overallScore = session.questionResults.length
    ? Math.round(session.questionResults.reduce((sum, result) => sum + result.score, 0) / session.questionResults.length)
    : 0;
  const confidenceIndex = calculateConfidenceIndex(session.questionResults);
  const confidenceDetails = calculateConfidenceDetails(session.questionResults);
  const completedSession = {
    ...session,
    overallScore,
    confidenceIndex,
    confidenceDetails,
    completedAt: new Date().toISOString(),
  };

  saveSession(completedSession);
  state.activeSession = null;
  state.lastRenderedQuestionId = null;
  saveAppState({ activeSession: null, lastConfig: state.lastConfig });
  renderResults(completedSession);
  updatePersistentUi();
  showView("results");
}

function moveToNextQuestion(nextDifficulty) {
  const session = state.activeSession;
  session.currentQuestionIndex += 1;
  session.currentDifficulty = nextDifficulty;
  session.finalDifficulty = nextDifficulty;

  if (session.currentQuestionIndex >= session.questionCount) {
    completeSession();
    return;
  }

  const nextQuestion = chooseNextQuestion({
    questionBank: state.questionBank,
    category: session.category,
    targetDifficulty: nextDifficulty,
    usedQuestionIds: session.usedQuestionIds,
  });

  if (!nextQuestion) {
    completeSession();
    return;
  }

  session.currentQuestion = nextQuestion;
  renderCurrentQuestion();
  startQuestionTimer();
  saveWorkingState();
}

function submitCurrentAnswer({ forced = false, skipped = false } = {}) {
  const session = state.activeSession;
  if (!session?.currentQuestion) return;

  const { textAnswer, selectedOption } = getCurrentAnswer();
  if (!forced && !skipped && session.currentQuestion.type === "text" && !textAnswer) {
    alert("Please enter an answer before submitting.");
    return;
  }
  if (!forced && !skipped && session.currentQuestion.type === "mcq" && !selectedOption) {
    alert("Please select an option before submitting.");
    return;
  }

  clearTimer();
  const elapsedSeconds = Math.min(session.timerSeconds, Math.round((Date.now() - state.questionStartedAt) / 1000));
  const result = scoreQuestion({
    question: session.currentQuestion,
    answer: skipped ? "" : textAnswer,
    selectedOption: skipped ? "" : selectedOption,
    elapsedSeconds: forced ? session.timerSeconds : elapsedSeconds,
    maxSeconds: session.timerSeconds,
    previousScores: session.questionResults.map((item) => item.score),
    wasSkipped: skipped,
    wasUnanswered: forced,
  });

  const answerLabel = forced
    ? "No answer submitted before timer expiry."
    : skipped
      ? "Skipped."
      : session.currentQuestion.type === "mcq"
        ? selectedOption
        : textAnswer;

  session.usedQuestionIds.push(session.currentQuestion.id);
  session.questionResults.push({
    questionId: session.currentQuestion.id,
    prompt: session.currentQuestion.prompt,
    topic: session.currentQuestion.topic,
    category: session.currentQuestion.category,
    difficulty: session.currentQuestion.difficulty,
    score: result.score,
    elapsedSeconds: forced ? session.timerSeconds : elapsedSeconds,
    maxSeconds: session.timerSeconds,
    answer: answerLabel,
    noResponse: result.score === 0,
    ...result,
  });

  const nextDifficulty = determineNextDifficulty(session.currentDifficulty, result.score);
  const adaptiveNote =
    result.score === 0
      ? `No answer was recorded, so the engine treated this as an unanswered question and adjusted difficulty accordingly.`
      : nextDifficulty === session.currentDifficulty
      ? `Performance held steady at ${session.currentDifficulty} difficulty after a ${result.score}% score.`
      : `Difficulty moved from ${session.currentDifficulty} to ${nextDifficulty} after a ${result.score}% result.`;
  session.adaptiveNotes.push(adaptiveNote);

  moveToNextQuestion(nextDifficulty);
}

function attachEventListeners() {
  document.querySelectorAll("[data-route]").forEach((button) => {
    button.addEventListener("click", () => showView(button.dataset.route));
  });

  document.querySelectorAll("[data-route-target]").forEach((button) => {
    button.addEventListener("click", () => showView(button.dataset.routeTarget));
  });

  [categorySelect, difficultySelect, questionCountSelect, timerSelect].forEach((element) => {
    element.addEventListener("change", syncSetupConfig);
  });

  setupForm.addEventListener("submit", (event) => {
    event.preventDefault();
    beginInterview(getSetupConfig());
  });

  submitAnswerBtn.addEventListener("click", () => submitCurrentAnswer());
  skipQuestionBtn.addEventListener("click", () => submitCurrentAnswer({ skipped: true }));

  retrySessionBtn.addEventListener("click", () => {
    showView("setup");
    syncSetupConfig();
  });

  resumeLastSessionBtn.addEventListener("click", () => showView("dashboard"));
  themeToggleBtn.addEventListener("click", () => {
    const nextTheme = document.body.classList.contains("dark-mode") ? "light" : "dark";
    applyTheme(nextTheme);
  });

  clearDataBtn.addEventListener("click", async () => {
    const confirmed = window.confirm("This will remove all saved local questions, sessions, and analytics. Continue?");
    if (!confirmed) return;

    clearAllData();
    await seedQuestionBank();
    state.questionBank = getQuestionBank();
    state.sessions = [];
    state.activeSession = null;
    state.lastRenderedQuestionId = null;
    syncSetupConfig();
    updatePersistentUi();
    showView("landing");
  });
}

async function init() {
  initializeTheme();
  await seedQuestionBank();
  state.questionBank = getQuestionBank();
  restoreWorkingState();
  syncSetupConfig();
  updatePersistentUi();
  attachEventListeners();

  if (state.activeSession?.currentQuestion) {
    showView("interview");
    renderCurrentQuestion();
    startQuestionTimer();
  } else {
    showView("landing");
  }
}

init();
})();

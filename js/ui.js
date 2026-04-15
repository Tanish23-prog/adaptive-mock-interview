;(function () {
let charts = [];

function icon(name) {
  const icons = {
    moon: '<svg viewBox="0 0 24 24" class="ui-icon"><path d="M20 15.5A8.5 8.5 0 0 1 8.5 4 8.5 8.5 0 1 0 20 15.5Z"/></svg>',
    sun: '<svg viewBox="0 0 24 24" class="ui-icon"><circle cx="12" cy="12" r="4"/><path d="M12 2v3"/><path d="M12 19v3"/><path d="m4.93 4.93 2.12 2.12"/><path d="m16.95 16.95 2.12 2.12"/><path d="M2 12h3"/><path d="M19 12h3"/><path d="m4.93 19.07 2.12-2.12"/><path d="m16.95 7.05 2.12-2.12"/></svg>',
    trend: '<svg viewBox="0 0 24 24" class="ui-icon"><path d="M3 17 9 11l4 4 8-8"/><path d="M14 7h7v7"/></svg>',
    target: '<svg viewBox="0 0 24 24" class="ui-icon"><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="M2 12h2"/><path d="M20 12h2"/></svg>',
    layers: '<svg viewBox="0 0 24 24" class="ui-icon"><path d="m12 3 9 5-9 5-9-5 9-5Z"/><path d="m3 12 9 5 9-5"/><path d="m3 16 9 5 9-5"/></svg>',
    spark: '<svg viewBox="0 0 24 24" class="ui-icon"><path d="m12 3 1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9Z"/></svg>',
    chevron: '<svg viewBox="0 0 24 24" class="ui-icon"><path d="m6 9 6 6 6-6"/></svg>',
    warning: '<svg viewBox="0 0 24 24" class="ui-icon"><path d="M12 4 3 20h18L12 4Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>',
    positive: '<svg viewBox="0 0 24 24" class="ui-icon"><path d="m20 6-11 11-5-5"/></svg>',
  };

  return icons[name] || "";
}

function formatTimer(totalSeconds) {
  const safe = Math.max(0, totalSeconds);
  const minutes = String(Math.floor(safe / 60)).padStart(2, "0");
  const seconds = String(safe % 60).padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function pct(value) {
  return `${Math.round(value)}%`;
}

function getThemeColors() {
  const styles = getComputedStyle(document.body);
  return {
    chartText: styles.getPropertyValue("--chart-text").trim() || "#201a16",
    chartLabel: styles.getPropertyValue("--chart-label").trim() || "#665d57",
    chartGrid: styles.getPropertyValue("--chart-grid").trim() || "rgba(32, 26, 22, 0.08)",
    accent: styles.getPropertyValue("--accent").trim() || "#d75a2f",
    teal: styles.getPropertyValue("--teal").trim() || "#0b7a75",
    gold: styles.getPropertyValue("--gold").trim() || "#c69214",
  };
}

function showView(route) {
  const viewMap = {
    landing: "landingView",
    setup: "setupView",
    interview: "interviewView",
    results: "resultsView",
    dashboard: "dashboardView",
  };

  document.querySelectorAll(".view").forEach((view) => view.classList.remove("active"));
  document.querySelectorAll(".nav-link").forEach((link) => {
    link.classList.toggle("active", link.dataset.route === route);
  });
  document.getElementById(viewMap[route]).classList.add("active");

  const titles = {
    landing: "Industry-ready interview practice",
    setup: "Interview setup and configuration",
    interview: "Live adaptive interview session",
    results: "Session scoring and evaluation",
    dashboard: "Analytics and personalized feedback",
  };
  document.getElementById("viewTitle").textContent = titles[route];
}

function renderAnswerInput(question) {
  const region = document.getElementById("answerInputRegion");
  if (question.type === "mcq") {
    region.innerHTML = `
      <div class="mcq-group">
        ${question.options
          .map(
            (option) => `
              <label class="answer-mcq-option">
                <input type="radio" name="answerOption" value="${option}" />
                <span>${option}</span>
              </label>
            `
          )
          .join("")}
      </div>
    `;
    return;
  }

  region.innerHTML = `
    <textarea
      id="textAnswer"
      class="answer-textarea"
      placeholder="Write your answer here. Aim for a clear, structured response."
    ></textarea>
  `;
}

function renderInterviewState({
  question,
  currentQuestionNumber,
  totalQuestions,
  remainingSeconds,
  category,
  difficulty,
  averageScore,
  recentNote,
  progressPercent,
}) {
  document.getElementById("sessionHeading").textContent = `Question ${currentQuestionNumber} of ${totalQuestions}`;
  document.getElementById("difficultyBadge").textContent = difficulty;
  document.getElementById("categoryBadge").textContent = category;
  document.getElementById("progressLabel").textContent = `${currentQuestionNumber} / ${totalQuestions} in progress`;
  document.getElementById("timerDisplay").textContent = formatTimer(remainingSeconds);
  document.getElementById("progressBar").style.width = `${progressPercent}%`;
  document.getElementById("questionTypeTag").textContent = question.type === "mcq" ? "Multiple Choice" : "Text Answer";
  document.getElementById("questionPrompt").textContent = question.prompt;
  document.getElementById("questionContext").textContent = question.context;

  document.getElementById("liveMetrics").innerHTML = `
    <div class="summary-item">
      <strong>${pct(averageScore || 0)}</strong>
      <small>Current rolling average score</small>
    </div>
    <div class="summary-item">
      <strong>${difficulty}</strong>
      <small>Current adaptive difficulty</small>
    </div>
    <div class="summary-item">
      <strong>${question.topic}</strong>
      <small>Focus topic in this round</small>
    </div>
  `;

  document.getElementById("adaptiveNotes").innerHTML = `
    <div class="summary-item">
      <strong>Adaptive engine</strong>
      <small>${recentNote}</small>
    </div>
    <div class="summary-item">
      <strong>Timing impact</strong>
      <small>Finishing early helps, but answer quality still carries the most weight.</small>
    </div>
  `;
}

function renderResults(session) {
  document.getElementById("resultsSummary").innerHTML = `
    <div class="summary-item">
      <strong>${pct(session.overallScore)}</strong>
      <small>Overall session score</small>
    </div>
    <div class="summary-item">
      <strong>${pct(session.confidenceIndex)}</strong>
      <small>Confidence index</small>
    </div>
    <div class="summary-item">
      <strong>${session.category}</strong>
      <small>Interview category</small>
    </div>
    <div class="summary-item">
      <strong>${session.finalDifficulty}</strong>
      <small>Ending adaptive difficulty</small>
    </div>
  `;

  document.getElementById("questionBreakdown").innerHTML = session.questionResults
    .map(
      (result, index) => `
        <article class="breakdown-card">
          <strong>Q${index + 1}: ${result.topic}</strong>
          <div class="breakdown-meta">
            <span>${result.difficulty}</span>
            <span>Score: ${pct(result.score)}</span>
            <span>Time: ${result.elapsedSeconds}s</span>
          </div>
          <p>${result.prompt}</p>
          <p><strong>Strength:</strong> ${result.strengths}</p>
          <p><strong>Tip:</strong> ${result.recommendation}</p>
        </article>
      `
    )
    .join("");
}

function renderLandingStats(sessions) {
  const latest = sessions[sessions.length - 1];
  document.getElementById("landingSessionCount").textContent = sessions.length;
  document.getElementById("landingConfidence").textContent = latest ? `${latest.confidenceIndex}%` : "0%";
  document.getElementById("landingAdaptiveState").textContent = latest ? `Last ended at ${latest.finalDifficulty}` : "Ready";
}

function renderSidebarStats(items) {
  document.getElementById("sidebarStats").innerHTML = items
    .map(
      (item) => `
        <div class="mini-stat">
          <span>${item.icon ? icon(item.icon) : ""}${item.label}</span>
          <strong>${item.value}</strong>
        </div>
      `
    )
    .join("");
}

function renderSuggestions(suggestions) {
  document.getElementById("suggestionsPanel").innerHTML = suggestions
    .map(
      (suggestion) => `
        <article class="suggestion-card ${suggestion.type}">
          <details class="suggestion-details">
            <summary class="suggestion-summary">
              <span class="suggestion-summary-title">
                <span class="icon-slot" aria-hidden="true">${icon(
                  suggestion.type === "warning" ? "warning" : "positive"
                )}</span>
                <span>${suggestion.title}</span>
              </span>
              <span class="suggestion-chevron" aria-hidden="true">${icon("chevron")}</span>
            </summary>
            <div class="suggestion-body">${suggestion.body}</div>
          </details>
        </article>
      `
    )
    .join("");
}

function renderEmptyDashboard() {
  document.getElementById("suggestionsPanel").innerHTML = `
    <div class="empty-state">
      Complete at least one interview session to unlock charts and personalized suggestions.
    </div>
  `;
}

function renderCharts(analytics) {
  charts.forEach((chart) => chart.destroy());
  charts = [];
  const theme = getThemeColors();

  const commonOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        labels: {
          color: theme.chartText,
          font: { family: "Manrope" },
        },
      },
      tooltip: {
        backgroundColor: "rgba(15, 23, 31, 0.92)",
        titleColor: "#f8fafc",
        bodyColor: "#dbe7ef",
        borderColor: "rgba(255,255,255,0.12)",
        borderWidth: 1,
        padding: 12,
        displayColors: true,
      },
    },
    scales: {
      x: {
        ticks: { color: theme.chartLabel },
        grid: { display: false },
      },
      y: {
        beginAtZero: true,
        max: 100,
        ticks: { color: theme.chartLabel },
        grid: { color: theme.chartGrid },
      },
    },
  };

  charts.push(
    new Chart(document.getElementById("categoryChart"), {
      type: "bar",
      data: {
        labels: analytics.categories,
        datasets: [{ label: "Average Score", data: analytics.averageScoreByCategory, backgroundColor: [theme.accent, theme.teal, theme.gold], borderRadius: 12, maxBarThickness: 42 }],
      },
      options: commonOptions,
    })
  );

  charts.push(
    new Chart(document.getElementById("trendChart"), {
      type: "line",
      data: {
        labels: analytics.trendLabels,
        datasets: [{ label: "Overall Score", data: analytics.trendScores, borderColor: theme.accent, backgroundColor: "rgba(215, 90, 47, 0.18)", pointBackgroundColor: theme.accent, pointRadius: 4, fill: true, tension: 0.35 }],
      },
      options: commonOptions,
    })
  );

  charts.push(
    new Chart(document.getElementById("frequencyChart"), {
      type: "bar",
      data: {
        labels: analytics.frequencyLabels,
        datasets: [{ label: "Sessions", data: analytics.frequencyValues, backgroundColor: theme.teal, borderRadius: 12, maxBarThickness: 42 }],
      },
      options: {
        ...commonOptions,
        scales: {
          ...commonOptions.scales,
          y: {
            beginAtZero: true,
            ticks: { color: theme.chartLabel },
            grid: { color: theme.chartGrid },
          },
        },
      },
    })
  );

  charts.push(
    new Chart(document.getElementById("confidenceChart"), {
      type: "line",
      data: {
        labels: analytics.trendLabels,
        datasets: [{ label: "Confidence Index", data: analytics.confidenceScores, borderColor: theme.gold, backgroundColor: "rgba(198, 146, 20, 0.18)", pointBackgroundColor: theme.gold, pointRadius: 4, fill: true, tension: 0.35 }],
      },
      options: commonOptions,
    })
  );
}

function renderAnalyticsHighlights(analytics) {
  document.getElementById("analyticsHighlights").innerHTML = `
    <article class="analytics-highlight">
      <div class="analytics-highlight-header">
        <span class="icon-slot" aria-hidden="true">${icon("layers")}</span>
        <span>Total Sessions</span>
      </div>
      <strong>${analytics.totalSessions}</strong>
      <small>All saved mock interviews across every category.</small>
    </article>
    <article class="analytics-highlight">
      <div class="analytics-highlight-header">
        <span class="icon-slot" aria-hidden="true">${icon("trend")}</span>
        <span>Latest Score</span>
      </div>
      <strong>${pct(analytics.latestSessionScore)}</strong>
      <small>Your most recent overall result, useful for quick comparison.</small>
    </article>
    <article class="analytics-highlight">
      <div class="analytics-highlight-header">
        <span class="icon-slot" aria-hidden="true">${icon("target")}</span>
        <span>Best Category</span>
      </div>
      <strong>${analytics.bestCategory}</strong>
      <small>The category where your average score is currently strongest.</small>
    </article>
    <article class="analytics-highlight">
      <div class="analytics-highlight-header">
        <span class="icon-slot" aria-hidden="true">${icon("spark")}</span>
        <span>Avg Confidence</span>
      </div>
      <strong>${pct(analytics.overallAverageConfidence)}</strong>
      <small>A session-level reliability signal across saved interview history.</small>
    </article>
  `;
}

function setThemeButtonLabel(isDarkMode) {
  const button = document.getElementById("themeToggleBtn");
  if (button) {
    button.innerHTML = isDarkMode ? icon("sun") : icon("moon");
  }
}

window.AppUI = {
  formatTimer,
  showView,
  renderAnswerInput,
  renderInterviewState,
  renderResults,
  renderLandingStats,
  renderSidebarStats,
  renderSuggestions,
  renderEmptyDashboard,
  renderCharts,
  renderAnalyticsHighlights,
  setThemeButtonLabel,
};
})();

;(function () {
function average(values) {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function computeAnalytics(sessions) {
  const categories = ["DSA", "HR", "System Design"];
  const averageScoreByCategory = categories.map((category) => {
    const matches = sessions.filter((session) => session.category === category);
    const average = matches.length
      ? matches.reduce((sum, session) => sum + session.overallScore, 0) / matches.length
      : 0;
    return Math.round(average);
  });

  const trendLabels = sessions.map((_, index) => `S${index + 1}`);
  const trendScores = sessions.map((session) => session.overallScore);
  const confidenceScores = sessions.map((session) => session.confidenceIndex);
  const totalSessions = sessions.length;
  const latestSession = sessions[sessions.length - 1] || null;
  const overallAverageScore = Math.round(average(trendScores));
  const overallAverageConfidence = Math.round(average(confidenceScores));
  const bestCategoryIndex = averageScoreByCategory.reduce(
    (bestIndex, value, index, array) => (value > array[bestIndex] ? index : bestIndex),
    0
  );

  const frequencyMap = new Map();
  sessions.forEach((session) => {
    const label = new Date(session.completedAt).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
    });
    frequencyMap.set(label, (frequencyMap.get(label) || 0) + 1);
  });

  return {
    categories,
    averageScoreByCategory,
    trendLabels,
    trendScores,
    confidenceScores,
    totalSessions,
    overallAverageScore,
    overallAverageConfidence,
    latestSessionScore: latestSession ? latestSession.overallScore : 0,
    bestCategory: totalSessions ? categories[bestCategoryIndex] : "N/A",
    frequencyLabels: [...frequencyMap.keys()],
    frequencyValues: [...frequencyMap.values()],
  };
}

function buildSidebarStats(sessions) {
  const total = sessions.length;
  const averageScore = total
    ? Math.round(sessions.reduce((sum, session) => sum + session.overallScore, 0) / total)
    : 0;
  const averageConfidence = total
    ? Math.round(sessions.reduce((sum, session) => sum + session.confidenceIndex, 0) / total)
    : 0;
  const categoryCount = new Set(sessions.map((session) => session.category)).size;

  return [
    { label: "Sessions", value: total, icon: "layers" },
    { label: "Avg Score", value: `${averageScore}%`, icon: "trend" },
    { label: "Confidence", value: `${averageConfidence}%`, icon: "spark" },
    { label: "Tracks Used", value: categoryCount || 0, icon: "target" },
  ];
}

window.Analytics = {
  computeAnalytics,
  buildSidebarStats,
};
})();

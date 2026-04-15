;(function () {
const difficultyOrder = ["Easy", "Medium", "Hard"];
const difficultyWeights = { Easy: 1, Medium: 1.15, Hard: 1.3 };

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function average(values) {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function standardDeviation(values) {
  if (values.length <= 1) return 0;
  const mean = average(values);
  const variance = average(values.map((value) => (value - mean) ** 2));
  return Math.sqrt(variance);
}

function normalizeText(value) {
  return (value || "").toLowerCase().replace(/[^\w\s]/g, " ");
}

function keywordCoverage(answer, keywords) {
  if (!keywords?.length) {
    return 0.6;
  }

  const normalized = normalizeText(answer);
  const matches = keywords.filter((keyword) =>
    normalized.includes(normalizeText(keyword).trim())
  ).length;

  return matches / keywords.length;
}

function completionScore(answer) {
  const words = normalizeText(answer).split(/\s+/).filter(Boolean).length;
  if (words >= 60) return 1;
  if (words >= 35) return 0.82;
  if (words >= 18) return 0.65;
  if (words >= 8) return 0.42;
  if (words > 0) return 0.2;
  return 0;
}

function timeScore(elapsedSeconds, maxSeconds) {
  if (!maxSeconds) return 0.8;
  const ratio = elapsedSeconds / maxSeconds;
  if (ratio <= 0.35) return 1;
  if (ratio <= 0.65) return 0.84;
  if (ratio <= 0.9) return 0.68;
  if (ratio <= 1.05) return 0.5;
  return 0.3;
}

function scoreQuestion({
  question,
  answer,
  selectedOption,
  elapsedSeconds,
  maxSeconds,
  previousScores,
  wasSkipped,
  wasUnanswered,
}) {
  const isMcq = question.type === "mcq";
  const content = isMcq ? selectedOption || "" : answer || "";
  const noResponse = wasSkipped || wasUnanswered || !String(content).trim();

  if (noResponse) {
    return {
      score: 0,
      breakdown: {
        coverage: 0,
        completeness: 0,
        timing: 0,
        consistency: 0,
      },
      strengths: "No answer was submitted for this question.",
      recommendation: "Attempt the question with at least a brief structured response to receive a meaningful evaluation.",
    };
  }

  const coverage = keywordCoverage(content, question.keywords);
  const completeness = isMcq ? (selectedOption ? 1 : 0) : completionScore(answer);
  const timing = timeScore(elapsedSeconds, maxSeconds);
  const correctnessBoost =
    isMcq && question.correctOption
      ? selectedOption === question.correctOption
        ? 1
        : 0.1
      : 0.65 + coverage * 0.35;

  const baseScore = Math.round(
    (coverage * 0.4 + completeness * 0.25 + timing * 0.15 + correctnessBoost * 0.2) * 100
  );

  const recentAverage = previousScores.length
    ? previousScores.reduce((sum, score) => sum + score, 0) / previousScores.length
    : baseScore;
  const consistencyGap = Math.abs(baseScore - recentAverage);
  const consistencyScore = Math.max(40, 100 - consistencyGap);
  const finalScore = Math.round(baseScore * 0.8 + consistencyScore * 0.2);

  return {
    score: finalScore,
    breakdown: {
      coverage: Math.round(coverage * 100),
      completeness: Math.round(completeness * 100),
      timing: Math.round(timing * 100),
      consistency: Math.round(consistencyScore),
    },
    strengths:
      finalScore >= 75
        ? "Strong structure and relevant content."
        : "Some relevant signals are present, but depth can improve.",
    recommendation:
      finalScore >= 75
        ? "Keep refining precision and examples."
        : "Add clearer structure, better detail, and more role-specific reasoning.",
  };
}

function determineNextDifficulty(currentDifficulty, score) {
  const currentIndex = difficultyOrder.indexOf(currentDifficulty);
  if (score >= 78 && currentIndex < difficultyOrder.length - 1) {
    return difficultyOrder[currentIndex + 1];
  }
  if (score <= 45 && currentIndex > 0) {
    return difficultyOrder[currentIndex - 1];
  }
  return currentDifficulty;
}

function chooseNextQuestion({ questionBank, category, targetDifficulty, usedQuestionIds }) {
  const priorities = [targetDifficulty, ...difficultyOrder.filter((level) => level !== targetDifficulty)];

  for (const difficulty of priorities) {
    const match = questionBank.find(
      (question) =>
        question.category === category &&
        question.difficulty === difficulty &&
        !usedQuestionIds.includes(question.id)
    );
    if (match) return match;
  }

  return null;
}

function calculateConfidenceIndex(questionResults) {
  return calculateConfidenceDetails(questionResults).confidenceIndex;
}

function calculateConfidenceDetails(questionResults) {
  if (!questionResults.length) {
    return {
      confidenceIndex: 0,
      answeredRate: 0,
      averageAnsweredScore: 0,
      consistencyScore: 0,
      paceScore: 0,
      momentumScore: 0,
      difficultyReadiness: 0,
      noResponseRate: 0,
    };
  }

  const answered = questionResults.filter((item) => !item.noResponse);
  const answeredScores = answered.map((item) => item.score);
  const answeredRate = (answered.length / questionResults.length) * 100;
  const noResponseRate = 100 - answeredRate;
  const averageAnsweredScore = average(answeredScores);
  const scoreDeviation = standardDeviation(answeredScores);
  const consistencyScore = answered.length ? clamp(100 - scoreDeviation * 1.7, 20, 100) : 0;
  const paceScore = answered.length
    ? average(
        answered.map((item) => {
          const ratio = item.maxSeconds ? item.elapsedSeconds / item.maxSeconds : 1;
          return clamp(100 - ratio * 55, 35, 100);
        })
      )
    : 0;

  let momentumScore = 50;
  if (answeredScores.length >= 2) {
    const splitIndex = Math.ceil(answeredScores.length / 2);
    const earlyAverage = average(answeredScores.slice(0, splitIndex));
    const lateAverage = average(answeredScores.slice(splitIndex));
    momentumScore = clamp(50 + (lateAverage - earlyAverage), 0, 100);
  }

  const difficultyReadiness = answered.length
    ? average(
        answered.map((item) =>
          clamp(item.score * (difficultyWeights[item.difficulty] || 1), 0, 100)
        )
      )
    : 0;

  const rawConfidence =
    averageAnsweredScore * 0.35 +
    answeredRate * 0.2 +
    consistencyScore * 0.2 +
    paceScore * 0.1 +
    momentumScore * 0.15;

  const responsePenalty = noResponseRate * 0.35;
  const confidenceIndex = clamp(Math.round(rawConfidence - responsePenalty), 0, 100);

  return {
    confidenceIndex,
    answeredRate: Math.round(answeredRate),
    averageAnsweredScore: Math.round(averageAnsweredScore),
    consistencyScore: Math.round(consistencyScore),
    paceScore: Math.round(paceScore),
    momentumScore: Math.round(momentumScore),
    difficultyReadiness: Math.round(difficultyReadiness),
    noResponseRate: Math.round(noResponseRate),
  };
}

function findWeakAreas(sessions) {
  const topics = new Map();

  sessions.forEach((session, sessionIndex) => {
    session.questionResults.forEach((result) => {
      const current = topics.get(result.topic) || {
        topic: result.topic,
        category: result.category,
        scores: [],
        recentScores: [],
        noResponses: 0,
        weightedTotal: 0,
        weightedCount: 0,
      };
      current.scores.push(result.score);
      if (result.noResponse) {
        current.noResponses += 1;
      }
      const recencyWeight = sessionIndex + 1;
      current.weightedTotal += result.score * recencyWeight;
      current.weightedCount += recencyWeight;
      current.recentScores.push(result.score);
      if (current.recentScores.length > 3) {
        current.recentScores.shift();
      }
      topics.set(result.topic, current);
    });
  });

  return [...topics.values()]
    .map((entry) => ({
      topic: entry.topic,
      category: entry.category,
      averageScore: average(entry.scores),
      recentAverage: average(entry.recentScores),
      unansweredRate: (entry.noResponses / entry.scores.length) * 100,
      attempts: entry.scores.length,
      priorityScore:
        (100 - average(entry.recentScores)) * 0.55 +
        (100 - average(entry.scores)) * 0.25 +
        ((entry.noResponses / entry.scores.length) * 100) * 0.2,
    }))
    .sort((a, b) => b.priorityScore - a.priorityScore)
    .slice(0, 4);
}

function buildSuggestions(sessions) {
  if (!sessions.length) {
    return [
      {
        title: "No interview history yet",
        body: "Start a session to unlock adaptive suggestions, confidence scoring, and topic-level guidance.",
        type: "positive",
      },
    ];
  }

  const weakAreas = findWeakAreas(sessions);
  const latestSession = sessions[sessions.length - 1];
  const latestDetails =
    latestSession.confidenceDetails || calculateConfidenceDetails(latestSession.questionResults);
  const averageScore = average(sessions.map((session) => session.overallScore));
  const recentSessions = sessions.slice(-3);
  const recentAverage = average(recentSessions.map((session) => session.overallScore));
  const priorSessions = sessions.slice(0, -3);
  const priorAverage = priorSessions.length
    ? average(priorSessions.map((session) => session.overallScore))
    : recentAverage;
  const suggestions = [];

  if (weakAreas.length) {
    suggestions.push({
      title: `Weakest area: ${weakAreas[0].topic}`,
      body: `This topic is currently your biggest drag in ${weakAreas[0].category}. Recent performance is ${Math.round(weakAreas[0].recentAverage)}% across ${weakAreas[0].attempts} attempts${weakAreas[0].unansweredRate ? `, with ${Math.round(weakAreas[0].unansweredRate)}% left unanswered` : ""}.`,
      type: "warning",
    });
  }

  if (latestDetails.answeredRate < 80) {
    suggestions.push({
      title: "Primary blocker: completion rate",
      body: `You answered ${latestDetails.answeredRate}% of the latest session. Confidence drops sharply when questions are skipped, so prioritize finishing every prompt with at least a concise structured answer.`,
      type: "warning",
    });
  } else if (latestDetails.consistencyScore < 60) {
    suggestions.push({
      title: "Stability needs work",
      body: `Your latest session showed uneven performance. Consistency is ${latestDetails.consistencyScore}%, which suggests strong answers are not repeating reliably across questions.`,
      type: "warning",
    });
  } else {
    suggestions.push({
      title: "Response quality is becoming more reliable",
      body:
        averageScore < 70
          ? "Your baseline is improving, but clarity still matters. Use a repeatable structure: frame the problem, explain decisions, and close with tradeoffs."
          : "Your recent answers are more stable. Keep adding concise examples and tradeoffs to convert good answers into standout ones.",
      type: averageScore < 70 ? "warning" : "positive",
    });
  }

  suggestions.push({
    title: "Current confidence pattern",
    body: `Confidence is ${latestSession.confidenceIndex}% based on answer rate (${latestDetails.answeredRate}%), consistency (${latestDetails.consistencyScore}%), pace (${latestDetails.paceScore}%), and trend (${latestDetails.momentumScore}%). ${
      latestSession.confidenceIndex < 65
        ? "Improve reliability first before chasing speed or harder questions."
        : "Your session profile is stable enough to keep stretching difficulty."
    }`,
    type: latestSession.confidenceIndex < 65 ? "warning" : "positive",
  });

  suggestions.push({
    title: recentAverage >= priorAverage ? "Recent trend is positive" : "Recent trend has softened",
    body:
      recentAverage >= priorAverage
        ? `Your last few sessions are outperforming your earlier baseline by ${Math.round(recentAverage - priorAverage)} points. Practice another ${latestSession.category} round and keep the same discipline.`
        : `Recent performance is down by ${Math.round(priorAverage - recentAverage)} points versus your earlier baseline. Revisit fundamentals in ${weakAreas[0] ? weakAreas[0].topic : latestSession.category} before pushing harder difficulty.`,
    type: recentAverage >= priorAverage ? "positive" : "warning",
  });

  suggestions.push({
    title: "Recommended next step",
    body:
      latestDetails.difficultyReadiness >= 72 && latestDetails.answeredRate >= 85
        ? `You look ready for another ${latestSession.category} session at ${latestSession.finalDifficulty === "Hard" ? "Hard" : "one level harder than " + latestSession.finalDifficulty} difficulty.`
        : `Repeat ${latestSession.category} at ${latestSession.finalDifficulty} difficulty and focus on ${weakAreas[0] ? weakAreas[0].topic : "complete answers"} before increasing complexity.`,
    type: "positive",
  });

  return suggestions;
}

window.InterviewEngine = {
  scoreQuestion,
  determineNextDifficulty,
  chooseNextQuestion,
  calculateConfidenceIndex,
  calculateConfidenceDetails,
  findWeakAreas,
  buildSuggestions,
};
})();

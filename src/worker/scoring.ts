/** Pure grading logic, kept separate so it is unit-testable without a database. */
export type GradableQuestion = {
  id: string
  question: string
  options: string[]
  answerIndex: number
  explanation: string
  topic: string
}

export type SubmittedAnswer = { questionId: string; selectedIndex: number | null }

export type GradedQuestion = {
  questionId: string
  question: string
  options: string[]
  selectedIndex: number | null
  correctIndex: number
  correct: boolean
  explanation: string
  topic: string
}

export function gradeQuiz(questions: GradableQuestion[], answers: SubmittedAnswer[]) {
  const byId = new Map(answers.map((a) => [a.questionId, a.selectedIndex]))
  const graded: GradedQuestion[] = questions.map((q) => {
    const selected = byId.get(q.id)
    const selectedIndex =
      typeof selected === 'number' && Number.isInteger(selected) && selected >= 0 && selected < q.options.length
        ? selected
        : null
    return {
      questionId: q.id,
      question: q.question,
      options: q.options,
      selectedIndex,
      correctIndex: q.answerIndex,
      correct: selectedIndex !== null && selectedIndex === q.answerIndex,
      explanation: q.explanation,
      topic: q.topic || 'General',
    }
  })
  const score = graded.filter((g) => g.correct).length
  const total = graded.length
  const missed = graded.filter((g) => !g.correct)
  const weakTopics = [...new Set(missed.map((g) => g.topic))].slice(0, 8)
  const percentage = total === 0 ? 0 : Math.round((score / total) * 100)
  return {
    score,
    total,
    percentage,
    graded,
    weakTopics,
    summary:
      percentage >= 90
        ? 'Outstanding — you have a strong command of this material.'
        : percentage >= 75
          ? 'Good work. A little revision on the missed topics will finish the job.'
          : percentage >= 50
            ? 'A fair attempt. Review the explanations and retry to lock it in.'
            : 'This topic needs focused revision. Read the explanations, then retry.',
  }
}

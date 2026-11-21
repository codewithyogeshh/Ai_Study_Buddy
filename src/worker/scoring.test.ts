import { describe, expect, test } from 'bun:test'

import { gradeQuiz, type GradableQuestion } from './scoring'
import { capText, fileKind, selectRelevantChunks } from './extract'

const questions: GradableQuestion[] = [
  { id: 'a', question: 'A?', options: ['1', '2', '3', '4'], answerIndex: 0, explanation: 'x', topic: 'Alpha' },
  { id: 'b', question: 'B?', options: ['1', '2', '3', '4'], answerIndex: 3, explanation: 'y', topic: 'Beta' },
  { id: 'c', question: 'C?', options: ['True', 'False'], answerIndex: 1, explanation: 'z', topic: 'Beta' },
]

describe('gradeQuiz', () => {
  test('scores only correct answers and reports weak topics', () => {
    const result = gradeQuiz(questions, [
      { questionId: 'a', selectedIndex: 0 },
      { questionId: 'b', selectedIndex: 1 },
      { questionId: 'c', selectedIndex: 1 },
    ])
    expect(result.score).toBe(2)
    expect(result.total).toBe(3)
    expect(result.percentage).toBe(67)
    expect(result.weakTopics).toEqual(['Beta'])
    expect(result.graded[1].correct).toBe(false)
  })

  test('treats unanswered and out-of-range options as incorrect', () => {
    const result = gradeQuiz(questions, [
      { questionId: 'a', selectedIndex: null },
      { questionId: 'b', selectedIndex: 99 },
    ])
    expect(result.score).toBe(0)
    expect(result.graded[0].selectedIndex).toBeNull()
    expect(result.graded[1].selectedIndex).toBeNull()
    expect(result.graded[2].selectedIndex).toBeNull()
  })

  test('handles an empty quiz without dividing by zero', () => {
    const result = gradeQuiz([], [])
    expect(result.percentage).toBe(0)
    expect(result.total).toBe(0)
  })
})

describe('extraction helpers', () => {
  test('accepts only supported file types', () => {
    expect(fileKind('notes.pdf', 'application/pdf')).toBe('pdf')
    expect(fileKind('notes.txt', 'text/plain')).toBe('txt')
    expect(fileKind('notes.docx', 'application/octet-stream')).toBe('docx')
    expect(fileKind('notes.exe', 'application/octet-stream')).toBeNull()
    expect(fileKind('notes.pdf', 'image/png')).toBeNull()
  })

  test('caps very long text while keeping both ends', () => {
    const long = `START${'x'.repeat(300_000)}END`
    const capped = capText(long)
    expect(capped.length).toBeLessThan(long.length)
    expect(capped.startsWith('START')).toBe(true)
    expect(capped.endsWith('END')).toBe(true)
  })

  test('selects passages relevant to the question', () => {
    const text = `[Page 1]\nIntro about plants.\n\n[Page 2]\nMitochondria produce ATP through respiration.\n\n[Page 3]\nUnrelated history notes.`
    const picked = selectRelevantChunks(text, 'What does mitochondria do?', 60)
    expect(picked).toContain('Mitochondria')
  })
})

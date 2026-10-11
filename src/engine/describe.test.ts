import { describe, expect, it } from 'vitest'
import {
  alignmentView,
  createGameState,
  describeAction,
  describeActionLines,
  describeCrisis,
  GAME_DATA,
  relationsWord,
} from './index.ts'
import type { EffectLine } from './index.ts'
import { quietGame } from './testHelpers.ts'

const start = quietGame()
const toned = (lines: EffectLine[]) => lines.map((line) => `${line.tone}: ${line.text}`)

describe('effects marked as helping or hurting', () => {
  it('gives the same lines as the plain description, each with its tone', () => {
    const action = { actionId: 'signTradeDeal', targetId: 'halvard' }
    const lines = describeActionLines(start, 'kessara', action)
    expect(lines.map((line) => line.text)).toEqual(describeAction(start, 'kessara', action))
    expect(toned(lines)).toEqual([
      'good: Growth +0.5% for 8 turns',
      'neutral: Halvard Compact: growth +0.25% for 8 turns',
      'good: Relations with Halvard Compact +5',
      'neutral: Alignment up to 5 toward Halvard Compact',
      'bad: Tsengai Republic resents it: relations up to −3',
      'good: Business +4',
      'bad: Generals −3',
    ])
  })

  it('counts costs, upkeep and risks against you, and effects on others as neither', () => {
    expect(toned(describeActionLines(start, 'kessara', { actionId: 'covertOperation', targetId: 'ostrel' }))).toEqual([
      'bad: Treasury −20',
      'neutral: Ostrel: legitimacy −8',
      'good: Generals +4',
      'bad: Reformers −4',
      'bad: 30% chance the operation is exposed: relations with Ostrel −25, legitimacy −5',
    ])
    expect(
      toned(describeActionLines(start, 'kessara', { actionId: 'straitAccess', targetId: 'halvard', option: 'closed' })),
    ).toEqual([
      'neutral: Kessara Strait closed to Halvard Compact (now open)',
      'bad: While closed, 20% chance each turn of a blockade or staged incident',
      'bad: Relations with Halvard Compact −25',
      'good: Relations with Tsengai Republic +20',
      'good: Generals +6',
      'bad: Business −8',
    ])
    expect(toned(describeActionLines(start, 'kessara', { actionId: 'acceptLoan', targetId: 'halvard' }))[0]).toMatch(
      /^neutral: Borrow/,
    )
  })

  it('marks every answer to a crisis', () => {
    const view = describeCrisis(createGameState({ seed: 4 }))!
    for (const response of view.responses) {
      expect(response.lines.map((line) => line.text)).toEqual(response.effects)
      for (const line of response.lines) expect(['good', 'bad', 'neutral']).toContain(line.tone)
    }
  })
})

describe('standing in words', () => {
  const { brokerWithin, tradeCutPast, demandPast } = GAME_DATA.hedging

  it('names alignment by the lines that matter in the rules', () => {
    const word = (alignment: number) => alignmentView(start, alignment).word
    expect([0, brokerWithin, -brokerWithin].map(word)).toEqual(['Balanced', 'Balanced', 'Balanced'])
    expect([brokerWithin + 1, tradeCutPast, -tradeCutPast].map(word)).toEqual(['Leaning', 'Leaning', 'Leaning'])
    expect([tradeCutPast + 1, demandPast, -demandPast].map(word)).toEqual(['Siding', 'Siding', 'Siding'])
    expect([demandPast + 1, -100].map(word)).toEqual(['Client', 'Client'])
  })

  it('says which power, with Halvard at the positive end and Tsengai at the negative', () => {
    expect(alignmentView(start, 10)).toEqual({
      standing: 'balanced',
      powerId: null,
      word: 'Balanced',
      phrase: 'Balanced between the powers',
    })
    expect(alignmentView(start, 30).phrase).toBe('Leans toward Halvard Compact')
    expect(alignmentView(start, -50)).toMatchObject({ powerId: 'tsengai', phrase: 'Sides with Tsengai Republic' })
    expect(alignmentView(start, 80).phrase).toBe("In Halvard Compact's camp")
  })

  it('names relations from hostile to close', () => {
    expect([-100, -51, -50, -21, -20, 0, 20, 21, 50, 51, 100].map(relationsWord)).toEqual([
      'Hostile',
      'Hostile',
      'Unfriendly',
      'Unfriendly',
      'Neutral',
      'Neutral',
      'Neutral',
      'Friendly',
      'Friendly',
      'Close',
      'Close',
    ])
  })
})

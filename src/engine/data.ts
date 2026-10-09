// Loads the game content from src/data and checks it, so a mistake in a JSON
// file fails loudly at startup instead of quietly breaking the rules.

import actionsJson from '../data/actions.json' with { type: 'json' }
import countriesJson from '../data/countries.json' with { type: 'json' }
import economyJson from '../data/economy.json' with { type: 'json' }
import projectsJson from '../data/projects.json' with { type: 'json' }
import straitsJson from '../data/straits.json' with { type: 'json' }
import type {
  ActionDef,
  ActionTarget,
  CountryDef,
  CountryKind,
  Effect,
  EconomyField,
  GameData,
  Personality,
  ProjectDef,
  StatKey,
  StraitDef,
} from './types.ts'

const STATS: StatKey[] = ['treasury', 'debt', 'growth', 'legitimacy', 'militaryLoyalty', 'defence', 'alignment']
const ECONOMY_FIELDS: EconomyField[] = ['baseOutput', 'upkeep', 'straitTolls']
const TARGETS: ActionTarget[] = ['none', 'any', 'greatPower', 'minor']
const KINDS: CountryKind[] = ['greatPower', 'minor']
const PERSONALITIES: Personality[] = ['opportunist', 'hardliner', 'merchant']

function check(condition: boolean, where: string, problem: string): asserts condition {
  if (!condition) throw new Error(`Invalid game data in ${where}: ${problem}`)
}

function checkUniqueIds(items: readonly { id: string }[], file: string): void {
  const ids = new Set(items.map((item) => item.id))
  check(ids.size === items.length, file, 'ids must be unique')
}

function checkEffects(
  effects: readonly Effect[],
  where: string,
  target: ActionTarget,
  projectIds: ReadonlySet<string>,
): void {
  const hasTarget = target !== 'none'
  for (const effect of effects) {
    switch (effect.kind) {
      case 'stat':
        check(STATS.includes(effect.stat), where, `unknown stat "${effect.stat}"`)
        // Debt is tracked by creditor, so it only changes through borrow and repayDebt.
        check(effect.stat !== 'debt', where, 'change debt with a borrow or repayDebt effect')
        check(effect.who === 'self' || (effect.who === 'target' && hasTarget), where, `bad "who": ${effect.who}`)
        break
      case 'economy':
        check(ECONOMY_FIELDS.includes(effect.field), where, `unknown economy field "${effect.field}"`)
        check(effect.who === 'self' || (effect.who === 'target' && hasTarget), where, `bad "who": ${effect.who}`)
        break
      case 'relations':
        check(hasTarget, where, 'a relations effect needs a target')
        check(['target', 'otherGreatPower'].includes(effect.with), where, `bad "with": ${effect.with}`)
        break
      case 'alignment':
        check(hasTarget, where, 'an alignment effect needs a target')
        break
      case 'borrow':
      case 'repayDebt':
        check(target === 'greatPower', where, `a ${effect.kind} effect needs a great power as the target`)
        check(effect.amount > 0, where, `a ${effect.kind} amount must be above zero`)
        break
      case 'startProject':
        check(projectIds.has(effect.projectId), where, `unknown project "${effect.projectId}"`)
        break
      case 'chance':
        check(effect.probability >= 0 && effect.probability <= 1, where, 'probability must be 0 to 1')
        checkEffects(effect.effects, where, target, projectIds)
        break
      default:
        check(false, where, `unknown effect kind "${(effect as { kind: unknown }).kind}"`)
    }
  }
}

/** Check content for broken references and unknown names. Returns the data unchanged. */
export function validateGameData(data: GameData): GameData {
  checkUniqueIds(data.countries, 'countries.json')
  checkUniqueIds(data.actions, 'actions.json')
  checkUniqueIds(data.projects, 'projects.json')
  checkUniqueIds(data.straits, 'straits.json')
  const projectIds = new Set(data.projects.map((project) => project.id))

  for (const country of data.countries) {
    const where = `countries.json (${country.id})`
    check(KINDS.includes(country.kind), where, `unknown kind "${country.kind}"`)
    check(
      country.personality === null || PERSONALITIES.includes(country.personality),
      where,
      `unknown personality "${country.personality}"`,
    )
    for (const stat of STATS) {
      check(typeof country.stats[stat] === 'number', where, `missing stat "${stat}"`)
    }
    for (const field of ECONOMY_FIELDS) {
      check(typeof country.economy[field] === 'number', where, `missing economy field "${field}"`)
    }
    for (const other of data.countries) {
      if (other.id === country.id) continue
      check(typeof country.relations[other.id] === 'number', where, `missing relations with "${other.id}"`)
    }
    for (const [creditorId, owed] of Object.entries(country.creditors)) {
      const creditor = data.countries.find((candidate) => candidate.id === creditorId)
      check(creditor?.kind === 'greatPower', where, `creditor "${creditorId}" is not a great power`)
      check(owed >= 0, where, `debt to "${creditorId}" cannot be negative`)
    }
    const owedToPowers = Object.values(country.creditors).reduce((total, owed) => total + owed, 0)
    check(owedToPowers <= country.stats.debt, where, 'debt to creditors adds up to more than its total debt')
  }

  for (const action of data.actions) {
    const where = `actions.json (${action.id})`
    check(TARGETS.includes(action.target), where, `unknown target "${action.target}"`)
    check(Number.isInteger(action.cost) && action.cost >= 1, where, 'cost must be a whole number of action points')
    checkEffects(action.effects, where, action.target, projectIds)
    if (action.options) checkUniqueIds(action.options, where)
    for (const option of action.options ?? []) {
      checkEffects(option.effects, `${where}, option ${option.id}`, action.target, projectIds)
    }
  }

  for (const project of data.projects) {
    const where = `projects.json (${project.id})`
    check(Number.isInteger(project.turns) && project.turns >= 1, where, 'turns must be a whole number')
    // A finished project pays out to its builder alone, so it has no target.
    checkEffects(project.effects, where, 'none', projectIds)
  }

  for (const strait of data.straits) {
    check(strait.tradeShare >= 0 && strait.tradeShare <= 100, `straits.json (${strait.id})`, 'tradeShare must be 0 to 100')
  }
  const totalShare = data.straits.reduce((total, strait) => total + strait.tradeShare, 0)
  check(totalShare <= 100, 'straits.json', 'trade shares add up to more than 100%')

  return data
}

export const GAME_DATA: GameData = validateGameData({
  countries: (countriesJson as unknown as CountryDef[]).map((country) => ({ ...country, projects: [] })),
  actions: actionsJson as unknown as ActionDef[],
  projects: projectsJson as unknown as ProjectDef[],
  straits: straitsJson as StraitDef[],
  economy: economyJson,
})

export function getAction(id: string): ActionDef {
  const action = GAME_DATA.actions.find((candidate) => candidate.id === id)
  if (!action) throw new Error(`Unknown action: ${id}`)
  return action
}

export function getProject(id: string): ProjectDef {
  const project = GAME_DATA.projects.find((candidate) => candidate.id === id)
  if (!project) throw new Error(`Unknown project: ${id}`)
  return project
}

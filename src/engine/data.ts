// Loads the game content from src/data and checks it, so a mistake in a JSON
// file fails loudly at startup instead of quietly breaking the rules.

import actionsJson from '../data/actions.json' with { type: 'json' }
import countriesJson from '../data/countries.json' with { type: 'json' }
import economyJson from '../data/economy.json' with { type: 'json' }
import projectsJson from '../data/projects.json' with { type: 'json' }
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
  hasTarget: boolean,
  projectIds: ReadonlySet<string>,
): void {
  for (const effect of effects) {
    switch (effect.kind) {
      case 'stat':
        check(STATS.includes(effect.stat), where, `unknown stat "${effect.stat}"`)
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
      case 'startProject':
        check(projectIds.has(effect.projectId), where, `unknown project "${effect.projectId}"`)
        break
      case 'chance':
        check(effect.probability >= 0 && effect.probability <= 1, where, 'probability must be 0 to 1')
        checkEffects(effect.effects, where, hasTarget, projectIds)
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
  }

  for (const action of data.actions) {
    const where = `actions.json (${action.id})`
    check(TARGETS.includes(action.target), where, `unknown target "${action.target}"`)
    check(Number.isInteger(action.cost) && action.cost >= 1, where, 'cost must be a whole number of action points')
    const hasTarget = action.target !== 'none'
    checkEffects(action.effects, where, hasTarget, projectIds)
    if (action.options) checkUniqueIds(action.options, where)
    for (const option of action.options ?? []) {
      checkEffects(option.effects, `${where}, option ${option.id}`, hasTarget, projectIds)
    }
  }

  for (const project of data.projects) {
    const where = `projects.json (${project.id})`
    check(Number.isInteger(project.turns) && project.turns >= 1, where, 'turns must be a whole number')
    // A finished project pays out to its builder alone, so it has no target.
    checkEffects(project.effects, where, false, projectIds)
  }

  return data
}

export const GAME_DATA: GameData = validateGameData({
  countries: (countriesJson as unknown as CountryDef[]).map((country) => ({ ...country, projects: [] })),
  actions: actionsJson as unknown as ActionDef[],
  projects: projectsJson as unknown as ProjectDef[],
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

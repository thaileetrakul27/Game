// Loads the game content from src/data and checks it, so a mistake in a JSON
// file fails loudly at startup instead of quietly breaking the rules.

import actionsJson from '../data/actions.json' with { type: 'json' }
import countriesJson from '../data/countries.json' with { type: 'json' }
import demandsJson from '../data/demands.json' with { type: 'json' }
import economyJson from '../data/economy.json' with { type: 'json' }
import eventsJson from '../data/events.json' with { type: 'json' }
import factionsJson from '../data/factions.json' with { type: 'json' }
import hedgingJson from '../data/hedging.json' with { type: 'json' }
import projectsJson from '../data/projects.json' with { type: 'json' }
import rivalsJson from '../data/rivals.json' with { type: 'json' }
import straitControlJson from '../data/straitControl.json' with { type: 'json' }
import straitsJson from '../data/straits.json' with { type: 'json' }
import varietyJson from '../data/variety.json' with { type: 'json' }
import type {
  ActionDef,
  ActionTarget,
  CardTarget,
  Condition,
  CountryDef,
  CountryKind,
  DemandDef,
  Effect,
  EconomyField,
  EventCard,
  FactionDef,
  FactionId,
  FactionRules,
  GameData,
  HedgingRules,
  Personality,
  ProjectDef,
  RivalRules,
  StatKey,
  StraitAccess,
  StraitControlRules,
  StraitDef,
} from './types.ts'

const STATS: StatKey[] = ['treasury', 'debt', 'growth', 'legitimacy', 'militaryLoyalty', 'defence', 'alignment']
const ECONOMY_FIELDS: EconomyField[] = ['baseOutput', 'upkeep', 'straitTolls']
const TARGETS: ActionTarget[] = ['none', 'any', 'greatPower', 'minor']
const KINDS: CountryKind[] = ['greatPower', 'minor']
const PERSONALITIES: Personality[] = ['opportunist', 'hardliner', 'merchant']
const ACCESS: StraitAccess[] = ['open', 'taxed', 'closed']

function check(condition: boolean, where: string, problem: string): asserts condition {
  if (!condition) throw new Error(`Invalid game data in ${where}: ${problem}`)
}

function checkUniqueIds(items: readonly { id: string }[], file: string): void {
  const ids = new Set(items.map((item) => item.id))
  check(ids.size === items.length, file, 'ids must be unique')
}

/** Ids that effects can refer to. */
interface References {
  projectIds: ReadonlySet<string>
  factionIds: ReadonlySet<string>
  countryIds: ReadonlySet<string>
}

function checkCountry(id: string | undefined, where: string, refs: References): void {
  check(id !== undefined && refs.countryIds.has(id), where, `unknown country "${id}"`)
}

function checkEffects(effects: readonly Effect[], where: string, target: ActionTarget, refs: References): void {
  const hasTarget = target !== 'none'
  for (const effect of effects) {
    switch (effect.kind) {
      case 'stat':
        check(STATS.includes(effect.stat), where, `unknown stat "${effect.stat}"`)
        // Debt is tracked by creditor, so it only changes through borrow and repayDebt.
        check(effect.stat !== 'debt', where, 'change debt with a borrow or repayDebt effect')
        check(
          effect.who === 'self' || effect.who === 'country' || (effect.who === 'target' && hasTarget),
          where,
          `bad "who": ${effect.who}`,
        )
        if (effect.who === 'country') checkCountry(effect.country, where, refs)
        break
      case 'economy':
        check(ECONOMY_FIELDS.includes(effect.field), where, `unknown economy field "${effect.field}"`)
        check(effect.who === 'self' || (effect.who === 'target' && hasTarget), where, `bad "who": ${effect.who}`)
        break
      case 'relations':
        check(['target', 'otherGreatPower', 'country'].includes(effect.with), where, `bad "with": ${effect.with}`)
        if (effect.with === 'country') checkCountry(effect.country, where, refs)
        else check(hasTarget, where, 'a relations effect needs a target')
        break
      case 'alignment': {
        const toward = effect.toward ?? 'target'
        check(['target', 'otherGreatPower', 'country'].includes(toward), where, `bad "toward": ${toward}`)
        if (toward === 'country') checkCountry(effect.country, where, refs)
        else check(hasTarget, where, 'an alignment effect needs a target')
        break
      }
      case 'borrow':
      case 'repayDebt':
        check(target === 'greatPower', where, `a ${effect.kind} effect needs a great power as the target`)
        check(effect.amount > 0, where, `a ${effect.kind} amount must be above zero`)
        break
      case 'recallLoans':
      case 'forgiveDebt':
      case 'straitAccess':
        check(target === 'greatPower', where, `a ${effect.kind} effect needs a great power as the target`)
        if (effect.kind === 'straitAccess') check(ACCESS.includes(effect.access), where, `bad access "${effect.access}"`)
        break
      case 'faction':
        check(refs.factionIds.has(effect.faction), where, `unknown faction "${effect.faction}"`)
        break
      case 'tradeDeal':
        check(hasTarget, where, 'a tradeDeal effect needs a target')
        check(Number.isInteger(effect.turns) && effect.turns >= 1, where, 'a trade deal must last a whole number of turns')
        break
      case 'startProject':
        check(refs.projectIds.has(effect.projectId), where, `unknown project "${effect.projectId}"`)
        break
      case 'chance':
        check(effect.probability >= 0 && effect.probability <= 1, where, 'probability must be 0 to 1')
        checkEffects(effect.effects, where, target, refs)
        break
      default:
        check(false, where, `unknown effect kind "${(effect as { kind: unknown }).kind}"`)
    }
  }
}

const SPECIAL_TARGETS = ['patron', 'otherPower', 'largestCreditor']

/** The kind of target a card's effects can use. Situation targets are always great powers. */
function cardTargetKind(
  target: CardTarget | undefined,
  where: string,
  refs: References,
  kindOf: (id: string) => string | undefined,
): ActionTarget {
  if (target === undefined) return 'none'
  if (SPECIAL_TARGETS.includes(target)) return 'greatPower'
  checkCountry(target, where, refs)
  return kindOf(target) === 'greatPower' ? 'greatPower' : 'any'
}

function checkCondition(condition: Condition, where: string, refs: References): void {
  switch (condition.kind) {
    case 'stat':
      check(STATS.includes(condition.stat), where, `unknown stat "${condition.stat}" in a condition`)
      if (condition.country !== undefined) checkCountry(condition.country, where, refs)
      break
    case 'relations':
      checkCountry(condition.country, where, refs)
      break
    case 'faction':
      check(refs.factionIds.has(condition.faction), where, `unknown faction "${condition.faction}" in a condition`)
      break
    case 'straitClosed':
    case 'turn':
      break
    default:
      check(false, where, `unknown condition kind "${(condition as { kind: unknown }).kind}"`)
  }
}

/**
 * Every action, or every option of an action that has them, pleases one
 * faction and annoys another. For an offer, accepting it does.
 */
function checkFactionReactions(action: ActionDef): void {
  const choices = action.offer
    ? [['accepted', action.offer.accepted] as const]
    : (action.options?.map((option) => [`option ${option.id}`, option.effects] as const) ?? [['', []] as const])
  for (const [optionId, optionEffects] of choices) {
    const amounts = [...action.effects, ...optionEffects].flatMap((effect) =>
      effect.kind === 'faction' ? [effect.amount] : [],
    )
    const where = `actions.json (${action.id}${optionId ? `, ${optionId}` : ''})`
    check(amounts.some((amount) => amount > 0), where, 'must please a faction')
    check(amounts.some((amount) => amount < 0), where, 'must annoy a faction')
  }
}

/** Check content for broken references and unknown names. Returns the data unchanged. */
export function validateGameData(data: GameData): GameData {
  checkUniqueIds(data.countries, 'countries.json')
  checkUniqueIds(data.actions, 'actions.json')
  checkUniqueIds(data.projects, 'projects.json')
  checkUniqueIds(data.straits, 'straits.json')
  checkUniqueIds(data.demands, 'demands.json')
  checkUniqueIds(data.factions.factions, 'factions.json')
  checkUniqueIds(data.events, 'events.json')
  const refs: References = {
    projectIds: new Set(data.projects.map((project) => project.id)),
    factionIds: new Set(data.factions.factions.map((faction) => faction.id)),
    countryIds: new Set(data.countries.map((country) => country.id)),
  }
  const kindOf = (id: string) => data.countries.find((country) => country.id === id)?.kind

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
      check(kindOf(creditorId) === 'greatPower', where, `creditor "${creditorId}" is not a great power`)
      check(owed >= 0, where, `debt to "${creditorId}" cannot be negative`)
    }
    const owedToPowers = Object.values(country.creditors).reduce((total, owed) => total + owed, 0)
    check(owedToPowers <= country.stats.debt, where, 'debt to creditors adds up to more than its total debt')
  }

  for (const action of data.actions) {
    const where = `actions.json (${action.id})`
    check(TARGETS.includes(action.target), where, `unknown target "${action.target}"`)
    if (action.actor?.kind !== undefined) check(KINDS.includes(action.actor.kind), where, `unknown actor kind "${action.actor.kind}"`)
    if (action.actor?.personality !== undefined) {
      check(PERSONALITIES.includes(action.actor.personality), where, `unknown actor personality "${action.actor.personality}"`)
    }
    if (action.offer) {
      check(action.target !== 'none', where, 'an offer needs a target to make it to')
      check(action.effects.length === 0 && !action.options, where, "an offer's effects go in offer.accepted and offer.declined")
      // The receiver applies them, with the country making the offer as its target.
      const offerer = action.actor?.kind === 'greatPower' ? 'greatPower' : 'any'
      checkEffects(action.offer.accepted, `${where}, accepted`, offerer, refs)
      checkEffects(action.offer.declined, `${where}, declined`, offerer, refs)
    }
    check(Number.isInteger(action.cost) && action.cost >= 1, where, 'cost must be a whole number of action points')
    checkEffects(action.effects, where, action.target, refs)
    if (action.options) checkUniqueIds(action.options, where)
    for (const option of action.options ?? []) {
      checkEffects(option.effects, `${where}, option ${option.id}`, action.target, refs)
    }
    checkFactionReactions(action)
  }

  for (const project of data.projects) {
    const where = `projects.json (${project.id})`
    check(Number.isInteger(project.turns) && project.turns >= 1, where, 'turns must be a whole number')
    // A finished project pays out to its builder alone, so it has no target.
    checkEffects(project.effects, where, 'none', refs)
  }

  for (const strait of data.straits) {
    const where = `straits.json (${strait.id})`
    check(strait.tradeShare >= 0 && strait.tradeShare <= 100, where, 'tradeShare must be 0 to 100')
    check(kindOf(strait.controlledBy) !== undefined, where, `unknown country "${strait.controlledBy}"`)
    for (const powerId of Object.keys(strait.traffic)) {
      check(kindOf(powerId) === 'greatPower', where, `traffic from "${powerId}", which is not a great power`)
    }
    const traffic = Object.values(strait.traffic).reduce((total, share) => total + share, 0)
    check(traffic === 100, where, 'traffic must add up to 100')
  }
  const totalShare = data.straits.reduce((total, strait) => total + strait.tradeShare, 0)
  check(totalShare <= 100, 'straits.json', 'trade shares add up to more than 100%')

  data.straitControl.closureEvents.forEach((event) =>
    checkEffects(event.effects, `straitControl.json (${event.id})`, 'greatPower', refs),
  )
  checkEffects(data.hedging.demandRefusal, 'hedging.json (demandRefusal)', 'greatPower', refs)
  for (const demand of data.demands) {
    checkEffects(demand.accept, `demands.json (${demand.id})`, 'greatPower', refs)
  }

  const eventIds = new Set(data.events.map((event) => event.id))
  for (const event of data.events) {
    const where = `events.json (${event.id})`
    check(event.weight >= 0, where, 'weight cannot be negative')
    check(event.responses.length > 0, where, 'needs at least one response')
    checkUniqueIds(event.responses, where)
    const target = cardTargetKind(event.target, where, refs, kindOf)
    for (const condition of [...(event.conditions ?? []), ...(event.boosts ?? []).map((boost) => boost.when)]) {
      checkCondition(condition, where, refs)
    }
    for (const boost of event.boosts ?? []) check(boost.times > 0, where, 'a boost must multiply by more than 0')
    for (const response of event.responses) {
      const at = `${where}, response ${response.id}`
      checkEffects([...response.effects, ...(response.hidden ?? [])], at, target, refs)
      if (response.chain) {
        check(eventIds.has(response.chain.card), at, `unknown chained card "${response.chain.card}"`)
        check(response.chain.chance > 0 && response.chain.chance <= 1, at, 'chain chance must be above 0, up to 1')
        check(Number.isInteger(response.chain.after) && response.chain.after >= 1, at, 'chain must come 1 or more turns later')
      }
    }
  }
  for (const faction of data.factions.factions) {
    const where = `factions.json (${faction.id})`
    check(faction.start >= 0 && faction.start <= 100, where, 'start must be 0 to 100')
    check(eventIds.has(faction.crisisCard), where, `unknown crisis card "${faction.crisisCard}"`)
  }

  for (const personality of PERSONALITIES) {
    check(data.rivals.personalities[personality] !== undefined, 'rivals.json', `missing weights for "${personality}"`)
  }
  check(data.rivals.tensionCurve >= 0, 'rivals.json', 'tensionCurve cannot be negative')

  const { personalitySwapChance, ...ranges } = data.variety
  for (const [name, range] of Object.entries(ranges)) check(range >= 0, 'variety.json', `${name} cannot be negative`)
  check(personalitySwapChance >= 0 && personalitySwapChance <= 1, 'variety.json', 'personalitySwapChance must be 0 to 1')
  check(Number.isInteger(data.variety.growth / 0.25), 'variety.json', 'growth must be a whole number of 0.25% steps')
  for (const scale of ['treasuryScale', 'relationsScale', 'statScale'] as const) {
    check(data.rivals[scale] > 0, 'rivals.json', `${scale} must be above 0`)
  }
  for (const [actionId, turns] of Object.entries({ any: data.rivals.repeatAfterTurns, ...data.rivals.repeatAfterTurnsFor })) {
    if (actionId !== 'any') check(data.actions.some((action) => action.id === actionId), 'rivals.json', `unknown action "${actionId}"`)
    check(Number.isInteger(turns) && turns >= 1, 'rivals.json', 'turns to wait before a repeat must be a whole number of at least 1')
  }

  return data
}

export const GAME_DATA: GameData = validateGameData({
  countries: (countriesJson as unknown as CountryDef[]).map((country) => ({ ...country, projects: [] })),
  actions: actionsJson as unknown as ActionDef[],
  projects: projectsJson as unknown as ProjectDef[],
  straits: straitsJson as StraitDef[],
  economy: economyJson,
  straitControl: straitControlJson as unknown as StraitControlRules,
  hedging: hedgingJson as unknown as HedgingRules,
  demands: demandsJson as unknown as DemandDef[],
  factions: factionsJson as unknown as FactionRules,
  events: (eventsJson as unknown as { cards: EventCard[] }).cards,
  deck: { cooldownTurns: eventsJson.cooldownTurns },
  rivals: rivalsJson as unknown as RivalRules,
  variety: varietyJson,
})

function find<T extends { id: string }>(items: readonly T[], id: string, kind: string): T {
  const item = items.find((candidate) => candidate.id === id)
  if (!item) throw new Error(`Unknown ${kind}: ${id}`)
  return item
}

export const getAction = (id: string): ActionDef => find(GAME_DATA.actions, id, 'action')
export const getProject = (id: string): ProjectDef => find(GAME_DATA.projects, id, 'project')
export const getStrait = (id: string): StraitDef => find(GAME_DATA.straits, id, 'strait')
export const getDemand = (id: string): DemandDef => find(GAME_DATA.demands, id, 'demand')
export const getEvent = (id: string): EventCard => find(GAME_DATA.events, id, 'event card')
export const getFaction = (id: FactionId): FactionDef => find(GAME_DATA.factions.factions, id, 'faction')

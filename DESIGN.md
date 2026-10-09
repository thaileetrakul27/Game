# Faultlines: Geopolitics Game Plan

Oct 9, 2026 · @Thai

## Concept

Faultlines is a turn-based browser game where you run a small, strategically placed state squeezed between two great powers, and you win by staying sovereign and getting richer without ever fully picking a side.

Most geopolitics games put you in charge of a superpower and reward conquest. This one flips that. You play the hedger, the country everyone wants something from. Your real weapon is the strait running past your coast, and the question of who gets to use it.

- **Setting** is a fictional archipelago called the Meridian Sea, so nothing is tied to real politics and you control every number.
- **Your country** is Kessara, a middle-income state with a deep-water port, a restless military and an ageing ruling coalition.
- **The great powers** are the Halvard Compact (a maritime trading bloc) and the Tsengai Republic (a fast-rising land power). Both want your port, your votes and your loyalty.
- **Neighbours** are four smaller states with their own agendas, rivalries and coups.
- **Session length** is 40 turns, each one a quarter, so a full game is ten in-game years and about 45 minutes of real play.

The original hook is the hedging meter. Every deal you take from one power shifts your alignment toward it. Lean too far and the other side punishes you. Lean too far for too long and your patron starts issuing demands you cannot refuse.

## Core loop and turn structure

Each turn runs through five fixed phases, and you get 4 action points to spend in the middle one.

1. **Briefing.** Income arrives, trade flows through the strait, and a news ticker reports what rivals did last turn.
2. **Crisis.** One event card is drawn (a coup next door, a naval standoff, a debt offer, a typhoon). You pick one of two or three responses, each with visible and hidden effects.
3. **Actions.** Spend 4 action points across the action menu below. Some actions take several turns to finish.
4. **Rival moves.** Both great powers and all four neighbours act, using the same rules you do.
5. **Resolution.** Stats update, thresholds are checked, demands are issued, and the game checks for a win or loss.

| Action | Cost | What it does |
| --- | --- | --- |
| Sign trade deal | 1 | More income, shifts alignment toward that partner |
| Accept loan or investment | 1 | Big cash now, debt and alignment shift later |
| Build infrastructure | 2 | Multi-turn project (port, canal, rail, power grid) |
| Diplomatic summit | 1 | Raise relations with one country, small leverage gain |
| Domestic reform | 2 | Raise legitimacy or stability, angers one faction |
| Military spending | 1 | Raise defence, keeps generals loyal, costs treasury |
| Grant or deny strait access | 1 | Your main lever, huge relations swing both ways |
| Covert operation | 2 | Influence a neighbour's politics, risk of exposure |

## World model

The map has 7 countries and 3 sea chokepoints, and every country runs on the same 7 stats so the rivals can use the same code as the player.

**Map.** A hand-drawn vector map with clickable countries and three straits. The Kessara Strait carries about 40% of regional trade at the start. Building a canal or land bridge elsewhere can reroute that trade, which is the biggest long-term swing in the game.

| Stat | Range | What moves it | Why it matters |
| --- | --- | --- | --- |
| Treasury | money | Income, deals, loans, spending | Hits zero and you default |
| Debt | money | Loans, investment packages | Interest drains treasury each turn |
| Growth | percent | Trade, infrastructure, stability | Sets next turn's income |
| Legitimacy | 0 to 100 | Reforms, crises, corruption | Below 20 risks a coup |
| Military loyalty | 0 to 100 | Defence spending, humiliation | Below 30 risks a coup |
| Defence | 0 to 100 | Military spending | Deters invasion and blockades |
| Alignment | minus 100 to plus 100 | Every deal with either power | Minus is Tsengai, plus is Halvard |

Each country also has a **relations score** with every other country (minus 100 to 100) and a **personality** for the computer players, such as Opportunist, Hardliner or Merchant, which weights the actions they choose.

All of this lives in plain JSON data files (countries, events, actions, projects), so you can rebalance or add content without touching the engine.

## Systems

Five systems drive the game, and the hedging system is the one that makes it feel different.

**1. Economy.** Income each turn equals base output times growth, plus strait tolls, minus debt interest and upkeep. Trade deals raise growth. Infrastructure takes 3 to 8 turns to build, then pays out for the rest of the game. Loans from the great powers are generous but come with strings (see demands).

**2. Hedging and demands.**

- Alignment drifts back toward zero by 2 points a turn if you do nothing.
- Past plus or minus 40, the opposite power cuts trade and starts courting your neighbours against you.
- Past plus or minus 70 for 4 turns in a row, your patron issues a **demand** (host a naval base, recognise a disputed island, expel a rival's companies). Refusing costs a big relations hit and can trigger loan recall. Accepting pushes alignment further.
- Staying between minus 20 and plus 20 earns a **broker bonus**, an extra action point every 3 turns, because both sides keep bidding for you.

**3. Strait control.** Each turn you set access for each power to open, taxed or closed. Taxing pays well. Closing to one side wins huge favour with the other but risks a blockade or a staged incident.

**4. Domestic politics.** Three factions (Generals, Business, Reformers) each have a satisfaction score. Every action pleases one and annoys another. If any faction drops below 15, it can trigger a crisis card such as protests, a strike or a coup attempt.

**5. Crises and events.** A deck of 60 or more event cards, weighted by game state. A coup card only enters the deck if loyalty is low. A debt-trap card only appears if debt is high. Some cards chain across turns, so a naval standoff can escalate into a blockade if handled badly.

**Computer rivals.** Each rival scores every legal action with a simple utility function (gain in its own stats, weighted by personality, plus a bit of randomness), then picks the top ones. No machine learning needed, and it stays readable when you debug it.

## Win and lose conditions

You win by reaching turn 40 still in power, and the ending you get depends on how you played.

| Ending | Condition |
| --- | --- |
| Regional Pivot (best) | Turn 40, alignment between minus 20 and plus 20, top growth in the region |
| Prosperous Client | Turn 40, aligned with one power, but rich and stable |
| Survivor | Turn 40, still in power, nothing else achieved |
| Coup (loss) | Legitimacy below 20 or loyalty below 30 and the coup card succeeds |
| Default (loss) | Treasury below zero for 2 turns in a row |
| Vassal (loss) | Accept 3 demands from the same power |
| Invasion (loss) | Lose a war triggered by a crisis chain |

The game ends with a score screen and a short written epilogue generated from your key decisions, so every run tells its own story.

## Technical stack and architecture

Build it as a browser game in TypeScript, with all the game rules in a separate engine that has no interface code, so it can be tested and simulated on its own.

&#91;embedded content: game architecture · 4 layers\]

The interface only sends player actions to the store and draws whatever state comes back. Every rule lives in the engine.

- **Language and tooling.** TypeScript, Vite for the dev server, React for the interface, Zustand for the game store.
- **Map.** A single SVG file with one shape per country, styled by state. No game engine or canvas library needed.
- **Randomness.** A seeded generator (for example, mulberry32), so any game can be replayed exactly from its seed.
- **Testing.** Vitest for unit tests and the simulation script.
- **Hosting.** Free on GitHub Pages or Netlify, so friends can play from a link.

Suggested folders are src/engine, src/data, src/ui, src/store and scripts/simulate.ts.

## Build milestones

Build in 7 milestones, each one playable before you start the next, and give Claude Code one milestone per session.

Before milestone 1, paste this whole doc into a file called DESIGN.md at the root of the project and tell Claude Code to read it first every session. That keeps it consistent.

Step-by-step setup, from installing Claude Code to the milestone loop, is in Setup instructions.

1. **Engine skeleton.** Prompt: "Read DESIGN.md. Set up a Vite plus React plus TypeScript project. In src/engine, create the GameState type, a seeded random number generator, and a pure function advanceTurn(state, playerActions) that runs the five phases with stub logic. Add Vitest and one test proving the same seed gives the same result."
2. **Data and economy.** Prompt: "Create JSON files for the 7 countries and the 8 actions in DESIGN.md. Implement the economy formulas and action effects in the engine. Add tests for income, debt interest and default."
3. **Bare-bones interface.** Prompt: "Build a plain interface with a stats panel, an action menu that spends 4 action points, an End Turn button and a turn log. No map yet. I want to play 40 turns end to end."
4. **Map.** Prompt: "Add an SVG map of the Meridian Sea with 7 clickable countries and 3 straits. Clicking a country shows its stats and relations. Colour countries by alignment."
5. **Hedging, factions, strait control.** Prompt: "Implement the alignment drift, thresholds, demands, broker bonus, factions and strait access system exactly as DESIGN.md describes. Add tests for each threshold."
6. **Rivals and events.** Prompt: "Implement utility-based computer rivals with the three personalities, and an event deck system with weighted, conditional and chained cards. Write 20 starter event cards in JSON."
7. **Endings, saving, polish.** Prompt: "Add the win and loss checks, endings screen and epilogue, save and load with localStorage, a tutorial overlay for the first 3 turns, and sound toggles."

After each milestone, play it yourself for 10 minutes and tell Claude Code what felt wrong before moving on. Commit to git at the end of every milestone so you can roll back.

## Testing and balancing

Because the engine is pure functions with a seeded random generator, you can have bots play thousands of games in seconds and tune the numbers from the results.

- **Unit tests** for every formula and threshold, written alongside each milestone.
- **Simulation script.** Ask Claude Code for a script that runs 1,000 games with bot players (random, always-Halvard, always-Tsengai, pure hedger) and prints win rates and the most common cause of loss for each.
- **Balance targets.** The pure hedger should win about 35% of the time, the one-side bots about 20%, the random bot under 5%. If one strategy dominates, change the data files, not the code.
- **Playtesting.** Get two or three friends to play one full game each and note the turn where they first got bored or confused.

**Stretch ideas** once it works: a second playable country, a hot-seat two-player mode where each player is a great power competing for Kessara, and a live news feed of your decisions styled like a Geopolitics Journal front page.

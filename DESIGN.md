# Faultlines: Geopolitics Game Plan

Oct 9, 2026 · @Thai

## Concept

Faultlines is a turn-based browser game where you run a small, strategically placed state squeezed between two great powers, and you win by staying sovereign and getting richer without ever fully picking a side.

Most geopolitics games put you in charge of a superpower and reward conquest. This one flips that. You play the hedger, the country everyone wants something from. Your real weapon is the strait running past your coast, and the question of who gets to use it.

- **Setting** is a fictional archipelago called the Meridian Sea, so nothing is tied to real politics and you control every number.
- **Your country** is Kessara, a middle-income state with a deep-water port, a restless military and an ageing ruling coalition.
- **The great powers** are the Halvard Compact (a maritime trading bloc) and the Tsengai Republic (a fast-rising land power). Both want your port, your votes and your loyalty.
- **Neighbours** are four smaller states with their own agendas, rivalries and coups: Valmora, Ostrel, the Sabu Islands and Daranth (see World model).
- **Session length** is 40 turns, each one a quarter, so a full game is ten in-game years and about 45 minutes of real play.

The original hook is the hedging meter. Every deal you take from one power shifts your alignment toward it. Lean too far and the other side punishes you. Lean too far for too long and your patron starts issuing demands you cannot refuse.

## Core loop and turn structure

Each turn runs through five fixed phases, and you get 4 action points to spend in the middle one.

1. **Briefing.** Income arrives, trade flows through the strait, and a news ticker reports what rivals did last turn. The briefing runs at the end of the previous turn, straight after resolution, so you see the money and the news before choosing anything. The first turn's briefing runs when the game starts.
2. **Crisis.** One event card is resolved (a coup next door, a naval standoff, a debt offer, a typhoon). The card is drawn right after the briefing and shown to you before you act, so you always see it before committing to anything. You pick one of two or three responses, each with visible and hidden effects.
3. **Actions.** Spend 4 action points across the action menu below. Some actions take several turns to finish.
4. **Rival moves.** Both great powers and all four neighbours act, using the same rules you do.
5. **Resolution.** Stats update, thresholds are checked, demands are issued, and the game checks for a win or loss. If the game goes on, the next turn's briefing runs and its crisis card is drawn.

You make all of a turn's choices at once, after seeing the briefing and the crisis card: your crisis response together with how you spend your action points. Ending the turn plays the crisis, actions, rival moves and resolution phases, then opens the next turn with its briefing and crisis card.

| Action | Cost | What it does |
| --- | --- | --- |
| Sign trade deal | 1 | More income for 8 turns, shifts alignment toward that partner |
| Accept loan or investment | 1 | Big cash now, debt and alignment shift later |
| Repay debt | 1 | Pay off part of the debt to one great power from the treasury, shifts alignment slightly away from that power since you depend on them less |
| Build infrastructure | 2 | Multi-turn project (port, canal, rail, power grid) |
| Diplomatic summit | 1 | Raise relations with one country, small leverage gain |
| Domestic reform | 2 | Raise legitimacy or stability, angers one faction |
| Military spending | 1 | Raise defence, keeps generals loyal, costs treasury |
| Grant or deny strait access | 1 | Your main lever, huge relations swing both ways |
| Covert operation | 2 | Influence a neighbour's politics, risk of exposure |

## World model

The map has 7 countries and 3 sea chokepoints, and every country runs on the same 7 stats so the rivals can use the same code as the player.

**Map.** A hand-drawn vector map with clickable countries and three straits. The Kessara Strait carries about 40% of regional trade at the start. Building a canal or land bridge elsewhere can reroute that trade, which is the biggest long-term swing in the game.

**Geography.** The Meridian Sea sits in the middle of the map, with land on three sides and the open ocean to the south.

- The **Tsengai Republic** covers the north-west. The **Halvard Compact** runs down the whole eastern coast, and the two great powers share a land border in the far north.
- **Kessara** is a peninsula reaching east into the sea, bordering Tsengai to the north and Ostrel to the west.
- Tsengai's southern coast and Halvard's western coast enclose a gulf north of Kessara. Its only outlet is the Kessara Strait, between Kessara's eastern tip and the Halvard coast, so Tsengai's sea trade depends on that strait.
- **Ostrel** lies west of Kessara and south of Tsengai, with the disputed border running along Kessara's western edge.
- **Daranth** is landlocked, between Tsengai, Ostrel and Valmora.
- **Valmora** holds the south-western coast.
- **The Sabu Islands** are three islands in the south of the Meridian Sea, between Valmora and the Halvard coast.

| Strait | Where | Share of regional trade at the start |
| --- | --- | --- |
| Kessara Strait | Between Kessara's eastern tip and the Halvard coast, the only way in or out of the gulf off the Tsengai coast | 40% |
| Sabu Passage | Between the Sabu Islands and the Halvard coast, out to the open ocean | 35% |
| Valmora Channel | Between Valmora and the Sabu Islands, out to the open ocean | 25% |

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

**Neighbours.** The four smaller states around Kessara:

| Country | Type | Personality | Agenda |
| --- | --- | --- | --- |
| Valmora | Coastal republic | Opportunist | Shifts toward whichever power is winning |
| Ostrel | Military-run state | Hardliner | Border dispute with Kessara |
| The Sabu Islands | Small trading archipelago | Merchant | Rival port competing for strait traffic |
| Daranth | Landlocked | Hardliner | Heavily in debt to Tsengai |

All of this lives in plain JSON data files (countries, events, actions, projects), so you can rebalance or add content without touching the engine.

## Systems

Five systems drive the game, and the hedging system is the one that makes it feel different.

**1. Economy.** Income each turn equals base output times growth, plus strait tolls, minus debt interest and upkeep. Trade deals raise growth. Infrastructure takes 3 to 8 turns to build, then pays out for the rest of the game. Loans from the great powers are generous but come with strings (see demands).

- **Growth does not compound.** It is a percentage applied to base output each turn: 100 base output at 3% growth gives 103 output, every turn that growth stays at 3%.
- **Trade deals last 8 turns.** A trade deal raises the signer's growth by 0.5% and the partner's by 0.25%. It counts in the next 8 briefings, then expires at the end of the 8th turn after it was signed, and that growth goes away. The relations and alignment it brought stay.
- **One deal per partner.** Two countries can have only one active trade deal between them, whoever signed it. A new one can be signed once the old one has expired. The interface lists your active deals and the turns each has left.
- **Debt is tracked by creditor.** A loan from a great power is owed to that power. The rest of a country's debt is owed to lenders outside the region.
- **Interest never reduces debt.** It is charged each turn on the whole debt. The only way to pay debt down is the Repay debt action, which pays off part of what you owe one great power.

**2. Hedging and demands.**

- The great powers anchor the alignment scale. The Halvard Compact sits at plus 100 and the Tsengai Republic at minus 100, and neither ever moves.
- When a deal shifts alignment, the smaller party moves toward the other party's alignment, never past it. Between two smaller states, the one acting moves toward the other. Repaying debt moves you away from that power instead.
- Alignment drifts back toward zero by 2 points a turn if you do nothing. "Doing nothing" means nothing moved your alignment that turn.
- Past plus or minus 40, the opposite power cuts trade and starts courting your neighbours against you. A trade cut lowers your output by 15% and blocks trade deals with that power. Courting lowers each neighbour's relations with you by 2 and pulls its alignment 2 toward that power, every turn.
- Past plus or minus 70 for 4 turns in a row, your patron issues a **demand** (host a naval base, recognise a disputed island, expel a rival's companies). Refusing costs a big relations hit and can trigger loan recall. Accepting pushes alignment further.
  - You answer a demand together with your next turn's choices, like a crisis card.
  - Refusing costs 25 relations with your patron and has a 50% chance of loan recall: you repay everything you owe that power at once.
  - Accepting moves your alignment 10 further toward your patron, plus the demand's own effects. Accepting 3 demands from the same power makes you its vassal and ends the game.
- Staying between minus 20 and plus 20 earns a **broker bonus**, an extra action point every 3 turns, because both sides keep bidding for you. Every third turn in a row that ends within that range gives one extra action point the next turn.
- "Past" a threshold means beyond it, so 40 itself is not past 40. "Between minus 20 and plus 20" includes both ends.

**3. Strait control.** Each turn you set access for each power to open, taxed or closed. Taxing pays well. Closing to one side wins huge favour with the other but risks a blockade or a staged incident.

- Each strait belongs to the country on its shore: the Kessara Strait to Kessara, the Sabu Passage to the Sabu Islands and the Valmora Channel to Valmora.
- **Tolls depend on each strait's trade share and each power's access setting.** Every percentage point of regional trade through a strait earns its owner 0.75 a turn, split between the two powers by their share of the strait's traffic. Taxed traffic pays 1.6 times as much, and closed traffic pays nothing.
- Tsengai sends 60% of the Kessara Strait's traffic, since the strait is its only way out of the gulf. Halvard sends 60% of the Sabu Passage's traffic, and the Valmora Channel's traffic is split evenly.
- You change a power's access with the Grant or deny strait access action, choosing open, taxed or closed. Opening pleases that power, taxing annoys it, and closing angers it and wins favour with the other power.
- While the strait is closed to a power, each turn that power has a 30% chance, minus 1 point for every 4 points of your defence, of staging a blockade or an incident.

**4. Domestic politics.** Three factions (Generals, Business, Reformers) each have a satisfaction score. Every action pleases one and annoys another. If any faction drops below 15, it can trigger a crisis card such as protests, a strike or a coup attempt.

- Satisfaction runs from 0 to 100. Kessara starts with the Generals at 45, Business at 55 and the Reformers at 40.
- Each action's data names the faction it pleases and the one it annoys.
- Each turn a faction ends below 15, there is a 50% chance its crisis card is drawn for the next turn: protests by the Reformers, a strike by Business, or a coup attempt by the Generals.

The numbers in these systems are starting values. They live in the data files so they can be rebalanced.

**5. Crises and events.** A deck of 60 or more event cards, weighted by game state. A coup card only enters the deck if loyalty is low. A debt-trap card only appears if debt is high. Some cards chain across turns, so a naval standoff can escalate into a blockade if handled badly.

- **Drawing.** Each turn draws one card, in this order:
  1. a chained card that has come due;
  2. a faction's crisis card, if a faction is in unrest;
  3. a card picked by weight from the cards whose conditions hold.
- **Weights and conditions.** A card's weight can be boosted while a condition holds, such as a naval standoff becoming more likely while the strait is closed. A card with weight 0 is never picked at random, only by a chain or a faction.
- **Repeats.** A card can't be drawn again within 6 turns of its last draw.
- **Targets.** A card can be about a named country, or about whichever power is your patron, the other power, or your largest creditor at the time.
- **Hidden effects.** Each response shows its visible effects before you choose. Some also have hidden effects, revealed in the log afterwards.
- **Chains.** A response can have a chance to bring a follow-up card a set number of turns later.
- The starter deck has 20 cards, including the three faction crisis cards. Milestone 7 and later can add more to reach the 60 planned above.

**Computer rivals.** Each rival scores every legal action with a simple utility function (gain in its own stats, weighted by personality, plus a bit of randomness), then picks the top ones. No machine learning needed, and it stays readable when you debug it.

- **Choosing.** Each rival has 4 action points, like you. It keeps picking its highest-scoring action until its points run out or nothing is expected to score above a small minimum. The randomness only changes the order of actions worth taking; it never makes a worthless action worth taking.
- **No repeats.** A rival doesn't take the same action on the same target again within 3 turns, so it never takes it twice in a turn and its moves vary from turn to turn.
- **The utility** of an action adds up its change to the rival's own treasury (worth less to a rich country), income over the next 8 turns, legitimacy, military loyalty, defence, relations (great powers count double), and its bloc, plus the damage done to countries it is hostile to.
- **Diminishing returns.** Legitimacy, military loyalty, defence, relations and how far a rival leans count for less the higher they already are, so rivals stop chasing scores that are already high instead of pushing everything to 100.
- **Great powers.** The Halvard Compact and the Tsengai Republic are rivals for the region and never sign deals or hold summits with each other.
- **Bloc** means something different for each kind of rival:
  - A great power wants smaller states, Kessara above all, moving toward its end of the scale.
  - A Hardliner wants to move further toward the side it already leans to.
  - An Opportunist wants to move toward the winning side, the end of the scale that the smaller states lean toward overall.
  - A Merchant wants to stay balanced.
- **Personalities.** Each personality weights these differently:
  - Merchants care most about income.
  - Hardliners care about defence, military loyalty and hurting their enemies.
  - Opportunists sit in between.
- **Chance effects** are scored at their expected value, so a rival can't see the outcome in advance.
- **Consent.** A rival can't sign a trade deal with you on your behalf. Deals with you only happen when you choose them.
- **Investment packages, the Merchant power's strength.** A great power with the Merchant personality, the Halvard Compact, can spend 1 action point to offer a smaller state an investment package. The receiver gets 80 in cash and 3 more base output a turn from the power's treasury, relations with the power rise by 8, and the receiver's alignment moves up to 6 toward the power. Declining costs 4 relations with it.
  - A computer neighbour accepts only if it is better off by its own utility, so the power only offers where it will be accepted.
  - An offer to you arrives like a demand: you accept or decline it with your next turn's choices. Only one offer can wait for you at a time. Accepting pleases Business and annoys the Reformers.
  - A rival scores an offer to you as if you will accept it.
- **Reactions.** When your alignment moves during a turn, the great power you moved away from resents it before the rivals act, losing 0.6 relations with you per point moved. A trade deal with Halvard improves your Halvard relations and costs about 3 with Tsengai.
- **News.** What the rivals did last turn appears as the news at the start of your turn.

**Not yet in effect.** The Diplomatic summit's leverage gain has no effect until leverage is defined. A coup attempt cannot succeed and end the game until milestone 7 adds the win and loss checks.

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
- **Map.** A single SVG with one shape per country, styled by state. The shapes live in src/ui/map/geometry.ts, so each country can be coloured and clicked directly. No game engine or canvas library needed.
- **Randomness.** A seeded generator (for example, mulberry32), so any game can be replayed exactly from its seed.
- **Testing.** Vitest for unit tests and the simulation script.
- **Hosting.** Free on GitHub Pages at thaileetrakul27.github.io/Game/, so friends can play from a link. GitHub Actions builds and deploys the game on every push to main.

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
- **Rival balance targets.** Measured over 100 seeded games with a passive player, who takes no actions, picks crisis responses at random and declines every offer and demand:
  - The four neighbours end the game roughly evenly split between the two powers, with about as many leaning toward Halvard as toward Tsengai.
  - Passive play is still punished, but the passive player's legitimacy never falls below 20 before turn 30.
  - `npm run simulate` plays these 100 games and prints both measures.
- **Playtesting.** Get two or three friends to play one full game each and note the turn where they first got bored or confused.

**Stretch ideas** once it works: a second playable country, a hot-seat two-player mode where each player is a great power competing for Kessara, and a live news feed of your decisions styled like a Geopolitics Journal front page.

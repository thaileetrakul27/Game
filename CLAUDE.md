# CLAUDE.md

Rules for working on Faultlines in this repository.

- Always read DESIGN.md before starting any work.
- Build one milestone at a time. Stop at the end of each and summarise what changed.
- All game rules go in src/engine as pure functions. Never put game logic in src/ui.
- Game content (countries, actions, events, projects) lives in JSON files in src/data.
- Run the tests after every change and fix failures before moving on.
- Use the seeded random generator for all randomness, never Math.random.
- If I change the design, update DESIGN.md first, then the code.

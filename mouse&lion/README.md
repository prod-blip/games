# newgame

Three.js game boilerplate for the Hermes games profile.

## Run

```bash
npm install
npm run dev
```

Normal mode:

```text
http://localhost:5173/
```

Cinematic mode:

```text
http://localhost:5173/?mode=cinematic
http://localhost:5173/?mode=cinematic&scenario=intro
```

## Controls

- Move: WASD / arrow keys
- Action: Space / tap

## Structure

```text
src/
  main.ts
  game/
    Game.ts
    cinematic.ts
    input.ts
    responsive.ts
    types.ts
    objects/
    scene/
    ui/
```

## Next step

Replace the placeholder player/world with the first playable slice for the actual game idea.

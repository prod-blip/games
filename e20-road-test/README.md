# E20 Road Test

Light satire / funny chaos driving prototype.

## Run

```bash
npm install
npm run dev
```

Normal gameplay:

```text
http://localhost:5173/
```

Cinematic mode infrastructure:

```text
http://localhost:5173/?mode=cinematic
http://localhost:5173/?mode=cinematic&scenario=intro
http://localhost:5173/?mode=cinematic&scenario=e20-chaos
```

## Controls

- Right on-screen button / ArrowRight / D: accelerate
- Left on-screen button / ArrowLeft / A: brake / reverse
- R: retry

## Phase 1 scope

Implemented progression build:

- five fuel blend levels: Normal Petrol, E5, E10, E20, E100
- each level has stronger instability, fuel drain, and damage multiplier
- next-level flow after successful finish
- retry flow for current fuel blend
- side-view Three.js road scene
- primitive-shape car
- petrol pump start
- potholes, speed breaker, cones, toll-style barrier
- fuel meter
- win/lose/retry flow
- mobile portrait thumb buttons
- cinematic URL flag detection

## Next planned phase

- add a start/briefing screen with light-satire intro copy
- tune fuel balance after hands-on playtesting
- optionally replace procedural car with CC0 GLB models if desired

## Physics/assets upgrade

The prototype now uses a more grounded side-view vehicle model:

- wheel contact samples front/rear road height
- car body follows road slope instead of sliding flat
- acceleration/braking include traction, slope drag, and rolling drag
- potholes/speed breakers affect suspension and damage more naturally
- procedural car has headlights, tail lights, grille, rims, plate, and clearer bumper/bonnet parts
- roadside props and dust particles add more visual richness

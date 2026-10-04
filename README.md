# PATCHRUN

**AI experimentation infrastructure for game systems.**
Simulate players. Test agents. Generate interventions. Verify outcomes.

> AI proposes. Simulation competes. Evidence decides.

PATCHRUN stress-tests game systems before changes reach real players. It runs seeded behavioural simulations, detects balance problems with deterministic rules, asks an LLM for three competing, bounded interventions, re-simulates every one against **the same cohort and the same seeds**, ranks them with a deterministic score, and verifies the winner on held-out seeds.

It is a pre-deployment behavioural stress test. The simulated profiles do not stand in for real players, and the tool does not replace human playtesting.

## Experiments

| | Experiment 01: Difficulty Cliff | Experiment 02: Battle Royale Bot Lab |
|---|---|---|
| System | 4-stage encounter: OUTPOST → TUNNELS → ELITE WAVE → BOSS | Abstract 100-agent lobby, 5 shrinking phases |
| Population | 100 seeded profiles (35 novice / 40 average / 25 skilled) | 60 seeded humans (24 NEW / 24 AVERAGE / 12 SKILLED) + 40 bots |
| Intervention | ≤ 3 bounded parameter changes | Bot mix across RUSHER / HUNTER / SURVIVOR / SENTINEL / LOOTER (sums to 100%) |
| Default problem | ELITE WAVE has ~70% of failures; 34% simulated survival | NEW early elimination ~66% under *Beginner Onboarding* |
| Evaluation | 1 seeded run of the cohort | 24 seeded matches per strategy |
| Verification | 10 checks + 3 held-out seeds | 10 checks + 3 held-out seed families |

## Flow (both experiments)

1. **Run baseline**: seeded simulation, then telemetry, then a deterministic finding (e.g. `BALANCE REGRESSION DETECTED`).
2. **Generate experiments**: `POST /api/experiment`. The server recomputes telemetry from `(config, seed)` and sends Claude the config, telemetry, finding and parameter bounds. Claude returns structured JSON with a diagnosis and 3 candidates.
3. **Test all candidates**: every candidate is simulated in the browser against the identical population object and seed. The only thing that changes is the configuration.
4. **Rank**: a deterministic scoring function (`lib/scenarios/*/rank.ts`) picks the winner. Model text never affects the score.
5. **Verify winner**: 10 behavioural checks, including held-out seeds. `VERIFIED` / `FAILED` is decided in code.

## Where AI is used, and where it isn't

| Step | Who |
|---|---|
| Simulation, telemetry, problem detection | Deterministic code (seeded PRNG) |
| Diagnosis, hypotheses, the 3 candidate interventions | **Claude** (`claude-opus-5-5`, structured outputs) |
| Validation of model output | Code: known params only, numeric, clamped to bounds, ≤ 3 changes, mixes renormalised to 100, near-duplicates rejected |
| Ranking and winner selection | Deterministic code |
| Verification (VERIFIED / FAILED) | Deterministic code |

**Fallback.** If no key is set, the call fails or times out, or the output doesn't validate after one retry, PATCHRUN uses a rule-based generator. That output is always labelled **DETERMINISTIC FALLBACK** and is never shown as AI output. If only some AI candidates validate, the missing slots are filled with fallback candidates, labelled per candidate (`AI + fallback`). If the API route itself can't be reached, the browser generates the fallback.

## Design and language

- **Look and feel.** A poster-style palette on an ink canvas: a violet brand band, yellow / coral / lime / cobalt / pink accents, ring-node diagrams, and the Unbounded display face. It takes inspiration from a mascot-brand case study; no third-party logos, characters or assets are used.
- **EN / 中文 toggle** sits in the top-right and is remembered per browser. All UI copy is translated (`components/i18n-zh.ts`). Engine output (findings, scores, verdicts, verification checks, fallback candidates) is generated bilingually at the source as `{ en, zh }` (`lib/i18n.ts`), so switching language never re-runs or changes a result. Claude is asked for a Simplified Chinese twin of every prose field (`nameZh`, `diagnosisZh`, …). If a twin is missing, the English text is shown.

## Determinism

- `lib/random/seededRandom.ts`: mulberry32 streams keyed by `(seed, entity, stage/phase)`.
- Each encounter player gets one RNG stream per stage, and each enemy consumes a fixed number of draws, so enemy *k* sees the same random numbers under every config (common random numbers).
- The cohort fingerprint shown in the UI is a hash of the population. It is identical for Original, A, B and C.

## Run locally

```bash
npm install
cp .env.example .env.local   # add ANTHROPIC_API_KEY for real AI; optional
npm run dev                  # http://localhost:3000
```

Quality gates:

```bash
npm run check                # eslint + tsc + vitest + next build
npm run calibrate            # prints ranking/verification across seeds for both experiments
```

To try the AI-mode UI without a key, use the local mock of the Messages API (it returns fixed answers labelled `[MOCK MODEL]`):

```bash
npm run build
node scripts/mock-anthropic.mjs &
ANTHROPIC_BASE_URL=http://127.0.0.1:4599 ANTHROPIC_API_KEY=mock npm start
```

## Environment variables

| Variable | Required | Default | Purpose |
|---|---|---|---|
| `ANTHROPIC_API_KEY` | for real AI | none | Server-side only. Without it the app runs in labelled fallback mode. |
| `ANTHROPIC_MODEL` | no | `claude-opus-5-5` | Model used by the AI experimenter. |
| `PATCHRUN_AI_TIMEOUT_MS` | no | `30000` | Per-call timeout before falling back. |

## Deploy (Vercel)

```bash
npm i -g vercel
vercel link
vercel env add ANTHROPIC_API_KEY production
vercel --prod
```

Or import the repo in the Vercel dashboard (framework: Next.js, no build overrides) and add `ANTHROPIC_API_KEY` under Settings → Environment Variables. `/api/experiment` sets `maxDuration = 60`.

## Layout

```
app/page.tsx                      app shell (no landing page, no auth)
app/api/experiment/route.ts       the single AI endpoint
lib/random/seededRandom.ts        PRNG
lib/simulation/                   shared types + generic ScenarioEngine / runCounterfactuals
lib/scenarios/encounter/          config, population, simulate, evaluate, rank, fallback
lib/scenarios/battleRoyale/       config, population, simulate, evaluate, rank, fallback
lib/scenarios/engines.ts          both scenarios implementing ScenarioEngine
lib/ai/                           prompts + schemas, validation, Anthropic client, orchestration
components/                       UI (shell, timeline, AI panels, per-scenario views)
tests/                            vitest acceptance tests (incl. mock-API SDK integration)
```

## Limitations

- Both simulators are abstract and calibrated so the default scenarios show a clear problem. Real use would need calibration against anonymised telemetry.
- The live Claude call is covered by tests against a mock Messages API. Exercise it with a real key before the demo.
- Generic Battle Royale model. No real game data, maps or assets.

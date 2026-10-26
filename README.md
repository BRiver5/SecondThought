# Second Thought

Hold the urge, buy what lasts. A local-only "no impulse buys" tracker: every
want goes on hold, the app picks how long from a model of how fast your own
urges fade, and a monthly fun fund decides what you can actually buy.

- Expo SDK 54, expo-router, expo-sqlite (no network, no account)
- Engine in `src/lib` (desire model → hold length → fund plan → forecast), unit-tested: `npm test`
- `npm run verify` — tsc + tests + rules + offline export

See `PLAN.md` for the model and screens.

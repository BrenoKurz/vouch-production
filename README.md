# Vouch Member App

The Expo member experience for Vouch, a private, human-curated dating and
personal-introduction service. Members apply, verify, complete matchmaking
intake, review their private dossier, receive curated introductions, talk
after mutual acceptance, schedule dates, complete private debriefs, manage
their membership, and report safety concerns.

There is no swipe deck, public member search, likes queue, paid ranking, or
pre-match messaging.

## Production architecture

- Expo Router application for iOS, Android, and web.
- Supabase Auth for member sessions.
- All domain reads and mutations go through the deployed `api-v1` Edge
  Function.
- `contracts/openapi.json` is synced from the backend repository or the live
  API and generates `src/generated/api-contract.ts`.
- `src/lib/contract.ts` pins the exact API contract. The app fails closed
  with an update message if the deployed API version differs.
- Photos, verification media, intake media, and safety evidence use private
  signed uploads.

The current member API contract is `0.17.0`.

## Local development

Create `.env` with the public API base URL, Supabase URL, and publishable
key. Never place service-role credentials in the mobile app.

```bash
npm install
npm run contract:sync
npm run contract:generate
npx expo start
```

Quality gates:

```bash
npx tsc --noEmit
npm run lint
npm run contract:check
npx expo-doctor
npx expo export --platform web
npx expo export --platform ios
npx expo export --platform android
```

`npm run contract:sync` prefers the sibling
`vouch-personal-connections/src/contracts/openapi.json` file and falls back
to the production contract endpoint. A contract version change requires an
intentional update to both the sync script and `src/lib/contract.ts`.

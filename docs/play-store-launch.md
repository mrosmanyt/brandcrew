# Publish CINEM Pro on Google Play (Android)

App name **CINEM Pro**. Application id **`tech.cinem.pro`**. Source: `mobile/` (Expo / React Native). This wrap is intentional: login hits the same CINEM Pro API as the website, then Mission Control is a WebView of the cloud desk. Shipping a second native Mission Control would fork the desk.

iOS App Store is **out of scope** for this PR (bundle id is listed in `app.json` so a later EAS iOS profile can reuse it).

## Why Expo, not Capacitor

Expo gives Play App Signing, EAS AAB output, SecureStore, and `expo-web-browser` for Google with less native glue than a Capacitor webview project. The desk UI stays the Next.js app — we are not rewriting Mission Control.

## One-time Play Console

1. Create a [Google Play Console](https://play.google.com/console) developer account (Google’s current one-time fee, paid by the CINEM legal entity).
2. Create app → **CINEM Pro** → default language English → app or game: **App** → free or paid.
3. Package name: `tech.cinem.pro` (must match `mobile/app.json` `android.package`). Do not change it after the first upload.
4. Complete **Store listing**, **Privacy policy** (`https://app.cinem.tech/privacy` or `https://cinem.tech/privacy`; Vercel `https://brandcrew.vercel.app/privacy` is the same app), **App content** (content rating questionnaire), **Target audience**, **News app** = no, **Data safety** (account email, device token / refresh token on device, no selling of data).
5. **App signing**: use Play App Signing (Google holds the upload key after the first AAB). Keep the EAS/local upload keystore in a password manager — not in git.

## Build an AAB (founder machine)

This Cloud Agent environment does not ship a signed Play AAB (no Play keystore, no EAS project id). On a laptop with Node 20+:

```bash
cd mobile
npm install
npx eas login
npx eas init          # paste the project id into extra.eas.projectId
npx eas build --platform android --profile production
```

EAS production profile (`mobile/eas.json`) sets `android.buildType: app-bundle`. Download the `.aab` from the EAS page.

Local Gradle alternative (after Android SDK + JDK 17):

```bash
cd mobile
npx expo prebuild --platform android
cd android
./gradlew bundleRelease
# out: android/app/build/outputs/bundle/release/app-release.aab
```

## Internal testing → production

1. Play Console → **Testing → Internal testing** → create a release → upload the AAB.
2. Add testers (Gmail). They install from the opt-in link.
3. Run through: email/password login, Google login, Mission Control WebView, sign out.
4. Complete **Closed testing** if Google asks for 12 testers / 14 days (policy depends on current Play rules for new personal accounts).
5. **Production** → promote the tested release. Rollout 20% then 100%.

## Store listing copy (draft)

- **Short description:** AI employee desk. Agents work; you approve.
- **Full description:** CINEM Pro is a supervised AI employee desk. Sign in with the same account you use on the website. Jobs can browse, draft mail, and wait for you before anything sends or posts.
- **Category:** Business or Productivity.
- **Contact:** CINEM / privacy URL above.
- **Graphics:** 512×512 icon (`mobile/assets/icon.png`; Play may want a higher-res export), 16:9 feature graphic, at least two phone screenshots of login + Mission Control.

## Content rating & Data safety

- Questionnaire: no user-generated public social, no violence. Likely **Everyone** / **Teen** depending on answers — complete honestly.
- Data safety: collected = email, name, app activity (jobs you run). Security practices: data encrypted in transit. Independent security review: no. Delete request: account settings / email CINEM.

## After publish

Paste the Play URL into `src/lib/site.ts` (`ANDROID_PLAY_URL`) and `/download` will switch the Android button from “web desk today” to the store. Bump `mobile/app.json` `version` + `android.versionCode` (EAS can manage versionCode) on every upload.

# Butterleaf

A baking recipe box for Android. Import a recipe from any link, edit it, weigh it in
grams or cups, set as many bake timers as your oven can handle, and keep it all on
your own phone — no account, no cloud, no tracking.

---

## Get the APK on your phone (about 10 minutes, no software to install)

You need a free GitHub account. Everything else happens in the browser.

### 1. Create an empty repository

Go to <https://github.com/new>. Name it `butterleaf`, set it to **Private**, leave
"Add a README" unchecked, and click **Create repository**.

### 2. Upload this project

On the new repo's page, click **uploading an existing file**. Unzip
`Butterleaf.zip` on your computer, then drag **the contents** of the `Butterleaf`
folder into the browser — not the folder itself. You should be uploading
`app/`, `gradle/`, `.github/`, `keystore/`, `build.gradle`, `settings.gradle`,
`gradle.properties`, `gradlew`, `gradlew.bat`, and `README.md`.

Scroll down and click **Commit changes**.

> GitHub's web uploader keeps folder structure when you drag folders in. If it
> refuses, use GitHub Desktop or `git push` instead — same result.

### 3. Let it build

Click the **Actions** tab. A run called *Build Butterleaf APK* starts on its own.
It takes about 4–6 minutes the first time. When the green tick appears, you have
two ways to get the file:

- **Releases** (easiest on a phone): go to the repo's **Releases** section on the
  right-hand side and download `Butterleaf-v1.apk` directly.
- **Actions artifact**: open the finished run and download `Butterleaf-APK`
  (it arrives as a .zip containing the .apk).

### 4. Install it

Open the APK on your Android phone. Android will ask whether to allow installing
apps from this source — say yes. That prompt is normal for any app that doesn't
come from the Play Store.

On first launch, allow notifications when asked. That is what lets a bake timer
ring while the app is closed.

### 5. Later versions

Edit any file in the repo (or re-upload a newer zip) and Actions builds a new APK
automatically. Every build is signed with the same key that ships in
`keystore/butterleaf.keystore`, so a new version installs straight over the old one
and your recipes stay put.

> That keystore is a throwaway key committed on purpose so your builds stay
> installable over each other. It is not a secret and is not suitable for
> publishing to the Play Store — generate your own if you ever go that route.

---

## What's inside the app

**Recipe box**
- Import from a link — Butterleaf fetches the page and lifts the recipe out of it
  (schema.org JSON-LD first, then microdata, then a best-effort sweep of the page).
- Share → Butterleaf from your phone's browser drops a URL straight into the importer.
- Paste plain text instead, for sites that block readers.
- Write your own from scratch, with a photo, description, ingredients and numbered steps.
- Everything stays editable after saving. Duplicate a recipe to riff on it.
- Search by name *and* by ingredient ("what can I make with buttermilk").
- Filter by tag, sort by recent / A–Z / quickest.

**Favorites**
- Tap the heart anywhere. The Favorites page lists them alphabetically, grouped by letter.

**On the recipe page**
- Scale to ½, 1, 1½, 2 or 3 batches — quantities re-render as proper fractions.
- Flip the whole ingredient list between *as written*, *metric* and *US cups*, using a
  real ingredient density table rather than a generic ml↔g guess.
- Tick ingredients off as you measure, tick steps off as you go.
- Any step that mentions a duration grows a "Timer · 25 min" chip — one tap starts it.
- Keep the screen awake while you bake.
- Add every ingredient to the shopping list at the current scale.

**Timers**
- As many as you like, running at once, each with its own label.
- Backed by real Android alarms (`setAlarmClock`), so they ring with sound, vibration and
  a full-screen alert even if the app is closed or the phone is asleep. Snooze 5 minutes
  or stop from the ringing screen.
- Survive a reboot. Quick-start presets for the usual bakery intervals.

**Converter**
- *Convert*: any unit to any unit; crossing volume↔weight asks which ingredient so the
  answer is real.
- *Per cup*: pick an ingredient, see what 1 cup / ¾ / ⅔ / ½ / ⅓ / ¼ / tbsp / tsp weigh.
- *Oven*: °F ↔ °C with gas marks and a fan-oven adjustment.
- *Pans*: "this recipe is for an 8-inch round, I have a 9×13" → multiply by 1.83, and what
  that does to bake time.
- Weights follow King Arthur Baking's ingredient chart, the standard most modern recipes
  are written to.

**Shopping list**
- Add whole recipes or type items naturally ("2 cups buttermilk").
- Same ingredient from two recipes merges and sums, converting units where it can.
- Tick things off in the shop; clear the basket when you're done.

**Baker's percentages**
- *Dough*: flour weight + hydration + salt + starter + yeast → exact grams to weigh,
  with the starter's own flour and water backed out of the totals.
- *My recipe*: point it at a saved recipe and it computes that recipe's real hydration
  and every ingredient as a percentage of total flour.
- *Starter*: feeding ratios (1:5:5 and friends) with the resulting weights.

**Settings & backup**
- Light / dark / follow-the-system theme.
- Default unit system.
- Export your whole recipe box to a single JSON file and restore it later. Worth doing
  now and then — the data lives only on this phone.

---

## For anyone poking at the code

- Pure Java Android host (`app/src/main/java/app/butterleaf/`), no Kotlin, one dependency
  (`androidx.core`). `MainActivity` serves the web layer from `assets/` over a private
  `https://butterleaf.local` origin via `shouldInterceptRequest`, so IndexedDB and
  localStorage behave like they would on a real site.
- The JS bridge (`window.Native`) covers page fetching without CORS, image downloads,
  exact alarms, backup export/import, screen-wake and haptics.
- The app itself is vanilla JS in `assets/js/`: `units.js` (measurement engine),
  `parse.js` (recipe extraction), `store.js` (IndexedDB), `app.js` (router/shell),
  `timers.js`, and one file per view.
- Type is TeX Gyre Pagella, bundled under the GUST Font License (see
  `assets/fonts/GUST-FONT-LICENSE.txt`).
- `minSdk 26`, `targetSdk 34`, AGP 8.5.2, Gradle 8.9, JDK 17.

To build locally instead of on GitHub: open the project in Android Studio and run
**Build → Build Bundle(s) / APK(s) → Build APK(s)**, or `./gradlew assembleRelease`
from a terminal with an Android SDK installed.

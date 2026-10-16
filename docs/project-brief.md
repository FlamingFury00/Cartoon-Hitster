# Cartoon Hitster – Project Brief

Oct 11, 2026 · @Manuel DGV

## Project goal

Build a private Android app that plays a Hitster-style music timeline game using Italian cartoon theme songs ("sigle dei cartoni animati") streamed from Spotify.

The app replaces Hitster's physical QR cards with a virtual deck. Each card hides one theme song; players listen, guess when it came out, and place it correctly on their personal timeline. The first player to collect 10 correctly placed cards wins.

**Target audience:** family and friends, played on one phone passed around the table. Not a public Play Store release in the first version.

**Success criteria for v1:**

- A deck of at least 100 verified Italian cartoon theme songs, each with a correct original release year
- A song starts playing within 2 taps, with title and artist hidden until the card is revealed
- A full game for 2–6 players can be played without leaving the app

## How the game works

Each player starts with one revealed card on their timeline. A turn runs like this:

1. The active player taps **Draw card**; the app picks a random unplayed song from the deck.
2. The song plays; title, artist and year stay hidden.
3. The player chooses where the song fits on their timeline (before, between or after their existing cards).
4. The app reveals the card: cartoon, song title, performer and year.
5. Correct placement keeps the card on the timeline; a wrong one discards it.
6. Optional bonus: naming the cartoon or performer earns a token, usable to skip a song or steal a card (as in the original game).
7. Play passes to the next player. First to 10 cards wins.

## Features

The MVP covers a single shared phone and the core loop; everything else waits for v2.

| Feature | Release | Notes |
| --- | --- | --- |
| Player setup (2–6 names) | MVP | Stored locally for the session |
| Draw a random card, no repeats | MVP | Tracks played songs per game |
| Hidden playback of the song | MVP | See Playback approach |
| Visual timeline per player | MVP | Drag the card into position |
| Card reveal with year, cartoon, title, performer | MVP | Flip animation |
| Win at 10 cards | MVP | Configurable target |
| Tokens (skip / steal) | v2 | Optional rule toggle |
| Deck filters by decade (80s, 90s, 2000s) | v2 | Uses the year field |
| Multiple decks (e.g. anime, Disney Italian dubs) | v2 | Same data format |
| Score history | v2 | Local database |

## Playback approach

Start with deep links for the prototype, then move to the Spotify App Remote SDK so the song title stays hidden during play.

|  | Option A: Deep link | Option B: Spotify App Remote SDK |
| --- | --- | --- |
| How it works | App opens `spotify:track:<id>` in the Spotify app | App controls the installed Spotify app in the background |
| Title hidden? | No: Spotify shows title and cover, so the guesser must look away | Yes: our app stays on screen |
| Developer registration | Not needed | Spotify developer app (Client ID, package name, SHA-1 fingerprint) |
| Account requirements | Spotify Premium on the playing phone (free tier cannot pick a specific track on mobile) | Premium for the developer account and for each user |
| User limit | None | Development Mode: max 5 authorized users |
| Effort | Hours | A few days |

Spotify tightened developer access in February 2026: Premium is required for Development Mode and test users dropped from 25 to 5 ([Spotify announcement](https://developer.spotify.com/blog/2026-02-06-update-on-developer-access-and-platform-security), [Headphonesty](https://www.headphonesty.com/2026/02/spotify-crackdown-thousands-third-party-music-apps/)). Five users is enough for one family; a public release would need Extended Quota, which Spotify reserves for apps with about 250,000 monthly active users.

## Tools and accounts

Everything below is free except Spotify Premium.

| Category | Tool | Purpose |
| --- | --- | --- |
| IDE | Android Studio | Write, build and debug the app |
| Language | Kotlin | Main app language |
| UI | Jetpack Compose | Screens, card flip animation, drag-and-drop timeline |
| Music playback | Spotify App Remote SDK (Android) | Play tracks without showing the title (Option B) |
| Auth | Spotify Android Auth library | Log the player into Spotify for the SDK |
| Developer account | Spotify for Developers dashboard | Register the app, get a Client ID, whitelist up to 5 users |
| Subscription | Spotify Premium | Required to choose specific tracks and for Development Mode |
| Song data | JSON file bundled in the app (later: Room database) | The deck of cards |
| Data prep | Google Sheets or Excel | Curate songs, years and Spotify links before exporting to JSON |
| Version control | Git + GitHub (private repo) | Backups and change history |
| Test device | Android phone with the Spotify app installed | The SDK needs the real Spotify app, not an emulator without it |
| Distribution | Signed APK, side-loaded | Install on family phones without the Play Store |

## Song database

The deck is hand-curated: the year is the heart of the game, and Spotify's metadata cannot be trusted for it.

| Field | Example | Notes |
| --- | --- | --- |
| id | 001 | Unique card number |
| cartoon | Kiss Me Licia | Show the theme belongs to |
| songTitle | Kiss Me Licia | Title as released |
| performer | Cristina D'Avena | Main singer or group |
| year | to verify | First Italian broadcast or original single release, entered by hand |
| spotifyTrackId | 22-character ID | From the track's Share → Copy link URL |
| version | Original / re-recording | Flags newer re-recordings |
| verified | yes / no | Set after checking year and audio |

Curation checklist for each song:

- [ ] Find the track on Spotify and copy its link
- [ ] Confirm it is the original recording, not a cover or later re-recording
- [ ] Look up the real year (first broadcast or first single), not the compilation year Spotify shows
- [ ] Listen to the first 10 seconds: no spoken title or intro that gives the answer away too easily
- [ ] Mark the row as verified

## Constraints and risks

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Spotify changes its developer rules again | SDK playback stops working | Keep the deep-link mode as a fallback inside the app |
| Development Mode capped at 5 users | Only 5 Spotify accounts can play | Use one "host" phone that plays for everyone |
| Some theme songs missing from Spotify | Smaller deck | Note gaps; accept re-recordings flagged as such |
| Wrong years from compilations | Unfair or confusing rounds | Manual year check for every card |
| "Hitster" is a Jumbo trademark | Problems if published | Use an original name (e.g. "Sigle Timeline"); keep the app private |
| Spotify Premium required | Cost for the host | One Premium account on the host phone is enough |

## Roadmap

Five phases, each ending with something playable or testable:

1. **Song list:** curate the first 30 verified songs in a spreadsheet and export to JSON.
2. **Prototype (deep links):** draw a card, open the song in Spotify, reveal the card. Test a real game at home.
3. **Hidden playback:** register the Spotify developer app and switch to the App Remote SDK.
4. **Full game:** player setup, drag-and-drop timelines, win condition, polished card design.
5. **Deck to 100+ songs** and side-load the APK onto family phones.

Open question: which years count as "the year" for shows broadcast several times (first airing vs. most famous rerun)?

## Sources

- [Spotify for Developers: Update on Developer Access and Platform Security (Feb 2026)](https://developer.spotify.com/blog/2026-02-06-update-on-developer-access-and-platform-security)
- [Headphonesty: Spotify crackdown on third-party music apps](https://www.headphonesty.com/2026/02/spotify-crackdown-thousands-third-party-music-apps/)

# What these tests do NOT cover

Written on purpose. A test suite that does not say what it skips makes people think the skipped things are safe.

## Not tested at all

| Not covered | Why it matters | What would cover it |
|---|---|---|
| **Windows.** Everything ran on Linux. | Paths, `taskkill`, `python` vs `python3`, line endings could differ. | Run `npm run test:e2e` and `python -m pytest` on a Windows machine. |
| **Firefox, Safari, phones.** Only Chromium. | Layout and focus behaviour differ per browser. | Add `projects` for `firefox` and `webkit` in `playwright.config.ts`. |
| **Screen readers** (NVDA, JAWS, VoiceOver). | axe checks the rules a machine can check. It cannot hear what a person hears. Roughly a third to a half of real accessibility problems need a person. | Ten minutes with a screen reader on the add form. |
| **Real people on the keyboard / zoom.** | One keyboard journey and one narrow-screen check exist. They are not a review. | A manual pass. |
| **Many users at once.** | One database file, one test at a time. | A load test; `postgres` or similar instead of one SQLite file. |
| **Large lists.** | 30 students. No paging, no virtual list. | Add paging, then test with 5,000 rows (see the Day 47 project). |
| **A slow or dropping network** beyond one 1.2 s delay and one total failure. | Real networks half-fail. | Playwright network throttling through the browser's debugging protocol. |
| **Security.** No login, no limits, no rate limiting, no HTTPS. | Anyone who can reach the server can add or delete. The test-reset address is off unless an environment variable is set, and that is tested, but the setting is the only thing standing between production and a wipe. | Add login first, then test it. |
| **Data that survives upgrades.** | No migrations. The server rebuilds the table at every start (that is how the tests get known data). **This means the server in this project loses its data on restart.** | A real migration tool and a separate test database. |
| **Visual look.** | No screenshot comparison. A page can pass every test and look wrong. | Playwright `toHaveScreenshot`. |
| **The built page versus the dev page.** | The browser tests use the built page. `npm run dev` is not tested. | Run the same specs against it. |
| **Text in other languages and right-to-left.** | Only English messages; a name with an accent is tested, an Arabic name is not. | More cases. |

## Tested only partly

- **Colour contrast** is checked by axe in the real browser on 5 screens, not on every state (for example, hover colours are not checked).
- **Double submit** is tested in the component tests with a pretend server and in the browser only by the single-click path.
- **The component tests use a pretend server (MSW).** It follows the real server's rules for the cases it handles, but it is a copy. If the real server changes and the copy does not, the component tests still pass. The browser journeys (real server) are what catch that, which is why both exist.
- **axe in jsdom** cannot check colour contrast or layout. Those two are only checked in the real browser.

## Known weaknesses of the tests themselves

- The break-it script (`break48.py`) covers the mistakes I thought of. It says nothing about the ones I did not.
- **The missing page icon** (`<link rel="icon">`) cannot be tested here: headless Chromium never asks for `/favicon.ico`, so removing the line changes nothing the tests can see. I removed that case from the break-it list instead of counting it. A normal browser would log a 404.
- Two of my first-draft mutations turned out to be equivalent (the name is already cleaned before its key is built, and `vite preview` reuses `server.proxy`). I rewrote them so they change real behaviour.

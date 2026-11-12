# Student Directory: tested end to end

A small student directory (search, class filter, add, delete) with tests at every level: server (pytest), page with a pretend server (Vitest + React Testing Library + MSW), accessibility (axe), real-browser journeys (Playwright), and a script that breaks the code on purpose to prove the tests notice.

## Run the tests

```powershell
cd backend
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements-dev.txt
python -m pytest -q                 # 50 tests

cd ..\frontend
npm install
npx playwright install chromium
npm test                            # 94 tests
npm run test:e2e                    # 27 browser tests (starts both servers itself)
```

```powershell
python break48.py                   # in the project folder: 57 deliberate mistakes
```

Read `NOT_COVERED.md` for what these tests do not cover.

See `DOCUMENTATION.md` for the full write-up.

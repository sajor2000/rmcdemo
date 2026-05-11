# Getting Started — Agentic Coding for Beginners

> A friendly, zero-jargon walkthrough for anyone new to **agentic coding** — using AI tools that can read files, run commands, and edit code on your behalf.
>
> If you've never used Claude Code, Cursor, or any AI "agent" before, **start here**. By the end of this page you'll have the demo running on your laptop and you'll know what to type to make changes.

---

## What is this repo?

This repo contains two things:

1. **`research-agent/`** — a small Next.js web app. You type a clinical question, the AI agent searches PubMed and OpenAlex, screens articles, and produces a real literature review with verifiable citations. This is the **live demo**.

2. **Root-level files** (`search_strategy.md`, `screening_log.md`, `article_summaries.md`, `evidence_table.md`, `evidence_table.csv`, `narrative_synthesis.md`) — these are **example outputs** from a previous run of the agent. Read them to understand what the app produces.

The whole thing is meant to teach medical students (and curious clinicians) how AI agents *actually* work — not the magic-box version they see in marketing.

---

## What is "agentic coding"?

In normal coding, you type every character yourself. In **agentic coding**, you describe what you want in plain English and an AI does the actual typing — but it can also:

- **Read** files in your project
- **Search** the codebase
- **Run** terminal commands (with your permission)
- **Edit** multiple files at once
- **Test** its own work and fix mistakes

The AI is the agent. You are the supervisor. Your job is to give clear instructions, verify the result, and steer when it goes off course.

### Tools you can use to do agentic coding on this repo

| Tool | Cost | Notes |
|---|---|---|
| [**Cursor**](https://cursor.com/) | Free tier + paid | A VS Code-based IDE with an agent built in. Easiest for beginners. |
| [**Claude Code**](https://docs.anthropic.com/en/docs/claude-code) | Pay-per-use via Anthropic API | A command-line agent. Most powerful, slightly steeper learning curve. |
| [**GitHub Copilot Workspace / Codex**](https://github.com/features/copilot) | Subscription | Good if you already use GitHub. |
| [**Aider**](https://aider.chat/) | Free + your own API key | Open-source CLI agent. |

You only need **one** of these. Cursor is the gentlest starting point.

---

## Prerequisites

Install these once. Skip any you already have.

| Tool | Why | Install |
|---|---|---|
| **Node.js 20+** | Runs the Next.js app | [nodejs.org](https://nodejs.org/) — pick the LTS version |
| **Git** | Version control | [git-scm.com](https://git-scm.com/) — usually pre-installed on macOS |
| **A terminal** | Type commands | macOS: Terminal.app or iTerm2. Windows: PowerShell or WSL. |
| **An OpenRouter account** | Pay for AI calls | [openrouter.ai](https://openrouter.ai/) — fund $5–10, plenty for many demos |
| **Cursor** (recommended) | Agentic IDE | [cursor.com](https://cursor.com/) |

Check your installs by opening a terminal and running:

```bash
node --version    # should print v20.x.x or higher
git --version     # any 2.x.x is fine
```

---

## Step 1 — Get the code

```bash
git clone https://github.com/sajor2000/rmcdemo.git
cd rmcdemo
```

You should now see a folder called `research-agent/` plus several `.md` files.

---

## Step 2 — Install dependencies

The web app lives inside `research-agent/`, so we work from there:

```bash
cd research-agent
npm install
```

This downloads ~390 MB of Node packages into `node_modules/`. Takes 1–2 minutes the first time. You'll never have to do it again unless dependencies change.

---

## Step 3 — Add your API key

The app needs **one required key**: an OpenRouter key. OpenRouter is a single login that gives you access to Claude, GPT, Gemini, and dozens of other models on a pay-per-use basis.

1. Go to [openrouter.ai](https://openrouter.ai/) → sign up → add $5–10 of credit.
2. Click **Keys** → **Create Key** → copy the key (starts with `sk-or-...`).
3. In the `research-agent/` folder, copy the example env file:
   ```bash
   cp .env.local.example .env.local
   ```
4. Open `.env.local` in any text editor and paste your key after `OPENROUTER_API_KEY=`:
   ```text
   OPENROUTER_API_KEY=sk-or-v1-xxxxxxxxxxxxxxxxxxxxxxxx
   ```

Save the file. **Do not commit `.env.local` — `.gitignore` already excludes it.**

### Optional keys (you can skip all of these)

| Key | What it does |
|---|---|
| `OPENALEX_API_KEY` | Lifts OpenAlex rate limits. The app works fine without it. |
| `TAVILY_API_KEY` | Enables the optional "web search" checkbox in the UI. |
| `DEMO_ACCESS_TOKEN` | If you deploy this publicly, requires visitors to send a header to use it. Leave blank for local use. |
| `OPENROUTER_MODEL` | Pick a different model (default is `anthropic/claude-sonnet-4.5`). See `.env.local.example` for cheaper options. |

---

## Step 4 — Run it

Still inside `research-agent/`:

```bash
npm run dev
```

You'll see something like:

```text
   ▲ Next.js 15.5.18
   - Local:    http://localhost:3000
```

Open <http://localhost:3000> in your browser. Tick the no-PHI confirmation, paste the example question, click **Start Research**, and watch the workflow run.

Stop the server with `Ctrl+C` in the terminal when you're done.

---

## Step 5 — Make your first agent-assisted change

Here's the moment you came for. You'll use an AI agent to modify the app *without writing code yourself*.

### If you're using **Cursor**

1. Open Cursor and choose **File → Open Folder…** → pick the `rmcdemo` folder you cloned.
2. Press `Cmd+I` (Mac) or `Ctrl+I` (Windows/Linux) to open the agent panel.
3. Try one of these prompts:

   - **Easy**: "Change the page title to 'My First Agentic Demo' and explain the change."
   - **Medium**: "Add a new example clinical question about migraine prophylaxis to the home page."
   - **Harder**: "Add a button next to 'Start Research' that pre-fills the question with a random example."

4. Cursor will show you a diff. Read it. Click **Accept** if you like it, **Reject** if you don't.
5. Run `npm run dev` again and check the browser.

### If you're using **Claude Code**

1. Install: `npm install -g @anthropic-ai/claude-code` (or follow the official docs).
2. From inside the `rmcdemo` folder: `claude`
3. Try the same prompts as above. Claude Code shows diffs before applying.

### What good prompting looks like

| ❌ Too vague | ✅ Specific & verifiable |
|---|---|
| "Make it better" | "Increase the textarea row count from 3 to 5 so longer questions are easier to read." |
| "Fix the bug" | "When I cancel a run, the 'Researching…' button stays disabled. Fix it." |
| "Add tests" | "Add a Vitest test for the `sanitizeCsvFormulas` function in `src/lib/tools.ts` covering the `=`, `+`, `-`, and `@` prefixes." |

The agent reads better instructions the same way a colleague would: name the file or function, describe the desired behaviour, mention what to verify.

---

## Step 6 — Commit and push your changes

When you're happy with a change, save it to git:

```bash
cd /path/to/rmcdemo     # back to the repo root
git status              # see what changed
git diff                # review the changes
git add -A              # stage everything
git commit -m "Add migraine prophylaxis example question"
git push origin main
```

If `git push` fails with "permission denied", you don't have write access to this remote. Fork it first on GitHub, then change the remote:

```bash
git remote set-url origin https://github.com/YOUR-USERNAME/rmcdemo.git
git push -u origin main
```

---

## Recommended learning path

1. **Just run the demo first.** Don't change anything. See what the agent produces.
2. **Read one source file.** Open `research-agent/src/app/page.tsx` and skim it. Don't try to understand everything.
3. **Make a trivial change with an agent.** Change the title, add a sentence, anything you can verify in the browser.
4. **Break something on purpose.** Delete a line, see the error, ask the agent to fix it. This builds intuition fast.
5. **Read the agent's plan before accepting.** Get comfortable saying *"actually, do it this way instead"*.
6. **Graduate to multi-step work.** Ask the agent to add a feature that touches 2–3 files. Verify each diff.

---

## How the app actually works (one-page tour)

If you're curious about the code, here's the 30-second map:

```text
research-agent/
├── src/
│   ├── app/
│   │   ├── page.tsx                        # The whole UI lives here
│   │   ├── api/
│   │   │   ├── research/route.ts           # The streaming agent — this is the heart of the app
│   │   │   └── config/route.ts             # Tells the UI which keys are configured
│   ├── lib/
│   │   ├── tools.ts                        # The "tools" the agent can call (search, save, etc.)
│   │   ├── pubmed.ts                       # PubMed API helpers
│   │   └── openalex.ts                     # OpenAlex API helpers
│   └── components/
│       ├── WorkflowProgress.tsx            # The left-side step list
│       └── ArtifactPanel.tsx               # The right-side tabbed output viewer
├── docs/
│   └── instructor-runbook.md               # Pre-class checklist for live demos
├── package.json                            # Lists dependencies
├── README.md                               # More technical setup notes
└── .env.local                              # Your secrets (NEVER commit this)
```

The agent loop, in plain English:

1. User types a question and clicks **Start Research**.
2. The browser opens a streaming connection to `/api/research`.
3. The server hands the question to Claude (via OpenRouter) along with a list of tools it can use.
4. Claude decides which tool to call next (`pubmedSearch`, `openAlexSearch`, `saveArtifact`, etc.).
5. The server runs the tool, sends the result back to Claude, and streams the progress to the browser.
6. Claude repeats steps 4–5 until all six artifacts (search strategy, screening log, summaries, evidence table ×2, narrative) are saved.
7. The UI shows a green "Run complete" banner and offers downloads.

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| "OpenRouter API key is not configured" | `.env.local` missing or wrong key | Re-check Step 3. Restart `npm run dev` after editing the file. |
| Browser says "Cannot reach localhost" | `npm run dev` isn't running | Open a terminal in `research-agent/` and run it. |
| Server log shows `[PMC full text] HTTP 429, retrying after 2000ms` | NCBI is rate-limiting us; happens during rapid back-to-back runs | **Not an error.** The app retries automatically with a 2s backoff and the run keeps going. Keep watching. |
| Workflow stuck for 90+ seconds with no log activity | Out of OpenRouter credit, OpenRouter outage, or the model is mid-synthesis writing a long artifact | Check the terminal — if you see `[step]` lines appearing every 30-60s, the agent is working. If totally silent, check your OpenRouter balance and the [OpenRouter status page](https://status.openrouter.ai/). |
| "Incomplete run · N/6 artifacts" banner | Genuine non-transient failure (after the automatic retry already used its one chance) | Look at the server log for a `stream-error` line with a non-empty `cause=...` chain — that's the real underlying error. Retry the same question; the failure mode rarely repeats. |
| PHI rejected error on a clearly clean question | Over-eager regex (e.g., long DOIs can look like phone numbers) | Edit the question slightly. If it's a bug, ask an agent to fix the regex in `src/app/api/research/route.ts`. |
| "Cannot find module 'next'" after `npm install` | Wrong Node version | Run `node --version` — must be 20 or higher. |
| Costs higher than expected | Sonnet 4.5 runs ~$1.60/each; agentic loops replay a lot of context | Switch to `anthropic/claude-haiku-4.5` in `.env.local` for rehearsals (~$0.55, ~3× cheaper). |

---

## Where to go next

- **`research-agent/README.md`** — deeper technical setup, measured cost tables, reliability notes.
- **`research-agent/docs/instructor-runbook.md`** — what to do the morning of a live classroom demo.
- **The output files at the repo root** — read `narrative_synthesis.md` to see what a finished review looks like.
- **The `demo-ready` git tag** — known-good snapshot to roll back to: `git checkout demo-ready` (look around) or `git reset --hard demo-ready` (commit).
- **OpenRouter docs** — <https://openrouter.ai/docs>
- **Vercel AI SDK docs** — <https://sdk.vercel.ai/> (the toolkit this app is built on)
- **Anthropic Claude Code docs** — <https://docs.anthropic.com/en/docs/claude-code>

---

## Safety reminders

- **Never commit `.env.local`.** It contains paid API keys. The repo's `.gitignore` already excludes it; don't fight that.
- **Don't enter PHI** (patient names, MRNs, dates of birth, phone numbers, addresses) into the demo. The app has a regex guard but treat it as a polite reminder, not a firewall.
- **AI-generated citations need verification.** The app guarantees PMIDs and DOIs are *real* (it fetched them from PubMed), but it does not guarantee the agent's *interpretation* of them is correct. Spot-check before quoting.
- **The agent can make mistakes.** Especially with code. Read every diff before accepting. If an agent says "I've tested this thoroughly", verify yourself anyway.

Have fun. The whole point is to make medicine + AI feel approachable.

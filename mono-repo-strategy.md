# Monorepo: LiveKit Agent (Python) + Survey Hub (React/TS/Vite) + Live‑Chatter (React/TS/Vite)

This guide sets up a **single monorepo** that keeps your three apps consistent, reduces AI drift in Cursor, and accelerates dev/CI. It uses **npm workspaces only** (no pnpm, no Turborepo) for JS/TS apps and **Docker** for the Python Agent.

---

## Why this stack

* **npm workspaces (built-in)** – simplest path, zero extra tooling; works well with Turborepo.
* **npm workspaces** – simple, built‑in multi‑project management with no extra tooling.
* **Docker** (Python) – isolates the LiveKit Agent; reproducible locally and in CI.
* **Shared code** – a central `packages/shared` for cross‑app types, schemas, utilities.
* **Cursor Project Rules** – scoped rules under `.cursor/rules` to keep the AI consistent across apps.

---

## Directory layout

```
voice-surveys/
├─ apps/
│  ├─ live-chatter/            # React + TS + Vite (AI voice survey UI)
│  └─ survey-hub/              # React + TS + Vite (campaigns, questions, links, dashboard)
├─ services/
│  └─ livekit-agent/           # Python LiveKit Agent (containerized)
├─ packages/
│  └─ shared/                  # Shared TS types, zod schemas, utils (incl. Supabase types)
├─ supabase/                   # Shared DB + Edge Functions (Deno)
│  ├─ migrations/              # SQL migrations (versioned)
│  ├─ seed.sql                 # Optional seed
│  ├─ config.toml              # Supabase CLI config
│  └─ functions/
│     └─ survey-api/           # Deno (Edge Function) shared by all apps & agent
│        ├─ index.ts
│        ├─ deno.json
│        └─ import_map.json
├─ docs/                       # Architecture, ADRs, runbooks, Cursor rules overview
├─ .cursor/
│  └─ rules/                   # Project Rules (MDC)
├─ .editorconfig
├─ .gitignore
├─ package.json                # Turborepo scripts at root
├─ pnpm-workspace.yaml
├─ tsconfig.base.json
└─ docker-compose.yml          # Optional: orchestrate the Python service in dev
```

---

## 1) Create the empty monorepo

```bash

# Init
git init -b main
npm init -y
```

### Quick bootstrap (copy/paste)

The script below scaffolds a **clean npm-only** skeleton with both React apps, the Python agent, shared package, Supabase, and Cursor rules.

```bash
# Root files
cat > .gitignore <<'GIT'
node_modules
.DS_Store
.env*
/.cache
/dist
**/.vite
**/.tsbuildinfo
**/__pycache__
**/*.pyc
**/.venv
**/.ruff_cache
GIT

cat > package.json <<'JSON'
{
  "name": "@repo/voice-surveys",
  "private": true,
  "packageManager": "npm@10.8.2",
  "workspaces": ["apps/*", "packages/*", "services/*"],
  "scripts": {
    "dev:live-chatter": "npm run dev -w @apps/live-chatter",
    "dev:survey-hub": "npm run dev -w @apps/survey-hub",
    "build:live-chatter": "npm run build -w @apps/live-chatter",
    "build:survey-hub": "npm run build -w @apps/survey-hub",
    "typecheck": "npm run typecheck -ws --if-present",
    "lint": "npm run lint -ws --if-present",
    "test": "npm run test -ws --if-present",
    "dev:agent": "docker compose up --build livekit-agent",
    "down:agent": "docker compose down",
    "dev:db": "supabase start",
    "dev:api": "supabase functions serve survey-api --env-file supabase/.env",
    "db:types": "supabase gen types typescript --local > packages/shared/src/supabase.types.ts"
  }
}
JSON

cat > tsconfig.base.json <<'JSON'
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "baseUrl": ".",
    "paths": { "@shared/*": ["packages/shared/src/*"] }
  }
}
JSON

mkdir -p apps/live-chatter apps/survey-hub packages/shared/src services/livekit-agent supabase/functions/survey-api supabase/migrations .cursor/rules docs

# Shared package
cat > packages/shared/package.json <<'JSON'
{ "name": "@shared/core", "private": true, "type": "module", "version": "0.0.0" }
JSON
cat > packages/shared/src/survey.ts <<'TS'
export type QuestionKind = 'single'|'multi'|'free'|'scale';
export type Question = { id: string; kind: QuestionKind; label: string; options?: string[]; required?: boolean };
export type Campaign = { id: string; name: string; startsAt: string; endsAt?: string; questions: Question[] };
TS

# Live Chatter app
cat > apps/live-chatter/package.json <<'JSON'
{
  "name": "@apps/live-chatter",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "typecheck": "tsc -p tsconfig.json --noEmit"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^4.3.1",
    "typescript": "^5.6.2",
    "vite": "^5.4.6"
  }
}
JSON
cat > apps/live-chatter/tsconfig.json <<'JSON'
{ "extends": "../../tsconfig.base.json", "compilerOptions": { "types": ["vite/client"] }, "include": ["src"] }
JSON
cat > apps/live-chatter/vite.config.ts <<'TS'
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';
export default defineConfig({
  plugins: [react()],
  resolve: { alias: { '@shared': fileURLToPath(new URL('../../packages/shared/src', import.meta.url)) } }
});
TS
mkdir -p apps/live-chatter/src
cat > apps/live-chatter/src/main.tsx <<'TSX'
import React from 'react';
import { createRoot } from 'react-dom/client';
import type { Campaign } from '@shared/survey';
const App = () => <div>Live Chatter ready</div>;
createRoot(document.getElementById('root')!).render(<App/>);
TSX
cat > apps/live-chatter/index.html <<'HTML'
<!doctype html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head><body><div id="root"></div><script type="module" src="/src/main.tsx"></script></body></html>
HTML

# Survey Hub app
cp -R apps/live-chatter/ apps/survey-hub/
sed -i.bak "s/@apps\/live-chatter/@apps\/survey-hub/" apps/survey-hub/package.json && rm apps/survey-hub/package.json.bak
sed -i.bak "s/Live Chatter/Survey Hub/" apps/survey-hub/src/main.tsx && rm apps/survey-hub/src/main.tsx.bak

# Python LiveKit Agent
cat > services/livekit-agent/requirements.txt <<'REQ'
livekit-agents==1.2.5
pydantic>=2
python-dotenv
requests
REQ
cat > services/livekit-agent/Dockerfile <<'DOCKER'
FROM python:3.11-slim
WORKDIR /app
COPY services/livekit-agent/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt
COPY services/livekit-agent/ ./
CMD ["python", "main.py", "start"]
DOCKER
cat > services/livekit-agent/main.py <<'PY'
if __name__ == '__main__':
    print('LiveKit Agent placeholder')
PY

# Supabase Edge Function (Deno)
cat > supabase/functions/survey-api/index.ts <<'TS'
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
serve((_req) => new Response(JSON.stringify({ ok: true, service: 'survey-api'}), { headers: { 'content-type': 'application/json' }}));
TS
cat > supabase/functions/survey-api/deno.json <<'JSON'
{ "tasks": { "dev": "deno run -A index.ts", "check": "deno check index.ts", "lint": "deno lint" } }
JSON

# Cursor Rules (root minimal)
cat > .cursor/rules/global-architecture.mdc <<'MDC'
---
description: Monorepo map & non-negotiables
globs:
alwaysApply: true
---
- apps/* (frontends), services/* (Python), packages/shared (TS contracts), supabase/* (DB + Edge Functions).
- Shared survey contracts live in packages/shared/src/survey.ts.
- Never hardcode secrets; use .env files.
MDC
```

Run installs for the apps when you’re ready:

```bash
npm i -w @apps/live-chatter -D vite @vitejs/plugin-react typescript
npm i -w @apps/survey-hub -D vite @vitejs/plugin-react typescript
```

Then start:

````bash
npm run dev:live-chatter
npm run dev:survey-hub
npm run dev:agent       # after you add your real agent code/env
npm run dev:db          # requires Supabase CLI installed
npm run dev:api         # serve the Deno Edge Function
```bash
mkdir voice-surveys && cd voice-surveys
git init -b main
npm init -y
```bash
mkdir voice-surveys && cd voice-surveys
git init -b main
npm init -y
npm i -D turbo typescript
```bash
mkdir voice-surveys && cd voice-surveys
git init -b main
corepack enable   # enables pnpm if not already
pnpm init -y
pnpm add -D turbo typescript
````

**Root files** (create these now):

**.gitignore**

```
node_modules
.pnpm-store
.DS_Store
.env*
.idea
.vscode
/dist
.next
out
.coverage
.cache
**/.turbo
**/.tsbuildinfo
**/__pycache__
**/*.pyc
**/.venv
**/.ruff_cache
```

**.editorconfig**

```
root = true
[*]
charset = utf-8
end_of_line = lf
indent_style = space
indent_size = 2
insert_final_newline = true
trim_trailing_whitespace = true
```

**npm workspaces**

> With npm, you don’t need a separate workspace file. Declare workspaces in the **root `package.json`** (below).yaml
> packages:

* apps/\*
* packages/\*
* services/\*

````

**package.json** (root)
```json
{
  "name": "@repo/voice-surveys",
  "private": true,
  "packageManager": "npm@10.8.2",
  "workspaces": ["apps/*", "packages/*", "services/*"],
  "scripts": {
    "dev:live-chatter": "npm run dev -w @apps/live-chatter",
    "dev:survey-hub": "npm run dev -w @apps/survey-hub",
    "build:live-chatter": "npm run build -w @apps/live-chatter",
    "build:survey-hub": "npm run build -w @apps/survey-hub",
    "typecheck": "npm run typecheck -ws --if-present",
    "lint": "npm run lint -ws --if-present",
    "test": "npm run test -ws --if-present",
    "dev:agent": "docker compose up --build livekit-agent",
    "down:agent": "docker compose down",
    "dev:db": "supabase start",
    "dev:api": "supabase functions serve survey-api --env-file supabase/.env",
    "db:types": "supabase gen types typescript --local > packages/shared/src/supabase.types.ts"
  }
}
```json
{
  "name": "@repo/voice-surveys",
  "private": true,
  "packageManager": "npm@10.8.2",
  "workspaces": ["apps/*", "packages/*", "services/*"],
  "scripts": {
    "dev": "turbo run dev --parallel",
    "build": "turbo run build",
    "lint": "turbo run lint",
    "typecheck": "turbo run typecheck",
    "test": "turbo run test",
    "dev:agent": "docker compose up --build livekit-agent",
    "dev:db": "supabase start",
    "dev:api": "supabase functions serve survey-api --env-file supabase/.env",
    "db:types": "supabase gen types typescript --local > packages/shared/src/supabase.types.ts"
  },
  "devDependencies": {
    "turbo": "^2.0.0",
    "typescript": "^5.6.2"
  }
}
```json
{
  "name": "@repo/voice-surveys",
  "private": true,
  "packageManager": "pnpm@9",
  "scripts": {
    "dev": "turbo run dev --parallel",
    "build": "turbo run build",
    "lint": "turbo run lint",
    "typecheck": "turbo run typecheck",
    "test": "turbo run test"
  },
  "devDependencies": {
    "turbo": "^2.0.0",
    "typescript": "^5.6.2"
  }
}
````

**turbo.json**

```json
{
  "$schema": "https://turbo.build/schema.json",
  "pipeline": {
    "dev": {
      "cache": false,
      "persistent": true
    },
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**", "build/**"]
    },
    "lint": {"outputs": []},
    "typecheck": {"outputs": []},
    "test": {"outputs": ["coverage/**"]},
    "docker": { "cache": false }
  }
}
```

**tsconfig.base.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "baseUrl": ".",
    "paths": {
      "@shared/*": ["packages/shared/src/*"]
    }
  }
}
```

---

## 2) Import your three existing repos (keep FULL history)

Use `git subtree add` *without* `--squash` to preserve history under each subfolder.

```bash
# live-chatter (React/Vite)
git remote add live-chatter https://github.com/you/live-chatter.git
mkdir -p apps/live-chatter
git subtree add --prefix=apps/live-chatter live-chatter main

# survey-hub (React/Vite)
git remote add survey-hub https://github.com/you/survey-hub.git
mkdir -p apps/survey-hub
git subtree add --prefix=apps/survey-hub survey-hub main

# livekit-agent (Python)
git remote add livekit-agent https://github.com/you/livekit-agent.git
mkdir -p services/livekit-agent
git subtree add --prefix=services/livekit-agent livekit-agent main
```

Sync later:

```bash
git subtree pull --prefix=apps/live-chatter live-chatter main
# or push back out if needed
git subtree push --prefix=apps/live-chatter live-chatter main
```

---

## 3) Shared code package (`packages/shared`)

**packages/shared/package.json**

```json
{
  "name": "@shared/core",
  "private": true,
  "type": "module",
  "version": "0.0.0",
  "devDependencies": {
    "typescript": "^5.6.2",
    "zod": "^3.23.8"
  }
}
```

**packages/shared/src/survey.ts**

```ts
import { z } from "zod";

export const QuestionSchema = z.object({
  id: z.string(),
  kind: z.enum(["single", "multi", "free", "scale"]),
  label: z.string(),
  options: z.array(z.string()).optional(),
  required: z.boolean().default(true)
});

export const CampaignSchema = z.object({
  id: z.string(),
  name: z.string(),
  startsAt: z.string(),
  endsAt: z.string().optional(),
  questions: z.array(QuestionSchema)
});

export type Question = z.infer<typeof QuestionSchema>;
export type Campaign = z.infer<typeof CampaignSchema>;
```

> Both apps import via path alias: `import type { Campaign } from "@shared/survey";`

---

## 4) Wire up the Vite apps to the workspace

Ensure both **apps** extend the root TS config and have a Vite alias for `@shared`:

**apps/live-chatter/tsconfig.json** (same pattern for `survey-hub`)

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "types": ["vite/client"]
  },
  "include": ["src"]
}
```

**apps/live-chatter/vite.config.ts** (same alias for `survey-hub`)

```ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@shared": fileURLToPath(new URL("../../packages/shared/src", import.meta.url))
    }
  }
});
```

**apps/live-chatter/package.json** (example skeleton)

```json
{
  "name": "@apps/live-chatter",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "lint": "echo 'add eslint' && exit 0",
    "typecheck": "tsc -p tsconfig.json --noEmit"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^4.3.1",
    "typescript": "^5.6.2",
    "vite": "^5.4.6"
  }
}
```

> Repeat for `apps/survey-hub` with `name: "@apps/survey-hub"`.

---

## 5) Python LiveKit Agent under `services/livekit-agent`

If your repo already has these files, keep them; otherwise add minimal ones:

**services/livekit-agent/requirements.txt**

```
livekit-agents==1.2.5
pydantic>=2
python-dotenv
requests
```

**services/livekit-agent/Dockerfile**

```dockerfile
FROM python:3.11-slim
WORKDIR /app
COPY services/livekit-agent/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt
COPY services/livekit-agent/ ./
CMD ["python", "main.py", "start"]
```

**Runtime env (example)**

```
LIVEKIT_URL=
LIVEKIT_API_KEY=
LIVEKIT_API_SECRET=
SURVEY_API_URL=http://127.0.0.1:54321/functions/v1/survey-api
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
```

**Python usage of shared contract**: treat TS contracts as authoritative; mirror with Pydantic models or fetch JSON schemas from `packages/shared`/`schema` when available.

---

## 5b) Supabase DB (shared by all projects)

We keep the database **inside the monorepo** under `/supabase`. Use the Supabase CLI for local dev, migrations, seeds, and type generation for TypeScript.

**Install**: [https://supabase.com/docs/guides/cli](https://supabase.com/docs/guides/cli)

**Typical workflow**

```bash
# Start local stack (Postgres, API, Studio)
supabase start

# Create a migration from schema changes in the local DB
supabase db diff -f 001_init

# Apply migrations
supabase db reset   # or: supabase db push

# Generate TypeScript types from local schema into shared package
supabase gen types typescript --local > packages/shared/src/supabase.types.ts
```

**/supabase/config.toml**: default

* store migrations under `/supabase/migrations`
* use `/supabase/functions` for Edge Functions

**Commit policy**

* PRs that touch DB **must** include new/updated SQL in `/supabase/migrations` and refresh `packages/shared/src/supabase.types.ts`.
* Seeds in `/supabase/seed.sql` for local dev.

---

## 5c) Deno Supabase Edge Function: `survey-api` (shared)

Implement the shared API as a Supabase **Edge Function** (Deno) so all three projects call the same endpoints, locally and in prod.

**/supabase/functions/survey-api/index.ts** (minimal example using Deno std)

```ts
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req) => {
  const url = new URL(req.url);
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  if (req.method === "GET" && url.pathname === "/") {
    return new Response(JSON.stringify({ ok: true, service: "survey-api" }), { headers: { "content-type": "application/json" } });
  }

  if (req.method === "GET" && url.pathname.startsWith("/campaigns/")) {
    const id = url.pathname.split("/").pop();
    const { data, error } = await supabase.from("campaigns").select("*").eq("id", id).single();
    if (error) return new Response(error.message, { status: 400 });
    return new Response(JSON.stringify(data), { headers: { "content-type": "application/json" } });
  }

  if (req.method === "POST" && url.pathname === "/responses") {
    const body = await req.json();
    const { data, error } = await supabase.from("responses").insert(body).select();
    if (error) return new Response(error.message, { status: 400 });
    return new Response(JSON.stringify(data), { headers: { "content-type": "application/json" } });
  }

  return new Response("Not found", { status: 404 });
});
```

**/supabase/functions/survey-api/deno.json**

```json
{
  "tasks": {
    "dev": "deno run -A index.ts",
    "check": "deno check index.ts",
    "lint": "deno lint"
  },
  "imports": {
    "@supabase/supabase-js": "https://esm.sh/@supabase/supabase-js@2"
  }
}
```

**Run locally**

```bash
# from repo root
supabase start
supabase functions serve survey-api --env-file supabase/.env   # exposes /functions/v1/survey-api
```

> Local URL is typically `http://127.0.0.1:54321/functions/v1/survey-api`.

**Env for function** (`supabase/.env`)

```
SUPABASE_URL=http://127.0.0.1:54321
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9... (local dev key from supabase start)
```

**Clients consume the same endpoint**

* Frontends: `VITE_FUNCTION_URL=/functions/v1/survey-api`
* Agent: `SURVEY_API_URL` as above (see 5)

---

## 5d) Frontends wiring for the shared API

Add env and a tiny client util in each app to call the Edge Function.

**.env.example** (both apps)

```
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_FUNCTION_URL=/functions/v1/survey-api
```

**apps/\*/src/lib/api.ts**

```ts
export async function api<T>(path: string, init?: RequestInit) {
  const base = `${import.meta.env.VITE_SUPABASE_URL}${import.meta.env.VITE_FUNCTION_URL}`.replace(/\/$/, "");
  const res = await fetch(`${base}${path}`, { ...init, headers: { 'content-type': 'application/json', ...(init?.headers||{}) } });
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<T>;
}
```

**Usage**

```ts
import { api } from "./lib/api";
const campaign = await api(`/campaigns/${id}`);
```

---

## 5e) Turbo + scripts for DB & API

Add convenience scripts at the root. (Supabase CLI must be installed locally.)

**package.json (root)** – add:

```json
{
  "scripts": {
    "dev": "turbo run dev --parallel",
    "dev:agent": "docker compose up --build livekit-agent",
    "dev:db": "supabase start",
    "dev:api": "supabase functions serve survey-api --env-file supabase/.env",
    "db:types": "supabase gen types typescript --local > packages/shared/src/supabase.types.ts"
  }
}
```

**turbo.json** – no changes needed; these are root scripts. You may add a lightweight package under `services/survey-api` if you want Turborepo pipelines for Deno.

---

## 6) Docker Compose (optional for local dev)

**Note:** Supabase CLI already uses Docker internally; prefer **Supabase CLI** for DB rather than adding database services to this compose file. Keep Compose for the Python agent (and optionally any ancillary services you own).

**docker-compose.yml** (at repo root):

```yaml
version: "3.9"
services:
  livekit-agent:
    build:
      context: .
      dockerfile: services/livekit-agent/Dockerfile
    env_file:
      - services/livekit-agent/.env
    restart: unless-stopped
```

> Bring it up with: `docker compose up --build livekit-agent`

You can expose Vite apps separately with `pnpm dev`. For the API and DB use the Supabase CLI as described above.

---

## 7) Workspace wiring & scripts (no Turborepo)

* Each app keeps its own `package.json` with `dev`, `build`, `typecheck`, `lint` scripts.
* Root scripts invoke workspace scripts using `-w <workspace>`.
* To build both apps:

```bash
npm run build:live-chatter && npm run build:survey-hub
```

* To typecheck/lint all workspaces that define those scripts:

```bash
npm run typecheck
npm run lint
```

---

## 8) GitHub Actions CI (minimal, no Turborepo)

**.github/workflows/ci.yml**

```yaml
name: CI
on: [push, pull_request]

jobs:
  web:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'npm'
      - run: npm ci
      - run: npm run typecheck
      - run: npm run build:live-chatter
      - run: npm run build:survey-hub

  python-image:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Build LiveKit Agent image
        run: |
          docker build -f services/livekit-agent/Dockerfile -t livekit-agent:ci .

  deno-functions:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: denoland/setup-deno@v1
        with: { deno-version: v1.x }
      - run: deno lint supabase/functions/survey-api
      - run: deno check supabase/functions/survey-api/index.ts

  supabase-types:
    if: ${{ false }} # enable when you want drift protection
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: supabase/setup-cli@v1
      - run: |
          supabase start
          supabase gen types typescript --local > /tmp/types.ts
          diff -u /tmp/types.ts packages/shared/src/supabase.types.ts || (echo "Types drift detected" && exit 1)
```

---

## 9) Cursor AI guardrails (Project Rules: `.cursor/rules`)

Cursor’s legacy `.cursorrules` is deprecated. Use **Project Rules** under `.cursor/rules` with **scoped MDC files** and nested rules. Rules can be **Always**, **Auto Attached** (via `globs`), **Agent Requested**, or **Manual**. Keep rules short and focused; split by domain (frontend, agent, shared contracts).

### Folder layout for rules

```
.cursor/
  rules/
    global-architecture.mdc         # minimal Always rule (short!)
    dev-workflows.mdc               # Agent Requested (helpers/templates)
packages/
  shared/
    .cursor/rules/shared-contracts.mdc
apps/
  live-chatter/
    .cursor/rules/frontend-standards.mdc
  survey-hub/
    .cursor/rules/frontend-standards.mdc
services/
  livekit-agent/
    .cursor/rules/python-agent-standards.mdc
```

### Example rule files (copy‑paste)

**.cursor/rules/global-architecture.mdc**
*(Keep tiny; Type: Always)*

```md
---
description: Monorepo map & non-negotiables
globs:
alwaysApply: true
---
- Monorepo layout: apps/* (frontends), services/* (Python agents), packages/shared (TS types, zod), schema/* (OpenAPI/JSON schemas).
- Shared survey contracts live in @packages/shared/src/survey.ts and are the **single source of truth**.
- Never hardcode secrets. Use `.env` files; frontends via `import.meta.env.VITE_*`, Python via `python-dotenv`.
- When changing survey contracts: update zod schemas, regen types, adapt both apps & agent.
- Prefer small PRs + ADR in /docs/adr for cross-cutting changes.
```

**packages/shared/.cursor/rules/shared-contracts.mdc**
*Type: Auto Attached*

```md
---
description: Survey domain contract & change checklist
globs:
  - packages/shared/**
  - apps/**/src/**
  - services/livekit-agent/**
alwaysApply: false
---
**Contract owner**: `packages/shared/src/survey.ts`.
- Add/modify fields **only here**; validate with zod; export TS types.
- Bump a minor version in `packages/shared/package.json` when contract changes.
- Update both frontends to consume new types; compile both apps.
- Agent: map contract fields to runtime payloads (STT/TTS prompts, storage) and add migration notes.

@packages/shared/src/survey.ts
```

**apps/\*/.cursor/rules/frontend-standards.mdc**
*Type: Auto Attached*

```md
---
description: React/Vite standards for UI + data validation
globs:
  - apps/**/src/**/*.{ts,tsx}
  - packages/shared/**
alwaysApply: false
---
- Use functional components, hooks-first structure, Tailwind for styling, Framer Motion for micro‑animations.
- Import shared contracts via `@shared/*`; don’t duplicate types.
- Validate all external data with zod. For forms, infer types from schemas.
- Vite alias must point to `../../packages/shared/src`.
- No hardcoded endpoints; read from `VITE_API_BASE_URL`.
- Testing: colocate `*.test.tsx`; favor Playwright for e2e.
```

**services/livekit-agent/.cursor/rules/python-agent-standards.mdc**
*Type: Auto Attached*

```md
---
description: LiveKit Agent Python conventions
globs:
  - services/livekit-agent/**
  - packages/shared/**
alwaysApply: false
---
- Structure: `main.py` entrypoint; config via `.env` (LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET, STT_PROVIDER, TTS_PROVIDER, SURVEY_CONFIG_URL).
- Pydantic v2 for config/models; `ruff` for lint. Keep side‑effects out of imports.
- Treat `packages/shared` as the contract; never re-define survey models; transform at boundaries.
- Docker image built from repo root using `services/livekit-agent/Dockerfile`.
- Logs: use structured logging (json) with context (call_id, user_id, campaign_id).
```

**.cursor/rules/dev-workflows.mdc**
*Type: Agent Requested*

````md
---
description: Common dev tasks & templates (no Turborepo)
globs:
  - **
alwaysApply: false
---
**Start dev**  
- UI: `npm run dev:live-chatter` (Terminal 1)  
- UI: `npm run dev:survey-hub` (Terminal 2)  
- Agent: `npm run dev:agent` (Terminal 3)  
- DB: `npm run dev:db` (Terminal 4)  
- API: `npm run dev:api` (Terminal 5)

**Build**  
- `npm run build:live-chatter && npm run build:survey-hub`

**PR checklist**  
- Contract touched? Update `packages/shared/src/survey.ts`, refresh `supabase.types.ts`, update both UIs and the agent, and write ADR if cross-cutting.

@packages/shared/src/survey.ts
@supabase/functions/survey-api/index.ts
```md
---
description: Common dev tasks & templates (the AI can choose to attach this)
globs:
  - **
alwaysApply: false
---
**Start dev**: `pnpm dev` (apps), `pnpm dev:agent` (Python).  
**Build**: `pnpm build`; filter per app with Turborepo `--filter`.
**Release**: tag per app; produce Docker image for agent.
**PR checklist**: contract touched? update shared, two apps, agent, docs/adr, env examples.

@turbo.json
@package.json
````

> Tip: keep “Always” rules extremely short to avoid bloating the model context. Put examples and recipes in Auto Attached or Agent Requested rules.

---

## 10) Suggested next steps

1. **Keep it minimal** – No Turborepo or extra runners; run each service in its own terminal while building momentum.
2. **DB contract first** – Enforce migrations in `/supabase/migrations` and regenerate `packages/shared/src/supabase.types.ts` on PRs that touch the schema.
3. **API surface** – Expand `survey-api` endpoints and add input validation/auth (JWT/Auth helpers). Document in `/docs`.
4. **Cursor rules** – Keep `global-architecture.mdc` tiny; put checklists/examples in Auto Attached rules per area.
5. **Observability** – Add structured logs for agent + function; optionally a `logs` table in Supabase.
6. **Future upgrade path** – If builds slow down or you add more packages, you can introduce Turborepo later in a single PR.

---

## Common tasks (updated)

* Live Chatter UI: `npm run dev:live-chatter`
* Survey Hub UI: `npm run dev:survey-hub`
* Python agent: `npm run dev:agent`
* Supabase DB: `npm run dev:db`
* Deno Edge Function: `npm run dev:api`
* Generate TS types from DB: `npm run db:types`
* Build UIs: `npm run build:live-chatter && npm run build:survey-hub`

---

This plan removes Turborepo entirely and sticks to **vanilla npm workspaces**, while keeping your **full-history** monorepo, shared **Supabase DB**, and **Deno `survey-api`** used by both frontends and the Python agent.

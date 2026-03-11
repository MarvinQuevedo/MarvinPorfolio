# 🤖 AI_CODING_RULES.md
# Reglas de Programación para IA — AI Coding Validation Rules

> **Purpose:** A generic, project-agnostic set of rules to prevent common AI programming mistakes.  
> **Usage:** Include this file in any project's root so that any AI assistant can read and follow these rules.  
> **Version:** 1.0 | Last updated: 2026-03-11

---

## ⚙️ How To Use This File

When starting work on this project, an AI assistant **MUST**:
1. Read this file completely before writing any code.
2. Treat every rule as a hard constraint, not a suggestion.
3. If a rule cannot be followed, **stop and ask the user** before proceeding.
4. Cross-check every code change against the relevant sections below.

---

## 🔴 CRITICAL — Never Do This

These are the most destructive, irreversible mistakes. **Zero tolerance.**

### C1 – Never Overwrite Files Without Reading Them First
- **BAD:** Creating/writing a file without first reading its current content.
- **GOOD:** Always read the existing file, understand its structure, then make targeted edits (add/modify/delete lines).
- **Reason:** Overwriting silently removes logic, comments, and state that the developer worked hard to build.

### C2 – Never Delete Code Unless Explicitly Instructed
- **BAD:** Removing functions, components, or logic because they "seem unused" or "can be simplified".
- **GOOD:** Comment out with a `// REMOVED:` marker or ask the user before deleting.
- **Reason:** AIs cannot reliably reason about all call sites or future plans.

### C3 – Never Invent or Hallucinate Dependencies
- **BAD:** `import { magicUtil } from 'some-package'` without verifying the package exists and is installed.
- **GOOD:** Check `package.json` / `requirements.txt` / `go.mod` before using any dependency. If missing, ask the user to install it.
- **Reason:** Phantom imports break builds immediately and silently.

### C4 – Never Hardcode Secrets or Credentials
- **BAD:** `const API_KEY = "sk-abc123..."` directly in source code.
- **GOOD:** Use environment variables (`process.env.API_KEY`, `os.environ['API_KEY']`) and document them in `.env.example`.
- **Reason:** Credentials in source code are a critical security vulnerability.

### C5 – Never Assume the Database / API State
- **BAD:** Writing code that assumes a table has rows, a field is non-null, or an endpoint returns a specific shape.
- **GOOD:** Always handle empty results, null values, and unexpected response shapes defensively.
- **Reason:** Production data is almost never clean or complete.

### C6 – Never Replace The Entire File When Asked For A Small Change
- **BAD:** Rewriting 500 lines when the user asks to change a button color.
- **GOOD:** Make surgical, minimal edits. Only touch the lines that need to change.
- **Reason:** Wholesale rewrites introduce regressions and erase deliberate design choices.

---

## 🟠 File & Project Structure

### S1 – Respect The Existing Folder Structure
- Before creating new files, check where similar files live and follow the same pattern.
- Don't create new top-level folders unless the user explicitly asks.

### S2 – Match The File Naming Convention
- Observe whether the project uses `camelCase`, `PascalCase`, `kebab-case`, or `snake_case` and be consistent.
- Example: if existing components are `UserCard.jsx`, don't create `user-card.jsx`.

### S3 – Imports Must Be Deterministic
- Use relative imports (`./utils`) or absolute aliases (`@/utils`) consistently with the rest of the project.
- Never mix both styles.
- Always import from the most specific path (avoid barrel files that cause circular deps).

### S4 – Don't Create Duplicate Logic
- Before creating a utility function, search the project for an existing implementation.
- Prefer extending existing code over adding parallel implementations.

### S5 – Keep Files Focused (Single Responsibility)
- One file should do one thing. If a file grows beyond ~300 lines, consider splitting it.
- Never put business logic in UI components or data fetching in utility files.

---

## 🟡 Code Quality

### Q1 – Handle All Error Cases Explicitly
```js
// BAD
const data = await fetch(url).then(r => r.json());

// GOOD
const res = await fetch(url);
if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
const data = await res.json();
```

### Q2 – Validate All Function Inputs
- Validate that parameters are not `null`, `undefined`, or the wrong type before using them.
- Return early or throw a descriptive error when inputs are invalid.
```js
function calculateTotal(items) {
  if (!Array.isArray(items)) throw new TypeError('items must be an array');
  if (items.length === 0) return 0;
  // ...
}
```

### Q3 – Never Use `any` in TypeScript Without Justification
- `any` defeats the purpose of TypeScript. Use `unknown` + type narrowing instead.
- If `any` is truly unavoidable, add a comment explaining why: `// eslint-disable-next-line @typescript-eslint/no-explicit-any -- legacy API`

### Q4 – Avoid Magic Numbers and Magic Strings
```js
// BAD
if (status === 3) { ... }
setTimeout(fn, 86400000);

// GOOD
const STATUS_ACTIVE = 3;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;
if (status === STATUS_ACTIVE) { ... }
setTimeout(fn, ONE_DAY_MS);
```

### Q5 – Write Descriptive Variable Names
- `data`, `result`, `temp`, `item`, `val`, `x` are not acceptable for non-trivial variables.
- Name variables after what they represent, not what type they are.
```js
// BAD: const d = await getUser(id);
// GOOD: const authenticatedUser = await getUserById(userId);
```

### Q6 – Functions Must Do One Thing
- If a function's name contains "and" (e.g., `fetchAndRenderUsers`), it likely should be two functions.
- Keep functions short (aim for < 30 lines). If longer, extract sub-functions.

### Q7 – Avoid Deep Nesting
- Code nested more than 3 levels deep is hard to read and test.
- Use **early returns** (guard clauses) to flatten logic.
```js
// BAD
function process(user) {
  if (user) {
    if (user.isActive) {
      if (user.role === 'admin') {
        // ... deep logic
      }
    }
  }
}

// GOOD
function process(user) {
  if (!user) return;
  if (!user.isActive) return;
  if (user.role !== 'admin') return;
  // ... flat logic
}
```

### Q8 – Every `async` Function Must Handle Rejections
- Every `await` call should be inside a try/catch, or the caller must be documented as re-throwing.
- Don't use `.catch(console.error)` as a final handler in production code — log and re-throw or handle properly.

### Q9 – Don't Mutate Function Arguments
```js
// BAD
function addItem(cart, item) { cart.items.push(item); return cart; }

// GOOD
function addItem(cart, item) { return { ...cart, items: [...cart.items, item] }; }
```

### Q10 – Side Effects Belong at the Edges
- Pure logic (calculations, transformations) should be free of side effects.
- Network calls, file I/O, and state mutations should happen at the outermost layer possible.

---

## 🟢 State Management

### M1 – Never Store Derived State
- If a value can be computed from existing state, compute it on-the-fly — don't store it separately.
- Duplicate state always leads to inconsistency bugs.

### M2 – State Updates Must Be Atomic
- When updating multiple related pieces of state, do it in a single dispatch/setState call.
- Partial updates cause transient UI inconsistencies.

### M3 – Avoid Direct State Mutation
- In React: never mutate `state` directly. Use spread/immer/immutable patterns.
- In Redux: reducers must be pure functions; never mutate `state` argument.

---

## 🔵 API & Data Fetching

### A1 – Always Define Request and Response Types
- Typed API calls catch mismatches at compile time, not in production.
- Use TypeScript interfaces or JSDoc `@typedef` to document shapes.

### A2 – Implement Loading, Error, and Empty States
- Every UI that fetches data needs all three states handled explicitly.
- Don't leave the user staring at a blank screen on slow connections.

### A3 – Paginate or Limit Large Data Sets
- Never fetch an unbounded list from an API. Always use `limit`, `offset`, or cursor pagination.
- Fetching 10,000 records to show 10 is a performance bug.

### A4 – Use HTTP Methods Correctly
| Method | Usage |
|--------|-------|
| GET | Read only. No side effects. |
| POST | Create a new resource. |
| PUT | Replace an entire resource. |
| PATCH | Partially update a resource. |
| DELETE | Remove a resource. |

### A5 – Idempotent Write Operations
- PUT and DELETE should be idempotent (calling twice = same result as calling once).
- Implement idempotency keys for POST operations that must not be duplicated (e.g., payments).

---

## 🟣 Security

### SE1 – Sanitize All User Input Before Processing
- Never directly inject user input into SQL, HTML, shell commands, or file paths.
- Use parameterized queries, ORM methods, or trusted sanitization libraries.

### SE2 – Never Trust the Client
- Validate all data **on the server**, even if also validated on the client.
- Role/permission checks must happen server-side, never only in frontend routing.

### SE3 – Use Proper CORS Configuration
- Never set `Access-Control-Allow-Origin: *` on a production API that handles authenticated requests.
- Whitelist specific origins explicitly.

### SE4 – Don't Log Sensitive Data
- Never `console.log` / `print` passwords, tokens, PII, or full request bodies in production.
- Use structured logging with redaction.

### SE5 – Set Security Headers
- Every server response should include: `X-Content-Type-Options`, `X-Frame-Options`, `Content-Security-Policy`, `Strict-Transport-Security`.

---

## ⚪ Performance

### P1 – Don't Fetch Data Inside Loops
```js
// BAD — N+1 queries
for (const user of users) {
  const orders = await db.getOrdersByUserId(user.id); // One DB call per user!
}

// GOOD — Single batch call
const allOrders = await db.getOrdersByUserIds(users.map(u => u.id));
```

### P2 – Memoize Expensive Computations
- Use `useMemo`, `useCallback`, `React.memo`, or cache layers for computationally expensive operations.
- Only do this when profiling shows it's needed — premature optimization is also a mistake.

### P3 – Lazy-Load Heavy Assets
- Images, charts, maps, or heavy components should be loaded only when needed.
- Use dynamic imports (`import()`, `React.lazy`) for large code-split boundaries.

### P4 – Debounce / Throttle High-Frequency Events
- Search inputs, scroll handlers, resize listeners — always debounce or throttle these.
```js
const debouncedSearch = debounce(handleSearch, 300);
```

---

## 📝 Comments & Documentation

### D1 – Comment the WHY, Not the WHAT
```js
// BAD: Increment counter by 1
counter++;

// GOOD: Retry limit per RFC spec §4.2 — max 3 retries
const MAX_RETRIES = 3;
```

### D2 – Document All Public APIs
- Every exported function, class, or component must have a JSDoc or equivalent docstring.
- Include: purpose, parameters (types + description), return value, possible errors.

### D3 – Keep Comments Up-To-Date
- Stale comments are worse than no comments. Always update comments when changing code.
- Delete commented-out code. Git history preserves everything.

### D4 – Mark Temporary Code Clearly
```js
// TODO(marvin): Replace with real auth once backend is ready — 2026-03-11
const mockUser = { id: '1', role: 'admin' };
```

---

## 🧪 Testing

### T1 – Every Bug Fix Must Have a Test
- When fixing a bug, write a failing test first that reproduces the bug, then fix it.
- This prevents regressions.

### T2 – Test Behavior, Not Implementation
- Tests should describe what the user/system *experiences*, not internal function calls.
- `expect(screen.getByText('Error: user not found')).toBeVisible()` over `expect(component.state.error).toBe(true)`.

### T3 – Never Commit Tests Marked `.only` or `.skip`
- `describe.only`, `it.only`, `test.skip` are local development tools only.
- Always clean them up before committing.

### T4 – Mock External Services in Tests
- Tests must not make real HTTP calls, hit real databases, or read from the filesystem.
- Use mocks, fixtures, or in-memory implementations.

---

## 🔄 Git & Versioning

### G1 – Atomic Commits
- Each commit should represent exactly one logical change.
- Don't mix bug fixes, refactors, and new features in a single commit.

### G2 – Meaningful Commit Messages
```
// BAD
fix stuff, update, changes, final, FINAL2

// GOOD (conventional commits)
feat(auth): add JWT refresh token rotation
fix(cart): prevent duplicate item insertion on double-click
refactor(api): extract response parsing into shared utility
```

### G3 – Never Force-Push to Main/Master
- Force-pushing rewrites history and destroys teammates' work.
- Only force-push to personal feature branches that no one else is working on.

### G4 – Don't Commit Generated Files
- `node_modules/`, `dist/`, `build/`, `.DS_Store`, `*.pyc` must be in `.gitignore`.
- Generated files bloat repos and cause merge conflicts.

---

## 🤖 AI-Specific Pitfalls to Avoid

### AI1 – Don't Assume Context That Wasn't Given
- If the AI doesn't know the shape of a type, the content of a file, or a business rule — **ask, don't guess**.

### AI2 – Don't Invent File Paths
- If uncertain about where a file lives, use a search tool or ask. Don't guess paths that may not exist.

### AI3 – Don't Over-Engineer
- Solve the problem as stated. Don't add abstractions, layers, or "future-proof" complexity that wasn't requested.
- YAGNI: You Ain't Gonna Need It.

### AI4 – Preserve Code Style
- Match the indentation, quote style, semicolon usage, trailing commas, and naming conventions of existing code.
- Don't impose your preferred style on an existing codebase.

### AI5 – Confirm Destructive Actions
- Before deleting files, dropping tables, resetting databases, or removing data — always ask for explicit confirmation.

### AI6 – Complete The Task Fully
- Don't leave stub implementations with `// TODO: implement this later` without flagging it prominently.
- If something can't be implemented, say so explicitly and explain why.

### AI7 – Don't Silently Change Behavior
- Any change that alters observable behavior (API, UI, data flow) must be called out explicitly.
- "I also changed X because it seemed better" is not acceptable without disclosure.

---

## ✅ Pre-Commit Checklist

Before submitting any code change, verify:

- [ ] Read every file I was asked to modify before editing it
- [ ] No hardcoded secrets, tokens, or API keys
- [ ] All new dependencies exist in the project's dependency manifest
- [ ] Error handling covers all failure paths
- [ ] No magic numbers or magic strings
- [ ] No commented-out dead code
- [ ] Variable and function names are descriptive
- [ ] Existing tests pass; new tests added for new behavior or fixes
- [ ] No `.only` or `.skip` in test files
- [ ] No `console.log` / debug statements left in production code
- [ ] Imports are clean (no unused imports)
- [ ] File structure follows existing project conventions
- [ ] No unnecessary abstractions or over-engineering
- [ ] User was notified of any behavior-changing side effects

---

*This file is intentionally language-agnostic and framework-agnostic. Rules use JavaScript examples for illustration but apply to all languages and stacks.*

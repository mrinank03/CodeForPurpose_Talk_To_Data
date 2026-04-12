# DataLens — Complete Build Prompt for AI Coding Agent

## CRITICAL INSTRUCTIONS BEFORE YOU START

You are a senior software engineer building a production-grade application for a NatWest Group hackathon. 
Every file you write must follow these non-negotiable standards:

**Code style:**
- Write simple, readable, modular code. No complex one-liners. No clever tricks.
- Each function does exactly one thing and has a clear name that says what it does.
- Every module has a short docstring at the top (2–3 lines, plain English).
- Leave humanized inline comments at key decision points — write them as if you are explaining to a smart teammate, not as if you are writing documentation.
- No emojis anywhere in the codebase.
- Imports are grouped: stdlib first, then third-party, then local. One blank line between groups.
- Max 80–100 characters per line where possible.
- Files should not exceed 200 lines. Split into smaller modules if they grow beyond that.

**Security:**
- Zero hardcoded secrets. All keys live in `.env`, referenced via `python-dotenv`.
- All user-uploaded files are validated for extension and size before processing.
- SQL is never constructed by simple string concatenation with user input — always use parameterized queries or the LangChain SQL chain which handles this.
- CORS is locked to the frontend origin only, not `"*"` wildcard.
- File uploads are stored in a temporary session directory that is cleaned up after the session ends.
- Session IDs are UUIDs, generated server-side, not predictable.

**Architecture pattern:**
- Backend: FastAPI app with separate routers, services, and agent modules.
- Frontend: React with clear component separation. No God components. Each component is under 150 lines.
- Communication: REST JSON API. Frontend fetches from `/api/...` endpoints.

---

## PROJECT OVERVIEW

**Name:** DataLens  
**Tagline:** Talk to your data. Understand it instantly.  
**What it does:** A user uploads a CSV or Excel file. The system automatically profiles the data and surfaces five intelligent insight cards ("Story Mode"). The user can also ask plain-English questions about the dataset in a chat interface. Every answer comes with a chart, a plain-English explanation, and a collapsible "How did you get this?" audit panel showing the exact SQL that was run.

**Who it is for:** Non-technical business users who need to understand their data without writing SQL or using complex BI tools.

**Hackathon context:** NatWest Group — Code for Purpose India Hackathon. Theme: "Talk to Data — Seamless Self-Service Intelligence." Three pillars the judges evaluate on: Clarity (answers a non-expert can understand), Trust (transparent sources and reasoning), Speed (near-instant responses).

---

## FULL FEATURE LIST (MVP — build all of these)

### Feature 1: File Upload and Auto-Profiling
- User uploads a CSV or Excel (.xlsx) file via a drag-and-drop upload zone.
- Backend validates the file (extension, max size 20MB).
- pandas reads the file into a DataFrame.
- An `ingestor` module writes it to an SQLite database using the session ID as the table namespace.
- A `profiler` module runs automatically and computes: column names, inferred types (dimension vs measure vs time), null percentage per column, cardinality for categorical columns, basic stats (min, max, mean, std) for numeric columns.
- A `semantic_embedder` module uses `sentence-transformers` with `all-MiniLM-L6-v2` to embed column name + sample values for each column. These embeddings are stored in ChromaDB with the session ID as the collection name. This powers alias resolution — when a user asks "show me revenue", the system finds `monthly_revenue_usd` via semantic search.
- An LLM call uses the profile to write a plain-English metric dictionary: one sentence per column explaining what it likely means in business terms.
- The frontend shows a dataset summary card: number of rows, columns, a list of column names with inferred types, and a preview of the first five rows.

### Feature 2: Auto-Generated Suggested Questions
- After profiling, the system generates five suggested questions tailored to the actual columns in the uploaded dataset.
- These appear as clickable pill buttons below the upload area and above the chat input.
- Clicking one sends it directly to the chat pipeline.
- Example for a sales dataset: "Which region had the highest revenue last quarter?", "What products have declining sales?", "Is there a seasonal pattern in monthly orders?"

### Feature 3: Chat Interface
- A clean conversational chat UI on the right side of the screen.
- The user types a question. It is sent to the `/api/query` endpoint with the session ID.
- The backend runs the multi-agent query pipeline (described below) and returns a structured JSON response.
- Each response renders as a chat bubble with: the plain-English answer, an optional chart, and a collapsible "How did you get this?" section.
- The chat maintains conversation history within a session. Follow-up questions like "now filter by region" work because the last SQL and result are kept in the session context.

### Feature 4: Multi-Agent Query Pipeline (Backend Brain)
The pipeline runs sequentially with typed steps. Each step is a separate module.

**Step 1 — Intent Classifier (`intent_classifier.py`):**
Takes the user question and classifies it into one of: `aggregation`, `comparison`, `breakdown`, `trend`, `anomaly`, `follow_up`, `general`. This classification guides which planner prompt is used.

**Step 2 — Schema Resolver (`schema_resolver.py`):**
Takes the question and does a ChromaDB similarity search to find the most relevant columns. Returns the top-5 relevant columns with their descriptions from the metric dictionary. This is what makes "show me sales" map to the correct column even if it is named `net_revenue_usd`.

**Step 3 — SQL Planner (`sql_planner.py`):**
Takes the question, intent, resolved columns, full table schema, and conversation history. Sends all of this to Gemini with a structured prompt that asks for chain-of-thought reasoning before the SQL. The prompt explicitly instructs the model to output JSON with three keys: `reasoning` (the thinking), `sql` (the final query), `chart_type` (suggested visualization: bar, line, pie, table, or none).

**Step 4 — Executor with Self-Correction (`executor.py`):**
Runs the SQL against the SQLite database. If it raises an error, it catches the exception, classifies the error type (syntax error, wrong column name, wrong aggregation), sends the original question + failed SQL + error message back to Gemini with a "fix this specific error" prompt, and retries up to two times. If all retries fail, it returns a graceful error message.

**Step 5 — Validator (`validator.py`):**
Checks that the result set is not empty, not excessively large (cap at 500 rows for the response), and that the result shape makes sense for the question type (e.g., an aggregation should return a small result, not 10,000 rows). Assigns a confidence score: High (direct column match), Medium (alias resolution used), Low (ambiguous mapping).

**Step 6 — Narrator (`narrator.py`):**
Takes the SQL result and the original question and asks Gemini to write a one-to-three sentence plain-English explanation of the result. The prompt instructs: no jargon, no technical terms, write as if explaining to a colleague who does not work in data. Also picks a final chart type based on result shape.

**Response payload structure:**
```json
{
  "answer": "Revenue in the North region was $2.3M in Q1, which is 43% of total revenue.",
  "sql": "SELECT region, SUM(revenue) FROM sales WHERE quarter='Q1' GROUP BY region",
  "chart_type": "bar",
  "chart_data": [{"region": "North", "revenue": 2300000}, ...],
  "confidence": "High",
  "columns_used": ["region", "revenue", "quarter"],
  "intent": "breakdown",
  "error": null
}
```

### Feature 5: Story Mode — "Analyse My Data" Button
- A prominent button above the chat labeled "Analyse My Data".
- Clicking it triggers the `/api/story` endpoint.
- The backend runs five analytical queries in parallel (using Python `asyncio.gather`):
  1. Biggest period-over-period change: finds the time column, computes month/week-over-month delta for the main numeric column, surfaces the period with the biggest absolute change.
  2. Largest category contribution: finds the main categorical column and main numeric column, computes which category contributes the most to the total.
  3. Most unequal distribution: finds the categorical column where one value dominates (highest Gini coefficient or simply highest single-value share).
  4. Strongest correlation: computes Pearson correlation between all numeric column pairs, surfaces the strongest one.
  5. Biggest outlier: Z-score on the main numeric column, surfaces the row with z-score > 3.
- Each of these is then sent to Gemini to write a one-sentence headline and a two-sentence explanation.
- The frontend renders these as five story cards in a horizontal scrollable row above the chat.
- Each card has: a bold headline, a mini chart (bar or line), a two-line explanation, and a "Drill in" button that populates the chat input with a follow-up question.

### Feature 6: How Did You Get This — Audit Trail
- Every chat response has a collapsed section labeled "How did you get this?"
- When expanded, it shows: the exact SQL that was executed (syntax-highlighted using a code block), the columns used, the confidence badge (High / Medium / Low with a color indicator), and a one-line note like "Answer derived from the `revenue` and `region` columns using a GROUP BY aggregation."
- This is the trust pillar made visible. It must be implemented for every response, not just some.

### Feature 7: Chat History Sidebar
- Left sidebar similar to Claude.ai's conversation list.
- Each upload session appears as a chat entry with the filename and upload timestamp.
- Clicking a past session restores the dataset and the full conversation history for that session.
- Sessions are stored in SQLite (a separate `sessions` table from the data tables).
- The sidebar is collapsible on smaller screens.

### Feature 8: Charts and Visualizations
- `ChartRenderer` component takes `chart_type` and `chart_data` from the API response.
- Supported types: `bar` (Recharts BarChart), `line` (LineChart), `pie` (PieChart), `table` (HTML table with Tailwind styling).
- `chart_advisor.py` backend module chooses the type based on: result shape (2 columns → bar; time column present → line; proportional breakdown → pie; many columns → table).
- Charts use the NatWest color palette (purple and teal accent).
- Mini charts in Story Cards are smaller versions (height 120px) of the same components.

---

## SECURITY REQUIREMENTS

Implement all of the following. Do not skip any.

- **File validation:** On upload, check extension is `.csv` or `.xlsx` only. Check file size is under 20MB. Use Python's `magic` or simply check MIME type + extension. Reject everything else with a 400 response.
- **Session isolation:** Every upload creates a UUID session. Data from session A is never accessible to session B. SQLite table names include the session ID prefix (e.g., `sess_<uuid>_data`). ChromaDB collections are named with the session ID.
- **SQL injection prevention:** The SQL generated by the LLM is executed via SQLAlchemy's `text()` with the SQLite engine, not via raw string execution. Do not allow user input to directly enter any SQL string.
- **CORS:** FastAPI CORS middleware allows only the frontend origin. In `.env.example` set `ALLOWED_ORIGIN=http://localhost:5173` for dev. Do not set `allow_origins=["*"]`.
- **Rate limiting:** Add a simple in-memory rate limiter (using `slowapi`) on the `/api/query` endpoint — max 30 requests per minute per session. This prevents abuse and shows judges you thought about production concerns.
- **No real data leakage:** The `.gitignore` must include `*.db`, `*.sqlite`, `uploads/`, `__pycache__/`, `.env`, `chroma_store/`. Include this in the README as a security note.
- **Input sanitization:** Question text from the frontend is stripped of leading/trailing whitespace and capped at 500 characters before being sent to the LLM.

---

## TECH STACK — EXACT VERSIONS

**Backend:**
```
python = "3.11"
fastapi = "0.111.0"
uvicorn = "0.29.0"
langchain = "0.2.6"
langchain-google-genai = "1.0.6"
langgraph = "0.1.5"
chromadb = "0.5.3"
sentence-transformers = "2.7.0"
sqlalchemy = "2.0.30"
pandas = "2.2.2"
openpyxl = "3.1.2"
python-dotenv = "1.0.1"
python-multipart = "0.0.9"
slowapi = "0.1.9"
pydantic = "2.7.1"
pytest = "8.2.0"
httpx = "0.27.0"
```

**Frontend:**
```
react = "18.3.1"
react-dom = "18.3.1"
typescript = "5.4.5"
vite = "5.2.11"
tailwindcss = "3.4.4"
recharts = "2.12.7"
axios = "1.7.2"
react-router-dom = "6.23.1"
uuid = "10.0.0"
```

---

## DIRECTORY STRUCTURE — BUILD EXACTLY THIS

```
datalens/
├── backend/
│   ├── src/
│   │   ├── agents/
│   │   │   ├── __init__.py
│   │   │   ├── intent_classifier.py
│   │   │   ├── schema_resolver.py
│   │   │   ├── sql_planner.py
│   │   │   ├── executor.py
│   │   │   ├── validator.py
│   │   │   └── narrator.py
│   │   ├── story/
│   │   │   ├── __init__.py
│   │   │   └── analyst_mode.py
│   │   ├── semantic/
│   │   │   ├── __init__.py
│   │   │   ├── profiler.py
│   │   │   └── embedder.py
│   │   ├── data/
│   │   │   ├── __init__.py
│   │   │   ├── ingestor.py
│   │   │   └── session_store.py
│   │   ├── api/
│   │   │   ├── __init__.py
│   │   │   ├── routes/
│   │   │   │   ├── __init__.py
│   │   │   │   ├── upload.py
│   │   │   │   ├── query.py
│   │   │   │   ├── story.py
│   │   │   │   └── sessions.py
│   │   │   └── models.py
│   │   ├── utils/
│   │   │   ├── __init__.py
│   │   │   ├── chart_advisor.py
│   │   │   ├── confidence.py
│   │   │   └── llm_factory.py
│   │   └── main.py
│   ├── tests/
│   │   ├── __init__.py
│   │   ├── test_sql_planner.py
│   │   ├── test_executor.py
│   │   └── test_profiler.py
│   ├── data/
│   │   └── generate_synthetic.py
│   ├── requirements.txt
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── Layout/
│   │   │   │   ├── Sidebar.tsx
│   │   │   │   └── TopBar.tsx
│   │   │   ├── Upload/
│   │   │   │   ├── FileUploader.tsx
│   │   │   │   └── DatasetSummary.tsx
│   │   │   ├── Chat/
│   │   │   │   ├── ChatWindow.tsx
│   │   │   │   ├── ChatMessage.tsx
│   │   │   │   ├── ChatInput.tsx
│   │   │   │   └── SuggestedQuestions.tsx
│   │   │   ├── Audit/
│   │   │   │   └── AuditTrail.tsx
│   │   │   ├── Story/
│   │   │   │   ├── StoryCards.tsx
│   │   │   │   └── StoryCard.tsx
│   │   │   └── Charts/
│   │   │       ├── ChartRenderer.tsx
│   │   │       └── MiniChart.tsx
│   │   ├── hooks/
│   │   │   ├── useChat.ts
│   │   │   ├── useSession.ts
│   │   │   └── useStory.ts
│   │   ├── services/
│   │   │   └── api.ts
│   │   ├── types/
│   │   │   └── index.ts
│   │   ├── App.tsx
│   │   ├── main.tsx
│   │   └── index.css
│   ├── public/
│   │   └── natwest-logo.svg
│   ├── index.html
│   ├── package.json
│   ├── vite.config.ts
│   ├── tailwind.config.js
│   └── tsconfig.json
├── docs/
│   └── architecture.md
├── scripts/
│   └── setup.sh
├── .gitignore
└── README.md
```

---

## BACKEND — DETAILED IMPLEMENTATION INSTRUCTIONS

### `main.py`
- Create the FastAPI app instance.
- Add CORS middleware reading `ALLOWED_ORIGIN` from environment.
- Add `slowapi` rate limiter as a middleware.
- Include all routers from `api/routes/` with the prefix `/api`.
- Add a startup event that creates the SQLite sessions table if it does not exist.
- Add a `/health` endpoint that returns `{"status": "ok"}`.

### `utils/llm_factory.py`
- Read `GEMINI_API_KEY` and `GEMINI_MODEL` from environment.
- Return a configured `ChatGoogleGenerativeAI` instance.
- Temperature: 0.1 for SQL generation (low creativity, high precision), 0.3 for narration (slightly more natural language).
- Expose two functions: `get_sql_llm()` and `get_narrator_llm()`.
- This is the only place in the entire codebase that knows the LLM provider. Every agent imports from here.

### `data/ingestor.py`
- `ingest_file(file_bytes, filename, session_id)` — reads the file into a pandas DataFrame, infers column types, writes to SQLite as a table named `data_{session_id}`.
- Returns a `DatasetMeta` object: row count, column count, column names, column types, first 5 rows as a list of dicts.
- Handles both CSV and XLSX by checking file extension.
- Strips column names of spaces and special characters (replace spaces with underscores, lowercase everything). Store the original→cleaned mapping so the narrator can refer back to original names.

### `data/session_store.py`
- All session metadata is stored in a single SQLite database `sessions.db` separate from the data databases.
- Tables: `sessions` (id, filename, upload_timestamp, row_count, col_count, status), `messages` (id, session_id, role, content, sql, chart_type, chart_data, confidence, timestamp).
- Expose: `create_session()`, `get_session(session_id)`, `list_sessions()`, `save_message()`, `get_messages(session_id)`.

### `semantic/profiler.py`
- `profile_dataset(df, session_id)` — runs on the DataFrame after ingestion.
- Computes: for each column, null %, unique count, inferred semantic type (dimension/measure/time), sample values (top 5 for categorical, min/median/max for numeric).
- Sends the full column profile to Gemini with a prompt asking it to write a metric dictionary — a one-sentence business description per column. Prompt example: "You are a data analyst. Given these column names and sample values from a business dataset, write a one-sentence plain-English description for each column explaining what it likely represents in a business context. Output as JSON."
- Stores the metric dictionary in ChromaDB (collection named `schema_{session_id}`) with one document per column.
- Returns the full profile as a dict.

### `semantic/embedder.py`
- Loads `all-MiniLM-L6-v2` once at module level (lazy singleton, do not reload per request).
- `embed_columns(columns_with_descriptions, session_id)` — creates ChromaDB documents: for each column, the document text is `"{column_name}: {description}"` with metadata `{column_name, session_id}`.
- `search_relevant_columns(question, session_id, top_k=5)` — queries ChromaDB and returns the top-k column names and their descriptions.

### `agents/intent_classifier.py`
- One LLM call. Prompt provides the user question and the list of intent categories with one-line descriptions.
- Returns one of: `aggregation`, `comparison`, `breakdown`, `trend`, `anomaly`, `follow_up`, `general`.
- Parse the response as plain text. If the model returns something unexpected, default to `general`.

### `agents/schema_resolver.py`
- Takes question and session_id.
- Calls `embedder.search_relevant_columns()`.
- Also fetches the full table schema from SQLite (using SQLAlchemy `inspect`).
- Returns a `ResolvedSchema` object: table name, relevant columns with descriptions, full schema string (for the SQL planner prompt).

### `agents/sql_planner.py`
- Takes: question, intent, resolved schema, conversation history (last 3 turns), and table name.
- Builds a structured prompt with these sections: system role, table schema, relevant columns and their meanings, conversation history, user question, explicit instructions.
- Explicit instructions in the prompt: "Think step by step before writing SQL. Output a JSON object with three keys: reasoning (your thought process, 2–3 sentences), sql (the executable SQLite query), chart_type (one of: bar, line, pie, table, none). Never use columns not listed in the schema. Use only SQLite-compatible syntax."
- Parse the LLM response as JSON. Extract the three keys.
- Return a `QueryPlan` object with reasoning, sql, chart_type.

### `agents/executor.py`
- Runs the SQL via SQLAlchemy `text()` against the session's SQLite database.
- On success: returns rows as list of dicts and column names.
- On failure: classifies the error (syntax error if it contains "syntax", wrong column if it contains "no such column", etc.), then calls the planner again with an error correction prompt. Retries maximum 2 times.
- If all retries fail: returns `ExecutionResult(success=False, error_message="...", data=None)`.

### `agents/validator.py`
- Checks result is not empty. If empty, return a helpful message: "The query ran successfully but returned no results. Try broadening the filter."
- Caps result at 500 rows.
- Computes confidence: if schema resolver found a direct column name match → High. If it used an alias/embedding match → Medium. If intent was `general` → Low.
- Returns `ValidationResult(confidence, row_count, truncated, data)`.

### `agents/narrator.py`
- Prompt: "You are a business analyst writing for non-technical users. Given this SQL query result, write a 1–3 sentence plain-English summary of what the data shows. No jargon. Do not mention SQL or technical terms. Be specific with numbers."
- Also re-confirms the chart type based on result shape:
  - 2 columns where col2 is numeric → bar
  - 1 time column + 1 numeric column → line
  - 1 categorical column with <= 6 values + proportions → pie
  - Everything else → table
- Returns the answer string and confirmed chart_type.

### `story/analyst_mode.py`
- `run_story_mode(session_id)` — runs five analyses.
- Use `asyncio.gather` to run them concurrently (or thread pool if needed with SQLite's sync driver).
- For each analysis result, call Gemini to generate: a short headline (under 10 words), a 2-sentence explanation.
- Return a list of 5 `StoryCard` objects: `{headline, explanation, sql, chart_type, chart_data, drill_in_question}`.
- The `drill_in_question` is a suggested follow-up question the user can click to chat about this card.
- If any of the five analyses fails (e.g., no time column exists for period-over-period), skip that card and return fewer cards gracefully.

### `api/routes/upload.py`
- `POST /api/upload` — accepts a `multipart/form-data` file.
- Validates extension and size.
- Calls ingestor, profiler, embedder, and `generate_suggested_questions()`.
- Generates suggested questions: one LLM call that takes the column profile and metric dictionary and returns 5 specific questions as a JSON array.
- Returns: `{session_id, dataset_meta, metric_dictionary, suggested_questions, profile}`.

### `api/routes/query.py`
- `POST /api/query` — accepts `{session_id, question}`.
- Rate limited to 30 req/min per session.
- Runs the full 6-step pipeline.
- Saves message to session store (both user question and assistant response).
- Returns the full response payload.

### `api/routes/story.py`
- `POST /api/story` — accepts `{session_id}`.
- Calls `analyst_mode.run_story_mode()`.
- Returns list of story cards.

### `api/routes/sessions.py`
- `GET /api/sessions` — returns all sessions ordered by timestamp desc.
- `GET /api/sessions/{session_id}` — returns session metadata + all messages.
- `DELETE /api/sessions/{session_id}` — deletes the session, its data table, and its ChromaDB collection. Cleanup.

---

## FRONTEND — DETAILED IMPLEMENTATION INSTRUCTIONS

### Color palette and design system
The app uses NatWest's brand colors. Define these as Tailwind custom colors and CSS variables:

```
Purple (primary): #42145F
Purple dark: #2D0E42
Purple medium: #5C2D8A
Purple light: #7B4FAF
Teal (accent): #00857A
Teal light: #00A89A
Background: #0F0A1A  (dark, deep purple-black)
Surface: #1A1025    (slightly lighter card background)
Border: #2D1F45     (subtle purple-tinted border)
Text primary: #F0EBF7
Text secondary: #A08CC0
Success green: #22C55E
Warning amber: #F59E0B
Danger red: #EF4444
```

Every color must come from CSS variables. No hardcoded hex values in components.

### Typography
- Display font: `Space Grotesk` (Google Fonts) — for headings and the app name.
- Body font: `Inter` — for all body text, labels, chat messages.
- Mono font: `JetBrains Mono` — for SQL code in the audit trail.
- Load all three from Google Fonts in `index.html`.

### App layout
Three-column layout (on desktop, collapses on mobile):
1. Left sidebar (260px wide, collapsible): session history list, NatWest logo at top.
2. Main content area (flex-1): upload zone at top, then story cards row, then chat window.
3. The audit trail panel is a slide-in drawer from the right (not a third column) — triggered by clicking "How did you get this?" on any message.

### `Sidebar.tsx`
- Shows NatWest logo and "DataLens" wordmark at top.
- A "New Session" button.
- List of past sessions: each entry shows filename, timestamp, first 30 chars of first question asked.
- Active session is highlighted with the purple accent border.
- Clicking a session calls `GET /api/sessions/{id}` and restores that session's data and chat history.

### `FileUploader.tsx`
- Drag-and-drop zone with a dashed purple border.
- Shows file type icons and "Drop CSV or Excel file here" text.
- Shows a progress indicator during upload (use Axios upload progress callback).
- On success, transitions smoothly to the `DatasetSummary` view.

### `DatasetSummary.tsx`
- Shows: filename, row count, column count, a tag for each column (color-coded by type: dimension=purple, measure=teal, time=amber).
- Shows a preview table of the first 5 rows.
- Shows the metric dictionary: a small expandable list of column name → business description.

### `SuggestedQuestions.tsx`
- Five pill buttons with the suggested questions.
- Styled with purple border, hover fills with purple.
- On click, calls the chat handler with that question text.

### `StoryCards.tsx` and `StoryCard.tsx`
- A horizontally scrollable row of cards.
- Each card is 280px wide, full height of the row.
- Card has: a thin colored top border (alternating teal and purple), bold headline text, a mini Recharts chart (120px tall), a two-line explanation, and a "Drill in" button at the bottom.
- Cards animate in with a staggered fade+slide-up on mount (CSS animation, stagger via animation-delay).
- "Drill in" button populates the chat input and submits automatically.

### `ChatWindow.tsx`
- Standard chat layout: messages scroll area, input at bottom.
- User messages: right-aligned, purple background.
- Assistant messages: left-aligned, surface background, with the avatar being a small "DL" logo.
- Typing indicator (three animated dots) while waiting for response.
- Auto-scrolls to the newest message.

### `ChatMessage.tsx`
- Renders one assistant message.
- Shows: answer text, then `ChartRenderer` if chart_data is present, then the collapsed `AuditTrail`.
- The "How did you get this?" toggle is a small text link below the answer, not a prominent button. Keep it subtle.

### `AuditTrail.tsx`
- Slides down smoothly when expanded.
- Shows: confidence badge (green for High, amber for Medium, red for Low), the SQL in a `<pre>` block styled with JetBrains Mono, columns used as small tags, a one-line source note.
- Has a "Copy SQL" button that copies to clipboard.

### `ChartRenderer.tsx`
- Renders Recharts components based on `chart_type`.
- All charts use the NatWest palette: primary color `#42145F`, accent `#00857A`, with appropriate Recharts fills.
- Charts have tooltips enabled and responsive container (100% width).
- For `table` type, renders an HTML table with Tailwind striped rows.

### `useChat.ts` hook
- Manages the messages array state.
- `sendMessage(question)` — calls `POST /api/query`, appends the user message optimistically, then appends the assistant response.
- Handles loading state and error state cleanly.
- Keeps conversation history for display.

### `useSession.ts` hook
- Manages the active session ID (stored in `localStorage`).
- `uploadFile(file)` — calls `POST /api/upload`, sets the session ID, stores dataset metadata.
- `loadSession(id)` — loads a past session from the API.

### `useStory.ts` hook
- `runStory()` — calls `POST /api/story`, returns story cards.
- Manages loading state for the story cards section.

### `services/api.ts`
- Single Axios instance configured with `baseURL` from `VITE_API_URL` env var.
- All API calls go through this. No raw fetch calls anywhere in components.
- Interceptors: add session ID to all requests as a header (`X-Session-ID`).

---

## GENERATE SYNTHETIC DATA

`backend/data/generate_synthetic.py` — run this once to create demo data.

Generate a CSV called `sample_retail_banking.csv` with 15,000 rows and these columns:
- `transaction_date` (random dates in 2023–2024)
- `region` (categorical: North, South, East, West, Central)
- `product_category` (categorical: Loans, Savings, Credit Cards, Mortgages, Insurance)
- `channel` (categorical: Mobile App, Branch, Online, ATM)
- `customer_segment` (categorical: Retail, Business, Premium, Student)
- `transaction_amount` (numeric, 50–50000, with occasional outliers up to 500000)
- `monthly_active_users` (numeric, per-region-month aggregate)
- `churn_flag` (boolean 0/1, about 8% true)
- `support_tickets` (numeric 0–20)
- `marketing_spend` (numeric 1000–50000)

Use `Faker` for dates, `random.choice` for categoricals, `numpy` for numeric distributions. The data should have realistic patterns: North region consistently higher revenue, December spike, Mobile App growing quarter over quarter, Premium segment lowest churn.

---

## TESTS

Write three test files. Keep them simple and readable.

`tests/test_sql_planner.py`:
- Test that given a well-formed question and schema, the planner returns a dict with `reasoning`, `sql`, `chart_type` keys.
- Test that the SQL does not contain any string that looks like an injection attempt if a malicious question is passed.

`tests/test_executor.py`:
- Create a real in-memory SQLite table with sample data.
- Test that a correct SELECT query returns expected results.
- Test that a query with a syntax error triggers the retry logic and does not crash the application.

`tests/test_profiler.py`:
- Create a sample DataFrame with known properties.
- Test that `profile_dataset` correctly identifies a numeric column as a measure, a string column with few unique values as a dimension, and a date column as time.

---

## README.md — WRITE EXACTLY THIS STRUCTURE

```markdown
# DataLens

Talk to your data. Understand it instantly.

DataLens is a self-service data intelligence tool that lets non-technical users upload any dataset and ask questions about it in plain English. Every answer comes with a chart, a plain-English explanation, and a transparent audit trail showing exactly how the result was produced.

## Who is it for
Business analysts, team leads, and anyone who needs to understand data without writing SQL or using complex BI tools.

## Features
- Upload CSV or Excel files and get an instant data profile.
- Ask natural language questions and receive answers with charts.
- "Analyse My Data" mode generates five intelligent insight cards automatically.
- Every answer includes a "How did you get this?" audit trail with the exact query used.
- Conversation memory — follow-up questions reference the previous context.
- Session history lets you return to past datasets and conversations.

## Tech Stack
- Backend: Python 3.11, FastAPI, LangChain, LangGraph, SQLite, ChromaDB, sentence-transformers, pandas
- Frontend: React 18, TypeScript, Tailwind CSS, Recharts
- AI: AI language model via API (configured via environment variable)

## Install and Run

### Backend
```bash
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
# Edit .env and add your API key
uvicorn src.main:app --reload --port 8000
```

### Frontend
```bash
cd frontend
npm install
cp .env.example .env
# .env: VITE_API_URL=http://localhost:8000
npm run dev
```

### Generate sample data
```bash
cd backend
python data/generate_synthetic.py
# Outputs: data/sample_retail_banking.csv
```

## Architecture
See `docs/architecture.md` for a full system diagram.

## Limitations
- Multi-table joins are not supported in this version.
- Complex window functions may require one retry to resolve correctly.
- File size is capped at 20MB.
- Session data is stored locally and not shared across devices.

## Data and Privacy
This tool uses synthetically generated data for all demos. No real customer data is included or required. Uploaded files are processed in isolated sessions and never shared between users.

## Security
- API keys are stored in environment variables and never committed to source control.
- Each session is isolated by a UUID — no cross-session data access is possible.
- Rate limiting is applied to all query endpoints.
```

---

## `.env.example` — BACKEND

```
# AI language model settings (required)
GEMINI_API_KEY=your_api_key_here
GEMINI_MODEL=gemini-1.5-flash

# Database paths
SESSIONS_DB_PATH=./sessions.db
DATA_DB_DIR=./data_dbs/

# ChromaDB storage path
CHROMA_PATH=./chroma_store/

# Server settings
ALLOWED_ORIGIN=http://localhost:5173
PORT=8000

# Rate limiting
RATE_LIMIT_PER_MINUTE=30

# LLM settings
SQL_LLM_TEMPERATURE=0.1
NARRATOR_LLM_TEMPERATURE=0.3
MAX_RETRY_ATTEMPTS=2
MAX_RESULT_ROWS=500
MAX_UPLOAD_SIZE_MB=20
```

---

## `.gitignore` — INCLUDE EXACTLY THESE

```
# Python
__pycache__/
*.pyc
.venv/
venv/
*.egg-info/

# Environment
.env

# Database and storage (never commit user data)
*.db
*.sqlite
data_dbs/
chroma_store/
uploads/

# Frontend build
frontend/dist/
frontend/node_modules/

# Misc
.DS_Store
*.log
```

---

## FINAL NOTES FOR THE CODING AGENT

1. Build the backend first and confirm each route works with a curl or the `/docs` UI before starting the frontend.
2. Every `__init__.py` can be empty — they just make Python treat the folder as a module.
3. The ChromaDB collection for a session should be deleted when that session is deleted from the sidebar — implement this in `session_store.py`'s cleanup function.
4. Do not use `langchain.sql_database.SQLDatabase` for execution — it abstracts too much for this use case. Use SQLAlchemy directly in `executor.py` for full control.
5. The LangGraph graph does not need to be complex. A simple `StateGraph` with five nodes (one per agent step) connected linearly with a retry edge from executor back to planner is sufficient.
6. For the story mode parallel execution: since SQLite is synchronous, use `concurrent.futures.ThreadPoolExecutor` with `asyncio.run_in_executor` to run the five queries concurrently.
7. The frontend should handle loading states gracefully — show skeleton placeholders for story cards while they load, not a blank screen.
8. The `AuditTrail` component should default to closed state on every new message. Do not auto-expand it.
9. Make sure the Recharts `ResponsiveContainer` wraps every chart — charts should be 100% width and adapt to their container.
10. The session ID should never appear in the URL. It lives in `localStorage` and in the `X-Session-ID` request header.

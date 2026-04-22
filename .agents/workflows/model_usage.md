# AI Model Usage Guidelines

## Approved Models

When using the Google GenAI SDK (e.g. `generateContent` or structured prediction) in this project, **strictly** use the following models to avoid exhausting the user's free-tier rate limits (20 Requests Per Day).

- **Best for Parsing & Text Generative Features:**
  `gemini-3.1-flash-lite-preview` 
  *(Quota: ~500 Requests Per Day. Extremely efficient and capable of massive parsing and schema-structured data extraction without throwing 429 quota exhaustion errors.)*

## Deprecated / Banned Models

Do **NOT** use these models unless explicitly requested, as they easily exhaust the global quota limit of 20 RPD on free tiers:
- `gemini-3-flash-preview`
- `gemini-3.1-flash`
- `gemini-2.5-flash`

## Rules for Code Edits

When adding new `.generateContent` calls:
1. Always attach `responseMimeType: 'application/json'` when extracting structured data to prevent infinite hallucination loops (getting stuck outputting backticks infinitely).
2. Explicitly map the string to `gemini-3.1-flash-lite-preview`.

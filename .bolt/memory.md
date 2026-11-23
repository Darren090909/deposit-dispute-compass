# Project memory

## Product intent & audience

- Vite + React app with AI features: analysis, two chat interfaces, and photo reading.
- Audience appears to be a cost-conscious student/demo user.

## Brand personality & voice

- Practical, budget-aware, plain-spoken; presents trade-offs and clear options.

## Visual design & UX direction

- No specific visual decisions inferred yet.

## Decisions, constraints & rationale

- Stack: Vite + React.
- AI provider not yet chosen; candidates are OpenAI (pay-as-you-go) and Google Gemini (free tier).
- Cost is a key constraint; free/low-cost options matter for demo usage.
- Gemini free tier supports structured JSON output and image input, so it can cover all planned AI features.
- API keys should stay server-side.
- Model/provider should be configurable so switching is a settings change, not a rewrite.

## Open questions & assumptions

- Which AI provider will be used: OpenAI or Gemini?
- Assumed Gemini free-tier rate limits are sufficient for testing/demo.
- Assumed a Gemini key would be obtained via aistudio.google.com and added as a project secret.
# 08 — AI Architecture

Raven's AI Investigation Engine is a provider-agnostic copilot grounded in case data via RAG and
tool-calling. **No model provider is hardcoded.** It runs identically on cloud LLMs, OpenRouter, or
fully local models — and degrades gracefully to local-only in air-gapped mode.

## 1. Layered Design

```
┌────────────────────────────────────────────────────────────────────────┐
│ Copilot UI (slide-over, command palette, report builder)               │
├────────────────────────────────────────────────────────────────────────┤
│ Orchestrator (agentic loop): plan → retrieve → call tools → synthesize  │
│   • prompt assembly + guardrails    • citation enforcement              │
│   • streaming    • token budgeting   • approval gating for actions      │
├───────────────┬───────────────────────────┬────────────────────────────┤
│ RAG Engine    │ Tool/Function layer        │ LLM Abstraction Layer       │
│ (retrieval)   │ (graph/search/map/connectors)│ (provider router)         │
├───────────────┼───────────────────────────┼────────────────────────────┤
│ pgvector +    │ Neo4j · ES · PostGIS ·     │ OpenAI │ Anthropic │ Gemini │
│ ES hybrid     │ connector transforms       │ Grok │ DeepSeek │ OpenRouter│
│ rerank        │ (doc 16, incl. web.*)      │ Ollama │ vLLM │ LM Studio   │
└───────────────┴───────────────────────────┴────────────────────────────┘
```

## 2. LLM Abstraction Layer (BYO-AI)

A uniform interface; each provider is a connector with capabilities `chat`, `embeddings`, `vision`,
`tools`. Admin configures providers in the Integrations Center (doc 16); users pick from enabled
models in the copilot model selector.

```python
class LLMProvider(Protocol):
    name: str
    capabilities: set[str]                 # {"chat","embeddings","vision","tools"}
    async def chat(self, messages, *, tools=None, stream=True, **opts) -> AsyncIterator[Chunk]: ...
    async def embed(self, texts: list[str]) -> list[list[float]]: ...
    async def health(self) -> Health: ...
```

Built-in adapters: `OpenAIProvider`, `AnthropicProvider`, `GeminiProvider`, `GrokProvider`,
`DeepSeekProvider`, `OpenRouterProvider`, `OllamaProvider`, `VLLMProvider`, `LMStudioProvider`,
`OpenAICompatProvider` (covers Open WebUI and any OpenAI-compatible endpoint). Adding a new provider =
drop in one adapter class; nothing else changes.

**Routing & fallback** reuse the connector framework (doc 16 §5): priority order, automatic failover
(e.g. cloud → local Ollama), per-model rate/budget limits, circuit breakers. Air-gapped deployments
simply have only local providers enabled.

## 3. RAG Engine

- **Indexing**: case notes, evidence-extracted text (OCR/transcripts), reports, and normalized intel
  items are chunked, embedded (configurable embedder — cloud or local `bge`/`nomic`/`e5` via Ollama),
  and stored in `rag_documents` (pgvector) with `compartments` for ACL-aware retrieval.
- **Retrieval**: hybrid — pgvector cosine (semantic) + Elasticsearch BM25 (lexical) → reciprocal-rank
  fusion → optional cross-encoder rerank (local model). Results filtered by the requesting user's
  compartments and case scope **before** reaching the model.
- **Grounding**: retrieved chunks are passed with stable citation IDs; the orchestrator rejects model
  output that asserts case facts without a citation handle and re-prompts.

## 4. Tool / Function Layer

The copilot is agentic — it calls platform tools, not just text. Tools map to existing services:

| Tool | Backed by | Example natural-language trigger |
|------|-----------|----------------------------------|
| `graph.neighbors` / `graph.paths` | Neo4j | "Show all known connections between these entities" |
| `graph.community` / `graph.centrality` | GDS | "Who are the key players here?" |
| `search.entities` / `search.documents` | ES | "Find everything mentioning invoice 88123" |
| `timeline.build` | PG timeline_events | "Build a timeline of activities" |
| `alias.suggest` | phonetic + embedding match | "Identify possible aliases" |
| `risk.score` | scoring service | "Highlight anomalies / score this entity" |
| `map.cluster` / `map.movement` | PostGIS | "Where has this person been?" |
| `collect.transform` | connector framework (incl. `web.search`, `web.fetch`) | "Look this username up online" |
| `report.generate` | report service | "Generate an intelligence report" |

Tool calls that **collect new data or reveal sensitive data** route through the same legal-basis +
approval + audit gates as manual actions — the AI never bypasses access control.

## 5. Signature Capabilities

| Capability | How |
|-----------|-----|
| Natural-language investigation | agentic loop over tools + RAG, streamed answers with citations |
| Intelligence summarization | map-reduce summarize over case docs/entities, cited |
| Lead generation | graph gap analysis + connector suggestions ("unrun transforms likely to yield links") |
| Link analysis | `graph.paths`/`community`/`centrality`, rendered on canvas via "Render on graph" |
| Entity extraction | NER (local spaCy/transformer or LLM) over evidence text → candidate entities for analyst approval |
| Timeline creation | extracts dated events → `timeline.build` → reviewable timeline |
| Threat scoring | explainable weighted model; LLM narrates the factors |
| Relationship discovery | similarity + co-occurrence + path inference, each proposed with evidence |
| Pattern detection / anomalies | financial rules + outlier models + LLM explanation |
| Report & brief generation | structured templates, block output, citations, "AI-assisted" badge |

## 6. Guardrails & Trust

- **Citations mandatory**: every asserted fact links to a source/evidence/entity; uncited claims are
  flagged "unverified inference."
- **Human-in-the-loop**: AI outputs are proposals; entities, edges, timeline events, and report
  sections require analyst confirmation before becoming case fact (badge: machine-generated → verified).
- **Compartment-safe retrieval**: model context never includes data outside the user's clearance.
- **Prompt-injection defense**: retrieved/external content (web pages, feed text, documents) is wrapped
  as untrusted data; the system prompt instructs the model to treat it as content, not instructions; a
  classifier screens tool-call arguments derived from external text.
- **No exfiltration**: in air-gap, the LLM layer cannot reach the internet; even online, only
  admin-enabled providers receive data, and a redaction policy can strip selectors before they leave.
- **Determinism for evidence**: court-disclosure reports exclude AI-only inferences by template rule.

## 7. Model Management

- Local models managed in Admin → Model Manager: pull/import GGUF/safetensors, VRAM gauge, throughput
  benchmark, per-model context window, quantization selection.
- Multi-GPU / multi-node local serving via vLLM (tensor-parallel) or Ollama; hybrid mode lets heavy
  reasoning run on a local cluster while embeddings run elsewhere.
- Offline model bundles ship in the air-gapped installation package (doc 12).

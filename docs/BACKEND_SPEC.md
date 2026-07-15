# Koryphaios Backend — Rewrite Specification (extracted from original source)

Target: reimplement backend core in Zag (raw sockets, hand-rolled HTTP/WebSocket/JSON).
Derived from /reference/Koryphaios/backend and frontend API client code.

## 1. Server model
- ONE TCP listener serves everything (original: Bun.serve on 127.0.0.1:3001).
- Dispatch order: /ws (WebSocket upgrade) → /mcp (skip) → /api/* (router) → static file → SPA fallback (index.html) → 404.
- Port/host: env KORYPHAIOS_PORT/KORYPHAIOS_HOST → koryphaios.json server.port/host → app.config.json → default 3001/127.0.0.1.
- After bind, write .koryphaios/.active-port.json: {"port","host","url","wsUrl","timestamp","pid"}.
- CORS on /api/* only: reflect Origin, Access-Control-Allow-Credentials: true, preflight OPTIONS → 204.
- Rate limit /api/* (except /api/health): 120 req/60s per client, else 429 {"ok":false,"error":"Rate limit exceeded"}.
- Static: serve exact file by MIME, else index.html SPA fallback. Path traversal guard.
- Env: parse PROJECT_ROOT/.env KEY=value lines (existing env wins).
- Graceful shutdown on SIGTERM/SIGINT.

## 2. HTTP API (all JSON; envelope {"ok":true,"data":...} / {"ok":false,"error":"..."})
Auth: all routes except /api/health and auth bootstrap require Authorization: Bearer <sessionId>:<signature>. 401 {"ok":false,"error":"Unauthorized"}.
Frontend sends X-Koryphaios-Project header on every call.

### GET /api/health (no auth)
{"ok":true,"data":{"version":"1.0.0","uptime":1234.56,"pid":48213,
 "compat":{"minFrontend":"1.0.0","currentFrontend":"1.0.0","bundleHash":null,"bundleHashEnforced":false,"serverStartedAt":1752345678901}}}
pid REQUIRED (Tauri supervisor checks it). Frontend polls every 5s.

### Sessions /api/sessions — Session shape (timestamps epoch MILLISECONDS):
{"id":"aB3xQw9rTp2K","title":"New Session","parentSessionId":null,"workingDirectory":"/path",
 "messageCount":4,"totalTokensIn":1520,"totalTokensOut":890,"totalCost":0.0123,"version":1,
 "createdAt":1752300000000,"updatedAt":1752300500000}
- GET /api/sessions → {"ok":true,"data":[Session,...]}
- POST /api/sessions {"title","workingDirectory?"} → {"ok":true,"data":Session}
- GET /api/sessions/:id → Session or 404 {"ok":false,"error":"Session not found"}
- PATCH /api/sessions/:id (partial: title/messageCount/totalTokensIn/totalTokensOut/totalCost) → Session
- DELETE /api/sessions/:id → {"ok":true} (cascade messages)
- POST /api/sessions/:id/cancel → {"ok":true,"message":"Session cancelled"} + WS system.info
- GET /api/sessions/:id/context → {"ok":true,"lastUsage":null,"data":[...archived tool entries]}

### Messages /api/messages — Message shape:
{"id":"x6BGLr5aFnEm","sessionId":"...","role":"assistant","content":[{"type":"text","text":"..."}],
 "model":"...","provider":"...","tokensIn":12,"tokensOut":9,"cost":0.0002,
 "variantGroupId":null,"variantIndex":0,"createdAt":1752300000000}
- GET /api/messages/:sessionId → {"ok":true,"data":[Message,...]}
- POST /api/messages {"sessionId","content","model?","reasoningLevel?","attachments?"} →
  persist user msg, kick off orchestration async, return IMMEDIATELY {"ok":true,"data":{"status":"processing"}}.
  Reply streams over WS. Content stored as JSON [{"type":"text","text":"<flat>"}].
IDs: nanoid-style 12 chars, alphabet A-Za-z0-9_-.

### Providers /api/providers
- GET /api/providers (and /status alias) → {"ok":true,"data":[{
   "name","enabled","authenticated","authSource?","models":[ids],
   "allAvailableModels":[{"id","name","provider","apiModelId","contextWindow","maxOutputTokens",
     "costPerMInputTokens","costPerMOutputTokens","canReason","tier"}],
   "selectedModels":[],"hideModelSelector":false,"authMode":"api_key_or_auth"|"base_url_only",
   "supportsApiKey","supportsAuthToken","requiresBaseUrl","circuitOpen":false,"label","deployment"}]}
- PUT /api/providers/:name {"apiKey?","authToken?","baseUrl?","selectedModels?","hideModelSelector?"} → {"ok":true}
- DELETE /api/providers/:name → {"ok":true}
- Credentials file: .koryphaios/credentials.json plaintext chmod 0600 {"<provider>":{"apiKey":"..."}}

### Auth /api/auth (local single-user)
- POST /api/auth/session (local only) → {"ok":true,"data":{"bearerToken":"Bearer id:sig","sessionId","signature","expiresAt"}}
- GET /api/auth/me → {"ok":true,"data":{"user":{"id":"local-user","username":"Local User","isAdmin":true,"createdAt":...,"permissions":["*"]}}} or {"data":{"user":null}}
- DELETE /api/auth/session → {"ok":true,"message":"Session revoked"}
- Token: sessionId + HMAC-SHA256(masterKey, sessionId) base64url. Master key: random bytes .koryphaios/.master-auth 0600.
  (Zag port may simplify: random token per boot, constant-time compare.)
- Frontend stores token in localStorage['koryphaios-local-auth-token'].

### Project/workspace
- GET /api/project → {"ok":true,"data":{"projectName":"<basename of root>"}}
- GET /api/workspace/home → {"ok":true,"data":"/home/user"}
- GET /api/workspace/files?q= → {"ok":true,"data":["src/index.ts",...]} (skip node_modules/.git/dist/build, cap 500)

### Git /api/git (scoped by X-Koryphaios-Project; shell out to git)
- GET /api/git/repo → {"ok":true,"data":{"isRepo":bool}}
- GET /api/git/status → {"ok":true,"data":{"isRepo","status":[...],"branch","ahead","behind"}}
- GET /api/git/diff?file=&staged= → {"ok":true,"data":{"diff":"..."}}
- POST stage/restore/commit/checkout/push/pull; GET /api/git/branches
### Misc
- GET/PUT /api/mode {"mode":"beginner"|"advanced"}; POST /api/debug/log-error → {"ok":true} (sink)
- GET /api/agent/settings → defaults incl. agentExecutionMode:"auto", criticGateEnabled:true, maxCriticIterations:3

## 3. WebSocket /ws
- ws://host:port/ws?auth=<urlencoded bearer>. Subprotocol ['koryphaios']. Auth BEFORE upgrade else HTTP 401.
- On accept: push provider.status frame {"payload":{"providers":[...same as GET /api/providers...]}}.
- Envelope server→client: {"type","payload":{...},"timestamp":ms,"sessionId?","agentId?"}
  sessionId present ⇒ only to subscribed conns; absent ⇒ broadcast.
- Client→server (flat): {"type":"subscribe_session","sessionId","timestamp"} | user_input {selection,text} |
  session.accept_changes | session.reject_changes | toggle_yolo {enabled}
- Server events consumed by frontend:
  stream.delta {agentId,content,model} (coalesced 50ms), stream.thinking {agentId,thinking,thinkingTokens},
  stream.tool_call {agentId,toolCall:{id,name,input}}, stream.tool_result {agentId,toolResult:{callId,name,output(8192 cap),isError,durationMs}},
  stream.usage {agentId,model,provider,tokensIn,tokensOut,tokensUsed,usageKnown,contextKnown,contextSource,contextWindow,breakdown},
  agent.status {agentId,status: idle|thinking|analyzing|tool_calling|streaming|verifying|compacting|waiting_user|done, detail}
    (frontend ends streaming UI on done|idle|waiting — NOT stream.complete),
  agent.spawned {agent:{id,name,role,model,provider,domain,glowColor},task,parentAgentId},
  agent.error {agentId,error}, kory.thought {thought,phase}, kory.routing {domain,selectedModel,selectedProvider,reasoning},
  kory.ask_user {question,options,allowOther}, session.updated {session:Session},
  session.changes {changes:[{type,path,description}]}, system.error {error}, system.notification {type,message,title?},
  system.info {message}, provider.rate_limit {provider,model,retryAfterMs,attempt,maxRetries}
- Coalescing: buffer stream.delta/stream.thinking per (sessionId,type,agentId), flush after 50ms idle;
  any other event flushes all buffers first (ordering preserved).
- Heartbeat: original has a BUG (force-close every ~60s). Implement real ping/pong or no liveness close.
- Frontend reconnects with backoff min(1000*2^n,30000), resubscribes sessions on reconnect.
- "Realtime connected" pill driven by native socket open/close/error only.

## 4. Persistence (Zag port: JSON-file store replacing bun:sqlite)
Original: SQLite tables sessions/messages/tasks (timestamps stored in SECONDS, API in MS).
Zag port: data dir ./data/ with sessions.json (array) + messages/<sessionId>.json (array), atomic write (tmp+rename), same JSON API shapes (ms timestamps). Keep field names exactly.

## 5. Orchestration (the agent loop)
POST /api/messages → persist user message → async processTask:
1. Resolve provider+model (explicit "provider:model" → catalog; "auto" → first/best authenticated; none → WS system.error "No model provider is configured. Open Settings and connect a provider before chatting." and stop).
2. WS kory.thought {phase:"analyzing"}, agent.status thinking/analyzing.
3. TURN LOOP (max 25): assemble system prompt + tool defs + history (last 10 messages) →
   stream from provider → forward WS stream.* events → if tool calls: execute SEQUENTIALLY
   (archive, WS stream.tool_result, cap 30000 chars into context, append role:tool) → loop; else break.
4. Persist assistant message; session.updated (messageCount, tokens, cost); agent.status done.
5. First message: generate session title (cheap LLM call or heuristic) → session.updated.
- Kory = single manager agent {id:"kory-manager",name:"Kory",role:"manager"}.
- Critic = fresh-context read-only reviewer (read_file/grep/glob/ls) after worker finishes; PASS/FAIL last line; ≤3 attempts.
- Auto model routing = score models of authenticated providers by tier; reasoningLevel (low/medium/high) = thinking budget, orthogonal.
- Cancellation: in-memory abort flag per session, checked each loop iteration; salvage partial output + "Stopped by user." system row.
- Tools (min set for port): bash, read_file, write_file, edit_file, grep, glob, ls (+ ask_user via WS). Result: {callId,name,output,isError,durationMs}.

## 6. Providers (wire formats)
### Ollama (PLAIN HTTP — native Zag path)
- Base http://localhost:11434 ; health GET {base}/api/tags (200 = up);
- models GET {base}/v1/models ; chat POST {base}/v1/chat/completions (OpenAI-compatible SSE; note /v1 required).
### OpenAI-compatible (openai, groq, openrouter, xai, deepseek, mistral, together...)
- POST {base:-https://api.openai.com/v1}/chat/completions, Authorization: Bearer <key>
- body: {"model","stream":true,"stream_options":{"include_usage":true},"max_completion_tokens",
  "messages":[{"role":"system","content":"..."},{"role":"user","content":[{"type":"text","text":"hi"}]},
   {"role":"assistant","content":null,"tool_calls":[{"id","type":"function","function":{"name","arguments":"json-str"}}]},
   {"role":"tool","tool_call_id","content":"..."}],
  "tools":[{"type":"function","function":{"name","description","parameters":{}}}],"reasoning_effort":"medium"}
- SSE: "data: {chunk}\n\n" ... "data: [DONE]"; parse choices[0].delta.content, delta.reasoning_content,
  delta.tool_calls[].function.arguments (buffer per index), finish_reason (stop|length|tool_calls), trailing usage chunk.
### Anthropic
- POST https://api.anthropic.com/v1/messages, x-api-key + anthropic-version headers
- body: {"model":apiModelId,"max_tokens","system","stream":true,"messages":[...blocks...],"tools":[{name,description,input_schema}],"thinking":{"type":"enabled","budget_tokens":8192}}
- SSE: message_start, content_block_start (text/tool_use/thinking), content_block_delta (text_delta|thinking_delta|input_json_delta), content_block_stop, message_delta (stop_reason,output_tokens), message_stop.
- HTTPS required → Zag port: native plain-HTTP for local providers (Ollama); external HTTPS via curl subprocess fallback (documented tradeoff).

## 7. Boot-critical minimum
Main screen renders fully with: GET /api/health, GET/POST /api/auth/*, GET /api/sessions, GET /api/project,
GET /api/providers, WS /ws (provider.status push + subscribe_session).
Chat works with: POST /api/messages + turn loop + one provider + stream.delta/stream.usage/agent.status(done) + persistence.
"Setup required" banner: computed client-side when zero providers authenticated:true.

## 8. Bugs in original to FIX not reproduce
- WS heartbeat force-closes clients every ~60s (no pong handler) → implement real ping/pong.
- Ollama default base URL missing /v1 → target {base}/v1/chat/completions explicitly.
- session.updated dual payload shapes → standardize {"session":Session}.
- provider PUT returns 200 with ok:false on failure.

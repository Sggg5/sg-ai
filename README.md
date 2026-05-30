# sg-ai-worker

Cloudflare Worker project for FRANTA AI search.

## Bindings

- `AI`: Workers AI
- `MY_SEARCH`: AI Search instance `sggg`
- `KNOWLEDGE_BUCKET`: R2 bucket `sggg`

## Commands

```bash
npm install
npm run dev
npm run deploy
```

Routes:

- `GET /`: HTML homepage
- `POST /api/ask`: Search AI Search instance `sggg`, then generate a Chinese answer with Workers AI

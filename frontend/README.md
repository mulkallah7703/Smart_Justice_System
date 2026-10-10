# Smart Judicial System — Frontend

React 18 + Vite UI for **المنظومة العدلية الذكية**.

## API mode

| Config | Behavior |
|--------|----------|
| `VITE_API_MODE=real` + `VITE_API_BASE_URL=...` | All domains call Nest (default for production builds) |
| `VITE_API_MODE=mock` | In-browser mocks — **development/test only**; **forbidden in production builds** |
| Missing URL in real/production | Clear failure (`API_UNAVAILABLE` / startup assert) — **no silent mock fallback** |

```bash
cd frontend
npm install
# copy .env.development or set:
# VITE_API_MODE=real
# VITE_API_BASE_URL=http://localhost:3000/api/v1
npm run dev
```

Do not put `OPENAI_API_KEY` or other backend secrets in frontend env.

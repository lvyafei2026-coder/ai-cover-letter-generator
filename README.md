# AI Cover Letter Generator

A Cloudflare Worker that writes tailored cover letters using Workers AI (Llama 3.2 3B).

## Features

- Three lengths: short, medium, long
- Four styles: standard, conversational, achievement-focused, career change
- Optional job description for deeper tailoring
- Runs on Cloudflare Workers AI — no API keys
- Built-in rate limiting (30 requests/min per IP)
- Text is not stored or logged
- Multi-language interface (EN + ZH)

## Setup

```bash
npm install
npx wrangler login
npx wrangler deploy
```

## Routes

Add to `tool-proxy`:
- `toolara.dev/ai-cover-letter-generator/*`
- `www.toolara.dev/ai-cover-letter-generator/*`

## License

MIT

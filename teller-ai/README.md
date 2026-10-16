This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

## Image generation

Text chat, conversation titles, and CyberAgent try NVIDIA's Nemotron 3 Nano Omni model first, then fall back to OpenRouter's `openrouter/auto` router if NVIDIA fails. Set both server-side `NVIDIA_API_KEY` and `OPENROUTER_API_KEY` to enable both providers; either provider can serve requests on its own. NVIDIA's endpoint and model default to `https://integrate.api.nvidia.com/v1/chat/completions` and `nvidia/nemotron-3-nano-omni-30b-a3b-reasoning`. Optionally override them with `NVIDIA_API_BASE_URL` and `NVIDIA_MODEL`. `AI_API_KEY` is accepted as a legacy NVIDIA key variable. Image analysis and audio transcription continue to use NVIDIA directly.

Image generation remains on OpenRouter because the NVIDIA model returns text rather than generated images. It uses the server-side `OPENROUTER_API_KEY` and `IMAGE_GENERATION_MODEL`; set `IMAGE_GENERATION_MODEL=google/gemini-3.1-flash-image-preview` to select Nano Banana 2. Generated images default to 1K resolution. JPEG, PNG, and WebP uploads up to 3 MB are analyzed when the prompt asks a question and used as references when the prompt asks for an edit.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## CyberAgent: Gmail and Calendar

CyberAgent is available from the chat sidebar. It uses Google's remote Gmail MCP server for supported Gmail searches, thread reads, and draft creation, and the Google Calendar API for listing and creating primary-calendar events. It never sends email. Creating a Gmail draft or Calendar event requires an explicit confirmation in the chat.

To enable the Google connection:

1. In Google Cloud, enable the Gmail API, Gmail MCP API, and Google Calendar API for the project.
2. Configure the OAuth consent screen. Add these scopes to the app's Data Access settings:
   - `https://www.googleapis.com/auth/gmail.readonly`
   - `https://www.googleapis.com/auth/gmail.compose`
   - `https://www.googleapis.com/auth/calendar.events`
3. Create a **Web application** OAuth client. Add the exact deployed callback URL (for local development, `http://localhost:3000/api/google/callback`) as an authorized redirect URI.
4. Set these server-only environment variables from `.env.example`:
   - `GOOGLE_OAUTH_CLIENT_ID`
   - `GOOGLE_OAUTH_CLIENT_SECRET`
   - `GOOGLE_OAUTH_REDIRECT_URI`
   - `GOOGLE_TOKEN_ENCRYPTION_KEY` — a base64-encoded 32-byte key; for example, generate one with `openssl rand -base64 32`.
   - `GMAIL_MCP_SERVER_URL` is optional and defaults to `https://gmailmcp.googleapis.com/mcp/v1`.
5. Ensure `DATABASE_URL` is configured. OAuth tokens are encrypted before being stored in Postgres. Do not put Google credentials in `NEXT_PUBLIC_*` variables or commit them.

Google may require OAuth app verification before external users can grant sensitive Gmail and Calendar scopes. While the consent screen is in testing mode, add the intended accounts as test users.

CyberAgent treats retrieved email and calendar content as untrusted input. Users should still review draft/event details before confirming. For Google's Gmail MCP setup and security guidance, see [Configure the Gmail MCP server](https://developers.google.com/workspace/gmail/api/guides/configure-mcp-server).

## CyberMaps: interactive maps and directions

CyberMaps is available from the chat sidebar. Ask it to show a place or give directions, such as “directions from Cape Town Station to Table Mountain by transit.” The app embeds an interactive Google Maps search or directions map and stores the latest map request with the chat.

To enable the embedded map:

1. Enable the **Maps Embed API** in the Google Cloud project.
2. Create an API key and restrict it to the Maps Embed API and your app's HTTP referrers.
3. Set `NEXT_PUBLIC_GOOGLE_MAPS_EMBED_API_KEY` in `.env.local`. This key is intentionally visible in the browser for the embed request, so restrict it in Google Cloud; do not use an unrestricted key.

Without the key, CyberMaps still provides a link to open the requested search or route in Google Maps. The embedded map provides current interactive Google Maps content; the chat assistant does not claim live traffic or route estimates.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

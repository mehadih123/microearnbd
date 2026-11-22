import { GoogleGenAI, ThinkingLevel } from '@google/genai';

const GEMINI_MODEL = 'gemini-4-hydrogen';
const FALLBACK_GEMINI_MODEL = 'gemini-3.1-flash-lite';

const ALLOWED_INLINE_MIMES = new Set([
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
  'image/gif',
  'application/pdf',
]);

const ALLOWED_TEXT_MIMES = new Set([
  'text/plain',
  'text/csv',
  'text/markdown',
  'application/json',
]);

const MICROEARN_BASE_SYSTEM_INSTRUCTION = `You are the official Multimodal AI Customer Support, Technical Troubleshooting & Business Advisor for **MicroEarn BD** — a trusted zero-investment online reselling, micro-task, and educational coin-earning platform in Bangladesh.

CRITICAL RULES (ZERO HALLUCINATION):
1. Only state platform facts, numbers, rules, and policies verified below or visible in user-uploaded screenshots/documents or the LIVE ACCOUNT CONTEXT section. Never invent fake promo/gift codes, fake payment numbers, unverified commission numbers, fake API/system statuses, or unimplemented payment features.
2. When a user uploads a screenshot or document (such as a bKash payment TrxID screenshot, micro-job proof screenshot, error popup, dashboard screenshot, or product order sheet):
   - Carefully examine all visible details in the image/file (amounts, numbers, status badges, error messages, dates, TrxIDs, UI state).
   - Give specific, step-by-step troubleshooting or verification guidance based strictly on what is shown and MicroEarn BD's official rules.
   - If a screenshot shows signs of scam/phishing (e.g., someone demanding an "unlock fee" or asking for a bKash PIN/OTP), immediately warn the user!
3. If an issue requires checking private server records or manual admin action, guide the user cleanly to **মতামত ও অভিযোগ (Support & Complaints)** inside the app, email **support@microearnbd.com**, or Telegram **@MicroEarnBD**.
4. Language: Match the user's language naturally (Bangla/Banglish → Bengali; English → English). Keep answers structured and easy to scan.

=== VERIFIED MICROEARN BD PLATFORM KNOWLEDGE ===
- Joining & earning: 100% free (0 investment/deposit). Email/Password + Google Sign-In.
- Educational Coin Tasks: Math Task, Quiz Job, Captcha Solving = +50 Coins per right answer (wrong math/captcha answer immediately skips to a new one). Conversion: 1,000 Coins = ৳1.00 BDT.
- Reselling Hub & Smart Escrow: Zero-investment wholesale reselling via COD (Steadfast/RedX/Pathao). Commission stays in Pending Escrow until courier COD delivery and Admin verification.
- Micro-Jobs & Create Job: Workers submit real proof for BDT rewards. Buyer job minimums: YouTube ৳3.50, Facebook ৳2.00, Telegram ৳2.00, App Install ৳15.00, Review ৳10.00 (+8% Platform Verification Fee, bKash TrxID verified).
- Spin & Win: Slots ৳5, ৳10, ৳15, ৳20 BDT (1 Spin = ৳10 BDT from Main Balance).
- Referral Link (?ref=...), Dynamic Admin Gift Codes (quota-limited), Activity History.
- Wallet & Cashout: Minimum ৳100 BDT, 0% fee, bKash Personal (11-digit 01XXXXXXXXX), two-step Firebase re-authentication, typical payout 15 min – 3 hours. Rejected withdrawals auto-refund to Main Balance.
- Security: Official Firebase sendPasswordResetEmail (no on-screen OTPs). MicroEarn BD never asks for withdrawal/activation fees, passwords, or bKash PIN/OTPs.
- Business Advisor: Suggest practical, legal Bangladeshi startup/online business models with capital, delivery, payment, and unit-margin advice.`;

function buildSystemInstruction(context = {}) {
  const safeLang = context?.language === 'en' ? 'English' : 'Bangla (default UI language)';
  const authStatus = context?.isAuthenticated ? 'Logged-in Member' : 'Public Visitor (not logged in yet)';
  const balance = typeof context?.balance === 'number' && Number.isFinite(context.balance)
    ? `৳${context.balance.toFixed(2)} BDT`
    : 'N/A (not logged in)';
  const coins = typeof context?.coins === 'number' && Number.isFinite(context.coins)
    ? `${Math.floor(context.coins)} Coins`
    : 'N/A (not logged in)';
  const escrow = typeof context?.pendingEscrowBalance === 'number' && Number.isFinite(context.pendingEscrowBalance)
    ? `৳${context.pendingEscrowBalance.toFixed(2)} BDT`
    : 'N/A';

  return `${MICROEARN_BASE_SYSTEM_INSTRUCTION}

=== LIVE SESSION CONTEXT (READ-ONLY) ===
- User Session: ${authStatus}
- Current UI Language Preference: ${safeLang}
- Active Screen Tab: ${typeof context?.activeTab === 'string' ? context.activeTab.slice(0, 40) : 'home'}
- Current Main Balance: ${balance}
- Current Coin Wallet: ${coins} (1,000 Coins = ৳1.00 BDT; minimum withdrawal is ৳100 BDT)
- Pending Escrow Balance: ${escrow}
- Successful Referrals: ${typeof context?.referralsCount === 'number' ? context.referralsCount : 0}
- Live Active Micro-Jobs: ${typeof context?.activeJobsCount === 'number' ? context.activeJobsCount : 0}
- Live Published Resell Products: ${typeof context?.publishedProductsCount === 'number' ? context.publishedProductsCount : 0}`;
}

function buildContents(messages) {
  const contents = [];
  for (const turn of messages) {
    if (!turn || typeof turn !== 'object') continue;
    const role = turn.role === 'model' ? 'model' : 'user';
    const text = typeof turn.text === 'string' ? turn.text.trim().slice(0, 3000) : '';
    const parts = [];

    if (Array.isArray(turn.attachments)) {
      for (const item of turn.attachments.slice(0, 3)) {
        if (!item || typeof item !== 'object') continue;
        const rawMime = typeof item.mimeType === 'string' ? item.mimeType.trim().toLowerCase() : '';
        const mime = rawMime === 'image/jpg' ? 'image/jpeg' : rawMime;
        const fileName = typeof item.name === 'string' ? item.name.slice(0, 120) : 'attachment';
        let base64Data = typeof item.data === 'string' ? item.data.trim() : '';
        if (base64Data.startsWith('data:')) {
          const idx = base64Data.indexOf(',');
          if (idx !== -1) base64Data = base64Data.slice(idx + 1);
        }
        if (!base64Data || base64Data.length > 6_500_000) continue;

        if (ALLOWED_INLINE_MIMES.has(mime)) {
          parts.push({ inlineData: { mimeType: mime, data: base64Data } });
        } else if (ALLOWED_TEXT_MIMES.has(mime)) {
          try {
            const decoded = Buffer.from(base64Data, 'base64').toString('utf-8').slice(0, 15_000);
            if (decoded.trim()) {
              parts.push({ text: `[Attached File: ${fileName} (${mime})]\n${decoded}` });
            }
          } catch {
            // Skip malformed file
          }
        }
      }
    }

    if (text) {
      parts.push({ text });
    } else if (parts.length > 0 && role === 'user') {
      parts.push({
        text: 'Please analyze this attached image/file in the context of MicroEarn BD and provide clear help.',
      });
    }

    if (parts.length > 0) {
      contents.push({ role, parts });
    }
  }
  return contents;
}

export default async (req) => {
  if (req.method === 'GET') {
    return Response.json({ ok: true, service: 'microearnbd-support-api', model: GEMINI_MODEL, multimodal: true });
  }

  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });
  }

  if (req.method !== 'POST') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 });
  }

  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    return Response.json(
      { error: 'GEMINI_API_KEY is missing in your server environment variables.' },
      { status: 503 }
    );
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'Invalid JSON request body.' }, { status: 400 });
  }

  const messages = Array.isArray(body?.messages) ? body.messages.slice(-12) : [];
  const contents = buildContents(messages);
  if (contents.length === 0 || contents[contents.length - 1].role !== 'user') {
    return Response.json({ error: 'A user message or attachment is required.' }, { status: 400 });
  }

  const ai = new GoogleGenAI({
    apiKey,
    httpOptions: { headers: { 'User-Agent': 'aistudio-build' } },
  });

  const systemInstruction = buildSystemInstruction(body?.context);

  const isModelNotFoundError = (err) => {
    const msg = String(err?.message || '').toLowerCase();
    return (
      err?.status === 404 ||
      msg.includes('unknown_model') ||
      msg.includes('not_found') ||
      msg.includes('not found') ||
      msg.includes('not supported for')
    );
  };

  if (body?.stream === false) {
    let lastError;
    for (const modelName of [GEMINI_MODEL, FALLBACK_GEMINI_MODEL]) {
      try {
        const result = await ai.models.generateContent({
          model: modelName,
          contents,
          config: {
            systemInstruction,
            ...(modelName === 'gemini-4-hydrogen'
              ? { thinkingConfig: { thinkingLevel: ThinkingLevel.LOW } }
              : {}),
          },
        });
        return Response.json({ text: result.text ?? '' });
      } catch (err) {
        lastError = err;
        if (isModelNotFoundError(err)) continue;
        return Response.json(
          { error: err?.message || 'Failed to generate AI response.' },
          { status: err?.status || 500 }
        );
      }
    }
    return Response.json(
      { error: lastError?.message || 'Failed to generate AI response.' },
      { status: lastError?.status || 500 }
    );
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        let geminiStream;
        let lastError;
        for (const modelName of [GEMINI_MODEL, FALLBACK_GEMINI_MODEL]) {
          try {
            geminiStream = await ai.models.generateContentStream({
              model: modelName,
              contents,
              config: {
                systemInstruction,
                ...(modelName === 'gemini-4-hydrogen'
                  ? { thinkingConfig: { thinkingLevel: ThinkingLevel.LOW } }
                  : {}),
              },
            });
            break;
          } catch (err) {
            lastError = err;
            if (isModelNotFoundError(err)) continue;
            throw err;
          }
        }
        if (!geminiStream) throw lastError || new Error('Unable to initialize AI stream.');

        for await (const chunk of geminiStream) {
          if (chunk.text) {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: chunk.text })}\n\n`));
          }
        }
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true })}\n\n`));
      } catch (err) {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ error: err?.message || 'AI stream error.' })}\n\n`)
        );
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
    },
  });
};

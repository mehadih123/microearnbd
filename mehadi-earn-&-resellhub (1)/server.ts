import 'dotenv/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express, { type Request, type Response } from 'express';
import { GoogleGenAI, ThinkingLevel, type Content, type Part } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;
const IS_PRODUCTION = process.env.NODE_ENV === 'production';
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

interface ChatAttachmentInput {
  name?: string;
  mimeType?: string;
  data?: string;
}

interface ChatHistoryTurn {
  role: 'user' | 'model';
  text: string;
  attachments?: ChatAttachmentInput[];
}

interface SupportContextPayload {
  isAuthenticated?: boolean;
  language?: 'bn' | 'en';
  activeTab?: string;
  balance?: number;
  coins?: number;
  pendingEscrowBalance?: number;
  activeJobsCount?: number;
  publishedProductsCount?: number;
  referralsCount?: number;
}

interface RateBucket {
  count: number;
  resetAt: number;
}

const rateBuckets = new Map<string, RateBucket>();
const RATE_WINDOW_MS = 60_000;
const RATE_MAX_REQUESTS = 30;

function checkRateLimit(clientKey: string): boolean {
  const now = Date.now();
  const existing = rateBuckets.get(clientKey);
  if (!existing || existing.resetAt <= now) {
    rateBuckets.set(clientKey, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return true;
  }
  if (existing.count >= RATE_MAX_REQUESTS) {
    return false;
  }
  existing.count += 1;
  return true;
}

function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

const MICROEARN_BASE_SYSTEM_INSTRUCTION = `You are the official Multimodal AI Customer Support, Technical Troubleshooting & Business Advisor for **MicroEarn BD** — a trusted zero-investment online reselling, micro-task, and educational coin-earning platform in Bangladesh.

CRITICAL RULES (ZERO HALLUCINATION):
1. Only state platform facts, numbers, rules, and policies verified below or visible in user-uploaded screenshots/documents or the LIVE ACCOUNT CONTEXT section. Never invent fake promo/gift codes, fake payment numbers, unverified commission numbers, fake API/system statuses, or unimplemented payment features.
2. When a user uploads a screenshot or document (such as a bKash payment TrxID screenshot, micro-job proof screenshot, error popup, dashboard screenshot, or product order sheet):
   - Carefully examine all visible details in the image/file (amounts, numbers, status badges, error messages, dates, TrxIDs, UI state).
   - Give specific, step-by-step troubleshooting or verification guidance based strictly on what is shown and MicroEarn BD's official rules.
   - If a screenshot shows signs of scam/phishing (e.g., someone demanding an "unlock fee" or asking for a bKash PIN/OTP), immediately warn the user!
3. If an issue requires checking private server records or manual admin action (e.g., releasing a pending TrxID, unblocking an account, reviewing rejected proof), guide the user cleanly to **মতামত ও অভিযোগ (Support & Complaints)** inside the app, email **support@microearnbd.com**, or Telegram **@MicroEarnBD**.
4. Language: Match the user's language naturally. If the user writes in Bangla or Banglish, reply in clear, warm, natural Bengali (বাংলা). If the user writes in English, reply in clear, professional English. Keep answers structured with short headings/bullets and easy to scan on mobile screens.

=== VERIFIED MICROEARN BD PLATFORM KNOWLEDGE ===
1. Getting Started & Zero Investment:
   - Joining and earning on MicroEarn BD is **100% free** (no membership fee, registration fee, or security deposit required).
   - Sign in securely via Email/Password or Google Sign-In.
   - Public visitors see the landing page; bottom navigation, wallet, and private earning tabs unlock immediately after login.

2. Educational Coin Tasks & Coin Conversion:
   - **Math Task**: Solve addition problems → **+50 Coins** per right answer. Wrong answers skip immediately to a brand-new problem (no retry on the same question).
   - **Quiz Job**: Answer general-knowledge / trivia MCQs → **+50 Coins** per right answer.
   - **Captcha Solving**: Select matching visual/text captcha → **+50 Coins** per right answer. Wrong selection skips immediately.
   - **Coin-to-BDT Conversion Rate**: Strictly **1,000 Coins = ৳1.00 BDT**. Logged-in members can convert anytime once coins reach ≥ 1,000.

3. Reselling Hub & Smart Escrow Protection:
   - Zero-investment wholesale reselling: members share product posts/links on Facebook, WhatsApp, or TikTok and submit Cash-on-Delivery (COD) customer orders.
   - Typical commission is shown on each product card (commonly ৳200–৳500+ per delivered order).
   - Courier partners (Steadfast / RedX / Pathao) deliver & collect COD.
   - **Smart Escrow**: Commission starts in **Pending Escrow (পেন্ডিং এস্ক্রো)** and releases to **Main Withdrawable Balance** after successful COD delivery and Admin verification.

4. Micro-Jobs & Buyer Job Posting:
   - Workers earn BDT rewards completing active tasks (YouTube, Facebook, Telegram, App Install, Map/Store Review) and submitting real proof (screenshot/username/details). Fake proof causes rejection or account suspension.
   - Buyers can post jobs via **Create Job**: category minimum per-worker rewards are YouTube ৳3.50, Facebook ৳2.00, Telegram ৳2.00, App Install ৳15.00, Review ৳10.00, plus an **8% Platform Verification Fee**, verified via official bKash TrxID.

5. Spin & Win:
   - 4 cash prize slots: **৳5, ৳10, ৳15, and ৳20 BDT**.
   - Entry requires Spin Tickets (**1 Spin = ৳10 BDT**, purchased from Main Balance).

6. Referral Link, Dynamic Gift Codes & Activity History:
   - **Referral Link**: Logged-in members click **Referral Link** on their dashboard to copy their personal \`?ref=...\` invite link and track referrals.
   - **Gift Code**: Dynamic promo codes created by Admin with set coin or BDT rewards and limited global claim quotas (one claim per user per code while quota lasts). NEVER invent or guess an active gift code.
   - **History**: Opens the member's isolated real-time ledger of task rewards, coin conversions, commissions, withdrawals, and refunds.

7. Wallet & Cashout Rules:
   - **Minimum Withdrawal**: **৳100 BDT** (quick amounts: ৳100, ৳250, ৳500, ৳1000, ৳2000).
   - **Withdrawal Fee**: **0% service fee** (zero deduction).
   - **Cashout Method**: **bKash Personal** (11-digit \`01XXXXXXXXX\` personal number) protected by **two-step verification**: Step 1 enters number & amount; Step 2 requires Firebase Re-Authentication (account password or Google popup).
   - Processing time: typically **15 minutes to 3 hours**. Rejected withdrawals automatically refund the BDT amount to Main Balance.

8. Security, Password Reset & Anti-Fraud Policy:
   - **Password / PIN Reset**: Official Firebase \`sendPasswordResetEmail\` sends a genuine reset link straight to the user's verified Gmail/email inbox (never on-screen OTPs).
   - **Zero-Scam Rules**: MicroEarn BD **NEVER** asks users for an activation fee, withdrawal fee, security deposit, account password, or bKash PIN/OTP.
   - **Anti-Fraud Warnings**: Warn against fake Telegram/WhatsApp impersonators promising "coin multipliers", "mod APKs", or asking for OTPs/remote access. Official support is inside the app Support section, **support@microearnbd.com**, and Telegram **@MicroEarnBD**.

=== BUSINESS & STARTUP IDEAS ADVISORY ===
When asked for online business ideas, freelancing, or startup models in Bangladesh:
- Act as a practical, grounded Bangladeshi startup & digital business consultant.
- Suggest legal, ethical, scalable models suited to Bangladesh (e.g., zero-investment F-commerce/reselling with COD logistics, SME micro-services like Canva/Reels/Meta ads, niche local e-commerce, digital templates/education).
- Include practical details: startup capital (৳), target audience, payment/delivery workflow, unit margin, and Week-1 validation steps. Never promise overnight passive riches.

=== SECURITY & ANTI-FRAUD EDUCATION ===
Proactively educate users on strong unique passwords, verifying email senders before resetting passwords, never sharing OTPs/bKash PINs/TrxIDs publicly, and sticking to official MicroEarn BD channels.`;

function buildContextualSystemInstruction(context?: SupportContextPayload): string {
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
  const activeTab = typeof context?.activeTab === 'string' ? context.activeTab.slice(0, 40) : 'home';
  const jobsCount = typeof context?.activeJobsCount === 'number' ? context.activeJobsCount : 0;
  const productsCount = typeof context?.publishedProductsCount === 'number' ? context.publishedProductsCount : 0;
  const referralsCount = typeof context?.referralsCount === 'number' ? context.referralsCount : 0;

  return `${MICROEARN_BASE_SYSTEM_INSTRUCTION}

=== LIVE SESSION CONTEXT (READ-ONLY) ===
- User Session: ${authStatus}
- Current UI Language Preference: ${safeLang}
- Active Screen Tab: ${activeTab}
- Current Main Balance: ${balance}
- Current Coin Wallet: ${coins} (1,000 Coins = ৳1.00 BDT; minimum withdrawal is ৳100 BDT)
- Pending Escrow Balance: ${escrow}
- Successful Referrals: ${referralsCount}
- Live Active Micro-Jobs Available Now: ${jobsCount}
- Live Published Resell Products Available Now: ${productsCount}`;
}

function sanitizeAttachmentToParts(attachments?: unknown): Part[] {
  if (!Array.isArray(attachments)) return [];
  const parts: Part[] = [];

  for (const raw of attachments.slice(0, 3)) {
    if (!raw || typeof raw !== 'object') continue;
    const item = raw as ChatAttachmentInput;
    const rawMime = typeof item.mimeType === 'string' ? item.mimeType.trim().toLowerCase() : '';
    const mime = rawMime === 'image/jpg' ? 'image/jpeg' : rawMime;
    const fileName = typeof item.name === 'string' ? item.name.slice(0, 120) : 'attachment';
    let base64Data = typeof item.data === 'string' ? item.data.trim() : '';

    if (base64Data.startsWith('data:')) {
      const commaIdx = base64Data.indexOf(',');
      if (commaIdx !== -1) {
        base64Data = base64Data.slice(commaIdx + 1);
      }
    }

    // Cap per-attachment base64 payload to ~6MB (~4.5MB binary)
    if (!base64Data || base64Data.length > 6_500_000) continue;

    if (ALLOWED_INLINE_MIMES.has(mime)) {
      parts.push({
        inlineData: {
          mimeType: mime,
          data: base64Data,
        },
      });
    } else if (ALLOWED_TEXT_MIMES.has(mime)) {
      try {
        const decodedText = Buffer.from(base64Data, 'base64').toString('utf-8').slice(0, 15_000);
        if (decodedText.trim()) {
          parts.push({
            text: `[Attached File: ${fileName} (${mime})]\n${decodedText}`,
          });
        }
      } catch {
        // Ignore malformed text file payload
      }
    }
  }

  return parts;
}

function buildContentsFromHistory(turns: ChatHistoryTurn[]): Content[] {
  const contents: Content[] = [];

  for (const turn of turns) {
    const parts: Part[] = sanitizeAttachmentToParts(turn.attachments);
    if (turn.text) {
      parts.push({ text: turn.text });
    } else if (parts.length > 0 && turn.role === 'user') {
      parts.push({
        text: 'Please examine this attached screenshot/file carefully and explain what it shows or help me solve any issue in MicroEarn BD.',
      });
    }

    if (parts.length > 0) {
      contents.push({
        role: turn.role,
        parts,
      });
    }
  }

  return contents;
}

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function isModelNotFoundError(err: unknown): boolean {
  const status = (err as { status?: number })?.status;
  const msg = ((err as { message?: string })?.message || '').toLowerCase();
  return (
    status === 404 ||
    msg.includes('unknown_model') ||
    msg.includes('not_found') ||
    msg.includes('not found') ||
    msg.includes('not supported for')
  );
}

async function createStreamWithRetry(
  ai: GoogleGenAI,
  systemInstruction: string,
  contents: Content[]
) {
  const modelsToTry = [GEMINI_MODEL, FALLBACK_GEMINI_MODEL];
  let lastError: unknown;

  for (const modelName of modelsToTry) {
    const maxAttempts = 2;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await ai.models.generateContentStream({
          model: modelName,
          contents,
          config: {
            systemInstruction,
            ...(modelName === 'gemini-4-hydrogen'
              ? { thinkingConfig: { thinkingLevel: ThinkingLevel.LOW } }
              : {}),
          },
        });
      } catch (err: unknown) {
        lastError = err;
        const status = (err as { status?: number })?.status;
        if (isModelNotFoundError(err)) {
          break; // Try fallback model
        }
        const retryable = status === 429 || status === 500 || status === 502 || status === 503 || status === 504;
        if (!retryable || attempt === maxAttempts) {
          throw err;
        }
        await sleep(300 * Math.pow(2, attempt - 1));
      }
    }
  }

  throw lastError;
}

async function generateOnceWithFallback(
  ai: GoogleGenAI,
  systemInstruction: string,
  contents: Content[]
) {
  const modelsToTry = [GEMINI_MODEL, FALLBACK_GEMINI_MODEL];
  let lastError: unknown;

  for (const modelName of modelsToTry) {
    try {
      return await ai.models.generateContent({
        model: modelName,
        contents,
        config: {
          systemInstruction,
          ...(modelName === 'gemini-4-hydrogen'
            ? { thinkingConfig: { thinkingLevel: ThinkingLevel.LOW } }
            : {}),
        },
      });
    } catch (err: unknown) {
      lastError = err;
      if (isModelNotFoundError(err)) {
        continue;
      }
      throw err;
    }
  }

  throw lastError;
}

function classifyGeminiError(err: unknown): { status: number; message: string } {
  console.error('[SupportChat Gemini Error]', err);
  const rawMessage = (err as { message?: string })?.message || 'Unexpected AI service error.';
  const status = (err as { status?: number })?.status;

  if (status === 400 || rawMessage.includes('API_KEY_INVALID')) {
    return {
      status: 400,
      message: 'AI service configuration needs a valid Gemini API key in Settings > Secrets.',
    };
  }
  if (status === 403 || rawMessage.includes('PERMISSION_DENIED')) {
    return {
      status: 403,
      message: 'AI service permission denied. Please verify your Gemini API key in Settings > Secrets.',
    };
  }
  if (status === 429 || rawMessage.includes('RESOURCE_EXHAUSTED')) {
    return {
      status: 429,
      message: 'AI support is handling high traffic right now. Please retry in a few seconds.',
    };
  }
  return {
    status: 500,
    message: 'Unable to reach AI Support right now. Please try again shortly.',
  };
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '16mb' }));

  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({
      ok: true,
      service: 'microearnbd-support-api',
      model: GEMINI_MODEL,
      multimodal: true,
    });
  });

  app.post('/api/support-chat', async (req: Request, res: Response) => {
    const clientIp = req.ip || req.socket.remoteAddress || 'unknown';
    if (!checkRateLimit(clientIp)) {
      res.status(429).json({ error: 'Too many requests. Please wait a moment before sending another message.' });
      return;
    }

    const body = req.body as {
      messages?: unknown;
      context?: SupportContextPayload;
      stream?: boolean;
    };

    if (!Array.isArray(body?.messages) || body.messages.length === 0) {
      res.status(400).json({ error: 'At least one chat message is required.' });
      return;
    }

    const sanitizedTurns: ChatHistoryTurn[] = body.messages
      .filter((item): item is { role: unknown; text: unknown; attachments?: unknown } =>
        Boolean(item && typeof item === 'object')
      )
      .map((item): ChatHistoryTurn => ({
        role: item.role === 'model' ? 'model' : 'user',
        text: typeof item.text === 'string' ? item.text.trim().slice(0, 3000) : '',
        attachments: Array.isArray(item.attachments)
          ? (item.attachments as ChatAttachmentInput[])
          : undefined,
      }))
      .filter(item => item.text.length > 0 || (item.attachments && item.attachments.length > 0))
      .slice(-12);

    if (sanitizedTurns.length === 0 || sanitizedTurns[sanitizedTurns.length - 1].role !== 'user') {
      res.status(400).json({ error: 'The latest message must be a user message or attachment.' });
      return;
    }

    const ai = getGeminiClient();
    if (!ai) {
      res.status(503).json({
        error: 'AI Support Assistant needs a GEMINI_API_KEY configured in Settings > Secrets (or server environment variables).',
      });
      return;
    }

    const contents = buildContentsFromHistory(sanitizedTurns);
    if (contents.length === 0) {
      res.status(400).json({ error: 'No valid message content or supported attachment found.' });
      return;
    }

    const systemInstruction = buildContextualSystemInstruction(body.context);
    const wantsStream = body.stream !== false;

    if (!wantsStream) {
      try {
        const result = await generateOnceWithFallback(ai, systemInstruction, contents);
        res.json({ text: result.text ?? '' });
      } catch (err: unknown) {
        const mapped = classifyGeminiError(err);
        res.status(mapped.status).json({ error: mapped.message });
      }
      return;
    }

    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    let clientClosed = false;
    req.on('close', () => {
      clientClosed = true;
    });

    try {
      const stream = await createStreamWithRetry(ai, systemInstruction, contents);
      for await (const chunk of stream) {
        if (clientClosed) break;
        const delta = chunk.text;
        if (delta) {
          res.write(`data: ${JSON.stringify({ text: delta })}\n\n`);
        }
      }
      if (!clientClosed) {
        res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
        res.end();
      }
    } catch (err: unknown) {
      const mapped = classifyGeminiError(err);
      if (!clientClosed) {
        res.write(`data: ${JSON.stringify({ error: mapped.message })}\n\n`);
        res.end();
      }
    }
  });

  if (IS_PRODUCTION) {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('/{*splat}', (_req: Request, res: Response) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  } else {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`MicroEarn BD server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch(err => {
  console.error('Failed to start MicroEarn BD server:', err);
  process.exit(1);
});

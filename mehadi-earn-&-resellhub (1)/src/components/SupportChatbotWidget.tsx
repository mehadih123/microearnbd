import React, { useState, useRef, useEffect } from 'react';
import {
  MessageCircle,
  Send,
  Trash2,
  ShieldCheck,
  Briefcase,
  Coins,
  Lock,
  AlertCircle,
  Bot,
  User as UserIcon,
  Square,
  Paperclip,
  FileText,
  Copy,
  Check,
  X,
  ImagePlus
} from 'lucide-react';
import { AppTab, Language, UserAccount } from '../types';
import { playSound } from '../utils/audio';

interface ChatAttachment {
  id: string;
  name: string;
  mimeType: string;
  data: string; // raw base64 without data: prefix
  previewUrl?: string; // data URL for image preview
  sizeLabel: string;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: string;
  attachments?: ChatAttachment[];
  isError?: boolean;
}

interface SupportChatbotWidgetProps {
  language: Language;
  currentUser: UserAccount | null;
  activeTab: AppTab;
  balance: number;
  coins: number;
  pendingEscrowBalance: number;
  activeJobsCount: number;
  publishedProductsCount: number;
  isOpenExternal?: boolean;
  onOpenChange?: (open: boolean) => void;
}

const SESSION_STORAGE_KEY = 'microearnbd_support_chat_v2';
const MAX_ATTACHMENTS_PER_MSG = 3;
const MAX_RAW_FILE_BYTES = 4 * 1024 * 1024; // 4MB

const SUPPORTED_MIME_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
  'image/gif',
  'application/pdf',
  'text/plain',
  'text/csv',
  'text/markdown',
  'application/json'
]);

function formatTime(): string {
  return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function readFileAsBase64(file: File): Promise<{ base64: string; dataUrl: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      const commaIndex = result.indexOf(',');
      if (commaIndex === -1) {
        reject(new Error('Invalid file encoding.'));
        return;
      }
      resolve({
        dataUrl: result,
        base64: result.slice(commaIndex + 1)
      });
    };
    reader.onerror = () => reject(new Error('Failed to read attached file.'));
    reader.readAsDataURL(file);
  });
}

async function compressImageIfNeeded(file: File): Promise<{ base64: string; dataUrl: string; mimeType: string }> {
  const { base64, dataUrl } = await readFileAsBase64(file);
  // Keep smaller images & GIFs untouched for crisp OCR of TrxIDs/text
  if (file.type === 'image/gif' || file.size <= 1.2 * 1024 * 1024) {
    return {
      base64,
      dataUrl,
      mimeType: file.type === 'image/jpg' ? 'image/jpeg' : file.type
    };
  }

  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => {
      const maxDim = 1600;
      let { width, height } = img;
      if (width > maxDim || height > maxDim) {
        const scale = Math.min(maxDim / width, maxDim / height);
        width = Math.round(width * scale);
        height = Math.round(height * scale);
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve({ base64, dataUrl, mimeType: file.type || 'image/jpeg' });
        return;
      }
      ctx.drawImage(img, 0, 0, width, height);
      const compressedUrl = canvas.toDataURL('image/jpeg', 0.85);
      const idx = compressedUrl.indexOf(',');
      resolve({
        dataUrl: compressedUrl,
        base64: idx !== -1 ? compressedUrl.slice(idx + 1) : base64,
        mimeType: 'image/jpeg'
      });
    };
    img.onerror = () => resolve({ base64, dataUrl, mimeType: file.type || 'image/jpeg' });
    img.src = dataUrl;
  });
}

function renderInlineFormatting(text: string): React.ReactNode[] {
  const tokens = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return tokens.map((token, idx) => {
    if (token.startsWith('**') && token.endsWith('**') && token.length > 4) {
      return (
        <strong key={idx} className="font-bold text-slate-900 dark:text-white">
          {token.slice(2, -2)}
        </strong>
      );
    }
    if (token.startsWith('`') && token.endsWith('`') && token.length > 2) {
      return (
        <code
          key={idx}
          className="px-1.5 py-0.5 rounded bg-slate-200/80 dark:bg-slate-800 font-mono text-[11px] text-emerald-700 dark:text-emerald-300"
        >
          {token.slice(1, -1)}
        </code>
      );
    }
    return <React.Fragment key={idx}>{token}</React.Fragment>;
  });
}

function FormattedMessageBody({ text, isUser }: { text: string; isUser: boolean }) {
  if (isUser) {
    return <p className="whitespace-pre-wrap break-words leading-relaxed">{text}</p>;
  }

  const lines = text.split('\n');
  return (
    <div className="space-y-1.5 leading-relaxed break-words">
      {lines.map((line, i) => {
        const trimmed = line.trim();
        if (!trimmed) {
          return <div key={i} className="h-1" />;
        }

        const bulletMatch = trimmed.match(/^([*\-•]|\d+\.)\s+(.*)$/);
        if (bulletMatch) {
          return (
            <div key={i} className="flex items-start gap-2 pl-0.5">
              <span className="text-emerald-600 dark:text-emerald-400 font-bold shrink-0 select-none">
                {bulletMatch[1] === '*' || bulletMatch[1] === '-' ? '•' : bulletMatch[1]}
              </span>
              <span>{renderInlineFormatting(bulletMatch[2])}</span>
            </div>
          );
        }

        const headingMatch = trimmed.match(/^#{1,3}\s+(.*)$/);
        if (headingMatch) {
          return (
            <div key={i} className="font-extrabold text-slate-900 dark:text-white pt-1">
              {renderInlineFormatting(headingMatch[1])}
            </div>
          );
        }

        return <p key={i}>{renderInlineFormatting(trimmed)}</p>;
      })}
    </div>
  );
}

export const SupportChatbotWidget: React.FC<SupportChatbotWidgetProps> = ({
  language,
  currentUser,
  activeTab,
  balance,
  coins,
  pendingEscrowBalance,
  activeJobsCount,
  publishedProductsCount,
  isOpenExternal,
  onOpenChange
}) => {
  const isBn = language === 'bn';
  const [internalOpen, setInternalOpen] = useState(false);
  const isOpen = isOpenExternal !== undefined ? isOpenExternal : internalOpen;

  const setOpen = (next: boolean) => {
    setInternalOpen(next);
    if (onOpenChange) onOpenChange(next);
  };

  const getWelcomeMessage = (bn: boolean): ChatMessage => ({
    id: 'welcome',
    role: 'model',
    timestamp: formatTime(),
    text: bn
      ? 'আসসালামু আলাইকুম! আমি **MicroEarn BD AI অ্যাসিস্ট্যান্ট** (Gemini Multimodal)।\n\n• **তাৎক্ষণিক সাপোর্ট ও স্ক্রিনশট বিশ্লেষণ**: পেমেন্ট TrxID স্ক্রিনশট, এরর মেসেজ বা কাজের প্রমাণ আপলোড করে দ্রুত সমাধান নিন।\n• **আর্নিং ও উইথড্র গাইড**: ম্যাথ, কুইজ, ক্যাপচা, রিসেলিং এস্ক্রো, গিফট কোড ও বিকাশ ক্যাশআউটের সঠিক নিয়ম জানুন।\n• **বিজনেস ও সুরক্ষা পরামর্শ**: বাংলাদেশে বৈধ অনলাইন ব্যবসা এবং স্ক্যাম প্রতিরোধের উপায় জানুন।'
      : 'Hello! I am the **MicroEarn BD Multimodal AI Assistant**.\n\n• **Visual Troubleshooting**: Attach payment TrxID screenshots, error screens, or task proofs using the clip button for instant guidance.\n• **Platform Guide**: Verified rules on Math/Quiz/Captcha tasks, coin conversion, reselling escrow, gift codes, and bKash cashouts.\n• **Business & Security**: Practical Bangladesh online business ideas and anti-scam tips.'
  });

  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    try {
      const saved = sessionStorage.getItem(SESSION_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as ChatMessage[];
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch {
      // Ignore storage error
    }
    return [getWelcomeMessage(isBn)];
  });

  const [input, setInput] = useState('');
  const [pendingAttachments, setPendingAttachments] = useState<ChatAttachment[]>([]);
  const [attachmentError, setAttachmentError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [copiedMsgId, setCopiedMsgId] = useState<string | null>(null);
  const [lastFailedSubmission, setLastFailedSubmission] = useState<{
    text: string;
    attachments: ChatAttachment[];
  } | null>(null);

  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Track mobile visualViewport so soft keyboard never hides header Close (×) or input bar
  const [mobileViewportStyle, setMobileViewportStyle] = useState<React.CSSProperties | undefined>(
    undefined
  );

  useEffect(() => {
    if (typeof document === 'undefined') return;
    if (isOpen) {
      document.body.classList.add('ai-chat-open');
    } else {
      document.body.classList.remove('ai-chat-open');
    }
    return () => {
      document.body.classList.remove('ai-chat-open');
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || typeof window === 'undefined') {
      setMobileViewportStyle(undefined);
      return;
    }

    const updateViewportMetrics = () => {
      if (window.innerWidth >= 640) {
        setMobileViewportStyle(undefined);
        return;
      }

      const vv = window.visualViewport;
      if (vv) {
        const topOffset = Math.max(8, Math.round(vv.offsetTop) + 8);
        const maxHeight = Math.max(280, Math.round(vv.height) - 16);
        setMobileViewportStyle({
          top: `${topOffset}px`,
          height: `${maxHeight}px`,
          maxHeight: `${maxHeight}px`,
          bottom: 'auto',
        });
      } else {
        setMobileViewportStyle(undefined);
      }
    };

    updateViewportMetrics();
    window.addEventListener('resize', updateViewportMetrics);
    window.visualViewport?.addEventListener('resize', updateViewportMetrics);
    window.visualViewport?.addEventListener('scroll', updateViewportMetrics);

    return () => {
      window.removeEventListener('resize', updateViewportMetrics);
      window.visualViewport?.removeEventListener('resize', updateViewportMetrics);
      window.visualViewport?.removeEventListener('scroll', updateViewportMetrics);
    };
  }, [isOpen]);

  useEffect(() => {
    setMessages(prev => {
      if (prev.length === 1 && prev[0].id === 'welcome') {
        return [getWelcomeMessage(isBn)];
      }
      return prev;
    });
  }, [isBn]);

  useEffect(() => {
    try {
      // Persist text turns cleanly without bloated base64 blobs
      const lightweight = messages.slice(-16).map(m => ({
        ...m,
        attachments: m.attachments?.map(a => ({
          id: a.id,
          name: a.name,
          mimeType: a.mimeType,
          data: '',
          sizeLabel: a.sizeLabel
        }))
      }));
      sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(lightweight));
    } catch {
      // Ignore quota errors
    }
  }, [messages]);

  useEffect(() => {
    if (isOpen && scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
    }
  }, [messages, isOpen, isStreaming, pendingAttachments]);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 120);
    }
  }, [isOpen]);

  const quickPrompts = isBn
    ? [
        {
          id: 'withdraw',
          label: 'উইথড্রয়াল নিয়ম ও ফি',
          prompt: 'MicroEarn BD-তে টাকা তোলার সর্বনিম্ন সীমা, ফি এবং বিকাশ উইথড্রয়াল নিয়ম বিস্তারিত বলুন।',
          icon: Coins
        },
        {
          id: 'tasks',
          label: 'কয়েন ও টাস্ক থেকে আয়',
          prompt: 'ম্যাথ, কুইজ, ক্যাপচা এবং মাইক্রো-জব থেকে কীভাবে আয় হয় এবং কয়েন কনভার্টের নিয়ম কী?',
          icon: ShieldCheck
        },
        {
          id: 'business',
          label: 'বাংলাদেশে অনলাইন ব্যবসার আইডিয়া',
          prompt: 'বাংলাদেশে কম পুঁজিতে শুরু করা যায় এমন ৩টি বাস্তবসম্মত ও বৈধ অনলাইন ব্যবসা বা স্টার্টআপ মডেল সাজেস্ট করুন।',
          icon: Briefcase
        },
        {
          id: 'security',
          label: 'অ্যাকাউন্ট সুরক্ষা ও স্ক্যাম প্রতিরোধ',
          prompt: 'অনলাইন আর্নিংয়ে প্রতারণা বা ফেক পেমেন্ট স্ক্যাম থেকে বাঁচতে কী কী সতর্কতা মেনে চলা উচিত?',
          icon: Lock
        }
      ]
    : [
        {
          id: 'withdraw',
          label: 'Withdrawal Rules & Fees',
          prompt: 'Explain the minimum withdrawal limit, fees, and bKash cashout verification steps on MicroEarn BD.',
          icon: Coins
        },
        {
          id: 'tasks',
          label: 'Coins & Task Earnings',
          prompt: 'How do Math, Quiz, Captcha, Micro-Jobs, and the 1,000 coins = ৳1 BDT conversion work?',
          icon: ShieldCheck
        },
        {
          id: 'business',
          label: 'BD Business Ideas',
          prompt: 'Suggest 3 practical, legal, low-investment online business or startup models suited for Bangladesh.',
          icon: Briefcase
        },
        {
          id: 'security',
          label: 'Account & Scam Safety',
          prompt: 'What security practices protect my MicroEarn BD account from phishing and fake payment scams?',
          icon: Lock
        }
      ];

  const handleFilesSelected = async (fileList: FileList | File[] | null) => {
    if (!fileList || fileList.length === 0) return;
    setAttachmentError(null);

    const files = Array.from(fileList);
    const availableSlots = MAX_ATTACHMENTS_PER_MSG - pendingAttachments.length;
    if (availableSlots <= 0) {
      setAttachmentError(
        isBn
          ? `একসাথে সর্বোচ্চ ${MAX_ATTACHMENTS_PER_MSG}টি ফাইল/ছবি যুক্ত করা যাবে।`
          : `Maximum ${MAX_ATTACHMENTS_PER_MSG} attachments allowed per message.`
      );
      return;
    }

    const nextAttachments: ChatAttachment[] = [];

    for (const file of files.slice(0, availableSlots)) {
      const normalizedType =
        file.type ||
        (file.name.endsWith('.txt')
          ? 'text/plain'
          : file.name.endsWith('.csv')
            ? 'text/csv'
            : file.name.endsWith('.json')
              ? 'application/json'
              : file.name.endsWith('.md')
                ? 'text/markdown'
                : '');

      if (!SUPPORTED_MIME_TYPES.has(normalizedType.toLowerCase())) {
        setAttachmentError(
          isBn
            ? `"${file.name}" সাপোর্টেড নয়। ছবি (PNG/JPG/WEBP), PDF অথবা TXT/CSV ফাইল দিন।`
            : `"${file.name}" is unsupported. Please attach PNG/JPG/WEBP images, PDF, or TXT/CSV files.`
        );
        continue;
      }

      if (file.size > MAX_RAW_FILE_BYTES) {
        setAttachmentError(
          isBn
            ? `"${file.name}" ৪ MB-এর বেশি। অনুগ্রহ করে অপেক্ষাকৃত ছোট ফাইল দিন।`
            : `"${file.name}" exceeds 4 MB limit.`
        );
        continue;
      }

      try {
        if (normalizedType.startsWith('image/')) {
          const compressed = await compressImageIfNeeded(file);
          nextAttachments.push({
            id: `att-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            name: file.name,
            mimeType: compressed.mimeType,
            data: compressed.base64,
            previewUrl: compressed.dataUrl,
            sizeLabel: formatBytes(file.size)
          });
        } else {
          const read = await readFileAsBase64(file);
          nextAttachments.push({
            id: `att-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            name: file.name,
            mimeType: normalizedType,
            data: read.base64,
            sizeLabel: formatBytes(file.size)
          });
        }
      } catch {
        setAttachmentError(
          isBn ? `"${file.name}" পড়া সম্ভব হয়নি।` : `Failed to process "${file.name}".`
        );
      }
    }

    if (nextAttachments.length > 0) {
      playSound('click');
      setPendingAttachments(prev => [...prev, ...nextAttachments].slice(0, MAX_ATTACHMENTS_PER_MSG));
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    const pastedFiles: File[] = [];
    for (const item of Array.from(items)) {
      if (item.kind === 'file') {
        const f = item.getAsFile();
        if (f) pastedFiles.push(f);
      }
    }
    if (pastedFiles.length > 0) {
      e.preventDefault();
      void handleFilesSelected(pastedFiles);
    }
  };

  const stopGeneration = () => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    setIsStreaming(false);
  };

  const handleClearChat = () => {
    playSound('click');
    stopGeneration();
    setLastFailedSubmission(null);
    setPendingAttachments([]);
    setAttachmentError(null);
    const fresh = [getWelcomeMessage(isBn)];
    setMessages(fresh);
    try {
      sessionStorage.removeItem(SESSION_STORAGE_KEY);
    } catch {
      // Ignore
    }
  };

  const handleCopyMessage = async (msgId: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      playSound('click');
      setCopiedMsgId(msgId);
      setTimeout(() => {
        setCopiedMsgId(prev => (prev === msgId ? null : prev));
      }, 2000);
    } catch {
      // Ignore clipboard failure
    }
  };

  const sendPrompt = async (rawPrompt: string, explicitAttachments?: ChatAttachment[]) => {
    const trimmed = rawPrompt.trim();
    const attachmentsToSend = explicitAttachments ?? pendingAttachments;
    if ((!trimmed && attachmentsToSend.length === 0) || isStreaming) return;

    playSound('click');
    setLastFailedSubmission(null);
    setAttachmentError(null);
    setInput('');
    if (!explicitAttachments) {
      setPendingAttachments([]);
    }

    const displayPrompt =
      trimmed ||
      (isBn
        ? 'এই সংযুক্ত ছবি/ফাইলটি বিশ্লেষণ করে সমাধান দিন।'
        : 'Please analyze the attached image/file and help me.');

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      text: displayPrompt,
      attachments: attachmentsToSend.length > 0 ? attachmentsToSend : undefined,
      timestamp: formatTime()
    };

    const assistantMsgId = `bot-${Date.now() + 1}`;
    const placeholderAssistantMsg: ChatMessage = {
      id: assistantMsgId,
      role: 'model',
      text: '',
      timestamp: formatTime()
    };

    // Only send active base64 attachments for recent turns that actually hold data
    const historyForApi = [...messages, userMsg]
      .filter(m => m.id !== 'welcome' && !m.isError)
      .slice(-12)
      .map(m => ({
        role: m.role,
        text: m.text,
        attachments: m.attachments
          ?.filter(a => Boolean(a.data))
          .map(a => ({
            name: a.name,
            mimeType: a.mimeType,
            data: a.data
          }))
      }));

    setMessages(prev => [...prev, userMsg, placeholderAssistantMsg]);
    setIsStreaming(true);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const response = await fetch('/api/support-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          stream: true,
          messages: historyForApi,
          context: {
            isAuthenticated: Boolean(currentUser),
            language,
            activeTab,
            balance: currentUser ? balance : undefined,
            coins: currentUser ? coins : undefined,
            pendingEscrowBalance: currentUser ? pendingEscrowBalance : undefined,
            referralsCount: currentUser?.referralsCount || 0,
            activeJobsCount,
            publishedProductsCount
          }
        })
      });

      if (!response.ok) {
        let errText = isBn
          ? 'সাপোর্ট সার্ভারে সাময়িক সমস্যা হয়েছে। অনুগ্রহ করে আবার চেষ্টা করুন।'
          : 'Unable to reach AI Support right now. Please try again.';
        try {
          const errJson = (await response.json()) as { error?: string };
          if (errJson?.error) errText = errJson.error;
        } catch {
          // Use default message
        }
        throw new Error(errText);
      }

      const contentType = (response.headers.get('content-type') || '').toLowerCase();
      if (contentType.includes('text/html')) {
        throw new Error(
          isBn
            ? 'সাপোর্ট API ফাংশনটি এই স্ট্যাটিক হোস্টে সক্রিয় নেই। Netlify Functions (netlify.toml সহ ডিপ্লয়) বা Node সার্ভার ব্যবহার করুন।'
            : 'Support API route returned HTML instead of AI response. Deploy with Netlify Functions (netlify.toml) or the Node server with GEMINI_API_KEY set.'
        );
      }

      if (contentType.includes('application/json')) {
        const json = (await response.json()) as { text?: string; error?: string };
        if (json.error) throw new Error(json.error);
        if (!json.text?.trim()) {
          throw new Error(
            isBn ? 'উত্তর তৈরি করা যায়নি। আবার চেষ্টা করুন।' : 'Empty response received. Please retry.'
          );
        }
        setMessages(prev =>
          prev.map(m => (m.id === assistantMsgId ? { ...m, text: json.text || '' } : m))
        );
        playSound('success');
        return;
      }

      if (!response.body) {
        throw new Error(
          isBn ? 'রেসপন্স স্ট্রিম পাওয়া যায়নি।' : 'Empty response stream from support server.'
        );
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let sseBuffer = '';
      let accumulated = '';

      const processEventBlock = (eventBlock: string) => {
        const dataLines = eventBlock
          .split('\n')
          .filter(l => l.startsWith('data:'))
          .map(l => l.slice(5).trim());

        for (const jsonLine of dataLines) {
          if (!jsonLine) continue;
          let parsed: { text?: string; error?: string; done?: boolean } | null = null;
          try {
            parsed = JSON.parse(jsonLine) as { text?: string; error?: string; done?: boolean };
          } catch {
            continue;
          }

          if (parsed.error) {
            throw new Error(parsed.error);
          }
          if (parsed.text) {
            accumulated += parsed.text;
            setMessages(prev =>
              prev.map(m => (m.id === assistantMsgId ? { ...m, text: accumulated } : m))
            );
          }
        }
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        sseBuffer += decoder.decode(value, { stream: true });
        const events = sseBuffer.split('\n\n');
        sseBuffer = events.pop() || '';

        for (const eventBlock of events) {
          processEventBlock(eventBlock);
        }
      }

      if (sseBuffer.trim()) {
        processEventBlock(sseBuffer);
      }

      if (!accumulated.trim()) {
        throw new Error(
          isBn
            ? 'উত্তর তৈরি করা যায়নি। অনুগ্রহ করে প্রশ্নটি পুনরায় পাঠান।'
            : 'No response generated. Please send your question again.'
        );
      }
      playSound('success');
    } catch (err: unknown) {
      if ((err as { name?: string })?.name === 'AbortError') {
        setMessages(prev =>
          prev.map(m =>
            m.id === assistantMsgId && !m.text.trim()
              ? { ...m, text: isBn ? 'উত্তর বাতিল করা হয়েছে।' : 'Response stopped.' }
              : m
          )
        );
      } else {
        playSound('error');
        const msg =
          (err as Error)?.message ||
          (isBn
            ? 'নেটওয়ার্ক সমস্যার কারণে উত্তর পাওয়া যায়নি।'
            : 'Network error while reaching AI Support.');
        setLastFailedSubmission({ text: displayPrompt, attachments: attachmentsToSend });
        setMessages(prev =>
          prev.map(m => (m.id === assistantMsgId ? { ...m, text: msg, isError: true } : m))
        );
      }
    } finally {
      abortControllerRef.current = null;
      setIsStreaming(false);
    }
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void sendPrompt(input);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void sendPrompt(input);
    }
  };

  const launcherPositionClass = currentUser
    ? 'bottom-24 right-3.5 md:bottom-6 md:right-6'
    : 'bottom-6 right-3.5 md:bottom-6 md:right-6';

  return (
    <>
      {/* Floating Gemini-Style Assistant Launcher */}
      {!isOpen && (
        <button
          type="button"
          onClick={() => {
            playSound('click');
            setOpen(true);
          }}
          aria-label={isBn ? 'AI সাপোর্ট চ্যাট খুলুন' : 'Open AI Support Chat'}
          className={`fixed ${launcherPositionClass} z-40 h-12 px-4 rounded-2xl bg-slate-900 hover:bg-emerald-700 dark:bg-emerald-600 dark:hover:bg-emerald-500 text-white shadow-xl shadow-slate-900/20 dark:shadow-emerald-950/40 border border-slate-700/60 dark:border-emerald-400/40 flex items-center gap-2 cursor-pointer transition-all duration-200 hover:-translate-y-0.5 active:scale-95`}
        >
          <MessageCircle className="w-5 h-5 shrink-0" />
          <span className="text-xs sm:text-sm font-bold whitespace-nowrap">
            {isBn ? 'AI সাপোর্ট' : 'AI Support'}
          </span>
        </button>
      )}

      {/* Mobile Scrim Backdrop when Chat is Open */}
      {isOpen && (
        <div
          aria-hidden="true"
          onClick={() => {
            playSound('click');
            stopGeneration();
            setOpen(false);
          }}
          className="fixed inset-0 z-[55] bg-slate-950/45 backdrop-blur-[2px] sm:hidden"
        />
      )}

      {/* Gemini-Style Multimodal Chat Panel (Visual-Viewport & Keyboard Safe on Mobile + Anchored on Desktop) */}
      {isOpen && (
        <aside
          role="dialog"
          aria-modal="false"
          aria-label={isBn ? 'MicroEarn BD AI সাপোর্ট অ্যাসিস্ট্যান্ট' : 'MicroEarn BD AI Support Assistant'}
          style={mobileViewportStyle}
          onDragOver={e => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={e => {
            e.preventDefault();
            setIsDragging(false);
            void handleFilesSelected(e.dataTransfer.files);
          }}
          className={`fixed z-[60] inset-x-2.5 top-3 h-[calc(100dvh-1.5rem)] max-h-[calc(100dvh-1.5rem)] sm:top-auto sm:inset-auto sm:bottom-6 sm:right-6 sm:w-[420px] lg:w-[440px] sm:h-[min(620px,calc(100dvh-3rem))] sm:max-h-[calc(100dvh-3rem)] bg-white dark:bg-slate-900 rounded-2xl sm:rounded-3xl border ${
            isDragging
              ? 'border-emerald-500 ring-2 ring-emerald-500/40'
              : 'border-slate-200 dark:border-slate-800'
          } shadow-2xl flex flex-col overflow-hidden animate-in fade-in duration-200`}
        >
          {/* Sticky Top Header — Close (×) button always visible & unobstructed */}
          <div className="px-3.5 sm:px-4 py-2.5 sm:py-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 flex items-center justify-between gap-2 shrink-0">
            <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1">
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl sm:rounded-2xl bg-emerald-600 text-white flex items-center justify-center shrink-0">
                <Bot className="w-5 h-5" />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="font-extrabold text-sm text-slate-900 dark:text-white truncate">
                  {isBn ? 'MicroEarn BD AI সাপোর্ট' : 'MicroEarn BD AI Support'}
                </h3>
                <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1.5 truncate">
                  <span>{isBn ? 'ছবি ও ফাইল সাপোর্ট' : 'Vision & Docs'}</span>
                  <span aria-hidden="true">·</span>
                  <span>{isBn ? 'বিজনেস ও সুরক্ষা' : 'Business & Safety'}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={handleClearChat}
                className="w-11 h-11 sm:w-10 sm:h-10 rounded-xl sm:rounded-2xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 flex items-center justify-center cursor-pointer transition-colors"
                aria-label={isBn ? 'চ্যাট হিস্ট্রি মুছুন' : 'Clear chat history'}
                title={isBn ? 'চ্যাট পরিষ্কার করুন' : 'Clear History'}
              >
                <Trash2 className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={() => {
                  playSound('click');
                  stopGeneration();
                  setOpen(false);
                }}
                className="w-11 h-11 sm:w-10 sm:h-10 rounded-xl sm:rounded-2xl bg-rose-50 hover:bg-rose-600 text-rose-600 hover:text-white dark:bg-slate-800 dark:hover:bg-rose-600 dark:text-slate-100 border-2 border-rose-200 dark:border-slate-700 font-black text-2xl leading-none flex items-center justify-center transition-all cursor-pointer shadow-sm shrink-0"
                aria-label={isBn ? 'চ্যাটবট বন্ধ করুন' : 'Close Support Chatbot'}
                title={isBn ? 'বন্ধ করুন (×)' : 'Close (×)'}
              >
                &times;
              </button>
            </div>
          </div>

          {/* Logged-in Context Strip */}
          {currentUser && (
            <div className="px-4 py-2 border-b border-slate-100 dark:border-slate-800/80 bg-slate-50/60 dark:bg-slate-950/40 flex items-center justify-between text-[11px] text-slate-600 dark:text-slate-400 tabular-nums shrink-0">
              <span className="truncate font-medium">{currentUser.name}</span>
              <span className="font-mono shrink-0">
                ৳{balance.toFixed(2)} · {coins.toLocaleString()} {isBn ? 'কয়েন' : 'Coins'}
              </span>
            </div>
          )}

          {/* Drag Overlay */}
          {isDragging && (
            <div className="px-4 py-2 bg-emerald-50 dark:bg-emerald-950/60 border-b border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 text-xs font-bold flex items-center justify-center gap-2 shrink-0">
              <ImagePlus className="w-4 h-4" />
              <span>{isBn ? 'ছবি বা ডকুমেন্ট এখানে ছেড়ে দিন' : 'Drop images or documents here'}</span>
            </div>
          )}

          {/* Message Feed */}
          <div
            ref={scrollContainerRef}
            className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-3.5 sm:px-4 py-3.5 sm:py-4 space-y-4 bg-white dark:bg-slate-950/60"
          >
            {messages.map(msg => {
              const isUser = msg.role === 'user';
              const isCopied = copiedMsgId === msg.id;

              return (
                <div
                  key={msg.id}
                  className={`flex items-start gap-2.5 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}
                >
                  <div
                    className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
                      isUser
                        ? 'bg-slate-900 text-white dark:bg-slate-700'
                        : msg.isError
                          ? 'bg-rose-100 text-rose-600 dark:bg-rose-950 dark:text-rose-400'
                          : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/80 dark:text-emerald-300'
                    }`}
                  >
                    {isUser ? (
                      <UserIcon className="w-4 h-4" />
                    ) : msg.isError ? (
                      <AlertCircle className="w-4 h-4" />
                    ) : (
                      <Bot className="w-4 h-4" />
                    )}
                  </div>

                  <div
                    className={`max-w-[83%] min-w-0 rounded-2xl px-3.5 py-2.5 text-[13px] leading-relaxed ${
                      isUser
                        ? 'bg-emerald-600 text-white'
                        : msg.isError
                          ? 'bg-rose-50 dark:bg-rose-950/30 text-rose-800 dark:text-rose-200 border border-rose-200 dark:border-rose-800/60'
                          : 'bg-slate-100 dark:bg-slate-900 text-slate-800 dark:text-slate-200 border border-slate-200/80 dark:border-slate-800'
                    }`}
                  >
                    {/* User Uploaded Attachments */}
                    {msg.attachments && msg.attachments.length > 0 && (
                      <div className="mb-2 flex flex-wrap gap-2">
                        {msg.attachments.map(att =>
                          att.previewUrl ? (
                            <img
                              key={att.id}
                              src={att.previewUrl}
                              alt={att.name}
                              className="max-h-36 max-w-full rounded-xl object-cover border border-white/25"
                            />
                          ) : (
                            <div
                              key={att.id}
                              className="px-2.5 py-1.5 rounded-xl bg-black/15 text-[11px] font-medium flex items-center gap-1.5 max-w-full"
                            >
                              <FileText className="w-3.5 h-3.5 shrink-0" />
                              <span className="truncate">{att.name}</span>
                            </div>
                          )
                        )}
                      </div>
                    )}

                    {msg.text ? (
                      <FormattedMessageBody text={msg.text} isUser={isUser} />
                    ) : (
                      <div className="flex items-center gap-1.5 py-1" aria-label="Typing">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 dark:bg-emerald-400 animate-bounce [animation-delay:-0.2s]" />
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 dark:bg-emerald-400 animate-bounce [animation-delay:-0.1s]" />
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 dark:bg-emerald-400 animate-bounce" />
                        <span className="ml-1.5 text-[11px] text-slate-500 dark:text-slate-400">
                          {isBn ? 'উত্তর লিখছে...' : 'Thinking...'}
                        </span>
                      </div>
                    )}

                    <div
                      className={`mt-1.5 flex items-center justify-between gap-3 text-[10px] tabular-nums ${
                        isUser ? 'text-emerald-100' : 'text-slate-400 dark:text-slate-500'
                      }`}
                    >
                      <span>{msg.timestamp}</span>
                      {!isUser && msg.text && !msg.isError && (
                        <button
                          type="button"
                          onClick={() => void handleCopyMessage(msg.id, msg.text)}
                          className="inline-flex items-center gap-1 hover:text-emerald-600 dark:hover:text-emerald-400 cursor-pointer transition-colors py-0.5 px-1 rounded"
                          aria-label={isBn ? 'বার্তা কপি করুন' : 'Copy message'}
                        >
                          {isCopied ? (
                            <>
                              <Check className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                              <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                                {isBn ? 'কপি হয়েছে' : 'Copied'}
                              </span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3 h-3" />
                              <span>{isBn ? 'কপি' : 'Copy'}</span>
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Retry on Error */}
            {lastFailedSubmission && !isStreaming && (
              <div className="flex justify-center">
                <button
                  type="button"
                  onClick={() =>
                    void sendPrompt(lastFailedSubmission.text, lastFailedSubmission.attachments)
                  }
                  className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 text-white text-xs font-bold cursor-pointer transition-colors"
                >
                  {isBn ? 'আবার চেষ্টা করুন' : 'Retry last message'}
                </button>
              </div>
            )}

            {/* Quick Starter Topic Buttons */}
            {messages.length <= 1 && !isStreaming && (
              <div className="pt-2 space-y-2">
                <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                  {isBn ? 'দ্রুত জিজ্ঞাসা করুন বা স্ক্রিনশট দিন:' : 'Quick prompts or attach a screenshot:'}
                </div>
                <div className="grid grid-cols-1 gap-2">
                  {quickPrompts.map(item => {
                    const Icon = item.icon;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => void sendPrompt(item.prompt)}
                        className="w-full text-left px-3 py-2.5 rounded-xl bg-slate-50 hover:bg-emerald-50 dark:bg-slate-900 dark:hover:bg-emerald-950/30 border border-slate-200 dark:border-slate-800 hover:border-emerald-400 dark:hover:border-emerald-700 text-xs font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-2.5 cursor-pointer transition-colors"
                      >
                        <Icon className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                        <span className="truncate">{item.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Pending Attachments Preview Bar */}
          {(pendingAttachments.length > 0 || attachmentError) && (
            <div className="px-3 pt-2.5 pb-1.5 border-t border-slate-100 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/90 space-y-1.5 shrink-0">
              {attachmentError && (
                <div className="text-[11px] text-rose-600 dark:text-rose-400 font-semibold flex items-center gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  <span>{attachmentError}</span>
                </div>
              )}

              {pendingAttachments.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {pendingAttachments.map(att => (
                    <div
                      key={att.id}
                      className="relative group flex items-center gap-2 p-1.5 pr-7 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs max-w-[190px]"
                    >
                      {att.previewUrl ? (
                        <img
                          src={att.previewUrl}
                          alt={att.name}
                          className="w-9 h-9 rounded-lg object-cover shrink-0"
                        />
                      ) : (
                        <div className="w-9 h-9 rounded-lg bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 flex items-center justify-center shrink-0">
                          <FileText className="w-4 h-4" />
                        </div>
                      )}
                      <div className="min-w-0">
                        <div className="text-[11px] font-semibold text-slate-800 dark:text-slate-200 truncate">
                          {att.name}
                        </div>
                        <div className="text-[10px] text-slate-400 tabular-nums">{att.sizeLabel}</div>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          setPendingAttachments(prev => prev.filter(p => p.id !== att.id))
                        }
                        aria-label={isBn ? 'ফাইল সরান' : 'Remove attachment'}
                        className="absolute top-1 right-1 w-5 h-5 rounded-md bg-slate-100 hover:bg-rose-600 text-slate-600 hover:text-white dark:bg-slate-700 dark:text-slate-300 flex items-center justify-center cursor-pointer transition-colors"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Multimodal Input Composer — Text-base on mobile prevents iOS Safari zoom */}
          <form
            onSubmit={handleFormSubmit}
            className="p-2.5 sm:p-3 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shrink-0"
          >
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/png,image/jpeg,image/webp,image/gif,application/pdf,.txt,.csv,.md,.json"
              className="hidden"
              onChange={e => {
                void handleFilesSelected(e.target.files);
                e.target.value = '';
              }}
            />

            <div className="flex items-end gap-1.5 sm:gap-2">
              <button
                type="button"
                disabled={isStreaming || pendingAttachments.length >= MAX_ATTACHMENTS_PER_MSG}
                onClick={() => {
                  playSound('click');
                  fileInputRef.current?.click();
                }}
                aria-label={isBn ? 'ছবি বা ফাইল যুক্ত করুন' : 'Attach image or file'}
                title={isBn ? 'স্ক্রিনশট, ছবি বা PDF যুক্ত করুন' : 'Attach screenshot, image, or PDF'}
                className="w-11 h-11 sm:w-10 sm:h-10 rounded-xl bg-slate-100 hover:bg-emerald-50 dark:bg-slate-800 dark:hover:bg-emerald-950/60 text-slate-600 hover:text-emerald-700 dark:text-slate-300 dark:hover:text-emerald-300 border border-slate-200 dark:border-slate-700 flex items-center justify-center shrink-0 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <Paperclip className="w-4 h-4" />
              </button>

              <textarea
                ref={inputRef}
                rows={1}
                value={input}
                onChange={e => {
                  setInput(e.target.value);
                  const el = e.target;
                  el.style.height = 'auto';
                  el.style.height = `${Math.min(el.scrollHeight, 96)}px`;
                }}
                onKeyDown={handleKeyDown}
                onPaste={handlePaste}
                maxLength={2000}
                placeholder={
                  isBn
                    ? 'প্রশ্ন লিখুন অথবা স্ক্রিনশট দিন...'
                    : 'Ask anything or attach a screenshot...'
                }
                className="flex-1 min-w-0 resize-none max-h-24 px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-base sm:text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 leading-snug"
              />

              {isStreaming ? (
                <button
                  type="button"
                  onClick={stopGeneration}
                  aria-label={isBn ? 'উত্তর থামান' : 'Stop response'}
                  className="w-11 h-11 sm:w-10 sm:h-10 rounded-xl bg-rose-600 hover:bg-rose-700 text-white flex items-center justify-center shrink-0 cursor-pointer transition-colors"
                >
                  <Square className="w-4 h-4 fill-current" />
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={!input.trim() && pendingAttachments.length === 0}
                  aria-label={isBn ? 'পাঠান' : 'Send message'}
                  className="w-11 h-11 sm:w-10 sm:h-10 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-45 disabled:hover:bg-emerald-600 text-white flex items-center justify-center shrink-0 cursor-pointer disabled:cursor-not-allowed transition-colors"
                >
                  <Send className="w-4 h-4" />
                </button>
              )}
            </div>

            <div className="mt-1.5 text-[10px] text-slate-400 dark:text-slate-500 flex items-center justify-between gap-2">
              <span className="truncate">
                {isBn
                  ? 'PNG/JPG/PDF সাপোর্টেড · পাসওয়ার্ড বা পিন শেয়ার করবেন না'
                  : 'Supports PNG/JPG/PDF · Never share your password or PIN'}
              </span>
              <span className="tabular-nums shrink-0">{input.length}/2000</span>
            </div>
          </form>
        </aside>
      )}
    </>
  );
};

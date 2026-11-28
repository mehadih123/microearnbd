import React, { Component, useState, useRef, useEffect } from 'react';
import {
  Send,
  Trash2,
  AlertCircle,
  Square,
  Paperclip,
  Camera,
  FileText,
  Copy,
  Check,
  X,
  ImagePlus,
  Volume2,
  VolumeX
} from 'lucide-react';
import { AppTab, Language, UserAccount } from '../types';
import { playSound } from '../utils/audio';
import { auth } from '../firebase';

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
const MAX_RAW_FILE_BYTES = 8 * 1024 * 1024; // 8MB raw camera photo limit

const STANDARD_IMAGE_MIMES = new Set([
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
  'image/gif',
]);

const SUPPORTED_MIME_TYPES = new Set([
  ...STANDARD_IMAGE_MIMES,
  'image/heic',
  'image/heif',
  'image/avif',
  'image/bmp',
  'application/pdf',
  'text/plain',
  'text/csv',
  'text/markdown',
  'application/json'
]);

function inferMimeTypeFromFile(file: File): string {
  const direct = (file.type || '').trim().toLowerCase();
  if (direct) {
    return direct === 'image/jpg' ? 'image/jpeg' : direct;
  }
  const lowerName = file.name.trim().toLowerCase();
  if (lowerName.endsWith('.jpg') || lowerName.endsWith('.jpeg')) return 'image/jpeg';
  if (lowerName.endsWith('.png')) return 'image/png';
  if (lowerName.endsWith('.webp')) return 'image/webp';
  if (lowerName.endsWith('.gif')) return 'image/gif';
  if (lowerName.endsWith('.heic')) return 'image/heic';
  if (lowerName.endsWith('.heif')) return 'image/heif';
  if (lowerName.endsWith('.avif')) return 'image/avif';
  if (lowerName.endsWith('.bmp')) return 'image/bmp';
  if (lowerName.endsWith('.pdf')) return 'application/pdf';
  if (lowerName.endsWith('.txt')) return 'text/plain';
  if (lowerName.endsWith('.csv')) return 'text/csv';
  if (lowerName.endsWith('.json')) return 'application/json';
  if (lowerName.endsWith('.md')) return 'text/markdown';
  return '';
}

async function detectMimeTypeWithMagicBytes(file: File): Promise<string> {
  const fromMetadata = inferMimeTypeFromFile(file);
  if (fromMetadata) {
    return fromMetadata;
  }
  try {
    const headerBuf = await file.slice(0, 16).arrayBuffer();
    const bytes = new Uint8Array(headerBuf);
    if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
      return 'image/jpeg';
    }
    if (bytes.length >= 4 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
      return 'image/png';
    }
    if (bytes.length >= 4 && bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x38) {
      return 'image/gif';
    }
    if (
      bytes.length >= 12 &&
      bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
      bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50
    ) {
      return 'image/webp';
    }
    if (bytes.length >= 5 && bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46 && bytes[4] === 0x2d) {
      return 'application/pdf';
    }
    if (bytes.length >= 12 && bytes[4] === 0x66 && bytes[5] === 0x74 && bytes[6] === 0x79 && bytes[7] === 0x70) {
      const brand = String.fromCharCode(bytes[8], bytes[9], bytes[10], bytes[11]).toLowerCase();
      if (brand === 'avif') return 'image/avif';
      if (brand === 'heic' || brand === 'heix' || brand === 'mif1' || brand === 'msf1') return 'image/heic';
    }
  } catch {
    // Ignore slice read failures
  }
  return '';
}

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
      const cleanBase64 = result.slice(commaIndex + 1).replace(/\s+/g, '');
      const prefix = result.slice(0, commaIndex + 1);
      resolve({
        dataUrl: `${prefix}${cleanBase64}`,
        base64: cleanBase64
      });
    };
    reader.onerror = () => reject(new Error('Failed to read attached file.'));
    reader.readAsDataURL(file);
  });
}

const MAX_ATTACHMENT_BASE64_CHARS = 2_800_000;

async function compressImageIfNeeded(
  file: File,
  normalizedMime: string
): Promise<{ base64: string; dataUrl: string; mimeType: string }> {
  const { base64, dataUrl } = await readFileAsBase64(file);
  const safeStandardMime = STANDARD_IMAGE_MIMES.has(normalizedMime)
    ? normalizedMime === 'image/jpg'
      ? 'image/jpeg'
      : normalizedMime
    : '';

  // Keep smaller standard PNG/JPG/WEBP/GIF images untouched for crisp OCR of TrxIDs/text
  if (
    safeStandardMime &&
    base64.length <= MAX_ATTACHMENT_BASE64_CHARS &&
    (safeStandardMime === 'image/gif' || file.size <= 700 * 1024)
  ) {
    return {
      base64,
      dataUrl,
      mimeType: safeStandardMime
    };
  }

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const encodeAt = (maxDim: number, quality: number) => {
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          const scale = Math.min(maxDim / width, maxDim / height);
          width = Math.max(1, Math.round(width * scale));
          height = Math.max(1, Math.round(height * scale));
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return null;

        ctx.drawImage(img, 0, 0, width, height);
        const compressedUrl = canvas.toDataURL('image/jpeg', quality);
        const idx = compressedUrl.indexOf(',');
        const outBase64 = (idx !== -1 ? compressedUrl.slice(idx + 1) : base64).replace(/\s+/g, '');
        return {
          dataUrl: compressedUrl,
          base64: outBase64,
          mimeType: 'image/jpeg'
        };
      };

      const attempts: Array<[number, number]> = [
        [1400, 0.82],
        [1150, 0.72],
        [900, 0.6],
      ];

      let best: { dataUrl: string; base64: string; mimeType: string } | null = null;
      for (const [dim, q] of attempts) {
        const encoded = encodeAt(dim, q);
        if (!encoded) break;
        best = encoded;
        if (encoded.base64.length <= MAX_ATTACHMENT_BASE64_CHARS) {
          resolve(encoded);
          return;
        }
      }

      if (best) {
        resolve(best);
      } else if (safeStandardMime && base64.length <= MAX_ATTACHMENT_BASE64_CHARS) {
        resolve({ base64, dataUrl, mimeType: safeStandardMime });
      } else {
        reject(new Error('Canvas unavailable or image too large'));
      }
    };
    img.onerror = () => {
      if (safeStandardMime && base64.length <= MAX_ATTACHMENT_BASE64_CHARS) {
        resolve({ base64, dataUrl, mimeType: safeStandardMime });
      } else {
        reject(new Error('Unsupported image format'));
      }
    };
    img.src = dataUrl;
  });
}

function renderInlineFormatting(text: string): React.ReactNode[] {
  const tokens = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return tokens.map((token, idx) => {
    if (token.startsWith('**') && token.endsWith('**') && token.length > 4) {
      return (
        <strong key={idx} className="font-semibold text-slate-950 dark:text-white">
          {token.slice(2, -2)}
        </strong>
      );
    }
    if (token.startsWith('`') && token.endsWith('`') && token.length > 2) {
      return (
        <span key={idx} className="font-medium text-slate-950 dark:text-white">
          {token.slice(1, -1)}
        </span>
      );
    }
    return <React.Fragment key={idx}>{token}</React.Fragment>;
  });
}

function FormattedTextSegment({ text }: { text: string }) {
  const lines = text.split('\n');
  return (
    <div className="space-y-3 leading-[1.75] break-words">
      {lines.map((line, i) => {
        const trimmed = line.trim();
        if (!trimmed) {
          return <div key={i} className="h-1" />;
        }

        const bulletMatch = trimmed.match(/^([*\-•]|\d+\.)\s+(.*)$/);
        if (bulletMatch) {
          return (
            <div key={i} className="flex items-start gap-2.5 pl-0.5">
              <span className="text-blue-600 dark:text-sky-400 font-semibold shrink-0 select-none mt-[1px]">
                {bulletMatch[1] === '*' || bulletMatch[1] === '-' ? '•' : bulletMatch[1]}
              </span>
              <span className="min-w-0 flex-1">{renderInlineFormatting(bulletMatch[2])}</span>
            </div>
          );
        }

        const headingMatch = trimmed.match(/^#{1,3}\s+(.*)$/);
        if (headingMatch) {
          return (
            <div key={i} className="font-semibold text-[16.5px] text-slate-950 dark:text-white pt-1.5">
              {renderInlineFormatting(headingMatch[1])}
            </div>
          );
        }

        return <p key={i}>{renderInlineFormatting(trimmed)}</p>;
      })}
    </div>
  );
}

function FormattedMessageBody({ text, isUser, isBn }: { text: string; isUser: boolean; isBn: boolean }) {
  if (isUser) {
    return <p className="whitespace-pre-wrap break-words leading-[1.68]">{text}</p>;
  }

  // Strip any accidental raw code blocks (including in-progress blocks while streaming)
  const cleanedText = text
    .replace(/```[\s\S]*?(?:```|$)/g, '')
    .replace(/~~~[\s\S]*?(?:~~~|$)/g, '')
    .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  if (!cleanedText) {
    return (
      <FormattedTextSegment
        text={
          isBn
            ? 'আমি এটি সহজ ভাষায় ব্যাখ্যা করতে পারি—আপনি কী জানতে চান তা একটু বিস্তারিত লিখে বলুন।'
            : 'I can explain this in simple, everyday language—please let me know what you would like help with.'
        }
      />
    );
  }

  return <FormattedTextSegment text={cleanedText} />;
}

function BrandMLogoMark({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg viewBox="96 112 320 288" fill="currentColor" aria-hidden="true" className={className}>
      <path d="M128 348V172C128 156.536 140.536 144 156 144H174.6C184.5 144 193.6 149.2 198.7 157.7L256 253L313.3 157.7C318.4 149.2 327.5 144 337.4 144H356C371.464 144 384 156.536 384 172V348C384 361.255 373.255 372 360 372H344C330.745 372 320 361.255 320 348V242L277.6 310.6C267.7 326.6 244.3 326.6 234.4 310.6L192 242V348C192 361.255 181.255 372 168 372H152C138.745 372 128 361.255 128 348Z" />
    </svg>
  );
}

function cleanTextForSpeech(rawText: string): string {
  return rawText
    .replace(/```[\s\S]*?(?:```|$)/g, ' ')
    .replace(/~~~[\s\S]*?(?:~~~|$)/g, ' ')
    .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, ' ')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^[*\-•]\s+/gm, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function detectSpeechLanguage(text: string, fallbackBn: boolean): 'bn-BD' | 'en-US' {
  const bnMatches = text.match(/[\u0980-\u09FF]/g);
  const enMatches = text.match(/[A-Za-z]/g);
  const bnCount = bnMatches ? bnMatches.length : 0;
  const enCount = enMatches ? enMatches.length : 0;
  if (bnCount === 0 && enCount === 0) {
    return fallbackBn ? 'bn-BD' : 'en-US';
  }
  return bnCount >= enCount || bnCount >= 12 ? 'bn-BD' : 'en-US';
}

const SupportChatbotWidgetInner: React.FC<SupportChatbotWidgetProps> = ({
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
      ? 'আসসালামু আলাইকুম! আমি **MicroEarn BD AI অ্যাসিস্ট্যান্ট** (বাংলা ও English)।\n\n• **MicroEarn BD সাপোর্ট**: কুইজ, ম্যাথ, ক্যাপচা, রিসেলিং, ওয়ালেট ও বিকাশ উইথড্রয়ালের সহজ গাইড।\n• **যেকোনো সাধারণ প্রশ্ন**: দৈনন্দিন যেকোনো তথ্য, পড়াশোনা, লেখালেখি বা দরকারি বিষয়ে সহজ ভাষায় উত্তর।\n• **ছবি ও স্ক্রিনশট সহায়তা**: গ্যালারি বা ক্যামেরা থেকে ছবি/স্ক্রিনশট দিলে আমি তা দেখে সাহায্য করতে পারি।'
      : 'Hello! I am the **MicroEarn BD AI Assistant** (fluent in English & বাংলা).\n\n• **MicroEarn BD Support**: Clear answers on tasks, quizzes, reselling, wallet rules, and withdrawals.\n• **General Everyday Help**: Ask general knowledge, study, writing, or everyday helpful questions anytime.\n• **Photo & Screenshot Help**: Attach a photo from camera or gallery and I will inspect it to help you.'
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
  const [speakingMsgId, setSpeakingMsgId] = useState<string | null>(null);
  const [speechNotice, setSpeechNotice] = useState<{ msgId: string; text: string } | null>(null);
  const [cameraModalOpen, setCameraModalOpen] = useState(false);
  const [cameraStreamError, setCameraStreamError] = useState<string | null>(null);
  const [lastFailedSubmission, setLastFailedSubmission] = useState<{
    text: string;
    attachments: ChatAttachment[];
  } | null>(null);

  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const messageRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const activeAssistantIdRef = useRef<string | null>(null);
  const userScrolledUpRef = useRef(false);
  const programmaticScrollUntilRef = useRef(0);
  const prevMessageCountRef = useRef(messages.length);
  const abortControllerRef = useRef<AbortController | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);

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
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
      setSpeakingMsgId(null);
      if (cameraStreamRef.current) {
        cameraStreamRef.current.getTracks().forEach(track => track.stop());
        cameraStreamRef.current = null;
      }
      setCameraModalOpen(false);
    }
    return () => {
      document.body.classList.remove('ai-chat-open');
    };
  }, [isOpen]);

  useEffect(() => {
    return () => {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
      if (cameraStreamRef.current) {
        cameraStreamRef.current.getTracks().forEach(track => track.stop());
        cameraStreamRef.current = null;
      }
    };
  }, []);

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
        const keyboardOpen = vv.height < window.innerHeight - 110;
        const topOffset = Math.max(8, Math.round(vv.offsetTop) + 8);
        const reservedBottom = keyboardOpen ? 16 : 80;
        const maxHeight = Math.max(260, Math.round(vv.height) - reservedBottom);
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
    if (!isOpen) return;
    userScrolledUpRef.current = false;
    const container = scrollContainerRef.current;
    if (!container) return;
    const raf = requestAnimationFrame(() => {
      programmaticScrollUntilRef.current = Date.now() + 250;
      container.scrollTop = container.scrollHeight;
    });
    return () => cancelAnimationFrame(raf);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || !scrollContainerRef.current) return;
    const container = scrollContainerRef.current;
    const isNewMessageCount = messages.length !== prevMessageCountRef.current;
    prevMessageCountRef.current = messages.length;

    if (userScrolledUpRef.current) return;

    const activeId = activeAssistantIdRef.current;
    if (activeId) {
      const assistantEl = messageRefs.current[activeId];
      if (assistantEl) {
        const maxAllowedScrollTop = Math.max(0, assistantEl.offsetTop - 16);
        const maxScrollable = Math.max(0, container.scrollHeight - container.clientHeight);
        const targetTop = Math.min(maxScrollable, maxAllowedScrollTop);
        if (targetTop > container.scrollTop + 2) {
          programmaticScrollUntilRef.current = Date.now() + 350;
          container.scrollTo({
            top: targetTop,
            behavior: isNewMessageCount ? 'smooth' : 'auto',
          });
        }
        return;
      }
    }

    if (isNewMessageCount || pendingAttachments.length > 0) {
      programmaticScrollUntilRef.current = Date.now() + 350;
      container.scrollTo({
        top: container.scrollHeight,
        behavior: 'smooth',
      });
    }
  }, [messages, isOpen, pendingAttachments.length]);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 120);
    }
  }, [isOpen]);

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
      const normalizedType = await detectMimeTypeWithMagicBytes(file);
      const displayFileName = file.name?.trim() || `attachment-${Date.now()}`;

      if (!SUPPORTED_MIME_TYPES.has(normalizedType)) {
        setAttachmentError(
          isBn
            ? `"${displayFileName}" সাপোর্টেড নয়। ছবি (PNG/JPG/WEBP), PDF অথবা TXT/CSV ফাইল দিন।`
            : `"${displayFileName}" is unsupported. Please attach PNG/JPG/WEBP images, PDF, or TXT/CSV files.`
        );
        continue;
      }

      if (file.size > MAX_RAW_FILE_BYTES) {
        setAttachmentError(
          isBn
            ? `"${displayFileName}" ৮ MB-এর বেশি। অনুগ্রহ করে অপেক্ষাকৃত ছোট ফাইল দিন।`
            : `"${displayFileName}" exceeds 8 MB limit.`
        );
        continue;
      }

      try {
        if (normalizedType.startsWith('image/')) {
          const compressed = await compressImageIfNeeded(file, normalizedType);
          nextAttachments.push({
            id: `att-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            name: displayFileName,
            mimeType: compressed.mimeType,
            data: compressed.base64,
            previewUrl: compressed.dataUrl,
            sizeLabel: formatBytes(file.size)
          });
        } else {
          const read = await readFileAsBase64(file);
          nextAttachments.push({
            id: `att-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            name: displayFileName,
            mimeType: normalizedType,
            data: read.base64,
            sizeLabel: formatBytes(file.size)
          });
        }
      } catch {
        setAttachmentError(
          isBn
            ? `"${displayFileName}" ছবিটি প্রসেস করা যায়নি। অনুগ্রহ করে PNG বা JPG ছবি দিন।`
            : `Failed to process "${displayFileName}". Please try a PNG or JPG image.`
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

  const stopSpeech = () => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    setSpeakingMsgId(null);
  };

  const stopCameraStream = () => {
    if (cameraStreamRef.current) {
      cameraStreamRef.current.getTracks().forEach(track => track.stop());
      cameraStreamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraModalOpen(false);
    setCameraStreamError(null);
  };

  const handleOpenCameraCapture = async () => {
    if (isStreaming || pendingAttachments.length >= MAX_ATTACHMENTS_PER_MSG) return;
    playSound('click');

    const isMobileTouch =
      typeof window !== 'undefined' &&
      (window.matchMedia('(pointer: coarse)').matches ||
        /Android|iPhone|iPad|iPod/i.test(navigator.userAgent));

    if (isMobileTouch || !navigator.mediaDevices?.getUserMedia) {
      cameraInputRef.current?.click();
      return;
    }

    setCameraStreamError(null);
    setCameraModalOpen(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
        audio: false
      });
      cameraStreamRef.current = stream;
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          void videoRef.current.play().catch(() => {});
        }
      }, 40);
    } catch {
      setCameraStreamError(
        isBn
          ? 'ক্যামেরা অ্যাক্সেস পাওয়া যায়নি। চাইলে নিচের বাটন থেকে ছবি/ফাইল নির্বাচন করুন।'
          : 'Camera permission unavailable. You can still pick a photo using the device picker below.'
      );
    }
  };

  const handleSnapWebcamPhoto = () => {
    const videoEl = videoRef.current;
    if (!videoEl || videoEl.videoWidth === 0 || videoEl.videoHeight === 0) return;

    const canvas = document.createElement('canvas');
    canvas.width = videoEl.videoWidth;
    canvas.height = videoEl.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(videoEl, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(
      blob => {
        if (!blob) return;
        const capturedFile = new File([blob], `camera-photo-${Date.now()}.jpg`, {
          type: 'image/jpeg'
        });
        stopCameraStream();
        void handleFilesSelected([capturedFile]);
      },
      'image/jpeg',
      0.9
    );
  };

  const handleToggleSpeakMessage = (msgId: string, rawText: string) => {
    playSound('click');
    setSpeechNotice(null);

    if (speakingMsgId === msgId) {
      stopSpeech();
      return;
    }

    if (typeof window === 'undefined' || !('speechSynthesis' in window) || typeof SpeechSynthesisUtterance === 'undefined') {
      setSpeechNotice({
        msgId,
        text: isBn
          ? 'দুঃখিত, এই ব্রাউজারে অডিও রিডিং (Speech Synthesis) সাপোর্টেড নয়।'
          : 'Sorry, voice playback is not supported in this browser.'
      });
      return;
    }

    const spokenText = cleanTextForSpeech(rawText);
    if (!spokenText) return;

    const targetLang = detectSpeechLanguage(spokenText, isBn);
    const synth = window.speechSynthesis;
    synth.cancel();

    const utterance = new SpeechSynthesisUtterance(spokenText);
    utterance.lang = targetLang;
    utterance.rate = 1;
    utterance.pitch = 1;

    const voices = synth.getVoices();
    if (voices.length > 0) {
      const langPrefix = targetLang.split('-')[0].toLowerCase();
      const exactVoice = voices.find(v => v.lang.toLowerCase() === targetLang.toLowerCase());
      const prefixVoice = voices.find(v => v.lang.toLowerCase().startsWith(langPrefix));
      const chosenVoice = exactVoice || prefixVoice;

      if (chosenVoice) {
        utterance.voice = chosenVoice;
      } else if (targetLang === 'bn-BD') {
        setSpeechNotice({
          msgId,
          text: isBn
            ? 'এই ডিভাইসে বাংলা ভয়েস প্যাক না থাকলে অডিও অস্পষ্ট হতে পারে বা নাও শোনা যেতে পারে।'
            : 'A Bengali voice pack may not be installed on this device.'
        });
      }
    }

    utterance.onend = () => {
      setSpeakingMsgId(prev => (prev === msgId ? null : prev));
    };

    utterance.onerror = (event: SpeechSynthesisErrorEvent) => {
      setSpeakingMsgId(prev => (prev === msgId ? null : prev));
      if (event.error === 'interrupted' || event.error === 'canceled') return;
      setSpeechNotice({
        msgId,
        text: isBn
          ? 'এই ভাষার জন্য আপনার ডিভাইসে ভয়েস সাপোর্ট পাওয়া যায়নি।'
          : 'Speech playback is not available for this language on your device.'
      });
    };

    setSpeakingMsgId(msgId);
    synth.speak(utterance);
  };

  const handleClearChat = () => {
    playSound('click');
    stopGeneration();
    stopSpeech();
    activeAssistantIdRef.current = null;
    userScrolledUpRef.current = false;
    setSpeechNotice(null);
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

    // Only keep the last 6 non-error turns; include binary attachment data only on the latest turn
    const recentNonErrorTurns = [...messages, userMsg]
      .filter(m => m.id !== 'welcome' && !m.isError)
      .slice(-6);
    const historyForApi = recentNonErrorTurns.map((m, idx) => ({
      role: m.role,
      text: m.text,
      attachments:
        idx === recentNonErrorTurns.length - 1
          ? m.attachments
              ?.filter(a => Boolean(a.data))
              .map(a => ({
                name: a.name,
                mimeType: a.mimeType,
                data: a.data
              }))
          : undefined
    }));

    userScrolledUpRef.current = false;
    activeAssistantIdRef.current = assistantMsgId;
    setMessages(prev => [...prev, userMsg, placeholderAssistantMsg]);
    setIsStreaming(true);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const supportContext = {
        isAuthenticated: Boolean(currentUser),
        language,
        activeTab,
        activeJobsCount,
        publishedProductsCount
      };

      const idToken = auth.currentUser
        ? await auth.currentUser.getIdToken().catch(() => '')
        : '';
      const requestHeaders: Record<string, string> = {
        'Content-Type': 'application/json'
      };
      if (idToken) {
        requestHeaders.Authorization = `Bearer ${idToken}`;
      }

      const res = await fetch('/api/support-chat', {
        method: 'POST',
        headers: requestHeaders,
        body: JSON.stringify({
          messages: historyForApi,
          context: supportContext,
          stream: true
        }),
        signal: controller.signal
      });

      if (!res.ok) {
        let serverError = '';
        try {
          const errPayload = (await res.json()) as { error?: string };
          serverError = errPayload?.error || '';
        } catch {
          serverError = '';
        }
        if (serverError) {
          throw new Error(serverError);
        }
        if (res.status === 429) {
          throw new Error(
            isBn
              ? 'AI সার্ভিসে এখন অনেক চাপ রয়েছে (Rate limit)। অনুগ্রহ করে ১০-১৫ সেকেন্ড পর আবার চেষ্টা করুন।'
              : 'AI service is temporarily busy (rate limit). Please wait 10–15 seconds and try again.'
          );
        }
        if (res.status === 503) {
          throw new Error(
            isBn
              ? 'AI সাপোর্ট সার্ভিস সাময়িকভাবে অনুপলব্ধ। অ্যাডমিন প্যানেল → AI Support Settings বা Secrets-এ API Key যাচাই করুন অথবা কিছুক্ষণ পর আবার চেষ্টা করুন।'
              : 'AI Support service is temporarily unavailable. Please check your API keys in Admin Panel → AI Support Settings or Secrets and try again shortly.'
          );
        }
        throw new Error(
          isBn
            ? 'সার্ভারের সাথে সংযোগ করতে সমস্যা হয়েছে। অনুগ্রহ করে আবার চেষ্টা করুন।'
            : 'Unable to reach AI Support right now. Please try again.'
        );
      }

      let accumulated = '';
      const contentType = res.headers.get('content-type') || '';

      if (contentType.includes('text/event-stream') && res.body) {
        const reader = res.body.getReader();
        const decoder = new TextDecoder('utf-8');
        let buffer = '';
        let streamDone = false;

        while (!streamDone) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          const events = buffer.split('\n\n');
          buffer = events.pop() || '';

          for (const rawEvent of events) {
            const lines = rawEvent.split('\n');
            for (const line of lines) {
              if (!line.startsWith('data:')) continue;
              const jsonStr = line.slice(5).trim();
              if (!jsonStr) continue;
              let payload: { text?: string; done?: boolean; error?: string };
              try {
                payload = JSON.parse(jsonStr) as { text?: string; done?: boolean; error?: string };
              } catch {
                continue;
              }
              if (payload.error) {
                throw new Error(payload.error);
              }
              if (payload.text) {
                accumulated += payload.text;
                const snapshot = accumulated;
                setMessages(prev =>
                  prev.map(m => (m.id === assistantMsgId ? { ...m, text: snapshot } : m))
                );
              }
              if (payload.done) {
                streamDone = true;
              }
            }
          }
        }
      } else {
        if (!contentType.includes('application/json')) {
          throw new Error(
            isBn
              ? 'AI সার্ভার এন্ডপয়েন্ট সাড়া দিচ্ছে না। অনুগ্রহ করে কিছুক্ষণ পর আবার চেষ্টা করুন।'
              : 'AI service endpoint returned an unexpected response. Please try again shortly.'
          );
        }
        let data: { text?: string; error?: string } | null = null;
        try {
          data = (await res.json()) as { text?: string; error?: string };
        } catch {
          data = null;
        }
        if (data?.error) {
          throw new Error(data.error);
        }
        accumulated = data?.text || '';
        if (accumulated) {
          setMessages(prev =>
            prev.map(m => (m.id === assistantMsgId ? { ...m, text: accumulated } : m))
          );
        }
      }

      // Non-streaming safety fallback if the SSE stream closed without emitting chunks
      if (!accumulated.trim() && !controller.signal.aborted) {
        const fallbackRes = await fetch('/api/support-chat', {
          method: 'POST',
          headers: requestHeaders,
          body: JSON.stringify({
            messages: historyForApi,
            context: supportContext,
            stream: false
          }),
          signal: controller.signal
        });

        const fallbackType = fallbackRes.headers.get('content-type') || '';
        if (fallbackRes.ok && fallbackType.includes('application/json')) {
          let fallbackData: { text?: string; error?: string } | null = null;
          try {
            fallbackData = (await fallbackRes.json()) as { text?: string; error?: string };
          } catch {
            fallbackData = null;
          }
          if (fallbackData?.error) {
            throw new Error(fallbackData.error);
          }
          if (fallbackData?.text?.trim()) {
            accumulated = fallbackData.text;
            setMessages(prev =>
              prev.map(m => (m.id === assistantMsgId ? { ...m, text: accumulated } : m))
            );
          }
        } else {
          let fallbackErr = '';
          try {
            if (fallbackType.includes('application/json')) {
              const errJson = (await fallbackRes.json()) as { error?: string };
              fallbackErr = errJson?.error || '';
            }
          } catch {
            fallbackErr = '';
          }
          throw new Error(
            fallbackErr ||
              (isBn
                ? 'AI থেকে উত্তর পাওয়া যায়নি। অনুগ্রহ করে আবার চেষ্টা করুন।'
                : 'Did not receive a response from AI. Please try again.')
          );
        }
      }

      if (!accumulated.trim()) {
        throw new Error(
          isBn
            ? 'AI থেকে উত্তর পাওয়া যায়নি। অনুগ্রহ করে একটু পর আবার চেষ্টা করুন।'
            : 'No response received from AI. Please try again in a moment.'
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
            ? 'নেটওয়ার্ক সমস্যার কারণে উত্তর পাওয়া যায়নি। অনুগ্রহ করে আবার চেষ্টা করুন।'
            : 'Network error while reaching AI Support. Please try again.');
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

  return (
    <>
      {/* Floating Gemini-Style Assistant Launcher (Aligned inside centered 460px mobile frame) */}
      {!isOpen && (
        <div className="pointer-events-none fixed inset-x-0 bottom-[4.85rem] z-40 flex justify-center px-3">
          <div className="w-full max-w-[460px] flex justify-end">
            <button
              type="button"
              onClick={() => {
                playSound('click');
                setOpen(true);
              }}
              aria-label={isBn ? 'AI অ্যাসিস্ট্যান্ট চ্যাট খুলুন' : 'Open AI Assistant Chat'}
              className="pointer-events-auto h-12 pl-3.5 pr-4 rounded-full bg-white/95 hover:bg-white dark:bg-[#1b2230]/95 dark:hover:bg-[#232b3d] text-slate-900 dark:text-white shadow-[0_10px_30px_-6px_rgba(15,23,42,0.18)] dark:shadow-[0_10px_30px_-6px_rgba(0,0,0,0.55)] border border-slate-200/80 dark:border-slate-700/80 backdrop-blur-md flex items-center gap-2.5 cursor-pointer transition-all duration-200 hover:-translate-y-0.5 active:scale-95"
            >
              <span className="w-7 h-7 rounded-lg bg-gradient-to-tr from-emerald-600 via-teal-500 to-cyan-500 text-white flex items-center justify-center shrink-0 shadow-xs">
                <BrandMLogoMark className="w-4 h-4" />
              </span>
              <span className="text-sm font-semibold tracking-tight whitespace-nowrap">
                {isBn ? 'AI অ্যাসিস্ট্যান্ট' : 'AI Assistant'}
              </span>
            </button>
          </div>
        </div>
      )}

      {/* Scrim Backdrop when Chat is Open */}
      {isOpen && (
        <div
          aria-hidden="true"
          onClick={() => {
            playSound('click');
            stopGeneration();
            setOpen(false);
          }}
          className="fixed inset-0 z-[65] bg-slate-950/40 backdrop-blur-[3px] transition-opacity"
        />
      )}

      {/* Gemini-Style Multimodal Chat Panel — Centered over 460px frame & clear of notches/headers */}
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
          className={`fixed z-[70] inset-x-2.5 mx-auto top-[calc(env(safe-area-inset-top,0px)+0.75rem)] bottom-[calc(env(safe-area-inset-bottom,0px)+0.75rem)] w-[calc(100%-1.25rem)] max-w-[444px] sm:top-1/2 sm:-translate-y-1/2 sm:bottom-auto sm:h-[min(650px,calc(100dvh-2rem-env(safe-area-inset-top,0px)))] bg-white dark:bg-[#131720] rounded-[28px] sm:rounded-[32px] border ${
            isDragging
              ? 'border-blue-500 ring-2 ring-blue-500/30'
              : 'border-slate-200/80 dark:border-slate-800/80'
          } shadow-[0_24px_64px_-16px_rgba(15,23,42,0.2)] dark:shadow-[0_24px_64px_-16px_rgba(0,0,0,0.7)] flex flex-col overflow-hidden animate-in fade-in duration-200`}
        >
          {/* Tidy Minimal Header — Generous touch targets & zero clutter */}
          <header className="px-4 sm:px-5 py-3.5 border-b border-slate-100 dark:border-slate-800/70 bg-white/95 dark:bg-[#131720]/95 backdrop-blur-md flex items-center justify-between gap-3 shrink-0">
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-600 via-teal-500 to-cyan-500 text-white flex items-center justify-center shrink-0 shadow-xs">
                <BrandMLogoMark className="w-5 h-5" />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="font-semibold text-[15px] tracking-tight text-slate-900 dark:text-slate-50 truncate">
                  {isBn ? 'MicroEarn BD AI সাপোর্ট' : 'MicroEarn BD AI'}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                  {isBn ? 'বাংলা ও English · তাৎক্ষণিক সহায়তা' : 'Bangla & English · Instant help'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={handleClearChat}
                className="w-11 h-11 rounded-full text-slate-500 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-slate-100 dark:hover:bg-slate-800/80 flex items-center justify-center cursor-pointer transition-colors"
                aria-label={isBn ? 'চ্যাট হিস্ট্রি মুছুন' : 'Clear chat history'}
                title={isBn ? 'নতুন চ্যাট' : 'New chat'}
              >
                <Trash2 className="w-[18px] h-[18px]" />
              </button>

              <button
                type="button"
                onClick={() => {
                  playSound('click');
                  stopGeneration();
                  setOpen(false);
                }}
                className="w-11 h-11 rounded-full text-slate-500 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-slate-100 dark:hover:bg-slate-800/80 flex items-center justify-center cursor-pointer transition-colors"
                aria-label={isBn ? 'চ্যাটবট বন্ধ করুন' : 'Close Support Chatbot'}
                title={isBn ? 'বন্ধ করুন' : 'Close'}
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </header>

          {/* Drag Overlay */}
          {isDragging && (
            <div className="px-4 py-3 bg-blue-50/90 dark:bg-sky-950/50 border-b border-blue-200/70 dark:border-sky-800/60 text-blue-700 dark:text-sky-300 text-sm font-medium flex items-center justify-center gap-2 shrink-0">
              <ImagePlus className="w-4 h-4" />
              <span>{isBn ? 'ছবি বা ডকুমেন্ট এখানে ছেড়ে দিন' : 'Drop images or documents here'}</span>
            </div>
          )}

          {/* Message Feed — Generous spacing, comfortable medium typography, open Gemini layout */}
          <div
            ref={scrollContainerRef}
            onScroll={() => {
              const container = scrollContainerRef.current;
              if (!container || Date.now() <= programmaticScrollUntilRef.current) return;
              const distanceFromBottom =
                container.scrollHeight - container.scrollTop - container.clientHeight;
              if (activeAssistantIdRef.current) {
                const activeEl = messageRefs.current[activeAssistantIdRef.current];
                if (activeEl) {
                  const maxAllowed = Math.max(0, activeEl.offsetTop - 16);
                  const expectedTop = Math.min(
                    Math.max(0, container.scrollHeight - container.clientHeight),
                    maxAllowed
                  );
                  if (container.scrollTop < expectedTop - 24) {
                    userScrolledUpRef.current = true;
                    return;
                  }
                }
              }
              userScrolledUpRef.current = distanceFromBottom > 64;
            }}
            onWheel={e => {
              if (e.deltaY < 0) {
                userScrolledUpRef.current = true;
              }
            }}
            className="relative flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-4 sm:px-5 py-5 space-y-7 bg-white dark:bg-[#131720]"
          >
            {messages.map(msg => {
              const isUser = msg.role === 'user';
              const isCopied = copiedMsgId === msg.id;
              const isSpeaking = speakingMsgId === msg.id;

              if (isUser) {
                return (
                  <div
                    key={msg.id}
                    ref={el => {
                      messageRefs.current[msg.id] = el;
                    }}
                    className="flex flex-col items-end gap-1.5"
                  >
                    <div className="max-w-[85%] min-w-0 rounded-[22px] rounded-br-md px-4 py-3 bg-[#f0f4f9] dark:bg-[#232a3b] text-slate-900 dark:text-slate-100 text-[16px] leading-[1.68] shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
                      {msg.attachments && msg.attachments.length > 0 && (
                        <div className="mb-2.5 flex flex-wrap gap-2">
                          {msg.attachments.map(att =>
                            att.previewUrl ? (
                              <img
                                key={att.id}
                                src={att.previewUrl}
                                alt={att.name}
                                className="max-h-40 max-w-full rounded-2xl object-cover border border-slate-200/70 dark:border-slate-700"
                              />
                            ) : (
                              <div
                                key={att.id}
                                className="px-3 py-1.5 rounded-xl bg-white/80 dark:bg-slate-800/90 text-xs font-medium flex items-center gap-1.5 max-w-full border border-slate-200/70 dark:border-slate-700"
                              >
                                <FileText className="w-4 h-4 shrink-0 text-blue-600 dark:text-sky-400" />
                                <span className="truncate">{att.name}</span>
                              </div>
                            )
                          )}
                        </div>
                      )}

                      <FormattedMessageBody text={msg.text} isUser={true} isBn={isBn} />
                    </div>
                    <span className="px-1 text-[11px] text-slate-400 dark:text-slate-500 tabular-nums">
                      {msg.timestamp}
                    </span>
                  </div>
                );
              }

              return (
                <div
                  key={msg.id}
                  ref={el => {
                    messageRefs.current[msg.id] = el;
                  }}
                  className="flex items-start gap-3"
                >
                  <div
                    className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-1 ${
                      msg.isError
                        ? 'bg-rose-100 text-rose-600 dark:bg-rose-950/70 dark:text-rose-400'
                        : 'bg-gradient-to-tr from-emerald-600 via-teal-500 to-cyan-500 text-white shadow-xs'
                    }`}
                  >
                    {msg.isError ? (
                      <AlertCircle className="w-4 h-4" />
                    ) : (
                      <BrandMLogoMark className="w-4 h-4" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div
                      className={`text-[16px] leading-[1.75] ${
                        msg.isError
                          ? 'rounded-2xl px-4 py-3 bg-rose-50/90 dark:bg-rose-950/30 text-rose-800 dark:text-rose-200 border border-rose-200/80 dark:border-rose-900/60'
                          : 'text-slate-800 dark:text-slate-100 pt-0.5'
                      }`}
                    >
                      {msg.text ? (
                        <FormattedMessageBody text={msg.text} isUser={false} isBn={isBn} />
                      ) : (
                        <div className="flex items-center gap-2 py-1 text-[15px] text-slate-500 dark:text-slate-400" aria-label="Typing">
                          <span className="inline-flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-500/80 dark:bg-sky-400/80 animate-pulse" />
                            <span className="w-1.5 h-1.5 rounded-full bg-sky-500/80 dark:bg-teal-400/80 animate-pulse [animation-delay:150ms]" />
                            <span className="w-1.5 h-1.5 rounded-full bg-teal-500/80 dark:bg-emerald-400/80 animate-pulse [animation-delay:300ms]" />
                          </span>
                          <span>{isBn ? 'উত্তর তৈরি হচ্ছে...' : 'Thinking...'}</span>
                        </div>
                      )}
                    </div>

                    <div className="mt-2.5 flex items-center gap-2 flex-wrap text-xs text-slate-400 dark:text-slate-500 tabular-nums">
                      <span>{msg.timestamp}</span>
                      {msg.text && !msg.isError && (
                        <>
                          <button
                            type="button"
                            onClick={() => void handleCopyMessage(msg.id, msg.text)}
                            className="inline-flex items-center gap-1.5 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 cursor-pointer transition-colors py-1 px-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800/70"
                            aria-label={isBn ? 'বার্তা কপি করুন' : 'Copy message'}
                          >
                            {isCopied ? (
                              <>
                                <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                                <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                                  {isBn ? 'কপি হয়েছে' : 'Copied'}
                                </span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-3.5 h-3.5" />
                                <span>{isBn ? 'কপি' : 'Copy'}</span>
                              </>
                            )}
                          </button>

                          <button
                            type="button"
                            onClick={() => handleToggleSpeakMessage(msg.id, msg.text)}
                            className={`inline-flex items-center gap-1.5 cursor-pointer transition-colors py-1 px-2 rounded-lg ${
                              isSpeaking
                                ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 font-medium'
                                : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800/70'
                            }`}
                            aria-label={isSpeaking ? (isBn ? 'পড়া থামান' : 'Stop reading') : (isBn ? 'শুনে নিন' : 'Read aloud')}
                            title={isSpeaking ? (isBn ? 'পড়া থামান' : 'Stop reading') : (isBn ? 'ভয়েসে শুনুন' : 'Listen')}
                          >
                            {isSpeaking ? (
                              <>
                                <VolumeX className="w-3.5 h-3.5 animate-pulse" />
                                <span>{isBn ? 'থামান' : 'Stop'}</span>
                              </>
                            ) : (
                              <>
                                <Volume2 className="w-3.5 h-3.5" />
                                <span>{isBn ? 'শুনুন' : 'Listen'}</span>
                              </>
                            )}
                          </button>
                        </>
                      )}
                    </div>

                    {speechNotice?.msgId === msg.id && (
                      <div className="mt-2 text-xs text-amber-700 dark:text-amber-300 bg-amber-50/90 dark:bg-amber-950/40 px-3 py-1.5 rounded-xl border border-amber-200/70 dark:border-amber-800/60 flex items-center justify-between gap-2">
                        <span>{speechNotice.text}</span>
                        <button
                          type="button"
                          onClick={() => setSpeechNotice(null)}
                          className="text-amber-600 dark:text-amber-400 hover:opacity-75 shrink-0 cursor-pointer"
                          aria-label="Dismiss notice"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {/* Retry on Error */}
            {lastFailedSubmission && !isStreaming && (
              <div className="flex justify-center pt-1">
                <button
                  type="button"
                  onClick={() =>
                    void sendPrompt(lastFailedSubmission.text, lastFailedSubmission.attachments)
                  }
                  className="px-4 py-2.5 rounded-full bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:hover:bg-white text-white dark:text-slate-900 text-xs font-semibold cursor-pointer transition-colors shadow-xs"
                >
                  {isBn ? 'আবার চেষ্টা করুন' : 'Retry last message'}
                </button>
              </div>
            )}
          </div>

          {/* Pending Attachments Preview Bar */}
          {(pendingAttachments.length > 0 || attachmentError) && (
            <div className="px-4 pt-2.5 pb-1.5 border-t border-slate-100 dark:border-slate-800/70 bg-white dark:bg-[#131720] space-y-2 shrink-0">
              {attachmentError && (
                <div className="text-xs text-rose-600 dark:text-rose-400 font-medium flex items-center gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  <span>{attachmentError}</span>
                </div>
              )}

              {pendingAttachments.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {pendingAttachments.map(att => (
                    <div
                      key={att.id}
                      className="relative group flex items-center gap-2 p-1.5 pr-8 rounded-2xl bg-[#f0f4f9] dark:bg-[#1e2433] border border-slate-200/70 dark:border-slate-700/70 text-xs max-w-[196px]"
                    >
                      {att.previewUrl ? (
                        <img
                          src={att.previewUrl}
                          alt={att.name}
                          className="w-9 h-9 rounded-xl object-cover shrink-0"
                        />
                      ) : (
                        <div className="w-9 h-9 rounded-xl bg-blue-100 dark:bg-sky-950 text-blue-700 dark:text-sky-300 flex items-center justify-center shrink-0">
                          <FileText className="w-4 h-4" />
                        </div>
                      )}
                      <div className="min-w-0">
                        <div className="text-xs font-medium text-slate-800 dark:text-slate-200 truncate">
                          {att.name}
                        </div>
                        <div className="text-[11px] text-slate-400 tabular-nums">{att.sizeLabel}</div>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          setPendingAttachments(prev => prev.filter(p => p.id !== att.id))
                        }
                        aria-label={isBn ? 'ফাইল সরান' : 'Remove attachment'}
                        className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-white/90 hover:bg-rose-600 text-slate-500 hover:text-white dark:bg-slate-700 dark:text-slate-300 flex items-center justify-center cursor-pointer transition-colors shadow-xs"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Sleek Gemini-Style Rounded Input Composer */}
          <form
            onSubmit={handleFormSubmit}
            className="px-3.5 sm:px-4 pt-2 pb-3 sm:pb-4 bg-white dark:bg-[#131720] shrink-0"
          >
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/*,application/pdf,.txt,.csv,.md,.json"
              className="hidden"
              onChange={e => {
                void handleFilesSelected(e.target.files);
                e.target.value = '';
              }}
            />

            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={e => {
                void handleFilesSelected(e.target.files);
                e.target.value = '';
              }}
            />

            <div className="flex items-end gap-1 rounded-[28px] bg-[#f0f4f9] dark:bg-[#1e2433] border border-slate-200/70 dark:border-slate-700/60 focus-within:bg-white dark:focus-within:bg-[#232a3b] focus-within:border-blue-400/70 dark:focus-within:border-sky-500/60 focus-within:shadow-[0_4px_20px_rgba(37,99,235,0.08)] p-1.5 transition-all duration-150">
              <button
                type="button"
                disabled={isStreaming || pendingAttachments.length >= MAX_ATTACHMENTS_PER_MSG}
                onClick={() => {
                  playSound('click');
                  fileInputRef.current?.click();
                }}
                aria-label={isBn ? 'ছবি বা ফাইল যুক্ত করুন' : 'Attach image or file'}
                title={isBn ? 'স্ক্রিনশট, ছবি বা PDF যুক্ত করুন' : 'Attach screenshot, image, or PDF'}
                className="w-10 h-10 min-w-[40px] min-h-[40px] rounded-full text-slate-500 hover:text-slate-900 hover:bg-slate-200/70 dark:text-slate-400 dark:hover:text-white dark:hover:bg-slate-700/70 flex items-center justify-center shrink-0 cursor-pointer disabled:opacity-35 disabled:cursor-not-allowed transition-colors"
              >
                <Paperclip className="w-[18px] h-[18px]" />
              </button>

              <button
                type="button"
                disabled={isStreaming || pendingAttachments.length >= MAX_ATTACHMENTS_PER_MSG}
                onClick={() => void handleOpenCameraCapture()}
                aria-label={isBn ? 'ক্যামেরা দিয়ে নতুন ছবি তুলুন' : 'Take photo with camera'}
                title={isBn ? 'ক্যামেরা দিয়ে ছবি তুলুন' : 'Take photo with camera'}
                className="w-10 h-10 min-w-[40px] min-h-[40px] rounded-full text-slate-500 hover:text-emerald-700 hover:bg-emerald-100/70 dark:text-slate-400 dark:hover:text-emerald-300 dark:hover:bg-slate-700/70 flex items-center justify-center shrink-0 cursor-pointer disabled:opacity-35 disabled:cursor-not-allowed transition-colors"
              >
                <Camera className="w-[18px] h-[18px]" />
              </button>

              <textarea
                ref={inputRef}
                rows={1}
                value={input}
                onChange={e => {
                  setInput(e.target.value);
                  const el = e.target;
                  el.style.height = 'auto';
                  el.style.height = `${Math.min(el.scrollHeight, 112)}px`;
                }}
                onKeyDown={handleKeyDown}
                onPaste={handlePaste}
                maxLength={4000}
                placeholder={
                  isBn
                    ? 'যেকোনো প্রশ্ন করুন বা ছবি/স্ক্রিনশট দিন...'
                    : 'Ask anything or attach a photo/screenshot...'
                }
                className="flex-1 min-w-0 resize-none max-h-28 bg-transparent border-0 px-2 py-2.5 text-[15.5px] text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-0 leading-snug"
              />

              {isStreaming ? (
                <button
                  type="button"
                  onClick={stopGeneration}
                  aria-label={isBn ? 'উত্তর থামান' : 'Stop response'}
                  className="w-11 h-11 min-w-[44px] min-h-[44px] rounded-full bg-rose-600 hover:bg-rose-700 text-white flex items-center justify-center shrink-0 cursor-pointer transition-colors"
                >
                  <Square className="w-3.5 h-3.5 fill-current" />
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={!input.trim() && pendingAttachments.length === 0}
                  aria-label={isBn ? 'পাঠান' : 'Send message'}
                  className="w-11 h-11 min-w-[44px] min-h-[44px] rounded-full bg-slate-900 hover:bg-slate-800 dark:bg-sky-500 dark:hover:bg-sky-400 text-white dark:text-slate-950 disabled:opacity-25 disabled:hover:bg-slate-900 dark:disabled:hover:bg-sky-500 flex items-center justify-center shrink-0 cursor-pointer disabled:cursor-not-allowed transition-colors"
                >
                  <Send className="w-4 h-4" />
                </button>
              )}
            </div>

            <div className="mt-2 px-2 text-[11px] text-slate-400 dark:text-slate-500 flex items-center justify-between gap-2">
              <span className="truncate">
                {isBn
                  ? 'PNG/JPG/PDF সাপোর্টেড · পাসওয়ার্ড বা PIN শেয়ার করবেন না'
                  : 'PNG/JPG/PDF supported · Never share password or PIN'}
              </span>
              <span className="tabular-nums shrink-0">{input.length}/4000</span>
            </div>
          </form>

          {/* Desktop/Laptop Camera Stream Capture Overlay with Native File Fallback */}
          {cameraModalOpen && (
            <div className="absolute inset-0 z-30 bg-slate-950/90 backdrop-blur-sm flex flex-col justify-between p-4 text-white animate-in fade-in duration-150">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <Camera className="w-4 h-4 text-emerald-400" />
                  <span>{isBn ? 'ক্যামেরা দিয়ে ছবি তুলুন' : 'Take Photo with Camera'}</span>
                </div>
                <button
                  type="button"
                  onClick={stopCameraStream}
                  aria-label={isBn ? 'ক্যামেরা বন্ধ করুন' : 'Close camera'}
                  className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center cursor-pointer transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="flex-1 min-h-0 my-3 rounded-2xl overflow-hidden bg-slate-900 border border-slate-800 flex items-center justify-center">
                {cameraStreamError ? (
                  <div className="p-5 text-center space-y-3 text-sm text-slate-300">
                    <AlertCircle className="w-8 h-8 text-amber-400 mx-auto" />
                    <p className="leading-relaxed">{cameraStreamError}</p>
                    <button
                      type="button"
                      onClick={() => {
                        stopCameraStream();
                        cameraInputRef.current?.click();
                      }}
                      className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold cursor-pointer transition-colors"
                    >
                      {isBn ? 'ডিভাইস থেকে ছবি বেছে নিন' : 'Choose from Device'}
                    </button>
                  </div>
                ) : (
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover"
                  />
                )}
              </div>

              {!cameraStreamError && (
                <div className="flex items-center justify-center gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      stopCameraStream();
                      cameraInputRef.current?.click();
                    }}
                    className="px-4 py-2.5 rounded-full bg-white/10 hover:bg-white/20 text-xs font-medium cursor-pointer transition-colors"
                  >
                    {isBn ? 'ফাইল বাছুন' : 'Choose File'}
                  </button>
                  <button
                    type="button"
                    onClick={handleSnapWebcamPhoto}
                    className="px-6 py-2.5 rounded-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-sm font-bold flex items-center gap-2 cursor-pointer transition-colors shadow-lg"
                  >
                    <Camera className="w-4 h-4" />
                    <span>{isBn ? 'ছবি তুলুন' : 'Capture'}</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </aside>
      )}
    </>
  );
};

interface SupportChatbotErrorBoundaryState {
  hasError: boolean;
}

class SupportChatbotErrorBoundary extends Component<
  SupportChatbotWidgetProps,
  SupportChatbotErrorBoundaryState
> {
  state: SupportChatbotErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): SupportChatbotErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error): void {
    console.error('[SupportChatbotWidget] Caught runtime error:', error);
  }

  render() {
    if (this.state.hasError) {
      if (!this.props.isOpenExternal) {
        return null;
      }
      const isBn = this.props.language === 'bn';
      return (
        <div className="fixed bottom-20 right-4 z-[70] max-w-xs rounded-2xl border border-rose-200 dark:border-rose-900 bg-white dark:bg-slate-900 p-4 shadow-xl text-sm text-slate-700 dark:text-slate-200 space-y-2">
          <p className="font-medium text-rose-600 dark:text-rose-400">
            {isBn
              ? 'AI সাপোর্ট সাময়িকভাবে লোড করা যায়নি।'
              : 'AI Support is temporarily unavailable.'}
          </p>
          <button
            type="button"
            onClick={() => this.setState({ hasError: false })}
            className="px-3 py-1.5 rounded-lg bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-xs font-semibold cursor-pointer"
          >
            {isBn ? 'আবার চেষ্টা করুন' : 'Retry'}
          </button>
        </div>
      );
    }
    return <SupportChatbotWidgetInner {...this.props} />;
  }
}

export const SupportChatbotWidget: React.FC<SupportChatbotWidgetProps> = props => (
  <SupportChatbotErrorBoundary {...props} />
);


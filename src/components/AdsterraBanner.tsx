import React, { Component, useEffect, useMemo, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { AdsConfig, Language, TaskAdSlotKey } from '../types';

interface AdsterraBannerProps {
  adsConfig: AdsConfig;
  language?: Language;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

class AdRenderErrorBoundary extends Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: unknown): void {
    console.warn('Safe ad container caught error:', error);
  }

  render() {
    if (this.state.hasError) {
      return null;
    }
    return this.props.children;
  }
}

function buildSandboxedAdDocument(rawCode: string, frameId: string): string {
  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <base target="_blank" />
    <style>
      html, body {
        margin: 0;
        padding: 0;
        background: transparent !important;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        width: 100%;
        min-height: 1px;
        overflow: hidden;
        font-family: system-ui, -apple-system, sans-serif;
      }
      #ad-root {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        width: 100%;
        background: transparent;
      }
      img, iframe {
        max-width: 100% !important;
      }
    </style>
    <script>
      window.onerror = function() { return true; };
      window.addEventListener('unhandledrejection', function(e) { e.preventDefault(); });
    </script>
  </head>
  <body>
    <div id="ad-root">${rawCode}</div>
    <script id="microearn-ad-probe">
      (function () {
        var FRAME_ID = ${JSON.stringify(frameId)};

        function isVisibleNode(node) {
          if (!node || typeof node.getBoundingClientRect !== 'function') return false;
          var style = window.getComputedStyle ? window.getComputedStyle(node) : null;
          if (style && (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0')) {
            return false;
          }
          var rect = node.getBoundingClientRect();
          return rect.width >= 16 && rect.height >= 16;
        }

        function detectAdContent() {
          var body = document.body;
          if (!body) return false;

          var mediaNodes = body.querySelectorAll('iframe, img, svg, canvas, video, object, embed');
          for (var i = 0; i < mediaNodes.length; i++) {
            var node = mediaNodes[i];
            if (node.tagName === 'IMG') {
              if ((node.complete && node.naturalWidth > 0) || isVisibleNode(node)) {
                return true;
              }
            } else if (isVisibleNode(node)) {
              return true;
            }
          }

          var containers = body.querySelectorAll('a, ins, div, span');
          for (var j = 0; j < containers.length; j++) {
            var el = containers[j];
            if (el.id === 'ad-root' || el.id === 'microearn-ad-probe') continue;
            var txt = (el.innerText || '').trim();
            if (txt.length > 0 && isVisibleNode(el)) {
              return true;
            }
          }

          return false;
        }

        function measureHeight() {
          var body = document.body;
          var root = document.getElementById('ad-root');
          var candidates = [
            root ? root.scrollHeight : 0,
            root ? Math.ceil(root.getBoundingClientRect().height) : 0,
            body ? body.scrollHeight : 0
          ];

          var framesAndImages = body ? body.querySelectorAll('iframe, img, ins, canvas') : [];
          for (var i = 0; i < framesAndImages.length; i++) {
            var rect = framesAndImages[i].getBoundingClientRect();
            if (rect.height > 0) {
              candidates.push(Math.ceil(rect.height));
            }
          }

          var maxH = 0;
          for (var k = 0; k < candidates.length; k++) {
            if (candidates[k] > maxH) maxH = candidates[k];
          }
          return maxH;
        }

        function postState() {
          try {
            var hasContent = detectAdContent();
            var h = measureHeight();
            parent.postMessage(
              {
                type: 'MICROEARN_AD_STATUS',
                id: FRAME_ID,
                hasContent: hasContent,
                height: h
              },
              '*'
            );
          } catch (e) {}
        }

        window.addEventListener('load', postState);
        setTimeout(postState, 250);
        setTimeout(postState, 800);
        setTimeout(postState, 1600);
        setTimeout(postState, 3000);
        setTimeout(postState, 5000);

        if (typeof MutationObserver !== 'undefined' && document.body) {
          try {
            new MutationObserver(postState).observe(document.body, {
              childList: true,
              subtree: true,
              attributes: true
            });
          } catch (e) {}
        }

        if (typeof ResizeObserver !== 'undefined' && document.body) {
          try {
            new ResizeObserver(postState).observe(document.body);
          } catch (e) {}
        }
      })();
    </script>
  </body>
</html>`;
}

function inspectIframeDomForAd(iframeEl: HTMLIFrameElement | null): {
  hasContent: boolean;
  height: number;
} {
  try {
    const doc = iframeEl?.contentDocument;
    const body = doc?.body;
    if (!body) return { hasContent: false, height: 0 };

    const media = body.querySelectorAll('iframe, img, svg, canvas, video, object, embed');
    for (const node of Array.from(media)) {
      const rect = node.getBoundingClientRect();
      if (node.tagName === 'IMG') {
        const img = node as HTMLImageElement;
        if ((img.complete && img.naturalWidth > 0) || (rect.width >= 16 && rect.height >= 16)) {
          return { hasContent: true, height: Math.max(Math.ceil(rect.height), body.scrollHeight) };
        }
      } else if (rect.width >= 16 && rect.height >= 16) {
        return { hasContent: true, height: Math.max(Math.ceil(rect.height), body.scrollHeight) };
      }
    }

    const blocks = body.querySelectorAll('a, ins, div, span');
    for (const el of Array.from(blocks)) {
      if (el.id === 'ad-root' || el.id === 'microearn-ad-probe') continue;
      const rect = el.getBoundingClientRect();
      const text = (el as HTMLElement).innerText?.trim() || '';
      if (text.length > 0 && rect.width >= 24 && rect.height >= 20) {
        return { hasContent: true, height: Math.max(Math.ceil(rect.height), body.scrollHeight) };
      }
    }

    return { hasContent: false, height: 0 };
  } catch {
    return { hasContent: false, height: 0 };
  }
}

type AdRenderPhase = 'loading' | 'loaded' | 'collapsing' | 'hidden';

interface BannerUnitConfig {
  key: string;
  code: string;
  maxHeight: number;
  containerClass: string;
}

const AdsterraBannerUnit: React.FC<{
  code: string;
  isBn: boolean;
  maxHeight?: number;
  containerClass?: string;
}> = ({
  code,
  isBn,
  maxHeight = 680,
  containerClass = 'max-w-[360px] sm:max-w-full'
}) => {
  const trimmedCode = code.trim();
  const shouldRender = trimmedCode.length > 0;

  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [frameHeight, setFrameHeight] = useState<number>(64);
  const [phase, setPhase] = useState<AdRenderPhase>(shouldRender ? 'loading' : 'hidden');
  const hasContentRef = useRef<boolean>(false);
  const frameIdRef = useRef<string>('ad-slot-' + Math.random().toString(36).slice(2, 10));

  const codeSignature = useMemo(() => {
    let hash = 0;
    for (let i = 0; i < trimmedCode.length; i++) {
      hash = (hash * 31 + trimmedCode.charCodeAt(i)) | 0;
    }
    return `${trimmedCode.length}_${hash}`;
  }, [trimmedCode]);

  const srcDoc = useMemo(() => {
    if (!shouldRender) return '';
    return buildSandboxedAdDocument(trimmedCode, frameIdRef.current);
  }, [shouldRender, trimmedCode]);

  useEffect(() => {
    hasContentRef.current = false;
    setFrameHeight(64);
    setPhase(shouldRender ? 'loading' : 'hidden');
  }, [codeSignature, shouldRender]);

  useEffect(() => {
    if (!shouldRender) return;

    const handleMessage = (event: MessageEvent) => {
      try {
        if (!iframeRef.current || event.source !== iframeRef.current.contentWindow) {
          return;
        }
        const payload = event.data as {
          type?: string;
          id?: string;
          hasContent?: boolean;
          height?: number;
        } | null;

        if (payload && payload.type === 'MICROEARN_AD_STATUS' && payload.id === frameIdRef.current) {
          if (payload.hasContent) {
            hasContentRef.current = true;
            setPhase('loaded');
          }
          if (
            payload.hasContent &&
            typeof payload.height === 'number' &&
            Number.isFinite(payload.height) &&
            payload.height > 0
          ) {
            const clamped = Math.min(maxHeight, Math.max(50, Math.ceil(payload.height)));
            setFrameHeight(clamped);
          }
        }
      } catch {
        // Ignore cross-frame messaging errors
      }
    };

    window.addEventListener('message', handleMessage);

    // 6-second fallback: collapse smoothly if ad-blocker or zero-fill prevented visible ad content
    let unmountTimer: ReturnType<typeof setTimeout> | undefined;
    const fallbackTimer = setTimeout(() => {
      if (hasContentRef.current) return;
      const fallbackCheck = inspectIframeDomForAd(iframeRef.current);
      if (fallbackCheck.hasContent) {
        hasContentRef.current = true;
        setPhase('loaded');
        if (fallbackCheck.height > 0) {
          setFrameHeight(Math.min(maxHeight, Math.max(50, fallbackCheck.height)));
        }
        return;
      }

      setPhase('collapsing');
      unmountTimer = setTimeout(() => {
        setPhase('hidden');
      }, 320);
    }, 6000);

    return () => {
      window.removeEventListener('message', handleMessage);
      clearTimeout(fallbackTimer);
      if (unmountTimer) clearTimeout(unmountTimer);
    };
  }, [shouldRender, codeSignature, maxHeight]);

  if (!shouldRender || phase === 'hidden') {
    return null;
  }

  const isCollapsing = phase === 'collapsing';
  const isLoaded = phase === 'loaded';

  return (
    <div
      aria-hidden={isCollapsing}
      className={`w-full flex justify-center transition-all duration-300 ease-out overflow-hidden ${
        isCollapsing ? 'max-h-0 opacity-0 pointer-events-none' : 'max-h-[760px] opacity-100'
      }`}
    >
      <div
        className={`w-full ${containerClass} rounded-2xl border transition-colors duration-300 ${
          isLoaded
            ? 'border-slate-200/80 dark:border-slate-800/70 bg-white/70 dark:bg-slate-900/30 p-2.5 sm:p-3 shadow-xs'
            : 'border-slate-200/50 dark:border-slate-800/40 bg-transparent p-2 sm:p-2.5'
        }`}
      >
        <div className="flex items-center justify-center pb-1.5 mb-1.5">
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-slate-100/80 dark:bg-slate-800/50 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            {isBn ? 'Sponsored / বিজ্ঞাপন' : 'Sponsored / Advertisement'}
          </span>
        </div>
        <div className="w-full min-w-[160px] flex justify-center items-center bg-transparent overflow-hidden rounded-xl">
          <iframe
            key={codeSignature}
            ref={iframeRef}
            title="Sponsored Advertisement"
            srcDoc={srcDoc}
            sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"
            scrolling="no"
            style={{ height: `${frameHeight}px`, backgroundColor: 'transparent' }}
            className="w-full max-w-full border-0 bg-transparent overflow-hidden block transition-[height] duration-300 ease-out"
          />
        </div>
      </div>
    </div>
  );
};

const AdsterraBannerInner: React.FC<AdsterraBannerProps> = ({
  adsConfig,
  language = 'bn'
}) => {
  const isBn = language === 'bn';

  if (!adsConfig.adsEnabled) {
    return null;
  }

  // Backward compatibility: Banner 300x250 falls back to legacy bannerEnabled / bannerCode
  const banner300x250Enabled = adsConfig.banner300x250Enabled ?? adsConfig.bannerEnabled;
  const banner300x250Code = (adsConfig.banner300x250Code ?? adsConfig.bannerCode ?? '').trim();

  const activeUnits: BannerUnitConfig[] = [];

  if (banner300x250Enabled && banner300x250Code) {
    activeUnits.push({
      key: 'banner300x250',
      code: banner300x250Code,
      maxHeight: 420,
      containerClass: 'max-w-[360px] sm:max-w-full'
    });
  }
  if (adsConfig.banner468x60Enabled && (adsConfig.banner468x60Code || '').trim()) {
    activeUnits.push({
      key: 'banner468x60',
      code: (adsConfig.banner468x60Code || '').trim(),
      maxHeight: 160,
      containerClass: 'max-w-[520px] sm:max-w-full'
    });
  }
  if (adsConfig.banner320x50Enabled && (adsConfig.banner320x50Code || '').trim()) {
    activeUnits.push({
      key: 'banner320x50',
      code: (adsConfig.banner320x50Code || '').trim(),
      maxHeight: 140,
      containerClass: 'max-w-[360px] sm:max-w-full'
    });
  }
  if (adsConfig.banner728x90Enabled && (adsConfig.banner728x90Code || '').trim()) {
    activeUnits.push({
      key: 'banner728x90',
      code: (adsConfig.banner728x90Code || '').trim(),
      maxHeight: 180,
      containerClass: 'max-w-full'
    });
  }
  if (adsConfig.banner160x300Enabled && (adsConfig.banner160x300Code || '').trim()) {
    activeUnits.push({
      key: 'banner160x300',
      code: (adsConfig.banner160x300Code || '').trim(),
      maxHeight: 380,
      containerClass: 'max-w-[260px]'
    });
  }
  if (adsConfig.banner160x600Enabled && (adsConfig.banner160x600Code || '').trim()) {
    activeUnits.push({
      key: 'banner160x600',
      code: (adsConfig.banner160x600Code || '').trim(),
      maxHeight: 680,
      containerClass: 'max-w-[260px]'
    });
  }
  if (adsConfig.nativeBannerEnabled && (adsConfig.nativeBannerCode || '').trim()) {
    activeUnits.push({
      key: 'nativeBanner',
      code: (adsConfig.nativeBannerCode || '').trim(),
      maxHeight: 680,
      containerClass: 'max-w-full'
    });
  }

  if (activeUnits.length === 0) {
    return null;
  }

  return (
    <div className="w-full space-y-3 empty:hidden">
      {activeUnits.map(unit => (
        <AdsterraBannerUnit
          key={unit.key}
          code={unit.code}
          isBn={isBn}
          maxHeight={unit.maxHeight}
          containerClass={unit.containerClass}
        />
      ))}
    </div>
  );
};

export const AdsterraBanner: React.FC<AdsterraBannerProps> = props => (
  <AdRenderErrorBoundary>
    <AdsterraBannerInner {...props} />
  </AdRenderErrorBoundary>
);

function mountExecutableAdScript(container: HTMLElement, rawCode: string) {
  container.innerHTML = '';
  const trimmed = rawCode.trim();
  if (!trimmed) return;

  try {
    const template = document.createElement('template');
    template.innerHTML = trimmed;
    const fragment = template.content;
    const scripts = Array.from(fragment.querySelectorAll('script'));

    Array.from(fragment.childNodes)
      .filter(node => !(node instanceof HTMLScriptElement))
      .forEach(node => container.appendChild(node));

    scripts.forEach(oldScript => {
      const scriptEl = document.createElement('script');
      Array.from(oldScript.attributes).forEach(attr => {
        let value = attr.value;
        if (attr.name.toLowerCase() === 'src' && value.startsWith('//')) {
          value = `${window.location.protocol}${value}`;
        }
        scriptEl.setAttribute(attr.name, value);
      });
      if (oldScript.textContent) {
        scriptEl.textContent = oldScript.textContent;
      }
      container.appendChild(scriptEl);
    });
  } catch (err) {
    console.warn('Global ad script mount skipped:', err);
  }
}

const GlobalScriptSlot: React.FC<{ enabled: boolean; code: string; slotName: string }> = ({
  enabled,
  code,
  slotName
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const trimmedCode = code.trim();

  useEffect(() => {
    const host = containerRef.current;
    if (!host) return;
    if (!enabled || !trimmedCode) {
      host.innerHTML = '';
      return;
    }
    mountExecutableAdScript(host, trimmedCode);
    return () => {
      host.innerHTML = '';
    };
  }, [enabled, trimmedCode, slotName]);

  return <div ref={containerRef} data-ad-script-slot={slotName} className="hidden" aria-hidden="true" />;
};

export const AdsterraGlobalScripts: React.FC<{ adsConfig: AdsConfig }> = ({ adsConfig }) => {
  const globalOn = Boolean(adsConfig.adsEnabled);
  return (
    <AdRenderErrorBoundary>
      <GlobalScriptSlot
        slotName="social-bar"
        enabled={globalOn && Boolean(adsConfig.socialBarEnabled)}
        code={adsConfig.socialBarCode || ''}
      />
      <GlobalScriptSlot
        slotName="popunder"
        enabled={globalOn && Boolean(adsConfig.popunderEnabled)}
        code={adsConfig.popunderCode || ''}
      />
    </AdRenderErrorBoundary>
  );
};

export interface ResolvedTaskAdUnit {
  slotKey: TaskAdSlotKey;
  code: string;
  modalWidthClass: string;
  initialHeight: number;
  maxHeight: number;
}

function getSlotCandidate(
  adsConfig: AdsConfig,
  slotKey: TaskAdSlotKey
): ResolvedTaskAdUnit | null {
  switch (slotKey) {
    case 'banner300x250': {
      const enabled = adsConfig.banner300x250Enabled ?? adsConfig.bannerEnabled;
      const code = (adsConfig.banner300x250Code ?? adsConfig.bannerCode ?? '').trim();
      return enabled && code
        ? {
            slotKey,
            code,
            modalWidthClass: 'max-w-[390px]',
            initialHeight: 250,
            maxHeight: 360
          }
        : null;
    }
    case 'banner468x60': {
      const code = (adsConfig.banner468x60Code || '').trim();
      return adsConfig.banner468x60Enabled && code
        ? {
            slotKey,
            code,
            modalWidthClass: 'max-w-[520px]',
            initialHeight: 80,
            maxHeight: 160
          }
        : null;
    }
    case 'banner320x50': {
      const code = (adsConfig.banner320x50Code || '').trim();
      return adsConfig.banner320x50Enabled && code
        ? {
            slotKey,
            code,
            modalWidthClass: 'max-w-[380px]',
            initialHeight: 70,
            maxHeight: 140
          }
        : null;
    }
    case 'banner728x90': {
      const code = (adsConfig.banner728x90Code || '').trim();
      return adsConfig.banner728x90Enabled && code
        ? {
            slotKey,
            code,
            modalWidthClass: 'max-w-[780px]',
            initialHeight: 110,
            maxHeight: 180
          }
        : null;
    }
    case 'banner160x300': {
      const code = (adsConfig.banner160x300Code || '').trim();
      return adsConfig.banner160x300Enabled && code
        ? {
            slotKey,
            code,
            modalWidthClass: 'max-w-[340px]',
            initialHeight: 300,
            maxHeight: 380
          }
        : null;
    }
    case 'banner160x600': {
      const code = (adsConfig.banner160x600Code || '').trim();
      return adsConfig.banner160x600Enabled && code
        ? {
            slotKey,
            code,
            modalWidthClass: 'max-w-[340px]',
            initialHeight: 420,
            maxHeight: 640
          }
        : null;
    }
    case 'nativeBanner': {
      const code = (adsConfig.nativeBannerCode || '').trim();
      return adsConfig.nativeBannerEnabled && code
        ? {
            slotKey,
            code,
            modalWidthClass: 'max-w-[440px]',
            initialHeight: 240,
            maxHeight: 520
          }
        : null;
    }
  }
}

export function resolveTaskSubmissionAdUnit(adsConfig: AdsConfig): ResolvedTaskAdUnit | null {
  if (!adsConfig.adsEnabled) return null;
  const targetSlot: TaskAdSlotKey = adsConfig.taskAdSlot || 'banner300x250';
  return getSlotCandidate(adsConfig, targetSlot);
}

interface TaskSubmissionAdModalProps {
  isOpen: boolean;
  onClose: () => void;
  adsConfig: AdsConfig;
  language?: Language;
}

const TaskSubmissionAdModalInner: React.FC<TaskSubmissionAdModalProps> = ({
  isOpen,
  onClose,
  adsConfig,
  language = 'bn'
}) => {
  const isBn = language === 'bn';
  const unit = useMemo(() => resolveTaskSubmissionAdUnit(adsConfig), [adsConfig]);

  const iframeRef = useRef<HTMLIFrameElement>(null);
  const hasContentRef = useRef<boolean>(false);
  const frameIdRef = useRef<string>('task-ad-' + Math.random().toString(36).slice(2, 10));
  const [openInstance, setOpenInstance] = useState<number>(0);
  const [phase, setPhase] = useState<AdRenderPhase>('loading');
  const [frameHeight, setFrameHeight] = useState<number>(unit?.initialHeight ?? 250);
  const [secondsLeft, setSecondsLeft] = useState<number>(2);

  useEffect(() => {
    if (!isOpen || !unit) return;
    hasContentRef.current = false;
    frameIdRef.current = 'task-ad-' + Math.random().toString(36).slice(2, 10);
    setOpenInstance(n => n + 1);
    setPhase('loading');
    setFrameHeight(unit.initialHeight);
    setSecondsLeft(2);
  }, [isOpen, unit?.slotKey, unit?.code, unit?.initialHeight]);

  // Brief 2-second grace delay before enabling Close / Continue
  useEffect(() => {
    if (!isOpen || !unit || secondsLeft <= 0) return;
    const timer = setTimeout(() => {
      setSecondsLeft(prev => Math.max(0, prev - 1));
    }, 1000);
    return () => clearTimeout(timer);
  }, [isOpen, unit, secondsLeft]);

  const srcDoc = useMemo(() => {
    if (!isOpen || !unit) return '';
    return buildSandboxedAdDocument(unit.code, frameIdRef.current);
  }, [isOpen, unit, openInstance]);

  useEffect(() => {
    if (!isOpen || !unit) return;

    const handleMessage = (event: MessageEvent) => {
      try {
        if (!iframeRef.current || event.source !== iframeRef.current.contentWindow) {
          return;
        }
        const payload = event.data as {
          type?: string;
          id?: string;
          hasContent?: boolean;
          height?: number;
        } | null;

        if (payload && payload.type === 'MICROEARN_AD_STATUS' && payload.id === frameIdRef.current) {
          if (payload.hasContent) {
            hasContentRef.current = true;
            setPhase('loaded');
          }
          if (
            payload.hasContent &&
            typeof payload.height === 'number' &&
            Number.isFinite(payload.height) &&
            payload.height > 0
          ) {
            setFrameHeight(Math.min(unit.maxHeight, Math.max(50, Math.ceil(payload.height))));
          }
        }
      } catch {
        // Ignore cross-frame messaging errors
      }
    };

    window.addEventListener('message', handleMessage);

    // 6-second fallback: auto-hide & close smoothly if ad-blocker or zero-fill renders nothing
    let closeTimer: ReturnType<typeof setTimeout> | undefined;
    const fallbackTimer = setTimeout(() => {
      if (hasContentRef.current) return;
      const fallbackCheck = inspectIframeDomForAd(iframeRef.current);
      if (fallbackCheck.hasContent) {
        hasContentRef.current = true;
        setPhase('loaded');
        if (fallbackCheck.height > 0) {
          setFrameHeight(Math.min(unit.maxHeight, Math.max(50, fallbackCheck.height)));
        }
        return;
      }

      setPhase('collapsing');
      closeTimer = setTimeout(() => {
        setPhase('hidden');
        onClose();
      }, 260);
    }, 6000);

    return () => {
      window.removeEventListener('message', handleMessage);
      clearTimeout(fallbackTimer);
      if (closeTimer) clearTimeout(closeTimer);
    };
  }, [isOpen, unit, openInstance, onClose]);

  if (!isOpen || !unit || phase === 'hidden') {
    return null;
  }

  const canClose = secondsLeft === 0;
  const isCollapsing = phase === 'collapsing';

  return (
    <div
      className={`fixed inset-0 z-[80] flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-sm transition-opacity duration-200 ${
        isCollapsing ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
      role="dialog"
      aria-modal="true"
      aria-label={isBn ? 'বিজ্ঞাপন' : 'Sponsored Advertisement'}
    >
      <div
        className={`w-full ${unit.modalWidthClass} rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden transition-transform duration-200 ${
          isCollapsing ? 'scale-95' : 'scale-100'
        }`}
      >
        {/* Top Bar */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/50">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-200/70 dark:bg-slate-800 text-[10px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
            {isBn ? 'Sponsored / বিজ্ঞাপন' : 'Sponsored / Advertisement'}
          </span>

          <button
            type="button"
            disabled={!canClose}
            onClick={onClose}
            className={`w-8 h-8 rounded-xl flex items-center justify-center transition-colors ${
              canClose
                ? 'bg-slate-200/80 hover:bg-rose-600 text-slate-700 hover:text-white dark:bg-slate-800 dark:hover:bg-rose-600 dark:text-slate-200 cursor-pointer'
                : 'bg-slate-100 dark:bg-slate-800/50 text-slate-400 cursor-not-allowed'
            }`}
            aria-label={isBn ? 'বিজ্ঞাপন বন্ধ করুন' : 'Close Advertisement'}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Centered Transparent Ad Frame */}
        <div className="p-4 sm:p-5 flex flex-col items-center justify-center bg-transparent">
          <div className="w-full min-w-[160px] flex items-center justify-center bg-transparent overflow-hidden rounded-2xl">
            <iframe
              key={`${unit.slotKey}-${openInstance}`}
              ref={iframeRef}
              title="Task Sponsored Advertisement"
              srcDoc={srcDoc}
              sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"
              scrolling="no"
              style={{ height: `${frameHeight}px`, backgroundColor: 'transparent' }}
              className="w-full max-w-full border-0 bg-transparent overflow-hidden block transition-[height] duration-300 ease-out"
            />
          </div>
        </div>

        {/* Footer Continue / Close Button */}
        <div className="px-4 pb-4 pt-1">
          <button
            type="button"
            disabled={!canClose}
            onClick={onClose}
            className={`w-full py-2.5 px-4 rounded-xl text-xs sm:text-sm font-bold transition-all ${
              canClose
                ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm cursor-pointer'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 cursor-wait'
            }`}
          >
            {canClose
              ? isBn
                ? 'চালিয়ে যান / বন্ধ করুন (Continue)'
                : 'Continue / Close'
              : isBn
                ? `অপেক্ষা করুন (${secondsLeft} সেকেন্ড)...`
                : `Please wait (${secondsLeft}s)...`}
          </button>
        </div>
      </div>
    </div>
  );
};

export const TaskSubmissionAdModal: React.FC<TaskSubmissionAdModalProps> = props => (
  <AdRenderErrorBoundary>
    <TaskSubmissionAdModalInner {...props} />
  </AdRenderErrorBoundary>
);

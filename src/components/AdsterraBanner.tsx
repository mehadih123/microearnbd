import React, { Component, useEffect, useMemo, useRef, useState } from 'react';
import { AdsConfig, Language } from '../types';

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

const AdsterraBannerInner: React.FC<AdsterraBannerProps> = ({
  adsConfig,
  language = 'bn'
}) => {
  const isBn = language === 'bn';
  const trimmedCode = (adsConfig.bannerCode || '').trim();
  const shouldRender = Boolean(
    adsConfig.adsEnabled && adsConfig.bannerEnabled && trimmedCode.length > 0
  );

  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [frameHeight, setFrameHeight] = useState<number>(64);
  const [phase, setPhase] = useState<AdRenderPhase>('loading');
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
            const clamped = Math.min(600, Math.max(50, Math.ceil(payload.height)));
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
          setFrameHeight(Math.min(600, Math.max(50, fallbackCheck.height)));
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
  }, [shouldRender, codeSignature]);

  if (!shouldRender || phase === 'hidden') {
    return null;
  }

  const isCollapsing = phase === 'collapsing';
  const isLoaded = phase === 'loaded';

  return (
    <div
      aria-hidden={isCollapsing}
      className={`w-full flex justify-center transition-all duration-300 ease-out overflow-hidden ${
        isCollapsing ? 'max-h-0 opacity-0 pointer-events-none' : 'max-h-[720px] opacity-100'
      }`}
    >
      <div
        className={`w-full max-w-[360px] sm:max-w-full rounded-2xl border transition-colors duration-300 ${
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
        <div className="w-full min-w-[280px] flex justify-center items-center bg-transparent overflow-hidden rounded-xl">
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

export const AdsterraBanner: React.FC<AdsterraBannerProps> = props => (
  <AdRenderErrorBoundary>
    <AdsterraBannerInner {...props} />
  </AdRenderErrorBoundary>
);

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
    <style>
      html, body {
        margin: 0;
        padding: 0;
        background: transparent;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        min-height: 60px;
        width: 100%;
        overflow: hidden;
        font-family: system-ui, -apple-system, sans-serif;
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
    ${rawCode}
    <script>
      (function () {
        var FRAME_ID = ${JSON.stringify(frameId)};
        function postHeight() {
          try {
            var body = document.body;
            var doc = document.documentElement;
            var h = Math.max(
              body ? body.scrollHeight : 0,
              doc ? doc.scrollHeight : 0,
              60
            );
            parent.postMessage({ type: 'MICROEARN_AD_HEIGHT', id: FRAME_ID, height: h }, '*');
          } catch (e) {}
        }
        window.addEventListener('load', postHeight);
        setTimeout(postHeight, 350);
        setTimeout(postHeight, 1200);
        setTimeout(postHeight, 2500);
        if (typeof ResizeObserver !== 'undefined' && document.body) {
          try {
            new ResizeObserver(postHeight).observe(document.body);
          } catch (e) {}
        }
      })();
    </script>
  </body>
</html>`;
}

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
  const [frameHeight, setFrameHeight] = useState<number>(96);
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
    setFrameHeight(96);
  }, [codeSignature]);

  useEffect(() => {
    if (!shouldRender) return;
    const handleMessage = (event: MessageEvent) => {
      try {
        if (!iframeRef.current || event.source !== iframeRef.current.contentWindow) {
          return;
        }
        const payload = event.data as { type?: string; id?: string; height?: number } | null;
        if (
          payload &&
          payload.type === 'MICROEARN_AD_HEIGHT' &&
          payload.id === frameIdRef.current &&
          typeof payload.height === 'number' &&
          Number.isFinite(payload.height)
        ) {
          const clamped = Math.min(420, Math.max(60, Math.ceil(payload.height)));
          setFrameHeight(clamped);
        }
      } catch {
        // Ignore cross-frame resize errors
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [shouldRender]);

  if (!shouldRender) {
    return null;
  }

  return (
    <div className="w-full rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white/80 dark:bg-slate-900/70 p-2.5 sm:p-3 shadow-sm overflow-hidden">
      <div className="flex items-center justify-between gap-2 pb-1.5 mb-2 border-b border-slate-100 dark:border-slate-800/80">
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          {isBn ? 'Sponsored / বিজ্ঞাপন' : 'Sponsored / Advertisement'}
        </span>
      </div>
      <div className="w-full overflow-hidden rounded-xl flex justify-center items-center">
        <iframe
          key={codeSignature}
          ref={iframeRef}
          title="Sponsored Advertisement"
          srcDoc={srcDoc}
          sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox allow-forms"
          scrolling="no"
          loading="lazy"
          style={{ height: `${frameHeight}px` }}
          className="w-full max-w-full border-0 bg-transparent overflow-hidden block"
        />
      </div>
    </div>
  );
};

export const AdsterraBanner: React.FC<AdsterraBannerProps> = props => (
  <AdRenderErrorBoundary>
    <AdsterraBannerInner {...props} />
  </AdRenderErrorBoundary>
);

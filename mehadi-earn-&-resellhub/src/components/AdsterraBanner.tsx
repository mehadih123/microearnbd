import React, { useEffect, useRef } from 'react';

const ADSTERRA_SCRIPT_SRC =
  '//pl28414995.cpmrevenuegate.com/83e8fa538d0092244a141b773f324e93/invoke.js';
const ADSTERRA_CONTAINER_ID = 'container-83e8fa538d0092244a141b773f324e93';

export const AdsterraBanner: React.FC = () => {
  const slotRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const slotEl = slotRef.current;
    if (!slotEl) return;

    // Prevent duplicate script injection under React StrictMode or re-renders
    if (document.querySelector(`script[src="${ADSTERRA_SCRIPT_SRC}"]`)) {
      return;
    }

    const script = document.createElement('script');
    script.async = true;
    script.setAttribute('data-cfasync', 'false');
    script.src = ADSTERRA_SCRIPT_SRC;

    slotEl.appendChild(script);
  }, []);

  return (
    <div
      ref={slotRef}
      className="relative z-0 w-full max-w-full overflow-hidden rounded-2xl flex flex-col items-center justify-center"
    >
      <div
        id={ADSTERRA_CONTAINER_ID}
        className="w-full max-w-full overflow-hidden flex justify-center"
      />
    </div>
  );
};

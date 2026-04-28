import { useEffect } from 'react';

/**
 * Bloque le scroll du body (compatible iOS).
 *
 * Technique iOS: position: fixed + top négatif pour conserver la position.
 * On restaure la position à la fermeture.
 */
export function useBodyScrollLock(isLocked: boolean) {
  useEffect(() => {
    if (!isLocked) return;

    const body = document.body;
    const html = document.documentElement;

    const scrollY = window.scrollY || window.pageYOffset || 0;

    // Conserver styles pour restauration
    const prevOverflow = body.style.overflow;
    const prevPosition = body.style.position;
    const prevTop = body.style.top;
    const prevWidth = body.style.width;

    // iOS + Safari: overflow hidden ne suffit pas, donc on fixe le body
    body.style.overflow = 'hidden';
    body.style.position = 'fixed';
    body.style.top = `-${scrollY}px`;
    body.style.width = '100%';

    // Évite un "bounce" iOS par défaut
    const prevOverscroll = (html.style as any).overscrollBehaviorY;
    (html.style as any).overscrollBehaviorY = 'none';

    return () => {
      body.style.overflow = prevOverflow;
      body.style.position = prevPosition;
      body.style.top = prevTop;
      body.style.width = prevWidth;

      (html.style as any).overscrollBehaviorY = prevOverscroll;

      // Restore scroll position
      const restoredY = Math.abs(parseInt(body.style.top || '0', 10)) || scrollY;
      window.scrollTo(0, restoredY);
    };
  }, [isLocked]);
}


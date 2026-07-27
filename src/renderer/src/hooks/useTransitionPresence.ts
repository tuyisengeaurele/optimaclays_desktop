import { useEffect, useState } from 'react';

// Lets an overlay (modal, confirm dialog, toast) animate out instead of
// vanishing the instant its `open` flag flips - stays mounted for one more
// tick going in (so the closed styles paint before transitioning to open)
// and for `duration` ms going out (so the reverse transition can play
// before the DOM node is actually removed).
export function useTransitionPresence(open: boolean, duration = 180) {
  const [shouldRender, setShouldRender] = useState(open);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (open) {
      setShouldRender(true);
      const raf = requestAnimationFrame(() => setVisible(true));
      return () => cancelAnimationFrame(raf);
    }
    setVisible(false);
    const timeout = setTimeout(() => setShouldRender(false), duration);
    return () => clearTimeout(timeout);
  }, [open, duration]);

  return { shouldRender, visible };
}

import { useEffect, useRef, useState } from 'react';

export function useMotionPreference() {
  const [reduced, setReduced] = useState(() => matchMedia('(prefers-reduced-motion: reduce)').matches);
  const [enabled, setEnabled] = useState(() => {
    try { return localStorage.getItem('beatstore-motion') !== 'off'; } catch { return true; }
  });
  const active = enabled && !reduced;
  useEffect(() => {
    const media = matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReduced(media.matches);
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);
  useEffect(() => {
    document.documentElement.dataset.motion = active ? 'on' : 'off';
    try { localStorage.setItem('beatstore-motion', enabled ? 'on' : 'off'); } catch { /* Storage is optional. */ }
  }, [active, enabled]);
  useEffect(() => {
    const update = () => { document.documentElement.dataset.hidden = String(document.hidden); };
    update();
    document.addEventListener('visibilitychange', update);
    return () => document.removeEventListener('visibilitychange', update);
  }, []);
  return { active, reduced, toggle: () => setEnabled(value => !value) };
}

// One observer per collection, no scroll handler or animation loop.
export function useReveal(key: unknown) {
  const root = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!root.current) return;
    const nodes = root.current.querySelectorAll<HTMLElement>('[data-reveal]');
    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) {
        (entry.target as HTMLElement).dataset.visible = String(entry.isIntersecting);
        if (entry.isIntersecting) {
          (entry.target as HTMLElement).dataset.reveal = 'shown';
        }
      }
    }, { threshold: 0.08 });
    for (const node of nodes) {
      node.dataset.reveal = 'waiting';
      node.dataset.visible = 'false';
      observer.observe(node);
    }
    return () => observer.disconnect();
  }, [key]);
  return root;
}

export function useRecordMotion() {
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const target = root.current;
    if (!target) return;
    const plane = target.querySelector<HTMLElement>('.art-plane')!;
    const finePointer = matchMedia('(hover: hover) and (pointer: fine)');
    let frame = 0;
    const observer = new IntersectionObserver(([entry]) => {
      target.dataset.visible = String(Boolean(entry?.isIntersecting));
    });
    observer.observe(target);
    const move = (event: PointerEvent) => {
      if (!finePointer.matches || document.documentElement.dataset.motion !== 'on') return;
      const { clientX, clientY } = event;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const bounds = target.getBoundingClientRect();
        plane.style.setProperty('--tilt-x', `${-(clientY - bounds.top - bounds.height / 2) / bounds.height * 8}deg`);
        plane.style.setProperty('--tilt-y', `${(clientX - bounds.left - bounds.width / 2) / bounds.width * 8}deg`);
      });
    };
    const reset = () => {
      cancelAnimationFrame(frame);
      plane.style.removeProperty('--tilt-x');
      plane.style.removeProperty('--tilt-y');
    };
    target.addEventListener('pointermove', move, { passive: true });
    target.addEventListener('pointerleave', reset);
    return () => {
      cancelAnimationFrame(frame); observer.disconnect();
      target.removeEventListener('pointermove', move);
      target.removeEventListener('pointerleave', reset);
    };
  }, []);
  return root;
}

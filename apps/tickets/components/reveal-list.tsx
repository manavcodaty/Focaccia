'use client';

import { LazyMotion, domAnimation, m, useReducedMotion } from 'framer-motion';

export function RevealList({ children, className }: { children: React.ReactNode; className?: string }) {
  const reduceMotion = useReducedMotion();

  if (reduceMotion) return <div className={className}>{children}</div>;

  return (
    <LazyMotion features={domAnimation}>
      <m.div
        animate="visible"
        className={className}
        initial="rest"
        variants={{
          rest: { opacity: 1 },
          visible: { opacity: 1, transition: { staggerChildren: 0.045 } },
        }}
      >
        {children}
      </m.div>
    </LazyMotion>
  );
}

export function RevealItem({ children }: { children: React.ReactNode }) {
  const reduceMotion = useReducedMotion();

  if (reduceMotion) return <>{children}</>;

  return (
    <m.div
      variants={{
        rest: { opacity: 1, transform: 'translateY(5px)' },
        visible: { opacity: 1, transform: 'translateY(0px)', transition: { duration: 0.2, ease: [0.23, 1, 0.32, 1] } },
      }}
    >
      {children}
    </m.div>
  );
}

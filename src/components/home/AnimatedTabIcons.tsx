'use client';

import { useImperativeHandle } from 'react';
import { motion, useAnimation, type Variants } from 'motion/react';

const EASE = [0.4, 0, 0.2, 1] as const;

export type AnimatedIconHandle = {
  startAnimation: () => void;
  stopAnimation: () => void;
};

type IconShellProps = {
  className?: string;
  size?: number;
  ref?: React.Ref<AnimatedIconHandle>;
  children: (controls: ReturnType<typeof useAnimation>) => React.ReactNode;
} & Omit<React.HTMLAttributes<HTMLDivElement>, 'children' | 'ref'>;

function IconShell({ children, className, size = 14, ref, ...props }: IconShellProps) {
  const controls = useAnimation();

  useImperativeHandle(
    ref,
    () => ({
      startAnimation: () => controls.start('animate'),
      stopAnimation: () => controls.start('normal'),
    }),
    [controls]
  );

  return (
    <div
      className={className}
      onMouseEnter={() => controls.start('animate')}
      onMouseLeave={() => controls.start('normal')}
      {...props}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ overflow: 'visible' }}
      >
        {children(controls)}
      </svg>
    </div>
  );
}

export type AnimatedTabIconProps = {
  className?: string;
  size?: number;
  ref?: React.Ref<AnimatedIconHandle>;
};

export function FilmIcon({ className, size, ref, ...props }: AnimatedTabIconProps) {
  return (
    <IconShell className={className} size={size} ref={ref} {...props}>
      {(controls) => (
        <motion.g
          animate={controls}
          variants={{
            normal: { rotate: 0, scale: 1, transition: { duration: 0.3, ease: EASE } },
            animate: {
              rotate: [0, -6, 6, 0],
              scale: [1, 1.1, 1],
              transition: { duration: 0.6, ease: 'easeInOut' },
            },
          }}
          style={{ originX: '50%', originY: '50%' }}
        >
          <path d="M10 3v18" />
          <path d="M14 3v18" />
          <rect x="2" y="5" width="20" height="14" rx="2" />
        </motion.g>
      )}
    </IconShell>
  );
}

export function TvIcon({ className, size, ref, ...props }: AnimatedTabIconProps) {
  return (
    <IconShell className={className} size={size} ref={ref} {...props}>
      {(controls) => (
        <>
          <motion.rect
            x="2"
            y="7"
            width="20"
            height="15"
            rx="2"
            animate={controls}
            variants={{
              normal: { scale: 1, transition: { duration: 0.3, ease: EASE } },
              animate: { scale: [1, 1.08, 1], transition: { duration: 0.5, ease: EASE } },
            }}
            style={{ originX: '50%', originY: '100%' }}
          />
          <motion.polyline
            points="17 2 12 7 7 2"
            animate={controls}
            variants={{
              normal: { opacity: 1, transition: { duration: 0.3, ease: EASE } },
              animate: { opacity: [1, 0.4, 1], transition: { duration: 0.5, ease: EASE } },
            }}
          />
        </>
      )}
    </IconShell>
  );
}

export function ClapperboardIcon({ className, size, ref, ...props }: AnimatedTabIconProps) {
  return (
    <IconShell className={className} size={size} ref={ref} {...props}>
      {(controls) => (
        <>
          <path d="M20.2 6 3 11l-.9-2.4c-.3-1.1.3-2.2 1.3-2.5l13.5-4c1.1-.3 2.2.3 2.5 1.3Z" />
          <motion.path
            d="m6.2 5.3 3.1 3.9"
            animate={controls}
            variants={{
              normal: { opacity: 1, transition: { duration: 0.3, ease: EASE } },
              animate: { opacity: [1, 0.3, 1], transition: { duration: 0.5, ease: EASE } },
            }}
          />
          <motion.path
            d="m12.4 3.4 3.1 4"
            animate={controls}
            variants={{
              normal: { opacity: 1, transition: { duration: 0.3, ease: EASE } },
              animate: { opacity: [1, 0.3, 1], transition: { duration: 0.5, delay: 0.08, ease: EASE } },
            }}
          />
          <path d="M3 11h18v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" />
        </>
      )}
    </IconShell>
  );
}

export function GamepadIcon({ className, size, ref, ...props }: AnimatedTabIconProps) {
  return (
    <IconShell className={className} size={size} ref={ref} {...props}>
      {(controls) => (
        <>
          <motion.line
            x1="6"
            y1="12"
            x2="10"
            y2="12"
            animate={controls}
            variants={{
              normal: { scaleX: 1, transition: { duration: 0.3, ease: EASE } },
              animate: { scaleX: [1, 0.5, 1], transition: { duration: 0.6, ease: 'easeInOut' } },
            }}
            style={{ originX: '50%', originY: '50%' }}
          />
          <motion.line
            x1="8"
            y1="10"
            x2="8"
            y2="14"
            animate={controls}
            variants={{
              normal: { scaleY: 1, transition: { duration: 0.3, ease: EASE } },
              animate: { scaleY: [1, 0.5, 1], transition: { duration: 0.6, ease: 'easeInOut' } },
            }}
            style={{ originX: '50%', originY: '50%' }}
          />
          <motion.line
            x1="15"
            y1="13"
            x2="15.01"
            y2="13"
            animate={controls}
            variants={{
              normal: { scale: 1, transition: { duration: 0.3, ease: EASE } },
              animate: { scale: [1, 1.6, 1], transition: { duration: 0.6, ease: 'easeInOut' } },
            }}
            style={{ originX: '50%', originY: '50%' }}
          />
          <motion.line
            x1="18"
            y1="11"
            x2="18.01"
            y2="11"
            animate={controls}
            variants={{
              normal: { scale: 1, transition: { duration: 0.3, ease: EASE } },
              animate: { scale: [1, 1.6, 1], transition: { duration: 0.6, delay: 0.08, ease: 'easeInOut' } },
            }}
            style={{ originX: '50%', originY: '50%' }}
          />
          <path d="M17.32 5H6.68a4 4 0 0 0-3.978 3.59c-.006.052-.01.101-.017.152C2.604 9.416 2 14.456 2 16a3 3 0 0 0 3 3c1 0 1.5-.5 2-1l1.414-1.414A2 2 0 0 1 9.828 16h4.344a2 2 0 0 1 1.414.586L17 18c.5.5 1 1 2 1a3 3 0 0 0 3-3c0-1.545-.604-6.584-.685-7.258-.007-.05-.011-.1-.017-.151A4 4 0 0 0 17.32 5z" />
        </>
      )}
    </IconShell>
  );
}

const bookPages: Variants = {
  normal: { rotate: 0, transition: { duration: 0.3, ease: EASE } },
  animate: {
    rotate: [0, -12, 6, 0],
    transition: { duration: 0.7, ease: 'easeInOut' },
  },
};

export function BookOpenIcon({ className, size, ref, ...props }: AnimatedTabIconProps) {
  return (
    <IconShell className={className} size={size} ref={ref} {...props}>
      {(controls) => (
        <>
          <motion.path
            d="M12 7v14"
            animate={controls}
            variants={{
              normal: { opacity: 1, transition: { duration: 0.3, ease: EASE } },
              animate: { opacity: [1, 0.4, 1], transition: { duration: 0.7, ease: 'easeInOut' } },
            }}
          />
          <motion.path
            d="M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z"
            animate={controls}
            variants={{
              normal: { scale: 1, transition: { duration: 0.3, ease: EASE } },
              animate: { scale: [1, 1.1, 1], transition: { duration: 0.6, ease: EASE } },
            }}
            style={{ originX: '50%', originY: '50%' }}
          />
        </>
      )}
    </IconShell>
  );
}

export function MusicIcon({ className, size, ref, ...props }: AnimatedTabIconProps) {
  return (
    <IconShell className={className} size={size} ref={ref} {...props}>
      {(controls) => (
        <>
          <motion.path
            d="M9 18V5l12-2v13"
            animate={controls}
            variants={{
              normal: { x: 0, transition: { duration: 0.3, ease: EASE } },
              animate: { x: [0, 1, -1, 0], transition: { duration: 0.6, ease: 'easeInOut' } },
            }}
          />
          <motion.circle
            cx="6"
            cy="18"
            r="3"
            animate={controls}
            variants={{
              normal: { scale: 1, transition: { duration: 0.3, ease: EASE } },
              animate: { scale: [1, 1.2, 1], transition: { duration: 0.6, ease: 'easeInOut' } },
            }}
            style={{ originX: '50%', originY: '50%' }}
          />
          <motion.circle
            cx="18"
            cy="16"
            r="3"
            animate={controls}
            variants={{
              normal: { scale: 1, transition: { duration: 0.3, ease: EASE } },
              animate: { scale: [1, 1.2, 1], transition: { duration: 0.6, delay: 0.1, ease: 'easeInOut' } },
            }}
            style={{ originX: '50%', originY: '50%' }}
          />
        </>
      )}
    </IconShell>
  );
}

export function PodcastIcon({ className, size, ref, ...props }: AnimatedTabIconProps) {
  return (
    <IconShell className={className} size={size} ref={ref} {...props}>
      {(controls) => (
        <>
          <motion.circle
            cx="12"
            cy="11"
            r="1"
            fill="currentColor"
            stroke="none"
            animate={controls}
            variants={{
              normal: { scale: 1, transition: { duration: 0.3, ease: EASE } },
              animate: { scale: [1, 1.8, 1], transition: { duration: 0.5, ease: 'easeInOut' } },
            }}
            style={{ originX: '50%', originY: '50%' }}
          />
          <motion.path
            d="M15.54 8.46a5 5 0 0 1 0 7.07"
            animate={controls}
            variants={{
              normal: { opacity: 0.6, transition: { duration: 0.3, ease: EASE } },
              animate: { opacity: [0.6, 1, 0.6], transition: { duration: 0.6, ease: 'easeInOut' } },
            }}
          />
          <motion.path
            d="M19.07 4.93a10 10 0 0 1 0 14.14"
            animate={controls}
            variants={{
              normal: { opacity: 0.6, transition: { duration: 0.3, ease: EASE } },
              animate: { opacity: [0.6, 1, 0.6], transition: { duration: 0.6, delay: 0.1, ease: 'easeInOut' } },
            }}
          />
          <path d="M8.46 15.54a5 5 0 0 1 0-7.07" />
          <path d="M4.93 19.07a10 10 0 0 1 0-14.14" />
          <circle cx="12" cy="11" r="1" />
          <circle cx="12" cy="11" r="4" />
          <path d="m12 15 1.5 6H10.5z" />
        </>
      )}
    </IconShell>
  );
}

export function PuzzleIcon({ className, size, ref, ...props }: AnimatedTabIconProps) {
  return (
    <IconShell className={className} size={size} ref={ref} {...props}>
      {(controls) => (
        <motion.path
          d="M19.439 7.85c-.049.322.059.648.289.878l1.568 1.568c.47.47.706 1.087.706 1.704s-.235 1.233-.706 1.704l-1.611 1.611a.98.98 0 0 1-.837.276c-.47-.07-.802-.48-.968-.925a2.501 2.501 0 1 0-3.214 3.214c.446.166.855.497.925.968a.979.979 0 0 1-.276.837l-1.61 1.61a2.404 2.404 0 0 1-1.705.707 2.402 2.402 0 0 1-1.704-.706l-1.568-1.568a1.026 1.026 0 0 0-.877-.29c-.493.074-.84.504-1.02.968a2.5 2.5 0 1 1-3.237-3.237c.464-.18.894-.527.967-1.02a1.026 1.026 0 0 0-.289-.877l-1.568-1.568A2.402 2.402 0 0 1 1.998 12c0-.617.236-1.234.706-1.704L4.23 8.77c.24-.24.581-.353.917-.303.515.077.877.528 1.073 1.01a2.5 2.5 0 1 0 3.259-3.259c-.482-.196-.933-.558-1.01-1.073-.05-.336.062-.676.303-.917l1.525-1.525A2.402 2.402 0 0 1 12 1.998c.617 0 1.234.236 1.704.706l1.568 1.568c.23.23.556.338.877.29.493-.074.84-.504 1.02-.968a2.5 2.5 0 1 1 3.237 3.237c-.464.18-.894.527-.967 1.02Z"
          animate={controls}
          variants={{
            normal: { rotate: 0, scale: 1, transition: { duration: 0.3, ease: EASE } },
            animate: {
              rotate: [0, 90, 90, 360],
              scale: [1, 1.05, 1, 1],
              transition: { duration: 0.9, ease: 'easeInOut' },
            },
          }}
          style={{ originX: '50%', originY: '50%' }}
        />
      )}
    </IconShell>
  );
}

import { motion, useReducedMotion } from 'motion/react';
import { cx } from '@/lib/utils';
import { dur, ease, stagger } from '@/lib/motion';

interface SplitTextProps {
  text: string;
  className?: string;
  accentWord?: string;
}

/** Word-level reveal. Each word remains visible text so the accessible name is the copy itself. */
export function SplitText({ text, className, accentWord }: SplitTextProps) {
  const reduced = useReducedMotion();
  const words = text.split(' ');

  if (reduced) return <span className={cx('split-text', className)}>{text}</span>;

  return (
    <motion.span
      className={cx('split-text', className)}
      initial="hidden"
      animate="show"
      variants={{ hidden: {}, show: { transition: { staggerChildren: stagger.tight, delayChildren: 0.08 } } }}
    >
      {words.map((word, index) => (
        <motion.span
          key={`${word}-${index}`}
          className={cx('split-text__word', accentWord && word.includes(accentWord) && 'split-text__word--accent')}
          variants={{
            hidden: { opacity: 0, y: 18 },
            show: { opacity: 1, y: 0, transition: { duration: dur.slow, ease: ease.enter } },
          }}
        >
          {word}
          {index < words.length - 1 ? '\u00a0' : ''}
        </motion.span>
      ))}
    </motion.span>
  );
}

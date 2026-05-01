import { motion } from 'motion/react';
import { type Card, SUIT_SYMBOLS } from '../engine/poker';

interface Props {
  card: Card;
  hidden?: boolean;
  small?: boolean;
  highlight?: 'gold' | 'blue' | 'none';
}

export default function CardComponent({ card, hidden, small, highlight = 'none' }: Props) {
  const isRed = card.suit === 'hearts' || card.suit === 'diamonds';

  if (hidden) {
    return (
      <motion.div
        initial={{ rotateY: 180, scale: 0.8 }}
        animate={{ rotateY: 0, scale: 1 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
        className={`card-back rounded-lg flex items-center justify-center ${small ? 'w-9 h-13' : 'w-[52px] h-[74px]'}`}
      >
        <div className="card-back-pattern absolute inset-0 rounded-lg" />
        <div className="w-[80%] h-[80%] border border-white/5 rounded-md" />
      </motion.div>
    );
  }

  const highlightClass =
    highlight === 'gold' ? 'card-highlight-gold' :
    highlight === 'blue' ? 'card-highlight-blue' : '';

  return (
    <motion.div
      initial={{ rotateY: 180, scale: 0.8, opacity: 0 }}
      animate={{ rotateY: 0, scale: 1, opacity: 1 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
      className={`card-face relative rounded-lg flex flex-col justify-between select-none
        ${small ? 'w-9 h-13 p-0.5' : 'w-[52px] h-[74px] p-1'}
        ${isRed ? 'text-red-600' : 'text-slate-800'}
        ${highlightClass}`}
    >
      <div className={`font-bold leading-none ${small ? 'text-[9px]' : 'text-xs'}`}>
        {card.rank}
      </div>
      <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 ${small ? 'text-sm' : 'text-lg'}`}>
        {SUIT_SYMBOLS[card.suit]}
      </div>
      <div className={`font-bold leading-none self-end rotate-180 ${small ? 'text-[9px]' : 'text-xs'}`}>
        {card.rank}
      </div>
    </motion.div>
  );
}

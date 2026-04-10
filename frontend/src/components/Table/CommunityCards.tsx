import { motion, AnimatePresence } from 'framer-motion';
import { CardDisplay } from './CardDisplay';
import './Table.css';

interface Props {
  cards: string[];
}

export function CommunityCards({ cards }: Props) {
  return (
    <div className="community-cards">
      <AnimatePresence>
        {cards.map((card, i) => (
          <motion.div
            key={`${card}-${i}`}
            initial={{ opacity: 0, y: -30, rotateY: 180 }}
            animate={{ opacity: 1, y: 0, rotateY: 0 }}
            exit={{ opacity: 0 }}
            transition={{ delay: i * 0.15, duration: 0.4 }}
          >
            <CardDisplay card={card} size="medium" />
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

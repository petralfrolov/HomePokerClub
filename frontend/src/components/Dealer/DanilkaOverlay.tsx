import { motion } from 'framer-motion';
import './Dealer.css';

export function DanilkaOverlay() {
  return (
    <motion.div
      className="danilka-overlay"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.div
        className="danilka-banner"
        initial={{ scale: 0.5, rotate: -10 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ type: 'spring', stiffness: 200 }}
      >
        <div className="danilka-icon">🃏</div>
        <h2>Ой, карты выпали!</h2>
        <p>Перераздача!</p>
      </motion.div>

      {/* Scattered cards animation */}
      {Array.from({ length: 12 }).map((_, i) => (
        <motion.div
          key={i}
          className="scattered-card"
          initial={{
            x: 0, y: 0, rotate: 0, opacity: 1,
          }}
          animate={{
            x: (Math.random() - 0.5) * 800,
            y: (Math.random() - 0.5) * 600,
            rotate: Math.random() * 720 - 360,
            opacity: 0,
          }}
          transition={{ duration: 2, delay: i * 0.1 }}
        >
          🂠
        </motion.div>
      ))}
    </motion.div>
  );
}

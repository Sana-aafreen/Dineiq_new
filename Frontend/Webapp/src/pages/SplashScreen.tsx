import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import splashBg from '@/assets/restaurant-splash.jpg';

export default function SplashPage() {
  const navigate = useNavigate();
  const [phase, setPhase] = useState<'logo' | 'text' | 'exit'>('logo');

  useEffect(() => {
    const t1 = setTimeout(() => setPhase('text'), 600);
    const t2 = setTimeout(() => setPhase('exit'), 2000);
    const t3 = setTimeout(() => navigate('/login', { replace: true }), 2400);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [navigate]);

  return (
    <AnimatePresence>
      {phase !== 'exit' && (
        <motion.div
          exit={{ opacity: 0 }}
          transition={{ duration: 0.4 }}
          className="fixed inset-0 z-50 flex flex-col items-center justify-center overflow-hidden bg-primary"
        >
          <div className="absolute inset-0 opacity-20">
            <img src={splashBg} alt="" className="h-full w-full object-cover" />
          </div>

          <motion.div
            initial={{ scale: 0.3, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 200, damping: 15 }}
            className="relative z-10 flex flex-col items-center"
          >
            <div className="flex h-24 w-24 items-center justify-center rounded-3xl bg-primary-foreground shadow-2xl">
              <span className="text-4xl font-black text-primary">D</span>
            </div>

            <AnimatePresence>
              {phase === 'text' && (
                <motion.div
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4 }}
                  className="mt-5 text-center"
                >
                  <h1 className="text-4xl font-black text-primary-foreground tracking-tight">DineIQ</h1>
                  <p className="mt-1.5 text-sm font-medium text-primary-foreground/70">AI-Powered Dining Experience</p>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8 }}
            className="absolute bottom-16 z-10"
          >
            <div className="flex gap-1.5">
              {[0, 1, 2].map((i) => (
                <motion.div
                  key={i}
                  animate={{ opacity: [0.3, 1, 0.3] }}
                  transition={{ repeat: Infinity, duration: 1, delay: i * 0.2 }}
                  className="h-2 w-2 rounded-full bg-primary-foreground"
                />
              ))}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

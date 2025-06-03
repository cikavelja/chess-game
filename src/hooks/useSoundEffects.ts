import { useEffect, useRef } from 'react';

export const useSoundEffects = () => {
  const moveSound = useRef<HTMLAudioElement | null>(null);
  const captureSound = useRef<HTMLAudioElement | null>(null);
  const checkSound = useRef<HTMLAudioElement | null>(null);
  const castleSound = useRef<HTMLAudioElement | null>(null);
  const gameEndSound = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    // Create audio elements
    moveSound.current = new Audio('/sounds/move.mp3');
    captureSound.current = new Audio('/sounds/capture.mp3');
    checkSound.current = new Audio('/sounds/check.mp3');
    castleSound.current = new Audio('/sounds/castle.mp3');
    gameEndSound.current = new Audio('/sounds/game-end.mp3');

    // Preload sounds
    moveSound.current.load();
    captureSound.current.load();
    checkSound.current.load();
    castleSound.current.load();
    gameEndSound.current.load();

    return () => {
      // Cleanup
      moveSound.current = null;
      captureSound.current = null;
      checkSound.current = null;
      castleSound.current = null;
      gameEndSound.current = null;
    };
  }, []);

  const playMove = () => moveSound.current?.play().catch(() => {});
  const playCapture = () => captureSound.current?.play().catch(() => {});
  const playCheck = () => checkSound.current?.play().catch(() => {});
  const playCastle = () => castleSound.current?.play().catch(() => {});
  const playGameEnd = () => gameEndSound.current?.play().catch(() => {});

  return {
    playMove,
    playCapture,
    playCheck,
    playCastle,
    playGameEnd,
  };
};

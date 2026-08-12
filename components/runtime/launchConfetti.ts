import type confetti from 'canvas-confetti';

type ConfettiOptions = confetti.Options;

/** Load the non-essential renderer only after the action that needs it. */
export function launchConfetti(options: ConfettiOptions): void {
  void import('canvas-confetti')
    .then(({ default: renderConfetti }) => {
      renderConfetti({
        disableForReducedMotion: true,
        ...options,
      });
    })
    .catch(() => undefined);
}

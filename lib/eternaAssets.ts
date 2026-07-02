export type AvatarStateName = 'IDLE' | 'LISTENING' | 'THINKING' | 'TALKING' | 'GREETING' | 'WALKING';

export const AvatarAnimations = {
  IDLE: "/videos/tranquila.mp4",
  TALKING: "/videos/hablando.mp4",
  WALKING: [
    "/videos/caminando y hablando.mp4",
    "/videos/caminando y hablando2.mp4",
    "/videos/caminando y hablando3.mp4",
    "/videos/caminando y hablando4.mp4",
  ]
};

export const TRANSITION_MATRIX: Record<AvatarStateName, Partial<Record<AvatarStateName, number>>> = {
  IDLE: { TALKING: 180, WALKING: 250 },
  THINKING: { TALKING: 120 },
  LISTENING: { THINKING: 0, TALKING: 180 },
  TALKING: { IDLE: 180, WALKING: 200 },
  WALKING: { IDLE: 250, TALKING: 200 },
  GREETING: { IDLE: 150 }
};

export const DEFAULT_TRANSITION_MS = 200;

export function getTransitionDuration(from: AvatarStateName, to: AvatarStateName): number {
  if (from === to) return 0;
  return TRANSITION_MATRIX[from]?.[to] ?? DEFAULT_TRANSITION_MS;
}

export function getAvatarVideoUrl(state: AvatarStateName, currentUrl?: string): string {
  if (state === 'LISTENING' || state === 'THINKING' || state === 'IDLE' || state === 'GREETING') {
    return AvatarAnimations.IDLE;
  }
  if (state === 'WALKING') {
    return AvatarAnimations.WALKING[0];
  }
  if (state === 'TALKING') {
    const pool = [AvatarAnimations.TALKING, ...AvatarAnimations.WALKING];
    if (currentUrl && pool.includes(currentUrl)) {
      return currentUrl; // Keep playing currently active talking video
    }
    return AvatarAnimations.TALKING; // Default fallback
  }
  return AvatarAnimations.IDLE;
}

// For backward compatibility
export const ETERNA_ASSETS = {
  avatar: {
    idleVideo: AvatarAnimations.IDLE,
    talkingVideo: AvatarAnimations.TALKING,
  },
};

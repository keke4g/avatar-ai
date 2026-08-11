type EternaDebugWindow = typeof window & {
  __eternaAddDebugLog?: (message: string) => void;
  __eternaDebugLogs?: Array<{ time: string; message: string }>;
};

export function addVoiceDebugLog(message: string): void {
  if (typeof window === 'undefined') return;

  const debugWindow = window as EternaDebugWindow;
  if (debugWindow.__eternaAddDebugLog) {
    debugWindow.__eternaAddDebugLog(message);
    return;
  }

  debugWindow.__eternaDebugLogs = debugWindow.__eternaDebugLogs || [];
  debugWindow.__eternaDebugLogs.push({
    time: new Date().toLocaleTimeString(),
    message,
  });
}

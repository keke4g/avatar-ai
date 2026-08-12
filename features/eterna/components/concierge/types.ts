import type { TouchEventHandler } from 'react';

import type { StreamStatus } from '@/hooks/useWebSocketStream';
import type { LanguageType } from '@/lib/context/LanguageContext';
import type {
  EternaChatMessage,
  PropertySalesResponse,
} from '@/lib/eterna/propertySales';

export type ConciergeMode = 'avatar' | 'chat';
export type PropertyContactChannel = 'message' | 'call';

export type Translate = (
  path: string,
  replacements?: Record<string, string | number>,
  fallback?: string,
) => string;

export interface VoiceActionViewModel {
  ariaLabel: string;
  isSpeaking: boolean;
  isVoiceMode: boolean;
  label: string;
  tone: string;
}

export interface EternaLauncherViewModel {
  activeStatus: StreamStatus;
  isDiscrete: boolean;
  isHydrated: boolean;
  isListening: boolean;
  isPropertyPage: boolean;
  language: LanguageType;
  partialTranscript: string;
  showTooltip: boolean;
  userName?: string;
  visible: boolean;
  voiceAction: VoiceActionViewModel;
}

export interface EternaLauncherActions {
  onOpen: () => void;
  onVoiceAction: () => void;
}

export interface EternaAvatarViewModel {
  activeStatus: StreamStatus;
  hasActiveProperty: boolean;
  isCompact: boolean;
  isAvatarSpeaking: boolean;
  isListening: boolean;
  isMuted: boolean;
  isPresentingProperty: boolean;
  isPropertyPage: boolean;
  language: LanguageType;
  propertySales: PropertySalesResponse | null;
  propertyTitle?: string;
  statusMessage: string;
  voiceAction: VoiceActionViewModel;
}

export interface EternaChatHeaderViewModel {
  activeStatus: StreamStatus;
  contextLabel?: string;
  isHome: boolean;
  isListening: boolean;
  isMuted: boolean;
  language: LanguageType;
  statusMessage: string;
}

export interface EternaChatHistoryViewModel {
  activeStatus: StreamStatus;
  chatHistory: EternaChatMessage[];
  geminiActive: boolean;
  hasActiveProperty: boolean;
  isCompact: boolean;
  isConnected: boolean;
  isHome: boolean;
  isListening: boolean;
  language: LanguageType;
  partialTranscript: string;
  propertyTitle?: string;
  simulatedStatus: StreamStatus;
  simulatedText: string;
  translate: Translate;
  userName?: string;
  websocketStatus: StreamStatus;
  websocketText: string;
}

export interface EternaChatInputViewModel {
  activeStatus: StreamStatus;
  isCompact: boolean;
  isHome: boolean;
  isListening: boolean;
  translate: Translate;
  typedInput: string;
  voiceAction: VoiceActionViewModel;
}

export interface EternaDrawerViewModel {
  activeStatus: StreamStatus;
  avatar: EternaAvatarViewModel;
  chatHeader: EternaChatHeaderViewModel;
  chatHistory: EternaChatHistoryViewModel;
  chatInput: EternaChatInputViewModel;
  isCompact: boolean;
  isHome: boolean;
  isListening: boolean;
  isPropertyPage: boolean;
  isPropertyVisualActive: boolean;
  mode: ConciergeMode;
  visible: boolean;
}

export interface EternaDrawerActions {
  onAvatarSurfaceClick: () => void;
  onClose: () => void;
  onContact: (channel: PropertyContactChannel, message: string) => void;
  onInputChange: (value: string) => void;
  onMuteToggle: () => void;
  onNavigateMessage: (message: EternaChatMessage) => void;
  onPublishProperty: () => void;
  onRegister: () => void;
  onSend: (message?: string) => void;
  onShowAvatar: () => void;
  onShowChat: () => void;
  onSignIn: () => void;
  onSubmit: () => void;
  onToggleCompact: () => void;
  onTouchEnd: TouchEventHandler<HTMLDivElement>;
  onTouchStart: TouchEventHandler<HTMLDivElement>;
  onVoiceAction: () => void;
}

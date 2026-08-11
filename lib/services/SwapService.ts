import { SwapRequest, SwapStatus } from '../types';

export const SwapService = {
  updateStatus(swaps: SwapRequest[], swapId: string, status: SwapStatus): SwapRequest[] {
    return swaps.map((s) => (s.id === swapId ? { ...s, status } : s));
  },

  deleteSwap(swaps: SwapRequest[], swapId: string): SwapRequest[] {
    return swaps.filter((s) => s.id !== swapId);
  },

  createDispute(swaps: SwapRequest[], swapId: string, reason: string): SwapRequest[] {
    return swaps.map((s) => (s.id === swapId ? { ...s, isDisputed: true, disputeReason: reason } : s));
  },

  resolveDispute(swaps: SwapRequest[], swapId: string): SwapRequest[] {
    return swaps.map((s) => {
      if (s.id === swapId) {
        const { isDisputed: _isDisputed, disputeReason: _disputeReason, ...rest } = s;
        return rest as SwapRequest;
      }
      return s;
    });
  }
};

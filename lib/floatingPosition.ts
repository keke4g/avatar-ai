export type FloatingPosition = {
  top: number;
  left: number;
  placement: 'top' | 'bottom';
};

export function getSmartFloatingPosition(
  rect: DOMRect,
  {
    width,
    height,
    offset = 10,
    preferTop = false,
    padding = 16,
  }: { width: number; height: number; offset?: number; preferTop?: boolean; padding?: number }
): FloatingPosition {
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const spaceAbove = rect.top - padding;
  const spaceBelow = viewportHeight - rect.bottom - padding;
  const canOpenAbove = spaceAbove >= height + offset;
  const canOpenBelow = spaceBelow >= height + offset;
  const placement: 'top' | 'bottom' = preferTop
    ? (canOpenAbove || !canOpenBelow ? 'top' : 'bottom')
    : (canOpenBelow || !canOpenAbove ? 'bottom' : 'top');

  const rawTop = placement === 'top'
    ? rect.top - height - offset
    : rect.bottom + offset;
  const rawLeft = rect.left;

  return {
    placement,
    top: Math.max(padding, Math.min(rawTop, viewportHeight - height - padding)),
    left: Math.max(padding, Math.min(rawLeft, viewportWidth - width - padding)),
  };
}

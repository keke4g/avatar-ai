import type { PageAgentAction } from './pageAgent';

export interface PageControlSnapshot {
  kind: string;
  name: string;
  href: string;
  value: string;
  disabled: boolean;
}

export interface EternaPageSnapshot {
  url: string;
  title: string;
  viewport: { width: number; height: number };
  scroll: { x: number; y: number; progress: number };
  headings: string[];
  controls: PageControlSnapshot[];
  appState: unknown;
}

export type PageActionResult =
  | { status: 'completed'; target?: string }
  | { status: 'not_found'; target: string }
  | { status: 'confirmation_required'; target: string }
  | { status: 'ignored' };

const normalize = (value: string): string => value
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/\s+/g, ' ')
  .trim()
  .toLowerCase();

function isVisible(element: Element): element is HTMLElement {
  if (!(element instanceof HTMLElement)) return false;
  const style = window.getComputedStyle(element);
  const rect = element.getBoundingClientRect();
  return style.display !== 'none'
    && style.visibility !== 'hidden'
    && Number(style.opacity) > 0
    && rect.width > 2
    && rect.height > 2;
}

function getAccessibleName(element: Element): string {
  const html = element as HTMLElement;
  const input = element as HTMLInputElement;
  const image = element.querySelector('img[alt]') as HTMLImageElement | null;
  return (
    html.getAttribute('aria-label')
    || html.getAttribute('title')
    || html.getAttribute('data-eterna-label')
    || input.placeholder
    || html.innerText
    || image?.alt
    || ''
  ).replace(/\s+/g, ' ').trim().slice(0, 120);
}

export function captureEternaPageSnapshot(appState: unknown): EternaPageSnapshot {
  const headings = Array.from(document.querySelectorAll('h1, h2, h3, [role="heading"]'))
    .filter(isVisible)
    .map((element) => getAccessibleName(element))
    .filter(Boolean)
    .filter((value, index, all) => all.indexOf(value) === index)
    .slice(0, 20);

  const controls = Array.from(document.querySelectorAll(
    'button, a[href], input, select, textarea, summary, [role="button"], [role="link"], [data-eterna-action]',
  ))
    .filter((element) => !element.closest('[data-eterna-ui]'))
    .filter(isVisible)
    .map((element): PageControlSnapshot => ({
      kind: element.getAttribute('role') || element.tagName.toLowerCase(),
      name: getAccessibleName(element),
      href: element instanceof HTMLAnchorElement ? element.getAttribute('href') || '' : '',
      value: element instanceof HTMLInputElement || element instanceof HTMLSelectElement || element instanceof HTMLTextAreaElement
        ? String(element.value || '').slice(0, 120)
        : '',
      disabled: element instanceof HTMLButtonElement || element instanceof HTMLInputElement || element instanceof HTMLSelectElement
        ? element.disabled
        : element.getAttribute('aria-disabled') === 'true',
    }))
    .filter((control) => control.name)
    .filter((control, index, all) => all.findIndex((item) => item.kind === control.kind && item.name === control.name) === index)
    .slice(0, 60);

  const maxScroll = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
  return {
    url: `${window.location.pathname}${window.location.search}`,
    title: document.title,
    viewport: { width: window.innerWidth, height: window.innerHeight },
    scroll: {
      x: Math.round(window.scrollX),
      y: Math.round(window.scrollY),
      progress: Math.round((window.scrollY / maxScroll) * 100),
    },
    headings,
    controls,
    appState,
  };
}

function findBestElement(target: string, includeHeadings: boolean): HTMLElement | null {
  const query = normalize(target);
  if (!query) return null;

  const selector = includeHeadings
    ? 'h1, h2, h3, [role="heading"], section, button, a[href], input, select, textarea, summary, [role="button"], [role="link"], [data-eterna-action]'
    : 'button, a[href], input, select, textarea, summary, [role="button"], [role="link"], [data-eterna-action]';

  const scored = Array.from(document.querySelectorAll(selector))
    .filter((element) => !element.closest('[data-eterna-ui]'))
    .filter(isVisible)
    .map((element) => {
      const name = normalize(getAccessibleName(element));
      let score = 0;
      if (name === query) score = 100;
      else if (name.startsWith(query)) score = 85;
      else if (name.includes(query)) score = 70;
      else if (query.includes(name) && name.length >= 4) score = 45;
      return { element: element as HTMLElement, score, nameLength: name.length };
    })
    .filter((candidate) => candidate.score > 0)
    .sort((a, b) => b.score - a.score || a.nameLength - b.nameLength);

  return scored[0]?.element || null;
}

function reveal(element: HTMLElement) {
  element.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
  const previousOutline = element.style.outline;
  const previousOffset = element.style.outlineOffset;
  element.style.outline = '3px solid rgba(108, 99, 255, 0.92)';
  element.style.outlineOffset = '5px';
  window.setTimeout(() => {
    element.style.outline = previousOutline;
    element.style.outlineOffset = previousOffset;
  }, 2_600);
}

export async function executeSemanticPageAction(action: PageAgentAction): Promise<PageActionResult> {
  if (action.type !== 'scroll_to' && action.type !== 'click_element') {
    return { status: 'ignored' };
  }
  if (action.requiresConfirmation) {
    const element = findBestElement(action.target, action.type === 'scroll_to');
    if (element) reveal(element);
    return { status: 'confirmation_required', target: action.target };
  }

  const element = findBestElement(action.target, action.type === 'scroll_to');
  if (!element) return { status: 'not_found', target: action.target };

  reveal(element);
  if (action.type === 'click_element') {
    await new Promise((resolve) => window.setTimeout(resolve, 420));
    element.click();
  }
  return { status: 'completed', target: action.target };
}

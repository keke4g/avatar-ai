export const PROPERTY_WIZARD_DRAFT_STORAGE_KEY = 'auraswap_draft_property';
export const PROPERTY_WIZARD_DRAFT_TTL_MS = 7 * 24 * 60 * 60 * 1000;
export const PROPERTY_WIZARD_DRAFT_EVENT = 'auraswap:property-draft-updated';

export type PropertyWizardDraft = Record<string, unknown> & {
  draftId: string;
  createdAt: string;
  updatedAt: string;
  expiresAt: string;
  step?: number;
  title?: string;
  location?: string;
  country?: string;
  type?: string;
  images?: string[];
};

function createDraftId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `draft-${crypto.randomUUID()}`;
  }
  return `draft-${Date.now()}`;
}

function notifyDraftUpdated() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(PROPERTY_WIZARD_DRAFT_EVENT));
  }
}

export function readPropertyWizardDraft(): PropertyWizardDraft | null {
  if (typeof window === 'undefined') return null;

  const raw = window.localStorage.getItem(PROPERTY_WIZARD_DRAFT_STORAGE_KEY);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as Partial<PropertyWizardDraft>;
    const now = Date.now();
    const expiresAt = parsed.expiresAt ? Date.parse(parsed.expiresAt) : NaN;

    if (Number.isFinite(expiresAt) && expiresAt <= now) {
      window.localStorage.removeItem(PROPERTY_WIZARD_DRAFT_STORAGE_KEY);
      return null;
    }

    if (!parsed.draftId || !parsed.createdAt || !parsed.updatedAt || !parsed.expiresAt) {
      const timestamp = new Date(now).toISOString();
      const migrated: PropertyWizardDraft = {
        ...parsed,
        draftId: parsed.draftId || createDraftId(),
        createdAt: parsed.createdAt || timestamp,
        updatedAt: parsed.updatedAt || timestamp,
        expiresAt: parsed.expiresAt || new Date(now + PROPERTY_WIZARD_DRAFT_TTL_MS).toISOString(),
      };
      window.localStorage.setItem(PROPERTY_WIZARD_DRAFT_STORAGE_KEY, JSON.stringify(migrated));
      return migrated;
    }

    return parsed as PropertyWizardDraft;
  } catch {
    window.localStorage.removeItem(PROPERTY_WIZARD_DRAFT_STORAGE_KEY);
    return null;
  }
}

export function savePropertyWizardDraft(
  data: Record<string, unknown>,
): PropertyWizardDraft | null {
  if (typeof window === 'undefined') return null;

  const previous = readPropertyWizardDraft();
  if (previous) {
    const previousData = Object.fromEntries(
      Object.entries(previous).filter(([key]) => !['draftId', 'createdAt', 'updatedAt', 'expiresAt'].includes(key)),
    );
    if (JSON.stringify(previousData) === JSON.stringify(data)) {
      return previous;
    }
  }
  const now = new Date();
  const draft: PropertyWizardDraft = {
    ...data,
    draftId: previous?.draftId || createDraftId(),
    createdAt: previous?.createdAt || now.toISOString(),
    updatedAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + PROPERTY_WIZARD_DRAFT_TTL_MS).toISOString(),
  };

  window.localStorage.setItem(PROPERTY_WIZARD_DRAFT_STORAGE_KEY, JSON.stringify(draft));
  notifyDraftUpdated();
  return draft;
}

export function removePropertyWizardDraft() {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(PROPERTY_WIZARD_DRAFT_STORAGE_KEY);
  notifyDraftUpdated();
}

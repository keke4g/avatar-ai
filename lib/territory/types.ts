export type TerritorialDomain =
  | 'demographics'
  | 'economic_sectors'
  | 'employment'
  | 'income'
  | 'informality'
  | 'business_activity'
  | 'housing_need'
  | 'housing_market'
  | 'purchasing_power';

export type TerritorialEvidenceKind =
  | 'official_observation'
  | 'official_projection'
  | 'derived_inference'
  | 'coverage_limit';

export type TerritorialGeographyLevel = 'NATION' | 'STATE' | 'MUNICIPALITY';

export interface TerritorialGeography {
  level: TerritorialGeographyLevel;
  officialCode: string;
  name: string;
  stateCode?: string;
  stateName?: string;
}

export interface TerritorialCitation {
  id: string;
  sourceCode: string;
  organization: string;
  title: string;
  officialUrl: string;
  locator: string;
  period: string;
  retrievedAt: string;
  sourceRole: 'primary' | 'official_aggregator';
}

export interface TerritorialFact {
  id: string;
  domain: TerritorialDomain;
  label: string;
  value: number | string | null;
  unit: string;
  period: string;
  geography: TerritorialGeography;
  evidence: TerritorialEvidenceKind;
  citationIds: string[];
  dimensions?: Record<string, string | number | boolean | null>;
  caveats?: string[];
}

export interface TerritorialInference {
  id: string;
  domain: TerritorialDomain;
  label: string;
  value: number | string | null;
  unit: string;
  geography: TerritorialGeography;
  evidence: 'derived_inference';
  methodology: string;
  inputFactIds: string[];
  citationIds: string[];
  confidence: 'LOW' | 'MEDIUM' | 'HIGH';
  caveats: string[];
}

export interface TerritorialQuality {
  status: 'OK' | 'PARTIAL' | 'UNAVAILABLE';
  coverage: string;
  freshness: string;
  missingDomains: TerritorialDomain[];
  warnings: string[];
}

export interface TerritorialIntelligenceContext {
  schemaVersion: 'territorial-intelligence-v1';
  query: string;
  requestedDomains: TerritorialDomain[];
  geography: TerritorialGeography;
  facts: TerritorialFact[];
  inferences: TerritorialInference[];
  citations: TerritorialCitation[];
  quality: TerritorialQuality;
  responseRules: string[];
}

export interface TerritorialPropertyContext {
  priceAmount?: number;
  monthlyRent?: number;
  currency?: string;
  city?: string;
  state?: string;
  location?: string;
}

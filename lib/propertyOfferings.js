"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildDefaultSwapOffering = buildDefaultSwapOffering;
exports.createOfferingsFromProperty = createOfferingsFromProperty;
exports.normalizeOfferings = normalizeOfferings;
exports.syncPropertyOfferings = syncPropertyOfferings;
exports.ensurePropertyOfferings = ensurePropertyOfferings;
exports.getOfferingByMode = getOfferingByMode;
exports.getOfferingsByMode = getOfferingsByMode;
exports.hasOfferingMode = hasOfferingMode;
exports.getActiveOfferings = getActiveOfferings;
exports.getPrimaryOffering = getPrimaryOffering;
const ACTIVE_STATUSES = new Set(['ACTIVE']);
/**
 * Generates the default legacy SWAP offering configuration.
 */
function buildDefaultSwapOffering(property) {
    return {
        id: `legacy-swap-${property.id}`,
        propertyId: property.id,
        mode: 'SWAP',
        status: property.isPublished === false ? 'PAUSED' : 'ACTIVE',
        visibility: 'PUBLIC',
        title: property.title,
        description: property.description,
        priceAmount: null,
        currency: 'USD',
        billingPeriod: 'NONE',
        securityDepositAmount: null,
        cleaningFeeAmount: null,
        serviceFeePercent: null,
        commissionPercent: null,
        minNights: null,
        maxNights: null,
        minMonths: null,
        maxMonths: null,
        isPriceNegotiable: false,
        acceptsOffers: true,
        requiresApproval: true,
        allowInstantRequest: false,
        swapPreferences: {},
        swapValueTier: property.valueRating,
        auraScoreOverride: property.auraScore,
        availableFrom: property.availableStart || null,
        availableUntil: property.availableEnd || null,
        isFeatured: property.isFeatured ?? false,
        featuredUntil: property.featuredUntil ?? null,
        featuredRank: property.featuredRank ?? 0,
        metadata: {
            source: 'legacy_property_fields',
        },
    };
}
/**
 * Creates default offerings from list of selected modes.
 */
function createOfferingsFromProperty(property, modes) {
    const offerings = modes.map(mode => {
        if (mode === 'SWAP') {
            return buildDefaultSwapOffering(property);
        }
        return {
            id: `offering-${mode}-${property.id}-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
            propertyId: property.id,
            mode,
            status: (property.isPublished === false ? 'PAUSED' : 'ACTIVE'),
            visibility: 'PUBLIC',
            title: property.title,
            description: property.description,
            priceAmount: mode === 'SALE' ? 500000 : 150,
            currency: 'USD',
            billingPeriod: mode === 'SALE' ? 'TOTAL' : (mode === 'MONTHLY_RENT' ? 'MONTH' : 'NIGHT'),
            securityDepositAmount: null,
            cleaningFeeAmount: null,
            serviceFeePercent: null,
            commissionPercent: null,
            minNights: mode === 'SHORT_RENT' ? 2 : null,
            maxNights: null,
            minMonths: mode === 'MONTHLY_RENT' ? 1 : null,
            maxMonths: null,
            isPriceNegotiable: true,
            acceptsOffers: true,
            requiresApproval: true,
            allowInstantRequest: false,
            swapPreferences: {},
            swapValueTier: null,
            auraScoreOverride: null,
            availableFrom: property.availableStart || null,
            availableUntil: property.availableEnd || null,
            isFeatured: false,
            featuredUntil: null,
            featuredRank: 0,
            metadata: {},
        };
    });
    return normalizeOfferings(offerings, property);
}
/**
 * Normalizes an array of offerings: guarantees ID, propertyId, status, currency, etc.
 * Critical: Prevents duplicate modes by keeping only the latest configuration of each mode.
 */
function normalizeOfferings(offerings, property) {
    if (!offerings || offerings.length === 0) {
        return [buildDefaultSwapOffering(property)];
    }
    const uniqueOfferingsMap = {};
    for (const offering of offerings) {
        const mode = offering.mode;
        if (!mode)
            continue;
        uniqueOfferingsMap[mode] = {
            ...offering,
            id: offering.id || `offering-${mode}-${property.id}-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
            propertyId: property.id,
            status: offering.status || (property.isPublished === false ? 'PAUSED' : 'ACTIVE'),
            visibility: offering.visibility || 'PUBLIC',
            currency: offering.currency || 'USD',
            billingPeriod: offering.billingPeriod || (mode === 'SALE' ? 'TOTAL' : (mode === 'MONTHLY_RENT' ? 'MONTH' : 'NIGHT')),
            swapValueTier: mode === 'SWAP' ? (offering.swapValueTier || property.valueRating) : null,
            auraScoreOverride: mode === 'SWAP' ? (offering.auraScoreOverride || property.auraScore) : null,
            availableFrom: offering.availableFrom || property.availableStart || null,
            availableUntil: offering.availableUntil || property.availableEnd || null,
            isPriceNegotiable: offering.isPriceNegotiable ?? (mode === 'SWAP' ? false : true),
            acceptsOffers: offering.acceptsOffers ?? true,
            requiresApproval: offering.requiresApproval ?? true,
            allowInstantRequest: offering.allowInstantRequest ?? false,
            isFeatured: offering.isFeatured ?? false,
            featuredRank: offering.featuredRank ?? 0,
            metadata: offering.metadata || {},
        };
    }
    return Object.values(uniqueOfferingsMap);
}
/**
 * Merges current database offerings with new offerings payload.
 * Preserves the UUID `id` fields of current offerings if the mode continues to exist.
 * Discards any modes not present in target `newOfferings`.
 */
function syncPropertyOfferings(currentOfferings, newOfferings) {
    const currentMap = {};
    for (const o of currentOfferings) {
        currentMap[o.mode] = o;
    }
    const uniqueTargetOfferingsMap = {};
    for (const o of newOfferings) {
        const existing = currentMap[o.mode];
        uniqueTargetOfferingsMap[o.mode] = {
            ...o,
            id: existing?.id || o.id || `offering-${o.mode}-${o.propertyId || 'prop'}-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        };
    }
    return Object.values(uniqueTargetOfferingsMap);
}
function ensurePropertyOfferings(property) {
    return {
        ...property,
        offerings: normalizeOfferings(property.offerings || [], property),
    };
}
function getOfferingByMode(property, mode) {
    return getOfferingsByMode(property, mode)[0] || null;
}
function getOfferingsByMode(property, mode, options = {}) {
    const hydrated = ensurePropertyOfferings(property);
    return (hydrated.offerings || []).filter((offering) => {
        if (offering.mode !== mode)
            return false;
        if (options.activeOnly && !ACTIVE_STATUSES.has(offering.status))
            return false;
        return true;
    });
}
function hasOfferingMode(property, mode) {
    return Boolean(getOfferingByMode(property, mode));
}
function getActiveOfferings(property) {
    const hydrated = ensurePropertyOfferings(property);
    return (hydrated.offerings || []).filter((offering) => ACTIVE_STATUSES.has(offering.status));
}
function getPrimaryOffering(property) {
    const hydrated = ensurePropertyOfferings(property);
    const activeSwap = hydrated.offerings?.find((offering) => offering.mode === 'SWAP' && offering.status === 'ACTIVE');
    return activeSwap || hydrated.offerings?.[0] || buildDefaultSwapOffering(property);
}

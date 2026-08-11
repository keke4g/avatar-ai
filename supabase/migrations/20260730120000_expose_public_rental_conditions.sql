-- Expose only the rental conditions needed by the public property page.
-- The complete offering metadata remains private because it can contain
-- internal commercial information.
create or replace view public.public_property_offerings_view
with (security_invoker = false)
as
select
  offering.id,
  offering.property_id,
  offering.commercial_code,
  offering.mode,
  offering.status,
  offering.visibility,
  offering.title,
  offering.description,
  offering.price_amount,
  offering.currency,
  offering.billing_period,
  offering.security_deposit_amount,
  offering.cleaning_fee_amount,
  offering.service_fee_percent,
  offering.min_nights,
  offering.max_nights,
  offering.min_months,
  offering.max_months,
  offering.is_price_negotiable,
  offering.accepts_offers,
  offering.requires_approval,
  offering.allow_instant_request,
  offering.swap_preferences,
  offering.swap_value_tier,
  offering.aura_score_override,
  offering.available_from,
  offering.available_until,
  offering.is_featured,
  offering.featured_until,
  offering.featured_rank,
  offering.accepts_bank_credit,
  offering.accepts_infonavit,
  offering.accepts_fovissste,
  offering.accepts_cash,
  offering.developer_financing,
  offering.deposit_amount,
  offering.advance_months,
  offering.requires_guarantor,
  offering.requires_legal_policy,
  offering.swap_min_value,
  offering.swap_max_value,
  offering.swap_cash_difference_allowed,
  offering.annual_property_tax,
  offering.water_monthly_avg,
  offering.electricity_monthly_avg,
  offering.gas_monthly_avg,
  offering.estimated_delivery_date,
  offering.created_at,
  offering.updated_at,
  case
    when offering.metadata ->> 'rentalFurnishingStatus' in (
      'UNFURNISHED',
      'SEMI_FURNISHED',
      'FURNISHED'
    )
      then offering.metadata ->> 'rentalFurnishingStatus'
    else null
  end as rental_furnishing_status,
  case
    when jsonb_typeof(offering.metadata -> 'includedRentalServices') = 'array'
      then offering.metadata -> 'includedRentalServices'
    else '[]'::jsonb
  end as included_rental_services,
  case
    when jsonb_typeof(offering.metadata -> 'acceptsPets') = 'boolean'
      then (offering.metadata ->> 'acceptsPets')::boolean
    else null
  end as accepts_pets,
  case
    when jsonb_typeof(offering.metadata -> 'includesMaintenance') = 'boolean'
      then (offering.metadata ->> 'includesMaintenance')::boolean
    else null
  end as includes_maintenance
from public.property_offerings offering
join public.properties property on property.id = offering.property_id
where property.is_published = true
  and property.folder_status = 'PUBLISHED'
  and coalesce(property.is_demo, false) = false
  and offering.status = 'ACTIVE'::public.property_offering_status
  and offering.visibility = 'PUBLIC'::public.property_offering_visibility;

grant select on public.public_property_offerings_view to anon, authenticated;

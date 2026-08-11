const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
const https = require('https');

// Load env variables
const envPath = path.resolve(__dirname, '../.env.local');
let envContent = '';
try {
  envContent = fs.readFileSync(envPath, 'utf8');
} catch (e) {
  console.error('Failed to read .env.local', e);
  process.exit(1);
}

const env = {};
envContent.split('\n').forEach(line => {
  const parts = line.split('=');
  if (parts.length >= 2) {
    const key = parts[0].trim();
    const val = parts.slice(1).join('=').trim().replace(/^['"]|['"]$/g, '');
    env[key] = val;
  }
});

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const googleApiKey = env.GOOGLE_API_KEY || env.NEXT_PUBLIC_GOOGLE_API_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Supabase credentials not found in env');
  process.exit(1);
}

if (!googleApiKey) {
  console.error('Google API key not found in env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Helper for HTTP GET requests
function httpGet(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', (err) => reject(err));
  });
}

// Helper to escape CSV fields
function toCSVCell(val) {
  if (val === null || val === undefined) return '""';
  const str = String(val).replace(/"/g, '""');
  return `"${str}"`;
}

// Help write CSV lines
function writeCSV(filename, headers, rows) {
  const headerLine = headers.join(',') + '\n';
  const rowLines = rows.map(row => headers.map(h => toCSVCell(row[h])).join(',')).join('\n');
  fs.writeFileSync(filename, headerLine + rowLines, 'utf8');
  console.log(`Saved: ${filename} (${rows.length} rows)`);
}

async function run() {
  const args = process.argv.slice(2);
  const isWriteMode = args.includes('--write');

  console.log('=== GEOLOCATION AUDIT & GEOMIGRATION ===');
  console.log(`Mode: ${isWriteMode ? 'WRITE (updates database)' : 'AUDIT ONLY (no database write)'}`);

  // Fetch all properties
  const { data: properties, error } = await supabase
    .from('properties')
    .select('*');

  if (error) {
    console.error('Error fetching properties from Supabase:', error);
    process.exit(1);
  }

  console.log(`Fetched ${properties.length} properties from database.`);

  const noCoords = [];
  const suspiciousCoords = [];
  const goodCoords = [];

  properties.forEach(prop => {
    const lat = prop.latitude;
    const lng = prop.longitude;
    const country = prop.country || '';

    const isNullOrZero = lat === null || lng === null || lat === undefined || lng === undefined || (lat === 0 && lng === 0);
    const latNum = Number(lat);
    const lngNum = Number(lng);
    const isFiniteVal = Number.isFinite(latNum) && Number.isFinite(lngNum);

    if (isNullOrZero || !isFiniteVal) {
      noCoords.push(prop);
      return;
    }

    // Suspicious checks
    // 1. Tokyo (35.6 +/- 0.6, 139.7 +/- 0.6)
    const isTokyo = latNum >= 35.0 && latNum <= 36.2 && lngNum >= 139.0 && lngNum <= 140.2;
    
    // 2. CDMX mock check: if country is México but lat/lng are CDMX mock coordinates and address/location isn't CDMX
    const isCdmxMock = latNum >= 19.3 && latNum <= 19.5 && lngNum >= -99.2 && lngNum <= -99.0;
    const locationLower = (prop.location || '').toLowerCase();
    const isNotCdmxLocation = !locationLower.includes('cdmx') && !locationLower.includes('mexico') && !locationLower.includes('distrito');
    const isSuspiciousCdmx = isCdmxMock && isNotCdmxLocation;

    // 3. Country is México but coordinates are outside Mexico bounds
    const isDeclaredMexico = country.toLowerCase() === 'méxico' || country.toLowerCase() === 'mexico' || country.toLowerCase() === 'mx';
    const isOutsideMexico = isDeclaredMexico && !(latNum >= 14 && latNum <= 33 && lngNum >= -118 && lngNum <= -86);

    // 4. Europe check: roughly lat in 36..70, lng in -10..30
    const isEurope = latNum >= 36.0 && latNum <= 70.0 && lngNum >= -10.0 && lngNum <= 30.0;
    const isDeclaredMexicoEurope = isDeclaredMexico && isEurope;

    if (isTokyo || isSuspiciousCdmx || isOutsideMexico || isDeclaredMexicoEurope) {
      suspiciousCoords.push({
        ...prop,
        reason: isTokyo ? 'Tokyo mock coords' : isSuspiciousCdmx ? 'CDMX mock coords' : isOutsideMexico ? 'Outside Mexico boundaries' : 'Europe coords for Mexico'
      });
      return;
    }

    goodCoords.push(prop);
  });

  console.log(`Audit results:`);
  console.log(`- Without coordinates: ${noCoords.length}`);
  console.log(`- Suspicious coordinates: ${suspiciousCoords.length}`);
  console.log(`- Valid coordinates: ${goodCoords.length}`);

  // Write Phase 1 reports
  writeCSV(
    'properties_without_coordinates.csv',
    ['id', 'title', 'location', 'country', 'address'],
    noCoords
  );

  writeCSV(
    'properties_with_suspicious_coordinates.csv',
    ['id', 'title', 'location', 'country', 'address', 'latitude', 'longitude', 'reason'],
    suspiciousCoords
  );

  // Now, geocode properties that need correction (no coordinates or suspicious ones)
  const toGeocode = [...noCoords, ...suspiciousCoords];
  console.log(`\nGeocoding ${toGeocode.length} properties...`);

  const sqlUpdates = [];
  const manualReviews = [];
  const geocodedSuccessfully = [];

  for (const prop of toGeocode) {
    const addressQuery = [prop.address, prop.location, prop.country].filter(Boolean).join(', ');
    if (!addressQuery.trim()) {
      manualReviews.push({
        ...prop,
        review_reason: 'Empty address fields'
      });
      continue;
    }

    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(addressQuery)}&key=${googleApiKey}`;
    
    try {
      console.log(`Querying Google for ID ${prop.id}: "${addressQuery}"`);
      const response = await httpGet(url);

      if (response.status === 'OK' && response.results && response.results.length > 0) {
        const results = response.results;
        const mainResult = results[0];
        const locationType = mainResult.geometry?.location_type;
        const isPartialMatch = mainResult.partial_match;

        const lat = mainResult.geometry?.location?.lat;
        const lng = mainResult.geometry?.location?.lng;
        const placeId = mainResult.place_id;
        const formattedAddress = mainResult.formatted_address;

        let cityVal = '';
        let stateVal = '';
        let countryVal = '';

        if (mainResult.address_components) {
          for (const component of mainResult.address_components) {
            const types = component.types;
            if (types.includes('locality')) {
              cityVal = component.long_name;
            } else if (types.includes('administrative_area_level_1')) {
              stateVal = component.long_name;
            } else if (types.includes('country')) {
              countryVal = component.long_name;
            }
          }
        }

        // Confidence evaluation
        const isHighConfidence = results.length === 1 && !isPartialMatch && (locationType === 'ROOFTOP' || locationType === 'RANGE_INTERPOLATED');

        const geocodeResult = {
          id: prop.id,
          title: prop.title,
          address_query: addressQuery,
          formatted_address: formattedAddress,
          latitude: lat,
          longitude: lng,
          place_id: placeId,
          city: cityVal,
          state: stateVal,
          country: countryVal,
          confidence: isHighConfidence ? 'HIGH' : 'LOW/AMBIGUOUS',
          location_type: locationType,
          partial_match: isPartialMatch ? 'TRUE' : 'FALSE'
        };

        if (isHighConfidence) {
          geocodedSuccessfully.push(geocodeResult);

          // Prepare SQL Update query
          sqlUpdates.push(
            `UPDATE public.properties SET ` +
            `latitude = ${lat}, longitude = ${lng}, place_id = ${toCSVCell(placeId)}, ` +
            `formatted_address = ${toCSVCell(formattedAddress)}, city = ${toCSVCell(cityVal)}, ` +
            `state = ${toCSVCell(stateVal)}, geometry_source = 'google_geocoding' ` +
            `WHERE id = '${prop.id}';`
          );

          if (isWriteMode) {
            // Write directly to DB
            const { error: updateErr } = await supabase
              .from('properties')
              .update({
                latitude: lat,
                longitude: lng,
                place_id: placeId,
                formatted_address: formattedAddress,
                city: cityVal,
                state: stateVal,
                geometry_source: 'google_geocoding'
              })
              .eq('id', prop.id);

            if (updateErr) {
              console.error(`Failed to update DB for ID ${prop.id}: ${updateErr.message}`);
            } else {
              console.log(`Successfully updated database for ID ${prop.id}`);
            }
          }
        } else {
          manualReviews.push({
            ...prop,
            review_reason: `Low confidence (location_type: ${locationType}, partial_match: ${isPartialMatch ? 'yes' : 'no'}, results count: ${results.length})`,
            google_result: formattedAddress
          });
        }
      } else {
        manualReviews.push({
          ...prop,
          review_reason: `Google Geocoding status: ${response.status}`
        });
      }
    } catch (e) {
      console.error(`Error querying geocoder for ID ${prop.id}:`, e);
      manualReviews.push({
        ...prop,
        review_reason: `Error: ${e.message}`
      });
    }

    // Add a tiny delay to respect rate limits
    await new Promise(r => setTimeout(r, 100));
  }

  // Write manual review CSV
  writeCSV(
    'properties_needing_manual_review.csv',
    ['id', 'title', 'location', 'country', 'address', 'review_reason', 'google_result'],
    manualReviews
  );

  // Write SQL script
  fs.writeFileSync('update_properties_geocoded.sql', sqlUpdates.join('\n'), 'utf8');
  console.log(`\nGenerated SQL updates: update_properties_geocoded.sql (${sqlUpdates.length} statements)`);

  console.log('\n=== GEOMIGRATION REPORT ===');
  console.log(`Total properties requiring geocoding: ${toGeocode.length}`);
  console.log(`- Successfully geocoded (High confidence): ${geocodedSuccessfully.length}`);
  console.log(`- Moved to manual review (Low confidence/Ambiguous/Errors): ${manualReviews.length}`);
  console.log(`===========================`);
}

run();

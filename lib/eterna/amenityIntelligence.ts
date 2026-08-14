import {
  AMENITY_OPTIONS,
  PROPERTY_FEATURE_GROUPS,
  groupPropertyFeatures,
} from '../propertyFeatures';

type AmenityLanguage = 'es' | 'en';
type AmenityScope = 'interior' | 'exterior' | 'private' | 'shared';

interface AmenityNarrativeOptions {
  amenities: string[];
  language: AmenityLanguage;
  prompt: string;
}

export interface AmenityNarrative {
  reply: string;
  speech: string;
  suggestedReplies: string[];
}

interface AmenityAliasRule {
  label: string;
  phrases: string[];
}

const normalizeAmenityText = (value: string): string => value
  .toLocaleLowerCase('es-MX')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/[^\p{L}\p{N}\s]/gu, ' ')
  .replace(/\s+/g, ' ')
  .trim();

const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const phrasePattern = (phrase: string): RegExp => (
  new RegExp(`(?:^|\\s)${escapeRegExp(phrase).replace(/\s+/g, '\\s+')}(?=$|\\s)`, 'i')
);

const containsPhrase = (source: string, phrase: string): boolean => (
  phrase.length > 0 && phrasePattern(phrase).test(source)
);

const AMENITY_ALIAS_RULES: AmenityAliasRule[] = [
  { label: 'Pet center', phrases: ['pet center', 'pet zone', 'zona pet', 'zona de mascotas', 'area de mascotas', 'parque para perros'] },
  { label: 'Game room', phrases: ['game room', 'gaming room', 'zona gamer', 'cuarto de juegos', 'sala de juegos', 'salon de juegos'] },
  { label: 'Cinema room', phrases: ['cinema room', 'home theater', 'cine privado', 'sala de cine', 'salon de cine'] },
  { label: 'Sports room', phrases: ['sports room', 'sala deportiva', 'salon deportivo'] },
  { label: 'Yoga room', phrases: ['yoga room', 'sala de yoga', 'salon de yoga'] },
  { label: 'Social room', phrases: ['social room', 'sala social', 'salon social'] },
  { label: 'Salón de usos múltiples', phrases: ['salon de usos multiples', 'sala de usos multiples', 'salon multiusos', 'area multiusos'] },
  { label: 'Área de juegos infantiles', phrases: ['area de juegos infantiles', 'juegos infantiles', 'zona infantil', 'area infantil'] },
  { label: 'Business center', phrases: ['business center', 'centro de negocios'] },
  { label: 'Coworking', phrases: ['coworking', 'co working', 'espacio de trabajo compartido'] },
  { label: 'Family Room', phrases: ['family room', 'sala familiar', 'estancia familiar'] },
  { label: 'Sala TV', phrases: ['sala tv', 'sala de television', 'cuarto de television'] },
  { label: 'Fire pit', phrases: ['fire pit', 'fogatero', 'area de fogata', 'zona de fogata'] },
  { label: 'Lobby / recepción', phrases: ['lobby', 'recepcion', 'lobby recepcion'] },
  { label: 'Estacionamiento para visitas', phrases: ['estacionamiento para visitas', 'parking de visitas', 'cochera de visitas'] },
  { label: 'Cargador vehículo eléctrico', phrases: ['cargador vehiculo electrico', 'cargador para auto electrico', 'cargador ev', 'ev charger'] },
  { label: 'Internet fibra óptica', phrases: ['internet fibra optica', 'fibra optica', 'internet de alta velocidad'] },
  { label: 'Cerradura inteligente', phrases: ['cerradura inteligente', 'smart lock'] },
  { label: 'Roof Garden compartido', phrases: ['roof garden compartido', 'roof comun', 'azotea comun'] },
  { label: 'Alberca compartida', phrases: ['alberca compartida', 'piscina compartida', 'alberca comun', 'piscina comun'] },
  { label: 'Terraza común', phrases: ['terraza comun', 'terraza compartida'] },
  { label: 'Jardín común', phrases: ['jardin comun', 'jardin compartido'] },
  { label: 'Spa compartido', phrases: ['spa compartido', 'spa comun'] },
  { label: 'Cancha deportiva compartida', phrases: ['cancha deportiva compartida', 'cancha compartida', 'cancha comun'] },
  { label: 'Roof Garden', phrases: ['roof garden', 'azotea verde'] },
  { label: 'Alberca', phrases: ['alberca', 'piscina', 'pool'] },
  { label: 'Gimnasio', phrases: ['gimnasio', 'gym', 'fitness center'] },
  { label: 'Domótica', phrases: ['domotica', 'casa inteligente', 'smart home'] },
];

const getAliasRule = (label: string): AmenityAliasRule | undefined => {
  const normalizedLabel = normalizeAmenityText(label);
  return AMENITY_ALIAS_RULES.find((rule) => normalizeAmenityText(rule.label) === normalizedLabel);
};

const getFeatureGroup = (amenity: string): 'spaces' | 'private' | 'shared' | 'other' => {
  const normalized = normalizeAmenityText(amenity);
  const group = PROPERTY_FEATURE_GROUPS.find((candidate) => (
    candidate.options.some((option) => normalizeAmenityText(option) === normalized)
  ));
  return group?.key || 'other';
};

const isOutdoorAmenity = (amenity: string): boolean => (
  /\b(?:balcon|terraza|roof garden|azotea|jardin|patio|alberca|piscina|jacuzzi|asador|huerto|cancha|fire pit|fogatero|exterior|aire libre)\b/
    .test(normalizeAmenityText(amenity))
);

const getRequestedScope = (prompt: string): AmenityScope | null => {
  const normalized = normalizeAmenityText(prompt);
  if (/\b(?:areas? comunes?|amenidades compartidas?|zonas? comunes?|condominio|edificio)\b/.test(normalized)) return 'shared';
  if (/\b(?:exteriores?|areas? exteriores?|al aire libre|outdoor)\b/.test(normalized)) return 'exterior';
  if (/\b(?:interiores?|areas? interiores?|dentro de la propiedad|indoor)\b/.test(normalized)) return 'interior';
  if (/\b(?:amenidades privadas?|uso exclusivo|exclusivas?)\b/.test(normalized)) return 'private';
  return null;
};

const uniqueAmenities = (amenities: string[]): string[] => {
  const values = new Map<string, string>();
  amenities.map((amenity) => amenity.trim()).filter(Boolean).forEach((amenity) => {
    const normalized = normalizeAmenityText(amenity);
    if (normalized && !values.has(normalized)) values.set(normalized, amenity);
  });
  return [...values.values()];
};

const extractRequestedLabels = (prompt: string, availableAmenities: string[]): string[] => {
  let remainder = normalizeAmenityText(prompt);
  const requested = new Map<string, string>();
  const register = (label: string) => requested.set(normalizeAmenityText(label), label);

  AMENITY_ALIAS_RULES.forEach((rule) => {
    const matchedPhrase = [...rule.phrases]
      .map(normalizeAmenityText)
      .sort((left, right) => right.length - left.length)
      .find((phrase) => containsPhrase(remainder, phrase));
    if (!matchedPhrase) return;
    register(rule.label);
    remainder = remainder.replace(phrasePattern(matchedPhrase), ' ').replace(/\s+/g, ' ').trim();
  });

  const directCandidates = uniqueAmenities([
    ...AMENITY_OPTIONS,
    ...availableAmenities,
  ]).sort((left, right) => normalizeAmenityText(right).length - normalizeAmenityText(left).length);

  directCandidates.forEach((candidate) => {
    const normalizedCandidate = normalizeAmenityText(candidate);
    if (!containsPhrase(remainder, normalizedCandidate)) return;
    register(candidate);
    remainder = remainder.replace(phrasePattern(normalizedCandidate), ' ').replace(/\s+/g, ' ').trim();
  });

  return [...requested.values()];
};

const findPublishedAmenity = (requestedLabel: string, availableAmenities: string[]): string | null => {
  const normalizedRequested = normalizeAmenityText(requestedLabel);
  const exact = availableAmenities.find((amenity) => normalizeAmenityText(amenity) === normalizedRequested);
  if (exact) return exact;

  const alias = getAliasRule(requestedLabel);
  if (!alias) return null;
  const phrases = [alias.label, ...alias.phrases].map(normalizeAmenityText);
  return availableAmenities.find((amenity) => {
    const normalizedAmenity = normalizeAmenityText(amenity);
    return phrases.some((phrase) => containsPhrase(normalizedAmenity, phrase));
  }) || null;
};

const getAmenityExperience = (amenity: string, language: AmenityLanguage): string => {
  const normalized = normalizeAmenityText(amenity);
  const descriptions = language === 'es'
    ? [
        { pattern: /\bpet center\b/, text: `${amenity} crea un punto dedicado para atender y convivir con tu mascota sin improvisar en las áreas sociales` },
        { pattern: /\bgame room\b/, text: `${amenity} suma un espacio separado para jugar, convivir o recibir visitas sin ocupar las áreas privadas` },
        { pattern: /\b(?:cinema room|cine|home theater)\b/, text: `${amenity} permite disfrutar películas y reuniones audiovisuales fuera de la sala principal` },
        { pattern: /\b(?:ludoteca|juegos infantiles|zona infantil)\b/, text: `${amenity} ofrece a niñas y niños un entorno pensado para jugar y convivir cerca de casa` },
        { pattern: /\b(?:yoga room|sala de yoga)\b/, text: `${amenity} facilita reservar un momento tranquilo para movilidad, respiración y bienestar` },
        { pattern: /\b(?:sports room|sala deportiva)\b/, text: `${amenity} concentra actividades recreativas y deportivas en un ambiente independiente` },
        { pattern: /\b(?:social room|salon social|usos multiples|multiusos)\b/, text: `${amenity} brinda un lugar flexible para celebrar, reunirse o convivir sin invadir la vivienda` },
        { pattern: /\b(?:coworking|business center|centro de negocios)\b/, text: `${amenity} permite trabajar o reunirse sin convertir las áreas de descanso en oficina` },
        { pattern: /\b(?:sala doble altura)\b/, text: `${amenity} combina convivencia con una sensación vertical más abierta y luminosa` },
        { pattern: /\b(?:family room|sala familiar)\b/, text: `${amenity} crea un ambiente informal para descansar y compartir en familia` },
        { pattern: /\b(?:sala tv|sala de television)\b/, text: `${amenity} concentra entretenimiento cotidiano en un espacio distinto de la sala principal` },
        { pattern: /\b(?:sala|living|estancia)\b/, text: `${amenity} favorece momentos cómodos de convivencia y descanso` },
        { pattern: /\b(?:comedor|dining)\b/, text: `${amenity} crea un lugar natural para compartir comidas y conversaciones` },
        { pattern: /\b(?:cocina con isla|isla)\b/, text: `${amenity} añade superficie de trabajo y un punto informal para cocinar o convivir` },
        { pattern: /\b(?:cocina equipada|cocina integral|cocina|kitchen)\b/, text: `${amenity} hace más práctica la preparación diaria y mantiene integrada la actividad social` },
        { pattern: /\b(?:desayunador)\b/, text: `${amenity} ofrece un rincón ágil para comidas cotidianas sin ocupar el comedor formal` },
        { pattern: /\b(?:biblioteca)\b/, text: `${amenity} propone un ambiente sereno para leer, concentrarse o desconectarse` },
        { pattern: /\b(?:oficina|estudio|workspace)\b/, text: `${amenity} brinda un espacio separado para concentrarse, trabajar o estudiar` },
        { pattern: /\b(?:cuarto de servicio)\b/, text: `${amenity} ayuda a separar tareas de apoyo de las áreas sociales y privadas` },
        { pattern: /\b(?:lavado|lavanderia|laundry)\b/, text: `${amenity} mantiene la rutina doméstica ordenada y fuera de las áreas sociales` },
        { pattern: /\b(?:vestidor)\b/, text: `${amenity} facilita organizar ropa y accesorios sin saturar la recámara` },
        { pattern: /\b(?:bodega|almacenamiento)\b/, text: `${amenity} permite conservar las áreas habitables despejadas y bien organizadas` },
        { pattern: /\b(?:cava)\b/, text: `${amenity} reserva un lugar específico para conservar y presentar vinos` },
        { pattern: /\b(?:bar)\b/, text: `${amenity} crea un punto social para recibir visitas y disfrutar reuniones informales` },
        { pattern: /\b(?:balcon)\b/, text: `${amenity} ofrece una pausa al aire libre y extiende visualmente el espacio interior` },
        { pattern: /\b(?:terraza|roof garden|azotea|patio)\b/, text: `${amenity} amplía las posibilidades de convivencia y descanso al aire libre` },
        { pattern: /\b(?:jardin|garden)\b/, text: `${amenity} aporta contacto con el exterior y un ambiente más sereno` },
        { pattern: /\b(?:alberca|piscina|pool)\b/, text: `${amenity} invita a relajarse y disfrutar momentos de recreación dentro del entorno residencial` },
        { pattern: /\b(?:jacuzzi)\b/, text: `${amenity} añade una alternativa de relajación más íntima y pausada` },
        { pattern: /\b(?:sauna)\b/, text: `${amenity} incorpora una experiencia orientada al descanso y la recuperación personal` },
        { pattern: /\b(?:gimnasio|gym|fitness)\b/, text: `${amenity} facilita integrar actividad física y bienestar a la rutina diaria` },
        { pattern: /\b(?:spa)\b/, text: `${amenity} acerca experiencias de cuidado y relajación sin salir del desarrollo` },
        { pattern: /\b(?:asador)\b/, text: `${amenity} favorece comidas al aire libre y reuniones más informales` },
        { pattern: /\b(?:huerto)\b/, text: `${amenity} suma una relación práctica y tranquila con plantas y alimentos` },
        { pattern: /\b(?:cancha)\b/, text: `${amenity} permite practicar deporte y convivir sin desplazamientos adicionales` },
        { pattern: /\b(?:fire pit|fogatero|fogata)\b/, text: `${amenity} crea un punto cálido de reunión para tardes y noches al aire libre` },
        { pattern: /\b(?:domotica|alexa|smart home)\b/, text: `${amenity} puede simplificar rutinas mediante controles y automatizaciones integradas` },
        { pattern: /\b(?:cerradura inteligente|smart lock)\b/, text: `${amenity} hace más práctico administrar el acceso cotidiano a la vivienda` },
        { pattern: /\b(?:paneles solares)\b/, text: `${amenity} incorpora una alternativa para aprovechar energía solar en la operación del inmueble` },
        { pattern: /\b(?:cargador vehiculo electrico|ev charger)\b/, text: `${amenity} facilita cargar un vehículo eléctrico desde el entorno residencial` },
        { pattern: /\b(?:fibra optica|internet de alta velocidad)\b/, text: `${amenity} favorece trabajo remoto, entretenimiento y conectividad estable` },
        { pattern: /\b(?:elevador|ascensor|elevator)\b/, text: `${amenity} mejora la accesibilidad y simplifica los desplazamientos cotidianos` },
        { pattern: /\b(?:lobby|recepcion)\b/, text: `${amenity} ofrece una llegada más ordenada y un punto claro para recibir visitas` },
        { pattern: /\b(?:estacionamiento para visitas)\b/, text: `${amenity} facilita recibir invitados sin ocupar los lugares asignados a residentes` },
        { pattern: /\b(?:estacionamiento|cochera|garage|parking)\b/, text: `${amenity} hace más cómoda y ordenada la llegada a casa` },
        { pattern: /\b(?:aire acondicionado|minisplit|climatizacion)\b/, text: `${amenity} ayuda a conservar una temperatura agradable durante el día` },
        { pattern: /\b(?:vista|ocean view|city view)\b/, text: `${amenity} suma luz, perspectiva y una experiencia visual más agradable` },
        { pattern: /\b(?:amueblado|amueblada|muebles|furnished)\b/, text: `${amenity} permite imaginar una instalación más sencilla y con menos pendientes iniciales` },
        { pattern: /\b(?:mascota|pet friendly|pets)\b/, text: `${amenity} hace más fácil integrar a las mascotas en la vida cotidiana` },
      ]
    : [
        { pattern: /\bpet center\b/, text: `${amenity} creates a dedicated place to care for and spend time with pets away from social areas` },
        { pattern: /\bgame room\b/, text: `${amenity} provides a separate place to play, socialize, or host friends without taking over private rooms` },
        { pattern: /\b(?:cinema room|cinema|home theater)\b/, text: `${amenity} offers a dedicated setting for movies and audiovisual gatherings` },
        { pattern: /\b(?:ludoteca|children play|kids)\b/, text: `${amenity} gives children a nearby setting designed for play and social time` },
        { pattern: /\b(?:yoga room)\b/, text: `${amenity} makes it easier to reserve a calm moment for movement and wellbeing` },
        { pattern: /\b(?:sports room)\b/, text: `${amenity} keeps recreational and sports activities in a dedicated setting` },
        { pattern: /\b(?:social room|multi purpose)\b/, text: `${amenity} offers a flexible place to gather or celebrate without taking over the home` },
        { pattern: /\b(?:coworking|business center)\b/, text: `${amenity} supports work and meetings without turning rest areas into an office` },
        { pattern: /\b(?:sala doble altura|double height)\b/, text: `${amenity} combines social living with a more open and luminous vertical feel` },
        { pattern: /\b(?:family room)\b/, text: `${amenity} creates a relaxed setting for everyday family time` },
        { pattern: /\b(?:sala tv|tv room)\b/, text: `${amenity} keeps daily entertainment separate from the main living room` },
        { pattern: /\b(?:sala|living|estancia)\b/, text: `${amenity} creates a comfortable setting for connection and rest` },
        { pattern: /\b(?:comedor|dining)\b/, text: `${amenity} provides a natural place for shared meals and conversation` },
        { pattern: /\b(?:cocina con isla|island kitchen)\b/, text: `${amenity} adds useful prep space and an informal place to cook or connect` },
        { pattern: /\b(?:cocina|kitchen|desayunador)\b/, text: `${amenity} makes everyday meals and routines more practical` },
        { pattern: /\b(?:biblioteca|library)\b/, text: `${amenity} offers a calmer place to read, focus, or disconnect` },
        { pattern: /\b(?:oficina|estudio|workspace|office)\b/, text: `${amenity} provides a dedicated place to focus, work, or study` },
        { pattern: /\b(?:cuarto de servicio|service room)\b/, text: `${amenity} keeps support routines separate from social and private areas` },
        { pattern: /\b(?:lavado|lavanderia|laundry)\b/, text: `${amenity} keeps household routines organized and away from social areas` },
        { pattern: /\b(?:vestidor|walk in closet)\b/, text: `${amenity} helps organize clothing and accessories without crowding the bedroom` },
        { pattern: /\b(?:bodega|storage)\b/, text: `${amenity} helps keep living areas clear and organized` },
        { pattern: /\b(?:cava|wine cellar)\b/, text: `${amenity} provides a dedicated place to store and present wine` },
        { pattern: /\b(?:bar)\b/, text: `${amenity} creates a social point for guests and informal gatherings` },
        { pattern: /\b(?:balcon|balcony)\b/, text: `${amenity} offers an outdoor pause and visually extends the interior` },
        { pattern: /\b(?:terraza|roof garden|patio|terrace)\b/, text: `${amenity} expands the options for outdoor rest and social time` },
        { pattern: /\b(?:jardin|garden)\b/, text: `${amenity} adds a calmer connection with the outdoors` },
        { pattern: /\b(?:alberca|piscina|pool)\b/, text: `${amenity} encourages relaxation and recreation within the residential setting` },
        { pattern: /\b(?:jacuzzi|sauna|spa)\b/, text: `${amenity} adds a convenient setting for personal rest and recovery` },
        { pattern: /\b(?:gimnasio|gym|fitness)\b/, text: `${amenity} makes daily wellness and exercise more convenient` },
        { pattern: /\b(?:asador|grill)\b/, text: `${amenity} supports outdoor meals and informal gatherings` },
        { pattern: /\b(?:huerto|garden plot)\b/, text: `${amenity} adds a practical and calm connection with plants and food` },
        { pattern: /\b(?:cancha|court)\b/, text: `${amenity} supports sports and recreation without an extra trip` },
        { pattern: /\b(?:fire pit)\b/, text: `${amenity} creates a warm gathering point for outdoor evenings` },
        { pattern: /\b(?:domotica|alexa|smart home)\b/, text: `${amenity} can simplify routines through integrated controls and automation` },
        { pattern: /\b(?:cerradura inteligente|smart lock)\b/, text: `${amenity} makes everyday access easier to manage` },
        { pattern: /\b(?:paneles solares|solar panels)\b/, text: `${amenity} adds a way to use solar energy in the property's operation` },
        { pattern: /\b(?:cargador vehiculo electrico|ev charger)\b/, text: `${amenity} makes charging an electric vehicle convenient at home` },
        { pattern: /\b(?:fibra optica|fiber optic)\b/, text: `${amenity} supports remote work, entertainment, and stable connectivity` },
        { pattern: /\b(?:elevador|ascensor|elevator)\b/, text: `${amenity} improves accessibility and everyday movement` },
        { pattern: /\b(?:lobby|recepcion)\b/, text: `${amenity} creates a more orderly arrival and a clear point for visitors` },
        { pattern: /\b(?:estacionamiento para visitas|visitor parking)\b/, text: `${amenity} makes hosting easier without using resident parking spaces` },
        { pattern: /\b(?:estacionamiento|cochera|garage|parking)\b/, text: `${amenity} makes arriving home easier and more orderly` },
        { pattern: /\b(?:aire acondicionado|minisplit|air conditioning)\b/, text: `${amenity} helps maintain a comfortable indoor temperature` },
        { pattern: /\b(?:vista|view)\b/, text: `${amenity} adds light, perspective, and a more enjoyable outlook` },
        { pattern: /\b(?:amueblado|furnished)\b/, text: `${amenity} can make moving in simpler with fewer initial decisions` },
        { pattern: /\b(?:mascota|pet friendly|pets)\b/, text: `${amenity} makes it easier to include pets in everyday life` },
      ];

  return descriptions.find(({ pattern }) => pattern.test(normalized))?.text
    || (language === 'es'
      ? `${amenity} aporta una posibilidad concreta para hacer más cómoda y disfrutable la vida cotidiana`
      : `${amenity} adds a concrete way to make everyday living more comfortable and enjoyable`);
};

const joinNaturally = (items: string[], language: AmenityLanguage): string => {
  if (items.length <= 1) return items[0] || '';
  const conjunction = language === 'es' ? 'y' : 'and';
  return `${items.slice(0, -1).join(', ')} ${conjunction} ${items.at(-1)}`;
};

const getEvidenceNote = (amenities: string[], language: AmenityLanguage): string => {
  const groups = new Set(amenities.map(getFeatureGroup));
  if (language === 'en') {
    if (groups.size === 1 && groups.has('spaces')) return 'The listing confirms the space, but does not specify its dimensions, furniture, or finishes.';
    if (groups.size === 1 && groups.has('shared')) return 'The listing confirms the shared amenity, but does not specify its equipment, capacity, schedule, or rules.';
    if (groups.size === 1 && groups.has('private')) return 'The listing confirms the feature, but does not provide technical specifications, dimensions, or conditions of use.';
    return 'The listing confirms what I mentioned, but does not provide detailed dimensions, equipment, or conditions of use.';
  }
  if (groups.size === 1 && groups.has('spaces')) return 'El anuncio confirma el espacio, pero no detalla sus dimensiones, mobiliario ni acabados.';
  if (groups.size === 1 && groups.has('shared')) return 'El anuncio confirma la amenidad compartida, pero no detalla su equipamiento, capacidad, horarios ni reglamento.';
  if (groups.size === 1 && groups.has('private')) return 'El anuncio confirma la amenidad, pero no publica especificaciones técnicas, dimensiones ni condiciones de uso.';
  return 'El anuncio confirma lo mencionado, pero no publica dimensiones, equipamiento ni condiciones de uso detalladas.';
};

const filterByScope = (amenities: string[], scope: AmenityScope): string[] => amenities.filter((amenity) => {
  const group = getFeatureGroup(amenity);
  if (scope === 'shared') return group === 'shared';
  if (scope === 'private') return group === 'private';
  if (scope === 'exterior') return isOutdoorAmenity(amenity);
  return group === 'spaces' && !isOutdoorAmenity(amenity);
});

const buildSpecificNarrative = (
  matchedAmenities: string[],
  missingLabels: string[],
  language: AmenityLanguage,
): AmenityNarrative => {
  const experiences = matchedAmenities.map((amenity) => getAmenityExperience(amenity, language));
  const missing = missingLabels.length > 0
    ? (language === 'es'
        ? ` En cambio, el anuncio no confirma ${joinNaturally(missingLabels, language)}.`
        : ` The listing does not confirm ${joinNaturally(missingLabels, language)}.`)
    : '';
  const reply = language === 'es'
    ? `${joinNaturally(experiences, language)}. ${getEvidenceNote(matchedAmenities, language)}${missing} ¿Quieres abrir la galería para buscar ${matchedAmenities.length === 1 ? 'este espacio' : 'estos espacios'} o revisar otra amenidad?`
    : `${joinNaturally(experiences, language)}. ${getEvidenceNote(matchedAmenities, language)}${missing} Would you like to open the gallery to look for ${matchedAmenities.length === 1 ? 'this space' : 'these spaces'}, or review another amenity?`;
  return {
    reply,
    speech: reply,
    suggestedReplies: language === 'es' ? ['Abrir galería', 'Revisar otra amenidad'] : ['Open gallery', 'Review another amenity'],
  };
};

const buildMissingNarrative = (
  missingLabels: string[],
  language: AmenityLanguage,
): AmenityNarrative => {
  const reply = language === 'es'
    ? `El anuncio no confirma ${joinNaturally(missingLabels, language)}. Eso no demuestra que no exista; significa que no está publicado dentro del inventario verificado y prefiero no asumirlo. ¿Quieres ver las amenidades que sí están confirmadas o abrir la galería?`
    : `The listing does not confirm ${joinNaturally(missingLabels, language)}. That does not prove it is absent; it means it is not part of the verified published inventory, and I will not assume it. Would you like to see the confirmed amenities or open the gallery?`;
  return {
    reply,
    speech: reply,
    suggestedReplies: language === 'es' ? ['Ver amenidades confirmadas', 'Abrir galería'] : ['View confirmed amenities', 'Open gallery'],
  };
};

const buildScopedNarrative = (
  scopedAmenities: string[],
  scope: AmenityScope,
  language: AmenityLanguage,
): AmenityNarrative => {
  const labels = {
    es: { interior: 'espacios interiores', exterior: 'espacios exteriores', private: 'amenidades privadas', shared: 'áreas comunes' },
    en: { interior: 'interior spaces', exterior: 'outdoor spaces', private: 'private amenities', shared: 'shared amenities' },
  } as const;
  if (scopedAmenities.length === 0) {
    const reply = language === 'es'
      ? `El anuncio no publica ${labels.es[scope]} confirmados. Prefiero no completar esa parte con suposiciones. ¿Quieres revisar todas las amenidades o abrir la galería?`
      : `The listing does not publish any confirmed ${labels.en[scope]}. I would rather not fill that gap with assumptions. Would you like to review all amenities or open the gallery?`;
    return {
      reply,
      speech: reply,
      suggestedReplies: language === 'es' ? ['Ver todas las amenidades', 'Abrir galería'] : ['View all amenities', 'Open gallery'],
    };
  }

  const highlighted = scopedAmenities.slice(0, 3);
  const experiences = highlighted.map((amenity) => getAmenityExperience(amenity, language));
  const remaining = scopedAmenities.length - highlighted.length;
  const reply = language === 'es'
    ? `Entre los ${labels.es[scope]} confirmados, ${joinNaturally(experiences, language)}.${remaining > 0 ? ` Hay ${remaining} ${remaining === 1 ? 'opción adicional publicada' : 'opciones adicionales publicadas'} en esta categoría.` : ''} ¿Cuál quieres que revisemos con más detalle?`
    : `Among the confirmed ${labels.en[scope]}, ${joinNaturally(experiences, language)}.${remaining > 0 ? ` There ${remaining === 1 ? 'is' : 'are'} ${remaining} additional published ${remaining === 1 ? 'option' : 'options'} in this category.` : ''} Which one would you like to review in more detail?`;
  return {
    reply,
    speech: reply,
    suggestedReplies: language === 'es' ? ['Abrir galería', 'Ver todas las amenidades'] : ['Open gallery', 'View all amenities'],
  };
};

const buildOverviewNarrative = (
  amenities: string[],
  language: AmenityLanguage,
): AmenityNarrative => {
  const grouped = groupPropertyFeatures(amenities);
  const segments = grouped.groups
    .filter((group) => group.values.length > 0)
    .map((group) => {
      const featured = group.values.slice(0, 2);
      const label = language === 'es' ? group.titleEs.toLocaleLowerCase('es-MX') : group.titleEn.toLocaleLowerCase('en-US');
      return language === 'es'
        ? `en ${label}, ${joinNaturally(featured, language)}`
        : `for ${label}, ${joinNaturally(featured, language)}`;
    });
  if (grouped.other.length > 0) {
    segments.push(language === 'es'
      ? `entre otros elementos publicados, ${joinNaturally(grouped.other.slice(0, 2), language)}`
      : `among other published features, ${joinNaturally(grouped.other.slice(0, 2), language)}`);
  }

  const reply = language === 'es'
    ? `La ficha confirma ${amenities.length} ${amenities.length === 1 ? 'espacio o amenidad' : 'espacios y amenidades'}. ${segments.length > 0 ? `Destacan ${joinNaturally(segments, language)}.` : ''} Puedo explicarte uno por uno sin asumir medidas ni equipamiento. ¿Quieres revisar interiores, exteriores o áreas comunes?`
    : `The listing confirms ${amenities.length} ${amenities.length === 1 ? 'space or amenity' : 'spaces and amenities'}. ${segments.length > 0 ? `Highlights include ${joinNaturally(segments, language)}.` : ''} I can explain them one by one without assuming dimensions or equipment. Would you like to review interiors, outdoor areas, or shared amenities?`;
  return {
    reply,
    speech: reply,
    suggestedReplies: language === 'es' ? ['Ver interiores', 'Ver exteriores', 'Ver áreas comunes'] : ['View interiors', 'View outdoor areas', 'View shared amenities'],
  };
};

export const buildAmenityNarrative = ({
  amenities: rawAmenities,
  language,
  prompt,
}: AmenityNarrativeOptions): AmenityNarrative | null => {
  const amenities = uniqueAmenities(rawAmenities);
  const requestedLabels = extractRequestedLabels(prompt, amenities);

  if (requestedLabels.length > 0) {
    const matchedAmenities = uniqueAmenities(requestedLabels
      .map((label) => findPublishedAmenity(label, amenities))
      .filter((amenity): amenity is string => Boolean(amenity)));
    const matchedNormalized = new Set(matchedAmenities.map(normalizeAmenityText));
    const missingLabels = requestedLabels.filter((label) => {
      const matched = findPublishedAmenity(label, amenities);
      return !matched || !matchedNormalized.has(normalizeAmenityText(matched));
    });
    if (matchedAmenities.length > 0) return buildSpecificNarrative(matchedAmenities, missingLabels, language);
    return buildMissingNarrative(missingLabels, language);
  }

  if (amenities.length === 0) return null;
  const scope = getRequestedScope(prompt);
  if (scope) return buildScopedNarrative(filterByScope(amenities, scope), scope, language);
  return buildOverviewNarrative(amenities, language);
};

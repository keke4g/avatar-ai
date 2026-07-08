import { PropertyValidator } from '../lib/services/PropertyValidator';
import { Property } from '../lib/types';

interface TestCase {
  name: string;
  property: any;
  expectedSuccess: boolean;
  expectedFieldErrors?: string[];
}

const testCases: TestCase[] = [
  // ─── VALID CASE: CASA EN MÉXICO ───
  {
    name: 'Casa válida en México con Venta',
    property: {
      hostId: 'host-123',
      valueRating: 'Premium',
      type: 'Casa' as any,
      title: 'Hermosa Casa con Alberca en Mazatlán',
      shortDescription: 'Excelente propiedad familiar en coto residencial privado con alberca.',
      description: 'Excelente propiedad familiar en coto residencial privado con alberca, cochera para dos autos, tres recámaras y tres baños completos.',
      location: 'Mazatlán, Sinaloa',
      country: 'Mexico',
      latitude: 23.2494,
      longitude: -106.4111,
      bedrooms: 3,
      bathrooms: 3,
      levelsCount: 2,
      images: ['https://images.unsplash.com/photo-1580587771525-78b9dba3b914'],
      offerings: [
        {
          id: 'offering-sale-1',
          propertyId: 'prop-1',
          mode: 'SALE',
          status: 'ACTIVE',
          visibility: 'PUBLIC',
          priceAmount: 4500000,
          currency: 'MXN',
          billingPeriod: 'TOTAL',
          isFeatured: false,
          featuredRank: 0,
          metadata: {}
        }
      ]
    },
    expectedSuccess: true
  },

  // ─── VALID CASE: DEPARTAMENTO EN ESPAÑA ───
  {
    name: 'Departamento válido en España con Renta Mensual',
    property: {
      hostId: 'host-123',
      valueRating: 'Premium',
      type: 'Departamento' as any,
      title: 'Piso Céntrico Amueblado en Madrid',
      shortDescription: 'Precioso piso amueblado de una recámara en zona centro de Madrid.',
      description: 'Precioso piso amueblado de una recámara en zona centro de Madrid. Calefacción central, cocina equipada, portero físico y excelentes accesos.',
      location: 'Madrid, España',
      country: 'España',
      latitude: 40.4168,
      longitude: -3.7038,
      bedrooms: 1,
      bathrooms: 1,
      levelsCount: 3, // Piso 3
      images: ['https://images.unsplash.com/photo-1522708323590-d24dbb6b0267'],
      offerings: [
        {
          id: 'offering-rent-1',
          propertyId: 'prop-2',
          mode: 'MONTHLY_RENT',
          status: 'ACTIVE',
          visibility: 'PUBLIC',
          priceAmount: 1200,
          currency: 'EUR',
          billingPeriod: 'MONTH',
          isFeatured: false,
          featuredRank: 0,
          metadata: {}
        }
      ]
    },
    expectedSuccess: true
  },

  // ─── VALID CASE: TERRENO ───
  {
    name: 'Terreno rústico válido sin cuartos ni niveles',
    property: {
      hostId: 'host-123',
      valueRating: 'Premium',
      type: 'Terreno' as any,
      title: 'Terreno campestre a pie de carretera',
      shortDescription: 'Terreno de agostadero ideal para rancho o granja familiar.',
      description: 'Terreno de agostadero ideal para rancho o granja familiar. Cuenta con pozo de agua registrado y acceso pavimentado.',
      location: 'Durango, México',
      country: 'Mexico',
      latitude: 24.0277,
      longitude: -104.6538,
      bedrooms: 0,
      bathrooms: 0,
      levelsCount: 0,
      images: ['https://images.unsplash.com/photo-1500382017468-9049fed747ef'],
      offerings: [
        {
          id: 'offering-sale-2',
          propertyId: 'prop-3',
          mode: 'SALE',
          status: 'ACTIVE',
          visibility: 'PUBLIC',
          priceAmount: 850000,
          currency: 'MXN',
          billingPeriod: 'TOTAL',
          isFeatured: false,
          featuredRank: 0,
          metadata: {}
        }
      ]
    },
    expectedSuccess: true
  },

  // ─── INVALID CASE: CASA SIN NIVELES ───
  {
    name: 'Casa inválida por no tener niveles especificados',
    property: {
      hostId: 'host-123',
      valueRating: 'Premium',
      type: 'Casa' as any,
      title: 'Casa moderna en las afueras',
      shortDescription: 'Hermosa residencia moderna lista para habitarse.',
      description: 'Hermosa residencia moderna lista para habitarse, equipada con cocina integral y closets de madera de cedro.',
      location: 'Culiacán, Sinaloa',
      country: 'Mexico',
      latitude: 24.8053,
      longitude: -107.3948,
      bedrooms: 3,
      bathrooms: 2,
      levelsCount: 0, // Casa requiere > 0
      images: ['https://images.unsplash.com/photo-1580587771525-78b9dba3b914'],
      offerings: [
        {
          id: 'offering-sale-3',
          propertyId: 'prop-4',
          mode: 'SALE',
          status: 'ACTIVE',
          visibility: 'PUBLIC',
          priceAmount: 2300000,
          currency: 'MXN',
          billingPeriod: 'TOTAL',
          isFeatured: false,
          featuredRank: 0,
          metadata: {}
        }
      ]
    },
    expectedSuccess: false,
    expectedFieldErrors: ['levelsCount']
  },

  // ─── INVALID CASE: DEPARTAMENTO SIN NIVELES ───
  {
    name: 'Departamento inválido por no tener nivel/piso especificado',
    property: {
      hostId: 'host-123',
      valueRating: 'Premium',
      type: 'Departamento' as any,
      title: 'Penthouse de lujo en Marina',
      shortDescription: 'Espectacular penthouse con vista al mar y muelle privado.',
      description: 'Espectacular penthouse con vista al mar y muelle privado, completamente amueblado y equipado con sistema inteligente.',
      location: 'Mazatlán, Sinaloa',
      country: 'Mexico',
      latitude: 23.2494,
      longitude: -106.4111,
      bedrooms: 3,
      bathrooms: 3.5,
      levelsCount: 0, // Departamento requiere > 0
      images: ['https://images.unsplash.com/photo-1522708323590-d24dbb6b0267'],
      offerings: [
        {
          id: 'offering-sale-4',
          propertyId: 'prop-5',
          mode: 'SALE',
          status: 'ACTIVE',
          visibility: 'PUBLIC',
          priceAmount: 8900000,
          currency: 'MXN',
          billingPeriod: 'TOTAL',
          isFeatured: false,
          featuredRank: 0,
          metadata: {}
        }
      ]
    },
    expectedSuccess: false,
    expectedFieldErrors: ['levelsCount']
  },

  // ─── INVALID CASE: TERRENO CON CUARTOS ───
  {
    name: 'Terreno inválido por especificar cuartos o baños',
    property: {
      hostId: 'host-123',
      valueRating: 'Premium',
      type: 'Terreno' as any,
      title: 'Lote urbanizado listo para construir',
      shortDescription: 'Lote residential plano en exclusivo coto cerrado con vigilancia.',
      description: 'Lote residential plano en exclusivo coto cerrado con vigilancia y casa club de primer nivel.',
      location: 'Zapopan, Jalisco',
      country: 'Mexico',
      latitude: 20.6719,
      longitude: -103.4162,
      bedrooms: 2, // Terreno requiere 0 o null
      bathrooms: 1, // Terreno requiere 0 o null
      levelsCount: 0,
      images: ['https://images.unsplash.com/photo-1500382017468-9049fed747ef'],
      offerings: [
        {
          id: 'offering-sale-5',
          propertyId: 'prop-6',
          mode: 'SALE',
          status: 'ACTIVE',
          visibility: 'PUBLIC',
          priceAmount: 1800000,
          currency: 'MXN',
          billingPeriod: 'TOTAL',
          isFeatured: false,
          featuredRank: 0,
          metadata: {}
        }
      ]
    },
    expectedSuccess: false,
    expectedFieldErrors: ['bedrooms', 'bathrooms']
  },

  // ─── INVALID CASE: LOCAL CON CUARTOS ───
  {
    name: 'Local comercial inválido por especificar habitaciones',
    property: {
      hostId: 'host-123',
      valueRating: 'Premium',
      type: 'Local Comercial' as any,
      title: 'Local comercial en plaza patria',
      shortDescription: 'Excelente local comercial ideal para franquicia o sucursal bancaria.',
      description: 'Excelente local comercial ideal para franquicia o sucursal bancaria en planta baja con alta afluencia peatonal.',
      location: 'Zapopan, Jalisco',
      country: 'Mexico',
      latitude: 20.6719,
      longitude: -103.4162,
      bedrooms: 1, // Local comercial requiere 0 o null
      bathrooms: 2,
      levelsCount: 1,
      images: ['https://images.unsplash.com/photo-1582719508461-905c673771fd'],
      offerings: [
        {
          id: 'offering-sale-6',
          propertyId: 'prop-7',
          mode: 'SALE',
          status: 'ACTIVE',
          visibility: 'PUBLIC',
          priceAmount: 4200000,
          currency: 'MXN',
          billingPeriod: 'TOTAL',
          isFeatured: false,
          featuredRank: 0,
          metadata: {}
        }
      ]
    },
    expectedSuccess: false,
    expectedFieldErrors: ['bedrooms']
  },

  // ─── INVALID CASE: PRECIO DE VENTA CERO ───
  {
    name: 'Venta con precio cero',
    property: {
      hostId: 'host-123',
      valueRating: 'Premium',
      type: 'Casa' as any,
      title: 'Casa remate hipotecario',
      shortDescription: 'Oportunidad única de inversión en remate judicial.',
      description: 'Oportunidad única de inversión en remate judicial, adjudicada y lista para regularizar escrituras.',
      location: 'Culiacán, Sinaloa',
      country: 'Mexico',
      latitude: 24.8053,
      longitude: -107.3948,
      bedrooms: 3,
      bathrooms: 2,
      levelsCount: 1,
      images: ['https://images.unsplash.com/photo-1580587771525-78b9dba3b914'],
      offerings: [
        {
          id: 'offering-sale-7',
          propertyId: 'prop-8',
          mode: 'SALE',
          status: 'ACTIVE',
          visibility: 'PUBLIC',
          priceAmount: 0, // Requerido > 0
          currency: 'MXN',
          billingPeriod: 'TOTAL',
          isFeatured: false,
          featuredRank: 0,
          metadata: {}
        }
      ]
    },
    expectedSuccess: false,
    expectedFieldErrors: ['salePrice']
  },

  // ─── INVALID CASE: PRECIO DE RENTA MENSUAL CERO ───
  {
    name: 'Renta con precio cero',
    property: {
      hostId: 'host-123',
      valueRating: 'Premium',
      type: 'Casa' as any,
      title: 'Piso en la playa',
      shortDescription: 'Renta mensual para vacaciones de verano frente a la playa.',
      description: 'Renta mensual para vacaciones de verano frente a la playa, con servicios incluidos y cochera techada.',
      location: 'Mazatlán, Sinaloa',
      country: 'Mexico',
      latitude: 23.2494,
      longitude: -106.4111,
      bedrooms: 2,
      bathrooms: 2,
      levelsCount: 1,
      images: ['https://images.unsplash.com/photo-1522708323590-d24dbb6b0267'],
      offerings: [
        {
          id: 'offering-rent-2',
          propertyId: 'prop-9',
          mode: 'MONTHLY_RENT',
          status: 'ACTIVE',
          visibility: 'PUBLIC',
          priceAmount: 0, // Requerido > 0
          currency: 'MXN',
          billingPeriod: 'MONTH',
          isFeatured: false,
          featuredRank: 0,
          metadata: {}
        }
      ]
    },
    expectedSuccess: false,
    expectedFieldErrors: ['rentPrice']
  },

  // ─── INVALID CASE: SWAP SIN PREFERENCIAS ───
  {
    name: 'Swap sin preferencias de intercambio',
    property: {
      hostId: 'host-123',
      valueRating: 'Premium',
      type: 'Departamento' as any,
      title: 'Depto residencial en Coyoacán',
      shortDescription: 'Bonito departamento en renta o swap en zona tranquila e histórica.',
      description: 'Bonito departamento en renta o swap en zona tranquila e histórica de Coyoacán, dos habitaciones y seguridad las 24 horas.',
      location: 'Ciudad de México, México',
      country: 'Mexico',
      latitude: 19.3502,
      longitude: -99.1627,
      bedrooms: 2,
      bathrooms: 1.5,
      levelsCount: 2,
      images: ['https://images.unsplash.com/photo-1522708323590-d24dbb6b0267'],
      desiredExchange: '', // Swap requiere preferences
      offerings: [
        {
          id: 'offering-swap-1',
          propertyId: 'prop-10',
          mode: 'SWAP',
          status: 'ACTIVE',
          visibility: 'PUBLIC',
          priceAmount: 0,
          currency: 'USD',
          billingPeriod: 'NONE',
          isFeatured: false,
          featuredRank: 0,
          metadata: {}
        }
      ]
    },
    expectedSuccess: false,
    expectedFieldErrors: ['swapPreferences']
  },

  // ─── INVALID CASE: COORDENADAS FUERA DE MÉXICO ───
  {
    name: 'Propiedad en México con coordenadas de España',
    property: {
      hostId: 'host-123',
      valueRating: 'Premium',
      type: 'Casa' as any,
      title: 'Casa campestre en Valle de Bravo',
      shortDescription: 'Hermosa cabaña alpina rodeada de bosque y riachuelo.',
      description: 'Hermosa cabaña alpina rodeada de bosque y riachuelo, ideal para fines de semana en familia lejos de la contaminación.',
      location: 'Valle de Bravo, México',
      country: 'Mexico',
      latitude: 40.4168, // Coordenadas de Madrid, España!
      longitude: -3.7038,
      bedrooms: 4,
      bathrooms: 3.5,
      levelsCount: 2,
      images: ['https://images.unsplash.com/photo-1580587771525-78b9dba3b914'],
      offerings: [
        {
          id: 'offering-sale-8',
          propertyId: 'prop-11',
          mode: 'SALE',
          status: 'ACTIVE',
          visibility: 'PUBLIC',
          priceAmount: 6500000,
          currency: 'MXN',
          billingPeriod: 'TOTAL',
          isFeatured: false,
          featuredRank: 0,
          metadata: {}
        }
      ]
    },
    expectedSuccess: false,
    expectedFieldErrors: ['location']
  },

  // ─── INVALID CASE: COORDENADAS FUERA DE ESPAÑA ───
  {
    name: 'Propiedad en España con coordenadas de México',
    property: {
      hostId: 'host-123',
      valueRating: 'Premium',
      type: 'Casa' as any,
      title: 'Chalet en Costa del Sol',
      shortDescription: 'Lujoso chalet mediterráneo frente a la playa con piscina infinita.',
      description: 'Lujoso chalet mediterráneo frente a la playa con piscina infinita, amplias terrazas y acabados de mármol de Carrara.',
      location: 'Málaga, España',
      country: 'España',
      latitude: 23.2494, // Coordenadas de Mazatlán, México!
      longitude: -106.4111,
      bedrooms: 5,
      bathrooms: 5,
      levelsCount: 2,
      images: ['https://images.unsplash.com/photo-1580587771525-78b9dba3b914'],
      offerings: [
        {
          id: 'offering-sale-9',
          propertyId: 'prop-12',
          mode: 'SALE',
          status: 'ACTIVE',
          visibility: 'PUBLIC',
          priceAmount: 850000,
          currency: 'EUR',
          billingPeriod: 'TOTAL',
          isFeatured: false,
          featuredRank: 0,
          metadata: {}
        }
      ]
    },
    expectedSuccess: false,
    expectedFieldErrors: ['location']
  }
];

function runTests() {
  console.log('=== INICIANDO PRUEBAS UNITARIAS DE VALIDACIÓN DE PROPIEDADES ===\n');
  let passedCount = 0;
  let failedCount = 0;

  testCases.forEach((tc, index) => {
    console.log(`Prueba #${index + 1}: "${tc.name}"`);
    const validation = PropertyValidator.validatePropertyBeforeInsert(tc.property as Property);

    let passed = true;
    if (validation.success !== tc.expectedSuccess) {
      passed = false;
      console.log(`  ❌ FALLÓ: El estado de éxito esperado era ${tc.expectedSuccess}, se obtuvo ${validation.success}`);
    }

    if (!validation.success && tc.expectedFieldErrors) {
      tc.expectedFieldErrors.forEach(errField => {
        const errorFound = validation.errors.some(e => e.field === errField);
        if (!errorFound) {
          passed = false;
          console.log(`  ❌ FALLÓ: Se esperaba un error en el campo "${errField}", pero no se encontró en:`, validation.errors);
        }
      });
    }

    if (passed) {
      passedCount++;
      console.log(`  ✅ PASÓ`);
    } else {
      failedCount++;
      console.log('  Detalle de errores detectados:', validation.errors);
    }
    console.log('--------------------------------------------------');
  });

  console.log(`\n=== RESUMEN DE PRUEBAS ===`);
  console.log(`Totales: ${testCases.length}`);
  console.log(`Pasaron: ${passedCount}`);
  console.log(`Fallaron: ${failedCount}`);

  if (failedCount > 0) {
    process.exit(1);
  } else {
    console.log('\n🎉 ¡Todas las pruebas unitarias pasaron con éxito!');
    process.exit(0);
  }
}

runTests();

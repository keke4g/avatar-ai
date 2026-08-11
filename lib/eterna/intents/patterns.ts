import { formatHumanDate } from '../../shared/dateFormat';
import type { IntentPattern } from './types';

export const INTENT_PATTERNS: IntentPattern[] = [
  // ── CATEGORÍA: ACCIONES RÁPIDAS (NAVEGACIÓN DIRECTA) ──
  {
    patterns: [
      /\b(llevame a mis propiedades|llévame a mis propiedades|ir a mis propiedades|abre mis propiedades|abrir mis propiedades|mostrar mis propiedades|panel de propiedades|dashboard de propiedades|go to my properties|open my properties|show my properties|properties panel|ver mis propiedades|ir a propiedades|llevame a propiedades|llévame a propiedades)\b/i,
      /\b(ver|abrir|ir|ir a|llevame|llévame|llevame a|llévame a|show|open|go|go to)\b.*\b(propiedades|properties|mis casas|my homes|mis propiedades|my properties|anuncios|mis anuncios|listings|my listings)\b/i,
    ],
    route: '/dashboard?tab=properties',
    action: 'navigate',
    getResponse: (ctx) => ({
      es: ctx.myPropertiesCount > 0
        ? (ctx.myPropertiesCount === 1
            ? 'Tienes una propiedad publicada. Te llevo a tu panel de propiedades.'
            : `Tienes ${ctx.myPropertiesCount} propiedades publicadas. Te llevo a tu panel de propiedades.`)
        : 'Te llevo al panel de tus propiedades.',
      en: ctx.myPropertiesCount > 0
        ? (ctx.myPropertiesCount === 1
            ? 'You have one published property. Taking you to your properties panel.'
            : `You have ${ctx.myPropertiesCount} published properties. Taking you to your properties panel.`)
        : 'Taking you to your properties panel.',
    })
  },
  {
    patterns: [
      /\b(editar mi propiedad de mazatlan|editar mi propiedad de mazatlán|editar propiedad de mazatlan|editar propiedad de mazatlán|edit my mazatlan property|edit mazatlan property)\b/i
    ],
    route: '/dashboard?tab=properties',
    action: 'navigate',
    getResponse: () => ({
      es: 'Te llevo a la pestaña de propiedades de tu panel de control. Allí podrás hacer clic en "Editar" en tu Depa en Mazatlán.',
      en: 'Taking you to your properties tab. There you can click "Edit" on your Mazatlan property.'
    })
  },
  {
    patterns: [
      /\b(publicar propiedad|publicar mi propiedad|crear anuncio|crear propiedad|añadir propiedad|crear un anuncio|publicar casa|list my property|publish property|add property)\b/i,
      /\b(quiero vender una casa|quiero publicar una propiedad|quiero anunciar un inmueble|quiero poner una casa en venta|quiero rentar mi propiedad|vender casa|vender departamento|quiero vender|quiero publicar|quiero anunciar|poner en venta|rentar mi propiedad|subir propiedad)\b/i,
      /\b(want to sell a house|want to publish a property|want to announce a property|want to put a house up for sale|want to rent my property|sell house|sell apartment|want to sell|want to publish|want to list|put up for sale|rent my property|upload property)\b/i
    ],
    route: '/dashboard?tab=properties',
    action: 'navigate',
    getResponse: () => ({
      es: 'Te llevo al panel de tus propiedades para iniciar el proceso de publicación.',
      en: 'Taking you to your properties panel to start the listing process.'
    })
  },
  {
    patterns: [
      /\b(ver mis mensajes|ir a mensajes|abrir mis mensajes|ver mensajes|view my messages|see my messages|open messages|llevame a mis mensajes|llevame a mensajes)\b/i
    ],
    route: '/messages',
    action: 'navigate',
    getResponse: () => ({
      es: 'Te llevo a tu bandeja de entrada para que leas y respondas tus mensajes.',
      en: 'Taking you to your inbox so you can read and reply to your messages.'
    })
  },
  {
    patterns: [
      /\b(ver mis solicitudes|ir a mis solicitudes|abrir mis solicitudes|ver solicitudes|view my requests|see my requests|open requests)\b/i
    ],
    route: '/dashboard?tab=trips',
    action: 'navigate',
    getResponse: () => ({
      es: 'Te llevo a la pestaña de solicitudes de tu panel de control.',
      en: 'Taking you to the trips tab of your dashboard.'
    })
  },
  {
    patterns: [
      /\b(revisar solicitudes pendientes|solicitudes pendientes|ver solicitudes pendientes|revisar swaps pendientes|review pending requests|pending requests)\b/i
    ],
    route: '/dashboard?tab=swaps',
    action: 'navigate',
    getResponse: () => ({
      es: 'Te llevo a la sección de solicitudes de intercambio de tu panel para que las revises.',
      en: 'Taking you to the swap requests section of your dashboard for you to review.'
    })
  },
  {
    patterns: [
      /\b(abrir perfil|ir al perfil|ver mi perfil|editar perfil|editar mi perfil|open profile|go to profile)\b/i
    ],
    route: '/profile',
    action: 'navigate',
    getResponse: () => ({
      es: 'Te llevo a la página de edición de tu perfil.',
      en: 'Taking you to your profile editing page.'
    })
  },
  {
    patterns: [
      /\b(abrir configuracion|abrir configuración|ir a configuracion|ir a configuración|abrir ajustes|open settings|go to settings)\b/i
    ],
    route: '/dashboard',
    action: 'navigate',
    getResponse: () => ({
      es: 'Te llevo a la sección de configuración de tu cuenta.',
      en: 'Taking you to your account settings.'
    })
  },

  // ── CATEGORÍA: DETALLES DE LLEGADA ──
  {
    patterns: [
      /\b(wifi|contraseña|contraseña de wifi|password de wifi|password wifi|wifi password|red wifi|red de wifi)\b/i
    ],
    action: 'local_response',
    getResponse: (ctx) => {
      const trips = ctx.swaps.filter(s =>
        (s.senderId === ctx.currentUser?.id || s.receiverId === ctx.currentUser?.id) &&
        ['APPROVED', 'CONFIRMED', 'ACTIVE'].includes(s.status)
      );
      const futureTrips = trips.filter((t: any) => new Date(t.startDate) >= new Date());
      if (futureTrips.length === 0) {
        return {
          es: 'No tienes ninguna visita o contrato próximo para consultar la red wifi.',
          en: 'You have no upcoming lease or visits scheduled to check the wifi network.'
        };
      }
      const sorted = [...futureTrips].sort((a: any, b: any) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());
      const next = sorted[0];
      const details = ctx.travelDetails.find(d => d.swapId === next.id);
      
      if (!details || (!details.wifiName && !details.wifiPassword)) {
        return {
          es: 'El propietario aún no ha compartido los detalles de la red wifi para tu próxima visita.',
          en: 'The owner has not shared the wifi network details for your upcoming stay yet.'
        };
      }
      return {
        es: `La red wifi para tu próxima visita es "${details.wifiName || 'No compartida'}" y la contraseña es "${details.wifiPassword || 'No compartida'}".`,
        en: `The wifi network for your upcoming stay is "${details.wifiName || 'Not shared'}" and the password is "${details.wifiPassword || 'Not shared'}".`
      };
    }
  },
  {
    patterns: [
      /\b(como entro|cómo entro|instrucciones de llegada|instrucciones de checkin|instrucciones de check-in|checkin instructions|how do i enter|how do i get in)\b/i
    ],
    action: 'local_response',
    getResponse: (ctx) => {
      const trips = ctx.swaps.filter(s =>
        (s.senderId === ctx.currentUser?.id || s.receiverId === ctx.currentUser?.id) &&
        ['APPROVED', 'CONFIRMED', 'ACTIVE'].includes(s.status)
      );
      const futureTrips = trips.filter((t: any) => new Date(t.startDate) >= new Date());
      if (futureTrips.length === 0) {
        return {
          es: 'No tienes ninguna visita o contrato próximo para ver las instrucciones.',
          en: 'You have no upcoming visits scheduled to see instructions.'
        };
      }
      const sorted = [...futureTrips].sort((a: any, b: any) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());
      const next = sorted[0];
      const details = ctx.travelDetails.find(d => d.swapId === next.id);
      
      if (!details || !details.checkinInstructions) {
        return {
          es: 'El propietario aún no ha compartido las instrucciones de entrada para tu próxima visita.',
          en: 'The owner has not shared the move-in instructions for your upcoming stay yet.'
        };
      }
      return {
        es: `Instrucciones de entrada:\n${details.checkinInstructions}`,
        en: `Move-in instructions:\n${details.checkinInstructions}`
      };
    }
  },
  {
    patterns: [
      /\b(codigo de acceso|código de acceso|clave de acceso|codigo de entrada|código de entrada|access code|entry code|key code)\b/i
    ],
    action: 'local_response',
    getResponse: (ctx) => {
      const trips = ctx.swaps.filter(s =>
        (s.senderId === ctx.currentUser?.id || s.receiverId === ctx.currentUser?.id) &&
        ['APPROVED', 'CONFIRMED', 'ACTIVE'].includes(s.status)
      );
      const futureTrips = trips.filter((t: any) => new Date(t.startDate) >= new Date());
      if (futureTrips.length === 0) {
        return {
          es: 'No tienes ningún contrato o visita próxima programada.',
          en: 'You have no upcoming visits or contracts scheduled.'
        };
      }
      const sorted = [...futureTrips].sort((a: any, b: any) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());
      const next = sorted[0];
      const details = ctx.travelDetails.find(d => d.swapId === next.id);
      
      if (!details || !details.accessCode) {
        return {
          es: 'El propietario aún no ha compartido ningún código de acceso para tu próxima visita.',
          en: 'The owner has not shared any access code for your upcoming stay yet.'
        };
      }
      return {
        es: `El código de acceso para la propiedad es "${details.accessCode}".`,
        en: `The access code for the property is "${details.accessCode}".`
      };
    }
  },
  {
    patterns: [
      /\b(detalles de llegada|detalles de arribo|informacion de llegada|información de llegada|arrival details|checkin details|muestrame los detalles de llegada|muéstrame los detalles de llegada)\b/i
    ],
    action: 'local_response',
    getResponse: (ctx) => {
      const trips = ctx.swaps.filter(s =>
        (s.senderId === ctx.currentUser?.id || s.receiverId === ctx.currentUser?.id) &&
        ['APPROVED', 'CONFIRMED', 'ACTIVE'].includes(s.status)
      );
      const futureTrips = trips.filter((t: any) => new Date(t.startDate) >= new Date());
      if (futureTrips.length === 0) {
        return {
          es: 'No tienes ninguna visita o contrato próximo confirmado para ver detalles de entrada.',
          en: 'You have no upcoming confirmed stays to view access details.'
        };
      }
      const sorted = [...futureTrips].sort((a: any, b: any) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());
      const next = sorted[0];
      const details = ctx.travelDetails.find(d => d.swapId === next.id);
      const isSender = next.senderId === ctx.currentUser?.id;
      const partnerPropId = isSender ? next.receiverPropertyId : next.senderPropertyId;
      const partnerProp = ctx.properties.find((p: any) => p.id === partnerPropId);
      const dest = partnerProp ? `"${partnerProp.title}" en ${partnerProp.location}` : 'tu próxima propiedad';
      
      if (!details) {
        return {
          es: `Tu próxima visita es a ${dest}, pero el propietario aún no ha compartido los detalles de entrada.`,
          en: `Your next stay is at ${dest}, but the owner has not shared move-in details yet.`
        };
      }
      
      return {
        es: `Detalles de acceso para tu visita a ${dest}:\n` +
            `• Red Wifi: ${details.wifiName || 'No compartida'}\n` +
            `• Contraseña Wifi: ${details.wifiPassword || 'No compartida'}\n` +
            `• Código de acceso: ${details.accessCode || 'No compartido'}\n` +
            `• Hora de Entrada: ${details.checkinTime || '15:00'}\n` +
            `• Hora de Salida: ${details.checkoutTime || '11:00'}\n` +
            `• Contacto de Emergencia: ${details.emergencyContactName || 'No compartido'} (${details.emergencyContactPhone || 'No compartido'})\n` +
            `• Instrucciones: ${details.checkinInstructions || 'El propietario no ha dejado instrucciones específicas.'}`,
        en: `Access details for your stay at ${dest}:\n` +
            `• Wifi Network: ${details.wifiName || 'Not shared'}\n` +
            `• Wifi Password: ${details.wifiPassword || 'Not shared'}\n` +
            `• Access Code: ${details.accessCode || 'Not shared'}\n` +
            `• Move-in Time: ${details.checkinTime || '15:00'}\n` +
            `• Move-out Time: ${details.checkoutTime || '11:00'}\n` +
            `• Emergency Contact: ${details.emergencyContactName || 'Not shared'} (${details.emergencyContactPhone || 'Not shared'})\n` +
            `• Instructions: ${details.checkinInstructions || 'No specific instructions shared by the owner.'}`
      };
    }
  },

  // ── CATEGORÍA: PROPIEDADES ──
  {
    patterns: [
      /\b(reciente|recientemente|ultima publicada|última publicada|newest property|recently published|propiedad nueva|nuevo anuncio|anuncio reciente|última propiedad publicada|ultima propiedad publicada|cual fue mi ultima propiedad publicada|cuál fue mi última propiedad publicada)\b/i,
    ],
    action: 'local_response',
    getResponse: (ctx) => {
      const myProps = ctx.properties.filter((p: any) => p.hostId === ctx.currentUser?.id);
      if (myProps.length === 0) {
        return {
          es: 'Aún no tienes propiedades publicadas en tu cuenta.',
          en: 'You have no published properties in your account.',
        };
      }
      const sorted = [...myProps].sort((a, b) => b.id.localeCompare(a.id));
      const recent = sorted[0];
      return {
        es: `Tu propiedad publicada más recientemente es "${recent.title}" en ${recent.location} (${recent.country}).`,
        en: `Your most recently published property is "${recent.title}" in ${recent.location} (${recent.country}).`
      };
    }
  },
  {
    patterns: [
      /\b(antigua|mas antigua|más antigua|oldest property|primera propiedad|primer anuncio|propiedad mas antigua|propiedad más antigua|cual es mi propiedad mas antigua|cuál es mi propiedad más antigua)\b/i,
    ],
    action: 'local_response',
    getResponse: (ctx) => {
      const myProps = ctx.properties.filter((p: any) => p.hostId === ctx.currentUser?.id);
      if (myProps.length === 0) {
        return {
          es: 'Aún no tienes propiedades publicadas en tu cuenta.',
          en: 'You have no published properties in your account.',
        };
      }
      const sorted = [...myProps].sort((a, b) => a.id.localeCompare(b.id));
      const oldest = sorted[0];
      return {
        es: `Tu primera propiedad registrada es "${oldest.title}" en ${oldest.location} (${oldest.country}).`,
        en: `Your first registered property is "${oldest.title}" in ${oldest.location} (${oldest.country}).`
      };
    }
  },
  {
    patterns: [
      /\b(cuales|cuáles|mostrar|ver|lista|anuncios)\b.*\b(publicadas|publicados|activas|activos|visibles|published|active)\b/i,
      /\b(que propiedades estan publicadas|qué propiedades están publicadas|propiedades publicadas|anuncios publicados)\b/i
    ],
    action: 'local_response',
    getResponse: (ctx) => {
      const published = ctx.properties.filter((p: any) => p.hostId === ctx.currentUser?.id && (p.isPublished || p.is_published));
      if (published.length === 0) {
        return {
          es: 'No tienes ninguna propiedad marcada como publicada en el catálogo en este momento.',
          en: 'You have no properties marked as published in the catalog at this time.'
        };
      }
      const list = published.map((p: any, i: number) => `${i + 1}. ${p.title} (${p.location})`).join('\n');
      return {
        es: `Tienes las siguientes propiedades publicadas:\n${list}`,
        en: `You have the following properties published:\n${list}`
      };
    }
  },
  {
    patterns: [
      /\b(cuales|cuáles|mostrar|ver|lista|anuncios)\b.*\b(pausadas|pausados|borradores|borrador|ocultos|ocultas|pausar|paused|drafts)\b/i,
      /\b(que propiedades estan pausadas|qué propiedades están pausadas|propiedades pausadas|anuncios pausados)\b/i
    ],
    action: 'local_response',
    getResponse: (ctx) => {
      const paused = ctx.properties.filter((p: any) => p.hostId === ctx.currentUser?.id && !(p.isPublished || p.is_published));
      if (paused.length === 0) {
        return {
          es: 'Todas tus propiedades registradas están actualmente publicadas y visibles.',
          en: 'All of your registered properties are currently published and visible.'
        };
      }
      const list = paused.map((p: any, i: number) => `${i + 1}. ${p.title} (${p.location})`).join('\n');
      return {
        es: `Tienes las siguientes propiedades pausadas o en borrador:\n${list}`,
        en: `You have the following properties paused or in draft:\n${list}`
      };
    }
  },
  {
    patterns: [
      /\b(en que ciudades|en qué ciudades|que ciudades tengo|en donde tengo casas|en dónde tengo casas|ciudades|cities|ciudades de mis propiedades)\b/i,
    ],
    action: 'local_response',
    getResponse: (ctx) => {
      const myProps = ctx.properties.filter((p: any) => p.hostId === ctx.currentUser?.id);
      if (myProps.length === 0) {
        return {
          es: 'Aún no tienes propiedades en ninguna ubicación.',
          en: 'You do not have properties in any location yet.',
        };
      }
      const locations = Array.from(new Set(myProps.map((p: any) => p.location.split(',')[0].trim())));
      return {
        es: `Tienes propiedades registradas en las siguientes ciudades: ${locations.join(', ')}.`,
        en: `You have properties registered in the following cities: ${locations.join(', ')}.`
      };
    }
  },
  {
    patterns: [
      /\b(mis propiedades en mexico|mis propiedades en méxico|mis anuncios en mexico|mis anuncios en méxico|my properties in mexico)\b/i,
    ],
    action: 'local_response',
    getResponse: (ctx) => {
      const mexicoProps = ctx.properties.filter((p: any) => p.hostId === ctx.currentUser?.id && p.country.toLowerCase().includes('méx'));
      if (mexicoProps.length === 0) {
        return {
          es: 'No tienes propiedades propias registradas en México en este momento.',
          en: 'You do not have own properties registered in Mexico at this moment.',
        };
      }
      const list = mexicoProps.map((p: any, i: number) => `${i + 1}. ${p.title} en ${p.location}`).join('\n');
      return {
        es: `Tienes las siguientes propiedades propias en México:\n${list}`,
        en: `You have the following own properties in Mexico:\n${list}`
      };
    }
  },
  {
    patterns: [
      /\b(mis propiedades en europa|mis anuncios en europa|my properties in europe)\b/i,
    ],
    action: 'local_response',
    getResponse: (ctx) => {
      const europeCountries = ['españa', 'spain', 'francia', 'france', 'italia', 'italy', 'alemania', 'germany', 'reino unido', 'uk'];
      const europeProps = ctx.properties.filter((p: any) => 
        p.hostId === ctx.currentUser?.id && 
        europeCountries.some(c => p.country.toLowerCase().includes(c))
      );
      if (europeProps.length === 0) {
        return {
          es: 'No tienes propiedades propias registradas en destinos europeos.',
          en: 'You have no own properties registered in European destinations.',
        };
      }
      const list = europeProps.map((p: any, i: number) => `${i + 1}. ${p.title} en ${p.location} (${p.country})`).join('\n');
      return {
        es: `Tienes las siguientes propiedades propias en Europa:\n${list}`,
        en: `You have the following own properties in Europe:\n${list}`
      };
    }
  },
  {
    patterns: [
      /\b(cuales son mis propiedades|cuáles son mis propiedades|lista mis propiedades|enumera mis propiedades|muestrame mis propiedades|muéstrame mis propiedades|dime el nombre de mis propiedades|nombres de mis propiedades|nombre de mis propiedades|names of my properties|name of my properties)\b/i,
    ],
    action: 'local_response',
    getResponse: (ctx) => {
      const myProps = ctx.properties.filter((p: any) => p.hostId === ctx.currentUser?.id);
      if (myProps.length === 0) {
        return {
          es: 'Aún no tienes propiedades publicadas en tu cuenta.',
          en: 'You have no published properties in your account.',
        };
      }
      const esList = myProps.map((p: any, idx: number) => `${idx + 1}. ${p.title}`).join('\n');
      const enList = myProps.map((p: any, idx: number) => `${idx + 1}. ${p.title}`).join('\n');
      return {
        es: `Tus propiedades son:\n${esList}`,
        en: `Your properties are:\n${enList}`,
      };
    },
  },
  {
    patterns: [
      /\b(cuantas propiedades tengo|cuántas propiedades tengo|numero de propiedades|número de propiedades)\b/i,
    ],
    action: 'local_response',
    getResponse: (ctx) => {
      const myProps = ctx.properties.filter((p: any) => p.hostId === ctx.currentUser?.id);
      const list = myProps.map((p: any, idx: number) => `${idx + 1}. ${p.title} (${p.location})`).join('\n');
      return {
        es: ctx.myPropertiesCount > 0
          ? `Tienes ${ctx.myPropertiesCount} propiedad(es) registrada(s) en Towers México:\n${list}`
          : 'Aún no tienes propiedades publicadas en tu cuenta.',
        en: ctx.myPropertiesCount > 0
          ? `You have ${ctx.myPropertiesCount} registered property/properties on Towers México:\n${list}`
          : 'You do not have any published properties in your account.',
      };
    },
  },

  // ── CATEGORÍA: SOLICITUDES Y CONTRATOS ──
  {
    patterns: [
      /\b(cuando llego|cuándo llego|fecha de llegada|dia de llegada|día de llegada|when do i arrive|arrival date)\b/i
    ],
    action: 'local_response',
    getResponse: (ctx) => {
      const trips = ctx.swaps.filter(s =>
        (s.senderId === ctx.currentUser?.id || s.receiverId === ctx.currentUser?.id) &&
        ['APPROVED', 'CONFIRMED', 'ACTIVE'].includes(s.status)
      );
      const futureTrips = trips.filter((t: any) => new Date(t.startDate) >= new Date());
      if (futureTrips.length === 0) {
        return {
          es: 'No tienes visitas o contratos próximos programados.',
          en: 'You have no upcoming stays or visits scheduled.'
        };
      }
      const sorted = [...futureTrips].sort((a: any, b: any) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());
      const next = sorted[0];
      return {
        es: `Entras a tu próxima propiedad el ${next.startDate}.`,
        en: `You move in to your next property on ${next.startDate}.`
      };
    }
  },
  {
    patterns: [
      /\b(cuando salgo|cuándo salgo|cuando me voy|cuándo me voy|fecha de salida|dia de salida|día de salida|when do i leave|departure date)\b/i
    ],
    action: 'local_response',
    getResponse: (ctx) => {
      const trips = ctx.swaps.filter(s =>
        (s.senderId === ctx.currentUser?.id || s.receiverId === ctx.currentUser?.id) &&
        ['APPROVED', 'CONFIRMED', 'ACTIVE'].includes(s.status)
      );
      const futureTrips = trips.filter((t: any) => new Date(t.startDate) >= new Date());
      if (futureTrips.length === 0) {
        return {
          es: 'No tienes viajes próximos programados.',
          en: 'You have no upcoming trips scheduled.'
        };
      }
      const sorted = [...futureTrips].sort((a: any, b: any) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());
      const next = sorted[0];
      return {
        es: `Sales de tu próxima propiedad el ${next.endDate}.`,
        en: `You move out from your next property on ${next.endDate}.`
      };
    }
  },
  {
    patterns: [
      /\b(quien es mi anfitrion|quién es mi anfitrión|quien me recibe|quién me recibe|who is my host|my host)\b/i
    ],
    action: 'local_response',
    getResponse: (ctx) => {
      const trips = ctx.swaps.filter(s =>
        (s.senderId === ctx.currentUser?.id || s.receiverId === ctx.currentUser?.id) &&
        ['APPROVED', 'CONFIRMED', 'ACTIVE'].includes(s.status)
      );
      const futureTrips = trips.filter((t: any) => new Date(t.startDate) >= new Date());
      if (futureTrips.length === 0) {
        return {
          es: 'No tienes viajes próximos programados.',
          en: 'You have no upcoming trips scheduled.'
        };
      }
      const sorted = [...futureTrips].sort((a: any, b: any) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());
      const next = sorted[0];
      const isSender = next.senderId === ctx.currentUser?.id;
      const partnerPropId = isSender ? next.receiverPropertyId : next.senderPropertyId;
      const partnerProp = ctx.properties.find((p: any) => p.id === partnerPropId);
      const hostName = partnerProp ? partnerProp.hostName : 'otro propietario';
      return {
        es: `El propietario de tu próxima propiedad es ${hostName}.`,
        en: `The owner of your upcoming property is ${hostName}.`
      };
    }
  },
  {
    patterns: [
      /\b(donde me hospedare|dónde me hospedaré|donde me voy a quedar|dónde me voy a quedar|cual es mi alojamiento|cuál es mi alojamiento|where will i stay|where am i staying)\b/i
    ],
    action: 'local_response',
    getResponse: (ctx) => {
      const trips = ctx.swaps.filter(s =>
        (s.senderId === ctx.currentUser?.id || s.receiverId === ctx.currentUser?.id) &&
        ['APPROVED', 'CONFIRMED', 'ACTIVE'].includes(s.status)
      );
      const futureTrips = trips.filter((t: any) => new Date(t.startDate) >= new Date());
      if (futureTrips.length === 0) {
        return {
          es: 'No tienes viajes próximos programados.',
          en: 'You have no upcoming trips scheduled.'
        };
      }
      const sorted = [...futureTrips].sort((a: any, b: any) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());
      const next = sorted[0];
      const isSender = next.senderId === ctx.currentUser?.id;
      const partnerPropId = isSender ? next.receiverPropertyId : next.senderPropertyId;
      const partnerProp = ctx.properties.find((p: any) => p.id === partnerPropId);
      const dest = partnerProp ? `"${partnerProp.title}" en ${partnerProp.location}` : 'una propiedad por confirmar';
      return {
        es: `Tu propiedad confirmada es: ${dest}.`,
        en: `You will reside at: ${dest}.`
      };
    }
  },
  {
    patterns: [
      /\b(mi proxima solicitud|mi próxima solicitud|cual es mi proxima visita|cuál es mi próxima visita|siguiente visita|proxima propiedad|próxima propiedad|next stay|where do i stay next)\b/i,
    ],
    action: 'local_response',
    getResponse: (ctx) => {
      const trips = ctx.swaps.filter(s =>
        (s.senderId === ctx.currentUser?.id || s.receiverId === ctx.currentUser?.id) &&
        ['APPROVED', 'CONFIRMED', 'ACTIVE'].includes(s.status)
      );
      const futureTrips = trips.filter((t: any) => new Date(t.startDate) >= new Date());
      if (futureTrips.length === 0) {
        return {
          es: 'No tienes visitas o contratos programados a futuro.',
          en: 'You have no future stays scheduled at this time.',
        };
      }
      const sorted = [...futureTrips].sort((a: any, b: any) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());
      const next = sorted[0];
      const isSender = next.senderId === ctx.currentUser?.id;
      const partnerPropId = isSender ? next.receiverPropertyId : next.senderPropertyId;
      const partnerProp = ctx.properties.find((p: any) => p.id === partnerPropId);
      const dest = partnerProp ? `"${partnerProp.title}" en ${partnerProp.location} (${partnerProp.country})` : 'Intercambio Recíproco';
      return {
        es: `Tu próximo contrato/visita es en "${dest}", del ${next.startDate} al ${next.endDate}.`,
        en: `Your next stay is at "${dest}", from ${next.startDate} to ${next.endDate}.`
      };
    }
  },
  {
    patterns: [
      /\b(mi ultima solicitud|mi última solicitud|cual fue mi ultima visita|cuál fue mi última visita|ultima visita|última visita|last stay|previous stay)\b/i,
    ],
    action: 'local_response',
    getResponse: (ctx) => {
      const trips = ctx.swaps.filter(s =>
        (s.senderId === ctx.currentUser?.id || s.receiverId === ctx.currentUser?.id) &&
        ['COMPLETED', 'APPROVED', 'CONFIRMED'].includes(s.status)
      );
      const pastTrips = trips.filter((t: any) => new Date(t.endDate) < new Date());
      if (pastTrips.length === 0) {
        return {
          es: 'No tienes registros de contratos o visitas completadas.',
          en: 'You have no records of past completed stays in your account.',
        };
      }
      const sorted = [...pastTrips].sort((a: any, b: any) => new Date(b.endDate).getTime() - new Date(a.endDate).getTime());
      const last = sorted[0];
      const isSender = last.senderId === ctx.currentUser?.id;
      const partnerPropId = isSender ? last.receiverPropertyId : last.senderPropertyId;
      const partnerProp = ctx.properties.find((p: any) => p.id === partnerPropId);
      const dest = partnerProp ? `"${partnerProp.title}" en ${partnerProp.location}` : 'Intercambio Costero';
      return {
        es: `Tu último contrato/visita completada fue en "${dest}", el cual concluyó el ${last.endDate}.`,
        en: `Your last completed stay was at "${dest}", which concluded on ${last.endDate}.`
      };
    }
  },
  {
    patterns: [
      /\b(solicitudes este año|solicitudes de este año|solicitudes del 2026|requests this year)\b/i,
    ],
    action: 'local_response',
    getResponse: (ctx) => {
      const trips = ctx.swaps.filter(s =>
        (s.senderId === ctx.currentUser?.id || s.receiverId === ctx.currentUser?.id) &&
        ['APPROVED', 'CONFIRMED', 'ACTIVE', 'COMPLETED'].includes(s.status) &&
        (s.startDate.includes('2026') || s.endDate.includes('2026'))
      );
      if (trips.length === 0) {
        return {
          es: 'No tienes contratos o visitas registradas para el año en curso (2026).',
          en: 'You have no registered trips for the current year (2026).'
        };
      }
      const list = trips.map((t: any, i: number) => {
        const isSender = t.senderId === ctx.currentUser?.id;
        const partnerPropId = isSender ? t.receiverPropertyId : t.senderPropertyId;
        const partnerProp = ctx.properties.find((p: any) => p.id === partnerPropId);
        return `${i + 1}. del ${t.startDate} al ${t.endDate} en "${partnerProp?.title || 'Propiedad'}" en ${partnerProp?.location || 'Intercambio'}`;
      }).join('\n');
      return {
        es: `Tus solicitudes de este año 2026 son:\n${list}`,
        en: `Your trips for this year 2026 are:\n${list}`
      };
    }
  },
  {
    patterns: [
      /\b(solicitudes activas|solicitudes en curso|solicitud en curso|solicitud activa|active requests|current requests)\b/i,
    ],
    action: 'local_response',
    getResponse: (ctx) => {
      const trips = ctx.swaps.filter(s =>
        (s.senderId === ctx.currentUser?.id || s.receiverId === ctx.currentUser?.id) &&
        (s.status === 'ACTIVE' || (['APPROVED', 'CONFIRMED'].includes(s.status) && new Date(s.startDate) <= new Date() && new Date(s.endDate) >= new Date()))
      );
      if (trips.length === 0) {
        return {
          es: 'No tienes ningún contrato o visita activa hoy.',
          en: 'You have no trips currently active or in progress today.'
        };
      }
      const list = trips.map((t: any, i: number) => {
        const isSender = t.senderId === ctx.currentUser?.id;
        const partnerPropId = isSender ? t.receiverPropertyId : t.senderPropertyId;
        const partnerProp = ctx.properties.find((p: any) => p.id === partnerPropId);
        return `${i + 1}. Visita en "${partnerProp?.title || 'Propiedad'}" del ${t.startDate} al ${t.endDate}`;
      }).join('\n');
      return {
        es: `Tienes las siguientes solicitudes activas hoy:\n${list}`,
        en: `You have the following active trips today:\n${list}`
      };
    }
  },
  {
    patterns: [
      /\b(solicitudes aprobadas|solicitudes confirmadas|requests approved|approved requests)\b/i,
    ],
    action: 'local_response',
    getResponse: (ctx) => {
      const approved = ctx.swaps.filter(s =>
        (s.senderId === ctx.currentUser?.id || s.receiverId === ctx.currentUser?.id) &&
        ['APPROVED', 'CONFIRMED'].includes(s.status)
      );
      if (approved.length === 0) {
        return {
          es: 'No tienes solicitudes confirmadas en este momento.',
          en: 'You have no trips with Approved status at this time.'
        };
      }
      const list = approved.map((t: any, i: number) => {
        const isSender = t.senderId === ctx.currentUser?.id;
        const partnerPropId = isSender ? t.receiverPropertyId : t.senderPropertyId;
        const partnerProp = ctx.properties.find((p: any) => p.id === partnerPropId);
        return `${i + 1}. en "${partnerProp?.title || 'Propiedad'}" del ${t.startDate} al ${t.endDate} (${t.status})`;
      }).join('\n');
      return {
        es: `Tus solicitudes aprobadas y programadas son:\n${list}`,
        en: `Your approved and scheduled trips are:\n${list}`
      };
    }
  },
  {
    patterns: [
      /\b(solicitudes pendientes|solicitudes sin confirmar|solicitudes en espera|requests pending|pending requests)\b/i,
    ],
    action: 'local_response',
    getResponse: (ctx) => {
      const pendingTrips = ctx.swaps.filter(s =>
        (s.senderId === ctx.currentUser?.id || s.receiverId === ctx.currentUser?.id) &&
        s.status === 'PENDING'
      );
      if (pendingTrips.length === 0) {
        return {
          es: 'No tienes ninguna solicitud en estado pendiente de aprobación.',
          en: 'You have no requests pending approval.'
        };
      }
      const list = pendingTrips.map((t: any, i: number) => {
        const isSender = t.senderId === ctx.currentUser?.id;
        const partnerPropId = isSender ? t.receiverPropertyId : t.senderPropertyId;
        const partnerProp = ctx.properties.find((p: any) => p.id === partnerPropId);
        return `${i + 1}. en "${partnerProp?.title || 'Propiedad'}" del ${t.startDate} al ${t.endDate}`;
      }).join('\n');
      return {
        es: `Tienes las siguientes solicitudes pendientes de confirmación:\n${list}`,
        en: `You have the following requests pending confirmation:\n${list}`
      };
    }
  },
  {
    patterns: [
      /\b(cuales son mis solicitudes|cuáles son mis solicitudes|muestrame mis solicitudes|muéstrame mis solicitudes|mis solicitudes|mis visitas|mis contratos)\b/i,
    ],
    action: 'local_response',
    getResponse: (ctx) => {
      const trips = ctx.swaps.filter(s =>
        (s.senderId === ctx.currentUser?.id || s.receiverId === ctx.currentUser?.id) &&
        ['APPROVED', 'CONFIRMED', 'ACTIVE', 'COMPLETED'].includes(s.status)
      );
      if (trips.length === 0) {
        return {
          es: 'No tienes contratos o visitas registradas en tu cuenta.',
          en: 'You have no scheduled or completed trips in your account.',
        };
      }
      const esList = trips.map((t: any, idx: number) => {
        const isSender = t.senderId === ctx.currentUser?.id;
        const partnerPropId = isSender ? t.receiverPropertyId : t.senderPropertyId;
        const partnerProp = ctx.properties.find((p: any) => p.id === partnerPropId);
        const dest = partnerProp ? `"${partnerProp.title}" en ${partnerProp.location} (${partnerProp.country})` : 'Intercambio Recíproco';
        return `${idx + 1}. ${dest} — del ${t.startDate} al ${t.endDate} (${t.status})`;
      }).join('\n');
      const enList = trips.map((t: any, idx: number) => {
        const isSender = t.senderId === ctx.currentUser?.id;
        const partnerPropId = isSender ? t.receiverPropertyId : t.senderPropertyId;
        const partnerProp = ctx.properties.find((p: any) => p.id === partnerPropId);
        const dest = partnerProp ? `"${partnerProp.title}" in ${partnerProp.location} (${partnerProp.country})` : 'Reciprocal Swap';
        return `${idx + 1}. ${dest} — from ${t.startDate} to ${t.endDate} (${t.status})`;
      }).join('\n');
      return {
        es: `Tus solicitudes son:\n${esList}`,
        en: `Your requests/stays are:\n${enList}`,
      };
    },
  },
  {
    patterns: [
      /\b(cuantas solicitudes tengo|cuántas solicitudes tengo|numero de solicitudes|número de solicitudes)\b/i,
    ],
    action: 'local_response',
    getResponse: (ctx) => {
      const trips = ctx.swaps.filter(s =>
        (s.senderId === ctx.currentUser?.id || s.receiverId === ctx.currentUser?.id) &&
        ['APPROVED', 'CONFIRMED', 'ACTIVE', 'COMPLETED'].includes(s.status)
      );
      const list = trips.map((t: any, idx: number) => {
        const isSender = t.senderId === ctx.currentUser?.id;
        const partnerPropId = isSender ? t.receiverPropertyId : t.senderPropertyId;
        const partnerProp = ctx.properties.find((p: any) => p.id === partnerPropId);
        return `${idx + 1}. en "${partnerProp?.title || 'Propiedad'}" del ${t.startDate} al ${t.endDate}`;
      }).join('\n');
      return {
        es: ctx.activeTrips > 0
          ? `Tienes ${ctx.activeTrips} solicitud(es) registrada(s) en tu cuenta:\n${list}`
          : 'No tienes viajes registrados programados en este momento.',
        en: ctx.activeTrips > 0
          ? `You have ${ctx.activeTrips} registered request(s) in your account:\n${list}`
          : 'You have no active trips currently scheduled.',
      };
    },
  },

  // ── CATEGORÍA: SWAPS (INTERCAMBIOS) ──
  {
    patterns: [
      /\b(solicitudes recibi|solicitudes recibí|propuestas recibidas|que recibi|qué recibí|swaps recibidos|solicitudes esperan mi respuesta|solicitudes que esperan mi respuesta|esperan mi respuesta)\b/i,
    ],
    action: 'local_response',
    getResponse: (ctx) => {
      const received = ctx.swaps.filter(s => s.receiverId === ctx.currentUser?.id);
      if (received.length === 0) {
        return {
          es: 'Aún no has recibido ninguna solicitud de intercambio en tu cuenta.',
          en: 'You have not received any swap requests in your account yet.'
        };
      }
      const esList = received.map((s: any, i: number) => {
        const partnerProp = ctx.properties.find((p: any) => p.id === s.senderPropertyId);
        const myProp = ctx.properties.find((p: any) => p.id === s.receiverPropertyId);
        const senderName = partnerProp ? partnerProp.hostName : 'Otro miembro';
        const partnerTitle = partnerProp ? `"${partnerProp.title}"` : 'su propiedad';
        const myTitle = myProp ? `"${myProp.title}"` : 'tu propiedad';
        return `${i + 1}. De ${senderName}: ${partnerTitle} por ${myTitle} — del ${s.startDate} al ${s.endDate} (${s.status})`;
      }).join('\n');
      const enList = received.map((s: any, i: number) => {
        const partnerProp = ctx.properties.find((p: any) => p.id === s.senderPropertyId);
        const myProp = ctx.properties.find((p: any) => p.id === s.receiverPropertyId);
        const senderName = partnerProp ? partnerProp.hostName : 'Another member';
        const partnerTitle = partnerProp ? `"${partnerProp.title}"` : 'their property';
        const myTitle = myProp ? `"${myProp.title}"` : 'your property';
        return `${i + 1}. From ${senderName}: ${partnerTitle} for ${myTitle} — from ${s.startDate} to ${s.endDate} (${s.status})`;
      }).join('\n');
      return {
        es: `Las solicitudes recibidas son:\n${esList}`,
        en: `The received requests are:\n${enList}`
      };
    }
  },
  {
    patterns: [
      /\b(swaps pendientes|intercambio pendiente|intercambios pendientes|propuestas pendientes|que intercambio sigue pendiente|qué intercambio sigue pendiente|intercambios sin responder|que intercambios tengo pendientes|qué intercambios tengo pendientes)\b/i,
    ],
    action: 'local_response',
    getResponse: (ctx) => {
      const pending = ctx.swaps.filter(s =>
        s.status === 'PENDING' && (s.receiverId === ctx.currentUser?.id || s.senderId === ctx.currentUser?.id)
      );
      if (pending.length === 0) {
        return {
          es: 'No tienes propuestas de intercambio pendientes en este momento.',
          en: 'You have no pending swap requests at this moment.',
        };
      }
      const esList = pending.map((s: any, idx: number) => {
        const isIncoming = s.receiverId === ctx.currentUser?.id;
        const myPropId = isIncoming ? s.receiverPropertyId : s.senderPropertyId;
        const partnerPropId = isIncoming ? s.senderPropertyId : s.receiverPropertyId;
        const myProp = ctx.properties.find((p: any) => p.id === myPropId);
        const partnerProp = ctx.properties.find((p: any) => p.id === partnerPropId);
        
        const typeStr = isIncoming ? 'Recibida' : 'Enviada';
        const myTitle = myProp ? myProp.title : 'Tu casa';
        const partnerTitle = partnerProp ? `${partnerProp.title} en ${partnerProp.location}` : 'otra propiedad';
        return `${idx + 1}. [Propuesta ${typeStr}] "${myTitle}" por "${partnerTitle}" — del ${s.startDate} al ${s.endDate}`;
      }).join('\n');
      const enList = pending.map((s: any, idx: number) => {
        const isIncoming = s.receiverId === ctx.currentUser?.id;
        const myPropId = isIncoming ? s.receiverPropertyId : s.senderPropertyId;
        const partnerPropId = isIncoming ? s.senderPropertyId : s.receiverPropertyId;
        const myProp = ctx.properties.find((p: any) => p.id === myPropId);
        const partnerProp = ctx.properties.find((p: any) => p.id === partnerPropId);
        
        const typeStr = isIncoming ? 'Incoming' : 'Outgoing';
        const myTitle = myProp ? myProp.title : 'Your home';
        const partnerTitle = partnerProp ? `${partnerProp.title} in ${partnerProp.location}` : 'another property';
        return `${idx + 1}. [${typeStr} Request] "${myTitle}" for "${partnerTitle}" — from ${s.startDate} to ${s.endDate}`;
      }).join('\n');
      return {
        es: `Tus intercambios pendientes son:\n${esList}`,
        en: `Your pending swaps are:\n${enList}`,
      };
    },
  },
  {
    patterns: [
      /\b(swaps aprobados|intercambios aprobados|propuestas aprobadas|swaps confirmados|intercambios confirmados)\b/i,
    ],
    action: 'local_response',
    getResponse: (ctx) => {
      const approved = ctx.swaps.filter(s =>
        ['APPROVED', 'CONFIRMED', 'ACTIVE'].includes(s.status) &&
        (s.senderId === ctx.currentUser?.id || s.receiverId === ctx.currentUser?.id)
      );
      if (approved.length === 0) {
        return {
          es: 'No tienes ningún intercambio aprobado registrado en tu cuenta.',
          en: 'You have no approved swaps registered in your account.'
        };
      }
      const list = approved.map((s: any, i: number) => {
        const isSender = s.senderId === ctx.currentUser?.id;
        const partnerPropId = isSender ? s.receiverPropertyId : s.senderPropertyId;
        const partnerProp = ctx.properties.find((p: any) => p.id === partnerPropId);
        return `${i + 1}. Intercambio en "${partnerProp?.title || 'Propiedad'}" del ${s.startDate} al ${s.endDate} (${s.status})`;
      }).join('\n');
      return {
        es: `Tus intercambios aprobados son:\n${list}`,
        en: `Your approved swaps are:\n${list}`
      };
    }
  },
  {
    patterns: [
      /\b(swaps rechazados|intercambios rechazados|propuestas rechazadas|swaps declinados|intercambios declinados)\b/i,
    ],
    action: 'local_response',
    getResponse: (ctx) => {
      const declined = ctx.swaps.filter(s =>
        ['DECLINED', 'REJECTED'].includes(s.status) &&
        (s.senderId === ctx.currentUser?.id || s.receiverId === ctx.currentUser?.id)
      );
      if (declined.length === 0) {
        return {
          es: 'No registras propuestas de intercambio rechazadas en tu cuenta.',
          en: 'You do not register rejected swap proposals in your account.'
        };
      }
      const list = declined.map((s: any, i: number) => {
        const partnerProp = ctx.properties.find((p: any) => p.id === (s.senderId === ctx.currentUser?.id ? s.receiverPropertyId : s.senderPropertyId));
        return `${i + 1}. a "${partnerProp?.title || 'Propiedad'}" del ${s.startDate} al ${s.endDate}`;
      }).join('\n');
      return {
        es: `Tus propuestas rechazadas son:\n${list}`,
        en: `Your rejected proposals are:\n${list}`
      };
    }
  },
  {
    patterns: [
      /\b(solicitudes envie|solicitudes envié|propuestas enviadas|que envie|qué envié|swaps enviados)\b/i,
    ],
    action: 'local_response',
    getResponse: (ctx) => {
      const sent = ctx.swaps.filter(s => s.senderId === ctx.currentUser?.id);
      if (sent.length === 0) {
        return {
          es: 'Aún no has enviado propuestas de intercambio a otros anfitriones.',
          en: 'You have not sent swap proposals to other hosts yet.'
        };
      }
      const list = sent.map((s: any, i: number) => {
        const partnerProp = ctx.properties.find((p: any) => p.id === s.receiverPropertyId);
        const name = partnerProp ? `a "${partnerProp.title}"` : 'a otra propiedad';
        return `${i + 1}. Propuesta ${name} del ${s.startDate} al ${s.endDate} (${s.status})`;
      }).join('\n');
      return {
        es: `Las solicitudes que has enviado son:\n${list}`,
        en: `The requests you have sent are:\n${list}`
      };
    }
  },
  {
    patterns: [
      /\b(cuantos swaps tengo|cuántos swaps tengo|total swaps|total de swaps|numero de swaps)\b/i,
    ],
    action: 'local_response',
    getResponse: (ctx) => {
      const userSwaps = ctx.swaps.filter(s => s.senderId === ctx.currentUser?.id || s.receiverId === ctx.currentUser?.id);
      const list = userSwaps.map((s: any, i: number) => {
        const partnerProp = ctx.properties.find((p: any) => p.id === (s.senderId === ctx.currentUser?.id ? s.receiverPropertyId : s.senderPropertyId));
        return `${i + 1}. a "${partnerProp?.title || 'Propiedad'}" del ${s.startDate} al ${s.endDate} (${s.status})`;
      }).join('\n');
      return {
        es: `Registras un total de ${userSwaps.length} propuesta(s) de intercambio (swaps):\n${list}`,
        en: `You register a total of ${userSwaps.length} swap proposal(s):\n${list}`
      };
    }
  },

  // ── CATEGORÍA: MENSAJES ──
  {
    patterns: [
      /\bquien\b.*\b(escribio|envio|mando|contacto|escribiendo|enviando|mandando|escribe|escribia|escrito|remitente|remitentes)\b/i,
      /\b(remitente|remitentes)\b.*\b(mensajes|mensaje|chat|chats|buzon|buzon)\b/i,
      /\b(de quien|quien)\b.*\b(mensajes|mensaje|chat|chats)\b/i,
      /\b(quien me ha escrito|quien me ha contactado)\b/i
    ],
    action: 'local_response',
    getResponse: (ctx) => {
      const externalMsgs = ctx.messages.filter((m: any) => m.senderId !== ctx.currentUser?.id);
      if (externalMsgs.length === 0) {
        return {
          es: 'Nadie te ha escrito ningún mensaje en tu buzón todavía.',
          en: 'Nobody has written any messages in your inbox yet.'
        };
      }
      
      const senderCounts = new Map<string, number>();
      externalMsgs.forEach((m: any) => {
        const name = m.senderName || 'Otro usuario';
        senderCounts.set(name, (senderCounts.get(name) || 0) + 1);
      });

      const partsES: string[] = [];
      const partsEN: string[] = [];
      senderCounts.forEach((count, name) => {
        partsES.push(`${name} te escribió ${count} mensaje${count > 1 ? 's' : ''}`);
        partsEN.push(`${name} wrote you ${count} message${count > 1 ? 's' : ''}`);
      });

      const esResult = partsES.join(' y ');
      const enResult = partsEN.join(' and ');

      return {
        es: `${esResult}.`,
        en: `${enResult}.`
      };
    }
  },
  {
    patterns: [
      /\b(conversaciones|mis conversaciones|conversaciones activas|chat feed|chats)\b/i,
    ],
    action: 'local_response',
    getResponse: (ctx) => {
      const externalMsgs = ctx.messages.filter((m: any) => m.senderId !== ctx.currentUser?.id);
      if (externalMsgs.length === 0) {
        return {
          es: 'Aún no tienes conversaciones abiertas con otros anfitriones.',
          en: 'You do not have any open conversations with other hosts yet.'
        };
      }
      const uniqueSenders = new Map<string, any>();
      externalMsgs.forEach((m: any) => {
        if (!uniqueSenders.has(m.senderId)) {
          uniqueSenders.set(m.senderId, m);
        }
      });
      const listEs = Array.from(uniqueSenders.values()).map((m: any, idx: number) => {
        return `${idx + 1}. Con ${m.senderName}: "${m.content.slice(0, 45)}..."`;
      }).join('\n');
      const listEn = Array.from(uniqueSenders.values()).map((m: any, idx: number) => {
        return `${idx + 1}. With ${m.senderName}: "${m.content.slice(0, 45)}..."`;
      }).join('\n');
      return {
        es: `Tus conversaciones activas son:\n${listEs}`,
        en: `Your active conversations are:\n${listEn}`
      };
    }
  },
  {
    patterns: [
      /\b(tengo mensajes nuevos|tengo nuevos mensajes|mensajes nuevos|mensajes sin leer|unread messages|new messages|notificaciones de chat)\b/i,
    ],
    action: 'local_response',
    getResponse: (ctx) => {
      const unread = ctx.messages.filter((m: any) => !m.isRead && m.senderId !== ctx.currentUser?.id);
      if (unread.length === 0) {
        return {
          es: 'No tienes mensajes nuevos sin leer. Tu buzón está al día.',
          en: 'You have no new unread messages. Your inbox is up to date.'
        };
      }
      const esList = unread.map((m: any, idx: number) => `${idx + 1}. De ${m.senderName}: "${m.content.slice(0, 50)}..."`).join('\n');
      const enList = unread.map((m: any, idx: number) => `${idx + 1}. From ${m.senderName}: "${m.content.slice(0, 50)}..."`).join('\n');
      if (unread.length === 1) {
        return {
          es: `Tienes un nuevo mensaje sin leer:\n${esList}`,
          en: `You have one new unread message:\n${enList}`
        };
      }
      return {
        es: `Tienes ${unread.length} mensajes nuevos sin leer:\n${esList}`,
        en: `You have ${unread.length} new unread messages:\n${enList}`
      };
    }
  },
  {
    patterns: [
      /\b(cuantos mensajes tengo|cuántos mensajes tengo|mensajes totales|total mensajes|total de mensajes)\b/i,
    ],
    action: 'local_response',
    getResponse: (ctx) => {
      const total = ctx.messages.length;
      if (total === 1) {
        return {
          es: 'Tienes un total de un mensaje intercambiado en tu cuenta.',
          en: 'You have a total of one message exchanged in your account.'
        };
      }
      return {
        es: `Tienes un total de ${total} mensajes intercambiados en tu cuenta.`,
        en: `You have a total of ${total} messages exchanged in your account.`
      };
    }
  },

  // ── CATEGORÍA: RESEÑAS ──
  {
    patterns: [
      /\b(cuantas reseñas tengo|cuántas reseñas tengo|cuantas valoraciones tengo|cuántas valoraciones tengo|mis opiniones|my reviews)\b/i,
    ],
    action: 'local_response',
    getResponse: (ctx) => {
      const myReviews = ctx.reviews.filter((r: any) => r.reviewedUserId === ctx.currentUser?.id);
      const list = myReviews.map((r: any, idx: number) => `${idx + 1}. ${r.reviewerName || 'Usuario'}: "${r.comment.slice(0, 50)}..." (${r.rating}★)`).join('\n');
      return {
        es: `Tienes ${myReviews.length} reseña(s) en tu perfil:\n${list}`,
        en: `You have ${myReviews.length} review(s) on your profile:\n${list}`
      };
    }
  },
  {
    patterns: [
      /\b(cual es mi calificacion|cuál es mi calificación|mi rating|mi puntuacion|mi puntuación|rating promedio|puntuacion promedio|puntuación promedio)\b/i,
    ],
    action: 'local_response',
    getResponse: (ctx) => {
      const myReviews = ctx.reviews.filter((r: any) => r.reviewedUserId === ctx.currentUser?.id);
      const avg = myReviews.length > 0
        ? (myReviews.reduce((a: any, r: any) => a + r.rating, 0) / myReviews.length).toFixed(1)
        : null;
      return {
        es: avg
          ? `Tu calificación promedio actual es de ${avg} estrellas con ${myReviews.length} reseña(s).`
          : 'Aún no tienes valoraciones de otros miembros en tu cuenta.',
        en: avg
          ? `Your current average rating is ${avg} stars with ${myReviews.length} review(s).`
          : 'You do not have ratings from other members in your account yet.'
      };
    }
  },
  {
    patterns: [
      /\b(reseñas pendientes|reseñas por escribir|reseñas que me faltan|reseña pendiente|tengo reseñas pendientes|tengo reseña pendiente|missing reviews|pending reviews)\b/i,
    ],
    action: 'local_response',
    getResponse: (ctx) => {
      const pendingReviews = ctx.swaps.filter(s =>
        s.status === 'COMPLETED' &&
        (s.senderId === ctx.currentUser?.id || s.receiverId === ctx.currentUser?.id) &&
        !ctx.reviews.some(r => r.swapId === s.id && r.reviewerId === ctx.currentUser?.id)
      );
      if (pendingReviews.length === 0) {
        return {
          es: 'No tienes ninguna reseña pendiente por escribir en tu cuenta. ¡Estás al día!',
          en: 'You have no pending reviews to write in your account. You are all set!'
        };
      }
      const list = pendingReviews.map((t: any, i: number) => {
        const partnerProp = ctx.properties.find((p: any) => p.id === (t.senderId === ctx.currentUser?.id ? t.receiverPropertyId : t.senderPropertyId));
        return `${i + 1}. Tras visita en "${partnerProp?.title || 'Propiedad'}" del ${t.startDate} al ${t.endDate}`;
      }).join('\n');
      return {
        es: `Tienes ${pendingReviews.length} reseña(s) pendiente(s) por escribir tras intercambios completados:\n${list}`,
        en: `You have ${pendingReviews.length} pending review(s) to write after completed swaps:\n${list}`
      };
    }
  },
  {
    patterns: [
      /\b(quien me califico|quién me calificó|quien me reseño|quién me reseñó|quien me ha valorado|quién me ha valorado)\b/i,
    ],
    action: 'local_response',
    getResponse: (ctx) => {
      const myReviews = ctx.reviews.filter((r: any) => r.reviewedUserId === ctx.currentUser?.id);
      if (myReviews.length === 0) {
        return {
          es: 'Aún no registras valoraciones escritas por otros miembros.',
          en: 'You do not have ratings written by other members yet.'
        };
      }
      const reviewers = myReviews.map((r: any) => `${r.reviewerName || 'Usuario'} (${r.rating}★)`).join(', ');
      return {
        es: `Has sido calificado por los siguientes miembros: ${reviewers}.`,
        en: `You have been rated by the following members: ${reviewers}.`
      };
    }
  },

  // ── CATEGORÍA: RESUMEN EJECUTIVO (ACCOUNT EXECUTIVE SUMMARY) ──
  {
    patterns: [
      /\b(como va mi cuenta|cómo va mi cuenta|dame un resumen|novedades|tengo pendiente|resumen rapido|resumen rápido|estado de mi cuenta|resumen|estado de cuenta|resumen de cuenta|novedades de mi cuenta|hay algo nuevo|hay algo de nuevo)\b/i,
    ],
    action: 'local_response',
    getResponse: (ctx) => {
      const myProps = ctx.properties.filter((p: any) => p.hostId === ctx.currentUser?.id);
      const propsList = myProps.map((p: any) => p.title).join(', ') || 'ninguna';
      
      const trips = ctx.swaps.filter(s =>
        (s.senderId === ctx.currentUser?.id || s.receiverId === ctx.currentUser?.id) &&
        ['APPROVED', 'CONFIRMED', 'ACTIVE'].includes(s.status)
      );
      
      const pending = ctx.swaps.filter(s =>
        s.status === 'PENDING' && (s.receiverId === ctx.currentUser?.id || s.senderId === ctx.currentUser?.id)
      );

      const myReviews = ctx.reviews.filter((r: any) => r.reviewedUserId === ctx.currentUser?.id);
      const avg = myReviews.length > 0
        ? (myReviews.reduce((a: any, r: any) => a + r.rating, 0) / myReviews.length).toFixed(1)
        : null;

      const unread = ctx.messages.filter((m: any) => !m.isRead && m.senderId !== ctx.currentUser?.id);

      return {
        es: `Resumen de tu cuenta:\n` +
            `• Propiedades (${myProps.length}): ${propsList}.\n` +
            `• Viajes activos/aprobados (${trips.length}): ${trips.length > 0 ? trips.map((t: any) => `del ${t.startDate} al ${t.endDate}`).join(', ') : 'Ninguno'}.\n` +
            `• Swaps pendientes (${pending.length}): ${pending.length > 0 ? `tienes ${pending.length} propuestas por revisar` : 'al día'}.\n` +
            `• Mensajes nuevos (${unread.length}): ${unread.length > 0 ? `tienes ${unread.length} mensajes sin leer` : 'ninguno'}.\n` +
            `• Calificación: ${avg ? `${avg} estrellas (${myReviews.length} reseñas)` : 'Aún sin calificaciones'}.`,
        en: `Your account summary:\n` +
            `• Properties (${myProps.length}): ${propsList}.\n` +
            `• Trips (${trips.length}): ${trips.length > 0 ? trips.map((t: any) => `from ${t.startDate} to ${t.endDate}`).join(', ') : 'None'}.\n` +
            `• Pending swaps (${pending.length}): ${pending.length > 0 ? `you have ${pending.length} pending proposals` : 'all caught up'}.\n` +
            `• New messages (${unread.length}): ${unread.length > 0 ? `${unread.length} unread messages` : 'none'}.\n` +
            `• Rating: ${avg ? `${avg} stars (${myReviews.length} reviews)` : 'No ratings yet'}.`
      };
    }
  },

  {
    patterns: [
      /\b(ver|abrir|ir|ir a|llevame|llévame|llevame a|llévame a|show|open|go|go to)\b.*\b(mensajes|inbox|chat|messages|conversations|conversacion|conversaciones|bandeja)\b/i,
      /\b(mis mensajes|my messages)\b/i
    ],
    route: '/messages',
    action: 'navigate',
    getResponse: (ctx) => ({
      es: ctx.unreadMessages > 0
        ? (ctx.unreadMessages === 1
            ? 'Tienes un mensaje sin leer. Te llevo al buzón.'
            : `Tienes ${ctx.unreadMessages} mensajes sin leer. Te llevo al buzón.`)
        : 'Tu buzón está al día. Te llevo a tus conversaciones.',
      en: ctx.unreadMessages > 0
        ? (ctx.unreadMessages === 1
            ? 'You have one unread message. Taking you to your inbox.'
            : `You have ${ctx.unreadMessages} unread messages. Taking you to your inbox.`)
        : 'Your inbox is all caught up. Taking you to your conversations.',
    }),
  },
  {
    patterns: [
      /\b(ver|abrir|ir|ir a|llevame|llévame|llevame a|llévame a|show|open|go|go to)\b.*\b(solicitudes|requests|mis solicitudes|my requests|visitas|contratos|visita|reserva activa)\b/i,
      /\b(mis solicitudes|my requests|solicitudes activas|active requests)\b/i
    ],
    route: '/dashboard?tab=trips',
    action: 'navigate',
    getResponse: (ctx) => ({
      es: ctx.activeTrips > 0
        ? (ctx.activeTrips === 1
            ? 'Tienes una solicitud activa. Te llevo al panel de solicitudes.'
            : `Tienes ${ctx.activeTrips} viajes activos. Te llevo al panel de viajes.`)
        : 'No tienes viajes activos en este momento. Te llevo al panel de viajes.',
      en: ctx.activeTrips > 0
        ? (ctx.activeTrips === 1
            ? 'You have one active request. Taking you to your requests panel.'
            : `You have ${ctx.activeTrips} active trips. Taking you to your trips panel.`)
        : 'No active trips at the moment. Taking you to your trips panel.',
    }),
  },
  {
    patterns: [
      /\b(ver|abrir|ir|ir a|llevame|llévame|llevame a|llévame a|show|open|go|go to)\b.*\b(perfil|profile|mi perfil|my profile|editar perfil|edit profile)\b/i,
      /\b(mi perfil|my profile|perfil)\b/i
    ],
    route: '/profile',
    action: 'navigate',
    getResponse: () => ({
      es: 'Te llevo a tu perfil para que lo revises o actualices.',
      en: 'Taking you to your profile to review or update it.',
    }),
  },
  {
    patterns: [
      /\b(ver|abrir|ir|ir a|llevame|llévame|llevame a|llévame a|show|open|go|go to)\b.*\b(configuracion|configuración|ajustes|settings|administracion|administración|consola|consola admin)\b/i,
    ],
    route: '/dashboard',
    action: 'navigate',
    getResponse: (ctx) => {
      const isAdmin = ctx.currentUser?.role === 'ADMIN';
      return {
        es: isAdmin 
          ? 'Te llevo a la Consola de Administración ahora.' 
          : 'Te llevo a la sección de configuración de tu cuenta.',
        en: isAdmin 
          ? 'Taking you to the Administration Console now.' 
          : 'Taking you to your account settings section.',
      };
    },
  },
  {
    patterns: [
      /\b(ver|abrir|ir|ir a|llevame|llévame|llevame a|llévame a|show|open|go|go to)\b.*\b(dashboard|panel|cockpit|mi cuenta|my account|inicio|panel de control)\b/i,
      /\b(dashboard|panel|cockpit|panel de control)\b/i
    ],
    route: '/dashboard',
    action: 'navigate',
    getResponse: () => ({
      es: 'Te llevo a tu panel de control ahora.',
      en: 'Taking you to your dashboard now.',
    }),
  },

  // ── CATEGORÍA: ATAJOS DE VOZ Y AYUDA ──
  {
    patterns: [
      /\b(ayuda|help|guia|guía|instrucciones|soporte|como funciona Eterna|cómo funciona Eterna)\b/i,
    ],
    action: 'local_response',
    getResponse: () => ({
      es: 'Soy Eterna, tu concierge inmobiliaria de Towers México. En este modo local, puedo detallarte tus propiedades, solicitudes, propuestas de intercambio (swaps), mensajes sin leer, detalles de entrada de tu próxima visita y calificaciones. También puedo llevarte a cualquier sección si me dices "llévame a...". ¿Qué te gustaría consultar?',
      en: 'I am Eterna, your real estate concierge at Towers México. In this local mode, I can detail your properties, requests, swap proposals, unread messages, move-in details for your next stay, and reviews. I can also take you to any section if you say "take me to...". What would you like to consult?'
    })
  },
  {
    patterns: [/\b(resumen|summary)\b/i],
    action: 'local_response',
    getResponse: (ctx) => {
      const myProps = ctx.properties.filter((p: any) => p.hostId === ctx.currentUser?.id);
      
      const propsStrES = myProps.length === 1 ? 'una propiedad registrada' : `${myProps.length} propiedades registradas`;
      const tripsStrES = ctx.activeTrips === 1 ? 'una solicitud activa' : `${ctx.activeTrips} solicitudes activas`;
      const swapsStrES = ctx.pendingSwaps === 1 ? 'una solicitud de intercambio pendiente de revisión' : `${ctx.pendingSwaps} solicitudes de intercambio pendientes de revisión`;

      const propsStrEN = myProps.length === 1 ? 'one property registered' : `${myProps.length} properties registered`;
      const tripsStrEN = ctx.activeTrips === 1 ? 'one active trip' : `${ctx.activeTrips} active trips`;
      const swapsStrEN = ctx.pendingSwaps === 1 ? 'one swap request pending review' : `${ctx.pendingSwaps} swap requests pending review`;

      return {
        es: `Resumen rápido para ${ctx.userName.split(' ')[0]}: Tienes ${propsStrES}, ${tripsStrES} y ${swapsStrES}.`,
        en: `Quick summary for ${ctx.userName.split(' ')[0]}: You have ${propsStrEN}, ${tripsStrEN}, and ${swapsStrEN}.`
      };
    }
  },
  {
    patterns: [/\b(pendientes|pending)\b/i],
    action: 'local_response',
    getResponse: (ctx) => {
      const swapsStrES = ctx.pendingSwaps === 1 ? 'una propuesta de intercambio' : `${ctx.pendingSwaps} propuestas de intercambio`;
      const reviewsStrES = ctx.pendingReviews === 1 ? 'una reseña por escribir' : `${ctx.pendingReviews} reseñas por escribir`;

      const swapsStrEN = ctx.pendingSwaps === 1 ? 'one swap proposal' : `${ctx.pendingSwaps} swap proposals`;
      const reviewsStrEN = ctx.pendingReviews === 1 ? 'one review to write' : `${ctx.pendingReviews} reviews to write`;

      return {
        es: `Pendientes actuales: Tienes ${swapsStrES} y ${reviewsStrES}.`,
        en: `Current pending items: You have ${swapsStrEN} and ${reviewsStrEN}.`
      };
    }
  },

  // ── CONFIGURACIONES DE RESPALDOS DE CATÁLOGO GENERAL ──
  {
    patterns: [
      /\b(casas en la playa|casa en la playa|beach house|beach houses|playa|mar|costa)\b/i,
      /\b(mostrar|busca|ver|encuentra)\b.*\b(playa|beach|mar)\b/i,
    ],
    action: 'local_response',
    getResponse: (ctx) => {
      const beachProps = ctx.properties.filter((p: any) =>
        p.type === 'Beach House' ||
        p.title.toLowerCase().includes('playa') ||
        p.location.toLowerCase().includes('playa')
      );
      if (beachProps.length === 0) {
        return {
          es: 'Lo siento, no encontré propiedades frente al mar o cerca de la playa en el catálogo.',
          en: 'Sorry, I could not find any beachfront or beach properties in the catalog.',
        };
      }
      const count = beachProps.length;
      return {
        es: `He encontrado ${count} propiedad${count > 1 ? 'es' : ''} frente al mar en el catálogo. Te llevo a los resultados.`,
        en: `I found ${count} beachfront property/properties in the catalog. Taking you to the results.`,
        route: '/explore?search=playa'
      };
    },
  },
  {
    patterns: [
      /\b(recomienda|recomiéndame|sugiere|sugerencias|alternativas|similar|similares)\b.*\b(mazatlan|mazatlán)\b/i,
      /\b(similar a mazatlan|similar a mazatlán)\b/i,
    ],
    action: 'local_response',
    getResponse: (ctx) => {
      const recommendations = ctx.properties.filter((p: any) =>
        (p.type === 'Beach House' || p.location.toLowerCase().includes('mazatlán')) &&
        p.hostId !== ctx.currentUser?.id
      );
      const finalRecs = recommendations.length > 0 ? recommendations : ctx.properties.filter((p: any) => p.type === 'Beach House');
      const esList = finalRecs.map((p: any, idx: number) => `${idx + 1}. ${p.title} en ${p.location}`).join('\n');
      const enList = finalRecs.map((p: any, idx: number) => `${idx + 1}. ${p.title} in ${p.location}`).join('\n');
      return {
        es: `Opciones costeras recomendadas similares a Mazatlán:\n${esList}`,
        en: `Recommended coastal options similar to Mazatlán:\n${enList}`,
      };
    },
  },
  {
    patterns: [
      /\b(gracias|graciass|muchas gracias|agradecido|thanks|thank you|ty)\b/i,
      /\b(de nada|con gusto|un placer|you are welcome|welcome)\b/i
    ],
    action: 'local_response',
    getResponse: () => ({
      es: '¡Es un placer ayudarte! ¿Hay alguna otra propiedad, ubicación o detalle de tu cuenta que quieras consultar?',
      en: 'It is my pleasure to help! Is there any other destination or account detail you would like to check?'
    })
  },
  {
    patterns: [
      /\b(casas en|casa en|propiedades en|propiedad en|buscar en|alojamiento en|alojamientos en|hospedaje en|viajar a|viaje a|houses in|house in|properties in|property in|search in|stay in|travel to|casas de|casa de|propiedades de|propiedad de)\b\s+([a-zA-ZáéíóúüñÁÉÍÓÚÜÑ0-9\s,-]+)/i,
      /\b(propiedades de|propiedad de|casas de|casa de|alojamientos de|alojamiento de)\s+([a-zA-ZáéíóúüñÁÉÍÓÚÜÑ0-9\s,-]+)/i
    ],
    action: 'local_response',
    getResponse: (ctx, cleanPrompt) => {
      const prompt = cleanPrompt || '';
      
      // 1. Parse dates and guests
      let start = '';
      let end = '';
      let guestsCount = 0;
      
      const dateRegex = /\b(\d{4}-\d{2}-\d{2})\b/g;
      const dateMatches = [...prompt.matchAll(dateRegex)];
      if (dateMatches.length >= 2) {
        start = dateMatches[0][1];
        end = dateMatches[1][1];
      } else if (dateMatches.length === 1) {
        start = dateMatches[0][1];
      }
      
      const guestRegex = /\b(\d+)\s*(huéspedes|personas|huespedes|person|guest|guests)\b/i;
      const guestMatch = prompt.match(guestRegex);
      if (guestMatch) {
        guestsCount = parseInt(guestMatch[1], 10);
      }
      
      // 2. Extract destination by removing date/guests and noise prefixes
      const cleanedPrompt = prompt.replace(dateRegex, '').replace(guestRegex, '');
      
      const prefixes = [
        'casas en', 'casa en', 'propiedades en', 'propiedad en', 
        'buscar en', 'alojamiento en', 'alojamientos en', 'hospedaje en', 
        'viajar a', 'viaje a', 'en', 'houses in', 'house in', 
        'properties in', 'property in', 'search in', 'stay in', 
        'travel to', 'in', 'casas de', 'casa de', 'propiedades de', 'propiedad de'
      ];
      
      let destination = '';
      for (const prefix of prefixes) {
        const regex = new RegExp(`\\b${prefix}\\b\\s+(.+)`, 'i');
        const match = cleanedPrompt.match(regex);
        if (match && match[1]) {
          destination = match[1].trim();
          break;
        }
      }
      
      if (!destination) {
        destination = cleanedPrompt.trim();
      }
      
      destination = destination
        .replace(/\b(por favor|favor|gracias|please|thanks|del|al|para)\b/gi, '')
        .replace(/\s+/g, ' ')
        .trim();
        
      if (!destination) {
        return {
          es: '¿Qué propiedad o ubicación te gustaría buscar en el catálogo?',
          en: 'Which destination would you like to search for in the catalog?'
        };
      }
      
      const normDest = destination.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
      const excludedWords = ['si', 'no', 'yes', 'ok', 'okay', 'bien', 'bueno', 'hello', 'hola', 'hi', 'eterna'];
      if (excludedWords.includes(normDest)) {
        return {
          es: '¿En qué puedo ayudarte hoy? Dime qué propiedad o ubicación deseas buscar o qué consulta tienes sobre tu cuenta.',
          en: 'How can I help you today? Tell me which destination you want to search for or what query you have about your account.'
        };
      }
      
      // 3. Filter properties diacritic-insensitive
      const matches = ctx.properties.filter((p: any) => {
        const normLoc = (p.location || '').normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
        const normCountry = (p.country || '').normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
        const normTitle = (p.title || '').normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
        
        const matchesDest = normLoc.includes(normDest) || normCountry.includes(normDest) || normTitle.includes(normDest);
        if (!matchesDest) return false;
        
        // Filter by capacity (maxGuests)
        if (guestsCount > 0 && p.maxGuests < guestsCount) return false;
        
        // Filter by availability overlap
        if (start && end) {
          const userStart = new Date(start);
          const userEnd = new Date(end);
          const hasConflict = ctx.swaps.some((s: any) => {
            const isActiveSwap = ['APPROVED', 'CONFIRMED', 'ACTIVE', 'completed', 'completed_confirmed'].includes(s.status?.toUpperCase());
            if (!isActiveSwap) return false;
            const isThisProperty = s.senderPropertyId === p.id || s.receiverPropertyId === p.id;
            if (!isThisProperty) return false;
            if (s.startDate && s.endDate) {
              const swapStart = new Date(s.startDate);
              const swapEnd = new Date(s.endDate);
              return userStart <= swapEnd && userEnd >= swapStart;
            }
            return false;
          });
          if (hasConflict) return false;
        }
        return true;
      });
      
      if (matches.length === 0) {
        const displayDest = destination.charAt(0).toUpperCase() + destination.slice(1);
        let esExplanation = `No encontré propiedades registradas en ${displayDest}`;
        let enExplanation = `I could not find properties registered in ${displayDest}`;
        
        if (guestsCount > 0) {
          esExplanation += ` para ${guestsCount} huéspedes`;
          enExplanation += ` for ${guestsCount} guests`;
        }
        if (start && end) {
          esExplanation += ` del ${formatHumanDate(start, 'es')} al ${formatHumanDate(end, 'es')}`;
          enExplanation += ` from ${formatHumanDate(start, 'en')} to ${formatHumanDate(end, 'en')}`;
        }
        esExplanation += '.';
        enExplanation += '.';
        
        return {
          es: esExplanation,
          en: enExplanation
        };
      }
      
      const displayDest = matches[0].location.split(',')[0].trim();
      const count = matches.length;
      
      let esMsg = '';
      let enMsg = '';
      if (count === 1) {
        esMsg = `He encontrado una propiedad disponible en ${displayDest}`;
        enMsg = `I found one available property in ${displayDest}`;
      } else {
        esMsg = `He encontrado ${count} propiedades disponibles en ${displayDest}`;
        enMsg = `I found ${count} available properties in ${displayDest}`;
      }
      
      if (guestsCount > 0) {
        const guestsStrES = guestsCount === 1 ? 'un huésped' : `${guestsCount} huéspedes`;
        const guestsStrEN = guestsCount === 1 ? 'one guest' : `${guestsCount} guests`;
        esMsg += ` para ${guestsStrES}`;
        enMsg += ` for ${guestsStrEN}`;
      }
      if (start && end) {
        esMsg += ` del ${formatHumanDate(start, 'es')} al ${formatHumanDate(end, 'es')}`;
        enMsg += ` from ${formatHumanDate(start, 'en')} to ${formatHumanDate(end, 'en')}`;
      }
      esMsg += '. Te llevo a los resultados.';
      enMsg += '. Taking you to the results.';
      
      const searchParams = new URLSearchParams();
      searchParams.set('search', displayDest);
      if (start && end) {
        searchParams.set('start', start);
        searchParams.set('end', end);
      }
      if (guestsCount > 0) {
        searchParams.set('guests', String(guestsCount));
      }

      return {
        es: esMsg,
        en: enMsg,
        route: `/explore?${searchParams.toString()}`
      };
    }
  },
];

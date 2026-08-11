import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CheckCircle2 } from "lucide-react";

type InfoPage = {
  eyebrow: string;
  title: string;
  introduction: string;
  sections: Array<{ title: string; paragraphs: string[] }>;
};

const LEGAL_EMAIL = process.env.NEXT_PUBLIC_LEGAL_CONTACT_EMAIL?.trim();

const pages: Record<string, InfoPage> = {
  seguridad: {
    eyebrow: "Confianza operativa",
    title: "Seguridad antes, durante y después de cada operación",
    introduction:
      "Towers México combina controles de identidad, revisión de anuncios y trazabilidad. Una insignia sólo aparece después de una decisión administrativa; nunca se asigna automáticamente.",
    sections: [
      {
        title: "Identidad y documentos",
        paragraphs: [
          "Los documentos KYC se guardan en un espacio privado. Sólo la persona titular y el equipo administrativo autorizado pueden consultarlos mediante enlaces temporales.",
          "La revisión puede aprobarse o rechazarse con motivo registrado. Los datos de contacto no forman parte del perfil público.",
        ],
      },
      {
        title: "Propiedades publicables",
        paragraphs: [
          "Antes de publicar se comprueban ubicación, galería, información legal, modalidades y datos de contacto privados. Un anuncio incompleto permanece como borrador o en revisión.",
          "Las alertas o documentos no verificados se muestran como pendientes; Towers México no los convierte en afirmaciones positivas por defecto.",
        ],
      },
      {
        title: "Decisiones seguras",
        paragraphs: [
          "No envíes anticipos fuera del flujo acordado ni compartas códigos de acceso en áreas públicas. Verifica contratos, identidad y situación jurídica con profesionales independientes antes de firmar.",
        ],
      },
    ],
  },
  "como-funciona": {
    eyebrow: "Guía del producto",
    title: "De la búsqueda a una operación documentada",
    introduction:
      "Explora propiedades publicadas, compara modalidades y contacta al responsable sólo cuando el anuncio dispone de un canal real.",
    sections: [
      {
        title: "1. Explora",
        paragraphs: [
          "El catálogo público excluye propiedades de demostración, borradores y registros que no superan los requisitos mínimos de publicación.",
        ],
      },
      {
        title: "2. Evalúa",
        paragraphs: [
          "Cada ficha distingue información confirmada, pendiente y no proporcionada. La ubicación exacta puede mantenerse privada por decisión del propietario.",
        ],
      },
      {
        title: "3. Propón y documenta",
        paragraphs: [
          "Selecciona una modalidad disponible, acuerda términos y conserva la conversación y documentos relevantes. La disponibilidad o una estimación no constituyen una garantía contractual.",
        ],
      },
    ],
  },
  estandares: {
    eyebrow: "Calidad del catálogo",
    title: "Estándares de publicación",
    introduction:
      "Una ficha real debe ser identificable, comprobable y suficientemente completa para que otra persona pueda evaluarla sin inferencias engañosas.",
    sections: [
      {
        title: "Contenido mínimo",
        paragraphs: [
          "Título y descripción específicos, ciudad y país coherentes, coordenadas válidas, características principales, al menos cinco fotografías propias de calidad suficiente y una modalidad activa.",
        ],
      },
      {
        title: "Información jurídica",
        paragraphs: [
          "Los campos legales usan estados explícitos: sí, no o pendiente. Los valores pendientes bloquean la publicación cuando son indispensables y nunca se presentan como verificados.",
        ],
      },
      {
        title: "Moderación",
        paragraphs: [
          "El equipo puede solicitar correcciones, rechazar material duplicado o engañoso, retirar un anuncio o pedir evidencia adicional antes de publicarlo.",
        ],
      },
    ],
  },
  tarifas: {
    eyebrow: "Transparencia comercial",
    title: "Tarifas visibles antes de confirmar",
    introduction:
      "Towers México no publica porcentajes promocionales ni ahorros estimados sin una fuente y una configuración vigentes.",
    sections: [
      {
        title: "Qué verás",
        paragraphs: [
          "Cualquier tarifa aplicable se presenta en el flujo correspondiente antes de confirmar. Si una modalidad no tiene una tarifa configurada, la interfaz no inventa una.",
        ],
      },
      {
        title: "Costos externos",
        paragraphs: [
          "Impuestos, notaría, avalúos, seguros, mantenimiento, servicios y honorarios de terceros pueden ser independientes de Towers México y deben presupuestarse por separado.",
        ],
      },
    ],
  },
  privacidad: {
    eyebrow: "Aviso de privacidad",
    title: "Tus datos no forman parte del escaparate",
    introduction:
      "Towers México trata datos de cuenta, contacto, propiedades, actividad y verificación para operar la plataforma, prevenir fraude y atender obligaciones aplicables.",
    sections: [
      {
        title: "Datos públicos y privados",
        paragraphs: [
          "El perfil público excluye correo y contacto directo. Los teléfonos, correos del propietario, documentos internos y evidencia KYC permanecen bajo políticas de acceso restringido.",
          "Las fichas pueden mostrar una ubicación aproximada cuando el propietario decide ocultar la dirección exacta.",
        ],
      },
      {
        title: "Uso, conservación y proveedores",
        paragraphs: [
          "Los datos se usan para autenticar, moderar, comunicar, proteger operaciones y mejorar el servicio. Se conservan sólo durante el periodo operativo o legal necesario y pueden procesarse mediante proveedores de infraestructura sujetos a controles de acceso.",
        ],
      },
      {
        title: "Tus derechos",
        paragraphs: [
          LEGAL_EMAIL
            ? `Puedes solicitar acceso, rectificación, cancelación u oposición, así como información sobre el tratamiento, escribiendo a ${LEGAL_EMAIL}.`
            : "El canal formal de privacidad debe configurarse antes del lanzamiento mediante NEXT_PUBLIC_LEGAL_CONTACT_EMAIL.",
        ],
      },
    ],
  },
  terminos: {
    eyebrow: "Condiciones de uso",
    title: "Reglas claras para participar",
    introduction:
      "Towers México facilita publicación, descubrimiento y comunicación. No sustituye la revisión jurídica, fiscal, técnica o financiera necesaria para una operación inmobiliaria.",
    sections: [
      {
        title: "Responsabilidad de cada miembro",
        paragraphs: [
          "Debes proporcionar información verdadera, mantener tus datos actualizados, usar fotografías autorizadas y contar con facultades para ofrecer la propiedad.",
          "No se permite suplantación, discriminación ilícita, fraude, contenido engañoso ni intentos de evadir controles de seguridad.",
        ],
      },
      {
        title: "Disponibilidad y moderación",
        paragraphs: [
          "Towers México puede corregir, limitar, suspender o retirar contenido y cuentas para proteger a la comunidad o cumplir obligaciones. La publicación no equivale a una certificación jurídica de la propiedad.",
        ],
      },
      {
        title: "Antes de obligarte",
        paragraphs: [
          "Comprueba identidad, titularidad, gravámenes, permisos, contrato, pagos e impuestos con asesores independientes. Los términos definitivos son los documentos aceptados por las partes.",
        ],
      },
    ],
  },
  "eliminar-cuenta": {
    eyebrow: "Control de tus datos",
    title: "Eliminar una cuenta de Towers México",
    introduction:
      "Gardens and Towers México permite solicitar la eliminación permanente de una cuenta y de los datos asociados desde la aplicación o mediante nuestro canal de privacidad.",
    sections: [
      {
        title: "Desde la app o el sitio",
        paragraphs: [
          "Inicia sesión, abre Mi perfil, desplázate hasta Control de cuenta y selecciona Eliminar cuenta. Escribe ELIMINAR y confirma. La sesión se cerrará cuando el proceso termine.",
          "Este método elimina la cuenta de autenticación, el perfil, los anuncios y archivos propios, conversaciones, favoritos, solicitudes, citas y demás registros directamente vinculados.",
        ],
      },
      {
        title: "Solicitud sin iniciar sesión",
        paragraphs: [
          LEGAL_EMAIL
            ? `Si ya no puedes acceder, escribe desde el correo de la cuenta a ${LEGAL_EMAIL} con el asunto “Eliminar mi cuenta de Towers México”. Te pediremos comprobar que eres la persona titular antes de procesarla.`
            : "Si ya no puedes acceder, utiliza el canal de privacidad publicado por Gardens and Towers México y solicita la eliminación de tu cuenta. Será necesario comprobar la titularidad.",
        ],
      },
      {
        title: "Datos eliminados y conservación",
        paragraphs: [
          "Se eliminan los datos activos vinculados a la cuenta. Los registros que debamos conservar para prevenir fraude, resolver disputas o cumplir una obligación legal se mantienen únicamente por el periodo exigido y con acceso restringido.",
          "Las copias de seguridad rotativas pueden tardar hasta 30 días en sobrescribirse. Durante ese periodo no se restauran para uso ordinario ni se utilizan para publicidad.",
        ],
      },
    ],
  },
  cookies: {
    eyebrow: "Preferencias y sesión",
    title: "Uso de cookies y almacenamiento local",
    introduction:
      "Towers México utiliza almacenamiento necesario para mantener la sesión, recordar preferencias y proteger el funcionamiento básico del producto.",
    sections: [
      {
        title: "Esenciales",
        paragraphs: [
          "La autenticación, seguridad, idioma y continuidad del flujo pueden requerir cookies o almacenamiento local. Deshabilitarlos puede impedir el acceso o borrar preferencias.",
        ],
      },
      {
        title: "Medición",
        paragraphs: [
          "Cualquier medición no esencial debe documentarse y habilitarse conforme a la configuración de consentimiento aplicable. Esta página no afirma el uso de rastreadores que no estén instalados.",
        ],
      },
    ],
  },
};

export function generateStaticParams() {
  return Object.keys(pages).map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const page = pages[slug];
  if (!page) return {};
  return {
    title: page.title,
    description: page.introduction,
    alternates: { canonical: `/info/${slug}` },
  };
}

export default async function InfoPageRoute({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const page = pages[slug];
  if (!page) notFound();

  return (
    <main className="min-h-screen bg-[#f5f2ed] px-5 py-12 text-brand-black sm:px-10 sm:py-20">
      <article className="mx-auto max-w-4xl overflow-hidden rounded-[2rem] border border-black/10 bg-white shadow-premium">
        <header className="border-b border-black/10 px-6 py-8 sm:px-12 sm:py-12">
          <Link
            href="/"
            className="mb-8 inline-flex items-center gap-2 text-xs font-black uppercase tracking-[0.18em] text-brand-gray-500 transition hover:text-brand-accent"
          >
            <ArrowLeft className="h-4 w-4" />
            Volver a Towers México
          </Link>
          <p className="text-xs font-black uppercase tracking-[0.24em] text-brand-accent">{page.eyebrow}</p>
          <h1 className="mt-4 max-w-3xl text-3xl font-black leading-tight tracking-[-0.04em] sm:text-5xl">{page.title}</h1>
          <p className="mt-5 max-w-2xl text-sm font-medium leading-7 text-brand-gray-600 sm:text-base">{page.introduction}</p>
        </header>
        <div className="grid gap-10 px-6 py-9 sm:px-12 sm:py-12">
          {page.sections.map((section) => (
            <section key={section.title} className="grid gap-3 sm:grid-cols-[180px_1fr] sm:gap-8">
              <h2 className="flex items-start gap-2 text-sm font-black tracking-tight">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-brand-accent" />
                {section.title}
              </h2>
              <div className="space-y-3 text-sm font-medium leading-7 text-brand-gray-600">
                {section.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
              </div>
            </section>
          ))}
        </div>
      </article>
    </main>
  );
}

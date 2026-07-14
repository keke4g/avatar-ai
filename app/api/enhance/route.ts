import { NextResponse } from 'next/server';
import { GeminiService } from '../../../lib/services/GeminiService';

export async function POST(request: Request) {
  try {
    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Cuerpo de petición inválido.' }, { status: 400 });
    }

    const { text, type } = body as Record<string, unknown>;

    if (typeof text !== 'string' || text.trim() === '') {
      return NextResponse.json({ error: 'El campo "text" es requerido y no debe estar vacío.' }, { status: 400 });
    }

    if (type !== 'title' && type !== 'description') {
      return NextResponse.json({ error: 'El campo "type" debe ser "title" o "description".' }, { status: 400 });
    }

    const maxLength = type === 'title' ? 200 : 6_000;
    if (text.length > maxLength) {
      return NextResponse.json(
        { error: `El texto supera el máximo de ${maxLength.toLocaleString('en-US')} caracteres.` },
        { status: 400 },
      );
    }

    let prompt = '';
    let systemPrompt = '';

    if (type === 'title') {
      prompt = `Actúa como copywriter inmobiliario profesional.

Mejora el siguiente título.

Reglas:

* Mantener la intención original.
* No inventar características.
* No inventar amenidades.
* No inventar ubicación.
* Máximo 80 caracteres.
* Profesional.
* Natural.
* Sin emojis.
* Sin lenguaje exagerado.
* Genera 5 opciones distintas.

Texto original:

${text}
`;
      systemPrompt = `Actúa como un asistente de copia de listados de propiedades. Tu tarea es generar exactamente 5 opciones de títulos mejorados para el listado, basadas únicamente en el texto original proporcionado. Formatea tu respuesta estrictamente como un arreglo JSON de strings, sin bloques de código Markdown ni explicaciones adicionales, por ejemplo: ["Opción 1", "Opción 2", "Opción 3", "Opción 4", "Opción 5"].`;
    } else {
      prompt = `Actúa como redactor inmobiliario profesional.

Mejora la siguiente descripción.

Reglas:

* Mantener toda la información existente.
* No inventar características.
* No inventar amenidades.
* No inventar ubicación.
* No inventar precios.
* No inventar medidas.
* Máximo 120 palabras.
* Tono profesional.
* Fácil de leer.
* Sin emojis.
* Sin frases agresivas de venta.
* Genera 3 versiones diferentes.

Texto original:

${text}
`;
      systemPrompt = `Actúa como un asistente de redacción para listados inmobiliarios. Tu tarea es generar exactamente 3 versiones mejoradas de la descripción del listado, basadas en el texto original proporcionado. Formatea tu respuesta estrictamente como un arreglo JSON de strings, sin bloques de código Markdown ni explicaciones adicionales, por ejemplo: ["Versión 1", "Versión 2", "Versión 3"].`;
    }

    const { result: reply, model } = await GeminiService.generateAvatarResponse({
      message: prompt,
      systemPrompt
    });

    return NextResponse.json({ reply, provider: 'gemini', model });
  } catch (error: unknown) {
    console.error('[Enhance API] Error:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}

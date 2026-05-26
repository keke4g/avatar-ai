import similarity
from "cosine-similarity";

export type Chunk = {

  texto: string;

  embedding: number[];

};

// EMBEDDING SIMPLE

function crearEmbedding(
  texto: string
): number[] {

  const vector =
    new Array(26).fill(0);

  const limpio =
    texto.toLowerCase();

  for (const char of limpio) {

    const code =
      char.charCodeAt(0);

    if (
      code >= 97 &&
      code <= 122
    ) {

      vector[code - 97]++;

    }

  }

  return vector;

}

// DIVIDIR TEXTO

export function dividirTexto(

  texto: string,

  chunkSize = 1000

): Chunk[] {

  const chunks: Chunk[] = [];

  for (

    let i = 0;

    i < texto.length;

    i += chunkSize

  ) {

    const parte =
      texto.slice(
        i,
        i + chunkSize
      );

    chunks.push({

      texto: parte,

      embedding:
        crearEmbedding(
          parte
        ),

    });

  }

  return chunks;

}

// BUSCAR CHUNKS

export function buscarChunksRelevantes(

  pregunta: string,

  chunks: Chunk[],

  top = 3

): string {

  const preguntaEmbedding =
    crearEmbedding(
      pregunta
    );

  const scores =
    chunks.map((chunk) => ({

      texto: chunk.texto,

      score: similarity(
        preguntaEmbedding,
        chunk.embedding
      ),

    }));

  scores.sort(
    (a, b) =>
      b.score - a.score
  );

  return scores

    .slice(0, top)

    .map((s) => s.texto)

    .join("\n\n");

}
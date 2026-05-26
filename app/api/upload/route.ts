import { NextRequest }
from "next/server";

export const runtime =
  "nodejs";

import mammoth
from "mammoth";

import * as XLSX
from "xlsx";

import {
  dividirTexto,
} from "../../../lib/rag";

export async function POST(
  req: NextRequest
) {

  try {

    const formData =
      await req.formData();

    const file =
      formData.get("file");

    if (
      !(file instanceof File)
    ) {

      return Response.json({
        chunks: [],
      });

    }

    const bytes =
      await file.arrayBuffer();

    const buffer =
      Buffer.from(bytes);

    let texto = "";

    // WORD

    if (
      file.name.endsWith(
        ".docx"
      )
    ) {

      const result =
        await mammoth.extractRawText({
          buffer,
        });

      texto =
        result.value;

    }

    // EXCEL

    else if (

      file.name.endsWith(
        ".xlsx"
      ) ||

      file.name.endsWith(
        ".xls"
      )

    ) {

      const workbook =
        XLSX.read(buffer, {
          type: "buffer",
        });

      workbook.SheetNames.forEach(
        (sheet) => {

          const sheetData =
            XLSX.utils.sheet_to_csv(
              workbook.Sheets[
                sheet
              ]
            );

          texto +=
            sheetData + "\n";

        }
      );

    }

    // TXT

    else if (
      file.name.endsWith(
        ".txt"
      )
    ) {

      texto =
        buffer.toString(
          "utf-8"
        );

    }

    else {

      return Response.json({

        error:
          "Formato no soportado",

        chunks: [],

      });

    }

    const chunks =
      dividirTexto(texto);

    return Response.json({
      chunks,
    });

  } catch (error) {

    console.log(
      "ERROR UPLOAD:",
      error
    );

    return Response.json({

      error:
        "Error procesando archivo",

      chunks: [],

    });

  }

}
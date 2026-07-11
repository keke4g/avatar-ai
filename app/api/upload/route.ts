import { NextRequest } from "next/server";
import mammoth from "mammoth";
import * as XLSX from "xlsx";
import { dividirTexto } from "../../../lib/rag";

export const runtime = "nodejs";

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const SUPPORTED_EXTENSIONS = new Set(["docx", "xlsx", "xls", "txt"]);

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return Response.json(
        { error: "Debes adjuntar un archivo.", chunks: [] },
        { status: 400 },
      );
    }

    if (file.size === 0 || file.size > MAX_FILE_SIZE) {
      return Response.json(
        { error: "El archivo debe pesar entre 1 byte y 10 MB.", chunks: [] },
        { status: 413 },
      );
    }

    const extension = file.name.toLowerCase().split(".").pop();
    if (!extension || !SUPPORTED_EXTENSIONS.has(extension)) {
      return Response.json(
        { error: "Formato no soportado. Usa DOCX, XLSX, XLS o TXT.", chunks: [] },
        { status: 415 },
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    let text = "";

    if (extension === "docx") {
      const result = await mammoth.extractRawText({ buffer });
      text = result.value;
    } else if (extension === "xlsx" || extension === "xls") {
      const workbook = XLSX.read(buffer, { type: "buffer" });
      text = workbook.SheetNames.map((sheetName) =>
        XLSX.utils.sheet_to_csv(workbook.Sheets[sheetName]),
      ).join("\n");
    } else {
      text = buffer.toString("utf-8");
    }

    return Response.json({ chunks: dividirTexto(text) });
  } catch (error) {
    console.error("[Upload API] Error procesando archivo:", error);
    return Response.json(
      { error: "Error procesando archivo.", chunks: [] },
      { status: 500 },
    );
  }
}

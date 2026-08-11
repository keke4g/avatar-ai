"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, ExternalLink, FileCheck2, Loader2, RefreshCw, X } from "lucide-react";
import { supabase } from "../../lib/supabaseClient";

type KycRequest = {
  id: string;
  user_id: string;
  object_path: string;
  original_file_name: string;
  mime_type: string;
  size_bytes: number;
  status: "PENDING" | "VERIFIED" | "REJECTED";
  created_at: string;
};

type ProfileSummary = {
  id: string;
  name: string | null;
  email: string | null;
};

export default function KycReviewPanel() {
  const [requests, setRequests] = useState<KycRequest[]>([]);
  const [profiles, setProfiles] = useState<Record<string, ProfileSummary>>({});
  const [loading, setLoading] = useState(true);
  const [workingId, setWorkingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [rejectionNotes, setRejectionNotes] = useState<Record<string, string>>({});

  const loadRequests = useCallback(async () => {
    setLoading(true);
    setError("");

    const { data, error: requestError } = await supabase
      .from("kyc_requests")
      .select("id,user_id,object_path,original_file_name,mime_type,size_bytes,status,created_at")
      .eq("status", "PENDING")
      .order("created_at", { ascending: true });

    if (requestError) {
      setError("No se pudieron cargar las solicitudes. Confirma que la migración KYC esté aplicada.");
      setLoading(false);
      return;
    }

    const pending = (data ?? []) as KycRequest[];
    setRequests(pending);

    if (pending.length > 0) {
      const userIds = [...new Set(pending.map((request) => request.user_id))];
      const { data: profileData } = await supabase
        .from("profiles")
        .select("id,name,email")
        .in("id", userIds);

      setProfiles(
        Object.fromEntries(
          ((profileData ?? []) as ProfileSummary[]).map((profile) => [profile.id, profile]),
        ),
      );
    } else {
      setProfiles({});
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    queueMicrotask(() => void loadRequests());
  }, [loadRequests]);

  const openDocument = async (request: KycRequest) => {
    setError("");
    const { data, error: signedUrlError } = await supabase.storage
      .from("kyc-documents")
      .createSignedUrl(request.object_path, 60);

    if (signedUrlError || !data?.signedUrl) {
      setError("No se pudo abrir el documento privado.");
      return;
    }

    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  };

  const review = async (request: KycRequest, decision: "VERIFIED" | "REJECTED") => {
    const notes = rejectionNotes[request.id]?.trim() ?? "";
    if (decision === "REJECTED" && !notes) {
      setError("Escribe el motivo del rechazo antes de continuar.");
      return;
    }

    setWorkingId(request.id);
    setError("");
    const { error: reviewError } = await supabase.rpc("review_kyc_request", {
      target_request_id: request.id,
      target_decision: decision,
      target_review_notes: notes || null,
    });

    if (reviewError) {
      setError(reviewError.message || "No se pudo registrar la revisión.");
      setWorkingId(null);
      return;
    }

    setRequests((current) => current.filter((item) => item.id !== request.id));
    setWorkingId(null);
  };

  return (
    <section className="mb-8 overflow-hidden rounded-3xl border border-brand-gray-200 bg-brand-gray-50/60">
      <div className="flex flex-col gap-3 border-b border-brand-gray-200 bg-white px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <FileCheck2 className="h-4 w-4 text-brand-accent" />
            <h3 className="text-sm font-black tracking-tight text-brand-black">Revisión documental KYC</h3>
          </div>
          <p className="mt-1 text-[11px] text-brand-gray-500">
            Los documentos se abren con un enlace privado de 60 segundos.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void loadRequests()}
          disabled={loading}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-brand-gray-200 bg-white px-3 py-2 text-[10px] font-black uppercase tracking-wider text-brand-black transition hover:bg-brand-gray-50 disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          Actualizar
        </button>
      </div>

      {error && (
        <p role="alert" className="border-b border-rose-100 bg-rose-50 px-5 py-3 text-xs font-bold text-rose-700">
          {error}
        </p>
      )}

      {loading ? (
        <div className="flex items-center justify-center gap-2 px-5 py-10 text-xs font-bold text-brand-gray-500">
          <Loader2 className="h-4 w-4 animate-spin" />
          Cargando solicitudes…
        </div>
      ) : requests.length === 0 ? (
        <div className="px-5 py-10 text-center">
          <Check className="mx-auto mb-2 h-5 w-5 text-emerald-600" />
          <p className="text-xs font-black text-brand-black">No hay solicitudes pendientes</p>
          <p className="mt-1 text-[11px] text-brand-gray-500">Las nuevas verificaciones aparecerán aquí.</p>
        </div>
      ) : (
        <div className="divide-y divide-brand-gray-200">
          {requests.map((request) => {
            const profile = profiles[request.user_id];
            const isWorking = workingId === request.id;
            return (
              <article key={request.id} className="grid gap-4 bg-white/70 px-5 py-5 lg:grid-cols-[1fr_1.2fr_auto] lg:items-center">
                <div className="min-w-0">
                  <p className="truncate text-xs font-black text-brand-black">
                    {profile?.name || "Usuario sin nombre"}
                  </p>
                  <p className="truncate text-[10px] text-brand-gray-500">{profile?.email || request.user_id}</p>
                  <p className="mt-1 text-[9px] font-bold uppercase tracking-wider text-brand-gray-400">
                    {new Date(request.created_at).toLocaleString("es-MX")} · {(request.size_bytes / 1_048_576).toFixed(2)} MB
                  </p>
                </div>

                <div className="min-w-0">
                  <button
                    type="button"
                    onClick={() => void openDocument(request)}
                    className="inline-flex max-w-full items-center gap-1.5 text-left text-[11px] font-bold text-brand-accent hover:underline"
                  >
                    <span className="truncate">{request.original_file_name}</span>
                    <ExternalLink className="h-3 w-3 shrink-0" />
                  </button>
                  <input
                    value={rejectionNotes[request.id] ?? ""}
                    onChange={(event) =>
                      setRejectionNotes((current) => ({ ...current, [request.id]: event.target.value }))
                    }
                    placeholder="Motivo obligatorio si se rechaza"
                    maxLength={500}
                    className="mt-2 w-full rounded-xl border border-brand-gray-200 bg-white px-3 py-2 text-[11px] outline-none transition focus:border-brand-accent"
                  />
                </div>

                <div className="flex gap-2 lg:justify-end">
                  <button
                    type="button"
                    onClick={() => void review(request, "REJECTED")}
                    disabled={isWorking}
                    className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-rose-200 bg-white px-3 py-2 text-[10px] font-black uppercase tracking-wider text-rose-700 transition hover:bg-rose-50 disabled:opacity-50 lg:flex-none"
                  >
                    <X className="h-3.5 w-3.5" />
                    Rechazar
                  </button>
                  <button
                    type="button"
                    onClick={() => void review(request, "VERIFIED")}
                    disabled={isWorking}
                    className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-brand-black px-3 py-2 text-[10px] font-black uppercase tracking-wider text-white transition hover:bg-brand-black/90 disabled:opacity-50 lg:flex-none"
                  >
                    {isWorking ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                    Aprobar
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

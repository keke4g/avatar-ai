import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { JWT } from "npm:google-auth-library@9";

const FCM_TOPIC = "new-properties";
const PROPERTY_URL_BASE = "https://towersmexico.com/property";
const FCM_SCOPE = "https://www.googleapis.com/auth/firebase.messaging";

interface PropertyRecord {
  id: string;
  title?: string | null;
  location?: string | null;
  is_published?: boolean | null;
  folder_status?: string | null;
  is_demo?: boolean | null;
}

interface PropertyWebhookPayload {
  type: "INSERT" | "UPDATE" | "DELETE";
  table: string;
  schema: string;
  record: PropertyRecord | null;
  old_record: PropertyRecord | null;
}

interface FirebaseServiceAccount {
  project_id: string;
  client_email: string;
  private_key: string;
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

function cleanText(value: string | null | undefined, fallback: string): string {
  const compact = value?.replace(/\s+/g, " ").trim();
  return compact || fallback;
}

function shorten(value: string, maxLength: number): string {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
}

function parseServiceAccount(): FirebaseServiceAccount {
  const raw = Deno.env.get("FIREBASE_SERVICE_ACCOUNT_JSON");
  if (!raw) {
    throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON is not configured");
  }

  const parsed = JSON.parse(raw) as Partial<FirebaseServiceAccount>;
  if (!parsed.project_id || !parsed.client_email || !parsed.private_key) {
    throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON is incomplete");
  }

  return {
    project_id: parsed.project_id,
    client_email: parsed.client_email,
    private_key: parsed.private_key.replace(/\\n/g, "\n"),
  };
}

async function getFirebaseAccessToken(
  serviceAccount: FirebaseServiceAccount,
): Promise<string> {
  const jwtClient = new JWT({
    email: serviceAccount.client_email,
    key: serviceAccount.private_key,
    scopes: [FCM_SCOPE],
  });

  const tokens = await jwtClient.authorize();
  if (!tokens.access_token) {
    throw new Error("Firebase did not return an access token");
  }

  return tokens.access_token;
}

function isNewPublication(payload: PropertyWebhookPayload): boolean {
  if (payload.schema !== "public" || payload.table !== "properties") {
    return false;
  }

  if (payload.type !== "INSERT" && payload.type !== "UPDATE") {
    return false;
  }

  const property = payload.record;
  if (!property || property.is_demo === true) return false;

  const isPublished =
    property.is_published === true && property.folder_status === "PUBLISHED";
  const wasPublished = payload.old_record?.is_published === true;

  return isPublished && !wasPublished;
}

Deno.serve(async (request: Request) => {
  if (request.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  let payload: PropertyWebhookPayload;
  try {
    payload = (await request.json()) as PropertyWebhookPayload;
  } catch {
    return jsonResponse({ error: "Invalid JSON payload" }, 400);
  }

  if (!isNewPublication(payload)) {
    return jsonResponse({ ok: true, ignored: true });
  }

  const property = payload.record!;
  const location = shorten(
    cleanText(property.location, "Towers México"),
    62,
  );
  const propertyTitle = shorten(
    cleanText(property.title, "Conoce todos los detalles"),
    110,
  );
  const propertyUrl = `${PROPERTY_URL_BASE}/${encodeURIComponent(property.id)}`;

  try {
    const serviceAccount = parseServiceAccount();
    const accessToken = await getFirebaseAccessToken(serviceAccount);
    const fcmResponse = await fetch(
      `https://fcm.googleapis.com/v1/projects/${serviceAccount.project_id}/messages:send`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json; charset=utf-8",
        },
        body: JSON.stringify({
          message: {
            topic: FCM_TOPIC,
            notification: {
              title: `Nueva propiedad en ${location}`,
              body: propertyTitle,
            },
            data: {
              property_id: property.id,
              url: propertyUrl,
            },
            android: {
              priority: "high",
              ttl: "604800s",
              notification: {
                channel_id: "new_properties",
                color: "#2F7BFF",
                sound: "default",
              },
            },
          },
        }),
      },
    );

    const fcmBody = await fcmResponse.json();
    if (!fcmResponse.ok) {
      console.error("FCM rejected the new-property notification", {
        status: fcmResponse.status,
        response: fcmBody,
        propertyId: property.id,
      });
      return jsonResponse(
        { error: "FCM rejected the notification", status: fcmResponse.status },
        502,
      );
    }

    return jsonResponse({
      ok: true,
      property_id: property.id,
      message_name: (fcmBody as { name?: string }).name ?? null,
    });
  } catch (error) {
    console.error("Unable to send new-property notification", {
      propertyId: property.id,
      message: error instanceof Error ? error.message : String(error),
    });
    return jsonResponse({ error: "Unable to send notification" }, 500);
  }
});

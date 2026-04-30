import { prisma } from "./prisma.js";
import { env } from "./env.js";

interface RemotePrestation {
  external_id: string;
  title: string;
  start_time: string;
  end_time: string;
  location?: string;
  notes?: string;
  activity_type?: string;
}

async function fetchRemotePrestations(
  since: string | null
): Promise<RemotePrestation[]> {
  if (!env.BOKU_KUMASALA_API_KEY || !env.BOKU_KUMASALA_API_URL) return [];

  const url = new URL("/v1/prestations", env.BOKU_KUMASALA_API_URL);
  if (since) url.searchParams.set("since", since);

  const response = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${env.BOKU_KUMASALA_API_KEY}`,
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`Boku API error ${response.status}`);
  }

  const payload = (await response.json()) as {
    prestations?: RemotePrestation[];
  };

  return payload.prestations ?? [];
}

export async function importBokuKumasala(userId: string, since: string | null) {
  const remote = await fetchRemotePrestations(since);

  let imported = 0;
  let skipped = 0;

  for (const item of remote) {
    const existing = await prisma.activity.findFirst({
      where: {
        userId,
        source: "boku_kumasala",
        externalId: item.external_id,
      },
      select: { id: true },
    });

    if (existing) {
      skipped += 1;
      continue;
    }

    await prisma.activity.create({
      data: {
        userId,
        title: item.title,
        activityType: item.activity_type ?? "prestation",
        startTime: new Date(item.start_time),
        endTime: new Date(item.end_time),
        location: item.location ?? "",
        notes: item.notes ?? "",
        source: "boku_kumasala",
        externalId: item.external_id,
      },
    });

    imported += 1;
  }

  return {
    imported,
    skipped,
    total: remote.length,
  };
}
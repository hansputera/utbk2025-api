import { redis } from "bun";
import db from "../database/database";
import type { University } from "../types";
import { safeJsonParse, mapWithConcurrency } from "../utils";
import { fetchWikidataInfo } from "./wiki";
import { fetchHipolabsInfo } from "./hipolabs";

type Enrichment = {
  country?: string;
  logo?: string;
  location?: string;
  latitude?: number;
  longitude?: number;
};

// Helper to fetch the global top 5 university codes
async function getGlobalTopFiveCodes(): Promise<Set<string>> {
  const rows = db.prepare(`
    WITH top5 AS (
      SELECT ptn_code
      FROM snbt_dump
      WHERE ptn IS NOT NULL
      GROUP BY ptn_code
      ORDER BY COUNT(*) DESC
      LIMIT 5
    )
    SELECT ptn_code FROM top5;
  `).all() as { ptn_code: string }[];

  return new Set(rows.map(r => r.ptn_code));
}

export const getUniversities = async (
  page = 1,
  pageSize = 100,
  name?: string
): Promise<{ data: University[]; total: number }> => {
  const cacheKey = `universities:all`;

  // If no name filter and first page, try cache
  if (!name) {
    const cached = safeJsonParse<University[]>(await redis.get(cacheKey));
    if (cached) {
      const total = cached.length;
      const data = cached.slice((page - 1) * pageSize, page * pageSize);
      return { data, total };
    }
  }

  // Compute top 5 codes across all data
  const topFiveSet = await getGlobalTopFiveCodes();

  // Main aggregation query (without RANK)
  const universities = db.prepare(`
    SELECT
      ptn_code as code,
      ptn as name,
      COUNT(*) as passers,
      SUM(CASE WHEN bidik_misi = 1 THEN 1 ELSE 0 END) as kip
    FROM snbt_dump
    WHERE ptn IS NOT NULL
      AND ptn LIKE $ptn
    GROUP BY ptn_code, ptn
    ORDER BY passers DESC
  `).all({
    $ptn: name ? `%${encodeURIComponent(name)}%` : '%',
  }) as University[];

  // Total count of distinct universities matching filter
  const { total } = db.prepare(`
    SELECT COUNT(DISTINCT ptn) as total
    FROM snbt_dump
    WHERE ptn LIKE $ptn
  `).get({
    $ptn: name ? `%${encodeURIComponent(name)}%` : '%',
  }) as { total: number };

  // Add isTopFive flag
  const flagged = universities.map(u => ({
    ...u,
    isTopFive: topFiveSet.has(u.code) ? 1 : 0,
  }));

  // Pagination slice
  const paged = flagged.slice((page - 1) * pageSize, page * pageSize);

  // Enrichment: only for current page slice
  const uniqueNames = Array.from(new Set(paged.map(u => u.name)));
  const enrichmentMap: Record<string, Enrichment> = {};
  const enrichments = await mapWithConcurrency(uniqueNames, 20, async uniName => {
    const [wikidata, hipolabs] = await Promise.all([
      fetchWikidataInfo(uniName),
      fetchHipolabsInfo(uniName),
    ]);
    return {
      name: uniName,
      country: hipolabs.country,
      logo: wikidata.logo ?? hipolabs.logo,
      location: wikidata.location ?? hipolabs.location,
      latitude: wikidata.latitude,
      longitude: wikidata.longitude,
    };
  });
  for (const e of enrichments) {
    enrichmentMap[e.name] = e;
  }

  const enriched = paged.map(u => {
    const e = enrichmentMap[u.name] || {};
    return {
      ...u,
      country: e.country,
      logo: e.logo,
      location: e.location,
      latitude: e.latitude,
      longitude: e.longitude,
    };
  });

  // Cache full list on first page when no filter
  if (page === 1 && !name) {
    await redis.set(cacheKey, JSON.stringify(enriched), "EX", 60 * 60);
  }

  return { data: enriched, total };
};

export const getUniversity = async (ptnCode: string): Promise<University> => {
  // Compute global top five set
  const topFiveSet = await getGlobalTopFiveCodes();

  // Fetch single university stats
  const uni = db.prepare(`
    SELECT
      ptn_code as code,
      ptn as name,
      COUNT(*) as passers,
      SUM(CASE WHEN bidik_misi = 1 THEN 1 ELSE 0 END) as kip
    FROM snbt_dump
    WHERE ptn_code = ?
    GROUP BY ptn_code, ptn
  `).get(ptnCode) as University;

  // Assign isTopFive
  uni.isTopFive = topFiveSet.has(uni.code) ? 1 : 0;

  // Enrich
  const [wikidata, hipolabs] = await Promise.all([
    fetchWikidataInfo(uni.name),
    fetchHipolabsInfo(uni.name),
  ]);
  uni.country = hipolabs.country;
  uni.logo = wikidata.logo ?? hipolabs.logo;
  uni.location = wikidata.location ?? hipolabs.location;
  uni.latitude = wikidata.latitude;
  uni.longitude = wikidata.longitude;

  return uni;
};

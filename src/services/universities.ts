import { redis } from "bun";
import db from "../database/database";
import type { University } from "../types";
import { safeJsonParse, mapWithConcurrency } from "../utils";
import { fetchWikidataInfo } from "./wiki";
import { fetchHipolabsInfo } from "./hipolabs";

type Enrichment = { country?: string; logo?: string; location?: string; latitude?: number; longitude?: number };

export const getUniversities = async (page = 1, pageSize = 100): Promise<{
    data: University[];
    total: number;
}> => {
    const cacheKey = `universities:all`;
    const cached = safeJsonParse<University[]>(await redis.get(cacheKey));
    if (cached) {
        // Return paginated slice from cache
        return {
            data: cached.slice((page - 1) * pageSize, page * pageSize),
            total: cached.length,
        }
    }

    const universities = db.prepare(`
        SELECT ptn_code as code, ptn as name, COUNT(*) as passers,
            SUM(CASE WHEN bidik_misi = 1 THEN 1 ELSE 0 END) as kip,
            CASE WHEN RANK() OVER (ORDER BY COUNT(*) DESC) <= 5 THEN 1 ELSE 0 END as isTopFive
        FROM snbt_dump
        WHERE ptn IS NOT NULL
        GROUP BY ptn_code, ptn
    `).all() as University[];

    const universityCount = db.prepare(`
        SELECT COUNT(*) as total FROM snbt_dump 
    `).get() as { total: number };

    // Pagination: only enrich the requested slice
    const pagedUniversities = universities.slice((page - 1) * pageSize, page * pageSize);
    const uniqueNames = Array.from(new Set(pagedUniversities.map(u => u.name)));

    const enrichmentMap: Record<string, Enrichment> = {};
    const enrichments = await mapWithConcurrency(uniqueNames, 20, async (name) => {
        const [wikidata, hipolabs] = await Promise.all([
            fetchWikidataInfo(name),
            fetchHipolabsInfo(name)
        ]);
        return {
            name,
            country: hipolabs.country ?? undefined,
            logo: (wikidata.logo ?? hipolabs.logo) ?? undefined,
            location: (wikidata.location ?? hipolabs.location) ?? undefined,
            latitude: wikidata.latitude ?? undefined,
            longitude: wikidata.longitude ?? undefined
        };
    });
    for (const e of enrichments) {
        enrichmentMap[e.name] = e;
    }

    const enriched = pagedUniversities.map((uni) => {
        const enrich = (enrichmentMap[uni.name] as Enrichment) || {
            country: undefined,
            logo: undefined,
            location: undefined,
            latitude: undefined,
            longitude: undefined
        };
        return {
            ...uni,
            country: enrich.country,
            logo: enrich.logo,
            location: enrich.location,
            latitude: enrich.latitude,
            longitude: enrich.longitude
        };
    });

    // Optionally cache the full result for future requests
    if (page === 1) {
        // Only cache on first page to avoid overwriting with partial data
        await redis.set(cacheKey, JSON.stringify(universities), "EX", 60 * 60); // 1 hour
    }
    return {
        data: enriched,
        total: universityCount.total,
    };
};

export const getUniversity = async (ptnCode: string): Promise<University> => {
    const university = db.prepare(`
        SELECT ptn_code as code, ptn as name, COUNT(*) as passers,
            SUM(CASE WHEN bidik_misi = 1 THEN 1 ELSE 0 END) as kip,
            CASE WHEN RANK() OVER (ORDER BY COUNT(*) DESC) <= 5 THEN 1 ELSE 0 END as isTopFive
        FROM snbt_dump
        WHERE ptn_code = ?
    `).get(ptnCode) as University;

    const [wikidata, hipolabs] = await Promise.all([
        fetchWikidataInfo(university.name),
        fetchHipolabsInfo(university.name)
    ]);
    university.country = hipolabs.country ?? undefined;
    university.logo = (wikidata.logo ?? hipolabs.logo) ?? undefined;
    university.location = (wikidata.location ?? hipolabs.location) ?? undefined;
    university.latitude = wikidata.latitude ?? undefined;
    university.longitude = wikidata.longitude ?? undefined;

    return university;
};

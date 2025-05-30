import { redis } from "bun";
import { safeJsonParse, normalizeKey } from "../utils";

export async function fetchWikidataInfo(universityName: string): Promise<{ logo?: string; location?: string; latitude?: number; longitude?: number }> {
    const cacheKey = `wikidata:${normalizeKey(universityName)}`;
    const cached = safeJsonParse<{ logo?: string; location?: string; latitude?: number; longitude?: number }>(await redis.get(cacheKey));
    if (cached) return cached;

    try {
        const searchRes = await fetch(`https://www.wikidata.org/w/api.php?action=wbsearchentities&search=${encodeURIComponent(universityName)}&language=en&format=json&type=item`);
        const searchData = await searchRes.json() as any;
        if (!searchData.search || searchData.search.length === 0) return {};
        const entityId = searchData.search[0].id;

        const entityRes = await fetch(`https://www.wikidata.org/wiki/Special:EntityData/${entityId}.json`);
        const entityData = await entityRes.json() as any;
        const entity = entityData.entities[entityId];
        let logo: string | undefined;
        let location: string | undefined;
        let latitude: number | undefined;
        let longitude: number | undefined;

        if (entity.claims?.P154?.[0]?.mainsnak?.datavalue) {
            const logoFile = entity.claims.P154[0].mainsnak.datavalue.value;
            logo = `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(logoFile)}`;
        }
        if (entity.claims?.P131?.[0]?.mainsnak?.datavalue) {
            const locationId = entity.claims.P131[0].mainsnak.datavalue.value.id;
            const locRes = await fetch(`https://www.wikidata.org/wiki/Special:EntityData/${locationId}.json`);
            const locData = await locRes.json() as any;
            const locEntity = locData.entities[locationId];
            if (locEntity.labels?.en) {
                location = locEntity.labels.en.value;
            }
        }
        // Coordinates (P625)
        if (entity.claims?.P625?.[0]?.mainsnak?.datavalue?.value) {
            const coord = entity.claims.P625[0].mainsnak.datavalue.value;
            if (typeof coord.latitude === "number" && typeof coord.longitude === "number") {
                latitude = coord.latitude;
                longitude = coord.longitude;
            }
        }
        const result = { logo, location, latitude, longitude };
        await redis.set(cacheKey, JSON.stringify(result), "EX", 60 * 60); // 1 hour
        return result;
    } catch (e) {
        console.error('[Wikidata error]', universityName, e);
        return {};
    }
} 
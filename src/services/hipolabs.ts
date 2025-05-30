import { redis } from "bun";
import { safeJsonParse, normalizeKey } from "../utils";

export async function fetchHipolabsInfo(universityName: string): Promise<{ country?: string; logo?: string; location?: string }> {
    const cacheKey = `hipolabs:${normalizeKey(universityName)}`;
    const cached = safeJsonParse<{ country?: string; logo?: string; location?: string }>(await redis.get(cacheKey));
    if (cached) return cached;

    try {
        const res = await fetch(`http://universities.hipolabs.com//search?name=${encodeURIComponent(universityName)}`);
        const data = await res.json();
        let country, logo, location;
        if (Array.isArray(data) && data.length > 0) {
            country = data[0].country;
            location = data[0]["state-province"] || undefined;
            if (data[0].domains?.length > 0) {
                logo = `https://logo.clearbit.com/${data[0].domains[0]}`;
            }
        }
        const result = { country, logo, location };
        await redis.set(cacheKey, JSON.stringify(result), "EX", 60 * 60);
        return result;
    } catch (e) {
        console.error('[Hipolabs error]', universityName, e);
        return {};
    }
} 
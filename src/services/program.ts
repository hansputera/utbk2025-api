import { redis } from "bun";
import db from "../database/database";
import { safeJsonParse } from "../utils";
import type { Passers, Program } from "../types";
import { normalizeKey } from "../utils";

export const getPrograms = async (ptnCode: string): Promise<Program[]> => {
    const cacheKey = `programs:${normalizeKey(ptnCode)}`;
    const cached = safeJsonParse<Program[]>(await redis.get(cacheKey));
    if (cached) return cached;
    const programs = db.prepare(`
        SELECT 
            prodi_code as code, 
            prodi as name, 
            COUNT(DISTINCT id) as passers,
            SUM(CASE WHEN bidik_misi = 1 THEN 1 ELSE 0 END) as kip,
            CASE WHEN RANK() OVER (ORDER BY COUNT(DISTINCT id) DESC) <= 5 THEN 1 ELSE 0 END as isTopFive
        FROM snbt_dump
        WHERE ptn_code = ?
        GROUP BY prodi_code, prodi
    `).all(ptnCode) as Program[];

    await redis.set(cacheKey, JSON.stringify(programs), "EX", 60 * 60); // cache for 1 hour

    return programs;
};

export const getPassersPaginated = async (
    universityCode: string,
    programCode: string,
    page: number = 1,
    pageSize: number = 100
) => {
    const offset = (page - 1) * pageSize;
    const passers = db.prepare(`
        SELECT name, utbk_no as utbkNumber, prodi as program, id
        FROM snbt_dump
        WHERE ptn_code = ? AND prodi_code = ? AND passed = 1
        LIMIT ? OFFSET ?
    `).all(universityCode, programCode, pageSize, offset) as Passers[];

    // Optionally, get total count for pagination meta
    const result = db.prepare(`
        SELECT COUNT(*) as count
        FROM snbt_dump
        WHERE ptn_code = ? AND prodi_code = ? AND passed = 1
    `).get(universityCode, programCode) as { count: number } | undefined;

    const total = typeof result?.count === "number" ? result.count : 0;

    

    return {
        data: passers,
        meta: {
            page,
            pageSize,
            total,
            pages: Math.ceil(total / pageSize),
        }
    };
};

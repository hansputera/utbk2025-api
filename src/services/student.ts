import { redis } from "bun";
import db from "../database/database"
import type { StudentQuery } from "../types";
import { safeJsonParse } from "../utils";

export const findStudent = async (query: string) => {
    const cacheKey = `student_query:${query.toLowerCase()}`;
    const cache = await redis.get(cacheKey);
    if (cache) {
        return safeJsonParse(cache);
    }

    const data = (db.query(`
        SELECT name, utbk_no as utbkNumber, date_of_birth as dob, passed, bidik_misi as kip, ptn, prodi FROM snbt_dump WHERE name LIKE ?
    `).all(`%${query}%`) as StudentQuery[])
        .map(n => ({
            ...n,
            passed: Boolean(n.passed),
            kip: Boolean(n.kip),
        }));

    await redis.set(cacheKey, JSON.stringify(data), 'EX', 6 * 60 * 60);

    return data as Array<StudentQuery>;
}
import db from "../database/database";
import type { Stats } from "../types";

export const getStats = async (): Promise<Stats> => {
    const stats = await db.prepare(`
        SELECT COUNT(*) as totalRegistrants,
            SUM(CASE WHEN bidik_misi = 1 THEN 1 ELSE 0 END) as kipParticipant,
            SUM(CASE WHEN passed = 1 THEN 1 ELSE 0 END) as totalPassers,
            SUM(CASE WHEN passed = 0 THEN 1 ELSE 0 END) as totalFailures
        FROM snbt_dump
    `).get();

    return stats as Stats;
};
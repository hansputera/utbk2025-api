import db from "../src/database/database";
import { fetchWikidataInfo } from "../src/services/wiki";
import { fetchHipolabsInfo } from "../src/services/hipolabs";

// Generator to yield university names one by one
function* universityNameGenerator() {
  const stmt = db.prepare(`SELECT DISTINCT ptn FROM snbt_dump WHERE ptn IS NOT NULL`);
  const rows = stmt.all() as { ptn: string }[];
  for (const row of rows) {
    yield row.ptn;
  }
}

async function main() {
  const concurrency = 30;
  const nameGen = universityNameGenerator();
  let batch: string[] = [];
  let count = 0;

  for (const name of nameGen) {
    batch.push(name);
    if (batch.length === concurrency) {
      await Promise.all(batch.map(async (n) => {
        await Promise.all([
          fetchWikidataInfo(n),
          fetchHipolabsInfo(n)
        ]);
        console.log(`Warmed cache for: ${n}`);
      }));
      batch = [];
    }
    count++;
  }

  // Process any remaining names
  if (batch.length > 0) {
    await Promise.all(batch.map(async (n) => {
      await Promise.all([
        fetchWikidataInfo(n),
        fetchHipolabsInfo(n)
      ]);
      console.log(`Warmed cache for: ${n}`);
    }));
  }

  console.log(`Cache warming complete! Processed ${count} universities.`);
}

main(); 
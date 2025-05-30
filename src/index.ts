import { Hono } from "hono";
import { getUniversities, getUniversity } from "./services/universities";
import { getStats } from "./services/stats";
import { getPassersPaginated, getPrograms } from "./services/program";

const app = new Hono();

app.get("/", (c) => c.text("Hello World"));

// Universities list with correct pagination meta
app.get("/universities", async (c) => {
  const page     = Number(c.req.query("page"))     || 1;
  const pageSize = Number(c.req.query("pageSize")) || 10;

  // Now returns { data, total }
  const universities = await getUniversities(page, pageSize);

  return c.json({
    data: universities.data,
    meta: {
      page,
      pageSize,
      total: universities.total,
      pages: Math.ceil(universities.total / pageSize),
    },
  });
});

// University detail
app.get("/universities/:ptnCode", async (c) => {
  const ptnCode = c.req.param("ptnCode");
  if (!ptnCode) {
    return c.json({ error: "PTN code is required" }, 400);
  }
  try {
    const university = await getUniversity(ptnCode);
    return c.json({ data: university });
  } catch {
    return c.json({ error: "University not found" }, 404);
  }
});

// Programs list
app.get("/universities/:ptnCode/programs", async (c) => {
  const ptnCode = c.req.param("ptnCode");
  if (!ptnCode) {
    return c.json({ error: "PTN code is required" }, 400);
  }
  try {
    const programs = await getPrograms(ptnCode);
    return c.json({ data: programs });
  } catch {
    return c.json({ error: "Programs not found" }, 404);
  }
});

// Passers list with existing paginated service
app.get("/universities/:ptnCode/programs/:programCode/passers", async (c) => {
  const ptnCode     = c.req.param("ptnCode");
  const programCode = c.req.param("programCode");
  if (!ptnCode || !programCode) {
    return c.json({ error: "PTN code and Program code are required" }, 400);
  }

  const page     = parseInt(c.req.query("page")     || "1", 10);
  const pageSize = parseInt(c.req.query("pageSize") || "10", 10);

  try {
    const result = await getPassersPaginated(ptnCode, programCode, page, pageSize);
    // result.meta should already include total & pages
    return c.json({
      data: result.data,
      meta: result.meta,
    });
  } catch {
    return c.json({ error: "Passers not found" }, 404);
  }
});

// Stats summary
app.get("/stats", async (c) => {
  const stats = await getStats();
  return c.json({ data: stats });
});

export default app;

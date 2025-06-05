import { Hono } from "hono";
import { getUniversities, getUniversity } from "./services/universities";
import { getStats } from "./services/stats";
import { getPassersPaginated, getPrograms } from "./services/program";
import { cors } from "hono/cors";
import { secureHeaders } from "hono/secure-headers";
import { findStudent } from "./services/student";

const app = new Hono();

app.use(cors());
app.use(secureHeaders());

app.get("/", (c) => c.text("Hello World"));

// Universities list with correct pagination meta
app.get("/universities", async (c) => {
  const page     = Number(c.req.query("page"))     || 1;
  const pageSize = Number(c.req.query("pageSize")) || 10;
  const name = c.req.query("name");

  // Now returns { data, total }
  const universities = await getUniversities(page, pageSize, name);

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
  const name = c.req.query("name");

  try {
    const result = await getPassersPaginated(ptnCode, programCode, page, pageSize, name);
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

// Find Student
app.get('/students', async (c) => {
  const query = c.req.query('name');
  if (!query?.length || query?.length < 3) {
    return c.json({
      message: 'Query length minimum is 3 chars',
    }, 401);
  }

  const result = await findStudent(query);
  return c.json({
    data: result,
  });
});

export default {
  port: 9898,
  fetch: app.fetch,
}

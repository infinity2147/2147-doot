import schema from "../../migrations/0001_init.sql?raw";

export async function applySchema(DB) {
  const stmts = schema.split(";").map((s) => s.trim()).filter(Boolean);
  await DB.batch(stmts.map((s) => DB.prepare(s)));
}

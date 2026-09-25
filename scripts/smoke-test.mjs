const baseUrl = (process.env.SMOKE_BASE_URL ?? "https://atlasros.ddns.net").replace(/\/$/, "");

async function check(path, expectedStatus) {
  const response = await fetch(`${baseUrl}${path}`, {
    signal: AbortSignal.timeout(15_000),
    redirect: "manual",
  });

  if (response.status !== expectedStatus) {
    throw new Error(`${path}: expected HTTP ${expectedStatus}, got ${response.status}`);
  }

  return response;
}

const landing = await check("/", 200);
const html = await landing.text();

if (!html.includes("<title>Atlas — AI Instagram Agent</title>")) {
  throw new Error("Landing page does not contain the expected title");
}

await check("/health", 200);

const mcp = await fetch(`${baseUrl}/mcp`, {
  signal: AbortSignal.timeout(15_000),
});

if (![401, 405].includes(mcp.status)) {
  throw new Error(`/mcp expected protected endpoint response 401/405, got ${mcp.status}`);
}

console.log(`Smoke test passed: ${baseUrl}`);

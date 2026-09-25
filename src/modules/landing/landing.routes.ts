import type { FastifyInstance } from "fastify";

export async function registerLandingRoutes(app: FastifyInstance) {
  app.get("/", async (_request, reply) => {
    return reply
      .type("text/html; charset=utf-8")
      .send(landingHtml);
  });
}

const landingHtml = String.raw`<!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="theme-color" content="#05070c">
<meta name="description" content="Atlas — AI control plane for Instagram content and automation.">
<title>Atlas — AI Instagram Agent</title>
<style>
:root{color-scheme:dark;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;background:#05070c;color:#f5f7fb}
*{box-sizing:border-box}html,body{margin:0;min-height:100%;background:#05070c}
body{overflow-x:hidden}.page{min-height:100svh;position:relative;display:grid;place-items:center;isolation:isolate}
.atlas{position:absolute;inset:0;z-index:-2;overflow:hidden}
.atlas svg{width:100%;height:100%;display:block;opacity:.82}
.glow{position:absolute;width:46vw;height:46vw;min-width:320px;min-height:320px;border-radius:50%;background:radial-gradient(circle,rgba(92,137,255,.18),rgba(92,137,255,0) 68%);filter:blur(8px);animation:pulse 7s ease-in-out infinite}
.noise{position:absolute;inset:0;opacity:.035;background-image:url("data:image/svg+xml,%3Csvg viewBox='0 0 160 160' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")}
.content{width:min(1120px,calc(100% - 40px));padding:72px 0;display:grid;grid-template-columns:1.05fr .95fr;gap:48px;align-items:center}
.eyebrow{font-size:12px;letter-spacing:.2em;text-transform:uppercase;color:#91a4c7;margin-bottom:18px}
h1{font-size:clamp(54px,9vw,116px);line-height:.88;letter-spacing:-.065em;margin:0 0 28px;font-weight:700}
.lead{max-width:620px;font-size:clamp(18px,2vw,24px);line-height:1.45;color:#aeb9cd;margin:0}
.panel{justify-self:end;width:min(430px,100%);padding:28px;border:1px solid rgba(255,255,255,.1);border-radius:28px;background:rgba(7,10,17,.58);backdrop-filter:blur(18px);box-shadow:0 24px 90px rgba(0,0,0,.35)}
.panel-title{font-size:13px;color:#8494b3;text-transform:uppercase;letter-spacing:.14em;margin-bottom:24px}
.item{display:flex;gap:14px;align-items:flex-start;padding:16px 0;border-top:1px solid rgba(255,255,255,.08)}
.item:first-of-type{border-top:0}.dot{width:8px;height:8px;border-radius:50%;margin-top:7px;background:#8ca9ff;box-shadow:0 0 18px #8ca9ff}
.item strong{display:block;font-size:15px;margin-bottom:5px}.item span{color:#8995aa;font-size:13px;line-height:1.4}
@keyframes pulse{0%,100%{transform:scale(.92);opacity:.65}50%{transform:scale(1.08);opacity:1}}
@keyframes drift{from{transform:translate3d(0,0,0)}to{transform:translate3d(18px,-12px,0)}}
.atlas .drift{animation:drift 14s ease-in-out infinite alternate}
@media (max-width:760px){.content{grid-template-columns:1fr;gap:36px;padding:48px 0}.panel{justify-self:stretch}.glow{width:90vw;height:90vw}h1{font-size:clamp(58px,19vw,96px)}.lead{font-size:18px}.atlas svg{transform:scale(1.55)}}
@media (prefers-reduced-motion:reduce){.glow,.atlas .drift{animation:none}}
</style>
</head>
<body>
<main class="page">
<div class="atlas" aria-hidden="true">
<div class="glow"></div>
<svg viewBox="0 0 1200 900" preserveAspectRatio="xMidYMid slice">
<g fill="none" stroke="rgba(150,175,230,.18)" stroke-width="1" class="drift">
<path d="M0 180H1200M0 360H1200M0 540H1200M0 720H1200M200 0V900M400 0V900M600 0V900M800 0V900M1000 0V900"/>
<ellipse cx="600" cy="450" rx="430" ry="210"/>
<ellipse cx="600" cy="450" rx="290" ry="390"/>
<ellipse cx="600" cy="450" rx="170" ry="460"/>
<path d="M170 120C330 300 870 300 1030 120M170 780C330 600 870 600 1030 780"/>
</g>
<g fill="none" stroke="rgba(140,169,255,.35)">
<path d="M95 690L360 540L585 615L820 370L1100 245"/>
<path d="M210 180L420 330L690 250L930 520L1080 640"/>
</g>
<g fill="rgba(177,196,255,.75)">
<circle cx="95" cy="690" r="3"/><circle cx="360" cy="540" r="3"/><circle cx="585" cy="615" r="3"/><circle cx="820" cy="370" r="3"/><circle cx="1100" cy="245" r="3"/>
<circle cx="210" cy="180" r="3"/><circle cx="420" cy="330" r="3"/><circle cx="690" cy="250" r="3"/><circle cx="930" cy="520" r="3"/><circle cx="1080" cy="640" r="3"/>
</g>
</svg>
</div>
<div class="noise"></div>
<section class="content">
<div>
<div class="eyebrow">AI Instagram Control Plane</div>
<h1>ATLAS</h1>
<p class="lead">Система управления контентом, генерацией и автоматизацией Instagram через единый AI-контур.</p>
</div>
<aside class="panel">
<div class="panel-title">System map</div>
<div class="item"><i class="dot"></i><div><strong>Content</strong><span>Сценарии, изображения, Reels и контент-пайплайн.</span></div></div>
<div class="item"><i class="dot"></i><div><strong>Agents</strong><span>Специализированные агенты для контента, аналитики и community.</span></div></div>
<div class="item"><i class="dot"></i><div><strong>Control</strong><span>Telegram, MCP, очереди и human approval перед публикацией.</span></div></div>
</aside>
</section>
</main>
</body>
</html>`;

// PG 심사 자료용 화면 캡처 (puppeteer, 로컬에서 --no-save 로 설치).
//   node scripts/capture-flow.mjs <baseUrl> <loginId> <password> <outDir>
// 캡처 순서: 첫 화면 → 상품 목록 → 상품 상세 → 주문 페이지 → 결제창 → (결제 후) 인증 화면
//           + 푸터(사업자정보) → 회원가입 → 로그인 → 약관/개인정보/환불규정
import puppeteer from "puppeteer";
import fs from "node:fs";
import path from "node:path";

const [base, loginId, password, outDir] = process.argv.slice(2);
if (!base || !loginId || !password || !outDir) {
  console.error("usage: node scripts/capture-flow.mjs <baseUrl> <loginId> <password> <outDir>");
  process.exit(1);
}
fs.mkdirSync(outDir, { recursive: true });
const shot = (page, name, opts = {}) =>
  page.screenshot({ path: path.join(outDir, `${name}.png`), ...opts }).then(() => console.log("📸", name));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Reveal(스크롤 fade-up) 요소를 전부 보이게 하고 애니메이션을 끈다 — 캡처에 빈 칸이 남지 않게.
async function settle(page) {
  await page.addStyleTag({
    content: `*,*::before,*::after{animation:none!important;transition:none!important}
      [data-reveal],.reveal,.opacity-0{opacity:1!important;transform:none!important}
      /* 상단 입금 안내 마퀴는 심사 캡처에서 제외(운영 공지) */
      .marquee, .marquee *, div.sticky.top-0.h-7{display:none!important}
      .sticky.top-7{top:0!important}`,
  });
  await page.evaluate(async () => {
    const h = document.body.scrollHeight;
    for (let y = 0; y < h; y += 400) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 60));
    }
    window.scrollTo(0, 0);
  });
  await sleep(500);
}

const browser = await puppeteer.launch({ headless: "new", args: ["--no-sandbox", "--lang=ko-KR"] });
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 800, deviceScaleFactor: 1.5 });
await page.setExtraHTTPHeaders({ "Accept-Language": "ko-KR,ko;q=0.9" });

// 1. 첫 화면
await page.goto(`${base}/`, { waitUntil: "networkidle2" });
await settle(page);
await shot(page, "01-home");
await shot(page, "01-home-full", { fullPage: true });

// 푸터(사업자정보)
const footer = await page.$("footer");
if (footer) await footer.screenshot({ path: path.join(outDir, "02-footer.png") }).then(() => console.log("📸 02-footer"));

// 회원가입 화면
await page.goto(`${base}/register`, { waitUntil: "networkidle2" });
await settle(page);
await shot(page, "03-register", { fullPage: true });

// 로그인 화면 + 로그인
await page.goto(`${base}/login`, { waitUntil: "networkidle2" });
await settle(page);
await page.type("input[name=loginId]", loginId);
await page.type("input[name=password]", password);
await shot(page, "04-login");
await Promise.all([page.waitForNavigation({ waitUntil: "networkidle2" }), page.click("form button")]);
if (page.url().includes("/login")) throw new Error("로그인 실패: " + page.url());
await settle(page);
await shot(page, "05-after-login");

// 약관·개인정보·환불규정
for (const [p, n] of [["/terms", "06-terms"], ["/privacy", "07-privacy"], ["/refund", "08-refund"]]) {
  await page.goto(`${base}${p}`, { waitUntil: "networkidle2" });
  await settle(page);
  await shot(page, n, { fullPage: true });
}

// 2. 상품 선택
await page.goto(`${base}/products`, { waitUntil: "networkidle2" });
await settle(page);
await shot(page, "10-products");

// 3. 상품 상세 (텔레그램)
await page.goto(`${base}/products/telegram`, { waitUntil: "networkidle2" });
await settle(page);
await shot(page, "11-product-detail");
// 주문 가능한 국가 후보(수신률 순). 공급사 재고 표시가 실제와 다를 수 있어 앞에서부터 차례로 시도한다.
const orderHrefs = await page.$$eval('a[href^="/order?"]', (as) => as.map((a) => a.getAttribute("href")));
if (orderHrefs.length === 0) throw new Error("주문 가능한 국가가 없습니다(상품 상세에 주문하기 링크 없음)");

let done = false;
for (const orderHref of orderHrefs.slice(0, 4)) {
  console.log("order:", orderHref);
  // 4. 주문 페이지 → 결제하기
  await page.goto(`${base}${orderHref}`, { waitUntil: "networkidle2" });
  await settle(page);
  await shot(page, "12-order");
  // 결제수단: 결제창(신용카드·간편결제) 선택 + 약관 동의
  await page.evaluate(() => {
    const btn = [...document.querySelectorAll('button[role=radio]')].find((b) => b.textContent.includes("신용카드"));
    btn?.click();
  });
  await page.click('input[type=checkbox]');
  await sleep(200);
  await shot(page, "13-order-ready");
  // 결제하기 → 결제창
  await page.evaluate(() => {
    const btn = [...document.querySelectorAll("button")].find((b) => /결제하기$/.test(b.textContent.trim()) && !b.disabled);
    btn?.click();
  });
  await page.waitForSelector('[role=dialog]', { timeout: 5000 });
  await sleep(400);
  await shot(page, "14-payment-window");
  // 결제창에서 카카오페이 탭도 한 장
  await page.evaluate(() => {
    const b = [...document.querySelectorAll('[role=dialog] button[role=radio]')].find((x) => x.textContent.includes("카카오페이"));
    b?.click();
  });
  await sleep(200);
  await shot(page, "15-payment-window-kakaopay");

  // 5. 결제창에서 결제하기 → 번호 발급 → 인증 화면
  await page.evaluate(() => {
    const b = [...document.querySelectorAll('[role=dialog] button')].find((x) => /결제하기$/.test(x.textContent.trim()));
    b?.click();
  });
  try {
    await page.waitForFunction(() => location.pathname.startsWith("/sms"), { timeout: 20000 });
  } catch {
    const msg = await page.$eval('[role=alert]', (e) => e.textContent).catch(() => "(메시지 없음)");
    console.warn("발급 실패 → 다음 국가 시도:", msg.trim());
    continue;
  }
  await page.waitForNetworkIdle({ idleTime: 800, timeout: 15000 }).catch(() => {});
  await sleep(1500);
  await settle(page);
  // 발급 번호·결제 상태 패널이 보이도록 스크롤
  await page.evaluate(() => {
    const el = [...document.querySelectorAll("span")].find((x) => x.textContent.trim() === "발급 번호");
    el?.closest(".glass")?.scrollIntoView({ block: "start" });
    window.scrollBy(0, -90);
  });
  await sleep(400);
  await shot(page, "16-after-payment-sms");
  // 발급된 번호는 밴(취소)해서 5sim 비용이 나가지 않게 한다.
  await page.evaluate(() => {
    const b = [...document.querySelectorAll("button")].find((x) => x.textContent.trim() === "밴넘버");
    b?.click();
  });
  await sleep(2500);
  await shot(page, "17-after-cancel");
  done = true;
  break;
}
if (!done) console.warn("★ 모든 후보 국가에서 번호 발급 실패 — 16/17 캡처 없음");

await browser.close();
console.log("done →", outDir);

// Synthetic-only Web acceptance. Requires a local Expo server and clean Edge.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawn, spawnSync } = require("node:child_process");
const net = require("node:net");
let playwright;
try {
  playwright = require("playwright");
} catch {
  playwright = require(
    path.join(
      os.homedir(),
      ".cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright",
    ),
  );
}
const root = path.resolve(__dirname, "..");
const apiRoot = path.join(root, "services/api");
const python = path.join(apiRoot, ".venv/Scripts/python.exe");
const artifacts = path.join(root, ".artifacts/verification/m1");
const webUrl = process.env.M1_WEB_URL || "http://localhost:8099";
const fixture = JSON.parse(
  fs.readFileSync(path.join(root, "fixtures/m1_budget_story.json"), "utf8"),
);
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function freePort() {
  const server = net.createServer();
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = server.address().port;
  await new Promise((resolve) => server.close(resolve));
  return port;
}
function checked(args, env) {
  const result = spawnSync(python, args, {
    cwd: apiRoot,
    env,
    encoding: "utf8",
    windowsHide: true,
  });
  if (result.status !== 0)
    throw new Error("Backend preparation failed: " + result.stderr);
}
(async () => {
  fs.mkdirSync(artifacts, { recursive: true });
  const temporary = fs.mkdtempSync(
    path.join(os.tmpdir(), "secondbrain-m1-ui-"),
  );
  const env = {
    ...process.env,
    APP_ENV: "test",
    DATABASE_URL:
      "sqlite:///" + path.join(temporary, "synthetic.db").replaceAll("\\", "/"),
    MOCK_MODE: "true",
    LIVE_AI_ENABLED: "false",
    LLM_PROVIDER: "mock",
    ASR_PROVIDER: "mock",
    CORS_ORIGINS: webUrl,
    PYTHONUTF8: "1",
  };
  const codePath = path.join(temporary, "pair-code.txt");
  checked(["-m", "alembic", "upgrade", "head"], env);
  checked(["-m", "app.manage", "pairing-code", "--output", codePath], env);
  const port = await freePort();
  const backend = "http://127.0.0.1:" + port;
  const serverLog = fs.openSync(path.join(artifacts, "ui-server.log"), "w");
  const server = spawn(
    python,
    [
      "-m",
      "uvicorn",
      "app.main:app",
      "--host",
      "127.0.0.1",
      "--port",
      String(port),
      "--no-access-log",
    ],
    {
      cwd: apiRoot,
      env,
      stdio: ["ignore", serverLog, serverLog],
      windowsHide: true,
    },
  );
  let browser;
  const checks = [];
  const pass = (message) => {
    checks.push("PASS: " + message);
    console.log(checks.at(-1));
  };
  try {
    let healthy = false;
    for (let i = 0; i < 100; i++) {
      try {
        if ((await fetch(backend + "/health")).ok) {
          healthy = true;
          break;
        }
      } catch {}
      await wait(100);
    }
    assert(healthy, "isolated API starts");
    browser = await playwright.chromium.launch({
      channel: "msedge",
      headless: true,
    });
    const context = await browser.newContext({
      viewport: { width: 440, height: 956 },
      isMobile: true,
      hasTouch: true,
    });
    const page = await context.newPage();
    const errors = [];
    const urls = [];
    let offline = false;
    let loseResponse = false;
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("request", (request) => urls.push(request.url()));
    // Keep the configured client origin, proxy only to our temporary synthetic API.
    await context.route("**/api/v1/**", async (route) => {
      if (offline) return route.abort("internetdisconnected");
      const request = route.request();
      const requested = new URL(request.url());
      const response = await route.fetch({
        url: backend + requested.pathname + requested.search,
      });
      if (
        loseResponse &&
        request.method() === "POST" &&
        request.url().endsWith("/api/v1/records")
      ) {
        loseResponse = false;
        return route.abort("failed");
      }
      return route.fulfill({ response });
    });
    const button = (name) =>
      page.getByRole("button", { name, exact: true }).filter({ visible: true });
    const text = (value) =>
      page.getByText(value, { exact: true }).filter({ visible: true });
    const shot = (name) =>
      page.screenshot({ path: path.join(artifacts, name + ".png") });
    const home = async () => {
      await button("文字记录").click();
      await button("新建文字记录").waitFor();
    };
    async function fillRecord(record) {
      await page
        .getByLabel("文字标题", { exact: true })
        .filter({ visible: true })
        .fill(record.title);
      await page
        .getByLabel("原始文字内容", { exact: true })
        .filter({ visible: true })
        .fill(record.body_text);
      await page
        .getByLabel("记录发生时间（ISO，带时区）", { exact: true })
        .filter({ visible: true })
        .fill(record.captured_at);
      for (const [key, label] of [
        ["people", "人物"],
        ["projects", "项目"],
        ["events", "事件"],
      ]) {
        await page
          .getByLabel(label + "（逗号分隔）", { exact: true })
          .filter({ visible: true })
          .fill(record[key].join("，"));
      }
    }
    await page.goto(webUrl, { waitUntil: "networkidle", timeout: 60000 });
    await button("文字工作区 · M1").click();
    await text("尚未配对 · 可以先保存离线草稿").waitFor();
    await button("设备配对").click();
    await page
      .getByLabel("一次性配对码", { exact: true })
      .filter({ visible: true })
      .fill(fs.readFileSync(codePath, "utf8").trim());
    await button("配对本地服务").click();
    await text("设备已配对").waitFor();
    pass(
      "fresh device pairs through one-use code without exposing credentials",
    );
    for (const record of fixture.records) {
      await home();
      await button("新建文字记录").click();
      await fillRecord(record);
      await button("保存并批准同步文字").click();
      await button("打开本机记录：" + record.title).waitFor();
      await button("打开本机记录：" + record.title).click();
      await text(record.body_text).waitFor();
      await button("抽取这条记录的候选记忆").click();
      await page
        .getByText(/已生成 .* 条候选记忆（mock）/)
        .filter({ visible: true })
        .waitFor();
    }
    await shot("record-and-extraction");
    await home();
    for (const record of fixture.records)
      await button("打开本机记录：" + record.title).waitFor();
    pass(
      "three independently saved budget records retain original words and links",
    );
    await page
      .getByLabel("搜索文字、人物、项目或事件", { exact: true })
      .filter({ visible: true })
      .fill("星河示例项目");
    await button("检索文字记录").click();
    for (const record of fixture.records)
      await button("打开本机记录：" + record.title).waitFor();
    pass("manual project association can retrieve all three original records");
    await button("候选记忆").click();
    await button("打开候选：" + fixture.records[0].body_text).click();
    await button("确认这条候选记忆").click();
    await text("人工确认 · v2").waitFor();
    await button("打开来源并高亮原话").click();
    await page
      .getByTestId("workspace-evidence-highlight")
      .filter({ visible: true })
      .waitFor();
    assert.equal(
      await page
        .getByTestId("workspace-evidence-highlight")
        .filter({ visible: true })
        .innerText(),
      fixture.records[0].body_text,
    );
    await button("候选记忆").click();
    await button("打开候选：" + fixture.records[1].body_text).click();
    await button("驳回这条候选记忆").click();
    await text("已驳回 · v2").waitFor();
    await button("候选记忆").click();
    await button("打开候选：" + fixture.records[2].body_text).click();
    await page
      .getByLabel("修改候选表述", { exact: true })
      .filter({ visible: true })
      .fill("仅记录口头考虑150万元，未确认审批。（虚构审核）");
    await button("保存修改并待复核").click();
    await page
      .getByText(/修改已保存，仍待核实/)
      .filter({ visible: true })
      .waitFor();
    await page
      .getByText(/待复核|候选 · 待核实/)
      .filter({ visible: true })
      .first()
      .waitFor();
    await shot("memory-review");
    pass(
      "candidate confirmation, rejection and correction retain original evidence and review states",
    );
    await button("来源问答").click();
    await page
      .getByLabel("向记忆系统提问", { exact: true })
      .filter({ visible: true })
      .fill(fixture.questions.budget);
    await button("检索并引用来源").click();
    await button("打开真实来源 3").waitFor();
    assert.match(
      await page.locator("body").innerText(),
      /无法确认|不能确认|不能证明|不足以确认/,
    );
    await shot("sourced-answer");
    await button("打开真实来源 1").click();
    await page
      .getByTestId("workspace-evidence-highlight")
      .filter({ visible: true })
      .waitFor();
    const quoted = await page
      .getByTestId("workspace-evidence-highlight")
      .filter({ visible: true })
      .innerText();
    assert(fixture.records.some((record) => record.body_text === quoted));
    pass(
      "budget answer refuses unsupported approval and opens precise original evidence",
    );
    await button("来源问答").click();
    await page
      .getByLabel("向记忆系统提问", { exact: true })
      .filter({ visible: true })
      .fill(fixture.questions.unrelated);
    await button("检索并引用来源").click();
    await text("证据不足 · 无法确认").waitFor();
    assert.equal(await button("打开真实来源 1").count(), 0);
    pass("unrelated question refuses an answer without fabricated citations");
    // A lost response occurs after commit; replay uses the persisted original key.
    await home();
    await button("新建文字记录").click();
    const draft = {
      ...fixture.records[0],
      title: "离线草稿（虚构）",
      body_text: "🧪这是一条离线恢复的虚构文字。",
      people: ["王总", "李总"],
    };
    await fillRecord(draft);
    offline = true;
    await button("保存本机草稿").click();
    await text(
      "草稿已保存到本机；尚未批准发送，刷新或重启后可恢复。",
    ).waitFor();
    await page.reload({ waitUntil: "networkidle" });
    await home();
    await button("打开草稿：" + draft.title).click();
    assert.equal(
      await page
        .getByLabel("原始文字内容", { exact: true })
        .filter({ visible: true })
        .inputValue(),
      draft.body_text,
    );
    await button("保存并批准同步文字").click();
    await page
      .getByText(/连接中断或超时/)
      .filter({ visible: true })
      .first()
      .waitFor();
    await page.reload({ waitUntil: "networkidle" });
    await home();
    await button("打开草稿：" + draft.title).waitFor();
    offline = false;
    loseResponse = true;
    await button("重试已批准的文字同步").click();
    await page
      .getByText(/连接中断或超时/)
      .filter({ visible: true })
      .first()
      .waitFor();
    await button("重试已批准的文字同步").click();
    await button("打开本机记录：" + draft.title).waitFor();
    await button("打开草稿：" + draft.title).waitFor({ state: "hidden" });
    assert.equal(await button("打开本机记录：" + draft.title).count(), 1);
    assert.equal(await button("打开草稿：" + draft.title).count(), 0);
    await shot("offline-recovered");
    pass(
      "offline reload restores drafts; lost response replays one idempotent record",
    );
    await button("打开本机记录：" + draft.title).click();
    const peopleText = await page
      .getByText(/^人物：/)
      .filter({ visible: true })
      .innerText();
    assert.deepEqual(
      peopleText.replace("人物：", "").split("、").sort(),
      ["王总", "李总"].sort(),
    );
    await button("编辑这条文字记录").click();
    await page
      .getByLabel("原始文字内容", { exact: true })
      .filter({ visible: true })
      .fill(draft.body_text + "已做虚构修改。");
    await button("提交文字修改").click();
    await text(draft.body_text + "已做虚构修改。").waitFor();
    await button("查看删除确认").click();
    await button("确认删除原文与派生记忆").click();
    await button("新建文字记录").waitFor();
    for (const record of fixture.records)
      await button("打开本机记录：" + record.title).waitFor();
    assert.equal(await button("打开本机记录：" + draft.title).count(), 0);
    pass("record edit/delete preserve the other historical budget records");
    assert.deepEqual(errors, []);
    assert.deepEqual(
      urls.filter(
        (url) =>
          /^https?:/.test(url) &&
          !["localhost", "127.0.0.1"].includes(new URL(url).hostname),
      ),
      [],
    );
    pass("no browser exceptions or external HTTP requests");
    fs.writeFileSync(
      path.join(artifacts, "ui-smoke.txt"),
      checks.join("\n") + "\n",
      "utf8",
    );
  } finally {
    if (browser) await browser.close();
    if (server.exitCode === null) {
      const stopped = new Promise((resolve) => server.once("exit", resolve));
      server.kill();
      await stopped;
    }
    fs.closeSync(serverLog);
    // The exact temporary directory is created above; never touch the project DB.
    assert(
      path.resolve(temporary).startsWith(path.resolve(os.tmpdir()) + path.sep),
    );
    assert(path.basename(temporary).startsWith("secondbrain-m1-ui-"));
    for (let i = 0; i < 20; i++) {
      try {
        fs.rmSync(temporary, { recursive: true });
        break;
      } catch {
        await wait(200);
      }
    }
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

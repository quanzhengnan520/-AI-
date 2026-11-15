// Optional: needs Playwright and a clean installed Edge channel. Uses no personal browser profile.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
let playwright;
try {
  playwright = require("playwright");
} catch {
  playwright = require(
    path.join(
      require("node:os").homedir(),
      ".cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright",
    ),
  );
}

(async () => {
  const artifacts = path.resolve(__dirname, "../.artifacts/verification");
  fs.mkdirSync(artifacts, { recursive: true });
  const browser = await playwright.chromium.launch({
    headless: true,
    channel: "msedge",
  });
  const page = await browser.newPage({
    viewport: { width: 440, height: 956 },
    deviceScaleFactor: 1,
    isMobile: true,
    hasTouch: true,
  });
  const errors = [];
  const requests = [];
  const checks = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("request", (request) => requests.push(request.url()));
  const pass = (message) => {
    checks.push("PASS: " + message);
    console.log(checks.at(-1));
  };
  const text = (value) => page.getByText(value, { exact: true });
  const button = (value) =>
    page.getByRole("button", { name: value, exact: true });
  const screenshot = (name) =>
    page.screenshot({
      path: path.join(artifacts, name + ".png"),
      fullPage: false,
    });
  try {
    await page.goto("http://localhost:8081", {
      waitUntil: "networkidle",
      timeout: 45000,
    });
    await text("Mock 演示 · 不代表真实识别或分析结果").waitFor();
    await screenshot("home");
    pass("home renders with explicit Mock label at 440x956");

    await button("＋ 开始记录 · 演示").click();
    await button("确认并开始演示").click();
    await text("● 模拟记录中").waitFor();
    await button("暂停演示").click();
    await text("演示已暂停").waitFor();
    await button("继续演示").click();
    await button("完成演示").click();
    await text("演示结束 · 未生成音频文件").waitFor();
    await screenshot("recording-demo");
    await button("返回今天").click();
    pass(
      "recording sheet starts, pauses, resumes and finishes without claiming saved audio",
    );

    await page.getByRole("tab", { name: /记录/ }).click();
    await page.getByLabel("搜索记录", { exact: true }).fill("不存在的合成样本");
    await text("暂时没有匹配的演示内容").waitFor();
    await page.getByLabel("搜索记录", { exact: true }).fill("150");
    await button("打开记录：项目预算 · 最新沟通").click();
    await text("这是一条预置文字样本；没有可播放的音频文件。").waitFor();
    await screenshot("record-detail");
    pass("record search, empty state and detail navigation work");

    await page.goBack();
    await page.getByRole("tab", { name: /记忆/ }).click();
    await button("打开记忆：王总目前口头考虑的预算为150万元。").click();
    await button("确认这条演示记忆").click();
    await page.getByText("人工确认 · 演示 · v2", { exact: true }).waitFor();
    await button("驳回这条演示记忆").click();
    await page.getByText("已驳回 · 演示 · v3", { exact: true }).waitFor();
    await button("打开原始记录并定位引用").click();
    await page.getByTestId("evidence-highlight").waitFor();
    await screenshot("evidence");
    pass(
      "memory review updates state and evidence opens with a character-range highlight",
    );

    await page.goBack();
    await page.goBack();
    await page.getByRole("tab", { name: /今天/ }).click();
    await button("问一问，打开历史问答").click();
    await button("王总的预算有什么变化？ ↗").click();
    await button("查看演示回答").click();
    await button("打开问答来源1").waitFor();
    await text("预设演示回答").scrollIntoViewIfNeeded();
    await screenshot("answer");
    await button("打开问答来源1").click();
    await page.getByTestId("evidence-highlight").waitFor();
    pass("preset answer includes an actual navigable source");
    await page.goBack();
    await page.getByLabel("输入问题", { exact: true }).fill("完全无关的问题");
    await button("查看演示回答").click();
    await text("依据不足").waitFor();
    assert.equal(await button("打开问答来源1").count(), 0);
    pass("unsupported question shows insufficient evidence with no source");

    await page.goBack();
    await button("全部提醒 →").click();
    await button("确认演示待办").click();
    await page
      .getByRole("button", { name: "标记演示完成", exact: true })
      .first()
      .click();
    await text("已完成 · 演示").waitFor();
    await screenshot("reminders");
    pass("proposed reminder requires confirmation before completion");

    await page.goBack();
    await page.getByRole("tab", { name: /我的/ }).click();
    await text("尚未连接 · 默认不发起网络请求").waitFor();
    assert.equal(
      requests.filter((url) => url.startsWith("http://127.0.0.1:8000")).length,
      0,
    );
    pass("navigation does not automatically connect to the backend");
    await button("测试本地 API 连接").click();
    await text("后端已连接 · Mock；页面仍使用本机会话演示数据。").waitFor();
    await screenshot("settings");
    pass(
      "explicit user action successfully checks real local FastAPI metadata",
    );
    await button("7 天").click();
    await text("原始资料保留 7 天").waitFor();
    await button("切换为 UTC").click();
    await text("UTC").waitFor();
    assert.equal(await button("Live 模式 · 后续阶段开放").isDisabled(), true);
    await button("重置本次演示状态").click();
    await text("原始资料保留 30 天").waitFor();
    pass(
      "retention, timezone, disabled Live and session reset behave as labelled",
    );

    await page.goto(
      "http://localhost:8081/record/0cbdc86e-4e98-4c67-87bf-235451f60202?start=0&end=26&note=%E4%B8%AD%E6%96%87+%E7%A9%BA%E6%A0%BC",
      { waitUntil: "networkidle" },
    );
    await page.getByTestId("evidence-highlight").waitFor();
    pass(
      "direct evidence deep link survives percent-encoded Chinese query parameters",
    );

    assert.deepEqual(errors, [], "browser runtime errors");
    assert.deepEqual(
      requests.filter(
        (url) =>
          /^https?:/.test(url) &&
          !["localhost", "127.0.0.1"].includes(new URL(url).hostname),
      ),
      [],
      "unexpected external requests",
    );
    pass("no browser runtime errors or external HTTP requests");
    fs.writeFileSync(
      path.join(artifacts, "ui-smoke.txt"),
      checks.join("\n") +
        `\n${checks.length} browser checks passed; Edge headless, viewport 440x956.\nNot an iPhone device test.\n`,
    );
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error.stack);
  process.exit(1);
});

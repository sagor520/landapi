const express = require("express");
const puppeteer = require("puppeteer");

const app = express();

app.get("/token", async (req, res) => {
  try {
    const browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"]
    });

    const page = await browser.newPage();

    // 1. Login page
    await page.goto("https://lsg-land-owner.land.gov.bd/login", { waitUntil: "networkidle2" });

    // 2. Fill login
    await page.type('input[name="username"]', '1989182139');
    await page.type('input[name="password"]', 'Itxj@91588');

    await page.click('button[type="submit"]');
    await page.waitForTimeout(5000);

    // 3. Trigger SSO
    await page.goto("https://dlrms.land.gov.bd/citizen/sso-login", { waitUntil: "networkidle2" });

    await page.waitForTimeout(5000);

    // 4. Get redirected URL (code)
    const finalUrl = page.url();

    const match = finalUrl.match(/code=([^&]+)/);

    if (!match) {
      await browser.close();
      return res.send("❌ Code not found");
    }

    const code = match[1];

    // 5. Get cookies (dlrms token)
    const cookies = await page.cookies();
    const dlrmsCookie = cookies.find(c => c.name === "dlrms_app_token");

    // 6. Call API for JWT
    const response = await page.evaluate(async (code) => {
      const res = await fetch("https://dlrms.land.gov.bd/api/sso-authorize-code-grant", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          code: code,
          isCitizen: true,
          redirect_uri: "https://dlrms.land.gov.bd/citizen-callback"
        })
      });

      return await res.json();
    }, code);

    await browser.close();

    res.json({
      code: code,
      dlrms_token: dlrmsCookie ? dlrmsCookie.value : null,
      user_token: response.access_token || null
    });

  } catch (err) {
    res.send("ERROR: " + err.message);
  }
});

app.listen(3000, () => console.log("Server running"));

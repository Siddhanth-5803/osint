# 🚨 FBI, OPEN UP!

A funny, forensic roast of your group chats. Drop a WhatsApp, Telegram or Instagram export and get:

- **Free stats, instantly, on your device:** who talks most, reply speeds, night owls, conversation starters and killers, double-texters, deleted messages, heatmap, a who-talks-to-whom string board, favourite words and emojis, and badges.
- **The AI interrogation:** mugshots with each person's real role, charges, "what they type vs what they mean", roasts and redeeming qualities. Then ships and beefs, the unsaid (tap to declassify), awards, a fix-it plan, exhibits, a timeline and a share card for stories.
- **Five investigators, each with a speciality report:** Sherlock investigates the fights, Cupid handles love matters, Aunty delivers sarcasm, the Gossip Queen does character analysis, and Osho finds the life lessons. Three spice levels: Wholesome, Spicy and Nuclear. Reports are always in English, even for Hindi, Hinglish or Bengali chats.
- **Payments ready, switched off:** ₹5 per raid through Razorpay when you turn it on. Your promo code gives unlimited free raids.

---

## The easiest way: one click

Open the published page on claude.ai: **https://claude.ai/artifact/9sUSdUot7GxE3KUkAm3UNr**

- No install, no server, no API key. It works on phone, tablet and computer.
- Drop a chat export, pick an investigator, tap **Start investigation**.
- The investigation runs on the **viewer's own Claude account**. Claude asks permission the first time. The free stats and the sample raid work for anyone.
- To give friends the link, open the page and use its **Share** menu. Each friend needs to be signed in to Claude for the investigation.
- No promo codes or ₹5 paywall in this version, because each person's own Claude usage pays for their investigation. Use the server version below when you want to charge.

There's also `dist/fbi-open-up-offline.html`: download it and double-click it to get the free stats and the sample raid without the internet. The investigation needs claude.ai.

After changing the site code, rebuild the one-click page with `npm run build:artifact`.

---

## Run it on your computer (server version, with promo codes and payments)

You need **Node.js 20 or newer**. Get the LTS version from https://nodejs.org.

1. Download this project. Use `git clone`, or on GitHub open the branch, then **Code → Download ZIP** and unzip it.
2. Open a terminal in the project folder and install the one dependency:

   ```bash
   npm install
   ```

3. Create your settings file:

   ```bash
   cp .env.example .env
   ```

   On Windows Command Prompt, use `copy .env.example .env` instead.

4. Open `.env` in any text editor and paste your Anthropic API key after `ANTHROPIC_API_KEY=`. You get one at https://console.anthropic.com under **API Keys**. Add a few dollars of credit, and set a monthly spend limit there too.
5. Start it:

   ```bash
   npm start
   ```

6. Open **http://localhost:3000**.

Without an API key the site still runs. The free stats and the sample raid work, and only the AI roast is disabled. To try the whole flow without spending anything, set `MOCK_AI=1` in `.env`.

### Use it from your phone on the same Wi-Fi

While `npm start` is running, find your computer's local IP address. On Windows run `ipconfig`. On a Mac, look in System Settings → Wi-Fi → Details. On your phone, open `http://THAT-IP:3000`, for example `http://192.168.1.5:3000`.

---

## Put it online (works from any phone, your computer can be off)

The easiest free option is **Render**:

1. Push this project to your GitHub repo. It's already there if you're reading this on GitHub.
2. Go to https://render.com, sign in with GitHub, then **New → Blueprint** and pick this repo. Render reads `render.yaml`.
3. When it asks for environment variables, paste your `ANTHROPIC_API_KEY`. Leave the Razorpay ones empty for now.
4. Click **Apply**. In a couple of minutes you get a link like `https://fbi-open-up.onrender.com`. Share it with your friends.

The free plan sleeps after 15 minutes without visitors. The first visit after that takes about a minute to wake up. The paid "Starter" plan stays awake.

Railway, Koyeb and Fly.io work the same way: the build command is `npm install` and the start command is `npm start`.

---

## Promo codes and the ₹5 paywall

The access rules live in `.env` locally, or in Render's **Environment** tab online.

| `ACCESS_MODE` | What happens |
|---|---|
| `free` (default) | Anyone can run the roast, up to `FREE_DAILY_LIMIT` per person per day. The site shows "~~₹5~~ FREE RIGHT NOW". |
| `promo_only` | Only people with a promo code can run the roast. Everyone else still gets the free stats. |
| `paid` | Each roast costs `PRICE_INR` through Razorpay. Promo codes stay free. |

- **Your promo code** is built in. It's stored as a fingerprint (a SHA-256 hash), not as plain text, so it isn't readable in the code. People enter it with the 🎟️ **Promo code** button. Their phone remembers it.
- **More codes for friends:** set `PROMO_CODES=GOA2026,BESTIE` (comma separated).
- **Every check happens on the server**, so nobody can skip the paywall by editing the page.

### Turning on Razorpay later

1. Create a Razorpay account. Under **Account & Settings → API Keys**, generate **test** keys first.
2. Set `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET` and `ACCESS_MODE=paid`, then restart or redeploy.
3. Try a test payment with Razorpay's test cards. When it works, swap in your **live** keys. Live keys need your account to be activated with KYC.

Payments are verified with Razorpay's signature check. Each payment unlocks one roast, and a failed roast can be retried with the same payment.

### Cost per raid (what you pay Anthropic)

| `CLAUDE_MODEL` | Approx. cost per raid | Notes |
|---|---|---|
| `claude-opus-5-5` (default) | ~₹25 | Funniest, sharpest writing |
| `claude-sonnet-5-5` | ~₹13 | Very good |
| `claude-haiku-5-5` | under ₹1 | Good, very cheap |

At ₹5 per raid you lose money on Opus and Sonnet. If you start charging, switch to `claude-haiku-5-5` or raise the price. While it's just you and your friends, Opus gives the best roasts.

---

## Privacy

- The chat file is opened and counted **in the browser**. The free stats never leave the device.
- For the AI roast, the browser sends a **sample** of messages (about 40,000 tokens) plus the stats. By default, names become "Suspect A, B, C", and phone numbers and emails are stripped. Real names are put back on your screen afterwards.
- The server stores nothing: no database, no accounts, no message logs.
- The prompt bans clinical diagnoses and roasts about looks, identity, religion, caste, money or trauma. It switches off romance analysis if the chat looks like it involves minors.

---

## Project layout

```
server/        Node server: static files + API (no framework)
  index.js     routes: /api/config, /api/promo, /api/pay/order, /api/analyze
  analyze.js   Claude call (structured JSON output)
  prompt.js    personas, spice levels, system prompt, JSON schema
  payments.js  promo codes, free-tier limits, Razorpay
  config.js    settings from .env
public/        the website
  js/parser.js WhatsApp / Telegram / Instagram parsers
  js/stats.js  local stats, badges, anonymiser, transcript sampler
  js/report.js renders the case file
  js/share.js  story-sized share card
  js/sample.js made-up sample chat + pre-written roast
test/          parser and stats tests (npm test)
blueprint/     the original design blueprint
```

Run the tests with `npm test`.

*For fun, not a psychological assessment. Not affiliated with any government agency.*

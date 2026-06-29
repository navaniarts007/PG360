# Putting PG360 behind Cloudflare (WAF + DDoS + rate limiting)

This lets you truthfully tell clients **"yes, we're behind Cloudflare"** and adds a
real firewall, bot protection and rate-limiting in front of Vercel.

> Time: ~20 minutes. You need access to the domain registrar for `pg360.software`.

## 1. Add the site to Cloudflare
1. Create a free account at https://dash.cloudflare.com → **Add a site** → `pg360.software`.
2. Choose the **Free** plan (enough for WAF managed rules, DDoS, rate limiting).
3. Cloudflare scans your current DNS records — review them.

## 2. Point your domain's nameservers to Cloudflare
1. Cloudflare shows two nameservers (e.g. `xxx.ns.cloudflare.com`).
2. At your **registrar** (where you bought pg360.software), replace the existing
   nameservers with Cloudflare's two. Save.
3. Wait for activation (minutes to a few hours). Cloudflare emails you when active.

## 3. DNS records (point the domain at Vercel, proxied)
In Cloudflare → **DNS**, make sure these exist and are **Proxied (orange cloud ON)**:

| Type | Name | Value | Proxy |
|------|------|-------|-------|
| CNAME | `pg360.software` (root / `@`) | `cname.vercel-dns.com` | Proxied ☑ |
| CNAME | `www` | `cname.vercel-dns.com` | Proxied ☑ |
| CNAME | `*` (wildcard, for client subdomains like `shanthi`) | `cname.vercel-dns.com` | Proxied ☑ |

> Keep the domain attached in **Vercel → Project → Settings → Domains** as well.
> Vercel will verify it; Cloudflare proxies traffic to Vercel.

## 4. SSL/TLS
1. Cloudflare → **SSL/TLS → Overview** → set mode to **Full (strict)**
   (Vercel serves a valid cert, so strict is correct and most secure).
2. **Edge Certificates** → enable **Always Use HTTPS** and **Automatic HTTPS Rewrites**.
3. Enable **HSTS** (we already send the header; Cloudflare can enforce it too).

## 5. Security / WAF
1. **Security → WAF → Managed rules** → enable the **Cloudflare Managed Ruleset**
   (blocks common attacks: SQLi, XSS, etc. — defense-in-depth on top of the app).
2. **Security → Settings** → Security level **Medium**; enable **Bot Fight Mode**.
3. (Optional) **Security → Settings → Challenge Passage** as default.

## 6. Rate limiting (brute-force protection on login)
**Security → WAF → Rate limiting rules → Create rule:**
- **Name:** Login throttle
- **If incoming requests match:** URI Path `contains` `/login` (and method `POST` if available)
- **Then:** Block (or Managed Challenge)
- **Rate:** e.g. **10 requests per 1 minute** per IP.

Add a second, looser global rule if you like (e.g. 200 req/min per IP to `/dashboard`).

## 7. Verify
- Visit `https://pg360.software` — should load normally (now via Cloudflare).
- `curl -sI https://pg360.software | grep -i "server\|cf-ray"` → you should see a
  `cf-ray` header, confirming Cloudflare is in front.
- Try ~15 rapid logins → the rate-limit rule should challenge/block.

## Notes
- This is **infra config only — no code change** in PG360. The app already sends
  HSTS + security headers and uses parameterized queries; Cloudflare adds the
  network-edge firewall + rate limiting the app can't do alone on serverless.
- The native apps (Android/Windows) load the same HTTPS site, so they benefit too.
- Cloudflare Free is sufficient to start; upgrade only if you need advanced rules.

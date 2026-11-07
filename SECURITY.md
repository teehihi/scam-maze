# Security Policy

## Supported versions

SCAMMAZE is under active development for Kiroween 2026. Only the latest commit
on `main` (deployed at <https://teehihi.github.io/scam-maze/>) receives security
fixes.

## Reporting a vulnerability

**Please do not open a public issue for security problems.**

1. Preferred: use GitHub's private reporting —
   [**Report a vulnerability**](https://github.com/teehihi/scam-maze/security/advisories/new).
2. Alternative: email **tee21052005@gmail.com** with the subject
   `[SCAMMAZE security]`.

Please include:

- what you found and where (file, URL path, component),
- steps to reproduce,
- the impact you expect,
- whether you want to be credited.

We aim to acknowledge reports within **3 days** and to share a fix plan within
**7 days**. We will credit reporters who want it once a fix is released.

## What is in scope

Because SCAMMAZE teaches people to judge links and messages, a bug that makes the
app give **false reassurance** is a security issue for us. Examples:

- The URL checker reports a link as "safe", or hides a warning signal it should
  show.
- Any code path that **fetches, loads, embeds or redirects to** a user-entered or
  scenario URL (analysis must be string-only).
- XSS or HTML injection through the URL checker, scenario content or any other
  input.
- A scenario that renders a real, clickable malicious link.
- Leaked secrets or API keys in the repository or the deployed site.
- Supply-chain issues in dependencies or the GitHub Actions workflow.

## Out of scope

- The URL heuristics missing a particular scam domain (false negatives are
  expected and documented). Please open a normal issue with a **defanged** URL
  instead (for example `hxxps://example[.]top/otp`).
- Reports that require a compromised device or browser.
- Missing security headers on GitHub Pages that we cannot configure.

## Handling malicious samples

Never send live malware, working phishing kits or real stolen credentials.
Defang URLs, and redact personal data from screenshots.

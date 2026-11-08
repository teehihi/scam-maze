---
inclusion: always
---

# Audience and positioning

Canonical product positioning: `docs/product/PRODUCT_POSITIONING.md` (read it before any product,
content or messaging work; it is not inlined here because of its length).

## Who we build for

SCAMMAZE serves **two primary audiences with equal weight**:

1. internet users aged 16+ in **Vietnam**, and
2. internet users aged 16+ **everywhere else**.

Secondary: educators and community groups in both. During the hackathon,
Kiroween judges (international, English-speaking) also need a clear demo.

Never design for one audience and "adapt" for the other.

## Rules for content and features

- **Teach the pattern, not the brand.** Core scenarios are built on tactics
  that exist everywhere (urgency, impersonation, too-good-to-be-true, OTP
  requests, off-platform payment, many small steps).
- **No country-specific assumptions in core content:** no real brands,
  currencies, phone or address formats, payment methods or reporting channels
  that only exist in one country. Put those in a region pack (tagged, for
  example `region: "vn"`), and only when asked.
- **Fictional companies and reserved addresses only** in scenarios and
  examples: `.test`, `.example`, `.invalid`, `example.com`, and documentation
  IPs `192.0.2.0/24`, `198.51.100.0/24`, `203.0.113.0/24`. Never use a real
  company name or a domain that someone could register.
- **Plain English** that works for non-native readers and for translation:
  short sentences, common words, no idioms or culture-specific references,
  explain acronyms once, complete sentences (no string concatenation).
- **Statistics on the site must cite a source** with a link, use the
  source's own wording, and must not be presented as SCAMMAZE results.
- **Never** blame victims or stereotype a group, and never use fear as the
  main motivator.

When a change would only make sense for one audience, say so in the pull
request and ask before merging.

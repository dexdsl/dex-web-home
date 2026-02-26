# BIMI (updates.dexdsl.com)

This folder contains BIMI assets sourced from the Dex `d` favicon mark.

## Files
- `dex-favicon.ico`: source favicon (`d` mark)
- `dex-logo.svg`: SVG logo candidate for BIMI `l=` pointer

## DNS records to add
1. DMARC for sending domain:
- Host: `_dmarc.updates.dexdsl.com`
- Type: `TXT`
- Value: `v=DMARC1; p=quarantine; adkim=s; aspf=s; rua=mailto:dmarc@dexdsl.com`

2. BIMI record:
- Host: `default._bimi.updates.dexdsl.com`
- Type: `TXT`
- Value: `v=BIMI1; l=https://updates.dexdsl.com/.well-known/bimi/dex-logo.svg; a=`

## Requirements
- SPF + DKIM must already pass for `updates.dexdsl.com`.
- DMARC must enforce policy (`p=quarantine` or `p=reject`) for broad BIMI support.
- For maximum mailbox support (for example Gmail avatar display), add a VMC and set `a=` to the certificate URL.

## Deployment note
If `updates.dexdsl.com` does not currently serve this repository's `docs` directory, publish these files on that host before enabling the BIMI DNS record.

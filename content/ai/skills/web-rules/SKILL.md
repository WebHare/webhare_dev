---
name: web-rules
description: Configure and secure URLs served by WebHare with web rules - siteprofile `siteSettings` `webRules` (YAML) and `<webrule>` in moduledefinition.xml. Use to add response headers (Content-Security-Policy, X-Frame-Options, CORS, Cache-Control), sandbox user-uploaded content, restrict paths by IP or user rights (ipAccessList, accessCheck), set error pages, or route a path to a router, folder or script. Covers path matching, rule priority, how headers from several rules combine, applying the configuration and verifying it with curl.
---

# Web rules

Web rules configure how WebHare's webserver handles a URL path: which headers it adds, who may access it and what
serves it. Every rule whose path matches a request applies, so a rule can add headers or access checks on top of
whatever normally serves that path.

Use a web rule for behavior that must apply to *everything* under a path, including static files that can't set
headers themselves. To set a header on a single page you render, set it in the page's response instead (see the
[web pages skill](../web-pages/SKILL.md)).

## Choose where to define the rule

- **Paths inside a site**: a siteprofile `siteSettings` entry with `webRules` (YAML). The rule's path is relative to
  the root of each site that the `siteSettings` entry matches. Prefer this for site content.
- **Paths outside any site, or on every host**: `<webrule>` in the `<backend>` section of `moduledefinition.xml`, eg.
  `/.mymodule/...` endpoints. `moduledefinition.yml` has no web rule section yet, so this is XML only.

## Siteprofile web rules (YAML)

```yaml
siteSettings:
  - site: My site                # or webRoot: { regex: ... } to match by URL
    webRules:
      - path: /*
        contentSecurityPolicy: frame-ancestors 'self' [webhare]
        headers:
          X-Content-Type-Options: nosniff
          Referrer-Policy: strict-origin-when-cross-origin
      - path: /intranet/*
        accessCheck:
          requireRight: mymodule:intranet
        ipAccessList:
          - deny: 0.0.0.0/0
          - deny: ::/0
          - allow: 192.0.2.0/24
          - allow: consilio-fetcher     # lets the search indexer in
        ipCheckIsSufficient: true     # an allowed IP skips the accessCheck
```

The schema (`mod::platform/data/schemas/siteprofile.schema.yml`, `WebRule`) also supports `cacheControl`,
`errorPath`, `router`, `priority` and `methods: "*"` (allow methods other than GET, POST and HEAD). See the
[siteprofiles skill](../siteprofiles/SKILL.md) for siteprofile files in general and the
[user rights skill](../user-rights/SKILL.md) for `accessCheck`.

Path matching:

- Ending in `*` with no other wildcards: matches everything under that prefix (`/intranet/*`).
- No wildcards: matches that exact path only.
- Other uses of `*` or `?`: wildcard match.

## Module definition web rules (XML)

```xml
<backend>
  <webrule path="allroots:/.mymodule/uploads/" match="initial" priority="after">
    <addheader header="Content-Security-Policy" value="sandbox" />
    <addheader header="X-Content-Type-Options" value="nosniff" />
    <tryfolder path="storage::mymodule/uploads/" />
  </webrule>
</backend>
```

The `path` prefix sets which hosts the rule applies to:

- `root:` - WebHare backend (interface) hosts only.
- `allroots:` - every host, including published sites.
- `outputroots:` - published sites only, not the backend.

`match` is `initial` (prefix), `exact`, `wildcards` or `cookie`. What serves the path is set by `router` (a
TypeScript router function), `handlebydir`, `<tryfolder>`/`<tryfile>` or `handlebyscript`. Other attributes include
`cachecontrol`, `allowallmethods`, `errorpath`, `requirewhaccount` and `allowips`. An `<accesscheck>` child restricts
access by rights. A `<csp policy="..."/>` child sets `Content-Security-Policy` and replaces `[webhare]` in the policy
(see below). The full list is in the `WebRule` type in `mod::system/data/moduledefinition.xsd`.

## How several rules combine

- All matching rules apply, ordered by priority: `before`, then the default, then `after` (or an integer: lower
  first). Within the same priority, rules for all hosts and prefix/exact matches come first.
- Headers are added in that order. A later rule's header **replaces** an earlier one with the same name, and an
  **empty value removes** it. WebHare uses this itself to drop restrictive headers on paths that must be framable:
  `<addheader header="X-Frame-Options" value="" />`.
- Rule headers are added before the content handler runs, so a router or script that sets the same header
  overrides the rule.
- In a CSP, `[webhare]` is replaced with the origins of the WebHare backend. Include `frame-ancestors 'self'
  [webhare]` in a site's policy, or the Publisher preview can't show the site in a frame.

## Securing URLs

- **User-uploaded or other untrusted content** (form uploads, files that visitors provide): serve it with
  `Content-Security-Policy: sandbox`. The browser then treats the file as a page in a unique origin, so a script
  inside an uploaded SVG or HTML file can't read the site's cookies or call its APIs. Also consider
  `Content-Disposition: attachment` for file types that don't need to display inline. WebHare's unified cache
  (`/.wh/ea/uc/`) is served with `sandbox`.
- **Clickjacking**: `frame-ancestors 'self' [webhare]` in the CSP (preferred), or `X-Frame-Options: SAMEORIGIN`.
- **Content sniffing**: `X-Content-Type-Options: nosniff`.
- **Restricting access**: use `accessCheck` / `<accesscheck>` for rights, and `ipAccessList` / `allowips` for
  networks. In an `ipAccessList` the *last* matching entry wins, so list the denies first and the allows after them.
  Without `ipCheckIsSufficient` (or `authmode="iporaccess"` in XML) a request must pass both the IP list and the
  access check.
- **CORS**: add `Access-Control-Allow-Origin` only where the content must be readable from other sites, and prefer a
  specific origin to `*`.

Before adding a strict header to a broad path such as `/*`, check what else is served there. A strict
`frame-ancestors` or `sandbox` can break the Publisher preview, embedded content or PDF viewing.

## Apply and verify

1. Validate the file: `wh validate <path to siteprofile or moduledefinition.xml>`.
1. Apply the configuration:
   - Siteprofile change: `wh apply siteprofiles webserver`.
   - `moduledefinition.xml` change: `wh apply webserver`.
1. Check the headers on a real URL, including a URL that doesn't exist (rules apply to 404 responses too):

   ```sh
   curl -sk -o /dev/null -D - https://<site>/<path> | grep -i -E '^HTTP|content-security|x-frame|access-control'
   ```

1. For access rules, check both an allowed and a denied request, eg. without cookies and from outside the allowed IP
   range.
1. Add an automated test that fetches the URL and checks the headers, so a later change can't silently drop them.

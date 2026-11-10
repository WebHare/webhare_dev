---
name: webdesign-frontend
description: "Set up the browser side of a WebHare webdesign: the assetPacks entry in moduledefinition.yml (entryPoint, supportedLanguages), structuring the asset pack entry point (CSS/SCSS imports, per-component and per-widget files, dompack.register), frontend texts with .lang.json and getTid, and passing typed data from the server to the browser with setFrontendData/getFrontendData and FrontendDataTypes. Use when adding frontend code or styles to a webdesign, widget or page, or when browser code needs server-side data."
---

# Webdesign frontend: asset packs and frontend data

The browser code and CSS of a webdesign are bundled into an **asset pack**. The webdesign's siteprofile
selects it (`webDesign.assetPack`) and `req.render()` in the page builder adds its `<script>` and `<link>`
tags to every page. Setting up the design and its page builder is covered by the
[webdesigns skill](../webdesigns/SKILL.md).

## Registering the asset pack

```yaml
# moduledefinition.yml
assetPacks:
  mysite:
    entryPoint: webdesigns/mysite/frontend/mysite.ts
    supportedLanguages: [nl, en]
```

```yaml
# the design's root siteprofile
apply:
  - to: all
    webDesign:
      assetPack: mymodule:mysite
```

- `supportedLanguages` lists the languages whose frontend texts are compiled in. Include every site language
  used with this design.
- Other modules can add code to an asset pack with `addToAssetPacks` in their `moduledefinition.yml`.
- See the `AssetPacks` definition in `mod::platform/data/schemas/moduledefinition.schema.yml` for the other
  options.

## The entry point

The entry point imports everything the design needs, CSS included. Registering a siteprofile doesn't load any
CSS or JavaScript, so every page, widget and component with frontend code must be imported here.

```typescript
// webdesigns/mysite/frontend/mysite.ts
import "@webhare/dompack/reset.css";
import "./mysite-vars.css";
import "./mysite.scss";
import "./mysite.lang.json";

import "../header/header";
import "../footer/footer";
import "../pages/search/search";
import "../widgets/faq/faq";
```

Keep the frontend code next to the server-side code of the same component (eg. `widgets/faq/faq.siteprl.yml`,
`faq.render.ts` and `faq.ts` + `faq.scss` for the browser), and have that component's file import its own
styles. The server-side render code must not be imported from the entry point.

Attach behavior to elements with `dompack.register` from `@webhare/dompack`. It runs the handler once for each
matching element when the DOM is ready. It doesn't watch the DOM: after inserting HTML yourself (eg. loaded
results), call `dompack.registerMissed(container)` to initialize the new elements:

```typescript
import * as dompack from "@webhare/dompack";
import "./faq.scss";

dompack.register<HTMLDetailsElement>(".widget-faq details", node => {
  node.addEventListener("toggle", () => { /* ... */ });
});
```

Check the asset pack after changes:

```bash
wh assetpack check mymodule:mysite   # compile errors
wh assetpack info mymodule:mysite    # status and last compile
```

Asset packs are recompiled automatically during development; `wh assetpack wait` waits for that to finish.

## Frontend texts

Frontend code uses the same `getTid` from `@webhare/gettid` as server code, but only texts that the asset pack
imports are available. Import them with a `.lang.json` file, listing the language-file sections per module:

```json
{
  "imports": {
    "mymodule": ["frontend.mysite"]
  }
}
```

```typescript
import { getTid } from "@webhare/gettid";
button.ariaLabel = getTid("mymodule:frontend.mysite.close");
```

Keep frontend texts in their own section of the module's language files, as everything in an imported
section is shipped to the browser.

## Passing data from the server

Pass data the browser needs (configuration, settings, links) with `setFrontendData` on the server and
`getFrontendData` in the browser, instead of putting JSON in `data-` attributes or inline scripts. Declare the
type once, in a file imported by both sides:

```typescript
// mysite.types.ts
declare module "@webhare/frontend" {
  interface FrontendDataTypes {
    "mymodule:mysite": {
      searchPage: string | null;
      showCookieBar: boolean;
    };
  }
}
```

```typescript
// server: in onRenderPage or onRenderContent
req.setFrontendData("mymodule:mysite", { searchPage, showCookieBar: true });
```

```typescript
// browser
import { getFrontendData } from "@webhare/frontend";

const settings = getFrontendData("mymodule:mysite"); // throws if missing
const pageData = getFrontendData("mymodule:searchpage", { allowMissing: true }); // null if this page didn't set it
```

- Keys must be `<module>:<name>`; TypeScript checks the data against the declared type on both sides.
- The data is serialized into the page (the `wh-config` script element), so it's public and part of the
  cached HTML. Don't put personal or secret data in it, and keep it small. For statically published pages
  it's fixed at publish time.
- Use `allowMissing` for data that only some pages set (eg. one page type or widget).
- `getSiteRoot()` from `@webhare/frontend` returns the site's root URL; no need to pass it yourself.
- Widgets rendered by a HareScript webdesign can't use `setFrontendData`.

## Verification

1. `wh assetpack check <module>:<assetpack>` reports no errors, and `wh checkmodule <module>` has no type
   errors.
1. Load a page and check the browser console for errors and missing frontend data or texts.
1. Test the page in every language listed in `supportedLanguages` that a site uses.

---
name: web-pages
description: "Build WebHare page types rendered by TypeScript: onRenderContent with ContentPageRequest and buildWebPage, how a URL is routed to a WHFS object and its renderer, static (bodyRenderer, published at publish time) versus dynamic pages (dynamicExecution, webRequest, query parameters, redirects, JSON responses), captureSubPaths with pageRoot/pageSubPath, workflow/contentlink-aware getInstance, preview modes, and page plugins such as wrdauth (initializePlugins, getPlugin). Use when adding a custom file or folder type that renders a page, or a search, listing or other dynamic page."
---

# Web pages: content renderers, static and dynamic pages

This skill covers rendering the **content** of a page. The surrounding page (header, navigation, footer,
`<head>`) is built by the webdesign's `onRenderPage`; see the [webdesigns skill](../webdesigns/SKILL.md).
Defining the types themselves and selecting objects with apply rules is covered by the
[siteprofiles skill](../siteprofiles/SKILL.md).

## Routing

1. WebHare looks up the URL and finds the published WHFS object: a file, or the index document of a folder.
   With `captureSubPaths`, deeper URLs are routed to the page as well (see below).
1. The object's type and the matching apply rules determine the content renderer:
   - `dynamicExecution.onRenderContent` on the type: a **dynamic** page, rendered for every request.
   - otherwise `bodyRenderer.onRenderContent` from the apply rules (often in the type's own `apply`): a
     **static** page, rendered when the file is published and served from disk.
   - no renderer: the page builder is called with empty content and may render the type itself.
1. WebHare creates a `ContentPageRequest` for the object and calls the content renderer. The renderer
   returns a `WebResponse`, usually from `req.buildWebPage(content)`, which calls the webdesign's
   `onRenderPage`.

`wh siteprofile dump-applies <object>` shows the rules applying to an object, including `bodyRenderer` and
`webDesign`.

## A content renderer

```typescript
import type { ContentPageRequest, WebResponse } from "@webhare/router";
import { litty } from "@webhare/litty";

export async function renderProductPage(req: ContentPageRequest): Promise<WebResponse> {
  const product = await req.getInstance("mymodule:files.product");
  const description = product.description ? await req.renderRTD(product.description) : null;
  return req.buildWebPage(litty`
    <div class="product">
      <p class="product__price">${product.price}</p>
      ${description}
    </div>`);
}
```

What the `ContentPageRequest` offers:

- `req.buildWebPage(litty)`: wraps the content using the design's `onRenderPage` and returns the response.
- `req.getInstance(type)`: instance data for this page. It takes the draft/historic version when previewing
  workflowed content, and takes data from the target of a contentlink when the type allows that. Don't read
  `req.targetObject`'s instance data directly.
- `req.targetObject` (the object at this URL), `req.targetFolder`, `req.targetSite`, `req.targetPath`,
  `req.siteLanguage`, `req.isLinkedContent` (rendering a contentlink).
- `req.renderRTD`, `req.renderWidget`, `req.resolveLink`: rich text, widgets and links. Always resolve
  internal links through `resolveLink` or `IntExtLink.resolve()` instead of building URLs.
- `req.pageMetadata` and `req.addStructuredData()`: page title, description, classes, structured data. See
  the metadata section of the [webdesigns skill](../webdesigns/SKILL.md).
- `req.setPageBuilderData()`: pass typed data to the page builder.
- `req.setFrontendData()`: pass typed data to the browser, see the
  [webdesign-frontend skill](../webdesign-frontend/SKILL.md).
- `req.webRequest`, `req.pageRoot`, `req.pageSubPath`: the HTTP request, for dynamic pages.
- `req.isPublisherPreview`, `req.isEditorPreview`: see below.

`getTid` uses the site's language. If a renderer sees the wrong language (eg. when you create a request
yourself with `createContentPageRequest`), call `req.applyToCurrentContext()`.

## Static pages

```yaml
types:
  files.product:
    metaType: page
    title: Product page
    clone: onDraft # editors work on a draft and publish it
    members:
      price:
        type: string
      description:
        type: richTextDocument
    apply:
      bodyRenderer:
        onRenderContent: product.render.ts#renderProductPage
```

A static page is rendered when it's published and the HTML is written to the output folder. This is the
default for content pages and the fastest to serve.

- `req.webRequest` is `null`: there is no URL, query string, cookie or visitor. Personalize in the browser
  instead.
- The response must be HTML (`text/html;charset=utf-8`), as produced by `buildWebPage`. Anything else (eg.
  a redirect or JSON) fails publication, and the status code is not used. Use a dynamic page for those.
- Output only changes when the page is republished. Content of other objects (listings, related items) that
  you include gets stale unless you add `republish` apply rules for the dependency, or load it in the
  browser.
- Pages are published as a directory (`/product/` with an index) unless the type sets
  `isPublishedAsSubdir: false`.
- `bodyRenderer` can also be set by apply rules to override the renderer for a built-in type, eg. a
  different renderer for rich documents in one folder. The last matching rule wins.

## Dynamic pages

```yaml
types:
  files.search:
    metaType: page
    title: Search page
    dynamicExecution:
      onRenderContent: search.render.ts#renderSearchPage
    apply:
      baseProps:
        noIndex: true
```

A dynamic page is rendered for every request, so `req.webRequest` is set:

```typescript
import { createRedirectResponse, type ContentPageRequest } from "@webhare/router";
import { litty } from "@webhare/litty";
import { throwError } from "@webhare/std";

export async function renderSearchPage(req: ContentPageRequest) {
  const url = new URL(req.webRequest?.url ?? throwError("Expected a dynamic request"));
  const query = url.searchParams.get("q") ?? "";
  if (url.searchParams.has("legacy"))
    return createRedirectResponse(req.pageRoot + "?q=" + encodeURIComponent(query));

  const results = query ? await runSearch(req.targetSite.id, query) : [];
  return req.buildWebPage(litty`
    <form method="get"><input name="q" value="${query}"></form>
    <ul>${results.map(hit => litty`<li><a href="${hit.link}">${hit.title}</a></li>`)}</ul>`);
}
```

- `WebRequest` offers `url`, `method`, `headers`, `clientIp`, `getCookie()`/`getAllCookies()` and
  `text()`/`json()` for the body.
- A dynamic renderer can return any `WebResponse`: `createRedirectResponse`, `createJSONResponse` or
  `createWebResponse` from `@webhare/router`, with any status code.
- Dynamic pages cost a render per request. Don't make a page dynamic just for one personalized element; use
  a static page with frontend code or an API (eg. an OpenAPI service) for that part.
- For APIs (JSON for frontend code), prefer an OpenAPI service ([openapi skill](../openapi/SKILL.md)) over
  a dynamic page.

### Subpaths

With `captureSubPaths: true` on a page type, all URLs below the page are routed to it, eg. `/products/` also
handles `/products/blue-chair/`:

- `req.pageRoot`: the URL of the page itself, ending with a slash.
- `req.pageSubPath`: the URL-decoded rest of the path after `pageRoot`, eg. `blue-chair/`. Empty for the page
  itself.

Return a 404 for subpaths you don't recognize. `buildWebPage` always uses the request's status code (200), so
to get a 404 inside the design, rebuild its response:

```typescript
const page = await req.buildWebPage(litty`<p>This product doesn't exist.</p>`);
return createWebResponse(await page.text(), { status: 404, headers: page.headers });
```

Use `pageRoot` instead of `targetObject.link` for
links within the page, as it's also correct in previews. Consider setting `req.pageMetadata.canonicalUrl` and
the title for each virtual page, and append the virtual page to `req.pageMetadata.breadcrumb`.

## Preview modes

- `req.isPublisherPreview`: rendering for the Publisher preview. URLs are below `/.publisher/preview/`;
  `pageRoot` accounts for that.
- `req.isEditorPreview`: rendering inside an editor (eg. a widget preview in the rich text editor). Show
  something static instead of interactive or tracking content.

## Page plugins

Plugins configured in siteprofile apply rules (eg. the wrdauth `auth:` settings) integrate with a page. A
content renderer must initialize them before use; the page builder doesn't need to, as `buildWebPage` does
that.

```typescript
await req.initializePlugins();
const auth = req.getPlugin("platform:wrdauth"); // null if not configured for this site
if (auth && await auth.isLoggedIn()) {
  const userId = await auth.getUser();
  // ...
}
```

The wrdauth plugin offers `isLoggedIn()`, `getUser()` (the WRD entity id), `getLogin()`, `getClaims()` and
`getLogoutLink()`. Pages using it depend on the visitor, so they must be dynamic.

## Verification

1. `wh validate` the siteprofile and TypeScript files; `wh checkmodule <module>` for type errors.
1. `wh siteprofile dump-applies <object>` for an object of the type: check `bodyRenderer` or the type's
   `dynamicExecution`.
1. Static pages: republish (`wh republish <objectid>`) and check the output, and the publication status for
   errors.
1. Dynamic pages: request the page with and without query parameters, an unknown subpath (for
   `captureSubPaths`) and in the Publisher preview (`wh whfs get-preview-link <path>`).

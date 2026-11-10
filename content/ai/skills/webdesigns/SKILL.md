---
name: webdesigns
description: "Set up and build a TypeScript WebHare webdesign: register it in moduledefinition.yml (webDesigns, assetPacks), configure the siteprofile webDesign apply rule (onRenderPage, assetPack, designFolder, maxContentWidth, minify, supportsErrors), write the onRenderPage page builder with PageBuildRequest and Litty (req.content, req.render, site settings, navigation, caching), use different page builders per section, page metadata and SEO (pageMetadata, openGraph, structured data, breadcrumbs, robots), and error pages. Use when creating a webdesign or changing how its pages are wrapped."
---

# TypeScript webdesigns

A webdesign turns a WebHare site into HTML pages. In a TypeScript webdesign:

1. The URL resolves to a WHFS object (file or folder index) in a site.
1. The object's type decides how its **content** is rendered: an `onRenderContent` function receiving a
   `ContentPageRequest`. See the [web-pages skill](../web-pages/SKILL.md).
1. That function calls `req.buildWebPage(content)`, which invokes the design's **page builder**: the
   `onRenderPage` function from the siteprofile. It receives a `PageBuildRequest`, wraps `req.content` in
   the header, navigation and footer, and calls `req.render()`.
1. `req.render()` produces the complete HTML document, including the `<head>` metadata and the asset pack's
   scripts and CSS.

Widgets and rich text are rendered with the narrower `PagePartRequest`, see the [widgets skill](../widgets/SKILL.md).
The frontend (asset pack, CSS, browser TypeScript) is covered in the
[webdesign-frontend skill](../webdesign-frontend/SKILL.md).

This skill doesn't repeat the [siteprofiles skill](../siteprofiles/SKILL.md): read it for type definitions,
apply rules (`to:` selectors), `editProps`, `baseProps`, `applySiteProfiles` and validation.

## Registration

In `moduledefinition.yml`:

```yaml
webDesigns:
  mysite:
    title: My site
    siteProfile: webdesigns/mysite/mysite.siteprl.yml

assetPacks:
  mysite:
    entryPoint: webdesigns/mysite/frontend/mysite.ts
    supportedLanguages: [nl, en]
```

- The webdesign name and the asset pack name are independent, but usually equal.
- `siteProfile` is the design's root siteprofile. Sites using this design get its rules; other siteprofiles
  are pulled in with `applySiteProfiles` from that root profile.
- `isTemplate: true` hides a design that only serves as a base for other designs. `isHidden` hides it from
  the design selection.
- Check the installed `mod::platform/data/schemas/moduledefinition.schema.yml` for all properties.
  `wh site list-webdesigns` lists the registered designs.

## The webDesign apply rule

The root siteprofile connects the design to its page builder and asset pack:

```yaml
gid: webdesigns.mysite
apply:
  - to: all
    webDesign:
      onRenderPage: render/mysite.render.ts#buildMySitePage
      assetPack: mymodule:mysite
      designFolder: .
      maxContentWidth: 960px
    siteLanguage: nl
    rtdDoc:
      rtdType: rtdtypes.default
    setMetadata:
      openGraph:
        siteName: My site
```

- `onRenderPage` is a `file#function` reference, relative to the siteprofile. It replaces the deprecated
  `pageBuilder` (renamed in WebHare 6.0) and the older `siteResponseFactory`/`SiteResponse` API. Setting
  `objectName` instead makes the design a HareScript design; a later rule specifying one replaces the other.
- `assetPack` is `<module>:<assetpack name>`.
- `maxContentWidth` (in `px`) limits the size of images in rendered rich text.
- `minify` (default `true`) minifies the `text/html` output of `onRenderPage`. Set it to `false` for pages
  whose exact output is compared, or debug with the `no-minify` debug flag.
- `supportsErrors` (default `true`) and `supportsAccessDenied` (default `false`) control whether error pages
  (see below) are rendered by this design.
- `webDesign` settings merge across matching rules, so a narrower rule can change only `onRenderPage`.
  Check the `ApplyWebdesign` definition in `mod::platform/data/schemas/siteprofile.schema.yml` for all
  properties.

Use `wh siteprofile dump-applies <object>` to see which rules (and therefore which page builder) apply to a
specific object.

## Writing the page builder

```typescript
import type { PageBuildRequest, WebResponse } from "@webhare/router";
import { litty } from "@webhare/litty";
import { whfsType } from "@webhare/whfs";

export async function buildMySitePage(req: PageBuildRequest): Promise<WebResponse> {
  const siteSettings = await whfsType("mymodule:site").get(req.targetSite.id);
  const isHome = req.targetObject.id === req.targetFolder.indexDoc && req.targetFolder.id === req.targetSite.id;
  if (isHome)
    req.pageMetadata.htmlClasses.push("page--home");

  return req.render({
    head: litty`<link rel="icon" href="/favicon.ico">`,
    body: litty`
      <header>${siteSettings.headerTitle}</header>
      <main>
        <h1>${req.pageMetadata.pageHeading}</h1>
        ${req.content}
      </main>
      <footer>${siteSettings.footerText}</footer>`
  });
}
```

What the `PageBuildRequest` offers:

- `req.content`: the Litty passed to `buildWebPage` by the content renderer. It can be empty: a file type
  without any content renderer calls `buildWebPage` with empty content, which allows the page builder to
  render such a type completely (eg. a listing for a folder type's index).
- `req.render({ head, body })`: builds the HTML document. It adds `<html lang>`, the `<title>`, metadata,
  the frontend configuration, the asset pack's `<script>`/`<link>` tags and structured data. Don't add those
  yourself. It returns the `WebResponse` with the request's status code.
- `req.targetObject`, `req.targetFolder`, `req.targetSite`, `req.targetPath` (site root to the current
  object, with `id`, `name`, `title` and `link`), `req.siteLanguage`.
- `req.getInstance(type)`: instance data of a WHFS type (members defined in siteprofiles) for the page. It
  picks the draft or live version and the contentlink target as needed. Use it instead of
  `whfsType(type).get(req.targetObject.id)` for page data. For data stored on other objects (eg. site
  settings on the root folder) use `whfsType(type).get(id)`.
- `req.renderRTD(rtd)`, `req.renderWidget({ whfsType, data })` and `req.resolveLink(intExtLink)` for rich
  text, widgets and links.
- `req.webRequest`: `null` for statically published pages. Don't build page-builder output that depends on
  it unless the page is dynamic, see the [web-pages skill](../web-pages/SKILL.md).
- `req.getPageBuilderData(key)`: data set by the content renderer, see below.
- `req.setFrontendData(key, data)`: data for the browser, see the
  [webdesign-frontend skill](../webdesign-frontend/SKILL.md).

Litty escapes interpolated strings. Interpolate Litty values (rendered RTDs, widgets, `req.content`) as-is,
and only use `rawLitty` for HTML you generated and trust. See the
[witty-to-litty skill](../witty-to-litty/SKILL.md) for Litty syntax. Use `getTid` from `@webhare/gettid` for
texts; it uses the site's language.

### Structure and caching

Keep the page builder split into a data part and a template part (eg. `mysite.render.ts` collecting data and
`mysite.litty.ts` with the Litty templates for header, footer and navigation).

Site-wide data such as navigation is the same for every page in a site. Cache it with `LocalCache` from
`@webhare/services`, keyed on the site (and language), and invalidate it with the folder's event masks
(`siteFolder.getEventMasks()`). See the [localcache skill](../localcache/SKILL.md).

Statically published pages are only regenerated when they are republished. Navigation or other content from
*other* objects that ends up in a static page can become stale. Use the siteprofile `republish` apply rule to
republish dependent pages, or load such content in the browser.

### Passing data from the content renderer

A content renderer can pass typed data to the page builder, eg. to override the header for a page:

```typescript
declare module "@webhare/router" {
  interface PageBuilderDataTypes {
    "mymodule:header": { title: string; image?: string };
  }
}

// in onRenderContent
req.setPageBuilderData("mymodule:header", { title: "Search results" });

// in onRenderPage
const header = req.getPageBuilderData("mymodule:header"); // undefined if not set
```

Keys must be `<module>:<name>`.

### Different page builders per section

Select a different `onRenderPage` with a narrower apply rule. A section-specific builder can add its own
metadata or content and then call the shared builder:

```yaml
apply:
  - to:
      is: index
      parentType: folders.news
    webDesign:
      onRenderPage: ./news.render.ts#buildNewsOverviewPage
```

```typescript
export async function buildNewsOverviewPage(req: PageBuildRequest): Promise<WebResponse> {
  const overview = await req.renderWidget({ whfsType: "mymodule:widgets.newslist", data: { maxItems: 20 } });
  return buildMySitePage(req, { afterContent: [overview] });
}
```

Give the shared builder an optional second parameter for such additions. The platform only passes `req`.

## Page metadata and SEO

`req.pageMetadata` is initialized before rendering and used by `req.render()`:

| Property | Initialized from | Notes |
| --- | --- | --- |
| `title` | The SEO title, the object's title, the folder title for an index | The `<title>` |
| `pageHeading` | The page heading SEO field or the object's title | Use for the `<h1>` |
| `description`, `keywords` | The object's description and keywords | |
| `canonicalUrl` | The canonical SEO setting or the object's link | |
| `robotsTag` | `noIndex`/`noFollow`/`noArchive` on the object, its parents and `baseProps` | Also `noImageIndex`, `noSnippet`, `unavailableAfter`, `custom` |
| `openGraph` | `setMetadata.openGraph` apply rules | Set `imageResource` to a `ResourceDescriptor` to get a resized share image |
| `structuredData` | A schema.org `BreadcrumbList` built from `targetPath` | Append with `req.addStructuredData(item)` |
| `breadcrumb` | | The `itemListElement`s of that `BreadcrumbList` |
| `htmlClasses`, `htmlDataSet`, `htmlDirection`, `viewport` | `setMetadata` apply rules | Attributes of the `<html>` element and the viewport `<meta>` |
| `dataLayer` | | Entries for the Google Tag Manager data layer |
| `consilioFields` | | Extra fields to index for Consilio search |

- Only fill in what isn't set yet (eg. derive a `description` from the content if it's empty), so editors
  can still override it.
- Which SEO fields editors see is controlled by `baseProps` in the siteprofile (eg. `seoTitle`,
  `pageHeading`, `seoTab`); see the [siteprofiles skill](../siteprofiles/SKILL.md).
- The breadcrumb skips the folder's index document and objects without a link. Use it for a visible
  breadcrumb too, so both stay consistent.
- Use the types from `SchemaOrg` in `@webhare/deps` for structured data, eg. `satisfies SchemaOrg.NewsArticle`.

## Error pages

When a site with a TypeScript design returns an error such as a 404, WebHare renders the error through the
design's page builder for the site's root folder (if `supportsErrors` is set, and for 401/403 only if
`supportsAccessDenied` is set). `req.content` then contains a generic error message,
`req.pageMetadata.title` is the error title and `htmlClasses` contains `wh-errorpage` and
`wh-errorpage--<code>`. The response uses the error status code.

Make sure the page builder works for this case: don't assume `req.targetObject` is a normal content page,
and use the classes to adjust the layout if needed.

## Verification

1. `wh validate` the siteprofiles and TypeScript files, and run `wh checkmodule <module>` for type errors.
1. Check that `wh siteprofile dump-applies <object>` shows the expected `onRenderPage` for representative
   objects (home page, sections with their own builder, normal pages).
1. Republish a static page and view it. Get a preview URL with `wh whfs get-preview-link <path>`.
   Check the `<head>` (title, description, canonical, Open Graph, `application/ld+json`) and the asset pack
   tags.
1. Request a nonexistent URL in the site and check the error page and its status code.

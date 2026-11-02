---
name: widgets
description: "Create or migrate WebHare widgets using YAML siteprofiles, TypeScript/Litty onRenderWidget renderers, and Tollium tabsextensions. Use for widget members, editor controls, rich-text rendering, design includes, and rendering TypeScript widgets from HareScript."
---

# WebHare widgets

## Registration and scope

Read a nearby widget and the consuming webdesign before editing. For new widgets,
prefer a `.siteprl.yml` definition and a TypeScript renderer returning Litty.
Keep Tollium editor markup in a separate `.screens.xml` file.
See the [siteprofiles skill](../siteprofiles/SKILL.md) for general YAML definitions,
apply rules, include scope, and XML-to-YAML conversion.

```yaml
types:
  widgets.example:
    tid: example:widgets.example.widgetname
    icon: tollium:files/widget
    metaType: blockWidget
    editor:
      tabsExtension: example.screens.xml#example
    onRenderWidget: example-frontend.ts#renderExample
    members:
      title:
        type: string
      description:
        type: richTextDocument
      buttonTitle:
        type: string
      buttonLink:
        type: intExtLink
```

- Without an explicit `namespace`, the type is identified by its module and key,
  e.g. `example:widgets.example`. Do not invent a URL namespace for a new widget.
  Preserve existing namespaces when migrating stored widgets.
- Type keys allow lowercase letters, digits, underscores, and dots, not hyphens.
  Filenames can still use hyphens.
- Use camelCase YAML member names such as `buttonTitle`; HareScript and Tollium
  use the corresponding snake_case name `button_title`. Do not put multiword
  snake_case member names into YAML: validation can reject ambiguous conversions.
- Include the profile from the intended webdesign's `applySiteProfiles` list (or its
  existing XML equivalent), not an unrelated legacy design.
- Import the widget CSS from that design's existing frontend asset entrypoint.
  Registering a siteprofile does not load CSS.
- `onRenderWidget` replaces legacy `renderer` and `wittyComponent` declarations
  when the entire widget is migrated. Remove obsolete renderer/template files
  only after checking their references.

## Editor

```xml
<screens xmlns="http://www.webhare.net/xmlns/tollium/screens"
         xmlns:p="http://www.webhare.net/xmlns/publisher/components"
         gid="widgets.example">
  <tabsextension name="example" implementation="none">
    <newtab>
      <textedit composition="contentdata" cellname="title" width="1pr" />
      <richdocument composition="contentdata" cellname="description"
                    width="1pr" height="3gr" rtdtype="example:rtdtypes.simple" />
      <textedit composition="contentdata" cellname="button_title" width="1pr" />
      <p:intextlink composition="contentdata" cellname="button_link" width="1pr" />
    </newtab>
  </tabsextension>
</screens>
```

Replace the example RTD type with an existing appropriate type or define one.
Keep labels in language resources under the editor's gid. For a finite set of
string values, use a pulldown with explicit rowkeys and an empty option when unset
is allowed. Internal rendering metadata can be stored as members without controls.
When moving an editor out of a siteprofile XML file, update both `tabsExtension`
and any direct `LoadTabsExtension` callers.

## TypeScript rendering

```typescript
import { litty } from "@webhare/litty";
import type { PagePartRequest } from "@webhare/router";
import type { TypedInstanceData } from "@webhare/whfs";

export async function renderExample(
  req: PagePartRequest,
  data: TypedInstanceData<"example:widgets.example">
) {
  const description = data.description ? await req.renderRTD(data.description) : null;
  const link = data.buttonLink ? await req.resolveLink(data.buttonLink) : "";
  return litty`
    <div class="widget-example">
      ${data.title ? litty`<h2>${data.title}</h2>` : null}
      <div class="wh-rtd">${description}</div>
      ${data.buttonTitle && link ? litty`<a href="${link}">${data.buttonTitle}</a>` : null}
    </div>
  `;
}
```

Litty escapes strings; interpolate rendered rich text as Litty, not raw HTML.
Resolve internal/external links through the request instead of concatenating URLs.
Use null to omit optional attributes. Keep non-visual hints in data attributes.
Use generated `TypedInstanceData` rather than duplicating the member contract or
casting to `any`. Regenerate configuration-derived bindings with `wh apply config`
if necessary; never edit generated types manually.

### Rendering from HareScript

Check the installed platform's `publisher/lib/widgets.whlib` (`__JSWidget`) and
`@webhare/router/src/corerouter.ts` (`renderTSWidgetHS`) before relying on the bridge.
The bridge reloads typed data by `whfssettingid` or `whfsfileid`; it does not
preserve arbitrary runtime changes to a HareScript widget record. It also requires
a database-backed instance.

If a caller adds runtime metadata (e.g. managed CTA targeting), explicitly pass
that metadata into a narrow TypeScript bridge. Load the typed instance by setting
ID, create the page request for the target object, merge only the intended
metadata, and call the same renderer. Use `littyToString` only at the string-output
boundary. Do not write transient metadata to stored content just to make the
standard bridge see it.

## Verification

1. Validate the siteprofile, screens, changed HareScript, and test files with
   `wh validate`; check TypeScript diagnostics.
2. Register new tests in the adjacent `testinfo.xml` before using `wh runtest`.
   Follow the `running-tests` skill and run tests serially.
3. Test stored field round trips and actual rendered HTML: escaping, rich-text
   formatting, resolved links, missing optional buttons, and runtime metadata.
4. Run existing affected tests and inspect desktop/mobile layouts for overflow.
   Verify managed visibility and positioning in the consuming design, not only
   isolated markup.

The HareScript test framework already opens the primary transaction. Do not call
`OpenPrimary` again. For tests using APIs that commit their own work, clean up
created objects in `FINALLY`; roll back unfinished work before invoking cleanup
APIs that start a new transaction, so cleanup does not mask the original error.

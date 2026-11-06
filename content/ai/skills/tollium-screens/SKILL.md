---
name: tollium-screens
description: "Build or change Tollium screens: screen XML (`<screens>`/`<screen>`), the HareScript screen object, lists (`<list>`, ongetrows, sorting, row classes), pulldowns (`<select>`), rowkeytype, filter bars and screen texts (tid/gid). Use when writing or debugging a Tollium screen, dialog or dashboard panel UI."
---

# Tollium screens

A Tollium screen is defined in a screen XML file and implemented by a HareScript object. This skill covers
building the screen itself. For registering a screen as a dashboard panel see the
[dashboard-panels skill](../dashboard-panels/SKILL.md); for HareScript conventions and calling TypeScript (eg. to
get the data a screen shows) see the [harescript-development skill](../harescript-development/SKILL.md).

## Screen file and object

```xml
<screens xmlns="http://www.webhare.net/xmlns/tollium/screens" gid="tolliumapps.orders" library="orders.whlib">
  <screen name="orderlist" tid=".title">
    <body spacers="none">
      <list name="orders" height="1pr" ongetrows="OnGetOrders" rowkeytype="entityid" selectmode="single">
        <column name="ordered" type="datetime" width="20x" storeutc="true" />
        <column name="customer" type="text" width="1pr" />
      </list>
    </body>
  </screen>
</screens>
```

- `library` (relative to the XML file) holds the implementation. Each `<screen name="...">` is implemented by an
  objecttype with the same name (matched case-insensitively), eg. `PUBLIC STATIC OBJECTTYPE OrderList EXTEND TolliumScreenBase`.
  Dashboard panels extend `DashboardPanelBase` instead.
- Set up the screen in `MACRO Init(RECORD data)`. Refer to components as `^name`, eg. `^orders->Invalidate()`.
- Handler attributes such as `ongetrows` and `onchange` name a function or macro of the screen object.

## Row keys and rowkeytype

Every row of a `<list>` and every option of a `<select>` has a `rowkey`. The component's value and selection are
row keys.

Always set `rowkeytype` on `<list>` and `<select>` (also `<listedit>`, `<chips>` and `<movetoselect>`) when you know
the type. It isn't strictly required, but without it Tollium has to derive the type from the rows or options, which
fails when there aren't any yet: reading `->value` of a `<select>` whose options are only set from code then throws
"This operation cannot be executed when there have never been rows in select ...". `wh validate` does not catch
this, you only see it when the screen opens.

Choose the value:

- `entityid` if the rowkey is a WRD entity id
- `fsobjectid` if the rowkey is a WHFS object id
- otherwise the HareScript type of the rowkey: `string`, `integer`, `integer64`, `boolean`, `datetime` or `money`

`entityid` and `fsobjectid` are stored as integers, but also tell Tollium what the id refers to: in a `<list>`
this offers users who are trusted to debug a debug action to open the row's entity or WHFS object.

## Lists

- Supply rows with `ongetrows="OnGetRows"`, a function returning a RECORD ARRAY with a `rowkey` cell and a cell per
  column `name`. Call `^list->Invalidate()` to have it called again, eg. after a filter changes. Alternatively,
  assign the rows directly to `^list->rows`.
- Columns need a `type` (eg. `text`, `integer`, `datetime`, `icon`) and usually a `width` (`20x`, `16px` or `1pr`
  for the remaining space). Use `storeutc="true"` on `datetime` columns: stored datetimes are UTC.
- Sort with `sortcolumn="<column>"` and `sortascending="false"` for descending order (eg. newest first).
- `borders` controls the frame around the list, eg. `borders="none"` for a list that fills a panel, or
  `borders="right"` when a column of buttons follows it.
- `selectmode` is `none`, `single` or `multiple`. `openaction="<action>"` runs an action on double-click.
- Style a row through a `listrowclasses` cell (STRING ARRAY) in the row. Only `grayedout`, `bold` and `italic` are
  styled by the list (see `tollium/webdesigns/webinterface/components/list/list.scss`); other class names have no
  visible effect.

## Pulldowns

```xml
<select name="statusfilter" type="pulldown" rowkeytype="string" onchange="onfilterchange" tid=".status">
  <option rowkey="" tid=".all" />
  <option rowkey="failed" tid=".failed" />
</select>
<select name="schemafilter" type="pulldown" rowkeytype="string" onchange="onfilterchange" tid=".schema" />
```

- Static options are `<option>` elements; set dynamic options from code as a RECORD ARRAY of `rowkey` and `title`:
  `^schemafilter->options := [[ rowkey := "", title := "" ], [ rowkey := "x", title := "X" ]];`.
  Assigning new options can change the value if it's no longer offered, so restore or check `->value` afterwards.
- An option with rowkey `""` is a convenient 'no filter' or 'all' choice for a string-keyed pulldown.

## Filter bar above a list

Put filters in a shaded panel above the list, and re-filter the list when they change:

```xml
<body height="1pr" spacers="none">
  <panel backgroundcolor="#f0f0f0" borders="bottom" spacers="left right">
    <line>
      <select name="statusfilter" type="pulldown" rowkeytype="string" onchange="onfilterchange" tid=".status">...</select>
    </line>
  </panel>
  <list name="items" height="1pr" borders="none" ongetrows="OnGetItems" ... />
</body>
```

If the data is expensive to get, load it once (eg. on refresh) into a member of the screen object and filter that
member in the `ongetrows` function, so a filter change doesn't reload it.

## Texts

The `gid` on `<screens>` is the text group of the screen. Texts are resolved in the module's `language/*.xml` files:

- `tid=".title"` is relative to the screen's gid (`tolliumapps.orders.title`)
- `tid="~id"` refers to the shared Tollium texts (`tollium:tilde.*`, eg. `~id`, `~properties`, `~subject`). Reuse
  these and existing texts of your module before adding new ones
- `tid="tolliumapps.common.schema"` (without a leading dot) is absolute within the module

Screens, columns and components without a `title` or `tid` default to a tid derived from their name, which
`wh validate` reports when that text doesn't exist (eg. "Missing tid from attribute 'name'"). Set `title=""` for
components that deliberately have no title, and add new texts to every language file of the module.

In code, use `this->GetTid(".status-" || status)` for texts relative to the screen's gid.

## Validation

1. Run `wh validate` on the changed screen XML, the library and the language files.
1. Open the screen in the browser. Some errors, such as a missing `rowkeytype` on a pulldown with options set from
   code, only show up at runtime.

The source of truth for elements and attributes is `tollium/data/screens.xsd`. Look at a nearby screen in the same
module for conventions, eg. `system/tolliumapps/dashboard/modules.xml` for a filter bar above a list.

---
name: tollium-iframe-components
description: "Build custom Tollium components that render their UI in an <iframe> with TypeScript: a HareScript TolliumFragmentBase wrapping an <iframe> component, InitializeWithAssetpack/UpdateInitData/Post/onclientmessage on the server side, and @webhare/tollium-iframe-api (setupGuest, Host, GuestProtocol, tolliumActionEnabler, showTolliumContextMenu, createTolliumImage, runSimpleScreen, getTheme, tollium.css) in the asset pack loaded into the iframe. Use when wrapping a JavaScript library (charts, diagrams, maps, editors) as a Tollium component or when debugging iframe <-> Tollium communication."
---

# Tollium iframe components

Tollium has no API for writing native client-side components in a module. To give a Tollium screen a UI built in
the browser (eg. a diagram drawn by a JavaScript library), wrap Tollium's `<iframe>` component in a fragment and load an
asset pack into it. The asset pack talks to the HareScript side through `@webhare/tollium-iframe-api`. Write a component
only when the component is reused in multiple screen - use a simple `<iframe>` in the screen otherwise.

A complete component consists of:

| File                                         | Purpose                                                                |
|----------------------------------------------|------------------------------------------------------------------------|
| `tolliumcomponents/<name>/<name>.xml`        | Fragment containing the `<iframe>`                                     |
| `tolliumcomponents/<name>/<name>.whlib`      | Component object (extends `TolliumFragmentBase`), the *host*           |
| `tolliumcomponents/<name>/<name>.ts`         | Asset pack entry point running inside the iframe, the *guest*          |
| `tolliumcomponents/<name>/<name>.css`        | Styling inside the iframe                                              |
| `tolliumcomponents/<module>components.xsd`   | XML element declaration so screens can use `<prefix:<name> ... />`     |
| `moduledefinition.yml` / `.xml`              | Asset pack registration and component namespace registration           |

The examples below follow the `mermaid` component of the `connect` module (`<c:mermaid>`, asset pack `connect:mermaid`),
reduced to the essentials. For writing the screens that use the component, see the
[tollium-screens skill](../tollium-screens/SKILL.md); for HareScript conventions see the
[harescript-development skill](../harescript-development/SKILL.md).

## How the protocol works

1. The HareScript component calls `^frame->InitializeWithAssetpack("<module>:<assetpack>", initdata)`. The browser loads
   an empty page (`/.wh/common/tollium/ap-iframe.html`) into the iframe, adds the `wh-config` and loads the asset pack.
1. The asset pack calls `setupGuest(init, endpoints)`, which sends `requestInit` to the host. The host replies with
   `init` carrying `initdata`; `setupGuest` calls your `init(context, initdata)`.
1. Messages the guest sends before `init` has completed are queued, as are messages the host `Post`s before the guest
   requested init. If `init` throws, the guest is blocked and ignores all further messages.
1. Server → guest: `^frame->Post("type", arg1, arg2, ...)` calls `endpoints.type(arg1, arg2, ...)` in the iframe.
1. Guest → server: `host.post("type", data)` calls the iframe's `onclientmessage` handler as
   `MACRO OnClientMessage(STRING type, RECORD data)`.

Important consequences:

- **`init` can run more than once.** `^frame->UpdateInitData(initdata)` sends a new `init` message to the running guest
  without reloading it, and the iframe is reloaded (and `init` runs again with the last initdata) whenever the browser
  reloads it, eg. when the component is moved in the DOM. Make `init` idempotent: create the UI only on the first call
  and apply the (new) initdata on every call.
- **Posted messages are not replayed after a reload.** Keep every piece of state the guest needs to rebuild itself
  (the data to show, configuration) in the initdata, and update it with `UpdateInitData`. Use `Post` only for
  incremental updates that are cheap to lose or that are also reflected in the initdata.
- Call `InitializeWithAssetpack` once (it reloads the iframe); use `UpdateInitData` for later changes.

## Registration

`moduledefinition.yml`: register the asset pack. The entry point is the TypeScript file loaded into the iframe.

```yaml
assetPacks:
  mermaid:
    entryPoint: tolliumcomponents/mermaid/mermaid.ts
    supportedLanguages: [en, nl]
```

`moduledefinition.xml`: register the namespace and schema for your components. This has no YAML equivalent.

```xml
<tollium>
  <components namespace="http://www.webhare.net/xmlns/connect/components"
              xmlschema="/tolliumcomponents/connectcomponents.xsd" />
</tollium>
```

The XSD declares the element and points it at the fragment. Attributes become cells of the record passed to
`StaticInit` (`tc:Handler` attributes become function pointers, `tc:ComponentRef` attributes become component objects):

```xml
<xs:element name="mermaid">
  <xs:annotation>
    <xs:appinfo>
      <tai:tolliumcomponent fragment="mermaid/mermaid.xml#mermaid" placement="block" />
    </xs:appinfo>
  </xs:annotation>
  <xs:complexType>
    <xs:attributeGroup ref="tc:ComponentBase" />
    <xs:attribute name="flags" type="tc:Flags" />
    <xs:attribute name="selectmode" type="s:SelectMode" default="single" />
    <xs:attribute name="onselect" type="tc:Handler">
      <xs:annotation><xs:appinfo><tai:callbacksignature /></xs:appinfo></xs:annotation>
    </xs:attribute>
    <xs:attribute name="openaction" type="tc:ComponentRef" />
    <xs:attribute name="selectcontextmenu" type="tc:ComponentRef" />
  </xs:complexType>
</xs:element>
```

The schema root declares `xmlns:tai="http://www.webhare.net/xmlns/tollium/appinfo"`, `tc` (tollium/common), `s`
(tollium/screens) and imports `mod::tollium/data/common.xsd` and `mod::tollium/data/screens.xsd`. Screens then use the
component as `<c:mermaid name="chart" ... />` with `xmlns:c="<your namespace>"`.

## Host side: fragment and HareScript object

```xml
<screens xmlns="http://www.webhare.net/xmlns/tollium/screens" library="mermaid.whlib">
  <fragment name="mermaid">
    <contents>
      <iframe name="mermaidframe" width="1pr" height="1pr" onclientmessage="onclientmessage" />
    </contents>
  </fragment>
</screens>
```

```harescript
<?wh
LOADLIB "mod::tollium/lib/screenbase.whlib";
LOADLIB "mod::tollium/lib/internal/components.whlib"; // GetComponentName

PUBLIC STATIC OBJECTTYPE Mermaid EXTEND TolliumFragmentBase
<
  RECORD graphdef;
  STRING graphdef_json;
  STRING ARRAY _selection;
  BOOLEAN initialized;

  PUBLIC PROPERTY value(graphdef, SetValue);
  PUBLIC PROPERTY selection(_selection, SetSelection);
  PUBLIC MACRO PTR onselect;
  PUBLIC OBJECT selectcontextmenu;

  UPDATE PUBLIC MACRO StaticInit(RECORD data)
  {
    TolliumFragmentBase::StaticInit(data);
    this->onselect := data.onselect;
    this->selectcontextmenu := data.selectcontextmenu;
  }

  UPDATE PUBLIC MACRO EnsurePostInit()
  {
    this->Regenerate();
  }

  // Menus referred to only from the iframe must be sent to the client explicitly
  UPDATE PUBLIC OBJECT ARRAY FUNCTION GetChildComponents()
  {
    RETURN ObjectExists(this->selectcontextmenu) ? [ this->selectcontextmenu ] : OBJECT[];
  }

  MACRO OnClientMessage(STRING type, RECORD message)
  {
    IF (type = "update" AND CellExists(message, "selection"))
    {
      // An empty JSON array arrives as a VARIANT ARRAY
      this->_selection := Length(message.selection) = 0 ? STRING[] : message.selection;
      IF (this->onselect != DEFAULT MACRO PTR)
        this->onselect();
    }
  }

  MACRO SetValue(RECORD value)
  {
    STRING encoded := EncodeJSON(value, [ "fromId", "toId" ]); // keep camelCase keys for the guest
    IF (encoded = this->graphdef_json)
      RETURN;
    this->graphdef := value;
    this->graphdef_json := encoded;
    this->Regenerate();
  }

  MACRO SetSelection(STRING ARRAY selection)
  {
    this->_selection := selection;
    ^mermaidframe->Post("update", CELL[ this->selection ]);
  }

  MACRO Regenerate()
  {
    RECORD initdata := CELL
        [ selectcontextmenu := ObjectExists(this->selectcontextmenu) ? GetComponentName(this->selectcontextmenu) : ""
        , this->graphdef_json
        ];
    IF (NOT this->initialized)
    {
      ^mermaidframe->InitializeWithAssetpack("connect:mermaid", initdata);
      this->initialized := TRUE;
    }
    ELSE
      ^mermaidframe->UpdateInitData(initdata);
  }
>;
```

Notes:

- HareScript cell names are lowercase, so records you `Post` or pass as initdata arrive with lowercase keys. Either use
  lowercase keys in the guest's types, or send a JSON string built with `EncodeJSON(value, translations)` and
  `JSON.parse` it in the guest (as `graphdef_json` above).
- Avoid redundant updates: compare new values against the current state before posting.
- Pass menus to the guest by name (`GetComponentName` from the internal `mod::tollium/lib/internal/components.whlib`)
  and return them from `GetChildComponents`, or the client won't know them.
- Other useful `TolliumIframe` members: `onenabledon` (see [actions](#actions-and-enableon)), `additionalcomponents`
  (also sends components to the client), `sandbox`, `SetViewport`/`ResetViewport`.
- Don't use the legacy members of the iframe component for new code: `CallJavascript` is incompatible with the
  Content-Security-Policy and will be removed; `PostMessage`/`PostRequest`, `onmessage`, `oncallback`/`DoCallback`,
  `data`/`ondata` and `toddiframeurl` belong to the older raw `postMessage` integration.

## Guest side: the asset pack

```typescript
import "@webhare/frontend/styling/reset.css";
import "@webhare/tollium-iframe-api/styling/tollium.css";
import { Host, setupGuest, type GuestProtocol, type HostContext } from "@webhare/tollium-iframe-api";
import "./mermaid.css";

// Messages the guest sends to the server: name -> data
interface MermaidHostProtocol {
  open: null;
  update: { selection?: string[] };
}

const host = new Host<MermaidHostProtocol>();
let chart: MermaidChart | null = null;
let updatingFromServer = false;

async function init(context: HostContext, initdata: { selectcontextmenu: string; graphdef_json: string }) {
  chart ??= new MermaidChart(document.body); // build the UI only once, init runs again on UpdateInitData
  await chart.render(JSON.parse(initdata.graphdef_json), { selectContextMenu: initdata.selectcontextmenu });
}

const endpoints: GuestProtocol = {
  // ^mermaidframe->Post("update", CELL[ selection ]) arrives here
  update: (data: { selection?: string[] }) => {
    updatingFromServer = true; // don't echo the change back to the server
    try {
      if (data.selection)
        chart?.setSelection(data.selection);
    } finally {
      updatingFromServer = false;
    }
  }
};

setupGuest(init, endpoints);
```

- Call `setupGuest` exactly once, at module level. `init` and endpoints may be async.
- Sending to the server: `host.post("update", { selection })`. `Host<P>` type-checks the message names and data.
- When a change originates from the server, don't post it back (the `updatingFromServer` flag above).
- The iframe page is empty: create all DOM in the guest. Use `@webhare/dompack` for DOM helpers if you like.
- Errors thrown by `init` block the guest; errors in endpoints are logged to the console and ignored.

## Integrating with the Tollium UI

All functions below are exported by `@webhare/tollium-iframe-api`.

### Styling and themes

- Import `@webhare/tollium-iframe-api/styling/tollium.css` for Tollium's font, colors and the `--tollium-*` CSS variables
  (eg. `--tollium-background`, `--tollium-text-color`, `--tollium-border-color`, `--tollium-padding`). Use these
  variables in your CSS so the component follows the active theme; they update automatically when the theme changes.
- `getTheme()` returns the theme as an object (eg. `fontFamily`, `fontSize`, `padding`, `colorAccent`, `name`). Listen to
  its `change` event (`theme.addEventListener("change", ...)`) when a library needs theme values in JavaScript, eg. to
  re-render a layout that depends on font size or padding.

### Actions and enableon

To let `<action enableon...>` in the screen depend on the selection inside the iframe:

1. In the guest, call `tolliumActionEnabler(selectionflags)` whenever the selection changes. Pass one record per
   selected item with its flags set to `true`, eg. `[{ editable: true }, {}]`; pass `[]` for no selection.
1. Make the fragment's actions check the iframe: return the iframe from `GetEnableOnComponent` and, for server-side
   checks, set `^frame->onenabledon` to a `BOOLEAN FUNCTION (INTEGER min, INTEGER max, STRING ARRAY flags,
   STRING selectionmatch)`. The `mermaid` component implements it with `CheckEnabledFlags` from the internal
   `mod::tollium/lib/internal/support.whlib`.

```harescript
UPDATE PUBLIC MACRO EnsurePostInit()
{
  ^mermaidframe->onenabledon := PTR this->EnabledOn;
  this->Regenerate();
}

UPDATE PUBLIC OBJECT FUNCTION GetEnableOnComponent()
{
  RETURN ^mermaidframe;
}
```

For a "double-click/Enter opens" action, let the guest `host.post("open", null)` and call
`this->openaction->TolliumClick()` in `OnClientMessage`.

### Context menus

- `showTolliumContextMenu(menuName, { x: event.clientX, y: event.clientY }, event)` opens a Tollium `<menu>` at a
  position relative to the iframe. With the `event` argument it honors ctrl+shift+right-click to show the browser menu
  instead. When you decide yourself which menu to show, call `requestedBrowserContextMenu(event)` first and stop if it
  returns `true`; it also prevents the browser menu otherwise.
- Call `closeAllTolliumMenus()` on clicks inside the iframe, as Tollium doesn't see those clicks.
- The menu must be known to the client: see `GetChildComponents` above.

### Images and dialogs

- `await createTolliumImage("tollium:objects/webhare", 16, 16, "c")` returns `{ src, width, height }` for a Tollium
  image; the last argument picks the `"b"`lack, `"c"`olor or `"w"`hite variant.
- `await runSimpleScreen("confirm", message, { title })` shows a Tollium message box and resolves to the clicked
  button's name (`"yes"`, `"no"`, `"ok"`). Types: `error`, `warning`, `info`, `verify`, `confirm`, `question`.

### Focus and keyboard

Focus is handled by the API: when Tollium focuses the iframe, the guest's last focused element is focused again. Make
interactive elements focusable (`tabIndex = 0`). Key events that bubble up to the iframe's `window` are forwarded to
Tollium, so screen shortcuts keep working. To handle a key yourself without Tollium also acting on it, listen on
`window` in the capture phase and call `event.preventDefault()` and `event.stopPropagation()` (as `mermaid` does for
Enter).

## Testing

- Dispatch an event on the parent window when the guest has finished an (async) render so tests can wait for it:
  `try { window.parent.dispatchEvent(new Event("mermaid:rendered")); } catch { }`, and in the test
  `test.getWin().addEventListener("mermaid:rendered", ...)`.
- In a frontend test, find the iframe component by its path through the fragment,
  `test.compByName("<component name>!<iframe name>")`, and query its `iframe` element to reach the guest document
  (`contentDocument`).
- See the [running-tests skill](../running-tests/SKILL.md) to run and debug tests, and the
  [test-users skill](../test-users/SKILL.md) to log in and check the component manually in a browser.

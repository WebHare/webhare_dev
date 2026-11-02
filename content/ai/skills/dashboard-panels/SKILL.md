---
name: dashboard-panels
description: "Create or troubleshoot WebHare Tollium dashboard groups and `<dashboardpanel>` registrations, backing screens, access checks, and refresh behavior."
---

# Dashboard Panels

Use this skill when adding a module-owned panel to the WebHare Dashboard, changing its group or visibility, or debugging why it is missing or fails to load. A dashboard panel is registered in the module's `moduledefinition.xml`, but its UI is an ordinary Tollium screen backed by a HareScript screen object.

## Register a panel

Declare groups and panels inside the module's `<portal>` element. A small registration looks like this:

```xml
<portal>
  <dashboardgroup name="reports"
                  orderafter="system:ap system:tasks"
                  tid="module.name" />

  <dashboardpanel name="summary"
                  group="reports"
                  screen="tolliumapps/dashboard/summary.xml#main"
                  tid="tolliumapps.dashboard.summary.title">
    <accesscheck>
      <requireright right="reports:view" />
    </accesscheck>
  </dashboardpanel>
</portal>
```

- `name` is required. The dashboard qualifies it with the declaring module, so `summary` becomes `yourmodule:summary`.
- `group` is optional and is qualified the same way when it names a local group. Use a qualified name such as `system:ap` to target a group from another module. If omitted or unknown, the panel is placed in `system:other`.
- `screen` is optional in the XML schema but should be supplied for a usable panel. An empty screen produces a selectable row without panel content.
- Supply `tid` or `title` for both group and panel labels. When both are present, `tid` takes precedence. Prefer module language-resource TIDs for user-facing labels.
- `<accesscheck>` controls whether the panel is included for the current user. Use it for authorization; do not rely on screen flags or a hidden control inside the screen as the registration's access check.

Groups can be ordered with space-separated `orderbefore` and `orderafter` values. They accept qualified group names and wildcard masks; use module-qualified names for groups owned elsewhere. Groups with no registered panels are omitted from the dashboard. Panels within each group are displayed alphabetically by resolved title.

The panel schema also accepts the common applicability attributes: `ifenvironset`, `unlessenvironset`, `postgresversion`, `webhareversion`, `minservertype`, `maxservertype`, `restrictservers`, and `ifmodules`. They determine whether the declaration applies on this WebHare. Use these only when the panel genuinely depends on that environment or server scope.

## Point to the Tollium screen

The `screen` reference is resolved relative to the declaring module. Common forms are:

```xml
screen="tolliumapps/dashboard/summary.xml#main"
screen="monitor/queues.queues"
screen="mod::othermodule/tolliumapps/dashboard/summary.xml#main"
```

The `filepath.screenname` shorthand resolves to `mod::<declaring-module>/screens/filepath.xml#screenname`; for example, `monitor/queues.queues` refers to `screens/monitor/queues.xml#queues`. Use an explicit XML path and fragment when that is clearer. A module-qualified shorthand such as `othermodule:monitor.queues` also resolves under that module's `screens/` directory.

The target screen must load to an object extending `DashboardPanelBase` (from `system/lib/screenbase.whlib`). The dashboard checks this when a panel is selected and throws if the loaded object does not extend the base class. Follow a nearby dashboard implementation for the screen XML `library`/screen-name binding and its HareScript object; do not implement a separate dashboard shell.

```harescript
LOADLIB "mod::system/lib/screenbase.whlib";
LOADLIB "mod::tollium/lib/screenbase.whlib";

PUBLIC STATIC OBJECTTYPE Summary EXTEND DashboardPanelBase <
  UPDATE PUBLIC MACRO RefreshDashboardPanel()
  {
    // Update the screen's data here.
  }
>;
```

## Refresh lifecycle

- The dashboard calls `RefreshDashboardPanel()` when the panel is selected and when it is manually refreshed.
- `DashboardPanelBase.GetSuggestedRefreshFrequency()` defaults to one second. Return `0` to disable interval refresh for a panel; the user's dashboard refresh toggle controls whether the suggested interval is used.
- `EnableRefresh()` and `DisableRefresh()` are called as the panel becomes active or inactive. Override them only when the panel needs to start or stop resources while selected.
- `ForceMonitorRefresh()` asks the containing dashboard to refresh immediately. The older `RefreshMonitorPanel()` entry point is retained by the base class for compatibility; new implementations should override `RefreshDashboardPanel()`.

Keep refresh work bounded and avoid unnecessary polling. If the screen is expensive to update, choose an appropriate frequency or return `0` and refresh on demand.

## Visibility and troubleshooting

When a panel is absent, check the owning module's `<portal>` declaration, its applicability attributes, the user's `<accesscheck>`, and whether its group exists. The parser qualifies local group names with the module name, puts panels with missing or unknown groups in `system:other`, and omits groups that end up empty. Check that the `tid` resolves and that the screen reference resolves to the intended XML screen and fragment.

When a panel is listed but blank, check for an empty `screen` attribute. When selecting it raises an exception, verify the loaded object extends `DashboardPanelBase` and that the screen reference points to the right screen object.

The XSD allows a panel-level `icon` attribute, but the current dashboard parser does not copy it into the panel record. Do not rely on it to display an icon without first verifying the behavior in the target WebHare version.

## Validation and source of truth

Run `wh validate` for the module after changing the declaration, screen XML, or HareScript implementation. For behavior changes, run the focused test that exercises the screen or dashboard path as well.

The key implementation references are:

- `system/data/moduledefinition.xsd` for the accepted `<dashboardgroup>` and `<dashboardpanel>` attributes.
- `system/lib/internal/moduledefparser.whlib` (`GetModuleDashboardInfo`) for qualification, screen resolution, and applicability parsing.
- `system/tolliumapps/dashboard/dashboard.whlib` (`SetupGroups`, `OnMonitorPanelsSelect`) for visibility, grouping, loading, and refresh dispatch.
- `system/lib/screenbase.whlib` (`DashboardPanelBase`) for the panel API and defaults.
- `publisher/moduledefinition.xml` and `system/moduledefinition.xml` for real registrations; `system/tolliumapps/dashboard/timedtasks.xml` and `.whlib` show a screen/object pair.

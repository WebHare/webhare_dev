---
name: user-rights
description: Define, check and grant WebHare user rights and roles. Covers `<rights>` in moduledefinition.xml (right, impliedby, objecttype, rightsgroup), global vs targeted rights, `<accesscheck>`/`<requireright>` on applications and dashboard panels, siteprofile requireRight/accessCheck, checking rights in TypeScript (getAuthorizationInterface, hasRight, hasRightOn) and HareScript (HasRight, HasRightOn, tolliumuser), roles, granting rights, and the built-in rights such as system:sysop, system:supervisor and platform:debug.
---

# User rights and roles

WebHare backend users get access through **rights**. A right is granted to a user directly, or to a **role** that is
granted to the user. Rights form a hierarchy: every right is *implied by* another right, so whoever has the implying
right has the implied right too. `system:sysop` is the root of the hierarchy and implies everything.

Rights are identified by a module-qualified name: `<module>:<right>`, eg. `system:sysop` or `publisher:pinning`.

## Built-in rights

Prefer an existing right if it matches what you're protecting. Commonly used ones:

| Right | Kind | Meaning |
| --- | --- | --- |
| `system:sysop` | global | Full management rights for this installation |
| `system:supervisor` | global | Manage the dashboard, monitor the server (implied by sysop) |
| `platform:debug` | global | Access to debugging options, eg. raw/debug features in Tollium (implied by sysop) |
| `platform:api` | global | Access to the WebHare Platform API (implied by sysop) |
| `system:fs_fullaccess` | on `system:fs_objects` | Full access to a WHFS folder/file and everything below it |
| `system:fs_browse` | on `system:fs_objects` | Browse a WHFS folder/file (implied by fs_fullaccess) |
| `system:manageunit`, `system:manageroles`, `system:browseunits` | on `system:units` | User management in a unit |

The full list is in the `<rights>` sections of the `system`, `platform` and `publisher` module definitions.

## Defining rights

Rights are only supported in `moduledefinition.xml` (there's no `moduledefinition.yml` equivalent yet):

```xml
<rights>
  <right name="manage" tid="rights.manage" descriptiontid="rights.manage-descr">
    <impliedby right="system:sysop" />
  </right>
</rights>
```

- Every `<right>` needs exactly one `<impliedby>`. An unqualified name refers to a right in the same module. Don't
  create cycles. Only a right with `isrootright="true"` may imply itself; that's for `system:sysop`, modules don't need
  it.
- `tid`/`descriptiontid` (or `title`/`description`) are shown in the user management app when granting the right.
- `rightsgroup="<module>:<group>"` places the right in a group in the user management app, eg. `system:fs` for rights
  related to the publisher. `showbefore`/`showafter` order rights within a group.

### Targeted rights

A right with an `objecttype` is granted on specific objects rather than globally. Define the object type in the same
`<rights>` section:

```xml
<objecttype name="worklists" table=".worklists" tid="rights.worklists"
            describer="lib/internal/support.whlib#worklistsdescriber" />
<right name="worklist_owner" objecttype="worklists" tid="rights.worklist_owner">
  <impliedby right="system:sysop" />
</right>
```

- `table` is the database table holding the objects. A leading `.` prefixes the module's own schema name.
- `parentfield` names the table's parent column if objects form a tree. A grant on an object then also applies to all
  objects below it.
- The `<impliedby>` right must be a global right or a right on the same object type.
- A grant without an object (object 0 in HareScript, `null` in the database) applies to all objects of that type.

### Activating a new or changed right

- The database registration of rights (`system.module_rights`) is updated at WebHare startup and by `wh softreset`.
  Until then, nobody has the new right: TypeScript checks for it return `false`.
- TypeScript reads the hierarchy from the generated `userrights` extract. `wh apply config` updates it. Without it
  TypeScript throws `No such right '<name>'`.

Errors in the hierarchy, such as an `impliedby` that doesn't exist, are reported when the module rights are
registered.

## Requiring a right in module definitions

Applications, dashboard panels and similar registrations take an `<accesscheck>`:

```xml
<accesscheck>
  <requireright right="system:sysop" />
</accesscheck>
```

- An empty `<accesscheck />` allows any logged in user.
- With more than one check, set `combine="and"` (all must match) or `combine="or"` (one must match). `combine` only
  defaults to `and` for a single check. `<accesscheck>`s can be nested to mix `and` and `or`.
- For a targeted right, `<requireright>` checks whether the user has the right on *any* object.

In YAML siteprofiles:

- `requireRight` on a metadata field (or on a debug settings option) restricts who can set it. A targeted right is
  checked against the WHFS object being edited. Debug settings options default to `system:sysop`.
- `accessCheck: { requireRight: ... }` on a web rule requires the wrdauth-authenticated visitor to have the right.

See the [siteprofiles skill](../siteprofiles/SKILL.md) and [dashboard panels skill](../dashboard-panels/SKILL.md).

## Checking rights in TypeScript

Use `getAuthorizationInterface` from `@webhare/auth` with the WRD entity id of the user:

```typescript
import { getAuthorizationInterface } from "@webhare/auth";

const auth = getAuthorizationInterface(userId);
if (!await auth.hasRight("platform:api"))
  throw new Error("Access denied");
if (!await auth.hasRightOn("system:fs_browse", folderId)) //or "all"/"any"
  throw new Error("Access denied");
```

- `hasRight` only accepts global rights, `hasRightOn` only targeted rights. Using the wrong one throws.
- `hasRightOn(right, "all")` requires the right on all objects (an object-less grant). `"any"` accepts a grant on any
  object.
- `filterRightOn(right, ids)` is the bulk version of `hasRightOn`. `getRootObjects(rights)` returns the objects the
  user has one of the rights on (or `"all"`), eg. to show their accessible root folders.
- Rights granted through roles are included. Roles that are closed or deactivated are ignored.
- In an OpenAPI handler using WRD API user authorization, the user id is `req.authorization.userId`. See the
  [OpenAPI skill](../openapi/SKILL.md).

## Checking rights in HareScript

HareScript user objects have `HasRight(right)`, `HasRightOn(right, objectid)`, `HasRightOnAny(right)`,
`HasRightOnMultiple(right, objectids)` and `GetRootObjectsForRights(rights)`. Get the user object from:

- `this->tolliumuser` in a Tollium screen, or `this->contexts->user` in a Tollium component.
- `GetEffectiveUser()` (`mod::system/lib/database.whlib`) elsewhere: the user under which the current code accesses
  the system. It's `DEFAULT OBJECT` if no user is set (eg. in tasks and scripts), so check `ObjectExists` first if
  that can happen.

```harescript
IF(NOT this->tolliumuser->HasRightOn("system:fs_fullaccess", this->fsobjectid))
  THROW NEW Exception("Access denied");
```

## Roles

A role is an entity of type `whuserRole` in a user management WRD schema. Rights are granted to the role, and the
role is granted to users. Roles are managed in the user management app, which requires `system:manageroles` (or
`system:sysop`) to grant them.

## Granting rights

Grants are normally made by users in the user management app. There's no TypeScript API to grant rights or roles
yet. For development and maintenance:

- `wh auth grant <userid> <right>` grants a global right to a user (by WRD id) in the primary user management schema.
- To verify a change as a user with specific rights or roles, create a temporary user with
  `wh test create-user --right <right> --role <role>`. Test users always get `platform:debug`. See the
  [test users skill](../test-users/SKILL.md).
- From code, use the HareScript `UpdateGrant(action, right, objectid, grantee, options)` and
  `UpdateRoleGrant(action, roleauthobjectid, grantee, options)` methods on a user object that is allowed to grant
  (see `mod::wrd/lib/auth.whlib` `GetWRDAuthUserAPI` to get user objects for a schema). Call them inside work. The
  granting user must have the right with grant option, unless you pass `allowselfassignment := TRUE` and the grantee
  is the granting user itself.

## Verifying

1. After adding or changing a right, run `wh apply config` and `wh softreset`, and check their output for errors.
1. Create a test user with only the new right (`wh test create-user --right <module>:<right>`) and one without it,
   and check that each user can or can't do what's protected. Both also have `platform:debug`, so don't imply the new
   right by `platform:debug` if you want this test to tell them apart.
1. Check that a sysop still has access through the implied-by chain.

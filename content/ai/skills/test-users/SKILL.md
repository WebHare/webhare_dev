---
name: test-users
description: Create temporary WebHare test users with specific rights or roles, and autologin links for them, using `wh test create-user` and `wh test create-link`. Use when you need to log in to the WebHare backend or a wrdauth-protected site to manually verify a change (eg. in a browser), without using or creating real accounts and passwords.
---

# Temporary test users

`wh test create-user` creates a short-lived user with the rights and roles you need, and optionally a link that logs
the user in without a password. Use it to check a change as a specific kind of user, such as a sysop or a user with
a single right, in the backend or on a site protected by wrdauth.

## Create a user

```bash
wh test create-user --right system:sysop --link https://my.webhare.dev/
```

Output (YAML; add `-j` or `--json` for JSON):

```yaml
wrdGuid: 961dbdb4-589a-431c-a18c-a2108e9c14d7
username: test3@beta.webhare.net
loginLink: https://<this installation>/.wh/auth/testlogin/<session id>
```

Options:

- `--right <right>`: grant a global right, eg. `system:sysop`. Repeat for more rights. See the
  [user rights skill](../user-rights/SKILL.md) for the available rights. Test users always get `platform:debug`
  (access to debugging options), so you don't need to pass it.
- `--role <role>`: grant a role, by its wrdTag or title. Repeat for more roles.
- `--schema <tag>`: create the user in another WRD schema. Defaults to the primary user management schema (the one used
  to log in to the WebHare backend).
- `--link <url>`: also create a login link for this URL (see below). `loginLink` is only in the output if you pass it.

The user gets the login and email address `test<number>@beta.webhare.net` and a random first and last name. It's
placed in the "Test Users" unit (wrdTag `WEBHARE_TEST_USERS`), which is created when needed. The user has no password.

Test users are closed at the time a login started now would expire, which by default is early next morning. There's
no need to clean them up. Create a new user if you need one later.

## Create a login link

To log in as an existing test user, create a link for it:

```bash
wh test create-link test3 https://my.webhare.dev/
```

The user can be given as its wrdId, its wrdGuid, its full login (`test3@beta.webhare.net`) or just `test3`. Only
users in the test users unit are accepted. The output has the same fields as `create-user`.

Opening `loginLink` sets the login cookies and redirects to the URL you gave. A link:

- can be opened more than once, so you can use it in multiple browsers, until the user expires.
- must point to a URL that logs in using the same WRD schema as the user. For the backend this is the primary user
  management schema. A site using its own wrdauth schema needs `--schema` with that schema's tag.
- can start with `https://my.webhare.dev/`, which refers to the local installation: it's replaced with the backend URL
  of the installation you run the command on.

Open the link in the browser you're testing with, then continue from the page it redirects to. See the
[running tests skill](../running-tests/SKILL.md) for browser verification.

## Link to a specific place in a backend application

Use an in-app path to make a link open a backend application at the screen, tab or list row you want to test. Use it
when you open an application yourself in a browser, and when you give the user a link to try a change. In-app paths
work for every test user. Application parameters (`?app=<application>(<parameters>)`) don't: most applications only
accept them from users with `system:sysop`, as parameters often bypass access checks.

The format is `?app=<application>[/<step>][/<step>...]`. The steps run in order after the application has started:

- `<name>` triggers the action named `<name>`, eg. to open a dialog or switch to a screen.
- `<list>=<rowkey>` selects the row with that rowkey in the list named `<list>`.

For example:

- `?app=system:dashboard/monitorpanels=wrd:payments` opens the dashboard and selects the row `wrd:payments` (the
  "Recent payments" panel) in the list `monitorpanels`.
- `?app=system:webservers/bindings/bindinglist=877` opens the webservers application, triggers its `bindings`
  action, and then selects the row with rowkey 877 in `bindinglist`.

Find action and list names in the `name` attributes of the application's screen definitions (the `.xml` file
referenced by the application in its `moduledefinition.xml`). Rowkeys are set by the screen's code, so check
where it fills the list's rows. For lists showing entities or files the rowkey is usually the id.

Pass the full URL as the link, eg.

```bash
wh test create-user --right system:supervisor --link 'https://my.webhare.dev/?app=system:dashboard/monitorpanels=wrd:payments'
```

In-app paths require the `platform:debug` right (or the `tollium:trustparams` debug flag). An application opened with
an in-app path that the user can't use ignores the path and opens normally, without an error.

## Restrictions

- Both commands refuse to run on a server with DTAP stage `production`.
- User creation and login links are recorded in the schema's audit log (`platform:testuser-created` and
  `platform:login`).

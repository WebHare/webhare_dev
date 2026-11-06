---
name: build-modernize-tests
description: Build new, extend or modernize existing TypeScript tests
---

## Basic test setup
Tests to run are passed as an array to `test.runTests()`. This array
should consist of strings (naming further tests) or (async) functions to run. (old test code may pass an object instead, but this should be modernized)

Tests should import the `test` object from either `@webhare/test` (always works), `@webhare/test-frontend` (if running in the browser) or `@webhare/test-backend` (if running in node).

Tollium frontend tests should additionaly import `@mod-tollium/js/tolliumtest` as `tt` for additional APIs that allows manipulating Tollium applications in the frontend. Tollium tests in the webhare_testsuite module may import `@mod-webhare_testsuite/js/tolliumtest-wts.ts` as `tt` instead - which wraps and exports all of `@mod-tollium/js/tolliumtest`

Old tollium tests may keep using `@mod-tollium/js/testframework`

A string before a function sets that test's name. When no string is given, the function's own name is used
as the name, so don't add a string that just restates the function name: `"testFeature", testFeature` adds
nothing over `testFeature` on its own. Use a string only when it carries more than the function name does — a
fuller description of what is verified — or to name a function that otherwise has no usable name, such as an
anonymous or `.bind()`-ed function.

It's okay to have multiple function calls between strings in the array passed to runTests.

Eg

```typescript
test.runTests([
  setup,

  testCreateUser,
  testUpdateUser,

  "Granting a role the user cannot manage is refused",
  testRoleGrantPermissions,

  "logs in and redirects to the target", login.bind(null, "/target"),
]);
```

Keep an empty line above any string element in the array except the first for readability

Test functions should be defined in the source file in roughly the same order as they are passed to `test.runTests()`
(or `RunTestframework()` in HareScript tests), so the file reads top to bottom in execution order. When adding a new
test function, insert it at the position matching where it's added to the array.

## Structuring a test function into stories
A test function that goes through several steps should be split into stories: each one a scenario
that verifies one behavior. Start each story with a header comment:

```typescript
async function testPeerServerToken() {
  const testsite = await test.getTestSiteJS();

  ////////////////////////////////////////////////////////////////
  // STORY: Request a token, registering ourselves as a dynamic client at the remote
  const { requesturl, tokenpromise } = await getPeerServerTokenURL(testsite.webRoot);
  ...

  ////////////////////////////////////////////////////////////////
  // STORY: Verify the token gives us access to the WebHare API as the user that approved it
  ...
}
```

- Use a line of slashes, then `// STORY: <description>`. Phrase the description as what happens or what's verified
  ("Deleting the client invalidates its registration token"), not as a section name ("Cleanup checks").
- Put shared setup (looking up the test site, opening schemas) before the first story.
- A story can rely on state left by the stories before it. Keep them in the order they happen.
- Use stories for the steps inside a test function. Use separate functions in `test.runTests()` for independent
  areas that you might want to run, or see fail, separately.
- Put a short comment above the test function saying what it verifies overall, especially if the setup is unusual
  (eg. "We act as our own peer: the testsite is the 'remote' WebHare").
- When you extend an existing test, add a new story or test function rather than mixing new checks into an
  unrelated story.

## Key Testing Functions

### test.eq(expected, actual[, annotation])

```typescript
test.eq("expected-value", actualValue, "Expected to match because...");
```

**Important:** Order is `expected` first, then `actual`!

Write annotations only if they clarify why we want a test to succeed or why we want it to fail. Don't
simply parrot the expected and actual values in the annotation - leave the annotation out if it doesn't add any information.

`test.eq` requires the type of the values to match (like strict equality). Objects are deep compared, not
by identity. Date and Temporal types are supported and compared by value. `test.eq` also understands regular expressions in the expected value, so you can use it to check if a string matches a certain pattern.

### test.assert(condition[, annotation])

```typescript
test.assert(result !== null, "Result should not be null");
test.assert(array.length > 0, "Array should not be empty");
```

The expression passed to `test.assert` is asserted to TypeScript and can narrow down types. For example, if you have a variable `result` that can be `string | null`, you can use `test.assert(result !== null)` to narrow down the type of `result` to `string` in the code that follows.

Prefer test.eq over test.assert if this type narrowing is not needed, because test.eq will give better error messages by showing the expected and actual values.

### test.throws(pattern, function[, annotation])

```typescript
await test.throws(/Cannot load/, loadNonExistent());
test.throws(/read only/, () => { frozen.prop = "x"; });
```

### test.eqPartial(expected, actual[, annotation])

```typescript
test.eqPartial({ status: "success" }, response);
test.eqPartial({ id: 1, name: "Test" }, user);
```

test.eqPartial is like test.eq but only checks the properties specified in the expected object. This is useful when you want to check that certain key properties of an object have specific values, without needing to specify the entire object structure.

### test.sleep(ms)

```typescript
await test.sleep(20);
```

sleeps the specified number of milliseconds.

### test.wait(fn[, annotation])

```typescript
await test.wait(() => Math.random() > 10);
```

waits until the provided function returns a truthy value.

### test.qS/qSA/qR<ElementType = HTMLElement>([element,] selector)

- test.qS finds the first element matching the CSS selector. It returns null if no element matches. Optionally a starting point can be provided as the first parameter, in which case the search will be performed within that element instead of the whole document.
, test.qSA finds all elements matching the CSS selector. It returns an array of elements, which may be empty if no element matches. Suports an optional starting point as the first parameter.
- test.qR finds the first element matching the CSS selector. It throws if no element matches or if more than one element matches. Suports an optional starting point as the first parameter.

All three functions support the a type parameter to specify the expected type of the element(s) being returned, for example `test.qS<HTMLDivElement>(".my-div")`. This allows TypeScript to infer the correct types for the returned elements and provide better type checking and autocompletion. By default a HTMLElement type is used. Use this type parameter instead of `as`. Don't use a type parameter where the default HTMLDivElement would suffice

## Tollium tests

### tt.comp(name, { allowMissing: true})
Looks up a component by its name. If the component cannot be found and the allowMissing option is set to true, it returns null - otherwise it throws.

If the name is prefixed with `:` it will look up by label instead, eg `tt.comp(":Edit")`.

## Modernizing tests
Some TypeScript tests are old and may even disable linting or typescript checking. You can modernize these tests by fixing the underlying issues and removing any `/* eslint-disable */` and/or `// @ts-nocheck` comment located at the top of the file.

**Focus and scope:**
- When there is a selection, work on the selected code. Otherwise work on the file or test area named in the prompt arguments.
- Stay focused on removing legacy waiting behavior; do not do unrelated refactors.

**Core principles:**
- Preserve the original test intent and coverage.
- Replace implicit waiting with explicit `await`-based interactions, state checks, or event-driven synchronization.
- Prefer existing modern patterns already used in nearby WebHare tests.
- Keep actions and their explicit waits in the same step (do not split them across multiple steps).

Take the following conversion guidelines into account:
- Try to fix any other typescript or linting errors. If you cannot fix an error, prepend a comment with `TODO: ` and a description of the issue and how to fix it, so that a human can easily find and fix it later.
- Remove any `/* eslint-disable */` and/or `// @ts-nocheck` comment located at the top of the file. Fix the underlying issues instead.

Specific guidelines for modernizing selectors and simple waits:
- If a `test.qS` causes a TypeScript 'Object is possibly null' error, and the code seems to assume `test.qS` will always return exactly one result, replace `test.qS` with `test.qR`. `test.qR` will throw if it doesn't find exactly one match.
- `test.eq` understands a regexp in the first parameter, so replace any `test.eqMatch` call with `test.eq`
- replace `test.wait("ui")` with `test.waitForUI()`
- replace `test.wait("load")` with `test.waitForLoad()`
- replace `test.getDoc().querySelector<HTMLElement>(selector)` with `test.qS<HTMLElement>(selector)`
- replace `<element>.querySelector<Type>(selector)` with `test.qS<Type>(<element>, selector)` (the start node comes first)
- if sendMouseGesture is invoked without `await`, add it. Make the test function async if it isn't already.

**Removing legacy `waits:[]` and `waitforgestures` patterns:**
- When replacing `waitforgestures`, do not add `await test.wait("pointer")`; instead add `await` to the final `test.sendMouseGesture(...)` call that the legacy flag was covering.
- When replacing `waits: ['pointer', ...]` on a step that ends in `test.sendMouseGesture(...)`, add `await` to that final gesture call instead of introducing a separate pointer wait.
- Do not split a `loadpage` step and its legacy wait into two separate steps. Rewrite it as a single async step that does `await test.load(...)` and then performs any explicit waits needed in that same step.
- Do not split helper wrappers and their waits into separate steps either. If a helper call such as `test.testSelectListRow(...)` or `test.testClickTolliumButton(...)` carried a legacy `waits` option, inline the action so the action and explicit wait stay in the same step.
- Prefer `await test.waitForUI()` for legacy `['ui']`, but if validation shows the step never becomes busy, remove that UI wait instead of forcing one in.
- Convert other legacy waits mechanically when they are straightforward:
  - callback/function waits → `await test.wait(...)`
  - numeric waits → `await test.sleep(...)`
  - `'events'` → `await test.wait("events")`
  - `'animationframe'` → `await test.wait("animationframe")`
  - `'pageload'` → the API supported by the local test framework in that file
- If a legacy wait encodes a real timing dependency, rewrite the test so the dependency is expressed through a concrete observable condition.
- If no safe replacement is evident, stop and explain the ambiguous case instead of guessing.

Do *not* introduce helper functions that wrap repetitive one-liners. If the original code was repetitive keep it that way.

## Validating and running tests
- Run `wh validate <filename>` on every touched file to check it for lint errors. For TypeScript files this only runs the linter: it does *not* report type errors.
- Run `wh runtest <test name or full path>` to verify touched test files when a focused test can be run.
- `wh checkmodule <modulename>` validates everything in a module, including the TypeScript type check, and runs some cross-consistency checks. It's slow, so use it once after you've finished with a module rather than after every change. It is required after removing `// @ts-nocheck`, as that is the only way to see the type errors this uncovers.
- Do not use `tsc` or `npm test` for this.

In Tollium tests:
- replace `test.getCurrentScreen().getListRow(<list component name>, <regex>)` with `tt.comp(<list component name>).list.getRow(<regex>)`
- replace `test.clickTolliumButton("<label>")` with `tt.comp(":<label>").click()`
- try replacing `test.compByName('<component>')` or `test.getCurrentScreen().getToddElement('<component>')` with `tt.comp('<component>').node` - if the test doesn't fail, you can be pretty sure the component is a Tollium component and should be accessed through `tt` instead of `test`.

Old tests may pass objects to runTest. These should be replaced with strings and functions. Waits in the objects should be rewritten to their proper 'await test...' call.

Keep the action and its replacement wait in the same rewritten function. Do not split a `loadpage` plus waits object into a later wait-only step, and do not split helper wrappers from the waits that used to belong to the same object.

Eg the following legacy object passed to runTests

```
    {
      name: "move_2_dragdown_check",
      test: function () {
        ...code...
      },
      waits: ['ui','load']
    }
```

must be rewritten as two separate array elements:

```
    "move_2_dragdown_check",
    async function () {
      ...code...
      await test.waitForUI();
      await test.waitForLoad();
    }
```

leave out the string element if the test had no 'name'.

If a legacy object calls a helper such as `test.testSelectListRow(...)` or `test.testClickTolliumButton(...)` and also had waits, inline the underlying action so the action and explicit wait remain in the same function.

remove any `doc` and `win` parameters accepted by the old test function. Replace them to calls to `test.getDoc()` and `test.getWin()`.

The `'pointer'` element in a `waits:` array can be removed - an `await` should be added to the last `sendMouseGesture`.

Tests that are already in the function format but still accept a `(doc,win)` parameter should still be rewritten to remove those two parameters and replace them by calls to `test.getDoc()` and `test.getWin()`.

Don't turn a function into async unless needed because you had to add `await` calls at the end of the test.

## Summary of changes

After modernizing a test file:
- Briefly summarize what legacy waits were removed and what explicit synchronization replaced them.
- Call out any remaining cases that need manual judgment.

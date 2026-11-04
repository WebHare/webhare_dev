---
name: witty-to-litty
description: "Convert a Witty (.witty) template to a TypeScript Litty (.litty.ts) template using @webhare/litty. Use for migrating Witty components, embeds, forevery loops and gettid calls to TypeScript."
---

# Convert Witty to Litty

Witty is the template language for HareScript and uses files with a `.witty` extension. Its TypeScript replacement is
`@webhare/litty`: a `litty` tagged template literal that escapes interpolated values. See the `@webhare/litty` README
for the full API.

Unless otherwise directed, create the new file next to the original with `.witty` replaced by `.litty.ts`, eg
`template.witty` becomes `template.litty.ts`.

## Litty rules that affect the conversion

- Interpolated strings are escaped. Nested `Litty` values (returned by `litty`) and arrays of them are inserted without
  being escaped again.
- So every function replacing a component must return `litty`...`` - not a plain template string, which would be
  escaped when interpolated.
- Accept `LittyValue` for slots that may contain either text or another template (such as `[body]`).
- Return `Litty` values from rendering functions; only call `littyToString` where a string must be output.

## Structure

Witty code can contain components (between `[component name]` and `[/component]`) which can be embedded with
`[embed name]`. Code outside a component is the main template.

For example this Witty code:

```
[component mycomponent]
  field: [value]
[/component]

[component mycomponent2]
  field2: <b>[value2]</b>
[/component]

<div>Witty test!</div>
[embed mycomponent]
[embed mycomponent2]
[body]
```

becomes:

```typescript
import { litty, type Litty, type LittyValue } from "@webhare/litty";

function mycomponent(value: string): Litty {
  return litty`field: ${value}`;
}

function mycomponent2(value2: string): Litty {
  return litty`field2: <b>${value2}</b>`;
}

export function myTemplate(data: {
  body: LittyValue;
  value: string;
  value2: string;
}): Litty {
  return litty`
    <div>Witty test!</div>
    ${mycomponent(data.value)}
    ${mycomponent2(data.value2)}
    ${data.body}
  `;
}
```

## Naming

- Camel case component names when converting them into functions, eg `[component pretty_header]` becomes
  `function prettyHeader`. Convert parameter and field names to camel case as well.
- Name the entrypoint (`myTemplate` above) after the original file name, camel cased, with `Template` appended. Eg
  `my-file.witty` gets `myFileTemplate`.
- The functions replacing the components `htmlhead` and `htmlbody`, if present, must be exported. Name them after the
  file, eg `myFileHead` and `myFileBody` for `my-file.witty`.

## Embeds referring to other files

An embed containing a colon refers to a component in another file, eg `[embed ./header/header.witty:header]`. Assume it
refers to a `header` function exported from `./header/header.litty.ts`: add
`import { header } from "./header/header.litty.ts";` and replace the embed with `${header(data)}`. Offer to convert those
other files as well if they have not been converted yet.

## gettid

Replace `[gettid ...]` with a call to `getTid` from `@webhare/gettid`, eg `[gettid module:user.id]` becomes
`${getTid("module:user.id")}`.

If the tid is not prefixed with a module name and a colon (ie `some.text` instead of `module:some.text`), prefix it with
the module name of the original file. To find the module name, look upwards through the folder tree for the nearest
folder containing `moduledefinition.xml` or `moduledefinition.yml`; that folder's name is the module name (see the
[directory structure skill](../directory-structure/SKILL.md)). Eg in
`webhare_module/webdesigns/example_site/example_site.witty` the tid must be prefixed with `webhare_module:`.

## forevery

Replace a `[forevery]...[/forevery]` loop with a `map` returning `litty` templates. Do not `join` the results: Litty
renders arrays in order without separators, while a joined string would be escaped. For example:

```
  [forevery alt_languages]
    <link rel="alternate" hreflang="[language]" href="[link]" />
  [/forevery]
```

becomes

```typescript
  ${data.altLanguages.map(lang => litty`
    <link rel="alternate" hreflang="${lang.language}" href="${lang.link}" />
  `)}
```

Always quote attribute values, as in the example above.

## Verify

Check the new file with the editor's TypeScript diagnostics, and if the template is covered by a test, run it as
described in the [running-tests skill](../running-tests/SKILL.md). See the [widgets skill](../widgets/SKILL.md) for
using Litty in widget renderers.

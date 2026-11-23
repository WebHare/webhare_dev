---
name: consilio
description: Set up, reindex and troubleshoot Consilio search catalogs in WebHare modules. Covers catalogs and fieldgroups in moduledefinition.xml, adding sites with addToCatalogs, extra page fields with pageMetadata.consilioFields, reindexing from the command line with wh consilio:manualindex, applying field mapping changes with wh consilio:update, and finding indexing errors such as OpenSearch mapper_parsing_exception. Use for site search, frontend search, search indexes, "reindex the search", or why a page isn't (correctly) indexed.
---

# Consilio

Consilio is WebHare's search engine layer on top of OpenSearch. A module defines **catalogs** (a search index plus
its field mapping). A managed catalog is filled from **content sources** (eg. a site or folder), each content
source provides **groups** (for a site: one group per WHFS object, with the object id as group id), and each group
holds one or more indexed **objects** (for a site: the pages of that file, keyed by URL).

Indexing normally happens in the background: when a file is republished, the background indexer reindexes its
group. You only need to act yourself when you change the catalog setup, or to reindex or debug content.

## Defining a catalog

Catalogs and their fields are defined in `moduledefinition.xml` (there is no YAML equivalent yet):

```xml
<consilio>
  <catalog tag="sitesearch" fieldgroups="sitesearchfields consilio:sitecontent" lang="nl" />
  <fieldgroup tag="sitesearchfields">
    <keyword name="category" />
    <record name="image">
      <keyword name="src" />
      <integer name="width" />
    </record>
  </fieldgroup>
</consilio>
```

- The catalog's full name is `<module>:<tag>`, eg. `mymodule:sitesearch`. Use that name with the search APIs and
  the commands below.
- Field types include `text` (tokenized), `keyword` (exact match), `integer`, `integer64`, `money`, `float`,
  `boolean`, `datetime`, `record` and `nested`. The source of truth is the `Catalog` and `FieldGroup` types in
  `mod::system/data/moduledefinition.xsd`.
- To remove a catalog, replace its `<catalog>` with `<obsoletecatalog tag="..."/>`.

## Adding a site

Add the site (or part of it) as a content source in its siteprofile, under `siteSettings`:

```yaml
siteSettings:
  - addToCatalogs:
      - catalog: mymodule:sitesearch
        folder: /news/     # optional: only index this subfolder
```

See the [siteprofiles skill](../siteprofiles/SKILL.md) for siteprofile structure. Each site content source
indexes the published pages of every file below its folder.

To index extra fields with a page, fill `pageMetadata.consilioFields` in the page builder or a widget (see the
[webdesigns skill](../webdesigns/SKILL.md)):

```typescript
req.pageMetadata.consilioFields.category = "news";
req.pageMetadata.consilioFields.image = { src: imageUrl, width: 640 };
```

Every field must exist in the catalog's fieldgroups **with the same shape**: a value sent for a `record` field
must be a record, and a plain value must not go to a `record` field. A mismatch makes indexing of that page fail
(see [Troubleshooting](#troubleshooting)). The TypeScript type of `consilioFields` only accepts nested records in
newer WebHare versions: check whether `@webhare/router` exports `ConsilioFieldValue`. Older versions only allow
string, number, boolean and string array values.

## Reindexing from the command line

### `wh consilio:manualindex`

Indexes (part of) a catalog directly in your shell, instead of queueing it for the background indexer:

```bash
wh consilio:manualindex [--debug] [--limit <num>] [--breakonerror] [--listgroups] <catalogmask> [contentsourcemask] [groupmask]
```

- `catalogmask`: catalog name, wildcards allowed (`mymodule:*`). Required.
- `contentsourcemask`: limits indexing to matching content sources, matched against their tag or title, or `#<id>`
  for a content source id. Defaults to all. Site content sources usually have no tag, so use `#<id>` for those:
  the id is listed on the Consilio tab of the Publisher's Inspect dialog for any file in the site.
- `groupmask`: limits indexing to matching groups. For site content sources the group id is the WHFS object id, so
  `wh consilio:manualindex mymodule:sitesearch '#12' 4567` reindexes just file 4567.
- `--listgroups`: list the groups that would be indexed, without indexing anything.
- `--debug`: print every object as it's fetched, so you can see which page fails.
- `--limit <num>`: stop after this many groups.
- `--breakonerror`: stop at the first group that fails, with the full exception, instead of printing the error and
  continuing.

For every group it fetches the objects, sends them to OpenSearch, and removes documents that no longer exist. When
it indexed a whole content source (no `groupmask` and no `--limit`), it also cleans up groups that no longer exist.

A failing group is printed as `Errors indexing '<groupid>': <error>` and makes the command exit with code 1. These
errors are only printed, not logged.

Examples:

```bash
# reindex everything in the catalog (usually one site)
wh consilio:manualindex mymodule:sitesearch

# reindex one site in a catalog with several sites
wh consilio:manualindex mymodule:sitesearch '#12'

# see which page of file 4567 fails
wh consilio:manualindex --debug mymodule:sitesearch '#12' 4567
```

### `wh consilio:update`

Applies catalog configuration and field mapping changes to the indices. WebHare does this itself (in the
`consilio:update` timed task) after module configuration changes, so you normally only need it when that failed
or an index has to be rebuilt:

```bash
wh consilio:update [--zapbroken] [--zapanymismatch] [--verbose] [catalogmask]
```

- `--zapbroken`: recreate (empty) any index the configuration can't be applied to.
- `--zapanymismatch`: recreate any index whose fields don't match, even if it still looks usable.

Recreating an index empties it: run `wh consilio:manualindex` afterwards, or wait for the background indexer.
OpenSearch can't change the type of an existing field (eg. from `keyword` to `record`), so such a change needs
`--zapanymismatch`.

## In the backend

- **Publisher, Inspect dialog, Consilio tab** of a file: the pages Consilio extracts from it, the content sources
  and catalogs it's part of, *Reindex* (queues the file for the background indexer), *Inspect in Consilio* (what's
  stored in the index) and *Inspect source* (computes the documents without storing them). Newer WebHare versions
  also have *Index now*, which indexes the file in the selected content source right away and shows any error.
- **Consilio catalog management** application: catalogs, their content sources, indexing status and the last
  errors per content source.

## Troubleshooting

- **The search doesn't find a page**: check on the Consilio tab of the Inspect dialog that the file is part of the
  catalog's content source and that it has pages; then reindex it with `wh consilio:manualindex`.
- **`mapper_parsing_exception`**, eg. `object mapping for [image] tried to parse field [image] as object, but found
  a concrete value`: the page sends a field with another shape than the catalog maps it with. Here the catalog
  defines `image` as a `record`, but the page sent a plain value. Fix the value in `consilioFields` (or in a custom
  content source), or change the fieldgroup and run `wh consilio:update --zapanymismatch <catalog>`.
- **Where background indexing errors end up**: exceptions while indexing a group are logged to the notice log
  (context `consilio:fetcher`; `wh watchlog` shows new entries). Failures to list a content source's groups also
  appear under that content source's errors in the Consilio catalog management application, but that list is kept
  in memory (at most 5 per content source) and is lost when WebHare restarts. To reproduce an error on demand, run
  `wh consilio:manualindex` on the group.

// @ts-nocheck -- Bulk rename done by wh devkit:es2ts

import Prism from 'prismjs';

Prism.languages.harescript = Prism.languages.extend("javascript", {
  "keyword": {
    pattern: /\b(DELETE|FUNCTION|INSERT|MACRO|SELECT|ALL|AS|ASC|AT|BY|CELL|COLUMN|CLASSTYPE|CROSS|DEFAULTSTO|DESC|DISTINCT|END|EXCEPT|EXPORT|EXTEND|EXTENDSFROM|FALSE|FROM|FULL|GROUP|HAVING|INDEX|INNER|INTERSECT|INTO|JOIN|KEY|LIMIT|MEMBER|NEW|NULL|NVL|OFFSET|ONLY|ORDER|OUTER|PROPERTY|SET|TEMPORARY|TRUE|UNIQUE|USING|VALUES|VAR|VARTYPE|WHERE|LOADLIB)(?=\(|\b)/i
  },
  "attribute": {
    pattern: /\b(CONSTANT|DEINITMACRO|DEPRECATED|EXECUTESHARESCRIPT|EXTERNAL|INTERNALPROTECTED|ISCOUNT|NOSTATEMODIFY|READONLY|SKIPTRACE|SPECIAL|TERMINATES|VARARG)(?=\(|\b)/i,
    alias: "important"
  },
  "control": {
    pattern: /\b(AWAIT|BREAK|CASE|CATCH|CONTINUE|ELSE|FINALLY|FOR|FOREVERY|IF|GOTO|RETURN|SWITCH|THROW|TRY|WHILE|YIELD)(?=\(|\b)/i,
    alias: "keyword"
  },
  "modifier": {
    pattern: /\b(AGGREGATE|ASYNC|CONSTANT|DEFAULT|PRIVATE|PTR|PUBLIC|STATIC|UPDATE|__ATTRIBUTES__)(?=\(|\b)/i,
    alias: "keyword"
  },
  "type": {
    pattern: /\b(ARRAY|BLOB|BOOLEAN|DATETIME|FIXEDPOINT|FLOAT|FUNCTION PTR|INTEGER|INTEGER64|MACRO PTR|MONEY|OBJECT|OBJECTTYPE|RECORD|REF|SCHEMA|STRING|TABLE|VARIANT|WEAKOBJECT)(?=\(|\b)/i,
    alias: "symbol"
  },
  "globalvar": {
    pattern: /([^-][^>])\^|this/i,
    lookbehind: true,
    alias: "number"
  },
  "operator": [
    /\+|:=|!|-|&(gt|lt|amp);|\||\*|=|\^/,
    /(\b(AND|BITAND|BITLSHIFT|BITNEG|BITOR|BITRSHIFT|BITXOR|CONCAT|IN|LIKE|NOT|OR|TYPEID|XOR)(?=\(|\b))/i
  ],
  "number": /\b(\d+(\.\d+)?(e(\+|-)?\d+)?(f|d|i64)?|0x[\da-f]+)\b/i,
  "constant": null // undefine from javascript
});

Prism.languages.insertBefore("harescript", "string", {
  "template-string": {
    pattern: /`(?:\\[\s\S]|\${[^}]+}|[^\\`])*`/,
    greedy: true,
    inside: {
      "interpolation": {
        pattern: /\${[^}]+}/,
        inside: {
          "interpolation-punctuation": {
            pattern: /^\${|}$/,
            alias: "punctuation"
          },
          rest: Prism.languages.harescript
        }
      },
      "string": /[\s\S]+/
    }
  }
});

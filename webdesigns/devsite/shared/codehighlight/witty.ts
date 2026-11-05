// @ts-nocheck -- Bulk rename done by wh devkit:es2ts

import Prism from 'prismjs';

Prism.languages.witty = Prism.languages.extend("html", {
  "rawcomponent": {
    pattern: /\[rawcomponent[\s\n]+(\w+)[\s\n]*\][\s\S]*?(?:\[\/rawcomponent\]|$)/i,
    greedy: true,
    inside: {
      "keyword": {
        pattern: /rawcomponent/i
      }
    }
  },
  "witty": {
    pattern: /\[([^\]]*)\]/,
    inside: {
      "comment": {
        pattern: /(\[)![^!]*!(?=\])/,
        lookbehind: true
      },
      "keyword": {
        pattern: /\b(if|else|elseif|forevery|repeat|component|embed|embedoriginal|gettid|gethtmltid|not)\b/i
      },
      "modifier": {
        pattern: /(:)\b(none|java|xml|value|html|xhtml|url|base16|base64|cdata|json|jsonvalue)\b/i,
        lookbehind: true,
        alias: "symbol"
      },
      "wittyvar": {
        pattern: /\b(first|last|odd|even|seqnr)\b/i,
        alias: "number"
      },
      punctuation: /[.[\]]/
    }
  }
});

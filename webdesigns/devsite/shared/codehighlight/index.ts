import Prism from 'prismjs';
import "prismjs/components/prism-bash";
import "prismjs/components/prism-typescript";
import "prismjs/components/prism-json";
import "prismjs/components/prism-clike";
import "prismjs/themes/prism-okaidia.css";

import "./harescript";
import "./witty";

import * as dompack from 'dompack';

const fallbackLanguage = 'clike';

Prism.hooks.add('before-sanity-check', function (env) {

  //language set at all, and to something we know?
  const langRegEx = /\blanguage-(\w+)\b/i;
  const match = langRegEx.exec(env.element.className);
  if (match) {
    const targetLang = match[1].toLowerCase();
    if (Prism.languages[targetLang])
      return;
    env.element.classList.remove(`language-${targetLang}`);
  }

  env.element.classList.add(`language-${fallbackLanguage}`);
  env.language = fallbackLanguage;
});

//TODO remove manual mode above, and just render proper output from harescript ?
dompack.register('code', node => {
  if (node.closest("p,li"))
    return; //this is not a block level <code>

  let wrapper = dompack.closest(node, 'pre');
  if (!wrapper) {
    //wrap inside a <pre>
    wrapper = document.createElement('pre');
    wrapper.classList.add("line-numbers");
    //replace softbreaks with plain linefeeds
    dompack.qSA(node, 'br').forEach(el => el.parentNode!.replaceChild(document.createTextNode('\n'), el));
    node.parentNode!.insertBefore(wrapper, node);
    wrapper.appendChild(node);
  }

  let lang = [...node.classList].filter(c => c.startsWith('language-')).map(c => c.substring(9))[0] || '';
  if (!lang || !Prism.languages[lang]) {
    node.classList.remove(`language-${lang}`);
    if (wrapper)
      wrapper.classList.remove(`language-${lang}`);

    lang = fallbackLanguage;
    node.classList.add(`language-${fallbackLanguage}`);
    if (wrapper)
      wrapper.classList.add(`language-${fallbackLanguage}`);
  }
  node.innerHTML = Prism.highlight(node.textContent, Prism.languages[lang], lang);
});

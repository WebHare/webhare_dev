/* eslint-disable */
// @ts-nocheck -- Bulk rename done by wh devkit:es2ts

import "./search.scss";

import * as dompack from "dompack";
import * as whintegration from "@mod-system/js/wh/integration";
import JSONRPC from "@mod-system/js/net/jsonrpc";
import consiliosearch from "@mod-consilio/js/internal/search.rpc.json";
import * as encoding from "dompack/types/text";
import getTid from "@mod-tollium/js/gettid";

/*
  cSearchSuggest
    suggest container is inserted in end of search form
  options: catalog: string , consilio catalog name
           rpc: boolean    , switch when option is selected then plain submit or just fire submit event for rpc
*/
class cSearchSuggest {
  constructor(inputnode) {
    this.inputnode = inputnode;

    this.options = JSON.parse(inputnode.getAttribute("data-suggest"));

    if (!this.options.catalog) {
      console.warn("No catalog set");
      return;
    }

    this.formnode = dompack.closest(this.inputnode, "form");

    this.history = [];

    document.body.addEventListener("click", ev => {
      if (!this.suggestwrapper)
        return;

      const chknode = dompack.closest(ev.target, "form");
      if (!chknode || chknode != this.formnode)
        this.removeSuggestions();
    });

    this.words = this.inputnode.value;
    this.inputnode.addEventListener("keyup", ev => {
      if (this.suggestwrapper && ev.keyCode == 40) { //down 40, up 38
        ev.preventDefault();
        this.suggestwrapper.querySelector("li").focus();
      }

      if (this.updatetimer)
        clearTimeout(this.updatetimer);

      let inpval = this.inputnode.value;
      if (inpval.trim)
        inpval = inpval.trim();

      if (inpval != this.words)
        this.updatetimer = setTimeout(ev => this.updateList(inpval), 200);
    });

    this.inputnode.addEventListener("search", ev => this.removeSuggestions());//case search clear field
  }

  async updateList(words) {
    this.words = words;

    const minwordlength = 3;

    //first check if we have already suggestions for given input
    for (let i = this.history.length - 1; i >= 0 && this.words.length >= minwordlength; --i) {
      if (this.history[i].words == this.words) {
        this.updateSuggestions(this.history[i].values);
        return;
      }
    }

    if (this.words != "" && this.words.length >= minwordlength) {
      if (this.suggestionrpc)
        consiliosearch.rpcResolve(this.suggestionrpc, null);

      this.suggestionrpc = consiliosearch.suggest(
        {
          type: "catalog",
          catalog: this.options.catalog
        },
        this.words,
        {
          doccount: "",
          count: 10
        });

      const results = await this.suggestionrpc;
      if (results)
        this.updateSuggestions(results.values);
    } else if (this.suggestwrapper)
      this.removeSuggestions();
  }

  updateSuggestions(suggestions) {
    this.formnode.classList.add("suggestionsactive");

    this.history.push({ "words": this.words, "values": suggestions });
    if (this.history.length > 100) //limit nr items in history
      this.history.shift();

    if (!this.suggestwrapper) {
      this.listitems = [];
      this.suggestwrapper = dompack.create("ul", { "className": "wh-autocomplete-values" });

      this.formnode.appendChild(this.suggestwrapper);

      this.suggestwrapper.addEventListener("keydown", ev => {
        if (ev.keyCode == 38) { // Up
          ev.preventDefault();

          let focusednode = this.inputnode;
          for (let i = this.listitems.length - 1; i >= 0; --i) {
            if (document.activeElement == this.listitems[i]) {
              if (i > 0)
                focusednode = this.listitems[i - 1];
              break;
            }
          }
          focusednode.focus();
        } else if (ev.keyCode == 40) {// Down
          ev.preventDefault();

          let focusednode = this.inputnode;
          for (let i = 0; i < this.listitems.length; ++i) {
            if (document.activeElement == this.listitems[i]) {
              if (i < this.listitems.length - 1)
                focusednode = this.listitems[i + 1];
              break;
            }
          }
          focusednode.focus();
        } else if (ev.keyCode == 27) // Esc
        {
          this.inputnode.focus();
          this.removeSuggestions();
        } else if (ev.keyCode == 13) // Enter
        {
          const item = dompack.closest(ev.target, "li");
          if (item) {
            this.inputnode.value = item.getAttribute("data-value");
            this.removeSuggestions();//remove list

            if (this.options.rpc) // trigger Rpc
              dompack.dispatchCustomEvent(this.formnode, "submit", { bubbles: false, cancelable: true });
            else
              this.formnode.submit();//basic submit
          }
        }
      });
    }

    this.suggestwrapper.innerHTML = "";//first empty container

    if (!suggestions.length) {
      const node = dompack.create("li", { className: "noresults", "innerHTML": getTid('webhare_dev:webdesigns.devsite.frontend.js.noresults') });
      this.suggestwrapper.appendChild(node);
      return;
    }

    for (const item of suggestions) {
      const val = encoding.encodeTextNode(item.value);
      const line = val.replace(this.words, "<span class=\"match\">" + encoding.encodeTextNode(this.words) + "</span>");

      const node = dompack.create("li", { className: "suggestion", "innerHTML": line });
      node.setAttribute("tabindex", "0");
      node.setAttribute("data-value", item.value);

      node.addEventListener("click", ev => {
        this.inputnode.value = item.value;
        this.removeSuggestions();//hide/remove list

        if (this.options.rpc) // trigger Rpc
          dompack.dispatchCustomEvent(this.formnode, "submit", { bubbles: false, cancelable: true });
        else
          this.formnode.submit();//basic submit
      });

      this.listitems.push(node);

      this.suggestwrapper.appendChild(node);
    }
  }

  removeSuggestions() {
    this.formnode.classList.remove("suggestionsactive");

    if (!this.suggestwrapper)
      return;
    this.suggestwrapper.parentNode.removeChild(this.suggestwrapper);
    this.suggestwrapper = null;
  }
}

class cSearch {
  constructor(resultsnode) {
    this.resultsnode = resultsnode;
    this.summarynode = resultsnode.querySelector(".contentlist--others");

    this.page = this.getUrlParam("page");
    this.page = this.page ? 1 * this.page : 0;
    if (isNaN(this.page) || this.page < 0)
      this.page = 0;

    this.section = this.getUrlParam("section");

    this.morenode = document.getElementById("moreresults");
    this.morenode.addEventListener("click", ev => this.doSearch(true));

    this.wordsnode = document.querySelector("#headersearchform input[name='words']");

    this.rpc = new JSONRPC();
  }

  doSearch(loadmore) {
    document.documentElement.classList.add("loadingresults");

    this.page = loadmore ? this.page + 1 : 0;
    const words = this.wordsnode.value;

    if (history.replaceState) {
      const urlparams = [];

      if (words != "")
        urlparams.push("words=" + encodeURIComponent(words));

      if (this.page > 0)
        urlparams.push("page=" + this.page);

      if (this.section != "")
        urlparams.push("section=" + this.section);

      history.replaceState(null, "", whintegration.config.obj.pageurl + (urlparams.length ? "?" + urlparams.join("&") : ""));
    }

    this.rpc.request("GetSearchResults",
      [this.wordsnode.value, this.page],
      this.onSearchResult.bind(this),
      this.onRpcError.bind(this)
    );
  }

  onSearchResult(res) {
    document.documentElement.classList.remove('loadingresults');
    if (res.pagenr <= 0) { //remove old results if results for firstpage
      for (let i = this.summarynode.childNodes.length - 1; i >= 0; --i)
        if (this.summarynode.childNodes[i].nodeName == "LI")
          this.summarynode.removeChild(this.summarynode.childNodes[i]);
    }

    this.page = res.pagenr;

    //deactivate more btn if no more items
    if (res.more)
      this.morenode.classList.add("active");
    else
      this.morenode.classList.remove("active");

    //Show results
    for (let i = 0; i < res.items.length; ++i) {
      let content = '<a href="' + res.items[i].link + '" ' + (res.items[i].imageurl ? 'class="withthumb"' : '') + '>';
      content += '<span class="image">';
      if (res.items[i].imageurl)
        content += '<img src="' + res.items[i].imageurl + '" class="thumb" alt="[title]" srcset="' + res.items[i].imageurl + ' 1x, ' + res.items[i].imageurl2 + ' 2x" />';
      content += '</span>';
      content += '<strong class="title">' + res.items[i].title + '</strong>';
      content += '<span class="description">' + res.items[i].description + '</span>';
      content += '</a>';

      this.summarynode.appendChild(dompack.create("li", { innerHTML: content }));
    }
  }

  getUrlParam(name) {
    const urlparamstr = location.search.replace(/\+/g, "%20");
    if (name = (new RegExp('[?&]' + encodeURIComponent(name) + '=([^&]*)')).exec(urlparamstr))
      return decodeURIComponent(name[1]);
    return "";
  }

  onRpcError(res) {
    document.documentElement.classList.remove('loadingresults');
    console.log(res);
  }
}

dompack.register("input[data-suggest]", node => new cSearchSuggest(node));
dompack.register("#searchresults", node => new cSearch(node));

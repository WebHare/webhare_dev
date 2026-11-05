// @ts-nocheck -- Bulk rename done by wh devkit:es2ts

import "./sidenav.scss";
import * as dompack from "dompack";

class cSideNav {
  constructor(node) {
    this.node = node;
    this.baseurl = document.location.href.split(/[?#]+/)[0];
    this.navlist = this.node.querySelector("ul.tree");

    this.positionwrapper = this.node.parentNode;

    this.navfilter = document.getElementById("filter-contenlist");
    if (this.navfilter) {
      this.filtertitle = this.getUrlParam("title");
      this.navfilter.addEventListener("keyup", ev => {
        this.updateFilter();
      });

      this.navfilter.addEventListener("search", ev => {
        this.updateFilter();
      });

      if (this.filtertitle != "")
        this.doFilterTitles(this.navlist);
    }

    //positioning nav so top/bottom stays within view
    window.addEventListener("resize", ev => this.setNavPosition());
    window.addEventListener("load", ev => this.setNavPosition());
    if (window.event_supportspassive)
      window.addEventListener("scroll", ev => this.setNavPosition(ev), { passive: true });
    else
      window.addEventListener("scroll", ev => this.setNavPosition(ev));

    //If click on link, close contentmenu panel
    this.node.addEventListener("click", ev => {
      if (dompack.closest(ev.target, "a"))
        document.documentElement.classList.remove("contentmenu-show");
    });

    this.setNavPosition();
  }

  updateFilter() {
    this.filtertitle = this.navfilter.value;

    if (history.replaceState)
      history.replaceState(null, "", this.baseurl + (this.filtertitle ? "?title=" + this.filtertitle : ""));

    this.doFilterTitles(this.navlist);
  }

  doFilterTitles(item) {
    const chkstr = this.filtertitle.toUpperCase();
    const itemcount = item.children.length;
    let found = 0;
    for (let i = 0; i < itemcount; ++i) {
      const test = (item.children[i].textContent).toUpperCase();
      if (test.indexOf(chkstr) > -1) {
        ++found;
        item.children[i].classList.remove("hide");

        for (let c = 0; c < item.children[i].children.length; ++c) {
          if (item.children[i].children[c].nodeName == "UL")
            this.doFilterTitles(item.children[i].children[c]);
        }

      } else {
        item.children[i].classList.add("hide");
      }
    }

    if (!found)
      item.classList.add("hide");
    else
      item.classList.remove("hide");
  }

  getUrlParam(name) {
    const urlparamstr = location.search.replace(/\+/g, "%20");
    const val = (new RegExp('[?&]' + encodeURIComponent(name) + '=([^&]*)')).exec(urlparamstr);
    return val ? decodeURIComponent(val[1]) : "";
  }

  setNavPosition() {
    const pos = this.positionwrapper.parentNode.getBoundingClientRect(); //Get size/position of aside node
    const offset = 20;
    if (pos.top < offset && pos.width) {
      document.documentElement.classList.add("fixed-sidenav");
      this.positionwrapper.style.maxWidth = pos.width + "px";
    } else {
      document.documentElement.classList.remove("fixed-sidenav");
      this.positionwrapper.style.maxWidth = "";
    }
  }
}

dompack.register("aside nav", node => new cSideNav(node));

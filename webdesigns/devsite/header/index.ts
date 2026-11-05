/* eslint-disable */
// @ts-nocheck -- Bulk rename done by wh devkit:es2ts

import "./header.scss";
import * as dompack from "dompack";

function initTopSearch(node) {
  const inpnode = node.parentNode.querySelector("input");

  node.addEventListener("submit", ev => {
    if (!document.documentElement.classList.contains("topsearch--active") && !document.documentElement.classList.contains("mobilemenu-beforeshow")) {//if not active and not in mobile menu, enlarge input area
      ev.preventDefault();
      document.documentElement.classList.add("topsearch--active");
      inpnode.focus();
    } else if (inpnode.value == "")
      ev.preventDefault();

  });

  node.querySelector("input").addEventListener("keydown", ev => {
    if (ev.keyCode == 27 && !document.documentElement.classList.contains("mobilemenu-beforeshow")) //Esc
    {
      document.documentElement.classList.remove("topsearch--active");
      inpnode.blur();
    }
  });

  node.querySelector(".close").addEventListener("click", ev => {
    if (document.documentElement.classList.contains("topsearch--active") && !document.documentElement.classList.contains("mobilemenu-beforeshow")) {//if active and not in mobile menu, enlarge input area
      document.documentElement.classList.remove("topsearch--active");
      inpnode.blur();
    }
  });
}


class cMainMenu {
  constructor(basenode) {
    this.basenode = basenode;

    this.header = dompack.closest(basenode, "header");

    //nodes which needs postion compensation when scrollbar is hidden after mobile menu is visible
    this.shiftnodes = document.querySelectorAll("body, footer, #menuwrapper .mobilemenu-toggle");

    //content menu (aside)
    for (const cnode of document.querySelectorAll(".contentmenu-toggle")) {
      cnode.addEventListener("click", ev => {
        document.documentElement.classList.toggle("contentmenu-show");
      });
    }

    //mobile menu toggler
    this.mmenutoggle = document.querySelector(".mobilemenu-toggle");
    this.mmenutoggle.addEventListener("click", ev => {
      if (document.documentElement.classList.contains("mobilemenu-show"))
        this.hideMobileMenu(ev);
      else
        this.showMobileMenu(ev);
    });

    this.viewmode = this.mmenutoggle.clientWidth ? "mobile" : "desktop";

    window.addEventListener("wh:widthchange", ev => {
      const viewmode = this.mmenutoggle.clientWidth ? "mobile" : "desktop";

      if (viewmode == "mobile" && this.viewmode != viewmode)
        this.hideMobileMenu(ev); //case mobile menu open, then close it

      this.viewmode = viewmode;
    });

    //used for binding keydown event if mobile menu is open
    this.hidemobilemenufn = this.hideMobileMenu.bind(this);

    this.initMobileFoldout();

    if (window.event_supportspassive)
      window.addEventListener("scroll", ev => this.onScroll(ev), { passive: true });
    else
      window.addEventListener("scroll", ev => this.onScroll(ev));
  }

  onScroll(ev) {
    if (this.mmenutoggle.clientWidth) {
      return;
    }

    const y = window.scrollY;
    if (y <= 0) {
      document.documentElement.classList.remove("fixed-header");
      clearTimeout(this.htimer);
    } else if (this.lastscrolly && y < this.lastscrolly) {
      clearTimeout(this.htimer);
      this.htimer = null;

      document.documentElement.classList.remove("fixed-header--hide");

      if (!document.documentElement.classList.contains("fixed-header")) {
        const hheight = this.header.clientHeight;
        let dy = hheight - y;
        if (dy < 0)
          dy = hheight;

        this.header.style.transitionDuration = "0s";
        this.header.style.top = -dy + "px";
        document.documentElement.classList.add("fixed-header");
        this.header.clientWidth;//force css update

        this.header.style.transitionDuration = "";
        this.header.style.top = "";
      }
    } else if (this.lastscrolly && y > this.lastscrolly && document.documentElement.classList.contains("fixed-header") && !this.htimer) {
      const hheight = this.header.clientHeight;
      let dy = y;
      if (dy > hheight)
        dy = hheight;

      document.documentElement.classList.add("fixed-header--hide");
      this.header.style.top = -dy + "px";
      this.header.clientWidth;//force css update

      this.htimer = setTimeout(function () {
        document.documentElement.classList.remove("fixed-header");
        document.documentElement.classList.remove("fixed-header--hide");
        this.header.style.top = "";
        this.htimer = null;
        this.header.clientWidth;//force css update
      }.bind(this), 500);
    }

    this.lastscrolly = y;
  }

  hideMobileMenu(ev) {
    if (ev) {
      if (ev.type == "keydown" && ev.keyCode != 27) //ESC
        return;

      //ignore if inside mobile menu panel and not is close btn
      if (ev.type == "click" && dompack.closest(ev.target, "#menuwrapper__scrollcontainer") && !dompack.closest(ev.target, ".mobilemenu-toggle"))
        return;
    }

    if (!document.documentElement.classList.contains("mobilemenu-show"))
      return;

    ev.preventDefault();
    ev.stopPropagation();

    clearTimeout(this.timer);


    document.body.removeEventListener('keydown', this.hidemobilemenufn);
    document.body.removeEventListener('click', this.hidemobilemenufn);

    document.documentElement.classList.remove("mobilemenu-show");

    const timeout = (ev && ev.type == "wh:widthchange") ? 0 : 200;

    this.timer = setTimeout(function () {
      document.documentElement.classList.remove("mobilemenu-beforeshow");
      this.compensateForScrollbar(0); //reset scrollbar compensation
    }.bind(this), timeout);
  }

  compensateForScrollbar(scrollbarwidth) { //compensate for disabled scrollbar
    if (!scrollbarwidth)
      scrollbarwidth = 0;

    for (const node of this.shiftnodes) {
      if (node.nodeName == "BODY")
        node.style.paddingRight = scrollbarwidth > 0 ? scrollbarwidth + "px" : "";
      else if (node.classList.contains("mobilemenu-toggle"))
        node.style.marginRight = scrollbarwidth > 0 ? scrollbarwidth + "px" : "";
      else
        node.style.right = scrollbarwidth > 0 ? scrollbarwidth + "px" : "";
    }
  }

  showMobileMenu(ev) {
    if (document.documentElement.classList.contains("mobilemenu-show"))
      return;

    ev.preventDefault();
    ev.stopPropagation();

    clearTimeout(this.timer);

    const winw = document.body.clientWidth;
    document.documentElement.classList.add("mobilemenu-beforeshow");
    const scrollbarwidth = document.body.clientWidth - winw;
    document.documentElement.classList.add("mobilemenu-show");

    if (scrollbarwidth > 0) //compensate for disabled scrollbar
      this.compensateForScrollbar(scrollbarwidth);

    document.body.addEventListener('keydown', this.hidemobilemenufn);
    document.body.addEventListener('click', this.hidemobilemenufn);
  }

  initMobileFoldout() {
    for (const node of this.basenode.querySelectorAll("li.haschildren > a")) {
      node.addEventListener("click", ev => {
        if (this.basenode.clientWidth > 600)
          return true; //we're still in desktop mode

        ev.preventDefault();

        const childrennode = node.parentNode.querySelector(".children");
        if (!childrennode)
          return;

        clearTimeout(this.foldtimer);

        childrennode.style.height = childrennode.clientHeight + "px";
        childrennode.clientHeight;//force css update

        if (node.parentNode.classList.contains("showchildren")) { //hide children
          childrennode.style.height = "0";
          node.parentNode.classList.remove("showchildren");
        } else { //show children
          node.parentNode.classList.add("showchildren");
          const h = childrennode.children[0].clientHeight;
          childrennode.style.height = h + "px";
        }

        this.foldtimer = setTimeout(function () { //remove forced styling if animation is ready
          childrennode.style.height = "";
        }, 200);
      });
    }
  }
}

dompack.register("#mainnav", node => new cMainMenu(node));
dompack.register("#topsearchform", node => initTopSearch(node));

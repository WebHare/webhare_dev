/* eslint-disable */
// @ts-nocheck -- Bulk rename done by wh devkit:es2ts

import "./summary.scss";
import * as dompack from "dompack";
import * as whintegration from "@mod-system/js/wh/integration";
import * as preload from 'dompack/extra/preload';


class cLoadThumbs {
  constructor(listnode) {
    this.listnode = listnode;

    window.addEventListener("resize", ev => this.loadImages(ev));

    listnode.addEventListener("wh:refresh", ev => this.loadImages(ev));

    if (window.event_supportspassive)
      window.addEventListener("scroll", ev => this.loadImages(ev), { passive: true });
    else
      window.addEventListener("scroll", ev => this.loadImages(ev));

    window.addEventListener("load", ev => this.loadImages(ev));

    this.loadImages();
  }

  loadImages(ev) {
    if (!this.viewport || (ev && ev.type == "resize")) {
      this.viewport = {
        x: window.innerWidth || document.documentElement.clientWidth || document.body.clientWidth,
        y: window.innerHeight || document.documentElement.clientHeight || document.body.clientHeight
      };
    }

    for (const node of this.listnode.querySelectorAll(".image[data-srcset]:not(.loaded)")) {
      const pos = node.getBoundingClientRect();
      if (pos.bottom > 0 && pos.top < this.viewport.y) {
        node.classList.add("loaded");
        this.preloadImage(node);
      }
    }
  }

  async preloadImage(wrappernode) {
    const preloadedimage = await preload.promiseImage(wrappernode.dataset.srcset.split(" ")[0]);
    if (preloadedimage) {
      preloadedimage.node.setAttribute("srcset", wrappernode.dataset.srcset);
      preloadedimage.node.style.opacity = 0;
      wrappernode.appendChild(preloadedimage.node);
      wrappernode.clientWidth;// force css update
      preloadedimage.node.style.opacity = 1;
    }
  }
}

class cSortSummary {
  constructor(node) {
    this.node = node;

    const optionnodes = node.querySelectorAll("li");

    const urlparamstr = location.search;
    let activeidx = -1;
    for (let i = 0; i < optionnodes.length; ++i) {
      const link = optionnodes[i].querySelector("a").href;
      if (link == whintegration.config.obj.pageurl + urlparamstr)
        activeidx = i;
    }

    for (let i = 0; activeidx > -1 && i < optionnodes.length; ++i) {
      if (i == activeidx)
        optionnodes[i].classList.add("active");
      else
        optionnodes[i].classList.remove("active");
    }

    for (const optionnode of optionnodes) {
      const id = 1 * optionnode.dataset.id;
      if (whintegration.config.obj.parent == id) //only if same link
        optionnode.addEventListener("click", ev => this.doSort(ev, optionnode));

      if (optionnode.classList.contains("active"))
        this.doSort(null, optionnode, true);
    }
  }

  doSort(ev, sortnode, initial) {
    if (ev)
      ev.preventDefault();

    if (history.replaceState) {
      const link = sortnode.querySelector("a").href;
      history.replaceState(null, "", link);
    }

    if (this.cursortnode && this.cursortnode == sortnode)
      return;

    if (this.cursortnode)
      this.cursortnode.classList.remove("active");
    this.cursortnode = sortnode;
    this.cursortnode.classList.add("active");

    const action = sortnode.dataset.action; // filter or sort

    let i = 0;
    const summarynode = document.querySelector(".summary");
    const nodes = [];
    for (const itemnode of summarynode.querySelectorAll("li")) {
      if (!itemnode.dataset.order)
        itemnode.dataset.order = i; //store original order

      let sortvalue = "";
      let visible = true;

      if (!initial)
        itemnode.classList.add("beforesort");

      if (action == "filter") {
        sortvalue = 1 * itemnode.dataset.order;
        visible = itemnode.dataset.highlight != "";
      } else {
        const node = itemnode.querySelector(".title");
        sortvalue = node ? node.textContent.toUpperCase() : 1 * itemnode.dataset.order;
      }

      nodes.push({
        "node": itemnode,
        "sort": sortvalue,
        "visible": visible
      });

      ++i;
    }

    nodes.sort(function (a, b) {
      if (a.sort < b.sort) return -1;
      if (a.sort > b.sort) return 1;
      return 0;
    });

    for (let i = nodes.length - 1; i >= 0; --i) {
      if (i > 0)
        summarynode.insertBefore(nodes[i - 1].node, nodes[i].node);

      if (nodes[i].visible)
        nodes[i].node.classList.remove("hide");
      else
        nodes[i].node.classList.add("hide");

      nodes[i].node.clientWidth; //force css update
      nodes[i].node.classList.remove("beforesort");
    }

    //wait till animation is ready (200ms)
    clearTimeout(this.waittimer);
    this.waittimer = setTimeout(function () {
      dompack.dispatchCustomEvent(summarynode, "wh:refresh", {
        bubbles: true,
        cancelable: false,
        detail: { node: summarynode }
      });
    }, 201);
  }
}

dompack.register("#pagelisting_sortoptions", node => new cSortSummary(node));
dompack.register(".summary", node => new cLoadThumbs(node));

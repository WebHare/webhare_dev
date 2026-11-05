// @ts-nocheck -- Bulk rename done by wh devkit:es2ts

import * as dompack from "dompack";

export default class SwipeDetect {
  constructor(node, options) {
    if (!node)
      return;

    this.options = {
      threshold_distance: 15,
      threshold_speed: 0.3,
      enablemouseswipe: true, ...options
    };

    this.swipeinfo = null;
    this.node = node;

    //android fix: init after page is loaded
    window.addEventListener("load", ev => this.init());
  }

  init() {
    if (this.initdone)
      return;

    this.initdone = true;
    if (this.options.enablemouseswipe) {
      this.node.addEventListener("mousedown", event => this.onTouchStart(event));
      this.node.addEventListener("mousemove", event => this.onTouchMove(event));
      this.node.addEventListener("mouseup", event => this.onTouchEnd(event));
    }
    if (this.touchEnabled()) {
      this.node.addEventListener("touchstart", event => this.onTouchStart(event));
      this.node.addEventListener("touchmove", event => this.onTouchMove(event));
      this.node.addEventListener("touchend", event => this.onTouchEnd(event));
    }
  }

  touchEnabled() {
    const enable = "ontouchstart" in window || "createTouch" in document || "TouchEvent" in window ||
      (window.DocumentTouch && document instanceof window.DocumentTouch) ||
      navigator.maxTouchPoints > 0 ||
      window.navigator.msMaxTouchPoints > 0;

    return enable;
  }

  onTouchStart(ev) {
    const posx = typeof ev.pageX !== "undefined" ? ev.pageX : ev.touches[0].pageX;
    const posy = typeof ev.pageY !== "undefined" ? ev.pageY : ev.touches[0].pageY;

    this.swipeinfo = {
      starttime: new Date().getTime(),
      endtime: -1,
      start: { "x": posx, "y": posy },
      end: { "x": posx, "y": posy },
      speed: { "x": 0, "y": 0 },
      distance: { "x": 0, "y": 0 },
      target: ev.target,
      direction: "",
      duration: 0
    };
  }

  onTouchMove(ev) {
    if (!this.swipeinfo)
      return;

    const posx = typeof ev.pageX !== "undefined" ? ev.pageX : ev.touches[0].pageX;
    const posy = typeof ev.pageY !== "undefined" ? ev.pageY : ev.touches[0].pageY;

    this.swipeinfo.end = { "x": posx, "y": posy };
  }

  onTouchEnd(ev) {
    if (!this.swipeinfo)
      return;

    const dx = this.swipeinfo.end.x - this.swipeinfo.start.x;
    const dy = this.swipeinfo.end.y - this.swipeinfo.start.y;

    this.swipeinfo.endtime = new Date().getTime();

    this.swipeinfo.duration = this.swipeinfo.endtime - this.swipeinfo.starttime;

    this.swipeinfo.distance.x = Math.abs(dx);
    this.swipeinfo.distance.y = Math.abs(dy);

    this.swipeinfo.speed.x = this.swipeinfo.distance.x / this.swipeinfo.duration;
    this.swipeinfo.speed.y = this.swipeinfo.distance.y / this.swipeinfo.duration;

    if (this.swipeinfo.distance.x > this.options.threshold_distance && this.swipeinfo.speed.x > this.options.threshold_speed)
      this.swipeinfo.direction += dx > 0 ? "e" : "w";

    if (this.swipeinfo.distance.y > this.options.threshold_distance && this.swipeinfo.speed.y > this.options.threshold_speed)
      this.swipeinfo.direction += dy > 0 ? "s" : "n";

    if (this.swipeinfo.direction != "") {
      dompack.dispatchCustomEvent(this.node, "wh:swipe", {
        bubbles: true,
        cancelable: false,
        detail: this.swipeinfo
      });
    }

    this.swipeinfo = null;
  }
}

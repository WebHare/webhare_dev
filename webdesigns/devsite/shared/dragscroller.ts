/* eslint-disable */
// @ts-nocheck -- Bulk rename done by wh devkit:es2ts

import * as dompack from "dompack";

export default class dragScroller {
  constructor(basenode, options) {
    this.options = {
      threshold_distance: 15,
      threshold_speed: 0.35,
      mousethreshold_distance: -1,
      mousethreshold_speed: 0.9,
      scrollvertical: true,
      scrollhorizontal: true,
      contentnode: basenode.firstElementChild,
      scrolloffset: 0,
      contentmargin: 0,
      resizehandler: true,
      swipeduration: 500, //duration in ms
      ...options
    };

    this.node = basenode;
    this.contentnode = this.options.contentnode;

    this.draginfo = null;

    this.oldposition = { x: 0, y: 0 };
    this.position = { x: 0, y: 0 };

    //get event functions so we can remove listener after release
    this.moveeventfn = this.onTouchMove.bind(this);
    this.endeventfn = this.onTouchEnd.bind(this);
    this.starteventfn = this.onTouchStart.bind(this);

    if (this.options.resizehandler)
      window.addEventListener("resize", event => this.onResize(false));

    window.addEventListener("load", event => this.onResize(false));//incase of custom fonts inside container

    this.startTracking();
  }

  startTracking() {
    if (this.isactive)
      return;

    this.isactive = true;

    this.node.addEventListener("mousedown", this.starteventfn);
    if (this.touchEnabled())
      this.node.addEventListener("touchstart", this.starteventfn);

    this.node.addEventListener("mousewheel", ev => {
      ev.preventDefault();
      if (ev.deltaX || ev.deltaY) {
        this.position.x -= ev.deltaX;
        this.position.y -= ev.deltaY;
        this.setPositions();
      }
    });

    this.onResize(true);
  }

  stopTracking() {
    if (!this.isactive)
      return;

    this.isactive = false;

    //remove events
    window.removeEventListener("mouseup", this.endeventfn);
    this.node.removeEventListener("mousemove", this.moveeventfn);
    this.node.removeEventListener("mousedown", this.starteventfn);
    if (this.touchEnabled()) {
      window.removeEventListener("touchend", this.endeventfn);
      this.node.removeEventListener("touchmove", this.moveeventfn);
      this.node.removeEventListener("touchstart", this.starteventfn);
    }

    //reset styling
    this.contentnode.style.transitionDuration = "";
    this.contentnode.style.transitionStyle = "";

    if (this.options.scrollhorizontal)
      this.contentnode.style.left = "";

    if (this.options.scrollvertical)
      this.contentnode.style.top = "";
  }

  reset(options) {
    this.options = {
      threshold_distance: 15,
      threshold_speed: 0.35,
      mousethreshold_distance: -1,
      mousethreshold_speed: 0.9,
      scrollvertical: true,
      scrollhorizontal: true, ...options
    };

    this.oldposition = { x: 0, y: 0 };
    this.position = { x: 0, y: 0 };

    this.contentnode.style.top = "0px";
    this.contentnode.style.left = "0px";

    this.onResize(true);
    this.setPositions();
  }

  setScrollOffset(scrolloffset) {
    this.options.scrolloffset = scrolloffset;
  }

  onResize(isinitial) {
    this.limits = {
      x: ((this.node.clientWidth - this.options.scrolloffset) - (this.contentnode.clientWidth + this.options.contentmargin)),
      y: ((this.node.clientHeight - this.options.scrolloffset) - (this.contentnode.clientHeight + this.options.contentmargin))
    };

    if (this.limits.x > 0)
      this.limits.x = 0;

    if (this.limits.y > 0)
      this.limits.y = 0;

    const selitem = this.contentnode.querySelector(".active");
    if (selitem) {
      const selitem_pos = selitem.getBoundingClientRect();
      if (this.options.scrollhorizontal && selitem_pos.right + this.position.x > this.node.clientWidth)
        this.position.x = this.node.clientWidth - selitem_pos.right + this.position.x;
    }

    this.moveActiveIntoView();
    //this.setPositions();

    this.fireEvent(isinitial ? "initial" : "resize");
  }

  moveActiveIntoView() {
    const selitem = this.contentnode.querySelector(".active");
    if (selitem) {
      const selitem_pos = selitem.getBoundingClientRect();
      if (this.options.scrollhorizontal) {//we asumse here that container is window width
        if (selitem_pos.right > this.node.clientWidth) {
          this.position.x = this.node.clientWidth - (selitem_pos.right - this.position.x);
        } else if (selitem_pos.left < 0) {
          this.position.x -= selitem_pos.left;
        }
      }
    }

    this.setPositions();
  }

  onTouchStart(ev) {
    this.oldposition.x = this.position.x;
    this.oldposition.y = this.position.y;

    this.dragstarted = false;
    this.fireEvent("beforedragstart");

    window.addEventListener("mouseup", this.endeventfn);
    this.node.addEventListener("mousemove", this.moveeventfn);
    if (this.touchEnabled()) {
      window.addEventListener("touchend", this.endeventfn);
      this.node.addEventListener("touchmove", this.moveeventfn);
    }

    const posx = typeof event.pageX !== "undefined" ? event.pageX : event.touches[0].pageX;
    const posy = typeof event.pageY !== "undefined" ? event.pageY : event.touches[0].pageY;

    this.swipeinfo = {
      starttime: new Date().getTime(),
      endtime: -1,
      start: { x: posx, y: posy },
      end: { x: posx, y: posy },
      target: ev.target,
      direction: ""
    };
  }

  onTouchMove(ev) {
    if (!this.swipeinfo)
      return;

    if (!this.dragstarted) {
      this.dragstarted = true;
      this.fireEvent("dragstart");
    }

    const posx = typeof event.pageX !== "undefined" ? event.pageX : event.touches[0].pageX;
    const posy = typeof event.pageY !== "undefined" ? event.pageY : event.touches[0].pageY;
    this.swipeinfo.end = {
      x: posx,
      y: posy
    };

    this.position.x = this.oldposition.x + (this.swipeinfo.end.x - this.swipeinfo.start.x);
    this.position.y = this.oldposition.y + (this.swipeinfo.end.y - this.swipeinfo.start.y);

    this.setPositions();
  }

  moveBy(posxy) {
    clearTimeout(this.movetimer);

    //set css transition
    this.contentnode.style.transitionDuration = this.options.swipeduration + "ms";
    this.contentnode.style.transitionStyle = "left top";
    this.contentnode.clientWidth; //force css update

    if (posxy.x)
      this.position.x = this.oldposition.x + posxy.x;
    if (posxy.y)
      this.position.y = this.oldposition.y + posxy.y;

    this.setPositions();

    let timeout = this.options.swipeduration;

    if (this.oldposition.x != this.position.x || this.oldposition.y != this.position.y)
      this.fireEvent("moveby");
    else
      timeout = 0;//stop transition

    this.oldposition.x = this.position.x;
    this.oldposition.y = this.position.y;

    this.movetimer = setTimeout(function () { //remove css transition
      this.contentnode.style.transitionDuration = "0ms";
      this.contentnode.style.transitionStyle = "";
      this.contentnode.clientWidth; //force css update
    }.bind(this), timeout);
  }

  moveTo(x, y) {
    let haschanged = false;
    if (typeof x === "number" && x != this.position.x) {
      this.position.x = x;
      haschanged = true;
    }
    if (typeof y === "number" && y != this.position.y) {
      this.position.y = y;
      haschanged = true;
    }

    if (haschanged) {
      this.fireEvent("moveto");
      this.setPositions();
    }
  }

  setPositions() {
    if (this.options.scrollhorizontal && this.limits.x < 0) {
      if (this.position.x > 0)
        this.position.x = 0;
      else if (this.position.x < this.limits.x)
        this.position.x = this.limits.x;

      this.contentnode.style.left = this.position.x + "px";
    } else {
      this.position.x = this.oldposition.x;
      this.contentnode.style.left = "";
    }

    if (this.options.scrollvertical && this.limits.y < 0) {
      if (this.position.y > 0)
        this.position.y = 0;
      else if (this.position.y < this.limits.y)
        this.position.y = this.limits.y;

      this.contentnode.style.top = this.position.y + "px";
    } else {
      this.position.y = this.oldposition.y;
      this.contentnode.style.top = "";
    }
  }

  fireEvent(source) {
    dompack.dispatchCustomEvent(this.node, "wh:dragscroller", {
      bubbles: true,
      cancelable: false,
      detail: {
        position: this.position,
        limits: this.limits,
        source: source,
        dragged: (this.oldposition.x != this.position.x || this.oldposition.y != this.position.y),
        dx: this.oldposition.x - this.position.x,
        dy: this.oldposition.y - this.position.y
      }
    });
  }

  onTouchEnd(ev) {
    //remove events
    window.removeEventListener("mouseup", this.endeventfn);
    this.node.removeEventListener("mousemove", this.moveeventfn);
    if (this.touchEnabled()) {
      window.removeEventListener("touchend", this.endeventfn);
      this.node.removeEventListener("touchmove", this.moveeventfn);
    }

    if (!this.swipeinfo)
      return;

    const dx = this.swipeinfo.end.x - this.swipeinfo.start.x;
    const dy = this.swipeinfo.end.y - this.swipeinfo.start.y;

    this.swipeinfo.endtime = new Date().getTime();
    const dt = this.swipeinfo.endtime - this.swipeinfo.starttime;

    const abs_x = Math.abs(dx);
    const abs_y = Math.abs(dy);

    const swipespeedx = abs_x / dt;
    const swipespeedy = abs_y / dt;

    let threshold_speed = this.options.threshold_speed;
    let threshold_distance = this.options.threshold_distance;

    if (ev.type == "mouseup") {
      threshold_speed = this.options.mousethreshold_speed > 0 ? this.options.mousethreshold_speed : threshold_speed;
      threshold_distance = this.options.mousethreshold_distance > 0 ? this.options.mousethreshold_distance : threshold_distance;
    }

    if (abs_x > threshold_distance && swipespeedx > threshold_speed)
      this.swipeinfo.direction += dx > 0 ? "e" : "w";

    if (abs_y > threshold_distance && swipespeedy > threshold_speed)
      this.swipeinfo.direction += dy > 0 ? "s" : "n";

    if (this.swipeinfo.direction != "") {
      const movexy = { x: 0, y: 0 };
      const factor = 0.7;

      //move a bit more if swipe detected
      if (this.options.scrollhorizontal) {
        if (this.swipeinfo.direction == "e")
          movexy.x = this.contentnode.clientWidth * factor * swipespeedx; //fast swipe => larger distance
        else if (this.swipeinfo.direction == "w")
          movexy.x = -this.contentnode.clientWidth * factor * swipespeedx;
      }

      if (this.options.scrollvertical) {
        if (this.swipeinfo.direction == "s")
          movexy.x = this.contentnode.clientHeight * movefraction * swipespeedy;
        else if (this.swipeinfo.direction == "n")
          movexy.x = -this.contentnode.clientHeight * movefraction * swipespeedy;
      }

      this.moveBy(movexy);
    }

    this.fireEvent("dragend");

    this.swipeinfo = null;
  }

  touchEnabled() {
    const enable = "ontouchstart" in window || "createTouch" in document || "TouchEvent" in window ||
      (window.DocumentTouch && document instanceof window.DocumentTouch) ||
      navigator.maxTouchPoints > 0 ||
      window.navigator.msMaxTouchPoints > 0;
    return enable;
  }
}

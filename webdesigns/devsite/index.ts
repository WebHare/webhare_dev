// @ts-nocheck -- Bulk rename done by wh devkit:es2ts

import * as dompack from "dompack";
import { openLinksInNewWindow } from '@mod-publisher/js/linkhandler';

import "./corporate.scss";
import "./rtd";
import "./header";
import "./main";
import "./footer";
import "./pages";
import "./widgets";
import "./shared/forms";
import "./shared/codehighlight";//used for manuals
import "./components/summary";
import "./components/forms";

import "./debug";//debugging grid layout

import "./site.lang.json";

//used for scroll event listener:
window.event_supportspassive = false;
document.createElement("div").addEventListener("test", _ => { }, { get passive() { window.event_supportspassive = true; } });

window.agreesiteterms = getCookie("wh_siteterms") == "agree";

dompack.onDomReady(() => {
  openLinksInNewWindow();

  if (!window.agreesiteterms && !document.getElementById("cookiemsg"))
    window.agreesiteterms = !window.do_not_track;//if no cookiemessage active

  let prev_win_w = -1;
  window.addEventListener("resize", ev => {
    const win_w = window.innerWidth || document.documentElement.clientWidth || document.body.clientWidth;

    if (prev_win_w == win_w)
      return;//only if window width changed

    dompack.dispatchCustomEvent(window, "wh:widthchange", {
      bubbles: false,
      cancelable: true,
      detail: {
        prev_w: prev_win_w,
        new_w: win_w
      }
    });
    prev_win_w = win_w;
  });

  // MTI tracker for font licensing. needed for DIN font used in header. moved to domready and load it dynamically for pagespeed purposes
  // window.MTIProjectId='5c29641c-29d8-4d91-b77b-7b00e60157ac';
  // require.ensure(["./shared/mtifonttrackingcode.js"], function(){});
  // disabled as it doesn't work at all. see also https://gitlab.webhare.com/webharebv/home/-/issues/405
});


class cSiteMessage {
  constructor(node) {
    this.duration = 300;//ms
    this.node = node;

    this.enabletouch = this.touchEnabled();

    this.showMessage();
  }

  showMessage() {
    this.node.style.display = "block";
    this.node.style.transition = "height " + this.duration + "ms";

    this.chkheightfn = this.setSiteMessageHeight.bind(this);
    this.closefn = this.hideSiteMessage.bind(this);

    window.addEventListener("resize", this.chkheightfn);
    document.body.addEventListener("click", this.closefn);
    window.addEventListener("keydown", this.closefn);

    if (this.enabletouch)
      document.body.addEventListener("touchstart", this.closefn);


    const btnnode = this.node.querySelector("button");
    if (btnnode)
      btnnode.addEventListener("click", this.closefn);

    this.setSiteMessageHeight();
  }

  setSiteMessageHeight() {
    let h = this.node.querySelector(".centercontainer").clientHeight;
    const winh = window.innerHeight || document.documentElement.clientHeight || document.body.clientHeight;

    if (winh < h)
      this.node.classList.add("scrollable");
    else
      this.node.classList.remove("scrollable");

    if (winh < h)
      h = winh;

    this.node.style.height = h + "px";
  }

  hideSiteMessage(ev) {
    if (ev) {
      if (ev.type == "click" || ev.type == "touchstart") {
        if (!dompack.closest(ev.target, ".sitemessage .close") && dompack.closest(ev.target, ".sitemessage"))
          return;
      } else if (ev.type == "keydown" && ev.keyCode != 27) //ESC
        return;
    }

    dompack.dispatchCustomEvent(this.node, "wh:hide", {
      bubbles: false,
      cancelable: true,
      detail: { id: this.node.id, target: ev.target }
    });

    this.node.style.height = "0";

    window.removeEventListener("resize", this.chkheightfn);
    document.body.removeEventListener("click", this.closefn);
    window.removeEventListener("keydown", this.closefn);

    if (this.enabletouch)
      document.body.removeEventListener("touchstart", this.closefn);

    setTimeout(function () {
      dompack.remove(this.node);
    }.bind(this), this.duration);
  }

  touchEnabled() {
    const enable = "ontouchstart" in window || "createTouch" in document || "TouchEvent" in window ||
      (window.DocumentTouch && document instanceof window.DocumentTouch) ||
      navigator.maxTouchPoints > 0 ||
      window.navigator.msMaxTouchPoints > 0;

    return enable;
  }
}


function getCookie(name) {
  name += "=";
  const ca = document.cookie.split(";");
  for (let i = 0; i < ca.length; ++i) {
    let c = ca[i];
    while (c.charAt(0) == " ") c = c.substring(1);
    if (c.indexOf(name) == 0) return c.substring(name.length, c.length);
  }
  return "";
}


function setCookie(name, value, exdays) {
  let expires = "";
  if (exdays) {
    const d = new Date();
    d.setTime(d.getTime() + (exdays * 24 * 60 * 60 * 1000));
    expires = "; expires=" + d.toUTCString();
  }
  const domainparts = location.hostname.split(".").reverse();
  document.cookie = name + "=" + value + expires + "; domain=." + domainparts[1] + "." + domainparts[0] + "; path=/";
}

dompack.register("#cookiemsg", node => {

  if (window.agreesiteterms) {
    dompack.remove(node);
    return;
  }

  node.addEventListener("wh:hide", ev => {
    if (ev.detail.id == "cookiemsg") {
      if (dompack.closest(ev.detail.target, "#cookiemsg button")) {
        window.agreesiteterms = true;
        setCookie("wh_siteterms", "agree", 365);
      }
    }
  });
  new cSiteMessage(node);
});

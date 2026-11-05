/* eslint-disable */
// @ts-nocheck -- Bulk rename done by wh devkit:es2ts

import "./dialog.css";
import * as dompack from "dompack";

/*
  Simple modal dialog
*/
function showModalDialog(title, contents, options) {
  if (!options)
    options = {};

  if (!options.duration)
    options.duration = 200;//ms

  let modalnode = document.querySelector(".dialog__modal");
  if (modalnode)
    hideModalDialog();//close previous dialog

  modalnode = document.createElement("div");
  modalnode.className = "dialog__modal" + (options.theme ? " " + options.theme : "");

  modalnode.style.transitionDuration = options.duration + "ms";

  const bodynode = document.createElement("div");
  bodynode.className = "dialog__body";

  bodynode.style.transitionDuration = options.duration + "ms";


  modalnode.appendChild(bodynode);

  if (title != "") {
    const titlenode = document.createElement("div");
    titlenode.className = "title";
    titlenode.innerHTML = title;
    bodynode.appendChild(titlenode);
  }

  if (!options.disable_close) {
    const closebtn = document.createElement("span");
    closebtn.className = "close fa-stack";
    closebtn.innerHTML = '<span class="fa fa-angle-right fa-stack-1x"></span><span class="fa fa-angle-left fa-stack-1x"></span>';

    if (options.position_close && options.position_close == "outside")
      modalnode.appendChild(closebtn);
    else
      bodynode.appendChild(closebtn);
  }

  const contentnode = document.createElement("div");
  contentnode.className = "dialog__content";
  bodynode.appendChild(contentnode);

  if (typeof contents === "object")
    contentnode.appendChild(contents);
  else if (typeof contents === "string")
    contentnode.innerHTML = contents;

  if (!options.disable_close) {
    modalnode.addEventListener('click', hideModalDialog);
    document.body.addEventListener('keydown', hideModalDialog);
  }

  const winw = document.body.clientWidth;

  document.documentElement.classList.add("dialog--active");
  document.body.appendChild(modalnode);

  //compensate window scrollbar (if any)
  const scrollbarwidth = document.body.clientWidth - winw;
  if (scrollbarwidth) {
    document.body.style.marginRight = scrollbarwidth + "px";
    //compensate fixed elements:
    for (const hnode of document.body.querySelectorAll("#mainnav")) {
      const setstyles = window.getComputedStyle(hnode, null);
      if (!setstyles || setstyles.position == "fixed")
        hnode.style.right = scrollbarwidth + "px";
    }
  }

  dompack.dispatchCustomEvent(modalnode, "dialog:show", {
    bubbles: true,
    cancelable: false,
    detail: {
      target: modalnode,
      contentnode: contentnode
    }
  });

  //basic animation
  bodynode.clientHeight;//force css update
  modalnode.classList.add("aftershow");

  setTimeout(function () {
    dompack.dispatchCustomEvent(modalnode, "dialog:aftershow", {
      bubbles: true,
      cancelable: false,
      detail: {
        target: modalnode,
        contentnode: contentnode
      }
    });
  }, options.duration);

  return modalnode;
}

function hideModalDialog(ev) {
  const dialognode = document.querySelector(".dialog__modal");
  if (!dialognode)
    return;

  if (ev) {
    if (ev.type == 'keydown' && ev.keyCode != 27)
      return;
    if (ev.type == 'click' && ev.target != dialognode && !dompack.closest(ev.target, ".close"))
      return;
  }

  document.documentElement.classList.remove("dialog--active");

  dompack.dispatchCustomEvent(dialognode, "dialog:hide", {
    bubbles: true,
    cancelable: false,
    detail: { target: dialognode }
  });

  //cleanup window scrollbar compensations
  document.body.style.marginRight = "";
  for (const hnode of document.body.querySelectorAll("#mainnav"))
    hnode.style.right = "";

  //cleanup events
  document.body.removeEventListener('keydown', hideModalDialog);
  dialognode.removeEventListener('click', hideModalDialog);
  document.body.removeChild(dialognode);
}

export { showModalDialog, hideModalDialog };

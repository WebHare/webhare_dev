/* eslint-disable */
// @ts-nocheck -- Bulk rename done by wh devkit:es2ts

import "./debug.scss";
import * as dompack from "dompack";
import * as cookie from "dompack/extra/cookie";

dompack.onDomReady(() => { //show overlay with column grid
  let cols = -1;

  //get nr of cols from url parameter 'cols' if given
  const urlparamstr = location.search.replace(/\+/g, "%20");
  const regval = new RegExp('[?&]cols=([^&]*)').exec(urlparamstr);
  if (regval)
    cols = 1 * decodeURIComponent(regval[1]);

  if (cols > -1)
    cookie.write("debuggrid", cols);
  else
    cols = 1 * (cookie.read("debuggrid"));

  if (!cols || cols < 0)
    return;

  const container = <div class="layoutoverlay" />;
  const columnsnode = <div class={"layoutoverlay__columns layoutoverlay__columns--cols" + cols} />;
  container.appendChild(columnsnode);
  for (let i = 0; i < cols; ++i) {
    if (i > 0)
      columnsnode.appendChild(<div class="gap" />);
    columnsnode.appendChild(<div class="col" />);
  }

  document.body.appendChild(container);
});

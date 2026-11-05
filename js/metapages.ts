/* Test urls
     https://sites.moe.sf.webhare.dev/www.webhare.dev/meta/platform.yml
     https://sites.moe.sf.webhare.dev/www.webhare.dev/meta/platform.json
     https://sites.moe.sf.webhare.dev/www.webhare.dev/meta/buildimage/main

  Prod urls
     https://www.webhare.dev/meta/platform.yml
     https://www.webhare.dev/meta/platform.json
     https://www.webhare.dev/meta/buildimage/main
*/

import { createWebResponse, type WebRequest, type WebResponse } from "@webhare/router";
import { toFSPath } from "@webhare/services";
import { readFileSync } from "node:fs";
import YAML from "yaml";
import type { PlatformMetaType } from "wh:schema/webhare_dev/platformmetatype";

export async function metaRouter(req: WebRequest): Promise<WebResponse> {
  const parts = req.localPath.split("/");
  switch (parts[0]) {
    case "buildimage": {
      const data = YAML.parse(readFileSync(toFSPath("mod::webhare_dev/data/platform.yml"), "utf8")) as PlatformMetaType;
      if (parts[1] && parts[1] in data.branch)
        return createWebResponse(data.branch[parts[1] as keyof typeof data.branch].image, { status: 200, headers: { "content-type": "text/plain" } });
      return createWebResponse("Branch not found", { status: 404 });
    }
    case "platform.yml": {
      const platformData = readFileSync(toFSPath("mod::webhare_dev/data/platform.yml"), "utf8");
      return createWebResponse(platformData, { status: 200, headers: { "content-type": "application/x-yaml" } });
    }
    case "platform.json": {
      const platformData = YAML.parse(readFileSync(toFSPath("mod::webhare_dev/data/platform.yml"), "utf8"));
      return createWebResponse(JSON.stringify(platformData) + '\n', { status: 200, headers: { "content-type": "application/json" } });
    }
  }
  return createWebResponse("not found", { status: 404 });
}

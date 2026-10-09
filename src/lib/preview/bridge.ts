export function bridgeScript(appOrigin: string) {
  return `(function () {
  if (window.parent === window) return;
  var app = ${JSON.stringify(appOrigin)};
  function send() {
    try {
      window.parent.postMessage({ seedling: "preview", href: location.pathname + location.search + location.hash, title: document.title }, app);
    } catch (e) {}
  }
  ["pushState", "replaceState"].forEach(function (name) {
    var original = history[name];
    history[name] = function () {
      var result = original.apply(this, arguments);
      send();
      return result;
    };
  });
  addEventListener("popstate", send);
  addEventListener("hashchange", send);
  addEventListener("load", send);
  addEventListener("message", function (event) {
    if (event.origin !== app || !event.data || event.data.seedling !== "command") return;
    if (event.data.command === "back") history.back();
    else if (event.data.command === "forward") history.forward();
    else if (event.data.command === "reload") location.reload();
  });
  if (document.readyState === "loading") addEventListener("DOMContentLoaded", send);
  else send();
})();
`;
}

export const BRIDGE_PATH = "/__seedling/bridge.js";

export function injectBridge(html: string) {
  const tag = `<script src="${BRIDGE_PATH}"></script>`;
  const head = html.match(/<head(\s[^>]*)?>/i);
  if (head?.index !== undefined) {
    const at = head.index + head[0].length;
    return html.slice(0, at) + tag + html.slice(at);
  }
  const doctype = html.match(/^\s*<!doctype[^>]*>/i);
  if (doctype) return doctype[0] + tag + html.slice(doctype[0].length);
  return tag + html;
}

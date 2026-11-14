import { JSDOM } from "jsdom";

export function rewriteReadmeUrls(html, owner, repo, branch) {
  const fragment = JSDOM.fragment(html);
  const ref = encodeURIComponent(branch);
  for (const element of fragment.querySelectorAll("a[href], img[src], video[src], source[src]")) {
    const attribute = element.tagName === "A" ? "href" : "src";
    const value = element.getAttribute(attribute).trim();
    if (!value || /^(?:[a-z][a-z0-9+.-]*:|#|\/\/)/i.test(value)) continue;
    const target = new URL(value, "https://repository.invalid/");
    const relative = target.pathname.slice(1) + target.search + target.hash;
    if (attribute === "src") {
      element.setAttribute(attribute, `https://raw.githubusercontent.com/${owner}/${repo}/${ref}/${relative}`);
    } else {
      const kind = /\.[^/]+$/.test(target.pathname) ? "blob" : "tree";
      element.setAttribute(attribute, `https://github.com/${owner}/${repo}/${kind}/${ref}/${relative}`);
    }
  }
  const container = fragment.ownerDocument.createElement("div");
  container.append(fragment);
  return container.innerHTML;
}

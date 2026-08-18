import { highlight } from "./package/lib/index.js";
import { lang } from "./package/lib/lang.js";
const code = "# install the plugin\nbb plugin install ./plugins/monokai";
for (const l of ["sh","bash","shell","zsh","console","h","hpp","less","scss","kotlin","kt","cc","c++","cpp","yaml","toml","dockerfile","sql","html","markdown","ts","tsx","js","json","diff"]) {
  console.log(l, "->", lang(l));
}
const t = [...highlight(code, { lang: lang("sh") }).matchAll(/class="sh__token--(\w+)"[^>]*>([^<]*)</g)].map(m=>[m[1],m[2]]);
console.log("v2 shell tokens:", JSON.stringify(t));

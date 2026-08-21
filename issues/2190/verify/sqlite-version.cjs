const D=require("better-sqlite3");const d=new D(":memory:");
console.log(d.prepare("select sqlite_version() v").get(), require("better-sqlite3/package.json").version);

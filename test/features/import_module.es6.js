// Module imports are correctly handled

module foo from "foo";
module bar from "./foo/bar";

console.log(foo, bar);

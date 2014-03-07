// Imports are correctly rewritten based on scope

import odd from './b';

export default function even(n) {
  // below should be rewritten...
  return n === 0 || odd(n - 1);
}

// below should not
function foo(odd) {
  odd = 1;
}

// nor should this
function bar() {
  var odd;
  console.log(odd);
}

console.log(odd);

// nor should this
function odd() {
}

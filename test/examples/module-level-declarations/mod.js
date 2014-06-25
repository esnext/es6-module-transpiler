var a = 1;

assert.equal(a, 1);
assert.equal(getA(), 1);

function getA() {
  return a;
}
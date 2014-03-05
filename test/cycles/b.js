import even from './a';

export default function odd(n) {
  return n === 0 || even(n - 1);
}

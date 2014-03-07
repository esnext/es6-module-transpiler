// Rewriting named imports works correctly (including aliases)

import { get, set } from 'ember';
import { defer as makeDeferred } from 'rsvp';

// rewrite
console.log(get, set);

// don't rewrite
console.log(defer);

//rewrite
console.log(makeDeferred);

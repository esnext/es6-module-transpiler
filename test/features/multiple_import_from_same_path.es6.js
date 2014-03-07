// Multiple imports from the same module result in the module only being imported once

import { uniq } from 'utils';
import { forEach } from 'utils';

console.log(uniq, forEach);

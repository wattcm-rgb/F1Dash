import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

// @testing-library/react cannot auto-register cleanup when Vitest globals are
// not enabled (the default). Wire it up manually so each test gets a fresh DOM.
afterEach(() => {
  cleanup();
});

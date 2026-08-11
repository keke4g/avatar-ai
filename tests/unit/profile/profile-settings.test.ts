import assert from 'node:assert/strict';
import test from 'node:test';

import { normalizeProfileSettings } from '../../../lib/profile/profileSettings';

test('normalizes editable profile settings without storing location as a favorite', () => {
  assert.deepEqual(
    normalizeProfileSettings({
      name: '  Kevin   Arellano  ',
      bio: '  Asesor en Culiacán.  ',
      location: '  Culiacán,   Sinaloa  ',
      avatar: ' https://example.com/avatar.jpg ',
    }),
    {
      name: 'Kevin Arellano',
      bio: 'Asesor en Culiacán.',
      location: 'Culiacán, Sinaloa',
      avatar: 'https://example.com/avatar.jpg',
    },
  );
});

test('requires a profile name while allowing an empty location and biography', () => {
  assert.throws(
    () => normalizeProfileSettings({ name: '   ', bio: '', location: '', avatar: '' }),
    /nombre es obligatorio/i,
  );

  assert.deepEqual(
    normalizeProfileSettings({ name: 'María', bio: ' ', location: ' ', avatar: '' }),
    { name: 'María', bio: '', location: '', avatar: '' },
  );
});

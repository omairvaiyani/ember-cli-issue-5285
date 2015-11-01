import { moduleFor, test } from 'ember-qunit';

moduleFor('route:about/how-it-works', 'Unit | Route | about/how it works', {
  // Specify the other units that are required for this test.
  // needs: ['controller:foo']
});

test('it exists', function(assert) {
  var route = this.subject();
  assert.ok(route);
});

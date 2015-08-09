import Ember from 'ember';
import EstimateMemoryStrengthMixin from '../../../mixins/estimate-memory-strength';
import { module, test } from 'qunit';

module('Unit | Mixin | estimate memory strength');

// Replace this with your real tests.
test('it works', function(assert) {
  var EstimateMemoryStrengthObject = Ember.Object.extend(EstimateMemoryStrengthMixin);
  var subject = EstimateMemoryStrengthObject.create();
  assert.ok(subject);
});

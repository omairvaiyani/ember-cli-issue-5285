import Ember from 'ember';
import SortByMixin from '../../../mixins/sort-by';
import { module, test } from 'qunit';

module('Unit | Mixin | sort by');

// Replace this with your real tests.
test('it works', function(assert) {
  var SortByObject = Ember.Object.extend(SortByMixin);
  var subject = SortByObject.create();
  assert.ok(subject);
});

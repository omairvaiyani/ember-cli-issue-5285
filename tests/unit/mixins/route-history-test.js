import Ember from 'ember';
import RouteHistoryMixin from '../../../mixins/route-history';
import { module, test } from 'qunit';

module('Unit | Mixin | route history');

// Replace this with your real tests.
test('it works', function(assert) {
  var RouteHistoryObject = Ember.Object.extend(RouteHistoryMixin);
  var subject = RouteHistoryObject.create();
  assert.ok(subject);
});

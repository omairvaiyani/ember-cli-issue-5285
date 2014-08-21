import Ember from 'ember';
import EachItemMixin from 'mycqs-web/mixins/each-item';

module('EachItemMixin');

// Replace this with your real tests.
test('it works', function() {
  var EachItemObject = Ember.Object.extend(EachItemMixin);
  var subject = EachItemObject.create();
  ok(subject);
});

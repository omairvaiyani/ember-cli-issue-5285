import Ember from 'ember';
import EmberParseMixinMixin from 'mycqs-web/mixins/ember-parse-mixin';

module('EmberParseMixinMixin');

// Replace this with your real tests.
test('it works', function() {
  var EmberParseMixinObject = Ember.Object.extend(EmberParseMixinMixin);
  var subject = EmberParseMixinObject.create();
  ok(subject);
});

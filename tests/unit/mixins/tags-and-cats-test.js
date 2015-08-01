import Ember from 'ember';
import TagsAndCatsMixin from '../../../mixins/tags-and-cats';
import { module, test } from 'qunit';

module('Unit | Mixin | tags and cats');

// Replace this with your real tests.
test('it works', function(assert) {
  var TagsAndCatsObject = Ember.Object.extend(TagsAndCatsMixin);
  var subject = TagsAndCatsObject.create();
  assert.ok(subject);
});

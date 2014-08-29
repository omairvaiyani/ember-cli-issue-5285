import Ember from 'ember';

export default Ember.Handlebars.makeBoundHelper(function(value, dp) {
  return Math.round(value);
});

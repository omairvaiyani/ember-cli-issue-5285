import Ember from 'ember';
import ParseHelper from '../utils/parse-helper';

export default Ember.Route.extend({
    model: function (params) {
        this.replaceWith('index.user', params.user_slug);
    }

});

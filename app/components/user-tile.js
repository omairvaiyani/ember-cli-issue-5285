import Ember from 'ember';

export default Ember.Component.extend({
    actions: {
        goToRoute: function () {
            if(!this.get('tile.routeParam'))
                this.get('parentController').transitionTo(this.get('tile.routePath'));
            else
                this.get('parentController').transitionTo(this.get('tile.routePath'), this.get('tile.routeParam'));
        },

        openTestModal: function () {
            this.get('parentController').send('openModal', 'browse/modal/test-info', 'testInfo', this.get('tile.test'));
        }
    }
});

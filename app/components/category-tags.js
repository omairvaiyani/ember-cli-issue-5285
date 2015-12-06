import Ember from 'ember';

export default Ember.Component.extend({
    actions: {
        removeCategory: function (category) {
            if (this.get('overrideAction'))
                return this.get('parentController').send(this.get('overrideAction'));

            if (this.get('canEdit'))
                this.get('parentController').send('removeCategory', category);
        }
    }
});

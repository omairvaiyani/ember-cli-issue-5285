import Ember from 'ember';

export default Ember.Component.extend({
    actions: {
        tagClicked: function () {
            if (this.get('overrideAction'))
                return this.get('parentController').send(this.get('overrideAction'));
        },
        removeTag: function (tag) {
            this.get('parentController').send('removeTag', tag);
        },
        toggleAddingNewTag: function () {
            this.get('parentController').send('toggleAddingNewTag');
        }
    }
});

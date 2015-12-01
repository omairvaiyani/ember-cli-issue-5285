import Ember from 'ember';

export default Ember.Component.extend({
    tags: null,

    /**
     * @Observe Set Tags
     *
     * Allows adding tags directly
     * or through a test
     */
    setTags: function () {
        if(this.get('test.tags.length')) {
            if(!this.get('tags'))
                this.set('tags', new Ember.A());
            else
                this.get('tags').clear();
            this.get('tags').addObjects(this.get('test.tags'));
        }
    }.observes('test.tags.length'),

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

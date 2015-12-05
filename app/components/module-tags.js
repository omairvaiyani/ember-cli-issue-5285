import Ember from 'ember';

export default Ember.Component.extend({
    /**
     * @Property {Array<String>} Tags
     * Provided by parent template
     */
    tags: null,

    /**
     * @Property {Ember.A<Ember.O>} Tag Array
     * This allows the component to
     * monitor the state of each
     * tag, such as editing individual
     * tags.
     */
    tagArray: new Ember.A(),

    tagOrModule: "Tag",

    /**
     * @Observes Tag Array Update
     * See tagArray.
     */
    tagArrayUpdate: function () {
        if(!this.get('tags'))
            return new Ember.A();

        var tagArray = this.get('tagArray');
        tagArray.clear();

        var idIndex = 0;
        this.get('tags').forEach(function (tag) {
            var tagObject = new Ember.Object();
            tagObject.set('tag', tag);
            tagObject.set('editingTag', false);
            tagObject.set('id', "tag-" + idIndex++);
            tagArray.pushObject(tagObject);
        });
    }.observes('tags.length'),

    /**
     * @Init Run Tag Array Update on Start
     * The above observer does not run
     * on init, and so, tagArray is left
     * empty until the first update. This
     * is a workaround.
     */
    runTagArrayUpdateOnStart: function () {
        this.tagArrayUpdate();
    }.on('init'),

    /**
     * @Observe Set Tags
     *
     * Allows adding tags directly
     * or through a test
     */
    setTags: function () {
        if (this.get('test.tags.length')) {
            if (!this.get('tags'))
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
        },

        /**
         * @Action Edit Tag
         * @param tagObject
         */
        editTag: function (tagObject) {
            // Stop other tags from being edited first
            this.send('finishEditingTag');

            tagObject.set('editingTag', true);
            setTimeout(function () {
                $("#" + tagObject.get('id')).focus();
            }, 200);
        },

        /**
         * @Action Stop Editing Tag
         * Catch all, needed as param
         * not sent with input enter.
         */
        finishEditingTag: function () {
            this.get('tagArray').forEach(function (tagObject) {
                tagObject.set('editingTag', false);
            });
        }
    }
});

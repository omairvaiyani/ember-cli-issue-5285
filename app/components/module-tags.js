import Ember from 'ember';

export default Ember.Component.extend({
    addingTag: function () {
        return this.get('parentController.addingTag');
    }.property('parentController.addingTag'),

    /**
     * @Property {Array<String>} Tags
     * Provided by parent template
     */
    tags: null,

    /**
     * @Property Show Max
     * If > 0, only the max
     * number of tags will be displayed,
     * and an overflow tag will
     * be added with a callback
     * to display the rest.
     */
    showMax: 0,

    /**
     * @Property More Tags
     * See 'Show Max' property.
     * This is calculated in
     */
    moreTags: function () {
        if (!this.get('showMax'))
            return 0;

        var totalTags = this.get('tags.length'),
            showMax = this.get('showMax');

        return totalTags - showMax;
    }.property('tags.length'),

    /**
     * @Property Show Overflow Tags
     * See 'Show Max' property.
     * Displayed if 'More Tags'
     * property is greater than 0.
     */
    showOverflowTag: function () {
        return this.get('moreTags') > 0;
    }.property('moreTags'),

    /**
     * @Property {Ember.A<Ember.O>} Tag Array
     * This allows the component to
     * monitor the state of each
     * tag, such as editing individual
     * tags.
     */
    tagArray: null,

    /**
     * @Property Tag or Module
     * Mainly for placeholder text
     * purposes: think onboarding
     * module tags vs create test tags.
     */
    tagOrModule: "Tag",

    /**
     * @Observes Tag Array Update
     * See tagArray.
     */
    tagArrayUpdate: function () {
        if (!this.get('tagArray'))
            this.set('tagArray', new Ember.A());
        else
            this.get('tagArray').clear();

        var tagArray = this.get('tagArray');
        if (!this.get('tags.length')) {
            return;
        }
        var max = this.get('showMax');
        this.get('tags').forEach(function (tag, index) {
            var tagObject = new Ember.Object();
            tagObject.set('tag', tag);
            if (max) {
                tagObject.set('show', index < max)
            } else {
                tagObject.set('show', true);
            }
            tagObject.set('editingTag', false);
            tagObject.set('id', "tag-" + index);
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
     * @Observer Auto End New Tag Insertion
     * Called when 'addingTag' changes, we
     * set a click handler to end tag
     * insertion if user clicks outside of
     * it.
     *
     * Handler is removed once user finishes
     * adding tag OR when the component is
     * destroyed.
     */
    autoEndNewTagInsertion: function () {
        var parentController = this.get('parentController'),
            _this = this;

        if (_this.get('addingTag')) {
            // set click event handler
            setTimeout(function () {
                if(!_this.get('!autoEndNewTagInsertionClickHandlerIsSet')){
                    $(document).bind('click.endNewTagInsertion', function (event) {
                        if (!$(event.target).closest("#new-tag-container").length) {
                            if (parentController.get('addingTag')) {
                                parentController.send('toggleAddingNewTag');
                            }
                        }
                    });
                    _this.set('autoEndNewTagInsertionClickHandlerIsSet', true);
                }
            }, 200);
        } else {
            // off click event
            this.send('unbindEventHandlers');
        }
    }.observes('addingTag'),

    /**
     * @Observer Auto End Editing Tag
     * Called when a tag is being edited, we
     * set a click handler to end tag
     * edit if user clicks outside of
     * it.
     *
     * Handler is removed once user finishes
     * editing tag OR when the component is
     * destroyed.
     */
    autoEndEditingTag: function () {
        var parentController = this.get('parentController'),
            _this = this,
            editingTag = false;

        this.get('tagArray').forEach(function (tagObject) {
            if (tagObject.get('editingTag'))
                editingTag = true;
        });

        if (editingTag) {
            // set click event handler
            setTimeout(function () {
                if(!_this.get('!autoEndEditingTagClickHandlerIsSet')){
                    $(document).bind('click.endEditTag', function (event) {
                        if (!$(event.target).closest('#edit-tag-container').length) {
                            if (editingTag) {
                                editingTag = false;
                                _this.send('finishEditingTag');
                            }
                        }
                    });
                    _this.set('autoEndEditingTagClickHandlerIsSet', true);
                }
            }, 200);
        } else {
            // off click event
            this.send('unbindEventHandlers');
        }
    }.observes('tagArray.@each.editingTag'),

    /**
     * @Override Will Destroy
     * Called by Ember.Component,
     * We remove jQuery click handlers
     * here to avoid memory leaks.
     */
    willDestroy: function () {
        this.send('unbindEventHandlers');
    },

    actions: {
        tagClicked: function () {
            if (this.get('overrideAction'))
                return this.get('parentController').send(this.get('overrideAction'));
        },

        removeTag: function (tagIndex) {
            this.get('parentController').send('removeTag', tagIndex);
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
            this.get('tagArray').forEach(function (tO) {
                tO.set('editingTag', false);
            });
            tagObject.set('editingTag', true);
            setTimeout(function () {
                $("#" + tagObject.get('id')).focus();
            }, 200);
        },

        /**
         * @Action Stop Editing Tag
         * Catch all, needed as param
         * not sent with input enter.
         *
         * Updates the 'tags' array
         * fully, as tagArray.tagObject.tag
         * does not update the parent
         * tags array.
         *
         * Do not change this code.
         */
        finishEditingTag: function () {
            var updatedTags = [];
            this.get('tagArray').forEach(function (tagObject) {
                tagObject.set('editingTag', false);
                updatedTags.push(tagObject.get('tag'));
            }.bind(this));
            this.get('tags').clear();
            this.get('tags').addObjects(updatedTags);
        },

        /**
         * @Action Show Overflow Tags
         * See 'Show Max' property.
         * Called by pressing the moreTags
         * tag: showOverflowTagsAction
         * redirects this action to the
         * controller.
         */
        showOverflowTags: function () {
            var action = this.get('showOverflowTagsAction') ? this.get('showOverflowTagsAction') :
                this.get('overrideAction');
            if (!action)
                console.log("ModuleTagsComponent error, no showOverflowTagsAction defined.");
            else
                this.get('parentController').send(action);
        },

        /**
         * @Action Unbind Event Handlers
         * Called from
         * - this.autoEndNewTagInsertion,
         * - this.autoEndEditingTag
         * - this.willDestroy
         */
        unbindEventHandlers: function () {
            $(document).unbind('click.endNewTagInsertion');
            this.set('autoEndNewTagInsertionClickHandlerIsSet', false);

            $(document).unbind('click.endEditTag');
            this.set('autoEndEditingTagClickHandlerIsSet', false);
        }
    }
});

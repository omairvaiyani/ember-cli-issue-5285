import
Ember
from
'ember';

export default
Ember.ObjectController.extend({
    needs: ['application', 'editQuestion'],
    currentUser: Ember.computed.alias('controllers.application.currentUser'),
    isTestDirty: function () {
        if (this.get('isDirty') ||
            this.get('controllers.editQuestion.content.isDirty') ||
            this.get('controllers.editQuestion.content.areOptionsDirty'))
            return true;
        else
            return false;
    }.property('isDirty', 'controllers.editQuestion.content.isDirty',
            'controllers.editQuestion.content.areOptionsDirty'),
    categories: function () {
        return this.store.find('category');
    }.property(),
    categorySelectionInput: "",
    categorySelectionList: function () {
        var categories = this.get('categories');
        if (categories && this.get('categorySelectionInput')) {
            var searchInputLowercase = this.get('categorySelectionInput').toLowerCase();
            return categories.filter(function (category) {
                return category.get('name').toLowerCase().indexOf(searchInputLowercase) != -1;
            });
        } else {
            return [];
        }
    }.property('categorySelectionInput'),
    newCategoryParentSelectionList: function () {
        var categories = this.get('categories');
        if (categories && this.get('newCategoryParentInput')) {
            var searchInputLowercase = this.get('newCategoryParentInput').toLowerCase();
            return categories.filter(function (category) {
                return category.get('name').toLowerCase().indexOf(searchInputLowercase) != -1;
            });
        } else {
            return [];
        }
    }.property('newCategoryParentInput'),
    tagsStringified: "",
    stringifyTags: function() {
        var tagsStringified = "";
        for(var i = 0; i < this.get('tags.length'); i++) {
            tagsStringified += this.get('tags.'+i) + ", ";
        }
        if(tagsStringified)
            this.set('tagsStringified',tagsStringified.slice('0', -2));
        else
            this.set('tagsStringified', tagsStringified);
    }.observes('content.objectId'),
    actions: {
        saveTest: function () {
            var questions = this.get('questions.content.content');
            for (var i = 0; i < questions.length; i++) {
                var question = questions[i];
                if (question.get('isDirty')) {
                    question.set('areOptionsDirty', false);
                    question.save();
                }
            }
            this.set('tags', this.get('tagsStringified').split(', '));
            this.set('title', this.get('title').capitalize());
            this.get('model').save();
        },
        categorySelected: function (category) {
            /*
             * Setting a category results in the categorySelection template
             * element being hidden
             */
            this.set('category', category);
            this.set('categorySelectionInput', category.get('name'));

        },
        newCategoryParentSelected: function (category) {
            console.dir(category);
            this.set('newCategoryParentInput', category.get('name'));
            this.set('newCategoryParent', category);
        },
        categorySelectionInputChanged: function () {
            /*
             * This is called when the user clicks on an already selected
             * category tag, thereby removing it from selection.
             * Setting a category to null results in the categorySelection
             * template element being shown
             */
            this.set('category', null);
        },
        removeCategory: function (shouldRemoveText) {
            /*
             * Allow users to either:
             * - Remove category tag completely (shouldRemoveText = true)
             * - Remove category tag but keep the text (shouldRemoveText = false)
             * categorySelectionInput is set to "" due to the DOM element reset
             */
            if (shouldRemoveText) {
                this.set('categorySelectionInput', "");
            } else {
                this.set('categorySelectionInput', this.get('category.name'));
            }
            this.set('category', null);
        },
        removeNewCategoryParent: function (shouldRemoveText) {
            if (shouldRemoveText) {
                this.set('newCategoryParentInput', "");
            } else {
                this.set('newCategoryParentInput', this.get('newCategoryParent.name'));
            }
            this.set('category', null);
        },
        createNewCategory: function () {
            console.log("Create new category!");
            var level = this.get('newCategoryParent') ? (this.get('newCategoryParent.level') + 1) : 1;
            var newCategory = this.get('store').createRecord('category', {
                name: this.get('categorySelectionInput').capitalize(),
                parent: this.get('newCategoryParent'),
                level: level
            });
            var controller = this;
            newCategory.save().then(function (category) {
                controller.set('category', category);
                controller.set('newCategoryParentInput', '');
                controller.set('newCategoryParent', null);
                controller.send('closeModal');
            });

        },
        beginAddingQuestions: function () {
            var test = this.get('model');
            if (!this.get('currentUser')) {
                console.log("Not logged in!");
                return;
            }
            test.set('author', this.get('currentUser'));
            test.save().then(function (test) {
                this.set('categorySelectionInput', '');
                this.transitionToRoute('edit.newQuestion', test);
            }.bind(this));
        },
        deleteObjectsInActionBar: function (objects) {
            /*
             * Delete questions from test.
             * We are not DELETING the questions
             * permenantly. They will remain on
             * the server unlinked to this test.
             * Save the test with the updated
             * 'questions' array
             */
            this.get('questions').removeObjects(objects);
            this.get('model').save();
        }
    }
})
;

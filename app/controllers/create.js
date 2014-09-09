import
Ember
from
'ember';


import
CurrentUser
from
'../mixins/current-user';

export default
Ember.ObjectController.extend(CurrentUser, {
    needs: ['application', 'editQuestion'],

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
    stringifyTags: function () {
        var tagsStringified = "";
        for (var i = 0; i < this.get('tags.length'); i++) {
            tagsStringified += this.get('tags.' + i) + ", ";
        }
        if (tagsStringified)
            this.set('tagsStringified', tagsStringified.slice('0', -2));
        else
            this.set('tagsStringified', tagsStringified);
    }.observes('content.objectId'),

    /*
     * The handlebar for checkbox input cannot decipher booleans
     * from numbers, which privacy is defined by. We have a computed
     * boolean within the Test model called privacyBoolean. This
     * works one way only. Therefore, updating privacyBoolean
     * requires manual update for the actual privacy property set
     * on the model.
     */
    updatePrivacyFromPrivacyBoolean: function () {
        if (this.get('privacyBoolean'))
            this.set('model.privacy', true);
        else
            this.set('model.privacy', false);
    }.observes('privacyBoolean'),

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
            if (!this.get('currentUser')) {
                this.send('askGuestToSignUp');
                return;
            } else {
                this.set('model.author', this.get('currentUser'));
            }
            this.send('incrementLoadingItems');
            this.get('model').save().then(function (test) {
                this.set('categorySelectionInput', '');
                this.transitionToRoute('edit.newQuestion', test.get('slug'));
                this.send('decrementLoadingItems');
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
        },

        /*
         * No support for anonymous users on JS SDK
         * Therefore, force users to sign up/log in before
         * continuing. Redirect application route to
         * return the user back to this page and
         * continue saving the test.
         */
        askGuestToSignUp: function () {
            alert("You have to be logged in to create a test!");
            this.send('openModal', 'application/modal/login-or-register', 'application');
            this.get('controllers.application').set('redirectAfterLoginToRoute', 'create');
        },
        returnedFromRedirect: function () {
            this.send('beginAddingQuestions');
        }
    }
});

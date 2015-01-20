import Ember from 'ember';
import CurrentUser from '../mixins/current-user';
import EventTracker from '../utils/event-tracker';

export default Ember.ObjectController.extend(CurrentUser, {
    needs: ['application', 'editQuestion', 'join'],

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

    parentCategory: null,
    parentCategories: function () {
        if (!this.get('categories.length'))
            return [];
        else
            return this.get('categories').filterProperty('level', 1).sortBy('name');
    }.property('categories.length'),

    childCategory: null,
    childCategories: function () {
        if (!this.get('parentCategory'))
            return [];
        else
            return this.get('categories').filterProperty('_data.parent', this.get('parentCategory')).sortBy('name');
    }.property('parentCategory.name'),

    childOrParentCategorySelected: function () {
        if (this.get('childCategory'))
            this.set('category', this.get('childCategory'));
        else if (this.get('parentCategory') && !this.get('parentCategory.hasChildren'))
            this.set('category', this.get('parentCategory'));
        else
            this.set('category', null);
    }.observes('parentCategory', 'childCategory'),

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

    isCreatingNewQuestion: function () {
        return this.get('controllers.application.currentPath') === "edit.newQuestion";
    }.property('controllers.application.currentPath'),

    /*
     * Group Test
     */
    selectedGroup: null,
    setSelectedGroup: function () {
        if (this.get('group'))
            this.set('selectedGroup', this.get('group.content'));
        else
            this.set('selectedGroup', null);
    }.observes('group.id'),
    setGroup: function () {
        if (this.get('group.id') !== this.get('selectedGroup.id'))
            this.set('group', this.get('selectedGroup'));
    }.observes('selectedGroup.id'),

    getGroups: function () {
        if (this.get('currentUser'))
            this.get('currentUser').getGroups(this.store);
    }.on('init'),

    /*
     * Join process
     */
    joinController: function () {
        return this.get('controllers.join');
    }.property('controllers.join'),

    joinStep: function () {
        return this.get('joinController.joinStep');
    }.property('joinController.joinStep'),

    inJoinProcess: function () {
        if (!this.get('currentUser')) {
            if (!this.get('joinStep.create')) {
                this.set('joinStep.create', {
                    active: false,
                    disabled: false,
                    completed: false
                });
                this.set('joinStep.addQuestions', {
                    active: false,
                    disabled: true,
                    completed: false
                });
                this.set('joinStep.join.active', false);
                this.set('joinStep.join.disabled', true);
            }
            this.set('joinStep.create.active', true);
            return true;
        } else {
            // Logged in but are they in the middle of joining?
            if (!this.get('joinStep.completed') && (
                this.get('joinStep.create.active') ||
                this.get('joinStep.join.active') ||
                this.get('joinStep.personalise.active') ||
                this.get('joinStep.features.active') ||
                this.get('joinStep.addQuestions.active'))) {
                return true;
            } else
                return false;
        }
    }.property('currentUser', 'joinStep.completed'),

    actions: {
        removeCategory: function (category) {
            this.set('category', null);
            if (category.get('level') === 1)
                this.set('parentCategory', null);
            this.set('childCategory', null);
        },

        checkTest: function (callback) {
            if (!this.get('category.content')) {
                this.send('addNotification', 'warning', 'Category not set!', 'You must set a category!');
                return;
            } else if (!this.get('title.length')) {
                this.send('addNotification', 'warning', 'Title not set!', 'You must set a title for the test!');
                return;
            } else if (this.get('inJoinProcess')) {
                if (this.get('joinStep.create.active')) {
                    this.send('goToJoinStep', 'join');
                    return;
                }
            }
            this.set('model.author', this.get('currentUser'));
            if (this.get('selectedGroup.id')) {
                this.set('group', this.get('selectedGroup'));
                if (this.get('group.privacy') === 'secret')
                    this.set('privacy', 0);
                else
                    this.set('privacy', 1);
            }
            this.send('incrementLoadingItems');
            var promise = this.get('model').save();
            if (callback)
                callback(promise);
            promise.then(function (test) {
                    this.set('categorySelectionInput', '');
                    this.transitionToRoute('edit.newQuestion', test.get('slug'));
                    this.send('decrementLoadingItems');
                    if (this.get('currentUser.tests'))
                        this.get('currentUser.tests').pushObject(this.get('model'));
                    if (this.get('inJoinProcess')) {
                        this.send('addNotification', 'welcome', 'Congratulations!',
                            'You are now ready to start creating tests on MyCQs!');
                        setTimeout(function () {
                            this.get('joinController').set('joinStep.completed', true);
                        }.bind(this), 2500);
                    }
                    EventTracker.recordEvent(EventTracker.CREATED_TEST, test);
                }.bind(this),
                function (error) {
                    this.send('decrementLoadingItems');
                    console.dir(error);
                }.bind(this));
        },

        saveTest: function () {
            if (!this.get('category.content')) {
                console.log("No category set!");
                return;
            }
            this.send('incrementLoadingItems');
            var questions = this.get('questions.content.content');
            for (var i = 0; i < questions.length; i++) {
                var question = questions[i];
                if (question.get('isDirty')) {
                    question.set('areOptionsDirty', false);
                    question.save();
                }
            }
            this.set('title', this.get('title').capitalize());
            this.get('model').save().then(
                function () {
                    this.send('decrementLoadingItems');
                    this.send('addNotification', 'saved', this.get('title'), 'All changes saved!');
                }.bind(this),

                function (error) {
                    this.send('decrementLoadingItems');
                    this.send('addNotification', 'error', 'An error occurred', "Could not save test!");
                }.bind(this));
        },

        /*
         * Sets a delete flag
         * Cloud code sets no read/write ACL
         * .deleteRecord() only removes the record from Ember Data
         */
        deleteTest: function () {
            this.get('model').set('isObjectDeleted', true);
            this.get('model').save().then(function (model) {
                this.send('addNotification', 'deleted', "Test deleted!", model.get('title') + " was deleted successfully.");
                this.get('currentUser.tests').removeObject(this.get('model'));
                model.deleteRecord();
            }.bind(this));

            this.send('closeModal');
            this.transitionToRoute('index');
        },

        toggleQuestionListCheckboxes: function () {
            this.toggleProperty('showQuestionListCheckBoxes');
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
            var length = objects.length;
            this.get('questions').removeObjects(objects);
            this.get('model').save();
            this.set('showQuestionListCheckBoxes', false);
            this.transitionToRoute('edit');
            if (length === 1)
                this.send('addNotification', 'deleted', 'Question deleted!', 'Your test is up to date!');
            else
                this.send('addNotification', 'deleted', length + ' questions deleted!', 'Your test is up to date!');
        },

        goToJoinStep: function (step, callback) {
            if (step === 'create' || step === 'addQuestions') {
                // create and addQuestions are not handled by the JoinController.
                this.set('joinStep.create.active', false);
                this.set('joinStep.join.active', false);
                this.set('joinStep.personalise.active', false);
                this.set('joinStep.features.active', false);
                this.set('joinStep.addQuestions.active', false);
                if (step === 'create') {
                    this.set('joinStep.create.active', true);
                    this.transitionToRoute('create.index');
                } else if (step === 'addQuestions') {
                    this.set('joinStep.features.completed', true);
                    this.set('joinStep.addQuestions.active', true);
                    this.set('joinStep.addQuestions.disabled', false);
                    this.send('checkTest', callback);
                }
            } else
                this.get('joinController').send('goToJoinStep', step); // clears other steps
        }
    }

    /*
     * DEPRECATED
     * - Category input and creation hooks
     * - Tag inputboly
     */
    /*categorySelectionInput: "",
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
     actions: {
     categorySelected: function (category) {
     /*
     * Setting a category results in the categorySelection template
     * element being hidden
     */ /*
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
     */ /*
     this.set('category', null);
     },
     removeCategory: function (shouldRemoveText) {
     */ /*
     * Allow users to either:
     * - Remove category tag completely (shouldRemoveText = true)
     * - Remove category tag but keep the text (shouldRemoveText = false)
     * categorySelectionInput is set to "" due to the DOM element reset
     */
    /*
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

     }
     }
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
     }.observes('content.objectId'),*/


});

import Ember from 'ember';
import CurrentUser from '../mixins/current-user';
import EventTracker from '../utils/event-tracker';
import ParseHelper from '../utils/parse-helper';
import DeleteWithUndo from '../mixins/delete-with-undo';
import TagsAndCats from '../mixins/tags-and-cats';

export default Ember.Controller.extend(CurrentUser, DeleteWithUndo, TagsAndCats, {
    needs: ['application', 'editQuestion'],

    isTestDirty: function () {
        return this.get('isDirty') ||
            this.get('controllers.editQuestion.content.isDirty') ||
            this.get('controllers.editQuestion.content.areOptionsDirty');
    }.property('isDirty', 'controllers.editQuestion.content.isDirty',
        'controllers.editQuestion.content.areOptionsDirty'),

    categories: function () {
        return this.store.all('category');
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
        else {
            return this.get('categories').filterProperty('parent.id', this.get('parentCategory.id')).sortBy('name');
        }
    }.property('parentCategory.name'),

    childOrParentCategorySelected: function () {
        if (this.get('childCategory'))
            this.set('model.category', this.get('childCategory'));
        else if (this.get('parentCategory') && !this.get('parentCategory.hasChildren'))
            this.set('model.category', this.get('parentCategory'));
        else
            this.set('model.category', null);
    }.observes('parentCategory', 'childCategory'),

    isCreatingNewQuestion: function () {
        return this.get('controllers.application.currentPath') === "edit.newQuestion";
    }.property('controllers.application.currentPath'),


    currentQuestion: function () {
        return this.get('controllers.editQuestion.model');
    }.property('controllers.editQuestion.model'),

    currentQuestionNumber: function () {
        var currentQuestion = this.get('currentQuestion');
        if (currentQuestion && this.get('model.questions').contains(currentQuestion))
            return this.get('model.questions').indexOf(currentQuestion) + 1;
        else
            return this.get('model.questions.length') + 1;
    }.property('currentQuestion', 'model.questions.length'),

    actions: {
        removeCategory: function (category) {
            this.set('model.category', null);
            if (category.get('level') === 1)
                this.set('parentCategory', null);
            this.set('childCategory', null);
        },

        checkTest: function (callback) {
            var error = false,
                notification;

            if (!this.get('model.title.length')) {
                notification = {
                    type: "warning",
                    title: "Title not set!",
                    message: "'You must set a title for the test!'"
                };
                this.send('addNotification', notification);
                error = true;
            }
            if (!this.get('model.category.content')) {
                notification = {
                    type: "warning",
                    title: "Category not set!",
                    message: "'You must set a category for the test!'"
                };
                this.send('addNotification', notification);
                error = true;
            }
            if (this.get('inJoinProcess')) {
                if (this.get('joinStep.create.active')) {
                    this.send('goToJoinStep', 'join');
                    error = true;
                }
            }
            this.set('checkTestError', error);
            if (error)
                return callback(new Parse.Promise().reject());

            this.set('model.author', this.get('currentUser'));
            if (this.get('selectedGroup.id')) {
                this.set('model.group', this.get('selectedGroup'));
                if (this.get('model.group.privacy') === 'secret')
                    this.set('privacy', 0);
                else
                    this.set('privacy', 1);
            }
            this.send('incrementLoadingItems');
            var promise = ParseHelper.cloudFunction(this, 'createNewTest', {test: this.get('model')});

            promise.then(function (response) {
                    this.send('newUserEvent', response);
                    var test = ParseHelper.extractRawPayload(this.store, 'test', response.test);
                    this.set('model', test);
                    this.set('categorySelectionInput', '');
                    this.transitionToRoute('edit.newQuestion', test.get('slug'));
                    this.send('decrementLoadingItems');
                    if (this.get('currentUser.createdTests'))
                        this.get('currentUser.createdTests').pushObject(this.get('model'));

                EventTracker.recordEvent(EventTracker.CREATED_A_TEST, {
                    "Test Category(ID)":test.get('category.id'),
                    "Test Category(NAME)":test.get('category.name'),
                    "Test(Title)":test.get('title'),
                    "Test(ID)":test.get('id'),
                    "Is Public": test.get('isPublic'),
                    "Number Of Tags": test.get('tags.length'),
                    "Added Description": test.get('description.length') > 0
                });

                }.bind(this),
                function (error) {
                    this.send('decrementLoadingItems');
                    console.dir(error);
                }.bind(this));

            if (callback)
                callback(promise);
        },

        saveTest: function (callback) {
            if (!this.get('model.category.content')) {
                console.log("No category set!");
                return;
            }
            this.set('model.title', this.get('model.title').capitalize());
            if (typeof this.get('model.tags') === 'string')
                this.set('model.tags', this.get('model.tags').split(','));

            this.send('incrementLoadingItems');
            this.get('model.questions').then(function (questions) {
                questions.forEach(function (question) {
                    if (!question.get('tags') ||
                        JSON.stringify(this.get('model.tags')) !== JSON.stringify(question.get('tags'))) {
                        question.set('tags', this.get('model.tags'));
                        question.save();
                    }
                }.bind(this));
            }.bind(this));
            var promise = this.get('model').save().then(
                function () {
                    this.send('decrementLoadingItems');
                    this.send('addNotification', 'saved', this.get('model.title'), 'All changes saved!');
                    if (callback)
                        callback(true);
                }.bind(this),

                function (error) {
                    this.send('decrementLoadingItems');
                    this.send('addNotification', 'error', 'An error occurred', "Could not save test!");
                    if (callback)
                        callback(false);
                }.bind(this));
        },

        /**
         * @Action Delete Test
         * Relays call to DeleteWithUndo mixin.
         */
        deleteTest: function () {
            this.send('deleteObject', {
                object: this.get('model'), array: this.get('currentUser.createdTests'),
                title: "Test deleted!", message: this.get('model.title')
            });
            this.transitionTo('index');
        },

        /**
         * @Action Delete Question
         * Relays call to DeleteWithUndo mixin.
         *
         * @param {Object} question
         * @param {Boolean} isCurrent
         */
        deleteQuestion: function (question, isCurrent) {
            this.send('deleteObject', {
                object: question, array: this.get('model.questions'),
                title: "Question deleted!", message: question.get('stem'),
                isCurrent: isCurrent
            });
            if (isCurrent)
                this.transitionTo('edit.index');
        },

        postObjectDelete: function (returnItem) {
            if (returnItem.type === "test") {

            } else if (returnItem.type === "question") {
                this.get('model').save();
            }
        },

        /**
         * @Action Undo Object Delete
         * Relayed from DeleteWithUndo mixin.
         *
         * IF TEST
         * - The user will have been sent to IndexRoute. Bring them back.
         *
         * IF QUESTION
         * - IF isCurrent, transition back to editing it.
         */
        undoObjectDelete: function (returnItem, error) {
            if (returnItem.type === "test") {
                this.transitionTo('edit.index', returnItem.object.get('slug'));
            } else if (returnItem.type === "question") {
                if (returnItem.isCurrent)
                    this.transitionTo('editQuestion', returnItem.object.id);
            }
        },

        finishedEditing: function () {
            var callback = function (isSaved) {
                if (isSaved)
                    this.transitionTo('testInfo', this.get('model.slug'));
            }.bind(this);
            this.send('saveTest', callback);
        },

        openEditInfoModal: function () {
            this.send('openModal', 'edit/modal/edit-info', this);
        }
    }

});

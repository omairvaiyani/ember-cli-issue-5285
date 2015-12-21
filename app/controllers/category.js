import Ember from 'ember';
import ParseHelper from '../utils/parse-helper';
import CurrentUser from '../mixins/current-user';
import TagsAndCats from '../mixins/tags-and-cats';
import SortBy from '../mixins/sort-by';
import EstimateMemoryStrength from '../mixins/estimate-memory-strength';
import DeleteWithUndo from '../mixins/delete-with-undo';

export default Ember.Controller.extend(CurrentUser, TagsAndCats, SortBy, EstimateMemoryStrength,
    DeleteWithUndo, {

    needs: 'application',

    applicationController: function () {
        return this.get('controllers.application');
    }.property('controllers'),

    init: function () {
        this.get('listOrders').insertAt(0, {value: "relevance", label: "Relevance", reverse: true});
    },

    // Needed by SortByMixin and TestCardComponent
    controllerId: 'browseTests',

    queryParams: ['searchTerm'],

    searchClient: function () {
        return this.get('applicationController.searchClient');
    }.property('applicationController.searchClient'),

    testIndexName: function () {
        // TODO add more indices to match listOrders
        switch (this.get('listOrder.value')) {
            case "relevance":
                return "Test";
            case "title":
                return "Test_title(ASC)";
            case "difficulty":
                return "Test_difficulty(DESC)";
            default:
                return "Test";
        }
    }.property('listOrder'),

    tests: new Ember.A(),

    childCategories: new Ember.A(),

    /*
     * Gets all the child categories that belong
     * to the parent model category.
     */
    getChildCategories: function () {
        if (this.get('model.browseAll')) {
            /*
             * Avoid repetitive calls from property changes
             * Reset on model change in route
             */
            if (this.get('alreadyGotChildCategoriesForBrowseAll'))
                return;
            this.set('alreadyGotChildCategoriesForBrowseAll', true);

            this.set('readyToGetTests', true);
        }
        if (this.get('alreadyGotChildCategories'))
            return;
        /*
         * Get this category's or categoryParent's child categories
         */
        var parentId;
        if (this.get('model.parent.id') && !this.get('model.hasChildren')) {
            parentId = this.get('model.parent.id');
        } else if (this.get('model.hasChildren')) {
            parentId = this.get('model.id');
        } else {
            this.set('readyToGetTests', true);
            this.set('alreadyGotChildCategories', true);
            return this.set('childCategories', new Ember.A());
        }
        var childCategories = this.store.all('category').filterBy('parent.id', parentId).sortBy('name');
        this.get('childCategories').clear();
        this.get('childCategories').addObjects(childCategories);
        this.set('readyToGetTests', true);
        this.set('alreadyGotChildCategories', true);
    }.observes('model.id', 'model.browseAll'),

    readyToGetTests: false,

    searchTerm: "",

    getTests: function (fetchMore) {
        var categoryFilter;

        if (this.get('model.hasChildren')) {
            categoryFilter = [];
            this.get('childCategories').forEach(function (category) {
                categoryFilter.push("category.objectId:" + category.get('id'));
            });
        } else if (this.get('model.id')) // Other wise don't include a category filter
            categoryFilter = "category.objectId:" + this.get('model.id');
        var page = 0;

        if (fetchMore)
            page = this.get('currentResultsPage') + 1;
        else {
            /* var topOfResultsFlag = $("#top-of-results");
             $('html, body').animate({
             scrollTop: topOfResultsFlag.offset().top - 16
             }, 500);*/
            window.scrollTo(0, 0);
        }
        this.send('incrementLoadingItems');
        return ParseHelper.cloudFunction(this, 'performSearch',
            {
                indexName: this.get('testIndexName'),
                searchTerm: this.get('searchTerm'),
                options: {
                    tagFilters: this.get('activeTags'),
                    facets: "category.objectId",
                    facetFilters: [categoryFilter],
                    hitsPerPage: 10,
                    page: page
                }
            }).then(function (response) {
            if (response.query !== this.get('searchTerm'))
                return;
            this.set('currentResultsPage', response.page);
            if (response.page < (response.nbPages - 1))
                this.set('moreResultsToFetch', true);
            else
                this.set('moreResultsToFetch', false);
            this.set('totalResults', response.nbHits);
            var tests = ParseHelper.extractRawPayload(this.store, 'test', response.hits);
            if (!fetchMore) {
                this.get('tests').clear();
                this.get('tests').pushObjects(tests);
            } else {
                // New page will be appended by components/infinite-scroll
                // Check actions.fetchMore
                return tests;
            }
        }.bind(this), function (error) {
            console.dir(error);
        }).then(function (tests) {
            this.send('decrementLoadingItems');
            if (tests)
                return tests;
        }.bind(this));
    },

    throttleGetTests: function () {
        Ember.run.debounce(this, this.getTests, 200);
    }.observes('searchTerm.length', 'activeTags.length', 'activeCategories.length', 'testIndexName',
        'model.id', 'readyToGetTests'),

    /*
     * Sets a semantic page description for SEO.
     */
    /**
     * @Property SEO Page Header
     * Seen in the browser, page title and optimised for SEO.
     */
    seoPageHeader: function () {
        var pageTitle;
        if (this.get('model.id'))
            pageTitle = this.get('model.distinctName') + " MCQs";
        else
            pageTitle = "Browse";
        this.send('updatePageTitle', pageTitle);
        return pageTitle;
    }.property('model'),

    /**
     * @Property SEO Page Description
     * Seen in the sub-header, optimised for SEO.
     */
    seoPageDescription: function () {
        if (!this.get('model.id'))
            return "";
        var totalTests = this.get('model.totalTests');
        if (totalTests > 100)
            totalTests = "over " + (Math.floor(totalTests / 10) * 10);
        var description = "Search from " + totalTests + " ";
        description += Em.getWithDefault(this.get('model'), 'secondaryName', this.get('model.name')).toLowerCase() + " mcqs";
        if (this.get('seoChildCategories.length')) {
            description += " on a range of topics such as " + this.get('seoChildCategories');
        }
        description += ".";
        return description;
    }.property('model.id'),


    /**
     * @Property SEO Child Categories
     * Used by seoPageDescription and setMetaPageDescription.
     * A random assortment from the childCategories, optimised
     * for SEO.
     */
    seoChildCategories: function () {
        if (!this.get('model.id') || !this.get('childCategories.length') || !this.get('model.hasChildren'))
            return "";
        else {
            var seoString = "",
                shuffledChildCategories = _.shuffle(this.get('childCategories')),
                totalCategories = this.get('childCategories.length');

            if (totalCategories > 8)
                totalCategories = 8;

            for (var i = 0; i < totalCategories; i++) {
                if (shuffledChildCategories[i].get('name') === "Other")
                    continue;
                var name = shuffledChildCategories[i].get('secondaryName');
                if (!name)
                    name = shuffledChildCategories[i].get('name');
                name = name.toLowerCase();
                if (i < (totalCategories - 1))
                    seoString += name + ", ";
                else
                    seoString = seoString.slice(0, -2) + " and " + name;
            }
            return seoString;
        }
    }.property('childCategories.length'),

    /**
     * @Function Set Meta Page Description
     * Only seen by search engines.
     */
    setMetaPageDescription: function () {
        if (this.get('model.id') && (this.get('tests.length') || !window.prerenderReady)) {
            var childCategoryText = "";
            if (this.get('childCategories.length')) {
                if (this.get('childCategories').objectAt(0))
                    childCategoryText += "" + this.get('childCategories').objectAt(0).get('name').toLowerCase();
                if (this.get('childCategories').objectAt(1))
                    childCategoryText += ", " + this.get('childCategories').objectAt(1).get('name').toLowerCase();
                if (this.get('childCategories').objectAt(2))
                    childCategoryText += ", " + this.get('childCategories').objectAt(2).get('name').toLowerCase();
                childCategoryText += " and more";
            }
            this.send('updatePageDescription', "Take MCQs in " + childCategoryText +
                "! There are " + this.get('model.totalTests') +
                " tests to choose from, or create your own quizzes for free!");
            this.send('prerenderReady');
        } else {
            this.send('updatePageDescription', "Search from 1000s of free MCQs here on Synap, or create your own!");
            this.send('prerenderReady');
        }
    }.observes('model.id'),

    actions: {
        /**
         * @Override TagsAndCatsMixin
         * @Action Toggle Category Filter
         * Only performs transitions based
         * on active/inactive cats. Logic
         * is further performed in SubcategoryRoute.setupController.
         * @param {Category} object
         */
        toggleCategoryFilter: function (object) {
            var category = object.get('content') ? object.get('content') : object;
            if (!category)
                return;

            // Toggle on/off depending if found or not
            if (_.contains(this.get('activeCategories'), category)) {
                this.transitionTo('category', category.get('parent.slug'));
            } else {
                this.transitionTo('subcategory', category.get('parent.slug'), category.get('slug'));
            }

        },

        fetchMore: function (callback) {
            var promise = this.getTests(true);
            callback(promise);
        },

        /**
         * @Action Delete Test
         *
         * Called by TestCardComponent
         * For now, this will only be
         * done by Admins - we have
         * disabled the delete test
         * option on Browse for other
         * users.
         *
         * @param test
         */
        deleteTest: function (test) {
            if (test.get('author.id') === this.get('currentUser.id')) {
                this.send('deleteObject', {
                    array: this.get('currentUser.createdTests'), object: test,
                    title: "Quiz deleted!", message: test.get('title')
                });
            } else {
                // Called by Admin
                this.send('deleteObject', {
                    array: this.get('tests'), object: test,
                    title: "[ADMIN] Quiz deleted!", message: test.get('title')
                });
            }
        },

        // Callback from DeleteWithUndoMixin
        preObjectDelete: function (returnItem) {
            if (returnItem.type === "test") {

            }
        },

        undoObjectDelete: function (returnItem, error) {
            // Called if object delete is undo'd,
            // TODO see if scrolling to test helps
        }

    }

});

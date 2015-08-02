import Ember from 'ember';
import ParseHelper from '../utils/parse-helper';
import CurrentUser from '../mixins/current-user';
import TagsAndCats from '../mixins/tags-and-cats';

export default Ember.Controller.extend(CurrentUser, TagsAndCats, {
    needs: 'application',

    applicationController: function () {
        return this.get('controllers.application');
    }.property('controllers'),

    init: function () {
        // algolia Search API
        var algoliaClient = algoliasearch("ONGKY2T0Y8", "8553807a02b101962e7bfa8c811fd105"),
            testIndex = algoliaClient.initIndex('Test');
        this.set('testIndex', testIndex);
    },

    loadingItems: 0,

    queryParams: ['page', 'order', 'search'],

    /*
     * Query paramaters
     */

    page: 1,

    order: 'relevance',

    search: '',

    /*
     * Query: Pagination
     */

    limit: 10,

    skip: function () {
        return (this.get('page') * 10) - this.get('limit');
    }.property('page', 'limit'),

    previousPage: function () {
        return this.get('page') - 1;
    }.property('page'),

    nextPage: function () {
        if (this.get('page') < this.get('totalPages'))
            return this.get('page') + 1;
        else
            return false;
    }.property('page', 'totalPages'),

    totalPages: function () {
        var totalPages = Math.round(this.get('tests.length') / this.get('limit'));
        if (!totalPages) return 1;
        else return totalPages;
    }.property('tests.length', 'limit'),

    pagesInPagination: function () {
        var pagesToShow = [];
        if (this.get('page') < 4 || this.get('totalPages') < 6) {
            for (var i = 1; i < 6; i++) {
                if (i > this.get('totalPages'))
                    break;
                pagesToShow.push(i);
            }
        } else {
            for (var i = (this.get('page') - 2); i < (this.get('page') + 2); i++) {
                if (i > this.get('totalPages'))
                    break;
                pagesToShow.push(i);
            }
        }
        if (pagesToShow.indexOf(1) === -1)
            pagesToShow.insertAt(0, 1);
        if (pagesToShow.indexOf(this.get('totalPages')) === -1)
            pagesToShow.push(this.get('totalPages'));
        return pagesToShow;
    }.property('page', 'totalPages'),

    tests: new Ember.A(),
    childCategories: new Ember.A(),
    orderTypes: [{label: "Relevance", value: "quality"}, {label: "Title A-Z", value: "title"},
        {label: "Difficulty", value: "difficulty"}],

    /*
     * Gets all the child categories that belong
     * to the parent model category.
     */
    getChildCategories: function () {
        if (this.get('browseAll')) {
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
    }.observes('model.id', 'browseAll'),

    readyToGetTests: false,
    getTests: function () {
        return;
        if (!this.get('readyToGetTests'))
            return;
        this.send('incrementLoadingItems');
        /*
         * Get tests which belong to the parent category
         * AND any of the selected childCategories
         */
        var queryOptions = [];

        // ORDER
        var orderField,
            orderMethod = "descending";

        if (this.get('order') === 'recent')
            orderField = "createdAt";
        if (this.get('order') === 'relevance')
            orderField = "quality";

        queryOptions.push({
            method: orderMethod,
            value: orderField
        });

        // SEARCH FILTER
        if (this.get('search.length')) {
            var stopWords = ParseHelper.stopWords,
                tags = _.filter(this.get('search').toLowerCase().split(' '), function (w) {
                    return w.match(/^\w+$/) && !_.contains(stopWords, w);
                });
            queryOptions.push({
                method: "containsAll",
                key: "tags",
                value: tags
            });
        }
        // WHERE CATEGORY
        if (!this.get('browseAll') && this.get('model.hasChildren')) {
            queryOptions.push({
                method: "containedIn",
                key: "category",
                value: ParseHelper.generatePointers(this.get('childCategories'))
            });
        } else if (this.get('model.parent.id') || !this.get('model.hasChildren')) {
            queryOptions.push({
                method: "equalTo",
                key: "category",
                value: ParseHelper.generatePointer(this.get('model'), 'category')
            });
        }
        queryOptions.push({
            method: "limit",
            value: 20
        });
        ParseHelper.cloudFunction(this, 'getCommunityTests', {queryOptions: queryOptions})
            .then(function (response) {
                var tests = ParseHelper.extractRawPayload(this.store, 'test', response);
                this.get('tests').clear();
                this.get('tests').addObjects(tests);
                this.send('decrementLoadingItems');
            }.bind(this));
    }.observes('model.id', 'readyToGetTests', 'order'),

    searchTerm: "",

    getTestsNew: function () {
        var categoryFilter;
        if (this.get('model.hasChildren')) {
            categoryFilter = [];
            this.get('childCategories').forEach(function (category) {
                categoryFilter.push("category.objectId:" + category.get('id'));
            });
        } else
            categoryFilter = "category.objectId:" + this.get('model.id');
        this.get('testIndex').search(this.get('searchTerm'),
            {
                tagFilters: this.get('activeTags'),
                facets: "*",
                facetFilters: [categoryFilter]
            }).then(function (response) {
                if (response.query !== this.get('searchTerm'))
                    return;
                var tests = ParseHelper.extractRawPayload(this.store, 'test', response.hits);
                this.get('tests').clear();
                this.get('tests').addObjects(tests);
                // Algolia cache's results which should be great BUT
                // Ember-Data removes the .id from payloads when extracting
                // This causes an error on 'response.hits' cache as their
                // 'id' has been removed.
                this.get('testIndex').clearCache();
                $("html, body").animate({scrollTop: 200}, "fast");
            }.bind(this), function (error) {
                console.dir(error);
            });
    },

    throttleGetTests: function () {
        Ember.run.debounce(this, this.getTestsNew, 200);
    }.observes('searchTerm.length', 'activeTags.length', 'activeCategories.length',
        'model.id', 'readyToGetTests'),

    testsOnPage: function () {
        if (!this.get('tests.length'))
            return;
        return this.get('tests').slice(this.get('skip'), this.get('skip') + this.get('limit'));
    }.property('tests.length', 'order', 'skip'),

    /*
     * Sets a semantic page description for SEO.
     */
    setPageDescription: function () {
        if (this.get('testsOnPage.length') || !window.prerenderReady) {
            var childCategoryText = "";
            if (this.get('childCategories.length')) {
                if (this.get('childCategories').objectAt(0))
                    childCategoryText += ": " + this.get('childCategories').objectAt(0).get('name');
                if (this.get('childCategories').objectAt(1))
                    childCategoryText += ", " + this.get('childCategories').objectAt(1).get('name');
                if (this.get('childCategories').objectAt(2))
                    childCategoryText += ", " + this.get('childCategories').objectAt(2).get('name');
                childCategoryText += " and more";
            }
            this.send('updatePageDescription', "Take MCQ tests in " + this.get('name') +
                childCategoryText +
                "! There are " + this.get('totalTests') +
                " tests to choose from, or create your own!");
            this.send('prerenderReady');
        }
    }.observes('testsOnPage.length'),

    seoPageHeader: function () {
        var pageTitle;

        pageTitle = this.get('model.name') + " MCQs";
        this.send('updatePageTitle', pageTitle);
        return pageTitle;
    }.property('model.name.length'),

    seoChildCategories: function () {
        if (!this.get('childCategories.length') || !this.get('model.hasChildren'))
            return "";
        else {
            var seoString = "",
                shuffledChildCategories = _.shuffle(this.get('childCategories')),
                totalCategories = this.get('childCategories.length');

            if (totalCategories > 8)
                totalCategories = 8;

            for (var i = 0; i < totalCategories; i++) {
                if (i < (totalCategories - 1))
                    seoString += shuffledChildCategories[i].get('name') + ", ";
                else
                    seoString = seoString.slice(0, -2) + " and " + shuffledChildCategories[i].get('name');
            }
            return seoString;
        }
    }.property('childCategories.length'),

    // Used by TagAndCat mixin when toggling categories
    oneCategoryAtATime: true,

    actions: {
        changeOrder: function (order) {
            this.transitionTo({queryParams: {order: order}});
        },

        searchTests: function () {
            /*
             * Do not want to getTests() every time the searchTerm value is update
             * We only want to make a query when the user explicitly presses enter
             * Therefore, keep 'search' and 'searchTerm' as separate for the
             * getTests().observer
             */
            this.transitionTo({queryParams: {search: this.get('searchTerm'), page: 1}});
        },

        incrementLoadingItems: function () {
            this.incrementProperty('loadingItems');
        },

        decrementLoadingItems: function () {
            if (this.get('loadingItems'))
                this.decrementProperty('loadingItems');
            //this.send('decrementLoadingItems');
        },


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

        }

    }

});

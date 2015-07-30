import Ember from 'ember';
import ParseHelper from '../utils/parse-helper';
import CurrentUser from '../mixins/current-user';

export default Ember.Controller.extend(CurrentUser, {
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

    tests: [],
    childCategories: null,

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

            /*
             * If there are categories to filter in the queryParams,
             * wait or those to filter the selectedCategories before
             * retrieving tests
             */
            if (!this.get('categoryFilterSlugs.length')) {
                this.set('readyToGetTests', true);
            }
            /*
             * We wait for childCategories and selectedCategories to be set up
             * before filtering any out: if no queryParams are found
             * The 'filterTheseCategories' method adds all childCategories to
             * the selectedCategories array
             */
            this.set('readyForFilter', true);
        }
        if (!this.get('model.id'))
            return;
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
        this.set('childCategories', childCategories);
        this.set('readyToGetTests', true);
        this.set('alreadyGotChildCategories', true);
    }.observes('model.id', 'browseAll'),

    readyToGetTests: false,
    getTests: function () {
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

    getTestsNew: function () {
        this.get('testIndex').search(this.get('searchTerm')).then(function (response) {
            var tests = ParseHelper.extractRawPayload(this.store, 'test', response.hits);
            this.get('tests').clear();
            this.get('tests').addObjects(tests);
        }.bind(this), function (error) {
            console.dir(error);
        });
    },

    throttleGetTests: function () {
        Ember.run.debounce(this, this.getTestsNew, 200);
    }.observes('searchTerm.length'),

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

    actions: {
        changeOrder: function (order) {
            console.log("changeOrder");
            this.transitionTo({queryParams: {order: order}});
        },

        searchTests: function () {
            /*
             * Do not want to getTests() every time the searchTerm value is update
             * We only want to make a query when the user explicitly presses enter
             * Therefore, keep 'search' and 'searchTerm' as separate for the
             * getTests().observer
             */
            console.log("searchTests");
            this.transitionTo({queryParams: {search: this.get('searchTerm'), page: 1}});
        },

        incrementLoadingItems: function () {
            this.incrementProperty('loadingItems');
        },

        decrementLoadingItems: function () {
            if (this.get('loadingItems'))
                this.decrementProperty('loadingItems');
            //this.send('decrementLoadingItems');
        }
    }

});

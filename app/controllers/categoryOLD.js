import
    Ember
    from
        'ember';

import
    ParseHelper
    from
        '../utils/parse-helper';

export default
    Ember.ObjectController.extend({
        needs: 'application',

        applicationController: function () {
            return this.get('controllers.application');
        }.property('controllers'),

        /*loadingItems: function () {
         return this.get('controllers.application.loadingItems');
         }.property('controllers.application.loadingItems'),*/

        loadingItems: 0,

        queryParams: ['page', 'order', 'categoryFilter', 'filterCategoryIds', 'search'],

        /*
         * Query paramaters
         */

        page: 1,

        order: 'relevance',

        categoryFilter: '',

        filterCategoryIds: '',

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
            if (pagesToShow.indexOf(this.get('totalPages')) === -1)
                pagesToShow.push(this.get('totalPages'));
            return pagesToShow;
        }.property('page', 'totalPages'),

        /*
         * Query: Filter categories
         * --
         * Not using this for now
         * The outcome of this hook should cause
         * the checkboxes to update on 'child-category' views.
         * It does not seem to be working.
         */
        categoryFilterSlugs: function () {
            var array;
            if (!this.get('categoryFilter.length'))
                array = [];
            else
                array = this.get('categoryFilter').split(",");
            return array;
        }.property('categoryFilter.length'),
        readyForFilter: false,
        filterTheseCategories: function () {
            if (!this.get('readyForFilter')) {
                return;
            }
            if (!this.get('categoryFilter.length')) {
                if (this.get('selectedCategories.length') !== this.get('childCategories.length')) {
                    this.get('selectedCategories').clear();
                    this.get('selectedCategories').addObjects(this.get('childCategories.content'));
                }
                return;
            }
            var categoryFilterSlugs = this.get('categoryFilterSlugs'),
                categories = [];

            this.get('selectedCategories').clear();

            for (var i = 0; i < categoryFilterSlugs.length; i++) {
                var categorySlug = categoryFilterSlugs[i];
                var category = this.get('childCategories.content').findBy('slug', categorySlug);
                if (category)
                    categories.pushObject(category);

            }

            this.get('selectedCategories').addObjects(categories);
            this.set('readyToGetTests', true);
        }.observes('readyForFilter', 'categoryFilterSlugs.length'),


        tests: [],
        childCategories: null,
        selectedCategories: null,

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

                this.send('incrementLoadingItems');
                var where = {
                    level: 1
                };
                this.store.findQuery('category', {
                    where: JSON.stringify(where),
                    order: 'name'
                }).then(function (allTopLevelCategories) {
                    this.send('decrementLoadingItems');
                    this.set('childCategories', allTopLevelCategories);
                    /*
                     * Selected categories allow users to filter
                     * the search results by the category(ies) they want
                     */
                    this.set('selectedCategories', []);
                    this.get('selectedCategories').pushObjects(this.get('childCategories.content'));
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
                }.bind(this));
                return;
            }
            if (!this.get('model.id'))
                return;

            if (this.get('alreadyGotChildCategories'))
                return;
            this.set('alreadyGotChildCategories', true);

            this.send('incrementLoadingItems');
            /*
             * Get this category's child categories
             */
            var where;
            if(this.get('parent.id')) {
                where = {
                    parent: ParseHelper.generatePointer(this.get('parent'), 'category')
                };
            } else {
                where = {
                    parent: ParseHelper.generatePointer(this.get('model'), 'category')
                };
            }
            this.store.findQuery('category', {
                where: JSON.stringify(where),
                order: 'name'
            }).then(function (childCategories) {
                this.send('decrementLoadingItems');
                this.set('childCategories', childCategories);
                /*
                 * Selected categories allow users to filter
                 * the search results by the category(ies) they want
                 */
                this.set('selectedCategories', []);
                var parentAndchildCategories = [];
                /*
                 * Add the parent category
                 * This will include tests directly pointed
                 * to the top level category, for e.g. Law
                 * which has no children.
                 */
                if(this.get('hasChildren'))
                    parentAndchildCategories.addObjects(childCategories);
                parentAndchildCategories.pushObject(this.get('model'));
                this.get('selectedCategories').pushObjects(parentAndchildCategories);
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
            }.bind(this));
        }.observes('model.id', 'browseAll'),

        readyToGetTests: false,
        getTests: function () {
            if (!this.get('readyToGetTests'))
                return;
            if (!this.get('selectedCategories.length')) {
                this.get('tests').clear();
                return;
            }
            this.send('incrementLoadingItems');
            /*
             * Get tests which belong to the parent category
             * AND any of the selected childCategories
             */
            var where = {};
            if (this.get('search.length')) {
                var stopWords = ParseHelper.stopWords,
                    tags = _.filter(this.get('search').toLowerCase().split(' '), function (w) {
                        return w.match(/^\w+$/) && !_.contains(stopWords, w);
                    });
                where.tags = {
                    "$all": tags
                };
            }
            if (!this.get('browseAll'))
                where.category = {
                    "$in": ParseHelper.generatePointers(this.get('selectedCategories'))
                };

            var order = this.get('order');
            if (order === 'recent')
                order = '-createdAt';
            if (order === 'relevance')
                order = '-quality';
            this.store.findQuery('test', {
                where: JSON.stringify(where),
                order: order
            })
                .then(function (tests) {
                    this.get('tests').clear();
                    this.get('tests').addObjects(tests);
                    this.send('decrementLoadingItems');
                }.bind(this));
        }.observes('readyToGetTests', 'selectedCategories.length', 'order', 'search'),

        testsOnPage: function () {
            if (!this.get('tests.length'))
                return;

            return this.get('tests').slice(this.get('skip'), this.get('skip') + this.get('limit'));

        }.property('page', 'tests.length', 'order'),

        /*
         * Sets a semantic page description for SEO.
         */
        setPageDescription: function () {
            if (this.get('testsOnPage.length') || !window.prerenderReady) {
                var childCategoryText = "";
                if (this.get('childCategories.length')) {
                    childCategoryText += ": " + this.get('childCategories').objectAt(0).get('name');
                    childCategoryText += ", " + this.get('childCategories').objectAt(1).get('name');
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
            if(this.get('selectedCategories.length') === 1) {
                var category = this.get('selectedCategories').objectAt(0),
                    name = category.get('secondaryName.length') ? category.get('secondaryName') : category.get('name');
                pageTitle = name + " MCQs";
                this.send('updatePageTitle', pageTitle);
            } else {
                pageTitle =  this.get('name') + " MCQs";
                this.send('updatePageTitle', pageTitle);
            }
            return pageTitle;
        }.property('selectedCategories.length'),

        seoChildCategories: function () {
            if (!this.get('childCategories.length') || !this.get('hasChildren'))
                return "";
            else {
                var seoString = "",
                    shuffledChildCategories = _.shuffle(this.get('childCategories.content')),
                    totalCategories = this.get('childCategories.length');

                if (totalCategories > 8)
                    totalCategories = 8;

                for(var i = 0; i < totalCategories; i++) {
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
            }
        }

    });
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
    queryParams: ['page', 'order', 'categoryFilter', 'filterCategoryIds', 'search'],

    /*
     * Query paramaters
     */

    page: 1,

    order: 'title',

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
        if(!this.get('categoryFilter.length'))
            array = [];
        else
            array = this.get('categoryFilter').split("-");
        return array;
    }.property('categoryFilter.length'),
    readyForFilter: false,
    filterTheseCategories: function () {
        if (!this.get('readyForFilter')) {
            return;
        }
        if(!this.get('categoryFilter.length')) {
            if(this.get('selectedCategories.length') !== this.get('childCategories.length')) {
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
        if (!this.get('model.id'))
            return;

        /*
         * Get this category's child categories
         */
        var where = {
            parent: ParseHelper.generatePointer(this.get('model'))
        };
        this.store.findQuery('category', {
            where: JSON.stringify(where),
            order: 'name'
        }).then(function (childCategories) {
                this.set('childCategories', childCategories);
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
                if(!this.get('categoryFilterSlugs.length')) {
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
    }.observes('model'),

    readyToGetTests: false,
    getTests: function () {
        if(!this.get('readyToGetTests'))
            return;
        if (!this.get('selectedCategories.length')) {
            this.get('tests').clear();
            return;
        }
        /*
         * Get tests which belong to the parent category
         * AND any of the selected childCategories
         */
        var where;
        if (this.get('search.length')) {
            where = {
                category: {
                    "$in": ParseHelper.generatePointers(this.get('selectedCategories'))
                },
                tags: {
                    "$all": this.get('search').toLowerCase().split()
                }
            };
        } else {
            where = {
                category: {
                    "$in": ParseHelper.generatePointers(this.get('selectedCategories'))
                }
            };
        }

        var order = this.get('order');
        if (order === 'recent')
            order = '-createdAt';
        this.store.findQuery('test', {
            where: JSON.stringify(where),
            //limit: this.get('limit'),
            //skip: this.get('skip'),
            order: order
        })
            .then(function (tests) {
                this.get('tests').clear();
                this.get('tests').addObjects(tests);
            }.bind(this));
    }.observes('readyToGetTests', 'selectedCategories.length', 'order', 'search'),

    testsOnPage: function () {
        if (!this.get('tests.length'))
            return;

        return this.get('tests').slice(this.get('skip'), this.get('skip') + this.get('limit'));

    }.property('page', 'tests.length', 'order'),

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
        }
    }

});

import Ember from 'ember';
import ParseHelper from '../utils/parse-helper';

export default Ember.Component.extend({
    classNames: 'main-search',

    searchClient: function () {
        return algoliasearch("ONGKY2T0Y8", "8553807a02b101962e7bfa8c811fd105");
    }.property(),

    searchTerm: null,
    navbarSearchResults: {tests: new Ember.A(), users: new Ember.A()},

    performNavbarSearch: function () {
        var queries = [],
            testQuery = {
                indexName: "Test",
                query: this.get('searchTerm'),
                params: {
                    hitsPerPage: 5
                }
            },
            userQuery = {
                indexName: "User",
                query: this.get('searchTerm'),
                params: {
                    hitsPerPage: 5
                }
            };
        queries.push(testQuery);
        queries.push(userQuery);
        this.get('searchClient').search(queries).then(function (response) {
            var testResponse = response.results[0],
                userResponse = response.results[1],
                tests = ParseHelper.extractRawPayload(this.get('parentController').store, 'test', testResponse.hits),
                users = ParseHelper.extractRawPayload(this.get('parentController').store, 'parse-user', userResponse.hits);

            // Algolia cache's results which should be great BUT
            // Ember-Data removes the .id from payloads when extracting
            // This causes an error on 'response.hits' cache as their
            // 'id' has been removed.
            this.get('searchClient').clearCache();

            this.set('navbarSearchTotalTestResults', testResponse.nbHits);
            this.set('navbarSearchTotalUserResults', userResponse.nbHits);

            this.get('navbarSearchResults.tests').clear();
            this.get('navbarSearchResults.tests').addObjects(tests);

            this.get('navbarSearchResults.users').clear();
            this.get('navbarSearchResults.users').addObjects(users);

            this.set('navbarSearchFetching', false);
        }.bind(this));
    },

    throttleNavbarSearch: function () {
        this.set('navbarSearchFetching', this.get('searchTerm.length') > 0);

        if (!this.get('searchTerm.length')) {
            this.get('navbarSearchResults.tests').clear();
            this.get('navbarSearchResults.users').clear();
            this.set('navbarSearchTotalTestResults', 0);
            this.set('navbarSearchTotalUserResults', 0);
            return;
        }
        Ember.run.debounce(this, this.performNavbarSearch, 200);
    }.observes('searchTerm.length'),

    navbarSearchTotalTestResults: 0,
    navbarSearchTotalUserResults: 0,
    navbarSearchTotalResults: function () {
        return this.get('navbarSearchTotalTestResults') + this.get('navbarSearchTotalUserResults');
    }.property('navbarSearchTotalTestResults', 'navbarSearchTotalUserResults'),
    navbarSearchMoreTestsToShow: function () {
        return this.get('navbarSearchTotalTestResults') > this.get('navbarSearchResults.tests.length');
    }.property('navbarSearchTotalTestResults', 'navbarSearchResults.tests.length'),

    navbarSearchDual: function () {
        return this.get('navbarSearchResults.tests.length') && this.get('navbarSearchResults.users.length');
    }.property('navbarSearchResults.tests.length', 'navbarSearchResults.users.length'),

    actions: {
        // Called from the search icon
        focusOnNavbarSearch: function () {
            this.$().find('input').focus();
        },

        // input focus-in action
        navbarSearchFocused: function () {
            this.set('navbarSearchIsFocused', true);
        },

        // By click outside the input or results (includes the X span)
        navbarSearchBlurred: function () {
            // Set up a jQuery function to hide the input
            // if clicked outside the form-control or
            // the popdown results div, or the X span.
            if (!this.get('jqueryNavbarSearchHiderSet')) {
                $(document).mouseup(function (e) {
                    var container = this.$(),
                        modal = $("#myModal");
                    if (!container.is(e.target) && !modal.is(e.target)
                        && (_.contains(e.target.classList, "close-icon") ||
                            (container.has(e.target).length === 0 &&
                            modal.has(e.target).length === 0)
                        )) {
                        this.send('navbarSearchHardBlur');
                    }
                }.bind(this));
                this.set('jqueryNavbarSearchHiderSet', true);
            }
        },

        // called by actions.navbarSearchBlurred
        // or currentPathChange
        navbarSearchHardBlur: function () {
            this.set('navbarSearchIsFocused', false);
            this.set('searchTerm', "");
            this.$().find('input').blur();
        },

        navbarSearchTakeToBrowseForResults: function () {
            this.transitionTo('category', "all",
                {
                    queryParams: {searchTerm: this.get('searchTerm')}
                });
        },

        searchItemClicked: function (object, className) {
            if (className === 'test')
                this.transitionToRoute('testInfo', object.slug);
            else if (className === 'parse-user')
                this.transitionToRoute('user', object.slug);
        },

        openModal: function (a, b, c) {
            this.get('parentController').send('openModal', a, b, c);
        }
    }
});

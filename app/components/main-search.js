import Ember from 'ember';
import ParseHelper from '../utils/parse-helper';

export default Ember.Component.extend({
    classNames: 'main-search',

    searchClient: function () {
        return algoliasearch("ONGKY2T0Y8", "8553807a02b101962e7bfa8c811fd105");
    }.property(),

    searchTerm: '',

    searchPlaceholder: '',

    navbarSearchIsFocused: false,

    inlineResults: false,

    usersOnly: false,

    testsOnly: false,

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
        if (!this.get('usersOnly'))
            queries.push(testQuery);
        if (!this.get('testsOnly'))
            queries.push(userQuery);
        ParseHelper.cloudFunction(this.get('parentController'), 'performSearch', {multipleQueries: queries})
            .then(function (response) {
                if (!this)
                    return;

                var testResponse,
                    userResponse,
                    tests,
                    users;

                if (this.get('usersOnly'))
                    userResponse = response.results[0];
                else if (this.get('testsOnly'))
                    testResponse = response.results[0];
                else {
                    testResponse = response.results[0];
                    userResponse = response.results[1];
                }

                if (testResponse)
                    tests = ParseHelper.extractRawPayload(this.get('parentController').store, 'test', testResponse.hits);

                if (userResponse)
                    users = ParseHelper.extractRawPayload(this.get('parentController').store, 'parse-user', userResponse.hits);
                // Algolia cache's results which should be great BUT
                // Ember-Data removes the .id from payloads when extracting
                // This causes an error on 'response.hits' cache as their
                // 'id' has been removed.
                this.get('searchClient').clearCache();

                if (testResponse)
                    this.set('navbarSearchTotalTestResults', testResponse.nbHits);

                if (userResponse)
                    this.set('navbarSearchTotalUserResults', userResponse.nbHits);

                this.get('navbarSearchResults.tests').clear();
                if (tests)
                    this.get('navbarSearchResults.tests').addObjects(tests);

                this.get('navbarSearchResults.users').clear();
                if (users)
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

    monitorPageChange: function () {
    }.on('init'),

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
            // TODO refactor this to 'off' the handler when component is removed
            // Set up a jQuery function to hide the input
            // if clicked outside the form-control or
            // the popdown results div, or the X span.
            if (!this.get('jqueryNavbarSearchHiderSet')) {
                $(document).mouseup(function (e) {
                    var container = this.$(),
                        modal = $("#myModal");
                    if (!container)
                        return;
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
            this.get('parentController').transitionTo('category', "all",
                {
                    queryParams: {searchTerm: this.get('searchTerm')}
                });
        },

        openModal: function (a, b, c) {
            this.get('parentController').send('openModal', a, b, c);
        },

        itemClicked: function () {
            // Called from user-card for now
            this.send('navbarSearchHardBlur');
        }
    }
});

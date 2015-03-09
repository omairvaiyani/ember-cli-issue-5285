import ParseHelper from '../utils/parse-helper';

export default {
    name: 'session',
    after: 'parse-user-reopen',

    initialize: function (container, application) {
        var sessionToken = localStorage.sessionToken;
        if (sessionToken) {
            application.deferReadiness();
            var store = container.lookup('store:main'),
                ParseUser = store.modelFor('parse-user'),
                currentUser;

            ParseUser.validateSessionToken(store, sessionToken)
                .then(function (user) {
                    if (!user)
                        return;
                    currentUser = user;
                    application.register('user:current', currentUser, {instantiate: false, singleton: true});

                    /*
                     * Injecting 'currentUser' into ApplicationController only.
                     * Using 'current-user' mixin to maintain a single instance
                     * and reference point for every module to opt into using
                     * import CurrentUser  from '../mixins/current-user';
                     */
                    /*application.inject('route:application', 'currentUser', 'user:current');*/
                    application.inject('controller:application', 'currentUser', 'user:current');
                    application.advanceReadiness();
                }, function (error) {
                    console.dir(error);
                    application.advanceReadiness();
                });

        }
    }
};

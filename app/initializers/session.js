import
ParseHelper
from
'../utils/parse-helper';

export default {
        name: 'session',
        after: 'parse-user-reopen',

        initialize:
        function (container, application) {
            application.deferReadiness();

            var sessionToken = localStorage.sessionToken;

            if (sessionToken) {
                var store = container.lookup('store:main'),
                    ParseUser = store.modelFor('parse-user'),
                    currentUser;

                ParseUser.validateSessionToken(store, sessionToken)
                    .then(function (userMinimal) {
                        return store.findById('parse-user', userMinimal.get('id'));
                    },
                    function (error) {
                        console.dir(error);
                        application.advanceReadiness();
                    }
                ).then(function (user) {
                        currentUser = user;
                        var arrayOfPromises = [];
                        arrayOfPromises.push(currentUser.get('latestAttempts'));

                        var where = {
                            "$relatedTo": {
                                "object": ParseHelper.generatePointer(currentUser),
                                "key": "following"
                            }
                        };
                        arrayOfPromises.push(store.findQuery('parse-user', {where: JSON.stringify(where)}));

                        where = {
                            "$relatedTo": {
                                "object": ParseHelper.generatePointer(currentUser),
                                "key": "followers"
                            }
                        };
                        arrayOfPromises.push(store.findQuery('parse-user', {where: JSON.stringify(where)}));

                        where = {
                            "user": ParseHelper.generatePointer(currentUser)
                        };
                        arrayOfPromises.push(store.findQuery('attempt', {where: JSON.stringify(where), order: '-createdAt'}));
                        return Em.RSVP.Promise.all(arrayOfPromises);
                    }).then(function (result) {
                        var following = result.objectAt(1).get('content'),
                            followers = result.objectAt(2).get('content'),
                            attempts = result.objectAt(3).get('content');

                        currentUser.set('following', following);
                        currentUser.set('followers', followers);
                        currentUser.set('attempts', attempts);

                        application.register('user:current', currentUser, { instantiate: false, singleton: true });

                        /*
                         * Injecting 'currentUser' into ApplicationController only.
                         * Using 'current-user' mixin to maintain a single instance
                         * and reference point for every module to opt into using
                         * import CurrentUser  from '../mixins/current-user';
                         */
                        /*application.inject('route:application', 'currentUser', 'user:current');*/
                        application.inject('controller:application', 'currentUser', 'user:current');
                        application.advanceReadiness();
                    });

            } else
                application.advanceReadiness();

        }
};

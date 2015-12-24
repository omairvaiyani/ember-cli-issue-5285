import Ember from 'ember';
import CurrentUser from '../mixins/current-user';
import TagsAndCats from '../mixins/tags-and-cats';
import SortBy from '../mixins/sort-by';
import EstimateMemoryStrength from '../mixins/estimate-memory-strength';
import DeleteWithUndo from '../mixins/delete-with-undo';
import ParseHelper from '../utils/parse-helper';

// TODO check for unused mixins
export default
Ember.Controller.extend(CurrentUser, TagsAndCats, SortBy, EstimateMemoryStrength, DeleteWithUndo, {
    needs: ['application', 'index/user'],

    applicationController: function () {
        return this.get('controllers.application');
    }.property('controllers.length'),

    /**
     * @Property Show Guest Page
     * Only show guest page if
     * - On index.index without currentUser.
     *
     * @return {boolean}
     */
    showGuestPage: function () {
        var currentPath = this.get('applicationController.currentPath');

        if (currentPath === "index.index" && !this.get('currentUser'))
            return true;

    }.property('currentUser', 'applicationController.currentPath.length'),

    /**
     * @Property Show User Page
     * Only show user page if
     * - On index.* with currentUser
     * - OR, index.user without currentUser
     *
     * @return {boolean}
     */
    showUserPage: function () {
        var currentPath = this.get('applicationController.currentPath');
        if (this.get('currentUser') || currentPath === "index.user")
            return true;

    }.property('currentUser', 'applicationController.currentPath.length'),

    /**
     * @Property Show User Home Navigation
     * Hide if
     * - Index/UserRoute AND !isCurrentUser
     * else show.
     */
    showUserHomeNavigation: function () {
        if (this.get('applicationController.currentPath') === "index.user")
            return this.get('isCurrentUser');
        else
            return true;
    }.property('isCurrentUser', 'applicationController.currentPath.length'),

    isCurrentUser: function () {
        return this.get('controllers.index/user.isCurrentUser');
    }.property('controllers.index/user.isCurrentUser'),

    /***
     * CURRENT USER MODE
     ***
     */

    // Demo Code
    getAndSetCurrentUserTiles: function () {
        // To avoid multiple concurrent calls due to observer updates
        this.set('fetchingCurrentUserTiles', true);

        var tiles = [],
            createTestTile = new Ember.Object();

        createTestTile.set('createTest', true);
        createTestTile.set('title', "Create a new Quiz");
        createTestTile.set('iconUrl', '/img/create-quiz.png');
        createTestTile.set('actionName', 'goToRoute');
        createTestTile.set('actionLabel', "Start Now");
        createTestTile.set('routePath', 'create');
        tiles.push(createTestTile);

        ParseHelper.cloudFunction(this, 'refreshTilesForUser', {}).then(function (result) {
            _.each(result.tiles, function (tile) {
                if (tile.type)
                    tile[tile.type] = true;
                if (tile.test && !this.store.all('parse-user').filterBy('id', tile.test.id).objectAt(0))
                    ParseHelper.extractRawPayload(this.store, 'test', tile.test);
                tiles.push(Ember.Object.create(tile));
            }.bind(this));
            this.get('currentUser.tiles').clear();
            this.get('currentUser.tiles').addObjects(tiles);
        }.bind(this), function (error) {
            console.dir(error);
        }).then(function () {
            this.set('fetchingCurrentUserTiles', false);
        }.bind(this));
    },

    setUserTilesRefresherCycle: function () {
        var _this = this;
        _this.set('refresherCycleIsSet', true);
        _this.getAndSetCurrentUserTiles();

        // Refresh tiles every 5 minutes
        setInterval( function() {
            _this.getAndSetCurrentUserTiles();
        }, 300000);
    },

    /**
     * @Property Show Current User Mini Profile
     * Only show if
     * - On index.index with currentUser
     * @return {boolean}
     */
    showCurrentUserMiniProfile: function () {
        var currentPath = this.get('applicationController.currentPath');
        if (this.get('currentUser') || currentPath === "index.index")
            return true;

    }.property('currentUser', 'applicationController.currentPath.length'),


    /***
     * GUEST MODE
     ***
     */
    showFullAnimationVideo: false,

    onboardUser: function () {
        return this.store.createRecord('parse-user', {
            studying: "", studyingAt: "", placeOfStudy: "", studyYear: "",
            moduleTags: new Ember.A(), srIntensityLevel: -1
        });
    }.property(),

    showStats: true,

    // TODO get updated stats
    stats: {
        numberOfUsers: 15000,
        numberOfTests: 1200,
        numberOfQuestions: 258800,
        numberOfAttempts: 97500
    },
    /**
     * @Function Should Show Stats
     *
     * Called from ApplicationController.currentPathDidChange
     * Only if a guest visits the homepage.
     * This trigger is removed on IndexRoute exit.
     */
    shouldShowStats: function () {
        var _this = this;
        setTimeout(function () {
            $(function () {
                var oTop = $("#stats-row").offset().top - window.innerHeight;
                $(window).scroll(function () {
                    var pTop = $('body').scrollTop();
                    if (pTop > oTop) {
                        _this.set('showStats', true);
                    }
                });
            });
        }, 800);
    },

    /**
     * @Function Resize Index Cover Video
     *
     * Called from ApplicationController.currentPathDidChange
     * Only if a guest visits the homepage.
     * This trigger is removed on IndexRoute exit.
     */
    resizeIndexCover: function () {
        var calculateHeight = function () {
            var height = $(window).outerHeight() - 136,
                width = $(window).outerWidth();
            // Need more space at the bottom on mobile screens
            if (width < 768)
                height = height - 60;

            if (height < 400)
                height = 400;

            else if (height > 820)
                height = 820;

            return height;
        };

        // for the window resize
        $(window).ready(function () {
            // Set it first, but need a delay
            setTimeout(function () {
                var height = calculateHeight();
                $('.index-page-cover').css('height', height + 'px');
            }, 200);
            // Set resize trigger
            $(window).resize(function () {
                var height = calculateHeight();
                $('.index-page-cover').css('height', height + 'px');
            });
        }.bind(this));

    },

    actions: {
        /***
         * CURRENT USER MODE
         ***
         */
        dismissLatestSRTest: function () {
            this.send('addNotification',
                {type: "clock", title: "Test dismissed for now", message: "You can still take it later."});

            this.set('currentUser.srLatestTestDismissed', true);
            this.get('currentUser').save();
        },

        /***
         * GUEST MODE
         ***
         */
        toggleAnimationVideoContainer: function () {
            var _this = this;

            _this.toggleProperty('showFullAnimationVideo');

            setTimeout(function () {
                var videoContainer = $(".full-animation-video-container");

                if (_this.get('showFullAnimationVideo')) {
                    videoContainer.on('click', function () {
                        _this.set('showFullAnimationVideo', false);
                    });
                } else {
                    videoContainer.off('click');
                }
            }, 500);
        },

        indexLearnMoreScroll: function () {
            $('html, body').animate({
                scrollTop: $("#learn-more-flag").offset().top
            }, 400);
        },

        indexBackToTopScroll: function () {
            $('html, body').animate({
                scrollTop: $("#join-beta-flag").offset().top + 150
            }, 400);
            $("#mce-EMAIL").focus();
        },

        subscribeEmailForBeta: function () {
            $("#mc-embedded-subscribe-form").submit();
        }

    }
});

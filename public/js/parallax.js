/**
 * Author: Heather Corey
 * jQuery Simple Parallax Plugin
 *
 */

(function($) {

    $.fn.parallax = function(options, overlay) {

        var windowHeight = $(window).height();

        // Establish default settings
        var settings = $.extend({
            speed        : 0.15
        }, options);

        // Iterate over each object in collection
        this.each( function() {

            // Save a reference to the element
            var $this = $(this);

            // Set up Scroll Handler
            var scrollHandler = function(){

                var scrollTop = $(window).scrollTop();
                var offset = $(this).offset().top;
                var height = $(this).outerHeight();

                // Check if above or below viewport
                if (offset + height <= scrollTop || offset >= scrollTop + windowHeight) {
                    return;
                }

                var yBgPosition = Math.round((offset - scrollTop) * settings.speed);

                // Apply the Y Background Position to Set the Parallax Effect
                $this.css('background-position', 'center ' + yBgPosition + 'px');
                if(overlay)
                    overlay.css('background-position', 'center ' + yBgPosition + 'px');

            };
            return scrollHandler;
        });
    }
}(jQuery));
export default

function (viewRef, options, overlayRef) {
    var windowHeight = $(window).height();

    // Establish default settings
    var settings = $.extend({
        speed: 0.15
    }, options);

    var scrollHandler = function () {
        var view = $(viewRef),
            overlay,
            scrollTop = $(window).scrollTop(),
            offset = view.offset().top,
            height = view.outerHeight();

        if(overlayRef)
           overlay = $(overlayRef);
        // Check if above or below viewport
        if (offset + height <= scrollTop || offset >= scrollTop + windowHeight) {
            return;
        }

        var yBgPosition = Math.round((offset - scrollTop) * settings.speed);

        // Apply the Y Background Position to Set the Parallax Effect
        view.css('background-position', 'center ' + yBgPosition + 'px');
        if (overlay)
            overlay.css('background-position', 'center ' + yBgPosition + 'px');
    }
    return scrollHandler;
}

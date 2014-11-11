import Ember from 'ember';
import TouchSlider from '../utils/touch-slider';

export default Ember.Component.extend({
    classNameBindings: [
        'container-fluid'
    ],

    swiperContainer: null,

    didInsertElement: function () {
        if (this.get('type') === "fullWidth")
            this.set('isFullWidth', true);

        $(document).ready(function () {
            setTimeout(function () {
                    var mySwiper = $('.swiper-container').swiper({
                        mode: 'horizontal',
                        loop: false,
                        createPagination: true,
                        paginationClickable: true,
                        pagination: '.my-pagination',
                        resizeReInit: true,
                        calculateHeight: false
                    });
                    this.set('swiperContainer', mySwiper);
                }.bind(this),
                500);
            setTimeout(function () {
                    this.get('swiperContainer').reInit();
                }.bind(this),
                600);
        }.bind(this));
    }
});

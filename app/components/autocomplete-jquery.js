import Ember from 'ember';

export default Ember.TextField.extend({
    classNames: 'form-control margin-bottom-16',

    init: function() {
        console.dir(this);
        var autocomplete = this.$().autocomplete({
            serviceUrl:'service/autocomplete.ashx',
            minChars:2,
            delimiter: /(,|;)\s*/, // regex or character
            maxHeight:400,
            width:300,
            zIndex: 9999,
            deferRequestBy: 0, //miliseconds
            params: { country:'Yes' }, //aditional parameters
            noCache: false, //default is false, set to true to disable caching
            // callback function:
            onSelect: function(value, data){ alert('You selected: ' + value + ', ' + data); },
            // local autosugest options:
            lookup: ['January', 'February', 'March', 'April', 'May'] //local lookup values
        });
    }
});

import Ember from 'ember';

export default
    Ember.Handlebars.makeBoundHelper(function (value, downTo) {
        if (!value)
            return 0;
        else if (downTo)
            return Math.round(value);
        else {
            return Math.round(value); // TODO figure this shit out
            // Currently used to round numbers down to
            // nearest 10, i.e. 68 = 60, 104 = 100
            // Allows for strings such as:
            // Search from over 60 tests. When value was 68.
            var rounded = Math.round(value);
            if (rounded > 10) {
                var valueString = rounded += "",
                    removeLastNumber = valueString.slice(0, -1);
                return parseInt(removeLastNumber += "0");
            }
            return rounded;
        }
    });

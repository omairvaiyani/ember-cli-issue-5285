import Ember from 'ember';

function pluralizeWord(singular, value, plural) {
    if (value < 2)
        return singular;
    else if (plural.length)
        return plural;
    else
        return singular + "s";
};

export { pluralizeWord };

export default Ember.Handlebars.makeBoundHelper(pluralizeWord);

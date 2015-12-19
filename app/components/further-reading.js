import Ember from 'ember';
import FormValidator from '../utils/form-validation';
import ParseHelper from '../utils/parse-helper';

export default Ember.Component.extend({

    fetchFurtherReadingUrlMetaData: function () {
        if (!this.get('question.furtherReadingUrl') || !FormValidator.url(this.get('question.furtherReadingUrl')))
            return this.set('question.furtherReadingMetaData', undefined);

        this.set('question.furtherReadingMetaData', undefined);
        var parentController = this.get('parentController');

        var question = this.get('question');

        ParseHelper.cloudFunction(parentController, 'fetchUrlMetaData', {url: this.get('question.furtherReadingUrl')})
            .then(function (result) {
                if (result.title)
                    question.set('furtherReadingMetaData', result);
            }.bind(this), function (error) {
                console.dir(error);
            });

    }.observes('question.furtherReadingUrl.length')
});
